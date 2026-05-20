# Field Android App

This is the active product lane for the Android field capture app.

If you are moving from Codex CLI to VS Code, this file is the handoff document for:
- what the app does now
- how to run it locally
- which files matter most
- which sample datasets are available
- what is still missing

## Open In VS Code

Open this folder as the workspace root:

- `tank-inspection-coplilot-app/apps/field-android`

Recommended VS Code setup:
- Android Studio or Android SDK already installed locally
- Kotlin extension support
- Gradle for Java extension
- JDK 17 selected for Gradle

Local environment already used successfully on this machine:
- JDK 17
- Android SDK under `/Users/oscar/Library/Android/sdk`

## Build And Run

From this folder:

```bash
cd /Users/oscar/Documents/oscar-code/tank-inspection-coplilot-app/apps/field-android
JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.19/libexec/openjdk.jdk/Contents/Home ./gradlew :app:compileDebugKotlin
JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.19/libexec/openjdk.jdk/Contents/Home ./gradlew assembleDebug
```

Install to the running emulator:

```bash
/Users/oscar/Library/Android/sdk/platform-tools/adb -s emulator-5554 install -r app/build/outputs/apk/debug/app-debug.apk
/Users/oscar/Library/Android/sdk/platform-tools/adb -s emulator-5554 shell am force-stop ai.laiq.tankinspection
/Users/oscar/Library/Android/sdk/platform-tools/adb -s emulator-5554 shell am start -n ai.laiq.tankinspection/.MainActivity
```

If you need to start the emulator:

```bash
/Users/oscar/Library/Android/sdk/emulator/emulator -avd <YOUR_AVD_NAME>
```

## Reviewer Automation

The app reviewer is repo-native automation, not a Codex-only skill.

Files that define it:
- `.github/workflows/android-review.yml`
- `scripts/review-app.sh`
- `app/src/androidTest/java/ai/laiq/tankinspection/AppSmokeReviewTest.kt`
- `app/src/main/java/ai/laiq/tankinspection/testing/AppReviewTags.kt`

How it works:
- local review entry point is `./scripts/review-app.sh`
- CI runs the same flow in GitHub Actions
- `JVM Review` runs compile + unit tests
- `UI Smoke Review` boots an Android emulator, runs the smoke test, and uploads `logcat` artifacts

Current status:
- `./scripts/review-app.sh` now passes locally against the recovered Android module
- the smoke test covers `Load Sample Data -> Open Current -> Open Shell UT`
- reviewer artifacts are written under `build/reviewer/`

Workspace note:
- keep the active checkout outside iCloud-managed folders when possible
- iCloud file eviction can turn `.git` and Kotlin source files into `dataless` placeholders and break both `git` and Gradle unexpectedly

## Product Scope

This app is a measurement-first field capture tool for vertical storage tank inspection.

Current implemented capture scope:
- inspection setup baseline
- shell layout baseline and preview
- roof layout baseline and preview
- shell UT
- shell settlement
- roundness survey
- plumbness survey
- roof UT
- shell nozzle registration + UT
- roof nozzle registration + UT
- roof elements registration / placement
- findings with photo + annotation
- review and export

Current intentional non-goals:
- full report-writing metadata
- floor / detailed MFL capture workflows
- in-app MFL handoff capture
- engineering calculations as primary field tasks
- enterprise sync workflows

## Current Status

Status as of `May 19, 2026`:
- active implementation lane is still `apps/field-android`
- `:app:compileDebugKotlin`, `testDebugUnitTest`, and `assembleDebug` are passing
- the latest debug APK was installed and smoke-tested on `emulator-5554`
- structured local recovery is now the primary restore path
- the setup screen `Saved Inspections` flow now filters out non-restorable records and successfully reopens the active inspection into `Task Board`

Current feature footprint:
- `11` operational modules
- `15` app screens
- `17` top-level canonical package sections

