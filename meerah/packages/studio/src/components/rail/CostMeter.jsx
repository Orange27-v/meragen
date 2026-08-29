import React from "react";

/**
 * What this will cost, before it costs it.
 *
 * This is the one thing on the page that no competitor can copy. Their pricing
 * is a monthly plan drawn against an abstract credit balance; ours is derived
 * per request from live vendor cost and the Naira rate, so we can state the
 * exact figure before charging it — in the currency the customer actually
 * budgets in.
 *
 * Three numbers, in the order the question is asked: what it costs, what that
 * is in money, and what is left afterwards. When the balance will not cover it
 * the button stops being Generate and becomes the way to fix that, because a
 * button that takes the money and then fails is worse than one that says no.
 */
export function CostMeter({
  tier, balance, busy, disabled, onGenerate, onBuyCredits,
  label = "Generate",
  // How many jobs the button will start. A batch of four pictures is four
  // charges, so the meter must price the batch and not one of it.
  quantity = 1,
}) {
  const credits = tier ? tier.credits * quantity : null;
  const naira = tier ? tier.naira * quantity : null;
  const knownBalance = typeof balance === "number";
  const after = knownBalance && credits !== null ? balance - credits : null;
  const short = after !== null && after < 0;

  return (
    <div className="space-y-2.5">
      <div className="rounded-tag border border-[var(--line)] bg-[var(--sunk)] px-3 py-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-semibold text-[var(--chalk)] tabular-nums">
            {credits === null ? "—" : `${credits.toLocaleString()} credit${credits === 1 ? "" : "s"}`}
          </span>
          {quantity > 1 && tier && (
            <span className="text-[11px] text-[var(--fog)] tabular-nums">
              {quantity} × ₦{tier.naira.toLocaleString()}
            </span>
          )}
          <span className="ml-auto text-[13px] font-semibold text-[var(--chalk)] tabular-nums">
            {naira === null ? "—" : `₦${naira.toLocaleString()}`}
          </span>
        </div>
        <p className={`mt-0.5 text-[11px] tabular-nums ${short ? "text-[#b91c1c]" : "text-[var(--fog)]"}`}>
          {/* The balance and the price list arrive independently, so both
              have to be in hand before this can subtract one from the other. */}
          {after === null
            ? knownBalance
              ? "Loading prices…"
              : "Checking your balance…"
            : short
              ? `${Math.abs(after).toLocaleString()} credits short.`
              : `${after.toLocaleString()} credits left after this.`}
        </p>
      </div>

      {short ? (
        <button
          type="button"
          onClick={onBuyCredits}
          className="w-full h-[46px] rounded-button bg-[var(--action)] text-[var(--chalk)] text-[14px] font-semibold hover:bg-[var(--slab-hi)] transition-colors"
        >
          Buy credits
        </button>
      ) : (
        <button
          type="button"
          onClick={onGenerate}
          disabled={busy || disabled || credits === null}
          className="w-full h-[46px] rounded-button bg-[var(--action)] text-[var(--chalk)] text-[14px] font-semibold hover:bg-[var(--slab-hi)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {busy ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-[color-mix(in_srgb,var(--line)_30%,transparent)] border-t-[var(--line)] rounded-full animate-spin" />
              Making it…
            </>
          ) : (
            <>
              {label}
              {naira !== null && (
                <span className="text-[color-mix(in_srgb,var(--chalk)_60%,transparent)] tabular-nums font-normal">· ₦{naira.toLocaleString()}</span>
              )}
            </>
          )}
        </button>
      )}

      <p className="text-[10.5px] leading-relaxed text-[var(--ash)] text-center">
        Nothing is charged until it works. A failed job is refunded automatically.
      </p>
    </div>
  );
}
