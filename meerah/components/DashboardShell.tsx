'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api, type Tier, type User } from '@/lib/api';
import { GROUPS, toolsInGroup } from '@/lib/tools';
import ToolMenu from '@/components/nav/ToolMenu';
import UserMenu from '@/components/nav/UserMenu';
import TopUpSheet from '@/components/TopUpSheet';

/**
 * One shell for every signed-in page.
 *
 * Before this there were five: a bespoke header inside the studio and the same
 * `.topbar` block copy-pasted into four pages, each with a different set of
 * links. The result was a product where `/create` was reachable from exactly
 * one place, `/admin` from nowhere, and Sign out from a single page. Nothing
 * felt like one application because, structurally, it was not one.
 *
 * Two densities, one header:
 *
 *   · `app`  — the studio. Fixed height, no page scroll, so a tool can dock its
 *              own panels to the edges of the viewport.
 *   · `page` — everything else. A normal scrolling 1200px column.
 */
export default function DashboardShell({
  density = 'page', user, onSignOut, activeTool, onPickTool, onShowGuide, refreshUser, children,
}: {
  density?: 'app' | 'page';
  user: User | null;
  onSignOut: () => void;
  /** Set on /create so the nav can mark the current tool and switch in place. */
  activeTool?: string;
  onPickTool?: (toolId: string) => void;
  /** Set on a tool page, so the header can offer its guide. */
  onShowGuide?: () => void;
  /** Called after a top-up lands, so the balance in the header catches up. */
  refreshUser?: () => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [buying, setBuying] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Prices are public and small, and the header, the nav menu and the cost
  // meter all read the same copy — one fetch for the whole dashboard.
  useEffect(() => {
    void api.pricing().then(({ tiers: found }) => setTiers(found)).catch(() => { /* nav degrades quietly */ });
  }, []);

  // Coming back from Paystack. Do not wait for the webhook: it needs a public
  // URL to reach us, which does not exist in development and can be delayed in
  // production. Ask the server to verify this exact payment instead.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') ?? params.get('trxref');
    if (!reference) {
      if (params.get('paid') === '1') {
        setNotice('Payment received. Your credits will appear in a moment.');
        const timers = [1500, 4000, 8000].map((ms) => setTimeout(() => refreshUser?.(), ms));
        return () => timers.forEach(clearTimeout);
      }
      return;
    }

    setNotice('Confirming your payment…');
    void api.verifyTopup(reference)
      .then((result) => {
        setNotice(result.credited
          ? 'Payment confirmed. Your credits are ready.'
          : 'Payment received. Your credits are already on your account.');
        refreshUser?.();
        // Clear the reference so a refresh does not re-run this.
        window.history.replaceState({}, '', pathname);
      })
      .catch(() => {
        setNotice('');
        setError('We could not confirm that payment yet. Refresh in a moment, or contact us if the credits do not appear.');
      });
  }, [pathname, refreshUser]);

  // A tool inside the studio cannot reach this sheet directly — it is a forked
  // component that knows nothing about the shell — so it says it needs credits
  // and the shell decides how to ask for them.
  useEffect(() => {
    const onNeedCredits = () => setBuying(true);
    window.addEventListener('meerah:buy-credits', onNeedCredits);
    return () => window.removeEventListener('meerah:buy-credits', onNeedCredits);
  }, []);

  function pickTool(toolId: string) {
    if (onPickTool) onPickTool(toolId);
    else router.push(`/create/${toolId}`);
  }

  const isApp = density === 'app';

  return (
    <div style={isApp
      ? { height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--ink)' }
      : undefined}>
      <header style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, height: 56,
        padding: '0 16px', background: 'var(--snow)', borderBottom: '1px solid var(--line)',
        position: isApp ? undefined : 'sticky', top: 0, zIndex: 100,
      }}>
        {/* Below 700px the grouped nav does not fit, so the tools move into a
            sheet behind this button rather than disappearing. */}
        <button type="button" className="shell-sheet-toggle" aria-label="Tools"
          aria-expanded={sheetOpen} onClick={() => setSheetOpen((v) => !v)}
          style={{
            width: 32, height: 32, padding: 0, placeItems: 'center', flexShrink: 0,
            border: '1px solid var(--line)', borderRadius: 'var(--radius-tag)',
            background: 'var(--snow)', color: 'var(--iron)', cursor: 'pointer', font: 'inherit',
          }}>
          <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
            <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <Link className="wordmark" href="/create" style={{ fontSize: 17, flexShrink: 0 }}>
          <span className="mark" />Meerah
        </Link>

        <div className="shell-nav">
          <ToolMenu activeTool={activeTool} tiers={tiers} onPick={pickTool} />
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {onShowGuide && (
            <button type="button" onClick={onShowGuide} className="shell-guide"
              style={{
                padding: '5px 11px', borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--line)', background: 'var(--snow)',
                font: 'inherit', fontSize: 12.5, color: 'var(--iron)', cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}>
              How it works
            </button>
          )}
          <button type="button" onClick={() => setBuying(true)} className="shell-credits"
            title="Buy credits"
            style={{
              display: 'flex', alignItems: 'baseline', gap: 6, padding: '5px 12px',
              borderRadius: 'var(--radius-pill)', border: '1px solid var(--line)',
              background: 'var(--ink-deep)', font: 'inherit', cursor: 'pointer',
              fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
            }}>
            <span style={{ fontSize: 11, color: 'var(--fog)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
              Credits
            </span>
            <b style={{ fontSize: 14 }}>{user?.creditBalance.toLocaleString() ?? '—'}</b>
          </button>
          <UserMenu user={user} tiers={tiers}
            onBuyCredits={() => setBuying(true)} onSignOut={onSignOut} />
        </div>
      </header>

      {sheetOpen && (
        <div className="shell-sheet" style={{
          background: 'var(--snow)', borderBottom: '1px solid var(--line)',
          padding: '4px 12px 14px', maxHeight: '70vh', overflowY: 'auto',
        }}>
          {GROUPS.map((group) => (
            <div key={group} style={{ marginTop: 10 }}>
              <div className="muted" style={{
                fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase',
                padding: '0 4px 6px', fontWeight: 500,
              }}>{group}</div>
              {toolsInGroup(group).map((tool) => (
                <button key={tool.id} type="button"
                  onClick={() => { setSheetOpen(false); pickTool(tool.id); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', font: 'inherit',
                    padding: '8px', border: 0, borderRadius: 'var(--radius-tag)', cursor: 'pointer',
                    background: tool.id === activeTool ? 'var(--surface-hi)' : 'transparent',
                  }}>
                  <span style={{ fontSize: 14, fontWeight: tool.id === activeTool ? 600 : 500 }}>{tool.label}</span>
                  <span className="muted" style={{ display: 'block', fontSize: 11.5, marginTop: 1 }}>{tool.blurb}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {(notice || error) && (
        <div style={{ padding: '10px 16px 0', background: isApp ? 'var(--ink)' : undefined }}>
          {notice && <div className="alert alert-ok">{notice}</div>}
          {error && <div className="alert">{error}</div>}
        </div>
      )}

      {isApp ? (
        <main style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      ) : (
        <main className="shell" style={{ paddingBlock: '2rem 4rem' }}>{children}</main>
      )}

      <TopUpSheet open={buying} onClose={() => setBuying(false)} returnTo={pathname} />

      <style>{`
        .shell-nav { min-width: 0; overflow: visible; }
        .shell-sheet-toggle { display: none; }
        @media (max-width: 860px) {
          .shell-credits span { display: none; }
          .shell-guide { display: none; }
        }
        @media (max-width: 700px) {
          .shell-nav { display: none; }
          .shell-sheet-toggle { display: grid; }
        }
      `}</style>
    </div>
  );
}
