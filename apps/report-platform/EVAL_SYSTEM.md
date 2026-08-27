# Report Generation Eval System

The eval system is used to tune the report-generation workflow, prompts, retrieval policy, templates, missing-input detection, and tool orchestration. It is not model fine-tuning.

## Core Rule

Generation and evaluation are separated.

- Generation can use app export data, report-side user inputs, deterministic calculations, layout-map artifacts, standards/rules, and approved precedent guidance.
- Evaluation runs only after generation.
- Reference report answer text used by eval must never be inserted back into the generation prompt.
- If a section needs missing user/report-side input, the eval result should be bad or capped until that input is supplied.

## Live Evaluation Lab

The Super Admin Evaluation Lab is PostgreSQL-backed. It does not load a report inventory fixture, create simulated generated text, estimate scores, or seed a sample evaluation case.

Its four current stages are:

1. `Approved Sources`: lists only approved KB documents that have an immutable source object and real ingested chunks.
2. `Truth & Mock Data`: automatically detects historical date/facts, builds the Truth Case, then lets the user choose capture styles and generate validated mock datasets in one continuous stage.
3. `Evaluation Runs`: lists only persisted runs linked by `report_eval_runs.evaluation_case_id`.
4. `Policy Registry`: shows PostgreSQL policy/reward state and keeps promotion disabled until real metric and human-review gates pass.

Training-reference reports remain available to approved retrieval. Evaluation-gold reports are excluded from retrieval, preventing the generator from seeing the answer it will later be scored against.

Retrieval is also time-bounded. A historical evaluation case may retrieve only
approved precedent issued before that case's `evidenceAsOf` timestamp.
Validation and hidden-test gold remain unavailable to generation across the
entire benchmark snapshot, not only when their own section is scored.

## Training Harness Boundary

The full offline harness is defined in
`TRAINING_HARNESS_ARCHITECTURE.md`.

An approved historical report first becomes a reviewed Truth Graph
and Answerability Map. The Capture Variant Builder then produces multiple
versioned Capture Variants. The matching Historical Gold Report remains
hidden from generation and is visible only to the evaluator after generation.

All Capture Variants from one Truth Case inherit the same dataset split. Metrics are
averaged within a Truth Case before cross-case reward aggregation, so generating more
variants for one report cannot give that report more policy influence.

Current implementation status:

- Phase 1 Benchmark Snapshot, internal `training_case`, truth-fact, and answerability persistence is implemented in PostgreSQL.
- Phase 2 Truth Case Builder baseline is implemented with deterministic source-linked proposals, exact PDF provenance review, answerability approval, S3 Truth Graph artifacts, and immutable case approval.
- Evaluation retrieval can receive a server-built firewall context that fails closed on missing lineage and excludes matching/future/hidden evidence before scoring.
- Phase 3 Capture Variant Builder baseline is implemented with eight user-selectable faithful profiles, deterministic seeds, protected-fact rules, expected-missing-input labels, automatic validation/S3 storage, and immutable PostgreSQL state.
- App Round Trip, the historical batch runner, and answerability-aware reward feed are not implemented yet; the Evaluation Lab must not present simulated scores for them.

## What Happens After Every Generation

When a section is generated, the backend can create a `report_eval_runs` record linked to the `report_generation_runs` row. A run appears in the Evaluation Lab only when the evaluation runner also links it to an explicit `evaluation_case_id`; ordinary report-generation scores are not counted as hidden-gold evaluation results.

The evaluator checks:

- `format_match`: heading, bullet/table/page-block conventions.
- `reference_alignment`: lexical alignment to the approved reference report section after generation.
- `source_grounding`: whether the draft is grounded in Android export data, manual inputs, calculations, and tool artifacts.
- `missing_input_discipline`: whether missing values remain pending instead of being guessed.
- `leakage_safety`: whether generated text appears to copy reference-only answer content.
- `retrieval_precision_at_3`: how many of the first three retrieved precedent chunks are labelled relevant.
- `retrieval_recall_at_3`: how many labelled relevant precedent chunks are recovered in the first three results.
- `retrieval_ndcg_at_3`: whether the most relevant chunks are ranked first.
- `claim_precision`: whether deterministic identifiers and numeric/unit claims are supported by current evidence.
- `required_fact_recall`: whether section-labelled facts from the paired LAIQ app capture are represented.

## Historical Gold Labels

