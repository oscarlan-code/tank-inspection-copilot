import type { LayoutMapData, LayoutMarker, LayoutPlate, LayoutPoint } from "../domain/types";

export const MAP_STAGE = {
  width: 920,
  height: 420,
  shell: {
    x: 46,
    y: 42,
    width: 564,
    height: 272,
  },
  drawingBlock: {
    x: 646,
    y: 270,
    width: 226,
    height: 106,
  },
} as const;

const LEGACY_LAYOUT_SOURCE = "report-platform:legacy-layout-override";

export function ensureLayoutMapData(layoutMap: LayoutMapData): LayoutMapData {
  const importedMarkers = Array.isArray(layoutMap.markers) ? layoutMap.markers : [];
  const importedPlates = Array.isArray(layoutMap.plates) ? layoutMap.plates : [];
  const plates = importedPlates.length > 0
    ? importedPlates
    : buildDefaultPlates(layoutMap.gridRows, layoutMap.gridColumns);

  return {
    ...layoutMap,
    markers: importedMarkers.map(clampMarker),
    plates: plates.map(clampPlate),
  };
}

export function buildDefaultPlates(gridRows: number, gridColumns: number): LayoutPlate[] {
  const rows = Math.max(gridRows, 1);
  const columns = Math.max(gridColumns, 1);
  const usableWidth = 0.9;
  const usableHeight = 0.84;
  const xInset = 0.05;
  const yInset = 0.08;
  const plateWidth = usableWidth / columns;
  const plateHeight = usableHeight / rows;

  return Array.from({ length: rows }).flatMap((_, rowIndex) =>
    Array.from({ length: columns }).map((__, columnIndex) => {
      const rowOffset = rowIndex % 2 === 0 ? 0 : plateWidth * 0.18;
      return clampPlate({
        id: `plate-${rowIndex + 1}-${columnIndex + 1}`,
        label: `C${rows - rowIndex}-P${columnIndex + 1}`,
        row: rowIndex + 1,
        column: columnIndex + 1,
        x: xInset + columnIndex * plateWidth - rowOffset,
        y: yInset + rowIndex * plateHeight,
        width: plateWidth * 0.98,
        height: plateHeight * 0.94,
        source: "android:layoutConfig",
      });
    }),
  );
}

