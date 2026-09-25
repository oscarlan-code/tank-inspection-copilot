import { authenticatedFetch } from "./authClient";

export type CaptureVariantStatus =
  | "review_required"
  | "approved"
  | "round_trip_ready"
  | "materialized"
  | "rejected"
  | "failed"
  | "quarantined";

export type CaptureProfile = {
  profileVersionId: string;
  profileCode: string;
  versionNumber: number;
  displayName: string;
  description: string;
  lane: "faithful_capture" | "fault_injection";
  status: "active" | "retired";
  config: Record<string, unknown>;
};

export type CaptureVariantTruthCase = {
  truthCaseId: string;
  displayName: string;
  reportFamily: string;
  datasetSplit: "training" | "validation" | "hidden_test";
  status: string;
  truthGraphVersion: number;
  truthGraphSha256: string | null;
  factCount: number;
  approvedCount: number;
  materializableFactCount: number;
  updatedAtIso: string;
};

export type ExpectedMissingInput = {
  factId: string;
  sectionKey: string;
  answerabilityClass: string;
  reason: string;
};

export type CaptureVariantSummary = {
  variantId: string;
  truthCaseId: string;
  profileVersionId: string;
  profileCode: string;
  profileDisplayName: string;
  profileDescription: string;
  profileConfig: Record<string, unknown>;
  variantVersion: number;
  deterministicSeed: number;
  datasetSplit: "training" | "validation" | "hidden_test";
  lane: "faithful_capture" | "fault_injection";
  status: CaptureVariantStatus;
  includedFactCount: number;
  withheldFactCount: number;
  transformedFactCount: number;
  expectedMissingInputs: ExpectedMissingInput[];
  scenarioObjectKey: string | null;
  scenarioSha256: string | null;
  appReportJobId: string | null;
  appRoundTripStatus: "awaiting_app_round_trip" | "materialized";
  validation: Record<string, unknown>;
  createdAtIso: string;
  updatedAtIso: string;
  approvedAtIso: string | null;
};

export type CaptureVariantFactLink = {
  factId: string;
  truthCaseId: string;
  factType: string;
  sectionKey: string;
  normalizedValue: unknown;
  unitCode: string | null;
  evidenceClass: string;
  captureDestination: string | null;
  safetyCriticality: "low" | "medium" | "high" | "critical";
  answerabilityClass: string;
  requiredFact: boolean;
  disposition: "included" | "withheld" | "transformed" | "repeated";
  captureChannel: "structured_field" | "measurement" | "voice" | "note" | "photo" | "none";
  transformation: Record<string, unknown>;
  stableOrder: number;
};

export type CaptureVariantManifest = {
  packageType: "laiq_capture_scenario";
  schemaVersion: number;
  identity: {
    variantId: string;
    truthCaseId: string;
    truthGraphVersion: number;
    truthGraphSha256: string | null;
    captureProfile: string;
    captureProfileVersion: number;
    deterministicSeed: number;
    datasetSplit: string;
    lane: string;
  };
  appContractTarget: {
    packageType: "v3_product_export";
    schemaVersion: number;
    owner: string;
    status: string;
  };
  protectedInvariants: string[];
  variationModel?: {
    modelType: "hierarchical_constrained_sampling";
    modelVersion: number;
    distributions: Record<string, unknown>;
    sampledConditions: {
      contextCompleteness: number;
      structuredCompleteness: number;
      voiceDependence: number;
      noiseSeverity: number;
      speechFormality: number;
      photoAvailability: number;
      repetitionRate: number;
      fillerLambda: number;
      interruptionLambda: number;
      observationOrder: string;
    };
    hardConstraints: Record<string, boolean>;
  };
  captures: unknown[];
  withheldFacts: unknown[];
  expectedMissingInputs: ExpectedMissingInput[];
};

export type CaptureVariantDetail = {
  variant: CaptureVariantSummary;
  manifest: CaptureVariantManifest;
  validation: Record<string, unknown>;
  links: CaptureVariantFactLink[];
};

export type CaptureVariantBuilderState = {
  generatedAtIso: string;
  summary: {
    approvedTruthCases: number;
    activeProfiles: number;
    variants: number;
    reviewRequired: number;
    approved: number;
    materialized: number;
  };
  profiles: CaptureProfile[];
  truthCases: CaptureVariantTruthCase[];
  variants: CaptureVariantSummary[];
};

export async function loadCaptureVariantBuilder(): Promise<CaptureVariantBuilderState> {
  return requestJson("/api/v1/admin/capture-variants");
}

export async function generateCaptureVariants(
  truthCaseId: string,
  values: { profileCodes: string[]; seeds: number[] },
): Promise<CaptureVariantBuilderState> {
  return requestJson(`/api/v1/admin/truth-cases/${encodeURIComponent(truthCaseId)}/capture-variants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
}

export async function loadCaptureVariant(variantId: string): Promise<CaptureVariantDetail> {
  return requestJson(`/api/v1/admin/capture-variants/${encodeURIComponent(variantId)}`);
}

export async function runPendingCaptureVariantRoundTrips(truthCaseId: string): Promise<CaptureVariantBuilderState> {
  return requestJson("/api/v1/admin/capture-variants/round-trip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ truthCaseId }),
  });
}

export async function approveCaptureVariant(variantId: string): Promise<CaptureVariantDetail> {
  return requestJson(`/api/v1/admin/capture-variants/${encodeURIComponent(variantId)}/approve`, {
    method: "POST",
  });
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload?.error === "string"
      ? payload.error
      : `Capture Variant request failed with HTTP ${response.status}.`);
  }
  return payload as T;
}
