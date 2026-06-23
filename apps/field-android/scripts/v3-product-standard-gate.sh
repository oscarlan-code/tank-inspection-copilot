#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$ROOT_DIR/../.." && pwd)"
REPORT_DIR="$REPO_DIR/apps/report-platform"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
LOG_ROOT="${LOG_ROOT:-$ROOT_DIR/build/v3-product-standard-gate}"
LOG_DIR="$LOG_ROOT/$RUN_ID"
SUMMARY="$LOG_DIR/summary.md"

JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
ANDROID_HOME="${ANDROID_HOME:-/Users/oscar/Library/Android/sdk}"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
ADB="${ADB:-$ANDROID_HOME/platform-tools/adb}"
SAMPLE_REPORT_DIR="${SAMPLE_REPORT_DIR:-/Users/oscar/Public/irs/Sample Reports}"

STRESS_ITERATIONS="${STRESS_ITERATIONS:-3}"
GENERATION_STRESS_ITERATIONS="${GENERATION_STRESS_ITERATIONS:-3}"
FIXTURE_STRESS_ITERATIONS="${FIXTURE_STRESS_ITERATIONS:-200}"
MONKEY_EVENTS="${MONKEY_EVENTS:-1000}"
LEAK_NGRAM_SIZE="${LEAK_NGRAM_SIZE:-12}"

RUN_ANDROID_STATIC="${RUN_ANDROID_STATIC:-1}"
RUN_ANDROID_GRADLE="${RUN_ANDROID_GRADLE:-1}"
RUN_ANDROID_STRESS="${RUN_ANDROID_STRESS:-1}"
RUN_DEVICE_STRESS="${RUN_DEVICE_STRESS:-auto}"
RUN_EXPORT_CONSISTENCY="${RUN_EXPORT_CONSISTENCY:-1}"
RUN_REPORT_BUILD="${RUN_REPORT_BUILD:-1}"
RUN_REPORT_GENERATION="${RUN_REPORT_GENERATION:-1}"
RUN_API_SMOKE="${RUN_API_SMOKE:-1}"
RUN_API_NEGATIVE_SMOKE="${RUN_API_NEGATIVE_SMOKE:-1}"
RUN_SAMPLE_LEAK_SCAN="${RUN_SAMPLE_LEAK_SCAN:-1}"
STRICT_SAMPLE_LEAK="${STRICT_SAMPLE_LEAK:-1}"

FAILURES=0
SKIPS=0
LAST_STATUS=0

mkdir -p "$LOG_DIR"

