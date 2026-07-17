import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { PNG } from "pngjs";
import { buildLayoutMapFigureSvg } from "../layout-map-figure.mjs";
import {
  composeFloorCorrosionMap,
  extractMflPlateScans,
  inspectMflPlateMetadata,
  MFL_CORROSION_PALETTE,
  validateMflLayoutMatch,
} from "../floor-corrosion.mjs";
import { createFloorCorrosionArtifactService } from "../floor-corrosion-artifacts.mjs";

const referencePdf = process.env.REPORT_PLATFORM_MFL_REFERENCE_PDF ||
  "/Users/oscar/Public/irs/mfl and floor layout /MFL Individual Plate Maps.pdf";
const sourceLayoutPdf = process.env.REPORT_PLATFORM_FLOOR_LAYOUT_REFERENCE_PDF ||
  "/Users/oscar/Public/irs/mfl and floor layout /18PE1-3 TK SU4 Internal & External Inspection Report.pdf";
const expectedPlateIds = [
  "1.1", "1.2", "1.3", "1.4", "1.5",
  "2.1", "2.2", "2.3",
  "3.1", "3.2",
  "4.1", "4.2", "4.3",
  "5.1", "5.2",
  "6.1", "6.2a", "6.2b", "6.3",
  "7.1", "7.2", "7.3", "7.4", "7.5",
  "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10",
];

