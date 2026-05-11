# V1 Carry-Forward Matrix

V1 in [src/App.tsx](/Users/oscar/Documents/oscar-code/tank-inspection-coplilot/src/App.tsx:1) is the reference implementation and should remain untouched.

## Guardrail

- Do not modify the V1 screen flow or components in `src/App.tsx`.
- Use V1 as the gold-standard reference for:
  - app-shell behavior
  - orientation workflow
  - shell layout setup
  - shell layout mapping interaction
- All V2 work should happen outside the V1 implementation.

## Decision legend

- `Keep`: reuse the concept closely in V2
- `Simplify`: keep the idea but reduce steps or UI complexity
- `Drop`: do not carry into MVP V2
- `Later`: useful, but not needed in MVP

## Core shell

| V1 screen/component | Decision | Why |
| --- | --- | --- |
| `AppShell` | Keep | The mobile-width shell, sticky top bar, and sticky bottom nav already feel app-like. |
| `InspectionHeader` | Keep | Compact inspection context is useful across tasks. |
| `ShellSetupScreen` | Keep | Strong layout-setup concept for shell fine mode. |
| `ShellSurfaceMap` | Keep | Best V1 asset. Has seam-origin logic, course display, plate mapping, and proper shell visualization. |
| `LocationSummaryCard` | Simplify | Useful, but should sit near the active input instead of as a separate full card below the map. |
| `MapToolbar` | Later | Useful for review, not for primary field capture. |

## Setup and navigation

| V1 screen/component | Decision | Why |
| --- | --- | --- |
| `HomeScreen` | Simplify | Keep the start/resume behavior, but remove defect-map-first language. |
| `InspectionSetupScreen` | Simplify | Merge into one V2 setup screen with key required fields first. |
| `TankProfileScreen` | Simplify | Keep the tank/profile content, but merge with setup instead of a separate screen. |
| `TankOverviewScreen` | Simplify | Keep the task hub idea, but reduce card density and make it feel less web-like. |
| `OrientationScreen` | Keep | One of the strongest V1 screens. Clear true-north vs physical-marker workflow. |
| `CompassRose` | Keep | Good visual aid for orientation and true-north setup. |

## Location flow

| V1 screen/component | Decision | Why |
| --- | --- | --- |
| `LocationModeScreen` | Drop | A whole screen just to choose map/manual/plate adds friction. This should be inline in V2. |
| `MapLocationScreen` | Simplify | Keep the map-selection idea, but place the map next to the active form fields. |
| `ManualEntryScreen` | Simplify | Keep as a fallback, not as a default path. |
| `PlatePickerScreen` | Later | Useful if drawings/plate numbering are reliable, but not a primary MVP path. |
| `LocationConfirmationScreen` | Drop | Confirmation should happen inline, not as another screen. |

## Finding workflow

| V1 screen/component | Decision | Why |
| --- | --- | --- |
| `DefectTypeScreen` | Simplify | Keep the concept, but make it part of one inline finding flow. |
| `DefectDetailScreen` | Simplify | Same; useful content, too many separate steps. |
| `MeasurementScreen` | Simplify | Keep only as dynamic fields inside the finding flow. |
| `EvidenceScreen` | Keep | Photo requirement is correct, but in V2 the evidence step should come first inside the inline finding flow. |
| `DefectSavedScreen` | Drop | Replace with an in-flow success state or toast. |

## Review and export

| V1 screen/component | Decision | Why |
| --- | --- | --- |
| `SurfaceDefectMapScreen` | Simplify | Keep as a review screen, not as the primary working screen. |
| `SurfaceReviewScreen` | Simplify | Good concept, but should be lighter and task-driven. |
| `InspectionValidationScreen` | Simplify | Merge with review into one inspection-level completion screen. |
| `ExportScreen` | Keep | Export summary and structured outputs are still needed. |
| `SubmissionSuccessScreen` | Later | Fine, but not critical for MVP. |

## Roof

| V1 screen/component | Decision | Why |
| --- | --- | --- |
| `RoofSetupScreen` | Later | Useful only if precise roof layout becomes necessary. |
| `RoofPolarMap` | Later | Good visualization, but too abstract for MVP routine UT capture. |

## Bottom and annular

| V1 screen/component | Decision | Why |
| --- | --- | --- |
| `MflImportScreen` | Keep | Matches current MVP direction for bottom/floor. |
| `AnnularSetupScreen` | Drop | Current MVP direction is no manual annular mapping. |
| `AnnularTopView` | Drop | Same reason; floor/annular is import-first in MVP. |

## Nozzle

| V1 screen/component | Decision | Why |
| --- | --- | --- |
| `NozzleSetupScreen` | Simplify | Keep registry idea, but push later in the flow and reduce setup burden. |
| `NozzleListScreen` | Simplify | Keep if nozzle UT is in scope, but present as a lightweight selector. |
| `NozzleClockMap` | Later | Useful for a future precise nozzle mode, not MVP. |

## What V2 should reuse from V1 first

1. `AppShell`
2. `OrientationScreen`
3. `ShellSetupScreen`
4. `ShellSurfaceMap`

These are the V1 pieces most aligned with the desired V2 product direction.

## What V2 should explicitly avoid from V1

1. Defect-first workflow as the main path
2. Too many full-screen transitions before a record is saved
3. Generic map abstractions as the default for routine work
4. Dedicated annular/manual floor mapping in MVP
5. Card-heavy layouts when a dropdown or compact selector is enough

## V2 interpretation

- Routine work should be coarse and fast.
- Fine shell mapping should reuse V1 shell setup and shell map concepts.
- Orientation should remain explicit and app-level, but V2 maps must actually honor it.
- Roof and nozzle should keep the same task concept as shell, but without precise mapping in MVP.
