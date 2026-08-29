'use client';

import { useCallback, useEffect, useRef } from 'react';
import { GUIDES } from '@/lib/guides';
import { exampleImage } from '@/lib/tools';
import type { ToolInfo } from '@/lib/tools';
import type { Tier } from '@/lib/api';

/**
 * What this tool does, before you spend anything on it.
 *
 * A studio opens as a text box over an empty canvas. Someone who has not used it
 * cannot tell what to type, what it will cost, or how long to wait — so they
 * either guess and pay for the guess, or leave. Each tool gets its own dialog,
 * with its own headline, its own three steps and its own live price, and it
 * opens by itself the first time that tool is visited.
 *
 * The three steps are numbered because they genuinely are a sequence: you cannot
 * pick a quality before there is something to render.
 */
export default function HowItWorks({
  tool, tiers, open, onClose,
}: {
  tool: ToolInfo;
  tiers: Tier[];
  open: boolean;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closer = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closer.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !panel.current) return;
      // A dialog that lets Tab wander behind the scrim is a dialog in name only.
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'button, a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const guide = GUIDES[tool.id];
  if (!open || !guide) return null;

  // The cheapest way to try this tool, quoted from the live price list rather
  // than written into the copy — a price in prose goes stale the day it changes.
  const relevant = tiers.filter((t) => (
    tool.kind === 'video' ? ['draft', 'standard', 'hd', 'premium', 'studio'].includes(t.tierId)
      : t.tierId === tool.kind
  ));
  const cheapest = relevant[0];

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="guide-headline"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 210, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '24px 16px',
        background: 'var(--scrim)', backdropFilter: 'blur(3px)',
      }}>
      <div ref={panel} onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(840px, 100%)', maxHeight: '100%', overflowY: 'auto',
          background: 'var(--slab)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius)', padding: '34px 36px 36px', position: 'relative',
        }}>
        <button ref={closer} type="button" onClick={onClose} aria-label="Close"
          style={{
            position: 'absolute', top: 18, right: 18, width: 32, height: 32,
            display: 'grid', placeItems: 'center', fontSize: 19, lineHeight: 1,
            cursor: 'pointer', border: '1px solid var(--line)',
            borderRadius: 'var(--radius-tag)', background: 'var(--slab-hi)',
            color: 'var(--iron)',
          }}>×</button>

        {/* The thesis: what you came here to do, and the promise, before anything else. */}
        <header style={{ maxWidth: '30ch', marginBottom: 26 }}>
          <p style={{
            fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase',
            fontWeight: 500, color: 'var(--lilac)', marginBottom: 10,
          }}>{tool.label}</p>
          <h2 id="guide-headline" className="display"
            style={{ fontSize: 'var(--text-heading-sm)', lineHeight: 1.08 }}>
            {guide.headline}
          </h2>
          <p style={{ marginTop: 10, color: 'var(--iron)', fontSize: 'var(--text-body-lg)', lineHeight: 1.45 }}>
            {guide.tagline}
          </p>
        </header>

        {/* Three steps, in order, the way the screenshots read them. */}
        <ol style={{
          listStyle: 'none', margin: '0 0 26px', padding: 0, display: 'grid', gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        }}>
          {guide.steps.map((step, i) => (
            <li key={step.title} style={{
              background: 'var(--slab-hi)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius)', padding: 6, overflow: 'hidden',
            }}>
              {/* The step, pictured. Reuses this tool's own stills rather than
                  introducing a second set to keep in step with the first. */}
              <img src={exampleImage(tool.id, i + 1)} alt="" aria-hidden
                width={640} height={360} loading="lazy" decoding="async"
                style={{
                  width: '100%', aspectRatio: '16 / 9', objectFit: 'cover',
                  borderRadius: 5, border: '1px solid var(--line-inner)', display: 'block',
                }} />
              <div style={{ padding: '12px 12px 8px' }}>
              <span className="tabular" style={{
                display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--peri)',
                marginBottom: 8, letterSpacing: '.08em',
              }}>{String(i + 1).padStart(2, '0')}</span>
              <h3 style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 5 }}>{step.title}</h3>
              <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--steel)' }}>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <Block label="What this is">{guide.about}</Block>

        <div style={{ display: 'grid', gap: 22, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <Block label="What it needs">{guide.needs}</Block>
          <Block label="How long">{guide.takes}</Block>
        </div>

        {cheapest && (
          <Block label="What it costs">
            From <b>₦{cheapest.naira.toLocaleString()}</b> ({cheapest.credits} credit
            {cheapest.credits === 1 ? '' : 's'}) for {cheapest.label}. The price shown on the
            button is the whole cost — nothing is added afterwards, and a failed job is
            refunded automatically.
          </Block>
        )}

        {guide.panel && <Block label="The panel on the left">{guide.panel}</Block>}

        {guide.tips.length > 0 && (
          <section>
            <Label>Getting a better result</Label>
            {/* Tailwind's preflight strips list markers; this list needs them. */}
            <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 7, listStyle: 'disc' }}>
              {guide.tips.map((tip) => (
                <li key={tip} style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--paper-ink)' }}>{tip}</li>
              ))}
            </ul>
          </section>
        )}

        <button type="button" onClick={onClose} className="btn btn-primary"
          style={{ marginTop: 26 }}>
          Start using {tool.label}
        </button>
      </div>
    </div>
  );
}

/**
 * Whether this account has read a given tool's guide.
 *
 * Kept beside the dialog rather than in the host so the key format has one
 * owner. Storage can throw in a private window; a throw means "not seen", which
 * shows the guide — the safe direction to fail in.
 */
export function useGuideOnFirstVisit(toolId: string, onOpen: () => void) {
  const key = `meerah.guide.seen.${toolId}`;

  const markSeen = useCallback(() => {
    try { localStorage.setItem(key, '1'); } catch { /* private window */ }
  }, [key]);

  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(key) === '1'; } catch { /* private window */ }
    if (!seen) onOpen();
    // `onOpen` is a setter from the host and stable enough; the key is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return markSeen;
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <Label>{label}</Label>
      <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--paper-ink)' }}>{children}</p>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase',
      fontWeight: 500, marginBottom: 6, color: 'var(--fog)',
    }}>{children}</h3>
  );
}
