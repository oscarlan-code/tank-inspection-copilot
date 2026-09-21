import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { API_STANDARD_REPORT_TOC } from '../report-toc.mjs';
import { canUseEvidence, getSectionContract, matchSectionEvidenceRules, REPORT_SECTION_CONTRACTS } from '../section-contracts.mjs';
import { buildSectionPlanningSnapshot, getSectionEvidence, validateSectionDecision } from '../section-planner.mjs';
import { createSectionPlanningStore } from '../section-planning-store.mjs';

const fixture = JSON.parse(readFileSync(new URL('../../src/fixtures/v3-product-export-shell-internal.json', import.meta.url), 'utf8'));
const original = JSON.stringify(fixture);
const native = buildSectionPlanningSnapshot({ exportPackage: fixture });
assert.equal(JSON.stringify(fixture), original, 'Planning cannot mutate original app records');
assert.deepEqual(REPORT_SECTION_CONTRACTS.map((entry) => entry.sectionId), API_STANDARD_REPORT_TOC.map((entry) => entry.id));
assert.equal(native.sectionPlans.length, 32);
assert.equal(native.evidenceRecords.filter((record) => record.kind === 'measurement').length, 140, 'Every native UT row survives even when its unit is unresolved');
assert.equal(native.evidenceRecords.filter((record) => record.kind === 'checklist_response').length, 195);
assert.ok(native.unresolvedEvidence.some((entry) => entry.reason === 'unknown_unit'), 'Absent native unit is not silently assigned millimetres');
assert.ok(native.unresolvedEvidence.some((entry) => entry.reason === 'conflicting_value'), 'Conflicting duplicated tank identity is visible');
const firstMeasurement = native.evidenceRecords.find((record) => record.kind === 'measurement');
assert.deepEqual(firstMeasurement.payload.cells.map((cell) => cell.value), ['value1', 'value2', 'value3', 'value4', 'value5', 'reinforcementPadReading'].map((key) => fixture.utMeasurements[0][key]));
assert.equal(firstMeasurement.sourceRef.pointer, '/utMeasurements/0');
assert.equal(buildSectionPlanningSnapshot({ exportPackage: fixture }).snapshotId, native.snapshotId, 'Identical pinned inputs are reproducible');

