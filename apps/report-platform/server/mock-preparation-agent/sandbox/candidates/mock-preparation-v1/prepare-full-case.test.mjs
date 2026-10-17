import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBatches, inspectCandidate } from './prepare-full-case.mjs';

test('packs complete note groups without exceeding twenty facts', () => {
  const notes = [
    { noteId: 'a', factIds: Array.from({ length: 12 }, (_, i) => `a-${i}`) },
    { noteId: 'b', factIds: Array.from({ length: 9 }, (_, i) => `b-${i}`) },
    { noteId: 'c', factIds: Array.from({ length: 8 }, (_, i) => `c-${i}`) },
  ];
  const facts = notes.flatMap((note) => note.factIds.map((factId) => ({ factId })));
  const batches = buildBatches(facts, notes, 20);
  assert.deepEqual(batches.map((item) => item.factIds.length), [12, 17]);
  assert.deepEqual(batches.map((item) => item.noteIds), [['a'], ['b', 'c']]);
  assert.deepEqual(batches.flatMap((item) => item.factIds).sort(), facts.map((item) => item.factId).sort());
});

test('rejects a note group larger than one model batch', () => {
  const note = { noteId: 'a', factIds: Array.from({ length: 21 }, (_, i) => `a-${i}`) };
  const facts = note.factIds.map((factId) => ({ factId }));
  assert.throws(() => buildBatches(facts, [note], 20), /cannot fit/);
});

test('rejects a generated variation that closely copies its source sentence', () => {
  const batch = {
    factIds: ['fact-1'],
    facts: [{ factId: 'fact-1', sourceText: 'The vertical ladder attached to the tank shell was satisfactory.' }],
    notes: [{ noteId: 'obs-1', factIds: ['fact-1'] }],
  };
  const copied = { notes: [{ noteId: 'obs-1', clauses: [{
    text: 'The vertical ladder attached to the tank shell was in satisfactory condition.',
    factIds: ['fact-1'],
  }] }] };
  const rephrased = { notes: [{ noteId: 'obs-1', clauses: [{
    text: 'Visual condition of the shell-mounted access ladder was satisfactory.',
    factIds: ['fact-1'],
  }] }] };
  assert.match(inspectCandidate(copied, batch, true).join(' '), /closely copies its source sentence/);
  assert.deepEqual(inspectCandidate(rephrased, batch, true), []);
});

test('allows a protected technical phrase inside a substantially rephrased sentence', () => {
  const batch = {
    factIds: ['fact-1'],
    facts: [{
      factId: 'fact-1',
      sourceText: 'Thickness measurements are to be taken on all roof and shell nozzles, manways and attached reinforcement pads with four readings recorded at each location.',
    }],
    notes: [{ noteId: 'scope-1', factIds: ['fact-1'] }],
  };
  const candidate = { notes: [{ noteId: 'scope-1', clauses: [{
    text: 'Measure thickness on the roof and shell nozzles, manways and attached reinforcement pads, taking four readings per nozzle and pad.',
    factIds: ['fact-1'],
  }] }] };
  assert.deepEqual(inspectCandidate(candidate, batch, true), []);
});

test('requires an explicit unit for a reviewed OCR size normalization', () => {
  const batch = {
    factIds: ['fact-1'],
    facts: [{
      factId: 'fact-1',
      sourceText: "3 ' roof venting nozzle was not trimmed flushed.",
      protectedFacts: {
        nominalSize: { value: 3, unit: 'in', sourceNotation: "3 '", status: 'reviewed_ocr_normalization' },
      },
    }],
    notes: [{ noteId: 'obs-1', factIds: ['fact-1'] }],
  };
  const missingUnit = { notes: [{ noteId: 'obs-1', clauses: [{
    text: 'Roof venting nozzle size 3 was not trimmed flush.', factIds: ['fact-1'],
  }] }] };
  const explicitUnit = { notes: [{ noteId: 'obs-1', clauses: [{
    text: 'The 3-inch roof venting nozzle was not trimmed flush.', factIds: ['fact-1'],
  }] }] };
  assert.match(inspectCandidate(missingUnit, batch, false).join(' '), /must state 3 in with an explicit unit/);
  assert.deepEqual(inspectCandidate(explicitUnit, batch, false), []);
});

test('requires both bounds and the unit for an explicit source measurement range', () => {
  const batch = {
    factIds: ['fact-range'],
    facts: [{
      factId: 'fact-range',
      sourceText: 'Pit depth ranged from 1 mm to 3 mm.',
      protectedFacts: {
        pitDepth: { minimum: 1, maximum: 3, unit: 'mm', status: 'source_explicit' },
      },
    }],
    notes: [{ noteId: 'obs-range', factIds: ['fact-range'] }],
  };
  const incomplete = { notes: [{ noteId: 'obs-range', clauses: [{
    text: 'Pits were up to 3 deep.', factIds: ['fact-range'],
  }] }] };
  const complete = { notes: [{ noteId: 'obs-range', clauses: [{
    text: 'Pit depths ranged from 1 to 3 mm.', factIds: ['fact-range'],
  }] }] };
  assert.match(inspectCandidate(incomplete, batch, false).join(' '), /must state 1–3 mm with an explicit unit/);
  assert.deepEqual(inspectCandidate(complete, batch, false), []);
});
