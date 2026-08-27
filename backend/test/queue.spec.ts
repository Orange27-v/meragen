import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient, Vendor, GenerationStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { PrismaService } from '../src/common/prisma.service';
import { CreditsService } from '../src/credits/credits.service';
import { PricingService } from '../src/pricing/pricing.service';
import { GenerationsService } from '../src/generations/generations.service';
import { GenerationQueue, GenerationJobData, redisConnection } from '../src/queue/generation.queue';
import { GenerationProcessor } from '../src/queue/generation.processor';
import { GenerationPoller } from '../src/queue/generation.poller';
import { GENERATION_QUEUE, pollDelayMs, MAX_POLL_MS } from '../src/queue/queue.constants';
import { MuApiVendor } from '../src/vendors/muapi.vendor';
import { VendorError, FailureKind, JobStatus, VendorJobHandle } from '../src/vendors/vendor.types';
import { usdToMicros } from '../src/pricing/money';
import { StorageService } from '../src/storage/storage.service';

/** Runs against the real Redis from `npm run db:up`. */
const prisma = new PrismaClient() as PrismaService;
const credits = new CreditsService(prisma);

class TestConfig extends ConfigService {
  values: Record<string, string> = {
    NGN_PER_USD: '1500', MIN_GROSS_MARGIN: '0.20', MUAPI_KEY: 'test',
    REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  };
  override get<T>(key: string, fallback?: T): T { return (this.values[key] ?? fallback) as T; }
}

class FakeVendor extends MuApiVendor {
  /** Number of status checks before the job finishes. */
  pollsUntilDone = 1;
  finalStatus: JobStatus = { state: 'completed', outputUrl: 'https://cdn.example/out.mp4' };
  polls = 0;
  constructor() { super(new TestConfig()); }
  override async submitJob(): Promise<VendorJobHandle> { return { vendorJobId: `v-${crypto.randomUUID()}` }; }
  override async checkStatus(): Promise<JobStatus> {
    this.polls++;
    return this.polls >= this.pollsUntilDone ? this.finalStatus : { state: 'processing' };
  }
}

const config = new TestConfig();
const pricing = new PricingService(prisma, config);
const vendor = new FakeVendor();
const queue = new GenerationQueue(config);
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
const generations = new GenerationsService(prisma, credits, pricing, vendor, queue, storage as unknown as StorageService);
const processor = new GenerationProcessor(generations);
const poller = new GenerationPoller(prisma, generations);

let worker: Worker<GenerationJobData>;
let sweeper: NodeJS.Timeout;
let userId: string;
const DRAFT_PRICE = 6;

async function waitFor(check: () => Promise<boolean>, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Timed out waiting for condition');
}

beforeAll(async () => {
  await prisma.$connect();
  await queue.queue.obliterate({ force: true });
  worker = new Worker<GenerationJobData>(
    GENERATION_QUEUE,
    async (job) => processor.process(job.data),
    { connection: redisConnection(config), concurrency: 5 },
  );
  await worker.waitUntilReady();
  // Mirrors the worker process: a steady sweep chasing unfinished jobs.
  sweeper = setInterval(() => void poller.sweep().catch(() => undefined), 250);
});

afterAll(async () => {
  clearInterval(sweeper);
  await worker.close();
  await queue.queue.obliterate({ force: true });
  await queue.queue.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  vendor.polls = 0;
  vendor.pollsUntilDone = 1;
  vendor.finalStatus = { state: 'completed', outputUrl: 'https://cdn.example/out.mp4' };
  await prisma.modelPrice.upsert({
    where: { vendor_modelId: { vendor: Vendor.muapi, modelId: 'seedance-pro-t2v-fast' } },
    create: {
      vendor: Vendor.muapi, modelId: 'seedance-pro-t2v-fast', category: 'Text to Video',
      costUsdMicros: usdToMicros(0.06), dynamicPricing: true,
    },
    update: { costUsdMicros: usdToMicros(0.06) },
  });
  const user = await prisma.user.create({
    data: { email: `q-${crypto.randomUUID()}@meerah.test` },
  });
  userId = user.id;
  await credits.topup({ userId, credits: 500, paystackRef: `seed-${crypto.randomUUID()}` });
});

describe('backoff schedule', () => {
  it('polls tightly at first, then eases off', () => {
    expect(pollDelayMs(0)).toBe(2_000);
    expect(pollDelayMs(45_000)).toBe(5_000);
    expect(pollDelayMs(5 * 60_000)).toBe(10_000);
  });
});

