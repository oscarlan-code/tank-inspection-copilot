import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { buildFinalReportDocx } from "../docx-export.mjs";
import { parseSectionDocument, renderSectionDocumentHtml, validateSectionDocument } from "../report-document.mjs";

// These are the ZIP/XML dependencies shipped with the existing DOCX exporter.
const require = createRequire(import.meta.url);
const docxRequire = createRequire(require.resolve("docx"));
const JSZip = docxRequire("jszip");
const { xml2js } = docxRequire("xml-js");
const exportPackage = JSON.parse(readFileSync(new URL("../../src/fixtures/v3-product-export-shell-internal.json", import.meta.url), "utf8"));
const html = `<section><h3>Inspection Report</h3>
<h2>Shell findings</h2><p>Recorded <strong>6.04 mm</strong>; <em>reviewed condition</em> and <u>confirmed</u>.</p>
<h3>Internal coating</h3><h4>Local detail</h4>
<ul><li>First <strong>finding</strong><ul><li>Nested <em>detail</em></li></ul></li></ul>
<ol><li>Review result</li><li>Approve wording</li></ol>
<table><thead><tr><th colspan="2">Recorded measurements</th></tr></thead><tbody>
<tr><th rowspan="2">Plate P1</th><td><strong>6.00 mm</strong><br>3″ clearance</td></tr>
<tr><td>6.14 mm</td></tr></tbody></table></section>`;
const state = {
  reportJob: { reportJobId: "docx-audit", reportReference: "QA-17", title: "Report document audit", inspectedDate: "2026-09-17" },
  exportPackage,
  sectionDrafts: [
    { sectionId: "inspection-report", approved: true, generated: true, content: html, sectionPlanSnapshotId: "snapshot-current" },
    { sectionId: "repair-recommendations", approved: false, content: "UNAPPROVED CONTENT MUST NOT EXPORT" },
    { sectionId: "scope-of-inspection", approved: true, content: "UNSELECTED CONTENT MUST NOT EXPORT" },
  ],
  sectionPlanning: { snapshotId: "snapshot-current", sectionPlans: [{ sectionId: "inspection-report", planId: "plan-inspection", status: "ready" }] },
};
const parsed = parseSectionDocument({ sectionId: "inspection-report", html });
assert.equal(validateSectionDocument(parsed).valid, true);
const rendered = renderSectionDocumentHtml(parsed);
for (const required of ["<h2>Shell findings</h2>", "<h4>Local detail</h4>", "<strong>6.00 mm</strong>", 'colspan="2"', 'rowspan="2"', "3″ clearance"]) assert(rendered.includes(required));
assert.equal(validateSectionDocument(parseSectionDocument({ sectionId: "inspection-report", html: "<h3>Inspection Report</h3><table></table>" })).valid, false);

