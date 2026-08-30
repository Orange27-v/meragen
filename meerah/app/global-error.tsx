'use client';

import { useEffect } from 'react';

/**
 * When the root layout itself throws.
 *
 * This is the last boundary there is: it replaces the whole document, so it has
 * to bring its own `<html>` and `<body>`, and it cannot rely on the app's
 * stylesheet having loaded — which is exactly the case where it fires. Every
 * style here is inline for that reason.
 *
 * This is the page that was showing "Application error: a client-side exception
 * has occurred" with nothing else on it.
 */
export default function GlobalError({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[meerah] root failed:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
          background: '#0B0C0E',
          color: '#F4F6F8',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div style={{ maxWidth: '46ch' }}>
          <p style={{
            margin: '0 0 12px', fontSize: 11, letterSpacing: '.09em',
            textTransform: 'uppercase', color: '#00D09C',
          }}>
            Something broke
          </p>
          <h1 style={{ margin: 0, fontSize: 26, lineHeight: 1.15, fontWeight: 600 }}>
            Meerah did not start
          </h1>
          <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.55, color: '#A2A9B4' }}>
            Nothing you were making is lost, and nothing has been charged. This is
            almost always an old copy of the app left in the browser.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 24 }}>
            <button type="button" onClick={reset} style={button('#00D09C', '#08110E')}>
              Try again
            </button>
            <button
              type="button"
              onClick={() => {
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
              style={button('transparent', '#F4F6F8', 'rgba(255,255,255,0.17)')}
            >
              Clear the cache and reload
            </button>
          </div>

          <p style={{ margin: '32px 0 0', fontSize: 12, color: '#A2A9B4' }}>
            {error.digest && <>Reference <code style={code}>{error.digest}</code><br /></>}
            {error.message && <>Detail <code style={code}>{error.message}</code></>}
          </p>
        </div>
      </body>
    </html>
  );
}

function button(background: string, color: string, border = 'transparent') {
  return {
    background, color,
    border: `1px solid ${border}`,
    borderRadius: 9,
    padding: '12px 16px',
    font: 'inherit',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  } as const;
}

const code = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  color: '#A2A9B4',
  wordBreak: 'break-word',
} as const;
