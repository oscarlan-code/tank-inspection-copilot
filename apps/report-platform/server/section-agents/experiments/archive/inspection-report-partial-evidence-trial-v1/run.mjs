#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAiStatus, runStructuredCodexJob } from '../../../codex-cli.mjs';

const root=dirname(fileURLToPath(import.meta.url));
const appRoot=resolve(root,'../../../..');
const outputRoot=resolve(appRoot,'.local/section-agent-experiments/inspection-report-rsi-trial-v1');
const readJson=path=>readFile(path,'utf8').then(JSON.parse);
const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const normalize=value=>String(value??'').toLowerCase().replace(/[–—]/g,'-').replace(/[^a-z0-9.]+/g,' ').replace(/\s+/g,' ').trim();
const controls=await readJson(resolve(root,'controls.json'));
const cohort=await readJson(resolve(root,controls.fixedVariables.cohortManifest));
const candidatePrompt=await readFile(resolve(root,'candidate-a-prompt.md'),'utf8');
const args=new Set(process.argv.slice(2));
const evidenceFiles=await Promise.all(cohort.cases.map(async row=>({row,evidence:await readJson(resolve(root,row.evidenceFile))})));
const development=evidenceFiles.filter(({row})=>row.datasetSplit==='development');

const outputSchema={
  $schema:'http://json-schema.org/draft-07/schema#',type:'object',additionalProperties:false,
  required:['sectionTitle','blocks'],properties:{sectionTitle:{type:'string'},blocks:{type:'array',items:{type:'object',additionalProperties:false,
    required:['blockId','heading','claims'],properties:{blockId:{type:'string'},heading:{type:'string'},claims:{type:'array',items:{type:'object',additionalProperties:false,
      required:['evidenceId','text'],properties:{evidenceId:{type:'string'},text:{type:'string'}}}}}}}}
};

async function localGoldStatus(row,evidence){
  const goldPath=resolve(outputRoot,row.evaluatorOnlyGoldFile);
  try{
    await access(goldPath);
    const bytes=await readFile(goldPath,'utf8');
    assert.equal(sha(bytes),row.evaluatorOnlyGoldSha256,`${row.caseId}: evaluator gold hash changed`);
    const gold=JSON.parse(bytes);
    assert.equal(gold.caseId,row.caseId);
    assert.equal(gold.sourceSha256,row.sourceSha256);
    const selectedIds=new Set(gold.selectedSourceBlocks.map(block=>block.blockId));
    assert.deepEqual([...selectedIds].sort(),[...row.selectedGoldBlockIds].sort());
    for(const note of evidence.noteVariants){
      const noteText=normalize(note.text);
      for(const block of gold.selectedSourceBlocks){
        const sourceText=normalize(block.text);
        if(sourceText.length>=40)assert(!noteText.includes(sourceText),`${row.caseId}/${note.variantId}: note copies a source sentence`);
      }
    }
    return {caseId:row.caseId,available:true,hashVerified:true,path:goldPath};
  }catch(error){
    if(error?.code==='ENOENT')return {caseId:row.caseId,available:false,hashVerified:false,path:goldPath};
    throw error;
  }
}

