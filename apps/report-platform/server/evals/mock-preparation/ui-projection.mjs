import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { buildMockPreparationDataset } from './evaluation-dataset.mjs';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const TWENTY_UNIT_PILOT_ID = 'mock-preparation-pilot-20-variants-v1';
const FULL_CASE_RUN_ID = 'mock-preparation-full-case-v1';

async function readOptionalJson(path) {
  try { return await readJson(path); }
  catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
}

export async function resolveMockPreparationCaseRoot({ appRoot, configuredRoot } = {}) {
  if (configuredRoot) return resolve(configuredRoot);
  const config = await readOptionalJson(join(appRoot, '.local', 'mock-eval', 'current-case.json'));
  return config?.caseRoot ? resolve(config.caseRoot) : null;
}

function graderStatus(row, ids) {
  return row.graders.find((grader) => ids.includes(grader.id))?.status ?? 'not_applicable';
}

function projectDatasetRow(row) {
  return {
    rowId: row.rowId,
    variantId: row.variantId,
    sourceUnitId: row.input.sourceUnitId,
    semanticKey: row.input.semanticKey,
    unitType: row.input.unitType,
    appStyle: row.reference.appStyle,
    sourcePage: row.input.sourcePage,
    originalText: row.input.sourceText,
    protectedFacts: row.input.protectedFacts,
    allowedVariation: row.reference.allowedVariation,
    appEvidenceText: row.output.text,
    appEvidenceValue: row.output.value,
    appEvidenceRefs: row.output.appEvidenceRefs,
    appContext: row.output.appContext,
    gradingRoute: row.grading.route,
    gradingStatus: row.grading.status,
    graderId: row.grading.graderId,
    graderVersion: row.grading.graderVersion,
    modelId: row.grading.modelId,
    confidence: row.grading.confidence,
    humanReviewRequired: row.grading.humanReviewRequired,
    linkageStatus: graderStatus(row, ['app-record-linkage']),
    meaningStatus: graderStatus(row, ['exact-fact-alignment', 'semantic-meaning-alignment', 'visual-layout-alignment']),
    integrityStatus: graderStatus(row, ['truth-integrity']),
    result: row.result,
    explanation: row.feedback.explanation,
    missingFacts: row.feedback.missingFacts,
    alteredFacts: row.feedback.alteredFacts,
    unsupportedFacts: row.feedback.unsupportedFacts,
    contradictions: row.feedback.contradictions,
  };
}

function projectCalibration({ pilot, datasetRows }) {
  if (!pilot) return {
    available: false,
    summary: { judgments: 0, matches: 0, mismatches: 0, gatePassed: null },
    rows: [],
  };
  const outputByKey = new Map(datasetRows.map((row) => [`${row.variantId}:${row.sourceUnitId}`, row]));
  const rows = (pilot.judgments ?? []).map((judgment) => {
    const pair = outputByKey.get(`${judgment.variantId}:${judgment.sourceUnitId}`);
    return {
      ...judgment,
      sourcePage: pair?.sourcePage ?? null,
      originalText: pair?.originalText ?? '',
      appEvidenceText: pair?.appEvidenceText ?? '',
      appEvidenceRefs: pair?.appEvidenceRefs ?? [],
      appContext: pair?.appContext ?? null,
    };
  });
  const matches = rows.filter((row) => row.matched).length;
  return {
    available: true,
    purpose: 'Checks whether the evaluator reaches the expected judgment on labelled examples. It does not grade mock-data readiness.',
    completedAtIso: pilot.completedAtIso ?? null,
    modelIds: pilot.modelIds ?? [],
    scaleDecision: pilot.scaleDecision ?? '',
    summary: {
      judgments: rows.length,
      matches,
      mismatches: rows.length - matches,
      gatePassed: pilot.gatePassed ?? null,
    },
    rows,
  };
}

