import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { PNG } from "pngjs";

const MAX_MFL_PDF_BYTES = 100 * 1024 * 1024;
const TOOL_TIMEOUT_MS = 120_000;

export const MFL_CORROSION_PALETTE = Object.freeze([
  { minimumLossPercent: 30, color: "#12fbff", rgb: [18, 251, 255] },
  { minimumLossPercent: 40, color: "#0ec800", rgb: [14, 200, 0] },
  { minimumLossPercent: 50, color: "#001dc8", rgb: [0, 29, 200] },
  { minimumLossPercent: 60, color: "#ef0700", rgb: [239, 7, 0] },
  { minimumLossPercent: 70, color: "#dc006e", rgb: [220, 0, 110] },
  { minimumLossPercent: 75, color: "#5b004e", rgb: [91, 0, 78] },
  { minimumLossPercent: 80, color: "#470073", rgb: [71, 0, 115] },
]);

export function assertMflWorkerAvailable() {
  for (const executable of ["pdftotext", "pdfimages"]) {
    try {
      execFileSync(executable, ["-v"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 10_000,
      });
    } catch (error) {
      if (error?.status === 0) continue;
      throw new Error(`Required MFL worker tool is unavailable: ${executable}.`);
    }
  }
}

export function extractMflPlateScans({
  pdfPath,
  outputDirectory,
  sourceDocumentName = basename(pdfPath),
  metadataManifest,
}) {
  validatePdfInput(pdfPath);
  assertMflWorkerAvailable();
  mkdirSync(outputDirectory, { recursive: true });

  const sourceBuffer = readFileSync(pdfPath);
  const sourceSha256 = sha256(sourceBuffer);
  if (metadataManifest?.sourceSha256 && metadataManifest.sourceSha256 !== sourceSha256) {
    throw new Error("MFL metadata preflight does not belong to the supplied PDF.");
  }
  const pageMetadata = metadataManifest?.pages ?? parseMflPageMetadata(extractPdfText(pdfPath));
  const imageInventory = listPdfImages(pdfPath);
  const selectedPlots = selectPlotImageByPage(imageInventory);
  const extractionDirectory = mkdtempSync(join(tmpdir(), "laiq-mfl-images-"));
  const issues = [];
  const scans = [];

  try {
    const imagePrefix = join(extractionDirectory, "image");
    execFileSync("pdfimages", ["-png", pdfPath, imagePrefix], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: TOOL_TIMEOUT_MS,
    });

    for (const metadata of pageMetadata) {
      if (!metadata.plateId) {
        issues.push({
          code: "mfl_plate_id_missing",
          severity: "error",
          sourcePage: metadata.sourcePage,
          message: `MFL page ${metadata.sourcePage} does not contain a plate identifier.`,
        });
        continue;
      }

      const imageRecord = selectedPlots.get(metadata.sourcePage);
      if (!imageRecord) {
        issues.push({
          code: "mfl_plot_image_missing",
          severity: "error",
          plateId: metadata.plateId,
          sourcePage: metadata.sourcePage,
          message: `No scan plot image was found on MFL page ${metadata.sourcePage}.`,
        });
        continue;
      }

      const extractedImagePath = resolveExtractedImagePath(extractionDirectory, imageRecord.imageNumber);
      if (!extractedImagePath) {
        issues.push({
          code: "mfl_extracted_image_missing",
          severity: "error",
          plateId: metadata.plateId,
          sourcePage: metadata.sourcePage,
          message: `The embedded scan plot for plate ${metadata.plateId} was not extracted.`,
        });
        continue;
      }

      const result = isolateCorrosionPixels(readFileSync(extractedImagePath));
      const artifactFileName = `${safeFilePart(metadata.plateId)}-${sourceSha256.slice(0, 10)}.png`;
      const sourcePreviewFileName = `${safeFilePart(metadata.plateId)}-${sourceSha256.slice(0, 10)}-source.png`;
      const artifactPath = join(outputDirectory, artifactFileName);
      const sourcePreviewPath = join(outputDirectory, sourcePreviewFileName);
      writeFileSync(artifactPath, result.pngBuffer);
      writeFileSync(sourcePreviewPath, result.sourcePreviewPngBuffer);

      if (result.corrosionPixelCount === 0) {
        issues.push({
          code: "mfl_no_corrosion_pixels",
          severity: "warning",
          plateId: metadata.plateId,
          sourcePage: metadata.sourcePage,
          message: `Plate ${metadata.plateId} contains no pixels in the configured corrosion bands.`,
        });
      }

      scans.push({
        id: randomUUID(),
        plateId: metadata.plateId,
        sourcePage: metadata.sourcePage,
        sourceDocumentName: sanitizeSourceDocumentName(sourceDocumentName),
        widthMm: metadata.widthMm,
        heightMm: metadata.heightMm,
        calibration: metadata.calibration,
        artifactFileName,
        artifactSha256: sha256(result.pngBuffer),
        sourcePreviewFileName,
        sourcePreviewSha256: sha256(result.sourcePreviewPngBuffer),
        artifactWidth: result.width,
        artifactHeight: result.height,
        plotCrop: result.plotCrop,
        corrosionPixelCount: result.corrosionPixelCount,
        bands: result.bands,
      });
    }
  } finally {
    rmSync(extractionDirectory, { recursive: true, force: true });
  }

  const duplicatePlateIds = findDuplicates(scans.map((scan) => normalizePlateId(scan.plateId)));
  for (const duplicatePlateId of duplicatePlateIds) {
    issues.push({
      code: "mfl_duplicate_plate_id",
      severity: "error",
      plateId: duplicatePlateId,
      message: `More than one MFL page resolves to plate ${duplicatePlateId}.`,
    });
  }

  const manifest = {
    schemaVersion: 1,
    sourceDocumentName: sanitizeSourceDocumentName(sourceDocumentName),
    sourceSha256,
    extractedAtIso: new Date().toISOString(),
    scanCount: scans.length,
    scans,
    issues,
  };

  writeFileSync(
    join(outputDirectory, "mfl-extraction-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
}

export function inspectMflPlateMetadata({
  pdfPath,
  sourceDocumentName = basename(pdfPath),
}) {
  validatePdfInput(pdfPath);
  assertMflWorkerAvailable();
  const sourceBuffer = readFileSync(pdfPath);
  const imageInventory = listPdfImages(pdfPath);
  const selectedPlots = selectPlotImageByPage(imageInventory);
  const pages = parseMflPageMetadata(extractPdfText(pdfPath)).map((page) => ({
    ...page,
    plotImageNumber: selectedPlots.get(page.sourcePage)?.imageNumber ?? null,
  }));
  const issues = [];

  for (const page of pages) {
    if (!page.plateId) {
      issues.push({
        code: "mfl_plate_id_missing",
        severity: "error",
        sourcePage: page.sourcePage,
        message: `MFL page ${page.sourcePage} does not contain a plate identifier.`,
      });
    }
    if (page.plateId && (!Number.isFinite(page.widthMm) || !Number.isFinite(page.heightMm))) {
      issues.push({
        code: "mfl_plate_dimensions_missing",
        severity: "error",
        plateId: page.plateId,
        sourcePage: page.sourcePage,
        message: `MFL page ${page.sourcePage} for plate ${page.plateId} is missing physical width or height metadata.`,
      });
    }
    if (page.plateId && page.plotImageNumber == null) {
      issues.push({
        code: "mfl_plot_image_missing",
        severity: "error",
        plateId: page.plateId,
        sourcePage: page.sourcePage,
        message: `MFL page ${page.sourcePage} for plate ${page.plateId} has no extractable scan plot.`,
      });
    }
  }

  for (const duplicatePlateId of findDuplicates(pages.map((page) => normalizePlateId(page.plateId)))) {
    issues.push({
      code: "mfl_duplicate_plate_id",
      severity: "error",
      plateId: duplicatePlateId,
      message: `More than one MFL page resolves to plate ${duplicatePlateId}.`,
    });
  }

  return {
    schemaVersion: 1,
    sourceDocumentName: sanitizeSourceDocumentName(sourceDocumentName),
    sourceSha256: sha256(sourceBuffer),
    pageCount: pages.length,
    pages,
    issues,
  };
}

export function validateMflLayoutMatch({
  layoutMap,
  metadataManifest,
  placements = [],
  requireCompleteCoverage = true,
}) {
  const layoutPlates = Array.isArray(layoutMap?.plates) ? layoutMap.plates : [];
  const pages = Array.isArray(metadataManifest?.pages) ? metadataManifest.pages : [];
  const plateAliasIndex = buildPlateAliasIndex(layoutPlates);
  const placementByScanId = new Map(
    placements.map((placement) => [normalizePlateId(placement.scanPlateId), placement]),
  );
  const issues = [...(metadataManifest?.issues ?? [])];
  const matches = [];
  const matchedHostPlateIds = new Set();
  const unmatchedScanPlateIds = [];

  if (layoutPlates.length === 0) {
    issues.push({
      code: "mfl_layout_plates_missing",
      severity: "error",
      message: "The floor layout contains no stable plate registry.",
    });
  }
  if (pages.length === 0) {
    issues.push({
      code: "mfl_scan_pages_missing",
      severity: "error",
      message: "The MFL PDF contains no identifiable plate pages.",
    });
  }

  for (const page of pages) {
    if (!page.plateId) continue;
    const normalizedScanId = normalizePlateId(page.plateId);
    const placement = placementByScanId.get(normalizedScanId);
    const requestedHostId = placement?.hostPlateId ?? page.plateId;
    const candidatePlates = plateAliasIndex.get(normalizePlateId(requestedHostId)) ?? [];

    if (candidatePlates.length !== 1) {
      unmatchedScanPlateIds.push(page.plateId);
      issues.push({
        code: candidatePlates.length === 0 ? "mfl_host_plate_missing" : "mfl_host_plate_ambiguous",
        severity: "error",
        plateId: page.plateId,
        sourcePage: page.sourcePage,
        message: candidatePlates.length === 0
          ? `MFL plate ${page.plateId} does not match a floor-layout plate ID or alias.`
          : `MFL plate ${page.plateId} matches more than one floor-layout plate.`,
      });
      continue;
    }

    const hostPlate = candidatePlates[0];
    if (matchedHostPlateIds.has(hostPlate.id)) {
      issues.push({
        code: "mfl_host_plate_duplicate_assignment",
        severity: "error",
        plateId: page.plateId,
        sourcePage: page.sourcePage,
        message: `More than one MFL scan is assigned to floor-layout plate ${hostPlate.id}.`,
      });
      continue;
    }

    matchedHostPlateIds.add(hostPlate.id);
    matches.push({
      scanPlateId: page.plateId,
      sourcePage: page.sourcePage,
      hostPlateId: hostPlate.id,
      hostPlateLabel: hostPlate.label ?? hostPlate.id,
      matchedBy: normalizePlateId(page.plateId) === normalizePlateId(hostPlate.id) ? "id" : "alias_or_override",
    });
  }

  const platesWithoutScans = layoutPlates
    .filter((plate) => !matchedHostPlateIds.has(plate.id))
    .map((plate) => plate.id);

  if (requireCompleteCoverage && pages.length !== layoutPlates.length) {
    issues.push({
      code: "mfl_plate_count_mismatch",
      severity: "error",
      message: `MFL/layout plate count mismatch: ${pages.length} identifiable scan page(s), ${layoutPlates.length} layout plate(s).`,
    });
  }
  if (requireCompleteCoverage && platesWithoutScans.length > 0) {
    issues.push({
      code: "mfl_layout_plate_scan_missing",
      severity: "error",
      message: `No MFL scan matches layout plate(s): ${platesWithoutScans.join(", ")}.`,
    });
  }

  const errorIssues = issues.filter((issue) => issue.severity === "error");
  return {
    ok: errorIssues.length === 0,
    scanPlateCount: pages.length,
    layoutPlateCount: layoutPlates.length,
    matchedPlateCount: matches.length,
    matches,
    unmatchedScanPlateIds,
    platesWithoutScans,
    issues,
  };
}

export function composeFloorCorrosionMap({
  layoutMap,
  extractionManifest,
  artifactDirectory,
  artifactBaseUri = "",
  placements = [],
  includeInlineImages = false,
  sourceLayoutName = "LAIQ floor layout",
  artifactRunId = "local-preview",
}) {
  const layoutPlates = Array.isArray(layoutMap?.plates) ? layoutMap.plates : [];
  const scans = Array.isArray(extractionManifest?.scans) ? extractionManifest.scans : [];
  const placementByScanId = new Map(
    placements.map((placement) => [normalizePlateId(placement.scanPlateId), placement]),
  );
  const platesByAlias = buildPlateAliasIndex(layoutPlates);
  const validationIssues = [];
  const overlays = [];
  const matchedHostPlateIds = new Set();
  const unmatchedScanPlateIds = [];

  for (const scan of scans) {
    const normalizedScanId = normalizePlateId(scan.plateId);
    const placement = placementByScanId.get(normalizedScanId);
    const requestedHostId = placement?.hostPlateId ?? scan.plateId;
    const matches = platesByAlias.get(normalizePlateId(requestedHostId)) ?? [];

    if (matches.length !== 1) {
      unmatchedScanPlateIds.push(scan.plateId);
      validationIssues.push({
        code: matches.length === 0 ? "mfl_host_plate_missing" : "mfl_host_plate_ambiguous",
        severity: "error",
        plateId: scan.plateId,
        message: matches.length === 0
          ? `MFL plate ${scan.plateId} does not match a floor-layout plate.`
          : `MFL plate ${scan.plateId} matches more than one floor-layout plate.`,
      });
      continue;
    }

    const hostPlate = matches[0];
    const artifactPath = join(artifactDirectory, scan.artifactFileName);
    const sourcePreviewPath = scan.sourcePreviewFileName
      ? join(artifactDirectory, scan.sourcePreviewFileName)
      : null;
    if (!existsSync(artifactPath)) {
      validationIssues.push({
        code: "mfl_artifact_missing",
        severity: "error",
        plateId: scan.plateId,
        message: `The extracted corrosion artifact for plate ${scan.plateId} is missing.`,
      });
      continue;
    }
    if (!sourcePreviewPath || !existsSync(sourcePreviewPath)) {
      validationIssues.push({
        code: "mfl_source_preview_missing",
        severity: "error",
        plateId: scan.plateId,
        message: `The original MFL source preview for plate ${scan.plateId} is missing.`,
      });
      continue;
    }

    const rotationDegrees = normalizeRotation(
      placement?.rotationDegrees ?? inferInitialRotation(scan, hostPlate),
    );
    const isOrientationApproved = Boolean(placement?.approved);
    const artifactUri = artifactBaseUri
      ? `${artifactBaseUri.replace(/\/$/, "")}/${encodeURIComponent(scan.artifactFileName)}`
      : undefined;
    const sourcePreviewArtifactUri = artifactBaseUri
      ? `${artifactBaseUri.replace(/\/$/, "")}/${encodeURIComponent(scan.sourcePreviewFileName)}`
      : undefined;
    const inlineImageDataUrl = includeInlineImages
      ? `data:image/png;base64,${readFileSync(artifactPath).toString("base64")}`
      : undefined;
    const sourcePreviewInlineImageDataUrl = includeInlineImages
      ? `data:image/png;base64,${readFileSync(sourcePreviewPath).toString("base64")}`
      : undefined;

    overlays.push({
      id: `mfl-overlay-${safeFilePart(scan.plateId)}`,
      hostPlateId: hostPlate.id,
      scanPlateId: scan.plateId,
      sourcePage: scan.sourcePage,
      sourceDocumentName: extractionManifest.sourceDocumentName,
      sourceWidthMm: scan.widthMm,
      sourceHeightMm: scan.heightMm,
      artifactUri,
      inlineImageDataUrl,
      sourcePreviewArtifactUri,
      sourcePreviewInlineImageDataUrl,
      artifactSha256: scan.artifactSha256,
      sourcePreviewSha256: scan.sourcePreviewSha256,
      corrosionPixelCount: scan.corrosionPixelCount,
      bands: scan.bands,
      rotationDegrees,
      flipX: false,
      flipY: false,
      scaleX: clampNumber(placement?.scaleX ?? 1, 0.5, 2.5),
      scaleY: clampNumber(placement?.scaleY ?? 1, 0.5, 2.5),
      offsetX: clampNumber(placement?.offsetX ?? 0, -0.75, 0.75),
      offsetY: clampNumber(placement?.offsetY ?? 0, -0.75, 0.75),
      opacity: clampNumber(placement?.opacity ?? 0.88, 0.1, 1),
      status: isOrientationApproved ? "approved" : "orientation_review_required",
      reviewedByUserId: isOrientationApproved ? placement.reviewedByUserId : undefined,
      reviewedAtIso: isOrientationApproved ? placement.reviewedAtIso : undefined,
    });
    matchedHostPlateIds.add(hostPlate.id);

    if (!isOrientationApproved) {
      validationIssues.push({
        code: "mfl_orientation_review_required",
        severity: "warning",
        plateId: scan.plateId,
        message: `Plate ${scan.plateId} is matched, but its rotation and scan direction require user approval.`,
      });
    }
  }

  const platesWithoutScans = layoutPlates
    .filter((plate) => !matchedHostPlateIds.has(plate.id))
    .map((plate) => plate.label || plate.id);

  for (const issue of extractionManifest?.issues ?? []) {
    validationIssues.push({
      code: issue.code,
      severity: issue.severity,
      plateId: issue.plateId,
      message: issue.message,
    });
  }

  return {
    ...layoutMap,
    floorCorrosion: {
      schemaVersion: 1,
      artifactRunId,
      sourceLayoutName,
      sourceMflDocumentName: extractionManifest.sourceDocumentName,
      generatedAtIso: new Date().toISOString(),
      overlays,
      unmatchedScanPlateIds,
      platesWithoutScans,
      validationIssues,
    },
  };
}

function inferInitialRotation(scan, hostPlate) {
  if (hostPlate?.plateKind === "annular" || /^A(?:R)?\d+$/i.test(String(hostPlate?.id ?? ""))) {
    return 0;
  }

  const scanWidth = Number(scan?.widthMm) || Number(scan?.artifactWidth);
  const scanHeight = Number(scan?.heightMm) || Number(scan?.artifactHeight);
  const hostWidth = Number(hostPlate?.width);
  const hostHeight = Number(hostPlate?.height);
  if (![scanWidth, scanHeight, hostWidth, hostHeight].every((value) => Number.isFinite(value) && value > 0)) {
    return 0;
  }

  return (scanWidth >= scanHeight) === (hostWidth >= hostHeight) ? 0 : 90;
}

export function copyMflSourceForAudit(sourcePath, targetDirectory) {
  mkdirSync(targetDirectory, { recursive: true });
  const targetPath = join(targetDirectory, basename(sourcePath));
  copyFileSync(sourcePath, targetPath);
  return targetPath;
}

function validatePdfInput(pdfPath) {
  if (!existsSync(pdfPath)) throw new Error(`MFL PDF was not found: ${pdfPath}`);
  const stats = statSync(pdfPath);
  if (!stats.isFile()) throw new Error(`MFL PDF input is not a file: ${pdfPath}`);
  if (stats.size <= 0 || stats.size > MAX_MFL_PDF_BYTES) {
    throw new Error(`MFL PDF size must be between 1 byte and ${MAX_MFL_PDF_BYTES} bytes.`);
  }
  const magic = readFileSync(pdfPath).subarray(0, 5).toString("ascii");
  if (magic !== "%PDF-") throw new Error("MFL input is not a valid PDF file.");
}

function extractPdfText(pdfPath) {
  return execFileSync("pdftotext", ["-layout", "-enc", "UTF-8", pdfPath, "-"], {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    timeout: TOOL_TIMEOUT_MS,
  });
}

function parseMflPageMetadata(rawText) {
  return String(rawText ?? "")
    .split("\f")
    .map((pageText, pageIndex) => ({
      sourcePage: pageIndex + 1,
      plateId: captureText(pageText, /^\s*Plate:\s*(.+?)\s*$/im),
      widthMm: captureNumber(pageText, /^\s*Width:\s*([\d.]+)\s*mm\s*$/im),
      heightMm: captureNumber(pageText, /^\s*Height:\s*([\d.]+)\s*mm\s*$/im),
      calibration: captureText(pageText, /^\s*Calibration:\s*(.+?)\s*$/im),
    }))
    .filter((page) => page.plateId || page.widthMm || page.heightMm);
}

function listPdfImages(pdfPath) {
  const output = execFileSync("pdfimages", ["-list", pdfPath], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    timeout: TOOL_TIMEOUT_MS,
  });

  return output
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 6 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1]))
    .map((parts) => ({
      page: Number(parts[0]),
      imageNumber: Number(parts[1]),
      type: parts[2],
      width: Number(parts[3]),
      height: Number(parts[4]),
    }))
    .filter((image) => image.type === "image" && image.width > 0 && image.height > 0);
}

