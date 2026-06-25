# Fact-To-Recommendation KB

The fact-to-recommendation KB is the structured historical learning layer for report generation.

It converts approved historical sample-report sections into structured pairs:

```text
historical inspection condition pattern -> approved recommendation pattern
```

This is separate from the raw precedent KB.

## Purpose

Raw report chunks are useful for style, but they are too loose for controlled technical generation. The structured pair KB gives the LAIQ AI Engine safer guidance:

- what kind of field condition was observed
- what kind of repair or maintenance recommendation was historically approved
- what component, condition, action, and evidence tags are involved
- which historical report/page the pattern came from
- whether the current app export has matching evidence

## Evidence Classes

The generation system should keep these classes separate:

- current app facts: facts captured in the current LAIQ inspection app export
- report-side inputs: user-confirmed data entered on the web platform
- historical pair guidance: approved past fact/recommendation patterns from other reports
- template guidance: section shape, heading style, bullet style, table style
- AI inference: wording or judgement drafted from current facts plus historical guidance

Historical facts are allowed as reference memory, like a doctor reviewing patient history. They must not become current report facts unless confirmed by current app data or user approval.

## Current Implementation

Code:

- `server/fact-recommendation-kb.mjs`
- `server/scripts/rebuild-fact-recommendation-kb.mjs`
- `server/scripts/audit-fact-recommendation-kb.mjs`

Generated local index:

- `apps/report-platform/.data/fact-recommendation-kb/fact-recommendation-kb.index.json`

The `.data` folder is intentionally gitignored because the index is rebuilt from the local private report corpus.

## Build And Audit

```bash
npm --prefix apps/report-platform run recommendation-kb:rebuild
npm --prefix apps/report-platform run recommendation-kb:audit
```

The initial extractor scans all approved sample-report chunks and does not cap the number of pairs. The first V1 Beta build extracted hundreds of pairs across the local sample-report corpus.

## API

```text
GET  /api/v1/knowledge-base/recommendations/status
POST /api/v1/knowledge-base/recommendations/rebuild
GET  /api/v1/knowledge-base/recommendations/search?sectionId=repair-recommendations
GET  /api/v1/knowledge-base/recommendations/audit
```

## Generation Use

The section generator receives `factRecommendationContext` only for sections that benefit from technical narrative/recommendation guidance:

- narrative sections
- repair/recommendation sections
- inspection-report sections

Deterministic measurement tables and normal layout-map sections should not be polluted by repair recommendation pairs.

## Safety Rules

- The exact current mock/gold report is excluded from retrieval.
- Same-customer historical reports from different report jobs may be used as historical context.
- Old values are never automatically promoted to current facts.
- Missing current values remain `Pending confirmation`.
- The final report should only include current app facts, user-confirmed historical facts, and reviewer-approved AI recommendations.

## Next Improvements

- Add human-curated gold labels for high-value pairs.
- Add source confidence levels: extracted, reviewed, approved-gold.
- Add pair-level eval scoring for required recommendation themes.
- Add reviewer UI to accept, merge, or reject extracted pairs.
- Expand extraction rules for settlement, MFL, roof, nozzle, floor, and appendix-specific recommendations.