function projectCurrentRows(pilot) {
  if (!pilot?.available || !pilot.datasets || !pilot.rows) return [];
  return pilot.rows.flatMap((source) => pilot.datasets.map((dataset) => {
    const output = source.outputs[dataset.datasetId];
    const deterministic = dataset.generatorModel === 'deterministic';
    const pending = pilot.runKind === 'truth_review' || !String(output?.text ?? '').trim();
    const precheckIssues = output?.precheckIssues ?? [];
    const semanticallyGraded = ['preserved', 'partial', 'contradicted'].includes(output?.semanticVerdict)
      && ['pass', 'fail'].includes(output?.integrityVerdict);
    const preserved = output?.semanticVerdict === 'preserved' && output?.integrityVerdict === 'pass';
    const blocked = precheckIssues.length > 0;
    const gradingStatus = pending ? 'awaiting_generation'
      : blocked ? 'blocked_by_precheck'
        : semanticallyGraded ? 'complete' : 'not_run';
    return {
      rowId: `${source.factId}:${dataset.datasetId}`,
      variantId: dataset.datasetId,
      sourceUnitId: source.factId,
      semanticKey: source.factId,
      unitType: source.factType,
      appStyle: dataset.datasetId,
      sourcePage: source.sourcePage,
      originalText: source.originalText,
      protectedFacts: source.protectedFacts ?? { sourceMeaning: source.protectedMeaning },
      allowedVariation: deterministic
        ? 'Source wording may be retained.'
        : 'Wording may change; material meaning must remain fixed.',
      appEvidenceText: output?.text ?? '',
      appEvidenceValue: null,
      appEvidenceRefs: output?.noteId ? [output.noteId] : [],
      appContext: { voice: { screenLabel: 'Android product export', itemLabel: output?.noteId ?? '' } },
      gradingRoute: deterministic ? 'deterministic' : 'llm_semantic',
      gradingStatus,
      graderId: dataset.reviewer,
      graderVersion: pilot.pilotId ?? FULL_CASE_RUN_ID,
      modelId: deterministic ? null : dataset.reviewer,
      confidence: null,
      humanReviewRequired: false,
      linkageStatus: pending ? 'pending' : 'pass',
      meaningStatus: pending ? 'pending' : blocked ? 'not_measured' : output?.semanticVerdict ?? 'not_measured',
      integrityStatus: pending ? 'pending' : blocked ? 'not_measured' : output?.integrityVerdict ?? 'not_measured',
      result: pending ? 'pending' : blocked ? 'fail' : semanticallyGraded ? (preserved ? 'pass' : 'fail') : 'pending',
      explanation: output?.explanation || (blocked
        ? precheckIssues.join(' ')
        : pending
          ? 'Review this truth unit and its protected facts before mock generation.'
          : 'Semantic grading did not run because another note in this dataset failed the precheck.'),
      missingFacts: output?.missingFacts ?? [],
      alteredFacts: output?.alteredFacts ?? [],
      unsupportedFacts: output?.unsupportedFacts ?? [],
      contradictions: output?.contradictions ?? [],
    };
  }));
}

function projectCurrentSummary(pilot, rows) {
  const passedRows = rows.filter((row) => row.result === 'pass').length;
  const failedRows = rows.filter((row) => row.result === 'fail').length;
  const pendingRows = rows.filter((row) => row.result === 'pending').length;
  return {
    sourceSemanticUnits: pilot.sourceUnitCount ?? pilot.factCount ?? 0,
    voiceVariants: pilot.datasetCount ?? pilot.datasets?.length ?? 0,
    totalRows: rows.length,
    reviewedRows: rows.length - pendingRows,
    passedRows,
    failedRows,
    pendingRows,
    notApplicableRows: 0,
    semanticPending: rows.filter((row) => row.gradingRoute === 'llm_semantic' && row.result === 'pending').length,
    visualPending: 0,
    semanticGraded: rows.filter((row) => row.gradingRoute === 'llm_semantic'
      && row.gradingStatus === 'complete').length,
    humanReviewRequired: 0,
    qualificationDecision: pilot.decision ?? 'incomplete',
  };
}

function projectCurrentVariants(pilot, rows) {
  return (pilot.datasets ?? []).map((dataset) => {
    const variantRows = rows.filter((row) => row.variantId === dataset.datasetId);
    return {
      variantId: dataset.datasetId,
      totalRows: variantRows.length,
      passedRows: variantRows.filter((row) => row.result === 'pass').length,
      failedRows: variantRows.filter((row) => row.result === 'fail').length,
      pendingRows: variantRows.filter((row) => row.result === 'pending').length,
    };
  });
}

