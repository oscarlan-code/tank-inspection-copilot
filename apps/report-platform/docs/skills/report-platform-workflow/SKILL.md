---
name: report-platform-workflow
description: Use when changing the report-platform UI/API workflow for loading app exports, generating sections, review, approval, and final DOCX export.
---

# Report Platform Workflow

## Product Flow

```text
LAIQ inspection app V3 export
-> import/bootstrap API
-> normalized report job
-> section evidence packs
-> deterministic tools / constrained AI workers
-> generated drafts
-> human review and approval
-> selected approved sections
-> DOCX export
```

## Important Files

- `src/app/App.tsx`
- `src/domain/mockReport.ts`
- `src/domain/reportToc.ts`
- `src/domain/types.ts`
- `src/lib/reportApi.ts`
- `server/index.mjs`
- `server/store.mjs`
- `server/generation.mjs`
- `server/docx-export.mjs`

## Workflow Rules

- No generation on page load.
- Loading mockup/app data should only prepare evidence.
- The user chooses which sections to generate.
- Generated sections move to editing state.
- Approval is human-gated.
- Final DOCX export includes selected approved sections only.
- Missing required manual fields should block approval, not trigger invented content.

## Common Failure Modes

- Generated output appears before the user clicks Generate.
- Approval succeeds despite missing required inputs.
- DOCX export includes unapproved sections.
- UI local state diverges from backend report job state.
- API fallback to fixture hides backend failure in demos.

## Validation

```bash
npm --prefix apps/report-platform run build
npm --prefix apps/report-platform run logic:audit
npm --prefix apps/report-platform run api:audit
npm --prefix apps/report-platform run storage:audit
npm --prefix apps/report-platform run object-upload:audit
```
