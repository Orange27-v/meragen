/**
 * What it costs us to deliver a generation, beyond the vendor's own fee.
 *
 * Verified against Cloudflare's published R2 rates on 2026-08-27:
 *   storage            $0.015 per GB-month
 *   Class A (writes)   $4.50  per million
 *   Class B (reads)    $0.36  per million
 *   egress             free
 *   free tier          10 GB-month, 1M Class A, 10M Class B
 *
 * Egress being free is the entire reason R2 was chosen over the alternatives:
 * Nigerian playback traffic is the dominant volume in this product, and Bunny's
 * Africa bandwidth tier is its most expensive region at $0.06/GB (planning.md §5).
 *
 * The free tier is deliberately NOT modelled. It covers roughly the first
 * thousand generations and then stops; pricing that assumes it would quietly
 * turn negative the month we outgrow it.
 */

const R2_STORAGE_USD_PER_GB_MONTH = 0.015;
const R2_CLASS_A_USD_PER_MILLION = 4.5;
const R2_CLASS_B_USD_PER_MILLION = 0.36;

/** How long a customer's finished work stays downloadable. */
export const RETENTION_MONTHS = 12;

/**
 * Reads to budget for per generation: the customer previews it, downloads it,
 * and shares it around. Generous on purpose — under-counting reads is how a
 * storage bill surprises you.
 */
const EXPECTED_READS = 25;

/** One write to store it, plus a little slack for retries. */
const WRITES_PER_GENERATION = 2;

/**
 * Output size by resolution, in megabytes.
 *
 * Measured against typical 5-second clips from these models. Rounded up:
 * over-estimating costs us a few naira of margin, under-estimating costs real
 * money at volume.
 */
const MB_BY_RESOLUTION: Record<string, number> = {
  '480p': 2,
  '720p': 5,
  '1080p': 12,
  '4k': 45,
  image: 3,
  audio: 4,
};

export function estimateOutputMb(spec: string): number {
  const lower = spec.toLowerCase();
  if (lower.includes('4k')) return MB_BY_RESOLUTION['4k'];
  if (lower.includes('1080')) return MB_BY_RESOLUTION['1080p'];
  if (lower.includes('720')) return MB_BY_RESOLUTION['720p'];
  if (lower.includes('480')) return MB_BY_RESOLUTION['480p'];
  if (lower.includes('image')) return MB_BY_RESOLUTION.image;
  if (lower.includes('audio') || lower.includes('music')) return MB_BY_RESOLUTION.audio;
  return MB_BY_RESOLUTION['720p'];
}

export interface InfraCost {
  storageUsdMicros: number;
  operationsUsdMicros: number;
  totalUsdMicros: number;
  outputMb: number;
}

/**
 * Infrastructure cost of one generation, in micro-dollars.
 *
 * Small per item — a few naira — but it is real, it accumulates with every file
 * we keep, and pricing that ignores it is pricing that slowly stops working.
 */
export function infrastructureCost(spec: string): InfraCost {
  const outputMb = estimateOutputMb(spec);
  const gb = outputMb / 1024;

  const storageUsd = gb * R2_STORAGE_USD_PER_GB_MONTH * RETENTION_MONTHS;
  const operationsUsd =
    (WRITES_PER_GENERATION * R2_CLASS_A_USD_PER_MILLION +
      EXPECTED_READS * R2_CLASS_B_USD_PER_MILLION) /
    1_000_000;

  return {
    storageUsdMicros: Math.ceil(storageUsd * 1_000_000),
    operationsUsdMicros: Math.ceil(operationsUsd * 1_000_000),
    totalUsdMicros: Math.ceil((storageUsd + operationsUsd) * 1_000_000),
    outputMb,
  };
}

/**
 * What Paystack keeps from a payment, in kobo.
 *
 * Nigerian local transactions, verified 2026-08-27:
 *   1.5% + ₦100, the ₦100 waived below ₦2,500, total capped at ₦2,000.
 *
 * This is charged on money coming IN, so it does not belong in a per-generation
 * quote — but it is why a ₦5,000 pack is not ₦5,000 of revenue, and the pricing
 * table should say so rather than quietly overstating the margin.
 */
export const PAYSTACK_PERCENT = 0.015;
export const PAYSTACK_FLAT_KOBO = 100_00;
export const PAYSTACK_FLAT_WAIVED_BELOW_KOBO = 2_500_00;
export const PAYSTACK_CAP_KOBO = 2_000_00;

export function paystackFeeKobo(amountKobo: number): number {
  const percentPart = Math.ceil(amountKobo * PAYSTACK_PERCENT);
  const flatPart = amountKobo < PAYSTACK_FLAT_WAIVED_BELOW_KOBO ? 0 : PAYSTACK_FLAT_KOBO;
  return Math.min(percentPart + flatPart, PAYSTACK_CAP_KOBO);
}

/** What actually reaches the business account from a payment. */
export function netAfterPaystackKobo(amountKobo: number): number {
  return amountKobo - paystackFeeKobo(amountKobo);
}
