import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { buildSectionPlanningSnapshot } from '../section-planner.mjs';
import { generatePlannedSectionDraft, INSPECTION_REPORT_FORMATTER_CONTRACT, PLANNED_GENERATOR_CONTRACT } from '../planned-generation.mjs';
import { parseSectionDocument, renderSectionDocumentHtml } from '../report-document.mjs';
import { corroboratedIdentityFields } from '../experiments/generic-report-presentation.mjs';
import { buildGenericOutlineEvaluationSnapshot } from '../experiments/generic-outline-evaluation.mjs';
import { evaluateSectionPlanOutput } from '../section-plan-evaluation.mjs';

const native = JSON.parse(readFileSync(new URL('../../src/fixtures/v3-product-export-shell-internal.json', import.meta.url)));
native.unitProfile = { thicknessUnit: 'MM' };
const legacy = { exportPackage: native, sectionPlanning: buildSectionPlanningSnapshot({ exportPackage: native }) };
// Baselines captured before adding the opt-in formatter. Presentation changes
// must not alter existing plans, including their evidence and obligation markup.
// The inspection-report baseline reflects the checklist voice routing revision 4.
// Its hash was verified unchanged with and without the shell formatting change.
for (const [sectionId, contentHash] of Object.entries({
  'general-tank-information': '2d73650f0f6d329766ce549c3e32757942acdeafb1ab8e67c06d3a3082d6b180',
  'shell-plate-thickness-measurements': 'f5053bf56b318f6f874e6d70a871cf7ee2caef25445ede8271fbde7efd92686f',
  'tank-inspection-checklist': 'a3d18c4e2eeedc770e9c03a67006f83e9a896d9589fdec770cb19087864791a3',
  'inspection-report': '195533e5ebfac03835c558d6cf7e7821c6d7c98586aa5d37a233bdc88fbd392b',
})) {
  const result = await generatePlannedSectionDraft({ reportState: legacy, sectionId, aiStatus: { configured: false } });
  assert.equal(createHash('sha256').update(result.draft.content).digest('hex'), contentHash, `Legacy output changed: ${sectionId}`);
  assert.equal(result.orchestration.generatorContractVersion, PLANNED_GENERATOR_CONTRACT);
  assert.equal(result.orchestration.formatterContractVersion, undefined);
}

