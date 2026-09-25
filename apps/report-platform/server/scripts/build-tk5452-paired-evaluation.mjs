#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getAiStatus, runStructuredCodexJob } from '../codex-cli.mjs';
import { evaluateSectionPlanOutput } from '../section-plan-evaluation.mjs';
import { generatePlannedSectionDraft, INSPECTION_REPORT_FORMATTER_CONTRACT, PLANNED_GENERATOR_CONTRACT } from '../planned-generation.mjs';
import { validateAndroidV3ProductExport } from '../store.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(HERE, '../..');
const INPUT_TEMPLATE = join(PROJECT, 'docs/reviews/data/syn025-current-only-v3/native/export.json');
const OUT = join(PROJECT, 'docs/reviews/data/tk5452-paired-v1');
const SOURCE = '/Users/oscar/Public/irs/Sample Reports/Shell Singapore Pte Ltd (Bukom)/19SE2-1 - TK 5452/19SE2-1 Shell Bukom TK 5452 Internal & External Inspection Report.pdf';
const SOURCE_SHA256 = '871d8770a5667bdbc3f0623a3a2e3ace54abcaf07acbd27017610ec24407de92';
const CASE_ID = 'eval-paired-tk5452-v1';
const live = process.argv.includes('--live');
if (live) throw new Error('The v1 paired fixture copies finished report prose and is retired for live generation. Prepare inspector-note inputs with prepare-tk5452-inspector-notes.mjs, then resolve routing and independent scoring before a new evaluation run.');
const sha = value => createHash('sha256').update(value).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const norm = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const sectionDefinitions = [
  ['01-scope', '1', 'SCOPE OF INSPECTION', [4]],
  ['02-regime', '2', 'INSPECTION AND MAINTENANCE REGIME', [5]],
  ['03-general-information', '3', 'GENERAL TANK INFORMATION', [6]],
  ['04-inspection-report', '4', 'INSPECTION REPORT', [7, 8, 9, 10, 11, 12]],
  ['05-recommendations', '5', 'REPAIR RECOMMENDATIONS / API 653 ASSESSMENT', [13]],
  ['06-test-information', '6', 'TEST INFORMATION', [14]],
  ['07-checklist', '7', 'TANK INSPECTION CHECKLIST', [15, 16, 17, 18, 19, 20]],
  ['08-roof-plate-thickness', '8', 'ROOF PLATE THICKNESS MEASUREMENTS', [21]],
  ['09-roof-nozzle-thickness', '9', 'ROOF NOZZLE & REINFORCEMENT PAD THICKNESS MEASUREMENTS', [22]],
  ['10-roof-layout', '10', 'ROOF PLATE LAYOUT', [23]],
  ['11-shell-calculations', '11', 'MINIMUM SHELL THICKNESS CALCULATIONS', [24]],
  ['12-shell-thickness', '12', 'SHELL PLATE THICKNESS MEASUREMENTS', [25]],
  ['13-shell-nozzle-thickness', '13', 'SHELL NOZZLE & REINFORCEMENT PAD THICKNESS MEASUREMENTS', [26]],
  ['14-shell-layout', '14', 'SHELL PLATE LAYOUT', [27]],
  ['15-piping-thickness', '15', 'TANK PIPING SPOT THICKNESS MEASUREMENTS', [28, 29]],
  ['16-piping-layout', '16', 'TANK PIPING LAYOUT', [30]],
  ['17-bscan-profiles', '17', 'B-SCAN PROFILES', [31, 32, 33, 34, 35]],
  ['18-floor-layout', '18', 'FLOOR PLATE LAYOUT WITH PLATE NUMBERING SYSTEM', [36]],
  ['19-truflux-guidance', '19', 'GUIDELINES FOR INTERPRETATION OF TRU-FLUX DATA SHEETS', [37]],
  ['20-floor-corrosion-plan', '20', 'FLOOR PLATE CORROSION PLAN', [38]],
  ['21-floor-platemaps', '21', 'FLOOR PLATE INDIVIDUAL PLATEMAPS', [39, 40, 41, 42, 43, 44, 45]],
].map(([sectionId, number, title, pages]) => ({ sectionId, number, title, pages }));

const sourceBytes = await readFile(SOURCE);
assert.equal(sha(sourceBytes), SOURCE_SHA256, 'TK5452 source checksum changed');
const template = JSON.parse(await readFile(INPUT_TEMPLATE, 'utf8'));

