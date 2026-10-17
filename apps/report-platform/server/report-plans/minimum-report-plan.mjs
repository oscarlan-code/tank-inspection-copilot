import { createHash } from 'node:crypto';
import { deepFreeze } from '../section-agents/generator-runtime.mjs';
import {
  SECTION_EVIDENCE_SNAPSHOT_CONTRACT,
  validateSectionEvidenceSnapshot,
} from './section-evidence-snapshot.mjs';

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
  evidenceRouterBinding = null,
}) {
  const binding = {
    agentId: requiredText(agentBinding?.agentId, 'Agent ID'),
    releaseVersion: requiredText(agentBinding?.releaseVersion, 'Agent release version'),
    manifestSha256: requiredText(agentBinding?.manifestSha256, 'Agent manifest hash'),
    reportProfileId: requiredText(agentBinding?.reportProfileId, 'Agent report profile'),
    sectionId: requiredText(agentBinding?.sectionId, 'Agent section'),
  };
  if (binding.reportProfileId !== FIRST_REPORT_PROFILE) throw new Error('Unsupported minimum ReportPlan profile.');
  const routerBinding = evidenceRouterBinding == null ? null : {
    agentId: requiredText(evidenceRouterBinding.agentId, 'Evidence router agent ID'),
    releaseId: requiredText(evidenceRouterBinding.releaseId, 'Evidence router release ID'),
    manifestSha256: requiredText(evidenceRouterBinding.manifestSha256, 'Evidence router manifest hash'),
  };
  if (routerBinding && (routerBinding.agentId !== 'report-evidence-router'
      || !/^[a-f0-9]{64}$/.test(routerBinding.manifestSha256))) {
    throw new Error('Unsupported Report Evidence Routing Agent binding.');
  }
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
    ...(routerBinding ? { evidenceRouterBinding: routerBinding } : {}),
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
  if (plan.evidenceRouterBinding !== undefined) {
    if (plan.evidenceRouterBinding?.agentId !== 'report-evidence-router'
        || typeof plan.evidenceRouterBinding.releaseId !== 'string'
        || !plan.evidenceRouterBinding.releaseId
        || !/^[a-f0-9]{64}$/.test(String(plan.evidenceRouterBinding.manifestSha256 ?? ''))) {
      throw new Error('ReportPlan has an invalid Report Evidence Routing Agent binding.');
    }
  }
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
  const routedSnapshot = evidenceSnapshot?.contractVersion === SECTION_EVIDENCE_SNAPSHOT_CONTRACT;
  if (routedSnapshot) validateSectionEvidenceSnapshot(evidenceSnapshot, { sectionId: section.sectionId });
  else if (!evidenceSnapshot?.exportPackage?.inspectionId || !evidenceSnapshot?.exportPackage?.inspectionRecord) {
    throw new Error('A current imported inspection evidence snapshot is required.');
  }
  if (routedSnapshot !== Boolean(reportPlan.evidenceRouterBinding)) {
    throw new Error('ReportPlan and SectionPlan must agree on whether routed section evidence is required.');
  }
  if (routedSnapshot && canonicalSha256({
    agentId: evidenceSnapshot.routerBinding.agentId,
    releaseId: evidenceSnapshot.routerBinding.releaseId,
    manifestSha256: evidenceSnapshot.routerBinding.manifestSha256,
  }) !== canonicalSha256(reportPlan.evidenceRouterBinding)) {
    throw new Error('Section evidence snapshot does not match the ReportPlan router binding.');
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
    ...(routedSnapshot ? { evidenceBinding: {
      contractVersion: SECTION_EVIDENCE_SNAPSHOT_CONTRACT,
      routerReleaseId: evidenceSnapshot.routerBinding.releaseId,
      routerReleaseManifestSha256: evidenceSnapshot.routerBinding.manifestSha256,
      routingManifestSha256: evidenceSnapshot.routerBinding.routingManifestSha256,
      routingManifestHash: evidenceSnapshot.routerBinding.routingManifestHash,
      sectionProjectionSha256: evidenceSnapshot.routerBinding.sectionProjectionSha256,
      inputPackageHash: evidenceSnapshot.sourceImport.inputPackageHash,
    } } : {}),
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
  const routedSnapshot = evidenceSnapshot?.contractVersion === SECTION_EVIDENCE_SNAPSHOT_CONTRACT;
  if (routedSnapshot) {
    validateSectionEvidenceSnapshot(evidenceSnapshot, { sectionId: section.sectionId });
    if (!reportPlan.evidenceRouterBinding || !sectionPlan.evidenceBinding
        || sectionPlan.evidenceBinding.contractVersion !== SECTION_EVIDENCE_SNAPSHOT_CONTRACT
        || sectionPlan.evidenceBinding.routerReleaseId !== reportPlan.evidenceRouterBinding.releaseId
        || sectionPlan.evidenceBinding.routerReleaseManifestSha256 !== reportPlan.evidenceRouterBinding.manifestSha256
        || sectionPlan.evidenceBinding.routingManifestSha256 !== evidenceSnapshot.routerBinding.routingManifestSha256
        || sectionPlan.evidenceBinding.routingManifestHash !== evidenceSnapshot.routerBinding.routingManifestHash
        || sectionPlan.evidenceBinding.sectionProjectionSha256 !== evidenceSnapshot.routerBinding.sectionProjectionSha256
        || sectionPlan.evidenceBinding.inputPackageHash !== evidenceSnapshot.sourceImport.inputPackageHash) {
      throw new Error('SectionPlan does not carry the exact routed-evidence binding.');
    }
  } else if (reportPlan.evidenceRouterBinding || sectionPlan.evidenceBinding) {
    throw new Error('Legacy evidence cannot satisfy a routed-evidence ReportPlan.');
  }
  if (canonicalSha256(sectionPlan.agentBinding) !== canonicalSha256(section.agentBinding)) {
    throw new Error('SectionPlan agent binding does not match the ReportPlan.');
  }
  return section;
}
