'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { api, type Pack, type PaygTerms } from '@/lib/api';
import { Skeleton } from '@/components/ui/page';

/**
 * Buying credits, from wherever you happen to be.
 *
 * This used to live inside `/studio` behind local state, which meant the "Buy
 * credits" button in the studio header navigated away from the work and then
 * showed nothing. Running out of credits happens mid-job, so the purchase
 * happens over the page you are already on.
 *
 * `returnTo` is where Paystack sends the browser back — the current path, so
 * paying does not dump you somewhere you did not leave from.
 *
 * The design pass: the packs were three cards with a hover glow and a "+N FREE"
 * gradient badge, and no indication of which one to pick. Best value is now
 * computed from the naira-per-credit rate and marked once, and the card that
 * clears a shortfall is marked too — those are the only two questions anyone
 * has on this sheet.
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
  const [pending, setPending] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || packs.length) return;
    void api.packs()
      .then(({ packs: found, payg: terms }) => { setPacks(found); setPayg(terms); })
      .catch(() => setError('We could not load the credit packs. Please try again.'));
  }, [open, packs.length]);

  // Escape closes, focus moves into the sheet, and the page behind stops
  // scrolling under it.
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  /** The best naira-per-credit rate on offer, so "best value" is measured
   *  rather than asserted by whichever card was styled loudest. */
  const bestRate = useMemo(() => {
    if (packs.length === 0) return null;
    let best = packs[0];
    for (const pack of packs) {
      if (pack.naira / pack.credits < best.naira / best.credits) best = pack;
    }
    return best.id;
  }, [packs]);

  if (!open) return null;

  async function buy(choice: { packId?: string; amountNaira?: number }) {
    setError('');
    setBusy(true);
    setPending(choice.packId ?? 'custom');
    try {
      const { authorizationUrl } = await api.topup(choice, returnTo);
      window.location.href = authorizationUrl;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
      setPending(null);
    }
  }

  const custom = Number(amount);
  const min = payg?.minNaira ?? 500;
  const canBuyCustom = custom >= min && custom % 50 === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="topup-title"
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-6"
    >
      <div
        ref={panel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto my-auto w-full max-w-2xl rounded-xl border border-edge bg-surface-overlay
                   p-5 shadow-modal outline-none sm:p-6"
      >
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="topup-title" className="text-xl font-semibold text-ink-primary">
              Add credits
            </h2>
            <p className="mt-1 text-sm text-ink-secondary">
              {shortfall
                ? `You need ${shortfall.toLocaleString()} more credits for this job.`
                : 'Card, bank transfer or USSD through Paystack. Credits never expire.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn icon-btn-bordered shrink-0"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>

        {error && (
          <div className="alert mb-4">
            <AlertCircle className="mt-px size-4 shrink-0 text-danger" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        {packs.length === 0 && !error ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="status" aria-label="Loading packs">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg border border-edge-subtle bg-surface-raised p-4">
                <Skeleton className="h-2.5 w-14" />
                <Skeleton className="mt-3 h-6 w-24" />
                <Skeleton className="mt-2 h-3 w-20" />
                <Skeleton className="mt-4 h-8 w-full rounded-md" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {packs.map((pack) => {
              const isBest = pack.id === bestRate;
              const clearsShortfall = shortfall !== undefined && pack.credits >= shortfall;

              return (
                <button
                  key={pack.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void buy({ packId: pack.id })}
                  className={`group relative flex flex-col rounded-lg border p-4 text-left transition
                              disabled:opacity-50
                              ${isBest
                                ? 'border-mint-line bg-mint-wash'
                                : 'border-edge-subtle bg-surface-raised hover:border-edge-strong hover:bg-surface-hover'}`}
                >
                  <div className="flex h-5 items-center justify-between gap-2">
                    <span className="section-title">{pack.name}</span>
                    {isBest && <span className="badge badge-accent">Best rate</span>}
                  </div>

                  <span className="mt-2.5 text-xl font-semibold tabular-nums text-ink-primary">
                    ₦{pack.naira.toLocaleString()}
                  </span>
                  <span className="mt-0.5 text-sm tabular-nums text-ink-secondary">
                    {pack.credits.toLocaleString()} credits
                    {pack.bonusCredits > 0 && (
                      <span className="text-mint"> · {pack.bonusCredits.toLocaleString()} free</span>
                    )}
                  </span>

                  {clearsShortfall && (
                    <span className="mt-1.5 flex items-center gap-1 text-xs text-ink-tertiary">
                      <Check className="size-3 text-mint" aria-hidden />
                      Covers this job
                    </span>
                  )}

                  <span
                    className={`mt-4 flex h-8 w-full items-center justify-center rounded-md text-sm
                                font-medium transition
                                ${isBest
                                  ? 'bg-mint text-mint-ink'
                                  : 'border border-edge bg-surface-hover text-ink-primary group-hover:border-edge-strong'}`}
                  >
                    {pending === pack.id ? 'Opening Paystack…' : 'Choose'}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {payg && (
          <div className="mt-5 border-t border-edge-subtle pt-5">
            <label htmlFor="topup-amount">Or enter your own amount</label>
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-[12rem] flex-1">
                <input
                  id="topup-amount"
                  type="number"
                  inputMode="numeric"
                  min={payg.minNaira}
                  max={payg.maxNaira}
                  step={50}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`e.g. ${(payg.minNaira * 3).toLocaleString()}`}
                  aria-describedby="topup-terms"
                />
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canBuyCustom || busy}
                onClick={() => void buy({ amountNaira: custom })}
              >
                {pending === 'custom'
                  ? 'Opening Paystack…'
                  : canBuyCustom
                    ? `Buy ${Math.floor(custom / 50).toLocaleString()} credits`
                    : 'Buy credits'}
              </button>
            </div>
            <p id="topup-terms" className="field-hint">
              Minimum ₦{payg.minNaira.toLocaleString()}, in ₦50 steps. 1 credit = ₦50.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
