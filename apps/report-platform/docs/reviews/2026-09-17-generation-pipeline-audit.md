# Generation and mock-data pipeline audit — 17 September 2026

## Assessment and scope

The current results cannot yet establish report-writing quality. Mock preparation,
section assignment, generation, and evaluation do not consistently agree on the
same facts or on what each section must contain. This is a pipeline contract
problem; changing the model or tuning prompts first would obscure it.

This review covered source extraction, Truth Cases, Capture Variants, baseline
and governed mock pairs, app materialization, section evidence, generation,
scoring, review/export, and evaluation/policy separation. Three independent
reviewers examined preparation, generation, and evaluation. Evidence comprises
code inspection, saved tank 5452 results, read-only PostgreSQL transactions,
and controlled in-memory helper/serializer reproductions. No new generation,
data rebuild, runtime fix, learning, or promotion was performed during this
audit. This document is an audit record, not a replacement architecture.

Project: `/Users/oscar/Code/tank-inspection-coplilot-app`.
Product: `apps/report-platform`. Current checkout includes prior uncommitted
changes; findings describe the code as reviewed, including today's changes.

Database snapshot:

- 1,737 baseline evaluation cases: 1,713 training and 24 validation.
- 20 non-baseline `approved_truth_graph` evaluation cases: 18 training and 2 hidden test.
- 27,638 ready and 1,565 quarantined standardized mock/gold pairs, all contract 1.
- Production policy remains V1. V18 remains `training`, with no promotion timestamp.

These are case/record counts, not counts of independent reports or proof that
every case has the same defect.

## The paths that must be reconciled

| Path | Preparation and entry | Important distinction |
| --- | --- | --- |
| Real inspection | Native app records → authenticated import → report job → section generation | Native UT, findings, checklist, voice, and table structures are authoritative. Synthetic `captureFacts` need not exist. |
| Legacy baseline, including reviewed 5452 case | Historical chunks → approved truth labels → baseline pair → capture variation → headless materialization → evaluation loader | Broad report-wide evidence selection plus forced target-section assignment. |
| Ordinary Capture Variant | Truth Case → scenario and fact links → headless materialization → standardized pair or truth-graph fallback | Better section metadata, but uncertain boundaries and native-record fidelity remain. |
| Governed offline pilot | Separate governed source pairs → pilot evidence/compiler → shared narrative/finalization helpers → pilot scorers | Sharing helpers does not establish identical inputs, compilers, evaluation, or serving behavior. |

The desired common path is: reviewed source facts or real app evidence → native
records with stable component identities → one section evidence contract → one
report composition path → one evaluation contract → approved export snapshot.
Hidden reference content belongs only in the evaluator after generation.

## Findings

### 1. High — No reliable section-content contract across preparation and scoring

The baseline builder selects all observable report facts for `inspection-report`,
excluding only photo/layout classes. The evaluation loader then assigns every
baseline capture to the tested section. Required facts come from the entire
manifest rather than a separately validated output requirement list.

Evidence: [standardized-pair-builder.mjs](../../server/standardized-pair-builder.mjs),
lines 347–363; [store.mjs](../../server/store.mjs), lines 2399–2417 and 2559–2573.
The ordinary resolver also treats an unknown heading as belonging to the last
recognized section with no maximum distance or verified end boundary:
[capture-section-mapping.mjs](../../server/capture-section-mapping.mjs), lines 22–52.
A controlled page-7/page-38 example returns `inspection-report`, `aligned:true`.

Impact: unrelated detail enters generation and becomes an output obligation.
However, old heading labels cannot simply be filtered by keyword. Original
Section 4 in the 5452 report includes shell, roof, floor, and corrosion
calculations. The earlier claim that all 54 omissions belong elsewhere was
too broad. Their source spans and reporting roles require review.

Required correction: explicit source section, target report section, component,
and reporting role for each fact: required narrative finding, required
deterministic report content, supporting evidence, metadata, or withheld.

### 2. High — Observable facts can be withheld by automatic classification

Truth proposals use keyword/heading heuristics. In the saved 5452 manifest,
floor projection width and shell spot rusting are classified as
`gold_only_unobservable`. These are observable inspection information; their
absence cannot all be attributed to a deliberately incomplete capture profile.

