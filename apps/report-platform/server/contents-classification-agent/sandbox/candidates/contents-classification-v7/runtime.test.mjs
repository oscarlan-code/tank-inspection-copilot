import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyEvidence, narrativePrompt, __test } from './runtime.mjs';
import { guardClassification } from './classification-guard.mjs';

const atomization = { contractVersion: 'source_linked_evidence_atoms_v3', atomizerId: 'evidence-atomizer-v3',
  inputPackageHash: 'a'.repeat(64), evidenceAtoms: [
    { evidenceId: 'field', kind: 'structured_field', entity: { field: 'client' }, reportEvidence: true },
    { evidenceId: 'ut', kind: 'ut_measurement_row', entity: { targetKey: 'shell', itemKind: 'LAYOUT_REGION' }, reportEvidence: true },
    { evidenceId: 'voice', kind: 'voice_narrative', originalValue: 'Repair the shell coating.', sourcePointer: '/voiceNotes/0/transcriptText', sourceSpan: { start: 0, end: 25 }, entity: {}, relationships: {}, reportEvidence: true },
    { evidenceId: 'control', kind: 'control_metadata', reportEvidence: false },
  ] };

test('classifies structured records deterministically and narrative through the bounded worker', async () => {
  const result = await classifyEvidence({ atomization, modelId: 'test-model', narrativeWorker: async ({ atoms }) => ({ classifications: atoms.map((atom) => ({
    evidenceId: atom.evidenceId, decisionState: 'needs_review', uses: [{ sectionId: 'repair-recommendations', blockId: 'recommendations', role: 'required_narrative', confidence: .91 }], feedback: 'Proposed repair action.',
  })) }) });
  assert.equal(result.classificationAssignments.length, 4);
  assert.equal(result.classificationAssignments.find((item) => item.evidenceId === 'field').uses[0].sectionId, 'general-tank-information');
  assert.equal(result.classificationAssignments.find((item) => item.evidenceId === 'ut').uses[0].sectionId, 'shell-plate-thickness-measurements');
  assert.equal(result.classificationAssignments.find((item) => item.evidenceId === 'voice').uses[0].method, 'llm_proposal');
  assert.equal(result.classificationAssignments.find((item) => item.evidenceId === 'control').decisionState, 'excluded');
  assert.equal(guardClassification({ classification: result }).decision, 'passed');
});

test('fails closed when a narrative worker returns an invalid section block', async () => {
  await assert.rejects(() => classifyEvidence({ atomization, narrativeWorker: async ({ atoms }) => ({ classifications: atoms.map((atom) => ({
    evidenceId: atom.evidenceId, decisionState: 'needs_review', uses: [{ sectionId: 'inspection-report', blockId: 'measurements', role: 'supporting', confidence: .8 }], feedback: 'Invalid.',
  })) }) }), /does not belong/);
});

test('rejects multiple LLM routes for one atomic voice claim', async () => {
  await assert.rejects(() => classifyEvidence({ atomization, narrativeWorker: async ({ atoms }) => ({ classifications: atoms.map((atom) => ({
    evidenceId: atom.evidenceId, decisionState: 'needs_review', uses: [
      { sectionId: 'inspection-report', blockId: 'shell-external', role: 'required_narrative', confidence: .92 },
      { sectionId: 'inspection-report', blockId: 'deficiencies', role: 'supporting', confidence: .81 },
    ], feedback: 'Over-routed.',
  })) }) }), /more than one primary route/);
});

test('marks narrative atoms not run when no worker is supplied', async () => {
  const result = await classifyEvidence({ atomization });
  const voice = result.classificationAssignments.find((item) => item.evidenceId === 'voice');
  assert.equal(voice.decisionState, 'not_run');
  assert.deepEqual(voice.uses, []);
  assert.equal(result.classificationManifest.notRunCount, 1);
  const guard = guardClassification({ classification: result });
  assert.equal(guard.decision, 'passed');
  assert.equal(guard.notRunAtomCount, 1);
});

test('routes findings and photos to the specific component block', async () => {
  const enriched = structuredClone(atomization);
  enriched.evidenceAtoms.push(
    { evidenceId: 'finding', kind: 'finding', entity: { targetKey: 'external_roof', itemLabel: 'Roof appurtenances' }, reportEvidence: true },
    { evidenceId: 'photo', kind: 'attachment', entity: { targetKey: 'shell', itemLabel: 'Spiral stairway' },
      relationships: { kind: 'finding_photo', findingId: 'shell:element:stair' }, reportEvidence: true },
  );
  const result = await classifyEvidence({ atomization: enriched, narrativeWorker: async ({ atoms }) => ({ classifications: atoms.map((item) => ({
    evidenceId: item.evidenceId, decisionState: 'needs_review', uses: [], feedback: 'No route in this focused test.',
  })) }) });
  assert.equal(result.classificationAssignments.find((item) => item.evidenceId === 'finding').uses[0].blockId, 'roof-appurtenances');
  assert.equal(result.classificationAssignments.find((item) => item.evidenceId === 'photo').uses[1].blockId, 'access-structures');
});

test('uses the reviewed General Tank Information ownership definitions', () => {
  assert.equal(__test.fieldBlock('yearBuilt'), 'configuration');
  assert.equal(__test.fieldBlock('serviceHeight'), 'configuration');
  assert.equal(__test.fieldBlock('originalManufacturer'), 'configuration');
  assert.equal(__test.fieldBlock('constructionShell'), 'design-data');
  assert.equal(__test.fieldBlock('shellJointType'), 'design-data');
});

test('prompt gives explicit actions precedence over cited technical basis', () => {
  const prompt = narrativePrompt([{ evidenceId: 'action', originalValue: 'Under API 650, the pad should have rounded corners.',
    sourcePointer: '/voiceNotes/0/transcriptText', sourceSpan: { start: 0, end: 58 }, entity: {}, relationships: {} }]);
  assert.match(prompt, /explicit proposed action belongs to repair-recommendations\/recommendations/);
  assert.match(prompt, /even when that action also cites an API clause/);
  assert.match(prompt, /monitor, recheck, or reassess/);
  assert.match(prompt, /earth point explicitly attached to the shell/);
  assert.match(prompt, /component, location, field cue, drawing subject, or governing test is missing/);
  assert.match(prompt, /technique, instrument, access method, sampling pattern, or measurement procedure/);
  assert.match(prompt, /current physical evidence remains in the applicable inspection-report component block/);
  assert.match(prompt, /named component was not accessed or inspected during the current inspection/);
  assert.match(prompt, /previous external, internal, or bottom inspection history was not provided/);
});

test('prompt distinguishes external floor projection from internal floor and side sump evidence', () => {
  const prompt = narrativePrompt([{ evidenceId: 'floor', originalValue: 'Floor projection is corroded.',
    sourcePointer: '/voiceNotes/0/transcriptText', sourceSpan: { start: 0, end: 30 }, entity: {}, relationships: {} }]);
  assert.match(prompt, /floor projection or annular extension visible outside the shell/);
  assert.match(prompt, /side sumps/);
  assert.match(prompt, /inspection-report\/foundation/);
  assert.match(prompt, /inspection-report\/floor-internal/);
});

