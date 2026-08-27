import { createPostgresDatabase } from "../storage/postgres.mjs";
import { API_STANDARD_REPORT_TOC } from "../report-toc.mjs";
import { MATCHED_BASELINE_COHORT_VERSION } from "../matched-baseline-cohort.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const db=await createPostgresDatabase({databaseUrl:process.env.DATABASE_URL});
try {
  const active=await db.prepare(`SELECT cohort_id,target_group_count FROM report_baseline_pilot_cohorts WHERE status_code='active'`).all();
  if(active.length!==1) throw new Error(`Expected one active cohort; found ${active.length}.`);
  const cohort=active[0];
  const contract=await db.prepare(`SELECT matching_contract_json FROM report_baseline_pilot_cohorts WHERE cohort_id=?`).get(cohort.cohort_id);
  const evaluationGroups=Number(contract.matching_contract_json.evaluationGroupCount);
  const summary=await db.prepare(
    `SELECT COUNT(*)::int members,COUNT(DISTINCT match_group_number)::int groups,
      COUNT(*) FILTER (WHERE dataset_split='training')::int training,
      COUNT(*) FILTER (WHERE dataset_split='validation')::int validation,
      COUNT(*) FILTER (WHERE dataset_split='hidden_test')::int hidden_test
    FROM report_baseline_pilot_cohort_members WHERE cohort_id=?`,
  ).get(cohort.cohort_id);
  const invalid=await db.prepare(
    `SELECT COUNT(*)::int count FROM (
      SELECT match_group_number,COUNT(*) members,COUNT(DISTINCT dataset_split) splits,
        COUNT(DISTINCT report_family) families,COUNT(DISTINCT section_key) sections,
        COUNT(DISTINCT asset_lineage_key) lineages
      FROM report_baseline_pilot_cohort_members WHERE cohort_id=? GROUP BY 1
      HAVING (match_group_number<=? AND (COUNT(*)<>3 OR COUNT(DISTINCT dataset_split)<>3 OR COUNT(DISTINCT asset_lineage_key)<>3))
        OR (match_group_number>? AND (COUNT(*)<>1 OR MIN(dataset_split)<>'training'))
        OR COUNT(DISTINCT report_family)<>1 OR COUNT(DISTINCT section_key)<>1
    ) invalid_groups`,
  ).get(cohort.cohort_id,evaluationGroups,evaluationGroups);
  const crossSplit=await db.prepare(
    `SELECT COUNT(*)::int count FROM report_baseline_pilot_cohort_members m
      JOIN report_baseline_gold_pairs p ON p.baseline_pair_id=m.baseline_pair_id
      WHERE m.cohort_id=? AND (p.dataset_split<>m.dataset_split OR p.status_code<>'ready')`,
  ).get(cohort.cohort_id);
  const wrongContract=await db.prepare(
    `SELECT COUNT(*)::int count FROM report_baseline_pilot_cohort_members m
      JOIN report_baseline_gold_pairs p ON p.baseline_pair_id=m.baseline_pair_id
      WHERE m.cohort_id=? AND p.contract_version<>?`,
  ).get(cohort.cohort_id,MATCHED_BASELINE_COHORT_VERSION);
  const narrativeIds=new Set(API_STANDARD_REPORT_TOC.filter((item)=>item.kind==="narrative").map((item)=>item.id));
  const scopeRows=await db.prepare(`SELECT DISTINCT section_key FROM report_baseline_pilot_cohort_members WHERE cohort_id=?`).all(cohort.cohort_id);
  const outOfScopeSections=scopeRows.map((item)=>item.section_key).filter((sectionKey)=>!narrativeIds.has(sectionKey));
  const expected=Number(cohort.target_group_count);
  if(summary.groups!==expected||summary.members!==expected+evaluationGroups*2||summary.training!==expected||summary.validation!==evaluationGroups||summary.hidden_test!==evaluationGroups||invalid.count||crossSplit.count||wrongContract.count||outOfScopeSections.length){
    throw new Error(`Matched cohort audit failed: ${JSON.stringify({summary,invalid,crossSplit,wrongContract,outOfScopeSections})}`);
  }
  console.log(JSON.stringify({passed:true,cohortId:cohort.cohort_id,...summary,evaluationGroups,contractVersion:MATCHED_BASELINE_COHORT_VERSION,sectionScope:"canonical_narrative_context_only",sectionKeys:scopeRows.map((item)=>item.section_key),invalidGroups:invalid.count,crossSplitMembers:crossSplit.count,wrongContractMembers:wrongContract.count},null,2));
} finally { await db.close(); }
