import React from "react";

/**
 * The settings rail — the side card.
 *
 * Every control for the job you are about to run, in one column, ending in what
 * it will cost and the button that spends it. Reading top to bottom matches the
 * order of the decisions: what you are making, what you give it, what to say,
 * how good it should be, then what that costs.
 *
 * The look is the `nova` system in `tailwind.config.js` — a dark cinematic
 * generation surface, layered charcoal, generous radii, soft wide shadows, and
 * and the product's accent green used only where attention is owed. The
 * formula, in one line:
 *
 * nova-bg → nova-card surfaces → nova-border edges → nova-text →
 * nova-muted → nova-accent
 *
 * Nothing here invents a colour, a radius or a shadow. If a piece needs one it
 * does not have, it needs a token, and the token goes in the config.
 */
export function SettingsRail({ children, footer, tabs, className = "" }) {
  return (
    <aside
      className={`h-full w-full p-2 lg:w-[320px] lg:flex-shrink-0 ${className}`}
      aria-label="Settings"
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-nova-panel bg-nova-surface">
        {tabs}

        <div className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {children}
        </div>

        {/* The footer is a row in the column, not an overlay on it.
            It used to float, with the scroll body carrying bottom padding to
            clear it — which only works while the two numbers agree. They
            drifted, and the price line came to rest on top of the model row,
            hiding the control underneath it. A flex sibling cannot overlap
            anything, so there is no pair of numbers left to keep in step. */}
        {footer && <div className="flex-shrink-0 border-t border-nova-hairline p-4">{footer}</div>}
      </div>
    </aside>
  );
}

/**
 * The places this tool can be, across the top of the rail.
 *
 * Underlined rather than boxed: these switch what the whole rail is for, and a
 * segmented control at this size would compete with the one inside it that only
 * switches where the footage comes from. The underline is white, not accent —
 * the accent is for the thing you are about to spend money on, and spending it
 * on a tab leaves nothing for the button.
 */
export function RailTabs({ tabs, value, onChange, label = "Mode" }) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex flex-shrink-0 items-stretch gap-5 border-b border-nova-border px-4"
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={tab.disabled}
            onClick={() => onChange?.(tab.id)}
            className={`relative -mb-px pb-4 pt-5 text-[15px] tracking-[-0.01em] transition-colors
              focus-visible:rounded-nova-sm focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-nova-accent disabled:cursor-not-allowed disabled:opacity-35 ${
                active
                  ? "font-medium text-nova-text"
                  : "font-medium text-nova-subtle hover:text-nova-muted"
              }`}
          >
            {tab.label}
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-nova-text"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Two or three exclusive choices, as one control.
 *
 * The chosen half is *lighter* than the track it sits in, which is the opposite
 * of what a dark theme usually does — but it is what makes the selection read
 * as the thing standing forward rather than the thing cut out.
 */
