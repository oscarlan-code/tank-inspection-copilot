import { createHash } from 'node:crypto';
import { validateSectionEvidencePackage } from '../contents-classification-agent/evaluation-pathway.mjs';

export const PACKAGE_BOUND_REPORT_PLAN_CONTRACT = 'package_bound_report_plan_v1';
export const PACKAGE_BOUND_SECTION_PLAN_CONTRACT = 'package_bound_section_plan_v1';
export const VERTICAL_TANK_REPORT_PROFILE = 'vertical_tank_inspection_v1';

const SHA256 = /^[a-f0-9]{64}$/;
const forbiddenKeys = new Set([
  'gold', 'hiddenGold', 'validationGold', 'originalSection', 'expectedSection',
  'referenceAnswer', 'sourceReportPage',
]);

const canonicalize = (value) => Array.isArray(value) ? value.map(canonicalize)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
    : value;

export const packageBoundSha256 = (value) => createHash('sha256')
  .update(JSON.stringify(canonicalize(value))).digest('hex');

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function requiredText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function assertNoGold(value, path = 'plan') {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) throw new Error(`Evaluator-only gold is prohibited at ${path}.${key}.`);
    assertNoGold(item, `${path}.${key}`);
  }
}

function withoutHash(value, key) {
  const copy = structuredClone(value);
  delete copy[key];
  return copy;
}

function exactBinding(binding) {
  const result = {
    candidateId: requiredText(binding?.candidateId, 'Candidate ID'),
    candidateManifestSha256: requiredText(binding?.candidateManifestSha256, 'Candidate manifest hash'),
    sectionId: requiredText(binding?.sectionId, 'Candidate section ID'),
    reportProfileId: requiredText(binding?.reportProfileId, 'Candidate report profile'),
    generatorId: requiredText(binding?.generatorId, 'Generator ID'),
    reviewerId: requiredText(binding?.reviewerId, 'Reviewer ID'),
    evaluatorId: requiredText(binding?.evaluatorId, 'Evaluator ID'),
    knowledgeBundleId: requiredText(binding?.knowledgeBundleId, 'Knowledge bundle ID'),
    knowledgeBundleSha256: requiredText(binding?.knowledgeBundleSha256, 'Knowledge bundle hash'),
    standardObligationPackId: requiredText(binding?.standardObligationPackId, 'Standard obligation pack ID'),
    standardObligationPackSha256: requiredText(binding?.standardObligationPackSha256, 'Standard obligation pack hash'),
  };
  for (const key of ['candidateManifestSha256', 'knowledgeBundleSha256', 'standardObligationPackSha256']) {
    if (!SHA256.test(result[key])) throw new Error(`${key} must be a SHA-256 value.`);
  }
  return result;
}

export function buildPackageBoundReportPlan({
  reportPlanId,
  tenantId,
  workspaceId,
  reportJobId,
  importRevisionId,
  candidateBinding,
}) {
  const binding = exactBinding(candidateBinding);
  if (binding.reportProfileId !== VERTICAL_TANK_REPORT_PROFILE
      || binding.sectionId !== 'general-tank-information') {
    throw new Error('The first package-bound plan supports General Tank Information only.');
  }
  const plan = {
    contractVersion: PACKAGE_BOUND_REPORT_PLAN_CONTRACT,
    reportPlanId: requiredText(reportPlanId, 'ReportPlan ID'),
    revision: 1,
    status: 'reviewed_frozen_for_evaluation',
    executionMode: 'evaluation',
    productEnabled: false,
    planningAuthority: 'evaluation_harness',
    tenantId: requiredText(tenantId, 'Tenant ID'),
    workspaceId: requiredText(workspaceId, 'Workspace ID'),
    reportJobId: requiredText(reportJobId, 'Report job ID'),
    importRevisionId: requiredText(importRevisionId, 'Import revision ID'),
    reportProfileId: VERTICAL_TANK_REPORT_PROFILE,
    sections: [{
      sectionInstanceId: 'general-tank-information:1',
      order: 3,
      sectionId: 'general-tank-information',
      title: '3 GENERAL TANK INFORMATION',
      applicability: { status: 'applicable', decidedBy: 'authorized_evaluation_review' },
      candidateBinding: binding,
    }],
  };
  assertNoGold(plan);
  plan.reportPlanSha256 = packageBoundSha256(plan);
  return freeze(plan);
}

export function validatePackageBoundReportPlan(plan) {
  if (!plan || plan.contractVersion !== PACKAGE_BOUND_REPORT_PLAN_CONTRACT
      || plan.status !== 'reviewed_frozen_for_evaluation'
      || plan.executionMode !== 'evaluation' || plan.productEnabled !== false
      || plan.planningAuthority !== 'evaluation_harness'
      || plan.reportProfileId !== VERTICAL_TANK_REPORT_PROFILE
      || plan.sections?.length !== 1) {
    throw new Error('Unsupported or unfrozen package-bound ReportPlan.');
  }
  const section = plan.sections[0];
  const binding = exactBinding(section.candidateBinding);
  if (section.sectionInstanceId !== 'general-tank-information:1' || section.order !== 3
      || section.sectionId !== 'general-tank-information'
      || section.title !== '3 GENERAL TANK INFORMATION'
      || section.applicability?.status !== 'applicable'
      || binding.sectionId !== section.sectionId
      || binding.reportProfileId !== plan.reportProfileId) {
    throw new Error('Package-bound ReportPlan section binding is invalid.');
  }
  if (packageBoundSha256(withoutHash(plan, 'reportPlanSha256')) !== plan.reportPlanSha256) {
    throw new Error('Package-bound ReportPlan hash does not match its content.');
  }
  assertNoGold(plan);
  return section;
}