const base = {
  packageType: 'v3_product_export', schemaVersion: 3, inspectionId: 'inspection-test',
  inspectionRecord: { client: 'Client', tankNumber: 'T1', location: 'Site' },
  unitProfile: { thicknessUnit: 'INCH' },
  utMeasurements: [{ itemKey: 'external_roof:plate:1', itemLabel: 'Roof plate 1', targetKey: 'external_roof', itemKind: 'region', plateId: '1', measured: true, confirmed: true, value1: '0.250', value2: null }],
  findings: [{ findingId: 'floor-condition', targetKey: 'floor', itemLabel: 'Floor plate A', note: 'Floor coating is damaged.' }],
  voiceNotes: [],
};
const noVoice = buildSectionPlanningSnapshot({ exportPackage: base });
const roof = getSectionEvidence(noVoice, 'roof-plate-thickness-measurements');
assert.equal(roof.requiredStructured[0].payload.cells[0].unitCode, 'in', 'Export unit profile is honored, including inch units');
assert.equal(roof.requiredStructured[0].payload.cells[0].value, '0.250', 'Exact input decimal precision is retained');
assert.equal(roof.requiredStructured[0].payload.cells[1].value, null, 'An unmeasured blank remains distinct from zero');
assert.equal(roof.plan.status, 'blocked', 'Available rows do not replace section-scope review');
assert.equal(roof.plan.scopeReviewRequired, true);
const roofScope = { kind: 'section_scope', sectionId: 'roof-plate-thickness-measurements', applicability: 'applicable', applicableSlotKeys: ['measurements'], reason: 'Roof UT table is required for the reviewed inspection scope.' };
const scopedRoof = getSectionEvidence(buildSectionPlanningSnapshot({ exportPackage: base, decisions: [roofScope] }), 'roof-plate-thickness-measurements');
assert.equal(scopedRoof.plan.status, 'ready');
assert.equal(scopedRoof.plan.scopeReviewRequired, false);
assert.throws(() => validateSectionDecision(noVoice, { ...roofScope, applicability: 'not_applicable', applicableSlotKeys: [] }), /cannot be marked not applicable/);
assert.throws(() => validateSectionDecision(noVoice, { ...roofScope, applicableSlotKeys: ['basis'] }), /every block/);
assert.throws(() => validateSectionDecision(noVoice, { ...roofScope, applicableSlotKeys: ['does-not-exist'] }), /canonical section slots/);
const incompleteScope = getSectionEvidence(buildSectionPlanningSnapshot({ exportPackage: base, decisions: [{ ...roofScope, applicableSlotKeys: ['basis', 'measurements'] }] }), 'roof-plate-thickness-measurements');
assert.ok(incompleteScope.plan.missingRequirements.some((requirement) => requirement.requirementId.endsWith('basis:missing-content')));
assert.equal(incompleteScope.plan.status, 'blocked');
const excludedMfl = getSectionEvidence(buildSectionPlanningSnapshot({ exportPackage: base, decisions: [{ kind: 'section_scope', sectionId: 'magnetic-flux-leakage-platemaps', applicability: 'not_applicable', applicableSlotKeys: [], reason: 'MFL examination was excluded from the agreed scope.' }] }), 'magnetic-flux-leakage-platemaps');
assert.equal(excludedMfl.plan.status, 'not_applicable');
const inspection = getSectionEvidence(noVoice, 'inspection-report');
assert.equal(inspection.requiredNarrative.length, 1, 'Structured finding remains required with zero voice notes');
assert.equal(inspection.plan.blocks[0].composition, 'deterministic');
assert.equal(inspection.voiceNotes.length, 0);
assert.equal(inspection.supporting.length, 1, 'Measurement supports inspection narrative without becoming appended output');
assert.equal(inspection.plan.outputObligations.length, 1, 'Supporting UT cells do not inflate narrative recovery denominator');
assert.equal(getSectionEvidence(noVoice, 'magnetic-flux-leakage-platemaps').plan.applicability.state, 'unconfirmed', 'No data does not establish not applicable');

const mixed = buildSectionPlanningSnapshot({ exportPackage: { ...base, findings: [], voiceNotes: [{ voiceNoteId: 'mixed', targetKey: 'floor', screenKey: 'ut_measurement', transcriptStatus: 'transcribed', transcriptText: 'Floor coating is damaged; recommend repair.' }] } });
assert.equal(getSectionEvidence(mixed, 'inspection-report').requiredNarrative[0].payload.text, 'Floor coating is damaged');
const action = mixed.evidenceRecords.find((record) => record.payload.text === 'recommend repair.');
assert.ok(action);
assert.equal(getSectionEvidence(mixed, 'repair-recommendations').supporting[0].evidenceId, action.evidenceId);
assert.equal(getSectionEvidence(mixed, 'repair-recommendations').requiredNarrative.length, 0, 'Proposed recommendation is not an approved action');
assert.deepEqual(action.payload.sourceSpan, { start: 26, end: 43 });
assert.equal(action.sourceRecord.transcriptText.slice(action.payload.sourceSpan.start, action.payload.sourceSpan.end), action.payload.text, 'Every split retains exact original transcript span');
const decision = { evidenceId: action.evidenceId, sectionId: 'repair-recommendations', slotKey: 'recommendations', role: 'required_narrative', reason: 'Inspector confirms this repair action.' };
validateSectionDecision(mixed, decision);
const reviewed = buildSectionPlanningSnapshot({ exportPackage: { ...base, findings: [], voiceNotes: [{ voiceNoteId: 'mixed', targetKey: 'floor', screenKey: 'ut_measurement', transcriptStatus: 'transcribed', transcriptText: 'Floor coating is damaged; recommend repair.' }] }, decisions: [decision] });
assert.equal(getSectionEvidence(reviewed, 'repair-recommendations').requiredNarrative.length, 1);
assert.notEqual(reviewed.snapshotId, mixed.snapshotId, 'Review creates a new derived snapshot');