const workingDirectory = mkdtempSync(join(tmpdir(), "laiq-floor-corrosion-audit-"));
try {
  const extractionManifest = extractMflPlateScans({
    pdfPath: referencePdf,
    outputDirectory: join(workingDirectory, "scans"),
  });
  assert(extractionManifest.scanCount === 34, `Expected 34 MFL scans, received ${extractionManifest.scanCount}.`);
  assert(extractionManifest.issues.length === 0, "Reference MFL extraction contains issues.");
  assert(
    JSON.stringify(extractionManifest.scans.map((scan) => scan.plateId)) === JSON.stringify(expectedPlateIds),
    "Reference MFL plate order or identifiers changed.",
  );
  assert(extractionManifest.scans.every((scan) => scan.corrosionPixelCount > 0), "Every reference plate must contain corrosion pixels.");

  auditTransparentArtifacts(extractionManifest, join(workingDirectory, "scans"));
  auditSourcePreviewArtifacts(extractionManifest, join(workingDirectory, "scans"));
  const layoutMap = buildAuditLayout(expectedPlateIds);
  const metadataManifest = inspectMflPlateMetadata({ pdfPath: referencePdf });
  const matchingPreflight = validateMflLayoutMatch({
    layoutMap,
    metadataManifest,
    requireCompleteCoverage: true,
  });
  assert(matchingPreflight.ok, "Matching MFL/layout plate registries must pass preflight.");
  assert(matchingPreflight.matchedPlateCount === 34, "Preflight must match all 34 reference plates.");
  const mismatchedPreflight = validateMflLayoutMatch({
    layoutMap: {
      ...layoutMap,
      plates: layoutMap.plates.filter((plate) => plate.id !== "1.1"),
    },
    metadataManifest,
    requireCompleteCoverage: true,
  });
  assert(!mismatchedPreflight.ok, "A mismatched MFL/layout plate registry must fail preflight.");
  assert(
    mismatchedPreflight.unmatchedScanPlateIds.includes("1.1"),
    "Preflight must identify the unmatched MFL plate before image processing.",
  );
  const placements = expectedPlateIds.map((plateId) => ({
    scanPlateId: plateId,
    hostPlateId: plateId,
    rotationDegrees: 0,
    flipX: false,
    flipY: false,
    approved: true,
    reviewedByUserId: "audit-user",
    reviewedAtIso: "2026-01-01T00:00:00.000Z",
  }));
  const composed = composeFloorCorrosionMap({
    layoutMap,
    extractionManifest,
    artifactDirectory: join(workingDirectory, "scans"),
    includeInlineImages: true,
    placements,
    artifactRunId: "00000000-0000-4000-8000-000000000001",
    sourceLayoutName: "audit floor layout",
  });
  assert(composed.floorCorrosion.overlays.length === 34, "All exact plate IDs should produce overlays.");
  assert(composed.floorCorrosion.unmatchedScanPlateIds.length === 0, "No reference scan should be unmatched.");
  assert(composed.floorCorrosion.overlays.every((overlay) => overlay.status === "approved"), "Approved placements should remain approved.");
  assert(
    composed.floorCorrosion.overlays.every((overlay) => overlay.sourcePreviewInlineImageDataUrl?.startsWith("data:image/png;base64,")),
    "Every composed overlay must retain its original source preview.",
  );

  const artifactService = createFloorCorrosionArtifactService({
    artifactRoot: join(workingDirectory, "artifacts"),
  });
  const sourceLayoutImport = artifactService.importLayoutPdf({
    reportJobId: "floor-corrosion-audit",
    pdfBuffer: readFileSync(sourceLayoutPdf),
    sourceDocumentName: "SU4 floor layout reference.pdf",
    sourcePage: 44,
    client: "Audit Tenant",
    tank: "SU4",
    reference: "AUDIT-001",
  });
  assert(sourceLayoutImport.layoutMap.plates.length === 34, "Source layout must expose 34 structured plate regions.");
  assert(
    sourceLayoutImport.layoutMap.sourceDrawing?.renderMode === "extracted_vector",
    "Source layout import must produce an extracted vector drawing.",
  );
  assert(
    sourceLayoutImport.layoutMap.sourceDrawing?.artifactUri.endsWith("/source-layout-vector.svg"),
    "Source layout import must not use a raster page artifact.",
  );
  const hydratedSourceLayout = artifactService.hydrateInlineArtifacts(
    "floor-corrosion-audit",
    sourceLayoutImport.layoutMap,
  );
  assert(
    hydratedSourceLayout.sourceDrawing.inlineImageDataUrl.startsWith("data:image/svg+xml;base64,"),
    "Source layout vector must hydrate as SVG.",
  );
  const extractedSvg = Buffer.from(
    hydratedSourceLayout.sourceDrawing.inlineImageDataUrl.split(",", 2)[1],
    "base64",
  ).toString("utf8");
  assert(extractedSvg.includes('viewBox="27.36 131.52 540 540"'), "Source SVG crop calibration changed.");
  assert(
    !/<script\b|<foreignObject\b|(?:href|xlink:href)\s*=\s*["']https?:\/\//i.test(extractedSvg),
    "Source SVG contains unsafe active content.",
  );

  const sourceComposed = composeFloorCorrosionMap({
    layoutMap: hydratedSourceLayout,
    extractionManifest,
    artifactDirectory: join(workingDirectory, "scans"),
    includeInlineImages: true,
    placements,
    artifactRunId: "00000000-0000-4000-8000-000000000002",
    sourceLayoutName: "extracted SU4 vector layout",
  });
  const sourceFigure = buildLayoutMapFigureSvg(sourceComposed);
  assert(sourceFigure.svg.includes("data:image/svg+xml;base64,"), "Composed map does not contain the source vector drawing.");
  const renderedSourceFigure = new Resvg(sourceFigure.svg, {
    fitTo: { mode: "width", value: 1080 },
    background: "#ffffff",
  }).render().asPng();
  assert(renderedSourceFigure.length > 100_000, "Composed vector floor map did not render as a substantive figure.");
  const firstOverlay = composed.floorCorrosion.overlays[0];
  const transformed = artifactService.updatePlacement({
    reportJobId: "floor-corrosion-audit",
    layoutMap: composed,
    scanPlateId: firstOverlay.scanPlateId,
    hostPlateId: firstOverlay.hostPlateId,
    rotationDegrees: 90,
    flipX: true,
    flipY: false,
    opacity: firstOverlay.opacity,
    approved: false,
    actorUserId: "audit-user",
  });
  const transformedOverlay = transformed.floorCorrosion.overlays[0];
  assert(
    transformedOverlay.status === "orientation_review_required",
    "Changing a placement must invalidate its prior approval.",
  );
  assert(
    transformed.floorCorrosion.validationIssues.some(
      (issue) => issue.code === "mfl_orientation_review_required" && issue.plateId === firstOverlay.scanPlateId,
    ),
    "Changing a placement must restore the orientation-review warning.",
  );
  const reapproved = artifactService.updatePlacement({
    reportJobId: "floor-corrosion-audit",
    layoutMap: transformed,
    scanPlateId: firstOverlay.scanPlateId,
    hostPlateId: firstOverlay.hostPlateId,
    rotationDegrees: 90,
    flipX: true,
    flipY: false,
    opacity: firstOverlay.opacity,
    approved: true,
    actorUserId: "audit-user",
  });
  assert(reapproved.floorCorrosion.overlays[0].status === "approved", "Explicit placement approval must be recorded.");
  assert(
    !reapproved.floorCorrosion.validationIssues.some(
      (issue) => issue.code === "mfl_orientation_review_required" && issue.plateId === firstOverlay.scanPlateId,
    ),
    "Explicit placement approval must clear its orientation-review warning.",
  );

  const figure = buildLayoutMapFigureSvg(composed);
  assert(figure?.svg.includes("floor-corrosion-overlay"), "Rendered SVG does not contain floor corrosion overlays.");
  assert(!figure.svg.includes("189,227,192"), "Rendered SVG unexpectedly contains the source grid color.");

  console.log(JSON.stringify({
    ok: true,
    referencePdf,
    sourceLayoutPdf,
    scanCount: extractionManifest.scanCount,
    overlayCount: composed.floorCorrosion.overlays.length,
    totalCorrosionPixels: extractionManifest.scans.reduce((total, scan) => total + scan.corrosionPixelCount, 0),
    validationIssueCount: composed.floorCorrosion.validationIssues.length,
  }, null, 2));
} finally {
  rmSync(workingDirectory, { recursive: true, force: true });
}

function auditTransparentArtifacts(manifest, artifactDirectory) {
  const allowedColors = new Set(MFL_CORROSION_PALETTE.map((band) => band.rgb.join(",")));
  for (const scan of manifest.scans) {
    const png = PNG.sync.read(readFileSync(join(artifactDirectory, scan.artifactFileName)));
    let transparentPixelCount = 0;
    let opaquePixelCount = 0;
    for (let offset = 0; offset < png.data.length; offset += 4) {
      if (png.data[offset + 3] === 0) {
        transparentPixelCount += 1;
        continue;
      }
      opaquePixelCount += 1;
      const color = `${png.data[offset]},${png.data[offset + 1]},${png.data[offset + 2]}`;
      assert(allowedColors.has(color), `Plate ${scan.plateId} contains a non-corrosion output color: ${color}.`);
    }
    assert(transparentPixelCount > 0, `Plate ${scan.plateId} did not remove the scan grid/background.`);
    assert(opaquePixelCount === scan.corrosionPixelCount, `Plate ${scan.plateId} pixel statistics do not match its PNG.`);
  }
}

function auditSourcePreviewArtifacts(manifest, artifactDirectory) {
  for (const scan of manifest.scans) {
    assert(scan.sourcePreviewFileName, `Plate ${scan.plateId} is missing its source preview filename.`);
    const overlay = PNG.sync.read(readFileSync(join(artifactDirectory, scan.artifactFileName)));
    const sourcePreviewBuffer = readFileSync(join(artifactDirectory, scan.sourcePreviewFileName));
    const sourcePreview = PNG.sync.read(sourcePreviewBuffer);
    assert(sourcePreview.width === overlay.width, `Plate ${scan.plateId} source preview width changed.`);
    assert(sourcePreview.height === overlay.height, `Plate ${scan.plateId} source preview height changed.`);
    assert(scan.sourcePreviewSha256 !== scan.artifactSha256, `Plate ${scan.plateId} source preview duplicates the processed overlay.`);
    assert(sourcePreview.data.some((value, index) => index % 4 !== 3 && value > 0), `Plate ${scan.plateId} source preview is blank.`);
  }
}

function buildAuditLayout(plateIds) {
  const columns = 5;
  const rows = Math.ceil(plateIds.length / columns);
  const width = 0.78 / columns;
  const height = 0.78 / rows;
  return {
    id: "floor-corrosion-audit",
    title: "Floor Plate Corrosion Plan",
    subtitle: "Deterministic MFL overlay audit",
    surfaceLabel: "Floor/bottom plate layout",
    legend: [],
    markers: [],
    plates: plateIds.map((plateId, index) => ({
      id: plateId,
      label: plateId,
      row: Math.floor(index / columns) + 1,
      column: (index % columns) + 1,
      x: 0.11 + (index % columns) * width,
      y: 0.11 + Math.floor(index / columns) * height,
      width,
      height,
      source: "audit:floor-layout",
    })),
    gridRows: rows,
    gridColumns: columns,
    drawingBlock: {
      client: "Audit Tenant",
      project: "Floor corrosion pipeline audit",
      drawing: "Audit",
      reference: "AUDIT-001",
      referenceMode: "Tank North",
      updatedAtLabel: "2026-01-01",
    },
    appMap: {
      surfaceType: "floor",
      referenceMode: "Tank North",
    },
    overrideCount: 0,
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
