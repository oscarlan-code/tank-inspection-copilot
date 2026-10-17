import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAtomGold } from './atom-gold-builder.mjs';
import { evaluateClassification } from './evaluator.mjs';

const atom = { evidenceId: 'atom-1', kind: 'voice_narrative', reportEvidence: true,
  sourcePointer: '/voiceNotes/0/transcriptText', sourceSpan: { start: 13, end: 75 },
  atomizationMethod: 'exact_source_span', originalValue: 'Tank sits on soil and rock aggregates below a concrete batter slope.',
  displayText: 'Tank sits on soil and rock aggregates below a concrete batter slope.' };

test('builds voice gold by frozen clause span and fact ID without sentence matching', () => {
  const atomGold = buildAtomGold({
    atomization: { contractVersion: 'source_linked_evidence_atoms_v1', inputPackageHash: 'package-1', evidenceAtoms: [atom] },
    rawExport: { voiceNotes: [{ voiceNoteId: 'concise-field-obs-foundation',
      transcriptText: 'Observation: Tank sits on soil and rock aggregates below a concrete batter slope.' }] },
    fullReportEvaluation: { rows: [{ variantId: 'natural-field-speech', sourceUnitId: 'truth-foundation', sourcePage: 7,
      unitType: 'observation', originalText: 'The tank was found sitting on soil and rock based aggregates.',
      appEvidenceText: 'Deliberately unrelated wording that must not be used for a match.',
      appEvidenceRefs: ['voiceNotes[voiceNoteId=concise-field-obs-foundation]'] }] },
    semanticPairs: { semanticUnits: [{ sourceUnitId: 'truth-foundation', unitType: 'observation',
      protectedFacts: { sourceMeaning: 'The original foundation observation.' }, sourceObligationIds: ['block-foundation'],
      sourceEvidence: [{ page: 7, text: 'The tank was found sitting on soil and rock based aggregates.' }] }] },
    sourceBlocks: [{ sourceBlockId: 'block-foundation', headingPath: ['INSPECTION REPORT', 'FOUNDATION'] }],
    acceptedDataset: { notes: [{ noteId: 'obs-foundation', clauses: [{
      text: 'Tank sits on soil and rock aggregates below a concrete batter slope.', factIds: ['fact-foundation'] }] }] },
    atomicFactLedger: { facts: [{ factId: 'fact-foundation', sourceUnitIds: ['truth-foundation'] }] },
  });
  assert.equal(atomGold.summary.missing, 0);
  assert.deepEqual(atomGold.entries[0].expectedUses, [{ sectionId: 'inspection-report', blockId: 'foundation' }]);
  assert.deepEqual(atomGold.entries[0].goldOrigins, ['mock_clause_fact_lineage']);
});

test('scores exact section and block label sets by evidence ID', () => {
  const base = { classification: { inputPackageHash: 'package-1', evidenceAtoms: [atom], classificationAssignments: [{
    evidenceId: 'atom-1', decisionState: 'needs_review', feedback: 'Foundation proposal.',
    uses: [{ sectionId: 'inspection-report', blockId: 'foundation', role: 'required_narrative', method: 'llm_proposal', confidence: .9 }] }] },
    guardResult: { decision: 'passed', issues: [] }, rawExport: { voiceNotes: [{ voiceNoteId: 'voice-1', transcriptText: atom.originalValue }] },
    atomGold: { contractVersion: 'contents_classification_atom_gold_v2', labelSemantics: 'canonical_primary_owner', inputPackageHash: 'package-1', summary: {}, entries: [{
      evidenceId: 'atom-1', goldDecision: 'route', expectedUses: [{ sectionId: 'inspection-report', blockId: 'foundation' }],
      sourceUnits: [], goldOrigins: ['mock_clause_fact_lineage'] }] } };
  const pass = evaluateClassification(base);
  assert.equal(pass.rows[0].result, 'pass');
  assert.equal(pass.rows[0].humanReviewRequired, true);
  const wrongBlock = structuredClone(base);
  wrongBlock.classification.classificationAssignments[0].uses[0].blockId = 'roof-external';
  const fail = evaluateClassification(wrongBlock);
  assert.equal(fail.rows[0].result, 'fail');
  assert.match(fail.rows[0].feedback, /missing labels: inspection-report:foundation/i);
});

test('derives a photo gold block from its reviewed parent finding', () => {
  const photo = { evidenceId: 'photo-1', kind: 'attachment', reportEvidence: true,
    sourcePointer: '/attachments/0', sourceSpan: null, atomizationMethod: 'deterministic_record',
    originalValue: {}, displayText: 'finding_photo · Photo 1.png', relationships: { kind: 'finding_photo', findingId: 'shell:element:stair' } };
  const atomGold = buildAtomGold({ atomization: { contractVersion: 'source_linked_evidence_atoms_v1', inputPackageHash: 'package-1', evidenceAtoms: [photo] },
    rawExport: { attachments: [{ findingId: 'shell:element:stair', kind: 'finding_photo' }],
      findings: [{ findingId: 'shell:element:stair', targetKey: 'shell', itemLabel: 'Spiral stairway' }] },
    fullReportEvaluation: { rows: [] }, semanticPairs: { semanticUnits: [] }, sourceBlocks: [],
    acceptedDataset: { notes: [] }, atomicFactLedger: { facts: [] } });
  assert.deepEqual(atomGold.entries[0].expectedUses, [
    { sectionId: 'photographs', blockId: 'photographs' },
    { sectionId: 'inspection-report', blockId: 'access-structures' },
  ]);
});

