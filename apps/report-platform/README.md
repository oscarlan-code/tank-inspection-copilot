# Report Platform

`apps/report-platform` is the product-standard web reporting lane for Tank Inspection Copilot.

It imports durable field capture output from the LAIQ inspection app V3 Product lane, combines it with report-side inputs and approved knowledge-base guidance, then produces browser previews and final DOCX/PDF-ready report outputs.

This is product-standard report infrastructure, not a prototype lane.

## Current Status

Current product status: `V1 Beta`.

V1 Beta is the first stable product baseline for the V10 API 653 internal/external vertical tank report workflow. It is ready for training, section-by-section evaluation, UI review, and backend hardening, but it is not the final production platform.

Core V1 Beta capabilities:

- V10 LAIQ inspection app V3 export loading through the report-platform API.
- Browser authoring workspace with table-of-contents navigation, report workspace, and right-side LAIQ AI Engine assistant.
- Section-by-section generation with a selectable generation queue.
- Section status tracking: not started, editing, approved.
- Human approval gate before final report export.
- Approved-section-only DOCX export flow.
- Deterministic UT measurement table generation from exported app rows.
- Deterministic checklist table generation from exported app checklist rows.
- Deterministic roof, shell, and floor layout-map rendering from app layout metadata.
- DOCX-safe layout-map figure rendering for approved export.
- V3 `voiceNotes[]` context routing by workflow screen, card, target, item, and transcript status.
- Rich-text editing for generated report drafts.
- Backend draft-version history and restore support for assistant-applied edits.
- Controlled generated-content transform layer for exact text edits, scoped style edits, checklist marker changes, table formatting, and structured AI-planned draft updates.
- Precedent KB, standards KB, and fact-to-recommendation KB baselines.
- Strict sample-report leak audit, generation logic audit, API hardening audit, and report performance eval script.

The report compiler pipeline is:

```text
LAIQ app export
  -> import adapter
  -> normalized report job
  -> evidence packs
  -> deterministic tools / constrained AI workers
  -> generated section drafts
  -> human review and approval
  -> DOCX/PDF export
```

## Product Boundary

The LAIQ inspection app V3 Product lane owns:

- durable field capture
- local-first task storage
- task recovery and export readiness
- structured export packages
- layout-map metadata, elements, findings, UT rows, checklist rows, attachments, and voice note metadata

`apps/report-platform` owns:

- import and normalization of exported inspection packages
- report job management
- section generation and review workflow
- report-only narrative inputs
- report layout, formatting, page blocks, and DOCX/PDF assembly
- photo ordering and captions
- recommendations formatting
- calculation worksheets and technical appendices
- knowledge-base retrieval and evaluation
- final report export

Do not force full report presentation requirements back into the field app.

## Trusted Inputs

Primary import source:

- LAIQ inspection app V3 export package
- `packageType: "v3_product_export"`
- `schemaVersion: 3`

Current V10 fixture:

- `apps/report-platform/src/fixtures/v3-product-export-shell-internal.json`
- shared public copy: `/Users/oscar/Public/irs/mockup sample data/v10-laiq-inspection-app-export.json`

Fixture coverage:

- tenant, workspace, user, task, and inspection metadata
- validation and export-readiness state
- roof, shell, and floor layout configuration
- placed elements and layout anchors
- roof, shell, and floor UT measurements
- checklist rows and checklist section notes
- V3 voice note metadata, prepared mock transcripts, and voice-audio attachment references
- findings, finding notes, and attachment inventory

Important reference material:

- primary report precedent: `/Users/oscar/Public/irs/Sample Reports/22PE1-4 TK V10 Internal & External Inspection Report.pdf`
- sample report corpus: `/Users/oscar/Public/irs/Sample Reports/`
- standards/code corpus: `/Users/oscar/Public/irs/Codes/`
- checklist/fieldsheet reference: `/Users/oscar/Public/irs/Sample Reports/Pacific Energy Fieldsheet (Fullscope).pdf`

Safety rules:

- current report facts must come from the LAIQ app export or report-side user confirmation
- historical reports may guide format, structure, and approved recommendation patterns
- standards/code references may guide technical checks, but must not be copied verbatim into report text
- exact current gold-report text is excluded from generation retrieval
- sample-report identifiers must not leak into generated drafts, fixtures, or final report output

## UI/UX Model

The workspace is intentionally simple:

```text
Left report sections | Middle report workspace | Right LAIQ AI Engine
```

Left sidebar:

- follows the active API-standard table-of-contents spine
- shows one status dot per section
- black means not started
- yellow means editing
- green means approved

Middle workspace:

- Step 1: section-specific app/voice/guideline evidence input
- Step 2: layout map or visual evidence when applicable
- Step 3: generated report content editor and approval control

Right sidebar:

- section-aware LAIQ AI Engine assistant
- missing-content helper
- formatting and refinement commands
- visible control trace for assistant-applied actions
- Apply/Cancel confirmation for planned non-trivial edits

