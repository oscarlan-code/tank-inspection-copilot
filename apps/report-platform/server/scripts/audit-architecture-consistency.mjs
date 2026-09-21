import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const failures = [];

const rootDocuments = [
  "AGENTS.md",
  "DOCUMENTATION_INDEX.md",
  "EVAL_SYSTEM.md",
  "PRODUCT_TERMINOLOGY.md",
  "README.md",
  "REPORT_COMPILER_WORKFLOW.md",
  "SECTION_AGENT_RELEASES.md",
  "SYSTEM_ARCHITECTURE.md",
];

const supportingDocuments = [
  "docs/contracts/README.md",
  "docs/contracts/knowledge/KNOWLEDGE_PACKS.md",
  "docs/contracts/knowledge/KB_CORPUS_INGESTION_ARCHITECTURE.md",
  "docs/contracts/platform/ANDROID_V3_OBJECT_UPLOAD_HANDOFF.md",
  "docs/contracts/platform/AUTHENTICATION_AND_TENANCY.md",
  "docs/contracts/platform/BACKEND_STORAGE_ARCHITECTURE.md",
  "docs/contracts/platform/MAC_MINI_STAGING.md",
  "docs/contracts/platform/PRODUCT_CLOUD_ARCHITECTURE.md",
  "docs/contracts/platform/PRODUCT_STORAGE_MIGRATION_PLAN.md",
  "docs/contracts/reporting/GENERATED_CONTENT_CONTROL_SYSTEM.md",
  "docs/contracts/reporting/REPORT_SECTION_FORMAT_CONTRACT.md",
  "docs/contracts/reporting/LAYOUT_AND_EXPORT.md",
  "docs/contracts/reporting/FLOOR_CORROSION_MAP_PIPELINE.md",
  "docs/contracts/evaluation/TRAINING_HARNESS_ARCHITECTURE.md",
  "docs/contracts/evaluation/RL_RETRIEVAL_OPTIMIZATION_ARCHITECTURE.md",
];

const archivedDocuments = [
  "docs/archive/README.md",
  "docs/archive/architecture/FULL_SYSTEM_DIAGRAM.md",
  "docs/archive/architecture/REPORT_GENERATION_TOPOLOGY.md",
  "docs/archive/architecture/AI_ENGINE_SYSTEM_DIAGRAM.md",
  "docs/archive/architecture/AI_QUALITY_AND_LAYOUTMAP.md",
  "docs/archive/architecture/CODEX_ROLES_AND_TOOLING.md",
  "docs/archive/architecture/IMPLEMENTATION_PLAN.md",
  "docs/archive/architecture/PRODUCT_DEVELOPMENT_PLAN.md",
  "docs/archive/report-generation/AGENTIC_SYSTEM_DESIGN.md",
  "docs/archive/report-generation/PRECEDENT_KB_ARCHITECTURE.md",
  "docs/archive/report-generation/FACT_RECOMMENDATION_KB.md",
  "docs/archive/report-generation/REPORT_GENERATION_AND_LAYOUTMAP_ORCHESTRATION.md",
  "docs/archive/research/SAMPLE_REPORT_FORMATTING_REVIEW.md",
];

const read = (path) => {
  try {
    return readFileSync(join(appRoot, path), "utf8");
  } catch {
    failures.push(`Missing documentation file: ${path}`);
    return "";
  }
};

for (const path of [...rootDocuments, ...supportingDocuments, ...archivedDocuments]) read(path);

const actualRootDocuments = readdirSync(appRoot)
  .filter((name) => name.endsWith(".md"))
  .sort();
if (JSON.stringify(actualRootDocuments) !== JSON.stringify([...rootDocuments].sort())) {
  failures.push(`Root Markdown set must remain lean: ${actualRootDocuments.join(", ")}`);
}

const requiredText = {
  "SYSTEM_ARCHITECTURE.md": [
    "The new report compiler is a clean rebuild.",
    "Report Structure Agent",
    "legacy-generator fallback is allowed.",
    "Only General Tank Information v1 has been implemented and evaluated.",
    "PostgreSQL is the only transactional database.",
  ],
  "REPORT_COMPILER_WORKFLOW.md": [
    "sole active generation-pipeline contract",
    "ReportBlueprintPack",
    "StandardObligationPack",
    "Three validation gates",
    "There is no branch or fallback",
  ],
  "SECTION_AGENT_RELEASES.md": [
    "Only **General Tank",
    "historical-report alignment",
    "technical-standard alignment",
    "same frozen bytes",
    "Finishing one agent does not authorize",
  ],
  "EVAL_SYSTEM.md": [
    "Independent dimensions",
    "Product and evaluation execute identical pinned",
    "cannot promote anything",
  ],
  "DOCUMENTATION_INDEX.md": [
    "Active root contracts",
    "docs/contracts/",
    "docs/archive/",
    "API 653 does not mandate",
  ],
  "docs/contracts/knowledge/KNOWLEDGE_PACKS.md": [
    "Separate authorities",
    "Historical packs and standard packs remain separate",
    "Conflict order",
  ],
};

for (const [path, phrases] of Object.entries(requiredText)) {
  const content = read(path);
  for (const phrase of phrases) {
    if (!content.includes(phrase)) failures.push(`${path} is missing required text: ${phrase}`);
  }
}

for (const path of rootDocuments) {
  const content = read(path);
  for (const [pattern, reason] of [
    [/Android V2 Product|\bV2 Product\b/i, "current docs must use the V3 app contract"],
    [/apps\/report-platform is still docs-only/i, "report-platform is a running application"],
    [/Postgres becomes the transactional product database/i, "PostgreSQL is already the database"],
  ]) {
    if (pattern.test(content)) failures.push(`${path}: ${reason}`);
  }
}

if (failures.length) {
  console.error("Architecture consistency audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Architecture consistency audit passed.");
console.log(`- Root documentation is limited to ${rootDocuments.length} active files.`);
console.log("- Supporting contracts and archived records are separated.");
console.log("- Report Structure Agent, immutable section releases, dual knowledge authorities, and no legacy fallback are explicit.");
