import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ABLATION_CASES, SECTION_IDS, encode, sha } from '../experiments/section-kb-ablation.mjs';
import { verifyAblationReview } from '../experiments/section-kb-ablation-review-backend.mjs';
import { loadGenericOutlineHeldOutReview, matchesGenericOutlineReviewCase } from '../experiments/generic-outline-review-backend.mjs';
const root = new URL('../../docs/reviews/data/tk5452-kb-ablation-v1/', import.meta.url);
const bytes = await readFile(new URL('comparison.json', root));
const review = JSON.parse(bytes);
const manifest = JSON.parse(await readFile(new URL('review-manifest.json', root)));
verifyAblationReview(review, bytes, manifest);
const preview = JSON.parse(await readFile(new URL('live-request-preview.json', root)));
for (const row of review.results) assert.equal(row.requestHash, preview.requests.find(r=>r.sectionId===row.sectionId&&r.arm===row.arm).requestHash);
assert.throws(()=>verifyAblationReview(review, Buffer.from('changed'), manifest));
for (const mutate of [
  r=>r.results.pop(), r=>{ r.results[1].baseRequestHash='different'; },
  r=>{r.results[1].modelId='different';}, r=>{r.results[1].arm=r.results[0].arm;},
  r=>{r.policyPromotionPerformed=true;}, r=>{r.results[0].inputSha256='different';},
]) {
  const changed=structuredClone(review);mutate(changed);const changedBytes=Buffer.from(encode(changed));
  assert.throws(()=>verifyAblationReview(changed,changedBytes,{...manifest,comparisonSha256:sha(changedBytes)}));
}
for (const sectionId of SECTION_IDS) {
  const loaded=[];
  for (const choice of ABLATION_CASES) {
    assert(matchesGenericOutlineReviewCase(choice.evaluationCaseId));
    const result=await loadGenericOutlineHeldOutReview({evaluationCaseId:choice.evaluationCaseId,sectionId});
    const saved=review.results.find(r=>r.sectionId===sectionId&&r.arm===choice.arm);
    assert.equal(result.aiCandidateContent,saved.candidateContent);
    assert.equal(result.generatedContent,saved.retainedContent);
    assert.equal(result.rawAiResponse.accepted,saved.generationRun.usedLiveModel);
    assert.equal(result.comparisonExperiment.wordCount,saved.words);
    assert.equal(result.promotionGate.eligible,false);
    assert.equal(result.metrics.score,null);
    assert.equal(result.metrics.requiredFactRecall,null,'Conservative paraphrase checks are not semantic recovery');
    assert.equal(result.sections.length,2);
    assert.equal(result.inputReadiness.status,'supplied');
    await assert.rejects(loadGenericOutlineHeldOutReview({evaluationCaseId:choice.evaluationCaseId,sectionId,evalRunId:'wrong-run'}),e=>e.statusCode===404);
    await assert.rejects(loadGenericOutlineHeldOutReview({evaluationCaseId:choice.evaluationCaseId,sectionId:'12-shell-thickness'}),e=>e.statusCode===404);
    loaded.push(result);
  }
  assert.equal(loaded[0].originalSectionContent,loaded[1].originalSectionContent);
  assert.deepEqual(loaded[0].appEvidence,loaded[1].appEvidence);
  assert.notEqual(loaded[0].aiCandidateContent,loaded[1].aiCandidateContent);
}
const old=await loadGenericOutlineHeldOutReview({evaluationCaseId:'eval-tk5452-inspector-notes-v2',sectionId:'12-shell-thickness'});
assert.equal(old.sections.length,21);
assert.equal(old.revisionChoices.filter(c=>c.sectionIds?.length===2).length,2);
console.log('KB comparison review audit passed: all approved requests match, paired inputs/reference/evidence match, candidates stay separate from retained drafts, invalid/tampered runs fail, existing 21-section review remains available.');
