---
name: report-platform-kb-eval
description: Use when changing precedent KB, standards KB, recommendation KB, sample-report leakage controls, eval scoring, or report-generation performance audits.
---

# Report Platform KB And Eval

## Core Rule

Precedent reports guide structure, style, and approved patterns. They must not provide hidden current-report facts or copied answer text.

## Important Files

- `server/precedent-kb.mjs`
- `server/fact-recommendation-kb.mjs`
- `server/eval.mjs`
- `server/scripts/audit-precedent-kb.mjs`
- `server/scripts/audit-fact-recommendation-kb.mjs`
- `server/scripts/audit-sample-leaks.mjs`
- `server/scripts/audit-report-generation-performance.mjs`
- `PRECEDENT_KB_ARCHITECTURE.md`
- `FACT_RECOMMENDATION_KB.md`
- `EVAL_SYSTEM.md`

## KB Layers

- Precedent KB: section shape, report style, wording pattern, layout convention.
- Standards KB: controlled technical guidance from code/reference material.
- Fact-to-recommendation KB: historical condition-to-recommendation pairs.

## Leakage Rules

- Do not retrieve the same current gold report as answer text.
- Do not insert reference answer text into generation prompts.
- Do not leak sample report IDs, client names, site names, or long copied phrases into generated drafts.
- Eval can compare to reference after generation, but generation cannot see hidden gold text.

## Eval Rules

Bad eval is expected when required report-side inputs are missing. Do not tune the generator to guess missing values.

## Validation

```bash
npm --prefix apps/report-platform run kb:audit
npm --prefix apps/report-platform run recommendation-kb:audit
STRICT_SAMPLE_LEAK=1 npm --prefix apps/report-platform run leak:audit
npm --prefix apps/report-platform run report:eval
```
