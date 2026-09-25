import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ANSWERABILITY_CLASSES,
  BENCHMARK_ROLES,
  BENCHMARK_TRACKS,
  DATASET_SPLITS,
  assertTrainingAppImportEligible,
  buildRetrievalFirewallContext,
  evaluateRetrievalCandidate,
  filterRetrievalCandidates,
  validateBenchmarkDocumentRole,
  validateTruthFactContract,
} from "../training-harness.mjs";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const failures = [];
const hash = "a".repeat(64);
const context = buildRetrievalFirewallContext({
  snapshotId: "snapshot-1",
  evaluationCaseId: "evaluation-case-1",
  evidenceAsOf: "2022-08-18T00:00:00.000Z",
  benchmarkTrack: BENCHMARK_TRACKS.ASSET_GENERALIZATION,
  assetLineageKey: "asset-v10",
  blockedDocumentIds: ["gold-document"],
  blockedCaseIds: ["gold-case"],
  blockedRenditionIds: ["gold-rendition"],
  blockedSourceSha256: ["b".repeat(64)],
  blockedChunkIds: ["gold-chunk"],
  blockedSourcePaths: ["s3://gold/report.pdf"],
  blockedSourceNames: ["gold report"],
});

const eligible = candidate();
assertDecision(eligible, context, true, "eligible_pre_cutoff_precedent");
assertDecision({ ...eligible, documentId: "gold-document" }, context, false, "same_gold_document");
assertDecision({ ...eligible, sourceCaseId: "gold-case" }, context, false, "same_gold_case");
assertDecision({ ...eligible, sourceRenditionId: "gold-rendition" }, context, false, "same_gold_rendition");
assertDecision({ ...eligible, sourceSha256: "b".repeat(64) }, context, false, "same_gold_hash");
assertDecision({ ...eligible, chunkId: "gold-chunk" }, context, false, "same_gold_chunk");
assertDecision({ ...eligible, sourcePath: "s3://gold/report.pdf" }, context, false, "same_gold_path");
assertDecision({ ...eligible, sourceReportName: "Gold Report" }, context, false, "same_gold_name");
assertDecision({ ...eligible, benchmarkRole: BENCHMARK_ROLES.VALIDATION_GOLD }, context, false, "validation_or_hidden_gold");
assertDecision({ ...eligible, datasetSplit: DATASET_SPLITS.HIDDEN_TEST }, context, false, "validation_or_hidden_gold");
assertDecision({ ...eligible, evidenceIssuedAt: "2023-01-01T00:00:00.000Z" }, context, false, "issued_after_evidence_cutoff");
assertDecision({ ...eligible, assetLineageKey: "asset-v10" }, context, false, "same_asset_lineage");
assertDecision({ ...eligible, sourceRenditionId: null }, context, false, "missing_immutable_lineage");
assertDecision({ ...eligible, benchmarkSnapshotId: "another-snapshot" }, context, false, "outside_benchmark_snapshot");
assertDecision({ ...eligible, retrievalEligible: false }, context, false, "not_retrieval_eligible");

const operationalContext = buildRetrievalFirewallContext({
  snapshotId: "snapshot-1",
  trainingCaseId: "training-case-1",
  evidenceAsOf: "2022-08-18T00:00:00.000Z",
  benchmarkTrack: BENCHMARK_TRACKS.OPERATIONAL_HISTORY,
  assetLineageKey: "asset-v10",
  blockedDocumentIds: ["gold-document"],
});
assertDecision(
  { ...eligible, assetLineageKey: "asset-v10" },
  operationalContext,
  true,
  "eligible_pre_cutoff_precedent",
);

