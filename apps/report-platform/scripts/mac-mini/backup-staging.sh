#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$APP_ROOT"

if [[ ! -f .env ]]; then
  echo "Missing $APP_ROOT/.env."
  exit 1
fi

set -a
source .env
set +a

STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
BACKUP_ROOT="${REPORT_PLATFORM_BACKUP_ROOT:-$APP_ROOT/.data/backups}"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"
mkdir -p "$BACKUP_DIR"

docker compose --env-file .env exec -T postgres \
  pg_dump \
  --username "${REPORT_PLATFORM_POSTGRES_USER:-laiq_report_platform}" \
  --dbname "${REPORT_PLATFORM_POSTGRES_DB:-laiq_report_platform}" \
  --format custom \
  --no-owner \
  --no-privileges > "$BACKUP_DIR/postgresql.dump"

node ./server/scripts/backup-object-storage.mjs "$BACKUP_DIR/object-storage"
shasum -a 256 "$BACKUP_DIR/postgresql.dump" > "$BACKUP_DIR/postgresql.dump.sha256"
"$APP_ROOT/scripts/mac-mini/verify-staging-backup.sh" "$BACKUP_DIR"

find "$BACKUP_ROOT" \
  -mindepth 1 \
  -maxdepth 1 \
  -type d \
  -mtime "+${REPORT_PLATFORM_BACKUP_RETENTION_DAYS:-14}" \
  -exec rm -rf {} +

echo "Verified staging backup: $BACKUP_DIR"
