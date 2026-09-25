import { readFileSync } from "node:fs";
import { join } from "node:path";

const appRoot = new URL("../..", import.meta.url).pathname;
const runtimeFiles = [
  "server/index.mjs",
  "server/store.mjs",
  "server/object-storage.mjs",
  "server/object-upload-service.mjs",
  "server/storage/postgres.mjs",
  "server/scripts/audit-api-hardening.mjs",
  "package.json",
];
const forbiddenPatterns = [
  { label: "SQLite runtime", pattern: /node:sqlite|DatabaseSync|\bPRAGMA\b/i },
  { label: "SQLite file configuration", pattern: /REPORT_PLATFORM_DB_PATH|report-platform\.sqlite/i },
  { label: "database driver switch", pattern: /REPORT_PLATFORM_DB_DRIVER/i },
];

const violations = [];
for (const relativePath of runtimeFiles) {
  const content = readFileSync(join(appRoot, relativePath), "utf8");
  for (const rule of forbiddenPatterns) {
    if (rule.pattern.test(content)) {
      violations.push(`${relativePath}: ${rule.label}`);
    }
  }
}

const objectMigration = readFileSync(
  join(appRoot, "server/storage/migrations/004_object_upload_sessions.sql"),
  "utf8",
);
for (const required of [
  "CREATE TABLE report_object_upload_sessions",
  "CREATE TABLE report_object_uploads",
  "UNIQUE (actor_user_id, idempotency_key)",
]) {
  if (!objectMigration.includes(required)) {
    violations.push(`004_object_upload_sessions.sql: missing ${required}`);
  }
}

const reportArtifactMigration = readFileSync(
  join(appRoot, "server/storage/migrations/005_report_artifact_objects.sql"),
  "utf8",
);
for (const required of [
  "CREATE TABLE report_artifact_objects",
  "UNIQUE (report_job_id, artifact_run_id, relative_path)",
  "object_key TEXT NOT NULL UNIQUE",
]) {
  if (!reportArtifactMigration.includes(required)) {
    violations.push(`005_report_artifact_objects.sql: missing ${required}`);
  }
}

const immutableRevisionMigration = readFileSync(
  join(appRoot, "server/storage/migrations/006_immutable_export_revisions.sql"),
  "utf8",
);
for (const required of [
  "package_sha256",
  "revision_number",
  "source_object_key",
  "idx_report_imports_inspection_package",
  "idx_report_jobs_import",
  "source_export_package_json",
]) {
  if (!immutableRevisionMigration.includes(required)) {
    violations.push(`006_immutable_export_revisions.sql: missing ${required}`);
  }
}

const systemRlMigration = readFileSync(
  join(appRoot, "server/storage/migrations/008_system_rl_policy.sql"),
  "utf8",
);
for (const required of [
  "CREATE TABLE system_rl_policy_versions",
  "CREATE TABLE system_rl_policy_arms",
  "CREATE TABLE system_rl_policy_decisions",
  "CREATE TABLE system_rl_policy_rewards",
  "CREATE TABLE system_rl_context_arm_stats",
  "CREATE TABLE system_rl_policy_events",
  "WHERE status_code = 'production'",
]) {
  if (!systemRlMigration.includes(required)) {
    violations.push(`008_system_rl_policy.sql: missing ${required}`);
  }
}

const kbIngestionMigration = readFileSync(
  join(appRoot, "server/storage/migrations/010_kb_ingestion_lineage.sql"),
  "utf8",
);
for (const required of [
  "CREATE TABLE kb_cases",
  "CREATE TABLE kb_ingestion_runs",
  "CREATE TABLE kb_sections",
  "CREATE TABLE kb_ingestion_escalations",
  "kb_documents_retrieval_gate_check",
  "retrieval_eligible BOOLEAN NOT NULL DEFAULT FALSE",
]) {
  if (!kbIngestionMigration.includes(required)) {
    violations.push(`010_kb_ingestion_lineage.sql: missing ${required}`);
  }
}

const kbReviewMigration = readFileSync(
  join(appRoot, "server/storage/migrations/011_kb_review_workflow.sql"),
  "utf8",
);
for (const required of [
  "CREATE TABLE kb_review_decisions",
  "include_in_retrieval BOOLEAN NOT NULL DEFAULT FALSE",
  "kb_sections_retrieval_review_check",
  "approved_by_user_id",
]) {
  if (!kbReviewMigration.includes(required)) {
    violations.push(`011_kb_review_workflow.sql: missing ${required}`);
  }
}