const record = (evidenceId, kind, payload, extra = {}) => ({ evidenceId, kind, payload, displayText: payload.text ?? String(payload.value ?? ''), quality: { issues: [] }, ...extra });
const identity = [
  record('client', 'identity', { fieldKey: 'client', value: 'Audit Client' }),
  record('tank', 'identity', { fieldKey: 'tankNumber', value: 'QA-8' }),
  record('height', 'identity', { fieldKey: 'heightM', value: 12, unitCode: 'm', reportLabel: 'Height' }),
];
const observations = [
  record('shell', 'observation', { text: 'Coating damage was observed on shell plate S1.' }, { presentation: { componentHeading: 'Shell' } }),
  record('floor', 'observation', { text: 'Floor plate F4 was not accessible.' }, { presentation: { componentHeading: 'Floor' } }),
];
function stateFor(sectionId, title, records, slots, uses) {
  const blocks = slots.map(slot => ({ slotKey: slot.slotKey, blockId: `${sectionId}:${slot.slotKey}`, type: 'narrative' }));
  const evidenceUses = uses ?? records.map(entry => ({ evidenceIds: [entry.evidenceId], blockId: blocks[0].blockId, role: entry.kind === 'identity' || entry.kind === 'measurement' ? 'required_structured' : 'required_narrative' }));
  return { sectionPlanning: { snapshotId: 'presentation-audit', evidenceRecords: records, sectionPlans: [{
    sectionId, title: 'Internal generic module name', blocks, evidenceUses,
    outputObligations: evidenceUses.map((use, index) => ({ obligationId: `obligation-${index}`, evidenceIds: use.evidenceIds, targetBlockId: use.blockId })),
    missingRequirements: [], unresolvedEvidence: [],
    catalog: { reportPresentation: { contractVersion: INSPECTION_REPORT_FORMATTER_CONTRACT, number: '3', title }, slots },
  }] } };
}
let modelCalls = 0;
const generate = async state => generatePlannedSectionDraft({ reportState: state, sectionId: state.sectionPlanning.sectionPlans[0].sectionId, aiStatus: { configured: true }, worker: async () => { modelCalls += 1; throw new Error('Formatting must not invoke a model'); } });
const identityState = stateFor('identity', 'GENERAL TANK INFORMATION', identity, [{ slotKey: 'identity', title: 'Asset identity', presentation: { renderer: 'paired_fields', hideHeading: true, fieldLabels: { tankNumber: 'Tank Number' } } }]);
const identityFrozen = JSON.stringify(identityState);
const fields = await generate(identityState);
assert.equal(JSON.stringify(identityState), identityFrozen, 'Presentation must not mutate captured records or the plan');
assert.ok(fields.draft.content.includes('<h2>3 GENERAL TANK INFORMATION</h2>'));
assert.ok(fields.draft.content.includes('data-report-format="paired-fields"'));
assert.ok(fields.draft.content.includes('<strong>Tank Number:</strong> QA-8'));
assert.ok(fields.draft.content.includes('<strong>Height:</strong> 12 m'));
assert.equal((fields.draft.content.match(/<tr>/g) ?? []).length, 2, 'Three captured fields occupy two paired rows');
assert.ok(!/<h3>|<thead>|Internal generic module|Year Built|Field<\/th>/.test(fields.draft.content), 'Internal block labels, grid headers and absent historical fields must not enter the report');
for (const evidenceId of ['client', 'tank', 'height']) assert.ok(fields.draft.content.includes(`data-evidence-id="${evidenceId}"`));
assert.equal(fields.orchestration.formatterContractVersion, INSPECTION_REPORT_FORMATTER_CONTRACT);
assert.equal(fields.generationRun.formatterContractVersion, INSPECTION_REPORT_FORMATTER_CONTRACT);
assert.equal(fields.draft.content, renderSectionDocumentHtml(fields.draft.reportDocument));
const scoreFields = content => evaluateSectionPlanOutput({ sectionPlan: identityState.sectionPlanning.sectionPlans[0], evidenceRecords: identity, generatedContent: content });
assert.equal(scoreFields(fields.draft.content).truthGraphEvaluation.requiredFactRecall, 1, 'Each field in a paired row must be evaluated separately');
assert.equal(scoreFields(fields.draft.content).truthGraphEvaluation.claimPrecision, 1, 'Captured Height must keep its numeric source binding despite its human label');
for (const [description, altered] of [
  ['wrong evidence ID', fields.draft.content.replace('data-evidence-id="height"', 'data-evidence-id="client"')],
  ['wrong obligation ID', fields.draft.content.replace('data-obligation-id="obligation-2"', 'data-obligation-id="obligation-0"')],
  ['wrong label', fields.draft.content.replace('<strong>Height:</strong>', '<strong>Diameter:</strong>')],
  ['wrong value', fields.draft.content.replace('12 m', '14 m')],
  ['wrong unit', fields.draft.content.replace('12 m', '12 mm')],
  ['unbound field', fields.draft.content.replace('data-evidence-id="height"', '')],
  ['missing block binding', fields.draft.content.replace('data-block-id="identity:identity"', '')],
  ['wrong block', fields.draft.content.replace('data-block-id="identity:identity"', 'data-block-id="identity:other"')],
  ['wrong section', fields.draft.content.replace('data-section-id="identity"', 'data-section-id="other"')],
]) assert.ok(scoreFields(altered).truthGraphEvaluation.requiredFactRecall < 1, `Paired fields must reject ${description}`);
const modifiedDisplayState = structuredClone(identityState);
modifiedDisplayState.sectionPlanning.evidenceRecords.find(item => item.evidenceId === 'height').payload.reportValue = 99;
const modifiedDisplayDraft = await generate(modifiedDisplayState);
assert.ok(scoreFields(modifiedDisplayDraft.draft.content).blockerReasons.includes('changed_captured_value'), 'A display value must not override a captured field in the evidence validator');

