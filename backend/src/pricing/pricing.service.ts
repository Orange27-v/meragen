import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Vendor } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { Tier, getTier, ALL_TIERS, marginForCost, roundingForCost } from './tiers';
import { MarginFloorBreachError, UnpricedModelError } from './pricing.errors';
import {
  usdMicrosToKobo, koboToNaira, roundUpToStep, grossMargin, retailForMargin, microsToUsd,
  creditsFromKobo, NAIRA_PER_CREDIT,
} from './money';
import { infrastructureCost, RETENTION_MONTHS } from './infrastructure';

export interface Quote {
  tierId: string;
  label: string;
  spec: string;
  modelId: string;
  /** What the customer pays, in credits. */
  credits: number;
  /** The same price in Naira, for display alongside.  */
  naira: number;
  breakdown: {
    vendorCostUsd: number;
    vendorCostNaira: number;
    /** Storage and operations to keep this deliverable for the retention window. */
    infraCostNaira: number;
    /** Vendor plus infrastructure — what the generation actually costs us. */
    totalCostNaira: number;
    outputMb: number;
    nairaPerUsd: number;
    targetMargin: number;
    realisedMargin: number;
    nairaPerCredit: number;
  };
}

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Naira per USD. A live business input, not a constant (planning.md §6). */
  get nairaPerUsd(): number {
    return Number(this.config.get<string>('NGN_PER_USD', '1500'));
  }

  /** Never sell below this gross margin. */
  get marginFloor(): number {
    return Number(this.config.get<string>('MIN_GROSS_MARGIN', '0.20'));
  }

  /**
   * Prices one tier.
   *
   * `costOverrideUsdMicros` lets a caller pass a live per-request vendor estimate
   * for a `dynamic_pricing` model, instead of the last synced catalogue price.
   */
  async quote(tierId: string, costOverrideUsdMicros?: number): Promise<Quote> {
    const tier = getTier(tierId);
    if (!tier) throw new Error(`Unknown tier: ${tierId}`);
    return this.quoteTier(tier, costOverrideUsdMicros);
  }

  async quoteTier(tier: Tier, costOverrideUsdMicros?: number): Promise<Quote> {
    const vendorUsdMicros = costOverrideUsdMicros ?? (await this.lookupCost(tier));

    // Delivering a generation costs more than the vendor charges: we store the
    // result for a year so the customer can come back for it. A few naira each,
    // but it compounds with every file kept, and pricing that ignores it is
    // pricing that slowly stops working.
    const infra = infrastructureCost(tier.spec);
    const costUsdMicros = vendorUsdMicros + infra.totalUsdMicros;

    const vendorKobo = usdMicrosToKobo(vendorUsdMicros, this.nairaPerUsd);
    const infraKobo = usdMicrosToKobo(infra.totalUsdMicros, this.nairaPerUsd);
    const costKobo = vendorKobo + infraKobo;

    const target = retailForMargin(costKobo, tier.targetMargin);
    // Rounding up can only help the margin, never hurt it.
    const retailKobo = roundUpToStep(target, tier.roundToNaira);
    const realised = grossMargin(retailKobo, costKobo);

    if (realised < this.marginFloor) {
      // Deliberately loud: this stops the sale.
      this.logger.error(
        `MARGIN FLOOR BREACH on '${tier.id}' — ${(realised * 100).toFixed(1)}% < ` +
          `${(this.marginFloor * 100).toFixed(1)}% at ₦${this.nairaPerUsd}/$`,
      );
      throw new MarginFloorBreachError(tier.id, realised, this.marginFloor, costKobo, retailKobo);
    }

    const naira = koboToNaira(retailKobo);

    return {
      tierId: tier.id,
      label: tier.label,
      spec: tier.spec,
      modelId: tier.modelId,
      credits: creditsFromKobo(retailKobo),
      naira,
      breakdown: {
        vendorCostUsd: microsToUsd(vendorUsdMicros),
        vendorCostNaira: koboToNaira(vendorKobo),
        infraCostNaira: koboToNaira(infraKobo),
        totalCostNaira: koboToNaira(costKobo),
        outputMb: infra.outputMb,
        nairaPerUsd: this.nairaPerUsd,
        targetMargin: tier.targetMargin,
        realisedMargin: Number(realised.toFixed(4)),
        nairaPerCredit: NAIRA_PER_CREDIT,
      },
    };
  }

  /**
   * Every tier we can currently sell.
   *
   * A tier that breaches its floor is omitted rather than shown at a loss — the
   * price list is the thing customers act on, so it must only contain things we
   * are willing to honour.
   */
  async quoteAll(): Promise<{ sellable: Quote[]; blocked: Array<{ tierId: string; reason: string }> }> {
    const sellable: Quote[] = [];
    const blocked: Array<{ tierId: string; reason: string }> = [];

    for (const tier of ALL_TIERS) {
      try {
        sellable.push(await this.quoteTier(tier));
      } catch (error) {
        blocked.push({ tierId: tier.id, reason: (error as Error).message });
      }
    }

    return { sellable, blocked };
  }

  /**
   * Prices any model in the synced catalogue, tier or not.
   *
   * This is what lets the studio offer the full model picker: a curated tier is
   * just a model with a hand-chosen margin, and everything else gets a margin
   * derived from its cost. The floor applies identically either way.
   */
  async quoteModel(modelId: string, costOverrideUsdMicros?: number): Promise<Quote> {
    const pinned = ALL_TIERS.find((tier) => tier.modelId === modelId);
    if (pinned) return this.quoteTier(pinned, costOverrideUsdMicros);

    const price = await this.prisma.modelPrice.findUnique({
      where: { vendor_modelId: { vendor: Vendor.muapi, modelId } },
      select: { costUsdMicros: true, category: true },
    });
    if (!price) throw new UnpricedModelError(modelId, modelId);

    const costUsdMicros = costOverrideUsdMicros ?? price.costUsdMicros;
    return this.quoteTier(
      {
        id: modelId,
        label: modelId,
        spec: price.category,
        vendor: Vendor.muapi,
        modelId,
        targetMargin: marginForCost(costUsdMicros),
        roundToNaira: roundingForCost(costUsdMicros),
      },
      costUsdMicros,
    );
  }

  private async lookupCost(tier: Tier): Promise<number> {
    const price = await this.prisma.modelPrice.findUnique({
      where: { vendor_modelId: { vendor: tier.vendor, modelId: tier.modelId } },
      select: { costUsdMicros: true },
    });
    if (!price) throw new UnpricedModelError(tier.id, tier.modelId);
    return price.costUsdMicros;
  }
}
