# Report Generation Plan

## Goal

Build a web-based report generation platform that:

1. ingests the canonical package exported from the Android field app
2. collects inspector-side checklist and report metadata
3. runs deterministic engineering calculations
4. uses an LLM to draft narrative report sections
5. renders a reviewable report preview and export

## Planning references

This plan is based on:

- the Android canonical export lane
- the current canonical schema in `packages/canonical-schema`
- IRS sample report structure, especially the `16TJS4 -1 TK 465 Internal & External Inspection Report`
- internal reference standards library including API 653 and API 575

## Core architecture

The web report system should be split into five lanes.

### 1. Ingest and validation lane

Responsibilities:

- upload package ZIP or JSON
- unpack and validate schema
- index attachments
- normalize package data into a report workspace model
- surface missing or inconsistent inputs early

This lane should be deterministic.

### 2. Inspector completion lane

Responsibilities:

- collect checklist answers
- collect report-control metadata
- capture narrative notes and overrides
- capture calculation prerequisite fields not present in the app

This lane closes the gap between field capture and final reporting.

### 3. Deterministic calculation lane

Responsibilities:

- minimum shell thickness calculations
- corrosion rate calculations
- remaining life calculations
- interval suggestion logic
- later settlement-derived metrics

This lane should be rule-based and testable. The LLM must not be the source of truth for these outputs.

### 4. Standards retrieval and traceability lane

Responsibilities:

- bind calculations and checklist items to internal standards references
- provide short internal rule summaries for drafting
- keep section-level citation traceability

The system should paraphrase internal standards support, not reproduce long standards text in the output.

### 5. LLM drafting lane

Responsibilities:

- write narrative section drafts
- consolidate findings and evidence
- turn structured results into readable inspection prose
- flag contradictions and missing evidence

The LLM should draft and summarize, not decide formulas or invent data.

## Suggested generation flow

1. Upload canonical package
2. Validate and normalize
3. Open report workspace
4. Complete checklist and missing metadata
5. Run deterministic calculations
6. Generate section drafts
7. Review and edit
8. Export report preview / PDF

## Recommended v1 scope

Deliver the smallest end-to-end path that proves the architecture:

### Included in v1

- upload one canonical package
- schema validation
- tank summary
- shell UT table
- roof UT table
- nozzle UT tables
- findings register
- linked evidence list
- checklist entry form
- minimum shell thickness calculation section
- narrative draft sections
- HTML preview
- PDF export

### Deferred from v1

- rich archive/search
- multi-user review workflow
- true floor/MFL analytics
- advanced settlement analytics
- full recommendation engine
- final polished template editor

## LLM operating rules

The LLM may:

- draft prose
- summarize measurements and findings
- explain engineering outputs already computed by the system
- adapt wording to the report template

The LLM must not:

- invent readings
- invent checklist answers
- invent API formulas
- decide pass/fail criteria on its own
- silently fill missing engineering inputs

## Branch rule

This work should live on:

- `feat/report-generation-web`

It should remain separate from:

- `feat/field-android`
- `feat/field-ios-demo`
