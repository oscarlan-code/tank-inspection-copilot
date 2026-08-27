import { randomUUID } from "node:crypto";
import { API_STANDARD_REPORT_TOC } from "./report-toc.mjs";

const GOLD_ROLES = new Set(["evaluation_gold"]);
const GOLD_SPLITS = new Set(["validation", "hidden_test"]);

export function createEvaluationLabService({ db, createError }) {
  return {
    ensureCaptureVariantCase,
    getState,
    linkCase,
  };

  async function ensureCaptureVariantCase({ actorUserId, truthCaseId, variantId, reportJobId }) {
    const truth = await db.prepare(
      `SELECT tc.*, d.metadata_json, d.source_sha256, c.report_family
      FROM report_training_cases tc
      JOIN kb_documents d ON d.document_id = tc.gold_document_id
      JOIN kb_cases c ON c.case_id = d.case_id
      WHERE tc.training_case_id = ? AND tc.status_code = 'case_approved'`,
    ).get(truthCaseId);
    if (!truth) throw createError(409, "An approved Truth Case is required as the golden standard.", "evaluation_truth_case_required");
    const variant = await db.prepare(
      `SELECT variant_id, training_case_id, profile_version_id, random_seed, status_code
      FROM report_capture_variants WHERE variant_id = ?`,
    ).get(variantId);
    if (!variant || variant.training_case_id !== truthCaseId || variant.status_code !== "materialized") {
      throw createError(409, "A completed Capture Variant is required for automatic evaluation pairing.", "evaluation_capture_variant_required");
    }
    const appPackage = await db.prepare(
      `SELECT rj.*, ri.package_sha256, ri.source_storage_status
      FROM report_jobs rj JOIN report_imports ri ON ri.import_id = rj.import_id
      WHERE rj.report_job_id = ?`,
    ).get(reportJobId);
    if (!appPackage || appPackage.source_storage_status !== "stored") {
      throw createError(409, "The completed V3 export must be stored before evaluation pairing.", "evaluation_stored_export_required");
    }
    const metadata = parseJson(truth.metadata_json);
    const sourceName = String(metadata.localSourceName ?? metadata.fileName ?? truth.gold_document_id);
    const evaluationCaseId = `eval-${variantId}`;
    const nowIso = new Date().toISOString();
    await db.transaction(async () => {
      await db.prepare(
        `INSERT INTO report_evaluation_cases (
          evaluation_case_id, tenant_id, workspace_id, display_name, report_family,
          input_inspection_id, gold_document_id, gold_source_report_name,
          dataset_split, label_status, config_json, created_by_user_id,
          created_at_iso, updated_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?)
        ON CONFLICT (evaluation_case_id) DO UPDATE SET
          config_json = excluded.config_json, updated_at_iso = excluded.updated_at_iso`,
      ).run(
        evaluationCaseId,
        appPackage.tenant_id,
        appPackage.workspace_id,
        `${sourceName} · ${variantId.slice(-8)}`,
        truth.report_family,
        appPackage.inspection_id,
        truth.gold_document_id,
        sourceName,
        truth.dataset_split,
        JSON.stringify({
          goldStandardType: "approved_truth_graph",
          goldFirewall: true,
          goldTruthCaseId: truthCaseId,
          truthGraphVersion: Number(truth.truth_graph_version),
          truthGraphSha256: truth.truth_graph_sha256,
          captureVariantId: variantId,
          sourcePackageSha256: appPackage.package_sha256,
          sourceReportJobId: reportJobId,
        }),
        actorUserId,
        nowIso,
        nowIso,
      );
      const factLocations = await db.prepare(
        `SELECT DISTINCT f.source_page_number, f.section_key
        FROM report_capture_variant_fact_links l
        JOIN report_training_case_facts f ON f.fact_id = l.fact_id
        JOIN report_training_case_answerability a ON a.fact_id = f.fact_id
        JOIN report_standardized_mock_gold_pairs pair
          ON pair.variant_id = l.variant_id AND pair.section_key = f.section_key
          AND pair.contract_version = 1 AND pair.status_code = 'ready'
        WHERE l.variant_id = ?
          AND f.review_status = 'approved'
          AND a.review_status = 'approved'
          AND (
            (l.disposition_code <> 'withheld' AND a.answerability_class IN ('app_observable', 'voice_observable'))
            OR a.answerability_class = 'deterministic_derived'
          )
        ORDER BY f.source_page_number NULLS LAST, f.section_key`,
      ).all(variantId);
      const horizontalFamily = /horizontal/.test(String(truth.report_family ?? ""));
      const supportedSections = horizontalFamily
        ? new Set([
            "scope-of-inspection", "inspection-maintenance-regime", "general-tank-information",
            "inspection-report", "repair-recommendations", "test-information",
            "tank-inspection-checklist", "shell-plate-thickness-measurements", "photographs",
          ])
        : new Set(API_STANDARD_REPORT_TOC.map((section) => section.id));
      const sectionIds = new Set(factLocations
        .map((fact) => String(fact.section_key ?? ""))
        .filter((sectionKey) => supportedSections.has(sectionKey)));
      await db.prepare(
        "DELETE FROM report_evaluation_case_sections WHERE evaluation_case_id = ?",
      ).run(evaluationCaseId);
      for (const sectionId of sectionIds) {
        await db.prepare(
          `INSERT INTO report_evaluation_case_sections (
            evaluation_case_id, section_id, gold_section_key, evaluation_enabled, config_json
          ) VALUES (?, ?, ?, TRUE, ?)
          ON CONFLICT (evaluation_case_id, section_id) DO UPDATE SET
            evaluation_enabled = TRUE, config_json = excluded.config_json`,
        ).run(evaluationCaseId, sectionId, sectionId, JSON.stringify({ goldStandardType: "standardized_mock_gold_pair", contractVersion: 1 }));
      }
    });
    return evaluationCaseId;
  }

  async function getState() {
    const [documentRows, packageRows, caseRows] = await Promise.all([
      db.prepare(
        `SELECT
          d.document_id,
          d.case_id,
          d.document_role,
          d.dataset_split,
          d.approval_status,
          d.retrieval_eligible,
          d.source_sha256,
          d.source_object_key,
          d.extraction_quality_json,
          d.metadata_json,
          d.approved_at_iso,
          c.report_family,
          c.status_code AS case_status,
          COUNT(DISTINCT s.section_id) AS section_count,
          COUNT(DISTINCT k.chunk_id) AS chunk_count,
          latest_run.ingestion_run_id,
          latest_run.status_code AS ingestion_status
        FROM kb_documents d
        JOIN kb_cases c ON c.case_id = d.case_id
        LEFT JOIN kb_sections s ON s.document_id = d.document_id
        LEFT JOIN kb_chunks k ON k.document_id = d.document_id
        LEFT JOIN LATERAL (
          SELECT ingestion_run_id, status_code
          FROM kb_ingestion_runs candidate
          WHERE candidate.document_id = d.document_id
          ORDER BY candidate.started_at_iso DESC
          LIMIT 1
        ) latest_run ON TRUE
        WHERE d.approval_status = 'approved'
          AND d.source_object_key IS NOT NULL
        GROUP BY d.document_id, c.case_id, latest_run.ingestion_run_id, latest_run.status_code
        HAVING COUNT(DISTINCT k.chunk_id) > 0
        ORDER BY d.approved_at_iso DESC NULLS LAST, d.updated_at_iso DESC`,
      ).all(),
      db.prepare(
        `SELECT
          rj.report_job_id,
          rj.inspection_id,
          rj.report_reference,
          rj.title,
          rj.client,
          rj.tank,
          rj.inspected_date,
          rj.tenant_id,
          rj.workspace_id,
          ri.import_id,
          ri.package_type,
          ri.schema_version,
          ri.package_sha256,
          ri.revision_number,
          ri.source_sha256,
          ri.source_storage_status,
          ri.exported_at_iso
        FROM report_jobs rj
        JOIN report_imports ri ON ri.import_id = rj.import_id
        WHERE rj.bootstrap_key IS NULL
          AND ri.source_storage_status = 'stored'
        ORDER BY ri.exported_at_iso DESC, rj.updated_at_iso DESC`,
      ).all(),
      db.prepare(
        `SELECT
          ec.evaluation_case_id,
          ec.gold_document_id,
          ec.display_name,
          ec.report_family,
          ec.input_inspection_id,
          ec.dataset_split,
          ec.label_status,
          ec.config_json,
          ec.created_at_iso,
          ec.updated_at_iso,
          rj.report_job_id,
          rj.report_reference,
          ri.package_sha256,
          ri.source_storage_status,
          cp.profile_code,
          cp.display_name AS profile_display_name,
          cv.random_seed,
          COUNT(DISTINCT ecs.section_id) AS enabled_section_count,
          COUNT(DISTINCT rer.section_id) FILTER (
            WHERE ec.dataset_split = 'hidden_test' OR rlr.learning_eligible = TRUE
          ) AS eval_run_count,
          COUNT(DISTINCT rer.eval_run_id) FILTER (
            WHERE rlr.learning_eligible = FALSE AND NOT EXISTS (
              SELECT 1 FROM report_eval_runs recovered_run
              JOIN system_rl_policy_rewards recovered_reward ON recovered_reward.eval_run_id = recovered_run.eval_run_id
              WHERE recovered_run.evaluation_case_id = rer.evaluation_case_id
                AND recovered_run.section_id = rer.section_id
                AND recovered_run.created_at_iso > rer.created_at_iso
                AND recovered_reward.learning_eligible = TRUE
            )
          ) AS blocked_episode_count,
          COUNT(DISTINCT rer.section_id) FILTER (
            WHERE (ec.dataset_split = 'hidden_test' OR rlr.learning_eligible = TRUE)
              AND (rlr.learning_eligible = FALSE OR rlr.hard_failure = TRUE OR rer.score < 0.6 OR rer.outcome_code <> 'pass')
          ) AS quality_issue_count,
          AVG(rer.score) FILTER (WHERE rlr.learning_eligible = TRUE) AS mean_score,
          AVG(rlr.reward_value) FILTER (WHERE rlr.learning_eligible = TRUE) AS mean_reward,
          AVG((rer.eval_json -> 'truthGraphEvaluation' ->> 'requiredFactRecall')::DOUBLE PRECISION)
            FILTER (WHERE rlr.learning_eligible = TRUE) AS mean_required_fact_recall,
          AVG((rer.eval_json -> 'truthGraphEvaluation' ->> 'claimPrecision')::DOUBLE PRECISION)
            FILTER (WHERE rlr.learning_eligible = TRUE) AS mean_claim_precision,
          AVG((rer.eval_json -> 'truthGraphEvaluation' ->> 'protectedFactAccuracy')::DOUBLE PRECISION)
            FILTER (WHERE rlr.learning_eligible = TRUE) AS mean_protected_fact_accuracy,
          MIN(ecs.section_id) FILTER (WHERE NOT EXISTS (
            SELECT 1 FROM report_eval_runs completed_run
            JOIN system_rl_policy_rewards completed_reward ON completed_reward.eval_run_id = completed_run.eval_run_id
            WHERE completed_run.evaluation_case_id = ecs.evaluation_case_id
              AND completed_run.section_id = ecs.section_id
              AND (ec.dataset_split = 'hidden_test' OR completed_reward.learning_eligible = TRUE)
          )) AS next_section_id,
          MAX(rer.created_at_iso) AS latest_eval_at_iso
        FROM report_evaluation_cases ec
        JOIN kb_documents d ON d.document_id = ec.gold_document_id
        LEFT JOIN report_jobs rj
          ON rj.report_job_id = ec.config_json ->> 'sourceReportJobId'
        LEFT JOIN report_imports ri ON ri.import_id = rj.import_id
        LEFT JOIN report_capture_variants cv
          ON cv.variant_id = ec.config_json ->> 'captureVariantId'
        LEFT JOIN report_capture_profile_versions cp
          ON cp.profile_version_id = cv.profile_version_id
        LEFT JOIN report_evaluation_case_sections ecs
          ON ecs.evaluation_case_id = ec.evaluation_case_id
          AND ecs.evaluation_enabled = TRUE
        LEFT JOIN report_eval_runs rer
          ON rer.evaluation_case_id = ec.evaluation_case_id
          AND rer.section_id = ecs.section_id
        LEFT JOIN system_rl_policy_rewards rlr ON rlr.eval_run_id = rer.eval_run_id
        WHERE d.approval_status = 'approved'
        GROUP BY ec.evaluation_case_id, rj.report_job_id, rj.report_reference,
          ri.package_sha256, ri.source_storage_status, cp.profile_code,
          cp.display_name, cv.random_seed
        ORDER BY ec.updated_at_iso DESC`,
      ).all(),
    ]);

    const cases = caseRows.map(mapEvaluationCase);
    const casesByDocument = new Map(cases.map((evaluationCase) => [
      evaluationCase.goldDocumentId,
      evaluationCase,
    ]));
    const documents = documentRows.map((row) => mapDocument(row, casesByDocument.get(row.document_id)));
    const appPackages = packageRows.map(mapAppPackage);
    return {
      generatedAtIso: new Date().toISOString(),
      summary: {
        approvedKbDocuments: documents.length,
        trainingReferences: documents.filter((document) => document.purpose === "training_reference").length,
        evaluationGoldDocuments: documents.filter((document) => document.purpose === "evaluation_gold").length,
        realStoredAppPackages: appPackages.length,
        linkedEvaluationCases: cases.length,
        completedEvaluationRuns: cases.reduce((total, item) => total + item.evalRunCount, 0),
      },
      documents,
      appPackages,
      evaluationCases: cases,
    };
  }

  async function linkCase({ actorUserId, goldDocumentId, reportJobId }) {
    const gold = await db.prepare(
      `SELECT d.*, c.report_family
      FROM kb_documents d
      JOIN kb_cases c ON c.case_id = d.case_id
      WHERE d.document_id = ?`,
    ).get(goldDocumentId);
    if (!gold) throw createError(404, "Approved KB document was not found.", "evaluation_gold_not_found");
    if (gold.approval_status !== "approved") {
      throw createError(409, "Approve this KB document before using it for evaluation.", "evaluation_gold_not_approved");
    }
    if (!GOLD_ROLES.has(gold.document_role) || !GOLD_SPLITS.has(gold.dataset_split)) {
      throw createError(
        409,
        "Classify this KB document as Hidden Gold with a validation or hidden-test split before Evidence Pairing.",
        "evaluation_gold_classification_required",
      );
    }
    if (gold.retrieval_eligible) {
      throw createError(409, "Evaluation gold cannot be available to generation retrieval.", "evaluation_gold_retrieval_conflict");
    }

    const appPackage = await db.prepare(
      `SELECT rj.*, ri.package_sha256, ri.source_storage_status
      FROM report_jobs rj
      JOIN report_imports ri ON ri.import_id = rj.import_id
      WHERE rj.report_job_id = ?`,
    ).get(reportJobId);
    if (!appPackage) throw createError(404, "LAIQ app package was not found.", "evaluation_app_package_not_found");
    if (appPackage.bootstrap_key || appPackage.source_storage_status !== "stored") {
      throw createError(
        409,
        "Evaluation requires a non-demo LAIQ app package stored through the immutable object-upload pipeline.",
        "evaluation_real_app_package_required",
      );
    }
    if (gold.tenant_id && gold.tenant_id !== appPackage.tenant_id) {
      throw createError(409, "The KB source and app package belong to different tenants.", "evaluation_tenant_mismatch");
    }
    if (gold.workspace_id && gold.workspace_id !== appPackage.workspace_id) {
      throw createError(409, "The KB source and app package belong to different workspaces.", "evaluation_workspace_mismatch");
    }

    const metadata = parseJson(gold.metadata_json);
    const displayName = String(metadata.localSourceName ?? metadata.fileName ?? gold.document_id);
    const nowIso = new Date().toISOString();
    let evaluationCaseId;
    try {
      await db.transaction(async () => {
        const existing = await db.prepare(
          `SELECT evaluation_case_id
          FROM report_evaluation_cases
          WHERE gold_document_id = ?
          ORDER BY updated_at_iso DESC
          LIMIT 1
          FOR UPDATE`,
        ).get(gold.document_id);
        evaluationCaseId = existing?.evaluation_case_id ?? randomUUID();
        if (existing) {
          await db.prepare(
            `UPDATE report_evaluation_cases
            SET tenant_id = ?, workspace_id = ?, display_name = ?, report_family = ?,
              input_inspection_id = ?, gold_source_report_name = ?, dataset_split = ?,
              label_status = 'machine_proposed',
              config_json = config_json || ?, updated_at_iso = ?
            WHERE evaluation_case_id = ?`,
          ).run(
            appPackage.tenant_id,
            appPackage.workspace_id,
            displayName,
            gold.report_family,
            appPackage.inspection_id,
            displayName,
            gold.dataset_split,
            JSON.stringify({
              goldFirewall: true,
              sourcePackageSha256: appPackage.package_sha256,
              sourceReportJobId: appPackage.report_job_id,
            }),
            nowIso,
            evaluationCaseId,
          );
          await db.prepare(
            "DELETE FROM report_evaluation_case_sections WHERE evaluation_case_id = ?",
          ).run(evaluationCaseId);
        } else {
          await db.prepare(
            `INSERT INTO report_evaluation_cases (
              evaluation_case_id, tenant_id, workspace_id, display_name, report_family,
              input_inspection_id, gold_document_id, gold_source_report_name,
              dataset_split, label_status, config_json, created_by_user_id,
              created_at_iso, updated_at_iso
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'machine_proposed', ?, ?, ?, ?)`,
          ).run(
            evaluationCaseId,
            appPackage.tenant_id,
            appPackage.workspace_id,
            displayName,
            gold.report_family,
            appPackage.inspection_id,
            gold.document_id,
            displayName,
            gold.dataset_split,
            JSON.stringify({
              goldFirewall: true,
              sourcePackageSha256: appPackage.package_sha256,
              sourceReportJobId: appPackage.report_job_id,
            }),
            actorUserId,
            nowIso,
            nowIso,
          );
        }

        const sections = await db.prepare(
          `SELECT section_key
          FROM kb_sections
          WHERE document_id = ?
          ORDER BY stable_order`,
        ).all(gold.document_id);
        for (const section of sections) {
          await db.prepare(
            `INSERT INTO report_evaluation_case_sections (
              evaluation_case_id, section_id, gold_section_key, evaluation_enabled, config_json
            ) VALUES (?, ?, ?, TRUE, '{}'::jsonb)
            ON CONFLICT (evaluation_case_id, section_id) DO NOTHING`,
          ).run(evaluationCaseId, section.section_key, section.section_key);
        }
      });
    } catch (error) {
      if (error?.code === "23505") {
        throw createError(
          409,
          "This app inspection is already linked to an evaluation gold source with the same report identity.",
          "evaluation_case_conflict",
        );
      }
      throw error;
    }

    return getState();
  }
}

