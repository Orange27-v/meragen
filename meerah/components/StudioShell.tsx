'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';

/**
 * The studio shell.
 *
 * Modelled on how Higgsfield actually arranges its studio, checked page by
 * page rather than guessed:
 *
 *   · a thin top bar carries the tools, grouped with dividers, so the whole
 *     remaining viewport belongs to the work
 *   · the workspace is fixed-height and does not scroll — the tool inside owns
 *     its own scrolling, which is what lets its composer dock to the bottom
 *     over a full-bleed canvas
 *   · credits and the asset library sit top-right, always reachable
 *
 * The earlier version scrolled the page, so the tool's docked composer floated
 * in the middle of a half-empty page. Height is the whole trick here.
 */
export interface Tool {
  id: string;
  label: string;
  blurb: string;
  group: string;
}

export default function StudioShell({
  tools, groups, active, onSelect, credits, children,
}: {
  tools: Tool[];
  groups: string[];
  active: string;
  onSelect: (id: string) => void;
  credits: number | null;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--ink)' }}>
      <header style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16, height: 52,
        padding: '0 16px', background: 'var(--snow)', borderBottom: '1px solid var(--line)',
      }}>
        <Link className="wordmark" href="/studio" style={{ fontSize: 17 }}>
          <span className="mark" />Meerah
        </Link>

        {/* Tools. Grouped with dividers, the way the categories actually differ. */}
        <nav aria-label="Tools" className="studio-tools" style={{ display: 'flex', alignItems: 'center', gap: 2, overflowX: 'auto' }}>
          {groups.map((group, gi) => (
            <div key={group} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {gi > 0 && <span aria-hidden style={{ width: 1, height: 18, background: 'var(--line)', margin: '0 8px' }} />}
              {tools.filter((t) => t.group === group).map((tool) => {
                const isActive = tool.id === active;
                return (
                  <button key={tool.id} type="button" title={tool.blurb} onClick={() => onSelect(tool.id)}
                    style={{
                      padding: '6px 10px', borderRadius: 'var(--radius-tag)', border: 0, cursor: 'pointer',
                      font: 'inherit', fontSize: 13.5, fontWeight: isActive ? 600 : 400,
                      whiteSpace: 'nowrap',
                      // Selection is ink, not a hue — emphasis by weight and fill.
                      background: isActive ? 'var(--obsidian)' : 'transparent',
                      color: isActive ? 'var(--snow)' : 'var(--iron)',
                    }}>
                    {tool.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 6, padding: '5px 12px',
            borderRadius: 'var(--radius-pill)', border: '1px solid var(--line)',
            background: 'var(--ink-deep)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
          }}>
            <span style={{ fontSize: 11, color: 'var(--fog)', letterSpacing: '.06em', textTransform: 'uppercase' }}>Credits</span>
            <b style={{ fontSize: 14 }}>{credits?.toLocaleString() ?? '—'}</b>
          </div>
          <Link className="btn btn-ghost studio-desktop-only" href="/saved" style={compact}>Saved</Link>
          <Link className="btn btn-ghost studio-desktop-only" href="/calendar" style={compact}>Calendar</Link>
          <Link className="btn btn-ghost" href="/studio" style={compact}>Buy credits</Link>
          <button type="button" className="studio-menu-toggle" onClick={() => setMenuOpen((v) => !v)}
            aria-label="More" style={{ ...compact, ...iconButton }}>⋯</button>
        </div>
      </header>

      {menuOpen && (
        <div className="studio-menu" style={{
          background: 'var(--snow)', borderBottom: '1px solid var(--line)',
          padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap',
        }}>
          <Link className="btn btn-ghost" href="/saved" style={compact}>Saved</Link>
          <Link className="btn btn-ghost" href="/calendar" style={compact}>Calendar</Link>
          <Link className="btn btn-ghost" href="/studio" style={compact}>Simple mode</Link>
        </div>
      )}

      {/* The workspace. Fixed height and no scrolling of its own: the tool
          inside fills it and docks its composer to the bottom. */}
      <main style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>

      <style>{`
        .studio-tools::-webkit-scrollbar { height: 0; }
        .studio-menu-toggle { display: none; }
        @media (max-width: 1100px) {
          .studio-desktop-only { display: none; }
          .studio-menu-toggle { display: grid; }
        }
      `}</style>
    </div>
  );
}

const compact = { padding: '6px 12px', fontSize: 13 } as const;
const iconButton = {
  placeItems: 'center', width: 32, height: 32, padding: 0,
  borderRadius: 'var(--radius-tag)', border: '1px solid var(--line)',
  background: 'var(--snow)', color: 'var(--iron)', cursor: 'pointer',
} as const;
