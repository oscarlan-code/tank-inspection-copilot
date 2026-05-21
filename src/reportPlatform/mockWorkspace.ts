export type SectionStatus = "auto" | "auto + review" | "manual required" | "blocked";
export type SectionMode = "preview" | "layout" | "checklist";
export type LayoutSceneKind = "shell" | "roof";

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

export const reportSections: ReportSection[] = [
  {
    id: "general-information",
    title: "General Tank Information",
    group: "Report Template",
    status: "auto + review",
    summary: "Client, tank identity, service envelope, and core dimensions from the canonical package.",
    modes: ["preview"],
    draft:
      "Tank 465 at Tanjong Penjuru Terminal is a vertical atmospheric storage tank inspected for internal and external condition review. The current package provides tank identity, roof type, shell course count, and measurement coverage summary, but the final report wording still needs user review for document-control consistency.",
    facts: [
      "Client: TJS Pte Ltd (Chemstationasia Group)",
      "Tank Number: 465",
      "Diameter: 7.8 m",
      "Height: 9.14 m",
      "Shell courses: 4",
      "Inspection type: Internal & External",
    ],
  },
  {
    id: "inspection-report",
    title: "Inspection Report Narrative",
    group: "Report Template",
    status: "auto + review",
    summary: "Narrative section drafted from findings, UT coverage, and linked evidence.",
    modes: ["preview"],
    draft:
      "The current inspection package indicates satisfactory coverage across shell, roof, and nozzle measurement lanes, with localized defect documentation linked to photographs and location context. Narrative wording should be refined with operator observations and any client-specific limitation statements before release.",
    facts: [
      "3 findings linked to captured evidence",
      "54 measurement rows in the seeded TK-465 scenario",
      "Review warnings cleared before export",
      "Narrative should reference supporting photographs and linked measurement IDs",
    ],
  },
  {
    id: "inspection-checklist",
    title: "Tank Inspection Checklist",
    group: "Report Template",
    status: "manual required",
    summary: "Inspector-completed checklist section with linked references and section confirmation.",
    modes: ["checklist", "preview"],
    draft:
      "Checklist outcomes will be summarized here after the inspector completes and confirms the selected items for this section.",
    facts: [
      "Checklist answers come from the web workflow, not the Android package",
      "Each checklist item should support quick notes",
      "Section must be confirmed before continuing",
    ],
  },
  {
    id: "shell-thickness",
    title: "Shell Plate Thickness Measurements",
    group: "Measurements",
    status: "auto",
    summary: "Structured shell UT rows and line-plan context from the canonical package.",
    modes: ["preview", "layout"],
    layoutScene: "shell",
    draft:
      "Shell ultrasonic thickness readings were captured at four crawler lanes with row-level linkage to shell courses and azimuth context. This section can render both a table view and a shell layout view to support report review.",
    facts: [
      "24 shell UT rows in the TK-465 demo package",
      "4 crawler lanes",
      "Minimum five readings per shell row expected by the report scope",
      "Row locations are available by lane and course",
    ],
  },
  {
    id: "roof-thickness",
    title: "Roof Plate Thickness Measurements",
    group: "Measurements",
    status: "auto + review",
    summary: "Roof UT rows with plate-linked context and roof layout references.",
    modes: ["preview", "layout"],
    layoutScene: "roof",
    draft:
      "Roof ultrasonic measurements are linked to roof plates and can be reviewed against the roof layout for context. Final wording should note any assumptions used when original roof thickness is unavailable.",
    facts: [
      "23 roof UT rows in the TK-465 demo package",
      "Plate-linked roof readings",
      "Roof layout exists for fixed roof rendering",
      "Original roof thickness may need manual confirmation for calculations",
    ],
  },
  {
    id: "layout-evidence",
    title: "Layout and Evidence Review",
    group: "Evidence",
    status: "auto + review",
    summary: "Interactive shell and roof layout review with finding markers and linked evidence.",
    modes: ["layout", "preview"],
    layoutScene: "shell",
    draft:
      "The web platform should present technical layouts with clear finding and nozzle markers, so the reviewer can confirm that narrative statements match the physical location context before exporting the report.",
    facts: [
      "Renderer should support shell and roof scenes",
      "Markers should link back to findings and attachments",
      "Users need snapshot framing and visibility controls",
    ],
  },
  {
    id: "recommendations",
    title: "Repair Recommendations / API Assessment",
    group: "Assessment",
    status: "manual required",
    summary: "Deterministic calculations plus human-approved narrative recommendations.",
    modes: ["preview"],
    draft:
      "Recommendations should be generated from deterministic calculation outputs and evidence-backed findings, then reviewed and refined by the inspector or engineer before final report release.",
    facts: [
      "LLM can help draft wording but should not invent engineering conclusions",
      "API guidance should be used as retrieval support",
      "Final recommendation wording requires human review",
    ],
  },
];

export const checklistItems: ChecklistItem[] = [
  {
    id: "check-dike-area",
    label: "Diked area condition reviewed for vegetation, debris, and erosion.",
    reference: "IRS checklist / API 575 external inspection practice",
    answer: "pass",
    note: "No major obstruction recorded in the current draft.",
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
    answer: "needs review",
    note: "Need to confirm wording around unavailable original roof thickness.",
  },
  {
    id: "check-nozzle-state",
    label: "Nozzle and reinforcement pad inspection status recorded.",
    reference: "Nozzle UT lane / report section 10 and 14 alignment",
    answer: "pass",
    note: "Awaiting final narrative formatting only.",
  },
];

export const shellMarkers: LayoutMarker[] = [
  {
    id: "shell-find-1",
    label: "F1",
    kind: "finding",
    severity: "high",
    x: 28,
    y: 22,
    description: "Localized wall-loss area linked to shell row C1-L2 and photo evidence.",
  },
  {
    id: "shell-nozzle-1",
    label: "N2",
    kind: "nozzle",
    x: 72,
    y: 58,
    description: "Shell nozzle registry point for nozzle N2 with reinforcement pad reading.",
  },
  {
    id: "shell-row-1",
    label: "L3-C2",
    kind: "measurement",
    x: 60,
    y: 36,
    description: "Representative shell UT row on lane 3, course 2.",
  },
];

export const roofMarkers: LayoutMarker[] = [
  {
    id: "roof-find-1",
    label: "RF1",
    kind: "finding",
    severity: "medium",
    x: 62,
    y: 34,
    description: "Roof observation linked to plate R-12 and photo evidence.",
  },
  {
    id: "roof-nozzle-1",
    label: "RN1",
    kind: "nozzle",
    x: 50,
    y: 18,
    description: "Roof nozzle registry point with UT support.",
  },
  {
    id: "roof-row-1",
    label: "P-08",
    kind: "measurement",
    x: 35,
    y: 48,
    description: "Representative roof plate measurement marker.",
  },
];

export const packageAssets = [
  "inspection-package.json",
  "manifest.json",
  "attachments/",
  "findings/",
  "measurements/",
];

export const standardsLibrary = [
  "API 653",
  "API 575",
  "IRS sample report TK-465",
  "Historical approved report library",
];
