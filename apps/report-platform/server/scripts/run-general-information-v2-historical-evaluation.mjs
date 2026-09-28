#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildMinimumReportPlan, buildMinimumSectionPlan } from '../report-plans/minimum-report-plan.mjs';
import { executePlannedSection, getSectionAgentBinding, SECTION_AGENT_RELEASES } from '../section-agents/generator-registry.mjs';
import { FIELD_DEFINITIONS } from '../section-agents/releases/general-tank-information/generator/v2/server/agent.mjs';
import { reportNodeText } from '../section-agents/releases/general-tank-information/generator/v2/server/report-document.mjs';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const valueAfter = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
const split = valueAfter('--split');
if (!['development', 'held_out'].includes(split)) throw new Error('--split development|held_out is required');
const sourceRoot = pathToFileURL(`${resolve(valueAfter('--source-root') ?? `${appRoot}/docs/reviews/data/general-tank-information-v1`)}/`);
const outputRootPath = resolve(valueAfter('--output-root') ?? `${appRoot}/docs/reviews/data/general-tank-information-v2-historical`);
const outputRoot = pathToFileURL(`${outputRootPath}/`);
await mkdir(outputRootPath, { recursive: true });

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async (root, name) => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const bytes = async (root, name) => readFile(new URL(name, root));
const escape = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const scriptPaths = {
  preparation: `${appRoot}/server/scripts/prepare-general-information-v2-historical.py`,
  evaluation: fileURLToPath(import.meta.url),
  releaseManifest: `${appRoot}/server/section-agents/releases/general-tank-information/generator/v2/manifest.json`,
};
const fileSha = async path => sha256(await readFile(path));
const writeNewJson = async (name, value) => writeFile(new URL(name, outputRoot), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });

const cohortBytes = await bytes(sourceRoot, 'cohort.json');
const cohort = JSON.parse(cohortBytes);
assert.equal(cohort.contractVersion, 'general_information_cohort_v1');
assert.equal(new Set(cohort.cases.map(row => row.sourceSha256)).size, 11);
assert.equal(new Set(cohort.cases.map(row => row.registryLineage)).size, 11);
assert.equal(cohort.cases.filter(row => row.split === 'development').length, 10);
assert.equal(cohort.cases.filter(row => row.split === 'held_out').length, 1);

const release = SECTION_AGENT_RELEASES.general_tank_information_v2;
const currentPins = {
  releaseManifestSha256: await fileSha(scriptPaths.releaseManifest),
  cohortSha256: sha256(cohortBytes),
  preparationScriptSha256: await fileSha(scriptPaths.preparation),
  evaluationScriptSha256: await fileSha(scriptPaths.evaluation),
};
assert.equal(currentPins.releaseManifestSha256, release.manifestSha256);

if (split === 'held_out') {
  const freeze = await json(outputRoot, 'development-freeze.json');
  for (const [key, value] of Object.entries(currentPins)) assert.equal(freeze[key], value, `${key} changed after development freeze`);
  assert.equal(freeze.developmentResultsSha256, sha256(await bytes(outputRoot, 'development-results.json')));
  assert.equal(freeze.heldOutContentOpened, false);
}

const preparation = await json(outputRoot, `${split}-preparation.json`);
assert.equal(preparation.split, split);
assert.equal(preparation.originalSectionAvailableToGenerator, false);
const selected = cohort.cases.filter(row => row.split === split);
assert.equal(selected.length, split === 'development' ? 10 : 1);
const binding = getSectionAgentBinding({ releaseVersion: release.version, sectionId: release.sectionId,
  reportProfileId: 'vertical_tank_inspection_v1' });
const cases = [];

