import assert from 'node:assert/strict';
import { buildSectionPlanningSnapshot } from '../section-planner.mjs';
const base = { inspectionId: 'voice-routing-test', inspectionChecklistItems: [{ inspectionId: 'voice-routing-test', itemNumber: 17, sectionKey: 'tank_foundation', itemPrompt: 'Floor projection', ratingKey: '2', ratingLabel: 'Satisfactory' }], voiceNotes: [{ voiceNoteId: 'v1', screenKey: 'checklist', cardKey: 'checklist_item', fieldKey: 'checklist_item_note', itemKey: 'checklist:17', transcriptStatus: 'completed', transcriptText: 'West projection has minor corrosion. Recommend recoating.' }] };
const before = JSON.stringify(base);
const snapshot = buildSectionPlanningSnapshot({ exportPackage: base });
const voices = snapshot.evidenceRecords.filter(record => record.kind === 'voice_claim');
assert.equal(voices.length, 2);
assert.equal(voices[0].contextResolution.sourcePointer, '/inspectionChecklistItems/0');
assert.deepEqual(voices[0].sourceRecord, base.voiceNotes[0]);
assert.equal(JSON.stringify(base), before);
assert(snapshot.sectionPlans.find(plan => plan.sectionId === 'inspection-report').evidenceUses.some(use => use.evidenceIds.includes(voices[0].evidenceId) && use.slotKey === 'foundation'));
assert(voices[1].quality.issues.some(issue => issue.reason === 'unconfirmed_action'));
for (const mutation of [
  { inspectionChecklistItems: [] },
  { inspectionChecklistItems: [...base.inspectionChecklistItems, ...base.inspectionChecklistItems] },
  { voiceNotes: [{ ...base.voiceNotes[0], targetKey: 'shell' }] },
]) {
  const rejected = buildSectionPlanningSnapshot({ exportPackage: { ...base, ...mutation } });
  assert(rejected.evidenceRecords.filter(record => record.kind === 'voice_claim').every(record => record.quality.issues.some(issue => issue.reason === 'unsupported_record')));
}
console.log('Checklist-local voice routing passed: source join, unchanged raw records, proposed-action review, missing/ambiguous/conflicting contexts.');
