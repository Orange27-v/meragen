# Meerah — DESIGN.md
> Night studio. Navy-slate ground, indigo action, prices in Naira on every button.

**Theme:** dark (single theme — see *Do's and Don'ts*)

**Tools:** eleven. App Shelf was removed — it generated nothing, and a voting
form sitting in a row of things that make videos taught the wrong thing about
what this product is.

Meerah is a pay-as-you-go AI studio for Nigerian creators and small businesses. The
interface is a workbench, not a brochure: a deep navy-slate ground (`#0e1422`) that
video and image results sit on without competing, near-white ink, and one indigo
(`#4f46e5`) that carries every action worth taking. The palette is lifted from
novapresenterpro.com — including its periwinkle ramp, which is what makes an indigo
system readable on a dark ground.

Geometry is one tight radius — 8px on every container, from a tag to a dialog —
with 1px hairlines instead of drop shadows. Typography is one family
(DM Sans) from a 10px label to a 64px display.

The system's signature is the **live cost meter**: every generate button states the
price in Naira and the balance left after the job, recalculated as options change.
Nothing else on a studio page competes for attention.

## Tokens — Colors

### Ground

| Name | Value | Token | Role |
|------|-------|-------|------|
| Void | `#050811` | `--void` | The page behind the app; base of the modal scrim |
| Sunk | `#0a0f1b` | `--sunk` | Header and settings rail — recessed from the canvas |
| Night | `#0e1422` | `--night` | The canvas everything sits on |
| Slab | `#181d2b` | `--slab` | Cards, inputs, popovers (white 4% over the canvas) |
| Slab Hi | `#1f2431` | `--slab-hi` | Hover, pressed, heavier surface (white 7%) |
| Hair | `#3a445c` | `--hair` | Dividers inside a surface — 1.9:1 on the canvas |
| Hair Hi | `#4f5c78` | `--hair-hi` | The edge of a card or control — 2.8:1 |
| Hair Lit | `#5f6d8d` | `--hair-lit` | The same edge, hovered or focused — 3.6:1 |
| Hair Inner | `#2b3242` | `--hair-inner` | The inner core of a nested card, quieter than its shell |

The first pass set the hairline at `#1f2431`, which measures **1.19:1** against
the canvas. Below roughly 1.5:1 an edge does not register at all, so every card
dissolved into the navy and the whole product read as one undifferentiated
surface. These four are chosen by measurement, not by eye.

### Ink

| Name | Value | Token | Role |
|------|-------|-------|------|
| Chalk | `#fbfbfb` | `--chalk` | Headlines, primary text, values |
| Paper Ink | `#e2e6ee` | `--paper-ink` | Body copy |
| Iron | `#aab2c4` | `--iron` | Labels, outlined-button text |
| Steel | `#98a1b5` | `--steel` | Supporting metadata |
| Fog | `#828b9f` | `--fog` | Helper text, uppercase section labels |
| Ash | `#6b7488` | `--ash` | Placeholders, disabled |

### Accent — one family, three jobs

| Name | Value | Token | Role |
|------|-------|-------|------|
| Indigo | `#4f46e5` | `--indigo` / `--action` | Filled primary actions. **Never used as text on the ground** |
| Indigo Hi | `#6d64f0` | `--indigo-hi` | Hover on a filled action |
| Periwinkle | `#7d76ff` | `--peri` | Outlines, focus rings, selected borders, slider tracks |
| Lilac | `#a5a1ff` | `--lilac` / `--marigold` | Accent **text** and small marks |
| On Action | `#ffffff` | `--on-action` | Ink on a filled indigo surface |

Indigo on navy measures about 2.5:1 — unreadable as type. That is the whole reason
the family splits: indigo fills, periwinkle outlines, lilac writes.

### Veils and status

| Name | Value | Token | Role |
|------|-------|-------|------|
| Scrim | `rgba(5,8,17,.78)` | `--scrim` | Behind a dialog or fullscreen viewer |
| Veil | `rgba(10,15,27,.72)` | `--veil` | Over a card while it renders |
| OK | `#34d399` | `--ok` | Good state — always with a shape, never colour alone |
| Danger | `#fb7185` | `--danger` | Failure, refund, over-budget |

