#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildMinimumReportPlan,buildMinimumSectionPlan } from '../report-plans/minimum-report-plan.mjs';
import { getSectionAgentBinding } from '../section-agents/generator-registry.mjs';
import { executeGuardedPlannedSection } from '../section-agents/guarded-execution.mjs';
import { runSectionReview,resolveSectionReviewRelease,SECTION_REVIEW_RELEASES } from '../section-agents/reviewer-registry.mjs';
import { verifyFrozenSectionReviewer } from '../section-agents/reviewer-runtime.mjs';
const readJson=url=>readFile(url,'utf8').then(JSON.parse);
function setup(sectionId,releaseVersion,evidenceSnapshot,label){
  const agentBinding=getSectionAgentBinding({releaseVersion,sectionId,reportProfileId:'vertical_tank_inspection_v1'});
  const reportPlan=buildMinimumReportPlan({reportPlanId:`review-plan:${label}`,tenantId:'tenant:test',workspaceId:'workspace:test',reportJobId:`job:${label}`,importRevisionId:`import:${label}`,agentBinding});
  const sectionInstanceId=`${sectionId}:1`;const sectionPlan=buildMinimumSectionPlan({reportPlan,sectionInstanceId,evidenceSnapshot});
  return {reportPlan,sectionInstanceId,sectionPlan,evidenceSnapshot,executionMode:'evaluation'};
}
async function main(){
  const general=await readJson(new URL('../section-agents/test-fixtures/general-information.json',import.meta.url));
  const scope=await readJson(new URL('../section-agents/test-fixtures/scope-of-inspection.json',import.meta.url));
  const generalArgs=setup('general-tank-information','general_tank_information_v2',general,'general');
  const scopeArgs=setup('scope-of-inspection','scope_of_inspection_v1',scope,'scope');
  const generalGuarded=await executeGuardedPlannedSection(generalArgs);const scopeGuarded=await executeGuardedPlannedSection(scopeArgs);
  for(const result of [generalGuarded,scopeGuarded]){assert.equal(result.preDisplayReview.decision,'ready_for_review');assert.equal(result.presentation.userVisibility,'allowed');assert(result.presentation.draft);assert.equal(result.presentation.approvalStatus,'not_approved');assert.equal(result.preDisplayReview.checks.goldUsed,false);assert.equal(result.preDisplayReview.checks.liveModelUsed,false);}
  const changedGeneral=structuredClone(generalGuarded.generationResult);const textNode=changedGeneral.draft.document.blocks.flatMap(function walk(node){return Object.hasOwn(node??{},'text')?[node]:(node?.children??[]).flatMap(walk);}).find(node=>node.text.includes('Example Evaluation Client'));textNode.text='Wrong Client';
  const changedGeneralReview=await runSectionReview({reportPlan:generalArgs.reportPlan,sectionPlan:generalArgs.sectionPlan,evidenceSnapshot:general,generationResult:changedGeneral,executionMode:'evaluation'});
  assert.equal(changedGeneralReview.decision,'blocked');assert.equal(changedGeneralReview.userVisibility,'blocked');
  const changedScope=structuredClone(scopeGuarded.generationResult);function removeClaim(nodes){for(const node of nodes){if(node?.attrs?.['data-evidence-id']==='scope-claim:roof-ut')return true;if(removeClaim(node?.children??[]))return true;}return false;}function filter(nodes){return nodes.filter(node=>node?.attrs?.['data-evidence-id']!=='scope-claim:roof-ut').map(node=>({...node,children:node.children?filter(node.children):node.children}));}assert(removeClaim(changedScope.draft.document.blocks));changedScope.draft.document.blocks=filter(changedScope.draft.document.blocks);
  const changedScopeReview=await runSectionReview({reportPlan:scopeArgs.reportPlan,sectionPlan:scopeArgs.sectionPlan,evidenceSnapshot:scope,generationResult:changedScope,executionMode:'evaluation'});
  assert.equal(changedScopeReview.decision,'blocked');assert.match(changedScopeReview.blockers.join(' '),/missing, extra|roof-ut/i);
  const invalid=structuredClone(general);delete invalid.exportPackage.inspectionRecord.client;delete invalid.exportPackage.task.client;const invalidGuarded=await executeGuardedPlannedSection(setup('general-tank-information','general_tank_information_v2',invalid,'invalid'));
  assert.equal(invalidGuarded.presentation.userVisibility,'blocked');assert.equal(invalidGuarded.presentation.draft,null);
  const goldLeak=structuredClone(general);goldLeak.hiddenGold='<p>answer</p>';
  const goldLeakArgs=setup('general-tank-information','general_tank_information_v2',goldLeak,'gold-leak');
  await assert.rejects(executeGuardedPlannedSection(goldLeakArgs),/cannot receive evaluator-only gold/);
  const changedPackPlan=structuredClone(scopeArgs.sectionPlan);changedPackPlan.historicalPatternPack='wrong_pack';
  await assert.rejects(runSectionReview({reportPlan:scopeArgs.reportPlan,sectionPlan:changedPackPlan,evidenceSnapshot:scope,generationResult:scopeGuarded.generationResult,executionMode:'evaluation'}),/knowledge-pack bindings/);
  assert.throws(()=>resolveSectionReviewRelease({generatorReleaseVersion:'future_section_v1',sectionId:'future',reportProfileId:'vertical_tank_inspection_v1'}),/No exact/);
  for(const release of Object.values(SECTION_REVIEW_RELEASES))await verifyFrozenSectionReviewer(release);
  console.log(JSON.stringify({passed:true,reviewerReleases:2,visiblePassedDrafts:2,tamperedDraftsBlocked:2,invalidGenerationHidden:true,goldInputsUsed:0,paidAiCalls:0,futureSectionsFailClosed:true},null,2));
}
await main();
