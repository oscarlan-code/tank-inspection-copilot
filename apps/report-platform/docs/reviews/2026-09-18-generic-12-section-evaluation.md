# Generic outline: 12-section evaluation

Status: **evaluation completed; no production profile, model or policy promoted**.

## Revised report outline and format

The revised run is available in the same Evaluation Lab:
`/admin/evaluation?evaluationCaseId=eval-generic-syn025-v3-format-v2-tk5452&sectionId=identity`.
The **Outline version** selector retains both the original and revised saved
runs; switching versions keeps the selected historical reference.

The revised backend uses report-facing titles and selected-profile numbering,
paired tank-information fields, component-grouped findings, numbered proposed
repair actions, compact checklist labels and captured UT point names. Semantic
routing blocks remain internal. Exact repeated evidence uses have one required
rendering per section, while multi-section reuse remains available.

The [presentation rules and all 25 headings](../design/generic-report-presentation-v2.md)
explain the distinction between reusable modules and actual report sections.
The [new run summary](data/syn025-current-only-v3/evaluation-12-format-v2/summary.json)
and [backend decisions](data/syn025-current-only-v3/evaluation-12-format-v2/section-planning.json)
are frozen separately from the earlier run below. The new run made nine live
worker calls; checklist and layout accepted AI wording, while seven sections
retained captured wording under the unchanged narrative validation gate.

Validation: all 13 routed tank-information items pass strict field/narrative
preservation checks; all 195 checklist responses and both UT rows remain.
There are no critical numeric/entity blockers in the shared diagnostic. The
maintenance regime remains pending standard text, with no AI call. Remaining
reference/caption equivalence and cross-reference omissions are diagnostic
review items, not independent benchmark scores or a final-report approval.

The standard application guardrails and report-generation regression audit
passed. Focused tests cover exact labels/values/units/IDs, changed qualifiers,
missing outline inputs and mixed measurement schemas. All 48 saved
section/reference/version combinations passed backend checks. Chrome through
the Tailscale hostname verified all 12 modules, both original references,
revision switching, paired-field borders, captured measurement headings, two
loaded photos and three maps, with no page errors or generation/promotion calls.
Final assembled numbering and paginated export parity remain unverified.

## Earlier saved evaluation

The results now use the **existing Evaluation Lab original-versus-generated UI**.
Open `/admin/evaluation?evaluationCaseId=eval-generic-syn025-v3-tk5452&sectionId=identity`
in the report platform and sign in as an administrator. The section selector
contains all twelve modules. The original-report selector offers the previously
reviewed TK 5452 and the SU4 photo source; neither is a same-inspection gold
report for this synthetic mock.

The existing authenticated review/navigation endpoints dispatch these fixed
case IDs to `generic-outline-review-backend.mjs`. The adapter verifies saved
input/output hashes and returns the exact completed generic-outline drafts,
separate photo/map previews and optional raw AI responses. Opening a section
does not regenerate it, import data or update learning. Promotion controls and
unestablished historical-recovery scores are absent for this review.

The existing original-PDF button opens the allowlisted, checksum-verified source
through an administrator-only API. The original report is read after generation
for comparison; it was not added to the generator's evidence.

The [standalone generated drafts](data/syn025-current-only-v3/evaluation-12-live/review.html) remain an archived local artifact.
The [run summary](data/syn025-current-only-v3/evaluation-12-live/summary.json)
records the outcomes; the [backend labels](data/syn025-current-only-v3/evaluation-12-live/section-planning.json)
show every evidence-to-section/block assignment and its rule.

## Executed workflow

1. Validate the unchanged revision-3 native export and all file hashes.
2. Create a separate evaluation projection using the eleven authored voice scripts. This tests generation, not speech recognition.
3. Normalize the app records through the shared normalizer, then apply the isolated generic-outline candidate to the twelve selected modules.
4. Allow evidence to serve multiple sections with an explicit use per destination. Checklist item notes remain in their native rows, avoiding a narrative evidence appendix.
5. Call the shared `section_planned_generation_v2` generator. Only sections with routed voice call the configured `gpt-5.6-sol` worker.
6. Validate AI wording using the unchanged shared evidence gate; retain captured wording when validation rejects a response.
7. Show verified real photos and deterministic maps in separate evaluation preview panels. These panels are not claimed as completed DOCX/production formatter integration.

The outline-readiness review, expected-label files and historical report answer text were not classifier or model inputs. Real-photo provenance and explicitly declared synthetic location aliases are retained separately. No storage upload, database import or ASR occurred.

