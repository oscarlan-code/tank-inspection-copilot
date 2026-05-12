import { useEffect, useMemo, useState, type ReactNode } from "react";

type PrototypeScreen =
  | "home"
  | "setup"
  | "scope"
  | "taskBoard"
  | "shellUt"
  | "shellFinding"
  | "shellLayout"
  | "shellPreciseLocation"
  | "roofUt"
  | "roofFinding"
  | "shellNozzleUt"
  | "shellNozzleFinding"
  | "roofNozzleUt"
  | "roofNozzleFinding"
  | "bottomMfl"
  | "findings"
  | "review"
  | "export";

type RoofTypeOption =
  | "fixed_cone"
  | "fixed_dome"
  | "umbrella"
  | "external_floating"
  | "internal_floating"
  | "double_deck_floating"
  | "other";

type ReferenceDirection = "" | "true_north" | "tank_north" | "site_reference_marker";
type ShellLocationStyle = "" | "compass" | "degrees";
type ScopeTaskKey = "shellUt" | "roofUt" | "shellNozzles" | "roofNozzles" | "bottomMfl" | "findingsPhotos";
type Severity = "" | "Low" | "Medium" | "High";
type FindingStatus = "Documented" | "Precise location needed" | "Needs follow-up";
type FineLocationMethod = "tap_layout" | "manual_xy" | "plate_seam_reference";
type SeamOffsetRule = "half_plate" | "third_plate" | "custom";
type ShellBearing = "N" | "E" | "S" | "W";
type AnnotationTool = "arrow" | "circle" | "line";
type RoofLayoutTemplate = "circular_plate" | "circular_center_opening" | "umbrella_radial" | "flat_grid";
type RoofFeatureType = "center_opening" | "roof_manhole" | "vent" | "gauge_hatch" | "platform" | "walkway";
type RoofFeaturePlacement = "center" | "plate_linked" | "azimuth_radius" | "grid_coordinate";
type ShellLineStart = "N" | "E" | "S" | "W";
type ShellLineDirection = "clockwise" | "anticlockwise";
type NozzlePlacementMode = "sketch" | "explicit";

type PrototypeShellGeometry = {
  numCourses: number;
  platesPerCourse: number;
  stdCourseHeightMm: number;
  topCourseHeightMm: number;
  seamOriginC1Deg: number;
  offsetDeg: number;
  plateSpanDeg: number;
  circumferenceMm: number;
  plateWidthMm: number;
  closurePlateWidthMm: number;
  seamOffsetRule: SeamOffsetRule;
};

