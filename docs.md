# Meerah — Project Docs

## Where things live

**Two separate codebases, side by side:**

```
loopy/
  backend/     the API and worker — everything that touches money or vendors
  meerah/      the website — landing page and dashboard, no business logic
```

| What | Where |
|---|---|
| The build plan (all phases) | `meerah/planning.md` |
| Commands cheat sheet | `docker_commands.md` |
| **Backend** (API + worker) | `backend/` — see `backend/README.md` |
| **Website** (landing + dashboard) | `meerah/` — see `meerah/README.md` |
| Forked studio UI | `meerah/packages/studio` (MIT, from Open-Generative-AI) |
| Backend secrets | `backend/.env` ← **never anywhere else** |
| Website config (public values only) | `meerah/.env.local` |
| MuAPI price list snapshot | `meerah/reference/` |

---

## Keys

**Your keys now live in `meerah/apps/api/.env`.** That file is in `.gitignore`, so it can never be
uploaded to GitHub by accident. I moved the Paystack keys there and removed the secret one from
this file.

There are two kinds of key, and they are not equally dangerous:

- **Public key** (`pk_test_…`, `pk_live_…`) — safe. It's meant to be seen; it goes in the webpage.
- **Secret key** (`sk_test_…`, `sk_live_…`) — never share, never paste into a doc, never put in
  frontend code. Anyone holding it can act as you.

Right now we're on **test keys**, which move fake money only — mistakes here cost nothing. The rule
matters most later, when the `sk_live_` key is real money.

If a secret key ever gets exposed: Paystack dashboard → Settings → API Keys → **Roll key**. The old
one dies instantly.

### The keys we're using

```
Paystack public (test):  pk_test_… (in meerah/.env.local)
Paystack secret (test):  in .env — not written here on purpose
MuAPI key:               not added yet
9jaLingo key:            not added yet — partnership not signed
```

---

## Pages

| Page | What it is |
|---|---|
| `/` | Landing page — the real one, with the live language demo |
| `/pricing` | Public price table, read live from the API |
| `/signin` | Sign in with Google — the only way in |
| `/studio` | Simple mode: balance, buy credits, one video box |
| `/create` | Full studio: 12 tools, 600+ models |
| `/saved` | Saved characters, voices and brand kits |
| `/calendar` | Post Planner — the content calendar |
| `/admin` | The numbers. Owner only. |

## What a generation actually costs us

Every price is derived server-side from three real inputs, not typed in by hand:

1. **Vendor cost** — synced daily from MuAPI's public rate card.
2. **Storage** — Cloudflare R2 at $0.015/GB-month, kept for 12 months, plus write
   and read operations. Egress is free, which is why R2 was chosen: Nigerian
   playback traffic is the dominant volume, and Bunny charges $0.06/GB for Africa.
3. **The naira rate** — a configured, monitored input (`NGN_PER_USD`).

Storage is small per item (₦0.6 for a 480p clip, ₦12 for 4K) but it is counted,
because it compounds with every file kept.

**Paystack's cut is separate**, because it is charged on money coming in, not on a
generation: 1.5% + ₦100, the ₦100 waived below ₦2,500, capped at ₦2,000. So a
₦5,000 pack is ₦4,825 of actual revenue. `/api/v1/credit-packs` reports this per
pack so the margin you see is the real one.

## The 12 tools

Forked from Open-Generative-AI (MIT), renamed for what they do.

| Group | Tool | What it does | Was |
|---|---|---|---|
| Video | **VidEngine** | Text or photo to video | VideoStudio |
| Video | **Vibe Reel** | One-tap motion presets | VibeMotionStudio |
| Video | **ShotDirector** | Describe a scene, get the shots | CinemaStudio |
| Video | **Snip Reel** | Long video into short clips | ClippingStudio |
| Image | **PixCraft** | Product shots, flyers, thumbnails | ImageStudio |
| Image | **Patch Up** | Edit, replace, split into layers | LayersStudio |
| People | **TalkSync** | Make a face speak your script | LipSyncStudio |
| People | **Body Double** | Swap the body, keep the face | RecastStudio |
| People | **Star Maker** | A consistent face for your brand | AiInfluencerStudio |
| Selling | **Sales Reel** | Ad creative for social | MarketingStudio |
| Selling | **SoundTrack** | Music and voiceover | AudioStudio |
| More | **App Shelf** | Vote on what we build next | AppsStudio |

