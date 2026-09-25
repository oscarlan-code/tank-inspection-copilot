import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { loadGenericOutlineHeldOutReview, matchesGenericOutlineReviewCase, resolveGenericOutlineSource } from '../experiments/generic-outline-review-backend.mjs';
import { GENERAL_INFORMATION_REVIEW_SOURCES } from '../experiments/general-information-review-backend.mjs';
const root = new URL('../../docs/reviews/data/general-tank-information-v1/', import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const load = async name => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const manifest = await load('review-manifest.json');
for (const [name, expected] of Object.entries(manifest.files)) assert.equal(hash(await readFile(new URL(name, root))), expected, name);
const freeze = await load('development-freeze.json');
// Historical qualification is immutable; current routing uses the separately pinned release.
for (const [name, expected] of Object.entries(freeze.codeHashes)) assert.equal(hash(await readFile(new URL(`qualification-snapshot/${name}`, root))), expected, name);
assert.equal(hash(await readFile(new URL('cohort.json', root))), freeze.cohortSha256);
const cohort = await load('cohort.json');
assert.equal(new Set(cohort.cases.map(row => row.sourceSha256)).size, 11);
assert.equal(new Set(cohort.cases.map(row => row.registryLineage)).size, 11);
assert.equal(cohort.cases.filter(row => row.split === 'development').length, 10);
assert.equal(cohort.cases.filter(row => row.split === 'held_out').length, 1);
for (const split of ['development', 'held_out']) {
  const results = await load(`${split}-results.json`), prep = await load(`${split}-preparation.json`);
  assert.deepEqual(results.codeHashes, freeze.codeHashes);
  assert.equal(results.summary.passed, results.summary.reports);
  assert.equal(results.summary.fields, results.summary.preservedFields);
  assert.equal(results.paidAiCalls, 0); assert.equal(results.promotionPerformed, false);
  for (const row of results.cases) {
    const pin = prep.cases.find(item => item.caseId === row.caseId);
    assert.equal(hash(await readFile(new URL(`inputs/${row.caseId}.json`, root))), pin.inputSha256);
    assert.equal(hash(await readFile(new URL(`evaluator-only/${row.caseId}-expected.json`, root))), pin.expectedSha256);
    assert.equal(hash(await readFile(new URL(`exports/${row.caseId}.docx`, root))), row.exportSha256);
    assert.equal(row.generated.draft.approved, false);
    if (split === 'held_out') assert(new Date(row.generated.generationRun.generatedAtIso) > new Date(freeze.frozenAtIso));
  }
}
for (let index = 0; index < GENERAL_INFORMATION_REVIEW_SOURCES.length; index++) {
  const source = GENERAL_INFORMATION_REVIEW_SOURCES[index], evaluationCaseId = source.evaluationCaseId;
  assert(matchesGenericOutlineReviewCase(evaluationCaseId));
  const review = await loadGenericOutlineHeldOutReview({ evaluationCaseId, sectionId: 'general-tank-information' });
  assert.equal(review.sections.length, 11); assert.equal(review.appEvidence.length, 31);
  assert.equal(review.appEvidence.filter(item => item.sourceClass === 'app_field').length, 7);
  assert.equal(review.appEvidence.filter(item => item.sourceClass === 'report_side_input').length, 24);
  assert.equal(review.promotionGate.eligible, false); assert.equal(review.rawAiResponse, undefined);
  assert.equal(review.previousEvaluationCaseId, GENERAL_INFORMATION_REVIEW_SOURCES[index - 1]?.evaluationCaseId ?? null);
  assert.equal(review.nextEvaluationCaseId, GENERAL_INFORMATION_REVIEW_SOURCES[index + 1]?.evaluationCaseId ?? null);
  assert.equal((await resolveGenericOutlineSource(evaluationCaseId)).sha256, source.sourceSha256);
  await assert.rejects(loadGenericOutlineHeldOutReview({ evaluationCaseId, sectionId: 'bad' }), error => error.statusCode === 404);
  await assert.rejects(loadGenericOutlineHeldOutReview({ evaluationCaseId, evalRunId: 'bad' }), error => error.statusCode === 404);
}
console.log(JSON.stringify({ reviewCases: 11, developmentFields: 310, heldOutFields: 31, frozenCodeVerified: true, promotionPerformed: false, passed: true }));
