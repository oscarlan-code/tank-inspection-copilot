import assert from 'node:assert/strict';
import test from 'node:test';
import { assertCalibrationGate, assertScalePlan, buildRequestsForVariant } from './judge-semantic-pairs.mjs';

const semanticUnits = Array.from({ length: 5 }, (_, index) => ({
  sourceUnitId: `unit-${index + 1}`,
  semanticKey: `roof.fact.${index + 1}`,
  unitType: 'observation',
  evaluationMode: 'semantic',
  evidenceGroupId: `group-${index + 1}`,
  protectedFacts: { value: index + 1 },
  sourceEvidence: [{ page: 8, text: `Source fact ${index + 1}` }],
}));

const matrix = { semanticUnits, variants: [] };
const variant = {
  variantId: 'concise-field',
  rows: semanticUnits.map((unit) => ({
    sourceUnitId: unit.sourceUnitId,
    reviewed: false,
    mockText: `Inspector note ${unit.sourceUnitId}`,
  })),
};
matrix.variants = [variant];

test('batches semantic grading requests instead of sending a whole variation at once', () => {
  const requests = buildRequestsForVariant(matrix, variant, 2);
  assert.deepEqual(requests.map((request) => request.unitIds.length), [2, 2, 1]);
  assert.deepEqual(requests.map((request) => request.batchId), [
    'concise-field-batch-01', 'concise-field-batch-02', 'concise-field-batch-03',
  ]);
  assert.ok(requests.every((request) => request.schema.properties.rows.maxItems <= 2));
});

test('blocks scale grading until evaluator calibration passes', () => {
  assert.throws(() => assertCalibrationGate({ gatePassed: false }), /calibration has not passed/i);
  assert.doesNotThrow(() => assertCalibrationGate({ gatePassed: true }));
});

test('validates and applies a bounded scale plan', () => {
  const plan = {
    contractVersion: 'mock_semantic_scale_plan_v1',
    variants: ['concise-field'],
    sourceUnitIds: ['unit-2', 'unit-4'],
  };
  assert.doesNotThrow(() => assertScalePlan(matrix, plan));
  const requests = buildRequestsForVariant(matrix, variant, 12, plan.sourceUnitIds);
  assert.deepEqual(requests.flatMap((request) => request.unitIds), ['unit-2', 'unit-4']);
  assert.throws(() => assertScalePlan(matrix, { ...plan, variants: ['missing'] }), /Unknown scale-plan variant/);
});

test('cache-only reconstruction can include already graded rows', () => {
  const reviewed = structuredClone(variant);
  Object.assign(reviewed.rows[0], {
    reviewed: true,
    grader: { type: 'llm', id: 'sealed-gold-semantic-judge' },
  });
  assert.equal(buildRequestsForVariant(matrix, reviewed, 12).flatMap((request) => request.unitIds).includes('unit-1'), false);
  assert.equal(buildRequestsForVariant(matrix, reviewed, 12, ['unit-1'], true).flatMap((request) => request.unitIds).includes('unit-1'), true);
});

test('one-row batches support a sequential full-model refresh', () => {
  const reviewed = structuredClone(variant);
  for (const row of reviewed.rows) {
    row.reviewed = true;
    row.grader = { type: 'llm', id: 'sealed-gold-semantic-judge', modelId: 'older-model' };
  }
  const requests = buildRequestsForVariant(matrix, reviewed, 1, null, true);
  assert.equal(requests.length, reviewed.rows.length);
  assert.ok(requests.every((request) => request.unitIds.length === 1));
  assert.deepEqual(requests.flatMap((request) => request.unitIds), semanticUnits.map((unit) => unit.sourceUnitId));
});
