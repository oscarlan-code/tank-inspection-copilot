import { readFile } from 'node:fs/promises';
import { verifyFrozenEvaluationAgent,deepFreeze } from './evaluator-runtime.mjs';
import { createCodexGoldJudge } from './codex-gold-judge.mjs';
export const SECTION_EVALUATION_RELEASES=deepFreeze({
  'general-tank-information:evaluator:v1':{evaluatorId:'section_evaluator',version:'evaluator_v1',sectionId:'general-tank-information',
    generatorReleaseVersion:'general_tank_information_v2',reviewerReleaseVersion:'reviewer_v1',reportProfileIds:['vertical_tank_inspection_v1'],
    rootUrl:new URL('./releases/general-tank-information/evaluator/v1/',import.meta.url).href,manifestSha256:'0c0703462237913579e3a82fc2209e7bf0c87b0489c9653f2eed8b4827494367'},
  'scope-of-inspection:evaluator:v1':{evaluatorId:'section_evaluator',version:'evaluator_v1',sectionId:'scope-of-inspection',
    generatorReleaseVersion:'scope_of_inspection_v1',reviewerReleaseVersion:'reviewer_v1',reportProfileIds:['vertical_tank_inspection_v1'],
    rootUrl:new URL('./releases/scope-of-inspection/evaluator/v1/',import.meta.url).href,manifestSha256:'73dd06620ea5bb5dd1c12ca50bebdafc6782f0d042bd06943cee74710cbebb5c'},
});
export function resolveSectionEvaluationRelease({generatorReleaseVersion,reviewerReleaseVersion,sectionId,reportProfileId}){
  const release=Object.values(SECTION_EVALUATION_RELEASES).find(item=>item.sectionId===sectionId&&item.generatorReleaseVersion===generatorReleaseVersion&&item.reviewerReleaseVersion===reviewerReleaseVersion);
  if(!release||!release.reportProfileIds.includes(reportProfileId))throw new Error('No exact evaluator release is registered for this generator/reviewer pair.');return release;
}
async function controls(release,manifest){const [instructions,rubric,outputSchema]=await Promise.all([readFile(new URL(manifest.evaluatorInstructions,release.rootUrl),'utf8'),readFile(new URL(manifest.rubric,release.rootUrl),'utf8').then(JSON.parse),readFile(new URL(manifest.outputSchema,release.rootUrl),'utf8').then(JSON.parse)]);return {instructions,rubric,outputSchema};}
export async function runSectionGoldEvaluation({reportProfileId,guardedResult,goldPacket,semanticJudge=null}){
  const generated=guardedResult?.generationResult;const review=guardedResult?.preDisplayReview;
  const release=resolveSectionEvaluationRelease({generatorReleaseVersion:generated?.section?.releaseVersion,reviewerReleaseVersion:review?.reviewer?.releaseVersion,sectionId:generated?.section?.sectionId,reportProfileId});
  const {manifest}=await verifyFrozenEvaluationAgent(release);
  if(manifest.supportedGenerator.releaseVersion!==generated?.release?.version||manifest.supportedGenerator.manifestSha256!==generated?.release?.manifestSha256||manifest.supportedReviewer.releaseVersion!==review?.release?.version||manifest.supportedReviewer.manifestSha256!==review?.release?.manifestSha256)throw new Error('Evaluator bindings do not match the frozen generation/review chain.');
  const {rubric}=await controls(release,manifest);const module=await import(new URL(manifest.entryPoint,release.rootUrl).href);
  const result=await module[manifest.entryExport]({contractVersion:manifest.evaluationContract,executionMode:'evaluation',generationResult:generated,preDisplayReview:review,goldPacket,rubricVersion:rubric.rubricId},semanticJudge);
  result.release={evaluatorId:release.evaluatorId,version:release.version,manifestSha256:release.manifestSha256,status:manifest.status};return result;
}
export async function runSectionGoldEvaluationWithCodex(args){const generated=args.guardedResult?.generationResult;const review=args.guardedResult?.preDisplayReview;const release=resolveSectionEvaluationRelease({generatorReleaseVersion:generated?.section?.releaseVersion,reviewerReleaseVersion:review?.reviewer?.releaseVersion,sectionId:generated?.section?.sectionId,reportProfileId:args.reportProfileId});const {manifest}=await verifyFrozenEvaluationAgent(release);const configured=await controls(release,manifest);return runSectionGoldEvaluation({...args,semanticJudge:createCodexGoldJudge(configured)});}
