'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Plus,
  Download,
  Bookmark,
  Check,
  Loader2,
  AlertCircle,
  ChevronDown,
  Copy,
  Lightbulb,
  RectangleHorizontal,
  Gauge,
  Timer,
  X,
  ArrowRight,
} from 'lucide-react';
import { api, ApiError, type Tier, type GenerationResult } from '@/lib/api';
import { useSession } from '@/lib/useSession';
import DashboardShell from '@/components/DashboardShell';
import TopUpSheet from '@/components/TopUpSheet';
import ModelPicker from '@/components/models/ModelPicker';
import { Skeleton } from '@/components/ui/page';
import { videoPreload, isFrugal, onNetworkChange } from '@/lib/network';

/**
 * `/studio` — describe a scene, get a video.
 *
 * The page is a single work surface: the result fills the middle, the controls
 * sit in a dock at the bottom, and nothing else competes. Three things changed
 * in the design pass, and the reasons matter more than the CSS:
 *
 *   · The empty state used to be four rotated gradient tiles in amber, teal,
 *     purple and rose — four hues outside the palette, carrying no information,
 *     above the words START CREATING WITH / MEERAH SOUL CINEMA in black caps.
 *     It was the loudest thing in the product and it told you nothing. It is
 *     now the three prompts that actually work, which you can click to load.
 *
 *   · The parameter chips were emoji — ▯, 💎, ⏱, ✦. Emoji render differently on
 *     every platform, cannot inherit ink colour, and do not scale with the type.
 *     They are Lucide icons now, from the set already in the bundle.
 *
 *   · Aspect ratio, resolution and duration are marked as not-yet-wired. They
 *     cycle a label, but `api.generate` takes only a tier and a prompt, so the
 *     video came back 16:9 720p 5s whatever they said. Showing a control that
 *     does nothing is worse than not showing it, so they say so until the API
 *     takes them.
 */

/** Matches the server's backoff: tight at first, easing off on long renders. */
function pollDelay(elapsedMs: number): number {
  if (elapsedMs < 30_000) return 2_000;
  if (elapsedMs < 120_000) return 5_000;
  return 10_000;
}

/**
 * Openers for someone facing an empty box.
 *
 * Each is a complete, specific prompt for this market rather than a category —
 * a vendor can send the first one unedited and get something they could post.
 */
const STARTERS = [
  {
    label: 'Product on a table',
    prompt: 'A steaming plate of Nigerian jollof rice on a rustic wooden table, golden evening light, slow push in',
  },
  {
    label: 'Model on a runway',
    prompt: 'Nigerian model walking a neon-lit runway in Victoria Island Lagos, confident stride, shallow depth of field',
  },
  {
    label: 'Packshot turntable',
    prompt: '360-degree rotating product shot of a skincare bottle against tropical palm leaves, soft studio light',
  },
];