The case approval route bulk-accepts machine proposals. Approval therefore
does not itself demonstrate fact-by-fact verification of extraction,
answerability, or section boundaries. The proposal deduplication signature also
omits component/section/page identity, allowing identical wording on distinct
objects to collapse.

Evidence: [training-harness.mjs](../../server/training-harness.mjs), lines
919–936, 1509–1538 and 1554–1600; [index.mjs](../../server/index.mjs), lines 474–484.

Required correction: retain explicit review status and evidence for important
classification decisions; preserve distinct physical observations even when
their wording is identical. Source transcription corrections must create a
new version, not silently enrich the existing incomplete capture with gold.

### 3. High — Some mock inputs already contain the historical answer

`buildMaterialVoiceComplements` extracts statements from target report text,
prefixes them with “Inspector observation/recommendation,” and labels them
required voice evidence. The statements inherit a prototype fact's provenance.

Evidence: [standardized-pair-builder.mjs](../../server/standardized-pair-builder.mjs),
lines 262–285 and 350–356. Read-only data inspection found 2 such captures among
175 in the 5452 case, and at least one in 64 of 1,713 linked training cases;
none in the 24 linked validation cases checked. The manifest explicitly records
`syntheticEvidenceDerivedFromGold:true`, alongside `goldTargetVisibleToScenario:false`.

This is answer exposure during preparation, not demonstrated retrieval leakage.
It can support a labelled reconstruction/formatting fixture, but cannot
independently establish that the system derives report findings or
recommendations from field observations. Exact statement provenance and
experiment purpose must be explicit.

### 4. High — Mock “App Round Trip” can preserve text while losing usable records

The default adapter is a headless JavaScript serializer. It does not exercise
the app editor/database export lifecycle. A whole measurement table can remain
one `{text: ...}` capture; native numeric conversion yields `readingValue:null`.
Structured tables are copied from `scenario.appRecords` when supplied, rather
than constructed from these text facts.

Controlled reproduction through the actual materialization helper preserved a
two-station table in `captureFacts`, but produced a null numeric reading,
generic `itemKey:"utMeasurements"`, and no structured tables. Fact ID/text/unit
preservation alone still succeeds. That is serialization fidelity, not proof
of native app-to-report parity.

Evidence: [capture-round-trip.mjs](../../server/capture-round-trip.mjs), line 4;
[app adapter](../../../field-android/tools/capture-scenario-round-trip.mjs),
lines 72–80 and numeric conversion; [index.mjs](../../server/index.mjs), lines
1731–1815. Android files were read only.

Required correction: validate ordered cells, units, row/component identities,
finding/photo links, and the actual imported native records. Empty arrays
matching other empty arrays must not establish coverage.

### 5. High — Candidate generation can discard native deterministic output

The generator selects native deterministic output, but governed finalization
replaces it with output compiled only from `captureSectionFacts` for structured
sections. Native app packages may have UT/checklist records without synthetic
capture facts. Map/attachment handling follows a separate exception.

Evidence: [generation.mjs](../../server/generation.mjs), lines 395–451;
[governed-generation-contract.mjs](../../server/governed-generation-contract.mjs),
lines 59–85. A reviewer replayed the route/finalize/format helpers against a
canonical V3 fixture containing 140 UT rows, 15 findings, 23 voice notes, and
zero capture facts: structured sections can become a heading and empty table.
This reproduction did not invoke a model or persist a report.

Today's v4 removal of the evidence appendix exposes a related regression:
no-voice narrative routing suppresses selected content, while the finalizer
excludes deterministic content from narratives. It can produce a heading and
empty list. Removing raw appendices was requested; losing legitimate report
content was not. This correction belongs in composition, not an instruction
to restore evidence dumps.

The model-failure path has the opposite defect: capture-scenario fallback uses
`composeCapturedEvidenceSection`, which concatenates capture facts. That dump
can enter finalization as the narrative and survive v4. See
[generation.mjs](../../server/generation.mjs), lines 983–988, 2166–2171 and
5691–5696. The output contract must hold for successful generation, no-voice
composition, and fallback alike.

### 6. High — Candidate prompt context is both too broad and incomplete