function mapDocument(row, evaluationCase) {
  const metadata = parseJson(row.metadata_json);
  const quality = parseJson(row.extraction_quality_json);
  const purpose = row.document_role === "evaluation_gold" && GOLD_SPLITS.has(row.dataset_split)
    ? "evaluation_gold"
    : "training_reference";
  const readiness = purpose !== "evaluation_gold"
    ? "reference_only"
    : evaluationCase?.reportJobId && evaluationCase.sourceStorageStatus === "stored"
      ? "ready"
      : "needs_app_package";
  return {
    documentId: row.document_id,
    caseId: row.case_id,
    displayName: String(metadata.localSourceName ?? metadata.fileName ?? row.document_id),
    reportFamily: row.report_family,
    documentRole: row.document_role,
    datasetSplit: row.dataset_split,
    purpose,
    readiness,
    retrievalEligible: Boolean(row.retrieval_eligible),
    sourceSha256: row.source_sha256,
    sourceStored: Boolean(row.source_object_key),
    ingestionRunId: row.ingestion_run_id,
    ingestionStatus: row.ingestion_status,
    qualityScore: Number(quality.score ?? 0),
    sectionCount: Number(row.section_count ?? 0),
    chunkCount: Number(row.chunk_count ?? 0),
    approvedAtIso: row.approved_at_iso,
    evaluationCaseId: evaluationCase?.evaluationCaseId ?? null,
  };
}

