'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type PlannedPost, type PlannerPlan, type Tier } from '@/lib/api';
import { useSession } from '@/lib/useSession';
import DashboardShell from '@/components/DashboardShell';
import MonthGrid from '@/components/MonthGrid';

/**
 * `/calendar` — Post Planner.
 *
 * Generation is automatic; posting is manual, deliberately. Direct publishing to
 * Instagram or Facebook needs Meta App Review plus Business Manager
 * verification — external approval queues on timelines we do not control — so v1
 * makes the content on schedule and leaves it in the library to upload by hand.
 * The backend refuses non-manual platforms rather than accepting them and
 * silently never publishing.
 *
 * Gated on the monthly add-on: 60 credits (₦3,000), charged from the customer's
 * existing balance rather than a recurring card mandate.
 */

/** The tiers that produce a video, which is all a planned post can be. */

const STATUS: Record<PlannedPost['status'], { label: string; colour: string }> = {
  planned:   { label: 'Planned',   colour: 'var(--muted)' },
  generating:{ label: 'Making it', colour: 'var(--marigold)' },
  ready:     { label: 'Ready to post', colour: 'var(--ok)' },
  published: { label: 'Posted',    colour: 'var(--ok)' },
  failed:    { label: 'Failed',    colour: 'var(--danger)' },
  cancelled: { label: 'Cancelled', colour: 'var(--muted)' },
};

