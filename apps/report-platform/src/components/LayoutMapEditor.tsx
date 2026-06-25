import { useMemo, useState } from "react";
import type {
  AndroidLayoutMapConfig,
  LayoutEvidenceAttachment,
  LayoutEvidenceItem,
  LayoutMapData,
  LayoutMarker,
  LayoutPlate,
} from "../domain/types";
import { buildAndroidShellPlateSegments, ensureLayoutMapData } from "../lib/layoutMapGeometry";

type Props = {
  activeMarkerId: string | null;
  activePlateId: string | null;
  layoutMap: LayoutMapData;
  onLayoutMapChange: (nextLayoutMap: LayoutMapData, summary: string) => void;
  onMarkerSelect: (markerId: string | null) => void;
  onPlateSelect: (plateId: string | null) => void;
  showEvidenceInspector?: boolean;
  variant?: "workspace" | "reportFigure";
};

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

export function LayoutMapEditor({
  activeMarkerId,
  activePlateId,
  layoutMap,
  onLayoutMapChange,
  onMarkerSelect,
  onPlateSelect,
  showEvidenceInspector = true,
  variant = "workspace",
}: Props) {
  const safeLayoutMap = useMemo(() => ensureLayoutMapData(layoutMap), [layoutMap]);
  const selectedMarker = safeLayoutMap.markers.find((marker) => marker.id === activeMarkerId) ?? null;
  const selectedPlate = safeLayoutMap.plates.find((plate) => plate.id === activePlateId) ?? null;
  const selectedPlateEvidence = activePlateId
    ? selectedPlate?.evidence ?? safeLayoutMap.evidenceByKey?.[activePlateId] ?? []
    : [];
  const selectedMarkerEvidence = selectedMarker
    ? selectedMarker.evidence ?? safeLayoutMap.evidenceByKey?.[selectedMarker.id] ?? []
    : [];
  const appMap = safeLayoutMap.appMap;
  void onLayoutMapChange;

  return (
    <div className={`map-workspace map-workspace-readonly map-workspace-${variant}`}>
      <div className="shell-sketch-card">
        <div className="shell-sketch-header">
          <div>
            <h4>{safeLayoutMap.title}</h4>
            <p>{safeLayoutMap.subtitle}</p>
          </div>
        </div>

        <div className="android-map-shell">
          <svg
            aria-label={safeLayoutMap.title}
            className="android-layout-svg"
            role="img"
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          >
            <defs>
              <clipPath id={`circle-clip-${safeLayoutMap.id}`}>
                <circle
                  cx={CIRCULAR_MAP.x + CIRCULAR_MAP.size / 2}
                  cy={CIRCULAR_MAP.y + CIRCULAR_MAP.size / 2}
                  r={CIRCULAR_MAP.size * 0.42}
                />
              </clipPath>
            </defs>

            <rect className="android-map-page" height={SVG_HEIGHT - 18} rx="22" width={SVG_WIDTH - 18} x="9" y="9" />

            {appMap?.surfaceType === "shell" ? (
              <ShellMapPreview
                activeMarkerId={activeMarkerId}
                activePlateId={activePlateId}
                appMap={appMap}
                layoutMap={safeLayoutMap}
                onMarkerSelect={onMarkerSelect}
                onPlateSelect={onPlateSelect}
              />
            ) : (
              <CircularMapPreview
                activeMarkerId={activeMarkerId}
                activePlateId={activePlateId}
                clipPathId={`circle-clip-${safeLayoutMap.id}`}
                layoutMap={safeLayoutMap}
                onMarkerSelect={onMarkerSelect}
                onPlateSelect={onPlateSelect}
              />
            )}

            <DrawingBlock layoutMap={safeLayoutMap} />
          </svg>
        </div>
      </div>

      {showEvidenceInspector ? (
        <div className="map-controls map-evidence-panel">
          <EvidenceInspector
            evidence={selectedMarker ? selectedMarkerEvidence : selectedPlateEvidence}
            label={selectedMarker?.label ?? selectedPlate?.label ?? activePlateId}
            surfaceLabel={safeLayoutMap.surfaceLabel}
          />
        </div>
      ) : null}
    </div>
  );
}

