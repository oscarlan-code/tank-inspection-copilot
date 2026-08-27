import { createPostgresDatabase } from "../storage/postgres.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const db = await createPostgresDatabase({ databaseUrl: process.env.DATABASE_URL });
try {
  const invalidSubset = await db.prepare(
    `SELECT COUNT(*)::int AS count
    FROM report_standardized_mock_gold_pairs p
    JOIN report_standardized_gold_sections g ON g.gold_section_id=p.gold_section_id
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(p.expected_recoverable_fact_ids_json) id
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(g.normalized_facts_json) fact
        WHERE fact->>'factId'=id
      )
    )`,
  ).get();
  const splitMismatch = await db.prepare(
    `SELECT COUNT(*)::int AS count FROM report_standardized_mock_gold_pairs p
    JOIN report_standardized_gold_sections g ON g.gold_section_id=p.gold_section_id
    JOIN report_capture_variants v ON v.variant_id=p.variant_id
    JOIN report_training_cases c ON c.training_case_id=p.training_case_id
    WHERE p.dataset_split<>g.dataset_split OR p.dataset_split<>v.dataset_split
      OR p.dataset_split<>c.dataset_split`,
  ).get();
  const leakedTarget = await db.prepare(
    `SELECT COUNT(*)::int AS count FROM report_standardized_mock_gold_pairs p
    JOIN report_standardized_gold_sections g ON g.gold_section_id=p.gold_section_id
    WHERE p.dataset_split IN ('validation','hidden_test')
      AND length(g.target_content)>80
      AND p.mock_input_json::text LIKE '%' || left(g.target_content, 80) || '%'`,
  ).get();
  const invalidReady = await db.prepare(
    `SELECT COUNT(*)::int AS count FROM report_standardized_mock_gold_pairs
    WHERE status_code='ready' AND COALESCE((validation_json->>'aligned')::boolean,FALSE)=FALSE`,
  ).get();
  const counts = await db.prepare(
    `SELECT dataset_split,status_code,COUNT(*)::int AS count
    FROM report_standardized_mock_gold_pairs GROUP BY 1,2 ORDER BY 1,2`,
  ).all();
  const failures = {
    recoverableFactsOutsideGold: Number(invalidSubset.count),
    splitMismatches: Number(splitMismatch.count),
    hiddenTargetLeaks: Number(leakedTarget.count),
    invalidReadyPairs: Number(invalidReady.count),
  };
  if (Object.values(failures).some((count) => count > 0)) {
    throw new Error(`Standardized-pair audit failed: ${JSON.stringify(failures)}`);
  }
  console.log(JSON.stringify({ passed: true, failures, counts }, null, 2));
} finally {
  await db.close();
}
