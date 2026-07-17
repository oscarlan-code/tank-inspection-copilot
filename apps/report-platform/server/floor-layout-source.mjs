import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const TOOL_TIMEOUT_MS = 120_000;
const PDF_PAGE = { width: 595.22, height: 842 };
const DRAWING_CROP = { x: 27.36, y: 131.52, width: 540, height: 540 };
const OUTER_CIRCLE = { x: 297.152, y: 420.9, radius: 198.84 };

const CENTRAL_PLATES = [
  plate("1.1", [[184.32, 280.805], [216.078, 264.684], [216.078, 295.004], [174.012, 295.004]]),
  plate("1.2", [[216.078, 264.684], [270.125, 247.129], [270.125, 295.004], [216.078, 295.004]]),
  plate("1.3", [[270.125, 247.129], [324.176, 247.129], [324.176, 295.004], [270.125, 295.004]]),
  plate("1.4", [[324.176, 247.129], [378.223, 264.684], [378.223, 295.004], [324.176, 295.004]]),
  plate("1.5", [[378.223, 264.684], [404.469, 273.195], [420.289, 295.004], [378.223, 295.004]]),
  plate("2.1", [[174.012, 295.004], [196.484, 295.004], [196.484, 345.34], [137.461, 345.34]]),
  plate("2.2", [[196.484, 295.004], [397.82, 295.004], [397.82, 345.34], [196.484, 345.34]]),
  plate("2.3", [[397.82, 295.004], [420.289, 295.004], [456.84, 345.34], [397.82, 345.34]]),
  plate("3.1", [[137.461, 345.34], [297.152, 345.34], [297.152, 395.734], [123.559, 395.734], [123.559, 364.516]]),
  plate("3.2", [[297.152, 345.34], [456.84, 345.34], [470.742, 368.887], [470.742, 395.734], [297.152, 395.734]]),
  plate("4.1", [[123.559, 395.734], [196.484, 395.734], [196.484, 446.066], [123.559, 446.066]]),
  plate("4.2", [[196.484, 395.734], [397.82, 395.734], [397.82, 446.066], [196.484, 446.066]]),
  plate("4.3", [[397.82, 395.734], [470.742, 395.734], [470.742, 446.066], [397.82, 446.066]]),
  plate("5.1", [[123.559, 446.066], [297.152, 446.066], [297.152, 496.461], [137.461, 496.461], [123.559, 477.285]]),
  plate("5.2", [[297.152, 446.066], [470.742, 446.066], [470.742, 477.285], [456.84, 496.461], [297.152, 496.461]]),
  plate("6.1", [[137.461, 496.461], [196.484, 496.461], [196.484, 546.797], [174.012, 546.797]]),
  plate("6.2a", [[196.484, 496.461], [297.152, 496.461], [297.152, 546.797], [196.484, 546.797]]),
  plate("6.2b", [[297.152, 496.461], [397.82, 496.461], [397.82, 546.797], [297.152, 546.797]]),
  plate("6.3", [[397.82, 496.461], [456.84, 496.461], [420.289, 546.797], [397.82, 546.797]]),
  plate("7.1", [[174.012, 546.797], [216.078, 546.797], [216.078, 577.117], [189.832, 568.605]]),
  plate("7.2", [[216.078, 546.797], [270.125, 546.797], [270.125, 594.672], [216.078, 577.117]]),
  plate("7.3", [[270.125, 546.797], [324.176, 546.797], [324.176, 594.672], [297.152, 603.48], [270.125, 594.672]]),
  plate("7.4", [[324.176, 546.797], [378.223, 546.797], [378.223, 577.117], [324.176, 594.672]]),
  plate("7.5", [[378.223, 546.797], [420.289, 546.797], [404.469, 568.605], [378.223, 577.117]]),
];

const ANNULAR_PLATES = [
  annularPlate("A1", [[297.152, 603.48], [404.469, 568.605]], 90, 54),
  annularPlate("A2", [[189.832, 568.605], [297.152, 603.48]], 126, 90),
  annularPlate("A3", [[123.559, 477.285], [189.832, 568.605]], 162, 126),
  annularPlate("A4", [[123.559, 364.516], [123.559, 477.285]], 198, 162),
  annularPlate("A5", [[184.32, 280.805], [139.316, 342.824], [123.559, 364.516]], 234, 198),
  annularPlate("A6", [[297.152, 238.32], [251.789, 253.059], [244.418, 255.457], [189.832, 273.195], [184.32, 280.805]], 270, 234),
  annularPlate("A7", [[404.469, 273.195], [382.66, 266.121], [320.16, 245.809], [311.41, 242.992], [297.152, 238.32]], 306, 270),
  annularPlate("A8", [[470.742, 368.887], [457.859, 346.719], [404.469, 273.195]], 342, 306),
  annularPlate("A9", [[470.742, 477.285], [470.742, 368.887]], 378, 342),
  annularPlate("A10", [[404.469, 568.605], [415.316, 553.566], [470.742, 477.285]], 414, 378),
];