Current real-data sample footprint for `TJS TK-465`:
- `54` measurement rows
- `263` UT reading values
- `24` shell UT rows
- `23` roof UT rows
- `4` shell nozzle UT rows
- `3` roof nozzle UT rows
- `7` nozzle registrations
- `5` roof elements
- `3` findings
- `3` attachments

Current status judgment:
- stable enough for continued internal QA and stakeholder demo
- not yet production-stable

Current known live issue from emulator QA:
- Android system `Back` from task screens exits to the launcher instead of stepping back through the in-app workflow

## Current Setup Model

The setup flow locks a baseline before downstream capture.

Current setup includes:
- client
- site
- tank number
- inspector
- diameter
- height
- shell course count
- thickness unit
- settlement unit
- nozzle size unit
- 0-degree reference model
- shell crawler lane count
- shell start capture lane
- fixed roof type
- floating roof type
- fixed roof layout baseline when fixed roof exists
- floating roof layout baseline when floating roof exists

Important rule:
- if setup baseline changes and is re-saved later, dependent downstream data is cleared

## Roof Model

The roof model is no longer a single flat roof type.

Setup now splits roof into:
- `Fixed Roof Type`
- `Floating Roof Type`

This allows:
- fixed roof only
- external floating roof only
- fixed roof + internal floating roof

The app derives one or two roof surfaces:
- `fixed`
- `floating`

Downstream roof workflows are scoped by roof surface:
- roof UT
- roof nozzles
- roof elements
- findings

### Roof layout types

Fixed roof can currently use:
- `Cone / Radial`
- `Umbrella / Radial`
- `Circular Plate`
- `Circular + Center Opening`

Floating roof currently uses:
- `Circular Plate`

### Current meaning of roof layout inputs

`Cone / Radial`
- `Outer Sector Count`
- `Center Plate Count`
- optional `Annular Ring`

`Umbrella / Radial`
- `Ring Count`
- `Sector Count`
- optional `Annular Ring`

`Circular Plate`
- `Roof Plate Rows`
- `Columns In Widest Row`
- optional `Annular Ring`

`Circular + Center Opening`
- `Roof Plate Rows`
- `Columns In Widest Row`
- `Center Opening Ratio`
- optional `Annular Ring`

## Main Screens / Tasks

Current primary screens:
- `Inspection Setup`
- `Inspection Scope`
- `Task Board`
- `Roof Elements`
- `Shell UT`
- `Shell Settlement`
- `Roundness Survey`
- `Plumbness Survey`
- `Roof UT`
- `Shell Nozzles`
- `Roof Nozzles`
- `Findings`
- `Review & Export`

## Current Nozzle Workflow

Shell and roof nozzles are handled as unified nozzle cards.

Each nozzle card groups:
- registration
- UT
- findings

Expected behavior:
- `Edit Registration`
- `Capture UT` or `Edit UT`
- `Delete Nozzle`
- `Delete UT`
- `Add Finding`

Location workflow:
- choose coarse location from dropdown or map
- fine-adjust with the arrow pad
- `Undo` returns to the last confirmed location, or the default linked cell/plate center

## Current Findings Model

Findings are not a standalone free-floating task anymore.

They are linked from:
- shell UT rows
- roof UT rows
- shell nozzle cards
- roof nozzle cards
- roof elements

Current finding content:
- severity
- defect type
- note
- photo
- annotation / sketch

## Sample Data Sets

The setup screen now has:
- `Sample Data Set`
- `Load Sample Data`
- `Start New Inspection`

Current sample datasets:

### 1. Pacific Energy TK-13
Purpose:
- report-faithful external floating roof scenario

Used to exercise:
- shell UT
- shell settlement
- floating roof layout
- floating roof elements
- shell nozzles
- roof nozzles
- findings

### 2. TJS TK-465
Purpose:
- report-faithful fixed cone roof scenario