for (const row of selected) {
  const pin = preparation.cases.find(item => item.caseId === row.caseId);
  assert(pin, `${row.caseId}: missing preparation pin`);
  const inputBytes = await bytes(outputRoot, `inputs/${row.caseId}.json`);
  assert.equal(sha256(inputBytes), pin.inputSha256);
  const evidenceSnapshot = JSON.parse(inputBytes);
  const reportPlan = buildMinimumReportPlan({
    reportPlanId: `historical-evaluation:${row.caseId}`,
    tenantId: 'tenant:private-historical-evaluation',
    workspaceId: 'workspace:private-historical-evaluation',
    reportJobId: `report-job:${row.caseId}`,
    importRevisionId: `historical-mock:${row.caseId}:r1`,
    agentBinding: binding,
  });
  const sectionInstanceId = 'general-tank-information:1';
  const sectionPlan = buildMinimumSectionPlan({ reportPlan, sectionInstanceId, evidenceSnapshot });
  const inputBefore = JSON.stringify(evidenceSnapshot);
  // The original report page and expected ledger have not been opened at this point.
  const generated = await executePlannedSection({ reportPlan, sectionInstanceId, sectionPlan,
    evidenceSnapshot, executionMode: 'evaluation' });
  assert.equal(JSON.stringify(evidenceSnapshot), inputBefore);

  // Evaluator-only material opens after generation.
  const expectedBytes = await bytes(outputRoot, `evaluator-only/${row.caseId}-expected.json`);
  assert.equal(sha256(expectedBytes), pin.expectedSha256);
  const expected = JSON.parse(expectedBytes);
  const source = await json(outputRoot, `evaluator-only/${row.caseId}-source.json`);
  assert.equal(expected.sourceSha256, row.sourceSha256);
  assert.equal(source.sourceSha256, row.sourceSha256);
  assert.equal(expected.fields.length, 31);

  const paragraphs = [];
  const walk = node => {
    if (node.tag === 'p' && node.attrs?.['data-evidence-id']) paragraphs.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  generated.draft.document.blocks.forEach(walk);
  const fieldChecks = expected.fields.map((field, index) => {
    const actual = generated.evaluationEvidence.fields.find(item => item.key === field.fieldKey);
    const nodes = paragraphs.filter(node => node.attrs['data-evidence-id'] === `general-info:${field.fieldKey}`);
    const expectedDisplay = `${field.expectedValue}${field.expectedUnit ? ` ${field.expectedUnit}` : ''}`;
    const renderedText = nodes[0] ? reportNodeText(nodes[0]) : '';
    const passed = Boolean(actual) && nodes.length === 1 && actual.value === field.expectedValue
      && actual.unit === field.expectedUnit && actual.displayValue === expectedDisplay
      && renderedText === `➢ ${actual.label}: ${expectedDisplay}`;
    return { fieldKey: field.fieldKey, inputChannel: field.inputChannel, expectedDisplay,
      generatedDisplay: actual?.displayValue ?? null, position: index + 1, passed };
  });
  const structuralChecks = {
    exactTitle: generated.section.title === '3 GENERAL TANK INFORMATION'
      && generated.draft.content.includes('<h2>3 GENERAL TANK INFORMATION</h2>'),
    pairedFieldTables: (generated.draft.content.match(/data-report-format="paired-fields"/g) ?? []).length === 2,
    exactFieldCount: paragraphs.length === 31,
    fixedFieldOrder: JSON.stringify(generated.evaluationEvidence.fields.map(field => field.key))
      === JSON.stringify(FIELD_DEFINITIONS.map(field => field.key)),
    unapprovedDraft: generated.draft.approved === false && generated.draft.reviewRequired === true,
    noRuntimeAiOrRetrieval: generated.validation.checks.liveModelUsed === false
      && generated.validation.checks.runtimeRetrievalUsed === false,
  };
  const passed = Object.values(structuralChecks).every(Boolean) && generated.validation.blockers.length === 0
    && fieldChecks.every(check => check.passed);
  cases.push({ caseId: row.caseId, split, registryLineage: row.registryLineage, sourceSha256: row.sourceSha256,
    sourcePage: expected.page, inputSha256: pin.inputSha256, expectedSha256: pin.expectedSha256,
    reportPlanSha256: reportPlan.reportPlanSha256, sectionPlanSha256: sectionPlan.sectionPlanSha256,
    originalSectionContent: source.text, processedEvidence: generated.evaluationEvidence.fields.map(field => ({
      fieldKey: field.key, value: field.value, unit: field.unit, state: field.state,
      sourceClass: field.sourceClass, sourcePointer: field.sourcePointer,
    })), generatedSectionContent: generated.draft.content, fieldChecks, structuralChecks,
    fieldCount: fieldChecks.length, preservedFieldCount: fieldChecks.filter(check => check.passed).length,
    blockers: generated.validation.blockers, passed });
}

const result = {
  contractVersion: 'general_information_v2_historical_evaluation_v1',
  release: release.version,
  manifestSha256: release.manifestSha256,
  split,
  sourceDerived: true,
  actualDeviceExport: false,
  originalSectionAvailableToGenerator: false,
  paidAiCalls: 0,
  runtimeRetrievals: 0,
  promotionPerformed: false,
  cases,
  summary: {
    reports: cases.length,
    passed: cases.filter(row => row.passed).length,
    fields: cases.reduce((total, row) => total + row.fieldCount, 0),
    preservedFields: cases.reduce((total, row) => total + row.preservedFieldCount, 0),
    formatAligned: cases.filter(row => Object.values(row.structuralChecks).every(Boolean)).length,
  },
};
await writeNewJson(`${split}-results.json`, result);

const cards = cases.map(row => `<article><header><strong>${escape(row.caseId)}</strong><span>${row.passed ? 'PASS' : 'FAIL'}</span></header><div class="grid"><section><h2>Original historical section</h2><pre>${escape(row.originalSectionContent)}</pre></section><section><h2>Processed app-style evidence</h2><table><thead><tr><th>Field</th><th>Value</th><th>Source</th></tr></thead><tbody>${row.processedEvidence.map(field => `<tr><td>${escape(field.fieldKey)}</td><td>${escape(field.value)}${field.unit ? ` ${escape(field.unit)}` : ''}</td><td>${escape(field.sourceClass)}</td></tr>`).join('')}</tbody></table></section><section><h2>V2 generated section</h2><div class="generated">${row.generatedSectionContent}</div></section></div></article>`).join('');
const html = `<!doctype html><html><head><meta charset="utf-8"><title>General Tank Information V2 ${escape(split)}</title><style>body{font:14px system-ui;margin:0;background:#eef3f7;color:#18324b}main{padding:20px}article{background:white;border:1px solid #b9c7d4;margin:0 0 24px}header{display:flex;justify-content:space-between;padding:12px 16px;background:#163d5b;color:white}.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:#b9c7d4}.grid>section{background:white;padding:14px;overflow:auto}h2{font-size:16px;color:#087da6}pre{white-space:pre-wrap;font:12px/1.45 ui-monospace,monospace}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ccd7e0;padding:5px;text-align:left}.generated table{font-size:12px}.generated p{margin:4px 0}@media(max-width:1100px){.grid{grid-template-columns:1fr}}</style></head><body><main><h1>General Tank Information V2 — ${escape(split)}</h1><p>Original report is evaluator-only and was opened after generation. Product promotion: no.</p>${cards}</main></body></html>`;
await writeFile(new URL(`${split}-comparison.html`, outputRoot), html, { flag: 'wx' });

if (split === 'development') {
  assert.equal(result.summary.passed, 10);
  assert.equal(result.summary.fields, 310);
  assert.equal(result.summary.preservedFields, 310);
  await writeNewJson('development-freeze.json', {
    contractVersion: 'general_information_v2_development_freeze_v1',
    ...currentPins,
    developmentResultsSha256: sha256(await bytes(outputRoot, 'development-results.json')),
    developmentDecision: 'no_release_change_required',
    reason: 'All 310 historical development fields and required structure passed through the V2 ReportPlan route.',
    heldOutContentOpened: false,
    productEnabled: false,
  });
} else {
  assert.equal(result.summary.passed, 1);
  assert.equal(result.summary.fields, 31);
  assert.equal(result.summary.preservedFields, 31);
  const development = await json(outputRoot, 'development-results.json');
  await writeNewJson('final-summary.json', {
    contractVersion: 'general_information_v2_historical_qualification_v1',
    release: release.version,
    manifestSha256: release.manifestSha256,
    development: development.summary,
    heldOut: result.summary,
    totalReports: development.summary.reports + result.summary.reports,
    totalFields: development.summary.fields + result.summary.fields,
    totalPreservedFields: development.summary.preservedFields + result.summary.preservedFields,
    historicalFieldAccuracy: 1,
    formatAlignmentRate: 1,
    originalSectionAvailableToGenerator: false,
    paidAiCalls: 0,
    runtimeRetrievals: 0,
    independentInspectorReview: false,
    actualDeviceExport: false,
    promotionPerformed: false,
  });
}

console.log(JSON.stringify({ split, release: release.version, ...result.summary,
  originalSectionAvailableToGenerator: false, paidAiCalls: 0, runtimeRetrievals: 0,
  promotionPerformed: false }, null, 2));
if (result.summary.passed !== result.summary.reports) process.exitCode = 1;
