import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError, createReportStore } from "./store.mjs";
import { buildApiStandardFixturePackage } from "./api-standard-fixture.mjs";
import { buildFinalReportDocx } from "./docx-export.mjs";
import {
  buildPrecedentAudit,
  getPrecedentKbStatus,
  rebuildPrecedentKbIndex,
  searchPrecedentPack,
} from "./precedent-kb.mjs";
import {
  buildFactRecommendationAudit,
  getFactRecommendationKbStatus,
  rebuildFactRecommendationKbIndex,
  searchFactRecommendationPairs,
} from "./fact-recommendation-kb.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const appRoot = join(__dirname, "..");
const fixturePath = join(appRoot, "src", "fixtures", "v3-product-export-shell-internal.json");
const databasePath = process.env.REPORT_PLATFORM_DB_PATH || join(appRoot, ".data", "report-platform.sqlite");
const port = Number(process.env.REPORT_PLATFORM_API_PORT || 8788);
const host = process.env.REPORT_PLATFORM_API_HOST || "0.0.0.0";
const bootstrapKey = "api-standard-v10";
const bootstrapPaths = new Set([
  "/api/v1/report-jobs/bootstrap/v10-api-standard",
  // Backward-compatible alias for any running UI opened before the V10 fixture was promoted.
  "/api/v1/report-jobs/bootstrap/shell-internal",
]);