**Still not included:** Workflows, Agents and Design Agent. Each needs a separate git
submodule plus 20–30 backend endpoints (`/workflow/*`, `/agents/*`) that do not exist
yet. A tab that loads straight to an error is worse than no tab.

## Credits

**1 credit = ₦50.** Every price is rounded up to a ₦50 boundary so a credit is always
a whole number — ₦120 would be 2.4 credits, which is not something you can sell. The
pricing engine throws rather than rounding if a price ever escapes that grid, because
silently rounding would either short the customer or short you on every sale.

| | Credits | Naira |
|---|---|---|
| Draft video, 5s 480p | 6 | ₦300 |
| Standard, 5s 720p | 25 | ₦1,250 |
| HD, 5s 1080p | 93 | ₦4,650 |
| Premium, 5s 1080p | 197 | ₦9,850 |
| Studio, 5s 4K | 366 | ₦18,300 |
| Image | 3 | ₦150 |
| Lip-sync | 14 | ₦700 |
| Upscale to 4K | 6 | ₦300 |

The UI always shows the Naira value beside the credit count — a credit balance on its
own means nothing to someone signing up for the first time.

## MyVoice

Speech in **Pidgin, Yorùbá, Igbo and Hausa**, in a preset voice or the customer's
own cloned one. Built on 9jaLingo.

**Why 9jaLingo over Spitch**, after comparing both live:

- **3.3× cheaper** — ₦51 per 1,000 characters against $0.0014/second.
- **Bills in Naira.** Everything else here defends a USD cost base against naira
  depreciation. MyVoice is simply outside that problem.
- **Per-character pricing means the quote is exact.** This system charges before it
  submits, so the price has to be knowable from the input. A per-second vendor
  would force us to estimate duration and either eat the shortfall or overcharge.

**Spitch is the fallback**, behind the same `VoiceVendor` interface: its cloning
contract is fully documented, it has no observed cold start, and it adds Yorùbá tone
marking. Swapping is a config change.

| | Credits | Naira | Margin |
|---|---|---|---|
| ~30-second script (135 chars) | 1 | ₦50 | 86% |
| ~1 minute (500 chars) | 2 | ₦100 | 74% |
| ~1,000 characters | 3 | ₦150 | 66% |

**Cloning is free.** The vendor charges for speech, not registration — and charging
to try the feature that makes people stay would be self-defeating.

**Consent is recorded against the voice, not just passed to the vendor.** Cloning
someone else's voice is the obvious abuse here, and in this market a cloned voice is
a fraud tool.

## Post Planner (the content calendar)

Plan a week of posts on Sunday; each one is generated **20 minutes before it is
due**, so it is finished and waiting rather than still rendering when it should
go out.

**Billed as a monthly add-on: 60 credits (₦3,000), taken from the balance the
customer already has.** No card kept on file, no failed-renewal chasing, and if
someone runs out of credits it pauses rather than locking them out. Turning it
off is a button, not an email.

Generations are charged normally when each post is made — the add-on buys the
scheduling, not the videos.

### Posting is manual in v1, on purpose

**Generation is 100% automatic. Posting is 100% manual.** The AI makes the content
on schedule with no login and no button press, and it waits in the library. The
customer downloads it and uploads it themselves.

**Why not auto-publish:** Meta requires App Review approval for
`instagram_content_publish`, *plus* Business Manager verification tied to your CAC
registration. Two external approval queues, each on a timeline you do not control,
each able to reject and restart. Blocking a bootstrapped launch on someone else's
review queue burns runway with no revenue coming in.

**Why it costs little:** Nigerian creators already generate content elsewhere and
post it by hand. "It makes itself, you upload it" is not a downgrade from that — the
slow part is already automated. Only the one-tap part stays manual.

The API **refuses** `instagram` and `facebook` rather than accepting them and
silently never publishing. The enum and the job architecture already allow for it, so
v2 is a plug-in rather than a rebuild.

**WhatsApp stays manual permanently** — no reliable auto-post API exists for it.

## Two ways to buy

- **Packs** — ₦2,000 (40 credits) to ₦50,000 (1,150 credits), with 5–15% bonus for buying ahead.
- **Pay as you go** — any amount from ₦500 to ₦500,000, in steps of ₦50.