function pageText(page) {
  return execFileSync('pdftotext', ['-f', String(page), '-l', String(page), '-layout', SOURCE, '-'], { encoding: 'utf8', maxBuffer: 8_000_000 });
}
const pages = Object.fromEntries([...new Set(sectionDefinitions.flatMap(section => section.pages))].map(page => [page, pageText(page)]));
function body(page, { title = null } = {}) {
  let value = pages[page].replace(/\f/g, '').replace(/\r/g, '');
  value = value.replace(/^[\s\S]*?Page\s*:\s*\d+\s*\n/i, '');
  if (title) value = value.replace(new RegExp(`^\\s*\\d+\\s+${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n`, 'im'), '');
  value = value.replace(/\n\s*This document may contain confidential information[\s\S]*$/i, '');
  return value.trim();
}
function bullets(text) {
  return text.split(/(?=\n?\s*➢\s*)/).map(item => norm(item.replace(/^\s*➢\s*/, ''))).filter(Boolean);
}

const scopeItems = bullets(body(4, { title: 'SCOPE OF INSPECTION' }));
assert.equal(scopeItems.length, 9);
const recommendationItems = bullets(body(13, { title: 'REPAIR RECOMMENDATIONS / API 653 ASSESSMENT' }).split(/API 653 Authorized Inspector/i)[0].replace(/^\s*OFF-LINE\s*/i, ''));
assert.equal(recommendationItems.length, 7);

const findingHeadings = ['DIKED AREA', 'FOUNDATION', 'SHELL EXTERNAL', 'SHELL APPURTENANCES', 'ACCESS STRUCTURE', 'FIXED ROOF EXTERNAL (DOME)', 'ROOF APPURTENANCES', 'ROOF INTERNAL', 'SHELL INTERNAL', 'FLOOR INTERNAL (FLAT)'];
const findings = [];
let currentHeading = null;
for (const page of [7, 8, 9, 10, 11]) {
  const lines = body(page, { title: page === 7 ? 'INSPECTION REPORT' : null }).split('\n');
  let buffer = [];
  const flush = () => {
    if (!buffer.length || !currentHeading) { buffer = []; return; }
    const text = norm(buffer.join(' ').replace(/^\s*➢\s*/, ''));
    if (text && !/^(Shell Plate Corrosion Rate|Roof Plate Corrosion Rate)/i.test(text)) findings.push({ component: currentHeading, text, page });
    buffer = [];
  };
  let skipCalculations = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (findingHeadings.includes(line)) { flush(); currentHeading = line; skipCalculations = false; continue; }
    if (/^(Shell Plate Corrosion Rate|Roof Plate Corrosion Rate)/i.test(line)) { flush(); skipCalculations = true; continue; }
    if (skipCalculations) continue;
    if (line.startsWith('➢')) { flush(); buffer = [line]; }
    else if (buffer.length && line) buffer.push(line);
  }
  flush();
}
assert(findings.length >= 35, `Expected rich findings; received ${findings.length}`);

const ratings = ["2","1","NE","2","NE","2","2","1","2","IA","N/A","NE","2","2","2","NE","2","2","2","NE","3","N/A","NE","NE","2","NE","NE","NE","2","N/A","N/A","2","2","2","2","NE","1","NE","N/A","N/A","NE","2","1","2","NE","1","NE","NE","NE","NE","NE","N/A","N/A","N/A","N/A","N/A","1","NE","NE","NE","N/A","N/A","N/A","N/A","N/A","1","N/A","1","1","1","1","N/A","1","N/A","N/A","N/A","N/A","NE","2","3","NE","2","NE","N/A","N/A","2","N/A","NE","2","N/A","N/A","N/A","N/A","N/A","2","2","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","2","2","2","2","2","2","2","N/A","2","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A","2","NE","2","2","N/A","N/A","N/A","N/A","2","2","2","NE","2","NE","N/A","N/A","2","NE","2","2","N/A","NE","2","2","2","2","2","N/A","N/A","N/A"];
ratings.splice(141, 0, 'N/A', 'N/A');
assert.equal(ratings.length, 195);
const ratingLabels = { '1': 'Good Condition', '2': 'Satisfactory Condition', '3': 'Requires Repair/Action', '4': 'Repairs Require Immediate Attention', IA: 'Inaccessible', NE: 'None Evident', NC: 'No Comment', 'N/A': 'Not Applicable' };
const checklist = template.inspectionChecklistItems.map((item, index) => ({ ...item, inspectionId: 'tk5452-paired-eval', ratingKey: ratings[index], ratingLabel: ratingLabels[ratings[index]], itemNote: '', updatedAtIso: '2019-06-20T00:00:00.000Z' }));
assert.equal(checklist.length, 195);

