import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  generateSectionAssistantReply,
  generateSectionDraft,
  getAiStatus,
} from "./generation.mjs";
import { evaluateGeneratedSection } from "./eval.mjs";
import { classifyReportPackage } from "./report-classification.mjs";
import { API_STANDARD_REPORT_TOC } from "./report-toc.mjs";

export class ApiError extends Error {
  constructor(statusCode, message, code = "report_platform_api_error") {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function createReportStore({ dbFilePath }) {
  mkdirSync(dirname(dbFilePath), { recursive: true });

  const db = new DatabaseSync(dbFilePath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  ensureSchema(db);

  return {
    approveSection,
    ensureDevelopmentUsers,
    ensureSeedReport,
    generateSection,
    getHealth,
    getReportScope,
    getUserPrincipal,
    getUserPrincipalBySubject,
    importAndroidV2ProductExport,
    listDevelopmentUsers,
    loadEvalRuns,
    loadBootstrapReport,
    loadReportJobState,
    loadLatestEvalRun,
    replyToSectionChat,
    resetReportDrafts,
    restorePreviousSectionDraft,
    saveLayoutOverride,
    saveManualInputs,
    saveSectionDraft,
  };

  function ensureSeedReport({
    bootstrapKey,
    exportPackage,
    manualSupplementOverrides = {},
  }) {
    const existingBootstrapRows = db
      .prepare("SELECT report_job_id, inspection_id FROM report_jobs WHERE bootstrap_key = ?")
      .all(bootstrapKey);

    const staleBootstrapRows = existingBootstrapRows.filter(
      (row) => row.inspection_id !== exportPackage.inspectionId,
    );
    if (staleBootstrapRows.length > 0) {
      const nowIso = new Date().toISOString();
      inTransaction(() => {
        for (const row of staleBootstrapRows) {
          db.prepare(
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

  function importAndroidV2ProductExport({
    bootstrapKey = null,
    exportPackage,
    manualSupplementOverrides = {},
    actorUserId = null,
    allowIdentityBootstrap = false,
  }) {
    const validationIssues = validateAndroidV2ProductExport(exportPackage);
    if (validationIssues.length > 0) {
      throw new ApiError(
        400,
        `Invalid LAIQ inspection app V3 export package. ${validationIssues.join(" ")}`,
        "invalid_export_package",
      );
    }

    const nowIso = new Date().toISOString();
    let reportJobId;

    inTransaction(() => {
      if (allowIdentityBootstrap) {
        upsertIdentityRecords(exportPackage, nowIso);
      } else {
        ensureUserWorkspaceMembership(actorUserId, exportPackage.tenantId, exportPackage.workspaceId);
      }

      const persistedExportedByUserId = resolvePersistedExportedByUserId(
        exportPackage,
        actorUserId,
      );

      const existingImport = db
        .prepare("SELECT import_id, tenant_id, workspace_id FROM report_imports WHERE inspection_id = ?")
        .get(exportPackage.inspectionId);
      if (
        existingImport &&
        (
          existingImport.tenant_id !== exportPackage.tenantId ||
          existingImport.workspace_id !== exportPackage.workspaceId
        )
      ) {
        throw new ApiError(
          409,
          "Inspection identifier is already assigned to another tenant or workspace.",
          "inspection_scope_conflict",
        );
      }
      const importId = existingImport?.import_id ?? randomUUID();

      db.prepare(
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
          created_at_iso,
          updated_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(inspection_id) DO UPDATE SET
          tenant_id = excluded.tenant_id,
          workspace_id = excluded.workspace_id,
          package_type = excluded.package_type,
          schema_version = excluded.schema_version,
          inspection_reference = excluded.inspection_reference,
          exported_by_user_id = excluded.exported_by_user_id,
          exported_at_iso = excluded.exported_at_iso,
          raw_package_json = excluded.raw_package_json,
          updated_at_iso = excluded.updated_at_iso`,
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
        nowIso,
        nowIso,
      );

      const existingReportJob = db
        .prepare("SELECT report_job_id FROM report_jobs WHERE inspection_id = ?")
        .get(exportPackage.inspectionId);
      reportJobId = existingReportJob?.report_job_id ?? randomUUID();
      const packageFingerprint = buildPackageFingerprint(exportPackage);
      const previousPackageFingerprint = existingReportJob?.report_job_id
        ? db
          .prepare("SELECT field_value FROM report_manual_inputs WHERE report_job_id = ? AND field_key = ?")
          .get(existingReportJob.report_job_id, "__sourcePackageFingerprint")?.field_value
        : null;
      const shouldClearDerivedState = Boolean(
        existingReportJob?.report_job_id &&
        previousPackageFingerprint !== packageFingerprint,
      );

      db.prepare(
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(inspection_id) DO UPDATE SET
          import_id = excluded.import_id,
          bootstrap_key = COALESCE(report_jobs.bootstrap_key, excluded.bootstrap_key),
          tenant_id = excluded.tenant_id,
          workspace_id = excluded.workspace_id,
          created_by_user_id = excluded.created_by_user_id,
          report_reference = excluded.report_reference,
          title = excluded.title,
          client = excluded.client,
          tank = excluded.tank,
          inspected_date = excluded.inspected_date,
          updated_at_iso = excluded.updated_at_iso`,
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

      upsertDefaultManualInputs(
        reportJobId,
        buildDefaultManualSupplement(exportPackage, manualSupplementOverrides),
        nowIso,
      );

      if (shouldClearDerivedState) {
        clearDerivedReportState(reportJobId, nowIso);
      }

      upsertInternalManualInput(reportJobId, "__sourcePackageFingerprint", packageFingerprint, nowIso);
    });

    return loadReportJobState(reportJobId);
  }

  function refreshSeedReport(reportJobId, exportPackage, manualSupplementOverrides) {
    const nowIso = new Date().toISOString();
    const defaultValues = buildDefaultManualSupplement(exportPackage, manualSupplementOverrides);

    inTransaction(() => {
      db.prepare(
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
        db.prepare(
          `INSERT INTO report_manual_inputs (report_job_id, field_key, field_value, updated_at_iso)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(report_job_id, field_key) DO UPDATE SET
            field_value = excluded.field_value,
            updated_at_iso = excluded.updated_at_iso`,
        ).run(reportJobId, fieldKey, String(defaultValues[fieldKey] ?? ""), nowIso);
      }
    });
  }

  function loadBootstrapReport(bootstrapKey) {
    const row = db
      .prepare("SELECT report_job_id FROM report_jobs WHERE bootstrap_key = ? ORDER BY updated_at_iso DESC LIMIT 1")
      .get(bootstrapKey);

    if (!row?.report_job_id) {
      return null;
    }

    return loadReportJobState(row.report_job_id);
  }

  function getReportScope(reportJobId) {
    const row = db
      .prepare(
        `SELECT report_job_id, tenant_id, workspace_id, status_code
        FROM report_jobs
        WHERE report_job_id = ?`,
      )
      .get(reportJobId);

    return row
      ? {
          reportJobId: row.report_job_id,
          tenantId: row.tenant_id,
          workspaceId: row.workspace_id,
          statusCode: row.status_code,
        }
      : null;
  }

  function getUserPrincipal(userId) {
    const user = db
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

    const memberships = db
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

  function getUserPrincipalBySubject(providerCode, subject) {
    const row = db
      .prepare(
        `SELECT user_id
        FROM platform_users
        WHERE identity_provider = ? AND external_subject = ? AND account_status = 'active'`,
      )
      .get(providerCode, subject);
    return row?.user_id ? getUserPrincipal(row.user_id) : null;
  }

  function listDevelopmentUsers() {
    return db
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
      .all()
      .map((row) => getUserPrincipal(row.user_id))
      .filter(Boolean);
  }

  function ensureDevelopmentUsers() {
    const seed = db
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

    inTransaction(() => {
      for (const user of controlledUsers) {
        upsertControlledDevelopmentUser({
          ...user,
          tenantId: seed.tenant_id,
          workspaceId: seed.workspace_id,
          nowIso,
        });
      }

      const isolatedTenantId = "tenant-auth-isolation-demo";
      const isolatedWorkspaceId = "workspace-auth-isolation-demo";
      db.prepare(
        `INSERT INTO tenants (tenant_id, tenant_name, created_at_iso, updated_at_iso)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(tenant_id) DO NOTHING`,
      ).run(isolatedTenantId, "Isolation Demo Tenant", nowIso, nowIso);
      db.prepare(
        `INSERT INTO workspaces (workspace_id, tenant_id, workspace_name, created_at_iso, updated_at_iso)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(workspace_id) DO NOTHING`,
      ).run(isolatedWorkspaceId, isolatedTenantId, "Isolation Workspace", nowIso, nowIso);
      upsertControlledDevelopmentUser({
        userId: "demo-isolated-inspector",
        displayName: "Isolated Tenant Inspector",
        roleLabel: "Inspector",
        tenantId: isolatedTenantId,
        workspaceId: isolatedWorkspaceId,
        nowIso,
      });
    });
  }

  function loadReportJobState(reportJobId) {
    const row = db
      .prepare(
        `SELECT
          rj.report_job_id,
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
          rj.created_at_iso,
          rj.updated_at_iso,
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

    const manualSupplementRows = db
      .prepare(
        `SELECT field_key, field_value
        FROM report_manual_inputs
        WHERE report_job_id = ?
        ORDER BY field_key`,
      )
      .all(reportJobId);
    const sectionDraftRows = db
      .prepare(
        `SELECT section_id, content, generated, edited, approved, review_required, updated_at_iso
        FROM report_section_drafts
        WHERE report_job_id = ?
        ORDER BY section_id`,
      )
      .all(reportJobId);
    const sectionDraftVersionRows = db
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
    const layoutOverrideRows = db
      .prepare(
        `SELECT section_id, layout_json, updated_at_iso
        FROM report_layout_overrides
        WHERE report_job_id = ?
        ORDER BY section_id`,
      )
      .all(reportJobId);
    const latestGenerationRun = db
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
    const latestEvalRun = db
      .prepare(
        `SELECT eval_json
        FROM report_eval_runs
        WHERE report_job_id = ?
        ORDER BY created_at_iso DESC
        LIMIT 1`,
      )
      .get(reportJobId);

    const exportPackage = JSON.parse(row.raw_package_json);
    const latestOrchestration = latestGenerationRun?.orchestration_json
      ? JSON.parse(latestGenerationRun.orchestration_json)
      : null;

    return {
      reportJob: {
        reportJobId: row.report_job_id,
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
        createdAtIso: row.created_at_iso,
        updatedAtIso: row.updated_at_iso,
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
        updatedAtIso: sectionDraft.updated_at_iso,
        previousVersionCount: sectionDraftVersionCounts.get(sectionDraft.section_id) ?? 0,
      })),
      layoutOverrides: layoutOverrideRows.map((layoutOverride) => ({
        sectionId: layoutOverride.section_id,
        layoutMap: normalizePersistedLayoutMap(JSON.parse(layoutOverride.layout_json)),
        updatedAtIso: layoutOverride.updated_at_iso,
      })),
      generationRun: latestGenerationRun
        ? {
            runId: latestGenerationRun.run_id,
            sectionId: latestGenerationRun.section_id,
            statusCode: latestGenerationRun.status_code,
            templateKey: latestGenerationRun.template_key,
            retrievalKeys: JSON.parse(latestGenerationRun.retrieval_json),
            calculationKeys: JSON.parse(latestGenerationRun.calculation_json),
            mapArtifactKeys: JSON.parse(latestGenerationRun.map_artifacts_json),
            warnings: JSON.parse(latestGenerationRun.warnings_json),
            blockers: JSON.parse(latestGenerationRun.blockers_json),
            providerCode: latestGenerationRun.provider_code,
            modelId: latestGenerationRun.model_id,
            usedLiveModel: latestGenerationRun.used_live_model == null ? undefined : Boolean(latestGenerationRun.used_live_model),
            fallbackReason: latestGenerationRun.fallback_reason,
            assistantSummary: latestGenerationRun.assistant_summary,
            evidenceChain: latestOrchestration?.evidenceChain,
            generatedAtIso: latestGenerationRun.created_at_iso,
          }
        : undefined,
      evalRun: latestEvalRun?.eval_json ? JSON.parse(latestEvalRun.eval_json) : undefined,
      aiStatus: getAiStatus(),
    };
  }

  function saveManualInputs(reportJobId, values) {
    ensureReportJobExists(reportJobId);
    const nowIso = new Date().toISOString();

    inTransaction(() => {
      for (const [fieldKey, fieldValue] of Object.entries(values)) {
        db.prepare(
          `INSERT INTO report_manual_inputs (report_job_id, field_key, field_value, updated_at_iso)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(report_job_id, field_key) DO UPDATE SET
            field_value = excluded.field_value,
            updated_at_iso = excluded.updated_at_iso`,
        ).run(reportJobId, fieldKey, String(fieldValue ?? ""), nowIso);
      }

      touchReportJob(reportJobId, nowIso);
    });

    return loadReportJobState(reportJobId);
  }

  function resetReportDrafts(reportJobId) {
    ensureReportJobExists(reportJobId);
    const nowIso = new Date().toISOString();

    inTransaction(() => {
      clearDerivedReportState(reportJobId, nowIso);
    });

    return loadReportJobState(reportJobId);
  }

  function clearDerivedReportState(reportJobId, nowIso) {
    db.prepare("DELETE FROM report_eval_runs WHERE report_job_id = ?").run(reportJobId);
    db.prepare("DELETE FROM report_generation_runs WHERE report_job_id = ?").run(reportJobId);
    db.prepare("DELETE FROM report_review_decisions WHERE report_job_id = ?").run(reportJobId);
    db.prepare("DELETE FROM report_layout_overrides WHERE report_job_id = ?").run(reportJobId);
    db.prepare("DELETE FROM report_section_draft_versions WHERE report_job_id = ?").run(reportJobId);
    db.prepare("DELETE FROM report_section_drafts WHERE report_job_id = ?").run(reportJobId);
    db.prepare("UPDATE report_jobs SET status_code = ?, updated_at_iso = ? WHERE report_job_id = ?").run(
      "draft",
      nowIso,
      reportJobId,
    );
  }

  function saveSectionDraft(reportJobId, sectionId, draft) {
    ensureReportJobExists(reportJobId);
    ensureKnownSection(sectionId);
    const nowIso = new Date().toISOString();
    const nextContent = String(draft.content ?? "");

    inTransaction(() => {
      snapshotExistingSectionDraft(reportJobId, sectionId, nextContent, nowIso, "draft_save");

      db.prepare(
        `INSERT INTO report_section_drafts (
          report_job_id,
          section_id,
          content,
          generated,
          edited,
          approved,
          review_required,
          updated_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(report_job_id, section_id) DO UPDATE SET
          content = excluded.content,
          generated = excluded.generated,
          edited = excluded.edited,
          approved = excluded.approved,
          review_required = excluded.review_required,
          updated_at_iso = excluded.updated_at_iso`,
      ).run(
        reportJobId,
        sectionId,
        nextContent,
        boolToInt(draft.generated),
        boolToInt(draft.edited),
        boolToInt(draft.approved),
        boolToInt(draft.reviewRequired),
        nowIso,
      );

      db.prepare("UPDATE report_jobs SET status_code = ?, updated_at_iso = ? WHERE report_job_id = ?").run(
        draft.approved ? "reviewed" : "draft",
        nowIso,
        reportJobId,
      );
    });

    return loadReportJobState(reportJobId);
  }

  function restorePreviousSectionDraft(reportJobId, sectionId, { actorUserId } = {}) {
    ensureReportJobExists(reportJobId);
    ensureKnownSection(sectionId);
    ensureActorUserExists(actorUserId || getReportJobActorUserId(reportJobId));

    const previousVersion = db
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
        LIMIT 1`,
      )
      .get(reportJobId, sectionId);

    if (!previousVersion) {
      throw new ApiError(
        404,
        `No previous generated output is available for ${sectionId}.`,
        "section_draft_version_not_found",
      );
    }

    const nowIso = new Date().toISOString();

    inTransaction(() => {
      db.prepare("DELETE FROM report_section_draft_versions WHERE version_id = ?").run(previousVersion.version_id);
      snapshotExistingSectionDraft(reportJobId, sectionId, previousVersion.content, nowIso, "rollback_replaced_draft");

      db.prepare(
        `INSERT INTO report_section_drafts (
          report_job_id,
          section_id,
          content,
          generated,
          edited,
          approved,
          review_required,
          updated_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(report_job_id, section_id) DO UPDATE SET
          content = excluded.content,
          generated = excluded.generated,
          edited = excluded.edited,
          approved = excluded.approved,
          review_required = excluded.review_required,
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

      db.prepare("UPDATE report_jobs SET status_code = ?, updated_at_iso = ? WHERE report_job_id = ?").run(
        "draft",
        nowIso,
        reportJobId,
      );
    });

    return loadReportJobState(reportJobId);
  }

  function saveLayoutOverride(reportJobId, sectionId, layoutMap) {
    ensureReportJobExists(reportJobId);
    ensureKnownSection(sectionId);
    const nowIso = new Date().toISOString();

    inTransaction(() => {
      db.prepare(
        `INSERT INTO report_layout_overrides (report_job_id, section_id, layout_json, updated_at_iso)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(report_job_id, section_id) DO UPDATE SET
          layout_json = excluded.layout_json,
          updated_at_iso = excluded.updated_at_iso`,
      ).run(reportJobId, sectionId, JSON.stringify(normalizePersistedLayoutMap(layoutMap)), nowIso);

      db.prepare(
        `UPDATE report_section_drafts
        SET approved = 0, review_required = 1, updated_at_iso = ?
        WHERE report_job_id = ? AND section_id = ?`,
      ).run(nowIso, reportJobId, sectionId);

      touchReportJob(reportJobId, nowIso);
    });

    return loadReportJobState(reportJobId);
  }

  async function generateSection(reportJobId, sectionId, { actorUserId, userInstruction = "" } = {}) {
    ensureReportJobExists(reportJobId);
    ensureKnownSection(sectionId);
    const reportState = loadReportJobState(reportJobId);
    if (!reportState) {
      throw new ApiError(404, "Report job was not found.", "report_job_not_found");
    }
    const actor = ensureActorUserExists(actorUserId || getReportJobActorUserId(reportJobId));

    const generation = await generateSectionDraft({
      reportState,
      sectionId,
      userInstruction,
    });
    const evalRun = evaluateGeneratedSection({
      reportState,
      sectionId,
      generationRun: generation.generationRun,
      generatedContent: generation.draft.content,
      orchestration: generation.orchestration,
    });
    const nowIso = generation.generationRun.generatedAtIso;

    inTransaction(() => {
      snapshotExistingSectionDraft(reportJobId, sectionId, generation.draft.content, nowIso, "section_generate");

      db.prepare(
        `INSERT INTO report_section_drafts (
          report_job_id,
          section_id,
          content,
          generated,
          edited,
          approved,
          review_required,
          updated_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(report_job_id, section_id) DO UPDATE SET
          content = excluded.content,
          generated = excluded.generated,
          edited = excluded.edited,
          approved = excluded.approved,
          review_required = excluded.review_required,
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

      db.prepare(
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

      db.prepare(
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

      db.prepare("UPDATE report_jobs SET status_code = ?, updated_at_iso = ? WHERE report_job_id = ?").run(
        generation.generationRun.statusCode,
        nowIso,
        reportJobId,
      );
    });

    return {
      ...loadReportJobState(reportJobId),
      generationRun: generation.generationRun,
      evalRun,
      aiStatus: getAiStatus(),
    };
  }

  function loadEvalRuns(reportJobId) {
    ensureReportJobExists(reportJobId);
    return db
      .prepare(
        `SELECT eval_json
        FROM report_eval_runs
        WHERE report_job_id = ?
        ORDER BY created_at_iso DESC`,
      )
      .all(reportJobId)
      .map((row) => JSON.parse(row.eval_json));
  }

  function loadLatestEvalRun(reportJobId, sectionId) {
    ensureReportJobExists(reportJobId);
    ensureKnownSection(sectionId);
    const row = db
      .prepare(
        `SELECT eval_json
        FROM report_eval_runs
        WHERE report_job_id = ? AND section_id = ?
        ORDER BY created_at_iso DESC
        LIMIT 1`,
      )
      .get(reportJobId, sectionId);

    return row?.eval_json ? JSON.parse(row.eval_json) : null;
  }

  async function replyToSectionChat(reportJobId, sectionId, { userPrompt, conversationHistory = [] }) {
    ensureReportJobExists(reportJobId);
    ensureKnownSection(sectionId);
    const reportState = loadReportJobState(reportJobId);
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

  function approveSection(reportJobId, sectionId, { actorUserId, note = "" } = {}) {
    ensureReportJobExists(reportJobId);
    ensureKnownSection(sectionId);
    ensureFloorCorrosionReadyForApproval(reportJobId, sectionId);
    const nowIso = new Date().toISOString();
    const actor = ensureActorUserExists(actorUserId || getReportJobActorUserId(reportJobId));
    const existingSectionDraft = db
      .prepare(
        `SELECT content, generated, edited
        FROM report_section_drafts
        WHERE report_job_id = ? AND section_id = ?`,
      )
      .get(reportJobId, sectionId);

    inTransaction(() => {
      db.prepare(
        `INSERT INTO report_section_drafts (
          report_job_id,
          section_id,
          content,
          generated,
          edited,
          approved,
          review_required,
          updated_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(report_job_id, section_id) DO UPDATE SET
          approved = excluded.approved,
          review_required = excluded.review_required,
          edited = excluded.edited,
          updated_at_iso = excluded.updated_at_iso`,
      ).run(
        reportJobId,
        sectionId,
        existingSectionDraft?.content ?? "",
        boolToInt(existingSectionDraft?.generated ?? true),
        boolToInt(existingSectionDraft?.edited ?? true),
        1,
        0,
        nowIso,
      );

      db.prepare(
        `INSERT INTO report_review_decisions (
          report_job_id,
          section_id,
          decision_code,
          actor_user_id,
          note,
          created_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(reportJobId, sectionId, "approved", actor, note, nowIso);

      db.prepare("UPDATE report_jobs SET status_code = ?, updated_at_iso = ? WHERE report_job_id = ?").run(
        "section_approved",
        nowIso,
        reportJobId,
      );
    });

    return loadReportJobState(reportJobId);
  }

  function getHealth() {
    return {
      databaseDriver: "sqlite-development",
      reportJobCount: db.prepare("SELECT COUNT(*) AS count FROM report_jobs").get().count,
      importCount: db.prepare("SELECT COUNT(*) AS count FROM report_imports").get().count,
      tenantCount: db.prepare("SELECT COUNT(*) AS count FROM tenants").get().count,
    };
  }

  function ensureReportJobExists(reportJobId) {
    const row = db.prepare("SELECT report_job_id FROM report_jobs WHERE report_job_id = ?").get(reportJobId);
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

  function ensureFloorCorrosionReadyForApproval(reportJobId, sectionId) {
    if (sectionId !== "floor-plate-corrosion-plan") return;
    const row = db
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
      layoutMap = JSON.parse(row.layout_json);
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

  function ensureActorUserExists(actorUserId) {
    if (!actorUserId || typeof actorUserId !== "string") {
      throw new ApiError(400, "actorUserId is required.", "actor_user_required");
    }

    const row = db.prepare("SELECT user_id FROM platform_users WHERE user_id = ?").get(actorUserId);
    if (!row?.user_id) {
      throw new ApiError(400, "actorUserId does not match a known platform user.", "actor_user_not_found");
    }

    return actorUserId;
  }

  function ensureUserWorkspaceMembership(userId, tenantId, workspaceId) {
    const principal = getUserPrincipal(userId);
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

  function resolvePersistedExportedByUserId(exportPackage, actorUserId) {
    const exportedBy = getUserPrincipal(exportPackage.exportedByUserId);
    const hasMatchingScope = exportedBy?.tenantId === exportPackage.tenantId && exportedBy.workspaceMemberships.some(
      (membership) => membership.workspaceId === exportPackage.workspaceId,
    );
    if (hasMatchingScope) {
      return exportedBy.userId;
    }
    return ensureActorUserExists(actorUserId);
  }

  function getReportJobActorUserId(reportJobId) {
    const row = db
      .prepare("SELECT created_by_user_id FROM report_jobs WHERE report_job_id = ?")
      .get(reportJobId);
    return row?.created_by_user_id ?? "unknown-user";
  }

  function touchReportJob(reportJobId, nowIso) {
    db.prepare("UPDATE report_jobs SET updated_at_iso = ? WHERE report_job_id = ?").run(nowIso, reportJobId);
  }

  function upsertIdentityRecords(exportPackage, nowIso) {
    db.prepare(
      `INSERT INTO tenants (tenant_id, tenant_name, created_at_iso, updated_at_iso)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(tenant_id) DO UPDATE SET
        tenant_name = excluded.tenant_name,
        updated_at_iso = excluded.updated_at_iso`,
    ).run(exportPackage.tenantId, exportPackage.profile.tenantName, nowIso, nowIso);

    db.prepare(
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

    db.prepare(
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

    db.prepare(
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

  function upsertControlledDevelopmentUser({
    userId,
    tenantId,
    workspaceId,
    displayName,
    roleLabel,
    nowIso,
  }) {
    db.prepare(
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
    db.prepare(
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

  function upsertDefaultManualInputs(reportJobId, defaultValues, nowIso) {
    for (const [fieldKey, fieldValue] of Object.entries(defaultValues)) {
      db.prepare(
        `INSERT INTO report_manual_inputs (report_job_id, field_key, field_value, updated_at_iso)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(report_job_id, field_key) DO NOTHING`,
      ).run(reportJobId, fieldKey, String(fieldValue ?? ""), nowIso);
    }
  }

  function upsertInternalManualInput(reportJobId, fieldKey, fieldValue, nowIso) {
    db.prepare(
      `INSERT INTO report_manual_inputs (report_job_id, field_key, field_value, updated_at_iso)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(report_job_id, field_key) DO UPDATE SET
        field_value = excluded.field_value,
      updated_at_iso = excluded.updated_at_iso`,
    ).run(reportJobId, fieldKey, String(fieldValue ?? ""), nowIso);
  }

  function snapshotExistingSectionDraft(reportJobId, sectionId, nextContent, nowIso, reasonCode) {
    const currentDraft = db
      .prepare(
        `SELECT content, generated, edited, approved, review_required, updated_at_iso
        FROM report_section_drafts
        WHERE report_job_id = ? AND section_id = ?`,
      )
      .get(reportJobId, sectionId);

    if (!currentDraft || currentDraft.content === nextContent) {
      return;
    }

    db.prepare(
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
    db.exec("BEGIN");
    try {
      const result = operation();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      tenant_id TEXT PRIMARY KEY,
      tenant_name TEXT NOT NULL,
      created_at_iso TEXT NOT NULL,
      updated_at_iso TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      workspace_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants (tenant_id),
      workspace_name TEXT NOT NULL,
      created_at_iso TEXT NOT NULL,
      updated_at_iso TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS platform_users (
      user_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants (tenant_id),
      workspace_id TEXT NOT NULL REFERENCES workspaces (workspace_id),
      display_name TEXT NOT NULL,
      role_label TEXT NOT NULL,
      device_id TEXT,
      identity_provider TEXT,
      external_subject TEXT,
      account_status TEXT NOT NULL DEFAULT 'active',
      created_at_iso TEXT NOT NULL,
      updated_at_iso TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspace_role_memberships (
      workspace_id TEXT NOT NULL REFERENCES workspaces (workspace_id),
      user_id TEXT NOT NULL REFERENCES platform_users (user_id),
      role_label TEXT NOT NULL,
      created_at_iso TEXT NOT NULL,
      updated_at_iso TEXT NOT NULL,
      PRIMARY KEY (workspace_id, user_id, role_label)
    );

    CREATE TABLE IF NOT EXISTS report_imports (
      import_id TEXT PRIMARY KEY,
      inspection_id TEXT NOT NULL UNIQUE,
      tenant_id TEXT NOT NULL REFERENCES tenants (tenant_id),
      workspace_id TEXT NOT NULL REFERENCES workspaces (workspace_id),
      package_type TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      inspection_reference TEXT NOT NULL,
      exported_by_user_id TEXT NOT NULL REFERENCES platform_users (user_id),
      exported_at_iso TEXT NOT NULL,
      raw_package_json TEXT NOT NULL,
      created_at_iso TEXT NOT NULL,
      updated_at_iso TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS report_jobs (
      report_job_id TEXT PRIMARY KEY,
      import_id TEXT NOT NULL REFERENCES report_imports (import_id),
      bootstrap_key TEXT,
      inspection_id TEXT NOT NULL UNIQUE,
      tenant_id TEXT NOT NULL REFERENCES tenants (tenant_id),
      workspace_id TEXT NOT NULL REFERENCES workspaces (workspace_id),
      created_by_user_id TEXT NOT NULL REFERENCES platform_users (user_id),
      report_reference TEXT NOT NULL,
      title TEXT NOT NULL,
      client TEXT NOT NULL,
      tank TEXT NOT NULL,
      inspected_date TEXT NOT NULL,
      status_code TEXT NOT NULL,
      created_at_iso TEXT NOT NULL,
      updated_at_iso TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_report_jobs_bootstrap_key ON report_jobs (bootstrap_key);

    CREATE TABLE IF NOT EXISTS report_manual_inputs (
      report_job_id TEXT NOT NULL REFERENCES report_jobs (report_job_id),
      field_key TEXT NOT NULL,
      field_value TEXT NOT NULL,
      updated_at_iso TEXT NOT NULL,
      PRIMARY KEY (report_job_id, field_key)
    );

    CREATE TABLE IF NOT EXISTS report_section_drafts (
      report_job_id TEXT NOT NULL REFERENCES report_jobs (report_job_id),
      section_id TEXT NOT NULL,
      content TEXT NOT NULL,
      generated INTEGER NOT NULL,
      edited INTEGER NOT NULL,
      approved INTEGER NOT NULL,
      review_required INTEGER NOT NULL,
      updated_at_iso TEXT NOT NULL,
      PRIMARY KEY (report_job_id, section_id)
    );

    CREATE TABLE IF NOT EXISTS report_section_draft_versions (
      version_id TEXT PRIMARY KEY,
      report_job_id TEXT NOT NULL REFERENCES report_jobs (report_job_id),
      section_id TEXT NOT NULL,
      content TEXT NOT NULL,
      generated INTEGER NOT NULL,
      edited INTEGER NOT NULL,
      approved INTEGER NOT NULL,
      review_required INTEGER NOT NULL,
      source_updated_at_iso TEXT NOT NULL,
      reason_code TEXT NOT NULL,
      created_at_iso TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_report_section_draft_versions_section_created
      ON report_section_draft_versions (report_job_id, section_id, created_at_iso DESC);

    CREATE TABLE IF NOT EXISTS report_layout_overrides (
      report_job_id TEXT NOT NULL REFERENCES report_jobs (report_job_id),
      section_id TEXT NOT NULL,
      layout_json TEXT NOT NULL,
      updated_at_iso TEXT NOT NULL,
      PRIMARY KEY (report_job_id, section_id)
    );

    CREATE TABLE IF NOT EXISTS report_review_decisions (
      report_job_id TEXT NOT NULL REFERENCES report_jobs (report_job_id),
      section_id TEXT NOT NULL,
      decision_code TEXT NOT NULL,
      actor_user_id TEXT NOT NULL REFERENCES platform_users (user_id),
      note TEXT,
      created_at_iso TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS report_generation_runs (
      run_id TEXT PRIMARY KEY,
      report_job_id TEXT NOT NULL REFERENCES report_jobs (report_job_id),
      section_id TEXT NOT NULL,
      actor_user_id TEXT NOT NULL REFERENCES platform_users (user_id),
      template_key TEXT NOT NULL,
      status_code TEXT NOT NULL,
      retrieval_json TEXT NOT NULL,
      calculation_json TEXT NOT NULL,
      map_artifacts_json TEXT NOT NULL,
      warnings_json TEXT NOT NULL,
      blockers_json TEXT NOT NULL,
      provider_code TEXT,
      model_id TEXT,
      used_live_model INTEGER,
      fallback_reason TEXT,
      assistant_summary TEXT,
      orchestration_json TEXT NOT NULL,
      generated_content TEXT NOT NULL,
      created_at_iso TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_report_generation_runs_job_created
      ON report_generation_runs (report_job_id, created_at_iso DESC);

    CREATE TABLE IF NOT EXISTS report_eval_runs (
      eval_run_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES report_generation_runs (run_id),
      report_job_id TEXT NOT NULL REFERENCES report_jobs (report_job_id),
      section_id TEXT NOT NULL,
      evaluator_key TEXT NOT NULL,
      score REAL NOT NULL,
      outcome_code TEXT NOT NULL,
      summary TEXT NOT NULL,
      eval_json TEXT NOT NULL,
      created_at_iso TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_report_eval_runs_job_created
      ON report_eval_runs (report_job_id, created_at_iso DESC);

    CREATE INDEX IF NOT EXISTS idx_report_eval_runs_section_created
      ON report_eval_runs (report_job_id, section_id, created_at_iso DESC);
  `);

  ensureColumn(db, "report_generation_runs", "provider_code", "ALTER TABLE report_generation_runs ADD COLUMN provider_code TEXT");
  ensureColumn(db, "report_generation_runs", "model_id", "ALTER TABLE report_generation_runs ADD COLUMN model_id TEXT");
  ensureColumn(db, "report_generation_runs", "used_live_model", "ALTER TABLE report_generation_runs ADD COLUMN used_live_model INTEGER");
  ensureColumn(db, "report_generation_runs", "fallback_reason", "ALTER TABLE report_generation_runs ADD COLUMN fallback_reason TEXT");
  ensureColumn(db, "report_generation_runs", "assistant_summary", "ALTER TABLE report_generation_runs ADD COLUMN assistant_summary TEXT");
  ensureColumn(db, "platform_users", "identity_provider", "ALTER TABLE platform_users ADD COLUMN identity_provider TEXT");
  ensureColumn(db, "platform_users", "external_subject", "ALTER TABLE platform_users ADD COLUMN external_subject TEXT");
  ensureColumn(db, "platform_users", "account_status", "ALTER TABLE platform_users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active'");
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_users_external_identity
      ON platform_users (identity_provider, external_subject)
      WHERE identity_provider IS NOT NULL AND external_subject IS NOT NULL;
  `);
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
    .update(stableStringify(exportPackage))
    .digest("hex");
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

function validateAndroidV2ProductExport(exportPackage) {
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

function boolToInt(value) {
  return value ? 1 : 0;
}

function ensureColumn(db, tableName, columnName, ddl) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = columns.some((column) => column.name === columnName);
  if (!exists) {
    db.exec(ddl);
  }
}
