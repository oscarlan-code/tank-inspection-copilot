import { createHash } from "node:crypto";
import { createPostgresDatabase } from "../storage/postgres.mjs";
import { API_STANDARD_REPORT_TOC } from "../report-toc.mjs";
import { buildEntityBoundEvidence, extractStructuredAppFieldsAndLists, extractStructuredAppTables, removeStructuredTableLines, validateEntityBoundEvidence } from "../evidence-entity-binding.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const taxonomyVersionId="report_taxonomy_content_v1";
const contractVersion=Number(process.env.GOVERNED_PAIR_CONTRACT_VERSION??3);
const narrativeSections=new Set(API_STANDARD_REPORT_TOC.filter((item)=>item.kind==="narrative").map((item)=>item.id));
const db=await createPostgresDatabase({databaseUrl:process.env.DATABASE_URL});
const nowIso=new Date().toISOString();
let ready=0,quarantined=0;
try{
  const reports=await db.prepare(
    `SELECT DISTINCT ON(r.corpus_report_id) r.*,d.document_id
     FROM report_corpus_registry r JOIN kb_documents d ON d.source_sha256=r.binary_sha256
     WHERE r.taxonomy_version_id=? AND r.eligibility_role IN ('training_reference','validation_gold')
     ORDER BY r.corpus_report_id,(d.document_id LIKE 'governed_%') DESC,d.approval_status='approved' DESC,d.created_at_iso DESC`,
  ).all(taxonomyVersionId);
  await db.transaction(async()=>{
    await db.prepare("DELETE FROM report_governed_baseline_pairs WHERE contract_version=?").run(contractVersion);
    await db.prepare("DELETE FROM report_governed_gold_sections WHERE taxonomy_version_id=? AND gold_contract_version=?").run(taxonomyVersionId,contractVersion);
    for(const report of reports){
      const chunks=await db.prepare(
        `SELECT chunk_id,section_type,content,page_numbers_json,source_block_ids_json,stable_order
         FROM kb_chunks WHERE document_id=? ORDER BY stable_order`,
      ).all(report.document_id);
      for(const sectionKey of narrativeSections){
        const sectionChunks=chunks.filter((item)=>item.section_type===sectionKey);
        if(!sectionChunks.length)continue;
        const targetContent=normalizeGoldContent(sectionChunks.map((item)=>String(item.content??"").trim()).filter(Boolean).join("\n\n"));
        const structuredTables=extractStructuredAppTables({report,sectionKey,content:targetContent});
        const structured=contractVersion>=10?extractStructuredAppFieldsAndLists({report,sectionKey,content:removeStructuredTableLines(targetContent)}):{labelledFields:[],structuredLists:[],remainingContent:removeStructuredTableLines(targetContent)};
        const sentences=materialSentences(structured.remainingContent);
        const included=[],hidden=[];
        if(contractVersion>=5){
          const targetCount=Math.max(1,Math.min(sentences.length-1,Math.ceil(sentences.length*0.78)));
          const ranked=sentences.map((sentence,index)=>({sentence,index,concept:materialConcept(sentence),rank:sha(`${report.corpus_report_id}:${sectionKey}:${index}:${sentence}`)}));
          const selected=new Set();
          for(const concept of ["measurement","finding","conclusion","recommendation","scope","qualification","identity"]){
            const candidate=ranked.filter((item)=>item.concept===concept).sort((a,b)=>a.rank.localeCompare(b.rank))[0];
            if(candidate){selected.add(candidate.index);if(contractVersion>=6){if(candidate.index>0)selected.add(candidate.index-1);if(candidate.index<sentences.length-1)selected.add(candidate.index+1);}}
          }
          for(const item of [...ranked].sort((a,b)=>a.rank.localeCompare(b.rank)))if(selected.size<targetCount)selected.add(item.index);
          for(const item of ranked)(selected.has(item.index)?included:hidden).push(item.sentence);
        }else{
          for(const [index,sentence] of sentences.entries()){
            const completenessBase=contractVersion>=4?70:35;
            const completenessRange=contractVersion>=4?16:21;
            const completeness=completenessBase+(Number.parseInt(sha(`${report.corpus_report_id}:${sectionKey}:completeness`).slice(0,8),16)%completenessRange);
            const bucket=Number.parseInt(sha(`${report.corpus_report_id}:${sectionKey}:${index}:${sentence}`).slice(0,8),16)%100;
            (bucket<completeness?included:hidden).push(sentence);
          }
        }
        if(!included.length&&sentences.length){
          const fallback=hidden.shift()??sentences[0];
          included.push(fallback);
        }
        // A section with only one material sentence cannot be sampled at sentence
        // granularity without copying the complete answer into the query. Preserve
        // a deterministic leading fragment as evidence and keep the remainder
        // hidden instead.
        if(hidden.length===0&&included.length===1){
          const words=included[0].split(/\s+/);
          const cut=Math.max(1,Math.floor(words.length*0.65));
          included[0]=words.slice(0,cut).join(" ");
          hidden.push(words.slice(cut).join(" "));
        }else if(hidden.length===0&&included.length>1){
          hidden.push(included.pop());
        }
        const answerability=contractVersion>=7
          ? enforceMockAnswerability({sectionKey,targetContent,included,hidden})
          : {qaPassed:true,requiredFacts:[],restoredFacts:[],unresolvedDependencies:[],rulesApplied:[]};
        const goldId=stableId("governed-gold",report.corpus_report_id,sectionKey,contractVersion);
        const pairId=stableId("governed-pair",report.corpus_report_id,sectionKey,contractVersion);
        const issues=[];
        if(targetContent.length<120)issues.push("gold_target_fragmentary");
        if(included.length===0&&structuredTables.length===0)issues.push("no_material_app_capture");
        if(hidden.every((item)=>!String(item).trim())&&structuredTables.length===0)issues.push("gold_target_not_partitionable");
        if(!answerability.qaPassed)issues.push("mock_input_not_answerable");
        const entityBoundEvidence=buildEntityBoundEvidence({report,sectionKey,transcripts:included});
        for(const table of structuredTables){
          for(const row of table.rows){
            entityBoundEvidence.entities.push({entityId:row.entityId,assetLineageKey:report.asset_lineage_key,
              reportReference:report.report_reference,sectionKey,entityType:"structured_table_row",entityKey:row.itemKey,
              entityLabel:row.itemKey,aliases:[]});
            const rowText=row.cells.map((cell)=>cell.value).join(" | ");
            entityBoundEvidence.observations.push({observationId:stableId("table-observation",row.entityId),entityId:row.entityId,
              sectionKey,entityMetadata:{assetLineageKey:report.asset_lineage_key,reportReference:report.report_reference,
                sectionKey,entityType:"structured_table_row",entityKey:row.itemKey,entityLabel:row.itemKey},
              fieldData:{tableId:table.tableId,itemKey:row.itemKey,cells:row.cells},boundClaims:{measurements:extractMeasurementClaims(rowText)},
              evidenceRefs:[{sourceType:"android_structured_table",sourceId:table.tableId}]});
          }
        }
        const mockInput={packageType:"laiq_section_generation_query",schemaVersion:contractVersion,
          identity:{corpusReportId:report.corpus_report_id,reportReference:report.report_reference,
            assetLineageKey:report.asset_lineage_key,datasetSplit:report.dataset_split,sectionKey},
          reportProfile:report.profile_json,task:"Generate the complete report section from structured identity and entity-bound labelled voice notes.",
          structuredFields:{reportReference:report.report_reference,sectionKey,coreFamily:report.core_family,
            inspectionScope:report.profile_json.primaryInspectionScope,lifecycle:report.profile_json.lifecycle},
          appRecords:{structuredTables,labelledFields:structured.labelledFields,structuredLists:structured.structuredLists},
          ...entityBoundEvidence};
        const entityBinding=validateEntityBoundEvidence(mockInput);
        if(!entityBinding.valid)issues.push(...entityBinding.issues);
        const status=issues.length?"quarantined":"ready";
        const provenance={documentId:report.document_id,corpusReportId:report.corpus_report_id,
          assetLineageKey:report.asset_lineage_key,chunkIds:sectionChunks.map((item)=>item.chunk_id),
          pageNumbers:unique(sectionChunks.flatMap((item)=>json(item.page_numbers_json,[]))),
          sourceBlockIds:unique(sectionChunks.flatMap((item)=>json(item.source_block_ids_json,[])))};
        await db.prepare(
          `INSERT INTO report_governed_gold_sections (
            governed_gold_section_id,taxonomy_version_id,corpus_report_id,document_id,section_key,dataset_split,
            target_content,target_sha256,provenance_json,status_code,created_at_iso,updated_at_iso,gold_contract_version
           ) VALUES (?,?,?,?,?,?,?,?,?::jsonb,?,?,?,?)`,
        ).run(goldId,taxonomyVersionId,report.corpus_report_id,report.document_id,sectionKey,report.dataset_split,
          targetContent,sha(targetContent),JSON.stringify(provenance),status,nowIso,nowIso,contractVersion);
        const protectedInvariants=[];
        const inputJson=JSON.stringify(mockInput);
        const validation={aligned:status==="ready",issues,deterministic:true,variationApplied:false,
          taskType:"section_query_answer",evaluationMode:"evidence_conditioned_semantic",
          goldCharacterCount:targetContent.length,inputSentenceCount:included.length,hiddenSentenceCount:hidden.length,structuredTableCount:structuredTables.length,labelledFieldCount:structured.labelledFields.length,structuredListCount:structured.structuredLists.length,
          evidenceCompletenessTarget:contractVersion>=6?"material_concept_context_blocks":contractVersion>=5?"material_concept_balanced_78":contractVersion>=4?"voice_rich_70_85":"partial_35_55",
          answerability,entityBinding,protectedFactSource:"entity_bound_structured_fields_and_voice",sourceReportRetrievalForbidden:true,sourceLineageRetrievalForbidden:true};
        await db.prepare(
          `INSERT INTO report_governed_baseline_pairs (
            governed_pair_id,governed_gold_section_id,corpus_report_id,section_key,dataset_split,contract_version,
            mock_input_json,hidden_content_json,protected_invariants_json,validation_json,input_sha256,status_code,
            created_at_iso,updated_at_iso
           ) VALUES (?,?,?,?,?,?,?::jsonb,?::jsonb,?::jsonb,?::jsonb,?,?,?,?)`,
        ).run(pairId,goldId,report.corpus_report_id,sectionKey,report.dataset_split,contractVersion,inputJson,
          JSON.stringify(hidden),JSON.stringify(protectedInvariants),JSON.stringify(validation),sha(inputJson),status,nowIso,nowIso);
        if(status==="ready")ready+=1;else quarantined+=1;
      }
    }
  });
  console.log(JSON.stringify({reports:reports.length,ready,quarantined,contractVersion,sectionScope:[...narrativeSections]},null,2));
}finally{await db.close();}

