import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { guardEvaluationInput } from './guard.mjs';

const SECRET = 'test-only-lineage-secret-32-bytes-minimum';
const canonical = (value) => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const cleanExport = () => ({
  packageType: 'v3_product_export', schemaVersion: 3,
  inspectionId: 'inspection-1', inspectionReference: 'LAIQ-INSPECTION-1',
  tenantId: 'tenant-1', workspaceId: 'workspace-1',
  unitProfile: { thicknessUnit: 'mm' },
  inspectionRecord: { client: 'Example Client', tankNumber: 'T-101', location: 'Example Yard' },
  inspectionChecklistItems: [{ sectionKey: 'shell_external', sectionTitle: 'Shell External', itemKey: 'shell:1', answer: 'SAT' }],
  utMeasurements: [{ itemKey: 'shell:course:2:west', targetKey: 'shell', value1: 5.8 }],
  voiceNotes: [{ voiceNoteId: 'voice-1', screenKey: 'findings', screenLabel: 'Findings', transcriptStatus: 'ready', transcriptText: 'External shell course 2 west has local coating breakdown and corrosion.' }],
  findings: [], attachments: [], validationResults: [{ passed: true }], taskSnapshots: [{ taskKey: 'review' }],
  layoutTargets: [], layoutConfigs: [], layoutFigures: [], elements: [], inspectionChecklistSectionNotes: [],
});
const receiptFor = (pkg) => {
  const bytes = canonical(pkg);
  return {
    packageType: 'laiq_android_app_export_receipt', schemaVersion: 2,
    caseId: 'case-private-1', caseRevision: 1, variant: 'natural-field-speech',
    goldSha256: 'a'.repeat(64), goldApprovalManifestSha256: 'b'.repeat(64),
    producer: 'ProductStore.exportInspection', exportPackageId: 'export-1',
    inspectionId: pkg.inspectionId, inspectionReference: pkg.inspectionReference,
    exportedAtIso: '2026-10-15T00:00:00Z', exportByteSize: Buffer.byteLength(bytes),
    exportSha256: sha256(bytes), roundTripOutputRelativePath: 'private/case-private-1.json',
  };
};
const run = (pkg, extras = {}) => guardEvaluationInput({
  exportPackage: pkg, androidReceipt: receiptFor(pkg), lineageSecret: SECRET,
  ...extras,
});

test('passes a clean native export without changing any app evidence', () => {
  const pkg = cleanExport();
  const before = canonical(pkg);
  const result = run(pkg);
  assert.equal(result.decision, 'passed');
  assert.equal(result.sealedInput.exportPackage.voiceNotes[0].transcriptText,
    pkg.voiceNotes[0].transcriptText);
  assert.deepEqual(result.sealedInput.exportPackage.utMeasurements, pkg.utMeasurements);
  assert.deepEqual(result.sealedInput.exportPackage.inspectionChecklistItems, pkg.inspectionChecklistItems);
  assert.notEqual(result.sealedInput.exportPackage.voiceNotes[0].voiceNoteId, pkg.voiceNotes[0].voiceNoteId);
  assert.equal(canonical(pkg), before);
  assert.match(result.sealedInput.lineageToken, /^eval_ln_[a-f0-9]{64}$/);
  assert.equal(result.runtimeReceipt.checks.totalBlockingIssues, 0);
  assert.equal(result.runtimeReceipt.checks.originalExportMutated, false);
  assert.equal(result.runtimeReceipt.checks.protectedNativeEvidenceMutated, false);
  assert(result.runtimeReceipt.checks.metadataPseudonymizedCount >= 1);
});

test('keeps receipt gold fields in the evaluator crosswalk and out of runtime artifacts', () => {
  const result = run(cleanExport());
  assert.equal(result.evaluatorCrosswalk.caseId, 'case-private-1');
  assert.equal(result.evaluatorCrosswalk.variant, 'natural-field-speech');
  assert.equal(result.evaluatorCrosswalk.goldSha256, 'a'.repeat(64));
  for (const runtime of [result.sealedInput, result.runtimeReceipt]) {
    const text = JSON.stringify(runtime);
    assert(!text.includes('case-private-1'));
    assert(!text.includes('natural-field-speech'));
    assert(!text.includes('"goldSha256"'));
  }
});

test('blocks unknown fields and explicit gold labels inside the export', () => {
  const pkg = cleanExport();
  pkg.goldSectionId = 'inspection-report';
  const result = run(pkg);
  assert.equal(result.decision, 'blocked');
  assert.equal(result.sealedInput, null);
  assert(result.evaluatorCrosswalk.blockingIssues.some((item) => item.code === 'unknown_top_level_export_field'));
  assert(result.evaluatorCrosswalk.blockingIssues.some((item) => item.code === 'forbidden_gold_or_report_metadata'));
});

test('blocks report-section instructions inside mock narrative', () => {
  const pkg = cleanExport();
  pkg.voiceNotes[0].transcriptText = 'Route this observation to report section 4 Inspection Report.';
  const result = run(pkg);
  assert.equal(result.decision, 'blocked');
  assert.equal(result.runtimeReceipt.checks.sectionHintCount, 1);
});

