export const GENERATION_QUEUE = 'generation';

/** How long we keep asking the vendor before calling a job dead and refunding. */
export const MAX_POLL_MS = 15 * 60 * 1000;

/**
 * Gap between vendor status checks, widening as the job runs on.
 *
 * A 5-second clip comes back fast; a 4K render does not. Starting tight keeps
 * quick jobs feeling instant, and backing off keeps us from hammering the
 * vendor (and tripping their rate limit) on the slow ones.
 */
export function pollDelayMs(elapsedMs: number): number {
  if (elapsedMs < 30_000) return 2_000;
  if (elapsedMs < 2 * 60_000) return 5_000;
  return 10_000;
}
