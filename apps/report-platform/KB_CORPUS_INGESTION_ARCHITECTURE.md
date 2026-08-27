# KB Corpus And Ingestion Architecture

This document governs source ingestion and review. The downstream conversion
of approved historical reports into truth graphs, app-capture variants, hidden
gold evaluation cases, and policy rewards is defined separately in
`TRAINING_HARNESS_ARCHITECTURE.md`.

Ingestion assigns an immutable document role inside a versioned benchmark
snapshot. Validation and hidden-test gold are not retrieval-eligible, and all
evaluation retrieval is constrained to documents issued before the case's
`evidenceAsOf` timestamp.

## Purpose

Define how the report platform converts the historical IRS corpus into a
governed, tenant-safe knowledge base for report generation and evaluation.

This architecture starts with discovery and approval. It does not recursively
embed every file in `/Users/oscar/Public/irs`.

## Corpus Inventory: 2026-08-05

Read-only inventory roots:

- `/Users/oscar/Public/irs/Sample Reports/`
- `/Users/oscar/Public/irs/Codes/`

Current inventory result:

| Item | Count |
| --- | ---: |
| Supported assets inspected | 2,396 |
| Total size | 6.98 GB |
| Final-report file candidates awaiting review | 357 |
| Structured templates/fieldsheets | 15 |
| Specialist MFL evidence assets | 168 |
| Other visual/supporting evidence assets | 1,028 |
| Standards documents awaiting review | 12 |
| Administrative assets excluded by default | 403 |
| Preliminary/draft reports quarantined | 62 |
| Temporary Office artifacts excluded | 40 |
| Unknown assets quarantined | 311 |
| Possible binary duplicate groups | 113 |
| Logical report/rendition groups | 118 |
| Report-reference case bundles | 123 |

The 357 candidates are files, not 357 unique approved reports. Many reports
exist as PDF and DOCX renditions and are mirrored under root, client project,
`Report No`, or `Hardcopy Report` folders.

The manifest currently identifies 135 logical final-report keys. Of these, 102
have both PDF and DOCX candidates, which makes them the strongest starting set
for matching issued-page layout to structured heading/table extraction.

Generated read-only manifests:

- `.data/kb-corpus-inventory/kb-corpus-inventory.json`
- `.data/kb-corpus-inventory/kb-corpus-inventory.md`

Commands:

```bash
npm --prefix apps/report-platform run kb:inventory
npm --prefix apps/report-platform run kb:inventory-audit
```

## Current Gap

The existing V1 Beta precedent index is intentionally narrow:

- 22 root-level sample PDFs
- 12 standards PDFs
- 2,320 page-level chunks

The current indexer is not ready for recursive production ingestion because it:

- scans only immediate files in the two source folders
- treats a filename as the document identity
- auto-marks discovered sources as approved for retrieval
- creates one chunk per extracted PDF page
- has no exact-hash duplicate resolution
- has no report/DOCX/PDF rendition grouping
- has no OCR quality gate
- stores a local JSON index instead of publishing through PostgreSQL, object
  storage, and pgvector

Recursive discovery must therefore feed a review queue, not the live KB.

## Implemented Ingestion Worker Baseline

The first governed ingestion worker now lives at:

- `services/kb-ingestion/`

Its product boundary is:

```text
immutable source + reviewed identity metadata
  -> Docling extraction
  -> deterministic quality gate
  -> report-aware LlamaIndex transformations
  -> reviewable chunks and provenance
  -> optional structured AI escalation proposals
  -> PostgreSQL review queue
```

The worker never auto-publishes content to retrieval. `publish-review` requires
an immutable object-storage key, refuses failed extraction, refuses overwrite
of approved/retrievable documents, and stores all chunks with
`retrieval_eligible = false` at the document gate.

Commands:

```bash
npm --prefix apps/report-platform run kb:ingestion:sync
npm --prefix apps/report-platform run kb:ingestion:audit
npm --prefix apps/report-platform run kb:ingest -- ingest /path/report.pdf --output /tmp/run
npm --prefix apps/report-platform run kb:ingest -- validate /tmp/run/manifest.json
```

