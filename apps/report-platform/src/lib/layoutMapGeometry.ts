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
  const width = clamp(plate.width, 0.04, 0.35);
  const height = clamp(plate.height, 0.05, 0.32);

  return {
    ...plate,
    x: clamp(plate.x, 0, 0.98 - width),
    y: clamp(plate.y, 0.02, 0.96 - height),
    width,
    height,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
