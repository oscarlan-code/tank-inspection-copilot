// Read-only saved review adapter. Never generates, approves, learns or promotes.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
const root = new URL('../../docs/reviews/data/general-tank-information-v1/', import.meta.url);
const cohort = loadPrivateCohort();
const sectionId = 'general-tank-information';
export const GENERAL_INFORMATION_REVIEW_SOURCES = cohort.cases.map(row => ({ ...row, evaluationCaseId: `eval-general-info-v1-${row.caseId}` }));
export const GENERAL_INFORMATION_REVIEW_CHOICE = GENERAL_INFORMATION_REVIEW_SOURCES.length > 0
  ? { evaluationCaseId: GENERAL_INFORMATION_REVIEW_SOURCES[0].evaluationCaseId, label: 'General Tank Information · 10 development + 1 held-out report', sectionIds: [sectionId] }
  : null;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (condition, message) => { if (!condition) throw Object.assign(new Error(message), { statusCode: 409 }); };
const missing = message => Object.assign(new Error(message), { statusCode: 404 });
export async function loadGeneralInformationReview(request) {
  const choice = GENERAL_INFORMATION_REVIEW_SOURCES.find(row => row.evaluationCaseId === request.evaluationCaseId);
  if (!choice || (request.sectionId && !['identity', sectionId].includes(request.sectionId))) throw missing('General information evaluation case or section not found.');
  const manifest = JSON.parse(await readFile(new URL('review-manifest.json', root), 'utf8'));
  check(manifest.evaluationOnly && manifest.contractVersion === 'general_information_review_v1', 'Invalid general information review manifest.');
  check(digest(await readFile(new URL('cohort.json', root))) === manifest.files['cohort.json'], 'General information cohort changed.');
  const results = [];
  for (const split of ['development', 'held_out']) {
    const name = `${split}-results.json`, bytes = await readFile(new URL(name, root));
    check(digest(bytes) === manifest.files[name], 'General information saved results changed.');
    const result = JSON.parse(bytes);
    check(result.promotionPerformed === false && result.paidAiCalls === 0 && result.split === split, 'General information evaluation boundary changed.');
    results.push(...result.cases);
  }
  check(results.length === 11 && new Set(results.map(row => row.sourceSha256)).size === 11, 'Expected eleven distinct report sources.');
  const index = results.findIndex(row => row.caseId === choice.caseId), row = results[index];
  check(row && row.sourceSha256 === choice.sourceSha256, 'General information source identity changed.');
  const runId = `${choice.evaluationCaseId}:${row.generated.generationRun.runId}`;
  if (request.evalRunId && request.evalRunId !== runId) throw missing('Saved general information run not found.');
  const display = row => `${row.split === 'held_out' ? 'Held-out test' : 'Development'} · ${row.caseId} · ${row.sourcePath.split('/').at(-1).replace(/\.pdf$/i, '')}`;
  const caseIdFor = row => `eval-general-info-v1-${row.caseId}`;
  const checks = row.fieldChecks, fields = row.generated.evaluationEvidence.fields;
  return {
    available: true, evaluationOnly: true, evaluationCaseId: choice.evaluationCaseId, evalRunId: runId,
    generationBackend: 'general_information_section_agent_v1', generatorContractVersion: 'general_tank_information_v1',
    sectionAgentEvaluation: { reportCount: 11, developmentReports: 10, testReports: 1, fieldCount: 31, sectionLabel: 'General Tank Information' },
    datasetSplit: row.split === 'held_out' ? 'hidden_test' : 'development', reportName: display(row), sectionId,
    sectionTitle: '3 GENERAL TANK INFORMATION', sourceReportName: row.sourcePath.split('/').at(-1),
    sourcePdfUrl: `/api/v1/admin/generic-outline-reviews/${choice.evaluationCaseId}/source`, sourcePageNumber: row.sourcePage,
    referenceRevision: { contractVersion: 'general_information_evaluation_v1', pages: [row.sourcePage], sourceSha256: row.sourceSha256 },
    allSectionsComplete: true,
    revisionChoices: [{ ...GENERAL_INFORMATION_REVIEW_CHOICE, evaluationCaseId: choice.evaluationCaseId }, { evaluationCaseId: 'eval-tk5452-inspector-notes-v2', label: 'Inspector notes · previous 21-section evaluation', sectionIds: ['03-general-information'] }],
    sections: results.map(item => ({ evaluationCaseId: caseIdFor(item), reportName: display(item), sectionId, sectionTitle: 'General Tank Information', completed: true, outcomeCode: item.passed ? 'ready_for_review' : 'blocked', hardFailure: !item.passed })),
    previousEvaluationCaseId: index > 0 ? caseIdFor(results[index - 1]) : null, previousSectionId: index > 0 ? sectionId : null,
    nextEvaluationCaseId: index < results.length - 1 ? caseIdFor(results[index + 1]) : null, nextSectionId: index < results.length - 1 ? sectionId : null,
    generatedContent: row.generated.draft.content, originalSectionContent: row.originalSectionContent,
    appEvidence: fields.map(field => ({ evidenceId: field.evidenceId, sourceClass: field.sourceClass, sourcePointer: field.sourcePointer, label: field.label,
      text: field.displayValue, processedText: [`Field: ${field.key}; state: ${field.state}.`], usedInGeneration: true, issues: [],
      context: field.sourceClass === 'app_field' ? 'Source-derived mock of a native app field; not an actual device capture.' : 'Structured report-side supplement; supplied for this evaluation, not exported by the current app or independently approved by an inspector.' })),
    benchmarkStatus: 'paired_source_reconstruction',
    metrics: { score: null, outcomeCode: row.passed ? 'ready_for_review' : 'blocked', requiredFactRecall: row.preservedFieldCount / row.fieldCount,
      protectedFactAccuracy: row.preservedFieldCount / row.fieldCount, claimPrecision: null, formatMatch: null, professionalAcceptability: null,
      goldContentCoverage: null, outputLengthBalance: null, hardFailure: !row.passed,
      hardFailureReasons: [...row.generated.generationRun.blockers, ...checks.filter(field => !field.passed).map(field => `${field.fieldKey} does not match its source value.`)], evaluationPoints: [] },
    diagnosticNotes: [
      `${row.split === 'held_out' ? 'Held-out test after development freeze' : 'Development review'}: ${row.preservedFieldCount}/${row.fieldCount} labelled fields preserved. Deterministic generation; no AI calls or KB retrieval.`,
      'Each report supplies seven native app fields and 24 separately labelled report-side fields. This does not claim that the app export alone contains all 31 fields.',
      'Ten distinct reports were used for development. The eleventh report was opened only after the generator, preparer and evaluator hashes were frozen; no changes were made to improve its test result.',
      cohort.priorExposure,
      'These structured reconstruction fixtures test field/value placement and units. They do not test inspector voice interpretation, ASR, historical reasoning, or complete app export readiness.',
      'Source fields and page layouts were checked by Codex; independent inspector review is pending. DOCX field/table structure was checked; visual DOCX rendering is unavailable because LibreOffice is not installed.',
      'Section agent remains an evaluation candidate. Production generation, model and policy are unchanged.',
    ],
    promotionGate: { eligible: false, reasons: ['Inspector confirmation and product integration review pending.'], sectionCount: 11, passedSectionCount: results.filter(row => row.passed).length, thresholds: { requiredFactRecall: 1, claimPrecision: 0.9, protectedFactAccuracy: 1 } },
    createdAtIso: row.generated.generationRun.generatedAtIso,
  };
}

function loadPrivateCohort() {
  try {
    const loaded = JSON.parse(readFileSync(new URL('cohort.json', root), 'utf8'));
    return Array.isArray(loaded?.cases) ? loaded : { cases: [], priorExposure: null };
  } catch (error) {
    if (error?.code === 'ENOENT') return { cases: [], priorExposure: null };
    throw error;
  }
}
