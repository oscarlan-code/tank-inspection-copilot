import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  generateSectionAssistantReply,
  generateSectionDraft,
  getAiStatus,
} from "./generation.mjs";
import { classifyReportPackage } from "./report-classification.mjs";

export function createReportStore({ dbFilePath }) {
  mkdirSync(dirname(dbFilePath), { recursive: true });

  const db = new DatabaseSync(dbFilePath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  ensureSchema(db);

  return {
    approveSection,
    ensureSeedReport,
    generateSection,
    getHealth,
    importAndroidV2ProductExport,
    loadBootstrapReport,
    loadReportJobState,
    replyToSectionChat,
    saveLayoutOverride,
    saveManualInputs,
    saveSectionDraft,
  };

  function ensureSeedReport({
    bootstrapKey,
    exportPackage,
    manualSupplementOverrides = {},
  }) {
    const existing = db
      .prepare("SELECT report_job_id FROM report_jobs WHERE bootstrap_key = ? LIMIT 1")
      .get(bootstrapKey);

    if (existing?.report_job_id) {
      return importAndroidV2ProductExport({
        bootstrapKey,
        exportPackage,
        manualSupplementOverrides,
      });
    }

    return importAndroidV2ProductExport({
      bootstrapKey,
      exportPackage,
      manualSupplementOverrides,
    });
  }

  function importAndroidV2ProductExport({
    bootstrapKey = null,
    exportPackage,
    manualSupplementOverrides = {},
  }) {
    const validationIssues = validateAndroidV2ProductExport(exportPackage);
    if (validationIssues.length > 0) {
      throw new Error(`Invalid Android V2 Product export package. ${validationIssues.join(" ")}`);
    }

    const nowIso = new Date().toISOString();
    let reportJobId;

    inTransaction(() => {
      upsertIdentityRecords(exportPackage, nowIso);

      const existingImport = db
        .prepare("SELECT import_id FROM report_imports WHERE inspection_id = ?")
        .get(exportPackage.inspectionId);
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
        exportPackage.exportedByUserId,
        exportPackage.exportedAtIso,
        JSON.stringify(exportPackage),
        nowIso,
        nowIso,
      );

      const existingReportJob = db
        .prepare("SELECT report_job_id FROM report_jobs WHERE inspection_id = ?")
        .get(exportPackage.inspectionId);
      reportJobId = existingReportJob?.report_job_id ?? randomUUID();

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
        exportPackage.exportedByUserId,
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
      .prepare("SELECT report_job_id FROM report_jobs WHERE bootstrap_key = ? LIMIT 1")
      .get(bootstrapKey);

    if (!row?.report_job_id) {
      return null;
    }

    return loadReportJobState(row.report_job_id);
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
        manualSupplementRows.map((manualInput) => [manualInput.field_key, manualInput.field_value]),
      ),
      sectionDrafts: sectionDraftRows.map((sectionDraft) => ({
        sectionId: sectionDraft.section_id,
        content: sectionDraft.content,
        generated: Boolean(sectionDraft.generated),
        edited: Boolean(sectionDraft.edited),
        approved: Boolean(sectionDraft.approved),
        reviewRequired: Boolean(sectionDraft.review_required),
        updatedAtIso: sectionDraft.updated_at_iso,
      })),
      layoutOverrides: layoutOverrideRows.map((layoutOverride) => ({
        sectionId: layoutOverride.section_id,
        layoutMap: JSON.parse(layoutOverride.layout_json),
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

  function saveSectionDraft(reportJobId, sectionId, draft) {
    ensureReportJobExists(reportJobId);
    const nowIso = new Date().toISOString();

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
          content = excluded.content,
          generated = excluded.generated,
          edited = excluded.edited,
          approved = excluded.approved,
          review_required = excluded.review_required,
          updated_at_iso = excluded.updated_at_iso`,
      ).run(
        reportJobId,
        sectionId,
        String(draft.content ?? ""),
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

  function saveLayoutOverride(reportJobId, sectionId, layoutMap) {
    ensureReportJobExists(reportJobId);
    const nowIso = new Date().toISOString();

    inTransaction(() => {
      db.prepare(
        `INSERT INTO report_layout_overrides (report_job_id, section_id, layout_json, updated_at_iso)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(report_job_id, section_id) DO UPDATE SET
          layout_json = excluded.layout_json,
          updated_at_iso = excluded.updated_at_iso`,
      ).run(reportJobId, sectionId, JSON.stringify(layoutMap), nowIso);

      touchReportJob(reportJobId, nowIso);
    });

    return loadReportJobState(reportJobId);
  }

  async function generateSection(reportJobId, sectionId, { actorUserId, userInstruction = "" } = {}) {
    ensureReportJobExists(reportJobId);
    const reportState = loadReportJobState(reportJobId);
    if (!reportState) {
      throw new Error(`Unknown report job: ${reportJobId}`);
    }

    const generation = await generateSectionDraft({
      reportState,
      sectionId,
      userInstruction,
    });
    const nowIso = generation.generationRun.generatedAtIso;
    const actor = actorUserId || getReportJobActorUserId(reportJobId);

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

      db.prepare("UPDATE report_jobs SET status_code = ?, updated_at_iso = ? WHERE report_job_id = ?").run(
        generation.generationRun.statusCode,
        nowIso,
        reportJobId,
      );
    });

    return {
      ...loadReportJobState(reportJobId),
      generationRun: generation.generationRun,
      aiStatus: getAiStatus(),
    };
  }

  async function replyToSectionChat(reportJobId, sectionId, { userPrompt }) {
    ensureReportJobExists(reportJobId);
    const reportState = loadReportJobState(reportJobId);
    if (!reportState) {
      throw new Error(`Unknown report job: ${reportJobId}`);
    }

    return generateSectionAssistantReply({
      reportState,
      sectionId,
      userPrompt: String(userPrompt ?? ""),
    });
  }

  function approveSection(reportJobId, sectionId, { actorUserId, note = "" } = {}) {
    ensureReportJobExists(reportJobId);
    const nowIso = new Date().toISOString();
    const actor = actorUserId || getReportJobActorUserId(reportJobId);
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
      databasePath: dbFilePath,
      reportJobCount: db.prepare("SELECT COUNT(*) AS count FROM report_jobs").get().count,
      importCount: db.prepare("SELECT COUNT(*) AS count FROM report_imports").get().count,
      tenantCount: db.prepare("SELECT COUNT(*) AS count FROM tenants").get().count,
    };
  }

  function ensureReportJobExists(reportJobId) {
    const row = db.prepare("SELECT report_job_id FROM report_jobs WHERE report_job_id = ?").get(reportJobId);
    if (!row?.report_job_id) {
      throw new Error(`Unknown report job: ${reportJobId}`);
    }
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

  function upsertDefaultManualInputs(reportJobId, defaultValues, nowIso) {
    for (const [fieldKey, fieldValue] of Object.entries(defaultValues)) {
      db.prepare(
        `INSERT INTO report_manual_inputs (report_job_id, field_key, field_value, updated_at_iso)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(report_job_id, field_key) DO NOTHING`,
      ).run(reportJobId, fieldKey, String(fieldValue ?? ""), nowIso);
    }
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
  `);

  ensureColumn(db, "report_generation_runs", "provider_code", "ALTER TABLE report_generation_runs ADD COLUMN provider_code TEXT");
  ensureColumn(db, "report_generation_runs", "model_id", "ALTER TABLE report_generation_runs ADD COLUMN model_id TEXT");
  ensureColumn(db, "report_generation_runs", "used_live_model", "ALTER TABLE report_generation_runs ADD COLUMN used_live_model INTEGER");
  ensureColumn(db, "report_generation_runs", "fallback_reason", "ALTER TABLE report_generation_runs ADD COLUMN fallback_reason TEXT");
  ensureColumn(db, "report_generation_runs", "assistant_summary", "ALTER TABLE report_generation_runs ADD COLUMN assistant_summary TEXT");
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

function validateAndroidV2ProductExport(exportPackage) {
  const issues = [];

  if (!exportPackage || typeof exportPackage !== "object") {
    return ["Request body did not contain an export package object."];
  }

  if (exportPackage.packageType !== "v2_product_export") {
    issues.push(`packageType must be "v2_product_export", received "${exportPackage.packageType}".`);
  }

  if (exportPackage.schemaVersion !== 2) {
    issues.push(`schemaVersion must be 2, received ${exportPackage.schemaVersion}.`);
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

  return issues;
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
