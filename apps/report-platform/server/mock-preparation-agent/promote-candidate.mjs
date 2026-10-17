#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CANDIDATE_ROOT = join(HERE, 'sandbox', 'candidates');
const RELEASE_ROOT = join(HERE, 'releases');
export const REQUIRED_CANDIDATE_FILES = [
  'README.md',
  'agent-spec.json',
  'harness.json',
  'full-test-contract.json',
  'prompt.md',
  'reviewer-prompt.md',
  'prepare-full-case.mjs',
  'prepare-full-case.test.mjs',
];
export const QUALIFICATION_FINGERPRINT_FILES = REQUIRED_CANDIDATE_FILES
  .filter((name) => name !== 'prepare-full-case.test.mjs');

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function parseArgs(argv) {
  const args = { candidate: '', release: '', caseRoot: '', write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') args.write = true;
    else if (['--candidate', '--release', '--case-root'].includes(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      if (arg === '--candidate') args.candidate = value;
      if (arg === '--release') args.release = value;
      if (arg === '--case-root') args.caseRoot = resolve(value);
      index += 1;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.candidate || !args.release || !args.caseRoot) {
    throw new Error('Usage: promote-candidate.mjs --candidate <sandbox-name> --release <version> --case-root <private-case-root> [--write]');
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(args.candidate) || !/^v[1-9][0-9]*$/.test(args.release)) {
    throw new Error('Candidate must be a safe directory name and release must use v<number>.');
  }
  return args;
}

function within(parent, child) {
  const path = relative(parent, child);
  return path && !path.startsWith(`..${sep}`) && path !== '..' && !path.startsWith(sep);
}

async function optionalJson(path) {
  try { return await readJson(path); }
  catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
}

async function optionalDigest(path) {
  try { return sha256(await readFile(path)); }
  catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
}

async function hashFileSet(candidateRoot, names) {
  const files = {};
  for (const name of names) {
    const bytes = await readFile(join(candidateRoot, name));
    files[name] = sha256(bytes);
  }
  return { files, aggregateSha256: sha256(JSON.stringify(files)) };
}

export const hashCandidate = (candidateRoot) => hashFileSet(candidateRoot, REQUIRED_CANDIDATE_FILES);
export const hashQualificationCandidate = (candidateRoot) =>
  hashFileSet(candidateRoot, QUALIFICATION_FINGERPRINT_FILES);

function sameFingerprint(left, right) {
  return Boolean(left && right)
    && left.aggregateSha256 === right.aggregateSha256
    && JSON.stringify(left.files) === JSON.stringify(right.files);
}

function validNamingMigration({ migration, generationFingerprint, candidateFingerprint, releaseId }) {
  if (!migration || migration.contractVersion !== 'mock_preparation_qualification_name_migration_v1'
      || migration.changeType !== 'naming_only' || migration.behaviorChanged !== false) return false;
  if (migration.oldIdentity?.releaseId !== generationFingerprint?.releaseId
      || migration.oldIdentity?.aggregateSha256 !== generationFingerprint?.aggregateSha256
      || migration.newIdentity?.releaseId !== releaseId
      || migration.newIdentity?.aggregateSha256 !== candidateFingerprint?.aggregateSha256) return false;
  if (JSON.stringify(migration.oldIdentity?.files) !== JSON.stringify(generationFingerprint?.files)
      || JSON.stringify(migration.newIdentity?.files) !== JSON.stringify(candidateFingerprint?.files)) return false;

  const changedFiles = QUALIFICATION_FINGERPRINT_FILES.filter((name) =>
    generationFingerprint.files?.[name] !== candidateFingerprint.files?.[name]);
  const allowedMetadataChanges = new Set([
    'README.md', 'agent-spec.json', 'harness.json', 'full-test-contract.json', 'prepare-full-case.mjs',
  ]);
  return changedFiles.length > 0
    && changedFiles.every((name) => allowedMetadataChanges.has(name))
    && ['prompt.md', 'reviewer-prompt.md'].every((name) =>
      generationFingerprint.files?.[name] === candidateFingerprint.files?.[name]);
}

function independentReviewPassed(review) {
  return review && ['pass', 'approved'].includes(review.decision)
    && !(review.findings ?? []).some((item) => item.severity === 'blocking')
    && Number(review.blockingFindingCount ?? 0) === 0;
}

function humanReviewPassed({ decision, request, evaluation, evaluationSha256, requestSha256 }) {
  return decision?.contractVersion === 'mock_preparation_full_report_human_review_decision_v1'
    && decision.decision === 'approved'
    && Boolean(String(decision.reviewerId ?? '').trim())
    && Number(decision.acknowledgedPendingComparisonRows) === Number(evaluation?.summary?.pendingHumanReview)
    && Number(decision.comparisonRowCount) === Number(request?.summary?.comparisonRows)
    && decision.bindings?.qualificationEvaluationSha256 === evaluationSha256
    && decision.bindings?.humanReviewRequestSha256 === requestSha256;
}

function freezeMatches({ freeze, candidateFingerprint, humanReviewUsed,
  humanDecisionSha256, independentReviewSha256 }) {
  if (freeze?.contractVersion !== 'mock_preparation_qualification_freeze_v1'
      || freeze.status !== 'frozen' || freeze.decision !== 'frozen'
      || freeze.productUseEnabled !== false
      || freeze.candidateFingerprint?.aggregateSha256 !== candidateFingerprint?.aggregateSha256) return false;
  if (!humanReviewUsed) return true;
  return freeze.bindings?.humanReviewDecisionSha256 === humanDecisionSha256
    && freeze.bindings?.independentReviewSha256 === independentReviewSha256;
}

export async function assessPromotion({ candidateRoot, releaseRoot, caseRoot,
  candidateRegistryRoot = CANDIDATE_ROOT, releaseRegistryRoot = RELEASE_ROOT }) {
  const blockers = [];
  if (!within(candidateRegistryRoot, candidateRoot)) blockers.push('candidate_outside_sandbox');
  if (!within(releaseRegistryRoot, releaseRoot)) blockers.push('release_outside_registry');
  for (const name of REQUIRED_CANDIDATE_FILES) {
    try { assert((await stat(join(candidateRoot, name))).isFile()); }
    catch { blockers.push(`candidate_file_missing:${name}`); }
  }
  try { await stat(releaseRoot); blockers.push('release_already_exists'); }
  catch (error) { if (error?.code !== 'ENOENT') throw error; }

  const runRoot = join(caseRoot, 'review', 'mock-preparation-full-case-v1');
  const humanRequestPath = join(runRoot, 'human-review-request.json');
  const humanDecisionPath = join(runRoot, 'human-review-decision.json');
  const independentPath = join(caseRoot, 'review', 'independent-review.json');
  const evaluationPath = join(runRoot, 'full-report-evaluation.json');
  const [caseRecord, generation, android, fullReport, humanRequest, humanDecision,
    independent, freeze, namingMigration, evaluationSha256, humanRequestSha256,
    humanDecisionSha256, independentReviewSha256] = await Promise.all([
    optionalJson(join(caseRoot, 'case.json')),
    optionalJson(join(runRoot, 'result.json')),
    optionalJson(join(runRoot, 'android-round-trip-result.json')),
    optionalJson(evaluationPath),
    optionalJson(humanRequestPath),
    optionalJson(humanDecisionPath),
    optionalJson(independentPath),
    optionalJson(join(caseRoot, 'freeze-manifest.json')),
    optionalJson(join(runRoot, 'qualification-name-migration.json')),
    optionalDigest(evaluationPath),
    optionalDigest(humanRequestPath),
    optionalDigest(humanDecisionPath),
    optionalDigest(independentPath),
  ]);
  if (generation?.decision !== 'pass') blockers.push('generation_not_passed');
  if (android?.decision !== 'pass') blockers.push('android_round_trip_not_passed');
  const directFullReportPass = fullReport && Number(fullReport.summary?.failed ?? 0) === 0
    && Number(fullReport.summary?.pendingHumanReview ?? 0) === 0
    && ['pass', 'qualified', 'human_approved'].includes(fullReport.decision);
  const humanReviewUsed = !directFullReportPass && Number(fullReport?.summary?.failed ?? 0) === 0
    && humanReviewPassed({ decision: humanDecision, request: humanRequest, evaluation: fullReport,
      evaluationSha256, requestSha256: humanRequestSha256 });
  if (!directFullReportPass && !humanReviewUsed) {
    blockers.push('complete_report_human_review_not_passed');
  }
  if (!independentReviewPassed(independent)) blockers.push('independent_source_review_not_passed');
  if (!freeze) blockers.push('case_not_frozen');

  let candidateFingerprint = null;
  let qualificationBinding = 'missing';
  if (!blockers.some((item) => item.startsWith('candidate_file_missing:'))) {
    candidateFingerprint = await hashQualificationCandidate(candidateRoot);
    const releaseId = `mock-preparation-agent-${basename(releaseRoot)}`;
    if (generation?.releaseFingerprint?.releaseId === releaseId
        && sameFingerprint(generation.releaseFingerprint, candidateFingerprint)) {
      qualificationBinding = 'direct';
    } else if (validNamingMigration({ migration: namingMigration,
      generationFingerprint: generation?.releaseFingerprint, candidateFingerprint, releaseId })) {
      qualificationBinding = 'naming_only_migration';
    } else blockers.push('candidate_fingerprint_not_qualified');
    if (freeze && !freezeMatches({ freeze, candidateFingerprint, humanReviewUsed,
      humanDecisionSha256, independentReviewSha256 })) blockers.push('case_freeze_invalid');
  }

  return {
    eligible: blockers.length === 0,
    blockers,
    caseRecord,
    generation,
    android,
    fullReport,
    humanRequest,
    humanDecision,
    humanReviewUsed,
    independent,
    freeze,
    namingMigration,
    candidateFingerprint,
    qualificationBinding,
  };
}

async function promote({ candidate, release, caseRoot, write }) {
  const candidateRoot = resolve(CANDIDATE_ROOT, candidate);
  const releaseRoot = resolve(RELEASE_ROOT, release);
  const assessment = await assessPromotion({ candidateRoot, releaseRoot, caseRoot });
  const candidateHash = assessment.blockers.some((item) => item.startsWith('candidate_file_missing:'))
    ? null : await hashCandidate(candidateRoot);
  const report = {
    action: write ? 'promote' : 'dry_run',
    candidate,
    release,
    eligible: assessment.eligible,
    blockers: assessment.blockers,
    candidateHash,
    qualification: {
      caseId: assessment.caseRecord?.caseId ?? null,
      sourceSha256: assessment.caseRecord?.source?.sourceSha256 ?? null,
      generationDecision: assessment.generation?.decision ?? 'missing',
      androidDecision: assessment.android?.decision ?? 'missing',
      fullReportDecision: assessment.humanReviewUsed
        ? assessment.humanDecision?.decision ?? 'missing'
        : assessment.fullReport?.decision ?? 'missing',
      independentReviewDecision: assessment.independent?.decision ?? 'missing',
      frozen: Boolean(assessment.freeze),
      candidateBinding: assessment.qualificationBinding,
    },
  };
  if (!write || !assessment.eligible) return report;

  await mkdir(RELEASE_ROOT, { recursive: true });
  await cp(candidateRoot, releaseRoot, { recursive: true, errorOnExist: true, force: false });
  const manifest = {
    contractVersion: 'mock_preparation_release_manifest_v1',
    releaseId: `mock-preparation-agent-${release}`,
    promotedFrom: `sandbox/candidates/${candidate}`,
    candidateFiles: candidateHash.files,
    aggregateSha256: candidateHash.aggregateSha256,
    qualification: report.qualification,
    promotedAtIso: new Date().toISOString(),
    immutable: true,
    productUseEnabled: false,
  };
  await writeFile(join(releaseRoot, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return { ...report, promoted: true, releasePath: relative(HERE, releaseRoot), manifest };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const result = await promote(args);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.eligible) process.exitCode = 2;
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) run().catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
