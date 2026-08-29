'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type PricedModel } from '@/lib/api';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The whole catalogue, for people who want it.
 *
 * Everywhere else in the product a customer picks a quality — Draft, HD,
 * Studio — and never learns what ran underneath. That is deliberate: a vendor
 * model name means nothing to someone deciding whether a video is worth ₦300,
 * and the names change under us.
 *
 * This drawer is the exception, and it is opt-in. Someone who opens a list
 * labelled "Advanced" has asked to see the machinery, so they get real names.
 *
 * Two sources are joined here, and neither knows about the other:
 *   · the server prices by model id and holds no names
 *   · the studio catalogue holds names and controls, and no prices
 *
 * The join is also the filter. A model the server can sell but this UI cannot
 * drive would submit a payload with the wrong shape; a model the UI knows but
 * the server has not priced would quote nothing. Only the intersection is
 * offered, so nothing in this list can fail on submit for a reason we already
 * knew about.
 */
interface Entry {
  id: string;
  name: string;
  group: string;
  credits: number;
  naira: number;
}

export default function ModelPicker({
  open, onOpenChange, onPick, activeModel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (modelId: string) => void;
  activeModel?: string;
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      // The catalogue lives in the studio package, which the tool page has
      // already loaded — importing it here costs nothing extra, and importing
      // it eagerly would drag megabytes onto every other page.
      const [{ groups }, { modelCatalogue }] = await Promise.all([
        api.models(),
        import('@meerah/studio'),
      ]);

      const priced = new Map<string, PricedModel>();
      for (const group of groups) for (const model of group.models) priced.set(model.modelId, model);

      setEntries(
        modelCatalogue()
          .filter((model) => priced.has(model.id))
          .map((model) => ({
            id: model.id,
            name: model.name,
            group: model.group,
            credits: priced.get(model.id)!.credits,
            naira: priced.get(model.id)!.naira,
          }))
          .sort((a, b) => a.naira - b.naira),
      );
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => { if (open && !entries && !failed) void load(); }, [open, entries, failed, load]);

  const grouped = useMemo(() => {
    const byGroup = new Map<string, Entry[]>();
    for (const entry of entries ?? []) {
      byGroup.set(entry.group, [...(byGroup.get(entry.group) ?? []), entry]);
    }
    return [...byGroup.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [entries]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={`Search ${entries ? entries.length : ''} models…`.replace('  ', ' ')} />
      <CommandList>
        {!entries && !failed && (
          <div className="space-y-1.5 p-3" aria-label="Loading models">
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        )}

        {failed && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-[var(--paper-ink)]">Could not load the catalogue.</p>
            <button type="button" onClick={() => void load()}
              className="mt-2 text-[13px] text-[var(--lilac)] hover:underline">
              Try again
            </button>
          </div>
        )}

        {entries && <CommandEmpty>Nothing matches that.</CommandEmpty>}

        {grouped.map(([group, models]) => (
          <CommandGroup key={group} heading={`${group} · ${models.length}`}>
            {models.map((model) => (
              <CommandItem
                key={model.id}
                value={`${model.name} ${model.group} ${model.id}`}
                onSelect={() => { onPick(model.id); onOpenChange(false); }}
              >
                <span className="min-w-0 flex-1 truncate">
                  {model.name}
                  {model.id === activeModel && (
                    <span className="ml-2 text-[11px] text-[var(--lilac)]">in use</span>
                  )}
                </span>
                <span className="tabular-nums text-[13px] font-semibold text-[var(--chalk)]">
                  ₦{model.naira.toLocaleString()}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>

      <p className="px-4 py-3 text-[11px] leading-relaxed text-[var(--fog)]">
        These are the engines behind the quality tiers. Prices are live and already
        include everything — nothing is added afterwards, and a failed job is refunded.
      </p>
    </CommandDialog>
  );
}
