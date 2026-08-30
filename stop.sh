#!/usr/bin/env bash
# Stop anything start.sh left behind: node dev processes and the containers.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

pkill -f "$ROOT/backend/node_modules/.bin/nest" 2>/dev/null
pkill -f "$ROOT/meerah/node_modules/.bin/next" 2>/dev/null
docker stop meerah-postgres meerah-redis 2>/dev/null

echo "stopped"
