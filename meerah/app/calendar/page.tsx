'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, Download, AlertCircle, Plus,
} from 'lucide-react';
import { api, ApiError, type PlannedPost, type PlannerPlan, type Tier } from '@/lib/api';
import { useSession } from '@/lib/useSession';
import DashboardShell from '@/components/DashboardShell';
import MonthGrid from '@/components/MonthGrid';
import { Page, PageHeader, EmptyState, SkeletonRows } from '@/components/ui/page';

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
 *
 * The design pass: status was a coloured word and nothing else, so "Failed" and
 * "Ready to post" were told apart by hue alone — invisible to anyone who cannot
 * separate red from green. Status is a badge with its own shape and fill now.
 * The month stepper was three ghost buttons with a hand-tuned padding override;
 * it is a proper icon group.
 */

const STATUS: Record<PlannedPost['status'], { label: string; className: string; dot: string }> = {
  planned:    { label: 'Planned',    className: 'badge',              dot: 'var(--ink-tertiary)' },
  generating: { label: 'Making it',  className: 'badge badge-warn',   dot: 'var(--warn)' },
  ready:      { label: 'Ready',      className: 'badge badge-accent', dot: 'var(--accent)' },
  published:  { label: 'Posted',     className: 'badge badge-accent', dot: 'var(--accent)' },
  failed:     { label: 'Failed',     className: 'badge badge-danger', dot: 'var(--danger)' },
  cancelled:  { label: 'Cancelled',  className: 'badge',              dot: 'var(--ink-disabled)' },
};

