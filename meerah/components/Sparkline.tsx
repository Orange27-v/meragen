'use client';

import { useId, useState } from 'react';

export interface Point { date: string; value: number }

/**
 * A single-series trend, with a crosshair and tooltip.
 *
 * One series, so one hue and no legend — the title names it. The mark colour is
 * the validated chart step (var(--ember)), not the brighter brand accent: that one is
 * for buttons and text, which is a different job with different contrast rules.
 */
export default function Sparkline({
  points, label, format, height = 90,
}: {
  points: Point[];
  label: string;
  format: (value: number) => string;
  height?: number;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) return <p className="muted" style={{ fontSize: '.8rem' }}>No data yet.</p>;

  const width = 100;
  const max = Math.max(...points.map((p) => p.value), 1);
  const step = points.length > 1 ? width / (points.length - 1) : width;

  const x = (i: number) => i * step;
  const y = (value: number) => height - (value / max) * (height - 10) - 4;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`).join(' ');
  const area = `${line} L ${x(points.length - 1)} ${height} L 0 ${height} Z`;

  const active = hover !== null ? points[hover] : null;
  const total = points.reduce((sum, p) => sum + p.value, 0);

  return (
    <figure style={{ margin: 0 }}>
      <figcaption style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.4rem' }}>
        <span className="muted" style={{ fontSize: '.72rem', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 600 }}>
          {label}
        </span>
        <span className="tabular" style={{ fontWeight: 700, fontSize: '.95rem' }}>
          {active ? format(active.value) : format(total)}
        </span>
      </figcaption>

      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img"
        aria-label={`${label}: ${format(total)} over ${points.length} days`}
        style={{ width: '100%', height, display: 'block', cursor: 'crosshair' }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - box.left) / box.width;
          setHover(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))));
        }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ember)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--ember)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={area} fill={`url(#${gradientId})`} />
        {/* 2px line, scaled for the non-uniform viewBox. */}
        <path d={line} fill="none" stroke="var(--ember)" strokeWidth={2} vectorEffect="non-scaling-stroke"
          strokeLinejoin="round" strokeLinecap="round" />

        {hover !== null && (
          <>
            <line x1={x(hover)} y1={0} x2={x(hover)} y2={height}
              stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            {/* Surface ring so the marker reads against the line beneath it. */}
            <circle cx={x(hover)} cy={y(points[hover].value)} r={4}
              fill="var(--ember)" stroke="var(--surface)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>

      <div className="muted" style={{ fontSize: '.7rem', display: 'flex', justifyContent: 'space-between', marginTop: '.25rem' }}>
        <span>{active ? new Date(active.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : points[0].date.slice(5)}</span>
        <span>{active ? '' : points[points.length - 1].date.slice(5)}</span>
      </div>
    </figure>
  );
}
