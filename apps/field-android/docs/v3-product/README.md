# V3 Product Android Handover

Last reviewed: 2026-06-21

V3 Product is the isolated Android product lane for the next LAIQ field inspection workflow. It was forked from the accepted V2 Product workflow, but all new implementation should use generic `Product*` class names inside the `v3product` packages so future refinements do not carry confusing versioned symbols through the codebase.

The app is not a standalone SaaS demo. It is the field-capture side of LAIQ's inspection-as-a-service platform: certified inspector onboarding, guided field execution, evidence capture, QA-ready structured export, report-platform ingestion, and reusable asset history.

## Development Boundaries

Frozen areas:

- `apps/field-android/docs/v2-beta/`
- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/presentation/v2beta/`
- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/v2beta/`
- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/presentation/v2product/`
- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/v2product/`

Active V3 areas:

- `apps/field-android/docs/v3-product/`
- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/presentation/v3product/`
- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/v3product/`

Shared rendering files touched by V3:

- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/presentation/RoofLayoutSupport.kt`
- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/presentation/components/InspectionMaps.kt`

Do not add new implementation to `v2product` or `v2beta`. V3 may reuse shared map/rendering utilities when the behavior is intentionally product-wide.

## Current Product Features

Task and identity:

- Local profile scaffold for tenant, workspace, inspector, role, and device metadata.
- Ongoing task board with continue, archive, delete, review/export, readiness, and export status.
- Durable inspection references generated only after required setup is valid.
- Mock V10 task seed aligned to the report-generation fixture path.

Guided inspection workflow:

- General tank information capture.
- Layout scope selection for external roof, internal roof, shell, and floor.
- Layout map setup and approval per target.
- Element setup and target selection.
- Element placement per approved target.
- UT setup per approved target.
- UT measurement capture for plate/region and UT-required elements.
- Finding capture tied to the clicked plate/region or element only.
- Inspection checklist before export, using source-report numbering and section structure.
- Review/export package generation for report-platform ingestion.

Layout map customization:

- Roof/floor circular plate layouts with custom row geometry.
- Split selected circular plate into two or three horizontal pieces.
- Merge adjacent circular plates in the same row.
- Shift individual circular rows left/right with bounded movement.
- Rotate annular ring independently from the main circular plate body.
- Undo last layout edit for split, merge, row shift, and annular ring spin.
- Shell map supports course, plate, lane, offset, tank north, and N/E/S/W orientation behavior.
- Element placement and UT screens render from the approved layout map, not from stale generated defaults.

Element placement:

- Default target order is external roof, internal roof, shell, floor.
- User can switch target tabs.
- Elements are constrained to the visible layout map boundary.
- Dragging from the palette must drop inside the map or the action is ignored.
- Moving an existing element outside the map is ignored.
- Edit mode keeps the selected element visually prominent for drag/edit.
- Element rename does not change element type.
- Nozzle and manhole require UT; other element types require finding data/options only.

UT measurement:

- Plate number is shown during UT so the inspector knows which plate/region is active.
- Plate labels auto-scale to avoid overflowing the plate.
- Plate and element UT can be separated in the UI to reduce green-state visual overload.
- Element UT includes reinforcement pad fields; inspectors can ignore them when no reinforcement pad exists.
- UT measurement state is stored by target and item key.

Findings:

- Findings are scoped to the selected plate/region or selected element.
- Previous findings for that exact item can be previewed and edited.
- Preview cards can be expanded from a hidden stripe.
- Users can retake/add photos, delete photos, edit notes, and delete saved finding previews.
- `Add photo` wording is used instead of `Take photo` to make multiple-photo capture clear.

Checklist:

- Checklist appears after UT and before export.
- Section selector is a dropdown.
- Rating legend is intentionally removed.
- Item text is visually separated from selectable response options.
- Each checklist item supports one rating response plus optional additional note.
- Additional note is collapsed until selected.
- Additional note supports both text and voice.
- Checklist content is intended to stay item-by-item consistent with the sample field sheet/report source.

