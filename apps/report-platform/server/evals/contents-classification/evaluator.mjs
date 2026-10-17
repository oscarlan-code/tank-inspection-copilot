import assert from 'node:assert/strict';

const useKey = (item) => `${item.sectionId}:${item.blockId}`;
const sameSet = (left, right) => left.length === right.length && left.every((item) => right.includes(item));

function evaluationCategory(atom, gold) {
  if (atom.kind === 'voice_narrative' || gold?.goldOrigins?.includes('mock_clause_fact_lineage')) {
    return 'llm_narrative_classification';
  }
  if (gold?.goldOrigins?.includes('mock_semantic_unit_reference')) return 'report_grounded_deterministic_routing';
  if (gold?.goldOrigins?.includes('reviewed_app_contract')) return 'contract_consistency';
  return 'missing_gold';
}

function originalRecord(atom, rawExport) {
  if (atom.kind === 'structured_field') return { field: atom.entity?.field, value: atom.originalValue };
  const parts = atom.sourcePointer.split('/').filter(Boolean);
  if (parts.length >= 2 && Array.isArray(rawExport[parts[0]])) return rawExport[parts[0]][Number(parts[1])] ?? atom.originalValue;
  return atom.originalValue;
}

export function evaluateClassification({ classification, guardResult, rawExport, atomGold, variantId = 'natural-field-speech' } = {}) {
  assert.equal(guardResult?.decision, 'passed', 'Only sealed classification output may be evaluated.');
  assert.equal(atomGold?.contractVersion, 'contents_classification_atom_gold_v2', 'Canonical-primary-owner atom gold is required.');
  assert.equal(atomGold?.labelSemantics, 'canonical_primary_owner', 'Gold labels must express canonical primary ownership.');
  assert.equal(atomGold.inputPackageHash, classification.inputPackageHash, 'Gold labels belong to a different sealed input package.');
  const assignmentById = new Map(classification.classificationAssignments.map((item) => [item.evidenceId, item]));
  const goldById = new Map(atomGold.entries.map((item) => [item.evidenceId, item]));
  const rows = classification.evidenceAtoms.map((atom, index) => {
    const assignment = assignmentById.get(atom.evidenceId);
    const gold = goldById.get(atom.evidenceId);
    const expectedUses = gold?.expectedUses ?? [];
    const predictedUses = assignment?.uses ?? [];
    const expectedLabels = [...new Set(expectedUses.map(useKey))].sort();
    const predictedLabels = [...new Set(predictedUses.map(useKey))].sort();
    const expectedSections = [...new Set(expectedUses.map((item) => item.sectionId))].sort();
    const predictedSections = [...new Set(predictedUses.map((item) => item.sectionId))].sort();
    const goldDecision = gold?.goldDecision ?? 'missing';
    const predictedExcluded = assignment?.decisionState === 'excluded' && predictedUses.length === 0;
    const notRun = assignment?.decisionState === 'not_run';
    let result = 'not_measured';
    let feedback = 'NOT MEASURED — this atom has no reviewed canonical primary-route gold label. Review the gold dataset before judging the classifier.';
    if (notRun) {
      result = 'not_run';
      feedback = 'NOT RUN — the narrative classifier returned no prediction, so this atom is excluded from accuracy metrics.';
    } else if (goldDecision === 'exclude') {
      result = predictedExcluded ? 'pass' : 'fail';
      feedback = result === 'pass' ? 'PASS — the classifier correctly excluded this non-report atom.'
        : 'FAIL — the gold disposition is Exclude, but the classifier routed this atom into report content.';
    } else if (goldDecision === 'route') {
      result = sameSet(expectedLabels, predictedLabels) ? 'pass' : 'fail';
      const missing = expectedLabels.filter((item) => !predictedLabels.includes(item));
      const extra = predictedLabels.filter((item) => !expectedLabels.includes(item));
      feedback = result === 'pass' ? `PASS — predicted section/block labels match the frozen gold labels for ${atom.evidenceId}.`
        : `FAIL — ${missing.length ? `missing labels: ${missing.join(', ')}. ` : ''}${extra.length ? `extra labels: ${extra.join(', ')}. ` : ''}`.trim();
    }
    return {
      rowId: atom.evidenceId, number: index + 1, evidenceId: atom.evidenceId, evidenceType: atom.kind,
      sourcePointer: atom.sourcePointer, atomizationMethod: atom.atomizationMethod,
      originalAppRecord: originalRecord(atom, rawExport), atomizedUnit: atom.displayText,
      sourceSpan: atom.sourceSpan, sourceUnits: gold?.sourceUnits ?? [], goldDecision,
      goldOrigins: gold?.goldOrigins ?? ['missing_gold_label'], expectedUses, predictedUses,
      expectedLabels, predictedLabels, expectedSections, predictedSections,
      evaluationCategory: evaluationCategory(atom, gold),
      classifierDecision: assignment?.decisionState ?? 'missing', classifierFeedback: assignment?.feedback ?? '',
      result, feedback, humanReviewRequired: assignment?.decisionState === 'needs_review',
    };
  });
  const evaluatedRows = rows.filter((item) => item.result === 'pass' || item.result === 'fail');
  let tp = 0; let fp = 0; let fn = 0;
  for (const row of evaluatedRows) {
    tp += row.predictedLabels.filter((item) => row.expectedLabels.includes(item)).length;
    fp += row.predictedLabels.filter((item) => !row.expectedLabels.includes(item)).length;
    fn += row.expectedLabels.filter((item) => !row.predictedLabels.includes(item)).length;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const byType = [...new Set(rows.map((item) => item.evidenceType))].sort().map((evidenceType) => {
    const typed = rows.filter((item) => item.evidenceType === evidenceType);
    return { evidenceType, total: typed.length, evaluated: typed.filter((item) => ['pass', 'fail'].includes(item.result)).length,
      passed: typed.filter((item) => item.result === 'pass').length,
      failed: typed.filter((item) => item.result === 'fail').length,
      notRun: typed.filter((item) => item.result === 'not_run').length,
      notMeasured: typed.filter((item) => item.result === 'not_measured').length };
  });
  const byEvaluationCategory = [...new Set(rows.map((item) => item.evaluationCategory))].sort().map((category) => {
    const categorized = rows.filter((item) => item.evaluationCategory === category);
    return { category, total: categorized.length,
      evaluated: categorized.filter((item) => ['pass', 'fail'].includes(item.result)).length,
      passed: categorized.filter((item) => item.result === 'pass').length,
      failed: categorized.filter((item) => item.result === 'fail').length,
      notRun: categorized.filter((item) => item.result === 'not_run').length,
      notMeasured: categorized.filter((item) => item.result === 'not_measured').length };
  });
  const passed = rows.filter((item) => item.result === 'pass').length;
  const failed = rows.filter((item) => item.result === 'fail').length;
  const notRun = rows.filter((item) => item.result === 'not_run').length;
  const notMeasured = rows.filter((item) => item.result === 'not_measured').length;
  return {
    contractVersion: 'contents_classification_evaluation_v3', evaluationOnly: true,
    case: { caseId: classification.caseId ?? null, variantId },
    stages: [
      { id: 'input-guard', label: 'Input leakage guard', status: 'pass', detail: 'Gold labels were removed before classifier runtime.' },
      { id: 'atomizer', label: 'Evidence Atomizer', status: 'pass', detail: `${classification.evidenceAtoms.length} stable evidence IDs were created from native app records and exact voice spans.` },
      { id: 'classifier', label: 'Contents Classification Agent', status: notRun ? 'prepared' : 'complete', detail: notRun
        ? `${evaluatedRows.length} deterministic dispositions completed; ${notRun} narrative atoms have not run.`
        : `${classification.classificationAssignments.length} atom dispositions returned without access to gold labels.` },
      { id: 'classification-guard', label: 'Classification Guard', status: guardResult.decision, detail: `${guardResult.issues.length} structural issues.` },
      { id: 'gold-evaluator', label: 'Atom-ID gold evaluator', status: notMeasured ? 'blocked' : 'complete', detail: notMeasured
        ? `${evaluatedRows.length} outputs had reviewed canonical gold; ${notMeasured} were not measured because canonical primary-route gold is missing.`
        : `After output was sealed, ${evaluatedRows.length} executed outputs were compared with private gold; ${notRun} unexecuted atoms were excluded.` },
    ],
    summary: { atomCount: rows.length, goldLabeledAtoms: rows.filter((item) => item.goldDecision !== 'missing').length,
      goldMissingAtoms: rows.filter((item) => item.goldDecision === 'missing').length,
      passed, failed, notRun, notMeasured, binaryEvaluatedCount: passed + failed, binaryPassRate: passed + failed ? passed / (passed + failed) : 0,
      qualificationStatus: notMeasured ? 'blocked_missing_canonical_gold' : 'measured',
      llmProposalReviewCount: rows.filter((item) => item.humanReviewRequired).length, attentionCount: failed + notMeasured,
      labelPrecision: precision, labelRecall: recall, labelF1: precision + recall ? 2 * precision * recall / (precision + recall) : 0,
      exactLabelSetMatches: passed },
    byEvidenceType: byType, byEvaluationCategory, goldSummary: atomGold.summary, rows,
  };
}
