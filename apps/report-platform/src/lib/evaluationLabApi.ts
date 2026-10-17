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

export type MockPreparationRow = {
  rowId: string;
  variantId: string;
  sourceUnitId: string;
  semanticKey: string;
  unitType: string;
  appStyle: string;
  sourcePage: number | null;
  originalText: string;
  protectedFacts: Record<string, unknown>;
  allowedVariation: string;
  appEvidenceText: string;
  appEvidenceValue: unknown;
  appEvidenceRefs: string[];
  appContext: {
    voice?: { screenLabel?: string; itemLabel?: string } | null;
    finding?: unknown;
  } | null;
  gradingRoute: "deterministic" | "llm_semantic" | "human_visual";
  gradingStatus: "complete" | "awaiting_deterministic_comparison" | "awaiting_llm_semantic_grading" | "awaiting_visual_review";
  graderId: string | null;
  graderVersion: string | null;
  modelId: string | null;
  confidence: number | null;
  humanReviewRequired: boolean;
  linkageStatus: string;
  meaningStatus: string;
  integrityStatus: string;
  result: "pass" | "fail" | "pending" | "not_applicable";
  explanation: string;
  missingFacts: string[];
  alteredFacts: string[];
  unsupportedFacts: string[];
  contradictions: string[];
};

export type MockPreparationCalibrationRow = {
  variantId: string;
  sourceUnitId: string;
  caseType: string;
  expectedSemanticVerdict: string;
  actualSemanticVerdict: string;
  expectedIntegrityVerdict: string;
  actualIntegrityVerdict: string;
  matched: boolean;
  explanation: string;
  missingFacts: string[];
  alteredFacts: string[];
  unsupportedFacts: string[];
  sourcePage: number | null;
  originalText: string;
  appEvidenceText: string;
  appEvidenceRefs: string[];
  appContext: MockPreparationRow["appContext"];
};

export type MockPreparationPilotOutput = {
  noteId: string;
  text: string;
  semanticVerdict: string;
  integrityVerdict: string;
  explanation: string;
  missingFacts?: string[];
  alteredFacts?: string[];
  unsupportedFacts?: string[];
  contradictions?: string[];
};

export type MockPreparationPilotRow = {
  rowId: string;
  number: number;
  factId: string;
  factType: string;
  sourcePage: number | null;
  originalText: string;
  protectedMeaning: string;
  outputs: Record<string, MockPreparationPilotOutput>;
};

export type MockPreparationEvaluation = {
  available: boolean;
  evaluationOnly: true;
  message?: string;
  framework?: {
    name: string;
    rowDefinition: string;
    mockReadinessAndEvaluatorCalibrationSeparated: boolean;
  };
  case?: {
    caseId: string;
    revision: number;
    label: string;
    reportFamily: string;
    datasetSplit: string;
    status: string;
  };
  candidate?: Record<string, unknown>;
  summary?: {
    sourceSemanticUnits: number;
    voiceVariants: number;
    totalRows: number;
    reviewedRows: number;
    passedRows: number;
    failedRows: number;
    pendingRows: number;
    notApplicableRows: number;
    semanticPending: number;
    visualPending: number;
    semanticGraded: number;
    humanReviewRequired: number;
    qualificationDecision: string;
  };
  decision?: {
    dataset: string;
    nextAction: string;
  };
  variants?: Array<{
    variantId: string;
    totalRows: number;
    passedRows: number;
    failedRows: number;
    pendingRows: number;
  }>;
  graders?: Array<{
    id: string;
    type: string;
    gate: string;
    status: string;
    observed: string;
    expected: string;
    explanation: string;
  }>;
  deterministicReview?: {
    decision: string;
    variantCount: number;
    receiptCount: number;
    checklistItemCount: number;
    issueCount: number;
  } | null;
  rows?: MockPreparationRow[];
  calibration?: {
    available: boolean;
    purpose?: string;
    completedAtIso?: string | null;
    modelIds?: string[];
    scaleDecision?: string;
    summary: {
      judgments: number;
      matches: number;
      mismatches: number;
      gatePassed: boolean | null;
    };
    rows: MockPreparationCalibrationRow[];
  };
  fullReport?: {
    available: boolean;
    contractVersion?: string;
    runId?: string;
    caseId?: string;
    sourceUnitCount?: number;
    atomicEvaluationUnitCount?: number;
    atomicSplitDelta?: number;
    datasetCount?: number;
    decision?: string;
    summary?: {
      comparisonCount: number;
      passed: number;
      failed: number;
      pendingHumanReview: number;
      notApplicable: number;
      structured: { units: number; parityPassed: number; sourceReviewPending: number };
      narrative: { atomicFacts: number; passed: number };
      visual: { units: number; pending: number };
      outsideApp: { units: number; comparisons: number };
      androidRoundTrip: string;
    };
    datasets?: Array<{
      datasetId: string;
      comparisonCount: number;
      passed: number;
      failed: number;
      pendingHumanReview: number;
      notApplicable: number;
    }>;
    rows?: MockPreparationRow[];
    generatedAtIso?: string;
  };
  pilot?: {
    available: boolean;
    runKind?: "pilot" | "full_case";
    pilotId?: string;
    decision?: string;
    factCount?: number;
    sourceUnitCount?: number;
    noteCount?: number;
    datasetCount?: number;
    modelId?: string;
    completedAtIso?: string;
    androidDecision?: string;
    qualificationStatus?: string;
    goldApproval?: { approved: boolean; reason?: string | null };
    completeDatasetSet?: boolean;
    externalRequests?: { sent: boolean; count: number; modelId: string } | null;
    summary?: {
      factChecks: number;
      factFailures: number;
      unsupportedClaims: number;
      passedDatasets: number;
      androidPassedDatasets: number;
    };
    datasets?: Array<{
      datasetId: string;
      decision: string;
      generatorModel: string;
      reviewer: string;
      factFailures: number;
      unsupportedClaims: number;
      wordingMetrics: {
        clauseCount: number;
        exactSourceClauseCount: number;
        exactSourceClauseRate: number;
        clausesWithEightWordOverlap: number;
        eightWordOverlapRate: number;
      };
      android: {
        decision: string;
        producer: string;
        voiceNotes: number;
        voiceAttachments: number;
        exportSha256: string;
      } | null;
    }>;
    rows?: MockPreparationPilotRow[];
  };
};

