import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GENERAL_INFORMATION_CANDIDATE_B_CASE,
  loadGeneralInformationCandidateBReview,
} from './general-information-candidate-b-review-backend.mjs';

test('projects Candidate B atomic and whole-section evaluation into the review UI contract', async () => {
  const review = await loadGeneralInformationCandidateBReview({
    evaluationCaseId: GENERAL_INFORMATION_CANDIDATE_B_CASE,
    sectionId: 'general-tank-information',
  });
  assert.equal(review.evaluationOnly, true);
  assert.equal(review.generationBackend, 'general_information_candidate_b_sandbox');
  assert.equal(review.sectionWorkflowEvaluation.candidateId, 'general-tank-information-candidate-b');
  assert.equal(review.sectionWorkflowEvaluation.guardDecision, 'ready_for_review');
  assert.equal(review.sectionWorkflowEvaluation.qualificationStatus, 'automated_gates_passed_human_gates_pending');
  assert.equal(review.sectionWorkflowEvaluation.atomicRows.length, 37);
  assert(review.sectionWorkflowEvaluation.atomicRows.every((row) => row.status === 'pass'));
  assert.equal(review.sectionWorkflowEvaluation.sectionAssessment.structure.status, 'pass');
  assert.equal(review.sectionWorkflowEvaluation.sectionAssessment.coherence.status, 'pass');
  assert.equal(review.sectionWorkflowEvaluation.sectionAssessment.renderedComparison.status, 'not_measured');
  assert.equal(review.sectionWorkflowEvaluation.sectionAssessment.inspectorAcceptance.status, 'not_measured');
  assert.equal(review.appEvidence.length, 37);
  assert.equal(review.metrics.requiredFactRecall, 1);
  assert.equal(review.promotionGate.eligible, false);
  assert.match(review.generatedContent, /3 GENERAL TANK INFORMATION/);
  assert.match(review.originalSectionContent, /Floor Plate Thickness/);
});

test('rejects unrelated cases and run identifiers', async () => {
  await assert.rejects(() => loadGeneralInformationCandidateBReview({
    evaluationCaseId: 'wrong-case',
    sectionId: 'general-tank-information',
  }), /not found/);
  await assert.rejects(() => loadGeneralInformationCandidateBReview({
    evaluationCaseId: GENERAL_INFORMATION_CANDIDATE_B_CASE,
    sectionId: 'general-tank-information',
    evalRunId: 'wrong-run',
  }), /run was not found/);
});
