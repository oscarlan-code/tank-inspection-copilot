---
name: report-platform-boundaries
description: Use when working in apps/report-platform to keep product boundaries, protected runtime folders, Android handoff rules, and report-platform validation expectations clear.
---

# Report Platform Boundaries

Read `SYSTEM_ARCHITECTURE.md` for whole-product boundaries and
`DOCUMENTATION_INDEX.md` for the authoritative subsystem contract before
using an older topology or implementation-plan file.

## Core Rule

`apps/report-platform` is an independent product app. Do not mix report-platform changes with Android, root prototype, or commercial-output changes unless the user explicitly asks.

Report-platform and Android communicate only through versioned API/export contracts. Report-platform code should not depend on Android implementation internals.

## Active Paths

- `apps/report-platform/src/`
- `apps/report-platform/server/`
- `apps/report-platform/docs/`
- `apps/report-platform/assets/`
- `apps/report-platform/public/`
- `apps/report-platform/scripts/`
- `apps/report-platform/package.json`
- `apps/report-platform/vite.config.ts`
- `apps/report-platform/tsconfig*.json`

## Protected Runtime Paths

Do not casually edit or commit:

- `apps/report-platform/.data/`
- `apps/report-platform/dist/`
- `apps/report-platform/node_modules/`

These are ignored runtime/generated artifacts.

## External Reference Paths

Treat these as read-only references unless the user explicitly asks:

- `/Users/oscar/Public/irs/Sample Reports/`
- `/Users/oscar/Public/irs/Codes/`

Historical reports can guide format and precedent patterns. They must not leak hidden facts into generated content.

## Product Boundary

Report-platform owns report generation, KB, review workflow, LAIQ AI Engine orchestration, layout-map report presentation, DOCX/PDF export, and report-side inputs.

The LAIQ inspection app owns field capture and export packages. App facts enter report-platform only through versioned export/import contracts.

## Guardrail

Before handoff:

```bash
node apps/report-platform/server/scripts/audit-architecture-consistency.mjs
apps/report-platform/scripts/report-platform-guardrails.sh --standard
```
