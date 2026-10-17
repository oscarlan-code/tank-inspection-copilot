import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyEvidence, narrativePrompt, __test } from './runtime.mjs';
import { guardClassification } from './classification-guard.mjs';

const noteText = 'The external roof drain sump is flooded; the component could not be inspected visually.';
const atomization = { contractVersion: 'source_linked_evidence_atoms_v5', atomizerId: 'evidence-atomizer-v5',
  inputPackageHash: 'a'.repeat(64), evidenceAtoms: [
    { evidenceId: 'field', kind: 'structured_field', entity: { field: 'client' }, reportEvidence: true },
    { evidenceId: 'ut', kind: 'ut_measurement_row', entity: { targetKey: 'shell', itemKind: 'LAYOUT_REGION' }, reportEvidence: true },
    { evidenceId: 'voice', kind: 'voice_narrative', originalValue: 'the component could not be inspected visually.',
      sourcePointer: '/voiceNotes/0/transcriptText', sourceSpan: { start: 41, end: 86 }, entity: {}, relationships: {},
      context: { kind: 'same_voice_note', text: noteText, sourcePointer: '/voiceNotes/0/transcriptText', noteSha256: 'b'.repeat(64) }, reportEvidence: true },
    { evidenceId: 'control', kind: 'control_metadata', reportEvidence: false },
  ] };

const resolvedWorker = async ({ atoms }) => ({ classifications: atoms.map((atom) => ({
  evidenceId: atom.evidenceId, decisionState: 'needs_review', sectionId: 'inspection-report', blockId: 'roof-external',
  role: 'required_narrative', sectionConfidence: .98, blockConfidence: .86, feedback: 'Resolved the component from the same note.',
})) });

test('keeps deterministic routes and records separate section and block proposals', async () => {
  const result = await classifyEvidence({ atomization, modelId: 'test-model', narrativeWorker: resolvedWorker });
  const voice = result.classificationAssignments.find((item) => item.evidenceId === 'voice');
  assert.equal(voice.sectionDecision.sectionId, 'inspection-report');
  assert.equal(voice.blockDecision.blockId, 'roof-external');
  assert.equal(voice.uses[0].method, 'llm_proposal');
  assert.equal(result.classificationAssignments.find((item) => item.evidenceId === 'field').sectionDecision.state, 'deterministic');
  assert.equal(guardClassification({ classification: result }).decision, 'passed');
});

test('retains a safe section proposal when the within-section block is unresolved', async () => {
  const result = await classifyEvidence({ atomization, narrativeWorker: async ({ atoms }) => ({ classifications: atoms.map((atom) => ({
    evidenceId: atom.evidenceId, decisionState: 'needs_review', sectionId: 'inspection-report', blockId: null,
    role: 'supporting', sectionConfidence: .97, blockConfidence: .3, feedback: 'Section is clear; block requires review.',
  })) }) });
  const voice = result.classificationAssignments.find((item) => item.evidenceId === 'voice');
  assert.equal(voice.sectionDecision.sectionId, 'inspection-report');
  assert.equal(voice.blockDecision.blockId, null);
  assert.deepEqual(voice.uses, []);
  const guard = guardClassification({ classification: result });
  assert.equal(guard.decision, 'passed');
  assert.equal(guard.sectionRoutedBlockUnresolvedAtomCount, 1);
  assert.equal(guard.sectionPackageEligibleAtomCount, 2);
});

test('rejects a block proposal without a section', async () => {
  await assert.rejects(() => classifyEvidence({ atomization, narrativeWorker: async ({ atoms }) => ({ classifications: atoms.map((atom) => ({
    evidenceId: atom.evidenceId, decisionState: 'needs_review', sectionId: null, blockId: 'roof-external',
    role: 'supporting', sectionConfidence: .2, blockConfidence: .8, feedback: 'Invalid.',
  })) }) }), /block without a section/);
});

test('rejects a block outside the proposed section', async () => {
  await assert.rejects(() => classifyEvidence({ atomization, narrativeWorker: async ({ atoms }) => ({ classifications: atoms.map((atom) => ({
    evidenceId: atom.evidenceId, decisionState: 'needs_review', sectionId: 'inspection-report', blockId: 'measurements',
    role: 'supporting', sectionConfidence: .9, blockConfidence: .9, feedback: 'Invalid.',
  })) }) }), /does not belong/);
});

test('preserves not-run status when no narrative worker is supplied', async () => {
  const result = await classifyEvidence({ atomization });
  const voice = result.classificationAssignments.find((item) => item.evidenceId === 'voice');
  assert.equal(voice.sectionDecision.state, 'not_run');
  assert.equal(voice.blockDecision.state, 'not_run');
  assert.equal(guardClassification({ classification: result }).decision, 'passed');
});

test('supplies complete note context but instructs the model to classify only the atom', () => {
  const prompt = narrativePrompt([atomization.evidenceAtoms.find((item) => item.evidenceId === 'voice')]);
  assert.match(prompt, /SECTION-FIRST POLICY/);
  assert.match(prompt, /wrong section is a hard failure/i);
  assert.match(prompt, /sameVoiceNoteContext/);
  assert.match(prompt, /external roof drain sump is flooded/);
  assert.match(prompt, /Classify only atomText/);
  assert.match(prompt, /null blockId/);
});

test('keeps reviewed deterministic ownership helpers unchanged', () => {
  assert.equal(__test.fieldBlock('yearBuilt'), 'configuration');
  assert.equal(__test.measurementUse({ entity: { targetKey: 'shell' } }).sectionId, 'shell-plate-thickness-measurements');
});
