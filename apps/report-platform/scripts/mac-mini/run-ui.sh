#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$APP_ROOT"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

if [[ ! -f .env ]]; then
  echo "Missing $APP_ROOT/.env. Create it from .env.example."
  exit 1
fi

set -a
source .env
set +a

exec /usr/bin/env npm run preview -- --host 0.0.0.0 --port 4174