function projectCurrentGraders(pilot, rows) {
  const factChecks = rows.length;
  const passedFacts = rows.filter((row) => row.result === 'pass').length;
  const datasetCount = pilot.datasetCount ?? pilot.datasets?.length ?? 0;
  const unsupportedClaims = pilot.summary?.unsupportedClaims ?? 0;
  const androidPassed = pilot.summary?.androidPassedDatasets ?? 0;
  return [
    {
      id: 'approved-atomic-gold', type: 'deterministic', gate: 'hard',
      status: pilot.goldApproval?.approved ? 'pass' : 'fail',
      observed: pilot.goldApproval?.approved ? 'Approved' : 'Not approved', expected: 'Approved',
      explanation: 'The atomic fact ledger must be reviewed before generated variations are evaluated.',
    },
    {
      id: 'current-dataset-set', type: 'deterministic', gate: 'hard',
      status: pilot.completeDatasetSet ? 'pass' : 'fail',
      observed: `${datasetCount}/3 current datasets`, expected: '3/3 current datasets',
      explanation: 'The active run contains the source-grounded base, natural field speech, and concise field shorthand datasets.',
    },
    {
      id: 'fact-meaning-and-integrity', type: 'llm-and-deterministic', gate: 'hard',
      status: passedFacts === factChecks ? 'pass' : 'fail',
      observed: `${passedFacts}/${factChecks} fact checks passed`, expected: `${factChecks}/${factChecks}`,
      explanation: 'Every generated fact must preserve meaning and pass truth-integrity review.',
    },
    {
      id: 'unsupported-claims', type: 'llm-and-deterministic', gate: 'hard',
      status: unsupportedClaims === 0 ? 'pass' : 'fail',
      observed: `${unsupportedClaims} unsupported claims`, expected: '0',
      explanation: 'Generated mock evidence must not add claims that are absent from the approved source facts.',
    },
    {
      id: 'current-android-round-trip', type: 'deterministic', gate: 'hard',
      status: androidPassed === datasetCount && datasetCount > 0 ? 'pass' : 'not_run',
      observed: `${androidPassed}/${datasetCount} current exports passed`, expected: `${datasetCount}/${datasetCount}`,
      explanation: 'Only an Android round trip created after the current successful generation run is counted.',
    },
  ];
}

