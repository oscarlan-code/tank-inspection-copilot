import type { LayoutMapData } from "../domain/types";

const MFL_BOTTOM_PLATE_IDS = [
  "1.1", "1.2", "1.3", "1.4", "1.5",
  "2.1", "2.2", "2.3",
  "3.1", "3.2",
  "4.1", "4.2", "4.3",
  "5.1", "5.2",
  "6.1", "6.2a", "6.2b", "6.3",
  "7.1", "7.2", "7.3", "7.4", "7.5",
];

const MFL_ANNULAR_PLATE_IDS = Array.from({ length: 10 }, (_, index) => `A${index + 1}`);

export const MFL_FLOOR_PLATE_IDS = [...MFL_BOTTOM_PLATE_IDS, ...MFL_ANNULAR_PLATE_IDS];

export function isMflCompatibleFloorLayout(layoutMap: LayoutMapData | undefined): boolean {
  if (!layoutMap || layoutMap.appMap?.surfaceType !== "floor") return false;
  const availableIds = new Set(
    layoutMap.plates.flatMap((plate) => [plate.id, plate.label, ...(plate.aliases ?? [])]),
  );
  return MFL_FLOOR_PLATE_IDS.every((plateId) => availableIds.has(plateId));
}
