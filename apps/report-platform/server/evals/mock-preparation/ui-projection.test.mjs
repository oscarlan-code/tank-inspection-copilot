import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadMockPreparationEvaluation } from './ui-projection.mjs';

const save = async (path, value) => writeFile(path, `${JSON.stringify(value)}\n`);

test('separates real mock-output rows from evaluator calibration rows', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mock-eval-ui-'));
  await mkdir(join(root, 'review', 'semantic-judge-pilot-v1'), { recursive: true });
  await save(join(root, 'case.json'), { source: { sourcePath: 'reports/TK-1.pdf', reportFamily: 'vertical', sourceDatasetSplit: 'validation', sourceSha256: 'source-hash' } });
  await save(join(root, 'semantic-pairs.json'), {
    contractVersion: 'source_mock_semantic_matrix_v1',
    caseId: 'case-1', caseRevision: 2, status: 'review_draft',
    summary: { semanticUnitCount: 1, variantCount: 1, pairCount: 1 },
    semanticUnits: [{ sourceUnitId: 'unit-1', semanticKey: 'roof.condition', unitType: 'observation', appCapability: 'capturable', evidenceGroupId: 'obs-1', criticality: 'critical', evaluationMode: 'semantic', protectedFacts: { condition: 'corrosion' }, sourceEvidence: [{ page: 8, text: 'Roof corrosion was observed.' }] }],
    variants: [{ variantId: 'concise', rows: [{ sourceUnitId: 'unit-1', goldText: 'Roof corrosion was observed.', mockText: 'Roof has corrosion.', mockEvidenceRefs: ['voice/1'], mockContext: { voice: { screenLabel: 'Findings', itemLabel: 'Roof' } }, reviewed: false }] }],
  });
  await save(join(root, 'review', 'mock-preparation-eval.json'), { candidate: { status: 'missing' }, decision: 'incomplete', nextAction: 'Review row.', graders: [{ id: 'semantic', type: 'llm', gate: 'hard', status: 'not_run', observed: '0/1', expected: '1/1', explanation: 'Awaiting review.' }] });
  await save(join(root, 'review', 'deterministic-review.json'), { decision: 'pass', checks: { exportVariantCount: 1, appExportReceiptCount: 1, checklistItemCount: 195 }, issueCounts: {} });
  await save(join(root, 'review', 'semantic-judge-pilot-v1', 'result.json'), { gatePassed: true, scaleDecision: 'Scale.', completedAtIso: '2026-10-08T00:00:00.000Z', modelIds: ['gpt-test'], judgments: [{ variantId: 'concise', sourceUnitId: 'unit-1', caseType: 'paraphrase', expectedSemanticVerdict: 'preserved', actualSemanticVerdict: 'preserved', expectedIntegrityVerdict: 'pass', actualIntegrityVerdict: 'pass', matched: true, explanation: 'Meaning preserved.', missingFacts: [], alteredFacts: [], unsupportedFacts: [] }] });

  const result = await loadMockPreparationEvaluation({ appRoot: root, configuredRoot: root });
  assert.equal(result.available, true);
  assert.equal(result.case.label, 'TK-1');
  assert.equal(result.summary.totalRows, 1);
  assert.equal(result.summary.pendingRows, 1);
  assert.equal(result.rows[0].originalText, 'Roof corrosion was observed.');
  assert.equal(result.rows[0].appEvidenceText, 'Roof has corrosion.');
  assert.equal(result.rows[0].result, 'pending');
  assert.equal(result.rows[0].gradingRoute, 'llm_semantic');
  assert.equal(result.rows[0].gradingStatus, 'awaiting_llm_semantic_grading');
  assert.equal(result.summary.semanticPending, 1);
  assert.equal(result.summary.visualPending, 0);
  assert.equal(result.calibration.summary.matches, 1);
  assert.equal(result.calibration.rows[0].matched, true);
  assert.equal(result.framework.mockReadinessAndEvaluatorCalibrationSeparated, true);
});

