import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Layer, Rect, Stage, Text } from "react-konva";
import type { LayoutMapData, LayoutMarker, LayoutPlate } from "../domain/types";
import {
  clampMarker,
  clampPlate,
  ensureLayoutMapData,
  MAP_STAGE,
  markerToStagePosition,
  plateToStageRect,
  stageToMarkerPosition,
} from "../lib/layoutMapGeometry";

type Props = {
  activeMarkerId: string | null;
  activePlateId: string | null;
  layoutMap: LayoutMapData;
  onLayoutMapChange: (nextLayoutMap: LayoutMapData, summary: string) => void;
  onMarkerSelect: (markerId: string | null) => void;
  onPlateSelect: (plateId: string | null) => void;
};

export function LayoutMapEditor({
  activeMarkerId,
  activePlateId,
  layoutMap,
  onLayoutMapChange,
  onMarkerSelect,
  onPlateSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(MAP_STAGE.width);
  const safeLayoutMap = useMemo(() => ensureLayoutMapData(layoutMap), [layoutMap]);
  const scale = Math.min(1, containerWidth / MAP_STAGE.width);
  const selectedMarker = safeLayoutMap.markers.find((marker) => marker.id === activeMarkerId) ?? null;
  const selectedPlate = safeLayoutMap.plates.find((plate) => plate.id === activePlateId) ?? null;

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width;
      if (nextWidth) {
        setContainerWidth(nextWidth);
      }
    });

    resizeObserver.observe(element);
    setContainerWidth(element.clientWidth || MAP_STAGE.width);

    return () => resizeObserver.disconnect();
  }, []);

  const applyMarkerUpdate = (markerId: string, nextMarker: LayoutMarker, summary: string) => {
    onLayoutMapChange(
      {
        ...safeLayoutMap,
        markers: safeLayoutMap.markers.map((marker) => (marker.id === markerId ? clampMarker(nextMarker) : marker)),
      },
      summary,
    );
  };

  const applyPlateUpdate = (plateId: string, nextPlate: LayoutPlate, summary: string) => {
    onLayoutMapChange(
      {
        ...safeLayoutMap,
        plates: safeLayoutMap.plates.map((plate) => (plate.id === plateId ? clampPlate(nextPlate) : plate)),
      },
      summary,
    );
  };

  return (
    <div className="map-workspace">
      <div className="shell-sketch-card">
        <div className="shell-sketch-header">
          <div>
            <h4>{safeLayoutMap.title}</h4>
            <p>{safeLayoutMap.subtitle}</p>
          </div>
          <div className="map-tool-chip-group">
            <span className="status-badge status-review-required">Konva map editor</span>
            <span className="status-badge status-generated">Android baseline locked</span>
          </div>
        </div>

        <div className="konva-stage-shell" ref={containerRef}>
          <Stage height={MAP_STAGE.height * scale} scaleX={scale} scaleY={scale} width={MAP_STAGE.width * scale}>
            <Layer>
              <Rect
                cornerRadius={18}
                fill="#ffffff"
                height={MAP_STAGE.shell.height + 34}
                stroke="#0d4f90"
                strokeWidth={2}
                width={MAP_STAGE.shell.width + 34}
                x={MAP_STAGE.shell.x - 17}
                y={MAP_STAGE.shell.y - 18}
              />

              {safeLayoutMap.plates.map((plate) => {
                const rect = plateToStageRect(plate);
                const isSelected = plate.id === activePlateId;

                return (
                  <Rect
                    cornerRadius={4}
                    draggable
                    fill={isSelected ? "#fdecee" : "#ffffff"}
                    height={rect.height}
                    key={plate.id}
                    onClick={() => {
                      onPlateSelect(plate.id);
                      onMarkerSelect(null);
                    }}
                    onDragEnd={(event) => {
                      onPlateSelect(plate.id);
                      onMarkerSelect(null);
                      applyPlateUpdate(
                        plate.id,
                        {
                          ...plate,
                          x: (event.target.x() - MAP_STAGE.shell.x) / MAP_STAGE.shell.width,
                          y: (event.target.y() - MAP_STAGE.shell.y) / MAP_STAGE.shell.height,
                        },
                        `Moved plate ${plate.label}`,
                      );
                    }}
                    stroke={isSelected ? "#ef4c57" : "#5d6d66"}
                    strokeWidth={isSelected ? 2.4 : 1}
                    width={rect.width}
                    x={rect.x}
                    y={rect.y}
                  />
                );
              })}

              {safeLayoutMap.plates.map((plate) => {
                const rect = plateToStageRect(plate);
                return (
                  <Text
                    fill="#54606d"
                    fontFamily="Consolas, monospace"
                    fontSize={10}
                    key={`${plate.id}-label`}
                    text={plate.label}
                    width={rect.width}
                    x={rect.x}
                    y={rect.y + rect.height / 2 - 6}
                    align="center"
                  />
                );
              })}

              {safeLayoutMap.markers.map((marker) => {
                const position = markerToStagePosition(marker);
                const isActive = marker.id === activeMarkerId;
                const isElement = marker.type === "element";

                return (
                  <Group
                    draggable
                    key={marker.id}
                    onClick={() => {
                      onMarkerSelect(marker.id);
                      onPlateSelect(null);
                    }}
                    onDragEnd={(event) => {
                      const nextPosition = stageToMarkerPosition(event.target.x(), event.target.y());
                      onMarkerSelect(marker.id);
                      onPlateSelect(null);
                      applyMarkerUpdate(
                        marker.id,
                        {
                          ...marker,
                          ...nextPosition,
                        },
                        `Moved marker ${marker.label}`,
                      );
                    }}
                    x={position.x}
                    y={position.y}
                  >
                    <Circle
                      fill={isActive ? "rgba(239, 76, 87, 0.2)" : "rgba(234, 242, 251, 0.98)"}
                      radius={isActive ? 15 : 12}
                      stroke={isElement ? "#163250" : isActive ? "#ef4c57" : "#0d4f90"}
                      strokeWidth={2}
                    />
                    <Text
                      align="center"
                      fill="#163250"
                      fontSize={11}
                      fontStyle="bold"
                      offsetX={20}
                      text={marker.label}
                      width={40}
                      y={18}
                    />
                  </Group>
                );
              })}

              <Group>
                <Rect
                  cornerRadius={6}
                  fill="#ffffff"
                  height={MAP_STAGE.drawingBlock.height}
                  stroke="#163250"
                  strokeWidth={1.5}
                  width={MAP_STAGE.drawingBlock.width}
                  x={MAP_STAGE.drawingBlock.x}
                  y={MAP_STAGE.drawingBlock.y}
                />
                <Text fill="#163250" fontSize={12} text={`CLIENT: ${safeLayoutMap.drawingBlock.client}`} x={MAP_STAGE.drawingBlock.x + 14} y={MAP_STAGE.drawingBlock.y + 18} />
                <Text fill="#163250" fontSize={12} text={`PROJECT: ${safeLayoutMap.drawingBlock.project}`} x={MAP_STAGE.drawingBlock.x + 14} y={MAP_STAGE.drawingBlock.y + 38} />
                <Text fill="#163250" fontSize={12} text={`DRAWING: ${safeLayoutMap.drawingBlock.drawing}`} x={MAP_STAGE.drawingBlock.x + 14} y={MAP_STAGE.drawingBlock.y + 58} />
                <Text fill="#163250" fontSize={12} text={`REF: ${safeLayoutMap.drawingBlock.reference}`} x={MAP_STAGE.drawingBlock.x + 14} y={MAP_STAGE.drawingBlock.y + 78} />
              </Group>
            </Layer>
          </Stage>
        </div>
      </div>

      <div className="map-controls">
        <div className="map-metadata">
          <h4>Editor State</h4>
          <ul>
            <li>
              <strong>Surface:</strong> {safeLayoutMap.surfaceLabel}
            </li>
            <li>
              <strong>Markers:</strong> {safeLayoutMap.markers.length}
            </li>
            <li>
              <strong>Plates:</strong> {safeLayoutMap.plates.length}
            </li>
            <li>
              <strong>Overrides:</strong> {safeLayoutMap.overrideCount}
            </li>
          </ul>
        </div>

        {selectedMarker ? (
          <div className="map-inspector">
            <h4>Selected Marker</h4>
            <p>{selectedMarker.label}</p>
            <span>{selectedMarker.source}</span>
            <div className="inspector-actions">
              <button
                onClick={() =>
                  applyMarkerUpdate(
                    selectedMarker.id,
                    { ...selectedMarker, x: selectedMarker.x - 0.02 },
                    `Shifted marker ${selectedMarker.label} left`,
                  )
                }
                type="button"
              >
                Nudge Left
              </button>
              <button
                onClick={() =>
                  applyMarkerUpdate(
                    selectedMarker.id,
                    { ...selectedMarker, x: selectedMarker.x + 0.02 },
                    `Shifted marker ${selectedMarker.label} right`,
                  )
                }
                type="button"
              >
                Nudge Right
              </button>
            </div>
          </div>
        ) : null}

        {selectedPlate ? (
          <div className="map-inspector">
            <h4>Selected Plate</h4>
            <p>{selectedPlate.label}</p>
            <span>{selectedPlate.source}</span>

            <label className="slider-field">
              <span>Width</span>
              <input
                max="35"
                min="4"
                onChange={(event) =>
                  applyPlateUpdate(
                    selectedPlate.id,
                    {
                      ...selectedPlate,
                      width: Number(event.target.value) / 100,
                    },
                    `Resized plate ${selectedPlate.label} width`,
                  )
                }
                type="range"
                value={Math.round(selectedPlate.width * 100)}
              />
            </label>

            <label className="slider-field">
              <span>Height</span>
              <input
                max="32"
                min="5"
                onChange={(event) =>
                  applyPlateUpdate(
                    selectedPlate.id,
                    {
                      ...selectedPlate,
                      height: Number(event.target.value) / 100,
                    },
                    `Resized plate ${selectedPlate.label} height`,
                  )
                }
                type="range"
                value={Math.round(selectedPlate.height * 100)}
              />
            </label>
          </div>
        ) : null}

        <div className="map-legend">
          <h4>Legend</h4>
          <ul>
            {safeLayoutMap.legend.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
