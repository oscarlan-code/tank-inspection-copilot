import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSectionPlanningSnapshot } from '../section-planner.mjs';
import { generatePlannedSectionDraft, PLANNED_GENERATOR_CONTRACT } from '../planned-generation.mjs';
import { generateSectionDraft } from '../generation.mjs';
import { evaluateSectionPlanOutput } from '../section-plan-evaluation.mjs';
import { parseSectionDocument, renderSectionDocumentHtml, validateSectionDocument } from '../report-document.mjs';

const native=JSON.parse(readFileSync(new URL('../../src/fixtures/v3-product-export-shell-internal.json',import.meta.url)));
// Explicit fixture unit is a test input, never an inferred unit for real exports.
native.unitProfile={thicknessUnit:'MM'};
const frozen=JSON.stringify(native);
const state={exportPackage:native,sectionPlanning:buildSectionPlanningSnapshot({exportPackage:native})};
let calls=0;
const noWorker=async()=>{calls++;throw new Error('No voice worker permitted');};
for(const sectionId of ['shell-plate-thickness-measurements','tank-inspection-checklist']) {
 const result=await generatePlannedSectionDraft({reportState:state,sectionId,worker:noWorker,aiStatus:{configured:true}});
 const score=evaluateSectionPlanOutput({sectionPlan:state.sectionPlanning.sectionPlans.find(p=>p.sectionId===sectionId),evidenceRecords:state.sectionPlanning.evidenceRecords,generatedContent:result.draft.content});
 assert.equal(score.truthGraphEvaluation.requiredFactRecall,1,sectionId);
 assert.deepEqual(score.blockerReasons,[]);
 assert.equal(result.orchestration.generatorContractVersion,PLANNED_GENERATOR_CONTRACT);
 assert.equal(result.draft.content,renderSectionDocumentHtml(result.draft.reportDocument));
}
assert.equal(calls,0);
const draft=await generatePlannedSectionDraft({reportState:state,sectionId:'inspection-report',aiStatus:{configured:false}});
assert.ok(!draft.draft.content.includes('<table'), 'Supporting UT rows must not be appended to narrative');
assert.ok(!/evidence appendix|captured evidence appendix/i.test(draft.draft.content));
assert.equal(JSON.stringify(native),frozen);
const minimal={inspectionId:'audit',findings:[{findingId:'f1',targetKey:'floor',itemKey:'P1',itemLabel:'Floor plate P1',note:'Local corrosion was observed.'}],utMeasurements:[{targetKey:'shell',itemKey:'P2',itemLabel:'Shell plate P2',itemKind:'region',unitCode:'in',value1:0.25,measured:true}]};
const small={exportPackage:minimal,sectionPlanning:buildSectionPlanningSnapshot({exportPackage:minimal})};
const noVoice=await generatePlannedSectionDraft({reportState:small,sectionId:'inspection-report',worker:noWorker,aiStatus:{configured:true}});
assert.ok(noVoice.draft.content.includes('Local corrosion was observed.'));
assert.ok(!noVoice.draft.content.includes('0.25'));
assert.equal(calls,0);
// The normal entry point executes this contract independent of a policy version.
const live=await generateSectionDraft({reportState:small,sectionId:'inspection-report',executionMode:'evaluation'});
assert.equal(live.draft.content,noVoice.draft.content);
assert.equal(live.orchestration.generatorContractVersion,PLANNED_GENERATOR_CONTRACT);
const production=await generateSectionDraft({reportState:state,sectionId:'shell-plate-thickness-measurements'});
assert.notEqual(production.orchestration.generatorContractVersion,PLANNED_GENERATOR_CONTRACT,'A planning object alone must not activate the candidate in production.');
const badUnit={...minimal,utMeasurements:[{...minimal.utMeasurements[0],unitCode:undefined}]};
const badState={exportPackage:badUnit,sectionPlanning:buildSectionPlanningSnapshot({exportPackage:badUnit})};
const unresolved=await generatePlannedSectionDraft({reportState:badState,sectionId:'shell-plate-thickness-measurements',aiStatus:{configured:false}});
assert.ok(unresolved.generationRun.blockers.length);
assert.ok(!unresolved.draft.content.includes('0.25 mm'));
const voicePackage={...minimal,voiceNotes:[{voiceNoteId:'v1',targetKey:'floor',itemKey:'P3',itemLabel:'Floor plate P3',transcriptStatus:'transcribed',transcriptText:'Floor plate P3 has local corrosion.'}]};
const voiceState={exportPackage:voicePackage,sectionPlanning:buildSectionPlanningSnapshot({exportPackage:voicePackage})};
let prompt='';
const fallback=await generatePlannedSectionDraft({reportState:voiceState,sectionId:'inspection-report',userInstruction:'Keep it concise.',aiStatus:{configured:true},worker:async input=>{prompt=input.prompt;throw new Error('Simulated worker failure');}});
assert.ok(prompt.includes('Keep it concise.'));
assert.ok(prompt.includes('Floor plate P3'));
assert.ok(!prompt.includes('0.25')&&!prompt.includes('Shell plate P2'));
assert.ok(fallback.draft.content.includes('Floor plate P3 has local corrosion.'));
assert.ok(!fallback.draft.content.includes('<table'));
assert.equal(fallback.generationRun.usedLiveModel,false);
assert.equal(validateSectionDocument(parseSectionDocument({sectionId:'x',html:'<h2>Title only</h2>'})).valid,false);
console.log('Planned generation audit passed: native rows/cells, no-voice findings, scoped voice, model failure, explicit units, production parity, source immutability, semantic HTML and no evidence appendix.');