Voice capture:

- Voice is a complementary evidence channel; it does not overwrite typed fields or structured UT/checklist data.
- Screen-level voice controls exist on core screens.
- Local/card-level voice controls hide the screen-level button while active so only one voice input is visible.
- Hold mic to record; release to stop.
- Double-tap mic to open the voice preview screen scoped to that exact screen/card/target/item.
- Recording button expands from a circle into a larger recording stripe with animated bars.
- Voice preview shows only the notes for that exact portion and supports playback/delete.
- Audio is stored locally as `.m4a` / `audio/mp4`.
- Bundled V10 mock voice assets use AAC-LC `.m4a` so Android `MediaPlayer` can play them reliably.
- App stores voice metadata and raw audio; transcription and interpretation are report-platform responsibilities.

## Tech Stack

Android:

- Kotlin 1.9.24
- Java 17 target
- Android Gradle Plugin from project plugin configuration
- `compileSdk = 34`
- `minSdk = 29`
- `targetSdk = 34`
- `applicationId = ai.laiq.tankinspection`
- Debug app name: `LAIQ Field Debug`

UI:

- Jetpack Compose
- Compose Compiler `1.5.14`
- Compose BOM `2024.06.00`
- Material3
- Activity Compose `1.9.1`
- Shared visual language from `LaiqColors` and `LaiqFieldTheme`

Local-first backend:

- Room `2.6.1`
- Room KTX
- KSP `1.9.24-1.0.20`
- Coroutines Android `1.8.1`
- Room schema export enabled
- Local filesystem attachments for photos, exports, and voice audio

Testing:

- JUnit 4
- Robolectric
- AndroidX test runner
- Compose UI test JUnit4
- Espresso core
- App smoke review script: `apps/field-android/scripts/review-app.sh`

## Runtime Entry Points

Launcher:

```text
ai.laiq.tankinspection.v3product.taskhome.ProductTaskHomeActivity
```

Workflow screens:

```text
task_home
general_info
layout_scope
layout_map_setup
element_setup
element_placement
ut_setup
ut_measurement
checklist
findings
```

Main screen package:

```text
apps/field-android/app/src/main/java/ai/laiq/tankinspection/presentation/v3product/
```

Activity/session/storage package:

```text
apps/field-android/app/src/main/java/ai/laiq/tankinspection/v3product/
```

## Data Stream

The V3 app uses a local-first data stream:

```text
Compose screen state
-> ProductDraftState
-> ProductPreviewSession
-> ProductStore
-> Room database + local files
-> export JSON package + attachment records
-> report-platform fixture/import
-> AI-assisted report generation
```

Important data owners:

- `ProductDraftState` owns the current in-memory inspection draft.
- `ProductPreviewSession` persists preview/session state between screens.
- `ProductStore` writes structured product data into Room and generates export packages.
- `ProductFieldDatabase` defines Room entities, DAOs, and migrations.
- `ProductDraftJsonCodec` serializes preview/session draft data.
- `ProductMockTaskSeed` provides the active V10 mock inspection data.

Room database:

```text
laiq-field-v3-product-db
```

Room schema directory:

```text
apps/field-android/app/schemas/ai.laiq.tankinspection.v3product.storage.db.ProductFieldDatabase/
```

Current Room database version:

```text
8
```

Current export package schema version:

```text
3
```

Export content includes:

- Tenant, workspace, user, role, device, task, and audit metadata.
- General tank information.
- Selected layout targets.
- Approved layout map geometry.
- Custom circular layout JSON for roof/floor where edited.
- Shell course/plate/lane/orientation configuration.
- Element definitions and placements.
- UT setup and UT measurement rows.
- Checklist ratings and notes.
- Findings, finding photos, and finding notes.
- Voice notes with screen/card/target/item metadata.
- Attachments including `voice_audio` and photo files.
- Export validation results and task snapshots.

Voice export contract:

