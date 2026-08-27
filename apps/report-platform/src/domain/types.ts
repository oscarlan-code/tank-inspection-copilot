export type SectionKind = "structured" | "narrative" | "map" | "attachment";
export type WorkspaceDataSourceMode = "fixture" | "api";

export type SectionStatus = "not started" | "editing" | "approved";

export type MissingFieldInput = "text" | "textarea" | "date" | "select";

export type MissingField = {
  id: string;
  label: string;
  input: MissingFieldInput;
  value: string;
  suggestion?: string;
  detectedDraftValue?: string;
  reason: string;
  source: string;
  options?: string[];
};

export type ChatRole = "assistant" | "user";

export type AiControlRisk = "low" | "medium" | "high" | "blocked";

export type AiControlPlanner =
  | "deterministic_tool"
  | "structured_planner"
  | "clarification_guard"
  | "helpdesk_guard"
  | "fallback_guard";

export type AiControlStatus =
  | "applied"
  | "needs_confirmation"
  | "blocked"
  | "clarification"
  | "answered";

export type AiControlTrace = {
  intent: string;
  planner: AiControlPlanner;
  risk: AiControlRisk;
  target: string;
  operation: string;
  status: AiControlStatus;
  guardrails: string[];
  validation: string[];
  userConfirmationRequired: boolean;
  undoSnapshot: boolean;
  reason: string;
  alternative?: string;
};

export type AssistantPendingConfirmation = {
  confirmationId: string;
  label: string;
  summary: string;
  risk: AiControlRisk;
  operation: string;
  args?: Record<string, unknown>;
};

export type AssistantAction = {
  id: string;
  type:
    | "replace_section_content"
    | "apply_text_style"
    | "move_marker"
    | "resize_plate";
  label: string;
  reason: string;
  contentHtml?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: "normal" | "bold";
  textAlign?: "left" | "center";
  color?: string;
  styleScope?: "section" | "table" | "block";
  targetBlockId?: string;
  markerId?: string;
  deltaX?: number;
  deltaY?: number;
  plateId?: string;
  widthDelta?: number;
  heightDelta?: number;
};

export type TargetedEditAction =
  | "rephrase"
  | "shorten"
  | "enhance"
  | "to_points"
  | "to_paragraph"
  | "custom";

export type TargetedEditSelectionKind = "inline" | "block";

export type TargetedEditSelection = {
  from: number;
  to: number;
  selectedText: string;
  selectedHtml: string;
  documentHtml: string;
  documentHash: string;
  documentTextHash: string;
  selectionHash: string;
  selectionKind: TargetedEditSelectionKind;
  contextBefore: string;
  contextAfter: string;
};

export type TargetedEditRequest = {
  action: TargetedEditAction;
  instruction: string;
  expectedVersion: number;
  selection: TargetedEditSelection;
};

export type TargetedEditProposal = {
  proposalId: string;
  sectionId: string;
  action: TargetedEditAction;
  instruction: string;
  replacementHtml: string;
  replacementText: string;
  explanation: string;
  warnings: string[];
  expectedVersion: number;
  documentHash: string;
  selectionHash: string;
  providerCode: string;
  modelId: string | null;
  usedLiveModel: boolean;
  createdAtIso: string;
};

export type TargetedEditExecution = {
  executionId: string;
  proposal: TargetedEditProposal;
  selection: TargetedEditSelection;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  actions?: AssistantAction[];
  controlTrace?: AiControlTrace;
  pendingConfirmation?: AssistantPendingConfirmation;
  scope?: "section" | "selection";
  selectionPreview?: string;
};

export type LayoutMarkerType = "finding" | "element" | "weld";

export type LayoutEvidenceKind = "measurement" | "finding" | "element";

export type LayoutEvidenceAttachment = {
  attachmentId: string;
  displayName: string;
  relativePath: string;
  mediaType: string;
  fileExists: boolean;
  kind: string;
};

export type LayoutEvidenceItem = {
  id: string;
  kind: LayoutEvidenceKind;
  title: string;
  subtitle?: string;
  values?: string[];
  note?: string;
  attachments?: LayoutEvidenceAttachment[];
  source: string;
};

export type LayoutMarker = {
  id: string;
  label: string;
  type: LayoutMarkerType;
  x: number;
  y: number;
  source: string;
  hostLocation?: {
    surface: "roof" | "shell" | "floor";
    label: string;
    plateId?: string;
    regionId?: string;
    course?: number;
    laneId?: string;
    source: "derived_from_app_coordinates" | "exported_from_app";
  };
  evidence?: LayoutEvidenceItem[];
};

export type LayoutPoint = {
  x: number;
  y: number;
};

export type LayoutPlate = {
  id: string;
  label: string;
  mapLabel?: string;
  labelX?: number;
  labelY?: number;
  aliases?: string[];
  plateKind?: "main" | "annular";
  row: number;
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
  points?: LayoutPoint[];
  source: string;
  evidence?: LayoutEvidenceItem[];
};

export type FloorCorrosionBand = {
  minimumLossPercent: number;
  color: string;
  pixelCount: number;
};

export type FloorCorrosionOverlayStatus =
  | "matched"
  | "orientation_review_required"
  | "approved"
  | "blocked";

export type FloorCorrosionOverlay = {
  id: string;
  hostPlateId: string;
  scanPlateId: string;
  sourcePage: number;
  sourceDocumentName: string;
  sourceWidthMm: number;
  sourceHeightMm: number;
  artifactUri?: string;
  inlineImageDataUrl?: string;
  sourcePreviewArtifactUri?: string;
  sourcePreviewInlineImageDataUrl?: string;
  artifactSha256: string;
  sourcePreviewSha256?: string;
  corrosionPixelCount: number;
  bands: FloorCorrosionBand[];
  rotationDegrees: 0 | 90 | 180 | 270;
  flipX: boolean;
  flipY: boolean;
  scaleX?: number;
  scaleY?: number;
  offsetX?: number;
  offsetY?: number;
  opacity: number;
  status: FloorCorrosionOverlayStatus;
  reviewedByUserId?: string;
  reviewedAtIso?: string;
};

