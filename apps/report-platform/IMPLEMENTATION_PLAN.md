# Report Platform Implementation Plan

## Goal

Build the product-standard reporting platform in `apps/report-platform` for converting Android V2 Product exports into browser-based inspection report previews and final PDFs.

The first delivery is a shell-internal report preview aligned to:

- `22PE2-1 TK V10 Shell Internal Inspection Report (Post Blast).pdf`

Supporting topology and orchestration reference:

- `apps/report-platform/REPORT_GENERATION_TOPOLOGY.md`
- `apps/report-platform/BACKEND_STORAGE_ARCHITECTURE.md`
- `apps/report-platform/AI_QUALITY_AND_LAYOUTMAP.md`

## Start Here

`apps/report-platform` is still docs-only.

That means the right first move is not AI generation yet.

The right first move is to create the minimum working product slice:

1. import one real Android export fixture
2. normalize it into a `ReportJob`
3. render one browser preview
4. render one deterministic shell map
5. allow one controlled map edit

If this slice works, the rest of the product has a solid base.

## What To Build First

Build in this order:

### Step 1. Scaffold The Product App

Create the actual app structure under `apps/report-platform/`.

First directories:

```text
apps/report-platform/
  src/
    app/
    domain/
    ingest/
    report-preview/
    report-layout/
    report-calc/
    report-validation/
    fixtures/
  tests/
```

First goal:
- make `apps/report-platform` a runnable web app boundary
- keep it separate from the legacy root `src/`

### Step 2. Lock One Real Fixture

Before building UI, check in one known-good Android V2 Product export fixture.

First fixture should include:

- `inspectionRecord`
- `layoutTargets`
- `layoutConfigs`
- `elements`
- `utMeasurements`
- `findings`
- `attachments`

First goal:
- create a stable local input for repeatable development
- stop guessing the import contract

### Step 3. Define The Normalized Domain Model

Define the first product-owned types:

- `ReportJob`
- `ImportedInspectionFacts`
- `ManualReportInputs`
- `BaselineGeometry`
- `GeometryOverridePatch`
- `EffectiveGeometry`
- `ReportSectionDraft`
- `ApprovedReportSnapshot`

First goal:
- every later feature should depend on normalized domain types, not raw Android JSON

### Step 4. Build The Android Import Adapter

Implement:

- `androidV2ProductAdapter`

It should:

- parse the Android export
- validate required fields
- normalize the export into `ReportJob`
- produce import warnings where needed

First goal:
- one function can take Android export JSON and return a usable in-app domain object

### Step 5. Build One Preview Route

Do not start with the whole report.

Start with one route such as:

- `/report-jobs/:reportJobId/preview`

First preview should show:

- report identity
- general tank information
- one shell layout map block
- one findings summary block

First goal:
- prove import-to-preview works end to end in browser

### Step 6. Build Deterministic Shell Map Rendering

Do not start with editable maps yet.

First implement:

- `BaselineGeometry -> SVG`

For the first pass, support:

- shell course grid
- plate segmentation
- lane labels
- element markers
- finding markers

First goal:
- one shell map renders correctly from Android-exported metadata with no AI involved

### Step 7. Add Controlled Map Editing

After deterministic rendering works, add the first editable map workflow.

First supported edits:

- move element marker
- move label anchor
- toggle overlay visibility

Do not start by allowing plate-count or course-boundary edits.

First goal:
- prove baseline plus patch plus effective geometry composition works safely

### Step 8. Add Draft Content Editing

Add the report-side editing layer for:

- section text
- captions
- recommendations wording

First goal:
- establish that AI drafts are editable working material, not final truth

### Step 9. Add The First Codex Section Job

Only after import, preview, and editing are working should Codex generation be added.

First section to generate:

- `inspection-report`

Codex input should include:

- normalized facts
- grouped findings
- calculated summaries
- retrieved precedent later

First goal:
- one structured section draft enters the editable report workflow

### Step 10. Add Approval Snapshot And PDF

Only after the editing flow is stable:

- freeze an approved report snapshot
- render preview from effective approved state
- export final PDF from the same approved state

