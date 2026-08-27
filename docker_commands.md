# Meerah — Commands Cheat Sheet

**Two folders now.** The backend and the website are separate projects:

```bash
cd /Users/apple/Documents/loopy/backend   # API, worker, database
cd /Users/apple/Documents/loopy/meerah    # website
```

Database commands live in **backend**. Website commands live in **meerah**.

If a command fails with "cannot connect to the Docker daemon", open Docker Desktop first and wait for the whale icon to stop animating.

---

## The four you'll actually use

In **`backend/`**:

| Command | What it does |
|---|---|
| `npm run db:up` | Start the database + queue |
| `npm run db:down` | Stop them |
| `npm run dev` | Start the API (port 3001) |
| `npm run worker:dev` | Start the render worker |
| `npm test` | Run all 154 tests |
| `npm run prisma:studio` | Look inside the database |

In **`meerah/`**:

| Command | What it does |
|---|---|
| `npm run dev` | Start the website (port 3000) |
| `npm run build` | Production build |

**To use the site:** in `backend/` run `npm run db:up` then `npm run dev`; in
`meerah/` run `npm run dev`; open **http://localhost:3000**. Tests use their own
separate database, so running them never touches your real data.

---

## Starting and stopping

```bash
npm run db:up      # start Postgres + Redis (do this first, every session)
npm run db:down    # stop them (data is kept)
npm run db:logs    # watch what they're doing — Ctrl+C to exit
```

They keep running until you stop them or restart your Mac.

**Check what's running:**
```bash
docker compose -f infra/docker-compose.yml ps
```
You want to see `healthy` next to both `meerah-postgres` and `meerah-redis`.

---

## Looking inside the database

```bash
npm run prisma:studio
```
Opens `localhost:5555` in your browser. Click through the four tables. **Ctrl+C** to close.

**Or from the terminal:**
```bash
# open a database shell — type \q to quit
docker exec -it meerah-postgres psql -U meerah -d meerah

# list all tables
docker exec meerah-postgres psql -U meerah -d meerah -c "\dt"

# see the columns of one table
docker exec meerah-postgres psql -U meerah -d meerah -c "\d users"

# count the rows in each table
docker exec meerah-postgres psql -U meerah -d meerah -c \
  "SELECT 'users' t, count(*) FROM users
   UNION ALL SELECT 'credit_transactions', count(*) FROM credit_transactions
   UNION ALL SELECT 'generations', count(*) FROM generations
   UNION ALL SELECT 'brand_assets', count(*) FROM brand_assets;"
```

---

## Tests

```bash
npm run api:test                          # run them all
cd apps/api && npx vitest                 # re-run automatically as code changes
cd apps/api && npx vitest run credits     # just the money tests
```

The database must be running (`npm run db:up`) — the tests use a real one on purpose.

---

## Changing the database shape

After editing `apps/api/prisma/schema.prisma`:

```bash
npm run prisma:migrate     # apply the change, asks you to name it
npm run prisma:generate    # refresh the type definitions
```

---

## When something is broken

**"Cannot connect to the Docker daemon"** — Docker Desktop isn't open.
```bash
open -a Docker
```

**"Port 5432 already in use"** — another Postgres is running on your Mac.
```bash
lsof -i :5432          # find out what it is
npm run db:down        # or stop ours and deal with the other one
```

**Restart the containers:**
```bash
npm run db:down && npm run db:up
```

**Wipe everything and start clean** ⚠️ *deletes all data in the database*
```bash
docker compose -f infra/docker-compose.yml down -v
npm run db:up
npm run prisma:migrate
```

---

## Raw Docker (rarely needed)

```bash
docker ps                          # every container running on your Mac
docker logs meerah-postgres        # logs for just the database
docker logs meerah-redis           # logs for just the queue
docker stats                       # live memory and CPU use
```

---

## What these two things are

**Postgres** (port 5432) — the memory. Customers, token balances, every payment, every video made. This is the important one; it holds the money records.

**Redis** (port 6379) — the waiting line. When someone asks for a video, the job queues here until a worker picks it up. Nothing precious lives here.

Both run only on your Mac. Nothing is on the internet, nobody else can reach them.
