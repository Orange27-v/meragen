import { Injectable, Logger } from '@nestjs/common';
import { Vendor } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { MuApiCatalogClient, CatalogEntry } from '../vendors/muapi.catalog';
import { PricingService } from './pricing.service';
import { ALL_TIERS } from './tiers';
import { microsToUsd } from './money';

export interface SyncReport {
  fetched: number;
  added: number;
  changed: number;
  unchanged: number;
  /** Price moves that pushed a pinned tier under its margin floor. */
  breaches: Array<{ tierId: string; modelId: string; from: number; to: number; reason: string }>;
}

/**
 * Keeps our copy of the vendor rate card current, and shouts when a price move
 * threatens a tier we sell.
 *
 * Runs on a schedule in production. Most MuAPI models carry
 * `dynamic_pricing: true`, so prices *will* move — the question is only whether
 * we find out from a job or from a month-end margin report.
 */
@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: MuApiCatalogClient,
    private readonly pricing: PricingService,
  ) {}

  async sync(entries?: CatalogEntry[]): Promise<SyncReport> {
    const models = entries ?? (await this.catalog.fetchCatalog());
    const report: SyncReport = { fetched: models.length, added: 0, changed: 0, unchanged: 0, breaches: [] };

    const pinned = new Map(ALL_TIERS.map((tier) => [tier.modelId, tier]));

    for (const entry of models) {
      const existing = await this.prisma.modelPrice.findUnique({
        where: { vendor_modelId: { vendor: Vendor.muapi, modelId: entry.modelId } },
      });

      if (!existing) {
        await this.prisma.modelPrice.create({
          data: {
            vendor: Vendor.muapi,
            modelId: entry.modelId,
            category: entry.category,
            costUsdMicros: entry.costUsdMicros,
            dynamicPricing: entry.dynamicPricing,
          },
        });
        report.added++;
        continue;
      }

      if (existing.costUsdMicros === entry.costUsdMicros) {
        await this.prisma.modelPrice.update({
          where: { id: existing.id },
          data: { lastSyncedAt: new Date(), category: entry.category, dynamicPricing: entry.dynamicPricing },
        });
        report.unchanged++;
        continue;
      }

      // Price moved. Record it, then check whether it broke anything we sell.
      const tier = pinned.get(entry.modelId);
      let breachedFloor = false;

      if (tier) {
        try {
          await this.pricing.quoteTier(tier, entry.costUsdMicros);
        } catch (error) {
          breachedFloor = true;
          report.breaches.push({
            tierId: tier.id,
            modelId: entry.modelId,
            from: microsToUsd(existing.costUsdMicros),
            to: microsToUsd(entry.costUsdMicros),
            reason: (error as Error).message,
          });
        }
      }

      await this.prisma.$transaction([
        this.prisma.priceChange.create({
          data: {
            modelPriceId: existing.id,
            previousUsdMicros: existing.costUsdMicros,
            newUsdMicros: entry.costUsdMicros,
            breachedFloor,
          },
        }),
        this.prisma.modelPrice.update({
          where: { id: existing.id },
          data: { costUsdMicros: entry.costUsdMicros, category: entry.category, dynamicPricing: entry.dynamicPricing },
        }),
      ]);

      report.changed++;

      const direction = entry.costUsdMicros > existing.costUsdMicros ? 'UP' : 'DOWN';
      const line =
        `${entry.modelId}: $${microsToUsd(existing.costUsdMicros)} -> $${microsToUsd(entry.costUsdMicros)} (${direction})`;
      if (breachedFloor) this.logger.error(`PRICE MOVE BROKE A TIER — ${line}`);
      else if (tier) this.logger.warn(`Price move on a tier we sell — ${line}`);
      else this.logger.log(`Price move — ${line}`);
    }

    this.logger.log(
      `Catalogue sync: ${report.fetched} fetched, ${report.added} new, ` +
        `${report.changed} changed, ${report.breaches.length} breaches`,
    );
    return report;
  }
}
