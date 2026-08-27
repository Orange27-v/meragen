# Meerah — Build Plan

> Naira-priced, pay-as-you-go AI video & content studio for Nigerian creators and SMBs.
> This document is the single source of truth for *what* we're building and *in what order*.

---

## 0. Source documents

| Doc | What it settles |
|---|---|
| `business-idea-summary.md.pdf` | The pitch, the moat, the traction target |
| `project-detailed-overview.md.pdf` | **Authoritative** feature list, pricing, projections (the `(1)` copy is an older draft — it lacks Post Planner / Auto Post; ignore it) |
| `technical-specification.md.pdf` | Stack, schema, vendor abstraction, job flow, build order |
| `style.md.pdf` | Higgsfield UI teardown → design patterns to adopt, and what to deliberately diverge on |
| `Open-Generative-AI/` | MIT-licensed OSS studio we can fork as the frontend (audited below) |

---

## 1. What we are building

A full-scope AI generation studio — feature parity with Higgsfield — sold in **Naira**, as **non-expiring pay-as-you-go credits** via **Paystack**. No free tier: every generation is prepaid, so the business is self-funding from day one (user money lands before vendor cost is incurred).

**Who it's for:** agencies, social-media managers, Instagram/WhatsApp vendors, real-estate agents. People with *repeat commercial* content needs — not casual one-off creators (CapCut/Canva own that segment for free and we cannot beat free).

**The two features that are the actual wedge** — everything else is table stakes a funded competitor can copy:
1. **MyVoice** — Nigerian-language voice cloning (Pidgin, Yoruba, Igbo, Hausa) from a 5-second sample, via 9jaLingo.
2. **BrandFace** — character/brand consistency across generations, via BytePlus.

**The moat is stickiness, not "we take Naira."** Local payments are copyable in 12–24 months. Saved characters, voice profiles, and brand templates make switching expensive. That is why brand-asset persistence is a launch feature, not a v2 nice-to-have.

### What is built, and where it comes from

**MuAPI is the primary aggregator for everything except MyVoice.** Verified against their live catalogue on 2026-08-27 (saved at `reference/muapi-catalog-2026-08-27.json`).

**Built and working** — 12 tools in the studio:

| Tool | Model | Sourced via |
|---|---|---|
| VidEngine — text or photo to video | Seedance 2.x, Veo 3.1/4, Kling v3.0 | MuAPI |
| Vibe Reel — one-tap motion presets | Seedance, Kling motion-control | MuAPI |
| ShotDirector — scene to shot list | LLMs (59 Text-to-Text, incl. GPT, Claude, Gemini) | MuAPI |
| Snip Reel — long video into clips | video-to-video | MuAPI |
| PixCraft — product shots, flyers | Seedream, FLUX, Nano Banana, Qwen | MuAPI |
| Patch Up — edit, replace, split layers | Seedream 5.0 layer, FLUX, image-to-image | MuAPI |
| TalkSync — make a face speak | `omnihuman-1-5` ($0.25), `creatify-lipsync` | MuAPI |
| Body Double — swap body, keep face | `seedance-2-character` ($0.18) | MuAPI |
| Star Maker — one consistent brand face | `*-omni-reference` | MuAPI |
| Sales Reel — ad creative for social | Seedance, image-to-video | MuAPI |
| SoundTrack — music and voiceover | Suno, MMAudio (18 Text-to-Audio) | MuAPI |
| App Shelf — vote on what we build next | — | in-house |

Plus, outside the studio: **SharpUp** upscaling (`topaz-*`, $0.075–$0.08) as a price tier, the **Saved** layer (characters, voices, brand kits), and **Post Planner**.

**Not built, and honest about why:**

| Feature | Status |
|---|---|
| **MyVoice** — Pidgin/Yorùbá/Igbo/Hausa voice cloning | **Blocked on the 9jaLingo partnership.** Not available on MuAPI — I checked the catalogue. This is the differentiator, and the only vendor integration we must build ourselves. |
| **Auto Post** — publish direct to Instagram/Facebook | **v2 by decision, not omission.** Needs Meta App Review plus Business Manager verification: two external approval queues on timelines we do not control. A bootstrapped launch cannot burn runway waiting on them. The API refuses non-manual platforms rather than accepting them and silently never publishing. |
| **WhatsApp Auto Post** | **Permanently manual.** No reliable auto-post API exists. |
| Buzz Meter, Plot Board, Link Magic, Fit Frame, Real Lens, Shot Vault, Skin Layer, FrameControl | Named in the original brief, never built. All are prompt-layer or LLM features on models we already have — cheap to add, but none is a launch blocker, and advertising unbuilt features to agencies is the fastest way to lose them. Removed from the landing page. |
| Squad Edit — collaboration | v2. Infrastructure, not a differentiator (open decision 4). |
| Workflows, Agents, Design Agent | v2. Each needs a separate git submodule plus 20–30 backend endpoints. |

