import { createHash, randomUUID } from 'node:crypto';
import { validateSectionEvidencePackage } from '../../../../../../../contents-classification-agent/evaluation-pathway.mjs';
import { validatePackageBoundSectionPlan } from '../../../../../../../report-plans/package-bound-section-plan.mjs';
import {
  BODY_FIELDS,
  FIELD_COUNTS,
  REPORT_PROFILE_ID,
  SECTION_ID,
  SECTION_TITLE,
} from '../../generator/server/field-contract.mjs';
import { reportNodeText, sectionDocumentNodes } from '../../generator/server/report-document.mjs';

export const REVIEWER_ID = 'general-tank-information-reviewer-candidate-b';
export const GENERATOR_ID = 'general-tank-information-generator-candidate-b';

const canonical = (value) => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
const sha256 = (value) => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

function validateExecution(execution) {
  if (!execution || execution.contractVersion !== 'package_bound_section_review_execution_v1'
      || execution.executionMode !== 'evaluation' || execution.productEnabled !== false) {
    throw new Error('Unsupported package-bound pre-display review execution.');
  }
  if (Object.hasOwn(execution, 'gold') || Object.hasOwn(execution, 'goldPacket')
      || Object.hasOwn(execution, 'originalSection')) {
    throw new Error('Pre-display review cannot receive evaluator-only gold.');
  }
  validateSectionEvidencePackage(execution.sectionEvidencePackage, { sectionId: SECTION_ID });
  validatePackageBoundSectionPlan({
    reportPlan: execution.reportPlan,
    sectionPlan: execution.sectionPlan,
    sectionEvidencePackage: execution.sectionEvidencePackage,
  });
  const generated = execution.generationResult;
  if (execution.sectionPlan.candidateBinding.reviewerId !== REVIEWER_ID
      || generated?.contractVersion !== 'package_bound_section_generation_result_v1'
      || generated.candidate?.generatorId !== GENERATOR_ID
      || generated.section?.sectionId !== SECTION_ID
      || generated.section?.reportProfileId !== REPORT_PROFILE_ID
      || generated.sectionPlanRef?.sectionPlanSha256 !== execution.sectionPlan.sectionPlanSha256
      || generated.sectionPlanRef?.sectionEvidencePackageSha256 !== execution.sectionEvidencePackage.packageSha256) {
    throw new Error('Pre-display review is not bound to the expected plan, package and generator.');
  }
}

