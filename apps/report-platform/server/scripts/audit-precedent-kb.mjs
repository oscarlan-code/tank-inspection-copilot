import { buildPrecedentAudit } from "../precedent-kb.mjs";

const audit = buildPrecedentAudit({ allowBuild: false });

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

process.exit(0);
