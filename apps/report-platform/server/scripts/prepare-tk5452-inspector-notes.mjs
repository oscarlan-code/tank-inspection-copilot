#!/usr/bin/env node
// Evaluation preparation only. Does not import, generate, score or promote.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INSPECTOR_NOTE_EVENTS } from '../experiments/tk5452-inspector-notes-v2.mjs';
import { prepareShellMeasurements, checkShellMeasurementCoverage } from '../experiments/tk5452-shell-measurements.mjs';
import { buildSectionPlanningSnapshot } from '../section-planner.mjs';
import { validateAndroidV3ProductExport } from '../store.mjs';

if (process.argv.length > 2) throw new Error('Preparation takes no flags and never runs an AI worker.');
const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const before = join(project, 'docs/reviews/data/tk5452-paired-v1');
const out = join(project, 'docs/reviews/data/tk5452-inspector-notes-v2');
const hash = value => createHash('sha256').update(value).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const stringify = value => `${JSON.stringify(value, null, 2)}\n`;
// A drawing identifier or decimal reading is one token, not several prose
// words. Retaining these protected facts must not itself trip the wording gate.
const normalize = value => (String(value).toLowerCase()
  .replace(/\birs\/se\/[a-z0-9-]+\b/g, id => id.replace(/[/-]/g, '_'))
  .match(/[\p{L}\p{N}_]+(?:\.\d+)?/gu) ?? []).join(' ');
const numbers = value => [...String(value).matchAll(/\d+(?:\.\d+)?/g)].map(match => match[0]);
const bytes = Object.fromEntries(await Promise.all(['native-export.json', 'section-planning.json', 'review.json', 'manifest.json'].map(async name => [name, await readFile(join(before, name))])));
const original = JSON.parse(bytes['native-export.json']);
const originalPlan = JSON.parse(bytes['section-planning.json']);
const originalReview = JSON.parse(bytes['review.json']);
const manifest = JSON.parse(bytes['manifest.json']);
for (const [name, sha] of Object.entries(manifest.files)) assert.equal(hash(bytes[name]), sha);
const sourceById = new Map(original.voiceNotes.map(note => [note.voiceNoteId, note]));
const claims = INSPECTOR_NOTE_EVENTS.flatMap(event => event.claims.map(claim => ({ ...claim, eventId: event.id })));
assert.equal(new Set(claims.map(claim => claim.sourceId)).size, claims.length, 'A source entry is duplicated');
assert.deepEqual(new Set(claims.map(claim => claim.sourceId)), new Set(sourceById.keys()), 'Every prior source entry needs a note or an explicit withholding decision');

