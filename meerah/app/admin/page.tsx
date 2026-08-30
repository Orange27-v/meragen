'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { api, ApiError, type Metrics } from '@/lib/api';
import { useSession } from '@/lib/useSession';
import DashboardShell from '@/components/DashboardShell';
import Sparkline from '@/components/Sparkline';
import { Page, PageHeader, Segmented, EmptyState, Skeleton } from '@/components/ui/page';

const naira = (value: number) => `₦${Math.round(value).toLocaleString()}`;
const pct = (value: number) => `${value}%`;

/**
 * The numbers, measured rather than assumed.
 *
 * Every financial projection in the plan is an assumption until this runs
 * against real traffic. Two of these decide whether the model holds:
 * signup-to-paid conversion, and churn — the revenue model assumes steady
 * retention, and without it user count plateaus as churn cancels new signups.
 *
 * The design pass: the six headline tiles carried status as a coloured
 * geometric character (●, ▲, ■) beside the value, which reads as a typo at
 * small sizes and as nothing at all to a screen reader. Status is a labelled
 * arrow with text now. The window filter was a third hand-rolled button row;
 * it is the shared segmented control.
 */
export default function AdminPage() {
  const { user, loading: authLoading, refresh, signOut } = useSession();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const [error, setError] = useState('');
  const [showTable, setShowTable] = useState(false);

  const load = useCallback(async (window: number) => {
    try {
      setMetrics(await api.metrics(window));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return; // the session hook redirects
      setError(err instanceof ApiError && err.status === 403
        ? 'This page is for the account owner.'
        : (err as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) void load(Number(days));
  }, [authLoading, days, load]);

  if (error) {
    return (
      <DashboardShell user={user} onSignOut={signOut} refreshUser={refresh}>
        <Page>
          <EmptyState
            icon={<AlertCircle className="size-5" aria-hidden />}
            title="These numbers are not for this account"
            body={error}
          />
        </Page>
      </DashboardShell>
    );
  }

  if (!metrics) {
    return (
      <DashboardShell user={user} onSignOut={signOut} refreshUser={refresh}>
        <Page>
          <PageHeader title="The numbers" description="Measured from the ledger." />
          <div
            className="grid gap-2.5"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))' }}
            role="status"
            aria-label="Loading metrics"
          >
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="card card-tight">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="mt-3 h-7 w-24" />
                <Skeleton className="mt-2 h-3 w-16" />
              </div>
            ))}
          </div>
          <div className="card mt-5">
            <Skeleton className="h-32 w-full rounded-md" />
          </div>
        </Page>
      </DashboardShell>
    );
  }

  const { people, money, work, stickiness, topModels, daily } = metrics;
  const maxRuns = Math.max(...topModels.map((m) => m.runs), 1);

  return (
    <DashboardShell user={user} onSignOut={signOut} refreshUser={refresh}>
      <Page>
        <PageHeader
          title="The numbers"
          description={`Last ${metrics.windowDays} days, measured from the ledger rather than assumed.`}
          actions={
            <Segmented
              label="Time window"
              value={days}
              onChange={setDays}
              options={[
                { value: '7', label: '7 days' },
                { value: '30', label: '30 days' },
                { value: '90', label: '90 days' },
              ]}
            />
          }
        />

        {/* Headline numbers. Six tiles, one grid, no chart for a single value. */}
        <section
          className="grid gap-2.5"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))' }}
        >
          <Stat
            label="Signup → paid" value={pct(people.conversionPercent)}
            note={`${people.paying} of ${people.signups}`}
            tone={people.conversionPercent >= 10 ? 'good' : 'watch'}
          />
          <Stat
            label="Churned" value={pct(people.churnedPercent)}
            note={`${people.returning} bought again`}
            tone={people.churnedPercent > 60 ? 'bad' : people.churnedPercent > 40 ? 'watch' : 'good'}
          />
          <Stat
            label="Kept after costs" value={pct(money.realisedMarginPercent)}
            note="on credits spent"
            tone={money.realisedMarginPercent >= 40 ? 'good' : money.realisedMarginPercent >= 20 ? 'watch' : 'bad'}
          />
          <Stat label="Net revenue" value={naira(money.netNaira)} note={`${naira(money.paystackFeesNaira)} to Paystack`} />
          <Stat
            label="Failed generations" value={pct(work.failureRatePercent)}
            note={`${naira(work.refundedNaira)} refunded`}
            tone={work.failureRatePercent > 10 ? 'bad' : work.failureRatePercent > 3 ? 'watch' : 'good'}
          />
          <Stat label="Owed in credits" value={naira(money.liabilityNaira)} note={`${money.creditsOutstanding} unspent`} />
        </section>

        {/* Three measures of different scale — three charts, never two y-axes. */}
        <section className="card mt-5 grid gap-7 sm:grid-cols-3">
          <Sparkline label="Money in" format={naira} points={daily.map((d) => ({ date: d.date, value: d.naira }))} />
          <Sparkline label="Signups" format={(v) => String(Math.round(v))} points={daily.map((d) => ({ date: d.date, value: d.signups }))} />
          <Sparkline label="Generations" format={(v) => String(Math.round(v))} points={daily.map((d) => ({ date: d.date, value: d.generations }))} />
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="card">
            <h2 className="section-title">Most-used models</h2>
            {topModels.length === 0 ? (
              <p className="mt-4 text-sm text-ink-tertiary">Nothing generated yet.</p>
            ) : (
              <div className="mt-4 grid gap-3">
                {topModels.map((model) => (
                  <div key={model.modelId} title={`${model.runs} runs · ${naira(model.naira)}`}>
                    <div className="mb-1.5 flex justify-between gap-4 text-sm">
                      <span className="truncate text-ink-secondary">{model.modelId}</span>
                      <span className="shrink-0 tabular-nums text-ink-primary">{model.runs}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-xs bg-surface-inset">
                      <div
                        className="h-full rounded-xs bg-mint"
                        style={{ width: `${(model.runs / maxRuns) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="section-title">Is the moat working?</h2>
            <dl className="mt-4">
              <Row label="Saved characters, voices, kits" value={String(stickiness.savedAssets)} />
              <Row label="People who saved something" value={String(stickiness.usersWithSavedAssets)} />
              <Row label="Post Planner subscribers" value={String(stickiness.plannerSubscribers)} />
              <Row label="Generations per paying user" value={String(work.perPayingUser)} />
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-ink-tertiary">
              The revenue model assumes people come back. If saved items stay near zero while signups
              rise, churn is about to cancel out growth.
            </p>
          </div>
        </section>

        {/* A table view exists, so nothing is available only as a picture. */}
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-expanded={showTable}
            className="btn btn-ghost btn-sm px-0 hover:bg-transparent hover:underline"
          >
            {showTable ? 'Hide the table' : 'Show the numbers as a table'}
          </button>

          {showTable && (
            <div className="card card-tight mt-2.5 overflow-x-auto">
              <table className="w-full min-w-[24rem] border-collapse text-sm">
                <thead>
                  <tr>
                    {['Date', 'Money in', 'Signups', 'Generations'].map((head, i) => (
                      <th
                        key={head}
                        scope="col"
                        className={`border-b border-edge-subtle px-2 py-2 font-medium text-ink-tertiary
                                    ${i === 0 ? 'text-left' : 'text-right'}`}
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...daily].reverse().map((day) => (
                    <tr key={day.date} className="transition hover:bg-surface-hover">
                      <td className="border-b border-edge-subtle px-2 py-2 text-ink-secondary">{day.date}</td>
                      <td className="border-b border-edge-subtle px-2 py-2 text-right tabular-nums text-ink-primary">{naira(day.naira)}</td>
                      <td className="border-b border-edge-subtle px-2 py-2 text-right tabular-nums text-ink-primary">{day.signups}</td>
                      <td className="border-b border-edge-subtle px-2 py-2 text-right tabular-nums text-ink-primary">{day.generations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Page>
    </DashboardShell>
  );
}

/* -------------------------------------------------------------------------- */

const TONES = {
  good:  { icon: ArrowUpRight,   className: 'text-mint',   label: 'On target' },
  watch: { icon: Minus,          className: 'text-warn',   label: 'Watch this' },
  bad:   { icon: ArrowDownRight, className: 'text-danger', label: 'Off target' },
} as const;

/**
 * A headline number.
 *
 * Status carries an icon, a colour and a word — three channels, so it survives
 * a greyscale print, a colour-blind reader and a screen reader alike. It used
 * to be a coloured ● with no text at all.
 */
function Stat({ label, value, note, tone }: {
  label: string; value: string; note?: string; tone?: keyof typeof TONES;
}) {
  const status = tone ? TONES[tone] : null;
  const Icon = status?.icon;

  return (
    <div className="card card-tight">
      <p className="section-title">{label}</p>
      <p className="mt-2 flex items-center gap-1.5 text-2xl font-semibold tabular-nums text-ink-primary">
        {value}
        {status && Icon && (
          <span className={`inline-flex items-center ${status.className}`} title={status.label}>
            <Icon className="size-4" aria-hidden />
            <span className="sr-only">{status.label}</span>
          </span>
        )}
      </p>
      {note && <p className="mt-1 text-xs text-ink-tertiary">{note}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-edge-subtle py-2 text-sm last:border-b-0">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className="font-medium tabular-nums text-ink-primary">{value}</dd>
    </div>
  );
}
