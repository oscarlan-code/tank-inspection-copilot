import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { buildLayoutMapFigureSvg } from "../layout-map-figure.mjs";
import {
  composeFloorCorrosionMap,
  extractMflPlateScans,
  inspectMflPlateMetadata,
  validateMflLayoutMatch,
} from "../floor-corrosion.mjs";

const options = parseArguments(process.argv.slice(2));
if (!options.layout || !options.mfl || !options.output) {
  printUsage();
  process.exitCode = 2;
} else {
  const layoutPath = resolve(options.layout);
  const mflPath = resolve(options.mfl);
  const outputDirectory = resolve(options.output);
  if (!existsSync(layoutPath)) throw new Error(`Layout JSON was not found: ${layoutPath}`);
  if (!existsSync(mflPath)) throw new Error(`MFL PDF was not found: ${mflPath}`);
  mkdirSync(outputDirectory, { recursive: true });

  const layoutPayload = JSON.parse(readFileSync(layoutPath, "utf8"));
  const layoutMap = layoutPayload.layoutMap ?? layoutPayload;
  const placementPayload = options.placements
    ? JSON.parse(readFileSync(resolve(options.placements), "utf8"))
    : [];
  const placements = placementPayload.placements ?? placementPayload;
  const metadataManifest = inspectMflPlateMetadata({
    pdfPath: mflPath,
    sourceDocumentName: basename(mflPath),
  });
  const preflight = validateMflLayoutMatch({
    layoutMap,
    metadataManifest,
    placements,
    requireCompleteCoverage: options["allow-partial"] !== "true",
  });
  if (!preflight.ok) {
    throw new Error(`MFL/layout preflight failed before image processing:\n${preflight.issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => `- ${issue.message}`)
      .join("\n")}`);
  }
  const scanDirectory = join(outputDirectory, "scans");
  const extractionManifest = extractMflPlateScans({
    pdfPath: mflPath,
    outputDirectory: scanDirectory,
    sourceDocumentName: basename(mflPath),
    metadataManifest,
  });
  const corrosionLayoutMap = composeFloorCorrosionMap({
    layoutMap,
    extractionManifest,
    artifactDirectory: scanDirectory,
    artifactRunId: "local-preview",
    includeInlineImages: true,
    placements,
    sourceLayoutName: basename(layoutPath),
  });
  const figure = buildLayoutMapFigureSvg(corrosionLayoutMap);
  if (!figure) throw new Error("Unable to render floor corrosion map SVG.");

  writeFileSync(join(outputDirectory, "floor-corrosion-map.svg"), figure.svg);
  writeFileSync(
    join(outputDirectory, "floor-corrosion-map.json"),
    `${JSON.stringify(stripInlineImages(corrosionLayoutMap), null, 2)}\n`,
  );

  const floorCorrosion = corrosionLayoutMap.floorCorrosion;
  console.log(JSON.stringify({
    outputDirectory,
    scanCount: extractionManifest.scanCount,
    overlayCount: floorCorrosion.overlays.length,
    unmatchedScanPlateIds: floorCorrosion.unmatchedScanPlateIds,
    platesWithoutScans: floorCorrosion.platesWithoutScans,
    validationIssues: floorCorrosion.validationIssues,
  }, null, 2));
}

function parseArguments(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith("--")) continue;
    result[value.slice(2)] = args[index + 1];
    index += 1;
  }
  return result;
}

function stripInlineImages(layoutMap) {
  return {
    ...layoutMap,
    floorCorrosion: layoutMap.floorCorrosion
      ? {
          ...layoutMap.floorCorrosion,
          overlays: layoutMap.floorCorrosion.overlays.map(({ inlineImageDataUrl: _inline, ...overlay }) => overlay),
        }
      : undefined,
  };
}

function printUsage() {
  console.error(`Usage:
  npm run floor-corrosion:build -- \\
    --layout /path/to/floor-layout-map.json \\
    --mfl /path/to/mfl-individual-plate-maps.pdf \\
    --output /path/to/output-directory \\
    [--placements /path/to/approved-placements.json]`);
}
