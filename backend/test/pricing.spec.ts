import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient, Vendor } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/common/prisma.service';
import { PricingService } from '../src/pricing/pricing.service';
import { CatalogService } from '../src/pricing/catalog.service';
import { MuApiCatalogClient, CatalogEntry } from '../src/vendors/muapi.catalog';
import { MarginFloorBreachError, UnpricedModelError } from '../src/pricing/pricing.errors';
import { VIDEO_TIERS, getTier } from '../src/pricing/tiers';
import { usdToMicros, usdMicrosToKobo, grossMargin, roundUpToStep, retailForMargin } from '../src/pricing/money';
import { paystackFeeKobo, netAfterPaystackKobo } from '../src/pricing/infrastructure';
import { creditsFromKobo } from '../src/pricing/money';

const prisma = new PrismaClient() as PrismaService;

/** Config we can move, so FX and the floor are testable inputs. */
class TestConfig extends ConfigService {
  values: Record<string, string> = { NGN_PER_USD: '1500', MIN_GROSS_MARGIN: '0.20' };
  override get<T>(key: string, fallback?: T): T {
    return (this.values[key] ?? fallback) as T;
  }
}

class StubCatalog extends MuApiCatalogClient {
  staged: CatalogEntry[] = [];
  constructor() { super(new TestConfig()); }
  override async fetchCatalog(): Promise<CatalogEntry[]> { return this.staged; }
}

const config = new TestConfig();
const pricing = new PricingService(prisma, config);
const stub = new StubCatalog();
const catalog = new CatalogService(prisma, stub, pricing);

async function setPrice(modelId: string, usd: number, dynamic = true): Promise<void> {
  await prisma.modelPrice.upsert({
    where: { vendor_modelId: { vendor: Vendor.muapi, modelId } },
    create: { vendor: Vendor.muapi, modelId, category: 'Text to Video', costUsdMicros: usdToMicros(usd), dynamicPricing: dynamic },
    update: { costUsdMicros: usdToMicros(usd) },
  });
}

beforeAll(async () => { await prisma.$connect(); });
afterAll(async () => { await prisma.$disconnect(); });

beforeEach(async () => {
  config.values = { NGN_PER_USD: '1500', MIN_GROSS_MARGIN: '0.20' };
  await prisma.priceChange.deleteMany();
  await prisma.modelPrice.deleteMany();
});

describe('credits stay whole', () => {
  it('never produces a fractional credit', async () => {
    // Every tier price must land on the ₦50 grid, or it cannot be sold.
    for (const tier of VIDEO_TIERS) await setPrice(tier.modelId, 0.37);

    for (const tier of VIDEO_TIERS) {
      const quote = await pricing.quote(tier.id);
      expect(Number.isInteger(quote.credits)).toBe(true);
      expect(quote.naira % 50).toBe(0);
      expect(quote.credits * 50).toBe(quote.naira);
    }
  });

  it('refuses to price something off the grid', () => {
    expect(() => creditsFromKobo(120_00)).toThrow(/whole number of credits/);
    expect(creditsFromKobo(300_00)).toBe(6);
  });
});

describe('money helpers', () => {
  it('keeps everything in integer space', () => {
    expect(usdToMicros(0.06)).toBe(60_000);
    expect(usdToMicros(8.5)).toBe(8_500_000);
    // $0.06 at ₦1500/$ = ₦90 = 9000 kobo
    expect(usdMicrosToKobo(60_000, 1500)).toBe(9_000);
    expect(usdMicrosToKobo(8_500_000, 1500)).toBe(1_275_000);
  });

  it('rounds retail up, never down, so rounding cannot cost margin', () => {
    // ₦123.45 -> nearest ₦50 step upward = ₦150
    expect(roundUpToStep(12_345, 50)).toBe(15_000);
    // Already on a step: stays put.
    expect(roundUpToStep(15_000, 50)).toBe(15_000);
  });

  it('computes retail that hits the target margin', () => {
    // cost ₦600, target 50% -> retail ₦1200
    const retail = retailForMargin(60_000, 0.5);
    expect(retail).toBe(120_000);
    expect(grossMargin(retail, 60_000)).toBeCloseTo(0.5, 6);
  });
});

