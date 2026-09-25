#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {digest} from '../observation-context.mjs';
import {getAiStatus,runStructuredCodexJob} from '../codex-cli.mjs';
import {validateRecommendationResponse,composeObservationDraft} from '../observation-recommendation.mjs';
const root=new URL('../../docs/reviews/data/tk5452-kb-observations-v1/',import.meta.url);
const read=async name=>JSON.parse(await readFile(new URL(name,root),'utf8'));
const encode=value=>`${JSON.stringify(value,null,2)}\n`;
const save=async(name,value)=>writeFile(new URL(name,root),encode(value));
const mode=process.argv[2];assert(['--live','--replay'].includes(mode));
const manifest=await read('manifest.json');
for(const [name,hash]of Object.entries(manifest.files))assert.equal(digest(await readFile(new URL(name,root))),hash,name);
const preflight=await read('preflight-audit.json');assert.equal(preflight.passed,true);
const observations=await read('observations.json'),retrieval=await read('retrieval.json'),preview=await read('live-request-preview.json');
const status=getAiStatus();if(mode==='--live')assert(status.configured&&status.modelId===preview.modelId);
await mkdir(new URL('worker/',root),{recursive:true});
let liveCalls=0;const results=[];
// Sequential and resumable. No automatic retries or score-driven regeneration.
for(const p of preview.requests){
 assert.equal(digest(encode(p.request)),p.requestHash);
 const cache=`worker/${p.group}-${p.arm}-${p.requestHash}.json`;
 let response;
 try{response=await read(cache);}catch(error){
  if(error.code!=='ENOENT'||mode!=='--live')throw error;
  liveCalls++;assert(liveCalls<=manifest.plannedCalls);
  console.log(JSON.stringify({group:p.group,arm:p.arm,status:'calling_worker',liveCalls}));
  response=await runStructuredCodexJob(p.request);await save(cache,response);
 }
 assert.equal(response.aiStatus.modelId,preview.modelId);
 const selected=observations.filter(o=>p.observationIds.includes(o.observationId));
 const casesById=Object.fromEntries(selected.map(o=>[o.observationId,p.arm==='with_kb'?retrieval[o.observationId]:[]]));
 const checks=validateRecommendationResponse(response.parsed,selected,casesById);
 for(const row of response.parsed.observations){
  const observation=selected.find(o=>o.observationId===row.observationId);
  results.push({observationId:row.observationId,arm:p.arm,group:p.group,requestHash:p.requestHash,baseInputHash:p.baseInputHash,modelId:response.aiStatus.modelId,output:row,
   checks:checks.find(c=>c.observationId===row.observationId),retrievedCases:casesById[row.observationId],
   candidateContent:composeObservationDraft(observation,row),retainedContent:composeObservationDraft(observation),words:JSON.stringify(row).split(/\s+/).length});
 }
 console.log(JSON.stringify({group:p.group,arm:p.arm,status:'saved',observations:selected.length,mechanicalBlockers:checks.flatMap(c=>c.blockers)}));
}
assert.equal(results.length,24);
// Reference prose is loaded only after every paired worker result is saved.
const old=JSON.parse(await readFile(new URL('../../docs/reviews/data/tk5452-inspector-evaluation-v2/review.json',import.meta.url),'utf8'));
const review={...manifest,createdAtIso:new Date().toISOString(),liveCallsThisInvocation:liveCalls,observations,results,
 source:old.source,referenceSections:old.sections.filter(s=>['04-inspection-report','05-recommendations'].includes(s.sectionId)).map(s=>({sectionId:s.sectionId,pages:s.pages,originalSectionContent:s.originalSectionContent})),
 limitations:[...preflight.limitations,'12 situations from one source-derived mock, grouped into three four-observation requests per arm. Not 12 independent inspections.','Recommendations were withheld; results are proposals, not accepted report content. No independent correctness score or promotion evidence.','Retrieval is a small frozen subset from two earlier reports, not a full-corpus retrieval benchmark.']};
await save('comparison.json',review);
await save('review-manifest.json',{contractVersion:'observation_comparison_review_v1',comparisonSha256:digest(encode(review)),sourcePackageHash:manifest.sourcePackageHash,evaluationOnly:true});
console.log(JSON.stringify({complete:true,observations:12,pairedOutputs:results.length,liveCalls,mechanicalPasses:results.filter(r=>r.checks.mechanicalChecksPassed).length}));
