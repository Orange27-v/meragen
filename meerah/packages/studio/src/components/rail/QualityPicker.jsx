import React, { useEffect, useState } from "react";

/**
 * Choosing a quality, not a model.
 *
 * The old picker was a two-pane browser over six hundred vendor models grouped
 * by provider logo. It asked a customer to have an opinion about which supplier
 * they wanted, which is our problem and not theirs, and it printed our whole
 * supplier list onto the page.
 *
 * So the choice is five qualities with a spec and a price. Each is pinned to a
 * model on the server; picking one submits that model, and the server prices a
 * pinned tier at the tier's own price rather than a live quote. The vendor name
 * never reaches the browser.
 */

/**
 * A tool offers the tiers that make what it makes.
 *
 * This used to be a hand-kept map of tier ids per kind, which meant a new tier
 * added on the server was invisible here until someone remembered to list it.
 * The server now says what each tier produces, so the picker just asks.
 */

/**
 * The price list. Public, cached for the session, shared by every tool.
 *
 * Prices are never hardcoded in the browser: they are derived server-side from
 * live vendor cost, storage and the Naira rate, and a number typed in here
 * would drift the moment any of those moved.
 */
let pricingPromise = null;

export function loadPricing() {
  if (!pricingPromise) {
    // Same origin, and the price list is public — no token needed.
    pricingPromise = fetch("/api/v1/pricing")
      .then((response) => (response.ok ? response.json() : { tiers: [] }))
      .then((data) => data.tiers || [])
      .catch(() => []);
  }
  return pricingPromise;
}

/** The tiers this tool can offer, and the one currently chosen. */
export function useQualityTiers(kind = "video") {
  const [tiers, setTiers] = useState([]);

  useEffect(() => {
    let alive = true;
    loadPricing().then((all) => {
      if (!alive) return;
      const wanted = kind || "video";
      setTiers(all.filter((tier) => tier.kind === wanted));
    });
    return () => {
      alive = false;
    };
  }, [kind]);

  return tiers;
}

export function QualityPicker({ tiers, value, onChange, kind = "video", onPickModel }) {
  // The Advanced drawer lives in the app shell, so the request goes out as an
  // event and the answer comes back as one. It is only offered where the studio
  // has somewhere to put the answer: four of these tools drive a fixed model,
  // and a row that silently did nothing would be worse than no row.
  useEffect(() => {
    if (!onPickModel) return undefined;
    const picked = (event) => {
      const id = event.detail?.modelId;
      if (id) onPickModel(id);
    };
    window.addEventListener("meerah:model-picked", picked);
    return () => window.removeEventListener("meerah:model-picked", picked);
  }, [onPickModel]);

  if (!tiers.length) {
    return <p className="text-[11px] text-[var(--ash)]">Loading prices…</p>;
  }

  return (
    <div className="space-y-1.5" role="radiogroup" aria-label="Quality">
      {tiers.map((tier) => {
        const selected = tier.tierId === value;
        return (
          <button
            key={tier.tierId}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(tier)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-tag border text-left transition-colors ${
              selected
                ? "border-[var(--chalk)] bg-[var(--slab-hi)]"
                : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-hi)] hover:bg-[var(--slab-hi)]"
            }`}
          >
            <span className="min-w-0">
              <span
                className={`block text-[13px] ${selected ? "font-semibold text-[var(--chalk)]" : "font-medium text-[var(--iron)]"}`}
              >
                {tier.label}
              </span>
              <span className="block text-[11px] text-[var(--fog)] truncate">{tier.spec}</span>
            </span>
            <span className="ml-auto text-right flex-shrink-0">
              <span className="block text-[13px] font-semibold tabular-nums text-[var(--chalk)]">
                ₦{tier.naira.toLocaleString()}
              </span>
              <span className="block text-[10px] text-[var(--ash)] tabular-nums">
                {tier.credits.toLocaleString()} cr
              </span>
            </span>
          </button>
        );
      })}

      {onPickModel && (
      <>
      {/* The way out of the curated ladder.
          Everything above is a quality with a fixed price. This row hands the
          whole priced catalogue to anyone who wants to choose the engine
          themselves — the only place in the product that shows a vendor's name,
          and you have to ask for it. The picker itself lives in the app shell,
          so the request goes out as an event rather than a prop threaded
          through eleven studios. */}
      <button
        type="button"
        onClick={() =>
          window.dispatchEvent(new CustomEvent("meerah:pick-model", { detail: { kind } }))
        }
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded text-left text-[12.5px]
                   text-[var(--steel)] hover:text-[var(--chalk)] hover:bg-[var(--slab-hi)]
                   transition-colors"
      >
        <span>Advanced — choose the model yourself</span>
        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden className="ml-auto opacity-60">
          <path d="M3.5 1.5 7 5l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      </>
      )}
    </div>
  );
}
