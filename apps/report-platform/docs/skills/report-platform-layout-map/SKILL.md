---
name: report-platform-layout-map
description: Use when changing roof, shell, floor, element, finding, UT map, layout-map UI, layout figure, or Android-to-web geometry parity behavior.
---

# Report Platform Layout Map

## Core Rule

Layout maps are deterministic report artifacts generated from LAIQ inspection app export metadata. AI must not draw or invent map geometry.

For MFL plate scans and floor-corrosion composition, also use `../report-platform-mfl-overlay/SKILL.md`.

## Important Files

- `src/components/LayoutMapEditor.tsx`
- `src/lib/layoutMapGeometry.ts`
- `src/domain/mockReport.ts`
- `src/domain/types.ts`
- `server/layout-map-figure.mjs`
- `server/floor-corrosion.mjs`
- `server/floor-corrosion-artifacts.mjs`
- `server/generation.mjs`
- `REPORT_GENERATION_AND_LAYOUTMAP_ORCHESTRATION.md`
- `AI_QUALITY_AND_LAYOUTMAP.md`

## Map Surfaces

- Roof
- Shell
- Floor

Keep these aligned across:

- app export fixture
- web preview
- evidence inspector
- generated section text
- DOCX-safe figure rendering

## Rules

- Use app export layout configs, elements, findings, UT rows, and anchors.
- Preserve marker identity and host location.
- Show evidence as location, measurements, and findings/photos.
- Do not expose edit controls unless geometry override workflow is explicitly in scope.
- If Android parity is uncertain, lock editing and flag review.

## Common Failure Modes

- Duplicate or missing roof elements.
- Shell lanes/courses shifted from Android.
- Findings rendered without linked evidence.
- UI SVG and DOCX SVG diverge.
- Generated text references a map that is not exported.
- MFL grids or axes leak into the composed floor corrosion plan.
- MFL plate IDs are placed without an exact layout match or orientation review.

## Validation

```bash
npm --prefix apps/report-platform run logic:audit
npm --prefix apps/report-platform run floor-corrosion:audit
npm --prefix apps/report-platform run build
```