function mapAppPackage(row) {
  return {
    reportJobId: row.report_job_id,
    importId: row.import_id,
    inspectionId: row.inspection_id,
    reportReference: row.report_reference,
    title: row.title,
    client: row.client,
    tank: row.tank,
    inspectedDate: row.inspected_date,
    tenantId: row.tenant_id,
    workspaceId: row.workspace_id,
    packageType: row.package_type,
    schemaVersion: Number(row.schema_version),
    packageSha256: row.package_sha256,
    revisionNumber: Number(row.revision_number),
    sourceSha256: row.source_sha256,
    sourceStorageStatus: row.source_storage_status,
    exportedAtIso: row.exported_at_iso,
  };
}

function mapEvaluationCase(row) {
  return {
    evaluationCaseId: row.evaluation_case_id,
    goldDocumentId: row.gold_document_id,
    displayName: row.display_name,
    reportFamily: row.report_family,
    inputInspectionId: row.input_inspection_id,
    datasetSplit: row.dataset_split,
    labelStatus: row.label_status,
    configuration: parseJson(row.config_json),
    reportJobId: row.report_job_id,
    reportReference: row.report_reference,
    profileCode: row.profile_code ?? "unknown",
    profileDisplayName: row.profile_display_name ?? "Unknown capture style",
    deterministicSeed: Number(row.random_seed ?? 0),
    packageSha256: row.package_sha256,
    sourceStorageStatus: row.source_storage_status,
    enabledSectionCount: Number(row.enabled_section_count ?? 0),
    evalRunCount: Number(row.eval_run_count ?? 0),
    blockedEpisodeCount: Number(row.blocked_episode_count ?? 0),
    qualityIssueCount: Number(row.quality_issue_count ?? 0),
    meanScore: nullableNumber(row.mean_score),
    meanReward: nullableNumber(row.mean_reward),
    meanRequiredFactRecall: nullableNumber(row.mean_required_fact_recall),
    meanClaimPrecision: nullableNumber(row.mean_claim_precision),
    meanProtectedFactAccuracy: nullableNumber(row.mean_protected_fact_accuracy),
    nextSectionId: row.next_section_id ?? null,
    latestEvalAtIso: row.latest_eval_at_iso,
    createdAtIso: row.created_at_iso,
    updatedAtIso: row.updated_at_iso,
  };
}

function parseJson(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function nullableNumber(value) {
  return value == null ? null : Number(value);
}
