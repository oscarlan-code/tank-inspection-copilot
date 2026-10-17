import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMockPreparationDataset } from './evaluation-dataset.mjs';

const matrix = {
  contractVersion: 'source_mock_semantic_matrix_v1',
  caseId: 'case-1',
  caseRevision: 1,
  semanticUnits: [
    {
      sourceUnitId: 'unit-exact', semanticKey: 'tank.number', unitType: 'structured_field',
      appCapability: 'capturable', evaluationMode: 'exact', protectedFacts: { value: '5452' },
      sourceEvidence: [{ page: 2, text: 'Tank number 5452' }],
    },
    {
      sourceUnitId: 'unit-note', semanticKey: 'roof.condition', unitType: 'observation',
      appCapability: 'capturable', evaluationMode: 'semantic', protectedFacts: { condition: 'corrosion' },
      sourceEvidence: [{ page: 8, text: 'Roof corrosion was observed.' }],
    },
  ],
  variants: [{
    variantId: 'concise',
    rows: [
      { sourceUnitId: 'unit-exact', mockEvidenceRefs: ['field/tank'], actualValue: '5452', reviewed: true, semanticVerdict: 'preserved', integrityVerdict: 'pass' },
      { sourceUnitId: 'unit-note', mockEvidenceRefs: ['voice/roof'], mockText: 'Roof has corrosion.', reviewed: false },
    ],
  }],
};

test('builds one OpenAI-style source/output row per unit and variation', () => {
  const result = buildMockPreparationDataset({ matrix, candidate: { candidateId: 'a' } });
  assert.equal(result.contractVersion, 'mock_preparation_openai_style_dataset_v1');
  assert.equal(result.summary.totalRows, 2);
  assert.equal(result.summary.passedRows, 1);
  assert.equal(result.summary.pendingRows, 1);
  assert.equal(result.rows[0].input.sourceText, 'Tank number 5452');
  assert.equal(result.rows[0].output.text, '5452');
  assert.equal(result.rows[1].reference.appStyle, 'voice_note_observation');
  assert.equal(result.rows[1].result, 'pending');
  assert.equal(result.rows[1].grading.route, 'llm_semantic');
  assert.equal(result.rows[1].grading.status, 'awaiting_llm_semantic_grading');
});

test('fails a reviewed row when a protected meaning or integrity grader fails', () => {
  const changed = structuredClone(matrix);
  Object.assign(changed.variants[0].rows[1], {
    reviewed: true,
    semanticVerdict: 'partial',
    integrityVerdict: 'fail',
    missingFacts: ['roof location'],
  });
  const result = buildMockPreparationDataset({ matrix: changed });
  assert.equal(result.rows[1].result, 'fail');
  assert.equal(result.rows[1].graders.find((grader) => grader.id === 'semantic-meaning-alignment').status, 'fail');
  assert.equal(result.rows[1].grading.route, 'llm_semantic');
});

test('keeps a low-confidence LLM pass pending for human review', () => {
  const changed = structuredClone(matrix);
  Object.assign(changed.variants[0].rows[1], {
    reviewed: true,
    semanticVerdict: 'preserved',
    integrityVerdict: 'pass',
    unsupportedAdditionCount: 0,
    confidence: 0.72,
    grader: { type: 'llm', id: 'sealed-gold-semantic-judge', version: '2.0.0', modelId: 'gpt-test' },
  });
  const result = buildMockPreparationDataset({ matrix: changed });
  assert.equal(result.rows[1].result, 'pending');
  assert.equal(result.rows[1].grading.status, 'complete');
  assert.equal(result.rows[1].grading.humanReviewRequired, true);
  assert.equal(result.rows[1].grading.confidence, 0.72);
});
