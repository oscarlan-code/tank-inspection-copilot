import { GENERAL_INFORMATION_REVIEW_CHOICE } from './general-information-review-backend.mjs';
// Read-only adapter to the existing authenticated Evaluation Lab. No AI on navigation.
import { readFile } from 'node:fs/promises';
import { ABLATION_CASES, ABLATION_CONTRACT, SECTION_IDS, sha } from './section-kb-ablation.mjs';
import { INSPECTOR_CASE, loadInspectorNotesReview } from './inspector-notes-review-backend.mjs';
import { OBSERVATION_CASES } from './kb-observation-comparison.mjs';
const root = new URL('../../docs/reviews/data/tk5452-kb-ablation-v1/', import.meta.url);
const check = (value, message) => { if (!value) throw Object.assign(new Error(message), { statusCode: 409 }); };

export function verifyAblationReview(review, bytes, manifest) {
  check(manifest.contractVersion === 'section_kb_ablation_review_manifest_v1' && manifest.evaluationOnly === true, 'Invalid KB comparison manifest');
  check(sha(bytes) === manifest.comparisonSha256, 'KB comparison artifact checksum changed');
  check(review.contractVersion === ABLATION_CONTRACT && review.evaluationOnly === true && review.policyPromotionPerformed === false, 'Invalid KB comparison boundary');
  check(review.inputSha256 === manifest.inputSha256 && review.results?.length === 4, 'KB comparison inputs/results mismatch');
  for (const sectionId of SECTION_IDS) {
    const rows = review.results.filter(row => row.sectionId === sectionId);
    check(rows.length === 2 && new Set(rows.map(row=>row.arm)).size === 2 && rows.every(row=>['without_kb','with_kb'].includes(row.arm)), 'KB comparison pair is incomplete');
    check(rows.every(row=>row.inputSha256 === review.inputSha256) && rows[0].baseRequestHash === rows[1].baseRequestHash && rows[0].modelId === rows[1].modelId, 'KB comparison conditions differ');
    check(review.evidence.some(item=>item.sectionId === sectionId && item.appEvidence.length), 'KB comparison evidence is missing');
  }
}

export async function loadSectionKbAblationReview({ evaluationCaseId, sectionId, evalRunId }) {
  const choice = ABLATION_CASES.find(item=>item.evaluationCaseId === evaluationCaseId);
  if (!choice) throw Object.assign(new Error('Saved KB comparison was not found'), { statusCode: 404 });
  if (!sectionId || sectionId === 'identity') sectionId = SECTION_IDS[0];
  if (!SECTION_IDS.includes(sectionId)) throw Object.assign(new Error('Section is not part of this two-section KB comparison'), { statusCode: 404 });
  const manifest = JSON.parse(await readFile(new URL('review-manifest.json', root), 'utf8'));
  const bytes = await readFile(new URL('comparison.json', root));
  const review = JSON.parse(bytes);
  verifyAblationReview(review, bytes, manifest);
  const baseline = await loadInspectorNotesReview({ evaluationCaseId: INSPECTOR_CASE, sectionId });
  const row = review.results.find(row=>row.sectionId === sectionId && row.arm === choice.arm);
  const peer = review.results.find(item=>item.sectionId === sectionId && item.arm !== choice.arm);
  const evidence = review.evidence.find(item=>item.sectionId === sectionId);
  const runId = `${evaluationCaseId}:${row.generationRun.runId}`;
  if (evalRunId && evalRunId !== runId) throw Object.assign(new Error('Saved KB comparison run was not found'), { statusCode: 404 });
  const index = SECTION_IDS.indexOf(sectionId);
  const reportName = `TK 5452 · ${choice.label}`;
  return { ...baseline, evaluationCaseId, evalRunId: runId, reportName,
    generationBackend: 'tk5452_kb_style_ablation_v1', experimentContract: ABLATION_CONTRACT,
    comparisonExperiment: { name: 'Two-section KB comparison', arm: choice.arm, label: choice.label, wordCount: row.words, peerWordCount: peer.words, modelId: row.modelId },
    revisionChoices: [GENERAL_INFORMATION_REVIEW_CHOICE,...ABLATION_CASES, ...OBSERVATION_CASES, { evaluationCaseId: INSPECTOR_CASE, label: 'Inspector notes · evaluation v2' }],
    sections: SECTION_IDS.map(id=>({ evaluationCaseId, reportName, sectionId: id, sectionTitle: id==='01-scope' ? '1 SCOPE OF INSPECTION' : '5 REPAIR RECOMMENDATIONS', completed: true, outcomeCode: 'needs_attention', hardFailure: false })),
    previousEvaluationCaseId: index > 0 ? evaluationCaseId : null, previousSectionId: SECTION_IDS[index-1] ?? null,
    nextEvaluationCaseId: index < 1 ? evaluationCaseId : null, nextSectionId: SECTION_IDS[index+1] ?? null,
    generatedContent: row.retainedContent, aiCandidateContent: row.candidateContent,
    originalSectionContent: evidence.originalSectionContent, appEvidence: evidence.appEvidence,
    rawAiResponse: { accepted: row.generationRun.usedLiveModel, modelId: row.modelId, findings: row.rawFindings },
    inputReadiness: { status: 'supplied', totalSections: 2, sectionsWithInputs: 2, sectionsWithoutInputs: 0, sections: SECTION_IDS.map(id=>({ sectionId: id, title: id, status: 'supplied', reasons: [] })) },
    metrics: { ...baseline.metrics, score: null, requiredFactRecall: null, claimPrecision: null, protectedFactAccuracy: null, outcomeCode: 'needs_attention', hardFailure: row.candidateEvaluation.blockerReasons.length > 0, hardFailureReasons: row.candidateEvaluation.blockerReasons, evaluationPoints: [] },
    captureAvailability: { ...baseline.captureAvailability, omittedCapturedFacts: [] },
    diagnosticNotes: [
      `${choice.label}. Identical mock, model, section plan, formatter and checks. ${row.words} words; the other version has ${peer.words}. One response per condition.${sectionId === '05-recommendations' && choice.arm === 'with_kb' ? ' Review concern: “tank foundation projection” should be checked against “floor projection” in the raw note. Preprocessing lost that specific context.' : ''}`,
      'The KB version adds curated writing patterns from two approved earlier reports for different assets. No reference answer text or additional current facts were supplied.',
      `${row.candidateEvaluation.missingRequiredObligationIds.length} statements were not confirmed by conservative wording checks. This is not a semantic omission count. All four AI responses remain unaccepted.`,
      ...(sectionId === '05-recommendations' && choice.arm === 'with_kb' ? ['The raw voice note identifies the floor projection. The isolated recommendation supplied only “projection” with the broad group “tank foundation”. Restore the specific physical context in a future input revision; these saved inputs and outputs remain unchanged.'] : []),
      ...review.limitations,
    ],
    promotionGate: { ...baseline.promotionGate, eligible: false, reasons: ['Small source-derived KB comparison; no independent promotion evidence.'], sectionCount: 2, passedSectionCount: 0 },
    createdAtIso: review.createdAtIso,
  };
}