{
  printf '# V3 Product Standard Gate\n\n'
  printf -- '- Run ID: `%s`\n' "$RUN_ID"
  printf -- '- Repo: `%s`\n' "$REPO_DIR"
  printf -- '- Android root: `%s`\n' "$ROOT_DIR"
  printf -- '- Report root: `%s`\n' "$REPORT_DIR"
  printf -- '- Sample report dir: `%s`\n' "$SAMPLE_REPORT_DIR"
  printf -- '- Stress iterations: `%s`\n' "$STRESS_ITERATIONS"
  printf -- '- Generation stress iterations: `%s`\n' "$GENERATION_STRESS_ITERATIONS"
  printf -- '- Fixture stress iterations: `%s`\n' "$FIXTURE_STRESS_ITERATIONS"
  printf -- '- Strict sample leak: `%s`\n\n' "$STRICT_SAMPLE_LEAK"
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
  LAST_STATUS=$status
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

run_gradle_step() {
  local name="$1"
  shift
  run_step "$name" bash -c 'set -uo pipefail; cd "$1"; shift; exec "$@"' bash "$ROOT_DIR" "${GRADLE_ENV[@]}" "$ROOT_DIR/gradlew" "$@"
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

if [[ "$RUN_ANDROID_STATIC" == "1" ]]; then
  run_step android_static_contract python3 - "$REPO_DIR" "$LOG_DIR" <<'PY'
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

repo = Path(sys.argv[1])
log_dir = Path(sys.argv[2])
failures = []
warnings = []
passes = []

def read(path):
    return (repo / path).read_text(encoding="utf-8")

def expect(condition, message):
    (passes if condition else failures).append(message)

def warn(condition, message):
    if condition:
        warnings.append(message)

readme = read("apps/field-android/docs/v3-product/README.md")
database_src = read("apps/field-android/app/src/main/java/ai/laiq/tankinspection/v3product/storage/db/ProductFieldDatabase.kt")
store_src = read("apps/field-android/app/src/main/java/ai/laiq/tankinspection/v3product/storage/ProductStore.kt")
manifest_path = repo / "apps/field-android/app/src/main/AndroidManifest.xml"
manifest_src = manifest_path.read_text(encoding="utf-8")

db_version = int(re.search(r"version\s*=\s*(\d+)", database_src).group(1))
export_version = int(re.search(r"EXPORT_PACKAGE_SCHEMA_VERSION\s*=\s*(\d+)", store_src).group(1))
expect(db_version == 8, f"Room database version is 8, found {db_version}.")
expect(export_version == 3, f"Export schema version is 3, found {export_version}.")
expect("laiq-field-v3-product-db" in store_src, "ProductStore uses V3 product database name.")
expect('"v3_product_export"' in store_src, "ProductStore emits v3_product_export packageType.")
expect('put("voiceNotes"' in store_src, "ProductStore exports voiceNotes[].")
expect('kind = "voice_audio"' in store_src, "ProductStore exports voice_audio attachments.")
expect(re.search(r"Current Room database version:\s*```text\s*8\s*```", readme, re.S) is not None, "README documents Room version 8.")
expect(re.search(r"Current export package schema version:\s*```text\s*3\s*```", readme, re.S) is not None, "README documents export schema version 3.")

for migration in ["MIGRATION_1_2", "MIGRATION_2_3", "MIGRATION_3_4", "MIGRATION_4_5", "MIGRATION_5_6", "MIGRATION_6_7", "MIGRATION_7_8"]:
    expect(migration in database_src, f"{migration} is defined.")
    expect(migration in store_src, f"{migration} is registered.")

schema_path = repo / "apps/field-android/app/schemas/ai.laiq.tankinspection.v3product.storage.db.ProductFieldDatabase/8.json"
expect(schema_path.exists(), "V3 Room schema 8.json exists.")
if schema_path.exists():
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    expect(schema.get("database", {}).get("version") == 8, "Room schema JSON version is 8.")
    entities = {
        entity["tableName"]: {field["columnName"] for field in entity.get("fields", [])}
        for entity in schema.get("database", {}).get("entities", [])
    }
    required = {
        "v3_voice_note": {"voiceNoteId", "relativePath", "screenKey", "cardKey", "fieldKey", "targetKey", "itemKey", "transcriptStatus", "mediaType", "fileExists"},
        "v3_attachment": {"attachmentId", "kind", "relativePath", "mediaType", "fileExists", "fileByteSize"},
        "v3_layout_config": {"targetKey", "customCircularLayoutJson"},
        "v3_ut_measurement": {"itemKey", "targetKey", "reinforcementPadReading", "value1", "value2", "value3", "value4", "value5"},
        "v3_checklist_item": {"itemNumber", "ratingKey", "itemNote"},
    }
    for table, columns in required.items():
        expect(table in entities, f"Room schema contains {table}.")
        if table in entities:
            missing = sorted(columns - entities[table])
            expect(not missing, f"{table} contains required columns; missing {missing}.")

android_ns = "{http://schemas.android.com/apk/res/android}"
tree = ET.parse(manifest_path)
application = tree.getroot().find("application")
launcher = None
for activity in application.findall("activity"):
    has_main = any(action.attrib.get(android_ns + "name") == "android.intent.action.MAIN" for action in activity.findall("./intent-filter/action"))
    has_launcher = any(category.attrib.get(android_ns + "name") == "android.intent.category.LAUNCHER" for category in activity.findall("./intent-filter/category"))
    if has_main and has_launcher:
        launcher = activity
        break
launcher_name = launcher.attrib.get(android_ns + "name") if launcher is not None else None
expect(launcher_name == "ai.laiq.tankinspection.v3product.taskhome.ProductTaskHomeActivity", f"Launcher is V3 ProductTaskHomeActivity, found {launcher_name}.")
expect(launcher is not None and launcher.attrib.get(android_ns + "exported") == "true", "Launcher exported=true.")
warn('android:allowBackup="true"' in manifest_src, "Manifest allows backup; review local evidence privacy before production.")

android_test = repo / "apps/field-android/app/src/androidTest/java/ai/laiq/tankinspection/AppSmokeReviewTest.kt"
if android_test.exists():
    test_src = android_test.read_text(encoding="utf-8")
    warn("createAndroidComposeRule<MainActivity>" in test_src, "Existing instrumentation smoke still targets MainActivity rather than V3 launcher.")
    warn('deleteDatabase("laiq-field-db")' in test_src and 'laiq-field-v3-product-db' not in test_src, "Existing instrumentation cleanup does not reset V3 product database.")

v3_roots = [
    repo / "apps/field-android/app/src/main/java/ai/laiq/tankinspection/v3product",
    repo / "apps/field-android/app/src/main/java/ai/laiq/tankinspection/presentation/v3product",
]
v2_package_hits = []
v2_path_hits = []
mock_seed_hits = []
for root in v3_roots:
    if not root.exists():
        continue
    for path in root.rglob("*.kt"):
        src = path.read_text(encoding="utf-8")
        if re.search(r"\bv2product\b|V2[A-Z]|v2_product", src):
            v2_package_hits.append(str(path.relative_to(repo)))
        if "v2-findings" in src:
            v2_path_hits.append(str(path.relative_to(repo)))
        if "seedMockTasksIfNeeded()" in src or "productMockTaskSeeds()" in src:
            mock_seed_hits.append(str(path.relative_to(repo)))

expect(not v2_package_hits, "V3 source should not reference V2 implementation symbols: " + ", ".join(v2_package_hits[:8]))
warn(bool(v2_path_hits), "V3 source still writes historical v2-findings paths: " + ", ".join(v2_path_hits[:8]))
warn(bool(mock_seed_hits), "V3 source includes automatic mock task seeding paths: " + ", ".join(mock_seed_hits[:8]))

report = {"passes": passes, "warnings": warnings, "failures": failures}
(log_dir / "android-static-contract.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
if failures:
    sys.exit(1)
PY
else
  skip_step android_static_contract "RUN_ANDROID_STATIC=$RUN_ANDROID_STATIC"
fi

if [[ "$RUN_ANDROID_GRADLE" == "1" ]]; then
  run_gradle_step android_gradle_gate :app:compileDebugKotlin :app:testDebugUnitTest :app:assembleDebug :app:lintDebug
else
  skip_step android_gradle_gate "RUN_ANDROID_GRADLE=$RUN_ANDROID_GRADLE"
fi

if [[ "$RUN_ANDROID_STRESS" == "1" ]]; then
  for iteration in $(seq 1 "$STRESS_ITERATIONS"); do
    run_gradle_step "android_unit_stress_${iteration}" --rerun-tasks :app:testDebugUnitTest
  done
else
  skip_step android_unit_stress "RUN_ANDROID_STRESS=$RUN_ANDROID_STRESS"
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
  skip_step android_device_stress "RUN_DEVICE_STRESS=0"
elif [[ -z "$DEVICE_SERIAL" ]]; then
  skip_step android_device_stress "No connected Android device detected"
else
  run_gradle_step android_device_install :app:installDebug
  if [[ "$LAST_STATUS" -ne 0 ]]; then
    skip_step android_device_stress "Debug install failed; see android_device_install.log"
  else
    run_step android_device_stress bash -c '
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
    "$adb_bin" -s "$serial" logcat -d > "$log_dir/android-device-logcat.txt"
    grep -E "FATAL EXCEPTION| E AndroidRuntime|ANR in|SQLiteException|IllegalStateException|NullPointerException|SecurityException" "$log_dir/android-device-logcat.txt" > "$log_dir/android-device-highlights.txt" || true
    if [[ -s "$log_dir/android-device-highlights.txt" ]]; then
      cat "$log_dir/android-device-highlights.txt"
      exit 1
    fi
  ' bash "$ADB" "$DEVICE_SERIAL" "$LOG_DIR" "$MONKEY_EVENTS"
  fi
fi

if [[ "$RUN_EXPORT_CONSISTENCY" == "1" ]]; then
  run_step export_consistency node --input-type=module - "$REPO_DIR" "$LOG_DIR" "$FIXTURE_STRESS_ITERATIONS" <<'NODE'
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2];
const logDir = process.argv[3];
const iterations = Number(process.argv[4]);
const fixturePaths = [
  "apps/report-platform/src/fixtures/v3-product-export-shell-internal.json",
].filter((path) => existsSync(join(repo, path)));

const failures = [];
const failureSet = new Set();
const warnings = [];
const metrics = {};
const knownTargets = new Set(["external_roof", "internal_roof", "shell", "floor"]);

function fail(message) {
  if (!failureSet.has(message)) {
    failureSet.add(message);
    failures.push(message);
  }
}

function warn(message) {
  warnings.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function load(path) {
  return JSON.parse(readFileSync(join(repo, path), "utf8"));
}

function validatePackage(pkg, path) {
  metrics[path] = {
    packageType: pkg.packageType,
    schemaVersion: pkg.schemaVersion,
    layoutTargets: pkg.layoutTargets?.length ?? 0,
    layoutConfigs: pkg.layoutConfigs?.length ?? 0,
    elements: pkg.elements?.length ?? 0,
    utMeasurements: pkg.utMeasurements?.length ?? 0,
    checklistItems: pkg.inspectionChecklistItems?.length ?? 0,
    findings: pkg.findings?.length ?? 0,
    attachments: pkg.attachments?.length ?? 0,
    voiceNotes: pkg.voiceNotes?.length ?? 0,
  };

  assert(pkg.packageType === "v3_product_export", `${path}: packageType must be v3_product_export.`);
  assert(pkg.schemaVersion === 3, `${path}: schemaVersion must be 3.`);
  assert(Array.isArray(pkg.voiceNotes), `${path}: voiceNotes[] is required.`);
  assert(!("voiceNarratives" in pkg), `${path}: legacy voiceNarratives[] must not be present.`);

  assert(pkg.task?.inspectionId === pkg.inspectionId, `${path}: task.inspectionId must match package.`);
  assert(pkg.inspectionRecord?.inspectionId === pkg.inspectionId, `${path}: inspectionRecord.inspectionId must match package.`);
  assert(pkg.profile?.tenantId === pkg.tenantId, `${path}: profile.tenantId must match package.`);
  assert(pkg.profile?.workspaceId === pkg.workspaceId, `${path}: profile.workspaceId must match package.`);
  assert(pkg.task?.tenantId === pkg.tenantId, `${path}: task.tenantId must match package.`);
  assert(pkg.task?.workspaceId === pkg.workspaceId, `${path}: task.workspaceId must match package.`);

  const layoutTargetKeys = new Set();
  for (const target of pkg.layoutTargets ?? []) {
    assert(knownTargets.has(target.targetKey), `${path}: unknown layout target ${target.targetKey}.`);
    assert(!layoutTargetKeys.has(target.targetKey), `${path}: duplicate layout target ${target.targetKey}.`);
    layoutTargetKeys.add(target.targetKey);
  }
  for (const config of pkg.layoutConfigs ?? []) {
    assert(knownTargets.has(config.targetKey), `${path}: unknown layout config target ${config.targetKey}.`);
  }
  for (const element of pkg.elements ?? []) {
    assert(knownTargets.has(element.targetKey), `${path}: unknown element target ${element.targetKey}.`);
    assert(element.normalizedX >= 0 && element.normalizedX <= 1, `${path}: element ${element.elementId} normalizedX outside 0..1.`);
    assert(element.normalizedY >= 0 && element.normalizedY <= 1, `${path}: element ${element.elementId} normalizedY outside 0..1.`);
  }

  const elementKeys = new Set((pkg.elements ?? []).map((element) => `${element.targetKey}:element:${element.elementId}`));
  const utKeys = new Set();
  for (const row of pkg.utMeasurements ?? []) {
    assert(!utKeys.has(row.itemKey), `${path}: duplicate UT itemKey ${row.itemKey}.`);
    utKeys.add(row.itemKey);
    assert(knownTargets.has(row.targetKey), `${path}: unknown UT target ${row.targetKey}.`);
    if (row.itemKind === "ELEMENT" && row.elementId) {
      assert(elementKeys.has(`${row.targetKey}:element:${row.elementId}`), `${path}: element UT row ${row.itemKey} does not link to an element.`);
    }
  }

  const photoAttachmentsByFinding = new Map();
  const voiceAttachmentsByNote = new Map();
  for (const attachment of pkg.attachments ?? []) {
    assert(attachment.fileExists === true, `${path}: attachment ${attachment.attachmentId} is marked missing.`);
    assert((attachment.fileByteSize ?? 0) > 0, `${path}: attachment ${attachment.attachmentId} has empty size.`);
    if (attachment.kind === "finding_photo") {
      photoAttachmentsByFinding.set(attachment.findingId, (photoAttachmentsByFinding.get(attachment.findingId) ?? 0) + 1);
    }
    if (attachment.kind === "voice_audio") {
      voiceAttachmentsByNote.set(attachment.attachmentId.replace(/^voice:/, ""), attachment);
    }
  }
  for (const finding of pkg.findings ?? []) {
    assert(knownTargets.has(finding.targetKey), `${path}: unknown finding target ${finding.targetKey}.`);
    assert(finding.findingId && finding.itemLabel, `${path}: finding ${finding.findingId} lacks durable linkage.`);
    const photoCount = photoAttachmentsByFinding.get(finding.findingId) ?? 0;
    assert(photoCount === finding.attachmentCount, `${path}: finding ${finding.findingId} attachmentCount=${finding.attachmentCount}, photo attachments=${photoCount}.`);
  }
  for (const note of pkg.voiceNotes ?? []) {
    assert(note.mediaType === "audio/mp4", `${path}: voice note ${note.voiceNoteId} mediaType must be audio/mp4.`);
    assert(note.transcriptStatus === "pending_server" || note.transcriptStatus === "transcribed_mock", `${path}: voice note ${note.voiceNoteId} transcriptStatus unexpected: ${note.transcriptStatus}.`);
    assert(voiceAttachmentsByNote.has(note.voiceNoteId), `${path}: voice note ${note.voiceNoteId} lacks matching voice_audio attachment.`);
  }

  const itemNumbers = new Set();
  for (const item of pkg.inspectionChecklistItems ?? []) {
    assert(!itemNumbers.has(item.itemNumber), `${path}: duplicate checklist item ${item.itemNumber}.`);
    itemNumbers.add(item.itemNumber);
  }
  assert(itemNumbers.size >= 190, `${path}: checklist should contain full product checklist coverage, found ${itemNumbers.size}.`);
}

for (let i = 0; i < iterations; i += 1) {
  for (const path of fixturePaths) {
    validatePackage(load(path), path);
  }
}

const result = { iterations, fixturePaths, metrics, warnings, failures };
writeFileSync(join(logDir, "export-consistency.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) process.exit(1);
NODE
else
  skip_step export_consistency "RUN_EXPORT_CONSISTENCY=$RUN_EXPORT_CONSISTENCY"
fi

if [[ "$RUN_REPORT_BUILD" == "1" ]]; then
  if [[ -d "$REPORT_DIR/node_modules" ]]; then
    run_step report_platform_build npm --prefix "$REPORT_DIR" run build
    run_step report_logic_audit npm --prefix "$REPORT_DIR" run logic:audit
  else
    skip_step report_platform_build "apps/report-platform/node_modules is missing"
    skip_step report_logic_audit "apps/report-platform/node_modules is missing"
  fi
else
  skip_step report_platform_build "RUN_REPORT_BUILD=$RUN_REPORT_BUILD"
  skip_step report_logic_audit "RUN_REPORT_BUILD=$RUN_REPORT_BUILD"
fi

if [[ "$RUN_REPORT_GENERATION" == "1" ]]; then
  run_step report_generation_matrix env PATH="" "$(command -v node)" --input-type=module - "$REPO_DIR" "$LOG_DIR" "$GENERATION_STRESS_ITERATIONS" <<'NODE'
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2];
const logDir = process.argv[3];
const stressIterations = Number(process.argv[4]);
const reportRoot = join(repo, "apps/report-platform");
const exportPackage = JSON.parse(readFileSync(join(reportRoot, "src/fixtures/v3-product-export-shell-internal.json"), "utf8"));

const generation = await import(join(reportRoot, "server/generation.mjs"));
const toc = await import(join(reportRoot, "server/report-toc.mjs"));
const classification = await import(join(reportRoot, "server/report-classification.mjs"));
const layout = await import(join(reportRoot, "server/layout-map-figure.mjs"));

const failures = [];
const generated = [];
const criticalSections = [
  "roof-plate-thickness-measurements",
  "roof-nozzle-reinforcement-pad-thickness-measurements",
  "shell-plate-thickness-measurements",
  "shell-nozzle-reinforcement-pad-thickness-measurements",
  "shell-plate-layout",
  "inspection-report",
];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function buildReportState() {
  return {
    exportPackage,
    manualSupplement: {},
    sectionDrafts: [],
    layoutOverrides: [],
    reportClassification: classification.classifyReportPackage(exportPackage),
  };
}

const reportState = buildReportState();
for (const section of toc.API_STANDARD_REPORT_TOC) {
  const { draft, generationRun } = await generation.generateSectionDraft({
    reportState,
    sectionId: section.id,
    userInstruction: "Product standard deterministic generation matrix.",
  });
  generated.push({
    sectionId: section.id,
    title: section.title,
    kind: section.kind,
    content: draft.content,
    summary: draft.summary,
    reviewRequired: draft.reviewRequired,
    detectedIssues: draft.detectedIssues,
    generationRun,
  });
  assert(typeof draft.content === "string" && draft.content.length > 0, `${section.id}: generated empty content.`);
  assert(generationRun && generationRun.providerCode, `${section.id}: missing generation run metadata.`);
  if (section.kind === "map") {
    assert(generationRun.usedLiveModel === false, `${section.id}: map section should be deterministic.`);
    const figure = layout.buildLayoutFigureSvg(reportState, section);
    assert(Boolean(figure?.svg?.includes("<svg") && figure.svg.includes("</svg>")), `${section.id}: map figure SVG missing.`);
  }
}

for (let i = 0; i < stressIterations; i += 1) {
  for (const sectionId of criticalSections) {
    const { draft, generationRun } = await generation.generateSectionDraft({
      reportState,
      sectionId,
      userInstruction: `Product standard stress iteration ${i + 1}.`,
    });
    assert(draft.content.length > 0, `${sectionId}: stress iteration ${i + 1} produced empty content.`);
    if (/measurements|layout/.test(sectionId)) {
      assert(generationRun.usedLiveModel === false, `${sectionId}: stress iteration ${i + 1} should be deterministic.`);
    }
  }
}

const result = {
  sectionCount: generated.length,
  stressIterations,
  generated,
  failures,
};
writeFileSync(join(logDir, "generated-report-drafts.json"), JSON.stringify(generated, null, 2));
writeFileSync(join(logDir, "report-generation-matrix.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify({
  sectionCount: result.sectionCount,
  stressIterations,
  failures,
}, null, 2));
if (failures.length > 0) process.exit(1);
NODE
else
  skip_step report_generation_matrix "RUN_REPORT_GENERATION=$RUN_REPORT_GENERATION"
fi

if [[ "$RUN_SAMPLE_LEAK_SCAN" == "1" ]]; then
  run_step sample_report_leak_scan python3 - "$REPO_DIR" "$LOG_DIR" "$SAMPLE_REPORT_DIR" "$STRICT_SAMPLE_LEAK" "$LEAK_NGRAM_SIZE" <<'PY'
import json
import re
import subprocess
import sys
from pathlib import Path

repo = Path(sys.argv[1])
log_dir = Path(sys.argv[2])
sample_dir = Path(sys.argv[3])
strict = sys.argv[4] == "1"
ngram_size = int(sys.argv[5])

failures = []
warnings = []
evidence = {
    "restrictedIdentifierHits": [],
    "phraseHits": [],
    "samplePdfCount": 0,
    "targetCount": 0,
}

def normalize(value):
    return re.findall(r"[a-z0-9]+", value.lower())

def string_values(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from string_values(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from string_values(item)

target_paths = [
    repo / "apps/report-platform/src/fixtures/v3-product-export-shell-internal.json",
    log_dir / "generated-report-drafts.json",
    log_dir / "api-smoke-response.json",
]

targets = {}
for path in target_paths:
    if not path.exists():
        continue
    if path.suffix == ".json":
        try:
            parsed = json.loads(path.read_text(encoding="utf-8"))
            text = "\n".join(string_values(parsed))
        except Exception:
            text = path.read_text(encoding="utf-8", errors="ignore")
    else:
        text = path.read_text(encoding="utf-8", errors="ignore")
    targets[str(path.relative_to(repo) if path.is_relative_to(repo) else path)] = text
evidence["targetCount"] = len(targets)

pdf_paths = sorted(sample_dir.glob("*.pdf"))
evidence["samplePdfCount"] = len(pdf_paths)
if not pdf_paths:
    failures.append(f"No sample PDFs found under {sample_dir}.")

restricted_literals = {
    "Pacific Energy",
    "Pacific Energy SWP",
    "Shell Bukom",
    "Vuda Terminal",
    "22PE1-4",
    "22PE2-1",
    "22PE2-MPI-1",
}

sample_texts = {}
for pdf in pdf_paths:
    stem = pdf.stem
    restricted_literals.add(stem)
    for match in re.findall(r"\b\d{2}[A-Z]{2,4}\d*(?:-[A-Z]+)?(?:-\d+)?\b", stem.upper()):
        restricted_literals.add(match)
    try:
        text = subprocess.check_output(["pdftotext", "-layout", str(pdf), "-"], text=True, stderr=subprocess.DEVNULL, timeout=30)
    except Exception as exc:
        warnings.append(f"Unable to extract {pdf.name}: {exc}")
        continue
    sample_texts[pdf.name] = text
    for match in re.findall(r"\b\d{2}[A-Z]{2,4}\d*(?:-[A-Z]+)?(?:-\d+)?\b", text.upper()):
        restricted_literals.add(match)

for target_name, target_text in targets.items():
    target_lower = target_text.lower()
    for literal in sorted(restricted_literals, key=len, reverse=True):
        if len(literal) < 5:
            continue
        if literal.lower() in target_lower:
            evidence["restrictedIdentifierHits"].append({
                "target": target_name,
                "literal": literal,
            })

stopwords = {
    "the", "and", "for", "with", "from", "that", "this", "were", "was", "are", "into", "onto",
    "tank", "inspection", "report", "api", "page", "section", "table", "plate", "shell", "roof",
    "floor", "internal", "external", "thickness", "measurement", "measurements", "figure",
}

target_ngrams = {}
for target_name, target_text in targets.items():
    tokens = normalize(target_text)
    grams = {}
    for i in range(0, max(0, len(tokens) - ngram_size + 1)):
        gram_tokens = tokens[i:i + ngram_size]
        distinctive = [token for token in gram_tokens if token not in stopwords and not token.isdigit()]
        if len(distinctive) < 5:
            continue
        grams.setdefault(tuple(gram_tokens), " ".join(gram_tokens))
    target_ngrams[target_name] = grams

max_phrase_hits = 80
seen_hits = set()
for pdf_name, sample_text in sample_texts.items():
    tokens = normalize(sample_text)
    for i in range(0, max(0, len(tokens) - ngram_size + 1)):
        gram = tuple(tokens[i:i + ngram_size])
        distinctive = [token for token in gram if token not in stopwords and not token.isdigit()]
        if len(distinctive) < 5:
            continue
        for target_name, grams in target_ngrams.items():
            if gram in grams:
                key = (pdf_name, target_name, gram)
                if key in seen_hits:
                    continue
                seen_hits.add(key)
                evidence["phraseHits"].append({
                    "samplePdf": pdf_name,
                    "target": target_name,
                    "phrase": " ".join(gram),
                })
                if len(evidence["phraseHits"]) >= max_phrase_hits:
                    break
        if len(evidence["phraseHits"]) >= max_phrase_hits:
            break
    if len(evidence["phraseHits"]) >= max_phrase_hits:
        break

if evidence["restrictedIdentifierHits"]:
    failures.append(f"Restricted sample-report identifiers found: {len(evidence['restrictedIdentifierHits'])}.")
if evidence["phraseHits"]:
    failures.append(f"Long verbatim sample-report phrase overlaps found: {len(evidence['phraseHits'])}.")

result = {
    "strict": strict,
    "ngramSize": ngram_size,
    "warnings": warnings,
    "failures": failures,
    "evidence": evidence,
}
(log_dir / "sample-report-leak-scan.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result, indent=2))
if strict and failures:
    sys.exit(1)
PY
else
  skip_step sample_report_leak_scan "RUN_SAMPLE_LEAK_SCAN=$RUN_SAMPLE_LEAK_SCAN"
fi

if [[ "$RUN_API_SMOKE" == "1" ]]; then
  if [[ -d "$REPORT_DIR/node_modules" ]]; then
    run_step report_api_smoke bash -c '
      set -uo pipefail
      repo="$1"
      report_dir="$2"
      log_dir="$3"
      node_bin="$4"
      api_negative_smoke="$5"
      port="${REPORT_PLATFORM_API_PORT:-8791}"
      server_log="$log_dir/report-api-server.log"
      response_json="$log_dir/api-smoke-response.json"
      PATH="" REPORT_PLATFORM_API_HOST=127.0.0.1 REPORT_PLATFORM_API_PORT="$port" "$node_bin" "$report_dir/server/index.mjs" > "$server_log" 2>&1 &
      server_pid=$!
      cleanup() {
        kill "$server_pid" >/dev/null 2>&1 || true
        wait "$server_pid" >/dev/null 2>&1 || true
      }
      trap cleanup EXIT
      for _ in $(seq 1 40); do
        "$node_bin" -e "fetch(\"http://127.0.0.1:$port/api/health\").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" && break
        sleep 0.25
      done
      RUN_API_NEGATIVE_SMOKE="$api_negative_smoke" "$node_bin" --input-type=module - "$repo" "$port" "$response_json" <<'"'"'NODE'"'"'
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2];
const port = process.argv[3];
const outPath = process.argv[4];
const base = `http://127.0.0.1:${port}`;
const fixture = JSON.parse(readFileSync(join(repo, "apps/report-platform/src/fixtures/v3-product-export-shell-internal.json"), "utf8"));

async function json(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${path} failed ${response.status}: ${text.slice(0, 500)}`);
  }
  return body;
}

const health = await json("/api/health");
const exported = await json("/api/v1/exports/android-v3-product/v10-api-standard.json");
const bootstrap = await json("/api/v1/report-jobs/bootstrap/v10-api-standard");
const imported = await json("/api/v1/imports/android-v3-product", {
  method: "POST",
  body: JSON.stringify({ exportPackage: fixture, manualSupplement: {} }),
});
const reportJobId = imported.reportJob?.reportJobId ?? imported.reportJobId;
if (!reportJobId) throw new Error("Import response did not include reportJobId.");
const generated = await json(`/api/v1/report-jobs/${encodeURIComponent(reportJobId)}/sections/shell-plate-thickness-measurements/generate`, {
  method: "POST",
  body: JSON.stringify({ userInstruction: "API product standard smoke." }),
});
await json(`/api/v1/report-jobs/${encodeURIComponent(reportJobId)}/sections/shell-plate-thickness-measurements/approve`, {
  method: "POST",
  body: JSON.stringify({ note: "API product standard smoke approval." }),
});
const docxResponse = await fetch(`${base}/api/v1/report-jobs/${encodeURIComponent(reportJobId)}/exports/final-report.docx`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sectionIds: ["shell-plate-thickness-measurements"] }),
});
if (!docxResponse.ok) {
  throw new Error(`DOCX export failed ${docxResponse.status}: ${(await docxResponse.text()).slice(0, 500)}`);
}
const docxBytes = (await docxResponse.arrayBuffer()).byteLength;
const robustnessIssues = [];
let invalidActorApprove = null;
if (process.env.RUN_API_NEGATIVE_SMOKE !== "0") {
  const invalidActorResponse = await fetch(`${base}/api/v1/report-jobs/${encodeURIComponent(reportJobId)}/sections/shell-plate-thickness-measurements/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actorUserId: "product-standard-nonexistent-user",
      note: "Negative product-standard actor validation smoke.",
    }),
  });
  const invalidActorText = await invalidActorResponse.text();
  invalidActorApprove = {
    status: invalidActorResponse.status,
    body: invalidActorText.slice(0, 500),
  };
  if (invalidActorResponse.status >= 500) {
    robustnessIssues.push("Invalid approve actor produced a 5xx response instead of a controlled 4xx validation error.");
  }
}
const result = {
  health,
  exportedPackageType: exported.packageType,
  exportedSchemaVersion: exported.schemaVersion,
  bootstrapReportJobId: bootstrap.reportJob?.reportJobId ?? null,
  importedReportJobId: reportJobId,
  generatedSectionCount: generated.sectionDrafts?.length ?? null,
  generatedContent: generated.sectionDrafts?.find((draft) => draft.sectionId === "shell-plate-thickness-measurements")?.content ?? "",
  docxBytes,
  invalidActorApprove,
  robustnessIssues,
};
writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (robustnessIssues.length > 0) {
  process.exit(1);
}
NODE
    ' bash "$REPO_DIR" "$REPORT_DIR" "$LOG_DIR" "$(command -v node)" "$RUN_API_NEGATIVE_SMOKE"
  else
    skip_step report_api_smoke "apps/report-platform/node_modules is missing"
  fi
else
  skip_step report_api_smoke "RUN_API_SMOKE=$RUN_API_SMOKE"
fi

{
  printf '\n## Result\n\n'
  if [[ "$FAILURES" -eq 0 ]]; then
    printf 'PASS: all required product-standard gates completed. Skipped steps: `%s`.\n' "$SKIPS"
  else
    printf 'FAIL: `%s` required product-standard step(s) failed. Skipped steps: `%s`.\n' "$FAILURES" "$SKIPS"
  fi
} >> "$SUMMARY"

printf '\nSummary: %s\n' "$SUMMARY"
if [[ "$FAILURES" -ne 0 ]]; then
  exit 1
fi
