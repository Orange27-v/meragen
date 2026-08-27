# Meerah — Backend

The API and generation worker. Everything that touches money, vendors or the
database lives here; the website ([`../meerah`](../meerah)) holds no business
logic and reaches this over HTTP.

## Running it

```bash
npm install
npm run db:up          # Postgres + Redis in Docker (needs Docker Desktop open)
npm run prisma:migrate
npm run dev            # API on :3001
npm run worker:dev     # renders, sweeps, renewals — separate process
```

Health and readiness: **http://localhost:3001/health**

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | API, watching for changes |
| `npm run worker:dev` | The worker |
| `npm test` | 154 tests, against a separate `meerah_test` database |
| `npm run prisma:studio` | Browse the database |
| `npm run db:up` / `db:down` | Start / stop Postgres and Redis |

## What is in here

| Module | Owns |
|---|---|
| `credits` | The ledger. Every balance change, row-locked and append-only. |
| `payments` | Paystack: checkout, webhooks, reconciliation |
| `pricing` | Prices derived from live vendor cost + storage + FX, margin-floored |
| `generations` | Charge, submit, settle, refund |
| `queue` | BullMQ job + the database sweeper that guarantees nothing is abandoned |
| `voice` | MyVoice — 9jaLingo speech and cloning |
| `brand` | Saved characters, voices, brand kits |
| `planner` | Content calendar and the monthly add-on |
| `storage` | R2, falling back to local disk |
| `auth` | Google sign-in via Firebase, session tokens |
| `metrics` | Conversion, churn, realised margin — owner only |
| `health` | What is and is not working |

## Deploying

`infra/docker-compose.prod.yml` runs the whole stack — api, worker, Postgres,
Redis, Caddy, and the website from `../meerah`. See `../docs.md`.
