#!/usr/bin/env node
// Offline evaluation of a selected profile from the generic template catalogue.
// Uses the shared generator; never uploads/imports or changes a product profile.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { validateAndroidV3ProductExport } from '../store.mjs';
import { generatePlannedSectionDraft, PLANNED_GENERATOR_CONTRACT } from '../planned-generation.mjs';
import { evaluateSectionPlanOutput } from '../section-plan-evaluation.mjs';
import { getAiStatus, runStructuredCodexJob } from '../codex-cli.mjs';
import { escapeReportText as esc, sectionDocumentHasContent } from '../report-document.mjs';
import { buildGenericOutlineEvaluationSnapshot } from '../experiments/generic-outline-evaluation.mjs';
import { prepareGenericOutlineReviewArtifacts, renderGenericOutlineReviewArtifactsHtml } from '../experiments/generic-outline-review-artifacts.mjs';

const argv=process.argv.slice(2);
if(argv.includes('--help')) {
  console.log('Usage: node server/scripts/run-generic-outline-evaluation.mjs --input-dir CASE_DIR --output-dir NEW_DIR [--prepare-requests | --live]\nDefault: deterministic local evaluation. --prepare-requests records exact model requests without sending them. --live uses the configured worker only for routed voice. No storage upload, DB import, ASR or promotion.');
  process.exit(0);
}
const selectedModuleIds=['identity','scope','regime','findings','recommendations','methods','checklist','thickness','layout','photos','references','summary'];
function option(name){const i=argv.indexOf(name);assert(i>=0&&argv[i+1]&&!argv[i+1].startsWith('--'),`${name} required`);return resolve(argv[i+1]);}
const input=await realpath(option('--input-dir')),output=option('--output-dir');
assert(!argv.includes('--live')||!argv.includes('--prepare-requests'),'Choose live or request preparation');
const live=argv.includes('--live'),prepare=argv.includes('--prepare-requests');
assert(output!==input&&!input.startsWith(output+'/'),'Output must not contain/replace the input folder');
assert(!output.startsWith(join(input,'native')+'/'),'Native evidence folder is immutable');
await mkdir(output,{recursive:false});
const save=(name,value)=>writeFile(join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const clone=value=>JSON.parse(JSON.stringify(value));
const inputHashes={};
async function load(name){const bytes=await readFile(join(input,name));inputHashes[name]={sha256:sha(bytes),bytes:bytes.length};return JSON.parse(bytes);}
const source=await load('native/export.json');
assert.deepEqual(validateAndroidV3ProductExport(source),[]);
const aliases=await load('native/alias-manifest.json');
const scripts=await load('native/source-scripts.json');
const sourcePhotos=await load('native/source-photos.json');
const mediaManifest=await load('native/media-manifest.json');
const nativeArtifacts=await load('native/artifact-manifest.json');
for(const artifact of nativeArtifacts.artifacts) {
  const path=await realpath(join(input,'native',artifact.path));
  const rel=relative(join(input,'native'),path);assert(rel&&!rel.startsWith('..')&&!isAbsolute(rel),'Artifact path must remain native');
  const bytes=await readFile(path);assert.equal(bytes.length,artifact.bytes);assert.equal(sha(bytes),artifact.sha256);
  inputHashes[`native/${artifact.path}`]={sha256:artifact.sha256,bytes:artifact.bytes};
}
const fileBytesByRelativePath=new Map();
for(const attachment of source.attachments) {
  const file=`native/files/${attachment.relativePath}`;const bytes=await readFile(join(input,file));
  assert.equal(attachment.fileByteSize,bytes.length);assert.equal(attachment.fileExists,true);
  fileBytesByRelativePath.set(attachment.relativePath,bytes);inputHashes[file]={sha256:sha(bytes),bytes:bytes.length};
}
const projection=clone(source),transcriptLedger=[];
for(const script of scripts) {
  assert.equal(script.transcriptionMethod,'authored_script_not_asr');assert(script.text?.trim());
  const binding=aliases.voices[script.voiceScriptId];assert(binding,'Missing source-to-native voice mapping');
  const matches=projection.voiceNotes.filter(v=>v.voiceNoteId===binding.voiceNoteId);assert.equal(matches.length,1);
  const note=matches[0];
  for(const field of ['screenKey','cardKey','fieldKey','targetKey','itemKey','itemLabel'])assert.equal(note[field]??null,binding[field]??null);
  transcriptLedger.push({nativeVoiceNoteId:note.voiceNoteId,sourceScriptId:script.voiceScriptId,sourceRevision:script.sourceRevision,operation:'authored_script_substitution_for_evaluation_only',asrPerformed:false,before:{transcriptText:note.transcriptText??null,transcriptStatus:note.transcriptStatus},after:{transcriptText:script.text,transcriptStatus:'transcribed_diagnostic_authored_script'}});
  note.transcriptText=script.text;note.transcriptStatus='transcribed_diagnostic_authored_script';
}
assert.equal(transcriptLedger.length,projection.voiceNotes.length);
const frozenProjection=JSON.stringify(projection);
const snapshot=buildGenericOutlineEvaluationSnapshot({exportPackage:projection,selectedModuleIds,scope:{inspectionId:source.inspectionId,tenantId:source.tenantId,workspaceId:source.workspaceId},provenance:{locationAliases:aliases.locations,sourcePhotos,transcriptionMethod:'authored_script_not_asr',inputPackageHash:inputHashes['native/export.json'].sha256}});
assert.equal(snapshot.sectionPlans.length,12);assert.deepEqual(snapshot.sectionPlans.map(p=>p.sectionId),selectedModuleIds);
const artifacts=prepareGenericOutlineReviewArtifacts({exportPackage:source,fileBytesByRelativePath,sourcePhotos,selectedModuleIds});
await save('input-provenance.json',{evaluationOnly:true,inputHashes,transcriptLedger,rawExportUnchanged:true,normalUploadImportPerformed:false,asrPerformed:false,expectedLabelsRead:false,outlineReadinessUsedAsClassifierInput:false});
await save('section-planning.json',snapshot);
await save('artifact-review.json',artifacts);
await mkdir(join(output,'sections'));
await mkdir(join(output,'worker'));
const aiStatus=live?getAiStatus():prepare?{configured:true,mode:'request_preview',modelId:getAiStatus().targetModelId}:{configured:false,mode:'deterministic_evaluation'};
const results=[];
for(const plan of snapshot.sectionPlans) {
  const sectionId=plan.sectionId;
  let workerRequest=null,workerResponse=null,workerError=null;
  const worker=async request=>{
    assert.notEqual(sectionId,'regime','Maintenance regime must never invoke AI');
    assert.equal(workerRequest,null,'One scoped request per section');
    workerRequest=request;
    await save(`worker/${sectionId}-request.json`,{sectionId,externalRequestSent:live,photoBytesIncluded:false,audioBytesIncluded:false,request});
    if(!live)throw new Error('Request preview only; no external model call was made.');
    try {workerResponse=await runStructuredCodexJob(request);await save(`worker/${sectionId}-response.json`,workerResponse);return workerResponse;}
    catch(error){workerError=String(error.message);await save(`worker/${sectionId}-error.json`,{message:workerError});throw error;}
  };
  const result=await generatePlannedSectionDraft({reportState:{exportPackage:projection,sectionPlanning:snapshot},sectionId,worker,aiStatus:sectionId==='regime'?{configured:false,mode:'standard_template_only'}:aiStatus,userInstruction:'Keep the inspector-review draft concise. Preserve explicitly captured actions, proposed status, limitations and negation. Do not invent a recommendation, owner, deadline, acceptance decision or missing input.'});
  assert.equal(JSON.stringify(projection),frozenProjection,'Shared generation changed its input');
  assert.equal(result.orchestration.generatorContractVersion,PLANNED_GENERATOR_CONTRACT);
  const evaluation=evaluateSectionPlanOutput({sectionPlan:plan,evidenceRecords:snapshot.evidenceRecords,generatedContent:result.draft.content});
  const artifactHtml=renderGenericOutlineReviewArtifactsHtml(artifacts,{moduleId:sectionId});
  const generated=sectionDocumentHasContent(result.draft.reportDocument);
  const entry={sectionId,title:plan.title,reportTitle:[plan.catalog.reportPresentation?.number,plan.catalog.reportPresentation?.title].filter(Boolean).join(' '),generationRun:result.generationRun,hasGeneratedText:generated,hasPreviewArtifacts:[...artifacts.photos,...artifacts.layouts].some(artifact=>artifact.status==='verified'&&(artifacts.byModule[sectionId]??[]).includes(artifact.artifactId)),workerCalled:live&&workerRequest!==null,workerResponded:workerResponse!==null,requestPrepared:workerRequest!==null,workerError,sourceVoiceClaimCount:workerRequest?JSON.parse(workerRequest.prompt.split('\nEvidence: ')[1]).length:plan.evidenceUses.filter(u=>u.role==='required_narrative'&&u.evidenceIds.some(id=>snapshot.evidenceRecords.some(r=>r.evidenceId===id&&r.kind==='voice_claim'))).length,requiredObligationCount:plan.outputObligations.length,missingRequirements:plan.missingRequirements,sharedValidator:{blockerReasons:evaluation.blockerReasons,omittedCount:evaluation.missingRequiredObligationIds.length,unresolvedCount:evaluation.unresolvedEvaluationCount,denominatorSource:evaluation.denominatorSource},wordCount:result.draft.content.replace(/<[^>]+>/g,' ').trim().split(/\s+/).filter(Boolean).length};
  await save(`sections/${sectionId}.json`,{result,evaluation,evaluationLimit:'Planner-derived obligations are diagnostics, not independent benchmark truth. Artifact preview is assessed separately from shared generated text.'});
  results.push({entry,result,artifactHtml,workerResponse});
  console.log(JSON.stringify({sectionId,workerCalled:entry.workerCalled,usedLiveModel:result.generationRun.usedLiveModel,fallbackReason:result.generationRun.fallbackReason,generatedText:generated}));
}
const allContent=results.map(r=>r.result.draft.content).join('\n');
const checklistRecords=snapshot.evidenceRecords.filter(r=>r.kind==='checklist_response');
const checklistRendered=checklistRecords.filter(r=>allContent.includes(`data-evidence-id="${r.evidenceId}"`));
assert.equal(checklistRecords.length,195);assert.equal(checklistRendered.length,195,'All195 responses must reach the checklist output');
const regime=results.find(r=>r.entry.sectionId==='regime');assert.equal(regime.entry.workerCalled,false);
for(const [path,expected] of Object.entries(inputHashes))assert.equal(sha(await readFile(join(input,path))),expected.sha256,`Source changed: ${path}`);
const summary={evaluationOnly:true,caseId:'synthetic-inspection-025',sourceRevision:3,mode:live?'live':prepare?'request_preview':'deterministic',selectedModuleIds,sectionCount:12,generatorContract:PLANNED_GENERATOR_CONTRACT,candidateRoutingVersion:snapshot.routingVersion??snapshot.contractVersion,catalogVersion:snapshot.sectionContractVersion,catalogRevision:snapshot.outlineRevision,candidateRuleRevision:snapshot.ruleRevision,formatVersion:snapshot.formatVersion,reportProfileId:snapshot.reportProfileId,formatterContractVersion:snapshot.formatterContractVersion,modelTarget:live||prepare?getAiStatus().targetModelId:null,workerCalls:results.filter(r=>r.entry.workerCalled).length,workerResponses:results.filter(r=>r.entry.workerResponded).length,sectionsUsingAcceptedAiWording:results.filter(r=>r.entry.generationRun.usedLiveModel).length,sectionsWithGeneratedText:results.filter(r=>r.entry.hasGeneratedText).length,checklistRowsRendered:checklistRendered.length,maintenanceRegimeAiCalls:0,sourceBytesUnchanged:true,nativeExportValid:true,normalUploadImportPerformed:false,asrPerformed:false,independentlyApprovedBenchmark:false,recoveryScore:null,policyPromotionPerformed:false,productionProfileChanged:false,artifactPreviewSeparateFromSharedText:true,sections:results.map(r=>r.entry),limitations:['Authored transcripts substitute for ASR in a separate immutable-source projection.','This is a source-assisted mock; source-report photos use declared synthetic location aliases.','The generic outline candidate is used only by this offline runner.','Scores from candidate-generated obligations are diagnostic, not independent recovery scores.','Missing inputs are evaluation findings and do not prevent unrelated section drafts.','Storage upload/import is separate and was not attempted by this run.','Report presentation uses the shared formatter: report titles, paired fields, component groups, captured point headings and canonical evidence uses. Technical modules group repeated component sections; final assembled numbering and export parity remain unverified.']};
await save('summary.json',summary);
const status=entry=>entry.sectionId==='regime'&&!entry.hasGeneratedText?'Template pending':entry.hasGeneratedText||entry.hasPreviewArtifacts?(entry.generationRun.blockers.length||entry.generationRun.warnings.length?'Draft with review notes':'Draft generated'):'Input pending';
const tableRows=results.map(({entry:e})=>`<tr><td><a href="#${esc(e.sectionId)}">${esc(e.title)}</a></td><td>${status(e)}</td><td>${e.workerCalled?(e.generationRun.usedLiveModel?'AI wording accepted':e.workerResponded?'AI responded / captured wording retained':'Worker failed / captured wording retained'):'Deterministic / no AI'}</td><td>${e.wordCount}</td></tr>`).join('');
const sections=results.map(({entry:e,result,artifactHtml,workerResponse})=>`<article id="${esc(e.sectionId)}"><div class="section-meta"><strong>${status(e)}</strong> · ${e.generationRun.usedLiveModel?'AI wording accepted':e.workerCalled?'Model attempted; captured wording retained':'Deterministic compilation'} · <a href="sections/${esc(e.sectionId)}.json">Evaluation record</a></div>${result.draft.content}${artifactHtml??''}${!e.hasGeneratedText&&!e.hasPreviewArtifacts?'<p class="pending">No supported section body was generated. Missing input is recorded below.</p>':''}<details><summary>Input gaps and evaluation notes</summary><ul>${[...new Set([...e.generationRun.blockers,...e.generationRun.warnings,...e.missingRequirements.map(r=>r.reason??r.detail??JSON.stringify(r))])].map(note=>`<li>${esc(note)}</li>`).join('')||'<li>No blocking input gaps reported by the candidate plan.</li>'}</ul><p>Shared validator: ${e.sharedValidator.omittedCount} obligations marked omitted; ${e.sharedValidator.unresolvedCount} require review. These are conservative checks against the candidate plan, not independent quality scores.</p></details>${workerResponse?`<details><summary>Actual AI response${e.generationRun.usedLiveModel?'':' — not accepted into the draft'}</summary><ol>${(workerResponse.parsed?.findings??[]).map(f=>`<li>${esc(f.text)}</li>`).join('')}</ol><a href="worker/${esc(e.sectionId)}-response.json">Raw response</a></details>`:''}</article>`).join('');
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SYN-025 · 12-section evaluation</title><style>body{overflow-wrap:anywhere;margin:0;background:#f1f5f8;color:#19344b;font:16px/1.55 Arial,sans-serif}main{max-width:1140px;margin:auto;padding:32px 24px 72px}h1{font-size:32px;line-height:1.2}h2{color:#0a3f73;font-size:25px}h3{color:#0d4f90;font-size:20px}h4{font-size:16px}a{color:#145d99}.notice,.pending{background:#fff1cd;border-left:4px solid #c28c16;padding:16px 20px}.overview,article{background:white;border:1px solid #d4dee7;border-radius:8px;padding:24px;margin:22px 0}.scroll{overflow:auto}table{width:100%;border-collapse:collapse;font-size:14px;line-height:1.4;margin:14px 0}th,td{border:1px solid #bdcbd7;padding:8px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#eaf2fb}thead{display:table-header-group}tr{break-inside:avoid}article{scroll-margin-top:20px}.section-meta{font-size:13px;color:#52677b;border-bottom:1px solid #dee5eb;padding-bottom:12px}details{background:#f5f7fa;padding:12px;margin:16px 0}summary{cursor:pointer;font-weight:bold}img,svg{max-width:100%;height:auto}figure{margin:20px 0}figcaption{font-size:14px}li{margin:5px 0}.eyebrow{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#577086}@media(max-width:700px){main{padding:20px 10px}article,.overview{padding:14px}table{font-size:12px}th,td{padding:5px}h1{font-size:27px}}@media print{body{background:white}main{max-width:none;padding:0}details,.section-meta,.overview{display:none}article{border:0;padding:0}h2,h3,h4{break-after:avoid}figure{break-inside:avoid}@page{size:A4;margin:25.4mm}}</style></head><body><main><div class="eyebrow">Evaluation only · generic outline candidate · revision 3 mock</div><h1>Generated drafts for 12 selected sections</h1><p>195 checklist responses, two UT records, eleven authored voice transcripts and real report photos. <strong>No production profile or model was promoted.</strong></p><div class="notice">This is a ${live?'live model':prepare?'request-preparation':'local deterministic'} evaluation, not a final report. Missing inputs remain review findings. The maintenance regime uses no AI and stays pending until a standard template is supplied. Photo/layout previews use verified source artifacts and deterministic compilers; they are tracked separately from the shared text output. The revised report presentation is under evaluation. Final assembled numbering and export parity remain unverified.</div><section class="overview"><h2>Section results</h2><p>${summary.workerCalls} model calls · ${summary.sectionsUsingAcceptedAiWording} sections accepted AI wording · ${summary.checklistRowsRendered}/195 checklist rows preserved</p><div class="scroll"><table><thead><tr><th>Section</th><th>Result</th><th>Wording</th><th>Words</th></tr></thead><tbody>${tableRows}</tbody></table></div><p><a href="summary.json">Run summary</a> · <a href="section-planning.json">Backend evidence labels</a> · <a href="artifact-review.json">Photo and layout checks</a> · <a href="../review.html">Prepared mock inputs</a></p></section>${sections}</main></body></html>`;
await writeFile(join(output,'review.html'),html,{flag:'wx'});
console.log(JSON.stringify({output,sectionCount:12,workerCalls:summary.workerCalls,sectionsUsingAcceptedAiWording:summary.sectionsUsingAcceptedAiWording,sourceBytesUnchanged:true}));
