import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { CreditsService } from '../src/credits/credits.service';
import { PrismaService } from '../src/common/prisma.service';
import { PaymentsService } from '../src/payments/payments.service';
import { PaystackClient, VerifiedTransaction } from '../src/payments/paystack.client';
import { getCreditPack } from '../src/payments/credit-packs';

const SECRET = 'sk_test_fake_key_for_signature_tests';

const prisma = new PrismaClient() as PrismaService;
const credits = new CreditsService(prisma);

/** Stands in for Paystack. `verifyTransaction` returns whatever we stage. */
class FakePaystack extends PaystackClient {
  staged: VerifiedTransaction | null = null;

  constructor() {
    super({ get: (_k: string, fallback: string) => SECRET } as never);
  }

  override async verifyTransaction(): Promise<VerifiedTransaction> {
    if (!this.staged) throw new Error('nothing staged');
    return this.staged;
  }
}

const paystack = new FakePaystack();
const payments = new PaymentsService(prisma, credits, paystack);

let userId: string;

function chargeSuccess(reference: string) {
  return { event: 'charge.success', data: { reference } };
}

function stage(over: Partial<VerifiedTransaction> & { reference: string }): void {
  const pack = getCreditPack('creator')!;
  paystack.staged = {
    status: 'success',
    amountKobo: pack.amountKobo,
    currency: 'NGN',
    paidAt: new Date().toISOString(),
    customerEmail: 'buyer@meerah.test',
    metadata: { userId, packId: 'creator', credits: pack.credits },
    ...over,
  };
}

beforeAll(async () => { await prisma.$connect(); });
afterAll(async () => { await prisma.$disconnect(); });

beforeEach(async () => {
  const user = await prisma.user.create({
    data: { email: `pay-${crypto.randomUUID()}@meerah.test` },
  });
  userId = user.id;
});

