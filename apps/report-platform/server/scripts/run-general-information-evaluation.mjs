import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { generateSectionDraft } from '../generation.mjs';
import { GENERAL_INFORMATION_AGENT_VERSION as version, GENERAL_INFORMATION_SECTION as sectionId } from '../section-agents/general-tank-information.mjs';
import { reportNodeText } from '../report-document.mjs';
import { buildFinalReportDocx } from '../docx-export.mjs';

const root = new URL('../../docs/reviews/data/general-tank-information-v1/', import.meta.url);
const args = process.argv.slice(2);
const split = args[args.indexOf('--split') + 1];
if (!args.includes('--split') || !['development', 'held_out'].includes(split)) throw new Error('--split development|held_out is required');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async name => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const cohort = await json('cohort.json');
const preparation = await json(`${split}-preparation.json`);
const codeFiles = ['server/section-agents/general-tank-information.mjs', 'server/section-agents/index.mjs', 'server/generation.mjs', 'server/section-planner.mjs', 'server/section-contracts.mjs', 'server/report-document.mjs', 'server/docx-export.mjs', 'server/scripts/prepare-general-information-mocks.py', 'server/scripts/run-general-information-evaluation.mjs'];
const codeHashes = Object.fromEntries(await Promise.all(codeFiles.map(async name => [name, digest(await readFile(new URL(`../../${name}`, import.meta.url)))])));
if (split === 'held_out') {
  const freeze = await json('development-freeze.json');
  assert.deepEqual(codeHashes, freeze.codeHashes, 'Frozen module or preparation/evaluator changed before held-out test');
  assert.equal(digest(await readFile(new URL('development-results.json', root))), freeze.developmentResultsSha256);
}
const output = [];
for (const row of cohort.cases.filter(row => row.split === split)) {
  const pin = preparation.cases.find(item => item.caseId === row.caseId);
  const bytes = await readFile(new URL(`inputs/${row.caseId}.json`, root));
  assert.equal(digest(bytes), pin.inputSha256);
  const state = JSON.parse(bytes);
  // Only input JSON is handed to the shared generator. Gold opens afterwards.
  const generated = await generateSectionDraft({ reportState: state, sectionId, executionMode: 'evaluation', sectionAgentVersion: version });
  const expectedBytes = await readFile(new URL(`evaluator-only/${row.caseId}-expected.json`, root));
  assert.equal(digest(expectedBytes), pin.expectedSha256);
  const expected = JSON.parse(expectedBytes);
  const paragraphs = [];
  const walk = node => { if (node.tag === 'p' && node.attrs?.['data-evidence-id']) paragraphs.push(node); (node.children ?? []).forEach(walk); };
  generated.draft.document.blocks.forEach(walk);
  const results = expected.fields.map(field => {
    const actual = generated.evaluationEvidence.fields.find(item => item.key === field.fieldKey);
    const nodes = paragraphs.filter(node => node.attrs['data-evidence-id'] === `general-info:${field.fieldKey}`);
    const labelNode = nodes[0]?.children?.find(node => node.tag === 'strong');
    const expectedValue = `${field.expectedValue}${field.expectedUnit ? ` ${field.expectedUnit}` : ''}`;
    const rendered = nodes[0] ? reportNodeText(nodes[0]).replace(/^➢\s*/, '').slice(`${actual.label}: `.length) : null;
    return { fieldKey: field.fieldKey, sourceDisplay: field.expectedDisplay, generatedDisplay: rendered,
      passed: nodes.length === 1 && reportNodeText(labelNode ?? { text: '' }) === `${actual.label}:` && rendered === expectedValue && actual.value === field.expectedValue && actual.unit === field.expectedUnit,
      inputChannel: field.inputChannel };
  });
  const failures = results.filter(field => !field.passed);
  assert.equal(paragraphs.length, expected.fields.length, 'Unexpected generated fields');
  // Isolated export fixture only; never persists approval or touches a report job.
  const exportState = { ...state, authorizationContext: { actorDisplayName: 'Evaluation render fixture' },
    reportJob: { reportReference: row.caseId, title: 'General information evaluation', inspectedDate: 'Evaluation fixture' },
    sectionDrafts: [{ sectionId, ...generated.draft, approved: true }] };
  const docx = await buildFinalReportDocx(exportState, { sectionIds: [sectionId] });
  await mkdir(new URL('exports/', root), { recursive: true });
  await writeFile(new URL(`exports/${row.caseId}.docx`, root), docx.buffer);
  const source = await json(`evaluator-only/${row.caseId}-source.json`);
  output.push({ ...row, sourcePage: expected.page, inputSha256: pin.inputSha256, expectedSha256: pin.expectedSha256,
    generated, fieldChecks: results, fieldCount: results.length, preservedFieldCount: results.length - failures.length,
    passed: failures.length === 0 && generated.generationRun.blockers.length === 0,
    originalSectionContent: source.text, exportSha256: digest(docx.buffer), inspectorApproved: false });
}
const result = { contractVersion: 'general_information_evaluation_v1', generatorContractVersion: version, split,
  createdAtIso: new Date().toISOString(), sourceDerived: true, actualDeviceExport: false, independentInspectorReview: false,
  paidAiCalls: 0, promotionPerformed: false, codeHashes, cases: output,
  summary: { reports: output.length, passed: output.filter(row => row.passed).length, fields: output.reduce((n, row) => n + row.fieldCount, 0), preservedFields: output.reduce((n, row) => n + row.preservedFieldCount, 0) } };
await writeFile(new URL(`${split}-results.json`, root), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ split, ...result.summary, failures: output.filter(row => !row.passed).map(row => ({ caseId: row.caseId, fields: row.fieldChecks.filter(f => !f.passed), blockers: row.generated.generationRun.blockers })), paidAiCalls: 0 }, null, 2));
if (result.summary.passed !== output.length) process.exitCode = 1;
