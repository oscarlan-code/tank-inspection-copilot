# Next Session Marker: RL Evaluation

Date: 2026-08-04

## Current Position

The quantified results below are the pre-training baseline from one complete
32-section V10 report evaluation batch. They are not post-RL results.

- Retrieval Precision@3: 69.7% across 11 retrieval-applicable sections
- Retrieval Recall@3: 18.6% across 11 retrieval-applicable sections
- Retrieval nDCG@3: 67.2% across 11 retrieval-applicable sections
- Claim precision: 98.7% across 32 sections
- Required-fact recall: 78.9% across 9 labelled sections

Detailed run:

`apps/report-platform/.data/eval-runs/report-generation-performance-2026-08-04T13-14-33-565Z.json`

## Implemented Baseline

- PostgreSQL evaluation-case and relevance/fact-label schema
- evaluator-only hidden-gold pairing with retrieval exclusion
- Precision@K, Recall@K, F1@K, MRR, and nDCG@K
- claim precision and required-fact recall
- system-level RL reward integration and policy promotion gates
- super-admin aggregate metric display
- stable evaluator pairing for account-scoped demo inspection IDs
- regression coverage for metrics, policy behavior, API boundaries, and leakage

All final gates passed:

- `npm run build`
- `npm run logic:audit`
- `npm run storage:audit`
- `npm run recommendation-kb:audit`
- `STRICT_SAMPLE_LEAK=1 npm run leak:audit`
- `npm run api:audit` with PostgreSQL environment loaded

## Resume Here

1. Build the Super Admin relevance-label review API and UI.
2. Let an expert accept, reject, or regrade machine-proposed precedent labels.
3. Add multiple app-capture and hidden-report evaluation pairs.
4. Run offline retrieval-policy episodes across sections and reports.
5. Compare baseline, candidate, and untouched hidden-test metrics.
6. Promote a candidate only when reviewed metric gates pass without reducing
   claim precision or violating the gold-report leakage firewall.

## Non-Negotiable Boundaries

- The paired historical gold report is evaluator-only and must never enter the
  generation retrieval pack.
- Current LAIQ inspection app data remains the source of truth for client,
  tank, measurement, finding, and other inspection facts.
- Machine-proposed relevance labels alone cannot approve a production policy.
- Report-level and section-level hidden tests are required to prevent
  overfitting to V10.

## Work-In-Progress Checkpoint — 2026-08-27

- Built governed report-corpus ingestion, QA-passed mock/gold section pairs,
  same-report and same-lineage retrieval firewalls, and offline RAG-arm runs.
- Compared Grounded, Balanced, and Evidence Recovery on 100 training sections
  from 72 reports. Grounded is the default; Evidence Recovery is selected only
  for inspection-maintenance-regime sections.
- Frozen contextual validation ran on 20 validation sections. The candidate is
  not promoted and production remains unchanged.
- Added atomic voice-note claim binding so measurements, conditions, findings,
  and actions cannot silently transfer between claims.
- Current validation still blocks three relationship errors. Resume by adding
  evidence-only automatic correction/regeneration for blocked drafts, then
  rerun the same frozen 20-section validation cohort before hidden testing.
- Do not weaken the hard-failure gate or use evaluator-only original content in
  generation to improve these results.
