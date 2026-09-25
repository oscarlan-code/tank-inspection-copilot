import { createHash } from "node:crypto";
import { createS3ObjectStorage } from "../object-storage.mjs";
import { createReportStore } from "../store.mjs";
import { createPostgresDatabase } from "../storage/postgres.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const version=Number(process.env.TRUTH_GRAPH_VERSION??2);
if(!Number.isInteger(version)||version<2)throw new Error("TRUTH_GRAPH_VERSION must be at least 2.");
const limitValue=Number(process.env.TRUTH_GRAPH_REBUILD_LIMIT??0);
const db=await createPostgresDatabase({databaseUrl:process.env.DATABASE_URL});
const store=await createReportStore({databaseUrl:process.env.DATABASE_URL});
const objectStorage=createS3ObjectStorage();
try{
  const actor=await db.prepare(`SELECT user_id FROM platform_users WHERE account_status='active' ORDER BY (lower(role_label)='super admin') DESC,created_at_iso LIMIT 1`).get();
  if(!actor)throw new Error("An active platform user is required.");
  const sources=await db.prepare(
    `SELECT DISTINCT ON(tc.gold_document_id) tc.gold_document_id,tc.benchmark_track,tc.evidence_as_of,tc.asset_lineage_key
    FROM report_training_cases tc JOIN report_benchmark_snapshots s ON s.snapshot_id=tc.snapshot_id
    WHERE tc.status_code='case_approved' AND s.version_number<?
    ORDER BY tc.gold_document_id,s.version_number DESC`,
  ).all(version);
  const selected=limitValue>0?sources.slice(0,limitValue):sources;
  let completed=0,failed=0;
  const failures=[];
  for(const source of selected){
    try{
      let detail=await store.createTruthCaseFromApprovedSource({actorUserId:actor.user_id,documentId:source.gold_document_id,benchmarkTrack:source.benchmark_track,evidenceAsOf:source.evidence_as_of,assetLineageKey:source.asset_lineage_key,truthGraphVersion:version});
      const caseId=detail.truthCase.truthCaseId;
      if(detail.truthCase.status==='source_approved'||detail.truthCase.status==='truth_review_required'){
        if(detail.facts.length===0)detail=await store.proposeTruthFacts({actorUserId:actor.user_id,trainingCaseId:caseId});
        detail=await store.acceptAutomatedTruthDraft({actorUserId:actor.user_id,trainingCaseId:caseId});
      }
      if(detail.truthCase.status!=='case_approved'){
        const manifest=await store.buildTruthGraphManifest(caseId);
        const bytes=Buffer.from(`${JSON.stringify(manifest,null,2)}\n`,`utf8`);
        const objectKey=`training-harness/truth-graphs/v${version}/${caseId}/truth-graph.json`;
        const stored=await objectStorage.putBuffer({bytes,mediaType:"application/json",objectId:`truth-graph:${caseId}:v${version}`,objectKey});
        await store.approveTruthCase({actorUserId:actor.user_id,trainingCaseId:caseId,truthGraphObjectKey:objectKey,truthGraphSha256:stored.sha256??sha(bytes)});
      }
      completed+=1;
      if(completed%10===0)process.stdout.write(`${JSON.stringify({progress:{completed,failed,total:selected.length}})}\n`);
    }catch(error){failed+=1;failures.push({documentId:source.gold_document_id,error:error instanceof Error?error.message:String(error)});}
  }
  console.log(JSON.stringify({truthGraphVersion:version,attempted:selected.length,completed,failed,failures:failures.slice(0,50)},null,2));
  if(failed)process.exitCode=1;
}finally{await Promise.all([db.close(),store.close()]);}

function sha(value){return createHash("sha256").update(value).digest("hex");}
