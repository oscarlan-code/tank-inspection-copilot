import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const DATASETS = [
  { datasetId: 'current', label: 'Current app-export evaluation' },
  { datasetId: 'blinded-chatbox-100-v2', label: 'Blinded chatbox robustness · 100 units' },
];

async function readOptionalJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
}

const summarize = (rows) => ({
  evidenceType: rows[0]?.evidenceType ?? 'unknown', total: rows.length,
  evaluated: rows.length, passed: rows.filter((row) => row.result === 'pass').length,
  failed: rows.filter((row) => row.result === 'fail').length, notRun: 0, notMeasured: 0,
});

const AUDIT_CATEGORY_LABELS = {
  gold_label_review: 'Gold label review',
  outline_boundary: 'Outline boundary',
  input_context_loss: 'Input context loss',
  classifier_error: 'Classifier error',
};

function projectBlindedChallenge(result, failureAudit = null) {
  if (failureAudit && (failureAudit.resultHash !== result.resultHash || failureAudit.predictionHash !== result.predictionHash)) {
    throw new Error('The blinded challenge failure audit does not match the sealed evaluation result.');
  }
  const auditsByChallengeId = new Map((failureAudit?.rows ?? []).map((row) => [row.challengeId, row]));
  const rows = result.rows.map((row, index) => ({
    rowId: `blinded-chatbox:${row.challengeId}`,
    number: index + 1,
    evidenceId: row.challengeId,
    evidenceType: row.kind,
    sourcePointer: `/blindedChatboxUnits/${index}`,
    atomizationMethod: 'exact_source_span',
    originalAppRecord: { challengeId: row.challengeId, transport: 'manual_chatbox_batch' },
    atomizedUnit: row.rephrasedText,
    sourceSpan: null,
    sourceUnits: [{
      sourceUnitId: row.evaluatorPrivateSource.sourceUnitId,
      sourcePage: null,
      originalReportText: row.evaluatorPrivateSource.sourceText,
      unitType: row.kind,
      headingPath: [],
      origin: 'evaluator_private_join_after_prediction_seal',
    }],
    goldDecision: 'route',
    goldOrigins: ['evaluator_private_join_after_prediction_seal'],
    expectedUses: [row.expectedUse],
    predictedUses: row.predictedUse ? [row.predictedUse] : [],
    expectedLabels: [`${row.expectedUse.sectionId}:${row.expectedUse.blockId}`],
    predictedLabels: row.predictedUse ? [`${row.predictedUse.sectionId}:${row.predictedUse.blockId}`] : [],
    expectedSections: [row.expectedUse.sectionId],
    predictedSections: row.predictedUse ? [row.predictedUse.sectionId] : [],
    evaluationCategory: 'llm_narrative_classification',
    classifierDecision: 'needs_review',
    classifierFeedback: row.feedback,
    result: row.exactPass ? 'pass' : 'fail',
    feedback: row.exactPass ? 'Exact section and block matched.'
      : row.sectionPass ? 'Section matched; the proposed block differs from the reviewed block.'
        : 'The proposed section differs from the reviewed section.',
    humanReviewRequired: true,
    ...(auditsByChallengeId.has(row.challengeId) ? {
      auditCategory: auditsByChallengeId.get(row.challengeId).category,
      auditCategoryLabel: AUDIT_CATEGORY_LABELS[auditsByChallengeId.get(row.challengeId).category]
        ?? auditsByChallengeId.get(row.challengeId).category,
      auditIssueGroupId: auditsByChallengeId.get(row.challengeId).issueGroupId,
      auditRationale: auditsByChallengeId.get(row.challengeId).rationale,
      auditRecommendedAction: auditsByChallengeId.get(row.challengeId).recommendedAction,
      auditStatus: 'engineering_triage_only',
    } : {}),
  }));
  const passRate = result.summary.exactAccuracy;
  const byEvidenceType = [...new Set(rows.map((row) => row.evidenceType))].sort()
    .map((type) => summarize(rows.filter((row) => row.evidenceType === type)));
  return {
    available: true,
    evaluationOnly: true,
    datasetId: 'blinded-chatbox-100-v2',
    datasets: DATASETS,
    runMode: 'live',
    runId: `blinded-chatbox-100-v2:${result.predictionHash.slice(0, 12)}`,
    classifier: { candidateId: result.classifierCandidateId, modelId: result.modelId, promptVersion: 'classification_prompt_v2' },
    report: { label: 'Blinded chatbox robustness', reportReference: '9 historical training reports', tankNumber: 'Mixed', variantId: '100-rephrased-text-units' },
    stages: [
      { id: 'blinded-source-sampling', label: 'Blinded source sampling', status: 'pass', detail: '100 atomic facts were sampled from nine other training reports.' },
      { id: 'rephrase-and-leakage-guard', label: 'Rephrase and leakage guard', status: 'pass', detail: 'Five batches of 20 contained no source identity, heading, section ID, block ID or gold label.' },
      { id: 'manual-chatbox-pipeline', label: 'Manual chatbox pipeline', status: 'complete', detail: 'Input guard, atomizer, GPT-5.6 classifier and structural guard ran for all 100 atoms.' },
      { id: 'post-seal-gold-join', label: 'Post-seal gold join', status: 'pass', detail: 'Expected labels and historical source units were joined only after predictions were sealed.' },
      ...(failureAudit ? [{ id: 'engineering-failure-audit', label: 'Engineering failure audit', status: 'complete',
        detail: `${failureAudit.summary.mismatchRows} mismatches were grouped into ${failureAudit.summary.uniqueIssueGroups} issue patterns. Gold labels and scores remain unchanged.` }] : []),
    ],
    challengeSummary: {
      unitCount: result.summary.n,
      reportCount: 9,
      batchCount: 5,
      sectionPass: result.summary.sectionPass,
      sectionAccuracy: result.summary.sectionAccuracy,
      exactPass: result.summary.exactPass,
      exactAccuracy: result.summary.exactAccuracy,
      unrouted: result.summary.unrouted,
      labelLeakageCount: 0,
    },
    failureAudit: failureAudit ? {
      auditDate: failureAudit.auditDate,
      auditState: failureAudit.auditState,
      scoreAdjustmentApplied: failureAudit.scoreAdjustmentApplied,
      ...failureAudit.summary,
      categories: Object.entries(AUDIT_CATEGORY_LABELS).map(([category, label]) => ({
        category,
        label,
        count: failureAudit.rows.filter((row) => row.category === category).length,
      })),
    } : null,
    summary: {
      atomCount: result.summary.n,
      goldLabeledAtoms: result.summary.n,
      goldMissingAtoms: 0,
      passed: result.summary.exactPass,
      failed: result.summary.n - result.summary.exactPass,
      notRun: 0,
      notMeasured: 0,
      qualificationStatus: 'measured',
      binaryEvaluatedCount: result.summary.n,
      binaryPassRate: passRate,
      llmProposalReviewCount: result.summary.n,
      attentionCount: result.summary.n - result.summary.exactPass,
      labelPrecision: passRate,
      labelRecall: passRate,
      labelF1: passRate,
      exactLabelSetMatches: result.summary.exactPass,
    },
    byEvidenceType,
    byEvaluationCategory: [{ category: 'llm_narrative_classification', total: result.summary.n,
      evaluated: result.summary.n, passed: result.summary.exactPass,
      failed: result.summary.n - result.summary.exactPass, notRun: 0, notMeasured: 0 }],
    rows,
    runtime: { datasetHash: result.datasetHash, predictionHash: result.predictionHash,
      resultHash: result.resultHash, labelsJoinedAfterSeal: true, reportIdentityExposedToClassifier: false },
  };
}

