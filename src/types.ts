export type SurfaceType = "bottom" | "roof" | "shell" | "annular" | "nozzle";
export type WeldLocation = "vertical_seam" | "horizontal_seam" | "nozzle_toe" | "annular_seam";
export type LocationMode = "tap_map" | "manual_xy" | "plate_id";

export type GridLocation = {
  surface: SurfaceType;
  x: number;
  y: number;
  gridId: string;
  plateId?: string | null;
  locationMode: LocationMode;
  isAnnular?: boolean;
};

export type DefectMeasurement = {
  method?: string | null;
  utThicknessMm?: number | null;
  avgThicknessMm?: number | null;
  minThicknessMm?: number | null;
  pitDepthMm?: number | null;
  crackLengthMm?: number | null;
  crackWidthMm?: number | null;
  deformationMm?: number | null;
};

export type EvidenceItem = {
  id: string;
  type: "photo" | "video" | "audio";
  uri: string;
  timestamp: string;
  gps?: { lat: number; lng: number } | null;
  linkedX: number;
  linkedY: number;
  linkedSurface: SurfaceType;
};

export type DefectRecord = {
  id: string;
  inspectionId: string;
  tankId: string;
  location: GridLocation;
  defectType: string;
  defectSubtype?: string | null;
  severity: "minor" | "moderate" | "severe";
  extent?: string | null;
  description?: string | null;
  weldLocation?: WeldLocation | null;
  measurements: DefectMeasurement;
  evidence: EvidenceItem[];
  createdBy: string;
  createdAt: string;
};

// ── MFL report for bottom surface ─────────────────────────────────────────────

export type MflSeverity = "clean" | "minor" | "significant" | "critical";

export type MflReport = {
  contractor: string;
  reportRef: string;
  reportDate: string;
  scanCoverage: "full" | "partial";
  scanCoverageNote?: string | null;
  totalAnomalies: number;
  overallSeverity: MflSeverity;
  reportUri?: string | null;
  notes?: string | null;
};

export type SurfaceInspection = {
  surface: SurfaceType;
  gridCols: number;
  gridRows: number;
  completed: boolean;
  defects: DefectRecord[];
  mflReport?: MflReport | null;
};

// ── Tank physical profile (tank-level only) ───────────────────────────────────

export type RoofType =
  | "cone"
  | "dome"
  | "single_deck_floating"
  | "double_deck_floating"
  | "internal_floating";

export type FoundationType = "earth" | "gravel" | "concrete_ring_wall";

export type TankProfile = {
  designCode: "API_650" | "API_653" | "other";
  diameterM: number;
  heightM: number;
  capacityM3?: number | null;
  roofType: RoofType;
  foundationType: FoundationType;
};

// ── Surface-specific geometry configs (defined per-surface before inspection) ─

export type SeamOffsetRule = "half_plate" | "third_plate" | "custom";

export type ShellConfig = {
  numCourses: number;
  plateWidthMm: number;
  plateLengthMm: number;          // derived: floor(totalHeightMm / numCourses)
  seamOriginC1Deg: number;
  seamOffsetRule: SeamOffsetRule;
  customOffsetDeg?: number | null;
};

export type RoofConfig = {
  sectorCount: number;            // radial sector divisions (8, 12, 16…)
  ringCount: number;              // concentric ring zones (4–6 typical)
  apexHeightM?: number | null;    // for cone/dome roof height above shell top
};

export type AnnularConfig = {
  widthMm: number;                // radial width inward from shell, API 650 min 600mm
};

export type NozzleType = "inlet" | "outlet" | "vent" | "drain" | "manway" | "instrument" | "other";

export type NozzleDefinition = {
  id: string;                     // "N1", "N2", "M1"…
  nozzleType: NozzleType;
  azimuthDeg: number;             // circumferential position on shell
  elevationMm: number;            // height from tank datum
  diameterMm: number;             // nominal bore diameter
  description?: string | null;
};

export type NozzleConfig = {
  nozzles: NozzleDefinition[];
};

// ── Tank orientation & reference point ────────────────────────────────────────

export type ReferenceOriginType = "true_north" | "physical_marker";
export type ReferenceMarkerType = "painted_mark" | "nozzle_n1" | "stairway" | "other";

export type TankOrientation = {
  gpsLat?: number | null;
  gpsLng?: number | null;
  referenceOrigin: ReferenceOriginType;
  referenceMarker?: ReferenceMarkerType | null;
  referenceDescription?: string | null;
  referenceMarkerBearingDeg?: number | null;
};

// ── Session ───────────────────────────────────────────────────────────────────

export type InspectionSession = {
  id: string;
  siteId: string;
  clientId?: string | null;
  tankId: string;
  inspectionType: "routine" | "external" | "internal" | "special";
  inspectorId: string;
  startedAt: string;
  tankProfile?: TankProfile | null;
  orientation?: TankOrientation | null;
  shellConfig?: ShellConfig | null;
  roofConfig?: RoofConfig | null;
  annularConfig?: AnnularConfig | null;
  nozzleConfig?: NozzleConfig | null;
  surfaces: SurfaceInspection[];
  syncStatus: "draft" | "pending_sync" | "synced";
};
