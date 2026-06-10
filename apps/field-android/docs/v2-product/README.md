# V2 Product

`V2 Product` is the Android product-backend lane inside the same project folder: `apps/field-android`.

`V2 Product` keeps the approved V2 Beta UI/UX but uses separate local folders so product hardening does not mutate the beta checkpoint.

`V2 Product` is differentiated by:
- branch and release naming
- docs under `docs/v2-product/`
- beta docs frozen under `docs/v2-beta/`
- product UI code under `presentation/v2product/`
- frozen beta UI code under `presentation/v2beta/`
- product logic/storage under `v2product/`
- frozen beta logic/storage under `v2beta/`

Current `V2` code areas:
- `app/src/main/java/ai/laiq/tankinspection/presentation/v2product/`
- `app/src/main/java/ai/laiq/tankinspection/v2product/`

Storage boundary:
- V2 Product is a separate product lane and must not persist product data into V1 or V2 Beta tables as if it were beta data.
- V1 backend design can be used as a reference for scale and robustness.
- Durable V2 Product data should use product Room storage, starting from the copied database name `laiq-field-v2-product-db`.
- V2 UI recovery may temporarily keep an atomic JSON snapshot, but UT readings, findings, attachments, layout scope/config, elements, and task snapshots must be persisted as structured V2 records.

Current status:
- Task Home, General Tank Information, Layout Scope, Layout Map Setup, Element Setup, Element Placement, UT Scope, UT Measurements, linked UT Findings, and the pre-export inspection checklist now exist in the V2 product flow.
- Layout Map Setup and Element Placement are still UX checkpoint screens and need more field testing before production wiring.
- UT Scope is intentionally driven by approved layout maps, not by element placement scope.
- V2 preview state now persists locally for process-restart recovery, with product-critical records mirrored into V2 structured Room storage.
- UT Measurements allows zero UT points for an approved layout; only points with positive readings are highlighted as measured.
- Task Home can now review export validation results and generate local export packages from the Room-backed product store.
- The checklist numbering intentionally preserves the fixed-roof PDF source numbering, including the gaps where floating-roof-only sections are absent from the sample sheet.

Product-backend target:
- Keep the approved V2 UI/UX and harden the backend underneath it.
- Use branch `feat/field-android-v2-product-backend` for product-level storage, task recovery, tenant/account identity, and export readiness.
- Treat the current V2 branch as the UI-approved baseline, not a V3 redesign.
- Add a Task Home before General Tank Information so users can start a new inspection, continue an ongoing task, or archive/delete a task.
- Review export readiness and export packages from Task Home rather than from the frozen beta flow.
- Create a permanent inspection task only after required General Tank Information is valid, especially `Tank No.`.
- Generate stable inspection references in the format `LAIQ-{TankNo}-{yyyyMMdd-HHmmss}`.
- Autosave every product screen after task creation; do not rely on a Save button on every screen.
- Store tenant, workspace, user, role, task, and audit metadata with every inspection record and export package.
- Product backend plan: `docs/v2-product/PRODUCT_BACKEND_PLAN.md`.

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
- Replace preview SharedPreferences persistence with the production Room/export model as part of the V2 product-backend branch.
- Continue refining roof and floor plate-label behavior for high plate counts.
- Keep crowded layout-map labels hidden by default and reveal the selected plate after tap.
- Treat floor circular plate + annular-ring generation as preview-only until the user approves the screen.
- In UT Scope, show every approved roof/shell/floor layout map even if the user skipped element placement for that map.
- In UT Measurements, show the selected layout map plus any placed elements that need measurement.
- UT Measurements uses a temporary floating card inside the map near the selected plate, shell lane/course, or element.
- Roof/floor/shell base regions use five optional reading slots; roof/shell nozzles use four optional directional readings; other elements use four optional UT slots.
- Linked UT Findings open from the floating UT card and stay tied to the selected plate, shell lane/course, or element.
- Current finding preview supports multiple photos, full-file camera/import capture, simple freehand annotation, quick degradation note chips, and notes.
- Wire product persistence/export against stable V2 task and tenant IDs, not preview-only state.
- Treat later fullscope report formatting as a separate follow-up where appropriate. The app should capture and hand off durable inspection data first; report-generation can later refine final PDF layout, worksheet formatting, and other report-only presentation gaps.
