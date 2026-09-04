import {createHash} from "node:crypto";
import {evaluateGoldSectionRecovery,evaluateSectionFormatContract} from "../eval.mjs";
import {evaluateEvidenceConditionedGeneration,evaluateSemanticSectionSimilarity} from "../semantic-eval.mjs";
import {createPostgresDatabase} from "../storage/postgres.mjs";
import {compileDeterministicAppRecords,scoreEntityRelationshipBindings,validateEntityBoundEvidence} from "../evidence-entity-binding.mjs";
import {finalizeGovernedGeneratedContent,formatGovernedSectionHtml,getGovernedSectionRoute,runGovernedNarrativeGeneration} from "../governed-generation-contract.mjs";
import {classifyInspectorReviewDraft,DRAFT_QUALITY_CONTRACT_VERSION} from "../draft-quality.mjs";

if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required.");
const policyVersionId=String(process.env.GOVERNED_POLICY_VERSION_ID??"rl_policy_report_generation_v7_labelled_voice");
const pairContractVersion=Number(process.env.GOVERNED_PAIR_CONTRACT_VERSION??3);
const requested=Number(process.env.GOVERNED_TRAINING_PAIR_LIMIT??6);
const pairLimit=Number.isInteger(requested)&&requested>0?requested:6;
const targetPairId=String(process.env.GOVERNED_TARGET_PAIR_ID??"").trim();
const cohortId=String(process.env.GOVERNED_COHORT_ID??"").trim();
const datasetSplit=String(process.env.GOVERNED_DATASET_SPLIT??"training");
if(!["training","validation"].includes(datasetSplit))throw new Error(`Unsupported governed dataset split: ${datasetSplit}.`);
const armSelectionMode=String(process.env.GOVERNED_ARM_SELECTION_MODE??"all");
const concurrency=Math.max(1,Math.min(4,Number(process.env.GOVERNED_TRAINING_CONCURRENCY??2)));
const db=await createPostgresDatabase({databaseUrl:process.env.DATABASE_URL});
try{
  const requestedArmKeys=new Set(String(process.env.GOVERNED_ARM_KEYS??"").split(",").map((value)=>value.trim()).filter(Boolean));
  const allArms=await db.prepare(`SELECT arm_id,arm_key,display_name,config_json FROM system_rl_policy_arms WHERE policy_version_id=? AND is_enabled=TRUE ORDER BY stable_order`).all(policyVersionId);
  const arms=requestedArmKeys.size?allArms.filter((arm)=>requestedArmKeys.has(arm.arm_key)):allArms;
  if(!arms.length)throw new Error(`No enabled arms for ${policyVersionId}.`);
  const selectedPairs=cohortId?await db.prepare(
    `SELECT p.*,g.target_content,r.asset_lineage_key,r.core_family,r.report_reference,r.profile_json
     FROM report_governed_validation_cohort_items i
     JOIN report_governed_baseline_pairs p ON p.corpus_report_id=i.corpus_report_id AND p.section_key=i.section_key
     JOIN report_governed_gold_sections g ON g.governed_gold_section_id=p.governed_gold_section_id
     JOIN report_corpus_registry r ON r.corpus_report_id=p.corpus_report_id
     WHERE i.cohort_id=? AND p.dataset_split=? AND p.status_code='ready' AND p.contract_version=?
     ORDER BY i.stable_order`).all(cohortId,datasetSplit,pairContractVersion):await db.prepare(
    `WITH candidates AS (
       SELECT p.*,g.target_content,r.asset_lineage_key,r.core_family,r.report_reference,r.profile_json,
         ROW_NUMBER() OVER (PARTITION BY r.core_family,p.section_key ORDER BY encode(digest(p.corpus_report_id||':'||p.section_key||?,'sha256'),'hex')) stratum_rank
       FROM report_governed_baseline_pairs p
       JOIN report_governed_gold_sections g ON g.governed_gold_section_id=p.governed_gold_section_id
       JOIN report_corpus_registry r ON r.corpus_report_id=p.corpus_report_id
       WHERE p.dataset_split=? AND p.status_code='ready' AND p.contract_version=?
     ) SELECT * FROM candidates ORDER BY stratum_rank,encode(digest(corpus_report_id||':'||section_key||?,'sha256'),'hex') LIMIT ?`,
  ).all(policyVersionId,datasetSplit,pairContractVersion,policyVersionId,pairLimit);
  if(cohortId){const expected=await db.prepare(`SELECT COUNT(*)::int count FROM report_governed_validation_cohort_items WHERE cohort_id=?`).get(cohortId);if(selectedPairs.length!==expected.count)throw new Error(`Pinned cohort ${cohortId} resolved ${selectedPairs.length}/${expected.count} ready contract-${pairContractVersion} pairs.`);}
  const pairs=targetPairId?selectedPairs.filter((pair)=>pair.governed_pair_id===targetPairId):selectedPairs;
  if(targetPairId&&!pairs.length)throw new Error(`Target governed pair ${targetPairId} was not found in the selected cohort.`);
  const completedKeys=new Set((await db.prepare(`SELECT governed_pair_id,arm_id FROM report_governed_rag_training_runs WHERE policy_version_id=? AND status_code='completed'`).all(policyVersionId)).map((row)=>`${row.governed_pair_id}:${row.arm_id}`));
  const jobs=(armSelectionMode==="contextual_frozen"
    ? pairs.map((pair)=>({pair,arm:selectFrozenArm(pair,arms)}))
    : pairs.flatMap((pair)=>arms.map((arm)=>({pair,arm}))))
    .filter(({pair,arm})=>!completedKeys.has(`${pair.governed_pair_id}:${arm.arm_id}`));
  let cursor=0,completed=0,failed=0;
  async function worker(){while(cursor<jobs.length){const job=jobs[cursor++];try{await runEpisode(job);completed++;}catch(error){failed++;process.stderr.write(`${job.pair.governed_pair_id}/${job.arm.arm_key}: ${message(error)}\n`);}process.stdout.write(`${JSON.stringify({progress:{completed,failed,total:jobs.length}})}\n`);}}
  await Promise.all(Array.from({length:concurrency},()=>worker()));
  const summary=await db.prepare(
    `SELECT a.arm_key,COUNT(*)::int episodes,AVG(r.reward_value)::float8 mean_reward,
       AVG((r.semantic_metrics_json->>'evidenceCoverage')::float8)::float8 evidence_coverage,
       AVG((r.semantic_metrics_json->'goldBenchmark'->>'semanticSimilarity')::float8)::float8 gold_similarity_diagnostic,
       AVG((r.deterministic_metrics_json->'recovery'->>'contentCoverage')::float8)::float8 content_coverage,
       SUM(CASE WHEN r.hard_failure THEN 1 ELSE 0 END)::int hard_failures
     FROM report_governed_rag_training_runs r JOIN system_rl_policy_arms a USING(arm_id)
     WHERE r.policy_version_id=? AND r.status_code='completed' GROUP BY a.arm_key ORDER BY mean_reward DESC`,
  ).all(policyVersionId);
  console.log(JSON.stringify({policyVersionId,cohortId:cohortId||null,pairs:pairs.length,arms:arms.length,alreadyCompleted:completedKeys.size,attempted:jobs.length,completed,failed,summary},null,2));
  if(failed)process.exitCode=1;

  async function runEpisode({pair,arm}){
    const config=json(arm.config_json,{});
    const runId=`grtr_${sha(`${pair.governed_pair_id}:${policyVersionId}:${arm.arm_id}`).slice(0,28)}`;
    const now=new Date().toISOString();
    const retrieval=await retrieve(pair,config);
    const contextKey=`${pair.core_family}:${pair.section_key}`;
    await db.prepare(
      `INSERT INTO report_governed_rag_training_runs (governed_run_id,governed_pair_id,policy_version_id,arm_id,context_key,retrieval_audit_json,status_code,started_at_iso,updated_at_iso)
       VALUES (?,?,?,?,?,?::jsonb,'running',?,?) ON CONFLICT (governed_pair_id,policy_version_id,arm_id) DO UPDATE SET retrieval_audit_json=excluded.retrieval_audit_json,status_code='running',error_message=NULL,started_at_iso=excluded.started_at_iso,completed_at_iso=NULL,updated_at_iso=excluded.updated_at_iso`,
    ).run(runId,pair.governed_pair_id,policyVersionId,arm.arm_id,contextKey,JSON.stringify(retrieval.audit),now,now);
    try{
      if(!retrieval.audit.firewallPassed)throw new Error("Retrieval firewall rejected the episode.");
      const entityContract=validateEntityBoundEvidence(pair.mock_input_json);if(!entityContract.valid)throw new Error(`Entity-bound evidence contract failed: ${entityContract.issues.join(", ")}`);
      const route=getGovernedSectionRoute({sectionId:pair.section_key,hasVoiceEvidence:(pair.mock_input_json?.voiceNotes??[]).length>0});
      const response=route.llmRole==="none"?{parsed:{sectionContent:""}}:await runGovernedNarrativeGeneration({sectionId:pair.section_key,evidenceInput:generationEvidenceView(pair.mock_input_json),precedents:retrieval.items,policyAction:policyGuidance(arm.arm_key),promptVariant:config.promptVariant??"baseline_v1",precedentCharacterLimit:config.precedentCharacterLimit??2000});
      const deterministic=compileDeterministicAppRecords(pair.mock_input_json?.appRecords,{outputFormat:"html"});
      const generated=formatGovernedSectionHtml({sectionId:pair.section_key,sectionTitle:pair.section_key,content:finalizeGovernedGeneratedContent({narrative:String(response.parsed.sectionContent??"").trim(),deterministicContent:deterministic,evidenceInput:pair.mock_input_json})});
      const recovery=evaluateGoldSectionRecovery({goldContent:pair.target_content,generatedContent:generated,evaluationMode:"evidence_conditioned_semantic",minimumContentCoverage:0.55});
      const format=evaluateSectionFormatContract({sectionId:pair.section_key,goldContent:pair.target_content,generatedContent:generated});
      const protectedFacts=scoreProtected(pair.protected_invariants_json,generated);
      const unsupportedClaims=scoreUnsupportedClaims(pair.mock_input_json,generated);
      const atomicBindings=scoreAtomicBindings(pair.mock_input_json,generated);
      const entityBindings=scoreEntityRelationshipBindings(pair.mock_input_json,generated);
      const [evidenceSemantic,goldBenchmark]=await Promise.all([
        evaluateEvidenceConditionedGeneration({sectionId:pair.section_key,allowedEvidence:pair.mock_input_json,generatedContent:generated}),
        evaluateSemanticSectionSimilarity({sectionId:pair.section_key,goldContent:pair.target_content,generatedContent:generated}),
      ]);
      const semantic={...evidenceSemantic,goldBenchmark};
      const classification=classifyInspectorReviewDraft({
        protectedFactMismatchCount:protectedFacts.mismatchedCount+atomicBindings.violationCount,
        unsupportedCriticalClaimCount:unsupportedClaims.count,
        unsafeEvidenceVerdict:evidenceSemantic.verdict==="unsafe",
        entityRelationshipAccuracy:entityBindings.applicable?Math.max(0,1-entityBindings.violationCount/Math.max(1,(pair.mock_input_json?.observations??[]).length)):null,
        semanticRecovery:Number(goldBenchmark.semanticSimilarity??0),
        requiredConceptRecall:Number(evidenceSemantic.evidenceCoverage??0),
        claimPrecision:unsupportedClaims.count===0?1:Math.max(0,1-unsupportedClaims.count/Math.max(1,extractClaims(generated).length)),
        protectedFactAccuracy:protectedFacts.accuracy,
        formatReadiness:Number(format.score??0),
      });
      const hardFailure=classification.outcomeCode==="blocked"||!generated;
      const reviewDisposition=hardFailure?"blocked":classification.outcomeCode;
      const reward=hardFailure?0:bounded(0.30*Number(evidenceSemantic.evidenceCoverage??0)+0.25*Number(evidenceSemantic.evidenceFidelity??0)+0.15*Number(evidenceSemantic.safeAbstention??0)+0.15*Number(evidenceSemantic.professionalUsefulness??0)+0.15*Number(format.score??0));
      const finished=new Date().toISOString();
      await db.prepare(`UPDATE report_governed_rag_training_runs SET generated_content=?,deterministic_metrics_json=?::jsonb,semantic_metrics_json=?::jsonb,reward_value=?,hard_failure=?,status_code='completed',completed_at_iso=?,updated_at_iso=? WHERE governed_run_id=?`).run(generated,JSON.stringify({recovery,format,protectedFacts,unsupportedClaims,atomicBindings,entityBindings,reviewDisposition,draftQualityContractVersion:DRAFT_QUALITY_CONTRACT_VERSION,classification,deterministicCompiler:{applied:Boolean(deterministic),version:"app_records_v1"}}),JSON.stringify(semantic),reward,hardFailure,finished,finished,runId);
    }catch(error){const finished=new Date().toISOString();await db.prepare(`UPDATE report_governed_rag_training_runs SET status_code='failed',hard_failure=TRUE,error_message=?,completed_at_iso=?,updated_at_iso=? WHERE governed_run_id=?`).run(message(error).slice(0,2000),finished,finished,runId);throw error;}
  }

  async function retrieve(pair,config){
    const limit=Math.max(1,Math.min(6,Number(config.precedentLimit??3)));
    const candidates=await db.prepare(
      `SELECT d.corpus_report_id,d.asset_lineage_key,d.core_family,d.scope_code,d.lifecycle_code,d.method_codes_json,s.section_id,string_agg(c.content,E'\n\n' ORDER BY c.stable_order) content
       FROM report_governed_kb_documents d JOIN report_governed_kb_sections s USING(kb_index_id,corpus_report_id)
       JOIN kb_sections ks ON ks.section_id=s.section_id JOIN kb_chunks c ON c.document_id=ks.document_id AND c.section_type=s.section_key
       WHERE d.kb_index_id='governed_kb_content_v1' AND s.section_key=? AND d.core_family=?
         AND d.corpus_report_id<>? AND d.asset_lineage_key<>?
       GROUP BY d.corpus_report_id,d.asset_lineage_key,d.core_family,d.scope_code,d.lifecycle_code,d.method_codes_json,s.section_id`,
    ).all(pair.section_key,pair.core_family,pair.corpus_report_id,pair.asset_lineage_key);
    const query=JSON.stringify(pair.mock_input_json);
    const profile=json(pair.profile_json,{});const scope=String(profile.primaryInspectionScope??"unspecified");const lifecycle=String(profile.lifecycle??"unspecified");const methods=new Set(profile.methods??[]);
    const scopeMode=String(config.retrievalScope??"family_section");
    const eligible=candidates.filter((item)=>scopeMode!=="exact_profile"||(item.scope_code===scope&&item.lifecycle_code===lifecycle));
    const ranked=eligible.map((item)=>{const candidateMethods=json(item.method_codes_json,[]);const methodOverlap=candidateMethods.filter((method)=>methods.has(method)).length/Math.max(1,new Set([...methods,...candidateMethods]).size);return {...item,score:tokenOverlap(query,item.content)+(scopeMode==="method_compatible"?0.25*methodOverlap:0)};}).sort((a,b)=>b.score-a.score||String(a.corpus_report_id).localeCompare(String(b.corpus_report_id))).slice(0,limit);
    const leak=ranked.filter((item)=>item.corpus_report_id===pair.corpus_report_id||item.asset_lineage_key===pair.asset_lineage_key);
    return {items:ranked,audit:{kbIndexId:"governed_kb_content_v1",retrievalScope:scopeMode,sourceCorpusReportId:pair.corpus_report_id,sourceAssetLineageKey:pair.asset_lineage_key,candidateCount:candidates.length,eligibleCandidateCount:eligible.length,retrievedCount:ranked.length,retrievedSectionIds:ranked.map((x)=>x.section_id),retrievedCorpusReportIds:ranked.map((x)=>x.corpus_report_id),excludedCurrentReport:true,excludedCurrentLineage:true,firewallPassed:leak.length===0}};
  }
}finally{await db.close();}

