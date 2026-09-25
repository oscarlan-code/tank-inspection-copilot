import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Keep this audit deterministic. It validates orchestration/routing rules, not model quality.
process.env.PATH = "";

const reportPlatformRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturePath = join(reportPlatformRoot, "src", "fixtures", "v3-product-export-shell-internal.json");
const exportPackage = JSON.parse(readFileSync(fixturePath, "utf8"));

const [
  generation,
  layoutMapFigure,
  reportToc,
  reportClassification,
  precedentKb,
  reportBlocks,
] = await Promise.all([
  import("../generation.mjs"),
  import("../layout-map-figure.mjs"),
  import("../report-toc.mjs"),
  import("../report-classification.mjs"),
  import("../precedent-kb.mjs"),
  import("../report-blocks.mjs"),
]);

const {
  generateSectionAssistantReply,
  generateSectionDraft,
  getSectionTemplate,
} = generation;
const {
  API_STANDARD_PRIMARY_REPORT,
  API_STANDARD_REPORT_TOC,
} = reportToc;
const { buildLayoutFigureSvg, getEffectiveLayoutMap } = layoutMapFigure;
const { classifyReportPackage } = reportClassification;
const { searchPrecedentPack } = precedentKb;
const { buildReportBlockManifest } = reportBlocks;

const failures = [];

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function approximatelyEqual(left, right, tolerance = 0.000002) {
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance;
}

function containsAll(value, snippets) {
  return snippets.every((snippet) => value.includes(snippet));
}

function buildReportState(overrides = {}) {
  return {
    exportPackage,
    manualSupplement: {
      reportReference: API_STANDARD_PRIMARY_REPORT.reference,
      inspectedDate: API_STANDARD_PRIMARY_REPORT.inspectedDate,
    },
    sectionDrafts: [],
    layoutOverrides: [],
    reportClassification: classifyReportPackage(exportPackage),
    ...overrides,
  };
}

const reportState = buildReportState();
const retrievalLeakProbe = searchPrecedentPack({
  reportState,
  sectionId: "inspection-report",
  allowBuild: false,
  limit: 8,
});
assert(
  retrievalLeakProbe.excludedSourceChunkCount > 0,
  "V3 mock report retrieval must exclude same-report/gold chunks from the precedent KB.",
);
assert(
  retrievalLeakProbe.wordingPrecedents.every(
    (precedent) => !precedent.sourceReportName.includes("22PE1-4 TK V10 Internal & External Inspection Report"),
  ),
  "V3 mock report generation must not retrieve the 22PE1-4 gold report as wording precedent.",
);

const roofLayoutConfig = exportPackage.layoutConfigs.find((config) => config.targetKey === "external_roof");
const shellLayoutConfig = exportPackage.layoutConfigs.find((config) => config.targetKey === "shell");
const floorLayoutConfig = exportPackage.layoutConfigs.find((config) => config.targetKey === "floor");
const roofCustomPlateCount = roofLayoutConfig?.customCircularLayout?.rows?.reduce(
  (sum, row) => sum + (Array.isArray(row.plates) ? row.plates.length : 0),
  0,
);
assert(
  roofLayoutConfig?.roofRowCount === 13 &&
    roofLayoutConfig.customCircularLayout?.rows?.length === 13 &&
    roofCustomPlateCount === 59,
  "V3 fixture roof layout must match the app custom circular layout: 13 rows and 59 plates.",
);
assert(
  shellLayoutConfig?.shellPlateOffset === "third_plate" && shellLayoutConfig.shellThirdOffsetStart === "full",
  "V3 fixture shell layout must match the app third-plate offset setup.",
);
const resolvedFloorPlateIds = floorLayoutConfig?.customCircularLayout?.resolvedMainPlateGeometry?.map(
  (plate) => plate.plateId,
);
assert(
  floorLayoutConfig?.customCircularLayout?.resolvedGeometryVersion === 2 &&
    resolvedFloorPlateIds?.length === 24 &&
    resolvedFloorPlateIds.includes("6.2a") &&
    resolvedFloorPlateIds.includes("6.2b"),
  "V3 fixture floor layout must carry the 24 main-plate bounds resolved by the app layout tool.",
);
const resolvedAnnularPlates = floorLayoutConfig?.customCircularLayout?.resolvedAnnularPlateGeometry ?? [];
assert(
  resolvedAnnularPlates.length === 10 &&
    resolvedAnnularPlates.every((plate, index) => plate.mapLabel === `A${index + 1}` && plate.points?.length >= 3),
  "V3 fixture floor layout must carry all 10 app-resolved annular polygons and A1-A10 labels.",
);

const floorLayoutSection = API_STANDARD_REPORT_TOC.find(
  (section) => section.id === "floor-plate-layout-platemaps-numbering-system",
);
const importedFloorMap = floorLayoutSection
  ? getEffectiveLayoutMap(reportState, floorLayoutSection)
  : null;
