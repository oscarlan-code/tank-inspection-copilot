#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---standard}"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

REPORT_ENV="$REPO_ROOT/apps/report-platform/.env"
if [[ -f "$REPORT_ENV" ]]; then
  set -a
  source "$REPORT_ENV"
  set +a
fi

if [[ "$MODE" == "--help" || "$MODE" == "-h" ]]; then
  cat <<'USAGE'
Usage:
  apps/report-platform/scripts/report-platform-guardrails.sh [--quick|--standard|--full|--demo|--working-tree]

Modes:
  --quick        build + generation logic audit
  --standard     quick + strict leak audit + API hardening audit
  --full         standard + KB audits + report performance eval
  --demo         standard + local API/UI reachability checks if servers are running
  --working-tree guard staged/working-tree boundaries only

Environment bypasses:
  ALLOW_REPORT_PLATFORM_ANDROID_MIX=1
  ALLOW_REPORT_PLATFORM_RUNTIME_ARTIFACTS=1
USAGE
  exit 0
fi

if [[ "${REPORT_PLATFORM_GUARDRAILS_MODE:-}" != "" ]]; then
  MODE="--${REPORT_PLATFORM_GUARDRAILS_MODE#--}"
fi

changed_files() {
  {
    git diff --name-only
    git diff --cached --name-only
    git ls-files --others --exclude-standard
  } | sort -u
}

staged_files() {
  git diff --cached --name-only | sort -u
}

CHANGED="$(changed_files)"
STAGED_CHANGED="$(staged_files)"
REPORT_CHANGED="$(printf '%s\n' "$CHANGED" | grep '^apps/report-platform/' || true)"
ANDROID_CHANGED="$(printf '%s\n' "$CHANGED" | grep '^apps/field-android/' || true)"
STAGED_REPORT_CHANGED="$(printf '%s\n' "$STAGED_CHANGED" | grep '^apps/report-platform/' || true)"
STAGED_ANDROID_CHANGED="$(printf '%s\n' "$STAGED_CHANGED" | grep '^apps/field-android/' || true)"
RUNTIME_CHANGED="$(printf '%s\n' "$CHANGED" | grep -E '^apps/report-platform/(\.data|dist|node_modules)/' || true)"

if [[ -n "$REPORT_CHANGED" && -n "$ANDROID_CHANGED" && "${ALLOW_REPORT_PLATFORM_ANDROID_MIX:-0}" != "1" ]]; then
  if [[ -n "$STAGED_REPORT_CHANGED" && -n "$STAGED_ANDROID_CHANGED" ]]; then
    echo "Report-platform and Android changes are staged together."
    echo "Split the commit, or set ALLOW_REPORT_PLATFORM_ANDROID_MIX=1 only for an explicit API/export-contract handoff task."
    exit 1
  fi
  echo "Warning: report-platform and Android files are both dirty in this checkout."
  echo "Local verification can continue, but commits must stay split and communicate only via the API/export contract."
elif [[ -n "$REPORT_CHANGED" && -n "$ANDROID_CHANGED" && "${ALLOW_REPORT_PLATFORM_ANDROID_MIX:-0}" == "1" ]]; then
  echo "Warning: report-platform and Android changes are explicitly mixed. Confirm this is an API/export-contract handoff task."
fi

if [[ -n "$RUNTIME_CHANGED" && "${ALLOW_REPORT_PLATFORM_RUNTIME_ARTIFACTS:-0}" != "1" ]]; then
  echo "Runtime/generated report-platform artifacts are staged or untracked:"
  printf '%s\n' "$RUNTIME_CHANGED"
  echo "Do not commit .data, dist, or node_modules."
  exit 1
fi

for required in \
  apps/report-platform/AGENTS.md \
  apps/report-platform/docs/skills/report-platform-boundaries/SKILL.md \
  apps/report-platform/docs/skills/report-platform-workflow/SKILL.md \
  apps/report-platform/docs/skills/report-platform-generation-control/SKILL.md
do
  if [[ ! -f "$required" ]]; then
    echo "Missing report-platform governance file: $required"
    exit 1
  fi
done

if [[ "$MODE" == "--working-tree" ]]; then
  echo "Report-platform working-tree guardrails passed."
  exit 0
fi

echo "Running report-platform guardrails in mode: $MODE"

npm --prefix apps/report-platform run build
npm --prefix apps/report-platform run architecture:audit
npm --prefix apps/report-platform run logic:audit
npm --prefix apps/report-platform run storage:audit
npm --prefix apps/report-platform run training-harness:storage-audit
npm --prefix apps/report-platform run object-upload:audit
npm --prefix apps/report-platform run floor-corrosion:durability-audit

if [[ "$MODE" == "--quick" ]]; then
  echo "Report-platform quick guardrails passed."
  exit 0
fi

STRICT_SAMPLE_LEAK=1 npm --prefix apps/report-platform run leak:audit
npm --prefix apps/report-platform run api:audit

if [[ "$MODE" == "--standard" ]]; then
  echo "Report-platform standard guardrails passed."
  exit 0
fi

if [[ "$MODE" == "--full" ]]; then
  npm --prefix apps/report-platform run floor-corrosion:object-storage-audit
  npm --prefix apps/report-platform run kb:audit
  npm --prefix apps/report-platform run recommendation-kb:audit
  npm --prefix apps/report-platform run report:eval
  echo "Report-platform full guardrails passed."
  exit 0
fi

if [[ "$MODE" == "--demo" ]]; then
  if command -v curl >/dev/null 2>&1; then
    curl -fsS -m 3 http://127.0.0.1:8788/api/health >/dev/null || {
      echo "Warning: report-platform API is not reachable at http://127.0.0.1:8788/api/health"
    }
    curl -fsS -I -m 3 http://127.0.0.1:4174/ >/dev/null || {
      echo "Warning: report-platform UI is not reachable at http://127.0.0.1:4174/"
    }
  fi
  echo "Report-platform demo guardrails completed."
  exit 0
fi

echo "Unknown mode: $MODE"
exit 1
