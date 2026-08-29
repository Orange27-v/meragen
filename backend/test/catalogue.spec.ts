import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { PricingService } from '../src/pricing/pricing.service';
import { NAIRA_PER_CREDIT } from '../src/pricing/money';

/**
 * The Advanced picker lists whatever this returns, so two things matter more
 * than the shape of the response: nothing unsellable appears in it, and one
 * request does not turn into six hundred database round trips.
 */

function serviceWith(rows: Array<{ modelId: string; category: string; costUsdMicros: number }>) {
  const findMany = vi.fn().mockResolvedValue(rows);
  const prisma = { modelPrice: { findMany, findUnique: vi.fn() } } as never;
  const config = new ConfigService({
    NGN_PER_USD: '1600',
    MIN_GROSS_MARGIN: '0.20',
  });
  return { service: new PricingService(prisma, config), findMany, findUnique: (prisma as never as { modelPrice: { findUnique: ReturnType<typeof vi.fn> } }).modelPrice.findUnique };
}

describe('the model catalogue', () => {
  let rows: Array<{ modelId: string; category: string; costUsdMicros: number }>;

  beforeEach(() => {
    rows = [
      { modelId: 'cheap-image', category: 'Text to Image', costUsdMicros: 30_000 },
      { modelId: 'dear-video', category: 'Text to Video', costUsdMicros: 900_000 },
      { modelId: 'other-video', category: 'Text to Video', costUsdMicros: 420_000 },
    ];
  });

  it('reads the price table once, however many models there are', async () => {
    const { service, findMany, findUnique } = serviceWith(rows);
    await service.listModels();

    expect(findMany).toHaveBeenCalledTimes(1);
    // The per-model lookup must never fire: the cost is already in hand, and a
    // query per model would make opening the picker a hundred round trips.
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('groups by what a model makes, biggest group first', async () => {
    const { service } = serviceWith(rows);
    const { groups, total } = await service.listModels();

    expect(total).toBe(3);
    expect(groups[0].category).toBe('Text to Video');
    expect(groups[0].models).toHaveLength(2);
    expect(groups[1].category).toBe('Text to Image');
  });

  it('quotes every model in whole credits', async () => {
    const { service } = serviceWith(rows);
    const { groups } = await service.listModels();

    for (const group of groups) {
      for (const model of group.models) {
        expect(Number.isInteger(model.credits)).toBe(true);
        expect(model.credits).toBeGreaterThan(0);
        expect(model.naira).toBe(model.credits * NAIRA_PER_CREDIT);
      }
    }
  });

  it('costs more to run a dearer model', async () => {
    const { service } = serviceWith(rows);
    const { groups } = await service.listModels();
    const video = groups.find((g) => g.category === 'Text to Video')!;
    const dear = video.models.find((m) => m.modelId === 'dear-video')!;
    const other = video.models.find((m) => m.modelId === 'other-video')!;

    expect(dear.naira).toBeGreaterThan(other.naira);
  });

  it('drops a model it cannot sell rather than listing it at a loss', async () => {
    // A floor of 99% cannot be met by anything, so the list must come back
    // empty instead of offering prices we would not honour.
    const findMany = vi.fn().mockResolvedValue(rows);
    const prisma = { modelPrice: { findMany, findUnique: vi.fn() } } as never;
    const service = new PricingService(
      prisma,
      new ConfigService({ NGN_PER_USD: '1600', MIN_GROSS_MARGIN: '0.99' }),
    );

    const { groups, total } = await service.listModels();
    expect(total).toBe(0);
    expect(groups).toEqual([]);
  });
});
