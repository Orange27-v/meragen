'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getToken, clearToken, ApiError, type Metrics } from '@/lib/api';
import Sparkline from '@/components/Sparkline';

const naira = (value: number) => `₦${Math.round(value).toLocaleString()}`;
const pct = (value: number) => `${value}%`;

/**
 * The numbers, measured rather than assumed.
 *
 * Every financial projection in the plan is an assumption until this runs
 * against real traffic. Two of these decide whether the model holds:
 * signup-to-paid conversion, and churn — the revenue model assumes steady
 * retention, and without it user count plateaus as churn cancels new signups.
 */
export default function AdminPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState('');
  const [showTable, setShowTable] = useState(false);

  const load = useCallback(async (window: number) => {
    try {
      setMetrics(await api.metrics(window));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        router.replace('/signin');
        return;
      }
      setError(err instanceof ApiError && err.status === 403
        ? 'This page is for the account owner.'
        : (err as Error).message);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.replace('/signin'); return; }
    void load(days);
  }, [days, load, router]);

  if (error) {
    return <main className="auth-wrap"><div className="card"><p>{error}</p></div></main>;
  }
  if (!metrics) {
    return <main className="auth-wrap"><p className="muted">Loading…</p></main>;
  }

  const { people, money, work, stickiness, topModels, daily } = metrics;
  const maxRuns = Math.max(...topModels.map((m) => m.runs), 1);

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-in" style={{ maxWidth: 1200 }}>
          <Link className="wordmark" href="/studio"><span className="mark" />Meerah</Link>
          {/* Filters in one row above the charts. */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '.4rem' }}>
            {[7, 30, 90].map((option) => (
              <button key={option} type="button" onClick={() => setDays(option)}
                style={{
                  padding: '.45rem .8rem', borderRadius: 2, font: 'inherit', fontSize: '.8rem', fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${days === option ? 'var(--obsidian)' : 'var(--line)'}`,
                  background: days === option ? 'var(--ink-deep)' : 'transparent',
                  color: days === option ? 'var(--chalk)' : 'var(--muted)',
                }}>
                {option}d
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="shell" style={{ maxWidth: 1200, paddingBlock: '2rem 4rem', display: 'grid', gap: '1.75rem' }}>
        <div>
          <h1 className="display" style={{ fontSize: '1.7rem', marginBottom: '.3rem' }}>The numbers</h1>
          <p className="muted" style={{ fontSize: '.9rem' }}>
            Last {metrics.windowDays} days, measured from the ledger.
          </p>
        </div>

        {/* Headline numbers are stat tiles, not one-bar charts. */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '.75rem' }}>
          <Stat label="Signup → paid" value={pct(people.conversionPercent)}
            note={`${people.paying} of ${people.signups}`} tone={people.conversionPercent >= 10 ? 'good' : 'watch'} />
          <Stat label="Churned" value={pct(people.churnedPercent)}
            note={`${people.returning} bought again`} tone={people.churnedPercent > 60 ? 'bad' : people.churnedPercent > 40 ? 'watch' : 'good'} />
          <Stat label="Kept after costs" value={pct(money.realisedMarginPercent)}
            note="on credits spent" tone={money.realisedMarginPercent >= 40 ? 'good' : money.realisedMarginPercent >= 20 ? 'watch' : 'bad'} />
          <Stat label="Net revenue" value={naira(money.netNaira)} note={`${naira(money.paystackFeesNaira)} to Paystack`} />
          <Stat label="Failed generations" value={pct(work.failureRatePercent)}
            note={`${naira(work.refundedNaira)} refunded`} tone={work.failureRatePercent > 10 ? 'bad' : work.failureRatePercent > 3 ? 'watch' : 'good'} />
          <Stat label="Owed in credits" value={naira(money.liabilityNaira)} note={`${money.creditsOutstanding} unspent`} />
        </section>

        {/* Three measures of different scale — three charts, never two y-axes. */}
        <section className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.75rem' }}>
          <Sparkline label="Money in" format={naira} points={daily.map((d) => ({ date: d.date, value: d.naira }))} />
          <Sparkline label="Signups" format={(v) => String(Math.round(v))} points={daily.map((d) => ({ date: d.date, value: d.signups }))} />
          <Sparkline label="Generations" format={(v) => String(Math.round(v))} points={daily.map((d) => ({ date: d.date, value: d.generations }))} />
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          <div className="card">
            <h2 style={{ fontSize: '.75rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '1rem' }}>
              Most-used models
            </h2>
            {topModels.length === 0 ? (
              <p className="muted" style={{ fontSize: '.85rem' }}>Nothing generated yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: '.6rem' }}>
                {topModels.map((model) => (
                  <div key={model.modelId} title={`${model.runs} runs · ${naira(model.naira)}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '.82rem', marginBottom: '.2rem' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model.modelId}</span>
                      <span className="tabular muted">{model.runs}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--ink-deep)', borderRadius: 3 }}>
                      <div style={{
                        width: `${(model.runs / maxRuns) * 100}%`, height: '100%',
                        background: 'var(--ember)', borderRadius: 3,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 style={{ fontSize: '.75rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '1rem' }}>
              Is the moat working?
            </h2>
            <Row label="Saved characters, voices, kits" value={String(stickiness.savedAssets)} />
            <Row label="People who saved something" value={String(stickiness.usersWithSavedAssets)} />
            <Row label="Post Planner subscribers" value={String(stickiness.plannerSubscribers)} />
            <Row label="Generations per paying user" value={String(work.perPayingUser)} />
            <p className="muted" style={{ fontSize: '.78rem', marginTop: '.9rem', lineHeight: 1.5 }}>
              The revenue model assumes people come back. If saved items stay near zero while signups
              rise, churn is about to cancel out growth.
            </p>
          </div>
        </section>

        {/* A table view exists, so nothing is available only as a picture. */}
        <div>
          <button type="button" onClick={() => setShowTable((v) => !v)}
            style={{ background: 'none', border: 0, padding: 0, font: 'inherit', fontSize: '.85rem', color: 'var(--chalk)', cursor: 'pointer', textDecoration: 'underline' }}>
            {showTable ? 'Hide the table' : 'Show the numbers as a table'}
          </button>

          {showTable && (
            <div className="card" style={{ marginTop: '.75rem', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem', minWidth: 380 }}>
                <thead>
                  <tr>{['Date', 'Money in', 'Signups', 'Generations'].map((head, i) => (
                    <th key={head} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '.5rem', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontWeight: 600 }}>{head}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {[...daily].reverse().map((day) => (
                    <tr key={day.date}>
                      <td style={cell}>{day.date}</td>
                      <td style={{ ...cell, textAlign: 'right' }} className="tabular">{naira(day.naira)}</td>
                      <td style={{ ...cell, textAlign: 'right' }} className="tabular">{day.signups}</td>
                      <td style={{ ...cell, textAlign: 'right' }} className="tabular">{day.generations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

const cell = { padding: '.45rem .5rem', borderBottom: '1px solid var(--line)' } as const;

const TONES = {
  good:  { colour: '#28A56C', mark: '●' },
  watch: { colour: 'var(--ember)', mark: '▲' },
  bad:   { colour: '#D14634', mark: '■' },
} as const;

/** Status ships with a shape as well as a colour, never colour alone. */
function Stat({ label, value, note, tone }: {
  label: string; value: string; note?: string; tone?: keyof typeof TONES;
}) {
  const status = tone ? TONES[tone] : null;
  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div className="muted" style={{ fontSize: '.7rem', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 600 }}>
        {label}
      </div>
      <div className="display tabular" style={{ fontSize: '1.9rem', margin: '.35rem 0 .15rem', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
        {value}
        {status && <span aria-hidden style={{ color: status.colour, fontSize: '.7rem' }}>{status.mark}</span>}
      </div>
      {note && <div className="muted" style={{ fontSize: '.75rem' }}>{note}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '.4rem 0', borderBottom: '1px solid var(--line)', fontSize: '.85rem' }}>
      <span className="muted">{label}</span>
      <span className="tabular" style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}
