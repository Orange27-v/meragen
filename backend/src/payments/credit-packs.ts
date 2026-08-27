import { NAIRA_PER_CREDIT } from '../pricing/money';
/**
 * What a customer can buy.
 *
 * Prices are in Naira; balances are in credits. Keeping those separate is what
 * lets us survive naira/dollar movement — our vendor costs are in USD, so if the
 * naira slides we change how many credits ₦5,000 buys, rather than expiring
 * anyone's balance. See planning.md §6.
 */
export interface CreditPack {
  id: string;
  name: string;
  /** Price in kobo — Paystack works in the smallest unit. ₦1 = 100 kobo. */
  amountKobo: number;
  credits: number;
  /** Extra credits thrown in on the bigger packs. Included in `credits`. */
  bonusCredits: number;
}

// 1 credit = ₦50. `credits` includes the bonus; `bonusCredits` says how much of
// it was free.
export const CREDIT_PACKS: readonly CreditPack[] = [
  { id: 'starter',  name: 'Starter',  amountKobo:   200_000, credits:    40, bonusCredits:   0 },
  { id: 'creator',  name: 'Creator',  amountKobo:   500_000, credits:   105, bonusCredits:   5 },
  { id: 'business', name: 'Business', amountKobo: 1_500_000, credits:   330, bonusCredits:  30 },
  { id: 'agency',   name: 'Agency',   amountKobo: 5_000_000, credits: 1_150, bonusCredits: 150 },
] as const;

export function getCreditPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((pack) => pack.id === id);
}

export function nairaFromKobo(kobo: number): number {
  return kobo / 100;
}

/**
 * Pay as you go — buy exactly what you need, no pack.
 *
 * The packs exist to reward buying ahead; this exists so nobody is forced to
 * over-buy. Someone who needs one ₦300 video should be able to buy one ₦300
 * video, which is the whole promise of "pay for what you make".
 *
 * The floor is set by Paystack's own economics: below ₦500 the 1.5% fee plus
 * card-network minimums make the transaction not worth processing.
 */
export const PAYG_MIN_NAIRA = 500;
export const PAYG_MAX_NAIRA = 500_000;

/** No bonus — bonuses are what packs are for. */
export function paygCredits(naira: number): number {
  return naira / NAIRA_PER_CREDIT;
}

export interface PaygQuoteError {
  message: string;
}

export function validatePaygAmount(naira: number): PaygQuoteError | null {
  if (!Number.isFinite(naira) || Math.floor(naira) !== naira) {
    return { message: 'Enter a whole Naira amount.' };
  }
  // Credits come in whole units, so the amount has to land on the grid.
  if (naira % NAIRA_PER_CREDIT !== 0) {
    return { message: `Enter an amount in multiples of ₦${NAIRA_PER_CREDIT}.` };
  }
  if (naira < PAYG_MIN_NAIRA) {
    return { message: `The smallest top-up is ₦${PAYG_MIN_NAIRA.toLocaleString()}.` };
  }
  if (naira > PAYG_MAX_NAIRA) {
    return { message: `The largest single top-up is ₦${PAYG_MAX_NAIRA.toLocaleString()}.` };
  }
  return null;
}
