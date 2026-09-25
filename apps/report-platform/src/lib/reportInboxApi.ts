import type { ApiReportJobState } from "../domain/mockReport";
import { authenticatedFetch } from "./authClient";

export type ReportInboxItem = {
  reportJobId: string;
  inspectionId: string;
  reportReference: string;
  title: string;
  client: string;
  tank: string;
  inspectedDate: string;
  statusCode: string;
  tenantName: string;
  workspaceName: string;
  createdByDisplayName: string | null;
  updatedAtIso: string;
  isDemo: boolean;
  sourceRevision: {
    packageSha256: string;
    revisionNumber: number;
    storageStatus: "legacy" | "stored";
  };
};

export async function loadReportInbox(): Promise<ReportInboxItem[]> {
  const response = await authenticatedFetch("/api/v1/report-jobs");
  await assertOk(response, "Unable to load reports from the LAIQ inspection app.");
  return ((await response.json()) as { reportJobs: ReportInboxItem[] }).reportJobs;
}

export async function loadReportJob(reportJobId: string): Promise<ApiReportJobState> {
  const response = await authenticatedFetch(`/api/v1/report-jobs/${encodeURIComponent(reportJobId)}`);
  await assertOk(response, "Unable to open this report job.");
  return response.json() as Promise<ApiReportJobState>;
}

async function assertOk(response: Response, fallback: string) {
  if (response.ok) return;
  const text = await response.text();
  try {
    const payload = JSON.parse(text) as { error?: string };
    throw new Error(payload.error || fallback);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(text || fallback);
    throw error;
  }
}
