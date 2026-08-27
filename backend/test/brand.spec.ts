import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient, BrandAssetType, Vendor, GenerationStatus } from '@prisma/client';
import { PrismaService } from '../src/common/prisma.service';
import { BrandService } from '../src/brand/brand.service';
import { StorageService } from '../src/storage/storage.service';

const prisma = new PrismaClient() as PrismaService;

class FakeStorage {
  async freshUrl(key: string) { return `https://files.test/${key}?signed=1`; }
}
const brand = new BrandService(prisma, new FakeStorage() as unknown as StorageService);

let userId: string;
let strangerId: string;

async function makeUser(): Promise<string> {
  const user = await prisma.user.create({ data: { email: `brand-${crypto.randomUUID()}@meerahstudio.com` } });
  return user.id;
}

beforeAll(async () => { await prisma.$connect(); });
afterAll(async () => { await prisma.$disconnect(); });

beforeEach(async () => {
  userId = await makeUser();
  strangerId = await makeUser();
});

describe('saving', () => {
  it('keeps a character and shows it back', async () => {
    const saved = await brand.create({ userId, type: BrandAssetType.character, name: '  Ada, our model  ' });

    expect(saved.name).toBe('Ada, our model');
    expect(saved.usedCount).toBe(0);

    const all = await brand.list(userId);
    expect(all).toHaveLength(1);
  });

  it('signs a fresh preview URL on every read', async () => {
    const saved = await brand.create({
      userId, type: BrandAssetType.character, name: 'Ada', storageKey: 'uploads/x/ada.png',
    });

    // Never a permanent link — a stale one in someone's browser must expire.
    expect(saved.previewUrl).toContain('signed=1');
  });

  it('insists on a name', async () => {
    await expect(brand.create({ userId, type: BrandAssetType.character, name: '   ' }))
      .rejects.toThrow(/name/);
  });

  it('stops the list growing past what a picker can show', async () => {
    await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        brand.create({ userId, type: BrandAssetType.character, name: `Face ${i}` })),
    );

    await expect(brand.create({ userId, type: BrandAssetType.character, name: 'One too many' }))
      .rejects.toThrow(/reached 50/);

    // The cap is per kind, so brand kits are unaffected.
    await expect(brand.create({ userId, type: BrandAssetType.template, name: 'Brand kit' }))
      .resolves.toBeTruthy();
  });
});

describe('saving from a generation', () => {
  async function makeGeneration(owner: string, status: GenerationStatus) {
    return prisma.generation.create({
      data: {
        userId: owner, feature: 'VidEngine', vendor: Vendor.muapi,
        modelId: 'seedance-pro-t2v-fast', status,
        inputParams: { prompt: 'a lagos market at dusk' },
        costCredits: 6, storageKey: 'generations/out.mp4', outputUrl: 'https://files.test/out.mp4',
      },
    });
  }

  it('turns a finished generation into a reusable character', async () => {
    const generation = await makeGeneration(userId, GenerationStatus.completed);

    const saved = await brand.saveFromGeneration({ userId, generationId: generation.id, name: 'Market scene' });

    expect(saved.type).toBe(BrandAssetType.character);
    expect(saved.metadata.fromGeneration).toBe(generation.id);
    // The prompt travels with it, so it can be reused or tweaked later.
    expect(saved.metadata.prompt).toBe('a lagos market at dusk');
    expect(saved.previewUrl).toContain('generations/out.mp4');
  });

  it('refuses one that has not finished', async () => {
    const generation = await makeGeneration(userId, GenerationStatus.processing);

    await expect(brand.saveFromGeneration({ userId, generationId: generation.id, name: 'Too early' }))
      .rejects.toThrow(/not finished/);
  });

  it("refuses another account's generation", async () => {
    const generation = await makeGeneration(strangerId, GenerationStatus.completed);

    await expect(brand.saveFromGeneration({ userId, generationId: generation.id, name: 'Not mine' }))
      .rejects.toThrow(/No such generation/);
  });
});

describe('ownership', () => {
  it("never shows, renames or deletes another account's saved item", async () => {
    const mine = await brand.create({ userId, type: BrandAssetType.character, name: 'Private' });

    // Same answer as a non-existent id, so an id cannot be used to probe.
    await expect(brand.get(strangerId, mine.id)).rejects.toThrow(/No such saved item/);
    await expect(brand.rename(strangerId, mine.id, 'Hijacked')).rejects.toThrow(/No such saved item/);
    await expect(brand.remove(strangerId, mine.id)).rejects.toThrow(/No such saved item/);

    // Untouched.
    expect((await brand.get(userId, mine.id)).name).toBe('Private');
  });

  it('keeps two accounts’ lists separate', async () => {
    await brand.create({ userId, type: BrandAssetType.character, name: 'Mine' });
    await brand.create({ userId: strangerId, type: BrandAssetType.character, name: 'Theirs' });

    expect((await brand.list(userId)).map((a) => a.name)).toEqual(['Mine']);
    expect((await brand.list(strangerId)).map((a) => a.name)).toEqual(['Theirs']);
  });
});

describe('reuse', () => {
  it('puts what you actually reach for at the top', async () => {
    const rare = await brand.create({ userId, type: BrandAssetType.character, name: 'Rare' });
    const favourite = await brand.create({ userId, type: BrandAssetType.character, name: 'Favourite' });

    for (let i = 0; i < 5; i++) await brand.markUsed(userId, favourite.id);
    await brand.markUsed(userId, rare.id);

    const ordered = await brand.list(userId);
    expect(ordered[0].name).toBe('Favourite');
    expect(ordered[0].usedCount).toBe(5);
  });

  it('does not let one account run up another account’s counter', async () => {
    const mine = await brand.create({ userId, type: BrandAssetType.character, name: 'Mine' });

    await brand.markUsed(strangerId, mine.id);

    expect((await brand.get(userId, mine.id)).usedCount).toBe(0);
  });

  it('filters by kind', async () => {
    await brand.create({ userId, type: BrandAssetType.character, name: 'A face' });
    await brand.create({ userId, type: BrandAssetType.template, name: 'A brand kit' });
    await brand.create({ userId, type: BrandAssetType.voice_profile, name: 'My voice' });

    expect(await brand.list(userId, BrandAssetType.character)).toHaveLength(1);
    expect(await brand.list(userId, BrandAssetType.voice_profile)).toHaveLength(1);
    expect(await brand.list(userId)).toHaveLength(3);
  });
});