test('scores the Exclude disposition as a binary pass', () => {
  const control = { ...atom, evidenceId: 'control-1', kind: 'control_metadata', reportEvidence: false,
    sourcePointer: '/taskSnapshots/0', sourceSpan: null };
  const result = evaluateClassification({ classification: { inputPackageHash: 'package-1', evidenceAtoms: [control],
    classificationAssignments: [{ evidenceId: 'control-1', decisionState: 'excluded', uses: [], feedback: 'Control record.' }] },
    guardResult: { decision: 'passed', issues: [] }, rawExport: { taskSnapshots: [{}] },
    atomGold: { contractVersion: 'contents_classification_atom_gold_v2', labelSemantics: 'canonical_primary_owner', inputPackageHash: 'package-1', summary: {},
      entries: [{ evidenceId: 'control-1', goldDecision: 'exclude', expectedUses: [], sourceUnits: [], goldOrigins: ['reviewed_app_contract'] }] } });
  assert.equal(result.rows[0].result, 'pass');
  assert.equal(result.summary.binaryEvaluatedCount, 1);
});

test('excludes an unrun narrative atom from accuracy metrics', () => {
  const result = evaluateClassification({ classification: { inputPackageHash: 'package-1', evidenceAtoms: [atom],
    classificationAssignments: [{ evidenceId: 'atom-1', decisionState: 'not_run', uses: [], feedback: 'Worker has not run.' }] },
    guardResult: { decision: 'passed', issues: [] }, rawExport: { voiceNotes: [{ transcriptText: atom.originalValue }] },
    atomGold: { contractVersion: 'contents_classification_atom_gold_v2', labelSemantics: 'canonical_primary_owner', inputPackageHash: 'package-1', summary: {}, entries: [{
      evidenceId: 'atom-1', goldDecision: 'route', expectedUses: [{ sectionId: 'inspection-report', blockId: 'foundation' }],
      sourceUnits: [], goldOrigins: ['mock_clause_fact_lineage'] }] } });
  assert.equal(result.rows[0].result, 'not_run');
  assert.equal(result.summary.notRun, 1);
  assert.equal(result.summary.failed, 0);
  assert.equal(result.summary.binaryEvaluatedCount, 0);
});

test('does not score an observation whose canonical primary-route gold was never reviewed', () => {
  const atomGold = buildAtomGold({
    atomization: { contractVersion: 'source_linked_evidence_atoms_v1', inputPackageHash: 'package-1', evidenceAtoms: [atom] },
    rawExport: { voiceNotes: [{ voiceNoteId: 'concise-field-obs-unknown',
      transcriptText: `Observation: ${atom.originalValue}` }] },
    fullReportEvaluation: { rows: [] },
    semanticPairs: { semanticUnits: [{ sourceUnitId: 'truth-unknown', unitType: 'observation',
      sourceObligationIds: ['block-without-heading'], sourceEvidence: [{ page: 7, text: atom.originalValue }] }] },
    sourceBlocks: [{ sourceBlockId: 'block-without-heading', headingPath: [] }],
    acceptedDataset: { notes: [{ noteId: 'obs-unknown', clauses: [{ text: atom.originalValue, factIds: ['fact-unknown'] }] }] },
    atomicFactLedger: { facts: [{ factId: 'fact-unknown', sourceUnitIds: ['truth-unknown'] }] },
  });
  assert.equal(atomGold.entries[0].goldDecision, 'missing');
  assert(atomGold.entries[0].goldIssues.includes('canonical_primary_route_not_reviewed'));
  const result = evaluateClassification({ classification: { inputPackageHash: 'package-1', evidenceAtoms: [atom],
    classificationAssignments: [{ evidenceId: 'atom-1', decisionState: 'needs_review', uses: [{
      sectionId: 'inspection-report', blockId: 'foundation', role: 'required_narrative', method: 'llm_proposal', confidence: .9,
    }], feedback: 'Proposal.' }] }, guardResult: { decision: 'passed', issues: [] },
    rawExport: { voiceNotes: [{ transcriptText: atom.originalValue }] }, atomGold });
  assert.equal(result.rows[0].result, 'not_measured');
  assert.equal(result.summary.failed, 0);
  assert.equal(result.summary.notMeasured, 1);
  assert.equal(result.summary.qualificationStatus, 'blocked_missing_canonical_gold');
});
