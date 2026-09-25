// Read-only saved review adapter for the General Tank Information V2 qualification.
// It never generates, retrieves, learns, approves, or promotes.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const dataRoot = new URL('../../docs/reviews/data/general-tank-information-v2-historical/', import.meta.url);
const sourceRoot = new URL('../../docs/reviews/data/general-tank-information-v1/', import.meta.url);
const releaseManifest = new URL('../section-agents/releases/general-tank-information/v2/manifest.json', import.meta.url);
const cohort = loadPrivateCohort();
const sectionId = 'general-tank-information';

export const GENERAL_INFORMATION_REVIEW_SOURCES = cohort.cases.map(row => ({
  ...row,
  evaluationCaseId: `eval-general-info-v2-${row.caseId}`,
}));

export const GENERAL_INFORMATION_REVIEW_CHOICE = GENERAL_INFORMATION_REVIEW_SOURCES.length > 0
  ? {
      evaluationCaseId: GENERAL_INFORMATION_REVIEW_SOURCES[0].evaluationCaseId,
      label: 'General Tank Information V2 · 10 development + 1 held-out report',
      sectionIds: [sectionId],
    }
  : null;

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (condition, message) => {
  if (!condition) throw Object.assign(new Error(message), { statusCode: 409 });
};
const missing = message => Object.assign(new Error(message), { statusCode: 404 });
const bytes = (root, name) => readFile(new URL(name, root));
const json = async (root, name) => JSON.parse(await bytes(root, name));