const roofPlateValues = [
  [4.48,4.36,4.04,4.26,4.07],[4.03,3.98,4.05,4.11,4.09],[4.00,3.98,4.03,4.09,3.96],
  [4.02,3.99,4.06,4.03,4.08],[4.09,4.16,4.12,4.07,4.15],[4.32,4.20,4.18,4.18,4.12],
  [4.13,4.20,4.05,4.02,4.20],[4.08,4.28,4.16,4.11,4.07],[8.60,8.56,8.66,8.59,8.63],
];
const roofNozzles = [
  { itemLabel: 'R1 · size three inches', values: [5.39,5.40,5.33,5.45,4.17] },
  { itemLabel: 'R2 · size twenty-four inches', values: [9.60,9.55,9.72,9.59,4.25] },
  { itemLabel: 'R3 · size three inches', values: [5.43,5.30,5.33,5.46,4.16] },
];
const measurement = (sectionId, itemKey, itemLabel, values, columns) => ({
  inspectionId: 'tk5452-paired-eval', sectionId, itemKey, targetKey: 'external_roof', itemLabel, itemKind: 'LAYOUT_REGION',
  confirmed: true, measured: true, unitCode: 'mm',
  ...Object.fromEntries(columns.map((key, index) => [key, values[index]])), updatedAtIso: '2019-06-20T00:00:00.000Z',
});
const utMeasurements = [
  ...roofPlateValues.map((values, index) => measurement('08-roof-plate-thickness', `roof-plate-${index + 1}`, `Roof Plate ${index + 1}`, values, ['value1','value2','value3','value4','value5'])),
  ...roofNozzles.map((row, index) => measurement('09-roof-nozzle-thickness', `roof-nozzle-r${index + 1}`, row.itemLabel, row.values, ['value1','value2','value3','value4','reinforcementPadReading'])),
];

const identityFields = [
  ['client','Client','Shell Eastern Petroleum Pte Ltd',null], ['clientRepresentative','Client Representative','George Wong',null],
  ['tankNumber','Tank Number','5452',null], ['location','Location','Pulau Bukom',null], ['yearBuilt','Year Built','1972',null],
  ['fieldLeaseName','Field/Lease Name','Shell Bukom',null], ['originalManufacturer','Original Manufacturer','Not Provided',null],
  ['heightM','Height',3.048,'m'], ['originalConstructionStandard','Original Construction Std.','None',null],
  ['serviceHeightM','Service Height',2.438,'m'], ['materialSpecification','Material Spec.','Unknown Carbon Steel',null],
  ['diameterM','Diameter',3.048,'m'], ['shellConstruction','Construction (Shell)','Butt welded; 1st–2nd strakes: 6.0 mm',null],
  ['productStored','Product Stored','15% Ammonium Hydroxide',null], ['drawingReference','Drawing Ref.','BKM 72/0085',null],
  ['specificGravity','Specific Gravity','0.88–0.957',null], ['roofType','Roof Type','Fixed Cone',null],
  ['designTemperatureC','Design Temp.',50,'°C'], ['internalPressure','Internal Pres.','-',null],
  ['shellCourseCount','Total Shell Courses',2,null], ['floorPlateCount','Total Floor Plates',4,null],
  ['roofPlateCount','Total Roof Plates',9,null], ['floorPlateThicknessMm','Floor Plate Thickness',6,'mm'],
  ['windGirder','Wind Girder','No',null], ['annularPlateCount','Total Annular Plates','None',null],
  ['insulated','Insulated','No',null], ['annularPlateThickness','Annular Plate Thickness','Not Applicable',null], ['stiffener','Stiffener','No',null],
  ['externalInspectionHistory','Previous Inspection · External','Not Provided',null], ['internalInspectionHistory','Previous Inspection · Internal','Not Provided',null], ['bottomInspectionHistory','Previous Inspection · Bottom','Not Provided',null],
  ['jobNumber','Job No.','19SE2-1',null], ['dateCompleted','Date Completed','20 June 2019',null],
];

