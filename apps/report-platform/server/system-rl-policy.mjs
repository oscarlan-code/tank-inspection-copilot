import { createHash, randomUUID } from "node:crypto";

const GLOBAL_CONTEXT_KEY = "__global__";
const POLICY_KEY = "report_generation";
const ALLOWED_PROMPT_VARIANTS = new Set([
  "baseline_v1",
  "grounded_concise_v1",
  "evidence_recovery_v1",
  "grounded_concise_v2",
  "balanced_method_v2",
  "evidence_recovery_v2",
]);
const ALLOWED_AGENT_ROUTES = new Set([
  "default",
  "deterministic_first",
  "context_enriched",
]);
const ALLOWED_PRECEDENT_FAMILY_MODES = new Set(["compatible", "exact"]);

export const SYSTEM_RL_MODES = Object.freeze({
  LIVE: "live_generation",
  OFFLINE: "offline_evaluation",
});

export function createSystemRlController({ db, now = () => new Date().toISOString() }) {
  return {
    getStatus,
    promotePolicy,
    recordEpisode,
    rollbackPolicy,
    selectConfiguration,
  };

  async function selectConfiguration({
    reportState,
    sectionId,
    sectionKind,
    requiredManualFields = [],
    mode = SYSTEM_RL_MODES.LIVE,
    frozenCandidate = false,
  }) {
    const policy = await loadPolicyForMode(mode);
    if (!policy) {
      throw new Error(`No system RL policy is available for ${mode}.`);
    }
    const arms = await loadEnabledArms(policy.policy_version_id);
    if (arms.length === 0) {
      throw new Error(`System RL policy ${policy.policy_version_id} has no enabled arms.`);
    }

    const context = buildSystemRlContext({
      reportState,
      requiredManualFields,
      sectionId,
      sectionKind,
    });
    const rows = await db.prepare(
      `SELECT arm_id, context_key, eligible_episode_count, reward_sum,
        reward_squared_sum, hard_failure_count, last_reward
      FROM system_rl_context_arm_stats
      WHERE policy_version_id = ? AND context_key IN (?, ?)`,
    ).all(policy.policy_version_id, context.contextKey, GLOBAL_CONTEXT_KEY);
    const stats = buildStatsIndex(rows);
    const selection = selectPolicyArm({
      arms,
      contextKey: context.contextKey,
      explorationCoefficient: Number(policy.exploration_coefficient ?? 0),
      mode: frozenCandidate ? SYSTEM_RL_MODES.LIVE : mode,
      stats,
    });
    const configuration = validatePolicyConfiguration(parseJson(selection.arm.config_json));

    return {
      decisionId: `rld_${randomUUID()}`,
      policyVersionId: policy.policy_version_id,
      policyVersion: Number(policy.version_number),
      policyStatus: policy.status_code,
      algorithmCode: policy.algorithm_code,
      armId: selection.arm.arm_id,
      armKey: selection.arm.arm_key,
      armName: selection.arm.display_name,
      mode,
      frozenCandidate,
      contextKey: context.contextKey,
      context: context.snapshot,
      selectionScore: selection.score,
      selectionReason: selection.reason,
      configuration,
      selectedAtIso: now(),
    };
  }

  async function recordEpisode({ decision, evalRun, generationRun, updateLearning = true }) {
    const reward = calculateSystemRlReward({ evalRun, generationRun });
    const createdAtIso = now();
    await db.prepare(
      `INSERT INTO system_rl_policy_decisions (
        decision_id, policy_version_id, arm_id, run_id, report_job_id,
        tenant_id, workspace_id, section_id, mode_code, context_key,
        context_json, selection_score, selection_reason, config_snapshot_json,
        created_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      decision.decisionId,
      decision.policyVersionId,
      decision.armId,
      generationRun.runId,
      evalRun.reportJobId,
      decision.tenantId,
      decision.workspaceId,
      evalRun.sectionId,
      decision.mode,
      decision.contextKey,
      JSON.stringify(decision.context),
      decision.selectionScore,
      decision.selectionReason,
      JSON.stringify(decision.configuration),
      createdAtIso,
    );

    await db.prepare(
      `INSERT INTO system_rl_policy_rewards (
        reward_id, decision_id, eval_run_id, reward_value, learning_eligible,
        hard_failure, hard_failure_reasons_json, metrics_json, created_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      `rlr_${randomUUID()}`,
      decision.decisionId,
      evalRun.evalRunId,
      reward.value,
      reward.learningEligible,
      reward.hardFailure,
      JSON.stringify(reward.hardFailureReasons),
      JSON.stringify(reward.metrics),
      createdAtIso,
    );

    if (updateLearning && decision.mode === SYSTEM_RL_MODES.OFFLINE && reward.learningEligible) {
      for (const contextKey of [decision.contextKey, GLOBAL_CONTEXT_KEY]) {
        await updateAggregate({
          armId: decision.armId,
          contextKey,
          hardFailure: reward.hardFailure,
          policyVersionId: decision.policyVersionId,
          rewardValue: reward.value,
          updatedAtIso: createdAtIso,
        });
      }
    }

    return reward;
  }

  async function getStatus() {
    const policies = await db.prepare(
      `SELECT *
      FROM system_rl_policy_versions
      WHERE policy_key = ?
      ORDER BY version_number DESC`,
    ).all(POLICY_KEY);
    const arms = await db.prepare(
      `SELECT arm_id, policy_version_id, arm_key, display_name, description,
        config_json, is_enabled, stable_order
      FROM system_rl_policy_arms
      ORDER BY policy_version_id, stable_order, arm_key`,
    ).all();
    const stats = await db.prepare(
      `SELECT policy_version_id, arm_id, context_key, eligible_episode_count,
        reward_sum, reward_squared_sum, hard_failure_count, last_reward, updated_at_iso
      FROM system_rl_context_arm_stats
      ORDER BY policy_version_id, context_key, arm_id`,
    ).all();
    const rewardMetrics = await db.prepare(
      `SELECT d.policy_version_id, r.learning_eligible, r.metrics_json
      FROM system_rl_policy_rewards r
      INNER JOIN system_rl_policy_decisions d ON d.decision_id = r.decision_id
      ORDER BY r.created_at_iso DESC`,
    ).all();

    return {
      policyKey: POLICY_KEY,
      learningBoundary: {
        goldContentInPolicyState: false,
        liveExploration: false,
        offlineRewardsUpdateCandidateOnly: true,
        productionPromotionRequiresSuperAdmin: true,
      },
      policies: policies.map((policy) => buildPolicyStatus(policy, arms, stats, rewardMetrics)),
    };
  }

  async function promotePolicy({ actorUserId, policyVersionId, reason }) {
    const policy = await db.prepare(
      `SELECT * FROM system_rl_policy_versions WHERE policy_version_id = ?`,
    ).get(policyVersionId);
    if (!policy) return { ok: false, code: "policy_not_found", reasons: ["Policy version was not found."] };
    if (policy.status_code !== "training") {
      return { ok: false, code: "policy_not_training", reasons: ["Only a training policy can be promoted."] };
    }
    const eligibility = await getPromotionEligibility(policy);
    if (!eligibility.eligible) {
      return { ok: false, code: "promotion_gate_failed", reasons: eligibility.reasons, eligibility };
    }

    const eventAtIso = now();
    let previousProductionPolicyVersionId = null;
    await db.transaction(async () => {
      const production = await db.prepare(
        `SELECT policy_version_id
        FROM system_rl_policy_versions
        WHERE policy_key = ? AND status_code = 'production'
        FOR UPDATE`,
      ).get(POLICY_KEY);
      previousProductionPolicyVersionId = production?.policy_version_id ?? null;
      if (previousProductionPolicyVersionId) {
        await db.prepare(
          `UPDATE system_rl_policy_versions
          SET status_code = 'archived', archived_at_iso = ?
          WHERE policy_version_id = ?`,
        ).run(eventAtIso, previousProductionPolicyVersionId);
      }
      await db.prepare(
        `UPDATE system_rl_policy_versions
        SET status_code = 'production', promoted_at_iso = ?, archived_at_iso = NULL
        WHERE policy_version_id = ?`,
      ).run(eventAtIso, policyVersionId);
      await db.prepare(
        `INSERT INTO system_rl_policy_events (
          event_id, policy_version_id, actor_user_id, event_code,
          previous_production_policy_version_id, reason, evidence_json, created_at_iso
        ) VALUES (?, ?, ?, 'promoted', ?, ?, ?, ?)`,
      ).run(
        `rlpe_${randomUUID()}`,
        policyVersionId,
        actorUserId,
        previousProductionPolicyVersionId,
        String(reason ?? "").trim() || "Passed system RL promotion gates.",
        JSON.stringify(eligibility),
        eventAtIso,
      );
    });

    return { ok: true, policyVersionId, previousProductionPolicyVersionId, eligibility };
  }

  async function rollbackPolicy({ actorUserId, policyVersionId, reason }) {
    const target = await db.prepare(
      `SELECT * FROM system_rl_policy_versions WHERE policy_version_id = ?`,
    ).get(policyVersionId);
    if (!target) return { ok: false, code: "policy_not_found", reasons: ["Rollback policy was not found."] };
    const eventAtIso = now();
    let previousProductionPolicyVersionId = null;
    await db.transaction(async () => {
      const production = await db.prepare(
        `SELECT policy_version_id
        FROM system_rl_policy_versions
        WHERE policy_key = ? AND status_code = 'production'
        FOR UPDATE`,
      ).get(POLICY_KEY);
      previousProductionPolicyVersionId = production?.policy_version_id ?? null;
      if (previousProductionPolicyVersionId === policyVersionId) return;
      if (previousProductionPolicyVersionId) {
        await db.prepare(
          `UPDATE system_rl_policy_versions
          SET status_code = 'archived', archived_at_iso = ?
          WHERE policy_version_id = ?`,
        ).run(eventAtIso, previousProductionPolicyVersionId);
      }
      await db.prepare(
        `UPDATE system_rl_policy_versions
        SET status_code = 'production', promoted_at_iso = ?, archived_at_iso = NULL
        WHERE policy_version_id = ?`,
      ).run(eventAtIso, policyVersionId);
      await db.prepare(
        `INSERT INTO system_rl_policy_events (
          event_id, policy_version_id, actor_user_id, event_code,
          previous_production_policy_version_id, reason, evidence_json, created_at_iso
        ) VALUES (?, ?, ?, 'rolled_back', ?, ?, ?, ?)`,
      ).run(
        `rlpe_${randomUUID()}`,
        policyVersionId,
        actorUserId,
        previousProductionPolicyVersionId,
        String(reason ?? "").trim() || "Super-admin rollback.",
        JSON.stringify({ rollback: true }),
        eventAtIso,
      );
    });
    return { ok: true, policyVersionId, previousProductionPolicyVersionId };
  }

  async function loadPolicyForMode(mode) {
    const requestedStatus = mode === SYSTEM_RL_MODES.OFFLINE ? "training" : "production";
    return db.prepare(
      `SELECT *
      FROM system_rl_policy_versions
      WHERE policy_key = ? AND status_code = ?
      ORDER BY version_number DESC
      LIMIT 1`,
    ).get(POLICY_KEY, requestedStatus);
  }

  function loadEnabledArms(policyVersionId) {
    return db.prepare(
      `SELECT *
      FROM system_rl_policy_arms
      WHERE policy_version_id = ? AND is_enabled = TRUE
      ORDER BY stable_order, arm_key`,
    ).all(policyVersionId);
  }

  async function updateAggregate({
    armId,
    contextKey,
    hardFailure,
    policyVersionId,
    rewardValue,
    updatedAtIso,
  }) {
    await db.prepare(
      `INSERT INTO system_rl_context_arm_stats (
        policy_version_id, arm_id, context_key, eligible_episode_count,
        reward_sum, reward_squared_sum, hard_failure_count, last_reward, updated_at_iso
      ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)
      ON CONFLICT (policy_version_id, arm_id, context_key) DO UPDATE SET
        eligible_episode_count = system_rl_context_arm_stats.eligible_episode_count + 1,
        reward_sum = system_rl_context_arm_stats.reward_sum + excluded.reward_sum,
        reward_squared_sum = system_rl_context_arm_stats.reward_squared_sum + excluded.reward_squared_sum,
        hard_failure_count = system_rl_context_arm_stats.hard_failure_count + excluded.hard_failure_count,
        last_reward = excluded.last_reward,
        updated_at_iso = excluded.updated_at_iso`,
    ).run(
      policyVersionId,
      armId,
      contextKey,
      rewardValue,
      rewardValue ** 2,
      hardFailure ? 1 : 0,
      rewardValue,
      updatedAtIso,
    );
  }

  async function getPromotionEligibility(policy) {
    const rows = await db.prepare(
      `SELECT arm_id, eligible_episode_count, reward_sum, hard_failure_count
      FROM system_rl_context_arm_stats
      WHERE policy_version_id = ? AND context_key = ?`,
    ).all(policy.policy_version_id, GLOBAL_CONTEXT_KEY);
    const episodeCount = rows.reduce((sum, row) => sum + Number(row.eligible_episode_count ?? 0), 0);
    const rewardSum = rows.reduce((sum, row) => sum + Number(row.reward_sum ?? 0), 0);
    const hardFailureCount = rows.reduce((sum, row) => sum + Number(row.hard_failure_count ?? 0), 0);
    const meanReward = episodeCount > 0 ? rewardSum / episodeCount : 0;
    const testedArmCount = rows.filter((row) => Number(row.eligible_episode_count ?? 0) > 0).length;
    const enabledArmCountRow = await db.prepare(
      `SELECT COUNT(*) AS count
      FROM system_rl_policy_arms
      WHERE policy_version_id = ? AND is_enabled = TRUE`,
    ).get(policy.policy_version_id);
    const enabledArmCount = Number(enabledArmCountRow?.count ?? 0);
    const metricRows = await db.prepare(
      `SELECT r.metrics_json
      FROM system_rl_policy_rewards r
      INNER JOIN system_rl_policy_decisions d ON d.decision_id = r.decision_id
      WHERE d.policy_version_id = ? AND r.learning_eligible = TRUE`,
    ).all(policy.policy_version_id);
    const metricSummary = aggregateRewardMetrics(metricRows);
    const policyConfig = parseJson(policy.config_json);
    const metricGates = policyConfig.metricPromotionGates ?? {};
    const minimumHumanReviewedEpisodes = Number(
      policyConfig.minimumHumanReviewedEpisodes ?? 0,
    );
    const reasons = [];
    if (episodeCount < Number(policy.minimum_promotion_episodes)) {
      reasons.push(`Requires ${policy.minimum_promotion_episodes} eligible episodes; received ${episodeCount}.`);
    }
    if (meanReward < Number(policy.minimum_mean_reward)) {
      reasons.push(`Mean reward ${meanReward.toFixed(3)} is below ${Number(policy.minimum_mean_reward).toFixed(3)}.`);
    }
    if (hardFailureCount > Number(policy.maximum_hard_failures)) {
      reasons.push(`Hard failures ${hardFailureCount} exceed the allowed ${policy.maximum_hard_failures}.`);
    }
    if (testedArmCount < enabledArmCount) {
      reasons.push(`All enabled arms must be tested; ${testedArmCount} of ${enabledArmCount} have eligible rewards.`);
    }
    for (const [metricKey, threshold] of Object.entries(metricGates)) {
      const mean = metricSummary.means[metricKey];
      if (mean == null) {
        reasons.push(`Promotion metric ${metricKey} has no eligible labelled observations.`);
      } else if (mean < Number(threshold)) {
        reasons.push(`Promotion metric ${metricKey} ${mean.toFixed(3)} is below ${Number(threshold).toFixed(3)}.`);
      }
    }
    if (metricSummary.humanReviewedEpisodeCount < minimumHumanReviewedEpisodes) {
      reasons.push(
        `Requires ${minimumHumanReviewedEpisodes} human-reviewed labelled episodes; received ${metricSummary.humanReviewedEpisodeCount}.`,
      );
    }
    return {
      eligible: reasons.length === 0,
      episodeCount,
      hardFailureCount,
      meanReward,
      testedArmCount,
      enabledArmCount,
      metricSummary,
      reasons,
    };
  }
}

export function buildSystemRlContext({
  reportState,
  sectionId,
  sectionKind = "unknown",
  requiredManualFields = [],
}) {
  const exportPackage = reportState?.exportPackage ?? {};
  const manualInputs = reportState?.manualSupplement ?? {};
  const missingRequiredInputCount = requiredManualFields.filter(
    (fieldKey) => !String(manualInputs[fieldKey] ?? "").trim(),
  ).length;
  const structuredEvidenceCount = countItems(exportPackage.utMeasurements)
    + countItems(exportPackage.findings)
    + countItems(exportPackage.checklistItems)
    + countItems(exportPackage.elements);
  const narrativeEvidenceCount = countItems(exportPackage.voiceNarratives)
    + countItems(exportPackage.voiceNotes)
    + countItems(exportPackage.transcripts);
  const evidenceBand = structuredEvidenceCount >= 20 || narrativeEvidenceCount >= 4
    ? "rich"
    : structuredEvidenceCount >= 4 || narrativeEvidenceCount >= 1
      ? "partial"
      : "sparse";
  const photoEvidenceCount = countItems(exportPackage.attachments);
  const provenance = exportPackage.captureScenarioProvenance ?? {};
  const captureProfile = normalizeContextToken(provenance.captureProfile ?? "organic_capture");
  const missingInputBand = missingRequiredInputCount === 0 ? "complete" : "incomplete";
  const reportFamily = normalizeContextToken(
    reportState?.reportClassification?.reportFamily
      ?? reportState?.reportClassification?.reportFamilyId
      ?? reportState?.reportClassification?.reportFamilyLabel
      ?? reportState?.reportClassification?.primaryCode
      ?? exportPackage.reportFamily
      ?? exportPackage.inspectionType
      ?? "unknown",
  );
  const normalizedSectionId = normalizeContextToken(sectionId);
  const normalizedSectionKind = normalizeContextToken(sectionKind);
  const contextKey = [
    `family:${reportFamily}`,
    `section:${normalizedSectionId}`,
    `kind:${normalizedSectionKind}`,
    `evidence:${evidenceBand}`,
    `capture:${captureProfile}`,
    `inputs:${missingInputBand}`,
  ].join("|");

  return {
    contextKey,
    snapshot: {
      reportFamily,
      sectionId: normalizedSectionId,
      sectionKind: normalizedSectionKind,
      evidenceBand,
      captureProfile,
      missingInputBand,
      missingRequiredInputCount,
      structuredEvidenceBand: toCountBand(structuredEvidenceCount),
      narrativeEvidenceBand: toCountBand(narrativeEvidenceCount),
      photoEvidenceBand: toCountBand(photoEvidenceCount),
      contextSchemaVersion: 2,
      containsGoldContent: false,
      fingerprint: createHash("sha256").update(contextKey).digest("hex").slice(0, 16),
    },
  };
}

export function selectPolicyArm({
  arms,
  contextKey,
  explorationCoefficient,
  mode,
  stats,
}) {
  if (!Array.isArray(arms) || arms.length === 0) {
    throw new Error("At least one policy arm is required.");
  }
  if (mode === SYSTEM_RL_MODES.LIVE) {
    const ranked = arms.map((arm) => {
      const exact = stats.get(`${arm.arm_id}:${contextKey}`);
      const global = stats.get(`${arm.arm_id}:${GLOBAL_CONTEXT_KEY}`);
      const source = exact?.count > 0 ? exact : global;
      return {
        arm,
        score: source?.count > 0 ? source.rewardSum / source.count : null,
      };
    });
    const learned = ranked
      .filter((candidate) => candidate.score != null)
      .sort((left, right) => right.score - left.score || stableArmOrder(left.arm, right.arm));
    if (learned.length > 0) {
      return {
        ...learned[0],
        reason: "Highest learned mean reward for the production context; live exploration is disabled.",
      };
    }
    return {
      arm: arms[0],
      score: null,
      reason: "Production policy has no learned reward for this context; selected its stable baseline arm.",
    };
  }

  const exactStats = arms.map((arm) => ({
    arm,
    stat: stats.get(`${arm.arm_id}:${contextKey}`) ?? emptyStat(),
  }));
  const untried = exactStats.filter((candidate) => candidate.stat.count === 0);
  if (untried.length > 0) {
    const exactEpisodeCount = exactStats.reduce((sum, candidate) => sum + candidate.stat.count, 0);
    if (exactEpisodeCount === 0) {
      const globalWarmStart = untried.map((candidate) => {
        const global = stats.get(`${candidate.arm.arm_id}:${GLOBAL_CONTEXT_KEY}`) ?? emptyStat();
        return {
          ...candidate,
          globalCount: global.count,
          globalMean: global.count > 0 ? global.rewardSum / global.count : null,
        };
      }).filter((candidate) => candidate.globalMean != null)
        .sort((left, right) => right.globalMean - left.globalMean || stableArmOrder(left.arm, right.arm))[0];
      if (globalWarmStart) {
        return {
          arm: globalWarmStart.arm,
          score: globalWarmStart.globalMean,
          reason: "New context warm-started from the strongest globally learned approved arm.",
        };
      }
    }
    const selected = [...untried].sort((left, right) => stableArmOrder(left.arm, right.arm))[0];
    return {
      arm: selected.arm,
      score: null,
      reason: "Offline exploration selected an untried approved arm for this context.",
    };
  }
  const totalPulls = exactStats.reduce((sum, candidate) => sum + candidate.stat.count, 0);
  const ranked = exactStats.map(({ arm, stat }) => {
    const mean = stat.rewardSum / stat.count;
    const exploration = Number(explorationCoefficient || 0)
      * Math.sqrt(Math.log(totalPulls + 1) / stat.count);
    return { arm, score: mean + exploration };
  }).sort((left, right) => right.score - left.score || stableArmOrder(left.arm, right.arm));
  return {
    ...ranked[0],
    reason: "Contextual UCB selected the approved arm with the best reward/exploration score.",
  };
}

export function calculateSystemRlReward({ evalRun, generationRun }) {
  const dimensions = new Map((evalRun?.dimensions ?? []).map((dimension) => [dimension.key, Number(dimension.score ?? 0)]));
  const missingInputCount = Number(evalRun?.missingUserInputs?.missingManualFields?.length ?? 0);
  const blockerCount = Number(generationRun?.blockers?.length ?? 0);
  const leakageRisk = Number(evalRun?.leakage?.riskScore ?? 0);
  const retrievalEvaluation = evalRun?.retrievalEvaluation ?? {};
  const generatedContentEvaluation = evalRun?.generatedContentEvaluation ?? {};
  const retrievalLabelsAvailable = retrievalEvaluation.available === true;
  const retrievalLabelConfidence = Number(retrievalEvaluation.labelConfidence ?? 0);
  const retrievalLabelReviewStatus = String(
    retrievalEvaluation.labelReviewStatus ?? "machine_proposed",
  );
  const retrievalPrecisionAtK = Number(retrievalEvaluation.precisionAtK ?? 0);
  const retrievalRecallAtK = Number(retrievalEvaluation.recallAtK ?? 0);
  const retrievalNdcgAtK = Number(retrievalEvaluation.ndcgAtK ?? 0);
  const claimPrecisionAvailable = generatedContentEvaluation.claimPrecisionAvailable === true;
  const claimPrecision = Number(generatedContentEvaluation.claimPrecision ?? 0);
  const requiredFactRecallAvailable = generatedContentEvaluation.requiredFactRecallAvailable === true;
  const requiredFactRecall = Number(generatedContentEvaluation.requiredFactRecall ?? 0);
  const sourceGrounding = dimensions.get("source_grounding") ?? 0;
  const hardFailureReasons = [];
  const truth = evalRun?.truthGraphEvaluation ?? null;
  const gold = evalRun?.goldSectionEvaluation ?? null;
  const semantic = evalRun?.semanticSectionEvaluation ?? null;
  const semanticEvidenceMode=String(gold?.evaluationMode??"direct_recovery")==="evidence_conditioned_semantic";
  const effectiveTruthRecall=semanticEvidenceMode&&semantic?.available===true
    ? Math.max(Number(truth?.requiredFactRecall??0),Number(semantic.materialConceptRecall??0))
    : Number(truth?.requiredFactRecall??0);
  if (leakageRisk >= 0.35 || evalRun?.outcomeCode === "fail_possible_leakage") {
    hardFailureReasons.push("reference_leakage_guard");
  }
  if (missingInputCount === 0 && sourceGrounding < 0.25) {
    hardFailureReasons.push("unsupported_current_fact_risk");
  }
  if (Number(retrievalEvaluation.sameGoldRetrievedCount ?? 0) > 0) {
    hardFailureReasons.push("same_gold_report_retrieved");
  }
  if (claimPrecisionAvailable && claimPrecision < 0.5) {
    hardFailureReasons.push("unsupported_verifiable_claims");
  }
  if (truth?.protectedFactMismatchCount > 0) hardFailureReasons.push("protected_truth_mismatch");
  if (truth?.unsupportedClaimCount > 0) hardFailureReasons.push("invented_verifiable_fact");
  if (truth?.requiredFactCount > 0 && effectiveTruthRecall < (semanticEvidenceMode?0.7:0.8)) {
    hardFailureReasons.push("required_truth_recovery_below_threshold");
  }
  const directGoldRecovery=String(gold?.evaluationMode??"direct_recovery")==="direct_recovery";
  if (directGoldRecovery && gold?.contentCoverage != null && Number(gold.contentCoverage) < Number(gold.minimumContentCoverage??0.55)) hardFailureReasons.push("gold_content_coverage_below_threshold");
  if (directGoldRecovery && gold?.lengthRatio != null && (Number(gold.lengthRatio) < 0.5 || Number(gold.lengthRatio) > 1.5)) hardFailureReasons.push("section_length_ratio_out_of_range");
  const learningIneligibilityReasons = [];
  if (missingInputCount > 0) learningIneligibilityReasons.push("missing_required_input");
  if (blockerCount > 0) learningIneligibilityReasons.push("generation_blocker");
  if (!truth && !retrievalLabelsAvailable) learningIneligibilityReasons.push("retrieval_labels_unavailable");
  if (retrievalLabelsAvailable && retrievalLabelConfidence < 0.55) {
    learningIneligibilityReasons.push("retrieval_label_confidence_too_low");
  }
  const learningEligible = learningIneligibilityReasons.length === 0;
  const hardFailure = hardFailureReasons.length > 0;
  const weightedScore = truth ? weightedMetricScore([
    rewardMetric(effectiveTruthRecall, 0.2, Number(truth.requiredFactCount??0)>0),
    rewardMetric(Number(semantic?.semanticSimilarity ?? gold?.contentCoverage ?? 0), 0.55, semantic?.available===true||gold?.contentCoverage != null),
    rewardMetric(Number(truth.claimPrecision ?? 0), 0.15),
    rewardMetric(Number(truth.protectedFactAccuracy ?? 0), 0.05, Number(truth.protectedFactCount ?? 0) > 0),
    rewardMetric(dimensions.get("format_match") ?? 0, 0.05),
  ]) : weightedMetricScore([
    rewardMetric(retrievalPrecisionAtK, 0.2, retrievalLabelsAvailable),
    rewardMetric(retrievalRecallAtK, 0.2, retrievalLabelsAvailable),
    rewardMetric(retrievalNdcgAtK, 0.1, retrievalLabelsAvailable),
    rewardMetric(claimPrecision, 0.15, claimPrecisionAvailable),
    rewardMetric(requiredFactRecall, 0.15, requiredFactRecallAvailable),
    rewardMetric(sourceGrounding, 0.1),
    rewardMetric(dimensions.get("format_match") ?? 0, 0.05),
    rewardMetric(dimensions.get("leakage_safety") ?? 0, 0.05),
  ]);
  const value = learningEligible ? (hardFailure ? 0 : weightedScore) : null;

  return {
    value,
    learningEligible,
    learningIneligibilityReasons,
    hardFailure,
    hardFailureReasons,
    metrics: {
      evaluatorScore: Number(evalRun?.score ?? 0),
      formatMatch: dimensions.get("format_match") ?? 0,
      referenceAlignment: dimensions.get("reference_alignment") ?? 0,
      sourceGrounding,
      missingInputDiscipline: dimensions.get("missing_input_discipline") ?? 0,
      leakageSafety: dimensions.get("leakage_safety") ?? 0,
      leakageRisk,
      missingInputCount,
      blockerCount,
      retrievalPrecisionAtK,
      retrievalRecallAtK,
      retrievalF1AtK: Number(retrievalEvaluation.f1AtK ?? 0),
      retrievalReciprocalRank: Number(retrievalEvaluation.reciprocalRank ?? 0),
      retrievalNdcgAtK,
      retrievalLabelsAvailable,
      retrievalLabelConfidence,
      retrievalLabelSource: retrievalEvaluation.labelSource ?? null,
      retrievalLabelReviewStatus,
      sameGoldRetrievedCount: Number(retrievalEvaluation.sameGoldRetrievedCount ?? 0),
      claimPrecision,
      claimPrecisionAvailable,
      requiredFactRecall,
      requiredFactRecallAvailable,
      unsupportedVerifiableClaimCount: Number(generatedContentEvaluation.unsupportedClaims?.length ?? 0),
      outcomeCode: String(evalRun?.outcomeCode ?? "unknown"),
      containsGoldContent: false,
      rewardSchemaVersion: 2,
      goldStandardType: truth ? "approved_truth_graph" : "legacy_reference",
      truthRequiredFactRecall: truth?.requiredFactRecall ?? null,
      truthClaimPrecision: truth?.claimPrecision ?? null,
      protectedFactAccuracy: truth?.protectedFactAccuracy ?? null,
      goldContentCoverage: gold?.contentCoverage ?? null,
      outputLengthRatio: gold?.lengthRatio ?? null,
      outputLengthBalance: gold?.lengthBalance ?? null,
    },
  };
}

export function validatePolicyConfiguration(value) {
  const config = value && typeof value === "object" ? value : {};
  const normalized = {
    precedentMinimumScore: boundedInteger(config.precedentMinimumScore, 0, 100, 45),
    precedentCandidateMultiplier: boundedInteger(config.precedentCandidateMultiplier, 1, 8, 4),
    precedentLimit: boundedInteger(config.precedentLimit, 1, 12, 5),
    wordingLimit: boundedInteger(config.wordingLimit, 1, 6, 3),
    standardsLimit: boundedInteger(config.standardsLimit, 0, 5, 3),
    factRecommendationLimit: boundedInteger(config.factRecommendationLimit, 0, 48, 24),
    promptVariant: String(config.promptVariant ?? "baseline_v1"),
    agentRoute: String(config.agentRoute ?? "default"),
    precedentFamilyMode: String(config.precedentFamilyMode ?? "compatible"),
  };
  if (!ALLOWED_PROMPT_VARIANTS.has(normalized.promptVariant)) {
    throw new Error(`Unsupported system RL prompt variant: ${normalized.promptVariant}.`);
  }
  if (!ALLOWED_AGENT_ROUTES.has(normalized.agentRoute)) {
    throw new Error(`Unsupported system RL agent route: ${normalized.agentRoute}.`);
  }
  if (!ALLOWED_PRECEDENT_FAMILY_MODES.has(normalized.precedentFamilyMode)) {
    throw new Error(`Unsupported precedent family mode: ${normalized.precedentFamilyMode}.`);
  }
  normalized.wordingLimit = Math.min(normalized.wordingLimit, normalized.precedentLimit);
  return Object.freeze(normalized);
}

function buildStatsIndex(rows) {
  const stats = new Map();
  for (const row of rows ?? []) {
    stats.set(`${row.arm_id}:${row.context_key}`, {
      count: Number(row.eligible_episode_count ?? 0),
      rewardSum: Number(row.reward_sum ?? 0),
      rewardSquaredSum: Number(row.reward_squared_sum ?? 0),
      hardFailureCount: Number(row.hard_failure_count ?? 0),
    });
  }
  return stats;
}

function buildPolicyStatus(policy, arms, stats, rewardMetrics) {
  const policyArms = arms.filter((arm) => arm.policy_version_id === policy.policy_version_id);
  const globalStats = new Map(
    stats
      .filter((stat) => stat.policy_version_id === policy.policy_version_id && stat.context_key === GLOBAL_CONTEXT_KEY)
      .map((stat) => [stat.arm_id, stat]),
  );
  const armStatuses = policyArms.map((arm) => {
    const stat = globalStats.get(arm.arm_id);
    const count = Number(stat?.eligible_episode_count ?? 0);
    const rewardSum = Number(stat?.reward_sum ?? 0);
    return {
      armId: arm.arm_id,
      armKey: arm.arm_key,
      displayName: arm.display_name,
      description: arm.description,
      enabled: arm.is_enabled === true,
      configuration: validatePolicyConfiguration(parseJson(arm.config_json)),
      eligibleEpisodeCount: count,
      meanReward: count > 0 ? rewardSum / count : null,
      hardFailureCount: Number(stat?.hard_failure_count ?? 0),
      lastReward: stat?.last_reward == null ? null : Number(stat.last_reward),
    };
  });
  const episodeCount = armStatuses.reduce((sum, arm) => sum + arm.eligibleEpisodeCount, 0);
  const rewardTotal = armStatuses.reduce(
    (sum, arm) => sum + (arm.meanReward ?? 0) * arm.eligibleEpisodeCount,
    0,
  );
  const evaluationMetrics = aggregateRewardMetrics(
    rewardMetrics.filter((row) => row.policy_version_id === policy.policy_version_id),
  );
  const policyConfig = parseJson(policy.config_json);
  return {
    policyVersionId: policy.policy_version_id,
    versionNumber: Number(policy.version_number),
    displayName: policy.display_name,
    statusCode: policy.status_code,
    algorithmCode: policy.algorithm_code,
    explorationCoefficient: Number(policy.exploration_coefficient),
    promotionGate: {
      minimumEpisodes: Number(policy.minimum_promotion_episodes),
      minimumMeanReward: Number(policy.minimum_mean_reward),
      maximumHardFailures: Number(policy.maximum_hard_failures),
      minimumHumanReviewedEpisodes: Number(policyConfig.minimumHumanReviewedEpisodes ?? 0),
      metricThresholds: policyConfig.metricPromotionGates ?? {},
    },
    aggregate: {
      eligibleEpisodeCount: episodeCount,
      meanReward: episodeCount > 0 ? rewardTotal / episodeCount : null,
      hardFailureCount: armStatuses.reduce((sum, arm) => sum + arm.hardFailureCount, 0),
    },
    arms: armStatuses,
    evaluationMetrics,
    createdAtIso: policy.created_at_iso,
    promotedAtIso: policy.promoted_at_iso,
    archivedAtIso: policy.archived_at_iso,
  };
}

function aggregateRewardMetrics(rows) {
  const keys = [
    "retrievalPrecisionAtK",
    "retrievalRecallAtK",
    "retrievalF1AtK",
    "retrievalReciprocalRank",
    "retrievalNdcgAtK",
    "claimPrecision",
    "requiredFactRecall",
  ];
  const sums = Object.fromEntries(keys.map((key) => [key, 0]));
  const counts = Object.fromEntries(keys.map((key) => [key, 0]));
  let eligibleEpisodeCount = 0;
  let weaklySupervisedEpisodeCount = 0;
  for (const row of rows ?? []) {
    if (row.learning_eligible !== true) continue;
    eligibleEpisodeCount += 1;
    const metrics = parseJson(row.metrics_json);
    if (metrics.retrievalLabelSource === "gold_section_weak_supervision") {
      weaklySupervisedEpisodeCount += 1;
    }
    for (const key of keys) {
      const available = key === "claimPrecision"
        ? metrics.claimPrecisionAvailable === true
        : key === "requiredFactRecall"
          ? metrics.requiredFactRecallAvailable === true
          : metrics.retrievalLabelsAvailable === true;
      const value = Number(metrics[key]);
      if (!available || !Number.isFinite(value)) continue;
      sums[key] += value;
      counts[key] += 1;
    }
  }
  return {
    eligibleEpisodeCount,
    humanReviewedEpisodeCount: (rows ?? []).filter((row) => {
      if (row.learning_eligible !== true) return false;
      const metrics = parseJson(row.metrics_json);
      return ["human_reviewed", "approved"].includes(metrics.retrievalLabelReviewStatus);
    }).length,
    weaklySupervisedEpisodeCount,
    means: Object.fromEntries(keys.map((key) => [
      key,
      counts[key] > 0 ? sums[key] / counts[key] : null,
    ])),
    observations: counts,
    metricSchemaVersion: 2,
  };
}

function parseJson(value) {
  if (value == null) return {};
  if (typeof value === "string") return JSON.parse(value);
  return value;
}

function emptyStat() {
  return { count: 0, rewardSum: 0, rewardSquaredSum: 0, hardFailureCount: 0 };
}

function stableArmOrder(left, right) {
  return Number(left.stable_order ?? 0) - Number(right.stable_order ?? 0)
    || String(left.arm_key).localeCompare(String(right.arm_key));
}

function normalizeContextToken(value) {
  return String(value ?? "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";
}

function countItems(value) {
  return Array.isArray(value) ? value.length : 0;
}

function toCountBand(value) {
  if (value === 0) return "none";
  if (value < 4) return "low";
  if (value < 20) return "medium";
  return "high";
}

function boundedInteger(value, minimum, maximum, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, number));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function rewardMetric(score, weight, available = true) {
  return { available, score: clamp01(Number(score)), weight };
}

function weightedMetricScore(metrics) {
  const available = metrics.filter((metric) => metric.available);
  const weightTotal = available.reduce((sum, metric) => sum + metric.weight, 0);
  if (weightTotal === 0) return 0;
  return clamp01(
    available.reduce((sum, metric) => sum + metric.score * metric.weight, 0) / weightTotal,
  );
}
