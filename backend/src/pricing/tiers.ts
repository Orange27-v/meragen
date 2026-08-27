import { Vendor } from '@prisma/client';

/**
 * What a customer is actually buying, pinned to a specific vendor model.
 *
 * Pinning matters: a tier that floats across "whatever model seems right today"
 * cannot be priced, cannot be margin-checked, and silently changes what the
 * customer receives. Each tier names one model id, and a vendor price move on
 * that id is an alert (planning.md §6, open decision 3).
 *
 * Retail price is NOT hardcoded here. It is derived from the synced vendor cost
 * and the target margin below, so a vendor price change moves our price instead
 * of quietly eating the margin.
 */
export interface Tier {
  id: string;
  label: string;
  /** Shown in the picker, e.g. "5s · 480p". */
  spec: string;
  vendor: Vendor;
  modelId: string;
  /** Margin we aim for on this tier, as a fraction of retail. */
  targetMargin: number;
  /**
   * Retail rounds up to this Naira step. Must be a multiple of NAIRA_PER_CREDIT
   * so the price is always a whole number of credits.
   */
  roundToNaira: number;
}

export const VIDEO_TIERS: readonly Tier[] = [
  {
    id: 'draft',
    label: 'Draft',
    spec: '5s · fast · 480p',
    vendor: Vendor.muapi,
    modelId: 'seedance-pro-t2v-fast',
    targetMargin: 0.65,
    roundToNaira: 50,
  },
  {
    id: 'standard',
    label: 'Standard',
    spec: '5s · 720p',
    vendor: Vendor.muapi,
    modelId: 'seedance-2.1-text-to-video',
    targetMargin: 0.5,
    roundToNaira: 50,
  },
  {
    id: 'hd',
    label: 'HD',
    spec: '5s · 1080p',
    vendor: Vendor.muapi,
    modelId: 'seedance-2.5-text-to-video',
    targetMargin: 0.45,
    roundToNaira: 50,
  },
  {
    id: 'premium',
    label: 'Premium',
    spec: '5s · 1080p · top model',
    vendor: Vendor.muapi,
    modelId: 'seedance-2.5-text-to-video-1080p',
    targetMargin: 0.35,
    roundToNaira: 50,
  },
  {
    id: 'studio',
    label: 'Studio',
    spec: '5s · 4K',
    vendor: Vendor.muapi,
    modelId: 'seedance-2.5-text-to-video-4k',
    targetMargin: 0.3,
    roundToNaira: 100,
  },
] as const;

/** Non-video features, priced the same way. */
export const FEATURE_TIERS: readonly Tier[] = [
  {
    id: 'image',
    label: 'Image',
    spec: '1 image',
    vendor: Vendor.muapi,
    modelId: 'nano-banana',
    targetMargin: 0.6,
    roundToNaira: 50,
  },
  {
    id: 'lipsync',
    label: 'TalkSync',
    spec: 'lip-sync a face',
    vendor: Vendor.muapi,
    modelId: 'omnihuman-1-5',
    targetMargin: 0.45,
    roundToNaira: 50,
  },
  {
    id: 'upscale',
    label: 'SharpUp',
    spec: 'upscale to 4K',
    vendor: Vendor.muapi,
    modelId: 'topaz-video-upscale',
    targetMargin: 0.5,
    roundToNaira: 50,
  },
] as const;

export const ALL_TIERS: readonly Tier[] = [...VIDEO_TIERS, ...FEATURE_TIERS];

export function getTier(id: string): Tier | undefined {
  return ALL_TIERS.find((tier) => tier.id === id);
}

/**
 * Margin to apply to a model that isn't one of our curated tiers.
 *
 * The studio lets people pick from the whole catalogue, so most generations
 * will not be a pinned tier. Cheap models carry a fat margin (the naira amount
 * is trivial either way); expensive ones carry a thinner one, because a 65%
 * markup on an $8 render produces a price nobody in this market will pay.
 */
export function marginForCost(costUsdMicros: number): number {
  const usd = costUsdMicros / 1_000_000;
  if (usd <= 0.1) return 0.65;
  if (usd <= 0.5) return 0.5;
  if (usd <= 2) return 0.45;
  if (usd <= 5) return 0.35;
  return 0.3;
}

/**
 * Retail rounds up to a step that suits the price.
 *
 * Every step is a multiple of ₦50 so the result is always a whole number of
 * credits — a ₦120 price would be 2.4 credits, which is not a thing we can sell.
 */
export function roundingForCost(costUsdMicros: number): number {
  const usd = costUsdMicros / 1_000_000;
  if (usd <= 2) return 50;
  return 100;
}
