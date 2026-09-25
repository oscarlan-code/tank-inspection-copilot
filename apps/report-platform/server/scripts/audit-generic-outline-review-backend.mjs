import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  GenericOutlineReviewError, matchesGenericOutlineReviewCase,
  loadGenericOutlineHeldOutReview, resolveGenericOutlineSource,
} from '../experiments/generic-outline-review-backend.mjs';

const base = fileURLToPath(new URL('../../docs/reviews/data/syn025-current-only-v3/', import.meta.url));
const ids = ['identity', 'scope', 'regime', 'findings', 'recommendations', 'methods', 'checklist', 'thickness', 'layout', 'photos', 'references', 'summary'];
const legacyCases = ['eval-generic-syn025-v3-tk5452', 'eval-generic-syn025-v3-su4'];
const newCases = ['eval-generic-syn025-v3-format-v2-tk5452', 'eval-generic-syn025-v3-format-v2-su4'];
const manifestPath = new URL('../experiments/generic-outline-review-format-v2-manifest.json', import.meta.url);
const manifest = await readFile(manifestPath, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
const cases = [...legacyCases, ...(manifest ? newCases : [])];
const frozen = Object.fromEntries(await Promise.all(ids.map(async id => {
  const bytes = await readFile(join(base, `evaluation-12-live/sections/${id}.json`));
  return [id, { sha: sha(bytes), record: JSON.parse(bytes) }];
})));
const revised = manifest ? Object.fromEntries(await Promise.all(ids.map(async id => {
  const bytes = await readFile(join(base, `evaluation-12-format-v2/sections/${id}.json`));
  return [id, { sha: sha(bytes), record: JSON.parse(bytes) }];
}))) : null;
const revisedSummary = manifest ? JSON.parse(await readFile(join(base, 'evaluation-12-format-v2/summary.json'), 'utf8')) : null;
const nativeBefore = sha(await readFile(join(base, 'native/export.json')));
assert.equal(matchesGenericOutlineReviewCase(cases[0]), true);
assert.equal(matchesGenericOutlineReviewCase(cases[1]), true);
for (const id of newCases) assert.equal(matchesGenericOutlineReviewCase(id), true);
for (const id of [undefined, '', 'constructor', '__proto__', '../native/export.json', 'eval-generic-syn025-v3-unknown']) {
  assert.equal(matchesGenericOutlineReviewCase(id), false);
}
const defaultReview = await loadGenericOutlineHeldOutReview();
assert.equal(defaultReview.evaluationCaseId, cases[0]);
assert.equal(defaultReview.sectionId, 'identity');
let count = 0;
for (const evaluationCaseId of cases) {
  const isRevised = newCases.includes(evaluationCaseId);
  const expected = isRevised ? revised : frozen;
  const expectedChoices = isRevised ? newCases : legacyCases;
  let accepted = 0, aiResponses = 0;
  for (const [index, sectionId] of ids.entries()) {
    const result = await loadGenericOutlineHeldOutReview({ evaluationCaseId, sectionId });
    assert.equal(result.generatedContent, expected[sectionId].record.result.draft.content, 'Retained output must not become raw AI wording.');
    assert.equal(result.generatorContractVersion, 'section_planned_generation_v2');
    assert.equal(result.generationBackend, 'generic_outline_evaluation_v1');
    assert.equal(result.evaluationOnly, true);
    assert.equal(result.available, true);
    assert.equal(result.allSectionsComplete, true);
    assert.equal(result.promotionGate.eligible, false);
    assert.equal(Object.hasOwn(result, 'metrics'), false, 'No unreviewed diagnostic becomes a recovery score.');
    assert.equal(Object.hasOwn(result, 'sourcePdfPath'), false);
    assert.equal(Object.hasOwn(result, 'absolutePath'), false);
    assert.equal(result.referenceChoices.length, 2);
    assert.deepEqual(result.referenceChoices.map(choice => choice.evaluationCaseId), expectedChoices, 'Changing the comparison reference must stay within the saved revision.');
    const sourceIndex = /-tk5452$/.test(evaluationCaseId) ? 0 : 1;
    assert.deepEqual(result.revisionChoices, [
      { evaluationCaseId: legacyCases[sourceIndex], label: 'Original outline' },
      ...(manifest ? [{ evaluationCaseId: newCases[sourceIndex], label: 'Revised report outline' }] : []),
    ], 'Changing outline revision must preserve the chosen reference and hide revisions awaiting registration.');
    if (isRevised) {
      const entry = revisedSummary.sections.find(section => section.sectionId === sectionId);
      assert.equal(result.sectionTitle, entry.reportTitle ?? entry.title);
      assert(result.diagnosticNotes.some(note => /Report format revision 2/.test(note)));
      const profile = revisedSummary.reportProfileId ?? revisedSummary.reportProfile?.id ?? entry.reportProfileId;
      const formatter = revisedSummary.formatterContractVersion ?? entry.formatterContractVersion;
      if (profile) assert(result.diagnosticNotes.includes(`Report presentation profile: ${profile}.`));
      if (formatter) assert(result.diagnosticNotes.includes(`Deterministic formatter contract: ${formatter}.`));
    }
    assert.deepEqual(result.sections.map(section => section.sectionId), ids);
    assert.equal(result.previousSectionId, ids[index - 1] ?? null);
    assert.equal(result.nextSectionId, ids[index + 1] ?? null);
    assert(result.diagnosticNotes.some(note => /different inspections/.test(note)));
    if (result.rawAiResponse) {
      aiResponses++;
      accepted += Number(result.rawAiResponse.accepted);
      assert.equal(result.rawAiResponse.accepted, expected[sectionId].record.result.generationRun.usedLiveModel);
      assert(result.rawAiResponse.findings.every(finding => typeof finding.text === 'string'));
    }
    assert.equal(result.companionArtifacts.length, sectionId === 'layout' ? 3 : ['photos', 'findings'].includes(sectionId) ? 2 : 0);
    for (const artifact of result.companionArtifacts) {
      assert.match(artifact.dataUri, /^data:image\/(?:png|jpeg|svg\+xml);base64,/);
      assert.equal(Object.hasOwn(artifact, 'svg'), false, 'SVG is rendered as an image, not active inline markup.');
    }
    if (sectionId === 'regime') {
      assert.equal(result.rawAiResponse, undefined);
      assert(result.diagnosticNotes.some(note => /pending/.test(note)));
      assert(result.diagnosticNotes.some(note => /template/i.test(note)));
    }
    if (['summary', 'references'].includes(sectionId) || (sectionId === 'photos' && /-tk5452$/.test(evaluationCaseId))) {
      assert.equal(result.originalSectionContent, '');
      assert.deepEqual(result.referenceRevision.pages, []);
      assert(result.diagnosticNotes.some(note => /No equivalent standalone/.test(note)));
    }
    if (sectionId === 'recommendations' && /-su4$/.test(evaluationCaseId)) {
      assert.doesNotMatch(result.originalSectionContent, /6\s+POST INSPECTION REPORT/);
      assert.match(result.originalSectionContent, /REPAIR RECOMMENDATIONS/);
    }
    if (sectionId === 'thickness' && /-tk5452$/.test(evaluationCaseId)) {
      assert(result.diagnosticNotes.some(note => /V1302A/.test(note)));
    }
    count++;
  }
  assert.equal(aiResponses, isRevised ? revisedSummary.workerResponses : 9);
  assert.equal(accepted, isRevised ? revisedSummary.sectionsUsingAcceptedAiWording : 2);
  const source = await resolveGenericOutlineSource(evaluationCaseId);
  assert.equal(sha(await readFile(source.absolutePath)), source.sha256);
  assert.match(source.fileName, /\.pdf$/);
}
const sameRun = await loadGenericOutlineHeldOutReview({ evaluationCaseId: defaultReview.evaluationCaseId, sectionId: defaultReview.sectionId, evalRunId: defaultReview.evalRunId });
assert.equal(sameRun.generatedContent, defaultReview.generatedContent);
const missing = error => error instanceof GenericOutlineReviewError && error.statusCode === 404;
await assert.rejects(loadGenericOutlineHeldOutReview({ evaluationCaseId: '__proto__' }), missing);
await assert.rejects(loadGenericOutlineHeldOutReview({ sectionId: '../../native/export' }), missing);
await assert.rejects(loadGenericOutlineHeldOutReview({ evalRunId: 'missing-run' }), missing);
await assert.rejects(loadGenericOutlineHeldOutReview({ sectionId: 'scope', evalRunId: defaultReview.evalRunId }), missing);
await assert.rejects(resolveGenericOutlineSource('/etc/passwd'), missing);
if (manifest) {
  await assert.rejects(loadGenericOutlineHeldOutReview({ evaluationCaseId: newCases[0], evalRunId: defaultReview.evalRunId }), missing);
  for (const id of ids) assert.equal(sha(await readFile(join(base, `evaluation-12-format-v2/sections/${id}.json`))), revised[id].sha);
} else {
  for (const evaluationCaseId of newCases) await assert.rejects(loadGenericOutlineHeldOutReview({ evaluationCaseId }), error => error instanceof GenericOutlineReviewError && error.statusCode === 409 && error.code === 'generic_review_revision_pending');
}
for (const id of ids) assert.equal(sha(await readFile(join(base, `evaluation-12-live/sections/${id}.json`))), frozen[id].sha);
assert.equal(sha(await readFile(join(base, 'native/export.json'))), nativeBefore);
console.log(`Generic outline review backend audit passed: ${count} section/reference combinations; original run preserved with 9 responses/2 accepted; ${manifest ? 'format revision 2 verified' : 'format revision 2 registration pending (correctly returns 409)'}; revision-isolated reference choices; exact frozen drafts, separate 2 photos/3 maps, no fabricated counterparts or scores, invalid navigation rejected, input/output hashes unchanged.`);

function sha(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
