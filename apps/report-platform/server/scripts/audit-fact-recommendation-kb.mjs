import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildFactRecommendationAudit,
  searchFactRecommendationPairs,
} from "../fact-recommendation-kb.mjs";
import { classifyReportPackage } from "../report-classification.mjs";
import { API_STANDARD_PRIMARY_REPORT } from "../report-toc.mjs";

const reportPlatformRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturePath = join(reportPlatformRoot, "src", "fixtures", "v3-product-export-shell-internal.json");
const exportPackage = JSON.parse(readFileSync(fixturePath, "utf8"));
const reportState = {
  exportPackage,
  manualSupplement: {
    reportReference: API_STANDARD_PRIMARY_REPORT.reference,
    inspectedDate: API_STANDARD_PRIMARY_REPORT.inspectedDate,
  },
  sectionDrafts: [],
  layoutOverrides: [],
  reportClassification: classifyReportPackage(exportPackage),
};

const audit = buildFactRecommendationAudit({
  reportState,
  sectionIds: [
    "repair-recommendations",
    "inspection-report",
    "shell-internal-recommended-repairs",
  ],
});
const repairPack = searchFactRecommendationPairs({
  reportState,
  sectionId: "repair-recommendations",
  allowBuild: false,
  limit: 24,
});
const failures = [];

if (audit.pairCount < 40) {
  failures.push(`Expected at least 40 structured fact/recommendation pairs, found ${audit.pairCount}.`);
}

if (repairPack.pairs.length < 8) {
  failures.push(`Expected at least 8 matching repair recommendation pairs, found ${repairPack.pairs.length}.`);
}

if (repairPack.pairs.some((pair) => pair.sourceReportName.includes("22PE1-4 TK V10 Internal & External Inspection Report"))) {
  failures.push("Gold/mock report appeared in fact-to-recommendation retrieval results.");
}

const requiredTags = ["repair", "clean_prepare_recoat", "install"];
for (const requiredTag of requiredTags) {
  if (!repairPack.pairs.some((pair) => pair.actionTags.includes(requiredTag))) {
    failures.push(`Missing repair retrieval action tag: ${requiredTag}.`);
  }
}

console.log(`Fact-to-recommendation KB audit: ${audit.createdAtIso}`);
console.log(`Pairs: ${audit.pairCount}`);
console.log(`Source chunks: ${audit.sourceChunkCount}`);
console.log("Top action tags:", JSON.stringify(audit.actionTagCounts, null, 2));
console.log("Top component tags:", JSON.stringify(audit.componentTagCounts, null, 2));

for (const section of audit.sections) {
  console.log(`\n${section.sectionId}`);
  console.log(`matches: ${section.totalMatchCount}, excluded: ${section.excludedPairCount}`);
  for (const [index, pair] of section.topPairs.entries()) {
    console.log(
      `${index + 1}. ${pair.sourceReportName} p.${pair.pageStart} | ${pair.actionTags.join(",")} | ${pair.componentTags.join(",")} | ${pair.recommendationPattern.slice(0, 140)}`,
    );
  }
  for (const warning of section.warnings) {
    console.log(`warning: ${warning}`);
  }
}

if (failures.length > 0) {
  console.error("\nFact-to-recommendation KB audit failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("\nFact-to-recommendation KB audit passed.");