const exportedFloorPlates = [
  ...(floorLayoutConfig?.customCircularLayout?.resolvedMainPlateGeometry ?? []),
  ...resolvedAnnularPlates,
];
assert(importedFloorMap?.plates.length === 34, "Report-platform must import the app's complete 34-plate floor map.");
exportedFloorPlates.forEach((exportedPlate) => {
  const importedPlate = importedFloorMap?.plates.find((plate) => plate.id === exportedPlate.plateId);
  assert(Boolean(importedPlate), `Report-platform dropped app plate ${exportedPlate.plateId}.`);
  if (!importedPlate) return;
  assert(
    approximatelyEqual(importedPlate.x, exportedPlate.leftNorm) &&
      approximatelyEqual(importedPlate.y, exportedPlate.topNorm) &&
      approximatelyEqual(importedPlate.width, exportedPlate.rightNorm - exportedPlate.leftNorm) &&
      approximatelyEqual(importedPlate.height, exportedPlate.bottomNorm - exportedPlate.topNorm) &&
      importedPlate.mapLabel === exportedPlate.mapLabel &&
      approximatelyEqual(importedPlate.labelX, exportedPlate.labelXNorm) &&
      approximatelyEqual(importedPlate.labelY, exportedPlate.labelYNorm),
    `Report-platform changed app geometry or label placement for ${exportedPlate.plateId}.`,
  );
  if (Array.isArray(exportedPlate.points)) {
    assert(
      importedPlate.points?.length === exportedPlate.points.length &&
        importedPlate.points.every((point, index) => (
          approximatelyEqual(point.x, exportedPlate.points[index].xNorm) &&
          approximatelyEqual(point.y, exportedPlate.points[index].yNorm)
        )),
      `Report-platform regenerated app annular polygon ${exportedPlate.plateId}.`,
    );
  }
  assert(
    importedPlate.source.includes(":resolved"),
    `Report-platform used fallback geometry instead of resolved app geometry for ${exportedPlate.plateId}.`,
  );
});

const exportedFloorElements = exportPackage.elements.filter((element) => element.targetKey === "floor");
assert(exportedFloorElements.length === 8, "V3 fixture must export the eight floor-map elements S1-S8.");
exportedFloorElements.forEach((element) => {
  const marker = importedFloorMap?.markers.find((candidate) => candidate.id === element.elementId);
  assert(
    marker?.label === element.elementLabel &&
      approximatelyEqual(marker.x, element.normalizedX) &&
      approximatelyEqual(marker.y, element.normalizedY),
    `Report-platform changed app element coordinates for ${element.elementLabel}.`,
  );
});

const edgeMarkerPackage = structuredClone(exportPackage);
const edgeMarker = edgeMarkerPackage.elements.find((element) => element.targetKey === "floor");
edgeMarker.normalizedX = 0.001;
edgeMarker.normalizedY = 0.999;
const edgeMarkerMap = getEffectiveLayoutMap(
  buildReportState({ exportPackage: edgeMarkerPackage }),
  floorLayoutSection,
);
const importedEdgeMarker = edgeMarkerMap?.markers.find((marker) => marker.id === edgeMarker.elementId);
assert(
  approximatelyEqual(importedEdgeMarker?.x, 0.001) && approximatelyEqual(importedEdgeMarker?.y, 0.999),
  "Report-platform must not shift app-owned element coordinates near the floor-map boundary.",
);

const r6 = exportPackage.utMeasurements.find(
  (measurement) => measurement.itemKey === "external_roof:element:external_roof_nozzle_r6",
);
assert(Boolean(r6), "Fixture must include roof nozzle R6 UT measurement row.");
assert(r6?.value1 === 6.43 && r6?.reinforcementPadReading === 6.07, "Fixture R6 values changed unexpectedly.");

const measurementExpectations = [
  {
    sectionId: "roof-plate-thickness-measurements",
    snippets: ["report-measurement-table", "Plate No.", "LAIQ inspection app V3 export"],
  },
  {
    sectionId: "roof-nozzle-reinforcement-pad-thickness-measurements",
    snippets: ["report-measurement-table", "R6", "6 in", "6.43", "6.62", "6.72", "6.55", "6.07"],
    forbidden: ["Pending confirmation"],
  },
  {
    sectionId: "shell-plate-thickness-measurements",
    snippets: ["report-measurement-table", "Location", "LAIQ inspection app V3 export"],
  },
  {
    sectionId: "shell-nozzle-reinforcement-pad-thickness-measurements",
    snippets: ["report-measurement-table", "S6", "24 in", "13.89", "13.92", "13.24", "13.96", "13.85"],
  },
];

const scopeDraft = await generateSectionDraft({
  reportState,
  sectionId: "scope-of-inspection",
  userInstruction: "Audit prediction provenance marking.",
});
assert(
  scopeDraft.draft.content.includes('data-laiq-provenance="llm_prediction"'),
  "AI/template-generated narrative content must expose AI prediction provenance blocks for reviewer provenance.",
);
assert(
  scopeDraft.draft.content.includes('data-laiq-provenance="precedent_template"'),
  "Template/report-family wording must be separated from AI inferred wording with precedent-template provenance.",
);
assertNoCoreAppFactsInTemplateBlocks(scopeDraft.draft.content, "scope-of-inspection");

const generalInfoDraft = await generateSectionDraft({
  reportState,
  sectionId: "general-tank-information",
  userInstruction: "Audit app field provenance marking.",
});
assert(
  [
    exportPackage.inspectionRecord.client,
    exportPackage.task.tankNumber,
    exportPackage.inspectionReference,
  ].every((fact) => allProvenanceTextSegments(generalInfoDraft.draft.content, "app_field_data").some((segment) => segment.includes(fact))),
  "App-export facts such as client, tank, and inspection reference must be marked as app field data, not AI prediction.",
);
assert(
  allProvenanceTextSegments(generalInfoDraft.draft.content, "llm_prediction").every(
    (segment) => !segment.includes(exportPackage.inspectionRecord.client) && !segment.includes(exportPackage.inspectionReference),
  ),
  "AI prediction provenance blocks must not absorb core app-export identity facts.",
);
assertNoCoreAppFactsInTemplateBlocks(generalInfoDraft.draft.content, "general-tank-information");

