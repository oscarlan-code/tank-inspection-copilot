# Report-generation evaluation

## Purpose

Evaluation qualifies the exact pipeline intended for product use. It tests structure
planning, evidence interpretation/routing, individual section agents,
recommendation proposals, report integration, and rendered output separately.
Evaluation cannot change product routing or drafts.

## Parity rule

Every participating agent is additionally bound to an immutable execution-configuration snapshot. The snapshot versions the model and its settings separately from the prompt artifact, knowledge snapshots, schemas, code commit and evaluator rubric. Deterministic agents explicitly record model and prompt as disabled. Mutable aliases are invalid evaluation inputs.

Product and evaluation execute identical pinned:

- normalizer and entity resolver;
- terminology/glossary pack;
- Report Structure Agent and ReportPlan rules;
- SectionPlans and Section Generation Agent releases;
- historical and standard knowledge packs;
- deterministic tools, validators, formatter, integrator, and renderer;
- model/provider settings for declared narrative slots.

Before either sink, the same exact pre-display Section Review Agent checks current
evidence, format and knowledge boundaries without gold. Only `ready_for_review`
drafts may be presented, and they remain unapproved. After generation, evaluation
opens sealed expected data for a separately versioned gold evaluator; product saves
the guarded unapproved draft for inspector review.

## Independent dimensions

| Dimension | Question |
| --- | --- |
| Current evidence | Were captured facts, values, units, polarity, entities, relationships, rows, and photos preserved? |
| Historical practice | Did the output follow a compatible reviewed structure/format without copying same-case gold? |
| Standard obligations | Were applicable requirements for the pinned edition satisfied or visibly unresolved? |

A strong score in one dimension cannot hide a failure in another.

## Test levels

### Multi-report knowledge qualification

Before selecting evaluation cases, consolidate each section's general outline,
conditional variation, accepted headings, formats, terminology and narrative patterns
from a disjoint approved knowledge-reference corpus. One report cannot define the
generic section. The initial Section 4 gate requires at least ten compatible unique
lineages plus reviewed coverage saturation.

Freeze one SectionKnowledgeBundle with separate projections for structure planning,
mock preparation, generation, pre-display review and post-generation evaluation. All
roles pin the same bundle ID and hash. Evaluation lineages, target reports, alternate
renditions, near-duplicates, validation and held-out reports are excluded from the
bundle. Standards remain a separate authority.

### Source-to-mock qualification

Before a historical section can seed an evaluation case, decompose the complete
section into source obligations. Every source unit must retain its page/block
provenance and receive one reviewed disposition:

- current fact required from the app or confirmed report-side input;
- deterministic content or calculation owned by a pinned tool;
- recommendation routed to the recommendation section;
- cross-reference that must resolve to an included artifact;
- boilerplate/metadata;
- target structure reference reserved for the sealed post-generation evaluator; or
- explicitly out of scope with a reviewed reason.

Source obligations are semantic units rather than arbitrary fixed-size chunks. The same frozen case records many-to-many links from source units to app evidence and from app evidence to generated claims. This produces two independent evaluations: original-report to mock-export fidelity, then mock-export to generated-section fidelity.

Freeze the obligation denominator before creating mock data. A mock export qualifies
only when every required current fact maps to current evidence, every deterministic
obligation has its required inputs, and every exclusion is reviewed. Coverage is
measured against the complete reviewed obligation set, never against the subset that
happened to be included in a mock export.

Structured facts may retain exact values, units, identifiers and geometry. Narrative
notes must be rewritten as realistic inspector capture and checked against the fixed
truth case; historical report sentences may not be used as mock voice text. Real
authorized report photos may be reused with provenance. All note variants for one
truth case remain in the same lineage split.

An infrastructure change to the obligation set, mock export, ReportPlan, normalizer,
reviewer, renderer or metrics invalidates the prior baseline. Restart at Candidate A;
do not call the changed system Candidate B.

### Structure planning

Given current scope plus reviewed packs, assess correct report family, standard
edition, section inclusion/exclusion, ordering, numbering, repeated sections,
dependencies, exact agent bindings, and visible blockers. The Structure Agent never
receives or authors gold section text.

