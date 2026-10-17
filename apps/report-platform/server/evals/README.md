# Simple agent evaluations

This is the readable evaluation path for the rebuilt report pipeline. It follows
the same loop for every agent:

1. state one agent goal;
2. freeze a lineage-safe dataset;
3. pin one candidate configuration;
4. run small named graders;
5. inspect row-level failures;
6. change one variable and compare with the baseline;
7. open validation and hidden-test lineages only at their declared stage.

Each agent folder contains an `eval-plan.json` and one runner. A result answers five
questions without requiring the reader to understand the wider report harness:

- What was the agent expected to do?
- Which dataset and lineage were used?
- Which exact candidate was evaluated?
- Why did each grader pass, fail, or remain unmeasured?
- Is the candidate qualified, failed, or incomplete?

The runners read immutable artifacts produced by existing application workflows.
They do not change Android data, agent releases, product routing, or promotion.
Existing detailed traces remain available for investigation, but they are not
required to understand the top-level decision.

For mock preparation, parsed PDF blocks are source indexes rather than scoring
units. Reviewers consolidate them into semantic units such as one identity fact,
measurement set, observation, limitation, scope item, or recommendation. One
semantic unit may link to several app records, and one voice note may support several
semantic units. The eval therefore scores many-to-many meaning links rather than
requiring one report sentence to match one app sentence.

Voice styles are dataset conditions, not different agent candidates. The same
candidate must preserve the same truth under concise, natural, technical, disfluent,
segmented, and detailed capture. Different wording is expected; changed meaning is
not.

## Current sequence

| Step | Agent | Status |
| --- | --- | --- |
| 1 | Mock Preparation Agent | Immutable R&D release v1 |
| 2 | Mock Preparation evaluator/reviewer | Implemented; human review remains authoritative |
| 3 | Contents Classification Agent | Qualified evaluation release v1; reviewed package output |
| 4 | Report Structure Agent | Later |
| 5 | Section Generation Agent | Later, one section at a time |
| 6 | Pre-display Review Agent | Later |
| 7 | Post-generation Gold Evaluator | Later |
| 8 | Report Integrator | Later |

The former Report Evidence Routing Agent is archived for saved TK5452 evaluation
reproduction and is not part of this sequence.

Run Step 1 against a private Android mock-corpus case:

```bash
node server/evals/mock-preparation/run.mjs \
  --case-root /absolute/path/to/apps/field-android/.local/report-mock-corpus/v1/<case-id>
```

Build the semantic review matrix from the reviewed case plan, checklist
extraction, source inventory, and authentic Android exports before running the
eval:

```bash
node server/evals/mock-preparation/build-semantic-matrix.mjs \
  --case-root /absolute/path/to/apps/field-android/.local/report-mock-corpus/v1/<case-id>
```

The builder creates three visibly different queues:

- exact structured pairs, which receive deterministic parity checks;
- narrative pairs, which remain pending until meaning and unsupported additions
  are reviewed;
- layout pairs, which remain pending until the source figure and app map are
  compared visually.

Pending review is reported as `incomplete`, not as a model failure. Automated
parity proves that a prepared value survived the Android export. It does not
prove that the prepared value was extracted correctly from the original report.

Prepare bounded sealed-gold narrative review requests without sending them:

```bash
REPORT_PLATFORM_CODEX_MODEL=gpt-6-sol \
node server/evals/mock-preparation/judge-semantic-pairs.mjs \
  --case-root /absolute/path/to/apps/field-android/.local/report-mock-corpus/v1/<case-id>
```

The preview is written inside the private case at
`review/semantic-judge-request-preview.json`. Add `--live` only after that exact
payload is approved for the external evaluator. Responses are cached by request
hash, written back as explicitly LLM-reviewed rows, and summarized in
`review/semantic-judge-findings.json`. Layout rows are never sent to the text
judge and remain queued for human visual comparison.

The scale semantic grader is independent from the mock generator. It runs only
after its frozen calibration gate passes. It grades narrative pairs in bounded
batches of 12 and returns the meaning verdict, integrity verdict, missing facts,
altered facts, unsupported facts, direct contradictions, confidence and a short
explanation. A failed verdict or confidence below 0.90 is routed to human review.

Prepare the scale requests without sending them:

```bash
npm run mock-preparation:grader:prepare -- \
  --case-root /absolute/path/to/apps/field-android/.local/report-mock-corpus/v1/<case-id>
```

Add `--live` only after the calibration result has `gatePassed: true`. The
command fails closed before any external request when calibration is missing or
has not passed. Exact structured rows continue to use deterministic graders;
layout rows never enter the text grader.

The first scale step is deliberately limited to five new semantic units across
three capture variants (15 judgments):

```bash
npm run mock-preparation:grader:scale -- --case-root <private-case-root>
```

Without `--live`, this writes the exact three-request preview only. After the 15
judgments run, all of them require human review before the full 450-row narrative
set is authorized. The scale plan is frozen in
`semantic-judge-scale-plan-v1.json`; it excludes the calibration units and covers
scope, condition/location, inspection limitation, measurement and recommendation
semantics.

Use `--cache-only` to recompute the dataset and UI projection from saved worker
responses. Cache-only mode throws on any missing response and cannot call the
external evaluator.

Add `--json` for machine-readable output or `--output <file>` to save the result.
No source prose is copied into the result.

Copy `mock-preparation/eval-candidate.example.json` to the private case root as
`eval-candidate.json` and replace every placeholder with the configuration that
actually produced the case. Do not assign the current Git commit to an older build.

The private case also needs `semantic-pairs.json`. See
`mock-preparation/semantic-pairs.example.json`. The builder first creates a
review draft linking source semantic units to app evidence in every voice
variant. Independent review turns that draft into a gold matrix. It stays
outside generator inputs.

## Mock Preparation Agent: OpenAI-style row workflow

The active mock-preparation workbook now keeps two datasets separate:

1. **Mock output evaluation** — one row is one original report semantic unit paired
   with one generated app evidence output for one capture variation. These rows
   decide mock-data readiness.
2. **Evaluator calibration** — a small human-labelled set, including deliberately
   flawed examples, checks whether the semantic evaluator reaches the expected
   judgment. A calibration pass does not mean the mock output itself is correct.

The workflow is:

```text
source report -> reviewed semantic units -> pinned candidate
-> app-style candidate evidence -> Android ProductStore/export
-> deterministic/semantic/visual graders -> human review
-> same-dataset candidate comparison
```

Prepare the narrative-only LLM candidate request without sending it:

```bash
npm run mock-preparation:candidate:prepare -- --case-root <private-case-root>
```

Run the local evaluation and persist the spreadsheet-style dataset:

```bash
npm run mock-preparation:eval:run -- --case-root <private-case-root>
```

This writes `review/mock-preparation-dataset.json`,
`review/mock-preparation-eval.json`, and
`review/mock-preparation-workflow-result.json`. Structured fields, checklist
ratings and UT rows use deterministic checks. Layout figures remain a human visual
queue. The LLM candidate owns narrative units only.