Key UI principles:

- no AI generation on page load
- left, middle, and right panes scroll independently
- generated content is separate from raw evidence
- layout maps get wide visual space
- approval controls stay close to generated output
- only approved sections can enter final export selection

## LAIQ AI Engine Control Model

The LAIQ AI Engine is both a generation orchestrator and a report-edit assistant.

The product rule is:

```text
If the assistant says it changed generated output, it must return a controlled action.
```

Current controlled action paths:

- exact text replacement
- whole-section style changes
- table-scoped style changes
- checklist marker changes
- deterministic checklist table formatting
- deterministic measurement table formatting
- measurement evidence lookup
- structured AI-planned edit with user confirmation
- backend draft restore after applied edits

Every assistant control response can include:

- interpreted intent
- planner path
- risk level
- target section
- operation
- guardrails
- validation summary
- confirmation requirement
- undo snapshot status

For table-only requests, actions must be scoped to table cells rather than the full section. For example, "change font color of the table contents to red" becomes `apply_text_style(table)`.

## Knowledge Base And Evaluation

KB layers:

- precedent KB: section shape, wording pattern, report style, and formatting precedent
- standards KB: controlled technical guidance from codes/standards
- fact-to-recommendation KB: structured historical condition-to-recommendation pairs

Generated local indexes live under `apps/report-platform/.data/`, which is intentionally gitignored and rebuilt from the local corpus.

Eval and safety gates:

- generation logic audit checks deterministic measurement, map, checklist, chat-guard, and content-control behavior
- leak audit blocks restricted sample-report identifiers
- API hardening audit checks negative paths and export readiness
- report performance eval generates section-by-section scorecards against the reference workflow

## Backend/API Baseline

V1 Beta uses a local Node API and SQLite-backed local report store.

Current API responsibilities:

- bootstrap seeded V10 report jobs
- import app-export-style JSON packages
- load report jobs
- save manual inputs
- save section drafts
- restore previous section draft versions
- generate sections
- run section chat/control actions
- save layout overrides
- approve sections
- export selected approved sections to DOCX
- rebuild/search/audit KB indexes
- run eval and safety audits

## Development Commands

```bash
npm --prefix apps/report-platform run dev
npm --prefix apps/report-platform run api
npm --prefix apps/report-platform run build
npm --prefix apps/report-platform run preview
```

KB and audit commands:

```bash
npm --prefix apps/report-platform run kb:rebuild
npm --prefix apps/report-platform run kb:audit
npm --prefix apps/report-platform run recommendation-kb:rebuild
npm --prefix apps/report-platform run recommendation-kb:audit
npm --prefix apps/report-platform run logic:audit
STRICT_SAMPLE_LEAK=1 npm --prefix apps/report-platform run leak:audit
npm --prefix apps/report-platform run api:audit
npm --prefix apps/report-platform run report:eval
```

Recommended validation before handoff:

```bash
npm --prefix apps/report-platform run build
npm --prefix apps/report-platform run logic:audit
STRICT_SAMPLE_LEAK=1 npm --prefix apps/report-platform run leak:audit
npm --prefix apps/report-platform run api:audit
```

## Current Product Files

Core implementation:

- `server/generation.mjs`
- `server/store.mjs`
- `server/docx-export.mjs`
- `server/layout-map-figure.mjs`
- `server/report-blocks.mjs`
- `server/precedent-kb.mjs`
- `server/fact-recommendation-kb.mjs`
- `src/app/App.tsx`
- `src/components/RichTextSectionEditor.tsx`
- `src/components/LayoutMapEditor.tsx`
- `src/domain/mockReport.ts`
- `src/domain/types.ts`
- `src/lib/layoutMapGeometry.ts`
- `src/lib/reportApi.ts`
- `src/lib/reportContent.ts`

Design and planning docs:

- `AGENTIC_SYSTEM_DESIGN.md`
- `GENERATED_CONTENT_CONTROL_SYSTEM.md`
- `FACT_RECOMMENDATION_KB.md`
- `PRECEDENT_KB_ARCHITECTURE.md`
- `EVAL_SYSTEM.md`
- `BACKEND_STORAGE_ARCHITECTURE.md`
- `REPORT_GENERATION_AND_LAYOUTMAP_ORCHESTRATION.md`
- `PRODUCT_DEVELOPMENT_PLAN.md`

## Next Development Focus

- formalize the report-block AST so edits target stable block models instead of reconstructed HTML
- expand scoped edit tools for table columns, paragraph blocks, heading classes, figure placement, and DOCX style maps
- implement server-side voice transcription for `voiceNotes[]` with evidence routing
- strengthen evidence packs with stable evidence IDs and provenance labels
- improve recommendation generation using reviewed fact-to-recommendation pairs
- add production-grade tenant isolation, authz, sandboxing, and run observability
- continue improving DOCX formatting against the report family without overfitting to one sample report