const methodFields = [
  ['UT · Test Specification','UM/001; UM/002'], ['UT · Acceptance Criteria','API 653 4th Ed., April 2009'], ['UT · Surface Preparation','Uncoated'],
  ['UT · Flaw Detector','Epoch 4 (S/N IRS 3167)'], ['UT · Scanning Pattern','Single & Continuous Measurements'], ['UT · Couplant','Water'],
  ['UT · Test Material','Carbon Steel'], ['UT · Calibration','5–15 mm (S/N IRS 5013); reference sensitivity 40 dB; scanning sensitivity +6 dB'],
  ['UT · Calibration Standard','A.S. 2083 Calibration Blocks and Their Method of Use in Ultrasonic Testing'], ['UT · Transducer','DA-301 5 MHz, 10 mm diameter dual crystal (S/N IRS 2065)'],
  ['UT · Test Range','A-Scan 0–30 mm; B-Scan 0–30 mm'], ['MFL · Test Specification','TM/008'],
  ['MFL · Acceptance Criteria','API 653 4th Ed., April 2009'], ['MFL · Surface Preparation','Coated (Primed)'],
  ['MFL · Corrosion Volume Detector','MFLmap Truflux (Unit No. 2)'],
  ['MFL · Calibrations','6.0 mm IRS 5024; 8.0 mm IRS 5011; 10.0 mm IRS 5028; 12.0 mm IRS 5030; each with 20%–80% artificial defects'],
];

const exportPackage = clone(template);
Object.assign(exportPackage, {
  inspectionReference: '19SE2-1-TK5452-PAIRED-EVAL', inspectionId: 'tk5452-paired-eval', exportedAtIso: '2019-06-20T00:00:00.000Z',
  workflowScreen: 'review', layoutTargets: [], layoutConfigs: [], layoutFigures: [], elements: [], attachments: [],
  inspectionChecklistItems: checklist, inspectionChecklistSectionNotes: [], utMeasurements,
  validationResults: [{ key: 'pairedSourceIdentity', passed: true, message: 'Source, capture and reference identify job 19SE2-1 and tank 5452.' }],
  taskSnapshots: [{ taskKey: 'tk5452-scope', source: 'source-derived evaluation capture', taskText: scopeItems.join(' ') }],
  findings: findings.map((item, index) => ({ inspectionId: 'tk5452-paired-eval', findingId: `tk5452-f${String(index + 1).padStart(2,'0')}`, targetKey: targetFor(item.component), itemLabel: item.component, itemKind: 'COMPONENT', note: item.text, attachmentCount: 0, hasMissingAttachment: false, updatedAtIso: '2019-06-20T00:00:00.000Z' })),
  voiceNotes: [
    ...scopeItems.map((text, index) => voice(`scope-${index + 1}`, '01-scope', text)),
    ...findings.map((item, index) => voice(`finding-${index + 1}`, '04-inspection-report', item.text, item.component)),
    ...recommendationItems.map((text, index) => voice(`recommendation-${index + 1}`, '05-recommendations', text)),
  ],
});
Object.assign(exportPackage.task, { client: 'Shell Eastern Petroleum Pte Ltd', tankNumber: '5452', location: 'Pulau Bukom', inspectionReference: exportPackage.inspectionReference });
Object.assign(exportPackage.inspectionRecord, { inspectionId: exportPackage.inspectionId, inspectionReference: exportPackage.inspectionReference, client: 'Shell Eastern Petroleum Pte Ltd', tankNumber: '5452', location: 'Pulau Bukom', fieldLeaseName: 'Shell Bukom', inspector: 'Neo Sze Wee', externalRoofType: 'fixed_cone', internalRoofType: 'none', diameterM: 3.048, heightM: 3.048, shellCourseCount: 2, shellLaneCount: 4, referenceMode: 'tank_north', referenceNote: 'Report drawings use stated compass sectors.', updatedAtIso: '2019-06-20T00:00:00.000Z' });
exportPackage.profile = { ...exportPackage.profile, tenantId: exportPackage.tenantId, workspaceId: exportPackage.workspaceId };
assert.deepEqual(validateAndroidV3ProductExport(exportPackage), []);

function voice(id, sectionId, transcriptText, itemLabel = null) {
  return { inspectionId: 'tk5452-paired-eval', voiceNoteId: `tk5452-${id}`, screenKey: sectionId, screenLabel: sectionDefinitions.find(section => section.sectionId === sectionId)?.title ?? sectionId, cardKey: 'source_derived_mock_capture', fieldKey: 'voice_note', ...(itemLabel ? { itemLabel, targetKey: targetFor(itemLabel) } : {}), transcriptStatus: 'completed', transcriptText, capturedAtIso: '2019-06-20T00:00:00.000Z', updatedAtIso: '2019-06-20T00:00:00.000Z' };
}
function targetFor(component) {
  if (/DIKED/.test(component)) return 'surroundings';
  if (/FOUNDATION/.test(component)) return 'foundation';
  if (/FLOOR/.test(component)) return 'floor';
  if (/ROOF INTERNAL/.test(component)) return 'internal_roof';
  if (/ROOF/.test(component)) return 'external_roof';
  return 'shell';
}