### Evidence interpretation

Use several inspectors' varied notes for one expert-defined scenario. Assess entity
identity, condition, negation, severity/extent, uncertainty, original wording,
normalized terminology, source spans, and required clarification.

Run this track before section generation. All variants must recover the same reviewed
truth records or produce the expected clarification. Only the verified normalized
snapshot enters the generation track.

### Contents-classification qualification

Run the exact frozen Contents Classification release against the complete canonical
Android app export before section generation. Measure input/receipt integrity,
leakage rejection, protected-value and unit preservation, atom/source-span accuracy,
strict section accuracy, tolerant block accuracy, multi-label recall/precision,
observation/recommendation linkage, and clarification precision. Gold labels remain
behind the evaluator boundary. Unreviewed model proposals have zero influence on
section packages. Every retained record is classified, explicitly excluded, or held
in the blocking review queue.

After authorized review, validate the exact classifier binding, review seal,
package hash, section isolation, block index, and evidence hashes. The
`ready_for_section_agent_evaluation` state measures only this classification gate;
it is not a generation, pre-display review, inspector approval, or export outcome.
The archived Report Evidence Routing Agent is tested only for historical
reproducibility.

### Section generation and pre-display review

Run each frozen generator together with its exact independent reviewer release. The
reviewer receives the current evidence and generated result, never gold, and controls
only whether an unapproved draft is safe to display. Run each frozen release on
development, validation, and held-out lineage groups.
Measure protected-field preservation, required-concept recall, unsupported claims,
relationship errors, structure/format compliance, standard-obligation coverage,
missing-input behavior, and inspector edit/acceptance effort.

The pre-display reviewer must also verify that the ReportPlan follows the frozen
bundle's canonical blocks, applicability decisions, accepted headings, formats, order
constraints and deterministic/narrative ownership. A factual pass
over partial mock evidence is not a section-level pass.

### Post-generation gold evaluation

After generation and pre-display review complete, open the sealed original section.
A section-specific evaluator compares current evidence, generated content and the
original for semantic recovery, supported-claim precision and format alignment.
Exact wording is not a target. The evaluator cannot change visibility, approval or
promotion. Contract audits inject a local judge; the explicit live-LLM path requires
separate authorization for the disclosed evaluator-only content.

### Atomic claim and whole-section evaluation

The minimum matrix scores source-unit disposition coverage, required source-to-evidence coverage, generation evidence coverage, supported-claim precision and exact protected-fact accuracy. Calibrated semantic graders score meaning preservation. Whole-section format and coherence remain separate final assessments. A whole-section score cannot compensate for a failed atomic hard gate, and an unavailable semantic judge remains unavailable. The executable contract is under server/section-agents/evaluation-contracts/v1.

### All-agent monitoring and evaluation matrix

Every executed agent and deterministic control writes the shared
`section_agent_monitoring_v1` contract. It covers the classifier pathway, ReportPlan
orchestrator, section generator, pre-display reviewer, post-generation evaluator,
and later the Report Structure Agent and Report Integrator. The mock-data pipeline
uses the same contract in its own runs. Components that did not execute are marked
as not run or not applicable; they are never implied by a successful section draft.

Monitoring stores release and artifact hashes, evidence IDs and dispositions,
timestamps, bounded model/retrieval identifiers, decisions, warnings, and blockers.
It excludes raw report prose, prompts, secrets, and hidden model reasoning.

The evaluation matrix separates `hard_gate`, `quality`, and `diagnostic` rows. All
applicable hard gates must pass. An unavailable hard gate makes qualification
`incomplete`; a quality score cannot offset it. Run validity, pre-display
visibility, release qualification, and product promotion remain separate outcomes.

### Recommendations

Give with-KB and without-KB arms the same verified structured observation and
glossary. Exclude current recommendations from input. Score acceptable actions,
unacceptable actions, necessary questions, precedent applicability, and technical
justification separately. Matching a historical recommendation is not sufficient.

### Integrated report