export function renderSourceFloorLayout({ pdfPath, pageNumber, outputDirectory }) {
  if (!existsSync(pdfPath)) throw new Error(`Floor layout PDF was not found: ${pdfPath}`);
  const page = Number(pageNumber);
  if (!Number.isInteger(page) || page < 1 || page > 10_000) {
    throw new Error("Floor layout page must be a positive page number.");
  }

  // A temporary raster is used only to validate that the selected PDF page matches
  // the approved geometry profile. The product artifact remains vector SVG.
  const calibrationPrefix = `${outputDirectory}/source-layout-calibration`;
  try {
    execFileSync("pdftocairo", [
      "-png", "-singlefile", "-r", "150", "-f", String(page), "-l", String(page), pdfPath, calibrationPrefix,
    ], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: TOOL_TIMEOUT_MS,
    });
    const fullPng = PNG.sync.read(readFileSync(`${calibrationPrefix}.png`));
    assertSu4CalibrationProfile(cropPdfRegion(fullPng, DRAWING_CROP));
  } finally {
    rmSync(`${calibrationPrefix}.png`, { force: true });
  }

  const vectorPath = `${outputDirectory}/source-layout-vector.svg`;
  execFileSync("pdftocairo", [
    "-svg", "-f", String(page), "-l", String(page), pdfPath, vectorPath,
  ], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    timeout: TOOL_TIMEOUT_MS,
  });
  const vectorBuffer = Buffer.from(buildCroppedSanitizedSvg(readFileSync(vectorPath, "utf8")), "utf8");
  writeFileSync(vectorPath, vectorBuffer, { mode: 0o600 });

  return {
    vectorBuffer,
    width: DRAWING_CROP.width,
    height: DRAWING_CROP.height,
    pageNumber: page,
    sourceSha256: sha256(readFileSync(pdfPath)),
  };
}

function buildCroppedSanitizedSvg(rawSvg) {
  let svg = String(rawSvg ?? "").replace(/\u0000/g, "");
  if (!/<svg\b/i.test(svg)) throw new Error("The selected floor-layout page did not produce vector SVG geometry.");
  if (/<!DOCTYPE|<!ENTITY|<script\b|<foreignObject\b|<iframe\b|<object\b|<embed\b/i.test(svg)) {
    throw new Error("The extracted floor-layout SVG contains unsupported active content.");
  }
  if (/\son[a-z]+\s*=/i.test(svg)) {
    throw new Error("The extracted floor-layout SVG contains unsupported event handlers.");
  }
  for (const match of svg.matchAll(/(?:href|xlink:href)\s*=\s*["']([^"']+)["']/gi)) {
    const reference = match[1];
    if (!reference.startsWith("#") && !/^data:image\/(?:png|jpe?g);base64,[a-z0-9+/=]+$/i.test(reference)) {
      throw new Error("The extracted floor-layout SVG contains an external resource reference.");
    }
  }
  for (const match of svg.matchAll(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/gi)) {
    if (!match[1].startsWith("#")) {
      throw new Error("The extracted floor-layout SVG contains an external URL reference.");
    }
  }

  svg = svg
    .replace(/<\?xml[^>]*>\s*/i, "")
    .replace(/<svg\b([^>]*)>/i, (_match, attributes) => {
      const retained = attributes
        .replace(/\s(?:width|height|viewBox|preserveAspectRatio)\s*=\s*["'][^"']*["']/gi, "")
        .trim();
      return `<svg ${retained} width="${DRAWING_CROP.width}" height="${DRAWING_CROP.height}" viewBox="${DRAWING_CROP.x} ${DRAWING_CROP.y} ${DRAWING_CROP.width} ${DRAWING_CROP.height}" preserveAspectRatio="xMidYMid meet">`;
    });
  return `${svg.trim()}\n`;
}

function assertSu4CalibrationProfile(source) {
  const seamCheckpoints = [
    [123.559, 395.734],
    [470.742, 395.734],
    [196.484, 446.066],
    [397.82, 446.066],
    [297.152, 603.48],
    [297.152, 216.148],
    [216.078, 295.004],
    [378.223, 295.004],
    [137.461, 496.461],
    [456.84, 496.461],
  ];
  const matched = seamCheckpoints.filter(([pdfX, pdfY]) => {
    const x = Math.round(((pdfX - DRAWING_CROP.x) / DRAWING_CROP.width) * source.width);
    const y = Math.round(((pdfY - DRAWING_CROP.y) / DRAWING_CROP.height) * source.height);
    return hasRedPixelNear(source, x, y, 5);
  }).length;
  if (matched < 8) {
    throw new Error(
      "The selected page does not match the approved SU4 34-plate floor-layout profile. Select the correct source page or create and approve a new geometry profile.",
    );
  }
}