/** Local datetime string for the input's default: tomorrow, 9am. */
function tomorrowMorning(): string {
  const when = new Date();
  when.setDate(when.getDate() + 1);
  when.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(when.getHours())}:${pad(when.getMinutes())}`;
}

/**
 * The content calendar.
 *
 * Plan the week once; the platform makes each post shortly before it is due, so
 * the customer wakes up to finished work instead of a queue.
 */
export default function CalendarPage() {
  const { user, loading: authLoading, refresh, signOut } = useSession();
  const [posts, setPosts] = useState<PlannedPost[]>([]);
  const [plan, setPlan] = useState<PlannerPlan | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Which month the grid shows, and the day filtering the list beneath it.
  const [month, setMonth] = useState(() => new Date());
  const [pickedDay, setPickedDay] = useState<Date | null>(null);

  const [when, setWhen] = useState(tomorrowMorning());
  const [tierId, setTierId] = useState('draft');
  const [prompt, setPrompt] = useState('');
  const [caption, setCaption] = useState('');

  const load = useCallback(async () => {
    try {
      const [calendar, pricing] = await Promise.all([api.planner.list(), api.pricing()]);
      setPosts(calendar.posts);
      setPlan(calendar.subscription);
      // Video tiers only — a planned post is a video. The tier says what it
      // makes, so nothing here has to keep a list of ids in step with the
      // server's, and nothing tests a description for "5s".
      setTiers(pricing.tiers.filter((t) => t.kind === 'video'));
    } catch (err) {
      // The shell's session hook owns the sign-out path.
      if (!(err instanceof ApiError && err.status === 401)) setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    void load();
    // Posts move through making-it to ready on their own.
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [authLoading, load]);

  async function act(run: () => Promise<unknown>) {
    setError('');
    setBusy(true);
    try {
      await run();
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const selected = tiers.find((t) => t.tierId === tierId);

  // Picking a day filters the list; with none picked it shows everything ahead.
  const visiblePosts = pickedDay
    ? posts.filter((p) => new Date(p.scheduledFor).toDateString() === pickedDay.toDateString())
    : posts;

  return (
    <DashboardShell user={user} onSignOut={signOut} refreshUser={refresh}>
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        <div>
          <h1 className="display" style={{ fontSize: '1.8rem', marginBottom: '.4rem' }}>Post Planner</h1>
          <p className="muted">
            Plan the week once. Each post is made automatically before it is due — no login, no button
            press — and waits in your library. You download it and post it yourself.
          </p>
        </div>

        {error && <div className="alert">{error}</div>}
        {plan?.note && <div className="alert">{plan.note}</div>}

        {loading ? (
          <p className="muted">Loading…</p>
        ) : !plan?.active ? (
          <section className="card">
            <h2 className="display" style={{ fontSize: '1.3rem', marginBottom: '.5rem' }}>Switch it on</h2>
            <p className="muted" style={{ marginBottom: '1rem' }}>
              {plan?.monthlyCredits} credits a month (₦{plan?.monthlyNaira.toLocaleString()}), taken from your
              balance. No card kept on file. Turn it off any time and it stops immediately — generations
              are still charged normally when each post is made.
            </p>
            <button className="btn btn-primary" type="button" disabled={busy}
              onClick={() => void act(() => api.planner.subscribe())}>
              {busy ? 'Switching on…' : `Switch on for ${plan?.monthlyCredits} credits`}
            </button>
          </section>
        ) : (
          <>
            <section className="card">
              <h2 className="display" style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Plan a post</h2>

              <div className="field">
                <label htmlFor="prompt">What should it show?</label>
                <textarea id="prompt" rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Friday jollof special, steam rising, warm evening light" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="field">
                  <label htmlFor="when">When</label>
                  <input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="tier">Quality</label>
                  <select id="tier" value={tierId} onChange={(e) => setTierId(e.target.value)}>
                    {tiers.map((tier) => (
                      <option key={tier.tierId} value={tier.tierId}>
                        {tier.label} — {tier.credits} credits (₦{tier.naira.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field">
                <label htmlFor="caption">Caption <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                <input id="caption" value={caption} onChange={(e) => setCaption(e.target.value)}
                  placeholder="New stock landed. Ankara sets, 15k. DM to reserve." />
              </div>

              <button className="btn btn-primary" type="button"
                disabled={busy || !prompt.trim()}
                onClick={() => void act(async () => {
                  await api.planner.schedule({
                    scheduledFor: new Date(when).toISOString(), tierId, prompt, caption: caption || undefined,
                  });
                  setPrompt('');
                  setCaption('');
                })}>
                {busy ? 'Adding…' : selected ? `Add to calendar · ${selected.credits} credits when made` : 'Add to calendar'}
              </button>

              <p className="muted" style={{ fontSize: '.8rem', marginTop: '.7rem' }}>
                Credits are taken when the post is made, not now. Posting to Instagram, TikTok or
                WhatsApp is still done by you — download it and upload.
              </p>
            </section>

            <section className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '1rem' }}>
                <h2 className="display" style={{ fontSize: '1.2rem' }}>
                  {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </h2>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '.35rem' }}>
                  <button type="button" className="btn btn-ghost" style={monthStep}
                    aria-label="Previous month"
                    onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>‹</button>
                  <button type="button" className="btn btn-ghost" style={monthStep}
                    onClick={() => { setMonth(new Date()); setPickedDay(null); }}>Today</button>
                  <button type="button" className="btn btn-ghost" style={monthStep}
                    aria-label="Next month"
                    onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>›</button>
                </div>
              </div>

              <MonthGrid month={month} posts={posts} selected={pickedDay}
                onPickDay={setPickedDay}
                statusColour={(status) => STATUS[status].colour} />
            </section>

            <section>
              <h2 className="display" style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
                {pickedDay
                  ? pickedDay.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
                  : 'Coming up'}
              </h2>
              {visiblePosts.length === 0 ? (
                <div className="card">
                  <p className="muted">
                    {pickedDay ? 'Nothing planned for this day.' : 'Nothing planned yet.'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '.6rem' }}>
                  {visiblePosts.map((post) => (
                    <div key={post.id} className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 150 }}>
                        <div style={{ fontWeight: 700, fontSize: '.9rem' }}>
                          {new Date(post.scheduledFor).toLocaleString(undefined, {
                            weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                        <div style={{ fontSize: '.78rem', fontWeight: 700, color: STATUS[post.status].colour }}>
                          {STATUS[post.status].label}
                        </div>
                      </div>

                      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <div style={{ fontSize: '.9rem' }}>{post.prompt}</div>
                        {post.errorMessage && (
                          <div style={{ fontSize: '.8rem', color: 'var(--danger)' }}>{post.errorMessage}</div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '.5rem' }}>
                        {post.outputUrl && (
                          <a className="btn btn-ghost" href={post.outputUrl} download>Download</a>
                        )}
                        {post.status !== 'published' && post.status !== 'cancelled' && (
                          <button className="btn btn-ghost" type="button" disabled={busy}
                            onClick={() => void act(() => api.planner.cancel(post.id))}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <p className="muted" style={{ fontSize: '.85rem' }}>
              Post Planner renews {plan.renewsAt ? new Date(plan.renewsAt).toLocaleDateString() : 'monthly'} for{' '}
              {plan.monthlyCredits} credits.{' '}
              <button type="button" onClick={() => void act(() => api.planner.unsubscribe())}
                style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'var(--chalk)', cursor: 'pointer', textDecoration: 'underline' }}>
                Turn it off
              </button>
            </p>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

const monthStep = { padding: '.3rem .6rem', fontSize: '.85rem' } as const;
