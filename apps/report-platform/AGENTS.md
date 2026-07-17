# Report Platform Agents

This file governs development work inside `apps/report-platform`.

The report platform is an independent product app. It should not be treated as Android code, root prototype code, or a documentation-only experiment.

These agents and skills are project-build guidance only. They are not deployed into the report-platform runtime unless a product feature explicitly implements them.

## Required Orientation

Before report-platform work, read the relevant project-local skills:

- Always read `docs/skills/report-platform-boundaries/SKILL.md`.
- For normal UI/API/report workflow changes, read `docs/skills/report-platform-workflow/SKILL.md`.
- For generated content editing, LAIQ AI Engine behavior, action planning, provenance, or rollback, read `docs/skills/report-platform-generation-control/SKILL.md`.
- For roof, shell, floor, elements, findings, UT map parity, or DOCX layout figures, read `docs/skills/report-platform-layout-map/SKILL.md`.
- For MFL plate-map extraction, floor corrosion overlays, source-scan previews, plate matching, orientation review, or immutable-layout verification, also read `docs/skills/report-platform-mfl-overlay/SKILL.md`.
- For precedent KB, standards KB, leakage, evals, or report-generation scoring, read `docs/skills/report-platform-kb-eval/SKILL.md`.
- For DOCX/PDF export, heading styles, report formatting, approved-section export, or table/figure placement, read `docs/skills/report-platform-docx-export/SKILL.md`.

## Canonical Report-Platform Docs

Use these as source-of-truth documents. Skills are compact operating checklists and should route back here instead of duplicating the full product thinking.

- `README.md`: V1 Beta product status, runtime workflow, commands, and boundaries.
- `GENERATED_CONTENT_CONTROL_SYSTEM.md`: LAIQ AI Engine control model, action traces, rollback, and future scripted transforms.
- `AGENTIC_SYSTEM_DESIGN.md`: report compiler architecture, deterministic spine, section classes, evidence packs, and constrained LLM workers.
- `REPORT_COMPILER_WORKFLOW.md`: product compiler workflow from app export to approved report export.
- `BACKEND_STORAGE_ARCHITECTURE.md`: storage model, tenant/workspace alignment, and backend topology.
- `PRECEDENT_KB_ARCHITECTURE.md`: precedent and standards KB design.
- `EVAL_SYSTEM.md`: section evals, leak guard, missing-input discipline, and tuning loop.
- `REPORT_GENERATION_AND_LAYOUTMAP_ORCHESTRATION.md`: report generation and layout-map orchestration.
- `SAMPLE_REPORT_FORMATTING_REVIEW.md`: sample-report formatting conventions.
- `FLOOR_CORROSION_MAP_PIPELINE.md`: deterministic MFL extraction, plate matching, orientation review, clipping, and floor-corrosion rendering.

## Product Boundary

`apps/report-platform` owns:

- import and normalization of LAIQ inspection app export packages
- report job management
- section generation and review workflow
- report-side manual inputs
- LAIQ AI Engine orchestration and controlled edits
- precedent KB, standards KB, recommendation KB, and evals
- roof, shell, and floor layout-map presentation for reporting
- report layout, formatting, DOCX export, and future PDF export

The LAIQ inspection app owns field capture and export packages. Android changes belong in `apps/field-android` and must not be mixed into report-platform work unless the user explicitly asks for API/export handoff-contract work.

Report-platform and Android communicate through versioned API/export contracts only. Do not couple report UI, storage, or generation logic directly to Android implementation internals.

Do not modify these from report-platform tasks unless explicitly requested:

- `apps/field-android/`
- root prototype app files
- `/Users/oscar/Public/irs/Sample Reports/`
- `/Users/oscar/Public/irs/Codes/`

Do not casually edit runtime/generated folders:

- `apps/report-platform/.data/`
- `apps/report-platform/dist/`
- `apps/report-platform/node_modules/`

## Storage Rule

SQLite is a local/internal V1 Beta fallback only. Do not design new commercial backend behavior that depends on SQLite file semantics, single-process writes, or local `.data` persistence.

Product-standard backend work should target:

- Postgres for transactional tenant/workspace/report/audit state
- pgvector for the first production vector retrieval layer
- S3-compatible object storage for imports, attachments, layout-map figures, DOCX/PDF outputs, and KB source files
- queue-backed workers for AI generation, export, indexing, and eval tasks