## Tokens — Typography

### DM Sans — one family for every role

- **Weights:** 400, 500, 600, 700
- **Sizes:** 10, 11, 12, 13, 14, 15, 18, 20, 32, 40, 56, 64
- **Display rule:** never below weight 600 — the weight is what makes the headline read as authoritative
- **Numerals:** `font-variant-numeric: tabular-nums` (`.tabular`) anywhere digits line up — prices, credits, metrics

### Type Scale

| Role | Size | Line Height | Token |
|------|------|-------------|-------|
| caption | 12px | 1.64 | `--text-caption` |
| body | 15px | 1.45 | `--text-body` |
| body-lg | 18px | 1.45 | `--text-body-lg` |
| subheading | 20px | 1.5 | `--text-subheading` |
| heading-sm | 32px | 1.5 | `--text-heading-sm` |
| heading | 40px | 1.28 | `--text-heading` |
| heading-lg | 56px | 1.28 | `--text-heading-lg` |
| display | 64px | 1.12 | `--text-display` |

Uppercase section labels are a fixed treatment: 10.5px, weight 500, `.14em` tracking,
in `--fog`.

## Tokens — Spacing & Shapes

**Base unit:** 4px · **Density:** compact

| Element | Value | Token |
|---------|-------|-------|
| every container — tags, buttons, inputs, cards, dialogs | 8px | `--radius` |
| the inner core of a nested card | 5px | — (8 − 3 padding) |
| pills, avatars, circular controls | 10000px | `--radius-pill` |

`--radius-tag`, `--radius-button` and `--radius-card` all alias `--radius`; they
survive only so existing components keep compiling. Tailwind's whole radius scale
is flattened to the same value, so `rounded-lg` and `rounded-3xl` are both 8px.

| Measure | Value | Token |
|---------|-------|-------|
| page shell | 1200px | `--shell` |
| section gap | 80px | `--section-gap` |
| card padding | 28px | `--card-pad` |
| reading measure | 65ch | `--measure` |
| settings rail | 370px | — |
| header height | 56–68px | — |

## Components

### Primary action (filled indigo)
`--action` fill, `--on-action` text, 1px `#6058ea` border, `--radius-button`, 12/16
padding, 14px weight 500. Depth comes from a 1px inset white highlight at 22% and a
tight `0 1px 2px rgba(0,0,0,.5)` — not a soft drop shadow. Hover moves to
`--indigo-hi`.

### Ghost action
`--surface` fill, `--iron` text, 1px `--line`. Hover lifts to `--surface-hi`,
`--line-hi`, `--chalk`.

