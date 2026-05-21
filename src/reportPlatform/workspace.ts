export type SectionStatus = "auto" | "auto + review" | "manual required" | "blocked";
export type SectionMode = "preview" | "layout" | "checklist";
export type LayoutSceneKind = "shell" | "roof";
export type ReviewState = "draft" | "ready_for_upload" | "uploaded" | "reviewed";

export type CanonicalInspectionPackage = {
  schemaVersion: string;
  packageId: string;
  inspection: {
    inspectionId: string;
    client: string;
    site: string;
    tankNumber: string;
    inspectionType: string;
    startedAt: string;
    completedAt?: string | null;
    inspector: string;
    deviceId?: string | null;
  };
  tankMaster: {
    diameterM: number;
    heightM: number;
    roofType: string;
    shellCourseCount: number;
    referenceMode?: string | null;
    startReference?: string | null;
  };
  shellLinePlan: {
    lineCount: number;
    recommendedLineCount?: number | null;
    startReference: string;
    rotationDirection: string;
    lines?: Array<{
      lineId: string;
      label: string;
      azimuthDeg: number;
    }>;
  };
  roofLayout?: {
    template: string;
    rowCount?: number | null;
    widestRowPlateCount?: number | null;
    ringCount?: number | null;
    sectorCount?: number | null;
    centerOpeningRatio?: number | null;
    features?: Array<{
      featureId: string;
      type: string;
      label?: string | null;
      placementMode?: string | null;
      plateId?: string | null;
      azimuthDeg?: number | null;
      radiusRatio?: number | null;
    }>;
  } | null;
  nozzleRegistries?: {
    shell?: CanonicalNozzleDefinition[];
    roof?: CanonicalNozzleDefinition[];
  } | null;
  measurements: {
    shellUtRows?: CanonicalShellUtRow[];
    roofUtRows?: CanonicalRoofUtRow[];
    shellNozzleUtRows?: CanonicalNozzleUtRow[];
    roofNozzleUtRows?: CanonicalNozzleUtRow[];
  };
  findings: CanonicalFinding[];
  attachments: CanonicalAttachment[];
  mflImport?: {
    contractor?: string | null;
    reportReference?: string | null;
    reportDate?: string | null;
    severity?: string | null;
    attachmentId?: string | null;
  } | null;
  reviewStatus: {
    status: ReviewState;
    warnings?: string[];
  };
};

export type CanonicalNozzleDefinition = {
  nozzleId: string;
  surface: "shell" | "roof" | string;
  size: string;
  placementMode?: string | null;
  course?: number | null;
  azimuthDeg?: number | null;
  plateId?: string | null;
};

export type CanonicalShellUtRow = {
  rowId: string;
  lineId: string;
  course: number;
  readingsMm: number[];
  note?: string | null;
};

export type CanonicalRoofUtRow = {
  rowId: string;
  plateId: string;
  readingsMm: number[];
  note?: string | null;
};

export type CanonicalNozzleUtRow = {
  rowId: string;
  nozzleId: string;
  readingsMm: number[];
  note?: string | null;
};

export type CanonicalFinding = {
  findingId: string;
  surface: string;
  type: string;
  severity: string;
  note?: string | null;
  linkedMeasurementId?: string | null;
  locationSummary?: string | null;
  attachmentIds?: string[];
};

export type CanonicalAttachment = {
  attachmentId: string;
  kind: "photo" | "mfl_report" | "other" | string;
  relativePath: string;
  caption?: string | null;
};

export type ReportSection = {
  id: string;
  title: string;
  group: string;
  status: SectionStatus;
  summary: string;
  modes: SectionMode[];
  draft: string;
  facts: string[];
  layoutScene?: LayoutSceneKind;
};

export type ChecklistItem = {
  id: string;
  label: string;
  reference: string;
  answer: "pass" | "needs review" | "not examined" | "";
  note: string;
};

