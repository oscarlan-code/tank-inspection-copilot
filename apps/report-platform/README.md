# LAIQ Report Platform

The report platform converts immutable LAIQ inspection-app evidence into
inspector-reviewed reports. The generation pipeline is being rebuilt around one
Report Structure Agent and one immutable Section Generation Agent release per
section.

## Current status

- Platform services for authentication, tenancy, app import, storage, editing,
  approval, evaluation, and DOCX export exist as a V1 Beta baseline.
- The previous shared report generator is legacy read/comparison support. Do not add
  new generation behavior or use it as a fallback.
- Two section-agent families are executable: Scope of Inspection v1 and General
  Tank Information v2 use the deterministic ReportPlan-bound evaluation route.
  General Tank Information v1 remains frozen qualification evidence. None is
  product-enabled.
- The minimum in-memory ReportPlan/SectionPlan execution contract now supports
  these two sections. The Report Structure Agent, durable plan stores, remaining
  section agents, Report Integrator, PDF parity, and promotion registry remain to be built.
- No report-generation model, KB policy, or section agent is currently promoted
  through the rebuilt pipeline.

## Target pipeline

```text
immutable app import
  -> canonical evidence and entities
  -> historical ReportBlueprintPack + applicable StandardObligationPack
  -> Report Structure Agent
  -> reviewed ReportPlan and table of contents
  -> evidence classification and frozen SectionPlans
  -> exact immutable Section Generation Agents
  -> evidence / historical-pattern / standard validation
  -> deterministic Report Integrator and ReportDocument
  -> inspector edit, approval, and selected-content export
```

Historical reports define compatible reporting practice. The pinned applicable
standard and edition define technical obligations. Current app evidence and
confirmed report-side inputs define current facts. These authorities remain
separate.

## Implemented section agents

`scope_of_inspection_v1` compiles an explicitly confirmed scope record into the
reviewed arrow-bullet layout. It does not infer commissioned work from completed app
tasks, historical frequency, or API 653. Contract tests and a private source-reviewed
10+1 evaluation passed for 81 confirmed claims and 52 protected concepts. Those
fixtures use reconstructed app-shaped evidence; actual-device export, automatic
note-to-claim preprocessing, rendered inspector review, and product qualification
remain open.

`general_tank_information_v1` preserves 31 labelled fields per report. Ten
development reports preserved 310/310 fields and one previously held-out report
preserved 31/31. It passed 16 behavior checks with no model or runtime retrieval.

`general_tank_information_v2` exercises the exact registry through a minimum
reviewed ReportPlan and frozen SectionPlan. Its historical qualification used ten
development reports and one separate held-out
report. It preserved 341/341 fields and aligned the required structure in 11/11
cases. Original report sections remained evaluator-only and were opened after
generation. The fixtures are reconstructed app-shaped records; actual-device export
and independent inspector review remain outstanding. One generic contract fixture
remains for routing and blocker tests; it is not counted as qualification evidence.

The common-core specifications for report sections 1–7 are available under
`server/section-agents/specs/vertical-tank-v1/`. Each section has the same visible
agent, KB and harness control files. The Scope of Inspection and General Tank
Information folders now have executable candidates; the other five remain planned.

## Useful existing services

- PostgreSQL-backed identity, tenant/workspace authorization, reports, drafts,
  approvals, KB metadata, evaluation state, and audit history.
- S3-compatible immutable app packages, attachments, layout figures, KB sources,
  derived artifacts, and exports.
- Authenticated V3 upload/import with size, media-type, SHA-256, ownership, and
  idempotency checks.
- Structured measurements, checklist rows, findings/photos, voice context, and
  app-owned layout geometry.
- Controlled editing, draft history, restore, approval, and selected-section DOCX
  export.
- Evaluation Lab, truth/capture preparation, leakage controls, and saved
  original/evidence/generated comparisons.

These services may be reused by the rebuilt generator after their inputs and outputs
are bound to the new immutable contracts.

## Development

From the repository root:

```bash
npm --prefix apps/report-platform install
npm --prefix apps/report-platform run dev
npm --prefix apps/report-platform run api
```

Primary validation:

```bash
npm --prefix apps/report-platform run build
npm --prefix apps/report-platform run architecture:audit
npm --prefix apps/report-platform run section-agent:general-info:audit
npm --prefix apps/report-platform run section-agent:scope:v1:audit
apps/report-platform/scripts/report-platform-guardrails.sh --standard
```

Internal staging commands are documented in
`docs/contracts/platform/MAC_MINI_STAGING.md`. Account bootstrap and controlled
credential recovery are exposed as `account:bootstrap-admin` and
`account:provision`; use the Super Admin UI for normal account administration.

## Documentation

Read only these root documents for active report-generation decisions:

1. `SYSTEM_ARCHITECTURE.md` — product boundary and invariants.
2. `REPORT_COMPILER_WORKFLOW.md` — complete rebuilt generation pipeline.
3. `SECTION_AGENT_RELEASES.md` — immutable section-agent lifecycle.
4. `EVAL_SYSTEM.md` — qualification and leakage rules.
5. `PRODUCT_TERMINOLOGY.md` — product language.
6. `DOCUMENTATION_INDEX.md` — supporting contracts and archive map.
7. `AGENTS.md` — development rules.

Supporting subsystem contracts live under `docs/contracts/`. Dated test evidence
lives under `docs/reviews/`. Superseded designs and research live under
`docs/archive/` and have no current architecture authority.

The 25 reusable templates and nine report profiles are historical-KB design inputs,
not implemented agents. The legacy 32-section vertical-AST outline is one
compatibility profile, not an API 653-mandated table of contents.
