'use client';

import { useMemo } from 'react';
import type { PlannedPost } from '@/lib/api';

/**
 * The month, as a month.
 *
 * The page is called Post Planner and its job is answering "what is my week
 * like" — but it showed a flat list, which makes you count dates in your head to
 * see the gap you meant to fill. A grid answers it by shape: a thin week is
 * visible before you read a single word.
 *
 * Days carry a dot per post, coloured by state, so an empty Thursday and a
 * Thursday with a failed post read differently at a glance. The colours are
 * never the only signal — the list beneath carries the same states as labelled
 * badges, and the legend under the grid names each dot.
 */
export default function MonthGrid({
  month, posts, statusColour, onPickDay, selected,
}: {
  /** Any date inside the month to show. */
  month: Date;
  posts: PlannedPost[];
  statusColour: (status: PlannedPost['status']) => string;
  onPickDay: (day: Date | null) => void;
  selected: Date | null;
}) {
  const { cells, byDay } = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7;     // weeks start Monday
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

    const grid: Array<Date | null> = [];
    for (let i = 0; i < startOffset; i += 1) grid.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      grid.push(new Date(month.getFullYear(), month.getMonth(), d));
    }
    while (grid.length % 7 !== 0) grid.push(null);

    const map = new Map<string, PlannedPost[]>();
    for (const post of posts) {
      const key = new Date(post.scheduledFor).toDateString();
      map.set(key, [...(map.get(key) ?? []), post]);
    }
    return { cells: grid, byDay: map };
  }, [month, posts]);

  const today = new Date().toDateString();

  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="section-title text-center">
            <span className="sm:hidden">{day[0]}</span>
            <span className="hidden sm:inline">{day}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} />;

          const dayPosts = byDay.get(day.toDateString()) ?? [];
          const isToday = day.toDateString() === today;
          const isSelected = selected?.toDateString() === day.toDateString();

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onPickDay(isSelected ? null : day)}
              aria-pressed={isSelected}
              aria-label={`${day.toDateString()}, ${dayPosts.length} post${dayPosts.length === 1 ? '' : 's'}`}
              className={`flex min-h-[3.25rem] flex-col items-center gap-1 rounded-md border px-1 py-1.5
                          transition
                          ${isSelected
                            ? 'border-mint bg-mint-wash'
                            : 'border-edge-subtle bg-surface-inset hover:border-edge-strong hover:bg-surface-hover'}`}
            >
              <span
                className={`flex size-5 items-center justify-center rounded-full text-xs tabular-nums
                            ${isToday
                              ? 'bg-ink-primary font-semibold text-surface-base'
                              : isSelected ? 'font-medium text-mint' : 'text-ink-secondary'}`}
              >
                {day.getDate()}
              </span>

              <span className="flex flex-wrap justify-center gap-[3px]">
                {dayPosts.slice(0, 4).map((post) => (
                  <span
                    key={post.id}
                    aria-hidden
                    className="size-[5px] rounded-full"
                    style={{ background: statusColour(post.status) }}
                  />
                ))}
                {dayPosts.length > 4 && (
                  <span className="text-badge leading-none text-ink-tertiary">
                    +{dayPosts.length - 4}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