describe('webhook signature', () => {
  it('accepts a correctly signed body', () => {
    const body = Buffer.from(JSON.stringify({ event: 'charge.success' }));
    const signature = createHmac('sha512', SECRET).update(body).digest('hex');

    expect(paystack.verifyWebhookSignature(body, signature)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const body = Buffer.from(JSON.stringify({ event: 'charge.success', amount: 100 }));
    const signature = createHmac('sha512', SECRET).update(body).digest('hex');
    const tampered = Buffer.from(JSON.stringify({ event: 'charge.success', amount: 999999 }));

    expect(paystack.verifyWebhookSignature(tampered, signature)).toBe(false);
  });

  it('rejects a missing or junk signature', () => {
    const body = Buffer.from('{}');
    expect(paystack.verifyWebhookSignature(body, undefined)).toBe(false);
    expect(paystack.verifyWebhookSignature(body, 'not-a-signature')).toBe(false);
  });
});

describe('handleWebhook', () => {
  it('credits the pack on a genuine charge.success', async () => {
    const ref = `mrh_creator_${crypto.randomUUID()}`;
    stage({ reference: ref });

    const result = await payments.handleWebhook(chargeSuccess(ref));

    expect(result.credited).toBe(true);
    expect(await credits.getBalance(userId)).toBe(getCreditPack('creator')!.credits);
  });

  it('credits once when Paystack redelivers the same webhook', async () => {
    const ref = `mrh_creator_${crypto.randomUUID()}`;
    stage({ reference: ref });

    for (let i = 0; i < 4; i++) {
      expect((await payments.handleWebhook(chargeSuccess(ref))).credited).toBe(true);
    }

    // Four deliveries, one pack's worth of credits.
    expect(await credits.getBalance(userId)).toBe(getCreditPack('creator')!.credits);
    expect((await credits.audit(userId)).consistent).toBe(true);
  });

  it('credits once under concurrent redelivery', async () => {
    const ref = `mrh_creator_${crypto.randomUUID()}`;
    stage({ reference: ref });

    await Promise.all(Array.from({ length: 6 }, () => payments.handleWebhook(chargeSuccess(ref))));

    expect(await credits.getBalance(userId)).toBe(getCreditPack('creator')!.credits);
  });

  it('ignores events that are not charge.success', async () => {
    const result = await payments.handleWebhook({ event: 'charge.failed', data: { reference: 'x' } });

    expect(result.credited).toBe(false);
    expect(await credits.getBalance(userId)).toBe(0);
  });

  it('refuses to credit when Paystack says the charge did not succeed', async () => {
    // The fraud case: a real signature, but the payment never actually landed.
    const ref = `mrh_creator_${crypto.randomUUID()}`;
    stage({ reference: ref, status: 'abandoned' });

    const result = await payments.handleWebhook(chargeSuccess(ref));

    expect(result.credited).toBe(false);
    expect(result.reason).toContain('abandoned');
    expect(await credits.getBalance(userId)).toBe(0);
  });

  it('refuses to credit when the amount paid does not match the pack price', async () => {
    // Paying for Starter but claiming the Agency pack.
    const ref = `mrh_agency_${crypto.randomUUID()}`;
    stage({
      reference: ref,
      amountKobo: getCreditPack('starter')!.amountKobo,
      metadata: { userId, packId: 'agency' },
    });

    const result = await payments.handleWebhook(chargeSuccess(ref));

    expect(result.credited).toBe(false);
    expect(result.reason).toBe('amount mismatch');
    expect(await credits.getBalance(userId)).toBe(0);
  });

  it('refuses to credit an unknown pack', async () => {
    const ref = `mrh_ghost_${crypto.randomUUID()}`;
    stage({ reference: ref, metadata: { userId, packId: 'ghost-pack' } });

    const result = await payments.handleWebhook(chargeSuccess(ref));

    expect(result.credited).toBe(false);
    expect(result.reason).toBe('unknown pack');
  });

  it('refuses to credit when metadata is missing', async () => {
    const ref = `mrh_creator_${crypto.randomUUID()}`;
    stage({ reference: ref, metadata: {} });

    const result = await payments.handleWebhook(chargeSuccess(ref));

    expect(result.credited).toBe(false);
    expect(result.reason).toBe('missing metadata');
  });
});

describe('crediting a payment the webhook never delivered', () => {
  it('credits when the browser reports the reference on its way back', async () => {
    const ref = `mrh_creator_${crypto.randomUUID()}`;
    stage({ reference: ref });

    const result = await payments.verifyForUser(userId, ref);

    expect(result.credited).toBe(true);
    expect(result.balance).toBe(getCreditPack('creator')!.credits);
  });

  it('refuses to let one customer claim another customer\'s payment', async () => {
    const ref = `mrh_creator_${crypto.randomUUID()}`;
    // Metadata names a different user than the one asking.
    stage({ reference: ref, metadata: { userId: crypto.randomUUID(), packId: 'creator' } });

    const result = await payments.verifyForUser(userId, ref);

    expect(result.credited).toBe(false);
    expect(result.reason).toBe('not your payment');
    expect(await credits.getBalance(userId)).toBe(0);
  });

  it('credits once when the webhook and the browser both report it', async () => {
    // The realistic race: the webhook lands while the customer is redirecting.
    const ref = `mrh_creator_${crypto.randomUUID()}`;
    stage({ reference: ref });

    await Promise.all([
      payments.handleWebhook(chargeSuccess(ref)),
      payments.verifyForUser(userId, ref),
      payments.creditByReference(ref),
    ]);

    expect(await credits.getBalance(userId)).toBe(getCreditPack('creator')!.credits);
    expect((await credits.audit(userId)).consistent).toBe(true);
  });

  it('still refuses a payment Paystack says did not succeed', async () => {
    const ref = `mrh_creator_${crypto.randomUUID()}`;
    stage({ reference: ref, status: 'abandoned' });

    const result = await payments.verifyForUser(userId, ref);

    expect(result.credited).toBe(false);
    expect(await credits.getBalance(userId)).toBe(0);
  });
});
