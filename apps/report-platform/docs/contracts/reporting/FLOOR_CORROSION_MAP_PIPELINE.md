# Floor Corrosion Map Pipeline

## Purpose

The floor-corrosion pipeline combines an approved floor plate layout with individual MFL plate scans to produce one report-ready corrosion plan.

The floor layout originates in the LAIQ inspection app export. The MFL plate-map PDF does not originate in the app export; the Inspector uploads it directly from the authenticated report-generation workspace after the report job exists.

The rendering operation is deterministic:

```text
original floor drawing + approved geometry profile
+ individual MFL plate-map PDF
+ reviewed plate orientation
-> extract corrosion pixels
-> retain cropped original scan for verification
-> match plate identifiers
-> resize and clip to host plates
-> browser/DOCX corrosion map
```

The pipeline does not ask an LLM to redraw corrosion or infer plate positions.

## Inputs

### 1. Approved floor layout

The floor layout must contain a normalized plate registry:

- stable plate ID and label
- normalized plate bounding box
- optional polygon points for sketch and annular plates
- tank datum/reference mode
- elements and findings that must remain visible

The LAIQ inspection app layout is the authoritative field-data baseline. The V3 mock task generates the current 24 bottom plates, split `6.2a/6.2b` plate, and 10 AR sections through the app layout tool. V3 exports `resolvedGeometryVersion: 2`, `resolvedMainPlateGeometry`, and `resolvedAnnularPlateGeometry`, containing stable IDs, display labels, label anchors, normalized bounds, and annular polygon points resolved by the same Kotlin tool used on the mobile screen. Exported element coordinates use the same normalized map coordinate system. The app also exports a checksum-verified SVG in `layoutFigures[]`; report-platform embeds that exact artifact for the unmodified floor map and uses the structured geometry for interaction and corrosion-plate clipping.

V3 imports fail closed when the resolved floor geometry is absent or incomplete. Report-platform does not reconstruct a V3 floor from row weights, annular count, or rotation. Equation-based reconstruction remains available only for older package schemas that predate the resolved-geometry contract and can never override a valid app-resolved payload.

For legacy inspections where the app export does not contain the required plate registry, the user can additionally import the original engineering floor-layout PDF used by the inspection package.

For a valid V3 export, report-platform rejects replacement floor-layout imports. The app-owned SVG, resolved plate polygons, element positions, finding positions, datum, and drawing metadata form one immutable baseline. MFL import may add corrosion artifacts and reviewed transforms only; it cannot change that baseline.

A legacy PDF or CAD floor drawing can be used only through a versioned, approved geometry profile. The current source-driven test case uses `su4_floor_34_plate_v1`, calibrated from the source drawing's vector seams. It provides 24 central plate polygons and 10 annular-ring polygons. An unknown drawing must not be silently forced through this profile.

The imported source page is duplicated as one sanitized vector SVG artifact. It preserves the source PDF paths for symbols, labels, nozzles, patches, north arrow, legend, and plate seams. The platform does not display a cropped raster screenshot of the report page.

The approved geometry profile remains a separate structured plate registry. It gives each source plate a stable clickable polygon and clip region without replacing or redrawing the source engineering map.

### 2. Individual MFL plate maps

The current worker accepts one PDF containing one individual plate map per page. It reads:

- plate ID
- physical width and height
- calibration label
- source page
- embedded scan-plot image

The worker uses `pdftotext` for metadata and `pdfimages` for the embedded plot. These tools belong in the queue-worker image in a cloud deployment.

### 3. Placement review

An exact plate-ID match determines the host plate, but it does not prove scan orientation. Each plate can therefore store:

- rotation: `0`, `90`, `180`, or `270` degrees
- independent X and Y scale for one-sided size refinement
- normalized X and Y offset within the host plate
- opacity
- reviewer and review timestamp

Unmatched, duplicate, or ambiguous IDs are blocked. Unreviewed orientation remains visible as `orientation_review_required` and cannot be treated as final issue evidence.

## Extraction

Before image extraction, the worker performs a metadata-only preflight using the plate names/numbers reported on each PDF page and the `pdfimages -list` inventory. Every identified page must contain a plate ID, physical width/height metadata, and an extractable scan plot. Every supplied scan must then resolve to exactly one stable layout plate ID or explicit alias. Duplicate scan IDs, unknown names, ambiguous aliases, duplicate host assignments, count differences, or missing layout plates fail the import before `pdfimages -png` starts. Complete one-to-one coverage is the product default; partial coverage requires an explicit approved workflow and still rejects every unmatched supplied scan.

