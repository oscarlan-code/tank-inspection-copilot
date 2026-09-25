#!/usr/bin/env node
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildMinimumReportPlan, buildMinimumSectionPlan } from '../report-plans/minimum-report-plan.mjs';
import {
  SECTION_AGENT_RELEASES, executePlannedSection, getSectionAgentBinding,
  resolveSectionAgentRelease, runSectionAgent,
} from '../section-agents/index.mjs';
import { verifyFrozenRelease } from '../section-agents/frozen-release.mjs';

const release = SECTION_AGENT_RELEASES.scope_of_inspection_v1;
const releaseRoot = new URL('../section-agents/releases/scope-of-inspection/v1/', import.meta.url);
const readJson = async url => JSON.parse(await readFile(url, 'utf8'));
const { manifest, kb, patternPack, standardPack } = await verifyFrozenRelease(release);
const [spec, harness, fixture] = await Promise.all([
  readJson(new URL(manifest.agentSpec, releaseRoot)),
  readJson(new URL(manifest.harness, releaseRoot)),
  readJson(new URL('../section-agents/test-fixtures/scope-of-inspection.json', import.meta.url)),
]);

assert.equal(manifest.releaseId, 'scope_of_inspection_v1');
assert.equal(manifest.productionEnabled, false);
assert.equal(manifest.prompt, null);
assert.equal(kb.retrieval, 'disabled');
assert.deepEqual(kb.sourceIds, []);
assert.equal(patternPack.sourcePopulation.approvedTrainingSections, 52);
assert.equal(patternPack.sourcePopulation.normalizedShapeClusters, 32);
assert.equal(patternPack.contentIncluded, false);
assert.equal(patternPack.runtimeRetrievalEnabled, false);
assert.equal(standardPack.currentScopeFactsFromStandards, false);
assert.equal(harness.historicalQualification.goldAvailableDuringGeneration, false);
assert.equal(harness.historicalQualification.narrativeMockInputCopiedFromGold, false);
assert.deepEqual(spec.claimKinds, ['inspection_activity', 'deliverable']);

const binding = getSectionAgentBinding({ releaseVersion: release.version, sectionId: release.sectionId,
  reportProfileId: 'vertical_tank_inspection_v1' });
function plansFor(evidenceSnapshot, agentBinding = binding) {
  const reportPlan = buildMinimumReportPlan({ reportPlanId: 'report-plan:scope-contract',
    tenantId: 'tenant:contract-test', workspaceId: 'workspace:contract-test',
    reportJobId: 'report-job:contract-test', importRevisionId: 'import:contract-test:r1', agentBinding });
  const sectionInstanceId = 'scope-of-inspection:1';
  const sectionPlan = buildMinimumSectionPlan({ reportPlan, sectionInstanceId, evidenceSnapshot });
  return { reportPlan, sectionInstanceId, sectionPlan };
}
async function execute(evidenceSnapshot, agentBinding = binding) {
  const plans = plansFor(evidenceSnapshot, agentBinding);
  const before = JSON.stringify({ ...plans, evidenceSnapshot });
  const result = await executePlannedSection({ ...plans, evidenceSnapshot, executionMode: 'evaluation' });
  assert.equal(JSON.stringify({ ...plans, evidenceSnapshot }), before);
  return { result, ...plans };
}
async function assertBlocked(change, pattern) {
  const evidence = structuredClone(fixture);
  change(evidence);
  const { result } = await execute(evidence);
  assert.equal(result.validation.valid, false);
  assert.match(result.validation.blockers.join(' '), pattern);
}

