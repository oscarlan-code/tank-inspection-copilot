#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/build/reviewer"
TEST_CLASS="ai.laiq.tankinspection.AppSmokeReviewTest"
DEFAULT_ADB="/Users/oscar/Library/Android/sdk/platform-tools/adb"

mkdir -p "$LOG_DIR"

resolve_adb() {
  if [[ -n "${ADB:-}" ]]; then
    printf '%s\n' "$ADB"
    return
  fi

  if [[ -x "$DEFAULT_ADB" ]]; then
    printf '%s\n' "$DEFAULT_ADB"
    return
  fi

  command -v adb
}

resolve_device_serial() {
  local adb_bin="$1"

  if [[ -n "${ANDROID_SERIAL:-}" ]]; then
    printf '%s\n' "$ANDROID_SERIAL"
    return
  fi

  "$adb_bin" devices | awk 'NR > 1 && $2 == "device" { print $1; exit }'
}

ADB_BIN="$(resolve_adb)"
DEVICE_SERIAL="$(resolve_device_serial "$ADB_BIN" || true)"

if [[ "${SKIP_JVM_REVIEW:-0}" != "1" ]]; then
  printf 'Running JVM reviewer checks...\n'
  "$ROOT_DIR/gradlew" :app:compileDebugKotlin :app:testDebugUnitTest
else
  printf 'Skipping JVM reviewer checks because SKIP_JVM_REVIEW=1.\n'
fi

if [[ -z "$DEVICE_SERIAL" ]]; then
  printf 'No connected Android device detected. Skipping instrumentation review.\n' | tee "$LOG_DIR/ui-review-status.txt"
  exit 0
fi

printf 'Running UI smoke review on %s...\n' "$DEVICE_SERIAL"
"$ADB_BIN" -s "$DEVICE_SERIAL" logcat -c || true

set +e
"$ROOT_DIR/gradlew" :app:connectedDebugAndroidTest "-Pandroid.testInstrumentationRunnerArguments.class=$TEST_CLASS"
ui_exit=$?
set -e

"$ADB_BIN" -s "$DEVICE_SERIAL" logcat -d > "$LOG_DIR/logcat.txt" || true
grep -E "FATAL EXCEPTION|AndroidRuntime|ANR in|SQLite|IllegalStateException|NullPointerException" "$LOG_DIR/logcat.txt" > "$LOG_DIR/logcat-highlights.txt" || true

printf 'Artifacts:\n'
printf '  %s\n' "$LOG_DIR/logcat.txt"
printf '  %s\n' "$LOG_DIR/logcat-highlights.txt"

exit "$ui_exit"
