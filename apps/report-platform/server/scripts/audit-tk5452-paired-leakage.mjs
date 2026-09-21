#!/usr/bin/env node
// Read-only audit of the frozen evaluation. No model calls and no run mutation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSectionDocument, reportNodeText } from '../report-document.mjs';
import { evaluateSectionPlanOutput } from '../section-plan-evaluation.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const input = join(project, 'docs/reviews/data/tk5452-paired-v1');
const output = join(project, 'docs/reviews/data/tk5452-paired-v1-leakage-audit');
const sha = value => createHash('sha256').update(value).digest('hex');
const norm = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const files = Object.fromEntries(await Promise.all(['native-export.json', 'section-planning.json', 'review.json', 'manifest.json'].map(async name => [name, await readFile(join(input, name))])));
const exportPackage = JSON.parse(files['native-export.json']);
const planning = JSON.parse(files['section-planning.json']);
const review = JSON.parse(files['review.json']);
const manifest = JSON.parse(files['manifest.json']);
for (const [name, hash] of Object.entries(manifest.files)) assert.equal(sha(files[name]), hash, `Changed frozen artifact: ${name}`);
assert.equal(sha(await readFile(review.source.absolutePath)), review.source.sha256, 'Changed reference PDF');
const pdfText = norm(execFileSync('pdftotext', ['-layout', review.source.absolutePath, '-'], { encoding: 'utf8', maxBuffer: 8_000_000 }));

function pointerValue(pointer) {
  let value = exportPackage;
  for (const key of pointer.slice(1).split('/').map(key => key.replace(/~1/g, '/').replace(/~0/g, '~'))) {
    if (value == null || !Object.hasOwn(value, key)) return undefined;
    value = value[key];
  }
  return value;
}
const section = id => review.sections.find(item => item.sectionId === id);
const plan = id => planning.sectionPlans.find(item => item.sectionId === id);
const records = id => planning.evidenceRecords.filter(record => plan(id).evidenceUses.some(use => use.evidenceIds.includes(record.evidenceId)));
const outputNodes = new Map();
for (const item of review.sections) {
  const nodes = [];
  const visit = node => {
    if (node.attrs?.['data-evidence-id']) nodes.push(node);
    (node.children ?? []).forEach(visit);
  };
  parseSectionDocument({ sectionId: item.sectionId, html: item.generatedContent }).blocks.forEach(visit);
  outputNodes.set(item.sectionId, nodes);
}
const outputNode = (id, record) => outputNodes.get(id).find(node => node.attrs['data-evidence-id'] === record.evidenceId);
const outputText = (id, record) => norm(reportNodeText(outputNode(id, record)));
const originalExcerpt = (id, text) => {
  assert(norm(section(id).originalSectionContent).includes(norm(text)), `Reference excerpt not found: ${id}: ${text}`);
  assert(pdfText.includes(norm(text)), `Excerpt not found in checksum-verified PDF: ${text}`);
  return norm(text);
};

const invalidPointers = planning.evidenceRecords.filter(record => pointerValue(record.sourceRef.pointer) === undefined)
  .map(record => ({ evidenceId: record.evidenceId, kind: record.kind, pointer: record.sourceRef.pointer }));
const voiceAudit = exportPackage.voiceNotes.map((voice, index) => {
  const record = records(voice.screenKey).find(record => record.kind === 'voice_claim' && norm(record.payload.text) === norm(voice.transcriptText));
  assert(record, `No processed evidence for ${voice.voiceNoteId}`);
  return {
    voiceNoteId: voice.voiceNoteId, sectionId: voice.screenKey, nativePointer: `/voiceNotes/${index}`,
    recordedPointer: record.sourceRef.pointer,
    fullTranscriptOccursInOriginalSection: norm(section(voice.screenKey).originalSectionContent).includes(norm(voice.transcriptText)),
    fullTranscriptOccursInVerifiedPdf: pdfText.includes(norm(voice.transcriptText)),
    outputEqualsTranscript: outputText(voice.screenKey, record) === norm(voice.transcriptText),
  };
});
const bySection = review.sections.map(item => {
  const voices = voiceAudit.filter(voice => voice.sectionId === item.sectionId);
  return {
    sectionId: item.sectionId, originalPages: item.pages,
    preparedRequirements: plan(item.sectionId).outputObligations.length,
    voiceCount: voices.length,
    copiedWholeTranscripts: voices.filter(voice => voice.fullTranscriptOccursInOriginalSection && voice.fullTranscriptOccursInVerifiedPdf).length,
    outputEqualsTranscript: voices.filter(voice => voice.outputEqualsTranscript).length,
    liveResponseRecorded: item.rawAiResponse !== null, liveWordingAccepted: item.generationRun.usedLiveModel,
    fallbackReason: item.generationRun.fallbackReason,
    unresolvedPointers: records(item.sectionId).filter(record => pointerValue(record.sourceRef.pointer) === undefined).length,
  };
});

