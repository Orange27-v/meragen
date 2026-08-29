"use client";

import React, { useState } from "react";
import ToolShowcase from "./ToolShowcase";

/**
 * The work area, in three named places.
 *
 * Before this, history *replaced* the examples — make one thing and the
 * explanation of what the tool does vanished for good — and "How it works" was
 * a dialog that opened over the tool on first visit and then hid behind a
 * header button. So the two things a new customer needs were either missing or
 * in the way.
 *
 * Three tabs instead. History has a home rather than displacing something, and
 * the guide is one click away and never blocks. The default is Results when
 * there is work to show and How it works when there is not: on an empty tool
 * the most useful tab is the one that explains it.
 */
export function WorkTabs({ toolId, hasResults, results, history, guide }) {
  const [tab, setTab] = useState(hasResults ? "results" : "guide");

  const TABS = [
    { id: "results", label: "Results" },
    { id: "history", label: "History" },
    { id: "guide", label: "How it works" },
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex-shrink-0 px-6 pt-4">
        <div
          role="tablist"
          aria-label="Work area"
          className="inline-flex items-center gap-1 rounded bg-[var(--slab-hi)] p-1"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded px-3 py-1.5 text-[13px] font-medium transition-colors
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-solid)] ${
                  tab === t.id
                    ? "bg-[var(--night)] text-[var(--chalk)]"
                    : "text-[var(--fog)] hover:text-[var(--chalk)]"
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar" role="tabpanel">
        {tab === "results" &&
          (hasResults ? (
            results
          ) : (
            <Empty
              title="Nothing made yet"
              body="What you generate appears here. Set the quality on the left and press Generate."
            />
          ))}

        {tab === "history" &&
          (history ?? (
            <Empty
              title="No history yet"
              body="Everything this account makes is kept here, and survives a refresh."
            />
          ))}

        {tab === "guide" && (
          <>
            {guide}
            <ToolShowcase toolId={toolId} />
          </>
        )}
      </div>
    </div>
  );
}

function Empty({ title, body }) {
  return (
    <div className="mx-auto max-w-[42ch] px-6 py-16 text-center">
      <p className="text-[15px] font-medium text-[var(--chalk)]">{title}</p>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--fog)]">{body}</p>
    </div>
  );
}
