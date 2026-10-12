#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = join(HERE, 'candidate-freeze.json');
const LOCKED_FILES = Object.freeze([
  'README.md',
  'agent-spec.json',
  'harness.json',
  'prompt.md',
  'reviewer-prompt.md',
  'prepare-pilot.mjs',
  'audit-pilot-android.mjs',
  'full-test-contract.json',
  'full-test-preflight.mjs',
  'full-test-preflight.test.mjs',
  'freeze-candidate.mjs'
]);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export async function fingerprint() {
  const files = {};
  for (const name of LOCKED_FILES) files[name] = sha256(await readFile(join(HERE, name)));
  return { files, aggregateSha256: sha256(JSON.stringify(files)) };
}

export async function writeCandidateFreeze() {
  const current = await fingerprint();
  const appRoot = resolve(HERE, '../../../..');
  const manifest = {
    contractVersion: 'mock_preparation_candidate_freeze_v1',
    releaseId: 'mock-preparation-agent-v2',
    status: 'frozen_evaluation_candidate',
    productUseEnabled: false,
    validatedRelease: false,
    modelId: 'gpt-5.6-sol',
    gitBaseCommitAtFreeze: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: appRoot, encoding: 'utf8' }).trim(),
    releaseIdentity: 'Locked file hashes are authoritative; the manifest may be committed after this base commit.',
    createdAtIso: new Date().toISOString(),
    lockedFiles: current.files,
    aggregateSha256: current.aggregateSha256,
    nextDecision: 'Run the locked full-test protocol. Human review is required before a validated release freeze.'
  };
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return manifest;
}

export async function verifyCandidateFreeze() {
  const [manifest, current] = await Promise.all([
    readFile(MANIFEST, 'utf8').then(JSON.parse),
    fingerprint()
  ]);
  assert.deepEqual(current.files, manifest.lockedFiles, 'Candidate release files changed after freeze.');
  assert.equal(current.aggregateSha256, manifest.aggregateSha256, 'Candidate aggregate hash changed after freeze.');
  return { verified: true, releaseId: manifest.releaseId, status: manifest.status,
    aggregateSha256: manifest.aggregateSha256 };
}

async function run() {
  const command = process.argv[2];
  if (command === '--write') console.log(JSON.stringify(await writeCandidateFreeze(), null, 2));
  else if (command === '--verify') console.log(JSON.stringify(await verifyCandidateFreeze(), null, 2));
  else throw new Error('Usage: freeze-candidate.mjs --write | --verify');
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) run().catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
