'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { DESTINATIONS, GROUPS, exampleImage, toolsInGroup,
  type DestinationInfo, type ToolGroup, type ToolInfo } from '@/lib/tools';
import type { Tier } from '@/lib/api';

/**
 * The tool navigation.
 *
 * Twelve tools in a flat row told a customer nothing: no idea what any of them
 * made, and no idea what any of them cost until after pressing Generate. So the
 * row collapses to five groups, and opening one shows what each tool makes and
 * what the qualities cost, side by side — with a still of the output beside
 * each name, because a name and a line of text still leave you guessing.
 *
 * Hover opens it because that is what a pointer expects, but hover alone would
 * lock out keyboards and touch — so focus opens it too, and a tap toggles it.
 */
const OPEN_DELAY = 150;
const CLOSE_GRACE = 250;

/** Which tier kinds belong in a group's Quality column. */
const QUALITY_FOR: Record<ToolGroup, string[]> = {
  Video: ['draft', 'standard', 'hd', 'premium', 'studio'],
  Image: ['image'],
  People: ['lipsync', 'image'],
  Selling: ['draft', 'standard', 'hd'],
  More: [],
};

export default function ToolMenu({
  activeTool, tiers, onPick,
}: {
  activeTool?: string;
  tiers: Tier[];
  /** Given when the shell can switch tools in place; otherwise we navigate. */
  onPick?: (toolId: string) => void;
}) {
  const [open, setOpen] = useState<ToolGroup | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  useEffect(() => clearTimers, []);

  function scheduleOpen(group: ToolGroup) {
    clearTimers();
    // A delay so dragging the pointer across the row does not flash every panel.
    openTimer.current = setTimeout(() => setOpen(group), open ? 0 : OPEN_DELAY);
  }
  function scheduleClose() {
    clearTimers();
    // Grace, so the diagonal move from the label down into the panel survives.
    closeTimer.current = setTimeout(() => setOpen(null), CLOSE_GRACE);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    const onClickAway = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClickAway);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClickAway);
    };
  }, [open]);

  const activeGroup = GROUPS.find((g) => toolsInGroup(g).some((t) => t.id === activeTool));

  return (
    <div ref={root} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2 }}
      onMouseLeave={scheduleClose}>
      {GROUPS.map((group) => {
        const isOpen = open === group;
        return (
          <button key={group} type="button"
            aria-expanded={isOpen} aria-controls={`${menuId}-${group}`} aria-haspopup="true"
            onMouseEnter={() => scheduleOpen(group)}
            onFocus={() => { clearTimers(); setOpen(group); }}
            onClick={() => setOpen(isOpen ? null : group)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
              padding: '6px 10px', borderRadius: 'var(--radius-tag)', border: 0, cursor: 'pointer',
              font: 'inherit', fontSize: 13.5,
              fontWeight: group === activeGroup ? 600 : 400,
              background: isOpen ? 'var(--surface-hi)' : 'transparent',
              color: group === activeGroup ? 'var(--chalk)' : 'var(--iron)',
            }}>
            {group}
            <Chevron open={isOpen} />
          </button>
        );
      })}

      {open && (
        <Panel id={`${menuId}-${open}`} group={open} tiers={tiers}
          activeTool={activeTool}
          onEnter={clearTimers} onLeave={scheduleClose}
          onPick={(id) => { setOpen(null); onPick?.(id); }} />
      )}
    </div>
  );
}

