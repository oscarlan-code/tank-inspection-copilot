# Mock preparation and evaluation contract v2

Status: target preparation contract with initial compiler/evaluator integration,
17 September 2026. The shared section planner, native generation and conservative
section-obligation evaluator are implemented in this checkout. The historical
datasets have not been rebuilt, and new independently reviewed native benchmark
packages remain preparation work. No learning or policy promotion is authorized.

This design addresses the [pipeline audit](../reviews/2026-09-17-generation-pipeline-audit.md).
The [report compiler workflow](../../REPORT_COMPILER_WORKFLOW.md) owns the
common architecture. Its [SectionPlan schema](section-plan-v2.schema.json) and
[section catalog](report-section-contracts-v1.md) own canonical evidence types,
routing, and placement. This document owns preparation provenance, independent
expected-output obligations, evaluation, and migration acceptance. Definitions
below are requirements for those contracts, not a second import schema.

For the generic 25-template evaluation candidate, the
[mock input preparation matrix](mock-input-matrix-v1.md) covers all 89 outline
blocks, and the [worked example](mock-input-worked-example-v1.md) specifies
synthetic voice inputs and proposed expected uses. These are preparation designs,
not newly captured packages or independently approved benchmark labels.
Applicable earlier same-asset history is an optional, separately attributed
input in the operational-history track; the same-case final report/hidden answer
remains evaluator-only. Absence of history does not block unrelated current
inspection evidence.

Shared types are `EvidenceRecord`, `EvidenceUse`, `OutputObligation`,
`SectionPlan`, and `ReportDocument`. Accepted `EvidenceUse` roles are
`required_narrative`, `required_structured`, `supporting`, and `cross_reference`.
Metadata stays on its typed record; unresolved records remain in the review
inbox and cannot become an accepted evidence use. Preserve `inputPackageHash`
and `contractVersions` throughout the trace.

## Current implementation boundary

- The TK5452 inspector-note diagnostic now separates input availability from
  generation success. Its shell mock requires all 40 readings at eight distinct
  course/direction locations before preparation passes. Per-section missing and
  partial input states remain visible in the three-column review. Known input
  gaps block affected-section and whole-report live runs; saved-response replay
  remains available. An explicitly scoped experiment on complete sections may
  proceed with the remaining gaps declared, as in the two-section writing pilot.
  This case-specific check is not whole-corpus completeness certification.
- Shell min/mean/max summaries are deterministic calculations with source-cell
  references. Raw app-shaped capture rows remain immutable and visible. Cached
  narrative responses may be rebound after a package hash changes only when
  all worker-visible input except evidence IDs is byte-equivalent after parsing;
  changed wording, entities, components, order, schema or instructions reject reuse.
- `section_planning_v1` classifies native records and retains ambiguous legacy
  captures for review. Both explicit answer-exposure flags and nested
  `value.sourceRole: gold_derived_synthetic_capture` prevent ordinary admission
  through a reviewer section label.
- `section_planned_generation_v2` compiles required native records, preserves
  no-voice findings/manual confirmations and drafts only routed voice content.
  Supporting records do not become an evidence appendix.
- `section_plan_evaluation_v2` distinguishes omissions, unit/value/entity errors,
  contradictions, and unavailable verification. Artifact checks require source
  bindings; the presence of a figure heading is not proof of figure fidelity.
- Results using `frozen_section_requirements` are **Planning diagnostic —
  benchmark labels await review**. Only independently reviewed
  `independent_expected_obligations` can assess whether routing omitted something
  from the production plan. A new percentage does not repair the old 5452 labels.
- `run-governed-rag-training-pilot.mjs` now provides
  `native_section_plan_diagnostic_v1`: a preserved legacy diagnostic with strict
  native-package preflight followed by the previous shared generator, with
  evaluator-only reference access. Legacy generic
  `appRecords` are rejected. These frozen diagnostic episodes return no reward
  and do not update learning or promotion evidence.
- Migration 051 persists immutable plan/decision/document revisions. This does
  not certify or migrate the old source/capture corpus. A real app export and
  independently reviewed expected obligations are still needed before claiming
  observation-to-report benchmark quality.

Focused module tests and the client build passed during implementation. Full
integration gates, final browser checks and staging refresh are separate
handoff checks; no complete benchmark or fleet-wide quality claim is made here.
Historical runs retain their saved contract versions; current module versions
do not retroactively change their validity or scores.

## Separate interpretation and recommendation experiments