**Also deferred to v2:** mobile app, Chrome extension.

### Money

- Pricing per 5s video: Basic 480p ₦300–350 (~72% margin) → Studio 4K ₦18–20k (~26%). Blended ≈ **47% gross margin**.
- Credits are **non-expiring** — deliberate contrast with Higgsfield's 90-day expiry, which its users complain about. Market it.
- Second revenue line: **Post Planner + Auto Post as a flat ₦3,000–8,000/month add-on** on top of PAYG credits.
- Launch cost ₦300–650k (mostly vendor float), inside a ₦500k–1M bootstrap. **Keep ₦150–250k standing vendor float at all times** — Paystack settles T+1/T+2 and a dry vendor account means failed generations.
- Target: 100 paying users recovers launch cost; 1,000 users ≈ $4.6k+ MRR, near the African seed traction bar.

---

## 2. Non-negotiables

These are the things that, if we get them wrong, sink the product. Every phase below is ordered around them.

1. **Financial integrity.** Credit deduction is atomic and race-free: one Postgres transaction, `SELECT … FOR UPDATE` on the user row → insert ledger row → update cached balance. The `credit_transactions` ledger is append-only and is the source of truth; `users.credit_balance` is a cache.
2. **The server prices the job.** The frontend displays a quote; the server independently recomputes cost at charge time. Never charge a client-supplied number.
3. **Paystack webhook is the only payment truth.** Client callbacks can be spoofed or dropped. Unique constraint on `paystack_ref` makes duplicate webhook deliveries harmless.
4. **Failed generation → automatic credit refund**, written as a ledger entry, with a plain-English message. Trust is the whole retention story.
5. **Nothing blocks on generation.** HTTP returns a `generation_id` immediately; BullMQ workers do the work; the client polls.
6. **Mobile-first, flaky-network-first.** ~69% of Nigerian traffic is mobile, often the *only* device. Low-res previews by default, no autoplay, resumable uploads, status that recovers from a dropped connection. Target mid-range Android, not flagships.
7. **Vendor keys never reach the browser.**

---

## 3. Codebase audit — what `Open-Generative-AI/` actually is

I read it. Findings:

- **License: MIT** (root, and each submodule package). Commercially forkable with attribution. ✅
- **It is a thin BYOK client, not a platform.** The user pastes their own MuAPI key into `localStorage`; the browser talks to `api.muapi.ai` directly (or through Next.js proxy routes to dodge CORS). There is **no backend of ours, no database, no payments, no credit ledger** in it. MuAPI holds the models, the queue, the balance and the history.
- **Two parallel frontends live in the repo:**
  - `src/` — the original vanilla-JS Vite app, wrapped by Electron (`electron/`) for desktop builds, plus local-inference support (`electron/lib/wan2gpProvider.js`). *We don't need this.*
  - `app/` + `packages/studio/` — the current Next.js 15 / React 19 app. **This is the part worth forking.**
- **`packages/studio/`** is a workspace package exporting 16 studio components: `ImageStudio`, `VideoStudio`, `LayersStudio`, `ClippingStudio`, `VibeMotionStudio`, `LipSyncStudio`, `RecastStudio`, `CinemaStudio`, `AudioStudio`, `MarketingStudio`, `WorkflowStudio`, `AgentStudio`, `DesignAgentStudio`, `AppsStudio`, `McpCliStudio`, `AiInfluencerStudio`. These map remarkably well onto our feature list (VideoStudio→VidEngine, ImageStudio→PixCraft, LipSyncStudio→TalkSync, MarketingStudio→Sales Reel, CinemaStudio→ShotDirector, VibeMotionStudio→Vibe Reel, LayersStudio→Patch Up/Skin Layer).
- **`components/StandaloneShell.js`** (1,174 lines) is the app shell: left-nav tab registry, API-key gate, notification tray, and a **balance display that polls every 30s** (`getUserBalance`). Our credit balance drops straight into that slot.
- **`packages/studio/src/muapi.js`** (987 lines) is the single API client. **Every studio component takes `apiKey` as a prop** and calls through this one module — so there is exactly one file to repoint at our backend.
- **`packages/studio/src/models.js`** is 23,465 lines, auto-generated from `models_dump.json`: a JSON-schema-driven model registry (`id`, `name`, `endpoint`, `inputs` with enums/defaults, `provider`). The UI renders its controls *from this schema* (`ModelParameterControls.jsx`, `modelParameters.js`, `imageSizing.js`). **This is the highest-value thing in the repo** — a schema-driven generation UI we don't have to invent. We regenerate this file for our own catalog.
- **The wire protocol is submit-then-poll**, with the poll response already carrying a `cost: { refunded, amount_credits }` object that `generationLifecycle.js` turns into a user-facing "Refunded N credits" notice. **MuAPI's contract already has the exact shape our credit+refund model needs.**

