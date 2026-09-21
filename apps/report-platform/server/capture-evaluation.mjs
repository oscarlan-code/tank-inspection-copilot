import { classifyInspectorReviewDraft, DRAFT_QUALITY_CONTRACT_VERSION } from "./draft-quality.mjs";

export const CAPTURE_EVALUATION_CONTRACT = "capture_conditioned_review_v3";

// Evaluator-only diagnostics. Withheld values never become generation inputs.
export function summarizeCaptureAvailability({ captures = [], withheldFacts = [], targetSectionId, omittedFactIds = [] }) {
  const omitted = new Set(omittedFactIds);
  const display = (fact) => ({
    factId: fact.factId,
    sectionKey: fact.sectionKey ?? null,
    text: typeof fact.value === "string" ? fact.value : fact.value?.text ?? JSON.stringify(fact.value ?? ""),
    reason: fact.reason ?? fact.disposition ?? "withheld_from_capture",
  });
  return {
    contractVersion: CAPTURE_EVALUATION_CONTRACT,
    targetSectionId,
    capturedFactCount: captures.length,
    withheldFactCount: withheldFacts.length,
    withheldFacts: withheldFacts.map(display),
    omittedCapturedFacts: captures.filter((fact) => omitted.has(fact.factId)).map(display),
    denominator: "Required-fact recall uses supplied capture facts only. Historical coverage is diagnostic; withheld facts are capture gaps, not generation omissions.",
  };
}

export function applyCaptureAwareOutcome(evalRun) {
  const truth = evalRun.truthGraphEvaluation ?? {};
  const gold = evalRun.goldSectionEvaluation ?? {};
  const evidence = evalRun.evidenceSectionEvaluation ?? {};
  const semantic = evalRun.semanticSectionEvaluation ?? {};
  const format = evalRun.sectionFormatEvaluation ?? {};
  const planEvaluation = evalRun.sectionPlanEvaluation ?? {};
  const priorClassification = evalRun.draftQualityClassification ?? {};
  const priorOutcome = evalRun.outcomeCode;
  const conditioned = gold.evaluationMode === "evidence_conditioned_semantic";
  const requiredRecall = truth.requiredFactCount > 0 ? truth.requiredFactRecall : null;
  // Never replace missing current-evidence coverage with a higher gold similarity.
  const semanticRecovery = conditioned
    ? evidence.available === true ? evidence.evidenceCoverage : null
    : semantic.available === true ? semantic.semanticSimilarity : gold.contentCoverage ?? null;
  const classification = classifyInspectorReviewDraft({
    leakageRisk: evalRun.leakage?.riskScore ?? 0,
    sameGoldRetrievedCount: evalRun.retrievalEvaluation?.sameGoldRetrievedCount ?? 0,
    protectedFactMismatchCount: truth.protectedFactMismatchCount ?? 0,
    unsupportedCriticalClaimCount: truth.unsupportedClaimCount ?? 0,
    unsafeEvidenceVerdict: evidence.available === true && evidence.verdict === "unsafe",
    semanticRecovery,
    requiredConceptRecall: requiredRecall,
    claimPrecision: truth.claimPrecisionAvailable === false ? null : truth.claimPrecision ?? null,
    protectedFactAccuracy: truth.protectedFactCount > 0 ? truth.protectedFactAccuracy : null,
    entityRelationshipAccuracy: truth.entityRelationshipAccuracy ?? null,
    formatReadiness: format.score ?? null,
  });
  if (conditioned && evidence.available !== true && classification.outcomeCode !== "blocked") {
    classification.outcomeCode = "needs_attention";
    classification.attentionReasons.push("evidence_review_unavailable");
  }
  // Workflow failures survive reclassification. Content quality cannot resolve
  // missing inputs or a failed generation stage, even when available scores pass.
  const workflowBlockers = [
    ...(priorClassification.blockerReasons ?? []),
    ...(evalRun.blockers ?? []),
    ...(evalRun.generationBlockers ?? []),
    ...(evalRun.generationRun?.blockers ?? []),
    ...(evalRun.workflowBlockers ?? []),
    ...((evalRun.missingUserInputs?.missingManualFields ?? []).length ? ["missing_required_manual_inputs"] : []),
    ...(priorOutcome === "blocked" ? ["existing_workflow_blocker"] : []),
    ...(planEvaluation.blockerReasons ?? []),
    ...(Number(truth.contradictionCount ?? 0) > 0 ? ["contradicted_captured_finding"] : []),
  ].map((item) => typeof item === "string" ? item : item.code ?? item.reason ?? item.message ?? "workflow_blocker");
  classification.blockerReasons = [...new Set([...classification.blockerReasons, ...workflowBlockers])];
  classification.attentionReasons = [...new Set([
    ...(priorClassification.attentionReasons ?? []),
    ...classification.attentionReasons,
    ...(planEvaluation.attentionReasons ?? []),
    ...(Number(truth.unresolvedEvaluationCount ?? 0) > 0 ? ["output_equivalence_requires_review"] : []),
  ])];
  if (classification.blockerReasons.length) classification.outcomeCode = "blocked";
  else if (classification.attentionReasons.length) classification.outcomeCode = "needs_attention";
  const scores = [semanticRecovery, requiredRecall, truth.claimPrecisionAvailable === false ? null : truth.claimPrecision, format.score]
    .filter((value) => value != null && Number.isFinite(value));
  evalRun.score = classification.outcomeCode === "blocked" ? 0 : scores.reduce((sum, value) => sum + value, 0) / Math.max(1, scores.length);
  evalRun.grade = evalRun.score >= 0.9 ? "A" : evalRun.score >= 0.8 ? "B" : evalRun.score >= 0.7 ? "C" : evalRun.score >= 0.6 ? "D" : "F";
  evalRun.outcomeCode = classification.outcomeCode;
  evalRun.draftQualityContractVersion = DRAFT_QUALITY_CONTRACT_VERSION;
  evalRun.captureEvaluationContractVersion = CAPTURE_EVALUATION_CONTRACT;
  evalRun.draftQualityClassification = classification;
  evalRun.summary = classification.outcomeCode === "ready_for_review"
    ? "Ready for inspector review against supplied evidence; historical completeness is reported separately."
    : classification.outcomeCode === "blocked"
      ? `Blocked by workflow or integrity checks: ${classification.blockerReasons.join(", ")}.`
      : `Needs inspector attention: ${classification.attentionReasons.join(", ")}.`;
}
