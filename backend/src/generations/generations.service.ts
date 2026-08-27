import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { GenerationStatus, Vendor } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CreditsService } from '../credits/credits.service';
import { InsufficientCreditsError, AlreadyRefundedError } from '../credits/credits.errors';
import { PricingService } from '../pricing/pricing.service';
import { getTier } from '../pricing/tiers';
import { MuApiVendor } from '../vendors/muapi.vendor';
import { GenerationVendor, VendorError, FailureKind } from '../vendors/vendor.types';
import { usdToMicros } from '../pricing/money';
import { GenerationQueue } from '../queue/generation.queue';
import { StorageService } from '../storage/storage.service';

export interface SubmitResult {
  generationId: string;
  status: GenerationStatus;
  costCredits: number;
  balanceAfter: number;
}

/**
 * Owns the lifecycle of one generation: quote, charge, submit, settle.
 *
 * The ordering here is deliberate and is the difference between a business and
 * a leak:
 *
 *   - We charge BEFORE submitting, so we can never do vendor work we weren't
 *     paid for.
 *   - If the submit then fails, we refund immediately in the same call.
 *   - A failure discovered later (during polling) refunds too, exactly once,
 *     guarded by `generations.refunded_at`.
 */
@Injectable()
export class GenerationsService {
  private readonly logger = new Logger(GenerationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly pricing: PricingService,
    private readonly muapi: MuApiVendor,
    private readonly queue: GenerationQueue,
    private readonly storage: StorageService,
  ) {}

  private vendorFor(vendor: Vendor): GenerationVendor {
    switch (vendor) {
      case Vendor.muapi:
        return this.muapi;
      default:
        // 9jaLingo lands here in Phase 8.
        throw new Error(`No vendor implementation for '${vendor}'`);
    }
  }

