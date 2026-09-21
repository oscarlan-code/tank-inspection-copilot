import pg from "pg";
import { pathToFileURL } from "node:url";
import { generateSectionDraft } from "../generation.mjs";
import { PLANNED_GENERATOR_CONTRACT } from "../planned-generation.mjs";
import { buildSectionPlanningSnapshot } from "../section-planner.mjs";
import { evaluateSectionPlanOutput } from "../section-plan-evaluation.mjs";
import { evaluateGoldSectionRecovery, evaluateSectionFormatContract } from "../eval.mjs";
import { validateAndroidV3ProductExport } from "../store.mjs";
import { reconstructionBenchmarkMetadata } from "../standardized-pair-builder.mjs";

export const GOVERNED_DIAGNOSTIC_CONTRACT = "native_section_plan_diagnostic_v1";
const json = (value, fallback = {}) => typeof value === "string" ? JSON.parse(value) : value ?? fallback;
const clone = (value) => structuredClone(value);
const shaPattern = /^[a-f0-9]{64}$/i;

/** Preflight all inputs before a model call; never reinterpret generic appRecords. */
export function prepareGovernedDiagnosticPair(pair) {
  const input = json(pair.mock_input_json);
  const exportPackage = input.nativeExportPackage;
  if (!exportPackage) throw new Error(`${pair.governed_pair_id}: nativeExportPackage is required; legacy appRecords cannot run through this diagnostic.`);
  const issues = validateAndroidV3ProductExport(exportPackage);
  if (issues.length) throw new Error(`Native app contract failed: ${issues.join(" ")}`);
  const provenance = input.nativeExportProvenance;
  if (!provenance?.objectKey || !shaPattern.test(provenance.sha256 ?? "") || !shaPattern.test(provenance.inputPackageHash ?? "")) {
    throw new Error("Native input requires its immutable source object, SHA-256 and normalized inputPackageHash from import.");
  }
  for (const collection of ["utMeasurements", "findings", "inspectionChecklistItems", "inspectionChecklistSectionNotes", "attachments", "elements", "layoutConfigs", "layoutFigures", "layoutTargets"]) {
    if (!Array.isArray(exportPackage[collection])) throw new Error(`Native ${collection}[] is required; generic fixture records cannot substitute for it.`);
  }
  if ((exportPackage.captureFacts ?? []).length || (exportPackage.structuredTables ?? []).length) throw new Error("Generic captureFacts/structuredTables require native materialization and review before this diagnostic.");
  if (exportPackage.utMeasurements.some((row) => !row.itemKey || !row.targetKey || !["value1", "value2", "value3", "value4", "value5", "reinforcementPadReading"].some((key) => Object.hasOwn(row, key)))) throw new Error("Native UT rows require item identity and typed measurement cells; readingText is insufficient.");
  if (exportPackage.findings.some((row) => row.description && !Object.hasOwn(row, "note"))) throw new Error("Native findings require note; generic description records cannot substitute for app evidence.");
  const scope = { tenantId: exportPackage.tenantId, workspaceId: exportPackage.workspaceId, inspectionId: exportPackage.inspectionId };
  const manualInputs = clone(input.manualInputs ?? {});
  const sectionPlanning = buildSectionPlanningSnapshot({ exportPackage, manualInputs, decisions: clone(input.sectionDecisions ?? []), scope });
  if (sectionPlanning.inputPackageHash !== provenance.inputPackageHash) throw new Error("Native input package does not match its frozen imported hash.");
  if (sectionPlanning.evidenceRecords.some((record) => record.quality.issues.some((issue) => ["unsupported_record", "hidden_source"].includes(issue.reason)))) throw new Error("Native input contains unsupported or answer-exposed records; resolve preparation before generation.");
  const sectionPlan = sectionPlanning.sectionPlans.find((plan) => plan.sectionId === pair.section_key);
  if (!sectionPlan) throw new Error(`Section ${pair.section_key} has no shared compiler contract.`);
  const validation = json(pair.validation_json);
  const reviewed = validation.expectedObligationReviewStatus === "approved" && Array.isArray(validation.expectedOutputObligations);
  return {
    pairId: pair.governed_pair_id,
    sectionId: pair.section_key,
    // Gold and benchmark expectations are deliberately absent from reportState.
    reportState: { exportPackage: clone(exportPackage), manualSupplement: manualInputs, sectionPlanning, reportJob: { reportJobId: `diagnostic:${pair.governed_pair_id}`, inspectionId: exportPackage.inspectionId, sourceRevision: provenance.sha256, tenantId: exportPackage.tenantId, workspaceId: exportPackage.workspaceId } },
    sectionPlan,
    expectedObligations: reviewed ? clone(validation.expectedOutputObligations) : undefined,
    expectationBasis: reviewed ? "reviewed_frozen_benchmark" : "production_requirements_only",
    inputProvenance: clone(provenance),
    // This corpus is historical-report-derived even after native serialization.
    benchmark: reconstructionBenchmarkMetadata(),
  };
}