AI escalation is disabled by default. When explicitly enabled, a command
provider receives only the low-confidence source blocks and must return a
schema-constrained derived annotation. It cannot replace source text, cite
blocks outside the request, or make content retrieval-eligible.

## Implemented Super Admin Review Workspace

The governed review surface is available at:

- `/admin/knowledge-base`

It is protected by the `kb.manage` platform permission and is not available to
Inspector accounts. The primary review workflow is deliberately limited to:

1. selecting an original document
2. viewing the immutable original source on the left
3. searching, filtering, and selecting extracted chunks on the right
4. following each selected chunk back to its highlighted source blocks on the
   original page

Quality findings, document and section classification, review decisions, and
audit history remain available in a secondary `Review settings` drawer. This
keeps governance controls accessible without obscuring the source-to-chunk
validation task.

Each published chunk retains its source block identifiers, page numbers, and
normalized page bounding boxes. The review UI renders the selected PDF page
with PDF.js and overlays those immutable source regions. Older page-only
ingestion packages remain readable but require re-ingestion before exact
paragraph highlighting is available.

Ingestion assigns a report family, historical-source role, case-level dataset
split, and safe section lanes without requiring reviewer configuration. The
assignment is deterministic for a case group: 70% training, 15% validation, and
15% hidden test. Clean training sections become retrieval candidates at source
approval; evaluation sections remain evaluator-only, and warned sections remain
quarantined. Reviewers use the secondary drawer only to override an exceptional
classification or record notes.

The source preview is streamed through an authenticated, byte-range-capable
report-platform endpoint. MinIO remains private, the browser receives no
object-storage credentials, and long-running review sessions do not depend on
expiring signed URLs. The browser does not read from `/Users/oscar/Public/irs`
directly.

Approval is intentionally not publication. The review transaction records the
human decision but leaves `kb_documents.retrieval_eligible = false`. A later
embedding/index worker must verify citations, dataset exclusions, embedding
metadata, and index readiness before enabling production retrieval.

The review workflow is stored by migration
`011_kb_review_workflow.sql` and can be audited with:

```bash
npm --prefix apps/report-platform run kb:review:audit
```

## Knowledge Base Definition

The product KB is a set of governed knowledge lanes, not one vector collection.

| Lane | Purpose | Generation access |
| --- | --- | --- |
| Template library | Section order, headings, table/page-block structure, formatting tokens | Structured templates only |
| Wording precedent | Approved narrative cadence and section-specific phrasing patterns | Approved chunks from other report cases |
| Prior inspection memory | Previous confirmed facts for the same client/tank | Historical context only; never current fact without confirmation |
| Fact-to-recommendation pairs | Reviewed condition/evidence/action patterns | Structured guidance with current-evidence matching |
| Standards guidance | API/EEMUA/ASTM requirements and calculation context | Separate cited standards lane; no verbatim report prose |
| Specialist evidence | MFL maps, B-scan profiles, settlement sheets, drawings, photographs | Tool-specific processing; not normal wording RAG |
| Evaluation gold | Original report used as the hidden correct answer | Evaluator only; hard-excluded from generation |
| Quarantine | Drafts, unknown assets, failed OCR, unapproved or conflicting versions | No retrieval |

### One Case, Many Assets

A historical inspection case can contain:

```text
report reference / inspection case
  -> final PDF: visual and issued-report authority
  -> matching DOCX: structured extraction aid
  -> spreadsheets: calculations or source measurements
  -> photographs: visual evidence
  -> MFL/scan files: specialist evidence
  -> drawings/layouts: geometry and presentation evidence
  -> preliminary versions: lineage only, not precedent
  -> administrative files: excluded
```

The final PDF and matching DOCX are renditions of one logical report. They must
not produce duplicate precedent chunks or be split across training and hidden
test datasets.