Assess ToC/section consistency, cross-references, duplicate/conflicting facts,
styles, figures, pagination, browser/DOCX/PDF parity, approval staleness, security,
load, canary behavior, and rollback.

## Dataset and leakage rules

- Split by report/asset/scenario lineage, never by chunks alone.
- Keep source reports immutable; create new derived revisions.
- Exclude target report, same asset/scenario, alternate renditions, near-duplicates,
  validation/hidden sources, and post-cutoff evidence before retrieval.
- Generate realistic field notes; do not copy historical narrative into mock voice.
- Structured facts may preserve exact values and units.
- Use real authorized report photos for source-derived findings and keep provenance.
- Open expected reports/labels only after generation.
- Record every pack, source, exclusion, prompt/model, tool, validator, and release
  hash in the run trace.

## Outcome states

- `ready_for_review`: safe/useful draft with normal inspector refinement.
- `needs_attention`: materially incomplete or requiring substantial correction.
- `blocked`: protected data changed, relationships transferred incorrectly, hidden
  gold leaked, a critical unsupported claim appeared, or required authority is
  unresolved.

Report separate preparation and model outcomes. `mock_ready`, `interpretation_ready`
and `generation_ready` are prerequisites, not quality scores. A run with incomplete
source-obligation coverage is `invalid_evaluation`, even if every supplied evidence
record appears in the generated text.

Exact wording match is not a quality target. Recommended initial targets are 75–85%
semantic recovery, at least 80% required-concept recall, at least 90% narrative claim
precision and format readiness, and at least 99% protected critical-field and
relationship accuracy. Promotion requires zero critical integrity/leakage failures
and explicit inspector/domain review.

## Promotion gate

A release may enter canary only when its immutable manifest and dependency hashes
match the qualified evaluation, independent evidence/historical/standard gates pass,
rendered output is reviewed, known limitations are recorded, rollback is proven,
and an authorized server-side promotion record is created. Evaluation results,
model output, request flags, and app exports cannot promote anything.

## Mock-preparation sandbox

Editable mock-preparation agents live under
`server/mock-preparation-agent/sandbox/candidates/`. Generated request previews,
responses, Android staging packages, and evaluation runs live only in the private
`.local` corpus case. A candidate may move into `releases/` only after its complete
report evaluation, ProductStore round trip, independent source/PDF review, emulator
review, and case freeze pass. Promotion copies exact bytes and writes a release
manifest; promoted releases are never edited in place.

Delete sandbox run caches only after the promoted release manifest and Git commit
have been verified. Retain the compact qualification summary, independent-review
decision, source hash, case hash, and release hashes as audit evidence.

## Current result

Contents Classification evaluation v1 is the immutable promotion of candidate v10. Across development, independent validation and untouched hidden testing it produced zero wrong section routes; validation and hidden block accuracy were 95%. It remains evaluation-only, requires human review for every LLM proposal, and cannot produce generation-eligible packages until both section and block decisions are sealed. The exact release ID is `contents-classification-evaluation-v1`; mutable aliases are rejected.

The evaluation pathway now verifies the exact Android ProductStore export bytes and
receipt, applies the leakage guard, atomizes with v5, executes the registered
release, and creates an authorized human-review queue. Once every proposed route is
approved, corrected, or excluded, it projects section-isolated evidence packages
for section-agent evaluation. Those packages remain ineligible for product use.

General Tank Information v1 passed 16 behavior checks and preserved 341/341 fields
across ten development reports plus one previously held-out report. It remains
evaluation-only because the new ReportPlan/SectionPlan interface, structured
standard pack, rendered qualification, and product registry are not complete.

The TK5452 observed two-section run now records every actual agent in one trace:
router, two generators, two reviewers, and two post-generation evaluators, plus the
input, planning, and gold-access controls. The drafts are allowed for evaluation
review, but qualification is `incomplete`: the frozen Scope release does not
disposition all 19 projected records, and both gold evaluators are awaiting an
explicit semantic judge. No semantic quality score or 100% qualification is claimed.

Legacy 32-section and saved comparison results remain historical diagnostics; they
are not scores for the rebuilt pipeline or evidence that those agents exist.
