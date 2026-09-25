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

const release = SECTION_AGENT_RELEASES.general_tank_information_v2;
const releaseRoot = new URL('../section-agents/releases/general-tank-information/v2/', import.meta.url);
const readJson = async url => JSON.parse(await readFile(url, 'utf8'));
const { manifest } = await verifyFrozenRelease(release);
const [spec, harness, standardPack, fixture] = await Promise.all([
  readJson(new URL(manifest.agentSpec, releaseRoot)),
  readJson(new URL(manifest.harness, releaseRoot)),
  readJson(new URL(manifest.standardObligationPack, releaseRoot)),
  readJson(new URL('../section-agents/test-fixtures/general-information.json', import.meta.url)),
]);

assert.equal(manifest.releaseId, 'general_tank_information_v2');
assert.equal(manifest.productionEnabled, false);
assert.equal(manifest.prompt, null);
assert.equal(spec.fieldOrder.length, 31);
assert.equal(harness.contractChecks.fixtureCount, 1);
assert.equal(harness.contractChecks.qualificationEvidence, false);
assert.equal(harness.historicalQualification.developmentReports, 10);
assert.equal(harness.historicalQualification.heldOutReports, 1);
assert.equal(harness.historicalQualification.goldAvailableDuringGeneration, false);
assert.equal(standardPack.status, 'reviewed_not_applicable');
assert.deepEqual(standardPack.obligations, []);

const binding = getSectionAgentBinding({ releaseVersion: release.version, sectionId: release.sectionId,
  reportProfileId: 'vertical_tank_inspection_v1' });
