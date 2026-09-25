import { authenticatedFetch } from "./authClient";

export type EvaluationLabDocument = {
  documentId: string;
  caseId: string;
  displayName: string;
  reportFamily: string;
  documentRole: string;
  datasetSplit: string;
  purpose: "evaluation_gold" | "training_reference";
  readiness: "needs_app_package" | "ready" | "reference_only";
  retrievalEligible: boolean;
  sourceSha256: string;
  sourceStored: boolean;
  ingestionRunId: string | null;
  ingestionStatus: string | null;
  qualityScore: number;
  sectionCount: number;
  chunkCount: number;
  approvedAtIso: string | null;
  evaluationCaseId: string | null;
};

export type EvaluationLabAppPackage = {
  reportJobId: string;
  importId: string;
  inspectionId: string;
  reportReference: string;
  title: string;
  client: string;
  tank: string;
  inspectedDate: string;
  tenantId: string;
  workspaceId: string;
  packageType: string;
  schemaVersion: number;
  packageSha256: string;
  revisionNumber: number;
  sourceSha256: string;
  sourceStorageStatus: "stored";
  exportedAtIso: string;
};

export type EvaluationLabCase = {
  evaluationCaseId: string;
  goldDocumentId: string;
  displayName: string;
  reportFamily: string;
  inputInspectionId: string;
  datasetSplit: string;
  labelStatus: string;
  configuration: Record<string, unknown>;
  reportJobId: string | null;
  reportReference: string | null;
  profileCode: string;
  profileDisplayName: string;
  deterministicSeed: number;
  packageSha256: string | null;
  sourceStorageStatus: string | null;
  enabledSectionCount: number;
  evalRunCount: number;
  blockedEpisodeCount: number;
  qualityIssueCount: number;
  meanScore: number | null;
  meanReward: number | null;
  meanRequiredFactRecall: number | null;
  meanClaimPrecision: number | null;
  meanProtectedFactAccuracy: number | null;
  latestEvalAtIso: string | null;
  nextSectionId: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type EvaluationLabState = {
  generatedAtIso: string;
  summary: {
    approvedKbDocuments: number;
    trainingReferences: number;
    evaluationGoldDocuments: number;
    realStoredAppPackages: number;
    linkedEvaluationCases: number;
    completedEvaluationRuns: number;
  };
  documents: EvaluationLabDocument[];
  appPackages: EvaluationLabAppPackage[];
  evaluationCases: EvaluationLabCase[];
};

export async function loadEvaluationLab(): Promise<EvaluationLabState> {
  return requestJson("/api/v1/admin/evaluation-lab");
}

export async function linkEvaluationCase(
  goldDocumentId: string,
  reportJobId: string,
): Promise<EvaluationLabState> {
  return requestJson("/api/v1/admin/evaluation-lab/cases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goldDocumentId, reportJobId }),
  });
}

export async function runNextEvaluationEpisode(evaluationCase: EvaluationLabCase): Promise<void> {
  if (!evaluationCase.reportJobId || !evaluationCase.nextSectionId) return;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 150_000);
  try {
    await requestJson("/api/v1/admin/system-rl/episodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evaluationCaseId: evaluationCase.evaluationCaseId,
        reportJobId: evaluationCase.reportJobId,
        sectionId: evaluationCase.nextSectionId,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("The evaluation worker did not finish within 150 seconds. The saved queue is safe; refresh to retry this episode.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error === "string"
      ? payload.error
      : `Evaluation Lab request failed with HTTP ${response.status}.`;
    throw new Error(message);
  }
  return payload as T;
}
