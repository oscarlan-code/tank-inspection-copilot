import assert from 'node:assert/strict';
import { buildGenericOutlineEvaluationSnapshot, GENERIC_EVALUATION_MODULE_IDS } from '../experiments/generic-outline-evaluation.mjs';
import { generatePlannedSectionDraft } from '../planned-generation.mjs';

const fixture = () => ({
  inspectionId: 'alternative-asset-case', inspectionRecord: { client: 'Evaluation client', tankNumber: 'AUDIT-7', location: 'Evaluation yard', inspector: 'Inspector', diameterM: 8, heightM: 9 },
  utMeasurements: [
    { itemKey: 'floor:region:abc', targetKey: 'floor', itemLabel: 'ABC', itemKind: 'LAYOUT_REGION', value1: 5.8, value2: 5.7, value3: null, measured: true },
    { itemKey: 'shell:element:nz99', targetKey: 'shell', itemLabel: 'NZ99', itemKind: 'ELEMENT', elementId: 'nz99', elementTypeKey: 'nozzle', value1: 7.6, value2: 7.5, reinforcementPadReading: 8.2, measured: true },
  ],
  findings: [{ findingId: 'finding-abc', targetKey: 'floor', itemKind: 'LAYOUT_REGION', itemLabel: 'ABC', linkedUtItemKey: 'floor:region:abc', note: 'Surface pitting at ABC; native map label 88.' }],
  voiceNotes: [
    { voiceNoteId: 'unit-declaration', targetKey: 'floor', itemKey: 'floor:region:abc', itemLabel: 'ABC', transcriptStatus: 'transcribed', transcriptText: 'All entered thickness values are in millimetres. I used ultrasonic thickness gauge OTHER-UT-88 for spot measurements at the marked points.' },
    { voiceNoteId: 'action', targetKey: 'floor', itemKey: 'floor:region:abc', itemLabel: 'ABC', transcriptStatus: 'transcribed', transcriptText: 'I recommend repairing the affected area before the tank returns to service.' },
    { voiceNoteId: 'condition', targetKey: 'shell', itemKey: 'shell:region:D8', itemLabel: 'D8', transcriptStatus: 'transcribed', transcriptText: 'There is coating damage along a horizontal seam in shell region D8 on the outside.' },
    { voiceNoteId: 'negative', targetKey: 'external_roof', itemKey: 'roof:X7', itemLabel: 'X7', transcriptStatus: 'transcribed', transcriptText: 'At roof region X7, no visible corrosion was observed on the accessible upper surface.' },
    { voiceNoteId: 'closeout', screenKey: 'general_info', transcriptStatus: 'transcribed', transcriptText: 'The observations I want highlighted are pitting at ABC and coating damage at D8. The recommendations are still proposed work; I have not verified any completed repairs.' },
  ],
  inspectionChecklistItems: [
    { sectionKey: 'floor_internal', sectionTitle: 'Floor Internal', itemNumber: 11, itemPrompt: 'Floor condition', ratingKey: '2', ratingLabel: 'Requires Repair', itemNote: 'Pitting at ABC; this note belongs to this checklist row.' },
    { sectionKey: 'shell_external', sectionTitle: 'Shell External', itemNumber: 12, itemPrompt: 'Shell condition', ratingKey: 'NE', ratingLabel: 'None Evident', itemNote: 'No other defects were evident in the accessible area.' },
  ],
  layoutTargets: [{ targetKey: 'floor', inLayoutScope: true }, { targetKey: 'internal_roof', inLayoutScope: false }],
  layoutConfigs: [{ targetKey: 'floor', floorPlateCount: 4 }, { targetKey: 'internal_roof', roofRingCount: 2 }],
  attachments: [{ attachmentId: 'image1', kind: 'finding_photo', findingId: 'finding-abc', relativePath: 'photos/real.png', mediaType: 'image/png', fileExists: true, displayName: 'Real report photo' }],
});
const usesOf = (snapshot, nativeId) => snapshot.sectionPlans.flatMap(plan => plan.evidenceUses.filter(use => use.evidenceIds.some(id => snapshot.evidenceRecords.find(record => record.evidenceId === id)?.sourceRecord?.voiceNoteId === nativeId)).map(use => `${plan.sectionId}/${use.outlineSlotKey ?? use.slotKey}`));
const p = fixture(); const before = JSON.stringify(p);
const snapshot = buildGenericOutlineEvaluationSnapshot({ exportPackage: p });
assert.equal(JSON.stringify(p), before, 'normalization must not mutate native export');
assert.deepEqual(snapshot.sectionPlans.map(plan => plan.sectionId), GENERIC_EVALUATION_MODULE_IDS);
assert.equal(snapshot.evaluationOnly, true);
assert.equal(snapshot.approved, false);
assert.ok(usesOf(snapshot, 'unit-declaration').includes('thickness/basis'));
assert.ok(usesOf(snapshot, 'unit-declaration').includes('methods/equipment'));
assert.ok(!usesOf(snapshot, 'unit-declaration').includes('findings/condition'), 'UT-screen capture must not turn method or unit metadata into a condition');
assert.ok(usesOf(snapshot, 'action').includes('recommendations/actions'));
assert.ok(usesOf(snapshot, 'condition').includes('findings/condition'), 'outside shell wording is sufficient for generic component findings');
assert.ok(usesOf(snapshot, 'negative').includes('findings/condition'));
assert.ok(usesOf(snapshot, 'closeout').includes('summary/results'));
assert.ok(!usesOf(snapshot, 'closeout').includes('identity/inspection'), 'capture screen alone must not classify closeout as identity');
assert.equal(snapshot.evidenceRecords.find(r => r.sourceRecord?.voiceNoteId === 'action').candidateActionStatus, 'captured_inspector_proposal_not_approved');
assert.ok(snapshot.evidenceRecords.filter(r => r.kind === 'measurement').every(r => r.payload.unitCode === 'mm' && r.payload.unitReviewRequired && r.payload.cells.every(c => c.sourceUnitCode === null)));
assert.ok(snapshot.transformationLedger.filter(e => e.kind === 'candidate_unit_resolution').every(e => e.requiresReview && e.mutatesImportedExport === false));
assert.deepEqual(snapshot.sectionPlans.find(p => p.sectionId === 'thickness').blocks.filter(b => b.outlineSlotKey === 'readings').map(b => b.slotKey), ['readings-floor', 'readings-shell-nozzle']);
assert.ok(snapshot.sectionPlans.find(p => p.sectionId === 'findings').evidenceUses.some(use => use.evidenceIds.some(id => snapshot.evidenceRecords.find(r => r.evidenceId === id)?.sourceRef.pointer.startsWith('/findings/'))), 'a native finding mentioning its map label must remain a finding');
assert.ok(!snapshot.sectionPlans.flatMap(p => p.evidenceUses).some(use => use.evidenceIds.some(id => snapshot.evidenceRecords.find(r => r.evidenceId === id)?.sourceRef.pointer.match(/^\/inspectionChecklistItems\/\d+\/itemNote/))), 'checklist row notes must not be emitted again as a narrative appendix');
assert.equal(snapshot.sectionPlans.find(p => p.sectionId === 'regime').evidenceUses.length, 0);
assert.equal(snapshot.sectionPlans.find(p => p.sectionId === 'regime').generationPolicy.aiAllowed, false);
assert.ok(snapshot.sectionPlans.find(p => p.sectionId === 'regime').missingRequirements.every(r => r.resolution === 'approved_template_selection'));
assert.equal(snapshot.sectionPlans.find(p => p.sectionId === 'layout').evidenceUses.length, 1, 'inactive internal roof default must not enter layout');

