import assert from 'node:assert/strict';
import test from 'node:test';
import { assertIndependentLineage, auditRequestPreview, datasetRole } from './robustness.mjs';

const candidateFingerprint = { candidateId: 'contents-classification-v10', sha256: 'f'.repeat(64) };
const preview = () => ({ goldIncluded: false, evaluatorCrosswalkIncluded: false, originalReportIncluded: false,
  classifierCandidateId: 'contents-classification-v10', candidateFingerprintSha256: 'f'.repeat(64),
  requests: [{ prompt: 'Current evidence only.', schema: { type: 'object' } }] });

test('accepts a different report and asset lineage', () => {
  const result = assertIndependentLineage({
    developmentCases: [{ caseId: 'dev', source: { documentId: 'doc-dev', sourceSha256: 'a'.repeat(64), assetLineageKey: 'asset:v4' } }],
    evaluationCase: { caseId: 'eval', source: { documentId: 'doc-eval', sourceSha256: 'b'.repeat(64), assetLineageKey: 'asset:5452' } },
  });
  assert.equal(result.decision, 'passed');
});

test('blocks same-case, same-document, source-copy, and same-asset leakage', () => {
  const source = { documentId: 'same-doc', sourceSha256: 'a'.repeat(64), assetLineageKey: 'asset:same' };
  assert.throws(() => assertIndependentLineage({
    developmentCases: [{ caseId: 'same-case', source }], evaluationCase: { caseId: 'same-case', source },
  }), /caseId, documentId, sourceSha256, assetLineageKey/);
});

test('passes a request containing only sealed evidence and public outline vocabulary', () => {
  assert.equal(auditRequestPreview({ preview: preview(), candidateFingerprint }).decision, 'passed');
});

test('blocks evaluator-private gold and lineage identifiers from the worker request', () => {
  const unsafe = preview();
  unsafe.requests[0].prompt = '{"goldDecision":"route","case":"mock-private-case"}';
  const result = auditRequestPreview({ preview: unsafe, candidateFingerprint,
    evaluatorPrivateIdentifiers: ['mock-private-case'] });
  assert.equal(result.decision, 'blocked');
  assert(result.issues.includes('forbidden_runtime_field:goldDecision'));
  assert(result.issues.some((item) => item.startsWith('evaluator_private_identifier:')));
});

test('does not call a training-split report held-out validation', () => {
  assert.equal(datasetRole({ source: { sourceDatasetSplit: 'training' } }), 'independent_robustness');
  assert.equal(datasetRole({ source: { sourceDatasetSplit: 'validation' } }), 'held_out_validation');
});

