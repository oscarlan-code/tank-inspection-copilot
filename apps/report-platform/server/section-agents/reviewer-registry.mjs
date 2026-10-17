import { verifyFrozenSectionReviewer, deepFreeze } from './reviewer-runtime.mjs';

export const SECTION_REVIEW_RELEASES=deepFreeze({
  'general-tank-information:reviewer:v1':{reviewerId:'section_reviewer',version:'reviewer_v1',sectionId:'general-tank-information',
    generatorReleaseVersion:'general_tank_information_v2',reportProfileIds:['vertical_tank_inspection_v1'],
    rootUrl:new URL('./releases/general-tank-information/reviewer/v1/',import.meta.url).href,manifestSha256:'a5804bd21cb1b2676c72a54d8d8983c31fc2bc1f98b23eae5ee1fce45d59ad96'},
  'general-tank-information:reviewer:v2':{reviewerId:'section_reviewer',version:'reviewer_v2',sectionId:'general-tank-information',
    generatorReleaseVersion:'general_tank_information_v3',reportProfileIds:['vertical_tank_inspection_v1'],
    rootUrl:new URL('./releases/general-tank-information/reviewer/v2/',import.meta.url).href,manifestSha256:'07b7e63faa146df1c94d4c22d27db3610dedaedd870661527fdae1ee56809fba'},
  'scope-of-inspection:reviewer:v1':{reviewerId:'section_reviewer',version:'reviewer_v1',sectionId:'scope-of-inspection',
    generatorReleaseVersion:'scope_of_inspection_v1',reportProfileIds:['vertical_tank_inspection_v1'],
    rootUrl:new URL('./releases/scope-of-inspection/reviewer/v1/',import.meta.url).href,manifestSha256:'ec54c0668bc124ae733f8806a74954d57d94417b2f67b6e4ecf655292c8b02a7'},
});

export function resolveSectionReviewRelease({generatorReleaseVersion,sectionId,reportProfileId}){
  if(typeof generatorReleaseVersion!=='string'||generatorReleaseVersion==='latest')throw new Error('Unsupported section-review generator release.');
  const release=Object.values(SECTION_REVIEW_RELEASES).find(item=>item.sectionId===sectionId&&item.generatorReleaseVersion===generatorReleaseVersion);
  if(!release||!release.reportProfileIds.includes(reportProfileId))throw new Error('No exact reviewer release is registered for this section-agent release.');
  return release;
}
function assertNoGoldInput(value,path='evidenceSnapshot'){if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){if(['gold','hiddenGold','validationGold','originalSection','expectedSection','referenceAnswer'].includes(key))throw new Error(`Reviewer cannot receive evaluator-only gold at ${path}.${key}.`);assertNoGoldInput(item,`${path}.${key}`);}}
export async function runSectionReview({reportPlan,sectionPlan,evidenceSnapshot,generationResult,executionMode}){
  if(executionMode!=='evaluation')throw new Error('Current reviewer releases await product qualification.');assertNoGoldInput(evidenceSnapshot);
  const release=resolveSectionReviewRelease({generatorReleaseVersion:generationResult?.section?.releaseVersion,sectionId:generationResult?.section?.sectionId,reportProfileId:reportPlan?.reportProfileId});
  const {manifest}=await verifyFrozenSectionReviewer(release);
  if(manifest.releaseId!==release.version||manifest.reviewerId!==release.reviewerId||manifest.supportedGenerator.releaseVersion!==generationResult?.release?.version||manifest.supportedGenerator.manifestSha256!==generationResult?.release?.manifestSha256)throw new Error("Generated section does not match the reviewer's frozen generator binding.");
  const module=await import(new URL(manifest.entryPoint,release.rootUrl).href);
  const result=await module[manifest.entryExport]({contractVersion:manifest.reviewContract,executionMode,
    reportPlanRef:{reportPlanId:reportPlan.reportPlanId,reportPlanSha256:reportPlan.reportPlanSha256,reportProfileId:reportPlan.reportProfileId,sectionInstanceId:sectionPlan.sectionInstanceId},
    sectionPlanRef:{sectionPlanId:sectionPlan.sectionPlanId,sectionPlanSha256:sectionPlan.sectionPlanSha256,sectionId:sectionPlan.sectionId,evidenceSnapshotSha256:sectionPlan.evidenceSnapshotSha256},
    sectionPlan,evidenceSnapshot,generationResult});
  result.release={reviewerId:release.reviewerId,version:release.version,manifestSha256:release.manifestSha256,status:manifest.status,productEnabled:manifest.productionEnabled};return result;
}
