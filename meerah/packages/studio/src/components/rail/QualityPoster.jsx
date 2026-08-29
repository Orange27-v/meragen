"use client";

import React, { useState } from "react";
import { QualityPicker } from "./QualityPicker";

/**
 * What you are making, and what it costs — as the first thing in the rail.
 *
 * The quality used to be the third section down, a list of five bordered rows
 * that looked exactly like the two sections above it. So the rail opened with
 * an upload well and the price arrived last, which is precisely backwards for a
 * product whose whole argument is that you see the Naira before you spend it.
 *
 * A poster instead: a still of the kind of thing this tool makes, the tier name
 * over it, the spec and the price beneath. Changing it opens the full list,
 * which is where a five-row comparison belongs — you make that choice once and
 * then want it out of the way.
 */
export function QualityPoster({ toolId, tiers, value, onChange, kind = "video", onPickModel }) {
  const [open, setOpen] = useState(false);
  const tier = tiers.find((t) => t.tierId === value) ?? tiers[0];

  return (
    <section className="space-y-2">
      <div className="relative overflow-hidden rounded bg-[var(--slab-hi)]">
        <img
          src={`/examples/${toolId}-1.jpg`}
          alt=""
          aria-hidden
          width={640}
          height={360}
          loading="lazy"
          decoding="async"
          className="h-[132px] w-full object-cover"
        />

        {/* The gradient is what makes the label readable over an arbitrary
            photograph. Without it the tier name lands on whatever the image
            happens to be, and half the time that is a bright sky. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute right-2 top-2 rounded bg-black/55 px-2.5 py-1 text-[11.5px]
                     font-medium text-white backdrop-blur-sm transition-colors
                     hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-[var(--ring-solid)]"
        >
          Change
        </button>

        <div className="absolute inset-x-0 bottom-0 p-3">
          {tier ? (
            <>
              <p className="text-[19px] font-semibold leading-none tracking-tight text-white">
                {tier.label}
              </p>
              <p className="mt-1.5 text-[12px] text-white/70">
                {tier.spec}
                <span className="mx-1.5 text-white/40">·</span>
                <b className="tabular-nums font-semibold text-white">
                  ₦{tier.naira.toLocaleString()}
                </b>
              </p>
            </>
          ) : (
            <p className="text-[13px] text-white/70">Loading prices…</p>
          )}
        </div>
      </div>

      {open && (
        <QualityDialog onClose={() => setOpen(false)}>
          <QualityPicker
            tiers={tiers}
            value={value}
            kind={kind}
            onPickModel={onPickModel}
            onChange={(next) => {
              onChange(next);
              setOpen(false);
            }}
          />
        </QualityDialog>
      )}
    </section>
  );
}

/**
 * The five-row comparison, on demand.
 *
 * Written here rather than reached for from the app's shadcn layer because this
 * package cannot import from it — and a dialog is a scrim, a panel and Escape,
 * which is not worth a dependency across a package boundary.
 */
function QualityDialog({ children, onClose }) {
  React.useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose a quality"
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--scrim)] p-4 backdrop-blur-[2px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded border border-[var(--line)] bg-[var(--popover-bg)] p-4 shadow-lg"
      >
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="text-[15px] font-semibold text-[var(--chalk)]">Quality</h2>
          <p className="text-[11.5px] text-[var(--fog)]">
            Every price is the whole cost of one job.
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto grid h-7 w-7 place-items-center rounded bg-[var(--slab-hi)]
                       text-[var(--iron)] transition-colors hover:text-[var(--chalk)]
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-solid)]"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
