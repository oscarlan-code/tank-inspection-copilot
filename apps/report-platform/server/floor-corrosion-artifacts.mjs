import { randomUUID } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import {
  composeFloorCorrosionMap,
  extractMflPlateScans,
  inspectMflPlateMetadata,
  validateMflLayoutMatch,
} from "./floor-corrosion.mjs";
import { buildSu4SourceFloorLayout, renderSourceFloorLayout } from "./floor-layout-source.mjs";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export function createFloorCorrosionArtifactService({ artifactRoot }) {
  const root = resolve(artifactRoot);
  mkdirSync(root, { recursive: true });

  return {
    deleteReportArtifacts,
    getArtifactContentType,
    deleteArtifactRun,
    listRunArtifactFiles,
    updatePlacement,
    hydrateInlineArtifacts,
    importLayoutPdf,
    importMflPdf,
    readArtifact,
  };

  function deleteReportArtifacts(reportJobId) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(String(reportJobId ?? ""))) {
      throw new FloorCorrosionError(400, "Invalid report job identifier.", "report_job_id_invalid");
    }
    const reportDirectory = join(root, reportJobId);
    assertInsideRoot(reportDirectory);
    rmSync(reportDirectory, { recursive: true, force: true });
  }

  function deleteArtifactRun({ reportJobId, runId }) {
    const runDirectory = safeRunDirectory(reportJobId, runId);
    rmSync(runDirectory, { recursive: true, force: true });
  }

  function listRunArtifactFiles({ reportJobId, runId }) {
    const runDirectory = safeRunDirectory(reportJobId, runId);
    if (!existsSync(runDirectory)) {
      throw new FloorCorrosionError(404, "Floor corrosion artifact run was not found.", "floor_corrosion_run_not_found");
    }
    return listFilesRecursively(runDirectory)
      .map((localPath) => {
        const relativePath = relative(runDirectory, localPath).split(sep).join("/");
        const stats = statSync(localPath);
        return {
          byteSize: stats.size,
          localPath,
          mediaType: getRunArtifactContentType(relativePath),
          relativePath,
        };
      })
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  }

  function importLayoutPdf({
    reportJobId,
    pdfBuffer,
    pdfPath,
    sourceDocumentName,
    sourcePage,
    client,
    tank,
    reference,
  }) {
    const runId = randomUUID();
    const runDirectory = safeRunDirectory(reportJobId, runId);
    const artifactDirectory = join(runDirectory, "scans");
    mkdirSync(artifactDirectory, { recursive: true });
    const sourcePath = join(runDirectory, "source.pdf");
    stagePdfInput({ pdfBuffer, pdfPath, sourcePath, label: "Floor layout" });

    let rendered;
    try {
      rendered = renderSourceFloorLayout({
        pdfPath: sourcePath,
        pageNumber: sourcePage,
        outputDirectory: artifactDirectory,
      });
    } catch (error) {
      rmSync(runDirectory, { recursive: true, force: true });
      const message = error instanceof Error ? error.message : "Floor layout extraction failed.";
      throw new FloorCorrosionError(422, message, "floor_layout_extraction_failed");
    }

    const artifactBaseUri = `/api/v1/report-jobs/${encodeURIComponent(reportJobId)}/floor-corrosion/artifacts/${encodeURIComponent(runId)}`;
    const layoutMap = buildSu4SourceFloorLayout({
      artifactUri: `${artifactBaseUri}/source-layout-vector.svg`,
      sourceDocumentName: sanitizeFileName(sourceDocumentName),
      sourcePage: rendered.pageNumber,
      sourceSha256: rendered.sourceSha256,
      width: rendered.width,
      height: rendered.height,
      client,
      tank,
      reference,
    });
    writeFileSync(
      join(runDirectory, "source-layout-manifest.json"),
      `${JSON.stringify({
        schemaVersion: 1,
        runId,
        sourceDrawing: layoutMap.sourceDrawing,
        plateIds: layoutMap.plates.map((plate) => plate.id),
      }, null, 2)}\n`,
      { mode: 0o600 },
    );

    return {
      layoutMap,
      summary: {
        artifactRunId: runId,
        calibrationProfile: layoutMap.sourceDrawing.calibrationProfile,
        plateCount: layoutMap.plates.length,
        sourcePage: rendered.pageNumber,
      },
    };
  }

  function importMflPdf({
    reportJobId,
    layoutMap,
    pdfBuffer,
    pdfPath,
    sourceDocumentName,
    sourceLayoutName = "LAIQ inspection app floor layout",
  }) {
    const runId = randomUUID();
    const runDirectory = safeRunDirectory(reportJobId, runId);
    const scanDirectory = join(runDirectory, "scans");
    mkdirSync(scanDirectory, { recursive: true });
    const sourcePath = join(runDirectory, "source.pdf");
    stagePdfInput({ pdfBuffer, pdfPath, sourcePath, label: "MFL" });

    let extractionManifest;
    try {
      const metadataManifest = inspectMflPlateMetadata({
        pdfPath: sourcePath,
        sourceDocumentName: sanitizeFileName(sourceDocumentName),
      });
      const preflight = validateMflLayoutMatch({
        layoutMap,
        metadataManifest,
        requireCompleteCoverage: true,
      });
      if (!preflight.ok) {
        const summary = summarizePreflightFailure(preflight);
        throw new FloorCorrosionError(422, summary, "mfl_layout_mismatch", preflight);
      }
      extractionManifest = extractMflPlateScans({
        pdfPath: sourcePath,
        outputDirectory: scanDirectory,
        sourceDocumentName: sanitizeFileName(sourceDocumentName),
        metadataManifest,
      });
    } catch (error) {
      rmSync(runDirectory, { recursive: true, force: true });
      if (error instanceof FloorCorrosionError) throw error;
      const message = error instanceof Error ? error.message : "MFL extraction failed.";
      throw new FloorCorrosionError(422, message, "mfl_extraction_failed");
    }

    const artifactBaseUri = `/api/v1/report-jobs/${encodeURIComponent(reportJobId)}/floor-corrosion/artifacts/${encodeURIComponent(runId)}`;
    const composedLayoutMap = composeFloorCorrosionMap({
      layoutMap,
      extractionManifest,
      artifactDirectory: scanDirectory,
      artifactBaseUri,
      artifactRunId: runId,
      includeInlineImages: false,
      sourceLayoutName,
    });
    writeFileSync(
      join(runDirectory, "floor-corrosion-map.json"),
      `${JSON.stringify(stripInlineImages(composedLayoutMap.floorCorrosion), null, 2)}\n`,
      { mode: 0o600 },
    );

    return {
      layoutMap: composedLayoutMap,
      summary: summarizeCorrosionMap(composedLayoutMap.floorCorrosion),
    };
  }

  function updatePlacement({
    reportJobId,
    layoutMap,
    scanPlateId,
    hostPlateId,
    rotationDegrees,
    flipX,
    flipY,
    scaleX,
    scaleY,
    offsetX,
    offsetY,
    opacity,
    approved = false,
    actorUserId,
  }) {
    const floorCorrosion = layoutMap?.floorCorrosion;
    if (!floorCorrosion) {
      throw new FloorCorrosionError(404, "Floor corrosion map has not been generated.", "floor_corrosion_not_found");
    }
    safeRunDirectory(reportJobId, floorCorrosion.artifactRunId);
    const hostPlate = layoutMap.plates.find((plate) => plate.id === hostPlateId);
    if (!hostPlate) {
      throw new FloorCorrosionError(400, "Selected host plate does not exist.", "floor_corrosion_host_plate_invalid");
    }
    const overlayIndex = floorCorrosion.overlays.findIndex((overlay) => overlay.scanPlateId === scanPlateId);
    if (overlayIndex < 0) {
      throw new FloorCorrosionError(404, "MFL scan plate was not found.", "floor_corrosion_scan_not_found");
    }

    const rotation = normalizeRotation(rotationDegrees);
    if (rotation == null) {
      throw new FloorCorrosionError(400, "Rotation must be 0, 90, 180, or 270 degrees.", "floor_corrosion_rotation_invalid");
    }

    const currentOverlay = floorCorrosion.overlays[overlayIndex];
    const nextScaleX = boundedPlacementNumber(scaleX, currentOverlay.scaleX ?? 1, 0.5, 2.5, "scaleX");
    const nextScaleY = boundedPlacementNumber(scaleY, currentOverlay.scaleY ?? 1, 0.5, 2.5, "scaleY");
    const nextOffsetX = boundedPlacementNumber(offsetX, currentOverlay.offsetX ?? 0, -0.75, 0.75, "offsetX");
    const nextOffsetY = boundedPlacementNumber(offsetY, currentOverlay.offsetY ?? 0, -0.75, 0.75, "offsetY");
    const nextOpacity = boundedPlacementNumber(opacity, currentOverlay.opacity, 0.1, 1, "opacity");
    const isApproved = approved === true;
    const overlays = floorCorrosion.overlays.map((overlay, index) => (
      index === overlayIndex
        ? {
            ...overlay,
            hostPlateId,
            rotationDegrees: rotation,
            flipX: false,
            flipY: false,
            scaleX: nextScaleX,
            scaleY: nextScaleY,
            offsetX: nextOffsetX,
            offsetY: nextOffsetY,
            opacity: nextOpacity,
            status: isApproved ? "approved" : "orientation_review_required",
            reviewedByUserId: isApproved ? actorUserId : undefined,
            reviewedAtIso: isApproved ? new Date().toISOString() : undefined,
          }
        : overlay
    ));
    const retainedIssues = floorCorrosion.validationIssues.filter(
      (issue) => !(issue.code === "mfl_orientation_review_required" && issue.plateId === scanPlateId),
    );
    const validationIssues = isApproved
      ? retainedIssues
      : [
          ...retainedIssues,
          {
            code: "mfl_orientation_review_required",
            severity: "warning",
            plateId: scanPlateId,
            message: `Plate ${scanPlateId} placement changed and requires user approval.`,
          },
        ];

    return {
      ...layoutMap,
      floorCorrosion: {
        ...floorCorrosion,
        generatedAtIso: new Date().toISOString(),
        overlays,
        validationIssues,
      },
    };
  }

  function readArtifact({ reportJobId, runId, artifactFileName }) {
    const runDirectory = safeRunDirectory(reportJobId, runId);
    const safeName = basename(String(artifactFileName ?? ""));
    if (!/^[a-z0-9._-]+\.(?:png|svg)$/i.test(safeName)) {
      throw new FloorCorrosionError(400, "Invalid corrosion artifact name.", "floor_corrosion_artifact_invalid");
    }
    const artifactPath = join(runDirectory, "scans", safeName);
    assertInsideRoot(artifactPath);
    if (!existsSync(artifactPath)) {
      throw new FloorCorrosionError(404, "Corrosion artifact was not found.", "floor_corrosion_artifact_not_found");
    }
    return readFileSync(artifactPath);
  }

  function hydrateInlineArtifacts(reportJobId, layoutMap) {
    const floorCorrosion = layoutMap?.floorCorrosion;
    const sourceDrawing = hydrateSourceDrawing(reportJobId, layoutMap?.sourceDrawing);
    if (!floorCorrosion) {
      return {
        ...layoutMap,
        sourceDrawing,
      };
    }
    const overlays = floorCorrosion.overlays.map((overlay) => {
      const artifactFileName = artifactNameFromUri(overlay.artifactUri);
      const sourcePreviewFileName = artifactNameFromUri(overlay.sourcePreviewArtifactUri);
      try {
        const inlineImageDataUrl = overlay.inlineImageDataUrl ?? (artifactFileName
          ? `data:image/png;base64,${readArtifact({
              reportJobId,
              runId: floorCorrosion.artifactRunId,
              artifactFileName,
            }).toString("base64")}`
          : undefined);
        const sourcePreviewInlineImageDataUrl = overlay.sourcePreviewInlineImageDataUrl
          ?? (sourcePreviewFileName
            ? `data:image/png;base64,${readArtifact({
                reportJobId,
                runId: floorCorrosion.artifactRunId,
                artifactFileName: sourcePreviewFileName,
              }).toString("base64")}`
            : undefined);
        return {
          ...overlay,
          inlineImageDataUrl,
          sourcePreviewInlineImageDataUrl,
        };
      } catch {
        return {
          ...overlay,
          status: "blocked",
        };
      }
    });
    return {
      ...layoutMap,
      sourceDrawing,
      floorCorrosion: {
        ...floorCorrosion,
        overlays,
      },
    };
  }

  function hydrateSourceDrawing(reportJobId, sourceDrawing) {
    if (!sourceDrawing) return sourceDrawing;
    return {
      ...sourceDrawing,
      inlineImageDataUrl: sourceDrawing.inlineImageDataUrl
        ?? readArtifactDataUrl(reportJobId, sourceDrawing.artifactUri),
      ...(sourceDrawing.foregroundArtifactUri
        ? {
            foregroundInlineImageDataUrl: sourceDrawing.foregroundInlineImageDataUrl
              ?? readArtifactDataUrl(reportJobId, sourceDrawing.foregroundArtifactUri),
          }
        : {}),
    };
  }

  function readArtifactDataUrl(reportJobId, artifactUri) {
    const artifactFileName = artifactNameFromUri(artifactUri);
    const runId = runIdFromArtifactUri(artifactUri);
    if (!artifactFileName || !runId) return undefined;
    try {
      const buffer = readArtifact({ reportJobId, runId, artifactFileName });
      return `data:${getArtifactContentType(artifactFileName)};base64,${buffer.toString("base64")}`;
    } catch {
      return undefined;
    }
  }

  function safeRunDirectory(reportJobId, runId) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(String(reportJobId ?? ""))) {
      throw new FloorCorrosionError(400, "Invalid report job identifier.", "report_job_id_invalid");
    }
    if (!/^[a-f0-9-]{36}$/i.test(String(runId ?? ""))) {
      throw new FloorCorrosionError(400, "Invalid floor corrosion run identifier.", "floor_corrosion_run_invalid");
    }
    const directory = join(root, reportJobId, runId);
    assertInsideRoot(directory);
    return directory;
  }

  function assertInsideRoot(candidatePath) {
    const normalized = resolve(candidatePath);
    if (normalized !== root && !normalized.startsWith(`${root}${sep}`)) {
      throw new FloorCorrosionError(400, "Invalid floor corrosion artifact path.", "floor_corrosion_path_invalid");
    }
  }
}

