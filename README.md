# Meerah

AI video and content generation for Nigerian creators and small businesses.
Priced in Naira, paid through Paystack, with voiceovers in Pidgin, Yorùbá, Igbo
and Hausa.

Global tools price in dollars and need an international card, which locks out
most Nigerian vendors and agencies. They also offer nothing but generic
AI-accented English. This does neither.

> **Status:** all twelve build phases complete, 154 tests passing. Not launched.
> What remains is external — a MuAPI key, Cloudflare R2 credentials, a
> 9jaLingo plan upgrade and a domain. See [What is still needed](#what-is-still-needed).

---

## Two codebases

```
meragen/
├── backend/    NestJS API + generation worker  ·  port 3001
└── meerah/     Next.js landing page + dashboard ·  port 3000
```

**`backend/`** owns everything that touches money, vendors or the database.
**`meerah/`** holds no business logic at all — no database access, no vendor
keys, no pricing. It reaches the backend over HTTP through a single file,
`meerah/lib/api.ts`.

That separation is deliberate: the browser only ever talks to its own origin, so
there is no CORS and no key handling in the shipped bundle.

Each folder has its own README with the detail.

## Running it

You need Docker Desktop, and Node 20+.

```bash
# Backend — API, worker, Postgres, Redis
cd backend
npm install
cp .env.example .env          # then fill in the keys you have
npm run db:up
npm run prisma:migrate
npm run dev                   # :3001
npm run worker:dev            # second terminal

# Website
cd ../meerah
npm install
cp .env.example .env.local    # Firebase web config + API_URL
npm run dev                   # :3000
```

Open **http://localhost:3000**. Check **http://localhost:3001/health** to see
what is and is not configured — it prints the same report at startup.

## The product

**Twelve tools**, forked from
[Open-Generative-AI](https://github.com/Anil-matcha/Open-Generative-AI) (MIT) and
served through our own metered API:

| Group | Tools |
|---|---|
| Video | VidEngine · Vibe Reel · ShotDirector · Snip Reel |
| Image | PixCraft · Patch Up |
| People | TalkSync · Body Double · Star Maker |
| Selling | Sales Reel · SoundTrack |
| More | App Shelf |

Plus **MyVoice** (speech and voice cloning in four Nigerian languages),
**Saved** (characters, voices, brand kits), and **Post Planner** (a content
calendar that generates on schedule).

### How it charges

**1 credit = ₦50.** Every price is *derived*, never typed in: live vendor cost,
plus storage, plus the naira rate, then a target margin, rounded up to a whole
credit.

| Tier | Vendor cost | Price | Margin |
|---|---|---|---|
| Draft · 5s 480p | $0.06 | 6 credits (₦300) | 70% |
| Standard · 5s 720p | $0.40 | 25 credits (₦1,250) | 52% |
| HD · 5s 1080p | $1.70 | 93 credits (₦4,650) | 45% |
| Premium · 5s 1080p | $4.25 | 197 credits (₦9,850) | 35% |
| Studio · 5s 4K | $8.50 | 366 credits (₦18,300) | 30% |

Because prices are derived, naira depreciation moves the **price** rather than
eating the margin — at ₦2,200/$ every tier still clears its floor. A vendor
price rise that would breach the floor **stops the sale** instead.

## How it is built

Money first, then the product. Some decisions worth knowing before changing
anything:

**The credit ledger is append-only and row-locked.** Every balance change is one
transaction: `SELECT … FOR UPDATE`, insert the ledger row, update the cached
balance. Charges are idempotent, so a retried worker or a double-fired scheduler
cannot charge twice. Tests fire concurrent charges at a balance that funds all
but one and assert exactly one fails.

**A payment has three independent routes to being credited** — the Paystack
webhook, the browser reporting its reference on return from checkout, and a
five-minute reconciliation sweep. All three are safe to run at once; the unique
constraint on the payment reference means the first wins. This exists because a
webhook cannot reach `localhost`, and in production it can be delayed or lost.

**Nothing blocks on generation.** The API charges, submits and returns a job id.
A worker settles it. A database sweeper chases every unfinished job to a
conclusion, so a crashed worker cannot orphan someone's paid render.

**Every failure refunds automatically**, and the customer is told in plain words
— never a vendor name or a stack trace.

**Finished work is copied off the vendor into our own storage.** Vendor URLs
expire; someone coming back next week for the advert they paid for must still
find it.

## What is still needed

| Blocked on | For |
|---|---|
| **MuAPI key** | Real generation. Everything else is proven; this is the last untested link. |
| **Cloudflare R2 keys** | Production storage. Local disk works but has no redundancy. |
| **9jaLingo PAYG Lite (₦5,000)** | MyVoice. Built and wired; the free plan's 5 requests/hour is the only blocker. |
| **A domain** | HTTPS and the Paystack webhook. |

**Auto-posting to Instagram and Facebook is deliberately not built.** It needs
Meta App Review plus Business Manager verification — external approval queues on
timelines nobody controls. Post Planner generates on schedule; the customer
downloads and uploads. The API refuses non-manual platforms rather than
accepting them and silently never publishing.

## Tests

```bash
cd backend && npm test        # 154 tests, against a separate database
cd meerah  && npm run check:sw # proves the service worker never caches API responses
```

Tests run against a real Postgres, not mocks — the row-locking behaviour they
verify *is* a database feature.

## Deploying

`backend/infra/docker-compose.prod.yml` runs the whole stack — api, worker,
Postgres, Redis, Caddy with automatic HTTPS, and the website. Postgres and Redis
are not published to the host; only the app containers reach them.

```bash
export POSTGRES_PASSWORD='something long and random'
docker compose -f backend/infra/docker-compose.prod.yml up -d --build
```

Scale generation independently of the website:
`docker compose … up -d --scale worker=3`

**Before launch, restore a backup.** A backup you have never restored is not a
backup.

## Documentation

| File | What it covers |
|---|---|
| [`docs.md`](docs.md) | Setup, keys, pricing, how payments work |
| [`meerah/planning.md`](meerah/planning.md) | The full build plan, all twelve phases, and the reasoning |
| [`docker_commands.md`](docker_commands.md) | Command cheat sheet |
| [`backend/README.md`](backend/README.md) | The API and worker |
| [`meerah/README.md`](meerah/README.md) | The website |

## Licence and attribution

The studio UI in `meerah/packages/studio` is forked from
[Open-Generative-AI](https://github.com/Anil-matcha/Open-Generative-AI), MIT
licensed.
