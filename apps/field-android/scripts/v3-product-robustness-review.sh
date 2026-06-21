#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$ROOT_DIR/../.." && pwd)"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
LOG_ROOT="${LOG_ROOT:-$ROOT_DIR/build/v3-product-robustness}"
LOG_DIR="$LOG_ROOT/$RUN_ID"
SUMMARY="$LOG_DIR/summary.md"

JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
ANDROID_HOME="${ANDROID_HOME:-/Users/oscar/Library/Android/sdk}"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
ADB="${ADB:-$ANDROID_HOME/platform-tools/adb}"

STRESS_ITERATIONS="${STRESS_ITERATIONS:-3}"
FIXTURE_STRESS_ITERATIONS="${FIXTURE_STRESS_ITERATIONS:-200}"
RUN_LINT="${RUN_LINT:-1}"
RUN_REPORT_PLATFORM="${RUN_REPORT_PLATFORM:-0}"
RUN_DEVICE_STRESS="${RUN_DEVICE_STRESS:-auto}"
MONKEY_EVENTS="${MONKEY_EVENTS:-750}"
REPORT_HANDOFF_MODE="${REPORT_HANDOFF_MODE:-deferred}"

FAILURES=0
SKIPS=0

mkdir -p "$LOG_DIR"

{
  printf '# V3 Product Robustness Review\n\n'
  printf -- '- Run ID: `%s`\n' "$RUN_ID"
  printf -- '- Repo: `%s`\n' "$REPO_DIR"
  printf -- '- Android root: `%s`\n' "$ROOT_DIR"
  printf -- '- Java home: `%s`\n' "$JAVA_HOME"
  printf -- '- Android home: `%s`\n' "$ANDROID_HOME"
  printf -- '- Stress iterations: `%s`\n' "$STRESS_ITERATIONS"
  printf -- '- Fixture stress iterations: `%s`\n\n' "$FIXTURE_STRESS_ITERATIONS"
  printf -- '- Report handoff mode: `%s`\n' "$REPORT_HANDOFF_MODE"
  printf -- '- Report-platform build enabled: `%s`\n\n' "$RUN_REPORT_PLATFORM"
  printf '## Steps\n\n'
} > "$SUMMARY"

log_step() {
  local status="$1"
  local name="$2"
  local seconds="$3"
  local log_file="$4"

  printf -- '- %s `%s` (%ss): `%s`\n' "$status" "$name" "$seconds" "$log_file" >> "$SUMMARY"
}

run_step() {
  local name="$1"
  shift
  local log_file="$LOG_DIR/$name.log"
  local started
  local finished
  local seconds

  printf 'Running %s...\n' "$name"
  started="$(date +%s)"
  "$@" > "$log_file" 2>&1
  local status=$?
  finished="$(date +%s)"
  seconds=$((finished - started))

  if [[ $status -eq 0 ]]; then
    log_step "PASS" "$name" "$seconds" "$log_file"
  else
    log_step "FAIL" "$name" "$seconds" "$log_file"
    FAILURES=$((FAILURES + 1))
  fi

  return 0
}

skip_step() {
  local name="$1"
  local reason="$2"
  printf 'Skipping %s: %s\n' "$name" "$reason"
  printf -- '- SKIP `%s`: %s\n' "$name" "$reason" >> "$SUMMARY"
  SKIPS=$((SKIPS + 1))
}

GRADLE_ENV=(
  env
  "JAVA_HOME=$JAVA_HOME"
  "ANDROID_HOME=$ANDROID_HOME"
  "ANDROID_SDK_ROOT=$ANDROID_SDK_ROOT"
)

run_step static_contract python3 - "$REPO_DIR" "$LOG_DIR" "$REPORT_HANDOFF_MODE" <<'PY'
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

repo = Path(sys.argv[1])
log_dir = Path(sys.argv[2])
report_handoff_mode = sys.argv[3]
failures = []
warnings = []
passes = []

def rel(path: Path) -> str:
    try:
        return str(path.relative_to(repo))
    except ValueError:
        return str(path)

def text(path: str) -> str:
    return (repo / path).read_text(encoding="utf-8")

