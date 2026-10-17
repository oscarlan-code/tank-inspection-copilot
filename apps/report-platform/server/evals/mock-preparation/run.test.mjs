#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { evaluateMockPreparationCase } from './run.mjs';

const save = (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
const hash = 'a'.repeat(64);

async function buildFixture() {
  const root = await mkdtemp(join(tmpdir(), 'mock-preparation-eval-'));
  await mkdir(join(root, 'review'));
  await save(join(root, 'source-inventory.json'), {
    caseId: 'case-01', caseRevision: 1, sourceSha256: hash,
    obligations: [
      { obligationId: 'required-1', requiredForMock: true, disposition: 'android_captured' },
      { obligationId: 'excluded-1', requiredForMock: false, disposition: 'report_platform_owned' },
    ],
  });
  await save(join(root, 'evidence-lineage.json'), {
    entries: [
      { obligationId: 'required-1', recordRefs: ['generalInfo.client'] },
      { obligationId: 'excluded-1', recordRefs: [] },
    ],
  });
  await save(join(root, 'semantic-pairs.json'), {
    contractVersion: 'source_mock_semantic_matrix_v1',
    caseId: 'case-01',
    semanticUnits: [{
      sourceUnitId: 'semantic-1', semanticKey: 'shell.external.coating', unitType: 'observation',
      criticality: 'required', appCapability: 'capturable', sourceObligationIds: ['required-1'],
      protectedFacts: { entity: 'shell', polarity: 'present' },
    }],
    variants: [{
      variantId: 'concise-field',
      rows: [{
        sourceUnitId: 'semantic-1', mockEvidenceRefs: ['findings/0/voiceTranscript'],
        semanticVerdict: 'preserved', integrityVerdict: 'pass', unsupportedAdditionCount: 0,
        reviewed: true, grader: { type: 'human', id: 'reviewer', version: '1.0.0' },
      }],
    }],
  });
  await save(join(root, 'build-receipt.json'), { draftVariants: ['concise-field'] });
  await save(join(root, 'review', 'deterministic-review.json'), {
    decision: 'pass', checks: { expectedExportVariantCount: 1 },
  });
  await save(join(root, 'review', 'app-export-audit-concise-field.json'), {
    decision: 'pass', receipt: { valid: true }, unitProfile: { thicknessUnit: 'mm' },
    parity: { checklistAnswers: 195 },
    generalInfoContract: { draftFieldCount: 2, exportedFieldCount: 2, absentFromInspectionRecord: [] },
    narrativeLeakage: { exactMatchCount: 0 },
  });
  await save(join(root, 'eval-candidate.json'), {
    candidateId: 'candidate-a', agentRelease: 'mock-preparation-v1',
    implementationGitCommit: 'b'.repeat(40), changedVariable: 'baseline',
    model: { mode: 'disabled', reason: 'deterministic materialization' },
    prompt: { mode: 'disabled', reason: 'reviewed source plan' },
  });
  await save(join(root, 'review', 'independent-review.json'), { decision: 'pass', blockingFindingCount: 0 });
  await save(join(root, 'freeze-manifest.json'), { caseId: 'case-01', sha256: hash });
  return root;
}

const root = await buildFixture();
try {
  const qualified = await evaluateMockPreparationCase(root);
  assert.equal(qualified.decision, 'qualified');
  assert.ok(qualified.graders.every((grader) => grader.status === 'pass'));

  const pendingMatrix = JSON.parse(await (await import('node:fs/promises')).readFile(join(root, 'semantic-pairs.json'), 'utf8'));
  pendingMatrix.variants[0].rows[0] = {
    ...pendingMatrix.variants[0].rows[0],
    reviewed: false,
    semanticVerdict: 'pending',
    integrityVerdict: 'pending',
    unsupportedAdditionCount: null,
  };
  await save(join(root, 'semantic-pairs.json'), pendingMatrix);
  const pendingReview = await evaluateMockPreparationCase(root);
  assert.equal(pendingReview.decision, 'incomplete');
  assert.equal(pendingReview.graders.find((grader) => grader.id === 'semantic-meaning-alignment').status, 'not_run');
  assert.equal(pendingReview.graders.find((grader) => grader.id === 'truth-integrity').status, 'not_run');
  pendingMatrix.variants[0].rows[0] = {
    ...pendingMatrix.variants[0].rows[0],
    reviewed: true,
    semanticVerdict: 'preserved',
    integrityVerdict: 'pass',
    unsupportedAdditionCount: 0,
  };
  await save(join(root, 'semantic-pairs.json'), pendingMatrix);

  await save(join(root, 'eval-candidate.json'), {
    candidateId: 'candidate-b', agentRelease: 'mock-preparation-v1',
    implementationGitCommit: 'b'.repeat(40), changedVariable: 'model',
    model: { mode: 'pinned', version: 'latest', sha256: 'not-a-hash' },
    prompt: { mode: 'disabled', reason: 'reviewed source plan' },
  });
  const invalidCandidate = await evaluateMockPreparationCase(root);
  assert.equal(invalidCandidate.decision, 'failed');
  assert.equal(invalidCandidate.graders.find((grader) => grader.id === 'candidate-configuration').status, 'fail');
  await save(join(root, 'eval-candidate.json'), {
    candidateId: 'candidate-a', agentRelease: 'mock-preparation-v1',
    implementationGitCommit: 'b'.repeat(40), changedVariable: 'baseline',
    model: { mode: 'disabled', reason: 'deterministic materialization' },
    prompt: { mode: 'disabled', reason: 'reviewed source plan' },
  });

  await save(join(root, 'evidence-lineage.json'), {
    entries: [
      { obligationId: 'required-1', recordRefs: [] },
      { obligationId: 'excluded-1', recordRefs: [] },
    ],
  });
  const legacyLineageIsInformational = await evaluateMockPreparationCase(root);
  assert.equal(legacyLineageIsInformational.decision, 'qualified');
  assert.equal(legacyLineageIsInformational.graders.find((grader) => grader.id === 'source-to-mock-coverage').status, 'pass');

  const matrix = JSON.parse(await (await import('node:fs/promises')).readFile(join(root, 'semantic-pairs.json'), 'utf8'));
  matrix.variants[0].rows[0].mockEvidenceRefs = [];
  await save(join(root, 'semantic-pairs.json'), matrix);
  const failed = await evaluateMockPreparationCase(root);
  assert.equal(failed.decision, 'failed');
  assert.equal(failed.graders.find((grader) => grader.id === 'source-to-mock-coverage').status, 'fail');
  matrix.variants[0].rows[0].mockEvidenceRefs = ['findings/0/voiceTranscript'];
  await save(join(root, 'semantic-pairs.json'), matrix);

  await rm(join(root, 'review', 'independent-review.json'));
  await rm(join(root, 'freeze-manifest.json'));
  const incompleteAndFailed = await evaluateMockPreparationCase(root);
  assert.equal(incompleteAndFailed.graders.find((grader) => grader.id === 'independent-source-review').status, 'not_run');

  await save(join(root, 'review', 'independent-review.json'), { decision: 'fail', blockingFindingCount: 1 });
  const negativeReview = await evaluateMockPreparationCase(root);
  assert.equal(negativeReview.graders.find((grader) => grader.id === 'independent-source-review').status, 'fail');
  console.log('Simple Mock Preparation Agent eval tests passed.');
} finally {
  await rm(root, { recursive: true, force: true });
}