async function projectTwentyUnitPilot(caseRoot) {
  const fullCaseRoot = join(caseRoot, 'review', FULL_CASE_RUN_ID);
  const fullCaseResult = await readOptionalJson(join(fullCaseRoot, 'result.json'));
  const root = fullCaseResult ? fullCaseRoot : join(caseRoot, 'review', TWENTY_UNIT_PILOT_ID);
  const result = fullCaseResult ?? await readOptionalJson(join(root, 'result.json'));
  if (!result) {
    const [ledger, composition] = await Promise.all([
      readOptionalJson(join(fullCaseRoot, 'atomic-fact-ledger.json')),
      readOptionalJson(join(fullCaseRoot, 'composition-plan.json')),
    ]);
    if (!ledger?.facts?.length) return { available: false };
    const datasetId = 'truth-review';
    return {
      available: true,
      runKind: 'truth_review',
      pilotId: FULL_CASE_RUN_ID,
      decision: 'incomplete',
      factCount: ledger.facts.length,
      noteCount: composition?.noteCount ?? composition?.notes?.length ?? 0,
      sourceUnitCount: new Set(ledger.facts.flatMap((fact) => fact.sourceUnitIds ?? [fact.factId])).size,
      datasetCount: 1,
      modelId: null,
      completedAtIso: null,
      qualificationStatus: 'truth_review_required_before_generation',
      goldApproval: { approved: false, reason: 'human_review_pending' },
      completeDatasetSet: false,
      externalRequests: null,
      summary: { factChecks: ledger.facts.length, factFailures: 0, unsupportedClaims: 0,
        passedDatasets: 0, androidPassedDatasets: 0 },
      datasets: [{
        datasetId,
        decision: 'pending',
        generatorModel: 'not_run',
        reviewer: 'not_run',
        factFailures: 0,
        unsupportedClaims: 0,
        wordingMetrics: { clauseCount: 0, exactSourceClauseCount: 0, exactSourceClauseRate: 0,
          clausesWithEightWordOverlap: 0, eightWordOverlapRate: 0 },
        android: null,
      }],
      rows: ledger.facts.map((fact, index) => ({
        rowId: `truth-review:${fact.factId}`,
        number: index + 1,
        factId: fact.factId,
        factType: fact.factType,
        sourcePage: fact.sourcePage,
        originalText: fact.sourceText,
        protectedMeaning: fact.protectedMeaning,
        protectedFacts: fact.protectedFacts,
        outputs: { [datasetId]: {
          noteId: fact.noteId ?? fact.evidenceGroupId ?? '',
          text: '', semanticVerdict: 'pending', integrityVerdict: 'pending',
          explanation: 'Review this truth unit and its protected facts before mock generation.',
          missingFacts: [], alteredFacts: [], unsupportedFacts: [], contradictions: [],
        } },
      })),
      androidDecision: 'not_run',
    };
  }
  const [ledger, savedAndroidAudit, focusedRegression] = await Promise.all([
    readJson(join(root, 'atomic-fact-ledger.json')),
    readOptionalJson(join(root, 'android-round-trip-result.json')),
    readOptionalJson(join(root, 'regressions', 'explicit-inch-unit-v1.json')),
  ]);
  const regressionRows = focusedRegression?.contractVersion === 'mock_preparation_focused_regression_v1'
    && focusedRegression?.decision === 'pass'
    && focusedRegression?.goldSha256 === ledger.goldSha256
    ? focusedRegression.rows ?? []
    : [];
  const resultCompletedAt = Date.parse(result.completedAtIso ?? '');
  const auditCompletedAt = Date.parse(savedAndroidAudit?.auditedAtIso ?? '');
  const androidAudit = result.decision === 'pass'
    && Number.isFinite(resultCompletedAt)
    && Number.isFinite(auditCompletedAt)
    && auditCompletedAt >= resultCompletedAt
    ? savedAndroidAudit
    : null;
  const androidByDataset = new Map((androidAudit?.datasets ?? []).map((item) => [item.datasetId, item]));
  const datasets = await Promise.all((result.datasets ?? []).map(async (dataset) => {
    let accepted = await readOptionalJson(join(root, 'datasets', dataset.datasetId, 'accepted.json'));
    if (!accepted && dataset.batchResults) {
      const candidates = await Promise.all(dataset.batchResults.map(async (batch) => {
        const attempt = batch.attempts.at(-1)?.attempt;
        if (!attempt) return null;
        return readOptionalJson(join(root, 'datasets', dataset.datasetId, batch.batchId,
          `candidate-attempt-${attempt}.json`));
      }));
      accepted = {
        datasetId: dataset.datasetId,
        notes: candidates.filter(Boolean).flatMap((candidate) => candidate.notes ?? []),
      };
    }
    if (!accepted) throw new Error(`No candidate output is available for ${dataset.datasetId}.`);
    const finalAttempts = dataset.batchResults
      ? dataset.batchResults.map((batch) => batch.attempts.at(-1))
      : [await readJson(join(root, 'reviews', dataset.datasetId, `guard-attempt-${dataset.attempt}.json`))];
    const clausesByFact = new Map();
    for (const note of accepted.notes ?? []) {
      for (const clause of note.clauses ?? []) {
        for (const factId of clause.factIds ?? []) clausesByFact.set(factId, { noteId: note.noteId, text: clause.text });
      }
    }
    const factsById = new Map(finalAttempts.flatMap((attempt) => attempt?.facts ?? []).map((fact) => [fact.factId, fact]));
    const deterministicIssues = finalAttempts.flatMap((attempt) => attempt?.deterministicIssues ?? []);
    const appliedRegressions = regressionRows.filter((row) => row.datasetId === dataset.datasetId
      && normalizeSpace(clausesByFact.get(row.sourceUnitId)?.text) === normalizeSpace(row.generatedText));
    for (const regression of appliedRegressions) factsById.set(regression.sourceUnitId, {
      factId: regression.sourceUnitId,
      semanticVerdict: regression.semanticVerdict,
      integrityVerdict: regression.integrityVerdict,
      missingFacts: [], alteredFacts: [], unsupportedFacts: [], contradictions: [],
      explanation: regression.explanation,
    });
    const resolvedFactIds = new Set(appliedRegressions.map((row) => row.sourceUnitId));
    const resolvedNoteIds = new Set(appliedRegressions.map((row) => row.noteId).filter(Boolean));
    const factFailures = finalAttempts.flatMap((attempt) => attempt?.factFailures ?? [])
      .filter((failure) => !resolvedFactIds.has(failure.factId));
    const unsupportedClaims = finalAttempts.flatMap((attempt) => attempt?.unsupportedClaims ?? [])
      .filter((claim) => !resolvedNoteIds.has(claim.noteId));
    const generatorModels = [...new Set(finalAttempts.map((attempt) => attempt?.generatorModel).filter(Boolean))];
    const reviewers = [...new Set(finalAttempts.map((attempt) => attempt?.reviewer).filter(Boolean))];
    const clauses = (accepted.notes ?? []).flatMap((note) => note.clauses ?? []);
    const sourceByFact = new Map((ledger.facts ?? []).map((fact) => [fact.factId, fact.sourceText]));
    const exactSourceClauseCount = clauses.filter((clause) => (clause.factIds ?? [])
      .some((factId) => normalizeSpace(clause.text) === normalizeSpace(sourceByFact.get(factId)))).length;
    const android = androidByDataset.get(dataset.datasetId);
    return {
      datasetId: dataset.datasetId,
      decision: deterministicIssues.length === 0 && factFailures.length === 0 && unsupportedClaims.length === 0
        ? 'pass' : dataset.decision,
      generatorModel: generatorModels.join(', ') || dataset.generatorModel || 'unknown',
      reviewer: reviewers.join(', ') || dataset.reviewer || 'unknown',
      factFailures: factFailures.length || dataset.factFailures?.length || 0,
      deterministicIssues,
      unsupportedClaims: unsupportedClaims.length || dataset.unsupportedClaims?.length || 0,
      wordingMetrics: dataset.wordingMetrics ?? {
        clauseCount: clauses.length,
        exactSourceClauseCount,
        exactSourceClauseRate: clauses.length ? exactSourceClauseCount / clauses.length : 0,
        clausesWithEightWordOverlap: 0,
        eightWordOverlapRate: 0,
      },
      android: android ? {
        decision: android.decision,
        producer: android.android?.producer ?? '',
        voiceNotes: android.android?.voiceNotes ?? 0,
        voiceAttachments: android.android?.voiceAttachments ?? 0,
        exportSha256: android.android?.exportSha256 ?? '',
      } : null,
      focusedRegressionCount: appliedRegressions.length,
      clausesByFact,
      factsById,
    };
  }));
  const rows = (ledger.facts ?? []).map((fact, index) => ({
    rowId: `pilot:${fact.factId}`,
    number: index + 1,
    factId: fact.factId,
    factType: fact.factType,
    sourcePage: fact.sourcePage,
    originalText: fact.sourceText,
    protectedMeaning: fact.protectedMeaning,
    protectedFacts: fact.protectedFacts,
    outputs: Object.fromEntries(datasets.map((dataset) => {
      const clause = dataset.clausesByFact.get(fact.factId);
      const grade = dataset.factsById.get(fact.factId);
      return [dataset.datasetId, {
        noteId: clause?.noteId ?? '',
        text: clause?.text ?? '',
        semanticVerdict: grade?.semanticVerdict ?? 'not_measured',
        integrityVerdict: grade?.integrityVerdict ?? 'not_measured',
        explanation: grade?.explanation ?? '',
        precheckIssues: (dataset.deterministicIssues ?? []).filter((issue) =>
          clause?.noteId && issue.startsWith(`${clause.noteId} `)),
        missingFacts: grade?.missingFacts ?? [],
        alteredFacts: grade?.alteredFacts ?? [],
        unsupportedFacts: grade?.unsupportedFacts ?? [],
        contradictions: grade?.contradictions ?? [],
      }];
    })),
  }));
  const factFailures = datasets.reduce((sum, item) => sum + item.factFailures, 0);
  const unsupportedClaims = datasets.reduce((sum, item) => sum + item.unsupportedClaims, 0);
  const datasetCount = result.datasetCount ?? result.datasets?.length ?? 0;
  const decision = datasets.length > 0 && datasets.every((item) => item.decision === 'pass') ? 'pass' : result.decision;
  const focusedRegressionCount = datasets.reduce((sum, item) => sum + item.focusedRegressionCount, 0);
  return {
    available: true,
    runKind: fullCaseResult ? 'full_case' : 'pilot',
    pilotId: result.runId ?? result.pilotId,
    decision,
    factCount: result.factCount,
    noteCount: result.noteCount,
    sourceUnitCount: new Set((ledger.facts ?? []).flatMap((fact) => fact.sourceUnitIds ?? [fact.factId])).size,
    datasetCount,
    modelId: result.modelId,
    completedAtIso: focusedRegression?.completedAtIso ?? result.completedAtIso,
    qualificationStatus: focusedRegressionCount > 0 && decision === 'pass'
      ? 'focused_regression_pass_android_round_trip_required'
      : androidAudit?.qualificationStatus ?? result.qualificationStatus ?? '',
    goldApproval: result.goldApproval ?? { approved: false, reason: 'Approval was not recorded.' },
    completeDatasetSet: result.completeDatasetSet === true,
    externalRequests: result.externalRequests ?? null,
    summary: {
      factChecks: result.factCount * datasetCount,
      factFailures,
      unsupportedClaims,
      passedDatasets: datasets.filter((item) => item.decision === 'pass').length,
      androidPassedDatasets: datasets.filter((item) => item.android?.decision === 'pass').length,
    },
    datasets: datasets.map(({ clausesByFact: _clauses, factsById: _facts, ...dataset }) => dataset),
    rows,
    androidDecision: androidAudit?.decision ?? 'not_run',
  };
}