def expect(condition: bool, message: str) -> None:
    if condition:
        passes.append(message)
    else:
        failures.append(message)

def expect_report(condition: bool, message: str) -> None:
    if report_handoff_mode == "strict":
        expect(condition, message)
    elif report_handoff_mode == "deferred":
        if condition:
            passes.append(f"Deferred report handoff check currently passes: {message}")
        else:
            warnings.append(f"DEFERRED REPORT HANDOFF: {message}")
    elif report_handoff_mode == "skip":
        warnings.append(f"SKIPPED REPORT HANDOFF: {message}")
    else:
        failures.append(f"Unsupported REPORT_HANDOFF_MODE={report_handoff_mode}. Use strict, deferred, or skip.")

def warn(condition: bool, message: str) -> None:
    if condition:
        warnings.append(message)

readme = text("apps/field-android/docs/v3-product/README.md")
database_src = text("apps/field-android/app/src/main/java/ai/laiq/tankinspection/v3product/storage/db/ProductFieldDatabase.kt")
store_src = text("apps/field-android/app/src/main/java/ai/laiq/tankinspection/v3product/storage/ProductStore.kt")
manifest_path = repo / "apps/field-android/app/src/main/AndroidManifest.xml"
manifest_src = manifest_path.read_text(encoding="utf-8")

db_version_match = re.search(r"version\s*=\s*(\d+)", database_src)
export_version_match = re.search(r"EXPORT_PACKAGE_SCHEMA_VERSION\s*=\s*(\d+)", store_src)
db_name_match = re.search(r'"(laiq-field-v3-product-db)"', store_src)
db_version = int(db_version_match.group(1)) if db_version_match else None
export_version = int(export_version_match.group(1)) if export_version_match else None

expect(db_version == 8, f"ProductFieldDatabase version should be 8, found {db_version}.")
expect("Current Room database version" in readme and re.search(r"Current Room database version:\s*```text\s*8\s*```", readme, re.S) is not None,
       "README should document Room database version 8.")
expect(export_version == 3, f"ProductStore export schema version should be 3, found {export_version}.")
expect("Current export package schema version" in readme and re.search(r"Current export package schema version:\s*```text\s*3\s*```", readme, re.S) is not None,
       "README should document export package schema version 3.")
expect(db_name_match is not None, "ProductStore should use the V3 product database name.")
expect('"v3_product_export"' in store_src, "ProductStore should export packageType v3_product_export.")
expect('put("voiceNotes"' in store_src, "ProductStore export JSON should include voiceNotes[].")
expect('kind = "voice_audio"' in store_src, "ProductStore should export voice audio attachments.")
expect('private const val VOICE_NOTE_MEDIA_TYPE = "audio/mp4"' in store_src, "Voice note media type should be audio/mp4.")

for migration in ["MIGRATION_1_2", "MIGRATION_2_3", "MIGRATION_3_4", "MIGRATION_4_5", "MIGRATION_5_6", "MIGRATION_6_7", "MIGRATION_7_8"]:
    expect(migration in database_src, f"{migration} should be defined in ProductFieldDatabase.")
    expect(migration in store_src, f"{migration} should be registered in ProductStore.")

schema_path = repo / "apps/field-android/app/schemas/ai.laiq.tankinspection.v3product.storage.db.ProductFieldDatabase/8.json"
expect(schema_path.exists(), f"Room schema file should exist: {rel(schema_path)}")
if schema_path.exists():
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    expect(schema.get("database", {}).get("version") == 8, "Room schema JSON database.version should be 8.")
    entities = {
        entity["tableName"]: {field["columnName"] for field in entity.get("fields", [])}
        for entity in schema.get("database", {}).get("entities", [])
    }

    def require_columns(table: str, columns: set[str]) -> None:
        if table not in entities:
            failures.append(f"Room schema should contain table {table}.")
            return
        missing = sorted(columns - entities[table])
        expect(not missing, f"Room schema table {table} should contain columns {sorted(columns)}; missing {missing}.")

    require_columns("v3_voice_note", {"voiceNoteId", "relativePath", "screenKey", "cardKey", "fieldKey", "targetKey", "itemKey", "transcriptStatus", "mediaType", "fileExists"})
    require_columns("v3_attachment", {"attachmentId", "kind", "relativePath", "mediaType", "fileExists", "fileByteSize"})
    require_columns("v3_layout_config", {"targetKey", "customCircularLayoutJson"})
    require_columns("v3_ut_measurement", {"itemKey", "targetKey", "reinforcementPadReading", "value1", "value2", "value3", "value4", "value5"})
    require_columns("v3_checklist_item", {"itemNumber", "ratingKey", "itemNote"})

