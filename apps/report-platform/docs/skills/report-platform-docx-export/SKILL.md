---
name: report-platform-docx-export
description: Use when changing DOCX/PDF export, report formatting, heading styles, margins, line spacing, tables, layout figures, or approved-section export behavior.
---

# Report Platform DOCX Export

## Core Rule

Final export includes selected approved sections only. Browser preview and DOCX output should stay aligned as much as possible.

## Important Files

- `server/docx-export.mjs`
- `server/layout-map-figure.mjs`
- `server/report-toc.mjs`
- `src/lib/reportApi.ts`
- `src/app/App.tsx`
- `SAMPLE_REPORT_FORMATTING_REVIEW.md`

## Formatting Rules

- Use report-oriented heading styles so users can generate TOC in Word/Google Docs.
- Keep normal page margins unless explicitly changed.
- Keep narrative line spacing around 1.5 where applicable.
- Preserve table structure and selected checklist/measurement responses.
- Place layout map figures near the corresponding UT/map sections.
- Do not export unapproved sections.

## Common Failure Modes

- DOCX includes pending/unapproved sections.
- Tables lose columns or markers.
- Layout map figure differs from preview.
- Heading styles are plain bold text instead of Word heading classes.
- Section selection is ignored.

## Validation

```bash
npm --prefix apps/report-platform run api:audit
npm --prefix apps/report-platform run build
```
