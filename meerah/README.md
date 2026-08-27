# Meerah — Website

The landing page and the creator dashboard. **No business logic lives here** — no
database, no vendor keys, no pricing. Everything comes from the backend
([`../backend`](../backend)) over HTTP.

## Running it

The backend must be running first.

```bash
npm install
npm run dev            # http://localhost:3000
```

`next.config.mjs` forwards `/api/*` to the backend, so the browser only ever talks
to its own origin — no CORS, and no key or session handling in the bundle.

## Pages

| Page | What it is |
|---|---|
| `/` | Landing page, with the live MyVoice language demo |
| `/pricing` | Price table, read from the API so it never drifts |
| `/signin` | Google sign-in — the only way in |
| `/studio` | Simple mode: balance, buy credits, one video box |
| `/create` | Full studio: 12 tools, 600+ models |
| `/saved` | Saved characters, voices and brand kits |
| `/calendar` | Post Planner |
| `/admin` | The numbers. Owner only. |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run check:sw` | Proves the service worker never caches API responses |

## Design system

Built on the Awesomic style reference — an editorial zinc grid with
confetti-orange punctuation. The full reference is kept at
[`design-system.md`](design-system.md); the tokens live in `app/globals.css`.

The three rules it insists on, and which the code follows:

- **No second accent colour.** The palette is 99% achromatic. Ember `#ff5a00`
  appears on badges only — never body text, links or large fills. Emphasis
  otherwise comes from ink weight, not hue.
- **No drop shadows on cards.** A 1px `#ececee` hairline is the only elevation
  on content surfaces.
- **No sharp corners.** 12px on tags, 14px on buttons and inputs, 36px on cards.

The primary action is the dark filled button (`#09090b`) — the single most
important control in the system. One type family, DM Sans, carries every role
from a 12px label to a 64px display headline; display weights never drop below
600.

`packages/studio` is the studio UI, forked from
[Open-Generative-AI](https://github.com/Anil-matcha/Open-Generative-AI) (MIT).
