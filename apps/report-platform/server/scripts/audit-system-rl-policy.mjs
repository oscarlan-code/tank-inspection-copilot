import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSystemRlContext,
  calculateSystemRlReward,
  selectPolicyArm,
  SYSTEM_RL_MODES,
  validatePolicyConfiguration,
} from "../system-rl-policy.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(scriptDir, "..", "..");
const failures = [];
const arms = [
  arm("conservative", 1),
  arm("balanced", 2),
  arm("broader_recall", 3),
];
const contextKey = "family:api_653|section:repair_recommendations|kind:narrative|evidence:rich|inputs:complete";

const first = selectPolicyArm({
  arms,
  contextKey,
  explorationCoefficient: 0.35,
  mode: SYSTEM_RL_MODES.OFFLINE,
  stats: new Map(),
});
assert(first.arm.arm_key === "conservative", "Offline policy should deterministically select the first untried arm.");

const warmStarted = selectPolicyArm({
  arms,
  contextKey: `${contextKey}|capture:voice_heavy`,
  explorationCoefficient: 0.35,
  mode: SYSTEM_RL_MODES.OFFLINE,
  stats: new Map([
    ["rl_arm_conservative:__global__", stat(8, 2)],
    ["rl_arm_balanced:__global__", stat(8, 6)],
    ["rl_arm_broader_recall:__global__", stat(8, 3)],
  ]),
});
assert(warmStarted.arm.arm_key === "balanced", "A new context should warm-start from the strongest globally learned approved arm.");
assert(/warm-started/i.test(warmStarted.reason), "A warm-start decision should explain its global transfer source.");

const afterOne = selectPolicyArm({
  arms,
  contextKey,
  explorationCoefficient: 0.35,
  mode: SYSTEM_RL_MODES.OFFLINE,
  stats: new Map([[`rl_arm_conservative:${contextKey}`, stat(1, 0.55)]]),
});
assert(afterOne.arm.arm_key === "balanced", "Offline policy should test the next untried arm after receiving a reward.");

const learnedStats = new Map([
  [`rl_arm_conservative:${contextKey}`, stat(20, 11)],
  [`rl_arm_balanced:${contextKey}`, stat(20, 18)],
  [`rl_arm_broader_recall:${contextKey}`, stat(20, 13)],
]);
const learned = selectPolicyArm({
  arms,
  contextKey,
  explorationCoefficient: 0.1,
  mode: SYSTEM_RL_MODES.OFFLINE,
  stats: learnedStats,
});
assert(learned.arm.arm_key === "balanced", "Contextual UCB should favor the arm with the strongest learned reward.");

const live = selectPolicyArm({
  arms,
  contextKey,
  explorationCoefficient: 99,
  mode: SYSTEM_RL_MODES.LIVE,
  stats: learnedStats,
});
assert(live.arm.arm_key === "balanced", "Live selection should exploit learned reward without exploration.");
assert(/live exploration is disabled/i.test(live.reason), "Live selection must state that exploration is disabled.");

const safeReward = calculateSystemRlReward({
  evalRun: evalRun({
    formatMatch: 0.8,
    leakageRisk: 0,
    leakageSafety: 1,
    missingInputDiscipline: 1,
    referenceAlignment: 0.7,
    sourceGrounding: 0.9,
  }),
  generationRun: { blockers: [] },
});
assert(safeReward.learningEligible, "Complete, unblocked output should be eligible for learning.");
assert(!safeReward.hardFailure, "Grounded output should not trigger a hard failure.");
assert(safeReward.value > 0.75, "Strong grounded output should produce a strong positive reward.");

const leakageReward = calculateSystemRlReward({
  evalRun: evalRun({
    formatMatch: 1,
    leakageRisk: 0.5,
    leakageSafety: 0.5,
    missingInputDiscipline: 1,
    referenceAlignment: 1,
    sourceGrounding: 0.9,
  }),
  generationRun: { blockers: [] },
});
assert(leakageReward.hardFailure, "Reference leakage must be a hard failure regardless of other scores.");
assert(leakageReward.value === 0, "Reference leakage must force reward to zero.");

const missingInputReward = calculateSystemRlReward({
  evalRun: {
    ...evalRun({
      formatMatch: 0.9,
      leakageRisk: 0,
      leakageSafety: 1,
      missingInputDiscipline: 0.2,
      referenceAlignment: 0.8,
      sourceGrounding: 0.4,
    }),
    missingUserInputs: { missingManualFields: [{ fieldKey: "owner" }] },
  },
  generationRun: { blockers: [] },
});
assert(!missingInputReward.learningEligible, "Missing report-side inputs must not train the policy.");
assert(missingInputReward.value === null, "Ineligible episodes must store a null reward rather than teaching the model to guess.");

const unlabelledReward = calculateSystemRlReward({
  evalRun: {
    ...evalRun({
      formatMatch: 0.9,
      leakageRisk: 0,
      leakageSafety: 1,
      missingInputDiscipline: 1,
      referenceAlignment: 0.9,
      sourceGrounding: 0.9,
    }),
    retrievalEvaluation: { available: false },
  },
  generationRun: { blockers: [] },
});
assert(!unlabelledReward.learningEligible, "An episode without retrieval relevance labels must not train retrieval policy.");
assert(
  unlabelledReward.learningIneligibilityReasons.includes("retrieval_labels_unavailable"),
  "The reward must explain when retrieval labels are unavailable.",
);

