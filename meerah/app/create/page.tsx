'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { StudioProps } from '@meerah/studio';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken, clearToken, api, type User } from '@/lib/api';

/**
 * The full studio, forked from Open-Generative-AI (MIT).
 *
 * Loaded client-side only: the components reach for `window` and `localStorage`
 * on mount, which server rendering does not provide.
 */
const TOOLS = {
  videngine:  studio('VideoStudio'),
  pixcraft:   studio('ImageStudio'),
  talksync:   studio('LipSyncStudio'),
  salesreel:  studio('MarketingStudio'),
  shotdirect: studio('CinemaStudio'),
  soundtrack: studio('AudioStudio'),
  patchup:    studio('LayersStudio'),
  snipreel:   studio('ClippingStudio'),
  vibereel:   studio('VibeMotionStudio'),
  bodydouble: studio('RecastStudio'),
  starmaker:  studio('AiInfluencerStudio'),
  appshelf:   studio('AppsStudio'),
} as const;

type ToolId = keyof typeof TOOLS;

/**
 * Product names, not the names the components were born with.
 *
 * Each one says what the tool does for the person using it — "Body Double"
 * lands where "RecastStudio" does not.
 */
const TABS: Array<{ id: ToolId; label: string; blurb: string; group: string }> = [
  { id: 'videngine',  label: 'VidEngine',    blurb: 'Text or photo to video',            group: 'Video' },
  { id: 'vibereel',   label: 'Vibe Reel',    blurb: 'One-tap motion presets',            group: 'Video' },
  { id: 'shotdirect', label: 'ShotDirector', blurb: 'Describe a scene, get the shots',   group: 'Video' },
  { id: 'snipreel',   label: 'Snip Reel',    blurb: 'Long video into short clips',       group: 'Video' },

  { id: 'pixcraft',   label: 'PixCraft',     blurb: 'Product shots, flyers, thumbnails', group: 'Image' },
  { id: 'patchup',    label: 'Patch Up',     blurb: 'Edit, replace, split into layers',  group: 'Image' },

  { id: 'talksync',   label: 'TalkSync',     blurb: 'Make a face speak your script',     group: 'People' },
  { id: 'bodydouble', label: 'Body Double',  blurb: 'Swap the body, keep the face',      group: 'People' },
  { id: 'starmaker',  label: 'Star Maker',   blurb: 'A consistent face for your brand',  group: 'People' },

  { id: 'salesreel',  label: 'Sales Reel',   blurb: 'Ad creative for social',            group: 'Selling' },
  { id: 'soundtrack', label: 'SoundTrack',   blurb: 'Music and voiceover',               group: 'Selling' },

  { id: 'appshelf',   label: 'App Shelf',    blurb: 'Vote on what we build next',        group: 'More' },
];

const GROUPS = ['Video', 'Image', 'People', 'Selling', 'More'];

type StudioExports = typeof import('@meerah/studio');
type StudioName = {
  [K in keyof StudioExports]: StudioExports[K] extends ComponentType<StudioProps> ? K : never;
}[keyof StudioExports];

/** Loads one studio client-side — they reach for `window` on mount. */
function studio(name: StudioName) {
  return dynamic(() => import('@meerah/studio').then((m) => m[name]), {
    ssr: false,
    loading: Loading,
  });
}

function Loading() {
  return <p className="muted" style={{ padding: '2rem' }}>Loading the studio…</p>;
}

export default function CreatePage() {
  const router = useRouter();
  const [token, setTok] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tool, setTool] = useState<ToolId>('videngine');

  useEffect(() => {
    const stored = getToken();
    if (!stored) {
      router.replace('/signin');
      return;
    }
    setTok(stored);
    void api.me().then(setUser).catch(() => {
      clearToken();
      router.replace('/signin');
    });
  }, [router]);

  if (!token) return <main className="auth-wrap"><p className="muted">Loading…</p></main>;

  const Tool = TOOLS[tool];

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-in" style={{ maxWidth: 1400 }}>
          <Link className="wordmark" href="/studio"><span className="mark" />Meerah</Link>
          <div className="balance">
            <span className="muted" style={{ fontSize: '.8rem', textTransform: 'uppercase', letterSpacing: '.12em' }}>
              Credits
            </span>
            <b>{user?.creditBalance.toLocaleString() ?? '—'}</b>
          </div>
          <Link className="btn btn-ghost" href="/calendar">Calendar</Link>
          <Link className="btn btn-ghost" href="/saved">Saved</Link>
          <Link className="btn btn-ghost" href="/studio">Simple mode</Link>
        </div>
      </header>

      <nav style={{ borderBottom: '1px solid var(--line)', background: 'var(--ink-deep)', overflowX: 'auto' }}>
        <div className="shell" style={{ maxWidth: 1400, display: 'flex', gap: '.25rem' }}>
          {GROUPS.map((group) => (
            <div key={group} style={{ display: 'flex', alignItems: 'center' }}>
              <span className="muted" style={{
                fontSize: '.68rem', letterSpacing: '.14em', textTransform: 'uppercase',
                padding: '0 .75rem 0 .25rem', opacity: .55, whiteSpace: 'nowrap',
              }}>
                {group}
              </span>
              {TABS.filter((tab) => tab.group === group).map((tab) => (
                <button key={tab.id} type="button" onClick={() => setTool(tab.id)}
                  title={tab.blurb}
                  style={{
                    padding: '.9rem .8rem', background: 'none', font: 'inherit', fontWeight: 600,
                    cursor: 'pointer', whiteSpace: 'nowrap', border: 0, fontSize: '.9rem',
                    borderBottom: `2px solid ${tool === tab.id ? 'var(--marigold)' : 'transparent'}`,
                    color: tool === tab.id ? 'var(--chalk)' : 'var(--muted)',
                  }}>
                  {tab.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </nav>

      {/* The studio components take the session token in the prop they already
          call `apiKey` — no component changes were needed. */}
      <Tool apiKey={token} />
    </>
  );
}
