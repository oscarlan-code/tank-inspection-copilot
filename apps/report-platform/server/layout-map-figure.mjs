const SVG_WIDTH = 1120;
const SVG_HEIGHT = 720;
const CIRCULAR_MAP = {
  x: 56,
  y: 60,
  size: 640,
};
const SHELL_GRID = {
  x: 88,
  y: 132,
  width: 820,
  height: 420,
};
const DRAWING_BLOCK = {
  x: 812,
  y: 596,
  width: 280,
  height: 104,
};

export function buildLayoutFigureSvg(reportState, tocSection) {
  const layoutMap = getEffectiveLayoutMap(reportState, tocSection);
  if (!layoutMap) return null;

  const clipId = `circle-clip-${safeId(layoutMap.id)}`;
  const body =
    layoutMap.appMap?.surfaceType === "shell"
      ? renderShellMap(layoutMap)
      : renderCircularMap(layoutMap, clipId);

  return {
    title: layoutMap.title,
    width: SVG_WIDTH,
    height: SVG_HEIGHT,
    svg: [
      `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(layoutMap.title)}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" width="${SVG_WIDTH}" height="${SVG_HEIGHT}">`,
      "<defs>",
      "<style>",
      svgStyles(),
      "</style>",
      `<clipPath id="${clipId}"><circle cx="${CIRCULAR_MAP.x + CIRCULAR_MAP.size / 2}" cy="${CIRCULAR_MAP.y + CIRCULAR_MAP.size / 2}" r="${CIRCULAR_MAP.size * 0.42}" /></clipPath>`,
      "</defs>",
      `<rect class="map-page" height="${SVG_HEIGHT - 18}" rx="22" width="${SVG_WIDTH - 18}" x="9" y="9" />`,
      body,
      renderDrawingBlock(layoutMap),
      "</svg>",
    ].join(""),
  };
}

export function getEffectiveLayoutMap(reportState, tocSection) {
  const surface = tocSection?.layoutSurface;
  if (!surface || !reportState?.exportPackage) return null;

  const override = reportState.layoutOverrides?.find((item) => item.sectionId === tocSection.id)?.layoutMap;
  if (override?.appMap?.surfaceType === surface) {
    return normalizeLayoutMap(override);
  }

  return buildLayoutMapFromExport(reportState, tocSection);
}

function buildLayoutMapFromExport(reportState, tocSection) {
  const { exportPackage } = reportState;
  const surface = tocSection.layoutSurface;
  const targetKey = surface === "roof" ? "external_roof" : surface;
  const config = exportPackage.layoutConfigs.find((item) => item.targetKey === targetKey);
  if (!config) return null;

  if (surface === "shell") {
    return buildShellLayoutMap(reportState, tocSection, config);
  }

  return buildCircularLayoutMap(reportState, tocSection, config);
}

function buildCircularLayoutMap(reportState, tocSection, config) {
  const { exportPackage } = reportState;
  const surface = tocSection.layoutSurface;
  const targetKey = surface === "roof" ? "external_roof" : "floor";
  const gridRows =
    surface === "roof"
      ? config.roofRowCount ?? 6
      : config.floorPatternCountX ?? Math.max(1, Math.ceil(Math.sqrt(config.floorPlateCount || 36)));
  const gridColumns =
    surface === "roof"
      ? config.roofWidestRowPlateCount ?? 11
      : config.floorPatternCountY ?? Math.max(1, Math.ceil((config.floorPlateCount || gridRows) / gridRows));
  const plates = buildAndroidCircularPlateCells(
    gridRows,
    gridColumns,
    surface === "roof" ? "android:RoofSurfaceMap:circular_plate" : "android:FloorSurfaceMap:circular_plate",
  );
  const markers = [
    ...buildTargetFindingMarkers(exportPackage, targetKey, plates),
    ...buildTargetElementMarkers(exportPackage, targetKey),
  ];

  return normalizeLayoutMap({
    id: tocSection.id,
    title: tocSection.title,
    subtitle:
      surface === "roof"
        ? `Roof map: circular plate template, ${gridRows} rows, ${gridColumns} widest-row plates, ${plates.length} visible plates`
        : `Floor map: circular plate template, ${gridRows} rows, ${gridColumns} widest-row plates, ${plates.length} visible plates`,
    surfaceLabel: surface === "roof" ? "Roof plate layout" : "Floor/bottom plate layout",
    markers,
    plates,
    gridRows,
    gridColumns,
    drawingBlock: buildDrawingBlock(reportState, tocSection, config),
    appMap: {
      surfaceType: surface,
      referenceMode: humanizeKey(config.referenceMode ?? "tank_north"),
      referenceNote: config.referenceNote,
    },
    overrideCount: 0,
  });
}

