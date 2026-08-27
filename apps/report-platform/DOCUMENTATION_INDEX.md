# Report Platform Documentation Index

## Purpose

Keep one consistent documentation hierarchy for the complete report platform.

## Conflict Order

When documents disagree, use this order:

1. `SYSTEM_ARCHITECTURE.md` for whole-system boundaries and invariants
2. `PRODUCT_TERMINOLOGY.md` for product, UI, and workflow names
3. the authoritative subsystem contract listed below
4. `README.md` for current status, commands, and developer orientation
5. historical design references only for background

## Whole Product

| Document | Role |
| --- | --- |
| `SYSTEM_ARCHITECTURE.md` | Authoritative whole-system architecture |
| `PRODUCT_TERMINOLOGY.md` | Authoritative product and workflow vocabulary |
| `README.md` | Current V1 Beta capabilities, commands, and product orientation |
| `AGENTS.md` | Codex development rules and validation requirements |
| `PRODUCT_CLOUD_ARCHITECTURE.md` | Deployment target and current cloud-readiness gap |
| `MAC_MINI_STAGING.md` | Current internal staging operations |

## Authoritative Subsystem Contracts

| Subsystem | Governing documents |
| --- | --- |
| App handoff and immutable ingestion | `ANDROID_V3_OBJECT_UPLOAD_HANDOFF.md` |
| Authentication and tenancy | `AUTHENTICATION_AND_TENANCY.md` |
| PostgreSQL/object/vector storage | `BACKEND_STORAGE_ARCHITECTURE.md`, `PRODUCT_STORAGE_MIGRATION_PLAN.md` |
| Report compiler and AI orchestration | `AGENTIC_SYSTEM_DESIGN.md`, `REPORT_COMPILER_WORKFLOW.md` |
| Generated-content editing | `GENERATED_CONTENT_CONTROL_SYSTEM.md` |
| Layout and MFL processing | `REPORT_GENERATION_AND_LAYOUTMAP_ORCHESTRATION.md`, `FLOOR_CORROSION_MAP_PIPELINE.md` |
| DOCX/report formatting | `SAMPLE_REPORT_FORMATTING_REVIEW.md` |
| KB source ingestion and review | `KB_CORPUS_INGESTION_ARCHITECTURE.md` |
| Precedent and standards retrieval | `PRECEDENT_KB_ARCHITECTURE.md` |
| Recommendation knowledge | `FACT_RECOMMENDATION_KB.md` |
| Evaluation | `EVAL_SYSTEM.md` |
| Offline historical training harness | `TRAINING_HARNESS_ARCHITECTURE.md`, `PRODUCT_TERMINOLOGY.md` |
| System-level RL policy optimization | `RL_RETRIEVAL_OPTIMIZATION_ARCHITECTURE.md` |

## Status Notes

| Document | Role |
| --- | --- |
| `NEXT_SESSION_RL_EVAL_MARKER.md` | Temporary continuation note; not architecture |
| `TRAINING_HARNESS_ARCHITECTURE.md` | Phase 1 foundation is implemented; later case-builder, simulator, batch, and learning phases remain the approved roadmap |

## Historical Design References

These files preserve earlier product reasoning but are superseded for current
implementation decisions:

- `FULL_SYSTEM_DIAGRAM.md`
- `REPORT_GENERATION_TOPOLOGY.md`
- `AI_ENGINE_SYSTEM_DIAGRAM.md`
- `AI_QUALITY_AND_LAYOUTMAP.md`
- `CODEX_ROLES_AND_TOOLING.md`
- `IMPLEMENTATION_PLAN.md`
- `PRODUCT_DEVELOPMENT_PLAN.md`

They may contain V2 terminology, prototype sequencing, reviewer-heavy flows,
or PDF-first assumptions. Do not copy those details into current code without
checking the authoritative architecture and subsystem contract.

## Documentation Rule

New system behavior should update:

1. the implementation and tests
2. the governing subsystem document
3. `SYSTEM_ARCHITECTURE.md` only when a product boundary or invariant changes
4. `README.md` only when current capability, operation, or command changes

Do not create another full-system topology document.
