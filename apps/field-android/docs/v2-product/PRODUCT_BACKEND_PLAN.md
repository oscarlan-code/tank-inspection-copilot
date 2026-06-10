# V2 Product Backend Plan

This plan keeps the approved V2 UI/UX and hardens the Android backend into a product-ready, export-ready field app.

Recommended branch:

```text
feat/field-android-v2-product-backend
```

This is not a V3 redesign. V3 should be reserved for a future workflow or UX redesign.

## Local Folder Boundary

V2 Beta is frozen and must remain untouched:

```text
apps/field-android/docs/v2-beta/
apps/field-android/app/src/main/java/ai/laiq/tankinspection/presentation/v2beta/
apps/field-android/app/src/main/java/ai/laiq/tankinspection/v2beta/
```

V2 Product is the active product-backend working copy:

```text
apps/field-android/docs/v2-product/
apps/field-android/app/src/main/java/ai/laiq/tankinspection/presentation/v2product/
apps/field-android/app/src/main/java/ai/laiq/tankinspection/v2product/
```

The V2 Product copy initially mirrors the V2 Beta UI/UX. Product work should happen only in the `v2product` folders unless a deliberate beta compatibility fix is explicitly requested.

## Product Goal

The Android V2 app must support real inspection tasks that can be started, paused, resumed, audited, exported, and handed off to report generation.

Core goals:
- Use Room-first structured storage as the source of truth.
- Keep local-first operation for field reliability.
- Preserve the current V2 screens and navigation as the product workflow.
- Add tenant, workspace, user, role, and audit metadata before export.
- Generate stable inspection references only after required setup is valid.
- Support ongoing task loading and controlled task archive/delete.

Current implementation checkpoint:
- Room-backed product storage is in place for tasks, layout scope/config, elements, UT, findings, checklist ratings, checklist section notes, audit events, export validation, and export packages.
- Task Home is the product entry point and now supports start, continue, archive, delete, export-readiness review, and export generation.
- The pre-export checklist follows the Pacific Energy fixed-roof sample form numbering exactly; numbering gaps are preserved where floating-roof-only sections are omitted from the source PDF.

## Entry Flow

Add a Task Home screen before General Tank Information.

Task Home actions:
- Start New Inspection
- Continue Ongoing Inspection
- Archive Inspection
- Delete Inspection, only with confirmation
- Show export/readiness status for each task

The Task Home screen becomes the real product entry point.

## Task Creation Rule

Before required setup is valid, the app may hold a temporary in-memory form draft, but it must not create a durable inspection task.

Required minimum before task creation:
- Client
- Tank No.
- Location
- Diameter
- Height
- Course Number
- External Roof yes/no
- Internal Roof yes/no

When the required fields are valid, create the permanent task and generate the inspection reference.

Reference format:

```text
LAIQ-{TankNo}-{yyyyMMdd-HHmmss}
```

Example:

```text
LAIQ-TK13-20260609-173000
```

The generated reference must never change, even if the tank number is edited later. This preserves audit traceability.

## Save Model

Do not add a Save button to every screen.

Use:
- autosave after task creation
- visible save status
- workflow buttons such as Approve Layout, Approve Elements, Confirm UT, and Export

Save status examples:
- Saving...
- Saved
- Offline saved
- Save failed, retrying
- Save blocked until Tank No. is entered

All product screens must save through the same task identity.

## Tenant Topology

Use this topology for product backend and future report-generation handoff:

```text
LAIQ Platform
  |
  |-- Tenant
        |
        |-- Workspace / Project
              |
              |-- Users
              |-- Inspection Tasks
              |-- Export Packages
```

Tenant examples:
- PETRONAS
- IRS
- Inspection Company A

Workspace examples:
- Kerteh Terminal Project
- IRS Field Team
- Pacific Energy Tank Program

## Roles

Keep roles simple for this product version.

```text
Super Admin
  LAIQ/internal only
  creates and manages tenant companies

Manager
  manages one tenant or workspace
  creates inspector accounts
  creates optional reviewer and client viewer accounts
  can view task status
  can archive/delete tasks inside the workspace

Inspector
  creates inspection tasks
  captures setup, maps, elements, UT, findings, and photos
  exports inspection packages
  usually owns report-writing or report-generation handoff

Reviewer
  optional audit role
  reviews completeness, evidence, and export readiness
  can add review notes/status
  does not block inspector export by default unless tenant policy requires it

Client Viewer
  optional read-only role
  can view assigned exported packages or report status
```

