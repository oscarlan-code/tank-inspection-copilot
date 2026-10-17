import { createHash, randomUUID } from 'node:crypto';
export const EVALUATOR_ID='section_evaluator';
export const EVALUATOR_RELEASE='evaluator_v2';
export const GENERATOR_RELEASE='general_tank_information_v3';
export const REVIEWER_RELEASE='reviewer_v2';
export const SECTION_ID='general-tank-information';
const sha256=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const score=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
function validateJudge(value){
  const parsed=value?.parsed??value;
  if(!parsed||!['pass','needs_attention','blocked'].includes(parsed.verdict))throw new Error('Semantic judge returned an invalid verdict.');
  for(const key of ['evidenceCoverage','originalMeaningRecovery','formatAlignment','supportedClaimPrecision'])if(!score(parsed.scores?.[key]))throw new Error(`Semantic judge score ${key} is invalid.`);
  for(const key of ['missingFacts','unsupportedClaims','materialDifferences','wordingDifferences'])if(!Array.isArray(parsed[key]))throw new Error(`Semantic judge ${key} must be an array.`);
  if(typeof parsed.rationale!=='string'||!parsed.rationale.trim())throw new Error('Semantic judge rationale is required.');
  return {parsed,providerCode:value?.providerCode??'injected_semantic_judge',modelId:value?.modelId??null,liveModelUsed:value?.liveModelUsed===true};
}
function validateExecution(execution){
  if(!execution||execution.contractVersion!=='section_gold_evaluation_execution_v1'||execution.executionMode!=='evaluation')throw new Error('Unsupported gold-evaluation execution contract.');
  const generated=execution.generationResult;const review=execution.preDisplayReview;const gold=execution.goldPacket;
  if(generated?.section?.sectionId!==SECTION_ID||generated?.section?.releaseVersion!==GENERATOR_RELEASE||review?.reviewer?.releaseVersion!==REVIEWER_RELEASE)throw new Error('Gold evaluation is not bound to the expected generator and reviewer releases.');
  if(review.decision!=='ready_for_review'||review.userVisibility!=='allowed')throw new Error('Gold evaluation requires a passed pre-display review.');
  if(!gold||gold.contractVersion!=='sealed_section_gold_v1'||gold.sectionId!==SECTION_ID||!gold.sourceReportId||!gold.originalContent||!gold.openedAfterGenerationAtIso)throw new Error('A sealed section gold packet is required.');
  if(sha256(gold.originalContent)!==gold.contentSha256)throw new Error('Gold content hash does not match.');
  const generatedAt=Date.parse(generated.trace?.generatedAtIso??'');const openedAt=Date.parse(gold.openedAfterGenerationAtIso);
  if(!Number.isFinite(generatedAt)||!Number.isFinite(openedAt)||openedAt<generatedAt)throw new Error('Gold must open only after generation.');
  if((generated.trace?.retrievalKeys??[]).includes(gold.sourceReportId))throw new Error('Gold source appeared in generation retrieval.');
}
export async function evaluateGeneralTankInformationGold(execution,semanticJudge=null){
  validateExecution(execution);const generated=execution.generationResult;const gold=execution.goldPacket;
  const evidenceSummary=(generated.evaluationEvidence?.fields??[]).map(field=>({key:field.key,label:field.label,value:field.value,displayValue:field.displayValue,state:field.state,sourceClass:field.sourceClass,sourceEvidenceIds:field.sourceEvidenceIds??[]}));
  const judgeRequest={contractVersion:'section_gold_semantic_judge_request_v1',sectionId:SECTION_ID,
    sectionTitle:'3 GENERAL TANK INFORMATION',rubricVersion:execution.rubricVersion,currentEvidenceSummary:evidenceSummary,
    generatedSection:generated.draft.content,originalSection:gold.originalContent,
    instructions:['Assess semantic equivalence, not exact wording.','Treat current evidence as factual authority.',
      'Identify unsupported generated claims and material omissions explicitly.','Score format separately from content.']};
  if(!semanticJudge)return {contractVersion:'section_gold_evaluation_result_v1',evaluator:{evaluatorId:EVALUATOR_ID,releaseVersion:EVALUATOR_RELEASE},
    sectionId:SECTION_ID,status:'awaiting_semantic_judge',decision:'needs_attention',scores:null,missingFacts:[],unsupportedClaims:[],materialDifferences:[],wordingDifferences:[],
    deterministicChecks:{preDisplayReviewPassed:true,goldOpenedAfterGeneration:true,goldAbsentFromGenerationRetrieval:true},
    trace:{evaluationRunId:randomUUID(),evaluatedAtIso:new Date().toISOString(),generationRunId:generated.trace.runId,goldSourceId:gold.sourceReportId,
      goldContentSha256:gold.contentSha256,judgeRequestSha256:sha256(judgeRequest),liveModelUsed:false,providerCode:'none',modelId:null}};
  const judged=validateJudge(await semanticJudge(judgeRequest));
  const parsed=judged.parsed;let decision=parsed.verdict;
  if(parsed.unsupportedClaims.length&&decision==='pass')decision='blocked';
  return {contractVersion:'section_gold_evaluation_result_v1',evaluator:{evaluatorId:EVALUATOR_ID,releaseVersion:EVALUATOR_RELEASE},
    sectionId:SECTION_ID,status:'completed',decision,scores:parsed.scores,missingFacts:parsed.missingFacts,
    unsupportedClaims:parsed.unsupportedClaims,materialDifferences:parsed.materialDifferences,wordingDifferences:parsed.wordingDifferences,rationale:parsed.rationale,
    deterministicChecks:{preDisplayReviewPassed:true,goldOpenedAfterGeneration:true,goldAbsentFromGenerationRetrieval:true},
    trace:{evaluationRunId:randomUUID(),evaluatedAtIso:new Date().toISOString(),generationRunId:generated.trace.runId,goldSourceId:gold.sourceReportId,
      goldContentSha256:gold.contentSha256,judgeRequestSha256:sha256(judgeRequest),semanticJudgeUsed:true,liveModelUsed:judged.liveModelUsed,providerCode:judged.providerCode,modelId:judged.modelId}};
}