Agreed design, 18 September 2026; these two experiments have not been run.
The completed four-call TK5452 comparison tests curated writing patterns only.
Its qualitative review does not establish interpretation, action suitability
or generalization. These experiment axes are independent of the provenance
tracks below: paraphrasing a historical report remains reconstruction.

A subsequent [12-observation reconstruction diagnostic](../reviews/2026-09-18-observation-kb-comparison.md)
ran the observation-to-proposal candidate in six approved calls. It uses checked
source bindings and a draft rubric, not expert-approved observations or an
independent inspector benchmark. Its terminology checks are authored string
variants, not the interpretation experiment below. The two reviewed experiments
therefore remain pending; the diagnostic results must not be relabelled as them.

| Experiment | Shared input and controls | Only changed factor | What it measures |
| --- | --- | --- | --- |
| Interpretation | Fixed expert-defined scenario, inspector-authored note variants, processor/model/configuration, hidden expected identities and meanings | Approved glossary/alias/relationship assistance on or off | Physical identity preservation, meaning, uncertainty and appropriate clarification |
| Recommendation | Identical reviewed structured observations and source context, shared glossary/processor, model, instructions, writing guidance, output schema and checks | Eligible historical-case retrieval on or off | Appropriate proposed actions and identification of missing information |

### Interpretation protocol

1. An inspector/expert defines the scenario and expected component identities,
   relationships, values, negation and uncertainty before outputs are seen.
   Inspectors express the same scenario as practical notes with varied phrasing,
   abbreviations, order and explicit or contextual subjects. Store original
   wording and exact source spans; do not replace them with normalized labels.
2. Freeze paired note inputs. Use the approved glossary only in its assigned
   arm; historical recommendation retrieval stays off in both. Alias and
   relationship entries contain terminology, not scenario answers or actions.
3. Test incomplete, ambiguous and conflicting notes as separately labelled
   variants. Their expected result may be a question or unresolved identity;
   they must not be scored as equivalent complete observations. Synthetic text
   variants do not establish speech-recognition or accent robustness; that
   requires a separate audio/transcription evaluation.
4. Check identity and context survival at every processing boundary as well as
   final interpretation. Score values/units, relationships, negation, uncertainty,
   unsupported resolution and necessary clarification separately. A fluent
   paraphrase with the wrong physical component fails identity preservation.
5. Keep scenario/asset lineages and inspectors separate where generalization is
   claimed. Aggregate by scenario; many paraphrases of one case are not many
   independent inspections. Expert review status and unresolved disagreements
   remain explicit.

### Recommendation protocol

