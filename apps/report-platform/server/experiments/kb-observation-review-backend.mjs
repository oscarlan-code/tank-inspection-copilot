import { GENERAL_INFORMATION_REVIEW_CHOICE } from './general-information-review-backend.mjs';
// Saved-artifact review only. Existing super-admin route owns authorization.
import {readFile} from 'node:fs/promises';
import {digest} from '../observation-context.mjs';
import {SCENARIOS,OBSERVATION_CASES,COMPARISON_CONTRACT} from './kb-observation-comparison.mjs';
import {ABLATION_CASES} from './section-kb-ablation.mjs';
import {INSPECTOR_CASE,loadInspectorNotesReview} from './inspector-notes-review-backend.mjs';
const root=new URL('../../docs/reviews/data/tk5452-kb-observations-v1/',import.meta.url);
const check=(condition,message)=>{if(!condition)throw Object.assign(new Error(message),{statusCode:409});};
export function verifyObservationReview(review,bytes,manifest){
 check(manifest.contractVersion==='observation_comparison_review_v1'&&manifest.evaluationOnly,'Invalid observation comparison manifest');
 check(digest(bytes)===manifest.comparisonSha256,'Observation comparison checksum changed');
 check(review.contractVersion===COMPARISON_CONTRACT&&review.evaluationOnly&&review.policyPromotionPerformed===false,'Invalid comparison boundary');
 check(review.sourcePackageHash===manifest.sourcePackageHash&&review.observations.length===12&&review.results.length===24,'Incomplete comparison');
 for(const s of SCENARIOS){
  const rows=review.results.filter(r=>r.observationId===s.id);
  check(rows.length===2&&new Set(rows.map(r=>r.arm)).size===2&&rows.every(r=>['with_kb','without_kb'].includes(r.arm)),'Missing comparison pair');
  check(rows[0].baseInputHash===rows[1].baseInputHash&&rows[0].modelId===rows[1].modelId,'Comparison conditions differ');
  check(rows.every(r=>r.checks.accepted===false),'Unapproved proposal accepted');
 }
}
const referenceMatchers={
 '01-site-piping':[/^Site pipings exhibited/,/^UT spot measurements carried out on various/],
 '02-floor-projection':[/^Floor projection width/,/^Floor projection plate on the West/,/^Floor projection on the West/],
 '03-external-shell':[/^Shell external was visually/,/^Shell plate external/,/^Ultrasonic thickness measurement conducted on the shell/],
 '04-shell-nozzle-s4':[/^2” nozzle S4/],
 '05-roof-coating':[/^Roof plates external/,/^Curb angle underside/],
 '06-roof-design':[/^Roof was not of frangible/],
 '07-roof-nozzles':[/^Roof manhole and nozzles/],
 '08-roof-flange':[/^3” roof nozzle/],
 '09-roof-bracket':[/^Roof external bracket attachment/],
 '10-tell-tales':[/^Tell-tale holes on shell nozzles/],
 '11-ladder':[/^Vertical ladder attached/],
 '12-sump':[/^Centre sump/,/^UT B-Scan was not able to be carried out on the sump/],
};
const recommendationMatchers={
 '01-site-piping':/^Site piping affected/, '02-floor-projection':/^Floor projection plate locations/, '03-external-shell':/^Shell external plates/,
 '05-roof-coating':/^Roof external plates and curb/, '06-roof-design':/^Roof should be evaluated/, '07-roof-nozzles':/^Roof Manhole and nozzles/, '09-roof-bracket':/^Roof external bracket attachment/,
};
function bullets(text){return text.split(/(?=➢)/).filter(t=>t.startsWith('➢')).map(t=>t.split(/\n\s*\n/)[0].replace(/\s+/g,' ').trim());}
export function originalExcerpt(sections,id){
 const findings=sections.find(s=>s.sectionId==='04-inspection-report');
 const matches=bullets(findings.originalSectionContent).filter(b=>referenceMatchers[id].some(re=>re.test(b.replace(/^➢\s*/, '').replace(/\s+/g,' '))));
 check(matches.length>0,'Original observation excerpt is missing');
 const matcher=recommendationMatchers[id];
 const actions=matcher?bullets(sections.find(s=>s.sectionId==='05-recommendations').originalSectionContent).filter(b=>matcher.test(b.replace(/^➢\s*/,'').replace(/\s+/g,' '))):[];
 return `4 INSPECTION REPORT · selected source passages\n\n${matches.join('\n\n')}\n\n5 REPAIR RECOMMENDATIONS · historical reference only\n\n${actions.join('\n\n')||'No corresponding action is listed in this report section. This does not establish that no action is needed.'}`;
}
export async function loadObservationKbReview({evaluationCaseId,sectionId,evalRunId}){
 const choice=OBSERVATION_CASES.find(c=>c.evaluationCaseId===evaluationCaseId);
 if(!choice)throw Object.assign(new Error('Observation comparison not found'),{statusCode:404});
 if(!sectionId||sectionId==='identity')sectionId=SCENARIOS[0].id;
 const index=SCENARIOS.findIndex(s=>s.id===sectionId);
 if(index<0)throw Object.assign(new Error('Observation not part of this comparison'),{statusCode:404});
 const bytes=await readFile(new URL('comparison.json',root));
 const manifest=JSON.parse(await readFile(new URL('review-manifest.json',root),'utf8')),review=JSON.parse(bytes);
 verifyObservationReview(review,bytes,manifest);
 const assessmentBytes=await readFile(new URL('assessment.json',root));
 check(digest(assessmentBytes)===manifest.assessmentSha256,'Observation assessment checksum changed');
 const assessment=JSON.parse(assessmentBytes);
 check(assessment.comparisonSha256===manifest.comparisonSha256&&assessment.independentHumanReview===false,'Assessment does not belong to this diagnostic');
 const finding=assessment.assessments.find(item=>item.observationId===sectionId);
 check(finding,'Observation assessment missing');
 const row=review.results.find(r=>r.observationId===sectionId&&r.arm===choice.arm),peer=review.results.find(r=>r.observationId===sectionId&&r.arm!==choice.arm);
 const runId=`${evaluationCaseId}:${row.requestHash}:${sectionId}`;
 if(evalRunId&&evalRunId!==runId)throw Object.assign(new Error('Saved run not found'),{statusCode:404});
 const base=await loadInspectorNotesReview({evaluationCaseId:INSPECTOR_CASE,sectionId:'04-inspection-report'});
 const o=review.observations.find(o=>o.observationId===sectionId),reportName=`TK 5452 · ${choice.label}`;
 const evidence=[{evidenceId:o.observationId,sourceClass:'app_voice',sourcePointer:o.sourceSpans.map(s=>s.sourcePointer).join(', '),label:o.componentLabel,
 text:o.originalWording,processedText:o.sourceSpans.map(s=>`${s.sourcePointer} [${s.start}:${s.end}] ${s.text}`),usedInGeneration:true,
 context:`Physical component: ${o.componentId}. Both branches use the same source-bound observation. Original action sentences withheld.`,issues:[]}];
 for(const c of row.retrievedCases)evidence.push({evidenceId:c.caseId,sourceClass:'historical_case',sourcePointer:`${c.provenance.reportId} · pages ${c.provenance.pages.join(', ')}`,label:c.caseId,
 text:`Historical observation: ${c.observation.text}\nHistorical recommendation: ${c.recommendedAction.text}`,processedText:[`Implementation: unknown. Outcome: unknown. Additional applicability conditions: unknown. Expert approval: pending. Source date: ${c.provenance.issuedOn}.`],usedInGeneration:true,context:'Historical precedent only; not current inspection evidence or verified technical guidance.',issues:[]});
 const words=r=>r.candidateContent.replace(/<[^>]+>/g,' ').trim().split(/\s+/).length;
 return {...base,evaluationCaseId,evalRunId:runId,sectionId,sectionTitle:SCENARIOS[index].label,reportName,
  generationBackend:'tk5452_observation_case_comparison_v1',generatorContractVersion:'observation_recommendation_candidate_v1',experimentContract:COMPARISON_CONTRACT,
  benchmarkStatus:'paired_source_reconstruction',sectionPlanEvaluation:null,captureAvailability:null,evidenceReview:null,
  sourcePdfUrl:`/api/v1/admin/generic-outline-reviews/${evaluationCaseId}/source`,
  comparisonExperiment:{name:'12-observation historical-case comparison',arm:choice.arm,label:choice.label,wordCount:words(row),peerWordCount:words(peer),modelId:row.modelId,caseIds:OBSERVATION_CASES.map(c=>c.evaluationCaseId),unitLabel:'observations',reviewOnlyProposals:true},
  revisionChoices:[GENERAL_INFORMATION_REVIEW_CHOICE,...OBSERVATION_CASES,...ABLATION_CASES,{evaluationCaseId:INSPECTOR_CASE,label:'Inspector notes · evaluation v2',sectionIds:base.sections.map(s=>s.sectionId)}],
  sections:SCENARIOS.map(s=>({evaluationCaseId,reportName,sectionId:s.id,sectionTitle:s.label,completed:true,outcomeCode:'needs_attention',hardFailure:review.results.find(r=>r.observationId===s.id&&r.arm===choice.arm).checks.blockers.length>0})),
  previousEvaluationCaseId:index>0?evaluationCaseId:null,previousSectionId:SCENARIOS[index-1]?.id??null,
  nextEvaluationCaseId:index<SCENARIOS.length-1?evaluationCaseId:null,nextSectionId:SCENARIOS[index+1]?.id??null,
  originalSectionContent:originalExcerpt(review.referenceSections,sectionId),generatedContent:row.retainedContent,aiCandidateContent:row.candidateContent,appEvidence:evidence,
  rawAiResponse:{accepted:false,modelId:row.modelId,findings:[{text:row.output.observationText},...row.output.proposedActions.map(p=>({text:p.action})),...row.output.clarificationQuestions.map(text=>({text}))]},
  inputReadiness:{status:'supplied',totalSections:12,sectionsWithInputs:12,sectionsWithoutInputs:0,sections:SCENARIOS.map(s=>({sectionId:s.id,title:s.label,status:'supplied',reasons:[]}))},
  metrics:{score:null,outcomeCode:'needs_attention',requiredFactRecall:null,claimPrecision:null,protectedFactAccuracy:null,formatMatch:null,professionalAcceptability:null,goldContentCoverage:null,outputLengthBalance:null,hardFailure:row.checks.blockers.length>0,hardFailureReasons:row.checks.blockers,evaluationPoints:[]},
  diagnosticNotes:[`${choice.label}. ${finding.assessment} Codex qualitative review; inspector assessment is pending.`,
   `Recommendations withheld from current inputs. ${row.retrievedCases.length} historical candidate cases supplied for this observation.`,
   'This tests proposed actions from observations, unlike the previous writing-only comparison. Both arms share source-bound component identities and glossary. The original report is shown for review, not used as the correctness rubric.',
   'Automatic checks cover identifiers, numeric tokens and citation eligibility only. Recommendations, applicability and semantic completeness await inspector review.',...review.limitations],
  promotionGate:{...base.promotionGate,eligible:false,reasons:['Diagnostic proposals; independent inspector evaluation pending.'],sectionCount:12,passedSectionCount:0},createdAtIso:review.createdAtIso};
}
