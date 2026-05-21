import { useMemo, useState } from "react";
import type { LayoutMarker, LayoutSceneKind } from "./workspace";

type LayoutCanvasProps = {
  scene: LayoutSceneKind;
  markers: LayoutMarker[];
};

const severityColor: Record<NonNullable<LayoutMarker["severity"]>, string> = {
  low: "#f6b73c",
  medium: "#ff7b39",
  high: "#e84949",
};

const markerStroke = {
  finding: "#ffffff",
  nozzle: "#173047",
  measurement: "#173047",
};

export default function LayoutCanvas({ scene, markers }: LayoutCanvasProps) {
  const [selectedMarkerId, setSelectedMarkerId] = useState(markers[0]?.id ?? "");
  const [zoom, setZoom] = useState(1);
  const [showLabels, setShowLabels] = useState(true);
  const [showNozzles, setShowNozzles] = useState(true);
  const [showFindings, setShowFindings] = useState(true);
  const [focusMode, setFocusMode] = useState(false);

  const selectedMarker = useMemo(
    () => markers.find((marker) => marker.id === selectedMarkerId) ?? markers[0],
    [markers, selectedMarkerId],
  );

  const visibleMarkers = markers.filter((marker) => {
    if (!showNozzles && marker.kind === "nozzle") return false;
    if (!showFindings && marker.kind === "finding") return false;
    if (!focusMode) return true;
    return marker.id === selectedMarker?.id;
  });

  return (
    <div className="rp-layout-shell">
      <div className="rp-layout-toolbar">
        <div className="rp-toolbar-group">
          <button className="rp-ghost-button" onClick={() => setZoom((value) => Math.max(0.7, value - 0.15))}>
            -
          </button>
          <span className="rp-toolbar-value">{Math.round(zoom * 100)}%</span>
          <button className="rp-ghost-button" onClick={() => setZoom((value) => Math.min(1.8, value + 0.15))}>
            +
          </button>
          <button className="rp-ghost-button" onClick={() => setZoom(1)}>
            Fit view
          </button>
        </div>
        <div className="rp-toolbar-group">
          <label className="rp-toggle">
            <input type="checkbox" checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} />
            Labels
          </label>
          <label className="rp-toggle">
            <input type="checkbox" checked={showNozzles} onChange={(event) => setShowNozzles(event.target.checked)} />
            Nozzles
          </label>
          <label className="rp-toggle">
            <input type="checkbox" checked={showFindings} onChange={(event) => setShowFindings(event.target.checked)} />
            Findings
          </label>
          <label className="rp-toggle">
            <input type="checkbox" checked={focusMode} onChange={(event) => setFocusMode(event.target.checked)} />
            Focus selected
          </label>
        </div>
      </div>

      <div className="rp-layout-body">
        <div className="rp-layout-stage">
          <svg viewBox="0 0 100 80" className="rp-layout-svg" role="img" aria-label={`${scene} layout`}>
            <g transform={`scale(${zoom}) translate(${(1 - zoom) * 10} ${(1 - zoom) * 6})`}>
              {scene === "shell" ? <ShellBackdrop /> : <RoofBackdrop />}
              {visibleMarkers.map((marker) => {
                const stroke =
                  marker.kind === "finding" && marker.severity ? severityColor[marker.severity] : markerStroke[marker.kind];
                const isSelected = marker.id === selectedMarker?.id;
                return (
                  <g key={marker.id} onClick={() => setSelectedMarkerId(marker.id)} className="rp-layout-marker">
                    <circle
                      cx={marker.x}
                      cy={marker.y}
                      r={marker.kind === "finding" ? 3.1 : 2.4}
                      fill={marker.kind === "finding" ? stroke : "#ffffff"}
                      stroke={isSelected ? "#0e5ff7" : stroke}
                      strokeWidth={isSelected ? 1.8 : 1.2}
                    />
                    {showLabels ? (
                      <text x={marker.x + 2.8} y={marker.y - 1.2} className="rp-layout-label">
                        {marker.label}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <div className="rp-layout-inspector">
          <div className="rp-inline-eyebrow">{scene === "shell" ? "Shell Scene" : "Roof Scene"}</div>
          <h4>{selectedMarker?.label ?? "Marker"}</h4>
          <p>{selectedMarker?.description ?? "Select a marker to inspect its linked context."}</p>
          <dl className="rp-detail-list">
            <div>
              <dt>Kind</dt>
              <dd>{selectedMarker?.kind ?? "n/a"}</dd>
            </div>
            <div>
              <dt>Severity</dt>
              <dd>{selectedMarker?.severity ?? "Informational"}</dd>
            </div>
            <div>
              <dt>Action</dt>
              <dd>Linked to selected section preview and evidence rail.</dd>
            </div>
          </dl>
          <button className="rp-primary-button rp-button-inline">Export snapshot view</button>
        </div>
      </div>
    </div>
  );
}

function ShellBackdrop() {
  const columns = new Array(4).fill(null);
  const rows = new Array(4).fill(null);
  return (
    <g>
      <rect x="8" y="10" width="84" height="58" rx="4" className="rp-layout-surface" />
      {columns.map((_, index) => (
        <line
          key={`col-${index}`}
          x1={8 + ((index + 1) * 84) / 5}
          y1="10"
          x2={8 + ((index + 1) * 84) / 5}
          y2="68"
          className="rp-layout-grid"
        />
      ))}
      {rows.map((_, index) => (
        <line
          key={`row-${index}`}
          x1="8"
          y1={10 + ((index + 1) * 58) / 5}
          x2="92"
          y2={10 + ((index + 1) * 58) / 5}
          className="rp-layout-grid"
        />
      ))}
      <text x="10" y="7" className="rp-layout-title">
        Unwrapped shell lanes and courses
      </text>
    </g>
  );
}

function RoofBackdrop() {
  const sectors = new Array(8).fill(null);
  return (
    <g>
      <circle cx="50" cy="40" r="25" className="rp-layout-surface" />
      <circle cx="50" cy="40" r="17" className="rp-layout-ring" />
      <circle cx="50" cy="40" r="9" className="rp-layout-ring" />
      {sectors.map((_, index) => {
        const angle = (Math.PI * 2 * index) / sectors.length - Math.PI / 2;
        const x = 50 + Math.cos(angle) * 25;
        const y = 40 + Math.sin(angle) * 25;
        return <line key={`sector-${index}`} x1="50" y1="40" x2={x} y2={y} className="rp-layout-grid" />;
      })}
      <text x="22" y="8" className="rp-layout-title">
        Roof plates / sectors / rings
      </text>
    </g>
  );
}
