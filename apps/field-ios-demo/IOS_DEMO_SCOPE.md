# iOS Demo Scope

## Objective

Deliver an iOS demo app that mirrors the Android field capture story closely enough for stakeholder demos while staying isolated from the Android delivery lane.

## Included In V1 Demo

Screens:
- `Inspection Setup`
- `Task Scope`
- `Task Board`
- `Review & Export`

UX behaviors:
- `Load Sample Data`
- `Start New Inspection`
- reopen current draft in-memory
- setup validation before continue
- enforce at least one active capture task
- always keep `Review & Export` visible
- show task readiness cards using seeded counts

Data:
- shared scenario IDs matching Android
- setup baseline
- selected capture tasks
- task summary counts
- findings summary counts
- review warnings

## Deferred From V1 Demo

- production-grade local persistence
- camera / photo capture
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
4. The four core demo screens build and test successfully.

Next:
1. Add one deeper capture screen, likely `Shell UT`, if the demo needs more realism.
2. Add lightweight local persistence for reopen-demo behavior across app restarts.
3. Add export/share polish once the client demo flow is confirmed.