export function buildAndroidCircularPlateCells(
  rowCount: number,
  widestRowPlateCount: number,
  source: string,
): LayoutPlate[] {
  const rows = Math.max(Math.floor(rowCount), 1);
  const widest = Math.max(Math.floor(widestRowPlateCount), 1);
  const radius = 0.42;
  const center = 0.5;
  const rowHeight = (2 * radius) / rows;
  const nominalPlateWidth = (2 * radius) / widest;
  const cells: LayoutPlate[] = [];
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
    const rowCells: Array<{ left: number; right: number }> = [];
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

export function buildV3AppAnnularRingSections(
  sectionCount: number,
  rotationDegrees: number,
  annularWidthRatio: number,
  source: string,
): LayoutPlate[] {
  const count = Math.max(Math.floor(sectionCount), 0);
  if (count === 0) return [];

  const innerRadius = 0.42;
  const safeWidthRatio = clamp(annularWidthRatio, 0.06, 0.18);
  const outerRadius = innerRadius * (1 + safeWidthRatio);
  const step = 360 / count;

  return Array.from({ length: count }, (_, sectionIndex) => {
    const start = rotationDegrees + step * sectionIndex;
    const end = start + step;
    const outerArc = sampleAzimuthArc(start, end, outerRadius);
    const innerArc = sampleAzimuthArc(end, start, innerRadius);
    const points = [...outerArc, ...innerArc];
    const xValues = points.map((point) => point.x);
    const yValues = points.map((point) => point.y);
    const x = Math.min(...xValues);
    const y = Math.min(...yValues);
    const right = Math.max(...xValues);
    const bottom = Math.max(...yValues);
    const sectionNumber = sectionIndex + 1;

    return {
      id: `AR${sectionNumber}`,
      label: `AR${sectionNumber}`,
      aliases: [`A${sectionNumber}`],
      plateKind: "annular",
      row: 0,
      column: sectionNumber,
      x: roundGeometry(x),
      y: roundGeometry(y),
      width: roundGeometry(right - x),
      height: roundGeometry(bottom - y),
      points,
      source,
    };
  });
}

export function buildResolvedAnnularPlateGeometry(
  customLayout: unknown,
  source: string,
): LayoutPlate[] {
  if (!isRecord(customLayout) || customLayout.resolvedGeometryVersion !== 2) return [];
  if (!Array.isArray(customLayout.resolvedAnnularPlateGeometry)) return [];

  return customLayout.resolvedAnnularPlateGeometry
    .map((value, index): LayoutPlate | null => {
      if (!isRecord(value) || typeof value.plateId !== "string" || value.plateId.trim() === "") return null;
      const left = toFiniteNumber(value.leftNorm);
      const right = toFiniteNumber(value.rightNorm);
      const top = toFiniteNumber(value.topNorm);
      const bottom = toFiniteNumber(value.bottomNorm);
      const points = Array.isArray(value.points)
        ? value.points
            .map((point): LayoutPoint | null => {
              if (!isRecord(point)) return null;
              const x = toFiniteNumber(point.xNorm);
              const y = toFiniteNumber(point.yNorm);
              return x == null || y == null ? null : { x, y };
            })
            .filter((point): point is LayoutPoint => point != null)
        : [];
      if (
        left == null || right == null || top == null || bottom == null ||
        right <= left || bottom <= top || points.length < 3
      ) return null;

      const plateId = value.plateId.trim();
      const sectionNumber = toInteger(value.sectionNumber) ?? index + 1;
      return clampPlate({
        id: plateId,
        label: plateId,
        mapLabel: typeof value.mapLabel === "string" ? value.mapLabel : `A${sectionNumber}`,
        labelX: toFiniteNumber(value.labelXNorm) ?? (left + right) / 2,
        labelY: toFiniteNumber(value.labelYNorm) ?? (top + bottom) / 2,
        aliases: [`A${sectionNumber}`],
        plateKind: "annular",
        row: 0,
        column: sectionNumber,
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
        points,
        source,
      });
    })
    .filter((plate): plate is LayoutPlate => plate != null);
}

export function buildCustomCircularPlateCells(
  customLayout: unknown,
  source: string,
  _rowCount?: number | null,
  _widestRowPlateCount?: number | null,
  labelMode: "roof" | "floor" = "roof",
  allowLegacyFallback = true,
): LayoutPlate[] {
  const resolvedPlates = parseResolvedMainPlateGeometry(customLayout, `${source}:resolved`);
  if (resolvedPlates.length > 0) return resolvedPlates;
  if (!allowLegacyFallback) return [];

  const rows = parseCustomCircularRows(customLayout);
  if (rows.length === 0) return [];

  const labelsByRowAndPlate = buildCustomCircularPlateRefs(rows, labelMode);
  const cells: LayoutPlate[] = [];
  const totalHeightWeight = Math.max(rows.reduce((total, row) => total + row.heightWeight, 0), 0.001);
  const stableHorizontalRowHeight = 0.84 / Math.max(rows.length, 1);
  let rowTop = 0.08;

  rows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const rowHeight = 0.84 * (row.heightWeight / totalHeightWeight);
    const topNorm = rowTop;
    const bottomNorm = Math.min(rowTop + rowHeight, 0.92);
    rowTop = bottomNorm;
    const stableTop = 0.08 + stableHorizontalRowHeight * rowIndex;
    const stableBottom = stableTop + stableHorizontalRowHeight;
    const nearestCenterY = clamp(0.5, stableTop, stableBottom);
    const chordHalfWidth = Math.sqrt(Math.max(0, 0.42 ** 2 - (nearestCenterY - 0.5) ** 2));
    const rowWidth = Math.max(chordHalfWidth * 2, 0.06);
    const maxShift = rowWidth * 0.16;
    const stripLeft = 0.5 - chordHalfWidth - maxShift;
    const stripWidth = rowWidth + 2 * maxShift;
    const weightSum = Math.max(row.plates.reduce((total, plate) => total + Math.max(plate.widthWeight, 0.001), 0), 0.001);
    const labelByPlateIndex = labelsByRowAndPlate.get(rowIndex) ?? new Map<number, string>();
    let x = stripLeft + clamp(row.shiftRatio, -1, 1) * maxShift;

    row.plates.forEach((plate, position) => {
      const width = stripWidth * (Math.max(plate.widthWeight, 0.001) / weightSum);
      const label = labelByPlateIndex.get(position) ?? `${rowNumber}.${position + 1}`;

      cells.push(
        clampPlate({
          id: label,
          label,
          row: row.rowNumber,
          column: position + 1,
          x,
          y: topNorm,
          width,
          height: bottomNorm - topNorm,
          source,
        }),
      );
      x += width;
    });
  });

  return cells;
}