function buildShellLayoutMap(reportState, tocSection, config) {
  const { exportPackage } = reportState;
  const gridRows = config.shellCourseCount ?? exportPackage.inspectionRecord.shellCourseCount ?? 8;
  const gridColumns = config.shellLaneCount ?? exportPackage.inspectionRecord.shellLaneCount ?? 4;
  const plates = buildAndroidShellPlateSegments(
    gridRows,
    config.shellPlatesPerCourse ?? 9,
    config.shellPlateOffset ?? "none",
    config.shellOffsetStartRow ?? "even",
    config.shellThirdOffsetStart,
  );
  const markers = [
    ...buildShellFindingMarkers(exportPackage, gridRows, gridColumns),
    ...buildTargetElementMarkers(exportPackage, "shell"),
  ];

  return normalizeLayoutMap({
    id: tocSection.id,
    title: tocSection.title,
    subtitle: `Shell map: ${gridRows} courses, ${gridColumns} UT lanes`,
    surfaceLabel: "Shell layout",
    markers,
    plates,
    gridRows,
    gridColumns,
    drawingBlock: buildDrawingBlock(reportState, tocSection, config),
    appMap: {
      surfaceType: "shell",
      referenceMode: humanizeKey(config.referenceMode ?? "tank_north"),
      referenceNote: config.referenceNote,
      shell: {
        courseCount: gridRows,
        platesPerCourse: config.shellPlatesPerCourse ?? 9,
        laneCount: gridColumns,
        plateOffset: config.shellPlateOffset ?? "none",
        offsetStartRow: config.shellOffsetStartRow ?? "even",
        thirdOffsetStart: config.shellThirdOffsetStart,
      },
    },
    overrideCount: 0,
  });
}

function buildDrawingBlock(reportState, tocSection, config) {
  const { exportPackage, reportJob, manualSupplement } = reportState;
  const surfaceLabel = tocSection.layoutSurface === "roof"
    ? "External Roof Layout"
    : tocSection.layoutSurface === "floor"
      ? "Floor Plate Layout"
      : "Shell Layout";

  return {
    client: exportPackage.task.client,
    project: `Tank ${exportPackage.task.tankNumber} ${surfaceLabel}`,
    drawing: `Section-${tocSection.number}`,
    reference: manualSupplement?.reportReference ?? reportJob?.reportReference ?? "Pending confirmation",
    referenceMode: humanizeKey(config.referenceMode ?? "tank_north"),
    updatedAtLabel: formatShortDate(exportPackage.exportedAtIso),
  };
}

function normalizeLayoutMap(layoutMap) {
  return {
    ...layoutMap,
    markers: (layoutMap.markers ?? []).map(clampMarker),
    plates: (layoutMap.plates ?? []).map(clampPlate),
  };
}

