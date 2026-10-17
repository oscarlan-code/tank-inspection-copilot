import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const readJson = async (path) => JSON.parse(await readFile(resolve(ROOT, path), 'utf8'));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

test('pipeline has a pre-runtime leakage boundary followed by four closed-book runtime stages', async () => {
  const pipeline = await readJson('releases/evaluation/v1/pipeline-contract.json');
  assert.deepEqual(pipeline.stages.map((item) => item.stageId), [
    'android-productstore-export','evaluation-input-leakage-guard','evidence-atomizer',
    'contents-classification-agent','classification-guard','section-evidence-packages']);
  const leakageGuard = pipeline.stages.find((item) => item.stageId === 'evaluation-input-leakage-guard');
  assert.equal(leakageGuard.goldAccess, 'evaluator_private_for_detection_and_binding_only');
  assert.equal(leakageGuard.goldMayReachRuntimeOutput, false);
  assert(pipeline.stages.filter((item) => ['evidence-atomizer','contents-classification-agent','classification-guard','section-evidence-packages'].includes(item.stageId)).every((item) => item.goldAccess === false));
  assert.equal(pipeline.postRunEvaluator.goldAccess, true);
  assert.equal(pipeline.postRunEvaluator.cannotFeedSectionGenerator, true);
});

test('outline profile is bound to the reviewed 69-report vertical profile', async () => {
  const outline = await readJson('outline-profiles/vertical-api653-v6/outline-profile.json');
  const reportPlatformRoot = process.env.REPORT_PLATFORM_ROOT
    ? resolve(process.env.REPORT_PLATFORM_ROOT) : resolve(ROOT, '../..');
  const sourcePath = resolve(reportPlatformRoot, 'docs/design/vertical-tank-inspection-v1.json');
  const source = await readFile(sourcePath);
  assert.equal(sha256(source), outline.sourceBasis.reviewedProfileSha256);
  assert.equal(outline.sourceBasis.verticalReportsReviewed, 69);
  const core = outline.sections.filter((item) => item.class === 'common_core');
  assert.equal(core.length, 7);
  assert.deepEqual(core.map((item) => item.canonicalOrder), [1,2,3,4,5,6,7]);
  assert.equal(outline.status, 'frozen_for_r_and_d_evaluation');
  assert.equal(outline.productEnabled, false);
  assert.equal(outline.evaluationEnabled, true);
  assert.equal(outline.sections.length, 25);
  assert.equal(outline.sections.filter((item) => item.class === 'conditional_technical').length, 18);
  assert.equal(new Set(outline.sections.map((item) => item.sectionId)).size, outline.sections.length);
  for (const section of outline.sections) {
    assert(section.sectionId && section.title && section.blocks.length > 0);
    assert.equal(new Set(section.blocks).size, section.blocks.length);
  }
});

test('active evaluation release is product-disabled and target-gold blind', async () => {
  const [spec, kb, harness] = await Promise.all([
    readJson('releases/evaluation/v1/agent-spec.json'),
    readJson('releases/evaluation/v1/kb-policy.json'),
    readJson('releases/evaluation/v1/harness.json')]);
  assert.equal(spec.productEnabled, false);
  assert(spec.runtimeForbidden.includes('target_original_report'));
  assert(spec.runtimeForbidden.includes('target_gold_labels'));
  assert(kb.prohibited.includes('same_case_or_near_duplicate_cases'));
  assert.equal(harness.hardGates.targetGoldExposure, 0);
  assert.equal(harness.hardGates.criticalSectionRecall, 1);
  assert.equal(spec.routingCardinality.voiceNarrativePrimaryUses, 'zero_or_one');
});

test('evaluator can open gold only after classification and cannot feed generation', async () => {
  const evaluator = await readJson('evaluators/classification-gold-evaluator/v1/agent-spec.json');
  assert.equal(evaluator.evaluationTiming, 'after_runtime_output_is_sealed');
  assert(evaluator.inputs.includes('humanReviewedOriginalTextUnits'));
  assert(evaluator.forbiddenOutputs.includes('sectionGeneratorInput'));
});


