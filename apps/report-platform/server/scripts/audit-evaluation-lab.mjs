import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createReportStore } from "../store.mjs";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const component = readFileSync(join(appRoot, "src/components/EvaluationLab.tsx"), "utf8");
const service = readFileSync(join(appRoot, "server/evaluation-lab.mjs"), "utf8");
const migration = readFileSync(
  join(appRoot, "server/storage/migrations/015_live_evaluation_cases.sql"),
  "utf8",
);
const violations = [];

for (const forbidden of [
  "historicalReportInventory",
  "initialSections",
  "UI PREVIEW",
  "setTimeout(",
  "AI-generated version",
]) {
  if (component.includes(forbidden)) {
    violations.push(`EvaluationLab.tsx contains forbidden preview behavior: ${forbidden}`);
  }
}

for (const required of [
  "d.approval_status = 'approved'",
  "d.source_object_key IS NOT NULL",
  "HAVING COUNT(DISTINCT k.chunk_id) > 0",
  "rj.bootstrap_key IS NULL",
  "ri.source_storage_status = 'stored'",
  "evaluation_gold",
  "hidden_test",
  "rer.evaluation_case_id = ec.evaluation_case_id",
]) {
  if (!service.includes(required)) {
    violations.push(`evaluation-lab.mjs is missing real-data guard: ${required}`);
  }
}

for (const required of [
  "DELETE FROM report_evaluation_cases",
  "report_evaluation_cases_gold_document_fk",
  "ADD COLUMN evaluation_case_id",
]) {
  if (!migration.includes(required)) {
    violations.push(`015_live_evaluation_cases.sql is missing: ${required}`);
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the Evaluation Lab audit.");
}

const store = await createReportStore({ databaseUrl: process.env.DATABASE_URL });
try {
  const state = await store.getEvaluationLabState();
  for (const document of state.documents) {
    if (!document.documentId || !document.approvedAtIso) {
      violations.push(`Approved-source response contains an unapproved document: ${document.documentId}`);
    }
  }
  for (const appPackage of state.appPackages) {
    if (appPackage.sourceStorageStatus !== "stored") {
      violations.push(`Evaluation app package is not stored immutably: ${appPackage.reportJobId}`);
    }
  }
  for (const evaluationCase of state.evaluationCases) {
    if (!evaluationCase.goldDocumentId) {
      violations.push(`Evaluation case has no persisted gold document: ${evaluationCase.evaluationCaseId}`);
    }
    if (evaluationCase.evaluationCaseId === "eval_case_v10_api653_internal_external_v1") {
      violations.push("Legacy preview evaluation seed is still exposed by the live Evaluation Lab.");
    }
  }

  const trainingReference = state.documents.find(
    (document) => document.purpose === "training_reference",
  );
  if (trainingReference) {
    let rejected = false;
    try {
      await store.linkEvaluationLabCase({
        actorUserId: "audit-user-not-used-before-guard",
        goldDocumentId: trainingReference.documentId,
        reportJobId: "audit-report-job-not-used-before-guard",
      });
    } catch (error) {
      rejected = error?.code === "evaluation_gold_classification_required";
    }
    if (!rejected) {
      violations.push("A training reference was not rejected as evaluation gold.");
    }
  }
} finally {
  await store.close();
}

if (violations.length > 0) {
  throw new Error(`Evaluation Lab audit failed:\n- ${violations.join("\n- ")}`);
}

console.log("Evaluation Lab audit passed: only approved KB data and real immutable app packages are eligible.");
