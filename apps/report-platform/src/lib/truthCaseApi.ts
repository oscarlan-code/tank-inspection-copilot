import { authenticatedFetch } from "./authClient";

export type TruthCaseStatus =
  | "source_approved"
  | "truth_extracting"
  | "truth_review_required"
  | "case_approved"
  | "retired"
  | "quarantined";

export type TruthFactReviewStatus =
  | "machine_proposed"
  | "human_reviewed"
  | "approved"
  | "rejected";

export type AnswerabilityClass =
  | "app_observable"
  | "voice_observable"
  | "report_side_input"
  | "deterministic_derived"
  | "precedent_template"
  | "standards_guidance"
  | "engineering_judgment"
  | "gold_only_unobservable";

export type TruthCaseSource = {
  documentId: string;
  sourceCaseId: string;
  displayName: string;
  reportFamily: string;
  documentRole: string;
  datasetSplit: "training" | "validation" | "hidden_test";
  sourceSha256: string;
  sourceStored: boolean;
  sectionCount: number;
  chunkCount: number;
  evidenceAsOfCandidate: string | null;
  approvedAtIso: string | null;
  truthCaseId: string | null;
  truthCaseStatus: TruthCaseStatus | null;
};

export type TruthCaseSummary = {
  truthCaseId: string;
  snapshotId: string;
  goldDocumentId: string;
  displayName: string;
  reportFamily: string;
  datasetSplit: string;
  benchmarkTrack: string;
  evidenceAsOf: string;
  status: TruthCaseStatus;
  truthGraphVersion: number;
  truthGraphSha256: string | null;
  factCount: number;
  proposedCount: number;
  reviewedCount: number;
  approvedCount: number;
  rejectedCount: number;
  updatedAtIso: string;
};

export type TruthFact = {
  factId: string;
  truthCaseId: string;
  factType: string;
  sectionKey: string;
  normalizedValue: { text?: string; sourceHeading?: string; sourceBlockType?: string } | unknown;
  unitCode: string | null;
  sourceDocumentId: string;
  sourcePageNumber: number | null;
  sourceBlockIds: string[];
  sourceBbox: [number, number, number, number] | null;
  sourceConfidence: number;
  evidenceClass: string;
  captureDestination: string | null;
  safetyCriticality: "low" | "medium" | "high" | "critical";
  reviewStatus: TruthFactReviewStatus;
  answerabilityClass: AnswerabilityClass;
  requiredFact: boolean;
  expectedGeneratorBehavior: string;
  answerabilityReviewStatus: TruthFactReviewStatus;
  reviewedAtIso: string | null;
  updatedAtIso: string;
};

export type TruthCaseDetail = {
  truthCase: TruthCaseSummary;
  sourceDocument: {
    documentId: string;
    sourceCaseId: string;
    displayName: string;
    reportFamily: string;
    documentRole: string;
    datasetSplit: string;
    sourceSha256: string;
    sourceObjectKey: string;
  } | null;
  sources: Array<{
    documentId: string;
    sourceRole: string;
    sourceSha256: string;
    sourceObjectKey: string;
  }>;
  facts: TruthFact[];
  summary: { total: number; proposed: number; reviewed: number; approved: number; rejected: number };
};

export type TruthCaseBuilderState = {
  generatedAtIso: string;
  summary: {
    approvedSources: number;
    truthCases: number;
    reviewRequired: number;
    approvedTruthCases: number;
  };
  sources: TruthCaseSource[];
  truthCases: TruthCaseSummary[];
};

export type TruthFactReviewInput = {
  factType: string;
  sectionKey: string;
  normalizedValue: unknown;
  unitCode: string | null;
  evidenceClass: string;
  captureDestination: string | null;
  safetyCriticality: TruthFact["safetyCriticality"];
  answerabilityClass: AnswerabilityClass;
  requiredFact: boolean;
  expectedGeneratorBehavior: string;
  reviewStatus: TruthFactReviewStatus;
};

export async function loadTruthCaseBuilder(): Promise<TruthCaseBuilderState> {
  return requestJson("/api/v1/admin/truth-cases");
}

export async function loadTruthCase(truthCaseId: string): Promise<TruthCaseDetail> {
  return requestJson(`/api/v1/admin/truth-cases/${encodeURIComponent(truthCaseId)}`);
}

export async function createTruthCase(values: {
  documentId: string;
  evidenceAsOf?: string;
  benchmarkTrack?: "operational_history" | "asset_generalization";
  assetLineageKey?: string | null;
}): Promise<TruthCaseDetail> {
  return requestJson("/api/v1/admin/truth-cases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
}

export async function proposeTruthCaseFacts(truthCaseId: string): Promise<TruthCaseDetail> {
  return requestJson(`/api/v1/admin/truth-cases/${encodeURIComponent(truthCaseId)}/proposals`, {
    method: "POST",
  });
}

export async function reviewTruthFact(
  truthCaseId: string,
  factId: string,
  values: TruthFactReviewInput,
): Promise<TruthCaseDetail> {
  return requestJson(
    `/api/v1/admin/truth-cases/${encodeURIComponent(truthCaseId)}/facts/${encodeURIComponent(factId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    },
  );
}

export async function approveTruthCase(truthCaseId: string): Promise<TruthCaseDetail> {
  return requestJson(`/api/v1/admin/truth-cases/${encodeURIComponent(truthCaseId)}/approve`, {
    method: "POST",
  });
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error === "string"
      ? payload.error
      : `Truth Case request failed with HTTP ${response.status}.`;
    throw new Error(message);
  }
  return payload as T;
}