async function validateSource(){
  assert.equal(controls.contractVersion,'bounded_section_rsi_trial_v1');
  assert.equal(controls.section.sectionId,'inspection-report');
  assert.equal(controls.productEnabled,false);
  assert.equal(controls.fixedVariables.runtimeRetrievals,0);
  assert.equal(controls.fixedVariables.generatorRepeatsPerReport,2);
  assert.equal(controls.cohortPlan.totalReports,6);
  assert.equal(controls.cohortPlan.development.reports,4);
  assert.equal(controls.cohortPlan.validation.reports,1);
  assert.equal(controls.cohortPlan.heldOut.reports,1);
  assert.equal(cohort.counts.reports,6);
  assert.equal(cohort.counts.development,4);
  assert.equal(cohort.counts.validation,1);
  assert.equal(cohort.counts.heldout,1);
  assert.equal(cohort.counts.noteVariants,36);
  assert.equal(controls.cohortPlan.preparedEvidenceFiles.length,controls.cohortPlan.preparedReports);
  assert.deepEqual([...controls.cohortPlan.preparedEvidenceFiles].sort(),cohort.cases.map(row=>row.evidenceFile).sort());
  assert.equal(controls.cohortPlan.allVariantsFromOneReportStayInOneSplit,true);
  assert.deepEqual(controls.variableUnderTest.candidateSlots,['A','B','C','D','E','F']);
  assert.equal(controls.variableUnderTest.name,'generator_prompt');
  assert.deepEqual(controls.variableUnderTest.preparedCandidates,['A']);
  assert.equal(controls.automaticPromptMutation,false);
  assert.equal(controls.automaticGoldRelabelling,false);
  assert.equal(controls.automaticPromotion,false);
  assert.equal(new Set(cohort.cases.map(row=>row.sourceSha256)).size,cohort.cases.length);
  assert.equal(new Set(cohort.cases.map(row=>row.lineageId)).size,cohort.cases.length);
  for(const {row,evidence} of evidenceFiles){
    assert.equal(evidence.caseId,row.caseId);
    assert.equal(evidence.datasetSplit,row.datasetSplit);
    assert.equal(evidence.sourceBasis.sourceSha256,row.sourceSha256);
    assert.equal(evidence.sourceBasis.sameReportGoldAvailableToGenerator,false);
    assert.equal(evidence.sourceBasis.originalReportSentToGenerator,false);
    assert.equal(evidence.noteVariants.length,6);
    assert.equal(new Set(evidence.noteVariants.map(note=>note.variantId)).size,6);
    assert.equal(new Set(evidence.noteVariants.map(note=>normalize(note.text))).size,6);
    assert.equal(new Set(evidence.observations.map(item=>item.evidenceId)).size,evidence.observations.length);
    assert.equal(evidence.observations.length,row.observationCount);
    assert(evidence.observations.length>=10);
    assert.deepEqual(evidence.observations.map(item=>item.sourceReference.blockId).sort(),[...row.selectedGoldBlockIds].sort());
  }
  assert(!candidatePrompt.includes('original historical section'));
  return Promise.all(evidenceFiles.map(({row,evidence})=>localGoldStatus(row,evidence)));
}

function promptFor(evidence){
  return [candidatePrompt,'\nFixed output contract:\n',JSON.stringify({sectionTitle:controls.section.title,componentOrder:evidence.componentOrder,
    outputSchemaVersion:controls.fixedVariables.outputSchemaVersion,rules:['Use every evidenceId exactly once.','Use one output claim per evidenceId.','Place each claim in its declared componentBlock.','Do not create a block without supplied evidence.']},null,2),
    '\nVerified current evidence:\n',JSON.stringify({contractVersion:evidence.contractVersion,caseId:evidence.caseId,componentOrder:evidence.componentOrder,observations:evidence.observations},null,2),
    '\nReturn JSON only.'].join('');
}