export default function StudioPage() {
  const { user, loading: authLoading, refresh: refreshUser, signOut } = useSession();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);

  // Generation controls
  const [tierId, setTierId] = useState('draft');
  const [customModelName, setCustomModelName] = useState<string | null>(null);
  const [customCredits, setCustomCredits] = useState<number | null>(null);
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState<'5s' | '10s'>('5s');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);

  // Status and progress
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<GenerationResult | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Modals and extras
  const [showPacks, setShowPacks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preload, setPreload] = useState<'none' | 'metadata'>('none');
  const [frugal, setFrugal] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedTier = tiers.find((t) => t.tierId === tierId) ?? tiers[0];
  const requiredCredits = customCredits ?? (selectedTier ? selectedTier.credits : 2);
  const canAfford = !user ? true : user.creditBalance >= requiredCredits;
  const shortfall = user ? Math.max(0, requiredCredits - user.creditBalance) : 0;

  // Network frugality detection for Nigerian data connections
  useEffect(() => {
    const read = () => {
      setPreload(videoPreload());
      setFrugal(isFrugal());
    };
    read();
    return onNetworkChange(read);
  }, []);

  // Fetch pricing and tiers
  useEffect(() => {
    if (authLoading) return;

    void (async () => {
      try {
        const pricing = await api.pricing();
        setTiers(pricing.tiers);
        if (pricing.tiers.length > 0 && !pricing.tiers.some((t) => t.tierId === 'draft')) {
          setTierId(pricing.tiers[0].tierId);
        }
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 401)) {
          setError((err as Error).message);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading]);

  // Elapsed timer during processing
  useEffect(() => {
    if (job?.status === 'processing' || job?.status === 'queued') {
      setElapsedSec(0);
      timerRef.current = setInterval(() => setElapsedSec((prev) => prev + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [job?.status]);

  // Follow a running generation
  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') return;

    const startedAt = Date.now();
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        const next = await api.result(job.request_id);
        if (cancelled) return;
        setJob(next);
        if (next.status === 'completed' || next.status === 'failed') {
          void refreshUser();
          return;
        }
      } catch {
        /* transient polling blip */
      }
      pollTimer.current = setTimeout(tick, pollDelay(Date.now() - startedAt));
    };

    pollTimer.current = setTimeout(tick, 2000);
    return () => {
      cancelled = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [job, refreshUser]);

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || busy || !canAfford) return;

    setError('');
    setNotice('');
    setBusy(true);
    setSaved(false);

    try {
      const started = await api.generate(tierId, prompt.trim());
      void refreshUser();
      setJob({
        request_id: started.generationId,
        status: 'processing',
        outputs: [],
        cost: { amount_credits: started.costCredits, refunded: false },
      });
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.status === 400 && (apiError.body as { error?: string })?.error === 'insufficient_credits') {
        setShowPacks(true);
      }
      setError(apiError.message || 'Generation request failed');
    } finally {
      setBusy(false);
    }
  };

  const keepLook = async (generationId: string) => {
    setSaving(true);
    try {
      const name = prompt.trim().slice(0, 60) || 'Studio video';
      await api.brand.saveFromGeneration(generationId, name);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const copyPrompt = useCallback(() => {
    if (!prompt) return;
    void navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [prompt]);

  const cycleRatio = () =>
    setAspectRatio(aspectRatio === '16:9' ? '9:16' : aspectRatio === '9:16' ? '1:1' : '16:9');
  const cycleResolution = () => setResolution(resolution === '720p' ? '1080p' : '720p');
  const cycleDuration = () => setDuration(duration === '5s' ? '10s' : '5s');

  const useStarter = (text: string) => {
    setPrompt(text);
    promptRef.current?.focus();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachedImage(URL.createObjectURL(file));
  };

  const handlePickModel = (modelId: string, modelName?: string, credits?: number) => {
    setTierId(modelId);
    setCustomModelName(modelName || modelId);
    if (credits) setCustomCredits(credits);
  };

  // Enter submits, Shift+Enter breaks the line — the convention for a prompt box.
  const onPromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleGenerate();
    }
  };

  const displayName = customModelName || selectedTier?.label || 'Default model';

  return (
    <DashboardShell
      user={user}
      onSignOut={signOut}
      refreshUser={refreshUser}
    >
      <div className="mx-auto flex min-h-[calc(100dvh-var(--nav-h))] w-full max-w-4xl flex-col px-4 pb-5 pt-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        {(notice || error) && (
          <div className="mb-3 shrink-0">
            {notice && <div className="alert alert-ok">{notice}</div>}
            {error && (
              <div className="alert">
                <AlertCircle className="mt-px size-4 shrink-0 text-danger" aria-hidden />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================
            THE STAGE — one of four states, never two at once.
            ================================================================== */}
        <div className="flex flex-1 flex-col items-center justify-center py-6">
          {loading && <StageSkeleton />}

          {!loading && !job && (
            <div className="w-full max-w-xl text-center rise">
              <h1 className="text-3xl font-semibold text-ink-primary">What are we making?</h1>
              <p className="mx-auto mt-2.5 max-w-md text-md text-ink-secondary">
                Describe a scene, a product or a mood. Pick a model and a quality, and the price is
                shown before you spend anything.
              </p>

              <div className="mt-8">
                <p className="section-title mb-3">Start from one of these</p>
                <div className="grid gap-2 rise-stagger">
                  {STARTERS.map((starter) => (
                    <button
                      key={starter.label}
                      type="button"
                      onClick={() => useStarter(starter.prompt)}
                      className="card card-tight card-hover group flex items-center gap-3 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink-primary">
                          {starter.label}
                        </span>
                        <span className="mt-0.5 line-clamp-1 text-xs text-ink-tertiary">
                          {starter.prompt}
                        </span>
                      </span>
                      <ArrowRight
                        className="size-4 shrink-0 text-ink-disabled transition group-hover:text-mint"
                        aria-hidden
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {job && (job.status === 'processing' || job.status === 'queued') && (
            <Rendering elapsedSec={elapsedSec} aspectRatio={aspectRatio} />
          )}

          {job && job.status === 'completed' && job.outputs[0] && (
            <div className="flex w-full flex-col items-center rise">
              <div className="w-full overflow-hidden rounded-xl border border-edge bg-surface-inset shadow-lg">
                <video
                  src={job.outputs[0]}
                  controls
                  playsInline
                  preload={preload}
                  className="max-h-[56vh] w-full object-contain"
                />
              </div>

              {frugal && (
                <p className="mt-2.5 text-xs text-ink-tertiary">
                  Data-saver is on — the video starts streaming when you press play.
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <a href={job.outputs[0]} download className="btn btn-primary">
                  <Download aria-hidden />
                  Download
                </a>
                <button
                  type="button"
                  disabled={saving || saved}
                  onClick={() => void keepLook(job.request_id)}
                  className="btn btn-secondary"
                >
                  {saved ? <Check className="text-mint" aria-hidden /> : <Bookmark aria-hidden />}
                  {saved ? 'Saved to library' : saving ? 'Saving…' : 'Save look'}
                </button>
                <button type="button" onClick={copyPrompt} className="btn btn-ghost">
                  {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                  {copied ? 'Copied' : 'Copy prompt'}
                </button>
                <button
                  type="button"
                  onClick={() => { setJob(null); setPrompt(''); }}
                  className="btn btn-ghost"
                >
                  Make another
                </button>
              </div>
            </div>
          )}

          {job && job.status === 'failed' && (
            <div className="flex max-w-md flex-col items-center text-center rise">
              <span className="flex size-11 items-center justify-center rounded-lg bg-danger-wash text-danger">
                <AlertCircle className="size-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-ink-primary">
                This one did not finish
              </h2>
              <p className="mt-1.5 text-base text-ink-secondary">
                {job.error || 'The video engine returned an error. Your prompt is still in the box — try again, or pick a different model.'}
              </p>
              {job.cost.refunded && (
                <span className="badge badge-accent mt-4">
                  <Check className="size-3" aria-hidden />
                  {job.cost.amount_credits.toLocaleString()} credits refunded
                </span>
              )}
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => setJob(null)} className="btn btn-primary">
                  Try again
                </button>
                <button
                  type="button"
                  onClick={() => { setJob(null); setShowModelPicker(true); }}
                  className="btn btn-ghost"
                >
                  Choose another model
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ==================================================================
            THE DOCK — prompt, parameters, cost, action. Sticky so it stays
            reachable while a long result scrolls behind it.
            ================================================================== */}
        <form
          onSubmit={handleGenerate}
          className="sticky bottom-4 z-30 shrink-0 rounded-xl border border-edge
                     bg-surface-raised/95 p-2.5 shadow-lg backdrop-blur-xl"
        >
          {attachedImage && (
            <div className="mb-2 flex items-center gap-2.5 rounded-md border border-edge-subtle bg-surface-hover p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachedImage} alt="" className="size-9 rounded-sm object-cover" />
              <span className="flex-1 text-xs text-ink-secondary">Reference image attached</span>
              <button
                type="button"
                onClick={() => setAttachedImage(null)}
                className="icon-btn size-7"
                aria-label="Remove reference image"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="icon-btn icon-btn-bordered shrink-0"
              aria-label="Attach a reference image"
              title="Attach a reference image"
            >
              <Plus className="size-4" aria-hidden />
            </button>

            {/* A textarea, not an input: prompts run past one line, and the old
                single-line field hid the beginning of anything detailed. */}
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={onPromptKeyDown}
              rows={1}
              placeholder="Describe the scene you want…"
              aria-label="Prompt"
              className="max-h-32 min-h-[36px] flex-1 resize-none border-0 bg-transparent px-1 py-2
                         text-base text-ink-primary placeholder:text-ink-disabled
                         focus:bg-transparent focus:outline-none"
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-edge-subtle pt-2.5">
            <button
              type="button"
              onClick={() => setShowModelPicker(true)}
              className="flex h-8 max-w-[13rem] items-center gap-1.5 rounded-md border border-edge
                         bg-surface-hover px-2.5 text-sm font-medium text-ink-primary transition
                         hover:border-edge-strong hover:bg-surface-active"
            >
              <span className="size-1.5 shrink-0 rounded-full bg-mint" aria-hidden />
              <span className="truncate">{displayName}</span>
              <ChevronDown className="size-3.5 shrink-0 text-ink-tertiary" aria-hidden />
            </button>

            <Chip icon={RectangleHorizontal} onClick={cycleRatio} pending>{aspectRatio}</Chip>
            <Chip icon={Gauge} onClick={cycleResolution} pending>{resolution}</Chip>
            <Chip icon={Timer} onClick={cycleDuration} pending>{duration}</Chip>
            <Chip icon={Lightbulb} onClick={() => useStarter(STARTERS[Math.floor(Math.random() * STARTERS.length)].prompt)}>
              Idea
            </Chip>

            <div className="ml-auto flex items-center gap-2.5">
              {/* The price is next to the button that charges it, not inside it —
                  a number inside a label reads as part of the label. */}
              <span className="text-xs tabular-nums text-ink-tertiary">
                {requiredCredits.toLocaleString()} credits
              </span>
              {!canAfford ? (
                <button type="button" onClick={() => setShowPacks(true)} className="btn btn-primary">
                  Top up {shortfall.toLocaleString()}
                </button>
              ) : (
                <button type="submit" disabled={busy || !prompt.trim()} className="btn btn-primary">
                  {busy && <Loader2 className="animate-spin" aria-hidden />}
                  {busy ? 'Starting…' : 'Generate'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      <ModelPicker
        open={showModelPicker}
        onOpenChange={setShowModelPicker}
        onPick={handlePickModel}
        activeModel={tierId}
      />

      <TopUpSheet
        open={showPacks}
        onClose={() => setShowPacks(false)}
        returnTo="/studio"
        shortfall={shortfall || undefined}
      />
    </DashboardShell>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * A parameter chip.
 *
 * `pending` marks a control the API does not accept yet. It still cycles, so
 * the state is preserved for when it does, but it says plainly that it will not
 * change this render rather than implying it will.
 */
function Chip({
  icon: Icon, onClick, children, pending,
}: {
  icon: typeof Timer;
  onClick: () => void;
  children: React.ReactNode;
  pending?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={pending ? 'Not sent to the model yet — every render is 16:9, 720p, 5s' : undefined}
      className="flex h-8 items-center gap-1.5 rounded-md border border-edge bg-surface-hover px-2.5
                 text-sm font-medium text-ink-secondary transition hover:border-edge-strong
                 hover:bg-surface-active hover:text-ink-primary"
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="tabular-nums">{children}</span>
      {pending && <span className="size-1 rounded-full bg-warn" aria-label="not active yet" />}
    </button>
  );
}

/** The stage while pricing loads — the shape of a result, not the word "Loading". */
function StageSkeleton() {
  return (
    <div className="w-full max-w-xl" role="status" aria-label="Loading the studio">
      <Skeleton className="mx-auto h-8 w-64 rounded-md" />
      <Skeleton className="mx-auto mt-3 h-4 w-80 rounded-md" />
      <div className="mt-8 grid gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/**
 * Rendering.
 *
 * A frame the size of the video that is coming, so the result lands in place
 * instead of shoving the page around, with the elapsed count and an honest
 * range rather than a promise of "under a minute".
 */
function Rendering({ elapsedSec, aspectRatio }: { elapsedSec: number; aspectRatio: string }) {
  const minutes = Math.floor(elapsedSec / 60);
  const seconds = elapsedSec % 60;
  const clock = minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, '0')}s` : `${seconds}s`;

  return (
    <div className="w-full rise">
      <div
        className="relative grid w-full place-items-center overflow-hidden rounded-xl border
                   border-edge-subtle bg-surface-inset"
        style={{ aspectRatio: aspectRatio.replace(':', ' / ') }}
        role="status"
        aria-live="polite"
      >
        <Skeleton className="absolute inset-0 rounded-none" />
        <div className="relative flex flex-col items-center gap-3 text-center">
          <Loader2 className="size-6 animate-spin text-mint" aria-hidden />
          <p className="text-base font-medium text-ink-primary">Rendering your video</p>
          <p className="text-xs tabular-nums text-ink-tertiary">
            {clock} elapsed · most finish inside two minutes
          </p>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-ink-tertiary">
        You can leave this page — the result waits in your library. If it fails, the credits come back
        automatically.
      </p>
    </div>
  );
}
