# Documentation control

## Active root contracts

Read these files in order. They are the only root-level report-platform authorities.

| Order | Document | Authority |
| --- | --- | --- |
| 1 | `SYSTEM_ARCHITECTURE.md` | Product boundary, source-of-truth rules, and invariants |
| 2 | `PRODUCT_TERMINOLOGY.md` | Product and workflow language |
| 3 | `REPORT_COMPILER_WORKFLOW.md` | Complete rebuilt generation pipeline |
| 4 | `SECTION_AGENT_RELEASES.md` | Immutable per-section release lifecycle |
| 5 | `EVAL_SYSTEM.md` | Evaluation, leakage, and promotion gates |
| 6 | `AGENTS.md` | Development rules and required validation |
| 7 | `README.md` | Current status and operating entry points |

If documents disagree, the earlier applicable authority wins.

## Supporting contracts

Supporting files live under `docs/contracts/` so the project root stays lean.

| Area | Documents |
| --- | --- |
| Platform | `platform/ANDROID_V3_OBJECT_UPLOAD_HANDOFF.md`, `platform/AUTHENTICATION_AND_TENANCY.md`, `platform/BACKEND_STORAGE_ARCHITECTURE.md`, `platform/PRODUCT_STORAGE_MIGRATION_PLAN.md` |
| Deployment | `platform/PRODUCT_CLOUD_ARCHITECTURE.md`, `platform/MAC_MINI_STAGING.md` |
| Reporting | `reporting/GENERATED_CONTENT_CONTROL_SYSTEM.md`, `reporting/REPORT_SECTION_FORMAT_CONTRACT.md`, `reporting/LAYOUT_AND_EXPORT.md`, `reporting/FLOOR_CORROSION_MAP_PIPELINE.md` |
| Knowledge | `knowledge/KNOWLEDGE_PACKS.md`, `knowledge/KB_CORPUS_INGESTION_ARCHITECTURE.md` |
| Evaluation support | `evaluation/MOCK_PREPARATION_EVALUATION_UI.md`, `evaluation/SEMANTIC_UNIT_EVALUATION.md`, `evaluation/TRAINING_HARNESS_ARCHITECTURE.md`, `evaluation/RL_RETRIEVAL_OPTIMIZATION_ARCHITECTURE.md` |

The mock-preparation candidate, release, archive, and cleanup lifecycle is defined
in `server/mock-preparation-agent/README.md`. Editable candidates belong in its
`sandbox/`; only qualified, hash-bound copies belong in `releases/`.

The immutable agent-configuration and semantic-unit lineage contracts live under server/section-agents/evaluation-contracts/v1/. They bind model and prompt versions to every evaluated agent and derive the atomic source-to-mock and mock-to-generation matrix. PostgreSQL migration 052 stores these immutable snapshots and links.

The active shared preprocessing release and its executable contract live under
`server/contents-classification-agent/`. It guards and atomizes a pinned Android
export, classifies section/block uses, requires authorized review, and emits
hash-sealed `section_evidence_package_v1` inputs for future section agents. Its
exact evaluation release remains product-disabled. The former
`server/report-evidence-router/` is archived in place for saved-run reproduction;
its registry blocks new workflows by default.
The shared all-agent trace and evaluation-matrix contract lives under
`server/section-agents/observability/v1/`; it records execution without changing a
frozen agent release or product state.

Supporting contracts govern only their subsystem. They cannot change ReportPlan,
section-agent, knowledge-authority, or promotion rules in the root contracts.

## Design and evidence

- `docs/design/`: current schemas and candidate design inputs. The 25-template
  outline is historical-KB input; the 32-section contract is a legacy compatibility
  profile. `vertical-tank-inspection-v1.md` defines the source-reviewed seven-section
  common spine, scope-dependent technical modules, and TK5452 integrated evaluation
  sequence for the rebuilt V1 ReportPlan. Roof configuration controls applicability
  and does not split the vertical-tank report family. General Tank Information v1
  is frozen evidence; v3 is a historical routed ReportPlan evaluation candidate.
  Future releases use `section_evidence_package_v1`. All remain product-disabled.
  Their independent pre-display reviewers live under
  `server/section-agents/releases/<section-id>/reviewer/`; sealed-gold R&D evaluators live under
  `server/section-agents/releases/<section-id>/evaluator/`. Uniform per-section agent, KB and
  harness specifications for sections 1–7 live under
  `server/section-agents/specs/vertical-tank-v1/`.
- `docs/reviews/`: dated audit and qualification evidence. Results record what was
  tested and do not define architecture.
- `docs/agents/`: focused development reviewer prompts.
- `docs/skills/`: task-specific operating checklists that route back to the active
  contracts.

## Archive

`docs/archive/` contains superseded architecture, consolidated detailed designs,
source-specific research, and session markers. It is retained for provenance only.
Archived files are not implementation authority and should not receive new work.

The legacy symbol `API_STANDARD_REPORT_TOC` names one historical 32-section profile;
API 653 does not mandate that exact table of contents.

## Documentation rule

New report-generation behavior should update implementation/tests and one existing
active contract. Create another Markdown file only when it defines a distinct stable
subsystem contract or records a dated review. Archive superseded documents instead
of keeping competing “final” versions at the root.
