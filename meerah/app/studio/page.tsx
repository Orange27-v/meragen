'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, ApiError, type Tier, type GenerationResult } from '@/lib/api';
import { useSession } from '@/lib/useSession';
import DashboardShell from '@/components/DashboardShell';
import TopUpSheet from '@/components/TopUpSheet';
import { videoPreload, isFrugal, onNetworkChange } from '@/lib/network';

/** Matches the server's backoff: tight at first, easing off on long renders. */
function pollDelay(elapsedMs: number): number {
  if (elapsedMs < 30_000) return 2_000;
  if (elapsedMs < 120_000) return 5_000;
  return 10_000;
}

export default function StudioPage() {
  const { user, loading: authLoading, refresh: refreshUser, signOut } = useSession();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);

  const [tierId, setTierId] = useState('draft');
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<GenerationResult | null>(null);

  const [showPacks, setShowPacks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preload, setPreload] = useState<'none' | 'metadata'>('none');
  const [frugal, setFrugal] = useState(false);
  const [saved, setSaved] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = tiers.find((t) => t.tierId === tierId);
  const canAfford = !selected || !user ? true : user.creditBalance >= selected.credits;

  // Re-checked on change, because people move between wifi and mobile data
  // mid-session and the right answer changes with them.
  useEffect(() => {
    const read = () => {
      setPreload(videoPreload());
      setFrugal(isFrugal());
    };
    read();
    return onNetworkChange(read);
  }, []);

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
        // The shell's session hook owns the sign-out path.
        if (!(err instanceof ApiError && err.status === 401)) setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
    // Coming back from Paystack is handled once, in the shell — it happens on
    // every page now that credits can be bought from anywhere.
  }, [authLoading]);

  // Follow a running job until it settles.
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
        /* a blip in polling is not a failed job — try again */
      }
      pollTimer.current = setTimeout(tick, pollDelay(Date.now() - startedAt));
    };

    pollTimer.current = setTimeout(tick, 2000);
    return () => {
      cancelled = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [job, refreshUser]);

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const started = await api.generate(tierId, prompt);
      void refreshUser();
      setSaved(false);
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
      setError(apiError.message);
    } finally {
      setBusy(false);
    }
  }

  /** Keeps a finished result as a reusable character. */
  async function keep(generationId: string) {
    setSaving(true);
    try {
      // Named from the prompt so it is findable later without asking the
      // customer to think of a name mid-flow.
      const name = prompt.trim().slice(0, 60) || 'Untitled';
      await api.brand.saveFromGeneration(generationId, name);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <DashboardShell user={user} onSignOut={signOut} refreshUser={refreshUser}>
        <p className="muted">Loading…</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell user={user} onSignOut={signOut} refreshUser={refreshUser}>
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {notice && <div className="alert alert-ok">{notice}</div>}
        {error && <div className="alert">{error}</div>}

        <section className="card">
          <h2 className="display" style={{ fontSize: '1.4rem', marginBottom: '1.25rem' }}>Make a video</h2>

          <form onSubmit={generate}>
            <div className="field">
              <label htmlFor="prompt">What should it show?</label>
              <textarea id="prompt" rows={3} value={prompt} required
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A jollof rice packshot on a wooden table, steam rising, warm evening light" />
            </div>

            <div className="field">
              <label>Quality</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '.5rem' }}>
                {/* This page makes videos, so it offers video tiers. It used to
                    name the tiers to exclude, which let SoundTrack appear here
                    the day an audio tier was added. */}
                {tiers.filter((t) => t.kind === 'video').map((tier) => {
                  const active = tier.tierId === tierId;
                  const affordable = !user || user.creditBalance >= tier.credits;
                  return (
                    <button key={tier.tierId} type="button" onClick={() => setTierId(tier.tierId)}
                      style={{
                        padding: '.75rem', textAlign: 'left', cursor: 'pointer', font: 'inherit',
                        borderRadius: 'var(--radius-tag)',
                        border: `1px solid ${active ? 'var(--peri)' : 'var(--line)'}`,
                        boxShadow: active ? '0 0 0 1px var(--peri)' : 'none',
                        background: active ? 'color-mix(in srgb, var(--action) 14%, transparent)' : 'var(--ink-deep)',
                        color: 'var(--chalk)', opacity: affordable ? 1 : 0.5,
                      }}>
                      <div style={{ fontWeight: 700 }}>{tier.label}</div>
                      <div className="muted" style={{ fontSize: '.78rem' }}>{tier.spec}</div>
                      <div className="tabular" style={{ marginTop: '.35rem', color: 'var(--chalk)', fontWeight: 600 }}>
                        {tier.credits.toLocaleString()} credits
                        <span className="muted" style={{ fontWeight: 400 }}> · ₦{tier.naira.toLocaleString()}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" type="submit" disabled={busy || !canAfford}>
                {busy
                  ? 'Starting…'
                  : selected
                    ? `Generate · ${selected.credits} credits (₦${selected.naira.toLocaleString()})`
                    : 'Generate'}
              </button>
              {!canAfford && (
                <span className="muted" style={{ fontSize: '.9rem' }}>
                  Not enough credits — <button type="button" onClick={() => setShowPacks(true)}
                    style={{ background: 'none', border: 0, color: 'var(--chalk)', font: 'inherit', cursor: 'pointer', padding: 0 }}>
                    top up
                  </button>
                </span>
              )}
            </div>
          </form>
        </section>

        {job && (
          <section className="card">
            <h2 className="display" style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
              {job.status === 'completed' ? 'Ready' : job.status === 'failed' ? 'Did not work' : 'Working on it'}
            </h2>

            {job.status === 'processing' || job.status === 'queued' ? (
              <p className="muted">
                This usually takes under a minute. You can leave this page open — it will update on its own.
              </p>
            ) : null}

            {job.status === 'completed' && job.outputs[0] && (
              <>
                {/* Never autoplay, and on a slow or data-saving connection
                    download nothing until they press play. */}
                <video src={job.outputs[0]} controls playsInline preload={preload}
                  style={{ width: '100%', borderRadius: 3, background: 'var(--ink-deep)' }} />
                {frugal && (
                  <p className="muted" style={{ fontSize: '.8rem', marginTop: '.4rem' }}>
                    Saving data — the video downloads only when you press play.
                  </p>
                )}
                <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                  <a className="btn btn-ghost" href={job.outputs[0]} download>Download</a>
                  {/* One tap. Anything longer and nobody saves anything, and the
                      whole reason people stay never accumulates. */}
                  <button type="button" className="btn btn-primary" disabled={saving || saved}
                    onClick={() => void keep(job.request_id)}>
                    {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save this look'}
                  </button>
                </div>
                {saved && (
                  <p className="muted" style={{ fontSize: '.85rem', marginTop: '.6rem' }}>
                    Find it under <Link href="/saved">Saved</Link> and reuse it in any video.
                  </p>
                )}
              </>
            )}

            {job.status === 'failed' && (
              <>
                <p>{job.error}</p>
                {job.cost.refunded && (
                  <p style={{ color: 'var(--ok)', marginTop: '.5rem', fontWeight: 600 }}>
                    {job.cost.amount_credits.toLocaleString()} credits refunded.
                  </p>
                )}
              </>
            )}
          </section>
        )}
      </div>

      <TopUpSheet open={showPacks} onClose={() => setShowPacks(false)} returnTo="/studio"
        shortfall={selected && user ? Math.max(0, selected.credits - user.creditBalance) : undefined} />
    </DashboardShell>
  );
}
