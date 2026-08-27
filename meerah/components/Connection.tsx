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
      const register = () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
      if (document.readyState === 'complete') register();
      else window.addEventListener('load', register, { once: true });
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
      background: 'var(--danger)', color: '#17110A',
      fontSize: '.85rem', fontWeight: 700,
    }}>
      No connection. Anything already generating is safe — it will appear when you are back online.
    </div>
  );
}
