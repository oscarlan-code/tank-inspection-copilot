# iOS Demo Scope

## Objective

Deliver an iOS demo app that mirrors the Android field capture story closely enough for stakeholder demos while staying isolated from the Android delivery lane.

## Included In V1 Demo

Screens:
- `Inspection Setup`
- `Task Scope`
- `Task Board`
- `Review & Export`
- `Export Handoff`
- generic per-task workspace screens

UX behaviors:
- `Load Sample Data`
- `Start New Inspection`
- reopen current draft from lightweight local persistence
- setup validation before continue
- enforce at least one active capture task
- always keep `Review & Export` visible
- preserve task data when a task is deselected
- show task readiness cards using Android-style presence checks
- keep a simple row-level active capture context inside each task

Data:
- shared scenario IDs matching Android
- setup baseline
- selected capture tasks
- task snapshots
- row-level capture entries
- findings summary counts
- review warnings

## Deferred From V1 Demo

- production-grade persistence and recovery depth equal to Android
- real camera / photo capture workflow
- full finding-record editing
- file share / export implementation
- floor capture workflow
- MFL capture workflow
- engineering conclusions or recommendations
- backend sync

## Parity Rules

Use Android as the product reference for:
- task names and ordering
- sample scenario names
- setup validation rules
- review/export guardrails
- visible task flow quality
- map/detail richness
- task-specific capture depth

Use iOS-native behavior for:
- navigation chrome
- toolbar placement
- modal confirmation patterns
- file picker / share sheet when implemented later

## Current Xcode Milestone

Completed:
1. Native SwiftUI app target created on its own branch.
2. Shared `FieldIOSDemoCore` wired into the app and test bundle.
3. `Load Sample Data` wired through the shared demo seed loader.
4. Lightweight local session persistence now keeps the current draft and screen across relaunches.
5. Review now continues into an explicit export-handoff screen.
6. The app builds, tests, and launches on simulator.

Next:
1. Replace generic task workspaces with true Android-like task screens, starting with `Shell UT`.
2. Upgrade findings from counters to real linked records.
3. Deepen the shell and roof maps so they match Android inspection detail more closely.
4. Add real export/share behavior once the visible capture flow is credible.
