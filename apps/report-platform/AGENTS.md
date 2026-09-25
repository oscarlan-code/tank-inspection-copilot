# Report Platform development rules

This file governs work in `apps/report-platform`. A development role under
`docs/agents/` is different from a runtime Section Generation Agent.

## Read first

Use these active authorities:

1. `SYSTEM_ARCHITECTURE.md`
2. `PRODUCT_TERMINOLOGY.md`
3. `REPORT_COMPILER_WORKFLOW.md`
4. `SECTION_AGENT_RELEASES.md`
5. `EVAL_SYSTEM.md`
6. `DOCUMENTATION_INDEX.md`

Read the relevant project skill before changing its subsystem:

- always: `docs/skills/report-platform-boundaries/SKILL.md`;
- workflow/API/UI: `docs/skills/report-platform-workflow/SKILL.md`;
- AI/editing: `docs/skills/report-platform-generation-control/SKILL.md`;
- layouts: `docs/skills/report-platform-layout-map/SKILL.md`;
- MFL: `docs/skills/report-platform-mfl-overlay/SKILL.md`;
- KB/evaluation: `docs/skills/report-platform-kb-eval/SKILL.md`;
- export: `docs/skills/report-platform-docx-export/SKILL.md`.

Files under `docs/archive/` are historical and cannot define implementation.

## Product boundary

Report-platform owns authenticated import, normalization, report jobs, ReportPlan
and SectionPlan processing, generation/review, report-side inputs, knowledge/eval,
layout presentation, controlled edits, approval, and export.

The LAIQ inspection app owns field capture and export packages. Do not modify
`apps/field-android/`, root prototypes, private report sources, or standards sources
unless the task explicitly requires the API/export handoff. The two apps communicate
only through versioned contracts.

Do not edit generated/runtime folders casually: `.data/`, `dist/`, or
`node_modules/`.

## Rebuilt generation rule

This is a clean rebuild. The previous shared generator and 32-section outline are
legacy comparison/read surfaces. Do not add prompts, templates, routing, retrieval,
features, or fallbacks to them.

- The Report Structure Agent creates a reviewed immutable ReportPlan/ToC and exact
  section bindings; it never writes section prose.
- Every generated section resolves to one exact immutable Section Generation Agent
  release. Unknown, missing, or unqualified bindings fail closed.
- Each release pins its input/applicability contract, outline, format, deterministic
  logic, optional prompt/model, historical SectionPatternPack, applicable
  StandardObligationPack, validators, renderer interface, and dependencies.
- R&D and product execute the same release bytes and hashes. Evaluation opens gold
  only after generation. Product saves an unapproved draft.
- Promotion changes an audited server-owned routing record. App data, request flags,
  model output, and evaluation cannot promote or select a release.
- Later work cannot alter a frozen earlier release. New behavior requires a new
  version and evaluation.
- Missing evidence, agent, standard basis, tool, or renderer remains visible. Never
  call the legacy generator as a substitute.

General Tank Information v1 remains frozen qualification evidence. V2 is the first
ReportPlan/SectionPlan-bound evaluation candidate. Both remain product-disabled.
Do not describe outlines or saved multi-section experiments as implemented agents.

## Evidence and AI

Current facts come only from the pinned app revision or authenticated report-side
confirmation. Preserve original evidence, source spans, values, units, row order,
entity/location links, polarity, uncertainty, and photo/finding relationships.

Deterministic code owns headings, labelled fields, measurements, calculations,
tables, checklists, maps, figures, attachments, document structure, provenance, and
approval state. AI may draft only declared narrative slots backed by sufficient
section-scoped evidence. It may use historical patterns for structure/cadence and
standard packs for constraints; it may not invent facts or copy hidden gold.

If AI claims an edit occurred, it must return a controlled action that creates a
new persisted version. AI cannot authorize, approve, promote, or export.

## Knowledge and evaluation

Keep separate:

- current app evidence;
- confirmed report-side input;
- historical report patterns/precedents;
- applicable standards obligations;
- AI proposals.

Split evaluation by report/asset/scenario lineage. Exclude target/same-lineage,
near-duplicate, validation/hidden, and post-cutoff material before retrieval. Test
current evidence, historical pattern, and standard obligations independently.

Do not optimize exact historical wording. Track semantic coverage, supported-claim
precision, protected-field/relationship accuracy, format readiness, inspector edits,
and approval outcome. Leakage or altered critical data is blocking.

## Platform rules

- PostgreSQL is the only transactional database; do not add SQLite/fallback files.
- Use pgvector for filtered semantic retrieval and S3-compatible storage for
  immutable objects.
- Derive actor, roles, tenant, and workspace from authentication, never request
  bodies or app metadata.
- Every report, import, generation, KB, evaluation, approval, export, and admin
  operation is tenant/workspace scoped.
- Keep secrets out of source, prompts, traces, and persisted plaintext.
- Use queue-backed bounded workers for production AI/export/index/eval tasks.

## Runtime AI baseline

Current internal defaults are `REPORT_PLATFORM_CODEX_MODEL=gpt-5.6-sol` and
`REPORT_PLATFORM_CODEX_TIMEOUT_MS=120000`; GPT-5.6 requires Codex CLI 0.144.0 or
newer. If status reports deterministic fallback, describe it accurately.

## Focused reviewers

- `docs/agents/report-structure-agent-reviewer.md`
- `docs/agents/section-agent-release-reviewer.md`
- `docs/agents/report-generation-reviewer.md`
- `docs/agents/kb-leakage-reviewer.md`
- `docs/agents/layout-map-parity-reviewer.md`
- `docs/agents/docx-format-reviewer.md`
- `docs/agents/api-security-reviewer.md`

Reviewers return findings first and do not edit unless implementation is requested.

## Required validation

For report-platform changes run:

```bash
apps/report-platform/scripts/report-platform-guardrails.sh --standard
```

The standard gate covers build, architecture, generation logic, the frozen General
Information agent, PostgreSQL storage, object upload, durable artifacts, leakage,
and API hardening. Add the focused real integration check for the changed subsystem.

Keep report-platform and Android implementation commits separate. A cross-app change
must be limited to the versioned API/export contract and explained. Temporary
guardrail bypasses must be explicit in the final handoff.