// Equivalent text with arbitrary voice IDs must have identical destinations.
const renamed = fixture(); renamed.voiceNotes.forEach((v, i) => { v.voiceNoteId = `unrelated-id-${i}`; });
const renameSnapshot = buildGenericOutlineEvaluationSnapshot({ exportPackage: renamed });
for (let i = 0; i < p.voiceNotes.length; i++) assert.deepEqual(usesOf(snapshot, p.voiceNotes[i].voiceNoteId), usesOf(renameSnapshot, renamed.voiceNotes[i].voiceNoteId));

// Local unit mentions and contradictory inspection-wide declarations cannot
// silently resolve an unspecified unit on all imported measurement rows.
const local = fixture(); local.voiceNotes[0].transcriptText = 'This floor reading is in millimetres.';
const localSnapshot = buildGenericOutlineEvaluationSnapshot({ exportPackage: local });
assert.ok(localSnapshot.evidenceRecords.filter(r => r.kind === 'measurement').every(r => r.payload.unitCode === null && r.quality.issues.some(i => i.reason === 'unknown_unit')));
const conflict = fixture(); conflict.voiceNotes.push({ voiceNoteId: 'conflict', transcriptStatus: 'transcribed', transcriptText: 'All entered thickness values are in inches.' });
assert.ok(buildGenericOutlineEvaluationSnapshot({ exportPackage: conflict }).evidenceRecords.filter(r => r.kind === 'measurement').every(r => r.payload.unitCode === null && r.quality.issues.some(i => i.reason === 'conflicting_unit')));
const unverified = fixture(); unverified.voiceNotes[0].transcriptStatus = 'pending_server';
assert.ok(buildGenericOutlineEvaluationSnapshot({ exportPackage: unverified }).evidenceRecords.filter(r => r.kind === 'measurement').every(r => r.payload.unitCode === null));

