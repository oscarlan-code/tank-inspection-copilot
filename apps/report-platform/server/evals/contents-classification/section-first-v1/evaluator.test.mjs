import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateSectionFirst } from './evaluator.mjs';

const baseRows = () => Array.from({ length: 20 }, (_, index) => ({
  caseId: `case-${index + 1}`,
  expectedUse: { sectionId: index < 5 ? 'scope-of-inspection' : 'inspection-report', blockId: index < 5 ? 'methods' : 'shell-external' },
  predictedSectionId: index < 5 ? 'scope-of-inspection' : 'inspection-report',
  predictedBlockId: index < 5 ? 'methods' : 'shell-external',
}));

test('qualifies perfect section safety with 95% coverage and 90% exact blocks', () => {
  const rows = baseRows();
  rows[18].predictedBlockId = null;
  rows[19].predictedSectionId = null;
  rows[19].predictedBlockId = null;
  const result = evaluateSectionFirst({ rows, criticalSectionIds: ['scope-of-inspection'] });
  assert.equal(result.decision, 'matrix_gate_passed');
  assert.equal(result.metrics.wrongSectionRouteCount, 0);
  assert.equal(result.metrics.sectionRoutePrecision, 1);
  assert.equal(result.metrics.automaticSectionCoverage, .95);
  assert.equal(result.metrics.blockExactAccuracy, .9);
});

test('blocks one wrong section even when aggregate accuracy appears high', () => {
  const rows = baseRows();
  rows[19].predictedSectionId = 'scope-of-inspection';
  rows[19].predictedBlockId = 'methods';
  const result = evaluateSectionFirst({ rows });
  assert.equal(result.decision, 'matrix_gate_failed');
  assert.equal(result.metrics.wrongSectionRouteCount, 1);
  assert.equal(result.checks.wrongSectionRouteCount, false);
});

test('treats section abstention as safe but reduces coverage', () => {
  const rows = baseRows();
  for (const row of rows.slice(18)) { row.predictedSectionId = null; row.predictedBlockId = null; }
  const result = evaluateSectionFirst({ rows });
  assert.equal(result.metrics.sectionRoutePrecision, 1);
  assert.equal(result.metrics.automaticSectionCoverage, .9);
  assert.equal(result.checks.automaticSectionCoverage, false);
});

test('permits block review only within the accuracy tolerance', () => {
  const rows = baseRows();
  for (const row of rows.slice(17)) row.predictedBlockId = null;
  const result = evaluateSectionFirst({ rows });
  assert.equal(result.metrics.wrongSectionRouteCount, 0);
  assert.equal(result.metrics.blockExactAccuracy, .85);
  assert.equal(result.checks.blockExactAccuracy, false);
});