const inspectionReportDraft = await generateSectionDraft({
  reportState,
  sectionId: "inspection-report",
  userInstruction: "Audit app narrative provenance marking.",
});
assert(
  allProvenanceTextSegments(inspectionReportDraft.draft.content, "app_field_data").length > 0,
  "Inspection report observations derived from app voice/notes must be grouped as app field data, not template-only text.",
);
assert(
  inlineProvenanceTextSegments(generalInfoDraft.draft.content, "precedent_template").some((segment) =>
    segment.includes("Diameter / Height:"),
  ) &&
    inlineProvenanceTextSegments(generalInfoDraft.draft.content, "app_field_data").some((segment) =>
      segment.includes("14.535 m"),
    ) &&
    inlineProvenanceTextSegments(generalInfoDraft.draft.content, "precedent_template").some((segment) =>
      segment.includes("Shell Course Count:"),
    ) &&
    inlineProvenanceTextSegments(generalInfoDraft.draft.content, "app_field_data").some((segment) =>
      segment === "8",
    ),
  "Structured field rows must split template labels from app-captured values.",
);
assertNoCoreAppFactsInTemplateBlocks(inspectionReportDraft.draft.content, "inspection-report");

const checklistDraft = await generateSectionDraft({
  reportState,
  sectionId: "tank-inspection-checklist",
  userInstruction: "Audit checklist prompt fidelity.",
});
assert(
  !/Training checklist\s+\d+/i.test(checklistDraft.draft.content),
  "Tank inspection checklist output must not expose placeholder training item names.",
);
assert(
  [
    "Diked area condition (vegetation, debris, erosion):",
    "Dike wall condition (erosion, cracks):",
    "Flammable materials within the diked area (wood, product):",
    "Shell corrosion (API 653 4.3):",
    "Floor condition (corrosion, pitting):",
  ].every((snippet) => checklistDraft.draft.content.includes(snippet)),
  "Tank inspection checklist output must use canonical app checklist item prompts.",
);
assert(
  checklistDraft.draft.content.includes("checklist-item-prompt") &&
    checklistDraft.draft.content.includes("checklist-response-heading"),
  "Tank inspection checklist output must include balanced item/response column classes.",
);
const checklistBlocks = buildReportBlockManifest(checklistDraft.draft.content, {
  sectionId: "tank-inspection-checklist",
});
const checklistTableBlock = checklistBlocks.find((block) => block.blockType === "checklist_table");
assert(
  Boolean(checklistTableBlock),
  "Generated checklist output must expose a typed checklist_table report block for controlled editing.",
);
assert(
  checklistTableBlock?.capabilities.includes("set_checklist_marker") &&
    checklistTableBlock?.sourcePolicy === "app_structured_data_locked",
  "Checklist table block must expose controlled marker editing while keeping app-structured data locked.",
);

const checklistWidthReply = await generateSectionAssistantReply({
  reportState,
  sectionId: "tank-inspection-checklist",
  userPrompt: "refine the format of this table, the item column should be wider, the response column should be narrower",
});
assert(
  checklistWidthReply.providerCode === "deterministic_table_formatter",
  "Checklist column-width request must be handled by the deterministic table formatter.",
);
assert(
  checklistWidthReply.actions.some(
    (action) =>
      action.type === "replace_section_content" &&
      action.contentHtml?.includes("checklist-report-table-balanced") &&
      action.contentHtml?.includes("checklist-item-prompt") &&
      action.contentHtml?.includes('colwidth="560"'),
  ),
  "Checklist column-width request must return a balanced checklist replacement table action.",
);

const checklistReduceWidthReply = await generateSectionAssistantReply({
  reportState: buildReportState({
    sectionDrafts: [
      {
        sectionId: "tank-inspection-checklist",
        content: checklistWidthReply.actions.find((action) => action.type === "replace_section_content")?.contentHtml,
        generated: true,
        edited: false,
        approved: false,
        reviewRequired: true,
      },
    ],
  }),
  sectionId: "tank-inspection-checklist",
  userPrompt: "the item column width could be reduced by 20%",
});
assert(
  checklistReduceWidthReply.providerCode === "deterministic_table_formatter",
  "Checklist percent column-width request must be handled by the deterministic table formatter.",
);
assert(
  checklistReduceWidthReply.actions.some(
    (action) =>
      action.type === "replace_section_content" &&
      action.contentHtml?.includes('class="checklist-item-heading" colwidth="448"') &&
      action.contentHtml?.includes('class="checklist-response-heading" colwidth="42"'),
  ),
  "Checklist item-column 20% reduction must calculate 560px -> 448px and preserve response columns.",
);

const checklistConfirmationReply = await generateSectionAssistantReply({
  reportState,
  sectionId: "tank-inspection-checklist",
  userPrompt: "yes",
  conversationHistory: [
    {
      role: "assistant",
      content:
        "I can rebuild the checklist table HTML with a wider Inspection Item column and narrower response columns. Should I apply those column widths?",
    },
    {
      role: "user",
      content: "yes",
    },
  ],
});
assert(
  checklistConfirmationReply.providerCode === "deterministic_table_formatter",
  "Checklist confirmation reply must resume the prior table-formatting offer instead of asking another clarification.",
);
assert(
  checklistConfirmationReply.actions.some((action) => action.type === "replace_section_content"),
  "Checklist confirmation reply must apply the pending replacement-table action.",
);

