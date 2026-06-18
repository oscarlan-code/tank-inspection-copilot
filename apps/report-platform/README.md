# Report Platform

`apps/report-platform` is the product-standard web reporting lane for Tank Inspection Copilot.

Its job is to take durable field capture output from Android V2 Product, combine it with report-side inputs, and generate browser previews plus final DOCX/PDF reports that match the IRS/Pacific Energy report style.

This is product-standard report infrastructure, not a prototype lane.

## Current Version

Current product status: `V1 Beta`.

V1 Beta means the report platform has moved beyond prototype exploration and now has a working product-standard baseline for the V10 API 653 internal/external report-generation workflow.

The current V1 Beta baseline includes:

- browser-based report authoring workspace with left section navigation, middle report workspace, and right LAIQ AI Engine assistant
- V10 app-export fixture loading through the report-platform API
- section-by-section generation workflow with selectable generation queue
- section status tracking with not-started, editing, and approved states
- approved-section-only DOCX export flow
- deterministic UT table generation for app-sourced measurement sections
- deterministic roof, shell, and floor layout-map rendering from app layout metadata
- DOCX-safe layout-map figure rendering for approved export
- sample-report-oriented formatting controls for headings, paragraphs, bullets, tables, and map sections
- precedent KB and standards KB indexing baseline
- generation logic audit script for measurement, map, and chat-guard regressions
- agentic system design for orchestration, vertical section agents, tool agents, and QA/eval agents

V1 Beta is not the final production platform yet. It is the first stable product baseline for training, testing, section-by-section evaluation, and workflow refinement.

## V1 Beta Feature Inventory

### App Export And Job Loading

V1 Beta can load the V10 inspection export fixture as the source inspection package for report generation.

Current loading behavior:

- the page starts without running AI generation automatically
- the user explicitly loads the mock app-export data
- imported field evidence is treated as baseline evidence, not as final report wording
- raw imported data is converted into section-readable context blocks
- the same fixture is available through the local API bootstrap route and a shared public JSON copy

Current import data coverage:

- tenant, workspace, user, task, and inspection metadata
- validation results and export-readiness state
- roof, shell, and floor layout configuration
- placed elements and layout anchors
- roof, shell, and floor UT measurements
- checklist rows and checklist section notes
- mock voice-to-text narrative transcripts
- findings, finding notes, and attachment inventory

### Section Generation Workflow

V1 Beta uses a section-by-section workflow instead of generating one uncontrolled full report.

Current section workflow:

- report sections follow the active V10 API-standard table-of-contents spine
- the user can choose which sections to generate
- generation status moves from not started to editing
- approved sections are locked as approved output unless intentionally regenerated
- each section keeps its own generation input, generated output, missing-field state, and approval state
- app-sourced measurement sections use deterministic table compilation from exported UT rows
- narrative sections use the LAIQ AI Engine drafting path with app facts, voice narrative, precedent hints, and missing-field rules
- map sections use deterministic layout rendering from imported layout metadata

### Middle Workspace Authoring

The middle workspace is the main report-authoring area.

Current middle-pane behavior:

- selected section title and status are shown at the top of the workspace
- readable app data input can be edited and saved
- raw/evidence context can be collapsed to save screen space
- generated report content is editable through the rich-text editor
- approval controls stay close to the generated output
- layout-map sections show roof, shell, and floor tabs
- layout maps render larger in the middle workspace so the user can inspect markers and evidence
- map evidence is shown as location information, measurements, and findings where applicable

### Layout Map Workflow

V1 Beta treats layout maps as deterministic report artifacts, not AI drawings.

Current layout-map behavior:

- roof, shell, and floor maps are rendered from app layout configuration
- shell maps preserve course, lane, compass, plate, element, and finding relationships from the app export
- roof and floor maps preserve exported plate/element/finding anchors
- the UI lets the user switch between roof, shell, and floor surfaces
- clicking map markers can reveal linked location, measurement, or finding evidence
- map figures can be rendered as DOCX-safe artifacts for final export
- geometry remains anchored to the app baseline until controlled override editing is implemented

