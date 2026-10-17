import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, '../..');
const readJson = async (relativePath) => JSON.parse(await readFile(path.join(APP_ROOT, relativePath), 'utf8'));

const workflow = await readJson('server/report-workflow/workflow.json');
assert.equal(workflow.contractVersion, 'report_generation_workflow_scaffold_v1');
assert.equal(workflow.status, 'pre_generation_evaluation_ready');
assert.equal(workflow.productEnabled, false);
assert.equal(workflow.entryPaths.convergenceBoundary, 'authenticated_android_export_and_receipt');
assert.deepEqual(workflow.stages.map((stage) => stage.stageId), [
  'android-export-input-guard',
  'evidence-atomizer',
  'contents-classification',
  'classification-review',
  'section-evidence-packages',
  'report-structure-and-plan',
  'section-generation-and-pre-display-review',
  'report-integration-approval-and-export',
]);
assert.deepEqual(workflow.stages.map((stage) => stage.order), [1, 2, 3, 4, 5, 6, 7, 8]);

for (const stage of workflow.stages.filter((item) => item.implementation)) {
  await access(path.join(APP_ROOT, stage.implementation));
}

const [mockRelease, classifierRegistry, classifierContract, routerArchive, routerRegistry, outlineManifest] = await Promise.all([
  readJson('server/mock-preparation-agent/releases/v1/release-manifest.json'),
  readJson('server/contents-classification-agent/release-registry.json'),
  readJson('server/contents-classification-agent/evaluation-pathway-contract.json'),
  readJson('server/report-evidence-router/archive-manifest.json'),
  readJson('server/report-evidence-router/release-registry.json'),
  readJson('server/contents-classification-agent/outline-profiles/vertical-api653-v6/outline-manifest.json'),
]);

assert.equal(mockRelease.releaseId, workflow.activeEvaluationReleases.mockPreparation);
assert.equal(mockRelease.immutable, true);
assert.equal(mockRelease.productUseEnabled, false);
const classifier = classifierRegistry.entries.find((entry) => entry.releaseId === workflow.activeEvaluationReleases.contentsClassification);
assert(classifier, 'Workflow classifier release is absent from the exact release registry.');
assert.equal(classifier.productEnabled, false);
assert.equal(classifierContract.releaseId, classifier.releaseId);
assert.equal(classifierContract.outputContract, workflow.generationHandoff.contractVersion);
assert.equal(classifierContract.productEnabled, false);
assert.equal(outlineManifest.profileId, workflow.activeEvaluationReleases.outlineProfile);
assert.equal(outlineManifest.productUseEnabled, false);
assert.equal(routerArchive.archiveStatus, 'historical_evaluation_only');
assert.equal(routerArchive.activeForNewWork, false);
assert.equal(routerArchive.replacement.releaseId, classifier.releaseId);
assert.equal(routerRegistry.activeReleaseId, null);
assert.equal(routerRegistry.archiveStatus, 'historical_evaluation_only');
assert.equal(workflow.generationHandoff.productGenerationEligible, false);
assert(workflow.stages.slice(5).every((stage) => stage.state.startsWith('planned')),
  'The scaffold must not present unimplemented generation stages as active.');

console.log(JSON.stringify({
  passed: true,
  workflowId: workflow.workflowId,
  implementedPreGenerationStages: 5,
  generationHandoff: workflow.generationHandoff.contractVersion,
  activeEvaluationReleases: workflow.activeEvaluationReleases,
  archivedRouterActiveForNewWork: false,
  productEnabled: false,
}, null, 2));