First goal:
- final issued output is based on approved snapshot, not raw AI output

## Recommended First Milestone

The first real milestone should be:

`Import one Android export -> show one shell preview page -> allow one marker move -> save one override patch -> re-render preview`

If this works, then:

- import is real
- geometry is real
- editing is real
- auditability is real
- report-platform is no longer just documentation

## What Not To Start With

Do not start with these first:

- vector database
- full knowledge-base retrieval
- multi-section AI generation
- final PDF polish
- complex approval policy engine
- floor and roof editing at the same time

These matter, but they should come after the first shell preview slice.

## First Session Checklist

If you want the best first coding session, do these in order:

1. scaffold `apps/report-platform/src`
2. add one Android export fixture under `src/fixtures/`
3. create `ReportJob` and geometry types
4. implement `androidV2ProductAdapter`
5. create one preview page with mocked route data
6. render one shell map SVG from normalized geometry

That is the highest-leverage place to start.

## What We Learned From The Current Repo

- Android V2 Product is already exporting a structured package for report handoff.
- The current export is app-oriented, not yet the final canonical reporting schema.
- `apps/report-platform` is the product-standard reporting lane.
- Any legacy root-level web app code outside `apps/report-platform` should be treated as reference only.
- `apps/report-platform` is the correct product boundary and is currently clean enough to define properly.

## Current Android Export Contract

Android V2 Product currently exports:

- `packageType`
- `schemaVersion`
- `inspectionReference`
- tenant/workspace/user/profile metadata
- `task`
- `inspectionRecord`
- `validationResults`
- `taskSnapshots`
- `layoutTargets`
- `layoutConfigs`
- `elements`
- `utMeasurements`
- `inspectionChecklistItems`
- `inspectionChecklistSectionNotes`
- `findings`
- `attachments`

These imports already carry the tenant/workspace/user/report-handoff direction needed for the report platform's multi-tenant model.

Important imported fields already visible from code:

- `inspectionRecord`: client, tank number, location, field/lease name, inspector, roof type, reference mode, diameter, height, shell course count, shell lane count
- `layoutConfigs`: roof layout, shell course and lane geometry, floor template data
- `elements`: element type, label, normalized placement
- `utMeasurements`: item label, item kind, course, lane, plate, element, up to five readings
- `checklist`: section key/title, item number/prompt, rating, section notes
- `findings`: linked UT item, item label, item kind, note, attachment count
- `attachments`: file path, media type, display name, annotation counts, file existence

## Canonical Alignment Direction

The canonical schema is the long-term target, but the first report-platform adapter should support the current Android export first.

Recommended ingest strategy:

1. `androidV2ProductAdapter`
   Converts current export JSON into a normalized `ReportJob`.
2. `canonicalInspectionPackageAdapter`
   Converts canonical schema packages into the same `ReportJob`.
3. All preview/PDF code consumes only `ReportJob`, never raw import JSON.

This lets Android keep shipping while the schema is tightened later.

## Generation Topology

The reporting system should combine three inputs:

1. Android export package
2. inspector report-side inputs
3. previous reports as a retrieval-style knowledge base

Codex CLI should not be the system of record for facts.

Codex CLI should act as a drafting worker that receives:
- normalized report facts
- manual inspector inputs
- retrieved precedent snippets or section references
- a section-specific prompt contract

Then it returns draft section output for review and composition into preview/PDF.

Important boundary:

- layout map geometry must be rendered deterministically from app-exported metadata
- Codex CLI may assist with labels, captions, callout wording, and narrative interpretation
- Codex CLI must not invent or reposition map geometry

## Multi-Tenant And Role Alignment

The report platform should align to the same topology and simple role model defined in V2 Product:

- `Super Admin`
- `Manager`
- `Inspector`
- `Reviewer`
- `Client Viewer`

The reporting lane should extend V2 Product with report-side entities such as:

- `ReportJob`
- `ReportSectionDraft`
- `ReportReviewDecision`
- `KnowledgeBaseDocument`
- `KnowledgeBaseAccessPolicy`

