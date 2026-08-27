import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient, Vendor, GenerationStatus, ScheduledPostStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/common/prisma.service';
import { CreditsService } from '../src/credits/credits.service';
import { PricingService } from '../src/pricing/pricing.service';
import { GenerationsService } from '../src/generations/generations.service';
import { GenerationQueue } from '../src/queue/generation.queue';
import { StorageService } from '../src/storage/storage.service';
import { MuApiVendor } from '../src/vendors/muapi.vendor';
import { PlannerService, LEAD_TIME_MS } from '../src/planner/planner.service';
import { SubscriptionService, PLANNER_MONTHLY_CREDITS } from '../src/planner/subscription.service';
import { VendorJobHandle } from '../src/vendors/vendor.types';
import { usdToMicros } from '../src/pricing/money';

const prisma = new PrismaClient() as PrismaService;
const credits = new CreditsService(prisma);

class TestConfig extends ConfigService {
  values: Record<string, string> = { NGN_PER_USD: '1500', MIN_GROSS_MARGIN: '0.20', MUAPI_KEY: 'x' };
  override get<T>(k: string, fallback?: T): T { return (this.values[k] ?? fallback) as T; }
}
class FakeVendor extends MuApiVendor {
  fail: Error | null = null;
  constructor() { super(new TestConfig()); }
  override async submitJob(): Promise<VendorJobHandle> {
    if (this.fail) throw this.fail;
    return { vendorJobId: `v-${crypto.randomUUID()}` };
  }
}
class FakeQueue { async enqueue() {} }
class FakeStorage {
  async archiveFromUrl() { return null; }
  async freshUrl(k: string) { return `https://files.test/${k}`; }
}

const vendor = new FakeVendor();
const generations = new GenerationsService(
  prisma, credits, new PricingService(prisma, new TestConfig()), vendor,
  new FakeQueue() as unknown as GenerationQueue, new FakeStorage() as unknown as StorageService,
);
const planner = new PlannerService(prisma, generations);
const subscriptions = new SubscriptionService(prisma, credits);

let userId: string;
const soon = (ms: number) => new Date(Date.now() + ms);

async function fund(amount: number): Promise<string> {
  const user = await prisma.user.create({ data: { email: `plan-${crypto.randomUUID()}@meerahstudio.com` } });
  if (amount > 0) {
    await credits.topup({ userId: user.id, credits: amount, paystackRef: `seed-${crypto.randomUUID()}` });
  }
  return user.id;
}

beforeAll(async () => { await prisma.$connect(); });
afterAll(async () => { await prisma.$disconnect(); });

beforeEach(async () => {
  vendor.fail = null;
  await prisma.modelPrice.upsert({
    where: { vendor_modelId: { vendor: Vendor.muapi, modelId: 'seedance-pro-t2v-fast' } },
    create: {
      vendor: Vendor.muapi, modelId: 'seedance-pro-t2v-fast', category: 'Text to Video',
      costUsdMicros: usdToMicros(0.06), dynamicPricing: true,
    },
    update: { costUsdMicros: usdToMicros(0.06) },
  });
  userId = await fund(500);
});

describe('planning a post', () => {
  it('keeps it on the calendar', async () => {
    const post = await planner.schedule({
      userId, scheduledFor: soon(3 * 3600_000), tierId: 'draft', prompt: 'friday jollof promo',
    });

    expect(post.status).toBe(ScheduledPostStatus.planned);
    expect((await planner.list(userId))).toHaveLength(1);
  });

  it('refuses a slot too close to make it in time', async () => {
    await expect(planner.schedule({
      userId, scheduledFor: soon(60_000), tierId: 'draft', prompt: 'right now',
    })).rejects.toThrow(/at least 5 minutes/);
  });

  it('refuses an empty brief and an unreadable date', async () => {
    await expect(planner.schedule({ userId, scheduledFor: soon(3600_000), tierId: 'draft', prompt: '  ' }))
      .rejects.toThrow(/what the post should show/);
    await expect(planner.schedule({ userId, scheduledFor: new Date('nonsense'), tierId: 'draft', prompt: 'x' }))
      .rejects.toThrow(/could not be read/);
  });
});

