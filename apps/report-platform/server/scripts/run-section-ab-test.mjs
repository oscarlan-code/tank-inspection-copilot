import { performance } from "node:perf_hooks";
import { evaluateGeneratedSection, evaluateTruthGraphRecovery } from "../eval.mjs";
import { generateSectionDraft } from "../generation.mjs";
import { mapSourcePageToReportSection } from "../capture-section-mapping.mjs";
import { calculateSystemRlReward } from "../system-rl-policy.mjs";
import { createPostgresDatabase } from "../storage/postgres.mjs";
import { createReportStore } from "../store.mjs";

const SECTION_ID = process.env.AB_SECTION_ID ?? "inspection-report";
const PROFILE_CODE = process.env.AB_PROFILE_CODE ?? "voice_heavy";
const VARIATION = Number(process.env.AB_VARIATION ?? 1);
const policies = [
  {
    key: "A",
    name: "Grounded Conservative",
    configuration: {
      precedentMinimumScore: 60, precedentCandidateMultiplier: 3, precedentLimit: 3,
      wordingLimit: 2, standardsLimit: 2, factRecommendationLimit: 12,
      promptVariant: "grounded_concise_v1", agentRoute: "deterministic_first",
    },
  },
  {
    key: "B",
    name: "Broader Recall",
    configuration: {
      precedentMinimumScore: 35, precedentCandidateMultiplier: 5, precedentLimit: 8,
      wordingLimit: 4, standardsLimit: 3, factRecommendationLimit: 32,
      promptVariant: "evidence_recovery_v1", agentRoute: "context_enriched",
    },
  },
];

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const store = await createReportStore({ databaseUrl: process.env.DATABASE_URL });
const db = await createPostgresDatabase({ databaseUrl: process.env.DATABASE_URL });
try {
  const lab = await store.getEvaluationLabState();
  const evaluationCase = lab.evaluationCases.find((item) => (
    item.profileCode === PROFILE_CODE && item.deterministicSeed === VARIATION && item.reportJobId
  ));
  if (!evaluationCase) throw new Error(`No ${PROFILE_CODE} variation ${VARIATION} mock dataset is available.`);
  const reportState = await store.loadReportJobState(evaluationCase.reportJobId);
  const lineage = await db.prepare(
    `SELECT l.fact_id, f.source_page_number
    FROM report_capture_variant_fact_links l
    JOIN report_training_case_facts f ON f.fact_id = l.fact_id
    WHERE l.variant_id = ? AND l.disposition_code <> 'withheld'`,
  ).all(evaluationCase.configuration.captureVariantId);
  const targetByFact = new Map(lineage.map((item) => [item.fact_id, mapSourcePageToReportSection(item.source_page_number)]));
  reportState.exportPackage.captureFacts = (reportState.exportPackage.captureFacts ?? []).map((fact) => ({
    ...fact,
    targetReportSectionId: fact.targetReportSectionId ?? targetByFact.get(fact.factId) ?? "inspection-report",
  }));

  // Gold is deliberately not loaded until both candidates have finished generation.
  const candidates = [];
  for (const policy of policies) {
    const started = performance.now();
    const generation = await generateSectionDraft({
      reportState,
      sectionId: SECTION_ID,
      policyDecision: {
        decisionId: `ab-${policy.key.toLowerCase()}`,
        policyVersionId: "ab_test_only",
        policyVersion: 0,
        armKey: policy.key,
        armName: policy.name,
        configuration: policy.configuration,
        mode: "offline_evaluation",
      },
    });
    candidates.push({ policy, generation, latencyMs: Math.round(performance.now() - started) });
  }

  const goldFacts = await db.prepare(
    `SELECT f.*, a.answerability_class, a.required_fact
    FROM report_training_case_facts f
    JOIN report_training_case_answerability a ON a.fact_id = f.fact_id
    WHERE f.training_case_id = ? AND f.review_status = 'approved' AND a.review_status = 'approved'`,
  ).all(evaluationCase.configuration.goldTruthCaseId);
  const sectionFacts = goldFacts.filter((fact) => mapSourcePageToReportSection(fact.source_page_number) === SECTION_ID);
  const results = candidates.map(({ policy, generation, latencyMs }) => {
    const evalRun = evaluateGeneratedSection({
      reportState, sectionId: SECTION_ID,
      generationRun: generation.generationRun,
      generatedContent: generation.draft.content,
      orchestration: generation.orchestration,
    });
    evalRun.truthGraphEvaluation = evaluateTruthGraphRecovery({ facts: sectionFacts, generatedContent: generation.draft.content });
    const reward = calculateSystemRlReward({ evalRun, generationRun: generation.generationRun });
    const format = evalRun.dimensions.find((item) => item.key === "format_match")?.score ?? null;
    return {
      policy: policy.key,
      policyName: policy.name,
      latencyMs,
      provider: generation.generationRun.providerCode,
      usedLiveModel: generation.generationRun.usedLiveModel,
      evaluatorScore: evalRun.score,
      reward: reward.value,
      learningEligible: reward.learningEligible,
      hardFailure: reward.hardFailure,
      requiredFactRecall: evalRun.truthGraphEvaluation.requiredFactRecall,
      claimPrecision: evalRun.truthGraphEvaluation.claimPrecision,
      protectedFactAccuracy: evalRun.truthGraphEvaluation.protectedFactAccuracy,
      unsupportedClaimCount: evalRun.truthGraphEvaluation.unsupportedClaimCount,
      formatMatch: format,
      generatedCharacters: generation.draft.content.length,
    };
  });
  const output = JSON.stringify({
    experiment: "single_section_generation_policy_ab",
    mockDataset: { profileCode: PROFILE_CODE, variation: VARIATION, evaluationCaseId: evaluationCase.evaluationCaseId },
    sectionId: SECTION_ID,
    goldFirewall: "Gold facts loaded only after both candidate generations completed.",
    results,
    winner: results[0]?.reward === results[1]?.reward
      ? "tie"
      : [...results].sort((a, b) => Number(b.reward ?? -1) - Number(a.reward ?? -1))[0]?.policy ?? null,
  }, null, 2);
  process.stdout.write(`${output}\n`);
} finally {
  await Promise.all([store.close(), db.close()]);
}
