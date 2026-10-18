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

export type AgentMonitoringStatus = "passed" | "blocked" | "awaiting" | "not_applicable";

export type AgentRuleEvaluation = {
  ruleId: string;
  ruleVersion?: string | null;
  description?: string | null;
  verdict: "pass" | "fail" | "not_available" | "not_applicable";
  observed?: unknown;
  operator?: "eq" | "gte" | "lte" | "exists" | "all" | "none" | null;
  expected?: unknown;
  evidenceRefs?: string[];
  explanation?: string | null;
};

export type AgentGraderIdentity = {
  type: "deterministic" | "llm" | "human";
  id: string;
  version?: string | null;
  modelId?: string | null;
  rubricSha256?: string | null;
};

export type AgentPipelineTraceRef = {
  name: string;
  sha256?: string | null;
  sourceSha256?: string | null;
  artifactId?: string | null;
  kind?: string | null;
  schemaVersion?: string | null;
  byteLength?: number | null;
  visibility?: string | null;
  redactionStatus?: string | null;
  preview?: unknown;
  previewTruncated?: boolean;
};

export type AgentPipelineTraceSpan = {
  spanId: string;
  parentSpanId: string | null;
  phase: string;
  sectionId: string | null;
  actor: {
    kind: "agent" | "deterministic_control" | "human_control";
    role: string;
    id: string;
    releaseVersion?: string;
    manifestSha256?: string;
    configurationId?: string;
    configurationSha256?: string;
  };
  status: AgentMonitoringStatus;
  startedAtIso: string;
  completedAtIso: string | null;
  durationMs: number | null;
  inputRefs: AgentPipelineTraceRef[];
  outputRefs: AgentPipelineTraceRef[];
  decision: {
    code: string;
    summary: string;
    blockers?: string[];
    warnings?: string[];
  } | null;
  counts: Record<string, number>;
  model: {
    providerCode: string;
    modelId: string | null;
    liveModelUsed: boolean;
  } | null;
  retrieval: {
    mode: string;
    keys: string[];
  } | null;
  outcomes?: {
    execution: {
      status: "completed" | "failed" | "pending" | "not_run";
      explanation: string;
    };
    gate: {
      status: "passed" | "blocked" | "pending" | "not_applicable";
      explanation: string;
    };
    quality: {
      status: "passed" | "failed" | "not_measured" | "not_applicable";
      explanation: string;
    };
  };
  configuration?: Record<string, unknown> | null;
  ruleEvaluations?: AgentRuleEvaluation[];
  grader?: AgentGraderIdentity | null;
  runtime?: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
    retryCount?: number | null;
    attempt?: number | null;
    attemptCount?: number | null;
    tokenStatus?: string | null;
    costUsd?: number | null;
    providerRequestId?: string | null;
  } | null;
  toolCalls?: Array<{
    name: string;
    status: string;
    argumentsPreview?: unknown;
    resultPreview?: unknown;
    durationMs?: number | null;
    error?: string | null;
  }>;
  error?: { code?: string | null; message: string } | null;
};

export type AgentPipelineTrace = {
  contractVersion: "agent_pipeline_trace_v1";
  traceId: string;
  evaluationCaseId: string;
  datasetSplit: string;
  reportProfileId: string;
  executionMode: string;
  startedAtIso: string;
  completedAtIso: string;
  durationMs: number;
  spans: AgentPipelineTraceSpan[];
};

export type AgentEvidenceTraceSection = {
  sectionId: string;
  projectedRecordCount: number;
  usedRecordCount: number;
  issueCount: number;
  accountability: {
    status: string;
    accounted: number | null;
    total: number;
    counts: Record<string, number>;
    reason?: string;
  };
  records: Array<{
    evidenceId: string;
    sourceClass: string;
    sourcePointer: string;
    usedInGeneration: boolean;
    issueCount: number;
    generationDisposition: string | null;
    label?: string | null;
    preview?: unknown;
    redactionStatus?: string | null;
  }>;
  claimLinks: Array<{
    claimId: string;
    sourceRecordIds: string[];
    routedEvidenceIds: string[];
  }>;
  atomicLineage?: {
    contractVersion: string;
    caseId: string;
    qualification: string;
    segmentationPolicy: string;
    counts: {
      source: number;
      evidence: number;
      generated: number;
      passedLinks: number;
      failedLinks: number;
    };
    units: Array<{
      unitId: string;
      layer: "source" | "evidence" | "generated";
      unitType: string;
      semanticKey: string;
      criticality: string;
      contentPreview: string | null;
      protectedFactCount: number;
    }>;
    links: Array<{
      linkId: string;
      stage: "source_to_mock" | "mock_to_generation";
      fromUnitIds: string[];
      toUnitIds: string[];
      relation: string;
      verdict: "pass" | "fail" | "not_available" | "not_applicable";
      explanation: string;
    }>;
  };
};

