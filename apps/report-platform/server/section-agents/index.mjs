import { deepFreeze, runFrozenSectionAgent } from './frozen-release.mjs';

// Append explicit section/version entries. Never replace an existing release or
// resolve "latest". A new section owns its own prompts, KB snapshot and dependencies.
export const SECTION_AGENT_RELEASES = deepFreeze({
  general_tank_information_v1: {
    version: 'general_tank_information_v1',
    sectionId: 'general-tank-information',
    rootUrl: new URL('./releases/general-tank-information/v1/', import.meta.url).href,
    manifestSha256: 'de8e7b1e980bfbd9777f05768f1996cc8bff08171f48177495eacc1af6a6fb43',
  },
});

export async function runSectionAgent({ sectionAgentVersion, executionMode, sectionId, reportState }) {
  if (executionMode !== 'evaluation') throw new Error('This section agent awaits review before product promotion.');
  const release = Object.hasOwn(SECTION_AGENT_RELEASES, sectionAgentVersion) ? SECTION_AGENT_RELEASES[sectionAgentVersion] : null;
  if (!release || release.sectionId !== sectionId) throw new Error('Unsupported section agent or section.');
  return runFrozenSectionAgent({ release, executionMode, sectionId, reportState });
}
