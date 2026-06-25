import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildPrecedentAudit } from "../precedent-kb.mjs";
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

const audit = buildPrecedentAudit({ reportState, allowBuild: false });
const blockedSourceNames = new Set(
  audit.sections.flatMap((section) => section.blockedSourceNames ?? []),
);
const blockedTopSources = audit.sections.flatMap((section) =>
  section.topSources
    .filter((source) => [...blockedSourceNames].some((blockedSourceName) =>
      source.sourceReportName.toLowerCase().includes(blockedSourceName),
    ))
    .map((source) => `${section.sectionId}: ${source.sourceReportName}`),
);

console.log(`Precedent KB audit: ${audit.createdAtIso}`);

for (const section of audit.sections) {
  console.log(`\n${section.sectionId}`);
  for (const [index, source] of section.topSources.entries()) {
    console.log(
      `${index + 1}. ${source.sourceReportName} | page ${source.pageStart} | ${source.sectionKey} | ${source.chunkType} | score ${source.score}`,
    );
  }
  if (section.formatPatterns.length > 0) {
    console.log(`format: ${section.formatPatterns.join(", ")}`);
  }
  if (section.layoutPatterns.length > 0) {
    console.log(`layout: ${section.layoutPatterns.join(", ")}`);
  }
  for (const warning of section.warnings) {
    console.log(`warning: ${warning}`);
  }
}

if (blockedTopSources.length > 0) {
  console.error("\nBlocked same-report/gold sources appeared in wording precedent results:");
  for (const source of blockedTopSources.slice(0, 12)) {
    console.error(`- ${source}`);
  }
  process.exit(1);
}

process.exit(0);