export type ClassificationUse = {
  sectionId: string;
  blockId: string;
  role?: string;
  method?: string;
  confidence?: number;
};

export type ContentsClassificationEvaluationRow = {
  rowId: string;
  number: number;
  evidenceId: string | null;
  evidenceType: string;
  sourcePointer: string | null;
  atomizationMethod: string;
  originalAppRecord: unknown;
  atomizedUnit: string;
  sourceSpan: { start: number; end: number } | null;
  sourceUnits: Array<{
    sourceUnitId: string;
    sourcePage: number | null;
    originalReportText: string;
    unitType: string;
    headingPath: string[];
    origin?: string;
  }>;
  goldDecision: "route" | "exclude" | "missing";
  goldOrigins: string[];
  expectedUses: ClassificationUse[];
  predictedUses: ClassificationUse[];
  expectedLabels: string[];
  predictedLabels: string[];
  expectedSections: string[];
  predictedSections: string[];
  evaluationCategory: "report_grounded_deterministic_routing" | "contract_consistency" | "llm_narrative_classification" | "missing_gold";
  classifierDecision: string;
  classifierFeedback: string;
  result: "pass" | "fail" | "not_run" | "not_measured";
  feedback: string;
  humanReviewRequired: boolean;
  auditCategory?: "gold_label_review" | "outline_boundary" | "input_context_loss" | "classifier_error";
  auditCategoryLabel?: string;
  auditIssueGroupId?: string;
  auditRationale?: string;
  auditRecommendedAction?: string;
  auditStatus?: "engineering_triage_only";
};

export type ContentsClassificationEvaluation = {
  available: boolean;
  evaluationOnly: true;
  datasetId?: string;
  datasets?: Array<{ datasetId: string; label: string }>;
  challengeSummary?: {
    unitCount: number;
    reportCount: number;
    batchCount: number;
    sectionPass: number;
    sectionAccuracy: number;
    exactPass: number;
    exactAccuracy: number;
    unrouted: number;
    labelLeakageCount: number;
  };
  failureAudit?: {
    auditDate: string;
    auditState: string;
    scoreAdjustmentApplied: boolean;
    mismatchRows: number;
    uniqueIssueGroups: number;
    goldLabelReview: number;
    outlineBoundary: number;
    inputContextLoss: number;
    classifierError: number;
    categories: Array<{
      category: "gold_label_review" | "outline_boundary" | "input_context_loss" | "classifier_error";
      label: string;
      count: number;
    }>;
  } | null;
  runMode?: "preflight" | "live";
  message?: string;
  runId?: string;
  generatedAtIso?: string;
  classifier?: { candidateId: string; modelId: string | null; promptVersion: string };
  report?: { label: string; reportReference: string; tankNumber: string; variantId: string };
  stages?: Array<{ id: string; label: string; status: string; detail: string }>;
  summary?: {
    atomCount: number;
    goldLabeledAtoms: number;
    goldMissingAtoms: number;
    passed: number;
    failed: number;
    notRun: number;
    notMeasured: number;
    qualificationStatus: "measured" | "blocked_missing_canonical_gold";
    binaryEvaluatedCount: number;
    binaryPassRate: number;
    llmProposalReviewCount: number;
    attentionCount: number;
    labelPrecision: number;
    labelRecall: number;
    labelF1: number;
    exactLabelSetMatches: number;
  };
  byEvidenceType?: Array<{ evidenceType: string; total: number; evaluated: number; passed: number; failed: number; notRun: number; notMeasured: number }>;
  byEvaluationCategory?: Array<{ category: string; total: number; evaluated: number; passed: number; failed: number; notRun: number; notMeasured: number }>;
  goldSummary?: Record<string, number>;
  rows?: ContentsClassificationEvaluationRow[];
  runtime?: Record<string, unknown>;
};

export type ManualContentsClassificationResult = {
  contractVersion: "manual_contents_classification_result_v1";
  evaluationOnly: true;
  goldComparison: "not_applicable_for_ad_hoc_input";
  modelId: string;
  classifierReleaseId: string;
  classifierCandidateId: string;
  promptVersion: string;
  generatedAtIso: string;
  stages: Array<{ id: string; label: string; status: string; detail: string }>;
  atoms: Array<{
    evidenceId: string;
    text: string;
    proposedUses: ClassificationUse[];
    feedback: string;
    decisionState: string;
  }>;
};

export async function loadEvaluationLab(): Promise<EvaluationLabState> {
  return requestJson("/api/v1/admin/evaluation-lab");
}

export async function loadMockPreparationEvaluation(): Promise<MockPreparationEvaluation> {
  return requestJson("/api/v1/admin/mock-preparation-evaluation");
}

export async function loadContentsClassificationEvaluation(datasetId = "current"): Promise<ContentsClassificationEvaluation> {
  const query = new URLSearchParams({ dataset: datasetId });
  return requestJson(`/api/v1/admin/contents-classification-evaluation?${query.toString()}`);
}

export async function runManualContentsClassification(text: string): Promise<ManualContentsClassificationResult> {
  return requestJson("/api/v1/admin/contents-classification-evaluation/manual-test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
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
