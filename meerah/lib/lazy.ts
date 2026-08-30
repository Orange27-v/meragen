/**
 * Loading a code-split chunk, when the chunk might not be there.
 *
 * Next names build chunks by content hash, so every deploy produces a new set
 * and retires the old one. A browser holding a page from the previous build
 * asks for a file that no longer exists — and what comes back is usually not a
 * 404 but the HTML of a fallback route, which the browser tries to parse as
 * JavaScript and reports as `Unexpected token '<'`.
 *
 * `next/dynamic` does not surface that. The rejected import never reaches an
 * error boundary; the component simply stays on its loading state, so the
 * customer watches "Loading…" for as long as they are willing to.
 *
 * A failed chunk is almost always a stale page rather than a broken build, and
 * the fix for a stale page is a fresh one. So: reload once, from the network,
 * and let the new HTML bring the right hashes. `sessionStorage` makes it once —
 * if the reload fails the same way, the error is real and rethrowing lets the
 * boundary say so rather than looping.
 */
const RELOADED = 'meerah.chunk-recovered';

export function retryChunk<T>(load: () => Promise<T>): () => Promise<T> {
  return () =>
    load().catch((error: unknown) => {
      let already = false;
      try {
        already = sessionStorage.getItem(RELOADED) === '1';
      } catch {
        /* private window — treat as not yet retried */
      }

      if (already) throw error;

      try {
        sessionStorage.setItem(RELOADED, '1');
      } catch {
        /* if it cannot be recorded, one reload is still better than a hang */
      }

      window.location.reload();
      // Never settles: the page is going away. Returning a pending promise
      // keeps the loading state up for the moment it takes, rather than
      // flashing an error the customer cannot act on.
      return new Promise<T>(() => {});
    });
}

/** Clears the guard once the app is running, so a later deploy can recover too. */
export function chunkRecoveryDone(): void {
  try {
    sessionStorage.removeItem(RELOADED);
  } catch {
    /* nothing to clear */
  }
}