  /**
   * Takes payment and hands the job to the vendor.
   *
   * Throws InsufficientCreditsError before any vendor call happens, so a broke
   * account costs us nothing.
   */
  async submit(params: {
    userId: string;
    /** A curated tier id, or any model id from the synced catalogue. */
    tierId: string;
    feature: string;
    prompt?: string;
    options?: Record<string, unknown>;
  }): Promise<SubmitResult> {
    const tier = getTier(params.tierId);

    // Server prices the job. Whatever the browser displayed is not evidence.
    const quote = tier
      ? await this.pricing.quote(tier.id)
      : await this.pricing.quoteModel(params.tierId);

    const vendor = tier?.vendor ?? Vendor.muapi;
    const modelId = quote.modelId;

    const generation = await this.prisma.generation.create({
      data: {
        userId: params.userId,
        feature: params.feature,
        vendor,
        modelId,
        status: GenerationStatus.queued,
        inputParams: { prompt: params.prompt ?? null, ...(params.options ?? {}) },
        costCredits: quote.credits,
        vendorCostUsdCents: Math.round(quote.breakdown.vendorCostUsd * 100),
      },
    });

    try {
      await this.credits.charge({
        userId: params.userId,
        credits: quote.credits,
        generationId: generation.id,
        idempotencyKey: `gen:${generation.id}`,
      });
    } catch (error) {
      // Never charged, so nothing to refund — just close the record out.
      await this.prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: GenerationStatus.failed,
          errorMessage:
            error instanceof InsufficientCreditsError
              ? 'Not enough credits for this generation.'
              : 'Could not start this generation.',
          completedAt: new Date(),
          refundedAt: new Date(), // nothing was taken; block any later refund
        },
      });
      throw error;
    }

    // Paid. Now hand it to the vendor.
    try {
      const handle = await this.vendorFor(vendor).submitJob({
        modelId,
        prompt: params.prompt,
        options: params.options,
      });

      await this.prisma.generation.update({
        where: { id: generation.id },
        data: { status: GenerationStatus.processing, vendorJobId: handle.vendorJobId },
      });

      // Hand off to the workers. The HTTP response returns now; the render
      // finishes in the background (planning.md §2.5).
      await this.queue.enqueue(generation.id);
    } catch (error) {
      // Charged but the vendor never took it — refund now, don't make them ask.
      await this.settleFailure(generation.id, error as Error);
      throw error;
    }

    return {
      generationId: generation.id,
      status: GenerationStatus.processing,
      costCredits: quote.credits,
      balanceAfter: await this.credits.getBalance(params.userId),
    };
  }

  /**
   * Asks the vendor how a job is doing and settles it if it has finished.
   * Called by the worker and by the status endpoint.
   */
  async refresh(
    generationId: string,
    requesterId?: string,
  ): Promise<{ status: GenerationStatus; outputUrl?: string; message?: string }> {
    const generation = await this.prisma.generation.findUnique({ where: { id: generationId } });
    // Same answer for "does not exist" and "belongs to someone else", so a
    // generation id cannot be used to probe other people's work.
    if (!generation) throw new NotFoundException('No such generation');
    if (requesterId && generation.userId !== requesterId) throw new NotFoundException('No such generation');

    if (generation.status === GenerationStatus.completed) {
      return { status: generation.status, outputUrl: generation.outputUrl ?? undefined };
    }
    if (generation.status === GenerationStatus.failed) {
      return { status: generation.status, message: generation.errorMessage ?? undefined };
    }
    if (!generation.vendorJobId) return { status: generation.status };

    let status;
    try {
      status = await this.vendorFor(generation.vendor).checkStatus({ vendorJobId: generation.vendorJobId });
    } catch (error) {
      const vendorError = error as VendorError;
      // A transient polling error is not a failed job — leave it alone and
      // let the next poll try again.
      if (vendorError instanceof VendorError && vendorError.retryable) {
        return { status: generation.status };
      }
      await this.settleFailure(generationId, vendorError);
      return { status: GenerationStatus.failed, message: vendorError.userMessage };
    }

    if (status.state === 'processing') return { status: GenerationStatus.processing };

    if (status.state === 'completed') {
      // Copy it into our own storage. Vendor URLs expire, and a customer coming
      // back next week for the advert they paid for must still find it there.
      const archived = status.outputUrl
        ? await this.storage.archiveFromUrl(generationId, status.outputUrl)
        : null;

      const outputUrl = archived?.url ?? status.outputUrl;

      await this.prisma.generation.update({
        where: { id: generationId },
        data: {
          status: GenerationStatus.completed,
          outputUrl,
          storageKey: archived?.key ?? null,
          completedAt: new Date(),
        },
      });
      return { status: GenerationStatus.completed, outputUrl };
    }

    await this.settleFailure(generationId, status.error ?? new Error('Generation failed'));
    return {
      status: GenerationStatus.failed,
      message: (status.error as VendorError)?.userMessage ?? 'This generation failed and your credits have been refunded.',
    };
  }

  /** Past generations for the history panel. */
  async history(userId: string, limit = 50): Promise<Array<{
    id: string; feature: string; modelId: string; status: GenerationStatus;
    outputUrl: string | null; costCredits: number; createdAt: Date;
  }>> {
    return this.prisma.generation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      select: {
        id: true, feature: true, modelId: true, status: true,
        outputUrl: true, costCredits: true, createdAt: true,
      },
    });
  }

  /**
   * Called by the worker when the vendor never came back inside MAX_POLL_MS.
   * The customer gets their credits back rather than paying for silence.
   */
  async failTimedOut(generationId: string): Promise<void> {
    const generation = await this.prisma.generation.findUnique({
      where: { id: generationId },
      select: { status: true },
    });
    // A job that finished between the last poll and now is not a timeout.
    if (!generation || generation.status === GenerationStatus.completed) return;

    await this.settleFailure(
      generationId,
      new VendorError(FailureKind.TRANSIENT, 'Vendor did not return in time'),
    );
  }

  /**
   * Everything the MuAPI-compatible status endpoint needs.
   *
   * The forked studio reads `cost.refunded` and `cost.amount_credits` off a
   * failed result to tell the customer their credits came back, so that shape
   * is part of our contract, not an implementation detail.
   */
  async resultForClient(generationId: string, requesterId?: string): Promise<{
    request_id: string;
    status: string;
    outputs: string[];
    error?: string;
    cost: { amount_credits: number; refunded: boolean };
  }> {
    const refreshed = await this.refresh(generationId, requesterId);
    const generation = await this.prisma.generation.findUniqueOrThrow({ where: { id: generationId } });

    return {
      request_id: generation.id,
      status: generation.status === GenerationStatus.processing ? 'processing' : generation.status,
      outputs: generation.outputUrl ? [generation.outputUrl] : [],
      ...(generation.status === GenerationStatus.failed
        ? { error: generation.errorMessage ?? refreshed.message ?? 'Generation failed' }
        : {}),
      cost: {
        amount_credits: generation.costCredits,
        refunded: generation.refundedAt !== null,
      },
    };
  }

  /**
   * Marks a generation failed and returns the credits.
   *
   * Refunding is guarded by `refunded_at` inside CreditsService, so a worker
   * retry racing the status endpoint cannot pay a customer twice.
   */
  private async settleFailure(generationId: string, error: Error): Promise<void> {
    const vendorError = error instanceof VendorError ? error : undefined;
    const kind = vendorError?.kind ?? FailureKind.UNKNOWN;

    try {
      await this.credits.refundGeneration(generationId);
    } catch (refundError) {
      if (!(refundError instanceof AlreadyRefundedError)) throw refundError;
    }

    await this.prisma.generation.update({
      where: { id: generationId },
      data: {
        status: GenerationStatus.failed,
        errorMessage: vendorError?.userMessage ?? 'This generation failed and your credits have been refunded.',
        completedAt: new Date(),
      },
    });

    const log = kind === FailureKind.VENDOR_INSUFFICIENT_FUNDS ? 'error' : 'warn';
    this.logger[log](
      `Generation ${generationId} failed (${kind}) and was refunded: ${vendorError?.vendorDetail ?? error.message}`,
    );
  }
}
