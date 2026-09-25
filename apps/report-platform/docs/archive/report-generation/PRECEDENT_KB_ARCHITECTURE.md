# Historical report knowledge architecture

## Purpose

The historical-report KB supports the rebuilt Report Structure Agent and the
individual Section Generation Agents. It captures approved reporting practice from
the complete governed corpus; it is not a source of current-inspection facts and is
not technical authority for API compliance.

Standards/codes use a separate governed lane. The new pipeline combines both lanes
only through typed, pinned packs with provenance.

## Two consumers

### Report Structure Agent

Receives a `ReportBlueprintPack` containing compatible:

- report families and inspection types;
- common, required-by-practice, optional, conditional, repeated, and attachment
  section patterns;
- section order, numbering, titles, dependencies, and cross-reference conventions;
- report-level cover, header/footer, table-of-contents, appendix, and pagination
  patterns;
- source/report/page/chunk provenance, confidence, review state, and limitations.

The Structure Agent compares historical practice with current scope and the separate
standard-obligation pack. It cannot treat frequency as a code requirement or omit a
standard obligation because old reports omitted it.

### Section Generation Agent

Receives a `SectionPatternPack` containing only its compatible section material:

- outline blocks and field/table/figure schemas;
- terminology, labels, ordering, and presentation patterns;
- narrative organization and cadence;
- conditional historical cases with applicability context;
- approved format/layout patterns;
- provenance, exposure lineage, review status, and exclusions.

The section pack is frozen with the agent release. An agent never receives an
unfiltered report dump or mutable global search result.

## Knowledge layers

| Layer | Purpose | Restrictions |
| --- | --- | --- |
| Report blueprint | Main report family and table-of-contents practice | Does not define current scope or API obligation by itself |
| Section structure | Reusable section blocks, tables, maps, photos, attachments | Compatible family/inspection type only |
| Terminology/glossary | Aliases, component relationships, inspector-language normalization | Preserve original wording and uncertainty; ambiguity requires review |
| Writing pattern | Approved organization and professional cadence | No copied same-case answer text or current facts |
| Format/layout pattern | Tables, headings, maps, captions, page components | Rendering remains deterministic and versioned |
| Historical case | Observation/action precedent with explicit conditions and unknowns | Precedent is not technical justification or proven outcome |

The fact-to-recommendation case contract remains in `FACT_RECOMMENDATION_KB.md`.

## Source governance and ingestion

Every source is registered before extraction with:

- immutable object ID, checksum, media type, title, date/date-unknown state;
- tenant/workspace visibility and authorized purpose;
- report family, inspection type, asset/report lineage, and rendition group;
- dataset role/split and exposure history;
- approval and reviewer state.

Ingestion stages:

```text
source registration
  -> checksum-verified object
  -> page-aware extraction / OCR with quality signals
  -> report-family and section parsing
  -> table, figure, terminology, writing, format, and case candidates
  -> source-linked review
  -> approved immutable knowledge revision
  -> pgvector/metadata publication
```

Extraction must preserve page, block/span, table cell, figure, and source identity.
Low-quality or ambiguous extraction stays rejected or review-only. Rebuilding creates
a new revision; it never overwrites approved packs or evaluation snapshots.

The current corpus inventory and all-KB outline review remain useful source evidence.
They produced 25 reusable section-template candidates across nine profile candidates.
The existing 32-section vertical-AST sequence remains one compatibility profile,
not a universal structure. Counts and classifications must come from the governed
registry rather than a hard-coded source list in this document.

## Historical pack construction

Pack construction is deterministic after reviewed inputs:

1. authorize tenant/workspace and source visibility;
2. exclude same case, asset/report rendition, hidden/validation gold, and post-cutoff
   sources for evaluation;
3. filter by report family, inspection type, section/template identity, asset type,
   and approved purpose;
4. group duplicates and near-duplicates by lineage so one report does not dominate;
5. retrieve candidate patterns/cases;
6. rerank by compatibility, provenance quality, and reviewer status;
7. select the minimum necessary approved records;
8. produce a content-addressed pack with inclusion/exclusion reasons.