test('allows native checklist sections and natural references to a floor layout', () => {
  const pkg = cleanExport();
  pkg.voiceNotes[0].transcriptText = 'Repair positions are identified on the Floor Plate Layout.';
  const result = run(pkg);
  assert.equal(result.decision, 'passed');
  assert.equal(result.runtimeReceipt.checks.sectionHintCount, 0);
});

test('records a short exact source overlap for review without blocking technical wording', () => {
  const pkg = cleanExport();
  pkg.voiceNotes[0].transcriptText = 'The external shell coating was generally in satisfactory condition with local corrosion.';
  const result = run(pkg, { referenceTextUnits: [{
    unitId: 'truth-1',
    text: 'The external shell coating was generally in satisfactory condition with local corrosion activity around the stairway.',
  }] });
  assert.equal(result.decision, 'passed');
  assert.equal(result.runtimeReceipt.checks.verbatimLeakageCount, 0);
  assert.equal(result.runtimeReceipt.checks.sourceOverlapAdvisoryCount, 1);
  assert.equal(result.runtimeReceipt.checks.maximumSourceOverlapWords, 12);
  assert.equal(result.evaluatorCrosswalk.advisories[0].code, 'source_narrative_overlap_review');
  assert.deepEqual(result.evaluatorCrosswalk.referenceTextUnits.map((item) => Object.keys(item).sort()),
    [['textSha256', 'unitId']]);
  assert(!JSON.stringify(result.evaluatorCrosswalk).includes('The external shell'));
});

test('blocks a long copied report passage while keeping source text evaluator-private', () => {
  const copied = 'The external shell coating was generally in satisfactory condition with isolated coating breakdown and active corrosion around the stairway support brackets.';
  const pkg = cleanExport();
  pkg.voiceNotes[0].transcriptText = copied;
  const result = run(pkg, { referenceTextUnits: [{
    unitId: 'truth-2',
    text: `${copied} Further examination is recommended.`,
  }] });
  assert.equal(result.decision, 'blocked');
  assert.equal(result.sealedInput, null);
  assert.equal(result.runtimeReceipt.checks.verbatimLeakageCount, 1);
  assert(result.runtimeReceipt.checks.maximumSourceOverlapWords >= 16);
  assert(!JSON.stringify(result.evaluatorCrosswalk).includes(copied));
});

test('blocks receipt hash and inspection identity mismatches', () => {
  const pkg = cleanExport();
  const receipt = receiptFor(pkg);
  receipt.exportSha256 = 'f'.repeat(64);
  receipt.inspectionId = 'other-inspection';
  const result = guardEvaluationInput({
    exportPackage: pkg, androidReceipt: receipt, lineageSecret: SECRET,
  });
  assert.equal(result.decision, 'blocked');
  const codes = result.evaluatorCrosswalk.blockingIssues.map((item) => item.code);
  assert(codes.includes('receipt_export_hash_mismatch'));
  assert(codes.includes('receipt_inspection_id_mismatch'));
});


test('pseudonymizes mock paths, variation IDs and source-derived media names', () => {
  const pkg = cleanExport();
  pkg.voiceNotes[0].voiceNoteId = 'concise-field-obs-shell-external';
  pkg.voiceNotes[0].relativePath = 'report-mock-corpus/case-private-1/concise-field/obs-shell-external.m4a';
  pkg.voiceNotes[0].displayName = 'obs-shell-external-concise-field.m4a';
  pkg.attachments.push({
    attachmentId: 'concise-field-obs-shell-external', kind: 'voice_audio',
    relativePath: pkg.voiceNotes[0].relativePath, displayName: pkg.voiceNotes[0].displayName,
  }, {
    attachmentId: 'shell:region:west:photo-1', kind: 'finding_photo',
    relativePath: 'report-mock-corpus/case-private-1/photos/source-photo-1.png',
    displayName: 'Report photo 1.png', targetKey: 'shell', itemKey: 'shell:region:west',
  });
  const result = run(pkg);
  assert.equal(result.decision, 'passed');
  const runtimeText = JSON.stringify(result.sealedInput);
  assert(!runtimeText.includes('case-private-1'));
  assert(!runtimeText.includes('concise-field'));
  assert(!runtimeText.includes('obs-shell-external'));
  assert(!runtimeText.includes('Report photo'));
  assert(runtimeText.includes('External shell course 2 west'));
  assert.equal(result.sealedInput.exportPackage.attachments[1].targetKey, 'shell');
  assert.equal(result.sealedInput.exportPackage.attachments[1].itemKey, 'shell:region:west');
  assert(result.evaluatorCrosswalk.metadataPseudonymization.some((item) =>
    item.originalValue.includes('case-private-1')));
});


test('allows a natural hyphenated technical term matching a section slug', () => {
  const pkg = cleanExport();
  pkg.voiceNotes[0].transcriptText = 'Results from the tank shell-settlement survey at eight points were satisfactory.';
  const result = run(pkg);
  assert.equal(result.decision, 'passed');
  assert.equal(result.runtimeReceipt.checks.sectionHintCount, 0);
});
