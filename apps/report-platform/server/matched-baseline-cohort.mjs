import { createHash } from "node:crypto";
import { API_STANDARD_REPORT_TOC } from "./report-toc.mjs";

export const MATCHED_BASELINE_COHORT_VERSION = 11;
const SPLITS = ["training", "validation", "hidden_test"];

export function createMatchedBaselineCohortService({ db }) {
  return { build, getStatus };

  async function build({ groupCount = 100, evaluationGroupCount = 20, seed = 1, sectionIds = [] } = {}) {
    if (evaluationGroupCount < 1 || evaluationGroupCount > groupCount) throw new Error("evaluationGroupCount must be between 1 and groupCount.");
    const candidates = await db.prepare(
      `SELECT p.baseline_pair_id,p.training_case_id,p.dataset_split,p.section_key,
        p.deterministic_input_json,p.protected_invariants_json,g.normalized_facts_json,
        g.target_content,c.report_family,COALESCE(c.asset_lineage_key,c.gold_document_id,c.training_case_id) AS asset_lineage_key
      FROM report_baseline_gold_pairs p
      JOIN report_standardized_gold_sections g ON g.gold_section_id=p.gold_section_id
      JOIN report_training_cases c ON c.training_case_id=p.training_case_id
      WHERE p.status_code='ready' AND p.contract_version=? AND c.truth_graph_version=?
      ORDER BY c.report_family,p.section_key,p.dataset_split,p.baseline_pair_id`,
    ).all(MATCHED_BASELINE_COHORT_VERSION,3);
    const contextSectionIds=new Set(API_STANDARD_REPORT_TOC.filter((item)=>item.kind==="narrative").map((item)=>item.id));
    const requestedSections=new Set(sectionIds.map(String).filter(Boolean));
    const executableCandidates=candidates.filter((row)=>contextSectionIds.has(row.section_key)
      && (requestedSections.size===0||requestedSections.has(row.section_key)));
    const strata = buildCommonStrata(executableCandidates, seed);
    const matchedGroups = balancedMatchedTriples(strata, evaluationGroupCount, seed);
    if (matchedGroups.length < evaluationGroupCount) {
      throw new Error(`Only ${matchedGroups.length} lineage-isolated context triples are available for ${evaluationGroupCount} requested evaluation groups.`);
    }
    const usedTrainingIds=new Set(matchedGroups.map((group)=>group.members.training.baseline_pair_id));
    const extraTraining=balancedTrainingSample(executableCandidates.filter((row)=>row.dataset_split==="training"&&!usedTrainingIds.has(row.baseline_pair_id)),groupCount-evaluationGroupCount,seed);
    if(extraTraining.length!==groupCount-evaluationGroupCount)throw new Error("Not enough executable training baselines for the requested pilot.");
    const groups=[...matchedGroups,...extraTraining.map((training,index)=>({number:evaluationGroupCount+index+1,distance:0,members:{training}}))];
    const memberIds = groups.flatMap((group,index) => (index < evaluationGroupCount ? SPLITS : ["training"]).map((split) => group.members[split].baseline_pair_id));
    const cohortId = `baseline-cohort-${hash(`${MATCHED_BASELINE_COHORT_VERSION}:${seed}:${groupCount}:${evaluationGroupCount}:${memberIds.join(":")}`).slice(0,32)}`;
    const now = new Date().toISOString();
    const contract = {
      schemaVersion: MATCHED_BASELINE_COHORT_VERSION,
      matchingKeys: ["report_family", "section_key"],
      sectionScope: "canonical_narrative_context_only",
      excludedContent: ["maps", "layouts", "platemaps", "photographs", "attachments", "checklists", "measurement_tables"],
      secondaryFeatures: ["fact_count", "capture_count", "protected_fact_count", "target_char_count", "capture_channel_mix"],
      lineageIsolationRequired: true,
      goldTargetsExcludedFromGeneration: true,
      groupCount,
      evaluationGroupCount,
      seed,
      sectionIds:[...requestedSections],
    };
    await db.transaction(async () => {
      await db.prepare(`UPDATE report_baseline_pilot_cohorts SET status_code='superseded',updated_at_iso=? WHERE status_code='active' AND cohort_id<>?`).run(now,cohortId);
      await db.prepare(
        `INSERT INTO report_baseline_pilot_cohorts (
          cohort_id,cohort_version,deterministic_seed,target_group_count,status_code,
          matching_contract_json,created_at_iso,updated_at_iso
        ) VALUES (?,?,?,?,'active',?::jsonb,?,?)
        ON CONFLICT (cohort_id) DO UPDATE SET status_code='active',matching_contract_json=excluded.matching_contract_json,updated_at_iso=excluded.updated_at_iso`,
      ).run(cohortId,MATCHED_BASELINE_COHORT_VERSION,seed,groupCount,JSON.stringify(contract),now,now);
      for (const [groupIndex,group] of groups.entries()) {
        const includedSplits=groupIndex < evaluationGroupCount ? SPLITS : ["training"];
        for (const split of includedSplits) {
          const member = group.members[split];
          await db.prepare(
            `INSERT INTO report_baseline_pilot_cohort_members (
              cohort_id,match_group_number,dataset_split,baseline_pair_id,report_family,
              section_key,asset_lineage_key,feature_json,match_distance,created_at_iso
            ) VALUES (?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT (cohort_id,match_group_number,dataset_split) DO UPDATE SET
              baseline_pair_id=excluded.baseline_pair_id,report_family=excluded.report_family,
              section_key=excluded.section_key,asset_lineage_key=excluded.asset_lineage_key,
              feature_json=excluded.feature_json,match_distance=excluded.match_distance`,
          ).run(cohortId,group.number,split,member.baseline_pair_id,member.report_family,
            member.section_key,member.asset_lineage_key,JSON.stringify(features(member)),group.distance,now);
        }
      }
    });
    return summarize(cohortId, groups, evaluationGroupCount, strata.length);
  }

  async function getStatus() {
    return db.prepare(
      `SELECT c.cohort_id,c.status_code,c.target_group_count,m.dataset_split,
        COUNT(*)::int AS member_count,COUNT(DISTINCT m.asset_lineage_key)::int AS report_lineages
      FROM report_baseline_pilot_cohorts c
      JOIN report_baseline_pilot_cohort_members m ON m.cohort_id=c.cohort_id
      GROUP BY 1,2,3,4 ORDER BY c.status_code,m.dataset_split`,
    ).all();
  }
}