type PrototypeRoofCell = {
  plateNumber: number;
  row: number;
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type PrototypeRoofLayout = {
  template: RoofLayoutTemplate;
  rowCount: number;
  columnCount: number;
  centerVoid: boolean;
  centerVoidRatio: number;
  cells: PrototypeRoofCell[];
};

type PrototypeNozzleRegistryItem = {
  id: string;
  size: string;
  azimuthDeg: number;
  radialBand: number;
  shellCourse?: string;
  roofPlateNumber?: number;
};

type ShellInspectionLine = {
  index: number;
  azimuthDeg: number;
  label: string;
  bearing: ShellBearing;
};

type RoofFeature = {
  id: string;
  type: RoofFeatureType;
  label: string;
  placement: RoofFeaturePlacement;
  plateNumber?: number;
  azimuthDeg?: number;
  radialPercent?: number;
  gridRow?: number;
  gridColumn?: number;
};

type RoofFeatureDraft = {
  type: RoofFeatureType;
  placement: RoofFeaturePlacement;
  label: string;
  plateNumber: string;
  azimuthDeg: string;
  radialPercent: string;
  gridRow: string;
  gridColumn: string;
};

type OptionalDetails = {
  clientRepresentative: string;
  fieldLeaseName: string;
  yearBuilt: string;
  originalManufacturer: string;
  originalConstructionStandard: string;
  materialSpec: string;
  constructionType: string;
  drawingRef: string;
  serviceHeight: string;
  productStored: string;
  specificGravity: string;
  designTemp: string;
  internalPressure: string;
  windGirder: string;
  insulated: string;
  stiffener: string;
  totalRoofPlates: string;
};

type SetupState = {
  client: string;
  location: string;
  tankNumber: string;
  diameterM: string;
  heightM: string;
  totalShellCourses: string;
  roofType: RoofTypeOption | "";
  customRoofType: string;
  inspectionDate: string;
  optional: OptionalDetails;
};

type ScopeState = {
  referenceDirection: ReferenceDirection;
  tankNorthOffset: string;
  referenceMarkerDescription: string;
  referenceMarkerBearing: string;
  shellLocationStyle: ShellLocationStyle;
  tasks: Record<ScopeTaskKey, boolean>;
};

type ShellMatrixReadings = Record<ShellBearing, string[]>;

type ShellEntryState = {
  strake: string;
  bearing: ShellBearing;
  activeLineIndex: number;
  degreeBearing: string;
  readings: string[];
  matrixReadings: ShellMatrixReadings;
  note: string;
  photoCount: number;
};

type RoofEntryState = {
  plateNumber: string;
  readings: string[];
  note: string;
  photoCount: number;
};

type NozzleEntryState = {
  nozzleId: string;
  nozzleSize: string;
  readings: string[];
  reinforcementPad: string;
  note: string;
  photoCount: number;
};

type MeasurementRecord = {
  id: string;
  summary: string;
  subSummary: string;
  min: number;
  mean?: number;
  max: number;
  taskKey: ScopeTaskKey;
  shellStrake?: string;
  shellBearing?: ShellBearing;
  shellLineIndex?: number;
  shellLineLabel?: string;
  shellAzimuthDeg?: number;
  readingCount?: number;
  shellReadings?: string[];
};

type FindingDraft = {
  photoCount: number;
  annotation: string;
  annotationTool: AnnotationTool;
  findingType: string;
  severity: Severity;
  note: string;
  measurementA: string;
  measurementB: string;
  shellStrake: string;
  shellBearing: ShellBearing;
  shellLineLabel: string;
  shellAzimuthDeg: string;
  roofPlate: string;
  nozzleId: string;
};

type FindingContext = {
  screen: PrototypeScreen;
  returnScreen: PrototypeScreen;
  sourceTaskLabel: string;
  sourceTaskKey: ScopeTaskKey;
  locationSummary: string;
  preciseAllowed: boolean;
  typeOptions: string[];
  shellStrake?: string;
  shellBearing?: ShellBearing;
  shellLineLabel?: string;
  shellAzimuthDeg?: number;
  roofPlate?: string;
  nozzleId?: string;
};

type FindingRecord = {
  id: string;
  title: string;
  sourceTaskLabel: string;
  sourceTaskKey: ScopeTaskKey;
  locationSummary: string;
  severity: Exclude<Severity, "">;
  status: FindingStatus;
  photoCount: number;
  note: string;
  measurements: string[];
};

type ShellLayoutState = {
  plateWidthMm: string;
  seamOrigin: string;
  seamOffsetRule: SeamOffsetRule;
  customOffset: string;
  drawingReference: string;
};

type PreciseLocationState = {
  method: FineLocationMethod;
  x: string;
  y: string;
  plateReference: string;
  seamRelation: string;
  regionSize: string;
  note: string;
  selectedStrake: string;
  selectedBearing: ShellBearing;
  selectedPlateIndex: number;
};

type MflState = {
  contractor: string;
  reportReference: string;
  reportDate: string;
  coverage: string;
  severity: Severity;
  attachmentName: string;
  flaggedAreas: string;
  summaryNote: string;
};

const roofTypeOptions: Array<{ value: RoofTypeOption; label: string }> = [
  { value: "fixed_cone", label: "Fixed Cone Roof" },
  { value: "fixed_dome", label: "Fixed Dome Roof" },
  { value: "umbrella", label: "Umbrella Roof" },
  { value: "external_floating", label: "External Floating Roof" },
  { value: "internal_floating", label: "Internal Floating Roof" },
  { value: "double_deck_floating", label: "Double Deck Floating Roof" },
  { value: "other", label: "Other" },
];

const roofLayoutTemplateOptions: Array<{ value: RoofLayoutTemplate; label: string }> = [
  { value: "circular_plate", label: "Circular Plate" },
  { value: "circular_center_opening", label: "Circular + Center Opening" },
  { value: "umbrella_radial", label: "Umbrella / Radial" },
];

const roofFeatureTypeOptions: Array<{ value: RoofFeatureType; label: string }> = [
  { value: "center_opening", label: "Center Opening" },
  { value: "roof_manhole", label: "Roof Manhole" },
  { value: "vent", label: "Vent" },
  { value: "gauge_hatch", label: "Gauge Hatch" },
  { value: "platform", label: "Platform" },
  { value: "walkway", label: "Walkway / Landing" },
];

const roofFeaturePlacementOptions: Array<{ value: RoofFeaturePlacement; label: string }> = [
  { value: "center", label: "Center" },
  { value: "plate_linked", label: "Plate Linked" },
  { value: "azimuth_radius", label: "Azimuth + Radius" },
  { value: "grid_coordinate", label: "Grid Coordinate" },
];

const scopeTaskDefinitions: Array<{ key: ScopeTaskKey; label: string; helper: string }> = [
  { key: "shellUt", label: "Shell UT", helper: "Routine shell thickness entry" },
  { key: "roofUt", label: "Roof UT", helper: "Plate-based roof thickness entry" },
  { key: "shellNozzles", label: "Shell Nozzles", helper: "Clock-position nozzle readings" },
  { key: "roofNozzles", label: "Roof Nozzles", helper: "N-E-S-W nozzle readings" },
  { key: "bottomMfl", label: "Bottom MFL Import", helper: "Import only in MVP" },
];

const shellFindingTypes = [
  "Crack",
  "Localized Corrosion / Pitting",
  "General Thinning",
  "Deformation",
  "Weld Concern",
  "Coating Failure",
  "Repair Observation",
  "Other",
];

const roofFindingTypes = [
  "Corrosion / Pitting",
  "Perforation",
  "Crack",
  "Deformation",
  "Coating Failure",
  "Repair Observation",
  "Other",
];

const nozzleFindingTypes = [
  "Crack",
  "Local Corrosion",
  "Weld Concern",
  "Reinforcement Pad Issue",
  "Leakage Sign",
  "Coating Failure",
  "Other",
];

const recentInspectionCards = [
  { tankNumber: "5470", client: "Petronas Carigali", editedAt: "Today, 14:20", status: "Draft" },
  { tankNumber: "TK-13", client: "Terminal Integrity", editedAt: "Yesterday, 18:05", status: "Exported" },
];

const yesNoOptions = ["", "Yes", "No"];

const initialSetupState: SetupState = {
  client: "",
  location: "",
  tankNumber: "",
  diameterM: "",
  heightM: "",
  totalShellCourses: "",
  roofType: "",
  customRoofType: "",
  inspectionDate: "2026-04-22",
  optional: {
    clientRepresentative: "",
    fieldLeaseName: "",
    yearBuilt: "",
    originalManufacturer: "",
    originalConstructionStandard: "",
    materialSpec: "",
    constructionType: "",
    drawingRef: "",
    serviceHeight: "",
    productStored: "",
    specificGravity: "",
    designTemp: "",
    internalPressure: "",
    windGirder: "",
    insulated: "",
    stiffener: "",
    totalRoofPlates: "",
  },
};

const sampleSetupState: SetupState = {
  ...initialSetupState,
  client: "Petronas Carigali",
  location: "Kerteh, Terengganu",
  tankNumber: "5470",
  diameterM: "26.5",
  heightM: "10.0",
  totalShellCourses: "6",
  roofType: "fixed_cone",
};

const initialScopeState: ScopeState = {
  referenceDirection: "",
  tankNorthOffset: "",
  referenceMarkerDescription: "",
  referenceMarkerBearing: "",
  shellLocationStyle: "compass",
  tasks: {
    shellUt: true,
    roofUt: true,
    shellNozzles: false,
    roofNozzles: false,
    bottomMfl: true,
    findingsPhotos: true,
  },
};

const sampleScopeState: ScopeState = {
  referenceDirection: "true_north",
  tankNorthOffset: "",
  referenceMarkerDescription: "",
  referenceMarkerBearing: "",
  shellLocationStyle: "compass",
  tasks: {
    shellUt: true,
    roofUt: true,
    shellNozzles: true,
    roofNozzles: true,
    bottomMfl: true,
    findingsPhotos: true,
  },
};

const initialShellEntryState: ShellEntryState = {
  strake: "Strake 1",
  bearing: "N",
  activeLineIndex: 0,
  degreeBearing: "0",
  readings: ["", "", "", "", ""],
  matrixReadings: {
    N: ["", "", "", "", ""],
    E: ["", "", "", "", ""],
    S: ["", "", "", "", ""],
    W: ["", "", "", "", ""],
  },
  note: "",
  photoCount: 0,
};

const initialRoofEntryState: RoofEntryState = {
  plateNumber: "R-01",
  readings: ["", "", "", "", ""],
  note: "",
  photoCount: 0,
};

const initialShellNozzleEntryState: NozzleEntryState = {
  nozzleId: "S1",
  nozzleSize: `2"`,
  readings: ["", "", "", ""],
  reinforcementPad: "",
  note: "",
  photoCount: 0,
};

const initialRoofNozzleEntryState: NozzleEntryState = {
  nozzleId: "R1",
  nozzleSize: `2"`,
  readings: ["", "", "", ""],
  reinforcementPad: "",
  note: "",
  photoCount: 0,
};

const initialFindingDraft: FindingDraft = {
  photoCount: 0,
  annotation: "",
  annotationTool: "line",
  findingType: "",
  severity: "Low",
  note: "",
  measurementA: "",
  measurementB: "",
  shellStrake: "Strake 1",
  shellBearing: "N",
  shellLineLabel: "N",
  shellAzimuthDeg: "0",
  roofPlate: "",
  nozzleId: "",
};

const initialShellLayoutState: ShellLayoutState = {
  plateWidthMm: "",
  seamOrigin: "",
  seamOffsetRule: "half_plate",
  customOffset: "",
  drawingReference: "",
};

const initialPreciseLocationState: PreciseLocationState = {
  method: "tap_layout",
  x: "",
  y: "",
  plateReference: "",
  seamRelation: "",
  regionSize: "",
  note: "",
  selectedStrake: "Strake 1",
  selectedBearing: "N",
  selectedPlateIndex: 1,
};

const initialMflState: MflState = {
  contractor: "",
  reportReference: "",
  reportDate: "",
  coverage: "",
  severity: "",
  attachmentName: "",
  flaggedAreas: "",
  summaryNote: "",
};

const initialRoofFeatureDraft: RoofFeatureDraft = {
  type: "roof_manhole",
  placement: "plate_linked",
  label: "",
  plateNumber: "1",
  azimuthDeg: "0",
  radialPercent: "65",
  gridRow: "1",
  gridColumn: "1",
};

const severityOptions: Array<Exclude<Severity, "">> = ["Low", "Medium", "High"];
const referenceDirectionOptions: Array<{ value: ReferenceDirection; label: string }> = [
  { value: "true_north", label: "True North" },
  { value: "tank_north", label: "Tank North" },
  { value: "site_reference_marker", label: "Site Reference Marker" },
];
const shellLocationOptions: Array<{ value: ShellLocationStyle; label: string }> = [
  { value: "compass", label: "Compass" },
  { value: "degrees", label: "Degrees" },
];
const shellBearingOptions: ShellBearing[] = ["N", "E", "S", "W"];
const shellLineStartOptions: Array<{ value: ShellLineStart; label: string }> = [
  { value: "N", label: "N" },
  { value: "E", label: "E" },
  { value: "S", label: "S" },
  { value: "W", label: "W" },
];
const shellLineDirectionOptions: Array<{ value: ShellLineDirection; label: string }> = [
  { value: "clockwise", label: "Clockwise" },
  { value: "anticlockwise", label: "Anti-clockwise" },
];
const nozzlePlacementModeOptions: Array<{ value: NozzlePlacementMode; label: string }> = [
  { value: "sketch", label: "Sketch" },
  { value: "explicit", label: "Explicit" },
];
const shellSeamOptions: Array<{ value: SeamOffsetRule; label: string }> = [
  { value: "half_plate", label: "Half Plate" },
  { value: "third_plate", label: "Third Plate" },
  { value: "custom", label: "Custom" },
];
const preciseMethodOptions: Array<{ value: FineLocationMethod; label: string }> = [
  { value: "tap_layout", label: "Tap Layout" },
  { value: "manual_xy", label: "Manual X,Y" },
  { value: "plate_seam_reference", label: "Plate / Seam Reference" },
];
const annotationToolOptions: Array<{ value: AnnotationTool; label: string }> = [
  { value: "arrow", label: "Arrow" },
  { value: "circle", label: "Circle" },
  { value: "line", label: "Line" },
];
const nozzleSizeOptions = [
  `2"`,
  `3"`,
  `4"`,
  `6"`,
  `8"`,
  `10"`,
  `12"`,
  `14"`,
  `16"`,
  `18"`,
  `20"`,
  `24"`,
  `30"`,
  `36"`,
  `24"x36"`,
  `No Pad`,
];

const createEmptyShellMatrixReadings = (): ShellMatrixReadings => ({
  N: ["", "", "", "", ""],
  E: ["", "", "", "", ""],
  S: ["", "", "", "", ""],
  W: ["", "", "", "", ""],
});

const normalizeShellReadings = (readings?: string[]) =>
  Array.from({ length: 5 }, (_, index) => readings?.[index] ?? "");

const buildShellMatrixReadings = (strake: string, records: MeasurementRecord[]): ShellMatrixReadings => {
  const matrix = createEmptyShellMatrixReadings();

  records.forEach((record) => {
    if (record.shellStrake !== strake || !record.shellBearing || !record.shellReadings) return;
    matrix[record.shellBearing] = normalizeShellReadings(record.shellReadings);
  });

  return matrix;
};

const composeFindingLocationSummary = (context: FindingContext, draft: FindingDraft) => {
  switch (context.sourceTaskKey) {
    case "shellUt":
      return `${draft.shellStrake || context.shellStrake || "Strake 1"} · ${draft.shellLineLabel || context.shellLineLabel || draft.shellBearing || context.shellBearing || "N"}${draft.shellAzimuthDeg ? ` · ${draft.shellAzimuthDeg}°` : context.shellAzimuthDeg !== undefined ? ` · ${formatAzimuth(context.shellAzimuthDeg)}°` : ""}`;
    case "roofUt":
      return draft.roofPlate.trim() || context.roofPlate?.trim() || context.locationSummary;
    case "shellNozzles":
    case "roofNozzles":
      return context.locationSummary;
    default:
      return context.locationSummary;
  }
};

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function parseNumberList(values: string[]) {
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function computeStats(values: string[]) {
  const numbers = parseNumberList(values);
  if (numbers.length === 0) return null;
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const mean = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  return { min, max, mean, count: numbers.length };
}

function courseSeamOrigin(i: number, c1: number, stepDeg: number, rule: SeamOffsetRule): number {
  const cycle = rule === "half_plate" ? 2 : rule === "third_plate" ? 3 : 0;
  const phaseIndex = cycle > 0 ? i % cycle : i;
  return ((c1 + phaseIndex * stepDeg) % 360 + 360) % 360;
}

function computePrototypeShellGeometry(shellLayout: ShellLayoutState, setup: SetupState): PrototypeShellGeometry | null {
  const numCourses = Number(setup.totalShellCourses) || 0;
  const diameterM = Number(setup.diameterM) || 0;
  const heightM = Number(setup.heightM) || 0;
  const plateWidthMm = Number(shellLayout.plateWidthMm) || 0;
  const seamOriginC1Deg = Number(shellLayout.seamOrigin) || 0;

  if (!numCourses || !diameterM || !heightM || !plateWidthMm) return null;

  const totalHeightMm = Math.round(heightM * 1000);
  const stdCourseHeightMm = Math.floor(totalHeightMm / numCourses);
  const topCourseHeightMm = totalHeightMm - stdCourseHeightMm * (numCourses - 1);
  const circumferenceMm = diameterM * Math.PI * 1000;
  const platesPerCourse = Math.floor(circumferenceMm / plateWidthMm);
  if (platesPerCourse < 1) return null;

  const closurePlateWidthMm = Math.round(circumferenceMm - platesPerCourse * plateWidthMm);
  const plateSpanDeg = 360 / platesPerCourse;
  const offsetDeg =
    shellLayout.seamOffsetRule === "half_plate"
      ? plateSpanDeg / 2
      : shellLayout.seamOffsetRule === "third_plate"
        ? plateSpanDeg / 3
        : Number(shellLayout.customOffset) || 0;

  return {
    numCourses,
    platesPerCourse,
    stdCourseHeightMm,
    topCourseHeightMm,
    seamOriginC1Deg,
    offsetDeg,
    plateSpanDeg,
    circumferenceMm,
    plateWidthMm,
    closurePlateWidthMm,
    seamOffsetRule: shellLayout.seamOffsetRule,
  };
}

function bearingFromAzimuth(azimuth: number): ShellBearing {
  const normalized = ((azimuth % 360) + 360) % 360;
  if (normalized < 45 || normalized >= 315) return "N";
  if (normalized < 135) return "E";
  if (normalized < 225) return "S";
  return "W";
}

const SHELL_MAX_LINE_SPACING_M = 9.75;

function recommendedShellLineCount(diameterM: number) {
  if (!Number.isFinite(diameterM) || diameterM <= 0) return 4;
  const circumference = Math.PI * diameterM;
  return Math.max(2, Math.ceil(circumference / SHELL_MAX_LINE_SPACING_M));
}

function startAzimuthForLine(start: ShellLineStart) {
  return start === "N" ? 0 : start === "E" ? 90 : start === "S" ? 180 : 270;
}

function buildShellInspectionLines(
  count: number,
  start: ShellLineStart,
  direction: ShellLineDirection,
): ShellInspectionLine[] {
  const safeCount = Math.max(1, count);
  const step = 360 / safeCount;
  const directionFactor = direction === "clockwise" ? 1 : -1;
  const startAzimuth = startAzimuthForLine(start);

  return Array.from({ length: safeCount }, (_, index) => {
    const azimuthDeg = ((startAzimuth + directionFactor * step * index) % 360 + 360) % 360;
    const exactCardinal = Math.abs((azimuthDeg % 90 + 90) % 90) < 0.001;
    const bearing = bearingFromAzimuth(azimuthDeg);
    const label = safeCount === 4 && exactCardinal ? bearing : `L${index + 1}`;
    return {
      index,
      azimuthDeg: Number(azimuthDeg.toFixed(1)),
      label,
      bearing,
    };
  });
}

function parsePlateNumber(value: string) {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 1;
}

function deriveRoofPlateCount(setup: SetupState) {
  const explicit = Number(setup.optional.totalRoofPlates) || 0;
  if (explicit > 0) return explicit;
  const diameter = Number(setup.diameterM) || 0;
  if (!diameter) return 36;
  return Math.max(24, Math.round(diameter * 2));
}

function defaultRoofLayoutTemplateForType(roofType: RoofTypeOption | ""): RoofLayoutTemplate {
  if (roofType === "umbrella") return "umbrella_radial";
  if (
    roofType === "external_floating" ||
    roofType === "internal_floating" ||
    roofType === "double_deck_floating"
  ) {
    return "circular_center_opening";
  }
  if (roofType === "other") return "flat_grid";
  return "circular_plate";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function deriveRoofRowDefault(template: RoofLayoutTemplate, totalPlates: number) {
  if (template === "umbrella_radial") {
    return Math.max(1, Math.min(3, Math.round(Math.sqrt(totalPlates) / 4) || 1));
  }
  if (template === "flat_grid") {
    return Math.max(3, Math.min(10, Math.round(Math.sqrt(totalPlates * 0.65))));
  }
  return Math.max(6, Math.min(10, Math.round(Math.sqrt(totalPlates) * 1.1)));
}

function deriveRoofColumnDefault(template: RoofLayoutTemplate, totalPlates: number, rowCount: number) {
  if (template === "umbrella_radial") {
    return Math.max(6, Math.min(24, Math.ceil(totalPlates / Math.max(rowCount, 1))));
  }
  if (template === "flat_grid") {
    return Math.max(4, Math.min(12, Math.ceil(totalPlates / rowCount)));
  }
  return Math.max(4, Math.min(12, Math.round((totalPlates / rowCount) * 1.3)));
}

function computePrototypeRoofLayout(
  template: RoofLayoutTemplate,
  totalPlatesHint: number,
  overrideRowCount?: number,
  overrideColumnCount?: number,
  overrideCenterVoidRatio?: number,
): PrototypeRoofLayout {
  const rowCount = Math.max(1, overrideRowCount || deriveRoofRowDefault(template, totalPlatesHint));
  const columnCount = Math.max(1, overrideColumnCount || deriveRoofColumnDefault(template, totalPlatesHint, rowCount));
  const centerVoid = template === "circular_center_opening";
  const centerVoidRatio = centerVoid ? clamp(overrideCenterVoidRatio || 0.22, 0.12, 0.42) : 0;
  const cells: PrototypeRoofCell[] = [];
  let plateNumber = 1;

  if (template === "umbrella_radial") {
    const ringCount = Math.max(1, rowCount);
    const sectorCount = Math.max(4, columnCount);
    const innerRatio = 0.08;

    for (let ring = 1; ring <= ringCount; ring += 1) {
      const innerR = innerRatio + ((ring - 1) / ringCount) * (0.5 - innerRatio);
      const outerR = innerRatio + (ring / ringCount) * (0.5 - innerRatio);

      for (let sector = 1; sector <= sectorCount; sector += 1) {
        const startAngle = ((sector - 1) / sectorCount) * Math.PI * 2 - Math.PI / 2;
        const endAngle = (sector / sectorCount) * Math.PI * 2 - Math.PI / 2;
        const midAngle = (startAngle + endAngle) / 2;
        const midR = (innerR + outerR) / 2;
        const centerX = 0.5 + midR * Math.cos(midAngle);
        const centerY = 0.5 + midR * Math.sin(midAngle);
        const spanX = Math.max(0.05, outerR - innerR);
        const spanY = Math.max(0.05, outerR - innerR);

        cells.push({
          plateNumber,
          row: ring,
          column: sector,
          x: clamp(centerX - spanX / 2, 0.02, 0.98),
          y: clamp(centerY - spanY / 2, 0.02, 0.98),
          width: spanX,
          height: spanY,
        });
        plateNumber += 1;
        if (plateNumber > totalPlatesHint * 2) break;
      }
    }

    return { template, rowCount: ringCount, columnCount: sectorCount, centerVoid, centerVoidRatio, cells };
  }

  if (template === "flat_grid") {
    for (let row = 1; row <= rowCount; row += 1) {
      for (let column = 1; column <= columnCount; column += 1) {
        if (plateNumber > totalPlatesHint) break;
        cells.push({
          plateNumber,
          row,
          column,
          x: (column - 1) / columnCount,
          y: (row - 1) / rowCount,
          width: 1 / columnCount,
          height: 1 / rowCount,
        });
        plateNumber += 1;
      }
    }
    return { template, rowCount, columnCount, centerVoid, centerVoidRatio, cells };
  }

  for (let row = 1; row <= rowCount; row += 1) {
    const y = (row - 1) / rowCount;
    const height = 1 / rowCount;
    const centerY = y + height / 2;
    const dy = Math.abs(centerY - 0.5);
    const halfChord = Math.sqrt(Math.max(0, 0.25 - dy * dy));
    const chordWidth = halfChord * 2;
    const left = 0.5 - halfChord;
    const rowColumns = Math.max(1, Math.round(columnCount * chordWidth));

    for (let column = 1; column <= rowColumns; column += 1) {
      const width = chordWidth / rowColumns;
      const x = left + (column - 1) * width;
      const centerX = x + width / 2;
      if (centerVoid) {
        const dx = centerX - 0.5;
        if (Math.sqrt(dx * dx + (centerY - 0.5) * (centerY - 0.5)) < centerVoidRatio / 2) {
          continue;
        }
      }
      cells.push({
        plateNumber,
        row,
        column,
        x,
        y,
        width,
        height,
      });
      plateNumber += 1;
      if (plateNumber > totalPlatesHint * 2) break;
    }
  }

  return { template, rowCount, columnCount, centerVoid, centerVoidRatio, cells };
}

function roofFeatureLabel(type: RoofFeatureType, fallbackIndex: number) {
  const base =
    type === "center_opening" ? "CO"
    : type === "roof_manhole" ? "MH"
    : type === "vent" ? "V"
    : type === "gauge_hatch" ? "GH"
    : type === "platform" ? "PF"
    : "WL";
  return `${base}${fallbackIndex}`;
}

function findRoofCell(layout: PrototypeRoofLayout, plateNumber: number) {
  return layout.cells.find((cell) => cell.plateNumber === plateNumber) || null;
}

function roofGridCenter(layout: PrototypeRoofLayout, row: number, column: number) {
  return {
    x: clamp((column - 0.5) / Math.max(layout.columnCount, 1), 0.04, 0.96),
    y: clamp((row - 0.5) / Math.max(layout.rowCount, 1), 0.04, 0.96),
  };
}

function roofPolarCenter(azimuthDeg: number, radialPercent: number) {
  const radius = clamp(radialPercent / 100, 0.05, 0.48);
  const rad = ((azimuthDeg - 90) * Math.PI) / 180;
  return {
    x: 0.5 + radius * Math.cos(rad),
    y: 0.5 + radius * Math.sin(rad),
  };
}

function resolveRoofFeaturePoint(
  layout: PrototypeRoofLayout,
  feature: Pick<RoofFeature, "placement" | "plateNumber" | "azimuthDeg" | "radialPercent" | "gridRow" | "gridColumn">,
) {
  if (feature.placement === "center") return { x: 0.5, y: 0.5 };
  if (feature.placement === "plate_linked" && feature.plateNumber) {
    const cell = findRoofCell(layout, feature.plateNumber);
    if (!cell) return null;
    return {
      x: clamp(cell.x + cell.width / 2, 0.04, 0.96),
      y: clamp(cell.y + cell.height / 2, 0.04, 0.96),
    };
  }
  if (feature.placement === "azimuth_radius") {
    return roofPolarCenter(feature.azimuthDeg || 0, feature.radialPercent || 65);
  }
  if (feature.placement === "grid_coordinate") {
    return roofGridCenter(layout, feature.gridRow || 1, feature.gridColumn || 1);
  }
  return null;
}

function featurePlacementOptionsForTemplate(template: RoofLayoutTemplate) {
  if (template === "flat_grid") {
    return roofFeaturePlacementOptions.filter((item) => item.value !== "azimuth_radius");
  }
  return roofFeaturePlacementOptions;
}

function buildNozzleRegistry(prefix: "S" | "R", count: number): PrototypeNozzleRegistryItem[] {
  const safeCount = Math.max(1, count);
  const sizeCycle = [`2"`, `4"`, `6"`, `8"`, `10"`, `12"`];
  return Array.from({ length: safeCount }, (_, index) => ({
    id: `${prefix}${index + 1}`,
    size: sizeCycle[index % sizeCycle.length],
    azimuthDeg: Number((((index * 360) / safeCount) % 360).toFixed(1)),
    radialBand: prefix === "R" ? ((index % 3) + 1) : 3,
    shellCourse: prefix === "S" ? "Course 1" : undefined,
  }));
}

function formatMetric(value: number) {
  return value.toFixed(3);
}

function formatAzimuth(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function describeShellLine(line: ShellInspectionLine) {
  return `${line.label} · ${formatAzimuth(line.azimuthDeg)}°`;
}

function getStrakeNumber(strake: string) {
  const match = strake.match(/\d+/);
  return match ? Number(match[0]) : 1;
}

function nextRegistryId(registry: PrototypeNozzleRegistryItem[], currentId: string) {
  const index = registry.findIndex((item) => item.id === currentId);
  if (index < 0 || index === registry.length - 1) return registry[0]?.id ?? currentId;
  return registry[index + 1]?.id ?? currentId;
}

function Field({
  label,
  children,
  hint,
  required = false,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="laiq-field">
      <span className="laiq-field-label">
        {label}
        {required ? <span className="laiq-required"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="laiq-field-hint">{hint}</span> : null}
    </label>
  );
}

function Stage({
  title,
  subtitle,
  banner,
  children,
}: {
  screen: PrototypeScreen;
  title: string;
  subtitle: string;
  banner?: string;
  children: ReactNode;
}) {
  return (
    <main className="laiq-stage">
      <div className="laiq-stage-glow laiq-stage-glow-left" />
      <div className="laiq-stage-glow laiq-stage-glow-right" />
      <div className="laiq-shell">
        <div className="laiq-app-shell">
          <section className="laiq-app-header">
            <div className="laiq-app-header-copy">
              <p className="laiq-kicker">LAIQ Field App</p>
              <h1 className="laiq-app-title">{title}</h1>
              {subtitle ? <p className="laiq-app-subtitle">{subtitle}</p> : null}
            </div>
          </section>

          <div className="laiq-app-content">
            {banner ? <div className="laiq-banner">{banner}</div> : null}
            <div className="laiq-card-stack">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}

function ScreenCard({
  kicker,
  title,
  copy,
  topBar,
  children,
  footer,
  hideSectionHeader = false,
}: {
  kicker: string;
  title: string;
  copy?: string;
  topBar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  hideSectionHeader?: boolean;
}) {
  return (
    <section className="laiq-form-card">
      {topBar ? <div className="laiq-topbar">{topBar}</div> : null}
      {hideSectionHeader ? null : (
        <header className="laiq-section-header">
          <div>
            <p className="laiq-section-kicker">{kicker}</p>
            <h2 className="laiq-section-title">{title}</h2>
          </div>
          {copy ? <p className="laiq-section-copy">{copy}</p> : null}
        </header>
      )}
      {children}
      {footer}
    </section>
  );
}

function TopBar({
  onBack,
  onSaveDraft,
  backLabel = "Back",
}: {
  onBack: () => void;
  onSaveDraft?: () => void;
  backLabel?: string;
}) {
  return (
    <>
      <button type="button" className="laiq-topbar-button" onClick={onBack}>
        {backLabel}
      </button>
      {onSaveDraft ? (
        <button type="button" className="laiq-topbar-button" onClick={onSaveDraft}>
          Save Draft
        </button>
      ) : null}
    </>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="laiq-segmented">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cx("laiq-segment", value === option.value && "laiq-segment-active")}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ChoiceList<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | "";
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="laiq-choice-list">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cx("laiq-choice-item", value === option.value && "laiq-choice-item-active")}
          onClick={() => onChange(option.value)}
        >
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function FindingPhotoCanvas({
  hasPhoto,
  annotationTool,
  annotation,
}: {
  hasPhoto: boolean;
  annotationTool: AnnotationTool;
  annotation: string;
}) {
  if (!hasPhoto) {
    return (
      <div className="laiq-photo-canvas laiq-photo-canvas-empty">
        <strong>No photo loaded</strong>
        <span>Tap Take Photo to load a sample image for annotation.</span>
      </div>
    );
  }

  return (
    <div className="laiq-photo-canvas">
      <svg className="laiq-photo-svg" viewBox="0 0 320 190" aria-label="Dummy finding photo">
        <defs>
          <linearGradient id="finding-photo-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f7f2ea" />
            <stop offset="100%" stopColor="#dadfe8" />
          </linearGradient>
        </defs>
        <rect width="320" height="190" rx="18" fill="url(#finding-photo-bg)" />
        <path d="M0 126 L320 72" stroke="#b8c1cf" strokeWidth="10" opacity="0.45" />
        <rect x="56" y="48" width="218" height="98" rx="10" fill="#d9dee6" opacity="0.58" />
        <path d="M132 61 C152 96, 169 98, 188 132" stroke="#4d5562" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        {annotationTool === "line" ? <line x1="92" y1="122" x2="214" y2="76" stroke="#f22630" strokeWidth="4" strokeLinecap="round" /> : null}
        {annotationTool === "circle" ? <ellipse cx="164" cy="98" rx="52" ry="28" fill="none" stroke="#f22630" strokeWidth="4" /> : null}
        {annotationTool === "arrow" ? (
          <>
            <line x1="98" y1="128" x2="196" y2="85" stroke="#f22630" strokeWidth="4" strokeLinecap="round" />
            <polygon points="196,85 183,85 191,96" fill="#f22630" />
          </>
        ) : null}
      </svg>
      <div className="laiq-photo-canvas-caption">
        <strong>Sample photo loaded</strong>
        <span>{annotation.trim() ? annotation.trim() : `Sketch tool: ${annotationTool}`}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Ready"
      ? "laiq-status-ready"
      : status === "Needs attention"
        ? "laiq-status-attention"
        : status === "In progress"
          ? "laiq-status-progress"
          : "laiq-status-neutral";

  return <span className={cx("laiq-status-badge", tone)}>{status}</span>;
}

function TaskCard({
  label,
  status,
  meta,
  actionLabel,
  onClick,
}: {
  label: string;
  status: string;
  meta: string[];
  actionLabel: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="laiq-task-card" onClick={onClick}>
      <div className="laiq-task-card-header">
        <div>
          <h3>{label}</h3>
          <div className="laiq-task-meta">
            {meta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>
      <span className="laiq-task-link">{actionLabel}</span>
    </button>
  );
}

function ActionRow({
  label,
  description,
  meta,
  status,
  actionLabel,
  onClick,
}: {
  label: string;
  description?: string;
  meta?: string[];
  status?: string;
  actionLabel: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="laiq-action-row" onClick={onClick}>
      <div className="laiq-action-row-copy">
        <div className="laiq-action-row-header">
          <strong>{label}</strong>
          {status ? <StatusBadge status={status} /> : null}
        </div>
        {description ? <p>{description}</p> : null}
        {meta?.length ? (
          <div className="laiq-task-meta">
            {meta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        ) : null}
      </div>
      <span className="laiq-task-link">{actionLabel}</span>
    </button>
  );
}

function TaskToggleRow({
  label,
  helper,
  active,
  onToggle,
}: {
  label: string;
  helper: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" className={cx("laiq-toggle-row", active && "laiq-toggle-row-active")} onClick={onToggle}>
      <div className="laiq-toggle-row-copy">
        <strong>{label}</strong>
        <span>{helper}</span>
      </div>
      <span className={cx("laiq-toggle-pill", active && "laiq-toggle-pill-active")}>{active ? "On" : "Off"}</span>
    </button>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="laiq-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DirectionStepper({
  activeBearing,
}: {
  activeBearing: ShellBearing;
}) {
  const activeIndex = shellBearingOptions.indexOf(activeBearing);

  return (
    <div className="laiq-direction-stepper">
      {shellBearingOptions.map((bearing, index) => (
        <div
          key={bearing}
          className={cx(
            "laiq-direction-step",
            index < activeIndex && "laiq-direction-step-complete",
            index === activeIndex && "laiq-direction-step-active",
          )}
        >
          <span>{bearing}</span>
        </div>
      ))}
    </div>
  );
}

function CompassPreview({
  referenceDirection,
  shellLocationStyle,
  tankNorthOffset,
  markerBearing,
  markerDescription,
}: {
  referenceDirection: ReferenceDirection;
  shellLocationStyle: ShellLocationStyle;
  tankNorthOffset: string;
  markerBearing: string;
  markerDescription: string;
}) {
  const isTrueNorth = referenceDirection === "true_north";
  const isTankNorth = referenceDirection === "tank_north";
  const isMarker = referenceDirection === "site_reference_marker";
  const tankOffset = Math.max(0, Math.min(360, Number(tankNorthOffset) || 0));
  const markerBearingValue = Math.max(0, Math.min(360, Number(markerBearing) || 0));
  const cx = 82;
  const cy = 82;
  const r = 58;
  const toRad = (deg: number) => (deg - 90) * (Math.PI / 180);
  const tankX = cx + (r - 12) * Math.cos(toRad(tankOffset));
  const tankY = cy + (r - 12) * Math.sin(toRad(tankOffset));
  const markerX = cx + (r - 12) * Math.cos(toRad(markerBearingValue));
  const markerY = cy + (r - 12) * Math.sin(toRad(markerBearingValue));

  return (
    <div className="laiq-compass-card">
      <div className="laiq-compass-copy">
        <h3>Reference Preview</h3>
        <p>
          {isTrueNorth
            ? "0° is fixed to True North. N-E-S-W shell points follow geographic north."
            : isTankNorth
              ? "Tank North is offset from True North. Use the same tank reference later in shell mapping."
              : isMarker
                ? "0° is anchored to the chosen site marker. This should match the same physical reference used in V1."
                : "Choose the tank reference before measurement starts."}
        </p>
      </div>
      <div className="laiq-compass-wrap">
        <svg width="164" height="164" viewBox="0 0 164 164" aria-label="Reference preview">
          <circle cx={cx} cy={cy} r={r} fill="#eef3f8" stroke="#cfd9e6" strokeWidth="1.5" />
          <circle cx={cx} cy={cy} r={r - 16} fill="none" stroke="#d9e2ee" strokeWidth="1" strokeDasharray="4,4" />
          <line x1={cx} y1={cy} x2={cx} y2={cy - r + 8} stroke="#01457e" strokeWidth="3" />
          <polygon points={`${cx},${cy - r + 8} ${cx - 6},${cy - r + 22} ${cx + 6},${cy - r + 22}`} fill="#01457e" />
          <text x={cx} y={cy - r - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill="#01457e">N</text>
          <text x={cx + r + 10} y={cy + 4} textAnchor="middle" fontSize="10" fill="#5f6d82">E</text>
          <text x={cx} y={cy + r + 16} textAnchor="middle" fontSize="10" fill="#5f6d82">S</text>
          <text x={cx - r - 10} y={cy + 4} textAnchor="middle" fontSize="10" fill="#5f6d82">W</text>
          {isTrueNorth ? <circle cx={cx} cy={cy - r + 14} r="8" fill="#f22630" /> : null}
          {isTankNorth ? <circle cx={tankX} cy={tankY} r="8" fill="#f22630" /> : null}
          {isMarker ? <circle cx={markerX} cy={markerY} r="8" fill="#f22630" /> : null}
          <circle cx={cx} cy={cy} r="4" fill="#171c2a" />
        </svg>
      </div>
      <div className="laiq-compass-meta">
        <span>
          {shellLocationStyle === "degrees" ? "Shell values may be entered as degrees." : "Shell values follow compass quadrants."}
          {isMarker && markerDescription.trim().length > 0 ? ` Marker: ${markerDescription.trim()}.` : ""}
          {isTankNorth ? ` Tank North offset ${tankOffset}° from True North.` : ""}
          {isMarker ? ` Bearing ${markerBearingValue}° from True North.` : ""}
        </span>
      </div>
    </div>
  );
}

function ShellMap({
  totalCourses,
  activeStrake,
  activeBearing,
  readings,
  records,
  interactive = false,
  onSelectCell,
  compact = false,
  selectedStrakeOnly = false,
}: {
  totalCourses: number;
  activeStrake: string;
  activeBearing: ShellBearing;
  readings: string[];
  records: MeasurementRecord[];
  interactive?: boolean;
  onSelectCell?: (strake: string, bearing: ShellBearing) => void;
  compact?: boolean;
  selectedStrakeOnly?: boolean;
}) {
  const activeStrakeNumber = getStrakeNumber(activeStrake);
  const activeReadingCount = parseNumberList(readings).length;

  if (selectedStrakeOnly) {
    const rowNumbers = [5, 4, 3, 2, 1];

    return (
      <section className={cx("laiq-shell-map-card", compact && "laiq-shell-map-card-compact")}>
        <div className={cx("laiq-shell-map-header", compact && "laiq-shell-map-header-compact")}>
          <div>
            <h3>{activeStrake}</h3>
          </div>
        </div>

        <div className="laiq-shell-map">
            <div className="laiq-shell-strake-grid">
              <div className="laiq-shell-map-corner" />
              {shellBearingOptions.map((bearing) => (
                <div key={`heading-${bearing}`} className={cx("laiq-shell-map-heading", bearing === activeBearing && "laiq-shell-map-heading-active")}>
                  {bearing}
                </div>
              ))}

            {rowNumbers.map((rowNumber) => (
              <FragmentRow key={`row-${rowNumber}`}>
                <div className="laiq-shell-map-rowlabel">{rowNumber}</div>
                {shellBearingOptions.map((bearing) => {
                  const record = records.find(
                    (item) => item.shellStrake === activeStrake && item.shellBearing === bearing,
                  );
                  const savedCount = record?.readingCount ?? 0;
                  const isActiveColumn = bearing === activeBearing;
                  const isFilled = isActiveColumn ? rowNumber <= activeReadingCount : rowNumber <= savedCount;

                  const className = cx(
                    "laiq-shell-strake-cell",
                    isActiveColumn && "laiq-shell-strake-cell-active",
                    !isActiveColumn && savedCount > 0 && "laiq-shell-strake-cell-saved",
                    isFilled && (isActiveColumn ? "laiq-shell-strake-cell-filled-current" : "laiq-shell-strake-cell-filled-saved"),
                  );

                  if (interactive && onSelectCell) {
                    return (
                      <button
                        key={`${activeStrake}-${bearing}-${rowNumber}`}
                        type="button"
                        className={className}
                        onClick={() => onSelectCell(activeStrake, bearing)}
                      />
                    );
                  }

                  return <div key={`${activeStrake}-${bearing}-${rowNumber}`} className={className} />;
                })}
              </FragmentRow>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={cx("laiq-shell-map-card", compact && "laiq-shell-map-card-compact")}>
      <div className={cx("laiq-shell-map-header", compact && "laiq-shell-map-header-compact")}>
        <div>
          <h3>{compact ? "Layout" : "Shell Layout Guide"}</h3>
          {compact ? null : <p>Current UT point is highlighted. Saved sets stay marked on the shell view.</p>}
        </div>
        <div className="laiq-shell-map-legend">
          <span><i className="laiq-legend-dot laiq-legend-dot-current" /> Current</span>
          <span><i className="laiq-legend-dot laiq-legend-dot-saved" /> Saved</span>
        </div>
      </div>

      <div className="laiq-shell-map">
        <div className="laiq-shell-map-grid">
          <div className="laiq-shell-map-corner" />
          {shellBearingOptions.map((bearing) => (
            <div key={`heading-${bearing}`} className="laiq-shell-map-heading">
              {bearing}
            </div>
          ))}

          {Array.from({ length: totalCourses }, (_, index) => totalCourses - index).map((courseNumber) => {
            const strake = `Strake ${courseNumber}`;
            return (
              <FragmentRow key={strake}>
                <div className="laiq-shell-map-rowlabel">{strake}</div>
                {shellBearingOptions.map((bearing) => {
                  const record = records.find(
                    (item) => item.shellStrake === strake && item.shellBearing === bearing,
                  );
                  const isActive = courseNumber === activeStrakeNumber && bearing === activeBearing;
                  const displayCount = isActive ? activeReadingCount : record?.readingCount ?? 0;
                  const content = (
                    <>
                      <div className="laiq-shell-cell-label">{bearing}</div>
                      <div className="laiq-shell-reading-stack">
                        {Array.from({ length: 5 }, (_, readingIndex) => (
                          <span
                            key={`${strake}-${bearing}-${readingIndex}`}
                            className={cx(
                              "laiq-shell-reading-dot",
                              readingIndex < displayCount && (isActive ? "laiq-shell-reading-dot-current" : "laiq-shell-reading-dot-saved"),
                            )}
                          />
                        ))}
                      </div>
                    </>
                  );

                  if (interactive && onSelectCell) {
                    return (
                      <button
                        key={`${strake}-${bearing}`}
                        type="button"
                        className={cx(
                          "laiq-shell-cell",
                          record && "laiq-shell-cell-saved",
                          isActive && "laiq-shell-cell-active",
                        )}
                        onClick={() => onSelectCell(strake, bearing)}
                      >
                        {content}
                      </button>
                    );
                  }

                  return (
                    <div
                      key={`${strake}-${bearing}`}
                      className={cx(
                        "laiq-shell-cell",
                        record && "laiq-shell-cell-saved",
                        isActive && "laiq-shell-cell-active",
                      )}
                    >
                      {content}
                    </div>
                  );
                })}
              </FragmentRow>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ShellStrakeMatrixEditor({
  activeStrake,
  activeBearing,
  matrixReadings,
  onFocusBearing,
  onChangeCell,
}: {
  activeStrake: string;
  activeBearing: ShellBearing;
  matrixReadings: ShellMatrixReadings;
  onFocusBearing: (bearing: ShellBearing) => void;
  onChangeCell: (bearing: ShellBearing, rowIndex: number, value: string) => void;
}) {
  const rowNumbers = [5, 4, 3, 2, 1];
  const columnStats = Object.fromEntries(
    shellBearingOptions.map((bearing) => [bearing, computeStats(matrixReadings[bearing])]),
  ) as Record<ShellBearing, ReturnType<typeof computeStats>>;

  return (
    <section className="laiq-shell-map-card laiq-shell-map-card-compact">
      <div className="laiq-shell-map-header laiq-shell-map-header-compact">
        <div>
          <h3>{activeStrake}</h3>
        </div>
      </div>

      <div className="laiq-shell-map">
        <div className="laiq-shell-strake-grid">
          <div className="laiq-shell-map-corner" />
          {shellBearingOptions.map((bearing) => (
            <div key={`matrix-heading-${bearing}`} className={cx("laiq-shell-map-heading", bearing === activeBearing && "laiq-shell-map-heading-active")}>
              {bearing}
            </div>
          ))}

          {rowNumbers.map((rowNumber) => {
            const rowIndex = 5 - rowNumber;

            return (
              <FragmentRow key={`matrix-row-${rowNumber}`}>
                <div className="laiq-shell-map-rowlabel">{rowNumber}</div>
                {shellBearingOptions.map((bearing) => (
                  <input
                    key={`${activeStrake}-${bearing}-${rowNumber}`}
                    className={cx("laiq-shell-matrix-input", bearing === activeBearing && "laiq-shell-matrix-input-active")}
                    inputMode="decimal"
                    value={matrixReadings[bearing][rowIndex]}
                    onFocus={() => onFocusBearing(bearing)}
                    onChange={(e) => onChangeCell(bearing, rowIndex, e.target.value)}
                  />
                ))}
              </FragmentRow>
            );
          })}

          <div className="laiq-shell-map-corner" />
          {shellBearingOptions.map((bearing) => (
            <div key={`matrix-stats-${bearing}`} className={cx("laiq-shell-column-stats", bearing === activeBearing && "laiq-shell-column-stats-active")}>
              <span>Min {columnStats[bearing] ? formatMetric(columnStats[bearing]!.min) : "—"}</span>
              <span>Mean {columnStats[bearing] ? formatMetric(columnStats[bearing]!.mean) : "—"}</span>
              <span>Max {columnStats[bearing] ? formatMetric(columnStats[bearing]!.max) : "—"}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PrototypeShellLinePlanner({
  lines,
  activeLineIndex,
  activeStrake,
  totalShellCourses,
  records,
  onSelect,
}: {
  lines: ShellInspectionLine[];
  activeLineIndex: number;
  activeStrake: string;
  totalShellCourses: number;
  records: MeasurementRecord[];
  onSelect: (lineIndex: number, strake: string) => void;
}) {
  const activeStrakeNumber = getStrakeNumber(activeStrake);

  return (
    <section className="laiq-shell-line-plan">
      <div className="laiq-shell-line-plan-scroll">
        <div
          className="laiq-shell-line-plan-grid"
          style={{ gridTemplateColumns: `72px repeat(${Math.max(lines.length, 1)}, minmax(72px, 1fr))` }}
        >
          <div className="laiq-shell-line-corner">Line</div>
          {lines.map((line, index) => (
            <button
              key={`line-head-${line.index}`}
              type="button"
              className={cx("laiq-shell-line-heading", index === activeLineIndex && "laiq-shell-line-heading-active")}
              onClick={() => onSelect(index, activeStrake)}
            >
              <strong>{line.label}</strong>
              <span>{`${formatAzimuth(line.azimuthDeg)}°`}</span>
            </button>
          ))}

          {Array.from({ length: Math.max(totalShellCourses, 1) }, (_, index) => {
            const strakeNumber = index + 1;
            const strake = `Strake ${strakeNumber}`;

            return (
              <FragmentRow key={`shell-line-row-${strake}`}>
                <div className="laiq-shell-line-rowlabel">{`S${strakeNumber}`}</div>
                {lines.map((line, lineIndex) => {
                  const record = records.find(
                    (item) => item.shellStrake === strake && item.shellLineIndex === line.index,
                  );
                  const active = lineIndex === activeLineIndex && strakeNumber === activeStrakeNumber;
                  return (
                    <button
                      key={`shell-line-cell-${strake}-${line.index}`}
                      type="button"
                      className={cx(
                        "laiq-shell-line-cell",
                        active && "laiq-shell-line-cell-active",
                        record && "laiq-shell-line-cell-saved",
                      )}
                      onClick={() => onSelect(lineIndex, strake)}
                    >
                      <span>{record ? "Saved" : "Open"}</span>
                    </button>
                  );
                })}
              </FragmentRow>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PrototypeShellSurfaceMap({
  geometry,
  selectedStrake,
  selectedPlateIndex,
  onSelectPlate,
}: {
  geometry: PrototypeShellGeometry;
  selectedStrake: string;
  selectedPlateIndex: number;
  onSelectPlate: (strake: string, plateIndex: number, azimuthDeg: number) => void;
}) {
  const zoomSteps = [10, 16, 24, 36, 52];
  const [zoomIdx, setZoomIdx] = useState(1);
  const cellW = zoomSteps[zoomIdx];
  const cellH = 44;
  const labelW = 72;
  const labelH = 28;
  const totalShellW = geometry.platesPerCourse * cellW;
  const svgW = labelW + totalShellW;
  const svgH = labelH + geometry.numCourses * cellH;
  const azimuthTicks = [0, 45, 90, 135, 180, 225, 270, 315];
  const selectedCourseNum = getStrakeNumber(selectedStrake);

  const getSeamOrigin = (courseIdx: number) =>
    courseSeamOrigin(courseIdx, geometry.seamOriginC1Deg, geometry.offsetDeg, geometry.seamOffsetRule);

  const seamXs = (courseIdx: number): number[] => {
    const origin = getSeamOrigin(courseIdx);
    const originX = (origin / 360) * totalShellW;
    const xs: number[] = [];
    for (let j = -1; j <= geometry.platesPerCourse + 1; j += 1) {
      const x = ((originX + j * cellW) % totalShellW + totalShellW) % totalShellW;
      if (x >= 0 && x <= totalShellW) xs.push(x);
    }
    return [...new Set(xs.map(Math.round))].sort((a, b) => a - b);
  };

  const courseY = (courseNum: number) => labelH + (geometry.numCourses - courseNum) * cellH;

  const handleClick = (evt: React.MouseEvent<SVGSVGElement>) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    const cx = evt.clientX - rect.left - labelW;
    const cy = evt.clientY - rect.top - labelH;
    if (cx < 0 || cy < 0) return;
    const courseNum = geometry.numCourses - Math.floor(cy / cellH);
    if (courseNum < 1 || courseNum > geometry.numCourses) return;
    const azimuth = (cx / totalShellW) * 360;
    const courseIdx = courseNum - 1;
    const seamOrigin = getSeamOrigin(courseIdx);
    const relAzimuth = ((azimuth - seamOrigin) % 360 + 360) % 360;
    const plateIdx = Math.min(Math.floor(relAzimuth / geometry.plateSpanDeg) + 1, geometry.platesPerCourse);
    const centerAzimuth = ((seamOrigin + (plateIdx - 0.5) * geometry.plateSpanDeg) % 360 + 360) % 360;
    onSelectPlate(`Strake ${courseNum}`, plateIdx, centerAzimuth);
  };

  return (
    <section className="laiq-v1-shell-map-card">
      <div className="laiq-v1-shell-map-toolbar">
        <span>Scroll horizontally · each column = 1 plate · C1=bottom</span>
        <div className="laiq-v1-shell-map-zoom">
          <button
            type="button"
            className="laiq-v1-shell-map-zoom-button"
            disabled={zoomIdx === 0}
            onClick={() => setZoomIdx((current) => Math.max(0, current - 1))}
          >
            −
          </button>
          <span>{cellW}px</span>
          <button
            type="button"
            className="laiq-v1-shell-map-zoom-button"
            disabled={zoomIdx === zoomSteps.length - 1}
            onClick={() => setZoomIdx((current) => Math.min(zoomSteps.length - 1, current + 1))}
          >
            +
          </button>
        </div>
      </div>

      <div className="laiq-v1-shell-map-scroll">
        <svg
          width={svgW}
          height={svgH}
          className="laiq-v1-shell-map-svg"
          onClick={handleClick}
          aria-label="Shell unwrapped surface map"
        >
          <image href="/laiq-logo.png" x={svgW - 72} y={labelH + 6} width="42" height="42" opacity="0.14" preserveAspectRatio="xMidYMid meet" />
          {azimuthTicks.map((deg) => {
            const x = labelW + (deg / 360) * totalShellW;
            return (
              <g key={deg}>
                <line x1={x} y1={labelH - 6} x2={x} y2={labelH} stroke="#9fb0ad" strokeWidth="1" />
                <text x={x} y={labelH - 8} textAnchor="middle" fontSize="9" fill="#6c7a8e">{deg}°</text>
              </g>
            );
          })}
          <line x1={labelW} y1={labelH - 10} x2={labelW} y2={svgH} stroke="#4b8784" strokeWidth="1" strokeDasharray="3,3" />

          {Array.from({ length: geometry.numCourses }, (_, i) => {
            const courseNum = i + 1;
            const y = courseY(courseNum);
            const isTop = courseNum === geometry.numCourses;
            const courseH = isTop ? geometry.topCourseHeightMm : geometry.stdCourseHeightMm;
            const seams = seamXs(i);
            const seamOrigin = getSeamOrigin(i);
            const selectedX = labelW + ((((seamOrigin + (selectedPlateIndex - 1) * geometry.plateSpanDeg) % 360) + 360) % 360 / 360) * totalShellW;

            return (
              <g key={courseNum}>
                <rect x={labelW} y={y} width={totalShellW} height={cellH} fill={i % 2 === 0 ? "#eef6f3" : "#f6fbf8"} />
                {seams.map((sx) => (
                  <line key={`${courseNum}-${sx}`} x1={labelW + sx} y1={y} x2={labelW + sx} y2={y + cellH} stroke="#a8c0bb" strokeWidth="1.35" />
                ))}
                {selectedCourseNum === courseNum ? (
                  <rect
                    x={selectedX}
                    y={y + 1}
                    width={cellW - 1}
                    height={cellH - 2}
                    fill="#7dc0b8"
                    fillOpacity="0.38"
                    stroke="#2a8d85"
                    strokeWidth="1.5"
                    rx="2"
                  />
                ) : null}
                <line x1={labelW} y1={y} x2={svgW} y2={y} stroke="#a8c0bb" strokeWidth={courseNum === 1 ? 2 : 1} />
                <rect x={0} y={y} width={labelW - 2} height={cellH} fill={i % 2 === 0 ? "#f2f7f5" : "#edf4f1"} />
                <text x={4} y={y + 14} fontSize="10" fontWeight="700" fill="#1d2a2a">{`C${courseNum}${isTop ? " ▲" : ""}`}</text>
                <text x={4} y={y + 26} fontSize="8" fill="#5f6d82">{`${courseH}mm`}</text>
                <text x={4} y={y + 37} fontSize="8" fill="#91a2a0">{`${seamOrigin.toFixed(1)}°`}</text>
              </g>
            );
          })}
          <line x1={labelW} y1={svgH} x2={svgW} y2={svgH} stroke="#a8c0bb" strokeWidth="2" />
          <line x1={svgW} y1={labelH} x2={svgW} y2={svgH} stroke="#4b8784" strokeWidth="1" strokeDasharray="3,3" />
        </svg>
      </div>

      <div className="laiq-v1-shell-map-legend">
        <span><i className="laiq-legend-dot laiq-legend-dot-current" /> Selected</span>
        <span><i className="laiq-v1-shell-map-ref" /> 0° ref</span>
      </div>
    </section>
  );
}

function PrototypeRoofPlateMap({
  layout,
  roofType,
  selectedPlate,
  onSelect,
  features = [],
  featureDraft,
}: {
  layout: PrototypeRoofLayout;
  roofType: RoofTypeOption | "";
  selectedPlate: number;
  onSelect: (plateNumber: number) => void;
  features?: RoofFeature[];
  featureDraft?: RoofFeatureDraft | null;
}) {
  const isCircular = layout.template !== "flat_grid";
  const isUmbrella = layout.template === "umbrella_radial";
  const cx = 140;
  const cy = 150;
  const maxR = 118;
  const squareX = 22;
  const squareY = 32;
  const squareSize = 236;
  const innerVoidR = layout.centerVoid ? maxR * layout.centerVoidRatio : 0;
  const templateLabel =
    roofLayoutTemplateOptions.find((item) => item.value === layout.template)?.label || "Roof";
  const fillForCell = (cell: PrototypeRoofCell, isSelected: boolean) => {
    if (isSelected) return "rgba(47,114,111,0.28)";
    return cell.row % 2 === 0 ? "#eef6f3" : "#f6fbf8";
  };
  const featureMarkers = features
    .map((feature) => {
      const point = resolveRoofFeaturePoint(layout, feature);
      return point ? { ...feature, ...point } : null;
    })
    .filter(Boolean) as Array<RoofFeature & { x: number; y: number }>;
  const draftPlacement =
    featureDraft && featureDraft.label !== "__ignore__"
      ? resolveRoofFeaturePoint(layout, {
          placement: featureDraft.placement,
          plateNumber: Number(featureDraft.plateNumber) || 0,
          azimuthDeg: Number(featureDraft.azimuthDeg) || 0,
          radialPercent: Number(featureDraft.radialPercent) || 65,
          gridRow: Number(featureDraft.gridRow) || 1,
          gridColumn: Number(featureDraft.gridColumn) || 1,
        })
      : null;
  const renderFeatureMarker = (
    xNorm: number,
    yNorm: number,
    label: string,
    selected = false,
    dashed = false,
  ) => {
    const x = squareX + xNorm * squareSize;
    const y = squareY + yNorm * squareSize;
    return (
      <g key={`${label}-${xNorm}-${yNorm}`}>
        <circle
          cx={x}
          cy={y}
          r={selected ? 8 : 7}
          fill={selected ? "#f97316" : "#ffffff"}
          stroke={selected ? "#c2410c" : "#f97316"}
          strokeWidth="1.8"
          strokeDasharray={dashed ? "3,2" : undefined}
        />
        <text x={x} y={y + 3} textAnchor="middle" fontSize="7" fontWeight="800" fill={selected ? "#ffffff" : "#c2410c"}>
          {label.slice(0, 3)}
        </text>
      </g>
    );
  };

  const umbrellaPath = (cell: PrototypeRoofCell) => {
    const ringCount = Math.max(layout.rowCount, 1);
    const sectorCount = Math.max(layout.columnCount, 1);
    const innerRatio = 0.08;
    const innerR = maxR * (innerRatio + ((cell.row - 1) / ringCount) * (0.5 - innerRatio) * 2);
    const outerR = maxR * (innerRatio + (cell.row / ringCount) * (0.5 - innerRatio) * 2);
    const startAngle = ((cell.column - 1) / sectorCount) * Math.PI * 2 - Math.PI / 2;
    const endAngle = (cell.column / sectorCount) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + innerR * Math.cos(startAngle);
    const y1 = cy + innerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(startAngle);
    const y2 = cy + outerR * Math.sin(startAngle);
    const x3 = cx + outerR * Math.cos(endAngle);
    const y3 = cy + outerR * Math.sin(endAngle);
    const x4 = cx + innerR * Math.cos(endAngle);
    const y4 = cy + innerR * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    const labelR = (innerR + outerR) / 2;
    const labelAngle = (startAngle + endAngle) / 2;
    return {
      d: `M ${x1} ${y1} L ${x2} ${y2} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x3} ${y3} L ${x4} ${y4} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1} ${y1} Z`,
      labelX: cx + labelR * Math.cos(labelAngle),
      labelY: cy + labelR * Math.sin(labelAngle),
    };
  };

  return (
    <section className="laiq-roof-map-card">
      <div className="laiq-roof-map-toolbar">
        <span>{templateLabel}</span>
        <span>{`${layout.cells.length} plates`}</span>
      </div>
      <div className="laiq-roof-map-wrap">
        <svg width="280" height="300" className="laiq-roof-map-svg" aria-label="Roof coarse layout">
          <image href="/laiq-logo.png" x="220" y="10" width="40" height="40" opacity="0.14" preserveAspectRatio="xMidYMid meet" />
          {isCircular ? (
            <defs>
              <clipPath id="laiq-roof-circle-clip">
                <circle cx={cx} cy={cy} r={maxR} />
              </clipPath>
            </defs>
          ) : null}
          {isCircular ? (
            <g clipPath="url(#laiq-roof-circle-clip)">
              {layout.cells.map((cell) => {
                const isSelected = cell.plateNumber === selectedPlate;
                if (isUmbrella) {
                  const geometry = umbrellaPath(cell);
                  return (
                    <g key={`roof-${cell.plateNumber}`}>
                      <path
                        d={geometry.d}
                        fill={fillForCell(cell, isSelected)}
                        stroke={isSelected ? "#2f726f" : "#9bb5ae"}
                        strokeWidth={isSelected ? 1.8 : 1}
                        onClick={() => onSelect(cell.plateNumber)}
                        style={{ cursor: "pointer" }}
                      />
                      <text
                        x={geometry.labelX}
                        y={geometry.labelY + 3}
                        textAnchor="middle"
                        fontSize="8"
                        fontWeight={isSelected ? "700" : "600"}
                        fill={isSelected ? "#1d2a2a" : "#5f6d82"}
                      >
                        {cell.plateNumber}
                      </text>
                    </g>
                  );
                }
                const x = squareX + cell.x * squareSize;
                const y = squareY + cell.y * squareSize;
                const width = cell.width * squareSize;
                const height = cell.height * squareSize;
                return (
                  <g key={`roof-${cell.plateNumber}`}>
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill={fillForCell(cell, isSelected)}
                      stroke={isSelected ? "#2f726f" : "#9bb5ae"}
                      strokeWidth={isSelected ? 1.8 : 1}
                      onClick={() => onSelect(cell.plateNumber)}
                      style={{ cursor: "pointer" }}
                    />
                    <text
                      x={x + width / 2}
                      y={y + height / 2 + 3}
                      textAnchor="middle"
                      fontSize="8"
                      fontWeight={isSelected ? "700" : "600"}
                      fill={isSelected ? "#1d2a2a" : "#5f6d82"}
                    >
                      {cell.plateNumber}
                    </text>
                  </g>
                );
              })}
            </g>
          ) : (
            <>
              <rect x="28" y="40" width="224" height="224" rx="6" fill="#ffffff" stroke="#9bb5ae" strokeWidth="1.2" />
              {layout.cells.map((cell) => {
                const isSelected = cell.plateNumber === selectedPlate;
                const x = 28 + cell.x * 224;
                const y = 40 + cell.y * 224;
                const width = cell.width * 224;
                const height = cell.height * 224;
                return (
                  <g key={`roof-${cell.plateNumber}`}>
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill={fillForCell(cell, isSelected)}
                      stroke={isSelected ? "#2f726f" : "#9bb5ae"}
                      strokeWidth={isSelected ? 1.8 : 1}
                      onClick={() => onSelect(cell.plateNumber)}
                      style={{ cursor: "pointer" }}
                    />
                    <text
                      x={x + width / 2}
                      y={y + height / 2 + 3}
                      textAnchor="middle"
                      fontSize="8"
                      fontWeight={isSelected ? "700" : "600"}
                      fill={isSelected ? "#1d2a2a" : "#5f6d82"}
                    >
                      {cell.plateNumber}
                    </text>
                  </g>
                );
              })}
            </>
          )}
          {isCircular ? <circle cx={cx} cy={cy} r={maxR} fill="none" stroke="#ff6b6b" strokeWidth="1.3" /> : null}
          {layout.centerVoid ? <circle cx={cx} cy={cy} r={innerVoidR} fill="#ffffff" stroke="#9bb5ae" strokeWidth="1.5" /> : null}
          {!layout.centerVoid && isCircular ? <circle cx={cx} cy={cy} r="4" fill="#075f5c" /> : null}
          {featureMarkers.map((feature) => renderFeatureMarker(feature.x, feature.y, feature.label))}
          {draftPlacement ? renderFeatureMarker(draftPlacement.x, draftPlacement.y, roofFeatureLabel(featureDraft?.type || "roof_manhole", featureMarkers.length + 1), true, true) : null}
          <line x1={cx} y1={cy} x2={cx} y2={cy - maxR} stroke="#075f5c" strokeWidth="2" />
          <text x={cx} y={cy - maxR - 8} textAnchor="middle" fontSize="9" fontWeight="700" fill="#075f5c">N</text>
        </svg>
      </div>
    </section>
  );
}

function PrototypeShellNozzleMap({
  courseCount,
  nozzles,
  selectedId,
  selectedCourse,
  selectedAzimuth,
  onSelect,
  onPlaceCurrent,
}: {
  courseCount: number;
  nozzles: PrototypeNozzleRegistryItem[];
  selectedId: string;
  selectedCourse: string;
  selectedAzimuth: number;
  onSelect: (id: string) => void;
  onPlaceCurrent?: (course: string, azimuthDeg: number) => void;
}) {
  const width = 332;
  const top = 28;
  const left = 44;
  const right = 12;
  const bottom = 12;
  const rowHeight = 28;
  const gridWidth = width - left - right;
  const height = top + Math.max(courseCount, 1) * rowHeight + bottom;
  const selectedCourseNumber = getStrakeNumber(selectedCourse);
  const xForAzimuth = (azimuthDeg: number) => left + ((((azimuthDeg % 360) + 360) % 360) / 360) * gridWidth;
  const yForCourse = (courseLabel?: string) => {
    const courseNumber = getStrakeNumber(courseLabel || "Course 1");
    return top + (courseNumber - 0.5) * rowHeight;
  };
  const handleMapClick = (evt: React.MouseEvent<SVGSVGElement>) => {
    if (!onPlaceCurrent) return;
    const rect = evt.currentTarget.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const x = (evt.clientX - rect.left) * scaleX;
    const y = (evt.clientY - rect.top) * scaleY;
    if (x < left || x > left + gridWidth || y < top || y > top + courseCount * rowHeight) return;
    const courseNumber = Math.min(Math.max(Math.floor((y - top) / rowHeight) + 1, 1), Math.max(courseCount, 1));
    const azimuthDeg = ((((x - left) / gridWidth) * 360) % 360 + 360) % 360;
    onPlaceCurrent(`Course ${courseNumber}`, Number(azimuthDeg.toFixed(1)));
  };

  return (
    <section className="laiq-nozzle-map-card">
      <div className="laiq-nozzle-map-toolbar">
        <span>Shell nozzle coarse map</span>
        <span>{`${courseCount} courses · 0°–360°`}</span>
      </div>
      <div className="laiq-roof-map-wrap">
        <svg width={width} height={height} className="laiq-nozzle-map-svg" aria-label="Shell nozzle coarse map" onClick={handleMapClick}>
          <image href="/laiq-logo.png" x={width - 52} y="8" width="34" height="34" opacity="0.14" preserveAspectRatio="xMidYMid meet" />
          {[0, 1, 2, 3].map((section) => {
            const x = left + section * (gridWidth / 4);
            return (
              <rect
                key={`shell-nozzle-section-${section}`}
                x={x}
                y={top}
                width={gridWidth / 4}
                height={courseCount * rowHeight}
                fill={section % 2 === 0 ? "#f6fbf8" : "#eef6f3"}
                opacity="0.92"
              />
            );
          })}
          {Array.from({ length: Math.max(courseCount, 1) + 1 }, (_, index) => {
            const y = top + index * rowHeight;
            return <line key={`shell-nozzle-row-${index}`} x1={left} y1={y} x2={left + gridWidth} y2={y} stroke="#cfd9e6" strokeWidth="1" />;
          })}
          {[0, 90, 180, 270, 360].map((deg) => {
            const x = xForAzimuth(deg);
            return <line key={`shell-nozzle-col-${deg}`} x1={x} y1={top} x2={x} y2={top + courseCount * rowHeight} stroke="#a8c0bb" strokeWidth={deg % 180 === 0 ? 1.4 : 1} strokeDasharray={deg === 360 ? "none" : "3,3"} />;
          })}
          {["N", "E", "S", "W"].map((label, index) => (
            <text
              key={`shell-nozzle-head-${label}`}
              x={left + (index + 0.5) * (gridWidth / 4)}
              y={14}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fill="#536577"
            >
              {label}
            </text>
          ))}
          {[0, 90, 180, 270, 360].map((deg) => (
            <text
              key={`shell-nozzle-deg-${deg}`}
              x={xForAzimuth(deg)}
              y={24}
              textAnchor={deg === 0 ? "start" : deg === 360 ? "end" : "middle"}
              fontSize="8"
              fontWeight="700"
              fill="#7a8799"
            >
              {`${deg}°`}
            </text>
          ))}
          {Array.from({ length: Math.max(courseCount, 1) }, (_, index) => (
            <text
              key={`shell-nozzle-course-${index + 1}`}
              x={18}
              y={top + index * rowHeight + rowHeight / 2 + 3}
              textAnchor="middle"
              fontSize="9"
              fontWeight={selectedCourseNumber === index + 1 ? "800" : "700"}
              fill={selectedCourseNumber === index + 1 ? "#2f726f" : "#64748b"}
            >
              {`C${index + 1}`}
            </text>
          ))}
          {nozzles.map((nozzle) => {
            const active = nozzle.id === selectedId;
            const x = xForAzimuth(nozzle.azimuthDeg);
            const y = yForCourse(nozzle.shellCourse);
            return (
              <g
                key={`shell-nozzle-marker-${nozzle.id}`}
                onClick={(evt) => {
                  evt.stopPropagation();
                  onSelect(nozzle.id);
                }}
                style={{ cursor: "pointer" }}
              >
                <circle cx={x} cy={y} r={active ? 7.5 : 5.5} fill={active ? "#2f726f" : "#7ab1ab"} stroke={active ? "#134745" : "#ffffff"} strokeWidth={active ? 2 : 1.4} />
                <text x={x} y={y - 10} textAnchor="middle" fontSize="8" fontWeight={active ? "800" : "700"} fill={active ? "#1d2a2a" : "#5f6d82"}>
                  {nozzle.id}
                </text>
              </g>
            );
          })}
          <line x1={xForAzimuth(selectedAzimuth)} y1={top - 2} x2={xForAzimuth(selectedAzimuth)} y2={top + courseCount * rowHeight + 2} stroke="#2f726f" strokeWidth="1.3" />
        </svg>
      </div>
    </section>
  );
}

function PrototypeRoofNozzleMap({
  nozzles,
  selectedId,
  roofType,
  onSelect,
  onPlaceCurrent,
}: {
  nozzles: PrototypeNozzleRegistryItem[];
  selectedId: string;
  roofType: RoofTypeOption | "";
  onSelect: (id: string) => void;
  onPlaceCurrent?: (azimuthDeg: number, radialBand: number) => void;
}) {
  const cx = 128;
  const cy = 128;
  const ringPx = [34, 62, 92];
  const maxR = 110;
  const toRad = (deg: number) => (deg - 90) * (Math.PI / 180);
  const centerVoid =
    roofType === "external_floating" ||
    roofType === "internal_floating" ||
    roofType === "double_deck_floating";
  const handleMapClick = (evt: React.MouseEvent<SVGSVGElement>) => {
    if (!onPlaceCurrent) return;
    const width = 256;
    const height = 256;
    const rect = evt.currentTarget.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const x = (evt.clientX - rect.left) * scaleX;
    const y = (evt.clientY - rect.top) * scaleY;
    const dx = x - cx;
    const dy = y - cy;
    const radius = Math.sqrt(dx * dx + dy * dy);
    if (radius > maxR || radius < (centerVoid ? 24 : 0)) return;
    const azimuthDeg = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
    const radialBand = radius < 48 ? 1 : radius < 80 ? 2 : 3;
    onPlaceCurrent(Number(azimuthDeg.toFixed(1)), radialBand);
  };

  return (
    <section className="laiq-nozzle-map-card">
      <div className="laiq-nozzle-map-toolbar">
        <span>Roof nozzle location</span>
        <span>{`${nozzles.length} nozzles`}</span>
      </div>
      <svg width="256" height="256" className="laiq-nozzle-map-svg" aria-label="Roof nozzle coarse map" onClick={handleMapClick}>
        <image href="/laiq-logo.png" x="198" y="10" width="34" height="34" opacity="0.14" preserveAspectRatio="xMidYMid meet" />
        <circle cx={cx} cy={cy} r={maxR} fill="#f6fbf8" stroke="#a8c0bb" strokeWidth="2" />
        {ringPx.map((radius) => (
          <circle key={radius} cx={cx} cy={cy} r={radius} fill="none" stroke="#d1dbe6" strokeWidth="1" strokeDasharray="3,2" />
        ))}
        {centerVoid ? <circle cx={cx} cy={cy} r={24} fill="#fff" stroke="#cfd9e6" strokeWidth="1.5" /> : <circle cx={cx} cy={cy} r="4" fill="#075f5c" />}
        <line x1={cx} y1={cy - maxR} x2={cx} y2={cy + maxR} stroke="#dce4ec" strokeWidth="1" />
        <line x1={cx - maxR} y1={cy} x2={cx + maxR} y2={cy} stroke="#dce4ec" strokeWidth="1" />
        <text x={cx} y={cy - maxR - 8} textAnchor="middle" fontSize="9" fontWeight="700" fill="#075f5c">N</text>
        {nozzles.map((nozzle) => {
          const isSelected = nozzle.id === selectedId;
          const rad = toRad(nozzle.azimuthDeg);
          const ring = ringPx[Math.max(0, Math.min(ringPx.length - 1, nozzle.radialBand - 1))];
          const x = cx + ring * Math.cos(rad);
          const y = cy + ring * Math.sin(rad);
          return (
            <g
              key={nozzle.id}
              onClick={(evt) => {
                evt.stopPropagation();
                onSelect(nozzle.id);
              }}
              style={{ cursor: "pointer" }}
            >
              <circle cx={x} cy={y} r={isSelected ? 10 : 8} fill={isSelected ? "#2f726f" : "#6ca9a3"} />
              <text x={x} y={y + 3} textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff">{nozzle.id}</text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export default function InspectionSetupPrototype() {
  const [screen, setScreen] = useState<PrototypeScreen>("home");
  const [banner, setBanner] = useState("");
  const [setup, setSetup] = useState<SetupState>(initialSetupState);
  const [showOptional, setShowOptional] = useState(false);
  const [scope, setScope] = useState<ScopeState>(initialScopeState);
  const [shellEntry, setShellEntry] = useState<ShellEntryState>(initialShellEntryState);
  const [shellLineCountInput, setShellLineCountInput] = useState("4");
  const [shellLineCountTouched, setShellLineCountTouched] = useState(false);
  const [shellLineStart, setShellLineStart] = useState<ShellLineStart>("N");
  const [shellLineDirection, setShellLineDirection] = useState<ShellLineDirection>("clockwise");
  const [roofEntry, setRoofEntry] = useState<RoofEntryState>(initialRoofEntryState);
  const [shellNozzleEntry, setShellNozzleEntry] = useState<NozzleEntryState>(initialShellNozzleEntryState);
  const [roofNozzleEntry, setRoofNozzleEntry] = useState<NozzleEntryState>(initialRoofNozzleEntryState);
  const [shellRecords, setShellRecords] = useState<MeasurementRecord[]>([]);
  const [roofRecords, setRoofRecords] = useState<MeasurementRecord[]>([]);
  const [shellNozzleRecords, setShellNozzleRecords] = useState<MeasurementRecord[]>([]);
  const [roofNozzleRecords, setRoofNozzleRecords] = useState<MeasurementRecord[]>([]);
  const [findingDraft, setFindingDraft] = useState<FindingDraft>(initialFindingDraft);
  const [findingContext, setFindingContext] = useState<FindingContext | null>(null);
  const [findings, setFindings] = useState<FindingRecord[]>([]);
  const [shellLayout, setShellLayout] = useState<ShellLayoutState>(initialShellLayoutState);
  const [shellLayoutConfigured, setShellLayoutConfigured] = useState(false);
  const [preciseLocation, setPreciseLocation] = useState<PreciseLocationState>(initialPreciseLocationState);
  const [pendingShellFindingId, setPendingShellFindingId] = useState<string | null>(null);
  const [pendingPreciseReturnScreen, setPendingPreciseReturnScreen] = useState<PrototypeScreen>("shellUt");
  const [mfl, setMfl] = useState<MflState>(initialMflState);
  const [shellNozzleRegistry, setShellNozzleRegistry] = useState<PrototypeNozzleRegistryItem[]>([]);
  const [roofNozzleRegistry, setRoofNozzleRegistry] = useState<PrototypeNozzleRegistryItem[]>([]);
  const [shellNozzleCountInput, setShellNozzleCountInput] = useState("6");
  const [roofNozzleCountInput, setRoofNozzleCountInput] = useState("9");
  const [roofTemplateInput, setRoofTemplateInput] = useState<RoofLayoutTemplate>(defaultRoofLayoutTemplateForType(initialSetupState.roofType));
  const [roofRowCountInput, setRoofRowCountInput] = useState("");
  const [roofColumnCountInput, setRoofColumnCountInput] = useState("");
  const [roofCenterOpeningInput, setRoofCenterOpeningInput] = useState("22");
  const [roofFeatures, setRoofFeatures] = useState<RoofFeature[]>([]);
  const [roofFeatureDraft, setRoofFeatureDraft] = useState<RoofFeatureDraft>(initialRoofFeatureDraft);
  const [editingRoofFeatureId, setEditingRoofFeatureId] = useState<string | null>(null);
  const [shellNozzleConfirmed, setShellNozzleConfirmed] = useState(false);
  const [roofNozzleConfirmed, setRoofNozzleConfirmed] = useState(false);
  const [shellNozzlePlacementMode, setShellNozzlePlacementMode] = useState<NozzlePlacementMode>("sketch");
  const [roofNozzlePlacementMode, setRoofNozzlePlacementMode] = useState<NozzlePlacementMode>("sketch");
  const [findingsTaskFilter, setFindingsTaskFilter] = useState<string>("all");
  const [findingsSeverityFilter, setFindingsSeverityFilter] = useState<string>("all");
  const [findingsStatusFilter, setFindingsStatusFilter] = useState<string>("all");

  const shellGeometry = useMemo(
    () => computePrototypeShellGeometry(shellLayout, setup),
    [shellLayout, setup],
  );
  const roofPlateCount = useMemo(() => deriveRoofPlateCount(setup), [setup]);
  const recommendedLines = useMemo(() => recommendedShellLineCount(Number(setup.diameterM) || 0), [setup.diameterM]);
  const shellLineCount = Math.max(1, Number(shellLineCountInput) || recommendedLines);
  const shellInspectionLines = useMemo(
    () => buildShellInspectionLines(shellLineCount, shellLineStart, shellLineDirection),
    [shellLineCount, shellLineDirection, shellLineStart],
  );
  const shellCircumferenceM = useMemo(() => (Number(setup.diameterM) || 0) * Math.PI, [setup.diameterM]);
  const shellLineSpacingM = shellLineCount > 0 ? shellCircumferenceM / shellLineCount : 0;
  const roofRowCount = Number(roofRowCountInput) || undefined;
  const roofColumnCount = Number(roofColumnCountInput) || undefined;
  const roofCenterVoidRatio = Number(roofCenterOpeningInput) ? Number(roofCenterOpeningInput) / 100 : undefined;
  const roofLayout = useMemo(
    () => computePrototypeRoofLayout(roofTemplateInput, roofPlateCount, roofRowCount, roofColumnCount, roofCenterVoidRatio),
    [roofCenterVoidRatio, roofColumnCount, roofPlateCount, roofRowCount, roofTemplateInput],
  );

  const currentShellLine = shellInspectionLines[Math.min(shellEntry.activeLineIndex, Math.max(shellInspectionLines.length - 1, 0))];
  const activeShellReadings = shellEntry.readings;

  const setupIsValid = useMemo(() => {
    const diameter = Number(setup.diameterM);
    const height = Number(setup.heightM);
    const shellCourses = Number(setup.totalShellCourses);

    return (
      setup.client.trim().length > 0 &&
      setup.location.trim().length > 0 &&
      setup.tankNumber.trim().length > 0 &&
      Number.isFinite(diameter) &&
      diameter > 0 &&
      Number.isFinite(height) &&
      height > 0 &&
      Number.isFinite(shellCourses) &&
      shellCourses >= 1 &&
      setup.roofType !== "" &&
      (setup.roofType !== "other" || setup.customRoofType.trim().length > 0)
    );
  }, [setup]);

  const scopeIsValid = useMemo(() => {
    const hasTask = Object.values(scope.tasks).some(Boolean);
    const tankNorthOkay = scope.referenceDirection !== "tank_north" || scope.tankNorthOffset.trim().length > 0;
    const markerOkay =
      scope.referenceDirection !== "site_reference_marker" ||
      (scope.referenceMarkerDescription.trim().length > 0 && scope.referenceMarkerBearing.trim().length > 0);

    return scope.referenceDirection !== "" && scope.shellLocationStyle !== "" && tankNorthOkay && markerOkay && hasTask;
  }, [scope]);

  const shellStats = useMemo(() => computeStats(activeShellReadings), [activeShellReadings]);
  const roofStats = useMemo(() => computeStats(roofEntry.readings), [roofEntry.readings]);
  const shellNozzleStats = useMemo(
    () => computeStats([...shellNozzleEntry.readings, shellNozzleEntry.reinforcementPad]),
    [shellNozzleEntry.readings, shellNozzleEntry.reinforcementPad],
  );
  const roofNozzleStats = useMemo(
    () => computeStats([...roofNozzleEntry.readings, roofNozzleEntry.reinforcementPad]),
    [roofNozzleEntry.readings, roofNozzleEntry.reinforcementPad],
  );

  useEffect(() => {
    if (roofLayout.cells.length === 0) return;
    if (roofLayout.cells.some((cell) => String(cell.plateNumber) === roofEntry.plateNumber)) return;
    setRoofEntry((current) => ({ ...current, plateNumber: String(roofLayout.cells[0].plateNumber) }));
  }, [roofEntry.plateNumber, roofLayout.cells]);

  useEffect(() => {
    if (!shellLineCountTouched || !shellLineCountInput.trim()) {
      setShellLineCountInput(String(recommendedLines));
    }
  }, [recommendedLines, shellLineCountInput, shellLineCountTouched]);

  useEffect(() => {
    if (shellEntry.activeLineIndex <= shellInspectionLines.length - 1) return;
    setShellEntry((current) => ({
      ...current,
      activeLineIndex: Math.max(0, shellInspectionLines.length - 1),
    }));
  }, [shellEntry.activeLineIndex, shellInspectionLines.length]);

  useEffect(() => {
    if (!currentShellLine) return;
    setShellEntry((current) => ({
      ...current,
      bearing: currentShellLine.bearing,
      degreeBearing: formatAzimuth(currentShellLine.azimuthDeg),
    }));
  }, [currentShellLine]);

  const shellLocationSummary = currentShellLine
    ? `${shellEntry.strake} · ${describeShellLine(currentShellLine)}`
    : shellEntry.strake;
  const totalShellCourses = Math.max(Number(setup.totalShellCourses) || 1, 1);
  const currentShellStrakeNumber = getStrakeNumber(shellEntry.strake);
  const nextShellStrakeNumber = currentShellStrakeNumber < totalShellCourses ? currentShellStrakeNumber + 1 : 1;
  const nextShellLineIndex =
    currentShellStrakeNumber < totalShellCourses
      ? shellEntry.activeLineIndex
      : (shellEntry.activeLineIndex + 1) % Math.max(shellInspectionLines.length, 1);
  const nextShellLine = shellInspectionLines[nextShellLineIndex] || currentShellLine;
  const nextShellSummary = nextShellLine ? `Strake ${nextShellStrakeNumber} · ${describeShellLine(nextShellLine)}` : `Strake ${nextShellStrakeNumber}`;

  const roofLocationSummary = roofEntry.plateNumber ? `Plate ${roofEntry.plateNumber}` : "Roof plate";
  const currentShellNozzle = shellNozzleRegistry.find((item) => item.id === shellNozzleEntry.nozzleId) || null;
  const currentRoofNozzle = roofNozzleRegistry.find((item) => item.id === roofNozzleEntry.nozzleId) || null;
  const shellNozzleParentReady = shellRecords.length > 0;
  const roofNozzleParentReady = roofRecords.length > 0;
  const shellNozzleLocationSummary = currentShellNozzle
    ? `${currentShellNozzle.id} · ${currentShellNozzle.shellCourse || "Course 1"} · ${formatAzimuth(currentShellNozzle.azimuthDeg)}°`
    : shellNozzleEntry.nozzleId || "Shell nozzle";
  const roofNozzleLocationSummary = currentRoofNozzle
    ? `${currentRoofNozzle.id} · ${formatAzimuth(currentRoofNozzle.azimuthDeg)}° · Ring ${currentRoofNozzle.radialBand}`
    : roofNozzleEntry.nozzleId || "Roof nozzle";

  const reviewWarnings = useMemo(() => {
    const warnings: string[] = [];

    if (scope.tasks.shellUt && shellRecords.length === 0) {
      warnings.push("Shell UT has not started");
    }

    if (scope.tasks.roofUt && roofRecords.length === 0) {
      warnings.push("Roof UT has not started");
    }

    if (scope.tasks.bottomMfl && !mfl.attachmentName) {
      warnings.push("Bottom MFL attachment is missing");
    }

    if (findings.some((finding) => finding.photoCount === 0)) {
      warnings.push("One or more findings are missing photo evidence");
    }

    if (findings.some((finding) => finding.status === "Precise location needed")) {
      warnings.push("A shell finding still needs precise location");
    }

    return warnings;
  }, [findings, mfl.attachmentName, roofRecords.length, scope.tasks.bottomMfl, scope.tasks.roofUt, scope.tasks.shellUt, shellRecords.length]);

  const filteredFindings = useMemo(() => {
    return findings.filter((finding) => {
      if (findingsTaskFilter !== "all" && finding.sourceTaskLabel !== findingsTaskFilter) return false;
      if (findingsSeverityFilter !== "all" && finding.severity !== findingsSeverityFilter) return false;
      if (findingsStatusFilter !== "all" && finding.status !== findingsStatusFilter) return false;
      return true;
    });
  }, [findings, findingsSeverityFilter, findingsStatusFilter, findingsTaskFilter]);

  const completedTaskCount = useMemo(() => {
    let total = 0;
    if (scope.tasks.shellUt && shellRecords.length > 0) total += 1;
    if (scope.tasks.roofUt && roofRecords.length > 0) total += 1;
    if (scope.tasks.shellNozzles && shellNozzleRecords.length > 0) total += 1;
    if (scope.tasks.roofNozzles && roofNozzleRecords.length > 0) total += 1;
    if (scope.tasks.bottomMfl && mfl.attachmentName) total += 1;
    return total;
  }, [mfl.attachmentName, roofNozzleRecords.length, roofRecords.length, scope.tasks.bottomMfl, scope.tasks.roofNozzles, scope.tasks.roofUt, scope.tasks.shellNozzles, scope.tasks.shellUt, shellNozzleRecords.length, shellRecords.length]);

  const findingSummary = useMemo(
    () => ({
      total: findings.length,
      high: findings.filter((finding) => finding.severity === "High").length,
      followUp: findings.filter((finding) => finding.status !== "Documented").length,
    }),
    [findings],
  );

  const resetPrototypeState = (withSample = false) => {
    const nextSetup = withSample ? sampleSetupState : initialSetupState;
    const nextRecommendedShellLines = recommendedShellLineCount(Number(nextSetup.diameterM) || 0);
    const sampleShellRecords = [
      {
        id: createId(),
        summary: "Strake 1 · L1 · 0°",
        subSummary: "5 readings",
        min: 6.132,
        mean: 6.215,
        max: 6.304,
        taskKey: "shellUt" as const,
        shellStrake: "Strake 1",
        shellBearing: "N" as const,
        shellLineIndex: 0,
        shellLineLabel: "L1",
        shellAzimuthDeg: 0,
        readingCount: 5,
        shellReadings: ["6.132", "6.180", "6.214", "6.245", "6.304"],
      },
      {
        id: createId(),
        summary: "Strake 2 · L1 · 0°",
        subSummary: "5 readings",
        min: 6.044,
        mean: 6.155,
        max: 6.24,
        taskKey: "shellUt" as const,
        shellStrake: "Strake 2",
        shellBearing: "N" as const,
        shellLineIndex: 0,
        shellLineLabel: "L1",
        shellAzimuthDeg: 0,
        readingCount: 5,
        shellReadings: ["6.044", "6.101", "6.156", "6.234", "6.240"],
      },
    ];

    setSetup(nextSetup);
    setShowOptional(false);
    setScope(withSample ? sampleScopeState : initialScopeState);
    setShellEntry(
      withSample
        ? {
            ...initialShellEntryState,
            strake: "Strake 1",
            activeLineIndex: 0,
            readings: ["", "", "", "", ""],
          }
        : initialShellEntryState,
    );
    setShellLineCountTouched(false);
    setShellLineCountInput(String(nextRecommendedShellLines));
    setShellLineStart("N");
    setShellLineDirection("clockwise");
    const sampleShellNozzles = withSample
      ? [
          { id: "S1", size: `24"x36"`, azimuthDeg: 0, radialBand: 3, shellCourse: "Course 1" },
          { id: "S2", size: `2"`, azimuthDeg: 60, radialBand: 3, shellCourse: "Course 1" },
          { id: "S3", size: `30"`, azimuthDeg: 120, radialBand: 3, shellCourse: "Course 2" },
          { id: "S4", size: `2"`, azimuthDeg: 180, radialBand: 3, shellCourse: "Course 2" },
          { id: "S5", size: `8"`, azimuthDeg: 240, radialBand: 3, shellCourse: "Course 1" },
          { id: "S6", size: `6"`, azimuthDeg: 300, radialBand: 3, shellCourse: "Course 3" },
        ]
      : buildNozzleRegistry("S", Number(shellNozzleCountInput) || 6);
    const sampleRoofNozzles = withSample
      ? [
          { id: "R1", size: `10"`, azimuthDeg: 0, radialBand: 3 },
          { id: "R2", size: `24"`, azimuthDeg: 40, radialBand: 2 },
          { id: "R3", size: `2"`, azimuthDeg: 80, radialBand: 2 },
          { id: "R4", size: `2"`, azimuthDeg: 120, radialBand: 3 },
          { id: "R5", size: `6"`, azimuthDeg: 160, radialBand: 2 },
          { id: "R6", size: `2"`, azimuthDeg: 200, radialBand: 2 },
          { id: "R7", size: `6"`, azimuthDeg: 240, radialBand: 3 },
          { id: "R8", size: `4"`, azimuthDeg: 280, radialBand: 2 },
          { id: "R9", size: `10"`, azimuthDeg: 320, radialBand: 3 },
        ]
      : buildNozzleRegistry("R", Number(roofNozzleCountInput) || 9);
    setRoofEntry(withSample ? { ...initialRoofEntryState, plateNumber: "1" } : initialRoofEntryState);
    setShellNozzleEntry(
      withSample ? { ...initialShellNozzleEntryState, nozzleId: sampleShellNozzles[0].id, nozzleSize: sampleShellNozzles[0].size } : initialShellNozzleEntryState,
    );
    setRoofNozzleEntry(
      withSample ? { ...initialRoofNozzleEntryState, nozzleId: sampleRoofNozzles[0].id, nozzleSize: sampleRoofNozzles[0].size } : initialRoofNozzleEntryState,
    );
    setShellRecords(withSample ? sampleShellRecords : []);
    setRoofRecords(withSample ? [{ id: createId(), summary: "R-01", subSummary: "5 readings", min: 4.201, max: 4.334, taskKey: "roofUt" }] : []);
    setShellNozzleRecords(
      withSample ? [{ id: createId(), summary: "S1 · Course 1 · N", subSummary: "5 readings", min: 7.155, max: 7.392, taskKey: "shellNozzles" }] : [],
    );
    setRoofNozzleRecords([]);
    setFindings(
      withSample
        ? [
            {
              id: createId(),
              title: "Localized Corrosion / Pitting",
              sourceTaskLabel: "Shell UT",
              sourceTaskKey: "shellUt",
              locationSummary: "Strake 1 · L1 · 0°",
              severity: "Medium",
              status: "Documented",
              photoCount: 2,
              note: "Corrosion patch identified during coarse shell UT.",
              measurements: ["Pit depth: 1.4 mm"],
            },
          ]
        : [],
    );
    setFindingDraft(initialFindingDraft);
    setFindingContext(null);
    setShellLayout(withSample ? { ...initialShellLayoutState, plateWidthMm: "2438", seamOrigin: "0", seamOffsetRule: "half_plate", drawingReference: "SHT-01" } : initialShellLayoutState);
    setShellLayoutConfigured(false);
    setPreciseLocation(initialPreciseLocationState);
    setPendingShellFindingId(null);
    setPendingPreciseReturnScreen("shellUt");
    setShellNozzleRegistry(sampleShellNozzles);
    setRoofNozzleRegistry(sampleRoofNozzles);
    setShellNozzleCountInput(withSample ? String(sampleShellNozzles.length) : "6");
    setRoofNozzleCountInput(withSample ? String(sampleRoofNozzles.length) : "9");
    setRoofTemplateInput(defaultRoofLayoutTemplateForType(nextSetup.roofType));
    setRoofRowCountInput(withSample ? "8" : "");
    setRoofColumnCountInput(withSample ? "8" : "");
    setRoofCenterOpeningInput("22");
    setRoofFeatures(
      withSample
        ? [
            { id: createId(), type: "walkway", label: "WL1", placement: "azimuth_radius", azimuthDeg: 65, radialPercent: 92 },
            { id: createId(), type: "roof_manhole", label: "MH1", placement: "plate_linked", plateNumber: 18 },
            { id: createId(), type: "vent", label: "V1", placement: "plate_linked", plateNumber: 27 },
          ]
        : [],
    );
    setRoofFeatureDraft(initialRoofFeatureDraft);
    setEditingRoofFeatureId(null);
    setShellNozzleConfirmed(false);
    setRoofNozzleConfirmed(false);
    setShellNozzlePlacementMode("sketch");
    setRoofNozzlePlacementMode("sketch");
    setMfl(
      withSample
        ? {
            contractor: "Inspectorate",
            reportReference: "MFL-5470-24",
            reportDate: "2026-04-20",
            coverage: "Full floor scan",
            severity: "Medium",
            attachmentName: "5470-floor-mfl.pdf",
            flaggedAreas: "4",
            summaryNote: "Flagged areas recorded for review. No manual floor map used in MVP.",
          }
        : initialMflState,
    );
    setFindingsTaskFilter("all");
    setFindingsSeverityFilter("all");
    setFindingsStatusFilter("all");
  };

  useEffect(() => {
    const allowed = featurePlacementOptionsForTemplate(roofTemplateInput).map((item) => item.value);
    if (!allowed.includes(roofFeatureDraft.placement)) {
      setRoofFeatureDraft((current) => ({
        ...current,
        placement: roofTemplateInput === "flat_grid" ? "plate_linked" : "center",
      }));
    }
  }, [roofFeatureDraft.placement, roofTemplateInput]);

  const addRoofFeature = () => {
    const fallbackIndex = roofFeatures.length + 1;
    const label = roofFeatureDraft.label.trim() || roofFeatureLabel(roofFeatureDraft.type, fallbackIndex);
    const placement = roofFeatureDraft.placement;
    const nextFeature: RoofFeature = {
      id: editingRoofFeatureId || createId(),
      type: roofFeatureDraft.type,
      label,
      placement,
    };

    if (placement === "plate_linked") {
      const plateNumber = Number(roofFeatureDraft.plateNumber) || 0;
      if (!findRoofCell(roofLayout, plateNumber)) {
        setBanner("Select a valid roof plate for this feature");
        return;
      }
      nextFeature.plateNumber = plateNumber;
    } else if (placement === "azimuth_radius") {
      nextFeature.azimuthDeg = Number(roofFeatureDraft.azimuthDeg) || 0;
      nextFeature.radialPercent = clamp(Number(roofFeatureDraft.radialPercent) || 65, 5, 95);
    } else if (placement === "grid_coordinate") {
      const row = Number(roofFeatureDraft.gridRow) || 0;
      const column = Number(roofFeatureDraft.gridColumn) || 0;
      if (row < 1 || column < 1) {
        setBanner("Grid coordinate needs valid row and column values");
        return;
      }
      nextFeature.gridRow = row;
      nextFeature.gridColumn = column;
    }

    setRoofFeatures((current) =>
      editingRoofFeatureId
        ? current.map((feature) => (feature.id === editingRoofFeatureId ? nextFeature : feature))
        : [...current, nextFeature],
    );
    setRoofFeatureDraft((current) => ({
      ...initialRoofFeatureDraft,
      plateNumber: roofEntry.plateNumber || current.plateNumber,
    }));
    setEditingRoofFeatureId(null);
    setBanner(`${editingRoofFeatureId ? "Updated" : "Added"} roof feature ${label}`);
  };

  const removeRoofFeature = (id: string) => {
    setRoofFeatures((current) => current.filter((feature) => feature.id !== id));
    if (editingRoofFeatureId === id) {
      setEditingRoofFeatureId(null);
      setRoofFeatureDraft(initialRoofFeatureDraft);
    }
    setBanner("Roof feature removed");
  };

  const editRoofFeature = (feature: RoofFeature) => {
    setEditingRoofFeatureId(feature.id);
    setRoofFeatureDraft({
      type: feature.type,
      placement: feature.placement,
      label: feature.label,
      plateNumber: String(feature.plateNumber || roofEntry.plateNumber || 1),
      azimuthDeg: String(feature.azimuthDeg || 0),
      radialPercent: String(feature.radialPercent || 65),
      gridRow: String(feature.gridRow || 1),
      gridColumn: String(feature.gridColumn || 1),
    });
    setBanner(`Editing roof feature ${feature.label}`);
  };

  const cancelRoofFeatureEdit = () => {
    setEditingRoofFeatureId(null);
    setRoofFeatureDraft({
      ...initialRoofFeatureDraft,
      plateNumber: roofEntry.plateNumber || initialRoofFeatureDraft.plateNumber,
    });
    setBanner("Roof feature edit cancelled");
  };

  const handleSaveDraft = () => {
    setBanner("Draft saved locally for the LAIQ-style V2 prototype");
  };

  const updateSetupField = <K extends keyof SetupState>(key: K, value: SetupState[K]) => {
    setSetup((current) => ({ ...current, [key]: value }));
  };

  const updateOptionalField = <K extends keyof OptionalDetails>(key: K, value: OptionalDetails[K]) => {
    setSetup((current) => ({
      ...current,
      optional: { ...current.optional, [key]: value },
    }));
  };

  const toggleScopeTask = (key: ScopeTaskKey) => {
    setScope((current) => ({
      ...current,
      tasks: {
        ...current.tasks,
        [key]: !current.tasks[key],
      },
    }));
  };

  const saveShellRecord = () => {
    const stats = computeStats(shellEntry.readings);
    const currentLine = shellInspectionLines[shellEntry.activeLineIndex];
    if (!shellEntry.strake || !currentLine || !stats) {
      setBanner("Shell UT needs a line, a strake, and at least one reading");
      return;
    }

    const strakeNumber = getStrakeNumber(shellEntry.strake);
    const totalShellCourses = Math.max(Number(setup.totalShellCourses) || 1, 1);
    setShellRecords((current) => [
      {
        id: createId(),
        summary: shellLocationSummary,
        subSummary: `${stats.count} readings`,
        min: stats.min,
        mean: stats.mean,
        max: stats.max,
        taskKey: "shellUt",
        shellStrake: shellEntry.strake,
        shellBearing: currentLine.bearing,
        shellLineIndex: currentLine.index,
        shellLineLabel: currentLine.label,
        shellAzimuthDeg: currentLine.azimuthDeg,
        readingCount: stats.count,
        shellReadings: [...shellEntry.readings],
      },
      ...current.filter(
        (record) => !(record.shellStrake === shellEntry.strake && record.shellLineIndex === currentLine.index),
      ),
    ]);

    const nextStrakeNumber = strakeNumber < totalShellCourses ? strakeNumber + 1 : 1;
    const nextLineIndex = strakeNumber < totalShellCourses
      ? shellEntry.activeLineIndex
      : (shellEntry.activeLineIndex + 1) % Math.max(shellInspectionLines.length, 1);
    const nextLine = shellInspectionLines[nextLineIndex] || currentLine;

    setShellEntry((current) => ({
      ...current,
      strake: `Strake ${nextStrakeNumber}`,
      activeLineIndex: nextLineIndex,
      bearing: nextLine.bearing,
      degreeBearing: formatAzimuth(nextLine.azimuthDeg),
      readings: ["", "", "", "", ""],
      note: "",
      photoCount: 0,
    }));

    setBanner(
      strakeNumber < totalShellCourses
        ? `Saved ${shellLocationSummary}. Next: Strake ${nextStrakeNumber} · ${describeShellLine(currentLine)}`
        : `Saved ${shellLocationSummary}. Next: Strake 1 · ${describeShellLine(nextLine)}`,
    );
  };

  const saveRoofRecord = () => {
    const stats = computeStats(roofEntry.readings);
    if (!roofEntry.plateNumber.trim() || !stats) {
      setBanner("Roof UT needs plate number and at least one reading");
      return;
    }

    setRoofRecords((current) => [
      {
        id: createId(),
        summary: roofEntry.plateNumber.trim(),
        subSummary: `${stats.count} readings`,
        min: stats.min,
        max: stats.max,
        taskKey: "roofUt",
      },
      ...current,
    ]);

    setRoofEntry((current) => ({
      ...current,
      readings: ["", "", "", "", ""],
      note: "",
      photoCount: 0,
    }));

    setBanner(`Saved roof UT at ${roofEntry.plateNumber.trim()}`);
  };

  const saveShellNozzleRecord = () => {
    const stats = computeStats([...shellNozzleEntry.readings, shellNozzleEntry.reinforcementPad]);
    if (!shellNozzleConfirmed || !shellNozzleEntry.nozzleId.trim() || !stats || !currentShellNozzle) {
      setBanner("Shell nozzle UT needs nozzle, location, and at least one reading");
      return;
    }

    setShellNozzleRecords((current) => [
      {
        id: createId(),
        summary: shellNozzleLocationSummary,
        subSummary: `${stats.count} readings`,
        min: stats.min,
        max: stats.max,
        taskKey: "shellNozzles",
      },
      ...current,
    ]);

    const nextId = nextRegistryId(shellNozzleRegistry, shellNozzleEntry.nozzleId);
    const nextItem = shellNozzleRegistry.find((item) => item.id === nextId);
    setShellNozzleConfirmed(false);
    setShellNozzleEntry((current) => ({
      ...current,
      nozzleId: nextId,
      nozzleSize: nextItem?.size ?? current.nozzleSize,
      readings: ["", "", "", ""],
      reinforcementPad: "",
      note: "",
      photoCount: 0,
    }));

    setBanner(`Saved shell nozzle UT for ${shellNozzleLocationSummary}`);
  };

  const saveRoofNozzleRecord = () => {
    const stats = computeStats([...roofNozzleEntry.readings, roofNozzleEntry.reinforcementPad]);
    if (!roofNozzleConfirmed || !roofNozzleEntry.nozzleId.trim() || !stats || !currentRoofNozzle) {
      setBanner("Roof nozzle UT needs nozzle, location, and at least one reading");
      return;
    }

    setRoofNozzleRecords((current) => [
      {
        id: createId(),
        summary: roofNozzleLocationSummary,
        subSummary: `${stats.count} readings`,
        min: stats.min,
        max: stats.max,
        taskKey: "roofNozzles",
      },
      ...current,
    ]);

    const nextId = nextRegistryId(roofNozzleRegistry, roofNozzleEntry.nozzleId);
    const nextItem = roofNozzleRegistry.find((item) => item.id === nextId);
    setRoofNozzleConfirmed(false);
    setRoofNozzleEntry((current) => ({
      ...current,
      nozzleId: nextId,
      nozzleSize: nextItem?.size ?? current.nozzleSize,
      readings: ["", "", "", ""],
      reinforcementPad: "",
      note: "",
      photoCount: 0,
    }));

    setBanner(`Saved roof nozzle UT for ${roofNozzleLocationSummary}`);
  };

  const startFinding = (context: FindingContext) => {
    setFindingContext(context);
    setFindingDraft({
      ...initialFindingDraft,
      findingType: context.typeOptions[0] ?? "",
      shellStrake: context.shellStrake ?? initialFindingDraft.shellStrake,
      shellBearing: context.shellBearing ?? initialFindingDraft.shellBearing,
      shellLineLabel: context.shellLineLabel ?? initialFindingDraft.shellLineLabel,
      shellAzimuthDeg: context.shellAzimuthDeg !== undefined ? formatAzimuth(context.shellAzimuthDeg) : initialFindingDraft.shellAzimuthDeg,
      roofPlate: context.roofPlate ?? "",
      nozzleId: context.nozzleId ?? "",
    });
    if (context.preciseAllowed) {
      setPreciseLocation((current) => ({
        ...initialPreciseLocationState,
        selectedStrake: context.shellStrake ?? current.selectedStrake,
        selectedBearing: context.shellBearing ?? current.selectedBearing,
        plateReference:
          context.shellStrake && context.shellLineLabel
            ? `${context.shellStrake} · ${context.shellLineLabel}${context.shellAzimuthDeg !== undefined ? ` · ${formatAzimuth(context.shellAzimuthDeg)}°` : ""}`
            : "",
      }));
    }
    setScreen(context.screen);
    setBanner("");
  };

  const saveFinding = (withPreciseLocation = false) => {
    if (!findingContext) return;

    if (!findingDraft.photoCount || !findingDraft.findingType || !findingDraft.severity) {
      setBanner("Finding needs at least one photo, a type, and a severity");
      return;
    }

    const id = createId();
    const measurements = [findingDraft.measurementA, findingDraft.measurementB].filter(Boolean);
    const shouldOpenPreciseFlow = withPreciseLocation && findingContext.preciseAllowed;
    const locationSummary = composeFindingLocationSummary(findingContext, findingDraft);

    setFindings((current) => [
      {
        id,
        title: findingDraft.findingType,
        sourceTaskLabel: findingContext.sourceTaskLabel,
        sourceTaskKey: findingContext.sourceTaskKey,
        locationSummary,
        severity: findingDraft.severity as Exclude<Severity, "">,
        status: shouldOpenPreciseFlow ? "Precise location needed" : "Documented",
        photoCount: findingDraft.photoCount,
        note: findingDraft.note || findingDraft.annotation,
        measurements,
      },
      ...current,
    ]);

    setFindingDraft(initialFindingDraft);
    setFindingContext(null);

    if (shouldOpenPreciseFlow) {
      const coarseAzimuth = Number(findingDraft.shellAzimuthDeg) || 0;
      const courseNum = getStrakeNumber(findingDraft.shellStrake || preciseLocation.selectedStrake);
      const derivedPlateIndex =
        shellGeometry && courseNum > 0
          ? Math.min(
              Math.floor(
                (((coarseAzimuth - courseSeamOrigin(courseNum - 1, shellGeometry.seamOriginC1Deg, shellGeometry.offsetDeg, shellGeometry.seamOffsetRule)) % 360 + 360) % 360) /
                  shellGeometry.plateSpanDeg,
              ) + 1,
              shellGeometry.platesPerCourse,
            )
          : preciseLocation.selectedPlateIndex;
      setPendingShellFindingId(id);
      setPendingPreciseReturnScreen(findingContext.returnScreen);
      setPreciseLocation((current) => ({
        ...current,
        selectedStrake: findingDraft.shellStrake || current.selectedStrake,
        selectedBearing: bearingFromAzimuth(coarseAzimuth),
        selectedPlateIndex: derivedPlateIndex,
        plateReference:
          shellGeometry
            ? `C${courseNum} · Plate ${String(derivedPlateIndex).padStart(2, "0")}`
            : `${findingDraft.shellStrake || current.selectedStrake} · ${findingDraft.shellLineLabel || current.selectedBearing}${findingDraft.shellAzimuthDeg ? ` · ${findingDraft.shellAzimuthDeg}°` : ""}`,
      }));
      setScreen(shellLayoutConfigured ? "shellPreciseLocation" : "shellLayout");
      setBanner(
        shellLayoutConfigured
          ? "Shell finding saved. Add precise location next."
          : "Confirm shell layout first, then continue to precise location.",
      );
      return;
    }

    setScreen(findingContext.returnScreen);
    setBanner(`Saved finding from ${findingContext.sourceTaskLabel}`);
  };

  const saveShellLayout = () => {
    const customOkay = shellLayout.seamOffsetRule !== "custom" || shellLayout.customOffset.trim().length > 0;
    if (!shellLayout.plateWidthMm.trim() || !shellLayout.seamOrigin.trim() || !customOkay) {
      setBanner("Shell layout needs plate width, seam origin, and offset rule");
      return;
    }

    setShellLayoutConfigured(true);
    setScreen("shellPreciseLocation");
    setBanner("Shell layout saved for this inspection");
  };

  const savePreciseLocation = () => {
    if (!pendingShellFindingId) {
      setBanner("No shell finding is waiting for precise location");
      return;
    }

    const preciseSummary =
      preciseLocation.method === "tap_layout"
        ? shellGeometry && preciseLocation.selectedPlateIndex > 0
          ? (() => {
              const courseNum = getStrakeNumber(preciseLocation.selectedStrake);
              const seamOrigin = courseSeamOrigin(courseNum - 1, shellGeometry.seamOriginC1Deg, shellGeometry.offsetDeg, shellGeometry.seamOffsetRule);
              const azimuth = ((seamOrigin + (preciseLocation.selectedPlateIndex - 0.5) * shellGeometry.plateSpanDeg) % 360 + 360) % 360;
              return `C${courseNum} · Plate ${String(preciseLocation.selectedPlateIndex).padStart(2, "0")} · ${azimuth.toFixed(1)}°`;
            })()
          : ""
        : preciseLocation.method === "manual_xy"
          ? preciseLocation.x && preciseLocation.y
            ? `X ${preciseLocation.x} / Y ${preciseLocation.y}`
            : ""
          : preciseLocation.plateReference
            ? `${preciseLocation.plateReference}${preciseLocation.seamRelation ? ` · ${preciseLocation.seamRelation}` : ""}`
            : "";

    if (!preciseSummary) {
      setBanner("Precise location needs a valid map point, X/Y value, or plate/seam reference");
      return;
    }

    setFindings((current) =>
      current.map((finding) =>
        finding.id === pendingShellFindingId
          ? {
              ...finding,
              status: "Documented",
              locationSummary: `${finding.locationSummary} · ${preciseSummary}`,
            }
          : finding,
      ),
    );

    setPendingShellFindingId(null);
    setPreciseLocation(initialPreciseLocationState);
    setScreen(pendingPreciseReturnScreen);
    setBanner("Precise shell location saved");
  };

  const saveMflImport = () => {
    if (!mfl.contractor.trim() || !mfl.reportReference.trim() || !mfl.reportDate || !mfl.attachmentName.trim()) {
      setBanner("Bottom MFL needs contractor, report reference, date, and attachment");
      return;
    }

    setScreen("taskBoard");
    setBanner("Bottom MFL import details saved");
  };

  const generateShellNozzles = () => {
    if (!shellNozzleParentReady) {
      setBanner("Save shell UT first, then define shell nozzles");
      return;
    }
    const registry = buildNozzleRegistry("S", Number(shellNozzleCountInput) || 1);
    setShellNozzleRegistry(registry);
    setShellNozzleConfirmed(false);
    setShellNozzleEntry((current) => ({
      ...current,
      nozzleId: registry[0]?.id ?? current.nozzleId,
      nozzleSize: registry[0]?.size ?? current.nozzleSize,
    }));
    setBanner("Shell nozzle IDs generated");
  };

  const generateRoofNozzles = () => {
    if (!roofNozzleParentReady) {
      setBanner("Save roof UT first, then define roof nozzles");
      return;
    }
    const registry = buildNozzleRegistry("R", Number(roofNozzleCountInput) || 1);
    setRoofNozzleRegistry(registry);
    setRoofNozzleConfirmed(false);
    setRoofNozzleEntry((current) => ({
      ...current,
      nozzleId: registry[0]?.id ?? current.nozzleId,
      nozzleSize: registry[0]?.size ?? current.nozzleSize,
    }));
    setBanner("Roof nozzle IDs generated");
  };

  const updateShellNozzleRegistry = (id: string, patch: Partial<PrototypeNozzleRegistryItem>) => {
    setShellNozzleConfirmed(false);
    setShellNozzleRegistry((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const updateRoofNozzleRegistry = (id: string, patch: Partial<PrototypeNozzleRegistryItem>) => {
    setRoofNozzleConfirmed(false);
    setRoofNozzleRegistry((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const selectShellNozzle = (id: string) => {
    const selected = shellNozzleRegistry.find((item) => item.id === id);
    setShellNozzleConfirmed(false);
    setShellNozzleEntry((current) => ({
      ...current,
      nozzleId: id,
      nozzleSize: selected?.size ?? current.nozzleSize,
    }));
  };

  const selectRoofNozzle = (id: string) => {
    const selected = roofNozzleRegistry.find((item) => item.id === id);
    setRoofNozzleConfirmed(false);
    setRoofNozzleEntry((current) => ({
      ...current,
      nozzleId: id,
      nozzleSize: selected?.size ?? current.nozzleSize,
    }));
  };

  const confirmShellNozzle = () => {
    if (!shellNozzleParentReady) {
      setBanner("Complete shell UT first before confirming shell nozzles");
      return;
    }
    if (!currentShellNozzle || !shellNozzleEntry.nozzleId.trim()) {
      setBanner("Select a shell nozzle first");
      return;
    }
    setShellNozzleConfirmed(true);
    setBanner(`Shell nozzle confirmed at ${shellNozzleLocationSummary}`);
  };

  const confirmRoofNozzle = () => {
    if (!roofNozzleParentReady) {
      setBanner("Complete roof UT first before confirming roof nozzles");
      return;
    }
    if (!currentRoofNozzle || !roofNozzleEntry.nozzleId.trim()) {
      setBanner("Select a roof nozzle first");
      return;
    }
    setRoofNozzleConfirmed(true);
    setBanner(`Roof nozzle confirmed at ${roofNozzleLocationSummary}`);
  };

  const getTaskStatus = (taskKey: ScopeTaskKey) => {
    const taskFindings = findings.filter((finding) => finding.sourceTaskKey === taskKey);
    const hasAttention = taskFindings.some((finding) => finding.status !== "Documented");

    switch (taskKey) {
      case "shellUt":
        if (shellRecords.length === 0) return "Not started";
        return hasAttention ? "Needs attention" : "Ready";
      case "roofUt":
        if (roofRecords.length === 0) return "Not started";
        return hasAttention ? "Needs attention" : "Ready";
      case "shellNozzles":
        if (shellNozzleRecords.length === 0) return "Not started";
        return hasAttention ? "Needs attention" : "Ready";
      case "roofNozzles":
        if (roofNozzleRecords.length === 0) return "Not started";
        return hasAttention ? "Needs attention" : "Ready";
      case "bottomMfl":
        if (!mfl.attachmentName) return "Not started";
        return "Ready";
      case "findingsPhotos":
        if (findings.length === 0) return "Not started";
        return findingSummary.followUp > 0 ? "Needs attention" : "Ready";
      default:
        return "Not started";
    }
  };

  const visibleTaskCards = scopeTaskDefinitions.filter((task) => scope.tasks[task.key]);

  const renderHome = () => (
    <Stage
      screen="home"
      title="Tank Inspection"
      subtitle="Simple field capture."
      banner={banner}
    >
      <ScreenCard
        kicker="Start"
        title="Choose a path"
      >
        <div className="laiq-record-list laiq-record-list-padded">
          <ActionRow
            label="New Inspection"
            description="Start from setup with an empty V2 flow."
            meta={["Begin at setup", "Required fields first"]}
            status="Fresh"
            actionLabel="Open"
            onClick={() => {
              resetPrototypeState(false);
              setScreen("setup");
              setBanner("");
            }}
          />
          <ActionRow
            label="Resume Draft"
            description="Open a sample draft and continue from the task board."
            meta={["Prefilled sample data", "Task board ready"]}
            status="Draft"
            actionLabel="Open"
            onClick={() => {
              resetPrototypeState(true);
              setScreen("taskBoard");
              setBanner("Sample draft loaded");
            }}
          />
        </div>
      </ScreenCard>

      <ScreenCard
        kicker="Recent"
        title="Recent prototype inspections"
      >
        <div className="laiq-record-list laiq-record-list-padded">
          {recentInspectionCards.map((item) => (
            <div key={`${item.tankNumber}-${item.status}`} className="laiq-record-row">
              <div className="laiq-record-copy">
                <strong>{item.tankNumber}</strong>
                <span>
                  {item.client} · {item.editedAt}
                </span>
              </div>
              <StatusBadge status={item.status} />
            </div>
          ))}
        </div>
      </ScreenCard>
    </Stage>
  );

  const renderSetup = () => (
    <Stage
      screen="setup"
      title="Tank Inspection Setup"
      subtitle="Required tank info."
      banner={banner}
    >
      <ScreenCard
        kicker="Required Tank Info"
        title="New Inspection"
        topBar={<TopBar onBack={() => setScreen("home")} onSaveDraft={handleSaveDraft} backLabel="Home" />}
        footer={
          <div className="laiq-footer-bar">
            <div className="laiq-status-block">
              <span className="laiq-status-label">Prototype Status</span>
              <strong>Next screen: Inspection Scope</strong>
            </div>
            <div className="laiq-footer-actions">
              <button type="button" className="laiq-button laiq-button-secondary" onClick={handleSaveDraft}>
                Save Draft
              </button>
              <button
                type="button"
                className="laiq-button laiq-button-primary"
                disabled={!setupIsValid}
                onClick={() => {
                  if (!setupIsValid) return;
                  setScreen("scope");
                  setBanner("");
                }}
              >
                Continue
              </button>
            </div>
          </div>
        }
      >
        <div className="laiq-form-grid">
          <section className="laiq-form-block">
            <div className="laiq-block-heading">
              <h3>Tank Identity</h3>
              <p>These are the primary fields inspectors use to identify the tank in the field.</p>
            </div>
            <div className="laiq-fields">
              <Field label="Client" required>
                <input className="laiq-input" value={setup.client} onChange={(e) => updateSetupField("client", e.target.value)} placeholder="e.g. Petronas Carigali" />
              </Field>
              <Field label="Location" required>
                <input className="laiq-input" value={setup.location} onChange={(e) => updateSetupField("location", e.target.value)} placeholder="e.g. Kerteh, Terengganu" />
              </Field>
              <Field label="Tank Number" required>
                <input className="laiq-input" value={setup.tankNumber} onChange={(e) => updateSetupField("tankNumber", e.target.value)} placeholder="e.g. 5470" />
              </Field>
            </div>
          </section>

          <section className="laiq-form-block">
            <div className="laiq-block-heading">
              <h3>Dimensions</h3>
              <p>Only the dimensions required to begin the MVP flow are shown up front.</p>
            </div>
            <div className="laiq-fields laiq-fields-compact">
              <Field label="Diameter (m)" required>
                <input className="laiq-input" inputMode="decimal" value={setup.diameterM} onChange={(e) => updateSetupField("diameterM", e.target.value)} placeholder="e.g. 26.5" />
              </Field>
              <Field label="Height (m)" required>
                <input className="laiq-input" inputMode="decimal" value={setup.heightM} onChange={(e) => updateSetupField("heightM", e.target.value)} placeholder="e.g. 10.0" />
              </Field>
              <Field label="Total Shell Courses" required>
                <input className="laiq-input" inputMode="numeric" value={setup.totalShellCourses} onChange={(e) => updateSetupField("totalShellCourses", e.target.value)} placeholder="e.g. 6" />
              </Field>
            </div>
          </section>

          <section className="laiq-form-block">
            <div className="laiq-block-heading">
              <h3>Roof Configuration</h3>
              <p>The selected roof topology will drive later layout options, not this screen.</p>
            </div>
            <div className="laiq-fields">
              <Field label="Roof Type" required>
                <select className="laiq-input" value={setup.roofType} onChange={(e) => updateSetupField("roofType", e.target.value as RoofTypeOption | "")}>
                  <option value="">Select roof type</option>
                  {roofTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              {setup.roofType === "other" ? (
                <Field label="Describe Roof Type" required>
                  <input className="laiq-input" value={setup.customRoofType} onChange={(e) => updateSetupField("customRoofType", e.target.value)} placeholder="Enter roof description" />
                </Field>
              ) : null}
            </div>
          </section>
        </div>

        <section className="laiq-expandable">
          <button type="button" className="laiq-expandable-toggle" onClick={() => setShowOptional((current) => !current)}>
            <span>
              <strong>More Tank Details</strong>
              <small>Optional fields hidden by default</small>
            </span>
            <span className="laiq-expand-icon">{showOptional ? "−" : "+"}</span>
          </button>

          {showOptional ? (
            <div className="laiq-optional-grid">
              <Field label="Client Representative">
                <input className="laiq-input" value={setup.optional.clientRepresentative} onChange={(e) => updateOptionalField("clientRepresentative", e.target.value)} />
              </Field>
              <Field label="Field / Lease Name">
                <input className="laiq-input" value={setup.optional.fieldLeaseName} onChange={(e) => updateOptionalField("fieldLeaseName", e.target.value)} />
              </Field>
              <Field label="Year Built">
                <input className="laiq-input" value={setup.optional.yearBuilt} onChange={(e) => updateOptionalField("yearBuilt", e.target.value)} />
              </Field>
              <Field label="Original Manufacturer">
                <input className="laiq-input" value={setup.optional.originalManufacturer} onChange={(e) => updateOptionalField("originalManufacturer", e.target.value)} />
              </Field>
              <Field label="Original Construction Standard">
                <input className="laiq-input" value={setup.optional.originalConstructionStandard} onChange={(e) => updateOptionalField("originalConstructionStandard", e.target.value)} />
              </Field>
              <Field label="Material Spec">
                <input className="laiq-input" value={setup.optional.materialSpec} onChange={(e) => updateOptionalField("materialSpec", e.target.value)} />
              </Field>
              <Field label="Construction Type">
                <input className="laiq-input" value={setup.optional.constructionType} onChange={(e) => updateOptionalField("constructionType", e.target.value)} />
              </Field>
              <Field label="Drawing Ref">
                <input className="laiq-input" value={setup.optional.drawingRef} onChange={(e) => updateOptionalField("drawingRef", e.target.value)} />
              </Field>
              <Field label="Service Height">
                <input className="laiq-input" value={setup.optional.serviceHeight} onChange={(e) => updateOptionalField("serviceHeight", e.target.value)} />
              </Field>
              <Field label="Product Stored">
                <input className="laiq-input" value={setup.optional.productStored} onChange={(e) => updateOptionalField("productStored", e.target.value)} />
              </Field>
              <Field label="Specific Gravity">
                <input className="laiq-input" value={setup.optional.specificGravity} onChange={(e) => updateOptionalField("specificGravity", e.target.value)} />
              </Field>
              <Field label="Design Temp">
                <input className="laiq-input" value={setup.optional.designTemp} onChange={(e) => updateOptionalField("designTemp", e.target.value)} />
              </Field>
              <Field label="Internal Pressure">
                <input className="laiq-input" value={setup.optional.internalPressure} onChange={(e) => updateOptionalField("internalPressure", e.target.value)} />
              </Field>
              <Field label="Wind Girder">
                <select className="laiq-input" value={setup.optional.windGirder} onChange={(e) => updateOptionalField("windGirder", e.target.value)}>
                  {yesNoOptions.map((option) => (
                    <option key={option || "empty"} value={option}>
                      {option || "Select"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Insulated">
                <select className="laiq-input" value={setup.optional.insulated} onChange={(e) => updateOptionalField("insulated", e.target.value)}>
                  {yesNoOptions.map((option) => (
                    <option key={option || "empty"} value={option}>
                      {option || "Select"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Stiffener">
                <select className="laiq-input" value={setup.optional.stiffener} onChange={(e) => updateOptionalField("stiffener", e.target.value)}>
                  {yesNoOptions.map((option) => (
                    <option key={option || "empty"} value={option}>
                      {option || "Select"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Total Roof Plates">
                <input className="laiq-input" value={setup.optional.totalRoofPlates} onChange={(e) => updateOptionalField("totalRoofPlates", e.target.value)} />
              </Field>
            </div>
          ) : null}
        </section>
      </ScreenCard>
    </Stage>
  );

  const renderScope = () => (
    <Stage
      screen="scope"
      title="Inspection Scope"
      subtitle="Set reference and tasks."
      banner={banner}
    >
      <ScreenCard
        kicker="Reference + Scope"
        title="Choose inspection scope"
        topBar={<TopBar onBack={() => setScreen("setup")} onSaveDraft={handleSaveDraft} />}
        footer={
          <div className="laiq-footer-bar">
            <div className="laiq-status-block">
              <span className="laiq-status-label">Prototype Status</span>
              <strong>Next screen: Task Board</strong>
            </div>
            <div className="laiq-footer-actions">
              <button type="button" className="laiq-button laiq-button-secondary" onClick={handleSaveDraft}>
                Save Draft
              </button>
              <button
                type="button"
                className="laiq-button laiq-button-primary"
                disabled={!scopeIsValid}
                onClick={() => {
                  if (!scopeIsValid) return;
                  setScreen("taskBoard");
                  setBanner("");
                }}
              >
                Continue
              </button>
            </div>
          </div>
        }
      >
        <div className="laiq-form-grid laiq-form-grid-two">
          <section className="laiq-form-block">
            <div className="laiq-block-heading">
              <h3>Reference</h3>
              <p>Choose the same 0° reference the site drawing or field team will use. This is the V1 carry-forward behavior.</p>
            </div>
            <div className="laiq-fields">
              <Field label="Reference Direction" required>
                <select
                  className="laiq-input"
                  value={scope.referenceDirection}
                  onChange={(e) => setScope((current) => ({ ...current, referenceDirection: e.target.value as ReferenceDirection }))}
                >
                  <option value="">Select reference</option>
                  {referenceDirectionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              {scope.referenceDirection === "tank_north" ? (
                <Field label="Tank North Offset From True North (°)" required>
                  <input
                    className="laiq-input"
                    inputMode="decimal"
                    value={scope.tankNorthOffset}
                    onChange={(e) => setScope((current) => ({ ...current, tankNorthOffset: e.target.value }))}
                    placeholder="e.g. 18"
                  />
                </Field>
              ) : null}
              {scope.referenceDirection === "site_reference_marker" ? (
                <>
                  <Field label="Reference Marker Description" required>
                    <input
                      className="laiq-input"
                      value={scope.referenceMarkerDescription}
                      onChange={(e) => setScope((current) => ({ ...current, referenceMarkerDescription: e.target.value }))}
                      placeholder="e.g. Ladder side marker"
                    />
                  </Field>
                  <Field label="Marker Bearing From True North (°)" required hint="Needed so the same physical marker can be aligned later in shell mapping.">
                    <input
                      className="laiq-input"
                      inputMode="decimal"
                      value={scope.referenceMarkerBearing}
                      onChange={(e) => setScope((current) => ({ ...current, referenceMarkerBearing: e.target.value }))}
                      placeholder="e.g. 92"
                    />
                  </Field>
                </>
              ) : null}
              <Field label="Shell Location Style" required hint="Compass is recommended for routine coarse shell UT.">
                <select
                  className="laiq-input"
                  value={scope.shellLocationStyle}
                  onChange={(e) => setScope((current) => ({ ...current, shellLocationStyle: e.target.value as ShellLocationStyle }))}
                >
                  {shellLocationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <CompassPreview
                referenceDirection={scope.referenceDirection}
                shellLocationStyle={scope.shellLocationStyle}
                tankNorthOffset={scope.tankNorthOffset}
                markerBearing={scope.referenceMarkerBearing}
                markerDescription={scope.referenceMarkerDescription}
              />
            </div>
          </section>

          <section className="laiq-form-block">
            <div className="laiq-block-heading">
              <h3>Tasks In Scope</h3>
              <p>Only active tasks should appear later. Use compact rows instead of large cards.</p>
            </div>
            <div className="laiq-toggle-list">
              {scopeTaskDefinitions.map((task) => (
                <TaskToggleRow
                  key={task.key}
                  label={task.label}
                  helper={task.helper}
                  active={scope.tasks[task.key]}
                  onToggle={() => toggleScopeTask(task.key)}
                />
              ))}
            </div>
          </section>
        </div>
      </ScreenCard>
    </Stage>
  );

  const renderTaskBoard = () => (
    <Stage
      screen="taskBoard"
      title={`Tank ${setup.tankNumber || "Draft"}`}
      subtitle="Open a task."
      banner={banner}
    >
      <ScreenCard
        kicker="Job Summary"
        title="Active inspection"
        topBar={<TopBar onBack={() => setScreen("scope")} onSaveDraft={handleSaveDraft} backLabel="Scope" />}
      >
        <div className="laiq-form-grid laiq-form-grid-two">
          <div className="laiq-form-block">
            <div className="laiq-chip-row">
              <div className="laiq-info-chip">
                <span>Client</span>
                <strong>{setup.client || "Not set"}</strong>
              </div>
              <div className="laiq-info-chip">
                <span>Location</span>
                <strong>{setup.location || "Not set"}</strong>
              </div>
              <div className="laiq-info-chip">
                <span>Roof Type</span>
                <strong>{setup.roofType ? roofTypeOptions.find((option) => option.value === setup.roofType)?.label : "Not set"}</strong>
              </div>
              <div className="laiq-info-chip">
                <span>Inspection Date</span>
                <strong>{setup.inspectionDate}</strong>
              </div>
            </div>
          </div>
          <div className="laiq-form-block">
            <div className="laiq-mini-grid">
              <MetricCard label="Completed Tasks" value={`${completedTaskCount}`} />
              <MetricCard label="Warnings" value={`${reviewWarnings.length}`} />
              <MetricCard label="Findings" value={`${findings.length}`} />
              <MetricCard label="Scope Items" value={`${visibleTaskCards.length}`} />
            </div>
          </div>
        </div>

        <div className="laiq-record-list laiq-record-list-padded">
          {visibleTaskCards.map((task) => {
            const status = getTaskStatus(task.key);
            const onClick =
              task.key === "shellUt"
                ? () => setScreen("shellUt")
                : task.key === "roofUt"
                  ? () => setScreen("roofUt")
                  : task.key === "shellNozzles"
                    ? () => setScreen("shellNozzleUt")
                    : task.key === "roofNozzles"
                      ? () => setScreen("roofNozzleUt")
                      : task.key === "bottomMfl"
                        ? () => setScreen("bottomMfl")
                      : () => setScreen("findings");
            const meta =
              task.key === "shellUt"
                ? [`${shellRecords.length} records`, `${findings.filter((finding) => finding.sourceTaskKey === "shellUt").length} findings`]
                : task.key === "roofUt"
                  ? [`${roofRecords.length} records`, `${findings.filter((finding) => finding.sourceTaskKey === "roofUt").length} findings`]
                  : task.key === "shellNozzles"
                    ? [`${shellNozzleRecords.length} records`, `${findings.filter((finding) => finding.sourceTaskKey === "shellNozzles").length} findings`]
                    : task.key === "roofNozzles"
                      ? [`${roofNozzleRecords.length} records`, `${findings.filter((finding) => finding.sourceTaskKey === "roofNozzles").length} findings`]
                      : task.key === "bottomMfl"
                        ? [mfl.attachmentName ? "Attachment loaded" : "No attachment", mfl.flaggedAreas ? `${mfl.flaggedAreas} flagged areas` : "No summary"]
                      : [`${findings.length} findings`, `${findingSummary.high} high severity`];

            return (
              <ActionRow
                key={task.key}
                label={task.label}
                description={task.helper}
                status={status}
                meta={meta}
                actionLabel={status === "Not started" ? "Start" : "Continue"}
                onClick={onClick}
              />
            );
          })}

          <ActionRow
            label="Review"
            status={reviewWarnings.length > 0 ? "Needs attention" : completedTaskCount > 0 ? "Ready" : "Not started"}
            description="Check missing items and warnings before export."
            meta={[`${reviewWarnings.length} warnings`, `${completedTaskCount} completed tasks`]}
            actionLabel="Open"
            onClick={() => setScreen("review")}
          />
        </div>
      </ScreenCard>
    </Stage>
  );

  const renderShellUt = () => (
    <Stage
      screen="shellUt"
      title="Shell UT"
      subtitle=""
      banner={banner}
    >
      <ScreenCard
        kicker="Routine Entry"
        title="Shell thickness measurements"
        hideSectionHeader
        topBar={<TopBar onBack={() => setScreen("taskBoard")} backLabel="Task Board" />}
        footer={
          <div className="laiq-footer-bar">
            <div className="laiq-status-block">
              <span className="laiq-status-label">Context</span>
              <strong>
                {`${shellLineCount} lines · ${shellLineSpacingM ? `${shellLineSpacingM.toFixed(2)} m spacing` : "spacing pending"} · ${totalShellCourses} shell courses`}
              </strong>
            </div>
            <div className="laiq-footer-actions laiq-footer-actions-wide">
              <button type="button" className="laiq-button laiq-button-secondary" onClick={() => setScreen("taskBoard")}>
                Back to Tasks
              </button>
              <button
                type="button"
                className="laiq-button laiq-button-secondary"
                onClick={() =>
                  startFinding({
                    screen: "shellFinding",
                    returnScreen: "shellUt",
                    sourceTaskLabel: "Shell UT",
                    sourceTaskKey: "shellUt",
                    locationSummary: shellLocationSummary,
                    preciseAllowed: true,
                    typeOptions: shellFindingTypes,
                    shellStrake: shellEntry.strake,
                    shellBearing: currentShellLine?.bearing || shellEntry.bearing,
                    shellLineLabel: currentShellLine?.label,
                    shellAzimuthDeg: currentShellLine?.azimuthDeg,
                  })
                }
              >
                Add Finding Here
              </button>
              <button type="button" className="laiq-button laiq-button-primary" onClick={saveShellRecord}>
                Save & Next
              </button>
            </div>
          </div>
        }
      >
        <div className="laiq-shell-ut-stack">
          <section className="laiq-form-block">
            <div className="laiq-shell-ut-controls">
              <div className="laiq-shell-line-settings">
                <Field label="Inspection Lines">
                  <input
                    className="laiq-input"
                    inputMode="numeric"
                    value={shellLineCountInput}
                    onChange={(e) => {
                      setShellLineCountTouched(true);
                      setShellLineCountInput(e.target.value);
                    }}
                  />
                </Field>
                <Field label="Start From">
                  <SegmentedControl value={shellLineStart} options={shellLineStartOptions} onChange={setShellLineStart} />
                </Field>
                <Field label="Direction">
                  <SegmentedControl value={shellLineDirection} options={shellLineDirectionOptions} onChange={setShellLineDirection} />
                </Field>
              </div>

              <div className="laiq-shell-ut-summary">
                <div className="laiq-shell-ut-summary-chip">
                  <span>Recommended</span>
                  <strong>{`${recommendedLines} lines`}</strong>
                </div>
                <div className="laiq-shell-ut-summary-chip">
                  <span>Circumference</span>
                  <strong>{shellCircumferenceM ? `${shellCircumferenceM.toFixed(1)} m` : "—"}</strong>
                </div>
                <div className="laiq-shell-ut-summary-chip">
                  <span>Spacing</span>
                  <strong>{shellLineSpacingM ? `${shellLineSpacingM.toFixed(2)} m` : "—"}</strong>
                </div>
                <div className="laiq-shell-ut-summary-chip laiq-shell-ut-summary-chip-location">
                  <span>Next After Save</span>
                  <strong>{nextShellSummary}</strong>
                </div>
              </div>

              <PrototypeShellLinePlanner
                lines={shellInspectionLines}
                activeLineIndex={shellEntry.activeLineIndex}
                activeStrake={shellEntry.strake}
                totalShellCourses={totalShellCourses}
                records={shellRecords}
                onSelect={(lineIndex, strake) =>
                  setShellEntry((current) => ({
                    ...current,
                    activeLineIndex: lineIndex,
                    strake,
                    bearing: shellInspectionLines[lineIndex]?.bearing ?? current.bearing,
                    degreeBearing: shellInspectionLines[lineIndex] ? formatAzimuth(shellInspectionLines[lineIndex].azimuthDeg) : current.degreeBearing,
                  }))
                }
              />

              <div className="laiq-shell-ut-summary">
                <div className="laiq-shell-ut-summary-chip laiq-shell-ut-summary-chip-location">
                  <span>Current</span>
                  <strong>{shellLocationSummary}</strong>
                </div>
                <div className="laiq-shell-ut-summary-chip">
                  <span>Min</span>
                  <strong>{shellStats ? formatMetric(shellStats.min) : "—"}</strong>
                </div>
                <div className="laiq-shell-ut-summary-chip">
                  <span>Mean</span>
                  <strong>{shellStats ? formatMetric(shellStats.mean) : "—"}</strong>
                </div>
                <div className="laiq-shell-ut-summary-chip">
                  <span>Max</span>
                  <strong>{shellStats ? formatMetric(shellStats.max) : "—"}</strong>
                </div>
              </div>

              <div className="laiq-shell-reading-grid">
                {shellEntry.readings.map((reading, index) => (
                  <Field key={`shell-reading-${index}`} label={`R${index + 1}`}>
                    <input
                      className="laiq-input"
                      inputMode="decimal"
                      value={reading}
                      onChange={(e) =>
                        setShellEntry((current) => ({
                          ...current,
                          readings: current.readings.map((item, itemIndex) => (itemIndex === index ? e.target.value : item)),
                        }))
                      }
                    />
                  </Field>
                ))}
              </div>

              <div className="laiq-shell-note-photo">
                <Field label="Note">
                  <input className="laiq-input" value={shellEntry.note} onChange={(e) => setShellEntry((current) => ({ ...current, note: e.target.value }))} placeholder="Optional" />
                </Field>
                <div className="laiq-photo-panel">
                  <div>
                    <strong>Photo</strong>
                    <span>{shellEntry.photoCount} attached</span>
                  </div>
                  <button type="button" className="laiq-button laiq-button-secondary" onClick={() => setShellEntry((current) => ({ ...current, photoCount: current.photoCount + 1 }))}>
                    Add Photo
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="laiq-record-list laiq-record-list-padded">
          <div className="laiq-list-heading">
            <h3>Recent</h3>
          </div>
          {shellRecords.length === 0 ? (
            <div className="laiq-empty-state">No shell UT records yet.</div>
          ) : (
            shellRecords.slice(0, 3).map((record) => (
              <div key={record.id} className="laiq-record-row">
                <div className="laiq-record-copy">
                  <strong>{record.summary}</strong>
                  <span>
                    {record.subSummary} · Min {formatMetric(record.min)} · Max {formatMetric(record.max)}
                  </span>
                </div>
                <button type="button" className="laiq-topbar-button" onClick={() => setBanner(`Edit state not implemented for ${record.summary} in prototype`)}>
                  Edit
                </button>
              </div>
            ))
          )}
        </div>
      </ScreenCard>
    </Stage>
  );

  const renderFindingScreen = ({
    screenKey,
    title,
    onCancel,
    preciseAllowed,
  }: {
    screenKey: PrototypeScreen;
    title: string;
    onCancel: () => void;
    preciseAllowed: boolean;
  }) => (
    <Stage
      screen={screenKey}
      title={title}
      subtitle="Capture and save."
      banner={banner}
    >
      {(() => {
        const locationSummary = findingContext ? composeFindingLocationSummary(findingContext, findingDraft) : "—";
        const findingTypeChoices = (findingContext?.typeOptions ?? []).map((option) => ({
          value: option,
          label: option,
        }));

        return (
      <ScreenCard
        kicker="Inline Finding"
        title="Finding"
        topBar={<TopBar onBack={onCancel} backLabel="Back to Task" />}
        footer={
          <div className="laiq-footer-bar">
            <div className="laiq-status-block">
              <span className="laiq-status-label">Linked Context</span>
              <strong>{locationSummary}</strong>
            </div>
            <div className="laiq-footer-actions laiq-footer-actions-wide">
              <button type="button" className="laiq-button laiq-button-secondary" onClick={onCancel}>
                Cancel
              </button>
              {preciseAllowed ? (
                <button type="button" className="laiq-button laiq-button-secondary" onClick={() => saveFinding(true)}>
                  Add Precise Location
                </button>
              ) : null}
              <button type="button" className="laiq-button laiq-button-primary" onClick={() => saveFinding(false)}>
                Save Finding
              </button>
            </div>
          </div>
        }
      >
        <div className="laiq-form-grid">
          <section className="laiq-form-block">
            <div className="laiq-block-heading">
              <h3>1. Capture Photo</h3>
            </div>
            <div className="laiq-photo-panel">
              <div>
                <strong>Photos attached</strong>
                <span>{findingDraft.photoCount}</span>
              </div>
              <div className="laiq-inline-actions">
                <button type="button" className="laiq-button laiq-button-secondary" onClick={() => setFindingDraft((current) => ({ ...current, photoCount: current.photoCount + 1 }))}>
                  Take Photo
                </button>
                <button type="button" className="laiq-button laiq-button-secondary" onClick={() => setFindingDraft((current) => ({ ...current, photoCount: current.photoCount + 1 }))}>
                  Choose Existing Photo
                </button>
              </div>
            </div>
            <FindingPhotoCanvas hasPhoto={findingDraft.photoCount > 0} annotationTool={findingDraft.annotationTool} annotation={findingDraft.annotation} />
          </section>

          <section className="laiq-form-block">
            <div className="laiq-block-heading">
              <h3>2. Annotate</h3>
            </div>
            <Field label="Sketch Tool">
              <SegmentedControl
                value={findingDraft.annotationTool}
                options={annotationToolOptions}
                onChange={(value) => setFindingDraft((current) => ({ ...current, annotationTool: value }))}
              />
            </Field>
            <Field label="Annotation">
              <textarea
                className="laiq-input laiq-textarea"
                value={findingDraft.annotation}
                onChange={(e) => setFindingDraft((current) => ({ ...current, annotation: e.target.value }))}
                placeholder="Arrow, circle, crack path, or short annotation note"
              />
            </Field>
          </section>
          <section className="laiq-form-block">
            <div className="laiq-block-heading">
              <h3>3. Define Finding</h3>
            </div>
            <div className="laiq-fields">
              <Field label="Finding Type" required>
                <ChoiceList
                  value={findingDraft.findingType}
                  options={findingTypeChoices}
                  onChange={(value) => setFindingDraft((current) => ({ ...current, findingType: value }))}
                />
              </Field>
              <Field label="Severity" required>
                <SegmentedControl
                  value={findingDraft.severity || "Low"}
                  options={severityOptions.map((option) => ({ value: option, label: option }))}
                  onChange={(value) => setFindingDraft((current) => ({ ...current, severity: value }))}
                />
              </Field>
              <Field label="Short Note">
                <textarea className="laiq-input laiq-textarea" value={findingDraft.note} onChange={(e) => setFindingDraft((current) => ({ ...current, note: e.target.value }))} placeholder="Describe what was observed" />
              </Field>
            </div>
          </section>

          <section className="laiq-form-block">
            <div className="laiq-block-heading">
              <h3>4. Location</h3>
            </div>
            <div className="laiq-fields">
              {findingContext?.sourceTaskKey === "shellUt" ? (
                <>
                  <Field label="Strake">
                    <select
                      className="laiq-input"
                      value={findingDraft.shellStrake}
                      onChange={(e) => setFindingDraft((current) => ({ ...current, shellStrake: e.target.value }))}
                    >
                      {Array.from({ length: Math.max(Number(setup.totalShellCourses) || 1, 1) }, (_, index) => (
                        <option key={`finding-strake-${index + 1}`} value={`Strake ${index + 1}`}>
                          {`Strake ${index + 1}`}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Inspection Line">
                    <select
                      className="laiq-input"
                      value={findingDraft.shellLineLabel}
                      onChange={(e) => {
                        const selectedLine = shellInspectionLines.find((line) => line.label === e.target.value);
                        setFindingDraft((current) => ({
                          ...current,
                          shellLineLabel: e.target.value,
                          shellAzimuthDeg: selectedLine ? formatAzimuth(selectedLine.azimuthDeg) : current.shellAzimuthDeg,
                          shellBearing: selectedLine?.bearing ?? current.shellBearing,
                        }));
                      }}
                    >
                      {shellInspectionLines.map((line) => (
                        <option key={`finding-shell-line-${line.index}`} value={line.label}>
                          {describeShellLine(line)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              ) : null}
              {findingContext?.sourceTaskKey === "roofUt" ? (
                <Field label="Plate Number">
                  <input className="laiq-input" value={findingDraft.roofPlate} onChange={(e) => setFindingDraft((current) => ({ ...current, roofPlate: e.target.value }))} />
                </Field>
              ) : null}
              {(findingContext?.sourceTaskKey === "shellNozzles" || findingContext?.sourceTaskKey === "roofNozzles") ? (
                <Field label="Nozzle ID">
                  <input className="laiq-input" value={findingDraft.nozzleId} onChange={(e) => setFindingDraft((current) => ({ ...current, nozzleId: e.target.value }))} />
                </Field>
              ) : null}
              <div className="laiq-sequence-note">
                <strong>{locationSummary}</strong>
                <span>Coarse location can be adjusted before saving.</span>
              </div>
              {preciseAllowed ? (
                <button type="button" className="laiq-button laiq-button-secondary" onClick={() => saveFinding(true)}>
                  Save Finding & Open Precise Location
                </button>
              ) : null}
            </div>
          </section>

          <section className="laiq-form-block">
            <div className="laiq-block-heading">
              <h3>5. Measurements</h3>
            </div>
            <div className="laiq-fields laiq-fields-compact">
              <Field label="Measurement A">
                <input className="laiq-input" value={findingDraft.measurementA} onChange={(e) => setFindingDraft((current) => ({ ...current, measurementA: e.target.value }))} placeholder="e.g. Crack length 55 mm" />
              </Field>
              <Field label="Measurement B">
                <input className="laiq-input" value={findingDraft.measurementB} onChange={(e) => setFindingDraft((current) => ({ ...current, measurementB: e.target.value }))} placeholder="e.g. Pit depth 1.2 mm" />
              </Field>
            </div>
          </section>
        </div>
      </ScreenCard>
        );
      })()}
    </Stage>
  );

  const renderShellLayoutSetup = () => {
    const totalCourses = Number(setup.totalShellCourses) || 0;
    const totalHeightMm = Math.round((Number(setup.heightM) || 0) * 1000);
    const courseSeamOrigins = shellGeometry
      ? Array.from({ length: shellGeometry.numCourses }, (_, i) =>
          courseSeamOrigin(i, shellGeometry.seamOriginC1Deg, shellGeometry.offsetDeg, shellGeometry.seamOffsetRule).toFixed(1),
        )
      : [];
    const referenceValue =
      scope.referenceDirection === "tank_north"
        ? `Tank North · ${scope.tankNorthOffset || "0"}°`
        : scope.referenceDirection === "site_reference_marker"
          ? `${scope.referenceMarkerDescription || "Marker"} · ${scope.referenceMarkerBearing || "0"}°`
          : "True North";

    return (
      <Stage
        screen="shellLayout"
        title="Shell Layout Setup"
        subtitle="Confirm shell layout before mapping."
        banner={banner}
      >
      <ScreenCard
        kicker="Fine Setup"
        title="Configure shell layout"
        topBar={<TopBar onBack={() => setScreen(pendingPreciseReturnScreen)} backLabel="Back" />}
        footer={
          <div className="laiq-footer-bar">
            <div className="laiq-status-block">
              <span className="laiq-status-label">Stored Once</span>
              <strong>This layout will be reused for later shell findings</strong>
            </div>
            <div className="laiq-footer-actions">
              <button type="button" className="laiq-button laiq-button-secondary" onClick={() => setScreen(pendingPreciseReturnScreen)}>
                Back
              </button>
              <button type="button" className="laiq-button laiq-button-primary" onClick={saveShellLayout}>
                Continue to Shell Map
              </button>
              </div>
            </div>
          }
        >
          <div className="laiq-form-grid">
            <section className="laiq-form-block">
              <div className="laiq-block-heading">
                <h3>Tank Basis</h3>
              </div>
              <div className="laiq-chip-row">
                <div className="laiq-info-chip">
                  <span>Courses</span>
                  <strong>{setup.totalShellCourses || "—"}</strong>
                </div>
                <div className="laiq-info-chip">
                  <span>Height</span>
                  <strong>{setup.heightM ? `${setup.heightM} m` : "—"}</strong>
                </div>
                <div className="laiq-info-chip">
                  <span>Diameter</span>
                  <strong>{setup.diameterM ? `${setup.diameterM} m` : "—"}</strong>
                </div>
                <div className="laiq-info-chip">
                  <span>0° Reference</span>
                  <strong>{referenceValue}</strong>
                </div>
              </div>
            </section>

            <section className="laiq-form-block">
              <div className="laiq-block-heading">
                <h3>Course Geometry</h3>
              </div>
              <div className="laiq-fields">
                <Field label="Standard plate width — circumferential (mm)" required>
                  <input className="laiq-input" inputMode="decimal" value={shellLayout.plateWidthMm} onChange={(e) => setShellLayout((current) => ({ ...current, plateWidthMm: e.target.value }))} />
                </Field>
                <span className="laiq-field-hint">API 650 minimum: 1 800 mm. Enter the mill width from the drawing.</span>
                {shellGeometry ? (
                  <div className="laiq-v1-derived-card">
                    <p className="laiq-v1-derived-kicker">Derived Layout</p>
                    <div className="laiq-v1-derived-grid">
                      <div>
                        <span>Standard course height</span>
                        <strong>{shellGeometry.stdCourseHeightMm} mm</strong>
                        <small>{`${totalHeightMm} ÷ ${totalCourses}`}</small>
                      </div>
                      <div>
                        <span>Top course height</span>
                        <strong className={cx(shellGeometry.topCourseHeightMm !== shellGeometry.stdCourseHeightMm && "laiq-v1-derived-caution")}>
                          {shellGeometry.topCourseHeightMm} mm
                        </strong>
                        <small>{shellGeometry.topCourseHeightMm !== shellGeometry.stdCourseHeightMm ? "remainder" : "same as others"}</small>
                      </div>
                      <div>
                        <span>Plates per course</span>
                        <strong>{`${shellGeometry.platesPerCourse} + 1 closure`}</strong>
                      </div>
                      <div>
                        <span>Closure plate width</span>
                        <strong>{`${shellGeometry.closurePlateWidthMm} mm`}</strong>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="laiq-form-block">
              <div className="laiq-block-heading">
                <h3>Seam Layout</h3>
              </div>
              <div className="laiq-fields">
                <span className="laiq-field-hint">Vertical seams stagger between adjacent courses. Enter C1 seam azimuth from drawing.</span>
                <Field label="Course 1 — first vertical seam azimuth (°)" required>
                  <input className="laiq-input" inputMode="decimal" value={shellLayout.seamOrigin} onChange={(e) => setShellLayout((current) => ({ ...current, seamOrigin: e.target.value }))} placeholder="e.g. 0" />
                </Field>
                <Field label="Seam Offset Rule" required>
                  <SegmentedControl
                    value={shellLayout.seamOffsetRule}
                    options={shellSeamOptions}
                    onChange={(value) => setShellLayout((current) => ({ ...current, seamOffsetRule: value }))}
                  />
                </Field>
                {shellLayout.seamOffsetRule === "custom" ? (
                  <Field label="Custom Offset" required>
                    <input className="laiq-input" value={shellLayout.customOffset} onChange={(e) => setShellLayout((current) => ({ ...current, customOffset: e.target.value }))} />
                  </Field>
                ) : null}
                {shellGeometry ? (
                  <span className="laiq-field-hint">
                    {shellLayout.seamOffsetRule === "half_plate"
                      ? `2-course repeat: C1/C3/C5 at origin, C2/C4/C6 shifted +${shellGeometry.offsetDeg.toFixed(1)}°.`
                      : shellLayout.seamOffsetRule === "third_plate"
                        ? `3-course repeat: C1=0°, C2=+${shellGeometry.offsetDeg.toFixed(1)}°, C3=+${(shellGeometry.offsetDeg * 2).toFixed(1)}°, then repeat.`
                        : "Custom offset accumulates upward course by course."}
                  </span>
                ) : null}
              </div>

                {shellGeometry ? (
                  <div className="laiq-v1-course-table">
                    <h4>Course table</h4>
                    <div className="laiq-v1-course-table-list">
                      {courseSeamOrigins.map((deg, i) => {
                        const courseNum = i + 1;
                        const isTop = courseNum === shellGeometry.numCourses;
                        const courseHeight = isTop ? shellGeometry.topCourseHeightMm : shellGeometry.stdCourseHeightMm;
                        const zStart = i === 0 ? 0 : shellGeometry.stdCourseHeightMm * i;

                        return (
                          <div key={`course-${courseNum}`} className="laiq-v1-course-row">
                            <div>
                              <strong>{`C${courseNum}`}</strong>
                              <span>{`${zStart}–${zStart + courseHeight} mm`}</span>
                              {isTop && shellGeometry.topCourseHeightMm !== shellGeometry.stdCourseHeightMm ? <em>top</em> : null}
                            </div>
                            <strong>{`seam ${deg}°`}</strong>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
            </section>
          </div>
        </ScreenCard>
      </Stage>
    );
  };

  const renderShellPreciseLocation = () => {
    const selectedCourseNum = getStrakeNumber(preciseLocation.selectedStrake);
    const selectedSeamOrigin =
      shellGeometry && selectedCourseNum > 0
        ? courseSeamOrigin(selectedCourseNum - 1, shellGeometry.seamOriginC1Deg, shellGeometry.offsetDeg, shellGeometry.seamOffsetRule)
        : 0;
    const selectedAzimuth =
      shellGeometry && preciseLocation.selectedPlateIndex > 0
        ? ((selectedSeamOrigin + (preciseLocation.selectedPlateIndex - 0.5) * shellGeometry.plateSpanDeg) % 360 + 360) % 360
        : 0;
    const selectedPlateLabel =
      shellGeometry
        ? `C${selectedCourseNum} · Plate ${String(preciseLocation.selectedPlateIndex).padStart(2, "0")} · ${selectedAzimuth.toFixed(1)}°`
        : "Shell layout not configured";

    return (
      <Stage
        screen="shellPreciseLocation"
        title="Precise Shell Location"
        subtitle="Map exact shell point."
        banner={banner}
      >
        <ScreenCard
          kicker="Fine Location"
          title="Mark shell defect"
          topBar={<TopBar onBack={() => setScreen(pendingPreciseReturnScreen)} backLabel="Back" />}
          footer={
            <div className="laiq-footer-bar">
              <div className="laiq-status-block">
                <span className="laiq-status-label">Selected Plate</span>
                <strong>{selectedPlateLabel}</strong>
              </div>
              <div className="laiq-footer-actions laiq-footer-actions-wide">
                <button
                  type="button"
                  className="laiq-button laiq-button-secondary"
                  onClick={() => {
                    setPendingShellFindingId(null);
                    setScreen(pendingPreciseReturnScreen);
                    setBanner("Finding kept with coarse shell location only");
                  }}
                >
                  Use Coarse Location Instead
                </button>
                <button type="button" className="laiq-button laiq-button-primary" onClick={savePreciseLocation}>
                  Save Precise Location
                </button>
              </div>
            </div>
          }
        >
          <div className="laiq-form-grid">
            <section className="laiq-form-block">
              <div className="laiq-block-heading">
                <h3>Method</h3>
              </div>
              <Field label="Precise Location Method">
                <SegmentedControl
                  value={preciseLocation.method}
                  options={preciseMethodOptions}
                  onChange={(value) => setPreciseLocation((current) => ({ ...current, method: value }))}
                />
              </Field>

              {preciseLocation.method === "tap_layout" && shellGeometry ? (
                <PrototypeShellSurfaceMap
                  geometry={shellGeometry}
                  selectedStrake={preciseLocation.selectedStrake}
                  selectedPlateIndex={preciseLocation.selectedPlateIndex}
                  onSelectPlate={(strake, plateIndex, azimuthDeg) =>
                    setPreciseLocation((current) => ({
                      ...current,
                      selectedStrake: strake,
                      selectedPlateIndex: plateIndex,
                      selectedBearing: bearingFromAzimuth(azimuthDeg),
                      plateReference: `C${getStrakeNumber(strake)} · Plate ${String(plateIndex).padStart(2, "0")} · ${azimuthDeg.toFixed(1)}°`,
                      x: String(plateIndex),
                      y: String(getStrakeNumber(strake)),
                    }))
                  }
                />
              ) : null}

              {preciseLocation.method === "manual_xy" ? (
                <div className="laiq-fields laiq-fields-compact">
                  <Field label="X coordinate" required>
                    <input className="laiq-input" value={preciseLocation.x} onChange={(e) => setPreciseLocation((current) => ({ ...current, x: e.target.value }))} />
                  </Field>
                  <Field label="Y coordinate" required>
                    <input className="laiq-input" value={preciseLocation.y} onChange={(e) => setPreciseLocation((current) => ({ ...current, y: e.target.value }))} />
                  </Field>
                </div>
              ) : null}

              {preciseLocation.method === "plate_seam_reference" ? (
                <div className="laiq-fields">
                  <Field label="Plate Reference" required>
                    <input className="laiq-input" value={preciseLocation.plateReference} onChange={(e) => setPreciseLocation((current) => ({ ...current, plateReference: e.target.value }))} placeholder="e.g. C4 · Plate 14" />
                  </Field>
                  <Field label="Seam Relation">
                    <input className="laiq-input" value={preciseLocation.seamRelation} onChange={(e) => setPreciseLocation((current) => ({ ...current, seamRelation: e.target.value }))} placeholder="e.g. Near vertical seam" />
                  </Field>
                </div>
              ) : null}
            </section>

            <section className="laiq-form-block">
              <div className="laiq-block-heading">
                <h3>Selected Location</h3>
              </div>
              <div className="laiq-fields">
                <div className="laiq-sequence-note">
                  <strong>{selectedPlateLabel}</strong>
                  <span>Tap a plate on the layout or use manual / plate reference input.</span>
                </div>
                <Field label="Region Size">
                  <input className="laiq-input" value={preciseLocation.regionSize} onChange={(e) => setPreciseLocation((current) => ({ ...current, regionSize: e.target.value }))} placeholder="e.g. 220 x 90 mm" />
                </Field>
                <Field label="Location Note">
                  <textarea className="laiq-input laiq-textarea" value={preciseLocation.note} onChange={(e) => setPreciseLocation((current) => ({ ...current, note: e.target.value }))} placeholder="Optional note about shell location precision" />
                </Field>
              </div>
            </section>
          </div>
        </ScreenCard>
      </Stage>
    );
  };

  const renderRoofUt = () => (
    <Stage
      screen="roofUt"
      title="Roof UT"
      subtitle="Enter roof readings."
      banner={banner}
    >
      <ScreenCard
        kicker="Routine Entry"
        title="Roof thickness measurements"
        topBar={<TopBar onBack={() => setScreen("taskBoard")} onSaveDraft={handleSaveDraft} backLabel="Task Board" />}
        footer={
          <div className="laiq-footer-bar">
            <div className="laiq-status-block">
              <span className="laiq-status-label">Current Plate</span>
              <strong>{roofLocationSummary}</strong>
            </div>
            <div className="laiq-footer-actions laiq-footer-actions-wide">
              <button type="button" className="laiq-button laiq-button-secondary" onClick={() => setScreen("taskBoard")}>
                Back to Tasks
              </button>
              <button
                type="button"
                className="laiq-button laiq-button-secondary"
                onClick={() =>
                  startFinding({
                    screen: "roofFinding",
                    returnScreen: "roofUt",
                    sourceTaskLabel: "Roof UT",
                    sourceTaskKey: "roofUt",
                    locationSummary: roofLocationSummary,
                    preciseAllowed: false,
                    typeOptions: roofFindingTypes,
                    roofPlate: roofEntry.plateNumber,
                  })
                }
              >
                Add Finding Here
              </button>
              <button type="button" className="laiq-button laiq-button-primary" onClick={saveRoofRecord}>
                Save & Next
              </button>
            </div>
          </div>
        }
      >
        <div className="laiq-form-grid laiq-form-grid-two">
          <section className="laiq-form-block">
            <div className="laiq-block-heading">
              <h3>Location</h3>
            </div>
            <div className="laiq-fields laiq-fields-compact">
              <Field label="Roof Template">
                <select
                  className="laiq-input"
                  value={roofTemplateInput}
                  onChange={(e) => setRoofTemplateInput(e.target.value as RoofLayoutTemplate)}
                >
                  {roofLayoutTemplateOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={roofTemplateInput === "umbrella_radial" ? "Ring Count" : "Plate Rows"}>
                <input
                  className="laiq-input"
                  inputMode="numeric"
                  value={roofRowCountInput}
                  onChange={(e) => setRoofRowCountInput(e.target.value)}
                  placeholder={String(roofLayout.rowCount)}
                />
              </Field>
            </div>
            <div className="laiq-fields laiq-fields-compact">
              <Field
                label={
                  roofTemplateInput === "flat_grid"
                    ? "Columns"
                    : roofTemplateInput === "umbrella_radial"
                      ? "Sector Count"
                      : "Widest Row Plates"
                }
              >
                <input
                  className="laiq-input"
                  inputMode="numeric"
                  value={roofColumnCountInput}
                  onChange={(e) => setRoofColumnCountInput(e.target.value)}
                  placeholder={String(roofLayout.columnCount)}
                />
              </Field>
              {roofTemplateInput === "circular_center_opening" ? (
                <Field label="Center Opening (%)">
                  <input
                    className="laiq-input"
                    inputMode="numeric"
                    value={roofCenterOpeningInput}
                    onChange={(e) => setRoofCenterOpeningInput(e.target.value)}
                    placeholder={String(Math.round(roofLayout.centerVoidRatio * 100))}
                  />
                </Field>
              ) : null}
            </div>
            <Field label="Plate Number" required>
              <select className="laiq-input" value={roofEntry.plateNumber} onChange={(e) => setRoofEntry((current) => ({ ...current, plateNumber: e.target.value }))}>
                {roofLayout.cells.map((cell) => (
                  <option key={`roof-plate-${cell.plateNumber}`} value={String(cell.plateNumber)}>
                    {`Plate ${cell.plateNumber}`}
                  </option>
                ))}
              </select>
            </Field>
            <p className="laiq-field-hint">
              {roofTemplateInput === "flat_grid"
                ? "Use this when the roof is inspected like a floor-style grid with straight weld rows and columns."
                : roofTemplateInput === "umbrella_radial"
                  ? "Use this for umbrella roofs with fan-shaped plates laid on meridian lines from center to shell."
                  : "Use this when the roof plates are laid out across a circular boundary with weld rows clipped by the roof edge."}
            </p>
            <PrototypeRoofPlateMap
              layout={roofLayout}
              roofType={setup.roofType}
              selectedPlate={parsePlateNumber(roofEntry.plateNumber)}
              onSelect={(plateNumber) => setRoofEntry((current) => ({ ...current, plateNumber: String(plateNumber) }))}
              features={roofFeatures}
              featureDraft={roofFeatureDraft}
            />
            <div className="laiq-inline-divider" />
            <div className="laiq-block-heading">
              <h3>Feature Layer</h3>
              <p>Add manholes, vents, hatches, and walkway features on the roof map.</p>
            </div>
            {editingRoofFeatureId ? (
              <div className="laiq-banner">
                Editing roof feature
              </div>
            ) : null}
            <div className="laiq-fields laiq-fields-compact">
              <Field label="Feature Type">
                <select
                  className="laiq-input"
                  value={roofFeatureDraft.type}
                  onChange={(e) => setRoofFeatureDraft((current) => ({ ...current, type: e.target.value as RoofFeatureType }))}
                >
                  {roofFeatureTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Placement">
                <select
                  className="laiq-input"
                  value={roofFeatureDraft.placement}
                  onChange={(e) => setRoofFeatureDraft((current) => ({ ...current, placement: e.target.value as RoofFeaturePlacement }))}
                >
                  {featurePlacementOptionsForTemplate(roofTemplateInput).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="laiq-fields">
              <Field label="Feature Label">
                <input
                  className="laiq-input"
                  value={roofFeatureDraft.label}
                  onChange={(e) => setRoofFeatureDraft((current) => ({ ...current, label: e.target.value }))}
                  placeholder={roofFeatureLabel(roofFeatureDraft.type, roofFeatures.length + 1)}
                />
              </Field>
            </div>
            {roofFeatureDraft.placement === "plate_linked" ? (
              <Field label="Linked Plate">
                <select
                  className="laiq-input"
                  value={roofFeatureDraft.plateNumber}
                  onChange={(e) => setRoofFeatureDraft((current) => ({ ...current, plateNumber: e.target.value }))}
                >
                  {roofLayout.cells.map((cell) => (
                    <option key={`roof-feature-plate-${cell.plateNumber}`} value={String(cell.plateNumber)}>
                      {`Plate ${cell.plateNumber}`}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {roofFeatureDraft.placement === "azimuth_radius" ? (
              <div className="laiq-fields laiq-fields-compact">
                <Field label="Azimuth (°)">
                  <input
                    className="laiq-input"
                    inputMode="decimal"
                    value={roofFeatureDraft.azimuthDeg}
                    onChange={(e) => setRoofFeatureDraft((current) => ({ ...current, azimuthDeg: e.target.value }))}
                  />
                </Field>
                <Field label="Radius (%)">
                  <input
                    className="laiq-input"
                    inputMode="decimal"
                    value={roofFeatureDraft.radialPercent}
                    onChange={(e) => setRoofFeatureDraft((current) => ({ ...current, radialPercent: e.target.value }))}
                  />
                </Field>
              </div>
            ) : null}
            {roofFeatureDraft.placement === "grid_coordinate" ? (
              <div className="laiq-fields laiq-fields-compact">
                <Field label="Row">
                  <input
                    className="laiq-input"
                    inputMode="numeric"
                    value={roofFeatureDraft.gridRow}
                    onChange={(e) => setRoofFeatureDraft((current) => ({ ...current, gridRow: e.target.value }))}
                  />
                </Field>
                <Field label="Column">
                  <input
                    className="laiq-input"
                    inputMode="numeric"
                    value={roofFeatureDraft.gridColumn}
                    onChange={(e) => setRoofFeatureDraft((current) => ({ ...current, gridColumn: e.target.value }))}
                  />
                </Field>
              </div>
            ) : null}
            <div className="laiq-inline-actions">
              <button type="button" className="laiq-button laiq-button-secondary" onClick={addRoofFeature}>
                {editingRoofFeatureId ? "Save Changes" : "Add Feature"}
              </button>
              {editingRoofFeatureId ? (
                <button type="button" className="laiq-button laiq-button-secondary" onClick={cancelRoofFeatureEdit}>
                  Cancel Edit
                </button>
              ) : null}
            </div>
            <div className="laiq-record-list laiq-record-list-compact">
              {roofFeatures.length === 0 ? (
                <div className="laiq-empty-state">No roof features added yet.</div>
              ) : (
                roofFeatures.map((feature) => (
                  <div key={feature.id} className="laiq-record-row">
                    <div className="laiq-record-copy">
                      <strong>{feature.label}</strong>
                      <span>
                        {roofFeatureTypeOptions.find((item) => item.value === feature.type)?.label}
                        {" · "}
                        {feature.placement === "center"
                          ? "Center"
                          : feature.placement === "plate_linked"
                            ? `Plate ${feature.plateNumber}`
                            : feature.placement === "azimuth_radius"
                              ? `${formatAzimuth(feature.azimuthDeg || 0)}° · ${feature.radialPercent || 65}%`
                              : `Row ${feature.gridRow} · Col ${feature.gridColumn}`}
                      </span>
                    </div>
                    <div className="laiq-inline-actions">
                      <button type="button" className="laiq-topbar-button" onClick={() => editRoofFeature(feature)}>
                        Edit
                      </button>
                      <button type="button" className="laiq-topbar-button" onClick={() => removeRoofFeature(feature.id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="laiq-form-block">
            <div className="laiq-block-heading">
              <h3>Readings A-E</h3>
              <p>Enter up to five routine roof readings.</p>
            </div>
            <div className="laiq-mini-grid">
              {roofEntry.readings.map((reading, index) => (
                <Field key={`roof-reading-${index}`} label={`Reading ${String.fromCharCode(65 + index)}`}>
                  <input
                    className="laiq-input"
                    inputMode="decimal"
                    value={reading}
                    onChange={(e) =>
                      setRoofEntry((current) => ({
                        ...current,
                        readings: current.readings.map((item, itemIndex) => (itemIndex === index ? e.target.value : item)),
                      }))
                    }
                  />
                </Field>
              ))}
            </div>
            <div className="laiq-fields">
              <Field label="Quick Note">
                <textarea className="laiq-input laiq-textarea" value={roofEntry.note} onChange={(e) => setRoofEntry((current) => ({ ...current, note: e.target.value }))} />
              </Field>
              <div className="laiq-photo-panel">
                <div>
                  <strong>Photo</strong>
                  <span>{roofEntry.photoCount} attached</span>
                </div>
                <button type="button" className="laiq-button laiq-button-secondary" onClick={() => setRoofEntry((current) => ({ ...current, photoCount: current.photoCount + 1 }))}>
                  Add Photo
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="laiq-summary-grid">
          <MetricCard label="Plate" value={roofLocationSummary} />
          <MetricCard label="Min" value={roofStats ? formatMetric(roofStats.min) : "—"} />
          <MetricCard label="Max" value={roofStats ? formatMetric(roofStats.max) : "—"} />
        </div>

        <div className="laiq-record-list laiq-record-list-padded">
          <div className="laiq-list-heading">
            <h3>Recent Roof UT Entries</h3>
          </div>
          {roofRecords.length === 0 ? (
            <div className="laiq-empty-state">No roof UT records yet.</div>
          ) : (
            roofRecords.slice(0, 6).map((record) => (
              <div key={record.id} className="laiq-record-row">
                <div className="laiq-record-copy">
                  <strong>{record.summary}</strong>
                  <span>
                    {record.subSummary} · Min {formatMetric(record.min)} · Max {formatMetric(record.max)}
                  </span>
                </div>
                <button type="button" className="laiq-topbar-button" onClick={() => setBanner(`Edit state not implemented for ${record.summary} in prototype`)}>
                  Edit
                </button>
              </div>
            ))
          )}
        </div>
      </ScreenCard>
    </Stage>
  );

  const renderShellNozzleUt = () => (
    <Stage
      screen="shellNozzleUt"
      title="Shell Nozzle UT"
      subtitle="Enter shell nozzle readings."
      banner={banner}
    >
      <ScreenCard
        kicker="Routine Entry"
        title="Shell nozzle thickness measurements"
        topBar={<TopBar onBack={() => setScreen("taskBoard")} onSaveDraft={handleSaveDraft} backLabel="Task Board" />}
        footer={
          <div className="laiq-footer-bar">
            <div className="laiq-status-block">
              <span className="laiq-status-label">Current Nozzle</span>
              <strong>{shellNozzleLocationSummary}</strong>
            </div>
            <div className="laiq-footer-actions laiq-footer-actions-wide">
              <button type="button" className="laiq-button laiq-button-secondary" onClick={() => setScreen("taskBoard")}>
                Back to Tasks
              </button>
              {shellNozzleConfirmed ? (
                <>
                  <button
                    type="button"
                    className="laiq-button laiq-button-secondary"
                    onClick={() =>
                      startFinding({
                        screen: "shellNozzleFinding",
                        returnScreen: "shellNozzleUt",
                        sourceTaskLabel: "Shell Nozzle UT",
                        sourceTaskKey: "shellNozzles",
                        locationSummary: shellNozzleLocationSummary,
                        preciseAllowed: false,
                        typeOptions: nozzleFindingTypes,
                        nozzleId: shellNozzleEntry.nozzleId,
                        shellStrake: `Strake ${getStrakeNumber(currentShellNozzle?.shellCourse || "Course 1")}`,
                        shellBearing: bearingFromAzimuth(currentShellNozzle?.azimuthDeg ?? 0),
                      })
                    }
                  >
                    Add Finding Here
                  </button>
                  <button type="button" className="laiq-button laiq-button-primary" onClick={saveShellNozzleRecord}>
                    Save & Next
                  </button>
                </>
              ) : (
                <button type="button" className="laiq-button laiq-button-primary" onClick={confirmShellNozzle}>
                  Confirm Nozzle
                </button>
              )}
            </div>
          </div>
        }
      >
        <div className="laiq-form-grid laiq-form-grid-two">
          {!shellNozzleParentReady ? (
            <section className="laiq-form-block">
              <div className="laiq-empty-state">Complete and save shell UT first. Shell nozzle registration depends on the shell surface being defined.</div>
            </section>
          ) : (
          <section className="laiq-form-block">
            <div className="laiq-block-heading">
              <h3>Nozzle</h3>
            </div>
            <div className="laiq-inline-compact">
              <Field label="Nozzles">
                <input className="laiq-input" inputMode="numeric" value={shellNozzleCountInput} onChange={(e) => setShellNozzleCountInput(e.target.value)} />
              </Field>
              <button type="button" className="laiq-button laiq-button-secondary" onClick={generateShellNozzles}>
                Generate
              </button>
            </div>
            <div className="laiq-fields">
              <Field label="Current Nozzle" required>
                <select className="laiq-input" value={shellNozzleEntry.nozzleId} onChange={(e) => selectShellNozzle(e.target.value)}>
                  {shellNozzleRegistry.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Placement Mode">
                <SegmentedControl value={shellNozzlePlacementMode} options={nozzlePlacementModeOptions} onChange={setShellNozzlePlacementMode} />
              </Field>
              <Field label="Nozzle ID" required>
                <input
                  className="laiq-input"
                  value={shellNozzleEntry.nozzleId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    updateShellNozzleRegistry(shellNozzleEntry.nozzleId, { id: nextId });
                    setShellNozzleEntry((current) => ({ ...current, nozzleId: nextId }));
                  }}
                />
              </Field>
              <Field label="Nozzle Size">
                <select
                  className="laiq-input"
                  value={shellNozzleEntry.nozzleSize}
                  onChange={(e) => {
                    updateShellNozzleRegistry(shellNozzleEntry.nozzleId, { size: e.target.value });
                    setShellNozzleEntry((current) => ({ ...current, nozzleSize: e.target.value }));
                  }}
                >
                  {nozzleSizeOptions.map((option) => (
                    <option key={`shell-nozzle-size-${option}`} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Course">
                <select
                  className="laiq-input"
                  value={currentShellNozzle?.shellCourse || "Course 1"}
                  onChange={(e) => updateShellNozzleRegistry(shellNozzleEntry.nozzleId, { shellCourse: e.target.value })}
                >
                  {Array.from({ length: Math.max(Number(setup.totalShellCourses) || 1, 1) }, (_, index) => (
                    <option key={`shell-nozzle-course-${index + 1}`} value={`Course ${index + 1}`}>
                      {`Course ${index + 1}`}
                    </option>
                  ))}
                </select>
              </Field>
              {shellNozzlePlacementMode === "explicit" ? (
                <Field label="Azimuth (°)">
                  <input
                    className="laiq-input"
                    inputMode="decimal"
                    value={currentShellNozzle ? formatAzimuth(currentShellNozzle.azimuthDeg) : "0"}
                    onChange={(e) => updateShellNozzleRegistry(shellNozzleEntry.nozzleId, { azimuthDeg: Number(e.target.value) || 0 })}
                  />
                </Field>
              ) : null}
            </div>
            <div className="laiq-sequence-note">
              <strong>{shellNozzlePlacementMode === "sketch" ? "Tap the shell sketch to place the current nozzle approximately." : "Type the azimuth when a measured value is available."}</strong>
              <span>{currentShellNozzle ? `${currentShellNozzle.shellCourse || "Course 1"} · ${formatAzimuth(currentShellNozzle.azimuthDeg)}°` : "No nozzle selected"}</span>
            </div>
            <PrototypeShellNozzleMap
              courseCount={Math.max(Number(setup.totalShellCourses) || 1, 1)}
              nozzles={shellNozzleRegistry}
              selectedId={shellNozzleEntry.nozzleId}
              selectedCourse={currentShellNozzle?.shellCourse || "Course 1"}
              selectedAzimuth={currentShellNozzle?.azimuthDeg ?? 0}
              onSelect={selectShellNozzle}
              onPlaceCurrent={
                shellNozzlePlacementMode === "sketch"
                  ? (course, azimuthDeg) => updateShellNozzleRegistry(shellNozzleEntry.nozzleId, { shellCourse: course, azimuthDeg })
                  : undefined
              }
            />
            <div className="laiq-inline-actions">
              <button type="button" className="laiq-button laiq-button-primary" onClick={confirmShellNozzle}>
                {shellNozzleConfirmed ? "Confirmed" : "Confirm Nozzle"}
              </button>
            </div>
          </section>
          )}

          {shellNozzleParentReady && shellNozzleConfirmed ? (
            <section className="laiq-form-block">
              <div className="laiq-block-heading">
                <h3>Measurements</h3>
              </div>
              <div className="laiq-mini-grid">
                {["12 o'clock", "3 o'clock", "6 o'clock", "9 o'clock"].map((label, index) => (
                  <Field key={label} label={label}>
                    <input
                      className="laiq-input"
                      inputMode="decimal"
                      value={shellNozzleEntry.readings[index]}
                      onChange={(e) =>
                        setShellNozzleEntry((current) => ({
                          ...current,
                          readings: current.readings.map((item, itemIndex) => (itemIndex === index ? e.target.value : item)),
                        }))
                      }
                    />
                  </Field>
                ))}
                <Field label="Reinforcement Pad">
                  <input className="laiq-input" inputMode="decimal" value={shellNozzleEntry.reinforcementPad} onChange={(e) => setShellNozzleEntry((current) => ({ ...current, reinforcementPad: e.target.value }))} />
                </Field>
              </div>
              <div className="laiq-fields">
                <Field label="Quick Note">
                  <textarea className="laiq-input laiq-textarea" value={shellNozzleEntry.note} onChange={(e) => setShellNozzleEntry((current) => ({ ...current, note: e.target.value }))} />
                </Field>
                <div className="laiq-photo-panel">
                  <div>
                    <strong>Photo</strong>
                    <span>{shellNozzleEntry.photoCount} attached</span>
                  </div>
                  <button type="button" className="laiq-button laiq-button-secondary" onClick={() => setShellNozzleEntry((current) => ({ ...current, photoCount: current.photoCount + 1 }))}>
                    Add Photo
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <section className="laiq-form-block">
              <div className="laiq-empty-state">{shellNozzleParentReady ? "Confirm nozzle registration first." : "Shell nozzle measurements unlock after shell UT is saved."}</div>
            </section>
          )}
        </div>

        <div className="laiq-summary-grid">
          <MetricCard label="Nozzle" value={shellNozzleLocationSummary} />
          <MetricCard label="Min" value={shellNozzleStats ? formatMetric(shellNozzleStats.min) : "—"} />
          <MetricCard label="Max" value={shellNozzleStats ? formatMetric(shellNozzleStats.max) : "—"} />
        </div>

        <div className="laiq-record-list laiq-record-list-padded">
          <div className="laiq-list-heading">
            <h3>Recent Shell Nozzle Entries</h3>
          </div>
          {shellNozzleRecords.length === 0 ? (
            <div className="laiq-empty-state">No shell nozzle UT records yet.</div>
          ) : (
            shellNozzleRecords.slice(0, 6).map((record) => (
              <div key={record.id} className="laiq-record-row">
                <div className="laiq-record-copy">
                  <strong>{record.summary}</strong>
                  <span>
                    {record.subSummary} · Min {formatMetric(record.min)} · Max {formatMetric(record.max)}
                  </span>
                </div>
                <button type="button" className="laiq-topbar-button" onClick={() => setBanner(`Edit state not implemented for ${record.summary} in prototype`)}>
                  Edit
                </button>
              </div>
            ))
          )}
        </div>
      </ScreenCard>
    </Stage>
  );

  const renderRoofNozzleUt = () => (
    <Stage
      screen="roofNozzleUt"
      title="Roof Nozzle UT"
      subtitle="Enter roof nozzle readings."
      banner={banner}
    >
      <ScreenCard
        kicker="Routine Entry"
        title="Roof nozzle thickness measurements"
        topBar={<TopBar onBack={() => setScreen("taskBoard")} onSaveDraft={handleSaveDraft} backLabel="Task Board" />}
        footer={
          <div className="laiq-footer-bar">
            <div className="laiq-status-block">
              <span className="laiq-status-label">Current Nozzle</span>
              <strong>{roofNozzleLocationSummary}</strong>
            </div>
            <div className="laiq-footer-actions laiq-footer-actions-wide">
              <button type="button" className="laiq-button laiq-button-secondary" onClick={() => setScreen("taskBoard")}>
                Back to Tasks
              </button>
              {roofNozzleConfirmed ? (
                <>
                  <button
                    type="button"
                    className="laiq-button laiq-button-secondary"
                    onClick={() =>
                      startFinding({
                        screen: "roofNozzleFinding",
                        returnScreen: "roofNozzleUt",
                        sourceTaskLabel: "Roof Nozzle UT",
                        sourceTaskKey: "roofNozzles",
                        locationSummary: roofNozzleLocationSummary,
                        preciseAllowed: false,
                        typeOptions: nozzleFindingTypes,
                        nozzleId: roofNozzleEntry.nozzleId,
                      })
                    }
                  >
                    Add Finding Here
                  </button>
                  <button type="button" className="laiq-button laiq-button-primary" onClick={saveRoofNozzleRecord}>
                    Save & Next
                  </button>
                </>
              ) : (
                <button type="button" className="laiq-button laiq-button-primary" onClick={confirmRoofNozzle}>
                  Confirm Nozzle
                </button>
              )}
            </div>
          </div>
        }
      >
        <div className="laiq-form-grid laiq-form-grid-two">
          {!roofNozzleParentReady ? (
            <section className="laiq-form-block">
              <div className="laiq-empty-state">Complete and save roof UT first. Roof nozzle registration depends on the roof layout and plate map being defined.</div>
            </section>
          ) : (
          <section className="laiq-form-block">
            <div className="laiq-block-heading">
              <h3>Nozzle</h3>
            </div>
            <div className="laiq-inline-compact">
              <Field label="Nozzles">
                <input className="laiq-input" inputMode="numeric" value={roofNozzleCountInput} onChange={(e) => setRoofNozzleCountInput(e.target.value)} />
              </Field>
              <button type="button" className="laiq-button laiq-button-secondary" onClick={generateRoofNozzles}>
                Generate
              </button>
            </div>
            <div className="laiq-fields">
              <Field label="Current Nozzle" required>
                <select className="laiq-input" value={roofNozzleEntry.nozzleId} onChange={(e) => selectRoofNozzle(e.target.value)}>
                  {roofNozzleRegistry.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Placement Mode">
                <SegmentedControl value={roofNozzlePlacementMode} options={nozzlePlacementModeOptions} onChange={setRoofNozzlePlacementMode} />
              </Field>
              <Field label="Nozzle ID" required>
                <input
                  className="laiq-input"
                  value={roofNozzleEntry.nozzleId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    updateRoofNozzleRegistry(roofNozzleEntry.nozzleId, { id: nextId });
                    setRoofNozzleEntry((current) => ({ ...current, nozzleId: nextId }));
                  }}
                />
              </Field>
              <Field label="Nozzle Size">
                <select
                  className="laiq-input"
                  value={roofNozzleEntry.nozzleSize}
                  onChange={(e) => {
                    updateRoofNozzleRegistry(roofNozzleEntry.nozzleId, { size: e.target.value });
                    setRoofNozzleEntry((current) => ({ ...current, nozzleSize: e.target.value }));
                  }}
                >
                  {nozzleSizeOptions.map((option) => (
                    <option key={`roof-nozzle-size-${option}`} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              {roofNozzlePlacementMode === "explicit" ? (
                <>
                  <Field label="Azimuth (°)">
                    <input
                      className="laiq-input"
                      inputMode="decimal"
                      value={currentRoofNozzle ? formatAzimuth(currentRoofNozzle.azimuthDeg) : "0"}
                      onChange={(e) => updateRoofNozzleRegistry(roofNozzleEntry.nozzleId, { azimuthDeg: Number(e.target.value) || 0 })}
                    />
                  </Field>
                  <Field label="Ring">
                    <select
                      className="laiq-input"
                      value={String(currentRoofNozzle?.radialBand || 3)}
                      onChange={(e) => updateRoofNozzleRegistry(roofNozzleEntry.nozzleId, { radialBand: Number(e.target.value) || 3 })}
                    >
                      <option value="1">Ring 1</option>
                      <option value="2">Ring 2</option>
                      <option value="3">Ring 3</option>
                    </select>
                  </Field>
                </>
              ) : null}
            </div>
            <div className="laiq-sequence-note">
              <strong>{roofNozzlePlacementMode === "sketch" ? "Tap the roof sketch to place the current nozzle approximately." : "Type azimuth and ring when a measured value is available."}</strong>
              <span>{currentRoofNozzle ? `${formatAzimuth(currentRoofNozzle.azimuthDeg)}° · Ring ${currentRoofNozzle.radialBand}` : "No nozzle selected"}</span>
            </div>
            <PrototypeRoofNozzleMap
              nozzles={roofNozzleRegistry}
              selectedId={roofNozzleEntry.nozzleId}
              roofType={setup.roofType}
              onSelect={selectRoofNozzle}
              onPlaceCurrent={
                roofNozzlePlacementMode === "sketch"
                  ? (azimuthDeg, radialBand) => updateRoofNozzleRegistry(roofNozzleEntry.nozzleId, { azimuthDeg, radialBand })
                  : undefined
              }
            />
            <div className="laiq-inline-actions">
              <button type="button" className="laiq-button laiq-button-primary" onClick={confirmRoofNozzle}>
                {roofNozzleConfirmed ? "Confirmed" : "Confirm Nozzle"}
              </button>
            </div>
          </section>
          )}

          {roofNozzleParentReady && roofNozzleConfirmed ? (
            <section className="laiq-form-block">
              <div className="laiq-block-heading">
                <h3>Measurements</h3>
              </div>
              <div className="laiq-mini-grid">
                {["North", "East", "South", "West"].map((label, index) => (
                  <Field key={label} label={label}>
                    <input
                      className="laiq-input"
                      inputMode="decimal"
                      value={roofNozzleEntry.readings[index]}
                      onChange={(e) =>
                        setRoofNozzleEntry((current) => ({
                          ...current,
                          readings: current.readings.map((item, itemIndex) => (itemIndex === index ? e.target.value : item)),
                        }))
                      }
                    />
                  </Field>
                ))}
                <Field label="Reinforcement Pad">
                  <input className="laiq-input" inputMode="decimal" value={roofNozzleEntry.reinforcementPad} onChange={(e) => setRoofNozzleEntry((current) => ({ ...current, reinforcementPad: e.target.value }))} />
                </Field>
              </div>
              <div className="laiq-fields">
                <Field label="Quick Note">
                  <textarea className="laiq-input laiq-textarea" value={roofNozzleEntry.note} onChange={(e) => setRoofNozzleEntry((current) => ({ ...current, note: e.target.value }))} />
                </Field>
                <div className="laiq-photo-panel">
                  <div>
                    <strong>Photo</strong>
                    <span>{roofNozzleEntry.photoCount} attached</span>
                  </div>
                  <button type="button" className="laiq-button laiq-button-secondary" onClick={() => setRoofNozzleEntry((current) => ({ ...current, photoCount: current.photoCount + 1 }))}>
                    Add Photo
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <section className="laiq-form-block">
              <div className="laiq-empty-state">{roofNozzleParentReady ? "Confirm nozzle registration first." : "Roof nozzle measurements unlock after roof UT is saved."}</div>
            </section>
          )}
        </div>

        <div className="laiq-summary-grid">
          <MetricCard label="Nozzle" value={roofNozzleLocationSummary} />
          <MetricCard label="Min" value={roofNozzleStats ? formatMetric(roofNozzleStats.min) : "—"} />
          <MetricCard label="Max" value={roofNozzleStats ? formatMetric(roofNozzleStats.max) : "—"} />
        </div>

        <div className="laiq-record-list laiq-record-list-padded">
          <div className="laiq-list-heading">
            <h3>Recent Roof Nozzle Entries</h3>
          </div>
          {roofNozzleRecords.length === 0 ? (
            <div className="laiq-empty-state">No roof nozzle UT records yet.</div>
          ) : (
            roofNozzleRecords.slice(0, 6).map((record) => (
              <div key={record.id} className="laiq-record-row">
                <div className="laiq-record-copy">
                  <strong>{record.summary}</strong>
                  <span>
                    {record.subSummary} · Min {formatMetric(record.min)} · Max {formatMetric(record.max)}
                  </span>
                </div>
                <button type="button" className="laiq-topbar-button" onClick={() => setBanner(`Edit state not implemented for ${record.summary} in prototype`)}>
                  Edit
                </button>
              </div>
            ))
          )}
        </div>
      </ScreenCard>
    </Stage>
  );

  const renderBottomMfl = () => (
    <Stage
      screen="bottomMfl"
      title="Bottom MFL"
      subtitle="Import MFL only."
      banner={banner}
    >
      <ScreenCard
        kicker="Import Only"
        title="Bottom MFL source report"
        topBar={<TopBar onBack={() => setScreen("taskBoard")} onSaveDraft={handleSaveDraft} backLabel="Task Board" />}
        footer={
          <div className="laiq-footer-bar">
            <div className="laiq-status-block">
              <span className="laiq-status-label">Floor Workflow</span>
              <strong>MFL import only in MVP</strong>
            </div>
            <div className="laiq-footer-actions">
              <button type="button" className="laiq-button laiq-button-secondary" onClick={() => setScreen("taskBoard")}>
                Back to Tasks
              </button>
              <button type="button" className="laiq-button laiq-button-primary" onClick={saveMflImport}>
                Save MFL
              </button>
            </div>
          </div>
        }
      >
        <div className="laiq-form-grid laiq-form-grid-two">
          <section className="laiq-form-block">
            <div className="laiq-block-heading">
              <h3>Source Report</h3>
              <p>Capture the minimum metadata needed to attach and reference the contractor report.</p>
            </div>
            <div className="laiq-fields">
              <Field label="Contractor" required>
                <input className="laiq-input" value={mfl.contractor} onChange={(e) => setMfl((current) => ({ ...current, contractor: e.target.value }))} />
              </Field>
              <Field label="Report Reference" required>
                <input className="laiq-input" value={mfl.reportReference} onChange={(e) => setMfl((current) => ({ ...current, reportReference: e.target.value }))} />
              </Field>
              <Field label="Report Date" required>
                <input className="laiq-input" type="date" value={mfl.reportDate} onChange={(e) => setMfl((current) => ({ ...current, reportDate: e.target.value }))} />
              </Field>
              <Field label="Coverage">
                <input className="laiq-input" value={mfl.coverage} onChange={(e) => setMfl((current) => ({ ...current, coverage: e.target.value }))} placeholder="e.g. Full floor scan" />
              </Field>
              <Field label="Severity">
                <select className="laiq-input" value={mfl.severity} onChange={(e) => setMfl((current) => ({ ...current, severity: e.target.value as Severity }))}>
                  <option value="">Select severity</option>
                  {severityOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          <section className="laiq-form-block">
            <div className="laiq-block-heading">
              <h3>Attachment + Summary</h3>
              <p>Flagged areas remain summary-only in MVP.</p>
            </div>
            <div className="laiq-fields">
              <div className="laiq-photo-panel">
                <div>
                  <strong>Attachment</strong>
                  <span>{mfl.attachmentName || "No file attached"}</span>
                </div>
                <button type="button" className="laiq-button laiq-button-secondary" onClick={() => setMfl((current) => ({ ...current, attachmentName: `${setup.tankNumber || "tank"}-mfl-report.pdf` }))}>
                  Attach Report
                </button>
              </div>
              <Field label="Flagged Areas Count">
                <input className="laiq-input" value={mfl.flaggedAreas} onChange={(e) => setMfl((current) => ({ ...current, flaggedAreas: e.target.value }))} />
              </Field>
              <Field label="Summary Note">
                <textarea className="laiq-input laiq-textarea" value={mfl.summaryNote} onChange={(e) => setMfl((current) => ({ ...current, summaryNote: e.target.value }))} />
              </Field>
            </div>
          </section>
        </div>
      </ScreenCard>
    </Stage>
  );

  const renderFindings = () => (
    <Stage
      screen="findings"
      title="Findings / Photos"
      subtitle="All findings in one place."
      banner={banner}
    >
      <ScreenCard
        kicker="Cross-Task Review"
        title="Findings"
        topBar={<TopBar onBack={() => setScreen("taskBoard")} backLabel="Task Board" />}
      >
        <div className="laiq-filter-bar">
          <Field label="Task">
            <select className="laiq-input" value={findingsTaskFilter} onChange={(e) => setFindingsTaskFilter(e.target.value)}>
              <option value="all">All tasks</option>
              {Array.from(new Set(findings.map((finding) => finding.sourceTaskLabel))).map((taskLabel) => (
                <option key={taskLabel} value={taskLabel}>
                  {taskLabel}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Severity">
            <select className="laiq-input" value={findingsSeverityFilter} onChange={(e) => setFindingsSeverityFilter(e.target.value)}>
              <option value="all">All severities</option>
              {severityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className="laiq-input" value={findingsStatusFilter} onChange={(e) => setFindingsStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              {Array.from(new Set(findings.map((finding) => finding.status))).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="laiq-record-list laiq-record-list-padded">
          {filteredFindings.length === 0 ? (
            <div className="laiq-empty-state">No findings match the current filters.</div>
          ) : (
            filteredFindings.map((finding) => (
              <div key={finding.id} className="laiq-record-row laiq-record-row-detail">
                <div className="laiq-record-copy">
                  <strong>{finding.title}</strong>
                  <span>
                    {finding.sourceTaskLabel} · {finding.locationSummary}
                  </span>
                  <span>
                    {finding.note || "No note"} · {finding.photoCount} photos
                  </span>
                </div>
                <div className="laiq-record-actions">
                  <StatusBadge status={finding.status} />
                  <StatusBadge status={finding.severity} />
                </div>
              </div>
            ))
          )}
        </div>
      </ScreenCard>
    </Stage>
  );

  const renderReview = () => (
    <Stage
      screen="review"
      title="Review"
      subtitle="Check before export."
      banner={banner}
    >
      <ScreenCard
        kicker="Pre-Export Check"
        title="Inspection review"
        topBar={<TopBar onBack={() => setScreen("taskBoard")} onSaveDraft={handleSaveDraft} backLabel="Task Board" />}
        footer={
          <div className="laiq-footer-bar">
            <div className="laiq-status-block">
              <span className="laiq-status-label">Readiness</span>
              <strong>{reviewWarnings.length > 0 ? "Export with warnings" : "Ready to export"}</strong>
            </div>
            <div className="laiq-footer-actions">
              <button type="button" className="laiq-button laiq-button-secondary" onClick={() => setScreen("taskBoard")}>
                Back to Tasks
              </button>
              <button type="button" className="laiq-button laiq-button-primary" onClick={() => setScreen("export")}>
                Continue to Export
              </button>
            </div>
          </div>
        }
      >
        <div className="laiq-form-grid laiq-form-grid-two">
          <section className="laiq-form-block">
            <div className="laiq-block-heading">
              <h3>Inspection Summary</h3>
              <p>High-level context only.</p>
            </div>
            <div className="laiq-chip-row">
              <div className="laiq-info-chip">
                <span>Tank</span>
                <strong>{setup.tankNumber || "—"}</strong>
              </div>
              <div className="laiq-info-chip">
                <span>Client</span>
                <strong>{setup.client || "—"}</strong>
              </div>
              <div className="laiq-info-chip">
                <span>Location</span>
                <strong>{setup.location || "—"}</strong>
              </div>
              <div className="laiq-info-chip">
                <span>Date</span>
                <strong>{setup.inspectionDate}</strong>
              </div>
            </div>
          </section>

          <section className="laiq-form-block">
            <div className="laiq-block-heading">
              <h3>Findings Summary</h3>
              <p>Counts only. Findings come from the task flows.</p>
            </div>
            <div className="laiq-mini-grid">
              <MetricCard label="Total Findings" value={`${findingSummary.total}`} />
              <MetricCard label="High Severity" value={`${findingSummary.high}`} />
              <MetricCard label="Needs Follow-Up" value={`${findingSummary.followUp}`} />
            </div>
          </section>
        </div>

        <div className="laiq-form-grid laiq-form-grid-two">
          <section className="laiq-form-block">
            <div className="laiq-block-heading">
              <h3>Task Status</h3>
              <p>Only active tasks are shown here.</p>
            </div>
            <div className="laiq-record-list">
              {visibleTaskCards
                .filter((task) => task.key !== "findingsPhotos")
                .map((task) => (
                  <div key={`review-${task.key}`} className="laiq-record-row">
                    <div className="laiq-record-copy">
                      <strong>{task.label}</strong>
                      <span>{getTaskStatus(task.key)}</span>
                    </div>
                    <button
                      type="button"
                      className="laiq-topbar-button"
                      onClick={() =>
                        setScreen(
                          task.key === "shellUt"
                            ? "shellUt"
                            : task.key === "roofUt"
                              ? "roofUt"
                              : task.key === "shellNozzles"
                                ? "shellNozzleUt"
                                : task.key === "roofNozzles"
                                  ? "roofNozzleUt"
                                  : "bottomMfl",
                        )
                      }
                    >
                      Open
                    </button>
                  </div>
                ))}
            </div>
          </section>

          <section className="laiq-form-block">
            <div className="laiq-block-heading">
              <h3>Warnings</h3>
              <p>High-signal issues only.</p>
            </div>
            {reviewWarnings.length === 0 ? (
              <div className="laiq-empty-state">No blocking warnings right now.</div>
            ) : (
              <ul className="laiq-warning-list">
                {reviewWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </ScreenCard>
    </Stage>
  );

  const renderExport = () => (
    <Stage
      screen="export"
      title="Export"
      subtitle="Export results."
      banner={banner}
    >
      <ScreenCard
        kicker="Structured Output"
        title="Export inspection data"
        topBar={<TopBar onBack={() => setScreen("review")} backLabel="Review" />}
        footer={
          <div className="laiq-footer-bar">
            <div className="laiq-status-block">
              <span className="laiq-status-label">Export State</span>
              <strong>{reviewWarnings.length > 0 ? "Export with warnings" : "Ready to export"}</strong>
            </div>
            <div className="laiq-footer-actions laiq-footer-actions-wide">
              <button type="button" className="laiq-button laiq-button-secondary" onClick={() => setScreen("home")}>
                Finish
              </button>
              <button
                type="button"
                className="laiq-button laiq-button-primary"
                onClick={() => setBanner("Prototype export complete: JSON + CSV + attachment references")}
              >
                Export
              </button>
            </div>
          </div>
        }
      >
        <div className="laiq-summary-grid">
          <MetricCard label="Tank" value={setup.tankNumber || "—"} />
          <MetricCard label="Completed Tasks" value={`${completedTaskCount}`} />
          <MetricCard label="Warnings" value={`${reviewWarnings.length}`} />
          <MetricCard label="Findings" value={`${findings.length}`} />
        </div>

        <div className="laiq-form-grid laiq-form-grid-two">
          <section className="laiq-form-block">
            <div className="laiq-block-heading">
              <h3>Outputs</h3>
              <p>These are the MVP export targets.</p>
            </div>
            <div className="laiq-record-list">
              <div className="laiq-record-row">
                <div className="laiq-record-copy">
                  <strong>Export JSON</strong>
                  <span>Structured inspection object for downstream processing</span>
                </div>
              </div>
              <div className="laiq-record-row">
                <div className="laiq-record-copy">
                  <strong>Export CSV</strong>
                  <span>Measurement tables for shell, roof, and nozzles</span>
                </div>
              </div>
              <div className="laiq-record-row">
                <div className="laiq-record-copy">
                  <strong>Attachment bundle reference</strong>
                  <span>Linked findings, photos, and MFL report attachments</span>
                </div>
              </div>
            </div>
          </section>

          <section className="laiq-form-block">
            <div className="laiq-block-heading">
              <h3>Warnings</h3>
              <p>Outstanding issues are repeated here for clarity.</p>
            </div>
            {reviewWarnings.length === 0 ? (
              <div className="laiq-empty-state">No outstanding warnings.</div>
            ) : (
              <ul className="laiq-warning-list">
                {reviewWarnings.map((warning) => (
                  <li key={`export-${warning}`}>{warning}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </ScreenCard>
    </Stage>
  );

  switch (screen) {
    case "home":
      return renderHome();
    case "setup":
      return renderSetup();
    case "scope":
      return renderScope();
    case "taskBoard":
      return renderTaskBoard();
    case "shellUt":
      return renderShellUt();
    case "shellFinding":
      return renderFindingScreen({
        screenKey: "shellFinding",
        title: "Shell Finding",
        onCancel: () => setScreen("shellUt"),
        preciseAllowed: true,
      });
    case "shellLayout":
      return renderShellLayoutSetup();
    case "shellPreciseLocation":
      return renderShellPreciseLocation();
    case "roofUt":
      return renderRoofUt();
    case "roofFinding":
      return renderFindingScreen({
        screenKey: "roofFinding",
        title: "Roof Finding",
        onCancel: () => setScreen("roofUt"),
        preciseAllowed: false,
      });
    case "shellNozzleUt":
      return renderShellNozzleUt();
    case "shellNozzleFinding":
      return renderFindingScreen({
        screenKey: "shellNozzleFinding",
        title: "Shell Nozzle Finding",
        onCancel: () => setScreen("shellNozzleUt"),
        preciseAllowed: false,
      });
    case "roofNozzleUt":
      return renderRoofNozzleUt();
    case "roofNozzleFinding":
      return renderFindingScreen({
        screenKey: "roofNozzleFinding",
        title: "Roof Nozzle Finding",
        onCancel: () => setScreen("roofNozzleUt"),
        preciseAllowed: false,
      });
    case "bottomMfl":
      return renderBottomMfl();
    case "findings":
      return renderFindings();
    case "review":
      return renderReview();
    case "export":
      return renderExport();
    default:
      return renderHome();
  }
}
