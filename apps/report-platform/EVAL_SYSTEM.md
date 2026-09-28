# Report-generation evaluation

## Purpose

Evaluation qualifies the exact pipeline intended for product use. It tests structure
planning, evidence interpretation/routing, individual section agents,
recommendation proposals, report integration, and rendered output separately.
Evaluation cannot change product routing or drafts.

## Parity rule

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

### Structure planning

Given current scope plus reviewed packs, assess correct report family, standard
edition, section inclusion/exclusion, ordering, numbering, repeated sections,
dependencies, exact agent bindings, and visible blockers. The Structure Agent never
receives or authors gold section text.

### Evidence interpretation

Use several inspectors' varied notes for one expert-defined scenario. Assess entity
identity, condition, negation, severity/extent, uncertainty, original wording,
normalized terminology, source spans, and required clarification.

### Section generation and pre-display review

Run each frozen generator together with its exact independent reviewer release. The
reviewer receives the current evidence and generated result, never gold, and controls
only whether an unapproved draft is safe to display. Run each frozen release on
development, validation, and held-out lineage groups.
Measure protected-field preservation, required-concept recall, unsupported claims,
relationship errors, structure/format compliance, standard-obligation coverage,
missing-input behavior, and inspector edit/acceptance effort.

### Post-generation gold evaluation

After generation and pre-display review complete, open the sealed original section.
A section-specific evaluator compares current evidence, generated content and the
original for semantic recovery, supported-claim precision and format alignment.
Exact wording is not a target. The evaluator cannot change visibility, approval or
promotion. Contract audits inject a local judge; the explicit live-LLM path requires
separate authorization for the disclosed evaluator-only content.

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

## Current result

General Tank Information v1 passed 16 behavior checks and preserved 341/341 fields
across ten development reports plus one previously held-out report. It remains
evaluation-only because the new ReportPlan/SectionPlan interface, structured
standard pack, rendered qualification, and product registry are not complete.

Legacy 32-section and saved comparison results remain historical diagnostics; they
are not scores for the rebuilt pipeline or evidence that those agents exist.