android_ns = "{http://schemas.android.com/apk/res/android}"
tree = ET.parse(manifest_path)
application = tree.getroot().find("application")
activities = application.findall("activity") if application is not None else []
launcher_activity = None
for activity in activities:
    name = activity.attrib.get(android_ns + "name", "")
    has_main = any(action.attrib.get(android_ns + "name") == "android.intent.action.MAIN" for action in activity.findall("./intent-filter/action"))
    has_launcher = any(category.attrib.get(android_ns + "name") == "android.intent.category.LAUNCHER" for category in activity.findall("./intent-filter/category"))
    if has_main and has_launcher:
        launcher_activity = activity
        break

launcher_name = launcher_activity.attrib.get(android_ns + "name") if launcher_activity is not None else None
launcher_exported = launcher_activity.attrib.get(android_ns + "exported") if launcher_activity is not None else None
expect(launcher_name == "ai.laiq.tankinspection.v3product.taskhome.ProductTaskHomeActivity",
       f"Launcher should be ProductTaskHomeActivity, found {launcher_name}.")
expect(launcher_exported == "true", f"Launcher exported flag should be true, found {launcher_exported}.")
warn('android:allowBackup="true"' in manifest_src,
     "Manifest currently allows backup. For local inspection evidence, this is a privacy/data-retention risk to review before production.")

fixture_path = repo / "apps/report-platform/src/fixtures/v2-product-export-shell-internal.json"
expect_report(fixture_path.exists(), f"README handoff fixture should exist: {rel(fixture_path)}")
if fixture_path.exists():
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    expect_report(fixture.get("packageType") == "v3_product_export",
                  f"Report fixture packageType should match V3 export contract v3_product_export, found {fixture.get('packageType')}.")
    expect_report(fixture.get("schemaVersion") == export_version,
                  f"Report fixture schemaVersion should match Android V3 export schema {export_version}, found {fixture.get('schemaVersion')}.")
    expect_report(isinstance(fixture.get("voiceNotes"), list),
                  "Report fixture should expose V3 voiceNotes[].")
    expect_report("voiceNarratives" not in fixture,
                  "Report fixture should not rely on legacy voiceNarratives[] for V3 handoff.")
    for key in ["validationResults", "taskSnapshots", "layoutTargets", "layoutConfigs", "elements", "utMeasurements", "inspectionChecklistItems", "findings", "attachments"]:
        expect_report(isinstance(fixture.get(key), list), f"Report fixture should contain array {key}.")

validator_path = repo / "apps/report-platform/src/lib/validateV2ProductExport.ts"
domain_path = repo / "apps/report-platform/src/domain/v2ProductExport.ts"
if validator_path.exists():
    validator_src = validator_path.read_text(encoding="utf-8")
    expect_report('"v2_product_export"' not in validator_src and "schemaVersion !== 2" not in validator_src,
                  "Report-platform validator should not be hard-coded to v2_product_export/schemaVersion 2 for the V3 handoff.")
if domain_path.exists():
    domain_src = domain_path.read_text(encoding="utf-8")
    expect_report("voiceNotes" in domain_src and "voiceNarratives" not in domain_src,
                  "Report-platform domain types should model V3 voiceNotes[] rather than legacy voiceNarratives[].")

