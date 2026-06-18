import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Keep this audit deterministic. It validates orchestration/routing rules, not model quality.
process.env.PATH = "";

const reportPlatformRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturePath = join(reportPlatformRoot, "src", "fixtures", "v2-product-export-shell-internal.json");
const exportPackage = JSON.parse(readFileSync(fixturePath, "utf8"));

const [
  generation,
  layoutMapFigure,
  reportToc,
  reportClassification,
] = await Promise.all([
  import("../generation.mjs"),
  import("../layout-map-figure.mjs"),
  import("../report-toc.mjs"),
  import("../report-classification.mjs"),
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
const { buildLayoutFigureSvg } = layoutMapFigure;
const { classifyReportPackage } = reportClassification;

const failures = [];

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
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

const r6 = exportPackage.utMeasurements.find(
  (measurement) => measurement.itemKey === "external_roof:element:external_roof_nozzle_r6",
);
assert(Boolean(r6), "Fixture must include roof nozzle R6 UT measurement row.");
assert(r6?.value1 === 6.43 && r6?.reinforcementPadReading === 6.07, "Fixture R6 values changed unexpectedly.");

const measurementExpectations = [
  {
    sectionId: "roof-plate-thickness-measurements",
    snippets: ["report-measurement-table", "Plate No.", "Android V2 Product export"],
  },
  {
    sectionId: "roof-nozzle-reinforcement-pad-thickness-measurements",
    snippets: ["report-measurement-table", "R6", "6 in", "6.43", "6.62", "6.72", "6.55", "6.07"],
    forbidden: ["Pending confirmation"],
  },
  {
    sectionId: "shell-plate-thickness-measurements",
    snippets: ["report-measurement-table", "Location", "Android V2 Product export"],
  },
  {
    sectionId: "shell-nozzle-reinforcement-pad-thickness-measurements",
    snippets: ["report-measurement-table", "S6", "24 in", "13.89", "13.92", "13.24", "13.96", "13.85"],
  },
];

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
      ["PF-1", "ST-T", "S7"].every((label) => figure.svg.includes(label)),
      "Shell Plate Layout DOCX figure is missing expected app element markers.",
    );
  }
}

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
