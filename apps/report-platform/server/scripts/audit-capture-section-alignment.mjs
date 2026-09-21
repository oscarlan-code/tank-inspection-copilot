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
  ["history", REPORT_METADATA_SECTION_ID],
  ["general", "general-tank-information"],
  ["inspection", "inspection-report"],
  ["calculation", REPORT_METADATA_SECTION_ID],
  ["recommendation", "repair-recommendations"],
  ["guidelines", "guidelines-interpretation-tru-flux-data-sheets"],
  ["limitations", REPORT_METADATA_SECTION_ID],
  ["corrosion", "floor-plate-corrosion-plan"],
  ["checklist", "tank-inspection-checklist"],
  ["legend", REPORT_METADATA_SECTION_ID],
]);
const failures = facts.filter((fact) => resolve(fact).sectionId !== expected.get(fact.fact_id));
if (failures.length) throw new Error(`Capture section alignment failed: ${JSON.stringify(failures.map((fact) => ({ factId: fact.fact_id, actual: resolve(fact), expected: expected.get(fact.fact_id) })))}`);
const unknown = { fact_id: "far-away", source_page_number: 80, section_key: "unknown-calculation" };
if (resolve(unknown).aligned || resolve(unknown).sectionId !== REPORT_METADATA_SECTION_ID) throw new Error("An unbounded preceding heading must not certify section alignment.");
const reviewed = { ...unknown, sourceSectionBoundary: { sectionId: "inspection-report", startPage: 79, endPage: 81, reviewStatus: "approved", sourceRevisionId: "reviewed-source-v2" } };
if (!resolve(reviewed).aligned || resolve(reviewed).sectionId !== "inspection-report") throw new Error("Reviewed bounded parent section was not retained.");
if (resolve({ ...reviewed, source_page_number: 82 }).aligned) throw new Error("A reviewed parent boundary must not apply outside its page range.");
if (resolve({ ...reviewed, sourceSectionBoundary: { ...reviewed.sourceSectionBoundary, reviewStatus: "machine_proposed" } }).aligned) throw new Error("An unreviewed boundary must not certify alignment.");
console.log("Capture section alignment audit passed: explicit sections and reviewed boundaries only; proximity remains unresolved.");