alignment_doc = repo / "apps/field-android/docs/v3-product/V10_APP_EXPORT_REPORT_ALIGNMENT_CHECKLIST.md"
if alignment_doc.exists():
    alignment_src = alignment_doc.read_text(encoding="utf-8")
    referenced_v3_fixture = repo / "apps/report-platform/src/fixtures/v3-product-export-shell-internal.json"
    expect_report("v3-product-export-shell-internal.json" not in alignment_src or referenced_v3_fixture.exists(),
                  "V10 alignment doc references v3-product-export-shell-internal.json, but that fixture is absent.")

android_test = repo / "apps/field-android/app/src/androidTest/java/ai/laiq/tankinspection/AppSmokeReviewTest.kt"
if android_test.exists():
    android_test_src = android_test.read_text(encoding="utf-8")
    warn("createAndroidComposeRule<MainActivity>" in android_test_src,
         "Existing instrumentation smoke review still launches MainActivity, not the V3 Product launcher.")

v3_roots = [
    repo / "apps/field-android/app/src/main/java/ai/laiq/tankinspection/v3product",
    repo / "apps/field-android/app/src/main/java/ai/laiq/tankinspection/presentation/v3product",
]
v2_symbol_hits = []
historical_path_hits = []
todo_hits = []
for root in v3_roots:
    if not root.exists():
        continue
    for path in root.rglob("*.kt"):
        src = path.read_text(encoding="utf-8")
        if re.search(r"\bV2\b|v2product|v2_product", src):
            v2_symbol_hits.append(rel(path))
        if re.search(r"v2[-_/]", src):
            historical_path_hits.append(rel(path))
        for i, line in enumerate(src.splitlines(), 1):
            if re.search(r"\b(TODO|FIXME|HACK)\b", line):
                todo_hits.append(f"{rel(path)}:{i}: {line.strip()}")

expect(not v2_symbol_hits, "V3 source should not reference V2 product symbols: " + ", ".join(sorted(set(v2_symbol_hits))[:10]))
warn(bool(historical_path_hits),
     "V3 source contains historical v2 path/string references: " + ", ".join(sorted(set(historical_path_hits))[:10]))
warn(bool(todo_hits), "V3 source contains TODO/FIXME/HACK markers: " + "; ".join(todo_hits[:10]))

