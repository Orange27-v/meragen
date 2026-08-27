import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NAIRA_PER_CREDIT, koboToNaira, roundUpToStep, grossMargin, retailForMargin } from '../pricing/money';
import { MarginFloorBreachError } from '../pricing/pricing.errors';
import { VoiceVendor } from './voice.types';

export interface VoiceQuote {
  characters: number;
  cloned: boolean;
  credits: number;
  naira: number;
  breakdown: {
    vendorCostNaira: number;
    realisedMargin: number;
    /** True when this vendor bills in Naira, so FX cannot erode the margin. */
    nairaDenominated: boolean;
  };
}

/**
 * Prices speech.
 *
 * Different from every other quote in the system in one important way: the
 * vendor bills in **Naira per character**, not dollars per generation. That
 * means two things:
 *
 *   1. No FX exposure. The rest of the pricing engine exists partly to defend
 *      margins against naira depreciation against a USD cost base; a
 *      Naira-billed vendor is simply outside that problem.
 *   2. The cost is knowable from the text before anything is submitted, so a
 *      customer can be quoted exactly and charged exactly — which is how every
 *      other charge here works, and which a per-second vendor could not offer.
 */
const TARGET_MARGIN = 0.6;

/** Nobody is charged for a single word, and nobody gets a free paragraph. */
export const MIN_CREDITS = 1;
export const MAX_CHARACTERS = 5_000;

@Injectable()
export class VoicePricing {
  constructor(private readonly config: ConfigService) {}

  get marginFloor(): number {
    return Number(this.config.get<string>('MIN_GROSS_MARGIN', '0.20'));
  }

  quote(vendor: VoiceVendor, characters: number, cloned: boolean): VoiceQuote {
    const costKobo = vendor.costKobo(characters, cloned);

    const target = retailForMargin(costKobo, TARGET_MARGIN);
    // Round up to a whole credit, so the price is always a whole number of
    // credits and rounding can only help the margin.
    const retailKobo = Math.max(
      roundUpToStep(target, NAIRA_PER_CREDIT),
      MIN_CREDITS * NAIRA_PER_CREDIT * 100,
    );

    const realised = grossMargin(retailKobo, costKobo);
    if (realised < this.marginFloor) {
      throw new MarginFloorBreachError('voice', realised, this.marginFloor, costKobo, retailKobo);
    }

    return {
      characters,
      cloned,
      credits: retailKobo / (NAIRA_PER_CREDIT * 100),
      naira: koboToNaira(retailKobo),
      breakdown: {
        vendorCostNaira: koboToNaira(costKobo),
        realisedMargin: Number(realised.toFixed(4)),
        nairaDenominated: true,
      },
    };
  }
}