### The full API surface the client expects

Core generation (must-have):
```
POST /api/v1/{endpoint}                     → { request_id }
GET  /api/v1/predictions/{id}/result        → { status, outputs[], cost{} }
GET  /api/v1/predictions/{id}/media
GET  /api/v1/account/balance                → { balance }
POST /api/v1/app/calculate_dynamic_cost     → live quote
GET  /api/v1/models/{endpoint}/estimate-cost
GET  /api/v1/history?cursor=&limit=
POST /api/v1/upload_file
```
Auth: `x-api-key` header. Statuses: success = `completed|succeeded|success`, failure = `failed|error|cancelled|canceled`.

Deferrable (workflows/agents — 20+ endpoints under `/workflow/*` and `/agents/*`): not needed at launch. Hide those tabs.

---

## 4. The core architectural decision

**Fork the Next.js studio frontend. Use MuAPI as the single generation aggregator behind our own metered API. Integrate 9jaLingo directly. Keep the vendor abstraction anyway.**

### Why MuAPI instead of four direct vendors

I pulled MuAPI's live public catalog (`GET /api/v1/models`, no key required) and verified it. **632 models**, each with a `cost` in USD, a `dynamic_pricing` flag, and its own `estimate-cost` endpoint:

| Category | Models | Category | Models |
|---|---|---|---|
| Image to Video | 167 | Text to Text (LLMs) | 59 |
| Text to Video | 102 | Text to Audio | 18 |
| Image to Image | 71 | Lora Support | 17 |
| Video to Video | 71 | Audio to Video | 13 |
| Text to Image | 69 | Training | 13 |
| | | Image/Text to 3D | 10 |

It covers **three of our four planned vendors outright**:
- **OpenRouter's job** — full Seedance family (137 variants), Veo 3.1/4, Kling, plus 59 LLMs including GPT, Claude and Gemini. ✅
- **BytePlus's job** — `omnihuman-1-5` at $0.25 (TalkSync) and `seedance-2-character` at $0.18 / omni-reference variants (BrandFace). ✅ This also kills the "BytePlus is poorly documented, effort unknown" risk from the original plan.
- **Topaz's job** — `topaz-image-upscale` $0.075, `topaz-video-upscale` $0.08. ✅

The decisive practical argument: **the forked frontend already speaks MuAPI natively.** `models.js` — the 23k-line schema-driven catalog that drives every generation control in the UI — stays valid. No regeneration, no client rewrite, no per-vendor payload mapping. That deletes most of the original Phases 3, 4 and 7.

### What MuAPI does *not* cover

**Nigerian-language voice cloning does not exist on MuAPI.** I searched the catalog for it. There is generic voice cloning (`minimax-voice-clone`, $0.65) and multilingual TTS (ElevenLabs, Gemini), but **nothing in Yoruba, Igbo, Hausa or Pidgin**.

So **9jaLingo remains a direct integration, and MyVoice remains the single hardest external dependency.** This is not a disappointment — it is confirmation. The one thing an aggregator can't hand us is precisely the thing that makes us defensible. If MuAPI had it, so would every competitor.

### Therefore: keep the `GenerationVendor` abstraction

The interface stays exactly as specced. It costs perhaps a day to write and it is what makes the user's own "start with MuAPI, add direct providers later where pricing or quality wins" strategy actually executable. Modules become `MuApiModule` (primary), `NineJaLingoModule` (MyVoice), and later `OpenRouterModule` / `BytePlusModule` when volume justifies going direct on a specific model. Without the seam, that migration is a rewrite; with it, it is a config-map change.

### Net effect on the build

Our API becomes a **metered, Naira-priced, credit-ledgered proxy in front of MuAPI**, plus one direct vendor for the wedge feature. We keep control of exactly what we should own — the money, the pricing, the customer, the saved brand assets — and rent the part that is undifferentiated infrastructure.

