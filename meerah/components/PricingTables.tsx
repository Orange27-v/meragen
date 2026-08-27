'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type Tier, type Pack, type PaygTerms } from '@/lib/api';

/**
 * The price list, read from the API.
 *
 * Nothing here is hardcoded: prices are derived server-side from live vendor
 * costs, storage cost and the naira rate. A number typed into this file would
 * drift the moment any of those moved, and a published price that disagrees
 * with what someone is charged is worse than publishing nothing.
 */
export default function PricingTables() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [payg, setPayg] = useState<PaygTerms | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void Promise.all([api.pricing(), api.packs()])
      .then(([pricing, packList]) => {
        setTiers(pricing.tiers);
        setPacks(packList.packs);
        setPayg(packList.payg);
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return <p className="muted">Prices are unavailable right now. Please try again shortly.</p>;
  }
  if (tiers.length === 0) {
    return <p className="muted">Loading prices…</p>;
  }

  const videos = tiers.filter((t) => t.spec.includes('5s'));
  const others = tiers.filter((t) => !t.spec.includes('5s'));

  return (
    <>
      <section style={{ marginBottom: 'clamp(2.5rem, 5vw, 4rem)' }}>
        <h2 className="display" style={{ fontSize: 'var(--step-2)', marginBottom: '1rem' }}>What things cost</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
            <thead>
              <tr>
                {['', 'Quality', 'Credits', 'In Naira'].map((head, i) => (
                  <th key={head || i} style={{
                    textAlign: i > 1 ? 'right' : 'left', padding: '.7rem .5rem',
                    borderBottom: '1px solid var(--line)', color: 'var(--muted)',
                    fontSize: 'var(--step--1)', letterSpacing: '.12em', textTransform: 'uppercase',
                    fontWeight: 600,
                  }}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...videos, ...others].map((tier) => (
                <tr key={tier.tierId}>
                  <td style={cell()}><b>{tier.label}</b></td>
                  <td style={cell({ color: 'var(--muted)', fontSize: 'var(--step--1)' })}>{tier.spec}</td>
                  <td style={cell({ align: 'right' })} className="tabular">{tier.credits.toLocaleString()}</td>
                  <td style={cell({ align: 'right', color: 'var(--marigold)', weight: 700 })} className="tabular">
                    ₦{tier.naira.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 'var(--step--1)', marginTop: '.9rem' }}>
          1 credit = ₦50. Videos are 5 seconds. Everything you make is stored and downloadable for
          a year, and a failed generation is refunded automatically.
        </p>
      </section>

      <section style={{ marginBottom: 'clamp(2.5rem, 5vw, 4rem)' }}>
        <h2 className="display" style={{ fontSize: 'var(--step-2)', marginBottom: '.5rem' }}>Buying credits</h2>
        <p className="muted" style={{ marginBottom: '1.5rem' }}>
          Buy in bulk for a bonus, or pay as you go for exactly what you need.
        </p>

        <div className="packs">
          {payg && (
            <div className="pack" style={{ borderStyle: 'dashed' }}>
              <span className="pack-name">Pay as you go</span>
              <span className="pack-price">Any amount</span>
              <span className="pack-credits">₦50 per credit</span>
              <span className="pack-bonus" style={{ color: 'var(--muted)', fontWeight: 400 }}>
                from ₦{payg.minNaira.toLocaleString()}, in steps of ₦50
              </span>
              <Link className="btn btn-ghost" href="/signin">Start</Link>
            </div>
          )}

          {packs.map((pack) => (
            <div key={pack.id} className={`pack${pack.id === 'creator' ? ' featured' : ''}`}>
              <span className="pack-name">{pack.name}</span>
              <span className="pack-price">₦{pack.naira.toLocaleString()}</span>
              <span className="pack-credits">{pack.credits.toLocaleString()} credits</span>
              <span className="pack-bonus">
                {pack.bonusCredits > 0 ? `+${pack.bonusCredits.toLocaleString()} free · ${pack.bonusPercent}% more` : ' '}
              </span>
              <Link className={`btn ${pack.id === 'creator' ? 'btn-primary' : 'btn-ghost'}`} href="/signin">
                Get {pack.name}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="plain">
        <h2 className="display" style={{ fontSize: 'var(--step-2)' }}>No free plan</h2>
        <p>
          Every generation costs us money the moment you press the button, so there is no free tier.
          What you get instead: <strong>no subscription</strong>, <strong>no expiry</strong> on credits
          you have paid for, and no card kept on file to charge you next month.
        </p>
      </section>
    </>
  );
}

function cell(options: { align?: 'left' | 'right'; color?: string; weight?: number; fontSize?: string } = {}) {
  return {
    padding: '.85rem .5rem',
    borderBottom: '1px solid var(--line)',
    textAlign: options.align ?? 'left',
    color: options.color,
    fontWeight: options.weight,
    fontSize: options.fontSize,
  } as const;
}