function review(parsed,evidence){
  const expected=new Map(evidence.observations.map(row=>[row.evidenceId,row]));
  const seen=[];
  const failures=[];
  if(parsed.sectionTitle!==controls.section.title)failures.push({failureClass:'wrong_title',expected:controls.section.title,actual:parsed.sectionTitle});
  for(const block of parsed.blocks??[])for(const claim of block.claims??[]){
    seen.push(claim.evidenceId);
    const source=expected.get(claim.evidenceId);
    if(!source){failures.push({failureClass:'unsupported_evidence_id_or_claim',evidenceId:claim.evidenceId});continue;}
    if(block.blockId!==source.componentBlock)failures.push({failureClass:'wrong_component_block',evidenceId:claim.evidenceId,expected:source.componentBlock,actual:block.blockId});
    const text=normalize(claim.text);
    for(const term of source.protectedTerms)if(!text.includes(normalize(term)))failures.push({failureClass:'changed_protected_term',evidenceId:claim.evidenceId,term});
  }
  for(const id of expected.keys()){
    const count=seen.filter(value=>value===id).length;
    if(count===0)failures.push({failureClass:'missing_evidence_id',evidenceId:id});
    if(count>1)failures.push({failureClass:'unsupported_evidence_id_or_claim',evidenceId:id,detail:'duplicate'});
  }
  const known=seen.filter(id=>expected.has(id)).length;
  const uniqueKnown=new Set(seen.filter(id=>expected.has(id))).size;
  const protectedChecks=evidence.observations.reduce((sum,row)=>sum+row.protectedTerms.length,0);
  const protectedFailures=failures.filter(row=>row.failureClass==='changed_protected_term').length;
  const blockFailures=failures.filter(row=>row.failureClass==='wrong_component_block').length;
  const extra=failures.filter(row=>row.failureClass==='unsupported_evidence_id_or_claim').length;
  return {passed:failures.length===0,metrics:{requiredEvidenceRecall:uniqueKnown/expected.size,supportedClaimPrecision:seen.length?known/seen.length:0,
    protectedTermAccuracy:(protectedChecks-protectedFailures)/protectedChecks,componentBlockAccuracy:(expected.size-blockFailures)/expected.size,
    titleAccuracy:parsed.sectionTitle===controls.section.title?1:0,unsupportedClaimCount:extra},failures,
    feedback:[...new Set(failures.map(row=>controls.feedbackRouting[row.failureClass]))]};
}

