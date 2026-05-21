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
  sequence: number;
  templateSection: string;
  title: string;
  group: string;
  status: SectionStatus;
  summary: string;
  modes: SectionMode[];
  draft: string;
  facts: string[];
  references: SectionReferenceGroup[];
  layoutScene?: LayoutSceneKind;
  aiPlaybook: SectionAiPlaybook;
};

export type SectionPlanRecommendation = "required" | "recommended" | "optional" | "deferred";

export type ReportPlanEntry = {
  sectionId: string;
  templateSection: string;
  sequence: number;
  title: string;
  group: string;
  source: "template" | "custom";
  status: SectionStatus;
  recommendation: SectionPlanRecommendation;
  included: boolean;
  locked: boolean;
  reason: string;
  basis: string[];
};

export type SectionReferenceGroup = {
  title: string;
  items: string[];
};

export type SectionAiActionEffect = "draft" | "refine" | "understand" | "tighten" | "format" | "missing" | "evidence" | "compare";

export type SectionAiAction = {
  id: string;
  label: string;
  effect: SectionAiActionEffect;
  instruction: string;
};

export type SectionAiPlaybook = {
  objective: string;
  allowedSources: string[];
  blockers: string[];
  suggestedActions: SectionAiAction[];
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

function action(id: string, label: string, effect: SectionAiActionEffect, instruction: string): SectionAiAction {
  return { id, label, effect, instruction };
}

function playbook(objective: string, allowedSources: string[], blockers: string[], suggestedActions: SectionAiAction[]): SectionAiPlaybook {
  return {
    objective,
    allowedSources,
    blockers,
    suggestedActions,
  };
}

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
  const roofMeasuredPlateCount = countUniqueStrings(roofRows.map((row) => row.plateId));
  const roofTotalReadings = totalReadingCount(roofRows.map((row) => row.readingsMm));
  const shellTotalReadings = totalReadingCount(shellRows.map((row) => row.readingsMm));
  const nozzleTotalReadings = totalReadingCount([...shellNozzleRows, ...roofNozzleRows].map((row) => row.readingsMm));
  const roofReadingProfile = describeReadingCoverage(roofRows.map((row) => row.readingsMm), "roof plate");
  const shellReadingProfile = describeReadingCoverage(shellRows.map((row) => row.readingsMm), "shell row");
  const nozzleReadingProfile = describeReadingCoverage(
    [...shellNozzleRows, ...roofNozzleRows].map((row) => row.readingsMm),
    "nozzle location",
  );

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
      id: "scope-of-inspection",
      sequence: 1,
      templateSection: "Section 01",
      title: "Scope of Inspection",
      group: "Core Narrative",
      status: "auto + review",
      summary: "The report starts with the same scope-first structure as the real TK-465 sample report.",
      modes: ["preview"],
      draft: `- To carry out thickness measurements on ${roofMeasuredPlateCount} roof plate${roofMeasuredPlateCount === 1 ? "" : "s"} with ${roofReadingProfile.toLowerCase()} where access and surface conditions permit.
- To carry out side wall inspection using the exported shell UT coverage across ${pkg.shellLinePlan.lineCount} crawler lane${
        pkg.shellLinePlan.lineCount === 1 ? "" : "s"
      }, with ${shellReadingProfile.toLowerCase()}.
- To carry out thickness measurements on roof and shell nozzles where structured nozzle UT coverage is available${nozzleReadingProfile ? `, using ${nozzleReadingProfile.toLowerCase()}` : ""}.
- To carry out a general visual inspection and record linked findings with photographic evidence.
- To compile a report showing readings, locations, linked evidence, and layout references for the supported scope.`,
      facts: [
        `${roofMeasuredPlateCount} roof plates measured`,
        `${roofTotalReadings} roof readings captured (${roofReadingProfile.toLowerCase()})`,
        `${shellRows.length} shell UT rows captured across ${pkg.shellLinePlan.lineCount} lanes`,
        `${shellTotalReadings} shell readings captured (${shellReadingProfile.toLowerCase()})`,
        `${shellNozzleRows.length + roofNozzleRows.length} nozzle UT rows captured (${nozzleReadingProfile.toLowerCase()})`,
        `${pkg.findings.length} findings linked to evidence`,
      ],
      references: [
        {
          title: "Sample report alignment",
          items: [
            "1 Scope of Inspection",
            "2 Inspection and Maintenance Regime",
            "3 General Tank Information",
            "4 Inspection Report",
          ],
        },
        {
          title: "Current capture coverage",
          items: [
            `Roof UT covers ${roofMeasuredPlateCount} plate${roofMeasuredPlateCount === 1 ? "" : "s"} with ${roofReadingProfile.toLowerCase()}`,
            `Shell UT covers ${shellRows.length} row${shellRows.length === 1 ? "" : "s"} with ${shellReadingProfile.toLowerCase()}`,
            `Nozzle UT coverage: ${shellNozzleRows.length + roofNozzleRows.length} row${
              shellNozzleRows.length + roofNozzleRows.length === 1 ? "" : "s"
            } with ${nozzleReadingProfile.toLowerCase()}`,
            "Floor UT and MFL sections still deferred",
          ],
        },
      ],
      aiPlaybook: playbook(
        "Draft the scope as a job-scope checklist that matches the real report structure, uses meaningful captured coverage metrics such as measured plate count and readings-per-location profile when available, and never overstates unsupported floor or MFL capture.",
        ["canonical package methods and coverage", "coverage metrics from captured rows", "real report structure", "review warnings"],
        ["Do not claim floor UT or MFL interpretation is complete when the package does not contain it."],
        [
          action("scope-draft", "Generate scope checklist", "draft", "Write a report-ready scope checklist from the supported inspection methods, covered areas, and deliverables in the current package."),
          action("scope-compare", "Compare to sample format", "compare", "Compare the current scope wording against the TK-465 section style."),
          action("scope-missing", "Show missing scope items", "missing", "List scope items from the sample report that are still deferred."),
        ],
      ),
    },
    {
      id: "inspection-maintenance-regime",
      sequence: 2,
      templateSection: "Section 02",
      title: "Inspection and Maintenance Regime",
      group: "Core Narrative",
      status: "manual required",
      summary: "This section should follow the real report format but still needs inspector or reviewer input.",
      modes: ["preview"],
      draft: `This section should summarize the applicable inspection interval context, governing practice, and maintenance regime in the style of the real IRS report. It should be generated only after the reviewer confirms the governing API basis and any client-specific maintenance context.`,
      facts: [
        "Not captured in the Android package today",
        "Should cite API basis and current inspection type",
        "Needs reviewer-controlled wording",
      ],
      references: [
        {
          title: "Primary inputs",
          items: ["Inspection type from package", "API 653 basis", "Reviewer or inspector maintenance context"],
        },
      ],
      aiPlaybook: playbook(
        "Refine maintenance-regime wording in a controlled, standards-aware way.",
        ["inspection type", "retrieved API sections", "reviewer-entered maintenance context"],
        ["Do not invent inspection intervals or maintenance history."],
        [
          action("regime-draft", "Draft regime overview", "draft", "Draft the maintenance-regime section from confirmed inputs."),
          action("regime-format", "Format as report section", "format", "Reformat the section to match the report's concise style."),
          action("regime-missing", "Show missing inputs", "missing", "List the manual inputs still required before drafting."),
        ],
      ),
    },
    {
      id: "general-tank-information",
      sequence: 3,
      templateSection: "Section 03",
      title: "General Tank Information",
      group: "Core Narrative",
      status: validation.valid ? "auto + review" : "blocked",
      summary: "Tank identity, geometry, and job context are hydrated directly from the uploaded package.",
      modes: ["preview"],
      draft: `${pkg.inspection.tankNumber} is a ${pkg.inspection.inspectionType.replace(/_/g, " ")} inspection package for ${pkg.inspection.client} at ${pkg.inspection.site}. The uploaded field package already provides tank geometry, line-plan context, and review-state metadata, but the final document wording still needs report-level editing and confirmation.`,
      facts: generalFacts,
      references: [
        {
          title: "Source package",
          items: [sourceFileName, `inspection.inspectionId = ${pkg.inspection.inspectionId}`, `packageId = ${pkg.packageId}`],
        },
        {
          title: "Document context",
          items: [`Started at ${pkg.inspection.startedAt}`, `Inspector ${pkg.inspection.inspector}`, `Review status ${reviewStatus}`],
        },
      ],
      aiPlaybook: playbook(
        "Keep general tank information factual, concise, and aligned with the real report header section.",
        ["inspection metadata", "tank master fields", "job identifiers"],
        ["Do not rewrite factual tank identifiers incorrectly."],
        [
          action("general-refine", "Refine wording", "refine", "Tighten the general tank information wording."),
          action("general-format", "Format as report block", "format", "Format the section like a clean report information block."),
          action("general-missing", "Show missing fields", "missing", "Show any missing tank or inspection metadata."),
        ],
      ),
    },
    {
      id: "inspection-report",
      sequence: 4,
      templateSection: "Section 04",
      title: "Inspection Report",
      group: "Core Narrative",
      status: "auto + review",
      summary: "Narrative section grounded in the captured measurements, findings, and current review state.",
      modes: ["preview"],
      draft: `The uploaded package currently includes ${shellRows.length} shell UT rows, ${roofRows.length} roof UT rows, and ${pkg.findings.length} findings linked to evidence. This section should be refined with inspector observations, limitations, and client-facing wording before the report is released.`,
      facts: narrativeFacts,
      references: [
        {
          title: "Linked findings",
          items: limitItems(
            pkg.findings.map(
              (finding) => `${finding.findingId} — ${finding.surface} ${finding.type}${finding.locationSummary ? ` (${finding.locationSummary})` : ""}`,
            ),
          ),
        },
        {
          title: "Linked files",
          items: linkedAttachmentPaths(pkg.attachments, pkg.findings.flatMap((finding) => finding.attachmentIds ?? [])),
        },
        {
          title: "Narrative basis",
          items: ["Captured UT coverage counts", "Linked findings and attachments", "Review warnings and limitations"],
        },
      ],
      aiPlaybook: playbook(
        "Draft a readable inspection narrative that stays anchored to captured evidence and stated limitations.",
        ["measurement summaries", "findings", "attachments", "review warnings"],
        ["Do not infer unsupported conclusions or floor findings."],
        [
          action("narrative-draft", "Draft narrative", "draft", "Generate a first-pass inspection narrative for this section."),
          action("narrative-evidence", "Ground in evidence", "evidence", "Tighten the narrative around linked measurements and findings."),
          action("narrative-tighten", "Tighten content", "tighten", "Remove soft filler and keep the language report-ready."),
        ],
      ),
    },
    {
      id: "repair-recommendations-api-assessment",
      sequence: 5,
      templateSection: "Section 05",
      title: "Repair Recommendations / API 653 Assessment",
      group: "Assessment",
      status: recommendationStatus,
      summary: "Recommendation section follows the real report order, but must stay human-approved.",
      modes: ["preview"],
      draft: `Recommendations should be drafted from deterministic calculations, the uploaded findings set, and standards-grounded review support. The language can be AI-assisted, but the engineering conclusion must remain human-approved before this section is shared.`,
      facts: [
        `${reviewWarnings.length} review warnings currently attached to the package`,
        `${pkg.mflImport ? "MFL metadata present for later report incorporation" : "No MFL metadata included in this package"}`,
        "Standards support should come from retrieved API guidance, not copied report text.",
      ],
      references: [
        {
          title: "Inputs required later",
          items: ["Deterministic calculation outputs", "Checklist completion and narrative confirmation", "Reviewer-approved recommendation wording"],
        },
        {
          title: "Carry-over review context",
          items: reviewWarnings.length > 0 ? reviewWarnings : ["No package warnings at the moment."],
        },
        {
          title: "Standards support",
          items: ["API 653", "API 575", "Historical approved report library"],
        },
      ],
      aiPlaybook: playbook(
        "Use AI only to help shape recommendation wording after calculations and reviewer judgment exist.",
        ["deterministic calculations", "review-confirmed findings", "retrieved API guidance"],
        ["Do not generate final engineering conclusions without reviewer approval."],
        [
          action("recommendations-draft", "Draft recommendation wording", "draft", "Draft neutral recommendation wording from confirmed findings."),
          action("recommendations-format", "Reformat as assessment", "format", "Structure the section into findings, impact, and recommendation."),
          action("recommendations-missing", "Show missing prerequisites", "missing", "List calculation or approval gaps before recommendations can finalize."),
        ],
      ),
    },
    {
      id: "test-information",
      sequence: 6,
      templateSection: "Section 06",
      title: "Test Information",
      group: "Core Narrative",
      status: validation.valid ? "auto + review" : "blocked",
      summary: "Coverage counts, dates, inspectors, and method summary aligned to the sample report's test information section.",
      modes: ["preview"],
      draft: `Test information should summarize who inspected the tank, when the inspection was performed, and which measurement methods were included in the uploaded package. The current package supports shell UT, roof UT, nozzle UT, and linked visual findings, with deferred floor and MFL detail noted separately.`,
      facts: [
        `Inspection started ${pkg.inspection.startedAt}`,
        `${pkg.inspection.inspector} recorded as primary inspector`,
        `${shellRows.length + roofRows.length + shellNozzleRows.length + roofNozzleRows.length} total structured UT rows exported`,
      ],
      references: [
        {
          title: "Method coverage",
          items: ["Shell UT", "Roof UT", "Nozzle UT", "Visual findings / photographs"],
        },
      ],
      aiPlaybook: playbook(
        "Format method and timing details into a compact test-information section.",
        ["inspection metadata", "measurement counts", "supported methods"],
        ["Do not claim methods that are not present in the package."],
        [
          action("test-draft", "Draft test information", "draft", "Draft the test-information section from package metadata."),
          action("test-format", "Format method summary", "format", "Format the section into concise report wording."),
          action("test-compare", "Compare to sample tone", "compare", "Check whether the section tone matches the sample report structure."),
        ],
      ),
    },
    {
      id: "tank-inspection-checklist",
      sequence: 7,
      templateSection: "Section 07",
      title: "Tank Inspection Checklist",
      group: "Interactive Review",
      status: "manual required",
      summary: "Checklist remains an interactive web-only section and must be confirmed before moving forward.",
      modes: ["checklist", "preview"],
      draft: "Checklist outcomes will be summarized here after the inspector completes and confirms the section.",
      facts: [
        "Checklist answers are web-entered, not carried by the Android package today.",
        "Each item should support quick notes and later report phrasing.",
        "This section should be explicitly confirmed before moving forward.",
      ],
      references: [
        {
          title: "Checklist basis",
          items: ["Inspector web input only", "API 575 external and roof inspection prompts", "API 653 shell and nozzle review prompts"],
        },
        {
          title: "Use this section for",
          items: ["Pass / needs review / not examined decisions", "Short inspector notes per checklist line", "Section confirmation before moving on"],
        },
      ],
      aiPlaybook: playbook(
        "Summarize completed checklist answers into report-ready prose without hiding unanswered items.",
        ["checklist answers", "checklist notes", "linked section evidence"],
        ["Do not mark the section complete if checklist lines remain unanswered."],
        [
          action("checklist-summary", "Summarize checklist", "draft", "Summarize completed checklist outcomes for the report."),
          action("checklist-format", "Format checklist summary", "format", "Turn checklist outcomes into concise report wording."),
          action("checklist-missing", "Show unanswered items", "missing", "List unanswered or needs-review checklist items."),
        ],
      ),
    },
    {
      id: "roof-plate-thickness-measurements",
      sequence: 8,
      templateSection: "Section 08",
      title: "Roof Plate Thickness Measurements",
      group: "Measurements",
      status: roofStatus,
      summary: "Real report measurement section for roof UT rows.",
      modes: ["preview"],
      draft: `Roof ultrasonic thickness measurements were exported with plate references that should map into the report table format. Final wording should still document any assumptions or manual overrides used for plate context and original thickness interpretation.`,
      facts: roofMeasurementFacts,
      references: [
        {
          title: "Measurement rows",
          items: limitItems(
            roofRows.map((row) => `${row.rowId} — ${row.plateId} / Avg ${average(row.readingsMm).toFixed(2)} mm${row.note ? ` / ${row.note}` : ""}`),
          ),
        },
        {
          title: "Roof evidence",
          items: buildFindingReferenceItems(pkg.findings.filter((finding) => finding.surface === "roof"), pkg.attachments),
        },
      ],
      aiPlaybook: playbook(
        "Refine the roof UT section around actual roof measurements and linked observations.",
        ["roof UT rows", "roof findings", "roof attachments"],
        ["Do not invent plate IDs or original thickness assumptions."],
        [
          action("roof-thickness-draft", "Draft roof UT section", "draft", "Draft the roof plate thickness section from exported rows."),
          action("roof-thickness-evidence", "Link evidence", "evidence", "Improve the section using roof findings and attachments."),
          action("roof-thickness-tighten", "Tighten table commentary", "tighten", "Reduce filler and keep the commentary factual."),
        ],
      ),
    },
    {
      id: "roof-plate-layout",
      sequence: 9,
      templateSection: "Section 09",
      title: "Roof Plate Layout",
      group: "Layouts",
      status: roofRows.length > 0 || Boolean(pkg.roofLayout) ? "auto + review" : "blocked",
      summary: "Interactive roof layout aligned to the real report's roof layout page.",
      modes: ["layout", "preview"],
      layoutScene: "roof",
      draft: `This section should render the roof plate arrangement at report scale, then let the reviewer place the narrative beside the drawing. The current workspace can already render roof markers, features, and linked evidence, but layout polish still needs refinement before it reaches report-grade output.`,
      facts: [
        `roofLayout.template = ${pkg.roofLayout?.template ?? "not provided"}`,
        `${pkg.roofLayout?.features?.length ?? 0} roof features available`,
        `${roofRows.length} roof measurement markers available`,
      ],
      references: [
        {
          title: "Roof layout sources",
          items: [
            `roofLayout.rowCount = ${pkg.roofLayout?.rowCount ?? "n/a"}`,
            `roofLayout.widestRowPlateCount = ${pkg.roofLayout?.widestRowPlateCount ?? "n/a"}`,
            `${roofNozzles.length} roof nozzles registered`,
          ],
        },
      ],
      aiPlaybook: playbook(
        "Help the reviewer caption and explain the roof layout without pretending the layout tool is final CAD output.",
        ["roof layout geometry", "roof markers", "linked roof findings"],
        ["Do not fabricate roof layout entities that are not present."],
        [
          action("roof-layout-caption", "Draft layout caption", "draft", "Draft a report-ready caption for the roof layout page."),
          action("roof-layout-evidence", "Explain highlighted markers", "evidence", "Explain the visible roof markers and their evidence links."),
          action("roof-layout-compare", "Compare to sample page", "compare", "Check whether the layout page structure matches the sample report intent."),
        ],
      ),
    },
    {
      id: "roof-nozzle-reinforcement-measurements",
      sequence: 10,
      templateSection: "Section 10",
      title: "Roof Nozzle & Reinforcement Pad Thickness Measurements",
      group: "Measurements",
      status: roofNozzleRows.length > 0 || roofNozzles.length > 0 ? "auto + review" : "blocked",
      summary: "Real report nozzle section for roof nozzle and pad measurements.",
      modes: ["preview"],
      draft: `This section should capture roof nozzle UT and reinforcement pad measurements where they exist. The current package includes roof nozzle registry context${roofNozzleRows.length > 0 ? " and structured roof nozzle UT rows." : ", but no structured roof nozzle UT rows yet."}`,
      facts: [
        `${roofNozzles.length} roof nozzle definitions`,
        `${roofNozzleRows.length} roof nozzle UT rows`,
        "Pad detail may still require manual note support",
      ],
      references: [
        {
          title: "Roof nozzle registry",
          items: roofNozzles.length > 0 ? roofNozzles.map((item) => `${item.nozzleId} — ${item.size}`) : ["No roof nozzles in current package."],
        },
      ],
      aiPlaybook: playbook(
        "Keep the roof nozzle section factual and explicit about missing pad detail when necessary.",
        ["roof nozzle registry", "roof nozzle UT rows"],
        ["Do not imply pad readings exist when only registry data is available."],
        [
          action("roof-nozzle-draft", "Draft roof nozzle section", "draft", "Draft the roof nozzle and pad section from available rows."),
          action("roof-nozzle-missing", "Show missing pad detail", "missing", "Show what roof nozzle data is still missing."),
        ],
      ),
    },
    {
      id: "minimum-shell-thickness-calculations",
      sequence: 11,
      templateSection: "Section 11",
      title: "Minimum Shell Thickness Calculations",
      group: "Assessment",
      status: "manual required",
      summary: "This section is present to match the real report, but still waits for deterministic calc implementation.",
      modes: ["preview"],
      draft: `This section should eventually present deterministic minimum shell thickness calculations and any related remaining-life or corrosion-rate support. The report shell keeps the section in place now so the final document structure remains consistent with the IRS sample report.`,
      facts: [
        "Deterministic calculation engine not wired yet",
        "Section should stay visible to preserve final report order",
        reviewWarnings[0] ?? "No current package calculation warning",
      ],
      references: [
        {
          title: "Future calculation inputs",
          items: ["Tank geometry", "Shell UT coverage", "Original thickness assumptions", "Applicable API basis"],
        },
      ],
      aiPlaybook: playbook(
        "Prepare wording around calculations only after deterministic outputs exist.",
        ["deterministic calculation engine output", "reviewer-confirmed assumptions"],
        ["Do not generate calculation results from prose only."],
        [
          action("calc-missing", "Show calculation gaps", "missing", "List which inputs or engine outputs are still missing."),
          action("calc-format", "Prepare calculation section format", "format", "Structure the section shell without inventing numbers."),
        ],
      ),
    },
    {
      id: "shell-plate-thickness-measurements",
      sequence: 12,
      templateSection: "Section 12",
      title: "Shell Plate Thickness Measurements",
      group: "Measurements",
      status: shellStatus,
      summary: "Real report shell UT section grounded in exported shell measurement rows.",
      modes: ["preview"],
      draft: `Shell ultrasonic thickness measurements were exported across ${pkg.shellLinePlan.lineCount} crawler lanes. The reviewer can inspect the narrative, cross-check the shell line plan, and use the shell layout section to understand where each row and linked finding sits on the tank shell.`,
      facts: shellMeasurementFacts,
      references: [
        {
          title: "Measurement rows",
          items: limitItems(
            shellRows.map((row) => {
              const lineLabel = pkg.shellLinePlan.lines?.find((line) => line.lineId === row.lineId)?.label ?? row.lineId;
              return `${row.rowId} — ${lineLabel} / Course ${row.course} / Avg ${average(row.readingsMm).toFixed(2)} mm`;
            }),
          ),
        },
        {
          title: "Linked findings and files",
          items: buildFindingReferenceItems(pkg.findings.filter((finding) => finding.surface === "shell"), pkg.attachments),
        },
      ],
      aiPlaybook: playbook(
        "Write shell thickness commentary that stays tied to actual rows and visible thinning evidence.",
        ["shell UT rows", "shell line plan", "shell findings", "shell photos"],
        ["Do not summarize shell condition without referencing actual row coverage."],
        [
          action("shell-thickness-draft", "Draft shell UT section", "draft", "Draft the shell thickness section from exported rows."),
          action("shell-thickness-evidence", "Ground in evidence", "evidence", "Strengthen commentary with linked findings and photos."),
          action("shell-thickness-tighten", "Tighten wording", "tighten", "Keep the section concise and factual."),
        ],
      ),
    },
    {
      id: "shell-plate-layout",
      sequence: 13,
      templateSection: "Section 13",
      title: "Shell Plate Layout",
      group: "Layouts",
      status: shellRows.length > 0 ? "auto + review" : "blocked",
      summary: "Interactive shell layout aligned to the real report's shell layout page.",
      modes: ["layout", "preview"],
      layoutScene: "shell",
      draft: `This section should render shell lanes, measurement positions, nozzle markers, and linked findings in a report-grade shell layout view. The current renderer already supports location review, but it still needs visual refinement to match the final report standard.`,
      facts: [
        `${pkg.shellLinePlan.lineCount} shell lanes in package`,
        `${shellRows.length} shell UT markers available`,
        `${shellNozzles.length} shell nozzles registered`,
      ],
      references: [
        {
          title: "Layout entities",
          items: [
            `${pkg.tankMaster.shellCourseCount} shell courses`,
            `${pkg.findings.filter((finding) => finding.surface === "shell").length} shell findings`,
            `${shellNozzles.length} shell nozzle entities`,
          ],
        },
      ],
      aiPlaybook: playbook(
        "Help the reviewer explain the shell layout clearly and consistently with the shell narrative.",
        ["shell layout markers", "shell UT rows", "shell findings", "shell nozzles"],
        ["Do not describe shell geometry that is not visible in the current renderer."],
        [
          action("shell-layout-caption", "Draft layout caption", "draft", "Draft a caption for the shell layout page."),
          action("shell-layout-evidence", "Explain markers", "evidence", "Explain the currently highlighted shell markers."),
          action("shell-layout-compare", "Compare to report structure", "compare", "Check whether shell layout sequencing matches the sample report."),
        ],
      ),
    },
    {
      id: "shell-nozzle-reinforcement-measurements",
      sequence: 14,
      templateSection: "Section 14",
      title: "Shell Nozzle & Reinforcement Pad Thickness Measurements",
      group: "Measurements",
      status: shellNozzleRows.length > 0 || shellNozzles.length > 0 ? "auto + review" : "blocked",
      summary: "Real report shell nozzle section driven by exported shell nozzle data.",
      modes: ["preview"],
      draft: `This section should summarize shell nozzle thickness measurements and related reinforcement pad context. The current package includes ${shellNozzleRows.length} shell nozzle UT row${shellNozzleRows.length === 1 ? "" : "s"} and ${shellNozzles.length} shell nozzle definition${shellNozzles.length === 1 ? "" : "s"}.`,
      facts: [
        `${shellNozzleRows.length} shell nozzle UT rows`,
        `${shellNozzles.length} shell nozzle definitions`,
        "Pad details may still require manual inspector notes",
      ],
      references: [
        {
          title: "Shell nozzle rows",
          items:
            shellNozzleRows.length > 0
              ? shellNozzleRows.map((row) => `${row.rowId} — ${row.nozzleId} / Avg ${average(row.readingsMm).toFixed(2)} mm`)
              : ["No structured shell nozzle UT rows in current package."],
        },
      ],
      aiPlaybook: playbook(
        "Draft nozzle commentary that stays explicit about what was measured versus what still sits in notes.",
        ["shell nozzle rows", "shell nozzle registry", "linked inspector notes"],
        ["Do not imply reinforcement-pad readings exist if they are not structured yet."],
        [
          action("shell-nozzle-draft", "Draft shell nozzle section", "draft", "Draft the shell nozzle and pad section from current data."),
          action("shell-nozzle-missing", "Show missing pad details", "missing", "List shell nozzle or pad details still missing."),
        ],
      ),
    },
    {
      id: "photographs",
      sequence: 15,
      templateSection: "Section 15",
      title: "Photographs",
      group: "Evidence",
      status: pkg.attachments.length > 0 ? "auto + review" : "blocked",
      summary: "Photograph section aligned to the real report's image appendix page.",
      modes: ["preview"],
      draft: `The photograph section should be assembled from the uploaded attachment set and linked back to findings and layouts. The current package includes ${pkg.attachments.length} attachment reference${pkg.attachments.length === 1 ? "" : "s"} for this purpose.`,
      facts: [
        `${pkg.attachments.length} attachments exported`,
        `${pkg.findings.length} findings may reference those attachments`,
      ],
      references: [
        {
          title: "Attachment files",
          items:
            pkg.attachments.length > 0
              ? pkg.attachments.map((attachment) => `${attachment.relativePath}${attachment.caption ? ` — ${attachment.caption}` : ""}`)
              : ["No attachment files linked in this package."],
        },
      ],
      aiPlaybook: playbook(
        "Help caption and organize photographs around the active report section and findings.",
        ["attachments", "finding captions", "layout context"],
        ["Do not describe photographs that are not in the package."],
        [
          action("photos-caption", "Draft photo captions", "draft", "Draft concise photo captions from existing attachment metadata."),
          action("photos-evidence", "Connect photos to findings", "evidence", "Explain how the photographs support the linked findings."),
        ],
      ),
    },
    {
      id: "floor-plate-layout",
      sequence: 16,
      templateSection: "Section 16",
      title: "Floor Plate Layout with Platemaps Numbering System",
      group: "Floor / MFL",
      status: "blocked",
      summary: "This section stays visible for report consistency, but floor layout capture is not in the app yet.",
      modes: ["preview"],
      draft: `The real report includes a floor plate layout section. This workspace keeps the section in the navigation so the final format is honest, but current Android capture does not yet provide the floor layout data needed to populate it.`,
      facts: [
        "Floor layout capture not implemented in Android export yet",
        "Section kept in place for real report consistency",
      ],
      references: [
        {
          title: "Why blocked",
          items: ["No floor UT package data", "No floor layout geometry", "No floor numbering map yet"],
        },
      ],
      aiPlaybook: playbook(
        "Explain clearly why the section is blocked without fabricating floor content.",
        ["gap analysis", "future floor workflow scope"],
        ["Never generate fake floor layout content."],
        [action("floor-layout-missing", "Show blocked reason", "missing", "Explain why this floor layout section is blocked today.")],
      ),
    },
    {
      id: "floor-recommended-repair-locations",
      sequence: 17,
      templateSection: "Section 17",
      title: "Floor Recommended Repair Locations",
      group: "Floor / MFL",
      status: "blocked",
      summary: "Blocked until floor data and repair logic are available.",
      modes: ["preview"],
      draft: `This section exists in the sample report, but current platform data does not yet support floor repair-location generation.`,
      facts: ["Requires floor UT or MFL interpretation workflow", "Should remain blocked rather than implied"],
      references: [
        {
          title: "Prerequisites",
          items: ["Floor layout", "Floor corrosion evidence", "Reviewer-approved repair logic"],
        },
      ],
      aiPlaybook: playbook(
        "Keep the blocked state explicit and avoid speculative repair-location language.",
        ["future floor workflow"],
        ["Do not propose floor repair locations without floor evidence."],
        [action("floor-repair-missing", "Show missing prerequisites", "missing", "List what must exist before this section can be drafted.")],
      ),
    },
    {
      id: "tru-flux-guidelines",
      sequence: 18,
      templateSection: "Section 18",
      title: "Guidelines for the Interpretation of the TRU-FLUX Data Sheets",
      group: "Floor / MFL",
      status: "blocked",
      summary: "Reserved for later MFL interpretation support.",
      modes: ["preview"],
      draft: `This section is part of the real report sequence, but the current platform intentionally defers MFL interpretation and TRU-FLUX guidance authoring until the floor workflow is added.`,
      facts: ["MFL interpretation deferred", "Section kept for sample-report alignment"],
      references: [
        {
          title: "Current stance",
          items: ["MFL could be incorporated later at report level", "No TRU-FLUX interpretation generated today"],
        },
      ],
      aiPlaybook: playbook(
        "Preserve the placeholder honestly without generating MFL interpretation content.",
        ["future MFL support plan"],
        ["Do not summarize TRU-FLUX data that is not present."],
        [action("tru-flux-missing", "Show blocked reason", "missing", "Explain why TRU-FLUX interpretation is deferred.")],
      ),
    },
    {
      id: "floor-plate-corrosion-plan",
      sequence: 19,
      templateSection: "Section 19",
      title: "Floor Plate Corrosion Plan",
      group: "Floor / MFL",
      status: "blocked",
      summary: "Reserved for later floor corrosion modeling and visual output.",
      modes: ["preview"],
      draft: `The floor corrosion plan is part of the real report structure, but it remains blocked until floor capture, interpretation, and rendering workflows are available.`,
      facts: ["No floor corrosion plan data today", "Should not be simulated prematurely"],
      references: [
        {
          title: "Prerequisites",
          items: ["Floor corrosion evidence", "Floor layout map", "Repair / severity logic"],
        },
      ],
      aiPlaybook: playbook(
        "Make the blocked state explicit and keep future floor corrosion planning separate from current shell and roof work.",
        ["future floor roadmap"],
        ["Do not generate a corrosion plan without floor evidence."],
        [action("floor-plan-missing", "Show blocked reason", "missing", "Explain why the floor corrosion plan is not available yet.")],
      ),
    },
    {
      id: "magnetic-flux-leakage-platemaps",
      sequence: 20,
      templateSection: "Section 20",
      title: "Magnetic Flux Leakage Platemaps",
      group: "Floor / MFL",
      status: "blocked",
      summary: "Reserved for later MFL platemap ingestion and rendering.",
      modes: ["preview"],
      draft: `The sample report closes with MFL platemaps. The current product intentionally keeps this section blocked until MFL intake and floor rendering are implemented.`,
      facts: ["No structured MFL platemap data in current package", "Section visible only for format consistency"],
      references: [
        {
          title: "Why blocked",
          items: ["MFL import currently deferred in app workflow", "No floor platemap renderer yet"],
        },
      ],
      aiPlaybook: playbook(
        "Keep the section visible as a future placeholder without pretending MFL platemaps already exist.",
        ["future MFL workflow plan"],
        ["Do not generate platemap commentary or labels for missing MFL data."],
        [action("mfl-missing", "Show blocked reason", "missing", "Explain why MFL platemaps are not available yet.")],
      ),
    },
  ];

  const tenantId = options?.tenantId ?? "tenant-irs";
  const clientAccountId = slugify(pkg.inspection.client);
  const siteId = slugify(pkg.inspection.site);
  const tankId = `tank-${slugify(pkg.inspection.tankNumber)}`;
  const inspectionJobId = pkg.inspection.inspectionId || `job-${slugify(pkg.packageId)}`;
  const initializedSections = sections.map((section) =>
    section.status === "blocked"
      ? section
      : {
          ...section,
          draft: "",
        },
  );

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
    sections: initializedSections,
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
    packageId: "pkg-demo-tk-465-full-2026-05-21",
    inspection: {
      inspectionId: "insp-demo-tk-465-full-2026-05-21",
      client: "TJS Pte Ltd (Chemstationasia Group)",
      site: "Vava'u Terminal, Tonga",
      tankNumber: "465",
      inspectionType: "internal_external",
      startedAt: "2026-05-16T08:00:00Z",
      completedAt: "2026-05-16T17:00:00Z",
      inspector: "Syed Abdul Rahman Balkhi / Mulyadi Bin Taib",
      deviceId: "android-tablet-demo-01",
    },
    tankMaster: {
      diameterM: 7.8,
      heightM: 9.14,
      roofType: "fixed_cone",
      shellCourseCount: 6,
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
      template: "cone_radial",
      rowCount: null,
      widestRowPlateCount: null,
      ringCount: 3,
      sectorCount: 20,
      centerOpeningRatio: null,
      features: [
        {
          featureId: "tjs-fixed-feature-001",
          type: "manhole",
          label: "MH1",
          placementMode: "plate_linked",
          plateId: "1",
          azimuthDeg: null,
          radiusRatio: null,
        },
        {
          featureId: "tjs-fixed-feature-002",
          type: "stairway_termination",
          label: "ST1",
          placementMode: "plate_linked",
          plateId: "1",
          azimuthDeg: null,
          radiusRatio: null,
        },
        {
          featureId: "tjs-fixed-feature-003",
          type: "stairway_termination",
          label: "ST2",
          placementMode: "plate_linked",
          plateId: "6",
          azimuthDeg: null,
          radiusRatio: null,
        },
        {
          featureId: "tjs-fixed-feature-004",
          type: "stairway_termination",
          label: "ST3",
          placementMode: "plate_linked",
          plateId: "16",
          azimuthDeg: null,
          radiusRatio: null,
        },
        {
          featureId: "tjs-fixed-feature-005",
          type: "roof_ladder",
          label: "LD1",
          placementMode: "plate_linked",
          plateId: "11",
          azimuthDeg: null,
          radiusRatio: null,
        },
      ],
    },
    nozzleRegistries: {
      shell: [
        {
          nozzleId: "S1",
          surface: "shell",
          size: "Unknown",
          placementMode: "line_linked_positioned",
          course: 1,
          azimuthDeg: 0,
          plateId: null,
        },
        {
          nozzleId: "S2",
          surface: "shell",
          size: "Unknown",
          placementMode: "line_linked_positioned",
          course: 2,
          azimuthDeg: 90,
          plateId: null,
        },
        {
          nozzleId: "S3",
          surface: "shell",
          size: "Unknown",
          placementMode: "line_linked_positioned",
          course: 3,
          azimuthDeg: 180,
          plateId: null,
        },
        {
          nozzleId: "S4",
          surface: "shell",
          size: "Unknown",
          placementMode: "line_linked_positioned",
          course: 4,
          azimuthDeg: 270,
          plateId: null,
        },
      ],
      roof: [
        {
          nozzleId: "R1",
          surface: "roof",
          size: "Unknown",
          placementMode: "plate_linked",
          course: null,
          azimuthDeg: null,
          plateId: "1",
        },
        {
          nozzleId: "R2",
          surface: "roof",
          size: "Unknown",
          placementMode: "plate_linked",
          course: null,
          azimuthDeg: null,
          plateId: "4",
        },
        {
          nozzleId: "R3",
          surface: "roof",
          size: "Unknown",
          placementMode: "plate_linked",
          course: null,
          azimuthDeg: null,
          plateId: "6",
        },
      ],
    },
    measurements: {
      shellUtRows: [
        { rowId: "tjs-shell-ut-001", lineId: "line-01", course: 1, readingsMm: [6.52, 6.48, 6.51, 6.43, 6.5], note: "IRS 16TJS4 TK-465 shell UT · N · Strake 1." },
        { rowId: "tjs-shell-ut-002", lineId: "line-02", course: 1, readingsMm: [6.55, 6.54, 6.6, 6.61, 6.6], note: "IRS 16TJS4 TK-465 shell UT · E · Strake 1." },
        { rowId: "tjs-shell-ut-003", lineId: "line-03", course: 1, readingsMm: [6.6, 6.64, 6.67, 6.69, 6.66], note: "IRS 16TJS4 TK-465 shell UT · S · Strake 1." },
        { rowId: "tjs-shell-ut-004", lineId: "line-04", course: 1, readingsMm: [6.7, 6.72, 6.76, 6.75, 6.7], note: "IRS 16TJS4 TK-465 shell UT · W · Strake 1." },
        { rowId: "tjs-shell-ut-005", lineId: "line-01", course: 2, readingsMm: [6.58, 6.31, 6.66, 6.6, 6.61], note: "IRS 16TJS4 TK-465 shell UT · N · Strake 2." },
        { rowId: "tjs-shell-ut-006", lineId: "line-02", course: 2, readingsMm: [6.62, 6.66, 6.58, 6.66, 6.63], note: "IRS 16TJS4 TK-465 shell UT · E · Strake 2." },
        { rowId: "tjs-shell-ut-007", lineId: "line-03", course: 2, readingsMm: [6.7, 6.85, 6.87, 6.55, 6.55], note: "IRS 16TJS4 TK-465 shell UT · S · Strake 2." },
        { rowId: "tjs-shell-ut-008", lineId: "line-04", course: 2, readingsMm: [6.3, 6.28, 6.33, 6.36, 6.24], note: "IRS 16TJS4 TK-465 shell UT · W · Strake 2." },
        { rowId: "tjs-shell-ut-009", lineId: "line-01", course: 3, readingsMm: [6.65, 6.54, 6.51, 6.51, 6.56], note: "IRS 16TJS4 TK-465 shell UT · N · Strake 3." },
        { rowId: "tjs-shell-ut-010", lineId: "line-02", course: 3, readingsMm: [6.51, 6.54, 6.44, 6.45, 6.5], note: "IRS 16TJS4 TK-465 shell UT · E · Strake 3." },
        { rowId: "tjs-shell-ut-011", lineId: "line-03", course: 3, readingsMm: [6.61, 6.37, 6.61, 6.66, 6.64], note: "IRS 16TJS4 TK-465 shell UT · S · Strake 3." },
        { rowId: "tjs-shell-ut-012", lineId: "line-04", course: 3, readingsMm: [6.54, 6.54, 6.46, 6.58, 6.55], note: "IRS 16TJS4 TK-465 shell UT · W · Strake 3." },
        { rowId: "tjs-shell-ut-013", lineId: "line-01", course: 4, readingsMm: [6.51, 6.51, 6.52, 6.5, 6.49], note: "IRS 16TJS4 TK-465 shell UT · N · Strake 4." },
        { rowId: "tjs-shell-ut-014", lineId: "line-02", course: 4, readingsMm: [6.57, 6.54, 6.52, 6.51, 6.54], note: "IRS 16TJS4 TK-465 shell UT · E · Strake 4." },
        { rowId: "tjs-shell-ut-015", lineId: "line-03", course: 4, readingsMm: [6.46, 6.48, 6.58, 6.57, 6.48], note: "IRS 16TJS4 TK-465 shell UT · S · Strake 4." },
        { rowId: "tjs-shell-ut-016", lineId: "line-04", course: 4, readingsMm: [6.21, 6.27, 6.37, 6.35, 6.31], note: "IRS 16TJS4 TK-465 shell UT · W · Strake 4." },
        { rowId: "tjs-shell-ut-017", lineId: "line-01", course: 5, readingsMm: [6.57, 6.6, 6.58, 6.56, 6.55], note: "IRS 16TJS4 TK-465 shell UT · N · Strake 5." },
        { rowId: "tjs-shell-ut-018", lineId: "line-02", course: 5, readingsMm: [6.61, 6.6, 6.57, 6.39, 6.55], note: "IRS 16TJS4 TK-465 shell UT · E · Strake 5." },
        { rowId: "tjs-shell-ut-019", lineId: "line-03", course: 5, readingsMm: [6.39, 6.42, 6.48, 6.43, 6.33], note: "IRS 16TJS4 TK-465 shell UT · S · Strake 5." },
        { rowId: "tjs-shell-ut-020", lineId: "line-04", course: 5, readingsMm: [6.3, 6.34, 6.33, 6.28, 6.27], note: "IRS 16TJS4 TK-465 shell UT · W · Strake 5." },
        { rowId: "tjs-shell-ut-021", lineId: "line-01", course: 6, readingsMm: [6.63, 6.6, 6.55, 6.56, 6.57], note: "IRS 16TJS4 TK-465 shell UT · N · Strake 6." },
        { rowId: "tjs-shell-ut-022", lineId: "line-02", course: 6, readingsMm: [6.7, 6.68, 6.66, 6.7, 6.71], note: "IRS 16TJS4 TK-465 shell UT · E · Strake 6." },
        { rowId: "tjs-shell-ut-023", lineId: "line-03", course: 6, readingsMm: [6.51, 6.6, 6.65, 6.73, 6.6], note: "IRS 16TJS4 TK-465 shell UT · S · Strake 6." },
        { rowId: "tjs-shell-ut-024", lineId: "line-04", course: 6, readingsMm: [6.41, 6.41, 6.37, 6.48, 6.4], note: "IRS 16TJS4 TK-465 shell UT · W · Strake 6." },
      ],
      roofUtRows: [
        { rowId: "tjs-roof-ut-001", plateId: "1", readingsMm: [4.55, 4.41, 4.63, 4.5, 4.49], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
        { rowId: "tjs-roof-ut-002", plateId: "2", readingsMm: [4.54, 4.17, 4.39, 4.46, 4.45], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
        { rowId: "tjs-roof-ut-003", plateId: "3", readingsMm: [4.45, 4.36, 4.35, 4.42, 4.49], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
        { rowId: "tjs-roof-ut-004", plateId: "4", readingsMm: [4.45, 4.26, 4.36, 4.46, 4.42], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
        { rowId: "tjs-roof-ut-005", plateId: "5", readingsMm: [4.5, 4.33, 4.53, 4.45, 4.46], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
        { rowId: "tjs-roof-ut-006", plateId: "6", readingsMm: [4.45, 4.35, 4.19, 4.28, 4.36], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
        { rowId: "tjs-roof-ut-007", plateId: "7", readingsMm: [4.29, 4.47, 4.55, 4.47, 4.36], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
        { rowId: "tjs-roof-ut-008", plateId: "8", readingsMm: [4.37, 4.5, 4.3, 4.43, 4.51], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
        { rowId: "tjs-roof-ut-009", plateId: "9", readingsMm: [4.47, 4.51, 4.45, 4.33, 4.38], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
        { rowId: "tjs-roof-ut-010", plateId: "10", readingsMm: [4.52, 4.37, 4.28, 4.43, 4.45], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
        { rowId: "tjs-roof-ut-011", plateId: "11", readingsMm: [4.6, 4.51, 4.52, 4.5, 4.47], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
        { rowId: "tjs-roof-ut-012", plateId: "12", readingsMm: [4.56, 4.57, 4.49, 4.41, 4.51], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
        { rowId: "tjs-roof-ut-013", plateId: "13", readingsMm: [4.53, 4.27, 4.29, 4.55, 4.46], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
        { rowId: "tjs-roof-ut-014", plateId: "14", readingsMm: [4.44, 4.38, 4.36, 4.52, 4.51], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
        { rowId: "tjs-roof-ut-015", plateId: "15", readingsMm: [4.37, 4.28, 4.25, 4.51, 4.37], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
        { rowId: "tjs-roof-ut-016", plateId: "16", readingsMm: [4.59, 4.55, 4.56, 4.32, 4.33], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
        { rowId: "tjs-roof-ut-017", plateId: "17", readingsMm: [4.35, 4.54, 4.54, 4.41, 4.43], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
        { rowId: "tjs-roof-ut-018", plateId: "18", readingsMm: [4.53, 4.31, 4.52, 4.33, 4.57], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
        { rowId: "tjs-roof-ut-019", plateId: "19", readingsMm: [4.45, 4.45, 4.3, 4.38, 4.35], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
        { rowId: "tjs-roof-ut-020", plateId: "20", readingsMm: [4.53, 4.3, 4.33, 4.42, 4.45], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
        { rowId: "tjs-roof-ut-021", plateId: "21", readingsMm: [9.39, 9.71, 9.56, 9.5, 9.41], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
        { rowId: "tjs-roof-ut-022", plateId: "22", readingsMm: [9.46, 9.36, 9.55, 9.54, 9.46], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
        { rowId: "tjs-roof-ut-023", plateId: "23", readingsMm: [9.5, 9.53, 9.61, 9.55, 9.56], note: "IRS 16TJS4 TK-465 fixed-roof plate UT." },
      ],
      shellNozzleUtRows: [
        { rowId: "tjs-shell-nozzle-ut-001", nozzleId: "S1", readingsMm: [10.04, 10.01, 9.84, 10.04], note: "IRS 16TJS4 TK-465 shell nozzle UT." },
        { rowId: "tjs-shell-nozzle-ut-002", nozzleId: "S2", readingsMm: [5.63, 5.34, 5.5, 5.46], note: "IRS 16TJS4 TK-465 shell nozzle UT." },
        { rowId: "tjs-shell-nozzle-ut-003", nozzleId: "S3", readingsMm: [5.4, 5.5, 5.51, 5.42], note: "IRS 16TJS4 TK-465 shell nozzle UT." },
        { rowId: "tjs-shell-nozzle-ut-004", nozzleId: "S4", readingsMm: [5.55, 5.36, 5.41, 5.39], note: "IRS 16TJS4 TK-465 shell nozzle UT." },
      ],
      roofNozzleUtRows: [
        { rowId: "tjs-roof-nozzle-ut-001", nozzleId: "R1", readingsMm: [6.28, 6.05, 6.25, 6.17], note: "IRS 16TJS4 TK-465 roof nozzle UT." },
        { rowId: "tjs-roof-nozzle-ut-002", nozzleId: "R2", readingsMm: [6.7, 6.58, 6.61, 6.58], note: "IRS 16TJS4 TK-465 roof nozzle UT." },
        { rowId: "tjs-roof-nozzle-ut-003", nozzleId: "R3", readingsMm: [5.97, 6.12, 5.99, 6.03], note: "IRS 16TJS4 TK-465 roof nozzle UT." },
      ],
    },
    findings: [
      {
        findingId: "tjs-finding-001",
        surface: "roof",
        type: "coating_failure",
        severity: "low",
        note: "Coating wear visible around the fixed-roof manhole and adjacent support-column traffic path.",
        linkedMeasurementId: "tjs-roof-ut-004",
        locationSummary: "Fixed roof · Plate 4 / MH1 area",
        attachmentIds: ["tjs-photo-001"],
      },
      {
        findingId: "tjs-finding-002",
        surface: "roof",
        type: "corrosion",
        severity: "medium",
        note: "Local corrosion and coating breakdown around roof nozzle R2 and nearby reinforcement pad.",
        linkedMeasurementId: "tjs-roof-nozzle-ut-002",
        locationSummary: "Fixed roof nozzle R2",
        attachmentIds: ["tjs-photo-002"],
      },
      {
        findingId: "tjs-finding-003",
        surface: "shell",
        type: "weld_concern",
        severity: "medium",
        note: "Local corrosion and coating breakdown around shell nozzle S2.",
        linkedMeasurementId: "tjs-shell-nozzle-ut-002",
        locationSummary: "Shell nozzle S2 · east quadrant",
        attachmentIds: ["tjs-photo-003"],
      },
    ],
    attachments: [
      {
        attachmentId: "tjs-photo-001",
        kind: "photo",
        relativePath: "images/tjs_465_photo_01.jpg",
        caption: "TK-465 fixed-roof manhole coating wear",
      },
      {
        attachmentId: "tjs-photo-002",
        kind: "photo",
        relativePath: "images/tjs_465_photo_02.jpg",
        caption: "TK-465 roof nozzle corrosion",
      },
      {
        attachmentId: "tjs-photo-003",
        kind: "photo",
        relativePath: "images/tjs_465_photo_03.jpg",
        caption: "TK-465 shell nozzle corrosion",
      },
    ],
    mflImport: null,
    reviewStatus: {
      status: "ready_for_upload",
      warnings: ["Original roof thickness not yet confirmed for calculations."],
    },
  };

  return createWorkspaceFromPackage(demoPackage, "tk-465-demo-package.json");
}

export function buildReportPlan(workspace: ReportWorkspace): ReportPlanEntry[] {
  const requiredSectionIds = new Set([
    "scope-of-inspection",
    "general-tank-information",
    "inspection-report",
    "test-information",
    "tank-inspection-checklist",
  ]);

  return workspace.sections.map((section) => {
    const source: ReportPlanEntry["source"] = section.group === "Custom" ? "custom" : "template";
    const isBlocked = section.status === "blocked";
    const recommendation: SectionPlanRecommendation = isBlocked
      ? "deferred"
      : requiredSectionIds.has(section.id)
        ? "required"
        : inferSectionRecommendation(section);
    const locked = recommendation === "required";
    const included = recommendation === "required" || recommendation === "recommended";

    return {
      sectionId: section.id,
      templateSection: section.templateSection,
      sequence: section.sequence,
      title: section.title,
      group: section.group,
      source,
      status: section.status,
      recommendation,
      included,
      locked,
      reason: planReasonForSection(section, recommendation),
      basis: section.facts.slice(0, 3),
    };
  });
}

export function createCustomSection(title: string, purpose: string, sequence: number): ReportSection {
  const cleanedTitle = title.trim() || `Custom Section ${sequence}`;
  const cleanedPurpose = purpose.trim();
  const sectionLabel = `Section ${String(sequence).padStart(2, "0")}`;

  return {
    id: `custom-${sequence}-${slugify(cleanedTitle)}`,
    sequence,
    templateSection: sectionLabel,
    title: cleanedTitle,
    group: "Custom",
    status: "manual required",
    summary: cleanedPurpose || "User-defined report section added after the generated section plan review.",
    modes: ["preview"],
    draft: cleanedPurpose
      ? `This custom section was added by the reviewer for the following purpose: ${cleanedPurpose}`
      : "This custom section was added by the reviewer and should be filled manually or refined with AI once the plan is confirmed.",
    facts: ["User-added custom section", cleanedPurpose || "No custom purpose entered yet"].filter(Boolean),
    references: [
      {
        title: "Custom section basis",
        items: [cleanedPurpose || "Reviewer-defined section outside the default sample-report template."],
      },
    ],
    aiPlaybook: playbook(
      "Refine this custom section without breaking the factual limits of the uploaded package.",
      ["reviewer instructions", "uploaded package facts", "approved report tone"],
      ["Do not invent calculations, standards conclusions, or unsupported floor/MFL content."],
      [
        action("custom-draft", "Draft custom section", "draft", "Draft the custom section from the reviewer purpose and available package facts."),
        action("custom-format", "Format cleanly", "format", "Format the custom section to match the rest of the report."),
        action("custom-tighten", "Tighten wording", "tighten", "Keep the custom section concise and report-ready."),
      ],
    ),
  };
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

function inferSectionRecommendation(section: ReportSection): SectionPlanRecommendation {
  if (section.status === "blocked") {
    return "deferred";
  }
  if (
    section.group === "Measurements" ||
    section.group === "Layouts" ||
    section.id === "repair-recommendations-api-assessment" ||
    section.id === "inspection-maintenance-regime" ||
    section.id === "photographs"
  ) {
    return "recommended";
  }
  return "optional";
}

function planReasonForSection(section: ReportSection, recommendation: SectionPlanRecommendation): string {
  if (section.group === "Custom") {
    return "Reviewer-added section. Include it only if the client template or final narrative requires it.";
  }

  switch (recommendation) {
    case "required":
      return "Core section in the TK-465 sample report structure and already supported by the current capture plus review workflow.";
    case "recommended":
      if (section.status === "manual required") {
        return "Part of the standard report flow, but it still needs reviewer-controlled wording or checklist completion before release.";
      }
      return "Supported by current capture data and recommended by the sample report / API-oriented report flow.";
    case "optional":
      return "Useful when the reviewer wants extra clarity, but not essential to the first complete draft.";
    case "deferred":
      return "Visible for template honesty, but current Android capture does not yet provide the evidence needed to populate this section safely.";
  }
}

function buildFindingReferenceItems(findings: CanonicalFinding[], attachments: CanonicalAttachment[]): string[] {
  if (findings.length === 0) {
    return ["No linked findings for this section in the current package."];
  }

  const items = findings.map((finding) => {
    const linkedFiles = linkedAttachmentPaths(attachments, finding.attachmentIds ?? []);
    return `${finding.findingId} — ${finding.type}${finding.locationSummary ? ` / ${finding.locationSummary}` : ""}${linkedFiles.length > 0 ? ` / ${linkedFiles.join(", ")}` : ""}`;
  });
  return limitItems(items);
}

function linkedAttachmentPaths(attachments: CanonicalAttachment[], ids: string[]): string[] {
  const attachmentMap = new Map(attachments.map((attachment) => [attachment.attachmentId, attachment]));
  const paths = ids
    .map((id) => attachmentMap.get(id))
    .filter((attachment): attachment is CanonicalAttachment => Boolean(attachment))
    .map((attachment) => `${attachment.relativePath}${attachment.caption ? ` — ${attachment.caption}` : ""}`);
  return paths.length > 0 ? paths : ["No linked files."];
}

function limitItems(items: string[], max = 5): string[] {
  if (items.length <= max) return items;
  return [...items.slice(0, max), `+ ${items.length - max} more`];
}

function countUniqueStrings(values: Array<string | null | undefined>): number {
  return new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)).size;
}

function totalReadingCount(readingsGroups: number[][]): number {
  return readingsGroups.reduce((sum, readings) => sum + readings.length, 0);
}

function describeReadingCoverage(readingsGroups: number[][], targetLabel: string): string {
  const counts = readingsGroups.map((readings) => readings.length).filter((count) => count > 0);
  if (counts.length === 0) {
    return `no structured readings per ${targetLabel}`;
  }
  const minimum = Math.min(...counts);
  const maximum = Math.max(...counts);
  if (minimum === maximum) {
    return `${minimum} reading${minimum === 1 ? "" : "s"} per ${targetLabel}`;
  }
  return `${minimum} to ${maximum} readings per ${targetLabel}`;
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
