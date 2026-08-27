---
name: report-platform-kb-eval
description: Use when changing precedent KB, standards KB, recommendation KB, sample-report leakage controls, eval scoring, or report-generation performance audits.
---

# Report Platform KB And Eval

## Core Rule

Precedent reports guide structure, style, and approved patterns. They must not provide hidden current-report facts or copied answer text.

Use the workflow vocabulary in `PRODUCT_TERMINOLOGY.md`. In particular, the
reviewed normalized historical inspection is a **Truth Case**, and the UI that
creates it is the **Truth Case Builder**. `training_case` is an internal storage
compatibility name only.

## Important Files

- `server/precedent-kb.mjs`
- `server/fact-recommendation-kb.mjs`
- `server/eval.mjs`
- `server/scripts/audit-precedent-kb.mjs`
- `server/scripts/audit-fact-recommendation-kb.mjs`
- `server/scripts/audit-sample-leaks.mjs`
- `server/scripts/audit-report-generation-performance.mjs`
- `services/kb-ingestion/`
- `PRECEDENT_KB_ARCHITECTURE.md`
- `KB_CORPUS_INGESTION_ARCHITECTURE.md`
- `FACT_RECOMMENDATION_KB.md`
- `EVAL_SYSTEM.md`
- `TRAINING_HARNESS_ARCHITECTURE.md`
- `RL_RETRIEVAL_OPTIMIZATION_ARCHITECTURE.md`

## KB Layers

- Precedent KB: section shape, report style, wording pattern, layout convention.
- Standards KB: controlled technical guidance from code/reference material.
- Fact-to-recommendation KB: historical condition-to-recommendation pairs.

## Leakage Rules

- Do not retrieve the same current gold report as answer text.
- Do not insert reference answer text into generation prompts.
- Do not leak sample report IDs, client names, site names, or long copied phrases into generated drafts.
- Eval can compare to reference after generation, but generation cannot see hidden gold text.
- Validation/hidden gold and reports issued after a case's `evidenceAsOf`
  cutoff cannot enter evaluation retrieval.
- All Capture Variants from one Truth Case stay in one dataset split and
  are macro-aggregated at case level.

## Eval Rules

Bad eval is expected when required report-side inputs are missing. Do not tune the generator to guess missing values.

## Validation

```bash
npm --prefix apps/report-platform run kb:inventory-audit
npm --prefix apps/report-platform run kb:ingestion:audit
npm --prefix apps/report-platform run kb:review:audit
npm --prefix apps/report-platform run kb:audit
npm --prefix apps/report-platform run recommendation-kb:audit
STRICT_SAMPLE_LEAK=1 npm --prefix apps/report-platform run leak:audit
npm --prefix apps/report-platform run report:eval
```
