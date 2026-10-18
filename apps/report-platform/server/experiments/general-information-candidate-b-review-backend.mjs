import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  evaluateGeneralTankInformationRun,
  prepareGeneralTankInformationRun,
} from '../section-agents/evaluation-workflows/general-tank-information-v1/workflow.mjs';
import {
  ALL_FIELDS,
} from '../section-agents/sandbox/candidates/general-tank-information/candidate-b/generator/server/field-contract.mjs';

export const GENERAL_INFORMATION_CANDIDATE_B_CASE = 'eval-general-info-candidate-b-smoke-v1';
export const GENERAL_INFORMATION_CANDIDATE_B_CHOICE = Object.freeze({
  evaluationCaseId: GENERAL_INFORMATION_CANDIDATE_B_CASE,
  label: 'Section 3 · Candidate B · sandbox contract smoke',
  sectionIds: ['general-tank-information'],
});

const fixtureUrl = new URL('../report-evidence-router/releases/v2/test-fixtures/android-export.json', import.meta.url);
const canonical = (value) => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
const sha256 = (value) => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : canonical(value)).digest('hex');
const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const FIELD_VALUES = Object.freeze({
  client: 'Example Client',
  clientRepresentative: 'Example Representative',
  tankNumber: 'T-101',
  location: 'Example Yard',
  fieldLeaseName: 'Example Terminal',
  yearBuilt: '2005',
  originalManufacturer: 'Example Fabricator',
  height: '12 m',
  originalConstructionStd: 'API 650',
  serviceHeight: '10.5 m',
  materialSpec: 'Carbon Steel',
  diameter: '10 m',
  shellConstruction: 'Butt welded',
  productStored: 'Diesel',
  drawingRef: 'DWG-T101',
  specificGravity: '0.85',
  roofType: 'Fixed cone roof',
  designTemp: '60 °C',
  internalPressure: 'Atmospheric',
  courseNumber: '6',
  floorPlateNumber: '24',
  roofPlateNumber: '20',
  floorPlateThickness: '8 mm',
  windGirder: 'One',
  annularPlateNumber: '12',
  insulated: 'No',
  annularPlateThickness: '10 mm',
  stiffener: 'Top angle',
  previousExternal: '2021',
  previousInternal: '2016',
  previousBottom: '2016',
  jobNo: 'JOB-101',
  dateCompleted: '18 October 2026',
  inspector: 'Inspector One',
  externalRoofType: 'Yes',
  internalRoofType: 'No',
  insulationDistance: 'Not applicable',
});

const fieldDefinitionByKey = new Map(ALL_FIELDS.map((field) => [field.key, field]));
let cachedReview;

export async function loadGeneralInformationCandidateBReview({ evaluationCaseId, sectionId, evalRunId } = {}) {
  if (evaluationCaseId !== GENERAL_INFORMATION_CANDIDATE_B_CASE
      || (sectionId && sectionId !== 'general-tank-information')) {
    throw fail(404, 'General Tank Information Candidate B smoke case was not found.');
  }
  cachedReview ??= buildReview();
  const review = await cachedReview;
  if (evalRunId && evalRunId !== review.evalRunId) throw fail(404, 'Candidate B smoke run was not found.');
  return review;
}

