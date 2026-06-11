# Report Compiler Workflow

## Product Definition

The report platform should be treated as a report compiler, not a generic report-writing AI.

Core pipeline:

```text
field data
-> canonical inspection package
-> data QA and missing-field checks
-> report/code classification
-> standard rule validation
-> precedent and standards retrieval
-> section-level structured generation
-> deterministic drawing/table rendering
-> human review and approval
-> DOCX/PDF export
```

The product promise is:

```text
From canonical field capture to audit-ready inspection report generation.
```

The system should not replace inspector or engineer judgement. It organizes field evidence, industry standards, report precedent, drawings, tables, and reviewer decisions into a traceable report workflow.

## Critical Rule

Historical reports are precedent only.

They can guide:

- section order
- wording style
- table shape
- photo caption style
- title blocks and layout conventions
- recommendation formatting

They must not provide:

- current inspection facts
- current tank dimensions
- current UT readings
- current defect locations
- current acceptance decisions
- current compliance truth

Compliance truth should come from:

- Android/canonical field package
- standards/code rule mappings
- customer procedures
- deterministic calculations
- inspector or engineer approval

## Knowledge Base Split

Use three separate knowledge lanes.

### 1. Standard KB

Purpose:

- define what applies
- identify required fields
- support calculations and rule checks
- flag unsupported conclusions

Current local source:

```text
/Users/oscar/Public/irs/Codes/
```

Current standards/code corpus includes API 653, API 650, API 575, API 577, API 651, API 652, API 620, EEMUA 159, STI SP001, ASTM, and AS 1692 references.

Use this lane as standards guidance only. Do not copy code text verbatim into the final report.

### 2. Precedent KB

Purpose:

- learn how prior approved reports are structured and worded
- retrieve similar report sections
- provide precedent cards for section drafting

Current local source:

```text
/Users/oscar/Public/irs/Sample Reports/
```

Primary format precedent for the current API-standard mock workflow:

```text
22PE1-4 TK V10 Internal & External Inspection Report.pdf
```

### 3. Template / Format KB

Purpose:

- control final report appearance
- define ToC and section order
- define DOCX/PDF page blocks
- define drawing, photo, appendix, and worksheet blocks

Current implementation:

- `server/report-toc.mjs`
- `src/domain/reportToc.ts`
- section templates in `server/generation.mjs`
- layout map renderer/editor in the web UI

## Canonical Inspection Package

Android V2 Product export is the current import contract.

The long-term target is a canonical package with stable objects:

- `Inspection Package`
- `Evidence Object`
- `Finding Object`
- `Rule Object`
- `Report Section Object`

Every generated section should be traceable back to:

- field evidence
- standards/code references
- precedent references
- deterministic calculation outputs
- deterministic drawing/map artifacts
- human review state

## Agent / Tool Roles

The AI engine should orchestrate specialists, not do everything itself.

Recommended roles:

- `Data QA Agent`: checks missing fields, units, photos, coordinates, and schema consistency.
- `Standard Mapping Agent`: maps package data to API/client procedure requirements.
- `Calculation Agent`: calls deterministic calculators only.
- `Precedent Retrieval Agent`: retrieves sample-report formatting and wording precedent.
- `Section Writer Agent`: drafts section JSON and prose from prepared context.
- `Drawing Agent`: controls deterministic renderers for layout maps, UT maps, charts, and photo logs.
- `Reviewer Agent`: checks unsupported conclusions, contradictions, and missing citations before human approval.
- `Export Agent`: assembles browser preview, DOCX, and PDF outputs.

Codex CLI is useful as the implementation and section-drafting worker, but final report quality should come from the whole compiler pipeline.

## Drawing Rule

LLM must not invent geometry.

Drawing workflow:

```text
field layout JSON
-> deterministic geometry builder
-> SVG/canvas/Konva renderer
-> report-side override layer
-> user review
-> exported figure
```

LLM can generate captions, interpretations, and recommendation wording. It should not decide final plate dimensions, marker coordinates, or geometry.

## MVP Phases

### Phase 1: Canonical Package + Template

- Android/web export JSON
- report family classification
- API-standard ToC
- required field validator
- browser preview
- human review screen

### Phase 2: Precedent KB

- historical report section parser
- section-level retrieval
- format/wording precedent cards
- low-confidence flags

### Phase 3: Standard Rule Engine

- API 653/client procedure mapping
- UT, settlement, visual finding checks
- deterministic calculation functions
- unsupported conclusion blockers

### Phase 4: Agent Workflow

- Data QA Agent
- Section Writer Agent
- Drawing Agent
- Reviewer Agent
- Export Agent
- trace/eval dashboard

## Current Implementation Hooks

Implemented now:

- API-standard report classification in `server/report-classification.mjs`.
- API-standard ToC in `server/report-toc.mjs` and `src/domain/reportToc.ts`.
- standards/code PDF ingestion from `/Users/oscar/Public/irs/Codes/`.
- sample-report precedent ingestion from `/Users/oscar/Public/irs/Sample Reports/`.
- separate `wordingPrecedents` and `standardsReferences` retrieval lanes.
- deterministic standard-rule checks in `server/standard-rules.mjs`.
- generation orchestration evidence chains stored in `orchestration_json`.