const findings = await generate(stateFor('findings', 'INSPECTION REPORT', observations, [{ slotKey: 'findings', title: 'Observed condition', presentation: { renderer: 'component_narrative', hideHeading: true } }]));
assert.ok(findings.draft.content.includes('<h4>Shell</h4>'));
assert.ok(findings.draft.content.includes('<h4>Floor</h4>'));
assert.ok(findings.draft.content.includes('Floor plate F4 was not accessible.'));
assert.ok(!findings.draft.content.includes('Observed condition'));

const methods = await generate(stateFor('methods', 'TEST METHODS', [record('method', 'identity', { fieldKey: 'method', value: 'Visual inspection' })], [{ slotKey: 'methods', presentation: { renderer: 'labelled_fields', hideHeading: true } }]));
assert.ok(methods.draft.content.includes('data-report-format="labelled-fields"'));
assert.ok(methods.draft.content.includes('<strong>Method:</strong> Visual inspection'));
assert.ok(!methods.draft.content.includes('<table'));
const methodsState = stateFor('methods', 'TEST INFORMATION', [record('pressure', 'identity', { fieldKey: 'testPressure', value: 6, unitCode: 'bar', reportLabel: 'Test Pressure' })], [{ slotKey: 'methods', presentation: { renderer: 'labelled_fields', hideHeading: true } }]);
const methodsFields = await generate(methodsState);
const scoreMethods = evaluateSectionPlanOutput({ sectionPlan: methodsState.sectionPlanning.sectionPlans[0], evidenceRecords: methodsState.sectionPlanning.evidenceRecords, generatedContent: methodsFields.draft.content });
assert.equal(scoreMethods.truthGraphEvaluation.requiredFactRecall, 1);
assert.equal(scoreMethods.truthGraphEvaluation.claimPrecision, 1);
const actions = await generate(stateFor('recommendations', 'REPAIR RECOMMENDATIONS', [record('action', 'observation', { text: 'Repair the recorded coating damage after preparation.' })], [{ slotKey: 'actions', presentation: { renderer: 'narrative', hideHeading: true, narrativeStyle: 'numbered_list' } }]));
assert.ok(actions.draft.content.includes('<ol>'));
assert.ok(!actions.draft.content.includes('<ul>'));

const measurement = record('ut', 'measurement', { itemLabel: 'Nozzle N1', cells: [{ key: 'value1', value: 7.1, unitCode: 'mm' }, { key: 'value2', value: 7.0, unitCode: 'mm' }, { key: 'value3', value: null, unitCode: 'mm' }] }, { presentation: { reportItemLabel: 'N1 (NZ-1)' } });
const thickness = await generate(stateFor('thickness', 'THICKNESS MEASUREMENTS', [measurement], [{ slotKey: 'readings', presentation: { renderer: 'measurement_table', hideHeading: true, measurementColumns: [{ key: 'value1', title: "12 o'clock" }, { key: 'value2', title: "3 o'clock" }, { key: 'value3', title: "6 o'clock" }] } }]));
assert.ok(thickness.draft.content.includes('<th>12 o&#39;clock</th>'));
assert.ok(thickness.draft.content.includes('<td>7.1 mm</td>'));
assert.ok(thickness.draft.content.includes('<td>Not recorded</td>'));
assert.ok(thickness.draft.content.includes('<td>N1 (NZ-1)</td>'));
assert.ok(thickness.draft.content.includes('data-evidence-id="ut"'));
assert.equal(measurement.payload.itemLabel, 'Nozzle N1', 'Display aliases must not replace captured identities');
assert.ok(!thickness.draft.content.includes('0 mm'));
assert.equal(modelCalls, 0);

