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
 *
 * The tabs sit *above* the panel rather than inside it, on the page itself.
 * That is what makes the panel read as the thing being switched rather than a
 * box with a header — and it is what the rail does too, in mirror: the rail's
 * tabs are inside its card because they change the card, while these change
 * what the card next to them contains.
 */
export function WorkTabs({ toolId, hasResults, results, history, guide }) {
  const [tab, setTab] = useState(hasResults ? "results" : "guide");

  const TABS = [
    { id: "results", label: "Results", icon: <GridIcon /> },
    { id: "history", label: "History", icon: <FolderIcon /> },
    { id: "guide", label: "How it works", icon: <BookIcon /> },
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 py-2.5 pr-2.5">
      <div
        role="tablist"
        aria-label="Work area"
        className="flex flex-shrink-0 flex-wrap items-center gap-2"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex h-11 items-center gap-2.5 rounded-full px-5 text-[15px] font-medium
                        transition-colors focus-visible:outline-none focus-visible:ring-2
                          focus-visible:ring-nova-accent ${
   tab === t.id ? "bg-nova-card text-nova-text" : "text-nova-subtle hover:text-nova-muted"
 }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        className="custom-scrollbar min-h-0 flex-1 overflow-y-auto rounded-nova-panel
                   bg-nova-surface"
      >
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
    <div className="mx-auto max-w-[46ch] px-6 py-24 text-center">
      <p className="text-[18px] font-medium text-nova-text">{title}</p>
      <p className="mt-2 text-[16px] leading-7 text-nova-muted">{body}</p>
    </div>
  );
}

/* ── icons ─────────────────────────────────────────────────────────────── */

function GridIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="flex-shrink-0"
    >
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <rect
        x="13.5"
        y="3"
        width="7.5"
        height="7.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="3"
        y="13.5"
        width="7.5"
        height="7.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="13.5"
        y="13.5"
        width="7.5"
        height="7.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="flex-shrink-0"
    >
      <path
        d="M3 7a2 2 0 0 1 2-2h3.6l2 2.4H19a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="flex-shrink-0"
    >
      <path
        d="M12 6.5C10.5 5 8.5 4.5 4 4.8V18c4.5-.3 6.5.2 8 1.7 1.5-1.5 3.5-2 8-1.7V4.8c-4.5-.3-6.5.2-8 1.7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 6.5v13.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