function materialSentences(text){return unique(String(text??"").replace(/\\n/g,"\n").split(/\n+|(?<=[.!?;:])\s+(?=[A-Z0-9(])/)
  .map((item)=>item.replace(/\s+/g," ").trim()).filter((item)=>item.length>=15&&!/^(?:contents|page|client|tank no\.?|job no\.?|\d+(?:\.\d+)*\s+[A-Z /&-]+)\s*:?$/i.test(item)));}
function normalizeGoldContent(value){return String(value??"")
  .replace(/\\n/g,"\n").replace(/\bhead\d+(?:left|right|center)\b/gi,"")
  .replace(/&quot;|&#34;/gi,'"').replace(/\uFFFD/g,"")
  .replace(/\brelusts\b/gi,"results")
  .split(/\r?\n/).map((line)=>line.replace(/[ \t]+/g," ").trim())
  .filter((line)=>line&&!/^(?:page|client|job no\.?|tank no\.?)\s*:\s*$/i.test(line))
  .join("\n").replace(/\n{3,}/g,"\n\n").trim();}
function materialConcept(value){const text=String(value??"");if(/\b(?:mm|cm|metres?|meters?|inches?|\bin\.|%|mpa|psi|thickness|reading|measured|diameter|height|depth|tolerance|limit)\b/i.test(text))return "measurement";if(/\b(?:observed|found|identified|corrosion|pitting|crack|defect|damage|leak|bulge|settlement|deformation|condition)\b/i.test(text))return "finding";if(/\b(?:therefore|conclude|conclusion|assessment|acceptable|unacceptable|compliant|exceeded|remaining life|fitness)\b/i.test(text))return "conclusion";if(/\b(?:recommend|shall|should|repair|replace|monitor|reinspect|action|required)\b/i.test(text))return "recommendation";if(/\b(?:scope|inspect|inspection|examination|survey|testing|tested)\b/i.test(text))return "scope";if(/\b(?:however|unless|subject to|pending|provided that|where applicable|if required|may be)\b/i.test(text))return "qualification";if(/^(?:client|job|report|tank|item|date)\s*(?:no\.?|reference)?\s*:/i.test(text)||/\b(?:client|owner|operator|inspector|contractor)\b/i.test(text))return "identity";return "other";}
function enforceMockAnswerability({sectionKey,targetContent,included,hidden}){
  const methodRules=[
    {key:"mpi",indicator:/\b(?:MPI|magnetic particles?|magnetic particle inspection)\b/i,dependent:/\b(?:IRS-TM-002|CRACKTest|permanent magnet|API\s*653\s*Annex\s*F\.3\.3)\b/i},
    {key:"mfl",indicator:/\b(?:MFL|magnetic flux leakage|Truflux)\b/i,dependent:/\b(?:MFL mapping|flux leakage|underside defects?)\b/i},
    {key:"vacuum_box",indicator:/\bvacuum box\b/i,dependent:/\b(?:vacuum testing|test pressure|soap solution)\b/i},
    {key:"ultrasonic",indicator:/\b(?:ultrasonic|UT\b|UTM\b)\b/i,dependent:/\b(?:B-scan|A-scan|thickness meter)\b/i},
    {key:"profile_3d",indicator:/\b(?:3D scan|laser scan|profile assessment)\b/i,dependent:/\b(?:point cloud|scanner profile)\b/i},
  ];
  const requiredFacts=[],restoredFacts=[],unresolvedDependencies=[],rulesApplied=[];
  const inputText=included.join("\n");
  for(const rule of methodRules){
    if(!rule.dependent.test(inputText)||rule.indicator.test(inputText))continue;
    rulesApplied.push(`required_method_discriminator:${rule.key}`);
    const candidateIndex=hidden.findIndex((item)=>rule.indicator.test(item));
    requiredFacts.push({type:"inspection_method",key:rule.key,reason:"dependent_method_fields_retained"});
    if(candidateIndex>=0){
      const [restored]=hidden.splice(candidateIndex,1);
      included.push(restored);
      restoredFacts.push({type:"inspection_method",key:rule.key,source:"original_section_qa",value:restored});
    }else unresolvedDependencies.push({type:"inspection_method",key:rule.key,reason:"dependent_fields_have_no_explicit_method_discriminator"});
  }
  return {qaPassed:unresolvedDependencies.length===0,sectionKey,originalReferenceUsedForQa:true,originalReferenceAvailableToGenerator:false,
    requiredFacts,restoredFacts,unresolvedDependencies,rulesApplied};
}
function stableId(...values){return `${values[0]}_${sha(values.join(":" )).slice(0,24)}`;}
function sha(value){return createHash("sha256").update(value).digest("hex");}
function unique(values){return [...new Set(values)];}
function extractMeasurementClaims(value){return unique((String(value??"").match(/\b[-+]?\d+(?:\.\d+)?\s*(?:mm|cm|m\b|in\.?|%|mpa|psi|years?)\b/gi)??[]).map((item)=>item.toLowerCase().replace(/\s+/g,"")));}
function json(value,fallback){if(value==null)return fallback;if(typeof value!=="string")return value;try{return JSON.parse(value);}catch{return fallback;}}