function Panel({
  id, group, tiers, activeTool, onEnter, onLeave, onPick,
}: {
  id: string;
  group: ToolGroup;
  tiers: Tier[];
  activeTool?: string;
  onEnter: () => void;
  onLeave: () => void;
  onPick: (toolId: string) => void;
}) {
  const tools = toolsInGroup(group);
  const places = DESTINATIONS[group] ?? [];
  const wanted = QUALITY_FOR[group];
  // Prices come from the API, never from a number typed in here. A published
  // price that disagrees with what someone is charged is worse than none.
  const quality = wanted
    .map((tierId) => tiers.find((t) => t.tierId === tierId))
    .filter((t): t is Tier => Boolean(t));

  return (
    <div id={id} role="group" aria-label={group}
      onMouseEnter={onEnter} onMouseLeave={onLeave}
      style={{
        position: 'absolute', top: 'calc(100% + 10px)', left: 0, zIndex: 120,
        display: 'grid',
        gridTemplateColumns: quality.length ? 'minmax(300px, 1fr) minmax(230px, .8fr)' : '1fr',
        gap: 0, minWidth: quality.length ? 580 : 320, maxWidth: 'min(720px, calc(100vw - 32px))',
        background: 'var(--snow)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius-tag)', overflow: 'hidden',
      }}>
      <div style={{ padding: 10 }}>
        {tools.length > 0 && <Heading>Tools</Heading>}
        {tools.map((tool) => (
          <ToolRow key={tool.id} tool={tool} active={tool.id === activeTool}
            onPick={onPick} />
        ))}
        {places.length > 0 && <Heading>Your account</Heading>}
        {places.map((place) => (
          <PlaceRow key={place.href} place={place} />
        ))}
      </div>

      {quality.length > 0 && (
        <div style={{ padding: 10, background: 'var(--ink-deep)', borderLeft: '1px solid var(--line)' }}>
          <Heading>Quality</Heading>
          {quality.map((tier) => (
            <div key={tier.tierId} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 8px' }}>
              <span style={{ fontSize: 13.5, fontWeight: 500 }}>{tier.label}</span>
              <span className="muted" style={{ fontSize: 11.5 }}>{tier.spec}</span>
              <b className="tabular" style={{ marginLeft: 'auto', fontSize: 13 }}>
                ₦{tier.naira.toLocaleString()}
              </b>
            </div>
          ))}
          <p className="muted" style={{ fontSize: 11, padding: '8px 8px 2px', lineHeight: 1.5 }}>
            You pick the quality inside the tool. Nothing is charged until it works —
            a failed job is refunded.
          </p>
        </div>
      )}
    </div>
  );
}

function ToolRow({ tool, active, onPick }: { tool: ToolInfo; active: boolean; onPick: (id: string) => void }) {
  const inner = (
    <>
      {/* A still of what this tool makes. Sized and decoded off the critical
          path, so opening the menu never waits on an image. */}
      <img src={exampleImage(tool.id, 1)} alt="" aria-hidden width={640} height={360}
        loading="lazy" decoding="async"
        style={{
          width: 46, height: 30, objectFit: 'cover', flexShrink: 0,
          borderRadius: 5, border: '1px solid var(--line-inner)',
        }} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: active ? 600 : 500 }}>{tool.label}</span>
        <span className="muted" style={{ display: 'block', fontSize: 11.5, lineHeight: 1.45, marginTop: 1 }}>
          {tool.blurb}
        </span>
      </span>
    </>
  );
  const style = {
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%', textAlign: 'left' as const, font: 'inherit',
    padding: '8px', borderRadius: 'var(--radius-tag)', border: 0, cursor: 'pointer',
    color: 'var(--chalk)', textDecoration: 'none',
    background: active ? 'var(--surface-hi)' : 'transparent',
  };
  return (
    <Link href={`/create/${tool.id}`} style={style}
      onClick={(e) => { e.preventDefault(); onPick(tool.id); }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--ink-deep)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
      {inner}
    </Link>
  );
}

/** A place in the product that is not a tool — a real navigation, not a tool pick. */
function PlaceRow({ place }: { place: DestinationInfo }) {
  return (
    <Link href={place.href}
      style={{
        display: 'block', width: '100%', font: 'inherit', padding: '8px',
        borderRadius: 'var(--radius-tag)', color: 'var(--chalk)', textDecoration: 'none',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ink-deep)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 500 }}>{place.label}</span>
      <span className="muted" style={{ display: 'block', fontSize: 11.5, lineHeight: 1.45, marginTop: 1 }}>
        {place.blurb}
      </span>
    </Link>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div className="muted" style={{
      fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase',
      padding: '4px 8px 8px', fontWeight: 500,
    }}>{children}</div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', opacity: .55 }}>
      <path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