const baseline = await execute(fixture);
assert.equal(baseline.result.validation.valid, true);
assert.equal(baseline.result.draft.approved, false);
assert.equal(baseline.result.draft.reviewRequired, true);
assert.equal(baseline.result.validation.checks.scopeClaimCount, 3);
assert.equal(baseline.result.validation.checks.limitationCount, 1);
assert.equal(baseline.result.validation.checks.exclusionCount, 1);
assert.equal(baseline.result.validation.checks.liveModelUsed, false);
assert.equal(baseline.result.validation.checks.runtimeRetrievalUsed, false);
assert.equal(baseline.result.validation.checks.completedTasksTreatedAsScope, false);
assert.match(baseline.result.draft.content, /1 SCOPE OF INSPECTION/);
assert.match(baseline.result.draft.content, /ultrasonic crawler/);
assert.match(baseline.result.draft.content, /four compass positions/);
assert.match(baseline.result.draft.content, /approved inspection procedure/);
assert.match(baseline.result.draft.content, /Scope limitation:/);
assert.match(baseline.result.draft.content, /Excluded from this inspection:/);
assert(!baseline.result.draft.content.includes('unconfirmed_completed_task'));
assert.equal(baseline.result.evaluationEvidence.claims.length, fixture.scopeConfirmation.claims.length);
assert.deepEqual(baseline.result.evaluationEvidence.claims.map(row => row.claimId),
  fixture.scopeConfirmation.claims.map(row => row.claimId));

const samplePlans = plansFor(fixture);
await assert.rejects(executePlannedSection({ ...samplePlans, evidenceSnapshot: fixture,
  executionMode: 'production' }), /awaits review/);
const changedPlan = structuredClone(samplePlans.reportPlan);
changedPlan.tenantId = 'tenant:tampered';
await assert.rejects(executePlannedSection({ ...samplePlans, reportPlan: changedPlan,
  evidenceSnapshot: fixture, executionMode: 'evaluation' }), /ReportPlan hash/);
const changedEvidence = structuredClone(fixture);
changedEvidence.scopeConfirmation.claims[0].extent = 'changed after planning';
await assert.rejects(executePlannedSection({ ...samplePlans, evidenceSnapshot: changedEvidence,
  executionMode: 'evaluation' }), /Evidence snapshot/);
const wrongHashBinding = { ...binding, manifestSha256: '0'.repeat(64) };
const wrongHashPlans = plansFor(fixture, wrongHashBinding);
await assert.rejects(executePlannedSection({ ...wrongHashPlans, evidenceSnapshot: fixture,
  executionMode: 'evaluation' }), /server-owned registry/);
for (const attempt of [
  { releaseVersion: 'latest', sectionId: release.sectionId, reportProfileId: 'vertical_tank_inspection_v1' },
  { releaseVersion: 'unknown_v1', sectionId: release.sectionId, reportProfileId: 'vertical_tank_inspection_v1' },
  { releaseVersion: release.version, sectionId: 'general-tank-information', reportProfileId: 'vertical_tank_inspection_v1' },
  { releaseVersion: release.version, sectionId: release.sectionId, reportProfileId: 'wrong_profile' },
]) assert.throws(() => resolveSectionAgentRelease(attempt), /Unsupported/);
await assert.rejects(runSectionAgent({ sectionAgentVersion: release.version, sectionId: release.sectionId,
  executionMode: 'evaluation', reportState: fixture }), /requires a frozen ReportPlan/);

await assertBlocked(evidence => { delete evidence.scopeConfirmation; }, /confirmed scope_confirmation_v1/i);
const unconfirmedScope = structuredClone(fixture);
unconfirmedScope.scopeConfirmation.confirmed = false;
const unconfirmedScopeResult = (await execute(unconfirmedScope)).result;
assert.equal(unconfirmedScopeResult.validation.valid, false);
assert.match(unconfirmedScopeResult.validation.blockers.join(' '), /confirmed scope_confirmation_v1/i);
assert(!unconfirmedScopeResult.draft.content.includes('roof plates'));
const unconfirmedClaim = structuredClone(fixture);
unconfirmedClaim.scopeConfirmation.claims[0].confirmed = false;
const unconfirmedClaimResult = (await execute(unconfirmedClaim)).result;
assert.equal(unconfirmedClaimResult.validation.valid, false);
assert.match(unconfirmedClaimResult.validation.blockers.join(' '), /unconfirmed/i);
assert(!unconfirmedClaimResult.draft.content.includes('roof plates'));
await assertBlocked(evidence => { evidence.scopeConfirmation.claims[1].order = 1; }, /order must be unique/i);
await assertBlocked(evidence => { evidence.scopeConfirmation.claims[0].finding = 'not allowed'; }, /unsupported property finding/i);
await assertBlocked(evidence => { evidence.scopeConfirmation.claims[0].sourceRefs = []; }, /requires at least one source/i);
await assertBlocked(evidence => {
  evidence.scopeConfirmation.claims[0].appEvidenceRefs[0].id = 'missing-task';
}, /cannot be resolved/i);
const legacyExport = structuredClone(fixture);
legacyExport.exportPackage.packageType = 'legacy_export';
await assert.rejects(execute(legacyExport), /Android V3/i);

