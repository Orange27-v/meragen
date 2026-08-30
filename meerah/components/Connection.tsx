'use client';

import { useEffect, useState } from 'react';

/**
 * Registers the service worker and tells the customer when the network drops.
 *
 * Nigerian mobile data drops constantly. Without this, a generation that is
 * quietly failing to poll looks identical to one that is simply slow — and the
 * customer refreshes, or worse, pays again.
 */
export default function Connection() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // After load, so registration never competes with the first paint.
      const register = async () => {
        try {
          const reg = await navigator.serviceWorker.register('/sw.js');

          // Ask for a fresh copy on every load. Browsers throttle their own
          // update check, so a worker that is serving something broken can keep
          // serving it for a day — which is how a bad deploy turns into a bad
          // week. Checking here costs one conditional request.
          void reg.update().catch(() => undefined);
        } catch {
          /* no worker is a fine outcome; the app does not depend on one */
        }
      };
      if (document.readyState === 'complete') void register();
      else window.addEventListener('load', () => void register(), { once: true });

      // When a new worker *replaces an existing one*, the page is running the
      // old build's JavaScript against the new one's assets, so it has to
      // reload. The first install is not that case: `clients.claim()` fires
      // this event on a first visit too, and reloading there interrupts
      // whatever the customer was doing — including the sign-in redirect.
      const hadController = Boolean(navigator.serviceWorker.controller);
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloading) return;
        reloading = true;
        window.location.reload();
      });
    }

    // A build chunk that will not load.
    //
    // Next names chunks by content hash, so a page held from a previous deploy
    // asks for files that no longer exist. What comes back is often not a 404
    // but a fallback route's HTML, which the browser reports as
    // `Unexpected token '<'`. Neither Next's router nor a React error boundary
    // recovers from it: the route simply never finishes loading, and the
    // customer watches "Loading…" indefinitely.
    //
    // This catches it wherever it happens — the router's own chunks included,
    // which a wrapper around our dynamic imports cannot reach — and reloads
    // once. A reload fetches fresh HTML with the current hashes, which is the
    // actual fix. `sessionStorage` makes it once: if the reload fails the same
    // way the problem is real, and letting it through is better than a loop.
    const RECOVERED = 'meerah.chunk-recovered';
    const recoverOnce = () => {
      try {
        if (sessionStorage.getItem(RECOVERED) === '1') return;
        sessionStorage.setItem(RECOVERED, '1');
      } catch {
        /* private window: one reload is still better than a hang */
      }
      window.location.reload();
    };
    const looksLikeChunkFailure = (value: unknown) => {
      const text = value instanceof Error ? `${value.name} ${value.message}` : String(value ?? '');
      return /ChunkLoadError|Loading chunk|Unexpected token '<'|Importing a module script failed|error loading dynamically imported module/i.test(text);
    };
    const onError = (event: ErrorEvent) => {
      if (looksLikeChunkFailure(event.error ?? event.message)) recoverOnce();
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (looksLikeChunkFailure(event.reason)) recoverOnce();
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    // The app is running, so nothing is stale. Clearing the mark lets a future
    // deploy have its own single attempt.
    const settled = setTimeout(() => {
      try { sessionStorage.removeItem(RECOVERED); } catch { /* nothing to clear */ }
    }, 5_000);

    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      clearTimeout(settled);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;

  return (
    /* A toast, not a full-bleed red bar. The old one spanned the viewport at
       bottom:0 in solid danger — the loudest element in the product, sitting
       exactly where the prompt dock lives. Losing signal is common here and
       recoverable; the notice should say so without shouting over the work. */
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center p-4"
    >
      <p
        className="flex max-w-md items-center gap-2.5 rounded-lg border border-edge
                   bg-surface-overlay px-3.5 py-2.5 text-sm text-ink-primary shadow-modal"
      >
        <span className="size-2 shrink-0 rounded-full bg-danger" aria-hidden />
        No connection. Anything already generating is safe — it will appear when you are back online.
      </p>
    </div>
  );
}
