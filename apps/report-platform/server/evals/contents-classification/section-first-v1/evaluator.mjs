import assert from 'node:assert/strict';

export const DEFAULT_GATES = Object.freeze({
  maximumWrongSectionRouteCount: 0,
  minimumSectionRoutePrecision: 1,
  minimumAutomaticSectionCoverage: 0.95,
  minimumCriticalSectionRecall: 1,
  minimumBlockExactAccuracy: 0.9,
});

export function evaluateSectionFirst({ rows, criticalSectionIds = [], gates = DEFAULT_GATES } = {}) {
  assert(Array.isArray(rows) && rows.length > 0, 'At least one evaluation row is required.');
  const critical = new Set(criticalSectionIds);
  for (const row of rows) {
    assert(row.expectedUse?.sectionId, 'Every row requires an expected section.');
    assert(row.expectedUse?.blockId, 'Every row requires an expected block.');
    assert(row.predictedSectionId === null || typeof row.predictedSectionId === 'string');
    assert(row.predictedBlockId === null || typeof row.predictedBlockId === 'string');
    assert(!(row.predictedSectionId === null && row.predictedBlockId !== null),
      'A block prediction cannot exist without a section prediction.');
  }
  const total = rows.length;
  const routed = rows.filter(row => row.predictedSectionId !== null);
  const correctSections = rows.filter(row => row.predictedSectionId === row.expectedUse.sectionId);
  const wrongSections = rows.filter(row => row.predictedSectionId !== null && row.predictedSectionId !== row.expectedUse.sectionId);
  const sectionAbstentions = rows.filter(row => row.predictedSectionId === null);
  const blockExact = rows.filter(row => row.predictedSectionId === row.expectedUse.sectionId
    && row.predictedBlockId === row.expectedUse.blockId);
  const blockReview = rows.filter(row => row.predictedSectionId === row.expectedUse.sectionId
    && row.predictedBlockId === null);
  const criticalRows = rows.filter(row => critical.has(row.expectedUse.sectionId));
  const criticalCorrect = criticalRows.filter(row => row.predictedSectionId === row.expectedUse.sectionId);
  const metrics = {
    total, routedSectionCount: routed.length, correctSectionCount: correctSections.length,
    wrongSectionRouteCount: wrongSections.length, sectionAbstentionCount: sectionAbstentions.length,
    sectionRoutePrecision: routed.length ? correctSections.length / routed.length : 0,
    automaticSectionCoverage: routed.length / total,
    sectionAccuracy: correctSections.length / total,
    criticalSectionCount: criticalRows.length,
    criticalSectionRecall: criticalRows.length ? criticalCorrect.length / criticalRows.length : 1,
    blockExactCount: blockExact.length, blockExactAccuracy: blockExact.length / total,
    blockReviewCount: blockReview.length, blockReviewRate: blockReview.length / total,
  };
  const checks = {
    wrongSectionRouteCount: metrics.wrongSectionRouteCount <= gates.maximumWrongSectionRouteCount,
    sectionRoutePrecision: metrics.sectionRoutePrecision >= gates.minimumSectionRoutePrecision,
    automaticSectionCoverage: metrics.automaticSectionCoverage >= gates.minimumAutomaticSectionCoverage,
    criticalSectionRecall: metrics.criticalSectionRecall >= gates.minimumCriticalSectionRecall,
    blockExactAccuracy: metrics.blockExactAccuracy >= gates.minimumBlockExactAccuracy,
  };
  return {
    contractVersion: 'contents_classification_section_first_result_v1',
    decision: Object.values(checks).every(Boolean) ? 'matrix_gate_passed' : 'matrix_gate_failed',
    gates, metrics, checks,
    failures: {
      wrongSections: wrongSections.map(row => row.caseId),
      sectionAbstentions: sectionAbstentions.map(row => row.caseId),
      blockMismatches: rows.filter(row => row.predictedBlockId !== row.expectedUse.blockId).map(row => row.caseId),
    },
    productEnabled: false,
  };
}
