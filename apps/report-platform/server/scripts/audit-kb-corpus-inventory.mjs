import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { buildKbCorpusInventory } from "../kb-corpus-inventory.mjs";

const root = mkdtempSync(join(tmpdir(), "laiq-kb-corpus-inventory-"));
const reports = join(root, "Sample Reports");
const codes = join(root, "Codes");

try {
  mkdirSync(join(reports, "Client A", "Report No"), { recursive: true });
  mkdirSync(join(reports, "Client A", "Project", "Admin"), { recursive: true });
  mkdirSync(join(reports, "Client A", "Project", "MFL Data"), { recursive: true });
  mkdirSync(codes, { recursive: true });
  const reportName = "22AA1-1 TK 1 Internal & External Inspection Report.pdf";
  writeFileSync(join(reports, "Client A", reportName), "final-report");
  writeFileSync(join(reports, "Client A", "Report No", reportName), "final-report");
  writeFileSync(join(reports, "Client A", "Project", "22AA1-1 Preliminary Report.pdf"), "draft");
  writeFileSync(join(reports, "Client A", "Project", "~$22AA1-1 Internal & External Inspection Report.docx"), "lock");
  writeFileSync(join(reports, "Client A", "Project", "Admin", "Completion Certificate.pdf"), "certificate");
  writeFileSync(join(reports, "Client A", "Project", "MFL Data", "TK 1 MFL Platemaps.pdf"), "mfl");
  writeFileSync(join(reports, "Client A", "Project", "22AA1-1 Construction Drawing.pdf"), "drawing");
  writeFileSync(join(codes, "API 653 Test Edition.pdf"), "standard");

  const inventory = buildKbCorpusInventory({
    sampleReportsDir: reports,
    standardsCodesDir: codes,
    now: () => "2026-08-05T00:00:00.000Z",
  });
  assert(inventory.summary.totalAssets === 8, "Recursive inventory must include all supported nested assets.");
  assert(inventory.summary.finalReportCandidateCount === 2, "Final report candidates must be detected without auto-approval.");
  assert(inventory.summary.duplicateCandidateGroupCount === 1, "Mirrored report renditions must be flagged as duplicate candidates.");
  assert(inventory.summary.administrativeExcludedCount === 1, "Administrative files must be excluded by default.");
  assert(inventory.summary.standardsCandidateCount === 1, "Standards must use a separate review lane.");
  assert(inventory.assets.every((asset) => asset.approvalStatus === "pending_review" && asset.retrievalEligible === false), "Inventory must never auto-publish sources.");
  assert(inventory.assets.some((asset) => asset.ingestionDisposition === "supporting_evidence_only"), "MFL material must use the specialist evidence lane.");
  assert(inventory.assets.some((asset) => asset.ingestionDisposition === "quarantine_preliminary"), "Preliminary reports must remain quarantined.");
  assert(inventory.assets.some((asset) => asset.ingestionDisposition === "exclude_temporary"), "Temporary Office artifacts must be excluded.");
  assert(
    inventory.assets.find((asset) => asset.fileName.includes("Construction Drawing"))?.sourceRole !== "final_report_candidate",
    "Project-folder context must not promote a drawing into final-report precedent.",
  );

  console.log("KB corpus inventory audit passed.");
  console.log("- Recursive discovery, classification, duplicate candidates, and approval boundaries are deterministic.");
} finally {
  rmSync(root, { recursive: true, force: true });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