Used to exercise:
- fixed roof cone/radial layout
- shell UT
- fixed roof UT
- shell nozzles
- roof nozzles
- fixed-roof elements

Important note:
- this sample should be treated as `fixed roof`
- earlier experimental mixed/floating versions of TJS were not report-faithful

### 3. Full Coverage Sample
Purpose:
- app coverage sample, not tied strictly to one report

Used to exercise:
- fixed roof + floating roof together
- roof elements on both surfaces
- shell settlement
- roundness
- plumbness
- cross-surface nozzle and finding flows

## Key Source Files

If you continue in VS Code, start here.

### App shell
- [app/src/main/java/ai/laiq/tankinspection/LaiqFieldAndroidApp.kt](./app/src/main/java/ai/laiq/tankinspection/LaiqFieldAndroidApp.kt)

### Main state model
- [app/src/main/java/ai/laiq/tankinspection/presentation/FieldDraftState.kt](./app/src/main/java/ai/laiq/tankinspection/presentation/FieldDraftState.kt)

### Roof layout / geometry logic
- [app/src/main/java/ai/laiq/tankinspection/presentation/RoofLayoutSupport.kt](./app/src/main/java/ai/laiq/tankinspection/presentation/RoofLayoutSupport.kt)

### Shared map rendering
- [app/src/main/java/ai/laiq/tankinspection/presentation/components/InspectionMaps.kt](./app/src/main/java/ai/laiq/tankinspection/presentation/components/InspectionMaps.kt)

### Setup screen
- [app/src/main/java/ai/laiq/tankinspection/presentation/screens/InspectionSetupScreen.kt](./app/src/main/java/ai/laiq/tankinspection/presentation/screens/InspectionSetupScreen.kt)

### Roof elements
- [app/src/main/java/ai/laiq/tankinspection/presentation/screens/RoofLayoutScreen.kt](./app/src/main/java/ai/laiq/tankinspection/presentation/screens/RoofLayoutScreen.kt)

### Shell nozzles
- [app/src/main/java/ai/laiq/tankinspection/presentation/screens/ShellNozzleUtScreen.kt](./app/src/main/java/ai/laiq/tankinspection/presentation/screens/ShellNozzleUtScreen.kt)

### Roof nozzles
- [app/src/main/java/ai/laiq/tankinspection/presentation/screens/RoofNozzleUtScreen.kt](./app/src/main/java/ai/laiq/tankinspection/presentation/screens/RoofNozzleUtScreen.kt)

### Shell UT
- [app/src/main/java/ai/laiq/tankinspection/presentation/screens/ShellUtScreen.kt](./app/src/main/java/ai/laiq/tankinspection/presentation/screens/ShellUtScreen.kt)

### Roof UT
- [app/src/main/java/ai/laiq/tankinspection/presentation/screens/RoofUtScreen.kt](./app/src/main/java/ai/laiq/tankinspection/presentation/screens/RoofUtScreen.kt)

### Findings
- [app/src/main/java/ai/laiq/tankinspection/presentation/screens/FindingsScreen.kt](./app/src/main/java/ai/laiq/tankinspection/presentation/screens/FindingsScreen.kt)

### Demo / sample data
- [app/src/main/java/ai/laiq/tankinspection/presentation/DemoDraftSeed.kt](./app/src/main/java/ai/laiq/tankinspection/presentation/DemoDraftSeed.kt)

### Canonical export model
- [app/src/main/java/ai/laiq/tankinspection/domain/model/CanonicalInspectionPackage.kt](./app/src/main/java/ai/laiq/tankinspection/domain/model/CanonicalInspectionPackage.kt)

## Current Known Gaps

These are the main known gaps after the current state.

### Structured modules not added yet
- no dedicated `Shell Elements` task yet
- no dedicated `Diked Area` task yet

Right now those can only be represented indirectly through findings/sample data, not as first-class modules.

### Report-complete metadata still missing
- document control
- report/admin metadata
- general tank information beyond the capture baseline
- checklist sections
- engineering calculations

