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

- `SYSTEM_ARCHITECTURE.md`: authoritative whole-product architecture and invariants.
- `PRODUCT_TERMINOLOGY.md`: authoritative UI, workflow, and operator vocabulary.
- `DOCUMENTATION_INDEX.md`: subsystem ownership, conflict order, and historical-document classification.
- `README.md`: current V1 Beta capability, operation, and command summary.
- Follow the authoritative subsystem contracts listed in `DOCUMENTATION_INDEX.md`.

Do not treat `FULL_SYSTEM_DIAGRAM.md`, `REPORT_GENERATION_TOPOLOGY.md`,
`AI_ENGINE_SYSTEM_DIAGRAM.md`, `AI_QUALITY_AND_LAYOUTMAP.md`,
`CODEX_ROLES_AND_TOOLING.md`, `IMPLEMENTATION_PLAN.md`, or
`PRODUCT_DEVELOPMENT_PLAN.md` as current implementation authority. They are
historical design records.

Use `Truth Case Builder` and `Truth Case` in all product-facing text. Stable
database identifiers such as `report_training_cases` and `training_case_id`
remain internal compatibility names and must not leak into UI labels.

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

PostgreSQL is the only supported report-platform transactional database. Do not add SQLite, an embedded database fallback, a selectable database driver, or local database-file semantics.

Product-standard backend work must use:

- Postgres for transactional tenant/workspace/report/audit state
- pgvector for the first production vector retrieval layer
- S3-compatible object storage for imports, attachments, layout-map figures, DOCX/PDF outputs, and KB source files
- queue-backed workers for AI generation, export, indexing, and eval tasks

Local development and automated audits use PostgreSQL through `compose.yaml`, so tests exercise the same database engine as deployment.

Assume the first commercial deployment needs to support about 200 users and 50 concurrent active editors/reviewers.

## Authentication And Tenancy Rule

- Every report-platform workspace requires authentication first.
- API code must derive the actor from the authenticated principal, never from request-body actor or role fields.
- App export metadata is provenance only and must never provision accounts or grant roles.
- Every report, import, generation, review, export, and private KB query must enforce tenant and workspace scope.
- Username/password is the only current authentication path. Do not add a second runtime identity pathway without an explicit product decision.
- Password hashes, hashed persistent sessions, and login throttles belong in PostgreSQL; plaintext passwords and raw session tokens must never be persisted.

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

## Training–Serving Parity Rule

- Training, validation, hidden testing, Stage 4 Policy Test, and production report generation must execute the same shared governed-generation contract and deterministic evidence compilers.
- A policy version is not considered deployed merely because its identifier or arm configuration is selected. Its prompt rules, evidence representation, deterministic compilation, output finalization, and safety checks must all run through the shared production implementation.
- Pilot or audit scripts must import the shared generator contract; they must not carry private copies of production prompt rules or post-processing logic.
- Stage 4 must record `generatorContractVersion` with every generation run. A missing or different contract version is a blocking test failure, not a comparable policy result.
- Never promote a learned policy when the training/validation generator contract differs from the Stage 4/production generator contract.

The shared generation route is mandatory:

- Deterministic code owns section headings, labelled fields, measurements, units, checklist rows, tables, maps, attachments, provenance markup, and final HTML structure.
- The mobile app does not own report-section assignment. Preserve its native voice metadata (`screenKey`, `cardKey`, `fieldKey`, `targetKey`, `itemKey`, labels, and capture time) and derive report-section clusters on the backend.
- The LLM may run only for a section that contains voice evidence routed to that section by the versioned backend clustering contract; it authors narrative from that voice evidence and may use leakage-safe precedent for organization and cadence only.
- If a section has no confidently routed voice evidence, do not invoke the LLM. Compile the captured app records directly and expose unresolved voice routing for review instead of guessing.
- A deterministic formatter must run after narrative and structured evidence are composed. Training, validation, Stage 4, browser preview, and export must consume that same formatted section representation.
- Hidden gold is available only after generation for scoring; it must never enter the generator or formatter.

## Draft-Quality And Promotion Rule

The generated report is an inspector-review draft, not an autonomous final report. Do not require or advertise 100% overall agreement with the historical report. Different professional wording is acceptable, and the inspector must be able to edit and approve the result before final export.

Evaluate and report these dimensions separately:

- semantic recovery and required-concept recall measure how useful and complete the draft is; initial pilot targets should normally be 75–85% semantic recovery and at least 80% required-concept recall
- narrative claim precision should normally be at least 90%, with unsupported or uncertain statements exposed for review
- format readiness should normally be at least 90%, meaning the section is readable and requires only minor presentation edits
- critical-field preservation and entity-relationship accuracy should target at least 99% for captured measurements, units, asset/component identities, locations, severity, checklist selections, and photo/finding links
- inspector acceptance rate, edit distance or edit time, and approval outcome are production quality signals and must be tracked when human-review data is available

Do not fail a draft merely because it differs word-for-word from the original report. Classify outcomes as:

- `ready_for_review`: safe and useful, while normal inspector refinement may still be required
- `needs_attention`: materially incomplete, weakly supported, or requiring substantial inspector rewriting
- `blocked`: captured critical data was altered, an entity relationship was transferred incorrectly, hidden gold leaked into generation, or a safety-critical claim was invented

Policy training must optimize semantic coverage, evidence use, format readiness, and reduced inspector editing effort. It must not optimize exact historical wording or improve semantic score by weakening critical-data safeguards. Promotion decisions must use a validation cohort and entirely held-out reports, and must compare the learned policy with the current baseline on every metric above.

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
npm --prefix apps/report-platform run architecture:audit
npm --prefix apps/report-platform run logic:audit
STRICT_SAMPLE_LEAK=1 npm --prefix apps/report-platform run leak:audit
npm --prefix apps/report-platform run api:audit
npm --prefix apps/report-platform run storage:audit
npm --prefix apps/report-platform run object-upload:audit
npm --prefix apps/report-platform run floor-corrosion:durability-audit
```

For MFL persistence or rendering changes, also run the real reference/S3 integration with configured object storage:

```bash
npm --prefix apps/report-platform run floor-corrosion:audit
npm --prefix apps/report-platform run floor-corrosion:object-storage-audit
```

For demo or larger generation changes, also run:

```bash
npm --prefix apps/report-platform run report:eval
```

For KB changes, also run:

```bash
npm --prefix apps/report-platform run kb:audit
npm --prefix apps/report-platform run kb:ingestion:audit
npm --prefix apps/report-platform run kb:review:audit
npm --prefix apps/report-platform run recommendation-kb:audit
```