### LAIQ AI Engine

In V1 Beta, the LAIQ AI Engine is both a generation engine and a section-aware assistant.

Current AI behavior:

- AI does not run on page load
- AI runs when the user clicks `Generate Sections` or sends a chat instruction
- AI chat is scoped to the selected section by default
- the assistant can explain missing fields in plain language
- the assistant can refine wording and apply safe formatting actions
- the assistant can build real measurement tables from exported UT rows when the user asks for table formatting
- the assistant is guarded from inventing missing measurements
- for map questions, the assistant explains that numeric readings come from exported UT rows while maps provide location evidence

Important current rule:

- app-structured facts, tables, calculations, and map geometry should come from deterministic tools
- AI can draft, explain, format, and orchestrate, but should not be the source of inspection truth

### Missing-Content Assistance

V1 Beta includes a section-aware missing-content panel.

Current missing-content behavior:

- missing fields are shown for the selected section
- report-side fields can be filled from the right panel
- approval is blocked when required missing fields remain empty
- the assistant can explain why a field is needed
- app-sourced measurement sections should not ask for duplicate source data when the app export already contains the measurements

### Approval And Export

V1 Beta uses human approval as the gate before final report export.

Current approval/export behavior:

- sections can be approved one by one
- approval is blocked if required report-side inputs are still missing
- `Generate Final DOCX` opens an export-selection flow
- only approved sections are available for final DOCX export
- the user chooses which approved sections to include
- DOCX output uses report-oriented heading styles, normal margins, narrative line spacing, bullets, tables, and layout-map figures
- PDF remains a later output target after DOCX stabilizes

### Knowledge Base And Evaluation Baseline

V1 Beta has the baseline for KB-assisted generation and future training/evaluation.

Current KB/eval baseline:

- sample reports under `/Users/oscar/Public/irs/Sample Reports/` are treated as precedent sources
- code/standard files under `/Users/oscar/Public/irs/Codes/` are treated as standards guidance
- precedent retrieval is intended to provide section style, format, and pattern guidance
- standards retrieval is intended to provide controlled technical guidance, not copied report text
- generation audit checks deterministic measurement, map, and chat-guard logic
- agentic-system design defines future section agents, tool agents, and QA/eval agents

### Backend And API Baseline

V1 Beta includes a lightweight local backend for report-platform testing.

Current backend capabilities:

- local API server through `npm run api`
- health endpoint with report job and KB status
- seeded V10 API-standard report job
- app-export fixture endpoint for the V10 mock package
- import endpoint for app-export-style JSON packages
- report job load endpoint
- manual input save endpoint
- section draft save endpoint
- section generation endpoint
- section chat endpoint
- layout override save endpoint
- section approval endpoint
- final DOCX export endpoint
- eval run lookup endpoints
- precedent KB status, rebuild, search, and audit endpoints

Current developer scripts:

- `npm run dev`: run the Vite development UI
- `npm run api`: run the local report-platform API
- `npm run build`: TypeScript check and production UI build
- `npm run preview`: preview the production UI build
- `npm run kb:rebuild`: rebuild precedent KB index
- `npm run kb:audit`: audit precedent KB coverage
- `npm run logic:audit`: check generation, measurement, map, and chat-guard logic

### Tech Stack In V1 Beta

Current implementation stack:

- React and TypeScript for the browser workspace
- Vite for development and production preview
- TipTap for rich-text section editing
- React/Konva and SVG rendering for visual layout work
- Node.js local API server for V1 Beta backend flow
- SQLite-backed local report store for current report jobs and state
- `docx` for DOCX export generation
- `@resvg/resvg-js` for DOCX-safe map figure rendering
- file-system based sample report and standards corpus for KB indexing

## V1 Beta UI/UX