export function buildAndroidShellPlateSegments(
  courseCount: number,
  platesPerCourse: number,
  offsetMode: string | null | undefined,
  offsetStartRow: string | null | undefined,
  thirdOffsetStart: string | null | undefined,
): LayoutPlate[] {
  const rows = Math.max(Math.floor(courseCount), 1);
  const plateCount = Math.max(Math.floor(platesPerCourse), 1);
  const rowHeight = 1 / rows;
  const cellWidth = 1 / plateCount;
  const segments: LayoutPlate[] = [];

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const course = rows - rowIndex;
    const y = rowIndex * rowHeight;
    const offsetFraction = shellOffsetFraction(course, offsetMode, offsetStartRow, thirdOffsetStart);

    if (offsetFraction > 0 && plateCount > 1) {
      const leadingRight = cellWidth * offsetFraction;
      const trailingLeft = 1 - cellWidth * (1 - offsetFraction);

      segments.push(
        shellPlateSegment(`course-${course}-lead`, course, 0, 0, leadingRight, y, rowHeight),
      );
      for (let plateIndex = 0; plateIndex < plateCount - 1; plateIndex += 1) {
        const x = cellWidth * offsetFraction + plateIndex * cellWidth;
        segments.push(
          shellPlateSegment(`course-${course}-plate-${plateIndex + 1}`, course, plateIndex + 1, x, cellWidth, y, rowHeight),
        );
      }
      segments.push(
        shellPlateSegment(`course-${course}-trail`, course, plateCount, trailingLeft, 1 - trailingLeft, y, rowHeight),
      );
    } else {
      for (let plateIndex = 0; plateIndex < plateCount; plateIndex += 1) {
        segments.push(
          shellPlateSegment(
            `course-${course}-plate-${plateIndex + 1}`,
            course,
            plateIndex + 1,
            plateIndex * cellWidth,
            cellWidth,
            y,
            rowHeight,
          ),
        );
      }
    }
  }

  return segments;
}

export function shellRegionMarkerPosition(laneId: string | null | undefined, course: number | null | undefined, laneCount: number, courseCount: number) {
  const laneMatch = /^L(\d+)$/i.exec(laneId ?? "");
  const laneNumber = laneMatch ? Number(laneMatch[1]) : null;

  if (!laneNumber || !course) return null;

  return {
    x: clamp((laneNumber - 0.5) / Math.max(laneCount, 1), 0.04, 0.96),
    y: clamp((Math.max(courseCount, 1) - course + 0.5) / Math.max(courseCount, 1), 0.05, 0.95),
  };
}

