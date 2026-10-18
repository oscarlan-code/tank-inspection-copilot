# Report Platform system architecture

## Authority

This file defines the product boundary and invariants for `apps/report-platform`.
`REPORT_COMPILER_WORKFLOW.md` governs generation, `SECTION_AGENT_RELEASES.md`
governs section releases, and `EVAL_SYSTEM.md` governs qualification. Archived
documents cannot override these contracts.

## Purpose

The platform converts an immutable LAIQ inspection-app revision into an editable,
traceable inspection report and exports only approved content.

```text
LAIQ app -> authenticated import -> input/leakage guard -> Evidence Atomizer
         -> Contents Classification Agent -> reviewed Section Evidence Packages
         -> ReportPlan / SectionPlans -> Section Agents -> pre-display Section Review Agents
         -> ReportDocument -> inspector approval -> DOCX/PDF
         -> shared traces, evidence accountability, evaluation matrix, and control-plane audit
```

The app and report platform are independent products connected by versioned export
and API contracts. They do not share implementation internals or databases.

## Product planes

| Plane | Responsibility |
| --- | --- |
| Report | Import one inspection revision, plan/generate sections, edit, approve, and export. |
| Knowledge | Ingest, review, version, and publish historical-report and standards sources. |
| Evaluation | Prepare sealed truth/capture cases, run the same frozen releases, score, and review. |
| Control | Identity, tenancy, authorization, PostgreSQL, objects, versions, jobs, and audit. |

Evaluation cannot mutate product drafts or promote itself. Knowledge ingestion
cannot change current inspection evidence.

## Generation architecture

The new report compiler is a clean rebuild. The previous shared generator remains
only for reading saved drafts and producing labelled historical comparisons. The
new pipeline never falls back to it.

The Report Structure Agent consumes current scope, a reviewed historical
`ReportBlueprintPack`, and a pinned applicable `StandardObligationPack`. It returns
an immutable, reviewed `ReportPlan` containing the report profile, standard/edition,
ordered table of contents, section instances, dependencies, applicability, and
exact section-agent bindings. It creates structure, not section prose.

Each section release family pins one multi-report `SectionKnowledgeBundle`. Its
structure, mock-preparation, generation, review, and evaluation projections share one
bundle ID and hash while exposing only role-appropriate knowledge. The Section
Generation Agent receives one frozen `SectionPlan`, section-scoped current evidence,
the generation projection, and applicable standard obligations. It emits a typed
`SectionDocument`, validation results, trace, and an unapproved draft. An
independently versioned pre-display Section Review Agent uses the review projection
to check current-evidence fidelity, accepted section variation, format, and knowledge
boundaries without gold. Only `ready_for_review` drafts may be presented, and they remain unapproved.
The deterministic Report Integrator verifies ordering,
cross-references, protected facts, unresolved obligations, and styles before
creating one semantic `ReportDocument` for browser and export.

R&D and product use the same frozen release bytes and dependencies. R&D opens sealed
expected content only after generation; product requires inspector review and
approval. Product routing selects exact qualified hashes and never `latest`.

## Knowledge authority

Historical reports and technical standards are separate governed lanes:

- Historical packs provide compatible report structure, section patterns,
  terminology, presentation practice, and reviewed precedents.
- Standard packs provide applicable obligations, methods, inputs, units,
  calculations, review prompts, and clause/edition provenance.

Historical frequency cannot create a standard requirement. Missing historical
precedent cannot remove one. Neither source can supply a current tank fact.

Conflict order is current evidence, applicable standard obligation, compatible
historical practice, then traceable reviewed judgment.

## Source-of-truth matrix

| Concern | Authority |
| --- | --- |
| Current facts | Pinned app revision or authenticated report-side confirmation |
| Measurements/calculations | App rows and deterministic tools |
| Layout geometry | App-owned verified geometry/figure; approved MFL placement manifest |
| Report structure | Reviewed immutable ReportPlan |
| Historical pattern | Pinned ReportBlueprintPack or SectionPatternPack |
| Technical obligation | Pinned reviewed StandardObligationPack and edition |
| Section implementation | Exact qualified section-agent manifest hash |
| Draft | Versioned unapproved section/document revision |
| Publication | Selected approved non-stale ReportDocument snapshot |