describe('quote', () => {
  it('derives the price from the real vendor cost', async () => {
    await setPrice('seedance-pro-t2v-fast', 0.06);

    const quote = await pricing.quote('draft');

    // $0.06 x 1500 = ₦90 vendor + storage; 65% target -> rounds up to ₦300,
    // which at ₦50 a credit is 6 credits.
    expect(quote.breakdown.vendorCostNaira).toBe(90);
    expect(quote.naira).toBe(300);
    expect(quote.credits).toBe(6);
    expect(quote.breakdown.nairaPerCredit).toBe(50);
    expect(quote.breakdown.realisedMargin).toBeGreaterThanOrEqual(0.65);
  });

  it('never quotes below the target margin after rounding', async () => {
    for (const tier of VIDEO_TIERS) await setPrice(tier.modelId, 0.4);

    for (const tier of VIDEO_TIERS) {
      const quote = await pricing.quote(tier.id);
      expect(quote.breakdown.realisedMargin).toBeGreaterThanOrEqual(tier.targetMargin);
    }
  });

  it('refuses a tier with no synced price rather than guessing', async () => {
    await expect(pricing.quote('draft')).rejects.toBeInstanceOf(UnpricedModelError);
  });

  it('re-prices when the naira weakens, holding the margin', async () => {
    await setPrice('seedance-2.5-text-to-video-4k', 8.5);

    const at1500 = await pricing.quote('studio');
    config.values.NGN_PER_USD = '1750';
    const at1750 = await pricing.quote('studio');

    // Cost in naira rose, so the price rose with it — the margin did not absorb it.
    expect(at1750.naira).toBeGreaterThan(at1500.naira);
    expect(at1750.breakdown.realisedMargin).toBeGreaterThanOrEqual(getTier('studio')!.targetMargin);
  });
});

describe('margin floor', () => {
  it('blocks a sale that would breach the floor', async () => {
    await setPrice('seedance-pro-t2v-fast', 0.06);
    // Demand more margin than the tier is configured to earn.
    config.values.MIN_GROSS_MARGIN = '0.95';

    await expect(pricing.quote('draft')).rejects.toBeInstanceOf(MarginFloorBreachError);
  });

  it('omits breaching tiers from the price list instead of selling at a loss', async () => {
    await setPrice('seedance-pro-t2v-fast', 0.06);
    await setPrice('seedance-2.1-text-to-video', 0.4);
    config.values.MIN_GROSS_MARGIN = '0.6';

    const { sellable, blocked } = await pricing.quoteAll();

    // draft targets 65% so it survives; standard targets 50% so it cannot.
    expect(sellable.map((q) => q.tierId)).toContain('draft');
    expect(blocked.map((b) => b.tierId)).toContain('standard');
  });
});

describe('catalogue sync', () => {
  it('adds models on first sync', async () => {
    stub.staged = [
      { modelId: 'seedance-pro-t2v-fast', category: 'Text to Video', costUsdMicros: usdToMicros(0.06), dynamicPricing: true },
      { modelId: 'some-other-model', category: 'Text to Image', costUsdMicros: usdToMicros(0.02), dynamicPricing: false },
    ];

    const report = await catalog.sync();

    expect(report.added).toBe(2);
    expect(report.changed).toBe(0);
    expect(report.breaches).toHaveLength(0);
  });

  it('records a price move and leaves an audit trail', async () => {
    await setPrice('seedance-pro-t2v-fast', 0.06);
    stub.staged = [
      { modelId: 'seedance-pro-t2v-fast', category: 'Text to Video', costUsdMicros: usdToMicros(0.09), dynamicPricing: true },
    ];

    const report = await catalog.sync();

    expect(report.changed).toBe(1);
    const changes = await prisma.priceChange.findMany();
    expect(changes).toHaveLength(1);
    expect(changes[0].previousUsdMicros).toBe(usdToMicros(0.06));
    expect(changes[0].newUsdMicros).toBe(usdToMicros(0.09));
  });

  it('flags a vendor price rise that breaks a tier we sell', async () => {
    // This is the scenario the whole job exists for: a silent vendor rise that
    // would otherwise keep selling at a collapsing margin.
    await setPrice('seedance-2.5-text-to-video-4k', 8.5);
    config.values.MIN_GROSS_MARGIN = '0.25';

    // Vendor triples the price. Target margin 30%, so retail would have to move
    // a lot — at the old retail this is deep under the floor.
    stub.staged = [
      { modelId: 'seedance-2.5-text-to-video-4k', category: 'Text to Video', costUsdMicros: usdToMicros(25.5), dynamicPricing: true },
    ];
    config.values.MIN_GROSS_MARGIN = '0.35'; // floor now above the tier's 30% target

    const report = await catalog.sync();

    expect(report.changed).toBe(1);
    expect(report.breaches).toHaveLength(1);
    expect(report.breaches[0].tierId).toBe('studio');
    expect(report.breaches[0].to).toBe(25.5);

    const changes = await prisma.priceChange.findMany();
    expect(changes[0].breachedFloor).toBe(true);
  });

  it('ignores price moves on models no tier is pinned to', async () => {
    await setPrice('some-unused-model', 1.0);
    stub.staged = [
      { modelId: 'some-unused-model', category: 'Text to Image', costUsdMicros: usdToMicros(50), dynamicPricing: true },
    ];

    const report = await catalog.sync();

    expect(report.changed).toBe(1);
    expect(report.breaches).toHaveLength(0);
  });
});

