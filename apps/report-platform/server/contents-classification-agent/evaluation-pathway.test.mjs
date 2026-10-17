import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildSectionEvidencePackages,
  ContentsClassificationPathwayBlockedError,
  runContentsClassificationEvaluationPathway,
  sealContentsClassificationReview,
} from './evaluation-pathway.mjs';

const fixtureUrl = new URL('../report-evidence-router/releases/v2/test-fixtures/android-export.json', import.meta.url);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

async function inputFixture() {
  const source = JSON.parse(await readFile(fixtureUrl, 'utf8'));
  const exportPackage = { ...source, inspectionReference: 'ROUTER-FIXTURE-1' };
  const rawExportBytes = Buffer.from(JSON.stringify(exportPackage));
  return {
    exportPackage,
    rawExportBytes,
    androidReceipt: {
      packageType: 'laiq_android_app_export_receipt', schemaVersion: 2, producer: 'ProductStore.exportInspection',
      exportPackageId: 'fixture-package-1', inspectionId: exportPackage.inspectionId,
      inspectionReference: exportPackage.inspectionReference, exportSha256: sha256(rawExportBytes),
      exportByteSize: rawExportBytes.byteLength, caseId: 'fixture-case', caseRevision: 1,
      variant: 'natural-field-speech', goldSha256: 'a'.repeat(64), exportedAtIso: '2026-10-17T00:00:00.000Z',
    },
    lineageSecret: 'evaluation-pathway-test-secret-0000000000000000000000000000',
    referenceTextUnits: [],
    generatedAtIso: '2026-10-17T00:00:00.000Z',
  };
}

async function narrativeWorker({ atoms }) {
  return { classifications: atoms.map((atom) => {
    const recommendation = /recommended action/i.test(atom.originalValue);
    return {
      evidenceId: atom.evidenceId, decisionState: 'needs_review',
      sectionId: recommendation ? 'repair-recommendations' : 'inspection-report',
      blockId: recommendation ? 'recommendations' : 'shell-appurtenances', role: 'required_narrative',
      sectionConfidence: 0.96, blockConfidence: 0.92, feedback: 'Bounded fixture classification proposal.',
    };
  }) };
}

async function runFixture() {
  return runContentsClassificationEvaluationPathway({
    ...await inputFixture(), narrativeWorker, modelId: 'gpt-5.6-sol',
  });
}

function approveAll(runtimeRun) {
  return runtimeRun.reviewQueue.map((item) => ({
    reviewItemId: item.reviewItemId, action: 'approve', reason: 'Reviewer confirmed the proposed section and block.',
  }));
}

const reviewer = {
  userId: 'reviewer-1', role: 'evaluation_reviewer', authorizationScope: 'contents_classification_review',
  reviewedAtIso: '2026-10-17T00:01:00.000Z',
};

test('runs a raw Android export through the exact evaluation release and creates a human-review queue', async () => {
  const result = await runFixture();
  assert.equal(result.runtimeRun.releaseId, 'contents-classification-evaluation-v1');
  assert.equal(result.runtimeRun.inputReceipt.decision, 'passed');
  assert.equal(result.runtimeRun.atomization.atomizerId, 'evidence-atomizer-v5');
  assert.equal(result.runtimeRun.reviewQueue.length, 2);
  assert(result.runtimeRun.reviewQueue.every((item) => item.status === 'pending_human_review'));
  assert.equal(result.runtimeRun.evaluationSectionAgentEligible, false);
  assert.equal(result.runtimeRun.productGenerationEligible, false);
  assert.equal(result.runtimeRun.productEnabled, false);
  assert.equal(result.evaluatorPrivate.visibility, 'evaluator_only');
  assert.equal(Object.hasOwn(result.runtimeRun, 'evaluatorCrosswalk'), false);
});

test('requires a complete authorized human review before sealing decisions', async () => {
  const { runtimeRun } = await runFixture();
  await assert.rejects(() => sealContentsClassificationReview({ runtimeRun, decisions: [], reviewer }), /incomplete/);
  await assert.rejects(() => sealContentsClassificationReview({
    runtimeRun, decisions: approveAll(runtimeRun), reviewer: { ...reviewer, authorizationScope: 'report_generation' },
  }), /lacks classification-review authority/);
  const sealed = await sealContentsClassificationReview({ runtimeRun, decisions: approveAll(runtimeRun), reviewer });
  assert.equal(sealed.humanReviewComplete, true);
  assert.equal(sealed.reviewedGuard.humanReviewRequiredAtomCount, 0);
  assert.equal(sealed.evaluationSectionAgentEligible, true);
  assert.equal(sealed.productGenerationEligible, false);
});

