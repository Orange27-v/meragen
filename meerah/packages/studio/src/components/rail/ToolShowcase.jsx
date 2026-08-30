"use client";

import React, { useEffect, useState } from "react";
import { loadPricing } from "./QualityPicker";

/** toolId -> { headline, tagline, examples[], kind } */
let REGISTRY = {};

export function setShowcase(data) {
  REGISTRY = data || {};
}

export function showcaseFor(toolId) {
  return REGISTRY[toolId] || null;
}

function exampleImage(toolId, n) {
  return `/examples/${toolId}-${n}.jpg`;
}

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
  const isAudio =
    guide.kind === "audio" ||
    toolId === "soundtrack" ||
    toolId === "talksync" ||
    toolId === "myvoice";
  const isVideo =
    guide.kind === "video" ||
    toolId === "videngine" ||
    toolId === "shotdirect" ||
    toolId === "vibereel" ||
    toolId === "snipreel";

  if (compact) {
    return (
      <div className="w-full border-t border-nova-border pt-4 mt-6">
        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-[13px] font-medium uppercase tracking-[.14em] text-nova-subtle">
            Also possible here
          </span>
          <button
            type="button"
            onClick={openGuide}
            className="ml-auto text-[12px] text-nova-accent hover:text-nova-text transition-colors"
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
                className="w-full aspect-video object-cover rounded-nova-md"
              />
              <figcaption className="mt-1.5 text-[11px] leading-snug text-nova-subtle truncate">
                {caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    );
  }

  // Audio showcase matching Screenshot 2026-08-28 at 12.01.11 PM.png
  if (isAudio) {
    return (
      <div className="w-full max-w-5xl mx-auto px-6 py-10">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h1 className="text-[28px] sm:text-[36px] font-bold tracking-tight text-nova-text uppercase leading-tight">
            TURN TEXT INTO SPEECH
          </h1>
          <p className="mt-2.5 text-[15px] text-nova-muted leading-normal">
            Lifelike speech from any script — ready for your projects
          </p>
        </div>

        <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
          {/* Card 1: Pick or clone a voice */}
          <div className="group flex flex-col rounded-nova-card bg-nova-card p-4 sm:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_16px_-4px_rgba(0,0,0,0.6)] transition-all duration-300 hover:border-nova-borderLight">
            <div className="mb-4">
              <h3 className="text-[17px] font-semibold text-nova-text tracking-tight">
                Pick or clone a voice
              </h3>
              <p className="mt-1 text-[13px] text-nova-muted">
                Choose a preset, clone your own, or pick a model
              </p>
            </div>

            {/* Visual Box */}
            <div className="relative flex-1 min-h-[200px] sm:min-h-[220px] rounded-nova-lg bg-nova-bg overflow-hidden flex items-center justify-center p-4">
              {/* Radial backdrop */}
              <div className="absolute inset-0 bg-gradient-to-tr from-cyan-950/20 via-transparent to-emerald-950/20 pointer-events-none" />

              {/* Avatars with audio waves and badges */}
              <div className="relative w-full max-w-[340px] flex items-center justify-center gap-3">
                {/* Voice 1 */}
                <div className="flex flex-col items-center gap-1.5 p-3 rounded-nova-card bg-white/[0.04] border border-white/[0.08] backdrop-blur">
                  <div className="relative size-14 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-600/40 p-0.5 flex items-center justify-center border border-amber-400/30">
                    <div className="size-full rounded-full bg-nova-bg flex items-center justify-center text-amber-300 font-semibold text-base">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                        <path
                          d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </svg>
                    </div>
                  </div>
                  <span className="text-[13px] font-semibold text-nova-text">Anna</span>
                  <span className="text-[10px] text-nova-subtle uppercase tracking-wider">
                    Female Voice
                  </span>
                </div>

                {/* Voice 2 */}
                <div className="flex flex-col items-center gap-1.5 p-3 rounded-nova-card bg-white/[0.04] border border-white/[0.08] backdrop-blur">
                  <div className="relative size-14 rounded-full bg-gradient-to-br from-blue-500/30 to-indigo-600/40 p-0.5 flex items-center justify-center border border-blue-400/30">
                    <div className="size-full rounded-full bg-nova-bg flex items-center justify-center text-blue-300 font-semibold text-base">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                        <path
                          d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </svg>
                    </div>
                  </div>
                  <span className="text-[13px] font-semibold text-nova-text">Wilder</span>
                  <span className="text-[10px] text-nova-subtle uppercase tracking-wider">
                    Male Voice
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Write, describe and generate */}
          <div className="group flex flex-col rounded-nova-card bg-nova-card p-4 sm:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_16px_-4px_rgba(0,0,0,0.6)] transition-all duration-300 hover:border-nova-borderLight">
            <div className="mb-4">
              <h3 className="text-[17px] font-semibold text-nova-text tracking-tight">
                Write, describe and generate
              </h3>
              <p className="mt-1 text-[13px] text-nova-muted">
                Type your script, describe how it sounds, and create
              </p>
            </div>

            {/* Visual Box */}
            <div className="relative flex-1 min-h-[200px] sm:min-h-[220px] rounded-nova-lg bg-nova-bg overflow-hidden flex flex-col justify-center p-4">
              <div className="w-full max-w-[320px] mx-auto space-y-2.5">
                {/* Mock Prompt Box */}
                <div className="rounded-nova-md border border-white/[0.08] bg-black/40 p-2.5">
                  <span className="text-[11px] font-medium text-nova-subtle uppercase tracking-wider">
                    Prompt:
                  </span>
                  <p className="mt-0.5 text-[12px] text-nova-muted italic line-clamp-2">
                    "Welcome back to another exciting episode of AI creative tools..."
                  </p>
                </div>

                {/* Mock Model Selector */}
                <div className="flex items-center justify-between px-3 py-2 rounded-nova-md border border-white/[0.08] bg-white/[0.03]">
                  <span className="text-[12px] font-medium text-nova-text">Seed Audio 1.0</span>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    HD
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-nova-border pt-5">
          <button
            type="button"
            onClick={openGuide}
            className="text-[13px] font-semibold text-nova-text hover:border-nova-borderLight hover:bg-nova-elevated rounded-nova-md px-4 py-2.5 transition-all active:scale-[0.98]"
          >
            How it works
          </button>
          {price && (
            <p className="text-[13px] text-nova-subtle">
              From{" "}
              <b className="tabular-nums text-nova-text font-semibold">
                ₦{price.naira.toLocaleString()}
              </b>{" "}
              ({price.credits} credit)
            </p>
          )}
        </div>
      </div>
    );
  }

  // Video showcase matching Screenshot 2026-08-28 at 12.00.59 PM.png
  if (isVideo) {
    return (
      <div className="w-full max-w-5xl mx-auto px-6 py-10">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h1 className="text-[28px] sm:text-[36px] font-bold tracking-tight text-nova-text uppercase leading-tight">
            MAKE VIDEOS IN ONE CLICK
          </h1>
          <p className="mt-2.5 text-[15px] text-nova-muted leading-normal">
            250+ presets for camera control, framing, and high-quality VFX - or use the general
            preset for manual control.
          </p>
        </div>

        <div className="grid gap-5 grid-cols-1 md:grid-cols-3">
          {/* Card 1: ADD IMAGE */}
          <div className="group flex flex-col rounded-nova-card bg-nova-card p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_16px_-4px_rgba(0,0,0,0.6)] transition-all duration-300 hover:border-nova-borderLight">
            <div className="relative aspect-[4/3] rounded-nova-lg border border-dashed border-white/[0.12] bg-nova-bg overflow-hidden flex flex-col items-center justify-center p-4">
              <div className="flex size-10 items-center justify-center rounded-nova-lg bg-white/[0.04] border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] mb-2">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="text-nova-text"
                >
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-[12px] font-bold tracking-wider uppercase text-nova-text">
                UPLOAD IMAGE
              </span>
              <span className="text-[10px] text-nova-subtle mt-0.5">
                Upload or Paste from Clipboard
              </span>

              {/* Overlapping thumbnail graphic */}
              <div className="absolute -bottom-3 -left-3 size-24 rounded-nova-md overflow-hidden border-2 border-emerald-400/40 shadow-xl rotate-[-8deg] pointer-events-none">
                <img
                  src={exampleImage(toolId, 1)}
                  alt="preview"
                  className="size-full object-cover"
                />
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-[14px] font-bold uppercase tracking-wider text-nova-text">
                ADD IMAGE
              </h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-nova-muted">
                Upload or generate an image to start your animation
              </p>
            </div>
          </div>

          {/* Card 2: CHOOSE PRESET */}
          <div className="group flex flex-col rounded-nova-card bg-nova-card p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_16px_-4px_rgba(0,0,0,0.6)] transition-all duration-300 hover:border-nova-borderLight">
            <div className="relative aspect-[4/3] rounded-nova-lg bg-nova-bg overflow-hidden flex items-center justify-center p-2">
              {/* Presets visual carousel */}
              <div className="flex items-center gap-1.5 w-full h-full justify-center">
                <div className="w-1/3 h-[85%] rounded-md bg-black/40 border border-white/[0.06] overflow-hidden opacity-60 scale-90">
                  <img
                    src={exampleImage(toolId, 1)}
                    alt="preset"
                    className="size-full object-cover"
                  />
                </div>
                <div className="w-2/5 h-full rounded-nova-md bg-black/60 border-2 border-nova-accent/80 shadow-[0_0_12px_rgba(0,208,156,0.30)] overflow-hidden relative">
                  <img
                    src={exampleImage(toolId, 2)}
                    alt="preset active"
                    className="size-full object-cover"
                  />
                </div>
                <div className="w-1/3 h-[85%] rounded-md bg-black/40 border border-white/[0.06] overflow-hidden opacity-60 scale-90">
                  <img
                    src={exampleImage(toolId, 3)}
                    alt="preset"
                    className="size-full object-cover"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-[14px] font-bold uppercase tracking-wider text-nova-text">
                CHOOSE PRESET
              </h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-nova-muted">
                Pick a preset to control your image movement
              </p>
            </div>
          </div>

          {/* Card 3: GET VIDEO */}
          <div className="group flex flex-col rounded-nova-card bg-nova-card p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_16px_-4px_rgba(0,0,0,0.6)] transition-all duration-300 hover:border-nova-borderLight">
            <div className="relative aspect-[4/3] rounded-nova-lg bg-nova-bg overflow-hidden flex items-center justify-center p-1.5">
              <div className="relative size-full rounded-nova-md overflow-hidden border border-white/[0.12] shadow-2xl">
                <img
                  src={exampleImage(toolId, 3)}
                  alt="final video"
                  className="size-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <div className="size-10 rounded-full bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center shadow-lg">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-[14px] font-bold uppercase tracking-wider text-nova-text">
                GET VIDEO
              </h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-nova-muted">
                Click generate to create your final animated video!
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-nova-border pt-5">
          <button
            type="button"
            onClick={openGuide}
            className="text-[13px] font-semibold text-nova-text hover:border-nova-borderLight hover:bg-nova-elevated rounded-nova-md px-4 py-2.5 transition-all active:scale-[0.98]"
          >
            How it works
          </button>
          {price && (
            <p className="text-[13px] text-nova-subtle">
              From{" "}
              <b className="tabular-nums text-nova-text font-semibold">
                ₦{price.naira.toLocaleString()}
              </b>{" "}
              ({price.credits} credit)
            </p>
          )}
        </div>
      </div>
    );
  }

  // Default image / other studio showcase
  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-10">
      <p className="text-[13px] font-medium uppercase tracking-[.14em] text-nova-accent mb-4">
        What this makes
      </p>
      <h1 className="text-[28px] sm:text-[34px] font-semibold tracking-tight text-nova-text leading-[1.1] text-balance">
        {guide.headline}
      </h1>
      <p className="mt-2.5 text-[15px] leading-relaxed text-nova-muted max-w-[46ch]">
        {guide.tagline}
      </p>

      <div className="mt-8 grid gap-4 grid-cols-1 sm:grid-cols-3">
        {guide.examples.slice(0, 3).map((caption, i) => (
          <figure
            key={caption}
            className="group bg-nova-card rounded-nova-lg p-2 transition-all duration-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_8px_rgba(0,0,0,0.4)] hover:border-nova-borderLight hover:-translate-y-0.5"
          >
            <img
              src={exampleImage(toolId, i + 1)}
              alt={caption}
              width={640}
              height={360}
              loading="lazy"
              decoding="async"
              className="w-full aspect-video object-cover rounded-nova-md"
            />
            <figcaption className="px-2 pt-2.5 pb-1 text-[12.5px] leading-snug text-nova-muted group-hover:text-nova-text transition-colors">
              {caption}
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={openGuide}
          className="text-[13px] font-medium text-nova-text hover:border-nova-borderLight hover:bg-nova-elevated rounded-nova-md px-3.5 py-2 transition-all active:scale-[0.98]"
        >
          How it works
        </button>
        {price && (
          <p className="text-[12.5px] text-nova-subtle">
            From{""}
            <b className="tabular-nums text-nova-text font-semibold">
              ₦{price.naira.toLocaleString()}
            </b>
            {""}
            for {price.label}. Nothing is charged until it works.
          </p>
        )}
      </div>
    </div>
  );
}