const reportStore = createReportStore({ dbFilePath: databasePath });
const fixtureExportPackage = buildApiStandardFixturePackage(JSON.parse(readFileSync(fixturePath, "utf8")));
const seededState = reportStore.ensureSeedReport({
  bootstrapKey,
  exportPackage: fixtureExportPackage,
});

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const { pathname } = requestUrl;

    if (request.method === "OPTIONS") {
      writeJson(response, 204, {});
      return;
    }

    if (request.method === "GET" && pathname === "/api/health") {
      writeJson(response, 200, {
        ok: true,
        seededReportJobId: seededState?.reportJob?.reportJobId ?? null,
        precedentKb: getPrecedentKbStatus(),
        factRecommendationKb: getFactRecommendationKbStatus(),
        ...reportStore.getHealth(),
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/knowledge-base/precedent/status") {
      writeJson(response, 200, getPrecedentKbStatus());
      return;
    }

    if (request.method === "POST" && pathname === "/api/v1/knowledge-base/precedent/rebuild") {
      const index = rebuildPrecedentKbIndex();
      writeJson(response, 200, {
        builtAtIso: index.builtAtIso,
        sampleReportsDir: index.sampleReportsDir,
        documentCount: index.documents.length,
        pageCount: index.pageCount,
        chunkCount: index.chunks.length,
        errorCount: index.errors.length,
        errors: index.errors,
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/knowledge-base/precedent/search") {
      const sectionId = requestUrl.searchParams.get("sectionId") ?? "inspection-report";
      const state = seededState?.reportJob?.reportJobId
        ? reportStore.loadReportJobState(seededState.reportJob.reportJobId)
        : null;

      writeJson(response, 200, searchPrecedentPack({
        sectionId,
        reportState: state,
      }));
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/knowledge-base/precedent/audit") {
      const state = seededState?.reportJob?.reportJobId
        ? reportStore.loadReportJobState(seededState.reportJob.reportJobId)
        : null;

      writeJson(response, 200, buildPrecedentAudit({
        reportState: state,
      }));
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/knowledge-base/recommendations/status") {
      writeJson(response, 200, getFactRecommendationKbStatus());
      return;
    }

    if (request.method === "POST" && pathname === "/api/v1/knowledge-base/recommendations/rebuild") {
      const index = rebuildFactRecommendationKbIndex();
      writeJson(response, 200, {
        builtAtIso: index.builtAtIso,
        sourceChunkCount: index.sourceChunkCount,
        sourceDocumentCount: index.sourceDocumentCount,
        pairCount: index.pairCount,
        actionTagCounts: index.actionTagCounts,
        componentTagCounts: index.componentTagCounts,
        errorCount: index.errors.length,
        errors: index.errors,
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/knowledge-base/recommendations/search") {
      const sectionId = requestUrl.searchParams.get("sectionId") ?? "repair-recommendations";
      const state = seededState?.reportJob?.reportJobId
        ? reportStore.loadReportJobState(seededState.reportJob.reportJobId)
        : null;
      writeJson(response, 200, searchFactRecommendationPairs({
        reportState: state,
        sectionId,
        limit: Number(requestUrl.searchParams.get("limit") ?? 24),
      }));
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/knowledge-base/recommendations/audit") {
      const state = seededState?.reportJob?.reportJobId
        ? reportStore.loadReportJobState(seededState.reportJob.reportJobId)
        : null;
      writeJson(response, 200, buildFactRecommendationAudit({
        reportState: state,
      }));
      return;
    }

    if (
      request.method === "GET" &&
      (
        pathname === "/api/v1/exports/android-v2-product/v10-api-standard.json" ||
        pathname === "/api/v1/exports/android-v3-product/v10-api-standard.json"
      )
    ) {
      const state = reportStore.loadBootstrapReport(bootstrapKey);
      writeJson(response, 200, state?.exportPackage ?? fixtureExportPackage);
      return;
    }

    if (request.method === "GET" && bootstrapPaths.has(pathname)) {
      const state = reportStore.loadBootstrapReport(bootstrapKey);
      if (!state) {
        writeJson(response, 404, { error: "Bootstrap report job not found." });
        return;
      }

      writeJson(response, 200, state);
      return;
    }

    if (
      request.method === "POST" &&
      (
        pathname === "/api/v1/imports/android-v2-product" ||
        pathname === "/api/v1/imports/android-v3-product"
      )
    ) {
      const body = await readJsonBody(request);
      const exportPackage = body.exportPackage ?? body.package ?? body;
      const manualSupplementOverrides = body.manualSupplement ?? {};
      const state = reportStore.importAndroidV2ProductExport({
        exportPackage,
        manualSupplementOverrides,
      });

      writeJson(response, 201, state);
      return;
    }

    const reportJobPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)$/);
    if (request.method === "GET" && reportJobPath) {
      const reportJobId = decodeURIComponent(reportJobPath[1]);
      const state = reportStore.loadReportJobState(reportJobId);
      if (!state) {
        writeJson(response, 404, { error: `Report job ${reportJobId} was not found.` });
        return;
      }

      writeJson(response, 200, state);
      return;
    }

    const evalRunsPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/evals$/);
    if (request.method === "GET" && evalRunsPath) {
      const reportJobId = decodeURIComponent(evalRunsPath[1]);
      writeJson(response, 200, {
        reportJobId,
        evalRuns: reportStore.loadEvalRuns(reportJobId),
      });
      return;
    }

    const sectionEvalPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/sections\/([^/]+)\/evals\/latest$/);
    if (request.method === "GET" && sectionEvalPath) {
      const reportJobId = decodeURIComponent(sectionEvalPath[1]);
      const sectionId = decodeURIComponent(sectionEvalPath[2]);
      const evalRun = reportStore.loadLatestEvalRun(reportJobId, sectionId);
      if (!evalRun) {
        writeJson(response, 404, { error: `No eval run found for ${sectionId}.` });
        return;
      }

      writeJson(response, 200, evalRun);
      return;
    }

    const manualInputsPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/manual-inputs$/);
    if (request.method === "PATCH" && manualInputsPath) {
      const reportJobId = decodeURIComponent(manualInputsPath[1]);
      const body = await readJsonBody(request);
      const state = reportStore.saveManualInputs(reportJobId, body.values ?? {});
      writeJson(response, 200, state);
      return;
    }

    const resetDraftsPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/reset-drafts$/);
    if (request.method === "POST" && resetDraftsPath) {
      const reportJobId = decodeURIComponent(resetDraftsPath[1]);
      const state = reportStore.resetReportDrafts(reportJobId);
      writeJson(response, 200, state);
      return;
    }

    const sectionPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/sections\/([^/]+)$/);
    if (request.method === "PATCH" && sectionPath) {
      const reportJobId = decodeURIComponent(sectionPath[1]);
      const sectionId = decodeURIComponent(sectionPath[2]);
      const body = await readJsonBody(request);
      const state = reportStore.saveSectionDraft(reportJobId, sectionId, body);
      writeJson(response, 200, state);
      return;
    }

    const generatePath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/sections\/([^/]+)\/generate$/);
    if (request.method === "POST" && generatePath) {
      const reportJobId = decodeURIComponent(generatePath[1]);
      const sectionId = decodeURIComponent(generatePath[2]);
      const body = await readJsonBody(request);
      const state = await reportStore.generateSection(reportJobId, sectionId, {
        actorUserId: body.actorUserId,
        userInstruction: body.userInstruction ?? body.instruction ?? "",
      });
      writeJson(response, 200, state);
      return;
    }

    const chatPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/sections\/([^/]+)\/chat$/);
    if (request.method === "POST" && chatPath) {
      const reportJobId = decodeURIComponent(chatPath[1]);
      const sectionId = decodeURIComponent(chatPath[2]);
      const body = await readJsonBody(request);
      const reply = await reportStore.replyToSectionChat(reportJobId, sectionId, {
        userPrompt: body.userPrompt ?? body.prompt ?? "",
        conversationHistory: body.conversationHistory ?? body.history ?? [],
      });
      writeJson(response, 200, reply);
      return;
    }

    const restoreSectionPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/sections\/([^/]+)\/restore-previous$/);
    if (request.method === "POST" && restoreSectionPath) {
      const reportJobId = decodeURIComponent(restoreSectionPath[1]);
      const sectionId = decodeURIComponent(restoreSectionPath[2]);
      const body = await readJsonBody(request);
      const state = reportStore.restorePreviousSectionDraft(reportJobId, sectionId, body ?? {});
      writeJson(response, 200, state);
      return;
    }

    const layoutOverridePath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/layout-overrides\/([^/]+)$/);
    if (request.method === "PATCH" && layoutOverridePath) {
      const reportJobId = decodeURIComponent(layoutOverridePath[1]);
      const sectionId = decodeURIComponent(layoutOverridePath[2]);
      const body = await readJsonBody(request);
      const state = reportStore.saveLayoutOverride(reportJobId, sectionId, body.layoutMap);
      writeJson(response, 200, state);
      return;
    }

    const approvePath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/sections\/([^/]+)\/approve$/);
    if (request.method === "POST" && approvePath) {
      const reportJobId = decodeURIComponent(approvePath[1]);
      const sectionId = decodeURIComponent(approvePath[2]);
      const body = await readJsonBody(request);
      const state = reportStore.approveSection(reportJobId, sectionId, body ?? {});
      writeJson(response, 200, state);
      return;
    }

    const docxExportPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/exports\/final-report\.docx$/);
    if ((request.method === "GET" || request.method === "POST") && docxExportPath) {
      const reportJobId = decodeURIComponent(docxExportPath[1]);
      const state = reportStore.loadReportJobState(reportJobId);
      if (!state) {
        writeJson(response, 404, { error: `Report job ${reportJobId} was not found.` });
        return;
      }

      const body = request.method === "POST" ? await readJsonBody(request) : {};
      let exportResult;
      try {
        exportResult = await buildFinalReportDocx(state, {
          sectionIds: Array.isArray(body.sectionIds) ? body.sectionIds : [],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to export DOCX.";
        const statusCode = /select at least one approved section/i.test(message) ? 400 : 500;
        writeJson(response, statusCode, {
          error: statusCode === 400 ? message : "Unable to export DOCX.",
          code: statusCode === 400 ? "no_approved_sections_selected" : "docx_export_failed",
        });
        return;
      }
      writeBinary(response, 200, exportResult.buffer, {
        "Content-Disposition": `attachment; filename="${exportResult.filename}"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "X-LAIQ-Approved-Sections": String(exportResult.approvalSummary.approvedCount),
        "X-LAIQ-Exported-Sections": String(exportResult.approvalSummary.exportedCount),
        "X-LAIQ-Pending-Sections": String(exportResult.approvalSummary.pendingCount),
      });
      return;
    }

    writeJson(response, 404, { error: `Route not found: ${request.method} ${pathname}` });
  } catch (error) {
    if (error instanceof ApiError) {
      writeJson(response, error.statusCode, {
        error: error.message,
        code: error.code,
      });
      return;
    }

    console.error(error);
    writeJson(response, 500, {
      error: "Unexpected API failure.",
      code: "unexpected_api_failure",
    });
  }
});

server.listen(port, host, () => {
  console.log(`Report platform API listening on http://${host}:${port}`);
  console.log(`Seeded report job: ${seededState?.reportJob?.reportJobId ?? "unknown"}`);
});

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function writeJson(response, statusCode, payload) {
  const body = statusCode === 204 ? "" : JSON.stringify(payload);

  response.writeHead(statusCode, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(body);
}

function writeBinary(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Origin": "*",
    ...headers,
  });
  response.end(payload);
}
