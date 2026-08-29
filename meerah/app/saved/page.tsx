'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError, type BrandAsset, type BrandAssetType } from '@/lib/api';
import { useSession } from '@/lib/useSession';
import { exampleImage } from '@/lib/tools';
import DashboardShell from '@/components/DashboardShell';

/**
 * `/saved` — characters, cloned voices and brand kits.
 *
 * This is the stickiness layer made visible. The point of the page is that a
 * second visit is faster than the first, which is what makes leaving expensive.
 * Items are ordered by how often they are reused, so what someone reaches for
 * constantly sits first.
 */

/**
 * The tabs, and what each says when it holds nothing.
 *
 * An empty tab used to be one line of grey text in a card — the moment a
 * customer is least sure what this page is for is the moment it explained
 * least. Each now shows the kind of thing that belongs here, borrowed from the
 * tool that makes it, and points at that tool.
 */
const KINDS: Array<{
  id: BrandAssetType | 'all';
  label: string;
  empty: string;
  /** The tool whose stills illustrate this tab, and where its Make button goes. */
  from?: { tool: string; label: string };
}> = [
  { id: 'all',           label: 'Everything',  empty: 'Nothing saved yet. Anything you keep from a result lands here.',
    from: { tool: 'starmaker',  label: 'Open Star Maker' } },
  { id: 'character',     label: 'Characters',  empty: 'Save a face from any result and reuse it in every video, so every post shows the same person.',
    from: { tool: 'starmaker',  label: 'Build a character' } },
  { id: 'voice_profile', label: 'Voices',      empty: 'Your cloned voices will live here once MyVoice is ready. Until then, SoundTrack makes the voiceover.',
    from: { tool: 'soundtrack', label: 'Open SoundTrack' } },
  { id: 'template',      label: 'Brand kits',  empty: 'Save your colours, logo and fonts so every advert matches without you setting them again.',
    from: { tool: 'salesreel',  label: 'Open Sales Reel' } },
];

/**
 * Everything this account has saved.
 *
 * The point of this page is that the second visit is faster than the first —
 * that is what makes leaving expensive (planning.md §7 Phase 9).
 */
export default function SavedPage() {
  const { user, loading: authLoading, refresh, signOut } = useSession();
  const [items, setItems] = useState<BrandAsset[]>([]);
  const [kind, setKind] = useState<BrandAssetType | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { items: found } = await api.brand.list(kind === 'all' ? undefined : kind);
      setItems(found);
    } catch (err) {
      // The shell's session hook owns the sign-out path; a 401 here just means
      // there is nothing to show while it redirects.
      if (!(err instanceof ApiError && err.status === 401)) setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  async function rename(asset: BrandAsset) {
    const next = window.prompt('New name', asset.name);
    if (!next || next === asset.name) return;
    try {
      await api.brand.rename(asset.id, next);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(asset: BrandAsset) {
    if (!window.confirm(`Delete "${asset.name}"? This cannot be undone.`)) return;
    try {
      await api.brand.remove(asset.id);
      setItems((current) => current.filter((a) => a.id !== asset.id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const active = KINDS.find((k) => k.id === kind)!;

  return (
    <DashboardShell user={user} onSignOut={signOut} refreshUser={refresh}>
        <h1 className="display" style={{ fontSize: '1.8rem', marginBottom: '.5rem' }}>Saved</h1>
        <p className="muted" style={{ marginBottom: '1.5rem' }}>
          Your characters, voices and brand kits. Reuse them so every video looks like you.
        </p>

        {error && <div className="alert">{error}</div>}

        <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {KINDS.map((option) => (
            <button key={option.id} type="button" onClick={() => { setLoading(true); setKind(option.id); }}
              style={{
                padding: '.5rem .9rem', borderRadius: 'var(--radius-tag)', font: 'inherit', fontWeight: 600, fontSize: '.85rem',
                cursor: 'pointer',
                border: `1px solid ${kind === option.id ? 'var(--obsidian)' : 'var(--line)'}`,
                background: kind === option.id ? 'var(--ink-deep)' : 'transparent',
                color: kind === option.id ? 'var(--chalk)' : 'var(--muted)',
              }}>
              {option.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : items.length === 0 ? (
          <EmptyTab kind={active} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '1rem' }}>
            {items.map((asset) => (
              <div key={asset.id} className="card" style={{ padding: '.75rem' }}>
                <div style={{
                  aspectRatio: '1', borderRadius: 'var(--radius-tag)', overflow: 'hidden', marginBottom: '.6rem',
                  background: 'var(--ink-deep)', display: 'grid', placeItems: 'center',
                }}>
                  {asset.previewUrl ? (
                    /* Lazy and async: a grid of previews must not cost data
                       for rows nobody scrolls to. */
                    <img src={asset.previewUrl} alt="" loading="lazy" decoding="async"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span className="muted" style={{ fontSize: '.75rem' }}>No preview</span>
                  )}
                </div>

                <div style={{ fontWeight: 700, fontSize: '.9rem', wordBreak: 'break-word' }}>{asset.name}</div>
                <div className="muted" style={{ fontSize: '.75rem' }}>
                  {asset.usedCount > 0 ? `Used ${asset.usedCount} time${asset.usedCount === 1 ? '' : 's'}` : 'Not used yet'}
                </div>

                <div style={{ display: 'flex', gap: '.4rem', marginTop: '.6rem' }}>
                  <button type="button" onClick={() => void rename(asset)} style={linkButton}>Rename</button>
                  <button type="button" onClick={() => void remove(asset)} style={{ ...linkButton, color: 'var(--danger)' }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
    </DashboardShell>
  );
}

const linkButton = {
  background: 'none', border: 0, padding: 0, font: 'inherit', fontSize: '.8rem',
  color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline',
} as const;

/**
 * A tab with nothing in it — an invitation rather than a dead end.
 *
 * The stills are the same placeholder set the studios use, so there is one
 * folder of images to replace when we have real customer work.
 */
function EmptyTab({ kind }: { kind: (typeof KINDS)[number] }) {
  return (
    <div className="card" style={{ padding: 'var(--card-pad)' }}>
      <p style={{ fontSize: 'var(--text-body)', maxWidth: '46ch', lineHeight: 1.55 }}>{kind.empty}</p>

      {kind.from && (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '.6rem', margin: '1.25rem 0 1.1rem',
          }}>
            {[1, 2, 3].map((n) => (
              <img key={n} src={exampleImage(kind.from!.tool, n)} alt="" aria-hidden
                width={640} height={360} loading="lazy" decoding="async"
                style={{
                  width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block',
                  borderRadius: 'var(--radius)', border: '1px solid var(--line-inner)',
                }} />
            ))}
          </div>
          <Link href={`/create/${kind.from.tool}`} className="btn btn-primary">
            {kind.from.label}
          </Link>
        </>
      )}
    </div>
  );
}