**Alternatives rejected:**
- *Four direct vendor integrations at launch* — the original plan. Now clearly premature optimization: four auth schemes, four error models, four floats to monitor, four sets of docs to reverse-engineer, for margin gains that are unverified and, per §6 below, small relative to FX risk.
- *Client talks to MuAPI directly with the user's own key* — that's the OSS app's BYOK design. It cannot charge Naira, cannot meter credits, and hands the customer relationship to MuAPI. Non-starter.
- *Keep the Electron desktop app* — irrelevant to a mobile-first Nigerian market. Delete it.

## 5. Target architecture

```
meerah/
├── apps/
│   ├── api/          NestJS — REST, auth, credits, Paystack, vendor routing
│   ├── worker/       BullMQ consumers — vendor calls, R2 upload, refunds
│   └── web/          Next.js (forked studio) — PWA
├── packages/
│   ├── studio/       forked UI components (muapi.js → meerahClient.js)
│   ├── catalog/      model registry + pricing table (generates models.js)
│   └── shared/       TypeScript types shared by api/worker/web
└── infra/            docker-compose, nginx/caddy, deploy scripts
```

**Runtime:** Contabo VPS running the API process, one or more worker processes, Postgres, Redis (or Upstash). PM2 or Docker Compose for supervision, Caddy in front for TLS. Cloudflare R2 for assets (zero egress — decisive over Bunny, whose Africa bandwidth tier is its most expensive at $0.06/GB). Cloudflare CDN free tier. Sentry + an uptime checker, non-negotiable because real money moves through this.

**Vendor abstraction** — every vendor implements one interface, and feature→vendor routing lives in a single config map, never in scattered conditionals:

```ts
interface GenerationVendor {
  estimateCost(params: GenerationParams): Promise<CreditCost>;
  submitJob(params: GenerationParams): Promise<VendorJobHandle>;
  checkStatus(handle: VendorJobHandle): Promise<JobStatus>;
  fetchResult(handle: VendorJobHandle): Promise<AssetResult>;
}
```
Modules at launch: **`MuApiModule`** (primary — everything except MyVoice) and **`NineJaLingoModule`** (MyVoice). `OpenRouterModule` / `BytePlusModule` / `TopazModule` are added later only where going direct beats MuAPI on price or quality at our actual volume. **Error normalization still matters** — MuAPI and 9jaLingo fail differently (timeout, rate limit, content-policy rejection, insufficient vendor balance), and both map into one internal taxonomy so refund logic reacts identically regardless of which vendor broke.

**Generation flow:** request → server cost estimate + row-lock balance check → single transaction (ledger entry + `generations` row `queued` + BullMQ push) → return `generation_id` immediately → worker calls vendor → success: asset to R2, `completed`, signed URL / failure: `failed` + automatic refund ledger entry + plain-English message. Transient errors retry with BullMQ exponential backoff; permanent ones (policy rejection, invalid input) fail fast and refund immediately.

**Data model** (per spec §3): `users`, `credit_transactions` (append-only ledger), `generations` (with `input_params` JSONB), `brand_assets` (`character | voice_profile | template`, holding `vendor_reference` — the 9jaLingo voice ID or BytePlus character ID). Plus, for later phases: `scheduled_posts`, `social_accounts`, `subscriptions`.

**Design language** (per style teardown): one dominant accent on a dark high-contrast base; product-as-hero (lead with real generated output, never stock imagery); card-grid preset browsing as first-class navigation (this *is* Shot Vault and Vibe Reel); motion tied to subject matter — camera-path sweeps, generation-in-progress animation; plain declarative feature copy. **Deliberately diverge from Higgsfield's neon-green-on-black** — a near-clone reads as derivative. Palette needs its own brainstorm pass rooted in Nigerian visual identity, and microcopy should be Nigerian-English/Pidgin-aware where it fits.

---

## 6. Margin reality check ⚠️ *(new — this is bigger than the vendor choice)*

I priced the five tiers against MuAPI's actual rate card. The result reframes the risk.

**First, the good news: MuAPI is not eating the margin.** At ₦1,500/$ the overview's cost column lines up almost exactly with MuAPI's published prices — Basic 480p's assumed ₦90 cost *is* `seedance-pro-t2v-fast` at $0.06; Studio 4K's ₦14,040 *is* `seedance-2.5-intl-text-to-video-4k` at $9.35. Three of five tiers match to within rounding. Whatever markup MuAPI takes is already inside the numbers the business plan was built on. **The "reseller stacks margin on us" objection does not survive contact with the data.**

