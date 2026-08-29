# Meerah — DESIGN.md
> Night studio. Navy-slate ground, indigo action, prices in Naira on every button.

**Theme:** dark (single theme — see *Do's and Don'ts*)

The raw palette is published as **HSL triplets** (`--night-hsl: 225 40% 12%`) and
every named token derives from one (`--night: hsl(var(--night-hsl))`). That is
not cosmetic: Tailwind's `/NN` opacity modifier silently drops the alpha on a
plain `var()` colour — it is how 136 tints died in an earlier pass — and it works
correctly on `hsl(var(--x) / <alpha>)`. shadcn's semantic names alias the same
triplets, so there is one palette, not two.

**Tools:** twelve, including MyVoice — the only one built on the shell's own
components rather than the forked studio package.

**Components:** shadcn/ui in `components/ui`, for the shell only. The 48,000-line
studio fork keeps its own Tailwind; rebuilding working generation code is not a
design task.

Meerah is a pay-as-you-go AI studio for Nigerian creators and small businesses. The
interface is a workbench, not a brochure: a deep navy-slate ground (`#12182a`) that
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
| Void | `#04070e` | `--void` | The page behind the app; base of the modal scrim |
| Sunk | `#0a0f1b` | `--sunk` | Header and settings rail — recessed from the canvas |
| Night | `#12182a` | `--night` | The canvas everything sits on |
| Slab | `#1e263a` | `--slab` | Cards, inputs, popovers |
| Slab Hi | `#2a3349` | `--slab-hi` | Hover, pressed, selected |
| Hair | `#3a445c` | `--hair` / `--line-soft` | A divider inside a surface, and an input's resting line |
| Hair Lit | `#5f6d8d` | `--hair-lit` / `--line-hi` | Focus, and the selected control — 3.6:1 |
| — | `transparent` | `--line` | A card's edge. There isn't one. |

Only three strokes survive anywhere in the product, and each carries meaning: an
input rest (without it a field and the card behind it are the same shape), a
focus ring (an accessibility requirement, not decoration), and the selected
quality tier. Everything else separates by tone.

### Ink

| Name | Value | Token | Role |
|------|-------|-------|------|
| Chalk | `#fbfbfb` | `--chalk` | Headlines, primary text, values |
| Paper Ink | `#e2e6ee` | `--paper-ink` | Body copy |
| Iron | `#b4bccb` | `--iron` | Labels, outlined-button text |
| Steel | `#a4adc0` | `--steel` | Supporting metadata |
| Fog | `#949db0` | `--fog` | Helper text, uppercase section labels |
| Ash | `#7b8499` | `--ash` | Placeholders and disabled **only** — 3.4:1 |

Every token above `--ash` clears **4.5:1 on all three surfaces**, checked against
the ladder rather than assumed. Two of them were lifted when the ground got
lighter: `--ash` from `#6b7488` (2.68:1) and `--fog` from `#828b9f` (3.68:1).

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
shell on `--sunk` and 6px padding, holding an image with
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
- Do not put a border on a card, panel or dropdown; tone separates surfaces. A stroke is for an input rest, a focus ring, or a selected control
- Do not show a vendor model name outside the Advanced drawer — it is opt-in, labelled, and the only place they belong
- Do not import `@meerah/studio` for a value at the top of a shell file; it drags the whole 700KB catalogue into that page's first load. Register inside the `dynamic()` chain instead
- Do not put a flat card straight on the canvas — nest a core inside a shell, separated by tone, with a concentric radius
- Do not ship a border below 1.8:1 against the surface behind it; measure, do not eyeball
- Do not leave a work area empty — an empty state is the cheapest place to show what a tool makes
- Do not show a vendor or model name anywhere a customer can read it — including error text, and including the network tab: vendor assets go through the `/vendor-img` and `/vendor-asset` rewrites, never a direct URL
- Do not use a Tailwind palette hue (`violet-500`, `emerald-400`); every colour comes from a token
- Do not set a display headline below weight 600
- Do not use pure black; `--void` (`#04070e`) is the deepest ground

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| −1 | Void | `#04070e` | Behind the app; scrim base |
| 0 | Sunk | `#0a0f1b` | Header, settings rail |
| 1 | Night | `#12182a` | The canvas |
| 2 | Slab | `#1e263a` | Cards, inputs, dialogs |
| 3 | Slab Hi | `#2a3349` | Hover and pressed states |

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
- Background: `#12182a`
- Recessed chrome: `#0a0f1b`
- Card surface: `#1e263a`
- Text primary: `#fbfbfb`
- Text secondary: `#b4bccb`
- Text muted: `#949db0`
- Divider and input rest: `#3a445c`
- Card edge: none
- Primary action: `#4f46e5` (white text)
- Accent text: `#a5a1ff`

