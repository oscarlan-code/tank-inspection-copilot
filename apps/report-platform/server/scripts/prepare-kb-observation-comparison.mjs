#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { bindObservation, verifyObservation, sourceSpan, digest } from '../observation-context.mjs';
import { SCENARIOS, GLOSSARY, GROUPS, RUBRIC, COMPARISON_CONTRACT } from '../experiments/kb-observation-comparison.mjs';
import { retrieveHistoricalCases, makeRecommendationRequest } from '../observation-recommendation.mjs';
import { validateHistoricalSource } from '../experiments/section-kb-ablation.mjs';
const root=resolve('docs/reviews/data/tk5452-kb-observations-v1');
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const encode=value=>`${JSON.stringify(value,null,2)}\n`;
await mkdir(root,{recursive:true});
const save=async(name,value)=>{
 const bytes=typeof value==='string'?value:encode(value);
 try {await writeFile(`${root}/${name}`,bytes,{flag:'wx'});} catch(error){if(error.code!=='EEXIST')throw error;assert.equal(await readFile(`${root}/${name}`,'utf8'),bytes,`Prepared artifact changed: ${name}`);}
};
const mockBytes=await readFile('docs/reviews/data/tk5452-inspector-evaluation-v2/generation-input.json');
const input=JSON.parse(mockBytes), packageHash=digest(mockBytes);
const sources=input.appExport.voiceNotes.map((row,index)=>({sourceId:row.voiceNoteId,sourcePointer:`/voiceNotes/${index}/transcriptText`,text:row.transcriptText}));
const observations=SCENARIOS.map(s=>bindObservation({observationId:s.id,componentId:s.component,sources,
 claims:s.claims.map(([index,quote])=>({sourceId:sources[index].sourceId,quote})),identity:{sourceId:sources[s.identity[0]].sourceId,quote:s.claims.find(([index,quote])=>index===s.identity[0]&&quote.toLowerCase().includes(s.identity[1].toLowerCase()))[1]},
 glossary:GLOSSARY,sourcePackageHash:packageHash,tags:s.tags}));
