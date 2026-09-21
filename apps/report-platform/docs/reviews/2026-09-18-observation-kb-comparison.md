# Observation-to-recommendation comparison: 12 situations, with and without historical cases

Six explicitly approved live calls completed using `gpt-5.6-sol`, low reasoning
effort: three groups of four observations per arm, producing 24 saved outputs.
All 24 passed the limited identity, numeric-token, citation and review-status
checks. That is not a recommendation correctness score. Nothing was promoted.

[Open the existing Evaluation Lab through Tailscale](http://oscars-mac-mini.tailbd3a33.ts.net:4175/admin/evaluation?evaluationCaseId=eval-tk5452-kb-observations-v1-with-kb&sectionId=02-floor-projection).
Switch **Without historical cases / With historical cases** and select an
observation. The three columns show the original passages, generated observation
and proposed actions, and the actual processed app evidence. Historical cases
are labelled separately in the evidence column. The earlier writing comparison
and 21-section review remain available in **Evaluation run**.

## What changed from the writing comparison

- Current inputs contain observations only; seven explicit inspector action
  sentences in the source mock are not supplied to the recommendation worker.
- Physical identity, original wording, exact source spans and glossary revision
  survive preparation and worker projection. “Floor projection” remains that
  component in both outputs; a broad foundation checklist group does not replace it.
- The same 12 source-bound observation records feed both arms. Only historical
  cases differ. Three observations have no retrieved case in either arm.
- Seven source-checked observation/action candidates come from two eligible
  earlier reports, with passage provenance and explicit unknown implementation,
  outcome and unstated applicability. No expert approval is implied.
- Proposed actions, current observations, applicability, gaps, questions and
  confirmation requirements remain distinct. Historical precedent does not
  establish technical authority. All proposals remain unaccepted.

This is the new **evaluation candidate path**, not a replacement for the legacy
production route or a promoted report agent. The old saved run and request
hashes are unchanged. No full KB rebuild was performed.

## Findings

The benefit is mixed. Historical cases make several coating proposals more
specific and make applicability differences visible. They do not establish a
consistent improvement in action correctness. One flange-face proposal adds
a treatment that its broader flange-head precedent does not establish as
appropriate for the current surface. It needs specialist review.

| Observation | Difference with historical cases |
| --- | --- |
| Site piping | More explicit cleaning/preparation/recoating sequence; distinguishes historical fire-water piping from the current unspecified service. |
| Floor projection | Correct identity in both. Rejects the plinth-seal precedent because no seal condition is reported; cites no precedent for its action. |
| External shell | Source-linked coating sequence and explicit differences in location and available thickness assessment. |
| Shell nozzle S4 | No case retrieved. More explicit measurement questions in one output cannot be credited to case retrieval. |
| Roof plates / curb angle | More concrete treatment wording, but lists treatment before a separate assessment proposal; sequencing needs review. |
| Non-frangible roof | No case retrieved. Baseline explicitly mentions venting/overpressure; the other output is broader. No demonstrated KB benefit. |
| Roof manhole / nozzles | More concise treatment sequence; baseline makes assessment before coating more explicit. |
| Roof inlet flange | Concern: extends a flange-head coating precedent to a flange-face proposal, despite acknowledging missing acceptance information. |
| Roof bracket | Limited analogy from roof-nozzle coating failure to crevice attack; differences and unknowns are stated, but suitability remains unverified. |
| Tell-tales | Both ask what is noncompliant. KB adds specific possibilities as questions without claiming missing or plugged holes were observed. |
| Satisfactory ladder | Both propose no action. KB does not transfer the damaged-walkway repair to the ladder. |
| Sump / unavailable B-scan | No case retrieved. Both preserve dimensions, all supplied UT values and the access limitation; propose conditional coverage review. |

These findings are **Codex qualitative review**, not an independent inspector
assessment. The [per-observation assessment](data/tk5452-kb-observations-v1/assessment.json)
records the concerns without assigning an engineering correctness percentage.

| Descriptive count | Without historical cases | With historical cases |
| --- | ---: | ---: |
| Saved observation outputs | 12 | 12 |
| Limited mechanical checks passed | 12 | 12 |
| Observation text words | 332 | 346 |
| Proposed actions | 14 | 13 |
| Action text words | 297 | 289 |
| Explicit clarification questions | 2 | 4 |
| Observations whose proposals cite historical cases | 0 | 6 |

More actions or questions are not automatically better. Many missing-information
items occur in proposal fields rather than the question list. Length counts
above exclude applicability/provenance review notes from action text.

## Experimental limits and next change

These are 12 distinct situations from **one source-derived mock**, not 12
independent reports. The glossary and rubric are checked diagnostic candidates;
inspectors have not authored varied notes or approved the action rubric.
The 36 terminology string checks and two ambiguity checks establish local
contract behavior only, not interpretation or speech-recognition quality.

Four observations share each request. Differences on the three observations
with no cases can reflect model variation or other context in their batch;
they are not evidence of historical-retrieval benefit. There is one response
per condition and no statistical superiority claim.

Source filtering checked approval, section inclusion, dates, hashes and asset
lineage. Lexical near-duplicate checks compare selected source passages against
the target; they do not certify absence of semantic duplicates corpus-wide.
The target reference and rubric never entered the executed worker requests.

The next implementation priority is an applicability gate before composition:
mark component/function or damage-mechanism mismatches as unresolved, and keep
unsupported treatment extensions out of the proposed report wording. Review
the flange-face and roof-treatment examples with an inspector before expanding
the test to independent inspections. Do not change the saved results to hide
these findings.

## Reproduction and artifacts

- [Frozen observations](data/tk5452-kb-observations-v1/observations.json)
- [Historical case subset](data/tk5452-kb-observations-v1/historical-cases.json)
- [Exact six executed requests](data/tk5452-kb-observations-v1/live-request-preview.json)
- [Saved outputs](data/tk5452-kb-observations-v1/comparison.json)
- [Preflight checks](data/tk5452-kb-observations-v1/preflight-audit.json)
- [Draft evaluator-only rubric](data/tk5452-kb-observations-v1/evaluator-rubric.json)

From the app root, validate without generating:

```bash
node server/scripts/audit-kb-observation-comparison.mjs
node server/scripts/audit-kb-observation-review.mjs
```

The immutable source mock remains in `original-mock.json`. Preparation rejects
changes to frozen files; creating another experiment requires a new revision.
The runner caches exact request hashes and does not automatically retry.
Navigation only reads saved artifacts through the existing authenticated admin
API. It performs no generation, learning, approval or policy mutation.

Verification passed: new input/request/source-binding and saved-review audits,
old comparison and shared-generator regressions, standard project guardrails,
KB retrieval/recommendation/review/ingestion audits, and report performance checks.
Browser verification through Tailscale covered both arms, observation navigation,
three columns, the visible applicability concern and absence of horizontal
overflow. UI navigation loaded saved results without another worker call.
