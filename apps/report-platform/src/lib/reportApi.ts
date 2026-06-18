import type { ApiReportJobState, ApiSectionChatReply } from "../domain/mockReport";
import type { LayoutMapData, ReportSection, WorkspaceReport } from "../domain/types";

export async function saveSectionDraft(
  report: WorkspaceReport,
  section: ReportSection,
): Promise<void> {
  const response = await fetch(buildSectionUrl(report.apiLinks.saveSectionDraftPath, report.id, section.id), {
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
    }),
  });

  await assertOk(response, "Unable to save section draft.");
}

export async function saveManualInputs(
  report: WorkspaceReport,
  section: ReportSection,
): Promise<void> {
  const values = Object.fromEntries(section.missingFields.map((field) => [field.id, field.value]));
  const response = await fetch(buildReportUrl(report.apiLinks.saveManualInputsPath, report.id), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });

  await assertOk(response, "Unable to save report-side manual inputs.");
}

export async function resetReportDrafts(report: WorkspaceReport): Promise<ApiReportJobState> {
  const response = await fetch(buildReportUrl(report.apiLinks.resetDraftsPath, report.id), {
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
): Promise<void> {
  const response = await fetch(buildSectionUrl(report.apiLinks.saveLayoutOverridePath, report.id, sectionId), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ layoutMap }),
  });

  await assertOk(response, "Unable to save layout override.");
}

export async function approveSection(
  report: WorkspaceReport,
  sectionId: string,
): Promise<void> {
  const response = await fetch(buildSectionUrl(report.apiLinks.approveSectionPath, report.id, sectionId), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  await assertOk(response, "Unable to approve section.");
}

export async function generateSection(
  report: WorkspaceReport,
  sectionId: string,
  userInstruction = "",
): Promise<ApiReportJobState> {
  const response = await fetch(buildSectionUrl(report.apiLinks.generateSectionPath, report.id, sectionId), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userInstruction }),
  });

  await assertOk(response, "Unable to generate report section.");
  return (await response.json()) as ApiReportJobState;
}

export async function sendSectionChat(
  report: WorkspaceReport,
  sectionId: string,
  userPrompt: string,
  conversationHistory: Array<{ role: string; content: string }> = [],
): Promise<ApiSectionChatReply> {
  const response = await fetch(buildSectionUrl(report.apiLinks.sectionChatPath, report.id, sectionId), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userPrompt, conversationHistory }),
  });

  await assertOk(response, "Unable to send section chat prompt.");
  return (await response.json()) as ApiSectionChatReply;
}

export async function downloadFinalReportDocx(
  report: WorkspaceReport,
  sectionIds: string[],
): Promise<void> {
  const response = await fetch(buildReportUrl(report.apiLinks.exportDocxPath, report.id), {
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
  throw new Error(body || `${fallbackMessage} HTTP ${response.status}`);
}

function getFilenameFromDisposition(disposition: string | null): string | null {
  if (!disposition) return null;

  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return match ? decodeURIComponent(match[1]) : null;
}