The floor is ₦500 because below that Paystack's fee makes the transaction not worth
processing, and the ₦50 step is what keeps credits whole.

## Deploying to a server

Everything needed lives in `meerah/infra/`:

| File | What it is |
|---|---|
| `docker-compose.prod.yml` | The whole stack: web, api, worker, Postgres, Redis, Caddy |
| `Caddyfile` | HTTPS with automatic Let's Encrypt certificates. Change the domain. |
| `Dockerfile.api` / `Dockerfile.web` | Production images, running as a non-root user |
| `backup.sh` | Nightly Postgres dump, keeps 14 days |

On the VPS:

```bash
export POSTGRES_PASSWORD='something long and random'
docker compose -f infra/docker-compose.prod.yml up -d --build
```

Then point your domain's A record at the server. Caddy gets the certificate itself.

Scale generation independently of the website:
`docker compose -f infra/docker-compose.prod.yml up -d --scale worker=3`

**Before launch: restore one backup.** A backup you have never restored is not a
backup.

## Works on bad mobile data

Around 69% of Nigerian internet traffic is mobile, often metered, often on a
mid-range Android. What that changed:

- **Installable.** Add to Home Screen and it opens like an app.
- **Nothing autoplays, ever.** On a slow or data-saving connection a video
  downloads *nothing* until you press play, and the page says so.
- **Offline banner.** When the connection drops, you are told your generation is
  safe rather than left wondering whether to pay again.
- **Your own work is cached** — re-watching something you already downloaded is free.
- **API responses are never cached.** A stale credit balance is worse than none.
  `npm run check:sw` proves this, and fails if anyone breaks it.

Page weight over the wire: landing 6.2KB, pricing 3.7KB, sign-in 2.8KB,
studio 2.2KB gzipped, over a 103KB shared bundle.

## The numbers — `/admin`

Owner only, and only for the emails in `ADMIN_EMAILS`. Nothing a customer can do
grants access.

Everything is measured from the ledger, not estimated:

| Measure | Why it matters |
|---|---|
| **Signup → paid** | The number the whole revenue model rests on |
| **Churned** | Paid once, never returned. The plan's stated key risk |
| **Kept after costs** | Real margin, on credits actually *spent* |
| **Net revenue** | After Paystack's per-transaction cut |
| **Failed generations** | Vendor reliability, and what it refunded |
| **Owed in credits** | Credits sold but unspent — a liability, not profit |
| **Saved items / Planner subs** | Whether the stickiness layer is working |

Two accounting decisions worth knowing:

**Unspent credits are a liability, not revenue.** Someone who buys ₦50,000 of credits
has given you cash you owe them in service. Margin is measured only on credits
actually spent, so a good sales month cannot flatter the margin.

**Paystack's fee is summed per payment, not applied to the total.** Two ₦5,000 packs
cost ₦350 in fees, not the ₦250 you would get by charging the fee once on ₦10,000.

## Is it working? — `http://localhost:3001/health`

One URL tells you the state of everything. It also prints at startup, so you never
have to go looking.

```
✓ database    connected
✓ sign-in     Google sign-in ready
~ payments    Paystack in TEST mode — no real money moves.
✗ generation  MUAPI_KEY is not set — every generation will fail and refund.
~ storage     Local disk — fine for development, will lose files in production.
```

`✓` fine · `~` works but not production-ready · `✗` broken

**Critical** things stop the business — sign-in, payments, the database. If one of
those is down, `/health` returns **HTTP 503** so an uptime monitor alerts without
reading the body, and the log says `SERVICE IS NOT USABLE`.

**Non-critical** things degrade — a missing MuAPI key means generations fail and
refund, but people can still sign in and buy credits.

Point any uptime monitor at `/health`. It needs no login.

## Sign-in is Google only

There is no password anywhere in this system — not stored, not hashed, not checked.
The `password_hash` column has been dropped and the signup/login endpoints removed.

That means **Firebase must stay configured or nobody can sign in.** If the keys are
ever missing, `/api/v1/auth/methods` returns `{"google": false}` and the sign-in page
says so plainly rather than showing a button that cannot work.

Signing in and signing up are the same action: Google does not distinguish between a
new and a returning person, so neither do we. An account is created on first sign-in.

## Turning on Google sign-in

Five minutes in the Firebase Console, then two files.