async function buildReview() {
  const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'));
  const exportPackage = {
    ...fixture,
    inspectionReference: 'SECTION-WORKFLOW-GTI-UI-1',
    voiceNotes: [],
    inspectionChecklistItems: [],
    utMeasurements: [],
    attachments: [],
    inspectionRecord: {
      ...fixture.inspectionRecord,
      client: FIELD_VALUES.client,
      tankNumber: FIELD_VALUES.tankNumber,
      location: FIELD_VALUES.location,
      diameterM: 10,
      heightM: 12,
      shellCourseCount: 6,
      generalTankInformation: structuredClone(FIELD_VALUES),
    },
  };
  const rawExportBytes = Buffer.from(JSON.stringify(exportPackage));
  const preparedRun = await prepareGeneralTankInformationRun({
    exportPackage,
    rawExportBytes,
    androidReceipt: {
      packageType: 'laiq_android_app_export_receipt',
      schemaVersion: 2,
      producer: 'ProductStore.exportInspection',
      exportPackageId: 'section-workflow-gti-ui-package',
      inspectionId: exportPackage.inspectionId,
      inspectionReference: exportPackage.inspectionReference,
      exportSha256: sha256(rawExportBytes),
      exportByteSize: rawExportBytes.byteLength,
      caseId: 'section-workflow-gti-ui-case',
      caseRevision: 1,
      variant: 'structured-contract-smoke',
      goldSha256: 'b'.repeat(64),
      exportedAtIso: '2026-10-18T00:00:00.000Z',
    },
    lineageSecret: 'section-workflow-ui-secret-000000000000000000000000000000',
    referenceTextUnits: [],
    modelId: null,
    reviewDecisions: [],
    reviewer: {
      userId: 'sandbox-evaluation-reviewer',
      role: 'evaluation_reviewer',
      authorizationScope: 'contents_classification_review',
      reviewedAtIso: '2026-10-18T00:02:00.000Z',
    },
    generatedAtIso: '2026-10-18T00:01:00.000Z',
    context: {
      reportPlanId: 'report-plan:section-workflow-gti-ui',
      tenantId: 'tenant-evaluation',
      workspaceId: 'workspace-evaluation',
      reportJobId: 'report-job-gti-ui',
      importRevisionId: 'import-revision-gti-ui',
    },
  });
  if (preparedRun.status !== 'ready_for_sealed_gold_evaluation') {
    throw fail(409, `Candidate B smoke generation stopped with status ${preparedRun.status}.`);
  }
  const generatedAt = preparedRun.candidateExecution.generationResult.trace.generatedAtIso;
  const goldPacket = {
    contractVersion: 'sealed_general_information_gold_v1',
    sectionId: 'general-tank-information',
    sourceReportId: 'sealed-section-workflow-ui-fixture',
    expectedFields: ALL_FIELDS.map(({ key }) => ({ key, value: FIELD_VALUES[key] })),
    openedAfterGenerationAtIso: new Date(Date.parse(generatedAt) + 1_000).toISOString(),
  };
  goldPacket.goldPacketSha256 = sha256(goldPacket);
  const evaluated = await evaluateGeneralTankInformationRun({ preparedRun, goldPacket });
  const generation = preparedRun.candidateExecution.generationResult;
  const review = preparedRun.candidateExecution.preDisplayReview;
  const dispositionByEvidenceId = new Map(generation.evaluationEvidence.evidenceDisposition
    .map((item) => [item.evidenceId, item.status]));
  const evalRunId = `${GENERAL_INFORMATION_CANDIDATE_B_CASE}:${generation.candidate.candidateManifestSha256}`;
  const sectionAssessment = Object.fromEntries(Object.entries(evaluated.sectionAssessment).map(([key, value]) => [key, {
    status: value.status,
    grader: value.grader,
    explanation: value.explanation,
  }]));

  return Object.freeze({
    available: true,
    evaluationOnly: true,
    evaluationCaseId: GENERAL_INFORMATION_CANDIDATE_B_CASE,
    evalRunId,
    generationBackend: 'general_information_candidate_b_sandbox',
    generatorContractVersion: generation.contractVersion,
    evaluationDisplay: {
      banner: 'Section 3 Candidate B sandbox smoke: automated gates passed; rendered comparison and inspector acceptance remain pending. Product generation is disabled.',
      subtitle: 'General Tank Information · Candidate B · one transparent contract-smoke case',
      unitLabel: 'sandbox run',
      backendLabel: 'package-bound Section 3 workflow',
      evidenceMetricLabel: 'Expected field recall',
      originalMode: 'text',
      originalColumnLabel: 'Sealed expected field ledger',
      generationColumnLabel: 'Candidate B generation',
      evidenceColumnLabel: 'Reviewed app evidence package',
      referenceLabel: 'Synthetic contract fixture · no source PDF',
    },
    sectionAgentEvaluation: {
      reportCount: 1,
      developmentReports: 1,
      testReports: 0,
      fieldCount: ALL_FIELDS.length,
      sectionLabel: 'General Tank Information',
    },
    sectionWorkflowEvaluation: {
      candidateId: preparedRun.candidateId,
      workflowStatus: preparedRun.status,
      qualificationStatus: evaluated.status,
      guardDecision: review.decision,
      atomicRows: evaluated.atomicRows,
      sectionAssessment,
    },
    datasetSplit: 'sandbox_smoke',
    reportName: 'Section 3 · Candidate B · complete structured-field smoke case',
    sectionId: 'general-tank-information',
    sectionTitle: '3 GENERAL TANK INFORMATION',
    sourceReportName: 'Synthetic contract fixture',
    allSectionsComplete: true,
    revisionChoices: [GENERAL_INFORMATION_CANDIDATE_B_CHOICE],
    sections: [{
      evaluationCaseId: GENERAL_INFORMATION_CANDIDATE_B_CASE,
      reportName: 'Candidate B smoke case',
      sectionId: 'general-tank-information',
      sectionTitle: 'General Tank Information',
      completed: true,
      outcomeCode: evaluated.decision === 'pass' ? 'ready_for_review' : 'blocked',
      hardFailure: evaluated.decision !== 'pass',
    }],
    previousEvaluationCaseId: null,
    previousSectionId: null,
    nextEvaluationCaseId: null,
    nextSectionId: null,
    generatedContent: generation.draft.content,
    originalSectionContent: expectedFieldLedger(),
    appEvidence: preparedRun.sectionEvidencePackage.evidenceRecords.map((record) => {
      const definition = fieldDefinitionByKey.get(record.entity.field);
      return {
        evidenceId: record.evidenceId,
        sourceClass: 'app_field',
        sourcePointer: record.sourcePointer,
        label: definition?.label ?? record.entity.field,
        text: record.displayText,
        processedText: [`${record.blockId} · ${record.role} · ${record.routeMethod} route`],
        usedInGeneration: dispositionByEvidenceId.get(record.evidenceId) === 'rendered',
        issues: [],
        context: 'Accepted into the reviewed Section Evidence Package before generation.',
      };
    }),
    benchmarkStatus: 'sandbox_contract_smoke',
    metrics: {
      score: null,
      outcomeCode: evaluated.decision === 'pass' ? 'ready_for_review' : 'blocked',
      requiredFactRecall: evaluated.scores.expectedFieldRecall,
      claimPrecision: evaluated.scores.supportedClaimPrecision,
      protectedFactAccuracy: evaluated.scores.protectedFieldAccuracy,
      formatMatch: evaluated.scores.structuralFormatAlignment,
      professionalAcceptability: null,
      goldContentCoverage: null,
      outputLengthBalance: null,
      hardFailure: evaluated.decision !== 'pass',
      hardFailureReasons: evaluated.evaluation.unsupportedClaims,
      evaluationPoints: [{
        key: 'whole_section_coherence',
        label: 'Whole-section coherence',
        score: evaluated.scores.wholeSectionCoherence,
        statusCode: sectionAssessment.coherence.status,
        notes: [sectionAssessment.coherence.explanation],
      }],
    },
    diagnosticNotes: [
      'This transparent sandbox smoke case demonstrates the new Section 3 workflow and UI contract. It is not one of the pending current ProductStore qualification cases.',
      `${evaluated.atomicRows.filter((row) => row.status === 'pass').length}/${evaluated.atomicRows.length} sealed expected fields passed exact-value evaluation.`,
      `The independent no-gold reviewer returned ${review.decision}; gold opened only after generation.`,
      'No live model or runtime historical retrieval was used because this section is structured and deterministic.',
      'Rendered historical comparison and inspector acceptance are deliberately shown as not measured.',
    ],
    promotionGate: {
      eligible: false,
      reasons: ['Sandbox smoke only.', 'Rendered historical comparison pending.', 'Inspector acceptance pending.', 'Current ProductStore 10+1 qualification cohort incomplete.'],
      sectionCount: 1,
      passedSectionCount: evaluated.decision === 'pass' ? 1 : 0,
      thresholds: { requiredFactRecall: 1, claimPrecision: 1, protectedFactAccuracy: 1 },
    },
    createdAtIso: evaluated.evaluation.trace.evaluatedAtIso,
  });
}

function expectedFieldLedger() {
  const rows = ALL_FIELDS.map((field) => `| ${field.label} | ${FIELD_VALUES[field.key]} | ${field.disposition ?? 'section body'} |`);
  return ['3 GENERAL TANK INFORMATION', '', '| Expected field | Expected value | Destination |', '| --- | --- | --- |', ...rows].join('\n');
}

export const __test = { FIELD_VALUES };
