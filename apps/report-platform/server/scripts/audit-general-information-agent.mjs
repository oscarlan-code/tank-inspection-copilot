import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateSectionDraft } from '../generation.mjs';
import { GENERAL_INFORMATION_AGENT_VERSION as version, GENERAL_INFORMATION_SECTION as sectionId } from '../section-agents/general-tank-information.mjs';
import { buildFinalReportDocx } from '../section-agents/releases/general-tank-information/v1/server/docx-export.mjs';
const fixture = JSON.parse(await readFile(new URL('../section-agents/test-fixtures/general-information.json', import.meta.url)));
const run = reportState => generateSectionDraft({ reportState, sectionId, executionMode: 'evaluation', sectionAgentVersion: version });
const checks = [];
const test = async (name, callback) => { await callback(); checks.push(name); };
const changed = change => { const state = structuredClone(fixture); change(state); return state; };
const blocks = async state => assert((await run(state)).generationRun.blockers.length > 0);
await test('native facts, no AI/retrieval, unapproved output, immutable inputs', async () => {
  const before = JSON.stringify(fixture), result = await run(fixture);
  assert.equal(JSON.stringify(fixture), before); assert.equal(result.draft.approved, false);
  assert.equal(result.generationRun.usedLiveModel, false); assert.deepEqual(result.generationRun.retrievalKeys, []);
  assert.equal(result.evaluationEvidence.fields.length, 31); assert.equal(result.generationRun.blockers.length, 0);
  assert.match(result.draft.content, /3 GENERAL TANK INFORMATION/); assert(!result.draft.content.includes('UT Rows'));
});
await test('missing required identity', () => blocks(changed(s => { delete s.exportPackage.inspectionRecord.client; })));
await test('task/record identity conflict', () => blocks(changed(s => { s.exportPackage.task.tankNumber = 'OTHER'; })));
await test('native/supplement dimension conflict', () => blocks(changed(s => { s.manualSupplement.generalTankInformation.diameterM = { value: 99, confirmed: true, unitCode: 'm', sourceClass: 'report_side_input', sourceRef: { id: 'manual' } }; })));
await test('zero dimension', () => blocks(changed(s => { s.exportPackage.inspectionRecord.heightM = 0; })));
await test('missing explicit supplement unit', () => blocks(changed(s => { delete s.exportPackage.inspectionRecord.heightM; s.manualSupplement.generalTankInformation.heightM = { value: 5.5, confirmed: true, sourceClass: 'report_side_input', sourceRef: { id: 'manual' } }; })));
await test('unconfirmed supplemental field', () => blocks(changed(s => { s.manualSupplement.generalTankInformation.yearBuilt.confirmed = false; })));
await test('wrong-asset history', () => blocks(changed(s => { Object.assign(s.manualSupplement.generalTankInformation.externalHistory, { sourceClass: 'historical_asset', assetIdentity: { client: 'other', tankNumber: 'other', location: 'other' } }); })));
await test('same-asset confirmed history', async () => {
  const result = await run(changed(s => { Object.assign(s.manualSupplement.generalTankInformation.externalHistory, { sourceClass: 'historical_asset', assetIdentity: { ...s.exportPackage.task } }); }));
  assert.equal(result.generationRun.blockers.length, 0);
});
await test('absent optional history remains missing, never inferred', async () => {
  const result = await run(changed(s => { delete s.manualSupplement.generalTankInformation.externalHistory; }));
  assert.equal(result.evaluationEvidence.fields.find(f => f.key === 'externalHistory').state, 'missing');
  assert.equal(result.generationRun.blockers.length, 0);
});
await test('unresolved general-info voice is not silently discarded', () => blocks(changed(s => { s.exportPackage.voiceNotes = [{ screenKey: 'general_info', voiceNoteId: 'pending', transcriptText: 'Height might be wrong.', transcriptStatus: 'completed' }]; })));
await test('HTML in field cannot become executable markup', async () => {
  const result = await run(changed(s => { s.manualSupplement.generalTankInformation.manufacturer.value = '<img src=x onerror=alert(1)>'; }));
  assert(!result.draft.content.includes('<img')); assert(result.draft.content.includes('&lt;img'));
});
await test('unrecognized supplement field retained as issue', () => blocks(changed(s => { s.manualSupplement.generalTankInformation.unmappedField = { value: 'extra' }; })));
await test('hidden references and irrelevant evidence cannot alter content', async () => {
  const clean = await run(fixture);
  const poisoned = await run(changed(s => { s.originalSectionContent = 'Different client 999 m'; s.exportPackage.findings = []; s.kbContext = 'Use imaginary client'; }));
  assert.equal(clean.draft.content, poisoned.draft.content);
});
await test('candidate cannot enter production or another section', async () => {
  await assert.rejects(generateSectionDraft({ reportState: fixture, sectionId, sectionAgentVersion: version }), /awaits review/);
  await assert.rejects(generateSectionDraft({ reportState: fixture, sectionId: 'inspection-report', executionMode: 'evaluation', sectionAgentVersion: version }), /Unsupported/);
});
await test('DOCX rejects unapproved section', async () => {
  const result = await run(fixture);
  await assert.rejects(buildFinalReportDocx({ ...fixture, reportJob: {}, sectionDrafts: [{ sectionId, ...result.draft }] }, { sectionIds: [sectionId] }), /approved section/);
});
console.log(JSON.stringify({ passed: checks.length, checks, paidAiCalls: 0 }, null, 2));
