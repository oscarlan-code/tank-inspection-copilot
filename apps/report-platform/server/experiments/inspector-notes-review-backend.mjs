import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { ABLATION_CASES } from './section-kb-ablation.mjs';
import { OBSERVATION_CASES } from './kb-observation-comparison.mjs';
import { GENERAL_INFORMATION_REVIEW_CHOICE } from './general-information-review-backend.mjs';
const root = new URL('../../docs/reviews/data/tk5452-inspector-evaluation-v2/', import.meta.url);
export const INSPECTOR_CASE = 'eval-tk5452-inspector-notes-v2';
export async function loadInspectorNotesReview({ evaluationCaseId, sectionId, evalRunId }) {
  const check = (condition, message) => { if (!condition) throw Object.assign(new Error(message), { statusCode: 409 }); };
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
  check(manifest.contractVersion === 'tk5452_inspector_review_manifest_v2' && manifest.caseId === INSPECTOR_CASE && manifest.evaluationOnly, 'Invalid inspector-note manifest');
  check(Object.keys(manifest.files).sort().join(',') === ['generation-input.json','review.json','section-planning.json'].sort().join(','), 'Unexpected inspector-note artifact');
  const files = {};
  for (const [name, expected] of Object.entries(manifest.files)) {
    const bytes = await readFile(new URL(name, root));
    check(createHash('sha256').update(bytes).digest('hex') === expected, `Inspector-note artifact changed: ${name}`);
    files[name] = JSON.parse(bytes);
  }
  const review = files['review.json'];
  check(review.caseId === INSPECTOR_CASE && review.evaluationOnly && review.sections.length === 21 && review.source.sha256 === '871d8770a5667bdbc3f0623a3a2e3ace54abcaf07acbd27017610ec24407de92', 'Inspector-note review identity mismatch');
  check(review.maintenanceRegimeAiCalls === 0 && review.policyPromotionPerformed === false && review.productionProfileChanged === false, 'Inspector-note evaluation boundary failed');
  if (!sectionId || sectionId === 'identity') sectionId = '03-general-information';
  const index = review.sections.findIndex(section => section.sectionId === sectionId);
  if (index < 0) throw Object.assign(new Error('Inspector-note evaluation section was not found'), { statusCode: 404 });
  const section = review.sections[index];
  const runId = `${evaluationCaseId}:${section.generationRun.runId}`;
  if (evalRunId && evalRunId !== runId) throw Object.assign(new Error('Saved inspector-note run was not found'), { statusCode: 404 });
  const reportName = 'TK 5452 · inspector-note reconstruction v2';
  return { available: true, evaluationOnly: true, evaluationCaseId, evalRunId: runId, generationBackend: review.generationBackend,
    datasetSplit: 'evaluation_only', reportName, sectionId, sectionTitle: `${section.sectionNumber} ${section.title}`,
    sourceReportName: review.source.fileName, sourcePdfUrl: `/api/v1/admin/generic-outline-reviews/${evaluationCaseId}/source`, sourcePageNumber: section.pages[0],
    referenceRevision: { contractVersion: review.contractVersion, pages: section.pages, sourceSha256: review.source.sha256 },
    allSectionsComplete: true, revisionChoices: [GENERAL_INFORMATION_REVIEW_CHOICE, { evaluationCaseId: INSPECTOR_CASE, label: 'Inspector notes · evaluation v2' }, ...OBSERVATION_CASES, ...ABLATION_CASES, { evaluationCaseId: 'eval-paired-tk5452-v1', label: 'Previous v1 · contaminated comparison' }],
    sections: review.sections.map(item => ({ evaluationCaseId, reportName, sectionId: item.sectionId, sectionTitle: `${item.sectionNumber} ${item.title}`, completed: true, outcomeCode: item.metrics.outcomeCode, hardFailure: item.metrics.hardFailure })),
    previousEvaluationCaseId: index > 0 ? evaluationCaseId : null, previousSectionId: review.sections[index - 1]?.sectionId ?? null,
    nextEvaluationCaseId: index < review.sections.length - 1 ? evaluationCaseId : null, nextSectionId: review.sections[index + 1]?.sectionId ?? null,
    generatedContent: section.generatedContent, aiCandidateContent: section.aiCandidateContent, originalSectionContent: section.originalSectionContent, appEvidence: section.appEvidence,
    inputReadiness: review.inputReadiness,
    rawAiResponse: section.rawAiResponse, metrics: section.metrics, captureAvailability: section.captureAvailability,
    generatorContractVersion: review.generatorContractVersion, benchmarkStatus: 'diagnostic_unreviewed_obligations',
    sectionPlanEvaluation: { contractVersion: section.evaluation.contractVersion, denominatorSource: section.evaluation.denominatorSource },
    diagnosticNotes: [review.performanceScope,
      section.generationRun.usedLiveModel ? 'Live AI wording was accepted for this section.' : section.rawAiResponse ? 'The live AI response did not pass validation. The generation column can show its review-only preview or the retained draft.' : 'This section was compiled without an AI call.',
      'The evidence column shows actual app-style mock inputs. Report-side structured additions and standard templates are labelled separately.',
      'Content metrics check frozen input requirements conservatively. There is no independent overall recovery score.',
      ...section.generationRun.warnings, ...section.captureAvailability.withheldFacts.map(item => item.text),
      'Evaluation only; no model or policy promotion.'],
    promotionGate: { eligible: false, reasons: ['Source-derived evaluation only.'], sectionCount: 21, passedSectionCount: 0, thresholds: { requiredFactRecall: 0.8, claimPrecision: 0.9, protectedFactAccuracy: 0.99 } }, createdAtIso: review.createdAtIso };
}