1. Freeze and hash one expert-verified observation bundle for both arms. Include
   the component identity and supporting source spans under the
   [identity contract](../../REPORT_COMPILER_WORKFLOW.md#component-identity-preservation-contract).
   Do not independently re-extract observations for each arm. Pin the shared
   glossary, processing, model, prompt template, style/standards guidance,
   output schema and validators; only historical-case access differs.
2. Withhold the scenario's recommended actions and evaluator labels from every
   generator-visible field, preparation hint, glossary entry and retrieval
   source. If the raw note contains an action, prepare an explicitly labelled
   observation-only experimental input with its own hash; keep the raw source
   immutable. Both arms may propose actions, alternatives or questions, with
   proposals clearly separated from current observed facts.
3. Exclude the source report, alternate renditions/revisions, near-duplicates,
   held-out asset/scenario lineage, and hidden/validation material from all
   case indexes and derived pairs. Record source hashes, eligibility decisions
   and retrieval results; enforce tenant and as-of-date constraints. A different
   filename or job number is not proof of independence. Same-asset history is
   a separate operational-history experiment.
4. Use the [knowledge-pack contract](../contracts/knowledge/KNOWLEDGE_PACKS.md).
   Missing rationale, severity, applicability, implementation or outcome stays
   explicitly unknown. Source assertions and expert-added conditions have
   separate provenance. Retrieval similarity is not technical justification.
5. Before seeing outputs, an inspector defines acceptable actions/alternatives,
   unacceptable actions, required clarification questions and applicable
   constraints. Store reviewer, version and review status. Matching the old
   report recommendation alone is not correctness; disagreement with that
   wording alone is not failure. Unreviewed labels remain diagnostic.
6. Review paired outputs with arm labels concealed where practical. Score action
   appropriateness, unsupported or unsuitable actions, necessary questions,
   appropriate abstention, source/applicability traceability and inspector edit
   effort separately. Report sample size and reviewer disagreement; do not
   turn a one- or two-section pilot into a promotion claim.

Implement and validate component/context preservation first, then prepare a
small reviewed case subset and independent rubrics. Preserve the existing KB
sources and completed pilot; broad re-extraction or additional live generation
is not required to agree this design.

## 1. Outcome and invariants

A benchmark must answer three separate questions: what evidence was captured,
what a report should express from that evidence, and whether the produced
report expresses it correctly. Historical report resemblance answers a
different question and remains diagnostic.

The same authenticated import and canonical evidence pipeline serves real app
packages and mock packages. Mock preparation may vary capture completeness,
order, wording, and reviewed noise; it must not create a private generation
path or preserve data only in a synthetic text field that native app records
cannot represent.

Required invariants:

1. A current field observation has inspectable field-source provenance. Final
   report text cannot become a field observation by renaming it “Inspector
   observation,” “voice note,” or “recommendation.”
2. Source extraction, capability to observe, capture availability, and required
   report placement are distinct decisions with separate evidence.
3. Every required output obligation has an ID and expected evidence binding
   fixed before generation. A routing failure cannot shrink its denominator.
4. Structured values, calculations, tables, maps, and their relationships are
   rendered by deterministic tools. The LLM receives a scoped prose task; it
   does not decide which evidence is required or manufacture numeric results.
5. Supporting records are available to controlled tools and reviewers, but are
   not appended to narrative to earn recovery points. A reviewed summary can
   be required without reproducing every supporting row.
6. Missing information, contradictory information, wrong entity bindings,
   unavailable checks, and poor presentation have separate outcomes.
7. New stages can add blockers. A high content score cannot clear an existing
   evidence, generation, required-input, authorization, or export blocker.
8. Source, capture, obligation, generation, evaluation, and renderer revisions
   are immutable. Diagnostic runs never update learning or promotion evidence.

## 2. Benchmark tracks and trust boundary

Track is an immutable property of the case and run, not a display filter.

| Track | Permitted input origin | What the result can establish | Exclusions |
| --- | --- | --- | --- |
| Observation-to-report | Real app package or independently recorded inspection evidence, transcribed with reviewed source bindings | Preparation, routing, factual recovery, composition, and export from field evidence | Same-case final report facts, wording, and conclusions cannot supply missing inputs |
| Independent synthetic inspection | Authored synthetic inspection records, with expectations established from those records before output generation | Controlled contract and failure-case behavior | No claim of real field capture or independent historical recovery |
| Historical reconstruction fixture | Explicitly source-derived records, including facts or wording from an issued report | Parsing, rendering, preservation, and controlled reconstruction | Excluded from observation-to-report quality, held-out generalization, learning, and promotion aggregates |

An issued report alone does not establish what the inspector originally
captured. If only that report exists, the case belongs to reconstruction unless
independent input artifacts are obtained. Fact extraction from a gold report
is still gold-derived when converted to JSON, paraphrased, or transcribed into
audio. A separately voiced version of a historical conclusion is not an
independent observation.

Reconstruction remains useful, but its UI, manifest, and result must explicitly
identify source-derived inputs and their limits. Its target must not be
described as unseen. Existing gold-derived captures must retain that provenance;
their labels cannot be silently changed to qualify for another track.

| Artifact | Preparation and human review | Import/generator | Evaluator after generation | Learning consumer |
| --- | --- | --- | --- | --- |
| Raw field artifacts/current app export | Read | Approved captured projection only | Read scoped snapshot | No raw content |
| Historical final report/hidden target | Truth Case reference review only | Denied for observation-to-report | Read | No raw content |
| Reviewed full Truth Case | Read | Denied as a whole | Read | No raw content |
| Capture Variant | Build/read | Captured canonical records only | Read | Categorical context only |
| Evaluator-only expected obligations and withheld values | Review separately | Denied | Read | Aggregate metrics only |
| Production output obligations from approved section requirements | Inspect | Read scoped requirements | Compare with independent expectations | No raw content |
| `SectionPlan` | Inspect | Read scoped evidence uses | Read actual routing trace | No raw content |
| Generated artifact and evaluation | Review | Output only | Score | Eligible metrics only |

Preparation must log transitive source lineage, not just whether the final
target was directly visible to the scenario builder. This rejects the existing
combination of “target not visible” and intermediate gold-derived observations
as proof of isolation.

## 3. Truth Case extraction and approval

### Source manifest

Each source revision records its logical inspection/case identity, asset
lineage, source class, origin, issued/captured time where known, object checksum,
rendition identity, and extraction version. Source classes distinguish app
exports, original field notes/audio/photos, raw measurement sheets, reviewed
manual inputs, issued reports, and external guidance. Missing source dates or
uncertain relationships are explicit review issues.

Every extracted assertion preserves:

- Original text/symbols and normalized value separately; unit normalization
  must never overwrite the original transcription.
- Source object/rendition and checksum; page plus bounding box or stable line
  range for documents; record path for app exports; time span for audio.
- The explicit parent section and subordinate heading path, with start/end
  boundaries and boundary confidence. A page is not itself a section boundary.
- Entity/component identity, location, observation identity, and links to
  related measurements, photographs, and findings, including unresolved links.
- Extraction method, transformation history, reviewer, and disposition.

Tables retain table identity, row identity/order, cell identity, column key and
heading, raw cell text, typed value, unit, qualifiers, merged-cell relationships,
footnotes, and entity/location bindings. A whole table in `{text: ...}` is not
equivalent to native typed rows. A nonnumeric cell remains an explicit symbol,
selection, missing value, or unresolved value; it must not become a silent
numeric null.

Repeated statements on different components remain different observations.
Deduplication requires matching provenance and entity identity, not merely
matching words. Headings, legends, drawing metadata, limitations, calculations,
and findings are not all flattened into one “fact” type.

### Review gates

Approval is a recorded decision against the exact source and extraction
revision. Bulk actions may acknowledge reviewed items, but a machine proposal
cannot become verified merely because its parent case was approved. Critical
units, component relationships, table structure, source section boundaries,
and gold/input lineage require an explicit review disposition.

Unit corrections require corroborating source evidence. For example, a PDF
showing `3”` while its extraction says `3 '` produces a new transcription
revision, retaining both values and the reviewer/source span. If the only
corroboration is the hidden final report, it can repair the reconstruction
fixture or evaluator reference; it cannot silently improve an
observation-to-report capture. An independently supplied inspector correction
is a new manual-input revision, with its actual source recorded.

Ambiguous parent sections, mixed entities, fragments without a subject,
conflicting units, and unresolved table headers remain unresolved. They cannot
be approved as complete narrative findings or mapped confidently by carrying
the last heading forward indefinitely.

## 4. Answerability and Capture Variants

### Required inspector-note preparation rule (18 September 2026)

For report-derived reconstruction mocks, retain original structured facts:
client/asset identity, dimensions, units, ordered readings and checklist choices.
Do not paste issued-report sentences into narrative or voice fields. Author
practical inspection notes from the facts: terse observations, natural dictation,
component/location context, reading summaries, limitations and proposed actions.
Change sentence structure, ordering and capture grouping; synonym substitution
inside the same finished report paragraph is insufficient.

Preserve severity, negation, uncertainty, access limitations, measurement/entity
relationships and recommendations actually supported by the source. Do not invent
an observation, performed test, recommendation or repair completion to enrich the
mock. Keep recommendations as proposed actions. One capture can contain facts
needed in several report sections; the backend derives those destinations from
the exported app context, not report-section IDs inserted into the mock.

Check every narrative input channel, including written findings and task text,
for copied sentences and long shared phrases before a paid generation call.
Exact factual terms and structured values are allowed. A copy detector is a
review gate, not proof of semantic independence. Record the transformation and
expected facts in an evaluator-only ledger; keep that ledger and the original
report outside generator inputs. Values missing from the native export need an
explicit report-side input or a missing-input status, never silent plan injection.

Score recovery of independently reviewed facts rather than historical wording
or output IDs. Preserve the reconstruction label even after rewriting: changing
the voice style does not make report-derived facts independent field evidence.
Maintenance regime uses an approved standard template without AI. Real-report
photo provenance rules remain unchanged.

The [TK5452 revision 2 mock](../reviews/data/tk5452-inspector-notes-v2/README.md)
implements this wording rule for the 74 selected entries from the earlier run.
It is a preparation artifact, not a completed or independently approved benchmark.

The Truth Case describes what could be established from identified evidence.
A Capture Variant describes what was actually supplied in one test condition.
The following dimensions must not collapse into one label:

| Dimension | Required distinction |
| --- | --- |
| Source fidelity | Verified, unresolved, conflicting, rejected extraction |
| Evidence capability | Direct field observation, structured capture, reviewed manual input, registered deterministic derivation, unavailable from permitted sources, or unresolved |
| Variant availability | Captured, intentionally omitted, source unavailable, rejected transformation, or awaiting clarification |
| Reporting use | Required narrative finding, required deterministic content, supporting evidence, metadata, or not applicable to the chosen report |
| Criticality/issuance rule | Consequence of alteration, contradiction, or omission; independent of availability |

An observable width or rust finding stays observable when a sparse capture
profile omits it. Its omission reason is `intentionally omitted`; it does not
become intrinsically unobservable. Conversely, a historical engineering
conclusion does not become field-observable merely because its wording appears
in a final report.

Every variant freezes the selected assertion IDs, source revisions, permitted
transformation per record, omission reasons, random seed, transformation
version, and expected representability in the app contract. Noise scenarios
must declare whether they vary wording/order, omit a value, or introduce an
explicitly unresolved transcription. They cannot change verified measurements
or entity bindings while still claiming exact-capture preservation.

Capture completeness is measured before generation. A withheld fact is visible
only to preparation/evaluation, never as an implied value for the generator.
Negative observations such as “no corrosion observed” are actual captured
claims; an absent observation is not evidence that the component was sound.

## 5. One import boundary and meaningful parity

Both real and mock flows enter through the supported app export, authenticated
object upload, checksum/contract validation, immutable inspection revision,
normal import adapter, and canonical evidence representation. Training artifacts
remain isolated from customer inboxes, operational analytics, and ordinary KB
publication; this isolation does not justify a different generation path.

The mock materializer must produce records supported by the real app schema:
typed UT rows, checklist selections, entities, findings, voice metadata,
attachments, units, and links. `captureFacts` may carry test provenance, but
must not be the only place substantive evidence survives when the real app
uses native records. The import adapter cannot substitute a private
gold-derived text store for empty native arrays.

A headless exporter qualifies only after comparison with an app-produced
export of the same scenario and normal import of both. Parity evidence has
three layers:

1. **Transport:** identical payload when deterministic, or an explicit allowlist
   for volatile metadata such as export timestamps. Preserve a comparison
   record; do not discard entire metadata objects to obtain equality.
2. **Canonical semantics:** equal record/cardinality, typed cells, units,
   entity/location identities, relationships, voice context, attachment links,
   and missing/uncertain statuses after import. Map generated IDs by stable
   provenance keys; do not erase their relationships.
3. **Generation/evaluation:** identical canonical evidence snapshot and
   `SectionPlan` inputs produce the same deterministic blocks, scoped prompt
   evidence, obligations, and evaluator configuration on real and mock routes.

Parity also checks against the scenario's expected nonempty records. Two
exporters producing empty arrays are not a pass when the scenario contains UT
measurements. Native packages containing zero synthetic `captureFacts` are a
mandatory case. The same canonical compiler runs for success, no-voice,
deterministic fallback, and model-failure outcomes; unsupported branches expose
a blocker instead of switching to a raw evidence dump.

## 6. Independent expected obligations and `SectionPlan` checks

The expected-output manifest is an evaluator-only, reviewed artifact. It is
derived from the report template/content contract, permitted captured evidence,
and source-reviewed reporting decisions. It is frozen before routing and
generation. It is **not** inferred from the generated text, from which facts
the classifier happened to select, or from the model's own claim list.
Production `OutputObligation` instances come from approved section requirements
and current canonical evidence independently of accepted routing assignments.
Benchmark expectations use the same obligation semantics but a separately
reviewed manifest; a shared faulty classifier cannot author both its own output
and its supposed independent answer key.

Each obligation must identify:

- Stable obligation ID and revision, independent of an output/model/run ID.
- Supporting assertion IDs and entity/observation relationship constraints.
- Reporting role and requiredness, plus any independent issuance requirement.
- Expected target section or reviewed set of permissible placements; source
  section and report target are separate fields.
- Expected representation: finding/prose concept, labelled value, typed table
  row/cell, figure/link, deterministic result, or explicit unresolved status.
- Applicability and availability preconditions evaluated against the frozen
  capture, with reasons for excluded or unresolved obligations.
- Matching rule, tolerances/conversions if applicable, severity, and reviewer.

The production `SectionPlan` contains accepted typed evidence uses with roles
`required_narrative`, `required_structured`, `supporting`, and `cross_reference`.
Unresolved evidence stays in the review inbox, with its corresponding unresolved
obligation retained. Its obligation references are traceability links.
Production does not receive hidden benchmark expectation text. Evaluation
compares the actual plan to the independent manifest to detect missing routing,
misrouting, over-inclusion, and duplication before judging the written output.

An in-scope finding dropped by routing remains an unsatisfied obligation. A
supporting table remains outside narrative recovery even if accidentally routed
into the narrative. Removing that table from narrative cannot lower recall.
Required summary outputs may depend on table cells without reproducing the
entire table. For example, a required reviewed thickness range belongs to a
deterministic summary block with input row IDs, not an unconstrained LLM
calculation. Whether corrosion summaries belong in an inspection narrative or
a calculation section is defined by the chosen report contract and reviewed
placements, not a blanket keyword rule.

For repeated values on multiple components, obligations remain separate and
must match their own component/observation. One occurrence of `6 mm` cannot
satisfy all `6 mm` obligations. A fact can support multiple report uses, but
deduplicated report coverage counts the underlying assertion once, while
section-placement coverage counts the required placements separately.

The source-reviewed 5452 manifest must be created before reporting a corrected
recovery percentage. Its recorded 34/88 figure must not be relabelled as a v2
score, and the old source-heading labels cannot determine its new denominator.

## 7. Evaluation dimensions and dispositions

Every metric reports numerator, denominator, applicability, exclusions, and
the contributing obligation/assertion IDs. Zero denominator means unavailable,
never 100%. Avoid a single score that hides correctness or completeness.

| Dimension | Numerator / denominator and interpretation |
| --- | --- |
| Capture completeness | Permitted source assertions captured / reviewed assertions observable for this report; separate intentionally omitted and unavailable-source counts |
| Routing coverage | Applicable required obligations with a valid actual plan use / all applicable required obligations; independent denominator catches routing loss |
| Section output recovery | Correctly satisfied required obligations in an allowed section / applicable, available required obligations for that section |
| Report recovery | Distinct correctly represented required assertions / applicable, available required assertions for the selected report scope; cross-section duplication cannot inflate it |
| Placement fidelity | Correct required placements / expected placements; report-wide presence does not excuse wrong-section content |
| Rendered value fidelity | Correct emitted typed values and units, bound to their entities and qualifiers / emitted verifiable value claims; omissions are counted separately |
| Entity/relationship accuracy | Correct evaluated entity, location, finding, measurement, and attachment bindings / evaluated bindings; absent required bindings also appear under completeness |
| Contradictions and unsupported claims | Explicit counts and IDs for altered values, negated/reversed findings, transferred relationships, invented claims, and unsupported conclusions |
| Current-evidence usefulness | Calibrated semantic completeness/readability review against scoped evidence uses and required concepts, with supporting-only records identified as such |
| Presentation/export readiness | Structural checks plus verification of the actual rendered artifact; no substitution by historical paragraph or bullet counts |
| Historical comparison | Meaning/coverage against the final historical section; diagnostic, outside current-evidence recall, readiness, learning reward, and promotion |

Matching preserves sign, unit, component, location, time/context, qualifiers,
and semantic polarity. Approved unit conversion uses registered deterministic
conversion logic with a stored trace and specified tolerance. Numeric
substring matches, global bag-of-words coverage, or finding both numbers
somewhere in the document cannot establish satisfaction. Min/max/average are
different predicates even when values match. A safe unresolved finding may be
shown in the review queue without masquerading as finished client prose.

Claim checking considers the **actual produced text and artifact** as well as
the model's declared bindings. Structured outputs are traced to their compiler
records; narrative claims are checked against permitted evidence. A model's
assertion that it used a fact is not proof that its sentence preserved meaning.

Semantic judges receive current scoped evidence, reporting roles, and current
obligations appropriate to judging that scope. Hidden target comparison runs
separately after generation. Judge failure is recorded as unavailable;
deterministic correctness checks remain, but a missing required quality review
cannot be replaced by gold similarity. Usefulness, uncertainty, and critical
contradictions are calibrated against human-reviewed examples before thresholds
are used to compare candidate behavior.

### Missing is not altered

An obligation has a primary disposition such as satisfied, omitted, incorrect
value/unit, incorrect relationship, contradicted, misplaced, unsupported, or
unresolved. Preserve multiple diagnostics when appropriate without counting
one defect twice in a single metric. An omitted optional supporting measurement
does not enter an alteration denominator and is not a protected mismatch.

A required missing finding reduces completeness and requires attention. If the
report contract prohibits issuance without it, that creates a distinct
issuance blocker. A changed critical value, wrong component binding, unsupported
safety claim, or leaked hidden content creates an integrity blocker. These
different reasons must remain visible to the inspector.

### Monotonic blockers

Maintain a structured blocker ledger with ID, category, owning stage, severity,
source/obligation references, and resolution requirements. All stages append
findings; only a recorded resolution based on new evidence or a validated
revision can close a blocker. Scoring cannot overwrite it.

The final disposition combines evidence/import validity, required inputs,
generation execution, claim integrity, completeness, presentation, and approval
requirements. Missing manual inspection dates, invalid native records,
generation failures, unresolved critical units, and export failures persist
even when every available content metric is high. `ready_for_review` describes
a safe useful draft, not approval for issuance. Human approval and required
export gates still apply.

## 8. Frozen runs, comparable cohorts, and learning isolation

Each run pins a manifest containing the benchmark track and split, source and
capture revision hashes, canonical evidence hash, report content contract,
expected obligation revision/hash, import/normalization and routing versions,
`SectionPlan` hash, deterministic compiler version, prompt/model/configuration,
retrieval snapshot/firewall, generation contract, evaluator/judge versions,
renderer/export versions, and selected report scope. Record live/fallback route
and failures explicitly. The configuration snapshot is not satisfied by a
policy version ID alone.

Run purpose is explicit: frozen diagnostic, eligible training, validation, or
sealed hidden test. Reconstruction is diagnostic only. Store purpose,
learning eligibility, and promotion-evidence eligibility independently; they
must not be inferred from whether a reward happens to be computable.

Frozen diagnostic, validation, and hidden runs cannot update training
aggregates, arm selection statistics, learned retrieval, or any optimization
state. Frozen diagnostics and reconstruction cannot count in promotion gates,
including raw reward queries, episode counts, or human-review counts. They may
retain diagnostic metrics with an exclusion reason. Do not store a misleading
`learning_eligible:true` for a run that policy forbids learning from.

Any future policy comparison must use the same pinned manifest/cohort and
matched baseline/candidate runs. Different contracts are separate experiments,
even if the report, model, or policy ID matches. Aggregate variants within a
Truth Case first, then macro-average independent cases; show worst-case and
critical-failure results. Case/variant duplication cannot weight one report
more heavily. Group logical cases, alternate renditions, and asset lineage
according to the declared split/benchmark track. Preserve the evidence-time
cutoff and same-case retrieval exclusions.

Sealed hidden outcomes must not be used for iterative prompt or policy tuning.
Opening them for development reclassifies that cohort's permitted future use;
preserve the original result and create new cohort membership rather than
pretending the test remains unseen. None of this proposal authorizes a policy
promotion or a new training run.

## 9. Review and rendered-export verification

The review screen shows the exact run and versions, input availability,
required/supporting uses, obligation dispositions, and separate capture,
generation, integrity, and formatting results. Inspectors can trace an omission
or changed value to its source span and expected report placement. Diagnostic
gold similarity cannot look like the overall generation score.

The ordinary browser preview and export consume the same typed document
representation. Renderer differences are verified explicitly; a page-shaped
HTML container is a section preview, not a PDF rendering. Counts of HTML
headings or table tags are structural smoke checks only.

For acceptance, export a selected, approved snapshot and inspect the actual
DOCX and its supported rendered rendition. If direct PDF export is unavailable,
state that limitation and retain the DOCX plus the named conversion/rendering
artifact used for QA. Do not claim direct PDF parity from an HTML screenshot.

Verify selected-section inclusion, unapproved-section exclusion, substantive
nonempty content, semantic headings, paragraph/list hierarchy, stable table
cell values/units/row order, merged cells, figure/attachment placement,
cross-references, page breaks, clipping, and legibility on later pages. Compare
content/obligation bindings before and after export. Blank headings and empty
tables cannot satisfy a section requirement or pass “clean export.”

## 10. Append-only migration and implementation stages

Do not rebuild existing baseline identities in place. Historical runs and
their old references, capture manifests, score definitions, and links remain
inspectable. Label them legacy and state limits; do not silently rescore them.

| Stage | Deliverable | Exit evidence |
| --- | --- | --- |
| A. Agree contracts | Common canonical evidence/`SectionPlan` contract and this preparation/evaluation contract | Reviewed reporting roles, target placements, absence behavior, and benchmark-track boundaries |
| B. Review representative sources | 5452, a different report layout, and a real native app package; include raw field artifacts where available | Approved source spans, units, tables, entity links, boundaries, provenance, and unresolved items |
| C. Create immutable v2 cases | New source/capture/obligation revisions, linked to legacy identities by explicit supersession metadata | No gold-derived field claims; reconstruction cases labelled; omissions and changes reviewable |
| D. Prove import parity | App-produced and headless versions through normal import, including native packages without synthetic facts | Expected nonempty typed records and relationships preserved; no private side channel |
| E. Prove routing/composition | One canonical route with reviewed expected obligations | No lost deterministic output, no raw appendix, explicit no-voice/fallback behavior, correct scope |
| F. Calibrate evaluator | One shared scorer/classifier and human-reviewed counterexamples | Missing/changed/contradicted/unsupported distinctions; independent denominator; blocker preservation |
| G. Verify export | Approved representative documents and rendered artifacts | Content and presentation checks on first and later pages; no unsupported export-readiness claims |
| H. Run a frozen evaluation | Version-pinned diagnostic cohort | Comparable case-level results with zero learning/promotion side effects |

Implementation migrations must produce dry-run inventories and new immutable
artifacts, with explicit links to their sources and superseded revisions.
Unresolved cases remain quarantined rather than guessed into ready status.
Consumer selection requires an exact supported contract version; no silent
fallback to an older pair when a new contract is absent. Reverting activation
selects the prior contract; it does not delete new audit records.

## 11. Representative acceptance matrix

These are acceptance specifications for the full preparation pipeline, not claims
that existing tests already pass. Fixtures must use the common import,
composition, and evaluator paths wherever the scenario exercises those paths.

| Case | Input/change | Required result |
| --- | --- | --- |
| Native app only | Valid native UT/checklist/findings/voice records, zero synthetic capture facts | Real data survives import and deterministic rendering; no empty replacement table |
| Mock/app parity | Same scenario exported by app and headless harness | Typed records, counts, links, plan inputs, and obligations match after declared volatile-field normalization |
| Flattened table | Multirow station table supplied only as text | Reject native-parity claim or require reviewed typed conversion; null readings cannot pass |
| Distinct identical findings | Same wording on roof and shell | Two source/observation identities and obligations survive |
| Sparse capture | Observable width deliberately withheld | Capture gap recorded; no invented width and no generation-recall penalty for absent input |
| Gold-derived observation | Historical sentence relabelled as voice | Observation-to-report track rejected; allowed only as labelled reconstruction |
| Optional numeric support | Sump depth supports another record but is not required narrative | Omitting it creates no alteration/mismatch or narrative-recall penalty |
| Required fact dropped by router | Required finding never enters actual `SectionPlan` | Independent obligation remains in denominator; routing failure and omission exposed |
| Misrouted B-scan detail | Measurement details sent to general narrative | Over-inclusion/placement defect; removing dump does not reduce required narrative recovery |
| Required calculation summary | Reviewed report contract requires thickness range/corrosion summary | Deterministic result with dependency trace appears in allowed section; no full table dump |
| Swapped components | Shell 6 mm and roof 8 mm become shell 8 mm and roof 6 mm | Entity/value integrity failure despite both numbers being present |
| Wrong unit | 3 inches becomes 3 feet | Alteration; no global numeric-match pass |
| Reviewed equivalent unit | Approved deterministic conversion is correctly rendered | Pass with trace/tolerance; no implicit model conversion |
| Negated finding | Satisfactory becomes not satisfactory | Contradiction; word overlap does not establish recovery |
| Required omission | Available required finding absent | Completeness failure; separate issuance blocker if declared; not a fabricated-value label |
| Unresolved fragment | “within 2 inches from weld:” lacks subject/result | Review queue/unresolved disposition; cannot be publication-ready prose |
| No voice | Structured findings exist without voice | Applicable deterministic report content survives; narrative requirements handled explicitly |
| Model failure | Scoped prose generation unavailable | Blocker/defined partial result; no raw evidence appendix fallback |
| Existing blocker | Missing required manual input plus perfect content scores | Blocker survives; score cannot mark section issuance-ready |
| Judge unavailable | Current-evidence semantic review fails | Unavailable recorded, required review incomplete; gold similarity cannot replace it |
| No applicable checks | No verifiable numeric claims or required obligations | Null/unavailable with counts, never 100% |
| Frozen diagnostic | Complete run with computable reward | Diagnostic metrics retained; no learning/statistics/promotion eligibility or updates |
| Contract mismatch | Same case run under different mapping/evaluator/generator versions | Separate experiment; excluded from a matched comparison |
| Export later pages | Long approved section with tables/figures and subsection headings | Rendered later pages preserve content/hierarchy and remain unclipped; no raw separators |
| Legacy 5452 | Existing run and newly reviewed v2 case | Old score/source/capture unchanged; new denominator justified by source review, not old labels |

Completion of these stages would make subsequent generation improvements
measurable. It would not, by itself, establish engineering approval of a report
or authorize changing the production policy.
