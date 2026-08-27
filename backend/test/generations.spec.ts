import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient, Vendor, GenerationStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/common/prisma.service';
import { CreditsService } from '../src/credits/credits.service';
import { PricingService } from '../src/pricing/pricing.service';
import { GenerationsService } from '../src/generations/generations.service';
import { MuApiVendor } from '../src/vendors/muapi.vendor';
import { VendorError, FailureKind, JobStatus, VendorJobHandle } from '../src/vendors/vendor.types';
import { InsufficientCreditsError } from '../src/credits/credits.errors';
import { usdToMicros } from '../src/pricing/money';
import { StorageService } from '../src/storage/storage.service';
import { GenerationQueue } from '../src/queue/generation.queue';

const prisma = new PrismaClient() as PrismaService;
const credits = new CreditsService(prisma);

class TestConfig extends ConfigService {
  values: Record<string, string> = { NGN_PER_USD: '1500', MIN_GROSS_MARGIN: '0.20', MUAPI_KEY: 'test' };
  override get<T>(key: string, fallback?: T): T { return (this.values[key] ?? fallback) as T; }
}

/** A MuAPI we can make behave badly on demand. */
class FakeVendor extends MuApiVendor {
  submitError: Error | null = null;
  nextStatus: JobStatus = { state: 'processing' };
  statusError: Error | null = null;
  submitted = 0;

  constructor() { super(new TestConfig()); }

  override async submitJob(): Promise<VendorJobHandle> {
    this.submitted++;
    if (this.submitError) throw this.submitError;
    return { vendorJobId: `vendor-${crypto.randomUUID()}` };
  }

  override async checkStatus(): Promise<JobStatus> {
    if (this.statusError) throw this.statusError;
    return this.nextStatus;
  }
}

/** Records enqueues without needing Redis in these unit tests. */
class FakeQueue {
  enqueued: string[] = [];
  requeued: Array<{ id: string; delay: number }> = [];
  async enqueue(generationId: string): Promise<void> { this.enqueued.push(generationId); }
  async requeue(data: { generationId: string }, delay: number): Promise<void> {
    this.requeued.push({ id: data.generationId, delay });
  }
}

const config = new TestConfig();
const pricing = new PricingService(prisma, config);
const vendor = new FakeVendor();
const queue = new FakeQueue();
/** Storage that records what it was asked to keep, without touching a disk. */
class FakeStorage {
  archived: string[] = [];
  async putUpload(userId: string, body: Buffer, contentType: string) {
    return { key: `uploads/${userId}/x`, url: 'https://files.test/upload' };
  }
  async archiveFromUrl(generationId: string, sourceUrl: string) {
    this.archived.push(sourceUrl);
    return { key: `generations/${generationId}.mp4`, url: `https://files.test/${generationId}.mp4` };
  }
  async freshUrl(key: string) { return `https://files.test/${key}`; }
  async read() { return null; }
}
const storage = new FakeStorage();
const generations = new GenerationsService(prisma, credits, pricing, vendor, queue as unknown as GenerationQueue, storage as unknown as StorageService);

let userId: string;
const DRAFT_PRICE = 6; // ₦300 at ₦50 a credit — asserted in pricing.spec

async function makeFundedUser(creditAmount: number): Promise<string> {
  const user = await prisma.user.create({
    data: { email: `gen-${crypto.randomUUID()}@meerah.test` },
  });
  if (creditAmount > 0) {
    await credits.topup({ userId: user.id, credits: creditAmount, paystackRef: `seed-${crypto.randomUUID()}` });
  }
  return user.id;
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => { await prisma.$disconnect(); });

beforeEach(async () => {
  vendor.submitError = null;
  vendor.statusError = null;
  vendor.nextStatus = { state: 'processing' };
  vendor.submitted = 0;
  queue.enqueued = [];
  queue.requeued = [];
  await prisma.modelPrice.upsert({
    where: { vendor_modelId: { vendor: Vendor.muapi, modelId: 'seedance-pro-t2v-fast' } },
    create: {
      vendor: Vendor.muapi, modelId: 'seedance-pro-t2v-fast', category: 'Text to Video',
      costUsdMicros: usdToMicros(0.06), dynamicPricing: true,
    },
    update: { costUsdMicros: usdToMicros(0.06) },
  });
  userId = await makeFundedUser(100);
});

describe('submit', () => {
  it('charges, submits, and reports the new balance', async () => {
    const result = await generations.submit({ userId, tierId: 'draft', feature: 'VidEngine', prompt: 'lagos market' });

    expect(result.costCredits).toBe(DRAFT_PRICE);
    expect(result.status).toBe(GenerationStatus.processing);
    expect(result.balanceAfter).toBe(100 - DRAFT_PRICE);
    expect(vendor.submitted).toBe(1);
    // The render must be handed to the workers, not done inline.
    expect(queue.enqueued).toEqual([result.generationId]);
  });

  it('refuses a broke account without ever calling the vendor', async () => {
    userId = await makeFundedUser(2);

    await expect(
      generations.submit({ userId, tierId: 'draft', feature: 'VidEngine', prompt: 'x' }),
    ).rejects.toBeInstanceOf(InsufficientCreditsError);

    // The important assertion: we did no paid vendor work for a customer who
    // could not pay for it.
    expect(vendor.submitted).toBe(0);
    expect(queue.enqueued).toHaveLength(0);
    expect(await credits.getBalance(userId)).toBe(2);
  });

  it('refunds immediately when the vendor refuses the job', async () => {
    vendor.submitError = new VendorError(FailureKind.POLICY_REJECTED, 'nope', 'content policy violation');

    await expect(
      generations.submit({ userId, tierId: 'draft', feature: 'VidEngine', prompt: 'something banned' }),
    ).rejects.toBeInstanceOf(VendorError);

    // Charged, then refunded — balance is whole again.
    expect(await credits.getBalance(userId)).toBe(100);
    expect((await credits.audit(userId)).consistent).toBe(true);

    const generation = await prisma.generation.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
    expect(generation?.status).toBe(GenerationStatus.failed);
    expect(generation?.refundedAt).not.toBeNull();
    expect(generation?.errorMessage).toContain('content filter');
  });
});

