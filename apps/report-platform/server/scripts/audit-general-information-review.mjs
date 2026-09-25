import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  loadGenericOutlineHeldOutReview,
  matchesGenericOutlineReviewCase,
  resolveGenericOutlineSource,
} from '../experiments/generic-outline-review-backend.mjs';
import { GENERAL_INFORMATION_REVIEW_SOURCES } from '../experiments/general-information-review-backend.mjs';

const dataRoot = new URL('../../docs/reviews/data/general-tank-information-v2-historical/', import.meta.url);
const sourceRoot = new URL('../../docs/reviews/data/general-tank-information-v1/', import.meta.url);
const releaseManifest = new URL('../section-agents/releases/general-tank-information/v2/manifest.json', import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const load = async (root, name) => JSON.parse(await readFile(new URL(name, root), 'utf8'));

const freeze = await load(dataRoot, 'development-freeze.json');
const final = await load(dataRoot, 'final-summary.json');
assert.equal(freeze.releaseManifestSha256, hash(await readFile(releaseManifest)));
assert.equal(freeze.cohortSha256, hash(await readFile(new URL('cohort.json', sourceRoot))));
assert.equal(freeze.developmentResultsSha256, hash(await readFile(new URL('development-results.json', dataRoot))));
assert.equal(final.release, 'general_tank_information_v2');
assert.equal(final.totalReports, 11);
assert.equal(final.totalFields, 341);
assert.equal(final.totalPreservedFields, 341);
assert.equal(final.originalSectionAvailableToGenerator, false);
assert.equal(final.paidAiCalls, 0);
assert.equal(final.runtimeRetrievals, 0);
assert.equal(final.promotionPerformed, false);

for (let index = 0; index < GENERAL_INFORMATION_REVIEW_SOURCES.length; index++) {
  const source = GENERAL_INFORMATION_REVIEW_SOURCES[index];
  const { evaluationCaseId } = source;
  assert.match(evaluationCaseId, /^eval-general-info-v2-gti-/);
  assert(matchesGenericOutlineReviewCase(evaluationCaseId));
  const review = await loadGenericOutlineHeldOutReview({ evaluationCaseId, sectionId: 'general-tank-information' });
  assert.equal(review.generatorContractVersion, 'general_tank_information_v2');
  assert.equal(review.sections.length, 11);
  assert.equal(review.appEvidence.length, 31);
  assert.equal(review.appEvidence.filter(item => item.sourceClass === 'app_field').length, 7);
  assert.equal(review.appEvidence.filter(item => item.sourceClass === 'report_side_input').length, 24);
  assert.equal(review.metrics.requiredFactRecall, 1);
  assert.equal(review.metrics.protectedFactAccuracy, 1);
  assert.equal(review.metrics.formatMatch, 1);
  assert.equal(review.promotionGate.eligible, false);
  assert.equal(review.rawAiResponse, undefined);
  assert.equal(review.previousEvaluationCaseId, GENERAL_INFORMATION_REVIEW_SOURCES[index - 1]?.evaluationCaseId ?? null);
  assert.equal(review.nextEvaluationCaseId, GENERAL_INFORMATION_REVIEW_SOURCES[index + 1]?.evaluationCaseId ?? null);
  assert.equal((await resolveGenericOutlineSource(evaluationCaseId)).sha256, source.sourceSha256);
  await assert.rejects(loadGenericOutlineHeldOutReview({ evaluationCaseId, sectionId: 'bad' }), error => error.statusCode === 404);
  await assert.rejects(loadGenericOutlineHeldOutReview({ evaluationCaseId, evalRunId: 'bad' }), error => error.statusCode === 404);
}

console.log(JSON.stringify({
  reviewCases: 11,
  release: final.release,
  developmentFields: 310,
  heldOutFields: 31,
  savedArtifactsVerified: true,
  promotionPerformed: false,
  passed: true,
}));
