import assert from 'node:assert/strict';
import test from 'node:test';
import { NOTE_SPECS, PILOT_FACT_IDS, validatePlanCoverage } from './prepare-pilot.mjs';

test('20-fact pilot assigns every fact to exactly one mixed note', () => {
  assert.equal(validatePlanCoverage(), true);
  assert.equal(PILOT_FACT_IDS.length, 20);
  assert.equal(NOTE_SPECS.length, 7);
  const assigned = NOTE_SPECS.flatMap((note) => note.factIds);
  assert.deepEqual([...assigned].sort(), [...PILOT_FACT_IDS].sort());
});

test('pilot rejects duplicated fact assignment', () => {
  const duplicate = structuredClone(NOTE_SPECS);
  duplicate[1].factIds.push(PILOT_FACT_IDS[0]);
  assert.throws(() => validatePlanCoverage(PILOT_FACT_IDS, duplicate),
    /assigned to exactly one|cannot be assigned/);
});
