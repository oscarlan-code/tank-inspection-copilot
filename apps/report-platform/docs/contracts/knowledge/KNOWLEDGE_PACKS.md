# Knowledge-pack contract

## Purpose

The rebuilt generator consumes reviewed, immutable knowledge packs. It never queries
an unrestricted global index during generation and never treats historical content
as current inspection evidence.

## Separate authorities

| Pack | Consumer | Permitted contribution |
| --- | --- | --- |
| `ReportBlueprintPack` | Report Structure Agent | Compatible report families, common/conditional sections, ordering, repeated-section patterns, titles, tables, figures, and source provenance. |
| `SectionPatternPack` | One Section Generation Agent release | Section-specific structure, terminology, format, wording patterns, and reviewed precedent cases. |
| `StandardObligationPack` | Structure and section agents | Applicable obligations, methods, inputs, units, calculations, review prompts, clause/edition provenance, and unresolved applicability. |

Historical packs and standard packs remain separate. Historical frequency cannot
create a standard requirement; missing historical precedent cannot remove one.
Neither pack may supply a current tank value, finding, measurement, scope decision,
or inspection result.

## Source preparation

Keep every source immutable with checksum, document family, asset/report lineage,
date, page/chunk provenance, dataset split, approval state, and extraction version.
The raw corpus is retained. Rebuild derived packs as new revisions when extraction,
classification, review, filtering, or source membership changes.

Historical reports are classified into:

- report-level blueprint evidence;
- section-level pattern evidence;
- terminology/alias evidence;
- observation/recommendation precedent candidates;
- format/presentation evidence.

Codes and standards are processed in a separate lane. The report job pins the
contractually applicable standard and edition. A locally available newest edition
or a citation found in an old report cannot choose the governing edition silently.

## Pack contract

Every pack records:

- pack ID, schema version, revision, content hash, and build/review time;
- tenant/workspace and permitted report/inspection profiles;
- source IDs, checksums, page/chunk references, lineage, and exclusions;
- extraction, classifier, reviewer, and approval versions;
- applicability rules, confidence/review state, and explicit unknowns;
- evaluation split and same-case/near-duplicate exclusions;
- superseded/obsolete records and conflicts.

Every release pins exact pack IDs and hashes. A different source, filter, retrieval
algorithm, standard edition, or reviewed record creates a new pack and requires a
new agent evaluation.

## Recommendation precedents

A historical observation/action pair proves only that an action was recommended in
that source. It does not prove suitability, execution, or outcome for the current
inspection. Preserve observation, recommendation, rationale, applicability
conditions, missing conditions, implementation/outcome state, and provenance as
separate fields. Unknown stays unknown.

A current proposed action must identify:

- the verified current observation it addresses;
- retrieved precedents and their source passages;
- why each appears applicable and how the current case differs;
- missing information or clarification needed;
- applicable technical obligations or calculations;
- required inspector or engineering confirmation.

## Conflict order

1. Current inspection evidence controls current facts.
2. The pinned applicable standard controls technical obligations.
3. Compatible historical packs guide report practice and precedent.
4. Reviewed judgment resolves ambiguity and remains traceable.

Conflicts and missing information remain visible blockers. They are never resolved
by inventing a value or silently choosing a historical example.

## Evaluation protection

Exclude the target report, same asset/scenario lineage, alternate renditions,
near-duplicates, validation/hidden gold, and post-cutoff sources before retrieval.
Evaluation opens sealed expected content only after generation. Record every
retrieved source and pack hash in the run trace.
