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
