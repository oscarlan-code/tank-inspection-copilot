# V3 Product Standard Test Plan

Last reviewed: 2026-06-23

This plan covers the Android V3 field app, the V3 export package, and the report-generation pipeline that consumes that export. It is intentionally stricter than a prototype review: the goal is to identify whether the system is safe to treat as a product-standard workflow.

Run script:

```bash
apps/field-android/scripts/v3-product-standard-gate.sh
```

Artifacts are written under:

```text
apps/field-android/build/v3-product-standard-gate/
```

## Product Standard Definition

A passing product-standard gate means:

- Android V3 builds, tests, lints, launches, and survives stress input without crashes, ANRs, or storage exceptions.
- V3 export packages are internally consistent and match the Android V3 schema contract.
- Report-platform import and generation use the Android V3 export as the current fact source.
- Generated report content remains grounded in current export/manual data and does not copy sample-report answer content.
- Sample reports are treated as precedent/format references only, not as a data source for mock app exports or generated report facts.

## Test Matrix

| Area | Gate | Product Risk Covered | Required Result |
| --- | --- | --- | --- |
| Android build | `compileDebugKotlin` | Source drift, missing classes, KSP/Room failures | Pass |
| Android unit tests | `testDebugUnitTest` | JVM/domain regressions | Pass |
| Android package | `assembleDebug` | Packaging/resource errors | Pass |
| Android lint | `lintDebug` | Manifest/source safety drift | Pass |
| Android stress | repeated unit tests | Flaky JVM tests and nondeterministic state failures | Pass |
| Device launch | install + V3 launcher start | Bad launcher, runtime startup crash | Pass when device exists |
| Device stress | Monkey events + logcat scan | Compose/runtime crash, ANR, SQLite exceptions | Pass when device exists |
| Manifest/privacy | static checks | Backup/evidence leakage, wrong launcher | Pass or fail by configured strictness |
| Room contract | source + schema JSON | Broken migrations/exported schema drift | Pass |
| Export contract | fixture/package validation | Broken V3 handoff structure | Pass |
| Export consistency | link integrity checks | Broken target, attachment, voice, UT, finding links | Pass |
| Report build | TypeScript/Vite | UI/report-platform compile drift | Pass |
| Report logic audit | deterministic generation audit | Map/measurement routing regression | Pass |
| Report section generation | all ToC sections | Section template failures, blockers, uncaught exceptions | Pass |
| API smoke | health/bootstrap/import/generate/docx | Server route and persistence failure | Pass when enabled |
| Leak scan | sample PDF extraction + target comparison | Sample-report data copied into app export/generated report | No restricted identifiers or long verbatim phrase matches |

## Android V3 Robustness Plan

1. Static contract checks:
   - Launcher activity is `ai.laiq.tankinspection.v3product.taskhome.ProductTaskHomeActivity`.
   - Room DB is `ProductFieldDatabase` version `8`.
   - Export package schema is `3`.
   - Export package type is `v3_product_export`.
   - V3 export includes `voiceNotes[]`, `attachments[]`, `layoutConfigs[]`, `utMeasurements[]`, checklist rows, findings, and task snapshots.
   - Room schema JSON includes V3 voice, attachment, layout, UT, checklist, and export tables/columns.
   - V3 source does not accidentally use V2 implementation packages.
   - Evidence backup and historical path names are surfaced as production risks.

2. JVM and packaging gates:
   - `:app:compileDebugKotlin`
   - `:app:testDebugUnitTest`
   - `:app:assembleDebug`
   - `:app:lintDebug`

3. Stress gates:
   - Repeat unit tests with `--rerun-tasks`.
   - Default repeat count: `STRESS_ITERATIONS=3`.
   - Device stress installs debug APK, launches the V3 product launcher, injects Monkey input, and scans logcat for:
     - `FATAL EXCEPTION`
     - `E AndroidRuntime`
     - `ANR in`
     - `SQLiteException`
     - `IllegalStateException`
     - `NullPointerException`
     - `SecurityException`

4. Runtime state risks to watch:
   - Startup seeding must not overwrite real work.
   - Async save failures must surface clearly.
   - Attachments and voice files must remain linked to export records.
   - Downstream clearing must remove stale layout/element/UT/finding data.

## V3 Export Consistency Plan

Validate the canonical Android V3 mock export fixture:

- `apps/report-platform/src/fixtures/v3-product-export-shell-internal.json`

Checks:

- Top-level `packageType` is `v3_product_export`.
- Top-level `schemaVersion` is `3`.
- `inspectionId`, `tenantId`, `workspaceId`, and `inspectionReference` match across package, task, record, profile, and validation rows.
- `layoutTargets[].targetKey` values are unique.
- `layoutConfigs[].targetKey` values correspond to known targets.
- `elements[]` have normalized coordinates inside `0..1`.
- `utMeasurements[].itemKey` values are unique and target-keyed.
- Element UT rows link to existing elements where `elementId` exists.
- Finding rows have durable item keys and target linkage.
- Finding photo attachment counts match `attachments[kind=finding_photo]`.
- Voice notes have matching `attachments[kind=voice_audio]`.
- `transcriptStatus` starts as server-pending or accepted explicit status.
- Checklist item numbers are unique and complete for the current catalog expectation.
- No `voiceNarratives[]` legacy field is used.
- Legacy V2-named fixtures are intentionally excluded from the Android V3 gate unless they are explicitly migrated.