const localAllowedHash = "c".repeat(64);
const localContext = buildRetrievalFirewallContext({
  snapshotId: "snapshot-1",
  evaluationCaseId: "evaluation-case-1",
  evidenceAsOf: "2022-08-18T00:00:00.000Z",
  benchmarkTrack: BENCHMARK_TRACKS.OPERATIONAL_HISTORY,
  blockedSourceSha256: ["b".repeat(64)],
  allowedSourceSha256: [localAllowedHash],
});
assertDecision({ ...eligible, sourceType: "sample_pdf", sourceSha256: localAllowedHash }, localContext, true, "eligible_locked_snapshot_precedent");
assertDecision({ ...eligible, sourceType: "sample_pdf", sourceSha256: hash }, localContext, false, "outside_training_corpus");
assertDecision({ ...eligible, sourceType: "sample_pdf", sourceSha256: "b".repeat(64) }, localContext, false, "same_gold_hash");

const filtered = filterRetrievalCandidates([
  eligible,
  { ...eligible, chunkId: "future-chunk", evidenceIssuedAt: "2024-01-01T00:00:00.000Z" },
  { ...eligible, chunkId: "hidden-chunk", benchmarkRole: BENCHMARK_ROLES.HIDDEN_TEST_GOLD },
], context);
assert(filtered.eligible.length === 1, "The firewall should retain only eligible pre-cutoff precedent.");
assert(filtered.excluded.length === 2, "The firewall should audit every excluded chunk.");
assert(filtered.reasonCounts.issued_after_evidence_cutoff === 1, "The firewall should count temporal exclusions.");
assert(filtered.reasonCounts.validation_or_hidden_gold === 1, "The firewall should count hidden-gold exclusions.");

validateBenchmarkDocumentRole({
  benchmarkRole: BENCHMARK_ROLES.TRAINING_PRECEDENT,
  datasetSplit: DATASET_SPLITS.TRAINING,
});
expectContract(
  () => validateBenchmarkDocumentRole({
    benchmarkRole: BENCHMARK_ROLES.VALIDATION_GOLD,
    datasetSplit: DATASET_SPLITS.TRAINING,
  }),
  "benchmark_role_split_mismatch",
);

const validFact = {
  factType: "measurement_summary",
  sectionKey: "shell-external-area-1-ut-scanning-findings",
  sourceDocumentId: "gold-document",
  sourceBlockIds: ["block-14-22"],
};
validateTruthFactContract(validFact, {
  answerabilityClass: ANSWERABILITY_CLASSES.APP_OBSERVABLE,
  requiredFact: true,
  expectedGeneratorBehavior: "Use the captured UT measurement.",
});
expectContract(
  () => validateTruthFactContract(validFact, {
    answerabilityClass: ANSWERABILITY_CLASSES.GOLD_ONLY_UNOBSERVABLE,
    requiredFact: true,
    expectedGeneratorBehavior: "Do not guess.",
  }),
  "unobservable_fact_cannot_be_required",
);

const appState = {
  reportJob: {
    reportJobId: "report-job-1",
    inspectionId: "inspection-1",
    isDemo: false,
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    sourceRevision: {
      importId: "import-1",
      packageSha256: hash,
      sourceObjectKey: "tenant-1/workspace-1/imports/source.json",
      sourceSha256: hash,
      storageStatus: "stored",
    },
  },
  exportPackage: { packageType: "v3_product_export", schemaVersion: 3 },
};
const provenance = assertTrainingAppImportEligible(appState);
assert(provenance.packageType === "v3_product_export", "V3 app provenance should be accepted.");
expectContract(
  () => assertTrainingAppImportEligible({
    ...appState,
    reportJob: { ...appState.reportJob, isDemo: true },
  }),
  "training_app_bootstrap_forbidden",
);
expectContract(
  () => assertTrainingAppImportEligible({
    ...appState,
    reportJob: {
      ...appState.reportJob,
      sourceRevision: { ...appState.reportJob.sourceRevision, storageStatus: "legacy" },
    },
  }),
  "training_app_immutable_source_required",
);

