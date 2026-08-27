import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient, CreditTransactionType, Vendor } from '@prisma/client';
import { CreditsService } from '../src/credits/credits.service';
import { PrismaService } from '../src/common/prisma.service';
import { InsufficientCreditsError, AlreadyRefundedError } from '../src/credits/credits.errors';

/**
 * These tests run against a real Postgres, not a mock — the behaviour under
 * test IS the database's row locking. `npm run db:up` first.
 */
const prisma = new PrismaClient() as PrismaService;
const credits = new CreditsService(prisma);

let userId: string;

async function makeUser(startingCredits = 0): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: `test-${crypto.randomUUID()}@meerah.test`,
      creditBalance: 0,
    },
  });
  if (startingCredits > 0) {
    await credits.topup({
      userId: user.id,
      credits: startingCredits,
      paystackRef: `seed-${crypto.randomUUID()}`,
    });
  }
  return user.id;
}

async function makeGeneration(ownerId: string, costCredits: number): Promise<string> {
  const generation = await prisma.generation.create({
    data: {
      userId: ownerId,
      feature: 'VidEngine',
      vendor: Vendor.muapi,
      modelId: 'seedance-pro-t2v-fast',
      inputParams: { prompt: 'a lagos street market at golden hour' },
      costCredits,
    },
  });
  return generation.id;
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  userId = await makeUser(0);
});

describe('topup', () => {
  it('credits the account and records the ledger entry', async () => {
    const { entry, created } = await credits.topup({ userId, credits: 500, paystackRef: `ref-${crypto.randomUUID()}` });

    expect(created).toBe(true);
    expect(entry.type).toBe(CreditTransactionType.topup);
    expect(entry.amount).toBe(500);
    expect(entry.balanceAfter).toBe(500);
    expect(await credits.getBalance(userId)).toBe(500);
  });

  it('ignores a replayed Paystack webhook instead of double-crediting', async () => {
    const ref = `ref-${crypto.randomUUID()}`;

    const first = await credits.topup({ userId, credits: 1000, paystackRef: ref });
    expect(first.created).toBe(true);

    const replays = await Promise.all(
      Array.from({ length: 5 }, () => credits.topup({ userId, credits: 1000, paystackRef: ref })),
    );

    for (const replay of replays) {
      expect(replay.entry.id).toBe(first.entry.id);
      expect(replay.created).toBe(false);
    }
    expect(await credits.getBalance(userId)).toBe(1000);
    expect((await credits.audit(userId)).consistent).toBe(true);
  });

  it('survives concurrent distinct topups without losing any', async () => {
    await Promise.all(
      Array.from({ length: 20 }, () =>
        credits.topup({ userId, credits: 50, paystackRef: `ref-${crypto.randomUUID()}` }),
      ),
    );

    expect(await credits.getBalance(userId)).toBe(1000);
    expect((await credits.audit(userId)).consistent).toBe(true);
  });
});

describe('charge', () => {
  it('deducts credits and never lets the balance go negative', async () => {
    userId = await makeUser(100);

    await credits.charge({ userId, credits: 100 });
    expect(await credits.getBalance(userId)).toBe(0);

    await expect(credits.charge({ userId, credits: 1 })).rejects.toBeInstanceOf(InsufficientCreditsError);
  });

  it('lets exactly N concurrent charges succeed when the balance funds exactly N', async () => {
    // The core race: 10 requests at 100 credits each against a 900 balance.
    // Without FOR UPDATE, several read 900 simultaneously and all 10 succeed,
    // overdrawing the account. Exactly 9 must win.
    userId = await makeUser(900);

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => credits.charge({ userId, credits: 100 })),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    expect(succeeded).toHaveLength(9);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientCreditsError);

    expect(await credits.getBalance(userId)).toBe(0);
    expect((await credits.audit(userId)).consistent).toBe(true);
  });

  it('keeps balance_after consistent across interleaved charges', async () => {
    userId = await makeUser(1000);

    await Promise.all(Array.from({ length: 10 }, () => credits.charge({ userId, credits: 10 })));

    const entries = await prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { balanceAfter: 'desc' },
      select: { balanceAfter: true },
    });

    // Every charge must have left a distinct balance behind it; a duplicate
    // means two writers saw the same starting balance.
    const seen = new Set(entries.map((e) => e.balanceAfter));
    expect(seen.size).toBe(entries.length);
    expect((await credits.audit(userId)).consistent).toBe(true);
  });

  it('rejects a non-positive charge outright', async () => {
    await expect(credits.charge({ userId, credits: 0 })).rejects.toThrow(/positive/);
    await expect(credits.charge({ userId, credits: -5 })).rejects.toThrow(/positive/);
  });
});