observations.forEach(o=>verifyObservation(o,sources,GLOSSARY));
await save('original-mock.json',mockBytes.toString());
await save('glossary.json',GLOSSARY);
await save('observations.json',observations);
await save('evaluator-rubric.json',{status:'draft_not_independently_reviewed',generatorAccess:false,rubric:RUBRIC});
const previous=await read('docs/reviews/data/tk5452-kb-ablation-v1/historical-source-audit.json');
const target=previous.target;
const inventory=await read(process.argv[2]??'/private/tmp/laiq-kb-case-source-snapshot.json');
const byId=new Map(inventory.map(s=>[s.chunk_id,s]));
const rec10='chunk_2d81a704312da11bf63c927a', rec461='chunk_81209795b5c1c5ea46cefb05';
const dates=new Map(previous.sources.filter(s=>s.section_key==='repair-recommendations').map(s=>[s.document_id,s]));
for(const date of dates.values()) validateHistoricalSource(date,target);
const normalize=text=>text.replace(/\s+/g,' ').trim();
function paragraph(chunkId,needle){
 const source=byId.get(chunkId);assert(source,chunkId);
 // Normalize only for finding the original paragraph; source text/spans stay exact.
 const matches=source.content.split(/\n\s*\n/).filter(p=>normalize(p).includes(needle));assert.equal(matches.length,1,needle);
 return sourceSpan({sourceId:chunkId,sourcePointer:`kb_chunks/${chunkId}/content`,text:source.content},matches[0]);
}
const specs=[
 ['case-shell-coating-461',['shell'],['coating_failure'],'chunk_5b04f17130ffdac4a5370f71','Spot coating failure were observed',rec461,'The entire shell and roof external'],
 ['case-roof-nozzles-10',['roof_nozzle','roof','roof_attachment'],['coating_failure','corrosion'],'chunk_9fe6897cb3a23aaf411c75df','All roof nozzles were found visually satisfactory',rec10,'The entire shell and roof external'],
 ['case-firewater-piping-10',['piping'],['coating_failure'],'chunk_309949190d8131534f42ee55','Fire water sprinker lines attached',rec10,'The entire shell and roof external'],
 ['case-missing-telltales-10',['shell_telltale'],['missing_holes'],'chunk_309949190d8131534f42ee55','No tell-tale holes were found',rec10,'All shell nozzles reinforcement pads should be installed'],
 ['case-plugged-telltales-461',['shell_telltale'],['plugged_holes'],'chunk_c832000e665ac56b80117c4d','Tell-tale hole found on shell nozzles S4 was plugged',rec461,'It is recommended that tell-tale hole plugs'],
 ['case-damaged-access-461',['access_structure'],['perforation','heavy_corrosion'],'chunk_07e3ac6bab6d6924928d3ced','Both walkways were found to exhibit perforations',rec461,'Access structures and walkways found broken'],
 ['case-plinth-seal-461',['floor_projection'],['deteriorated_seal'],'chunk_3570fc9093d5aa77c89bdd6c','Sticker like soft material plinth seal',rec461,'It is recommended to replace weathered'],
];
const cases=specs.map(([caseId,componentTags,conditionTags,observationChunk,obsNeedle,actionChunk,actionNeedle])=>{
 const observation=paragraph(observationChunk,obsNeedle),action=paragraph(actionChunk,actionNeedle);
 const source=byId.get(observationChunk),date=dates.get(source.document_id);
 assert.equal(source.document_id,byId.get(actionChunk).document_id,'Cross-report pair');
 return {caseId,componentTags,conditionTags,observation:{state:'source_explicit',...observation},recommendedAction:{state:'source_explicit',...action},
 severityAndMeasurements:{state:'not_separately_extracted',value:null,sourcePassage:observation},
 rationale:{state:'not_stated_as_separate_engineering_rationale',value:null},
 applicabilityConditions:{sourceExplicit:[observation],expertAdditions:[],otherConditions:'unknown'},implementation:{state:'unknown',value:null},outcome:{state:'unknown',value:null},
 provenance:{reportId:source.corpus_report_id,sourceSha256:source.source_sha256,assetLineage:source.asset_lineage_key,issuedOn:date.issuedOn,pages:[...new Set([...source.page_numbers_json,...byId.get(actionChunk).page_numbers_json])]},
 review:{status:'checked',reviewer:'Codex source-link check',expertApproved:false,pairBasis:'Same-report physical component and condition linked to an explicit action passage; not an engineering endorsement.'}};
});
const usedIds=new Set(cases.flatMap(c=>[c.observation.sourceId,c.recommendedAction.sourceId]));
const selected=[...usedIds].map(id=>byId.get(id));
for(const source of selected){
 const date=dates.get(source.document_id);assert(date);
 for(const key of ['dataset_split','document_split','eligibility_role','retrieval_eligible','approval_status','visibility_code','tenant_id','workspace_id','source_sha256','binary_sha256','asset_lineage_key','crossSplitHash','crossSplitLineage'])assert.equal(source[key],date[key],`${source.chunk_id}:${key}`);
 assert.equal(source.include_in_retrieval,true);assert.equal(source.lane_code,'wording_precedent');assert(['approved','reviewed'].includes(source.review_status));
 assert.equal(digest(source.content),source.content_sha256);assert(source.page_numbers_json.length);
}
await save('historical-cases.json',cases);
await save('source-audit.json',{target,selection:'Small source-checked subset from two eligible earlier reports; not the full recommendation index.',sources:selected,dateProofs:[...dates.values()]});
const retrieved=Object.fromEntries(observations.map(o=>[o.observationId,retrieveHistoricalCases(o,cases)]));
await save('retrieval.json',retrieved);
const requests=[];
for(const group of GROUPS){
 const groupObservations=observations.filter(o=>SCENARIOS.find(s=>s.id===o.observationId).group===group);
 for(const arm of ['without_kb','with_kb']){
  const casesById=Object.fromEntries(groupObservations.map(o=>[o.observationId,arm==='with_kb'?retrieved[o.observationId]:[]]));
  const built=makeRecommendationRequest(groupObservations,casesById);
  requests.push({group,arm,baseInputHash:built.baseInputHash,requestHash:digest(encode(built.request)),observationIds:groupObservations.map(o=>o.observationId),request:built.request});
 }
}
await save('live-request-preview.json',{evaluationOnly:true,modelId:'gpt-5.6-sol',destination:'Configured OpenAI report-generation worker',totalCalls:requests.length,requests});
const files={};
for(const name of ['original-mock.json','glossary.json','observations.json','evaluator-rubric.json','historical-cases.json','source-audit.json','retrieval.json','live-request-preview.json'])files[name]=digest(await readFile(`${root}/${name}`));
await save('manifest.json',{contractVersion:COMPARISON_CONTRACT,evaluationOnly:true,policyPromotionPerformed:false,sourceDerivedMock:true,independentBenchmark:false,sourcePackageHash:packageHash,observationCount:observations.length,reportCount:1,plannedCalls:requests.length,files});
console.log(JSON.stringify({preparedObservations:observations.length,cases:cases.length,plannedCalls:requests.length,retrieval:observations.map(o=>({id:o.observationId,cases:retrieved[o.observationId].map(c=>c.caseId)}))},null,2));