- `voiceNotes[]` contains screen, card, target, item, duration, transcript status, and file metadata.
- `attachments[]` includes each audio file with `kind = "voice_audio"`.
- Live-recorded notes start with `transcriptStatus = "pending_server"`.
- Prepared V10 mock notes include both playable `.m4a` audio and a prepared transcript.
- Report generation should treat the `.m4a` audio as the primary field evidence; the prepared transcript is metadata/reference for QA and debugging only.
- AI transcription is not performed on-device.

## Control Logic

Source of truth:

- Layout scope defines which targets exist.
- Layout map setup owns approved geometry for each target.
- Element setup selects which approved targets need element placement.
- Element placement stores elements by target.
- UT setup selects which approved targets need UT.
- UT measurement stores plate/region UT and element UT by target and item key.
- Findings are tied to the clicked plate/region or element item key.
- Checklist and export consume saved target-keyed data.

Default target order:

```text
External Roof -> Internal Roof -> Shell -> Floor
```

Approval gates:

- General info must be valid before durable setup continues.
- Layout map must be approved for a target before downstream placement/UT uses it.
- Element placement approval is per target.
- UT approval is per target.
- Checklist completion is required before ready-for-export state.
- Review/export validates required records, attachments, and file existence.

Downstream clearing:

- General tank changes that alter roof/shell/floor assumptions can invalidate downstream data.
- Layout scope changes remove data for targets no longer selected.
- Layout map geometry/reference changes clear affected element placement, UT, and findings after user warning.
- Tank north/reference changes can clear downstream data for all approved layout targets.
- Element add/remove/type changes clear affected element UT and affected element findings.
- Element move/rename does not clear plate UT.
- UT setup removal clears UT and findings for the removed target.

Rendering rules:

- Downstream screens render from approved layout map setup.
- Roof and floor use target-specific custom circular layout when available.
- Shell uses shell course, plate, lane, offset, and reference settings from layout map setup.
- Stored element, UT, finding, checklist, and voice metadata remain keyed by target/item, not by current tab.

For the formal control contract, see:

```text
apps/field-android/docs/v3-product/WORKFLOW_DATA_FLOW_CONTRACT.md
```

## Report Platform Handoff

The report-generation platform should use the V3 export package as the product-standard contract. The active fixture path is:

```text
apps/report-platform/src/fixtures/v3-product-export-shell-internal.json
```

The old `v2-product-export-shell-internal.json` fixture remains as a compatibility alias, but V3 export work should use the V3-named fixture as the forward source of truth.

Sample report references used during alignment:

```text
/Users/oscar/Public/irs/Sample Reports/22PE1-4 TK V10 Internal & External Inspection Report.pdf
/Users/oscar/Public/irs/Sample Reports/22PE2-1 TK V10 Shell Internal Inspection Report (Post Blast).pdf
```

Mock field data:

```text
apps/field-android/app/src/main/java/ai/laiq/tankinspection/v3product/preview/ProductMockTaskSeed.kt
```

Mock voice assets:

```text
apps/field-android/app/src/main/assets/v3-voice-notes/mock/
```

The V10 mock voice set contains 23 AAC-LC `.m4a` notes generated from inspector-style field transcripts. These notes should sound like site observations made during capture; avoid wording that says the data came from a report, table, fixture, or generator.

## Key Files

Workflow state and data:

- `v3product/model/ProductDraftState.kt`
- `v3product/model/ProductInspectionChecklist.kt`
- `v3product/model/ProductDownstreamDataImpact.kt`
- `v3product/preview/ProductPreviewSession.kt`
- `v3product/preview/ProductDraftJsonCodec.kt`
- `v3product/preview/ProductMockTaskSeed.kt`

Storage and export:

- `v3product/storage/ProductStore.kt`
- `v3product/storage/ProductModels.kt`
- `v3product/storage/db/ProductFieldDatabase.kt`
- `v3product/storage/db/ProductLayoutConfigEntity.kt`
- `v3product/storage/db/ProductVoiceNoteEntity.kt`
- `v3product/storage/db/ProductAttachmentEntity.kt`

