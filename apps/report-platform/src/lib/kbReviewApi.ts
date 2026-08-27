import { authenticatedFetch } from "./authClient";

export type KbDatasetSplit = "training" | "validation" | "hidden_test" | "unassigned";
export type KbDatasetAssignment = "automatic" | "explicit";
export type KbCaseStatus = "approved" | "discovered" | "quarantined" | "retired" | "reviewed";
export type KbDocumentRole =
  | "alternate_rendition"
  | "evaluation_gold"
  | "historical_source"
  | "quarantine"
  | "specialist_evidence"
  | "standards_source"
  | "structured_template";
export type KbLaneCode =
  | "evaluation_gold"
  | "fact_recommendation"
  | "historical_case_memory"
  | "quarantine"
  | "specialist_evidence"
  | "standards_guidance"
  | "template_library"
  | "wording_precedent";

export type KbReviewCaseSummary = {
  caseId: string;
  displayName: string;
  reportFamily: string;
  datasetSplit: KbDatasetSplit;
  status: KbCaseStatus;
  documentCount: number;
  pendingDocumentCount: number;
  approvedDocumentCount: number;
  qualityScore: number;
  updatedAtIso: string;
};

export type KbReviewCaseList = {
  summary: { total: number; pending: number; approved: number; quarantined: number };
  cases: KbReviewCaseSummary[];
};

export type KbChunk = {
  chunkId: string;
  blockType: string;
  content: string;
  stableOrder: number;
  pageNumbers: number[];
  sourceBlockIds: string[];
  sourceSpans: Array<{
    sourceBlockId: string;
    pageNumber: number;
    bbox: [number, number, number, number];
  }>;
};

export type KbReviewSection = {
  sectionId: string;
  sectionKey: string;
  originalHeading: string;
  stableOrder: number;
  reviewStatus: "approved" | "pending_review" | "rejected" | "reviewed";
  laneCode: KbLaneCode;
  includeInRetrieval: boolean;
  classificationSource: "automatic" | "manual";
  automaticRetrievalCandidate: boolean;
  qualityWarning: boolean;
  reviewNotes: string;
  reviewedAtIso: string | null;
  chunkCount: number;
  characterCount: number;
  chunks: KbChunk[];
};

export type KbReviewDocument = {
  documentId: string;
  caseId: string;
  fileName: string;
  documentRole: KbDocumentRole;
  datasetSplit: KbDatasetSplit;
  datasetAssignment: KbDatasetAssignment;
  datasetGroupKey: string | null;
  approvalStatus: "approved" | "pending_review" | "rejected" | "retired" | "reviewed";
  retrievalEligible: boolean;
  sourceObjectKey: string | null;
  sourceSha256: string;
  sourceMediaType: string;
  parserName: string | null;
  parserVersion: string | null;
  reviewNotes: string;
  reviewedAtIso: string | null;
  approvedAtIso: string | null;
  quality: {
    status: "failed" | "needs_review" | "passed";
    score: number;
    textPageCoverage: number;
    provenanceCoverage: number;
    headingCount: number;
    tableCount: number;
    issues: Array<{
      issueKey: string;
      code: string;
      severity: "error" | "info" | "warning";
      message: string;
      blockIds: string[];
      pageNumbers: number[];
      review: null | {
        resolution: "accepted" | "needs_correction" | "not_applicable";
        notes: string;
        actorDisplayName: string;
        reviewedAtIso: string;
      };
    }>;
  };
  ingestionRun: null | {
    ingestionRunId: string;
    status: string;
    startedAtIso: string;
    completedAtIso: string | null;
  };
  sections: KbReviewSection[];
  escalations: Array<{
    requestId: string;
    taskCode: string;
    status: string;
    request: Record<string, unknown>;
    annotation: Record<string, unknown> | null;
  }>;
  decisions: Array<{
    decisionId: string;
    action: string;
    actorDisplayName: string;
    notes: string;
    createdAtIso: string;
    sectionId: string | null;
  }>;
};

export type KbReviewCaseDetail = {
  case: {
    caseId: string;
    tenantId: string | null;
    workspaceId: string | null;
    reportFamily: string;
    datasetSplit: KbDatasetSplit;
    status: KbCaseStatus;
    metadata: Record<string, unknown>;
    createdAtIso: string;
    updatedAtIso: string;
  };
  documents: KbReviewDocument[];
};

