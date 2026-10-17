import assert from 'node:assert/strict';
import test from 'node:test';
import { qualificationBlockers } from './promote-candidate.mjs';

const base = () => ({
  contractVersion: 'contents_classification_qualification_record_v1',
  candidateId: 'contents-classification-v10',
  candidateFingerprintSha256: 'a'.repeat(64),
  decision: 'qualified_for_evaluation_release_human_review_required',
  productEnabled: false,
  generationEligible: false,
  stages: {
    development: { decision: 'development_gate_passed' },
    validation: { decision: 'validation_gate_passed' },
    hiddenTest: { decision: 'hidden_test_gate_passed', metrics: {
      wrongSectionRouteCount: 0, sectionRoutePrecision: 1, blockExactAccuracy: 0.95,
    } },
  },
});

test('accepts the qualified evaluation-only boundary', () => {
  assert.deepEqual(qualificationBlockers(base(), 'contents-classification-v10', 'a'.repeat(64)), []);
});

test('rejects a failed hidden gate or product-enabled record', () => {
  const qualification = base();
  qualification.stages.hiddenTest.decision = 'hidden_test_gate_failed';
  qualification.productEnabled = true;
  const blockers = qualificationBlockers(qualification, 'contents-classification-v10', 'a'.repeat(64));
  assert(blockers.includes('hidden_gate_not_passed'));
  assert(blockers.includes('qualification_boundary_invalid'));
});

test('rejects any wrong hidden section route', () => {
  const qualification = base();
  qualification.stages.hiddenTest.metrics.wrongSectionRouteCount = 1;
  assert(qualificationBlockers(qualification, 'contents-classification-v10', 'a'.repeat(64)).includes('hidden_wrong_section_routes'));
});