The governed evidence builder uses section-filtered capture facts but adds an
entity graph built from the whole inspection, including voice notes routed to
other sections. The same governed prompt omits explicit user generation
instructions, report-side manual inputs, deterministic calculations, and
standards/recommendation context present in the legacy prompt.

Evidence: [generation.mjs](../../server/generation.mjs), lines 2176–2252;
[evidence-entity-binding.mjs](../../server/evidence-entity-binding.mjs), lines
160–215. Routing probes also show compound finding/recommendation notes and
condition notes attached to UT screens can be assigned to only one destination.

Required correction: one explicit, section-scoped evidence object must retain
needed related entity fields and authorized manual inputs. Do not regain
coverage by exposing the entire inspection graph to every section.

### 7. High — Scoring confuses absence, alteration, and correct meaning

Any observable numeric fact can enter protected checks, even when optional
supporting context. Absence is counted as a protected mismatch and hard-blocks
the draft. Conversely, numeric/unit checks match anywhere in the section;
word coverage does not establish a correct component binding or negation.

Evidence: [eval.mjs](../../server/eval.mjs), lines 20–58, 184–186, 240–272;
[draft-quality.mjs](../../server/draft-quality.mjs), line 28.

Controlled evaluator reproductions:

| Input / output change | Current deterministic result | Required interpretation |
| --- | --- | --- |
| Optional context “Sump depth 135 mm” omitted | Required count 0; protected mismatch 1; blocked | Omission of optional context must not equal an altered measurement. |
| Shell 6 mm / roof 8 mm exchanged between components | Recall, precision, protected accuracy all 1 | Incorrect component binding must fail. |
| “Roof satisfactory” changed to “Roof not satisfactory” | Recall 1; precision unavailable but numeric value stored as 1 | Contradiction must fail; unavailable must not mean perfect. |
| Unfinished “within 2 inches from weld:” in a heading/list | Format 1, pass | Unresolved fragment is not publication-ready prose. |

Semantic review may catch some errors, but does not repair the interpretation
of these deterministic metrics. The live baseline evaluator and governed
pilot do not execute the same relationship checks.

### 8. High — Outcome and evaluation-only isolation need explicit contracts

The capture-aware classifier overwrites the existing outcome without carrying
all generation blockers or missing manual inputs. A controlled existing-blocker
example becomes `ready_for_review` with otherwise perfect supplied scores.
The reward path separately checks blockers, so displayed readiness and learning
eligibility can disagree.

Also, `updateLearning:false` prevents aggregate updates but does not itself make
the persisted reward ineligible. Promotion metric queries read all eligible
rewards without a generator/evaluator contract filter. This is a future
comparison/promotion risk; it is not evidence that promotion happened.

Evidence: [capture-evaluation.mjs](../../server/capture-evaluation.mjs), lines
37–57; [system-rl-policy.mjs](../../server/system-rl-policy.mjs), lines 121–138,
344–366 and 604–607; [store.mjs](../../server/store.mjs), lines 2824–2853.

### 9. Medium — Shared helpers do not establish end-to-end parity or reproducibility

The governed pilot retains separate input compilation, evidence representation,
protected/relationship scoring, classification, and reward calculation. Its
classification still uses historical gold similarity where the live baseline
uses current-evidence coverage. These scores cannot be treated as comparable
measurements of one system.

Baseline gold/pair/variation rebuilds also update existing identities. A future
rebuild could change what an existing evaluation case points to. The current
builder writes standardized contract 11, while the non-baseline consumer selects
contract 1. The database presently contains only contract-1 standardized pairs;
the latter is a verified rebuild risk, not a demonstrated current v11 fallback.

Evidence: [pilot](../../server/scripts/run-governed-rag-training-pilot.mjs),
lines 79–107; [standardized-pair-builder.mjs](../../server/standardized-pair-builder.mjs),
lines 3, 131–178; [baseline-variation-pilot.mjs](../../server/baseline-variation-pilot.mjs),
lines 99–119; [store.mjs](../../server/store.mjs), line 2423.

Required correction: preserve old runs and create immutable new source,
capture, mapping, generation, evaluator, and renderer revisions. Use the same
canonical package through each route before comparing policy results.

### 10. Medium — Preview/format tests do not establish exported report quality

