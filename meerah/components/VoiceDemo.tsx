'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * The page's thesis, running live: one sentence, five Nigerian languages.
 *
 * This is the claim no global competitor can make, so it moves on its own above
 * the fold rather than sitting in a feature list further down.
 */
const LINES = [
  { text: 'Na your face. Na your voice. Na your own tongue.', label: 'Nigerian Pidgin' },
  { text: 'Ojú rẹ. Ohùn rẹ. Èdè rẹ.', label: 'Yorùbá' },
  { text: 'Ihu gị. Olu gị. Asụsụ gị.', label: 'Igbo' },
  { text: 'Fuskarka. Muryarka. Harshenka.', label: 'Hausa' },
  { text: 'Your face. Your voice. Your language.', label: 'English' },
] as const;

const BARS = 44;

export default function VoiceDemo() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [auto, setAuto] = useState(true);
  const still = useRef(false);

  // Shaped like a spoken phrase — quiet at the edges, busiest in the middle —
  // so it reads as speech rather than a repeating pattern.
  const bars = useMemo(
    () =>
      Array.from({ length: BARS }, (_, i) => {
        const envelope = Math.sin((i / (BARS - 1)) * Math.PI);
        return { height: 18 + envelope * (35 + ((i * 37) % 45)), delay: i * 0.045 };
      }),
    [],
  );

  useEffect(() => {
    still.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still.current || !auto) return;

    const timer = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((current) => (current + 1) % LINES.length);
        setVisible(true);
      }, 180);
    }, 3400);
    return () => window.clearInterval(timer);
  }, [auto]);

  function pick(next: number) {
    setAuto(false);
    setIndex(next);
    setVisible(true);
  }

  return (
    <div className="demo" id="voice">
      <div className="demo-head">
        <span className="demo-label">MyVoice</span>
        <span className="rec"><span className="rec-dot" />5-second sample</span>
      </div>

      <div className="wave" aria-hidden="true">
        {bars.map((bar, i) => (
          <i key={i} style={{ ['--h' as string]: `${bar.height.toFixed(0)}%`, animationDelay: `${bar.delay.toFixed(2)}s` }} />
        ))}
      </div>

      <p className="demo-line" style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(6px)', transition: 'opacity .18s ease, transform .18s ease' }}>
        {LINES[index].text}
      </p>
      <p className="demo-lang">{LINES[index].label}</p>

      <div className="lang-pills" role="group" aria-label="Preview language">
        {LINES.map((line, i) => (
          <button key={line.label} type="button" className="pill"
            aria-pressed={i === index} onClick={() => pick(i)}>
            {line.label.replace('Nigerian ', '')}
          </button>
        ))}
      </div>
    </div>
  );
}