test('uses the current full-case datasets and does not require the archived legacy evaluation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mock-eval-ui-current-'));
  const runRoot = join(root, 'review', 'mock-preparation-full-case-v1');
  await mkdir(runRoot, { recursive: true });
  await save(join(root, 'case.json'), { source: { sourcePath: 'reports/TK-5452.pdf', reportFamily: 'vertical', sourceDatasetSplit: 'validation' } });
  await save(join(root, 'semantic-pairs.json'), {
    contractVersion: 'source_mock_semantic_matrix_v1',
    caseId: 'case-current', caseRevision: 3, status: 'reviewed',
    summary: { semanticUnitCount: 1, variantCount: 1, pairCount: 1 },
    semanticUnits: [{ sourceUnitId: 'legacy-unit', semanticKey: 'legacy.unit', unitType: 'observation', appCapability: 'capturable', evidenceGroupId: 'legacy', criticality: 'critical', evaluationMode: 'semantic', protectedFacts: {}, sourceEvidence: [{ page: 1, text: 'Legacy source.' }] }],
    variants: [{ variantId: 'legacy-six-variation-row', rows: [{ sourceUnitId: 'legacy-unit', goldText: 'Legacy source.', mockText: 'Legacy output.', mockEvidenceRefs: [], mockContext: {}, reviewed: false }] }],
  });
  await save(join(runRoot, 'atomic-fact-ledger.json'), {
    facts: [{ factId: 'fact-1', factType: 'observation', sourcePage: 10, sourceText: 'Roof vent nozzle was not trimmed flush.', protectedMeaning: 'Roof vent nozzle was not trimmed flush.', sourceUnitIds: ['unit-1'] }],
  });

  const definitions = [
    { datasetId: 'base-source-grounded', generatorModel: 'deterministic', reviewer: 'deterministic-exact-lineage', decision: 'pass', semanticVerdict: 'preserved', integrityVerdict: 'pass', text: 'Roof vent nozzle was not trimmed flush.' },
    { datasetId: 'natural-field-speech', generatorModel: 'gpt-5.6-sol', reviewer: 'gpt-5.6-sol', decision: 'pass', semanticVerdict: 'preserved', integrityVerdict: 'pass', text: 'Roof vent nozzle is sitting proud and needs trimming flush.' },
    { datasetId: 'concise-field-shorthand', generatorModel: 'gpt-5.6-sol', reviewer: 'gpt-5.6-sol', decision: 'fail', semanticVerdict: 'partial', integrityVerdict: 'fail', text: 'Roof vent 3 in, not flush.' },
  ];
  for (const definition of definitions) {
    const datasetRoot = join(runRoot, 'datasets', definition.datasetId);
    await mkdir(datasetRoot, { recursive: true });
    await save(join(datasetRoot, 'accepted.json'), { datasetId: definition.datasetId, notes: [{ noteId: `note-${definition.datasetId}`, clauses: [{ factIds: ['fact-1'], text: definition.text }] }] });
  }
  await save(join(runRoot, 'result.json'), {
    runId: 'mock-preparation-full-case-v1', decision: 'fail', factCount: 1, noteCount: 1, datasetCount: 3,
    completedAtIso: '2026-10-14T09:00:00.000Z', goldApproval: { approved: true }, completeDatasetSet: true,
    datasets: definitions.map((definition) => ({
      datasetId: definition.datasetId, decision: definition.decision,
      batchResults: [{ batchId: 'batch-01', attempts: [{
        attempt: 1, generatorModel: definition.generatorModel, reviewer: definition.reviewer,
        factFailures: definition.decision === 'pass' ? [] : [{ factId: 'fact-1' }], unsupportedClaims: [],
        facts: [{ factId: 'fact-1', semanticVerdict: definition.semanticVerdict, integrityVerdict: definition.integrityVerdict,
          missingFacts: [], alteredFacts: definition.decision === 'pass' ? [] : ['Unsupported unit conversion.'], explanation: definition.decision === 'pass' ? 'Meaning preserved.' : 'Unit conversion is unsupported.' }],
      }] }],
    })),
  });

  const result = await loadMockPreparationEvaluation({ appRoot: root, configuredRoot: root });
  assert.equal(result.available, true);
  assert.equal(result.summary.totalRows, 3);
  assert.equal(result.summary.passedRows, 2);
  assert.equal(result.summary.failedRows, 1);
  assert.equal(result.case.status, 'human_approved');
  assert.deepEqual(result.variants.map((item) => item.variantId), definitions.map((item) => item.datasetId));
  assert.equal(result.rows.some((row) => row.variantId === 'legacy-six-variation-row'), false);
  assert.equal(result.rows.find((row) => row.variantId === 'concise-field-shorthand').alteredFacts[0], 'Unsupported unit conversion.');
  assert.equal(result.graders.find((grader) => grader.id === 'fact-meaning-and-integrity').status, 'fail');

  await mkdir(join(runRoot, 'regressions'), { recursive: true });
  await save(join(runRoot, 'atomic-fact-ledger.json'), {
    goldSha256: 'corrected-gold',
    facts: [{ factId: 'fact-1', factType: 'observation', sourcePage: 10, sourceText: 'Roof vent nozzle was not trimmed flush.', protectedMeaning: 'Roof vent nozzle was not trimmed flush.', sourceUnitIds: ['unit-1'] }],
  });
  await save(join(runRoot, 'regressions', 'explicit-inch-unit-v1.json'), {
    contractVersion: 'mock_preparation_focused_regression_v1', decision: 'pass', goldSha256: 'corrected-gold',
    completedAtIso: '2026-10-15T08:00:00+08:00', rows: [{
      datasetId: 'concise-field-shorthand', sourceUnitId: 'fact-1', noteId: 'note-concise-field-shorthand',
      generatedText: 'Roof vent 3 in, not flush.', semanticVerdict: 'preserved', integrityVerdict: 'pass',
      explanation: 'Focused regression confirmed the explicit inch unit is present.',
    }],
  });
  const corrected = await loadMockPreparationEvaluation({ appRoot: root, configuredRoot: root });
  assert.equal(corrected.summary.passedRows, 3);
  assert.equal(corrected.summary.failedRows, 0);
  assert.equal(corrected.decision.dataset, 'pass');
  assert.equal(corrected.rows.find((row) => row.variantId === 'concise-field-shorthand').explanation,
    'Focused regression confirmed the explicit inch unit is present.');
  assert.equal(corrected.graders.find((grader) => grader.id === 'fact-meaning-and-integrity').status, 'pass');
});

