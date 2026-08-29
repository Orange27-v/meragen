'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ComponentType } from 'react';
import type { StudioProps } from '@meerah/studio';
import { api, type Tier } from '@/lib/api';
import { useSession } from '@/lib/useSession';
import { TOOLS, toolById } from '@/lib/tools';
import { GUIDES } from '@/lib/guides';
import DashboardShell from '@/components/DashboardShell';
import HowItWorks, { useGuideOnFirstVisit } from '@/components/studio/HowItWorks';


/**
 * The studio, for one tool.
 *
 * Each tool is loaded client-side only: they reach for `window` and
 * `localStorage` on mount, which server rendering does not provide, and loading
 * twelve studios eagerly would cost a phone several megabytes it never asked
 * for.
 *
 * The tool is a route segment rather than component state, so a tool can be
 * linked to, survives a refresh, and the back button does what it looks like it
 * does. It used to be `useState`, which meant none of those worked.
 */
type StudioExports = typeof import('@meerah/studio');
type StudioName = {
  [K in keyof StudioExports]: StudioExports[K] extends ComponentType<StudioProps> ? K : never;
}[keyof StudioExports];

/**
 * The tool copy the studios' empty state renders.
 *
 * The studios cannot import from `@/lib` — they are a separate package — and
 * duplicating the copy there would give customer-facing words two owners, which
 * is how they drift. So it is handed over at load time instead.
 */
const SHOWCASE = Object.fromEntries(
  TOOLS.map((tool) => [tool.id, {
    headline: GUIDES[tool.id]?.headline ?? tool.label,
    tagline: GUIDES[tool.id]?.tagline ?? tool.blurb,
    examples: GUIDES[tool.id]?.examples ?? [],
    kind: tool.kind,
  }]),
);

function studio(name: StudioName) {
  return dynamic(
    () => import('@meerah/studio').then((m) => {
      // Registered inside the same dynamic import the studio arrives on, so the
      // copy is in place before it mounts and the package still loads lazily.
      // A plain `import { setShowcase }` at the top of this file would drag the
      // whole barrel — models.js included — into the first load of every tool.
      m.setShowcase(SHOWCASE);
      return m[name];
    }),
    { ssr: false, loading: Loading },
  );
}

/** Loaded when it is opened, not when the page is. It costs cmdk plus the dialog
 *  primitives, and most visits never open it. */
const ModelPicker = dynamic(() => import('@/components/models/ModelPicker'), { ssr: false });

function Loading() {
  return <p className="muted" style={{ padding: 32 }}>Loading…</p>;
}

/** Tool id to the component that implements it. Kept apart from `lib/tools.ts`
 *  so the header can list tools without pulling any of them into the bundle. */
const COMPONENTS: Record<string, ComponentType<StudioProps>> = {
  videngine:  studio('VideoStudio'),
  vibereel:   studio('VibeMotionStudio'),
  shotdirect: studio('CinemaStudio'),
  snipreel:   studio('ClippingStudio'),
  pixcraft:   studio('ImageStudio'),
  patchup:    studio('LayersStudio'),
  talksync:   studio('LipSyncStudio'),
  bodydouble: studio('RecastStudio'),
  starmaker:  studio('AiInfluencerStudio'),
  salesreel:  studio('MarketingStudio'),
  soundtrack: studio('AudioStudio'),
  // Ours, not the fork's — so it is built on the shell's own components.
  myvoice: dynamic(() => import('@/components/voice/VoiceStudio'), { ssr: false, loading: Loading }),
};

export default function StudioHost({ toolId }: { toolId: string }) {
  const router = useRouter();
  const { token, user, loading, refresh, signOut } = useSession();
  /** The entry shape the forked studio cards already render. */
  const [guideOpen, setGuideOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [history, setHistory] = useState<Array<{
    id: string; url: string; prompt: string; model: string;
    duration?: number; timestamp: number;
  }>>([]);

  const tool = toolById(toolId) ?? TOOLS[0];

  // Each tool explains itself the first time it is opened, then stays quiet.
  // Closing the dialog is what marks it read, so a guide that was never seen —
  // a page loaded and abandoned — still shows up next time.
  const markGuideSeen = useGuideOnFirstVisit(tool.id, () => setGuideOpen(true));
  const closeGuide = useCallback(() => { setGuideOpen(false); markGuideSeen(); }, [markGuideSeen]);

  // Everything this account has ever made, so the work survives a refresh. The
  // studios have always accepted these props; nothing ever passed them, so a
  // reload wiped the page clean.
  //
  // The studios' cards were written against the upstream entry shape, so the
  // API rows are translated here rather than in twelve components. `model`
  // carries the quality name — the vendor id never leaves the server.
  const loadHistory = useCallback(() => {
    void api.history()
      .then(({ items }) => setHistory(items
        .filter((item) => item.outputs.length > 0)
        .map((item) => ({
          id: item.request_id,
          url: item.outputs[0],
          prompt: item.prompt,
          model: item.quality,
          duration: item.duration,
          timestamp: new Date(item.created_at).getTime(),
        }))))
      .catch(() => { /* the tool still works without it */ });
  }, []);

  useEffect(() => { if (token) loadHistory(); }, [token, loadHistory]);

  // The showcase sits inside the studio package, which cannot reach this state
  // directly. It asks by event, the same way the cost meter asks for the top-up
  // sheet.
  useEffect(() => {
    const show = () => setGuideOpen(true);
    const models = () => setModelsOpen(true);
    window.addEventListener('meerah:show-guide', show);
    window.addEventListener('meerah:pick-model', models);
    return () => {
      window.removeEventListener('meerah:show-guide', show);
      window.removeEventListener('meerah:pick-model', models);
    };
  }, []);

  useEffect(() => {
    void api.pricing().then(({ tiers: found }) => setTiers(found)).catch(() => {});
  }, []);

  if (loading || !token) {
    return <main className="auth-wrap"><p className="muted">Loading…</p></main>;
  }

  const Tool = COMPONENTS[tool.id] ?? COMPONENTS.videngine;

  return (
    <DashboardShell density="app" user={user} onSignOut={signOut} refreshUser={refresh}
      activeTool={tool.id} onPickTool={(id) => router.push(`/create/${id}`)}
      onShowGuide={() => setGuideOpen(true)}>
      {/* The studio components take the session token in the prop they already
          call `apiKey` — no component changes were needed. */}
      <Tool
        apiKey={token}
        historyItems={history}
        onGenerationComplete={() => { void refresh(); loadHistory(); }}
        onGenerationError={() => { void refresh(); }}
      />

      <HowItWorks tool={tool} tiers={tiers} open={guideOpen} onClose={closeGuide} />

      {/* The chosen model goes back to the rail as an event: the studio owns
          that state, and threading a setter up through eleven components to
          come back down again would be worse than a message. */}
      <ModelPicker
        open={modelsOpen}
        onOpenChange={setModelsOpen}
        onPick={(modelId) =>
          window.dispatchEvent(new CustomEvent('meerah:model-picked', { detail: { modelId } }))
        }
      />
    </DashboardShell>
  );
}