describe('catalogue-wide pricing', () => {
  it('prices a model that is not a curated tier', async () => {
    await setPrice('some-random-video-model', 0.25);

    const quote = await pricing.quoteModel('some-random-video-model');

    // $0.25 x 1500 = ₦375 vendor, plus storage for the retention window.
    // 50% band for a $0.10–0.50 model, rounded up to the next ₦50.
    expect(quote.breakdown.vendorCostNaira).toBe(375);
    expect(quote.breakdown.infraCostNaira).toBeGreaterThan(0);
    expect(quote.naira).toBe(800);
    expect(quote.credits).toBe(16);
    expect(quote.breakdown.realisedMargin).toBeGreaterThanOrEqual(0.5);
  });

  it('thins the margin as the model gets expensive', async () => {
    await setPrice('cheap-model', 0.05);
    await setPrice('dear-model', 8.0);

    const cheap = await pricing.quoteModel('cheap-model');
    const dear = await pricing.quoteModel('dear-model');

    // A 65% markup on an $8 render prices it out of this market entirely.
    expect(cheap.breakdown.targetMargin).toBeGreaterThan(dear.breakdown.targetMargin);
    expect(dear.breakdown.realisedMargin).toBeGreaterThanOrEqual(0.3);
  });

  it('prefers the curated margin when the model is a pinned tier', async () => {
    await setPrice('seedance-pro-t2v-fast', 0.06);

    const viaTier = await pricing.quote('draft');
    const viaModel = await pricing.quoteModel('seedance-pro-t2v-fast');

    // Same model, same price — a tier is just a hand-chosen margin.
    expect(viaModel.naira).toBe(viaTier.naira);
    expect(viaModel.tierId).toBe('draft');
  });

  it('refuses a model that is not in the catalogue', async () => {
    await expect(pricing.quoteModel('model-we-never-synced')).rejects.toBeInstanceOf(UnpricedModelError);
  });

  it('still enforces the floor on catalogue models', async () => {
    await setPrice('some-random-video-model', 0.25);
    config.values.MIN_GROSS_MARGIN = '0.9';

    await expect(pricing.quoteModel('some-random-video-model')).rejects.toBeInstanceOf(MarginFloorBreachError);
  });
});

describe('infrastructure cost', () => {
  it('counts storage and operations, not just the vendor fee', async () => {
    await setPrice('seedance-pro-t2v-fast', 0.06);

    const quote = await pricing.quote('draft');

    // Small, but present — and the margin is computed on the total, not on the
    // vendor fee alone.
    expect(quote.breakdown.infraCostNaira).toBeGreaterThan(0);
    expect(quote.breakdown.totalCostNaira).toBeGreaterThan(quote.breakdown.vendorCostNaira);
    expect(quote.breakdown.totalCostNaira).toBeCloseTo(
      quote.breakdown.vendorCostNaira + quote.breakdown.infraCostNaira, 2,
    );
  });

  it('charges more storage for bigger output', async () => {
    for (const tier of VIDEO_TIERS) await setPrice(tier.modelId, 0.5);

    const draft = await pricing.quote('draft');   // 480p
    const studio = await pricing.quote('studio'); // 4K

    expect(studio.breakdown.outputMb).toBeGreaterThan(draft.breakdown.outputMb);
    expect(studio.breakdown.infraCostNaira).toBeGreaterThan(draft.breakdown.infraCostNaira);
  });

  it('still clears the target margin once storage is included', async () => {
    for (const tier of VIDEO_TIERS) await setPrice(tier.modelId, 0.4);

    for (const tier of VIDEO_TIERS) {
      const quote = await pricing.quote(tier.id);
      expect(quote.breakdown.realisedMargin).toBeGreaterThanOrEqual(tier.targetMargin);
    }
  });
});

describe('what Paystack keeps', () => {
  it('waives the flat fee below the threshold', () => {
    // ₦2,000 -> 1.5% only, no ₦100.
    expect(paystackFeeKobo(2_000_00)).toBe(30_00);
  });

  it('adds the flat fee at and above the threshold', () => {
    // ₦5,000 -> ₦75 + ₦100.
    expect(paystackFeeKobo(5_000_00)).toBe(175_00);
  });

  it('never charges more than the cap', () => {
    // A very large payment is capped at ₦2,000, not 1.5% of it.
    expect(paystackFeeKobo(10_000_000_00)).toBe(2_000_00);
  });

  it('reports what actually reaches the business account', () => {
    expect(netAfterPaystackKobo(5_000_00)).toBe(4_825_00);
  });
});
