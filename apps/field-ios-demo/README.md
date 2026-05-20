# Field iOS Demo

This branch adds a separate iOS demo lane without changing the Android app's build wiring.

Current branch:
- `feat/field-ios-demo`

Base Android branch:
- `feat/field-android`

This folder contains two layers:
- `Sources/FieldIOSDemoCore`: a testable Swift package core with demo seeds, draft models, and guardrail logic
- `Scaffold/`: SwiftUI source files for the first iOS demo shell

Why this shape:
- full iOS app builds require Xcode, and this machine currently only has Command Line Tools active
- the core package can still be verified locally with `swift test`
- the SwiftUI scaffold can be opened in Xcode later and attached to a real app target

## Demo Goal

The iOS demo should feel close to the Android app for stakeholder walkthroughs:
- `Inspection Setup`
- `Task Scope`
- `Task Board`
- `Review & Export`
- `Load Sample Data`
- the same seeded scenarios
- the same task ordering and validation guardrails

Current intentional deferments:
- MFL stays deferred to report generation, same as Android
- no engineering conclusions or repair suggestions in-app
- no production sync or backend dependency

## Local Verification

Run the core package tests:

```bash
cd /Users/oscar/Documents/oscar-code/tank-inspection-coplilot-app/apps/field-ios-demo
swift test
```

## Next Xcode Step

When Xcode is available, create a native SwiftUI app target and wire in:
- `Scaffold/FieldIOSDemoApp.swift`
- `Scaffold/FieldDemoViewModel.swift`
- `Scaffold/InspectionSetupView.swift`
- `Scaffold/TaskScopeView.swift`
- `Scaffold/TaskBoardView.swift`
- `Scaffold/ReviewExportView.swift`

The app target should depend on the `FieldIOSDemoCore` package target.
