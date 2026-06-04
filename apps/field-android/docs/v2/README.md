# V2

`V2` is the Android UX redesign lane inside the same project folder: `apps/field-android`.

`V2` is not a second top-level app folder. It is differentiated by:
- branch and release naming
- docs under `docs/v2/`
- new code under `presentation/v2/`
- separate V2 product storage under `v2/storage/`

Current `V2` code areas:
- `app/src/main/java/ai/laiq/tankinspection/presentation/v2/`
- `app/src/main/java/ai/laiq/tankinspection/v2/`

Storage boundary:
- V2 is a separate product lane and must not persist product data into V1 tables as if it were V1.
- V1 backend design can be used as a reference for scale and robustness.
- Durable V2 product data uses the separate Room database `laiq-field-v2-db`.
- V2 UI recovery may temporarily keep an atomic JSON snapshot, but UT readings, findings, attachments, layout scope/config, elements, and task snapshots must be persisted as structured V2 records.

Current status:
- General Tank Information, Layout Scope, Layout Map Setup, Element Setup, Element Placement, UT Scope, UT Measurements, and linked UT Findings exist in the V2 preview flow.
- Layout Map Setup and Element Placement are still UX checkpoint screens and need more field testing before production wiring.
- UT Scope is intentionally driven by approved layout maps, not by element placement scope.
- V2 preview state now persists locally for process-restart recovery, with product-critical records mirrored into V2 structured storage.
- UT Measurements allows zero UT points for an approved layout; only points with positive readings are highlighted as measured.

Approved workflow for `V2`:
1. build one screen only
2. UI/UX first
3. show the screen to the user
4. refine from user feedback
5. wire backend only after approval
6. test and refine
7. move to the next screen only after the current one is accepted

Initial V2 target order:
1. General Tank Information
2. Layout Scope
3. Layout Map Setup
4. Element Setup
5. Element Placement
6. UT Scope
7. UT Measurements
8. Linked UT Findings

Future improvement notes:
- Replace preview SharedPreferences persistence with the production Room/export model once V2 screens are approved.
- Continue refining roof and floor plate-label behavior for high plate counts.
- Keep crowded layout-map labels hidden by default and reveal the selected plate after tap.
- Treat floor circular plate + annular-ring generation as preview-only until the user approves the screen.
- In UT Scope, show every approved roof/shell/floor layout map even if the user skipped element placement for that map.
- In UT Measurements, show the selected layout map plus any placed elements that need measurement.
- UT Measurements uses a temporary floating card inside the map near the selected plate, shell lane/course, or element.
- Roof/floor/shell base regions use five optional reading slots; roof/shell nozzles use four optional directional readings; other elements use four optional UT slots.
- Linked UT Findings open from the floating UT card and stay tied to the selected plate, shell lane/course, or element.
- Current finding preview supports multiple photos, full-file camera/import capture, simple freehand annotation, quick degradation note chips, and notes.
- Wire persistence/export only after each V2 screen is approved.
