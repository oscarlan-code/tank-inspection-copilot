import { createHash, randomUUID } from "node:crypto";
import { buildReportSpecificSectionResolver } from "./capture-section-mapping.mjs";

export const BENCHMARK_ROLES = Object.freeze({
  TRAINING_PRECEDENT: "training_precedent",
  TRAINING_GOLD: "training_gold",
  VALIDATION_GOLD: "validation_gold",
  HIDDEN_TEST_GOLD: "hidden_test_gold",
  STANDARDS_GUIDANCE: "standards_guidance",
});

export const DATASET_SPLITS = Object.freeze({
  TRAINING: "training",
  VALIDATION: "validation",
  HIDDEN_TEST: "hidden_test",
  UNASSIGNED: "unassigned",
});

export const BENCHMARK_TRACKS = Object.freeze({
  OPERATIONAL_HISTORY: "operational_history",
  ASSET_GENERALIZATION: "asset_generalization",
});

export const ANSWERABILITY_CLASSES = Object.freeze({
  APP_OBSERVABLE: "app_observable",
  VOICE_OBSERVABLE: "voice_observable",
  REPORT_SIDE_INPUT: "report_side_input",
  DETERMINISTIC_DERIVED: "deterministic_derived",
  PRECEDENT_TEMPLATE: "precedent_template",
  STANDARDS_GUIDANCE: "standards_guidance",
  ENGINEERING_JUDGMENT: "engineering_judgment",
  GOLD_ONLY_UNOBSERVABLE: "gold_only_unobservable",
});

const GLOBAL_GOLD_ROLES = new Set([
  BENCHMARK_ROLES.VALIDATION_GOLD,
  BENCHMARK_ROLES.HIDDEN_TEST_GOLD,
]);
const GLOBAL_GOLD_SPLITS = new Set([
  DATASET_SPLITS.VALIDATION,
  DATASET_SPLITS.HIDDEN_TEST,
]);
const RETRIEVABLE_ROLES = new Set([
  BENCHMARK_ROLES.TRAINING_PRECEDENT,
  BENCHMARK_ROLES.TRAINING_GOLD,
  BENCHMARK_ROLES.STANDARDS_GUIDANCE,
]);
const REVIEWED_APPROVAL_STATES = new Set(["approved", "approved_for_retrieval"]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const EDITABLE_TRUTH_CASE_STATES = new Set([
  "source_approved",
  "truth_extracting",
  "truth_review_required",
]);
const TRUTH_FACT_REVIEW_STATES = new Set([
  "machine_proposed",
  "human_reviewed",
  "approved",
  "rejected",
]);
const CAPTURE_SCENARIO_VERSION = 5;

export class TrainingHarnessContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TrainingHarnessContractError";
    this.code = code;
  }
}

export function assertTrainingAppImportEligible(reportState) {
  const reportJob = reportState?.reportJob ?? {};
  const sourceRevision = reportJob.sourceRevision ?? {};
  const exportPackage = reportState?.exportPackage ?? {};

  if (reportJob.isDemo || reportJob.bootstrapKey) {
    throw contractError(
      "training_app_bootstrap_forbidden",
      "Training requires an app package imported through the production upload path, not a demo bootstrap.",
    );
  }
  if (exportPackage.packageType !== "v3_product_export" || Number(exportPackage.schemaVersion) !== 3) {
    throw contractError(
      "training_app_v3_contract_required",
      "Training requires a validated LAIQ inspection app V3 export package.",
    );
  }
  if (sourceRevision.storageStatus !== "stored") {
    throw contractError(
      "training_app_immutable_source_required",
      "The app export must be stored immutably before it can enter the training harness.",
    );
  }
  if (!nonEmpty(sourceRevision.sourceObjectKey)) {
    throw contractError("training_app_source_object_required", "The app export source object key is missing.");
  }
  if (!SHA256_PATTERN.test(String(sourceRevision.sourceSha256 ?? ""))) {
    throw contractError("training_app_source_hash_required", "The app export source SHA-256 is missing or invalid.");
  }
  if (!SHA256_PATTERN.test(String(sourceRevision.packageSha256 ?? ""))) {
    throw contractError("training_app_package_hash_required", "The normalized app package SHA-256 is missing or invalid.");
  }
  if (!nonEmpty(sourceRevision.importId) || !nonEmpty(reportJob.reportJobId)) {
    throw contractError("training_app_import_identity_required", "Persisted import and report job identities are required.");
  }

  return Object.freeze({
    reportJobId: reportJob.reportJobId,
    importId: sourceRevision.importId,
    inspectionId: reportJob.inspectionId ?? exportPackage.inspectionId,
    packageType: exportPackage.packageType,
    schemaVersion: Number(exportPackage.schemaVersion),
    packageSha256: sourceRevision.packageSha256,
    sourceObjectKey: sourceRevision.sourceObjectKey,
    sourceSha256: sourceRevision.sourceSha256,
    tenantId: reportJob.tenantId,
    workspaceId: reportJob.workspaceId,
  });
}

export function buildRetrievalFirewallContext({
  snapshotId,
  evaluationCaseId,
  trainingCaseId,
  evidenceAsOf,
  benchmarkTrack,
  assetLineageKey = null,
  blockedDocumentIds = [],
  blockedCaseIds = [],
  blockedRenditionIds = [],
  blockedSourceSha256 = [],
  blockedChunkIds = [],
  blockedSourcePaths = [],
  blockedSourceNames = [],
  allowedSourceSha256 = [],
} = {}) {
  if (!nonEmpty(snapshotId)) {
    throw contractError("retrieval_snapshot_required", "Evaluation retrieval requires an immutable benchmark snapshot.");
  }
  if (!nonEmpty(evaluationCaseId) && !nonEmpty(trainingCaseId)) {
    throw contractError("retrieval_case_required", "Evaluation retrieval requires a persisted evaluation link or Truth Case.");
  }
  const cutoffIso = normalizeIso(evidenceAsOf);
  if (!cutoffIso) {
    throw contractError("retrieval_cutoff_required", "Evaluation retrieval requires a valid evidenceAsOf timestamp.");
  }
  if (!Object.values(BENCHMARK_TRACKS).includes(benchmarkTrack)) {
    throw contractError("retrieval_track_invalid", "Evaluation retrieval requires a supported benchmark track.");
  }
  if (benchmarkTrack === BENCHMARK_TRACKS.ASSET_GENERALIZATION && !nonEmpty(assetLineageKey)) {
    throw contractError(
      "retrieval_asset_lineage_required",
      "Asset-generalization evaluation requires an asset lineage key.",
    );
  }

  return Object.freeze({
    mode: "evaluation",
    snapshotId: normalizeKey(snapshotId),
    evaluationCaseId: nonEmpty(evaluationCaseId) ? String(evaluationCaseId) : null,
    trainingCaseId: nonEmpty(trainingCaseId) ? String(trainingCaseId) : null,
    evidenceAsOf: cutoffIso,
    benchmarkTrack,
    assetLineageKey: normalizeKey(assetLineageKey),
    blockedDocumentIds: normalizedSet(blockedDocumentIds),
    blockedCaseIds: normalizedSet(blockedCaseIds),
    blockedRenditionIds: normalizedSet(blockedRenditionIds),
    blockedSourceSha256: normalizedSet(blockedSourceSha256),
    blockedChunkIds: normalizedSet(blockedChunkIds),
    blockedSourcePaths: normalizedSet(blockedSourcePaths),
    blockedSourceNames: normalizedSet(blockedSourceNames),
    allowedSourceSha256: normalizedSet(allowedSourceSha256),
  });
}

export function evaluateRetrievalCandidate(candidate, context) {
  if (!context) return { eligible: true, reason: "live_retrieval_context" };
  if (context.mode !== "evaluation") return blocked("invalid_firewall_context");

  const identity = candidateIdentity(candidate);
  // The local precedent index is a materialized view of canonical PDFs rather
  // than a benchmark table. Its immutable SHA membership is therefore the
  // bridge back to the locked snapshot. Fail closed for every sample PDF that
  // is not explicitly present in the snapshot's retrievable training corpus.
  if (candidate.sourceType === "sample_pdf") {
    if (!identity.sourceSha256) return blocked("missing_immutable_lineage");
    if (context.blockedSourceSha256.has(identity.sourceSha256)) return blocked("same_gold_hash");
    if (!context.allowedSourceSha256.has(identity.sourceSha256)) return blocked("outside_training_corpus");
    if (!identity.chunkId) return blocked("missing_chunk_identity");
    if (!REVIEWED_APPROVAL_STATES.has(String(candidate.approvalStatus ?? candidate.approval_status ?? ""))) {
      return blocked("not_approved");
    }
    return { eligible: true, reason: "eligible_locked_snapshot_precedent" };
  }
  // Standards are guidance, not report precedent. They may remain available
  // provided the local index records immutable identity and approval.
  if (candidate.sourceType === "code_pdf") {
    if (!identity.sourceSha256 || !identity.chunkId) return blocked("missing_immutable_lineage");
    if (!REVIEWED_APPROVAL_STATES.has(String(candidate.approvalStatus ?? candidate.approval_status ?? ""))) {
      return blocked("not_approved");
    }
    return { eligible: true, reason: "approved_standards_guidance" };
  }
  if (!identity.snapshotId || identity.snapshotId !== context.snapshotId) {
    return blocked("outside_benchmark_snapshot");
  }
  if (!identity.documentId || !identity.caseId || !identity.renditionId || !identity.sourceSha256) {
    return blocked("missing_immutable_lineage");
  }
  if (!identity.chunkId) return blocked("missing_chunk_identity");
  if (!identity.benchmarkRole || !identity.datasetSplit) return blocked("missing_dataset_role");
  if (GLOBAL_GOLD_ROLES.has(identity.benchmarkRole) || GLOBAL_GOLD_SPLITS.has(identity.datasetSplit)) {
    return blocked("validation_or_hidden_gold");
  }
  if (!RETRIEVABLE_ROLES.has(identity.benchmarkRole)) return blocked("role_not_retrievable");
  if (candidate.retrievalEligible !== true) return blocked("not_retrieval_eligible");
  if (!REVIEWED_APPROVAL_STATES.has(String(candidate.approvalStatus ?? candidate.approval_status ?? ""))) {
    return blocked("not_approved");
  }

  if (context.blockedDocumentIds.has(identity.documentId)) return blocked("same_gold_document");
  if (context.blockedCaseIds.has(identity.caseId)) return blocked("same_gold_case");
  if (context.blockedRenditionIds.has(identity.renditionId)) return blocked("same_gold_rendition");
  if (context.blockedSourceSha256.has(identity.sourceSha256)) return blocked("same_gold_hash");
  if (context.blockedChunkIds.has(identity.chunkId)) return blocked("same_gold_chunk");
  if (identity.sourcePath && context.blockedSourcePaths.has(identity.sourcePath)) return blocked("same_gold_path");
  if (identity.sourceName && context.blockedSourceNames.has(identity.sourceName)) return blocked("same_gold_name");

  if (!identity.evidenceIssuedAt) return blocked("missing_evidence_issued_at");
  if (Date.parse(identity.evidenceIssuedAt) > Date.parse(context.evidenceAsOf)) {
    return blocked("issued_after_evidence_cutoff");
  }
  if (
    context.benchmarkTrack === BENCHMARK_TRACKS.ASSET_GENERALIZATION
    && identity.assetLineageKey
    && identity.assetLineageKey === context.assetLineageKey
  ) {
    return blocked("same_asset_lineage");
  }

  return { eligible: true, reason: "eligible_pre_cutoff_precedent" };
}

export function filterRetrievalCandidates(candidates, context) {
  if (!context) {
    return { eligible: [...candidates], excluded: [], reasonCounts: {} };
  }
  const eligible = [];
  const excluded = [];
  const reasonCounts = {};
  for (const candidate of candidates) {
    const decision = evaluateRetrievalCandidate(candidate, context);
    if (decision.eligible) {
      eligible.push(candidate);
    } else {
      excluded.push({ chunkId: candidate.chunkId ?? candidate.chunk_id ?? null, reason: decision.reason });
      reasonCounts[decision.reason] = (reasonCounts[decision.reason] ?? 0) + 1;
    }
  }
  return { eligible, excluded, reasonCounts };
}

