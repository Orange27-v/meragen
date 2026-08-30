'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Sparkles, Video, Image as ImageIcon, Mic, Wand2, Check, X, Camera, UserCheck,
  AlertCircle, SlidersHorizontal,
} from 'lucide-react';
import { api, type PricedModel } from '@/lib/api';
import { Skeleton } from '@/components/ui/page';

/**
 * The model catalogue.
 *
 * A picker over several hundred rows is a search problem, not a browsing one,
 * so the search field takes focus on open and the category rail is a filter
 * beside it rather than the primary route in.
 *
 * The design pass changed four things:
 *   · Five different near-black fills (#0e1015, #111318, #14161c, #1a1d25,
 *     #0b0c10) became the two surfaces the rest of the product uses.
 *   · The 224px category rail had no mobile behaviour, so on a phone it ate
 *     most of the dialog. It is a horizontal filter row under 768px.
 *   · Loading was a spinning icon and a sentence; it is now the grid it is
 *     about to become, so nothing jumps when the rows arrive.
 *   · The counts on the categories ("140+", "220+") were hardcoded and did not
 *     match the catalogue. They are counted from the loaded data.
 */

interface Entry {
  id: string;
  name: string;
  group: string;
  credits: number;
  naira: number;
  badge?: 'TOP' | 'NEW' | 'FAST';
}

type CategoryId = 'all' | 'video' | 'image' | 'cinema' | 'audio' | 'edit' | 'face';

const CATEGORIES: Array<{ id: CategoryId; label: string; icon: typeof Sparkles }> = [
  { id: 'all',    label: 'All models',   icon: Sparkles },
  { id: 'video',  label: 'Video',        icon: Video },
  { id: 'image',  label: 'Image',        icon: ImageIcon },
  { id: 'cinema', label: 'Cinematic',    icon: Camera },
  { id: 'audio',  label: 'Voice & music', icon: Mic },
  { id: 'edit',   label: 'Edit & relight', icon: Wand2 },
  { id: 'face',   label: 'Face & character', icon: UserCheck },
];

/** One place that decides what belongs in a category, used for both the filter
 *  and the counts beside each one. */
function inCategory(entry: Entry, category: CategoryId): boolean {
  const id = entry.id.toLowerCase();
  const group = entry.group.toLowerCase();
  const name = entry.name.toLowerCase();

  switch (category) {
    case 'all':    return true;
    case 'video':  return group.includes('video') || id.includes('video') || id.includes('kling') || id.includes('minimax');
    case 'image':  return group.includes('image') || id.includes('flux') || id.includes('recraft') || id.includes('sd');
    case 'cinema': return name.includes('cinema') || id.includes('cinema') || id.includes('director');
    case 'audio':  return group.includes('audio') || id.includes('voice') || id.includes('sound');
    case 'edit':   return group.includes('edit') || id.includes('layer') || id.includes('inpaint');
    case 'face':   return group.includes('face') || id.includes('lip') || id.includes('actor');
    default:       return true;
  }
}