test('projects reviewed evidence into isolated evaluation-only section packages', async () => {
  const { runtimeRun } = await runFixture();
  const sealed = await sealContentsClassificationReview({ runtimeRun, decisions: approveAll(runtimeRun), reviewer });
  const selected = [...new Set(sealed.reviewedClassification.classificationAssignments
    .flatMap((assignment) => assignment.uses.map((use) => use.sectionId)))];
  const bundle = buildSectionEvidencePackages({ sealedDecisions: sealed, reviewedSectionSelection: selected });
  assert.equal(bundle.packageCount, selected.length);
  assert.equal(bundle.status, 'ready_for_section_agent_evaluation');
  assert.equal(bundle.productGenerationEligible, false);
  assert.equal(bundle.productEnabled, false);
  for (const evidencePackage of bundle.packages) {
    assert(evidencePackage.evidenceRecords.length > 0);
    assert(evidencePackage.evidenceRecords.every((record) => Object.hasOwn(evidencePackage.byBlock, record.blockId)));
    assert(evidencePackage.evidenceRecords.every((record) => {
      const assignment = sealed.reviewedClassification.classificationAssignments.find((item) => item.evidenceId === record.evidenceId);
      return assignment.uses.some((use) => use.sectionId === evidencePackage.sectionId && use.blockId === record.blockId);
    }));
  }
});

test('supports a reviewer correction while preserving the source atom', async () => {
  const { runtimeRun } = await runFixture();
  const decisions = approveAll(runtimeRun);
  decisions[0] = {
    reviewItemId: runtimeRun.reviewQueue[0].reviewItemId, action: 'correct',
    sectionId: 'inspection-report', blockId: 'shell-external',
    reason: 'Reviewer resolved this observation to the external shell block.',
  };
  const sealed = await sealContentsClassificationReview({ runtimeRun, decisions, reviewer });
  const corrected = sealed.reviewedClassification.classificationAssignments
    .find((item) => item.evidenceId === runtimeRun.reviewQueue[0].evidenceId);
  assert.equal(corrected.uses[0].blockId, 'shell-external');
  assert.equal(corrected.uses[0].method, 'human_corrected');
  const source = runtimeRun.atomization.evidenceAtoms.find((item) => item.evidenceId === corrected.evidenceId);
  assert.equal(sealed.reviewedClassification.evidenceAtoms.find((item) => item.evidenceId === corrected.evidenceId).evidenceSha256,
    source.evidenceSha256);
});

test('blocks a leaking Android export before atomization or model execution', async () => {
  const input = await inputFixture();
  input.exportPackage.voiceNotes[0].transcriptText = 'Route this to report section inspection-report.';
  input.rawExportBytes = Buffer.from(JSON.stringify(input.exportPackage));
  input.androidReceipt.exportSha256 = sha256(input.rawExportBytes);
  input.androidReceipt.exportByteSize = input.rawExportBytes.byteLength;
  let workerCalls = 0;
  await assert.rejects(() => runContentsClassificationEvaluationPathway({
    ...input, narrativeWorker: async () => { workerCalls += 1; return { classifications: [] }; },
  }), (error) => error instanceof ContentsClassificationPathwayBlockedError
    && error.stageId === 'android-export-input-guard');
  assert.equal(workerCalls, 0);
});

test('blocks section packaging when a sealed review artifact is changed', async () => {
  const { runtimeRun } = await runFixture();
  const sealed = await sealContentsClassificationReview({ runtimeRun, decisions: approveAll(runtimeRun), reviewer });
  const changed = structuredClone(sealed);
  changed.reviewRecords[0].reason = 'Changed after sealing.';
  assert.throws(() => buildSectionEvidencePackages({
    sealedDecisions: changed, reviewedSectionSelection: ['inspection-report'],
  }), /changed after sealing/);
});
