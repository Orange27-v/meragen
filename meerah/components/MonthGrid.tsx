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
 * Thursday with a failed post read differently at a glance.
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="muted" style={{
            fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase',
            textAlign: 'center', fontWeight: 500,
          }}>{day}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} />;
          const dayPosts = byDay.get(day.toDateString()) ?? [];
          const isToday = day.toDateString() === today;
          const isSelected = selected?.toDateString() === day.toDateString();

          return (
            <button key={day.toISOString()} type="button"
              onClick={() => onPickDay(isSelected ? null : day)}
              aria-pressed={isSelected}
              aria-label={`${day.toDateString()}, ${dayPosts.length} post${dayPosts.length === 1 ? '' : 's'}`}
              style={{
                minHeight: 58, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'flex-start', gap: 3, padding: '6px 2px', font: 'inherit',
                cursor: 'pointer', borderRadius: 'var(--radius-tag)',
                border: `1px solid ${isSelected ? 'var(--obsidian)' : 'var(--line)'}`,
                background: isSelected ? 'var(--ink-deep)' : 'var(--snow)',
              }}>
              <span className="tabular" style={{
                fontSize: 12.5,
                fontWeight: isToday ? 700 : 400,
                // Today is marked by weight and an underline rather than a
                // second colour — the palette carries one accent only.
                borderBottom: isToday ? '1.5px solid var(--chalk)' : '1.5px solid transparent',
                lineHeight: 1.3,
              }}>{day.getDate()}</span>

              <span style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                {dayPosts.slice(0, 4).map((post) => (
                  <span key={post.id} aria-hidden style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: statusColour(post.status),
                  }} />
                ))}
                {dayPosts.length > 4 && (
                  <span className="muted" style={{ fontSize: 9 }}>+{dayPosts.length - 4}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
