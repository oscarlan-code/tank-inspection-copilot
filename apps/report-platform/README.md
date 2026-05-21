# Report Platform

This folder is the real product lane for the **connected reporting platform**.

## Product role

- ingest canonical inspection packages
- validate package completeness and schema
- generate report previews and drafts
- keep inspection history online

## Platform responsibilities

1. package upload
2. package validation
3. report section mapping
4. report preview / draft generation
5. archive and search

## Inputs

The platform accepts the canonical package defined in:

- `packages/canonical-schema/inspection-package.schema.json`

## First prototype scope

- upload one package
- validate against schema
- render:
  - tank summary
  - shell UT table
  - roof UT table
  - findings register
  - linked evidence list

## Build rule

The platform should consume a stable package contract, not browser-local prototype state.

## Current planning status

This lane now has pre-implementation planning documents under `requirements/`:

- `CANONICAL_INPUT_REQUIREMENTS.md`
- `REPORT_GENERATION_PLAN.md`
- `REPORT_SECTION_MAPPING.md`
- `CALCULATION_REQUIREMENTS.md`
- `CANONICAL_GAP_ANALYSIS.md`
- `TECHNICAL_ARCHITECTURE.md`
- `UX_WORKSPACE_PRINCIPLES.md`
- `LAYOUT_RENDERING_STRATEGY.md`
- `MULTI_TENANT_TOPOLOGY.md`

These docs define how the web report generator should:

- ingest the Android canonical package
- collect inspector-entered checklist and narrative inputs
- run deterministic engineering calculations
- use LLM drafting only for narrative consolidation
- assemble a report preview/export aligned to the IRS sample report structure

## Product boundary

The Android app remains the field data-capture lane.

The report platform owns:

1. package upload and validation
2. inspector-side completion forms
3. deterministic calculations
4. section-by-section draft generation
5. HTML/PDF report rendering
6. archive, review, and later search/history

It should not depend on Android UI state or app-local draft internals.

## Current scaffold location

The first interactive web shell for this lane is currently mounted from the repo's root React/Vite app under:

- `src/reportPlatform/`

This includes the first pass of:

- VS Code-style workspace shell
- left report/package explorer
- center section workspace with preview, checklist, and layout modes
- right AI interaction rail
- shell/roof 2D layout placeholder renderer

The planning and product requirements remain under:

- `apps/report-platform/`

## Current implementation status

The report platform is now beyond planning and into early implementation.

Implemented now:

- canonical package upload, parse, validate, and workspace hydration
- VS Code-style section workspace shell
- section-plan checklist before editing
- section-by-section editing workflow
- shell and roof layout rendering workspaces
- per-section Codex skill and prompt profiles
- dev-only Codex worker wiring behind the UI
- separate reviewer loops for:
  - one-off section refine
  - thumbs up / thumbs down quality feedback
  - durable section-logic improvement

Current important behavior:

- Codex works on one active section at a time only
- selecting a section does **not** start generation
- `Generate Draft` is the first generation trigger
- `Refine Draft` changes only the current draft
- `Thumbs Up` / `Thumbs Down` store future quality memory
- `Improve Logic` stores durable section-generation rules separately from thumbs memory

## Current limitations

- the Codex worker is still dev-only and mounted through the Vite dev server
- real `codex exec` calls can still time out in this local environment
- when Codex times out, the UI falls back to local draft builders instead of hanging
- the editor is still a plain text-area editor, not a full rich report editor yet
- sample-report alignment is strongest for the early core sections and still needs section-by-section hardening across the full template

## Current focus

The current focus is:

1. tighten section-by-section prompt logic against the real sample report
2. improve Codex runtime reliability
3. keep the feedback loops separate and governed correctly
4. preserve the exact sample-report structure while improving draft quality

## Next pickup

Recommended next steps for the next session:

1. continue reviewing generated output section by section against the real report
2. improve the Codex worker reliability so fallback is used less often
3. replace the plain text box with a richer report editor / preview pair
4. persist workspace edits and section state beyond the in-memory dev shell
