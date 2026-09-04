import { buildReportSpecificSectionResolver, REPORT_METADATA_SECTION_ID } from "../capture-section-mapping.mjs";

const facts = [
  { fact_id: "cover", source_page_number: 1, section_key: "unclassified" },
  { fact_id: "scope", source_page_number: 4, section_key: "scope-of-inspection" },
  { fact_id: "regime", source_page_number: 5, section_key: "inspection-maintenance-regime" },
  { fact_id: "history", source_page_number: 6, section_key: "previous-inspection-history" },
  { fact_id: "general", source_page_number: 6, section_key: "general-tank-information" },
  { fact_id: "inspection", source_page_number: 7, section_key: "inspection-report" },
  { fact_id: "calculation", source_page_number: 9, section_key: "calculated-corrosion-rate" },
  { fact_id: "recommendation", source_page_number: 10, section_key: "repair-recommendations" },
  { fact_id: "guidelines", source_page_number: 26, section_key: "13-guidelines-for-the-interpretation-of-the-tru-flux-data-sheets" },
  { fact_id: "limitations", source_page_number: 26, section_key: "limitations" },
  { fact_id: "corrosion", source_page_number: 27, section_key: "14-floor-plate-corrosion-plan" },
  { fact_id: "checklist", source_page_number: 13, section_key: "tank-inspection-checklist" },
  { fact_id: "legend", source_page_number: 14, section_key: "legend" },
];
const resolve = buildReportSpecificSectionResolver(facts);
const expected = new Map([
  ["cover", REPORT_METADATA_SECTION_ID],
  ["scope", "scope-of-inspection"],
  ["regime", "inspection-maintenance-regime"],
  ["history", "general-tank-information"],
  ["general", "general-tank-information"],
  ["inspection", "inspection-report"],
  ["calculation", "inspection-report"],
  ["recommendation", "repair-recommendations"],
  ["guidelines", "guidelines-interpretation-tru-flux-data-sheets"],
  ["limitations", "guidelines-interpretation-tru-flux-data-sheets"],
  ["corrosion", "floor-plate-corrosion-plan"],
  ["checklist", "tank-inspection-checklist"],
  ["legend", "tank-inspection-checklist"],
]);
const failures = facts.filter((fact) => resolve(fact).sectionId !== expected.get(fact.fact_id));
if (failures.length) throw new Error(`Capture section alignment failed: ${JSON.stringify(failures.map((fact) => ({ factId: fact.fact_id, actual: resolve(fact), expected: expected.get(fact.fact_id) })))}`);
console.log("Capture section alignment audit passed: facts follow the tested report's own section anchors.");
