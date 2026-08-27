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

`packages/studio` is the studio UI, forked from
[Open-Generative-AI](https://github.com/Anil-matcha/Open-Generative-AI) (MIT).