function policyGuidance(armKey){return armKey==="grounded"?"Write a concise section containing only claims directly supported by current evidence. Do not expand missing context.":armKey==="balanced"?"Organize all current evidence into a complete professional section. Use precedent only to choose ordering and reporting style.":"Recover the fullest safe section possible from all current notes without filling missing facts from precedent.";}
function generationEvidenceView(input){
  const physicalEntityIds=new Set((input.entities??[]).filter((entity)=>entity.entityType!=="section_observation").map((entity)=>entity.entityId));
  const {appRecords:_appRecords,...narrativeInput}=input;
  return {...narrativeInput,
    entities:(input.entities??[]).filter((entity)=>physicalEntityIds.has(entity.entityId)),
    observations:(input.observations??[]).filter((observation)=>physicalEntityIds.has(observation.entityId)),
    voiceNotes:(input.voiceNotes??[]).map((note)=>physicalEntityIds.has(note.entityId)?note:{
      voiceNoteId:note.voiceNoteId,sectionKey:note.sectionKey,fieldLabel:note.fieldLabel,
      transcript:note.transcript,captureOrder:note.captureOrder,source:note.source,
    }),
  };
}
function scoreProtected(values,generated){const items=json(values,[]);const missing=items.filter((item)=>!normalized(generated).includes(normalized(item.value)));return {count:items.length,matchedCount:items.length-missing.length,mismatchedCount:missing.length,accuracy:items.length?(items.length-missing.length)/items.length:1,missing:missing.map((x)=>x.value).slice(0,20)};}
function scoreUnsupportedClaims(input,generated){const allowed=new Set(extractClaims(JSON.stringify(input)));const claims=extractClaims(generated);const unsupported=claims.filter((claim)=>!allowed.has(claim));return {count:unsupported.length,claims:unsupported.slice(0,20)};}
function scoreAtomicBindings(input,generated){
  const evidenceCounts=claimCounts(JSON.stringify(input));
  const generatedCounts=claimCounts(generated);
  const repeated=[];
  for(const [claim,count] of generatedCounts)if(count>(evidenceCounts.get(claim)??0)&&/\d/.test(claim))repeated.push({claim,evidenceCount:evidenceCounts.get(claim)??0,generatedCount:count});
  return {violationCount:repeated.length,repeatedMeasurements:repeated.slice(0,20),rule:"voice_note_atomic_binding_v1"};
}
function claimCounts(value){const counts=new Map();for(const claim of extractClaimOccurrences(value))counts.set(claim,(counts.get(claim)??0)+1);return counts;}
function extractClaimOccurrences(value){const text=String(value??"").replace(/\b([A-Z]{1,4})\s*-\s*(\d)/g,"$1-$2");const matches=text.match(/\b[-+]?\d+(?:\.\d+)?\s*(?:mm|cm|m\b|in\.?|%|mpa|psi|years?)\b|\b[A-Z]{1,4}-\d+[A-Z0-9-]*\b/g)??[];return matches.map(canonicalClaim);}
function extractClaims(value){const text=String(value??"").replace(/\b([A-Z]{1,4})\s*-\s*(\d)/g,"$1-$2");const matches=text.match(/\b[-+]?\d+(?:\.\d+)?\s*(?:mm|cm|m\b|in\.?|%|mpa|psi|years?)\b|\b[A-Z]{1,4}-\d+[A-Z0-9-]*\b/g)??[];return [...new Set(matches.map(canonicalClaim))];}
function canonicalClaim(value){return normalized(value).replace(/\s+(?=(?:mm|cm|m\b|in\.?|%|mpa|psi|years?)\b)/g,"").replace(/[.,;:]+$/g,"");}
function selectFrozenArm(pair,arms){
  const selectedKey=pair.section_key==="inspection-maintenance-regime"?"evidence_recovery":"grounded";
  const arm=arms.find((item)=>item.arm_key===selectedKey);
  if(!arm)throw new Error(`Frozen contextual policy requires arm ${selectedKey} for ${pair.section_key}.`);
  return arm;
}
function tokenOverlap(a,b){const x=new Set(tokens(a)),y=new Set(tokens(b));if(!x.size||!y.size)return 0;let n=0;for(const token of x)if(y.has(token))n++;return n/Math.sqrt(x.size*y.size);}
function tokens(value){return normalized(value).split(/[^a-z0-9]+/).filter((x)=>x.length>2);}
function normalized(value){return String(value??"").toLowerCase().replace(/\s+/g," ").trim();}
function sha(value){return createHash("sha256").update(String(value)).digest("hex");}
function json(value,fallback){if(value==null)return fallback;if(typeof value!=="string")return value;try{return JSON.parse(value);}catch{return fallback;}}
function bounded(value){return Math.max(0,Math.min(1,Number(value)||0));}
function message(error){return error instanceof Error?error.message:String(error);}
