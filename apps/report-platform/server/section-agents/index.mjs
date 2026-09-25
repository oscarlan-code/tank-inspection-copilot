import { canonicalSha256, validateMinimumReportPlan, validateMinimumSectionPlan } from '../report-plans/minimum-report-plan.mjs';
import { deepFreeze, runFrozenSectionAgent, runPlannedFrozenSectionAgent } from './frozen-release.mjs';

// Append explicit section/version entries. Never replace an existing release or
// resolve "latest". A new section owns its own prompts, KB snapshot and dependencies.
export const SECTION_AGENT_RELEASES = deepFreeze({
  scope_of_inspection_v1: {
    agentId: 'scope_of_inspection',
    version: 'scope_of_inspection_v1',
    sectionId: 'scope-of-inspection',
    reportProfileIds: ['vertical_tank_inspection_v1'],
    rootUrl: new URL('./releases/scope-of-inspection/v1/', import.meta.url).href,
    manifestSha256: '5f836136c4da5fa68cafa385ae5ada7d9e082ca38dd8d3b36d6126a02d2f7f55',
  },
  general_tank_information_v1: {
    agentId: 'general_tank_information',
    version: 'general_tank_information_v1',
    sectionId: 'general-tank-information',
    reportProfileIds: ['vertical_tank_inspection_v1'],
    rootUrl: new URL('./releases/general-tank-information/v1/', import.meta.url).href,
    manifestSha256: 'de8e7b1e980bfbd9777f05768f1996cc8bff08171f48177495eacc1af6a6fb43',
  },
  general_tank_information_v2: {
    agentId: 'general_tank_information',
    version: 'general_tank_information_v2',
    sectionId: 'general-tank-information',
    reportProfileIds: ['vertical_tank_inspection_v1'],
    rootUrl: new URL('./releases/general-tank-information/v2/', import.meta.url).href,
    manifestSha256: '1f8a904ab31719c836888600a401ad919b62bba100d564c9b32a292390bfce9b',
  },
});

export function resolveSectionAgentRelease({ releaseVersion, sectionId, reportProfileId }) {
  if (typeof releaseVersion !== 'string' || releaseVersion === 'latest') throw new Error('Unsupported section-agent release.');
  const release = Object.hasOwn(SECTION_AGENT_RELEASES, releaseVersion) ? SECTION_AGENT_RELEASES[releaseVersion] : null;
  if (!release || release.sectionId !== sectionId || !release.reportProfileIds.includes(reportProfileId)) {
    throw new Error('Unsupported section-agent release, profile or section.');
  }
  return release;
}

export function getSectionAgentBinding({ releaseVersion, sectionId, reportProfileId }) {
  const release = resolveSectionAgentRelease({ releaseVersion, sectionId, reportProfileId });
  return deepFreeze({ agentId: release.agentId, releaseVersion: release.version,
    manifestSha256: release.manifestSha256, reportProfileId, sectionId });
}

export async function runSectionAgent({ sectionAgentVersion, executionMode, sectionId, reportState }) {
  if (executionMode !== 'evaluation') throw new Error('This section agent awaits review before product promotion.');
  const release = Object.hasOwn(SECTION_AGENT_RELEASES, sectionAgentVersion) ? SECTION_AGENT_RELEASES[sectionAgentVersion] : null;
  if (!release || release.sectionId !== sectionId) throw new Error('Unsupported section agent or section.');
  if (['general_tank_information_v2', 'scope_of_inspection_v1'].includes(sectionAgentVersion)) {
    throw new Error('This release requires a frozen ReportPlan and SectionPlan.');
  }
  return runFrozenSectionAgent({ release, executionMode, sectionId, reportState });
}

export async function executePlannedSection({ reportPlan, sectionInstanceId, sectionPlan, evidenceSnapshot, executionMode }) {
  if (executionMode !== 'evaluation' || reportPlan?.executionMode !== executionMode) {
    throw new Error('This planned section agent awaits review before product promotion.');
  }
  const section = validateMinimumReportPlan(reportPlan);
  if (section.sectionInstanceId !== sectionInstanceId) throw new Error('Section instance is not selected by this ReportPlan.');
  validateMinimumSectionPlan({ reportPlan, sectionPlan, evidenceSnapshot });
  const binding = section.agentBinding;
  if (canonicalSha256(sectionPlan.agentBinding) !== canonicalSha256(binding)) {
    throw new Error('SectionPlan does not carry the exact ReportPlan agent binding.');
  }
  const release = resolveSectionAgentRelease({ releaseVersion: binding.releaseVersion,
    sectionId: section.sectionId, reportProfileId: reportPlan.reportProfileId });
  if (binding.agentId !== release.agentId || binding.manifestSha256 !== release.manifestSha256) {
    throw new Error('ReportPlan agent binding does not match the server-owned registry.');
  }
  return runPlannedFrozenSectionAgent({ release, executionMode, reportPlan, sectionPlan, evidenceSnapshot });
}