function EvidenceInspector({
  evidence,
  label,
  surfaceLabel,
}: {
  evidence: LayoutEvidenceItem[];
  label: string | null;
  surfaceLabel: string;
}) {
  const displayEvidence = evidence
    .map(toDisplayEvidence)
    .filter((item): item is DisplayEvidenceItem => item != null);
  const locationItems = buildLocationItems(label, surfaceLabel, displayEvidence);
  const measurementItems = displayEvidence.filter((item) => item.kind === "measurement");
  const findingItems = displayEvidence.filter((item) => item.kind === "finding");

  return (
    <div className={`map-inspector ${label ? "" : "map-inspector-empty"}`}>
      <EvidenceColumn
        emptyText="Click a marker, numbered plate, or shell lane-course region to view its location details."
        items={locationItems}
        title="Location Information"
      />
      <EvidenceColumn
        emptyText={label ? "No linked measurement is exported for this location." : "Select a location to view readings."}
        items={measurementItems}
        title="Measurements"
      />
      <EvidenceColumn
        emptyText={label ? "No linked finding is exported for this location." : "Select a location to view findings and photos."}
        items={findingItems}
        title="Findings"
      />
    </div>
  );
}

type DisplayEvidenceItem = {
  id: string;
  kind: LayoutEvidenceItem["kind"];
  title: string;
  subtitle?: string;
  values: string[];
  note?: string;
  attachments?: LayoutEvidenceAttachment[];
};

function buildLocationItems(
  label: string | null,
  surfaceLabel: string,
  displayEvidence: DisplayEvidenceItem[],
): DisplayEvidenceItem[] {
  if (!label) return [];

  const exportedLocationItems = displayEvidence.filter((item) => item.kind === "element");
  const baseLocation: DisplayEvidenceItem = {
    id: `location-${label}`,
    kind: "element",
    title: label,
    subtitle: surfaceLabel,
    values: [`Location: ${label}`],
  };

  if (exportedLocationItems.length === 0) return [baseLocation];

  return [
    baseLocation,
    ...exportedLocationItems.map((item) => ({
      ...item,
      values: item.values.filter((value) => !/^Location:/i.test(value)),
    })),
  ];
}