test('shows a prepared truth pilot as pending before any model request is sent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mock-eval-ui-truth-review-'));
  const runRoot = join(root, 'review', 'mock-preparation-full-case-v1');
  await mkdir(runRoot, { recursive: true });
  await save(join(root, 'case.json'), { source: {
    sourcePath: 'reports/Tank-V4.pdf', reportFamily: 'vertical', sourceDatasetSplit: 'training',
  } });
  await save(join(root, 'semantic-pairs.json'), {
    contractVersion: 'source_mock_semantic_matrix_v1', caseId: 'case-v4', caseRevision: 1,
    status: 'human_review_pending', summary: { semanticUnitCount: 1, variantCount: 0 },
    semanticUnits: [], variants: [],
  });
  await save(join(runRoot, 'atomic-fact-ledger.json'), {
    goldSha256: 'pending-gold', facts: [{
      factId: 'fact-v4-1', factType: 'observation', noteId: 'obs-roof', sourcePage: 9,
      sourceText: 'Topside pits were estimated at 1 mm.',
      protectedMeaning: 'Topside pits were estimated at 1 mm.', sourceUnitIds: ['fact-v4-1'],
    }],
  });

  const result = await loadMockPreparationEvaluation({ appRoot: root, configuredRoot: root });
  assert.equal(result.available, true);
  assert.equal(result.pilot.runKind, 'truth_review');
  assert.equal(result.summary.totalRows, 1);
  assert.equal(result.summary.pendingRows, 1);
  assert.equal(result.summary.failedRows, 0);
  assert.equal(result.rows[0].originalText, 'Topside pits were estimated at 1 mm.');
  assert.equal(result.rows[0].appEvidenceText, '');
  assert.equal(result.rows[0].result, 'pending');
  assert.equal(result.rows[0].gradingStatus, 'awaiting_generation');
});

test('returns a clear unavailable state when no case is configured', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mock-eval-ui-empty-'));
  const result = await loadMockPreparationEvaluation({ appRoot: root });
  assert.deepEqual(result, {
    available: false,
    evaluationOnly: true,
    message: 'No mock-preparation evaluation case is configured on this server.',
  });
});