describe('refundGeneration', () => {
  it('returns the credits and marks the generation refunded', async () => {
    userId = await makeUser(300);
    const generationId = await makeGeneration(userId, 300);
    await credits.charge({ userId, credits: 300, generationId });
    expect(await credits.getBalance(userId)).toBe(0);

    const refund = await credits.refundGeneration(generationId);

    expect(refund?.type).toBe(CreditTransactionType.refund);
    expect(refund?.amount).toBe(300);
    expect(await credits.getBalance(userId)).toBe(300);
  });

  it('refunds exactly once under concurrent retries', async () => {
    // A worker retry, a webhook replay and a manual re-run can all fire at once.
    userId = await makeUser(300);
    const generationId = await makeGeneration(userId, 300);
    await credits.charge({ userId, credits: 300, generationId });

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => credits.refundGeneration(generationId)),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    expect(succeeded).toHaveLength(1);
    for (const r of results.filter((x) => x.status === 'rejected')) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(AlreadyRefundedError);
    }

    expect(await credits.getBalance(userId)).toBe(300);
    expect((await credits.audit(userId)).consistent).toBe(true);
  });
});

describe('audit', () => {
  it('detects drift between the ledger and the cached balance', async () => {
    userId = await makeUser(500);
    expect((await credits.audit(userId)).consistent).toBe(true);

    // Simulate the bug we are defending against: something writes the cache
    // without writing the ledger.
    await prisma.user.update({ where: { id: userId }, data: { creditBalance: 999 } });

    const drifted = await credits.audit(userId);
    expect(drifted.consistent).toBe(false);
    expect(drifted.ledgerSum).toBe(500);
    expect(drifted.cachedBalance).toBe(999);
  });
});

describe('idempotent charges', () => {
  it('charges once when the same key is used twice', async () => {
    // A retried worker, a double-fired scheduler and a resubmitted request all
    // land here. Charging twice for one thing is the worst bug this can have.
    userId = await makeUser(1000);
    const key = `job:${crypto.randomUUID()}`;

    const first = await credits.charge({ userId, credits: 100, idempotencyKey: key });
    const second = await credits.charge({ userId, credits: 100, idempotencyKey: key });

    expect(second.id).toBe(first.id);
    expect(await credits.getBalance(userId)).toBe(900);
    expect((await credits.audit(userId)).consistent).toBe(true);
  });

  it('charges once under concurrent retries of the same key', async () => {
    userId = await makeUser(1000);
    const key = `job:${crypto.randomUUID()}`;

    const results = await Promise.all(
      Array.from({ length: 5 }, () => credits.charge({ userId, credits: 100, idempotencyKey: key })),
    );

    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(await credits.getBalance(userId)).toBe(900);
  });

  it('still charges separately for different keys', async () => {
    userId = await makeUser(1000);

    await credits.charge({ userId, credits: 100, idempotencyKey: `a:${crypto.randomUUID()}` });
    await credits.charge({ userId, credits: 100, idempotencyKey: `b:${crypto.randomUUID()}` });

    expect(await credits.getBalance(userId)).toBe(800);
  });
});