Each embedded scan plot is cropped to its plot bounds. The worker then removes:

- grid lines
- axis labels
- white scan background
- grey padding
- black offsets/dead zones
- page header, comments, track diagrams, and legend blocks

Only pixels belonging to the original MFL corrosion bands are retained in a transparent PNG:

| Material loss | Output color |
| --- | --- |
| 30% | cyan |
| 40% | green |
| 50% | blue |
| 60% | red |
| 70% | magenta |
| 75% | dark magenta |
| 80% | purple |

The worker records a SHA-256 checksum, extracted pixel count, and per-band count for each plate artifact.

The same extraction run also stores a second, immutable source-preview PNG for each plate. This preview preserves the original cropped plot, including its grid, padding, dead zones, and corrosion pixels. It is never used as the map overlay; it exists only so an inspector can compare the processed overlay with its true MFL source. The source preview has its own artifact URI and SHA-256 checksum and remains linked to the plate ID, source document, source page, and physical dimensions. In the review UI, the immutable preview is presented with the current rotation so its direction matches the final placement. X/Y scale and offset are intentionally excluded from the source preview and remain visible only on the composed map.

## Composition

For each approved match, the renderer:

1. locates the host floor plate by stable ID
2. obtains the plate rectangle or polygon
3. applies the reviewed rotation
4. maps the complete scan to the host bounds at 100%, then applies left-anchored X scale, top-anchored Y scale, and normalized X/Y offset
5. resizes the transparent corrosion image relative to the host plate bounds
6. clips it to the original plate shape
7. applies a second outer-tank clip so overlapping plate polygons cannot paint beyond the annular boundary
8. preserves the exact app-exported SVG as the visible base map

The source floor layout is never overwritten in storage. "Overwrite" is a presentation-layer composite so the original layout and MFL artifacts remain independently auditable.

The browser does not switch to a separately reconstructed map after MFL import. It renders the same checksum-verified app SVG before and after import, with transparent corrosion pixels added above it. It also does not redraw duplicate web seams over the app figure. Main-plate hit targets are ordered above overlapping annular hit targets so an inspector can select an internal plate such as `1.1`; annular plates remain selectable around the perimeter.

## Product Workflow

In the `Floor Plate Corrosion Plan` section:

1. Load the LAIQ inspection app export.
2. Open the floor-corrosion report section.
3. Confirm the V3 app-export floor layout is loaded. Import an original floor-layout PDF only through the legacy workflow when no app-resolved floor geometry exists.
4. Confirm that the map resolves all expected structured plate regions.
5. Select `Import MFL Plate Maps` and choose the individual-plate PDF.
6. Review the matched, unmatched, and orientation-review counts.
7. Click a plate label or visible plate area to inspect its scan.
8. Compare the assembled corrosion layer with the original MFL plate preview shown beside the map.
9. Use the compact plate-refinement controls beneath the original preview to adjust Size X, Size Y, Offset X, Offset Y, or rotation if necessary.
10. Confirm that rotation orients the source preview in the same direction as the map overlay, Size X moves only the right edge, Size Y moves only the bottom edge, and offsets translate without resizing. The underlying source-preview pixels and checksum remain unchanged.
11. Use `Reset` to return to the neutral transform when a refinement is not suitable.
12. Select `Approve Placement` only after the overlay matches the original MFL plate orientation and host-plate location.
13. Review the complete corrosion plan and approve the report section.
14. Export the approved section to DOCX.

The app mock is test data, not evidence for a real inspection. A production report uses the authenticated app export's approved floor geometry. When the legacy PDF path is used, the extracted source vector drawing is retained as the visual baseline; the MFL layer does not redraw its geometry or omit its engineering symbols.

Layout-map provenance controls merge behavior: app-export geometry preserves app markers, while an explicitly approved report-side layout or reference-test fixture preserves the markers belonging to that replacement geometry. The two source classes are never silently blended.

Any X/Y resize, X/Y offset, rotation, or host-plate change invalidates the prior placement approval. Scale is constrained to `0.5-2.5` of the plate placement rectangle and offset to `-0.75-0.75` of the host plate dimension. The report section cannot be approved until an MFL source is present, matching errors are resolved, and every placed scan is explicitly approved.