// Missing entities, malformed measurements and hidden source records remain
// unresolved; candidate routing cannot clear source-integrity safeguards.
const unsafe = fixture(); unsafe.utMeasurements[0].value1 = 0;
unsafe.captureFacts = [{ factId: 'hidden', sourceRole: 'gold_derived_synthetic_capture', value: 'Hidden historical answer must not enter the candidate.' }];
const unsafeSnapshot = buildGenericOutlineEvaluationSnapshot({ exportPackage: unsafe });
assert.ok(unsafeSnapshot.evidenceRecords.some(r => r.kind === 'measurement' && r.quality.issues.some(i => i.reason === 'unsupported_record')));
assert.ok(unsafeSnapshot.evidenceRecords.some(r => r.quality.issues.some(i => i.reason === 'hidden_source')));

const provenance = { sourcePhotos: { photos: [{ photoId: 'PHOTO-A', file: 'real.png', sourceReport: '/reference/Actual report.pdf', sourcePage: 19, sourcePhotoNumber: 4, condition: 'Surface pitting', syntheticLocationAlias: 'ABC' }] } };
const photoSnapshot = buildGenericOutlineEvaluationSnapshot({ exportPackage: fixture(), provenance });
assert.equal(photoSnapshot.sectionPlans.find(p => p.sectionId === 'references').evidenceUses.length, 1);
assert.ok(photoSnapshot.evidenceRecords.some(r => r.displayText.includes('no same-asset historical correspondence')));
assert.equal(photoSnapshot.sectionPlans.find(p => p.sectionId === 'identity').evidenceUses.filter(u => u.slotKey === 'history').length, 0);

// The shared compiler consumes this snapshot; no private formatter or model
// prompt is used, and structured/standard-template sections cannot invoke AI.
let workerCalls = 0;
const worker = async () => { workerCalls += 1; throw new Error('audit must remain local'); };
for (const sectionId of ['thickness', 'checklist', 'regime', 'findings', 'recommendations']) {
  const result = await generatePlannedSectionDraft({ reportState: { sectionPlanning: snapshot }, sectionId, worker, aiStatus: { configured: false } });
  assert.equal(result.generationRun.usedLiveModel, false);
  if (sectionId === 'thickness') { assert.match(result.draft.content, /5\.8 mm/); assert.match(result.draft.content, /8\.2 mm/); assert.match(result.draft.content, /Not recorded/); }
  if (sectionId === 'checklist') assert.equal(result.draft.content.match(/this note belongs to this checklist row/g)?.length, 1);
  if (sectionId === 'findings') assert.match(result.draft.content, /no visible corrosion/);
  if (sectionId === 'recommendations') assert.match(result.draft.content, /I recommend repairing/);
}
assert.equal(workerCalls, 0);
assert.throws(() => buildGenericOutlineEvaluationSnapshot({ exportPackage: fixture(), selectedModuleIds: ['unknown'] }), /Unknown generic module/);
console.log('Generic-outline evaluation audit passed: semantic routing, preserved native values, unit ambiguity, source integrity, proposed-action status, no-AI regime, real-photo citations and shared compilation.');
