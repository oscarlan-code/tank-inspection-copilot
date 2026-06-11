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
): Promise<ApiSectionChatReply> {
  const response = await fetch(buildSectionUrl(report.apiLinks.sectionChatPath, report.id, sectionId), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userPrompt }),
  });

  await assertOk(response, "Unable to send section chat prompt.");
  return (await response.json()) as ApiSectionChatReply;
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
