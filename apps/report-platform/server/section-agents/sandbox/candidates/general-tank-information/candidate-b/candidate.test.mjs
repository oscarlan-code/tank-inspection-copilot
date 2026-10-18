import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildSectionEvidencePackages,
  pathwaySha256,
  runContentsClassificationEvaluationPathway,
  sealContentsClassificationReview,
} from '../../../../../contents-classification-agent/evaluation-pathway.mjs';
import {
  buildPackageBoundGenerationExecution,
  buildPackageBoundReportPlan,
  buildPackageBoundSectionPlan,
} from '../../../../../report-plans/package-bound-section-plan.mjs';
import {
  evaluateSandboxCandidate,
  executeSandboxCandidate,
  getSandboxCandidateBinding,
  verifySandboxCandidate,
} from '../../../candidate-registry.mjs';

const exportFixtureUrl = new URL('../../../../../report-evidence-router/releases/v2/test-fixtures/android-export.json', import.meta.url);

const GENERAL_INFORMATION = Object.freeze({
  client: 'Pacific Energy SWP Ltd',
  clientRepresentative: 'Mr. Tevita Batiwale',
  jobNo: '18PE1-2',
  tankNumber: 'V4',
  dateCompleted: '6 June 2018',
  inspector: 'Inspector A & Inspector B',
  location: 'Vuda, Fiji',
  fieldLeaseName: 'Vuda Terminal',
  yearBuilt: '1968',
  originalManufacturer: 'Not Provided',
  originalConstructionStd: 'Not Provided',
  materialSpec: 'ASTM 283 Grade C',
  drawingRef: 'Previous Reports',
  shellConstruction: 'butt welded',
  roofType: 'Fixed Cone',
  externalRoofType: 'yes',
  internalRoofType: 'yes',
  height: '14.55 m',
  serviceHeight: '14.55 m',
  diameter: '12.2 m',
  productStored: 'Diesel',
  specificGravity: '0.82',
  designTemp: 'Not Provided',
  internalPressure: 'Not Provided',
  courseNumber: '8',
  floorPlateNumber: '15',
  roofPlateNumber: '15',
  floorPlateThickness: '10.0 mm',
  windGirder: 'No',
  annularPlateNumber: 'Nil',
  insulated: 'No',
  insulationDistance: '',
  annularPlateThickness: 'Not Applicable',
  stiffener: 'No',
  previousExternal: 'A1P58-1-3 (Nov 2013)',
  previousInternal: '06B3-12 (Oct 2006)',
  previousBottom: '06B3-12 (Oct 2006)',
});

const canonical = (value) => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
const sha256 = (value) => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');

async function buildEvidencePackage(fields = GENERAL_INFORMATION) {
  const source = JSON.parse(await readFile(exportFixtureUrl, 'utf8'));
  const exportPackage = {
    ...source,
    inspectionReference: 'PACKAGE-BOUND-GTI-CANDIDATE-A',
    inspectionRecord: { ...source.inspectionRecord, generalTankInformation: structuredClone(fields) },
    voiceNotes: [],
  };
  const rawExportBytes = Buffer.from(JSON.stringify(exportPackage));
  const result = await runContentsClassificationEvaluationPathway({
    exportPackage,
    rawExportBytes,
    androidReceipt: {
      packageType: 'laiq_android_app_export_receipt',
      schemaVersion: 2,
      producer: 'ProductStore.exportInspection',
      exportPackageId: 'candidate-b-package',
      inspectionId: exportPackage.inspectionId,
      inspectionReference: exportPackage.inspectionReference,
      exportSha256: pathwaySha256(rawExportBytes),
      exportByteSize: rawExportBytes.byteLength,
      caseId: 'candidate-b-contract-fixture',
      caseRevision: 1,
      variant: 'base-source-grounded',
      goldSha256: 'a'.repeat(64),
      exportedAtIso: '2026-10-17T00:00:00.000Z',
    },
    lineageSecret: 'candidate-b-contract-test-secret-000000000000000000000000000',
    referenceTextUnits: [],
    generatedAtIso: '2026-10-17T00:00:00.000Z',
  });
  assert.equal(result.runtimeRun.reviewQueue.length, 0);
  const sealed = await sealContentsClassificationReview({
    runtimeRun: result.runtimeRun,
    decisions: [],
    reviewer: {
      userId: 'candidate-b-reviewer',
      role: 'evaluation_reviewer',
      authorizationScope: 'contents_classification_review',
      reviewedAtIso: '2026-10-17T00:01:00.000Z',
    },
  });
  return buildSectionEvidencePackages({
    sealedDecisions: sealed,
    reviewedSectionSelection: ['general-tank-information'],
  }).packages[0];
}

