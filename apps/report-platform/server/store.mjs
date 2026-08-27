import { createHash, randomUUID } from "node:crypto";
import {
  generateSectionAssistantReply,
  generateSectionDraft,
  generateTargetedSectionEdit,
  getAiStatus,
  getSectionTemplate,
  MANUAL_FIELD_LABELS,
} from "./generation.mjs";
import { evaluateGeneratedSection, evaluateGoldSectionRecovery, evaluateSectionFormatContract, evaluateTruthGraphRecovery } from "./eval.mjs";
import { evaluateSemanticSectionSimilarity } from "./semantic-eval.mjs";
import { classifyReportPackage } from "./report-classification.mjs";
import { API_STANDARD_REPORT_TOC } from "./report-toc.mjs";
import { mapSourcePageToReportSection } from "./capture-section-mapping.mjs";
import { createPostgresDatabase } from "./storage/postgres.mjs";
import { createKbReviewService } from "./kb-review.mjs";
import { createCanonicalReportReviewService } from "./canonical-report-review.mjs";
import { createEvaluationLabService } from "./evaluation-lab.mjs";
import { buildRetrievalFirewallContext, createTrainingHarnessService } from "./training-harness.mjs";
import {
  createSystemRlController,
  SYSTEM_RL_MODES,
} from "./system-rl-policy.mjs";