const unknownShell = buildSectionPlanningSnapshot({ exportPackage: { ...base, findings: [{ findingId: 'shell-condition', targetKey: 'shell', note: 'Coating damaged.' }] } });
assert.ok(unknownShell.unresolvedEvidence.some((entry) => entry.reason === 'ambiguous_scope'));
assert.equal(getSectionEvidence(unknownShell, 'inspection-report').requiredNarrative.length, 0, 'Shell target alone cannot choose internal or external');
const repeated = buildSectionPlanningSnapshot({ exportPackage: { ...base, findings: [{ findingId: 'a', targetKey: 'floor', itemKey: 'floor:a', note: 'Coating damaged.' }, { findingId: 'b', targetKey: 'floor', itemKey: 'floor:b', note: 'Coating damaged.' }] } });
assert.equal(getSectionEvidence(repeated, 'inspection-report').requiredNarrative.length, 2, 'Same words on separate components are separate observations');

const legacyPackage = { ...base, captureFacts: [{ factId: 'old-table', targetReportSectionId: 'inspection-report', value: { text: 'Point | thickness\nA | 6.0' } }, { factId: 'answer', targetReportSectionId: 'inspection-report', value: { text: 'Original report says repair floor.' }, syntheticEvidenceDerivedFromGold: true }] };
const legacy = buildSectionPlanningSnapshot({ exportPackage: legacyPackage });
assert.equal(getSectionEvidence(legacy, 'inspection-report').requiredNarrative.length, 1, 'Legacy target hints cannot add unrelated table/answer text');
assert.equal(legacy.evidenceRecords.filter((record) => record.kind === 'legacy_capture').length, 2, 'Unusable legacy evidence is retained for review');
const exposed = legacy.evidenceRecords.find((record) => record.sourceRef.nativeRecordId === 'answer');
assert.throws(() => validateSectionDecision(legacy, { evidenceId: exposed.evidenceId, sectionId: 'inspection-report', slotKey: 'floor-internal', role: 'required_narrative', reason: 'Accept answer' }), /Answer-derived/);
const nestedGold = buildSectionPlanningSnapshot({ exportPackage: { ...base, captureFacts: [{ factId: 'nested-answer', value: { text: 'The historical repair recommendation.', sourceRole: 'gold_derived_synthetic_capture' } }] } });
const nestedAnswer = nestedGold.evidenceRecords.find((record) => record.sourceRef.nativeRecordId === 'nested-answer');
assert.ok(nestedAnswer.quality.issues.some((entry) => entry.reason === 'hidden_source'));
assert.throws(() => validateSectionDecision(nestedGold, { evidenceId: nestedAnswer.evidenceId, sectionId: 'repair-recommendations', slotKey: 'recommendations', role: 'required_narrative', reason: 'Relabel answer as captured' }), /Answer-derived/);
assert.throws(() => validateSectionDecision(noVoice, { evidenceId: roof.requiredStructured[0].evidenceId, sectionId: 'inspection-report', slotKey: 'roof-external', role: 'required_narrative', reason: 'Put raw rows into narrative' }), /cannot be relabelled/);
assert.throws(() => validateSectionDecision(noVoice, { ...decision, evidenceId: 'different-snapshot' }), /does not belong/);

