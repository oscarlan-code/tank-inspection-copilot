# Report Platform Product Terminology

## Purpose

This document is the naming authority for `apps/report-platform`. Product UI,
operator documentation, API messages, architecture diagrams, and future
training-harness features must use these terms consistently.

Stable PostgreSQL table/column names and internal service identifiers may keep
older compatibility names when renaming them would create migration risk. Those
identifiers must not define user-facing language.

## Canonical Workflow

```text
Knowledge Base Review
  -> Truth Case Builder
  -> Capture Variant Builder
  -> App Round Trip
  -> Evaluation Runs
  -> Policy Optimization
  -> Policy Registry and Promotion
```

The complete sequence belongs to the **Training Harness**, which is an offline
Super Admin subsystem. It is separate from the live inspector report workflow.

## Canonical Terms

| Canonical term | Meaning | Internal compatibility names |
| --- | --- | --- |
| **Knowledge Base Review** | Review, classify, and approve immutable historical sources and extracted chunks. | KB review |
| **Approved Source** | An immutable source document approved for a defined KB or evaluation role. | KB document |
| **Benchmark Snapshot** | A versioned, immutable assignment of source roles and dataset splits for one evaluation cycle. | `report_benchmark_snapshots` |
| **Historical Source Bundle** | One historical report and its related fieldsheets, calculations, photos, and specialist evidence before fact normalization. | historical case bundle |
| **Truth Case Builder** | The Super Admin workflow that extracts, reviews, classifies, and approves facts from a Historical Source Bundle. | case builder, gold case builder |
| **Truth Case** | The approved inspection truth graph, answerability map, source lineage, and dataset split for one historical inspection. | training case, `report_training_cases`, `trainingCaseId` |
| **Truth Graph** | Structured inspection facts with exact source provenance; it is not copied report prose. | reviewed facts |
| **Answerability Map** | Classification of which facts may come from the app, voice, report-side input, deterministic tools, precedent, standards, judgment, or hidden gold only. | answerability labels |
| **Capture Variant Builder** | Creates reproducible inspector-capture scenarios from an approved Truth Case. | capture simulator |
| **Capture Variant** | One versioned scenario representing how an inspector might capture the same truth through structured data, voice, notes, photos, and omissions. | synthetic variant |
| **App Round Trip** | Materializes a Capture Variant through the LAIQ inspection app and production V3 upload/import path. | app export round trip |
| **Historical Gold Report** | The original approved report used to construct a Truth Case. | gold report |
| **Hidden Gold** | The Historical Gold Report while it is sealed from generation and used only after generation for evaluation. | evaluation gold |
| **Gold Firewall** | Retrieval and prompt controls that prevent matching or future gold evidence from reaching generation. | retrieval firewall |
| **Evidence Pairing** | Internal compatibility path for legacy direct Hidden Gold-to-app-package links; it is no longer a current Evaluation Lab stage. | Link App Data, evaluation case setup |
| **Evaluation Run** | One persisted generation-and-scoring execution for a defined Truth Case, Capture Variant, section set, and policy version. | eval run |
| **Policy Optimization** | Offline reward-driven comparison of reviewed RAG, prompt, reranker, and tool-routing configurations. | system-level RL |
| **Policy Candidate** | An immutable reviewed configuration under offline evaluation. | training policy |
| **Production Policy** | The promoted immutable configuration used by live report generation. | production arm/policy |
| **Policy Registry** | Super Admin UI and storage for candidates, production versions, promotion, rollback, and audit history. | Learned Policy UI |
| **Training Harness** | The complete offline source-to-truth-to-variant-to-evaluation-to-policy subsystem. | historical training harness |

## User-Facing Naming Rules

Use **Truth Case Builder**, never **Training Case Builder**, **Gold Case Builder**,
or **Historical Case Builder**.

Use **Truth Case** for the reviewed normalized inspection case. Use **historical
report** or **Historical Source Bundle** for source material, and use **Hidden
Gold** only for the sealed evaluation answer.

Use **Capture Variant Builder** for the tool/workspace and **Capture Variant**
for one generated scenario.

Use **Policy Optimization** for the learning process and **Policy Registry** for
the UI that displays, promotes, and rolls back policy versions. Do not label the
current UI **Learned Policy**, because persisted policy state alone is not proof
of completed learning.

Use **Evidence Pairing** only when describing the internal compatibility API for
existing direct gold-to-app-package links. The current consolidated Stage 2 UI
is **Truth & Mock Data**.

## Internal Compatibility Boundary

The following names remain stable until a deliberate data/API migration is
approved:

- PostgreSQL tables beginning with `report_training_case_`
- `training_case_id` columns
- internal service methods such as `createTrainingCase` and `getTrainingCase`
- machine-readable error codes such as `training_case_not_found`
- `report_evaluation_cases` and `evaluation_case_id`

API display messages and UI labels around those identifiers must still say
**Truth Case** or **Evidence Pairing**, as appropriate. New public contracts must
use canonical terminology and map to compatibility identifiers inside the
service layer.
