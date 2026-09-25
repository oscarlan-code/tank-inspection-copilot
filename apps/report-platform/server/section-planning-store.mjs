import { randomUUID } from 'node:crypto';
import { buildSectionPlanningSnapshot, validateSectionDecision } from './section-planner.mjs';

export function createSectionPlanningStore({db,createError}) {
  const json=v=>typeof v==='string'?JSON.parse(v):v;
  async function planningForState(state) {
    const job=state.reportJob;
    const decisions=await db.prepare(`SELECT decision_json FROM report_section_classification_decisions WHERE report_job_id=? AND tenant_id=? AND workspace_id=? AND import_id=? ORDER BY created_at_iso,decision_id`).all(job.reportJobId,job.tenantId,job.workspaceId,job.sourceRevision.importId);
    return buildSectionPlanningSnapshot({exportPackage:state.exportPackage,manualInputs:state.manualSupplement??{},decisions:decisions.map(r=>json(r.decision_json)),scope:{tenantId:job.tenantId,workspaceId:job.workspaceId,reportJobId:job.reportJobId,importRevisionId:job.sourceRevision.importId,manualInputsRevision:job.manualInputsRevision}});
  }
  async function persist(state,snapshot) {
    const job=state.reportJob;
    await db.prepare(`INSERT INTO report_section_plan_snapshots(snapshot_id,report_job_id,tenant_id,workspace_id,import_id,manual_inputs_revision,contract_version,input_package_hash,snapshot_json) VALUES(?,?,?,?,?,?,?,?,?::jsonb) ON CONFLICT(snapshot_id) DO NOTHING`).run(snapshot.snapshotId,job.reportJobId,job.tenantId,job.workspaceId,job.sourceRevision.importId,job.manualInputsRevision,snapshot.contractVersion,snapshot.inputPackageHash,JSON.stringify(snapshot));
    // Evaluation snapshots are review artifacts, not production report state.
    if (state.evaluationContext?.mode === 'outline_evaluation') return snapshot;
    const updated=await db.prepare('UPDATE report_jobs SET section_plan_snapshot_id=? WHERE report_job_id=? AND import_id=? AND manual_inputs_revision=?').run(snapshot.snapshotId,job.reportJobId,job.sourceRevision.importId,job.manualInputsRevision);
    if(updated.rowCount!==1) throw createError(409,'Evidence changed while classifying. Reload and retry.','section_plan_conflict');
    return snapshot;
  }
  async function classify(state) {
    const jobId=randomUUID();await db.prepare("INSERT INTO report_section_planning_jobs(job_id,report_job_id,import_id,status_code) VALUES(?,?,?,'queued')").run(jobId,state.reportJob.reportJobId,state.reportJob.sourceRevision.importId);
    try {
      await db.prepare("UPDATE report_section_planning_jobs SET status_code='running',updated_at_iso=now() WHERE job_id=?").run(jobId);
      const snapshot=await persist(state,await planningForState(state));
      await db.prepare("UPDATE report_section_planning_jobs SET status_code='completed',snapshot_id=?,updated_at_iso=now() WHERE job_id=?").run(snapshot.snapshotId,jobId);
      return snapshot;
    }catch(error){await db.prepare("UPDATE report_section_planning_jobs SET status_code='failed',error_message=?,updated_at_iso=now() WHERE job_id=?").run(String(error.message).slice(0,1000),jobId);throw error;}
  }
  async function decide(state,{actorUserId,expectedSnapshotId,decision}) {
    // Omitted operations are supported only while replaying persisted legacy
    // events. Fresh requests must use the strict per-destination contract.
    if(decision?.kind!=='section_scope'&&!['add','update','remove'].includes(decision?.operation))throw createError(400,'New evidence decisions require an explicit add, update or remove operation.','section_decision_invalid');
    const current=await planningForState(state);
    if(expectedSnapshotId!==current.snapshotId)throw createError(409,'Evidence or classification changed. Reload before saving your decision.','section_plan_conflict');
    let validation;try { validation=validateSectionDecision(current,decision); } catch(error) { throw createError(400,error.message,'section_decision_invalid'); }
    if(validation===false||validation?.valid===false)throw createError(400,validation?.issues?.join(' ')||'Invalid classification decision.','section_decision_invalid');
    const job=state.reportJob;
    const reviewed={...validation,decisionId:randomUUID(),actorId:actorUserId,createdAtIso:new Date().toISOString()};
    await db.prepare(`INSERT INTO report_section_classification_decisions(decision_id,report_job_id,tenant_id,workspace_id,import_id,actor_user_id,evidence_id,decision_json) VALUES(?,?,?,?,?,?,?,?::jsonb)`).run(reviewed.decisionId,job.reportJobId,job.tenantId,job.workspaceId,job.sourceRevision.importId,actorUserId,decision.evidenceId ?? `section:${decision.sectionId}`,JSON.stringify(reviewed));
    return persist(state,await planningForState(state));
  }
  return {planningForState,persist,classify,decide};
}
