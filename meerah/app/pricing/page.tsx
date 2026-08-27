import Link from 'next/link';
import '../landing.css';
import PricingTables from '@/components/PricingTables';

export const metadata = {
  title: 'Meerah pricing',
  description: 'What each thing costs, in Naira. No subscription. Credits never expire.',
};

/**
 * Prices come from the API at request time, not from this file.
 *
 * They are derived from live vendor costs and the naira rate, so a hardcoded
 * table here would drift the moment either moved — and a price that disagrees
 * with what the customer is actually charged is worse than no table at all.
 */
export const dynamic = 'force-dynamic';

export default function PricingPage() {
  return (
    <>
      <nav className="nav">
        <div className="shell nav-in">
          <Link className="wordmark" href="/"><span className="mark" />Meerah</Link>
          <div className="nav-links">
            <Link href="/#voice">MyVoice</Link>
            <Link href="/#tools">Tools</Link>
            <Link href="/pricing">Pricing</Link>
          </div>
          <Link className="btn btn-primary" href="/signin">Sign in with Google</Link>
        </div>
      </nav>

      <main className="shell" style={{ paddingBlock: 'clamp(2.5rem, 6vw, 4.5rem)' }}>
        <div className="sec-head">
          <p className="eyebrow">Pricing</p>
          <h1 className="display" style={{ fontSize: 'var(--step-3)', marginTop: '.9rem' }}>
            Pay for what you make
          </h1>
          <p>
            No subscription, no monthly minimum, nothing to cancel. Buy credits, spend them when you
            want, and if a generation fails you get them straight back.
          </p>
        </div>

        <PricingTables />
      </main>

      <footer style={{ borderTop: '1px solid var(--line)', padding: '2.5rem 0', background: 'var(--ink-deep)' }}>
        <div className="shell">
          <p className="muted" style={{ fontSize: 'var(--step--1)' }}>
            Prices in Naira, charged through Paystack — card, bank transfer or USSD. No international
            card needed. Credits never expire.
          </p>
        </div>
      </footer>
    </>
  );
}