async function buildExecution(fields = GENERAL_INFORMATION) {
  const candidateBinding = await getSandboxCandidateBinding({
    candidateId: 'general-tank-information-candidate-b',
    sectionId: 'general-tank-information',
    reportProfileId: 'vertical_tank_inspection_v1',
    executionMode: 'evaluation',
  });
  const sectionEvidencePackage = await buildEvidencePackage(fields);
  const reportPlan = buildPackageBoundReportPlan({
    reportPlanId: 'report-plan:candidate-b:test',
    tenantId: 'tenant-test',
    workspaceId: 'workspace-test',
    reportJobId: 'report-job-test',
    importRevisionId: 'import-revision-test',
    candidateBinding,
  });
  const sectionPlan = buildPackageBoundSectionPlan({ reportPlan, sectionEvidencePackage });
  return buildPackageBoundGenerationExecution({ reportPlan, sectionPlan, sectionEvidencePackage });
}

test('verifies Candidate B and runs the real classified-package handoff through generation and review', async () => {
  const verified = await verifySandboxCandidate({
    candidateId: 'general-tank-information-candidate-b',
    sectionId: 'general-tank-information',
    reportProfileId: 'vertical_tank_inspection_v1',
    executionMode: 'evaluation',
  });
  assert.equal(verified.manifest.productEnabled, false);
  const execution = await buildExecution();
  const result = await executeSandboxCandidate({ execution });
  assert.equal(result.displayEligible, true);
  assert.equal(result.preDisplayReview.decision, 'ready_for_review');
  assert.equal(result.preDisplayReview.userVisibility, 'allowed');
  assert.equal(result.generationResult.draft.approved, false);
  assert.equal(result.generationResult.validation.valid, true);
  assert.equal(result.generationResult.validation.checks.bodyFieldCount, 31);
  assert.equal(result.generationResult.validation.checks.projectedEvidenceCount, Object.keys(GENERAL_INFORMATION).length);
  assert.equal(result.generationResult.validation.checks.dispositionCount, Object.keys(GENERAL_INFORMATION).length);
  assert.equal(result.generationResult.validation.checks.unaccountedEvidenceCount, 0);
  assert.equal(result.generationResult.validation.checks.liveModelUsed, false);
  assert.equal(result.generationResult.validation.checks.runtimeRetrievalUsed, false);
  assert.match(result.generationResult.draft.content, /3 GENERAL TANK INFORMATION/);
  assert.match(result.generationResult.draft.content, /Height:<\/strong> 14\.55 m/);
  assert.doesNotMatch(result.generationResult.draft.content, /External Roof Present/);
  assert.equal(result.generationResult.draft.headerMetadata.find((item) => item.key === 'jobNo').value, '18PE1-2');
});

test('blocks missing units, missing required fields and conflicting aliases before display', async () => {
  for (const fields of [
    { ...GENERAL_INFORMATION, height: '14.55' },
    Object.fromEntries(Object.entries(GENERAL_INFORMATION).filter(([key]) => key !== 'client')),
    { ...GENERAL_INFORMATION, heightM: '99 m' },
  ]) {
    const result = await executeSandboxCandidate({ execution: await buildExecution(fields) });
    assert.equal(result.displayEligible, false);
    assert.equal(result.preDisplayReview.decision, 'blocked');
    assert.equal(result.generationResult.validation.valid, false);
  }
});