const componentSection = await generate(stateFor('thickness', 'THICKNESS MEASUREMENTS', [measurement], [{ slotKey: 'readings', title: 'NOZZLE THICKNESS MEASUREMENTS', presentation: { renderer: 'measurement_table', headingLevel: 2, headingPrefix: '9' } }]));
assert.ok(componentSection.draft.content.includes('<h2>9 NOZZLE THICKNESS MEASUREMENTS</h2>'));

const duplicateState = stateFor('findings', 'INSPECTION REPORT', [observations[0]], [
  { slotKey: 'component', presentation: { renderer: 'narrative', hideHeading: true } },
  { slotKey: 'summary', presentation: { renderer: 'narrative', hideHeading: true, deduplicateWithinSection: true } },
], [{ evidenceIds: ['shell'], blockId: 'findings:component', role: 'required_narrative' }, { evidenceIds: ['shell'], blockId: 'findings:summary', role: 'required_narrative' }]);
const repeated = await generate(duplicateState);
assert.equal((repeated.draft.content.match(/Coating damage was observed/g) ?? []).length, 2, 'Formatting cannot discard a distinct required outline obligation');
assert.equal(repeated.generationRun.retainedRepeatedUses[0].canonicalBlockId, 'findings:component');
assert.ok(repeated.draft.content.includes('data-obligation-id="obligation-1"'));

const unsafe = parseSectionDocument({ sectionId: 'unsafe', html: '<table data-report-format="paired-fields" style="border:0" onclick="alert(1)" class="custom"><tr><td>A</td></tr></table><div data-report-format="arbitrary" style="display:none">B</div>' });
const sanitized = renderSectionDocumentHtml(unsafe);
assert.ok(sanitized.includes('data-report-format="paired-fields"'));
assert.ok(!/style=|onclick=|class=|data-report-format="arbitrary"/.test(sanitized), 'Presentation metadata must not allow arbitrary HTML or styling');

// A corroborating sentence may be omitted only when every assertion in that
// whole sentence is supplied independently by a captured structured field.
const corroborationFields = new Map([
  ['tankNumber', { payload: { value: 'FMT-2' } }], ['client', { payload: { value: 'Fixture Client' } }], ['location', { payload: { value: 'Fixture Yard' } }],
  ['diameterM', { payload: { value: 10, unitCode: 'm' } }], ['heightM', { payload: { value: 12, unitCode: 'm' } }],
  ['shellCourseCount', { payload: { value: 6 } }], ['shellLaneCount', { payload: { value: 4 } }],
]);
assert.deepEqual(corroboratedIdentityFields('The asset is FMT-2 for Fixture Client at Fixture Yard.', corroborationFields), ['tankNumber', 'client', 'location']);
assert.deepEqual(corroboratedIdentityFields('This is the current inspection of FMT-2 at Fixture Yard.', corroborationFields), ['tankNumber', 'location']);
assert.deepEqual(corroboratedIdentityFields('The tank diameter is ten metres and height is twelve metres, with six shell courses and four measurement lanes.', corroborationFields), ['diameterM', 'heightM', 'shellCourseCount', 'shellLaneCount']);
for (const text of [
  'The asset is FMT-3 for Fixture Client at Fixture Yard.',
  'The asset is FMT-2 for Fixture Client at Fixture Yard, with access restricted.',
  'The asset is reportedly FMT-2 for Fixture Client at Fixture Yard.',
  'This is the current inspection of FMT-2 at Fixture Yard, after repairs.',
  'The tank diameter is eleven metres and height is twelve metres, with six shell courses and four measurement lanes.',
  'The tank diameter is ten metres and height is twelve metres, with six shell courses and five measurement lanes.',
  'The tank diameter is ten metres and height is twelve metres, with six shell courses and four measurement lanes, pending verification.',
]) assert.equal(corroboratedIdentityFields(text, corroborationFields), null, `A changed value or extra qualification must remain narrative: ${text}`);
const noUnits = new Map(corroborationFields); noUnits.set('diameterM', { payload: { value: 10 } });
assert.equal(corroboratedIdentityFields('The tank diameter is ten metres and height is twelve metres, with six shell courses and four measurement lanes.', noUnits), null, 'Matching numbers without independently captured units are not corroboration');

