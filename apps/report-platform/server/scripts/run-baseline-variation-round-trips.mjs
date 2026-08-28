import { materializeCaptureScenario } from "../capture-round-trip.mjs";
import { createS3ObjectStorage } from "../object-storage.mjs";
import { createPostgresDatabase } from "../storage/postgres.mjs";
import { createReportStore } from "../store.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const requestedLimit=Number(process.env.PILOT_ROUND_TRIP_LIMIT ?? 800);
const limit=Number.isInteger(requestedLimit)&&requestedLimit>0?requestedLimit:800;
const db=await createPostgresDatabase({databaseUrl:process.env.DATABASE_URL});
const store=await createReportStore({databaseUrl:process.env.DATABASE_URL});
const objectStorage=createS3ObjectStorage();
try {
  const actor=await db.prepare(
    `SELECT u.user_id,u.tenant_id,u.workspace_id,u.display_name,u.role_label,
      t.tenant_name,w.workspace_name
    FROM platform_users u
    JOIN tenants t ON t.tenant_id=u.tenant_id
    JOIN workspaces w ON w.workspace_id=u.workspace_id
    WHERE u.account_status='active'
    ORDER BY (lower(u.role_label)='super admin') DESC,u.created_at_iso
    LIMIT 1`,
  ).get();
  if(!actor) throw new Error("An active platform user is required for the app round trip.");
  const principal={
    userId:actor.user_id,tenantId:actor.tenant_id,tenantName:actor.tenant_name,
    workspaceId:actor.workspace_id,primaryWorkspaceId:actor.workspace_id,workspaceName:actor.workspace_name,
    displayName:actor.display_name,roleLabel:actor.role_label,platformRoles:[actor.role_label],
    workspaceMemberships:[{workspaceId:actor.workspace_id,workspaceName:actor.workspace_name,roles:[actor.role_label]}],
  };
  const rows=await db.prepare(
    `SELECT v.* FROM report_baseline_capture_variations v
    JOIN report_baseline_pilot_cohorts c ON c.cohort_id=v.cohort_id AND c.status_code='active'
    WHERE v.status_code IN ('scenario_ready','round_trip_ready')
    ORDER BY v.profile_version_id,v.match_group_number LIMIT ?`,
  ).all(limit);
  let completed=0;
  let failed=0;
  for(const row of rows){
    try{
      const scenario=json(row.manifest_json);
      const exportPackage=await materializeCaptureScenario({scenario,principal});
      const preservation=checkPreservation(scenario,exportPackage);
      if(!preservation.passed) throw new Error(`Evidence preservation failed: ${preservation.issues.join(" ")}`);
      const bytes=Buffer.from(`${JSON.stringify(exportPackage,null,2)}\n`,`utf8`);
      const objectKey=`training-harness/baseline-variations/matched-pilot-v2/${row.cohort_id}/${row.variation_id}/v3-product-export.json`;
      const stored=await objectStorage.putBuffer({bytes,mediaType:"application/json",objectId:`baseline-variation:${row.variation_id}:v3`,objectKey});
      const imported=await store.importAndroidV2ProductExport({
        exportPackage,actorUserId:actor.user_id,
        sourcePackageRef:{objectKey,byteSize:bytes.byteLength,sha256:stored.sha256,mediaType:"application/json"},
      });
      const now=new Date().toISOString();
      await db.prepare(
        `UPDATE report_baseline_capture_variations SET status_code='materialized',app_report_job_id=?,
          app_export_object_key=?,app_export_sha256=?,round_trip_completed_at_iso=?,
          validation_json=jsonb_set(validation_json,'{appRoundTrip}',?::jsonb,TRUE),updated_at_iso=?
        WHERE variation_id=?`,
      ).run(imported.reportJob.reportJobId,objectKey,stored.sha256,now,JSON.stringify({passed:true,adapter:"android_v3_headless_v1",preservation}),now,row.variation_id);
      completed+=1;
      if(completed%25===0) process.stdout.write(`${JSON.stringify({progress:{completed,failed,total:rows.length}})}\n`);
    }catch(error){
      failed+=1;
      const now=new Date().toISOString();
      await db.prepare(
        `UPDATE report_baseline_capture_variations SET status_code='quarantined',
          validation_json=jsonb_set(validation_json,'{appRoundTrip}',?::jsonb,TRUE),updated_at_iso=? WHERE variation_id=?`,
      ).run(JSON.stringify({passed:false,error:error instanceof Error?error.message:String(error)}),now,row.variation_id);
      process.stderr.write(`${row.variation_id}: ${error instanceof Error?error.message:String(error)}\n`);
    }
  }
  const status=await db.prepare(
    `SELECT v.status_code,COUNT(*)::int count FROM report_baseline_capture_variations v
    JOIN report_baseline_pilot_cohorts c ON c.cohort_id=v.cohort_id AND c.status_code='active'
    GROUP BY v.status_code ORDER BY v.status_code`,
  ).all();
  console.log(JSON.stringify({attempted:rows.length,completed,failed,status},null,2));
  if(failed) process.exitCode=1;
} finally { await Promise.all([db.close(),store.close()]); }

function checkPreservation(scenario,exportPackage){
  const exported=new Map((exportPackage.captureFacts??[]).map((fact)=>[fact.factId,fact]));
  const issues=[];
  for(const capture of scenario.captures??[]){const fact=exported.get(capture.factId);if(!fact)issues.push(`${capture.factId}: missing`);else if(JSON.stringify(fact.value)!==JSON.stringify(capture.value)||String(fact.unitCode??"")!==String(capture.unitCode??""))issues.push(`${capture.factId}: value or unit changed`);}
  const exportedIds=new Set(exported.keys());
  const leaked=(scenario.withheldFacts??[]).filter((fact)=>exportedIds.has(fact.factId));
  if(leaked.length)issues.push(`${leaked.length} withheld facts leaked`);
  for(const key of ["layoutTargets","layoutConfigs","layoutFigures","elements","inspectionChecklistItems","inspectionChecklistSectionNotes","attachments","structuredTables"]){
    if(JSON.stringify(exportPackage[key]??[])!==JSON.stringify(scenario.appRecords?.[key]??[]))issues.push(`${key}: app-owned records changed`);
  }
  const sourceUt=scenario.appRecords?.utMeasurements??[];
  if(JSON.stringify((exportPackage.utMeasurements??[]).slice(0,sourceUt.length))!==JSON.stringify(sourceUt))issues.push("utMeasurements: app-owned records changed");
  return {passed:issues.length===0,includedFactCount:(scenario.captures??[]).length,withheldLeakCount:leaked.length,issues:issues.slice(0,20)};
}
function json(value){return typeof value==="string"?JSON.parse(value):value;}
