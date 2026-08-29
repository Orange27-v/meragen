"use client";

import React, { useEffect, useState } from "react";
import { loadPricing } from "./QualityPicker";

/**
 * What this tool makes, shown before you have made anything.
 *
 * The work area is roughly three quarters of the screen and used to hold a
 * headline on bare navy until the first generation came back. A first-time
 * customer could not tell what the tool produced, what it looked like, or
 * whether it was worth ₦300 — so the most expensive real estate in the product
 * was spent saying nothing.
 *
 * Once there is history, this steps back to a single quiet strip: your own work
 * should never compete with our examples.
 *
 * The copy lives in the app's `lib/guides.ts`, registered through `setShowcase`
 * below rather than duplicated here, so there is one place where customer-facing
 * words are written.
 */

/** toolId -> { headline, tagline, examples[], kind } */
let REGISTRY = {};

/** Called once by the app shell. Keeps tool copy in a single file. */
export function setShowcase(data) {
  REGISTRY = data || {};
}

export function showcaseFor(toolId) {
  return REGISTRY[toolId] || null;
}

/** Three stills per tool, seeded by id and served from our own origin. */
function exampleImage(toolId, n) {
  return `/examples/${toolId}-${n}.jpg`;
}

/** The cheapest way to try this tool, quoted live. Never a number typed here. */
function useFromPrice(kind) {
  const [price, setPrice] = useState(null);
  useEffect(() => {
    let alive = true;
    loadPricing()
      .then((tiers) => {
        if (!alive) return;
        const forKind = tiers.filter((t) => t.kind === (kind || "video"));
        setPrice(forKind.length ? forKind[0] : null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [kind]);
  return price;
}

export default function ToolShowcase({ toolId, compact = false }) {
  const guide = showcaseFor(toolId);
  const price = useFromPrice(guide?.kind);

  if (!guide) return null;

  const openGuide = () => window.dispatchEvent(new CustomEvent("meerah:show-guide"));

  // With work on the page, the examples become a footnote rather than the view.
  if (compact) {
    return (
      <div className="w-full border-t border-[var(--line-soft)] pt-4 mt-6">
        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-[10.5px] font-medium uppercase tracking-[.14em] text-[var(--fog)]">
            Also possible here
          </span>
          <button
            type="button"
            onClick={openGuide}
            className="ml-auto text-[12px] text-[var(--lilac)] hover:text-[var(--chalk)] transition-colors"
          >
            How it works
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {guide.examples.slice(0, 3).map((caption, i) => (
            <figure key={caption} className="min-w-0">
              <img
                src={exampleImage(toolId, i + 1)}
                alt={caption}
                width={640}
                height={360}
                loading="lazy"
                decoding="async"
                className="w-full aspect-video object-cover rounded border border-[var(--line-inner)]"
              />
              <figcaption className="mt-1.5 text-[11px] leading-snug text-[var(--fog)] truncate">
                {caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-10">
      <p className="text-[10.5px] font-medium uppercase tracking-[.14em] text-[var(--lilac)] mb-3">
        What this makes
      </p>
      <h1 className="text-[28px] sm:text-[34px] font-semibold tracking-tight text-[var(--chalk)] leading-[1.1] text-balance">
        {guide.headline}
      </h1>
      <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--iron)] max-w-[46ch]">
        {guide.tagline}
      </p>

      {/* Nested enclosures: an outer shell holding an inner core, with a
          concentric radius. It is what makes a card read as an object rather
          than a rectangle of a slightly different colour. */}
      <div className="mt-8 grid gap-3 grid-cols-1 sm:grid-cols-3">
        {guide.examples.slice(0, 3).map((caption, i) => (
          <figure
            key={caption}
            className="group bg-[var(--slab-hi)] border border-[var(--line)] rounded p-1.5 transition-[border-color,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-[var(--line-hi)] hover:-translate-y-0.5"
          >
            <img
              src={exampleImage(toolId, i + 1)}
              alt={caption}
              width={640}
              height={360}
              loading="lazy"
              decoding="async"
              className="w-full aspect-video object-cover rounded-[5px] border border-[var(--line-inner)]"
            />
            <figcaption className="px-2 pt-2.5 pb-1 text-[12.5px] leading-snug text-[var(--steel)] group-hover:text-[var(--paper-ink)] transition-colors">
              {caption}
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={openGuide}
          className="text-[13px] font-medium text-[var(--chalk)] border border-[var(--line)] hover:border-[var(--line-hi)] hover:bg-[var(--slab)] rounded px-3.5 py-2 transition-colors active:scale-[0.98]"
        >
          How it works
        </button>
        {price && (
          <p className="text-[12.5px] text-[var(--fog)]">
            From{" "}
            <b className="tabular-nums text-[var(--paper-ink)] font-semibold">
              ₦{price.naira.toLocaleString()}
            </b>{" "}
            for {price.label}. Nothing is charged until it works.
          </p>
        )}
      </div>

      <p className="mt-7 text-[11px] leading-relaxed text-[var(--ash)] max-w-[52ch]">
        These stills are placeholders while we gather work customers are happy to
        show. Your own results appear here once you make something.
      </p>
    </div>
  );
}
