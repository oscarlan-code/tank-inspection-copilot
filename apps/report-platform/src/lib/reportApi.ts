import type { ApiReportJobState, ApiSectionChatReply } from "../domain/mockReport";
import type {
  ChatMessage,
  LayoutMapData,
  ReportSection,
  TargetedEditProposal,
  TargetedEditRequest,
  WorkspaceReport,
} from "../domain/types";
import { authenticatedFetch } from "./authClient";

const TARGETED_EDIT_REQUEST_TIMEOUT_MS = 70000;

export class ReportApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, status: number, code = "report_platform_api_error") {
    super(message);
    this.name = "ReportApiError";
    this.code = code;
    this.status = status;
  }
}

export async function saveSectionDraft(
  report: WorkspaceReport,
  section: ReportSection,
  options: { reasonCode?: "draft_save" | "targeted_ai_edit" } = {},
): Promise<ApiReportJobState> {
  const response = await authenticatedFetch(buildSectionUrl(report.apiLinks.saveSectionDraftPath, report.id, section.id), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: section.content,
      generated: section.generated,
      edited: section.edited,
      approved: section.approved,
      reviewRequired: section.reviewRequired,
      expectedVersion: section.version ?? 0,
      reasonCode: options.reasonCode ?? "draft_save",
    }),
  });

  await assertOk(response, "Unable to save section draft.");
  return (await response.json()) as ApiReportJobState;
}

export async function saveManualInputs(
  report: WorkspaceReport,
  section: ReportSection,
): Promise<ApiReportJobState> {
  const values = Object.fromEntries(section.missingFields.map((field) => [field.id, field.value]));
  return saveManualInputValues(report, values);
}

export async function saveManualInputValues(
  report: WorkspaceReport,
  values: Record<string, string>,
): Promise<ApiReportJobState> {
  const response = await authenticatedFetch(buildReportUrl(report.apiLinks.saveManualInputsPath, report.id), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values, expectedRevision: report.manualInputsRevision }),
  });

  await assertOk(response, "Unable to save report-side manual inputs.");
  return (await response.json()) as ApiReportJobState;
}

export async function resetReportDrafts(report: WorkspaceReport): Promise<ApiReportJobState> {
  const response = await authenticatedFetch(buildReportUrl(report.apiLinks.resetDraftsPath, report.id), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  await assertOk(response, "Unable to reset report draft state.");
  return (await response.json()) as ApiReportJobState;
}

export async function saveLayoutOverride(
  report: WorkspaceReport,
  sectionId: string,
  layoutMap: LayoutMapData,
): Promise<ApiReportJobState> {
  const response = await authenticatedFetch(buildSectionUrl(report.apiLinks.saveLayoutOverridePath, report.id, sectionId), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      layoutMap,
      expectedVersion: report.sections.find((section) => section.id === sectionId)?.layoutVersion ?? 0,
    }),
  });

  await assertOk(response, "Unable to save layout override.");
  return (await response.json()) as ApiReportJobState;
}

export async function importFloorCorrosionMfl(
  report: WorkspaceReport,
  sectionId: string,
  file: File,
): Promise<ApiReportJobState> {
  const query = new URLSearchParams({
    sectionId,
    fileName: file.name,
    expectedVersion: String(report.sections.find((section) => section.id === sectionId)?.layoutVersion ?? 0),
  });
  const response = await authenticatedFetch(
    `/api/v1/report-jobs/${encodeURIComponent(report.id)}/floor-corrosion/mfl-import?${query.toString()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
      },
      body: file,
    },
  );

  await assertOk(response, "Unable to import MFL plate maps.");
  return (await response.json()) as ApiReportJobState;
}

export async function importFloorLayoutDrawing(
  report: WorkspaceReport,
  sectionId: string,
  file: File,
  pageNumber: number,
): Promise<ApiReportJobState> {
  const query = new URLSearchParams({
    sectionId,
    fileName: file.name,
    page: String(pageNumber),
    expectedVersion: String(report.sections.find((section) => section.id === sectionId)?.layoutVersion ?? 0),
  });
  const response = await authenticatedFetch(
    `/api/v1/report-jobs/${encodeURIComponent(report.id)}/floor-corrosion/layout-import?${query.toString()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
      },
      body: file,
    },
  );

  await assertOk(response, "Unable to import the original floor layout drawing.");
  return (await response.json()) as ApiReportJobState;
}

