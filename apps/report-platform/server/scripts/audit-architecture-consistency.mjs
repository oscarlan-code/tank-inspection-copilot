import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(scriptDir, "..", "..");

const requiredDocuments = [
  "SYSTEM_ARCHITECTURE.md",
  "PRODUCT_TERMINOLOGY.md",
  "DOCUMENTATION_INDEX.md",
  "README.md",
  "AGENTS.md",
  "AGENTIC_SYSTEM_DESIGN.md",
  "ANDROID_V3_OBJECT_UPLOAD_HANDOFF.md",
  "AUTHENTICATION_AND_TENANCY.md",
  "BACKEND_STORAGE_ARCHITECTURE.md",
  "GENERATED_CONTENT_CONTROL_SYSTEM.md",
  "FLOOR_CORROSION_MAP_PIPELINE.md",
  "KB_CORPUS_INGESTION_ARCHITECTURE.md",
  "PRECEDENT_KB_ARCHITECTURE.md",
  "EVAL_SYSTEM.md",
  "TRAINING_HARNESS_ARCHITECTURE.md",
  "RL_RETRIEVAL_OPTIMIZATION_ARCHITECTURE.md",
];

const historicalDocuments = [
  "FULL_SYSTEM_DIAGRAM.md",
  "REPORT_GENERATION_TOPOLOGY.md",
  "AI_ENGINE_SYSTEM_DIAGRAM.md",
  "AI_QUALITY_AND_LAYOUTMAP.md",
  "CODEX_ROLES_AND_TOOLING.md",
  "IMPLEMENTATION_PLAN.md",
  "PRODUCT_DEVELOPMENT_PLAN.md",
];

const authoritativeDocuments = [
  "SYSTEM_ARCHITECTURE.md",
  "PRODUCT_TERMINOLOGY.md",
  "README.md",
  "AGENTS.md",
  "PRODUCT_CLOUD_ARCHITECTURE.md",
  "BACKEND_STORAGE_ARCHITECTURE.md",
  "PRECEDENT_KB_ARCHITECTURE.md",
  "REPORT_COMPILER_WORKFLOW.md",
  "AGENTIC_SYSTEM_DESIGN.md",
  "GENERATED_CONTENT_CONTROL_SYSTEM.md",
  "REPORT_GENERATION_AND_LAYOUTMAP_ORCHESTRATION.md",
  "KB_CORPUS_INGESTION_ARCHITECTURE.md",
  "EVAL_SYSTEM.md",
  "TRAINING_HARNESS_ARCHITECTURE.md",
  "RL_RETRIEVAL_OPTIMIZATION_ARCHITECTURE.md",
];

const failures = [];
const readDocument = (name) => {
  try {
    return readFileSync(join(appRoot, name), "utf8");
  } catch {
    failures.push(`Missing architecture document: ${name}`);
    return "";
  }
};

for (const name of requiredDocuments) {
  readDocument(name);
}

const systemArchitecture = readDocument("SYSTEM_ARCHITECTURE.md");
for (const requiredText of [
  "The report platform is one product system.",
  "Production Report Plane",
  "Knowledge Plane",
  "Training And Evaluation Plane",
  "Source-Of-Truth Matrix",
  "Current Implementation Status",
  "PostgreSQL is the only transactional database.",
]) {
  if (!systemArchitecture.includes(requiredText)) {
    failures.push(`SYSTEM_ARCHITECTURE.md is missing required contract text: ${requiredText}`);
  }
}

const documentationIndex = readDocument("DOCUMENTATION_INDEX.md");
for (const name of requiredDocuments) {
  if (
    !documentationIndex.includes(`${name}`)
    && !["DOCUMENTATION_INDEX.md", "README.md", "AGENTS.md"].includes(name)
  ) {
    failures.push(`DOCUMENTATION_INDEX.md does not classify ${name}`);
  }
}

for (const name of historicalDocuments) {
  const content = readDocument(name);
  if (!content.includes("Status: historical design reference.")) {
    failures.push(`Historical document lacks a superseded-status warning: ${name}`);
  }
}

const forbiddenCurrentPatterns = [
  {
    pattern: /Android V2 Product|\bV2 Product\b/i,
    reason: "current architecture must use the LAIQ inspection app V3 contract",
  },
  {
    pattern: /apps\/report-platform is still docs-only/i,
    reason: "the report platform is a running product application",
  },
  {
    pattern: /Postgres becomes the transactional product database/i,
    reason: "PostgreSQL is already the product database",
  },
];

for (const name of authoritativeDocuments) {
  const content = readDocument(name);
  for (const rule of forbiddenCurrentPatterns) {
    if (rule.pattern.test(content)) {
      failures.push(`${name}: ${rule.reason}`);
    }
  }
}

for (const name of ["README.md", "AGENTS.md"]) {
  const content = readDocument(name);
  if (
    !content.includes("SYSTEM_ARCHITECTURE.md")
    || !content.includes("PRODUCT_TERMINOLOGY.md")
    || !content.includes("DOCUMENTATION_INDEX.md")
  ) {
    failures.push(`${name} must route readers to the architecture, terminology, and documentation authorities`);
  }
}

if (failures.length > 0) {
  console.error("Architecture consistency audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Architecture consistency audit passed.");
console.log("- Whole-product authority and subsystem documentation are present.");
console.log("- Historical topology/plan files are explicitly marked as superseded.");
console.log("- Current authoritative docs use the V3/PostgreSQL product baseline.");
