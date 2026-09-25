#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const options = parseArguments(process.argv.slice(2));

try {
  if (!options.baseline) {
    throw new Error("--baseline is required.");
  }

  const baseline = readLayout(options.baseline);
  const baselineSummary = validateLayout(baseline, {
    requireAppFigure: options.requireAppFigure,
  });
  let composedSummary = null;

  if (options.composed) {
    const composed = readLayout(options.composed);
    composedSummary = validateLayout(composed, {
      requireAppFigure: options.requireAppFigure,
      requireCorrosion: true,
      requireApproved: options.requireApproved,
    });

    if (baselineSummary.geometryFingerprint !== composedSummary.geometryFingerprint) {
      const mismatch = findFirstDifference(
        buildGeometryContract(baseline),
        buildGeometryContract(composed),
      );
      throw new Error(
        `MFL composition changed immutable layout geometry${mismatch ? ` at ${mismatch}` : ""}.`,
      );
    }
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    baseline: baselineSummary,
    composed: composedSummary,
  }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`MFL layout verification failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

function parseArguments(args) {
  const parsed = {
    baseline: null,
    composed: null,
    requireAppFigure: false,
    requireApproved: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--require-app-figure") {
      parsed.requireAppFigure = true;
      continue;
    }
    if (argument === "--require-approved") {
      parsed.requireApproved = true;
      continue;
    }
    if (argument === "--baseline" || argument === "--composed") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a path.`);
      parsed[argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return parsed;
}

function readLayout(pathValue) {
  const filePath = resolve(pathValue);
  if (!existsSync(filePath)) throw new Error(`Layout JSON was not found: ${filePath}`);
  const payload = JSON.parse(readFileSync(filePath, "utf8"));
  const layout = payload.layoutMap ?? payload;
  if (!layout || typeof layout !== "object" || Array.isArray(layout)) {
    throw new Error(`Layout JSON does not contain an object: ${filePath}`);
  }
  return layout;
}

function validateLayout(layout, { requireAppFigure, requireCorrosion = false, requireApproved = false }) {
  assert(layout.appMap?.surfaceType === "floor", "Layout must declare appMap.surfaceType as floor.");
  assert(Array.isArray(layout.plates) && layout.plates.length > 0, "Layout must contain at least one plate.");

  const plateIds = new Set();
  for (const plate of layout.plates) {
    const plateId = String(plate.id ?? "").trim();
    assert(plateId !== "", "Every plate must have a stable ID.");
    assert(!plateIds.has(plateId), `Duplicate plate ID: ${plateId}.`);
    plateIds.add(plateId);
    validatePlateGeometry(plate, plateId);
  }

  const markerIds = new Set();
  for (const marker of layout.markers ?? []) {
    const markerId = String(marker.id ?? "").trim();
    assert(markerId !== "", "Every marker must have a stable ID.");
    assert(!markerIds.has(markerId), `Duplicate marker ID: ${markerId}.`);
    markerIds.add(markerId);
    assertFinite(marker.x, `Marker ${markerId} x`);
    assertFinite(marker.y, `Marker ${markerId} y`);
  }

  if (requireAppFigure || layout.appFigure) validateAppFigure(layout.appFigure);

  const overlays = layout.floorCorrosion?.overlays ?? [];
  const validationIssues = layout.floorCorrosion?.validationIssues ?? [];
  if (requireCorrosion) assert(layout.floorCorrosion && overlays.length > 0, "Composed layout has no MFL overlays.");

  const scanIds = new Set();
  for (const overlay of overlays) {
    const scanId = String(overlay.scanPlateId ?? "").trim();
    assert(scanId !== "", "Every overlay must retain its source scan plate ID.");
    assert(!scanIds.has(scanId), `Duplicate MFL scan placement: ${scanId}.`);
    scanIds.add(scanId);
    assert(plateIds.has(String(overlay.hostPlateId ?? "")), `Overlay ${scanId} references unknown plate ${overlay.hostPlateId}.`);
    assert(
      Boolean(overlay.sourcePreviewArtifactUri || overlay.sourcePreviewInlineImageDataUrl),
      `Overlay ${scanId} is missing its immutable source preview.`,
    );
    assert([0, 90, 180, 270].includes(Number(overlay.rotationDegrees)), `Overlay ${scanId} has an invalid rotation.`);
    assertBounded(overlay.scaleX ?? 1, 0.5, 2.5, `Overlay ${scanId} scaleX`);
    assertBounded(overlay.scaleY ?? 1, 0.5, 2.5, `Overlay ${scanId} scaleY`);
    assertBounded(overlay.offsetX ?? 0, -0.75, 0.75, `Overlay ${scanId} offsetX`);
    assertBounded(overlay.offsetY ?? 0, -0.75, 0.75, `Overlay ${scanId} offsetY`);
    if (requireApproved) assert(overlay.status === "approved", `Overlay ${scanId} is not approved.`);
  }

  const errorIssues = validationIssues.filter((issue) => issue.severity === "error");
  assert(errorIssues.length === 0, `Composed layout has ${errorIssues.length} matching/validation error(s).`);

  return {
    id: layout.id ?? null,
    geometryFingerprint: hashCanonical(buildGeometryContract(layout)),
    plateCount: layout.plates.length,
    markerCount: (layout.markers ?? []).length,
    appFigurePresent: Boolean(layout.appFigure?.svg),
    overlayCount: overlays.length,
    orientationReviewCount: overlays.filter((overlay) => overlay.status === "orientation_review_required").length,
    approvedOverlayCount: overlays.filter((overlay) => overlay.status === "approved").length,
    validationErrorCount: errorIssues.length,
  };
}