function normalizeSpace(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export async function loadMockPreparationEvaluation({ appRoot, configuredRoot } = {}) {
  const caseRoot = await resolveMockPreparationCaseRoot({ appRoot, configuredRoot });
  if (!caseRoot) return {
    available: false,
    evaluationOnly: true,
    message: 'No mock-preparation evaluation case is configured on this server.',
  };

  const [matrix, evaluation, pilot, deterministicReview, caseRecord, candidate, twentyUnitPilot, fullReport] = await Promise.all([
    readJson(join(caseRoot, 'semantic-pairs.json')),
    readOptionalJson(join(caseRoot, 'review', 'mock-preparation-eval.json')),
    readOptionalJson(join(caseRoot, 'review', 'semantic-judge-pilot-v1', 'result.json')),
    readOptionalJson(join(caseRoot, 'review', 'deterministic-review.json')),
    readOptionalJson(join(caseRoot, 'case.json')),
    readOptionalJson(join(caseRoot, 'eval-candidate.json')),
    projectTwentyUnitPilot(caseRoot),
    readOptionalJson(join(caseRoot, 'review', FULL_CASE_RUN_ID, 'full-report-evaluation.json')),
  ]);

  const dataset = buildMockPreparationDataset({ matrix, candidate, caseRecord });
  const legacyRows = dataset.rows.map(projectDatasetRow);
  const calibration = projectCalibration({ pilot, datasetRows: legacyRows });
  const currentFullCase = twentyUnitPilot?.available
    && ['full_case', 'truth_review'].includes(twentyUnitPilot.runKind);
  const rows = currentFullCase ? projectCurrentRows(twentyUnitPilot) : legacyRows;
  const semanticPending = rows.filter((row) => row.gradingRoute === 'llm_semantic' && row.gradingStatus !== 'complete').length;
  const visualPending = rows.filter((row) => row.gradingRoute === 'human_visual' && row.gradingStatus !== 'complete').length;
  const semanticGraded = rows.filter((row) => row.gradingRoute === 'llm_semantic' && row.gradingStatus === 'complete').length;
  const humanReviewRequired = rows.filter((row) => row.humanReviewRequired).length;
  const reviewedRows = rows.filter((row) => !['pending', 'not_applicable'].includes(row.result)
    && !row.humanReviewRequired).length;

  return {
    available: true,
    evaluationOnly: true,
    framework: {
      name: 'OpenAI-style dataset evaluation',
      rowDefinition: 'One source semantic unit paired with one generated app evidence output for one capture variation.',
      mockReadinessAndEvaluatorCalibrationSeparated: true,
    },
    case: {
      caseId: matrix.caseId,
      revision: matrix.caseRevision,
      label: caseRecord?.source?.sourcePath ? basename(caseRecord.source.sourcePath, '.pdf') : matrix.caseId,
      reportFamily: caseRecord?.source?.reportFamily ?? 'unknown',
      datasetSplit: caseRecord?.source?.sourceDatasetSplit ?? 'unknown',
      status: currentFullCase && twentyUnitPilot.goldApproval?.approved ? 'human_approved' : matrix.status,
    },
    candidate: evaluation?.candidate ?? candidate ?? { status: 'missing' },
    summary: currentFullCase ? projectCurrentSummary(twentyUnitPilot, rows) : {
      sourceSemanticUnits: matrix.summary?.semanticUnitCount ?? matrix.semanticUnits.length,
      voiceVariants: matrix.summary?.variantCount ?? matrix.variants.length,
      totalRows: dataset.summary.totalRows,
      reviewedRows,
      passedRows: dataset.summary.passedRows,
      failedRows: dataset.summary.failedRows,
      pendingRows: dataset.summary.pendingRows,
      notApplicableRows: dataset.summary.notApplicableRows,
      semanticPending,
      visualPending,
      semanticGraded,
      humanReviewRequired,
      qualificationDecision: evaluation?.decision ?? 'incomplete',
    },
    decision: {
      dataset: currentFullCase ? twentyUnitPilot.decision : evaluation?.decision ?? 'incomplete',
      nextAction: currentFullCase
        ? (twentyUnitPilot.runKind === 'truth_review'
          ? 'Review and approve the prepared truth units before mock generation.'
          : twentyUnitPilot.decision === 'pass'
            ? 'Pre-export mock evaluation passed. Run the Android round trip before freezing app-export mock data.'
            : 'Resolve the failing current full-case fact checks, then rerun the current Android round trip.')
        : evaluation?.nextAction ?? '',
    },
    variants: currentFullCase ? projectCurrentVariants(twentyUnitPilot, rows) : matrix.variants.map((variant) => {
      const variantRows = rows.filter((row) => row.variantId === variant.variantId);
      return {
        variantId: variant.variantId,
        totalRows: variantRows.length,
        passedRows: variantRows.filter((row) => row.result === 'pass').length,
        failedRows: variantRows.filter((row) => row.result === 'fail').length,
        pendingRows: variantRows.filter((row) => row.result === 'pending').length,
      };
    }),
    graders: currentFullCase ? projectCurrentGraders(twentyUnitPilot, rows) : (evaluation?.graders ?? []).map((grader) => ({
      id: grader.id,
      type: grader.type,
      gate: grader.gate,
      status: grader.status,
      observed: grader.observed,
      expected: grader.expected,
      explanation: grader.explanation,
    })),
    deterministicReview: !currentFullCase && deterministicReview ? {
      decision: deterministicReview.decision,
      variantCount: deterministicReview.checks?.exportVariantCount ?? 0,
      receiptCount: deterministicReview.checks?.appExportReceiptCount ?? 0,
      checklistItemCount: deterministicReview.checks?.checklistItemCount ?? 0,
      issueCount: Object.values(deterministicReview.issueCounts ?? {}).reduce((sum, value) => sum + Number(value || 0), 0),
    } : null,
    rows,
    calibration,
    pilot: twentyUnitPilot,
    fullReport: fullReport ? { available: true, ...fullReport } : { available: false },
  };
}
