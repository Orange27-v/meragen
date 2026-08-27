import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { BrandAssetType, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../storage/storage.service';

export interface BrandAssetView {
  id: string;
  type: BrandAssetType;
  name: string;
  previewUrl: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  usedCount: number;
}

/** One person can only keep so many before the picker becomes useless. */
const LIMIT_PER_TYPE = 50;

/**
 * Saved characters, voices and brand kits.
 *
 * This is the moat (planning.md §1, §7 Phase 9). "We accept Naira" is copyable
 * inside a year; a customer with eight saved characters, their own cloned voice
 * and three brand kits is not going to rebuild all of that somewhere else to
 * save a few hundred naira.
 *
 * Everything here is scoped to the owner, and a missing asset and someone
 * else's asset return the same answer — an id must not be usable to discover
 * what another business has saved.
 */
@Injectable()
export class BrandService {
  private readonly logger = new Logger(BrandService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private async view(asset: {
    id: string; type: BrandAssetType; name: string; metadata: Prisma.JsonValue;
    createdAt: Date; storageKey: string | null; usedCount: number;
  }): Promise<BrandAssetView> {
    return {
      id: asset.id,
      type: asset.type,
      name: asset.name,
      // Signed and short-lived, re-signed on every read so a stale link in
      // someone's browser cannot keep serving the file forever.
      previewUrl: asset.storageKey ? await this.storage.freshUrl(asset.storageKey) : null,
      metadata: (asset.metadata as Record<string, unknown>) ?? {},
      createdAt: asset.createdAt,
      usedCount: asset.usedCount,
    };
  }

  async list(userId: string, type?: BrandAssetType): Promise<BrandAssetView[]> {
    const assets = await this.prisma.brandAsset.findMany({
      where: { userId, ...(type ? { type } : {}) },
      orderBy: [{ usedCount: 'desc' }, { createdAt: 'desc' }],
    });
    return Promise.all(assets.map((asset) => this.view(asset)));
  }

  async get(userId: string, id: string): Promise<BrandAssetView> {
    const asset = await this.prisma.brandAsset.findFirst({ where: { id, userId } });
    if (!asset) throw new NotFoundException('No such saved item');
    return this.view(asset);
  }

  async create(params: {
    userId: string;
    type: BrandAssetType;
    name: string;
    vendorReference?: string;
    storageKey?: string;
    metadata?: Record<string, unknown>;
  }): Promise<BrandAssetView> {
    const name = params.name?.trim();
    if (!name) throw new BadRequestException('Give it a name so you can find it later.');

    const count = await this.prisma.brandAsset.count({
      where: { userId: params.userId, type: params.type },
    });
    if (count >= LIMIT_PER_TYPE) {
      throw new BadRequestException(
        `You have reached ${LIMIT_PER_TYPE} saved items of that kind. Delete one to save another.`,
      );
    }

    const asset = await this.prisma.brandAsset.create({
      data: {
        userId: params.userId,
        type: params.type,
        name,
        vendorReference: params.vendorReference ?? null,
        storageKey: params.storageKey ?? null,
        metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Saved ${params.type} "${name}" for ${params.userId}`);
    return this.view(asset);
  }

  /**
   * Saves a finished generation as a reusable character.
   *
   * This is the moment stickiness is created: someone makes a face they like,
   * and one tap turns it into something every future video can reuse. It has to
   * be one tap, or nobody does it.
   */
  async saveFromGeneration(params: {
    userId: string;
    generationId: string;
    name: string;
    type?: BrandAssetType;
  }): Promise<BrandAssetView> {
    const generation = await this.prisma.generation.findFirst({
      where: { id: params.generationId, userId: params.userId },
      select: { storageKey: true, outputUrl: true, modelId: true, status: true, inputParams: true },
    });
    if (!generation) throw new NotFoundException('No such generation');
    if (generation.status !== 'completed') {
      throw new BadRequestException('That one has not finished yet.');
    }

    return this.create({
      userId: params.userId,
      type: params.type ?? BrandAssetType.character,
      name: params.name,
      storageKey: generation.storageKey ?? undefined,
      metadata: {
        fromGeneration: params.generationId,
        modelId: generation.modelId,
        prompt: (generation.inputParams as { prompt?: string })?.prompt ?? null,
        sourceUrl: generation.outputUrl,
      },
    });
  }

  async rename(userId: string, id: string, name: string): Promise<BrandAssetView> {
    const trimmed = name?.trim();
    if (!trimmed) throw new BadRequestException('Give it a name so you can find it later.');

    const { count } = await this.prisma.brandAsset.updateMany({
      where: { id, userId },
      data: { name: trimmed },
    });
    if (count === 0) throw new NotFoundException('No such saved item');
    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const { count } = await this.prisma.brandAsset.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('No such saved item');
    return { deleted: true };
  }

  /**
   * Records that an asset was used in a generation.
   *
   * Drives ordering — the character someone reaches for constantly should be
   * first in the picker — and tells us whether the stickiness layer is actually
   * doing its job, which the retention projections depend on (planning.md §7).
   */
  async markUsed(userId: string, id: string): Promise<void> {
    await this.prisma.brandAsset.updateMany({
      where: { id, userId },
      data: { usedCount: { increment: 1 }, lastUsedAt: new Date() },
    });
  }
}