Assume the first commercial deployment needs to support about 200 users and 50 concurrent active editors/reviewers.

## Authentication And Tenancy Rule

- Every report-platform workspace requires authentication first.
- API code must derive the actor from the authenticated principal, never from request-body actor or role fields.
- App export metadata is provenance only and must never provision accounts or grant roles.
- Every report, import, generation, review, export, and private KB query must enforce tenant and workspace scope.
- Development identities are local/internal only and must fail closed in production.
- Commercial identity integration should use the provider-neutral OIDC boundary documented in `AUTHENTICATION_AND_TENANCY.md`.

## Runtime AI Rule

Codex CLI is acceptable for the current internal phase, but product behavior must not depend on unbounded chat behavior.

Default LAIQ AI Engine worker target:

- `REPORT_PLATFORM_CODEX_MODEL=gpt-5.6-sol`
- `REPORT_PLATFORM_CODEX_TIMEOUT_MS=120000`
- GPT-5.6 mode requires Codex CLI `0.144.0` or newer.

If the API status reports deterministic fallback, do not claim the platform is running live GPT-5.6. Fix the local Codex CLI/runtime first or explicitly present fallback mode as the current demo state.

The product-standard rule is:

```text
If LAIQ AI Engine says it changed generated output, it must return a controlled action or a pending confirmation plan.
```

Deterministic tools own:

- measurements
- checklist rows
- layout-map geometry
- calculations
- source provenance
- approval state
- DOCX structure
- tenant/workspace authorization decisions

AI may:

- draft prose from an evidence pack
- explain missing inputs
- classify user intent
- select a safe tool
- propose a structured edit
- rewrite narrative blocks while preserving protected facts

AI must not:

- invent measurements, findings, or element locations
- mutate imported app export data
- copy hidden sample-report answer text into generated content
- bypass validation, approval, or rollback
- claim an edit was applied without returning a real action

## Source And Provenance Rules

Keep these source classes separate:

- app field facts from LAIQ inspection app export
- report-side manual inputs from the inspector/reviewer
- precedent template/style guidance from historical reports
- standards guidance from codes/reference material
- AI predictions or inferred wording

App facts override precedent. Missing required facts should remain pending until the user confirms them.

## Sub-Agent Roles

Use these role prompts as focused reviewers or implementation companions:

- `docs/agents/report-generation-reviewer.md`
- `docs/agents/layout-map-parity-reviewer.md`
- `docs/agents/kb-leakage-reviewer.md`
- `docs/agents/api-security-reviewer.md`
- `docs/agents/docx-format-reviewer.md`

Subagents should produce findings first. They should not edit files unless the user explicitly asks for implementation.

## Guardrail Hooks

Run the report-platform guardrail script before committing report-platform work:

```bash
cd /Users/oscar/Code/tank-inspection-coplilot-app
apps/report-platform/scripts/report-platform-guardrails.sh --standard
```

Install versioned Git hooks for this checkout:

```bash
cd /Users/oscar/Code/tank-inspection-coplilot-app
apps/report-platform/scripts/install-report-platform-hooks.sh
```

The guardrail script blocks or warns about common risks:

- report-platform commits staged together with Android implementation changes
- accidental staged runtime artifacts
- missing product governance files
- build/type errors
- generation logic regressions
- sample-report leakage
- API hardening regressions

Temporary bypasses must be explicit and explained in the final response:

- `ALLOW_REPORT_PLATFORM_ANDROID_MIX=1` only for explicit API/export-contract handoff tasks.
- `ALLOW_REPORT_PLATFORM_RUNTIME_ARTIFACTS=1`
- `REPORT_PLATFORM_GUARDRAILS_MODE=quick`

## Verification Standard

Use evidence before claiming success. For normal report-platform code changes, run:

```bash
npm --prefix apps/report-platform run build
npm --prefix apps/report-platform run logic:audit
STRICT_SAMPLE_LEAK=1 npm --prefix apps/report-platform run leak:audit
npm --prefix apps/report-platform run api:audit
```

For demo or larger generation changes, also run:

```bash
npm --prefix apps/report-platform run report:eval
```

For KB changes, also run:

```bash
npm --prefix apps/report-platform run kb:audit
npm --prefix apps/report-platform run recommendation-kb:audit
```
