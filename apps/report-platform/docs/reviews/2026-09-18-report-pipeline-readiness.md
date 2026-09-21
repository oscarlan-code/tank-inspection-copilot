# Report-generation and evaluation consolidation review

The historical source collection should be preserved. Rebuild selected derived
data and evaluation packages, then validate the candidate through one controlled
path. The current evidence does **not** establish readiness to promote the new
report-generation agent.

This review used a repeatable-read, read-only PostgreSQL snapshot, the actual
generation entry points, local index metadata, the all-KB exposure audit and the
saved inspector-note run. It did not rebuild indexes, change source approvals,
reassign splits, call an AI worker or promote a policy. Source object references
were counted; every object/PDF page was not revalidated in this pass.

Machine-readable evidence and reproducible checks:
[snapshot](data/report-pipeline-readiness-2026-09-18.json),
[readiness table](data/report-pipeline-readiness-2026-09-18.md),
[read-only command](../../server/scripts/review-report-pipeline.mjs).

## What exists, and what it proves

| Layer | Verified current state | Decision |
| --- | --- | --- |
| Original-source KB | 166 document records, 162 distinct source hashes; 166 source object references; 162 approved and 4 rejected documents | Preserve originals, object identities, provenance and approval history. Approval is not independent content-quality certification. |
| Extracted content | 6,633 sections; 14,393 chunks; 22 chunks without page numbers | Reuse sound extraction. Reprocess damaged/flattened tables, missing page provenance, incorrect boundaries and conflicting identities selectively. |
| Governed training index | 112 reports, 69 asset lineages, 4,491 section references | Preserve registry grouping. Build a new section-filtered index revision before reuse. |
| Index eligibility defect | 1,798 referenced sections have `include_in_retrieval=false`: 937 are `evaluation_gold/pending_review`, 861 are `wording_precedent/approved` but excluded | The index builder selects all sections of an eligible report. Respect section-level inclusion and lane restrictions in the builder AND retriever. This observation alone does not prove these sections were retrieved in a run. |
| Legacy local indexes | Precedent: 38 documents / 2,550 chunks; recommendations: 416 pairs from 26 documents; both dated 20 August | Keep for reproducibility; they are separate from the 166-document KB and the 112-report index. Avoid treating them as a current unified KB. |
| Vector publication | 0 of 14,393 chunks have embeddings; KB document publication flags remain false | Do not claim live vector retrieval. Establish a tested lexical baseline first; embed only the approved frozen candidate index if retrieval evaluation supports it. |
| Standardized mock/gold pairs | 27,638 ready and 1,565 quarantined rows, all contract 1; current builder is contract 12 | Old ready labels and scores are legacy evidence. Rebuild selected cases under the current preparation contract, with an independent denominator. |
| Governed pilot pairs/runs | Pair revisions 1–10; frozen validation cohort: 20 sections from 18 reports; V18 has 20 completed validation episodes | These are older pilot contracts, not results for the new section-planned candidate. More variants are not more independent reports. |
| Current reconstruction | TK5452: 11/21 sections have inputs, ten have none; shell/findings still have calculation gaps; three AI responses remain unaccepted | Useful for debugging and formatting. It is neither complete nor an independent promotion benchmark. |
| Policy state | V1 production; V18 training; 3,258 stored rewards lack the metadata needed by current contract filters, so zero satisfy those filters | Preserve history. Do not backfill metadata to make incompatible scores promotable. |

## Blocking differences between evaluation and production

1. `generateSectionDraft` selects `generatePlannedSectionDraft` only when
   `executionMode === 'evaluation'` and a plan exists. Production takes the
   existing context/template/governed route. Sharing an entry point or helper
   does not establish training-serving parity.
2. The section-planned narrative prompt receives routed voice evidence and
   outline instructions. It does not receive a validated historical-guidance
   package. Legacy production retrieval uses the local precedent and
   recommendation indexes. The new demonstration therefore does not measure
   the benefit of the full historical KB.
3. Generic 25-template design, the 32-section compatibility profile and the
   TK5452 21-section display adapter coexist. They need one versioned profile
   selection/instance contract before promotion; report titles and formats must
   not be embedded as universal assumptions in mock preparation.
4. Input preservation, input completeness, routing correctness and semantic
   recovery are different checks. The shell omission passed preservation tests
   because the missing rows never entered the fixture. Freeze expected inputs
   before preparation/classification and compare against them at each boundary.
5. Current conservative semantic checks can leave a valid paraphrase
   unconfirmed. Add independent semantic review calibrated against human
   judgements; do not weaken measurement, entity or negation checks to raise scores.
6. The existing policy eligibility implementation filters training rewards.
   Contract filtering alone is insufficient: a future rollout must additionally
   require a frozen validation comparison, fresh held-out evidence, human
   review and export/serving parity. No promotion is authorized by this review.

## Use historical data through explicit knowledge lanes

