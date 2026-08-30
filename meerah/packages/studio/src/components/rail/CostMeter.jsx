import React from "react";
import { SparkleIcon } from "./SettingsRail";

/**
 * What this will cost, before it costs it.
 *
 * This is the one thing on the page that no competitor can copy. Their pricing
 * is a monthly plan drawn against an abstract credit balance; ours is derived
 * per request from live vendor cost and the Naira rate, so we can state the
 * exact figure before charging it — in the currency the customer actually
 * budgets in.
 *
 * The reference puts the price *on* the button rather than in a panel above it,
 * and that is better: the number and the act of spending it are the same
 * object, so there is no way to press Generate without having read the figure.
 * What stays outside the button is the one thing the button cannot say — what
 * is left afterwards. When the balance will not cover it the button stops being
 * Generate and becomes the way to fix that, because a button that takes the
 * money and then fails is worse than one that says no.
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
    <div className="space-y-3">
      <p
        className={`text-center text-[13px] tabular-nums ${
          short ? "text-danger" : "text-nova-subtle"
        }`}
      >
        {after === null
          ? knownBalance
            ? "Loading prices…"
            : "Checking your balance…"
          : short
            ? `${Math.abs(after).toLocaleString()} credits short.`
            : `${naira === null ? "" : `₦${naira.toLocaleString()} · `}${after.toLocaleString()} credits left after this.`}
      </p>

      {short ? (
        <RailButton onClick={onBuyCredits}>Buy credits</RailButton>
      ) : (
        <RailButton
          onClick={onGenerate}
          disabled={busy || disabled || credits === null}
        >
          {busy ? (
            <>
              <span className="size-[18px] animate-spin rounded-full border-2 border-black/20 border-t-black/70" />
              Making it…
            </>
          ) : (
            <>
              {label}
              {credits !== null && (
                <span className="ml-1 inline-flex items-center gap-2">
                  <SparkleIcon size={19} />
                  <span className="tabular-nums">{credits.toLocaleString()}</span>
                </span>
              )}
            </>
          )}
        </RailButton>
      )}
    </div>
  );
}

/**
 * The one loud thing in the rail.
 *
 * A flat rectangle of accent reads as a coloured block. What makes it read as a
 * key you can press is the soft accent glow beneath it — the only coloured
 * shadow in the product, and the only place one is earned.
 */
export function RailButton({ children, onClick, disabled, type = "button", ...props }) {
  return (
    <button
      {...props}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex h-16 w-full items-center justify-center gap-3 rounded-nova-seg
                 bg-nova-accent text-[18px] font-semibold text-nova-accentInk transition-all duration-150
                 hover:brightness-105 active:scale-[0.98]
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-accent
                 focus-visible:ring-offset-2 focus-visible:ring-offset-nova-surface
                 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none
                 disabled:hover:brightness-100 disabled:active:scale-100"
    >
      {children}
    </button>
  );
}