function assertBounded(value, minimum, maximum, label) {
  const numeric = Number(value);
  assert(Number.isFinite(numeric), `${label} must be finite.`);
  assert(numeric >= minimum && numeric <= maximum, `${label} must be between ${minimum} and ${maximum}.`);
}

function validatePlateGeometry(plate, plateId) {
  assertFinite(plate.x, `Plate ${plateId} x`);
  assertFinite(plate.y, `Plate ${plateId} y`);
  assertFinite(plate.width, `Plate ${plateId} width`);
  assertFinite(plate.height, `Plate ${plateId} height`);
  assert(Number(plate.width) > 0 && Number(plate.height) > 0, `Plate ${plateId} must have positive bounds.`);

  if (plate.points != null) {
    assert(Array.isArray(plate.points) && plate.points.length >= 3, `Plate ${plateId} polygon must have at least three points.`);
    for (const [index, point] of plate.points.entries()) {
      assertFinite(point.x, `Plate ${plateId} point ${index} x`);
      assertFinite(point.y, `Plate ${plateId} point ${index} y`);
    }
  }
}

function validateAppFigure(appFigure) {
  assert(appFigure && typeof appFigure === "object", "A V3 app-owned floor figure is required.");
  assert(appFigure.targetKey === "floor", "App figure targetKey must be floor.");
  assert(appFigure.mediaType === "image/svg+xml", "App figure mediaType must be image/svg+xml.");
  assert(Number(appFigure.sourceGeometryVersion) === 2, "App figure sourceGeometryVersion must be 2.");
  assert(typeof appFigure.svg === "string" && /^<svg\b/i.test(appFigure.svg.trim()), "App figure must contain an SVG payload.");
}

function buildGeometryContract(layout) {
  return {
    geometrySource: layout.geometrySource ?? null,
    gridRows: layout.gridRows ?? null,
    gridColumns: layout.gridColumns ?? null,
    appMap: layout.appMap ?? null,
    appFigure: layout.appFigure
      ? {
          targetKey: layout.appFigure.targetKey,
          mediaType: layout.appFigure.mediaType,
          renderVersion: layout.appFigure.renderVersion,
          sourceGeometryVersion: layout.appFigure.sourceGeometryVersion,
          checksumSha256: layout.appFigure.checksumSha256 ?? null,
          svgSha256: createHash("sha256").update(String(layout.appFigure.svg ?? "")).digest("hex"),
        }
      : null,
    plates: layout.plates ?? [],
    markers: layout.markers ?? [],
    drawingBlock: layout.drawingBlock ?? null,
  };
}

function hashCanonical(value) {
  return createHash("sha256").update(JSON.stringify(sortObject(value))).digest("hex");
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, sortObject(value[key])]),
  );
}

function findFirstDifference(left, right, path = "geometry") {
  if (Object.is(left, right)) return null;
  if (typeof left !== typeof right || left == null || right == null) return path;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return `${path}.length`;
    for (let index = 0; index < left.length; index += 1) {
      const difference = findFirstDifference(left[index], right[index], `${path}[${index}]`);
      if (difference) return difference;
    }
    return path;
  }
  if (typeof left === "object") {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    for (const key of keys) {
      if (!(key in left) || !(key in right)) return `${path}.${key}`;
      const difference = findFirstDifference(left[key], right[key], `${path}.${key}`);
      if (difference) return difference;
    }
    return path;
  }
  return path;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertFinite(value, label) {
  assert(Number.isFinite(Number(value)), `${label} must be finite.`);
}
