import assert from 'node:assert/strict';
import test from 'node:test';
import { atomizeEvidence } from './atomizers/evidence-atomizer/v5/atomizer.mjs';
import { executeContentsClassificationRelease, resolveContentsClassificationRelease,
  guardReviewedContentsClassificationRelease, verifyContentsClassificationRelease } from './release-registry.mjs';

const RELEASE_ID = 'contents-classification-evaluation-v1';

test('resolves only the exact evaluation release', () => {
  assert.equal(resolveContentsClassificationRelease({ releaseId: RELEASE_ID, executionMode: 'evaluation' }).productEnabled, false);
  assert.throws(() => resolveContentsClassificationRelease({ releaseId: 'latest', executionMode: 'evaluation' }), /exact/);
  assert.throws(() => resolveContentsClassificationRelease({ releaseId: RELEASE_ID, executionMode: 'product' }), /evaluation-only/);
});

test('verifies the immutable manifest, candidate bytes, qualification, and shared dependency hashes', async () => {
  const verified = await verifyContentsClassificationRelease({ releaseId: RELEASE_ID });
  assert.equal(verified.manifest.qualification.decision, 'qualified_for_evaluation_release_human_review_required');
  assert.equal(verified.manifest.pathRelocationAudit.decision, 'passed');
});

test('executes structured evidence through the registered release and keeps generation blocked', async () => {
  const exportPackage = {
    packageType: 'v3_product_export', schemaVersion: 3, inspectionReference: 'registry-contract-test',
    unitProfile: { thicknessUnit: 'mm' },
    inspectionRecord: { generalTankInformation: { tankNumber: 'TEST-1' } },
  };
  const atomization = atomizeEvidence({ sealedInput: {
    contractVersion: 'sealed_classification_input_v1', guardId: 'evaluation-input-leakage-guard-v1',
    inputPackageHash: 'a'.repeat(64), lineageToken: 'opaque-test-token', exportPackage,
  } });
  const result = await executeContentsClassificationRelease({ releaseId: RELEASE_ID, atomization });
  assert.equal(result.guard.decision, 'passed');
  assert.equal(result.classification.classificationAssignments[0].sectionDecision.sectionId, 'general-tank-information');
  assert.equal(result.humanReviewRequired, true);
  assert.equal(result.generationEligible, false);
  assert.equal(result.productEnabled, false);
});

test('uses the release-local guard for reviewed classification decisions', async () => {
  const exportPackage = {
    packageType: 'v3_product_export', schemaVersion: 3, inspectionReference: 'registry-reviewed-test',
    unitProfile: { thicknessUnit: 'mm' }, inspectionRecord: { generalTankInformation: { tankNumber: 'TEST-2' } },
  };
  const atomization = atomizeEvidence({ sealedInput: {
    contractVersion: 'sealed_classification_input_v1', guardId: 'evaluation-input-leakage-guard-v1',
    inputPackageHash: 'b'.repeat(64), lineageToken: 'opaque-reviewed-token', exportPackage,
  } });
  const execution = await executeContentsClassificationRelease({ releaseId: RELEASE_ID, atomization });
  const guard = await guardReviewedContentsClassificationRelease({ releaseId: RELEASE_ID, classification: execution.classification });
  assert.equal(guard.decision, 'passed');
  assert.equal(guard.humanReviewRequiredAtomCount, 0);
});