Every report-side record should include:

- `tenantId`
- `workspaceId`
- `inspectionId`
- `inspectionReference`
- `createdByUserId`
- `lastEditedByUserId`
- timestamps

Important behavior rules:

- reviewer approval remains optional by default unless tenant policy requires it
- users may hold multiple roles
- knowledge-base retrieval must respect tenant and workspace boundaries
- client viewers should only see approved outputs explicitly assigned to them

## Backend Storage Direction

The report platform needs three storage layers:

1. transactional backend storage
2. object/file storage
3. vector retrieval storage

Recommended product direction:

- transactional store for report jobs, roles, provenance, review state, audit, and metadata
- object storage for Android imports, attachments, source PDFs, generated previews, and final PDFs
- vector database for chunk embeddings of approved knowledge-base documents with strict metadata filtering

For the first product-standard version, `Postgres + pgvector` is a strong default because it keeps:

- tenant/workspace filtering close to the metadata
- provenance and retrieval records in one system
- operational complexity lower than introducing a separate vector service too early

If scale later requires it, the vector layer can be separated, but the logical model should stay the same.

## Normalized Report Job Model

The report platform should normalize all imports into three buckets.

### Imported From App

- inspection identity and audit metadata
- client, tank, site, inspector, date/time, roof/shell/floor scope
- approved layout geometry
- placed elements and nozzle/manhole positions
- UT readings and linked finding references
- checklist results and notes
- attachment inventory
- export validation status
- tenant/workspace/user linkage

### Manual Report-Side Inputs

- report number and revision
- customer contact person
- prepared by / reviewed by
- report scope prose
- inspection narrative paragraphs
- recommendation narrative
- API assessment commentary
- photo captions/order overrides
- section inclusion/exclusion decisions
- attachment cover text
- optional calculation assumptions not present in app export
- reviewer comments and approval notes

### Derived / Calculated Presentation Data

- page ordering and table of contents
- grouped findings by target/course/lane/plate
- summarized UT tables
- minimum/mean/max reading summaries
- photo-page batching
- findings-map legends and page labels
- checklist section rollups
- appendix presence rules
- print page breaks and repeated headers/footers
- deterministic layout-map render artifacts

## First Report Scope

The first working preview should be intentionally narrow:

- report family: shell internal inspection / post-blast
- sample target: `22PE2-1`
- preview output first, PDF after preview stabilizes
- reusable page blocks from day one

The first preview does not need to solve every fullscope report variant.

## Stable Report Spine From Sample Reports

Across the sample folder, the reusable report spine is:

1. cover/title page
2. report metadata + disclaimer + signatures/revision block
3. table of contents
4. scope of inspection
5. optional inspection and maintenance regime
6. general tank information
7. inspection report narrative
8. repair recommendations / API 653 assessment
9. photographs
10. technical appendices as needed

Common appendices across the wider sample set:

- tank inspection checklist
- minimum shell thickness calculations
- roof/floor/shell layout pages
- nozzle and reinforcement pad thickness tables
- shell plate thickness measurements
- settlement survey pages
- crawler inspection pages
- MFL report pages
- MPI report pages
- attachment photograph packs

## Section Mapping For The First Shell-Internal Preview

### Section 1: Cover / Report Identity

Source:
- imported: client, tank number, location, inspection reference, dates
- manual: report number, title wording, subtitle wording

Block:
- `ReportCoverPage`

### Section 2: Report Metadata / Disclaimer / Sign-off

Source:
- imported: client, tank number, inspector, completed/exported date
- manual: contact person, company address, prepared by, reviewed by, revision log

Block:
- `ReportMetaPage`

### Section 3: Table Of Contents

Source:
- derived from enabled sections and page numbering

Block:
- `TableOfContentsPage`

### Section 4: Scope Of Inspection

Source:
- mostly manual template prose
- imported data only determines which scope template variant is used

Block:
- `NarrativeSectionPage`

### Section 5: Inspection And Maintenance Regime

Source:
- optional manual/template content
- likely reusable standard text block by report family

Block:
- `NarrativeSectionPage`