function renderCircularMap(layoutMap, clipId) {
  const center = CIRCULAR_MAP.x + CIRCULAR_MAP.size / 2;
  const radius = CIRCULAR_MAP.size * 0.42;

  return [
    `<text class="map-title" x="${CIRCULAR_MAP.x}" y="38">${escapeXml(layoutMap.appMap?.surfaceType === "floor" ? "Floor Layout Map" : "Roof Layout Map")}</text>`,
    `<text class="map-subtitle" x="${CIRCULAR_MAP.x}" y="58">Reference: 0 degree = ${escapeXml(layoutMap.appMap?.referenceMode ?? layoutMap.drawingBlock.referenceMode)}</text>`,
    `<circle class="circular-fill" cx="${center}" cy="${center}" r="${radius}" />`,
    `<line class="reference-line" x1="${center}" x2="${center}" y1="${center}" y2="${center - radius}" />`,
    `<text class="zero-label" x="${center - 8}" y="${center - radius - 10}">0°</text>`,
    `<g clip-path="url(#${clipId})">`,
    ...layoutMap.plates.map((plate) => {
      const rect = circularPlateRect(plate);
      return `<rect class="plate" height="${rect.height}" rx="4" width="${rect.width}" x="${rect.x}" y="${rect.y}" />`;
    }),
    "</g>",
    `<circle class="circular-outline" cx="${center}" cy="${center}" r="${radius}" />`,
    ...layoutMap.plates.map((plate) => {
      const rect = circularPlateRect(plate);
      return `<text class="plate-label" x="${rect.x + rect.width / 2}" y="${rect.y + rect.height / 2 + 4}">${escapeXml(plate.label)}</text>`;
    }),
    renderMarkers(layoutMap, CIRCULAR_MAP),
  ].join("");
}

function renderShellMap(layoutMap) {
  const shell = layoutMap.appMap?.shell;
  const courseCount = shell?.courseCount ?? layoutMap.gridRows;
  const laneCount = shell?.laneCount ?? layoutMap.gridColumns;
  const plates =
    layoutMap.plates.length > 0
      ? layoutMap.plates
      : buildAndroidShellPlateSegments(
          courseCount,
          shell?.platesPerCourse ?? 9,
          shell?.plateOffset ?? "none",
          shell?.offsetStartRow ?? "even",
          shell?.thirdOffsetStart,
        );
  const rowHeight = SHELL_GRID.height / Math.max(courseCount, 1);
  const laneWidth = SHELL_GRID.width / Math.max(laneCount, 1);

  return [
    `<text class="map-title" x="${SHELL_GRID.x}" y="42">Shell Surface Map</text>`,
    `<text class="map-subtitle" x="${SHELL_GRID.x}" y="64">0 degree / 360 degree = ${escapeXml(layoutMap.appMap?.referenceMode ?? "Tank North")}</text>`,
    `<text class="map-subtitle shell-edge-label" x="${SHELL_GRID.x + SHELL_GRID.width}" y="64">360 degree</text>`,
    ...Array.from({ length: courseCount }).map((_, rowIndex) => {
      const course = courseCount - rowIndex;
      const y = SHELL_GRID.y + rowIndex * rowHeight;
      return `<text class="course-label" x="${SHELL_GRID.x - 44}" y="${y + rowHeight * 0.6}">C${course}</text>`;
    }),
    ...Array.from({ length: laneCount }).map((_, laneIndex) =>
      `<text class="lane-label" x="${SHELL_GRID.x + laneIndex * laneWidth + laneWidth / 2}" y="${SHELL_GRID.y - 18}">${escapeXml(shellLaneDisplayLabel(laneIndex, laneCount))}</text>`,
    ),
    ...plates.map((plate) => {
      const rect = shellPlateRect(plate);
      return `<rect class="shell-segment" height="${rect.height}" rx="6" width="${rect.width}" x="${rect.x}" y="${rect.y}" />`;
    }),
    ...Array.from({ length: courseCount }).flatMap((_, rowIndex) => {
      const course = courseCount - rowIndex;
      const y = SHELL_GRID.y + rowIndex * rowHeight;
      return Array.from({ length: laneCount }).map((__, laneIndex) => {
        const label = shellRegionDisplayLabel(laneIndex, laneCount, course);
        return [
          `<rect class="shell-region" height="${rowHeight - 2}" width="${laneWidth}" x="${SHELL_GRID.x + laneIndex * laneWidth}" y="${y}" />`,
          `<text class="shell-region-label" x="${SHELL_GRID.x + laneIndex * laneWidth + laneWidth / 2}" y="${y + rowHeight / 2 + 4}">${escapeXml(label)}</text>`,
        ].join("");
      });
    }),
    renderMarkers(layoutMap, SHELL_GRID),
  ].join("");
}

