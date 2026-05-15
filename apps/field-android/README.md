# Field Android App

This folder is the real product lane for the **local-first Android tablet application**.

## Product role

- primary field runtime
- air-gapped / no live network dependency during inspection
- local capture, validation, attachment storage, and package export

## Target stack

- Kotlin
- Jetpack Compose
- local database
- local file / photo storage
- canonical package export

## Current product scope

This Android lane is now the working **measurement capture engine** for the tank inspection flow.

Current in-app scope:

1. inspection identity + setup fundamentals
2. shell layout baseline
3. roof layout baseline
4. roof elements registry
5. shell UT
6. roof UT
7. shell nozzle registry + UT
8. roof nozzle registry + UT
9. findings + photos + annotation
10. shell settlement survey
11. bottom MFL PDF handoff
12. canonical package export

## Non-goals for the first prototype

- full enterprise sync
- full iOS parity
- advanced reliability analytics
- service network workflows

## Required interfaces

This app must align to:

- `packages/canonical-schema/inspection-package.schema.json`
- `/Users/oscar/Documents/oscar-code/tank-inspection-coplilot-report/apps/report-platform/requirements/CANONICAL_INPUT_REQUIREMENTS.md`

## Report handoff rules

The report lane currently expects the app lane to:

- keep exporting the current `0.1.0` canonical package fields
- export canonical domain data only, never prototype screen-local state
- treat `mflImport` as metadata plus attachment only
- attach the third-party MFL PDF as:
  - `attachments[].kind = "mfl_report"`
  - `mflImport.attachmentId` pointing to that attachment

Near-term structured additions expected by the report lane:

- report header / document control
- general tank information
- recommendations
- checklist items
- thickness calculation inputs
- settlement survey data
- richer attachment metadata

## Build rule

Do not copy prototype screen state from `src/concept/`.

Rebuild against the canonical product model.

## Current implemented flow

This lane currently includes:

- Gradle Android project scaffold
- Jetpack Compose app shell
- production-oriented Kotlin domain model
- Room-backed local session autosave / reload
- canonical export package generation + export ledger
- one-time import path from the legacy JSON session file
- LAIQ mobile UI system across the field flow

Implemented field workflow:

- `Inspection Setup`
  - client / site / tank / inspector / date
  - thickness unit + nozzle size unit
  - shell geometry + shell course count
  - shell crawler lane recommendation + override
  - saved shell start reference + start capture lane
  - roof type + roof layout baseline
  - shell and roof preview maps in setup
- `Task Board`
  - separate field modules for:
    - roof elements
    - shell UT
    - roof UT
    - shell nozzles
    - roof nozzles
    - shell settlement
    - findings
    - export
- `Shell UT`
  - crawler lane / strake selection
  - min / avg / max
  - measurement exception states
  - findings linked from measurement points
- `Roof UT`
  - committed plate map
  - circular / center-opening / umbrella support
  - min / avg / max
  - findings linked from measurement points
- `Roof Elements`
  - separate task from UT / nozzles
  - plate-linked registration
  - annular ring support
  - visual position estimate with map adjustment
- `Shell / Roof Nozzles`
  - registration separated from UT
  - count + size + reinforcement-pad capture
  - plate/cell linking
  - visual position estimate with map adjustment
  - global location summary for downstream reporting
- `Findings`
  - measurement-linked findings
  - photo capture
  - photo annotation
  - edit / delete
- `Shell Settlement`
  - separate raw-capture module
- `Export`
  - canonical package directory + zip export
  - share-sheet handoff
  - configurable upload endpoint
  - recent export history

Important workflow rules already enforced:

- setup baseline changes clear downstream capture
- roof layout is defined in setup and treated as locked downstream
- shell and roof references stay aligned to the saved `0°` baseline
- nozzle / element placement keeps both structural link and visual estimate

Room schema output is tracked at:

- `apps/field-android/app/schemas/ai.laiq.tankinspection.data.local.db.LaiqFieldDatabase/1.json`
- `apps/field-android/app/schemas/ai.laiq.tankinspection.data.local.db.LaiqFieldDatabase/2.json`
- `apps/field-android/app/schemas/ai.laiq.tankinspection.data.local.db.LaiqFieldDatabase/3.json`
- `apps/field-android/app/schemas/ai.laiq.tankinspection.data.local.db.LaiqFieldDatabase/4.json`

## Local build status

This lane now has:

- Homebrew JDK 17 available locally
- Android SDK 34 installed under `/Users/oscar/Library/Android/sdk`
- Gradle wrapper generated in this folder
- first successful debug build produced at:
  - `apps/field-android/app/build/outputs/apk/debug/app-debug.apk`

Build command:

- `cd apps/field-android && export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home && export PATH=/opt/homebrew/opt/openjdk@17/bin:$PATH && ./gradlew assembleDebug`

Test command:

- `cd apps/field-android && export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home && export PATH=/opt/homebrew/opt/openjdk@17/bin:$PATH && ./gradlew testDebugUnitTest`

## Current gaps

Still planned after this version:

1. more robust custom roof layout editing / drawing import path
2. broader report-facing metadata and narrative sections
3. richer attachment metadata required by the report lane
4. more report-generation inputs such as document control and tank history
5. full report-platform ingestion contract instead of the simple upload endpoint
