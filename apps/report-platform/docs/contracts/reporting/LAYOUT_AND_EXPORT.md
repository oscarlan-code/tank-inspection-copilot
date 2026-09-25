# Layout and export contract

## Boundary

Layout figures and document structure are deterministic report artifacts. AI may
describe a verified artifact in a declared narrative slot; it never creates,
reconstructs, moves, or validates geometry.

## Ownership

- The LAIQ app owns V3 roof, shell, and floor baseline geometry plus its
  checksum-verified report SVG.
- Report-platform owns evidence overlays, browser placement, semantic document
  blocks, approval state, and DOCX/PDF rendering.
- The MFL workflow may place reviewed corrosion overlays on the immutable floor
  layout; it cannot replace or modify that layout.
- The ReportPlan determines which visual/measurement sections exist and binds each
  to an exact agent/tool/renderer release.

## Required preservation

Preserve stable surface, plate, course, lane, element, finding, photograph,
measurement-row, and source-artifact identities. Browser and export must use the
same normalized geometry, figure bytes or deterministic renderer inputs, layer
order, captions, and section references.

Missing or mismatched geometry, unsafe SVG, checksum failure, ambiguous MFL plate
mapping, unapproved placement, or unavailable renderer blocks the affected visual
section. Do not synthesize replacement geometry or fall back to a legacy figure.

## MFL placement

```text
immutable floor layout + source MFL document
  -> plate identity/count preflight
  -> grid-free transparent corrosion extraction
  -> exact plate mapping
  -> reviewer scale/offset/rotation
  -> approved placement manifest
  -> clipped deterministic overlay
```

Retain the source PDF, untouched source preview, extraction manifest, overlay,
placement revision, checksums, reviewer, and composed artifact. The source floor
layout fingerprint must remain unchanged.

Detailed extraction/placement rules live in `FLOOR_CORROSION_MAP_PIPELINE.md`.

## Semantic document

Section agents emit typed blocks such as heading, narrative, labelled fields,
measurement/checklist/calculation table, figure, photo group, and cross-reference.
The Report Integrator validates required blocks, relationships, styles, and
dependencies before producing one ReportDocument.

Browser, DOCX, and future PDF consume the same approved ReportDocument snapshot.
Export includes only selected approved non-stale content. Heading hierarchy, table
cells/spans, values/units, figure identity/caption, repeated headers/footers, and
pagination rules are deterministic.

## Review and validation

- compare browser and DOCX/PDF renders for representative sections;
- verify figures and overlays against source previews;
- check geometry fingerprints before and after composition;
- reject unapproved sections and stale ReportPlan/SectionPlan bindings;
- test tables, page breaks, headings, captions, and cross-references;
- record renderer/tool/release hashes in the generation/export trace.

Use `REPORT_SECTION_FORMAT_CONTRACT.md` for section-block formatting and
`GENERATED_CONTENT_CONTROL_SYSTEM.md` for controlled edit/version rules.