## Results

Twelve modules were evaluated. Eleven produced section bodies. The maintenance regime remains pending standard-template selection and made **zero AI calls**.

All nine model requests returned. Two sections accepted AI wording: checklist and layout. Seven retained captured wording after evidence validation: identity, scope, findings, recommendations, methodology, thickness and summary. Photographs and references compiled without AI.

All **195 checklist responses, two UT records, three active maps and two original report photographs** remain available. The floor SVG and photo bytes are unchanged. The original export still lacks structured UT units; the candidate uses explicit inspection-wide voice declarations of millimetres, with mandatory review flags. It does not silently repair the native export.

There is no independent semantic-recovery percentage for this case. Obligations derived by the candidate measure its own preservation behavior, not independently approved benchmark coverage. Accepted AI wording also remains an inspector-review draft.

## Findings from this evaluation

- **Validator sensitivity:** several equivalent paraphrases are treated as omissions. For example, changing “I am” to “The inspector is” or “I recommend restoring” to “restoring … is recommended” can fail lexical/entity matching. One failed span discards the AI wording for the whole section. The actual requests/responses are retained for review; the safety gate was not relaxed. The [response diagnostic](data/syn025-current-only-v3/evaluation-12-live/live-response-review.json) records every section's check results.
- **Scope preservation needs review:** one rejected thickness response narrowed an inspection-wide unit statement to its capture location. Returning every evidence ID is not proof that every meaning is preserved. Captured wording was retained, so this candidate response did not replace the draft.
- **Incomplete format implementation:** the catalogue defines the desired formats, but the shared compiler does not yet implement all of them. Findings need component grouping; methodology needs appropriate metadata grids; UT headings still use R1–R5 with point/clock meaning in accompanying text. Repeated source statements need controlled consolidation.
- **Action links and modality:** recommendation-to-finding cross-references are not fully rendered. The inherited summary heading “Confirmed actions” is unsuitable for these proposed recommendations, even though the body explicitly retains their proposed/unverified status. The frozen evaluation draft preserves this defect for review.
- **Map presentation:** the existing shell renderer overlaps the L1-C1 finding and NZ-1 labels; the long roof project title clips in its drawing block. Geometry and evidence anchors passed verification.
- **Missing inputs:** the standard maintenance section, structured native UT units and procedure/calibration records remain open. Missing information is an evaluation finding; unrelated drafts were still generated.

Two candidate-routing issues found in the local preparation run were corrected before the live run: “gauge hatch” no longer counts as test equipment, and actual captured repair/coating recommendations now also reach the summary. These rules are covered by tests with alternative identifiers.

The preliminary `evaluation-12-preview` folder is superseded by `evaluation-12-live`; it predates those corrections and final viewer reporting fixes.

## Verification

- The focused generic-outline audit passes: multilabel routing, alternate IDs, unit conflicts, source integrity, proposed actions, no-AI regime and shared compilation.
- Five artifact tests pass, including altered/missing media, missing geometry and invalid anchor refusal.
- Report-platform standard guardrails pass, including build, generation, storage, leakage and API audits.
- The existing 32-section regression evaluation reports 5 pass / 27 review / 0 fail with zero leakage hits. These are separate regression results, not scores for this 12-section run.
- Desktop and mobile browser review confirms original photographs and three maps load. The evaluation viewer uses wrapping for long identifiers; it does not modify the generated section bodies.
- Existing-UI integration: all twelve sections navigate successfully, both historical references can be selected, original PDF access requires administrator authentication, two real photos and three maps load, and browser checks observe zero generation calls or promotion controls. All 24 section/reference combinations pass the backend audit.

## Reproduction

From the repository root:

```sh
npm --prefix apps/report-platform run evaluation:generic:audit
npm --prefix apps/report-platform run evaluation:generic:run -- \
  --input-dir apps/report-platform/docs/reviews/data/syn025-current-only-v3 \
  --output-dir /tmp/syn025-generic-evaluation-new \
  --prepare-requests
```

Omit `--prepare-requests` for deterministic local compilation, or use `--live`
for the configured worker. Every run requires a new output directory. The live
run used the user's existing approval for the OpenAI worker; the separate
storage upload/import remains outside this evaluation.

Next evaluation work is to review the raw AI statements for semantic preservation, separate paraphrase uncertainty from actual critical-field loss, and implement the missing section-format behavior through the shared formatter. Use an independently reviewed expectation set before claiming recovery improvements.
