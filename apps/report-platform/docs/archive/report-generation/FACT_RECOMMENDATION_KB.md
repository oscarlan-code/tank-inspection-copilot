# Fact-To-Recommendation KB

The fact-to-recommendation KB stores historical observation/action candidates
for report generation. A historical recommendation is precedent, not proof of
technical suitability, implementation or a successful outcome.

It converts approved historical sample-report sections into structured pairs:

```text
source-linked observation + stated conditions -> historical recommendation
```

This is separate from the raw precedent KB.

## Current boundary and agreed design — 18 September 2026

The local 20 August index contains 416 candidate entries from 26 reports. The
current extractor often derives condition tags from the recommendation passage
itself; it does not establish a reviewed link to an independently extracted
observation. Its `confidence` is an extraction/ranking heuristic, not the
probability that an action is correct for a current inspection. Source retrieval
approval does not mean that every pair has expert approval.

The [two-section comparison](docs/reviews/2026-09-18-two-section-kb-comparison.md)
tested curated writing patterns only. It provides a small qualitative writing
result, not evidence of interpretation or recommendation-prediction quality.
The contracts below are the agreed evaluation target; they do not describe a
completed recommendation agent or authorize production promotion.

The subsequent [12-observation diagnostic](docs/reviews/2026-09-18-observation-kb-comparison.md)
implements a source-bound candidate path with seven checked historical cases,
withheld current recommendations and 24 paired outputs. It demonstrates the
record/prompt/review boundaries, not validated recommendation correctness.
One flange-face proposal exposes an applicability concern. The glossary, case
links and rubric have Codex checks but no independent inspector approval.

## Two retrieval points

1. **Interpretation:** consult a versioned, approved component glossary,
   aliases and component relationships while processing raw evidence. Preserve
   original wording, normalized identity and exact supporting spans together.
   A match proposes a meaning; unresolved identity or conflicting context
   requires clarification, not completion from a historical report.
2. **Recommendation:** retrieve eligible historical cases for the verified
   structured observation, then check applicability and missing information.
   Compare component, condition, severity/extent when known, inspection method
   and relevant operating/design context. Similar wording alone is insufficient.

For the historical-case retrieval experiment, both branches receive the same
glossary and identical verified observations. Both may propose actions or ask
questions under the same constraints. Only access to historical cases differs.
Test glossary assistance separately; keep writing guidance fixed in both arms.

## Historical case record: preserve unknowns

Final reports are the input to this design. They do not establish all original
field evidence, engineering reasoning, operating conditions or repair outcomes.
Extract observations and recommendations separately, then review their link
using component identity, source passages and explicit cross-references. Do not
create the observation side solely by reverse-engineering a recommended action.

| Field | Required representation |
| --- | --- |
| Component and condition | Explicit assertions with original wording, normalized identity, and source passages; preserve conflicts. |
| Severity, extent and measurements | Stated values, qualifiers and units; otherwise `unknown`. Blank is not zero or satisfactory. |
| Recommended action | Historical proposed action, its alternatives and qualifications, with its own passage references. |
| Recommendation rationale | Explicit source rationale, or `not_stated`; model explanation is not historical rationale. |
| Applicability conditions | Source-stated conditions plus separately labelled expert additions. Missing conditions remain unknown and can prevent applicability confirmation. |
| Implementation and outcome | `unknown` unless separately documented; report approval or an issued recommendation does not establish either. |
| Provenance | Immutable report/revision, asset lineage, date or date-unknown status, page, passage/span and source checksum. |
| Review status | `extracted`, `checked` or `expert_approved`, with reviewer, time, scope and case revision. Source-level approval is separate. |

Each populated case field retains its basis: `source_explicit` with a passage,
or `expert_added` with a review record and technical basis. Missing fields have
an explicit state and no fabricated value. Contradictory passages remain linked
as a conflict. Any AI hypothesis stays outside these source-asserted fields
until separately reviewed. No silent inference of the conditions that would
make a historical action reasonable is permitted.

## Proposed action: precedent and justification are separate

Every current proposal carries:

- current observation IDs and their resolved physical components;
- the proposed action and any alternatives, labelled as proposals;
- retrieved case IDs and source passages, or an explicit absence of precedent;
- an explanation of apparent applicability to the current observation;
- important differences, unknown conditions and necessary clarification;
- applicable reviewed technical guidance or calculations when available,
  recorded separately from historical precedent;
- whether inspector confirmation or engineering review is needed, and its status.

A proposed explanation is not a fact copied from a historical case. When the
current evidence cannot establish suitability, return a conditional proposal or
a question; do not claim the recommendation is sufficient or technically
approved. For example, a coating precedent alone cannot establish whether
additional observed material loss has been adequately addressed. Record the
information needed to assess that difference. This contract introduces no
engineering threshold or repair procedure.

