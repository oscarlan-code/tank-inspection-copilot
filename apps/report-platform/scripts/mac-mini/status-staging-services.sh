#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WAIT_MODE="${1:-}"
ATTEMPTS=1
if [[ "$WAIT_MODE" == "--wait" ]]; then
  ATTEMPTS=40
fi

cd "$APP_ROOT"
if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

docker compose --env-file .env ps

for ((attempt = 1; attempt <= ATTEMPTS; attempt += 1)); do
  api_ready=0
  ui_ready=0
  curl -fsS --max-time 3 "http://127.0.0.1:${REPORT_PLATFORM_API_PORT:-8788}/api/ready" >/dev/null && api_ready=1 || true
  curl -fsS --max-time 3 -I "http://127.0.0.1:4174/" >/dev/null && ui_ready=1 || true
  if [[ "$api_ready" == "1" && "$ui_ready" == "1" ]]; then
    echo "LAIQ report-platform API and UI are ready."
    curl -fsS "http://127.0.0.1:${REPORT_PLATFORM_API_PORT:-8788}/api/ready"
    echo
    exit 0
  fi
  sleep 1
done

echo "Report-platform staging services are not ready."
echo "Inspect $APP_ROOT/.data/runtime/*.log and run docker compose --env-file .env ps."
exit 1
