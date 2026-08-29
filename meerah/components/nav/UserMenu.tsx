'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Tier, User } from '@/lib/api';

/**
 * The account menu.
 *
 * Everything that is about you rather than about the work lives here: what you
 * have left, how to get more, the things you have saved, and the way out. Sign
 * out used to exist on exactly one page, and Calendar and Prices were
 * unreachable from most of them.
 *
 * The balance is shown three ways — credits, Naira, and roughly how many videos
 * that is — because a credit count alone does not tell a Nigerian creator
 * whether they can afford tonight's post.
 */
export default function UserMenu({
  user, tiers, onBuyCredits, onSignOut,
}: {
  user: User | null;
  tiers: Tier[];
  onBuyCredits: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onClickAway = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClickAway);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClickAway);
    };
  }, [open]);

  const credits = user?.creditBalance ?? 0;
  const cheapest = tiers.find((t) => t.tierId === 'draft') ?? tiers[0];
  // Naira per credit comes from a real tier, not a constant, so it stays true
  // if pricing ever moves off the ₦50 grid.
  const naira = cheapest ? Math.round((cheapest.naira / cheapest.credits) * credits) : credits * 50;
  const affordable = cheapest ? Math.floor(credits / cheapest.credits) : 0;

  return (
    <div ref={root} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        aria-expanded={open} aria-haspopup="menu"
        aria-label={user ? `Account: ${user.email}` : 'Account'}
        style={{
          display: 'grid', placeItems: 'center', width: 32, height: 32, padding: 0,
          borderRadius: 'var(--radius-pill)', cursor: 'pointer',
          border: `1px solid ${open ? 'var(--iron)' : 'var(--line)'}`,
          background: 'var(--obsidian)', color: 'var(--snow)',
          font: 'inherit', fontSize: 13, fontWeight: 600, textTransform: 'uppercase',
        }}>
        {user?.email.charAt(0) ?? '·'}
      </button>

      {open && (
        <div role="menu" style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0, zIndex: 130,
          width: 268, background: 'var(--snow)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius-tag)', overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 14px 0' }}>
            <div className="muted" style={{
              fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{user?.email ?? '—'}</div>
          </div>

          <div style={{ padding: '10px 14px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <b className="tabular" style={{ fontSize: 22 }}>{credits.toLocaleString()}</b>
              <span className="muted" style={{ fontSize: 12 }}>credits</span>
              <span className="tabular muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
                ₦{naira.toLocaleString()}
              </span>
            </div>
            {cheapest && (
              <p className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                {affordable > 0
                  ? `About ${affordable.toLocaleString()} more ${cheapest.label} video${affordable === 1 ? '' : 's'}.`
                  : 'Not enough for a video yet.'}
              </p>
            )}
            <button type="button" className="btn btn-primary btn-block"
              style={{ marginTop: 10, padding: '8px 12px', fontSize: 13 }}
              onClick={() => { setOpen(false); onBuyCredits(); }}>
              Buy credits
            </button>
          </div>

          <Divider />
          <Item href="/saved" onNavigate={() => setOpen(false)}>Saved</Item>
          <Item href="/calendar" onNavigate={() => setOpen(false)}>Calendar</Item>
          <Item href="/pricing" onNavigate={() => setOpen(false)}>Prices</Item>
          <Item href="/studio" onNavigate={() => setOpen(false)}>Simple mode</Item>

          {user?.isAdmin && (
            <>
              <Divider />
              <Item href="/admin" onNavigate={() => setOpen(false)}>Owner metrics</Item>
            </>
          )}

          <Divider />
          <button type="button" role="menuitem" onClick={onSignOut} style={{ ...itemStyle, width: '100%', textAlign: 'left', border: 0, cursor: 'pointer' }}>
            Sign out
          </button>
          <div style={{ height: 6 }} />
        </div>
      )}
    </div>
  );
}

function Item({ href, children, onNavigate }: { href: string; children: React.ReactNode; onNavigate: () => void }) {
  return (
    <Link role="menuitem" href={href} onClick={onNavigate} style={itemStyle}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ink-deep)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
      {children}
    </Link>
  );
}

function Divider() {
  return <div aria-hidden style={{ height: 1, background: 'var(--line)', margin: '6px 0' }} />;
}

const itemStyle = {
  display: 'block', padding: '8px 14px', font: 'inherit', fontSize: 13.5,
  color: 'var(--chalk)', textDecoration: 'none', background: 'transparent',
} as const;
