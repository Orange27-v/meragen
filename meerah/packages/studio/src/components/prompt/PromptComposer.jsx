"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

const DEFAULT_POSITION_CLASS =
  "absolute bottom-4 w-full max-w-[95%] lg:max-w-4xl z-30 animate-fade-in-up";

const DEFAULT_PANEL_CLASS =
  "w-full bg-gradient-to-b from-[color-mix(in_srgb,var(--surface)_90%,transparent)] via-[color-mix(in_srgb,var(--night)_90%,transparent)] to-[color-mix(in_srgb,var(--night)_95%,transparent)] backdrop-blur-2xl rounded-[2rem] border border-[var(--line)] p-4 flex flex-col gap-3 shadow-[0_15px_50px_rgba(0,0,0,0.8)]";

// The prompt field has no surface of its own. It always sits inside a card
// that already has one, and a bordered well inside a card is the nested-box
// pattern this design is built to avoid — two edges around one thing, neither
// of which means anything. The card is the input; this is just the text in it.
const DEFAULT_TEXTAREA_CLASS =
  "w-full bg-transparent border-0 rounded-none p-0 shadow-none text-nova-text text-[16px] leading-7 placeholder:text-nova-subtle outline-none focus:outline-none resize-none min-h-[96px] max-h-[200px] md:max-h-[280px] overflow-y-auto custom-scrollbar disabled:opacity-40";

const DEFAULT_ACTION_CLASS =
  "bg-[var(--action)] text-[var(--on-action)] px-7 py-3 rounded-full font-bold text-sm hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 w-full sm:w-auto shadow-lg shadow-black/40 hover:shadow-black/40 border border-[color-mix(in_srgb,var(--line-hi)_10%,transparent)] z-10 disabled:opacity-50 disabled:cursor-not-allowed";

// One control pill, shared by every studio's settings row. Restyling it here is
// what converts all of them at once — they each build their own controls, but
// none of them builds its own look.
const CONTROL_LAYOUT_CLASS =
  "h-[52px] flex items-center gap-2 rounded-nova-btn transition-colors group whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-nova-accent";

const CONTROL_IDLE_CLASS = "text-nova-text bg-nova-card hover:bg-nova-elevated";

const CONTROL_ACTIVE_CLASS = "text-nova-text bg-nova-hover hover:bg-nova-hover";

// 56px rather than the well's 64: these sit four to a row with a label under
// each, and they carry a 16px glyph that looks lost in a larger circle.
const MEDIA_CONTROL_LAYOUT_CLASS =
  "w-14 h-14 shrink-0 rounded-full border transition-colors flex items-center justify-center relative overflow-hidden group focus:outline-none focus-visible:ring-2 focus-visible:ring-nova-accent";

const DEFAULT_POPOVER_POSITION_CLASS = "absolute bottom-[calc(100%+12px)] left-0 z-50";

const DEFAULT_POPOVER_CLASS =
  "bg-nova-elevated rounded-nova-card p-3 shadow-nova-floating min-w-[180px] max-h-[40vh] overflow-y-auto custom-scrollbar";

function joinClasses(...classes) {
  return classes.filter(Boolean).join("");
}

export function promptControlClassName({
  active = false,
  compact = false,
  iconOnly = false,
  className = "",
} = {}) {
  return joinClasses(
    CONTROL_LAYOUT_CLASS,
    iconOnly ? "w-[52px] px-0 justify-center" : compact ? "px-4" : "px-5",
    active ? CONTROL_ACTIVE_CLASS : CONTROL_IDLE_CLASS,
    className,
  );
}

export function promptMediaButtonClassName({ active = false, className = "" } = {}) {
  return joinClasses(
    MEDIA_CONTROL_LAYOUT_CLASS,
    active
      ? "border-nova-borderRing bg-nova-hover shadow-nova-circle"
      : "border-nova-borderRing bg-nova-circle hover:bg-nova-elevated shadow-nova-circle",
    className,
  );
}

export const PROMPT_MEDIA_PREVIEW_CLASS =
  "relative w-14 h-14 shrink-0 rounded-full overflow-hidden shadow-nova-circle group";

export const PROMPT_CONTROL_LABEL_CLASS = "text-[15px] font-medium text-current";