function selectPlotImageByPage(imageInventory) {
  const byPage = new Map();
  for (const image of imageInventory) {
    const current = byPage.get(image.page);
    if (!current || image.width * image.height > current.width * current.height) {
      byPage.set(image.page, image);
    }
  }
  return byPage;
}

function resolveExtractedImagePath(directory, imageNumber) {
  const expected = join(directory, `image-${String(imageNumber).padStart(3, "0")}.png`);
  if (existsSync(expected)) return expected;
  const suffix = `-${imageNumber}.png`;
  return readdirSync(directory)
    .map((name) => join(directory, name))
    .find((path) => path.endsWith(suffix)) ?? null;
}

function isolateCorrosionPixels(sourceBuffer) {
  const source = PNG.sync.read(sourceBuffer);
  const plotCrop = detectPlotCrop(source);
  const output = new PNG({ width: plotCrop.width, height: plotCrop.height });
  const sourcePreview = new PNG({ width: plotCrop.width, height: plotCrop.height });
  const bandCounts = new Map(MFL_CORROSION_PALETTE.map((band) => [band.minimumLossPercent, 0]));
  let corrosionPixelCount = 0;

  for (let outputY = 0; outputY < plotCrop.height; outputY += 1) {
    const sourceRowStart = ((plotCrop.y + outputY) * source.width + plotCrop.x) * 4;
    const sourceRowEnd = sourceRowStart + plotCrop.width * 4;
    source.data.copy(sourcePreview.data, outputY * plotCrop.width * 4, sourceRowStart, sourceRowEnd);
    for (let outputX = 0; outputX < plotCrop.width; outputX += 1) {
      const sourceX = plotCrop.x + outputX;
      const sourceY = plotCrop.y + outputY;
      const sourceOffset = (source.width * sourceY + sourceX) * 4;
      const outputOffset = (output.width * outputY + outputX) * 4;
      const match = nearestCorrosionBand(
        source.data[sourceOffset],
        source.data[sourceOffset + 1],
        source.data[sourceOffset + 2],
      );

      if (!match) {
        output.data[outputOffset] = 0;
        output.data[outputOffset + 1] = 0;
        output.data[outputOffset + 2] = 0;
        output.data[outputOffset + 3] = 0;
        continue;
      }

      output.data[outputOffset] = match.rgb[0];
      output.data[outputOffset + 1] = match.rgb[1];
      output.data[outputOffset + 2] = match.rgb[2];
      output.data[outputOffset + 3] = 255;
      corrosionPixelCount += 1;
      bandCounts.set(match.minimumLossPercent, bandCounts.get(match.minimumLossPercent) + 1);
    }
  }

  return {
    pngBuffer: PNG.sync.write(output, { colorType: 6 }),
    sourcePreviewPngBuffer: PNG.sync.write(sourcePreview, { colorType: 6 }),
    width: output.width,
    height: output.height,
    plotCrop,
    corrosionPixelCount,
    bands: MFL_CORROSION_PALETTE.map((band) => ({
      minimumLossPercent: band.minimumLossPercent,
      color: band.color,
      pixelCount: bandCounts.get(band.minimumLossPercent),
    })),
  };
}

