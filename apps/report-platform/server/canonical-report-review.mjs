import { buildCanonicalReportQueue, buildKbCorpusInventory } from "./kb-corpus-inventory.mjs";

const SAMPLE_REPORTS_ROOT = process.env.PRECEDENT_SAMPLE_REPORTS_DIR
  ?? "/Users/oscar/Public/irs/Sample Reports";
const ALLOWED_STATUSES = new Set(["pending_review", "approved_for_ingestion", "quarantined"]);
const ALLOWED_SPLITS = new Set(["training", "validation", "hidden_test", "unassigned"]);

export function createCanonicalReportReviewService({ db, createError }) {
  return { getIngestionStatus, getQueue, reviewGroup };

  async function getIngestionStatus() {
    const job = await db.prepare(
      "SELECT * FROM canonical_ingestion_jobs WHERE job_id = 'canonical_bulk_v1'",
    ).get();
    const counts = await db.prepare(
      `SELECT
        COUNT(DISTINCT d.document_id)::int AS completed_reports,
        COUNT(DISTINCT s.section_id)::int AS sections,
        COUNT(DISTINCT ch.chunk_id)::int AS chunks
      FROM kb_documents d
      LEFT JOIN kb_sections s ON s.document_id = d.document_id
      LEFT JOIN kb_chunks ch ON ch.document_id = d.document_id
      WHERE d.document_id LIKE 'canonical_kba_%'`,
    ).get();
    const total = Number(job?.total_reports ?? 0);
    const completed = Number(counts?.completed_reports ?? 0);
    return {
      status: job?.status_code ?? "idle",
      totalReports: total,
      completedReports: completed,
      remainingReports: Math.max(total - completed, 0),
      failedReports: Number(job?.failed_reports ?? 0),
      currentFileName: job?.current_file_name ?? null,
      sections: Number(counts?.sections ?? 0),
      chunks: Number(counts?.chunks ?? 0),
      failures: job?.failures_json ?? [],
      startedAtIso: job?.started_at_iso ?? null,
      updatedAtIso: job?.updated_at_iso ?? null,
      completedAtIso: job?.completed_at_iso ?? null,
      progressPercent: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
    };
  }

  async function getQueue() {
    const rows = await db.prepare("SELECT * FROM canonical_report_review_decisions").all();
    const decisions = new Map(rows.map((row) => [row.group_key, row]));
    const inventory = buildKbCorpusInventory({ sampleReportsDir: SAMPLE_REPORTS_ROOT });
    return buildCanonicalReportQueue(inventory, decisions);
  }

  async function reviewGroup({ actorUserId, groupKey, values }) {
    const queue = await getQueue();
    const report = queue.reports.find((item) => item.groupKey === groupKey);
    if (!report) throw createError(404, "Canonical report candidate was not found.", "canonical_report_not_found");
    const selectedAssetId = String(values.selectedCanonicalAssetId ?? "").trim();
    const selected = report.assets.find((asset) => asset.assetId === selectedAssetId);
    if (!selected) throw createError(400, "Select a rendition from this logical report.", "canonical_asset_invalid");
    const reportFamily = requireText(values.reportFamily, "report family", 2, 120);
    const datasetSplit = String(values.datasetSplit ?? "");
    const status = String(values.status ?? "");
    if (!ALLOWED_SPLITS.has(datasetSplit)) throw createError(400, "Unsupported dataset split.", "canonical_split_invalid");
    if (!ALLOWED_STATUSES.has(status)) throw createError(400, "Unsupported review decision.", "canonical_status_invalid");
    const lineage = String(values.assetLineageKey ?? "").trim() || null;
    if (["validation", "hidden_test"].includes(datasetSplit) && !lineage) {
      throw createError(400, "Validation and hidden-test reports require an asset lineage key.", "canonical_lineage_required");
    }
    if (status === "approved_for_ingestion" && datasetSplit === "unassigned") {
      throw createError(400, "Assign a dataset split before approval for ingestion.", "canonical_split_required");
    }
    const nowIso = new Date().toISOString();
    await db.prepare(
      `INSERT INTO canonical_report_review_decisions (
        group_key, selected_asset_id, selected_relative_path, report_family,
        dataset_split, asset_lineage_key, status_code, review_notes,
        reviewed_by_user_id, reviewed_at_iso, updated_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (group_key) DO UPDATE SET
        selected_asset_id = excluded.selected_asset_id,
        selected_relative_path = excluded.selected_relative_path,
        report_family = excluded.report_family,
        dataset_split = excluded.dataset_split,
        asset_lineage_key = excluded.asset_lineage_key,
        status_code = excluded.status_code,
        review_notes = excluded.review_notes,
        reviewed_by_user_id = excluded.reviewed_by_user_id,
        reviewed_at_iso = excluded.reviewed_at_iso,
        updated_at_iso = excluded.updated_at_iso`,
    ).run(groupKey, selected.assetId, selected.relativePath, reportFamily, datasetSplit,
      lineage, status, String(values.reviewNotes ?? "").trim(), actorUserId, nowIso, nowIso);
    return getQueue();
  }

  function requireText(value, label, minimum, maximum) {
    const normalized = String(value ?? "").trim();
    if (normalized.length < minimum || normalized.length > maximum) {
      throw createError(400, `${label} must be ${minimum}-${maximum} characters.`, "canonical_value_invalid");
    }
    return normalized;
  }
}