export async function approveFloorCorrosionPlacement(
  report: WorkspaceReport,
  sectionId: string,
  placement: {
    scanPlateId: string;
    hostPlateId: string;
    rotationDegrees: 0 | 90 | 180 | 270;
    flipX: boolean;
    flipY: boolean;
    scaleX: number;
    scaleY: number;
    offsetX: number;
    offsetY: number;
    opacity: number;
    approved: boolean;
  },
): Promise<ApiReportJobState> {
  const query = new URLSearchParams({ sectionId });
  const response = await authenticatedFetch(
    `/api/v1/report-jobs/${encodeURIComponent(report.id)}/floor-corrosion/placements?${query.toString()}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...placement,
        expectedVersion: report.sections.find((section) => section.id === sectionId)?.layoutVersion ?? 0,
      }),
    },
  );

  await assertOk(response, "Unable to update MFL plate placement.");
  return (await response.json()) as ApiReportJobState;
}

export async function approveSection(
  report: WorkspaceReport,
  sectionId: string,
  expectedVersion: number,
): Promise<ApiReportJobState> {
  const response = await authenticatedFetch(buildSectionUrl(report.apiLinks.approveSectionPath, report.id, sectionId), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expectedVersion }),
  });

  await assertOk(response, "Unable to approve section.");
  return (await response.json()) as ApiReportJobState;
}

export async function generateSection(
  report: WorkspaceReport,
  sectionId: string,
  userInstruction = "",
): Promise<ApiReportJobState> {
  const response = await authenticatedFetch(buildSectionUrl(report.apiLinks.generateSectionPath, report.id, sectionId), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userInstruction,
      expectedVersion: report.sections.find((section) => section.id === sectionId)?.version ?? 0,
    }),
  });

  await assertOk(response, "Unable to generate report section.");
  return (await response.json()) as ApiReportJobState;
}

export async function sendSectionChat(
  report: WorkspaceReport,
  sectionId: string,
  userPrompt: string,
  conversationHistory: Array<Pick<ChatMessage, "role" | "content" | "controlTrace" | "pendingConfirmation">> = [],
): Promise<ApiSectionChatReply> {
  const response = await authenticatedFetch(buildSectionUrl(report.apiLinks.sectionChatPath, report.id, sectionId), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userPrompt, conversationHistory }),
  });

  await assertOk(response, "Unable to send section chat prompt.");
  return (await response.json()) as ApiSectionChatReply;
}

export async function requestTargetedSectionEdit(
  report: WorkspaceReport,
  sectionId: string,
  request: TargetedEditRequest,
): Promise<TargetedEditProposal> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), TARGETED_EDIT_REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await authenticatedFetch(buildSectionUrl(report.apiLinks.targetedEditPath, report.id, sectionId), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("LAIQ AI did not finish this edit within 70 seconds. The draft was not changed; retry the selection.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  await assertOk(response, "Unable to prepare the targeted edit.");
  return (await response.json()) as TargetedEditProposal;
}

export async function restorePreviousSectionDraft(
  report: WorkspaceReport,
  sectionId: string,
): Promise<ApiReportJobState> {
  const response = await authenticatedFetch(buildSectionUrl(report.apiLinks.restorePreviousSectionPath, report.id, sectionId), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expectedVersion: report.sections.find((section) => section.id === sectionId)?.version ?? 0,
    }),
  });

  await assertOk(response, "Unable to restore previous section draft.");
  return (await response.json()) as ApiReportJobState;
}

export async function downloadFinalReportDocx(
  report: WorkspaceReport,
  sectionIds: string[],
): Promise<void> {
  const response = await authenticatedFetch(buildReportUrl(report.apiLinks.exportDocxPath, report.id), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sectionIds }),
  });

  await assertOk(response, "Unable to export final report DOCX.");
  const blob = await response.blob();
  const filename = getFilenameFromDisposition(response.headers.get("Content-Disposition")) ??
    `${report.reference}-approved-sections.docx`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildReportUrl(template: string, reportJobId: string): string {
  return template.replace(":reportJobId", encodeURIComponent(reportJobId));
}

function buildSectionUrl(template: string, reportJobId: string, sectionId: string): string {
  return buildReportUrl(template, reportJobId).replace(":sectionId", encodeURIComponent(sectionId));
}

async function assertOk(response: Response, fallbackMessage: string): Promise<void> {
  if (response.ok) return;

  const body = await response.text();
  let errorCode = "report_platform_api_error";
  if (body) {
    let payload: { code?: unknown; error?: unknown } | null = null;
    try {
      payload = JSON.parse(body) as { code?: unknown; error?: unknown };
    } catch {
      // Preserve non-JSON backend responses below.
    }
    if (typeof payload?.code === "string" && payload.code.trim()) {
      errorCode = payload.code;
    }
    if (typeof payload?.error === "string" && payload.error.trim()) {
      throw new ReportApiError(payload.error, response.status, errorCode);
    }
  }
  throw new ReportApiError(
    body || `${fallbackMessage} HTTP ${response.status}`,
    response.status,
    errorCode,
  );
}

function getFilenameFromDisposition(disposition: string | null): string | null {
  if (!disposition) return null;

  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return match ? decodeURIComponent(match[1]) : null;
}
