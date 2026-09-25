import pg from "pg";
import { createPostgresDatabase } from "../storage/postgres.mjs";
import {
  ANSWERABILITY_CLASSES,
  BENCHMARK_ROLES,
  BENCHMARK_TRACKS,
  DATASET_SPLITS,
  createTrainingHarnessService,
} from "../training-harness.mjs";

const { Client } = pg;
const sourceDatabaseUrl = process.env.REPORT_PLATFORM_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!sourceDatabaseUrl) {
  throw new Error("DATABASE_URL or REPORT_PLATFORM_TEST_DATABASE_URL is required.");
}

const auditSchema = await createAuditSchema(sourceDatabaseUrl);
const db = await createPostgresDatabase({ databaseUrl: auditSchema.url });
const harness = createTrainingHarnessService({
  db,
  createError: (statusCode, message, code) => Object.assign(new Error(message), { statusCode, code }),
});
const nowIso = new Date().toISOString();
const userId = "training-harness-audit-user";
const documentId = "training-harness-audit-gold";
const sourceHash = "a".repeat(64);

try {
  await db.transaction(async () => {
    await db.prepare(
      "INSERT INTO tenants (tenant_id, tenant_name, created_at_iso, updated_at_iso) VALUES (?, ?, ?, ?)",
    ).run("training-audit-tenant", "Training Audit Tenant", nowIso, nowIso);
    await db.prepare(
      "INSERT INTO workspaces (workspace_id, tenant_id, workspace_name, created_at_iso, updated_at_iso) VALUES (?, ?, ?, ?, ?)",
    ).run("training-audit-workspace", "training-audit-tenant", "Training Audit Workspace", nowIso, nowIso);
    await db.prepare(
      `INSERT INTO platform_users (
        user_id, tenant_id, workspace_id, display_name, role_label,
        account_status, created_at_iso, updated_at_iso
      ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
    ).run(
      userId,
      "training-audit-tenant",
      "training-audit-workspace",
      "Training Harness Auditor",
      "Super Admin",
      nowIso,
      nowIso,
    );
    await db.prepare(
      `INSERT INTO kb_cases (
        case_id, tenant_id, workspace_id, report_family, dataset_split,
        status_code, metadata_json, created_at_iso, updated_at_iso
      ) VALUES (?, ?, ?, ?, 'validation', 'approved', '{}'::jsonb, ?, ?)`,
    ).run(
      "training-audit-source-case",
      "training-audit-tenant",
      "training-audit-workspace",
      "api_653_internal_external",
      nowIso,
      nowIso,
    );
    await db.prepare(
      `INSERT INTO kb_documents (
        document_id, tenant_id, workspace_id, visibility_code, document_type,
        source_uri, source_sha256, metadata_json, created_at_iso, updated_at_iso,
        case_id, rendition_id, document_role, dataset_split, approval_status,
        retrieval_eligible, source_object_key, approved_by_user_id, approved_at_iso
      ) VALUES (?, ?, ?, 'workspace_private', 'historical_report', ?, ?, '{}'::jsonb,
        ?, ?, ?, ?, 'evaluation_gold', 'validation', 'approved', FALSE, ?, ?, ?)`,
    ).run(
      documentId,
      "training-audit-tenant",
      "training-audit-workspace",
      "s3://training-audit/gold.pdf",
      sourceHash,
      nowIso,
      nowIso,
      "training-audit-source-case",
      "training-audit-rendition",
      "training-audit/gold.pdf",
      userId,
      nowIso,
    );
    await db.prepare(
      `INSERT INTO kb_ingestion_runs (
        ingestion_run_id, case_id, document_id, source_sha256, pipeline_version,
        status_code, quality_json, manifest_json, started_at_iso, completed_at_iso
      ) VALUES (?, ?, ?, ?, 'truth-audit-v1', 'approved', ?, ?, ?, ?)`,
    ).run(
      "training-audit-ingestion",
      "training-audit-source-case",
      documentId,
      sourceHash,
      JSON.stringify({ status: "passed", score: 1 }),
      JSON.stringify({ identity: { media_type: "application/pdf" } }),
      nowIso,
      nowIso,
    );
    await db.prepare(
      `INSERT INTO kb_sections (
        section_id, document_id, ingestion_run_id, section_key, original_heading,
        stable_order, review_status, lane_code, include_in_retrieval,
        metadata_json, created_at_iso, updated_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, 'reviewed', 'evaluation_gold', FALSE, '{}'::jsonb, ?, ?)`,
    ).run(
      "training-audit-section-info",
      documentId,
      "training-audit-ingestion",
      "general-tank-information",
      "General Tank Information",
      1,
      nowIso,
      nowIso,
    );
    await db.prepare(
      `INSERT INTO kb_sections (
        section_id, document_id, ingestion_run_id, section_key, original_heading,
        stable_order, review_status, lane_code, include_in_retrieval,
        metadata_json, created_at_iso, updated_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, 'reviewed', 'evaluation_gold', FALSE, '{}'::jsonb, ?, ?)`,
    ).run(
      "training-audit-section-recommendation",
      documentId,
      "training-audit-ingestion",
      "repair-recommendations",
      "Repair Recommendations",
      2,
      nowIso,
      nowIso,
    );
    await db.prepare(
      `INSERT INTO kb_chunks (
        chunk_id, document_id, tenant_id, workspace_id, section_type, content,
        metadata_json, ingestion_run_id, block_type, content_sha256,
        source_block_ids_json, page_numbers_json, source_spans_json,
        stable_order, created_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, '{}'::jsonb, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "training-audit-chunk-table",
      documentId,
      "training-audit-tenant",
      "training-audit-workspace",
      "general-tank-information",
      "Tank height | 14.535 m\nShell courses | 8",
      "training-audit-ingestion",
      "table",
      "c".repeat(64),
      JSON.stringify(["block-table-1"]),
      JSON.stringify([6]),
      JSON.stringify([{ source_block_id: "block-table-1", page_number: 6, bbox: [0.1, 0.2, 0.8, 0.4] }]),
      1,
      nowIso,
    );
    await db.prepare(
      `INSERT INTO kb_chunks (
        chunk_id, document_id, tenant_id, workspace_id, section_type, content,
        metadata_json, ingestion_run_id, block_type, content_sha256,
        source_block_ids_json, page_numbers_json, source_spans_json,
        stable_order, created_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, '{}'::jsonb, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "training-audit-chunk-recommendation",
      documentId,
      "training-audit-tenant",
      "training-audit-workspace",
      "repair-recommendations",
      "Repair the shell area after approved API 653 engineering assessment.",
      "training-audit-ingestion",
      "paragraph",
      "d".repeat(64),
      JSON.stringify(["block-recommendation-1"]),
      JSON.stringify([12]),
      JSON.stringify([{ source_block_id: "block-recommendation-1", page_number: 12, bbox: [0.12, 0.3, 0.84, 0.5] }]),
      2,
      nowIso,
    );
  });

  const snapshot = await harness.createBenchmarkSnapshot({
    actorUserId: userId,
    snapshotName: "training-harness-audit",
    versionNumber: 1,
    tenantId: "training-audit-tenant",
    workspaceId: "training-audit-workspace",
  });
  const snapshotId = snapshot.snapshot.snapshot_id;
  await harness.registerBenchmarkDocument({
    snapshotId,
    documentId,
    benchmarkRole: BENCHMARK_ROLES.VALIDATION_GOLD,
    datasetSplit: DATASET_SPLITS.VALIDATION,
    evidenceIssuedAt: "2022-08-18T00:00:00.000Z",
    assetLineageKey: "tank-v10",
  });
  const createdCase = await harness.createTrainingCase({
    actorUserId: userId,
    snapshotId,
    goldDocumentId: documentId,
    displayName: "Training harness audit case",
    reportFamily: "api_653_internal_external",
    benchmarkTrack: BENCHMARK_TRACKS.ASSET_GENERALIZATION,
    evidenceAsOf: "2022-08-18T00:00:00.000Z",
    assetLineageKey: "tank-v10",
  });
  const trainingCaseId = createdCase.trainingCase.training_case_id;
  const proposed = await harness.proposeTruthFacts({
    actorUserId: userId,
    trainingCaseId,
  });
  assert(proposed.summary.total === 2, "Truth Case Builder should propose one review item per source chunk.");
  assert(
    proposed.facts.every((fact) => fact.sourcePageNumber && fact.sourceBbox),
    "Every proposal should retain source page and bounding-box provenance.",
  );
  const factId = "training-audit-fact";
  await harness.upsertTruthFact({
    actorUserId: userId,
    trainingCaseId,
    fact: {
      factId,
      factType: "measurement_summary",
      sectionKey: "shell-plate-thickness-measurements",
      normalizedValue: 2.28,
      unitCode: "mm",
      sourceDocumentId: documentId,
      sourcePageNumber: 14,
      sourceBlockIds: ["block-14-22"],
      sourceConfidence: 1,
      evidenceClass: "measurement",
      captureDestination: "utMeasurements",
      safetyCriticality: "critical",
      reviewStatus: "approved",
    },
    answerability: {
      answerabilityClass: ANSWERABILITY_CLASSES.APP_OBSERVABLE,
      requiredFact: true,
      expectedGeneratorBehavior: "Use the captured UT measurement without changing its value or unit.",
      reviewStatus: "approved",
    },
  });
  const persisted = await harness.getTrainingCase(trainingCaseId);
  assert(persisted.facts.length === 3, "Truth facts were not persisted.");
  assert(
    persisted.facts.some((fact) => fact.answerability_class === "app_observable"),
    "Answerability was not persisted.",
  );

  const proposedFacts = (await harness.getTruthCase(trainingCaseId)).facts.filter(
    (fact) => fact.reviewStatus === "machine_proposed",
  );
  for (const fact of proposedFacts) {
    await harness.reviewTruthFact({
      actorUserId: userId,
      trainingCaseId,
      factId: fact.factId,
      values: {
        reviewStatus: fact.factType === "structured_record" ? "approved" : "rejected",
      },
    });
  }
  const manifest = await harness.buildTruthGraphManifest(trainingCaseId);
  assert(manifest.facts.length === 2, "Truth Graph should contain only approved facts.");
  assert(manifest.facts.every((fact) => fact.provenance.blockIds.length > 0), "Truth Graph facts need provenance.");

  await harness.approveTruthCase({
    actorUserId: userId,
    trainingCaseId,
    truthGraphObjectKey: "training-audit/truth-cases/case/truth-graph-v1.json",
    truthGraphSha256: "b".repeat(64),
  });
  const approved = await harness.getTruthCase(trainingCaseId);
  assert(approved.truthCase.status === "case_approved", "Truth Case should be approved.");

  const generatedVariants = await harness.createCaptureVariants({
    actorUserId: userId,
    trainingCaseId,
    profileCodes: ["structured_complete", "interrupted_partial"],
    seeds: [7, 19],
  });
  const caseVariants = generatedVariants.variants.filter((variant) => variant.truthCaseId === trainingCaseId);
  assert(caseVariants.length === 4, "Two profiles and two seeds should create four Capture Variants.");
  assert(
    caseVariants.every((variant) => variant.datasetSplit === DATASET_SPLITS.VALIDATION),
    "Capture Variants must inherit the Truth Case dataset split.",
  );
  const generatedAgain = await harness.createCaptureVariants({
    actorUserId: userId,
    trainingCaseId,
    profileCodes: ["structured_complete", "interrupted_partial"],
    seeds: [7, 19],
  });
  assert(
    generatedAgain.variants.filter((variant) => variant.truthCaseId === trainingCaseId).length === 4,
    "Deterministic generation must be idempotent for the same case, profile, seed, and version.",
  );
  const draftVariant = caseVariants.find((variant) => variant.profileCode === "interrupted_partial");
  const draftDetail = await harness.getCaptureVariant(draftVariant.variantId);
  assert(draftDetail.manifest.packageType === "laiq_capture_scenario", "Builder must emit the scenario contract.");
  assert(
    draftDetail.manifest.appContractTarget.owner === "LAIQ inspection app"
      && draftDetail.manifest.appContractTarget.status === "awaiting_app_round_trip",
    "The scenario must delegate final V3 materialization to App Round Trip.",
  );
  assert(
    draftDetail.variant.expectedMissingInputs.length === 0,
    "Faithful Capture Variants must not withhold required inputs.",
  );
  assert(
    draftDetail.links.every((link) => !link.requiredFact || link.disposition !== "withheld"),
    "Every required faithful fact must remain present in the mock dataset.",
  );
  const protectedMeasurement = draftDetail.links.find((link) => link.factId === factId);
  assert(protectedMeasurement?.captureChannel === "measurement", "Critical measurements must retain their channel.");
  assert(protectedMeasurement?.disposition !== "withheld", "Critical measurements must never be withheld.");
  const approvedVariant = await harness.approveCaptureVariant({
    actorUserId: userId,
    variantId: draftVariant.variantId,
    scenarioObjectKey: `training-audit/capture-variants/${draftVariant.variantId}/capture-scenario-v1.json`,
    scenarioSha256: "e".repeat(64),
  });
  assert(approvedVariant.variant.status === "approved", "Capture Variant should enter approved state.");
  await expectError(
    () => harness.approveCaptureVariant({
      actorUserId: userId,
      variantId: draftVariant.variantId,
      scenarioObjectKey: "training-audit/duplicate.json",
      scenarioSha256: "f".repeat(64),
    }),
    "capture_variant_not_reviewable",
  );
  await expectDatabaseCheck(
    () => db.prepare("UPDATE report_capture_variants SET random_seed = 99 WHERE variant_id = ?").run(draftVariant.variantId),
  );
  await expectDatabaseCheck(
    () => db.prepare("UPDATE report_capture_variant_fact_links SET disposition_code = 'withheld' WHERE variant_id = ? AND fact_id = ?").run(draftVariant.variantId, factId),
  );
  await expectError(
    () => harness.reviewTruthFact({
      actorUserId: userId,
      trainingCaseId,
      factId,
      values: { reviewStatus: "rejected" },
    }),
    "truth_case_locked",
  );
  await expectDatabaseCheck(
    () => db.prepare(
      "UPDATE report_training_case_facts SET unit_code = 'inch' WHERE fact_id = ?",
    ).run(factId),
  );
  await expectDatabaseCheck(
    () => db.prepare(
      "UPDATE report_benchmark_snapshots SET manifest_sha256 = ? WHERE snapshot_id = ?",
    ).run("c".repeat(64), snapshotId),
  );

  console.log("Training harness storage audit passed.");
  console.log("- Truth Case Builder proposes source-linked facts with exact page/block provenance.");
  console.log("- Human fact and answerability decisions determine the approved Truth Graph.");
  console.log("- Approval locks the Truth Case, facts, labels, benchmark, and artifact identity.");
  console.log("- Capture Scenarios are deterministic, preserve protected facts, inherit dataset split, and lock after approval.");
} finally {
  await db.close();
  await dropAuditSchema(auditSchema);
}

async function expectError(operation, code) {
  try {
    await operation();
  } catch (error) {
    if (error?.code === code) return;
    throw error;
  }
  throw new Error(`Expected ${code}.`);
}

async function expectDatabaseCheck(operation) {
  try {
    await operation();
  } catch (error) {
    if (error?.code === "23514") return;
    throw error;
  }
  throw new Error("Expected PostgreSQL to reject mutation of locked benchmark state.");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createAuditSchema(sourceUrl) {
  const target = new URL(sourceUrl);
  const schemaName = `laiq_training_harness_audit_${process.pid}_${Date.now()}`;
  const client = new Client({
    connectionString: sourceUrl,
    ssl: process.env.REPORT_PLATFORM_DB_SSL === "require" ? { rejectUnauthorized: true } : false,
  });
  await client.connect();
  await client.query(`CREATE SCHEMA ${schemaName}`);
  await client.end();
  target.searchParams.set("options", `-c search_path=${schemaName},public`);
  return { schemaName, sourceUrl, url: target.toString() };
}

async function dropAuditSchema({ schemaName, sourceUrl }) {
  const client = new Client({
    connectionString: sourceUrl,
    ssl: process.env.REPORT_PLATFORM_DB_SSL === "require" ? { rejectUnauthorized: true } : false,
  });
  await client.connect();
  await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
  await client.end();
}