**Example component prompts**

1. *Settings rail* — 370px column on `#0a0f1b` with a 1px `#3a445c` right border.
   Sections labelled 10.5px uppercase, weight 500, `.14em` tracking, `#949db0`.
   Scrolling body, pinned footer holding a cost card on `#1e263a` and a full-width
   `#4f46e5` button with white text at 8px radius.

2. *Quality tier row* — full-width button, 8px radius, 12/12 padding. Unselected:
   `#1e263a` on the canvas, label 13px `#b4bccb`, spec 11px `#949db0`. Selected:
   1px `#7d76ff` border plus a 1px `#7d76ff` ring and a 12% indigo fill; label turns
   `#fbfbfb` weight 600. Price right-aligned, tabular, `#fbfbfb`; credits beneath in
   `#7b8499`.

3. *Tool guide dialog* — `rgba(5,8,17,.78)` scrim with a 3px blur. Panel
   `min(840px,100%)` on `#1e263a`, 8px radius, 34/36 padding. Eyebrow
   10.5px uppercase `#a5a1ff`; headline 32px weight 600 `#fbfbfb` at 1.08; tagline
   18px `#b4bccb`. Three step cards on `#0a0f1b`, each with a two-digit numeral in
   11px `#7d76ff`.

4. *Cost meter* — card on `#1e263a`, 8px radius. Left: credits at
   13px weight 600 `#fbfbfb`; right: the Naira price, tabular, same weight. Below, in
   11.5px `#949db0`: the balance remaining after this job.

5. *Empty work area* — centred on `#12182a`. Eyebrow 14px `#949db0`, tool name 32px
   weight 600 `#fbfbfb`, one supporting line 14px `#949db0` at `max-width: 32rem`.

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
  /* Raw palette as HSL triplets; every named token derives from one, and
     shadcn's semantic names alias the same values. Hex shown for reference. */
  --void: #04070e;  --sunk: #0a0f1b;  --night: #12182a;
  --slab: #1e263a;  --slab-hi: #2a3349;
  --hair: #3a445c;  --hair-lit: #5f6d8d;

  --chalk: #fbfbfb; --paper-ink: #e2e6ee; --iron: #b4bccb;
  --steel: #a4adc0; --fog: #949db0;       --ash: #7b8499;

  --indigo: #4f46e5; --indigo-hi: #6d64f0;
  --peri: #7d76ff;   --lilac: #a5a1ff;    --on-action: #ffffff;

  --scrim: hsl(var(--void-hsl) / .82);
  --veil:  hsl(var(--sunk-hsl) / .76);
  --ok: #34d399; --danger: #fb7185;
}
```

## Similar Brands

- **novapresenterpro.com** — the direct source of the navy ground, the indigo primary and the periwinkle ramp
- **Higgsfield** — the studio layout this dashboard is modelled on: a settings rail, a work area with History and How-it-works, and a cost on the generate button
- **Linear** — hairline borders instead of shadows, compact body text, one family throughout
