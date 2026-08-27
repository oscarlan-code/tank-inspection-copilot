#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${1:-}"

if [[ -z "$BACKUP_DIR" ]]; then
  BACKUP_ROOT="${REPORT_PLATFORM_BACKUP_ROOT:-$APP_ROOT/.data/backups}"
  BACKUP_DIR="$(
    find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -print 2>/dev/null \
      | sort \
      | tail -n 1
  )"
fi

if [[ -z "$BACKUP_DIR" || ! -d "$BACKUP_DIR" ]]; then
  echo "No staging backup was found. Run npm run staging:backup first,"
  echo "or pass an explicit backup directory: $0 /absolute/path/to/backup"
  exit 1
fi

cd "$APP_ROOT"
set -a
source .env
set +a

(cd "$BACKUP_DIR" && shasum -a 256 -c postgresql.dump.sha256)
docker compose --env-file .env exec -T postgres pg_restore --list < "$BACKUP_DIR/postgresql.dump" >/dev/null
node ./server/scripts/verify-object-storage-backup.mjs "$BACKUP_DIR/object-storage"
echo "Backup verification passed: $BACKUP_DIR"