### Section 6: General Tank Information

Source:
- mostly imported from `inspectionRecord`
- manual supplements for fields the app does not yet export

Block:
- `GeneralTankInformationPage`

### Section 7: Inspection Report

Source:
- imported: findings, UT readings, layout targets/configs, element positions, attachments
- manual: narrative paragraphs and engineering commentary
- derived: grouped tables by strake/course/lane/plate

Blocks:
- `InspectionNarrativePage`
- `FindingSummaryTablePage`
- `DeterministicLayoutMapPage`

### Section 8: Recommendations / API Assessment

Source:
- manual primary content
- imported findings and UT data support the evidence
- derived grouping by area/type/severity

Block:
- `RecommendationsPage`

### Section 9: Photographs

Source:
- imported attachments
- manual/derived caption ordering

Block:
- `PhotoGalleryPage`

### Section 10+: Findings Map Pages

Source:
- imported layout configs, elements, findings, linked UT items
- derived page grouping by strake/weld/surface
- manual only for optional page labels or callout overrides

Block:
- `ShellFindingsMapPage`

### Attachment Pages

Source:
- imported attachment inventory today
- manual or secondary structured import for full MPI/MFL sheet rendering

First milestone recommendation:
- show attachment section placeholders/index in preview
- defer full embedded MPI worksheet reproduction until core preview is stable

## Reusable Page Blocks To Build First

Build these as reusable components instead of report-specific pages:

- `ReportHeader`
- `ReportFooter`
- `ReportCoverPage`
- `ReportMetaPage`
- `TableOfContentsPage`
- `NarrativeSectionPage`
- `GeneralTankInformationPage`
- `FindingSummaryTablePage`
- `RecommendationsPage`
- `PhotoGalleryPage`
- `ShellFindingsMapPage`
- `AttachmentIndexPage`

## Product-Standard App Structure

Recommended implementation layout:

```text
apps/report-platform/
  src/
    app/
      App.tsx
      router.tsx
    routes/
      import-preview/
      report-preview/
      report-admin/
    ingest/
      android-v2-product/
        parseAndroidV2ProductExport.ts
        mapAndroidV2ProductToReportJob.ts
      canonical/
        parseCanonicalInspectionPackage.ts
        mapCanonicalPackageToReportJob.ts
    authz/
      authorization-context/
      role-policies/
    backend/
      api/
      persistence/
      jobs/
    knowledge-base/
      report-corpus/
      retrieval/
      section-patterns/
    generation/
      codex-cli/
      prompts/
      section-jobs/
    domain/
      report-job/
      report-review/
      report-authz/
      report-sections/
      report-attachments/
    report-blocks/
      chrome/
      layout-maps/
      narrative/
      tables/
      photos/
      maps/
    templates/
      shell-internal-post-blast/
    preview/
      buildPreviewDocument.ts
      pagination/
    pdf/
      buildPdf.ts
    fixtures/
      android-v2-product/
      canonical/
    styles/
      report.css
      print.css
  tests/
```

## First Implementation Sequence

### Phase 1: Establish The Product App Boundary

- Keep all new report-platform product code under `apps/report-platform`
- Treat legacy root-level web app code outside `apps/report-platform` as reference only
- Copy only ideas, not code blindly
- Carry forward tenant/workspace/user identity from day one

### Phase 2: Ingest And Normalize

- add a fixture for a current Android V2 Product export JSON
- implement `parseAndroidV2ProductExport`
- map import JSON into `ReportJob`
- add validation errors that clearly separate missing import data from missing manual report inputs

### Phase 2A: Inspector Inputs And Knowledge Base

- define a `ManualReportInputs` model for inspector-entered report data
- define a `KnowledgeBaseMatch` model for retrieved previous-report precedents
- store provenance so generated sections can tell us what came from app export, manual inputs, or precedent retrieval
- define retrieval scoping rules for platform-shared, tenant-shared, and workspace-shared report corpora
- define chunking/indexing rules for vector retrieval

### Phase 2A.3: Deterministic Layout Map Model

