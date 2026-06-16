import type { LayoutMapData, LayoutMarker, LayoutPlate } from "../domain/types";

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

export function ensureLayoutMapData(layoutMap: LayoutMapData): LayoutMapData {
  const plates = layoutMap.plates.length > 0 ? layoutMap.plates : buildDefaultPlates(layoutMap.gridRows, layoutMap.gridColumns);

  return {
    ...layoutMap,
    markers: layoutMap.markers.map(clampMarker),
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
  return {
    ...marker,
    x: clamp(marker.x, 0.02, 0.98),
    y: clamp(marker.y, 0.04, 0.96),
  };
}

export function clampPlate(plate: LayoutPlate): LayoutPlate {
  const isAndroidGeometry = plate.source.startsWith("android:");
  const width = clamp(plate.width, isAndroidGeometry ? 0.001 : 0.04, isAndroidGeometry ? 1 : 0.35);
  const height = clamp(plate.height, isAndroidGeometry ? 0.001 : 0.05, isAndroidGeometry ? 1 : 0.32);

  return {
    ...plate,
    x: clamp(plate.x, 0, 1 - width),
    y: clamp(plate.y, isAndroidGeometry ? 0 : 0.02, 1 - height),
    width,
    height,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