export function validateBenchmarkDocumentRole({ benchmarkRole, datasetSplit }) {
  const expected = {
    [BENCHMARK_ROLES.TRAINING_PRECEDENT]: DATASET_SPLITS.TRAINING,
    [BENCHMARK_ROLES.TRAINING_GOLD]: DATASET_SPLITS.TRAINING,
    [BENCHMARK_ROLES.VALIDATION_GOLD]: DATASET_SPLITS.VALIDATION,
    [BENCHMARK_ROLES.HIDDEN_TEST_GOLD]: DATASET_SPLITS.HIDDEN_TEST,
    [BENCHMARK_ROLES.STANDARDS_GUIDANCE]: DATASET_SPLITS.UNASSIGNED,
  }[benchmarkRole];
  if (!expected) throw contractError("benchmark_role_invalid", "Unsupported benchmark document role.");
  if (datasetSplit !== expected) {
    throw contractError(
      "benchmark_role_split_mismatch",
      `Benchmark role ${benchmarkRole} requires dataset split ${expected}.`,
    );
  }
  return true;
}

export function validateTruthFactContract(fact, answerability) {
  if (!nonEmpty(fact?.factType) || !nonEmpty(fact?.sectionKey)) {
    throw contractError("truth_fact_identity_required", "Truth facts require a fact type and canonical section key.");
  }
  if (!nonEmpty(fact?.sourceDocumentId) || !Array.isArray(fact?.sourceBlockIds) || fact.sourceBlockIds.length === 0) {
    throw contractError(
      "truth_fact_provenance_required",
      "Truth facts require an approved source document and at least one source block ID.",
    );
  }
  if (!Object.values(ANSWERABILITY_CLASSES).includes(answerability?.answerabilityClass)) {
    throw contractError("truth_answerability_invalid", "Truth facts require a supported answerability class.");
  }
  if (
    answerability.answerabilityClass === ANSWERABILITY_CLASSES.GOLD_ONLY_UNOBSERVABLE
    && answerability.requiredFact
  ) {
    throw contractError(
      "unobservable_fact_cannot_be_required",
      "Gold-only unobservable facts cannot reduce required-fact recall.",
    );
  }
  if (!nonEmpty(answerability?.expectedGeneratorBehavior)) {
    throw contractError(
      "truth_expected_behavior_required",
      "Every answerability label must define expected generator behavior.",
    );
  }
  return true;
}