export async function loadGeneralInformationReview(request) {
  const choice = GENERAL_INFORMATION_REVIEW_SOURCES.find(row => row.evaluationCaseId === request.evaluationCaseId);
  if (!choice || (request.sectionId && !['identity', sectionId].includes(request.sectionId))) {
    throw missing('General information V2 evaluation case or section not found.');
  }

  const [freeze, final, development, heldOut, manifestBytes, cohortBytes] = await Promise.all([
    json(dataRoot, 'development-freeze.json'),
    json(dataRoot, 'final-summary.json'),
    json(dataRoot, 'development-results.json'),
    json(dataRoot, 'held_out-results.json'),
    readFile(releaseManifest),
    bytes(sourceRoot, 'cohort.json'),
  ]);
  check(freeze.contractVersion === 'general_information_v2_development_freeze_v1', 'Invalid General Information V2 development freeze.');
  check(freeze.releaseManifestSha256 === digest(manifestBytes), 'General Information V2 release manifest changed.');
  check(freeze.cohortSha256 === digest(cohortBytes), 'General Information V2 historical cohort changed.');
  check(freeze.developmentResultsSha256 === digest(await bytes(dataRoot, 'development-results.json')), 'General Information V2 development results changed.');
  check(final.contractVersion === 'general_information_v2_historical_qualification_v1', 'Invalid General Information V2 final summary.');
  check(final.release === 'general_tank_information_v2' && final.manifestSha256 === freeze.releaseManifestSha256, 'General Information V2 release identity changed.');
  check(final.totalReports === 11 && final.totalFields === 341 && final.totalPreservedFields === 341, 'General Information V2 result totals changed.');
  check(final.originalSectionAvailableToGenerator === false && final.paidAiCalls === 0
    && final.runtimeRetrievals === 0 && final.promotionPerformed === false, 'General Information V2 evaluation boundary changed.');

  const resultSets = [development, heldOut];
  for (const result of resultSets) {
    check(result.release === final.release && result.manifestSha256 === final.manifestSha256, 'General Information V2 saved result uses a different release.');
    check(result.originalSectionAvailableToGenerator === false && result.paidAiCalls === 0
      && result.runtimeRetrievals === 0 && result.promotionPerformed === false, 'General Information V2 saved result crossed its evaluation boundary.');
  }
  const results = resultSets.flatMap(result => result.cases);
  check(results.length === 11 && new Set(results.map(row => row.sourceSha256)).size === 11, 'Expected eleven distinct General Information V2 report sources.');

  const index = results.findIndex(row => row.caseId === choice.caseId);
  const row = results[index];
  check(row && row.sourceSha256 === choice.sourceSha256, 'General Information V2 source identity changed.');
  check(row.passed && row.fieldCount === 31 && row.preservedFieldCount === 31, 'General Information V2 saved result no longer passes qualification.');
  check(row.fieldChecks.every(field => field.passed) && Object.values(row.structuralChecks).every(Boolean), 'General Information V2 saved checks changed.');

  const preparation = await json(dataRoot, `${row.split}-preparation.json`);
  const preparationPin = preparation.cases.find(item => item.caseId === row.caseId);
  check(preparationPin?.inputSha256 === row.inputSha256 && preparationPin?.expectedSha256 === row.expectedSha256, 'General Information V2 preparation pins changed.');
  check(digest(await bytes(dataRoot, `inputs/${row.caseId}.json`)) === row.inputSha256, 'General Information V2 input changed.');
  check(digest(await bytes(dataRoot, `evaluator-only/${row.caseId}-expected.json`)) === row.expectedSha256, 'General Information V2 expected ledger changed.');

  const runId = `${choice.evaluationCaseId}:${row.sectionPlanSha256}`;
  if (request.evalRunId && request.evalRunId !== runId) throw missing('Saved General Information V2 run not found.');

  const display = item => `${item.split === 'held_out' ? 'Held-out test' : 'Development'} · ${item.caseId} · ${sourceName(item.caseId)}`;
  const caseIdFor = item => `eval-general-info-v2-${item.caseId}`;
  const fieldCheckByKey = new Map(row.fieldChecks.map(field => [field.fieldKey, field]));
  return {
    available: true,
    evaluationOnly: true,
    evaluationCaseId: choice.evaluationCaseId,
    evalRunId: runId,
    generationBackend: 'general_information_section_agent_v2',
    generatorContractVersion: 'general_tank_information_v2',
    sectionAgentEvaluation: {
      reportCount: 11,
      developmentReports: 10,
      testReports: 1,
      fieldCount: 31,
      sectionLabel: 'General Tank Information',
    },
    datasetSplit: row.split === 'held_out' ? 'hidden_test' : 'development',
    reportName: display(row),
    sectionId,
    sectionTitle: '3 GENERAL TANK INFORMATION',
    sourceReportName: sourceName(row.caseId),
    sourcePdfUrl: `/api/v1/admin/generic-outline-reviews/${choice.evaluationCaseId}/source`,
    sourcePageNumber: row.sourcePage,
    referenceRevision: {
      contractVersion: 'general_information_v2_historical_evaluation_v1',
      pages: [row.sourcePage],
      sourceSha256: row.sourceSha256,
    },
    allSectionsComplete: true,
    revisionChoices: [
      { ...GENERAL_INFORMATION_REVIEW_CHOICE, evaluationCaseId: choice.evaluationCaseId },
      { evaluationCaseId: 'eval-tk5452-inspector-notes-v2', label: 'Inspector notes · previous 21-section evaluation', sectionIds: ['03-general-information'] },
    ],
    sections: results.map(item => ({
      evaluationCaseId: caseIdFor(item),
      reportName: display(item),
      sectionId,
      sectionTitle: 'General Tank Information',
      completed: true,
      outcomeCode: item.passed ? 'ready_for_review' : 'blocked',
      hardFailure: !item.passed,
    })),
    previousEvaluationCaseId: index > 0 ? caseIdFor(results[index - 1]) : null,
    previousSectionId: index > 0 ? sectionId : null,
    nextEvaluationCaseId: index < results.length - 1 ? caseIdFor(results[index + 1]) : null,
    nextSectionId: index < results.length - 1 ? sectionId : null,
    generatedContent: row.generatedSectionContent,
    originalSectionContent: row.originalSectionContent,
    appEvidence: row.processedEvidence.map(field => ({
      evidenceId: `general-info:${field.fieldKey}`,
      sourceClass: field.sourceClass,
      sourcePointer: field.sourcePointer,
      label: humanizeField(field.fieldKey),
      text: fieldCheckByKey.get(field.fieldKey)?.generatedDisplay ?? displayValue(field),
      processedText: [`Field: ${field.fieldKey}; state: ${field.state}.`],
      usedInGeneration: true,
      issues: [],
      context: field.sourceClass === 'app_field'
        ? 'Source-derived mock of a native app field; not an actual device capture.'
        : 'Confirmed report-side evaluation input; not currently exported as a native app field.',
    })),
    benchmarkStatus: 'paired_source_reconstruction',
    metrics: {
      score: null,
      outcomeCode: row.passed ? 'ready_for_review' : 'blocked',
      requiredFactRecall: row.preservedFieldCount / row.fieldCount,
      protectedFactAccuracy: row.preservedFieldCount / row.fieldCount,
      claimPrecision: null,
      formatMatch: Object.values(row.structuralChecks).every(Boolean) ? 1 : 0,
      professionalAcceptability: null,
      goldContentCoverage: null,
      outputLengthBalance: null,
      hardFailure: !row.passed,
      hardFailureReasons: [
        ...row.blockers,
        ...row.fieldChecks.filter(field => !field.passed).map(field => `${field.fieldKey} does not match its source value.`),
      ],
      evaluationPoints: [],
    },
    diagnosticNotes: [
      `${row.split === 'held_out' ? 'Held-out test after development freeze' : 'Development review'}: ${row.preservedFieldCount}/${row.fieldCount} labelled fields preserved through the V2 ReportPlan route.`,
      'The original historical section was unavailable to the generator and opened only by the evaluator after generation.',
      'Seven fields simulate native app export data; 24 fields are explicitly labelled report-side evaluation inputs.',
      'This structured section uses deterministic generation. No AI call or runtime KB retrieval occurred.',
      'Independent inspector review and actual-device export validation remain pending. Product generation was not promoted.',
    ],
    promotionGate: {
      eligible: false,
      reasons: ['Inspector confirmation and actual-device product integration review are pending.'],
      sectionCount: 11,
      passedSectionCount: results.filter(item => item.passed).length,
      thresholds: { requiredFactRecall: 1, claimPrecision: 0.9, protectedFactAccuracy: 1 },
    },
  };
}

function loadPrivateCohort() {
  try {
    const loaded = JSON.parse(readFileSync(new URL('cohort.json', sourceRoot), 'utf8'));
    return Array.isArray(loaded?.cases) ? loaded : { cases: [] };
  } catch (error) {
    if (error?.code === 'ENOENT') return { cases: [] };
    throw error;
  }
}

function sourceForCase(caseId) {
  return cohort.cases.find(item => item.caseId === caseId);
}

function sourceName(caseId) {
  return sourceForCase(caseId)?.sourcePath?.split('/').at(-1).replace(/\.pdf$/i, '') ?? caseId;
}

function displayValue(field) {
  return `${field.value ?? ''}${field.unit ? ` ${field.unit}` : ''}`;
}

function humanizeField(value) {
  return String(value).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, first => first.toUpperCase());
}
