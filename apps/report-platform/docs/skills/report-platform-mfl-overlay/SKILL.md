---
name: report-platform-mfl-overlay
description: Compose individual MFL plate-map PDFs onto immutable LAIQ app floor layouts. Use for floor corrosion plans, MFL extraction, crop/grid removal, plate-ID matching, per-plate size/offset/rotation review, source-scan comparison, browser/DOCX parity, or debugging a layout that changes after MFL import.
---

# Report Platform MFL Overlay

Treat the source layout as immutable geometry and MFL scans as transparent evidence overlays. Never use a scan or historical report to rebuild the floor layout.

## Required Context

Read:

- `AGENTS.md`
- `docs/skills/report-platform-boundaries/SKILL.md`
- `docs/skills/report-platform-layout-map/SKILL.md`
- `FLOOR_CORROSION_MAP_PIPELINE.md`
- `references/layout-contract.md` when adapting a new layout family

## Workflow

1. Identify the baseline layout.
   - Prefer the V3 app-exported `appFigure.svg` and resolved plate geometry.
   - Use a report-side source drawing only for a legacy package without app-resolved geometry.
   - Do not import a replacement drawing over a valid V3 layout.
2. Validate and fingerprint the baseline before extraction.
3. Run the metadata-only MFL/layout preflight. Require every scan plate name/number to resolve to exactly one layout plate and, by default, require complete plate coverage.
4. Start image extraction only after preflight succeeds. Preserve an untouched source preview and retain only configured corrosion-band pixels in the overlay PNG.
5. Match scan IDs to stable host plate IDs or explicit aliases. Block unmatched, duplicate, or ambiguous mappings.
6. Suggest initial orientation from physical and host-plate aspect ratios. Require human review for X/Y scale, X/Y offset, and rotation. Flip controls are not part of the product workflow.
7. At 100%, map the complete extracted scan to the complete host-plate bounds without `slice` cropping. Anchor X scaling at the left edge and Y scaling at the top edge so each control moves only its corresponding far edge. Apply normalized offset to the entire placement, then clip to the host plate and outer tank boundary. Never mutate the original source preview; the review UI rotates it for direction comparison but does not apply map-only scale or offset.
8. Verify that the composed layout has the same geometry fingerprint as the baseline.
9. Visually select representative main and annular plates, compare their source previews, and test one-sided X/Y size, offset, rotate, reset, and approval controls.
10. Verify browser and server/DOCX renderers use the same normalized layout and overlay transforms.

## Reusable Command

Run from the repository root:

```bash
apps/report-platform/docs/skills/report-platform-mfl-overlay/scripts/run-overlay-pipeline.sh \
  --layout /path/to/normalized-floor-layout.json \
  --mfl /path/to/individual-mfl-plate-maps.pdf \
  --output /path/to/new-output-directory \
  --require-app-figure
```

Optional reviewed placements:

```bash
apps/report-platform/docs/skills/report-platform-mfl-overlay/scripts/run-overlay-pipeline.sh \
  --layout /path/to/normalized-floor-layout.json \
  --mfl /path/to/individual-mfl-plate-maps.pdf \
  --placements /path/to/placements.json \
  --output /path/to/new-output-directory \
  --require-approved
```

The output directory must be new or empty. The script writes:

- `scans/`: transparent corrosion PNGs and immutable source previews
- `floor-corrosion-map.json`: composed layout without inline image payloads
- `floor-corrosion-map.svg`: report-ready deterministic figure

Preflight only:

```bash
node apps/report-platform/docs/skills/report-platform-mfl-overlay/scripts/preflight-mfl-match.mjs \
  --layout /path/to/normalized-floor-layout.json \
  --mfl /path/to/individual-mfl-plate-maps.pdf
```

The command exits non-zero before image extraction when plate names, numbers, counts, aliases, or assignments do not match uniquely. `--allow-partial` is available only for explicitly approved partial-scan workflows; all supplied scans must still match uniquely.

## Verification Only

```bash
node apps/report-platform/docs/skills/report-platform-mfl-overlay/scripts/verify-immutable-layout.mjs \
  --baseline /path/to/baseline-layout.json \
  --composed /path/to/floor-corrosion-map.json \
  --require-app-figure
```

## Guardrails

- Do not infer or move layout geometry from MFL pixels.
- Do not silently map scans by page order.
- Do not rewrite scan pixels. The overlay renderer uses the full transparent scan with non-cropping mapping; X/Y controls change only the final map placement rectangle.
- Do not remove the original app figure, elements, findings, datum, or labels.
- Do not claim completion when matching errors exist.
- Do not approve orientation automatically.
- Do not use completed corrosion maps as generation inputs; they are evaluator-only gold artifacts.
- Keep source PDFs and generated artifacts tenant/workspace scoped in product deployments.

## Product Validation

```bash
npm --prefix apps/report-platform run build
npm --prefix apps/report-platform run logic:audit
npm --prefix apps/report-platform run floor-corrosion:audit
npm --prefix apps/report-platform run floor-corrosion:durability-audit
npm --prefix apps/report-platform run api:audit
```

With S3-compatible test storage configured, also run:

```bash
npm --prefix apps/report-platform run floor-corrosion:object-storage-audit
```

For a UI change, also run a browser test that imports an MFL PDF, selects a main plate and an annular plate, confirms rotation orients the immutable source preview, confirms 100% contains the full scan, confirms X moves only the right edge and Y moves only the bottom edge, confirms offsets do not resize, verifies approval is invalidated, approves the placement, and checks the browser console.
