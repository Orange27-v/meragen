import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient, Vendor, GenerationStatus, CreditTransactionType } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/common/prisma.service';
import { MetricsService } from '../src/metrics/metrics.service';

const prisma = new PrismaClient() as PrismaService;

class TestConfig extends ConfigService {
  values: Record<string, string> = { NGN_PER_USD: '1500', ADMIN_EMAILS: 'owner@meerahstudio.com, second@meerahstudio.com' };
  override get<T>(k: string, fallback?: T): T { return (this.values[k] ?? fallback) as T; }
}
const config = new TestConfig();
const metrics = new MetricsService(prisma, config);

async function wipe() {
  await prisma.creditTransaction.deleteMany();
  await prisma.scheduledPost.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.brandAsset.deleteMany();
  await prisma.generation.deleteMany();
  await prisma.session.deleteMany();
  await prisma.appInterest.deleteMany();
  await prisma.user.deleteMany();
}

async function payingUser(topupCredits: number): Promise<string> {
  const user = await prisma.user.create({
    data: { email: `m-${crypto.randomUUID()}@meerahstudio.com`, creditBalance: topupCredits },
  });
  await prisma.creditTransaction.create({
    data: {
      userId: user.id, type: CreditTransactionType.topup, amount: topupCredits,
      balanceAfter: topupCredits, paystackRef: `ref-${crypto.randomUUID()}`,
    },
  });
  return user.id;
}

beforeAll(async () => { await prisma.$connect(); });
afterAll(async () => { await wipe(); await prisma.$disconnect(); });
beforeEach(async () => { await wipe(); });

describe('who can see the numbers', () => {
  it('allows only the configured emails, case-insensitively', () => {
    expect(metrics.isAdminEmail('owner@meerahstudio.com')).toBe(true);
    expect(metrics.isAdminEmail('  OWNER@MeerahStudio.com ')).toBe(true);
    expect(metrics.isAdminEmail('second@meerahstudio.com')).toBe(true);
    expect(metrics.isAdminEmail('customer@gmail.com')).toBe(false);
  });

  it('allows nobody when unset', () => {
    config.values.ADMIN_EMAILS = '';
    expect(metrics.isAdminEmail('owner@meerahstudio.com')).toBe(false);
    config.values.ADMIN_EMAILS = 'owner@meerahstudio.com, second@meerahstudio.com';
  });
});

describe('the numbers the model rests on', () => {
  it('measures signup-to-paid conversion', async () => {
    await payingUser(100);
    await payingUser(100);
    await prisma.user.create({ data: { email: `m-${crypto.randomUUID()}@meerahstudio.com` } });
    await prisma.user.create({ data: { email: `m-${crypto.randomUUID()}@meerahstudio.com` } });

    const result = await metrics.collect();

    expect(result.people.signups).toBe(4);
    expect(result.people.paying).toBe(2);
    expect(result.people.conversionPercent).toBe(50);
  });

  it('counts someone who paid once and never returned as churned', async () => {
    // The plan's stated key risk: retention. This is how it gets measured.
    const returning = await payingUser(100);
    await prisma.creditTransaction.create({
      data: {
        userId: returning, type: CreditTransactionType.topup, amount: 100,
        balanceAfter: 200, paystackRef: `ref-${crypto.randomUUID()}`,
      },
    });
    await payingUser(100);

    const result = await metrics.collect();

    expect(result.people.returning).toBe(1);
    expect(result.people.churnedPercent).toBe(50);
  });

  it('takes Paystack’s cut off the gross, per payment', async () => {
    // ₦5,000 -> ₦175 fee. Two of them is ₦350, not the ₦250 you would get by
    // applying the fee to the ₦10,000 total.
    await payingUser(100);
    await payingUser(100);

    const result = await metrics.collect();

    expect(result.money.grossNaira).toBe(10_000);
    expect(result.money.paystackFeesNaira).toBe(350);
    expect(result.money.netNaira).toBe(9_650);
  });

  it('treats unspent credits as a liability, not revenue', async () => {
    await payingUser(100);

    const result = await metrics.collect();

    // Sold but unspent: money owed in service.
    expect(result.money.creditsOutstanding).toBe(100);
    expect(result.money.liabilityNaira).toBe(5_000);
    // Nothing spent yet, so no margin has been realised.
    expect(result.money.realisedMarginPercent).toBe(0);
  });

  it('measures margin on credits actually spent', async () => {
    const userId = await payingUser(100);
    await prisma.creditTransaction.create({
      data: { userId, type: CreditTransactionType.generation_charge, amount: -20, balanceAfter: 80 },
    });
    await prisma.generation.create({
      data: {
        userId, feature: 'VidEngine', vendor: Vendor.muapi, modelId: 'seedance-pro-t2v-fast',
        status: GenerationStatus.completed, inputParams: {}, costCredits: 20,
        vendorCostUsdCents: 20, // $0.20 -> ₦300 at 1500
      },
    });

    const result = await metrics.collect();

    // 20 credits = ₦1,000 spent, ₦300 vendor cost -> 70%.
    expect(result.money.vendorCostNaira).toBe(300);
    expect(result.money.realisedMarginPercent).toBe(70);
  });

  it('tracks failures and refunds', async () => {
    const userId = await payingUser(100);
    for (const status of [GenerationStatus.completed, GenerationStatus.failed, GenerationStatus.failed]) {
      await prisma.generation.create({
        data: {
          userId, feature: 'VidEngine', vendor: Vendor.muapi, modelId: 'x',
          status, inputParams: {}, costCredits: 6,
        },
      });
    }
    await prisma.creditTransaction.create({
      data: { userId, type: CreditTransactionType.refund, amount: 12, balanceAfter: 100 },
    });

    const result = await metrics.collect();

    expect(result.work.generations).toBe(3);
    expect(result.work.failureRatePercent).toBeCloseTo(66.7, 0);
    expect(result.work.refundedNaira).toBe(600);
  });

  it('reports the stickiness signals', async () => {
    const userId = await payingUser(100);
    await prisma.brandAsset.createMany({
      data: [
        { userId, type: 'character', name: 'Ada' },
        { userId, type: 'template', name: 'Brand kit' },
      ],
    });

    const result = await metrics.collect();

    expect(result.stickiness.savedAssets).toBe(2);
    expect(result.stickiness.usersWithSavedAssets).toBe(1);
  });

  it('returns a full daily series, including days with nothing', async () => {
    await payingUser(100);

    const daily = await metrics.daily(7);

    expect(daily).toHaveLength(8); // 7 days back, inclusive of today
    expect(daily[daily.length - 1].naira).toBe(5_000);
    expect(daily.every((d) => typeof d.signups === 'number')).toBe(true);
  });

  it('reports zeroes rather than dividing by zero on an empty platform', async () => {
    const result = await metrics.collect();

    expect(result.people.conversionPercent).toBe(0);
    expect(result.work.failureRatePercent).toBe(0);
    expect(result.money.realisedMarginPercent).toBe(0);
  });
});