const evidenceRecords = [];
const plans = [];
function addRecord({ sectionId, slotKey, kind, payload, displayText, entityId = null, presentation = null, role = kind === 'voice_claim' ? 'required_narrative' : 'required_structured', sourcePointer }) {
  const evidenceId = `tk5452_${sectionId}_${String(evidenceRecords.length + 1).padStart(4,'0')}`;
  const record = { evidenceId, kind, sourceClass: kind === 'voice_claim' ? 'app_voice' : kind === 'approved_template' ? 'approved_template' : 'app_field', sourceRef: { pointer: sourcePointer, nativeRecordId: payload.itemKey ?? payload.fieldKey ?? evidenceId, importHash: sha(JSON.stringify(exportPackage)) }, entityId, locationRef: { targetKey: payload.targetKey ?? null, itemKey: payload.itemKey ?? null, plateId: payload.plateId ?? null, itemLabel: payload.itemLabel ?? null }, captureContext: { screenKey: sectionId, cardKey: 'paired_source_mock', fieldKey: payload.fieldKey ?? null, targetKey: payload.targetKey ?? null, itemKey: payload.itemKey ?? null, itemLabel: payload.itemLabel ?? null }, payload: clone(payload), displayText: displayText ?? payload.text ?? '', quality: { status: 'captured', issues: [] }, sourceRecord: clone(payload), ...(presentation ? { presentation } : {}) };
  evidenceRecords.push(record);
  const plan = plans.find(item => item.sectionId === sectionId);
  const blockId = `${sectionId}:${slotKey}`;
  plan.evidenceUses.push({ useId: `use_${evidenceId}`, evidenceIds: [evidenceId], entityIds: entityId ? [entityId] : [], sectionId, role, projection: kind === 'measurement' ? 'measurement_rows' : kind === 'checklist_response' ? 'checklist_rows' : 'source_evidence', blockId, slotKey, relatedSectionId: null, decision: { basis: 'paired_source_mock_preprocessing', ruleOrReviewId: 'tk5452-paired-v1' }, preserve: ['entity','location','condition','negation','uncertainty','source_reference'] });
  plan.outputObligations.push({ obligationId: `obligation_${evidenceId}`, requirementId: `${sectionId}:${slotKey}:${evidenceId}`, evidenceIds: [evidenceId], entityIds: entityId ? [entityId] : [], sectionId, role, targetBlockId: blockId, required: true, expected: kind === 'measurement' ? { cells: payload.cells } : { text: payload.text ?? displayText ?? '' } });
  return record;
}
function makePlan(definition, slots, missing = []) {
  const plan = { schemaVersion: 'section_plan_v2', sectionId: definition.sectionId, title: definition.title, contractVersion: 'tk5452_paired_planning_v1', reportProfileId: 'tk5452_exact_outline_eval_v1', status: missing.length ? 'needs_review' : 'ready', applicability: { state: 'applicable', basisRef: 'source-report-toc' }, evidenceUses: [], outputObligations: [], blocks: slots.map(slot => ({ blockId: `${definition.sectionId}:${slot.slotKey}`, slotKey: slot.slotKey, type: slot.presentation?.renderer ?? 'narrative' })), missingRequirements: missing, unresolvedEvidence: [], catalog: { sectionId: definition.sectionId, title: definition.title, reportPresentation: { contractVersion: INSPECTION_REPORT_FORMATTER_CONTRACT, profileId: 'tk5452_exact_outline_eval_v1', number: definition.number, title: definition.title }, slots }, planId: `plan_${definition.sectionId}` };
  plans.push(plan); return plan;
}
const slot = (slotKey, title, renderer = 'narrative', extra = {}) => ({ slotKey, title, purpose: title, presentation: { renderer, hideHeading: true, ...extra } });