// Negative control: reproduce the rescore script's ID test on a local string.
// The frozen output is never changed. The shared content evaluator is a control.
const testSection = section('03-general-information');
const testPlan = plan(testSection.sectionId);
const blankOutput = testSection.generatedContent.replace(/>([^<]+)</g, '><');
const traceScore = html => {
  const ids = new Set([...html.matchAll(/data-obligation-id="([^"]+)"/g)].map(match => match[1]));
  return testPlan.outputObligations.filter(obligation => ids.has(obligation.obligationId)).length;
};
assert.equal(norm(blankOutput.replace(/<[^>]*>/g, '')), '');
const contentControl = evaluateSectionPlanOutput({ sectionPlan: testPlan, evidenceRecords: planning.evidenceRecords, generatedContent: blankOutput });
const negativeControl = {
  sectionId: testSection.sectionId,
  intervention: 'Remove all rendered text while retaining HTML attributes; in memory only.',
  requiredCount: testPlan.outputObligations.length,
  originalIdBasedMatchedCount: traceScore(testSection.generatedContent),
  blankIdBasedMatchedCount: traceScore(blankOutput),
  blankContentBasedMatchedCount: contentControl.truthGraphEvaluation.matchedRequiredFactCount,
  actualEvaluatorDenominatorSource: contentControl.denominatorSource,
  savedDenominatorSource: testSection.evaluation.denominatorSource,
};
assert.equal(negativeControl.blankIdBasedMatchedCount, 33);
assert.equal(negativeControl.blankContentBasedMatchedCount, 0);

const comparisons = [];
function add({ sectionId, sample, original, processed, generated, assessment, evidenceIds }) {
  comparisons.push({ sectionId, sectionTitle: section(sectionId).title, pages: section(sectionId).pages, sample, original, processed, generated, assessment, evidenceIds });
}
{
  const id = '03-general-information';
  const client = records(id).find(record => record.payload.fieldKey === 'client');
  const diameter = records(id).find(record => record.payload.fieldKey === 'diameterM');
  add({ sectionId: id, sample: 'Client and diameter', original: [originalExcerpt(id, 'Client: Shell Eastern Petroleum Pte Ltd'), originalExcerpt(id, 'Diameter: 3.048 m')],
    processed: ['Native /inspectionRecord/client = Shell Eastern Petroleum Pte Ltd', 'Native /inspectionRecord/diameterM = 3.048; processed unitCode = m', 'Both native pointers resolve. Backend emits labelled identity fields.'],
    generated: [outputText(id, client), outputText(id, diameter)], evidenceIds: [client.evidenceId, diameter.evidenceId],
    assessment: 'Expected factual preservation in a source-derived mock. Correct identity and measurements are legitimate input; this checks deterministic formatting, not AI reasoning.' });
  const service = records(id).find(record => record.payload.fieldKey === 'serviceHeightM');
  assert.equal(pointerValue(service.sourceRef.pointer), undefined);
  add({ sectionId: id, sample: 'Service height', original: [originalExcerpt(id, 'Service Height: 2.438 m')],
    processed: ['Native /inspectionRecord/serviceHeightM: ABSENT.', `Processed payload inserted by builder: ${JSON.stringify(service.payload)}`, `Recorded pointer ${service.sourceRef.pointer} does not resolve.`],
    generated: [outputText(id, service)], evidenceIds: [service.evidenceId],
    assessment: 'Hidden supplementation: this field was hardcoded from the report directly into the plan, not recovered by preprocessing the saved export.' });
}
for (const [id, sample, match, assessment] of [
  ['01-scope', 'Bottom sump scope', /thickness measurements of tank bottom sump/, 'Answer text copied into a mocked voice transcript. Live wording failed validation; the published output retained the copied input verbatim.'],
  ['04-inspection-report', 'Internal shell condition', /^Shell internal was not coated\./, 'Answer text copied into a mocked voice transcript. The same sentence appears in the native findings array as well. Live wording failed validation; the published output retained the copied input.'],
  ['05-recommendations', 'Emergency venting recommendation', /emergency venting/, 'Live AI wording was accepted, but the complete finished recommendation was already provided as input. This tests paraphrasing of an exposed answer.'],
]) {
  const record = records(id).find(record => record.kind === 'voice_claim' && match.test(record.payload.text));
  assert(record, `Missing sample ${id}`);
  const index = exportPackage.voiceNotes.findIndex(voice => norm(voice.transcriptText) === norm(record.payload.text));
  add({ sectionId: id, sample, original: [originalExcerpt(id, record.payload.text)],
    processed: [`Native /voiceNotes/${index}/transcriptText: ${exportPackage.voiceNotes[index].transcriptText}`, `Processed voice_claim.text: ${record.payload.text}`, `Target section manually assigned as ${id}; stored source pointer: ${record.sourceRef.pointer}${pointerValue(record.sourceRef.pointer) === undefined ? ' (does not resolve)' : ' (resolves)'}.`],
    generated: [outputText(id, record)], assessment, evidenceIds: [record.evidenceId] });
}
{
  const id = '06-test-information';
  const record = records(id).find(record => record.payload.reportLabel === 'UT · Flaw Detector');
  add({ sectionId: id, sample: 'UT instrument', original: [originalExcerpt(id, 'Flaw Detector: Epoch 4'), originalExcerpt(id, '(S/N IRS 3167)')],
    processed: ['Native /preprocessedTestInformation: ABSENT.', `Processed payload inserted by builder: ${JSON.stringify(record.payload)}`, `Recorded pointer ${record.sourceRef.pointer} does not resolve.`],
    generated: [outputText(id, record)], evidenceIds: [record.evidenceId],
    assessment: 'Hidden supplementation. All 16 test-information records were hardcoded into the plan; their claimed source container does not exist in the export.' });
}
{
  const id = '08-roof-plate-thickness';
  const record = records(id)[0];
  const row = pointerValue(record.sourceRef.pointer);
  const original = section(id).originalSectionContent.match(/\n\s*1\s+4\.48\s+4\.36\s+4\.04\s+4\.26\s+4\.07/)?.[0];
  assert(original);
  const node = outputNode(id, record);
  add({ sectionId: id, sample: 'Roof plate 1, A–E readings', original: [originalExcerpt(id, original), originalExcerpt(id, 'All readings are in mm.')],
    processed: [`Native ${record.sourceRef.pointer}: ${JSON.stringify({ itemKey: row.itemKey, unitCode: row.unitCode, ...Object.fromEntries(['value1','value2','value3','value4','value5'].map(key => [key, row[key]])) })}`, `Processed measurement cells: ${JSON.stringify(record.payload.cells.map(({ key, value, unitCode }) => ({ key, value, unitCode })))}`],
    generated: [node.children.filter(child => child.tag === 'td').map(child => norm(reportNodeText(child))).join(' | ')], evidenceIds: [record.evidenceId],
    assessment: 'Legitimate raw numeric inputs, deterministically rendered. Useful evidence of value preservation for this row; excluded from AI narrative performance.' });
}
{
  const id = '02-regime';
  const record = records(id)[0];
  const excerpt = 'See API 653 Appendix C “Check List for Tank Inspection”.';
  assert(outputText(id, record).includes(excerpt));
  add({ sectionId: id, sample: 'Standard maintenance text (opening excerpt)', original: [originalExcerpt(id, excerpt)],
    processed: ['Full source section copied into approved_template.payload.text.', `Recorded pointer ${record.sourceRef.pointer} does not resolve in the export.`, 'No independently versioned approved-template reference supplied by this builder.'],
    generated: [excerpt, 'Compiled with no AI call.'], evidenceIds: [record.evidenceId],
    assessment: 'Bypassing AI is consistent with the user requirement. Standard text should come from an explicitly approved, versioned library; copying this reference section does not demonstrate AI performance.' });
}

const audit = {
  auditVersion: 'tk5452_leakage_audit_v1', caseId: review.caseId,
  verdict: 'contaminated_for_independent_generation_quality_evaluation', evaluationOnly: true,
  sourcePdfSha256: review.source.sha256,
  frozenFileHashes: Object.fromEntries(Object.entries(files).map(([name, value]) => [name, sha(value)])),
  scriptHashes: Object.fromEntries(await Promise.all(['build-tk5452-paired-evaluation.mjs','rescore-tk5452-paired-evaluation.mjs','audit-tk5452-paired-leakage.mjs'].map(async name => [name, sha(await readFile(join(project, 'server/scripts', name)))]))),
  counts: {
    ...review.summary,
    voiceInputs: voiceAudit.length,
    completeVoiceTranscriptsCopiedFromReference: voiceAudit.filter(voice => voice.fullTranscriptOccursInOriginalSection && voice.fullTranscriptOccursInVerifiedPdf).length,
    publishedVoiceBlocksExactlyEqualInput: voiceAudit.filter(voice => voice.outputEqualsTranscript).length,
    unresolvedSourcePointers: invalidPointers.length,
    identityFieldsWithUnresolvedPointers: records('03-general-information').filter(record => pointerValue(record.sourceRef.pointer) === undefined).length,
    testInformationFieldsWithUnresolvedPointers: records('06-test-information').filter(record => pointerValue(record.sourceRef.pointer) === undefined).length,
    sectionsWithRecordedLiveResponse: bySection.filter(item => item.liveResponseRecorded).length,
    sectionsWithAcceptedLiveWording: bySection.filter(item => item.liveWordingAccepted).length,
  },
  taskInspectionIdMatchesExport: exportPackage.task.inspectionId === exportPackage.inspectionId,
  bySection, negativeControl, invalidPointers, voiceAudit, comparisons,
  limitations: ['Local evaluation contamination audit, not an external data-disclosure or model pretraining audit.', 'Exact-copy detection is whitespace-normalized; it does not claim a complete semantic leakage detector.', 'The builder and frozen plan manually assign report sections; normal backend classification was not tested by this run.', 'Source-derived facts can legitimately support a reconstruction fixture, but this fixture exposes finished answer prose and cannot establish independent generation quality.'],
};

const cell = lines => lines.map(line => String(line).replace(/\|/g, '\\|').replace(/\n/g, ' ')).join('<br><br>');
const lines = [
  '# TK5452 evaluation leakage audit and three-column comparison', '',
  `Case: \`${review.caseId}\`. Frozen artifacts were checksum-verified against their manifest; the original PDF was independently checksum-verified and its text re-extracted.`, '',
  '**Verdict: the current run is contaminated for evaluating independent AI report-generation quality. The previously reported 331/332 (99.7%) must not be presented as AI recovery performance.**', '',
  'This is a local audit only: no new AI calls, no policy promotion, no product changes, and no changes to the original run files.', '',
  '## What the audit found', '',
  `- All ${audit.counts.completeVoiceTranscriptsCopiedFromReference}/${audit.counts.voiceInputs} mocked voice transcripts are complete sentences copied from the reference: scope 9, findings 58, recommendations 7. ${audit.counts.publishedVoiceBlocksExactlyEqualInput}/74 published voice blocks equal their supplied input after whitespace normalization.`,
  '- Three sections have saved live worker responses. Only recommendations retained live wording. Scope and findings failed voice validation and used deterministic fallback, which retained the copied report sentences.',
  '- General information contains 33 planned fields, but 26 claimed native field pointers do not exist. Test information contains another 16 hardcoded fields whose claimed export container does not exist. Some missing pointers concern values potentially derivable elsewhere; this run does not demonstrate such derivation. Service height is a concrete example of a missing native field supplied directly from the reference.',
  '- In total 109/332 evidence pointers fail to resolve: 26 identity fields, 16 test-information fields, 65 voice pointers using names instead of array indexes, and 2 standard-template pointers. The 65 voice records do exist under different array indexes; a broken pointer does not mean their text is absent.',
  '- Expected requirements were created from the same selected inputs. The script calls the evaluator without an independent truth set, then saves a misleading independent_expected_obligations label. Findings exclude calculation paragraphs and page 12; their absence is not represented in the 332-item denominator.',
  '- Section routing and outline selection were manually prepared for this report. This run does not validate generic preprocessing, multi-section classification, or the reusable 25-template workflow.',
  '- The format score checks the main heading only. It cannot establish whole-section layout fidelity. A stale task.inspectionId also remains from the previous synthetic fixture.', '',
  '## Scoring negative control', '',
  'For General Tank Information, I removed all visible output text in memory while preserving its HTML identifiers. The same ID-based rule used by the paired rescore script still returns **33/33**. The shared content evaluator correctly returns **0/33**. This isolates the flaw to the paired benchmark scoring shortcut; the frozen output was not changed.', '',
  '## Original → processed export → generated output', '',
  'These are actual excerpts from the saved run, not newly generated examples. PDF line wrapping is normalized. The middle column distinguishes data present in the saved export from values injected directly into the plan.', '',
];
for (const row of comparisons) {
  lines.push(`### ${row.sectionTitle} — ${row.sample}`, '', `Original PDF page(s): ${row.pages.join(', ')}.`, '',
    '| Original report | Export data (processed) | Generated part |', '| --- | --- | --- |',
    `| ${cell(row.original)} | ${cell(row.processed)} | ${cell(row.generated)} |`, '',
    `**Assessment:** ${row.assessment}`, '', `Evidence: ${row.evidenceIds.map(id => `\`${id}\``).join(', ')}.`, '');
}
lines.push('## What remains valid, and what must change before another paid run', '',
  'Preserving supplied client details, measurements, units and checklist choices is expected. A source-derived mock can test those behaviours, provided every value is in the export or an explicit report-side input. Standard maintenance content should bypass AI as requested. These checks must be scored separately from narrative generation.', '',
  'Before another generation-quality run:', '',
  '1. Rebuild the mock as app-shaped raw facts and realistic field notes, preserving the original asset and findings. Do not paste finished report paragraphs into voice input or merely paraphrase all of the answer.',
  '2. Freeze a complete, independently reviewed expected-fact set and an explicit input-availability matrix. Keep the target report out of generation and same-report retrieval. Identify this as a source-derived reconstruction pilot, not a fully independent held-out benchmark.',
  '3. Run the real import and preprocessing path. Require every evidence pointer to resolve and every critical task/asset identifier to agree. Supply report-side additions and approved standard templates through explicit, separately labelled channels.',
  '4. Test section classification rather than assigning target report IDs inside mock voice metadata. Permit reviewed multi-section evidence reuse.',
  '5. Score actual generated content against independent facts. Require blank-output and altered-value negative controls to fail; report AI attempts, accepted wording and fallback separately. Review layout beyond headings.', '',
  'An independently captured inspection or held-out app export is still needed to establish generalization beyond reconstructing this historical report. No corrected performance claim is available from this contaminated run.', '',
  '## Reproduce and inspect', '',
  'Run from the repository root:', '',
  '```sh', 'node apps/report-platform/server/scripts/audit-tk5452-paired-leakage.mjs', '```', '',
  '- [Machine-readable audit and all pointer/voice checks](audit.json)',
  '- [Frozen original run](../tk5452-paired-v1/review.json)',
  '- [Frozen native export](../tk5452-paired-v1/native-export.json)',
  '- [Frozen processed plan](../tk5452-paired-v1/section-planning.json)',
  '- [Builder: report extraction, hardcoded fields and manual planning](../../../../server/scripts/build-tk5452-paired-evaluation.mjs)',
  '- [Paired score shortcut](../../../../server/scripts/rescore-tk5452-paired-evaluation.mjs)', '',
  `Reference PDF SHA-256: \`${review.source.sha256}\`.`, '',
  'Scope: evaluation answer contamination and local provenance. This audit does not establish whether external data disclosure or model pretraining contamination occurred.', '',
);
await mkdir(output, { recursive: true });
await writeFile(join(output, 'audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
await writeFile(join(output, 'comparison.md'), lines.join('\n'));
// Verify that this audit did not rewrite its source artifacts.
for (const [name, bytes] of Object.entries(files)) assert.equal(sha(await readFile(join(input, name))), sha(bytes));
console.log(JSON.stringify({ verdict: audit.verdict, counts: audit.counts, negativeControl, comparison: join(output, 'comparison.md'), frozenFilesUnchanged: true }, null, 2));
