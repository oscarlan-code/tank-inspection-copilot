#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_PORT="${REPORT_PLATFORM_TEST_DATABASE_PORT:-55433}"
TEST_PROJECT="${REPORT_PLATFORM_TEST_COMPOSE_PROJECT:-laiq-report-platform-test}"

if [[ "$#" -eq 0 ]]; then
  echo "Usage: $0 <command> [args...]"
  exit 2
fi

docker compose \
  --project-name "$TEST_PROJECT" \
  --file "$APP_ROOT/compose.test.yaml" \
  up --detach --wait postgres-test

export REPORT_PLATFORM_TEST_DATABASE_URL="postgresql://laiq_report_platform_test:laiq_report_platform_test_only@127.0.0.1:${TEST_PORT}/laiq_report_platform_test"
export REPORT_PLATFORM_DB_SSL=disable

exec "$@"
