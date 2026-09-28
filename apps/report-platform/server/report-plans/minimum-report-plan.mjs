import { createHash } from 'node:crypto';
import { deepFreeze } from '../section-agents/generator-runtime.mjs';

export const REPORT_PLAN_CONTRACT = 'report_plan_v1';
export const SECTION_PLAN_CONTRACT = 'section_plan_execution_v1';
export const FIRST_REPORT_PROFILE = 'vertical_tank_inspection_v1';

const MINIMUM_SECTION_CONFIGS = deepFreeze({
  'scope-of-inspection': {
    sectionInstanceId: 'scope-of-inspection:1',
    order: 1,
    title: 'SCOPE OF INSPECTION',
    authorizedInputLanes: [
      'native_v3_task_and_layout_evidence',
      'confirmed_scope_claims',
      'confirmed_scope_limitations',
      'confirmed_scope_references',
    ],
    historicalPatternPack: 'scope_of_inspection_pattern_pack_v1',
    standardObligationPack: 'scope_of_inspection_v1_reporting_boundary',
  },
  'general-tank-information': {
    sectionInstanceId: 'general-tank-information:1',
    order: 3,
    title: 'GENERAL TANK INFORMATION',
    authorizedInputLanes: [
      'native_inspection_record_identity',
      'native_task_identity',
      'confirmed_report_side_general_information',
      'confirmed_same_asset_history',
    ],
    historicalPatternPack: 'general_tank_information_v2_no_runtime_retrieval',
    standardObligationPack: 'general_tank_information_v1_not_applicable',
  },
});

function minimumSectionConfig(sectionId) {
  const config = MINIMUM_SECTION_CONFIGS[sectionId];
  if (!config) throw new Error('The minimum ReportPlan does not support this section agent.');
  return config;
}

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
  if (binding.reportProfileId !== FIRST_REPORT_PROFILE) throw new Error('Unsupported minimum ReportPlan profile.');
  const config = minimumSectionConfig(binding.sectionId);
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
      sectionInstanceId: config.sectionInstanceId,
      order: config.order,
      sectionId: binding.sectionId,
      title: config.title,
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
  const config = minimumSectionConfig(section.sectionId);
  if (section.sectionInstanceId !== config.sectionInstanceId || section.order !== config.order
      || section.title !== config.title || section.applicability?.status !== 'applicable'
      || section.agentBinding?.sectionId !== section.sectionId
      || section.agentBinding?.reportProfileId !== plan.reportProfileId) {
    throw new Error('Unsupported first-section ReportPlan entry.');
  }
  if (canonicalSha256(withoutHash(plan, 'reportPlanSha256')) !== plan.reportPlanSha256) {
    throw new Error('ReportPlan hash does not match its immutable content.');
  }
  return section;
}

export function buildMinimumSectionPlan({ reportPlan, sectionInstanceId, evidenceSnapshot }) {
  const section = validateMinimumReportPlan(reportPlan);
  const config = minimumSectionConfig(section.sectionId);
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
    authorizedInputLanes: config.authorizedInputLanes,
    historicalPatternPack: config.historicalPatternPack,
    standardObligationPack: config.standardObligationPack,
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