UI screens:

- `presentation/v3product/taskhome/ProductTaskHomeScreen.kt`
- `presentation/v3product/generalinfo/ProductGeneralTankInformationScreen.kt`
- `presentation/v3product/layoutscope/ProductLayoutScopeScreen.kt`
- `presentation/v3product/layoutsetup/ProductLayoutMapSetupScreen.kt`
- `presentation/v3product/elementsetup/ProductElementSetupScreen.kt`
- `presentation/v3product/elementsetup/ProductElementPlacementScreen.kt`
- `presentation/v3product/utsetup/ProductUtSetupScreen.kt`
- `presentation/v3product/utmeasurement/ProductUtMeasurementScreen.kt`
- `presentation/v3product/finding/ProductFindingCaptureScreen.kt`
- `presentation/v3product/checklist/ProductInspectionChecklistScreen.kt`

Map rendering:

- `presentation/v3product/common/ProductCircularLayoutGeometry.kt`
- `presentation/components/InspectionMaps.kt`
- `presentation/RoofLayoutSupport.kt`

Voice:

- `v3product/voice/ProductVoiceCaptureHost.kt`
- `v3product/voice/ProductVoicePreviewActivity.kt`

## Build And Review Commands

From:

```text
apps/field-android/
```

Compile:

```bash
env JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=/Users/oscar/Library/Android/sdk ANDROID_SDK_ROOT=/Users/oscar/Library/Android/sdk ./gradlew :app:compileDebugKotlin
```

Unit tests:

```bash
env JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=/Users/oscar/Library/Android/sdk ANDROID_SDK_ROOT=/Users/oscar/Library/Android/sdk ./gradlew :app:testDebugUnitTest
```

Full local gate:

```bash
env JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=/Users/oscar/Library/Android/sdk ANDROID_SDK_ROOT=/Users/oscar/Library/Android/sdk ./gradlew :app:compileDebugKotlin :app:testDebugUnitTest :app:assembleDebug :app:lintDebug
```

Emulator smoke review:

```bash
env JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=/Users/oscar/Library/Android/sdk ANDROID_SDK_ROOT=/Users/oscar/Library/Android/sdk ANDROID_SERIAL=emulator-5554 ADB=/Users/oscar/Library/Android/sdk/platform-tools/adb SKIP_JVM_REVIEW=1 ./scripts/review-app.sh
```

V3 robustness review, Android-only with report-platform handoff deferred:

```bash
env STRESS_ITERATIONS=1 FIXTURE_STRESS_ITERATIONS=20 RUN_LINT=1 RUN_DEVICE_STRESS=0 REPORT_HANDOFF_MODE=deferred ./scripts/v3-product-robustness-review.sh
```

V3 robustness review, strict report-platform handoff mode for report-generation work:

```bash
env REPORT_HANDOFF_MODE=strict RUN_REPORT_PLATFORM=1 ./scripts/v3-product-robustness-review.sh
```

Physical device install:

```bash
env JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=/Users/oscar/Library/Android/sdk ANDROID_SDK_ROOT=/Users/oscar/Library/Android/sdk ANDROID_SERIAL=<device-serial> ./gradlew :app:installDebug
```

## Handover Risks And Rules

- Do not move the repo back into an iCloud-managed `Documents` clone for active development; use the local `~/Code` checkout behind this workspace symlink.
- Do not bypass downstream clearing when upstream geometry changes; stale layout/UT/finding alignment is a product-critical data integrity risk.
- Do not let element placement or UT render from generated defaults after the user edits and approves a layout.
- Do not let voice notes replace structured fields; voice is additional context for report generation.
- Do not add AI transcription to the Android app unless the product explicitly changes the privacy/offline architecture.
- Do not use broad lint baselines to hide manifest/source drift; fix stale registrations or missing classes directly.
- Keep V2 Product and V2 Beta frozen unless the user explicitly reopens those lanes.
