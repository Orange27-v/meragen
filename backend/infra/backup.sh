#!/bin/sh
# Nightly Postgres backup. Add to cron:
#   0 2 * * * /opt/meerah/infra/backup.sh >> /var/log/meerah-backup.log 2>&1
#
# A backup you have never restored is not a backup. Test one before launch —
# it is on the launch checklist for a reason (planning.md §8).
set -eu

KEEP_DAYS=14
STAMP=$(date +%Y%m%d-%H%M%S)
DIR="$(dirname "$0")/backups"
mkdir -p "$DIR"

docker compose -f "$(dirname "$0")/docker-compose.prod.yml" exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-meerah}" "${POSTGRES_DB:-meerah}" | gzip > "$DIR/meerah-$STAMP.sql.gz"

find "$DIR" -name 'meerah-*.sql.gz' -mtime +$KEEP_DAYS -delete
echo "$(date -Iseconds) backup ok: meerah-$STAMP.sql.gz ($(du -h "$DIR/meerah-$STAMP.sql.gz" | cut -f1))"