The V1 Beta workspace is designed like a simple technical authoring IDE.

```text
Left section navigator | Middle authoring workspace | Right LAIQ AI Engine
```

### Top Bar

The top bar is intentionally concise.

It shows:

- product identity
- report reference
- client
- tank
- `Generate Sections`
- `Generate Final DOCX`

The top bar should remain sticky and should not become a dashboard full of secondary metadata.

### Left Sidebar

The left sidebar is the report table of contents and generation progress view.

Current behavior:

- sections follow the active API-standard V10 report spine
- each section has a visible status dot
- black means not started
- yellow means editing
- green means approved
- section counts summarize the report state
- selecting a section updates the middle workspace and right AI panel

### Middle Pane

The middle pane is where the report is actually built.

Current flow:

1. review or edit the section-specific app/voice/guideline input
2. inspect the relevant layout map when applicable
3. review and edit generated report content
4. approve the section when ready

The UI intentionally separates evidence from final report wording:

- readable app data is source context
- layout map is visual evidence
- generated report content is the editable publication draft
- approved output is the only content eligible for final DOCX export

### Right Sidebar

The right sidebar combines the AI command surface and missing-content helper.

Current behavior:

- the assistant is section-aware
- the user can ask questions about missing fields, formatting, measurements, maps, or approval readiness
- missing fields are shown directly beside the chat context
- the assistant can return actions that update the selected section draft
- the right panel is intended to work like a practical helpdesk and controller, not just a chatbot

### Scroll And Layout Principles

V1 Beta follows these UI principles:

- top bar remains compact
- left, middle, and right panes each manage their own scrolling
- middle-pane cards should be large enough to avoid excessive nested scrolling
- layout maps should receive wide visual space
- right-panel controls should keep the send action reachable
- unnecessary internal labels should be removed when they do not help the inspector

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
- DOCX export
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
- Contains: tenant/workspace/user metadata, layout targets/configs, 23 elements, 141 UT rows, 195 checklist items, 13 checklist section notes, 11 mock voice narrative transcripts, 15 findings, and 25 attachments.
- UT split: 68 external roof rows, 38 shell rows, and 35 floor rows.

Shared public copy for review/testing:
- `/Users/oscar/Public/irs/mockup sample data/v10-laiq-inspection-app-export.json`

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
9. DOCX output first
10. PDF output second

Product development workflow:
- `apps/report-platform/PRODUCT_DEVELOPMENT_PLAN.md`

Topology and orchestration:
- `apps/report-platform/REPORT_COMPILER_WORKFLOW.md`
- `apps/report-platform/REPORT_GENERATION_TOPOLOGY.md`
- `apps/report-platform/FULL_SYSTEM_DIAGRAM.md`
- `apps/report-platform/AI_ENGINE_SYSTEM_DIAGRAM.md`
- `apps/report-platform/CODEX_ROLES_AND_TOOLING.md`
- `apps/report-platform/AGENTIC_SYSTEM_DESIGN.md`
- `apps/report-platform/REPORT_GENERATION_AND_LAYOUTMAP_ORCHESTRATION.md`
- `apps/report-platform/PRECEDENT_KB_ARCHITECTURE.md`
- `apps/report-platform/EVAL_SYSTEM.md`

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

## V1 Beta Milestone

V1 Beta milestone: produce a working browser preview and DOCX export path for an API 653 internal/external vertical tank report matching the `22PE1-4` sample family, using current Android V2 Product export as the imported source and keeping report-only prose/layout concerns on the web side.

This milestone is now the active baseline for training and testing.

Next development focus:

- implement the formal agent registry and section-agent contracts
- build evidence packs for every section
- expand the eval harness using sample-report gold sections
- refine voice-transcript-to-report generation
- strengthen KB retrieval by section type, report family, and standard basis
- continue improving DOCX formatting against the sample report
- add production-grade backend storage, authz, and multi-tenant role enforcement behind the approved V1 Beta workflow
