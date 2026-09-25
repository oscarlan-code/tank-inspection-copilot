import { createHash, randomUUID } from "node:crypto";

const DATASET_SPLITS = new Set(["training", "validation", "hidden_test", "unassigned"]);
const DOCUMENT_ROLES = new Set([
  "historical_source",
  "alternate_rendition",
  "structured_template",
  "standards_source",
  "specialist_evidence",
  "evaluation_gold",
  "quarantine",
]);
const LANE_CODES = new Set([
  "template_library",
  "wording_precedent",
  "historical_case_memory",
  "fact_recommendation",
  "standards_guidance",
  "specialist_evidence",
  "evaluation_gold",
  "quarantine",
]);
const DECISIONS = new Set(["approve", "reject", "quarantine", "reopen"]);
const WARNING_RESOLUTIONS = new Set(["accepted", "not_applicable", "needs_correction"]);

export function createKbReviewService({ db, createError }) {
  return {
    decideDocument,
    getCase,
    getDocumentSource,
    listCases,
    reviewWarning,
    updateDocument,
    updateSection,
  };

  async function listCases() {
    const [summary, rows] = await Promise.all([
      db.prepare(
        `SELECT
          COUNT(*) AS case_count,
          COUNT(*) FILTER (WHERE status_code = 'discovered') AS pending_count,
          COUNT(*) FILTER (WHERE status_code = 'approved') AS approved_count,
          COUNT(*) FILTER (WHERE status_code = 'quarantined') AS quarantined_count
        FROM kb_cases`,
      ).get(),
      db.prepare(
        `SELECT
          c.case_id,
          c.report_family,
          c.dataset_split,
          c.status_code,
          c.updated_at_iso,
          COUNT(d.document_id) AS document_count,
          COUNT(d.document_id) FILTER (WHERE d.approval_status = 'pending_review') AS pending_document_count,
          COUNT(d.document_id) FILTER (WHERE d.approval_status = 'approved') AS approved_document_count,
          COALESCE(MAX(d.metadata_json->>'localSourceName'), c.case_id) AS display_name,
          COALESCE(MAX((d.extraction_quality_json->>'score')::double precision), 0) AS quality_score
        FROM kb_cases c
        LEFT JOIN kb_documents d ON d.case_id = c.case_id
        GROUP BY c.case_id
        ORDER BY
          CASE c.status_code
            WHEN 'discovered' THEN 0
            WHEN 'reviewed' THEN 1
            WHEN 'approved' THEN 2
            WHEN 'quarantined' THEN 3
            ELSE 4
          END,
          c.updated_at_iso DESC`,
      ).all(),
    ]);
    return {
      summary: {
        total: Number(summary.case_count ?? 0),
        pending: Number(summary.pending_count ?? 0),
        approved: Number(summary.approved_count ?? 0),
        quarantined: Number(summary.quarantined_count ?? 0),
      },
      cases: rows.map(mapCaseSummary),
    };
  }

  async function getCase(caseId) {
    const kbCase = await db.prepare(
      `SELECT * FROM kb_cases WHERE case_id = ?`,
    ).get(caseId);
    if (!kbCase) throw notFound("KB review case was not found.", "kb_case_not_found");

    const documents = await db.prepare(
      `SELECT
        d.*,
        r.ingestion_run_id,
        r.status_code AS ingestion_status,
        r.quality_json,
        r.manifest_json,
        r.started_at_iso,
        r.completed_at_iso
      FROM kb_documents d
      LEFT JOIN LATERAL (
        SELECT *
        FROM kb_ingestion_runs candidate
        WHERE candidate.document_id = d.document_id
        ORDER BY candidate.started_at_iso DESC
        LIMIT 1
      ) r ON TRUE
      WHERE d.case_id = ?
      ORDER BY d.created_at_iso`,
    ).all(caseId);

    const documentDetails = [];
    for (const document of documents) {
      const [sections, escalations, decisions, warningReviews] = await Promise.all([
        db.prepare(
          `SELECT
            s.*,
            COUNT(c.chunk_id) AS chunk_count,
            COALESCE(SUM(length(c.content)), 0) AS character_count,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'chunkId', c.chunk_id,
                  'blockType', c.block_type,
                  'content', c.content,
                  'stableOrder', c.stable_order,
                  'pageNumbers', c.page_numbers_json,
                  'sourceBlockIds', c.source_block_ids_json,
                  'sourceSpans', c.source_spans_json
                ) ORDER BY c.stable_order
              ) FILTER (WHERE c.chunk_id IS NOT NULL),
              '[]'::jsonb
            ) AS chunks_json
          FROM kb_sections s
          LEFT JOIN kb_chunks c
            ON c.document_id = s.document_id
            AND c.section_type = s.section_key
          WHERE s.document_id = ?
          GROUP BY s.section_id
          ORDER BY s.stable_order`,
        ).all(document.document_id),
        db.prepare(
          `SELECT *
          FROM kb_ingestion_escalations
          WHERE document_id = ?
          ORDER BY created_at_iso`,
        ).all(document.document_id),
        db.prepare(
          `SELECT d.*, u.display_name AS actor_display_name
          FROM kb_review_decisions d
          LEFT JOIN platform_users u ON u.user_id = d.actor_user_id
          WHERE d.document_id = ?
          ORDER BY d.created_at_iso DESC
          LIMIT 50`,
        ).all(document.document_id),
        db.prepare(
          `SELECT r.*, u.display_name AS actor_display_name
          FROM kb_warning_reviews r
          LEFT JOIN platform_users u ON u.user_id = r.actor_user_id
          WHERE r.document_id = ? AND r.ingestion_run_id = ?
          ORDER BY r.reviewed_at_iso DESC`,
        ).all(document.document_id, document.ingestion_run_id),
      ]);
      documentDetails.push(mapDocumentDetail(
        document,
        sections,
        escalations,
        decisions,
        warningReviews,
      ));
    }

    return {
      case: {
        caseId: kbCase.case_id,
        tenantId: kbCase.tenant_id,
        workspaceId: kbCase.workspace_id,
        reportFamily: kbCase.report_family,
        datasetSplit: kbCase.dataset_split,
        status: kbCase.status_code,
        metadata: parseJson(kbCase.metadata_json),
        createdAtIso: kbCase.created_at_iso,
        updatedAtIso: kbCase.updated_at_iso,
      },
      documents: documentDetails,
    };
  }

  async function getDocumentSource(documentId) {
    const row = await db.prepare(
      `SELECT
        d.document_id,
        d.case_id,
        d.source_object_key,
        d.metadata_json,
        r.manifest_json
      FROM kb_documents d
      LEFT JOIN LATERAL (
        SELECT manifest_json
        FROM kb_ingestion_runs
        WHERE document_id = d.document_id
        ORDER BY started_at_iso DESC
        LIMIT 1
      ) r ON TRUE
      WHERE d.document_id = ?`,
    ).get(documentId);
    if (!row) throw notFound("KB document was not found.", "kb_document_not_found");
    if (!row.source_object_key) {
      throw createError(409, "This source has not been stored in object storage.", "kb_source_not_stored");
    }
    const manifest = parseJson(row.manifest_json);
    return {
      documentId: row.document_id,
      caseId: row.case_id,
      objectKey: row.source_object_key,
      fileName: parseJson(row.metadata_json)?.localSourceName ?? row.document_id,
      mediaType: manifest?.identity?.media_type ?? "application/octet-stream",
    };
  }

  async function updateDocument({ actorUserId, documentId, values }) {
    const datasetSplit = requireChoice(values.datasetSplit, DATASET_SPLITS, "dataset split", createError);
    const documentRole = requireChoice(values.documentRole, DOCUMENT_ROLES, "document role", createError);
    const reportFamily = requireText(values.reportFamily, "report family", 2, 120, createError);
    const reviewNotes = optionalText(values.reviewNotes, 4_000, createError);
    const before = await getDocumentState(documentId);
    if (before.approvalStatus === "approved") {
      throw createError(409, "Reopen the approved document before changing its classification.", "kb_document_reopen_required");
    }
    const now = new Date().toISOString();
    await db.transaction(async () => {
      await db.prepare(
        `UPDATE kb_documents
        SET document_role = ?, dataset_split = ?, review_notes = ?,
          metadata_json = metadata_json || '{"classificationSource":"manual","datasetAssignment":"explicit"}'::jsonb,
          approval_status = 'reviewed', reviewed_by_user_id = ?, reviewed_at_iso = ?,
          updated_at_iso = ?
        WHERE document_id = ?`,
      ).run(documentRole, datasetSplit, reviewNotes, actorUserId, now, now, documentId);
      if (datasetSplit !== "training") {
        await db.prepare(
          `UPDATE kb_sections
          SET include_in_retrieval = FALSE, updated_at_iso = ?
          WHERE document_id = ?`,
        ).run(now, documentId);
      }
      await db.prepare(
        `UPDATE kb_cases
        SET report_family = ?, dataset_split = ?, status_code = 'reviewed', updated_at_iso = ?
        WHERE case_id = ?`,
      ).run(reportFamily, datasetSplit, now, before.caseId);
      await insertDecision({
        actionCode: "metadata_saved",
        actorUserId,
        caseId: before.caseId,
        documentId,
        nextState: { datasetSplit, documentRole, reportFamily, reviewNotes },
        notes: reviewNotes,
        previousState: before,
      });
    });
    return getCase(before.caseId);
  }

  async function updateSection({ actorUserId, sectionId, values }) {
    const laneCode = requireChoice(values.laneCode, LANE_CODES, "knowledge lane", createError);
    const includeInRetrieval = Boolean(values.includeInRetrieval);
    const reviewNotes = optionalText(values.reviewNotes, 2_000, createError);
    if (includeInRetrieval && new Set(["evaluation_gold", "quarantine"]).has(laneCode)) {
      throw createError(
        409,
        "Evaluation-gold and quarantined sections cannot be included in generation retrieval.",
        "kb_section_lane_retrieval_conflict",
      );
    }
    const before = await getSectionState(sectionId);
    const document = await getDocumentState(before.documentId);
    if (includeInRetrieval && document.datasetSplit !== "training") {
      throw createError(
        409,
        "Only approved training precedent can be selected for generation retrieval.",
        "kb_dataset_retrieval_conflict",
      );
    }
    if (document.approvalStatus === "approved") {
      throw createError(409, "Reopen the approved document before changing a section.", "kb_document_reopen_required");
    }
    const now = new Date().toISOString();
    await db.transaction(async () => {
      await db.prepare(
        `UPDATE kb_sections
        SET lane_code = ?, include_in_retrieval = ?, review_notes = ?,
          metadata_json = metadata_json || '{"classificationSource":"manual"}'::jsonb,
          review_status = 'reviewed', reviewed_by_user_id = ?, reviewed_at_iso = ?,
          updated_at_iso = ?
        WHERE section_id = ?`,
      ).run(laneCode, includeInRetrieval, reviewNotes, actorUserId, now, now, sectionId);
      await insertDecision({
        actionCode: "section_classified",
        actorUserId,
        caseId: document.caseId,
        documentId: before.documentId,
        nextState: { includeInRetrieval, laneCode, reviewNotes },
        notes: reviewNotes,
        previousState: before,
        sectionId,
      });
    });
    return getCase(document.caseId);
  }

  async function reviewWarning({ actorUserId, documentId, issueKey, resolution, notes }) {
    const resolutionCode = requireChoice(
      resolution,
      WARNING_RESOLUTIONS,
      "warning resolution",
      createError,
    );
    const reviewerNotes = optionalText(notes, 2_000, createError);
    if (resolutionCode === "needs_correction" && reviewerNotes.length < 3) {
      throw createError(
        400,
        "Describe what must be corrected before saving this warning outcome.",
        "kb_warning_correction_note_required",
      );
    }
    const document = await getDocumentState(documentId);
    if (document.approvalStatus === "approved") {
      throw createError(
        409,
        "Reopen the approved document before changing a warning review.",
        "kb_document_reopen_required",
      );
    }
    const latestRun = await db.prepare(
      `SELECT ingestion_run_id, quality_json
      FROM kb_ingestion_runs
      WHERE document_id = ?
      ORDER BY started_at_iso DESC
      LIMIT 1`,
    ).get(documentId);
    if (!latestRun) {
      throw createError(409, "The document has no ingestion run to review.", "kb_ingestion_run_required");
    }
    const quality = mapQuality(parseJson(latestRun.quality_json));
    const issue = quality.issues.find((candidate) => candidate.issueKey === issueKey);
    if (!issue || issue.severity === "info") {
      throw notFound("The extraction warning was not found in the latest ingestion run.", "kb_warning_not_found");
    }

    const now = new Date().toISOString();
    const previous = await db.prepare(
      `SELECT resolution_code, reviewer_notes, reviewed_at_iso
      FROM kb_warning_reviews
      WHERE document_id = ? AND ingestion_run_id = ? AND issue_key = ?`,
    ).get(documentId, latestRun.ingestion_run_id, issueKey);
    await db.transaction(async () => {
      await db.prepare(
        `INSERT INTO kb_warning_reviews (
          warning_review_id, document_id, ingestion_run_id, issue_key,
          resolution_code, issue_snapshot_json, reviewer_notes, actor_user_id,
          reviewed_at_iso, created_at_iso, updated_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (document_id, ingestion_run_id, issue_key)
        DO UPDATE SET
          resolution_code = EXCLUDED.resolution_code,
          issue_snapshot_json = EXCLUDED.issue_snapshot_json,
          reviewer_notes = EXCLUDED.reviewer_notes,
          actor_user_id = EXCLUDED.actor_user_id,
          reviewed_at_iso = EXCLUDED.reviewed_at_iso,
          updated_at_iso = EXCLUDED.updated_at_iso`,
      ).run(
        randomUUID(),
        documentId,
        latestRun.ingestion_run_id,
        issueKey,
        resolutionCode,
        JSON.stringify(issue),
        reviewerNotes,
        actorUserId,
        now,
        now,
        now,
      );
      await insertDecision({
        actionCode: "warning_reviewed",
        actorUserId,
        caseId: document.caseId,
        documentId,
        nextState: { issueKey, resolution: resolutionCode },
        notes: reviewerNotes,
        previousState: previous ?? {},
      });
    });
    return getCase(document.caseId);
  }

  async function decideDocument({ action, actorUserId, documentId, notes }) {
    if (!DECISIONS.has(action)) {
      throw createError(400, "Unsupported KB review decision.", "kb_review_decision_invalid");
    }
    const reviewNotes = optionalText(notes, 4_000, createError);
    const before = await getDocumentState(documentId);
    const now = new Date().toISOString();
    let automaticDefaults = { applied: false, includedSectionCount: 0 };
    let approvalStatus;
    let caseStatus;
    let actionCode;

    if (action === "approve") {
      approvalStatus = "approved";
      caseStatus = "approved";
      actionCode = "approved";
    } else if (action === "reject") {
      approvalStatus = "rejected";
      caseStatus = "reviewed";
      actionCode = "rejected";
    } else if (action === "quarantine") {
      approvalStatus = "rejected";
      caseStatus = "quarantined";
      actionCode = "quarantined";
    } else {
      approvalStatus = "pending_review";
      caseStatus = "reviewed";
      actionCode = "reopened";
    }

    await db.transaction(async () => {
      if (action === "approve") {
        automaticDefaults = await applyAutomaticApprovalDefaults({
          actorUserId,
          document: before,
          documentId,
          now,
        });
        await assertApprovalReady(documentId, await getDocumentState(documentId));
      }
      await db.prepare(
        `UPDATE kb_documents
        SET approval_status = ?, retrieval_eligible = FALSE, review_notes = ?,
          reviewed_by_user_id = ?, reviewed_at_iso = ?,
          approved_by_user_id = ?, approved_at_iso = ?, updated_at_iso = ?
        WHERE document_id = ?`,
      ).run(
        approvalStatus,
        reviewNotes,
        actorUserId,
        now,
        action === "approve" ? actorUserId : null,
        action === "approve" ? now : null,
        now,
        documentId,
      );
      await db.prepare(
        `UPDATE kb_cases SET status_code = ?, updated_at_iso = ? WHERE case_id = ?`,
      ).run(caseStatus, now, before.caseId);
      await insertDecision({
        actionCode,
        actorUserId,
        caseId: before.caseId,
        documentId,
        nextState: {
          approvalStatus,
          automaticDefaults,
          caseStatus,
          retrievalEligible: false,
        },
        notes: reviewNotes,
        previousState: before,
      });
    });
    return getCase(before.caseId);
  }

  async function applyAutomaticApprovalDefaults({ actorUserId, document, documentId, now }) {
    if (document.datasetSplit !== "training") {
      return { applied: false, includedSectionCount: 0 };
    }
    const candidates = await db.prepare(
      `SELECT section_id
      FROM kb_sections
      WHERE document_id = ?
        AND include_in_retrieval = FALSE
        AND review_status = 'pending_review'
        AND lane_code NOT IN ('evaluation_gold', 'quarantine')
        AND metadata_json->>'classificationSource' = 'automatic'
        AND COALESCE((metadata_json->>'automaticRetrievalCandidate')::boolean, FALSE) = TRUE
      ORDER BY stable_order`,
    ).all(documentId);
    for (const candidate of candidates) {
      await db.prepare(
        `UPDATE kb_sections
        SET include_in_retrieval = TRUE, review_status = 'reviewed',
          reviewed_by_user_id = ?, reviewed_at_iso = ?, updated_at_iso = ?
        WHERE section_id = ?`,
      ).run(actorUserId, now, now, candidate.section_id);
    }
    return {
      applied: candidates.length > 0,
      includedSectionCount: candidates.length,
    };
  }

  async function assertApprovalReady(documentId, document) {
    if (document.datasetSplit === "unassigned") {
      throw createError(409, "Assign a dataset split before approval.", "kb_dataset_split_required");
    }
    if (!document.sourceObjectKey) {
      throw createError(409, "Store the immutable source before approval.", "kb_source_not_stored");
    }
    if (document.qualityStatus === "failed") {
      throw createError(409, "Failed extraction quality blocks approval.", "kb_extraction_failed");
    }
    const latestRun = await db.prepare(
      `SELECT ingestion_run_id, quality_json
      FROM kb_ingestion_runs
      WHERE document_id = ?
      ORDER BY started_at_iso DESC
      LIMIT 1`,
    ).get(documentId);
    if (latestRun) {
      const requiredIssues = mapQuality(parseJson(latestRun.quality_json)).issues.filter(
        (issue) => issue.severity !== "info",
      );
      const reviews = await db.prepare(
        `SELECT issue_key, resolution_code
        FROM kb_warning_reviews
        WHERE document_id = ? AND ingestion_run_id = ?`,
      ).all(documentId, latestRun.ingestion_run_id);
      const reviewByIssue = new Map(reviews.map((review) => [review.issue_key, review.resolution_code]));
      const unresolvedIssues = requiredIssues.filter((issue) => !new Set([
        "accepted",
        "not_applicable",
      ]).has(reviewByIssue.get(issue.issueKey)));
      if (unresolvedIssues.length > 0) {
        const correctionCount = unresolvedIssues.filter(
          (issue) => reviewByIssue.get(issue.issueKey) === "needs_correction",
        ).length;
        throw createError(
          409,
          correctionCount > 0
            ? `${correctionCount} extraction warning(s) still require correction before approval.`
            : `Review all ${unresolvedIssues.length} extraction warning(s) before approval.`,
          "kb_warning_review_required",
        );
      }
    }
    const sections = await db.prepare(
      `SELECT review_status, include_in_retrieval FROM kb_sections WHERE document_id = ?`,
    ).all(documentId);
    if (sections.length === 0) {
      throw createError(409, "At least one extracted section is required.", "kb_sections_required");
    }
    const included = sections.filter((section) => section.include_in_retrieval);
    if (document.datasetSplit === "training" && included.length === 0) {
      throw createError(
        409,
        "Training sources require at least one reviewed section selected for retrieval.",
        "kb_retrieval_section_required",
      );
    }
    if (included.some((section) => section.review_status !== "reviewed")) {
      throw createError(409, "Review every included section before approval.", "kb_section_review_required");
    }
  }

  async function getDocumentState(documentId) {
    const row = await db.prepare(
      `SELECT
        d.document_id,
        d.case_id,
        d.document_role,
        d.dataset_split,
        d.approval_status,
        d.retrieval_eligible,
        d.source_object_key,
        d.metadata_json,
        d.review_notes,
        r.quality_json
      FROM kb_documents d
      LEFT JOIN LATERAL (
        SELECT quality_json FROM kb_ingestion_runs
        WHERE document_id = d.document_id
        ORDER BY started_at_iso DESC LIMIT 1
      ) r ON TRUE
      WHERE d.document_id = ?`,
    ).get(documentId);
    if (!row) throw notFound("KB document was not found.", "kb_document_not_found");
    const metadata = parseJson(row.metadata_json) ?? {};
    return {
      approvalStatus: row.approval_status,
      caseId: row.case_id,
      datasetSplit: row.dataset_split,
      documentId: row.document_id,
      documentRole: row.document_role,
      datasetAssignment: metadata.datasetAssignment ?? "explicit",
      qualityStatus: parseJson(row.quality_json)?.status ?? "needs_review",
      retrievalEligible: Boolean(row.retrieval_eligible),
      reviewNotes: row.review_notes,
      sourceObjectKey: row.source_object_key,
    };
  }

  async function getSectionState(sectionId) {
    const row = await db.prepare(
      `SELECT section_id, document_id, lane_code, include_in_retrieval, review_status, review_notes
      FROM kb_sections WHERE section_id = ?`,
    ).get(sectionId);
    if (!row) throw notFound("KB section was not found.", "kb_section_not_found");
    return {
      documentId: row.document_id,
      includeInRetrieval: Boolean(row.include_in_retrieval),
      laneCode: row.lane_code,
      reviewNotes: row.review_notes,
      reviewStatus: row.review_status,
      sectionId: row.section_id,
    };
  }

  async function insertDecision({
    actionCode,
    actorUserId,
    caseId,
    documentId,
    nextState,
    notes,
    previousState,
    sectionId = null,
  }) {
    await db.prepare(
      `INSERT INTO kb_review_decisions (
        decision_id, case_id, document_id, section_id, actor_user_id,
        action_code, previous_state_json, next_state_json, notes, created_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      randomUUID(),
      caseId,
      documentId,
      sectionId,
      actorUserId,
      actionCode,
      JSON.stringify(previousState),
      JSON.stringify(nextState),
      notes,
      new Date().toISOString(),
    );
  }

  function notFound(message, code) {
    return createError(404, message, code);
  }
}

function mapCaseSummary(row) {
  return {
    caseId: row.case_id,
    displayName: row.display_name,
    reportFamily: row.report_family,
    datasetSplit: row.dataset_split,
    status: row.status_code,
    documentCount: Number(row.document_count ?? 0),
    pendingDocumentCount: Number(row.pending_document_count ?? 0),
    approvedDocumentCount: Number(row.approved_document_count ?? 0),
    qualityScore: Number(row.quality_score ?? 0),
    updatedAtIso: row.updated_at_iso,
  };
}

function mapDocumentDetail(document, sections, escalations, decisions, warningReviews) {
  const quality = parseJson(document.quality_json) ?? parseJson(document.extraction_quality_json);
  const manifest = parseJson(document.manifest_json);
  const documentMetadata = parseJson(document.metadata_json) ?? {};
  return {
    documentId: document.document_id,
    caseId: document.case_id,
    fileName: documentMetadata.localSourceName ?? document.document_id,
    documentRole: document.document_role,
    datasetSplit: document.dataset_split,
    datasetAssignment: documentMetadata.datasetAssignment ?? "explicit",
    datasetGroupKey: documentMetadata.datasetGroupKey ?? null,
    approvalStatus: document.approval_status,
    retrievalEligible: Boolean(document.retrieval_eligible),
    sourceObjectKey: document.source_object_key,
    sourceSha256: document.source_sha256,
    sourceMediaType: manifest?.identity?.media_type ?? "application/octet-stream",
    parserName: document.parser_name,
    parserVersion: document.parser_version,
    reviewNotes: document.review_notes,
    reviewedAtIso: document.reviewed_at_iso,
    approvedAtIso: document.approved_at_iso,
    quality: mapQuality(quality, warningReviews),
    ingestionRun: document.ingestion_run_id ? {
      ingestionRunId: document.ingestion_run_id,
      status: document.ingestion_status,
      startedAtIso: document.started_at_iso,
      completedAtIso: document.completed_at_iso,
    } : null,
    sections: sections.map((section) => ({
      sectionId: section.section_id,
      sectionKey: section.section_key,
      originalHeading: section.original_heading,
      stableOrder: section.stable_order,
      reviewStatus: section.review_status,
      laneCode: section.lane_code,
      includeInRetrieval: Boolean(section.include_in_retrieval),
      classificationSource: parseJson(section.metadata_json)?.classificationSource ?? "manual",
      automaticRetrievalCandidate: Boolean(
        parseJson(section.metadata_json)?.automaticRetrievalCandidate,
      ),
      qualityWarning: Boolean(parseJson(section.metadata_json)?.qualityWarning),
      reviewNotes: section.review_notes,
      reviewedAtIso: section.reviewed_at_iso,
      chunkCount: Number(section.chunk_count ?? 0),
      characterCount: Number(section.character_count ?? 0),
      chunks: (parseJson(section.chunks_json) ?? []).map(mapChunk),
    })),
    escalations: escalations.map((row) => ({
      requestId: row.request_id,
      taskCode: row.task_code,
      status: row.status_code,
      request: parseJson(row.request_json),
      annotation: parseJson(row.annotation_json),
    })),
    decisions: decisions.map((row) => ({
      decisionId: row.decision_id,
      action: row.action_code,
      actorDisplayName: row.actor_display_name ?? "System",
      notes: row.notes,
      createdAtIso: row.created_at_iso,
      sectionId: row.section_id,
    })),
  };
}

function mapChunk(chunk) {
  return {
    ...chunk,
    stableOrder: Number(chunk.stableOrder),
    sourceSpans: (chunk.sourceSpans ?? []).map((span) => ({
      sourceBlockId: span.source_block_id ?? span.sourceBlockId,
      pageNumber: Number(span.page_number ?? span.pageNumber),
      bbox: span.bbox,
    })),
  };
}

function mapQuality(quality, warningReviews = []) {
  const value = quality ?? {};
  const reviewByIssue = new Map(warningReviews.map((review) => [review.issue_key, review]));
  return {
    status: value.status ?? "needs_review",
    score: Number(value.score ?? 0),
    textPageCoverage: Number(value.text_page_coverage ?? value.textPageCoverage ?? 0),
    provenanceCoverage: Number(
      value.provenance_coverage ?? value.provenanceCoverage ?? 0,
    ),
    headingCount: Number(value.heading_count ?? value.headingCount ?? 0),
    tableCount: Number(value.table_count ?? value.tableCount ?? 0),
    issues: (value.issues ?? []).map((issue) => {
      const normalized = {
        code: issue.issue_code ?? issue.code ?? "extraction_review",
        severity: issue.severity ?? "warning",
        message: issue.message ?? "Extraction review is required.",
        blockIds: issue.block_ids ?? issue.blockIds ?? [],
        pageNumbers: issue.page_numbers ?? issue.pageNumbers ?? [],
      };
      const issueKey = createWarningIssueKey(normalized);
      const review = reviewByIssue.get(issueKey);
      return {
        ...normalized,
        issueKey,
        review: review ? {
          resolution: review.resolution_code,
          notes: review.reviewer_notes,
          actorDisplayName: review.actor_display_name ?? "System",
          reviewedAtIso: review.reviewed_at_iso,
        } : null,
      };
    }),
  };
}

function createWarningIssueKey(issue) {
  return createHash("sha256").update(JSON.stringify({
    blockIds: [...issue.blockIds].sort(),
    code: issue.code,
    message: issue.message,
    pageNumbers: [...issue.pageNumbers].sort((left, right) => left - right),
    severity: issue.severity,
  })).digest("hex").slice(0, 24);
}

function parseJson(value) {
  if (value == null) return null;
  return typeof value === "string" ? JSON.parse(value) : value;
}

function requireChoice(value, allowed, label, createError) {
  const normalized = String(value ?? "").trim();
  if (!allowed.has(normalized)) {
    throw createError(400, `Unsupported ${label}.`, "kb_review_input_invalid");
  }
  return normalized;
}

function requireText(value, label, minimum, maximum, createError) {
  const normalized = String(value ?? "").trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw createError(
      400,
      `${label} must be ${minimum}-${maximum} characters.`,
      "kb_review_input_invalid",
    );
  }
  return normalized;
}

function optionalText(value, maximum, createError) {
  const normalized = String(value ?? "").trim();
  if (normalized.length > maximum) {
    throw createError(
      400,
      `Review notes cannot exceed ${maximum} characters.`,
      "kb_review_input_invalid",
    );
  }
  return normalized;
}
