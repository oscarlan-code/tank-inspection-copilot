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

## Recommended First Xcode Milestone

1. Create a SwiftUI app target.
2. Add the `FieldIOSDemoCore` package target.
3. Wire `Load Sample Data`.
4. Ship the four core screens above.
5. Add shell UT detail next if the demo needs one deeper capture screen.