report = {
    "passes": passes,
    "warnings": warnings,
    "failures": failures,
}
(log_dir / "static-contract.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

print("Static contract checks")
print(f"passes: {len(passes)}")
print(f"warnings: {len(warnings)}")
print(f"failures: {len(failures)}")
if warnings:
    print("\nWARNINGS")
    for item in warnings:
        print(f"- {item}")
if failures:
    print("\nFAILURES")
    for item in failures:
        print(f"- {item}")
    sys.exit(1)
PY

run_step fixture_json_stress python3 - "$REPO_DIR" "$FIXTURE_STRESS_ITERATIONS" "$LOG_DIR" <<'PY'
import json
import sys
import time
from pathlib import Path

repo = Path(sys.argv[1])
iterations = int(sys.argv[2])
log_dir = Path(sys.argv[3])
fixture_path = repo / "apps/report-platform/src/fixtures/v2-product-export-shell-internal.json"
schema_dir = repo / "apps/field-android/app/schemas/ai.laiq.tankinspection.v3product.storage.db.ProductFieldDatabase"

started = time.perf_counter()
last_metrics = {}
for _ in range(iterations):
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    schemas = [json.loads(path.read_text(encoding="utf-8")) for path in sorted(schema_dir.glob("*.json"))]
    last_metrics = {
        "packageType": fixture.get("packageType"),
        "schemaVersion": fixture.get("schemaVersion"),
        "utMeasurements": len(fixture.get("utMeasurements", [])),
        "inspectionChecklistItems": len(fixture.get("inspectionChecklistItems", [])),
        "findings": len(fixture.get("findings", [])),
        "attachments": len(fixture.get("attachments", [])),
        "schemaFiles": len(schemas),
    }
elapsed = time.perf_counter() - started
result = {
    "iterations": iterations,
    "elapsedSeconds": round(elapsed, 3),
    "lastMetrics": last_metrics,
}
(log_dir / "fixture-json-stress.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result, indent=2))
PY

run_step gradle_compile "${GRADLE_ENV[@]}" "$ROOT_DIR/gradlew" :app:compileDebugKotlin
run_step gradle_unit_tests "${GRADLE_ENV[@]}" "$ROOT_DIR/gradlew" :app:testDebugUnitTest
run_step gradle_assemble "${GRADLE_ENV[@]}" "$ROOT_DIR/gradlew" :app:assembleDebug

if [[ "$RUN_LINT" == "1" ]]; then
  run_step gradle_lint "${GRADLE_ENV[@]}" "$ROOT_DIR/gradlew" :app:lintDebug
else
  skip_step gradle_lint "RUN_LINT=$RUN_LINT"
fi

for iteration in $(seq 1 "$STRESS_ITERATIONS"); do
  run_step "stress_unit_${iteration}" "${GRADLE_ENV[@]}" "$ROOT_DIR/gradlew" --rerun-tasks :app:testDebugUnitTest
done

if [[ "$RUN_REPORT_PLATFORM" == "1" ]]; then
  if [[ -d "$REPO_DIR/apps/report-platform/node_modules" ]]; then
    run_step report_platform_build npm --prefix "$REPO_DIR/apps/report-platform" run build
  else
    skip_step report_platform_build "apps/report-platform/node_modules is missing"
  fi
else
  skip_step report_platform_build "RUN_REPORT_PLATFORM=$RUN_REPORT_PLATFORM"
fi

resolve_device_serial() {
  if [[ -n "${ANDROID_SERIAL:-}" ]]; then
    printf '%s\n' "$ANDROID_SERIAL"
    return
  fi
  if [[ ! -x "$ADB" ]]; then
    return 1
  fi
  "$ADB" devices | awk 'NR > 1 && $2 == "device" { print $1; exit }'
}

DEVICE_SERIAL="$(resolve_device_serial || true)"
if [[ "$RUN_DEVICE_STRESS" == "0" ]]; then
  skip_step device_launch_stress "RUN_DEVICE_STRESS=0"
elif [[ -z "$DEVICE_SERIAL" ]]; then
  skip_step device_launch_stress "No connected Android device detected"
else
  run_step device_install "${GRADLE_ENV[@]}" "$ROOT_DIR/gradlew" :app:installDebug
  run_step device_launch_stress bash -c '
    set -uo pipefail
    adb_bin="$1"
    serial="$2"
    log_dir="$3"
    monkey_events="$4"
    activity="ai.laiq.tankinspection/ai.laiq.tankinspection.v3product.taskhome.ProductTaskHomeActivity"
    "$adb_bin" -s "$serial" logcat -c
    "$adb_bin" -s "$serial" shell am force-stop ai.laiq.tankinspection
    "$adb_bin" -s "$serial" shell am start -W -n "$activity"
    "$adb_bin" -s "$serial" shell monkey -p ai.laiq.tankinspection --pct-syskeys 0 --throttle 50 "$monkey_events"
    "$adb_bin" -s "$serial" logcat -d > "$log_dir/device-logcat.txt"
    grep -E "FATAL EXCEPTION| E AndroidRuntime|ANR in|SQLiteException|IllegalStateException|NullPointerException|SecurityException" "$log_dir/device-logcat.txt" > "$log_dir/device-logcat-highlights.txt" || true
    if [[ -s "$log_dir/device-logcat-highlights.txt" ]]; then
      cat "$log_dir/device-logcat-highlights.txt"
      exit 1
    fi
  ' bash "$ADB" "$DEVICE_SERIAL" "$LOG_DIR" "$MONKEY_EVENTS"
fi

{
  printf '\n## Result\n\n'
  if [[ "$FAILURES" -eq 0 ]]; then
    printf 'PASS: all required robustness steps completed. Skipped steps: `%s`.\n' "$SKIPS"
  else
    printf 'FAIL: `%s` required robustness step(s) failed. Skipped steps: `%s`.\n' "$FAILURES" "$SKIPS"
  fi
} >> "$SUMMARY"

printf '\nSummary: %s\n' "$SUMMARY"
if [[ "$FAILURES" -ne 0 ]]; then
  exit 1
fi