## Required Product Metadata

### Inspection Case

- `case_id`
- `report_reference`
- `tenant_id` and `workspace_id`
- `client/site/tank identity` with privacy classification
- `report_family`
- `inspection_mode`
- `tank_type`
- `standard_basis`
- `inspection/completion date`
- `dataset_split`: `training`, `validation`, `hidden_test`, or `unassigned`
- `case_status`: `discovered`, `reviewed`, `approved`, `retired`, or `quarantined`

### Document And Rendition

- `document_id` and `case_id`
- `document_role`: final report, alternate rendition, attachment, source data,
  draft, administrative, or gold answer
- `object_key` and immutable `sha256`
- source relative path and source-system provenance
- MIME type, size, PDF page count, encryption/permission metadata
- revision and issue status
- extraction method/version and extraction diagnostics
- redaction status and visibility scope
- reviewer and approval audit fields

### Section And Chunk

- report-family-specific canonical `section_key`
- original heading and page range
- semantic block type: paragraph, bullet group, fact table, recommendation
  group, photo caption, layout legend, calculation summary, or attachment form
- extraction confidence and reviewer status
- current-fact risk and PII classification
- source citation and immutable document/version identity
- lexical search text and embedding version

## Ingestion Workflow

```text
1. Discover metadata recursively
2. Exclude temporary and administrative artifacts
3. Compute SHA-256 and group exact duplicates
4. Group PDF/DOCX/attachments into one inspection case
5. Automatically classify report family and historical-report role
6. Assign tenant/access scope and a deterministic case-level dataset split
7. Automatically classify clean, evaluation-only, and quarantined section lanes
8. Human approves the source or optionally overrides an exceptional classification
9. Copy immutable source to S3-compatible object storage
10. Extract PDF/DOCX text, page images, tables, and diagnostics
11. OCR only pages that fail text-quality thresholds
12. Parse report-family-specific sections and semantic blocks
13. Extract reviewed facts and fact-to-recommendation candidates
14. Redact or protect identifiers according to visibility policy
15. Generate embeddings and PostgreSQL full-text records
16. Publish an immutable KB version
17. Run retrieval, leakage, and evaluation audits
```

### Discovery Is Not Ingestion

`kb:inventory` performs stages 1 and initial metadata classification only. It:

- never edits public source files
- never auto-approves a source
- never assigns training or hidden-test roles
- never embeds content
- never changes the live KB

### Duplicate Resolution

Before extraction:

1. Use filename/size only to identify duplicate candidates.
2. Compute SHA-256 for every candidate source.
3. Treat identical hashes as one binary asset with multiple source paths.
4. Group PDF and DOCX renditions under one logical document.
5. Select the issued/final revision through human review.
6. Keep prior revisions for lineage but exclude them from normal retrieval.

### Extraction Strategy

- PDF: Docling layout/table extraction with OCR where needed, page provenance,
  and deterministic extraction-quality scoring.
- DOCX: use document structure for headings, lists, tables, and captions when
  it matches the approved final PDF revision.
- Scanned/low-text PDF: OCR selected pages and retain OCR confidence.
- XLS/XLSX: preserve worksheets and formulas as structured evidence; do not
  convert them into narrative precedent automatically.
- Images/MFL/layout drawings: store and process through specialist tools; do
  not mix their OCR text into normal narrative retrieval.
- Encrypted/restricted PDFs: record permission metadata and ingest only when
  the source is authorized for this product use. Do not bypass restrictions.

### Section Parsing

Use a parser registry by report family. Examples:

- `internal_external_api653`
- `internal_inspection`
- `external_inspection`
- `post_repair`
- `profile_3d_scan`
- `floor_3d_scan`
- `settlement_survey`
- `mfl_floor_scan`
- `mpi_repair`
- `fieldsheet_checklist`

Each family owns its ToC aliases, expected section order, semantic block types,
and required current-app evidence. A profile-assessment report must not be
forced through the V10 internal/external parser.

