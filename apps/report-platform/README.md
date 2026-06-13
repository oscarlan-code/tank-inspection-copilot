# Report Platform

`apps/report-platform` is the product-standard web reporting lane for Tank Inspection Copilot.

Its job is to take durable field capture output from Android V2 Product, combine it with report-side inputs, and generate browser previews plus final PDF reports that match the IRS/Pacific Energy report style.

This is product-standard report infrastructure, not a prototype lane.

The architecture should be understood as a report compiler:

```text
field data -> canonical package -> rule validation -> KB retrieval -> section generation -> deterministic rendering -> human approval -> report export
```

## Product Boundary

Android V2 Product owns:
- durable field capture
- Room-first/local-first task storage
- task recovery and export readiness
- structured export packages

`apps/report-platform` owns:
- import and normalization of exported inspection packages
- multi-tenant report job management aligned with V2 Product
- role-based report access and review workflow
- report-only narrative inputs
- report layout and pagination
- photo ordering and captions
- recommendations formatting
- calculation worksheets and technical appendices
- browser preview
- print/PDF output

Do not force full report presentation requirements back into Android.

## Trusted Inputs

Primary import source today:
- Android V2 Product export package
- `packageType: "v2_product_export"`
- `schemaVersion: 2`

Current app-import mock fixture for report generation:
- `apps/report-platform/src/fixtures/v2-product-export-shell-internal.json`
- Source role: aligned Android V2 Product export fixture for V10
- Reference PDF: `/Users/oscar/Public/irs/Sample Reports/22PE1-4 TK V10 Internal & External Inspection Report.pdf`
- Contains: tenant/workspace/user metadata, layout targets/configs, 23 elements, 136 UT rows, 195 checklist items, 13 checklist section notes, 9 findings, and 0 attachments.
- UT split: 68 external roof rows, 32 shell rows, and 36 floor rows.

The report-platform API seeds this fixture through:
- `GET /api/v1/report-jobs/bootstrap/v10-api-standard`
- `POST /api/v1/imports/android-v2-product`

The legacy bootstrap alias `GET /api/v1/report-jobs/bootstrap/shell-internal` is kept only for compatibility with older local UI sessions.

Canonical alignment target:
- `packages/canonical-schema/inspection-package.schema.json`
- `packages/canonical-schema/examples/minimal-inspection-package.json`

If the canonical schema file in this clone looks suspicious, cross-check the recovered clone before changing the contract.

## Reference Reports

Sample report corpus:
- `/Users/oscar/Public/irs/Sample Reports/`

Primary API-standard format precedent for the current report preview:
- `/Users/oscar/Public/irs/Sample Reports/22PE1-4 TK V10 Internal & External Inspection Report.pdf`

Standards/code corpus:
- `/Users/oscar/Public/irs/Codes/`

Primary standard basis for the current vertical AST workflow:
- `API 653`

Supporting code/reference basis:
- `EEMUA 159`
- `API 650`
- `API 575`
- `API 652`
- `API 577`

Checklist / fieldsheet reference:
- `/Users/oscar/Public/irs/Sample Reports/Pacific Energy Fieldsheet (Fullscope).pdf`

The KB should index previous sample reports as curated platform-library precedent, then filter by report family, section type, inspection type, tenant/workspace rules, and approval status before generation.

The Codes folder should be indexed as standards guidance. It should not be mixed with precedent formatting retrieval and should not be copied verbatim into client-facing report content.

Broader report-family references in the folder show a stable reusable report spine:
- scope
- general tank information
- inspection report
- recommendations / API assessment
- photographs
- optional checklist, calculations, layout sketches, settlement, crawler, MPI, MFL, or other appendices

## Current Direction

The report platform itself is product-standard.

Any legacy root-level web app code outside `apps/report-platform` should be treated as reference material only and should not define the final product architecture.

The report platform should be built deliberately under this app boundary with:
1. an adapter layer for current Android export
2. a normalized report-job model
3. inspector report-side inputs captured separately from app export
4. multi-tenant report jobs and role-based access aligned with V2 Product
5. previous reports used as a knowledge base for structure/style/pattern retrieval
6. Codex CLI used as a section-by-section drafting worker
7. reusable report page blocks
8. browser preview first
9. PDF output second

Product development workflow:
- `apps/report-platform/PRODUCT_DEVELOPMENT_PLAN.md`

Topology and orchestration:
- `apps/report-platform/REPORT_COMPILER_WORKFLOW.md`
- `apps/report-platform/REPORT_GENERATION_TOPOLOGY.md`
- `apps/report-platform/FULL_SYSTEM_DIAGRAM.md`
- `apps/report-platform/AI_ENGINE_SYSTEM_DIAGRAM.md`
- `apps/report-platform/CODEX_ROLES_AND_TOOLING.md`
- `apps/report-platform/REPORT_GENERATION_AND_LAYOUTMAP_ORCHESTRATION.md`
- `apps/report-platform/PRECEDENT_KB_ARCHITECTURE.md`

Backend and storage architecture:
- `apps/report-platform/BACKEND_STORAGE_ARCHITECTURE.md`

AI quality and layout-map control:
- `apps/report-platform/AI_QUALITY_AND_LAYOUTMAP.md`

Sample-report formatting review:
- `apps/report-platform/SAMPLE_REPORT_FORMATTING_REVIEW.md`

## Tenant And Role Alignment

The report platform should align to the same tenant/workspace/user model as Android V2 Product:

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
              |-- Report Jobs
              |-- Report Section Drafts
              |-- Review Decisions
```

Role alignment for this product version:

- `Super Admin`: LAIQ/internal only. Manages tenants, global policies, and platform-level libraries.
- `Manager`: manages one tenant or workspace, can assign report work, view status, and approve publication workflows allowed by tenant policy.
- `Inspector`: owns field handoff into reporting, can create report jobs from exports, provide manual report inputs, and run generation.
- `Reviewer`: optional audit/review role, can review sections, add comments, request reruns, and approve report readiness when tenant policy requires it.
- `Client Viewer`: read-only access to approved exported packages or final report outputs assigned to them.

Users may hold multiple roles, matching the V2 Product direction.

Knowledge-base access must respect role and tenancy:

- tenant-private reports stay inside the same tenant
- workspace-private reports stay inside the same workspace unless explicitly promoted
- global sample/reference reports can be exposed as a platform library when allowed
- retrieval must never leak another tenant's report content into prompts or previews

## Proposed Structure

This is the intended app structure for implementation:

```text
apps/report-platform/
  README.md
  IMPLEMENTATION_PLAN.md
  REPORT_GENERATION_TOPOLOGY.md
  FULL_SYSTEM_DIAGRAM.md
  BACKEND_STORAGE_ARCHITECTURE.md
  AI_QUALITY_AND_LAYOUTMAP.md
  src/
    app/
    routes/
    ingest/
    knowledge-base/
      precedent/
      evaluation/
    generation/
    domain/
    authz/
    review/
    backend/
    report-blocks/
    templates/
    preview/
    pdf/
    fixtures/
    styles/
  tests/
```

## First Milestone

First milestone: produce a working browser preview for an API 653 internal/external vertical tank report matching the `22PE1-4` sample family, using current Android V2 Product export as the imported source and keeping report-only prose/layout concerns on the web side.