const unknownRow=badState.sectionPlanning.evidenceRecords.find(r=>r.kind==='measurement');
const resolvedState={exportPackage:badUnit,sectionPlanning:buildSectionPlanningSnapshot({exportPackage:badUnit,decisions:[
 {evidenceId:unknownRow.evidenceId,sectionId:'shell-plate-thickness-measurements',slotKey:'measurements',role:'required_structured',unitCode:'in',reason:'Confirmed inch unit from the app setup record.'},
 {kind:'section_scope',sectionId:'shell-plate-thickness-measurements',applicability:'applicable',applicableSlotKeys:['measurements'],reason:'This measurement table is required.'},
]})};
const resolved=await generatePlannedSectionDraft({reportState:resolvedState,sectionId:'shell-plate-thickness-measurements',aiStatus:{configured:false}});
const scoreResolved=content=>evaluateSectionPlanOutput({sectionPlan:resolvedState.sectionPlanning.sectionPlans.find(p=>p.sectionId==='shell-plate-thickness-measurements'),evidenceRecords:resolvedState.sectionPlanning.evidenceRecords,generatedContent:content});
assert.equal(scoreResolved(resolved.draft.content).truthGraphEvaluation.requiredFactRecall,1,'Reviewed measurement units remain subject to integrity checks');
assert.ok(scoreResolved(resolved.draft.content.replace('0.25 in','0.25 mm')).blockerReasons.length,'Reviewed evidence must not bypass unit-change detection');

const narrativeState={exportPackage:minimal,sectionPlanning:buildSectionPlanningSnapshot({exportPackage:minimal,manualInputs:{engineeringImplication:'The captured coating condition requires inspector review.'}})};
const implication=await generatePlannedSectionDraft({reportState:narrativeState,sectionId:'inspection-report',aiStatus:{configured:false}});
assert.ok(implication.draft.content.includes('<h3>ENGINEERING IMPLICATION</h3>'));
assert.ok(!implication.draft.content.includes('<table'),'A narrative manual input must follow the outline instead of becoming a field grid.');
const implicationScore=evaluateSectionPlanOutput({sectionPlan:narrativeState.sectionPlanning.sectionPlans.find(plan=>plan.sectionId==='inspection-report'),evidenceRecords:narrativeState.sectionPlanning.evidenceRecords,generatedContent:implication.draft.content});
assert.equal(implicationScore.truthGraphEvaluation.requiredFactRecall,1);

const checklist=await generatePlannedSectionDraft({reportState:state,sectionId:'tank-inspection-checklist',aiStatus:{configured:false}});
for(const code of ['1','2','3','4','IA','NE','N/A','NC']) assert.ok(checklist.draft.content.includes(`<th>${code}</th>`),`The response grid must preserve ${code}.`);
const alteredChecklist=checklist.draft.content.replace('<td>●</td><td></td>','<td></td><td>●</td>');
const alteredScore=evaluateSectionPlanOutput({sectionPlan:state.sectionPlanning.sectionPlans.find(plan=>plan.sectionId==='tank-inspection-checklist'),evidenceRecords:state.sectionPlanning.evidenceRecords,generatedContent:alteredChecklist});
assert.ok(alteredScore.truthGraphEvaluation.requiredFactRecall<1,'Moving a response marker cannot pass evidence recovery.');

const observation=small.sectionPlanning.evidenceRecords.find(record=>record.kind==='observation');
const multiSnapshot=buildSectionPlanningSnapshot({exportPackage:minimal,decisions:[{operation:'add',evidenceId:observation.evidenceId,sectionId:'inspection-report',slotKey:'assessment-summaries',role:'required_narrative',reason:'The inspector requires this finding in the component section and assessment summary.'}]});
const multi=await generatePlannedSectionDraft({reportState:{exportPackage:minimal,sectionPlanning:multiSnapshot},sectionId:'inspection-report',aiStatus:{configured:false}});
const obligationIds=[...multi.draft.content.matchAll(/data-obligation-id="([^"]+)"/g)].map(match=>match[1]);
assert.equal(new Set(obligationIds).size,2,'Each required use must carry its own block-specific obligation.');
const missingBlock=multi.draft.content.replace(/<section data-block-id="inspection-report:assessment-summaries">[\s\S]*?<\/section>/,'');
const missingBlockScore=evaluateSectionPlanOutput({sectionPlan:multiSnapshot.sectionPlans.find(plan=>plan.sectionId==='inspection-report'),evidenceRecords:multiSnapshot.evidenceRecords,generatedContent:missingBlock});
assert.equal(missingBlockScore.truthGraphEvaluation.requiredFactRecall,0.5,'One occurrence cannot satisfy two required outline blocks.');
assert.equal(missingBlockScore.misplacedObligationIds.length,1);
