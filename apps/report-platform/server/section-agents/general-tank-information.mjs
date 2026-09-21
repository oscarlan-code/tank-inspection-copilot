// Compatibility exports for the evaluation tools. The implementation lives in
// the immutable release and all execution passes through its integrity checks.
import { runSectionAgent } from './index.mjs';
export const GENERAL_INFORMATION_AGENT_VERSION = 'general_tank_information_v1';
export const GENERAL_INFORMATION_SECTION = 'general-tank-information';
export function generateGeneralTankInformation(reportState) {
  return runSectionAgent({ reportState, sectionAgentVersion: GENERAL_INFORMATION_AGENT_VERSION,
    sectionId: GENERAL_INFORMATION_SECTION, executionMode: 'evaluation' });
}