test('frozen outline manifest and API 653 mapping are internally consistent', async () => {
  const [profile, obligations, review, manifest, spec] = await Promise.all([
    readJson('outline-profiles/vertical-api653-v6/outline-profile.json'),
    readJson('outline-profiles/vertical-api653-v6/api653-report-obligations.json'),
    readJson('outline-profiles/vertical-api653-v6/outline-review.json'),
    readJson('outline-profiles/vertical-api653-v6/outline-manifest.json'),
    readJson('releases/evaluation/v1/agent-spec.json')
  ]);
  const sectionBlocks = new Map(profile.sections.map((section) => [section.sectionId, new Set(section.blocks)]));
  for (const obligation of obligations.reportContentObligations) {
    for (const use of obligation.uses) {
      assert(sectionBlocks.get(use.sectionId)?.has(use.blockId),
        `Invalid obligation use ${use.sectionId}/${use.blockId}`);
    }
  }
  assert.equal(obligations.reportContentObligations.length, 11);
  assert.equal(obligations.annexC.normativeReportSection, false);
  assert.equal(review.evaluationUseApproved, true);
  assert.equal(review.productUseApproved, false);
  assert.equal(manifest.immutable, true);
  assert.equal(spec.outlineProfileBinding.profileSha256,
    sha256(await readFile(resolve(ROOT, 'outline-profiles/vertical-api653-v6/outline-profile.json'))));
  assert.equal(spec.outlineProfileBinding.manifestSha256,
    sha256(await readFile(resolve(ROOT, 'outline-profiles/vertical-api653-v6/outline-manifest.json'))));
});


test('active evaluation release requires the sealed leakage-guard package', async () => {
  const [spec, harness, policy] = await Promise.all([
    readJson('releases/evaluation/v1/agent-spec.json'),
    readJson('releases/evaluation/v1/harness.json'),
    readJson('input-guards/evaluation-leakage/v1/policy.json')
  ]);
  assert.equal(spec.inputGuard.requiredDecision, 'passed');
  assert.equal(spec.inputGuard.runtimeInput, 'sealed_classification_input_v1');
  assert.equal(spec.inputGuard.evaluatorCrosswalkAccessibleToClassifier, false);
  assert.equal(harness.hardGates.forbiddenExportMetadata, 0);
  assert.equal(harness.hardGates.reportSectionHintExposure, 0);
  assert.equal(harness.hardGates.evaluatorCrosswalkExposure, 0);
  assert.equal(harness.hardGates.protectedNativeEvidenceMutation, 0);
  assert.equal(harness.hardGates.mockTransportIdentifierExposure, 0);
  assert.equal(policy.rules.blockedInputProducesRuntimePackage, false);
  assert.equal(policy.rules.crosswalkIsEvaluatorOnly, true);
});

test('candidate and outline registries expose only the promoted release inputs as current', async () => {
  const [candidates, outlines, releases] = await Promise.all([
    readJson('sandbox/candidate-registry.json'),
    readJson('outline-profiles/registry.json'),
    readJson('release-registry.json'),
  ]);
  assert.equal(candidates.activeCandidateId, null);
  assert.equal(candidates.promotedRelease.candidateId, 'contents-classification-v10');
  assert.equal(candidates.promotedRelease.releaseId, 'contents-classification-evaluation-v1');
  assert(candidates.candidates.filter((item) => /^contents-classification-v[1-9]$/.test(item.candidateId))
    .every((item) => item.status === 'superseded_experiment'));
  assert.equal(outlines.activeEvaluationProfileId, 'vertical-api653-inspection-report-v6');
  assert.equal(outlines.productProfileId, null);
  assert(outlines.profiles.filter((item) => item.directory !== 'vertical-api653-v6')
    .every((item) => item.status === 'superseded_evaluation_artifact'));
  assert(releases.entries.some((item) => item.releaseId === candidates.promotedRelease.releaseId));
});
