# Report compiler workflow

## Status

This is the sole active generation-pipeline contract. The previous shared generator,
hard-coded 32-section outline, and global retrieval/policy experiments are legacy
comparison surfaces. There is no branch or fallback to them.

Scope of Inspection and General Tank Information have frozen evaluation candidates.
The Report Structure Agent, durable stores/interfaces, remaining agents, integrator,
and product routing are not yet implemented.

## Pipeline

```text
1. Authenticate and pin one app import revision
2. Normalize evidence and resolve physical entities
3. Build reviewed ReportBlueprintPack and StandardObligationPack
4. Create, review, and freeze ReportPlan / table of contents
5. Classify evidence into one or more selected section uses
6. Freeze one SectionPlan per section instance
7. Resolve the exact immutable section-agent release
8. Compile deterministic content and allowed narrative
9. Run the exact independent pre-display Section Review Agent without gold
10. Validate current evidence, historical pattern, and standard obligations
11. Expose only `ready_for_review` unapproved drafts
12. Integrate SectionDocuments into one ReportDocument
13. Inspector edits and approves exact revisions
14. Render/export selected approved content
```

## Core contracts

| Contract | Purpose |
| --- | --- |
| `EvidenceRecord` / `Entity` | Canonical current evidence with source, identity, value/unit, polarity, uncertainty, and relationships. |
| `ReportBlueprintPack` | Reviewed compatible historical report structures and provenance. |
| `StandardObligationPack` | Reviewed applicable obligations for a pinned standard and edition. |
| `ReportPlan` | Immutable report profile, ToC, section instances, dependencies, applicability, and exact agent bindings. |
| `SectionPlan` | One section's evidence uses, blocks, missing inputs, knowledge subsets, tools, and release binding. |
| `SectionDocument` | Typed generated blocks, validation results, trace, and unapproved status. |
| `ReportDocument` | Deterministically integrated semantic document used by browser and export. |

All contracts are scoped to tenant, workspace, report job, and import revision and
carry version/content hashes. Request flags, app data, and model output cannot choose
or promote a release.

## Evidence preparation

Preserve native structure for identity fields, checklist responses, measurement
rows/cells/order/units, findings/photos, layout geometry, figures, attachments, and
voice metadata/transcripts. Normalization never rewrites the import or flattens
structured tables into prose.

Voice interpretation stores both original wording and normalized terminology with
source spans and confidence. Ambiguous identity, negation, severity, location, or
unit becomes a clarification item.

One evidence record may have several reviewed uses:

- `required_structured`
- `required_narrative`
- `supporting`
- `cross_reference`

Supporting evidence is available to the agent but is not appended to customer
report text automatically.

## Report Structure Agent

The higher agent produces schema-valid planning data, not prose. It:

1. determines asset/report family, inspection scope, deliverables, and governing
   standard/edition;
2. retrieves compatible blueprints from all approved historical report families;
3. applies standard and customer/scope obligations;
4. instantiates required, conditional, repeated, visual, photograph, attachment,
   and appendix sections;
5. orders/numbers them and defines dependencies/cross-references;
6. binds each section instance to an exact qualified release;
7. exposes conflicts, unknown applicability, missing agents, and missing inputs;
8. freezes only after review.

Historical frequency never overrides a standard obligation. Unknown scope is not
the same as not applicable.

## Section Generation Agent

For one frozen SectionPlan, the orchestrator verifies all hashes and runs:

1. deterministic fields, tables, calculations, maps, photographs, headings, units,
   and references;
2. an LLM only for declared narrative slots with sufficient current evidence;
3. factual and relationship validation;
4. historical structure/format validation;
5. applicable standard-obligation validation;
6. typed SectionDocument creation with trace and unapproved status.

Agent types are structured, visual, narrative, hybrid, or approved standard
template. Every generator release also requires one exact pre-display reviewer
release. Structured sections normally use deterministic review; future narrative
reviewers may require a bounded LLM semantic check after deterministic blockers pass.
Inspection and Maintenance Regime normally uses a standard template and does not
require AI drafting.

## Three validation gates

### Current evidence

Preserve protected facts, values, units, polarity, qualifiers, entities, locations,
row order, and photo/finding links. Every factual claim resolves to current evidence
or a confirmed report-side input. Omissions and unsupported claims are different
failures.

### Historical pattern

Use only compatible approved section patterns with source and exposure lineage.
Record justified deviations. Exclude target-case and near-duplicate evaluation
sources.

### Applicable standard

Satisfy or visibly defer every applicable obligation for the pinned edition.
Calculations identify method, inputs, units, edition, and review status. Do not claim
compliance, acceptability, remaining life, or repair sufficiency without the required
evidence and authorized review.

Passing one gate cannot compensate for another gate's failure.

## Integration and export

The deterministic Report Integrator checks section presence/order/numbering,
release hashes, cross-references, duplicate/conflicting protected values, unresolved
obligations, styles, figures, captions, headers/footers, and pagination. It produces
one ReportDocument.

Edits create revisions. Protected facts require an evidence-resolution workflow.
Only selected approved non-stale section/document revisions can be exported. Raw
evidence and model internals remain in the review UI, not a report appendix.

## Failure behavior

- Missing current fact: pending; never borrow a historical value.
- Ambiguous evidence: request clarification.
- Missing/uncertain standard basis: block technical/compliance conclusions.
- Model failure: keep deterministic content and mark narrative for retry.
- Missing agent/tool/renderer: block the section.
- Conflicting current facts: preserve both and require resolution.
- Any hash/version mismatch: reject the run.

## Product and evaluation parity

Both contexts execute the same ReportPlan, SectionPlans, releases, tools,
validators, and integrator. Evaluation opens sealed expected data after generation
and writes evaluation artifacts. Product writes unapproved drafts and requires
inspector approval. Neither path can promote itself.

## Build order

1. Implement schemas/stores for knowledge packs, ReportPlan, revised SectionPlan,
   SectionDocument, traces, release registry, and promotion registry.
2. Implement the Report Structure Agent and review/freeze UI.
3. Keep General Tank Information and Scope of Inspection frozen while completing
   their open device/preprocessing/inspector-review gates.
4. Build the next section agents one at a time, freezing each before the next.
5. Implement Report Integrator and browser/DOCX/PDF parity.
6. Qualify multiple families/editions, inspector-note variation, security, load,
   canary, and rollback before product cutover.
7. Remove legacy generation only after saved-history reproduction and rollback needs
   are satisfied.

An outline or template is not an implemented agent.