### ReportBlueprintPack minimum contract

```text
pack ID/version/hash
compatible report profiles and inspection types
section-pattern instances with frequency and conditional basis
order/number/title/cross-reference conventions
report-level format patterns
source lineage and provenance
review state and known coverage gaps
retrieval query/filter/embedding/reranker versions
```

### SectionPatternPack minimum contract

```text
pack ID/version/hash
section agent/template/profile compatibility
outline and output-format patterns
terminology/glossary revision
writing and historical-case records
applicability conditions and explicit unknowns
source lineage and provenance
review state and exclusions
retrieval query/filter/embedding/reranker versions
```

The release manifest pins the pack hash. Changing any source, filter, selected
record, glossary, applicability rule, or retrieval algorithm creates a new pack and
agent evaluation.

## Standards lane

Codes and standards are ingested separately as `StandardObligationPack` sources.
They provide applicable requirements, calculation/method context, review prompts,
edition/clause provenance, and explicit uncertainty. They are not formatting
precedent.

The report job pins the contractually applicable edition. If it is not confirmed,
technical conclusions remain blocked. The locally available API 653 edition or a
historical report reference must never silently choose the governing edition.

Conflict rules:

1. current inspection evidence controls current facts;
2. the pinned applicable standard controls technical obligations;
3. historical report KB controls compatible reporting practice and style;
4. inspector/engineer confirmation resolves permitted professional judgments;
5. unresolved conflict is shown, never silently merged.

## Historical case and recommendation safety

A historical case records only what the source establishes:

- component/condition and measurement/severity if stated;
- historical recommendation;
- stated rationale and applicability conditions, otherwise `unknown`;
- implementation/outcome only if separately documented, otherwise `unknown`;
- exact source passage/page/checksum and review status.

A current proposal must state the observation addressed, precedent used, apparent
applicability, important differences, missing information, technical-basis status,
and required confirmation. Similar wording or component type is not sufficient.

## Leakage and evaluation

- Hidden reference sections and expected answers are never pack inputs.
- Validation/hidden-test sources are globally unavailable to evaluation generation,
  including alternate renditions and near-duplicates.
- All variants of one inspection lineage stay in one split.
- Retrieval respects `evidenceAsOf`; future reports cannot advise an older case.
- Previously inventoried structural exposure is recorded and disqualifies claims of
  an untouched structural holdout.
- The evaluator opens gold only after the generated artifact and trace are sealed.
- Long copied phrases, client/tank identifiers, and report-specific current facts
  trigger leakage review.

## Storage and services

Product metadata, approvals, revisions, pack manifests, retrieval traces, and vector
metadata belong in PostgreSQL/pgvector. Immutable PDFs, extraction artifacts, pack
objects, and derived indexes belong in S3-compatible storage with checksum metadata.

Useful product services:

- source inventory and approval;
- page/section/table/figure review;
- blueprint and section-pattern review;
- terminology and historical-case review;
- standards-obligation review;
- pack build, audit, publication, and exact-version retrieval;
- trace display showing which patterns, standards, and cases influenced a plan or
  section without placing raw evidence in the final report.

## Legacy boundary

The previous generator's direct mutable `PrecedentPack` search and hard-coded section
profiles remain historical comparison behavior. Do not extend them for the new
pipeline. New Structure and Section agents consume only pinned, reviewed packs.

Existing local indexes and extracted candidates remain useful inputs to review; they
are not automatically approved packs and do not establish standard compliance.

## Acceptance criteria

- the Structure Agent can retrieve compatible blueprints from all approved sources;
- every selected/omitted section pattern has provenance and a reason;
- each section release pins a minimal approved SectionPatternPack;
- historical and standards packs are separate and exact-versioned;
- same-case/near-duplicate/future/hidden sources are excluded before ranking;
- current evidence always outranks precedent for current facts;
- standard obligations outrank conflicting historical practice;
- every run records pack hashes and selected source IDs;
- changing the KB cannot change an already-frozen release;
- reviewers can inspect influence and unresolved conflicts without exposing raw
  customer evidence in the final report.