function buildCommonStrata(rows, seed) {
  const map = new Map();
  for (const row of rows) {
    const key = `${row.report_family}||${row.section_key}`;
    const stratum = map.get(key) ?? { key, reportFamily: row.report_family, sectionKey: row.section_key, splits: {} };
    (stratum.splits[row.dataset_split] ??= []).push(row);
    map.set(key,stratum);
  }
  return [...map.values()].filter((stratum) => SPLITS.every((split) => stratum.splits[split]?.length))
    .sort((a,b) => hash(`${seed}:${a.key}`).localeCompare(hash(`${seed}:${b.key}`)));
}

function balancedStrata(strata, limit) {
  const families = new Map();
  for (const stratum of strata) (families.get(stratum.reportFamily) ?? (families.set(stratum.reportFamily,[]),families.get(stratum.reportFamily))).push(stratum);
  const queues=[...families.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,items])=>items);
  const result=[];
  while(result.length<Math.min(limit,strata.length) && queues.length){
    for(let index=queues.length-1;index>=0 && result.length<limit;index--){
      result.push(queues[index].shift());
      if(!queues[index].length) queues.splice(index,1);
    }
  }
  return result;
}

function balancedMatchedTriples(strata, limit, seed) {
  const queues = strata.map((stratum) => ({
    ...stratum,
    splits: Object.fromEntries(SPLITS.map((split) => [split, [...stratum.splits[split]]])),
  })).sort((left, right) => hash(`${seed}:${left.key}`).localeCompare(hash(`${seed}:${right.key}`)));
  const result = [];
  while (result.length < limit && queues.length > 0) {
    let added = false;
    for (let index = queues.length - 1; index >= 0 && result.length < limit; index -= 1) {
      const stratum = queues[index];
      let triple = null;
      try { triple = selectClosestTriple(stratum, result.length + 1, seed); } catch { triple = null; }
      if (!triple) { queues.splice(index, 1); continue; }
      result.push(triple);
      added = true;
      for (const split of SPLITS) {
        const selectedId = triple.members[split].baseline_pair_id;
        stratum.splits[split] = stratum.splits[split].filter((item) => item.baseline_pair_id !== selectedId);
      }
      if (SPLITS.some((split) => stratum.splits[split].length === 0)) queues.splice(index, 1);
    }
    if (!added) break;
  }
  return result.map((group, index) => ({ ...group, number: index + 1 }));
}

