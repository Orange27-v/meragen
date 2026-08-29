'use client';

import { useEffect, useRef, useState } from 'react';
import { api, type Pack, type PaygTerms } from '@/lib/api';

/**
 * Buying credits, from wherever you happen to be.
 *
 * This used to live inside `/studio` behind local state, which meant the "Buy
 * credits" button in the studio header navigated away from the work and then
 * showed nothing. Running out of credits happens mid-job, so the fix is to let
 * the purchase happen over the page you are already on.
 *
 * `returnTo` is where Paystack sends the browser back. The shell passes the
 * current path, so paying does not dump you on a different page than you left.
 */
export default function TopUpSheet({
  open, onClose, returnTo, shortfall,
}: {
  open: boolean;
  onClose: () => void;
  returnTo: string;
  /** Credits still needed, when opened because a job could not be afforded. */
  shortfall?: number;
}) {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [payg, setPayg] = useState<PaygTerms | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || packs.length) return;
    void api.packs()
      .then(({ packs: found, payg: terms }) => { setPacks(found); setPayg(terms); })
      .catch(() => setError('We could not load the credit packs. Please try again.'));
  }, [open, packs.length]);

  // Escape closes, and focus moves into the sheet so a keyboard user is not
  // left behind on the page underneath.
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function buy(choice: { packId?: string; amountNaira?: number }) {
    setError('');
    setBusy(true);
    try {
      const { authorizationUrl } = await api.topup(choice, returnTo);
      window.location.href = authorizationUrl;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const custom = Number(amount);
  const min = payg?.minNaira ?? 500;
  const canBuyCustom = custom >= min && custom % 50 === 0;

  return (
    <div role="dialog" aria-modal="true" aria-label="Buy credits" onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200, display: 'grid', placeItems: 'start center',
        padding: '5rem 1rem 2rem', overflowY: 'auto',
        background: 'rgba(9, 9, 11, .45)', backdropFilter: 'blur(2px)',
      }}>
      <div ref={panel} tabIndex={-1} onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 640, background: 'var(--snow)',
          border: '1px solid var(--line)', borderRadius: 'var(--radius-card)',
          padding: 'var(--card-pad)', outline: 'none',
        }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: '1.25rem' }}>
          <div>
            <h2 className="display" style={{ fontSize: 'var(--text-subheading)' }}>Buy credits</h2>
            <p className="muted" style={{ fontSize: 'var(--text-caption)', marginTop: 4 }}>
              {shortfall
                ? `You need ${shortfall.toLocaleString()} more credits for this one.`
                : 'Card, bank transfer or USSD through Paystack. Credits never expire.'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={closeButton}>×</button>
        </div>

        {error && <div className="alert" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '.6rem' }}>
          {packs.map((pack) => (
            <button key={pack.id} type="button" disabled={busy}
              onClick={() => void buy({ packId: pack.id })}
              style={{
                textAlign: 'left', cursor: busy ? 'wait' : 'pointer', font: 'inherit',
                padding: '1rem', background: 'var(--ink-deep)',
                border: '1px solid var(--line)', borderRadius: 'var(--radius-button)',
              }}>
              <div className="muted" style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase' }}>
                {pack.name}
              </div>
              <div className="display tabular" style={{ fontSize: '1.5rem', margin: '.3rem 0' }}>
                ₦{pack.naira.toLocaleString()}
              </div>
              <div className="tabular" style={{ fontWeight: 600, fontSize: 'var(--text-caption)' }}>
                {pack.credits.toLocaleString()} credits
              </div>
              {pack.bonusCredits > 0 && (
                <span className="badge badge-accent" style={{ marginTop: '.4rem', display: 'inline-block' }}>
                  +{pack.bonusCredits.toLocaleString()} free
                </span>
              )}
            </button>
          ))}
        </div>

        {payg && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--line)' }}>
            <label htmlFor="topup-amount">Or pay as you go</label>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              <input id="topup-amount" type="number" inputMode="numeric"
                min={payg.minNaira} max={payg.maxNaira} step={50}
                value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder={`Amount in Naira, e.g. ${(payg.minNaira * 3).toLocaleString()}`}
                style={{ flex: '1 1 200px' }} />
              <button type="button" className="btn btn-primary"
                disabled={!canBuyCustom || busy}
                onClick={() => void buy({ amountNaira: custom })}>
                {canBuyCustom
                  ? `Buy ${Math.floor(custom / 50).toLocaleString()} credits`
                  : 'Buy credits'}
              </button>
            </div>
            <p className="muted" style={{ fontSize: 'var(--text-caption)', marginTop: '.5rem' }}>
              From ₦{payg.minNaira.toLocaleString()}, in steps of ₦50. 1 credit = ₦50 —
              the packs above give you extra.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const closeButton = {
  marginLeft: 'auto', width: 32, height: 32, flexShrink: 0,
  display: 'grid', placeItems: 'center', fontSize: 20, lineHeight: 1,
  border: '1px solid var(--line)', borderRadius: 'var(--radius-tag)',
  background: 'var(--snow)', color: 'var(--iron)', cursor: 'pointer',
} as const;
