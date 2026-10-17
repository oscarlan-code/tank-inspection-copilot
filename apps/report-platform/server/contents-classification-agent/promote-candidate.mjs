#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, '../..');
const CANDIDATE_ROOT = path.join(HERE, 'sandbox/candidates');
const RELEASE_ROOT = path.join(HERE, 'releases/evaluation');
const REGISTRY_PATH = path.join(HERE, 'release-registry.json');
const QUALIFICATION_PATH = path.resolve(HERE, '../evals/contents-classification/section-first-v1/qualification-v10.json');
export const REQUIRED_CANDIDATE_FILES = [
  'README.md', 'agent-spec.json', 'candidate-fingerprint.mjs', 'classification-guard.mjs',
  'classifier-prompt.md', 'harness.json', 'kb-policy.json', 'output-schema.json',
  'pipeline-contract.json', 'runtime.mjs', 'runtime.test.mjs',
];

const canonical = (value) => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const optionalJson = async (file, fallback) => { try { return await readJson(file); } catch (error) { if (error?.code === 'ENOENT') return fallback; throw error; } };
const exists = async (file) => { try { await stat(file); return true; } catch (error) { if (error?.code === 'ENOENT') return false; throw error; } };

function parseArgs(argv) {
  const args = { candidate: '', release: '', write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') args.write = true;
    else if (arg === '--candidate' || arg === '--release') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value.`);
      if (arg === '--candidate') args.candidate = value;
      else args.release = value;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!/^contents-classification-v[1-9][0-9]*$/.test(args.candidate) || !/^v[1-9][0-9]*$/.test(args.release)) {
    throw new Error('Usage: promote-candidate.mjs --candidate contents-classification-v<number> --release v<number> [--write]');
  }
  return args;
}

async function hashFiles(root, names = REQUIRED_CANDIDATE_FILES) {
  const files = {};
  for (const name of names) files[name] = sha256(await readFile(path.join(root, name)));
  return { files, aggregateSha256: sha256(canonical(files)) };
}

export function qualificationBlockers(qualification, candidateId, candidateFingerprintSha256) {
  const blockers = [];
  if (qualification?.contractVersion !== 'contents_classification_qualification_record_v1') blockers.push('qualification_contract_invalid');
  if (qualification?.candidateId !== candidateId) blockers.push('qualification_candidate_mismatch');
  if (qualification?.candidateFingerprintSha256 !== candidateFingerprintSha256) blockers.push('qualification_fingerprint_mismatch');
  if (qualification?.decision !== 'qualified_for_evaluation_release_human_review_required') blockers.push('qualification_decision_not_passed');
  if (qualification?.productEnabled !== false || qualification?.generationEligible !== false) blockers.push('qualification_boundary_invalid');
  if (qualification?.stages?.development?.decision !== 'development_gate_passed') blockers.push('development_gate_not_passed');
  if (qualification?.stages?.validation?.decision !== 'validation_gate_passed') blockers.push('validation_gate_not_passed');
  if (qualification?.stages?.hiddenTest?.decision !== 'hidden_test_gate_passed') blockers.push('hidden_gate_not_passed');
  if (Number(qualification?.stages?.hiddenTest?.metrics?.wrongSectionRouteCount) !== 0) blockers.push('hidden_wrong_section_routes');
  if (Number(qualification?.stages?.hiddenTest?.metrics?.sectionRoutePrecision) !== 1) blockers.push('hidden_section_precision_below_gate');
  if (Number(qualification?.stages?.hiddenTest?.metrics?.blockExactAccuracy) < 0.9) blockers.push('hidden_block_accuracy_below_gate');
  return blockers;
}

async function verifyQualificationArtifacts(qualification) {
  const blockers = [];
  for (const [key, relativePath] of Object.entries(qualification.artifacts ?? {})) {
    if (!key.endsWith('Path')) continue;
    const hashKey = `${key.slice(0, -4)}Sha256`;
    const expected = qualification.artifacts[hashKey];
    if (!expected) { blockers.push(`qualification_artifact_hash_missing:${key}`); continue; }
    try {
      const actual = sha256(await readFile(path.resolve(APP_ROOT, relativePath)));
      if (actual !== expected) blockers.push(`qualification_artifact_hash_mismatch:${key}`);
    } catch { blockers.push(`qualification_artifact_missing:${key}`); }
  }
  return blockers;
}

async function loadFingerprint(root, cacheKey) {
  const moduleUrl = `${pathToFileURL(path.join(root, 'candidate-fingerprint.mjs')).href}?promotion=${cacheKey}`;
  const module = await import(moduleUrl);
  return module.buildCandidateFingerprint();
}

function relocationAudit({ qualified, released, candidateRelativeRoot, releaseRelativeRoot }) {
  const mapped = qualified.components.map((component) => ({
    path: component.path.startsWith(`${candidateRelativeRoot}/`)
      ? `${releaseRelativeRoot}/${component.path.slice(candidateRelativeRoot.length + 1)}`
      : component.path,
    sha256: component.sha256,
  }));
  const issues = [];
  if (mapped.length !== released.components.length) issues.push('component_count_changed');
  for (let index = 0; index < mapped.length; index += 1) {
    if (mapped[index]?.path !== released.components[index]?.path) issues.push(`component_path_unexpected:${index}`);
    if (mapped[index]?.sha256 !== released.components[index]?.sha256) issues.push(`component_bytes_changed:${index}`);
  }
  return { decision: issues.length ? 'failed' : 'passed', issues, changedDimension: 'candidate_component_paths_only' };
}

export async function assessPromotion({ candidate, release }) {
  const candidateRoot = path.resolve(CANDIDATE_ROOT, candidate);
  const releaseRoot = path.resolve(RELEASE_ROOT, release);
  const releaseId = `contents-classification-evaluation-${release}`;
  const blockers = [];
  for (const name of REQUIRED_CANDIDATE_FILES) if (!await exists(path.join(candidateRoot, name))) blockers.push(`candidate_file_missing:${name}`);
  if (await exists(releaseRoot)) blockers.push('release_already_exists');
  const registry = await optionalJson(REGISTRY_PATH, { contractVersion: 'contents_classification_release_registry_v1', entries: [] });
  if ((registry.entries ?? []).some((entry) => entry.releaseId === releaseId || entry.releasePath === `releases/evaluation/${release}`)) blockers.push('release_registry_entry_exists');
  if (blockers.some((item) => item.startsWith('candidate_file_missing:'))) return { eligible: false, blockers, releaseId, candidateRoot, releaseRoot };

  const candidateFingerprint = await loadFingerprint(candidateRoot, `candidate-${Date.now()}`);
  const qualification = await readJson(QUALIFICATION_PATH);
  blockers.push(...qualificationBlockers(qualification, candidate, candidateFingerprint.sha256));
  blockers.push(...await verifyQualificationArtifacts(qualification));
  const [agentSpec, harness, candidateFiles] = await Promise.all([
    readJson(path.join(candidateRoot, 'agent-spec.json')),
    readJson(path.join(candidateRoot, 'harness.json')),
    hashFiles(candidateRoot),
  ]);
  if (agentSpec.productEnabled !== false || harness.productEnabled !== false || harness.executionMode !== 'evaluation') blockers.push('candidate_product_boundary_invalid');
  if (harness.variables?.modelId !== 'gpt-5.6-sol' || harness.variables?.promptVersion !== 'classification_prompt_v10') blockers.push('model_or_prompt_binding_unexpected');
  return { eligible: blockers.length === 0, blockers, releaseId, candidateRoot, releaseRoot,
    candidateFingerprint, qualification, candidateFiles, registry, agentSpec, harness };
}

async function promote({ candidate, release, write }) {
  const assessment = await assessPromotion({ candidate, release });
  const report = { action: write ? 'promote' : 'dry_run', candidate, release, releaseId: assessment.releaseId,
    eligible: assessment.eligible, blockers: assessment.blockers,
    qualifiedCandidateFingerprintSha256: assessment.candidateFingerprint?.sha256 ?? null,
    portableCandidateSha256: assessment.candidateFiles?.aggregateSha256 ?? null,
    productEnabled: false };
  if (!write || !assessment.eligible) return report;

  await mkdir(RELEASE_ROOT, { recursive: true });
  const temporaryRoot = path.join(RELEASE_ROOT, `.${release}.promotion-${process.pid}`);
  await rm(temporaryRoot, { recursive: true, force: true });
  await cp(assessment.candidateRoot, temporaryRoot, { recursive: true, errorOnExist: true, force: false });
  await writeFile(path.join(temporaryRoot, 'qualification.json'), await readFile(QUALIFICATION_PATH));
  await rename(temporaryRoot, assessment.releaseRoot);

  const releasedFiles = await hashFiles(assessment.releaseRoot);
  assert.deepEqual(releasedFiles, assessment.candidateFiles, 'Release candidate bytes changed during copy.');
  const releasedFingerprint = await loadFingerprint(assessment.releaseRoot, `release-${Date.now()}`);
  const candidateRelativeRoot = path.relative(APP_ROOT, assessment.candidateRoot);
  const releaseRelativeRoot = path.relative(APP_ROOT, assessment.releaseRoot);
  const pathAudit = relocationAudit({ qualified: assessment.candidateFingerprint, released: releasedFingerprint,
    candidateRelativeRoot, releaseRelativeRoot });
  assert.equal(pathAudit.decision, 'passed', JSON.stringify(pathAudit));
  const qualificationSha256 = sha256(await readFile(QUALIFICATION_PATH));
  const manifest = {
    contractVersion: 'contents_classification_release_manifest_v1',
    releaseId: assessment.releaseId,
    releaseVersion: release,
    candidateId: candidate,
    status: 'qualified_evaluation_release',
    lifecycleState: 'qualified_candidate',
    promotedFrom: `sandbox/candidates/${candidate}`,
    immutable: true,
    evaluationEnabled: true,
    productEnabled: false,
    generationEligible: false,
    humanReviewRequired: true,
    qualifiedCandidateFingerprintSha256: assessment.candidateFingerprint.sha256,
    releaseRuntimeFingerprintSha256: releasedFingerprint.sha256,
    qualificationBinding: 'exact_candidate_bytes_with_audited_path_relocation',
    pathRelocationAudit: pathAudit,
    portableCandidateSha256: releasedFiles.aggregateSha256,
    candidateFiles: releasedFiles.files,
    sharedDependencyComponents: assessment.candidateFingerprint.components.filter((item) => !item.path.startsWith(`${candidateRelativeRoot}/`)),
    qualification: {
      releaseFile: 'qualification.json',
      sha256: qualificationSha256,
      decision: assessment.qualification.decision,
      hiddenTestDecision: assessment.qualification.stages.hiddenTest.decision,
    },
    executionConfiguration: {
      modelId: assessment.harness.variables.modelId,
      promptVersion: assessment.harness.variables.promptVersion,
      outlineProfileId: assessment.harness.variables.outlineProfileId,
      atomizerId: assessment.agentSpec.atomizer.atomizerId,
      classificationGuardId: 'classification-guard-v10',
    },
    promotedAtIso: new Date().toISOString(),
  };
  const manifestPath = path.join(assessment.releaseRoot, 'release-manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const manifestSha256 = sha256(await readFile(manifestPath));
  const registry = assessment.registry;
  registry.entries = [...(registry.entries ?? []), {
    releaseId: assessment.releaseId,
    releaseVersion: release,
    candidateId: candidate,
    releasePath: `releases/evaluation/${release}`,
    manifestSha256,
    qualifiedCandidateFingerprintSha256: assessment.candidateFingerprint.sha256,
    releaseRuntimeFingerprintSha256: releasedFingerprint.sha256,
    executionModes: ['evaluation'],
    humanReviewRequired: true,
    productEnabled: false,
  }].sort((left, right) => left.releaseId.localeCompare(right.releaseId));
  await writeFile(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`);
  return { ...report, promoted: true, releasePath: `releases/evaluation/${release}`, manifestSha256,
    releaseRuntimeFingerprintSha256: releasedFingerprint.sha256 };
}

async function main() {
  const result = await promote(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.eligible) process.exitCode = 2;
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) main().catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
