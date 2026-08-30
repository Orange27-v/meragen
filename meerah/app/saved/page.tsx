'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bookmark, MoreHorizontal, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { api, ApiError, type BrandAsset, type BrandAssetType } from '@/lib/api';
import { useSession } from '@/lib/useSession';
import { exampleImage } from '@/lib/tools';
import DashboardShell from '@/components/DashboardShell';
import { Page, PageHeader, Segmented, EmptyState, SkeletonCards } from '@/components/ui/page';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * `/saved` — characters, cloned voices and brand kits.
 *
 * This is the stickiness layer made visible. The point of the page is that a
 * second visit is faster than the first, which is what makes leaving expensive.
 *
 * The design pass: the four filters were hand-styled buttons that appeared
 * again, differently, on the metrics page; both are now the shared segmented
 * control. Rename and Delete were two underlined links under every card —
 * permanently visible, and Delete sat one pixel from Rename. They are in a
 * per-item menu now, and the destructive one is marked as destructive.
 */

const KINDS: Array<{
  id: BrandAssetType | 'all';
  label: string;
  emptyTitle: string;
  empty: string;
  /** The tool whose stills illustrate this tab, and where its button goes. */
  from?: { tool: string; label: string };
}> = [
  {
    id: 'all', label: 'Everything',
    emptyTitle: 'Nothing saved yet',
    empty: 'Anything you keep from a result lands here, ready to reuse in the next one.',
    from: { tool: 'starmaker', label: 'Open Star Maker' },
  },
  {
    id: 'character', label: 'Characters',
    emptyTitle: 'No characters yet',
    empty: 'Save a face from any result and reuse it in every video, so every post shows the same person.',
    from: { tool: 'starmaker', label: 'Build a character' },
  },
  {
    id: 'voice_profile', label: 'Voices',
    emptyTitle: 'No voices yet',
    empty: 'Your cloned voices will live here once MyVoice is ready. Until then, SoundTrack makes the voiceover.',
    from: { tool: 'soundtrack', label: 'Open SoundTrack' },
  },
  {
    id: 'template', label: 'Brand kits',
    emptyTitle: 'No brand kits yet',
    empty: 'Save your colours, logo and fonts so every advert matches without you setting them again.',
    from: { tool: 'salesreel', label: 'Open Sales Reel' },
  },
];

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
    if (!window.confirm(`Delete “${asset.name}”? This cannot be undone.`)) return;
    try {
      await api.brand.remove(asset.id);
      setItems((current) => current.filter((a) => a.id !== asset.id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const active = KINDS.find((k) => k.id === kind)!;
  const options = useMemo(() => KINDS.map(({ id, label }) => ({ value: id, label })), []);

  return (
    <DashboardShell user={user} onSignOut={signOut} refreshUser={refresh}>
      <Page>
        <PageHeader
          title="Library"
          description="Your characters, voices and brand kits. Reuse them so every video looks like the same business made it."
          actions={
            <Segmented
              label="Filter library"
              options={options}
              value={kind}
              onChange={(next) => { setLoading(true); setKind(next); }}
            />
          }
        />

        {error && (
          <div className="alert mb-4">
            <AlertCircle className="mt-px size-4 shrink-0 text-danger" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <SkeletonCards count={8} />
        ) : items.length === 0 ? (
          <EmptyTab kind={active} />
        ) : (
          <div
            className="grid gap-4 rise-stagger"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
          >
            {items.map((asset) => (
              <article key={asset.id} className="card card-tight card-hover group">
                <div className="aspect-square overflow-hidden rounded-md bg-surface-inset">
                  {asset.previewUrl ? (
                    /* Lazy and async: a grid of previews must not cost data for
                       rows nobody scrolls to. */
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.previewUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover transition duration-slow group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-ink-disabled">
                      <Bookmark className="size-5" aria-hidden />
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-start gap-1.5">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-medium text-ink-primary" title={asset.name}>
                      {asset.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-ink-tertiary">
                      {asset.usedCount > 0
                        ? `Used ${asset.usedCount} time${asset.usedCount === 1 ? '' : 's'}`
                        : 'Not used yet'}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="icon-btn size-7 shrink-0"
                        aria-label={`Actions for ${asset.name}`}
                      >
                        <MoreHorizontal className="size-4" aria-hidden />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-40 rounded-lg border border-edge bg-surface-overlay p-1.5 shadow-modal"
                    >
                      <DropdownMenuItem
                        onSelect={() => void rename(asset)}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm
                                   text-ink-secondary focus:bg-surface-hover focus:text-ink-primary"
                      >
                        <Pencil className="size-4 text-ink-tertiary" aria-hidden />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => void remove(asset)}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm
                                   text-danger focus:bg-danger-wash focus:text-danger"
                      >
                        <Trash2 className="size-4" aria-hidden />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </article>
            ))}
          </div>
        )}
      </Page>
    </DashboardShell>
  );
}

/**
 * A tab with nothing in it — an invitation rather than a dead end.
 *
 * The stills are the same placeholder set the studios use, so there is one
 * folder of images to replace when we have real customer work.
 */
function EmptyTab({ kind }: { kind: (typeof KINDS)[number] }) {
  return (
    <EmptyState
      icon={<Bookmark className="size-5" aria-hidden />}
      title={kind.emptyTitle}
      body={
        <>
          {kind.empty}
          {kind.from && (
            <span className="mt-5 grid grid-cols-3 gap-2">
              {[1, 2, 3].map((n) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={n}
                  src={exampleImage(kind.from!.tool, n)}
                  alt=""
                  aria-hidden
                  width={640}
                  height={360}
                  loading="lazy"
                  decoding="async"
                  className="aspect-video w-full rounded-md border border-edge-subtle object-cover"
                />
              ))}
            </span>
          )}
        </>
      }
      actions={
        kind.from && (
          <Link href={`/create/${kind.from.tool}`} className="btn btn-primary">
            {kind.from.label}
          </Link>
        )
      }
    />
  );
}