Imported evidence is append-only. Editing creates derived report state and never
changes the pinned inspection revision.

The shared Contents Classification pathway owns the input/leakage guard, Evidence
Atomizer, physical-entity preservation, section/block classification, reviewed
multi-section uses, and isolated `section_evidence_package_v1` outputs.
Deterministic app records follow rules; a model may propose labels for narrative
evidence, but only authorized reviewed decisions enter a section package. Each
source record is classified, explicitly excluded, or retained in a blocking review
queue. The General Tank Information Candidate B sandbox consumes this contract; Candidate A remains a pinned regression baseline;
future section releases will use the same handoff. The former
`report-evidence-router` is retained only to reproduce historical evaluations.

## Platform boundaries

- PostgreSQL is the only transactional database.
- pgvector is the first production vector layer; authorization, approval, split,
  lineage, and temporal filters run before semantic scoring.
- S3-compatible storage holds immutable imports, evidence, KB sources, figures,
  artifacts, and exports; PostgreSQL holds ownership and checksums.
- Identity and roles come from authenticated sessions, never request bodies or app
  metadata. Every operation is tenant/workspace scoped.
- Deterministic tools own values, units, calculations, tables, geometry, document
  structure, and approval state. AI may draft only declared narrative slots.
- Browser, DOCX, and future PDF render the same approved semantic document.

Detailed upload, storage, identity, editing, layout/MFL, and deployment contracts
are indexed under `docs/contracts/`.

## Current implementation truth

| Capability | Status |
| --- | --- |
| Authentication, tenancy, PostgreSQL, object storage, V3 import | V1 Beta baseline |
| Editing, versioning, approval, DOCX export | Reusable baseline; new-pipeline binding pending |
| Historical/standards ingestion and review | Baseline exists; immutable pack builders pending |
| Previous shared generator and 32-section outline | Legacy comparison only |
| Report Structure Agent and durable ReportPlan store | Planned; minimum package-bound evaluation contracts are executable |
| Mock Preparation Agent | V1 immutable R&D release for historical-report-to-app-export evaluation; product-disabled |
| Contents Classification Agent | Evaluation v1 qualified; reviewed section packages available; product-disabled |
| Archived Report Evidence Routing Agent | Historical TK5452 reproduction only; blocked for new work |
| Scope of Inspection agent | V1 ReportPlan-bound evaluation candidate |
| General Tank Information agent | Package-bound Candidate B active in sandbox; Candidate A retained for regression; qualification and immutable release pending |
| Other section agents | Not implemented |
| Shared all-agent monitoring | V1 evaluation contract; classifier/generator/reviewer/evaluator expansion pending |
| Report Integrator and product promotion registry | Planned |
| PDF export and cloud production deployment | Planned |

Scope of Inspection and General Tank Information are the implemented and evaluated agent families.
Both now have independent pre-display reviewer releases and post-generation
sealed-gold evaluator releases. Scope v1 and General Information v3 preserve the
historical routed-plan experiment; General Information v1 remains frozen evidence.
General Information Candidate B is the active sandbox implementation on the
current section-evidence package, with a package-bound plan, deterministic generator,
independent no-gold reviewer, atomic evaluator, whole-section automated evaluator and post-review integrity check. It is not yet a
qualified immutable release. All are evaluation-only and cannot enter product routing.

## Hard invariants

- No current fact comes from historical prose or model output.
- Hidden/validation gold and post-cutoff sources never enter generation retrieval.
- Every selected section resolves to an exact immutable release or stays blocked.
- Every release pins separate historical and standard packs and all dependencies.
- Missing evidence, agent, standard basis, tool, or renderer remains visible; no
  legacy-generator fallback is allowed.
- A later section cannot change a frozen earlier release.
- AI cannot bypass validation, versioning, approval, authorization, or rollback.
- Only selected approved non-stale content can be exported.
- The legacy 32-section profile is never described as an API-mandated table of
  contents.