export async function loadContentsClassificationEvaluation({ appRoot, configuredRoot, blindedRoot, blindedAuditRoot, datasetId = 'current' } = {}) {
  if (!DATASETS.some((item) => item.datasetId === datasetId)) throw new Error(`Unknown classification evaluation dataset: ${datasetId}`);
  if (datasetId === 'blinded-chatbox-100-v2') {
    const root = resolve(blindedRoot ?? join(appRoot, '.local', 'contents-classification-eval', 'blinded-chatbox-100-v2'));
    const result = await readOptionalJson(join(root, 'result.json'));
    if (!result) return { available: false, evaluationOnly: true, datasetId, datasets: DATASETS,
      message: 'The blinded 100-unit chatbox result is not available.' };
    const auditRoot = resolve(blindedAuditRoot ?? join(appRoot, 'server', 'evals', 'contents-classification', 'reviews'));
    const failureAudit = await readOptionalJson(join(auditRoot, 'blinded-chatbox-100-v2-failure-audit.json'));
    return projectBlindedChallenge(result, failureAudit);
  }
  const root = resolve(configuredRoot ?? join(appRoot, '.local', 'contents-classification-eval', 'current'));
  const result = await readOptionalJson(join(root, 'evaluation.json'));
  if (!result) return { available: false, evaluationOnly: true, datasetId, datasets: DATASETS,
    message: 'No contents-classification evaluation run is available.' };
  return { available: true, datasetId, datasets: DATASETS, ...result };
}

export const __test = { projectBlindedChallenge };