export function RailSegmented({ options, value, onChange, label }) {
  // Three across is as far as 320px goes before "Start & End Frames" becomes
  //"Start …". Past three the control wraps to a grid, which costs a row and
  // buys back the words — four cells across truncated every one of them.
  const columns = options.length <= 3 ? options.length : options.length === 4 ? 2 : 3;

  return (
    <div
      role="tablist"
      aria-label={label}
      className="grid gap-1 rounded-nova-seg bg-nova-card p-1.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={option.disabled}
            onClick={() => onChange?.(option.id)}
            className={`flex h-14 items-center justify-center rounded-nova-lg px-2.5 text-center
              font-medium leading-tight transition-colors ${
                columns > 2 || options.length > 3 ? "text-[14px]" : "text-[15px]"
              }
   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-accent
     disabled:cursor-not-allowed disabled:opacity-35 ${
       active ? "bg-nova-hover text-nova-text" : "text-nova-subtle hover:text-nova-muted"
     }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A card. The rail's one container shape, so the pieces below can be about
 * their contents rather than about their edges.
 */
export function RailCard({
  header,
  footer,
  children,
  className = "",
  bodyClassName = "p-4",
  as: Tag = "div",
  ...props
}) {
  return (
    <Tag {...props} className={`overflow-hidden rounded-nova-card bg-nova-card ${className}`}>
      {header != null && <div className="border-b border-nova-hairline px-4 py-3">{header}</div>}
      <div className={bodyClassName}>{children}</div>
      {footer != null && <div className="border-t border-nova-hairline px-4 py-3">{footer}</div>}
    </Tag>
  );
}

/**
 * A card's header, as a plain label.
 *
 * Most headers are one word naming what the card holds, so this saves every
 * call site writing the same span. Pass your own node to `header` when it needs
 * more than a name — a count, a control, a link.
 */
export function RailCardTitle({ children, action }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[13px] font-medium text-nova-subtle">{children}</span>
      {action && <span className="ml-auto">{action}</span>}
    </div>
  );
}

/** The label above a card or a group of them. */
export function RailLabel({ children, action, className = "" }) {
  return (
    <div className={`flex items-baseline gap-2 px-1 ${className}`}>
      <h3 className="text-[13px] font-medium text-nova-subtle">{children}</h3>
      {action}
    </div>
  );
}

/**
 * One labelled group inside the rail.
 *
 * `hint` is for the thing a first-time user needs and an experienced one stops
 * reading — it sits under the label, not inside a tooltip nobody opens.
 *
 * `variant="card"` puts the group's contents on a surface. Most groups want it:
 * a prompt or an upload well floating directly on the panel reads as something
 * that has come loose. The exception is a row of controls that are already
 * cards themselves, which is what `weight="chips"` marks.
 */
export function RailSection({
  label,
  hint,
  children,
  action,
  weight = "block",
  variant = "plain",
}) {
  const chips = weight === "chips";
  const card = variant === "card";
  return (
    <section className="space-y-2">
      {/* A carded section puts its label in the card's header rather than above
          it — same words, but they now belong to the thing they name. A plain
          section has no surface to put a header on, so its label stays out. */}
      {label && !card && <RailLabel action={action}>{label}</RailLabel>}
      {card ? (
        <RailCard
          bodyClassName="space-y-3 p-4"
          header={label ? <RailCardTitle action={action}>{label}</RailCardTitle> : undefined}
        >
          {children}
        </RailCard>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
      {hint && <p className="px-1 text-[13px] leading-relaxed text-nova-subtle">{hint}</p>}
    </section>
  );
}

/**
 * A full-width row: a small label, the current value, and a chevron.
 *
 * This is what the model picker is. It is a row rather than a card because the
 * value is the only thing on it that changes, and a row makes that the whole
 * line rather than something to find inside a box.
 */
export function RailRow({ label, value, adornment, icon, onClick, disabled, ...props }) {
  return (
    <button
      {...props}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[72px] w-full items-center gap-3 rounded-nova-btn bg-nova-card px-4
        text-left transition-colors hover:bg-nova-elevated focus-visible:outline-none
        focus-visible:ring-2 focus-visible:ring-nova-accent disabled:cursor-not-allowed
        disabled:opacity-40 disabled:hover:bg-nova-card"
    >
      {icon && <span className="text-nova-muted">{icon}</span>}
      <span className="min-w-0 flex-1">
        {label && (
          <span className="block truncate text-[13px] leading-tight text-nova-subtle">{label}</span>
        )}
        <span className="mt-1 flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] font-medium leading-tight text-nova-text">
            {value}
          </span>
          {adornment}
        </span>
      </span>
      <ChevronRight />
    </button>
  );
}

/**
 * A one-line row: icon, name on the left, a value on the right.
 *
 * The row above stacks label over value because the value is long. This one is
 * for the settings whose value is a single word, where stacking would waste a
 * line and make a minor control look like a major one.
 */
export function RailInlineRow({ icon, label, value, tone = "plain", onClick, disabled, ...props }) {
  return (
    <button
      {...props}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-[60px] w-full items-center gap-3 rounded-nova-btn bg-nova-card px-4
        text-left transition-colors hover:bg-nova-elevated focus-visible:outline-none
        focus-visible:ring-2 focus-visible:ring-nova-accent disabled:cursor-not-allowed
        disabled:opacity-40 disabled:hover:bg-nova-card"
    >
      {icon && <span className="text-nova-muted">{icon}</span>}
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-nova-text">
        {label}
      </span>
      <span className="flex flex-shrink-0 items-center gap-2">
        {value != null &&
          (tone === "acid" ? (
            <span className="flex items-center gap-1.5 rounded-full bg-nova-accentWash px-3 py-1.5 text-[14px] font-medium text-nova-accent">
              <SparkleIcon size={14} />
              {value}
            </span>
          ) : (
            <span className="text-[14px] font-medium text-nova-muted">{value}</span>
          ))}
        <ChevronRight />
      </span>
    </button>
  );
}

/**
 * The short settings, side by side.
 *
 * Duration, shape and resolution are three answers to the same question — how
 * big is this — so they share one line. Given a row each they read as three
 * decisions instead of one.
 */
export function RailPillRow({ children, columns }) {
  const count = columns ?? React.Children.count(children);
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      {children}
    </div>
  );
}

/** One of those. `active` is for a pill with its menu open. */
export function RailPill({ icon, children, active, className = "", ...props }) {
  return (
    <button
      {...props}
      type="button"
      className={`flex h-[52px] w-full items-center justify-center gap-1.5 rounded-nova-btn px-2
        text-[14px] font-medium text-nova-text transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-accent
        disabled:cursor-not-allowed disabled:opacity-40 ${
          active ? "bg-nova-hover" : "bg-nova-card hover:bg-nova-elevated"
        } ${className}`}
    >
      {icon && <span className="flex-shrink-0 text-nova-muted">{icon}</span>}
      <span className="truncate">{children}</span>
    </button>
  );
}

/**
 * A small chip that sits *inside* a card — the prompt's own controls.
 *
 * Darker than the card it lives on, not lighter, so it reads as pressed into
 * the surface rather than floating over it. A pill shape, which nothing else in
 * the rail is: these are tags on a thing, not controls beside it.
 */
export function RailChip({ icon, children, active, className = "", ...props }) {
  return (
    <button
      {...props}
      type="button"
      className={`inline-flex min-w-0 max-w-full items-center gap-2 rounded-full bg-nova-inset px-3 py-2
        text-[14px] font-medium transition-colors focus-visible:outline-none
        focus-visible:ring-2 focus-visible:ring-nova-accent
        disabled:cursor-not-allowed disabled:opacity-40 ${
          active ? "text-nova-accent" : "text-nova-text hover:text-nova-muted"
        } ${className}`}
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
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
    <section className="overflow-hidden rounded-nova-card bg-nova-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex h-[60px] w-full items-center gap-2.5 px-4 text-left transition-colors
          hover:bg-nova-elevated focus-visible:outline-none focus-visible:ring-2
          focus-visible:ring-nova-accent"
      >
        <span className="text-[15px] font-medium text-nova-text">{label}</span>
        {count > 0 && (
          <span className="rounded-full bg-nova-inset px-2 py-0.5 text-[12px] font-medium tabular-nums text-nova-muted">
            {count}
          </span>
        )}
        <svg
          width="12"
          height="12"
          viewBox="0 0 10 10"
          aria-hidden
          className={`ml-auto text-nova-subtle transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M1.5 3.5 5 7l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && <div className="space-y-4 border-t border-nova-hairline p-4">{children}</div>}
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
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = String(option) === String(value);
        return (
          <button
            key={String(option)}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={selected}
            className={`h-[52px] rounded-nova-btn px-4 text-[15px] font-medium transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-accent ${
                selected
                  ? "bg-nova-hover text-nova-text"
                  : "bg-nova-card text-nova-muted hover:bg-nova-elevated hover:text-nova-text"
              }`}
          >
            {format ? format(option) : String(option)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The empty media slot.
 *
 * Circles, overlapping, one per kind of thing you can drop here — which says
 * what the well accepts without the sentence having to. The dashed edge is the
 * only dashed edge in the rail, and it means"this is missing something", not
 *"this is a card".
 */
const WELL_ICONS = {
  image: <ImageIcon size={24} />,
  video: <VideoIcon size={24} />,
  audio: <AudioIcon size={24} />,
};

export function RailWell({
  label,
  hint,
  badge,
  onClick,
  types = ["image", "video", "audio"],
  className = "",
  ...props
}) {
  return (
    <button
      {...props}
      type="button"
      onClick={onClick}
      className={`group relative flex min-h-[190px] w-full flex-col items-center justify-center
        rounded-nova-well border border-dashed border-nova-borderLight bg-nova-card/70
        px-4 py-7 text-center transition-colors hover:border-nova-borderRing
        hover:bg-nova-elevated focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-nova-accent ${className}`}
    >
      {badge && (
        <span className="absolute right-4 top-4 rounded-full bg-nova-inset px-3 py-1 text-[12px] font-medium text-nova-subtle">
          {badge}
        </span>
      )}

      <span className="mb-5 flex items-center" aria-hidden>
        {types.map((type, index) => (
          <span
            key={type}
            className="flex size-16 items-center justify-center rounded-full bg-nova-circle text-nova-muted ring-4 ring-nova-card
              transition-colors group-hover:text-nova-text"
            style={{ marginLeft: index === 0 ? 0 : -14, zIndex: types.length - index }}
          >
            {WELL_ICONS[type] ?? WELL_ICONS.image}
          </span>
        ))}
      </span>

      <span className="block text-[18px] font-medium text-nova-muted">{label}</span>
      {hint && <span className="mt-1 block text-[16px] leading-7 text-nova-subtle">{hint}</span>}
    </button>
  );
}

/* ── icons ────────────────────────────────────────────────────────────────
   Outline, 1.8 stroke, matching the Lucide weight the rest of the rail is
     drawn to. Written here rather than pulled from a set: the rail needs a dozen
       of them at one weight, and a dependency for a dozen paths is not a trade
         worth making. */

export function ChevronRight({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="flex-shrink-0 text-nova-subtle"
    >
      <path
        d="m9 5 7 7-7 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SparkleIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className="flex-shrink-0"
    >
      <path d="M12 2c.4 3.7 2.3 5.6 6 6-3.7.4-5.6 2.3-6 6-.4-3.7-2.3-5.6-6-6 3.7-.4 5.6-2.3 6-6Z" />
      <path d="M19 15c.2 1.9 1.1 2.8 3 3-1.9.2-2.8 1.1-3 3-.2-1.9-1.1-2.8-3-3 1.9-.2 2.8-1.1 3-3Z" />
    </svg>
  );
}

export function EqualiserIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      className="flex-shrink-0"
    >
      <rect x="1" y="6" width="3" height="8" rx="1" />
      <rect x="6.5" y="2" width="3" height="12" rx="1" />
      <rect x="12" y="8" width="3" height="6" rx="1" />
    </svg>
  );
}

export function PencilIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="flex-shrink-0"
    >
      <path
        d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ImageIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8.5" cy="9.5" r="1.6" fill="currentColor" />
      <path
        d="m4 17 4.5-4.5L14 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function VideoIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2.5" y="6" width="13" height="12" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M15.5 11 21 7.8v8.4L15.5 13v-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AudioIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 17V5.5l10-2V15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6.5" cy="17" r="2.6" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.5" cy="15" r="2.6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function ClockIcon({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="flex-shrink-0"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7v5.2l3.2 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FrameIcon({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="flex-shrink-0"
    >
      <rect x="7" y="3" width="10" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function GemIcon({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="flex-shrink-0"
    >
      <path
        d="M2.8 10.2 12 20.5l9.2-10.3-3.4-6H6.2l-3.4 6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m9.6 10.6 1.6 1.9-1.6 1.9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BitrateIcon({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="flex-shrink-0"
    >
      <rect
        x="2.5"
        y="6"
        width="8.5"
        height="12"
        rx="1.6"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M5.5 6v12M8 6v12" stroke="currentColor" strokeWidth="1.2" opacity=".55" />
      <path
        d="M14.5 15V9M18 17V7M21.5 14v-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity=".65"
      />
    </svg>
  );
}

export function AtIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="flex-shrink-0"
    >
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M16 8v5a3 3 0 0 0 5 2.2A9 9 0 1 0 18 20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SpeakerIcon({ size = 18, muted = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="flex-shrink-0"
    >
      <path
        d="M4 9.5h3L11.5 5v14L7 14.5H4v-5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {muted ? (
        <path
          d="m16 9.5 5 5m0-5-5 5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ) : (
        <>
          <path
            d="M15 9.5a3.6 3.6 0 0 1 0 5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M18 7a7.4 7.4 0 0 1 0 10"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}
