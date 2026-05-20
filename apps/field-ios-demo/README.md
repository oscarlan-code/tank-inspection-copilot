# Field iOS Demo

This branch adds a separate iOS demo lane without changing the Android app's build wiring.

Current branch:
- `feat/field-ios-demo`

Base Android branch:
- `feat/field-android`

This folder contains two layers:
- `Sources/FieldIOSDemoCore`: a testable Swift package core with demo seeds, draft models, and guardrail logic
- `Scaffold/`: SwiftUI source files for the first iOS demo shell
- `FieldIOSDemo.xcodeproj`: a generated Xcode project for the native demo app

Why this shape:
- the core package can still be verified locally with `swift test`
- the SwiftUI scaffold stays lightweight while sharing product rules with the core module
- the Xcode project is generated from `project.yml`, so the branch stays easy to rebuild and maintain

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

Build the iOS demo app target:

```bash
cd /Users/oscar/Documents/oscar-code/tank-inspection-coplilot-app/apps/field-ios-demo
xcodebuild -project FieldIOSDemo.xcodeproj -scheme FieldIOSDemo -destination 'generic/platform=iOS Simulator' build
```

Run the Xcode test bundle on a simulator:

```bash
cd /Users/oscar/Documents/oscar-code/tank-inspection-coplilot-app/apps/field-ios-demo
xcodebuild -project FieldIOSDemo.xcodeproj -scheme FieldIOSDemo -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
```

## Project Shape

The native app target already wires:
- `Scaffold/FieldIOSDemoApp.swift`
- `Scaffold/FieldDemoViewModel.swift`
- `Scaffold/InspectionSetupView.swift`
- `Scaffold/TaskScopeView.swift`
- `Scaffold/TaskBoardView.swift`
- `Scaffold/ReviewExportView.swift`

`FieldIOSDemo` depends on the shared `FieldIOSDemoCore` framework target, and the project can be regenerated from `project.yml` with `xcodegen generate` if needed.