const migration = readFileSync(
  join(appRoot, "server", "storage", "migrations", "016_training_harness_foundation.sql"),
  "utf8",
);
for (const table of [
  "report_benchmark_snapshots",
  "report_benchmark_documents",
  "report_training_cases",
  "report_training_case_sources",
  "report_training_case_facts",
  "report_training_case_answerability",
]) {
  assert(migration.includes(`CREATE TABLE ${table}`), `Migration must create ${table}.`);
}
for (const invariant of [
  "guard_locked_benchmark_children",
  "guard_locked_training_case_children",
  "guard_locked_benchmark_snapshot",
  "validate_training_case_gold_role",
  "evidence_as_of TIMESTAMPTZ NOT NULL",
  "source_sha256 TEXT NOT NULL",
  "gold_only_unobservable",
]) {
  assert(migration.includes(invariant), `Migration is missing invariant: ${invariant}.`);
}

const precedentSource = readFileSync(join(appRoot, "server", "precedent-kb.mjs"), "utf8");
assert(
  precedentSource.includes("filterRetrievalCandidates(accessibleChunks, retrievalFirewallContext)"),
  "Precedent retrieval must apply the gold firewall before scoring.",
);
assert(
  precedentSource.indexOf("filterRetrievalCandidates(accessibleChunks, retrievalFirewallContext)")
    < precedentSource.indexOf("scoreChunk(chunk, profile, queryTerms)"),
  "Gold filtering must occur before precedent scoring.",
);

const storeSource = readFileSync(join(appRoot, "server", "store.mjs"), "utf8");
for (const required of [
  "createTrainingHarnessService",
  "createBenchmarkSnapshot: trainingHarness.createBenchmarkSnapshot",
  "registerBenchmarkDocument: trainingHarness.registerBenchmarkDocument",
  "upsertTrainingTruthFact: trainingHarness.upsertTruthFact",
  "isDemo: Boolean(row.bootstrap_key)",
]) {
  assert(storeSource.includes(required), `Report store is missing training-harness integration: ${required}.`);
}

const uploadSource = readFileSync(join(appRoot, "server", "object-upload-service.mjs"), "utf8");
const reportStoreSource = readFileSync(join(appRoot, "server", "store.mjs"), "utf8");
assert(uploadSource.includes("sourcePackageRef"), "Production upload must pass immutable source provenance into import.");
assert(reportStoreSource.includes("validateAndroidV3ProductExport(exportPackage)"), "Training parity depends on real V3 validation.");
assert(reportStoreSource.includes('sourcePackageRef ? "stored" : "legacy"'), "Training parity depends on durable import state.");

const apiSource = readFileSync(join(appRoot, "server", "index.mjs"), "utf8");
for (const required of [
  'pathname === "/api/v1/admin/truth-cases"',
  "truthCaseProposalPath",
  "truthFactPath",
  "truthCaseApprovalPath",
  "objectStorage.putBuffer",
  "truth-graph-v${manifest.truthGraphVersion}.json",
]) {
  assert(apiSource.includes(required), `Truth Case API is missing product wiring: ${required}.`);
}

const truthCaseUiSource = readFileSync(join(appRoot, "src", "components", "TruthCaseBuilder.tsx"), "utf8");
for (const required of [
  "SourcePreview",
  "Build automated draft",
  "proposeTruthCaseFacts(created.truthCase.truthCaseId)",
  "Approve automated draft",
]) {
  assert(truthCaseUiSource.includes(required), `Truth Case Builder UI is missing: ${required}.`);
}

const evaluationLabSource = readFileSync(join(appRoot, "src", "components", "EvaluationLab.tsx"), "utf8");
assert(evaluationLabSource.includes('label="2. Truth & Mock Data"'), "Evaluation Lab must consolidate truth and mock data in Stage 2.");
assert(evaluationLabSource.includes("<TruthCaseBuilder"), "Evaluation Lab must render the live Truth Case Builder.");
assert(!evaluationLabSource.includes("Stage 3 · Evidence Pairing"), "Interim Evidence Pairing must not remain in Stage 3 UI.");
assert(evaluationLabSource.includes("<CaptureVariantBuilder"), "Evaluation Lab must render the live Capture Variant Builder.");