- define canonical geometry model derived from Android export metadata
- define surface-specific renderers for shell, roof, and floor maps
- ensure map rendering is deterministic and independent of Codex prose generation

### Phase 2A.1: Authorization And Role Policies

- define `AuthorizationContext`
- define role policies aligned to V2 Product roles
- enforce tenant/workspace visibility on report jobs, section drafts, reviews, and knowledge-base retrieval

### Phase 2A.2: Backend Storage Foundation

- define relational persistence models for report jobs, section drafts, review state, and knowledge-base documents
- define object storage layout for imports, attachments, and outputs
- define vector index metadata schema for chunk retrieval

### Phase 2B: Codex CLI Section Generation Contract

- define a section job payload per report section
- include facts, manual inputs, precedent references, tone/rules, and output schema
- include tenant/workspace/actor authorization context
- keep one section per Codex CLI run so review and retry stay controlled
- include knowledge-base chunk ids and provenance references from the vector retrieval layer

### Phase 3: Browser Preview Shell

- render a shell-internal report with static/manual report-side text plus imported tank data
- wire general tank information page from import
- render grouped findings summary
- render first photo gallery page
- render first shell findings map pages from normalized geometry
- render generation provenance so reviewers know which sections are manual, imported, or AI-drafted
- render review status and tenant/workspace ownership metadata where appropriate
- render layout maps from deterministic SVG/page-block output, not freeform AI drawing

### Phase 4: Print-Ready Styling

- add A4 print CSS
- lock repeated header/footer style
- test pagination in browser print preview
- only then add programmatic PDF generation

### Phase 5: Technical Appendices

- checklist appendix
- minimum shell thickness calculations
- nozzle and pad thickness tables
- additional attachment families like MPI/MFL sheets

### Phase 6: Codex CLI Orchestration

- add a report orchestrator that plans required sections
- run Codex CLI section-by-section
- save draft outputs and review status per section
- allow rerun of only the sections that changed after inspector edits
- ensure orchestration and retrieval run within actor authorization scope
- persist generation inputs/outputs for audit and replay
- keep map rendering as a separate prevalidated artifact that section jobs can reference but not alter

## Concrete Deliverable For The First Working Preview

The first working preview is successful when we can:

1. import a current Android V2 Product export JSON
2. normalize it into a `ReportJob`
3. render a browser preview with:
   - cover
   - metadata page
   - table of contents
   - scope page
   - general tank information
   - inspection report narrative shell
   - findings summary table
   - recommendations page
   - photo pages
   - shell findings map pages
4. print the preview cleanly to PDF from the browser

## Known Gaps Between Current Android Export And Final Report Needs

These are report-platform responsibilities for now:

- narrative prose is not in the Android export
- recommendation wording is not in the Android export
- revision/signature/report-number administration is not in the Android export
- corrosion-rate calculation worksheets are not yet derivable from current export alone
- photo ordering/caption quality needs report-side review
- attachment sheet reproduction needs either richer structured import or attachment-specific adapters

## Codex CLI Operating Rules

- App export plus inspector inputs are the factual source of truth.
- Previous reports are style and precedent references, not authoritative facts for the current tank.
- Codex CLI may draft section prose and organization, but it should not invent measurements, dates, parties, or recommendations unsupported by inputs.
- Section generation should be isolated so reviewers can accept, reject, or rerun one section without destabilizing the whole report.
- Retrieval and generation must respect tenant/workspace isolation and role permissions.
- Layout map geometry comes from deterministic rendering of imported metadata, not from Codex-generated drawing logic.

## Recommended Next Build Task

Start implementation with:

1. product app scaffold under `apps/report-platform/src`
2. fixture import for one Android V2 Product export package
3. `ReportJob`, `ManualReportInputs`, and `AuthorizationContext` type definitions
4. role policy definitions aligned with V2 Product
5. backend storage model for relational/object/vector layers
6. `shell-internal-post-blast` template
7. knowledge-base indexing plan for previous reports with access scoping
8. section job contract for Codex CLI
9. browser preview route that renders the first report spine

That gives the team a real preview target quickly without overcommitting to every appendix upfront.