## Dataset Assignment And Gold Firewall

Dataset assignment happens at the entire inspection-case level:

- `training`: can guide candidate retrieval policies after approval
- `validation`: evaluates tuning iterations but does not update the policy
- `hidden_test`: evaluator-only final comparison
- `unassigned`: cannot participate in learning or production retrieval

All renditions and attachments from one report reference inherit the same split.
Client/tank series should be grouped when splitting to prevent near-duplicate
history leaking into hidden tests.

The default assignment hashes a stable case-group key into the 70/15/15 split.
The resolved split is stored as a real dataset value, together with whether the
assignment was automatic or explicitly overridden. `unassigned` is retained
only for legacy imports and is never the default for a new ingestion.

The evaluator may read a hidden gold report only after generation. Generation
must exclude the gold case by case ID, document hashes, report reference, and
all alternate renditions.

## Retrieval Workflow

```text
current app evidence + selected section
  -> authorization and tenant/workspace filters
  -> dataset/approval/gold exclusion filters
  -> report-family and section filters
  -> PostgreSQL lexical retrieval + pgvector semantic retrieval
  -> metadata and relevance-label reranking
  -> duplicate/source-diversity control
  -> structured precedent pack with citations
  -> constrained section agent
```

Retrieval should return structured fields rather than an uncontrolled excerpt
dump:

- template/format pattern
- approved wording pattern
- historical fact marked as historical
- reviewed fact-to-recommendation pattern
- standards citation
- source/case/document/page provenance
- relevance score and why it was selected

## Storage Topology

- PostgreSQL: case, document, section, chunk, approval, label, ingestion-run,
  dataset-split, and audit metadata
- pgvector: approved chunk embeddings with model/version metadata
- PostgreSQL full-text search: lexical retrieval and exact technical terms
- S3-compatible object storage: original assets, rendered pages, OCR output,
  extraction artifacts, and immutable KB versions
- Queue workers: hashing, extraction, OCR, section parsing, embeddings, and
  evaluation

Migration `010_kb_ingestion_lineage.sql` adds case, rendition, approval,
ingestion-run, section, chunk-provenance, and escalation lineage. Review
publication remains retrieval-disabled until a later explicit approval and
embedding workflow is implemented.

## Initial Ingestion Waves

### Wave 0: Inventory And Review

- review the 118 logical report groups
- verify the 113 duplicate candidates with SHA-256
- resolve final versus preliminary revisions
- classify unknown files and confirm privacy/access policy

### Wave 1: API 653 Full Inspection

- start with approximately 20 reviewed cases rather than all candidates
- balance the review queue across internal/external, internal-only,
  external/in-service, post-repair, settlement, and profile-assessment families
- select a balanced set of approved internal/external, internal-only,
  external-only, and in-service reports
- pair PDF and DOCX renditions
- parse the common report spine and high-value narrative sections
- reserve entire cases for validation and hidden testing before embedding

### Wave 2: Repairs And Specialist Assessments

- post-repair and repair-consultation reports
- profile/3D-scan reports
- settlement reports
- MPI reports and structured recommendation pairs

### Wave 3: Visual And Source Evidence

- MFL individual plate maps
- B-scan profiles
- floor-corrosion layouts
- photographs, drawings, and calculation workbooks
- tool-specific validation rather than narrative RAG

## Acceptance Gates

A source cannot become production-retrievable until:

- exact duplicate and canonical revision are resolved
- report family and section map are reviewed
- tenant/visibility and confidentiality policy are approved
- extraction quality passes or reviewed OCR is available
- source role and dataset split are resolved, with automatic/override provenance recorded
- PII/redaction status is recorded
- gold-case exclusions are tested across every rendition
- chunk citations resolve to the immutable object and page/section
- leakage, retrieval, and relevance-label audits pass

More reports help only after these gates. Unreviewed duplicates, drafts, wrong
families, and raw attachments increase retrieval noise and can make generation
worse even when the vector index is larger.