/** Local datetime string for the input's default: tomorrow, 9am. */
function tomorrowMorning(): string {
  const when = new Date();
  when.setDate(when.getDate() + 1);
  when.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(when.getHours())}:${pad(when.getMinutes())}`;
}

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
      <Page>
        <PageHeader
          title="Post Planner"
          description="Plan the week once. Each post is made automatically before it is due — no login, no button press — and waits in your library to download and post."
        />

        {error && (
          <div className="alert mb-4">
            <AlertCircle className="mt-px size-4 shrink-0 text-danger" aria-hidden />
            <span>{error}</span>
          </div>
        )}
        {plan?.note && <div className="alert alert-warn mb-4">{plan.note}</div>}

        {loading ? (
          <SkeletonRows count={4} />
        ) : !plan?.active ? (
          <section className="card max-w-xl">
            <h2 className="text-lg font-semibold text-ink-primary">Switch on the Planner</h2>
            <p className="mt-2 text-base text-ink-secondary">
              {plan?.monthlyCredits} credits a month (₦{plan?.monthlyNaira.toLocaleString()}), taken
              from your balance. No card kept on file. Turn it off any time and it stops immediately —
              generations are still charged normally when each post is made.
            </p>
            <button
              className="btn btn-primary mt-5"
              type="button"
              disabled={busy}
              onClick={() => void act(() => api.planner.subscribe())}
            >
              {busy ? 'Switching on…' : `Switch on for ${plan?.monthlyCredits} credits`}
            </button>
          </section>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
            {/* --- Plan a post. A form belongs in one column, not the full
                    width of a 1320px page where the fields stretch to nothing
                    useful. --- */}
            <section className="card lg:sticky lg:top-[calc(var(--nav-h)+1.25rem)]">
              <h2 className="text-lg font-semibold text-ink-primary">Plan a post</h2>

              <div className="mt-4">
                <div className="field">
                  <label htmlFor="prompt">What should it show?</label>
                  <textarea
                    id="prompt"
                    rows={3}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Friday jollof special, steam rising, warm evening light"
                  />
                </div>

                <div className="field">
                  <label htmlFor="when">When</label>
                  <input
                    id="when"
                    type="datetime-local"
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                  />
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

                <div className="field">
                  <label htmlFor="caption">
                    Caption <span className="font-normal text-ink-tertiary">(optional)</span>
                  </label>
                  <input
                    id="caption"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="New stock landed. Ankara sets, 15k. DM to reserve."
                  />
                </div>
              </div>

              <button
                className="btn btn-primary btn-block mt-1"
                type="button"
                disabled={busy || !prompt.trim()}
                onClick={() => void act(async () => {
                  await api.planner.schedule({
                    scheduledFor: new Date(when).toISOString(),
                    tierId,
                    prompt,
                    caption: caption || undefined,
                  });
                  setPrompt('');
                  setCaption('');
                })}
              >
                <Plus aria-hidden />
                {busy ? 'Adding…' : 'Add to calendar'}
              </button>

              <p className="field-hint">
                {selected
                  ? `${selected.credits} credits are taken when the post is made, not now. `
                  : 'Credits are taken when the post is made, not now. '}
                Posting to Instagram, TikTok or WhatsApp is still done by you.
              </p>
            </section>

            {/* --- The month, and what is in it. --- */}
            <div className="grid gap-5">
              <section className="card">
                <div className="mb-4 flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-ink-primary">
                    {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </h2>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      className="icon-btn icon-btn-bordered size-8"
                      aria-label="Previous month"
                      onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                    >
                      <ChevronLeft className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setMonth(new Date()); setPickedDay(null); }}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-bordered size-8"
                      aria-label="Next month"
                      onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                    >
                      <ChevronRight className="size-4" aria-hidden />
                    </button>
                  </div>
                </div>

                <MonthGrid
                  month={month}
                  posts={posts}
                  selected={pickedDay}
                  onPickDay={setPickedDay}
                  statusColour={(status) => STATUS[status].dot}
                />

                {/* A key, because a coloured dot means nothing on its own. */}
                <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-edge-subtle pt-3">
                  {(['planned', 'generating', 'ready', 'failed'] as const).map((status) => (
                    <li key={status} className="flex items-center gap-1.5 text-xs text-ink-tertiary">
                      <span
                        className="size-1.5 rounded-full"
                        style={{ background: STATUS[status].dot }}
                        aria-hidden
                      />
                      {STATUS[status].label}
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-ink-primary">
                    {pickedDay
                      ? pickedDay.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
                      : 'Coming up'}
                  </h2>
                  {pickedDay && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setPickedDay(null)}
                    >
                      Show all
                    </button>
                  )}
                </div>

                {visiblePosts.length === 0 ? (
                  <EmptyState
                    icon={<CalendarDays className="size-5" aria-hidden />}
                    title={pickedDay ? 'Nothing planned for this day' : 'Nothing planned yet'}
                    body={
                      pickedDay
                        ? 'Pick another day on the calendar, or plan something for this one.'
                        : 'Add your first post on the left. A week planned on Sunday makes itself over the following days.'
                    }
                  />
                ) : (
                  <ul className="grid gap-2">
                    {visiblePosts.map((post) => (
                      <li
                        key={post.id}
                        className="card card-tight flex flex-wrap items-center gap-x-4 gap-y-3"
                      >
                        <div className="min-w-[9rem]">
                          <p className="text-sm font-medium tabular-nums text-ink-primary">
                            {new Date(post.scheduledFor).toLocaleString(undefined, {
                              weekday: 'short', day: 'numeric', month: 'short',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                          <span className={`${STATUS[post.status].className} mt-1.5`}>
                            {STATUS[post.status].label}
                          </span>
                        </div>

                        <div className="min-w-[14rem] flex-1">
                          <p className="text-base text-ink-primary">{post.prompt}</p>
                          {post.errorMessage && (
                            <p className="mt-1 text-xs text-danger">{post.errorMessage}</p>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {post.outputUrl && (
                            <a className="btn btn-secondary btn-sm" href={post.outputUrl} download>
                              <Download aria-hidden />
                              Download
                            </a>
                          )}
                          {post.status !== 'published' && post.status !== 'cancelled' && (
                            <button
                              className="btn btn-ghost btn-sm"
                              type="button"
                              disabled={busy}
                              onClick={() => void act(() => api.planner.cancel(post.id))}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <p className="text-xs text-ink-tertiary">
                Post Planner renews{' '}
                {plan.renewsAt ? new Date(plan.renewsAt).toLocaleDateString() : 'monthly'} for{' '}
                {plan.monthlyCredits} credits.{' '}
                <button
                  type="button"
                  onClick={() => void act(() => api.planner.unsubscribe())}
                  className="text-ink-secondary underline underline-offset-2 hover:text-ink-primary"
                >
                  Turn it off
                </button>
              </p>
            </div>
          </div>
        )}
      </Page>
    </DashboardShell>
  );
}