function balancedTrainingSample(rows,limit,seed){
  const groups=new Map();
  for(const row of rows){const key=`${row.report_family}||${row.section_key}`;(groups.get(key)??(groups.set(key,[]),groups.get(key))).push(row);}
  const queues=[...groups.entries()].sort(([a],[b])=>hash(`${seed}:${a}`).localeCompare(hash(`${seed}:${b}`))).map(([,items])=>items.sort((a,b)=>hash(`${seed}:${a.baseline_pair_id}`).localeCompare(hash(`${seed}:${b.baseline_pair_id}`))));
  const result=[];while(result.length<limit&&queues.length){for(let i=queues.length-1;i>=0&&result.length<limit;i--){result.push(queues[i].shift());if(!queues[i].length)queues.splice(i,1);}}return result;
}

function selectClosestTriple(stratum, number, seed) {
  let best;
  for (const training of stratum.splits.training) for (const validation of stratum.splits.validation) for (const hidden of stratum.splits.hidden_test) {
    if (new Set([training.asset_lineage_key,validation.asset_lineage_key,hidden.asset_lineage_key]).size !== 3) continue;
    const distance = featureDistance(training,validation)+featureDistance(training,hidden)+featureDistance(validation,hidden);
    const tie = hash(`${seed}:${training.baseline_pair_id}:${validation.baseline_pair_id}:${hidden.baseline_pair_id}`);
    if (!best || distance < best.distance || (distance === best.distance && tie < best.tie)) {
      best={ number, distance, tie, members:{ training,validation,hidden_test:hidden } };
    }
  }
  if (!best) throw new Error(`No lineage-isolated triple exists for ${stratum.key}.`);
  return best;
}

function features(row) {
  const facts=parseJson(row.normalized_facts_json,[]);
  const captures=parseJson(row.deterministic_input_json,{}).captures ?? [];
  const channels={}; for(const capture of captures) channels[capture.captureChannel]=(channels[capture.captureChannel]??0)+1;
  return { factCount:facts.length,captureCount:captures.length,protectedFactCount:parseJson(row.protected_invariants_json,[]).length,targetCharCount:String(row.target_content??"").length,captureChannels:channels };
}
function featureDistance(a,b){const x=features(a),y=features(b);return relative(x.factCount,y.factCount)+relative(x.captureCount,y.captureCount)+relative(x.protectedFactCount,y.protectedFactCount)+relative(x.targetCharCount,y.targetCharCount)+channelDistance(x.captureChannels,y.captureChannels);}
function channelDistance(a,b){const keys=new Set([...Object.keys(a),...Object.keys(b)]);const at=Object.values(a).reduce((s,n)=>s+n,0)||1;const bt=Object.values(b).reduce((s,n)=>s+n,0)||1;let d=0;for(const key of keys)d+=Math.abs((a[key]??0)/at-(b[key]??0)/bt);return d;}
function relative(a,b){return Math.abs(a-b)/Math.max(1,a,b);}
function summarize(cohortId,groups,evaluationGroupCount,commonStrata){const familyCounts={};for(const group of groups){const family=group.members.training.report_family;familyCounts[family]=(familyCounts[family]??0)+1;}return {cohortId,status:"active",trainingSections:groups.length,validationSections:evaluationGroupCount,hiddenTestSections:evaluationGroupCount,members:groups.length+evaluationGroupCount*2,commonExecutableStrataAvailable:commonStrata,exactEvaluationTriples:evaluationGroupCount,lineageLeaks:0,meanMatchDistance:groups.slice(0,evaluationGroupCount).reduce((s,g)=>s+g.distance,0)/Math.max(1,evaluationGroupCount),familyCounts};}
function parseJson(value,fallback){if(value==null)return fallback;if(typeof value!=="string")return value;try{return JSON.parse(value);}catch{return fallback;}}
function hash(value){return createHash("sha256").update(String(value)).digest("hex");}
