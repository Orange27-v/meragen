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

      // When a new worker takes over, the page is running the old build's
      // JavaScript against the new one's assets. Reload once, and only once —
      // `reloading` stops the loop if the worker changes again mid-reload.
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
    }

    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div role="status" style={{
      position: 'fixed', insetInline: 0, bottom: 0, zIndex: 100,
      padding: '.7rem 1rem', textAlign: 'center',
      background: 'var(--danger)', color: 'var(--void)',
      fontSize: '.85rem', fontWeight: 700,
    }}>
      No connection. Anything already generating is safe — it will appear when you are back online.
    </div>
  );
}
