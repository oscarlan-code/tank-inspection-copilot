export const DRAFT_QUALITY_CONTRACT_VERSION = "inspector_review_draft_v1";

export const DRAFT_QUALITY_TARGETS = Object.freeze({
  semanticRecovery: 0.75,
  requiredConceptRecall: 0.80,
  narrativeClaimPrecision: 0.90,
  criticalFieldPreservation: 0.99,
  entityRelationshipAccuracy: 0.99,
  formatReadiness: 0.90,
});

export function classifyInspectorReviewDraft({
  leakageRisk = 0,
  sameGoldRetrievedCount = 0,
  protectedFactMismatchCount = 0,
  unsupportedCriticalClaimCount = 0,
  unsafeEvidenceVerdict = false,
  semanticRecovery = null,
  requiredConceptRecall = null,
  claimPrecision = null,
  protectedFactAccuracy = null,
  entityRelationshipAccuracy = null,
  formatReadiness = null,
} = {}) {
  const blockerReasons = [
    ...(Number(leakageRisk) >= 0.35 ? ["reference_leakage_guard"] : []),
    ...(Number(sameGoldRetrievedCount) > 0 ? ["same_gold_report_retrieved"] : []),
    ...(Number(protectedFactMismatchCount) > 0 ? ["protected_fact_mismatch"] : []),
    ...(Number(unsupportedCriticalClaimCount) > 0 ? ["unsupported_critical_claim"] : []),
    ...(unsafeEvidenceVerdict ? ["unsafe_evidence_grounding_verdict"] : []),
    ...(entityRelationshipAccuracy != null && Number(entityRelationshipAccuracy) < DRAFT_QUALITY_TARGETS.entityRelationshipAccuracy
      ? ["critical_entity_relationship_mismatch"] : []),
  ];
  if (blockerReasons.length) {
    return { outcomeCode: "blocked", blockerReasons, attentionReasons: [] };
  }

  const attentionReasons = [
    ...(semanticRecovery != null && Number(semanticRecovery) < DRAFT_QUALITY_TARGETS.semanticRecovery ? ["semantic_recovery_below_target"] : []),
    ...(requiredConceptRecall != null && Number(requiredConceptRecall) < DRAFT_QUALITY_TARGETS.requiredConceptRecall ? ["required_concept_recall_below_target"] : []),
    ...(claimPrecision != null && Number(claimPrecision) < DRAFT_QUALITY_TARGETS.narrativeClaimPrecision ? ["claim_precision_below_target"] : []),
    ...(protectedFactAccuracy != null && Number(protectedFactAccuracy) < DRAFT_QUALITY_TARGETS.criticalFieldPreservation ? ["critical_field_preservation_below_target"] : []),
    ...(formatReadiness != null && Number(formatReadiness) < DRAFT_QUALITY_TARGETS.formatReadiness ? ["format_readiness_below_target"] : []),
  ];
  return {
    outcomeCode: attentionReasons.length ? "needs_attention" : "ready_for_review",
    blockerReasons: [],
    attentionReasons,
  };
}