function renderMarkers(layoutMap, mapBox) {
  return `<g>${layoutMap.markers.map((marker) => {
    const point = markerPoint(marker, mapBox);
    const isElement = marker.type === "element";
    return [
      `<g class="${isElement ? "marker marker-element" : "marker"}">`,
      `<circle class="marker-circle" cx="${point.x}" cy="${point.y}" r="${isElement ? 8 : 9}" />`,
      `<text class="marker-label" x="${point.x + 12}" y="${point.y - 10}">${escapeXml(compactMarkerLabel(marker.label))}</text>`,
      "</g>",
    ].join("");
  }).join("")}</g>`;
}

function renderDrawingBlock(layoutMap) {
  const block = layoutMap.drawingBlock ?? {};
  return [
    `<g class="drawing-block">`,
    `<rect height="${DRAWING_BLOCK.height}" rx="8" width="${DRAWING_BLOCK.width}" x="${DRAWING_BLOCK.x}" y="${DRAWING_BLOCK.y}" />`,
    `<text x="${DRAWING_BLOCK.x + 14}" y="${DRAWING_BLOCK.y + 24}">CLIENT: ${escapeXml(block.client ?? "")}</text>`,
    `<text x="${DRAWING_BLOCK.x + 14}" y="${DRAWING_BLOCK.y + 44}">PROJECT: ${escapeXml(block.project ?? "")}</text>`,
    `<text x="${DRAWING_BLOCK.x + 14}" y="${DRAWING_BLOCK.y + 64}">DRAWING: ${escapeXml(block.drawing ?? "")}</text>`,
    `<text x="${DRAWING_BLOCK.x + 14}" y="${DRAWING_BLOCK.y + 84}">REF: ${escapeXml(block.reference ?? "")}</text>`,
    "</g>",
  ].join("");
}

function buildTargetElementMarkers(exportPackage, targetKey) {
  return exportPackage.elements
    .filter((element) => element.targetKey === targetKey)
    .map((element) => {
      const position =
        targetKey === "external_roof" || targetKey === "floor"
          ? coerceCircularMarkerPosition(element.normalizedX, element.normalizedY)
          : {
              x: clamp(element.normalizedX, 0.08, 0.92),
              y: clamp(element.normalizedY, 0.12, 0.88),
            };

      return {
        id: element.elementId,
        label: element.elementLabel,
        type: "element",
        x: position.x,
        y: position.y,
      };
    });
}

function buildTargetFindingMarkers(exportPackage, targetKey, plates) {
  return exportPackage.findings
    .filter((finding) => finding.targetKey === targetKey)
    .map((finding, index) => buildSurfaceFindingMarker(finding, exportPackage.elements, plates, index));
}

function buildSurfaceFindingMarker(finding, elements, plates, index) {
  const linkedElementId = /:element:([^:]+)$/i.exec(finding.linkedUtItemKey ?? "")?.[1];
  const linkedElement = linkedElementId ? elements.find((element) => element.elementId === linkedElementId) : undefined;
  if (linkedElement) {
    const position = coerceCircularMarkerPosition(linkedElement.normalizedX + 0.025, linkedElement.normalizedY + 0.025);
    return {
      id: finding.findingId,
      label: finding.itemLabel,
      type: "finding",
      x: position.x,
      y: position.y,
    };
  }

  const plateNumber = extractPlateNumber(finding.linkedUtItemKey) ?? extractPlateNumber(finding.itemLabel);
  if (plateNumber != null && plateNumber > 0) {
    const matchingPlate = plates.find((plate) => plate.id === plateNumber.toString());
    const x = matchingPlate ? matchingPlate.x + matchingPlate.width / 2 : 0.5;
    const y = matchingPlate ? matchingPlate.y + matchingPlate.height / 2 : 0.5;

    return {
      id: finding.findingId,
      label: finding.itemLabel,
      type: "finding",
      x: clamp(x, 0.08, 0.92),
      y: clamp(y, 0.12, 0.88),
    };
  }

  return {
    id: finding.findingId,
    label: finding.itemLabel,
    type: "finding",
    ...coerceCircularMarkerPosition(0.14 + index * 0.08, 0.22 + index * 0.06),
  };
}