1. **console.firebase.google.com** -> Add project (or pick an existing one).
2. **Authentication -> Get started -> Sign-in method -> Google -> Enable.** Set a support email, Save.
3. **Authentication -> Settings -> Authorised domains** -> add `localhost` (it is usually there already) and later your real domain.
4. **Project settings -> General -> Your apps -> Web (`</>`)** -> register the app. Copy the four values into `meerah/apps/web/.env.local`:

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123...:web:abc...
   ```

5. **Project settings -> Service accounts -> Generate new private key.** A JSON file downloads. Copy three values from it into `meerah/apps/api/.env`:

   ```
   FIREBASE_PROJECT_ID=...          (project_id)
   FIREBASE_CLIENT_EMAIL=...        (client_email)
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

   **Keep the double quotes on the private key** — it contains `\n` sequences that break without them.

6. Restart both, and the "Continue with Google" button appears on its own.

That downloaded JSON file is a master key to your Firebase project. It goes in `.env` and nowhere
else — never in the web app, never committed.

## Payments: why credits can be delayed

Paystack confirms a payment by calling your server — a "webhook". It cannot call
`localhost`, so during local development that message never arrives. Three routes
now credit a payment, and all three are safe to run at once:

1. **Webhook** — instant, but needs a public URL. Works in production only.
2. **On return from checkout** — the browser reports its reference and the server
   verifies it directly with Paystack. This is what makes it work locally.
3. **Reconciliation sweep** — every 5 minutes the worker asks Paystack for
   successful payments it has not credited. Catches the case where someone paid
   and closed the tab.

For the webhook in production, set the URL in the Paystack dashboard to
`https://yourdomain.com/webhooks/paystack`. To test it locally, run a tunnel
(`ngrok http 3001`) and point the dashboard at the tunnel address.

## Still needed

- **MuAPI key** — for generating videos. Get it at muapi.ai, then paste into `.env` as `MUAPI_KEY`.
- **9jaLingo PAYG Lite (₦5,000)** — MyVoice is **built and wired**; the only thing
  stopping a real voiceover is the free Starter plan's **5 requests per hour**.
  Buying PAYG Lite lifts it and answers the last open question: whether the
  ~5-minute cold start survives on a paid plan. If it does, we switch to Spitch —
  the `VoiceVendor` interface makes that a config change, not a rewrite.
- **Cloudflare R2** — paste `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` into `.env` and storage moves off local disk automatically. Everything works without it in the meantime.

---

## Build status

- ✅ **Phase 0** — database, queue, project set up
- ✅ **Phase 1** — the token machine (charge, refund, top-up, audit) with tests that catch real bugs
- ✅ **Phase 2** — Paystack payments: checkout, signed webhooks, replay-proof crediting (21 tests)
- ✅ **Phase 3** — pricing engine: live vendor rate-card sync, prices derived from real cost, margin floor, FX-proof (34 tests)
- ✅ **Phase 4** — generation: vendor layer, error taxonomy, auto-refund (44 tests) — *awaiting your MuAPI key for the live run*
- ✅ **Phase 5** — background rendering: worker process, DB sweeper, auto-timeout, MuAPI-compatible status endpoint (51 tests)
- ✅ **Phase 6** — the web app: signup, login, buy credits, generate, live status (63 tests)
- ✅ **Phase 7** — studio forked from Open-Generative-AI (MIT): 6 tools live, 600+ models, server-priced (68 tests)
- ✅ **Phase 8** — file storage: uploads, signed expiring URLs, generations archived off the vendor (78 tests). Runs on local disk now; switches to R2 the moment you add the keys.
- ✅ **Google sign-in** — Firebase-verified, links to existing accounts, hidden until configured (84 tests)
- ✅ **Phase 9** — stickiness layer: saved characters, voices and brand kits, one-tap save from any result (109 tests)
- ✅ **Phase 10** — mobile hardening: PWA, connection-aware media, offline handling, production deploy config (109 tests)
- ✅ **Phase 11** — Post Planner: content calendar, scheduled generation, monthly add-on billed in credits (124 tests)
- ✅ **Phase 12** — instrumentation: conversion, churn, realised margin, failure and refund rates, stickiness signals (135 tests)

**Every phase in the plan is now built.** What remains is not code: the MuAPI key, R2 keys, the 9jaLingo partnership, a Meta app for auto-posting, and a domain.