The Evaluation Lab renders sanitized HTML in a page-shaped wrapper labelled
“Export-ready section preview.” DOCX separately strips HTML to text and infers
heading styles. For example, title-case subsection headings can lose their
semantic heading treatment. PDF export remains planned in the architecture.

Evidence: [EvaluationLab.tsx](../../src/components/EvaluationLab.tsx), lines
498 and 527–533; [docx-export.mjs](../../server/docx-export.mjs), lines 555–635
and 791–801; [SYSTEM_ARCHITECTURE.md](../../SYSTEM_ARCHITECTURE.md).
The prior CSS badge stretch was fixed, but that does not establish export parity.

Existing parity audits mainly check imported helper names, representative
fixtures, and basic outputs. They did not test the complete native/mock paths
or the semantic counterexamples above. Previously passing guardrails were
useful checks, but were not sufficient evidence of pipeline correctness.

Generation QA also checks whether the HTML string is empty rather than whether
it contains substantive report content; a heading and empty table can pass.
See [generation.mjs](../../server/generation.mjs), lines 5731–5751. Approved-section
selection in export is present; that selection gate cannot substitute for
content validation before approval.

## What the current 5452 result establishes

Run `eval_0215a861-0409-43f2-b103-6acbc08c8674` uses
`governed_narrative_without_evidence_appendix_v4` on an older baseline manifest
with `schemaVersion:11` and `voice_heavy` profile. It contains roughly 524 words
and no raw appended evidence. Recorded recovery is 34/88 (38.6%); protected
checks pass 42/109 (38.5%). There are 175 captures and 20 withheld facts.

These numbers mix output scope, source fragmentation, capture availability,
and actual generation omissions. They do not mean that the writer recovered
only 38.6% of valid narrative findings. Nor can they be replaced with a higher
corrected percentage before a source-reviewed required-fact list exists.

The original reference spans pages 7–12 and includes genuine calculation
content. The legacy capture has inch/foot transcription defects. Earlier
native-text and section-continuity repairs apply to future ingestion; they did
not retroactively repair this approved capture. The draft's disconnected B-scan
readings, misplaced methodological text, and unfinished notes remain real
report-writing problems even after removing the appendix.

## Correction plan to review before implementation

| Order | Review deliverable | Acceptance evidence |
| --- | --- | --- |
| 1 | Define the report-section content contract | For each content type, agree required output, supporting-only evidence, placement, and behavior when unavailable. Preserve useful calculation summaries where the report requires them. |
| 2 | Source-review a small set of complete reports | Start with 5452 plus a different report layout and a real native app package. Verify section boundaries, units, component/row identities, repeated observations, answerability, and provenance. |
| 3 | Approve a new immutable mock specification | Preserve native cells/records and capture lineage; separate answer reconstruction fixtures from observation-to-report evaluation. Document every omission and transformation. |
| 4 | Agree one composition and routing path | Native structured output survives; narratives contain relevant findings without a raw appendix; no-voice sections and manual confirmations have explicit behavior. |
| 5 | Calibrate scoring against reviewed examples | Separate required omissions, incorrect values, unsupported claims, entity errors, unavailable metrics, operational blockers, and formatting defects. Pass the counterexamples above. |
| 6 | Trace the same package across runtime and evaluation | Compare scoped input facts, entity graph, deterministic blocks, prompt inputs, output, and scores across real-app, baseline, and pilot paths. Pin all versions. |
| 7 | Verify an actual approved export | Compare substantive content, table cells, headings, and rendering with the preview. A page-shaped HTML panel is not sufficient. |

This plan requires no model promotion. Broad regeneration and policy comparison
should wait until the reviewed small set establishes trustworthy preparation,
composition, and scoring. Keep the no-appendix requirement; do not recover a
better score by dumping supporting records back into the report.

## Limits and retained controls

This was a pipeline audit, not a full security or engineering-code compliance
assessment. Not every source PDF or stored case was manually inspected. Helper
reproductions establish executable defects but are not new live-model runs.
No general fleet-wide corrected recovery percentage is claimed.

Retain the existing immutable original sources, ordinary approved-case guards,
authentication/tenant checks, same-gold retrieval exclusions, source checksums,
and post-generation reference snapshots. The defects above require strengthening
the contracts around them, not discarding those controls.