function plansFor(evidenceSnapshot, agentBinding = binding) {
  const reportPlan = buildMinimumReportPlan({ reportPlanId: 'report-plan:general-info-contract',
    tenantId: 'tenant:contract-test', workspaceId: 'workspace:contract-test',
    reportJobId: 'report-job:contract-test', importRevisionId: 'import:contract-test:r1', agentBinding });
  const sectionInstanceId = 'general-tank-information:1';
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

const baseline = await execute(fixture);
const fields = baseline.result.evaluationEvidence.fields;
assert.deepEqual(fields.map(field => field.key), spec.fieldOrder);
assert.equal(fields.length, 31);
assert.equal(baseline.result.draft.approved, false);
assert.equal(baseline.result.draft.reviewRequired, true);
assert.equal(baseline.result.validation.valid, true);
assert.equal(baseline.result.validation.checks.liveModelUsed, false);
assert.equal(baseline.result.validation.checks.runtimeRetrievalUsed, false);
assert.equal(baseline.result.validation.checks.currentFactsFromHistoricalSources, false);
assert.match(baseline.result.draft.content, /3 GENERAL TANK INFORMATION/);
let sourceValuesChecked = 0;
for (const key of ['client', 'tankNumber', 'location', 'fieldLeaseName', 'heightM', 'diameterM', 'shellCourseCount']) {
  assert.equal(fields.find(field => field.key === key).value, fixture.exportPackage.inspectionRecord[key]);
  sourceValuesChecked++;
}
for (const [key, record] of Object.entries(fixture.manualSupplement.generalTankInformation)) {
  assert.equal(fields.find(field => field.key === key).value, record.value);
  sourceValuesChecked++;
}
assert.equal(sourceValuesChecked, 31);

const samplePlans = plansFor(fixture);
await assert.rejects(executePlannedSection({ ...samplePlans, evidenceSnapshot: fixture,
  executionMode: 'production' }), /awaits review/);
const changedPlan = structuredClone(samplePlans.reportPlan);
changedPlan.tenantId = 'tenant:tampered';
await assert.rejects(executePlannedSection({ ...samplePlans, reportPlan: changedPlan,
  evidenceSnapshot: fixture, executionMode: 'evaluation' }), /ReportPlan hash/);
const changedEvidence = structuredClone(fixture);
changedEvidence.exportPackage.inspectionRecord.client = 'Changed after planning';
await assert.rejects(executePlannedSection({ ...samplePlans, evidenceSnapshot: changedEvidence,
  executionMode: 'evaluation' }), /Evidence snapshot/);
const wrongHashBinding = { ...binding, manifestSha256: '0'.repeat(64) };
const wrongHashPlans = plansFor(fixture, wrongHashBinding);
await assert.rejects(executePlannedSection({ ...wrongHashPlans, evidenceSnapshot: fixture,
  executionMode: 'evaluation' }), /server-owned registry/);
for (const attempt of [
  { releaseVersion: 'latest', sectionId: release.sectionId, reportProfileId: 'vertical_tank_inspection_v1' },
  { releaseVersion: 'unknown_v1', sectionId: release.sectionId, reportProfileId: 'vertical_tank_inspection_v1' },
  { releaseVersion: release.version, sectionId: 'scope-of-inspection', reportProfileId: 'vertical_tank_inspection_v1' },
  { releaseVersion: release.version, sectionId: release.sectionId, reportProfileId: 'wrong_profile' },
]) assert.throws(() => resolveSectionAgentRelease(attempt), /Unsupported/);
await assert.rejects(runSectionAgent({ sectionAgentVersion: release.version, sectionId: release.sectionId,
  executionMode: 'evaluation', reportState: fixture }), /requires a frozen ReportPlan/);

async function assertBlocked(change, pattern) {
  const evidence = structuredClone(fixture);
  change(evidence);
  const { result } = await execute(evidence);
  assert.equal(result.validation.valid, false);
  assert.match(result.validation.blockers.join(' '), pattern);
}
await assertBlocked(evidence => { delete evidence.exportPackage.inspectionRecord.client; delete evidence.exportPackage.task.client; }, /client is not established/i);
await assertBlocked(evidence => { evidence.exportPackage.task.tankNumber = 'OTHER'; }, /disagree/i);
await assertBlocked(evidence => { evidence.manualSupplement.generalTankInformation.yearBuilt.confirmed = false; }, /requires confirmation/i);
await assertBlocked(evidence => {
  evidence.manualSupplement.generalTankInformation.externalHistory = { value: 'Prior inspection', confirmed: true,
    sourceClass: 'historical_asset', sourceRef: { kind: 'contract_test', recordId: 'wrong-history' },
    assetIdentity: { client: 'Other', tankNumber: 'OTHER', location: 'Other' } };
}, /does not match/i);
await assertBlocked(evidence => { evidence.exportPackage.voiceNotes.push({ screenKey: 'general_info',
  voiceNoteId: 'pending', transcriptText: 'Please confirm the nameplate.' }); }, /field-level confirmation/i);

const markup = structuredClone(fixture);
markup.manualSupplement.generalTankInformation.manufacturer.value = '<img src=x onerror=alert(1)>';
const escaped = (await execute(markup)).result.draft.content;
assert(!escaped.includes('<img'));
assert(escaped.includes('&lt;img'));

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

const temp = await mkdtemp(join(tmpdir(), 'laiq-general-info-v2-'));
try {
  const copiedPath = join(temp, 'v2');
  await cp(releaseRoot, copiedPath, { recursive: true });
  const copiedRelease = { ...release, rootUrl: pathToFileURL(`${copiedPath}/`).href };
  await verifyFrozenRelease(copiedRelease);
  await writeFile(join(copiedPath, 'kb-policy.json'), '{}\n');
  await assert.rejects(verifyFrozenRelease(copiedRelease), /file has changed/);
} finally {
  await rm(temp, { recursive: true, force: true });
}

const v1 = await runSectionAgent({ sectionAgentVersion: 'general_tank_information_v1',
  sectionId: 'general-tank-information', executionMode: 'evaluation', reportState: fixture });
assert.equal(v1.draft.approved, false);
assert.equal(v1.evaluationEvidence.fields.length, 31);

console.log(JSON.stringify({ passed: true, release: release.version, contractFixtureCount: 1,
  qualificationEvidenceFromContractFixture: false, fieldPositionsChecked: 31, sourceValuesChecked,
  paidAiCalls: 0, runtimeRetrievals: 0, productEnabled: false, v1RegressionPassed: true }, null, 2));