**Now the real problem.** Our cost base is USD; our retail prices are fixed Naira. Modelling a plausible tier→model mapping:

| Tier | Model | Vendor | Storage | Credits | Price | Margin |
|---|---|---|---|---|---|---|
| Draft — 5s · fast · 480p | `seedance-pro-t2v-fast` | $0.06 | ₦0.6 | **6** | ₦300 | 70% |
| Standard — 5s · 720p | `seedance-2.1-text-to-video` | $0.40 | ₦1.4 | **25** | ₦1,250 | 52% |
| HD — 5s · 1080p | `seedance-2.5-text-to-video` | $1.70 | ₦3.2 | **93** | ₦4,650 | 45% |
| Premium — 5s · 1080p · top model | `seedance-2.5-text-to-video-1080p` | $4.25 | ₦3.2 | **197** | ₦9,850 | 35% |
| Studio — 5s · 4K | `seedance-2.5-text-to-video-4k` | $8.50 | ₦11.9 | **366** | ₦18,300 | 30% |

**1 credit = ₦50.** Every price rounds up to a ₦50 boundary so a credit is always a whole number; the engine throws rather than rounding if one escapes that grid.

Prices are **derived, not typed in**: vendor cost (synced daily from MuAPI's public rate card) plus storage (R2 at $0.015/GB-month, held 12 months) plus the naira rate, then the tier's target margin, rounded up. **The FX hole is therefore closed structurally** — at ₦1,750/$ and ₦2,200/$ the *price* moves and the margin holds, where before Premium went negative.

Paystack's cut is accounted separately, because it is charged on money coming *in*, not per generation: 1.5% + ₦100, the ₦100 waived below ₦2,500, capped at ₦2,000. A ₦5,000 pack is ₦4,825 of real revenue.

**Premium 4K goes negative at ₦1,750/$.** Roughly a 15% naira depreciation turns our second-most-expensive tier into a loss-maker at its advertised floor price.

And it compounds with a design decision we've been treating as a pure win: **non-expiring credits are an unhedged FX liability with no time limit.** A user can buy credits at ₦1,500/$ and redeem them eighteen months later at ₦2,000/$, and we eat the entire difference. Higgsfield's 90-day expiry — which we planned to attack as anti-user — is, among other things, an FX and cost hedge. We should still beat them on it, but with eyes open.

**What this changes:**
1. **Denominate in credits, not Naira.** A credit is an internal unit. The credit→generation price is recomputed on an FX schedule; the ₦→credit purchase price floats with the rate. Users' *balances* never expire — the number of credits a given generation costs is what moves. This preserves the marketing promise while removing the unbounded exposure.
2. **Set a margin floor in code.** The pricing engine refuses to quote below a configured floor (say 20%) and alerts instead. This is the guardrail that would have caught Premium 4K.
3. **Re-verify the two unmatched tiers.** HD 1080p (₦1,350 ⇒ $0.90) and Premium 4K (₦5,510 ⇒ $3.67) have no exact model match — the assumed costs may be stale. Pin each tier to a specific MuAPI model id before publishing prices.
4. **Automate rate-card monitoring.** `GET /api/v1/models` is public and unauthenticated. A daily job diffs it against our pinned prices and alerts on any change. Most models carry `dynamic_pricing: true`, so prices *will* move.
5. **Watch the FX rate as a business metric**, not a background fact. It belongs on the same dashboard as churn and conversion.

## 7. Build plan

Sequenced so the platform is **launchable at reduced scope at several points**, not only at the end. Money first, then the core revenue feature, then breadth, then stickiness.

### Phase 0 — Foundations (before any feature code)
- Decide the name (see Open Decisions) and register the domain.
- `git init` the monorepo; scaffold `apps/api` (NestJS + TypeScript), `apps/web`, `packages/shared`.
- Docker Compose for local Postgres + Redis.
- Prisma schema for the four core tables; first migration.
- CI: typecheck, lint, test on push.
- Accounts opened and funded: **MuAPI**, **9jaLingo**, Paystack (test mode), Cloudflare (R2 bucket), Contabo, Sentry. (OpenRouter/BytePlus/Topaz deferred — see §4.)
- **Done when:** `docker compose up` gives a running API against a migrated DB, and every vendor account has a working test key checked into the secrets manager (never the repo).

### Phase 1 — The credit ledger ⚠️ *the highest-risk code in the product*
- `CreditsService.charge()` / `.refund()` / `.topup()`: one transaction, `SELECT … FOR UPDATE` on the user row, ledger insert, cached-balance update, `balance_after` recorded.
- Refuse to go negative. Every mutation carries an idempotency key.
- **Explicit race-condition tests:** fire N concurrent charges against a balance that can only fund N−1 and assert exactly one fails and the ledger sums to the cached balance. Same for duplicate refunds.
- Auth: email/password (Argon2), session tokens, rate limiting.
- **Done when:** the concurrency test suite is green and a reconciliation query proves `sum(ledger) == users.credit_balance` for every user under load.

### Phase 2 — Paystack topup
- Credit packs defined in Naira. Server-side checkout init.
- `POST /webhooks/paystack`: signature verification, then `charge.success` → topup ledger entry. Unique constraint on `paystack_ref` absorbs duplicate deliveries.
- Reconciliation job comparing Paystack transactions to our ledger daily.
- Vendor-float monitor: minimum-balance alert per vendor account, replenished from the business buffer, *not* from same-day settlement.
- **Done when:** a test-mode payment credits the account exactly once even when the webhook is replayed five times, and a signature-invalid webhook is rejected.

### Phase 3 — Pricing engine *(much smaller now)*
`models.js` stays as-is — MuAPI's catalog is already the right catalog. We build the layer on top:
- Import `GET /api/v1/models` into a `model_prices` table: model id, USD cost, `dynamic_pricing`, our pinned tier, our margin multiplier.
- `quote(feature, params) → { credits, naira, breakdown }`, using MuAPI's per-model `estimate-cost` endpoint for `dynamic_pricing` models rather than a static guess.
- **Margin floor enforced in code** — refuse to quote below the configured floor, alert instead (§6).
- Daily rate-card diff job with alerting.
- FX rate as a configured, monitored input — not a constant.
- **Done when:** every tier is pinned to a specific model id, margin-floor tests pass, and a simulated MuAPI price rise triggers the alert instead of silently eating margin.

### Phase 4 — Vendor abstraction + VidEngine (first revenue feature)
- `GenerationVendor` interface + **`MuApiModule`** (video, image, audio, LLM — one integration, one auth scheme, one float).
- Feature→model config map.
- Error taxonomy: `TRANSIENT | RATE_LIMITED | POLICY_REJECTED | INVALID_INPUT | VENDOR_INSUFFICIENT_FUNDS | UNKNOWN`, with MuAPI's errors normalized into it. Note MuAPI supports **webhooks** — prefer those over polling upstream, keeping our own poll endpoint for the client.
- **Done when:** a real Seedance generation completes end-to-end from a `curl`, charging the right credits.

### Phase 5 — Async job pipeline
- BullMQ queue + separate worker process (scales independently of the API).
- `POST /api/v1/{endpoint}` → charge, enqueue, return `request_id` immediately.
- `GET /api/v1/predictions/{id}/result` → `{ status, outputs[], cost: { refunded, amount_credits } }` — the exact shape the forked client already parses.
- Success → R2 upload + **signed, time-limited URL** (never permanently public). Failure → `failed` + auto-refund + plain-English message.
- Retry: exponential backoff for transient/rate-limited; fail-fast-and-refund for policy/invalid.
- Dead-letter queue + alert.
- **Done when:** killing the worker mid-job leaves the system consistent — the job either completes on restart or fails and refunds; no credits vanish.

### Phase 6 — Frontend fork
- Copy `app/`, `components/`, `packages/studio/` into `apps/web` + `packages/studio`. Delete `src/`, `electron/`, `build/`, local-inference, MuAPI branding. Keep MIT attribution.
- Replace `muapi.js` with `meerahClient.js`: our `BASE_URL`, `x-api-key` = our session token, same function signatures so studio components need no changes.
- Replace the API-key gate in `StandaloneShell` with real signup/login; wire the balance widget to `/api/v1/account/balance` (₦ + credits).
- Trim the tab registry to launch features; hide Workflows/Agents/Design/Apps/MCP.
- Live credit calculation: debounced (~200ms) server-side quote on every option change, rendered as "X credits (₦Y)".
- Topup flow + transaction history screens.
- **Done when:** a user can sign up, pay in test mode, generate a video, and see the charge in their history — without ever seeing a MuAPI reference.

**→ This is the first genuinely launchable point.** Video generation, paid in Naira, working.

### Phase 7 — Remaining features *(mostly enable-and-price now)*
Because the studio components and the model catalog already exist, most of these are a config-map entry, a price, and a tab: PixCraft, ShotDirector, FrameControl, Sales Reel, Skin Layer, Patch Up, Plot Board, Buzz Meter, SoundTrack, Link Magic — **plus TalkSync (`omnihuman-1-5`), BrandFace (`seedance-2-character`) and SharpUp (`topaz-*`), all of which moved here from the old Phase 8** now that MuAPI supplies them.
Genuinely new build: the in-house prompt-layer features — Vibe Reel, Real Lens, Shot Vault, Fit Frame (40 formats).
- **Done when:** each feature has a pinned model, a priced quote, a studio tab, and a happy-path test.

### Phase 8 — MyVoice ⭐ *the only differentiator we must build ourselves*
Now the sole direct-vendor integration, and the highest-risk item in the plan.
- **`NineJaLingoModule`** → 5-second sample capture on mid-range Android, voice-profile creation, Pidgin/Yoruba/Igbo/Hausa TTS, voice profiles persisted as `brand_assets` with the vendor voice id.
- Blocked on the bulk-partnership agreement. **Start that conversation in Phase 0, not Phase 8** — everything else can ship without it, and nothing can substitute for it.
- Keep behind a feature flag so launch is never gated on this vendor.
- **Done when:** a user records five seconds on a mid-range Android and gets a Pidgin voiceover in their own voice.

### Phase 9 — Stickiness layer (the actual moat)
- `brand_assets` CRUD: saved characters, voice profiles, brand templates, each holding its `vendor_reference`.
- Reuse-across-generations UX: pick a saved character or voice from any studio.
- Brand kit: logo, colors, fonts applied to Sales Reel / Fit Frame output.
- **Done when:** a returning user's second session is materially faster than their first because their assets are waiting. This phase is *why* the retention projections hold — do not let it slip.

### Phase 10 — Mobile hardening & launch prep
- PWA: manifest + service worker, installable.
- Low-res previews by default, full-res on explicit tap; no autoplay anywhere.
- Resumable uploads; generation status that re-fetches on reconnect rather than trusting a live socket.
- Load-test on throttled 3G against a mid-range Android profile.
- Production deploy: Contabo, Caddy + Let's Encrypt, PM2/Compose, Postgres backups, Sentry, uptime checks.
- Paystack live keys; vendor float topped to ₦150–250k.
- Legal: terms, privacy, refund policy (credits, not cash).
- **Done when:** the checklist in §8 is fully green.

### Phase 11 — Post Planner (second revenue line) ✅ built, scope reduced
- Content calendar and scheduled generation using existing features.
- **60 credits (₦3,000) a month, charged from the credit balance** — not a recurring
  card mandate. No card on file, no dunning; it pauses if the balance runs dry.
- **Auto Post deferred to v2 — a deliberate decision, not an omission.** Direct
  publishing needs Meta App Review plus Business Manager verification: two external
  approval queues on timelines we do not control, either able to reject and restart.
  A bootstrapped launch cannot spend weeks of runway waiting on someone else's queue,
  and the target market already posts by hand today — so automating the slow part
  (deciding and making) is already the upgrade. The API refuses non-manual platforms
  rather than accepting them and silently never publishing; the schema and job
  architecture keep v2 a plug-in.
- **WhatsApp stays manual permanently** — no reliable auto-post API exists.
- **Done when:** a scheduled post generates unattended and waits in the library, and
  the add-on bills monthly. ✅

### Phase 12 — Instrumentation for the real numbers ✅ built
Signup→paid conversion, videos/user, churn, margin per generation, vendor error rates, refund rate. **Build this in the first six weeks of live traffic** — every financial projection in the overview is currently an assumption, and the model's stated key risk is retention. Replace assumptions with data before scaling spend.

**Squad Edit (collaboration)** sits unresolved between Phase 9 and v2 — see Open Decisions.

---

## 8. Launch checklist

- [ ] Concurrent-charge race test green; `sum(ledger) == cached balance` for all users
- [ ] Duplicate Paystack webhook credits exactly once; bad signature rejected
- [ ] Every vendor failure mode refunds automatically and messages the user in plain English
- [ ] Worker killed mid-job → no credits lost on restart
- [ ] Vendor float ≥ ₦150k on the MuAPI and 9jaLingo accounts, with low-balance alerts wired
- [ ] Every tier pinned to a specific model id; margin-floor test green at the current FX rate
- [ ] Rate-card diff job running and alerting
- [ ] All assets served via signed, time-limited R2 URLs
- [ ] No vendor key reachable from the browser bundle (grep the build output)
- [ ] Rate limits on every generation endpoint
- [ ] Input validation before any param reaches a vendor
- [ ] Usable on a mid-range Android over throttled 3G
- [ ] Sentry + uptime alerts firing to a phone
- [ ] Postgres backups tested by actually restoring one
- [ ] Terms / privacy / refund policy published
- [ ] MIT attribution for Open-Generative-AI retained

---

## 9. Open decisions (need the founder's call)

1. **Name.** Overview lists "Omni+ variations, domain unverified." This directory is `meerah` — is that the decision? Everything downstream (domain, branding, palette) is blocked on it.
2. **9jaLingo plan — now the sharpest blocker, and it is quantified.** Tested against the live API on 2026-08-27 with a working `nlg_live_` key:
   - The API is real and does exactly what we need: `POST /v1/audio/speech` on `https://api.9jalingo.org`, `x-api-key` auth, model `9jalingo-tts-1`, languages `ha` / `ig` / `yo` / `pcm`, 240+ preset voices, OpenAI-compatible body, synchronous audio response. A cloning endpoint exists at `POST /v1/audio/clone`.
   - **The Starter plan allows 5 TTS requests per hour.** `STARTER_RATE_LIMIT_EXCEEDED`, `limit: 5`, `window_seconds: 3600`. That is 120 a day, for the whole platform. One active customer would exhaust it.
   - **Cold start is roughly 5 minutes** after an idle period (`503`, "Inference capacity is starting"). A customer pressing "make voiceover" as the first user of the morning waits five minutes unless we keep it warm or queue it.
   - So MyVoice is not blocked on *access* any more — it is blocked on **capacity**. The bulk-partnership conversation is now a concrete ask: a rate limit that supports N generations an hour, and a position on cold starts.
3. ~~**BytePlus docs**~~ — **resolved.** OmniHuman 1.5 and Seedance character/omni-reference are on MuAPI; no separate BytePlus integration needed at launch.
4. **Squad Edit** — launch scope or v2? Recommendation: **v2**. It's collaboration infrastructure, not a differentiator, and it competes for time with the stickiness layer that the retention projections depend on.
5. **Naming collision** — "Fit Frame" (formats) vs "FrameControl" (camera rig) will confuse users in the same nav. Rename one before the UI copy is written.
6. **Palette** — needs a dedicated design pass rooted in Nigerian visual identity, not a default to "dark mode + one neon accent" because that's the category norm.
7. **Credit denomination** (new, from §6) — do we adopt credits-pegged-to-USD-cost with a floating ₦ purchase price? Recommended yes. It keeps "credits never expire" true while removing an unbounded FX liability. Needs a decision before any price is published, because it changes the topup UI copy.
8. **Margin floor** (new) — what percentage? I've assumed 20% as a placeholder in the pricing engine. Premium 4K at its ₦7,000 floor breaches it today.

---

## 10. Standing risks

| Risk | Mitigation |
|---|---|
| Paystack settles T+1/T+2; vendor accounts run dry → failed generations | Standing ₦150–250k float, per-vendor low-balance alerts, replenish from buffer not settlement |
| Retention plateaus; churn eats signups (the model's stated key risk) | Phase 9 stickiness is a launch feature, not v2; instrument churn from week one |
| Canva now bundles 6 months of Canva Business free with Paystack for Nigerian SMBs | Compete on repeat commercial output and the two wedge features, never on price against free |
| Vendor price change silently eats the margin | Margin assertions in the pricing test suite break the build; daily rate-card diff job alerts on any MuAPI change (most models are `dynamic_pricing: true`) |
| **Naira depreciation against a USD cost base** — Premium 4K goes negative at ₦1,750/$ | Credits denominated against USD cost, margin floor enforced in code, FX tracked as a business metric (§6) |
| **Non-expiring credits are an unhedged, unbounded FX liability** | Float the ₦→credit purchase price rather than the credit balance; revisit if exposure grows |
| **Single-aggregator dependency** — a MuAPI outage takes the whole platform down | `GenerationVendor` abstraction kept precisely so a direct fallback can be added per-model; monitor their status; this is an accepted launch-stage trade for speed |
| 9jaLingo integration effort unknown, and it is now the *only* differentiator we build ourselves | Open the partnership conversation in Phase 0; keep MyVoice behind a feature flag so launch isn't gated on it |
| "Local payments" moat copied in 12–24 months | Assumed — the real moat is saved assets + WhatsApp/SMM referral distribution |