function buildShellFindingMarkers(exportPackage, courseCount, laneCount) {
  return exportPackage.findings
    .filter((finding) => finding.targetKey === "shell")
    .map((finding, index) => {
      const linkedElementId = /:element:([^:]+)$/i.exec(finding.linkedUtItemKey ?? "")?.[1];
      const linkedElement = linkedElementId
        ? exportPackage.elements.find((element) => element.elementId === linkedElementId)
        : undefined;

      if (linkedElement) {
        return {
          id: finding.findingId,
          label: finding.itemLabel,
          type: "finding",
          x: clamp(linkedElement.normalizedX + 0.025, 0.08, 0.92),
          y: clamp(linkedElement.normalizedY + 0.025, 0.12, 0.88),
        };
      }

      const regionMatch = /:region:(L\d+)-C(\d+)/i.exec(finding.linkedUtItemKey ?? "");
      const regionPosition = regionMatch
        ? shellRegionMarkerPosition(regionMatch[1], Number(regionMatch[2]), laneCount, courseCount)
        : null;
      if (regionPosition) {
        return {
          id: finding.findingId,
          label: finding.itemLabel,
          type: "finding",
          x: regionPosition.x,
          y: regionPosition.y,
        };
      }

      return {
        id: finding.findingId,
        label: finding.itemLabel,
        type: "finding",
        x: clamp(0.12 + index * 0.08, 0.08, 0.92),
        y: clamp(0.2 + index * 0.04, 0.12, 0.88),
      };
    });
}

function buildAndroidCircularPlateCells(rowCount, widestRowPlateCount, source) {
  const rows = Math.max(Math.floor(rowCount), 1);
  const widest = Math.max(Math.floor(widestRowPlateCount), 1);
  const radius = 0.42;
  const center = 0.5;
  const rowHeight = (2 * radius) / rows;
  const nominalPlateWidth = (2 * radius) / widest;
  const cells = [];
  let nextPlateNumber = 1;

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const rowNumber = rowIndex + 1;
    const topNorm = center - radius + rowIndex * rowHeight;
    const bottomNorm = topNorm + rowHeight;
    const rowCenter = (topNorm + bottomNorm) / 2;
    const dy = rowCenter - center;
    const xSpan = Math.sqrt(Math.max(0, radius * radius - dy * dy));
    const rowLeft = center - xSpan;
    const rowRight = center + xSpan;
    const staggerOffset = rowIndex % 2 === 0 ? 0 : nominalPlateWidth / 2;
    const nominalStart = center - radius - staggerOffset;
    const nominalEnd = center + radius + nominalPlateWidth;
    const rowCells = [];
    let segmentStart = nominalStart;

    while (segmentStart < nominalEnd) {
      const segmentEnd = segmentStart + nominalPlateWidth;
      const visibleLeft = Math.max(segmentStart, rowLeft);
      const visibleRight = Math.min(segmentEnd, rowRight);

      if (visibleRight - visibleLeft > nominalPlateWidth * 0.04) {
        rowCells.push({ left: segmentStart, right: segmentEnd });
      }

      segmentStart = segmentEnd;
    }

    rowCells.forEach((cell, position) => {
      const plateNumber =
        rowNumber % 2 === 1
          ? nextPlateNumber + position
          : nextPlateNumber + (rowCells.length - 1 - position);

      cells.push(
        clampPlate({
          id: plateNumber.toString(),
          label: plateNumber.toString(),
          row: rowNumber,
          column: position + 1,
          x: cell.left,
          y: topNorm,
          width: cell.right - cell.left,
          height: bottomNorm - topNorm,
          source,
        }),
      );
    });

    nextPlateNumber += rowCells.length;
  }

  return cells;
}