export type LayoutMarker = {
  id: string;
  label: string;
  kind: "finding" | "nozzle" | "measurement";
  severity?: "low" | "medium" | "high";
  x: number;
  y: number;
  description: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type ReportWorkspace = {
  workspaceMeta: {
    tenantId: string;
    clientAccountId: string;
    siteId: string;
    tankId: string;
    inspectionJobId: string;
    reportWorkspaceId: string;
    uploadedAtIso: string;
    sourceFileName: string;
    validation: ValidationResult;
  };
  sourcePackage: CanonicalInspectionPackage;
  packageAssets: string[];
  standardsLibrary: string[];
  sections: ReportSection[];
  checklist: ChecklistItem[];
  layoutScenes: Record<LayoutSceneKind, LayoutMarker[]>;
};

const fallbackStandardsLibrary = [
  "API 653",
  "API 575",
  "IRS sample report TK-465",
  "Historical approved report library",
];

const defaultChecklistItems: ChecklistItem[] = [
  {
    id: "check-dike-area",
    label: "Diked area condition reviewed for vegetation, debris, and erosion.",
    reference: "IRS checklist / API 575 external inspection practice",
    answer: "",
    note: "",
  },
  {
    id: "check-shell-corrosion",
    label: "Shell corrosion observations aligned with captured UT and finding evidence.",
    reference: "API 653 shell inspection expectations",
    answer: "",
    note: "",
  },
  {
    id: "check-roof-condition",
    label: "Roof condition reviewed against UT coverage and visible evidence.",
    reference: "API 575 roof inspection practice",
    answer: "",
    note: "",
  },
  {
    id: "check-nozzle-state",
    label: "Nozzle and reinforcement pad inspection status recorded.",
    reference: "Nozzle UT lane / report section alignment",
    answer: "",
    note: "",
  },
];

export async function parseCanonicalPackageFile(file: File): Promise<CanonicalInspectionPackage> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new Error(`Invalid JSON file: ${message}`);
  }

  const validation = validateCanonicalPackage(parsed);
  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  return parsed as CanonicalInspectionPackage;
}