const unitDecision = { evidenceId: firstMeasurement.evidenceId, sectionId: 'roof-plate-thickness-measurements', slotKey: 'measurements', role: 'required_structured', unitCode: 'mm', reason: 'Inspector confirms this record was captured in millimetres.' };
const unitsReviewed = buildSectionPlanningSnapshot({ exportPackage: fixture, decisions: [unitDecision] });
const resolved = unitsReviewed.evidenceRecords.find((record) => record.evidenceId === firstMeasurement.evidenceId);
assert.equal(resolved.payload.cells[0].unitCode, 'mm');
assert.equal(resolved.payload.cells[0].sourceUnitCode, null, 'Review records original unresolved unit');
assert.equal(resolved.sourceRecord.unitCode, undefined, 'Unit review does not mutate source data');
assert.equal(resolved.quality.issues.some((entry) => entry.reason === 'unknown_unit'), false);
const roofMap = getSectionEvidence(native, 'roof-plate-layout');
assert.ok(roofMap.requiredStructured[0].displayText.length > 0, 'Native geometry has a readable review label');
assert.equal(roofMap.plan.outputObligations[0].expected.artifact.kind, 'geometry');
assert.equal(roofMap.plan.outputObligations[0].expected.artifact.renderedOutsideHtml, true);
assert.match(roofMap.plan.outputObligations[0].expected.artifact.sourceHash, /^[a-f0-9]{64}$/);
assert.equal(roofMap.plan.outputObligations[0].expected.text, undefined, 'Artifact fidelity is not measured by matching a heading');
const withManual = buildSectionPlanningSnapshot({ exportPackage: base, manualInputs: { engineeringImplication: 'Localized coating repair requires inspection review.' } });
assert.ok(getSectionEvidence(withManual, 'inspection-report').requiredNarrative.some((record) => record.sourceClass === 'manual_confirmation'));
assert.ok(getSectionContract('inspection-report').slots.some((slot) => slot.slotKey === 'assessment-summaries'));

const sharedKeys=buildSectionPlanningSnapshot({exportPackage:{inspectionId:'shared-keys',unitProfile:{thicknessUnit:'MM'},utMeasurements:[
  {targetKey:'shell',itemKey:'P1',itemLabel:'Shell plate P1',value1:6.1},
  {targetKey:'external_roof',itemKey:'P1',itemLabel:'Roof plate P1',value1:4.2},
],findings:[{findingId:'shared-key-finding',targetKey:'shell',linkedUtItemKey:'P1',note:'External shell P1 has local corrosion.'}]}});
const sharedMeasurements=sharedKeys.evidenceRecords.filter(r=>r.kind==='measurement');
assert.equal(new Set(sharedMeasurements.map(r=>r.evidenceId)).size,2,'Native keys may repeat across physical targets');
assert.ok(sharedMeasurements.every(r=>!r.quality.issues.some(i=>i.reason==='conflicting_value')));
const linkedFinding=sharedKeys.evidenceRecords.find(r=>r.kind==='observation');
assert.equal(linkedFinding.payload.value1,6.1,'Finding linkage cannot borrow the same key from the roof');

