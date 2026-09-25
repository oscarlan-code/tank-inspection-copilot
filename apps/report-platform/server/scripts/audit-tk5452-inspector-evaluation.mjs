import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadGenericOutlineHeldOutReview } from '../experiments/generic-outline-review-backend.mjs';
import { evaluateSectionPlanOutput } from '../section-plan-evaluation.mjs';
import { checkShellMeasurementCoverage } from '../experiments/tk5452-shell-measurements.mjs';
import { rebindEvaluationCache } from '../experiments/rebind-evaluation-cache.mjs';
import { parseSectionDocument, reportNodeText } from '../report-document.mjs';
const root = new URL('../../docs/reviews/data/tk5452-inspector-evaluation-v2/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const input = await read('generation-input.json');
const snapshot = await read('section-planning.json');
const review = await read('review.json');
const original = JSON.parse(await readFile(new URL('../../docs/reviews/data/tk5452-paired-v1/native-export.json', import.meta.url), 'utf8'));
assert.deepEqual(input.appExport.inspectionRecord, original.inspectionRecord);
assert.deepEqual(input.appExport.utMeasurements.slice(0, original.utMeasurements.length), original.utMeasurements);
assert(checkShellMeasurementCoverage(input.appExport).complete);
assert.deepEqual(input.appExport.inspectionChecklistItems, original.inspectionChecklistItems);
assert.equal(review.summary.workerResponses, 3);
assert.equal(review.summary.newLiveCallsThisInvocation, 0);
assert.equal(review.inputReadiness.sectionsWithoutInputs, 10);
assert.equal(review.inputReadiness.status, 'incomplete');
assert.equal(review.summary.independentRecoveryScore, null);
assert.equal(review.maintenanceRegimeAiCalls, 0);
assert.equal(snapshot.baseRuleRevision, 4);
assert(snapshot.evidenceRecords.filter(record => record.kind === 'voice_claim').every(record => record.quality.issues.length === 0));
const resolvePointer = pointer => pointer.slice(1).split('/').reduce((value, key) => value?.[key], /^\/(structuredData|standardTemplates)\//.test(pointer) ? input : input.appExport);
for (const plan of snapshot.sectionPlans) for (const use of plan.evidenceUses) for (const id of use.evidenceIds) {
  const record = snapshot.evidenceRecords.find(record => record.evidenceId === id);
  assert.notEqual(resolvePointer(record.sourceRef.pointer), undefined, record.sourceRef.pointer);
}
for (const section of review.sections) {
  const loaded = await loadGenericOutlineHeldOutReview({ evaluationCaseId: review.caseId, sectionId: section.sectionId });
  assert.equal(loaded.originalSectionContent, section.originalSectionContent);
  assert.equal(loaded.generatedContent, section.generatedContent);
  assert.equal(loaded.aiCandidateContent, section.aiCandidateContent);
  assert.deepEqual(loaded.appEvidence, section.appEvidence);
  assert.deepEqual(loaded.inputReadiness, review.inputReadiness);
  assert.equal(loaded.metrics.score, null);
  assert.equal(loaded.promotionGate.eligible, false);
  if (section.rawAiResponse) {
    assert(section.aiCandidateContent && section.aiCandidateContent !== section.generatedContent);
    const request = await read(`worker/${section.sectionId}-request.json`);
    const workerEvidence = JSON.parse(request.prompt.split('Evidence: ').at(-1));
    assert(workerEvidence.length > 0);
    for (const evidence of workerEvidence) {
      const source = snapshot.evidenceRecords.find(record => record.evidenceId === evidence.evidenceId);
      assert.equal(source.kind, 'voice_claim');
      assert.equal(source.payload.text, evidence.text);
      assert(!Object.hasOwn(evidence, 'originalReportText'));
    }
  }
}
const identityPlan = snapshot.sectionPlans.find(plan => plan.sectionId === '03-general-information');
const identitySection = review.sections.find(section => section.sectionId === identityPlan.sectionId);
const blank = identitySection.generatedContent.replace(/>([^<]+)</g, '><');
const blankCheck = evaluateSectionPlanOutput({ sectionPlan: identityPlan, evidenceRecords: snapshot.evidenceRecords, generatedContent: blank });
assert.equal(blankCheck.truthGraphEvaluation.matchedRequiredFactCount, 0, 'Empty tagged output must not earn recovery');
const changed = identitySection.generatedContent.replace('3.048 m', '99 m');
assert(evaluateSectionPlanOutput({ sectionPlan: identityPlan, evidenceRecords: snapshot.evidenceRecords, generatedContent: changed }).blockerReasons.includes('changed_captured_value'));
await assert.rejects(loadGenericOutlineHeldOutReview({ evaluationCaseId: review.caseId, sectionId: 'unknown' }));
// Independent comparison to the saved source section, not the mock constants.
const shell = review.sections.find(section => section.sectionId === '12-shell-thickness');
const shellPlan = snapshot.sectionPlans.find(plan => plan.sectionId === shell.sectionId);
const shellRows = input.appExport.utMeasurements.filter(row => row.targetKey === 'shell');
assert.equal(shellRows.length, 8);
assert.equal(shell.appEvidence.length, 8);
assert(shell.appEvidence.every(card => card.usedInGeneration));
const sourceCourses = shell.originalSectionContent.split(/STRAKE\s+\d+/).slice(1);
const nodes = parseSectionDocument({ sectionId: shell.sectionId, html: shell.generatedContent }).blocks;
const tableRows = nodes.flatMap(function visit(node) { return node.tag === 'tr' ? [node] : (node.children ?? []).flatMap(visit); });
for (const [index, text] of sourceCourses.entries()) {
  const sourceReadings = [...text.matchAll(/^\s*(?:Bottom\s+)?([1-5])\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s*$/gm)];
  assert.equal(sourceReadings.length, 5);
  for (const match of sourceReadings) {
    const point = Number(match[1]);
    const expected = match.slice(2).map(Number);
    for (const [column, direction] of ['North', 'East', 'South', 'West'].entries()) {
      const row = shellRows.find(row => row.course === index + 1 && row.laneId === direction);
      assert.equal(row[`value${point}`], expected[column], 'Source value or course/direction/point changed');
    }
    const label = `Strake ${index + 1} · ${point === 1 ? 'Bottom 1' : point}`;
    const output = tableRows.find(row => reportNodeText(row.children[0]) === label);
    assert(output, `Missing output row: ${label}`);
    assert.deepEqual(output.children.slice(1).map(reportNodeText), expected.map(value => `${value.toFixed(2)} mm`));
  }
  for (const match of text.matchAll(/^\s*(Min|Mean|Max)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s*$/gm)) {
    const row = tableRows.find(row => reportNodeText(row.children[0]) === `Strake ${index + 1} · ${match[1]}`);
    assert.deepEqual(row.children.slice(1).map(reportNodeText), match.slice(2).map(value => `${value} mm`), 'Computed summary differs from source');
    assert.equal(row.attrs['data-laiq-provenance'], 'calculation');
  }
}
assert.equal(sourceCourses.length, 2);
for (const record of snapshot.evidenceRecords.filter(record => record.payload.inputCells)) for (const cell of record.payload.inputCells) assert.equal(resolvePointer(cell.sourcePointer), cell.value);
for (const mutation of [
  rows => rows.pop(),
  rows => { rows[0].value3 = null; },
  rows => { rows[0].laneId = rows[1].laneId; },
  rows => { rows[0].unitCode = 'in'; },
]) {
  const rows = structuredClone(shellRows); mutation(rows);
  assert.equal(checkShellMeasurementCoverage({ utMeasurements: rows }).complete, false, 'An incomplete or ambiguous capture passed');
}
const changedShell = shell.generatedContent.replace('6.27 mm', '7.27 mm');
const changedShellCheck = evaluateSectionPlanOutput({ sectionPlan: shellPlan, evidenceRecords: snapshot.evidenceRecords, generatedContent: changedShell });
assert(changedShellCheck.blockerReasons.includes('unsupported_numeric_claim'));
assert(changedShellCheck.truthGraphEvaluation.requiredFactRecall < 1);
const previousRequest = await read('revisions/before-shell-measurements/worker/01-scope-request.json');
const currentRequest = await read('worker/01-scope-request.json');
const { createHash } = await import('node:crypto');
const key = createHash('sha256').update(JSON.stringify(previousRequest)).digest('hex');
const response = await read(`revisions/before-shell-measurements/worker/01-scope-${key}.json`);
assert.equal(rebindEvaluationCache(previousRequest, currentRequest, response).cacheReplay.newAiCalls, 0);
for (const changed of [
  { ...currentRequest, prompt: currentRequest.prompt.replace('Roof UT on the job list.', 'Roof UT was not done.') },
  { ...currentRequest, prompt: currentRequest.prompt.replace('"entityId":null', '"entityId":"another-tank"') },
  { ...currentRequest, prompt: `New instruction.\n${currentRequest.prompt}` },
]) assert.throws(() => rebindEvaluationCache(previousRequest, changed, response));
console.log('Inspector-note audit passed: 40 source-verified shell readings, 24 derived summary cells, 8 raw evidence cards, exact location/point/unit preservation, missing-input and changed-value negative controls, safe cached AI replay, 21 section statuses and no promotion.');