export type FloorCorrosionValidationIssue = {
  code: string;
  severity: "warning" | "error";
  plateId?: string;
  message: string;
};

export type FloorCorrosionMapData = {
  schemaVersion: 1;
  artifactRunId: string;
  sourceLayoutName: string;
  sourceMflDocumentName: string;
  generatedAtIso: string;
  overlays: FloorCorrosionOverlay[];
  unmatchedScanPlateIds: string[];
  platesWithoutScans: string[];
  validationIssues: FloorCorrosionValidationIssue[];
};

export type FloorSourceDrawingData = {
  schemaVersion: 1 | 2;
  artifactUri: string;
  foregroundArtifactUri?: string;
  inlineImageDataUrl?: string;
  foregroundInlineImageDataUrl?: string;
  width: number;
  height: number;
  sourceDocumentName: string;
  sourcePage: number;
  sourceSha256: string;
  calibrationProfile: string;
  renderMode?: "extracted_vector";
  generationRole: "immutable_layout_underlay" | "immutable_vector_layout";
};

export type LayoutDrawingBlock = {
  client: string;
  project: string;
  drawing: string;
  reference: string;
  referenceMode: string;
  updatedAtLabel: string;
};

export type LayoutSurfaceType = "roof" | "shell" | "floor";

export type AppOwnedLayoutFigure = {
  targetKey: string;
  renderVersion: number;
  sourceGeometryVersion: number;
  mediaType: "image/svg+xml";
  width: number;
  height: number;
  viewBox: string;
  sha256: string;
  svg: string;
};

export type AndroidLayoutMapConfig = {
  surfaceType: LayoutSurfaceType;
  referenceMode: string;
  referenceNote?: string | null;
  roof?: {
    template: string;
    rowCount: number;
    widestRowPlateCount: number;
    hasCenterOpening: boolean;
    hasAnnularRing: boolean;
    annularSectionCount: number;
    customCircularLayout?: unknown | null;
  };
  shell?: {
    courseCount: number;
    platesPerCourse: number;
    laneCount: number;
    plateOffset: string;
    offsetStartRow: string;
    thirdOffsetStart: string | null;
  };
  floor?: {
    template: string;
    rowCount: number;
    widestRowPlateCount: number;
    plateCount: number;
    hasAnnularRing: boolean;
    annularSectionCount: number;
    annularRotationDeg?: number;
    annularWidthRatio?: number;
    customCircularLayout?: unknown | null;
  };
};

export type LayoutMapData = {
  id: string;
  geometrySource?: "app_export" | "app_export_mock" | "report_side_approved_layout" | "reference_test_fixture" | "source_drawing_import";
  title: string;
  subtitle: string;
  surfaceLabel: string;
  legend: string[];
  markers: LayoutMarker[];
  plates: LayoutPlate[];
  evidenceByKey?: Record<string, LayoutEvidenceItem[]>;
  gridRows: number;
  gridColumns: number;
  drawingBlock: LayoutDrawingBlock;
  appMap?: AndroidLayoutMapConfig;
  appFigure?: AppOwnedLayoutFigure;
  floorCorrosion?: FloorCorrosionMapData;
  sourceDrawing?: FloorSourceDrawingData;
  selectedMarkerId?: string;
  overrideCount: number;
};

export type WorkspaceValidationResult = {
  ruleCode: string;
  ruleLabel: string;
  passed: boolean;
  blocksExport: boolean;
  message: string;
};

export type WorkspaceImportSummary = {
  dataSourceMode: WorkspaceDataSourceMode;
  packageType: string;
  schemaVersion: number;
  inspectionId: string;
  inspectionReference: string;
  exportedByUserId: string;
  exportedAtIso: string;
  tenantId: string;
  tenantName: string;
  workspaceId: string;
  workspaceName: string;
  roleLabel: string;
  workflowScreen: string;
  validationResults: WorkspaceValidationResult[];
  findingCount: number;
  attachmentCount: number;
  measurementCount: number;
};

export type WorkspaceApiLinks = {
  apiBaseUrl: string;
  importInspectionPath: string;
  loadReportJobPath: string;
  resetDraftsPath: string;
  saveSectionDraftPath: string;
  saveManualInputsPath: string;
  saveLayoutOverridePath: string;
  generateSectionPath: string;
  sectionChatPath: string;
  targetedEditPath: string;
  restorePreviousSectionPath: string;
  approveSectionPath: string;
  exportDocxPath: string;
};

export type ReportSection = {
  id: string;
  number: string;
  title: string;
  shortLabel: string;
  kind: SectionKind;
  generated: boolean;
  edited: boolean;
  approved: boolean;
  reviewRequired: boolean;
  description: string;
  content: string;
  aiHint: string;
  templateExpectation: string;
  sourceSummary: string;
  rawAppData?: string;
  version?: number;
  layoutVersion?: number;
  previousVersionCount?: number;
  missingFields: MissingField[];
  layoutMap?: LayoutMapData;
};

export type WorkspaceReport = {
  id: string;
  title: string;
  reference: string;
  client: string;
  tank: string;
  inspectedDate: string;
  manualInputsRevision: number;
  importSummary: WorkspaceImportSummary;
  apiLinks: WorkspaceApiLinks;
  sections: ReportSection[];
};
