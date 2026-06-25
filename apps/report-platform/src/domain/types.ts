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

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  actions?: AssistantAction[];
  controlTrace?: AiControlTrace;
  pendingConfirmation?: AssistantPendingConfirmation;
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

export type LayoutPlate = {
  id: string;
  label: string;
  row: number;
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
  source: string;
  evidence?: LayoutEvidenceItem[];
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
  };
};

export type LayoutMapData = {
  id: string;
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
  importSummary: WorkspaceImportSummary;
  apiLinks: WorkspaceApiLinks;
  sections: ReportSection[];
};
