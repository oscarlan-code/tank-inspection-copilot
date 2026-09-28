#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SECTION_AGENT_RELEASES } from '../section-agents/generator-registry.mjs';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const valueAfter = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
const dataRoot = pathToFileURL(`${resolve(valueAfter('--private-data')
  ?? `${appRoot}/docs/reviews/data/general-tank-information-v2-historical`)}/`);
const sourceRoot = pathToFileURL(`${resolve(valueAfter('--source-data')
  ?? `${appRoot}/docs/reviews/data/general-tank-information-v1`)}/`);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = (root, name) => readFile(new URL(name, root));
const json = async (root, name) => JSON.parse(await bytes(root, name));
const fileSha = path => readFile(path).then(sha256);

const release = SECTION_AGENT_RELEASES.general_tank_information_v2;
const freeze = await json(dataRoot, 'development-freeze.json');
assert.equal(freeze.releaseManifestSha256, release.manifestSha256);
assert.equal(freeze.releaseManifestSha256,
  await fileSha(`${appRoot}/server/section-agents/releases/general-tank-information/generator/v2/manifest.json`));
assert.equal(freeze.cohortSha256, sha256(await bytes(sourceRoot, 'cohort.json')));
assert.equal(freeze.preparationScriptSha256,
  await fileSha(`${appRoot}/server/scripts/prepare-general-information-v2-historical.py`));
assert.equal(freeze.evaluationScriptSha256,
  await fileSha(`${appRoot}/server/scripts/run-general-information-v2-historical-evaluation.mjs`));
assert.equal(freeze.developmentResultsSha256, sha256(await bytes(dataRoot, 'development-results.json')));
assert.equal(freeze.heldOutContentOpened, false);

const cohort = await json(sourceRoot, 'cohort.json');
const summaries = {};
for (const split of ['development', 'held_out']) {
  const preparation = await json(dataRoot, `${split}-preparation.json`);
  const results = await json(dataRoot, `${split}-results.json`);
  assert.equal(preparation.originalSectionAvailableToGenerator, false);
  assert.equal(results.originalSectionAvailableToGenerator, false);
  assert.equal(results.release, release.version);
  assert.equal(results.manifestSha256, release.manifestSha256);
  assert.equal(results.paidAiCalls, 0);
  assert.equal(results.runtimeRetrievals, 0);
  assert.equal(results.promotionPerformed, false);
  const expectedCount = split === 'development' ? 10 : 1;
  assert.equal(results.summary.reports, expectedCount);
  assert.equal(results.summary.passed, expectedCount);
  assert.equal(results.summary.fields, expectedCount * 31);
  assert.equal(results.summary.preservedFields, expectedCount * 31);
  assert.equal(results.summary.formatAligned, expectedCount);
  assert.equal(results.cases.length, expectedCount);
  for (const row of results.cases) {
    const cohortRow = cohort.cases.find(item => item.caseId === row.caseId);
    const pin = preparation.cases.find(item => item.caseId === row.caseId);
    assert(cohortRow && cohortRow.split === split);
    assert.equal(row.sourceSha256, cohortRow.sourceSha256);
    assert.equal(row.inputSha256, sha256(await bytes(dataRoot, `inputs/${row.caseId}.json`)));
    assert.equal(row.expectedSha256, sha256(await bytes(dataRoot, `evaluator-only/${row.caseId}-expected.json`)));
    assert.equal(row.inputSha256, pin.inputSha256);
    assert.equal(row.expectedSha256, pin.expectedSha256);
    assert.equal(row.passed, true);
    assert.equal(row.fieldCount, 31);
    assert.equal(row.preservedFieldCount, 31);
    assert(row.fieldChecks.every(field => field.passed));
    assert(Object.values(row.structuralChecks).every(Boolean));
  }
  summaries[split] = results.summary;
}

const final = await json(dataRoot, 'final-summary.json');
assert.equal(final.release, release.version);
assert.equal(final.manifestSha256, release.manifestSha256);
assert.deepEqual(final.development, summaries.development);
assert.deepEqual(final.heldOut, summaries.held_out);
assert.equal(final.totalReports, 11);
assert.equal(final.totalFields, 341);
assert.equal(final.totalPreservedFields, 341);
assert.equal(final.historicalFieldAccuracy, 1);
assert.equal(final.formatAlignmentRate, 1);
assert.equal(final.originalSectionAvailableToGenerator, false);
assert.equal(final.promotionPerformed, false);

console.log(JSON.stringify({ passed: true, release: release.version, development: summaries.development,
  heldOut: summaries.held_out, totalReports: 11, totalFields: 341, totalPreservedFields: 341,
  historicalFieldAccuracy: 1, formatAlignmentRate: 1, originalSectionAvailableToGenerator: false,
  paidAiCalls: 0, runtimeRetrievals: 0, productEnabled: false }, null, 2));