export default function ModelPicker({
  open,
  onOpenChange,
  onPick,
  activeModel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (modelId: string, modelName?: string, credits?: number, naira?: number) => void;
  activeModel?: string;
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryId>('all');
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setFailed(false);
    setLoading(true);
    try {
      const [{ groups }, { modelCatalogue }] = await Promise.all([
        api.models(),
        import('@meerah/studio'),
      ]);

      const priced = new Map<string, PricedModel>();
      for (const group of groups) {
        for (const model of group.models) priced.set(model.modelId, model);
      }

      const mapped: Entry[] = modelCatalogue()
        .filter((model) => priced.has(model.id))
        .map((model) => {
          const p = priced.get(model.id)!;
          const lower = model.name.toLowerCase();
          let badge: Entry['badge'];
          if (lower.includes('pro') || lower.includes('cinema')) badge = 'TOP';
          else if (lower.includes('v4') || lower.includes('2.0')) badge = 'NEW';
          else if (lower.includes('turbo') || lower.includes('flash')) badge = 'FAST';

          return {
            id: model.id,
            name: model.name,
            group: model.group || 'General',
            credits: p.credits,
            naira: p.naira,
            badge,
          };
        })
        .sort((a, b) => a.naira - b.naira);

      setEntries(mapped);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && !entries && !failed) void load();
  }, [open, entries, failed, load]);

  // Escape closes; focus lands in the search field, which is what you came for.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false); };
    window.addEventListener('keydown', onKey);
    const focus = setTimeout(() => searchRef.current?.focus(), 40);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(focus);
    };
  }, [open, onOpenChange]);

  // The page behind a modal must not scroll under it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const counts = useMemo(() => {
    const result = {} as Record<CategoryId, number>;
    for (const c of CATEGORIES) result[c.id] = entries ? entries.filter((e) => inCategory(e, c.id)).length : 0;
    return result;
  }, [entries]);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const query = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (query && !(
        entry.name.toLowerCase().includes(query) ||
        entry.id.toLowerCase().includes(query) ||
        entry.group.toLowerCase().includes(query)
      )) return false;
      return inCategory(entry, category);
    });
  }, [entries, search, category]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose a model"
      onClick={() => onOpenChange(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full max-h-[min(46rem,92dvh)] w-full max-w-5xl flex-col overflow-hidden
                   rounded-xl border border-edge bg-surface-overlay shadow-modal"
      >
        {/* ---------- Header: title, search, close ---------- */}
        <header className="shrink-0 border-b border-edge-subtle px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-ink-primary">Choose a model</h2>
              <p className="mt-0.5 truncate text-xs text-ink-tertiary">
                Every rate is the exact Naira price you pay. Failed renders are refunded.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="icon-btn icon-btn-bordered shrink-0"
              aria-label="Close"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="relative mt-3">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-tertiary"
              aria-hidden
            />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, vendor or task…"
              aria-label="Search models"
              className="pl-9"
            />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* ---------- Categories: a rail on desktop, a scrolling row on a phone ---------- */}
          <nav
            aria-label="Model categories"
            className="shrink-0 border-b border-edge-subtle p-2 md:w-56 md:border-b-0 md:border-r md:p-3"
          >
            <p className="section-title hidden px-2 pb-2 md:block">Categories</p>
            <div className="flex gap-1 overflow-x-auto scrollbar-none md:flex-col md:overflow-visible">
              {CATEGORIES.map((item) => {
                const Icon = item.icon;
                const active = category === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategory(item.id)}
                    aria-pressed={active}
                    className={`flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2.5
                                text-sm font-medium transition md:w-full md:justify-between
                                ${active
                                  ? 'bg-mint-wash text-mint'
                                  : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'}`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {item.label}
                    </span>
                    {entries && (
                      <span className={`text-xs tabular-nums ${active ? 'text-mint' : 'text-ink-disabled'}`}>
                        {counts[item.id]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* ---------- Results ---------- */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {loading && (
              <div
                className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
                role="status"
                aria-label="Loading models"
              >
                {Array.from({ length: 9 }, (_, i) => (
                  <div key={i} className="rounded-lg border border-edge-subtle bg-surface-raised p-3.5">
                    <Skeleton className="h-2.5 w-16" />
                    <Skeleton className="mt-2.5 h-4 w-3/4" />
                    <Skeleton className="mt-1.5 h-2.5 w-1/2" />
                    <Skeleton className="mt-4 h-3.5 w-24" />
                  </div>
                ))}
              </div>
            )}

            {failed && (
              <div className="empty border-solid">
                <span className="empty-icon bg-danger-wash text-danger">
                  <AlertCircle className="size-5" aria-hidden />
                </span>
                <h3 className="empty-title">The catalogue did not load</h3>
                <p className="empty-body">
                  This is usually the connection rather than your account. Nothing has been charged.
                </p>
                <div className="empty-actions">
                  <button type="button" onClick={() => void load()} className="btn btn-primary">
                    Try again
                  </button>
                </div>
              </div>
            )}

            {!loading && !failed && filtered.length === 0 && (
              <div className="empty border-solid">
                <span className="empty-icon">
                  <SlidersHorizontal className="size-5" aria-hidden />
                </span>
                <h3 className="empty-title">No models match</h3>
                <p className="empty-body">
                  {search
                    ? <>Nothing matches “{search}” in this category.</>
                    : <>This category has nothing in it yet.</>}
                </p>
                <div className="empty-actions">
                  {search && (
                    <button type="button" onClick={() => setSearch('')} className="btn btn-secondary">
                      Clear search
                    </button>
                  )}
                  {category !== 'all' && (
                    <button type="button" onClick={() => setCategory('all')} className="btn btn-ghost">
                      Show all models
                    </button>
                  )}
                </div>
              </div>
            )}

            {!loading && !failed && filtered.length > 0 && (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((model) => {
                  const selected = activeModel === model.id;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        onPick(model.id, model.name, model.credits, model.naira);
                        onOpenChange(false);
                      }}
                      className={`group flex flex-col rounded-lg border p-3.5 text-left transition
                                  ${selected
                                    ? 'border-mint bg-mint-wash'
                                    : 'border-edge-subtle bg-surface-raised hover:border-edge-strong hover:bg-surface-hover'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="section-title truncate">{model.group}</span>
                        {model.badge === 'TOP' && <span className="badge badge-warn">Top</span>}
                        {model.badge === 'NEW' && <span className="badge badge-accent">New</span>}
                        {model.badge === 'FAST' && <span className="badge">Fast</span>}
                      </div>

                      <h3 className="mt-1.5 truncate text-base font-medium text-ink-primary">
                        {model.name}
                      </h3>
                      <p className="truncate text-xs text-ink-disabled">{model.id}</p>

                      <div className="mt-auto flex items-center justify-between gap-2 pt-3.5">
                        <span className="text-sm tabular-nums">
                          <span className="font-semibold text-ink-primary">
                            ₦{model.naira.toLocaleString()}
                          </span>
                          <span className="ml-1.5 text-xs text-ink-tertiary">
                            {model.credits} credits
                          </span>
                        </span>
                        {selected ? (
                          <span className="flex size-5 items-center justify-center rounded-full bg-mint text-mint-ink">
                            <Check className="size-3 stroke-[3]" aria-hidden />
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-ink-disabled transition group-hover:text-mint">
                            Select
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <footer
          className="flex shrink-0 items-center justify-between gap-3 border-t border-edge-subtle
                     px-4 py-2.5 text-xs text-ink-tertiary sm:px-5"
        >
          <span className="truncate">Sorted by price, cheapest first.</span>
          <span className="shrink-0 tabular-nums">
            {entries ? `${filtered.length.toLocaleString()} of ${entries.length.toLocaleString()}` : '—'}
          </span>
        </footer>
      </div>
    </div>
  );
}