describe('end to end through a real worker', () => {
  it('returns immediately and finishes the render in the background', async () => {
    const started = Date.now();
    const result = await generations.submit({ userId, tierId: 'draft', feature: 'VidEngine', prompt: 'lagos at dusk' });
    const responseMs = Date.now() - started;

    // The customer is not waiting on a render.
    expect(result.status).toBe(GenerationStatus.processing);
    expect(responseMs).toBeLessThan(2_000);

    await waitFor(async () => {
      const row = await prisma.generation.findUnique({ where: { id: result.generationId } });
      return row?.status === GenerationStatus.completed;
    });

    const done = await prisma.generation.findUniqueOrThrow({ where: { id: result.generationId } });
    // Archived into our own storage, with the key kept so the URL can be
    // re-signed once it expires.
    expect(done.outputUrl).toContain('files.test');
    expect(done.storageKey).toContain('generations/');
    expect(storage.archived).toContain('https://cdn.example/out.mp4');
    expect(await credits.getBalance(userId)).toBe(500 - DRAFT_PRICE);
  });

  it('keeps checking back while the vendor is still rendering', async () => {
    vendor.pollsUntilDone = 3;

    const result = await generations.submit({ userId, tierId: 'draft', feature: 'VidEngine', prompt: 'slow render' });

    await waitFor(async () => {
      const row = await prisma.generation.findUnique({ where: { id: result.generationId } });
      return row?.status === GenerationStatus.completed;
    });

    expect(vendor.polls).toBeGreaterThanOrEqual(3);
  });

  it('refunds automatically when the render fails in the background', async () => {
    vendor.finalStatus = { state: 'failed', error: new VendorError(FailureKind.UNKNOWN, 'gpu died') };

    const result = await generations.submit({ userId, tierId: 'draft', feature: 'VidEngine', prompt: 'doomed' });

    await waitFor(async () => {
      const row = await prisma.generation.findUnique({ where: { id: result.generationId } });
      return row?.status === GenerationStatus.failed;
    });

    expect(await credits.getBalance(userId)).toBe(500);
    expect((await credits.audit(userId)).consistent).toBe(true);
  });

  it('refunds a job the vendor never returns', async () => {
    // Never finishes, so the only thing that can rescue it is the timeout.
    vendor.pollsUntilDone = Number.MAX_SAFE_INTEGER;
    const result = await generations.submit({ userId, tierId: 'draft', feature: 'VidEngine', prompt: 'lost' });

    // Backdate it past the point where we are willing to keep waiting.
    await prisma.generation.update({
      where: { id: result.generationId },
      data: { createdAt: new Date(Date.now() - MAX_POLL_MS - 1_000), lastPolledAt: null },
    });
    await poller.sweep();

    const row = await prisma.generation.findUniqueOrThrow({ where: { id: result.generationId } });
    expect(row.status).toBe(GenerationStatus.failed);
    expect(await credits.getBalance(userId)).toBe(500);
  });
});

describe('MuAPI-compatible result shape', () => {
  it('gives the forked studio exactly the fields it reads', async () => {
    const result = await generations.submit({ userId, tierId: 'draft', feature: 'VidEngine', prompt: 'x' });
    await waitFor(async () => {
      const row = await prisma.generation.findUnique({ where: { id: result.generationId } });
      return row?.status === GenerationStatus.completed;
    });

    const payload = await generations.resultForClient(result.generationId);

    expect(payload.status).toBe('completed');
    expect(payload.outputs[0]).toContain('files.test');
    expect(payload.cost.refunded).toBe(false);
    expect(payload.cost.amount_credits).toBe(DRAFT_PRICE);
  });

  it('reports the refund so the studio can tell the customer', async () => {
    vendor.finalStatus = { state: 'failed', error: new VendorError(FailureKind.POLICY_REJECTED, 'no') };
    const result = await generations.submit({ userId, tierId: 'draft', feature: 'VidEngine', prompt: 'x' });

    await waitFor(async () => {
      const row = await prisma.generation.findUnique({ where: { id: result.generationId } });
      return row?.status === GenerationStatus.failed;
    });

    const payload = await generations.resultForClient(result.generationId);

    expect(payload.status).toBe('failed');
    expect(payload.cost.refunded).toBe(true);
    expect(payload.cost.amount_credits).toBe(DRAFT_PRICE);
    expect(payload.error).toContain('content filter');
  });
});
