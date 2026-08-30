import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The four pieces every signed-in page was rebuilding by hand.
 *
 * Saved, Post Planner and the metrics page each had their own page title, their
 * own filter buttons and their own "Loading…" line, written inline with
 * different sizes, weights and colours. Moving between them felt like moving
 * between three products. These are the shared versions; the styles live in
 * globals.css so the studio fork can use the same classes.
 */

/* -------------------------------------------------------------------------- */

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('page', className)}>{children}</div>;
}

/**
 * A page opens with its name, one line saying what it is for, and — on the
 * right — the actions that belong to the whole page rather than to one row.
 */
export function PageHeader({
  title, description, actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-sub">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/* -------------------------------------------------------------------------- */

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Shown after the label when the count is worth knowing before clicking. */
  count?: number;
}

/**
 * The one filter control in the product.
 *
 * `role="tablist"` with `aria-selected` rather than a row of buttons, so a
 * screen reader announces which of the four is current instead of reading four
 * identical-sounding buttons.
 */
export function Segmented<T extends string>({
  options, value, onChange, label,
}: {
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Names the group for assistive tech, e.g. "Filter saved items". */
  label: string;
}) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className="segmented-item"
        >
          {option.label}
          {option.count !== undefined && (
            <span className="ml-1.5 tabular-nums text-ink-tertiary">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Nothing here yet — said as an invitation.
 *
 * An empty page is the moment someone is least sure what this is for, so it
 * gets an icon, a sentence that names the thing that belongs here, and the
 * button that makes one. Never a grey "No data".
 */
export function EmptyState({
  icon, title, body, actions,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <h3 className="empty-title">{title}</h3>
      {body && <p className="empty-body">{body}</p>}
      {actions && <div className="empty-actions">{actions}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * A placeholder shaped like the thing it replaces.
 *
 * Loading used to be the word "Loading…" in grey, which tells you nothing about
 * what is coming and makes the page jump when it arrives. These hold the real
 * layout, so the content lands in place.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton', className)} aria-hidden {...props} />;
}

/** A grid of card-shaped placeholders, for a gallery that is still loading. */
export function SkeletonCards({ count = 8, aspect = 'aspect-square' }: { count?: number; aspect?: string }) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card card-tight">
          <Skeleton className={cn('w-full rounded-md', aspect)} />
          <Skeleton className="mt-3 h-3.5 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** Stacked row placeholders, for a list or table that is still loading. */
export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-2" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card card-tight flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-md" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </div>
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}
