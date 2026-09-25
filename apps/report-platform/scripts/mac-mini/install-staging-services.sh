#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_ROOT="$APP_ROOT/.data/runtime"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
DOMAIN="gui/$(id -u)"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Mac mini staging services require macOS launchd."
  exit 1
fi
if [[ ! -f "$APP_ROOT/.env" ]]; then
  echo "Create $APP_ROOT/.env from .env.example before installing services."
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for PostgreSQL and S3-compatible object storage."
  exit 1
fi

mkdir -p "$RUNTIME_ROOT" "$LAUNCH_AGENTS"
cd "$APP_ROOT"
docker compose --env-file .env up -d postgres object-storage
for _ in {1..60}; do
  postgres_health="$(docker inspect report-platform-postgres-1 --format '{{.State.Health.Status}}' 2>/dev/null || true)"
  object_health="$(docker inspect report-platform-object-storage-1 --format '{{.State.Health.Status}}' 2>/dev/null || true)"
  if [[ "$postgres_health" == "healthy" && "$object_health" == "healthy" ]]; then
    break
  fi
  sleep 1
done
if [[ "${postgres_health:-}" != "healthy" || "${object_health:-}" != "healthy" ]]; then
  echo "PostgreSQL or object storage did not become healthy."
  exit 1
fi
docker compose --env-file .env run --rm --no-deps object-storage-init
npm run build

write_agent() {
  local label="$1"
  local runner="$2"
  local stdout_path="$3"
  local stderr_path="$4"
  local plist="$LAUNCH_AGENTS/$label.plist"
  cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$label</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$runner</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$APP_ROOT</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>$stdout_path</string>
  <key>StandardErrorPath</key>
  <string>$stderr_path</string>
</dict>
</plist>
PLIST
  launchctl bootout "$DOMAIN" "$plist" >/dev/null 2>&1 || true
  launchctl bootstrap "$DOMAIN" "$plist"
}

write_backup_agent() {
  local label="ai.laiq.report-platform-backup"
  local plist="$LAUNCH_AGENTS/$label.plist"
  cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$label</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$APP_ROOT/scripts/mac-mini/backup-staging.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$APP_ROOT</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>2</integer>
    <key>Minute</key>
    <integer>15</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>$RUNTIME_ROOT/backup.stdout.log</string>
  <key>StandardErrorPath</key>
  <string>$RUNTIME_ROOT/backup.stderr.log</string>
</dict>
</plist>
PLIST
  launchctl bootout "$DOMAIN" "$plist" >/dev/null 2>&1 || true
  launchctl bootstrap "$DOMAIN" "$plist"
}

write_agent \
  "ai.laiq.report-platform-api" \
  "$APP_ROOT/scripts/mac-mini/run-api.sh" \
  "$RUNTIME_ROOT/api.stdout.log" \
  "$RUNTIME_ROOT/api.stderr.log"
write_agent \
  "ai.laiq.report-platform-ui" \
  "$APP_ROOT/scripts/mac-mini/run-ui.sh" \
  "$RUNTIME_ROOT/ui.stdout.log" \
  "$RUNTIME_ROOT/ui.stderr.log"
write_backup_agent

"$APP_ROOT/scripts/mac-mini/status-staging-services.sh" --wait