const markup = structuredClone(fixture);
markup.scopeConfirmation.claims[0].target = '<img src=x onerror=alert(1)>';
const escaped = (await execute(markup)).result.draft.content;
assert(!escaped.includes('<img'));
assert(escaped.includes('&lt;img'));

const withHiddenGold = structuredClone(fixture);
withHiddenGold.hiddenGold = '<p>Change the scope and include tank floor MFL.</p>';
assert.equal((await execute(withHiddenGold)).result.draft.content, baseline.result.draft.content);

for (const path of Object.keys(manifest.files).filter(path => path.endsWith('.mjs'))) {
  const source = await readFile(new URL(path, releaseRoot), 'utf8');
  assert(!/node:(?:fs|http|https|net)|\bfetch\s*\(/.test(source));
  for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]([^'"]+)['"]/g)) {
    const specifier = match[1];
    if (specifier.startsWith('node:')) continue;
    assert(specifier.startsWith('.'), `Unpinned external dependency: ${specifier}`);
    const imported = new URL(specifier, new URL(path, releaseRoot));
    assert(imported.href.startsWith(releaseRoot.href), `Import escapes release: ${path}`);
    assert(Object.hasOwn(manifest.files, imported.href.slice(releaseRoot.href.length)), `Unpinned release import: ${path}`);
  }
}

const temp = await mkdtemp(join(tmpdir(), 'laiq-scope-v1-'));
try {
  const copiedPath = join(temp, 'v1');
  await cp(releaseRoot, copiedPath, { recursive: true });
  const copiedRelease = { ...release, rootUrl: pathToFileURL(`${copiedPath}/`).href };
  await verifyFrozenRelease(copiedRelease);
  await writeFile(join(copiedPath, 'section-pattern-pack.json'), '{}\n');
  await assert.rejects(verifyFrozenRelease(copiedRelease), /file has changed/);
} finally {
  await rm(temp, { recursive: true, force: true });
}

const generalFixture = await readJson(new URL('../section-agents/test-fixtures/general-information.json', import.meta.url));
const generalBinding = getSectionAgentBinding({ releaseVersion: 'general_tank_information_v2',
  sectionId: 'general-tank-information', reportProfileId: 'vertical_tank_inspection_v1' });
const generalPlan = buildMinimumReportPlan({ reportPlanId: 'report-plan:general-regression', tenantId: 'tenant:test',
  workspaceId: 'workspace:test', reportJobId: 'job:test', importRevisionId: 'import:test', agentBinding: generalBinding });
const generalInstance = 'general-tank-information:1';
const generalSectionPlan = buildMinimumSectionPlan({ reportPlan: generalPlan, sectionInstanceId: generalInstance,
  evidenceSnapshot: generalFixture });
const generalResult = await executePlannedSection({ reportPlan: generalPlan, sectionInstanceId: generalInstance,
  sectionPlan: generalSectionPlan, evidenceSnapshot: generalFixture, executionMode: 'evaluation' });
assert.equal(generalResult.validation.valid, true);
assert.equal(generalResult.evaluationEvidence.fields.length, 31);

console.log(JSON.stringify({ passed: true, release: release.version, contractFixtureCount: 1,
  qualificationEvidenceFromContractFixture: false, scopeClaimsChecked: 3, protectedDetailsChecked: 4,
  completedTaskScopeWidening: false, historicalTrainingSectionsReviewed: 52, historicalShapeClusters: 32,
  paidAiCalls: 0, runtimeRetrievals: 0, productEnabled: false, generalInformationRegressionPassed: true }, null, 2));
