'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  api, clearToken, getToken, ApiError,
  type User, type Tier, type Pack, type GenerationResult,
} from '@/lib/api';
import { videoPreload, isFrugal, onNetworkChange } from '@/lib/network';

/** Matches the server's backoff: tight at first, easing off on long renders. */
function pollDelay(elapsedMs: number): number {
  if (elapsedMs < 30_000) return 2_000;
  if (elapsedMs < 120_000) return 5_000;
  return 10_000;
}

export default function StudioPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);

  const [tierId, setTierId] = useState('draft');
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<GenerationResult | null>(null);

  const [showPacks, setShowPacks] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [preload, setPreload] = useState<'none' | 'metadata'>('none');
  const [frugal, setFrugal] = useState(false);
  const [saved, setSaved] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = tiers.find((t) => t.tierId === tierId);
  const canAfford = !selected || !user ? true : user.creditBalance >= selected.credits;

  const refreshUser = useCallback(async () => {
    try {
      setUser(await api.me());
    } catch {
      /* handled by the initial load */
    }
  }, []);

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
    if (!getToken()) {
      router.replace('/signin');
      return;
    }

    void (async () => {
      try {
        const [me, pricing, packList] = await Promise.all([api.me(), api.pricing(), api.packs()]);
        setUser(me);
        setTiers(pricing.tiers);
        setPacks(packList.packs);
        if (pricing.tiers.length > 0 && !pricing.tiers.some((t) => t.tierId === 'draft')) {
          setTierId(pricing.tiers[0].tierId);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          router.replace('/signin');
          return;
        }
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();

    // Coming back from Paystack. Do not wait for the webhook — it needs a
    // public URL to reach us, which does not exist in development and can be
    // delayed or lost in production. Ask the server to verify this exact
    // payment with Paystack instead.
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') ?? params.get('trxref');

    if (reference) {
      setNotice('Confirming your payment…');
      void api
        .verifyTopup(reference)
        .then((result) => {
          setUser((current) => (current ? { ...current, creditBalance: result.balance } : current));
          setNotice(
            result.credited
              ? 'Payment confirmed. Your credits are ready.'
              : 'Payment received. Your credits are already on your account.',
          );
          // Clear the reference so a refresh does not re-run this.
          window.history.replaceState({}, '', '/studio');
        })
        .catch(() => {
          setNotice('');
          setError('We could not confirm that payment yet. Refresh in a moment, or contact us if credits do not appear.');
        });
    } else if (params.get('paid') === '1') {
      setNotice('Payment received. Your credits will appear here in a moment.');
      const timers = [1500, 4000, 8000].map((ms) => setTimeout(() => void refreshUser(), ms));
      return () => timers.forEach(clearTimeout);
    }
  }, [router, refreshUser]);

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
      setUser((current) => (current ? { ...current, creditBalance: started.balanceAfter } : current));
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

  async function buy(choice: { packId?: string; amountNaira?: number }) {
    setError('');
    try {
      const { authorizationUrl } = await api.topup(choice);
      window.location.href = authorizationUrl;
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function signOut() {
    clearToken();
    router.replace('/signin');
  }

  if (loading) {
    return <main className="auth-wrap"><p className="muted">Loading…</p></main>;
  }

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-in">
          <Link className="wordmark" href="/studio"><span className="mark" />Meerah</Link>
          <div className="balance">
            <span className="muted" style={{ fontSize: '.8rem', textTransform: 'uppercase', letterSpacing: '.12em' }}>
              Credits
            </span>
            <b>{user?.creditBalance.toLocaleString() ?? '—'}</b>
            {user && (
              <span className="muted" style={{ fontSize: '.8rem' }}>
                (₦{(user.creditBalance * 50).toLocaleString()})
              </span>
            )}
          </div>
          <Link className="btn btn-ghost" href="/calendar">Calendar</Link>
          <Link className="btn btn-ghost" href="/saved">Saved</Link>
          <button className="btn btn-ghost" type="button" onClick={() => setShowPacks((v) => !v)}>
            Buy credits
          </button>
          <button className="btn btn-ghost" type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <main className="shell" style={{ paddingTop: '2rem', paddingBottom: '4rem', display: 'grid', gap: '1.5rem' }}>
        {notice && <div className="alert alert-ok">{notice}</div>}
        {error && <div className="alert">{error}</div>}

        {showPacks && (
          <section className="card">
            <h2 className="display" style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Buy credits</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '.75rem' }}>
              {packs.map((pack) => (
                <button key={pack.id} type="button" onClick={() => void buy({ packId: pack.id })}
                  className="card" style={{ background: 'var(--ink-deep)', cursor: 'pointer', textAlign: 'left' }}>
                  <div className="muted" style={{ fontSize: '.75rem', letterSpacing: '.12em', textTransform: 'uppercase' }}>
                    {pack.name}
                  </div>
                  <div className="display tabular" style={{ fontSize: '1.6rem', margin: '.35rem 0' }}>
                    ₦{pack.naira.toLocaleString()}
                  </div>
                  <div className="tabular" style={{ fontWeight: 600 }}>{pack.credits.toLocaleString()} credits</div>
                  {pack.bonusCredits > 0 && (
                    <span className="badge badge-accent" style={{ marginTop: '.35rem', alignSelf: 'flex-start' }}>
                      +{pack.bonusCredits.toLocaleString()} free
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--line)' }}>
              <label htmlFor="custom">Or pay as you go</label>
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                <input id="custom" type="number" inputMode="numeric" min={500} step={50}
                  value={customAmount} onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Amount in Naira, e.g. 1500"
                  style={{ flex: '1 1 200px' }} />
                <button type="button" className="btn btn-ghost"
                  disabled={Number(customAmount) < 500}
                  onClick={() => void buy({ amountNaira: Number(customAmount) })}>
                  {Number(customAmount) >= 500
                    ? `Buy ${(Number(customAmount) / 50).toLocaleString()} credits`
                    : 'Buy credits'}
                </button>
              </div>
              <p className="muted" style={{ fontSize: '.8rem', marginTop: '.5rem' }}>
                From ₦500, in steps of ₦50. 1 credit = ₦50 — the packs above give you extra.
              </p>
            </div>

            <p className="muted" style={{ fontSize: '.85rem', marginTop: '1rem' }}>
              Card, bank transfer or USSD through Paystack. Credits never expire.
            </p>
          </section>
        )}

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
                {tiers.filter((t) => t.tierId !== 'image' && t.tierId !== 'lipsync' && t.tierId !== 'upscale').map((tier) => {
                  const active = tier.tierId === tierId;
                  const affordable = !user || user.creditBalance >= tier.credits;
                  return (
                    <button key={tier.tierId} type="button" onClick={() => setTierId(tier.tierId)}
                      style={{
                        padding: '.75rem', textAlign: 'left', cursor: 'pointer', font: 'inherit',
                        borderRadius: 2,
                        border: `1px solid ${active ? 'var(--obsidian)' : 'var(--line)'}`,
                        background: active ? 'var(--ink-deep)' : 'var(--ink-deep)',
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
      </main>
    </>
  );
}