for (const contract of REPORT_SECTION_CONTRACTS) {
  assert.ok(contract.templateKey && contract.templateSource, 'Every section retains its report-template lineage');
  for (const slot of contract.slots) {
    assert.ok(slot.title && slot.purpose && slot.presentation.renderer === slot.type, 'Every outline block declares its reader-facing purpose and presentation');
    assert.ok(Array.isArray(slot.evidenceRules));
    for (const rule of slot.evidenceRules) {
      for (const kind of [rule.match.kind].flat()) assert.ok(canUseEvidence(slot, kind, rule.role), `Catalog rule ${rule.ruleId} must be compatible with its block`);
    }
  }
}
const identityMatches = matchSectionEvidenceRules({ kind: 'identity', fieldKey: 'client' });
assert.equal(identityMatches.length, 2, 'One fact matches both identity and supporting scope rules in the catalog');
assert.ok(identityMatches.every((match) => match.ruleId.startsWith('outline-v2:')));
for (const plan of noVoice.sectionPlans) for (const use of plan.evidenceUses) {
  const record = noVoice.evidenceRecords.find((entry) => entry.evidenceId === use.evidenceIds[0]);
  assert.ok(matchSectionEvidenceRules(record.classificationFacts).some((rule) => rule.sectionId === plan.sectionId && rule.slotKey === use.slotKey && rule.role === use.role && rule.ruleId === use.decision.ruleOrReviewId), 'Every automatic use is derived from a visible outline rule');
}
assert.match(noVoice.outlineCatalogHash, /^[a-f0-9]{64}$/, 'Snapshot pins the complete executable outline catalog');
assert.deepEqual(getSectionContract('tank-inspection-checklist').slots.find((slot) => slot.slotKey === 'checklist').presentation.responseColumns, ['1', '2', '3', '4', 'IA', 'NE', 'N/A']);
assert.equal(getSectionContract('roof-plate-thickness-measurements').slots.find((slot) => slot.slotKey === 'measurements').presentation.measurementColumns.some((column) => column.key === 'reinforcementPadReading'), false, 'Plate outline does not request a nozzle-only column');
assert.equal(getSectionContract('shell-nozzle-reinforcement-pad-thickness-measurements').slots.find((slot) => slot.slotKey === 'measurements').presentation.measurementColumns.some((column) => column.key === 'reinforcementPadReading'), true, 'Nozzle outline declares its reinforcement-pad measurement column');
const structuredReuse = { operation: 'add', evidenceId: roof.requiredStructured[0].evidenceId, reason: 'Reviewer confirmed the evidence purpose.' };
for (const [sectionId, slotKey] of [['test-information', 'results'], ['shell-settlement-survey-results-external', 'stations']]) {
  assert.throws(() => validateSectionDecision(noVoice, { ...structuredReuse, sectionId, slotKey, role: 'required_structured' }), /not eligible/, 'A UT row cannot substitute for narrative results or survey station data');
  assert.equal(validateSectionDecision(noVoice, { ...structuredReuse, sectionId, slotKey, role: 'supporting' }).role, 'supporting', 'The same UT evidence remains available as context');
}
const unadaptedCapture = legacy.evidenceRecords.find((record) => record.sourceRef.nativeRecordId === 'old-table');
assert.throws(() => validateSectionDecision(legacy, { operation: 'add', evidenceId: unadaptedCapture.evidenceId, sectionId: 'roof-plate-thickness-measurements', slotKey: 'measurements', role: 'required_structured', reason: 'Legacy text is not a native UT row.' }), /not eligible/);
assert.equal(canUseEvidence(getSectionContract('test-information').slots.find((slot) => slot.slotKey === 'results'), 'calculation_result', 'required_structured'), false, 'Calculation objects cannot be flattened into a narrative result list');
assert.equal(canUseEvidence(getSectionContract('test-information').slots.find((slot) => slot.slotKey === 'results'), 'calculation_result', 'supporting'), true);
assert.equal(getSectionContract('shell-settlement-survey-results-external').slots.find((slot) => slot.slotKey === 'stations').adapterStatus, 'pending_native_survey_adapter');