describe('making posts when they are due', () => {
  it('starts one that is inside the lead time, and leaves the rest alone', async () => {
    const dueSoon = await planner.schedule({
      userId, scheduledFor: soon(LEAD_TIME_MS - 60_000), tierId: 'draft', prompt: 'due soon',
    });
    await planner.schedule({
      userId, scheduledFor: soon(5 * 24 * 3600_000), tierId: 'draft', prompt: 'next week',
    });

    const result = await planner.runDue();

    expect(result.started).toBe(1);
    const posts = await planner.list(userId);
    expect(posts.find((p) => p.id === dueSoon.id)?.status).toBe(ScheduledPostStatus.generating);
    expect(posts.find((p) => p.prompt === 'next week')?.status).toBe(ScheduledPostStatus.planned);
  });

  it('charges once even if two workers run at the same moment', async () => {
    // Both workers see the same due post; only one may charge for it.
    await planner.schedule({ userId, scheduledFor: soon(60_000 * 5), tierId: 'draft', prompt: 'race' });
    const before = await credits.getBalance(userId);

    const [a, b] = await Promise.all([planner.runDue(), planner.runDue()]);

    expect(a.started + b.started).toBe(1);
    expect(await credits.getBalance(userId)).toBe(before - 6); // one draft, 6 credits
    expect((await credits.audit(userId)).consistent).toBe(true);
  });

  it('explains itself when there are not enough credits', async () => {
    userId = await fund(2);
    await planner.schedule({ userId, scheduledFor: soon(60_000 * 5), tierId: 'draft', prompt: 'too poor' });

    const result = await planner.runDue();

    expect(result.failed).toBe(1);
    const [post] = await planner.list(userId);
    expect(post.status).toBe(ScheduledPostStatus.failed);
    expect(post.errorMessage).toContain('Top up');
    expect(await credits.getBalance(userId)).toBe(2);
  });

  it('marks a post ready once its render finishes', async () => {
    await planner.schedule({ userId, scheduledFor: soon(60_000 * 5), tierId: 'draft', prompt: 'finishes' });
    await planner.runDue();

    const [post] = await planner.list(userId);
    await prisma.generation.updateMany({
      where: { id: (await prisma.scheduledPost.findUniqueOrThrow({ where: { id: post.id } })).generationId! },
      data: { status: GenerationStatus.completed, outputUrl: 'https://files.test/out.mp4' },
    });

    // settleGenerating sweeps everyone, as the worker does — so assert on this
    // post rather than a global count.
    const settled = await planner.settleGenerating();

    expect(settled.ready).toBeGreaterThanOrEqual(1);
    const [ready] = await planner.list(userId);
    expect(ready.status).toBe(ScheduledPostStatus.ready);
    expect(ready.outputUrl).toBe('https://files.test/out.mp4');
  });
});

describe('the monthly add-on', () => {
  it('charges the first month on the way in', async () => {
    const before = await credits.getBalance(userId);

    const plan = await subscriptions.start(userId);

    expect(plan.active).toBe(true);
    expect(plan.monthlyNaira).toBe(PLANNER_MONTHLY_CREDITS * 50);
    expect(await credits.getBalance(userId)).toBe(before - PLANNER_MONTHLY_CREDITS);
  });

  it('refuses to start when the balance cannot cover it', async () => {
    userId = await fund(10);
    await expect(subscriptions.start(userId)).rejects.toThrow(/Top up/);
    expect(await subscriptions.isActive(userId)).toBe(false);
  });

  it('stops immediately, with no notice period', async () => {
    await subscriptions.start(userId);
    await subscriptions.stop(userId);

    expect(await subscriptions.isActive(userId)).toBe(false);
  });

  it('renews when the month is up, once', async () => {
    await subscriptions.start(userId);
    // Backdate the renewal to the same calendar day as the sign-up charge: the
    // renewal must still be taken, not mistaken for a repeat of the start.
    await prisma.subscription.update({
      where: { userId }, data: { renewsAt: new Date(Date.now() - 1000) },
    });
    const before = await credits.getBalance(userId);

    // Two runs covering the same period must charge once.
    await subscriptions.renewDue();
    await subscriptions.renewDue();

    expect(await credits.getBalance(userId)).toBe(before - PLANNER_MONTHLY_CREDITS);
    expect((await subscriptions.get(userId)).renewsAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it('pauses instead of overdrawing when renewal cannot be paid', async () => {
    await subscriptions.start(userId);
    // Spend everything, then let the renewal come due.
    await credits.charge({ userId, credits: await credits.getBalance(userId) });
    await prisma.subscription.update({
      where: { userId }, data: { renewsAt: new Date(Date.now() - 1000) },
    });

    const result = await subscriptions.renewDue();

    expect(result.paused).toBe(1);
    const plan = await subscriptions.get(userId);
    expect(plan.active).toBe(false);
    expect(plan.note).toContain('Top up');
    expect(await credits.getBalance(userId)).toBe(0);
    expect((await credits.audit(userId)).consistent).toBe(true);
  });
});

describe('publishing is manual in v1', () => {
  it('always plans a post as manual', async () => {
    await subscriptions.start(userId);
    const post = await planner.schedule({
      userId, scheduledFor: soon(3600_000), tierId: 'draft', prompt: 'manual only',
    });

    expect(post.platform).toBe('manual');
  });
});
