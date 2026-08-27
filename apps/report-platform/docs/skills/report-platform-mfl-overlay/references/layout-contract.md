# MFL Layout Contract

## Supported Baselines

The generic overlay worker accepts a normalized `LayoutMapData` JSON object or an object containing it under `layoutMap`.

Required fields:

- `id`
- `appMap.surfaceType: "floor"`
- non-empty `plates[]`
- unique, stable `plates[].id`
- finite normalized plate bounds or polygon points
- `drawingBlock` and datum/reference metadata

A V3 app-owned baseline additionally requires:

- `appFigure.targetKey: "floor"`
- `appFigure.mediaType: "image/svg+xml"`
- `appFigure.sourceGeometryVersion: 2`
- a valid SVG payload
- app-resolved main and annular plate geometry

The plate registry may contain any number or arrangement of plates. The generic pipeline does not require the current 24-main-plus-10-annular training layout.

## Plate Matching

Match in this order:

1. normalized exact plate ID
2. explicit plate alias
3. user-confirmed mapping stored as a placement

Never match by PDF page order, nearest geometry, or inferred visual similarity without user confirmation.

Before matching, require every identified MFL page to contain a plate ID, physical width/height metadata, and an extractable plot image. Document text that merely mentions plate numbers is not sufficient.

Normalize harmless label differences only, such as `AR1` and `A1`, when the layout explicitly identifies the plate as annular. Preserve the source scan ID and host plate ID separately in audit metadata.

## Immutable Geometry Fingerprint

The verifier fingerprints:

- geometry source
- grid dimensions
- app map and reference datum
- app figure metadata and SVG checksum
- plate IDs, labels, aliases, bounds, polygons, label anchors, kinds, and sources
- marker IDs, types, coordinates, and sources
- drawing block

The fingerprint excludes `floorCorrosion` because overlays, transforms, and approvals are the intended output of composition.

Any fingerprint change is a product error. Correct the source export or mapping; do not accept a modified geometry result.

## Image Treatment

For every scan:

- detect and crop the actual plot
- save the cropped original plot as an immutable source preview
- build a second transparent PNG containing corrosion palette pixels only
- retain artifact checksums and pixel counts
- preserve aspect ratio during placement
- crop to host bounds rather than stretching
- clip first to the plate and then to the outer tank boundary

## Orientation State

Initial orientation is a suggestion, not approval. Store:

- rotation: `0`, `90`, `180`, or `270`
- legacy `flipX` and `flipY` fields remain `false` for package compatibility and are not exposed as product controls
- `scaleX` and `scaleY`: `0.5-2.5`, default `1`
- `offsetX` and `offsetY`: normalized host-plate fractions from `-0.75` to `0.75`, default `0`
- opacity
- status
- reviewer and review timestamp

Changing any transform invalidates prior approval. At scale `1`, the complete scan maps to the complete host bounds without source cropping. X scaling is left-anchored, Y scaling is top-anchored, and offsets translate the complete placement rectangle. The immutable source preview artifact and checksum remain unchanged; the UI applies rotation only for direction comparison and never applies overlay scale or offset to that preview.

## Fail-Closed Conditions

Block composition or final approval when:

- layout IDs are missing or duplicated
- plate geometry is invalid
- a required app figure is absent or malformed
- scans are unmatched, duplicated, or ambiguous
- an overlay references a missing host plate
- a source preview is absent
- corrosion pixels extend through an invalid artifact
- geometry fingerprint changes
- orientation remains unreviewed for final issue

The default preflight also requires equal scan/layout plate counts and a scan for every layout plate. Use partial coverage only through the explicit `--allow-partial` path; it never permits an unmatched or ambiguous supplied scan.
