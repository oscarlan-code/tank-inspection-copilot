# Field iOS Demo

This branch adds a separate iOS demo lane without changing the Android app's build wiring.

Current branch:
- `feat/field-ios-demo`

Base Android branch:
- `feat/field-android`

Status on `2026-05-20`:
- the app builds and launches in the iOS simulator
- the app is still a demo scaffold, not a true parity implementation
- some logic parity with Android has been improved
- visual and workflow depth are still far behind Android

This folder contains two layers:
- `Sources/FieldIOSDemoCore`: shared Swift data models, demo seeds, session persistence, and review rules
- `Scaffold/`: SwiftUI source files for the current iOS demo shell
- `FieldIOSDemo.xcodeproj`: generated native Xcode project

Why this shape:
- the core package can be verified with `swift test`
- the SwiftUI shell can move quickly without touching Android
- the Xcode project is generated from `project.yml`, so it can be rebuilt cleanly

## Reality Check

The iOS app is better than the first scaffold, but it is still far from the Android app.

What is now real enough to demo:
- `Inspection Setup`
- `Task Scope`
- `Task Board`
- per-task workspace routing
- `Review & Export`
- `Export Handoff`
- `Load Sample Data`
- local session persistence for the current draft and current screen
- non-destructive task selection
- row-level linked finding and attachment counts inside each task

What is still fake or shallow compared to Android:
- map/detail rendering is still simplified compared to Android inspection maps
- task workspaces do not yet have real task-specific forms like Android
- shell UT, roof UT, nozzle UT, and survey screens are still generic task shells
- findings are only represented as linked counts, not full finding records with rich edit flows
- export handoff is still a demo checkpoint, not a real package/share/upload flow
- many Android-specific editing behaviors, status nuances, and data-entry details are not implemented yet

Important product rule:
- the iOS backend/storage implementation can differ from Android
- the visible operator flow, interaction quality, and task depth should still be brought much closer to Android

## Current Parity Wins

Compared to the earlier iOS scaffold, these parity gaps were improved:
- live draft changes are now persisted locally across relaunches
- selected tasks no longer delete their existing captured rows when toggled off
- review warnings now follow Android-style task presence checks more closely
- the app now continues from review into an explicit export handoff step
- back navigation is more consistent and closer to Android behavior

## Main Gaps Vs Android

These are the biggest remaining differences that matter:
- the UI quality, density, and map detail are still much lower than Android
- task-specific capture experiences are still mostly generic
- findings workflow is still far simpler than Android's linked-measurement capture
- export is still presentational, not operational
- the iOS app still feels like a demo scaffold, not a field-ready mirror of Android

## Recommended Pickup Order

Do not spread effort across everything at once. The best next order is:

1. Make each major task screen real instead of generic.
   - `Shell UT`
   - `Roof UT`
   - `Shell Nozzles`
   - `Roof Nozzles`
   - surveys

2. Bring map/detail UI much closer to Android.
   - shell lane map
   - roof plate map
   - active selection states
   - saved row context
   - finding indicators

3. Replace count-based findings with real finding records.
   - note
   - severity
   - linked row / nozzle / plate
   - attachment references

4. Upgrade review and export from demo-only handoff to a real local export path.

5. Only after the flows feel real, tune color and polish to match Android more closely.

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

Launch on the currently booted simulator:

```bash
xcrun simctl launch booted ai.laiq.fieldiosdemo
```

## Project Shape

The native app target currently wires:
- `Scaffold/FieldIOSDemoApp.swift`
- `Scaffold/FieldDemoViewModel.swift`
- `Scaffold/InspectionSetupView.swift`
- `Scaffold/TaskScopeView.swift`
- `Scaffold/TaskBoardView.swift`
- `Scaffold/TaskWorkspaceView.swift`
- `Scaffold/ReviewExportView.swift`
- `Scaffold/InspectionMapViews.swift`
- `Scaffold/FieldScaffoldComponents.swift`

`FieldIOSDemo` depends on the shared `FieldIOSDemoCore` framework target.

If project wiring gets out of sync, regenerate it with:

```bash
cd /Users/oscar/Documents/oscar-code/tank-inspection-coplilot-app/apps/field-ios-demo
xcodegen generate
```

## Local Device Notes

The committed project stays share-safe:
- no development team is committed
- bundle IDs stay on the generic `ai.laiq.*` values

If you want to install on a physical iPhone locally, set these in Xcode on your own machine:
- a valid personal or org development team
- a unique bundle ID if Apple requires one for your signing context