function buildAndroidShellPlateSegments(courseCount, platesPerCourse, offsetMode, offsetStartRow, thirdOffsetStart) {
  const rows = Math.max(Math.floor(courseCount), 1);
  const plateCount = Math.max(Math.floor(platesPerCourse), 1);
  const rowHeight = 1 / rows;
  const cellWidth = 1 / plateCount;
  const segments = [];

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const course = rows - rowIndex;
    const y = rowIndex * rowHeight;
    const offsetFraction = shellOffsetFraction(course, offsetMode, offsetStartRow, thirdOffsetStart);

    if (offsetFraction > 0 && plateCount > 1) {
      const leadingRight = cellWidth * offsetFraction;
      const trailingLeft = 1 - cellWidth * (1 - offsetFraction);

      segments.push(shellPlateSegment(`course-${course}-lead`, course, 0, 0, leadingRight, y, rowHeight));
      for (let plateIndex = 0; plateIndex < plateCount - 1; plateIndex += 1) {
        const x = cellWidth * offsetFraction + plateIndex * cellWidth;
        segments.push(shellPlateSegment(`course-${course}-plate-${plateIndex + 1}`, course, plateIndex + 1, x, cellWidth, y, rowHeight));
      }
      segments.push(shellPlateSegment(`course-${course}-trail`, course, plateCount, trailingLeft, 1 - trailingLeft, y, rowHeight));
    } else {
      for (let plateIndex = 0; plateIndex < plateCount; plateIndex += 1) {
        segments.push(shellPlateSegment(`course-${course}-plate-${plateIndex + 1}`, course, plateIndex + 1, plateIndex * cellWidth, cellWidth, y, rowHeight));
      }
    }
  }

  return segments;
}

function shellPlateSegment(id, course, column, x, width, y, rowHeight) {
  return clampPlate({
    id,
    label: "",
    row: course,
    column,
    x,
    y,
    width,
    height: rowHeight * 0.95,
    source: "android:shell-ut-segment",
  });
}

function shellOffsetFraction(courseNo, offsetMode, offsetStartRow, thirdOffsetStart) {
  if (offsetMode === "third_plate") {
    const startStep = thirdOffsetStart === "one_third" ? 1 : thirdOffsetStart === "two_thirds" ? 2 : 0;
    return ((startStep + courseNo - 1) % 3) / 3;
  }

  if (offsetMode === "half_plate") {
    const shouldOffset = offsetStartRow === "odd" ? courseNo % 2 === 1 : courseNo % 2 === 0;
    return shouldOffset ? 0.5 : 0;
  }

  return 0;
}

function shellRegionMarkerPosition(laneId, course, laneCount, courseCount) {
  const laneMatch = /^L(\d+)$/i.exec(laneId ?? "");
  const laneNumber = laneMatch ? Number(laneMatch[1]) : null;
  if (!laneNumber || !course) return null;

  return {
    x: clamp((laneNumber - 0.5) / Math.max(laneCount, 1), 0.04, 0.96),
    y: clamp((Math.max(courseCount, 1) - course + 0.5) / Math.max(courseCount, 1), 0.05, 0.95),
  };
}

function circularPlateRect(plate) {
  return {
    x: CIRCULAR_MAP.x + plate.x * CIRCULAR_MAP.size,
    y: CIRCULAR_MAP.y + plate.y * CIRCULAR_MAP.size,
    width: plate.width * CIRCULAR_MAP.size,
    height: plate.height * CIRCULAR_MAP.size,
  };
}

function shellPlateRect(plate) {
  return {
    x: SHELL_GRID.x + plate.x * SHELL_GRID.width,
    y: SHELL_GRID.y + plate.y * SHELL_GRID.height,
    width: plate.width * SHELL_GRID.width,
    height: plate.height * SHELL_GRID.height,
  };
}

function markerPoint(marker, mapBox) {
  return {
    x: mapBox.x + marker.x * mapBox.width,
    y: mapBox.y + marker.y * mapBox.height,
  };
}

function clampPlate(plate) {
  return {
    ...plate,
    x: clamp(plate.x, 0, 0.98),
    y: clamp(plate.y, 0, 0.98),
    width: clamp(plate.width, 0.02, 1),
    height: clamp(plate.height, 0.02, 1),
  };
}

function clampMarker(marker) {
  return {
    ...marker,
    x: clamp(marker.x, 0.02, 0.98),
    y: clamp(marker.y, 0.04, 0.96),
  };
}