const kbWarningReviewMigration = readFileSync(
  join(appRoot, "server/storage/migrations/014_kb_warning_reviews.sql"),
  "utf8",
);
for (const required of [
  "CREATE TABLE kb_warning_reviews",
  "UNIQUE (document_id, ingestion_run_id, issue_key)",
  "needs_correction",
  "warning_reviewed",
]) {
  if (!kbWarningReviewMigration.includes(required)) {
    violations.push(`014_kb_warning_reviews.sql: missing ${required}`);
  }
}

const liveEvaluationMigration = readFileSync(
  join(appRoot, "server/storage/migrations/015_live_evaluation_cases.sql"),
  "utf8",
);
for (const required of [
  "report_evaluation_cases_gold_document_fk",
  "ADD COLUMN evaluation_case_id",
  "idx_report_eval_runs_evaluation_case_created",
]) {
  if (!liveEvaluationMigration.includes(required)) {
    violations.push(`015_live_evaluation_cases.sql: missing ${required}`);
  }
}

const captureVariantMigration = readFileSync(
  join(appRoot, "server/storage/migrations/017_capture_variant_builder.sql"),
  "utf8",
);
for (const required of [
  "CREATE TABLE report_capture_profile_versions",
  "CREATE TABLE report_capture_variants",
  "CREATE TABLE report_capture_variant_fact_links",
  "validate_capture_variant_truth",
  "guard_approved_capture_variant",
  "guard_capture_variant_fact_links",
  "scenario_sha256 ~ '^[a-f0-9]{64}$'",
]) {
  if (!captureVariantMigration.includes(required)) {
    violations.push(`017_capture_variant_builder.sql: missing ${required}`);
  }
}

const governedCorpusMigration = readFileSync(
  join(appRoot, "server/storage/migrations/031_governed_report_corpus_registry.sql"),
  "utf8",
);
for (const required of [
  "CREATE TABLE report_corpus_taxonomy_versions",
  "CREATE TABLE report_corpus_registry",
  "CREATE TABLE report_corpus_copies",
  "guard_report_corpus_lineage_split",
  "eligibility_role",
  "retrieval_eligible",
]) {
  if (!governedCorpusMigration.includes(required)) {
    violations.push(`031_governed_report_corpus_registry.sql: missing ${required}`);
  }
}

const governedKbMigration = readFileSync(
  join(appRoot, "server/storage/migrations/032_governed_kb_index.sql"),
  "utf8",
);
for (const required of [
  "CREATE TABLE report_governed_kb_indexes",
  "CREATE TABLE report_governed_kb_documents",
  "CREATE TABLE report_governed_kb_sections",
  "guard_governed_kb_training_source",
]) {
  if (!governedKbMigration.includes(required)) {
    violations.push(`032_governed_kb_index.sql: missing ${required}`);
  }
}

const governedPairsMigration = readFileSync(
  join(appRoot, "server/storage/migrations/033_governed_section_pairs.sql"),
  "utf8",
);
for (const required of [
  "CREATE TABLE report_governed_gold_sections",
  "CREATE TABLE report_governed_baseline_pairs",
  "guard_governed_pair_alignment",
]) {
  if (!governedPairsMigration.includes(required)) {
    violations.push(`033_governed_section_pairs.sql: missing ${required}`);
  }
}

const governedRagRunsMigration = readFileSync(
  join(appRoot, "server/storage/migrations/034_governed_rag_training_runs.sql"),
  "utf8",
);
for (const required of [
  "CREATE TABLE report_governed_rag_training_runs",
  "guard_governed_rag_training_run",
  "governed_pair_id",
  "retrieval_audit_json",
]) {
  if (!governedRagRunsMigration.includes(required)) {
    violations.push(`034_governed_rag_training_runs.sql: missing ${required}`);
  }
}

const governedEvidenceV2Migration = readFileSync(
  join(appRoot, "server/storage/migrations/035_governed_evidence_contract_v2.sql"),
  "utf8",
);
for (const required of [
  "gold_contract_version",
  "rl_policy_report_generation_v5_governed",
  "exact_profile",
  "method_compatible",
  "family_section",
]) {
  if (!governedEvidenceV2Migration.includes(required)) {
    violations.push(`035_governed_evidence_contract_v2.sql: missing ${required}`);
  }
}

const entityBoundValidationMigration = readFileSync(
  join(appRoot, "server/storage/migrations/042_entity_bound_evidence_validation.sql"),
  "utf8",
);
for (const required of [
  "rl_policy_report_generation_v11_entity_bound_validation",
  '"pairContract":8',
  '"entityBindingContract":"entity_relationship_binding_v1"',
  "rl_arm_v11_grounded",
  "rl_arm_v11_evidence_recovery",
]) {
  if (!entityBoundValidationMigration.includes(required)) {
    violations.push(`042_entity_bound_evidence_validation.sql: missing ${required}`);
  }
}