function EvidenceColumn({
  emptyText,
  items,
  title,
}: {
  emptyText: string;
  items: DisplayEvidenceItem[];
  title: string;
}) {
  return (
    <section className="map-evidence-column">
      <h4>{title}</h4>
      {items.length > 0 ? (
        <div className="map-evidence-stack">
          {items.map((item) => (
            <article className={`map-evidence-card map-evidence-${item.kind}`} key={item.id}>
              <div>
                <strong>{item.title}</strong>
                {item.subtitle ? <small>{item.subtitle}</small> : null}
              </div>
              {item.values.length > 0 ? (
                <ul>
                  {item.values.map((value) => (
                    <li key={value}>{value}</li>
                  ))}
                </ul>
              ) : null}
              {item.note ? <p>{item.note}</p> : null}
              {item.attachments && item.attachments.length > 0 ? (
                <div className="map-finding-photo-grid">
                  {item.attachments.map((attachment) => (
                    <FindingPhotoTile attachment={attachment} key={attachment.attachmentId} />
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="map-evidence-empty">{emptyText}</p>
      )}
    </section>
  );
}

function FindingPhotoTile({ attachment }: { attachment: LayoutEvidenceAttachment }) {
  const [hasImageError, setHasImageError] = useState(false);
  const canPreviewImage = attachment.mediaType.startsWith("image/") && !hasImageError;
  const imageSrc = `/${attachment.relativePath}`;

  return (
    <figure className="map-finding-photo-tile">
      {canPreviewImage ? (
        <img
          alt={attachment.displayName}
          loading="lazy"
          onError={() => setHasImageError(true)}
          src={imageSrc}
        />
      ) : (
        <div className="map-finding-photo-placeholder">
          <span>Photo</span>
        </div>
      )}
      <figcaption>
        <strong>{attachment.displayName}</strong>
        <span>{attachment.relativePath}</span>
      </figcaption>
    </figure>
  );
}

function toDisplayEvidence(item: LayoutEvidenceItem): DisplayEvidenceItem | null {
  if (item.kind === "measurement") {
    const values = (item.values ?? []).filter((value) =>
      /^(Readings|Reinforcement pad):/i.test(value),
    );

    return values.length > 0
      ? {
          id: item.id,
          kind: item.kind,
          title: item.title,
          subtitle: item.subtitle,
          values,
        }
      : null;
  }

  if (item.kind === "finding") {
    return item.note || item.attachments?.length
      ? {
          id: item.id,
          kind: item.kind,
          title: item.title,
          subtitle: item.subtitle,
          values: (item.values ?? []).filter((value) => /Missing attachment/i.test(value)),
          note: item.note,
          attachments: item.attachments,
        }
      : null;
  }

  const values = (item.values ?? []).filter((value) => /^(Position|Host location|Location source):/i.test(value));
  return values.length > 0
    ? {
        id: item.id,
        kind: item.kind,
        title: item.title,
        subtitle: item.subtitle,
        values,
      }
    : null;
}

function CircularMapPreview({
  activeMarkerId,
  activePlateId,
  clipPathId,
  layoutMap,
  onMarkerSelect,
  onPlateSelect,
}: {
  activeMarkerId: string | null;
  activePlateId: string | null;
  clipPathId: string;
  layoutMap: LayoutMapData;
  onMarkerSelect: (markerId: string | null) => void;
  onPlateSelect: (plateId: string | null) => void;
}) {
  const center = CIRCULAR_MAP.x + CIRCULAR_MAP.size / 2;
  const radius = CIRCULAR_MAP.size * 0.42;

  return (
    <g>
      <text className="android-map-title" x={CIRCULAR_MAP.x} y={38}>
        {layoutMap.appMap?.surfaceType === "floor" ? "Floor Layout Map" : "Roof Layout Map"}
      </text>
      <text className="android-map-subtitle" x={CIRCULAR_MAP.x} y={58}>
        Reference: 0 degree = {layoutMap.appMap?.referenceMode ?? layoutMap.drawingBlock.referenceMode}
      </text>
      <circle className="android-circular-fill" cx={center} cy={center} r={radius} />
      <line className="android-reference-line" x1={center} x2={center} y1={center} y2={center - radius} />
      <text className="android-zero-label" x={center - 8} y={center - radius - 10}>
        0°
      </text>

      <g clipPath={`url(#${clipPathId})`}>
        {layoutMap.plates.map((plate) => {
          const rect = circularPlateRect(plate);
          const isActive = plate.id === activePlateId;

          return (
            <rect
              className={isActive ? "android-plate android-plate-active" : "android-plate"}
              height={rect.height}
              key={plate.id}
              onClick={() => {
                onPlateSelect(plate.id);
                onMarkerSelect(null);
              }}
              rx="4"
              width={rect.width}
              x={rect.x}
              y={rect.y}
            />
          );
        })}
      </g>

      <circle className="android-circular-outline" cx={center} cy={center} r={radius} />

      {layoutMap.plates.map((plate) => {
        const rect = circularPlateRect(plate);
        const labelX = rect.x + rect.width / 2;
        const labelY = rect.y + rect.height / 2 + 4;

        return (
          <text className="android-plate-label" key={`${plate.id}-label`} x={labelX} y={labelY}>
            {plate.label}
          </text>
        );
      })}

      <MapMarkers
        activeMarkerId={activeMarkerId}
        layoutMap={layoutMap}
        mapBox={{
          x: CIRCULAR_MAP.x,
          y: CIRCULAR_MAP.y,
          width: CIRCULAR_MAP.size,
          height: CIRCULAR_MAP.size,
        }}
        onMarkerSelect={onMarkerSelect}
        onPlateSelect={onPlateSelect}
      />
    </g>
  );
}

function ShellMapPreview({
  activeMarkerId,
  activePlateId,
  appMap,
  layoutMap,
  onMarkerSelect,
  onPlateSelect,
}: {
  activeMarkerId: string | null;
  activePlateId: string | null;
  appMap: AndroidLayoutMapConfig;
  layoutMap: LayoutMapData;
  onMarkerSelect: (markerId: string | null) => void;
  onPlateSelect: (plateId: string | null) => void;
}) {
  const shell = appMap.shell;
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
          shell?.thirdOffsetStart ?? null,
        );
  const rowHeight = SHELL_GRID.height / courseCount;
  const laneWidth = SHELL_GRID.width / laneCount;

  return (
    <g>
      <text className="android-map-title" x={SHELL_GRID.x} y={42}>
        Shell Surface Map
      </text>
      <text className="android-map-subtitle" x={SHELL_GRID.x} y={64}>
        0 degree / 360 degree = {appMap.referenceMode}
      </text>
      <text className="android-map-subtitle android-shell-edge-label" x={SHELL_GRID.x + SHELL_GRID.width} y={64}>
        360 degree
      </text>

      {Array.from({ length: courseCount }).map((_, rowIndex) => {
        const course = courseCount - rowIndex;
        const y = SHELL_GRID.y + rowIndex * rowHeight;

        return (
          <text className="android-course-label" key={`course-${course}`} x={SHELL_GRID.x - 44} y={y + rowHeight * 0.6}>
            C{course}
          </text>
        );
      })}

      {Array.from({ length: laneCount }).map((_, laneIndex) => (
        <text
          className="android-lane-label"
          key={`lane-${laneIndex}`}
          x={SHELL_GRID.x + laneIndex * laneWidth + laneWidth / 2}
          y={SHELL_GRID.y - 18}
        >
          {shellLaneDisplayLabel(laneIndex, laneCount)}
        </text>
      ))}

      {plates.map((plate) => {
        const rect = shellPlateRect(plate);
        return (
          <rect
            className="android-shell-segment"
            height={rect.height}
            key={plate.id}
            rx="6"
            width={rect.width}
            x={rect.x}
            y={rect.y}
          />
        );
      })}

      {Array.from({ length: courseCount }).flatMap((_, rowIndex) => {
        const course = courseCount - rowIndex;
        const y = SHELL_GRID.y + rowIndex * rowHeight;

        return Array.from({ length: laneCount }).map((__, laneIndex) => {
          const regionId = `L${laneIndex + 1}-C${course}`;
          const isActive = activePlateId === regionId;

          return (
            <g key={regionId}>
              <rect
                className={isActive ? "android-shell-region android-shell-region-active" : "android-shell-region"}
                height={rowHeight - 2}
                onClick={() => {
                  onPlateSelect(regionId);
                  onMarkerSelect(null);
                }}
                width={laneWidth}
                x={SHELL_GRID.x + laneIndex * laneWidth}
                y={y}
              />
              <text
                className={isActive ? "android-shell-region-label android-shell-region-label-active" : "android-shell-region-label"}
                x={SHELL_GRID.x + laneIndex * laneWidth + laneWidth / 2}
                y={y + rowHeight / 2 + 4}
              >
                {shellRegionDisplayLabel(laneIndex, laneCount, course)}
              </text>
            </g>
          );
        });
      })}

      <MapMarkers
        activeMarkerId={activeMarkerId}
        layoutMap={layoutMap}
        mapBox={SHELL_GRID}
        onMarkerSelect={onMarkerSelect}
        onPlateSelect={onPlateSelect}
      />
    </g>
  );
}

function MapMarkers({
  activeMarkerId,
  layoutMap,
  mapBox,
  onMarkerSelect,
  onPlateSelect,
}: {
  activeMarkerId: string | null;
  layoutMap: LayoutMapData;
  mapBox: { x: number; y: number; width: number; height: number };
  onMarkerSelect: (markerId: string | null) => void;
  onPlateSelect: (plateId: string | null) => void;
}) {
  return (
    <g>
      {layoutMap.markers.map((marker) => {
        const point = markerPoint(marker, mapBox);
        const isActive = marker.id === activeMarkerId;

        return (
          <g
            className={marker.type === "element" ? "android-marker android-marker-element" : "android-marker"}
            key={marker.id}
            onClick={() => {
              onMarkerSelect(marker.id);
              onPlateSelect(null);
            }}
          >
            <circle
              className={isActive ? "android-marker-circle android-marker-circle-active" : "android-marker-circle"}
              cx={point.x}
              cy={point.y}
              r={isActive ? 12 : 9}
            />
            <text className="android-marker-label" x={point.x + 12} y={point.y - 10}>
              {compactMarkerLabel(marker.label)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function DrawingBlock({ layoutMap }: { layoutMap: LayoutMapData }) {
  return (
    <g className="android-drawing-block">
      <rect height={DRAWING_BLOCK.height} rx="8" width={DRAWING_BLOCK.width} x={DRAWING_BLOCK.x} y={DRAWING_BLOCK.y} />
      <text x={DRAWING_BLOCK.x + 14} y={DRAWING_BLOCK.y + 24}>
        CLIENT: {layoutMap.drawingBlock.client}
      </text>
      <text x={DRAWING_BLOCK.x + 14} y={DRAWING_BLOCK.y + 44}>
        PROJECT: {layoutMap.drawingBlock.project}
      </text>
      <text x={DRAWING_BLOCK.x + 14} y={DRAWING_BLOCK.y + 64}>
        DRAWING: {layoutMap.drawingBlock.drawing}
      </text>
      <text x={DRAWING_BLOCK.x + 14} y={DRAWING_BLOCK.y + 84}>
        REF: {layoutMap.drawingBlock.reference}
      </text>
    </g>
  );
}

function circularPlateRect(plate: LayoutPlate) {
  return {
    x: CIRCULAR_MAP.x + plate.x * CIRCULAR_MAP.size,
    y: CIRCULAR_MAP.y + plate.y * CIRCULAR_MAP.size,
    width: plate.width * CIRCULAR_MAP.size,
    height: plate.height * CIRCULAR_MAP.size,
  };
}

function shellPlateRect(plate: LayoutPlate) {
  return {
    x: SHELL_GRID.x + plate.x * SHELL_GRID.width,
    y: SHELL_GRID.y + plate.y * SHELL_GRID.height,
    width: plate.width * SHELL_GRID.width,
    height: plate.height * SHELL_GRID.height,
  };
}

function markerPoint(marker: LayoutMarker, mapBox: { x: number; y: number; width: number; height: number }) {
  return {
    x: mapBox.x + marker.x * mapBox.width,
    y: mapBox.y + marker.y * mapBox.height,
  };
}

function shellLaneDisplayLabel(laneIndex: number, laneCount: number): string {
  if (laneCount === 4) return ["N", "E", "S", "W"][Math.min(Math.max(laneIndex, 0), 3)] ?? `L${laneIndex + 1}`;
  if (laneIndex === 0) return "L1 (N)";
  return `L${laneIndex + 1}`;
}

function shellRegionDisplayLabel(laneIndex: number, laneCount: number, course: number): string {
  if (laneCount === 4) return `${shellLaneDisplayLabel(laneIndex, laneCount)}-C${course}`;
  return `L${laneIndex + 1}-C${course}`;
}

function compactMarkerLabel(label: string): string {
  return label
    .replace(/^Roof Plate\s+/i, "P")
    .replace(/^Strake\s+/i, "S")
    .replace(/\s*\/\s*/g, "/");
}