const captureVariantUiSource = readFileSync(join(appRoot, "src", "components", "CaptureVariantBuilder.tsx"), "utf8");
for (const required of [
  "Generate and validate",
  "Run baseline evaluation",
  "Advanced diagnostics",
  "Validated mock dataset",
  "automatic app-format validation",
]) {
  assert(captureVariantUiSource.includes(required), `Capture Variant Builder UI is missing: ${required}.`);
}

const captureVariationSource = readFileSync(join(appRoot, "server", "training-harness.mjs"), "utf8");
for (const required of [
  'modelType: "hierarchical_constrained_sampling"',
  'distribution: "beta"',
  'distribution: "poisson"',
  'distribution: "constrained_permutation"',
  "sampleCaptureConditions(variantId, variationModel)",
  "requiredFactsIncluded: profile.lane_code === \"faithful_capture\"",
  "protectedFactsPreserved: true",
  "unobservableFactsWithheld: true",
]) {
  assert(captureVariationSource.includes(required), `Capture variation engine is missing: ${required}.`);
}
assert(
  captureVariantUiSource.includes("What conditions do you want to test?")
    && captureVariantUiSource.includes("Generated capture conditions"),
  "Capture Variant UI must explain statistical variation without requiring manual parameters.",
);

const captureVariantMigration = readFileSync(
  join(appRoot, "server", "storage", "migrations", "017_capture_variant_builder.sql"),
  "utf8",
);
for (const required of [
  "report_capture_profile_versions",
  "report_capture_variants",
  "report_capture_variant_fact_links",
  "guard_approved_capture_variant",
  "guard_capture_variant_fact_links",
]) {
  assert(captureVariantMigration.includes(required), `Capture Variant migration is missing: ${required}.`);
}

for (const required of [
  'pathname === "/api/v1/admin/capture-variants"',
  "truthCaseVariantPath",
  "captureVariantApprovalPath",
  '"capture-scenario-v1.json"',
]) {
  assert(apiSource.includes(required), `Capture Variant API is missing product wiring: ${required}.`);
}

if (failures.length > 0) {
  console.error("Training harness audit failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Training harness audit passed.");
console.log("- Benchmark roles, truth provenance, and answerability contracts are enforced.");
console.log("- Same-case/hash/rendition/chunk/path/name and future evidence are excluded before scoring.");
console.log("- Validation and hidden-test gold are globally unavailable to generation retrieval.");
console.log("- Training inputs must arrive through the immutable LAIQ app V3 upload/import path.");

function candidate(overrides = {}) {
  return {
    benchmarkSnapshotId: "snapshot-1",
    documentId: "precedent-document",
    sourceCaseId: "precedent-case",
    sourceRenditionId: "precedent-rendition",
    sourceSha256: hash,
    chunkId: "precedent-chunk",
    sourcePath: "s3://precedent/report.pdf",
    sourceReportName: "Earlier report",
    benchmarkRole: BENCHMARK_ROLES.TRAINING_PRECEDENT,
    datasetSplit: DATASET_SPLITS.TRAINING,
    evidenceIssuedAt: "2021-06-01T00:00:00.000Z",
    assetLineageKey: "another-asset",
    approvalStatus: "approved",
    retrievalEligible: true,
    ...overrides,
  };
}

function assertDecision(value, firewallContext, expectedEligibility, expectedReason) {
  const decision = evaluateRetrievalCandidate(value, firewallContext);
  assert(
    decision.eligible === expectedEligibility && decision.reason === expectedReason,
    `Expected ${expectedReason}/${expectedEligibility}, received ${decision.reason}/${decision.eligible}.`,
  );
}

function expectContract(operation, expectedCode) {
  try {
    operation();
    failures.push(`Expected contract error ${expectedCode}.`);
  } catch (error) {
    if (error?.code !== expectedCode) {
      failures.push(`Expected contract error ${expectedCode}, received ${error?.code ?? error?.message}.`);
    }
  }
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}
