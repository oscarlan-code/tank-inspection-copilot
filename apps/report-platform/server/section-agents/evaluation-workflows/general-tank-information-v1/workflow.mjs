import {
  buildSectionEvidencePackages,
  runContentsClassificationEvaluationPathway,
  sealContentsClassificationReview,
} from '../../../contents-classification-agent/evaluation-pathway.mjs';
import {
  buildPackageBoundGenerationExecution,
  buildPackageBoundReportPlan,
  buildPackageBoundSectionPlan,
} from '../../../report-plans/package-bound-section-plan.mjs';
import {
  evaluateSandboxCandidate,
  executeSandboxCandidate,
  getSandboxCandidateBinding,
} from '../../sandbox/candidate-registry.mjs';

export const SECTION_ID = 'general-tank-information';
export const ACTIVE_CANDIDATE_ID = 'general-tank-information-candidate-b';
export const REPORT_PROFILE_ID = 'vertical_tank_inspection_v1';

function requiredText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function rejectGold(input) {
  for (const key of ['gold', 'goldPacket', 'originalSection', 'referenceAnswer']) {
    if (Object.hasOwn(input, key)) throw new Error(`Generation preparation cannot receive ${key}.`);
  }
}

export async function prepareGeneralTankInformationRun(input = {}) {
  rejectGold(input);
  const context = input.context ?? {};
  const classified = await runContentsClassificationEvaluationPathway({
    rawExportBytes: input.rawExportBytes,
    exportPackage: input.exportPackage,
    androidReceipt: input.androidReceipt,
    lineageSecret: input.lineageSecret,
    referenceTextUnits: input.referenceTextUnits ?? [],
    narrativeWorker: input.narrativeWorker ?? null,
    modelId: input.modelId ?? null,
    generatedAtIso: input.generatedAtIso,
  });

  if (classified.runtimeRun.reviewQueue.length && input.reviewDecisions == null) {
    return Object.freeze({
      contractVersion: 'general_tank_information_section_workflow_v1',
      sectionId: SECTION_ID,
      candidateId: ACTIVE_CANDIDATE_ID,
      status: 'awaiting_authorized_classification_review',
      runtimeRun: classified.runtimeRun,
      evaluatorPrivate: classified.evaluatorPrivate,
      reviewQueue: classified.runtimeRun.reviewQueue,
      generationExecuted: false,
      productEnabled: false,
    });
  }

  const sealedDecisions = await sealContentsClassificationReview({
    runtimeRun: classified.runtimeRun,
    decisions: input.reviewDecisions ?? [],
    reviewer: input.reviewer,
  });
  const sectionEvidencePackage = buildSectionEvidencePackages({
    sealedDecisions,
    reviewedSectionSelection: [SECTION_ID],
  }).packages[0];
  const candidateBinding = await getSandboxCandidateBinding({
    candidateId: ACTIVE_CANDIDATE_ID,
    sectionId: SECTION_ID,
    reportProfileId: REPORT_PROFILE_ID,
    executionMode: 'evaluation',
  });
  const reportPlan = buildPackageBoundReportPlan({
    reportPlanId: requiredText(context.reportPlanId, 'ReportPlan ID'),
    tenantId: requiredText(context.tenantId, 'Tenant ID'),
    workspaceId: requiredText(context.workspaceId, 'Workspace ID'),
    reportJobId: requiredText(context.reportJobId, 'Report job ID'),
    importRevisionId: requiredText(context.importRevisionId, 'Import revision ID'),
    candidateBinding,
  });
  const sectionPlan = buildPackageBoundSectionPlan({ reportPlan, sectionEvidencePackage });
  const execution = buildPackageBoundGenerationExecution({ reportPlan, sectionPlan, sectionEvidencePackage });
  const candidateExecution = await executeSandboxCandidate({ execution });

  return Object.freeze({
    contractVersion: 'general_tank_information_section_workflow_v1',
    sectionId: SECTION_ID,
    candidateId: ACTIVE_CANDIDATE_ID,
    status: candidateExecution.displayEligible ? 'ready_for_sealed_gold_evaluation' : 'blocked_by_pre_display_review',
    runtimeRun: classified.runtimeRun,
    evaluatorPrivate: classified.evaluatorPrivate,
    sealedDecisions,
    sectionEvidencePackage,
    reportPlan,
    sectionPlan,
    candidateExecution,
    generationExecuted: true,
    productEnabled: false,
  });
}

export async function evaluateGeneralTankInformationRun({ preparedRun, goldPacket } = {}) {
  if (preparedRun?.contractVersion !== 'general_tank_information_section_workflow_v1'
      || preparedRun.status !== 'ready_for_sealed_gold_evaluation'
      || preparedRun.candidateId !== ACTIVE_CANDIDATE_ID) {
    throw new Error('Only a passed Candidate B generation run can enter sealed-gold evaluation.');
  }
  const evaluation = await evaluateSandboxCandidate({
    candidateExecution: preparedRun.candidateExecution,
    goldPacket,
  });
  return Object.freeze({
    contractVersion: 'general_tank_information_section_workflow_evaluation_v1',
    sectionId: SECTION_ID,
    candidateId: ACTIVE_CANDIDATE_ID,
    status: evaluation.qualificationStatus,
    decision: evaluation.decision,
    atomicRows: evaluation.atomicRows,
    sectionAssessment: evaluation.sectionAssessment,
    scores: evaluation.scores,
    evaluation,
    productEnabled: false,
  });
}
