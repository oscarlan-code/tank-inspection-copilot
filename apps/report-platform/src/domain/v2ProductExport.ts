export type V2ProductExportProfile = {
  tenantId: string;
  tenantName: string;
  workspaceId: string;
  workspaceName: string;
  userId: string;
  displayName: string;
  roleLabel: string;
  deviceId: string;
};

export type V2ProductExportTask = {
  inspectionId: string;
  inspectionReference: string;
  tenantId: string;
  workspaceId: string;
  createdByUserId: string;
  lastEditedByUserId: string;
  deviceId: string;
  client: string;
  tankNumber: string;
  location: string;
  lifecycleState: string;
  currentScreenKey: string;
  readinessStatusCode: string;
  readinessStatusLabel: string;
  exportStatusCode: string;
  exportStatusLabel: string;
  archivedAtIso: string | null;
  exportedAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type V2ProductExportInspectionRecord = {
  inspectionId: string;
  tenantId: string;
  workspaceId: string;
  inspectionReference: string;
  createdByUserId: string;
  lastEditedByUserId: string;
  deviceId: string;
  schemaVersion: number;
  client: string;
  tankNumber: string;
  location: string;
  fieldLeaseName: string;
  inspector: string;
  externalRoofType: string | null;
  internalRoofType: string | null;
  referenceMode: string | null;
  referenceNote: string | null;
  diameterM: number | null;
  heightM: number | null;
  shellCourseCount: number | null;
  shellLaneCount: number | null;
  reviewStatus: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type V2ProductExportValidationResult = {
  inspectionId: string;
  ruleCode: string;
  ruleLabel: string;
  passed: boolean;
  blocksExport: boolean;
  message: string;
  updatedAtIso: string;
};

export type V2ProductExportTaskSnapshot = {
  inspectionId: string;
  taskKey: string;
  taskTitle: string;
  taskOrder: number;
  inScope: boolean;
  statusCode: string;
  statusLabel: string;
  isComplete: boolean;
  blocksExport: boolean;
  entryCount: number;
  referenceCount: number;
  updatedAtIso: string;
};

export type V2ProductExportLayoutTarget = {
  inspectionId: string;
  targetKey: string;
  targetLabel: string;
  surfaceKey: string;
  inLayoutScope: boolean;
  layoutApproved: boolean;
  elementInScope: boolean;
  elementApproved: boolean;
  utInScope: boolean;
  utApproved: boolean;
  updatedAtIso: string;
};

export type V2ProductExportLayoutConfig = {
  inspectionId: string;
  targetKey: string;
  surfaceKey: string;
  referenceMode: string | null;
  referenceNote: string | null;
  roofPattern: string | null;
  roofRingCount: number | null;
  roofSectorCount: number | null;
  roofRowCount: number | null;
  roofWidestRowPlateCount: number | null;
  roofHasCenterOpening: boolean | null;
  roofHasAnnularRing: boolean | null;
  roofAnnularSectionCount: number | null;
  shellCourseCount: number | null;
  shellPlatesPerCourse: number | null;
  shellLaneCount: number | null;
  shellPlateOffset: string | null;
  shellOffsetStartRow: string | null;
  shellThirdOffsetStart: string | null;
  floorTemplate: string | null;
  floorPlateCount: number | null;
  floorAnnularSectionCount: number | null;
  floorPatternCountX: number | null;
  floorPatternCountY: number | null;
  updatedAtIso: string;
};

export type V2ProductExportElement = {
  inspectionId: string;
  targetKey: string;
  elementId: string;
  elementLabel: string;
  elementTypeKey: string;
  normalizedX: number;
  normalizedY: number;
  updatedAtIso: string;
};

export type V2ProductExportUtMeasurement = {
  inspectionId: string;
  itemKey: string;
  targetKey: string;
  itemLabel: string;
  itemKind: string;
  elementTypeKey: string | null;
  nozzleSize: string | null;
  reinforcementPadReading: number | null;
  laneId: string | null;
  course: number | null;
  plateId: string | null;
  elementId: string | null;
  confirmed: boolean;
  measured: boolean;
  value1: number | null;
  value2: number | null;
  value3: number | null;
  value4: number | null;
  value5: number | null;
  updatedAtIso: string;
};

export type V2ProductExportChecklistItem = {
  inspectionId: string;
  sectionKey: string;
  sectionTitle: string;
  itemNumber: string;
  itemPrompt: string;
  ratingKey: string | null;
  ratingLabel: string | null;
  updatedAtIso: string;
};

export type V2ProductExportChecklistSectionNote = {
  inspectionId: string;
  sectionKey: string;
  sectionTitle: string;
  note: string;
  updatedAtIso: string;
};

export type V2ProductExportFinding = {
  inspectionId: string;
  findingId: string;
  targetKey: string;
  itemLabel: string;
  itemKind: string;
  elementTypeKey: string | null;
  linkedUtItemKey: string | null;
  note: string;
  attachmentCount: number;
  hasMissingAttachment: boolean;
  updatedAtIso: string;
};

export type V2ProductExportAttachment = {
  inspectionId: string;
  attachmentId: string;
  findingId: string | null;
  kind: string;
  relativePath: string;
  displayName: string;
  mediaType: string;
  fileByteSize: number | null;
  fileExists: boolean;
  annotationStrokeCount: number;
  annotationPointCount: number;
  updatedAtIso: string;
};

export type V2ProductExportPackage = {
  packageType: string;
  schemaVersion: number;
  inspectionReference: string;
  tenantId: string;
  workspaceId: string;
  inspectionId: string;
  exportedByUserId: string;
  exportedAtIso: string;
  deviceId: string;
  workflowScreen: string;
  profile: V2ProductExportProfile;
  task: V2ProductExportTask;
  inspectionRecord: V2ProductExportInspectionRecord;
  validationResults: V2ProductExportValidationResult[];
  taskSnapshots: V2ProductExportTaskSnapshot[];
  layoutTargets: V2ProductExportLayoutTarget[];
  layoutConfigs: V2ProductExportLayoutConfig[];
  elements: V2ProductExportElement[];
  utMeasurements: V2ProductExportUtMeasurement[];
  inspectionChecklistItems: V2ProductExportChecklistItem[];
  inspectionChecklistSectionNotes: V2ProductExportChecklistSectionNote[];
  findings: V2ProductExportFinding[];
  attachments: V2ProductExportAttachment[];
};
