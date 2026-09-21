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
  if (manifest.contractVersion !== 'section_agent_release_v1' || manifest.productionEnabled !== false
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
  const kb = JSON.parse(await readFile(new URL(manifest.kbSnapshot, rootUrl)));
  return deepFreeze({ manifest, kb });
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