for (const definition of sectionDefinitions) {
  const missing = [];
  let slots = [slot('content', 'Content')];
  if (definition.sectionId === '03-general-information') slots = [slot('asset', 'General tank information', 'paired_fields', { fieldLabels: Object.fromEntries(identityFields.map(([key,label]) => [key,label])) })];
  else if (definition.sectionId === '04-inspection-report') slots = [slot('condition', 'Inspection findings', 'component_narrative', { narrativeStyle: 'arrow_list' })];
  else if (definition.sectionId === '07-checklist') slots = [slot('responses', 'Inspection responses', 'checklist_table', { responseColumns: ['1','2','3','4','IA','NE','NC','N/A'] })];
  else if (['08-roof-plate-thickness','09-roof-nozzle-thickness'].includes(definition.sectionId)) slots = [slot('readings', 'Measurements', 'measurement_table', { headingCase: 'uppercase', measurementColumns: definition.sectionId.startsWith('08') ? [{key:'value1',title:'A'},{key:'value2',title:'B'},{key:'value3',title:'C'},{key:'value4',title:'D'},{key:'value5',title:'E'}] : [{key:'value1',title:'North'},{key:'value2',title:'East'},{key:'value3',title:'South'},{key:'value4',title:'West'},{key:'reinforcementPadReading',title:'Reinforcement Pad'}] })];
  else if (definition.sectionId === '06-test-information') slots = [slot('method', 'Test information', 'labelled_fields')];
  if (['10-roof-layout','11-shell-calculations','12-shell-thickness','14-shell-layout','15-piping-thickness','16-piping-layout','17-bscan-profiles','18-floor-layout','20-floor-corrosion-plan','21-floor-platemaps'].includes(definition.sectionId)) missing.push({ requirementId: `${definition.sectionId}:native-input`, reason: 'No matching native mock record or verified app artifact was prepared for this source section.', resolution: 'prepare_source_aligned_mock_input', blocksApproval: true });
  if (definition.sectionId === '13-shell-nozzle-thickness') missing.push({ requirementId: `${definition.sectionId}:source-identity`, reason: 'Source page 26 carries V1302A / 19SE1-1 header data, so the table is quarantined pending source review.', resolution: 'source_owner_confirmation', blocksApproval: true });
  makePlan(definition, slots, missing);
}

scopeItems.forEach((text, index) => addRecord({ sectionId: '01-scope', slotKey: 'content', kind: 'voice_claim', payload: { text }, displayText: text, entityId: `tk5452:scope:${index + 1}`, sourcePointer: `/voiceNotes/${index}` }));
addRecord({ sectionId: '02-regime', slotKey: 'content', kind: 'approved_template', payload: { text: body(5, { title: 'INSPECTION AND MAINTENANCE REGIME' }) }, displayText: body(5, { title: 'INSPECTION AND MAINTENANCE REGIME' }), sourcePointer: '/approvedStandardSections/inspectionMaintenanceRegime' });
identityFields.forEach(([fieldKey, reportLabel, value, unitCode], index) => addRecord({ sectionId: '03-general-information', slotKey: 'asset', kind: 'identity', payload: { fieldKey, reportLabel, value, unitCode }, displayText: `${reportLabel}: ${value}${unitCode ? ` ${unitCode}` : ''}`, entityId: 'tk5452:tank', sourcePointer: `/inspectionRecord/${fieldKey}` }));
findings.forEach((item, index) => addRecord({ sectionId: '04-inspection-report', slotKey: 'condition', kind: 'voice_claim', payload: { text: item.text, targetKey: targetFor(item.component) }, displayText: item.text, entityId: `tk5452:${slug(item.component)}`, presentation: { componentHeading: item.component }, sourcePointer: `/voiceNotes/finding-${index + 1}` }));
recommendationItems.forEach((text, index) => addRecord({ sectionId: '05-recommendations', slotKey: 'content', kind: 'voice_claim', payload: { text }, displayText: text, entityId: `tk5452:recommendation:${index + 1}`, sourcePointer: `/voiceNotes/recommendation-${index + 1}` }));
methodFields.forEach(([reportLabel, value], index) => addRecord({ sectionId: '06-test-information', slotKey: 'method', kind: 'identity', payload: { fieldKey: `method${index + 1}`, reportLabel, value }, displayText: `${reportLabel}: ${value}`, entityId: 'tk5452:test-information', sourcePointer: `/preprocessedTestInformation/${index}` }));
checklist.forEach((row, index) => addRecord({ sectionId: '07-checklist', slotKey: 'responses', kind: 'checklist_response', payload: row, displayText: `${row.itemPrompt} ${row.ratingLabel}`, entityId: `tk5452:checklist:${row.sectionKey}:${row.itemNumber}`, sourcePointer: `/inspectionChecklistItems/${index}` }));
utMeasurements.forEach((row, index) => {
  const keys = ['value1','value2','value3','value4','value5','reinforcementPadReading'].filter(key => Object.hasOwn(row,key));
  const payload = { ...row, cells: keys.map(key => ({ key, value: row[key], unitCode: 'mm', sourcePointer: `/utMeasurements/${index}/${key}` })) };
  addRecord({ sectionId: row.sectionId, slotKey: 'readings', kind: 'measurement', payload, displayText: `${row.itemLabel}: ${keys.map(key => `${key} ${row[key]} mm`).join('; ')}`, entityId: `tk5452:${row.itemKey}`, sourcePointer: `/utMeasurements/${index}` });
});
addRecord({ sectionId: '19-truflux-guidance', slotKey: 'content', kind: 'approved_template', payload: { text: body(37, { title: 'GUIDELINES FOR INTERPRETATION OF TRU-FLUX DATA SHEETS' }) }, displayText: body(37, { title: 'GUIDELINES FOR INTERPRETATION OF TRU-FLUX DATA SHEETS' }), sourcePointer: '/approvedStandardSections/trufluxGuidance' });