export type AgentEvidenceTrace = {
  contractVersion: "agent_evidence_trace_v1";
  router: {
    total: number;
    routed: number;
    excluded: number;
    unresolved: number;
    dispositionCoverage: number;
  };
  sections: AgentEvidenceTraceSection[];
};

export type SectionAgentEvaluationMatrixRow = {
  metricId: string;
  label: string;
  sectionId: string | null;
  phase: string;
  class: "hard_gate" | "quality" | "diagnostic";
  status: "pass" | "fail" | "not_available" | "not_applicable";
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  criterion: { operator: "eq" | "gte" | "lte"; value: number } | null;
  unit: string;
  sourceSpanIds: string[];
  evidenceRefs: string[];
  notes: string[];
  ruleEvaluations?: AgentRuleEvaluation[];
  grader?: AgentGraderIdentity | null;
};

export type SectionAgentEvaluationMatrix = {
  contractVersion: "section_agent_evaluation_matrix_v1";
  evaluationCaseId: string;
  traceId: string;
  policy: {
    hardGateRule: string;
    scoreRule: string;
  };
  outcomes: {
    runValidity: string;
    displayDecision: string;
    qualificationDecision: string;
    promotionDecision: string;
  };
  summary: {
    hardGateCount: number;
    hardGatePassed: number;
    hardGateFailed: number;
    hardGateUnavailable: number;
    qualityMeasured: number;
    qualityUnavailable: number;
  };
  rows: SectionAgentEvaluationMatrixRow[];
};

export type AgentControlPlane = {
  contractVersion: "agent_control_plane_snapshot_v1";
  executionMode: string;
  productEnabled: boolean;
  promotionPerformed: boolean;
  approvalStatus: string;
  monitoringCoverage: {
    actualAgentSpans: number;
    unmonitoredActualAgents: number;
    supportedAgentRoles: string[];
    notRunInThisCase: string[];
  };
  outcomes: SectionAgentEvaluationMatrix["outcomes"];
  controls: Array<{
    spanId: string;
    role: string;
    id: string;
    status: AgentMonitoringStatus;
  }>;
  bindings: Array<{
    spanId: string;
    sectionId: string | null;
    role: string;
    id: string;
    releaseVersion: string;
    manifestSha256: string;
    configurationId?: string;
    configurationSha256?: string;
    status: AgentMonitoringStatus;
  }>;
};

export type AgentMonitoringStatusSummary = {
  execution: {
    status: "completed" | "failed";
    completedStages: number;
    totalStages: number;
    explanation: string;
  };
  gate: {
    status: "passed" | "blocked";
    displayDecision: string;
    explanation: string;
  };
  quality: {
    status: "passed" | "failed" | "not_measured";
    measuredMetrics: number;
    unavailableMetrics: number;
    qualificationDecision: string;
    explanation: string;
  };
};

export type SectionAgentMonitoring = {
  contractVersion: "section_agent_monitoring_v1";
  trace: AgentPipelineTrace;
  evidenceTrace: AgentEvidenceTrace;
  evaluationMatrix: SectionAgentEvaluationMatrix;
  controlPlane: AgentControlPlane;
  artifactCatalog?: {
    contractVersion: "agent_artifact_catalog_v1";
    policy: {
      immutable: boolean;
      authorization: string;
      contentRule: string;
    };
    artifacts: AgentPipelineTraceRef[];
  };
  statusSummary?: AgentMonitoringStatusSummary;
};