export function PromptChevronIcon({ className = "" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={joinClasses("text-nova-subtle flex-shrink-0", className)}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function PromptAspectRatioIcon({ className = "" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={joinClasses("text-current opacity-[0.45] flex-shrink-0", className)}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
    </svg>
  );
}

export function PromptDurationIcon({ className = "" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={joinClasses("text-current opacity-[0.45] flex-shrink-0", className)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function PromptQualityIcon({ className = "" }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={joinClasses("text-current opacity-70 flex-shrink-0", className)}
      aria-hidden="true"
    >
      <path d="M6.5 3.5h11L22 9 12 21 2 9l4.5-5.5Z" />
      <path d="M2 9h20" />
      <path d="m6.5 3.5 3 5.5L12 21" />
      <path d="m17.5 3.5-3 5.5L12 21" />
    </svg>
  );
}

export const PromptPopover = forwardRef(function PromptPopover(
  { children, className = "", positionClassName = DEFAULT_POPOVER_POSITION_CLASS, ...props },
  ref,
) {
  return (
    <div
      {...props}
      ref={ref}
      className={joinClasses(positionClassName, DEFAULT_POPOVER_CLASS, className)}
    >
      {children}
    </div>
  );
});

export function PromptPopoverHeader({ children, className = "" }) {
  return (
    <div
      className={joinClasses(
        "text-[13px] font-medium text-nova-subtle pb-2.5 border-b border-nova-border mb-2 px-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PromptMenuList({ children, className = "" }) {
  return (
    <div role="menu" className={joinClasses("flex flex-col gap-1", className)}>
      {children}
    </div>
  );
}

export function PromptMenuItem({
  children,
  description,
  selected = false,
  className = "",
  type = "button",
  ...props
}) {
  return (
    <button
      {...props}
      type={type}
      aria-checked={selected}
      role="menuitemradio"
      className={joinClasses(
        "w-full min-h-11 flex items-center justify-between gap-3 px-4 py-2.5 rounded-nova-md text-left cursor-pointer transition-colors group/menu-item",
        "text-[15px] font-medium text-nova-muted hover:bg-nova-hover hover:text-nova-text focus:outline-none focus-visible:bg-nova-hover focus-visible:text-nova-text",
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block truncate">{children}</span>
        {description && (
          <span className="block text-[13px] text-nova-subtle mt-0.5 truncate group-hover/menu-item:text-nova-muted">
            {description}
          </span>
        )}
      </span>
      {selected && (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flex-shrink-0 text-nova-accent"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}

export function PromptSegmentedControl({ children, className = "" }) {
  return (
    <div
      className={joinClasses(
        "inline-flex items-center gap-1 bg-nova-card rounded-full p-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PromptSegmentOption({
  children,
  selected = false,
  className = "",
  type = "button",
  ...props
}) {
  return (
    <button
      {...props}
      type={type}
      aria-pressed={selected}
      className={joinClasses(
        "min-h-9 px-4 py-1.5 rounded-full text-[14px] font-medium transition-colors flex items-center justify-center gap-2",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-nova-accent",
        selected ? "bg-nova-hover text-nova-text" : "text-nova-subtle hover:text-nova-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function PromptComposer({
  children,
  className = "",
  panelClassName = "",
  positionClassName = DEFAULT_POSITION_CLASS,
  style = { animationDelay: "0.2s" },
}) {
  return (
    <div className={joinClasses(positionClassName, className)} style={style}>
      <div className={joinClasses(DEFAULT_PANEL_CLASS, panelClassName)}>{children}</div>
    </div>
  );
}

export const PromptTextarea = forwardRef(function PromptTextarea(
  {
    value,
    onChange,
    onInput,
    className = "",
    maxHeightMobile = 150,
    maxHeightDesktop = 250,
    rows = 1,
    ...props
  },
  forwardedRef,
) {
  const internalRef = useRef(null);

  useImperativeHandle(forwardedRef, () => internalRef.current);

  const resize = useCallback(
    (element = internalRef.current) => {
      if (!element) return;

      element.style.height = "auto";
      const maxHeight = window.innerWidth < 768 ? maxHeightMobile : maxHeightDesktop;
      element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
    },
    [maxHeightDesktop, maxHeightMobile],
  );

  useEffect(() => {
    resize();
  }, [resize, value]);

  const handleChange = (event) => {
    onChange?.(event);
    resize(event.currentTarget);
  };

  const handleInput = (event) => {
    onInput?.(event);
    resize(event.currentTarget);
  };

  return (
    <textarea
      {...props}
      ref={internalRef}
      value={value}
      onChange={handleChange}
      onInput={handleInput}
      rows={rows}
      className={joinClasses(DEFAULT_TEXTAREA_CLASS, className)}
    />
  );
});

export function PromptFooter({ children, className = "" }) {
  return (
    <div
      className={joinClasses(
        "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-3 border-t border-[var(--line)] relative",
        className,
      )}
    >
      {children}
    </div>
  );
}

export const PromptControls = forwardRef(function PromptControls(
  { children, className = "" },
  ref,
) {
  return (
    <div
      ref={ref}
      className={joinClasses("flex items-center gap-2 relative flex-wrap pb-1 md:pb-0", className)}
    >
      {children}
    </div>
  );
});

export const PromptAction = forwardRef(function PromptAction(
  { children, className = "", type = "button", ...props },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={joinClasses(DEFAULT_ACTION_CLASS, className)}
    >
      {children}
    </button>
  );
});