## Sample-Report Leak Plan

Sample reports may be used for format precedent and evaluation, but not as hidden source data for the Android mock export or generated report facts.

Leak scan targets:

- V3 mock export fixture JSON.
- Generated report draft content from deterministic generation.
- API smoke generated section content.

- V3 mock export fixture JSON.
- V2-named alias fixture JSON if still present.
- Generated report draft content from deterministic generation.
- API smoke generated section content.

Reference corpus:

```text
/Users/oscar/Public/irs/Sample Reports/*.pdf
```

Detection layers:

1. Restricted identifiers:
   - Report reference IDs extracted from sample PDF filenames/text, for example `22PE1-4`.
   - Sample-report client/site names discovered in filenames or a maintained restricted literal list.
   - Source report names and file stems.

2. Long verbatim phrase overlap:
   - Extract sample PDFs with `pdftotext`.
   - Normalize text to lowercase alphanumeric tokens.
   - Compare long n-grams against export/generated content.
   - Default phrase length: `LEAK_NGRAM_SIZE=12`.
   - Ignore generic standard/report tokens, but flag phrases containing enough distinctive terms.

3. Provenance consistency:
   - Exported facts must identify Android/export provenance, not sample report provenance.
   - Generated sections may cite sample reports as precedent metadata only when the UI/eval explicitly labels them as references.
   - Generated answer content must not reuse source-report observations unless those observations are present in the V3 export/manual inputs.

Expected result:

- `STRICT_SAMPLE_LEAK=1` fails the gate on restricted identifiers or long phrase matches.
- `STRICT_SAMPLE_LEAK=0` records findings but does not fail the gate.

## Report Generation Robustness Plan

1. Static/build gates:
   - `npm --prefix apps/report-platform run build`
   - `npm --prefix apps/report-platform run logic:audit`

2. Deterministic generation matrix:
   - Load `v3-product-export-shell-internal.json`.
   - Classify report package.
   - Generate every section in `API_STANDARD_REPORT_TOC`.
   - Record section content length, review flags, detected issues, fallback reason, and whether live AI was used.
   - Measurement and map sections must use deterministic app-sourced routing.
   - Map sections must render SVG figures where applicable.

3. Report stress loop:
   - Repeat deterministic generation for critical sections:
     - roof plate thickness
     - roof nozzle reinforcement pad thickness
     - shell plate thickness
     - shell nozzle reinforcement pad thickness
     - shell plate layout
     - inspection report
   - Default repeat count: `GENERATION_STRESS_ITERATIONS=3`.

4. API smoke:
   - Start the local report API with deterministic fallback mode.
   - Check `/api/health`.
   - Check `/api/v1/exports/android-v3-product/v10-api-standard.json`.
   - Check `/api/v1/report-jobs/bootstrap/v10-api-standard`.
   - Import the V3 fixture through `/api/v1/imports/android-v3-product`.
   - Generate a representative section.
   - Approve that section.
   - Export DOCX for approved section IDs.

5. Report generation safety:
   - No generated section should claim missing app data when the V3 export contains the data.
   - No generated section should invent readings, locations, findings, dates, client names, or recommendations.
   - Missing manual fields should remain explicit blockers or warnings.
   - Precedent references should guide structure, not answer content.

## Rerun Profiles

Fast local check:

```bash
STRESS_ITERATIONS=1 GENERATION_STRESS_ITERATIONS=1 RUN_DEVICE_STRESS=0 RUN_API_SMOKE=0 \
  apps/field-android/scripts/v3-product-standard-gate.sh
```

Full local product gate:

```bash
STRESS_ITERATIONS=3 GENERATION_STRESS_ITERATIONS=3 RUN_DEVICE_STRESS=auto RUN_API_SMOKE=1 \
  apps/field-android/scripts/v3-product-standard-gate.sh
```

Strict leak-only check:

```bash
RUN_ANDROID_GRADLE=0 RUN_DEVICE_STRESS=0 RUN_REPORT_BUILD=0 RUN_API_SMOKE=0 STRICT_SAMPLE_LEAK=1 \
  apps/field-android/scripts/v3-product-standard-gate.sh
```

## Acceptance Criteria

Product-standard readiness requires:

- Required gates pass with `STRICT_SAMPLE_LEAK=1`.
- Any skipped device/API gates are explicitly justified by environment constraints.
- No high-severity leak findings remain.
- No mock/sample data is auto-seeded into production user flows.
- V3 instrumentation tests cover the V3 launcher, V3 database, V3 export, and at least one full continue/review/export path.
- Report generation can be rerun deterministically from the V3 export without relying on hidden sample-report facts.
