#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const rootIndex = process.argv.indexOf('--pilot-root');
if (rootIndex < 0 || !process.argv[rootIndex + 1]) {
  throw new Error('Usage: audit-pilot-android.mjs --pilot-root <pilot-output-root>');
}
const pilotRoot = resolve(process.argv[rootIndex + 1]);
const result = await readJson(join(pilotRoot, 'result.json'));
assert.equal(result.decision, 'pass', 'Pre-export evaluation did not pass.');

const audits = [];
for (const dataset of result.datasets) {
  const datasetId = dataset.datasetId;
  const caseRoot = join(pilotRoot, 'android-cases', datasetId);
  const exportPath = join(caseRoot, 'exports', 'concise-field', 'v3-product-export.json');
  const [accepted, plan, draft, exported, receipt, exportBytes] = await Promise.all([
    readJson(join(pilotRoot, 'datasets', datasetId, 'accepted.json')),
    readJson(join(caseRoot, 'reviewed-case-plan.json')),
    readJson(join(caseRoot, 'drafts', 'concise-field.json')),
    readJson(exportPath),
    readJson(join(caseRoot, 'exports', 'concise-field', 'android-export-receipt.json')),
    readFile(exportPath),
  ]);
  const issues = [];
  const check = (condition, code, message) => { if (!condition) issues.push({ code, message }); };
  const exportSha256 = createHash('sha256').update(exportBytes).digest('hex');
  const exportByteSize = (await stat(exportPath)).size;
  check(receipt.producer === 'ProductStore.exportInspection', 'producer', 'Export was not produced by ProductStore.');
  check(receipt.exportSha256 === exportSha256, 'hash', 'Receipt hash differs from the pulled export.');
  check(receipt.exportByteSize === exportByteSize, 'size', 'Receipt size differs from the pulled export.');
  check(receipt.inspectionId === exported.inspectionId, 'inspection', 'Receipt and export inspection IDs differ.');
  check(exported.packageType === 'v3_product_export' && exported.schemaVersion === 3,
    'contract', 'Export is not the Android V3 product contract.');
  check(exported.unitProfile?.thicknessUnit === 'mm', 'unit', 'Android export unit profile is not mm.');

  const exportedVoice = new Map((exported.voiceNotes ?? []).map((item) => [item.voiceNoteId, item]));
  check((draft.voiceNotes ?? []).length === 7, 'draft_voice_count', 'Draft must contain seven composed notes.');
  check(exportedVoice.size === 7, 'export_voice_count', 'Export must contain seven app voice-note records.');
  for (const note of draft.voiceNotes ?? []) {
    const actual = exportedVoice.get(note.id);
    check(Boolean(actual), 'voice_missing', `${note.id} is missing from the export.`);
    if (!actual) continue;
    check(actual.transcriptText === note.transcriptText, 'voice_transcript', `${note.id} transcript changed in ProductStore.`);
    check(actual.fileExists === true && Number(actual.fileByteSize) > 0,
      'voice_file', `${note.id} does not have a non-empty app attachment.`);
  }
  const acceptedTextById = new Map(accepted.notes.map((item) => [item.noteId,
    item.clauses.map((clause) => clause.text.trim()).join(' ')]));
  for (const planNote of plan.voiceNotes ?? []) {
    check(planNote.captureText === acceptedTextById.get(planNote.noteId), 'accepted_plan_text',
      `${planNote.noteId} differs between accepted dataset and Android plan.`);
    const draftNote = (draft.voiceNotes ?? []).find((item) => item.id === `concise-field-${planNote.noteId}`);
    check(normalizeSpace(draftNote?.transcriptText).includes(normalizeSpace(planNote.captureText)), 'plan_draft_text',
      `${planNote.noteId} differs between Android plan and app draft.`);
  }
  audits.push({
    datasetId,
    decision: issues.length ? 'fail' : 'pass',
    preExport: { factCount: result.factCount, factFailures: dataset.factFailures.length,
      unsupportedClaims: dataset.unsupportedClaims.length, wordingMetrics: dataset.wordingMetrics },
    android: { producer: receipt.producer, packageType: exported.packageType,
      schemaVersion: exported.schemaVersion, inspectionReference: exported.inspectionReference,
      voiceNotes: exportedVoice.size, voiceAttachments: (exported.attachments ?? [])
        .filter((item) => item.kind === 'voice_audio' && item.fileExists === true).length,
      exportByteSize, exportSha256 },
    issues,
  });
}

const audit = {
  contractVersion: 'mock_preparation_android_pilot_audit_v1',
  evaluationOnly: true,
  pilotId: result.pilotId,
  decision: audits.every((item) => item.decision === 'pass') ? 'pass' : 'fail',
  datasets: audits,
  auditedAtIso: new Date().toISOString(),
};
await writeFile(join(pilotRoot, 'android-round-trip-result.json'), `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
if (audit.decision !== 'pass') process.exitCode = 2;

async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
function normalizeSpace(value) { return String(value ?? '').trim().replace(/\s+/g, ' '); }