export type CanonicalReportQueue = {
  generatedAtIso: string;
  sourceRoot: string;
  summary: { reports: number; pending: number; approvedForIngestion: number; quarantined: number; renditionAssets: number };
  reports: Array<{
    groupKey: string;
    reportReference: string | null;
    proposedCanonicalAssetId: string;
    selectedCanonicalAssetId: string;
    selectedRelativePath: string;
    reportFamily: string;
    datasetSplit: KbDatasetSplit;
    assetLineageKey: string | null;
    status: "pending_review" | "approved_for_ingestion" | "quarantined";
    reviewNotes: string;
    reviewedAtIso: string | null;
    renditionCount: number;
    confidence: number;
    assets: Array<{ assetId: string; relativePath: string; fileName: string; extension: string; fileSizeBytes: number; documentVariant: string; score: number }>;
  }>;
};

export async function loadCanonicalReportQueue(): Promise<CanonicalReportQueue> {
  return requestJson("/api/v1/admin/kb-review/canonical-reports");
}

export type CanonicalIngestionStatus = {
  status: "idle" | "running" | "completed" | "completed_with_errors" | "stopped";
  totalReports: number; completedReports: number; remainingReports: number;
  failedReports: number; currentFileName: string | null; sections: number; chunks: number;
  failures: Array<{ fileName: string; stage: string; error: string }>;
  startedAtIso: string | null; updatedAtIso: string | null; completedAtIso: string | null;
  progressPercent: number;
};

export async function loadCanonicalIngestionStatus(): Promise<CanonicalIngestionStatus> {
  return requestJson("/api/v1/admin/kb-review/canonical-reports/ingestion-status", {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
}

export async function reviewCanonicalReportGroup(groupKey: string, values: {
  selectedCanonicalAssetId: string;
  reportFamily: string;
  datasetSplit: KbDatasetSplit;
  assetLineageKey: string;
  status: "pending_review" | "approved_for_ingestion" | "quarantined";
  reviewNotes: string;
}): Promise<CanonicalReportQueue> {
  return requestJson(`/api/v1/admin/kb-review/canonical-reports/${encodeURIComponent(groupKey)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
}

export async function loadKbReviewCases(): Promise<KbReviewCaseList> {
  return requestJson("/api/v1/admin/kb-review/cases");
}

export async function loadKbReviewCase(caseId: string): Promise<KbReviewCaseDetail> {
  return requestJson(`/api/v1/admin/kb-review/cases/${encodeURIComponent(caseId)}`);
}

export async function loadKbSourcePreview(documentId: string): Promise<{
  documentId: string;
  fileName: string;
  mediaType: string;
  readUrl: string;
}> {
  return requestJson(
    `/api/v1/admin/kb-review/documents/${encodeURIComponent(documentId)}/source-url`,
  );
}

export async function saveKbDocumentClassification(
  documentId: string,
  values: {
    datasetSplit: KbDatasetSplit;
    documentRole: KbDocumentRole;
    reportFamily: string;
    reviewNotes: string;
  },
): Promise<KbReviewCaseDetail> {
  return requestJson(`/api/v1/admin/kb-review/documents/${encodeURIComponent(documentId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
}

export async function saveKbSectionClassification(
  sectionId: string,
  values: {
    laneCode: KbLaneCode;
    includeInRetrieval: boolean;
    reviewNotes: string;
  },
): Promise<KbReviewCaseDetail> {
  return requestJson(`/api/v1/admin/kb-review/sections/${encodeURIComponent(sectionId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
}

export async function decideKbDocument(
  documentId: string,
  action: "approve" | "quarantine" | "reject" | "reopen",
  notes: string,
): Promise<KbReviewCaseDetail> {
  return requestJson(
    `/api/v1/admin/kb-review/documents/${encodeURIComponent(documentId)}/decision`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notes }),
    },
  );
}

export async function reviewKbWarning(
  documentId: string,
  issueKey: string,
  values: {
    resolution: "accepted" | "needs_correction" | "not_applicable";
    notes: string;
  },
): Promise<KbReviewCaseDetail> {
  return requestJson(
    `/api/v1/admin/kb-review/documents/${encodeURIComponent(documentId)}/warnings/${encodeURIComponent(issueKey)}/review`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    },
  );
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(url, init);
  if (!response.ok) {
    const body = await response.text();
    try {
      const payload = JSON.parse(body) as { error?: string };
      throw new Error(payload.error || `KB review request failed with HTTP ${response.status}.`);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(body || `KB review request failed with HTTP ${response.status}.`);
      }
      throw error;
    }
  }
  return response.json() as Promise<T>;
}