function coerceCircularMarkerPosition(x, y) {
  const center = 0.5;
  const controlledRadius = 0.395;
  const dx = x - center;
  const dy = y - center;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= controlledRadius || distance === 0) {
    return {
      x: clamp(x, center - controlledRadius, center + controlledRadius),
      y: clamp(y, center - controlledRadius, center + controlledRadius),
    };
  }

  const scale = controlledRadius / distance;
  return {
    x: center + dx * scale,
    y: center + dy * scale,
  };
}

function shellLaneDisplayLabel(laneIndex, laneCount) {
  if (laneCount === 4) return ["N", "E", "S", "W"][Math.min(Math.max(laneIndex, 0), 3)] ?? `L${laneIndex + 1}`;
  if (laneIndex === 0) return "L1 (N)";
  return `L${laneIndex + 1}`;
}

function shellRegionDisplayLabel(laneIndex, laneCount, course) {
  if (laneCount === 4) return `${shellLaneDisplayLabel(laneIndex, laneCount)}-C${course}`;
  return `L${laneIndex + 1}-C${course}`;
}

function compactMarkerLabel(label) {
  return String(label ?? "")
    .replace(/^Roof Plate\s+/i, "P")
    .replace(/^Strake\s+/i, "S")
    .replace(/\s*\/\s*/g, "/");
}

function extractPlateNumber(value) {
  if (!value) return null;
  const match = /(?:plate|region)[:\s-]*(\d+)/i.exec(value) ?? /(\d+)/.exec(value);
  return match ? Number(match[1]) : null;
}

function formatShortDate(value) {
  if (!value) return "Pending";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Pending" : date.toISOString().slice(0, 10);
}

function humanizeKey(value) {
  return String(value ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function safeId(value) {
  return String(value ?? "layout").replace(/[^a-z0-9_-]+/gi, "-");
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value ?? 0)));
}

function svgStyles() {
  return `
    .map-page { fill: #ffffff; stroke: rgba(13, 79, 144, 0.14); stroke-width: 2; }
    .map-title { fill: #0a3f73; font: 900 20px Arial, sans-serif; letter-spacing: 0.01em; }
    .map-subtitle { fill: #637083; font: 700 13px Arial, sans-serif; }
    .shell-edge-label { text-anchor: end; }
    .circular-fill { fill: rgba(13, 79, 144, 0.06); stroke: none; }
    .circular-outline { fill: none; stroke: rgba(239, 76, 87, 0.78); stroke-width: 3.5; }
    .reference-line { stroke: rgba(13, 79, 144, 0.86); stroke-width: 3.4; }
    .zero-label { fill: #ef4c57; font: 900 12px Arial, sans-serif; }
    .plate { fill: #ffffff; stroke: rgba(111, 124, 142, 0.55); stroke-width: 1; }
    .plate-label { fill: #253447; font: 800 10px Arial, sans-serif; text-anchor: middle; }
    .course-label { fill: #637083; font: 700 13px Arial, sans-serif; text-anchor: start; }
    .lane-label { fill: #ef4c57; font: 900 13px Arial, sans-serif; text-anchor: middle; }
    .shell-segment { fill: rgba(255,255,255,0.72); stroke: rgba(13,79,144,0.36); stroke-width: 1.2; }
    .shell-region { fill: rgba(255,255,255,0.02); stroke: rgba(239,76,87,0.42); stroke-width: 1.1; stroke-dasharray: 6 6; }
    .shell-region-label { fill: rgba(99,112,131,0.88); font: 800 11px Arial, sans-serif; text-anchor: middle; }
    .marker-circle { fill: rgba(234,242,251,0.96); stroke: #0d4f90; stroke-width: 2.2; }
    .marker-element .marker-circle { stroke: #0a3f73; }
    .marker-label { fill: #0a3f73; font: 900 11px Arial, sans-serif; paint-order: stroke; stroke: #ffffff; stroke-width: 4; }
    .drawing-block rect { fill: #ffffff; stroke: #0a3f73; stroke-width: 1.5; }
    .drawing-block text { fill: #0a3f73; font: 800 12px Arial, sans-serif; }
  `;
}
