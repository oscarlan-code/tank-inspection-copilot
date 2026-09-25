#!/usr/bin/env node
// SELECT-only snapshot. No migrations, generation, ingestion, approval or writes
// to PostgreSQL. Optional --output writes a review artifact, not a runtime index.
import pg from 'pg';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessPipelineReadiness, formatPipelineReadiness } from '../pipeline-readiness.mjs';
import { STANDARDIZED_PAIR_CONTRACT_VERSION } from '../standardized-pair-builder.mjs';
import { GOVERNED_GENERATOR_CONTRACT_VERSION } from '../governed-generation-contract.mjs';
import { SECTION_PLAN_EVALUATION_CONTRACT } from '../section-plan-evaluation.mjs';
import { SYSTEM_RL_REWARD_SCHEMA_VERSION } from '../system-rl-policy.mjs';

const args = process.argv.slice(2);
let output = null, strict = false;
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--strict') strict = true;
  else if (args[index] === '--output' && args[index + 1] && !args[index + 1].startsWith('--')) output = resolve(args[++index]);
  else throw new Error('Usage: review-report-pipeline.mjs [--output REVIEW.json] [--strict]');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required; load the local environment without printing credentials.');
const root = fileURLToPath(new URL('../../', import.meta.url));
const jsonFile = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const optionalJson = async path => { try { return await jsonFile(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
await db.connect();
const snapshot = { observedAt: new Date().toISOString(), contracts: { standardizedPair: STANDARDIZED_PAIR_CONTRACT_VERSION, rewardGenerator: GOVERNED_GENERATOR_CONTRACT_VERSION, evaluator: SECTION_PLAN_EVALUATION_CONTRACT } };
try {
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await db.query("SET LOCAL statement_timeout='30s'");
  const rows = async (sql, values = []) => (await db.query(sql, values)).rows;
  const one = async (sql, values = []) => (await rows(sql, values))[0];
  snapshot.kb = await one(`SELECT count(*)::int documents,count(DISTINCT source_sha256)::int distinct_source_hashes,
    count(*) FILTER(WHERE source_object_key IS NOT NULL)::int source_object_references,
    count(*) FILTER(WHERE approval_status='rejected')::int rejected_documents FROM kb_documents`);
  snapshot.kb.crossSplitHashGroups = (await one(`SELECT count(*)::int n FROM (SELECT source_sha256 FROM kb_documents WHERE source_sha256 IS NOT NULL GROUP BY 1 HAVING count(DISTINCT dataset_split)>1) d`)).n;
  snapshot.kb.documentsByState = await rows(`SELECT document_role,dataset_split,approval_status,retrieval_eligible,count(*)::int n FROM kb_documents GROUP BY 1,2,3,4 ORDER BY 1,2,3,4`);
  snapshot.kb.chunks = await one(`SELECT count(*)::int total,count(*) FILTER(WHERE embedding IS NOT NULL)::int embedded,count(*) FILTER(WHERE page_numbers_json IS NULL OR page_numbers_json::text IN ('[]','null'))::int without_page_numbers FROM kb_chunks`);
  snapshot.kb.sections = await rows(`SELECT lane_code,review_status,include_in_retrieval,count(*)::int n FROM kb_sections GROUP BY 1,2,3 ORDER BY 1,2,3`);
  snapshot.registry = await one(`SELECT count(*)::int reports,count(DISTINCT asset_lineage_key)::int asset_lineages FROM report_corpus_registry`);
  snapshot.registry.byRole = await rows(`SELECT eligibility_role,dataset_split,count(*)::int n FROM report_corpus_registry GROUP BY 1,2 ORDER BY 1,2`);
  snapshot.registry.crossSplitLineages = (await one(`SELECT count(*)::int n FROM (SELECT asset_lineage_key FROM report_corpus_registry GROUP BY 1 HAVING count(DISTINCT dataset_split)>1) d`)).n;
  snapshot.governedIndex = await one(`SELECT count(DISTINCT i.corpus_report_id)::int reports,count(DISTINCT i.asset_lineage_key)::int asset_lineages,count(s.section_id)::int sections FROM report_governed_kb_documents i LEFT JOIN report_governed_kb_sections s ON s.kb_index_id=i.kb_index_id AND s.corpus_report_id=i.corpus_report_id WHERE i.kb_index_id='governed_kb_content_v1'`);
  snapshot.governedIndex.invalidSources = (await one(`SELECT count(*)::int n FROM report_governed_kb_documents i LEFT JOIN report_corpus_registry r USING(corpus_report_id) LEFT JOIN kb_documents d ON d.document_id=i.document_id WHERE i.kb_index_id='governed_kb_content_v1' AND (r.dataset_split IS DISTINCT FROM 'training' OR r.eligibility_role IS DISTINCT FROM 'training_reference' OR r.retrieval_eligible IS DISTINCT FROM true OR d.approval_status IS DISTINCT FROM 'approved' OR d.source_sha256 IS NULL OR r.binary_sha256 IS NULL OR d.source_sha256 IS DISTINCT FROM r.binary_sha256 OR i.asset_lineage_key IS DISTINCT FROM r.asset_lineage_key OR i.core_family IS DISTINCT FROM r.core_family)`)).n;
  snapshot.governedIndex.sectionsByState = await rows(`SELECT s.lane_code,s.review_status,s.include_in_retrieval,count(*)::int n FROM report_governed_kb_sections i LEFT JOIN kb_sections s USING(section_id) WHERE i.kb_index_id='governed_kb_content_v1' GROUP BY 1,2,3 ORDER BY 1,2,3`);
  const retrievalLanes = new Set(['template_library', 'wording_precedent', 'historical_case_memory', 'fact_recommendation', 'standards_guidance', 'specialist_evidence']);
  snapshot.governedIndex.excludedSections = snapshot.governedIndex.sectionsByState.filter(row => !row.include_in_retrieval || !['approved','reviewed'].includes(row.review_status) || !retrievalLanes.has(row.lane_code)).reduce((sum, row) => sum + row.n, 0);
  snapshot.pairs = { standardized: await rows(`SELECT contract_version,status_code,count(*)::int n FROM report_standardized_mock_gold_pairs GROUP BY 1,2 ORDER BY 1,2`), governed: await rows(`SELECT contract_version,dataset_split,status_code,count(*)::int n FROM report_governed_baseline_pairs GROUP BY 1,2,3 ORDER BY 1,2,3`) };
  snapshot.pairs.currentContractRows = snapshot.pairs.standardized.filter(row => row.contract_version === STANDARDIZED_PAIR_CONTRACT_VERSION && row.status_code === 'ready').reduce((sum, row) => sum + row.n, 0);
  snapshot.rewards = { total: (await one(`SELECT count(*)::int n FROM system_rl_policy_rewards`)).n,
    currentContractEligible: (await one(`SELECT count(*)::int n FROM system_rl_policy_rewards WHERE learning_eligible AND metrics_json->>'runPurpose'='training' AND metrics_json->>'promotionEvidenceEligible'='true' AND metrics_json->>'rewardSchemaVersion'=$1 AND metrics_json->>'generatorContractVersion'=$2 AND metrics_json->>'sectionPlanEvaluationContract'=$3`, [String(SYSTEM_RL_REWARD_SCHEMA_VERSION), GOVERNED_GENERATOR_CONTRACT_VERSION, SECTION_PLAN_EVALUATION_CONTRACT])).n };
  snapshot.policies = await rows(`SELECT policy_version_id,version_number,status_code,promoted_at_iso FROM system_rl_policy_versions WHERE status_code IN ('production','training') ORDER BY version_number`);
  snapshot.cohorts = await rows(`SELECT c.cohort_id,c.dataset_split,count(i.section_key)::int sections,count(DISTINCT i.corpus_report_id)::int reports FROM report_governed_validation_cohorts c LEFT JOIN report_governed_validation_cohort_items i USING(cohort_id) GROUP BY 1,2 ORDER BY 1`);
  await db.query('ROLLBACK');
} finally { await db.end(); }
const source = await readFile(resolve(root, 'server/generation.mjs'), 'utf8');
snapshot.code = { plannedRouteEvaluationOnly: /if\s*\(executionMode === 'evaluation' && reportState\.sectionPlanning\)/.test(source) };
const outline = await jsonFile('docs/reviews/data/kb-outline-audit-2026-09-17.json');
snapshot.outlineExposure = { sourceEntries: outline.sources.length, policy: outline.exposurePolicy, reviewedAt: outline.reviewedAt };
const inspector = await optionalJson('docs/reviews/data/tk5452-inspector-evaluation-v2/review.json');
snapshot.inspectorRun = inspector ? { caseId: inspector.caseId, inputReadiness: inspector.inputReadiness, summary: inspector.summary } : null;
snapshot.localIndexes = {};
for (const [key, path] of Object.entries({ precedent: '.data/precedent-kb/precedent-kb.index.json', recommendations: '.data/fact-recommendation-kb/fact-recommendation-kb.index.json' })) {
  const index = await optionalJson(path);
  snapshot.localIndexes[key] = index ? { builtAtIso: index.builtAtIso, documentCount: index.documentCount ?? index.sourceDocumentCount, chunkCount: index.chunkCount ?? index.sourceChunkCount, pairCount: index.pairCount ?? null } : null;
}
const report = assessPipelineReadiness(snapshot);
if (output) {
  if (!output.endsWith('.json')) throw new Error('--output must end with .json');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(output.replace(/\.json$/, '.md'), formatPipelineReadiness(report));
}
console.log(JSON.stringify({ observedAt: report.observedAt, auditCompleted: true, readyForPromotionReview: false, blockedChecks: report.checks.filter(check => check.status === 'blocked').map(check => check.id), output, databaseReadOnly: true, aiCalls: 0 }, null, 2));
if (strict && report.checks.some(check => check.status === 'blocked')) process.exitCode = 2;
