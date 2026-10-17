import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, '../..');
const REGISTRY = JSON.parse(await readFile(path.join(HERE, 'release-registry.json'), 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const frozen = (value) => Object.freeze(Array.isArray(value) ? value.map(frozen)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, frozen(item)])) : value);
export const CONTENTS_CLASSIFICATION_RELEASES = frozen(Object.fromEntries(REGISTRY.entries.map((entry) => [entry.releaseId, entry])));

export function resolveContentsClassificationRelease({ releaseId, executionMode }) {
  if (!releaseId || releaseId === 'latest') throw new Error('An exact contents-classification release ID is required.');
  if (executionMode !== 'evaluation') throw new Error('This contents-classification release is evaluation-only.');
  const release = CONTENTS_CLASSIFICATION_RELEASES[releaseId];
  if (!release || !release.executionModes.includes(executionMode) || release.productEnabled !== false) {
    throw new Error('Unsupported contents-classification release or execution mode.');
  }
  return release;
}

export async function verifyContentsClassificationRelease({ releaseId, executionMode = 'evaluation' }) {
  const release = resolveContentsClassificationRelease({ releaseId, executionMode });
  const root = path.resolve(HERE, release.releasePath);
  const manifestPath = path.join(root, 'release-manifest.json');
  const manifestBytes = await readFile(manifestPath);
  assert.equal(sha256(manifestBytes), release.manifestSha256, 'Release manifest hash mismatch.');
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.releaseId, release.releaseId);
  assert.equal(manifest.qualifiedCandidateFingerprintSha256, release.qualifiedCandidateFingerprintSha256);
  assert.equal(manifest.releaseRuntimeFingerprintSha256, release.releaseRuntimeFingerprintSha256);
  assert.equal(manifest.evaluationEnabled, true);
  assert.equal(manifest.productEnabled, false);
  assert.equal(manifest.generationEligible, false);
  assert.equal(manifest.humanReviewRequired, true);
  assert.equal(manifest.pathRelocationAudit?.decision, 'passed');
  for (const [name, expected] of Object.entries(manifest.candidateFiles)) {
    assert.equal(sha256(await readFile(path.join(root, name))), expected, `Release file changed: ${name}`);
  }
  assert.equal(sha256(await readFile(path.join(root, manifest.qualification.releaseFile))), manifest.qualification.sha256,
    'Qualification record changed.');
  for (const component of manifest.sharedDependencyComponents) {
    assert.equal(sha256(await readFile(path.resolve(APP_ROOT, component.path))), component.sha256,
      `Shared release dependency changed: ${component.path}`);
  }
  const fingerprintModule = await import(`${pathToFileURL(path.join(root, 'candidate-fingerprint.mjs')).href}?verify=${Date.now()}`);
  assert.equal(fingerprintModule.buildCandidateFingerprint().sha256, manifest.releaseRuntimeFingerprintSha256,
    'Release runtime fingerprint changed.');
  return frozen({ release, manifest, root });
}

export async function executeContentsClassificationRelease({ releaseId, executionMode = 'evaluation', atomization,
  narrativeWorker = null, batchSize = 20, modelId = null } = {}) {
  const verified = await verifyContentsClassificationRelease({ releaseId, executionMode });
  const runtime = await import(pathToFileURL(path.join(verified.root, 'runtime.mjs')).href);
  const guardModule = await import(pathToFileURL(path.join(verified.root, 'classification-guard.mjs')).href);
  const classification = await runtime.classifyEvidence({ atomization, narrativeWorker, batchSize, modelId });
  const guard = guardModule.guardClassification({ classification });
  assert.equal(guard.decision, 'passed', JSON.stringify(guard.issues));
  return frozen({
    contractVersion: 'contents_classification_release_execution_v1',
    releaseBinding: {
      releaseId: verified.release.releaseId,
      manifestSha256: verified.release.manifestSha256,
      qualifiedCandidateFingerprintSha256: verified.release.qualifiedCandidateFingerprintSha256,
      releaseRuntimeFingerprintSha256: verified.release.releaseRuntimeFingerprintSha256,
    },
    classification,
    guard,
    humanReviewRequired: true,
    generationEligible: false,
    productEnabled: false,
  });
}

export async function guardReviewedContentsClassificationRelease({ releaseId, executionMode = 'evaluation', classification } = {}) {
  const verified = await verifyContentsClassificationRelease({ releaseId, executionMode });
  const guardModule = await import(pathToFileURL(path.join(verified.root, 'classification-guard.mjs')).href);
  const guard = guardModule.guardClassification({ classification });
  assert.equal(guard.decision, 'passed', JSON.stringify(guard.issues));
  assert.equal(guard.humanReviewRequiredAtomCount, 0, 'Reviewed classification still contains pending human-review assignments.');
  assert.equal(guard.notRunAtomCount, 0, 'Reviewed classification still contains unexecuted narrative assignments.');
  return frozen(guard);
}