describe('refresh', () => {
  it('completes and stores the output', async () => {
    const { generationId } = await generations.submit({ userId, tierId: 'draft', feature: 'VidEngine', prompt: 'x' });
    vendor.nextStatus = { state: 'completed', outputUrl: 'https://cdn.example/out.mp4' };

    const result = await generations.refresh(generationId);

    expect(result.status).toBe(GenerationStatus.completed);
    // The stored URL is ours, not the vendor's — vendor links expire, and the
    // customer must still be able to download what they paid for next week.
    expect(result.outputUrl).toContain('files.test');
    expect(storage.archived).toContain('https://cdn.example/out.mp4');
    // A completed job stays paid for.
    expect(await credits.getBalance(userId)).toBe(100 - DRAFT_PRICE);
  });

  it('refunds when the job fails after being accepted', async () => {
    const { generationId } = await generations.submit({ userId, tierId: 'draft', feature: 'VidEngine', prompt: 'x' });
    vendor.nextStatus = {
      state: 'failed',
      error: new VendorError(FailureKind.UNKNOWN, 'render crashed', 'gpu oom'),
    };

    const result = await generations.refresh(generationId);

    expect(result.status).toBe(GenerationStatus.failed);
    expect(await credits.getBalance(userId)).toBe(100);
    expect((await credits.audit(userId)).consistent).toBe(true);
  });

  it('refunds exactly once even if polled repeatedly after failing', async () => {
    const { generationId } = await generations.submit({ userId, tierId: 'draft', feature: 'VidEngine', prompt: 'x' });
    vendor.nextStatus = { state: 'failed', error: new VendorError(FailureKind.UNKNOWN, 'boom') };

    await Promise.all([
      generations.refresh(generationId),
      generations.refresh(generationId),
      generations.refresh(generationId),
    ]);
    await generations.refresh(generationId);

    expect(await credits.getBalance(userId)).toBe(100);
    expect((await credits.audit(userId)).consistent).toBe(true);
  });

  it('does not fail a job over a transient polling error', async () => {
    const { generationId } = await generations.submit({ userId, tierId: 'draft', feature: 'VidEngine', prompt: 'x' });
    vendor.statusError = new VendorError(FailureKind.TRANSIENT, 'upstream 502');

    const result = await generations.refresh(generationId);

    // Still running. A blip in our polling is not the customer's job failing.
    expect(result.status).toBe(GenerationStatus.processing);
    expect(await credits.getBalance(userId)).toBe(100 - DRAFT_PRICE);
  });

  it('keeps the charge on a completed job even when polled again', async () => {
    const { generationId } = await generations.submit({ userId, tierId: 'draft', feature: 'VidEngine', prompt: 'x' });
    vendor.nextStatus = { state: 'completed', outputUrl: 'https://cdn.example/out.mp4' };
    await generations.refresh(generationId);

    vendor.nextStatus = { state: 'failed', error: new VendorError(FailureKind.UNKNOWN, 'late failure') };
    const again = await generations.refresh(generationId);

    expect(again.status).toBe(GenerationStatus.completed);
    expect(await credits.getBalance(userId)).toBe(100 - DRAFT_PRICE);
  });
});

describe('error taxonomy', () => {
  it('marks only transient and rate-limit failures as retryable', () => {
    expect(new VendorError(FailureKind.TRANSIENT, 'x').retryable).toBe(true);
    expect(new VendorError(FailureKind.RATE_LIMITED, 'x').retryable).toBe(true);
    expect(new VendorError(FailureKind.POLICY_REJECTED, 'x').retryable).toBe(false);
    expect(new VendorError(FailureKind.INVALID_INPUT, 'x').retryable).toBe(false);
    expect(new VendorError(FailureKind.UNKNOWN, 'x').retryable).toBe(false);
  });

  it('never leaks vendor detail into the customer-facing message', () => {
    const error = new VendorError(FailureKind.POLICY_REJECTED, 'internal', 'muapi seedance moderation 42');
    expect(error.userMessage).not.toContain('muapi');
    expect(error.userMessage).not.toContain('seedance');
    expect(error.userMessage).toContain('content filter');
  });
});

describe('ownership', () => {
  it("refuses to show one customer another customer's generation", async () => {
    const { generationId } = await generations.submit({
      userId, tierId: 'draft', feature: 'VidEngine', prompt: 'private work',
    });
    const stranger = await makeFundedUser(0);

    // Same answer as a non-existent id, so an id cannot be used to probe.
    await expect(generations.refresh(generationId, stranger)).rejects.toThrow(/No such generation/);
    await expect(generations.resultForClient(generationId, stranger)).rejects.toThrow(/No such generation/);

    // The owner still sees it.
    const mine = await generations.resultForClient(generationId, userId);
    expect(mine.request_id).toBe(generationId);
  });
});
