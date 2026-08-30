'use client';

import { useEffect } from 'react';

/**
 * When a page throws.
 *
 * Without this, Next shows its own production wall — "Application error: a
 * client-side exception has occurred" — which names nothing, offers nothing,
 * and leaves the customer with a blank screen and us with no idea what broke.
 *
 * So this says what happened, gives the two things that usually fix it, and
 * prints the digest. The digest is the only handle on a minified production
 * stack; someone reporting a fault can read it out and it points straight at
 * the throw.
 *
 * It deliberately does not blame the customer or apologise. It says what went
 * wrong and what to do.
 */
export default function Error({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Reaches the browser console even when the overlay is gone, so a screenshot
    // of the console is enough to diagnose it.
    console.error('[meerah] page failed:', error);
  }, [error]);

  return (
    <main className="grid min-h-[70vh] place-items-center px-6">
      <div className="w-full max-w-[46ch]">
        <p className="section-title mb-3">
          Something broke
        </p>
        <h1 className="text-2xl font-semibold text-ink-primary">This page did not load</h1>
        <p className="mt-3 text-md text-ink-secondary">
          Nothing you were making is lost, and nothing has been charged. Most of the
          time this is an old copy of the app left in the browser.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={reset} className="btn btn-primary">
            Try again
          </button>
          <button
            type="button"
            onClick={() => {
              // Clear the worker and its caches, then reload — the specific
              // failure this page most often stands in for.
              void (async () => {
                try {
                  const regs = await navigator.serviceWorker?.getRegistrations();
                  await Promise.all((regs ?? []).map((r) => r.unregister()));
                  const keys = await caches?.keys();
                  await Promise.all((keys ?? []).map((k) => caches.delete(k)));
                } catch {
                  /* nothing cached is still a fine place to reload from */
                }
                window.location.reload();
              })();
            }}
            className="btn btn-ghost"
          >
            Clear the cache and reload
          </button>
        </div>

        {/* The only handle on a minified stack. Worth reading out. */}
        <dl className="mt-8 space-y-1 text-[12px] text-[var(--fog)]">
          {error.digest && (
            <div className="flex gap-2">
              <dt className="shrink-0">Reference</dt>
              <dd className="font-mono text-[var(--paper-ink)]">{error.digest}</dd>
            </div>
          )}
          {error.message && (
            <div className="flex gap-2">
              <dt className="shrink-0">Detail</dt>
              <dd className="break-words font-mono text-[var(--paper-ink)]">{error.message}</dd>
            </div>
          )}
        </dl>
      </div>
    </main>
  );
}
