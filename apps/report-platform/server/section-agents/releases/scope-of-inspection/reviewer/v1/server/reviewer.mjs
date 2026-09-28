import { createHash, randomUUID } from 'node:crypto';

export const REVIEWER_ID='section_reviewer';
export const REVIEWER_RELEASE='reviewer_v1';
export const GENERATOR_RELEASE='scope_of_inspection_v1';
export const SECTION_ID='scope-of-inspection';
export const REPORT_PROFILE='vertical_tank_inspection_v1';
const sha256=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normalize=value=>String(value??'').toLowerCase().replace(/\s+/g,' ').trim();
const nodeText=node=>Object.hasOwn(node??{},'text')?node.text:(node?.children??[]).map(nodeText).join('');
function nodes(document){const out=[];const visit=node=>{if(!node||Object.hasOwn(node,'text'))return;out.push(node);(node.children??[]).forEach(visit);};(document?.blocks??[]).forEach(visit);return out;}
function validateExecution(execution){
  if(!execution||execution.contractVersion!=='section_review_execution_v1'||execution.executionMode!=='evaluation')throw new Error('Unsupported section-review execution contract or mode.');
  const generated=execution.generationResult;
  if(execution.reportPlanRef?.reportProfileId!==REPORT_PROFILE||execution.sectionPlanRef?.sectionId!==SECTION_ID
      ||generated?.contractVersion!=='section_agent_result_v1'||generated?.section?.sectionId!==SECTION_ID
      ||generated?.section?.releaseVersion!==GENERATOR_RELEASE||generated?.release?.version!==GENERATOR_RELEASE){
    throw new Error('Review execution is not bound to the supported generator release.');
  }
  if(execution.gold!==undefined)throw new Error('Pre-display review cannot receive historical gold.');
  if (execution.sectionPlan?.historicalPatternPack !== 'scope_of_inspection_pattern_pack_v1'
      || execution.sectionPlan?.standardObligationPack !== 'scope_of_inspection_v1_reporting_boundary') throw new Error('Scope knowledge-pack bindings do not match the reviewed release.');
}
function protectedConcepts(claim){return [claim.action,claim.target,claim.method,claim.extent,...(claim.conditions??[]),...(claim.controlledReferences??[])].filter(Boolean);}
export function reviewScopeOfInspection(execution){
  validateExecution(execution);const before=sha256(execution);const generated=execution.generationResult;
  const allNodes=nodes(generated.draft?.document);const blockers=[];const warnings=[];
  if(generated.validation?.valid!==true)blockers.push('Generator validation did not pass.');
  if(generated.draft?.approved!==false||generated.draft?.reviewRequired!==true)blockers.push('Generated draft approval state is invalid.');
  if(generated.validation?.checks?.runtimeRetrievalUsed!==false)blockers.push('Runtime historical retrieval is not allowed for this release.');
  if(generated.validation?.checks?.liveModelUsed!==false)blockers.push('Live model output is not allowed for this deterministic release.');
  if(generated.validation?.checks?.completedTasksTreatedAsScope!==false)blockers.push('Completed app tasks were treated as commissioned scope.');
  const heading=allNodes.find(node=>node.tag==='h2');
  if(normalize(nodeText(heading))!=='1 scope of inspection')blockers.push('Section title does not match the reviewed contract.');
  if(!allNodes.some(node=>node.tag==='section'&&node.attrs?.['data-report-format']==='component-narrative'))blockers.push('Component-narrative report format is missing.');
  const evidenceNodes=allNodes.filter(node=>node.attrs?.['data-evidence-id']);
  const confirmation=execution.evidenceSnapshot.scopeConfirmation??{};
  const expected=[];
  for(const claim of confirmation.claims??[])if(claim.confirmed===true)expected.push({id:`scope-claim:${claim.claimId}`,kind:'claim',concepts:protectedConcepts(claim)});
  for(const row of confirmation.limitations??[])if(row.confirmed===true)expected.push({id:`scope-limitation:${row.recordId}`,kind:'limitation',concepts:[row.text]});
  for(const row of confirmation.exclusions??[])if(row.confirmed===true)expected.push({id:`scope-exclusion:${row.recordId}`,kind:'exclusion',concepts:[row.text]});
  const expectedIds=expected.map(row=>row.id);const observedIds=evidenceNodes.map(node=>node.attrs['data-evidence-id']);
  if(JSON.stringify(observedIds)!==JSON.stringify(expectedIds))blockers.push('Scope evidence bullets are missing, extra or out of confirmed order.');
  for(const row of expected){
    const matches=evidenceNodes.filter(node=>node.attrs['data-evidence-id']===row.id);
    if(matches.length!==1){blockers.push(`${row.id} must appear exactly once.`);continue;}
    const actual=normalize(nodeText(matches[0]));
    for(const concept of row.concepts)if(!actual.includes(normalize(concept)))blockers.push(`${row.id} does not preserve protected concept: ${concept}.`);
    if(row.kind==='limitation'&&!actual.includes('scope limitation:'))blockers.push(`${row.id} is not labelled as a limitation.`);
    if(row.kind==='exclusion'&&!actual.includes('excluded from this inspection:'))blockers.push(`${row.id} is not labelled as an exclusion.`);
  }
  if(sha256(execution)!==before)throw new Error('Section reviewer mutated its input.');
  const decision=blockers.length?'blocked':'ready_for_review';
  return {contractVersion:'section_review_result_v1',reviewer:{reviewerId:REVIEWER_ID,releaseVersion:REVIEWER_RELEASE},
    section:{sectionId:SECTION_ID,generatorReleaseVersion:GENERATOR_RELEASE},decision,
    userVisibility:decision==='ready_for_review'?'allowed':'blocked',approvalStatus:'not_approved',
    checks:{generatorValid:generated.validation?.valid===true,exactTitle:normalize(nodeText(heading))==='1 scope of inspection',
      expectedRecordCount:expected.length,observedRecordCount:evidenceNodes.length,
      formatValid:allNodes.some(node=>node.tag==='section'&&node.attrs?.['data-report-format']==='component-narrative'),
      evidenceGrounded:blockers.every(value=>!/(protected concept|missing, extra|appear exactly)/i.test(value)),
      kbBoundaryValid:generated.validation?.checks?.currentFactsFromHistoricalSources===false&&generated.validation?.checks?.runtimeRetrievalUsed===false&&execution.sectionPlan.historicalPatternPack==='scope_of_inspection_pattern_pack_v1'&&execution.sectionPlan.standardObligationPack==='scope_of_inspection_v1_reporting_boundary',
      completedTasksTreatedAsScope:generated.validation?.checks?.completedTasksTreatedAsScope??null,
      goldUsed:false,llmReviewRequired:false,liveModelUsed:false},blockers,warnings,
    claimTrace:expected.map(row=>({evidenceId:row.id,source:'confirmed_current_scope',status:blockers.some(value=>value.includes(row.id))?'failed':'verified'})),
    trace:{reviewRunId:randomUUID(),reviewedAtIso:new Date().toISOString(),generationRunId:generated.trace?.runId??null,
      generationResultSha256:sha256(generated),goldAccessed:false,providerCode:'deterministic',modelId:null}};
}
