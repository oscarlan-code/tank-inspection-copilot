import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveEvaluationCase } from "../evaluation-cases.mjs";
import {
  deriveWeakGoldRelevanceJudgments,
  scoreGeneratedFactMetrics,
  scoreRetrievalRanking,
} from "../evaluation-metrics.mjs";
import { classifyInspectorReviewDraft } from "../draft-quality.mjs";

const failures = [];
const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(scriptDir, "..", "..");

const judgments = [
  judgment("relevant-a", 3),
  judgment("relevant-b", 2),
  judgment("relevant-c", 1),
];
const ranked = scoreRetrievalRanking({
  judgments,
  k: 3,
  retrieved: ["relevant-a", "irrelevant-x", "relevant-b"],
});
assert(close(ranked.precisionAtK, 2 / 3), "Precision@3 must count relevant retrieved chunks over three positions.");
assert(close(ranked.recallAtK, 2 / 3), "Recall@3 must count retrieved relevant chunks over all labelled relevant chunks.");
assert(ranked.reciprocalRank === 1, "MRR must be one when the first result is relevant.");
assert(ranked.ndcgAtK > 0.7 && ranked.ndcgAtK < 1, "nDCG@3 must reflect a relevant but imperfect ranking.");

const irrelevant = scoreRetrievalRanking({
  judgments,
  k: 3,
  retrieved: ["irrelevant-x", "irrelevant-y", "irrelevant-z"],
});
assert(irrelevant.precisionAtK === 0, "Irrelevant retrieval must have zero precision.");
assert(irrelevant.recallAtK === 0, "Irrelevant retrieval must have zero recall.");
assert(irrelevant.reciprocalRank === 0, "Irrelevant retrieval must have zero reciprocal rank.");

const weakLabels = deriveWeakGoldRelevanceJudgments({
  chunks: [
    chunk("gold-1", "Gold Report", "repair-recommendations", "Repair shell pitting and confirm by inspection."),
    chunk("candidate-1", "Historical Report A", "repair-recommendations", "Repair shell pitting and inspect the completed work."),
    chunk("candidate-2", "Historical Report B", "scope-of-inspection", "Inspection scope and photographs."),
  ],
  goldSourceReportName: "Gold Report",
  sectionId: "repair-recommendations",
});
assert(weakLabels.available, "A same-section non-gold precedent should receive a weak relevance label.");
assert(!weakLabels.judgments.some((item) => item.chunkId === "gold-1"), "The hidden gold chunk must never become a retrievable qrel.");
assert(weakLabels.judgments.every((item) => item.reviewStatus === "machine_proposed"), "Weak labels must remain reviewable rather than approved automatically.");

const factMetrics = scoreGeneratedFactMetrics({
  allowedEvidence: {
    tankNumber: "D10",
    heightM: 14.535,
    finding: "Area 1 shell loss measured at 2.28 mm",
  },
  generatedContent: "Tank D10 has a height of 14.535 m. Area 1 recorded 2.28 mm.",
  requiredFacts: [
    { factKey: "tank", groups: [["D10"]] },
    { factKey: "height", groups: [["14.535"]] },
    { factKey: "area", groups: [["Area 1"], ["2.28"]] },
  ],
});
assert(factMetrics.claimPrecision === 1, "All deterministic claims present in allowed app evidence should have perfect precision.");
assert(factMetrics.requiredFactRecall === 1, "All represented required facts should have perfect recall.");

const unsupportedFacts = scoreGeneratedFactMetrics({
  allowedEvidence: { tankNumber: "D10", thickness: "2.28 mm" },
  generatedContent: "Tank D10 recorded 99 mm at Area 9.",
  requiredFacts: [{ factKey: "actual_thickness", groups: [["2.28"]] }],
});
assert(unsupportedFacts.claimPrecision < 1, "An unsupported numeric claim must reduce claim precision.");
assert(unsupportedFacts.requiredFactRecall === 0, "An omitted required app fact must produce zero fact recall.");

const reviewReady = classifyInspectorReviewDraft({
  semanticRecovery: 0.82,
  requiredConceptRecall: 0.84,
  claimPrecision: 0.94,
  protectedFactAccuracy: 1,
  entityRelationshipAccuracy: 1,
  formatReadiness: 0.95,
});
assert(reviewReady.outcomeCode === "ready_for_review", "A safe useful draft must be ready for inspector review without requiring 100% semantic agreement.");
const needsAttention = classifyInspectorReviewDraft({
  semanticRecovery: 0.68,
  requiredConceptRecall: 0.76,
  claimPrecision: 0.96,
  protectedFactAccuracy: 1,
  entityRelationshipAccuracy: 1,
  formatReadiness: 0.94,
});
assert(needsAttention.outcomeCode === "needs_attention", "Low coverage must request inspector attention rather than become a critical failure.");
const blocked = classifyInspectorReviewDraft({ protectedFactMismatchCount: 1 });
assert(blocked.outcomeCode === "blocked", "A captured critical-field mismatch must block the draft.");

const evaluationCase = resolveEvaluationCase({
  exportPackage: {
    inspectionId: "inspection-demo-api653-training-20220722",
    packageType: "v3_product_export",
  },
});
assert(evaluationCase?.goldReference?.retrievalExclusionRequired === true, "The paired V10 case must enforce the gold retrieval firewall.");

const scopedEvaluationCase = resolveEvaluationCase({
  exportPackage: {
    inspectionId: "inspection-demo-api653-training-20220722-account-audit",
    sourceInspectionId: "inspection-demo-api653-training-20220722",
    packageType: "v3_product_export",
  },
});
assert(
  scopedEvaluationCase?.caseId === "eval_case_v10_api653_internal_external_v1",
  "Account-scoped demo packages must retain their evaluator-only training pair.",
);

const migration = readFileSync(
  join(appRoot, "server", "storage", "migrations", "009_evaluation_relevance_labels.sql"),
  "utf8",
);
for (const table of [
  "report_evaluation_cases",
  "report_evaluation_case_sections",
  "report_evaluation_relevance_labels",
  "report_evaluation_required_fact_labels",
]) {
  assert(migration.includes(`CREATE TABLE ${table}`), `Migration 009 must create ${table}.`);
}

if (failures.length > 0) {
  console.error("Evaluation metric audit failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Evaluation metric audit passed.");
console.log("- Retrieval Precision@3, Recall@3, F1, MRR, and nDCG are deterministic.");
console.log("- Hidden gold chunks remain excluded from retrieval labels.");
console.log("- Claim precision and required-fact recall distinguish invention from omission.");
console.log("- Inspector-review readiness is separated from critical integrity blockers.");

function judgment(chunkId, relevanceGrade) {
  return {
    chunkId,
    relevanceGrade,
    confidence: 0.8,
    labelSource: "human",
  };
}

function chunk(chunkId, sourceReportName, sectionKey, excerpt) {
  return {
    chunkId,
    sourceReportName,
    sourceType: "sample_pdf",
    approvalStatus: "approved_for_retrieval",
    sectionKey,
    excerpt,
    qualityScore: 0.9,
  };
}

function close(left, right) {
  return Math.abs(left - right) < 1e-9;
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}