| Knowledge | Useful contribution | Boundary |
| --- | --- | --- |
| Generic section outlines and formats | Which blocks belong in each of the 25 reusable templates; family-specific titles, table topology and optional instances | Retain source support and applicability. Apply only relevant sections; do not require all 25 for every inspection. |
| Professional writing examples | Organization, terminology and concise report style | Curate/de-identify patterns. Historical client names, readings and findings never become current facts. |
| Finding-to-recommendation knowledge | Conditional repair options and rationale tied to component/condition | Keep conditions, qualification and source. Inspector proposals and review remain explicit; historical repairs are not automatic current instructions. |
| Prior records for the same asset | Earlier measurements, repairs and history where identity and time are verified | Separate evidence lane with source date and an as-of cutoff. Missing history is allowed; the current gold report cannot supply it. |
| Standards and controlled boilerplate | Reviewed calculation methods and standard sections | Version and review independently of precedent. Historical reports are not technical-code authority. Maintenance regime stays deterministic/no AI. |
| Supporting project files | Real photos, drawings, UT spreadsheets, field sheets and specialist output | Investigate these before deriving mocks from final-report prose. Original contemporaneous records can support stronger input independence. Match task/asset/time and record uncertainty. |

The August filesystem inventory also lists supporting assets outside the loaded
KB. Its counts are historical, not a fresh inventory. Audit those attachments
by case before claiming the report corpus contains all available field evidence.

## Ordered work and acceptance criteria

| Order | Work | Deliverable / acceptance |
| --- | --- | --- |
| 1 | Freeze source/exposure inventory and define candidate scope | Versioned source, asset-lineage, revision and split manifest. Resolve the two cross-split exact-hash groups in a new snapshot; keep old assignments auditable. |
| 2 | Consolidate outlines, input requirements and source corrections | Map the 25 templates to report-family instances, formats and required/optional inputs. Repair the selected extraction defects and hold ambiguous source identities. |
| 3 | Complete a small representative native benchmark cohort | Full typed readings/checklists/maps/photo links; inspector-style notes; explicit report-side input; independent expected section/block obligations. Include complete, intentionally sparse, no-history and ambiguous/noisy-note cases. No invented photos. |
| 4 | Build an immutable candidate KB revision | Publish only reviewed, included lanes from training groups. Recheck tenant, lineage, source hash, split, time and section eligibility at retrieval. Store exact retrieved IDs and scores. Preserve the old index for reproduction. |
| 5 | Connect KB and unify the generation contract | App export → normalization → completeness/applicability → multi-section evidence roles → scoped guidance → deterministic content + bounded narrative → common document formatter. Same contract in candidate evaluation and production shadow runs. |
| 6 | Measure historical-KB benefit | Fixed captures/model/outline; compare no-KB, template/style KB, plus conditional recommendation guidance, plus eligible asset history. Start with local checks and a small cohort; scale paid runs only after input/isolation gates pass. |
| 7 | Validate and decide promotion | Freeze configuration; run unexposed groups/prospective captures once; blind section review, source-grounding checks, real export inspection and acceptance/edit effort. Record a separate human rollout decision and rollback candidate. |

Steps 1–3 precede new paid report-generation experiments. Corpus-wide reparsing,
embedding or mock regeneration is not the first action. Expand after a small
cohort proves correct source extraction, app-shaped materialization, routing,
formatting and semantic evaluation.

All 166 loaded sources informed structural design, including 20 validation and
14 hidden-test entries. Existing split labels cannot undo that exposure. Use
those cases for development/regression and identify untouched groups without
reading their answer content during selection, or collect prospective captures.
Report-derived rewritten notes remain a reconstruction track even after
paraphrasing; wording variation does not establish independent observations.

Measure separately: required-concept recovery, supported-claim precision,
protected value/unit/entity preservation, routing placement, format/export
readiness, missing-input handling, retrieval relevance, inspector acceptance
and edit effort. Aggregate by report/asset group, not by repeated variants.
Initial project targets are 75–85% semantic recovery, at least 80% required-concept
recall, 90% claim precision and format readiness, and at least 99% critical-field
and entity accuracy. Any critical fabricated/altered fact or hidden-answer
exposure blocks promotion regardless of averages. Missing measurements are input
defects; unavailable optional history is not a generator failure.

## Completed in this review

- Added `evaluation:readiness`, a read-only database/code/artifact snapshot command.
  `--strict` exits nonzero for blockers; a successful snapshot is not a passing
  promotion decision. No transactional migrations run in this command.
- Added negative checks for empty indexes, split overlap, excluded sections,
  legacy rewards, incomplete captures and unverified runtime parity.
- Updated the compiler/evaluation entry documentation to identify current
  paths and this recovery sequence. Original sources, labels, indexes, prior
  runs, production policy and drafts remain unchanged.

Full runtime consolidation, source corrections, candidate reindexing, benchmark
rebuilding, KB integration and promotion validation remain the ordered work
above. They are not claimed complete by the readiness command.

Verification: readiness negative checks and script syntax passed; the live
read-only snapshot completed and `--strict` returned the expected exit 2 for
nine blocked checks. Architecture/terminology, KB inventory, precedent retrieval,
fact-to-recommendation retrieval and PostgreSQL KB review workflow audits passed.
KB ingestion lint and all nine ingestion tests passed. These verify existing
behavior and the review tooling, not source accuracy or candidate report quality.
