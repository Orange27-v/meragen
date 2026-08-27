import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../common/prisma.service';
import { CreditsService } from '../credits/credits.service';
import { PaystackClient } from './paystack.client';
import {
  getCreditPack, nairaFromKobo, CreditPack,
  paygCredits, validatePaygAmount,
} from './credit-packs';

interface PaystackWebhookEvent {
  event: string;
  data: {
    reference?: string;
    status?: string;
    amount?: number;
    metadata?: Record<string, unknown>;
  };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly paystack: PaystackClient,
  ) {}

  /**
   * Step 1 of a top-up: hand the browser a Paystack checkout URL.
   *
   * Nothing is credited here. The user has not paid yet, and a browser that
   * claims otherwise is not evidence.
   */
  async startTopup(params: {
    userId: string;
    /** A pack id, or omit and pass `amountNaira` to pay as you go. */
    packId?: string;
    amountNaira?: number;
    callbackUrl?: string;
  }): Promise<{ authorizationUrl: string; reference: string; pack: CreditPack }> {
    const pack = params.packId
      ? getCreditPack(params.packId)
      : PaymentsService.paygPack(params.amountNaira);
    if (!pack) throw new BadRequestException(`Unknown credit pack: ${params.packId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: params.userId },
      select: { email: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // Our own reference, not Paystack's. It carries the meaning: this payment
    // buys this pack for this user. The webhook reads it back.
    const reference = `mrh_${pack.id}_${randomUUID()}`;

    const result = await this.paystack.initializeTransaction({
      email: user.email,
      amountKobo: pack.amountKobo,
      reference,
      metadata: {
        userId: params.userId,
        packId: pack.id,
        credits: pack.credits,
        // Pay-as-you-go amounts are not in the fixed pack list, so the webhook
        // needs the price carried with the payment to validate it.
        amountKobo: pack.amountKobo,
      },
      callbackUrl: params.callbackUrl,
    });

    this.logger.log(
      `Top-up started: user=${params.userId} pack=${pack.id} ₦${nairaFromKobo(pack.amountKobo)} ref=${reference}`,
    );

    return { authorizationUrl: result.authorizationUrl, reference: result.reference, pack };
  }

  /**
   * Step 2: Paystack tells us the money arrived.
   *
   * Returns `credited: false` for anything we deliberately ignore, so the
   * controller can still answer 200 and stop Paystack retrying forever.
   */
  async handleWebhook(event: PaystackWebhookEvent): Promise<{ credited: boolean; reason?: string }> {
    if (event.event !== 'charge.success') {
      return { credited: false, reason: `ignored event: ${event.event}` };
    }

    const reference = event.data?.reference;
    if (!reference) return { credited: false, reason: 'missing reference' };

    return this.creditByReference(reference);
  }

  /**
   * The single place credits are granted for a payment.
   *
   * Three routes reach here — the webhook, the browser returning from checkout,
   * and the reconciliation sweep — because any one of them can fail on its own:
   * a webhook needs a public URL, a browser can be closed mid-redirect, and a
   * sweep only runs periodically. All three are safe to run together: the
   * unique constraint on `paystack_ref` means the first one wins and the rest
   * are absorbed.
   *
   * Four things must hold before a single credit is issued — see below.
   */
  async creditByReference(reference: string): Promise<{ credited: boolean; reason?: string }> {
    // 1. Ask Paystack directly rather than believing anyone else.
    const verified = await this.paystack.verifyTransaction(reference);

    if (verified.status !== 'success') {
      this.logger.warn(`Webhook for ${reference} but verify says '${verified.status}' — ignoring`);
      return { credited: false, reason: `verify status: ${verified.status}` };
    }

    // 2. The pack and user come from metadata we set at initialize time.
    const userId = verified.metadata?.userId as string | undefined;
    const packId = verified.metadata?.packId as string | undefined;
    if (!userId || !packId) {
      this.logger.error(`Webhook ${reference} has no userId/packId metadata — cannot credit`);
      return { credited: false, reason: 'missing metadata' };
    }

    const pack = getCreditPack(packId) ?? PaymentsService.paygPackFromMetadata(verified.metadata);
    if (!pack) {
      this.logger.error(`Webhook ${reference} names unknown pack '${packId}'`);
      return { credited: false, reason: 'unknown pack' };
    }

    // 3. The amount actually paid must match the pack's price. Guards against a
    //    tampered reference pointing at a cheap payment but an expensive pack.
    if (verified.amountKobo !== pack.amountKobo) {
      this.logger.error(
        `Webhook ${reference}: paid ${verified.amountKobo} kobo but pack '${packId}' costs ${pack.amountKobo}`,
      );
      return { credited: false, reason: 'amount mismatch' };
    }

    // 4. Credit it. `paystackRef` is unique, so a redelivered webhook returns
    //    the original ledger entry instead of granting a second time.
    const { entry, created } = await this.credits.topup({
      userId,
      credits: pack.credits,
      paystackRef: reference,
    });

    if (created) {
      this.logger.log(
        `Credited ${pack.credits} to user=${userId} ref=${reference} (ledger entry ${entry.id})`,
      );
    } else {
      this.logger.log(`Replay of ${reference} absorbed — already credited (entry ${entry.id})`);
    }

    return { credited: true };
  }

  /** Builds a one-off pack for a pay-as-you-go amount. */
  static paygPack(amountNaira?: number): CreditPack | undefined {
    if (amountNaira === undefined) return undefined;
    if (validatePaygAmount(amountNaira)) return undefined;
    return {
      id: 'payg',
      name: 'Pay as you go',
      amountKobo: amountNaira * 100,
      credits: paygCredits(amountNaira),
      bonusCredits: 0,
    };
  }

  /**
   * Rebuilds a pay-as-you-go pack from what we stored at checkout time.
   *
   * The amount comes from our own metadata, and the caller still checks it
   * against what Paystack says was actually paid — so a tampered amount cannot
   * buy credits it did not pay for.
   */
  private static paygPackFromMetadata(metadata: Record<string, unknown>): CreditPack | undefined {
    if (metadata?.packId !== 'payg') return undefined;
    const amountKobo = Number(metadata.amountKobo);
    if (!Number.isFinite(amountKobo) || amountKobo <= 0) return undefined;
    return {
      id: 'payg',
      name: 'Pay as you go',
      amountKobo,
      credits: paygCredits(amountKobo / 100),
      bonusCredits: 0,
    };
  }

  /**
   * Credits a payment the browser is reporting on its way back from checkout.
   *
   * Scoped to the caller: a reference is only honoured if its metadata names
   * the same user, so nobody can claim someone else's payment by guessing a
   * reference.
   */
  async verifyForUser(userId: string, reference: string): Promise<{ credited: boolean; reason?: string; balance: number }> {
    const verified = await this.paystack.verifyTransaction(reference);
    if (verified.metadata?.userId !== userId) {
      this.logger.warn(`User ${userId} tried to claim reference ${reference} belonging to someone else`);
      return { credited: false, reason: 'not your payment', balance: await this.credits.getBalance(userId) };
    }

    const result = await this.creditByReference(reference);
    return { ...result, balance: await this.credits.getBalance(userId) };
  }

  /**
   * Catches payments no other route credited.
   *
   * Runs on a schedule. This is the backstop for the case that actually bites:
   * the customer paid, the webhook never arrived, and they closed the tab
   * before the browser could tell us. Without it, someone is simply out of
   * pocket until they complain.
   */
  async reconcile(sinceHours = 24): Promise<{ checked: number; credited: number }> {
    const from = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString();
    const transactions = await this.paystack.listSuccessfulTransactions(from);

    let credited = 0;
    for (const transaction of transactions) {
      if (!transaction.reference.startsWith('mrh_')) continue; // not one of ours

      const already = await this.prisma.creditTransaction.findUnique({
        where: { paystackRef: transaction.reference },
        select: { id: true },
      });
      if (already) continue;

      this.logger.warn(`Reconciliation found an uncredited payment: ${transaction.reference}`);
      const result = await this.creditByReference(transaction.reference).catch((error) => {
        this.logger.error(`Reconciliation failed for ${transaction.reference}: ${error.message}`);
        return { credited: false };
      });
      if (result.credited) credited++;
    }

    if (credited > 0) this.logger.warn(`Reconciliation credited ${credited} missed payment(s)`);
    return { checked: transactions.length, credited };
  }
}
