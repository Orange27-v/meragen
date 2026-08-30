#!/usr/bin/env bash
# Bring up the whole Meerah stack: postgres + redis, API, worker, web.
# Ctrl-C stops the node processes; the containers keep running (./stop.sh takes them down).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
WEB="$ROOT/meerah"

echo "==> postgres + redis"
(cd "$BACKEND" && npm run db:up)

echo "==> waiting for postgres"
for _ in $(seq 1 30); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' meerah-postgres 2>/dev/null)" = healthy ] && break
  sleep 1
done

# Job control gives each child its own process group, so `kill -PGID` takes the
# npm wrapper and the nest/next process under it down together.
set -m
pids=""
cleanup() {
  echo
  echo "==> stopping"
  for p in $pids; do kill -TERM "-$p" 2>/dev/null; done
}
trap cleanup EXIT INT TERM

echo "==> api      http://localhost:${PORT:-3001}"
(cd "$BACKEND" && npm run dev) & pids="$pids $!"

echo "==> worker"
(cd "$BACKEND" && npm run worker:dev) & pids="$pids $!"

echo "==> web      http://localhost:3000"
(cd "$WEB" && npm run dev) & pids="$pids $!"

wait
