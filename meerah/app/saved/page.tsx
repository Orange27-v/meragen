'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getToken, clearToken, ApiError, type BrandAsset, type BrandAssetType } from '@/lib/api';

/**
 * `/saved` — characters, cloned voices and brand kits.
 *
 * This is the stickiness layer made visible. The point of the page is that a
 * second visit is faster than the first, which is what makes leaving expensive.
 * Items are ordered by how often they are reused, so what someone reaches for
 * constantly sits first.
 */

const KINDS: Array<{ id: BrandAssetType | 'all'; label: string; empty: string }> = [
  { id: 'all',           label: 'Everything',  empty: 'Nothing saved yet.' },
  { id: 'character',     label: 'Characters',  empty: 'Save a face from any result and reuse it in every video.' },
  { id: 'voice_profile', label: 'Voices',      empty: 'Your cloned voices will live here once MyVoice is ready.' },
  { id: 'template',      label: 'Brand kits',  empty: 'Save your colours, logo and fonts so every advert matches.' },
];

/**
 * Everything this account has saved.
 *
 * The point of this page is that the second visit is faster than the first —
 * that is what makes leaving expensive (planning.md §7 Phase 9).
 */
export default function SavedPage() {
  const router = useRouter();
  const [items, setItems] = useState<BrandAsset[]>([]);
  const [kind, setKind] = useState<BrandAssetType | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { items: found } = await api.brand.list(kind === 'all' ? undefined : kind);
      setItems(found);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        router.replace('/signin');
        return;
      }
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [kind, router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/signin');
      return;
    }
    void load();
  }, [load, router]);

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
    <>
      <header className="topbar">
        <div className="shell topbar-in">
          <Link className="wordmark" href="/studio"><span className="mark" />Meerah</Link>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '.5rem' }}>
            <Link className="btn btn-ghost" href="/studio">Studio</Link>
            <Link className="btn btn-ghost" href="/create">All tools</Link>
          </div>
        </div>
      </header>

      <main className="shell" style={{ paddingBlock: '2rem 4rem' }}>
        <h1 className="display" style={{ fontSize: '1.8rem', marginBottom: '.5rem' }}>Saved</h1>
        <p className="muted" style={{ marginBottom: '1.5rem' }}>
          Your characters, voices and brand kits. Reuse them so every video looks like you.
        </p>

        {error && <div className="alert">{error}</div>}

        <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {KINDS.map((option) => (
            <button key={option.id} type="button" onClick={() => { setLoading(true); setKind(option.id); }}
              style={{
                padding: '.5rem .9rem', borderRadius: 2, font: 'inherit', fontWeight: 600, fontSize: '.85rem',
                cursor: 'pointer',
                border: `1px solid ${kind === option.id ? 'var(--marigold)' : 'var(--line)'}`,
                background: kind === option.id ? 'rgba(255,176,32,.08)' : 'transparent',
                color: kind === option.id ? 'var(--chalk)' : 'var(--muted)',
              }}>
              {option.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : items.length === 0 ? (
          <div className="card"><p className="muted">{active.empty}</p></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '1rem' }}>
            {items.map((asset) => (
              <div key={asset.id} className="card" style={{ padding: '.75rem' }}>
                <div style={{
                  aspectRatio: '1', borderRadius: 2, overflow: 'hidden', marginBottom: '.6rem',
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
      </main>
    </>
  );
}

const linkButton = {
  background: 'none', border: 0, padding: 0, font: 'inherit', fontSize: '.8rem',
  color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline',
} as const;