const checklistMarkerReply = await generateSectionAssistantReply({
  reportState: buildReportState({
    sectionDrafts: [
      {
        sectionId: "tank-inspection-checklist",
        content: checklistDraft.draft.content,
        generated: true,
        edited: false,
        approved: false,
        reviewRequired: true,
      },
    ],
  }),
  sectionId: "tank-inspection-checklist",
  userPrompt: 'can you change the response marker from dot to "tick"',
});
const checklistMarkerAction = checklistMarkerReply.actions.find(
  (action) => action.type === "replace_section_content",
);
assert(
  checklistMarkerReply.providerCode === "deterministic_content_transform",
  "Checklist marker-style request must be handled by the deterministic content-transform tool.",
);
assert(
  Boolean(checklistMarkerAction),
  "Checklist marker-style request must return a replacement table action.",
);
assert(
  checklistMarkerAction?.contentHtml?.includes("✓") &&
    !checklistMarkerAction.contentHtml.includes("●"),
  "Checklist marker-style action must replace selected-response dots with ticks.",
);

const checklistCrossReply = await generateSectionAssistantReply({
  reportState: buildReportState({
    sectionDrafts: [
      {
        sectionId: "tank-inspection-checklist",
        content: checklistMarkerAction?.contentHtml,
        generated: true,
        edited: true,
        approved: false,
        reviewRequired: true,
      },
    ],
  }),
  sectionId: "tank-inspection-checklist",
  userPrompt: 'change "tick" to cross "x", the rest should remain the same',
});
const checklistCrossAction = checklistCrossReply.actions.find(
  (action) => action.type === "replace_section_content",
);
assert(
  checklistCrossReply.providerCode === "deterministic_content_transform",
  "Checklist cross-marker request must be handled by the deterministic content-transform tool.",
);
assert(
  Boolean(checklistCrossAction),
  "Checklist cross-marker request must return a replacement table action.",
);
assert(
  checklistCrossAction?.contentHtml?.includes("×") &&
    !checklistCrossAction.contentHtml.includes("✓") &&
    !checklistCrossAction.contentHtml.includes("●"),
  "Checklist cross-marker action must replace selected-response ticks with crosses only.",
);

const exactReplacementReply = await generateSectionAssistantReply({
  reportState: buildReportState({
    sectionDrafts: [
      {
        sectionId: "tank-inspection-checklist",
        content: checklistCrossAction?.contentHtml,
        generated: true,
        edited: true,
        approved: false,
        reviewRequired: true,
      },
    ],
  }),
  sectionId: "tank-inspection-checklist",
  userPrompt: 'replace "editable before final issue" with "editable before final review"',
});
const exactReplacementAction = exactReplacementReply.actions.find(
  (action) => action.type === "replace_section_content",
);
assert(
  exactReplacementReply.providerCode === "deterministic_content_transform",
  "Exact generated-content text replacement must be handled by the deterministic content-transform tool.",
);
assert(
  exactReplacementAction?.contentHtml?.includes("editable before final review") &&
    !exactReplacementAction.contentHtml.includes("editable before final issue"),
  "Exact generated-content replacement must return visibly updated section HTML.",
);

const styleReply = await generateSectionAssistantReply({
  reportState: buildReportState({
    sectionDrafts: [
      {
        sectionId: "tank-inspection-checklist",
        content: checklistDraft.draft.content,
        generated: true,
        edited: false,
        approved: false,
        reviewRequired: true,
      },
    ],
  }),
  sectionId: "tank-inspection-checklist",
  userPrompt: "enlarge the font by two size and bold it",
});
const styleAction = styleReply.actions.find((action) => action.type === "apply_text_style");
assert(
  styleReply.providerCode === "deterministic_content_transform",
  "Direct generated-content style request must be handled by the deterministic content-transform tool.",
);
assert(
  styleAction?.fontSize === "20px" && styleAction?.fontWeight === "bold",
  "Direct generated-content style request must return 20px bold whole-section styling.",
);
assert(
  styleReply.controlTrace?.planner === "deterministic_tool" &&
    styleReply.controlTrace?.status === "applied" &&
    styleReply.controlTrace?.operation === "apply_text_style(section)",
  "Direct generated-content style request must expose an applied deterministic control trace.",
);

const tableStyleReply = await generateSectionAssistantReply({
  reportState: buildReportState({
    sectionDrafts: [
      {
        sectionId: "tank-inspection-checklist",
        content: checklistDraft.draft.content,
        generated: true,
        edited: false,
        approved: false,
        reviewRequired: true,
      },
    ],
  }),
  sectionId: "tank-inspection-checklist",
  userPrompt: "change font color of the table contents to red",
});
const tableStyleAction = tableStyleReply.actions.find((action) => action.type === "apply_text_style");
assert(
  tableStyleReply.providerCode === "deterministic_content_transform",
  "Table-content style request must be handled by the deterministic content-transform tool.",
);
assert(
  tableStyleAction?.styleScope === "table" &&
    tableStyleAction?.color === "#ef4c57" &&
    tableStyleAction?.targetBlockId,
  "Table-content style request must return a table-scoped red style action with a table block target.",
);
assert(
  tableStyleReply.controlTrace?.operation === "apply_text_style(table)",
  "Table-content style request must expose a table-scoped control trace.",
);

