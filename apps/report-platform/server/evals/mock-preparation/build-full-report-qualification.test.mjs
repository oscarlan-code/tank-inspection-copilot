import test from 'node:test';
import assert from 'node:assert/strict';
import { formatUtSourceText, utRowsEquivalent } from './build-full-report-qualification.mjs';

const row = {
  itemKey: 'shell:element:shell_nozzle_s7',
  target: 'shell',
  itemLabel: 'S7',
  kind: 'ELEMENT',
  elementType: 'nozzle',
  nozzleSize: '4 in',
  reinforcementPadReading: '7.80',
  readings: [5.59, 5.7, 5.72, 5.65],
  confirmed: true,
};

test('treats Android numeric encoding as equivalent to reviewed UT text', () => {
  assert.equal(utRowsEquivalent({ ...row, reinforcementPadReading: 7.8 }, row), true);
});

test('treats an empty optional Android reading as equivalent to reviewed N/A', () => {
  assert.equal(utRowsEquivalent(
    { ...row, reinforcementPadReading: '' },
    { ...row, reinforcementPadReading: 'NA' },
  ), true);
});

test('does not hide changed UT values or units', () => {
  assert.equal(utRowsEquivalent({ ...row, reinforcementPadReading: 7.9 }, row), false);
  assert.equal(utRowsEquivalent({ ...row, nozzleSize: '6 in' }, row), false);
});

test('renders one atomic UT truth row instead of repeating the whole source table', () => {
  const text = formatUtSourceText({ protectedFacts: row });
  assert.match(text, /Shell · nozzle S7/);
  assert.match(text, /12 o’clock: 5\.59 mm/);
  assert.match(text, /Reinforcement pad: 7\.80 mm/);
  assert.doesNotMatch(text, /Plate No\./);
});