### Floor / MFL still deferred
- no full floor capture workflow
- no detailed MFL interpretation workflow in-app

### Floating roof layout fidelity
- floating roof works for current capture needs
- but imported/as-built layout support is still not implemented

## Local Storage Refinement

This is no longer just a future note. The storage-hardening work has started, but it is still in a transitional stage.

Current local persistence model:
- the app now restores from structured Room tables first
- the serialized `draftJson` session is kept as a compatibility fallback
- the app now keeps an active-inspection pointer plus a local inspection list
- export/upload is still package-first, but upload attempts are now durably tracked per bundle

Current storage-hardening status:
- explicit Room migrations now replace destructive fallback for schema `1 -> 10`
- startup recovery now rebuilds the inspection from structured Room tables before falling back to `draftJson`
- stable package/inspection IDs are now based on the inspection instance start time, not tank number plus date
- `inspection_record` persists inspection-level summary rows
- `inspection_task_snapshot` persists per-task scope, status, and counts
- `inspection_attachment` indexes attachments by inspection, type, linked record, file size, and file existence
- new captured photos and imported MFL PDFs are stored under inspection-scoped folders instead of one shared flat photo bucket
- `inspection_baseline` now mirrors the committed setup/scope baseline, shell planning baseline, roof layout baseline state, MFL metadata, and review readiness
- `inspection_component` now mirrors roof elements plus shell/roof nozzle registries
- `inspection_measurement` now mirrors shell UT, roof UT, shell nozzle UT, roof nozzle UT, shell settlement, roundness, and plumbness rows/stations
- `inspection_finding` now mirrors findings with linked measurement context and attachment counts
- the setup screen now shows a `Saved Inspections` list so an existing local inspection can be reopened directly on-device
- `export_bundle` now tracks zip existence/size, upload attempt count, last attempt time, and the last upload error

What this means right now:
- the app no longer depends on the large serialized draft blob as the primary recovery source
- nearly the full inspection shape is now both queryable and restorable from Room
- the device can now hold and reopen multiple inspections more safely
- this is the bridge needed before full multi-inspection admin UX, sync queues, and eventual source-of-truth table migration

Next hardening steps:
1. expand the local inspection list into richer admin/detail/recovery views
2. decide which tables become the new source of truth first, likely setup/scope baseline and one measurement module
3. add orphan photo cleanup, retention rules, and attachment integrity checks for large photo volumes
4. promote export/upload tracking from durable status records into a real retry/resume job queue
5. add a repository/service layer between UI state and database writes

What is still not done:
- the UI can reopen inspections, but it is not yet a full inspection-management experience
- export/upload is tracked durably, but it is not yet a robust background job queue
- the serialized draft still exists as a compatibility fallback while the multi-inspection model is not finished

## Current QA Notes

High-risk areas to re-test after edits:
- reopening hidden capture editors
- roof element / roof nozzle marker reopening on the correct plate
- shell nozzle registry vs UT card behavior
- sample reload vs stale persisted state
- delete confirmation flows
- setup baseline reset behavior
- Android back-navigation from task screens

Latest smoke-pass result on `May 19, 2026`:
- `Saved Inspections` only showed the restorable `TJS TK-465` record
- `Open Current` reopened into `Task Board`
- `Open Shell UT` restored the expected seeded counts:
  - `Saved Rows = 24`
  - `Lanes = 4`
  - `Recommended = 4`

## Recommended Manual Review Flow

### Pass 1: sample review
1. open `Inspection Setup`
2. load each sample dataset
3. confirm the setup cards and preview maps
4. continue to task board
5. open each task and verify seeded data

### Pass 2: fresh workflow
1. tap `Start New Inspection`
2. create one example in each module
3. verify create / edit / delete / findings

## Branch / Working Context

Recent active work has been on:
- `feat/field-android`

If you continue in VS Code, this branch is the current implementation lane.