const styleOfferHistory = [
  {
    role: "assistant",
    content: "This section is already backed by the LAIQ inspection app V3 export.",
  },
  {
    role: "user",
    content: "enlarge the font by two size and bold it",
  },
  {
    role: "assistant",
    content:
      "I can apply whole-section styling for this checklist, including enlarged font and bold weight. Should I apply it?",
  },
];
for (const confirmation of ["yes", "do it"]) {
  const confirmationReply = await generateSectionAssistantReply({
    reportState: buildReportState({
      sectionDrafts: [
        {
          sectionId: "tank-inspection-checklist",
          content: checklistDraft.draft.content,
          generated: true,
          edited: false,
          approved: false,
          reviewRequired: true,
        },
      ],
    }),
    sectionId: "tank-inspection-checklist",
    userPrompt: confirmation,
    conversationHistory: [
      ...styleOfferHistory,
      {
        role: "user",
        content: confirmation,
      },
    ],
  });
  const confirmationStyleAction = confirmationReply.actions.find((action) => action.type === "apply_text_style");
  assert(
    confirmationReply.providerCode === "deterministic_content_transform",
    `Continuous conversation confirmation "${confirmation}" must resume the pending style offer.`,
  );
  assert(
    confirmationStyleAction?.fontSize === "20px" && confirmationStyleAction?.fontWeight === "bold",
    `Continuous conversation confirmation "${confirmation}" must apply the pending 20px bold style action.`,
  );
}

const repeatAppliedStyleReply = await generateSectionAssistantReply({
  reportState: buildReportState({
    sectionDrafts: [
      {
        sectionId: "tank-inspection-checklist",
        content: checklistDraft.draft.content,
        generated: true,
        edited: false,
        approved: false,
        reviewRequired: true,
      },
    ],
  }),
  sectionId: "tank-inspection-checklist",
  userPrompt: "do it",
  conversationHistory: [
    {
      role: "assistant",
      content: "This section is already backed by the LAIQ inspection app V3 export.",
    },
    {
      role: "user",
      content: "enlarge the font by two size and bold it",
    },
    {
      role: "assistant",
      content: "Applied the requested whole-section style control to the generated report draft.",
    },
    {
      role: "user",
      content: "do it",
    },
  ],
});
const repeatAppliedStyleAction = repeatAppliedStyleReply.actions.find((action) => action.type === "apply_text_style");
assert(
  repeatAppliedStyleReply.providerCode === "deterministic_content_transform",
  "Continuous conversation after an already-applied assistant reply must preserve the previous style intent.",
);
assert(
  repeatAppliedStyleAction?.fontSize === "20px" && repeatAppliedStyleAction?.fontWeight === "bold",
  "Continuous conversation after an already-applied assistant reply must return the previous 20px bold style action.",
);

const pendingReplacePlan = {
  reply: "I found a feasible edit path for this generated section.",
  operations: [
    {
      op: "replace_text",
      targetBlockId: null,
      reason: "User confirmed a saved exact text replacement plan.",
      findText: "editable before final issue",
      replaceWith: "editable before final review",
      replaceAll: true,
      marker: null,
      markerLabel: null,
      contentHtml: null,
      fontFamily: null,
      fontSize: null,
      fontWeight: null,
      textAlign: null,
      color: null,
    },
  ],
};
const confirmedPendingPlanReply = await generateSectionAssistantReply({
  reportState: buildReportState({
    sectionDrafts: [
      {
        sectionId: "tank-inspection-checklist",
        content: checklistDraft.draft.content,
        generated: true,
        edited: false,
        approved: false,
        reviewRequired: true,
      },
    ],
  }),
  sectionId: "tank-inspection-checklist",
  userPrompt: "apply",
  conversationHistory: [
    {
      role: "assistant",
      content: "I found a feasible edit path for this generated section. Please click Apply to run this edit.",
      pendingConfirmation: {
        confirmationId: "audit-pending-replace",
        label: "Confirm generated-content edit",
        summary: "Apply planned operation: replace_text.",
        risk: "medium",
        operation: "replace_text",
        args: {
          plan: pendingReplacePlan,
        },
      },
    },
    {
      role: "user",
      content: "apply",
    },
  ],
});
const confirmedPendingPlanAction = confirmedPendingPlanReply.actions.find(
  (action) => action.type === "replace_section_content",
);
assert(
  confirmedPendingPlanReply.controlTrace?.planner === "structured_planner" &&
    confirmedPendingPlanReply.controlTrace?.status === "applied",
  "Confirmed pending generated-content plan must execute through the structured planner trace.",
);
assert(
  confirmedPendingPlanAction?.contentHtml?.includes("editable before final review"),
  "Confirmed pending generated-content plan must apply the saved operation to the draft.",
);

const ambiguousWithoutOfferReply = await generateSectionAssistantReply({
  reportState: buildReportState({
    sectionDrafts: [
      {
        sectionId: "tank-inspection-checklist",
        content: checklistDraft.draft.content,
        generated: true,
        edited: false,
        approved: false,
        reviewRequired: true,
      },
    ],
  }),
  sectionId: "tank-inspection-checklist",
  userPrompt: "do it",
  conversationHistory: [
    {
      role: "assistant",
      content: "This section is already backed by the LAIQ inspection app V3 export.",
    },
    {
      role: "user",
      content: "do it",
    },
  ],
});
assert(
  ambiguousWithoutOfferReply.providerCode === "deterministic_guard" &&
    ambiguousWithoutOfferReply.actions.length === 0,
  "Ambiguous confirmation without a pending assistant offer must ask a follow-up and return no action.",
);
assert(
  ambiguousWithoutOfferReply.controlTrace?.planner === "clarification_guard" &&
    ambiguousWithoutOfferReply.controlTrace?.status === "clarification",
  "Ambiguous confirmation without a pending offer must expose a clarification control trace.",
);

