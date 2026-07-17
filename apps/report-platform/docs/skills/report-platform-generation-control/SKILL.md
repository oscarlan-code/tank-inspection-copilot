---
name: report-platform-generation-control
description: Use when changing LAIQ AI Engine generation, chat, controlled edits, provenance, rollback, or generated content transformation logic.
---

# Report Platform Generation Control

## Core Rule

If LAIQ AI Engine says it changed generated output, it must return a controlled action or a pending confirmation plan.

## Important Files

- `server/generation.mjs`
- `server/codex-cli.mjs`
- `server/report-blocks.mjs`
- `server/store.mjs`
- `server/eval.mjs`
- `src/app/App.tsx`
- `src/components/RichTextSectionEditor.tsx`
- `src/domain/types.ts`
- `GENERATED_CONTENT_CONTROL_SYSTEM.md`
- `AGENTIC_SYSTEM_DESIGN.md`

## Allowed AI Work

AI may:

- draft prose from an evidence pack
- explain missing fields
- classify user intent
- choose a safe tool
- propose a structured edit
- rewrite narrative blocks while preserving protected facts

AI must not:

- invent app facts, measurements, findings, or map geometry
- silently mutate imported app export data
- claim an edit applied without a returned action
- bypass approval, validation, or rollback
- use hidden same-report gold text in generation

## Controlled Action Expectations

Supported action families include:

- exact section/block replacement
- whole-section text style
- table-scoped style
- checklist marker transform
- deterministic measurement/checklist table rebuild
- pending confirmation for non-trivial AI-planned edits
- backend draft restore

## Required Guardrails

- Snapshot drafts before mutation.
- Preserve app-sourced measurements and checklist rows.
- Keep missing values pending.
- Surface provenance where practical.
- Keep eval/leak checks separate from generation prompts.

## Validation

```bash
npm --prefix apps/report-platform run logic:audit
STRICT_SAMPLE_LEAK=1 npm --prefix apps/report-platform run leak:audit
npm --prefix apps/report-platform run report:eval
```
