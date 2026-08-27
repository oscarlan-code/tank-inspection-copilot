import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(scriptDir, "..", "..");

const failures = [];
const read = (relativePath) => {
  try {
    return readFileSync(join(appRoot, relativePath), "utf8");
  } catch {
    failures.push(`Missing terminology-controlled file: ${relativePath}`);
    return "";
  }
};

const terminology = read("PRODUCT_TERMINOLOGY.md");
for (const requiredText of [
  "Truth Case Builder",
  "Capture Variant Builder",
  "App Round Trip",
  "Evaluation Runs",
  "Policy Optimization",
  "Policy Registry",
  "Internal Compatibility Boundary",
]) {
  if (!terminology.includes(requiredText)) {
    failures.push(`PRODUCT_TERMINOLOGY.md is missing canonical term: ${requiredText}`);
  }
}

const productFacingFiles = [
  "SYSTEM_ARCHITECTURE.md",
  "README.md",
  "AGENTIC_SYSTEM_DESIGN.md",
  "EVAL_SYSTEM.md",
  "TRAINING_HARNESS_ARCHITECTURE.md",
  "RL_RETRIEVAL_OPTIMIZATION_ARCHITECTURE.md",
  "docs/skills/report-platform-kb-eval/SKILL.md",
  "src/components/EvaluationLab.tsx",
];

const forbiddenTerms = [
  "Training Case Builder",
  "Gold Case Builder",
  "Historical Case Builder",
  "Link App Data",
  "Learned Policy",
];

for (const relativePath of productFacingFiles) {
  const content = read(relativePath);
  for (const term of forbiddenTerms) {
    if (content.toLocaleLowerCase().includes(term.toLocaleLowerCase())) {
      failures.push(`${relativePath} uses deprecated product term: ${term}`);
    }
  }
}

const evaluationLab = read("src/components/EvaluationLab.tsx");
for (const requiredText of ["Truth & Mock Data", "Evaluation Runs", "Policy Registry"]) {
  if (!evaluationLab.includes(requiredText)) {
    failures.push(`Evaluation Lab is missing current stage label: ${requiredText}`);
  }
}

const harnessArchitecture = read("TRAINING_HARNESS_ARCHITECTURE.md");
for (const requiredText of ["Truth Case Builder", "Capture Variant Builder", "Historical Source Bundle"]) {
  if (!harnessArchitecture.includes(requiredText)) {
    failures.push(`Training Harness architecture is missing canonical term: ${requiredText}`);
  }
}

if (failures.length > 0) {
  console.error("Product terminology audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Product terminology audit passed.");
console.log("- Truth Case and Capture Variant workflow names are consistent.");
console.log("- Evaluation Lab uses accurate current-stage labels.");
console.log("- Legacy training_case names remain an internal compatibility boundary.");
