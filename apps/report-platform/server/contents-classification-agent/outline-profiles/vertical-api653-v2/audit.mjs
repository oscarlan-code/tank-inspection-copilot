import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROFILE_DIR = dirname(fileURLToPath(import.meta.url));
const REPORT_PLATFORM_ROOT = resolve(PROFILE_DIR, '../../../..');
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const fileSha256 = async (path) => sha256(await readFile(path));
const exists = async (path) => {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
};

const [profile, evidence, obligations, review, contract, manifest] = await Promise.all([
  readJson(resolve(PROFILE_DIR, 'outline-profile.json')),
  readJson(resolve(PROFILE_DIR, 'historical-outline-evidence.json')),
  readJson(resolve(PROFILE_DIR, 'api653-report-obligations.json')),
  readJson(resolve(PROFILE_DIR, 'outline-review.json')),
  readJson(resolve(PROFILE_DIR, 'outline-review-contract.json')),
  readJson(resolve(PROFILE_DIR, 'outline-manifest.json'))
]);

assert.equal(profile.status, 'frozen_for_r_and_d_evaluation');
assert.equal(profile.contractVersion, 'vertical_api653_outline_profile_v2');
assert.equal(profile.profileId, 'vertical-api653-inspection-report-v2');
assert.equal(profile.evaluationEnabled, true);
assert.equal(profile.productEnabled, false);
assert.equal(profile.sections.length, 25);
assert.equal(profile.sections.filter((item) => item.class === 'common_core').length, 7);
assert.equal(profile.sections.filter((item) => item.class === 'conditional_technical').length, 18);
assert.equal(new Set(profile.sections.map((item) => item.sectionId)).size, 25);
assert(profile.sections.some((item) => item.sectionId === 'corrosion-rate-and-remaining-life-assessment'));
assert.equal(profile.routingDefinitions.generalTankInformation.configuration.includes('year built'), true);
assert.equal(profile.routingDefinitions.generalTankInformation.configuration.includes('service height'), true);
assert.equal(profile.routingDefinitions.generalTankInformation['design-data'].includes('shell joint or construction type'), true);
assert.match(profile.routingDefinitions.recommendations.explicitActionPrecedence, /explicit proposed action/);
assert.equal(profile.routingDefinitions.inspectionComponents.earthPointAttachedToShell,
  'inspection-report/shell-appurtenances');

const sections = new Map(profile.sections.map((section) => [section.sectionId, new Set(section.blocks)]));
const mappedItems = [
  ...obligations.reportContentObligations,
  ...obligations.recommendationObligations,
  ...obligations.recordContext,
  obligations.annexC
];
for (const item of mappedItems) {
  assert(item.uses?.length > 0, `${item.id ?? 'annexC'} has no target use`);
  for (const use of item.uses) {
    assert(sections.has(use.sectionId), `Unknown mapped section ${use.sectionId}`);
    assert(sections.get(use.sectionId).has(use.blockId),
      `Unknown block ${use.sectionId}/${use.blockId}`);
  }
}
assert.deepEqual(
  obligations.reportContentObligations.map((item) => item.id),
  'abcdefghijk'.split('').map((letter) => `api653-6.9.2-${letter}`)
);
assert.equal(obligations.annexC.normativeReportSection, false);
assert.equal(obligations.currentEditionCheck.productComplianceEligible, false);
assert(obligations.currentEditionCheck.localSourceGap.includes('Addendum 3, November 2023'));
assert(obligations.currentEditionCheck.localSourceGap.includes('Errata 2, February 2025'));

for (const source of [
  evidence.verticalFamilyReview,
  evidence.commonCorePatternPacks,
  evidence.broadKnowledgeBaseReview
]) {
  const path = resolve(REPORT_PLATFORM_ROOT, source.sourcePath);
  assert.equal(await fileSha256(path), source.sourceSha256, `Source hash mismatch: ${source.sourcePath}`);
}
const genericOutlinePath = resolve(REPORT_PLATFORM_ROOT, evidence.broadKnowledgeBaseReview.genericOutlinePath);
assert.equal(await fileSha256(genericOutlinePath), evidence.broadKnowledgeBaseReview.genericOutlineSha256);

for (const item of manifest.files) {
  assert.equal(await fileSha256(resolve(PROFILE_DIR, item.path)), item.sha256,
    `Frozen artifact hash mismatch: ${item.path}`);
}
const bundleMaterial = manifest.files.map((item) => `${item.path}:${item.sha256}\n`).join('');
assert.equal(sha256(bundleMaterial), manifest.bundleSha256);
assert.equal(manifest.immutable, true);
assert.equal(manifest.evaluationUseEnabled, true);
assert.equal(manifest.productUseEnabled, false);

const localStandardPath = obligations.localReviewedSource.path;
const localStandardVerified = await exists(localStandardPath);
if (localStandardVerified) {
  assert.equal(await fileSha256(localStandardPath), obligations.localReviewedSource.sha256,
    'Pinned local API 653 PDF hash mismatch');
}

assert.equal(review.decision, 'approved_for_classification_evaluation_with_product_blocker');
assert.equal(review.evaluationUseApproved, true);
assert.equal(review.productUseApproved, false);
assert.equal(review.freeze.sectionCount, 25);
assert.equal(review.freeze.commonCoreCount, 7);
assert.equal(review.freeze.conditionalTechnicalCount, 18);
assert.equal(contract.approval.evaluationUseApproved, true);
assert.equal(contract.approval.productUseApproved, false);

const candidateSpec = await readJson(resolve(BASE_DIR(), 'sandbox/candidates/contents-classification-v3/agent-spec.json'));
assert.equal(candidateSpec.outlineProfileBinding.profileSha256,
  await fileSha256(resolve(PROFILE_DIR, 'outline-profile.json')));
assert.equal(candidateSpec.outlineProfileBinding.manifestSha256,
  await fileSha256(resolve(PROFILE_DIR, 'outline-manifest.json')));

function BASE_DIR() {
  return resolve(PROFILE_DIR, '../..');
}

console.log(JSON.stringify({
  status: 'pass',
  profileId: profile.profileId,
  sectionCount: profile.sections.length,
  commonCore: 7,
  conditionalTechnical: 18,
  api653ReportContentMappings: obligations.reportContentObligations.length,
  localStandardVerified,
  evaluationUseEnabled: true,
  productUseEnabled: false,
  openProductBlocker: review.productBlocker.id
}, null, 2));