const roofPlateDraftForWidthControl = await generateSectionDraft({
  reportState,
  sectionId: "roof-plate-thickness-measurements",
  userInstruction: "Seed measurement width-control audit.",
});
const roofPlateBlocks = buildReportBlockManifest(roofPlateDraftForWidthControl.draft.content, {
  sectionId: "roof-plate-thickness-measurements",
});
const roofMeasurementBlock = roofPlateBlocks.find((block) => block.blockType === "measurement_table");
assert(
  Boolean(roofMeasurementBlock),
  "Generated roof plate thickness output must expose a typed measurement_table report block for controlled editing.",
);
assert(
  roofMeasurementBlock?.capabilities.includes("resize_columns") &&
    roofMeasurementBlock?.sourcePolicy === "app_structured_data_locked",
  "Measurement table block must expose controlled presentation edits while locking app-sourced readings.",
);
const roofPlateDraftWithWideAColumn = roofPlateDraftForWidthControl.draft.content.replaceAll(
  'measurement-column-a" colwidth="72" style="width: 72px"',
  'measurement-column-a" colwidth="96" style="width: 96px"',
);
const roofPlateWidthReply = await generateSectionAssistantReply({
  reportState: buildReportState({
    sectionDrafts: [
      {
        sectionId: "roof-plate-thickness-measurements",
        content: roofPlateDraftWithWideAColumn,
        generated: true,
        edited: false,
        approved: false,
        reviewRequired: true,
      },
    ],
  }),
  sectionId: "roof-plate-thickness-measurements",
  userPrompt: "the column width for A, B, C, D, E should be the same as B-E",
});
const roofPlateWidthAction = roofPlateWidthReply.actions.find(
  (action) => action.type === "replace_section_content",
);
assert(
  roofPlateWidthReply.providerCode === "deterministic_table_formatter",
  "Measurement column-width request must be handled by the deterministic table formatter.",
);
assert(
  Boolean(roofPlateWidthAction),
  "Measurement column-width request must return a replacement table action.",
);
for (const label of ["a", "b", "c", "d", "e"]) {
  assert(
    roofPlateWidthAction?.contentHtml?.includes(`measurement-column-${label}" colwidth="72" style="width: 72px"`),
    `Measurement column-width action must set column ${label.toUpperCase()} to the reference width.`,
  );
}

for (const expectation of measurementExpectations) {
  const { draft, generationRun } = await generateSectionDraft({
    reportState,
    sectionId: expectation.sectionId,
    userInstruction: "Audit deterministic measurement compilation.",
  });

  assert(
    generationRun.usedLiveModel === false,
    `${expectation.sectionId} must not use live AI for app-sourced measurement compilation.`,
  );
  assert(
    generationRun.fallbackReason?.includes("App-sourced measurement sections"),
    `${expectation.sectionId} must report deterministic measurement-table routing.`,
  );
  assert(
    containsAll(draft.content, expectation.snippets),
    `${expectation.sectionId} is missing required exported measurement snippets.`,
  );
  assert(
    !draft.content.includes('data-laiq-provenance="llm_prediction"'),
    `${expectation.sectionId} is app-sourced measurement content and must not be marked as LLM prediction.`,
  );

  for (const forbidden of expectation.forbidden ?? []) {
    assert(
      !draft.content.includes(forbidden),
      `${expectation.sectionId} contains forbidden placeholder text: ${forbidden}`,
    );
  }
}

const roofNozzleTemplate = getSectionTemplate("roof-nozzle-reinforcement-pad-thickness-measurements");
assert(
  roofNozzleTemplate.requiredManualFields.length === 0,
  "Roof nozzle app-sourced measurement section must not require report-side source-data fields.",
);

const floorLayoutTemplate = getSectionTemplate("floor-plate-layout-platemaps-numbering-system");
assert(
  floorLayoutTemplate.requiredManualFields.includes("floor-plate-layout-platemaps-numbering-system-layout-source"),
  "Floor layout map section must keep layout-source review metadata and must not be treated as a UT table.",
);

const mapSections = API_STANDARD_REPORT_TOC.filter((section) => section.kind === "map");
for (const section of mapSections) {
  const { draft, generationRun } = await generateSectionDraft({
    reportState,
    sectionId: section.id,
    userInstruction: "Audit map section routing.",
  });
  const contentLower = draft.content.toLowerCase();

  assert(
    generationRun.usedLiveModel === false,
    `${section.id} map section must not use live AI for app-sourced layout geometry.`,
  );
  assert(
    generationRun.fallbackReason?.includes("App-sourced map sections"),
    `${section.id} map section must report deterministic layout-map routing.`,
  );
  assert(
    !draft.content.includes("report-measurement-table"),
    `${section.id} is a map section but generated a measurement table.`,
  );
  assert(
    contentLower.includes("layout") || contentLower.includes("map"),
    `${section.id} map section did not generate layout/map content.`,
  );

  const figure = buildLayoutFigureSvg(reportState, section);
  assert(
    Boolean(figure?.svg?.includes("<svg") && figure.svg.includes("</svg>")),
    `${section.id} did not render a DOCX-ready layout figure SVG.`,
  );
  assert(
    figure?.svg?.includes("drawing-block") && figure.svg.includes(API_STANDARD_PRIMARY_REPORT.reference),
    `${section.id} layout figure is missing the report drawing block metadata.`,
  );

  if (section.id === "shell-plate-layout") {
    assert(
      ["ST-O", "ST-T", "S7"].every((label) => figure.svg.includes(label)),
      "Shell Plate Layout DOCX figure is missing expected app element markers.",
    );
  }

  if (section.id === "roof-plate-layout") {
    assert(
      ["MH-1", "R1", "R9", "VT-1"].every((label) => figure.svg.includes(`>${label}<`)),
      "Roof Plate Layout DOCX figure is missing expected app element markers.",
    );
    assert(
      (figure.svg.match(/>R1</g) ?? []).length === 1,
      "Roof Plate Layout DOCX figure rendered duplicate R1 markers instead of merging element-linked finding evidence.",
    );
  }

  if (section.id === "floor-plate-layout-platemaps-numbering-system") {
    const encodedFigure = /<image href="data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)"/.exec(figure.svg)?.[1];
    const embeddedSvg = encodedFigure ? Buffer.from(encodedFigure, "base64").toString("utf8") : "";
    const appOwnedSvg = exportPackage.layoutFigures?.find((candidate) => candidate.targetKey === "floor")?.svg;
    assert(Boolean(encodedFigure), "Floor DOCX figure must embed the app-owned floor SVG artifact.");
    assert(embeddedSvg === appOwnedSvg, "Floor DOCX figure changed the SVG bytes exported by the app.");
    assert(
      ["floor_nozzle_s1", "floor_nozzle_s8"].every((elementId) => (
        embeddedSvg.includes(`data-element-id="${elementId}"`)
      )),
      "App-owned floor SVG is missing exported floor elements.",
    );
  }
}

