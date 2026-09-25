import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {digest} from '../observation-context.mjs';
import {SCENARIOS,OBSERVATION_CASES} from '../experiments/kb-observation-comparison.mjs';
import {verifyObservationReview} from '../experiments/kb-observation-review-backend.mjs';
import {loadGenericOutlineHeldOutReview} from '../experiments/generic-outline-review-backend.mjs';
const root=new URL('../../docs/reviews/data/tk5452-kb-observations-v1/',import.meta.url);
const bytes=await readFile(new URL('comparison.json',root)),review=JSON.parse(bytes);
const manifest=JSON.parse(await readFile(new URL('review-manifest.json',root),'utf8'));
const preview=JSON.parse(await readFile(new URL('live-request-preview.json',root),'utf8'));
verifyObservationReview(review,bytes,manifest);
for(const row of review.results){
 const request=preview.requests.find(r=>r.group===row.group&&r.arm===row.arm);
 assert.equal(row.requestHash,request.requestHash);assert.equal(row.baseInputHash,request.baseInputHash);
 assert.equal(row.modelId,preview.modelId);
}
for(const mutate of [r=>r.results.pop(),r=>{r.policyPromotionPerformed=true;},r=>{r.results[0].checks.accepted=true;},r=>{r.results[0].baseInputHash='wrong';}]){
 const copy=structuredClone(review);mutate(copy);const altered=Buffer.from(JSON.stringify(copy));assert.throws(()=>verifyObservationReview(copy,altered,{...manifest,comparisonSha256:digest(altered)}));
}
for(const scenario of SCENARIOS){
 const pair=[];
 for(const c of OBSERVATION_CASES){
  const loaded=await loadGenericOutlineHeldOutReview({evaluationCaseId:c.evaluationCaseId,sectionId:scenario.id});
  assert.equal(loaded.sections.length,12);assert.equal(loaded.rawAiResponse.accepted,false);assert.equal(loaded.metrics.score,null);assert.equal(loaded.promotionGate.eligible,false);
  assert(loaded.originalSectionContent.includes('➢'));assert(loaded.aiCandidateContent.includes(scenario.label));
  assert.equal(loaded.comparisonExperiment.caseIds.length,2);
  await assert.rejects(loadGenericOutlineHeldOutReview({evaluationCaseId:c.evaluationCaseId,sectionId:scenario.id,evalRunId:'wrong'}),e=>e.statusCode===404);
  pair.push(loaded);
 }
 assert.equal(pair[0].originalSectionContent,pair[1].originalSectionContent);
 assert.deepEqual(pair[0].appEvidence.filter(e=>e.sourceClass==='app_voice'),pair[1].appEvidence.filter(e=>e.sourceClass==='app_voice'));
 assert(!pair[0].appEvidence.some(e=>e.sourceClass==='historical_case'));
}
console.log('Observation review audit passed: 24 saved outputs match exact approved requests; paired inputs/references match; tampered artifacts and wrong runs rejected; no acceptance or promotion.');