Use permissions in storage so a future user can be both Manager and Reviewer.

## Required Data Model

Add or extend V2 Room entities for:
- tenant
- workspace
- user profile
- inspection task
- task audit event
- export package
- export validation result

Every product record should include:
- tenantId
- workspaceId
- inspectionId
- inspectionReference
- createdByUserId
- lastEditedByUserId
- createdAtIso
- updatedAtIso
- deviceId

Inspection child records should retain stable IDs:
- layoutTargetId
- layoutRegionId
- elementId
- utMeasurementId
- findingId
- attachmentId

## Storage Rules

The V2 backend must not rely on one active inspection id.

Replace preview-only identity with:
- one row per inspection task
- task-specific layout scope/config rows
- task-specific element rows
- task-specific UT rows
- task-specific finding rows
- task-specific attachment rows
- task-specific readiness and export rows

All writes that update related task records should be transactional.

Use database migrations for all schema changes.

## Recovery Rules

The app must recover after:
- process death
- force stop
- emulator/device restart
- camera return
- app background/foreground during field work

On restart:
- show Task Home
- list ongoing tasks by updated time
- allow user to continue the exact active task
- restore the current workflow step where practical

Atomic JSON snapshots may remain as emergency UI recovery, but Room is the product source of truth.

## Export Readiness

Export must be blocked when required integrity checks fail.

Readiness checks:
- required General Tank Information exists
- selected layout maps are approved
- scoped element placement is approved when required
- UT scope decisions are saved
- findings have durable location linkage
- finding attachment files exist
- attachment file sizes are greater than zero
- export package includes tenant/account/user/task metadata

Inspector can export without reviewer approval by default.

Reviewer approval is optional and tenant-policy driven.

## Report-Generation Handoff

Export packages must be ready for the report-generation lane.

Package identity should include:
- inspectionReference
- tenantId
- workspaceId
- inspectionId
- exportedByUserId
- exportedAtIso
- schemaVersion

Report generation should not need to infer who captured the data or where the task belongs.

Deferred refinement boundary for now:
- Keep the Android app focused on field capture, structured local storage, task recovery, export readiness, and package handoff.
- Do not block V2 Product on matching every later fullscope PDF page inside the app itself.
- Allow later report-generation work to own final report layout, PDF composition, recommendation formatting, corrosion-rate worksheet formatting, and other report-only presentation concerns.
- Revisit specialized fullscope forms later, especially out-of-service calculation sheets, recommendation pages, crawler/floorscan/settlement/MPI-style report pages, and any optional page-4 data that needs a stronger report contract before it is promoted into the export schema.

## Implementation Phases

Phase 1: Product branch setup
- Create `feat/field-android-v2-product-backend`.
- Keep current V2 UI as the baseline.
- Add Task Home and local profile setup scaffolding.
- Add tenant/workspace/user/task Room entities.

Phase 2: Task identity and autosave
- Generate stable inspection references after required setup.
- Replace `v2-product-active-inspection` with real inspection IDs.
- Route every V2 screen save through the active task.
- Show save status in the app shell.

Phase 3: Structured persistence
- Persist layout scope/config.
- Persist element setup and placement.
- Persist UT scope and measurements.
- Persist linked findings and attachment index.
- Add task snapshot rows for progress and loading.

Phase 4: Recovery and deletion
- Load ongoing task list from Room.
- Continue a selected task.
- Archive tasks safely.
- Hard delete only with confirmation and only when not exported, unless Manager confirms override.

Phase 5: Export readiness
- Add export validation.
- Block export on missing evidence files.
- Include tenant/account/user/task metadata.
- Generate canonical package for report generation.

Phase 6: Review and test
- Add process-death recovery tests.
- Add migration tests.
- Add large dataset save/load tests.
- Add attachment integrity tests.
- Add task archive/delete tests.

## Non-Goals For This Branch

Do not redesign the V2 screen flow.

Do not move into report-platform implementation.

Do not build full cloud authentication yet.

Do not make reviewer approval mandatory by default.

Do not use V1 tables for V2 product data.