const identityRecord = noVoice.evidenceRecords.find((record) => record.payload.fieldKey === 'client');
const identitySource = JSON.stringify(identityRecord.sourceRecord);
const otherUses = noVoice.sectionPlans.flatMap((plan) => plan.evidenceUses).filter((use) => !use.evidenceIds.includes(identityRecord.evidenceId));
const reviewDecisions = [];
let edited = noVoice;
const usesForIdentity = () => edited.sectionPlans.flatMap((plan) => plan.evidenceUses).filter((use) => use.evidenceIds.includes(identityRecord.evidenceId));
function decide(input) {
  const validated = validateSectionDecision(edited, { evidenceId: identityRecord.evidenceId, reason: 'Inspector reviewed the evidence destination.', ...input });
  reviewDecisions.push({ ...validated, decisionId: `audit-decision-${reviewDecisions.length}`, actorId: 'authenticated-audit-inspector' });
  edited = buildSectionPlanningSnapshot({ exportPackage: base, decisions: reviewDecisions });
  assert.equal(JSON.stringify(edited.evidenceRecords.find((record) => record.evidenceId === identityRecord.evidenceId).sourceRecord), identitySource, 'Destination changes cannot alter source evidence');
  assert.deepEqual(edited.sectionPlans.flatMap((plan) => plan.evidenceUses).filter((use) => !use.evidenceIds.includes(identityRecord.evidenceId)), otherUses, 'Destination changes leave other records untouched');
  assert.equal(new Set(edited.sectionPlans.flatMap((plan) => plan.evidenceUses).map((use) => use.useId)).size, edited.sectionPlans.flatMap((plan) => plan.evidenceUses).length, 'Use identities remain unique across moves and subsequent additions');
}
const originalUses = usesForIdentity();
decide({ operation: 'add', sectionId: 'general-tank-information', slotKey: 'configuration', role: 'required_structured' });
assert.equal(usesForIdentity().filter((use) => use.sectionId === 'general-tank-information').length, 2, 'Adding a block preserves another use in the same section');
assert.ok(originalUses.every((originalUse) => usesForIdentity().some((use) => use.useId === originalUse.useId)));
assert.throws(() => validateSectionDecision(edited, { operation: 'add', evidenceId: identityRecord.evidenceId, sectionId: 'general-tank-information', slotKey: 'configuration', role: 'required_structured', reason: 'Duplicate destination' }), /already has the same destination/);
const addedUse = usesForIdentity().find((use) => use.slotKey === 'configuration');
decide({ operation: 'update', useId: addedUse.useId, sectionId: 'scope-of-inspection', slotKey: 'identity', role: 'required_structured' });
assert.equal(usesForIdentity().length, 3);
assert.equal(usesForIdentity().find((use) => use.useId === addedUse.useId).sectionId, 'scope-of-inspection', 'Moving one use keeps its stable identity');
assert.ok(originalUses.every((originalUse) => usesForIdentity().some((use) => use.useId === originalUse.useId)), 'Moving a use across sections preserves all other destinations');
assert.throws(() => validateSectionDecision(edited, { operation: 'update', evidenceId: identityRecord.evidenceId, useId: originalUses[0].useId, sectionId: 'scope-of-inspection', slotKey: 'identity', role: 'required_structured', reason: 'Duplicate moved destination' }), /already has the same destination/);
assert.throws(() => validateSectionDecision(edited, { operation: 'update', evidenceId: identityRecord.evidenceId, sectionId: 'scope-of-inspection', slotKey: 'identity', role: 'supporting', reason: 'Missing target use' }), /requires its useId/);
assert.throws(() => validateSectionDecision(edited, { operation: 'remove', evidenceId: identityRecord.evidenceId, useId: 'use-does-not-exist', reason: 'Unknown destination' }), /does not belong/);
assert.throws(() => validateSectionDecision(edited, { operation: 'remove', evidenceId: roof.requiredStructured[0].evidenceId, useId: addedUse.useId, reason: 'Wrong source record' }), /does not belong/);
assert.throws(() => validateSectionDecision(edited, { operation: 'remove', evidenceId: identityRecord.evidenceId, useId: addedUse.useId, unitCode: 'mm', reason: 'Mutate while removing' }), /accepts useId only/);
assert.throws(() => validateSectionDecision(edited, { operation: 'add', evidenceId: identityRecord.evidenceId, sectionId: 'tank-inspection-checklist', slotKey: 'checklist', role: 'supporting', reason: 'Incompatible table record' }), /not eligible/);
decide({ operation: 'remove', useId: addedUse.useId });
assert.deepEqual(usesForIdentity(), originalUses, 'Removing a moved use restores the original independent uses');