function hasRedPixelNear(source, centerX, centerY, radius) {
  for (let y = Math.max(0, centerY - radius); y <= Math.min(source.height - 1, centerY + radius); y += 1) {
    for (let x = Math.max(0, centerX - radius); x <= Math.min(source.width - 1, centerX + radius); x += 1) {
      const offset = (y * source.width + x) * 4;
      const red = source.data[offset];
      const green = source.data[offset + 1];
      const blue = source.data[offset + 2];
      if (red > 180 && green < 130 && blue < 130 && red > green * 1.6 && red > blue * 1.6) return true;
    }
  }
  return false;
}

export function buildSu4SourceFloorLayout({
  artifactUri,
  sourceDocumentName,
  sourcePage,
  sourceSha256,
  width,
  height,
  client,
  tank,
  reference,
}) {
  const plates = [...CENTRAL_PLATES, ...ANNULAR_PLATES].map(toLayoutPlate);
  return {
    id: "source-floor-layout-su4-34-plate",
    geometrySource: "source_drawing_import",
    title: "Floor Plate Corrosion Plan",
    subtitle: "Source drawing with deterministic MFL corrosion overlays",
    surfaceLabel: "Floor/bottom plate layout",
    legend: [],
    markers: [],
    plates,
    evidenceByKey: {},
    gridRows: 8,
    gridColumns: 10,
    drawingBlock: {
      client,
      project: `${tank} Floor Plate Corrosion Plan`,
      drawing: "Floor Corrosion Plan",
      reference,
      referenceMode: "Tank North",
      updatedAtLabel: "Imported source drawing",
    },
    appMap: {
      surfaceType: "floor",
      referenceMode: "Tank North",
      referenceNote: "Exact plate geometry calibrated from the imported source drawing.",
      floor: {
        template: "source_drawing_su4_34_plate",
        rowCount: 8,
        widestRowPlateCount: 10,
        plateCount: plates.length,
        hasAnnularRing: true,
        annularSectionCount: 10,
      },
    },
    sourceDrawing: {
      schemaVersion: 2,
      artifactUri,
      width,
      height,
      sourceDocumentName,
      sourcePage,
      sourceSha256,
      calibrationProfile: "su4_floor_34_plate_v1",
      renderMode: "extracted_vector",
      generationRole: "immutable_vector_layout",
    },
    overrideCount: 0,
  };
}

function plate(id, points) {
  return { id, points };
}

function annularPlate(id, innerBoundary, startDegrees, endDegrees) {
  return {
    id,
    points: [
      ...innerBoundary,
      ...sampleArc(endDegrees, startDegrees),
    ],
  };
}

function sampleArc(startDegrees, endDegrees) {
  const normalizedEnd = endDegrees < startDegrees ? endDegrees + 360 : endDegrees;
  const count = Math.max(3, Math.ceil((normalizedEnd - startDegrees) / 4));
  return Array.from({ length: count + 1 }, (_, index) => {
    const degrees = startDegrees + ((normalizedEnd - startDegrees) * index) / count;
    const radians = (degrees * Math.PI) / 180;
    return [
      OUTER_CIRCLE.x + Math.cos(radians) * OUTER_CIRCLE.radius,
      OUTER_CIRCLE.y + Math.sin(radians) * OUTER_CIRCLE.radius,
    ];
  });
}

function toLayoutPlate(definition) {
  const points = definition.points.map(([x, y]) => ({
    x: round((x - DRAWING_CROP.x) / DRAWING_CROP.width),
    y: round((y - DRAWING_CROP.y) / DRAWING_CROP.height),
  }));
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const x = Math.min(...xValues);
  const y = Math.min(...yValues);
  return {
    id: definition.id,
    label: definition.id,
    row: definition.id.startsWith("A") ? 8 : Number(definition.id.split(".")[0]),
    column: definition.id.startsWith("A")
      ? Number(definition.id.slice(1))
      : CENTRAL_PLATES.filter((candidate) => candidate.id.split(".")[0] === definition.id.split(".")[0])
          .findIndex((candidate) => candidate.id === definition.id) + 1,
    x,
    y,
    width: round(Math.max(...xValues) - x),
    height: round(Math.max(...yValues) - y),
    points,
    source: "source_drawing:su4_floor_34_plate_v1",
  };
}

function cropPdfRegion(source, crop) {
  const x = Math.round((crop.x / PDF_PAGE.width) * source.width);
  const y = Math.round((crop.y / PDF_PAGE.height) * source.height);
  const width = Math.round((crop.width / PDF_PAGE.width) * source.width);
  const height = Math.round((crop.height / PDF_PAGE.height) * source.height);
  const output = new PNG({ width, height });
  PNG.bitblt(source, output, x, y, width, height, 0, 0);
  return output;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function round(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