export function createTrainingHarnessService({ db, createError }) {
  return {
    approveCaptureVariant,
    completeCaptureVariantRoundTrip,
    approveTruthCase,
    acceptAutomatedTruthDraft,
    buildCaptureVariantManifest,
    buildTruthGraphManifest,
    createCaptureVariants,
    createBenchmarkSnapshot,
    createTruthCaseFromApprovedSource,
    getCaptureVariant,
    getCaptureVariantBuilderState,
    registerBenchmarkDocument,
    createTrainingCase,
    getTruthCaseBuilderState,
    getTruthCase,
    upsertTruthFact,
    getTrainingCase,
    proposeTruthFacts,
    reviewTruthFact,
    lockBenchmarkSnapshot,
  };

  async function getCaptureVariantBuilderState() {
    const [profileRows, truthCaseRows, variantRows] = await Promise.all([
      db.prepare(
        `SELECT * FROM report_capture_profile_versions
        WHERE status_code = 'active'
        ORDER BY profile_code, version_number DESC`,
      ).all(),
      db.prepare(
        `SELECT tc.*,
          COUNT(f.fact_id) FILTER (
            WHERE f.review_status = 'approved'
              AND a.review_status = 'approved'
              AND a.answerability_class IN ('app_observable', 'voice_observable')
          ) AS materializable_fact_count
        FROM report_training_cases tc
        LEFT JOIN report_training_case_facts f ON f.training_case_id = tc.training_case_id
        LEFT JOIN report_training_case_answerability a ON a.fact_id = f.fact_id
        WHERE tc.status_code = 'case_approved'
        GROUP BY tc.training_case_id
        ORDER BY tc.approved_at_iso DESC`,
      ).all(),
      db.prepare(
        `SELECT v.*, p.profile_code, p.display_name AS profile_display_name,
          p.description AS profile_description, p.config_json AS profile_config_json
        FROM report_capture_variants v
        JOIN report_capture_profile_versions p ON p.profile_version_id = v.profile_version_id
        ORDER BY v.created_at_iso DESC, p.profile_code, v.random_seed`,
      ).all(),
    ]);
    const latestVariantRows = [];
    const seenVariantKeys = new Set();
    for (const row of variantRows) {
      const key = `${row.training_case_id}:${row.profile_version_id}:${row.random_seed}`;
      if (seenVariantKeys.has(key)) continue;
      seenVariantKeys.add(key);
      latestVariantRows.push(row);
    }
    const variants = latestVariantRows.map(mapCaptureVariantSummary);
    return {
      generatedAtIso: new Date().toISOString(),
      summary: {
        approvedTruthCases: truthCaseRows.length,
        activeProfiles: profileRows.length,
        variants: variants.length,
        reviewRequired: variants.filter((variant) => variant.status === "review_required").length,
        approved: variants.filter((variant) => variant.status === "approved").length,
        materialized: variants.filter((variant) => variant.status === "materialized").length,
      },
      profiles: profileRows.map(mapCaptureProfile),
      truthCases: truthCaseRows.map((row) => ({
        ...mapTruthCaseSummary(row),
        materializableFactCount: Number(row.materializable_fact_count ?? 0),
      })),
      variants,
    };
  }

  async function createCaptureVariants({
    actorUserId,
    trainingCaseId,
    profileCodes = [],
    seeds = [1, 2],
  }) {
    const truthCase = await requireApprovedTruthCase(trainingCaseId);
    const normalizedSeeds = [...new Set(seeds.map(Number))];
    if (
      normalizedSeeds.length === 0
      || normalizedSeeds.length > 8
      || normalizedSeeds.some((seed) => !Number.isInteger(seed) || seed < 1 || seed > 1_000_000)
    ) {
      throw apiError(400, "Choose between one and eight positive deterministic seeds.", "capture_variant_seed_invalid");
    }
    const profiles = await db.prepare(
      `SELECT * FROM report_capture_profile_versions
      WHERE status_code = 'active'
      ORDER BY profile_code`,
    ).all();
    const requestedCodes = profileCodes.length > 0
      ? new Set(profileCodes.map((value) => String(value).trim()))
      : new Set(profiles.map((profile) => profile.profile_code));
    const selectedProfiles = profiles.filter((profile) => requestedCodes.has(profile.profile_code));
    if (selectedProfiles.length !== requestedCodes.size || selectedProfiles.length === 0) {
      throw apiError(400, "One or more capture profiles are unavailable.", "capture_profile_invalid");
    }
    const facts = await db.prepare(
      `SELECT f.*, a.answerability_class, a.required_fact,
        a.expected_generator_behavior, a.review_status AS answerability_review_status
      FROM report_training_case_facts f
      JOIN report_training_case_answerability a ON a.fact_id = f.fact_id
      WHERE f.training_case_id = ?
        AND f.review_status = 'approved'
        AND a.review_status = 'approved'
      ORDER BY f.section_key, f.fact_id`,
    ).all(trainingCaseId);
    if (!facts.some((fact) => ["app_observable", "voice_observable"].includes(fact.answerability_class))) {
      throw apiError(
        409,
        "This Truth Case has no approved app-observable or voice-observable facts.",
        "capture_variant_observable_facts_required",
      );
    }

    for (const profile of selectedProfiles) {
      for (const seed of normalizedSeeds) {
        const existing = await db.prepare(
          `SELECT variant_id FROM report_capture_variants
          WHERE training_case_id = ? AND profile_version_id = ?
            AND random_seed = ? AND variant_version = ?`,
        ).get(trainingCaseId, profile.profile_version_id, seed, CAPTURE_SCENARIO_VERSION);
        if (existing) continue;
        const scenario = buildCaptureVariantScenario({ truthCase, profile, seed, facts });
        const scenarioValidation = validateCaptureVariantScenario(scenario, profile.lane_code);
        const nowIso = new Date().toISOString();
        await db.transaction(async () => {
          await db.prepare(
            `INSERT INTO report_capture_variants (
              variant_id, training_case_id, profile_version_id, variant_version,
              random_seed, dataset_split, lane_code, status_code, manifest_json,
              included_fact_count, withheld_fact_count, transformed_fact_count,
              expected_missing_inputs_json, validation_json, created_by_user_id,
              created_at_iso, updated_at_iso
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'review_required', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            scenario.variantId,
            trainingCaseId,
            profile.profile_version_id,
            CAPTURE_SCENARIO_VERSION,
            seed,
            truthCase.dataset_split,
            profile.lane_code,
            JSON.stringify(scenario.manifest),
            scenario.includedCount,
            scenario.withheldCount,
            scenario.transformedCount,
            JSON.stringify(scenario.expectedMissingInputs),
            JSON.stringify({
              status: "scenario_valid",
              ...scenarioValidation,
              finalV3ContractStatus: "awaiting_app_round_trip",
            }),
            actorUserId,
            nowIso,
            nowIso,
          );
          for (const link of scenario.links) {
            await db.prepare(
              `INSERT INTO report_capture_variant_fact_links (
                variant_id, training_case_id, fact_id, disposition_code,
                capture_channel, transformation_json, stable_order, created_at_iso
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ).run(
              scenario.variantId,
              trainingCaseId,
              link.factId,
              link.disposition,
              link.captureChannel,
              JSON.stringify(link.transformation),
              link.stableOrder,
              nowIso,
            );
          }
        });
      }
    }
    return getCaptureVariantBuilderState();
  }

  async function getCaptureVariant(variantId) {
    const row = await db.prepare(
      `SELECT v.*, p.profile_code, p.display_name AS profile_display_name,
        p.description AS profile_description, p.config_json AS profile_config_json
      FROM report_capture_variants v
      JOIN report_capture_profile_versions p ON p.profile_version_id = v.profile_version_id
      WHERE v.variant_id = ?`,
    ).get(variantId);
    if (!row) return null;
    const links = await db.prepare(
      `SELECT l.*, f.fact_type, f.section_key, f.normalized_value_json,
        f.unit_code, f.evidence_class, f.capture_destination,
        f.safety_criticality, a.required_fact, a.answerability_class
      FROM report_capture_variant_fact_links l
      JOIN report_training_case_facts f ON f.fact_id = l.fact_id
      JOIN report_training_case_answerability a ON a.fact_id = f.fact_id
      WHERE l.variant_id = ?
      ORDER BY l.stable_order, l.fact_id`,
    ).all(variantId);
    return {
      variant: mapCaptureVariantSummary(row),
      manifest: parseJson(row.manifest_json),
      validation: parseJson(row.validation_json),
      links: links.map(mapCaptureVariantFactLink),
    };
  }

  async function buildCaptureVariantManifest(variantId) {
    const detail = await getCaptureVariant(variantId);
    if (!detail) throw apiError(404, "Capture Variant was not found.", "capture_variant_not_found");
    if (detail.variant.status !== "review_required") {
      throw apiError(409, "Only a reviewed draft Capture Variant can be approved.", "capture_variant_not_reviewable");
    }
    return detail.manifest;
  }

  async function approveCaptureVariant({ actorUserId, variantId, scenarioObjectKey, scenarioSha256 }) {
    if (!nonEmpty(scenarioObjectKey) || !SHA256_PATTERN.test(String(scenarioSha256 ?? ""))) {
      throw apiError(400, "Capture Scenario object identity is required.", "capture_variant_artifact_required");
    }
    const current = await db.prepare(
      "SELECT status_code FROM report_capture_variants WHERE variant_id = ?",
    ).get(variantId);
    if (!current) throw apiError(404, "Capture Variant was not found.", "capture_variant_not_found");
    if (current.status_code !== "review_required") {
      throw apiError(409, "Only a review-required Capture Variant can be approved.", "capture_variant_not_reviewable");
    }
    const nowIso = new Date().toISOString();
    await db.prepare(
      `UPDATE report_capture_variants
      SET status_code = 'approved', scenario_object_key = ?, scenario_sha256 = ?,
        approved_by_user_id = ?, approved_at_iso = ?, updated_at_iso = ?
      WHERE variant_id = ?`,
    ).run(scenarioObjectKey, scenarioSha256, actorUserId, nowIso, nowIso, variantId);
    return getCaptureVariant(variantId);
  }

  async function completeCaptureVariantRoundTrip({ variantId, appReportJobId, appSourceObjectKey, appSourceSha256, appPackageSha256, validation }) {
    if (![appSourceSha256, appPackageSha256].every((value) => SHA256_PATTERN.test(String(value ?? "")))) {
      throw apiError(400, "App round-trip object hashes are required.", "capture_variant_round_trip_hash_required");
    }
    const current = await db.prepare(
      "SELECT status_code, validation_json FROM report_capture_variants WHERE variant_id = ?",
    ).get(variantId);
    if (!current) throw apiError(404, "Capture Variant was not found.", "capture_variant_not_found");
    if (current.status_code === "materialized") return getCaptureVariant(variantId);
    if (!["approved", "round_trip_ready"].includes(current.status_code)) {
      throw apiError(409, "Capture Variant must be truth-validated before app round trip.", "capture_variant_not_round_trip_ready");
    }
    const nowIso = new Date().toISOString();
    const nextValidation = {
      ...parseJson(current.validation_json),
      ...validation,
      finalV3ContractStatus: "materialized",
      appRoundTripCompletedAtIso: nowIso,
    };
    await db.prepare(
      `UPDATE report_capture_variants
      SET status_code = 'materialized', app_report_job_id = ?,
        app_source_object_key = ?, app_source_sha256 = ?, app_package_sha256 = ?,
        validation_json = ?, updated_at_iso = ?
      WHERE variant_id = ?`,
    ).run(appReportJobId, appSourceObjectKey, appSourceSha256, appPackageSha256, JSON.stringify(nextValidation), nowIso, variantId);
    return getCaptureVariant(variantId);
  }

  async function getTruthCaseBuilderState() {
    const [sourceRows, caseRows] = await Promise.all([
      db.prepare(
        `SELECT
          d.document_id,
          d.case_id,
          d.document_role,
          d.dataset_split,
          d.source_sha256,
          d.source_object_key,
          d.metadata_json,
          d.approved_at_iso,
          c.report_family,
          COUNT(DISTINCT s.section_id) AS section_count,
          COUNT(DISTINCT k.chunk_id) AS chunk_count
        FROM kb_documents d
        JOIN kb_cases c ON c.case_id = d.case_id
        LEFT JOIN kb_sections s ON s.document_id = d.document_id
        LEFT JOIN kb_chunks k ON k.document_id = d.document_id
        WHERE d.approval_status = 'approved'
          AND d.source_object_key IS NOT NULL
          AND d.document_type = 'historical_report'
          AND d.document_role IN ('historical_source', 'evaluation_gold')
          AND d.dataset_split IN ('training', 'validation', 'hidden_test')
        GROUP BY d.document_id, c.case_id
        HAVING COUNT(DISTINCT k.chunk_id) > 0
        ORDER BY d.approved_at_iso DESC NULLS LAST, d.updated_at_iso DESC`,
      ).all(),
      db.prepare(
        `SELECT
          tc.*,
          d.metadata_json AS document_metadata_json,
          d.source_sha256,
          COUNT(f.fact_id) AS fact_count,
          COUNT(f.fact_id) FILTER (WHERE f.review_status = 'machine_proposed') AS proposed_count,
          COUNT(f.fact_id) FILTER (WHERE f.review_status = 'human_reviewed') AS reviewed_count,
          COUNT(f.fact_id) FILTER (WHERE f.review_status = 'approved') AS approved_count,
          COUNT(f.fact_id) FILTER (WHERE f.review_status = 'rejected') AS rejected_count
        FROM report_training_cases tc
        JOIN kb_documents d ON d.document_id = tc.gold_document_id
        LEFT JOIN report_training_case_facts f ON f.training_case_id = tc.training_case_id
        GROUP BY tc.training_case_id, d.document_id
        ORDER BY tc.updated_at_iso DESC`,
      ).all(),
    ]);
    const truthCases = caseRows.map(mapTruthCaseSummary);
    const truthCaseByDocument = new Map(truthCases.map((item) => [item.goldDocumentId, item]));
    const sources = await Promise.all(sourceRows.map(async (row) => {
      const source = mapTruthSource(row, truthCaseByDocument.get(row.document_id));
      if (source.evidenceAsOfCandidate) return source;
      const dateChunks = await db.prepare(
        `SELECT content FROM kb_chunks
        WHERE document_id = ?
          AND content ~* '(date inspected|inspection date|date completed|report date|issue date)'
        ORDER BY stable_order
        LIMIT 40`,
      ).all(row.document_id);
      return {
        ...source,
        evidenceAsOfCandidate: inferHistoricalEvidenceDateFromText(
          dateChunks.map((chunk) => chunk.content).join("\n"),
        ),
      };
    }));
    return {
      generatedAtIso: new Date().toISOString(),
      summary: {
        approvedSources: sources.length,
        truthCases: truthCases.length,
        reviewRequired: truthCases.filter((item) => item.status === "truth_review_required").length,
        approvedTruthCases: truthCases.filter((item) => item.status === "case_approved").length,
      },
      sources,
      truthCases,
    };
  }

  async function createTruthCaseFromApprovedSource({
    actorUserId,
    documentId,
    benchmarkTrack = BENCHMARK_TRACKS.OPERATIONAL_HISTORY,
    evidenceAsOf = null,
    assetLineageKey = null,
    truthGraphVersion = 1,
  }) {
    if (!Number.isInteger(truthGraphVersion) || truthGraphVersion < 1) {
      throw apiError(400, "Truth Graph version must be a positive integer.", "truth_graph_version_invalid");
    }
    const document = await db.prepare(
      `SELECT d.*, c.report_family, c.tenant_id AS case_tenant_id,
        c.workspace_id AS case_workspace_id
      FROM kb_documents d
      JOIN kb_cases c ON c.case_id = d.case_id
      WHERE d.document_id = ?`,
    ).get(documentId);
    if (!document) throw apiError(404, "Approved historical source was not found.", "truth_source_not_found");
    if (
      document.approval_status !== "approved"
      || !document.source_object_key
      || !SHA256_PATTERN.test(String(document.source_sha256 ?? ""))
    ) {
      throw apiError(
        409,
        "Approve and immutably store this historical source before building a Truth Case.",
        "truth_source_not_approved",
      );
    }
    if (
      document.document_type !== "historical_report"
      || !["historical_source", "evaluation_gold"].includes(document.document_role)
    ) {
      throw apiError(
        409,
        "Truth Cases require an approved historical report, not a standards or specialist source.",
        "truth_source_role_invalid",
      );
    }
    if (![DATASET_SPLITS.TRAINING, DATASET_SPLITS.VALIDATION, DATASET_SPLITS.HIDDEN_TEST].includes(document.dataset_split)) {
      throw apiError(409, "Assign a training, validation, or hidden-test split first.", "truth_source_split_required");
    }
    if (!Object.values(BENCHMARK_TRACKS).includes(benchmarkTrack)) {
      throw apiError(400, "Unsupported benchmark track.", "training_track_invalid");
    }
    if (benchmarkTrack === BENCHMARK_TRACKS.ASSET_GENERALIZATION && !nonEmpty(assetLineageKey)) {
      throw apiError(400, "Asset-generalization cases require asset lineage.", "training_asset_lineage_required");
    }
    const chunkCount = await db.prepare(
      "SELECT COUNT(*) AS count FROM kb_chunks WHERE document_id = ?",
    ).get(documentId);
    if (Number(chunkCount?.count ?? 0) === 0) {
      throw apiError(409, "The approved source has no extracted chunks.", "truth_source_chunks_required");
    }
    const existing = await db.prepare(
      `SELECT tc.training_case_id FROM report_training_cases tc
      JOIN report_benchmark_snapshots s ON s.snapshot_id=tc.snapshot_id
      WHERE tc.gold_document_id = ? AND tc.benchmark_track = ? AND s.version_number=?`,
    ).get(documentId, benchmarkTrack, truthGraphVersion);
    if (existing) return getTruthCase(existing.training_case_id);

    const metadata = parseJson(document.metadata_json);
    let evidenceAsOfIso = normalizeIso(evidenceAsOf) ?? inferHistoricalEvidenceDate(metadata);
    if (!evidenceAsOfIso) {
      const dateChunks = await db.prepare(
        `SELECT content FROM kb_chunks
        WHERE document_id = ?
          AND content ~* '(date inspected|inspection date|date completed|report date|issue date)'
        ORDER BY stable_order
        LIMIT 40`,
      ).all(documentId);
      evidenceAsOfIso = inferHistoricalEvidenceDateFromText(
        dateChunks.map((chunk) => chunk.content).join("\n"),
      );
    }
    if (!evidenceAsOfIso) {
      throw apiError(
        409,
        "Confirm the historical report issue or inspection date before building this Truth Case.",
        "truth_evidence_date_required",
      );
    }
    const snapshotName = `truth-case-${document.case_id}-${benchmarkTrack}`;
    let snapshot = await db.prepare(
      `SELECT * FROM report_benchmark_snapshots
      WHERE snapshot_name = ? AND version_number = ?`,
    ).get(snapshotName,truthGraphVersion);
    if (!snapshot) {
      const created = await createBenchmarkSnapshot({
        actorUserId,
        snapshotName,
        versionNumber: truthGraphVersion,
        tenantId: document.tenant_id ?? document.case_tenant_id,
        workspaceId: document.workspace_id ?? document.case_workspace_id,
        metadata: { builder: "truth_case_builder", primaryDocumentId: document.document_id },
      });
      snapshot = created.snapshot;
    }
    const benchmarkRole = benchmarkRoleForSplit(document.dataset_split);
    await registerBenchmarkDocument({
      snapshotId: snapshot.snapshot_id,
      documentId: document.document_id,
      benchmarkRole,
      datasetSplit: document.dataset_split,
      evidenceIssuedAt: evidenceAsOfIso,
      assetLineageKey,
      metadata: { sourceRole: "gold_primary", builder: "truth_case_builder" },
    });
    const created = await createTrainingCase({
      actorUserId,
      snapshotId: snapshot.snapshot_id,
      goldDocumentId: document.document_id,
      displayName: sourceDisplayName(document),
      reportFamily: document.report_family,
      benchmarkTrack,
      evidenceAsOf: evidenceAsOfIso,
      assetLineageKey,
      metadata: { builder: "truth_case_builder", sourceCaseId: document.case_id },
      truthGraphVersion,
    });
    return getTruthCase(created.trainingCase.training_case_id);
  }

  async function proposeTruthFacts({ actorUserId, trainingCaseId }) {
    const trainingCase = await requireEditableTruthCase(trainingCaseId);
    const chunks = await db.prepare(
      `SELECT
        c.chunk_id,
        c.block_type,
        c.content,
        c.stable_order,
        c.page_numbers_json,
        c.source_block_ids_json,
        c.source_spans_json,
        s.section_key,
        s.original_heading,
        s.stable_order AS section_order
      FROM kb_chunks c
      JOIN kb_sections s
        ON s.document_id = c.document_id
        AND s.section_key = c.section_type
      WHERE c.document_id = ?
      ORDER BY s.stable_order, c.stable_order`,
    ).all(trainingCase.gold_document_id);
    if (chunks.length === 0) {
      throw apiError(409, "The Truth Case source has no extracted chunks.", "truth_source_chunks_required");
    }
    await db.prepare(
      `UPDATE report_training_cases
      SET status_code = 'truth_extracting', updated_at_iso = ?
      WHERE training_case_id = ?`,
    ).run(new Date().toISOString(), trainingCaseId);

    const seenProposalSignatures = new Set();
    for (const chunk of chunks) {
      const proposals = proposeTruthFactsFromChunk({
        chunk,
        documentId: trainingCase.gold_document_id,
        trainingCaseId,
      });
      for (const proposal of proposals) {
        const signature = truthProposalSignature(proposal);
        if (seenProposalSignatures.has(signature)) continue;
        seenProposalSignatures.add(signature);
        const current = await db.prepare(
          "SELECT review_status FROM report_training_case_facts WHERE fact_id = ?",
        ).get(proposal.fact.factId);
        if (current && current.review_status !== "machine_proposed") continue;
        await upsertTruthFact({ actorUserId, trainingCaseId, ...proposal });
      }
    }
    await db.prepare(
      `UPDATE report_training_cases
      SET status_code = 'truth_review_required', updated_at_iso = ?
      WHERE training_case_id = ?`,
    ).run(new Date().toISOString(), trainingCaseId);
    return getTruthCase(trainingCaseId);
  }

  async function reviewTruthFact({ actorUserId, trainingCaseId, factId, values }) {
    await requireEditableTruthCase(trainingCaseId);
    const existing = await db.prepare(
      `SELECT f.*, a.answerability_class, a.required_fact,
        a.expected_generator_behavior, a.review_status AS answerability_review_status
      FROM report_training_case_facts f
      JOIN report_training_case_answerability a ON a.fact_id = f.fact_id
      WHERE f.training_case_id = ? AND f.fact_id = ?`,
    ).get(trainingCaseId, factId);
    if (!existing) throw apiError(404, "Truth fact was not found.", "truth_fact_not_found");
    const reviewStatus = String(values.reviewStatus ?? "human_reviewed");
    if (!TRUTH_FACT_REVIEW_STATES.has(reviewStatus)) {
      throw apiError(400, "Unsupported truth-fact review status.", "truth_fact_review_status_invalid");
    }
    const normalizedValue = values.normalizedValue ?? parseJson(existing.normalized_value_json);
    await upsertTruthFact({
      actorUserId,
      trainingCaseId,
      fact: {
        factId,
        factType: values.factType ?? existing.fact_type,
        sectionKey: values.sectionKey ?? existing.section_key,
        normalizedValue,
        unitCode: values.unitCode ?? existing.unit_code,
        sourceDocumentId: existing.source_document_id,
        sourcePageNumber: existing.source_page_number,
        sourceBlockIds: parseJson(existing.source_block_ids_json, []),
        sourceBbox: parseJson(existing.source_bbox_json, null),
        sourceConfidence: existing.source_confidence,
        evidenceClass: values.evidenceClass ?? existing.evidence_class,
        captureDestination: values.captureDestination ?? existing.capture_destination,
        safetyCriticality: values.safetyCriticality ?? existing.safety_criticality,
        reviewStatus,
      },
      answerability: {
        answerabilityClass: values.answerabilityClass ?? existing.answerability_class,
        requiredFact: values.requiredFact ?? Boolean(existing.required_fact),
        expectedGeneratorBehavior:
          values.expectedGeneratorBehavior ?? existing.expected_generator_behavior,
        reviewStatus,
      },
    });
    return getTruthCase(trainingCaseId);
  }

  async function buildTruthGraphManifest(trainingCaseId) {
    const detail = await getTrainingCase(trainingCaseId);
    if (!detail) throw apiError(404, "Truth Case was not found.", "training_case_not_found");
    await assertTruthCaseApprovalReady(trainingCaseId);
    const approvedFacts = detail.facts
      .filter((fact) => fact.review_status === "approved" && fact.answerability_review_status === "approved")
      .map(mapTruthGraphFact);
    return {
      schema: "laiq.truth-graph",
      schemaVersion: 1,
      truthCaseId: detail.trainingCase.training_case_id,
      truthGraphVersion: Number(detail.trainingCase.truth_graph_version),
      benchmarkSnapshotId: detail.trainingCase.snapshot_id,
      reportFamily: detail.trainingCase.report_family,
      datasetSplit: detail.trainingCase.dataset_split,
      benchmarkTrack: detail.trainingCase.benchmark_track,
      evidenceAsOf: detail.trainingCase.evidence_as_of,
      sourceLineage: detail.sources.map((source) => ({
        documentId: source.document_id,
        role: source.source_role,
        sha256: source.source_sha256,
        objectKey: source.source_object_key,
      })),
      facts: approvedFacts,
      createdAtIso: new Date().toISOString(),
    };
  }

  async function acceptAutomatedTruthDraft({ actorUserId, trainingCaseId }) {
    await requireEditableTruthCase(trainingCaseId);
    const nowIso = new Date().toISOString();
    await db.transaction(async () => {
      await db.prepare(
        `UPDATE report_training_case_facts
        SET review_status = 'approved', reviewed_by_user_id = ?,
          reviewed_at_iso = ?, updated_at_iso = ?
        WHERE training_case_id = ?
          AND review_status IN ('machine_proposed', 'human_reviewed')`,
      ).run(actorUserId, nowIso, nowIso, trainingCaseId);
      await db.prepare(
        `UPDATE report_training_case_answerability
        SET review_status = 'approved', reviewed_by_user_id = ?,
          reviewed_at_iso = ?, updated_at_iso = ?
        WHERE training_case_id = ?
          AND review_status IN ('machine_proposed', 'human_reviewed')`,
      ).run(actorUserId, nowIso, nowIso, trainingCaseId);
    });
    return getTruthCase(trainingCaseId);
  }

  async function approveTruthCase({ actorUserId, trainingCaseId, truthGraphObjectKey, truthGraphSha256 }) {
    const trainingCase = await requireEditableTruthCase(trainingCaseId);
    if (!nonEmpty(truthGraphObjectKey) || !SHA256_PATTERN.test(String(truthGraphSha256 ?? ""))) {
      throw apiError(400, "Truth Graph object identity is required.", "truth_graph_artifact_required");
    }
    await assertTruthCaseApprovalReady(trainingCaseId);
    const nowIso = new Date().toISOString();
    await db.transaction(async () => {
      await db.prepare(
        `UPDATE report_training_cases
        SET status_code = 'case_approved', truth_graph_object_key = ?, truth_graph_sha256 = ?,
          approved_by_user_id = ?, approved_at_iso = ?, updated_at_iso = ?
        WHERE training_case_id = ?`,
      ).run(truthGraphObjectKey, truthGraphSha256, actorUserId, nowIso, nowIso, trainingCaseId);
      await db.prepare(
        `UPDATE report_benchmark_snapshots
        SET status_code = 'locked', manifest_object_key = ?, manifest_sha256 = ?,
          locked_by_user_id = ?, locked_at_iso = ?, updated_at_iso = ?
        WHERE snapshot_id = ?`,
      ).run(
        truthGraphObjectKey,
        truthGraphSha256,
        actorUserId,
        nowIso,
        nowIso,
        trainingCase.snapshot_id,
      );
    });
    return getTruthCase(trainingCaseId);
  }

  async function assertTruthCaseApprovalReady(trainingCaseId) {
    const review = await db.prepare(
      `SELECT
        COUNT(*) AS fact_count,
        COUNT(*) FILTER (WHERE f.review_status = 'approved' AND a.review_status = 'approved') AS approved_count,
        COUNT(*) FILTER (WHERE f.review_status IN ('machine_proposed', 'human_reviewed')) AS unresolved_count,
        COUNT(*) FILTER (WHERE f.review_status = 'approved' AND a.review_status <> 'approved') AS answerability_unresolved_count
      FROM report_training_case_facts f
      LEFT JOIN report_training_case_answerability a ON a.fact_id = f.fact_id
      WHERE f.training_case_id = ?`,
    ).get(trainingCaseId);
    if (Number(review?.approved_count ?? 0) === 0) {
      throw apiError(409, "Approve at least one source-grounded fact first.", "truth_case_approved_fact_required");
    }
    if (Number(review?.unresolved_count ?? 0) > 0 || Number(review?.answerability_unresolved_count ?? 0) > 0) {
      throw apiError(
        409,
        "Approve or reject every proposed fact and answerability label before approving the Truth Case.",
        "truth_case_review_incomplete",
      );
    }
  }

  async function createBenchmarkSnapshot({
    actorUserId,
    snapshotName,
    versionNumber,
    tenantId = null,
    workspaceId = null,
    metadata = {},
  }) {
    if (!nonEmpty(snapshotName) || !Number.isInteger(versionNumber) || versionNumber < 1) {
      throw apiError(400, "Benchmark name and positive version number are required.", "benchmark_identity_invalid");
    }
    const snapshotId = randomUUID();
    const nowIso = new Date().toISOString();
    await db.prepare(
      `INSERT INTO report_benchmark_snapshots (
        snapshot_id, tenant_id, workspace_id, snapshot_name, version_number,
        status_code, metadata_json, created_by_user_id, created_at_iso, updated_at_iso
      ) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
    ).run(
      snapshotId,
      tenantId,
      workspaceId,
      snapshotName.trim(),
      versionNumber,
      JSON.stringify(metadata),
      actorUserId,
      nowIso,
      nowIso,
    );
    return getSnapshot(snapshotId);
  }

  async function registerBenchmarkDocument({
    snapshotId,
    documentId,
    benchmarkRole,
    datasetSplit,
    evidenceIssuedAt,
    assetLineageKey = null,
    metadata = {},
  }) {
    validateBenchmarkDocumentRole({ benchmarkRole, datasetSplit });
    const snapshot = await requireMutableSnapshot(snapshotId);
    const document = await db.prepare(
      `SELECT document_id, case_id, rendition_id, source_sha256, source_object_key,
        approval_status, retrieval_eligible
      FROM kb_documents WHERE document_id = ?`,
    ).get(documentId);
    if (!document) throw apiError(404, "KB document was not found.", "benchmark_document_not_found");
    if (document.approval_status !== "approved" || !document.source_object_key) {
      throw apiError(
        409,
        "Only approved KB documents with immutable source objects can enter a benchmark snapshot.",
        "benchmark_document_not_approved",
      );
    }
    if (!document.case_id || !document.rendition_id || !SHA256_PATTERN.test(document.source_sha256)) {
      throw apiError(409, "KB document lineage is incomplete.", "benchmark_document_lineage_incomplete");
    }
    const issuedAtIso = normalizeIso(evidenceIssuedAt);
    if (!issuedAtIso) throw apiError(400, "A valid evidence issue timestamp is required.", "benchmark_issue_time_required");
    if (
      [BENCHMARK_ROLES.VALIDATION_GOLD, BENCHMARK_ROLES.HIDDEN_TEST_GOLD].includes(benchmarkRole)
      && document.retrieval_eligible
    ) {
      throw apiError(409, "Validation and hidden-test gold must not be retrieval eligible.", "benchmark_gold_retrieval_conflict");
    }
    await db.prepare(
      `INSERT INTO report_benchmark_documents (
        snapshot_id, document_id, benchmark_role, dataset_split, source_case_id,
        source_rendition_id, source_sha256, source_object_key, evidence_issued_at,
        asset_lineage_key, metadata_json, created_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (snapshot_id, document_id) DO UPDATE SET
        benchmark_role = excluded.benchmark_role,
        dataset_split = excluded.dataset_split,
        evidence_issued_at = excluded.evidence_issued_at,
        asset_lineage_key = excluded.asset_lineage_key,
        metadata_json = excluded.metadata_json`,
    ).run(
      snapshot.snapshot_id,
      document.document_id,
      benchmarkRole,
      datasetSplit,
      document.case_id,
      document.rendition_id,
      document.source_sha256,
      document.source_object_key,
      issuedAtIso,
      assetLineageKey,
      JSON.stringify(metadata),
      new Date().toISOString(),
    );
    return getSnapshot(snapshotId);
  }

  async function createTrainingCase({
    actorUserId,
    snapshotId,
    goldDocumentId,
    displayName,
    reportFamily,
    benchmarkTrack,
    evidenceAsOf,
    assetLineageKey = null,
    metadata = {},
    truthGraphVersion = 1,
  }) {
    await requireMutableSnapshot(snapshotId);
    const gold = await db.prepare(
      "SELECT * FROM report_benchmark_documents WHERE snapshot_id = ? AND document_id = ?",
    ).get(snapshotId, goldDocumentId);
    if (!gold) throw apiError(404, "Gold benchmark document was not found.", "training_gold_not_found");
    if (![BENCHMARK_ROLES.TRAINING_GOLD, BENCHMARK_ROLES.VALIDATION_GOLD, BENCHMARK_ROLES.HIDDEN_TEST_GOLD].includes(gold.benchmark_role)) {
      throw apiError(409, "Truth Cases require a gold benchmark document.", "training_gold_role_required");
    }
    if (!Object.values(BENCHMARK_TRACKS).includes(benchmarkTrack)) {
      throw apiError(400, "Unsupported benchmark track.", "training_track_invalid");
    }
    if (benchmarkTrack === BENCHMARK_TRACKS.ASSET_GENERALIZATION && !nonEmpty(assetLineageKey)) {
      throw apiError(400, "Asset-generalization cases require asset lineage.", "training_asset_lineage_required");
    }
    const evidenceAsOfIso = normalizeIso(evidenceAsOf);
    if (!evidenceAsOfIso) throw apiError(400, "A valid evidenceAsOf timestamp is required.", "training_cutoff_required");
    const trainingCaseId = randomUUID();
    const nowIso = new Date().toISOString();
    await db.transaction(async () => {
      await db.prepare(
        `INSERT INTO report_training_cases (
          training_case_id, snapshot_id, gold_document_id, display_name,
          report_family, dataset_split, benchmark_track, evidence_as_of,
          asset_lineage_key, status_code, truth_graph_version, metadata_json, created_by_user_id,
          created_at_iso, updated_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'source_approved', ?, ?, ?, ?, ?)`,
      ).run(
        trainingCaseId,
        snapshotId,
        goldDocumentId,
        displayName,
        reportFamily,
        gold.dataset_split,
        benchmarkTrack,
        evidenceAsOfIso,
        assetLineageKey,
        truthGraphVersion,
        JSON.stringify(metadata),
        actorUserId,
        nowIso,
        nowIso,
      );
      await db.prepare(
        `INSERT INTO report_training_case_sources (
          training_case_id, document_id, source_role, source_sha256,
          source_object_key, metadata_json, created_at_iso
        ) VALUES (?, ?, 'gold_primary', ?, ?, '{}'::jsonb, ?)`,
      ).run(trainingCaseId, goldDocumentId, gold.source_sha256, gold.source_object_key, nowIso);
    });
    return getTrainingCase(trainingCaseId);
  }

  async function lockBenchmarkSnapshot({
    actorUserId,
    snapshotId,
    manifestObjectKey,
    manifestSha256,
  }) {
    await requireMutableSnapshot(snapshotId);
    if (!nonEmpty(manifestObjectKey) || !SHA256_PATTERN.test(String(manifestSha256 ?? ""))) {
      throw apiError(
        400,
        "Locking a benchmark requires its immutable manifest object key and SHA-256.",
        "benchmark_manifest_required",
      );
    }
    const documentCount = await db.prepare(
      "SELECT COUNT(*) AS count FROM report_benchmark_documents WHERE snapshot_id = ?",
    ).get(snapshotId);
    if (Number(documentCount?.count ?? 0) === 0) {
      throw apiError(409, "A benchmark cannot be locked without documents.", "benchmark_documents_required");
    }
    const nowIso = new Date().toISOString();
    await db.prepare(
      `UPDATE report_benchmark_snapshots
      SET status_code = 'locked', manifest_object_key = ?, manifest_sha256 = ?,
        locked_by_user_id = ?, locked_at_iso = ?, updated_at_iso = ?
      WHERE snapshot_id = ?`,
    ).run(manifestObjectKey, manifestSha256, actorUserId, nowIso, nowIso, snapshotId);
    return getSnapshot(snapshotId);
  }

  async function upsertTruthFact({ actorUserId, trainingCaseId, fact, answerability }) {
    try {
      validateTruthFactContract(fact, answerability);
    } catch (error) {
      throw apiError(400, error.message, error.code);
    }
    const trainingCase = await db.prepare(
      `SELECT tc.*, s.status_code AS snapshot_status
      FROM report_training_cases tc
      JOIN report_benchmark_snapshots s ON s.snapshot_id = tc.snapshot_id
      WHERE tc.training_case_id = ?`,
    ).get(trainingCaseId);
    if (!trainingCase) throw apiError(404, "Truth Case was not found.", "training_case_not_found");
    if (["locked", "retired"].includes(trainingCase.snapshot_status)) {
      throw apiError(409, "Locked benchmark truth cannot be edited.", "training_snapshot_locked");
    }
    if (!EDITABLE_TRUTH_CASE_STATES.has(trainingCase.status_code)) {
      throw apiError(409, "Approved or retired Truth Cases cannot be edited.", "truth_case_locked");
    }
    const source = await db.prepare(
      `SELECT document_id FROM report_training_case_sources
      WHERE training_case_id = ? AND document_id = ?`,
    ).get(trainingCaseId, fact.sourceDocumentId);
    if (!source) throw apiError(409, "Truth fact source is not registered for this case.", "truth_source_not_registered");

    const factId = fact.factId ?? randomUUID();
    const nowIso = new Date().toISOString();
    const reviewStatus = fact.reviewStatus ?? "machine_proposed";
    const answerReviewStatus = answerability.reviewStatus ?? reviewStatus;
    const factReviewed = ["human_reviewed", "approved"].includes(reviewStatus);
    const answerReviewed = ["human_reviewed", "approved"].includes(answerReviewStatus);
    await db.transaction(async () => {
      await db.prepare(
        `INSERT INTO report_training_case_facts (
          fact_id, training_case_id, fact_type, section_key, normalized_value_json,
          unit_code, source_document_id, source_page_number, source_block_ids_json,
          source_bbox_json, source_confidence, evidence_class, capture_destination,
          safety_criticality, review_status, proposed_by_user_id, reviewed_by_user_id,
          reviewed_at_iso, created_at_iso, updated_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (fact_id) DO UPDATE SET
          fact_type = excluded.fact_type,
          section_key = excluded.section_key,
          normalized_value_json = excluded.normalized_value_json,
          unit_code = excluded.unit_code,
          source_document_id = excluded.source_document_id,
          source_page_number = excluded.source_page_number,
          source_block_ids_json = excluded.source_block_ids_json,
          source_bbox_json = excluded.source_bbox_json,
          source_confidence = excluded.source_confidence,
          evidence_class = excluded.evidence_class,
          capture_destination = excluded.capture_destination,
          safety_criticality = excluded.safety_criticality,
          review_status = excluded.review_status,
          reviewed_by_user_id = excluded.reviewed_by_user_id,
          reviewed_at_iso = excluded.reviewed_at_iso,
          updated_at_iso = excluded.updated_at_iso`,
      ).run(
        factId,
        trainingCaseId,
        fact.factType,
        fact.sectionKey,
        JSON.stringify(fact.normalizedValue),
        fact.unitCode ?? null,
        fact.sourceDocumentId,
        fact.sourcePageNumber ?? null,
        JSON.stringify(fact.sourceBlockIds),
        fact.sourceBbox ? JSON.stringify(fact.sourceBbox) : null,
        Number(fact.sourceConfidence ?? 1),
        fact.evidenceClass,
        fact.captureDestination ?? null,
        fact.safetyCriticality ?? "medium",
        reviewStatus,
        actorUserId,
        factReviewed ? actorUserId : null,
        factReviewed ? nowIso : null,
        nowIso,
        nowIso,
      );
      await db.prepare(
        `INSERT INTO report_training_case_answerability (
          fact_id, training_case_id, answerability_class, required_fact,
          expected_generator_behavior, review_status, reviewed_by_user_id,
          reviewed_at_iso, updated_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (fact_id) DO UPDATE SET
          answerability_class = excluded.answerability_class,
          required_fact = excluded.required_fact,
          expected_generator_behavior = excluded.expected_generator_behavior,
          review_status = excluded.review_status,
          reviewed_by_user_id = excluded.reviewed_by_user_id,
          reviewed_at_iso = excluded.reviewed_at_iso,
          updated_at_iso = excluded.updated_at_iso`,
      ).run(
        factId,
        trainingCaseId,
        answerability.answerabilityClass,
        Boolean(answerability.requiredFact),
        answerability.expectedGeneratorBehavior,
        answerReviewStatus,
        answerReviewed ? actorUserId : null,
        answerReviewed ? nowIso : null,
        nowIso,
      );
    });
    return getTrainingCase(trainingCaseId);
  }

  async function getTrainingCase(trainingCaseId) {
    const trainingCase = await db.prepare(
      "SELECT * FROM report_training_cases WHERE training_case_id = ?",
    ).get(trainingCaseId);
    if (!trainingCase) return null;
    const [sources, facts] = await Promise.all([
      db.prepare(
        "SELECT * FROM report_training_case_sources WHERE training_case_id = ? ORDER BY source_role, document_id",
      ).all(trainingCaseId),
      db.prepare(
        `SELECT f.*, a.answerability_class, a.required_fact,
          a.expected_generator_behavior, a.review_status AS answerability_review_status
        FROM report_training_case_facts f
        LEFT JOIN report_training_case_answerability a ON a.fact_id = f.fact_id
        WHERE f.training_case_id = ?
        ORDER BY f.section_key, f.fact_id`,
      ).all(trainingCaseId),
    ]);
    const sourceDocument = await db.prepare(
      `SELECT d.document_id, d.case_id, d.metadata_json, d.source_sha256,
        d.source_object_key, d.document_role, d.dataset_split, c.report_family
      FROM kb_documents d
      JOIN kb_cases c ON c.case_id = d.case_id
      WHERE d.document_id = ?`,
    ).get(trainingCase.gold_document_id);
    return {
      trainingCase,
      sourceDocument: sourceDocument ? mapTruthSourceDocument(sourceDocument) : null,
      sources,
      facts,
      summary: summarizeFacts(facts),
    };
  }

  async function getTruthCase(trainingCaseId) {
    const detail = await getTrainingCase(trainingCaseId);
    if (!detail) return null;
    return {
      truthCase: mapTruthCaseSummary({
        ...detail.trainingCase,
        fact_count: detail.summary.total,
        proposed_count: detail.summary.proposed,
        reviewed_count: detail.summary.reviewed,
        approved_count: detail.summary.approved,
        rejected_count: detail.summary.rejected,
      }),
      sourceDocument: detail.sourceDocument,
      sources: detail.sources.map((source) => ({
        documentId: source.document_id,
        sourceRole: source.source_role,
        sourceSha256: source.source_sha256,
        sourceObjectKey: source.source_object_key,
      })),
      facts: detail.facts.map(mapTruthFact),
      summary: detail.summary,
    };
  }

  async function getSnapshot(snapshotId) {
    const snapshot = await db.prepare(
      "SELECT * FROM report_benchmark_snapshots WHERE snapshot_id = ?",
    ).get(snapshotId);
    if (!snapshot) return null;
    const documents = await db.prepare(
      "SELECT * FROM report_benchmark_documents WHERE snapshot_id = ? ORDER BY benchmark_role, document_id",
    ).all(snapshotId);
    return { snapshot, documents };
  }

  async function requireMutableSnapshot(snapshotId) {
    const snapshot = await db.prepare(
      "SELECT * FROM report_benchmark_snapshots WHERE snapshot_id = ?",
    ).get(snapshotId);
    if (!snapshot) throw apiError(404, "Benchmark snapshot was not found.", "benchmark_snapshot_not_found");
    if (["locked", "retired"].includes(snapshot.status_code)) {
      throw apiError(409, "Benchmark snapshot is immutable.", "benchmark_snapshot_locked");
    }
    return snapshot;
  }

  async function requireEditableTruthCase(trainingCaseId) {
    const trainingCase = await db.prepare(
      `SELECT tc.*, snapshots.status_code AS snapshot_status
      FROM report_training_cases tc
      JOIN report_benchmark_snapshots snapshots ON snapshots.snapshot_id = tc.snapshot_id
      WHERE tc.training_case_id = ?`,
    ).get(trainingCaseId);
    if (!trainingCase) throw apiError(404, "Truth Case was not found.", "training_case_not_found");
    if (!EDITABLE_TRUTH_CASE_STATES.has(trainingCase.status_code) || ["locked", "retired"].includes(trainingCase.snapshot_status)) {
      throw apiError(409, "Approved or retired Truth Cases cannot be edited.", "truth_case_locked");
    }
    return trainingCase;
  }

  async function requireApprovedTruthCase(trainingCaseId) {
    const trainingCase = await db.prepare(
      "SELECT * FROM report_training_cases WHERE training_case_id = ?",
    ).get(trainingCaseId);
    if (!trainingCase) throw apiError(404, "Truth Case was not found.", "training_case_not_found");
    if (trainingCase.status_code !== "case_approved" || !SHA256_PATTERN.test(String(trainingCase.truth_graph_sha256 ?? ""))) {
      throw apiError(
        409,
        "Approve and lock the Truth Case before generating Capture Variants.",
        "capture_variant_truth_case_approval_required",
      );
    }
    return trainingCase;
  }

  function apiError(statusCode, message, code) {
    return createError(statusCode, message, code);
  }
}

function candidateIdentity(candidate) {
  const metadata = candidate.metadata ?? candidate.metadataJson ?? candidate.metadata_json ?? {};
  return {
    snapshotId: normalizeKey(candidate.benchmarkSnapshotId ?? candidate.snapshotId ?? metadata.benchmarkSnapshotId),
    documentId: normalizeKey(candidate.documentId ?? candidate.document_id),
    caseId: normalizeKey(candidate.sourceCaseId ?? candidate.caseId ?? candidate.case_id),
    renditionId: normalizeKey(candidate.sourceRenditionId ?? candidate.renditionId ?? candidate.rendition_id),
    sourceSha256: normalizeKey(candidate.sourceSha256 ?? candidate.source_sha256),
    chunkId: normalizeKey(candidate.chunkId ?? candidate.chunk_id),
    sourcePath: normalizeKey(candidate.sourcePath ?? candidate.source_uri),
    sourceName: normalizeKey(candidate.sourceReportName ?? candidate.sourceName),
    benchmarkRole: String(candidate.benchmarkRole ?? candidate.documentRole ?? candidate.document_role ?? ""),
    datasetSplit: String(candidate.datasetSplit ?? candidate.dataset_split ?? ""),
    evidenceIssuedAt: normalizeIso(
      candidate.evidenceIssuedAt
      ?? candidate.evidenceIssuedAtIso
      ?? candidate.issuedAtIso
      ?? metadata.evidenceIssuedAt,
    ),
    assetLineageKey: normalizeKey(candidate.assetLineageKey ?? metadata.assetLineageKey),
  };
}

function normalizedSet(values) {
  return new Set((Array.isArray(values) ? values : [values]).map(normalizeKey).filter(Boolean));
}

function normalizeKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeIso(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function blocked(reason) {
  return { eligible: false, reason };
}

function contractError(code, message) {
  return new TrainingHarnessContractError(code, message);
}

function benchmarkRoleForSplit(datasetSplit) {
  if (datasetSplit === DATASET_SPLITS.TRAINING) return BENCHMARK_ROLES.TRAINING_GOLD;
  if (datasetSplit === DATASET_SPLITS.VALIDATION) return BENCHMARK_ROLES.VALIDATION_GOLD;
  if (datasetSplit === DATASET_SPLITS.HIDDEN_TEST) return BENCHMARK_ROLES.HIDDEN_TEST_GOLD;
  throw contractError("truth_source_split_required", "Truth Cases require an assigned benchmark split.");
}

function proposeTruthFactsFromChunk({ chunk, documentId, trainingCaseId }) {
  const content = normalizeTruthSourceContent(chunk.content);
  const sourceBlockIds = parseJson(chunk.source_block_ids_json, []);
  if (!content || !Array.isArray(sourceBlockIds) || sourceBlockIds.length === 0) return [];
  const sourceSpans = parseJson(chunk.source_spans_json, []);
  const sourcePages = parseJson(chunk.page_numbers_json, []);
  const primarySpan = sourceSpans.find((span) => Array.isArray(span?.bbox)) ?? null;
  const segments = splitTruthChunkIntoAtomicSegments(content, chunk.block_type);
  return segments.map((segment, segmentIndex) => {
    const proposal = classifyTruthChunk({ ...chunk, content: segment });
    const factId = `truth-${createHash("sha256")
      .update(`${trainingCaseId}:${chunk.chunk_id}:${segmentIndex}:${segment}`)
      .digest("hex")
      .slice(0, 32)}`;
    return {
    fact: {
      factId,
      factType: proposal.factType,
      sectionKey: chunk.section_key,
      normalizedValue: {
        text: segment,
        sourceHeading: chunk.original_heading,
        sourceBlockType: chunk.block_type ?? "paragraph",
      },
      unitCode: proposal.unitCode,
      sourceDocumentId: documentId,
      sourcePageNumber: Number(primarySpan?.page_number ?? primarySpan?.pageNumber ?? sourcePages[0] ?? 0) || null,
      sourceBlockIds,
      sourceBbox: primarySpan?.bbox ?? null,
      sourceConfidence: proposal.sourceConfidence,
      evidenceClass: proposal.evidenceClass,
      captureDestination: proposal.captureDestination,
      safetyCriticality: proposal.safetyCriticality,
      reviewStatus: "machine_proposed",
    },
    answerability: {
      answerabilityClass: proposal.answerabilityClass,
      requiredFact: proposal.requiredFact,
      expectedGeneratorBehavior: proposal.expectedGeneratorBehavior,
      reviewStatus: "machine_proposed",
    },
  };
  });
}

function splitTruthChunkIntoAtomicSegments(content, blockType) {
  if (/table/i.test(String(blockType ?? ""))) return [content];
  const paragraphs = String(content).split(/\n\s*\n+/).map((item) => item.trim()).filter(Boolean);
  const output = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= 700) {
      output.push(paragraph);
      continue;
    }
    const sentences = paragraph.match(/[^.!?\n]+(?:[.!?]+|$)/g)?.map((item) => item.trim()).filter(Boolean) ?? [paragraph];
    let current = "";
    for (const sentence of sentences) {
      if (current && current.length + sentence.length + 1 > 700) {
        output.push(current);
        current = "";
      }
      current = current ? `${current} ${sentence}` : sentence;
    }
    if (current) output.push(current);
  }
  return output.length ? output : [content];
}

function truthProposalSignature(proposal) {
  const value = proposal.fact.normalizedValue ?? {};
  return createHash("sha256")
    .update(JSON.stringify({
      factType: proposal.fact.factType,
      text: String(value.text ?? "").toLowerCase().replace(/\s+/g, " ").trim(),
      unitCode: proposal.fact.unitCode,
      answerabilityClass: proposal.answerability.answerabilityClass,
    }))
    .digest("hex");
}

function normalizeTruthSourceContent(value) {
  return String(value ?? "")
    .replace(
      /this document may contain confidential information[\s\S]*?held as confidential\.?/gi,
      "",
    )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function classifyTruthChunk(chunk) {
  const blockType = String(chunk.block_type ?? "paragraph").toLowerCase();
  const heading = String(chunk.original_heading ?? "").toLowerCase();
  const content = String(chunk.content ?? "").toLowerCase();
  const text = `${heading} ${content}`;
  const isTable = blockType.includes("table");
  const isCaption = blockType.includes("caption") || /\b(photo|photograph|figure|image)\b/.test(text);
  const isMeasurement = /\b(thickness|measurement|reading|ut\b|station|elevation|settlement|diameter|course|scan)\b/.test(text);
  const isGeneralInfoHeading = /\b(general tank information|tank information|tank data)\b/.test(heading);
  const isCompactGeneralField = content.length <= 700 && /\b(tank no|capacity|product|owner|client|location)\s*[:#]/.test(content);
  const isFinding = /\b(finding|corrosion|pitting|crack|leak|deform|buckle|coating|condition|defect|indication)\b/.test(text);
  const isInspectionResultHeading = /\binspection report\b/.test(heading);
  const isTerseInspectionObservation = isInspectionResultHeading
    && content.length >= 12
    && content.length <= 700
    && !/^\s*(?:inspection report|page\s*:|job no\.?\s*:|tank no\.?\s*:|client\s*:|date\s*:)/i.test(content)
    && /\b(?:not|no\b|moderate|severe|poor|fair|good|clogged|blocked|weather(?:ed|ing)|contact|missing|damaged|loose|broken|removed|perforat(?:ed|ion)|acceptable|satisfactory|significant|observed|found|noted|requires?)\b/.test(content);
  const isRecommendation = /\b(repair recommendations?|recommendations?|engineering assessment|remaining life|suitability|fitness)\b/.test(heading)
    || /\b(recommend(?:ed|ation)?|should be (?:repaired|replaced)|remaining life|suitability|fitness)\b/.test(content);
  const isTemplate = /\b(scope of inspection|inspection (?:and maintenance )?regime|methodology)\b/.test(heading);

  if (isTable && isMeasurement) {
    return proposal("measurement_record", "measurement", "utMeasurements", "high", ANSWERABILITY_CLASSES.APP_OBSERVABLE, true,
      "Use the matching app-captured measurement rows and preserve every value and unit.", 0.96);
  }
  if (isRecommendation) {
    return proposal("engineering_assessment", "report_narrative", null, "high", ANSWERABILITY_CLASSES.ENGINEERING_JUDGMENT, false,
      "Do not copy the historical wording. Draft a recommendation only from current evidence, standards, and explicit engineering review.", 0.84);
  }
  if (isTemplate) {
    return proposal("report_template_pattern", "report_narrative", null, "low", ANSWERABILITY_CLASSES.PRECEDENT_TEMPLATE, false,
      "Use only the approved section pattern and style; never reuse historical customer facts.", 0.82);
  }
  if (isTable || isGeneralInfoHeading || isCompactGeneralField) {
    return proposal("structured_record", "structured_field", "generalTankInformation", "medium", ANSWERABILITY_CLASSES.APP_OBSERVABLE, true,
      "Use the matching structured app field when present; otherwise expose the field as missing.", 0.92);
  }
  if (isCaption) {
    return proposal("photo_caption", "photo_or_attachment", "attachments.caption", "medium", ANSWERABILITY_CLASSES.APP_OBSERVABLE, false,
      "Use only a linked app photo or attachment and its confirmed caption.", 0.88);
  }
  if (isFinding || isTerseInspectionObservation) {
    return proposal("finding_observation", "finding", "findings.voiceTranscript", "high", ANSWERABILITY_CLASSES.VOICE_OBSERVABLE, true,
      "Recover this observation only when supported by app findings, notes, voice transcript, measurements, or photos.", 0.86);
  }
  return proposal("historical_report_statement", "report_narrative", null, "medium", ANSWERABILITY_CLASSES.GOLD_ONLY_UNOBSERVABLE, false,
    "Keep this historical-only statement hidden from generation unless a reviewer maps it to an observable source.", 0.78);
}

function proposal(
  factType,
  evidenceClass,
  captureDestination,
  safetyCriticality,
  answerabilityClass,
  requiredFact,
  expectedGeneratorBehavior,
  sourceConfidence,
) {
  return {
    factType,
    evidenceClass,
    captureDestination,
    safetyCriticality,
    answerabilityClass,
    requiredFact,
    expectedGeneratorBehavior,
    sourceConfidence,
    unitCode: null,
  };
}

function inferHistoricalEvidenceDate(metadata) {
  for (const key of [
    "evidenceIssuedAt",
    "issuedAtIso",
    "issueDate",
    "reportDate",
    "inspectionDate",
    "dateInspected",
  ]) {
    const normalized = normalizeIso(metadata?.[key]);
    if (normalized) return normalized;
  }
  return null;
}

function inferHistoricalEvidenceDateFromText(text) {
  const normalized = String(text ?? "")
    .replace(/(\d{1,2})\s*(?:st|nd|rd|th)\b/gi, "$1")
    .replace(/[ \t]+/g, " ");
  const labelledPatterns = [
    /date inspected\s*:?\s*([0-3]?\d[\s/-]+[a-z]+[\s,/-]+(?:19|20)\d{2})/gi,
    /inspection date\s*:?\s*([0-3]?\d[\s/-]+[a-z]+[\s,/-]+(?:19|20)\d{2})/gi,
    /date completed\s*:?\s*([0-3]?\d[\s/-]+[a-z]+[\s,/-]+(?:19|20)\d{2})/gi,
    /(?:report|issue) date\s*:?\s*([0-3]?\d[\s/-]+[a-z]+[\s,/-]+(?:19|20)\d{2})/gi,
    /date inspected\s*:?\s*((?:19|20)\d{2}[-/]\d{1,2}[-/]\d{1,2})/gi,
  ];
  const candidates = new Map();
  for (const pattern of labelledPatterns) {
    for (const match of normalized.matchAll(pattern)) {
      const parsed = parseHistoricalDate(match[1]);
      if (parsed) candidates.set(parsed, (candidates.get(parsed) ?? 0) + 1);
    }
  }
  return [...candidates.entries()]
    .sort((left, right) => right[1] - left[1] || Date.parse(right[0]) - Date.parse(left[0]))[0]?.[0] ?? null;
}

function parseHistoricalDate(value) {
  const text = String(value ?? "").trim();
  const numeric = text.match(/^((?:19|20)\d{2})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (numeric) return new Date(Date.UTC(Number(numeric[1]), Number(numeric[2]) - 1, Number(numeric[3]))).toISOString();
  const named = text.match(/^([0-3]?\d)[\s/-]+([a-z]+)[\s,/-]+((?:19|20)\d{2})$/i);
  if (!named) return normalizeIso(text);
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const month = months.findIndex((name) => name.startsWith(named[2].toLowerCase()));
  if (month < 0) return null;
  return new Date(Date.UTC(Number(named[3]), month, Number(named[1]))).toISOString();
}

function sourceDisplayName(document) {
  const metadata = parseJson(document.metadata_json);
  return String(metadata.localSourceName ?? metadata.fileName ?? document.document_id);
}

function mapTruthSource(row, truthCase) {
  const metadata = parseJson(row.metadata_json);
  return {
    documentId: row.document_id,
    sourceCaseId: row.case_id,
    displayName: String(metadata.localSourceName ?? metadata.fileName ?? row.document_id),
    reportFamily: row.report_family,
    documentRole: row.document_role,
    datasetSplit: row.dataset_split,
    sourceSha256: row.source_sha256,
    sourceStored: Boolean(row.source_object_key),
    sectionCount: Number(row.section_count ?? 0),
    chunkCount: Number(row.chunk_count ?? 0),
    evidenceAsOfCandidate: inferHistoricalEvidenceDate(metadata),
    approvedAtIso: row.approved_at_iso,
    truthCaseId: truthCase?.truthCaseId ?? null,
    truthCaseStatus: truthCase?.status ?? null,
  };
}

function mapTruthCaseSummary(row) {
  return {
    truthCaseId: row.training_case_id,
    snapshotId: row.snapshot_id,
    goldDocumentId: row.gold_document_id,
    displayName: row.display_name,
    reportFamily: row.report_family,
    datasetSplit: row.dataset_split,
    benchmarkTrack: row.benchmark_track,
    evidenceAsOf: row.evidence_as_of,
    status: row.status_code,
    truthGraphVersion: Number(row.truth_graph_version),
    truthGraphSha256: row.truth_graph_sha256,
    factCount: Number(row.fact_count ?? 0),
    proposedCount: Number(row.proposed_count ?? 0),
    reviewedCount: Number(row.reviewed_count ?? 0),
    approvedCount: Number(row.approved_count ?? 0),
    rejectedCount: Number(row.rejected_count ?? 0),
    updatedAtIso: row.updated_at_iso,
  };
}

function mapTruthSourceDocument(row) {
  const metadata = parseJson(row.metadata_json);
  return {
    documentId: row.document_id,
    sourceCaseId: row.case_id,
    displayName: String(metadata.localSourceName ?? metadata.fileName ?? row.document_id),
    reportFamily: row.report_family,
    documentRole: row.document_role,
    datasetSplit: row.dataset_split,
    sourceSha256: row.source_sha256,
    sourceObjectKey: row.source_object_key,
  };
}

function mapTruthFact(row) {
  return {
    factId: row.fact_id,
    truthCaseId: row.training_case_id,
    factType: row.fact_type,
    sectionKey: row.section_key,
    normalizedValue: parseJson(row.normalized_value_json),
    unitCode: row.unit_code,
    sourceDocumentId: row.source_document_id,
    sourcePageNumber: row.source_page_number == null ? null : Number(row.source_page_number),
    sourceBlockIds: parseJson(row.source_block_ids_json, []),
    sourceBbox: parseJson(row.source_bbox_json, null),
    sourceConfidence: Number(row.source_confidence),
    evidenceClass: row.evidence_class,
    captureDestination: row.capture_destination,
    safetyCriticality: row.safety_criticality,
    reviewStatus: row.review_status,
    answerabilityClass: row.answerability_class,
    requiredFact: Boolean(row.required_fact),
    expectedGeneratorBehavior: row.expected_generator_behavior,
    answerabilityReviewStatus: row.answerability_review_status,
    reviewedAtIso: row.reviewed_at_iso,
    updatedAtIso: row.updated_at_iso,
  };
}

function mapTruthGraphFact(row) {
  return {
    factId: row.fact_id,
    factType: row.fact_type,
    sectionKey: row.section_key,
    value: parseJson(row.normalized_value_json),
    unitCode: row.unit_code,
    evidenceClass: row.evidence_class,
    captureDestination: row.capture_destination,
    safetyCriticality: row.safety_criticality,
    answerability: {
      class: row.answerability_class,
      requiredFact: Boolean(row.required_fact),
      expectedGeneratorBehavior: row.expected_generator_behavior,
    },
    provenance: {
      documentId: row.source_document_id,
      pageNumber: row.source_page_number == null ? null : Number(row.source_page_number),
      blockIds: parseJson(row.source_block_ids_json, []),
      bbox: parseJson(row.source_bbox_json, null),
      confidence: Number(row.source_confidence),
    },
  };
}

function buildCaptureVariantScenario({ truthCase, profile, seed, facts }) {
  const profileConfig = parseJson(profile.config_json);
  const variantId = `capture-${createHash("sha256")
    .update(`${truthCase.training_case_id}:${profile.profile_version_id}:${seed}:${CAPTURE_SCENARIO_VERSION}`)
    .digest("hex")
    .slice(0, 32)}`;
  const variationModel = buildVariationModel(profileConfig);
  const sampledConditions = sampleCaptureConditions(variantId, variationModel);
  const materializableClasses = new Set([
    ANSWERABILITY_CLASSES.APP_OBSERVABLE,
    ANSWERABILITY_CLASSES.VOICE_OBSERVABLE,
  ]);
  const resolveTargetSection = buildReportSpecificSectionResolver(facts);
  const links = facts.map((fact, index) => {
    const materializable = materializableClasses.has(fact.answerability_class);
    const captureChannel = materializable
      ? chooseCaptureChannel(fact, profile.profile_code, sampledConditions, variantId)
      : "none";
    const probability = captureProbability(captureChannel, sampledConditions);
    const protectedFact = isCaptureProtectedFact(fact);
    const requiredFaithfulFact = profile.lane_code === "faithful_capture" && Boolean(fact.required_fact);
    const include = materializable && (
      protectedFact
      || requiredFaithfulFact
      || deterministicUnit(variantId, fact.fact_id, "include") <= probability
    );
    const transformation = include
      ? captureTransformation({ fact, captureChannel, profileConfig, sampledConditions, variantId })
      : {};
    const repeat = include
      && sampledConditions.repetitionRate > 0
      && deterministicUnit(variantId, fact.fact_id, "repeat") <= sampledConditions.repetitionRate;
    const disposition = include
      ? repeat
        ? "repeated"
        : Object.keys(transformation).length > 0
          ? "transformed"
          : "included"
      : "withheld";
    const orderScore = sampledConditions.observationOrder === "deterministic_shuffle"
      ? deterministicUnit(variantId, fact.fact_id, "order")
      : index;
    const sectionResolution = resolveTargetSection(fact);
    return {
      factId: fact.fact_id,
      factType: fact.fact_type,
      sectionKey: fact.section_key,
      sourcePageNumber: fact.source_page_number,
      targetReportSectionId: sectionResolution.sectionId,
      sectionResolutionBasis: sectionResolution.basis,
      sectionAligned: sectionResolution.aligned,
      value: parseJson(fact.normalized_value_json),
      unitCode: fact.unit_code,
      evidenceClass: fact.evidence_class,
      captureDestination: fact.capture_destination,
      safetyCriticality: fact.safety_criticality,
      answerabilityClass: fact.answerability_class,
      requiredFact: Boolean(fact.required_fact),
      captureChannel: include ? captureChannel : "none",
      disposition,
      transformation,
      withholdingReason: include
        ? null
        : materializable
          ? "profile_completeness"
          : `answerability_${fact.answerability_class}`,
      orderScore,
    };
  });
  links.sort((left, right) => left.orderScore - right.orderScore || left.factId.localeCompare(right.factId));
  links.forEach((link, index) => {
    link.stableOrder = index;
    delete link.orderScore;
  });
  const included = links.filter((link) => link.disposition !== "withheld");
  const withheld = links.filter((link) => link.disposition === "withheld");
  const expectedMissingInputs = withheld
    .filter((link) => link.requiredFact)
    .map((link) => ({
      factId: link.factId,
      sectionKey: link.sectionKey,
      answerabilityClass: link.answerabilityClass,
      reason: link.withholdingReason,
    }));
  const manifest = {
    packageType: "laiq_capture_scenario",
    schemaVersion: 1,
    identity: {
      variantId,
      truthCaseId: truthCase.training_case_id,
      truthGraphVersion: Number(truthCase.truth_graph_version),
      truthGraphSha256: truthCase.truth_graph_sha256,
      variantVersion: CAPTURE_SCENARIO_VERSION,
      captureProfile: profile.profile_code,
      captureProfileVersion: Number(profile.version_number),
      deterministicSeed: seed,
      datasetSplit: truthCase.dataset_split,
      lane: profile.lane_code,
      reportFamily: truthCase.report_family,
      sourceReportName: truthCase.gold_source_report_name ?? null,
      assetLineageKey: truthCase.asset_lineage_key ?? null,
    },
    appContractTarget: {
      packageType: "v3_product_export",
      schemaVersion: 3,
      owner: "LAIQ inspection app",
      status: "awaiting_app_round_trip",
    },
    behavior: {
      ...profileConfig,
      variationRule: "Capture behavior may vary; inspection truth may not change.",
    },
    variationModel: {
      modelType: "hierarchical_constrained_sampling",
      modelVersion: 1,
      distributions: variationModel,
      sampledConditions,
    hardConstraints: {
        requiredFactsIncluded: profile.lane_code === "faithful_capture",
        protectedFactsPreserved: true,
        unobservableFactsWithheld: true,
        sourceSectionAlignmentRequired: true,
      },
    },
    captures: included.map((link) => captureManifestFact(link)),
    withheldFacts: withheld.map((link) => ({
      factId: link.factId,
      sectionKey: link.sectionKey,
      answerabilityClass: link.answerabilityClass,
      requiredFact: link.requiredFact,
      reason: link.withholdingReason,
    })),
    expectedMissingInputs,
    protectedInvariants: [
      "measurement_values",
      "units",
      "plate_course_lane_and_element_identity",
      "finding_severity",
      "layout_geometry",
      "photo_finding_linkage",
    ],
  };
  return {
    variantId,
    manifest,
    links,
    includedCount: included.length,
    withheldCount: withheld.length,
    transformedCount: included.filter((link) => ["transformed", "repeated"].includes(link.disposition)).length,
    expectedMissingInputs,
  };
}

function validateCaptureVariantScenario(scenario, laneCode) {
  const requiredOmissions = scenario.links.filter((link) => (
    laneCode === "faithful_capture"
    && link.requiredFact
    && [ANSWERABILITY_CLASSES.APP_OBSERVABLE, ANSWERABILITY_CLASSES.VOICE_OBSERVABLE].includes(link.answerabilityClass)
    && link.disposition === "withheld"
  ));
  const protectedOmissions = scenario.links.filter((link) => (
    ["measurement", "layout_geometry", "photo_or_attachment"].includes(link.evidenceClass)
      || ["high", "critical"].includes(link.safetyCriticality)
  ) && (
    [ANSWERABILITY_CLASSES.APP_OBSERVABLE, ANSWERABILITY_CLASSES.VOICE_OBSERVABLE].includes(link.answerabilityClass)
    && link.disposition === "withheld"
  ));
  const fabricatedInputs = scenario.links.filter((link) => (
    ![ANSWERABILITY_CLASSES.APP_OBSERVABLE, ANSWERABILITY_CLASSES.VOICE_OBSERVABLE].includes(link.answerabilityClass)
    && link.disposition !== "withheld"
  ));
  const crossSectionAssignments = scenario.links.filter((link) => (
    link.disposition !== "withheld"
    && link.sectionAligned !== true
    && link.targetReportSectionId !== "report-metadata"
  ));
  if (requiredOmissions.length || protectedOmissions.length || fabricatedInputs.length || crossSectionAssignments.length) {
    throw apiError(
      500,
      "Generated capture scenario violated required truth constraints.",
      "capture_variant_constraint_violation",
    );
  }
  return {
    requiredFactsIncluded: true,
    protectedFactsPreserved: true,
    unobservableFactsWithheld: true,
    sourceSectionAlignmentPassed: true,
    constraintViolationCount: 0,
  };
}

function isCaptureProtectedFact(fact) {
  return ["measurement", "layout_geometry", "photo_or_attachment"].includes(fact.evidence_class)
    || ["high", "critical"].includes(fact.safety_criticality);
}

function chooseCaptureChannel(fact, profileCode, sampledConditions, variantId) {
  if (fact.evidence_class === "measurement") return "measurement";
  if (fact.evidence_class === "photo_or_attachment") return "photo";
  if (fact.answerability_class === ANSWERABILITY_CLASSES.VOICE_OBSERVABLE) return "voice";
  if (profileCode === "voice_heavy" && fact.evidence_class === "finding") return "voice";
  if (
    fact.evidence_class === "finding"
    && deterministicUnit(variantId, fact.fact_id, "capture-channel") <= sampledConditions.voiceDependence
  ) return "voice";
  return "structured_field";
}

function captureProbability(channel, sampledConditions) {
  if (channel === "voice" || channel === "note") return sampledConditions.contextCompleteness;
  if (channel === "photo") return sampledConditions.photoAvailability;
  return sampledConditions.structuredCompleteness;
}

function boundedProbability(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
}

function captureTransformation({ fact, captureChannel, profileConfig, sampledConditions, variantId }) {
  const transformation = {};
  if (["voice", "note"].includes(captureChannel)) {
    transformation.noteStyle = String(profileConfig.noteStyle ?? "normal");
    transformation.surfaceVariation = {
      formality: sampledConditions.speechFormality,
      fillerCount: deterministicPoisson(sampledConditions.fillerLambda, variantId, fact.fact_id, "fillers"),
      interruptionCount: deterministicPoisson(sampledConditions.interruptionLambda, variantId, fact.fact_id, "interruptions"),
      protectedTokens: ["numbers", "units", "identifiers", "severity", "geometry", "photo_linkage"],
    };
    const asrNoise = sampledConditions.noiseSeverity;
    if (asrNoise > 0) {
      transformation.asrNoise = {
        rate: asrNoise,
        seed: Math.floor(deterministicUnit(variantId, fact.fact_id, "asr") * 1_000_000),
        protectedTokens: ["numbers", "units", "identifiers"],
      };
    }
  }
  return transformation;
}

function buildVariationModel(config) {
  const structured = boundedProbability(config.structuredCompleteness, 0.85);
  const context = boundedProbability(config.voiceCompleteness, 0.75);
  const photo = boundedProbability(config.photoCompleteness, 0.65);
  const noise = boundedProbability(config.asrNoise, 0);
  const repetition = boundedProbability(config.repetitionRate, 0);
  const voiceDependence = boundedProbability(1 - Number(config.structuredPreference ?? 0.75), 0.25);
  return {
    contextCompleteness: betaDistribution(context, 12),
    structuredCompleteness: betaDistribution(structured, 18),
    voiceDependence: betaDistribution(voiceDependence, 12),
    noiseSeverity: betaDistribution(noise, 20),
    speechFormality: betaDistribution(formalityMean(config.noteStyle), 14),
    photoAvailability: betaDistribution(photo, 14),
    repetitionRate: betaDistribution(repetition, 20),
    fillerCount: { distribution: "poisson", lambda: fillerLambda(config.noteStyle) },
    interruptionCount: {
      distribution: "poisson",
      lambda: String(config.noteStyle ?? "").includes("interrupted") ? 1.4 : 0.15,
    },
    observationOrder: {
      distribution: "constrained_permutation",
      mode: String(config.orderMode ?? "section"),
    },
  };
}

function sampleCaptureConditions(variantId, model) {
  return {
    contextCompleteness: deterministicBeta(model.contextCompleteness, variantId, "context-completeness"),
    structuredCompleteness: deterministicBeta(model.structuredCompleteness, variantId, "structured-completeness"),
    voiceDependence: deterministicBeta(model.voiceDependence, variantId, "voice-dependence"),
    noiseSeverity: deterministicBeta(model.noiseSeverity, variantId, "noise-severity"),
    speechFormality: deterministicBeta(model.speechFormality, variantId, "speech-formality"),
    photoAvailability: deterministicBeta(model.photoAvailability, variantId, "photo-availability"),
    repetitionRate: deterministicBeta(model.repetitionRate, variantId, "repetition-rate"),
    fillerLambda: model.fillerCount.lambda,
    interruptionLambda: model.interruptionCount.lambda,
    observationOrder: model.observationOrder.mode,
  };
}

function betaDistribution(mean, concentration) {
  const safeMean = Math.max(0.001, Math.min(0.999, mean));
  return {
    distribution: "beta",
    alpha: Number((safeMean * concentration).toFixed(4)),
    beta: Number(((1 - safeMean) * concentration).toFixed(4)),
  };
}

function deterministicBeta(spec, ...parts) {
  const alphaSample = deterministicGamma(spec.alpha, ...parts, "alpha");
  const betaSample = deterministicGamma(spec.beta, ...parts, "beta");
  return Number((alphaSample / (alphaSample + betaSample)).toFixed(6));
}

function deterministicGamma(shape, ...parts) {
  if (shape < 1) {
    const adjusted = deterministicGamma(shape + 1, ...parts, "adjusted");
    return adjusted * deterministicUnit(...parts, "scale") ** (1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const normal = deterministicNormal(...parts, attempt);
    const cube = (1 + c * normal) ** 3;
    if (cube <= 0) continue;
    const unit = deterministicUnit(...parts, attempt, "accept");
    if (unit < 1 - 0.0331 * normal ** 4 || Math.log(unit) < 0.5 * normal ** 2 + d * (1 - cube + Math.log(cube))) {
      return d * cube;
    }
  }
  return shape;
}

function deterministicNormal(...parts) {
  const u1 = Math.max(Number.EPSILON, deterministicUnit(...parts, "normal-u1"));
  const u2 = deterministicUnit(...parts, "normal-u2");
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function deterministicPoisson(lambda, ...parts) {
  if (lambda <= 0) return 0;
  const threshold = Math.exp(-lambda);
  let product = 1;
  let count = 0;
  while (product > threshold && count < 50) {
    product *= Math.max(Number.EPSILON, deterministicUnit(...parts, count));
    count += 1;
  }
  return Math.max(0, count - 1);
}

function formalityMean(noteStyle) {
  if (["technical_shorthand", "concise"].includes(String(noteStyle))) return 0.82;
  if (["spoken", "detailed_voice", "interrupted"].includes(String(noteStyle))) return 0.3;
  return 0.58;
}

function fillerLambda(noteStyle) {
  if (["spoken", "detailed_voice", "interrupted"].includes(String(noteStyle))) return 2.4;
  if (String(noteStyle) === "normal") return 0.8;
  return 0.2;
}

function deterministicUnit(...parts) {
  const hex = createHash("sha256").update(parts.join(":"), "utf8").digest("hex").slice(0, 13);
  return Number.parseInt(hex, 16) / 0xfffffffffffff;
}

function captureManifestFact(link) {
  return {
    factId: link.factId,
    factType: link.factType,
    sectionKey: link.sectionKey,
    sourcePageNumber: link.sourcePageNumber,
    targetReportSectionId: link.targetReportSectionId,
    sectionResolutionBasis: link.sectionResolutionBasis,
    sectionAligned: link.sectionAligned,
    value: link.value,
    unitCode: link.unitCode,
    evidenceClass: link.evidenceClass,
    captureDestination: link.captureDestination,
    requiredFact: link.requiredFact,
    captureChannel: link.captureChannel,
    disposition: link.disposition,
    transformation: link.transformation,
    stableOrder: link.stableOrder,
  };
}

function mapCaptureProfile(row) {
  return {
    profileVersionId: row.profile_version_id,
    profileCode: row.profile_code,
    versionNumber: Number(row.version_number),
    displayName: row.display_name,
    description: row.description,
    lane: row.lane_code,
    status: row.status_code,
    config: parseJson(row.config_json),
  };
}

function mapCaptureVariantSummary(row) {
  return {
    variantId: row.variant_id,
    truthCaseId: row.training_case_id,
    profileVersionId: row.profile_version_id,
    profileCode: row.profile_code,
    profileDisplayName: row.profile_display_name,
    profileDescription: row.profile_description,
    profileConfig: parseJson(row.profile_config_json),
    variantVersion: Number(row.variant_version),
    deterministicSeed: Number(row.random_seed),
    datasetSplit: row.dataset_split,
    lane: row.lane_code,
    status: row.status_code,
    includedFactCount: Number(row.included_fact_count),
    withheldFactCount: Number(row.withheld_fact_count),
    transformedFactCount: Number(row.transformed_fact_count),
    expectedMissingInputs: parseJson(row.expected_missing_inputs_json, []),
    scenarioObjectKey: row.scenario_object_key,
    scenarioSha256: row.scenario_sha256,
    appReportJobId: row.app_report_job_id,
    appRoundTripStatus: row.app_report_job_id ? "materialized" : "awaiting_app_round_trip",
    validation: parseJson(row.validation_json),
    createdAtIso: row.created_at_iso,
    updatedAtIso: row.updated_at_iso,
    approvedAtIso: row.approved_at_iso,
  };
}

function mapCaptureVariantFactLink(row) {
  return {
    factId: row.fact_id,
    truthCaseId: row.training_case_id,
    factType: row.fact_type,
    sectionKey: row.section_key,
    normalizedValue: parseJson(row.normalized_value_json),
    unitCode: row.unit_code,
    evidenceClass: row.evidence_class,
    captureDestination: row.capture_destination,
    safetyCriticality: row.safety_criticality,
    answerabilityClass: row.answerability_class,
    requiredFact: Boolean(row.required_fact),
    disposition: row.disposition_code,
    captureChannel: row.capture_channel,
    transformation: parseJson(row.transformation_json),
    stableOrder: Number(row.stable_order),
  };
}

function summarizeFacts(rows) {
  return rows.reduce((summary, row) => {
    summary.total += 1;
    if (row.review_status === "machine_proposed") summary.proposed += 1;
    if (row.review_status === "human_reviewed") summary.reviewed += 1;
    if (row.review_status === "approved") summary.approved += 1;
    if (row.review_status === "rejected") summary.rejected += 1;
    return summary;
  }, { total: 0, proposed: 0, reviewed: 0, approved: 0, rejected: 0 });
}

function parseJson(value, fallback = {}) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function buildSnapshotManifestSha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
