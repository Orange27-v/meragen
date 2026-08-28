'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ComponentType } from 'react';
import type { StudioProps } from '@meerah/studio';
import { getToken, clearToken, api, type User } from '@/lib/api';
import StudioShell, { type Tool } from '@/components/StudioShell';

/**
 * `/create` — the full studio.
 *
 * The tools are forked from Open-Generative-AI (MIT); the shell around them is
 * ours. Each tool is loaded client-side only: they reach for `window` and
 * `localStorage` on mount, which server rendering does not provide, and loading
 * twelve studios eagerly would cost a phone several megabytes it did not ask
 * for.
 */
type StudioExports = typeof import('@meerah/studio');
type StudioName = {
  [K in keyof StudioExports]: StudioExports[K] extends ComponentType<StudioProps> ? K : never;
}[keyof StudioExports];

function studio(name: StudioName) {
  return dynamic(() => import('@meerah/studio').then((m) => m[name]), { ssr: false, loading: Loading });
}

function Loading() {
  return <p className="muted" style={{ padding: 32 }}>Loading…</p>;
}

const TOOLS: Array<Tool & { component: ComponentType<StudioProps> }> = [
  { id: 'videngine', label: 'VidEngine', blurb: 'Text or photo to video', group: 'Video',
    component: studio('VideoStudio'), },
  { id: 'vibereel', label: 'Vibe Reel', blurb: 'One-tap motion presets', group: 'Video',
    component: studio('VibeMotionStudio'), },
  { id: 'shotdirect', label: 'ShotDirector', blurb: 'Describe a scene, get the shots', group: 'Video',
    component: studio('CinemaStudio'), },
  { id: 'snipreel', label: 'Snip Reel', blurb: 'Long video into short clips', group: 'Video',
    component: studio('ClippingStudio'), },

  { id: 'pixcraft', label: 'PixCraft', blurb: 'Product shots, flyers, thumbnails', group: 'Image',
    component: studio('ImageStudio'), },
  { id: 'patchup', label: 'Patch Up', blurb: 'Edit, replace, split into layers', group: 'Image',
    component: studio('LayersStudio'), },

  { id: 'talksync', label: 'TalkSync', blurb: 'Make a face speak your script', group: 'People',
    component: studio('LipSyncStudio'), },
  { id: 'bodydouble', label: 'Body Double', blurb: 'Swap the body, keep the face', group: 'People',
    component: studio('RecastStudio'), },
  { id: 'starmaker', label: 'Star Maker', blurb: 'A consistent face for your brand', group: 'People',
    component: studio('AiInfluencerStudio'), },

  { id: 'salesreel', label: 'Sales Reel', blurb: 'Ad creative for social', group: 'Selling',
    component: studio('MarketingStudio'), },
  { id: 'soundtrack', label: 'SoundTrack', blurb: 'Music and voiceover', group: 'Selling',
    component: studio('AudioStudio'), },

  { id: 'appshelf', label: 'App Shelf', blurb: 'Vote on what we build next', group: 'More',
    component: studio('AppsStudio'), },
];

const GROUPS = ['Video', 'Image', 'People', 'Selling', 'More'];

export default function CreatePage() {
  const router = useRouter();
  const [token, setTok] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [active, setActive] = useState('videngine');

  useEffect(() => {
    const stored = getToken();
    if (!stored) { router.replace('/signin'); return; }
    setTok(stored);
    void api.me().then(setUser).catch(() => {
      clearToken();
      router.replace('/signin');
    });
  }, [router]);

  if (!token) return <main className="auth-wrap"><p className="muted">Loading…</p></main>;

  const Tool = (TOOLS.find((t) => t.id === active) ?? TOOLS[0]).component;

  return (
    <StudioShell tools={TOOLS} groups={GROUPS} active={active} onSelect={setActive}
      credits={user?.creditBalance ?? null}>
      {/* The studio components take the session token in the prop they already
          call `apiKey` — no component changes were needed. */}
      <Tool apiKey={token} />
    </StudioShell>
  );
}
