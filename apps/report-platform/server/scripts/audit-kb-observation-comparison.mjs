import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {bindObservation,verifyObservation,resolveComponent,digest} from '../observation-context.mjs';
import {SCENARIOS,GLOSSARY} from '../experiments/kb-observation-comparison.mjs';
import {retrieveHistoricalCases,makeRecommendationRequest,validateRecommendationResponse} from '../observation-recommendation.mjs';
const root=new URL('../../docs/reviews/data/tk5452-kb-observations-v1/',import.meta.url);
const read=async name=>JSON.parse(await readFile(new URL(name,root),'utf8'));
const manifest=await read('manifest.json');
for(const [file,hash] of Object.entries(manifest.files))assert.equal(digest(await readFile(new URL(file,root))),hash,file);
const input=await read('original-mock.json'),observations=await read('observations.json'),cases=await read('historical-cases.json'),retrieval=await read('retrieval.json');
const sources=input.appExport.voiceNotes.map((n,i)=>({sourceId:n.voiceNoteId,sourcePointer:`/voiceNotes/${i}/transcriptText`,text:n.transcriptText}));
assert.equal(observations.length,12);assert.equal(new Set(observations.map(o=>o.componentId)).size,12);
let terminologyChecks=0;
for(const o of observations){
 verifyObservation(o,sources,GLOSSARY);
 assert.equal(o.sourcePackageHash,manifest.sourcePackageHash);
 assert(!/recommend|should/i.test(o.originalWording));
 for(const text of [o.identityEvidence.text,o.identityEvidence.text.toUpperCase(),`Inspector note: ${o.identityEvidence.text}`]){
  assert.equal(resolveComponent(text,GLOSSARY).componentId,o.componentId);terminologyChecks++;
 }
 const changed=structuredClone(o);changed.identityEvidence.start++;assert.throws(()=>verifyObservation(changed,sources,GLOSSARY));
 const wrong=structuredClone(o);wrong.componentId='tank_foundation';assert.throws(()=>verifyObservation(wrong,sources,GLOSSARY));
 assert.deepEqual(retrieveHistoricalCases(o,cases),retrieval[o.observationId]);
 assert(retrieval[o.observationId].every(c=>c.componentTags.includes(o.tags[0])),'Condition alone cannot retrieve a different component');
}
assert.equal(resolveComponent('west projection',GLOSSARY).status,'unresolved');
assert.equal(resolveComponent('Floor projection and external shell',GLOSSARY).status,'ambiguous');
assert.throws(()=>bindObservation({observationId:'x',componentId:'floor_projection',sources,claims:[{sourceId:sources[4].sourceId,quote:input.appExport.voiceNotes[4].transcriptText}],identity:{sourceId:sources[4].sourceId,quote:'Floor projection is about 2.5 inches wide.'},glossary:GLOSSARY}),'Action sentences must be withheld');
const preview=await read('live-request-preview.json');
assert.equal(preview.requests.length,6);
for(const p of preview.requests){
 assert.equal(p.requestHash,digest(`${JSON.stringify(p.request,null,2)}\n`));
 const selected=observations.filter(o=>p.observationIds.includes(o.observationId));
 const expectedCases=Object.fromEntries(selected.map(o=>[o.observationId,p.arm==='with_kb'?retrieval[o.observationId]:[]]));
 const actual=makeRecommendationRequest(selected,expectedCases);
 assert.deepEqual(actual.request,p.request);assert.equal(actual.baseInputHash,p.baseInputHash);
 const other=preview.requests.find(r=>r.group===p.group&&r.arm!==p.arm);assert.equal(other.baseInputHash,p.baseInputHash);
 assert(!p.request.prompt.includes('evaluator-rubric')&&!p.request.prompt.includes('Synthetic Evaluation Client'));
 if(p.arm==='without_kb')assert(!p.request.prompt.includes('case-shell-coating-461'));
 const response={observations:selected.map(o=>({observationId:o.observationId,componentId:o.componentId,observationText:`${o.componentLabel}: ${o.originalWording}`,proposedActions:[],clarificationQuestions:[],status:'clarification_needed'}))};
 assert(validateRecommendationResponse(response,selected,expectedCases).every(r=>r.mechanicalChecksPassed));
 response.observations[0].proposedActions=[{action:'Test',sourceCaseIds:['invented'],applicability:'Test',differencesOrMissingInformation:[],technicalBasisStatus:'not_verified',requiresInspectorConfirmation:true}];
 assert(validateRecommendationResponse(response,selected,expectedCases)[0].blockers.includes('Unretrieved historical citation'));
}
// This isolated audit can read the target reference; only fingerprints/scores
// leave it. The generation runner never reads reference prose until calls finish.
const reference=JSON.parse(await readFile(new URL('../../docs/reviews/data/tk5452-inspector-evaluation-v2/review.json',import.meta.url),'utf8'));
const shingles=text=>{const words=text.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean);return new Set(words.slice(0,-6).map((_,i)=>words.slice(i,i+7).join(' ')));};
const targetText=reference.sections.map(s=>s.originalSectionContent).join(' '), targetShingles=shingles(targetText);
const audit=await read('source-audit.json'),reportGroups=new Map();
for(const source of audit.sources){assert.notEqual(source.source_sha256,reference.source.sha256);assert.notEqual(source.asset_lineage_key,audit.target.asset_lineage_key);const texts=reportGroups.get(source.document_id)??[];texts.push(source.content);reportGroups.set(source.document_id,texts);}
const similarity=[...reportGroups].map(([reportId,texts])=>{const set=shingles(texts.join(' ')),intersection=[...set].filter(s=>targetShingles.has(s)).length;return {reportId,sevenWordShingleJaccard:intersection/(set.size+targetShingles.size-intersection),threshold:0.65};});
assert(similarity.every(row=>row.sevenWordShingleJaccard<row.threshold),'Near duplicate source');
// Exact duplicate case passages must not be counted as additional cases.
assert.equal(new Set(cases.map(c=>digest(c.observation.text+c.recommendedAction.text))).size,cases.length);
for(const c of cases){assert.equal(c.review.expertApproved,false);assert.equal(c.implementation.state,'unknown');assert.equal(c.outcome.state,'unknown');assert(c.applicabilityConditions.expertAdditions.length===0);}
const result={passed:true,sourceBoundObservations:12,terminologySmokeChecks:terminologyChecks,ambiguityChecks:2,plannedCalls:6,sourceIsolation:similarity,
 limitations:['Terminology smoke checks are authored string variants, not an inspector-note interpretation benchmark.','Near-duplicate screening uses source hash, asset lineage and lexical overlap of selected passages; semantic duplicates cannot be ruled out corpus-wide.','Case links and rubric await independent inspector review.'],policyPromotionPerformed:false};
await writeFile(new URL('preflight-audit.json',root),`${JSON.stringify(result,null,2)}\n`);
console.log(JSON.stringify(result,null,2));
