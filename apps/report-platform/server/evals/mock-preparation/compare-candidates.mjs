#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

function parseArgs(argv) {
  const value = (name) => { const index = argv.indexOf(name); return index >= 0 ? argv[index + 1] : null; };
  const baseline = value('--baseline');
  const candidate = value('--candidate');
  if (!baseline || !candidate) throw new Error('Usage: compare-candidates.mjs --baseline <dataset.json> --candidate <dataset.json>');
  return { baseline: resolve(baseline), candidate: resolve(candidate) };
}

function rate(dataset, result) {
  const eligible = dataset.rows.filter((row) => row.result !== 'not_applicable');
  return eligible.length ? eligible.filter((row) => row.result === result).length / eligible.length : 0;
}

function assertComparable(left, right) {
  const leftDataset = left.dataset ?? {};
  const rightDataset = right.dataset ?? {};
  for (const key of ['caseId', 'caseRevision', 'sourceSha256']) {
    if (leftDataset[key] !== rightDataset[key]) throw new Error(`Candidate datasets differ at ${key}; comparison is invalid.`);
  }
  const leftRows = left.rows.map((row) => row.rowId).sort();
  const rightRows = right.rows.map((row) => row.rowId).sort();
  if (JSON.stringify(leftRows) !== JSON.stringify(rightRows)) throw new Error('Candidate datasets do not contain the same frozen rows.');
}

const { baseline, candidate } = parseArgs(process.argv.slice(2));
const [left, right] = await Promise.all([readJson(baseline), readJson(candidate)]);
assertComparable(left, right);
const metrics = ['pass', 'fail', 'pending'].map((result) => ({
  metric: `${result}_rate`,
  baseline: rate(left, result),
  candidate: rate(right, result),
  delta: rate(right, result) - rate(left, result),
}));
console.log(JSON.stringify({
  contractVersion: 'mock_preparation_candidate_comparison_v1',
  dataset: left.dataset,
  baseline: left.candidate,
  candidate: right.candidate,
  metrics,
  rule: 'Only one declared candidate variable may differ; human review decides whether regressions are acceptable.',
}, null, 2));
