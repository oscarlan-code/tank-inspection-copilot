export type SystemRlArmStatus = {
  armId: string;
  armKey: string;
  displayName: string;
  description: string;
  enabled: boolean;
  configuration: {
    precedentMinimumScore: number;
    precedentLimit: number;
    wordingLimit: number;
    standardsLimit: number;
    factRecommendationLimit: number;
    promptVariant: string;
    agentRoute: string;
  };
  eligibleEpisodeCount: number;
  meanReward: number | null;
  hardFailureCount: number;
  lastReward: number | null;
};

export type SystemRlPolicyStatus = {
  policyVersionId: string;
  versionNumber: number;
  displayName: string;
  statusCode: "archived" | "production" | "training";
  algorithmCode: string;
  explorationCoefficient: number;
  promotionGate: {
    minimumEpisodes: number;
    minimumMeanReward: number;
    maximumHardFailures: number;
    minimumHumanReviewedEpisodes: number;
    metricThresholds: Partial<Record<
      | "retrievalPrecisionAtK"
      | "retrievalRecallAtK"
      | "claimPrecision"
      | "requiredFactRecall",
      number
    >>;
  };
  aggregate: {
    eligibleEpisodeCount: number;
    meanReward: number | null;
    hardFailureCount: number;
  };
  arms: SystemRlArmStatus[];
  evaluationMetrics: {
    eligibleEpisodeCount: number;
    humanReviewedEpisodeCount: number;
    weaklySupervisedEpisodeCount: number;
    means: Record<string, number | null>;
    observations: Record<string, number>;
    metricSchemaVersion: number;
  };
};

export type SystemRlStatus = {
  policyKey: string;
  learningBoundary: {
    goldContentInPolicyState: boolean;
    liveExploration: boolean;
    offlineRewardsUpdateCandidateOnly: boolean;
    productionPromotionRequiresSuperAdmin: boolean;
  };
  policies: SystemRlPolicyStatus[];
};

export type SystemRlHeldOutReview = {
  available: boolean;
  reason?: string;
  evalRunId?: string;
  evaluationCaseId?: string;
  datasetSplit?: string;
  reportName?: string;
  goldDocumentId?: string;
  sectionId?: string;
  sourcePageNumber?: number;
  allSectionsComplete?: boolean;
  sections?: Array<{ evaluationCaseId: string; reportName: string; sectionId: string; completed: boolean; outcomeCode: string | null; hardFailure: boolean }>;
  previousEvaluationCaseId?: string | null;
  previousSectionId?: string | null;
  nextEvaluationCaseId?: string | null;
  nextSectionId?: string | null;
  generatedContent?: string;
  originalSectionContent?: string;
  originalFacts?: Array<{ factId: string; factType: string; value: unknown; unitCode: string | null; evidenceClass: string; safetyCriticality: string; required: boolean }>;
  metrics?: { score: number; outcomeCode: string; requiredFactRecall: number | null; claimPrecision: number | null; protectedFactAccuracy: number | null; formatMatch: number | null; professionalAcceptability: number | null; goldContentCoverage: number | null; outputLengthBalance: number | null; hardFailure: boolean; hardFailureReasons: string[]; automatedReview?: { verdict: string; assessment: string; reasons: string[] }; evaluationPoints: Array<{ key: string; label: string; score: number; statusCode: string; notes?: string[] }> };
  promotionGate?: { eligible: boolean; reasons: string[]; sectionCount: number; passedSectionCount: number; thresholds: { requiredFactRecall: number; claimPrecision: number; protectedFactAccuracy: number } };
  createdAtIso?: string;
};

export async function loadSystemRlStatus(): Promise<SystemRlStatus> {
  return requestJson<SystemRlStatus>("/api/v1/admin/system-rl/status");
}

export async function loadSystemRlHeldOutReview(evaluationCaseId?: string, sectionId?: string): Promise<SystemRlHeldOutReview> {
  const query = new URLSearchParams();
  if (evaluationCaseId) query.set("evaluationCaseId", evaluationCaseId);
  if (sectionId) query.set("sectionId", sectionId);
  return requestJson<SystemRlHeldOutReview>(`/api/v1/admin/system-rl/held-out-review${query.size ? `?${query}` : ""}`);
}

export async function openSystemRlHeldOutSection(evaluationCaseId: string, sectionId: string): Promise<SystemRlHeldOutReview> {
  return requestJson<SystemRlHeldOutReview>("/api/v1/admin/system-rl/held-out-section", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ evaluationCaseId, sectionId }),
  });
}

export async function runSystemRlHeldOutTest(documentId: string) {
  return requestJson("/api/v1/admin/system-rl/held-out-test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentId }),
  });
}

export async function promoteSystemRlPolicy(policyVersionId: string, reason: string) {
  return requestJson(`/api/v1/admin/system-rl/policies/${encodeURIComponent(policyVersionId)}/promote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

export async function rollbackSystemRlPolicy(policyVersionId: string, reason: string) {
  return requestJson(`/api/v1/admin/system-rl/policies/${encodeURIComponent(policyVersionId)}/rollback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

async function requestJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : `Request failed with HTTP ${response.status}.`;
    throw new Error(message);
  }
  return payload as T;
}