function evidenceSet(output){return [...new Set((output.blocks??[]).flatMap(block=>(block.claims??[]).map(claim=>claim.evidenceId)))].sort();}
function esc(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
async function comparisonContext(){
  const entries=await Promise.all(development.map(async({row,evidence})=>[row.caseId,{evidence,gold:await readJson(resolve(outputRoot,row.evaluatorOnlyGoldFile))}]));
  return new Map(entries);
}
function html(result,context){
  const renderGenerated=run=>`<h3>${esc(run.output.sectionTitle)}</h3>${run.output.blocks.map(block=>`<h4>${esc(block.heading)}</h4><ul>${block.claims.map(claim=>`<li><small>${esc(claim.evidenceId)}</small>${esc(claim.text)}</li>`).join('')}</ul>`).join('')}`;
  const familyLabels={internal_external_api653:'Internal & external inspection',internal_inspection:'Internal inspection',external_inspection:'External inspection'};
  const cards=result.cases.map((item,index)=>{
    const source=context.get(item.caseId);
    const primary=item.runs[0];
    const repeat=item.runs[1];
    const metrics=primary.review.metrics;
    const pages=source.gold.selectedSourceBlocks.map(block=>block.page).filter(Number.isFinite);
    const firstPage=Math.min(...pages);
    const lastPage=Math.max(...pages);
    const pdfBase=`pdfs/${encodeURIComponent(item.caseId)}.pdf`;
    const pdfHref=`${pdfBase}#page=${firstPage}&view=FitH`;
    const evidence=source.evidence.observations.map(row=>`<li><small>${esc(row.evidenceId)} · ${esc(row.componentBlock)} · ${esc(row.polarity)}</small><b>${esc(row.component)}</b>${row.location?` · ${esc(row.location)}`:''}: ${esc(row.condition)}${row.qualifier?` (${esc(row.qualifier)})`:''}</li>`).join('');
    const selectedEvidencePassed=item.runs.every(run=>run.review.passed)&&item.crossRunEvidenceSetStability===1;
    const coverage=controls.fidelityAssessment.perDevelopmentReportCoverage[item.caseId]??0;
    return `<article><header><strong>Report ${index+1} · ${esc(familyLabels[item.reportFamily]??item.reportFamily)}</strong><b>${selectedEvidencePassed?'SELECTED EVIDENCE PASS':'NEEDS REFINEMENT'}</b></header><div class="metrics"><span class="warning">Estimated source coverage ${(coverage*100).toFixed(1)}%</span><span>Selected recall ${metrics.requiredEvidenceRecall}</span><span>Selected precision ${metrics.supportedClaimPrecision}</span><span>Terms ${metrics.protectedTermAccuracy}</span><span>Routing ${metrics.componentBlockAccuracy}</span><span>Unsupported ${metrics.unsupportedClaimCount}</span><span>Repeat stability ${item.crossRunEvidenceSetStability}</span></div><div class="grid"><section class="pdf"><div class="column-title"><h2>Original report PDF</h2><a href="${pdfHref}" target="_blank" rel="noreferrer">Open PDF · pages ${firstPage}–${lastPage}</a></div><iframe src="${pdfHref}" title="Original report PDF for report ${index+1}"></iframe></section><section><h2>Generated section · run 1</h2><p class="scope-warning">Partial output: generated from selected mock evidence, not the complete Section 4 export.</p>${renderGenerated(primary)}</section><section><h2>Evidence from app · processed</h2><h4>Example inspector note</h4><p class="note">${esc(source.evidence.noteVariants[0].text)}</p><h4>Verified observations</h4><ul>${evidence}</ul></section></div><details><summary>Repeat run 2 and evaluator records</summary><div class="repeat"><section><h2>Generated section · run 2</h2>${renderGenerated(repeat)}</section><pre>${esc(JSON.stringify({run1:primary.review,run2:repeat.review},null,2))}</pre></div></details></article>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Inspection Report RSI trial</title><style>body{margin:0;background:#edf3f7;color:#18324b;font:14px/1.5 system-ui}main{padding:20px}.invalid{background:#fff1f0;border:1px solid #d94b4b;color:#7d1717;padding:14px 16px;margin:14px 0;font-weight:650}article{background:#fff;border:1px solid #b9c9d6;margin:20px 0}header{display:flex;justify-content:space-between;background:#153e5c;color:white;padding:12px 15px;text-transform:capitalize}.metrics{display:flex;gap:8px;flex-wrap:wrap;padding:10px 14px;background:#fff7e6}.metrics span{border:1px solid #d5b16c;border-radius:999px;padding:2px 9px}.metrics .warning{background:#ffe0a6;border-color:#bd7624;font-weight:700}.grid{display:grid;grid-template-columns:1.15fr 1fr 1fr;gap:1px;background:#b9c9d6}.grid>section{background:white;padding:14px;min-width:0;height:720px;overflow:auto}.grid>section.pdf{padding:0;overflow:hidden}.column-title{display:flex;justify-content:space-between;align-items:center;padding:4px 14px}.column-title a{font-weight:650;color:#087da5}.pdf iframe{width:100%;height:660px;border:0;border-top:1px solid #dbe5ec}h2{color:#0780a8;font-size:17px;position:sticky;top:-14px;background:white;padding:10px 0}h3{color:#0780a8}h4{margin-bottom:6px}li{margin:0 0 10px}small{display:block;color:#60778a}.note{background:#eff8f2;border-left:4px solid #46a36f;padding:10px}.scope-warning{background:#fff1f0;border-left:4px solid #d94b4b;padding:9px;color:#7d1717}details{padding:12px 14px}summary{cursor:pointer;font-weight:700}.repeat{display:grid;grid-template-columns:1.4fr 1fr;gap:20px;margin-top:12px}.repeat section{max-height:620px;overflow:auto}pre{white-space:pre-wrap;font:12px/1.5 ui-monospace,monospace}@media(max-width:1100px){.grid,.repeat{grid-template-columns:1fr}.grid>section{height:auto}.pdf iframe{height:680px}}</style></head><body><main><h1>Inspection Report bounded-RSI trial</h1><div class="invalid">INVALID FOR FULL-SECTION FIDELITY: only 44 of approximately 197 in-scope source findings were represented in the mock app evidence (22.3%). The selected-evidence scores below must not be interpreted as complete Section 4 performance.</div><p>Each report appears once: original PDF, Candidate A partial output and processed app evidence. Run 2 is available under the collapsed repeat panel. Evaluation only; no product promotion.</p>${cards}</main></body></html>`;
}

const goldStatus=await validateSource();
await mkdir(outputRoot,{recursive:true});
const requests=development.flatMap(({row,evidence})=>Array.from({length:controls.fixedVariables.generatorRepeatsPerReport},(_,index)=>{
  const prompt=promptFor(evidence);
  return {caseId:row.caseId,reportFamily:row.reportFamily,run:index+1,candidate:'A',preparedExampleOnly:true,promptSha256:sha(prompt),prompt,outputSchema};
}));
const preview={contractVersion:'inspection_report_trial_request_preview_v1',experimentId:controls.experimentId,
  externalDestination:'configured Codex/OpenAI report-generation worker',requestCount:requests.length,fixedVariables:controls.fixedVariables,
  cohort:{developmentReports:development.length,repeatsPerReport:controls.fixedVariables.generatorRepeatsPerReport,validationReportsPrepared:cohort.counts.validation,heldoutReportsPrepared:cohort.counts.heldout,noteVariantsPrepared:cohort.counts.noteVariants},
  dataIncluded:['selected report-derived structured observations','source evidence IDs','source block references','protected terms','section output contract'],
  dataExcluded:['original historical section text','historical expected wording','recommendations','evaluation labels','validation cases','held-out case and gold'],
  requests};
await writeFile(resolve(outputRoot,'baseline-request-preview.json'),`${JSON.stringify(preview,null,2)}\n`);

if(args.has('--audit')||args.has('--prepare')){
  console.log(JSON.stringify({passed:true,mode:args.has('--audit')?'audit':'prepare',experimentId:controls.experimentId,
    reports:cohort.counts.reports,split:{development:cohort.counts.development,validation:cohort.counts.validation,heldout:cohort.counts.heldout},
    observations:evidenceFiles.reduce((sum,item)=>sum+item.evidence.observations.length,0),noteVariants:cohort.counts.noteVariants,
    preparedReports:controls.cohortPlan.preparedReports,totalReports:controls.cohortPlan.totalReports,executionReady:controls.cohortPlan.preparedReports===controls.cohortPlan.totalReports&&controls.cohortPlan.fullSectionEvidencePrepared&&controls.fidelityAssessment.candidateAFullSectionValid,
    requestCount:preview.requestCount,uniqueDevelopmentPromptHashes:new Set(requests.map(row=>row.promptSha256)).size,
    localEvaluatorGoldPackagesVerified:goldStatus.filter(row=>row.hashVerified).length,preview:resolve(outputRoot,'baseline-request-preview.json'),
    originalHistoricalTextInRequest:false,validationOrHeldoutInBaselineRequest:false,fullSectionFidelityValid:controls.fidelityAssessment.candidateAFullSectionValid,estimatedSourceCoverage:controls.fidelityAssessment.estimatedSourceCoverage,productEnabled:false},null,2));
  process.exit(0);
}
if(args.has('--render-existing')){
  const saved=await readJson(resolve(outputRoot,'candidate-a-result.json'));
  const annotated={...saved,selectedEvidenceHardGatesPassed:saved.selectedEvidenceHardGatesPassed??saved.allHardGatesPassed,
    fullSectionFidelityValid:controls.fidelityAssessment.candidateAFullSectionValid,allHardGatesPassed:false,
    nextStep:'rebuild_complete_mock_export_and_full_section_evaluator_before_candidate_b',productPromotion:false};
  await writeFile(resolve(outputRoot,'candidate-a-result.json'),`${JSON.stringify(annotated,null,2)}\n`);
  await writeFile(resolve(outputRoot,'index.html'),html(annotated,await comparisonContext()));
  console.log(JSON.stringify({passed:true,mode:'render-existing',review:resolve(outputRoot,'index.html'),modelCalls:0},null,2));
  process.exit(0);
}
if(!args.has('--live-baseline'))throw new Error('Use --audit, --prepare, --render-existing or --live-baseline.');
assert.equal(controls.cohortPlan.preparedReports,controls.cohortPlan.totalReports,'Live baseline is blocked until all six report lineages are prepared and pinned.');
assert.equal(controls.cohortPlan.fullSectionEvidencePrepared,true,'Live generation is blocked because the mock export does not cover the complete in-scope section evidence.');
assert.equal(controls.fidelityAssessment.candidateAFullSectionValid,true,'Live generation is blocked until the full-section evaluator and format gates are valid.');
assert.equal(requests.length,controls.dataBoundary.externalBaselineRequestCountWhenCohortReady,'Live baseline request count differs from frozen control.');
assert.equal(goldStatus.filter(row=>row.hashVerified).length,cohort.counts.reports,'Live baseline requires all local evaluator-only gold packages to match their pinned hashes.');
const ai=getAiStatus();
assert.equal(ai.configured,true,ai.detail);
assert.equal(ai.modelId,controls.fixedVariables.modelId,'Configured model differs from frozen trial control.');
const caseResults=[];
for(const {row,evidence} of development){
  const prompt=promptFor(evidence);
  const runs=[];
  for(let index=0;index<controls.fixedVariables.generatorRepeatsPerReport;index++){
    const response=await runStructuredCodexJob({prompt,schema:outputSchema,reasoningEffort:controls.fixedVariables.reasoningEffort});
    runs.push({run:index+1,output:response.parsed,review:review(response.parsed,evidence),provider:response.aiStatus.provider,modelId:response.aiStatus.modelId});
  }
  const sets=runs.map(run=>evidenceSet(run.output));
  caseResults.push({caseId:row.caseId,reportFamily:row.reportFamily,evidence:evidence.observations,runs,crossRunEvidenceSetStability:JSON.stringify(sets[0])===JSON.stringify(sets[1])?1:0});
}
const selectedEvidenceHardGatesPassed=caseResults.every(item=>item.runs.every(run=>run.review.passed)&&item.crossRunEvidenceSetStability===1);
const allHardGatesPassed=selectedEvidenceHardGatesPassed&&controls.fidelityAssessment.candidateAFullSectionValid;
const result={contractVersion:'inspection_report_trial_baseline_result_v1',experimentId:controls.experimentId,candidate:'A',
  candidatePromptSha256:sha(candidatePrompt),fixedVariables:controls.fixedVariables,cases:caseResults,selectedEvidenceHardGatesPassed,fullSectionFidelityValid:controls.fidelityAssessment.candidateAFullSectionValid,allHardGatesPassed,
  nextStep:controls.fidelityAssessment.candidateAFullSectionValid?(allHardGatesPassed?'human_style_review_before_deciding_whether_candidate_b_is_needed':'review_failure_clusters_then_author_candidate_b_prompt'):'rebuild_complete_mock_export_and_full_section_evaluator_before_candidate_b',productPromotion:false};
await writeFile(resolve(outputRoot,'candidate-a-result.json'),`${JSON.stringify(result,null,2)}\n`);
await writeFile(resolve(outputRoot,'index.html'),html(result,await comparisonContext()));
console.log(JSON.stringify({passed:true,experimentId:controls.experimentId,allHardGatesPassed,result:resolve(outputRoot,'candidate-a-result.json'),review:resolve(outputRoot,'index.html'),nextStep:result.nextStep,productPromotion:false},null,2));