export type SystemRlHeldOutReview = {
  available: boolean;
  evaluationOnly?: boolean;
  generationBackend?: string;
  evaluationDisplay?: {
    banner: string;
    subtitle: string;
    unitLabel: string;
    backendLabel: string;
    evidenceMetricLabel?: string;
    originalMode?: "text" | "source_pdf";
    originalColumnLabel?: string;
    generationColumnLabel?: string;
    evidenceColumnLabel?: string;
    referenceLabel?: string;
  };
  sectionWorkflowEvaluation?: {
    candidateId: string;
    workflowStatus: string;
    qualificationStatus: string;
    guardDecision: string;
    atomicRows: Array<{ unitId: string; key: string; expectedValue: unknown; actualValue: unknown; status: string; sourceEvidenceIds: string[] }>;
    sectionAssessment: Record<string, { status: string; grader: string; explanation: string }>;
  };
  sectionAgentEvaluation?: { reportCount: number; developmentReports: number; testReports: number; fieldCount: number; sectionLabel: string };
  sectionTitle?: string;
  sourceReportName?: string;
  sourcePdfUrl?: string;
  referenceChoices?: Array<{ evaluationCaseId: string; label: string }>;
  revisionChoices?: Array<{ evaluationCaseId: string; label: string; sectionIds?: string[] }>;
  comparisonExperiment?: { name: string; arm: string; label: string; wordCount: number; peerWordCount: number; modelId: string; caseIds?: string[]; unitLabel?: string; reviewOnlyProposals?: boolean };
  diagnosticNotes?: string[];
  companionArtifacts?: Array<{ artifactId: string; kind: string; title?: string; caption?: string; dataUri: string }>;
  rawAiResponse?: { accepted: boolean; modelId?: string; findings: Array<{ text: string }> } | null;
  reason?: string;
  evalRunId?: string;
  evaluationCaseId?: string;
  datasetSplit?: string;
  reportName?: string;
  goldDocumentId?: string;
  sectionId?: string;
  sourcePageNumber?: number;
  allSectionsComplete?: boolean;
  sections?: Array<{ evaluationCaseId: string; reportName: string; sectionId: string; sectionTitle?: string; completed: boolean; outcomeCode: string | null; hardFailure: boolean }>;
  previousEvaluationCaseId?: string | null;
  previousSectionId?: string | null;
  nextEvaluationCaseId?: string | null;
  nextSectionId?: string | null;
  generatedContent?: string;
  aiCandidateContent?: string | null;
  originalSectionContent?: string;
  appEvidence?: Array<{ evidenceId: string; sourceClass: string; sourcePointer: string; label: string; text: string; processedText: string[]; usedInGeneration: boolean; context: string; issues: string[] }>;
  inputReadiness?: { status: string; totalSections: number; sectionsWithInputs: number; sectionsWithoutInputs: number; sections: Array<{ sectionId: string; title: string; status: "missing" | "partial" | "supplied"; reasons: string[] }> };
  experimentContract?: string;
  generatorContractVersion?: string;
  benchmarkStatus?: string;
  sectionPlanEvaluation?: {
    contractVersion?: string;
    denominatorSource?: "independent_expected_obligations" | "frozen_section_requirements";
  } | null;
  referenceRevision?: { contractVersion: string; pages: number[]; sourceSha256: string } | null;
  captureAvailability?: { capturedFactCount: number; withheldFactCount: number; denominator: string; withheldFacts: Array<{factId:string; text:string; sectionKey:string|null; reason:string}>; omittedCapturedFacts: Array<{factId:string; text:string}> } | null;
  evidenceReview?: { available: boolean; verdict: string; assessment: string; evidenceCoverage: number|null; evidenceFidelity: number|null; missingEvidence: string[]; unsupportedStatements: string[] } | null;
  originalFacts?: Array<{ factId: string; factType: string; value: unknown; unitCode: string | null; evidenceClass: string; safetyCriticality: string; required: boolean }>;
  metrics?: { score: number | null; outcomeCode: string; requiredFactRecall: number | null; claimPrecision: number | null; protectedFactAccuracy: number | null; formatMatch: number | null; professionalAcceptability: number | null; goldContentCoverage: number | null; outputLengthBalance: number | null; hardFailure: boolean; hardFailureReasons: string[]; automatedReview?: { verdict: string; assessment: string; reasons: string[] }; evaluationPoints: Array<{ key: string; label: string; score: number; statusCode: string; notes?: string[] }> };
  promotionGate?: { eligible: boolean; reasons: string[]; sectionCount: number; passedSectionCount: number; thresholds: { requiredFactRecall: number; claimPrecision: number; protectedFactAccuracy: number } };
  createdAtIso?: string;
  agentMonitoring?: SectionAgentMonitoring;
};

export async function loadSystemRlStatus(): Promise<SystemRlStatus> {
  return requestJson<SystemRlStatus>("/api/v1/admin/system-rl/status");
}

export async function loadSystemRlHeldOutReview(evaluationCaseId?: string, sectionId?: string, evalRunId?: string): Promise<SystemRlHeldOutReview> {
  const query = new URLSearchParams();
  if (evaluationCaseId) query.set("evaluationCaseId", evaluationCaseId);
  if (sectionId) query.set("sectionId", sectionId);
  if (evalRunId) query.set("evalRunId", evalRunId);
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