export function reviewGeneralTankInformation(execution) {
  validateExecution(execution);
  const inputSha256 = sha256(execution);
  const generated = execution.generationResult;
  const blockers = [];
  const warnings = [...(generated.validation?.warnings ?? [])];
  if (generated.validation?.valid !== true) blockers.push('Generator completeness or validation gate did not pass.');
  if (generated.draft?.approved !== false || generated.draft?.reviewRequired !== true
      || generated.draft?.userVisibility !== 'blocked_pending_pre_display_review') {
    blockers.push('Generated draft approval or visibility state is invalid.');
  }
  const checks = generated.validation?.checks ?? {};
  if (checks.packageBoundInputUsed !== true || checks.classifierHumanReviewComplete !== true) {
    blockers.push('Generator did not use a human-reviewed section evidence package.');
  }
  if (checks.runtimeRetrievalUsed !== false || checks.liveModelUsed !== false || checks.promptUsed !== false
      || checks.currentFactsFromHistoricalSources !== false) {
    blockers.push('Structured-section model, prompt or historical-fact boundary was violated.');
  }

  const nodes = sectionDocumentNodes(generated.draft?.document);
  const heading = nodes.find((node) => node.tag === 'h2');
  if (normalize(reportNodeText(heading)) !== SECTION_TITLE) blockers.push('Section title does not match the frozen plan.');
  const formatTables = nodes.filter((node) => node.tag === 'table' && node.attrs?.['data-report-format'] === 'paired-fields');
  if (formatTables.length !== 2) blockers.push('The reviewed paired-field body and history tables are required.');

  const evidenceNodes = nodes.filter((node) => node.attrs?.['data-evidence-id']);
  const generatedFields = new Map((generated.evaluationEvidence?.fields ?? []).map((field) => [field.key, field]));
  for (const definition of BODY_FIELDS) {
    const field = generatedFields.get(definition.key);
    const id = `general-info:${definition.key}`;
    const matches = evidenceNodes.filter((node) => node.attrs['data-evidence-id'] === id);
    if (!field) { blockers.push(`Generator trace is missing ${definition.key}.`); continue; }
    if (matches.length !== 1) { blockers.push(`${id} must appear exactly once.`); continue; }
    const wanted = normalize(`➢ ${definition.label}: ${field.displayValue}`);
    if (normalize(reportNodeText(matches[0])) !== wanted) blockers.push(`${id} changed its label, value or source unit.`);
    if (matches[0].attrs?.['data-source-evidence-ids'] !== field.sourceEvidenceIds.join(',')) {
      blockers.push(`${id} has incorrect source evidence IDs.`);
    }
    const expectedProvenance = field.sourceEvidenceIds.length ? 'reviewed_app_evidence' : 'not_recorded';
    if (matches[0].attrs?.['data-laiq-provenance'] !== expectedProvenance) blockers.push(`${id} has incorrect provenance.`);
  }
  if (evidenceNodes.length !== FIELD_COUNTS.body) blockers.push(`Expected ${FIELD_COUNTS.body} body fields; received ${evidenceNodes.length}.`);

  const packageIds = new Set(execution.sectionEvidencePackage.evidenceRecords.map((record) => record.evidenceId));
  const dispositions = generated.evaluationEvidence?.evidenceDisposition ?? [];
  const dispositionIds = new Set();
  for (const row of dispositions) {
    if (!row?.evidenceId || dispositionIds.has(row.evidenceId)) blockers.push('Evidence disposition IDs must be present and unique.');
    else dispositionIds.add(row.evidenceId);
    if (!packageIds.has(row?.evidenceId)) blockers.push(`Disposition references unprojected evidence ${row?.evidenceId}.`);
    if (!['rendered', 'report_header', 'applicability_only', 'support_only', 'blocked_unsupported'].includes(row?.status)) {
      blockers.push(`Evidence ${row?.evidenceId} has an unsupported disposition.`);
    }
  }
  for (const evidenceId of packageIds) if (!dispositionIds.has(evidenceId)) blockers.push(`Evidence ${evidenceId} was silently omitted.`);
  if (dispositions.length !== execution.sectionEvidencePackage.evidenceRecords.length) {
    blockers.push('Evidence disposition coverage is incomplete.');
  }
  if (generated.evaluationEvidence?.unaccountedEvidenceIds?.length) blockers.push('Generator reports unaccounted evidence.');

  const bodyText = normalize(generated.draft?.content);
  for (const support of generated.evaluationEvidence?.supportingEvidence ?? []) {
    if (support.sourceEvidenceIds.length && support.displayValue !== 'Not recorded'
        && bodyText.includes(normalize(`${support.label}: ${support.displayValue}`))) {
      blockers.push(`${support.key} was printed despite its applicability/support-only disposition.`);
    }
  }
  if (sha256(execution) !== inputSha256) throw new Error('Pre-display reviewer mutated its input.');
  const decision = blockers.length ? 'blocked' : 'ready_for_review';
  return {
    contractVersion: 'package_bound_section_review_result_v1',
    reviewer: { reviewerId: REVIEWER_ID, candidateId: execution.sectionPlan.candidateBinding.candidateId },
    section: { sectionId: SECTION_ID, generatorId: GENERATOR_ID },
    decision,
    userVisibility: decision === 'ready_for_review' ? 'allowed' : 'blocked',
    approvalStatus: 'not_approved',
    checks: {
      generatorValid: generated.validation?.valid === true,
      exactTitle: normalize(reportNodeText(heading)) === SECTION_TITLE,
      protectedBodyFieldCount: FIELD_COUNTS.body,
      observedBodyFieldCount: evidenceNodes.length,
      projectedEvidenceCount: execution.sectionEvidencePackage.evidenceRecords.length,
      dispositionCount: dispositions.length,
      formatValid: formatTables.length === 2,
      evidenceGrounded: blockers.every((item) => !/(source evidence|silently omitted|disposition|changed its label)/i.test(item)),
      knowledgeBoundaryValid: checks.currentFactsFromHistoricalSources === false && checks.runtimeRetrievalUsed === false,
      goldUsed: false,
      liveModelUsed: false,
    },
    blockers,
    warnings,
    claimTrace: [...packageIds].map((evidenceId) => ({
      evidenceId,
      source: 'reviewed_section_evidence_package',
      status: blockers.some((item) => item.includes(evidenceId)) ? 'failed' : 'verified',
    })),
    trace: {
      reviewRunId: randomUUID(),
      reviewedAtIso: new Date().toISOString(),
      generationRunId: generated.trace?.generationRunId ?? null,
      generationResultSha256: sha256(generated),
      sectionEvidencePackageSha256: execution.sectionEvidencePackage.packageSha256,
      goldAccessed: false,
      providerCode: 'deterministic',
      modelId: null,
    },
  };
}