const resolvedGeometryOnlyPackage = structuredClone(exportPackage);
const resolvedGeometryOnlyFloorConfig = resolvedGeometryOnlyPackage.layoutConfigs.find(
  (config) => config.targetKey === "floor",
);
resolvedGeometryOnlyFloorConfig.customCircularLayout.rows = [];
const resolvedGeometryOnlyState = buildReportState({ exportPackage: resolvedGeometryOnlyPackage });
const resolvedGeometryOnlyMap = getEffectiveLayoutMap(
  resolvedGeometryOnlyState,
  API_STANDARD_REPORT_TOC.find((section) => section.id === "floor-plate-corrosion-plan"),
);
const resolvedGeometryOnlyFigure = buildLayoutFigureSvg(
  resolvedGeometryOnlyState,
  API_STANDARD_REPORT_TOC.find((section) => section.id === "floor-plate-corrosion-plan"),
);
assert(
  !resolvedGeometryOnlyFigure?.svg?.includes("NaN"),
  "Floor layout SVG must render imported app element/finding coordinates as finite values.",
);
assert(
  ["1", "17a", "17b", "23", "A1", "A10"].every((label) => (
    resolvedGeometryOnlyMap?.plates.some((plate) => (plate.mapLabel ?? plate.label) === label)
  )),
  "Floor renderer must consume V3 app-resolved geometry without rebuilding plate rows in report-platform.",
);

const incompleteV3GeometryPackage = structuredClone(exportPackage);
const incompleteFloorConfig = incompleteV3GeometryPackage.layoutConfigs.find(
  (config) => config.targetKey === "floor",
);
delete incompleteFloorConfig.customCircularLayout.resolvedMainPlateGeometry;
delete incompleteFloorConfig.customCircularLayout.resolvedAnnularPlateGeometry;
const incompleteFloorMap = getEffectiveLayoutMap(
  buildReportState({ exportPackage: incompleteV3GeometryPackage }),
  floorLayoutSection,
);
assert(
  incompleteFloorMap?.plates.length === 0,
  "A V3 floor layout missing resolved app geometry must fail closed instead of being reconstructed on the web.",
);

const floorCorrosionSection = API_STANDARD_REPORT_TOC.find(
  (section) => section.id === "floor-plate-corrosion-plan",
);
const appFloorCorrosionBaseline = getEffectiveLayoutMap(reportState, floorCorrosionSection);
const lockedFloorCorrosionMap = getEffectiveLayoutMap(
  {
    ...reportState,
    layoutOverrides: [{
      sectionId: "floor-plate-corrosion-plan",
      layoutMap: {
        ...appFloorCorrosionBaseline,
        geometrySource: "source_drawing_import",
        sourceDrawing: {
          width: 540,
          height: 540,
          renderMode: "extracted_vector",
        },
        plates: [{
          id: "replacement-plate",
          label: "Replacement",
          row: 1,
          column: 1,
          x: 0.1,
          y: 0.1,
          width: 0.8,
          height: 0.8,
          source: "source-drawing:test",
        }],
        markers: [],
        floorCorrosion: {
          schemaVersion: 1,
          artifactRunId: "00000000-0000-4000-8000-000000000099",
          sourceLayoutName: "legacy source drawing",
          sourceMflDocumentName: "MFL.pdf",
          generatedAtIso: "2026-01-01T00:00:00.000Z",
          overlays: [],
          unmatchedScanPlateIds: [],
          platesWithoutScans: [],
          validationIssues: [],
        },
      },
    }],
  },
  floorCorrosionSection,
);
assert(
  JSON.stringify(lockedFloorCorrosionMap?.plates.map((plate) => plate.id)) ===
    JSON.stringify(appFloorCorrosionBaseline?.plates.map((plate) => plate.id)),
  "MFL/source-drawing overrides must not replace V3 app-owned floor geometry.",
);
assert(
  !lockedFloorCorrosionMap?.sourceDrawing && lockedFloorCorrosionMap?.floorCorrosion,
  "V3 floor rendering must preserve corrosion data while discarding replacement source geometry.",
);
const lockedFloorFigure = buildLayoutFigureSvg(
  { ...reportState, layoutOverrides: [{ sectionId: "floor-plate-corrosion-plan", layoutMap: lockedFloorCorrosionMap }] },
  floorCorrosionSection,
);
assert(
  lockedFloorFigure?.svg.includes("data:image/svg+xml;base64,") &&
    lockedFloorFigure.svg.includes("floor-corrosion-legend"),
  "Floor corrosion rendering must retain the app-owned SVG base after MFL composition.",
);