export function validateCanonicalPackage(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isObject(raw)) {
    return {
      valid: false,
      errors: ["The uploaded file is not a JSON object."],
      warnings,
    };
  }

  if (raw.schemaVersion !== "0.1.0") {
    errors.push(`Unsupported schemaVersion "${String(raw.schemaVersion ?? "")}". Expected 0.1.0.`);
  }

  const requiredKeys = [
    "packageId",
    "inspection",
    "tankMaster",
    "shellLinePlan",
    "measurements",
    "findings",
    "attachments",
    "reviewStatus",
  ] as const;
  requiredKeys.forEach((key) => {
    if (!(key in raw)) {
      errors.push(`Missing required top-level field "${key}".`);
    }
  });

  if (!isNonEmptyString(raw.packageId)) {
    errors.push("packageId must be a non-empty string.");
  }

  if (!isObject(raw.inspection)) {
    errors.push("inspection must be an object.");
  } else {
    const inspection = raw.inspection;
    const inspectionKeys = ["inspectionId", "client", "site", "tankNumber", "inspectionType", "startedAt", "inspector"] as const;
    inspectionKeys.forEach((key) => {
      if (!isNonEmptyString(inspection[key])) {
        errors.push(`inspection.${key} must be a non-empty string.`);
      }
    });
  }

  if (!isObject(raw.tankMaster)) {
    errors.push("tankMaster must be an object.");
  } else {
    const tankMaster = raw.tankMaster;
    if (typeof tankMaster.diameterM !== "number" || tankMaster.diameterM <= 0) {
      errors.push("tankMaster.diameterM must be a positive number.");
    }
    if (typeof tankMaster.heightM !== "number" || tankMaster.heightM <= 0) {
      errors.push("tankMaster.heightM must be a positive number.");
    }
    if (!isNonEmptyString(tankMaster.roofType)) {
      errors.push("tankMaster.roofType must be a non-empty string.");
    }
    if (typeof tankMaster.shellCourseCount !== "number" || tankMaster.shellCourseCount < 1) {
      errors.push("tankMaster.shellCourseCount must be a positive integer.");
    }
  }

  if (!isObject(raw.shellLinePlan)) {
    errors.push("shellLinePlan must be an object.");
  } else {
    const shellLinePlan = raw.shellLinePlan;
    if (typeof shellLinePlan.lineCount !== "number" || shellLinePlan.lineCount < 1) {
      errors.push("shellLinePlan.lineCount must be a positive integer.");
    }
    if (!isNonEmptyString(shellLinePlan.startReference)) {
      errors.push("shellLinePlan.startReference must be a non-empty string.");
    }
    if (!isNonEmptyString(shellLinePlan.rotationDirection)) {
      errors.push("shellLinePlan.rotationDirection must be a non-empty string.");
    }
  }

  if (!isObject(raw.measurements)) {
    errors.push("measurements must be an object.");
  }

  if (!Array.isArray(raw.findings)) {
    errors.push("findings must be an array.");
  }

  if (!Array.isArray(raw.attachments)) {
    errors.push("attachments must be an array.");
  }

  if (!isObject(raw.reviewStatus) || !isNonEmptyString(raw.reviewStatus.status)) {
    errors.push("reviewStatus.status must be present.");
  }

  if (!errors.length && isObject(raw.measurements)) {
    const shellRows = Array.isArray(raw.measurements.shellUtRows) ? raw.measurements.shellUtRows.length : 0;
    const roofRows = Array.isArray(raw.measurements.roofUtRows) ? raw.measurements.roofUtRows.length : 0;
    const nozzleRows =
      (Array.isArray(raw.measurements.shellNozzleUtRows) ? raw.measurements.shellNozzleUtRows.length : 0) +
      (Array.isArray(raw.measurements.roofNozzleUtRows) ? raw.measurements.roofNozzleUtRows.length : 0);

    if (shellRows === 0) {
      warnings.push("No shell UT rows were found in the uploaded package.");
    }
    if (roofRows === 0) {
      warnings.push("No roof UT rows were found in the uploaded package.");
    }
    if (nozzleRows === 0) {
      warnings.push("No nozzle UT rows were found in the uploaded package.");
    }
  }

  if (isObject(raw.reviewStatus) && Array.isArray(raw.reviewStatus.warnings)) {
    raw.reviewStatus.warnings.forEach((warning) => {
      if (typeof warning === "string" && warning.trim()) {
        warnings.push(warning);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function createWorkspaceFromPackage(
  pkg: CanonicalInspectionPackage,
  sourceFileName: string,
  options?: Partial<Pick<ReportWorkspace["workspaceMeta"], "tenantId" | "uploadedAtIso">>,
): ReportWorkspace {
  const validation = validateCanonicalPackage(pkg);
  const shellRows = pkg.measurements.shellUtRows ?? [];
  const roofRows = pkg.measurements.roofUtRows ?? [];
  const shellNozzleRows = pkg.measurements.shellNozzleUtRows ?? [];
  const roofNozzleRows = pkg.measurements.roofNozzleUtRows ?? [];
  const shellNozzles = pkg.nozzleRegistries?.shell ?? [];
  const roofNozzles = pkg.nozzleRegistries?.roof ?? [];
  const reviewWarnings = pkg.reviewStatus.warnings ?? [];
  const reviewStatus = pkg.reviewStatus.status.replace(/_/g, " ");

  const generalFacts = [
    `Client: ${pkg.inspection.client}`,
    `Site: ${pkg.inspection.site}`,
    `Tank Number: ${pkg.inspection.tankNumber}`,
    `Inspector: ${pkg.inspection.inspector}`,
    `Diameter: ${pkg.tankMaster.diameterM} m`,
    `Height: ${pkg.tankMaster.heightM} m`,
    `Shell courses: ${pkg.tankMaster.shellCourseCount}`,
    `Roof type: ${pkg.tankMaster.roofType}`,
  ];
  if (pkg.tankMaster.startReference) {
    generalFacts.push(`Reference start: ${pkg.tankMaster.startReference}`);
  }

  const narrativeFacts = [
    `${shellRows.length} shell UT rows captured`,
    `${roofRows.length} roof UT rows captured`,
    `${shellNozzleRows.length + roofNozzleRows.length} nozzle UT rows captured`,
    `${pkg.findings.length} findings linked to evidence`,
    `${pkg.attachments.length} attachments available for review`,
    `Review state: ${reviewStatus}`,
  ];

  const shellStatus: SectionStatus = shellRows.length > 0 ? "auto" : "blocked";
  const roofStatus: SectionStatus = roofRows.length > 0 ? "auto + review" : "blocked";
  const evidenceStatus: SectionStatus =
    pkg.findings.length > 0 || pkg.attachments.length > 0 ? "auto + review" : "manual required";
  const recommendationStatus: SectionStatus = validation.valid ? "manual required" : "blocked";

  const shellMeasurementFacts = [
    `${shellRows.length} shell UT rows exported`,
    `${pkg.shellLinePlan.lineCount} crawler lanes`,
    `${pkg.tankMaster.shellCourseCount} shell courses`,
    `${pkg.findings.filter((finding) => finding.surface === "shell").length} shell findings linked`,
  ];

  const roofMeasurementFacts = [
    `${roofRows.length} roof UT rows exported`,
    `Roof layout: ${pkg.roofLayout?.template ?? "not provided"}`,
    `${roofNozzles.length} roof nozzles registered`,
    `${pkg.findings.filter((finding) => finding.surface === "roof").length} roof findings linked`,
  ];

  const sections: ReportSection[] = [
    {
      id: "general-information",
      title: "General Tank Information",
      group: "Report Template",
      status: validation.valid ? "auto + review" : "blocked",
      summary: "Client, tank identity, service envelope, and inspection metadata hydrated from the canonical package.",
      modes: ["preview"],
      draft: `${pkg.inspection.tankNumber} is a ${pkg.inspection.inspectionType.replace(/_/g, " ")} inspection package for ${pkg.inspection.client} at ${pkg.inspection.site}. The uploaded field package already provides tank geometry, line-plan context, and review-state metadata, but the final document wording still needs report-level editing and confirmation.`,
      facts: generalFacts,
    },
    {
      id: "inspection-report",
      title: "Inspection Report Narrative",
      group: "Report Template",
      status: "auto + review",
      summary: "Draft narrative assembled from coverage counts, findings, and review-state metadata.",
      modes: ["preview"],
      draft: `The uploaded package currently includes ${shellRows.length} shell UT rows, ${roofRows.length} roof UT rows, and ${pkg.findings.length} findings linked to evidence. This section should be refined with inspector observations, limitations, and client-facing wording before the report is released.`,
      facts: narrativeFacts,
    },
    {
      id: "inspection-checklist",
      title: "Tank Inspection Checklist",
      group: "Report Template",
      status: "manual required",
      summary: "Inspector-completed checklist section that stays in the web workspace rather than the Android export.",
      modes: ["checklist", "preview"],
      draft: "Checklist outcomes will be summarized here after the inspector completes and confirms the section.",
      facts: [
        "Checklist answers are web-entered, not carried by the Android package today.",
        "Each item should support quick notes and later report phrasing.",
        "This section should be explicitly confirmed before moving forward.",
      ],
    },
    {
      id: "shell-thickness",
      title: "Shell Plate Thickness Measurements",
      group: "Measurements",
      status: shellStatus,
      summary: "Structured shell UT rows and shell line-plan context from the uploaded package.",
      modes: ["preview", "layout"],
      layoutScene: "shell",
      draft: `Shell ultrasonic thickness measurements were exported across ${pkg.shellLinePlan.lineCount} crawler lanes. The reviewer can inspect the narrative, cross-check the shell line plan, and use the layout workspace to understand where each row and linked finding sits on the tank shell.`,
      facts: shellMeasurementFacts,
    },
    {
      id: "roof-thickness",
      title: "Roof Plate Thickness Measurements",
      group: "Measurements",
      status: roofStatus,
      summary: "Roof UT rows and roof-layout context generated from the uploaded package.",
      modes: ["preview", "layout"],
      layoutScene: "roof",
      draft: `Roof ultrasonic thickness measurements were exported with plate references that can be rendered into a larger web review layout. Final report wording should still document any assumptions or manual overrides used for plate context and original thickness interpretation.`,
      facts: roofMeasurementFacts,
    },
    {
      id: "layout-evidence",
      title: "Layout and Evidence Review",
      group: "Evidence",
      status: evidenceStatus,
      summary: "Interactive shell and roof layout review with finding markers, nozzle references, and attachment context.",
      modes: ["layout", "preview"],
      layoutScene: "shell",
      draft: `The layout workspace should let reviewers verify that report narrative, findings, and attachments stay aligned with the physical location context. ${pkg.attachments.length} attachment references and ${pkg.findings.length} findings are available from the uploaded package for this stage.`,
      facts: [
        `${pkg.attachments.length} attachment references exported`,
        `${pkg.findings.length} findings available for location review`,
        `${shellNozzles.length + roofNozzles.length} nozzle definitions available`,
        `${reviewWarnings.length} package review warnings carried over`,
      ],
    },
    {
      id: "recommendations",
      title: "Repair Recommendations / API Assessment",
      group: "Assessment",
      status: recommendationStatus,
      summary: "Deterministic calculations plus human-approved recommendations built on top of captured evidence.",
      modes: ["preview"],
      draft: `Recommendations should be drafted from deterministic calculations, the uploaded findings set, and standards-grounded review support. The language can be AI-assisted, but the engineering conclusion must remain human-approved before this section is shared.`,
      facts: [
        `${reviewWarnings.length} review warnings currently attached to the package`,
        `${pkg.mflImport ? "MFL metadata present for later report incorporation" : "No MFL metadata included in this package"}`,
        "Standards support should come from retrieved API guidance, not copied report text.",
      ],
    },
  ];

  const tenantId = options?.tenantId ?? "tenant-irs";
  const clientAccountId = slugify(pkg.inspection.client);
  const siteId = slugify(pkg.inspection.site);
  const tankId = `tank-${slugify(pkg.inspection.tankNumber)}`;
  const inspectionJobId = pkg.inspection.inspectionId || `job-${slugify(pkg.packageId)}`;

  return {
    workspaceMeta: {
      tenantId,
      clientAccountId,
      siteId,
      tankId,
      inspectionJobId,
      reportWorkspaceId: `workspace-${slugify(pkg.packageId)}`,
      uploadedAtIso: options?.uploadedAtIso ?? new Date().toISOString(),
      sourceFileName,
      validation,
    },
    sourcePackage: pkg,
    packageAssets: buildPackageAssets(pkg),
    standardsLibrary: fallbackStandardsLibrary,
    sections,
    checklist: defaultChecklistItems.map((item) => ({ ...item })),
    layoutScenes: {
      shell: buildShellMarkers(pkg),
      roof: buildRoofMarkers(pkg),
    },
  };
}

export function createDefaultWorkspace(): ReportWorkspace {
  const demoPackage: CanonicalInspectionPackage = {
    schemaVersion: "0.1.0",
    packageId: "pkg-demo-tk-465-2026-05-21",
    inspection: {
      inspectionId: "insp-demo-tk-465-2026-05-21",
      client: "TJS Pte Ltd (Chemstationasia Group)",
      site: "Tanjong Penjuru Terminal",
      tankNumber: "465",
      inspectionType: "internal_external",
      startedAt: "2026-05-21T08:30:00Z",
      completedAt: null,
      inspector: "IRS Demo Inspector",
      deviceId: "android-tablet-demo-01",
    },
    tankMaster: {
      diameterM: 7.8,
      heightM: 9.14,
      roofType: "fixed_cone",
      shellCourseCount: 4,
      referenceMode: "tank_north",
      startReference: "N",
    },
    shellLinePlan: {
      lineCount: 4,
      recommendedLineCount: 4,
      startReference: "N",
      rotationDirection: "clockwise",
      lines: [
        { lineId: "line-01", label: "N", azimuthDeg: 0 },
        { lineId: "line-02", label: "E", azimuthDeg: 90 },
        { lineId: "line-03", label: "S", azimuthDeg: 180 },
        { lineId: "line-04", label: "W", azimuthDeg: 270 },
      ],
    },
    roofLayout: {
      template: "circular_plate",
      rowCount: 3,
      widestRowPlateCount: 8,
      ringCount: null,
      sectorCount: null,
      centerOpeningRatio: null,
      features: [
        {
          featureId: "roof-feature-01",
          type: "manhole",
          label: "MH-1",
          placementMode: "plate_linked",
          plateId: "R2-P3",
          azimuthDeg: null,
          radiusRatio: null,
        },
      ],
    },
    nozzleRegistries: {
      shell: [
        {
          nozzleId: "SN-02",
          surface: "shell",
          size: "8 in",
          placementMode: "explicit",
          course: 2,
          azimuthDeg: 92,
          plateId: null,
        },
      ],
      roof: [
        {
          nozzleId: "RN-01",
          surface: "roof",
          size: "6 in",
          placementMode: "sketch",
          course: null,
          azimuthDeg: 140,
          plateId: "R3-P5",
        },
      ],
    },
    measurements: {
      shellUtRows: [
        { rowId: "shell-ut-001", lineId: "line-01", course: 1, readingsMm: [6.31, 6.28, 6.25, 6.3, 6.27], note: null },
        { rowId: "shell-ut-002", lineId: "line-02", course: 2, readingsMm: [6.22, 6.18, 6.2, 6.17, 6.16], note: null },
        { rowId: "shell-ut-003", lineId: "line-03", course: 3, readingsMm: [6.1, 6.09, 6.05, 6.08, 6.07], note: "Localized thinning zone" },
      ],
      roofUtRows: [
        { rowId: "roof-ut-001", plateId: "R2-P3", readingsMm: [5.1, 5.0, 4.98, 5.02, 5.04], note: "Near manhole" },
        { rowId: "roof-ut-002", plateId: "R3-P5", readingsMm: [4.92, 4.95, 4.93, 4.91, 4.9], note: null },
      ],
      shellNozzleUtRows: [
        { rowId: "shell-nozzle-ut-001", nozzleId: "SN-02", readingsMm: [7.1, 7.0, 6.95], note: "Reinforcement pad recorded separately in field notes" },
      ],
      roofNozzleUtRows: [],
    },
    findings: [
      {
        findingId: "finding-001",
        surface: "shell",
        type: "corrosion",
        severity: "high",
        note: "Localized wall-loss area linked to shell course 3.",
        linkedMeasurementId: "shell-ut-003",
        locationSummary: "Line S / Course 3",
        attachmentIds: ["photo-001"],
      },
      {
        findingId: "finding-002",
        surface: "roof",
        type: "coating_breakdown",
        severity: "medium",
        note: "Coating degradation around roof feature.",
        linkedMeasurementId: "roof-ut-001",
        locationSummary: "Roof plate R2-P3",
        attachmentIds: ["photo-002"],
      },
    ],
    attachments: [
      {
        attachmentId: "photo-001",
        kind: "photo",
        relativePath: "photos/photo-001.jpg",
        caption: "Localized shell thinning area",
      },
      {
        attachmentId: "photo-002",
        kind: "photo",
        relativePath: "photos/photo-002.jpg",
        caption: "Roof feature coating condition",
      },
    ],
    mflImport: null,
    reviewStatus: {
      status: "ready_for_upload",
      warnings: ["Original roof thickness not yet confirmed for calculations."],
    },
  };

  return createWorkspaceFromPackage(demoPackage, "demo-package.json");
}

function buildPackageAssets(pkg: CanonicalInspectionPackage): string[] {
  const assets = ["inspection-package.json"];
  pkg.attachments.forEach((attachment) => {
    assets.push(attachment.relativePath);
  });
  if (pkg.findings.length > 0) {
    assets.push(`findings/${pkg.findings.length} linked records`);
  }
  if ((pkg.measurements.shellUtRows?.length ?? 0) > 0) {
    assets.push(`measurements/shellUtRows (${pkg.measurements.shellUtRows?.length ?? 0})`);
  }
  if ((pkg.measurements.roofUtRows?.length ?? 0) > 0) {
    assets.push(`measurements/roofUtRows (${pkg.measurements.roofUtRows?.length ?? 0})`);
  }
  if (pkg.mflImport) {
    assets.push("mflImport metadata");
  }
  return assets;
}

function buildShellMarkers(pkg: CanonicalInspectionPackage): LayoutMarker[] {
  const lines = pkg.shellLinePlan.lines ?? [];
  const lineOrder = new Map(lines.map((line, index) => [line.lineId, index]));
  const shellRows = pkg.measurements.shellUtRows ?? [];
  const shellNozzles = pkg.nozzleRegistries?.shell ?? [];
  const findings = pkg.findings.filter((finding) => finding.surface === "shell");
  const markerSource = new Map(shellRows.map((row) => [row.rowId, row]));
  const courseCount = Math.max(pkg.tankMaster.shellCourseCount, 1);

  const measurementMarkers = shellRows.map((row) => {
    const lineIndex = lineOrder.get(row.lineId) ?? 0;
    const x = 18 + normalizedPosition(lineIndex, Math.max(lines.length - 1, 1)) * 64;
    const y = 16 + normalizedPosition(row.course - 1, Math.max(courseCount - 1, 1)) * 48;
    const lineLabel = lines[lineIndex]?.label ?? row.lineId;
    return {
      id: row.rowId,
      label: `${lineLabel}-C${row.course}`,
      kind: "measurement" as const,
      x,
      y,
      description: `Shell UT row ${row.rowId} on ${lineLabel}, course ${row.course}. Average reading ${average(row.readingsMm).toFixed(2)} mm.`,
    };
  });

  const nozzleMarkers = shellNozzles.map((nozzle) => {
    const x = 18 + normalizedPosition(nozzle.azimuthDeg ?? 0, 360) * 64;
    const y = 18 + normalizedPosition((nozzle.course ?? 2) - 1, Math.max(courseCount - 1, 1)) * 46;
    return {
      id: `nozzle-${nozzle.nozzleId}`,
      label: nozzle.nozzleId,
      kind: "nozzle" as const,
      x,
      y,
      description: `Shell nozzle ${nozzle.nozzleId} (${nozzle.size})${nozzle.course ? ` on course ${nozzle.course}` : ""}.`,
    };
  });

  const findingMarkers = findings.map((finding) => {
    const linkedRow = finding.linkedMeasurementId ? markerSource.get(finding.linkedMeasurementId) : undefined;
    const linkedMeasurementMarker = linkedRow ? measurementMarkers.find((marker) => marker.id === linkedRow.rowId) : undefined;
    const x = linkedMeasurementMarker?.x ?? 24 + (measurementMarkers.length % 5) * 10;
    const y = linkedMeasurementMarker?.y ?? 22 + (measurementMarkers.length % 4) * 10;
    return {
      id: finding.findingId,
      label: `F-${finding.findingId.slice(-3)}`,
      kind: "finding" as const,
      severity: toSeverity(finding.severity),
      x: x + 4,
      y: y - 4,
      description: finding.note ?? finding.locationSummary ?? `Shell finding ${finding.type}.`,
    };
  });

  return [...measurementMarkers, ...nozzleMarkers, ...findingMarkers];
}

function buildRoofMarkers(pkg: CanonicalInspectionPackage): LayoutMarker[] {
  const roofRows = pkg.measurements.roofUtRows ?? [];
  const roofNozzles = pkg.nozzleRegistries?.roof ?? [];
  const roofFeatures = pkg.roofLayout?.features ?? [];
  const findings = pkg.findings.filter((finding) => finding.surface === "roof");
  const rowMap = new Map(roofRows.map((row) => [row.rowId, row]));

  const measurementMarkers = roofRows.map((row) => {
    const position = roofPositionFromPlateId(row.plateId, pkg.roofLayout?.rowCount ?? 3, pkg.roofLayout?.widestRowPlateCount ?? 8);
    return {
      id: row.rowId,
      label: row.plateId,
      kind: "measurement" as const,
      x: position.x,
      y: position.y,
      description: `Roof UT row ${row.rowId} on plate ${row.plateId}. Average reading ${average(row.readingsMm).toFixed(2)} mm.`,
    };
  });

  const nozzleMarkers = roofNozzles.map((nozzle) => {
    const position = nozzle.plateId
      ? roofPositionFromPlateId(nozzle.plateId, pkg.roofLayout?.rowCount ?? 3, pkg.roofLayout?.widestRowPlateCount ?? 8)
      : roofPositionFromPolar(nozzle.azimuthDeg ?? 0, 0.75);
    return {
      id: `roof-nozzle-${nozzle.nozzleId}`,
      label: nozzle.nozzleId,
      kind: "nozzle" as const,
      x: position.x,
      y: position.y,
      description: `Roof nozzle ${nozzle.nozzleId} (${nozzle.size}).`,
    };
  });

  const featureMarkers = roofFeatures.map((feature) => {
    const position = feature.plateId
      ? roofPositionFromPlateId(feature.plateId, pkg.roofLayout?.rowCount ?? 3, pkg.roofLayout?.widestRowPlateCount ?? 8)
      : roofPositionFromPolar(feature.azimuthDeg ?? 0, feature.radiusRatio ?? 0.4);
    return {
      id: `feature-${feature.featureId}`,
      label: feature.label ?? feature.type,
      kind: "measurement" as const,
      x: position.x,
      y: position.y,
      description: `Roof feature ${feature.label ?? feature.type}.`,
    };
  });

  const findingMarkers = findings.map((finding) => {
    const linkedRow = finding.linkedMeasurementId ? rowMap.get(finding.linkedMeasurementId) : undefined;
    const linkedMeasurementMarker = linkedRow ? measurementMarkers.find((marker) => marker.id === linkedRow.rowId) : undefined;
    const x = linkedMeasurementMarker?.x ?? 52;
    const y = linkedMeasurementMarker?.y ?? 28;
    return {
      id: finding.findingId,
      label: `F-${finding.findingId.slice(-3)}`,
      kind: "finding" as const,
      severity: toSeverity(finding.severity),
      x: x + 3,
      y: y - 3,
      description: finding.note ?? finding.locationSummary ?? `Roof finding ${finding.type}.`,
    };
  });

  return [...featureMarkers, ...measurementMarkers, ...nozzleMarkers, ...findingMarkers];
}

function roofPositionFromPlateId(plateId: string, rowCount: number, widestRowPlateCount: number): { x: number; y: number } {
  const match = /^R(\d+)-P(\d+)$/i.exec(plateId.trim());
  if (!match) {
    return roofPositionFromPolar(0, 0.45);
  }

  const row = Number(match[1]);
  const plate = Number(match[2]);
  const safeRowCount = Math.max(rowCount, 1);
  const safePlateCount = Math.max(widestRowPlateCount, 1);
  const radiusRatio = row / (safeRowCount + 1);
  const angle = ((plate - 1) / safePlateCount) * 360;
  return roofPositionFromPolar(angle, radiusRatio);
}

function roofPositionFromPolar(azimuthDeg: number, radiusRatio: number): { x: number; y: number } {
  const clampedRadius = Math.max(0, Math.min(radiusRatio, 0.92));
  const angle = ((azimuthDeg - 90) * Math.PI) / 180;
  return {
    x: 50 + Math.cos(angle) * 25 * clampedRadius,
    y: 40 + Math.sin(angle) * 25 * clampedRadius,
  };
}

function toSeverity(severity: string): LayoutMarker["severity"] {
  const normalized = severity.trim().toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  return "medium";
}

function normalizedPosition(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(value / max, 1));
}

function average(readings: number[]): number {
  if (readings.length === 0) return 0;
  return readings.reduce((sum, value) => sum + value, 0) / readings.length;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