/** Explicit evaluation candidate, then evaluator-only references. No persistence. */
export async function runGovernedDiagnosticEpisode({ pair, prepared = prepareGovernedDiagnosticPair(pair), policyDecision, generate = generateSectionDraft }) {
  const result = await generate({ reportState: prepared.reportState, sectionId: prepared.sectionId, policyDecision, executionMode: 'evaluation', userInstruction: "Generate an inspector-review draft from the frozen native section plan." });
  if (result.orchestration?.generatorContractVersion !== PLANNED_GENERATOR_CONTRACT) throw new Error("The diagnostic did not execute the shared section-planned generation contract.");
  const generatedContent = result.draft.content;
  const evaluation = evaluateSectionPlanOutput({ sectionPlan: prepared.sectionPlan, evidenceRecords: prepared.reportState.sectionPlanning.evidenceRecords, generatedContent, expectedObligations: prepared.expectedObligations, verifiedArtifacts:result.draft.reportDocument?.artifacts??[] });
  const historicalReference = String(pair.target_content ?? "");
  return {
    contractVersion: GOVERNED_DIAGNOSTIC_CONTRACT,
    pairId: prepared.pairId,
    sectionId: prepared.sectionId,
    policyVersionId: policyDecision?.policyVersionId ?? null,
    policyArmKey: policyDecision?.armKey ?? null,
    policyApplication: "frozen_trace_only_shared_compiler",
    benchmark: prepared.benchmark,
    diagnosticOnly: true,
    learningUpdated: false,
    promotionUpdated: false,
    reward: null,
    inputProvenance: prepared.inputProvenance,
    inputPackageHash: prepared.reportState.sectionPlanning.inputPackageHash,
    sectionPlanSnapshotId: prepared.reportState.sectionPlanning.snapshotId,
    generatorContractVersion: result.orchestration.generatorContractVersion,
    generationRun: result.generationRun,
    generatedContent,
    expectationBasis: prepared.expectationBasis,
    evaluation,
    existingGenerationBlockers: result.generationRun.blockers ?? [],
    historicalDiagnostic: {
      recovery: evaluateGoldSectionRecovery({ goldContent: historicalReference, generatedContent, evaluationMode: "evidence_conditioned_semantic", minimumContentCoverage: 0.55 }),
      format: evaluateSectionFormatContract({ sectionId: prepared.sectionId, goldContent: historicalReference, generatedContent }),
    },
  };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const policyVersionId = String(process.env.GOVERNED_POLICY_VERSION_ID ?? "").trim();
  if (!policyVersionId) throw new Error("Pin GOVERNED_POLICY_VERSION_ID for a frozen diagnostic.");
  const pairContractVersion = Number(process.env.GOVERNED_PAIR_CONTRACT_VERSION ?? 0);
  if (!Number.isInteger(pairContractVersion) || pairContractVersion < 1) throw new Error("Pin GOVERNED_PAIR_CONTRACT_VERSION explicitly.");
  const datasetSplit = String(process.env.GOVERNED_DATASET_SPLIT ?? "training");
  if (!["training", "validation", "hidden_test"].includes(datasetSplit)) throw new Error("Invalid diagnostic dataset split.");
  const pairLimit = Math.max(1, Math.min(100, Number(process.env.GOVERNED_TRAINING_PAIR_LIMIT ?? 6)));
  const targetPairId = String(process.env.GOVERNED_TARGET_PAIR_ID ?? "").trim();
  const cohortId = String(process.env.GOVERNED_COHORT_ID ?? "").trim();
  const requestedArms = String(process.env.GOVERNED_ARM_KEYS ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  if (requestedArms.length > 1) throw new Error("A frozen diagnostic accepts one policy arm; it does not train or optimize arms.");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  let pairs, arm;
  try {
    await client.connect();
    // Do not use the application DB initializer: it automatically runs migrations.
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const arms = (await client.query("SELECT arm_id,arm_key,config_json FROM system_rl_policy_arms WHERE policy_version_id=$1 AND is_enabled=TRUE ORDER BY stable_order", [policyVersionId])).rows;
    arm = requestedArms.length ? arms.find((item) => item.arm_key === requestedArms[0]) : arms.find((item) => item.arm_key === "grounded") ?? arms[0];
    if (!arm) throw new Error("The pinned policy has no matching enabled arm.");
    const selection = cohortId
      ? await client.query("SELECT p.*,g.target_content FROM report_governed_validation_cohort_items i JOIN report_governed_baseline_pairs p ON p.corpus_report_id=i.corpus_report_id AND p.section_key=i.section_key JOIN report_governed_gold_sections g ON g.governed_gold_section_id=p.governed_gold_section_id WHERE i.cohort_id=$1 AND p.dataset_split=$2 AND p.status_code='ready' AND p.contract_version=$3 ORDER BY i.stable_order", [cohortId, datasetSplit, pairContractVersion])
      : await client.query("SELECT p.*,g.target_content FROM report_governed_baseline_pairs p JOIN report_governed_gold_sections g ON g.governed_gold_section_id=p.governed_gold_section_id WHERE p.dataset_split=$1 AND p.status_code='ready' AND p.contract_version=$2 AND ($3='' OR p.governed_pair_id=$3) ORDER BY p.governed_pair_id LIMIT $4", [datasetSplit, pairContractVersion, targetPairId, pairLimit]);
    pairs = selection.rows;
    if (cohortId) {
      const expected = Number((await client.query("SELECT COUNT(*) AS count FROM report_governed_validation_cohort_items WHERE cohort_id=$1", [cohortId])).rows[0].count);
      if (pairs.length !== expected) throw new Error(`Pinned cohort resolved ${pairs.length}/${expected} ready native pairs.`);
      if (targetPairId) pairs = pairs.filter((pair) => pair.governed_pair_id === targetPairId);
    }
    if (!pairs.length) throw new Error("No matching diagnostic pairs.");
    await client.query("ROLLBACK");
  } finally { await client.end(); }
  // Preflight the complete selection before any generation or external model use.
  const prepared = pairs.map(prepareGovernedDiagnosticPair);
  const policyDecision = { policyVersionId, armKey: arm.arm_key, armId: arm.arm_id, mode: "frozen_diagnostic", learningEligible: false, configuration: json(arm.config_json) };
  const results = [];
  for (let index = 0; index < pairs.length; index += 1) results.push(await runGovernedDiagnosticEpisode({ pair: pairs[index], prepared: prepared[index], policyDecision }));
  process.stdout.write(`${JSON.stringify({ contractVersion: GOVERNED_DIAGNOSTIC_CONTRACT, diagnosticOnly: true, databaseWrites: false, policyVersionId, datasetSplit, cohortId: cohortId || null, results }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
}