const appStructuredTableValidationMigration = readFileSync(
  join(appRoot, "server/storage/migrations/043_app_structured_table_validation.sql"),
  "utf8",
);
for (const required of [
  "rl_policy_report_generation_v12_app_table_validation",
  '"pairContract":9',
  '"structuredTableContract":"android_app_structured_table_v1"',
  "rl_arm_v12_grounded",
  "rl_arm_v12_evidence_recovery",
]) {
  if (!appStructuredTableValidationMigration.includes(required)) {
    violations.push(`043_app_structured_table_validation.sql: missing ${required}`);
  }
}

const evidenceRewardMigration = readFileSync(
  join(appRoot, "server/storage/migrations/036_evidence_conditioned_reward_candidate.sql"),
  "utf8",
);
for (const required of [
  "rl_policy_report_generation_v6_evidence_reward",
  "evidence_conditioned_v1",
  '"goldSimilarityRole":"diagnostic_only"',
]) {
  if (!evidenceRewardMigration.includes(required)) {
    violations.push(`036_evidence_conditioned_reward_candidate.sql: missing ${required}`);
  }
}

const labelledVoicePolicyMigration = readFileSync(
  join(appRoot, "server/storage/migrations/037_labelled_voice_policy_candidate.sql"),
  "utf8",
);
for (const required of [
  "rl_policy_report_generation_v7_labelled_voice",
  "evidence_conditioned_v2",
  "section_field_labelled_v1",
]) {
  if (!labelledVoicePolicyMigration.includes(required)) {
    violations.push(`037_labelled_voice_policy_candidate.sql: missing ${required}`);
  }
}

const mockPathwayAbMigration = readFileSync(
  join(appRoot, "server/storage/migrations/038_mock_pathway_ab_policy.sql"),
  "utf8",
);
for (const required of [
  "rl_policy_report_generation_v8_mock_pathway_ab",
  "mock_pathway_ab_v1",
  "contextual_ucb_v1",
]) {
  if (!mockPathwayAbMigration.includes(required)) {
    violations.push(`038_mock_pathway_ab_policy.sql: missing ${required}`);
  }
}

const frozenMockBenchmarkMigration = readFileSync(
  join(appRoot, "server/storage/migrations/039_frozen_mock_pathway_benchmark.sql"),
  "utf8",
);
for (const required of [
  "rl_policy_report_generation_v9_frozen_mock_benchmark",
  "frozen_mock_pathway_benchmark_v1",
  "qualification_preserving_grounded_v1",
  '"pairContracts":[1,4,5,6]',
]) {
  if (!frozenMockBenchmarkMigration.includes(required)) {
    violations.push(`039_frozen_mock_pathway_benchmark.sql: missing ${required}`);
  }
}

const contextualRagArmsMigration = readFileSync(
  join(appRoot, "server/storage/migrations/040_v9_contextual_rag_arms.sql"),
  "utf8",
);
for (const required of [
  "rl_arm_v9_balanced",
  "rl_arm_v9_evidence_recovery",
  "contextual_rag_arm_training_v1",
  '"pairContracts":[7]',
]) {
  if (!contextualRagArmsMigration.includes(required)) {
    violations.push(`040_v9_contextual_rag_arms.sql: missing ${required}`);
  }
}

const frozenContextualValidationMigration = readFileSync(
  join(appRoot, "server/storage/migrations/041_frozen_contextual_validation.sql"),
  "utf8",
);
for (const required of [
  "rl_policy_report_generation_v10_frozen_contextual_validation",
  '"learningMode":"validation_only"',
  '"inspection-maintenance-regime":"evidence_recovery"',
  "pair_row.dataset_split='validation'",
]) {
  if (!frozenContextualValidationMigration.includes(required)) {
    violations.push(`041_frozen_contextual_validation.sql: missing ${required}`);
  }
}

const postgresRuntime = readFileSync(
  join(appRoot, "server/storage/postgres.mjs"),
  "utf8",
);
if (!/readdir\(migrationsDirectory\)/.test(postgresRuntime)) {
  violations.push("postgres.mjs: migrations must be discovered from the versioned migration directory");
}

const migration = readFileSync(
  join(appRoot, "server/storage/migrations/001_initial.sql"),
  "utf8",
);
for (const required of [
  "CREATE EXTENSION IF NOT EXISTS vector",
  "CREATE TABLE tenants",
  "CREATE TABLE report_jobs",
  "CREATE TABLE report_section_drafts",
  "CREATE TABLE kb_chunks",
]) {
  if (!migration.includes(required)) {
    violations.push(`001_initial.sql: missing ${required}`);
  }
}

if (violations.length > 0) {
  throw new Error(`Product storage audit failed:\n- ${violations.join("\n- ")}`);
}

console.log("Product storage audit passed: PostgreSQL is the only report-platform database path.");