function detectPlotCrop(png) {
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const offset = (png.width * y + x) * 4;
      const r = png.data[offset];
      const g = png.data[offset + 1];
      const b = png.data[offset + 2];
      if (!isPlotGridPixel(r, g, b)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, width: png.width, height: png.height };
  }

  return {
    x: Math.max(0, minX - 1),
    y: Math.max(0, minY - 1),
    width: Math.min(png.width - Math.max(0, minX - 1), maxX - minX + 3),
    height: Math.min(png.height - Math.max(0, minY - 1), maxY - minY + 3),
  };
}

function isPlotGridPixel(r, g, b) {
  return (
    isNear(r, g, b, 199, 199, 199, 5) ||
    isNear(r, g, b, 111, 111, 111, 5) ||
    isNear(r, g, b, 189, 227, 192, 8)
  );
}

function nearestCorrosionBand(r, g, b) {
  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const band of MFL_CORROSION_PALETTE) {
    const distance = Math.sqrt(
      (r - band.rgb[0]) ** 2 +
      (g - band.rgb[1]) ** 2 +
      (b - band.rgb[2]) ** 2,
    );
    if (distance < bestDistance) {
      best = band;
      bestDistance = distance;
    }
  }
  return bestDistance <= 30 ? best : null;
}

function buildPlateAliasIndex(plates) {
  const index = new Map();
  for (const plate of plates) {
    const aliases = new Set([plate.id, plate.label, ...(plate.aliases ?? [])]);
    for (const alias of aliases) {
      const normalized = normalizePlateId(alias);
      if (!normalized) continue;
      const matches = index.get(normalized) ?? [];
      matches.push(plate);
      index.set(normalized, matches);
    }
  }
  return index;
}

function normalizePlateId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^plate\s*[:#-]?\s*/i, "")
    .replace(/\s+/g, "")
    .replace(/[–—]/g, "-");
}

function normalizeRotation(value) {
  const normalized = ((Number(value) % 360) + 360) % 360;
  return [0, 90, 180, 270].includes(normalized) ? normalized : 0;
}

function findDuplicates(values) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

function captureText(text, pattern) {
  return pattern.exec(text)?.[1]?.trim() ?? null;
}

function captureNumber(text, pattern) {
  const value = Number(pattern.exec(text)?.[1]);
  return Number.isFinite(value) ? value : null;
}

function safeFilePart(value) {
  const safe = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return safe || "plate";
}

function sanitizeSourceDocumentName(value) {
  return basename(String(value ?? "MFL plate maps.pdf")).replace(/[\r\n\0]/g, " ").slice(0, 180);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function isNear(r, g, b, targetR, targetG, targetB, tolerance) {
  return (
    Math.abs(r - targetR) <= tolerance &&
    Math.abs(g - targetG) <= tolerance &&
    Math.abs(b - targetB) <= tolerance
  );
}

function clampNumber(value, minimum, maximum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return minimum;
  return Math.min(maximum, Math.max(minimum, numeric));
}
