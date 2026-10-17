import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..', '.local', 'contents-classification-eval', 'current');
const readJson = async (name) => JSON.parse(await readFile(path.join(root, name), 'utf8'));
const [evaluation, classification, guard, preview] = await Promise.all([
  readJson('evaluation.json'), readJson('runtime/classification.json'),
  readJson('runtime/classification-guard.json'), readJson('request-preview.json'),
]);

assert.equal(evaluation.evaluationOnly, true);
assert.equal(evaluation.summary.atomCount, classification.evidenceAtoms.length);
assert.equal(classification.classificationAssignments.length, classification.evidenceAtoms.length);
assert.equal(new Set(classification.classificationAssignments.map((item) => item.evidenceId)).size,
  classification.classificationAssignments.length);
assert.equal(guard.decision, 'passed');
assert.equal(preview.goldIncluded, false);
assert.equal(preview.evaluatorCrosswalkIncluded, false);
assert.equal(preview.originalReportIncluded, false);
assert.match(preview.candidateFingerprintSha256, /^[a-f0-9]{64}$/);
assert.equal(evaluation.classifier.candidateFingerprintSha256, preview.candidateFingerprintSha256);
assert.equal(classification.classificationManifest.candidateFingerprintSha256, preview.candidateFingerprintSha256);
assert(classification.classificationAssignments.filter((item) => item.uses.some((use) => use.method === 'llm_proposal'))
  .every((item) => item.decisionState === 'needs_review'));
assert(evaluation.byEvidenceType.some((item) => item.evidenceType === 'structured_field'));
assert(evaluation.byEvidenceType.some((item) => item.evidenceType === 'voice_narrative'));
assert(evaluation.byEvidenceType.some((item) => item.evidenceType === 'ut_measurement_row'));
assert(evaluation.rows.every((item) => ['pass', 'fail', 'not_run', 'not_measured'].includes(item.result)));
assert.equal(evaluation.summary.binaryEvaluatedCount, evaluation.summary.passed + evaluation.summary.failed);
assert.equal(evaluation.summary.binaryEvaluatedCount + evaluation.summary.notRun + evaluation.summary.notMeasured, evaluation.summary.atomCount);
assert(evaluation.rows.filter((item) => item.result === 'not_run')
  .every((item) => item.evidenceType === 'voice_narrative' && item.classifierDecision === 'not_run'));
assert.equal(evaluation.summary.goldMissingAtoms, 0);

console.log(JSON.stringify({ audited: true, atomCount: evaluation.summary.atomCount,
  goldLabeledAtoms: evaluation.summary.goldLabeledAtoms, precision: evaluation.summary.labelPrecision,
  recall: evaluation.summary.labelRecall, passRate: evaluation.summary.binaryPassRate,
  llmProposalReviewRequired: evaluation.summary.llmProposalReviewCount }, null, 2));
