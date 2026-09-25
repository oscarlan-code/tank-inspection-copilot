import { useMemo, useState, type ReactNode } from "react";
import type {
  AndroidLayoutMapConfig,
  FloorCorrosionOverlay,
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
  floorReviewControls?: ReactNode;
  showFloorSourcePreview?: boolean;
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
  floorReviewControls,
  showFloorSourcePreview = true,
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
  const sourceDrawing = appMap?.surfaceType === "floor" ? safeLayoutMap.sourceDrawing : undefined;
  const svgWidth = sourceDrawing?.width ?? SVG_WIDTH;
  const svgHeight = sourceDrawing?.height ?? SVG_HEIGHT;
  const activeCorrosionOverlay = safeLayoutMap.floorCorrosion?.overlays.find(
    (overlay) => overlay.hostPlateId === activePlateId,
  );
  const showsFloorReviewRail = variant === "workspace"
    && appMap?.surfaceType === "floor"
    && Boolean(safeLayoutMap.floorCorrosion)
    && Boolean(floorReviewControls);
  const svgViewBox = showsFloorReviewRail && !sourceDrawing
    ? `0 0 748 ${SVG_HEIGHT}`
    : `0 0 ${svgWidth} ${svgHeight}`;
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

        <div className={showsFloorReviewRail ? "mfl-map-review-grid" : undefined}>
          <div className="android-map-shell">
            <svg
              aria-label={safeLayoutMap.title}
              className={`android-layout-svg ${sourceDrawing ? "android-layout-svg-source" : ""}`}
              role="img"
              viewBox={svgViewBox}
            >
            {!sourceDrawing ? (
              <defs>
                <clipPath id={`circle-clip-${safeLayoutMap.id}`}>
                  <circle
                    cx={CIRCULAR_MAP.x + CIRCULAR_MAP.size / 2}
                    cy={CIRCULAR_MAP.y + CIRCULAR_MAP.size / 2}
                    r={CIRCULAR_MAP.size * 0.42}
                  />
                </clipPath>
              </defs>
            ) : null}

            {!sourceDrawing ? (
              <rect className="android-map-page" height={SVG_HEIGHT - 18} rx="22" width={SVG_WIDTH - 18} x="9" y="9" />
            ) : null}

            {appMap?.surfaceType === "shell" ? (
              <ShellMapPreview
                activeMarkerId={activeMarkerId}
                activePlateId={activePlateId}
                appMap={appMap}
                layoutMap={safeLayoutMap}
                onMarkerSelect={onMarkerSelect}
                onPlateSelect={onPlateSelect}
              />
            ) : sourceDrawing ? (
              <SourceFloorMapPreview
                activePlateId={activePlateId}
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
                showFloorSourcePreview={showFloorSourcePreview && !showsFloorReviewRail}
              />
            )}

            {!sourceDrawing ? <DrawingBlock layoutMap={safeLayoutMap} /> : null}
            </svg>
          </div>

          {showsFloorReviewRail ? (
            <aside className="mfl-review-rail" aria-label="MFL plate review">
              <FloorSourcePlateReviewCard
                activePlateId={activePlateId}
                overlay={activeCorrosionOverlay}
              />
              {floorReviewControls}
            </aside>
          ) : null}
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

function SourceFloorMapPreview({
  activePlateId,
  layoutMap,
  onMarkerSelect,
  onPlateSelect,
}: {
  activePlateId: string | null;
  layoutMap: LayoutMapData;
  onMarkerSelect: (markerId: string | null) => void;
  onPlateSelect: (plateId: string | null) => void;
}) {
  const sourceDrawing = layoutMap.sourceDrawing;
  if (!sourceDrawing) return null;
  const sourceHref = safeCorrosionImageHref(sourceDrawing.inlineImageDataUrl ?? sourceDrawing.artifactUri);
  const foregroundHref = safeCorrosionImageHref(
    sourceDrawing.foregroundInlineImageDataUrl ?? sourceDrawing.foregroundArtifactUri,
  );
  const usesExtractedVector = sourceDrawing.renderMode === "extracted_vector";
  const platesById = new Map(layoutMap.plates.map((plate) => [plate.id, plate]));

  return (
    <g className="source-floor-map">
      <defs>
        {layoutMap.plates.map((plate) => (
          <clipPath id={sourceFloorPlateClipId(layoutMap.id, plate.id)} key={`source-clip-${plate.id}`}>
            <SourceFloorPlateShape height={sourceDrawing.height} plate={plate} width={sourceDrawing.width} />
          </clipPath>
        ))}
      </defs>
      <rect fill="#ffffff" height={sourceDrawing.height} width={sourceDrawing.width} x="0" y="0" />
      {!usesExtractedVector && sourceHref ? (
        <image
          height={sourceDrawing.height}
          href={sourceHref}
          preserveAspectRatio="none"
          width={sourceDrawing.width}
          x="0"
          y="0"
        />
      ) : null}
      {layoutMap.floorCorrosion?.overlays.map((overlay) => {
        const plate = platesById.get(overlay.hostPlateId);
        return plate ? (
          <SourceFloorCorrosionImage
            clipPathId={sourceFloorPlateClipId(layoutMap.id, plate.id)}
            height={sourceDrawing.height}
            key={overlay.id}
            overlay={overlay}
            plate={plate}
            width={sourceDrawing.width}
          />
        ) : null;
      })}
      {usesExtractedVector && sourceHref ? (
        <image
          className="source-floor-map-vector"
          height={sourceDrawing.height}
          href={sourceHref}
          pointerEvents="none"
          preserveAspectRatio="none"
          width={sourceDrawing.width}
          x="0"
          y="0"
        />
      ) : null}
      {foregroundHref ? (
        <image
          className="source-floor-map-foreground"
          height={sourceDrawing.height}
          href={foregroundHref}
          pointerEvents="none"
          preserveAspectRatio="none"
          width={sourceDrawing.width}
          x="0"
          y="0"
        />
      ) : null}
      {layoutMap.plates.map((plate) => (
        <SourceFloorPlateShape
          className={plate.id === activePlateId ? "source-floor-hit source-floor-hit-active" : "source-floor-hit"}
          height={sourceDrawing.height}
          key={`source-hit-${plate.id}`}
          onClick={() => {
            onPlateSelect(plate.id);
            onMarkerSelect(null);
          }}
          plate={plate}
          width={sourceDrawing.width}
        />
      ))}
    </g>
  );
}

function SourceFloorPlateShape({
  className,
  height,
  onClick,
  plate,
  width,
}: {
  className?: string;
  height: number;
  onClick?: () => void;
  plate: LayoutPlate;
  width: number;
}) {
  if (plate.points && plate.points.length >= 3) {
    return (
      <polygon
        className={className}
        onClick={onClick}
        points={plate.points.map((point) => `${point.x * width},${point.y * height}`).join(" ")}
      />
    );
  }
  return (
    <rect
      className={className}
      height={plate.height * height}
      onClick={onClick}
      width={plate.width * width}
      x={plate.x * width}
      y={plate.y * height}
    />
  );
}

function SourceFloorCorrosionImage({
  clipPathId,
  height,
  overlay,
  plate,
  width,
}: {
  clipPathId: string;
  height: number;
  overlay: FloorCorrosionOverlay;
  plate: LayoutPlate;
  width: number;
}) {
  const href = safeCorrosionImageHref(overlay.inlineImageDataUrl ?? overlay.artifactUri);
  if (!href || overlay.status === "blocked") return null;
  const rect = sourceFloorPlateRect(plate, width, height);
  const placement = resolveFloorCorrosionPlacement(rect, overlay);

  return (
    <g clipPath={`url(#${clipPathId})`}>
      <FloorCorrosionPlacementImage
        href={href}
        overlay={overlay}
        placement={placement}
      />
    </g>
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
  showFloorSourcePreview,
}: {
  activeMarkerId: string | null;
  activePlateId: string | null;
  clipPathId: string;
  layoutMap: LayoutMapData;
  onMarkerSelect: (markerId: string | null) => void;
  onPlateSelect: (plateId: string | null) => void;
  showFloorSourcePreview: boolean;
}) {
  const center = CIRCULAR_MAP.x + CIRCULAR_MAP.size / 2;
  const radius = CIRCULAR_MAP.size * 0.42;
  const annularWidthRatio = layoutMap.appMap?.floor?.annularWidthRatio ?? 0.12;
  const annularRadius = radius * (1 + Math.min(Math.max(annularWidthRatio, 0.06), 0.18));
  const annularPlates = layoutMap.plates.filter(isAnnularPlate);
  const mainPlates = layoutMap.plates.filter((plate) => !isAnnularPlate(plate));
  const platesById = new Map(layoutMap.plates.map((plate) => [plate.id, plate]));
  const activeCorrosionOverlay = layoutMap.floorCorrosion?.overlays.find(
    (overlay) => overlay.hostPlateId === activePlateId,
  );
  const appFigureHref = layoutMap.appMap?.surfaceType === "floor"
    ? appOwnedSvgDataUri(layoutMap.appFigure?.svg)
    : null;

  if (appFigureHref) {
    return (
      <ImportedAppFloorFigure
        activeMarkerId={activeMarkerId}
        activePlateId={activePlateId}
        figureHref={appFigureHref}
        layoutMap={layoutMap}
        onMarkerSelect={onMarkerSelect}
        onPlateSelect={onPlateSelect}
        showFloorSourcePreview={showFloorSourcePreview}
      />
    );
  }

  return (
    <g>
      <defs>
        {layoutMap.plates.map((plate) => (
          <clipPath id={floorPlateClipId(layoutMap.id, plate.id)} key={`clip-${plate.id}`}>
            <CircularPlateShape plate={plate} />
          </clipPath>
        ))}
      </defs>
      <text className="android-map-title" x={CIRCULAR_MAP.x} y={38}>
        {layoutMap.floorCorrosion
          ? "Floor Plate Corrosion Map"
          : layoutMap.appMap?.surfaceType === "floor"
            ? "Floor Layout Map"
            : "Roof Layout Map"}
      </text>
      <text className="android-map-subtitle" x={CIRCULAR_MAP.x} y={58}>
        Reference: 0 degree = {layoutMap.appMap?.referenceMode ?? layoutMap.drawingBlock.referenceMode}
      </text>
      {annularPlates.map((plate) => (
        <CircularPlateShape
          className={plate.id === activePlateId ? "android-plate android-plate-active" : "android-plate"}
          key={plate.id}
          onClick={() => {
            onPlateSelect(plate.id);
            onMarkerSelect(null);
          }}
          plate={plate}
        />
      ))}
      <circle className="android-circular-fill" cx={center} cy={center} r={radius} />
      <line className="android-reference-line" x1={center} x2={center} y1={center} y2={center - annularRadius} />
      <text className="android-zero-label" x={center - 8} y={center - annularRadius - 10}>
        0°
      </text>

      <g clipPath={`url(#${clipPathId})`}>
        {mainPlates.map((plate) => {
          const isActive = plate.id === activePlateId;

          return (
            <CircularPlateShape
              className={isActive ? "android-plate android-plate-active" : "android-plate"}
              key={plate.id}
              onClick={() => {
                onPlateSelect(plate.id);
                onMarkerSelect(null);
              }}
              plate={plate}
            />
          );
        })}

        {layoutMap.appMap?.surfaceType === "floor"
          ? layoutMap.floorCorrosion?.overlays.map((overlay) => {
              const plate = platesById.get(overlay.hostPlateId);
              return plate && !isAnnularPlate(plate) ? (
                <FloorCorrosionImage
                  clipPathId={floorPlateClipId(layoutMap.id, plate.id)}
                  key={overlay.id}
                  overlay={overlay}
                  plate={plate}
                />
              ) : null;
            })
          : null}
      </g>

      {layoutMap.appMap?.surfaceType === "floor"
        ? layoutMap.floorCorrosion?.overlays.map((overlay) => {
            const plate = platesById.get(overlay.hostPlateId);
            return plate && isAnnularPlate(plate) ? (
              <FloorCorrosionImage
                clipPathId={floorPlateClipId(layoutMap.id, plate.id)}
                key={overlay.id}
                overlay={overlay}
                plate={plate}
              />
            ) : null;
          })
        : null}

      <circle className="android-circular-outline" cx={center} cy={center} r={radius} />
      {annularPlates.length > 0 ? (
        <circle className="android-circular-outline" cx={center} cy={center} r={annularRadius} />
      ) : null}

      {layoutMap.floorCorrosion ? <FloorCorrosionLegend /> : null}
      {layoutMap.floorCorrosion && showFloorSourcePreview ? (
        <FloorSourcePlatePreview
          activePlateId={activePlateId}
          overlay={activeCorrosionOverlay}
        />
      ) : null}

      {layoutMap.plates.map((plate) => {
        const displayLabel = plate.mapLabel ?? plate.label;
        if (displayLabel === "") return null;
        const labelX = CIRCULAR_MAP.x + (plate.labelX ?? plate.x + plate.width / 2) * CIRCULAR_MAP.size;
        const labelY = CIRCULAR_MAP.y + (plate.labelY ?? plate.y + plate.height / 2) * CIRCULAR_MAP.size + 4;
        const selectPlate = () => {
          onPlateSelect(plate.id);
          onMarkerSelect(null);
        };

        return (
          <text
            aria-label={`Select floor plate ${plate.label}`}
            className={plate.id === activePlateId ? "android-plate-label android-plate-label-active" : "android-plate-label"}
            key={`${plate.id}-label`}
            onClick={selectPlate}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                selectPlate();
              }
            }}
            role="button"
            tabIndex={0}
            x={labelX}
            y={labelY}
          >
            {displayLabel}
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

function ImportedAppFloorFigure({
  activeMarkerId,
  activePlateId,
  figureHref,
  layoutMap,
  onMarkerSelect,
  onPlateSelect,
  showFloorSourcePreview,
}: {
  activeMarkerId: string | null;
  activePlateId: string | null;
  figureHref: string;
  layoutMap: LayoutMapData;
  onMarkerSelect: (markerId: string | null) => void;
  onPlateSelect: (plateId: string | null) => void;
  showFloorSourcePreview: boolean;
}) {
  const findingMarkers = layoutMap.markers.filter((marker) => marker.type !== "element");
  const elementMarkers = layoutMap.markers.filter((marker) => marker.type === "element");
  const platesById = new Map(layoutMap.plates.map((plate) => [plate.id, plate]));
  const annularWidthRatio = layoutMap.appMap?.floor?.annularWidthRatio ?? 0.12;
  const outerTankRadius = CIRCULAR_MAP.size * 0.42
    * (1 + Math.min(Math.max(annularWidthRatio, 0.06), 0.18));
  // Main-plate hit areas render last so annular polygons cannot steal clicks at shared seams.
  const selectablePlates = [
    ...layoutMap.plates.filter(isAnnularPlate),
    ...layoutMap.plates.filter((plate) => !isAnnularPlate(plate)),
  ];
  const activeCorrosionOverlay = layoutMap.floorCorrosion?.overlays.find(
    (overlay) => overlay.hostPlateId === activePlateId,
  );

  return (
    <g className="app-owned-floor-figure">
      <defs>
        <clipPath id={floorTankClipId(layoutMap.id)}>
          <circle
            cx={CIRCULAR_MAP.x + CIRCULAR_MAP.size / 2}
            cy={CIRCULAR_MAP.y + CIRCULAR_MAP.size / 2}
            r={outerTankRadius}
          />
        </clipPath>
        {layoutMap.plates.map((plate) => (
          <clipPath id={floorPlateClipId(layoutMap.id, plate.id)} key={`app-floor-clip-${plate.id}`}>
            <CircularPlateShape plate={plate} />
          </clipPath>
        ))}
      </defs>
      <text className="android-map-title" x={CIRCULAR_MAP.x} y={38}>Floor Layout Map</text>
      <text className="android-map-subtitle" x={CIRCULAR_MAP.x} y={58}>
        Reference: 0 degree = {layoutMap.appMap?.referenceMode ?? layoutMap.drawingBlock.referenceMode}
      </text>
      <image
        height={CIRCULAR_MAP.size}
        href={figureHref}
        pointerEvents="none"
        preserveAspectRatio="xMidYMid meet"
        width={CIRCULAR_MAP.size}
        x={CIRCULAR_MAP.x}
        y={CIRCULAR_MAP.y}
      />
      <g clipPath={`url(#${floorTankClipId(layoutMap.id)})`}>
        {layoutMap.floorCorrosion?.overlays.map((overlay) => {
          const plate = platesById.get(overlay.hostPlateId);
          return plate ? (
            <FloorCorrosionImage
              clipPathId={floorPlateClipId(layoutMap.id, plate.id)}
              key={overlay.id}
              overlay={overlay}
              plate={plate}
            />
          ) : null;
        })}
      </g>
      {selectablePlates.map((plate) => (
        <CircularPlateShape
          ariaLabel={`Select floor plate ${plate.label}`}
          className={plate.id === activePlateId ? "app-floor-hit app-floor-hit-active" : "app-floor-hit"}
          key={`app-floor-hit-${plate.id}`}
          onClick={() => {
            onPlateSelect(plate.id);
            onMarkerSelect(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onPlateSelect(plate.id);
              onMarkerSelect(null);
            }
          }}
          plate={plate}
          role="button"
          tabIndex={0}
        />
      ))}
      {elementMarkers.map((marker) => {
        const point = markerPoint(marker, {
          x: CIRCULAR_MAP.x,
          y: CIRCULAR_MAP.y,
          width: CIRCULAR_MAP.size,
          height: CIRCULAR_MAP.size,
        });
        return (
          <circle
            aria-label={`Select ${marker.label}`}
            className={marker.id === activeMarkerId ? "app-element-hit app-element-hit-active" : "app-element-hit"}
            cx={point.x}
            cy={point.y}
            key={`app-element-hit-${marker.id}`}
            onClick={() => {
              onMarkerSelect(marker.id);
              onPlateSelect(null);
            }}
            r="15"
            role="button"
            tabIndex={0}
          />
        );
      })}
      {findingMarkers.length > 0 ? (
        <MapMarkers
          activeMarkerId={activeMarkerId}
          layoutMap={{ ...layoutMap, markers: findingMarkers }}
          mapBox={{ x: CIRCULAR_MAP.x, y: CIRCULAR_MAP.y, width: CIRCULAR_MAP.size, height: CIRCULAR_MAP.size }}
          onMarkerSelect={onMarkerSelect}
          onPlateSelect={onPlateSelect}
        />
      ) : null}
      {layoutMap.floorCorrosion ? <FloorCorrosionLegend /> : null}
      {layoutMap.floorCorrosion && showFloorSourcePreview ? (
        <FloorSourcePlatePreview activePlateId={activePlateId} overlay={activeCorrosionOverlay} />
      ) : null}
    </g>
  );
}

function appOwnedSvgDataUri(svg: string | undefined): string | null {
  if (!svg || !/^<svg\b/i.test(svg)) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function FloorSourcePlatePreview({
  activePlateId,
  overlay,
}: {
  activePlateId: string | null;
  overlay?: FloorCorrosionOverlay;
}) {
  const x = 764;
  const y = 198;
  const width = 328;
  const height = 342;
  const href = safeCorrosionImageHref(
    overlay?.sourcePreviewInlineImageDataUrl ?? overlay?.sourcePreviewArtifactUri,
  );
  const orientation = overlay ? resolveMflOrientationPreview(overlay) : null;

  return (
    <g aria-label={overlay ? `Original MFL scan for plate ${overlay.scanPlateId}` : "Original MFL plate preview"} className="floor-source-preview">
      <rect height={height} rx="12" width={width} x={x} y={y} />
      <text className="floor-source-preview-title" x={x + 18} y={y + 30}>
        {overlay ? `Original MFL Plate ${overlay.scanPlateId}` : "Original MFL Plate"}
      </text>
      {overlay && href ? (
        <>
          <rect className="floor-source-preview-image-bg" height="238" rx="6" width="292" x={x + 18} y={y + 48} />
          <svg
            aria-label={`Orientation preview at ${orientation?.label}`}
            className="floor-source-preview-oriented-image"
            height="226"
            preserveAspectRatio="xMidYMid meet"
            viewBox={`0 0 ${orientation?.viewWidth} ${orientation?.viewHeight}`}
            width="280"
            x={x + 24}
            y={y + 54}
          >
            <g transform={orientation?.transform}>
              <image
                height={orientation?.sourceHeight}
                href={href}
                width={orientation?.sourceWidth}
                x={-(orientation?.sourceWidth ?? 0) / 2}
                y={-(orientation?.sourceHeight ?? 0) / 2}
              />
            </g>
          </svg>
          <text className="floor-source-preview-meta" x={x + 18} y={y + 308}>
            {`Source page ${overlay.sourcePage} · ${formatDimension(overlay.sourceWidthMm)} × ${formatDimension(overlay.sourceHeightMm)} mm`}
          </text>
          <text className="floor-source-preview-note" x={x + 18} y={y + 329}>
            {`Direction ${orientation?.label} · size/offset shown on map only`}
          </text>
        </>
      ) : (
        <>
          <text className="floor-source-preview-empty" x={x + width / 2} y={y + 150}>
            {activePlateId ? `No matched MFL scan for ${activePlateId}` : "Select a floor plate"}
          </text>
          <text className="floor-source-preview-empty floor-source-preview-empty-subtitle" x={x + width / 2} y={y + 178}>
            to compare its original source image
          </text>
        </>
      )}
    </g>
  );
}

export function FloorSourcePlateReviewCard({
  activePlateId,
  overlay,
}: {
  activePlateId: string | null;
  overlay?: FloorCorrosionOverlay;
}) {
  const href = safeCorrosionImageHref(
    overlay?.sourcePreviewInlineImageDataUrl ?? overlay?.sourcePreviewArtifactUri,
  );
  const orientation = overlay ? resolveMflOrientationPreview(overlay) : null;

  return (
    <section
      aria-label={overlay ? `Original MFL scan for plate ${overlay.scanPlateId}` : "Original MFL plate preview"}
      className="mfl-source-review-card"
    >
      <header>
        <div>
          <span>Original MFL plate</span>
          <strong>{overlay?.scanPlateId ?? activePlateId ?? "Select a plate"}</strong>
        </div>
        {overlay ? <small>Source page {overlay.sourcePage}</small> : null}
      </header>
      {overlay && href ? (
        <>
          <div className="mfl-source-review-image">
            <svg
              aria-label={`Original MFL scan for plate ${overlay.scanPlateId}, oriented ${orientation?.label}`}
              data-rotation-degrees={overlay.rotationDegrees}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              viewBox={`0 0 ${orientation?.viewWidth} ${orientation?.viewHeight}`}
            >
              <g transform={orientation?.transform}>
                <image
                  height={orientation?.sourceHeight}
                  href={href}
                  width={orientation?.sourceWidth}
                  x={-(orientation?.sourceWidth ?? 0) / 2}
                  y={-(orientation?.sourceHeight ?? 0) / 2}
                />
              </g>
            </svg>
          </div>
          <footer>
            <span>{formatDimension(overlay.sourceWidthMm)} × {formatDimension(overlay.sourceHeightMm)} mm · {orientation?.label}</span>
            <span>Direction only · size/offset excluded</span>
          </footer>
        </>
      ) : (
        <div className="mfl-source-review-empty">
          {activePlateId ? `No matched MFL scan for ${activePlateId}` : "Select a floor plate to compare its original scan."}
        </div>
      )}
    </section>
  );
}

function resolveMflOrientationPreview(overlay: FloorCorrosionOverlay) {
  const sourceWidth = Math.max(1, overlay.sourceWidthMm);
  const sourceHeight = Math.max(1, overlay.sourceHeightMm);
  const rotation = overlay.rotationDegrees;
  const swapsAxes = rotation === 90 || rotation === 270;
  const viewWidth = swapsAxes ? sourceHeight : sourceWidth;
  const viewHeight = swapsAxes ? sourceWidth : sourceHeight;
  const transform = [
    `translate(${viewWidth / 2} ${viewHeight / 2})`,
    `rotate(${rotation})`,
  ].join(" ");

  return {
    label: `${rotation}°`,
    sourceHeight,
    sourceWidth,
    transform,
    viewHeight,
    viewWidth,
  };
}

function formatDimension(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(1)).toLocaleString("en-US") : "—";
}

function FloorCorrosionLegend() {
  const bands = [
    { label: "20", color: "#ffffff" },
    { label: "30", color: "#12fbff" },
    { label: "40", color: "#0ec800" },
    { label: "50", color: "#001dc8" },
    { label: "60", color: "#ef0700" },
    { label: "70", color: "#dc006e" },
    { label: "80", color: "#470073" },
  ];
  const x = 804;
  const y = 86;
  const swatchWidth = 34;

  return (
    <g className="floor-corrosion-legend">
      <rect height="92" rx="8" width="276" x={x} y={y} />
      <text x={x + 14} y={y + 23}>CORROSION PERCENTAGE</text>
      {bands.map((band, index) => (
        <g key={band.label}>
          <text x={x + 18 + index * swatchWidth} y={y + 45}>{band.label}</text>
          <rect
            fill={band.color}
            height="22"
            stroke="#1c2f45"
            strokeWidth="1"
            width={swatchWidth}
            x={x + 14 + index * swatchWidth}
            y={y + 54}
          />
        </g>
      ))}
    </g>
  );
}

function CircularPlateShape({
  ariaLabel,
  className,
  onClick,
  onKeyDown,
  plate,
  role,
  tabIndex,
}: {
  ariaLabel?: string;
  className?: string;
  onClick?: () => void;
  onKeyDown?: React.KeyboardEventHandler<SVGPolygonElement | SVGRectElement>;
  plate: LayoutPlate;
  role?: string;
  tabIndex?: number;
}) {
  if (plate.points && plate.points.length >= 3) {
    return (
      <polygon
        aria-label={ariaLabel}
        className={className}
        onClick={onClick}
        onKeyDown={onKeyDown}
        points={plate.points
          .map((point) => `${CIRCULAR_MAP.x + point.x * CIRCULAR_MAP.size},${CIRCULAR_MAP.y + point.y * CIRCULAR_MAP.size}`)
          .join(" ")}
        role={role}
        tabIndex={tabIndex}
      />
    );
  }

  const rect = circularPlateRect(plate);
  return (
    <rect
      aria-label={ariaLabel}
      className={className}
      height={rect.height}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={role}
      rx="4"
      tabIndex={tabIndex}
      width={rect.width}
      x={rect.x}
      y={rect.y}
    />
  );
}

function isAnnularPlate(plate: LayoutPlate): boolean {
  return plate.plateKind === "annular" || /^AR\d+$/i.test(plate.id);
}

function FloorCorrosionImage({
  clipPathId,
  overlay,
  plate,
}: {
  clipPathId: string;
  overlay: FloorCorrosionOverlay;
  plate: LayoutPlate;
}) {
  const href = safeCorrosionImageHref(overlay.inlineImageDataUrl ?? overlay.artifactUri);
  if (!href || overlay.status === "blocked") return null;

  const rect = circularPlateRect(plate);
  const placement = resolveFloorCorrosionPlacement(rect, overlay);

  return (
    <g clipPath={`url(#${clipPathId})`}>
      <FloorCorrosionPlacementImage
        href={href}
        overlay={overlay}
        placement={placement}
      />
    </g>
  );
}

function FloorCorrosionPlacementImage({
  href,
  overlay,
  placement,
}: {
  href: string;
  overlay: FloorCorrosionOverlay;
  placement: ReturnType<typeof resolveFloorCorrosionPlacement>;
}) {
  return (
    <svg
      className="floor-corrosion-overlay"
      data-host-plate-id={overlay.hostPlateId}
      data-placement-anchor="top-left"
      data-scale-x={placement.scaleX}
      data-scale-y={placement.scaleY}
      height={placement.height}
      opacity={overlay.opacity}
      preserveAspectRatio="none"
      viewBox={`0 0 ${placement.viewWidth} ${placement.viewHeight}`}
      width={placement.width}
      x={placement.x}
      y={placement.y}
    >
      <g transform={placement.orientationTransform}>
        <image
          height={placement.sourceHeight}
          href={href}
          preserveAspectRatio="none"
          width={placement.sourceWidth}
          x={-placement.sourceWidth / 2}
          y={-placement.sourceHeight / 2}
        />
      </g>
    </svg>
  );
}

function resolveFloorCorrosionPlacement(
  rect: { x: number; y: number; width: number; height: number },
  overlay: FloorCorrosionOverlay,
) {
  const rotation = overlay.rotationDegrees;
  const swapsAxes = rotation === 90 || rotation === 270;
  const scaleX = clamp(overlay.scaleX ?? 1, 0.5, 2.5);
  const scaleY = clamp(overlay.scaleY ?? 1, 0.5, 2.5);
  const offsetX = clamp(overlay.offsetX ?? 0, -0.75, 0.75);
  const offsetY = clamp(overlay.offsetY ?? 0, -0.75, 0.75);
  const sourceWidth = Math.max(1, overlay.sourceWidthMm);
  const sourceHeight = Math.max(1, overlay.sourceHeightMm);
  const viewWidth = swapsAxes ? sourceHeight : sourceWidth;
  const viewHeight = swapsAxes ? sourceWidth : sourceHeight;
  const x = rect.x + rect.width * offsetX;
  const y = rect.y + rect.height * offsetY;
  const width = rect.width * scaleX;
  const height = rect.height * scaleY;
  const orientationTransform = [
    `translate(${viewWidth / 2} ${viewHeight / 2})`,
    `rotate(${rotation})`,
  ].join(" ");

  return {
    height,
    orientationTransform,
    scaleX,
    scaleY,
    sourceHeight,
    sourceWidth,
    viewHeight,
    viewWidth,
    width,
    x,
    y,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
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

function sourceFloorPlateRect(plate: LayoutPlate, width: number, height: number) {
  return {
    x: plate.x * width,
    y: plate.y * height,
    width: plate.width * width,
    height: plate.height * height,
  };
}

function floorPlateClipId(layoutMapId: string, plateId: string) {
  return `floor-plate-clip-${`${layoutMapId}-${plateId}`.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function floorTankClipId(layoutMapId: string) {
  return `floor-tank-clip-${layoutMapId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function sourceFloorPlateClipId(layoutMapId: string, plateId: string) {
  return `source-floor-plate-clip-${`${layoutMapId}-${plateId}`.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function safeCorrosionImageHref(value?: string) {
  if (!value) return null;
  if (/^data:image\/png;base64,[a-z0-9+/=]+$/i.test(value)) return value;
  if (/^data:image\/svg\+xml;base64,[a-z0-9+/=]+$/i.test(value)) return value;
  if (/^\/api\/v1\/report-jobs\//.test(value)) return value;
  return null;
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
