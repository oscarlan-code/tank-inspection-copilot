import { createPostgresDatabase } from "../storage/postgres.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const db = await createPostgresDatabase({ databaseUrl: process.env.DATABASE_URL });
try {
  const checks = {
    duplicateSections: Number((await db.prepare(
      `SELECT COUNT(*)::int AS count FROM (
        SELECT training_case_id,section_key,contract_version FROM report_baseline_gold_pairs
        GROUP BY 1,2,3 HAVING COUNT(*)>1
      ) duplicates`,
    ).get()).count),
    variationPresent: Number((await db.prepare(
      `SELECT COUNT(*)::int AS count FROM report_baseline_gold_pairs
      WHERE deterministic_input_json->'variation' IS DISTINCT FROM 'null'::jsonb`,
    ).get()).count),
    splitMismatches: Number((await db.prepare(
      `SELECT COUNT(*)::int AS count FROM report_baseline_gold_pairs p
      JOIN report_standardized_gold_sections g ON g.gold_section_id=p.gold_section_id
      JOIN report_training_cases c ON c.training_case_id=p.training_case_id
      WHERE p.dataset_split<>g.dataset_split OR p.dataset_split<>c.dataset_split`,
    ).get()).count),
    recoverableFactsOutsideTruthCase: Number((await db.prepare(
      `SELECT COUNT(*)::int AS count FROM report_baseline_gold_pairs p
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(p.expected_recoverable_fact_ids_json) id
        WHERE NOT EXISTS (
          SELECT 1 FROM report_training_case_facts fact
          WHERE fact.training_case_id=p.training_case_id AND fact.fact_id=id
        )
      )`,
    ).get()).count),
    invalidReadyPairs: Number((await db.prepare(
      `SELECT COUNT(*)::int AS count FROM report_baseline_gold_pairs
      WHERE status_code='ready' AND COALESCE((validation_json->>'aligned')::boolean,FALSE)=FALSE`,
    ).get()).count),
  };
  if (Object.values(checks).some((count) => count > 0)) {
    throw new Error(`Baseline-pair audit failed: ${JSON.stringify(checks)}`);
  }
  const counts = await db.prepare(
    `SELECT dataset_split,status_code,COUNT(*)::int AS count
    FROM report_baseline_gold_pairs GROUP BY 1,2 ORDER BY 1,2`,
  ).all();
  console.log(JSON.stringify({ passed: true, checks, counts }, null, 2));
} finally {
  await db.close();
}