const truthGraphReward = calculateSystemRlReward({
  evalRun: {
    ...evalRun({ formatMatch: 0.9, leakageRisk: 0, leakageSafety: 1, missingInputDiscipline: 1, referenceAlignment: 0, sourceGrounding: 0.9 }),
    retrievalEvaluation: { available: false },
    truthGraphEvaluation: {
      requiredFactRecall: 0.9,
      claimPrecision: 1,
      protectedFactAccuracy: 1,
      protectedFactMismatchCount: 0,
      unsupportedClaimCount: 0,
    },
  },
  generationRun: { blockers: [] },
});
assert(truthGraphReward.learningEligible, "Approved Truth Graph scoring must make a capture episode eligible without legacy retrieval labels.");
assert(truthGraphReward.value > 0.9, "Strong Truth Graph recovery must produce a strong reward.");

const context = buildSystemRlContext({
  reportState: {
    exportPackage: {
      clientName: "Restricted Client Name",
      findings: [{ id: "finding-1" }],
      utMeasurements: Array.from({ length: 24 }, (_, index) => ({ id: index })),
      voiceNarratives: [{ transcript: "Restricted gold answer text" }],
      captureScenarioProvenance: { captureProfile: "voice_heavy" },
    },
    manualSupplement: {},
    reportClassification: { reportFamily: "API 653" },
  },
  requiredManualFields: [],
  sectionId: "repair-recommendations",
  sectionKind: "narrative",
});
const serializedContext = JSON.stringify(context);
assert(!serializedContext.includes("Restricted Client Name"), "Policy context must not contain current client facts.");
assert(!serializedContext.includes("Restricted gold answer text"), "Policy context must not contain narrative or gold text.");
assert(context.snapshot.containsGoldContent === false, "Policy context must explicitly declare that it contains no gold content.");
assert(context.snapshot.captureProfile === "voice_heavy", "Policy state must distinguish the selected mock-capture condition.");

let invalidVariantRejected = false;
try {
  validatePolicyConfiguration({ promptVariant: "arbitrary_script_from_model" });
} catch {
  invalidVariantRejected = true;
}
assert(invalidVariantRejected, "The policy must reject unreviewed prompt variants and arbitrary actions.");

const migration = readFileSync(
  join(appRoot, "server", "storage", "migrations", "008_system_rl_policy.sql"),
  "utf8",
);
for (const table of [
  "system_rl_policy_versions",
  "system_rl_policy_arms",
  "system_rl_policy_decisions",
  "system_rl_policy_rewards",
  "system_rl_context_arm_stats",
  "system_rl_policy_events",
]) {
  assert(migration.includes(`CREATE TABLE ${table}`), `PostgreSQL migration must create ${table}.`);
}

const generationSource = readFileSync(join(appRoot, "server", "generation.mjs"), "utf8");
assert(generationSource.includes("retrievalPolicy: policyConfiguration"), "Generation must pass the selected policy into precedent retrieval.");
assert(generationSource.includes("factRecommendationLimit"), "Generation must apply the selected recommendation retrieval limit.");
assert(generationSource.includes("buildPolicyPromptGuidance"), "Generation must apply the selected approved prompt variant.");

if (failures.length > 0) {
  console.error("System RL policy audit failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("System RL policy audit passed.");
console.log("- Offline selection explores approved untried arms and then follows reward.");
console.log("- Live selection disables exploration and exploits the learned production policy.");
console.log("- Missing-input episodes do not train; leakage forces reward to zero.");
console.log("- Policy state contains categorical/count context only, never gold report text.");

function arm(key, stableOrder) {
  return {
    arm_id: `rl_arm_${key}`,
    arm_key: key,
    stable_order: stableOrder,
  };
}

function stat(count, rewardSum) {
  return { count, rewardSum, rewardSquaredSum: 0, hardFailureCount: 0 };
}

function evalRun({
  formatMatch,
  leakageRisk,
  leakageSafety,
  missingInputDiscipline,
  referenceAlignment,
  sourceGrounding,
}) {
  return {
    score: 0.8,
    outcomeCode: "pass",
    missingUserInputs: { missingManualFields: [] },
    leakage: { riskScore: leakageRisk },
    retrievalEvaluation: {
      available: true,
      precisionAtK: 0.8,
      recallAtK: 0.7,
      f1AtK: 0.746,
      reciprocalRank: 1,
      ndcgAtK: 0.9,
      labelConfidence: 0.8,
      labelSource: "human",
      sameGoldRetrievedCount: 0,
    },
    generatedContentEvaluation: {
      claimPrecisionAvailable: true,
      claimPrecision: 0.95,
      requiredFactRecallAvailable: true,
      requiredFactRecall: 0.85,
      unsupportedClaims: [],
    },
    dimensions: [
      { key: "format_match", score: formatMatch },
      { key: "reference_alignment", score: referenceAlignment },
      { key: "source_grounding", score: sourceGrounding },
      { key: "missing_input_discipline", score: missingInputDiscipline },
      { key: "leakage_safety", score: leakageSafety },
    ],
  };
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}