Inspector decisions create a versioned accepted/edited/rejected proposal record.
They never rewrite the observation or imply the repair was carried out. Only
reviewed content participates in normal report approval/export.

## Purpose

Raw report chunks are useful for style, but they are too loose for controlled technical generation. The structured pair KB gives the LAIQ AI Engine safer guidance:

- what kind of field condition was observed
- what repair or maintenance action was historically recommended
- what component, condition, action, and evidence tags are involved
- which historical report/page the pattern came from
- whether the current app export has matching evidence

## Evidence Classes

The generation system should keep these classes separate:

- current app facts: facts captured in the current LAIQ inspection app export
- report-side inputs: user-confirmed data entered on the web platform
- historical pair guidance: approved past fact/recommendation patterns from other reports
- template guidance: section shape, heading style, bullet style, table style
- AI inference: wording or judgement drafted from current facts plus historical guidance

Same-asset history, when identity and date are verified, remains dated historical
evidence. It does not become a current observation merely because a user permits
its use. Current facts require current evidence or an explicit current-inspection
confirmation with its own provenance.

## Current Implementation

Code:

- `server/fact-recommendation-kb.mjs`
- `server/scripts/rebuild-fact-recommendation-kb.mjs`
- `server/scripts/audit-fact-recommendation-kb.mjs`

Generated local index:

- `apps/report-platform/.data/fact-recommendation-kb/fact-recommendation-kb.index.json`

The `.data` folder is intentionally gitignored because the index is rebuilt from the local private report corpus.

## Build And Audit

```bash
npm --prefix apps/report-platform run recommendation-kb:rebuild
npm --prefix apps/report-platform run recommendation-kb:audit
```

The initial extractor scans retrieval-approved sample-report chunks and does not
cap the number of candidates. Extraction count is not validated-pair count.
Preserve the existing index for reproduction; prepare a reviewed subset and new
derived revision before rebuilding broadly.

## API

```text
GET  /api/v1/knowledge-base/recommendations/status
POST /api/v1/knowledge-base/recommendations/rebuild
GET  /api/v1/knowledge-base/recommendations/search?sectionId=repair-recommendations
GET  /api/v1/knowledge-base/recommendations/audit
```

## Generation Use

In the rebuilt pipeline, only section agents whose release contract declares
historical-case use receive a frozen, reviewed case subset. Typical consumers are:

- narrative sections
- repair/recommendation sections
- inspection-report sections

Deterministic measurement tables, normal layout-map sections, and the Report
Structure Agent do not receive repair-recommendation cases.

No new-pipeline recommendation agent implements the full reviewed-case applicability
and proposal contract yet. The legacy route's `factRecommendationContext` and its
isolated writing experiment are historical comparison behavior, not the rebuild.
The `server/observation-context.mjs` and
`server/observation-recommendation.mjs` modules implement an explicit evaluation
candidate, invoked by `server/scripts/run-kb-observation-comparison.mjs`.
They are useful source logic and evaluation evidence but are not a new-pipeline
section release.
The existing Evaluation Lab exposes their saved artifacts through
`server/experiments/kb-observation-review-backend.mjs`.

## Safety Rules

- Evaluation retrieval excludes the target report, alternate renditions,
  near-duplicates and the held-out asset/scenario lineage, as well as validation
  and hidden-answer material. Enforce tenant/workspace and evidence-date bounds.
- A different job or customer match alone does not establish retrieval eligibility.
  Verified same-asset history is a separate operational-history track, with an
  as-of cutoff; it is not permitted in the independent case-retrieval comparison.
- Old values are never automatically promoted to current facts.
- Missing current values remain `Pending confirmation`.
- The final report should only include current app facts, user-confirmed historical facts, and reviewer-approved AI recommendations.

## Next Improvements

1. Define the recommendation section's ReportPlan/SectionPlan contract, applicable
   standard obligations, typed inputs, and output validators.
2. Port the diagnostic's source-bound identity checks into a new immutable section
   release; never substitute a broad checklist group.
3. Review the checked case subset with an inspector and add an applicability
   gate for component/function and damage-mechanism differences before composition.
4. Obtain expert-defined acceptable actions, unacceptable actions and necessary
   clarification questions before testing recommendation generation.
5. Run separate interpretation and recommendation comparisons under
   [the evaluation contract](docs/design/mock-evaluation-contract-v2.md#separate-interpretation-and-recommendation-experiments).
6. Expand retrieval, review tooling and case coverage only after those results.