function getArtifactContentType(artifactFileName) {
  return String(artifactFileName ?? "").toLowerCase().endsWith(".svg")
    ? "image/svg+xml"
    : "image/png";
}

function getRunArtifactContentType(relativePath) {
  const lower = String(relativePath ?? "").toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".json")) return "application/json";
  return getArtifactContentType(lower);
}

function listFilesRecursively(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const childPath = join(directory, entry.name);
    if (entry.isDirectory()) return listFilesRecursively(childPath);
    return entry.isFile() ? [childPath] : [];
  });
}

export class FloorCorrosionError extends Error {
  constructor(statusCode, message, code, details) {
    super(message);
    this.name = "FloorCorrosionError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function summarizePreflightFailure(preflight) {
  const problems = [];
  if (preflight.scanPlateCount !== preflight.layoutPlateCount) {
    problems.push(`${preflight.scanPlateCount} MFL scan plate(s) versus ${preflight.layoutPlateCount} layout plate(s)`);
  }
  if (preflight.unmatchedScanPlateIds.length > 0) {
    problems.push(`unmatched MFL plate(s): ${summarizeIds(preflight.unmatchedScanPlateIds)}`);
  }
  if (preflight.platesWithoutScans.length > 0) {
    problems.push(`layout plate(s) without scans: ${summarizeIds(preflight.platesWithoutScans)}`);
  }
  const otherErrors = preflight.issues
    .filter((issue) => issue.severity === "error" && [
      "mfl_plate_id_missing",
      "mfl_plate_dimensions_missing",
      "mfl_plot_image_missing",
      "mfl_duplicate_plate_id",
      "mfl_host_plate_ambiguous",
      "mfl_host_plate_duplicate_assignment",
      "mfl_scan_pages_missing",
    ].includes(issue.code))
    .map((issue) => issue.message)
    .filter((message, index, messages) => messages.indexOf(message) === index);
  problems.push(...otherErrors.slice(0, 2));
  const summary = problems
    .map((problem) => problem.replace(/[.;:\s]+$/g, ""))
    .join("; ");
  return `MFL/layout preflight failed before image processing: ${summary || "plate identifiers do not match uniquely"}.`;
}

function summarizeIds(ids, limit = 8) {
  const visible = ids.slice(0, limit);
  const remaining = ids.length - visible.length;
  return `${visible.join(", ")}${remaining > 0 ? ` (+${remaining} more)` : ""}`;
}

function artifactNameFromUri(value) {
  const match = /\/floor-corrosion\/artifacts\/[a-f0-9-]+\/([^/?#]+)$/i.exec(String(value ?? ""));
  return match ? decodeURIComponent(match[1]) : null;
}

function runIdFromArtifactUri(value) {
  const match = /\/floor-corrosion\/artifacts\/([a-f0-9-]+)\/[^/?#]+$/i.exec(String(value ?? ""));
  return match?.[1] ?? null;
}

function validatePdfBuffer(pdfBuffer, label) {
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new FloorCorrosionError(400, `${label} PDF upload is empty.`, "pdf_empty");
  }
  if (pdfBuffer.length > MAX_UPLOAD_BYTES) {
    throw new FloorCorrosionError(413, `${label} PDF upload exceeds 100 MB.`, "pdf_too_large");
  }
  if (pdfBuffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new FloorCorrosionError(400, `${label} upload must be a PDF file.`, "pdf_invalid");
  }
}

function stagePdfInput({ pdfBuffer, pdfPath, sourcePath, label }) {
  if (pdfPath) {
    validatePdfPath(pdfPath, label);
    copyFileSync(pdfPath, sourcePath);
    return;
  }

  validatePdfBuffer(pdfBuffer, label);
  writeFileSync(sourcePath, pdfBuffer, { mode: 0o600 });
}

function validatePdfPath(pdfPath, label) {
  const stats = statSync(pdfPath);
  if (!stats.isFile() || stats.size === 0) {
    throw new FloorCorrosionError(400, `${label} PDF upload is empty.`, "pdf_empty");
  }
  if (stats.size > MAX_UPLOAD_BYTES) {
    throw new FloorCorrosionError(413, `${label} PDF upload exceeds 100 MB.`, "pdf_too_large");
  }

  const descriptor = openSync(pdfPath, "r");
  const magic = Buffer.alloc(5);
  try {
    readSync(descriptor, magic, 0, magic.length, 0);
  } finally {
    closeSync(descriptor);
  }
  if (magic.toString("ascii") !== "%PDF-") {
    throw new FloorCorrosionError(400, `${label} upload must be a PDF file.`, "pdf_invalid");
  }
}

function sanitizeFileName(value) {
  const clean = basename(String(value ?? "MFL plate maps.pdf"))
    .replace(/[\r\n\0]/g, " ")
    .slice(0, 180);
  return clean.toLowerCase().endsWith(".pdf") ? clean : `${clean}.pdf`;
}

function stripInlineImages(floorCorrosion) {
  return {
    ...floorCorrosion,
    overlays: floorCorrosion.overlays.map(({
      inlineImageDataUrl: _inline,
      sourcePreviewInlineImageDataUrl: _sourcePreviewInline,
      ...overlay
    }) => overlay),
  };
}

function summarizeCorrosionMap(floorCorrosion) {
  return {
    artifactRunId: floorCorrosion.artifactRunId,
    overlayCount: floorCorrosion.overlays.length,
    approvedOverlayCount: floorCorrosion.overlays.filter((overlay) => overlay.status === "approved").length,
    reviewRequiredCount: floorCorrosion.overlays.filter((overlay) => overlay.status === "orientation_review_required").length,
    unmatchedScanCount: floorCorrosion.unmatchedScanPlateIds.length,
    plateWithoutScanCount: floorCorrosion.platesWithoutScans.length,
    errorCount: floorCorrosion.validationIssues.filter((issue) => issue.severity === "error").length,
    warningCount: floorCorrosion.validationIssues.filter((issue) => issue.severity === "warning").length,
  };
}

function normalizeRotation(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const normalized = ((numeric % 360) + 360) % 360;
  return [0, 90, 180, 270].includes(normalized) ? normalized : null;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function boundedPlacementNumber(value, fallback, minimum, maximum, fieldName) {
  const numeric = Number(value ?? fallback);
  if (!Number.isFinite(numeric)) {
    throw new FloorCorrosionError(
      400,
      `${fieldName} must be a finite number.`,
      "floor_corrosion_transform_invalid",
    );
  }
  return clamp(numeric, minimum, maximum);
}
