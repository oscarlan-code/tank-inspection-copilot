import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  assessPromotion, hashQualificationCandidate, QUALIFICATION_FINGERPRINT_FILES, REQUIRED_CANDIDATE_FILES,
} from './promote-candidate.mjs';

const save = async (path, value) => {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value)}\n`);
};

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'mock-promotion-'));
  const candidateRegistryRoot = join(root, 'sandbox', 'candidates');
  const releaseRegistryRoot = join(root, 'releases');
  const candidateRoot = join(candidateRegistryRoot, 'candidate-a');
  const releaseRoot = join(releaseRegistryRoot, 'v1');
  const caseRoot = join(root, 'case');
  await mkdir(candidateRoot, { recursive: true });
  await mkdir(releaseRegistryRoot, { recursive: true });
  for (const name of REQUIRED_CANDIDATE_FILES) {
    await writeFile(join(candidateRoot, name), `${name}\n`);
  }
  await save(join(caseRoot, 'case.json'), { caseId: 'case-1', source: { sourceSha256: 'a'.repeat(64) } });
  const fingerprint = await hashQualificationCandidate(candidateRoot);
  await save(join(caseRoot, 'review', 'mock-preparation-full-case-v1', 'result.json'), {
    decision: 'pass', releaseFingerprint: { releaseId: 'mock-preparation-agent-v1', ...fingerprint },
  });
  await save(join(caseRoot, 'review', 'mock-preparation-full-case-v1', 'android-round-trip-result.json'), { decision: 'pass' });
  await save(join(caseRoot, 'review', 'mock-preparation-full-case-v1', 'full-report-evaluation.json'), {
    decision: 'human_approved', summary: { failed: 0, pendingHumanReview: 0 },
  });
  await save(join(caseRoot, 'review', 'independent-review.json'), { decision: 'pass', findings: [] });
  await save(join(caseRoot, 'freeze-manifest.json'), {
    contractVersion: 'mock_preparation_qualification_freeze_v1',
    packageType: 'frozen_case', status: 'frozen', decision: 'frozen', productUseEnabled: false,
    candidateFingerprint: fingerprint,
  });
  return { candidateRegistryRoot, releaseRegistryRoot, candidateRoot, releaseRoot, caseRoot, fingerprint };
}

test('accepts only a fully reviewed and frozen candidate', async () => {
  const paths = await fixture();
  const result = await assessPromotion(paths);
  assert.equal(result.eligible, true);
  assert.deepEqual(result.blockers, []);
});

test('blocks a candidate while complete-report human review remains open', async () => {
  const paths = await fixture();
  await save(join(paths.caseRoot, 'review', 'mock-preparation-full-case-v1', 'full-report-evaluation.json'), {
    decision: 'human_review_required', summary: { failed: 0, pendingHumanReview: 1 },
  });
  const result = await assessPromotion(paths);
  assert.equal(result.eligible, false);
  assert(result.blockers.includes('complete_report_human_review_not_passed'));
});

test('blocks candidate bytes that are not bound to the qualification result', async () => {
  const paths = await fixture();
  await writeFile(join(paths.candidateRoot, QUALIFICATION_FINGERPRINT_FILES[0]), 'changed\n');
  const result = await assessPromotion(paths);
  assert.equal(result.eligible, false);
  assert(result.blockers.includes('candidate_fingerprint_not_qualified'));
});

test('accepts an explicit naming-only migration with unchanged prompts', async () => {
  const paths = await fixture();
  await save(join(paths.caseRoot, 'review', 'mock-preparation-full-case-v1', 'result.json'), {
    decision: 'pass', releaseFingerprint: { releaseId: 'mock-preparation-agent-old-name', ...paths.fingerprint },
  });
  await writeFile(join(paths.candidateRoot, 'README.md'), 'renamed candidate\n');
  const current = await hashQualificationCandidate(paths.candidateRoot);
  await save(join(paths.caseRoot, 'review', 'mock-preparation-full-case-v1', 'qualification-name-migration.json'), {
    contractVersion: 'mock_preparation_qualification_name_migration_v1',
    changeType: 'naming_only',
    behaviorChanged: false,
    oldIdentity: { releaseId: 'mock-preparation-agent-old-name', ...paths.fingerprint },
    newIdentity: { releaseId: 'mock-preparation-agent-v1', ...current },
  });
  await save(join(paths.caseRoot, 'freeze-manifest.json'), {
    contractVersion: 'mock_preparation_qualification_freeze_v1',
    packageType: 'frozen_case', status: 'frozen', decision: 'frozen', productUseEnabled: false,
    candidateFingerprint: current,
  });
  const result = await assessPromotion(paths);
  assert.equal(result.eligible, true);
  assert.equal(result.qualificationBinding, 'naming_only_migration');
});