// A moved automatic use retains its ID. Re-adding its old destination must get
// a different ID, so later edits cannot hit both destinations.
decide({ operation: 'update', useId: originalUses[0].useId, sectionId: 'general-tank-information', slotKey: 'configuration', role: 'supporting' });
decide({ operation: 'add', sectionId: originalUses[0].sectionId, slotKey: originalUses[0].slotKey, role: originalUses[0].role });
assert.equal(usesForIdentity().length, 3);
for (const use of [...usesForIdentity()]) decide({ operation: 'remove', useId: use.useId });
assert.equal(usesForIdentity().length, 0);
assert.ok(edited.evidenceRecords.some((record) => record.evidenceId === identityRecord.evidenceId), 'Removing the last use does not remove its source');
assert.ok(edited.unresolvedEvidence.some((entry) => entry.evidenceId === identityRecord.evidenceId && entry.reason === 'unassigned'), 'Last-use removal stays visible in the review queue');
decide({ operation: 'add', sectionId: 'general-tank-information', slotKey: 'identity', role: 'required_structured' });
assert.equal(edited.unresolvedEvidence.some((entry) => entry.evidenceId === identityRecord.evidenceId && entry.reason === 'unassigned'), false, 'A valid new destination resolves the unassigned issue');
assert.equal(buildSectionPlanningSnapshot({ exportPackage: base, decisions: reviewDecisions }).snapshotId, edited.snapshotId, 'Operation replay is deterministic');

// Preserve the old event semantics for already-persisted decisions without an
// operation field; modern edits must not reinterpret old history as additions.
const oldDecision = { evidenceId: identityRecord.evidenceId, sectionId: 'general-tank-information', slotKey: 'history', role: 'supporting', reason: 'Previously persisted destination review.' };
const legacyReplay = buildSectionPlanningSnapshot({ exportPackage: base, decisions: [oldDecision] });
assert.equal(legacyReplay.sectionPlans.find((plan) => plan.sectionId === 'general-tank-information').evidenceUses.filter((use) => use.evidenceIds.includes(identityRecord.evidenceId)).length, 1);
assert.equal(legacyReplay.sectionPlans.find((plan) => plan.sectionId === 'scope-of-inspection').evidenceUses.filter((use) => use.evidenceIds.includes(identityRecord.evidenceId)).length, 1);
const legacySupportingDecision = { ...oldDecision, sectionId: 'tank-inspection-checklist', slotKey: 'checklist' };
assert.equal(buildSectionPlanningSnapshot({ exportPackage: base, decisions: [legacySupportingDecision] }).sectionPlans.find((plan) => plan.sectionId === 'tank-inspection-checklist').evidenceUses.length, 1, 'Persisted pre-v2 supporting decisions retain their earlier broad compatibility');
assert.throws(() => validateSectionDecision(noVoice, { ...legacySupportingDecision, operation: 'add' }), /not eligible/, 'New operations enforce current outline compatibility');

const persistenceCalls = [];
const planningStore = createSectionPlanningStore({ db: { prepare(sql) { return { async run() { persistenceCalls.push(sql); return { rowCount: 1 }; } }; } }, createError: (status, message, code) => Object.assign(new Error(message), { status, code }) });
const evaluationState = { reportJob: { reportJobId: 'eval-report', tenantId: 'eval-tenant', workspaceId: 'eval-workspace', sourceRevision: { importId: 'eval-import' }, manualInputsRevision: 0 }, evaluationContext: { mode: 'outline_evaluation' } };
await planningStore.persist(evaluationState, noVoice);
assert.ok(persistenceCalls.some((sql) => sql.startsWith('INSERT INTO report_section_plan_snapshots')));
assert.equal(persistenceCalls.some((sql) => sql.startsWith('UPDATE report_jobs')), false, 'Candidate evaluation snapshots never replace a production report plan');
const callsBeforeLegacySubmission = persistenceCalls.length;
await assert.rejects(planningStore.decide(evaluationState, { actorUserId: 'authenticated-reviewer', expectedSnapshotId: noVoice.snapshotId, decision: legacySupportingDecision }), (error) => error.status === 400 && error.code === 'section_decision_invalid', 'A fresh request cannot invoke persisted-event compatibility by omitting its operation');
assert.equal(persistenceCalls.length, callsBeforeLegacySubmission, 'An operationless request is rejected before persistence');
console.log('Section planner audit passed: 32 executable outlines, catalog-driven labels, exact multi-use editing, immutable sources, explicit units, retained unassigned evidence, deterministic replay and evaluation-only snapshot persistence.');