const result = await buildFinalReportDocx(state, { sectionIds: ["inspection-report"] });
assert.equal(result.approvalSummary.exportedCount, 1);
const zip = await JSZip.loadAsync(result.buffer);
const documentXml = await zip.file("word/document.xml").async("string");
const numberingXml = await zip.file("word/numbering.xml").async("string");
const document = xml2js(documentXml);
const paragraphs = descendants(document, "w:p");
for (const [text, level] of [["Shell findings", 2], ["Internal coating", 3], ["Local detail", 4]]) {
  const paragraph = paragraphs.find((node) => textContent(node) === text);
  assert(paragraph, `Missing heading ${text}.`);
  assert(descendants(paragraph, "w:pStyle").some((node) => node.attributes?.["w:val"] === `Heading${level}`), `Heading hierarchy lost for ${text}.`);
}
const duplicateHeadings = paragraphs.filter((node) => textContent(node) === "Inspection Report" && descendants(node, "w:pStyle").some((style) => /^Heading/.test(style.attributes?.["w:val"] ?? "")));
assert.equal(duplicateHeadings.length, 0, "The generated section heading must not duplicate the outer report heading.");
for (const [text, tag] of [["6.04 mm", "w:b"], ["reviewed condition", "w:i"], ["confirmed", "w:u"]]) {
  const run = descendants(document, "w:r").find((node) => textContent(node) === text);
  assert(run && descendants(run, tag).some((node) => node.attributes?.["w:val"] !== "false"), `Inline formatting lost: ${text}.`);
}
const nested = paragraphs.find((node) => textContent(node) === "Nested detail");
assert(nested && descendants(nested, "w:ilvl").some((node) => node.attributes?.["w:val"] === "1"), "Nested list depth must remain explicit.");
assert(numberingXml.includes('w:val="decimal"') && numberingXml.includes('w:val="bullet"'), "Ordered and unordered lists must retain separate numbering definitions.");
assert(descendants(document, "w:gridSpan").some((node) => node.attributes?.["w:val"] === "2"), "Merged columns lost.");
assert(descendants(document, "w:vMerge").some((node) => node.attributes?.["w:val"] === "restart"), "Merged rows lost.");
for (const text of ["6.00 mm", "6.14 mm", "3″ clearance"]) assert(documentXml.includes(text), `Exact source value/unit not preserved: ${text}.`);
assert(!documentXml.includes("UNAPPROVED CONTENT MUST NOT EXPORT"));
assert(!documentXml.includes("UNSELECTED CONTENT MUST NOT EXPORT"));

await assert.rejects(buildFinalReportDocx(state, { sectionIds: ["repair-recommendations"] }), /approved section/);
const stale = structuredClone(state);
stale.sectionPlanning.snapshotId = "snapshot-new";
await assert.rejects(buildFinalReportDocx(stale, { sectionIds: ["inspection-report"] }), /stale section plan/);
const unresolved = structuredClone(state);
unresolved.sectionPlanning.sectionPlans[0].status = "needs_review";
await assert.rejects(buildFinalReportDocx(unresolved, { sectionIds: ["inspection-report"] }), /unresolved section-plan requirements/);
const empty = structuredClone(state);
empty.sectionDrafts[0].content = "<h3>Inspection Report</h3><table></table>";
await assert.rejects(buildFinalReportDocx(empty, { sectionIds: ["inspection-report"] }), /not export-ready/);
const legacy = structuredClone(state);
delete legacy.sectionDrafts[0].sectionPlanSnapshotId;
delete legacy.sectionPlanning;
assert((await buildFinalReportDocx(legacy, { sectionIds: ["inspection-report"] })).buffer.length > 1000, "Legacy approved drafts remain exportable without inventing a planning binding.");
const mapState = structuredClone(legacy);
mapState.sectionDrafts.push({ sectionId: "shell-plate-layout", approved: true, content: "<p>Native shell layout.</p>" });
const mapExport = await buildFinalReportDocx(mapState, { sectionIds: ["shell-plate-layout"] });
const mapZip = await JSZip.loadAsync(mapExport.buffer);
assert(Object.keys(mapZip.files).some((name) => /^word\/media\/.+\.(svg|png)$/.test(name)), "Native layout compilation must continue to embed the actual figure.");
const plain = structuredClone(legacy);
plain.sectionDrafts[0].content = "First legacy paragraph.\nSecond legacy paragraph.";
const plainZip = await JSZip.loadAsync((await buildFinalReportDocx(plain, { sectionIds: ["inspection-report"] })).buffer);
const plainDoc = xml2js(await plainZip.file("word/document.xml").async("string"));
assert(descendants(plainDoc, "w:p").some((node) => textContent(node) === "First legacy paragraph."));
assert(descendants(plainDoc, "w:p").some((node) => textContent(node) === "Second legacy paragraph."));

console.log("ReportDocument/DOCX audit passed: semantic headings, inline emphasis, nested lists, exact value/unit cells, row/column spans, selected approval, stale plan rejection, and legacy compatibility.");

function descendants(node, name) {
  return (node.elements ?? []).flatMap((child) => [...(child.name === name ? [child] : []), ...descendants(child, name)]);
}
function textContent(node) {
  return (node.elements ?? []).map((child) => child.type === "text" ? child.text : textContent(child)).join("");
}
