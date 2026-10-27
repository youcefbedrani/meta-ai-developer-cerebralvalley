#!/usr/bin/env bash
# Daily PostgreSQL backup for the production stack.
#   Cron (03:00 daily):  0 3 * * * /opt/stratum/scripts/backup.sh >> /var/log/stratum-backup.log 2>&1
# Restore:
#   docker compose -f docker-compose.prod.yml exec -T postgres pg_restore -U app -d app --clean --if-exists < backups/app-<timestamp>.dump
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
ts="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIR/app-$ts.dump"

docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U app -d app --format=custom > "$out.partial"
mv "$out.partial" "$out"
find "$BACKUP_DIR" -name 'app-*.dump' -type f -mtime +"$KEEP_DAYS" -delete

echo "$(date -u +%FT%TZ) backup ok: $out ($(du -h "$out" | cut -f1))"