Browser preview and DOCX use the same normalized floor-map, plate, transform, clipping, and corrosion-band contract. The browser and server renderers are separately implemented and covered by the same focused audit expectations.

## API

Authenticated report-job endpoints:

```text
POST  /api/v1/report-jobs/:reportJobId/floor-corrosion/mfl-import
POST  /api/v1/report-jobs/:reportJobId/floor-corrosion/layout-import
PATCH /api/v1/report-jobs/:reportJobId/floor-corrosion/placements
GET   /api/v1/report-jobs/:reportJobId/floor-corrosion/artifacts/:runId/:fileName
```

The import endpoint accepts `application/pdf` with a maximum size of 100 MB. Artifact reads require report-job read permission. Placement changes require report-job edit permission.

`layout-import` is a compatibility endpoint for legacy packages only. It returns `409 app_floor_layout_locked` when the report job contains a valid V3 app-owned floor figure.

## CLI Worker

```bash
npm --prefix apps/report-platform run floor-corrosion:build -- \
  --layout /path/to/floor-layout-map.json \
  --mfl /path/to/mfl-individual-plate-maps.pdf \
  --output /path/to/output-directory \
  --placements /path/to/approved-placements.json
```

Outputs:

- extracted transparent plate PNGs
- MFL extraction manifest
- floor-corrosion map manifest
- self-contained SVG preview

## Storage And Scale

MFL persistence uses one product path:

1. The authenticated API writes the uploaded PDF to a private temporary processing run.
2. The deterministic worker performs plate preflight, extraction, grid removal, and composition without changing the app layout.
3. The source PDF, manifests, transparent corrosion PNGs, immutable source-preview PNGs, and any sanitized source-layout SVG are uploaded to S3-compatible object storage under opaque keys.
4. PostgreSQL records report, tenant, workspace, run, relative artifact role, media type, byte size, SHA-256, and creating user.
5. The temporary processing run is deleted after persistence, including on controlled failures.
6. Browser artifact routes and DOCX hydration read only through PostgreSQL metadata and checksum-verified object storage. There is no local-disk durability fallback.
7. A successful re-import replaces the report layout override and removes the superseded MFL artifact run.

Queue workers remain the next scale step so PDF extraction and composition do not occupy interactive API processes. Tenant/workspace authorization applies to every source, artifact, and generated figure.

## Validation

```bash
npm --prefix apps/report-platform run floor-corrosion:audit
npm --prefix apps/report-platform run floor-corrosion:durability-audit
npm --prefix apps/report-platform run floor-corrosion:object-storage-audit
npm --prefix apps/report-platform run build
npm --prefix apps/report-platform run logic:audit
```

The focused reference audit checks:

- metadata preflight accepts the matching 34-plate package and rejects an intentionally mismatched registry
- 34 expected individual MFL pages are extracted
- all expected plate identifiers remain unique and ordered
- output artifacts contain only transparent pixels or configured corrosion-band colors
- every processed overlay has a distinct, dimension-matched original source preview
- rotation updates the source preview direction, while one-sided X/Y scale and offset remain map-only and the immutable source-preview checksum stays unchanged
- every placement refinement invalidates approval until the user explicitly approves the adjusted result
- grid/background colors are absent
- exact plate matches render as clipped SVG overlays
- app-owned geometry survives legacy/replacement overrides unchanged
- corrosion overlays remain clipped to both their host plate and the outer tank boundary
- the source drawing remains an immutable sanitized vector layer above the clipped corrosion overlays
- the source layout artifact cannot regress to a raster page screenshot
- the browser and DOCX figure paths can render the same source-driven composition
- local processor output is deleted after durable persistence
- PostgreSQL ownership metadata and object-storage checksums are required for browser and DOCX reads
- the real 34-plate V3/MFL integration persists 71 source/manifest/overlay/preview objects and reloads the composed figure from S3-compatible storage

The completed corrosion map is an evaluator-only gold artifact. It is never loaded by the generation route. Visual evaluation compares seam topology, fixed engineering symbols, and corrosion placement after generation; it does not expose gold pixels to the composer.

The reference PDFs under `/Users/oscar/Public/irs/mfl and floor layout /` are read-only validation inputs and are not copied into the repository.