There is no automatic sample-report evaluation case. A real case exists only after a Super Admin explicitly approves and classifies a KB document as `evaluation_gold`, assigns a `validation` or `hidden_test` split, and links the matching immutable LAIQ app upload.

The hidden gold section proposes relevance labels for non-gold historical chunks. These labels are weak supervision:

- exact section identity and lexical alignment produce a relevance grade from 1 to 3
- the hidden gold report itself is always excluded from the retrievable label set
- proposed labels remain `machine_proposed` until an inspector confirms them
- low-confidence or unavailable labels make an RL episode ineligible for retrieval-policy learning

PostgreSQL stores product evaluation cases and reviewable labels in:

- `report_evaluation_cases`
- `report_evaluation_case_sections`
- `report_evaluation_relevance_labels`
- `report_evaluation_required_fact_labels`

## Quantified Metrics

```text
Precision@K = relevant chunks retrieved in top K / K
Recall@K = relevant chunks retrieved in top K / all labelled relevant chunks
F1@K = harmonic mean of Precision@K and Recall@K
MRR = reciprocal rank of the first relevant result
nDCG@K = graded relevance ranking quality in the top K
```

Generated-content metrics use a different denominator:

```text
Claim precision = supported verifiable claims / all verifiable generated claims
Required-fact recall = represented required app facts / all labelled required app facts
```

Lexical token precision/recall against the gold report remains a style/wording diagnostic. It is not retrieval precision/recall and cannot independently promote a policy.

## Gold Labels And Qrels

Each historical evaluation case pairs:

- one app-capture input package
- one hidden gold report
- section mappings
- retrieval relevance labels (`qrels`)
- required current-fact labels

The hidden gold report is excluded from generation retrieval. After generation, the evaluator can use its matching section to propose graded relevance labels for other historical chunks. Machine-proposed labels are marked `gold_section_weak_supervision` and must be reviewed before they are suitable for production policy promotion.

Retrieval metrics use:

```text
Precision@3 = relevant chunks in first 3 positions / 3
Recall@3 = relevant chunks in first 3 positions / all labelled relevant chunks
F1@3 = harmonic mean of Precision@3 and Recall@3
MRR = reciprocal rank of the first relevant chunk
nDCG@3 = relevance-weighted ranking quality in the first 3 positions
```

Output metrics use current evidence rather than historical literals:

```text
Claim precision = supported verifiable claims / all verifiable claims
Required-fact recall = represented required app facts / all labelled required app facts
```

For sanitized training packages, the gold report provides structure, coverage concepts, and retrieval relevance guidance; the paired app export remains the literal source of current client, tank, measurement, and finding facts.

## Expected Bad Results

Some sections are supposed to fail until the user supplies missing data.

Example: `General Tank Information` requires:

- Client representative
- Year built

If those values are missing, eval returns:

`expected_bad_missing_user_input`

This is correct behavior. The system should not reward the AI for guessing.

## Leak Guard

The evaluator flags possible leakage when:

- Long reference-report phrases appear copied into generated content.
- Reference-only measurements, identifiers, or facts appear in the generated content but are not present in allowed evidence.

This does not block generation by itself, but it provides a tuning signal to adjust:

- Prompt instructions
- Precedent retrieval scope
- Section templates
- Raw app-data preprocessing
- Missing-field rules

## API

Latest eval for a section:

```text
GET /api/v1/report-jobs/:reportJobId/sections/:sectionId/evals/latest
```

All evals for a report job:

```text
GET /api/v1/report-jobs/:reportJobId/evals
```

Generation response also includes:

```text
evalRun
```

## Product Use

Use eval results as a prompt/system tuning loop:

1. Generate one section.
2. Review eval outcome and tuning hints.
3. If missing input is the reason, fill the report-side field and regenerate.
4. If format match is weak, tune section template or formatting prompt.
5. If leakage risk is high, reduce reference answer exposure and strengthen no-copy instructions.
6. If retrieval recall is low but precision is high, expand candidate depth or query coverage.
7. If retrieval precision is low, tighten metadata filters, thresholds, or reranking.
8. If retrieval is strong but claim precision or fact recall is weak, tune the section agent rather than the retriever.
9. If claim precision is low, tighten evidence grounding; if required-fact recall is low, inspect evidence packing and section coverage.

The goal is a reliable report-generation system that fails honestly when data is absent.

Run the deterministic metric contract directly with:

```bash
npm --prefix apps/report-platform run eval-metrics:audit
```