const staleRoofOverrideFigure = buildLayoutFigureSvg(
  buildReportState({
    layoutOverrides: [
      {
        sectionId: "roof-plate-layout",
        layoutMap: {
          id: "roof-plate-layout",
          title: "Roof Plate Layout",
          subtitle: "stale override without markers",
          surfaceLabel: "Roof plate layout",
          markers: [],
          plates: [],
          gridRows: 13,
          gridColumns: 7,
          drawingBlock: {},
          appMap: { surfaceType: "roof" },
          overrideCount: 1,
        },
      },
    ],
  }),
  API_STANDARD_REPORT_TOC.find((section) => section.id === "roof-plate-layout"),
);
assert(
  ["MH-1", "R1", "R9", "VT-1"].every((label) => staleRoofOverrideFigure?.svg?.includes(`>${label}<`)),
  "Stale roof layout override removed app-sourced element markers from DOCX figure.",
);

const staleRoofNozzleState = buildReportState({
  sectionDrafts: [
    {
      sectionId: "roof-nozzle-reinforcement-pad-thickness-measurements",
      content: "R6 Pending confirmation",
      generated: true,
      edited: false,
      approved: false,
      reviewRequired: true,
    },
  ],
});

const staleReply = await generateSectionAssistantReply({
  reportState: staleRoofNozzleState,
  sectionId: "roof-nozzle-reinforcement-pad-thickness-measurements",
  userPrompt: "why we have r6 measurements from the layout map, generated contents indicating pending?",
});
assert(
  staleReply.providerCode === "deterministic_measurement_evidence_guard",
  "R6 pending/evidence question must be answered by the deterministic measurement evidence guard.",
);
assert(
  staleReply.content.includes("R6") && staleReply.content.includes("6.43") && staleReply.content.includes("6.07"),
  "R6 measurement evidence reply must include exported R6 values.",
);
assert(
  staleReply.actions.some((action) => action.type === "replace_section_content"),
  "Stale pending measurement draft should receive a replacement-table action.",
);

const logicReply = await generateSectionAssistantReply({
  reportState,
  sectionId: "roof-nozzle-reinforcement-pad-thickness-measurements",
  userPrompt: "the logic I do not understand, you mean the data source do not have the measurements however, the layout map has?",
});
assert(
  !logicReply.content.includes("does not have a layout map"),
  "Measurement section layout/data explanation must not claim the section has no layout map.",
);
assert(
  logicReply.content.includes("numeric values come from exported UT rows"),
  "Measurement section layout/data explanation must separate location evidence from UT row values.",
);

if (failures.length > 0) {
  console.error("Report generation logic audit failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Report generation logic audit passed.");
console.log(`Checked ${measurementExpectations.length} app-sourced measurement sections.`);
console.log(`Checked ${mapSections.length} map sections.`);
console.log("Checked measurement evidence chat guards.");

function provenanceTextSegments(html, provenance) {
  return rawProvenanceSegments(html, provenance).map((segment) => segment.replace(/<[^>]+>/g, ""));
}

function rawProvenanceSegments(html, provenance) {
  const segments = [];
  const provenanceRegex = new RegExp(
    `<section\\b[^>]*data-laiq-provenance="${provenance}"[^>]*>([\\s\\S]*?)<\\/section>`,
    "gi",
  );
  let match;

  while ((match = provenanceRegex.exec(html)) != null) {
    segments.push(match[1]);
  }

  return segments;
}

function inlineProvenanceTextSegments(html, provenance) {
  const segments = [];
  const provenanceRegex = new RegExp(
    `<(?:span|mark)\\b[^>]*data-laiq-provenance="${provenance}"[^>]*>([\\s\\S]*?)<\\/(?:span|mark)>`,
    "gi",
  );
  let match;

  while ((match = provenanceRegex.exec(html)) != null) {
    segments.push(match[1].replace(/<[^>]+>/g, ""));
  }

  return segments;
}

function allProvenanceTextSegments(html, provenance) {
  return [
    ...provenanceTextSegments(html, provenance),
    ...inlineProvenanceTextSegments(html, provenance),
  ];
}

function assertNoCoreAppFactsInTemplateBlocks(html, sectionId) {
  const coreFacts = [
    exportPackage.task.client,
    exportPackage.inspectionRecord.client,
    `Tank ${exportPackage.task.tankNumber}`,
    `Tank Number: ${exportPackage.task.tankNumber}`,
    exportPackage.task.tankNumber,
    exportPackage.inspectionReference,
    exportPackage.inspectionRecord.location,
    exportPackage.inspectionRecord.fieldLeaseName,
    exportPackage.inspectionRecord.inspector,
  ].filter(Boolean);

  for (const segment of rawProvenanceSegments(html, "precedent_template")) {
    const segmentWithoutInlineAppFacts = stripInlineProvenance(segment, "app_field_data").replace(/<[^>]+>/g, "");
    const matchedFact = coreFacts.find((fact) => segmentWithoutInlineAppFacts.includes(fact));
    assert(!matchedFact, `${sectionId} classified app fact "${matchedFact}" as precedent/template text.`);
  }
}

function stripInlineProvenance(value, provenance) {
  return String(value ?? "").replace(
    new RegExp(
      `<(?:span|mark)\\b[^>]*data-laiq-provenance="${provenance}"[^>]*>[\\s\\S]*?<\\/(?:span|mark)>`,
      "gi",
    ),
    "",
  );
}