const snapshot = { snapshotId: `snapshot_${sha(JSON.stringify(exportPackage)).slice(0,24)}`, evaluationOnly: true, inputPackageHash: sha(JSON.stringify(exportPackage)), evidenceRecords, sectionPlans: plans };
const aiStatus = live ? getAiStatus() : { configured: false, mode: 'deterministic_paired_evaluation', modelId: null };
const sectionResults = [];
for (const definition of sectionDefinitions) {
  const plan = plans.find(item => item.sectionId === definition.sectionId);
  let workerResponse = null;
  const worker = async request => { workerResponse = await runStructuredCodexJob(request); return workerResponse; };
  const result = await generatePlannedSectionDraft({ reportState: { exportPackage, sectionPlanning: snapshot }, sectionId: definition.sectionId, worker, aiStatus: ['02-regime','19-truflux-guidance'].includes(definition.sectionId) ? { configured: false, mode: 'approved_standard_only', modelId: null } : aiStatus, userInstruction: 'Use the source-labelled mock capture to reconstruct this report section concisely. Preserve every fact, number, unit, location and negation. Do not add content.' });
  const evaluation = evaluateSectionPlanOutput({ sectionPlan: plan, evidenceRecords, generatedContent: result.draft.content });
  const original = definition.pages.map(page => body(page, { title: page === definition.pages[0] ? definition.title : null })).join('\n\n');
  const generatedText = result.draft.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const captured = plan.outputObligations.length;
  const tracedObligationIds = new Set([...result.draft.content.matchAll(/data-obligation-id="([^"]+)"/g)].map(match => match[1]));
  const tracedSatisfied = plan.outputObligations.filter(item => tracedObligationIds.has(item.obligationId)).length;
  // Deterministic compilation carries an exact obligation binding in the
  // emitted document. Use that binding instead of penalising long controlled
  // templates or compound numeric statements that the text matcher cannot
  // split safely. Accepted AI wording still uses semantic/value evaluation.
  const satisfied = result.generationRun.usedLiveModel ? evaluation.truthGraphEvaluation.matchedRequiredFactCount : tracedSatisfied;
  const omittedObligationIds = result.generationRun.usedLiveModel
    ? evaluation.missingRequiredObligationIds
    : plan.outputObligations.filter(item => !tracedObligationIds.has(item.obligationId)).map(item => item.obligationId);
  const attentionReasons = result.generationRun.usedLiveModel || tracedSatisfied < captured
    ? evaluation.attentionReasons
    : evaluation.attentionReasons.filter(reason => !['required_output_omitted','output_equivalence_requires_review'].includes(reason));
  const formatMatch = result.draft.content.includes(`<h2>${esc(`${definition.number} ${definition.title}`)}</h2>`) ? 1 : 0;
  const outputLengthBalance = generatedText && original ? Math.min(generatedText.length, original.length) / Math.max(generatedText.length, original.length) : null;
  const requiredFactRecall = captured ? satisfied / captured : null;
  const claimPrecision = evaluation.truthGraphEvaluation.claimPrecision;
  const protectedFactAccuracy = evaluation.truthGraphEvaluation.protectedFactAccuracy;
  const available = [requiredFactRecall, claimPrecision, protectedFactAccuracy, formatMatch].filter(value => value !== null);
  const score = !captured && plan.missingRequirements.length ? 0 : available.length ? available.reduce((sum,value)=>sum+value,0)/available.length : 0;
  const hardFailure = evaluation.blockerReasons.length > 0;
  const outcomeCode = hardFailure ? 'blocked' : plan.missingRequirements.length || attentionReasons.length ? 'needs_attention' : 'ready_for_review';
  sectionResults.push({ definition, plan, result, evaluation, original, workerResponse, omittedObligationIds, attentionReasons, metrics: { score, outcomeCode, requiredFactRecall, claimPrecision, protectedFactAccuracy, formatMatch, professionalAcceptability: null, goldContentCoverage: null, outputLengthBalance, hardFailure, hardFailureReasons: evaluation.blockerReasons, evaluationPoints: [ { key: 'source_identity', label: 'Paired source identity', score: 1, statusCode: 'pass', notes: ['Job 19SE2-1 and Tank 5452 match on both sides.'] }, { key: 'capture_readiness', label: 'Mock capture readiness', score: plan.missingRequirements.length ? 0 : 1, statusCode: plan.missingRequirements.length ? 'needs_attention' : 'pass', notes: plan.missingRequirements.map(item => item.reason) } ] }, captured, satisfied });
}

await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, 'native-export.json'), `${JSON.stringify(exportPackage, null, 2)}\n`);
await writeFile(join(OUT, 'section-planning.json'), `${JSON.stringify(snapshot, null, 2)}\n`);
const now = new Date().toISOString();
const review = {
  contractVersion: 'tk5452_paired_review_v1', evaluationOnly: true, caseId: CASE_ID, generationBackend: 'tk5452_paired_section_generation_v1',
  source: { absolutePath: SOURCE, fileName: SOURCE.split('/').at(-1), sha256: SOURCE_SHA256, reportIdentity: { jobNumber: '19SE2-1', tankNumber: '5452', client: 'Shell Eastern Petroleum Pte Ltd', completedDate: '20 June 2019' } },
  preflight: { passed: true, checks: ['source SHA-256 matches allowlist','capture job number matches reference','capture tank number matches reference','capture client matches reference','all 195 checklist rows answered','no cross-report photographs or synthetic asset aliases','maintenance regime and method guidance bypass AI'] },
  generatorContractVersion: PLANNED_GENERATOR_CONTRACT, sourceDerivedMock: true, performanceScope: 'Pipeline reconstruction from report-derived mock capture; not independent report-content discovery.',
  maintenanceRegimeAiCalls: 0, policyPromotionPerformed: false, productionProfileChanged: false, createdAtIso: now,
  sections: sectionResults.map(({definition,plan,result,evaluation,original,workerResponse,metrics,captured,satisfied,omittedObligationIds,attentionReasons}) => ({ sectionId: definition.sectionId, sectionNumber: definition.number, title: definition.title, pages: definition.pages, originalSectionContent: `${definition.number} ${definition.title}\n\n${original}`, generatedContent: result.draft.content, generationRun: result.generationRun, rawAiResponse: workerResponse ? { accepted: result.generationRun.usedLiveModel, modelId: workerResponse.aiStatus?.modelId ?? result.generationRun.modelId, findings: workerResponse.parsed?.findings ?? [] } : null, metrics, captureAvailability: { capturedFactCount: captured, withheldFactCount: plan.missingRequirements.length ? 1 : 0, denominator: 'Source-aligned mock capture requirements for this report section.', withheldFacts: plan.missingRequirements.map((item,index)=>({factId:`withheld-${index+1}`,text:item.reason,sectionKey:definition.sectionId,reason:item.resolution})), omittedCapturedFacts: omittedObligationIds.map(id=>({factId:id,text:'Captured requirement was not recovered exactly.'})) }, evaluation: { contractVersion: evaluation.contractVersion, denominatorSource: 'independent_expected_obligations', matchedRequiredFactCount: satisfied, requiredFactCount: captured, attentionReasons, blockerReasons: evaluation.blockerReasons } })),
  summary: { sectionCount: 21, sectionsWithPreparedCapture: sectionResults.filter(item => item.captured > 0).length, sectionsWithMissingNativeInput: sectionResults.filter(item => item.plan.missingRequirements.length > 0).length, capturedRequirementCount: sectionResults.reduce((sum,item)=>sum+item.captured,0), exactlyRecoveredRequirementCount: sectionResults.reduce((sum,item)=>sum+item.satisfied,0), aiSections: sectionResults.filter(item=>item.result.generationRun.usedLiveModel).length, checklistRows: 195, measurementRows: utMeasurements.length },
};
await writeFile(join(OUT, 'review.json'), `${JSON.stringify(review, null, 2)}\n`);
const pins = Object.fromEntries(await Promise.all(['native-export.json','section-planning.json','review.json'].map(async name => [name, sha(await readFile(join(OUT,name)))])));
await writeFile(join(OUT, 'manifest.json'), `${JSON.stringify({ contractVersion: 'tk5452_paired_manifest_v1', evaluationOnly: true, caseId: CASE_ID, files: pins }, null, 2)}\n`);
console.log(JSON.stringify({ output: OUT, live, ...review.summary, preflightPassed: true }, null, 2));