### Settings rail
370px, `--sunk`, hairline right border. A scrolling body of labelled sections and a
pinned footer holding the cost meter and one full-width action. Every studio has one;
the tools that generate nothing still use it for navigation (App Shelf's categories).

### Cost meter
Pinned above the action. Three facts, in order: credits, the Naira equivalent, and
the balance after this job. When the balance is short the action becomes **Buy
credits** and opens the top-up sheet — it never charges and then errors.

### Quality tier row
A radio row per tier. Selected: 1px `--peri` border, a `--peri` ring, and a
`color-mix(--action 12%)` fill. Unselected: `--surface` on `--line`, label in
`--iron`. Price right-aligned and tabular; credits beneath it in `--ash`.

### Tool showcase (the empty work area)

What a tool makes, shown before you have made anything. Eyebrow in `--lilac`,
a 28–34px headline, a tagline in `--iron`, then three **nested cards**: an outer
shell on `--sunk` with a `--line` border and 6px padding, holding an image with
its own `--line-inner` border at a concentric 5px radius. Caption in `--steel`,
lifting to `--paper-ink` on hover. Below: a How-it-works button and the live
from-price. Once there is history it collapses to a single quiet strip — your own
work never competes with our examples.

The nesting is the point. A single flat rectangle on the canvas reads as a patch
of different colour; a core inside a shell reads as an object.

### Tool guide dialog
`--scrim` behind, `--slab` panel at `min(840px, 100%)`, 8px radius. Order: tool name
in `--lilac`, a 32px headline, a `--iron` tagline, three numbered step cards on
`--sunk`, then What this is / What it needs / How long / What it costs / The panel on
the left / Getting a better result. Opens itself the first time a tool is visited and
stays quiet afterwards.

### Nav mega-dropdown
Five groups (Video · Image · People · Selling · More). Each opens a two-column panel:
Tools with a one-line description, Quality with spec and Naira price. 150ms to open,
250ms grace to close, Escape closes, full keyboard path.

### Tag pill
Transparent on a 1px `--line`, text `--paper-ink`, `--radius-tag`, 4/8 padding, 13px.

### Accent badge
`--action` fill, `--on-action` text, `--radius-tag`. The only filled chromatic chip.

## Do's and Don'ts

### Do
- Use `--action` for every primary action; there is exactly one per view
- Write accent text in `--lilac` and draw accent outlines in `--peri`
- Use 1px `--line` hairlines for elevation; the only shadows in the system are on the filled action and popovers
- State the price in Naira on the button that spends money, and the balance after it beside
- Keep quality choices to the curated tiers — Draft, Standard, HD, Premium, Studio
- Pair every status colour with a shape or a word, so colour is never the only signal
- Take prices from `GET /api/v1/pricing` at runtime, always
- Filter tiers on `tier.kind`, never by reading the wording of `tier.spec`

### Don't
- Do not set indigo as text on the navy ground — it fails contrast; use `--lilac`
- Do not add a second accent family; indigo → periwinkle → lilac is the whole range
- Do not use an opaque scrim — `--scrim` and `--veil` are translucent on purpose
- Do not write a hex literal in a component; every colour comes from a token
- Do not apply Tailwind's `/NN` opacity modifier to a `var()` colour — it is silently dropped. Use `color-mix(in_srgb,var(--x)_NN%,transparent)`
- Do not introduce a second radius; `--radius` is the only one, and `rounded-full` is for circles only
- Do not put a flat card straight on the canvas — nest a core inside a shell, with a concentric radius
- Do not ship a border below 1.8:1 against the surface behind it; measure, do not eyeball
- Do not leave a work area empty — an empty state is the cheapest place to show what a tool makes
- Do not show a vendor or model name anywhere a customer can read it — including error text
- Do not set a display headline below weight 600
- Do not use pure black; `--void` (`#050811`) is the deepest ground

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| −1 | Void | `#050811` | Behind the app; scrim base |
| 0 | Sunk | `#0a0f1b` | Header, settings rail |
| 1 | Night | `#0e1422` | The canvas |
| 2 | Slab | `#181d2b` | Cards, inputs, dialogs |
| 3 | Slab Hi | `#1f2431` | Hover and pressed states |

Note the inversion against a light system: recessed chrome is *darker* than the
canvas, and cards are *lighter*. Depth reads as lift, not as shadow.

## Elevation

- **Filled action:** `inset 0 1px 0 0 rgba(255,255,255,.22), 0 1px 2px 0 rgba(0,0,0,.5)`
- **Card:** none — 1px `--line` hairline
- **Popover / dialog:** `0 10px 40px rgba(0,0,0,.8)` plus a 1px `--line` border

## Layout

Two densities share one header. **App** density (`/create/[tool]`) is full-height and
does not scroll the page: a 56px header, a 370px settings rail on the left, and the
work area filling the rest. **Page** density (`/studio`, `/saved`, `/calendar`,
`/admin`, `/pricing`) is a 1200px scrolling shell with 80px between sections.

Every tool is a real route (`/create/videngine`), so tools deep-link, survive a
refresh, and work with the back button.

## Responsive Behavior

| Breakpoint | Behaviour |
|------------|-----------|
| ≥1100px | Rail and work area side by side; nav dropdown on hover and focus |
| <1100px | Rail stacks above the work area; nav collapses to a sheet; dropdown opens on tap |
| <420px | Single column; step cards stack; the action stays full-width and pinned |

Touch targets are at least 38px. Wide content — tables, model grids — scrolls inside
its own container; the page body never scrolls sideways.

## Agent Prompt Guide

**Quick colour reference**
- Background: `#0e1422`
- Recessed chrome: `#0a0f1b`
- Card surface: `#181d2b`
- Text primary: `#fbfbfb`
- Text secondary: `#aab2c4`
- Text muted: `#828b9f`
- Divider: `#3a445c`
- Card edge: `#4f5c78`
- Primary action: `#4f46e5` (white text)
- Accent text: `#a5a1ff`

**Example component prompts**

1. *Settings rail* — 370px column on `#0a0f1b` with a 1px `#4f5c78` right border.
   Sections labelled 10.5px uppercase, weight 500, `.14em` tracking, `#828b9f`.
   Scrolling body, pinned footer holding a cost card on `#181d2b` and a full-width
   `#4f46e5` button with white text at 8px radius.

2. *Quality tier row* — full-width button, 8px radius, 12/12 padding. Unselected:
   `#181d2b` on 1px `#4f5c78`, label 13px `#aab2c4`, spec 11px `#828b9f`. Selected:
   1px `#7d76ff` border plus a 1px `#7d76ff` ring and a 12% indigo fill; label turns
   `#fbfbfb` weight 600. Price right-aligned, tabular, `#fbfbfb`; credits beneath in
   `#6b7488`.

3. *Tool guide dialog* — `rgba(5,8,17,.78)` scrim with a 3px blur. Panel
   `min(840px,100%)` on `#181d2b`, 1px `#4f5c78`, 8px radius, 34/36 padding. Eyebrow
   10.5px uppercase `#a5a1ff`; headline 32px weight 600 `#fbfbfb` at 1.08; tagline
   18px `#aab2c4`. Three step cards on `#0a0f1b`, each with a two-digit numeral in
   11px `#7d76ff`.

4. *Cost meter* — card on `#181d2b`, 1px `#4f5c78`, 8px radius. Left: credits at
   13px weight 600 `#fbfbfb`; right: the Naira price, tabular, same weight. Below, in
   11.5px `#828b9f`: the balance remaining after this job.

5. *Empty work area* — centred on `#0e1422`. Eyebrow 14px `#828b9f`, tool name 32px
   weight 600 `#fbfbfb`, one supporting line 14px `#828b9f` at `max-width: 32rem`.

## Geometry Philosophy

One radius, 8px, on everything that has corners — a tag, a button, an input, a
card, a dialog. The earlier system graded rounding by element size, which made a
card read as a different material from the button inside it. A single tight radius
reads as one surface cut consistently, and it suits a workbench better than
generous rounding does. Circles and pills are the only exception, because a
circular avatar or a toggle knob is a shape rather than a rounded rectangle.

## Quick Start

Tokens live in one place: `app/globals.css` (`:root`). `tailwind.config.js` maps every
theme colour to a `var()` reference, so the fork's Tailwind classes and the app's
inline styles resolve to the same palette. Change a token there and the whole product
moves; there is no second source.

```css
:root {
  --void: #050811;  --sunk: #0a0f1b;  --night: #0e1422;
  --slab: #181d2b;  --slab-hi: #1f2431;
  --hair: #3a445c;  --hair-hi: #4f5c78;
  --hair-lit: #5f6d8d; --hair-inner: #2b3242;

  --chalk: #fbfbfb; --paper-ink: #e2e6ee; --iron: #aab2c4;
  --steel: #98a1b5; --fog: #828b9f;       --ash: #6b7488;

  --indigo: #4f46e5; --indigo-hi: #6d64f0;
  --peri: #7d76ff;   --lilac: #a5a1ff;    --on-action: #ffffff;

  --scrim: rgba(5, 8, 17, .78);
  --veil:  rgba(10, 15, 27, .72);
  --ok: #34d399; --danger: #fb7185;
}
```

## Similar Brands

- **novapresenterpro.com** — the direct source of the navy ground, the indigo primary and the periwinkle ramp
- **Higgsfield** — the studio layout this dashboard is modelled on: a settings rail, a work area with History and How-it-works, and a cost on the generate button
- **Linear** — hairline borders instead of shadows, compact body text, one family throughout
