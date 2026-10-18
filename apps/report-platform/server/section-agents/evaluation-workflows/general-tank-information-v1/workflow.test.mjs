import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  ACTIVE_CANDIDATE_ID,
  evaluateGeneralTankInformationRun,
  prepareGeneralTankInformationRun,
} from './workflow.mjs';

const fixtureUrl = new URL('../../../report-evidence-router/releases/v2/test-fixtures/android-export.json', import.meta.url);
const canonical = (value) => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
const sha256 = (value) => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : canonical(value)).digest('hex');

const fields = Object.freeze({
  client: 'Example Client',
  clientRepresentative: 'Example Representative',
  jobNo: 'JOB-101',
  tankNumber: 'T-101',
  dateCompleted: '18 October 2026',
  inspector: 'Inspector One',
  location: 'Example Yard',
  height: '12 m',
  diameter: '10 m',
  courseNumber: '6',
  floorPlateThickness: '8 mm',
});

async function fixture() {
  const source = JSON.parse(await readFile(fixtureUrl, 'utf8'));
  const exportPackage = {
    ...source,
    inspectionReference: 'SECTION-WORKFLOW-GTI-1',
    inspectionRecord: { ...source.inspectionRecord, generalTankInformation: structuredClone(fields) },
  };
  const rawExportBytes = Buffer.from(JSON.stringify(exportPackage));
  return {
    exportPackage,
    rawExportBytes,
    androidReceipt: {
      packageType: 'laiq_android_app_export_receipt',
      schemaVersion: 2,
      producer: 'ProductStore.exportInspection',
      exportPackageId: 'section-workflow-gti-package',
      inspectionId: exportPackage.inspectionId,
      inspectionReference: exportPackage.inspectionReference,
      exportSha256: sha256(rawExportBytes),
      exportByteSize: rawExportBytes.byteLength,
      caseId: 'section-workflow-gti-case',
      caseRevision: 1,
      variant: 'natural-field-speech',
      goldSha256: 'b'.repeat(64),
      exportedAtIso: '2026-10-18T00:00:00.000Z',
    },
    lineageSecret: 'section-workflow-test-secret-000000000000000000000000000',
    referenceTextUnits: [],
    modelId: 'gpt-5.6-sol',
    narrativeWorker: async ({ atoms }) => ({ classifications: atoms.map((atom) => ({
      evidenceId: atom.evidenceId,
      decisionState: 'needs_review',
      sectionId: 'inspection-report',
      blockId: 'shell-external',
      role: 'supporting',
      sectionConfidence: 0.96,
      blockConfidence: 0.91,
      feedback: 'Bounded test proposal; independent review is still required.',
    })) }),
    generatedAtIso: '2026-10-18T00:01:00.000Z',
    context: {
      reportPlanId: 'report-plan:section-workflow-gti',
      tenantId: 'tenant-test',
      workspaceId: 'workspace-test',
      reportJobId: 'report-job-test',
      importRevisionId: 'import-revision-test',
    },
  };
}

const reviewer = {
  userId: 'authorized-evaluation-reviewer',
  role: 'evaluation_reviewer',
  authorizationScope: 'contents_classification_review',
  reviewedAtIso: '2026-10-18T00:02:00.000Z',
};

test('pauses before generation until every narrative proposal has an authorized review decision', async () => {
  const pending = await prepareGeneralTankInformationRun(await fixture());
  assert.equal(pending.status, 'awaiting_authorized_classification_review');
  assert.equal(pending.generationExecuted, false);
  assert(pending.reviewQueue.length > 0);
  assert.equal(Object.hasOwn(pending, 'candidateExecution'), false);
});

test('runs the complete reviewed handoff and keeps atomic and whole-section evaluation separate', async () => {
  const input = await fixture();
  const pending = await prepareGeneralTankInformationRun(input);
  const reviewDecisions = pending.reviewQueue.map((item) => ({
    reviewItemId: item.reviewItemId,
    action: 'approve',
    reason: 'Authorized reviewer confirmed the proposed non-General-Information route.',
  }));
  const preparedRun = await prepareGeneralTankInformationRun({ ...input, reviewDecisions, reviewer });
  assert.equal(preparedRun.candidateId, ACTIVE_CANDIDATE_ID);
  assert.equal(preparedRun.status, 'ready_for_sealed_gold_evaluation');
  assert.equal(preparedRun.sectionEvidencePackage.sectionId, 'general-tank-information');
  assert.equal(preparedRun.candidateExecution.displayEligible, true);
  assert.match(preparedRun.candidateExecution.generationResult.draft.content, /3 GENERAL TANK INFORMATION/);

  const goldPacket = {
    contractVersion: 'sealed_general_information_gold_v1',
    sectionId: 'general-tank-information',
    sourceReportId: 'sealed-section-workflow-fixture',
    expectedFields: Object.entries(fields).map(([key, value]) => ({ key, value })),
    openedAfterGenerationAtIso: '2099-01-01T00:00:00.000Z',
  };
  goldPacket.goldPacketSha256 = sha256(goldPacket);
  const result = await evaluateGeneralTankInformationRun({ preparedRun, goldPacket });
  assert.equal(result.decision, 'pass');
  assert.equal(result.atomicRows.length, Object.keys(fields).length);
  assert(result.atomicRows.every((row) => row.status === 'pass'));
  assert.equal(result.sectionAssessment.structure.status, 'pass');
  assert.equal(result.sectionAssessment.coherence.status, 'pass');
  assert.equal(result.sectionAssessment.renderedComparison.status, 'not_measured');
  assert.equal(result.sectionAssessment.inspectorAcceptance.status, 'not_measured');
  assert.equal(result.status, 'automated_gates_passed_human_gates_pending');
});

test('generation preparation rejects evaluator-only gold', async () => {
  const input = await fixture();
  await assert.rejects(() => prepareGeneralTankInformationRun({ ...input, goldPacket: {} }), /cannot receive goldPacket/);
});
