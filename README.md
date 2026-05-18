# Tank Inspection Copilot

This repo now centers on the **Android field app** for structured tank-inspection capture.

The current production lane is:
- [apps/field-android/](./apps/field-android/)

Supporting lanes still exist, but they are secondary:
- legacy web reference / concept work under [src/](./src/)
- report platform under [apps/report-platform/](./apps/report-platform/)
- canonical export/schema work under [packages/canonical-schema/](./packages/canonical-schema/)

## Current Product Scope

The Android app is a **measurement-first field capture tool** for vertical storage tank inspection.

Current capture scope:
- inspection identity and setup baseline
- shell layout baseline
- roof layout baseline
- shell UT
- shell settlement survey
- roof UT
- shell nozzle registration + UT
- roof nozzle registration + UT
- roof elements registration / placement
- linked findings with photo + annotation
- review and export
- MFL import handoff metadata

Current product direction:
- field capture first
- report-writing metadata later
- local-first / offline-friendly Android workflow
- canonical package export after field work

## Setup Model

The setup flow now locks the inspection baseline before downstream capture:

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
- 0° reference model
- shell crawler lane baseline
- fixed roof type
- floating roof type
- fixed roof layout baseline when present
- floating roof layout baseline when present

Once the baseline is saved, downstream shell / roof capture is based on the committed layout. Re-saving a changed baseline clears dependent downstream data.

## Roof Model

Roof configuration is no longer a single flat roof type.

It supports:
- fixed roof only
- external floating roof only
- fixed roof + internal floating roof
- covered floating roof combinations via fixed + floating surfaces

The app derives one or two roof surfaces:
- `fixed`
- `floating`

Downstream roof workflows are scoped by roof surface:
- roof layout baseline
- roof elements
- roof nozzles
- roof UT
- roof findings

Current rule:
- roof UT is plate-based
- roof nozzles have registration + nozzle UT
- roof elements are registry / placement + findings, not UT rows

## Main Android Modules

The Android field workflow is organized around these tasks:

- `Inspection Setup`
- `Inspection Scope`
- `Task Board`
- `Roof Elements`
- `Shell UT`
- `Shell Settlement`
- `Roof UT`
- `Shell Nozzles`
- `Roof Nozzles`
- `Findings`
- `Review & Export`

## Demo Data

The app includes a built-in demo inspection seed.

Behavior:
- use `Load Demo Inspection` from `Inspection Setup`
- demo data loads **in place** and stays on the setup screen
- the demo is intended for UI / flow review, not as a canonical sample report

The current demo aligns to the newer measurement-first Android workflow and includes:
- shell baseline
- roof baseline
- shell UT
- shell settlement
- roof UT
- shell nozzles
- roof nozzles
- roof elements
- findings

## Review Notes

Recommended manual review pattern:

1. Demo review
- load the demo inspection
- review saved cards, edit flows, hidden capture forms, and review/export state

2. Clean workflow review
- start a fresh inspection
- create one example item in each module
- verify create / edit / delete / findings / export flow

High-risk areas:
- re-opening hidden capture editors
- roof marker / plate-link consistency
- shell nozzle registry vs UT flow
- findings linked to measurement context
- review/export readiness vs task completion

## Build And Run

Android build root:
- [apps/field-android/](./apps/field-android/)

Typical local build:

```bash
cd apps/field-android
JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.19/libexec/openjdk.jdk/Contents/Home ./gradlew assembleDebug
```

Install to a running emulator:

```bash
/Users/oscar/Library/Android/sdk/platform-tools/adb -s emulator-5554 install -r app/build/outputs/apk/debug/app-debug.apk
/Users/oscar/Library/Android/sdk/platform-tools/adb -s emulator-5554 shell am force-stop ai.laiq.tankinspection
/Users/oscar/Library/Android/sdk/platform-tools/adb -s emulator-5554 shell am start -n ai.laiq.tankinspection/.MainActivity
```

## Repo Lanes

### Android field app
- [apps/field-android/](./apps/field-android/)
- primary product lane

### Report platform
- [apps/report-platform/](./apps/report-platform/)
- post-capture upload, report generation, review

### Canonical schema
- [packages/canonical-schema/](./packages/canonical-schema/)
- shared inspection package model

### Legacy web reference / concept
- [src/](./src/)
- older design/reference material
- useful for historical UI study, not the primary implementation target

## Not In Scope Right Now

Deferred from the field app for now:
- full report-writing/admin metadata
- floor / MFL manual mapping
- roundness survey
- plumbness survey
- broader enterprise workflow automation

These can be added later if they become part of the field capture requirement rather than report assembly only.

## Current Branching

Active implementation work has been happening on:
- `feat/field-android`

## Commercial Assets

Commercial decks and local stakeholder materials may exist under:
- [commercial-output/](./commercial-output/)

Those are not the primary source of product truth for the Android app workflow.