export class ApiError extends Error {
  constructor(statusCode, message, code = "report_platform_api_error") {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export async function createReportStore({ databaseUrl }) {
  const db = await createPostgresDatabase({ databaseUrl });
  const systemRl = createSystemRlController({ db });
  const kbReview = createKbReviewService({
    db,
    createError: (statusCode, message, code) => new ApiError(statusCode, message, code),
  });
  const canonicalReportReview = createCanonicalReportReviewService({
    db,
    createError: (statusCode, message, code) => new ApiError(statusCode, message, code),
  });
  const evaluationLab = createEvaluationLabService({
    db,
    createError: (statusCode, message, code) => new ApiError(statusCode, message, code),
  });
  const trainingHarness = createTrainingHarnessService({
    db,
    createError: (statusCode, message, code) => new ApiError(statusCode, message, code),
  });

  return {
    approveSection,
    approveCaptureVariant: trainingHarness.approveCaptureVariant,
    completeCaptureVariantRoundTrip: trainingHarness.completeCaptureVariantRoundTrip,
    acceptAutomatedTruthDraft: trainingHarness.acceptAutomatedTruthDraft,
    approveTruthCase: trainingHarness.approveTruthCase,
    buildCaptureVariantManifest: trainingHarness.buildCaptureVariantManifest,
    buildTruthGraphManifest: trainingHarness.buildTruthGraphManifest,
    bootstrapInitialSuperAdmin,
    close: db.close,
    clearLoginThrottles,
    createAuthSession,
    createManagedAccount,
    createManagedTenant,
    createManagedWorkspace,
    createBenchmarkSnapshot: trainingHarness.createBenchmarkSnapshot,
    createObjectUploadSession,
    createPasswordCredentialIfMissing,
    createTrainingCase: trainingHarness.createTrainingCase,
    createCaptureVariants: trainingHarness.createCaptureVariants,
    createTruthCaseFromApprovedSource: trainingHarness.createTruthCaseFromApprovedSource,
    deleteReportArtifactRun,
    ensureDevelopmentUsers,
    ensureCaptureVariantEvaluationCase: evaluationLab.ensureCaptureVariantCase,
    ensureSeedReport,
    generateSection,
    getAuthSession,
    getHealth,
    getEvaluationLabState: evaluationLab.getState,
    getTrainingCase: trainingHarness.getTrainingCase,
    getCaptureVariant: trainingHarness.getCaptureVariant,
    getCaptureVariantBuilderState: trainingHarness.getCaptureVariantBuilderState,
    getCanonicalReportReviewQueue: canonicalReportReview.getQueue,
    getCanonicalReportIngestionStatus: canonicalReportReview.getIngestionStatus,
    getTruthCase: trainingHarness.getTruthCase,
    getTruthCaseBuilderState: trainingHarness.getTruthCaseBuilderState,
    getLoginThrottle,
    getPasswordCredential,
    getReportArtifactObject,
    listReportArtifactRunObjectKeys,
    getReportObjectByAttachmentId,
    getReportScope,
    getSystemRlStatus: systemRl.getStatus,
    getSystemRlHeldOutReview,
    getObjectUploadSession,
    getUserPrincipal,
    getUserPrincipalBySubject,
    importAndroidV2ProductExport,
    listAccessibleReportJobs,
    listManagedAccounts,
    listManagedTenants,
    listDevelopmentUsers,
    listKbReviewCases: kbReview.listCases,
    linkEvaluationLabCase: evaluationLab.linkCase,
    lockBenchmarkSnapshot: trainingHarness.lockBenchmarkSnapshot,
    deleteManagedAccount,
    loadEvalRuns,
    loadBootstrapReport,
    loadReportJobState,
    loadLatestEvalRun,
    loadKbReviewCase: kbReview.getCase,
    markObjectUploadVerified,
    promoteSystemRlPolicy,
    proposeTruthFacts: trainingHarness.proposeTruthFacts,
    previewTargetedSectionEdit,
    replyToSectionChat,
    recordLoginFailure,
    registerBenchmarkDocument: trainingHarness.registerBenchmarkDocument,
    refreshAuthSession,
    resetManagedAccountPassword,
    reviewTruthFact: trainingHarness.reviewTruthFact,
    reviewKbWarning: kbReview.reviewWarning,
    reviewCanonicalReportGroup: canonicalReportReview.reviewGroup,
    getKbReviewDocumentSource: kbReview.getDocumentSource,
    completeObjectUploadSession,
    resetReportDrafts,
    rollbackSystemRlPolicy,
    revokeAuthSession,
    restorePreviousSectionDraft,
    saveLayoutOverride,
    saveManualInputs,
    saveReportArtifactObjects,
    saveSectionDraft,
    setManagedAccountStatus,
    updateKbReviewDocument: kbReview.updateDocument,
    updateKbReviewSection: kbReview.updateSection,
    decideKbReviewDocument: kbReview.decideDocument,
    runSystemRlEvaluation,
    upsertPasswordCredential,
    upsertTrainingTruthFact: trainingHarness.upsertTruthFact,
  };

  async function createObjectUploadSession({
    actorUserId,
    exportPackage,
    sourceExportPackage = exportPackage,
    idempotencyKey,
    objects,
    expiresAtIso,
    requestSha256,
  }) {
    await ensureUserWorkspaceMembership(
      actorUserId,
      exportPackage.tenantId,
      exportPackage.workspaceId,
    );
    const packageSha256 = requestSha256 ?? buildPackageFingerprint(exportPackage);
    const existing = await db.prepare(
      `SELECT upload_session_id, package_sha256
      FROM report_object_upload_sessions
      WHERE actor_user_id = ? AND idempotency_key = ?`,
    ).get(actorUserId, idempotencyKey);
    if (existing) {
      if (existing.package_sha256 !== packageSha256) {
        throw new ApiError(
          409,
          "This idempotency key is already assigned to a different export package.",
          "upload_idempotency_conflict",
        );
      }
      return getObjectUploadSession({
        actorUserId,
        uploadSessionId: existing.upload_session_id,
      });
    }

    const uploadSessionId = randomUUID();
    const nowIso = new Date().toISOString();
    try {
      await inTransaction(async () => {
        await db.prepare(
        `INSERT INTO report_object_upload_sessions (
          upload_session_id, tenant_id, workspace_id, inspection_id, actor_user_id,
          idempotency_key, package_sha256, export_package_json, source_export_package_json, status_code,
          expires_at_iso, created_at_iso, updated_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_objects', ?, ?, ?)`,
        ).run(
          uploadSessionId,
          exportPackage.tenantId,
          exportPackage.workspaceId,
          exportPackage.inspectionId,
          actorUserId,
          idempotencyKey,
          packageSha256,
          JSON.stringify(exportPackage),
          JSON.stringify(sourceExportPackage),
          expiresAtIso,
          nowIso,
          nowIso,
        );

        for (const object of objects) {
          await db.prepare(
          `INSERT INTO report_object_uploads (
            object_id, upload_session_id, attachment_id, relative_path,
            attachment_kind, media_type, expected_byte_size, expected_sha256,
            object_key, status_code, created_at_iso, updated_at_iso
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_upload', ?, ?)`,
          ).run(
            object.objectId,
            uploadSessionId,
            object.attachmentId,
            object.relativePath,
            object.attachmentKind,
            object.mediaType,
            object.expectedByteSize,
            object.expectedSha256,
            object.objectKey,
            nowIso,
            nowIso,
          );
        }
      });
    } catch (error) {
      if (error?.code !== "23505") throw error;
      const raced = await db.prepare(
        `SELECT upload_session_id, package_sha256
        FROM report_object_upload_sessions
        WHERE actor_user_id = ? AND idempotency_key = ?`,
      ).get(actorUserId, idempotencyKey);
      if (!raced || raced.package_sha256 !== packageSha256) {
        throw new ApiError(
          409,
          "This idempotency key is already assigned to a different export package.",
          "upload_idempotency_conflict",
        );
      }
      return getObjectUploadSession({
        actorUserId,
        uploadSessionId: raced.upload_session_id,
      });
    }

    return getObjectUploadSession({ actorUserId, uploadSessionId });
  }

  async function getObjectUploadSession({ actorUserId, uploadSessionId }) {
    const row = await db.prepare(
      `SELECT *
      FROM report_object_upload_sessions
      WHERE upload_session_id = ? AND actor_user_id = ?`,
    ).get(uploadSessionId, actorUserId);
    if (!row) {
      throw new ApiError(404, "Upload session was not found.", "upload_session_not_found");
    }
    const objectRows = await db.prepare(
      `SELECT *
      FROM report_object_uploads
      WHERE upload_session_id = ?
      ORDER BY attachment_id`,
    ).all(uploadSessionId);
    return mapObjectUploadSession(row, objectRows);
  }

  async function markObjectUploadVerified({
    actorUserId,
    uploadSessionId,
    objectId,
    byteSize,
    sha256,
  }) {
    await getObjectUploadSession({ actorUserId, uploadSessionId });
    const nowIso = new Date().toISOString();
    const result = await db.prepare(
      `UPDATE report_object_uploads
      SET status_code = 'verified',
        verified_byte_size = ?,
        verified_sha256 = ?,
        verified_at_iso = ?,
        updated_at_iso = ?
      WHERE upload_session_id = ? AND object_id = ?`,
    ).run(byteSize, sha256, nowIso, nowIso, uploadSessionId, objectId);
    if (result.rowCount === 0) {
      throw new ApiError(404, "Upload object was not found.", "upload_object_not_found");
    }
  }

  async function completeObjectUploadSession({ actorUserId, uploadSessionId, reportJobId }) {
    const session = await getObjectUploadSession({ actorUserId, uploadSessionId });
    if (session.statusCode === "imported" && session.finalizedReportJobId) {
      return session;
    }
    const pending = session.objects.filter((object) => object.statusCode !== "verified");
    if (pending.length > 0) {
      throw new ApiError(
        409,
        `${pending.length} attachment object(s) have not been verified.`,
        "upload_objects_not_verified",
      );
    }
    const report = await db.prepare(
      `SELECT report_job_id, import_id, created_by_user_id
      FROM report_jobs
      WHERE report_job_id = ?`,
    ).get(reportJobId);
    if (!report || report.created_by_user_id !== actorUserId) {
      throw new ApiError(404, "Finalized report job was not found.", "report_job_not_found");
    }
    const nowIso = new Date().toISOString();
    await db.prepare(
      `UPDATE report_object_upload_sessions
      SET status_code = 'imported',
        finalized_import_id = ?,
        finalized_report_job_id = ?,
        finalized_at_iso = ?,
        updated_at_iso = ?
      WHERE upload_session_id = ? AND actor_user_id = ?`,
    ).run(report.import_id, report.report_job_id, nowIso, nowIso, uploadSessionId, actorUserId);
    return getObjectUploadSession({ actorUserId, uploadSessionId });
  }

  async function getReportObjectByAttachmentId(reportJobId, attachmentId) {
    const row = await db.prepare(
      `SELECT rou.*
      FROM report_object_uploads rou
      JOIN report_object_upload_sessions rous
        ON rous.upload_session_id = rou.upload_session_id
      WHERE rous.finalized_report_job_id = ?
        AND rou.attachment_id = ?
        AND rou.status_code = 'verified'`,
    ).get(reportJobId, attachmentId);
    return row ? mapObjectUpload(row) : null;
  }

  async function saveReportArtifactObjects({
    actorUserId,
    artifactKind,
    artifactRunId,
    artifacts,
    originalFileName,
    reportJobId,
  }) {
    await ensureActorUserExists(actorUserId);
    const report = await db.prepare(
      `SELECT report_job_id, tenant_id, workspace_id
      FROM report_jobs
      WHERE report_job_id = ?`,
    ).get(reportJobId);
    if (!report) {
      throw new ApiError(404, "Report job was not found.", "report_job_not_found");
    }
    const nowIso = new Date().toISOString();
    await inTransaction(async () => {
      for (const artifact of artifacts) {
        await db.prepare(
          `INSERT INTO report_artifact_objects (
            artifact_object_id, report_job_id, tenant_id, workspace_id,
            artifact_run_id, artifact_kind, relative_path, object_key,
            media_type, byte_size, sha256, original_file_name,
            created_by_user_id, created_at_iso
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          artifact.artifactObjectId,
          reportJobId,
          report.tenant_id,
          report.workspace_id,
          artifactRunId,
          artifactKind,
          artifact.relativePath,
          artifact.objectKey,
          artifact.mediaType,
          artifact.byteSize,
          artifact.sha256,
          originalFileName ?? null,
          actorUserId,
          nowIso,
        );
      }
    });
    return artifacts.length;
  }

  async function getReportArtifactObject({ artifactFileName, artifactRunId, reportJobId }) {
    const row = await db.prepare(
      `SELECT *
      FROM report_artifact_objects
      WHERE report_job_id = ?
        AND artifact_run_id = ?
        AND relative_path = ?`,
    ).get(reportJobId, artifactRunId, `scans/${artifactFileName}`);
    return row ? mapReportArtifactObject(row) : null;
  }

  async function deleteReportArtifactRun({ artifactRunId, reportJobId }) {
    await db.prepare(
      `DELETE FROM report_artifact_objects
      WHERE report_job_id = ? AND artifact_run_id = ?`,
    ).run(reportJobId, artifactRunId);
  }

  async function listReportArtifactRunObjectKeys({ artifactRunId, reportJobId }) {
    const rows = await db.prepare(
      `SELECT object_key
      FROM report_artifact_objects
      WHERE report_job_id = ? AND artifact_run_id = ?`,
    ).all(reportJobId, artifactRunId);
    return rows.map((row) => row.object_key);
  }

  async function ensureSeedReport({
    bootstrapKey,
    exportPackage,
    manualSupplementOverrides = {},
  }) {
    const existingBootstrapRows = await db
      .prepare("SELECT report_job_id, inspection_id FROM report_jobs WHERE bootstrap_key = ?")
      .all(bootstrapKey);

    const staleBootstrapRows = existingBootstrapRows.filter(
      (row) => row.inspection_id !== exportPackage.inspectionId,
    );
    if (staleBootstrapRows.length > 0) {
      const nowIso = new Date().toISOString();
      await inTransaction(async () => {
        for (const row of staleBootstrapRows) {
          await db.prepare(
            "UPDATE report_jobs SET bootstrap_key = NULL, updated_at_iso = ? WHERE report_job_id = ?",
          ).run(nowIso, row.report_job_id);
        }
      });
    }

    return importAndroidV2ProductExport({
      bootstrapKey,
      exportPackage,
      manualSupplementOverrides,
      actorUserId: exportPackage.profile.userId,
      allowIdentityBootstrap: true,
    });
  }

  async function importAndroidV2ProductExport({
    bootstrapKey = null,
    exportPackage,
    manualSupplementOverrides = {},
    actorUserId = null,
    allowIdentityBootstrap = false,
    sourcePackageRef = null,
  }) {
    const validationIssues = validateAndroidV3ProductExport(exportPackage);
    if (validationIssues.length > 0) {
      throw new ApiError(
        400,
        `Invalid LAIQ inspection app V3 export package. ${validationIssues.join(" ")}`,
        "invalid_export_package",
      );
    }

    const nowIso = new Date().toISOString();
    const packageFingerprint = buildPackageFingerprint(exportPackage);
    let reportJobId;

    await inTransaction(async () => {
      await db.prepare("SELECT pg_advisory_xact_lock(hashtext(?))").get(exportPackage.inspectionId);
      if (allowIdentityBootstrap) {
        await upsertIdentityRecords(exportPackage, nowIso);
      } else {
        await ensureUserWorkspaceMembership(actorUserId, exportPackage.tenantId, exportPackage.workspaceId);
      }

      const persistedExportedByUserId = await resolvePersistedExportedByUserId(
        exportPackage,
        actorUserId,
      );

      const inspectionImports = await db
        .prepare(
          `SELECT
            import_id,
            tenant_id,
            workspace_id,
            raw_package_json,
            package_sha256,
            revision_number,
            source_storage_status
          FROM report_imports
          WHERE inspection_id = ?
          ORDER BY revision_number DESC`,
        )
        .all(exportPackage.inspectionId);
      const scopeImport = inspectionImports[0] ?? null;
      if (
        scopeImport &&
        (
          scopeImport.tenant_id !== exportPackage.tenantId ||
          scopeImport.workspace_id !== exportPackage.workspaceId
        )
      ) {
        throw new ApiError(
          409,
          "Inspection identifier is already assigned to another tenant or workspace.",
          "inspection_scope_conflict",
        );
      }
      let existingImport = inspectionImports.find(
        (candidate) => candidate.package_sha256 === packageFingerprint,
      );
      if (!existingImport) {
        existingImport = inspectionImports.find(
          (candidate) => buildPackageFingerprint(parseJsonValue(candidate.raw_package_json)) === packageFingerprint,
        );
        if (existingImport && existingImport.package_sha256 !== packageFingerprint) {
          await db.prepare(
            "UPDATE report_imports SET package_sha256 = ? WHERE import_id = ?",
          ).run(packageFingerprint, existingImport.import_id);
        }
      }

      const importId = existingImport?.import_id ?? randomUUID();
      const revisionNumber = existingImport?.revision_number
        ?? (inspectionImports[0]?.revision_number ?? 0) + 1;
      if (!existingImport) {
        await db.prepare(
          `INSERT INTO report_imports (
            import_id,
            inspection_id,
            tenant_id,
            workspace_id,
            package_type,
            schema_version,
            inspection_reference,
            exported_by_user_id,
            exported_at_iso,
            raw_package_json,
            package_sha256,
            revision_number,
            source_object_key,
            source_byte_size,
            source_sha256,
            source_media_type,
            source_storage_status,
            created_at_iso,
            updated_at_iso
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          importId,
          exportPackage.inspectionId,
          exportPackage.tenantId,
          exportPackage.workspaceId,
          exportPackage.packageType,
          exportPackage.schemaVersion,
          exportPackage.inspectionReference,
          persistedExportedByUserId,
          exportPackage.exportedAtIso,
          JSON.stringify(exportPackage),
          packageFingerprint,
          revisionNumber,
          sourcePackageRef?.objectKey ?? null,
          sourcePackageRef?.byteSize ?? null,
          sourcePackageRef?.sha256 ?? null,
          sourcePackageRef?.mediaType ?? null,
          sourcePackageRef ? "stored" : "legacy",
          nowIso,
          nowIso,
        );
      } else if (sourcePackageRef && existingImport.source_storage_status !== "stored") {
        await db.prepare(
          `UPDATE report_imports
          SET source_object_key = ?,
            source_byte_size = ?,
            source_sha256 = ?,
            source_media_type = ?,
            source_storage_status = 'stored',
            updated_at_iso = ?
          WHERE import_id = ?`,
        ).run(
          sourcePackageRef.objectKey,
          sourcePackageRef.byteSize,
          sourcePackageRef.sha256,
          sourcePackageRef.mediaType,
          nowIso,
          importId,
        );
      }

      const existingReportJob = await db
        .prepare("SELECT report_job_id FROM report_jobs WHERE import_id = ?")
        .get(importId);
      reportJobId = existingReportJob?.report_job_id ?? randomUUID();
      if (!existingReportJob) {
        await db.prepare(
          `INSERT INTO report_jobs (
          report_job_id,
          import_id,
          bootstrap_key,
          inspection_id,
          tenant_id,
          workspace_id,
          created_by_user_id,
          report_reference,
          title,
          client,
          tank,
          inspected_date,
          status_code,
          created_at_iso,
          updated_at_iso
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          reportJobId,
          importId,
          bootstrapKey,
          exportPackage.inspectionId,
          exportPackage.tenantId,
          exportPackage.workspaceId,
          actorUserId || persistedExportedByUserId,
          buildDefaultManualSupplement(exportPackage, manualSupplementOverrides).reportReference,
          "API 653 Internal & External Inspection Workspace",
          exportPackage.task.client,
          `Tank ${exportPackage.task.tankNumber}`,
          buildDefaultManualSupplement(exportPackage, manualSupplementOverrides).inspectedDate,
          "draft",
          nowIso,
          nowIso,
        );
      } else if (bootstrapKey) {
        await db.prepare(
          `UPDATE report_jobs
          SET bootstrap_key = COALESCE(bootstrap_key, ?),
            updated_at_iso = ?
          WHERE report_job_id = ?`,
        ).run(bootstrapKey, nowIso, reportJobId);
      }

      await upsertDefaultManualInputs(
        reportJobId,
        buildDefaultManualSupplement(exportPackage, manualSupplementOverrides),
        nowIso,
      );

      await upsertInternalManualInput(reportJobId, "__sourceEvidenceFingerprintV2", packageFingerprint, nowIso);
    });

    return loadReportJobState(reportJobId);
  }

  async function refreshSeedReport(reportJobId, exportPackage, manualSupplementOverrides) {
    const nowIso = new Date().toISOString();
    const defaultValues = buildDefaultManualSupplement(exportPackage, manualSupplementOverrides);

    await inTransaction(async () => {
      await db.prepare(
        `UPDATE report_jobs
        SET report_reference = ?,
          title = ?,
          client = ?,
          tank = ?,
          inspected_date = ?,
          updated_at_iso = ?
        WHERE report_job_id = ?`,
      ).run(
        defaultValues.reportReference,
        "API 653 Internal & External Inspection Workspace",
        exportPackage.task.client,
        `Tank ${exportPackage.task.tankNumber}`,
        defaultValues.inspectedDate,
        nowIso,
        reportJobId,
      );

      for (const fieldKey of ["reportReference", "inspectedDate"]) {
        await db.prepare(
          `INSERT INTO report_manual_inputs (report_job_id, field_key, field_value, updated_at_iso)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(report_job_id, field_key) DO UPDATE SET
            field_value = excluded.field_value,
            updated_at_iso = excluded.updated_at_iso`,
        ).run(reportJobId, fieldKey, String(defaultValues[fieldKey] ?? ""), nowIso);
      }
    });
  }

  async function loadBootstrapReport(bootstrapKey) {
    const row = await db
      .prepare("SELECT report_job_id FROM report_jobs WHERE bootstrap_key = ? ORDER BY updated_at_iso DESC LIMIT 1")
      .get(bootstrapKey);

    if (!row?.report_job_id) {
      return null;
    }

    return loadReportJobState(row.report_job_id);
  }

  async function getReportScope(reportJobId) {
    const row = await db
      .prepare(
        `SELECT report_job_id, tenant_id, workspace_id, created_by_user_id, status_code
        FROM report_jobs
        WHERE report_job_id = ?`,
      )
      .get(reportJobId);

    return row
      ? {
          reportJobId: row.report_job_id,
          tenantId: row.tenant_id,
          workspaceId: row.workspace_id,
          createdByUserId: row.created_by_user_id,
          statusCode: row.status_code,
        }
      : null;
  }

  async function getUserPrincipal(userId) {
    const user = await db
      .prepare(
        `SELECT
          pu.user_id,
          pu.tenant_id,
          pu.workspace_id,
          pu.display_name,
          pu.role_label,
          pu.identity_provider,
          pu.external_subject,
          pu.account_status,
          t.tenant_name
        FROM platform_users pu
        JOIN tenants t ON t.tenant_id = pu.tenant_id
        WHERE pu.user_id = ?`,
      )
      .get(userId);
    if (!user || user.account_status !== "active") {
      return null;
    }

    const memberships = await db
      .prepare(
        `SELECT
          wrm.workspace_id,
          w.workspace_name,
          wrm.role_label
        FROM workspace_role_memberships wrm
        JOIN workspaces w ON w.workspace_id = wrm.workspace_id
        WHERE wrm.user_id = ? AND w.tenant_id = ?
        ORDER BY wrm.workspace_id, wrm.role_label`,
      )
      .all(user.user_id, user.tenant_id);
    const membershipsByWorkspace = new Map();
    for (const membership of memberships) {
      const current = membershipsByWorkspace.get(membership.workspace_id) ?? {
        workspaceId: membership.workspace_id,
        workspaceName: membership.workspace_name,
        roles: [],
      };
      current.roles.push(membership.role_label);
      membershipsByWorkspace.set(membership.workspace_id, current);
    }

    const workspaceMemberships = [...membershipsByWorkspace.values()];
    const platformRoles = workspaceMemberships
      .flatMap((membership) => membership.roles)
      .filter((role) => String(role).trim().toLowerCase() === "super admin");

    return {
      userId: user.user_id,
      displayName: user.display_name,
      tenantId: user.tenant_id,
      tenantName: user.tenant_name,
      primaryWorkspaceId: user.workspace_id,
      platformRoles,
      workspaceMemberships,
      identityProvider: user.identity_provider,
    };
  }

  async function getUserPrincipalBySubject(providerCode, subject) {
    const row = await db
      .prepare(
        `SELECT user_id
        FROM platform_users
        WHERE identity_provider = ? AND external_subject = ? AND account_status = 'active'`,
      )
      .get(providerCode, subject);
    return row?.user_id ? getUserPrincipal(row.user_id) : null;
  }

  async function getPasswordCredential(usernameNormalized) {
    return db
      .prepare(
        `SELECT apc.user_id, apc.username_normalized, apc.password_hash
        FROM auth_password_credentials apc
        JOIN platform_users pu ON pu.user_id = apc.user_id
        WHERE apc.username_normalized = ? AND pu.account_status = 'active'`,
      )
      .get(usernameNormalized);
  }

  async function createPasswordCredentialIfMissing({
    userId,
    usernameNormalized,
    passwordHash,
  }) {
    await ensureActorUserExists(userId);
    const nowIso = new Date().toISOString();
    const result = await db.prepare(
      `INSERT INTO auth_password_credentials (
        user_id,
        username_normalized,
        password_hash,
        password_changed_at_iso,
        created_at_iso,
        updated_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING`,
    ).run(userId, usernameNormalized, passwordHash, nowIso, nowIso, nowIso);
    return result.rowCount > 0;
  }

  async function upsertPasswordCredential({
    userId,
    usernameNormalized,
    passwordHash,
  }) {
    await ensureActorUserExists(userId);
    const nowIso = new Date().toISOString();
    await inTransaction(async () => {
      await db.prepare(
        `INSERT INTO auth_password_credentials (
          user_id,
          username_normalized,
          password_hash,
          password_changed_at_iso,
          created_at_iso,
          updated_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          username_normalized = excluded.username_normalized,
          password_hash = excluded.password_hash,
          password_changed_at_iso = excluded.password_changed_at_iso,
          updated_at_iso = excluded.updated_at_iso`,
      ).run(userId, usernameNormalized, passwordHash, nowIso, nowIso, nowIso);
      await db.prepare(
        `UPDATE auth_sessions
        SET revoked_at_iso = ?
        WHERE user_id = ? AND revoked_at_iso IS NULL`,
      ).run(nowIso, userId);
    });
  }

  async function createAuthSession({
    sessionTokenHash,
    userId,
    expiresAtIso,
    clientType = "web",
    deviceId = null,
  }) {
    await ensureActorUserExists(userId);
    const nowIso = new Date().toISOString();
    await db.prepare(
      `INSERT INTO auth_sessions (
        session_token_hash,
        user_id,
        expires_at_iso,
        last_seen_at_iso,
        created_at_iso,
        client_type,
        device_id,
        revoked_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    ).run(sessionTokenHash, userId, expiresAtIso, nowIso, nowIso, clientType, deviceId);
  }

  async function getAuthSession(sessionTokenHash, nowIso) {
    return db.prepare(
      `SELECT session_token_hash, user_id, expires_at_iso, last_seen_at_iso, client_type, device_id
      FROM auth_sessions
      WHERE session_token_hash = ?
        AND revoked_at_iso IS NULL
        AND expires_at_iso > ?`,
    ).get(sessionTokenHash, nowIso);
  }

  async function refreshAuthSession(sessionTokenHash, expiresAtIso, lastSeenAtIso) {
    await db.prepare(
      `UPDATE auth_sessions
      SET expires_at_iso = ?, last_seen_at_iso = ?
      WHERE session_token_hash = ? AND revoked_at_iso IS NULL`,
    ).run(expiresAtIso, lastSeenAtIso, sessionTokenHash);
  }

  async function revokeAuthSession(sessionTokenHash) {
    const nowIso = new Date().toISOString();
    await db.prepare(
      `UPDATE auth_sessions
      SET revoked_at_iso = ?
      WHERE session_token_hash = ? AND revoked_at_iso IS NULL`,
    ).run(nowIso, sessionTokenHash);
  }

  async function getLoginThrottle(keyHashes, nowIso) {
    if (keyHashes.length === 0) return null;
    const placeholders = keyHashes.map(() => "?").join(", ");
    return db.prepare(
      `SELECT throttle_key_hash, locked_until_iso
      FROM auth_login_throttles
      WHERE throttle_key_hash IN (${placeholders})
        AND locked_until_iso IS NOT NULL
        AND locked_until_iso > ?
      ORDER BY locked_until_iso DESC
      LIMIT 1`,
    ).get(...keyHashes, nowIso);
  }

  async function recordLoginFailure(keyHashes, {
    lockDurationMs,
    maximumAttempts,
    nowIso,
    windowDurationMs,
  }) {
    const nowMs = Date.parse(nowIso);
    await inTransaction(async () => {
      for (const keyHash of keyHashes) {
        const existing = await db.prepare(
          `SELECT failure_count, window_started_at_iso
          FROM auth_login_throttles
          WHERE throttle_key_hash = ?
          FOR UPDATE`,
        ).get(keyHash);
        const existingWindowMs = Date.parse(existing?.window_started_at_iso ?? "");
        const windowExpired = !Number.isFinite(existingWindowMs) || nowMs - existingWindowMs >= windowDurationMs;
        const failureCount = windowExpired ? 1 : Number(existing.failure_count ?? 0) + 1;
        const windowStartedAtIso = windowExpired ? nowIso : existing.window_started_at_iso;
        const lockedUntilIso = failureCount >= maximumAttempts
          ? new Date(nowMs + lockDurationMs).toISOString()
          : null;
        await db.prepare(
          `INSERT INTO auth_login_throttles (
            throttle_key_hash,
            failure_count,
            window_started_at_iso,
            locked_until_iso,
            updated_at_iso
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(throttle_key_hash) DO UPDATE SET
            failure_count = excluded.failure_count,
            window_started_at_iso = excluded.window_started_at_iso,
            locked_until_iso = excluded.locked_until_iso,
            updated_at_iso = excluded.updated_at_iso`,
        ).run(keyHash, failureCount, windowStartedAtIso, lockedUntilIso, nowIso);
      }
    });
  }

  async function clearLoginThrottles(keyHashes) {
    if (keyHashes.length === 0) return;
    const placeholders = keyHashes.map(() => "?").join(", ");
    await db.prepare(
      `DELETE FROM auth_login_throttles WHERE throttle_key_hash IN (${placeholders})`,
    ).run(...keyHashes);
  }

  async function listManagedTenants() {
    const tenants = await db.prepare(
      `SELECT tenant_id, tenant_name, created_at_iso, updated_at_iso
      FROM tenants
      ORDER BY tenant_name, tenant_id`,
    ).all();
    const workspaces = await db.prepare(
      `SELECT workspace_id, tenant_id, workspace_name, created_at_iso, updated_at_iso
      FROM workspaces
      ORDER BY workspace_name, workspace_id`,
    ).all();
    const workspacesByTenant = new Map();
    for (const workspace of workspaces) {
      const current = workspacesByTenant.get(workspace.tenant_id) ?? [];
      current.push({
        workspaceId: workspace.workspace_id,
        workspaceName: workspace.workspace_name,
        createdAtIso: workspace.created_at_iso,
        updatedAtIso: workspace.updated_at_iso,
      });
      workspacesByTenant.set(workspace.tenant_id, current);
    }
    return tenants.map((tenant) => ({
      tenantId: tenant.tenant_id,
      tenantName: tenant.tenant_name,
      createdAtIso: tenant.created_at_iso,
      updatedAtIso: tenant.updated_at_iso,
      workspaces: workspacesByTenant.get(tenant.tenant_id) ?? [],
    }));
  }

  async function listManagedAccounts() {
    const rows = await db.prepare(
      `SELECT
        pu.user_id,
        pu.tenant_id,
        t.tenant_name,
        pu.workspace_id,
        w.workspace_name,
        pu.display_name,
        pu.role_label,
        pu.account_status,
        pu.device_id,
        pu.created_at_iso,
        pu.updated_at_iso,
        apc.username_normalized
      FROM platform_users pu
      JOIN tenants t ON t.tenant_id = pu.tenant_id
      JOIN workspaces w ON w.workspace_id = pu.workspace_id
      LEFT JOIN auth_password_credentials apc ON apc.user_id = pu.user_id
      ORDER BY pu.display_name, pu.user_id`,
    ).all();
    return rows.map((row) => ({
      userId: row.user_id,
      username: row.username_normalized,
      displayName: row.display_name,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      workspaceId: row.workspace_id,
      workspaceName: row.workspace_name,
      roleLabel: row.role_label,
      accountStatus: row.account_status,
      deviceId: row.device_id,
      createdAtIso: row.created_at_iso,
      updatedAtIso: row.updated_at_iso,
    }));
  }

  async function createManagedTenant({ actorUserId, tenantId, tenantName }) {
    const normalizedId = requiredIdentifier(tenantId, "tenantId");
    const normalizedName = requiredLabel(tenantName, "tenantName");
    const nowIso = new Date().toISOString();
    await inTransaction(async () => {
      const existing = await db.prepare("SELECT tenant_id FROM tenants WHERE tenant_id = ?").get(normalizedId);
      if (existing) {
        throw new ApiError(409, "A tenant with this identifier already exists.", "tenant_already_exists");
      }
      await db.prepare(
        `INSERT INTO tenants (tenant_id, tenant_name, created_at_iso, updated_at_iso)
        VALUES (?, ?, ?, ?)`,
      ).run(normalizedId, normalizedName, nowIso, nowIso);
      await recordPlatformAuditEvent({
        actorUserId,
        eventCode: "tenant_created",
        event: { tenantName: normalizedName },
        tenantId: normalizedId,
      });
    });
    return { tenantId: normalizedId, tenantName: normalizedName };
  }

  async function bootstrapInitialSuperAdmin({
    displayName,
    passwordHash,
    tenantId,
    tenantName,
    userId = randomUUID(),
    usernameNormalized,
    workspaceId,
    workspaceName,
  }) {
    const normalizedDisplayName = requiredLabel(displayName, "displayName");
    const normalizedTenantId = requiredIdentifier(tenantId, "tenantId");
    const normalizedTenantName = requiredLabel(tenantName, "tenantName");
    const normalizedUserId = requiredIdentifier(userId, "userId");
    const normalizedWorkspaceId = requiredIdentifier(workspaceId, "workspaceId");
    const normalizedWorkspaceName = requiredLabel(workspaceName, "workspaceName");
    const nowIso = new Date().toISOString();

    try {
      await inTransaction(async () => {
        await db.prepare("SELECT pg_advisory_xact_lock(653001) AS locked").get();
        const credentialCount = await db.prepare(
          "SELECT COUNT(*)::int AS credential_count FROM auth_password_credentials",
        ).get();
        if (Number(credentialCount?.credential_count ?? 0) > 0) {
          throw new ApiError(
            409,
            "Initial Super Admin bootstrap is already complete. Use Account Management or account:provision.",
            "initial_admin_already_exists",
          );
        }

        await db.prepare(
          `INSERT INTO tenants (tenant_id, tenant_name, created_at_iso, updated_at_iso)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(tenant_id) DO NOTHING`,
        ).run(normalizedTenantId, normalizedTenantName, nowIso, nowIso);
        await db.prepare(
          `INSERT INTO workspaces (workspace_id, tenant_id, workspace_name, created_at_iso, updated_at_iso)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(workspace_id) DO NOTHING`,
        ).run(normalizedWorkspaceId, normalizedTenantId, normalizedWorkspaceName, nowIso, nowIso);

        const workspace = await db.prepare(
          "SELECT workspace_id FROM workspaces WHERE workspace_id = ? AND tenant_id = ?",
        ).get(normalizedWorkspaceId, normalizedTenantId);
        if (!workspace) {
          throw new ApiError(
            409,
            "The bootstrap workspace identifier already belongs to another tenant.",
            "bootstrap_workspace_scope_conflict",
          );
        }

        await db.prepare(
          `INSERT INTO platform_users (
            user_id, tenant_id, workspace_id, display_name, role_label,
            identity_provider, external_subject, account_status, created_at_iso, updated_at_iso
          ) VALUES (?, ?, ?, ?, 'Super Admin', 'password', ?, 'active', ?, ?)`,
        ).run(
          normalizedUserId,
          normalizedTenantId,
          normalizedWorkspaceId,
          normalizedDisplayName,
          usernameNormalized,
          nowIso,
          nowIso,
        );
        await db.prepare(
          `INSERT INTO workspace_role_memberships (
            workspace_id, user_id, role_label, created_at_iso, updated_at_iso
          ) VALUES (?, ?, 'Super Admin', ?, ?)`,
        ).run(normalizedWorkspaceId, normalizedUserId, nowIso, nowIso);
        await db.prepare(
          `INSERT INTO auth_password_credentials (
            user_id, username_normalized, password_hash, password_changed_at_iso, created_at_iso, updated_at_iso
          ) VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(normalizedUserId, usernameNormalized, passwordHash, nowIso, nowIso, nowIso);
        await recordPlatformAuditEvent({
          actorUserId: normalizedUserId,
          eventCode: "initial_super_admin_bootstrapped",
          event: { username: usernameNormalized },
          targetUserId: normalizedUserId,
          tenantId: normalizedTenantId,
          workspaceId: normalizedWorkspaceId,
        });
      });
    } catch (error) {
      if (error?.code === "23505") {
        throw new ApiError(
          409,
          "Bootstrap tenant, workspace, username, or user identifier is already in use.",
          "initial_admin_conflict",
        );
      }
      throw error;
    }

    return getManagedAccount(normalizedUserId);
  }

  async function createManagedWorkspace({ actorUserId, tenantId, workspaceId, workspaceName }) {
    const normalizedTenantId = requiredIdentifier(tenantId, "tenantId");
    const normalizedId = requiredIdentifier(workspaceId, "workspaceId");
    const normalizedName = requiredLabel(workspaceName, "workspaceName");
    const nowIso = new Date().toISOString();
    await inTransaction(async () => {
      const tenant = await db.prepare("SELECT tenant_id FROM tenants WHERE tenant_id = ?").get(normalizedTenantId);
      if (!tenant) {
        throw new ApiError(404, "Tenant was not found.", "tenant_not_found");
      }
      const existing = await db.prepare("SELECT workspace_id FROM workspaces WHERE workspace_id = ?").get(normalizedId);
      if (existing) {
        throw new ApiError(409, "A workspace with this identifier already exists.", "workspace_already_exists");
      }
      await db.prepare(
        `INSERT INTO workspaces (workspace_id, tenant_id, workspace_name, created_at_iso, updated_at_iso)
        VALUES (?, ?, ?, ?, ?)`,
      ).run(normalizedId, normalizedTenantId, normalizedName, nowIso, nowIso);
      await recordPlatformAuditEvent({
        actorUserId,
        eventCode: "workspace_created",
        event: { workspaceName: normalizedName },
        tenantId: normalizedTenantId,
        workspaceId: normalizedId,
      });
    });
    return { workspaceId: normalizedId, tenantId: normalizedTenantId, workspaceName: normalizedName };
  }

  async function createManagedAccount({
    actorUserId,
    displayName,
    passwordHash,
    roleLabel,
    tenantId,
    userId = randomUUID(),
    usernameNormalized,
    workspaceId,
  }) {
    const normalizedRole = managedRoleLabel(roleLabel);
    const normalizedDisplayName = requiredLabel(displayName, "displayName");
    const normalizedTenantId = requiredIdentifier(tenantId, "tenantId");
    const normalizedWorkspaceId = requiredIdentifier(workspaceId, "workspaceId");
    const normalizedUserId = requiredIdentifier(userId, "userId");
    const nowIso = new Date().toISOString();
    try {
      await inTransaction(async () => {
        const workspace = await db.prepare(
          "SELECT workspace_id FROM workspaces WHERE workspace_id = ? AND tenant_id = ?",
        ).get(normalizedWorkspaceId, normalizedTenantId);
        if (!workspace) {
          throw new ApiError(400, "Workspace does not belong to the selected tenant.", "workspace_scope_invalid");
        }
        await db.prepare(
          `INSERT INTO platform_users (
            user_id, tenant_id, workspace_id, display_name, role_label,
            identity_provider, external_subject, account_status, created_at_iso, updated_at_iso
          ) VALUES (?, ?, ?, ?, ?, 'password', ?, 'active', ?, ?)`,
        ).run(
          normalizedUserId,
          normalizedTenantId,
          normalizedWorkspaceId,
          normalizedDisplayName,
          normalizedRole,
          usernameNormalized,
          nowIso,
          nowIso,
        );
        await db.prepare(
          `INSERT INTO workspace_role_memberships (
            workspace_id, user_id, role_label, created_at_iso, updated_at_iso
          ) VALUES (?, ?, ?, ?, ?)`,
        ).run(normalizedWorkspaceId, normalizedUserId, normalizedRole, nowIso, nowIso);
        await db.prepare(
          `INSERT INTO auth_password_credentials (
            user_id, username_normalized, password_hash, password_changed_at_iso, created_at_iso, updated_at_iso
          ) VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(normalizedUserId, usernameNormalized, passwordHash, nowIso, nowIso, nowIso);
        await recordPlatformAuditEvent({
          actorUserId,
          eventCode: "account_created",
          event: { roleLabel: normalizedRole, username: usernameNormalized },
          targetUserId: normalizedUserId,
          tenantId: normalizedTenantId,
          workspaceId: normalizedWorkspaceId,
        });
      });
    } catch (error) {
      if (error?.code === "23505") {
        throw new ApiError(409, "Username or user identifier is already in use.", "account_already_exists");
      }
      throw error;
    }
    return getManagedAccount(normalizedUserId);
  }

  async function setManagedAccountStatus({ actorUserId, accountStatus, targetUserId }) {
    const normalizedStatus = accountStatus === "active" ? "active" : accountStatus === "disabled" ? "disabled" : null;
    if (!normalizedStatus) {
      throw new ApiError(400, "accountStatus must be active or disabled.", "account_status_invalid");
    }
    if (actorUserId === targetUserId && normalizedStatus === "disabled") {
      throw new ApiError(409, "A Super Admin cannot disable their own active session account.", "self_disable_denied");
    }
    const current = await getManagedAccount(targetUserId);
    if (!current) {
      throw new ApiError(404, "Account was not found.", "account_not_found");
    }
    const nowIso = new Date().toISOString();
    await inTransaction(async () => {
      await db.prepare(
        "UPDATE platform_users SET account_status = ?, updated_at_iso = ? WHERE user_id = ?",
      ).run(normalizedStatus, nowIso, targetUserId);
      if (normalizedStatus === "disabled") {
        await db.prepare(
          "UPDATE auth_sessions SET revoked_at_iso = ? WHERE user_id = ? AND revoked_at_iso IS NULL",
        ).run(nowIso, targetUserId);
      }
      await recordPlatformAuditEvent({
        actorUserId,
        eventCode: `account_${normalizedStatus}`,
        event: { previousStatus: current.accountStatus },
        targetUserId,
        tenantId: current.tenantId,
        workspaceId: current.workspaceId,
      });
    });
    return getManagedAccount(targetUserId);
  }

  async function resetManagedAccountPassword({ actorUserId, passwordHash, targetUserId }) {
    const current = await getManagedAccount(targetUserId);
    if (!current) {
      throw new ApiError(404, "Account was not found.", "account_not_found");
    }
    await upsertPasswordCredential({
      userId: targetUserId,
      usernameNormalized: current.username,
      passwordHash,
    });
    await recordPlatformAuditEvent({
      actorUserId,
      eventCode: "account_password_reset",
      targetUserId,
      tenantId: current.tenantId,
      workspaceId: current.workspaceId,
    });
    return getManagedAccount(targetUserId);
  }

  async function deleteManagedAccount({ actorUserId, confirmation, targetUserId }) {
    if (actorUserId === targetUserId) {
      throw new ApiError(409, "A Super Admin cannot delete their own account.", "self_delete_denied");
    }
    const current = await getManagedAccount(targetUserId);
    if (!current) {
      throw new ApiError(404, "Account was not found.", "account_not_found");
    }
    const expectedConfirmation = current.username ?? current.userId;
    if (String(confirmation ?? "").trim() !== expectedConfirmation) {
      throw new ApiError(
        400,
        `Type ${expectedConfirmation} to confirm permanent deletion.`,
        "account_delete_confirmation_invalid",
      );
    }
    if (roleKey(current.roleLabel) === "super_admin") {
      const superAdminCount = await db.prepare(
        `SELECT COUNT(*)::int AS account_count
        FROM platform_users
        WHERE account_status = 'active' AND LOWER(role_label) = 'super admin'`,
      ).get();
      if (Number(superAdminCount?.account_count ?? 0) <= 1) {
        throw new ApiError(
          409,
          "The final active Super Admin cannot be deleted.",
          "last_super_admin_delete_denied",
        );
      }
    }

    let reportJobIds = [];
    let importIds = [];
    let objectKeys = [];
    await inTransaction(async () => {
      const reportRows = await db.prepare(
        `SELECT DISTINCT rj.report_job_id
        FROM report_jobs rj
        JOIN report_imports ri ON ri.import_id = rj.import_id
        WHERE rj.created_by_user_id = ? OR ri.exported_by_user_id = ?`,
      ).all(targetUserId, targetUserId);
      const importRows = await db.prepare(
        `SELECT import_id, source_object_key
        FROM report_imports
        WHERE exported_by_user_id = ?`,
      ).all(targetUserId);
      reportJobIds = reportRows.map((row) => row.report_job_id);
      importIds = importRows.map((row) => row.import_id);
      objectKeys.push(...importRows.map((row) => row.source_object_key).filter(Boolean));
      const objectRows = await db.prepare(
        `SELECT rou.object_key
        FROM report_object_uploads rou
        JOIN report_object_upload_sessions rous
          ON rous.upload_session_id = rou.upload_session_id
        WHERE rous.actor_user_id = ?`,
      ).all(targetUserId);
      objectKeys.push(...objectRows.map((row) => row.object_key));
      if (reportJobIds.length > 0) {
        const reportArtifactRows = await db.prepare(
          `SELECT object_key
          FROM report_artifact_objects
          WHERE report_job_id IN (${reportJobIds.map(() => "?").join(", ")})`,
        ).all(...reportJobIds);
        objectKeys.push(...reportArtifactRows.map((row) => row.object_key));
      }

      await db.prepare("DELETE FROM report_generation_runs WHERE actor_user_id = ?").run(targetUserId);
      await db.prepare("DELETE FROM report_review_decisions WHERE actor_user_id = ?").run(targetUserId);
      await db.prepare("DELETE FROM report_object_upload_sessions WHERE actor_user_id = ?").run(targetUserId);
      if (reportJobIds.length > 0) {
        await db.prepare(
          `DELETE FROM report_jobs WHERE report_job_id IN (${reportJobIds.map(() => "?").join(", ")})`,
        ).run(...reportJobIds);
      }
      if (importIds.length > 0) {
        await db.prepare(
          `DELETE FROM report_imports WHERE import_id IN (${importIds.map(() => "?").join(", ")})`,
        ).run(...importIds);
      }
      await db.prepare(
        "DELETE FROM platform_audit_events WHERE actor_user_id = ? OR target_user_id = ?",
      ).run(targetUserId, targetUserId);
      await db.prepare("DELETE FROM workspace_role_memberships WHERE user_id = ?").run(targetUserId);
      await db.prepare("DELETE FROM platform_users WHERE user_id = ?").run(targetUserId);
      await recordPlatformAuditEvent({
        actorUserId,
        eventCode: "account_permanently_deleted",
        event: {
          deletedImportCount: importIds.length,
          deletedObjectCount: objectKeys.length,
          deletedReportJobCount: reportJobIds.length,
          deletedUserHash: createHash("sha256").update(targetUserId).digest("hex"),
        },
        tenantId: current.tenantId,
        workspaceId: current.workspaceId,
      });
    });

    return {
      deletedImportCount: importIds.length,
      deletedObjectKeys: objectKeys,
      deletedReportJobIds: reportJobIds,
      deletedUserId: targetUserId,
    };
  }

  async function listAccessibleReportJobs(principal) {
    const isSuperAdmin = principal.platformRoles.some(
      (role) => String(role).trim().toLowerCase() === "super admin",
    );
    let where = "";
    let parameters = [];
    if (!isSuperAdmin) {
      const fullWorkspaceIds = [];
      const ownedWorkspaceIds = [];
      for (const membership of principal.workspaceMemberships) {
        const roles = new Set((membership.roles ?? []).map(roleKey));
        if (roles.has("manager") || roles.has("reviewer")) {
          fullWorkspaceIds.push(membership.workspaceId);
        } else if (roles.has("inspector")) {
          ownedWorkspaceIds.push(membership.workspaceId);
        }
      }
      const accessClauses = [];
      if (fullWorkspaceIds.length > 0) {
        accessClauses.push(`rj.workspace_id IN (${fullWorkspaceIds.map(() => "?").join(", ")})`);
      }
      if (ownedWorkspaceIds.length > 0) {
        accessClauses.push(
          `(rj.workspace_id IN (${ownedWorkspaceIds.map(() => "?").join(", ")}) AND rj.created_by_user_id = ?)`,
        );
      }
      if (accessClauses.length === 0) return [];
      where = `WHERE rj.tenant_id = ? AND (${accessClauses.join(" OR ")})`;
      parameters = [
        principal.tenantId,
        ...fullWorkspaceIds,
        ...ownedWorkspaceIds,
        ...(ownedWorkspaceIds.length > 0 ? [principal.userId] : []),
      ];
    }
    const rows = await db.prepare(
      `SELECT
        rj.report_job_id,
        rj.inspection_id,
        rj.report_reference,
        rj.title,
        rj.client,
        rj.tank,
        rj.inspected_date,
        rj.status_code,
        rj.tenant_id,
        t.tenant_name,
        rj.workspace_id,
        w.workspace_name,
        rj.created_by_user_id,
        pu.display_name AS created_by_display_name,
        rj.updated_at_iso,
        rj.bootstrap_key,
        ri.package_sha256,
        ri.revision_number,
        ri.source_storage_status
      FROM report_jobs rj
      JOIN report_imports ri ON ri.import_id = rj.import_id
      JOIN tenants t ON t.tenant_id = rj.tenant_id
      JOIN workspaces w ON w.workspace_id = rj.workspace_id
      LEFT JOIN platform_users pu ON pu.user_id = rj.created_by_user_id
      ${where}
      ORDER BY rj.updated_at_iso DESC`,
    ).all(...parameters);
    return rows.map((row) => ({
      reportJobId: row.report_job_id,
      inspectionId: row.inspection_id,
      reportReference: row.report_reference,
      title: row.title,
      client: row.client,
      tank: row.tank,
      inspectedDate: row.inspected_date,
      statusCode: row.status_code,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      workspaceId: row.workspace_id,
      workspaceName: row.workspace_name,
      createdByUserId: row.created_by_user_id,
      createdByDisplayName: row.created_by_display_name,
      updatedAtIso: row.updated_at_iso,
      isDemo: Boolean(row.bootstrap_key),
      sourceRevision: {
        packageSha256: row.package_sha256,
        revisionNumber: Number(row.revision_number),
        storageStatus: row.source_storage_status,
      },
    }));
  }

  async function getManagedAccount(userId) {
    return (await listManagedAccounts()).find((account) => account.userId === userId) ?? null;
  }

  async function recordPlatformAuditEvent({
    actorUserId,
    eventCode,
    event = {},
    targetUserId = null,
    tenantId = null,
    workspaceId = null,
  }) {
    await ensureActorUserExists(actorUserId);
    await db.prepare(
      `INSERT INTO platform_audit_events (
        audit_event_id, actor_user_id, target_user_id, tenant_id, workspace_id,
        event_code, event_json, created_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      randomUUID(),
      actorUserId,
      targetUserId,
      tenantId,
      workspaceId,
      eventCode,
      JSON.stringify(event),
      new Date().toISOString(),
    );
  }

  async function listDevelopmentUsers() {
    const rows = await db
      .prepare(
        `SELECT user_id
        FROM platform_users pu
        WHERE pu.account_status = 'active'
          AND (
            pu.user_id IN (
              'demo-super-admin',
              'demo-manager',
              'demo-reviewer',
              'demo-client-viewer',
              'demo-isolated-inspector'
            )
            OR EXISTS (
              SELECT 1
              FROM report_jobs rj
              WHERE rj.bootstrap_key = 'api-standard-v10'
                AND rj.created_by_user_id = pu.user_id
            )
          )
        ORDER BY
          CASE pu.role_label
            WHEN 'Inspector' THEN 1
            WHEN 'Reviewer' THEN 2
            WHEN 'Manager' THEN 3
            WHEN 'Client Viewer' THEN 4
            WHEN 'Super Admin' THEN 5
            ELSE 6
          END,
          pu.display_name`,
      )
      .all();
    return (await Promise.all(rows.map((row) => getUserPrincipal(row.user_id)))).filter(Boolean);
  }

  async function ensureDevelopmentUsers() {
    const seed = await db
      .prepare(
        `SELECT
          rj.tenant_id,
          rj.workspace_id,
          t.tenant_name,
          w.workspace_name
        FROM report_jobs rj
        JOIN tenants t ON t.tenant_id = rj.tenant_id
        JOIN workspaces w ON w.workspace_id = rj.workspace_id
        ORDER BY CASE WHEN rj.bootstrap_key = 'api-standard-v10' THEN 0 ELSE 1 END,
          rj.created_at_iso DESC
        LIMIT 1`,
      )
      .get();
    if (!seed) return;

    const nowIso = new Date().toISOString();
    const controlledUsers = [
      { userId: "demo-super-admin", displayName: "Demo LAIQ Administrator", roleLabel: "Super Admin" },
      { userId: "demo-manager", displayName: "Demo Report Manager", roleLabel: "Manager" },
      { userId: "demo-reviewer", displayName: "Demo Technical Reviewer", roleLabel: "Reviewer" },
      { userId: "demo-client-viewer", displayName: "Demo Client Viewer", roleLabel: "Client Viewer" },
    ];

    await inTransaction(async () => {
      for (const user of controlledUsers) {
        await upsertControlledDevelopmentUser({
          ...user,
          tenantId: seed.tenant_id,
          workspaceId: seed.workspace_id,
          nowIso,
        });
      }

      const isolatedTenantId = "tenant-auth-isolation-demo";
      const isolatedWorkspaceId = "workspace-auth-isolation-demo";
      await db.prepare(
        `INSERT INTO tenants (tenant_id, tenant_name, created_at_iso, updated_at_iso)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(tenant_id) DO NOTHING`,
      ).run(isolatedTenantId, "Isolation Demo Tenant", nowIso, nowIso);
      await db.prepare(
        `INSERT INTO workspaces (workspace_id, tenant_id, workspace_name, created_at_iso, updated_at_iso)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(workspace_id) DO NOTHING`,
      ).run(isolatedWorkspaceId, isolatedTenantId, "Isolation Workspace", nowIso, nowIso);
      await upsertControlledDevelopmentUser({
        userId: "demo-isolated-inspector",
        displayName: "Isolated Tenant Inspector",
        roleLabel: "Inspector",
        tenantId: isolatedTenantId,
        workspaceId: isolatedWorkspaceId,
        nowIso,
      });
    });
  }

  async function loadReportJobState(reportJobId) {
    const row = await db
      .prepare(
        `SELECT
          rj.report_job_id,
          rj.bootstrap_key,
          rj.inspection_id,
          rj.tenant_id,
          rj.workspace_id,
          rj.created_by_user_id,
          rj.report_reference,
          rj.title,
          rj.client,
          rj.tank,
          rj.inspected_date,
          rj.status_code,
          rj.manual_inputs_revision,
          rj.created_at_iso,
          rj.updated_at_iso,
          ri.import_id,
          ri.package_sha256,
          ri.revision_number,
          ri.source_object_key,
          ri.source_byte_size,
          ri.source_sha256,
          ri.source_media_type,
          ri.source_storage_status,
          ri.raw_package_json,
          pu.display_name,
          pu.role_label
        FROM report_jobs rj
        JOIN report_imports ri ON ri.import_id = rj.import_id
        LEFT JOIN platform_users pu ON pu.user_id = rj.created_by_user_id
        WHERE rj.report_job_id = ?`,
      )
      .get(reportJobId);

    if (!row) {
      return null;
    }

    const manualSupplementRows = await db
      .prepare(
        `SELECT field_key, field_value
        FROM report_manual_inputs
        WHERE report_job_id = ?
        ORDER BY field_key`,
      )
      .all(reportJobId);
    const sectionDraftRows = await db
      .prepare(
        `SELECT section_id, content, generated, edited, approved, review_required, version, updated_at_iso
        FROM report_section_drafts
        WHERE report_job_id = ?
        ORDER BY section_id`,
      )
      .all(reportJobId);
    const sectionDraftVersionRows = await db
      .prepare(
        `SELECT section_id, COUNT(*) AS version_count
        FROM report_section_draft_versions
        WHERE report_job_id = ?
        GROUP BY section_id`,
      )
      .all(reportJobId);
    const sectionDraftVersionCounts = new Map(
      sectionDraftVersionRows.map((row) => [row.section_id, Number(row.version_count ?? 0)]),
    );
    const layoutOverrideRows = await db
      .prepare(
        `SELECT section_id, layout_json, version, updated_at_iso
        FROM report_layout_overrides
        WHERE report_job_id = ?
        ORDER BY section_id`,
      )
      .all(reportJobId);
    const latestGenerationRun = await db
      .prepare(
        `SELECT
          run_id,
          section_id,
          status_code,
          template_key,
          retrieval_json,
          calculation_json,
          map_artifacts_json,
          warnings_json,
          blockers_json,
          provider_code,
          model_id,
          used_live_model,
          fallback_reason,
          assistant_summary,
          orchestration_json,
          created_at_iso
        FROM report_generation_runs
        WHERE report_job_id = ?
        ORDER BY created_at_iso DESC
        LIMIT 1`,
      )
      .get(reportJobId);
    const latestEvalRun = await db
      .prepare(
        `SELECT eval_json
        FROM report_eval_runs
        WHERE report_job_id = ?
        ORDER BY created_at_iso DESC
        LIMIT 1`,
      )
      .get(reportJobId);

    const exportPackage = parseJsonValue(row.raw_package_json);
    const latestOrchestration = latestGenerationRun?.orchestration_json
      ? parseJsonValue(latestGenerationRun.orchestration_json)
      : null;

    return {
      reportJob: {
        reportJobId: row.report_job_id,
        isDemo: Boolean(row.bootstrap_key),
        inspectionId: row.inspection_id,
        tenantId: row.tenant_id,
        workspaceId: row.workspace_id,
        createdByUserId: row.created_by_user_id,
        reportReference: row.report_reference,
        title: row.title,
        client: row.client,
        tank: row.tank,
        inspectedDate: row.inspected_date,
        statusCode: row.status_code,
        manualInputsRevision: Number(row.manual_inputs_revision ?? 0),
        createdAtIso: row.created_at_iso,
        updatedAtIso: row.updated_at_iso,
        sourceRevision: {
          importId: row.import_id,
          packageSha256: row.package_sha256,
          revisionNumber: Number(row.revision_number),
          sourceObjectKey: row.source_object_key,
          sourceByteSize: row.source_byte_size == null ? null : Number(row.source_byte_size),
          sourceSha256: row.source_sha256,
          sourceMediaType: row.source_media_type,
          storageStatus: row.source_storage_status,
        },
      },
      authorizationContext: {
        actorUserId: row.created_by_user_id,
        actorDisplayName: row.display_name,
        roleLabel: row.role_label,
        tenantId: row.tenant_id,
        workspaceId: row.workspace_id,
      },
      exportPackage,
      reportClassification: classifyReportPackage(exportPackage),
      manualSupplement: Object.fromEntries(
        manualSupplementRows
          .filter((manualInput) => !manualInput.field_key.startsWith("__"))
          .map((manualInput) => [manualInput.field_key, manualInput.field_value]),
      ),
      sectionDrafts: sectionDraftRows.map((sectionDraft) => ({
        sectionId: sectionDraft.section_id,
        content: sectionDraft.content,
        generated: Boolean(sectionDraft.generated),
        edited: Boolean(sectionDraft.edited),
        approved: Boolean(sectionDraft.approved),
        reviewRequired: Boolean(sectionDraft.review_required),
        version: Number(sectionDraft.version),
        updatedAtIso: sectionDraft.updated_at_iso,
        previousVersionCount: sectionDraftVersionCounts.get(sectionDraft.section_id) ?? 0,
      })),
      layoutOverrides: layoutOverrideRows.map((layoutOverride) => ({
        sectionId: layoutOverride.section_id,
        layoutMap: normalizePersistedLayoutMap(parseJsonValue(layoutOverride.layout_json)),
        version: Number(layoutOverride.version ?? 0),
        updatedAtIso: layoutOverride.updated_at_iso,
      })),
      generationRun: latestGenerationRun
        ? {
            runId: latestGenerationRun.run_id,
            sectionId: latestGenerationRun.section_id,
            statusCode: latestGenerationRun.status_code,
            templateKey: latestGenerationRun.template_key,
            retrievalKeys: parseJsonValue(latestGenerationRun.retrieval_json),
            calculationKeys: parseJsonValue(latestGenerationRun.calculation_json),
            mapArtifactKeys: parseJsonValue(latestGenerationRun.map_artifacts_json),
            warnings: parseJsonValue(latestGenerationRun.warnings_json),
            blockers: parseJsonValue(latestGenerationRun.blockers_json),
            providerCode: latestGenerationRun.provider_code,
            modelId: latestGenerationRun.model_id,
            usedLiveModel: latestGenerationRun.used_live_model == null ? undefined : Boolean(latestGenerationRun.used_live_model),
            fallbackReason: latestGenerationRun.fallback_reason,
            assistantSummary: latestGenerationRun.assistant_summary,
            evidenceChain: latestOrchestration?.evidenceChain,
            generatedAtIso: latestGenerationRun.created_at_iso,
          }
        : undefined,
      evalRun: latestEvalRun?.eval_json ? parseJsonValue(latestEvalRun.eval_json) : undefined,
      aiStatus: getAiStatus(),
    };
  }

  async function saveManualInputs(reportJobId, values, { expectedRevision } = {}) {
    await ensureReportJobExists(reportJobId);
    const nowIso = new Date().toISOString();
    const entries = Object.entries(values);

    if (entries.length === 0) {
      return loadReportJobState(reportJobId);
    }

    await inTransaction(async () => {
      const reportJob = await db
        .prepare(
          `SELECT manual_inputs_revision
          FROM report_jobs
          WHERE report_job_id = ?
          FOR UPDATE`,
        )
        .get(reportJobId);
      const currentRevision = Number(reportJob?.manual_inputs_revision ?? 0);
      const requestedRevision = Number(expectedRevision);
      if (!Number.isInteger(requestedRevision) || requestedRevision < 0) {
        throw new ApiError(
          400,
          "The current manual-input revision is required before saving report details.",
          "manual_inputs_revision_required",
        );
      }
      if (requestedRevision !== currentRevision) {
        throw new ApiError(
          409,
          "Report details changed in another session. Reload the latest report details before saving.",
          "manual_inputs_revision_conflict",
        );
      }

      for (const [fieldKey, fieldValue] of entries) {
        await db.prepare(
          `INSERT INTO report_manual_inputs (report_job_id, field_key, field_value, updated_at_iso)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(report_job_id, field_key) DO UPDATE SET
            field_value = excluded.field_value,
            updated_at_iso = excluded.updated_at_iso`,
        ).run(reportJobId, fieldKey, String(fieldValue ?? ""), nowIso);
      }

      await db.prepare(
        `UPDATE report_jobs
        SET manual_inputs_revision = manual_inputs_revision + 1,
          updated_at_iso = ?
        WHERE report_job_id = ?`,
      ).run(nowIso, reportJobId);
    });

    return loadReportJobState(reportJobId);
  }

  async function resetReportDrafts(reportJobId) {
    await ensureReportJobExists(reportJobId);
    const nowIso = new Date().toISOString();

    await inTransaction(async () => {
      await clearDerivedReportState(reportJobId, nowIso);
    });

    return loadReportJobState(reportJobId);
  }

  async function clearDerivedReportState(reportJobId, nowIso) {
    await db.prepare("DELETE FROM report_eval_runs WHERE report_job_id = ?").run(reportJobId);
    await db.prepare("DELETE FROM report_generation_runs WHERE report_job_id = ?").run(reportJobId);
    await db.prepare("DELETE FROM report_review_decisions WHERE report_job_id = ?").run(reportJobId);
    await db.prepare("DELETE FROM report_layout_overrides WHERE report_job_id = ?").run(reportJobId);
    await db.prepare("DELETE FROM report_section_draft_versions WHERE report_job_id = ?").run(reportJobId);
    await db.prepare("DELETE FROM report_section_drafts WHERE report_job_id = ?").run(reportJobId);
    await db.prepare("UPDATE report_jobs SET status_code = ?, updated_at_iso = ? WHERE report_job_id = ?").run(
      "draft",
      nowIso,
      reportJobId,
    );
  }

  async function saveSectionDraft(reportJobId, sectionId, draft) {
    await ensureReportJobExists(reportJobId);
    ensureKnownSection(sectionId);
    const nowIso = new Date().toISOString();
    const nextContent = String(draft.content ?? "");
    const reasonCode = draft.reasonCode === "targeted_ai_edit" ? "targeted_ai_edit" : "draft_save";
    await inTransaction(async () => {
      const existingSectionDraft = await db
        .prepare(
          `SELECT content, approved, review_required, version
          FROM report_section_drafts
          WHERE report_job_id = ? AND section_id = ?
          FOR UPDATE`,
        )
        .get(reportJobId, sectionId);
      const currentVersion = Number(existingSectionDraft?.version ?? 0);
      const expectedVersion = Number(draft.expectedVersion ?? 0);
      if (!Number.isInteger(expectedVersion) || expectedVersion !== currentVersion) {
        throw new ApiError(
          409,
          "This section was changed in another session. Reload the latest section before saving your edit.",
          "section_version_conflict",
        );
      }

      const contentChanged = !existingSectionDraft || existingSectionDraft.content !== nextContent;
      // Approval is a server-owned transition. Preserve it only when a save does not change content.
      const nextApproved = Boolean(existingSectionDraft?.approved) && !contentChanged;
      const nextReviewRequired = nextApproved
        ? false
        : contentChanged
          ? Boolean(draft.generated || draft.edited)
          : Boolean(draft.reviewRequired ?? existingSectionDraft?.review_required);

      await snapshotExistingSectionDraft(reportJobId, sectionId, nextContent, nowIso, reasonCode);

      await db.prepare(
        `INSERT INTO report_section_drafts (
          report_job_id,
          section_id,
          content,
          generated,
          edited,
          approved,
          review_required,
          version,
          updated_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT(report_job_id, section_id) DO UPDATE SET
          content = excluded.content,
          generated = excluded.generated,
          edited = excluded.edited,
          approved = excluded.approved,
          review_required = excluded.review_required,
          version = report_section_drafts.version + 1,
          updated_at_iso = excluded.updated_at_iso`,
      ).run(
        reportJobId,
        sectionId,
        nextContent,
        boolToInt(draft.generated),
        boolToInt(draft.edited),
        boolToInt(nextApproved),
        boolToInt(nextReviewRequired),
        nowIso,
      );

      await db.prepare("UPDATE report_jobs SET status_code = ?, updated_at_iso = ? WHERE report_job_id = ?").run(
        nextApproved ? "reviewed" : "draft",
        nowIso,
        reportJobId,
      );
    });

    return loadReportJobState(reportJobId);
  }

  async function restorePreviousSectionDraft(reportJobId, sectionId, { actorUserId, expectedVersion } = {}) {
    await ensureReportJobExists(reportJobId);
    ensureKnownSection(sectionId);
    const fallbackActor = actorUserId || await getReportJobActorUserId(reportJobId);
    await ensureActorUserExists(fallbackActor);

    const nowIso = new Date().toISOString();

    await inTransaction(async () => {
      const currentDraft = await db
        .prepare(
          `SELECT version
          FROM report_section_drafts
          WHERE report_job_id = ? AND section_id = ?
          FOR UPDATE`,
        )
        .get(reportJobId, sectionId);
      const currentVersion = Number(currentDraft?.version ?? 0);
      const requestedVersion = Number(expectedVersion);
      if (!Number.isInteger(requestedVersion) || requestedVersion < 0) {
        throw new ApiError(
          400,
          "The current section version is required before restoring an earlier output.",
          "section_version_required",
        );
      }
      if (requestedVersion !== currentVersion) {
        throw new ApiError(
          409,
          "This section changed in another session. Reload the latest section before restoring an earlier output.",
          "section_version_conflict",
        );
      }

      const previousVersion = await db
        .prepare(
          `SELECT
            version_id,
            content,
            generated,
            edited,
            approved,
            review_required
          FROM report_section_draft_versions
          WHERE report_job_id = ? AND section_id = ?
          ORDER BY created_at_iso DESC, version_id DESC
          LIMIT 1
          FOR UPDATE`,
        )
        .get(reportJobId, sectionId);

      if (!previousVersion) {
        throw new ApiError(
          404,
          `No previous generated output is available for ${sectionId}.`,
          "section_draft_version_not_found",
        );
      }

      await db.prepare("DELETE FROM report_section_draft_versions WHERE version_id = ?").run(previousVersion.version_id);
      await snapshotExistingSectionDraft(reportJobId, sectionId, previousVersion.content, nowIso, "rollback_replaced_draft");

      await db.prepare(
        `INSERT INTO report_section_drafts (
          report_job_id,
          section_id,
          content,
          generated,
          edited,
          approved,
          review_required,
          version,
          updated_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT(report_job_id, section_id) DO UPDATE SET
          content = excluded.content,
          generated = excluded.generated,
          edited = excluded.edited,
          approved = excluded.approved,
          review_required = excluded.review_required,
          version = report_section_drafts.version + 1,
          updated_at_iso = excluded.updated_at_iso`,
      ).run(
        reportJobId,
        sectionId,
        previousVersion.content,
        boolToInt(previousVersion.generated),
        1,
        0,
        1,
        nowIso,
      );

      await db.prepare("UPDATE report_jobs SET status_code = ?, updated_at_iso = ? WHERE report_job_id = ?").run(
        "draft",
        nowIso,
        reportJobId,
      );
    });

    return loadReportJobState(reportJobId);
  }

  async function saveLayoutOverride(reportJobId, sectionId, layoutMap, { expectedVersion } = {}) {
    await ensureReportJobExists(reportJobId);
    ensureKnownSection(sectionId);
    const nowIso = new Date().toISOString();

    await inTransaction(async () => {
      const existingLayoutOverride = await db
        .prepare(
          `SELECT version
          FROM report_layout_overrides
          WHERE report_job_id = ? AND section_id = ?
          FOR UPDATE`,
        )
        .get(reportJobId, sectionId);
      const currentVersion = Number(existingLayoutOverride?.version ?? 0);
      const requestedVersion = Number(expectedVersion);
      if (!Number.isInteger(requestedVersion) || requestedVersion < 0) {
        throw new ApiError(
          400,
          "The current layout version is required before saving a layout change.",
          "layout_version_required",
        );
      }
      if (requestedVersion !== currentVersion) {
        throw new ApiError(
          409,
          "This layout changed in another session. Reload the latest layout before saving.",
          "layout_version_conflict",
        );
      }

      await db.prepare(
        `INSERT INTO report_layout_overrides (report_job_id, section_id, layout_json, version, updated_at_iso)
        VALUES (?, ?, ?, 1, ?)
        ON CONFLICT(report_job_id, section_id) DO UPDATE SET
          layout_json = excluded.layout_json,
          version = report_layout_overrides.version + 1,
          updated_at_iso = excluded.updated_at_iso`,
      ).run(reportJobId, sectionId, JSON.stringify(normalizePersistedLayoutMap(layoutMap)), nowIso);

      await db.prepare(
        `UPDATE report_section_drafts
        SET approved = 0, review_required = 1, version = version + 1, updated_at_iso = ?
        WHERE report_job_id = ? AND section_id = ?`,
      ).run(nowIso, reportJobId, sectionId);

      await touchReportJob(reportJobId, nowIso);
    });

    return loadReportJobState(reportJobId);
  }

  async function generateSection(
    reportJobId,
    sectionId,
    { actorUserId, userInstruction = "", expectedVersion } = {},
  ) {
    await ensureReportJobExists(reportJobId);
    ensureKnownSection(sectionId);
    const reportState = await loadReportJobState(reportJobId);
    if (!reportState) {
      throw new ApiError(404, "Report job was not found.", "report_job_not_found");
    }
    const fallbackActor = actorUserId || await getReportJobActorUserId(reportJobId);
    const actor = await ensureActorUserExists(fallbackActor);
    const initialDraft = reportState.sectionDrafts?.find((draft) => draft.sectionId === sectionId);
    const initialVersion = Number(initialDraft?.version ?? 0);
    const requestedVersion = Number(expectedVersion);
    if (!Number.isInteger(requestedVersion) || requestedVersion < 0) {
      throw new ApiError(
        400,
        "The current section version is required before generation.",
        "section_version_required",
      );
    }
    if (requestedVersion !== initialVersion) {
      throw new ApiError(
        409,
        "This section changed in another session. Reload the latest section before generating it.",
        "section_version_conflict",
      );
    }

    const policyDecision = await selectSystemRlDecision({
      mode: SYSTEM_RL_MODES.LIVE,
      reportState,
      sectionId,
    });
    const generation = await generateSectionDraft({
      reportState,
      sectionId,
      userInstruction,
      policyDecision,
    });
    const evalRun = evaluateGeneratedSection({
      reportState,
      sectionId,
      generationRun: generation.generationRun,
      generatedContent: generation.draft.content,
      orchestration: generation.orchestration,
    });
    const nowIso = generation.generationRun.generatedAtIso;

    await inTransaction(async () => {
      const currentDraft = await db
        .prepare(
          `SELECT version
          FROM report_section_drafts
          WHERE report_job_id = ? AND section_id = ?
          FOR UPDATE`,
        )
        .get(reportJobId, sectionId);
      const currentVersion = Number(currentDraft?.version ?? 0);
      if (currentVersion !== requestedVersion) {
        throw new ApiError(
          409,
          "This section changed while generation was running. The generated result was discarded; reload before retrying.",
          "section_version_conflict",
        );
      }

      await snapshotExistingSectionDraft(reportJobId, sectionId, generation.draft.content, nowIso, "section_generate");

      await db.prepare(
        `INSERT INTO report_section_drafts (
          report_job_id,
          section_id,
          content,
          generated,
          edited,
          approved,
          review_required,
          version,
          updated_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT(report_job_id, section_id) DO UPDATE SET
          content = excluded.content,
          generated = excluded.generated,
          edited = excluded.edited,
          approved = excluded.approved,
          review_required = excluded.review_required,
          version = report_section_drafts.version + 1,
          updated_at_iso = excluded.updated_at_iso`,
      ).run(
        reportJobId,
        sectionId,
        generation.draft.content,
        1,
        boolToInt(generation.draft.edited),
        0,
        boolToInt(generation.draft.reviewRequired),
        nowIso,
      );

      await db.prepare(
        `INSERT INTO report_generation_runs (
          run_id,
          report_job_id,
          section_id,
          actor_user_id,
          template_key,
          status_code,
          retrieval_json,
          calculation_json,
          map_artifacts_json,
          warnings_json,
          blockers_json,
          provider_code,
          model_id,
          used_live_model,
          fallback_reason,
          assistant_summary,
          orchestration_json,
          generated_content,
          created_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        generation.generationRun.runId,
        reportJobId,
        sectionId,
        actor,
        generation.generationRun.templateKey,
        generation.generationRun.statusCode,
        JSON.stringify(generation.generationRun.retrievalKeys),
        JSON.stringify(generation.generationRun.calculationKeys),
        JSON.stringify(generation.generationRun.mapArtifactKeys),
        JSON.stringify(generation.generationRun.warnings),
        JSON.stringify(generation.generationRun.blockers),
        generation.generationRun.providerCode ?? null,
        generation.generationRun.modelId ?? null,
        generation.generationRun.usedLiveModel == null ? null : boolToInt(generation.generationRun.usedLiveModel),
        generation.generationRun.fallbackReason ?? null,
        generation.generationRun.assistantSummary ?? null,
        JSON.stringify(generation.orchestration),
        generation.draft.content,
        nowIso,
      );

      await db.prepare(
        `INSERT INTO report_eval_runs (
          eval_run_id,
          run_id,
          report_job_id,
          section_id,
          evaluator_key,
          score,
          outcome_code,
          summary,
          eval_json,
          created_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        evalRun.evalRunId,
        generation.generationRun.runId,
        reportJobId,
        sectionId,
        evalRun.evaluatorKey,
        evalRun.score,
        evalRun.outcomeCode,
        evalRun.summary,
        JSON.stringify(evalRun),
        evalRun.createdAtIso,
      );

      await systemRl.recordEpisode({
        decision: policyDecision,
        evalRun,
        generationRun: generation.generationRun,
      });

      await db.prepare("UPDATE report_jobs SET status_code = ?, updated_at_iso = ? WHERE report_job_id = ?").run(
        generation.generationRun.statusCode,
        nowIso,
        reportJobId,
      );
    });

    return {
      ...await loadReportJobState(reportJobId),
      generationRun: generation.generationRun,
      evalRun,
      aiStatus: getAiStatus(),
      systemRlPolicy: generation.orchestration.systemRlPolicy,
    };
  }

  async function runSystemRlEvaluation({
    actorUserId,
    reportJobId,
    sectionId,
    userInstruction = "",
    evaluationCaseId = null,
    frozenCandidate = false,
    updateLearning = true,
  }) {
    await ensureReportJobExists(reportJobId);
    ensureKnownSection(sectionId);
    const actor = await ensureActorUserExists(actorUserId);
    const reportState = await loadReportJobState(reportJobId);
    if (!reportState) {
      throw new ApiError(404, "Report job was not found.", "report_job_not_found");
    }
    let evaluationCaseConfig = null;
    let standardizedPair = null;
    if (evaluationCaseId) {
      const evaluationCase = await db.prepare(
        `SELECT config_json FROM report_evaluation_cases
        WHERE evaluation_case_id = ? AND input_inspection_id = ?`,
      ).get(evaluationCaseId, reportState.reportJob?.inspectionId);
      if (!evaluationCase) throw new ApiError(404, "Golden-standard evaluation case was not found.", "evaluation_case_not_found");
      evaluationCaseConfig = parseJsonValue(evaluationCase.config_json);
      const previousAttempt = await db.prepare(
        `SELECT r.learning_eligible
        FROM report_eval_runs e
        JOIN system_rl_policy_rewards r ON r.eval_run_id = e.eval_run_id
        WHERE e.evaluation_case_id = ? AND e.section_id = ?
          AND COALESCE(e.eval_json->>'experimentContract','legacy') = ?
        ORDER BY e.created_at_iso DESC LIMIT 1`,
      ).get(evaluationCaseId, sectionId, evaluationCaseConfig.metricContract ?? "legacy");
      if (previousAttempt?.learning_eligible === false) {
        throw new ApiError(409, "This episode is paused after an invalid attempt. Resolve its evidence contract before retrying.", "evaluation_episode_paused");
      }
      if (evaluationCaseConfig.baselineVariationId) {
        const baselineVariation = await db.prepare(
          `SELECT v.variation_id,v.status_code,v.manifest_json,p.baseline_pair_id,p.section_key,g.target_content
          FROM report_baseline_capture_variations v
          JOIN report_baseline_gold_pairs p ON p.baseline_pair_id=v.baseline_pair_id
          JOIN report_standardized_gold_sections g ON g.gold_section_id=p.gold_section_id
          WHERE v.variation_id=? AND v.app_report_job_id=? AND p.section_key=?`,
        ).get(evaluationCaseConfig.baselineVariationId,reportJobId,sectionId);
        const manifest=parseJsonValue(baselineVariation?.manifest_json ?? {});
        standardizedPair=baselineVariation ? {
          pair_id:baselineVariation.baseline_pair_id,
          status_code:baselineVariation.status_code === "materialized" ? "ready" : baselineVariation.status_code,
          expected_recoverable_fact_ids_json:manifest.expectedRecoverableFactIds ?? [],
          input_fact_ids_json:(manifest.captures ?? []).map((fact) => fact.factId),
          input_fact_values_json:Object.fromEntries((manifest.captures ?? []).map((fact) => [fact.factId,{
            value:fact.value,unitCode:fact.unitCode,answerabilityClass:fact.answerabilityClass,
            factType:fact.factType,evidenceClass:fact.evidenceClass,requiredFact:Boolean(fact.requiredFact),
            safetyCriticality:fact.safetyCriticality??"medium",
          }])),
          validation_json:{ baselineVariationContract:true, evaluationMode:manifest.baselineContract?.evaluationMode??"direct_recovery", minimumGoldContentCoverage:Number(manifest.baselineContract?.minimumGoldContentCoverage??0.55) },
          target_content:baselineVariation.target_content,
        } : null;
        const knownSectionIds = new Set(API_STANDARD_REPORT_TOC.map((item) => item.id));
        const targetByFact = new Map((manifest.captures ?? []).map((fact) => [
          fact.factId,knownSectionIds.has(fact.sectionKey) ? fact.sectionKey : sectionId,
        ]));
        reportState.exportPackage.captureFacts = (reportState.exportPackage.captureFacts ?? []).map((fact) => ({
          ...fact,
          sourceSectionKey:fact.sourceSectionKey ?? targetByFact.get(fact.factId) ?? null,
          targetReportSectionId:sectionId,
        }));
      } else {
        standardizedPair = await db.prepare(
          `SELECT p.pair_id, p.status_code, p.expected_recoverable_fact_ids_json, p.validation_json, g.target_content
          FROM report_standardized_mock_gold_pairs p
          JOIN report_standardized_gold_sections g ON g.gold_section_id=p.gold_section_id
          WHERE p.variant_id = ? AND p.section_key = ? AND p.contract_version = 1`,
        ).get(evaluationCaseConfig.captureVariantId, sectionId);
      }
      if (!standardizedPair || standardizedPair.status_code !== "ready") {
        throw new ApiError(
          409,
          "This section does not have an aligned standardized mock-to-gold pair.",
          "standardized_pair_required",
        );
      }
      const firewallCase = await db.prepare(
        `SELECT tc.training_case_id,tc.snapshot_id,tc.gold_document_id,tc.benchmark_track,
          tc.evidence_as_of,tc.asset_lineage_key,bd.source_case_id,bd.source_rendition_id,
          bd.source_sha256,bd.source_object_key,
          COALESCE(kd.metadata_json->>'fileName',kd.metadata_json->>'sourceName',kd.source_uri) AS source_name
        FROM report_training_cases tc
        JOIN report_benchmark_documents bd
          ON bd.snapshot_id=tc.snapshot_id AND bd.document_id=tc.gold_document_id
        JOIN kb_documents kd ON kd.document_id=tc.gold_document_id
        WHERE tc.training_case_id=?`,
      ).get(evaluationCaseConfig.goldTruthCaseId);
      if (!firewallCase) {
        throw new ApiError(409, "Evaluation retrieval lineage is missing.", "retrieval_firewall_lineage_required");
      }
      const retrievableDocuments = await db.prepare(
        `SELECT DISTINCT bd.source_sha256 FROM report_benchmark_documents bd
        JOIN report_benchmark_snapshots bs ON bs.snapshot_id=bd.snapshot_id
        WHERE bs.status_code='locked'
          AND bd.benchmark_role IN ('training_precedent','training_gold')
          AND bd.dataset_split='training' AND bd.evidence_issued_at<=?
          AND bd.source_sha256<>?
          AND (?::text IS NULL OR bd.asset_lineage_key IS DISTINCT FROM ?::text)`,
      ).all(
        firewallCase.evidence_as_of,
        firewallCase.source_sha256,
        firewallCase.benchmark_track === "asset_generalization" ? firewallCase.asset_lineage_key : null,
        firewallCase.asset_lineage_key,
      );
      reportState.retrievalFirewallContext = buildRetrievalFirewallContext({
        snapshotId: firewallCase.snapshot_id,
        evaluationCaseId,
        trainingCaseId: firewallCase.training_case_id,
        evidenceAsOf: firewallCase.evidence_as_of,
        benchmarkTrack: firewallCase.benchmark_track,
        assetLineageKey: firewallCase.asset_lineage_key,
        blockedDocumentIds: [firewallCase.gold_document_id],
        blockedCaseIds: [firewallCase.source_case_id],
        blockedRenditionIds: [firewallCase.source_rendition_id],
        blockedSourceSha256: [firewallCase.source_sha256],
        blockedSourcePaths: [firewallCase.source_object_key],
        blockedSourceNames: [firewallCase.source_name],
        allowedSourceSha256: retrievableDocuments.map((document) => document.source_sha256),
      });
      if (!evaluationCaseConfig.baselineVariationId) {
        const lineage = await db.prepare(
          `SELECT l.fact_id, f.source_page_number, f.section_key
          FROM report_capture_variant_fact_links l
          JOIN report_training_case_facts f ON f.fact_id = l.fact_id
          WHERE l.variant_id = ? AND l.disposition_code <> 'withheld'`,
        ).all(evaluationCaseConfig.captureVariantId);
        const knownSectionIds = new Set(API_STANDARD_REPORT_TOC.map((item) => item.id));
        const targetByFact = new Map(lineage.map((item) => [
          item.fact_id,
          knownSectionIds.has(item.section_key) ? item.section_key : mapSourcePageToReportSection(item.source_page_number),
        ]));
        reportState.exportPackage.captureFacts = (reportState.exportPackage.captureFacts ?? []).map((fact) => ({
          ...fact,
          targetReportSectionId: fact.targetReportSectionId ?? targetByFact.get(fact.factId) ?? "inspection-report",
        }));
      }
    }
    const policyDecision = await selectSystemRlDecision({
      mode: SYSTEM_RL_MODES.OFFLINE,
      reportState,
      sectionId,
      frozenCandidate,
    });
    const generation = await generateSectionDraft({
      reportState,
      sectionId,
      userInstruction,
      policyDecision,
    });
    const evalRun = evaluateGeneratedSection({
      reportState,
      sectionId,
      generationRun: generation.generationRun,
      generatedContent: generation.draft.content,
      orchestration: generation.orchestration,
    });
    evalRun.experimentContract = evaluationCaseConfig?.metricContract ?? "live";
    if (evaluationCaseId) {
      const truthFacts = await db.prepare(
        `SELECT f.*, a.answerability_class, a.required_fact
        FROM report_training_case_facts f
        JOIN report_training_case_answerability a ON a.fact_id = f.fact_id
        WHERE f.training_case_id = ? AND f.review_status = 'approved' AND a.review_status = 'approved'`,
      ).all(evaluationCaseConfig.goldTruthCaseId);
      const recoverableIds = new Set(parseJsonValue(
        standardizedPair?.expected_recoverable_fact_ids_json ?? [],
      ));
      const inputFactIds = new Set(parseJsonValue(standardizedPair?.input_fact_ids_json ?? standardizedPair?.expected_recoverable_fact_ids_json ?? []));
      const inputFactValues = parseJsonValue(standardizedPair?.input_fact_values_json ?? {});
      const truthById = new Map(truthFacts.map((fact) => [fact.fact_id, fact]));
      const sectionTruthFacts = [...inputFactIds].map((factId) => {
        const fact = truthById.get(factId) ?? {};
        const input = inputFactValues[factId] ?? {};
        const recoverable = recoverableIds.has(factId);
        return {
          ...fact,
          fact_id: factId,
          fact_type: input.factType ?? fact.fact_type ?? "voice_finding_input",
          normalized_value_json: input.value ?? fact.normalized_value_json,
          unit_code: input.unitCode ?? fact.unit_code,
          answerability_class: input.answerabilityClass ?? fact.answerability_class ?? "voice_observable",
          required_fact: recoverable && Boolean(input.requiredFact ?? fact.required_fact ?? true),
          evidence_class: recoverable ? (input.evidenceClass ?? fact.evidence_class ?? "finding") : "context_evidence",
          safety_criticality: recoverable ? (input.safetyCriticality ?? fact.safety_criticality ?? "medium") : "low",
        };
      });
      evalRun.evaluationCaseId = evaluationCaseId;
      evalRun.standardizedPairId = standardizedPair.pair_id;
      evalRun.truthGraphEvaluation = evaluateTruthGraphRecovery({ facts: sectionTruthFacts, generatedContent: generation.draft.content });
      const pairValidation=parseJsonValue(standardizedPair.validation_json??{});
      evalRun.goldSectionEvaluation = evaluateGoldSectionRecovery({ goldContent: standardizedPair.target_content, generatedContent: generation.draft.content, evaluationMode:pairValidation.evaluationMode, minimumContentCoverage:pairValidation.minimumGoldContentCoverage });
      evalRun.sectionFormatEvaluation = evaluateSectionFormatContract({ sectionId, goldContent: standardizedPair.target_content, generatedContent: generation.draft.content });
      evalRun.semanticSectionEvaluation = await evaluateSemanticSectionSimilarity({sectionId,goldContent:standardizedPair.target_content,generatedContent:generation.draft.content});
      applyTruthGraphOutcome(evalRun);
    }
    let reward;
    await inTransaction(async () => {
      await persistStandaloneGenerationRun({
        actorUserId: actor,
        generation,
        reportJobId,
        sectionId,
      });
      await persistEvalRun({ evalRun, reportJobId, sectionId, evaluationCaseId });
      reward = await systemRl.recordEpisode({
        decision: attachSystemRlDecisionScope(policyDecision, reportState),
        evalRun,
        generationRun: generation.generationRun,
        updateLearning,
      });
    });

    return {
      reportJobId,
      sectionId,
      generatedContent: generation.draft.content,
      generationRun: generation.generationRun,
      evalRun,
      reward,
      policyDecision: generation.orchestration.systemRlPolicy,
      persistedAsReportDraft: false,
    };
  }

  async function promoteSystemRlPolicy({ actorUserId, policyVersionId, reason }) {
    const actor = await ensureActorUserExists(actorUserId);
    const heldOutGate = await getHeldOutPromotionGate(policyVersionId);
    if (!heldOutGate.eligible) {
      throw new ApiError(
        409,
        `Hidden-test promotion gate failed. ${heldOutGate.reasons.join(" ")}`,
        "held_out_promotion_gate_failed",
      );
    }
    const result = await systemRl.promotePolicy({
      actorUserId: actor,
      policyVersionId,
      reason,
    });
    if (!result.ok) {
      throw new ApiError(
        result.code === "policy_not_found" ? 404 : 409,
        result.reasons.join(" "),
        result.code,
      );
    }
    return result;
  }

  async function getSystemRlHeldOutReview({ evaluationCaseId = null, sectionId = null } = {}) {
    const reviewCase = evaluationCaseId ? await db.prepare(
      `SELECT evaluation_case_id,dataset_split FROM report_evaluation_cases WHERE evaluation_case_id=?`,
    ).get(evaluationCaseId) : await db.prepare(
      `SELECT c.evaluation_case_id,c.dataset_split FROM report_eval_runs e
      JOIN report_evaluation_cases c USING (evaluation_case_id)
      JOIN report_baseline_capture_variations v ON v.variation_id=c.config_json->>'baselineVariationId'
      JOIN report_baseline_pilot_cohorts cohort ON cohort.cohort_id=v.cohort_id AND cohort.status_code='active'
      WHERE c.dataset_split='training'
      ORDER BY e.created_at_iso DESC LIMIT 1`,
    ).get();
    const latestCase=reviewCase?.evaluation_case_id;
    const reviewSplit=reviewCase?.dataset_split;
    if (!latestCase) return { available: false, reason: "No completed hidden-test evaluation is available." };
    const sectionClause = sectionId ? "AND e.section_id = ?" : "";
    const row = await db.prepare(
      `SELECT e.eval_run_id, e.evaluation_case_id, e.section_id, e.score,
        e.outcome_code, e.eval_json, e.created_at_iso, g.generated_content,
        c.display_name, c.gold_document_id, c.config_json
      FROM report_eval_runs e
      JOIN report_generation_runs g ON g.run_id = e.run_id
      JOIN report_evaluation_cases c ON c.evaluation_case_id = e.evaluation_case_id
      WHERE c.dataset_split = ? AND e.evaluation_case_id = ?
        ${sectionClause}
      ORDER BY e.created_at_iso DESC
      LIMIT 1`,
    ).get(...(sectionId ? [reviewSplit,latestCase, sectionId] : [reviewSplit,latestCase]));
    if (!row) return { available: false, reason: "No completed hidden-test evaluation is available." };
    const config = parseJsonValue(row.config_json ?? {});
    const enabledRows = await db.prepare(
      `SELECT section_id FROM report_evaluation_case_sections
      WHERE evaluation_case_id = ? AND evaluation_enabled = TRUE`,
    ).all(latestCase);
    const completedRows = await db.prepare(
      `SELECT DISTINCT ON (e.section_id) e.section_id, e.outcome_code, r.hard_failure
      FROM report_eval_runs e
      LEFT JOIN system_rl_policy_rewards r ON r.eval_run_id = e.eval_run_id
      WHERE e.evaluation_case_id = ?
      ORDER BY e.section_id, e.created_at_iso DESC`,
    ).all(latestCase);
    const enabled = new Set(enabledRows.map((item) => item.section_id));
    const completed = new Map(completedRows.map((item) => [item.section_id, item]));
    const sectionOrder = API_STANDARD_REPORT_TOC.map((item) => item.id).filter((id) => enabled.has(id));
    const cohortRows = config.metricContract ? await db.prepare(
      `SELECT DISTINCT ON (e.evaluation_case_id, e.section_id)
        e.evaluation_case_id, e.section_id, e.outcome_code, r.hard_failure, c.display_name
      FROM report_eval_runs e
      JOIN report_evaluation_cases c USING (evaluation_case_id)
      JOIN report_baseline_capture_variations v ON v.variation_id=c.config_json->>'baselineVariationId'
      JOIN report_baseline_pilot_cohorts cohort ON cohort.cohort_id=v.cohort_id AND cohort.status_code='active'
      LEFT JOIN system_rl_policy_rewards r ON r.eval_run_id = e.eval_run_id
      WHERE c.dataset_split = ? AND c.config_json->>'metricContract' = ?
      ORDER BY e.evaluation_case_id, e.section_id, e.created_at_iso DESC`,
    ).all(reviewSplit,String(config.metricContract)) : [];
    const reviewItems = cohortRows.length > 0
      ? cohortRows.sort((left, right) => String(left.display_name).localeCompare(String(right.display_name)) || String(left.section_id).localeCompare(String(right.section_id)))
      : sectionOrder.map((id) => ({
        evaluation_case_id: latestCase,
        section_id: id,
        outcome_code: completed.get(id)?.outcome_code ?? null,
        hard_failure: completed.get(id)?.hard_failure === true,
        display_name: row.display_name,
      }));
    const currentIndex = reviewItems.findIndex((item) => item.evaluation_case_id === row.evaluation_case_id && item.section_id === row.section_id);
    const facts = config.goldTruthCaseId ? await db.prepare(
      `SELECT f.fact_id, f.fact_type, f.section_key, f.normalized_value_json, f.unit_code, f.source_page_number,
        f.evidence_class, f.safety_criticality, a.required_fact
      FROM report_training_case_facts f
      JOIN report_training_case_answerability a ON a.fact_id = f.fact_id
      WHERE f.training_case_id = ? AND f.review_status = 'approved'
        AND a.review_status = 'approved'
      ORDER BY f.source_page_number, f.fact_id`,
    ).all(config.goldTruthCaseId) : [];
    const directlyMappedFacts = facts.filter((fact) => String(fact.section_key ?? "") === row.section_id);
    const sectionFacts = directlyMappedFacts.length > 0
      ? directlyMappedFacts
      : facts.filter((fact) => mapSourcePageToReportSection(fact.source_page_number) === row.section_id);
    const sourcePages = sectionFacts.map((fact) => Number(fact.source_page_number)).filter(Number.isFinite);
    const sourceChunks = await db.prepare(
      `SELECT content, page_numbers_json FROM kb_chunks
      WHERE document_id = ? AND section_type = ? ORDER BY stable_order`,
    ).all(row.gold_document_id, row.section_id);
    const standardizedGold = config.goldSectionId ? await db.prepare(
      `SELECT target_content FROM report_standardized_gold_sections WHERE gold_section_id = ?`,
    ).get(config.goldSectionId) : null;
    const generatedFactIds = [...String(row.generated_content ?? "").matchAll(/data-fact-id=["']([^"']+)["']/g)].map((match) => match[1]);
    const sectionFactsById = new Map(sectionFacts.map((fact) => [String(fact.fact_id), fact]));
    const alignedChecklistFacts = row.section_id === "tank-inspection-checklist"
      ? generatedFactIds.map((factId) => sectionFactsById.get(factId)).filter(Boolean)
      : [];
    const alignedChecklistContent = alignedChecklistFacts.map((fact) => extractFactDisplayText(fact.normalized_value_json)).filter(Boolean).join("\n\n");
    const chunkPages = sourceChunks.flatMap((chunk) => parseJsonValue(chunk.page_numbers_json ?? []))
      .map(Number).filter(Number.isFinite);
    const evaluation = parseJsonValue(row.eval_json ?? {});
    return {
      available: true,
      evalRunId: row.eval_run_id,
      evaluationCaseId: row.evaluation_case_id,
      reportName: row.display_name,
      datasetSplit:reviewSplit,
      goldDocumentId: row.gold_document_id,
      sectionId: row.section_id,
      sourcePageNumber: chunkPages.length > 0 ? Math.min(...chunkPages) : sourcePages.length > 0 ? Math.min(...sourcePages) : 1,
      sections: reviewItems.map((item) => ({
        evaluationCaseId: item.evaluation_case_id,
        reportName: item.display_name,
        sectionId: item.section_id,
        completed: true,
        outcomeCode: item.outcome_code ?? null,
        hardFailure: item.hard_failure === true,
      })),
      allSectionsComplete: reviewItems.length > 0,
      previousEvaluationCaseId: currentIndex > 0 ? reviewItems[currentIndex - 1].evaluation_case_id : null,
      previousSectionId: currentIndex > 0 ? reviewItems[currentIndex - 1].section_id : null,
      nextEvaluationCaseId: currentIndex >= 0 && currentIndex < reviewItems.length - 1 ? reviewItems[currentIndex + 1].evaluation_case_id : null,
      nextSectionId: currentIndex >= 0 && currentIndex < reviewItems.length - 1 ? reviewItems[currentIndex + 1].section_id : null,
      generatedContent: row.generated_content,
      originalSectionContent: String(alignedChecklistContent || standardizedGold?.target_content || sourceChunks.map((chunk) => String(chunk.content ?? "").trim()).filter(Boolean).join("\n\n")),
      originalFacts: sectionFacts.map((fact) => ({
        factId: fact.fact_id,
        factType: fact.fact_type,
        value: parseJsonValue(fact.normalized_value_json),
        unitCode: fact.unit_code,
        evidenceClass: fact.evidence_class,
        safetyCriticality: fact.safety_criticality,
        required: fact.required_fact === true,
      })),
      metrics: {
        score: Number(row.score),
        outcomeCode: row.outcome_code,
        requiredFactRecall: evaluation.truthGraphEvaluation?.requiredFactRecall ?? null,
        claimPrecision: evaluation.truthGraphEvaluation?.claimPrecision ?? null,
        protectedFactAccuracy: Number(evaluation.truthGraphEvaluation?.protectedFactCount ?? 0) > 0
          ? evaluation.truthGraphEvaluation?.protectedFactAccuracy ?? null
          : null,
        formatMatch: evaluation.sectionFormatEvaluation?.score ?? evaluation.dimensions?.find((item) => item.key === "format_match")?.score ?? null,
        professionalAcceptability: evaluation.semanticSectionEvaluation?.professionalAcceptability ?? null,
        goldContentCoverage: evaluation.goldSectionEvaluation?.contentCoverage ?? null,
        outputLengthBalance: evaluation.goldSectionEvaluation?.lengthBalance ?? null,
        evaluationPoints: evaluation.dimensions ?? [],
        hardFailure: Boolean(evaluation.truthGraphEvaluation?.protectedFactMismatchCount > 0
          || evaluation.truthGraphEvaluation?.unsupportedClaimCount > 0
          || (evaluation.goldSectionEvaluation?.contentCoverage != null && evaluation.goldSectionEvaluation.contentCoverage < 0.55)
          || (evaluation.goldSectionEvaluation?.lengthRatio != null && (evaluation.goldSectionEvaluation.lengthRatio < 0.5 || evaluation.goldSectionEvaluation.lengthRatio > 1.5))
          || evaluation.semanticSectionEvaluation?.verdict === "unacceptable"
          || evaluation.sectionFormatEvaluation?.pass === false),
        hardFailureReasons: [
          ...(evaluation.truthGraphEvaluation?.protectedFactMismatchCount > 0 ? ["Protected fact mismatch"] : []),
          ...(evaluation.truthGraphEvaluation?.unsupportedClaimCount > 0 ? ["Invented verifiable fact"] : []),
          ...(evaluation.goldSectionEvaluation?.contentCoverage != null && evaluation.goldSectionEvaluation.contentCoverage < 0.55 ? ["Gold content coverage below 55%"] : []),
          ...(evaluation.goldSectionEvaluation?.lengthRatio != null && (evaluation.goldSectionEvaluation.lengthRatio < 0.5 || evaluation.goldSectionEvaluation.lengthRatio > 1.5) ? ["Generated/original length ratio outside 0.5–1.5"] : []),
          ...(evaluation.semanticSectionEvaluation?.verdict === "unacceptable" ? ["Automated gold reviewer found the section unacceptable"] : []),
          ...(evaluation.sectionFormatEvaluation?.pass === false ? ["PDF-ready section format contract failed"] : []),
        ],
        automatedReview: evaluation.semanticSectionEvaluation?.available === true ? {
          verdict: evaluation.semanticSectionEvaluation.verdict ?? "needs_review",
          assessment: evaluation.semanticSectionEvaluation.assessment ?? "",
          reasons: [...(evaluation.semanticSectionEvaluation.unacceptableReasons ?? []), ...(evaluation.semanticSectionEvaluation.missingConcepts ?? [])],
        } : null,
      },
      promotionGate: await getHeldOutPromotionGateForCase(latestCase),
      createdAtIso: row.created_at_iso,
    };
  }

  async function getHeldOutPromotionGate(policyVersionId) {
    const row = await db.prepare(
      `SELECT e.evaluation_case_id
      FROM report_eval_runs e
      JOIN report_evaluation_cases c USING (evaluation_case_id)
      JOIN system_rl_policy_rewards r ON r.eval_run_id = e.eval_run_id
      JOIN system_rl_policy_decisions d ON d.decision_id = r.decision_id
      WHERE c.dataset_split = 'hidden_test' AND d.policy_version_id = ?
      ORDER BY e.created_at_iso DESC LIMIT 1`,
    ).get(policyVersionId);
    if (!row) return { eligible: false, reasons: ["Run a complete matching-family hidden test first."], sectionCount: 0, passedSectionCount: 0 };
    return getHeldOutPromotionGateForCase(row.evaluation_case_id, policyVersionId);
  }

  async function getHeldOutPromotionGateForCase(evaluationCaseId, policyVersionId = null) {
    const enabledRows = await db.prepare(
      `SELECT section_id FROM report_evaluation_case_sections
      WHERE evaluation_case_id = ? AND evaluation_enabled = TRUE`,
    ).all(evaluationCaseId);
    const params = policyVersionId ? [evaluationCaseId, policyVersionId] : [evaluationCaseId];
    const policyJoin = policyVersionId ? "AND d.policy_version_id = ?" : "";
    const rows = await db.prepare(
      `SELECT DISTINCT ON (e.section_id) e.section_id, e.outcome_code, e.eval_json,
        r.hard_failure, r.hard_failure_reasons_json
      FROM report_eval_runs e
      JOIN system_rl_policy_rewards r ON r.eval_run_id = e.eval_run_id
      JOIN system_rl_policy_decisions d ON d.decision_id = r.decision_id
      WHERE e.evaluation_case_id = ? ${policyJoin}
      ORDER BY e.section_id, e.created_at_iso DESC`,
    ).all(...params);
    const latestBySection = new Map(rows.map((row) => [row.section_id, row]));
    const reasons = [];
    let passedSectionCount = 0;
    for (const enabled of enabledRows) {
      const row = latestBySection.get(enabled.section_id);
      if (!row) {
        reasons.push(`${enabled.section_id}: evaluation is incomplete.`);
        continue;
      }
      const evaluation = parseJsonValue(row.eval_json ?? {});
      const truth = evaluation.truthGraphEvaluation ?? {};
      const requiredRecall = Number(truth.requiredFactRecall ?? 0);
      const claimPrecision = Number(truth.claimPrecision ?? 0);
      const protectedAccuracy = Number(truth.protectedFactAccuracy ?? 0);
      const sectionReasons = [];
      if (row.hard_failure === true) sectionReasons.push(...parseJsonValue(row.hard_failure_reasons_json ?? []));
      if (Number(truth.requiredFactCount ?? 0) === 0) sectionReasons.push("no required golden facts are available");
      else if (requiredRecall < 0.8) sectionReasons.push(`fact recovery ${Math.round(requiredRecall * 100)}% is below 80%`);
      if (claimPrecision < 0.95) sectionReasons.push(`claim precision ${Math.round(claimPrecision * 100)}% is below 95%`);
      if (protectedAccuracy < 1) sectionReasons.push("protected facts are not exact");
      if (row.outcome_code !== "pass") sectionReasons.push(`outcome is ${row.outcome_code}`);
      if (sectionReasons.length > 0) reasons.push(`${enabled.section_id}: ${[...new Set(sectionReasons)].join(", ")}.`);
      else passedSectionCount += 1;
    }
    return {
      eligible: enabledRows.length > 0 && reasons.length === 0,
      reasons,
      sectionCount: enabledRows.length,
      passedSectionCount,
      thresholds: { requiredFactRecall: 0.8, claimPrecision: 0.95, protectedFactAccuracy: 1 },
    };
  }

  async function rollbackSystemRlPolicy({ actorUserId, policyVersionId, reason }) {
    const actor = await ensureActorUserExists(actorUserId);
    const result = await systemRl.rollbackPolicy({
      actorUserId: actor,
      policyVersionId,
      reason,
    });
    if (!result.ok) {
      throw new ApiError(404, result.reasons.join(" "), result.code);
    }
    return result;
  }

  async function selectSystemRlDecision({ mode, reportState, sectionId, frozenCandidate = false }) {
    const template = getSectionTemplate(sectionId);
    const decision = await systemRl.selectConfiguration({
      reportState,
      sectionId,
      sectionKind: template.kind,
      requiredManualFields: template.requiredManualFields,
      mode,
      frozenCandidate,
    });
    return attachSystemRlDecisionScope(decision, reportState);
  }

  function attachSystemRlDecisionScope(decision, reportState) {
    return {
      ...decision,
      tenantId: reportState.reportJob.tenantId,
      workspaceId: reportState.reportJob.workspaceId,
    };
  }

  async function persistStandaloneGenerationRun({
    actorUserId,
    generation,
    reportJobId,
    sectionId,
  }) {
    await db.prepare(
      `INSERT INTO report_generation_runs (
        run_id, report_job_id, section_id, actor_user_id, template_key,
        status_code, retrieval_json, calculation_json, map_artifacts_json,
        warnings_json, blockers_json, provider_code, model_id, used_live_model,
        fallback_reason, assistant_summary, orchestration_json, generated_content,
        created_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      generation.generationRun.runId,
      reportJobId,
      sectionId,
      actorUserId,
      generation.generationRun.templateKey,
      generation.generationRun.statusCode,
      JSON.stringify(generation.generationRun.retrievalKeys),
      JSON.stringify(generation.generationRun.calculationKeys),
      JSON.stringify(generation.generationRun.mapArtifactKeys),
      JSON.stringify(generation.generationRun.warnings),
      JSON.stringify(generation.generationRun.blockers),
      generation.generationRun.providerCode ?? null,
      generation.generationRun.modelId ?? null,
      generation.generationRun.usedLiveModel == null ? null : boolToInt(generation.generationRun.usedLiveModel),
      generation.generationRun.fallbackReason ?? null,
      generation.generationRun.assistantSummary ?? null,
      JSON.stringify(generation.orchestration),
      generation.draft.content,
      generation.generationRun.generatedAtIso,
    );
  }

  async function persistEvalRun({ evalRun, reportJobId, sectionId, evaluationCaseId = null }) {
    await db.prepare(
      `INSERT INTO report_eval_runs (
        eval_run_id, run_id, report_job_id, section_id, evaluator_key,
        score, outcome_code, summary, eval_json, created_at_iso, evaluation_case_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      evalRun.evalRunId,
      evalRun.generationRunId,
      reportJobId,
      sectionId,
      evalRun.evaluatorKey,
      evalRun.score,
      evalRun.outcomeCode,
      evalRun.summary,
      JSON.stringify(evalRun),
      evalRun.createdAtIso,
      evaluationCaseId,
    );
  }

  async function loadEvalRuns(reportJobId) {
    await ensureReportJobExists(reportJobId);
    const rows = await db
      .prepare(
        `SELECT eval_json
        FROM report_eval_runs
        WHERE report_job_id = ?
        ORDER BY created_at_iso DESC`,
      )
      .all(reportJobId);
    return rows.map((row) => parseJsonValue(row.eval_json));
  }

  async function loadLatestEvalRun(reportJobId, sectionId) {
    await ensureReportJobExists(reportJobId);
    ensureKnownSection(sectionId);
    const row = await db
      .prepare(
        `SELECT eval_json
        FROM report_eval_runs
        WHERE report_job_id = ? AND section_id = ?
        ORDER BY created_at_iso DESC
        LIMIT 1`,
      )
      .get(reportJobId, sectionId);

    return row?.eval_json ? parseJsonValue(row.eval_json) : null;
  }

  async function replyToSectionChat(reportJobId, sectionId, { userPrompt, conversationHistory = [] }) {
    await ensureReportJobExists(reportJobId);
    ensureKnownSection(sectionId);
    const reportState = await loadReportJobState(reportJobId);
    if (!reportState) {
      throw new ApiError(404, "Report job was not found.", "report_job_not_found");
    }

    return generateSectionAssistantReply({
      reportState,
      sectionId,
      userPrompt: String(userPrompt ?? ""),
      conversationHistory,
    });
  }

  async function previewTargetedSectionEdit(reportJobId, sectionId, request) {
    await ensureReportJobExists(reportJobId);
    ensureKnownSection(sectionId);
    const reportState = await loadReportJobState(reportJobId);
    if (!reportState) {
      throw new ApiError(404, "Report job was not found.", "report_job_not_found");
    }

    try {
      return await generateTargetedSectionEdit({
        reportState,
        sectionId,
        request,
      });
    } catch (error) {
      const code = String(error?.code ?? "");
      if (code === "targeted_edit_version_conflict" || code === "targeted_edit_document_conflict") {
        throw new ApiError(409, error.message, code);
      }
      if (code === "targeted_edit_ai_unavailable" || !code) {
        throw new ApiError(
          503,
          code ? error.message : "LAIQ AI Engine could not prepare the targeted edit.",
          code || "targeted_edit_worker_failed",
        );
      }
      throw new ApiError(422, error.message, code);
    }
  }

  async function approveSection(
    reportJobId,
    sectionId,
    { actorUserId, expectedVersion, note = "" } = {},
  ) {
    await ensureReportJobExists(reportJobId);
    ensureKnownSection(sectionId);
    const nowIso = new Date().toISOString();
    const fallbackActor = actorUserId || await getReportJobActorUserId(reportJobId);
    const actor = await ensureActorUserExists(fallbackActor);
    const existingSectionDraft = await db
      .prepare(
        `SELECT content, generated, edited, version
        FROM report_section_drafts
        WHERE report_job_id = ? AND section_id = ?`,
      )
      .get(reportJobId, sectionId);
    const currentVersion = Number(existingSectionDraft?.version ?? 0);
    const requestedVersion = Number(expectedVersion);
    if (!Number.isInteger(requestedVersion) || requestedVersion < 0) {
      throw new ApiError(
        400,
        "The current section version is required before approval.",
        "section_version_required",
      );
    }
    if (requestedVersion !== currentVersion) {
      throw new ApiError(
        409,
        "This section changed in another session. Reload the latest section before approving it.",
        "section_version_conflict",
      );
    }
    await ensureFloorCorrosionReadyForApproval(reportJobId, sectionId);
    await ensureSectionReadyForApproval(reportJobId, sectionId, existingSectionDraft);

    await inTransaction(async () => {
      const approvalUpdate = await db.prepare(
        `UPDATE report_section_drafts
        SET approved = 1,
          review_required = 0,
          edited = ?,
          version = version + 1,
          updated_at_iso = ?
        WHERE report_job_id = ? AND section_id = ? AND version = ?`,
      ).run(
        boolToInt(existingSectionDraft?.edited ?? true),
        nowIso,
        reportJobId,
        sectionId,
        requestedVersion,
      );
      if (approvalUpdate.rowCount === 0) {
        throw new ApiError(
          409,
          "This section changed in another session. Reload the latest section before approving it.",
          "section_version_conflict",
        );
      }

      await db.prepare(
        `INSERT INTO report_review_decisions (
          report_job_id,
          section_id,
          decision_code,
          actor_user_id,
          note,
          created_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(reportJobId, sectionId, "approved", actor, note, nowIso);

      await db.prepare("UPDATE report_jobs SET status_code = ?, updated_at_iso = ? WHERE report_job_id = ?").run(
        "section_approved",
        nowIso,
        reportJobId,
      );
    });

    return loadReportJobState(reportJobId);
  }

  async function ensureSectionReadyForApproval(reportJobId, sectionId, sectionDraft) {
    if (!sectionDraft || !hasVisibleReportContent(sectionDraft.content)) {
      throw new ApiError(
        409,
        "This section is empty. Generate or enter report content before approving it.",
        "section_content_empty",
      );
    }

    const template = getSectionTemplate(sectionId);
    const requiredFields = template.requiredManualFields ?? [];
    if (requiredFields.length === 0) return;

    const manualInputs = new Map(
      (await db.prepare(
        `SELECT field_key, field_value
        FROM report_manual_inputs
        WHERE report_job_id = ?`,
      )
        .all(reportJobId))
        .map((row) => [row.field_key, String(row.field_value ?? "").trim()]),
    );
    const missingFields = requiredFields.filter((fieldKey) => !manualInputs.get(fieldKey));
    if (missingFields.length === 0) return;

    const labels = missingFields.map((fieldKey) => manualFieldLabel(sectionId, template.title, fieldKey));
    throw new ApiError(
      409,
      `Complete the following information before approving this section: ${labels.join(", ")}.`,
      "section_required_inputs_missing",
    );
  }

  async function getHealth() {
    const [reportJobs, imports, tenants, sourceStorage] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS count FROM report_jobs").get(),
      db.prepare("SELECT COUNT(*) AS count FROM report_imports").get(),
      db.prepare("SELECT COUNT(*) AS count FROM tenants").get(),
      db.prepare(
        `SELECT
          COUNT(*) FILTER (WHERE source_storage_status = 'stored') AS stored_count,
          COUNT(*) FILTER (WHERE source_storage_status = 'legacy') AS legacy_count
        FROM report_imports`,
      ).get(),
    ]);
    return {
      databaseDriver: "postgresql",
      reportJobCount: reportJobs.count,
      importCount: imports.count,
      tenantCount: tenants.count,
      sourcePackages: {
        storedCount: Number(sourceStorage.stored_count ?? 0),
        legacyCount: Number(sourceStorage.legacy_count ?? 0),
      },
      pool: db.getPoolStats(),
    };
  }

  async function ensureReportJobExists(reportJobId) {
    const row = await db.prepare("SELECT report_job_id FROM report_jobs WHERE report_job_id = ?").get(reportJobId);
    if (!row?.report_job_id) {
      throw new ApiError(404, "Report job was not found.", "report_job_not_found");
    }
  }

  function ensureKnownSection(sectionId) {
    const known = API_STANDARD_REPORT_TOC.some((section) => section.id === sectionId);
    if (!known) {
      throw new ApiError(404, "Report section was not found.", "report_section_not_found");
    }
  }

  async function ensureFloorCorrosionReadyForApproval(reportJobId, sectionId) {
    if (sectionId !== "floor-plate-corrosion-plan") return;
    const row = await db
      .prepare(
        `SELECT layout_json
        FROM report_layout_overrides
        WHERE report_job_id = ? AND section_id = ?`,
      )
      .get(reportJobId, sectionId);
    if (!row?.layout_json) {
      throw new ApiError(
        409,
        "Import the individual MFL plate maps before approving the floor corrosion plan.",
        "floor_corrosion_source_required",
      );
    }

    let layoutMap;
    try {
      layoutMap = parseJsonValue(row.layout_json);
    } catch {
      throw new ApiError(500, "Stored layout map is invalid.", "layout_map_invalid");
    }

    const floorCorrosion = layoutMap?.floorCorrosion;
    if (!floorCorrosion || (floorCorrosion.overlays ?? []).length === 0) {
      throw new ApiError(
        409,
        "No matched MFL plate scans are available for the floor corrosion plan.",
        "floor_corrosion_source_required",
      );
    }
    const errorCount = (floorCorrosion.validationIssues ?? []).filter(
      (issue) => issue.severity === "error",
    ).length;
    const reviewRequiredCount = (floorCorrosion.overlays ?? []).filter(
      (overlay) => overlay.status !== "approved",
    ).length;
    if (errorCount > 0 || reviewRequiredCount > 0) {
      throw new ApiError(
        409,
        `Floor corrosion map requires review before approval: ${errorCount} matching error(s), ${reviewRequiredCount} placement(s) awaiting approval.`,
        "floor_corrosion_review_required",
        );
      }
    }

  async function ensureActorUserExists(actorUserId) {
    if (!actorUserId || typeof actorUserId !== "string") {
      throw new ApiError(400, "actorUserId is required.", "actor_user_required");
    }

    const row = await db.prepare("SELECT user_id FROM platform_users WHERE user_id = ?").get(actorUserId);
    if (!row?.user_id) {
      throw new ApiError(400, "actorUserId does not match a known platform user.", "actor_user_not_found");
    }

    return actorUserId;
  }

  async function ensureUserWorkspaceMembership(userId, tenantId, workspaceId) {
    const principal = await getUserPrincipal(userId);
    const hasWorkspace = principal?.tenantId === tenantId && principal.workspaceMemberships.some(
      (membership) => membership.workspaceId === workspaceId,
    );
    if (!hasWorkspace) {
      throw new ApiError(
        403,
        "Authenticated user is not assigned to the import tenant and workspace.",
        "import_scope_denied",
      );
    }
    return principal;
  }

  async function resolvePersistedExportedByUserId(exportPackage, actorUserId) {
    const exportedBy = await getUserPrincipal(exportPackage.exportedByUserId);
    const hasMatchingScope = exportedBy?.tenantId === exportPackage.tenantId && exportedBy.workspaceMemberships.some(
      (membership) => membership.workspaceId === exportPackage.workspaceId,
    );
    if (hasMatchingScope) {
      return exportedBy.userId;
    }
    return ensureActorUserExists(actorUserId);
  }

  async function getReportJobActorUserId(reportJobId) {
    const row = await db
      .prepare("SELECT created_by_user_id FROM report_jobs WHERE report_job_id = ?")
      .get(reportJobId);
    return row?.created_by_user_id ?? "unknown-user";
  }

  async function touchReportJob(reportJobId, nowIso) {
    await db.prepare("UPDATE report_jobs SET updated_at_iso = ? WHERE report_job_id = ?").run(nowIso, reportJobId);
  }

  async function upsertIdentityRecords(exportPackage, nowIso) {
    await db.prepare(
      `INSERT INTO tenants (tenant_id, tenant_name, created_at_iso, updated_at_iso)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(tenant_id) DO UPDATE SET
        tenant_name = excluded.tenant_name,
        updated_at_iso = excluded.updated_at_iso`,
    ).run(exportPackage.tenantId, exportPackage.profile.tenantName, nowIso, nowIso);

    await db.prepare(
      `INSERT INTO workspaces (workspace_id, tenant_id, workspace_name, created_at_iso, updated_at_iso)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id) DO UPDATE SET
        tenant_id = excluded.tenant_id,
        workspace_name = excluded.workspace_name,
        updated_at_iso = excluded.updated_at_iso`,
    ).run(
      exportPackage.workspaceId,
      exportPackage.tenantId,
      exportPackage.profile.workspaceName,
      nowIso,
      nowIso,
    );

    await db.prepare(
      `INSERT INTO platform_users (
        user_id,
        tenant_id,
        workspace_id,
        display_name,
        role_label,
        device_id,
        created_at_iso,
        updated_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        tenant_id = excluded.tenant_id,
        workspace_id = excluded.workspace_id,
        display_name = excluded.display_name,
        role_label = excluded.role_label,
        device_id = excluded.device_id,
        updated_at_iso = excluded.updated_at_iso`,
    ).run(
      exportPackage.profile.userId,
      exportPackage.tenantId,
      exportPackage.workspaceId,
      exportPackage.profile.displayName,
      exportPackage.profile.roleLabel,
      exportPackage.profile.deviceId,
      nowIso,
      nowIso,
    );

    await db.prepare(
      `INSERT INTO workspace_role_memberships (
        workspace_id,
        user_id,
        role_label,
        created_at_iso,
        updated_at_iso
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id, user_id, role_label) DO UPDATE SET
        updated_at_iso = excluded.updated_at_iso`,
    ).run(
      exportPackage.workspaceId,
      exportPackage.profile.userId,
      exportPackage.profile.roleLabel,
      nowIso,
      nowIso,
    );
  }

  async function upsertControlledDevelopmentUser({
    userId,
    tenantId,
    workspaceId,
    displayName,
    roleLabel,
    nowIso,
  }) {
    await db.prepare(
      `INSERT INTO platform_users (
        user_id,
        tenant_id,
        workspace_id,
        display_name,
        role_label,
        identity_provider,
        external_subject,
        account_status,
        created_at_iso,
        updated_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        tenant_id = excluded.tenant_id,
        workspace_id = excluded.workspace_id,
        display_name = excluded.display_name,
        role_label = excluded.role_label,
        account_status = excluded.account_status,
        updated_at_iso = excluded.updated_at_iso`,
    ).run(
      userId,
      tenantId,
      workspaceId,
      displayName,
      roleLabel,
      "development",
      userId,
      "active",
      nowIso,
      nowIso,
    );
    await db.prepare(
      `INSERT INTO workspace_role_memberships (
        workspace_id,
        user_id,
        role_label,
        created_at_iso,
        updated_at_iso
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id, user_id, role_label) DO UPDATE SET
        updated_at_iso = excluded.updated_at_iso`,
    ).run(workspaceId, userId, roleLabel, nowIso, nowIso);
  }

  async function upsertDefaultManualInputs(reportJobId, defaultValues, nowIso) {
    for (const [fieldKey, fieldValue] of Object.entries(defaultValues)) {
      await db.prepare(
        `INSERT INTO report_manual_inputs (report_job_id, field_key, field_value, updated_at_iso)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(report_job_id, field_key) DO NOTHING`,
      ).run(reportJobId, fieldKey, String(fieldValue ?? ""), nowIso);
    }
  }

  async function upsertInternalManualInput(reportJobId, fieldKey, fieldValue, nowIso) {
    await db.prepare(
      `INSERT INTO report_manual_inputs (report_job_id, field_key, field_value, updated_at_iso)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(report_job_id, field_key) DO UPDATE SET
        field_value = excluded.field_value,
      updated_at_iso = excluded.updated_at_iso`,
    ).run(reportJobId, fieldKey, String(fieldValue ?? ""), nowIso);
  }

  async function snapshotExistingSectionDraft(reportJobId, sectionId, nextContent, nowIso, reasonCode) {
    const currentDraft = await db
      .prepare(
        `SELECT content, generated, edited, approved, review_required, updated_at_iso
        FROM report_section_drafts
        WHERE report_job_id = ? AND section_id = ?`,
      )
      .get(reportJobId, sectionId);

    if (!currentDraft || currentDraft.content === nextContent) {
      return;
    }

    await db.prepare(
      `INSERT INTO report_section_draft_versions (
        version_id,
        report_job_id,
        section_id,
        content,
        generated,
        edited,
        approved,
        review_required,
        source_updated_at_iso,
        reason_code,
        created_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      randomUUID(),
      reportJobId,
      sectionId,
      currentDraft.content,
      currentDraft.generated,
      currentDraft.edited,
      currentDraft.approved,
      currentDraft.review_required,
      currentDraft.updated_at_iso,
      reasonCode,
      nowIso,
    );
  }

  function inTransaction(operation) {
    return db.transaction(operation);
  }
}

function mapObjectUploadSession(row, objectRows) {
  return {
    uploadSessionId: row.upload_session_id,
    tenantId: row.tenant_id,
    workspaceId: row.workspace_id,
    inspectionId: row.inspection_id,
    actorUserId: row.actor_user_id,
    idempotencyKey: row.idempotency_key,
    packageSha256: row.package_sha256,
    exportPackage: parseJsonValue(row.export_package_json),
    sourceExportPackage: parseJsonValue(row.source_export_package_json),
    statusCode: row.status_code,
    expiresAtIso: row.expires_at_iso,
    finalizedImportId: row.finalized_import_id,
    finalizedReportJobId: row.finalized_report_job_id,
    createdAtIso: row.created_at_iso,
    updatedAtIso: row.updated_at_iso,
    finalizedAtIso: row.finalized_at_iso,
    objects: objectRows.map(mapObjectUpload),
  };
}

function mapObjectUpload(row) {
  return {
    objectId: row.object_id,
    uploadSessionId: row.upload_session_id,
    attachmentId: row.attachment_id,
    relativePath: row.relative_path,
    attachmentKind: row.attachment_kind,
    mediaType: row.media_type,
    expectedByteSize: Number(row.expected_byte_size),
    expectedSha256: row.expected_sha256,
    objectKey: row.object_key,
    statusCode: row.status_code,
    verifiedByteSize: row.verified_byte_size == null ? null : Number(row.verified_byte_size),
    verifiedSha256: row.verified_sha256,
    verifiedAtIso: row.verified_at_iso,
    createdAtIso: row.created_at_iso,
    updatedAtIso: row.updated_at_iso,
  };
}

function mapReportArtifactObject(row) {
  return {
    artifactObjectId: row.artifact_object_id,
    reportJobId: row.report_job_id,
    tenantId: row.tenant_id,
    workspaceId: row.workspace_id,
    artifactRunId: row.artifact_run_id,
    artifactKind: row.artifact_kind,
    relativePath: row.relative_path,
    objectKey: row.object_key,
    mediaType: row.media_type,
    byteSize: Number(row.byte_size),
    sha256: row.sha256,
    originalFileName: row.original_file_name,
    createdByUserId: row.created_by_user_id,
    createdAtIso: row.created_at_iso,
  };
}

function buildDefaultManualSupplement(exportPackage, overrides = {}) {
  return {
    reportReference: overrides.reportReference ?? exportPackage.inspectionReference,
    inspectedDate: overrides.inspectedDate ?? formatExportedDate(exportPackage.exportedAtIso),
    coverHeroImage: overrides.coverHeroImage ?? "",
    clientRepresentative: overrides.clientRepresentative ?? "",
    yearBuilt: overrides.yearBuilt ?? "",
    engineeringImplication: overrides.engineeringImplication ?? "",
    recommendationOwner: overrides.recommendationOwner ?? "",
    checkedBy: overrides.checkedBy ?? "",
    legendNote: overrides.legendNote ?? "",
    certificationNumber: overrides.certificationNumber ?? "",
  };
}

function buildPackageFingerprint(exportPackage) {
  return createHash("sha256")
    .update(stableStringify(removeVolatileExportMetadata(exportPackage)))
    .digest("hex");
}

const VOLATILE_EXPORT_METADATA_KEYS = new Set([
  "boundAtIso",
  "exportedAtIso",
  "updatedAtIso",
]);

function removeVolatileExportMetadata(value) {
  if (Array.isArray(value)) {
    return value.map(removeVolatileExportMetadata);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !VOLATILE_EXPORT_METADATA_KEYS.has(key))
      .map(([key, nestedValue]) => [key, removeVolatileExportMetadata(nestedValue)]),
  );
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function validateAndroidV3ProductExport(exportPackage) {
  const issues = [];

  if (!exportPackage || typeof exportPackage !== "object") {
    return ["Request body did not contain an export package object."];
  }

  if (exportPackage.packageType !== "v3_product_export") {
    issues.push(`packageType must be "v3_product_export", received "${exportPackage.packageType}".`);
  }

  if (exportPackage.schemaVersion !== 3) {
    issues.push(`schemaVersion must be 3, received ${exportPackage.schemaVersion}.`);
  }

  if (!Array.isArray(exportPackage.voiceNotes)) {
    issues.push("voiceNotes[] is required for report context routing.");
  }

  if (!exportPackage.inspectionId) {
    issues.push("inspectionId is required.");
  }

  if (!exportPackage.inspectionReference) {
    issues.push("inspectionReference is required.");
  }

  if (!exportPackage.profile?.tenantId || exportPackage.profile.tenantId !== exportPackage.tenantId) {
    issues.push("profile.tenantId must match tenantId.");
  }

  if (!exportPackage.profile?.workspaceId || exportPackage.profile.workspaceId !== exportPackage.workspaceId) {
    issues.push("profile.workspaceId must match workspaceId.");
  }

  if (!Array.isArray(exportPackage.validationResults) || exportPackage.validationResults.length === 0) {
    issues.push("validationResults cannot be empty.");
  }

  if (!Array.isArray(exportPackage.taskSnapshots) || exportPackage.taskSnapshots.length === 0) {
    issues.push("taskSnapshots cannot be empty.");
  }

  const floorTarget = exportPackage.layoutTargets?.find((target) => target.targetKey === "floor");
  const floorConfig = exportPackage.layoutConfigs?.find((config) => config.targetKey === "floor");
  if (floorTarget?.inLayoutScope || floorConfig) {
    const layout = floorConfig?.customCircularLayout;
    const mainGeometry = Array.isArray(layout?.resolvedMainPlateGeometry)
      ? layout.resolvedMainPlateGeometry
      : [];
    const annularGeometry = Array.isArray(layout?.resolvedAnnularPlateGeometry)
      ? layout.resolvedAnnularPlateGeometry
      : [];

    if (layout?.resolvedGeometryVersion !== 2 || mainGeometry.length === 0) {
      issues.push("The V3 floor layout must include resolvedGeometryVersion 2 and resolvedMainPlateGeometry from the LAIQ inspection app.");
    }

    const expectedAnnularCount = floorConfig?.floorTemplate === "circular_plate_ar"
      ? floorConfig.floorAnnularSectionCount ?? 0
      : 0;
    if (annularGeometry.length !== expectedAnnularCount) {
      issues.push(
        `The V3 floor layout must include ${expectedAnnularCount} app-resolved annular polygons; received ${annularGeometry.length}.`,
      );
    }

    if (floorConfig?.floorPlateCount && mainGeometry.length !== floorConfig.floorPlateCount) {
      issues.push(
        `The V3 floor layout resolved ${mainGeometry.length} main plates but floorPlateCount is ${floorConfig.floorPlateCount}.`,
      );
    }

    const floorFigure = exportPackage.layoutFigures?.find((figure) => figure.targetKey === "floor");
    if (!floorFigure) {
      issues.push("The V3 floor layout must include the app-owned floor SVG in layoutFigures[].");
    } else {
      issues.push(...validateAppOwnedFloorFigure(floorFigure));
    }
  }

  for (const element of exportPackage.elements ?? []) {
    if (
      !Number.isFinite(element.normalizedX) ||
      !Number.isFinite(element.normalizedY) ||
      element.normalizedX < 0 ||
      element.normalizedX > 1 ||
      element.normalizedY < 0 ||
      element.normalizedY > 1
    ) {
      issues.push(`Element ${element.elementId} has invalid normalized app-map coordinates.`);
    }
  }

  return issues;
}

function validateAppOwnedFloorFigure(figure) {
  const issues = [];
  if (figure?.mediaType !== "image/svg+xml") {
    issues.push("The app-owned floor figure mediaType must be image/svg+xml.");
  }
  if (figure?.renderVersion !== 1 || figure?.sourceGeometryVersion !== 2) {
    issues.push("The app-owned floor figure must use renderVersion 1 and sourceGeometryVersion 2.");
  }
  if (figure?.width !== 1000 || figure?.height !== 1000 || figure?.viewBox !== "0 0 1000 1000") {
    issues.push("The app-owned floor figure must use the normalized 1000 x 1000 app viewport.");
  }
  if (!/^[a-f0-9]{64}$/i.test(figure?.sha256 ?? "")) {
    issues.push("The app-owned floor figure requires a SHA-256 digest.");
  }
  if (!isSafeAppOwnedSvg(figure?.svg)) {
    issues.push("The app-owned floor figure contains unsupported or unsafe SVG content.");
  } else {
    const actualSha256 = createHash("sha256").update(figure.svg, "utf8").digest("hex");
    if (actualSha256 !== figure.sha256.toLowerCase()) {
      issues.push("The app-owned floor figure SHA-256 digest does not match its SVG bytes.");
    }
  }
  return issues;
}

function isSafeAppOwnedSvg(svg) {
  if (typeof svg !== "string" || svg.length === 0 || svg.length > 500_000 || !/^<svg\b/i.test(svg)) return false;
  const withoutInternalUrls = svg.replace(/url\(#[A-Za-z0-9_.:-]+\)/g, "");
  return !/<(?:script|foreignObject|image|use|a)\b/i.test(svg)
    && !/\bon[a-z]+\s*=/i.test(svg)
    && !/\b(?:href|xlink:href)\s*=/i.test(svg)
    && !/<!DOCTYPE|<!ENTITY/i.test(svg)
    && !/javascript:|data:/i.test(svg)
    && !/url\s*\(/i.test(withoutInternalUrls)
    && !/https?:\/\/(?!www\.w3\.org\/2000\/svg)/i.test(svg);
}

function normalizePersistedLayoutMap(layoutMap) {
  if (!layoutMap || typeof layoutMap !== "object" || Array.isArray(layoutMap)) {
    return layoutMap;
  }

  const normalizeSource = (item) => ({
    ...item,
    source: typeof item?.source === "string" && item.source.trim() !== ""
      ? item.source
      : "report-platform:legacy-layout-override",
  });

  return {
    ...layoutMap,
    markers: Array.isArray(layoutMap.markers) ? layoutMap.markers.map(normalizeSource) : [],
    plates: Array.isArray(layoutMap.plates) ? layoutMap.plates.map(normalizeSource) : [],
  };
}

function formatExportedDate(exportedAtIso) {
  const date = new Date(exportedAtIso);
  if (Number.isNaN(date.getTime())) {
    return exportedAtIso;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function hasVisibleReportContent(content) {
  const value = String(content ?? "");
  if (/<(?:img|svg)\b/i.test(value)) return true;
  return value
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .length > 0;
}

function manualFieldLabel(sectionId, sectionTitle, fieldKey) {
  if (MANUAL_FIELD_LABELS[fieldKey]) return MANUAL_FIELD_LABELS[fieldKey];
  if (fieldKey === `${sectionId}-content-source`) return `${sectionTitle} Source Data`;
  if (fieldKey === `${sectionId}-layout-source`) return `${sectionTitle} Source`;
  return String(fieldKey)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function boolToInt(value) {
  return value ? 1 : 0;
}

function applyTruthGraphOutcome(evalRun) {
  const truth = evalRun.truthGraphEvaluation ?? {};
  const gold = evalRun.goldSectionEvaluation ?? {};
  const hardFailure = Number(truth.protectedFactMismatchCount ?? 0) > 0
    || Number(truth.unsupportedClaimCount ?? 0) > 0;
  const semanticConceptRecall=evalRun.semanticSectionEvaluation?.available===true?Number(evalRun.semanticSectionEvaluation.materialConceptRecall??0):0;
  const effectiveRequiredRecall=String(gold.evaluationMode??"direct_recovery")==="evidence_conditioned_semantic"
    ? Math.max(Number(truth.requiredFactRecall??0),semanticConceptRecall)
    : Number(truth.requiredFactRecall??0);
  const inadequateRecovery = Number(truth.requiredFactCount ?? 0) > 0
    && effectiveRequiredRecall < (String(gold.evaluationMode??"direct_recovery")==="evidence_conditioned_semantic"?0.7:0.8);
  const minimumContentCoverage=Number(gold.minimumContentCoverage??0.55);
  const directRecovery=String(gold.evaluationMode??"direct_recovery")==="direct_recovery";
  const semantic=evalRun.semanticSectionEvaluation??{};
  const format=evalRun.sectionFormatEvaluation??{};
  if (!directRecovery && semantic.available !== true) {
    evalRun.outcomeCode="needs_review";
    evalRun.summary="Semantic evaluation was unavailable; deterministic factual checks passed, but semantic acceptance was not inferred.";
    return;
  }
  const inadequateContentCoverage = directRecovery && gold.contentCoverage != null && Number(gold.contentCoverage) < minimumContentCoverage;
  const invalidLengthRatio = directRecovery && gold.lengthRatio != null && (Number(gold.lengthRatio) < 0.5 || Number(gold.lengthRatio) > 1.5);
  const semanticScore=semantic.available===true?Number(semantic.semanticSimilarity??0):null;
  const inadequateSemanticRecovery=!directRecovery&&semanticScore!=null&&(semanticScore<0.45||semantic.verdict==="unacceptable");
  const inadequateFormat=format.pass===false;
  if (!hardFailure && !inadequateRecovery && !inadequateContentCoverage && !invalidLengthRatio && !inadequateSemanticRecovery && !inadequateFormat) {
    if(!directRecovery&&semanticScore!=null){
      evalRun.score=Math.max(0,Math.min(1,0.5*semanticScore+0.3*effectiveRequiredRecall+0.2*Number(truth.claimPrecision??1)));
      evalRun.grade=evalRun.score>=0.8?"A":evalRun.score>=0.7?"B":evalRun.score>=0.6?"C":"D";
      evalRun.outcomeCode=semanticScore>=0.7&&semantic.verdict==="acceptable"?"pass":"needs_review";
      evalRun.summary=`Semantic section similarity ${Math.round(semanticScore*100)}%; protected and unsupported-claim checks passed.`;
    }
    return;
  }
  const recoveryScore = effectiveRequiredRecall;
  const contentScore = gold.contentCoverage == null ? 1 : Number(gold.contentCoverage);
  const lengthScore = gold.lengthBalance == null ? 1 : Number(gold.lengthBalance);
  evalRun.score = hardFailure ? 0 : inadequateSemanticRecovery ? semanticScore : Math.min(Number(evalRun.score ?? 0), recoveryScore, contentScore, lengthScore, Number(format.score??1));
  evalRun.grade = "F";
  evalRun.outcomeCode = hardFailure ? "fail_truth_contract" : inadequateSemanticRecovery ? "fail_semantic_recovery" : inadequateFormat ? "fail_format_contract" : "fail_truth_recovery";
  const reasons = [
    ...(Number(truth.protectedFactMismatchCount ?? 0) > 0 ? ["protected facts did not match"] : []),
    ...(Number(truth.unsupportedClaimCount ?? 0) > 0 ? ["unsupported verifiable facts were generated"] : []),
    ...(inadequateRecovery ? [`required-fact recovery was ${Math.round(Number(truth.requiredFactRecall ?? 0) * 100)}%`] : []),
    ...(inadequateContentCoverage ? [`gold-section content coverage was ${Math.round(Number(gold.contentCoverage ?? 0) * 100)}%`] : []),
    ...(invalidLengthRatio ? [`generated/original length ratio was ${Number(gold.lengthRatio).toFixed(2)}`] : []),
    ...(inadequateSemanticRecovery ? [`semantic section similarity was ${Math.round(semanticScore*100)}%`] : []),
    ...(inadequateFormat ? [`PDF-ready format contract was ${Math.round(Number(format.score??0)*100)}%`] : []),
  ];
  evalRun.summary = `Failed truth recovery contract: ${reasons.join("; ")}.`;
}

function parseJsonValue(value) {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function extractFactDisplayText(value) {
  let parsed = value;
  if (typeof value === "string" && /^[\[{\"]/.test(value.trim())) {
    try { parsed = JSON.parse(value); } catch { parsed = value; }
  }
  if (parsed == null) return "";
  if (["string", "number", "boolean"].includes(typeof parsed)) return String(parsed);
  if (Array.isArray(parsed)) return parsed.map(extractFactDisplayText).filter(Boolean).join("\n\n");
  if (typeof parsed === "object") {
    if (parsed.text != null) return extractFactDisplayText(parsed.text);
    if (parsed.value != null) return extractFactDisplayText(parsed.value);
  }
  return "";
}

function requiredIdentifier(value, fieldName) {
  const normalized = String(value ?? "").trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,127}$/.test(normalized)) {
    throw new ApiError(
      400,
      `${fieldName} must be 3-128 characters using letters, numbers, dots, colons, underscores, or hyphens.`,
      `${fieldName}_invalid`,
    );
  }
  return normalized;
}

function requiredLabel(value, fieldName) {
  const normalized = String(value ?? "").trim();
  if (normalized.length < 2 || normalized.length > 160) {
    throw new ApiError(400, `${fieldName} must be 2-160 characters.`, `${fieldName}_invalid`);
  }
  return normalized;
}

function managedRoleLabel(value) {
  const role = String(value ?? "").trim();
  const allowed = new Set(["Super Admin", "Manager", "Inspector", "Reviewer", "Client Viewer"]);
  if (!allowed.has(role)) {
    throw new ApiError(400, "Unsupported account role.", "account_role_invalid");
  }
  return role;
}

function roleKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
