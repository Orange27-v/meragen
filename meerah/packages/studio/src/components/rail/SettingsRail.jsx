import React from "react";

/**
 * The settings rail.
 *
 * Every control for the job you are about to run, in one column, ending in what
 * it will cost and the button that spends it.
 *
 * This replaces a floating composer that carried the same controls as small
 * pills over a mostly empty canvas. The pills hid what they were — a row of
 * abbreviations with no labels — and the price appeared only after the money
 * was gone. Reading top to bottom now matches the order of the decisions:
 * what you are making, what you give it, how good it should be, then what that
 * costs.
 *
 * `AudioStudio` already had this shape; it is now the shape all of them share.
 */
export function SettingsRail({ children, footer, className = "" }) {
  return (
    <aside
      className={`w-full lg:w-[370px] lg:flex-shrink-0 flex flex-col h-full bg-[var(--surface)] border-r border-[var(--line)] ${className}`}
      aria-label="Settings"
    >
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-5">
        {children}
      </div>
      {footer && (
        // Pinned, so the price and the button never scroll out of reach on a
        // tool with many options.
        <div className="flex-shrink-0 border-t border-[var(--line)] bg-[var(--surface)] p-4">
          {footer}
        </div>
      )}
    </aside>
  );
}

/**
 * One labelled group inside the rail.
 *
 * `hint` is for the thing a first-time user needs and an experienced one stops
 * reading — it sits under the label, not inside a tooltip nobody opens.
 */
export function RailSection({ label, hint, children, action }) {
  return (
    <section className="space-y-2">
      {label && (
        <div className="flex items-baseline gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fog)]">
            {label}
          </h3>
          {action}
        </div>
      )}
      {children}
      {hint && <p className="text-[11px] leading-relaxed text-[var(--ash)]">{hint}</p>}
    </section>
  );
}

/**
 * A section that starts closed.
 *
 * Model parameters are long, model-specific and irrelevant to most jobs, but
 * hiding them entirely is what made the old UI feel like it was keeping
 * secrets. Collapsed says: this is here when you want it.
 */
export function Collapsible({ label, count, open, onToggle, children }) {
  return (
    <section className="border border-[var(--line)] rounded-tag overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-[var(--sunk)] hover:bg-[var(--night)] transition-colors"
      >
        <span className="text-[12px] font-semibold text-[var(--chalk)]">{label}</span>
        {count > 0 && (
          <span className="text-[10px] font-semibold text-[var(--fog)] tabular-nums">{count}</span>
        )}
        <svg
          width="10" height="10" viewBox="0 0 10 10" aria-hidden
          className={`ml-auto text-[var(--fog)] transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="p-3 space-y-3 border-t border-[var(--line)]">{children}</div>}
    </section>
  );
}

/**
 * A row of mutually exclusive choices — aspect ratio, duration, resolution.
 *
 * Chosen over a dropdown because the option lists are short and a customer
 * comparing two of them should not have to open anything.
 */
export function OptionRow({ options, value, onChange, format }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const selected = String(option) === String(value);
        return (
          <button
            key={String(option)}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={selected}
            className={`px-2.5 h-[32px] rounded-tag border text-[12px] font-medium transition-colors ${
              selected
                ? "border-[var(--line-hi)] bg-[var(--action)] text-[var(--chalk)]"
                : "border-[var(--line)] bg-[var(--surface)] text-[var(--iron)] hover:border-[var(--line)]"
            }`}
          >
            {format ? format(option) : String(option)}
          </button>
        );
      })}
    </div>
  );
}