export function buildPackageBoundSectionPlan({ reportPlan, sectionEvidencePackage }) {
  const section = validatePackageBoundReportPlan(reportPlan);
  validateSectionEvidencePackage(sectionEvidencePackage, { sectionId: section.sectionId });
  const plan = {
    contractVersion: PACKAGE_BOUND_SECTION_PLAN_CONTRACT,
    sectionPlanId: `${reportPlan.reportPlanId}:${section.sectionInstanceId}:r1`,
    revision: 1,
    status: 'frozen_for_evaluation_generation',
    executionMode: 'evaluation',
    productEnabled: false,
    reportPlanId: reportPlan.reportPlanId,
    reportPlanSha256: reportPlan.reportPlanSha256,
    reportProfileId: reportPlan.reportProfileId,
    sectionInstanceId: section.sectionInstanceId,
    sectionId: section.sectionId,
    title: section.title,
    importRevisionId: reportPlan.importRevisionId,
    sectionEvidencePackageSha256: sectionEvidencePackage.packageSha256,
    inputPackageHash: sectionEvidencePackage.inputPackageHash,
    sealedClassificationDecisionsSha256: sectionEvidencePackage.sealedDecisionsSha256,
    classifierReleaseBinding: structuredClone(sectionEvidencePackage.classifierReleaseBinding),
    candidateBinding: structuredClone(section.candidateBinding),
    completenessGate: {
      requiredFields: ['client', 'tankNumber', 'location', 'height', 'diameter', 'courseNumber'],
      conflictPolicy: 'block',
      missingRequiredPolicy: 'block',
      unsupportedEvidencePolicy: 'block',
      unitPolicy: 'preserve_explicit_source_unit',
    },
    approvalState: 'not_approved',
  };
  assertNoGold(plan);
  plan.sectionPlanSha256 = packageBoundSha256(plan);
  return freeze(plan);
}

export function validatePackageBoundSectionPlan({ reportPlan, sectionPlan, sectionEvidencePackage, candidateBinding = null }) {
  const section = validatePackageBoundReportPlan(reportPlan);
  validateSectionEvidencePackage(sectionEvidencePackage, { sectionId: section.sectionId });
  if (!sectionPlan || sectionPlan.contractVersion !== PACKAGE_BOUND_SECTION_PLAN_CONTRACT
      || sectionPlan.status !== 'frozen_for_evaluation_generation'
      || sectionPlan.executionMode !== 'evaluation' || sectionPlan.productEnabled !== false
      || sectionPlan.approvalState !== 'not_approved') {
    throw new Error('Unsupported or unfrozen package-bound SectionPlan.');
  }
  if (sectionPlan.reportPlanId !== reportPlan.reportPlanId
      || sectionPlan.reportPlanSha256 !== reportPlan.reportPlanSha256
      || sectionPlan.reportProfileId !== reportPlan.reportProfileId
      || sectionPlan.sectionInstanceId !== section.sectionInstanceId
      || sectionPlan.sectionId !== section.sectionId
      || sectionPlan.title !== section.title
      || sectionPlan.importRevisionId !== reportPlan.importRevisionId
      || sectionPlan.sectionEvidencePackageSha256 !== sectionEvidencePackage.packageSha256
      || sectionPlan.inputPackageHash !== sectionEvidencePackage.inputPackageHash
      || sectionPlan.sealedClassificationDecisionsSha256 !== sectionEvidencePackage.sealedDecisionsSha256
      || packageBoundSha256(sectionPlan.classifierReleaseBinding) !== packageBoundSha256(sectionEvidencePackage.classifierReleaseBinding)
      || packageBoundSha256(sectionPlan.candidateBinding) !== packageBoundSha256(section.candidateBinding)) {
    throw new Error('Package-bound SectionPlan does not match its ReportPlan or evidence package.');
  }
  if (candidateBinding && packageBoundSha256(sectionPlan.candidateBinding) !== packageBoundSha256(exactBinding(candidateBinding))) {
    throw new Error('SectionPlan does not match the exact sandbox candidate binding.');
  }
  if (packageBoundSha256(withoutHash(sectionPlan, 'sectionPlanSha256')) !== sectionPlan.sectionPlanSha256) {
    throw new Error('Package-bound SectionPlan hash does not match its content.');
  }
  assertNoGold(sectionPlan);
  return section;
}

export function buildPackageBoundGenerationExecution({ reportPlan, sectionPlan, sectionEvidencePackage }) {
  validatePackageBoundSectionPlan({ reportPlan, sectionPlan, sectionEvidencePackage });
  return freeze({
    contractVersion: 'package_bound_section_generation_execution_v1',
    executionMode: 'evaluation',
    productEnabled: false,
    reportPlan,
    sectionPlan,
    sectionEvidencePackage,
  });
}

export const __test = { assertNoGold, canonicalize, exactBinding };