function shellPlateSegment(
  id: string,
  course: number,
  column: number,
  x: number,
  width: number,
  y: number,
  rowHeight: number,
): LayoutPlate {
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

function shellOffsetFraction(
  courseNo: number,
  offsetMode: string | null | undefined,
  offsetStartRow: string | null | undefined,
  thirdOffsetStart: string | null | undefined,
): number {
  if (offsetMode === "third_plate") {
    const startStep = thirdOffsetStart === "one_third" ? 1 : thirdOffsetStart === "two_thirds" ? 2 : 0;
    return ((startStep + courseNo - 1) % 3) / 3;
  }

  if (offsetMode === "half_plate") {
    const shouldOffset =
      offsetStartRow === "odd" ? courseNo % 2 === 1 : courseNo % 2 === 0;
    return shouldOffset ? 0.5 : 0;
  }

  return 0;
}

type ParsedCustomCircularRow = {
  rowNumber: number;
  shiftRatio: number;
  heightWeight: number;
  plates: Array<{
    widthWeight: number;
    splitGroupKey: string | null;
    splitPartIndex: number | null;
  }>;
};

function parseCustomCircularRows(customLayout: unknown): ParsedCustomCircularRow[] {
  if (!isRecord(customLayout) || !Array.isArray(customLayout.rows)) return [];

  return customLayout.rows
    .map((row, index): ParsedCustomCircularRow | null => {
      if (!isRecord(row) || !Array.isArray(row.plates)) return null;
      const plates = row.plates
        .map((plate): ParsedCustomCircularRow["plates"][number] | null => {
          if (!isRecord(plate)) return null;
          const widthWeight = toPositiveNumber(plate.widthWeight);
          return widthWeight
            ? {
                widthWeight,
                splitGroupKey: typeof plate.splitGroupKey === "string" ? plate.splitGroupKey : null,
                splitPartIndex: toInteger(plate.splitPartIndex),
              }
            : null;
        })
        .filter((plate): plate is ParsedCustomCircularRow["plates"][number] => plate != null);

      if (plates.length === 0) return null;

      return {
        rowNumber: toPositiveNumber(row.rowNumber) ?? index + 1,
        shiftRatio: clamp(toFiniteNumber(row.shiftRatio) ?? 0, -0.4, 0.4),
        heightWeight: toPositiveNumber(row.heightWeight) ?? 1,
        plates,
      };
    })
    .filter((row): row is ParsedCustomCircularRow => row != null)
    .sort((a, b) => a.rowNumber - b.rowNumber);
}

function parseResolvedMainPlateGeometry(customLayout: unknown, source: string): LayoutPlate[] {
  if (
    !isRecord(customLayout) ||
    (customLayout.resolvedGeometryVersion !== 1 && customLayout.resolvedGeometryVersion !== 2)
  ) return [];
  if (!Array.isArray(customLayout.resolvedMainPlateGeometry)) return [];

  return customLayout.resolvedMainPlateGeometry
    .map((value, index): LayoutPlate | null => {
      if (!isRecord(value) || typeof value.plateId !== "string" || value.plateId.trim() === "") return null;
      const left = toFiniteNumber(value.leftNorm);
      const right = toFiniteNumber(value.rightNorm);
      const top = toFiniteNumber(value.topNorm);
      const bottom = toFiniteNumber(value.bottomNorm);
      if (left == null || right == null || top == null || bottom == null || right <= left || bottom <= top) return null;

      const plateId = value.plateId.trim();
      return clampPlate({
        id: plateId,
        label: plateId,
        mapLabel: typeof value.mapLabel === "string" ? value.mapLabel : plateId,
        labelX: toFiniteNumber(value.labelXNorm) ?? (left + right) / 2,
        labelY: toFiniteNumber(value.labelYNorm) ?? (top + bottom) / 2,
        row: toInteger(value.rowNumber) ?? 0,
        column: index + 1,
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
        source,
      });
    })
    .filter((plate): plate is LayoutPlate => plate != null);
}

function groupPlatesByRow(plates: LayoutPlate[]): Map<number, LayoutPlate[]> {
  const grouped = new Map<number, LayoutPlate[]>();
  for (const plate of plates) {
    grouped.set(plate.row, [...(grouped.get(plate.row) ?? []), plate]);
  }
  return grouped;
}

function buildCustomCircularPlateRefs(
  rows: ParsedCustomCircularRow[],
  labelMode: "roof" | "floor",
): Map<number, Map<number, string>> {
  const labelsByRowAndPlate = new Map<number, Map<number, string>>();
  let roofCounter = 1;

  rows.forEach((row, rowIndex) => {
    const plateGroups = groupCustomPlatesBySplitKey(row.plates);
    const groupCount = plateGroups.length;
    const rowLabels = Array.from({ length: groupCount }, (_, groupIndex) =>
      labelMode === "floor"
        ? `${row.rowNumber}.${groupIndex + 1}`
        : String(roofCounter + (row.rowNumber % 2 === 0 ? groupCount - 1 - groupIndex : groupIndex)),
    );
    const rowLabelsByPlate = new Map<number, string>();

    plateGroups.forEach((group, groupIndex) => {
      const base = rowLabels[groupIndex];
      group.forEach((plateIndex) => {
        const plate = row.plates[plateIndex];
        const suffix = plate.splitGroupKey ? splitSuffix(plate.splitPartIndex ?? 0) : "";
        rowLabelsByPlate.set(plateIndex, `${base}${suffix}`);
      });
    });

    labelsByRowAndPlate.set(rowIndex, rowLabelsByPlate);
    if (labelMode === "roof") roofCounter += groupCount;
  });

  return labelsByRowAndPlate;
}

function groupCustomPlatesBySplitKey(plates: ParsedCustomCircularRow["plates"]): number[][] {
  const groups: number[][] = [];
  let plateIndex = 0;

  while (plateIndex < plates.length) {
    const splitKey = plates[plateIndex].splitGroupKey;
    if (!splitKey) {
      groups.push([plateIndex]);
      plateIndex += 1;
      continue;
    }

    const groupStart = plateIndex;
    let groupEnd = plateIndex;
    while (groupEnd + 1 < plates.length && plates[groupEnd + 1].splitGroupKey === splitKey) {
      groupEnd += 1;
    }
    groups.push(Array.from({ length: groupEnd - groupStart + 1 }, (_, index) => groupStart + index));
    plateIndex = groupEnd + 1;
  }

  return groups;
}

function splitSuffix(index: number): string {
  return String.fromCharCode("a".charCodeAt(0) + Math.max(Math.floor(index), 0));
}

function sampleAzimuthArc(startDegrees: number, endDegrees: number, radius: number): Array<{ x: number; y: number }> {
  const span = endDegrees - startDegrees;
  const segmentCount = Math.max(2, Math.ceil(Math.abs(span) / 5));
  return Array.from({ length: segmentCount + 1 }, (_, index) => {
    const azimuth = startDegrees + (span * index) / segmentCount;
    const radians = ((azimuth - 90) * Math.PI) / 180;
    return {
      x: roundGeometry(0.5 + Math.cos(radians) * radius),
      y: roundGeometry(0.5 + Math.sin(radians) * radius),
    };
  });
}

function roundGeometry(value: number): number {
  return Math.round(value * 100_000) / 100_000;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null;
}

function toPositiveNumber(value: unknown): number | null {
  const numberValue = toFiniteNumber(value);
  return numberValue != null && numberValue > 0 ? numberValue : null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function toInteger(value: unknown): number | null {
  const numberValue = toFiniteNumber(value);
  return numberValue == null ? null : Math.floor(numberValue);
}

export function markerToStagePosition(marker: LayoutMarker) {
  return {
    x: MAP_STAGE.shell.x + clamp(marker.x, 0.02, 0.98) * MAP_STAGE.shell.width,
    y: MAP_STAGE.shell.y + clamp(marker.y, 0.04, 0.96) * MAP_STAGE.shell.height,
  };
}

export function stageToMarkerPosition(x: number, y: number) {
  return {
    x: clamp((x - MAP_STAGE.shell.x) / MAP_STAGE.shell.width, 0.02, 0.98),
    y: clamp((y - MAP_STAGE.shell.y) / MAP_STAGE.shell.height, 0.04, 0.96),
  };
}

export function plateToStageRect(plate: LayoutPlate) {
  return {
    x: MAP_STAGE.shell.x + clamp(plate.x, 0, 0.98) * MAP_STAGE.shell.width,
    y: MAP_STAGE.shell.y + clamp(plate.y, 0, 0.98) * MAP_STAGE.shell.height,
    width: clamp(plate.width, 0.04, 1) * MAP_STAGE.shell.width,
    height: clamp(plate.height, 0.04, 1) * MAP_STAGE.shell.height,
  };
}

export function stageToPlateRect(rect: { x: number; y: number; width: number; height: number }) {
  return clampPlate({
    id: "",
    label: "",
    row: 0,
    column: 0,
    source: "",
    x: (rect.x - MAP_STAGE.shell.x) / MAP_STAGE.shell.width,
    y: (rect.y - MAP_STAGE.shell.y) / MAP_STAGE.shell.height,
    width: rect.width / MAP_STAGE.shell.width,
    height: rect.height / MAP_STAGE.shell.height,
  });
}

export function clampMarker(marker: LayoutMarker): LayoutMarker {
  const source = normalizeLayoutSource(marker.source);
  const isAppGeometry = source.startsWith("v3-app:");
  return {
    ...marker,
    source,
    x: clamp(marker.x, isAppGeometry ? 0 : 0.02, isAppGeometry ? 1 : 0.98),
    y: clamp(marker.y, isAppGeometry ? 0 : 0.04, isAppGeometry ? 1 : 0.96),
  };
}

export function clampPlate(plate: LayoutPlate): LayoutPlate {
  const source = normalizeLayoutSource(plate.source);
  const isAppGeometry = source.startsWith("android:") || source.startsWith("v3-app:");
  const width = clamp(plate.width, isAppGeometry ? 0.001 : 0.04, isAppGeometry ? 1.5 : 0.35);
  const height = clamp(plate.height, isAppGeometry ? 0.001 : 0.05, isAppGeometry ? 1 : 0.32);

  return {
    ...plate,
    source,
    x: clamp(plate.x, isAppGeometry ? -0.25 : 0, isAppGeometry ? 1.25 - width : 1 - width),
    y: clamp(plate.y, isAppGeometry ? 0 : 0.02, 1 - height),
    width,
    height,
    points: Array.isArray(plate.points) && plate.points.length >= 3
      ? plate.points.map((point) => ({
          x: clamp(point.x, 0, 1),
          y: clamp(point.y, 0, 1),
        }))
      : undefined,
  };
}

function normalizeLayoutSource(source: unknown): string {
  return typeof source === "string" && source.trim() !== "" ? source : LEGACY_LAYOUT_SOURCE;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
