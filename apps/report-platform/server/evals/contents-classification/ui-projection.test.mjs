import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadContentsClassificationEvaluation } from './ui-projection.mjs';

test('loads a saved traced-source classification evaluation without altering rows', async () => {
  const root = await mkdtemp(join(tmpdir(), 'classification-ui-'));
  await mkdir(root, { recursive: true });
  const saved = { contractVersion: 'contents_classification_evaluation_v1', evaluationOnly: true,
    summary: { atomCount: 1 }, rows: [{ rowId: 'atom-1', originalAppRecord: { value: 6.2 }, atomizedUnit: '6.2 mm' }] };
  await writeFile(join(root, 'evaluation.json'), JSON.stringify(saved));
  const result = await loadContentsClassificationEvaluation({ appRoot: root, configuredRoot: root });
  assert.equal(result.available, true);
  assert.equal(result.datasetId, 'current');
  assert.deepEqual(result.rows, saved.rows);
});

test('returns a clear unavailable state before a run exists', async () => {
  const root = await mkdtemp(join(tmpdir(), 'classification-ui-empty-'));
  const result = await loadContentsClassificationEvaluation({ appRoot: root, configuredRoot: root });
  assert.equal(result.available, false);
  assert.equal(result.datasetId, 'current');
  assert.equal(result.message, 'No contents-classification evaluation run is available.');
  assert.equal(result.datasets.length, 2);
});

test('projects the sealed blinded challenge without exposing report identities or source paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'classification-ui-blinded-'));
  const result = {
    datasetHash: 'a'.repeat(64), predictionHash: 'b'.repeat(64), resultHash: 'c'.repeat(64),
    modelId: 'gpt-5.6-sol', classifierCandidateId: 'contents-classification-v10',
    summary: { n: 1, sectionPass: 1, sectionAccuracy: 1, exactPass: 1, exactAccuracy: 1, unrouted: 0 },
    rows: [{ challengeId: 'challenge_001', kind: 'measurement', rephrasedText: 'Roof plate 1 measured 4.8 mm.',
      expectedUse: { sectionId: 'roof-plate-thickness-measurements', blockId: 'measurements' },
      predictedUse: { sectionId: 'roof-plate-thickness-measurements', blockId: 'measurements', confidence: .99 },
      sectionPass: true, exactPass: true, feedback: 'Measurement route.',
      evaluatorPrivateSource: { sourceUnitId: 'unit-hash', sourceText: 'Plate 1: 4.8 mm.',
        documentId: 'secret-document', chunkId: 'secret-chunk', sourceName: 'secret.pdf' } }],
  };
  await writeFile(join(root, 'result.json'), JSON.stringify(result));
  await writeFile(join(root, 'blinded-chatbox-100-v2-failure-audit.json'), JSON.stringify({
    contractVersion: 'contents_classification_failure_audit_v1', datasetId: 'blinded-chatbox-100-v2',
    predictionHash: result.predictionHash, resultHash: result.resultHash, auditDate: '2026-10-16',
    auditState: 'engineering_triage_complete_gold_unchanged', scoreAdjustmentApplied: false,
    summary: { mismatchRows: 1, uniqueIssueGroups: 1, goldLabelReview: 0, outlineBoundary: 0,
      inputContextLoss: 0, classifierError: 1 },
    rows: [{ challengeId: 'challenge_001', category: 'classifier_error', issueGroupId: 'test-error',
      rationale: 'The classifier chose the wrong route.', recommendedAction: 'Refine on development data.' }],
  }));
  const projected = await loadContentsClassificationEvaluation({ appRoot: root, blindedRoot: root,
    blindedAuditRoot: root, datasetId: 'blinded-chatbox-100-v2' });
  assert.equal(projected.available, true);
  assert.equal(projected.challengeSummary.exactPass, 1);
  assert.equal(projected.failureAudit.classifierError, 1);
  assert.equal(projected.rows[0].auditCategory, 'classifier_error');
  assert.equal(projected.rows[0].auditRationale, 'The classifier chose the wrong route.');
  assert.equal(projected.rows[0].sourceUnits[0].originalReportText, 'Plate 1: 4.8 mm.');
  const serialized = JSON.stringify(projected);
  assert.doesNotMatch(serialized, /secret-document|secret-chunk|secret\.pdf|evaluatorPrivateSource/);
  assert.match(serialized, /labelsJoinedAfterSeal/);
});

test('rejects unknown review datasets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'classification-ui-unknown-'));
  await assert.rejects(() => loadContentsClassificationEvaluation({ appRoot: root, datasetId: 'unknown' }),
    /Unknown classification evaluation dataset/);
});
