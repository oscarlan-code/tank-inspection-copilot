import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPostgresDatabase } from "../storage/postgres.mjs";
import { createReportStore } from "../store.mjs";
import { extractSourceSectionReference } from "../source-section-reference.mjs";
import { CAPTURE_EVALUATION_CONTRACT } from "../capture-evaluation.mjs";
import { GOVERNED_GENERATOR_CONTRACT_VERSION } from "../governed-generation-contract.mjs";

const [evaluationCaseId, sectionId, sourcePath] = process.argv.slice(2);
if (!evaluationCaseId || !sectionId || !sourcePath || !process.env.DATABASE_URL) {
  throw new Error("Usage: node --env-file=.env server/scripts/rerun-source-reviewed-evaluation.mjs <case-id> <section-id> <original-pdf>");
}
const pdfPath = resolve(sourcePath);
const db = await createPostgresDatabase({ databaseUrl: process.env.DATABASE_URL });
const store = await createReportStore({ databaseUrl: process.env.DATABASE_URL });
try {
  const row = await db.prepare(`SELECT c.*, d.source_sha256, r.report_job_id
    FROM report_evaluation_cases c JOIN kb_documents d ON d.document_id=c.gold_document_id
    JOIN report_jobs r ON r.inspection_id=c.input_inspection_id AND r.tenant_id=c.tenant_id AND r.workspace_id=c.workspace_id
    WHERE c.evaluation_case_id=?`).get(evaluationCaseId);
  if (!row) throw new Error("Evaluation case and its scoped report job were not found.");
  const sourceSha256 = createHash("sha256").update(await readFile(pdfPath)).digest("hex");
  if (!row.source_sha256 || row.source_sha256 !== sourceSha256) throw new Error("PDF checksum does not match the immutable evaluation source.");
  const actor = await db.prepare("SELECT user_id FROM platform_users WHERE lower(role_label)='super admin' AND account_status='active' ORDER BY user_id LIMIT 1").get();
  if (!actor) throw new Error("An active Super Admin is required.");
  const before = await productionPolicies();
  const oldRun = await db.prepare("SELECT eval_run_id,eval_json FROM report_eval_runs WHERE evaluation_case_id=? AND section_id=? ORDER BY created_at_iso DESC LIMIT 1").get(evaluationCaseId, sectionId);
  console.log(JSON.stringify({ evaluationCaseId, sectionId, previousEvalRunId:oldRun?.eval_run_id, generationContract:GOVERNED_GENERATOR_CONTRACT_VERSION, learning:false, sourceVerified:true }));
  const result = await store.runSystemRlEvaluation({
    actorUserId: actor.user_id, reportJobId:row.report_job_id, evaluationCaseId, sectionId,
    frozenCandidate:true, updateLearning:false,
    experimentContract:`source_review:${CAPTURE_EVALUATION_CONTRACT}`,
    loadEvaluationReference: async () => {
      // The store invokes this only after generation. No original PDF text or
      // withheld answer may influence evidence routing, prompting or formatting.
      const { sourcePath: ignoredPath, ...reference } = await extractSourceSectionReference({pdfPath, sectionId});
      if (reference.sourceSha256 !== sourceSha256) throw new Error("Source changed during evaluation.");
      return { ...reference, replacesEvalRunId:oldRun?.eval_run_id ?? null };
    },
  });
  if (JSON.stringify(before) !== JSON.stringify(await productionPolicies())) throw new Error("Production policy changed during evaluation; investigate concurrent operations.");
  if (oldRun) {
    const retained = await db.prepare("SELECT eval_json FROM report_eval_runs WHERE eval_run_id=?").get(oldRun.eval_run_id);
    if (JSON.stringify(retained?.eval_json) !== JSON.stringify(oldRun.eval_json)) throw new Error("Previous evaluation was unexpectedly modified.");
  }
  const evaluation = result.evalRun;
  const reviewUrl = `http://localhost:4174/admin/evaluation?${new URLSearchParams({evaluationCaseId,sectionId,evalRunId:evaluation.evalRunId})}`;
  console.log(JSON.stringify({ evalRunId:evaluation.evalRunId, reviewUrl, outcome:evaluation.outcomeCode,
    generationContract:evaluation.generatorContractVersion, truth:evaluation.truthGraphEvaluation,
    evidence:evaluation.evidenceSectionEvaluation, historical:evaluation.semanticSectionEvaluation,
    sourcePages:evaluation.referenceRevision?.pageNumbers, productionUnchanged:true, oldResultPreserved:true }, null, 2));
} finally { await store.close(); await db.close(); }

async function productionPolicies() {
  return db.prepare("SELECT policy_version_id,status_code,promoted_at_iso FROM system_rl_policy_versions WHERE status_code='production' ORDER BY policy_version_id").all();
}
