#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_PLATFORM_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
VERIFY_SCRIPT="$SCRIPT_DIR/verify-immutable-layout.mjs"
PREFLIGHT_SCRIPT="$SCRIPT_DIR/preflight-mfl-match.mjs"

layout=""
mfl=""
output=""
placements=""
require_app_figure=0
require_approved=0
allow_partial=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --layout)
      layout="${2:-}"
      shift 2
      ;;
    --mfl)
      mfl="${2:-}"
      shift 2
      ;;
    --output)
      output="${2:-}"
      shift 2
      ;;
    --placements)
      placements="${2:-}"
      shift 2
      ;;
    --require-app-figure)
      require_app_figure=1
      shift
      ;;
    --require-approved)
      require_approved=1
      shift
      ;;
    --allow-partial)
      allow_partial=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$layout" || -z "$mfl" || -z "$output" ]]; then
  usage >&2
  exit 2
fi

for command in node pdftotext pdfimages; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'Required command is unavailable: %s\n' "$command" >&2
    exit 1
  fi
done

if [[ ! -f "$layout" ]]; then
  printf 'Layout JSON was not found: %s\n' "$layout" >&2
  exit 1
fi

if [[ ! -f "$mfl" ]]; then
  printf 'MFL PDF was not found: %s\n' "$mfl" >&2
  exit 1
fi

if [[ -e "$output" ]] && [[ -n "$(find "$output" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
  printf 'Output directory must be new or empty: %s\n' "$output" >&2
  exit 1
fi

mkdir -p "$output"

baseline_verify=(node "$VERIFY_SCRIPT" --baseline "$layout")
if [[ "$require_app_figure" -eq 1 ]]; then
  baseline_verify+=(--require-app-figure)
fi
"${baseline_verify[@]}"

preflight=(node "$PREFLIGHT_SCRIPT" --layout "$layout" --mfl "$mfl")
if [[ -n "$placements" ]]; then
  preflight+=(--placements "$placements")
fi
if [[ "$allow_partial" -eq 1 ]]; then
  preflight+=(--allow-partial)
fi
"${preflight[@]}"

build=(
  node "$REPORT_PLATFORM_ROOT/server/scripts/build-floor-corrosion-map.mjs"
  --layout "$layout"
  --mfl "$mfl"
  --output "$output"
)
if [[ -n "$placements" ]]; then
  build+=(--placements "$placements")
fi
if [[ "$allow_partial" -eq 1 ]]; then
  build+=(--allow-partial true)
fi
"${build[@]}"

composed="$output/floor-corrosion-map.json"
verify=(node "$VERIFY_SCRIPT" --baseline "$layout" --composed "$composed")
if [[ "$require_app_figure" -eq 1 ]]; then
  verify+=(--require-app-figure)
fi
if [[ "$require_approved" -eq 1 ]]; then
  verify+=(--require-approved)
fi
"${verify[@]}"

printf 'MFL overlay complete.\n'
printf '  Layout: %s\n' "$layout"
printf '  Manifest: %s\n' "$composed"
printf '  Figure: %s\n' "$output/floor-corrosion-map.svg"

usage() {
  cat <<'USAGE'
Usage:
  run-overlay-pipeline.sh \
    --layout /path/to/normalized-floor-layout.json \
    --mfl /path/to/individual-mfl-plate-maps.pdf \
    --output /path/to/new-output-directory \
    [--placements /path/to/placements.json] \
    [--require-app-figure] \
    [--require-approved] \
    [--allow-partial]
USAGE
}
