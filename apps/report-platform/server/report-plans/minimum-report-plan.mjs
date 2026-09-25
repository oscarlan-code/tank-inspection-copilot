import { createHash } from 'node:crypto';
import { deepFreeze } from '../section-agents/frozen-release.mjs';

export const REPORT_PLAN_CONTRACT = 'report_plan_v1';
export const SECTION_PLAN_CONTRACT = 'section_plan_execution_v1';
export const FIRST_REPORT_PROFILE = 'vertical_tank_inspection_v1';

const requiredText = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
};

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  return value;
}

export const canonicalSha256 = value => createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');

function withoutHash(value, key) {
  const clone = structuredClone(value);
  delete clone[key];
  return clone;
}

export function buildMinimumReportPlan({
  reportPlanId,
  tenantId,
  workspaceId,
  reportJobId,
  importRevisionId,
  agentBinding,
}) {
  const binding = {
    agentId: requiredText(agentBinding?.agentId, 'Agent ID'),
    releaseVersion: requiredText(agentBinding?.releaseVersion, 'Agent release version'),
    manifestSha256: requiredText(agentBinding?.manifestSha256, 'Agent manifest hash'),
    reportProfileId: requiredText(agentBinding?.reportProfileId, 'Agent report profile'),
    sectionId: requiredText(agentBinding?.sectionId, 'Agent section'),
  };
  if (binding.reportProfileId !== FIRST_REPORT_PROFILE || binding.sectionId !== 'general-tank-information') {
    throw new Error('The minimum ReportPlan supports only the first vertical-tank section agent.');
  }
  const plan = {
    contractVersion: REPORT_PLAN_CONTRACT,
    reportPlanId: requiredText(reportPlanId, 'ReportPlan ID'),
    revision: 1,
    status: 'reviewed_frozen',
    executionMode: 'evaluation',
    tenantId: requiredText(tenantId, 'Tenant ID'),
    workspaceId: requiredText(workspaceId, 'Workspace ID'),
    reportJobId: requiredText(reportJobId, 'Report job ID'),
    importRevisionId: requiredText(importRevisionId, 'Import revision ID'),
    reportProfileId: FIRST_REPORT_PROFILE,
    sections: [{
      sectionInstanceId: 'general-tank-information:1',
      order: 3,
      sectionId: 'general-tank-information',
      title: 'GENERAL TANK INFORMATION',
      applicability: { status: 'applicable', decidedBy: 'evaluation_harness' },
      agentBinding: binding,
    }],
  };
  plan.reportPlanSha256 = canonicalSha256(plan);
  return deepFreeze(plan);
}

export function validateMinimumReportPlan(plan) {
  if (!plan || plan.contractVersion !== REPORT_PLAN_CONTRACT || plan.status !== 'reviewed_frozen'
      || plan.executionMode !== 'evaluation' || plan.reportProfileId !== FIRST_REPORT_PROFILE) {
    throw new Error('Unsupported or unfrozen ReportPlan.');
  }
  if (plan.sections?.length !== 1) throw new Error('The minimum ReportPlan must contain exactly one section instance.');
  const section = plan.sections[0];
  if (section.sectionInstanceId !== 'general-tank-information:1' || section.sectionId !== 'general-tank-information'
      || section.order !== 3 || section.applicability?.status !== 'applicable') {
    throw new Error('Unsupported first-section ReportPlan entry.');
  }
  if (canonicalSha256(withoutHash(plan, 'reportPlanSha256')) !== plan.reportPlanSha256) {
    throw new Error('ReportPlan hash does not match its immutable content.');
  }
  return section;
}

export function buildMinimumSectionPlan({ reportPlan, sectionInstanceId, evidenceSnapshot }) {
  const section = validateMinimumReportPlan(reportPlan);
  if (section.sectionInstanceId !== sectionInstanceId) throw new Error('Section instance is not in the ReportPlan.');
  if (!evidenceSnapshot?.exportPackage?.inspectionId || !evidenceSnapshot?.exportPackage?.inspectionRecord) {
    throw new Error('A current imported inspection evidence snapshot is required.');
  }
  const sectionPlan = {
    contractVersion: SECTION_PLAN_CONTRACT,
    sectionPlanId: `${reportPlan.reportPlanId}:${sectionInstanceId}:r1`,
    revision: 1,
    status: 'frozen_for_generation',
    reportPlanId: reportPlan.reportPlanId,
    reportPlanSha256: reportPlan.reportPlanSha256,
    sectionInstanceId,
    sectionId: section.sectionId,
    reportProfileId: reportPlan.reportProfileId,
    importRevisionId: reportPlan.importRevisionId,
    evidenceSnapshotSha256: canonicalSha256(evidenceSnapshot),
    authorizedInputLanes: [
      'native_inspection_record_identity',
      'native_task_identity',
      'confirmed_report_side_general_information',
      'confirmed_same_asset_history',
    ],
    historicalPatternPack: 'general_tank_information_v2_no_runtime_retrieval',
    standardObligationPack: 'general_tank_information_v1_not_applicable',
    agentBinding: section.agentBinding,
    approvalState: 'not_approved',
  };
  sectionPlan.sectionPlanSha256 = canonicalSha256(sectionPlan);
  return deepFreeze(sectionPlan);
}

export function validateMinimumSectionPlan({ reportPlan, sectionPlan, evidenceSnapshot }) {
  const section = validateMinimumReportPlan(reportPlan);
  if (!sectionPlan || sectionPlan.contractVersion !== SECTION_PLAN_CONTRACT || sectionPlan.status !== 'frozen_for_generation') {
    throw new Error('Unsupported or unfrozen SectionPlan.');
  }
  if (sectionPlan.reportPlanId !== reportPlan.reportPlanId || sectionPlan.reportPlanSha256 !== reportPlan.reportPlanSha256
      || sectionPlan.sectionInstanceId !== section.sectionInstanceId || sectionPlan.sectionId !== section.sectionId
      || sectionPlan.reportProfileId !== reportPlan.reportProfileId || sectionPlan.importRevisionId !== reportPlan.importRevisionId) {
    throw new Error('SectionPlan does not match the ReportPlan.');
  }
  if (canonicalSha256(withoutHash(sectionPlan, 'sectionPlanSha256')) !== sectionPlan.sectionPlanSha256) {
    throw new Error('SectionPlan hash does not match its immutable content.');
  }
  if (canonicalSha256(evidenceSnapshot) !== sectionPlan.evidenceSnapshotSha256) {
    throw new Error('Evidence snapshot does not match the frozen SectionPlan.');
  }
  if (canonicalSha256(sectionPlan.agentBinding) !== canonicalSha256(section.agentBinding)) {
    throw new Error('SectionPlan agent binding does not match the ReportPlan.');
  }
  return section;
}