test('escapes field content and preserves exact units without printing support-only roof flags', async () => {
  const result = await executeSandboxCandidate({ execution: await buildExecution({
    ...GENERAL_INFORMATION,
    client: '<img src=x onerror=alert(1)>',
    floorPlateThickness: '0.375 in',
  }) });
  assert.equal(result.displayEligible, true);
  assert.match(result.generationResult.draft.content, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(result.generationResult.draft.content, /<img/);
  assert.match(result.generationResult.draft.content, /0\.375 in/);
  assert.doesNotMatch(result.generationResult.draft.content, /External Roof Present/);
});

test('fails closed on changed package, gold in generation and product execution', async () => {
  const execution = await buildExecution();
  const changed = structuredClone(execution);
  changed.sectionEvidencePackage.evidenceRecords[0].originalValue = 'Changed';
  await assert.rejects(() => executeSandboxCandidate({ execution: changed }), /changed after sealing|does not match/);
  await assert.rejects(() => executeSandboxCandidate({ execution: { ...execution, goldPacket: {} } }), /gold/i);
  await assert.rejects(() => executeSandboxCandidate({ execution: { ...execution, executionMode: 'product' } }), /evaluation-only/);
});

test('opens sealed structured gold only after generation and reports exact protected-field recovery', async () => {
  const candidateExecution = await executeSandboxCandidate({ execution: await buildExecution() });
  const goldPacket = {
    contractVersion: 'sealed_general_information_gold_v1',
    sectionId: 'general-tank-information',
    sourceReportId: 'sealed-contract-fixture',
    expectedFields: Object.entries(GENERAL_INFORMATION).map(([key, value]) => ({ key, value })),
    openedAfterGenerationAtIso: '2099-01-01T00:00:00.000Z',
  };
  goldPacket.goldPacketSha256 = sha256(goldPacket);
  const evaluation = await evaluateSandboxCandidate({ candidateExecution, goldPacket });
  assert.equal(evaluation.decision, 'pass');
  assert.equal(evaluation.scores.protectedFieldAccuracy, 1);
  assert.equal(evaluation.scores.supportedClaimPrecision, 1);
  assert.equal(evaluation.atomicRows.length, Object.keys(GENERAL_INFORMATION).length);
  assert.equal(evaluation.scores.structuralFormatAlignment, 1);
  assert.equal(evaluation.scores.wholeSectionCoherence, 1);
  assert.equal(evaluation.scores.renderedFormatAlignment, null);
  assert.equal(evaluation.sectionAssessment.structure.status, 'pass');
  assert.equal(evaluation.sectionAssessment.coherence.status, 'pass');
  assert.equal(evaluation.sectionAssessment.renderedComparison.status, 'not_measured');
  assert.equal(evaluation.sectionAssessment.inspectorAcceptance.status, 'not_measured');
  assert.equal(evaluation.qualificationStatus, 'automated_gates_passed_human_gates_pending');
});



test('rejects a generation artifact changed after the independent pre-display review', async () => {
  const candidateExecution = await executeSandboxCandidate({ execution: await buildExecution() });
  const changedExecution = structuredClone(candidateExecution);
  changedExecution.generationResult.draft.content = changedExecution.generationResult.draft.content.replace('Pacific Energy', 'Changed Energy');
  const goldPacket = {
    contractVersion: 'sealed_general_information_gold_v1',
    sectionId: 'general-tank-information',
    sourceReportId: 'sealed-contract-fixture',
    expectedFields: Object.entries(GENERAL_INFORMATION).map(([key, value]) => ({ key, value })),
    openedAfterGenerationAtIso: '2099-01-01T00:00:00.000Z',
  };
  goldPacket.goldPacketSha256 = sha256(goldPacket);
  await assert.rejects(() => evaluateSandboxCandidate({ candidateExecution: changedExecution, goldPacket }), /changed after pre-display review/);
});
