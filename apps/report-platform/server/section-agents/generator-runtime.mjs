import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** Fail closed on changed release contents; no latest-version or shared-KB fallback. */
export async function verifyFrozenRelease({ rootUrl, manifestSha256 }) {
  const bytes = await readFile(new URL('manifest.json', rootUrl));
  if (sha256(bytes) !== manifestSha256) throw new Error('Frozen section-agent manifest has changed. Create a new release.');
  const manifest = JSON.parse(bytes);
  if (!['section_agent_release_v1', 'section_agent_release_v2'].includes(manifest.contractVersion) || manifest.productionEnabled !== false
      || manifest.executionModes.length !== 1 || manifest.executionModes[0] !== 'evaluation') {
    throw new Error('Unsupported section-agent release contract.');
  }
  for (const [path, expected] of Object.entries(manifest.files)) {
    if (!/^[a-zA-Z0-9_./-]+$/.test(path) || path.startsWith('/') || path.split('/').includes('..')) {
      throw new Error('Invalid frozen section-agent path.');
    }
    if (sha256(await readFile(new URL(path, rootUrl))) !== expected) {
      throw new Error(`Frozen section-agent file has changed: ${path}. Create a new release.`);
    }
  }
  if (!manifest.files[manifest.entryPoint] || !manifest.files[manifest.kbSnapshot]) {
    throw new Error('Section-agent entry point and KB must be pinned.');
  }
  if (manifest.contractVersion === 'section_agent_release_v2') {
    for (const path of [manifest.agentInstructions, manifest.agentSpec, manifest.harness,
      manifest.standardObligationPack]) {
      if (!path || !manifest.files[path]) throw new Error('V2 section-agent controls must be pinned.');
    }
    if (manifest.historicalPatternPack && !manifest.files[manifest.historicalPatternPack]) {
      throw new Error('V2 historical pattern pack must be pinned.');
    }
  }
  const kb = JSON.parse(await readFile(new URL(manifest.kbSnapshot, rootUrl)));
  const patternPack = manifest.historicalPatternPack
    ? JSON.parse(await readFile(new URL(manifest.historicalPatternPack, rootUrl))) : null;
  const standardPack = manifest.standardObligationPack
    ? JSON.parse(await readFile(new URL(manifest.standardObligationPack, rootUrl))) : null;
  return deepFreeze({ manifest, kb, patternPack, standardPack });
}

export async function runFrozenSectionAgent({ release, executionMode, sectionId, reportState }) {
  if (executionMode !== 'evaluation') throw new Error('This section agent awaits review before product promotion.');
  const { manifest, kb } = await verifyFrozenRelease(release);
  if (manifest.sectionId !== sectionId || manifest.releaseId !== release.version) throw new Error('Unsupported section agent or section.');
  if (manifest.generationMode !== 'deterministic' || manifest.prompt !== null
      || kb.retrieval !== 'disabled' || kb.sourceIds.length || kb.entries.length
      || kb.currentFactsFromPrecedent !== false) throw new Error('Unsupported KB or prompt policy for this frozen agent.');
  const module = await import(new URL(manifest.entryPoint, release.rootUrl).href);
  // The originally evaluated module used a shallow freeze. Prevent in-process
  // configuration edits too, without changing its pinned implementation bytes.
  deepFreeze(module.GENERAL_INFORMATION_AGENT);
  deepFreeze(module.GENERAL_INFORMATION_FIELDS);
  const result = module[manifest.entryExport]({
    exportPackage: reportState.exportPackage,
    manualSupplement: reportState.manualSupplement,
  });
  result.generationRun.sectionAgentRelease = {
    version: manifest.releaseId,
    manifestSha256: release.manifestSha256,
    kbSnapshotId: kb.snapshotId,
    status: manifest.status,
  };
  return result;
}

export async function runPlannedFrozenSectionAgent({ release, executionMode, reportPlan, sectionPlan, evidenceSnapshot }) {
  if (executionMode !== 'evaluation') throw new Error('This section agent awaits review before product promotion.');
  const { manifest, kb, patternPack, standardPack } = await verifyFrozenRelease(release);
  if (manifest.contractVersion !== 'section_agent_release_v2'
      || !manifest.supportedSectionIds.includes(sectionPlan.sectionId)
      || !manifest.supportedReportProfiles.includes(sectionPlan.reportProfileId)
      || manifest.releaseId !== release.version || manifest.agentId !== release.agentId) {
    throw new Error('Unsupported planned section agent, profile or section.');
  }
  if (manifest.generationMode !== 'deterministic' || manifest.prompt !== null
      || kb.retrieval !== 'disabled' || kb.sourceIds.length || kb.entries.length
      || kb.currentFactsFromPrecedent !== false) {
    throw new Error('Unsupported KB or prompt policy for this planned agent.');
  }
  const expectedPatternPack = patternPack?.packId ?? kb.snapshotId;
  if (sectionPlan.historicalPatternPack !== expectedPatternPack
      || sectionPlan.standardObligationPack !== standardPack?.packId
      || patternPack?.runtimeRetrievalEnabled === true
      || patternPack?.contentIncluded === true
      || standardPack?.currentScopeFactsFromStandards === true) {
    throw new Error('SectionPlan knowledge controls do not match the frozen release.');
  }
  const module = await import(new URL(manifest.entryPoint, release.rootUrl).href);
  deepFreeze(module.AGENT_POLICY);
  deepFreeze(module.FIELD_DEFINITIONS);
  deepFreeze(module.CLAIM_POLICY);
  deepFreeze(module.FIELD_SOURCE_POLICY);
  deepFreeze(module.AUXILIARY_EVIDENCE_POLICY);
  const result = module[manifest.entryExport]({
    contractVersion: manifest.executionContract,
    executionMode,
    reportPlanRef: {
      reportPlanId: reportPlan.reportPlanId,
      reportPlanSha256: reportPlan.reportPlanSha256,
      reportProfileId: reportPlan.reportProfileId,
      sectionInstanceId: sectionPlan.sectionInstanceId,
    },
    sectionPlan,
    evidenceSnapshot,
  });
  result.release = {
    agentId: manifest.agentId,
    version: manifest.releaseId,
    manifestSha256: release.manifestSha256,
    kbSnapshotId: kb.snapshotId,
    status: manifest.status,
    productEnabled: manifest.productionEnabled,
  };
  return result;
}