const candidateNative = {
  inspectionId: 'formatter-candidate-audit',
  inspectionRecord: { client: 'Fixture Client', tankNumber: 'FMT-2', location: 'Fixture Yard', diameterM: 10, heightM: 12 },
  utMeasurements: [
    { itemKey: 'floor:region:4.8', targetKey: 'floor', itemLabel: '4.8', itemKind: 'LAYOUT_REGION', unitCode: 'mm', value1: 6.1, value2: 6.2, value3: null, value4: 6.4, value5: 6.5, measured: true },
    { itemKey: 'shell:nozzle:n3', targetKey: 'shell', itemLabel: 'NZ-3', itemKind: 'ELEMENT', elementId: 'n3', elementTypeKey: 'nozzle', unitCode: 'mm', value1: 7.2, value2: 7.3, value3: 7.4, value4: 7.5, reinforcementPadReading: 8.4, measured: true },
  ],
  voiceNotes: [
    { voiceNoteId: 'identity-exact', screenKey: 'general_info', transcriptStatus: 'transcribed', transcriptText: 'The asset is FMT-2 for Fixture Client at Fixture Yard.' },
    { voiceNoteId: 'identity-qualified', screenKey: 'general_info', transcriptStatus: 'transcribed', transcriptText: 'The asset is FMT-2 for Fixture Client at Fixture Yard, with access restricted.' },
    { voiceNoteId: 'floor-points', targetKey: 'floor', itemKey: 'floor:region:4.8', itemLabel: '4.8', transcriptStatus: 'transcribed', transcriptText: 'At F07 the five point labels are UT1 through UT5, in the same order as the measurement card.' },
    { voiceNoteId: 'nozzle-points', targetKey: 'shell', itemKey: 'shell:nozzle:n3', itemLabel: 'NZ-3', transcriptStatus: 'transcribed', transcriptText: 'At N3 the four readings are at twelve, three, six and nine oclock, with a separate reinforcement pad reading.' },
  ],
};
const nativeFrozen = JSON.stringify(candidateNative);
const candidate = buildGenericOutlineEvaluationSnapshot({ exportPackage: candidateNative, provenance: { locationAliases: {
  F07: { itemKey: 'floor:region:4.8', itemLabel: '4.8', mapLabel: '17' },
  N3: { itemKey: 'shell:nozzle:n3', itemLabel: 'NZ-3' },
} } });
assert.equal(JSON.stringify(candidateNative), nativeFrozen);
const candidateIdentity = candidate.sectionPlans.find(plan => plan.sectionId === 'identity');
const voiceRecord = nativeId => candidate.evidenceRecords.find(entry => entry.sourceRecord?.voiceNoteId === nativeId);
assert.ok(candidateIdentity.evidenceUses.filter(use => use.evidenceIds.includes(voiceRecord('identity-exact').evidenceId)).every(use => use.role === 'supporting'), 'Whole corroborated identity sentence should retain provenance as supporting evidence');
assert.ok(candidateIdentity.evidenceUses.some(use => use.evidenceIds.includes(voiceRecord('identity-qualified').evidenceId) && use.role === 'required_narrative'), 'A qualification not present in structured identity must remain required');
const candidateThickness = candidate.sectionPlans.find(plan => plan.sectionId === 'thickness');
const candidateDraft = await generatePlannedSectionDraft({ reportState: { sectionPlanning: candidate }, sectionId: 'thickness', aiStatus: { configured: false } });
for (const entry of candidate.evidenceRecords.filter(entry => entry.kind === 'measurement')) {
  const source = candidateNative.utMeasurements.find(row => row.itemKey === entry.payload.itemKey);
  assert.equal(entry.payload.itemLabel, source.itemLabel);
  assert.equal(entry.payload.unitCode, 'mm');
  for (const cell of entry.payload.cells) assert.equal(cell.value, source[cell.key], 'Formatting must preserve each native measurement value, including null');
  const obligation = candidateThickness.outputObligations.find(item => item.evidenceIds.includes(entry.evidenceId));
  assert.ok(obligation, 'Every captured measurement must retain its required output obligation');
  assert.deepEqual(obligation.expected.cells, entry.payload.cells);
  assert.ok(candidateDraft.draft.content.includes(`data-evidence-id="${entry.evidenceId}"`));
  assert.ok(candidateDraft.draft.content.includes(`data-obligation-id="${obligation.obligationId}"`));
}
assert.ok(candidateDraft.draft.content.includes('F07 (map 17; native 4.8)'));
assert.ok(candidateDraft.draft.content.includes('N3 (NZ-3)'));
assert.ok(candidateDraft.draft.content.includes('<th>UT1</th>'));
assert.ok(candidateDraft.draft.content.includes('<th>12 o&#39;clock</th>'));
assert.ok(candidateDraft.draft.content.includes('<td>8.4 mm</td>'));
const scoreCandidate = content => evaluateSectionPlanOutput({ sectionPlan: candidateThickness, evidenceRecords: candidate.evidenceRecords, generatedContent: content });
const candidateScore = scoreCandidate(candidateDraft.draft.content);
assert.ok(candidateScore.truthGraphEvaluation.requiredFactRecall > scoreCandidate(candidateDraft.draft.content.replace('6.1 mm', '6.9 mm')).truthGraphEvaluation.requiredFactRecall, 'The formatted candidate must still detect altered native measurements');
assert.equal(JSON.stringify(candidateNative), nativeFrozen);
const mixedRows = structuredClone(candidateNative);
mixedRows.utMeasurements.push({ ...mixedRows.utMeasurements[0], itemKey: 'floor:region:4.9', itemLabel: '4.9', value1: 5.5 });
const mixedSnapshot = buildGenericOutlineEvaluationSnapshot({ exportPackage: mixedRows, provenance: { locationAliases: {
  F07: { itemKey: 'floor:region:4.8', itemLabel: '4.8', mapLabel: '17' },
  F08: { itemKey: 'floor:region:4.9', itemLabel: '4.9', mapLabel: '18' },
} } });
const mixedSlot = mixedSnapshot.sectionPlans.find(plan => plan.sectionId === 'thickness').catalog.slots.find(slot => slot.slotKey === 'readings-floor');
assert.equal(mixedSlot.presentation.measurementColumns, undefined, 'One row’s verified UT1–UT5 labels cannot be assigned to another row without that declaration');
assert.ok(mixedSnapshot.evidenceRecords.find(entry => entry.kind === 'measurement' && entry.payload.itemKey === 'floor:region:4.8').presentation.measurementColumns, 'Individually verified point labels remain available even when the shared table needs generic columns');
const sparseIdentity = buildGenericOutlineEvaluationSnapshot({ exportPackage: { inspectionId: 'sparse-identity', inspectionRecord: { client: 'Captured client only' } }, selectedModuleIds: ['identity'] }).sectionPlans[0];
for (const outlineId of ['configuration', 'inspection']) assert.ok(sparseIdentity.missingRequirements.some(item => item.requirementId === `identity:${outlineId}:missing-input`), `A merged paired field form must not hide missing ${outlineId} inputs`);
console.log('Inspection report presentation audit passed: unchanged legacy HTML, opt-in headings, paired fields, component grouping, compact labels, numbered actions, captured UT labels/values, required-use trace and sanitized metadata.');
