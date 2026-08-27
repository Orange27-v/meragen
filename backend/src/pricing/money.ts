/**
 * Money helpers.
 *
 * Two rules hold everywhere in this file and everywhere that calls it:
 *
 *   1. No floats. Vendor costs are integer micro-dollars (millionths of a USD),
 *      Naira are integer kobo. Floating point drift is not acceptable in a
 *      ledger, and 0.1 + 0.2 !== 0.3 is not a bug we want to debug at 2am.
 *   2. Rounding always favours us. A quote rounds *up* to the nearest step, so
 *      rounding can only raise the realised margin, never push it under floor.
 */

export const USD_MICROS = 1_000_000;

/**
 * What one credit is worth.
 *
 * Credits exist so people reason about "6 credits" rather than "₦300" for every
 * decision. That only works if the numbers stay small and whole, which means
 * every retail price must land on a ₦50 boundary — see `roundUpToStep`, which
 * all tiers now use with a step that is a multiple of this.
 */
export const NAIRA_PER_CREDIT = 50;
export const KOBO_PER_CREDIT = NAIRA_PER_CREDIT * 100;

/**
 * Credits for a price in kobo.
 *
 * Throws rather than rounding: a fractional credit means a price escaped the
 * ₦50 grid, and silently rounding it would either short the customer or short
 * us on every single sale.
 */
export function creditsFromKobo(kobo: number): number {
  if (kobo % KOBO_PER_CREDIT !== 0) {
    throw new Error(`₦${kobo / 100} is not a whole number of credits (₦${NAIRA_PER_CREDIT} each)`);
  }
  return kobo / KOBO_PER_CREDIT;
}

export function koboFromCredits(credits: number): number {
  return credits * KOBO_PER_CREDIT;
}

export function nairaFromCredits(credits: number): number {
  return credits * NAIRA_PER_CREDIT;
}

/** `0.06` USD -> `60_000` micros. Used when reading a vendor catalogue. */
export function usdToMicros(usd: number): number {
  return Math.round(usd * USD_MICROS);
}

export function microsToUsd(micros: number): number {
  return micros / USD_MICROS;
}

/** Vendor cost in micro-dollars -> our cost in kobo, at the given FX rate. */
export function usdMicrosToKobo(costUsdMicros: number, nairaPerUsd: number): number {
  // micros -> naira -> kobo, kept in integer space throughout.
  return Math.round((costUsdMicros * nairaPerUsd) / (USD_MICROS / 100));
}

export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

/** Round *up* to a whole-Naira step, e.g. the nearest ₦50. */
export function roundUpToStep(kobo: number, stepNaira: number): number {
  const stepKobo = stepNaira * 100;
  return Math.ceil(kobo / stepKobo) * stepKobo;
}

/** Gross margin as a fraction of retail. Returns 0 for a free item. */
export function grossMargin(retailKobo: number, costKobo: number): number {
  if (retailKobo <= 0) return 0;
  return (retailKobo - costKobo) / retailKobo;
}

/**
 * Retail price that achieves a target margin over a known cost.
 * retail = cost / (1 - margin)
 */
export function retailForMargin(costKobo: number, targetMargin: number): number {
  if (targetMargin <= 0 || targetMargin >= 1) {
    throw new Error(`Target margin must be between 0 and 1, got ${targetMargin}`);
  }
  return Math.ceil(costKobo / (1 - targetMargin));
}
