import assert from 'node:assert/strict';
import { verifyContentsClassificationRelease } from './release-registry.mjs';

const releaseId = 'contents-classification-evaluation-v1';
const verified = await verifyContentsClassificationRelease({ releaseId, executionMode: 'evaluation' });
assert.equal(verified.manifest.status, 'qualified_evaluation_release');
assert.equal(verified.manifest.lifecycleState, 'qualified_candidate');
assert.equal(verified.manifest.executionConfiguration.modelId, 'gpt-5.6-sol');
assert.equal(verified.manifest.executionConfiguration.promptVersion, 'classification_prompt_v10');
assert.equal(verified.manifest.executionConfiguration.atomizerId, 'evidence-atomizer-v5');
assert.equal(verified.manifest.productEnabled, false);
assert.equal(verified.manifest.generationEligible, false);
assert.equal(verified.manifest.humanReviewRequired, true);
console.log(JSON.stringify({
  passed: true,
  releaseId,
  candidateId: verified.manifest.candidateId,
  qualifiedCandidateFingerprintSha256: verified.manifest.qualifiedCandidateFingerprintSha256,
  releaseRuntimeFingerprintSha256: verified.manifest.releaseRuntimeFingerprintSha256,
  qualificationBinding: verified.manifest.qualificationBinding,
  evaluationEnabled: verified.manifest.evaluationEnabled,
  productEnabled: verified.manifest.productEnabled,
  generationEligible: verified.manifest.generationEligible,
  humanReviewRequired: verified.manifest.humanReviewRequired,
}, null, 2));