// Full-sentence and long-phrase copy checks. This is a wording gate, not a
// semantic quality score. Technical terms and raw numeric facts may recur.
function copiedWording(texts) {
  const issues = [];
  for (const [inputId, text] of texts) {
    const words = normalize(text).split(' ');
    const padded = ` ${words.join(' ')} `;
    for (const source of sourceById.values()) {
      const sourceWords = normalize(source.transcriptText).split(' ');
      if (padded.includes(` ${sourceWords.join(' ')} `)) issues.push({ inputId, sourceId: source.voiceNoteId, reason: 'complete_source_entry' });
      for (let i = 0; i <= sourceWords.length - 9; i++) {
        const phrase = sourceWords.slice(i, i + 9).join(' ');
        if (padded.includes(` ${phrase} `)) { issues.push({ inputId, sourceId: source.voiceNoteId, reason: 'nine_word_overlap', phrase }); break; }
      }
    }
  }
  return issues;
}
const wordingIssues = copiedWording(claims.map(claim => [claim.sourceId, claim.note]));
assert.deepEqual(wordingIssues, [], 'Copied report wording remains in authored notes');
// A deliberately copied source must fail, including a short condition sentence.
assert(copiedWording([['negative-long', sourceById.get('tk5452-scope-1').transcriptText]]).length);
assert(copiedWording([['negative-short', 'Shell internal was not coated.']]).length);
for (const claim of claims) {
  const sourceNumbers = new Set(numbers(sourceById.get(claim.sourceId).transcriptText));
  const noteNumbers = new Set(numbers(claim.note));
  assert.deepEqual(noteNumbers, sourceNumbers, `Numeric tokens changed for ${claim.sourceId}`);
}
// Relationship/qualification checks for especially easy-to-corrupt notes.
const note = id => claims.find(claim => claim.sourceId === `tk5452-${id}`).note;
for (const pattern of [/Northeast patch.*480 mm/, /Up to 2 inches.*5\.90 to 6\.45 mm, average 6\.00 mm/, /At 2 inches away.*4\.80 to 6\.00 mm, average 5\.70 mm/]) assert(pattern.test(note('finding-10')));
assert(/S4, South side, 2-inch.*inside at 6 o'clock, minor corrosion, about 0\.5 mm/.test(note('finding-18')));
assert(/not frangible/.test(note('finding-27')));
assert(/No significant/.test(note('finding-53')) && /No significant/.test(note('finding-54')));
assert(/Could not.*B-scan/.test(note('finding-11')) && /Could not.*B-scan/.test(note('finding-58')));
assert(/Recommend.*assessment.*non-frangible/.test(note('recommendation-5')));

// Use actual app context keys. Checklist item metadata is captured in the app;
// a report section ID is never placed in a voice note. The planner must perform
// its own joins/classification and may expose unresolved metadata.
const checklistItemByEvent = { piping: 6, 'foundation-visual': 17, 'foundation-ut': 17, 'shell-outside': 21, 'shell-fittings': 42, ladder: 68, 'roof-outside': 80, 'roof-fittings': 90, 'roof-inside': 145, 'shell-inside': 166, 'floor-visual': 175, 'floor-mfl': 192, 'floor-band': 192, 'floor-restricted': 192, sump: 191 };
const prepared = clone(original);
prepared.utMeasurements.push(...prepareShellMeasurements(prepared.inspectionId));
const shellCoverage = checkShellMeasurementCoverage(prepared);
assert(shellCoverage.complete, shellCoverage.issues.join(' '));
prepared.mockPreparation = { contractVersion: 'inspector_notes_mock_v2', evaluationOnly: true, sourceDerived: true, actualAppExport: false, actualAudio: false, learningEligible: false, promotionEligible: false };
prepared.task.inspectionId = prepared.inspectionId;
// Do not carry forward an unverified ready-to-export assertion from the fixture.
for (const key of ['readinessStatusCode','readinessStatusLabel','exportStatusCode','exportStatusLabel']) delete prepared.task[key];
prepared.voiceNotes = INSPECTOR_NOTE_EVENTS.map((event, index) => {
  const itemNumber = checklistItemByEvent[event.id];
  if (itemNumber) assert(original.inspectionChecklistItems.some(item => item.itemNumber === itemNumber && item.sectionKey === event.cardKey));
  return {
    inspectionId: prepared.inspectionId, voiceNoteId: `tk5452-mock-v2-${String(index + 1).padStart(2, '0')}`,
    displayName: event.label,
    screenKey: itemNumber ? 'checklist' : 'task_home', screenLabel: itemNumber ? 'Inspection Checklist' : 'Task Home',
    cardKey: itemNumber ? 'checklist_item' : 'screen', fieldKey: itemNumber ? 'checklist_item_note' : 'voice_note',
    ...(itemNumber ? { itemKey: `checklist:${itemNumber}`, itemLabel: `Item ${itemNumber}` } : {}),
    transcriptStatus: 'completed', transcriptText: event.claims.map(claim => claim.note).join(' '),
    capturedAtIso: '2019-06-20T00:00:00.000Z', updatedAtIso: '2019-06-20T00:00:00.000Z',
  };
});
prepared.findings = original.findings.map((row, index) => ({ ...row, note: note(`finding-${index + 1}`) }));
prepared.taskSnapshots = [{ taskKey: 'tk5452-scope', source: 'authored source-derived mock job brief', taskText: INSPECTOR_NOTE_EVENTS.filter(event => event.cardKey === 'inspection_scope').flatMap(event => event.claims.map(claim => claim.note)).join(' ') }];
prepared.validationResults = [{ key: 'mockPreparationOnly', passed: true, message: 'Prepared mock data only. App workflow/export readiness has not been established.' }];
assert.deepEqual(prepared.inspectionRecord, original.inspectionRecord);
assert.deepEqual(prepared.utMeasurements.slice(0, original.utMeasurements.length), original.utMeasurements);
assert.deepEqual(prepared.inspectionChecklistItems, original.inspectionChecklistItems);
assert.deepEqual(validateAndroidV3ProductExport(prepared), [], 'Export envelope shape validation failed');
assert.deepEqual(copiedWording([
  ...prepared.voiceNotes.map(row => [row.voiceNoteId, row.transcriptText]),
  ...prepared.findings.map(row => [row.findingId, row.note]),
  ...prepared.taskSnapshots.map(row => [row.taskKey, row.taskText]),
]), [], 'Copied prose survives in an alternate input channel');
assert(!JSON.stringify(prepared).includes('originalSectionContent'));

// Preserve structured report values that v1 falsely labelled as native. They
// are visible as a separate proposed supplement, never injected into the app
// export or passed off as captured native fields.
const structuredSupplement = {
  evaluationOnly: true, sourceDerived: true, reviewStatus: 'proposed_report_side_inputs',
  fields: originalPlan.evidenceRecords.filter(record => record.kind === 'identity').map(record => ({
    ...clone(record.payload), nativePointer: Object.hasOwn(original.inspectionRecord, record.payload.fieldKey) ? `/inspectionRecord/${record.payload.fieldKey}` : null,
    sourceClass: 'historical_report_structured_data', sourcePdfSha256: originalReview.source.sha256,
    sourcePage: record.evidenceId.includes('03-general-information') ? 6 : 14,
  })),
};

// Actual shared backend preprocessing, with no handwritten section plan and no
// evaluator labels supplied. Unresolved routing is reported, never suppressed.
const processed = buildSectionPlanningSnapshot({ exportPackage: prepared });
const proposedExpectations = {
  evaluationOnly: true, generatorAccess: false, reviewStatus: 'proposed_not_independently_approved',
  sourcePdfSha256: originalReview.source.sha256,
  scope: '74 selected source entries from scope/findings/recommendations; compound entries are not atomic facts and this is not the full report denominator.',
  entries: claims.map(claim => {
    const eventIndex = INSPECTOR_NOTE_EVENTS.findIndex(event => event.id === claim.eventId);
    const findingNumber = claim.sourceId.match(/-finding-(\d+)$/)?.[1];
    return { sourceId: claim.sourceId, originalReportText: sourceById.get(claim.sourceId).transcriptText,
      originalSectionId: sourceById.get(claim.sourceId).screenKey,
      captureVoiceId: prepared.voiceNotes[eventIndex].voiceNoteId, authoredNote: claim.note,
      ...(findingNumber ? { duplicateWrittenFindingPointer: `/findings/${Number(findingNumber) - 1}/note`, countAsOneObservation: true } : {}),
      sourceDerived: true, independentlyReviewed: false };
  }),
};
const voiceRecords = processed.evidenceRecords.filter(record => record.kind === 'voice_claim');
const hasUse = record => processed.sectionPlans.some(plan => plan.evidenceUses.some(use => use.evidenceIds.includes(record.evidenceId)));
const validation = {
  evaluationOnly: true, mockPreparationPassed: true, generationPerformed: false, paidAiCalls: 0,
  sourceEntriesRepresented: claims.length, authoredCaptureEvents: prepared.voiceNotes.length,
  rewrittenFindingNotes: prepared.findings.length, unchangedChecklistRows: prepared.inspectionChecklistItems.length,
  unchangedUtRows: prepared.utMeasurements.length, unchangedInspectionRecord: true,
  copiedWholeEntriesOrNineWordPhrases: wordingIssues.length, copiedTextNegativeControlsPassed: 2,
  numericTokenChecksPassed: claims.length, semanticCompletenessIndependentlyReviewed: false,
  shellMeasurementCoverage: shellCoverage,
  taskInspectionIdConsistent: prepared.task.inspectionId === prepared.inspectionId,
  nativeAppExportPerformed: false, actualAudioOrAsrTested: false,
  sharedPreprocessorContract: processed.contractVersion,
  voiceRecordsAfterStatementSplitting: voiceRecords.length,
  voiceRecordsWithAnySectionUse: voiceRecords.filter(hasUse).length,
  voiceRecordsWithUnresolvedIssues: voiceRecords.filter(record => record.quality.issues.length).length,
  reportSideSupplementFields: structuredSupplement.fields.filter(field => field.nativePointer === null).length,
  limitations: [
    'Original report facts were used to author this reconstruction mock; it is not a held-out observation benchmark.',
    'Numeric-token and copy checks do not prove semantic completeness, unit/entity correctness or absence of every possible paraphrase leak.',
    'Task, voice and export dates are fixture metadata, not proof of historical recordings or app capture.',
    'App-shaped JSON is prepared locally; no device capture, native export workflow, authenticated import, audio or ASR run was performed.',
    'The shared planner resolves checklist-local voice context from exported item IDs. Remaining proposed actions require explicit evaluation inclusion or inspector review; no reference-based section labels are injected.',
    'Recommendations remain proposals requiring review; approved maintenance templates and missing sections remain separate work.',
    'The 74 source entries exclude calculation paragraphs and other missing source sections from v1. A complete independent denominator is still required before scoring.',
  ],
};

await mkdir(out, { recursive: true });
const outputs = {
  'app-shaped-export.json': stringify(prepared),
  'processed-planning.json': stringify(processed),
  'report-side-structured-data.json': stringify(structuredSupplement),
  'evaluator-only/source-note-comparison.json': stringify(proposedExpectations),
  'preparation-checks.json': stringify(validation),
};
const escapeCell = value => String(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
const lines = ['# TK5452 inspector-note mock, revision 2', '',
  '**Prepared for evaluation only. This script makes no AI calls.** The 74 selected source entries were rewritten into 18 component/activity capture events. Original client, dimensions, 195 checklist answers and 12 roof UT rows are unchanged. Eight shell capture rows now provide all 40 source readings from page 25. The whole-report mock remains incomplete.', '',
  'The mock contains practical short observations, dictation and proposed actions. It does not contain an original report sentence in the tested narrative channels. Notes retain numbers, location, negation, uncertainty and access limits. This remains a source-derived reconstruction fixture; the notes are authored, not actual inspector audio.', '',
  '## Examples', '', '| Original report (review only) | Mock inspector note |', '| --- | --- |'];
for (const id of ['finding-14','finding-18','finding-27','finding-43','finding-58','recommendation-5']) {
  lines.push(`| ${escapeCell(sourceById.get(`tk5452-${id}`).transcriptText)} | ${escapeCell(note(id))} |`);
}
lines.push('', '## Prepared capture events', '',
  'Recommendations are kept with the relevant component observation. The backend must determine the report destinations; capture inputs carry app screen/item context, never target report section IDs.', '');
for (let i = 0; i < INSPECTOR_NOTE_EVENTS.length; i++) {
  lines.push(`### ${i + 1}. ${INSPECTOR_NOTE_EVENTS[i].label}`, '', prepared.voiceNotes[i].transcriptText, '',
    `App context: \`${prepared.voiceNotes[i].screenKey}\` / \`${prepared.voiceNotes[i].cardKey}\`${prepared.voiceNotes[i].itemKey ? ` / \`${prepared.voiceNotes[i].itemKey}\`` : ''}.`, '');
}
lines.push('## Checks and next boundary', '',
  `- Copy gate: no complete source entry or contiguous nine-word source phrase in voice text, written findings or job brief. Both deliberate copied-text controls fail as required.`,
  `- All 74 source entries have a preparation mapping; their numeric tokens are preserved. This is preparation coverage, not a report-recovery score.`,
  '- Original structured inspection record, 195 checklist rows and 12 roof UT rows compare equal. Eight shell course/direction rows add the missing 40 readings with explicit millimetre units. A location-and-point coverage gate rejects missing, duplicated or invalid readings. The stale task inspection ID was corrected; unverified export-ready labels were removed.',
  '- The 42 additional structured values previously inserted outside the export are retained in an explicit proposed report-side supplement. They were not hidden inside the native mock or fed into the planner.',
  `- Shared preprocessing produced ${voiceRecords.length} voice statements; ${validation.voiceRecordsWithAnySectionUse} have a section use and ${validation.voiceRecordsWithUnresolvedIssues} have unresolved issues. Any unresolved items are retained for review; no manual report labels were added to make them pass.`,
  '- Review the expected fact set independently, resolve real app-context routing and inspect the generation request boundary before the next paid generation run. Score semantic facts, protected values and presentation separately; copied words and HTML IDs are not recovery.',
  '- Written findings and voice may repeat the same observation; the evaluator-only ledger records these duplicates so they must not count as separate recovered facts.',
  '- Maintenance regime remains a controlled standard section with no AI requirement. No replacement photographs or audio were generated.', '',
  '## Files', '',
  '- [App-shaped mock export](app-shaped-export.json)',
  '- [Actual shared-preprocessor output](processed-planning.json)',
  '- [Explicit structured supplement](report-side-structured-data.json)',
  '- [Preparation checks](preparation-checks.json)',
  '- [Original-to-note ledger, evaluator only](evaluator-only/source-note-comparison.json)', '',
  'Only the prepared input projection is eligible for a future reconstruction generator. The evaluator-only ledger, original PDF, old paired review and this comparison document must not be included in its inputs.', '');
outputs['README.md'] = lines.join('\n');
for (const [name, content] of Object.entries(outputs)) {
  await mkdir(dirname(join(out, name)), { recursive: true });
  await writeFile(join(out, name), content);
}
await writeFile(join(out, 'manifest.json'), stringify({
  contractVersion: 'tk5452_inspector_notes_mock_v2', evaluationOnly: true,
  evaluationTrack: 'historical_reconstruction_fixture', sourceDerived: true,
  learningEligible: false, promotionEligible: false, independentQualityEligible: false,
  generationPerformed: false, inputCandidates: ['app-shaped-export.json'],
  reviewOnly: ['report-side-structured-data.json', 'evaluator-only/source-note-comparison.json', 'README.md'],
  sourceFiles: Object.fromEntries(Object.entries(bytes).map(([name, value]) => [name, hash(value)])),
  files: Object.fromEntries(Object.entries(outputs).map(([name, value]) => [name, hash(value)])),
}));
for (const [name, value] of Object.entries(bytes)) assert.equal(hash(await readFile(join(before, name))), hash(value), 'Frozen v1 artifact changed');
console.log(JSON.stringify({ output: out, ...validation }, null, 2));
