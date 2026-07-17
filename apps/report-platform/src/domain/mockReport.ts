import {
  buildAndroidCircularPlateCells,
  buildAndroidShellPlateSegments,
  buildCustomCircularPlateCells,
  buildResolvedAnnularPlateGeometry,
  buildV3AppAnnularRingSections,
  ensureLayoutMapData,
  shellRegionMarkerPosition,
} from "../lib/layoutMapGeometry";
import { validateV2ProductExportPackage } from "../lib/validateV2ProductExport";
import {
  API_STANDARD_PRIMARY_REPORT,
  API_STANDARD_REPORT_TOC,
  type ApiStandardTocSection,
} from "./reportToc";
import { classifyReportPackage } from "./reportClassification";
import type {
  AiControlTrace,
  AssistantAction,
  AssistantPendingConfirmation,
  ChatMessage,
  LayoutEvidenceItem,
  LayoutMapData,
  LayoutMarker,
  LayoutPlate,
  MissingField,
  ReportSection,
  WorkspaceApiLinks,
  WorkspaceDataSourceMode,
  WorkspaceReport,
} from "./types";
import type {
  V2ProductExportAttachment,
  V2ProductExportChecklistSectionNote,
  V2ProductExportElement,
  V2ProductExportFinding,
  V2ProductExportLayoutConfig,
  V2ProductExportPackage,
  V2ProductExportUtMeasurement,
  V2ProductExportVoiceNote,
} from "./v2ProductExport";
import { authenticatedFetch } from "../lib/authClient";

type ManualReportSupplement = {
  reportReference: string;
  inspectedDate: string;
  coverHeroImage: string;
  clientRepresentative: string;
  yearBuilt: string;
  engineeringImplication: string;
  recommendationOwner: string;
  checkedBy: string;
  legendNote: string;
  certificationNumber: string;
};

type SketchSectionSpec = {
  id: string;
  number: string;
  title: string;
  shortLabel: string;
  drawing: string;
};

type ExportedLayoutMaps = {
  roof?: LayoutMapData;
  shell?: LayoutMapData;
  floor?: LayoutMapData;
};

type MarkerHostLocation = NonNullable<LayoutMarker["hostLocation"]>;

type MarkerBuildOptions = {
  plates?: LayoutPlate[];
  shellCourseCount?: number;
  shellLaneCount?: number;
};

export type WorkspaceBootstrap = {
  baselineReport: WorkspaceReport;
  report: WorkspaceReport;
  flashMessage: string;
  aiStatus: ApiAiStatus;
};

export type ApiAiStatus = {
  mode: "live_codex_cli" | "deterministic_fallback";
  provider: string;
  modelId: string | null;
  targetModelId?: string | null;
  configured: boolean;
  statusLabel: string;
  detail: string;
  codexCliVersion?: string | null;
  minimumCodexCliVersion?: string | null;
  timeoutMs?: number;
  checkedAtIso: string;
};

export type ApiGenerationRun = {
  runId: string;
  sectionId: string;
  statusCode: string;
  templateKey: string;
  retrievalKeys: string[];
  calculationKeys: string[];
  mapArtifactKeys: string[];
  warnings: string[];
  blockers: string[];
  generatedAtIso: string;
  providerCode?: string;
  modelId?: string | null;
  usedLiveModel?: boolean;
  fallbackReason?: string | null;
  assistantSummary?: string | null;
};

export type ApiEvalRun = {
  evalRunId: string;
  generationRunId: string;
  reportJobId: string | null;
  sectionId: string;
  evaluatorKey: string;
  createdAtIso: string;
  score: number;
  grade: string;
  outcomeCode: string;
  summary: string;
  dataLeakPolicy: {
    generationPromptIsolation: string;
    expectedFailureRule: string;
    noLeakRule: string;
  };
  missingUserInputs: {
    missingManualFields: Array<{
      fieldKey: string;
      label: string;
    }>;
    expectedBadUntilResolved: boolean;
    capApplied: number | null;
  };
  leakage: {
    riskScore: number;
    statusCode: string;
    copiedPhraseCount: number;
    copiedPhrasePreviews: string[];
    referenceOnlyFacts: string[];
    notes: string[];
  };
  dimensions: Array<{
    key: string;
    label: string;
    score: number;
    statusCode: string;
    notes: string[];
  }>;
  tuningHints: string[];
};

export type ApiSectionChatReply = {
  replyId: string;
  sectionId: string;
  content: string;
  providerCode: string;
  modelId: string | null;
  usedLiveModel: boolean;
  fallbackReason: string | null;
  createdAtIso: string;
  actions?: AssistantAction[];
  controlTrace?: AiControlTrace;
  pendingConfirmation?: AssistantPendingConfirmation;
};

export type ApiReportJobState = {
  reportJob?: {
    reportJobId: string;
    reportReference?: string;
    inspectedDate?: string;
  };
  exportPackage?: V2ProductExportPackage;
  package?: V2ProductExportPackage;
  manualSupplement?: Partial<ManualReportSupplement>;
  sectionDrafts?: Array<{
    sectionId: string;
    content: string;
    generated: boolean;
    edited: boolean;
    approved: boolean;
    reviewRequired: boolean;
    updatedAtIso: string;
    previousVersionCount?: number;
  }>;
  layoutOverrides?: Array<{
    sectionId: string;
    layoutMap: LayoutMapData;
    updatedAtIso: string;
  }>;
  generationRun?: ApiGenerationRun;
  evalRun?: ApiEvalRun;
  aiStatus?: ApiAiStatus;
};

const fixtureManualSupplement: ManualReportSupplement = {
  reportReference: API_STANDARD_PRIMARY_REPORT.reference,
  inspectedDate: API_STANDARD_PRIMARY_REPORT.inspectedDate,
  coverHeroImage: "",
  clientRepresentative: "",
  yearBuilt: "",
  engineeringImplication: "",
  recommendationOwner: "",
  checkedBy: "",
  legendNote: "",
  certificationNumber: "",
};

const defaultApiBaseUrl = "";
const v10ApiStandardBootstrapPath = "/api/v1/report-jobs/bootstrap/v10-api-standard";
const androidMockSeedPath =
  "apps/field-android/app/src/main/java/ai/laiq/tankinspection/v3product/preview/ProductMockTaskSeed.kt";
const reportFixturePath = "apps/report-platform/src/fixtures/v3-product-export-shell-internal.json";

function buildApiStandardFixturePackage(exportPackage: V2ProductExportPackage): V2ProductExportPackage {
  return exportPackage;
}

const makeField = (
  field: Partial<MissingField> &
    Pick<MissingField, "id" | "label" | "input" | "reason" | "source">,
): MissingField => ({
  value: "",
  ...field,
});

export async function loadWorkspaceBootstrap(): Promise<WorkspaceBootstrap> {
  return loadWorkspaceBootstrapUncached();
}

async function loadWorkspaceBootstrapUncached(): Promise<WorkspaceBootstrap> {
  const apiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_REPORT_API_BASE_URL) ?? defaultApiBaseUrl;

  try {
    const response = await authenticatedFetch(buildApiUrl(apiBaseUrl, v10ApiStandardBootstrapPath));
    if (!response.ok) {
      throw new Error(`Bootstrap request failed with ${response.status}`);
    }

    const payload = (await response.json()) as ApiReportJobState;
    const { baselineReport, report } = hydrateWorkspaceFromApiState(payload, apiBaseUrl);

    return {
      baselineReport,
      report,
      flashMessage:
        "Loaded report workspace from the report-platform API using the LAIQ inspection app V3 import contract.",
      aiStatus:
        payload.aiStatus ?? {
          mode: "deterministic_fallback",
          provider: "deterministic",
          modelId: null,
          configured: false,
          statusLabel: "Fallback generator",
          detail: "Backend AI status was not returned by the API.",
          checkedAtIso: new Date().toISOString(),
      },
    };
  } catch (error) {
    if (import.meta.env.VITE_REPORT_ALLOW_FIXTURE_FALLBACK !== "true") {
      throw error;
    }
    const fixturePackage = await loadFixturePackage();

    assertValidAndroidExport(fixturePackage);
    const baselineReport = buildWorkspaceReport(
      fixturePackage,
      fixtureManualSupplement,
      "fixture",
      apiBaseUrl,
    );

    return {
      baselineReport,
      report: cloneReport(baselineReport),
      flashMessage: `API bootstrap fallback: ${
        error instanceof Error ? error.message : "Unable to reach backend."
      } Loaded the local LAIQ inspection app export fixture instead.`,
      aiStatus: {
        mode: "deterministic_fallback",
        provider: "deterministic",
        modelId: null,
        configured: false,
        statusLabel: "Fixture fallback",
        detail: "The report-platform API could not be reached, so the workspace is running from the local fixture.",
        checkedAtIso: new Date().toISOString(),
      },
    };
  }
}

async function loadFixturePackage(): Promise<V2ProductExportPackage> {
  const fixtureModule = await import("../fixtures/v3-product-export-shell-internal.json");
  return buildApiStandardFixturePackage(fixtureModule.default as V2ProductExportPackage);
}

export function buildInitialChats(report: WorkspaceReport): Record<string, ChatMessage[]> {
  return Object.fromEntries(
    report.sections.map((section) => [
      section.id,
      [
        {
          id: `${section.id}-assistant-1`,
          role: "assistant",
          content: buildInitialAssistantPrompt(section),
        },
      ],
    ]),
  );
}

function buildWorkspaceReport(
  exportPackage: V2ProductExportPackage,
  manualSupplement: ManualReportSupplement,
  dataSourceMode: WorkspaceDataSourceMode,
  apiBaseUrl: string,
  reportJobId?: string,
): WorkspaceReport {
  const layoutMaps = buildExportedLayoutMaps(exportPackage, manualSupplement);

  const sections = [
    buildCoverSection(exportPackage, manualSupplement),
    ...buildApiStandardTocSections(exportPackage, manualSupplement, layoutMaps),
  ].map((section) => attachRawAppData(section, exportPackage));

  return {
    id: reportJobId ?? `report-job-${exportPackage.inspectionId}`,
    title: "API 653 Internal & External Inspection Workspace",
    reference: manualSupplement.reportReference,
    client: exportPackage.task.client,
    tank: `Tank ${exportPackage.task.tankNumber}`,
    inspectedDate: manualSupplement.inspectedDate,
    importSummary: {
      dataSourceMode,
      packageType: exportPackage.packageType,
      schemaVersion: exportPackage.schemaVersion,
      inspectionId: exportPackage.inspectionId,
      inspectionReference: exportPackage.inspectionReference,
      exportedByUserId: exportPackage.exportedByUserId,
      exportedAtIso: exportPackage.exportedAtIso,
      tenantId: exportPackage.tenantId,
      tenantName: exportPackage.profile.tenantName,
      workspaceId: exportPackage.workspaceId,
      workspaceName: exportPackage.profile.workspaceName,
      roleLabel: exportPackage.profile.roleLabel,
      workflowScreen: humanizeKey(exportPackage.workflowScreen),
      validationResults: exportPackage.validationResults.map((result) => ({
        ruleCode: result.ruleCode,
        ruleLabel: result.ruleLabel,
        passed: result.passed,
        blocksExport: result.blocksExport,
        message: result.message,
      })),
      findingCount: exportPackage.findings.length,
      attachmentCount: exportPackage.attachments.length,
      measurementCount: exportPackage.utMeasurements.length,
      reportClassification: classifyReportPackage(exportPackage),
    } as WorkspaceReport["importSummary"] & {
      reportClassification: ReturnType<typeof classifyReportPackage>;
    },
    apiLinks: buildApiLinks(apiBaseUrl),
    sections,
  };
}

export function hydrateWorkspaceFromApiState(
  payload: ApiReportJobState,
  apiBaseUrl = "",
): Pick<WorkspaceBootstrap, "baselineReport" | "report"> {
  const remotePackage = payload.exportPackage ?? payload.package;
  if (!remotePackage) {
    throw new Error("API state did not include an export package.");
  }
  assertValidAndroidExport(remotePackage);

  const manualSupplement = {
    ...fixtureManualSupplement,
    ...payload.manualSupplement,
    reportReference: payload.reportJob?.reportReference ?? payload.manualSupplement?.reportReference ?? fixtureManualSupplement.reportReference,
    inspectedDate: payload.reportJob?.inspectedDate ?? payload.manualSupplement?.inspectedDate ?? fixtureManualSupplement.inspectedDate,
  };

  const baselineReport = buildWorkspaceReport(
    remotePackage,
    manualSupplement,
    "api",
    apiBaseUrl,
    payload.reportJob?.reportJobId,
  );
  const report = applyPersistedState(
    cloneReport(baselineReport),
    payload.sectionDrafts,
    payload.layoutOverrides,
  );

  return { baselineReport, report };
}

function buildApiLinks(apiBaseUrl: string): WorkspaceApiLinks {
  const normalizedBase = normalizeApiBaseUrl(apiBaseUrl);

  return {
    apiBaseUrl: normalizedBase || "same-origin /api",
    importInspectionPath: buildApiUrl(apiBaseUrl, "/api/v1/imports/android-v3-product"),
    loadReportJobPath: buildApiUrl(apiBaseUrl, "/api/v1/report-jobs/:reportJobId"),
    resetDraftsPath: buildApiUrl(apiBaseUrl, "/api/v1/report-jobs/:reportJobId/reset-drafts"),
    saveSectionDraftPath: buildApiUrl(apiBaseUrl, "/api/v1/report-jobs/:reportJobId/sections/:sectionId"),
    saveManualInputsPath: buildApiUrl(apiBaseUrl, "/api/v1/report-jobs/:reportJobId/manual-inputs"),
    saveLayoutOverridePath: buildApiUrl(apiBaseUrl, "/api/v1/report-jobs/:reportJobId/layout-overrides/:sectionId"),
    generateSectionPath: buildApiUrl(apiBaseUrl, "/api/v1/report-jobs/:reportJobId/sections/:sectionId/generate"),
    sectionChatPath: buildApiUrl(apiBaseUrl, "/api/v1/report-jobs/:reportJobId/sections/:sectionId/chat"),
    restorePreviousSectionPath: buildApiUrl(apiBaseUrl, "/api/v1/report-jobs/:reportJobId/sections/:sectionId/restore-previous"),
    approveSectionPath: buildApiUrl(apiBaseUrl, "/api/v1/report-jobs/:reportJobId/sections/:sectionId/approve"),
    exportDocxPath: buildApiUrl(apiBaseUrl, "/api/v1/report-jobs/:reportJobId/exports/final-report.docx"),
  };
}

function buildCoverSection(
  exportPackage: V2ProductExportPackage,
  manualSupplement: ManualReportSupplement,
): ReportSection {
  const content = `INTERNAL & EXTERNAL INSPECTION REPORT

Client: ${exportPackage.task.client}
Tank: ${exportPackage.task.tankNumber}
Tank Type: Vertical aboveground storage tank
Report Reference: ${manualSupplement.reportReference}
Inspection Reference: ${exportPackage.inspectionReference}
Inspection Window: ${manualSupplement.inspectedDate}

This cover page is assembled from imported LAIQ inspection app facts plus report-side issue formatting.`;

  return {
    id: "cover",
    number: "0",
    title: "Cover",
    shortLabel: "Cover",
    kind: "structured",
    generated: true,
    edited: false,
    approved: false,
    reviewRequired: false,
    description: "Cover sheet before the numbered report sections in the sample report issue.",
    content,
    aiHint: "Use the sample report cover as format precedent, but ignore any OCR noise that refers to a horizontal tank.",
    templateExpectation: "Centered report title, client/tank/report reference block, issue metadata, and approved visual.",
    sourceSummary:
      "Imported from LAIQ app task and inspection record. Manual report reference and cover image remain report-side.",
    missingFields: [
      makeField({
        id: "coverHeroImage",
        label: "Cover Hero Image",
        input: "text",
        value: manualSupplement.coverHeroImage,
        suggestion: "Use the approved tank or terminal photograph from the final report issue set.",
        reason: "The cover page still requires its final approved hero image.",
        source: "Report-side manual input",
      }),
    ],
  };
}

function attachRawAppData(section: ReportSection, exportPackage: V2ProductExportPackage): ReportSection {
  return {
    ...section,
    rawAppData: buildSectionRawAppData(section, exportPackage),
  };
}

function buildSectionRawAppData(section: ReportSection, exportPackage: V2ProductExportPackage): string {
  const targetKeys = inferSectionTargetKeys(section);
  const sectionSearchText = `${section.id} ${section.title} ${section.sourceSummary}`.toLowerCase();
  const isChecklistSection = section.id === "tank-inspection-checklist" || sectionSearchText.includes("checklist");
  const isPhotoSection = section.id === "photographs" || section.kind === "attachment" || sectionSearchText.includes("photo");
  const isRecommendationSection =
    section.id.includes("recommendation") ||
    section.id.includes("repair") ||
    sectionSearchText.includes("recommendation");
  const isDetailedEvidenceSection =
    targetKeys.length > 0 ||
    sectionSearchText.includes("thickness") ||
    sectionSearchText.includes("measurement") ||
    sectionSearchText.includes("finding") ||
    sectionSearchText.includes("ndt") ||
    sectionSearchText.includes("mfl") ||
    section.kind === "map";
  const isOverviewSection = !isDetailedEvidenceSection && !isChecklistSection;
  const scopeFilter = <T extends { targetKey: string }>(items: T[]) => items.filter((item) => targetKeys.includes(item.targetKey));
  const scopedUtMeasurements = scopeFilter(exportPackage.utMeasurements);
  const scopedElements = scopeFilter(exportPackage.elements);
  const scopedFindings =
    targetKeys.length > 0
      ? scopeFilter(exportPackage.findings)
      : isRecommendationSection
        ? exportPackage.findings
        : [];
  const scopedLayoutTargets = scopeFilter(exportPackage.layoutTargets);
  const scopedLayoutConfigs = scopeFilter(exportPackage.layoutConfigs);
  const scopedVoiceNotes = selectVoiceNotesForSection(section, exportPackage, targetKeys);
  const checklistItems =
    isChecklistSection
      ? exportPackage.inspectionChecklistItems.slice(0, 32).map((item) => ({
          sectionTitle: item.sectionTitle,
          itemNumber: item.itemNumber,
          itemPrompt: item.itemPrompt,
          ratingLabel: item.ratingLabel,
        }))
      : [];
  const scopedChecklistNotes = selectChecklistSectionNotes(section, exportPackage, targetKeys);

  const selectedTargetLabel =
    targetKeys.length > 0 ? targetKeys.join(", ") : "none; this section uses report/job metadata";
  const overviewLines = [
    `- Use this as an inspection-wide report section, not a raw data dump.`,
    `- The app export identifies ${exportPackage.task.client}, Tank ${exportPackage.task.tankNumber}, ${exportPackage.task.location}.`,
    `- Export contains ${exportPackage.utMeasurements.length} UT rows, ${exportPackage.findings.length} finding records, ${exportPackage.elements.length} positioned elements, ${exportPackage.inspectionChecklistItems.length} checklist items, and ${(exportPackage.voiceNotes ?? []).length} voice notes/transcripts.`,
    `- Current validation result: ${exportPackage.validationResults.filter((result) => result.passed).length}/${exportPackage.validationResults.length} export checks passed.`,
    `- Keep detailed UT tables, map geometry, photo selection, and final recommendation wording in their own report sections.`,
  ].join("\n");
  const validationLines = exportPackage.validationResults
    .map((result) => `- ${result.ruleLabel}: ${result.passed ? "passed" : "needs review"} - ${result.message}`)
    .join("\n");
  const layoutLines =
    scopedLayoutConfigs.length > 0
      ? scopedLayoutConfigs
          .map((config) =>
            [
              `- ${humanizeKey(config.targetKey)} layout:`,
              config.shellCourseCount != null ? `${config.shellCourseCount} shell courses` : null,
              config.shellPlatesPerCourse != null ? `${config.shellPlatesPerCourse} plates per course` : null,
              config.shellLaneCount != null ? `${config.shellLaneCount} lanes` : null,
              config.roofRowCount != null ? `${config.roofRowCount} roof rows` : null,
              config.roofWidestRowPlateCount != null ? `${config.roofWidestRowPlateCount} widest-row roof plates` : null,
              config.floorPlateCount != null ? `${config.floorPlateCount} floor plates` : null,
              config.referenceMode ? `reference ${humanizeKey(config.referenceMode)}` : null,
            ]
              .filter(Boolean)
              .join(" · "),
          )
          .join("\n")
      : "- No matching layout config is exported for this report section.";
  const elementLines =
    scopedElements.length > 0
      ? isOverviewSection
        ? buildElementSummaryLines(scopedElements).join("\n")
        : scopedElements
            .slice(0, 16)
            .map(
              (element) =>
                `- ${element.elementLabel} (${humanizeKey(element.elementTypeKey)}) on ${humanizeKey(
                  element.targetKey,
                )}, normalized location x=${element.normalizedX.toFixed(2)}, y=${element.normalizedY.toFixed(2)}`,
            )
            .join("\n")
      : "- No matching element placements are exported for this section.";
  const utLines =
    scopedUtMeasurements.length > 0
      ? isOverviewSection
        ? buildUtTargetSummaryLines(scopedUtMeasurements).join("\n")
        : scopedUtMeasurements.slice(0, 24).map(formatUtMeasurementPreview).join("\n")
      : "- No matching UT rows are exported for this section.";
  const findingLines =
    scopedFindings.length > 0
      ? scopedFindings
          .slice(0, isOverviewSection ? 6 : 12)
          .map(
            (finding) =>
              `- ${finding.itemLabel}: ${truncatePreviewText(finding.note, isOverviewSection ? 190 : 320)} Linked UT item: ${finding.linkedUtItemKey}.`,
          )
          .join("\n")
      : "- No matching findings are exported for this section.";
  const checklistLines =
    checklistItems.length > 0
      ? checklistItems
          .map((item) => `- ${item.itemNumber}. ${item.itemPrompt} Result: ${item.ratingLabel ?? "not rated"}.`)
          .join("\n")
      : scopedChecklistNotes
          .slice(0, 8)
          .map((note) => `- ${note.sectionTitle}: ${note.note}`)
          .join("\n");
  const voiceNoteLines =
    scopedVoiceNotes.length > 0
      ? scopedVoiceNotes
          .slice(0, 12)
          .map(
            (note) =>
              `- ${formatVoiceNoteContext(note)} (${note.transcriptStatus}, ${formatVoiceDuration(note.durationMs)}, ${note.capturedAtIso}): ${truncatePreviewText(
                note.transcriptText ?? "",
                360,
              )}`,
          )
          .join("\n")
      : "- No voice-note transcript evidence is scoped to this section.";
  const elementHeading = isOverviewSection
    ? `Element placement summary (${scopedElements.length} matching rows)`
    : `Element placements (${scopedElements.length} matching rows, first 16 shown)`;
  const utHeading = isOverviewSection
    ? `UT measurement summary (${scopedUtMeasurements.length} matching rows)`
    : `UT measurements (${scopedUtMeasurements.length} matching rows, first 24 shown)`;
  const findingHeading = isOverviewSection
    ? `Findings summary (${scopedFindings.length} matching rows, first 6 shown)`
    : `Findings (${scopedFindings.length} matching rows, first 12 shown)`;

  if (isOverviewSection && !isPhotoSection) {
    return [
      "Source files",
      `- LAIQ app mock seed: ${androidMockSeedPath}`,
      `- App export fixture: ${reportFixturePath}`,
      "",
      "Selected report section",
      `- Section ${section.number}: ${section.title}`,
      `- Section type: ${section.kind}`,
      "- Relevant exported targets: none; this section should not include raw UT rows, finding maps, or checklist dumps.",
      "",
      "Plain-English reading guide",
      overviewLines,
      "",
      "Inspection package",
      `- Package type/version: ${exportPackage.packageType} / schema ${exportPackage.schemaVersion}`,
      `- Inspection reference: ${exportPackage.inspectionReference}`,
      `- Exported at: ${exportPackage.exportedAtIso}`,
      `- Inspector: ${exportPackage.profile.displayName} (${exportPackage.profile.roleLabel})`,
      `- Tenant/workspace: ${exportPackage.profile.tenantName} / ${exportPackage.profile.workspaceName}`,
      "",
      "Tank identity and dimensions",
      `- Client: ${exportPackage.task.client}`,
      `- Tank: ${exportPackage.task.tankNumber}`,
      `- Location: ${exportPackage.task.location}`,
      `- Field/lease: ${exportPackage.inspectionRecord.fieldLeaseName}`,
      `- Roof type: ${humanizeKey(exportPackage.inspectionRecord.externalRoofType ?? "not recorded")}`,
      `- Diameter: ${formatMetric(exportPackage.inspectionRecord.diameterM)}`,
      `- Height: ${formatMetric(exportPackage.inspectionRecord.heightM)}`,
      `- Shell courses: ${exportPackage.inspectionRecord.shellCourseCount ?? "not recorded"}`,
      "",
      "Section-specific context",
      ...buildOverviewSectionContextLines(section, exportPackage),
      "",
      `Voice-note transcript evidence (${scopedVoiceNotes.length} matching rows)`,
      voiceNoteLines,
      "",
      "Export readiness checks relevant to this section",
      validationLines,
      "",
      "Display note",
      "- This section-level preview intentionally excludes unrelated raw evidence tables. Open the matching UT, checklist, map, photo, or recommendation section for those details.",
    ].join("\n");
  }

  if (isPhotoSection) {
    return [
      "Source files",
      `- LAIQ app mock seed: ${androidMockSeedPath}`,
      `- App export fixture: ${reportFixturePath}`,
      "",
      "Selected report section",
      `- Section ${section.number}: ${section.title}`,
      `- Section type: ${section.kind}`,
      "- Relevant exported targets: photo and attachment registry only.",
      "",
      "Plain-English reading guide",
      "- Use only imported attachment/photo metadata for this section. Do not pull UT tables, checklist notes, or unrelated findings into the photo page draft.",
      "",
      "Inspection package",
      `- Inspection reference: ${exportPackage.inspectionReference}`,
      `- Client/tank: ${exportPackage.task.client} / Tank ${exportPackage.task.tankNumber}`,
      "",
      "Section-specific attachment context",
      ...buildPhotoSectionContextLines(exportPackage),
      "",
      "Display note",
      "- Final photo ordering, captions, and page layout remain report-side decisions.",
    ].join("\n");
  }

  return [
    "Source files",
    `- LAIQ app mock seed: ${androidMockSeedPath}`,
    `- App export fixture: ${reportFixturePath}`,
    "",
    "Selected report section",
    `- Section ${section.number}: ${section.title}`,
    `- Section type: ${section.kind}`,
    `- Relevant exported targets: ${selectedTargetLabel}`,
    "",
    "Plain-English reading guide",
    isOverviewSection
      ? overviewLines
      : "- Use these section-specific facts as the evidence base. Keep the final report wording concise and in the sample report format.",
    "",
    "Inspection package",
    `- Package type/version: ${exportPackage.packageType} / schema ${exportPackage.schemaVersion}`,
    `- Inspection reference: ${exportPackage.inspectionReference}`,
    `- Exported at: ${exportPackage.exportedAtIso}`,
    `- Inspector: ${exportPackage.profile.displayName} (${exportPackage.profile.roleLabel})`,
    `- Tenant/workspace: ${exportPackage.profile.tenantName} / ${exportPackage.profile.workspaceName}`,
    "",
    "Tank identity and dimensions",
    `- Client: ${exportPackage.task.client}`,
    `- Tank: ${exportPackage.task.tankNumber}`,
    `- Location: ${exportPackage.task.location}`,
    `- Field/lease: ${exportPackage.inspectionRecord.fieldLeaseName}`,
    `- Roof type: ${humanizeKey(exportPackage.inspectionRecord.externalRoofType ?? "not recorded")}`,
    `- Diameter: ${formatMetric(exportPackage.inspectionRecord.diameterM)}`,
    `- Height: ${formatMetric(exportPackage.inspectionRecord.heightM)}`,
    `- Shell courses: ${exportPackage.inspectionRecord.shellCourseCount ?? "not recorded"}`,
    "",
    "Export readiness checks",
    validationLines,
    "",
    `Layout configuration (${scopedLayoutConfigs.length} matching rows)`,
    layoutLines,
    "",
    `Voice-note transcript evidence (${scopedVoiceNotes.length} matching rows, first 12 shown)`,
    voiceNoteLines,
    "",
    elementHeading,
    elementLines,
    "",
    utHeading,
    utLines,
    "",
    findingHeading,
    findingLines,
    "",
    checklistItems.length > 0 ? "Checklist items (first 32 shown)" : "Section-related checklist notes",
    checklistLines || "- No checklist notes are scoped to this section.",
    "",
    "Display note",
    "- This is a readable pre-processed preview. The full immutable JSON export remains the source of truth.",
  ].join("\n");
}

function buildOverviewSectionContextLines(section: ReportSection, exportPackage: V2ProductExportPackage): string[] {
  if (section.id === "scope-of-inspection") {
    return [
      "- Generate the report scope only from task identity, inspection type, API-standard report family, and export readiness status.",
      `- Field task scope: ${exportPackage.task.client}, Tank ${exportPackage.task.tankNumber}, ${exportPackage.task.location}.`,
      `- Workflow screen captured by LAIQ inspection app: ${humanizeKey(exportPackage.workflowScreen)}.`,
      `- Voice-note transcripts available for report drafting: ${(exportPackage.voiceNotes ?? []).length}.`,
      "- Mention that detailed roof, shell, floor, NDT, layout-map, photograph, and recommendation content is handled in later sections.",
    ];
  }

  if (section.id === "inspection-maintenance-regime") {
    return [
      "- This section is mainly report-family standard wording.",
      "- Use app export only to confirm the active client, tank, inspection reference, and report family.",
      `- Checklist coverage available elsewhere: ${exportPackage.inspectionChecklistItems.length} completed checklist items.`,
      "- Do not include detailed checklist answers in this maintenance-regime section.",
    ];
  }

  if (section.id === "general-tank-information") {
    return [
      "- Use this section as a structured label-value tank information page.",
      `- Client: ${exportPackage.inspectionRecord.client}`,
      `- Tank number: ${exportPackage.inspectionRecord.tankNumber}`,
      `- Location: ${exportPackage.inspectionRecord.location}`,
      `- Reference mode: ${humanizeKey(exportPackage.inspectionRecord.referenceMode ?? "not recorded")}`,
      `- Roof type: ${humanizeKey(exportPackage.inspectionRecord.externalRoofType ?? "not recorded")}`,
      `- Remaining report-side fields: ${formatMissingFieldLabels(section)}.`,
    ];
  }

  if (section.id === "test-information") {
    return [
      "- Use this section for test-method metadata only.",
      `- LAIQ app export has ${exportPackage.utMeasurements.length} UT rows and ${exportPackage.findings.length} finding records available in their own sections.`,
      "- Do not paste UT measurement rows into the test information section.",
      `- Remaining report-side fields: ${formatMissingFieldLabels(section)}.`,
    ];
  }

  return [
    "- This section does not currently have dedicated structured evidence in the LAIQ app export.",
    "- Use the report ToC title, template expectation, and missing-content panel as the working context.",
    `- Remaining report-side fields: ${formatMissingFieldLabels(section)}.`,
  ];
}

function buildPhotoSectionContextLines(exportPackage: V2ProductExportPackage): string[] {
  const photoAttachments = exportPackage.attachments.filter(isPhotoAttachment);

  if (photoAttachments.length === 0) {
    return ["- No imported photo attachments are available for this section yet."];
  }

  return photoAttachments
    .slice(0, 24)
    .map((attachment, index) => `- Photo ${index + 1}: ${attachment.displayName} (${attachment.kind}).`);
}

function selectChecklistSectionNotes(
  section: ReportSection,
  exportPackage: V2ProductExportPackage,
  targetKeys: string[],
): V2ProductExportChecklistSectionNote[] {
  if (section.id === "tank-inspection-checklist") {
    return exportPackage.inspectionChecklistSectionNotes;
  }

  const sectionText = `${section.id} ${section.title}`.toLowerCase();
  const includeKeywords = new Set<string>();

  if (targetKeys.includes("external_roof") || sectionText.includes("roof")) {
    includeKeywords.add("roof");
  }
  if (targetKeys.includes("shell") || sectionText.includes("shell")) {
    includeKeywords.add("shell");
    includeKeywords.add("access");
  }
  if (targetKeys.includes("floor") || sectionText.includes("floor") || sectionText.includes("bottom")) {
    includeKeywords.add("floor");
    includeKeywords.add("bottom");
    includeKeywords.add("foundation");
  }

  if (includeKeywords.size === 0) return [];

  return exportPackage.inspectionChecklistSectionNotes.filter((note) => {
    const title = note.sectionTitle.toLowerCase();
    return [...includeKeywords].some((keyword) => title.includes(keyword));
  });
}

function selectVoiceNotesForSection(
  section: ReportSection,
  exportPackage: V2ProductExportPackage,
  targetKeys: string[],
): V2ProductExportVoiceNote[] {
  const notes = exportPackage.voiceNotes ?? [];

  if (section.id === "inspection-report") {
    return notes;
  }

  const sectionText = normalizeEvidenceKey(`${section.id} ${section.title} ${section.sourceSummary}`);
  const wantedCategories = inferVoiceContextCategories(section);

  return notes.filter((note) => {
    const noteText = normalizeEvidenceKey(
      [
        note.screenKey,
        note.screenLabel,
        note.cardKey,
        note.fieldKey,
        note.targetKey,
        note.targetLabel,
        note.itemKey,
        note.itemLabel,
        note.transcriptText,
      ]
        .filter(Boolean)
        .join(" "),
    );
    const targetMatches = targetKeys.length > 0 && note.targetKey != null && targetKeys.includes(note.targetKey);
    const categoryMatches =
      wantedCategories.length > 0 &&
      wantedCategories.some((category) => voiceNoteMatchesCategory(note, noteText, category));
    const titleMatches = sectionText
      .split(" ")
      .filter((part) => part.length > 4)
      .some((part) => noteText.includes(part));

    return targetMatches || categoryMatches || titleMatches;
  });
}

function inferVoiceContextCategories(section: ReportSection): string[] {
  const text = normalizeEvidenceKey(`${section.id} ${section.title} ${section.sourceSummary}`);
  const categories: string[] = [];

  if (text.includes("scope") || text.includes("general tank")) categories.push("site");
  if (text.includes("dike") || text.includes("foundation") || text.includes("maintenance")) {
    categories.push("dike", "foundation");
  }
  if (text.includes("layout") || text.includes("map") || text.includes("drawing")) categories.push("layout");
  if (text.includes("roof")) categories.push("roof");
  if (text.includes("shell") || text.includes("weld") || text.includes("mpi") || text.includes("appurtenance")) {
    categories.push("shell");
  }
  if (text.includes("floor") || text.includes("bottom") || text.includes("mfl")) categories.push("floor");
  if (text.includes("checklist")) categories.push("checklist");
  if (text.includes("finding") || text.includes("recommendation") || text.includes("repair")) {
    categories.push("finding", "repair");
  }
  if (text.includes("photo")) categories.push("photo");

  return [...new Set(categories)];
}

function voiceNoteMatchesCategory(
  note: V2ProductExportVoiceNote,
  normalizedNoteText: string,
  category: string,
): boolean {
  const targetKey = note.targetKey ?? "";
  const screenKey = note.screenKey ?? "";
  const text = normalizedNoteText;

  switch (category) {
    case "site":
      return screenKey === "general_info" || text.includes("field capture") || text.includes("vuda terminal");
    case "dike":
      return text.includes("dike") || text.includes("diked") || text.includes("drain");
    case "foundation":
      return text.includes("foundation") || text.includes("tar seal") || text.includes("floor edge");
    case "layout":
      return screenKey.includes("layout") || text.includes("layout") || text.includes("plate map");
    case "roof":
      return targetKey === "external_roof" || targetKey === "internal_roof" || text.includes("roof");
    case "shell":
      return targetKey === "shell" || text.includes("shell") || text.includes("weld");
    case "floor":
      return targetKey === "floor" || text.includes("floor") || text.includes("bottom") || text.includes("mfl");
    case "checklist":
      return screenKey === "checklist";
    case "finding":
      return screenKey === "findings" || text.includes("finding") || text.includes("indication");
    case "repair":
      return text.includes("repair") || text.includes("recoat") || text.includes("weld build");
    case "photo":
      return text.includes("photo") || text.includes("photograph");
    default:
      return false;
  }
}

function formatVoiceNoteContext(note: V2ProductExportVoiceNote): string {
  return [
    note.screenLabel,
    note.targetLabel,
    note.itemLabel,
  ].filter(Boolean).join(" / ");
}

function formatVoiceDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "duration not recorded";
  return `${Math.round(durationMs / 1000)}s`;
}

function normalizeEvidenceKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function formatMissingFieldLabels(section: ReportSection): string {
  if (section.missingFields.length === 0) return "none detected for this section";
  return section.missingFields.map((field) => field.label).join(", ");
}

function inferSectionTargetKeys(section: ReportSection): string[] {
  const text = `${section.id} ${section.title} ${section.sourceSummary}`.toLowerCase();
  const targets = new Set<string>();

  if (text.includes("roof")) targets.add("external_roof");
  if (text.includes("shell") || text.includes("weld") || text.includes("mpi") || text.includes("curb")) {
    targets.add("shell");
  }
  if (text.includes("floor") || text.includes("bottom") || text.includes("mfl")) targets.add("floor");

  return [...targets];
}

function summarizeUtMeasurement(measurement: V2ProductExportUtMeasurement) {
  return {
    targetKey: measurement.targetKey,
    itemKey: measurement.itemKey,
    itemLabel: measurement.itemLabel,
    itemKind: measurement.itemKind,
    laneId: measurement.laneId,
    course: measurement.course,
    plateId: measurement.plateId,
    elementId: measurement.elementId,
    confirmed: measurement.confirmed,
    measured: measurement.measured,
    readingsMm: [
      measurement.value1,
      measurement.value2,
      measurement.value3,
      measurement.value4,
      measurement.value5,
    ].filter((value): value is number => value != null),
    reinforcementPadReading: measurement.reinforcementPadReading,
  };
}

function formatUtMeasurementPreview(measurement: V2ProductExportUtMeasurement): string {
  const summary = summarizeUtMeasurement(measurement);
  const readings = summary.readingsMm.length > 0 ? `${summary.readingsMm.join(", ")} mm` : "no readings";
  const location = [
    summary.laneId ? `lane ${summary.laneId}` : null,
    summary.course != null ? `course ${summary.course}` : null,
    summary.plateId ? `plate ${summary.plateId}` : null,
    summary.elementId ? `element ${summary.elementId}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return `- ${summary.itemLabel} (${humanizeKey(summary.targetKey)}): ${readings}${
    location ? `; ${location}` : ""
  }${summary.reinforcementPadReading != null ? `; reinforcement pad ${summary.reinforcementPadReading} mm` : ""}.`;
}

function buildUtTargetSummaryLines(measurements: V2ProductExportUtMeasurement[]): string[] {
  const groups = new Map<string, number[]>();

  for (const measurement of measurements) {
    const readings = [
      measurement.value1,
      measurement.value2,
      measurement.value3,
      measurement.value4,
      measurement.value5,
      measurement.reinforcementPadReading,
    ].filter((value): value is number => value != null);
    const group = groups.get(measurement.targetKey) ?? [];
    group.push(...readings);
    groups.set(measurement.targetKey, group);
  }

  return [...groups.entries()].map(([targetKey, readings]) => {
    if (readings.length === 0) {
      return `- ${humanizeKey(targetKey)}: ${measurements.filter((item) => item.targetKey === targetKey).length} UT rows; no numeric readings exported.`;
    }

    const rowCount = measurements.filter((item) => item.targetKey === targetKey).length;
    const minimum = Math.min(...readings);
    const maximum = Math.max(...readings);
    const average = readings.reduce((sum, value) => sum + value, 0) / readings.length;

    return `- ${humanizeKey(targetKey)}: ${rowCount} UT rows; readings ${minimum.toFixed(2)}-${maximum.toFixed(
      2,
    )} mm; average ${average.toFixed(2)} mm.`;
  });
}

function buildElementSummaryLines(elements: V2ProductExportElement[]): string[] {
  const groups = new Map<string, Map<string, number>>();

  for (const element of elements) {
    const targetGroup = groups.get(element.targetKey) ?? new Map<string, number>();
    targetGroup.set(element.elementTypeKey, (targetGroup.get(element.elementTypeKey) ?? 0) + 1);
    groups.set(element.targetKey, targetGroup);
  }

  return [...groups.entries()].map(([targetKey, typeCounts]) => {
    const typeSummary = [...typeCounts.entries()]
      .map(([typeKey, count]) => `${count} ${humanizeKey(typeKey).toLowerCase()}${count === 1 ? "" : "s"}`)
      .join(", ");

    return `- ${humanizeKey(targetKey)} positioned elements: ${typeSummary}.`;
  });
}

function truncatePreviewText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function buildScopeSection(
  exportPackage: V2ProductExportPackage,
  manualSupplement: ManualReportSupplement,
): ReportSection {
  const content = `1       SCOPE OF INSPECTION

➢ To carry out a general and close visual inspection on the internal and external areas of the vertical aboveground storage tank and record conditions that may be detrimental to serviceability.

➢ To review roof, shell, floor, nozzle, settlement, NDT, and photographic evidence against the API 653 report format.

➢ To compile the report sections, worksheets, photographs, layout drawings, and engineering assessment in the same order as the approved API-standard sample report.

➢ To preserve LAIQ inspection app field-capture data as the factual baseline while allowing final report presentation, layout maps, and recommendation wording to be reviewed and approved on the report platform.

➢ To list missing report-side values for user confirmation before final issue.

Report Reference: ${manualSupplement.reportReference}
Inspection Reference: ${exportPackage.inspectionReference}`;

  return {
    id: "scope-of-inspection",
    number: "1",
    title: "Scope of Inspection",
    shortLabel: "Scope",
    kind: "narrative",
    generated: true,
    edited: false,
    approved: false,
    reviewRequired: false,
    description: "ToC section 1 from the API-standard internal/external sample report.",
    content,
    aiHint: "Follow the sample report bullet style and keep the scope specific to vertical aboveground shell internal inspection.",
    templateExpectation: "Numbered section heading with arrow bullets and concise API 653 scope language.",
    sourceSummary:
      "Imported: inspection reference, task scope, layout metadata and evidence. Manual: issue reference and final wording approval.",
    missingFields: [],
  };
}

function buildMaintenanceRegimeSection(
  exportPackage: V2ProductExportPackage,
  manualSupplement: ManualReportSupplement,
): ReportSection {
  const content = `2       INSPECTION AND MAINTENANCE REGIME

See API 653 Appendix C "Check List for Tank Inspection".

Both API 653 and EEMUA 159 provide a detailed list of items for inspection. Factors related to tank bottom, shell and roof integrity are considered against inspection intervals and the owner/operator's maintenance responsibilities.

The Client should define responsibilities for inspection activities to be carried out by plant operations personnel, maintenance staff, mechanical contractors and the Authorized Inspector.

This section is maintained as report-family standard wording and should be reviewed against the final client issue requirements for ${exportPackage.task.client}, Tank ${exportPackage.task.tankNumber}.

Report Reference: ${manualSupplement.reportReference}`;

  return {
    id: "inspection-maintenance-regime",
    number: "2",
    title: "Inspection and Maintenance Regime",
    shortLabel: "Regime",
    kind: "narrative",
    generated: true,
    edited: false,
    approved: false,
    reviewRequired: false,
    description: "ToC section 2, sample-family standard maintenance responsibility wording.",
    content,
    aiHint: "Preserve the formal sample-report tone and avoid changing current inspection facts.",
    templateExpectation: "Numbered section heading followed by formal API 653/EEMUA 159 responsibility paragraphs.",
    sourceSummary:
      "Imported: client and tank identity. Precedent: sample-family maintenance regime wording. Manual: final issue approval.",
    missingFields: [],
  };
}

function buildGeneralInfoSection(
  exportPackage: V2ProductExportPackage,
  manualSupplement: ManualReportSupplement,
): ReportSection {
  const record = exportPackage.inspectionRecord;
  const content = `Client: ${record.client}
Tank Number: ${record.tankNumber}
Tank Type: Vertical aboveground storage tank
Inspection Reference: ${exportPackage.inspectionReference}
Report Reference: ${manualSupplement.reportReference}
Location: ${record.location}
Field / Lease Name: ${record.fieldLeaseName}
Roof Type: ${humanizeKey(record.externalRoofType ?? "not_recorded")}
Reference Mode: ${humanizeKey(record.referenceMode ?? "not_recorded")}
Diameter / Height: ${formatMetric(record.diameterM)} / ${formatMetric(record.heightM)}
Shell Course Count: ${record.shellCourseCount ?? "Not recorded"}

This section is driven mainly by structured LAIQ app export facts, with a few remaining client-facing report fields captured on the web side.`;

  return {
    id: "general-tank-information",
    number: "3",
    title: "General Tank Information",
    shortLabel: "Tank Info",
    kind: "structured",
    generated: true,
    edited: false,
    approved: false,
    reviewRequired: false,
    description: "ToC section 3, structured general tank information page.",
    content,
    aiHint: "Keep the section factual, compact, and clearly separable from narrative commentary.",
    templateExpectation: "Label-value metadata layout with consistent engineering terminology.",
    sourceSummary:
      "Imported: task, inspection record, export metadata. Manual: client representative, year built, issue reference confirmation.",
    missingFields: [
      makeField({
        id: "clientRepresentative",
        label: "Client Representative",
        input: "text",
        value: manualSupplement.clientRepresentative,
        suggestion: "Howard Ah Sam",
        reason: "The sample report family normally carries a client-side contact or representative.",
        source: "Report-side manual input",
      }),
      makeField({
        id: "yearBuilt",
        label: "Year Built",
        input: "text",
        value: manualSupplement.yearBuilt,
        suggestion: "1977",
        reason: "The general information page still needs the built year to match the sample report family.",
        source: "Report-side manual input",
      }),
    ],
  };
}

function buildInspectionReportSection(
  exportPackage: V2ProductExportPackage,
  manualSupplement: ManualReportSupplement,
): ReportSection {
  const content = buildInspectionReportNarrative(exportPackage, manualSupplement);

  return {
    id: "inspection-report",
    number: "4",
    title: "Inspection Report",
    shortLabel: "Inspection",
    kind: "narrative",
    generated: true,
    edited: true,
    approved: false,
    reviewRequired: false,
    description: "ToC section 4, internal/external inspection narrative and imported finding summary.",
    content,
    aiHint:
      "Use the sample report Inspection Report structure: uppercase subsection headings, arrow bullets, photo references where available, and no invented findings.",
    templateExpectation:
      "Sample-report narrative page with DIKED AREA, FOUNDATION, SHELL, SHELL APPURTENANCES, ACCESS STRUCTURE, FIXED ROOF, ROOF APPURTENANCES, ROOF INTERNAL, SHELL INTERNAL, and FLOOR INTERNAL subsections.",
    sourceSummary:
      "Imported: findings, shell UT rows, checklist notes, and voice-to-text narrative notes. Manual: concluding engineering implication paragraph. Derived: sample-report narrative draft.",
    missingFields: [
      makeField({
        id: "engineeringImplication",
        label: "Engineering Implication Paragraph",
        input: "textarea",
        value: manualSupplement.engineeringImplication,
        suggestion:
          "Summarize that the marked weld and shell locations require repair planning and verification before return to service.",
        reason: "The client-facing implication paragraph is still a report-side approval item.",
        source: "Report-side manual input",
      }),
    ],
  };
}

function buildRecommendationSection(
  exportPackage: V2ProductExportPackage,
  manualSupplement: ManualReportSupplement,
): ReportSection {
  const content = `REPAIR RECOMMENDATIONS

- Confirm the repair scope for the ${exportPackage.findings.length} imported shell finding locations before issue.
- Use the imported attachment package and MPI support records as the evidence set for repair planning.
- Hold the API 653 recommendation wording until the narrative section and engineering implication paragraph are approved.

This section is report-side by design: the LAIQ app export supplies the factual basis, while the final recommendation wording belongs to the cloud reporting workflow.`;

  return {
    id: "repair-recommendations",
    number: "5",
    title: "Repair Recommendations / API 653 Assessment",
    shortLabel: "Recommendations",
    kind: "narrative",
    generated: true,
    edited: false,
    approved: false,
    reviewRequired: false,
    description: "ToC section 5, repair recommendations and API 653 assessment.",
    content,
    aiHint: "Do not invent calculations. Keep recommendation language tied to approved findings and explicit evidence.",
    templateExpectation: "Bulleted recommendation section with clear ownership and approval trail.",
    sourceSummary:
      "Imported: findings and attachments. Manual: recommendation ownership and final API 653 wording. Derived: section skeleton.",
    missingFields: [
      makeField({
        id: "recommendationOwner",
        label: "Recommendation Owner",
        input: "select",
        value: manualSupplement.recommendationOwner,
        options: ["Client", "IRS", "Mechanical Contractor"],
        suggestion: "Client",
        reason: "Recommendation ownership still needs explicit confirmation before issue.",
        source: "Report-side manual input",
      }),
    ],
  };
}

function buildPhotographsSection(exportPackage: V2ProductExportPackage): ReportSection {
  const photoAttachments = exportPackage.attachments.filter(isPhotoAttachment);
  const content = `6       PHOTOGRAPHS

This section is reserved for selected report photographs and captions.

Imported photo evidence count: ${photoAttachments.length}

${photoAttachments.length > 0 ? photoAttachments.map((attachment, index) => `Photo ${index + 1}: ${attachment.displayName}`).join("\n") : "No photo attachments were imported in this package."}

Final photo ordering, caption formatting, and page layout belong to the report platform.`;

  return {
    id: "photographs",
    number: "6",
    title: "Photographs",
    shortLabel: "Photos",
    kind: "attachment",
    generated: true,
    edited: false,
    approved: false,
    reviewRequired: photoAttachments.length === 0,
    description: "ToC section 6, selected report photographs and captions.",
    content,
    aiHint: "Use concise sample-report captions and do not invent images that were not imported.",
    templateExpectation: "Photo pages with selected images, compact captions, and consistent issue formatting.",
    sourceSummary:
      "Imported: photo attachment registry. Manual: final photo selection, sequence, and captions.",
    missingFields: [],
  };
}

function buildTankInspectionChecklistSection(exportPackage: V2ProductExportPackage): ReportSection {
  const content = buildChecklistTableHtml(exportPackage);

  return {
    id: "tank-inspection-checklist",
    number: "7",
    title: "Tank Inspection Checklist",
    shortLabel: "Checklist",
    kind: "structured",
    generated: true,
    edited: false,
    approved: false,
    reviewRequired: false,
    description: "ToC section 7, interactive checklist table seeded from LAIQ inspection app checklist export.",
    content,
    aiHint:
      "Render the checklist as the sample report response grid. Do not summarize away the individual checklist rows.",
    templateExpectation:
      "Checklist table grouped by section with response columns 1, 2, 3, 4, IA, NE, and N/A.",
    sourceSummary:
      "Imported: all checklist item prompts and selected responses from LAIQ inspection app V3. Manual: reviewer can change final response selections.",
    missingFields: [],
  };
}

function buildChecklistTableHtml(exportPackage: V2ProductExportPackage): string {
  const ratingColumns = ["1", "2", "3", "4", "IA", "NE", "N/A"];
  const groupedItems = new Map<string, typeof exportPackage.inspectionChecklistItems>();

  for (const item of exportPackage.inspectionChecklistItems) {
    const key = item.sectionTitle;
    groupedItems.set(key, [...(groupedItems.get(key) ?? []), item]);
  }

  const groups = [...groupedItems.entries()]
    .map(([sectionTitle, items]) => {
      const rows = items
        .map((item) => {
          const responseCells = ratingColumns
            .map((rating) => {
              const selected = item.ratingKey === rating || item.ratingLabel === rating || mapRatingLabelToCode(item.ratingLabel) === rating;
              return `<td class="checklist-response-cell">${selected ? "●" : ""}</td>`;
            })
            .join("");

          return `<tr><td class="checklist-item-number">${escapeReportHtml(item.itemNumber)}</td><td>${escapeReportHtml(
            item.itemPrompt,
          )}</td>${responseCells}</tr>`;
        })
        .join("");

      return [
        `<tr class="checklist-section-row"><th colspan="${ratingColumns.length + 2}">${escapeReportHtml(
          sectionTitle.toUpperCase(),
        )}</th></tr>`,
        `<tr><th>No.</th><th>Inspection Item</th>${ratingColumns
          .map((rating) => `<th>${escapeReportHtml(rating)}</th>`)
          .join("")}</tr>`,
        rows,
      ].join("");
    })
    .join("");

  return [
    "<h3>7 TANK INSPECTION CHECKLIST</h3>",
    "<p>Checklist responses are imported from the LAIQ inspection app V3 export. The response grid follows the sample report columns and is intended to become an editable table in the report platform.</p>",
    `<div class="report-table-wrap"><table class="report-measurement-table checklist-report-table"><tbody>${groups}</tbody></table></div>`,
    "<p><em>Legend: 1 Good Condition; 2 Satisfactory Condition; 3 Requires Repair/Action; 4 Poor, Requires Immediate Attention; IA In-accessible; NE None Evident; N/A Not applicable.</em></p>",
  ].join("");
}

function mapRatingLabelToCode(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized.includes("good")) return "1";
  if (normalized.includes("satisfactory")) return "2";
  if (normalized.includes("repair")) return "3";
  if (normalized.includes("poor")) return "4";
  if (normalized.includes("in-accessible") || normalized.includes("inaccessible")) return "IA";
  if (normalized.includes("none evident")) return "NE";
  if (normalized.includes("not applicable")) return "N/A";
  if (normalized.includes("not to code")) return "3";
  return null;
}

function escapeReportHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isPhotoAttachment(attachment: V2ProductExportAttachment): boolean {
  return attachment.kind === "photo" || attachment.kind === "finding_photo";
}

function buildApiStandardTocSections(
  exportPackage: V2ProductExportPackage,
  manualSupplement: ManualReportSupplement,
  layoutMaps: ExportedLayoutMaps,
): ReportSection[] {
  return API_STANDARD_REPORT_TOC.map((tocSection) => {
    if (tocSection.id === "scope-of-inspection") {
      return alignSectionToToc(buildScopeSection(exportPackage, manualSupplement), tocSection);
    }
    if (tocSection.id === "inspection-maintenance-regime") {
      return alignSectionToToc(buildMaintenanceRegimeSection(exportPackage, manualSupplement), tocSection);
    }
    if (tocSection.id === "general-tank-information") {
      return alignSectionToToc(buildGeneralInfoSection(exportPackage, manualSupplement), tocSection);
    }
    if (tocSection.id === "inspection-report") {
      return alignSectionToToc(buildInspectionReportSection(exportPackage, manualSupplement), tocSection);
    }
    if (tocSection.id === "repair-recommendations") {
      return alignSectionToToc(buildRecommendationSection(exportPackage, manualSupplement), tocSection);
    }
    if (tocSection.id === "tank-inspection-checklist") {
      return alignSectionToToc(buildTankInspectionChecklistSection(exportPackage), tocSection);
    }
    if (tocSection.id === "photographs") {
      return alignSectionToToc(buildPhotographsSection(exportPackage), tocSection);
    }
    if (tocSection.kind === "map") {
      return buildApiStandardMapSection(exportPackage, manualSupplement, layoutMaps, tocSection);
    }

    return buildApiStandardPlaceholderSection(exportPackage, tocSection);
  });
}

function alignSectionToToc(section: ReportSection, tocSection: ApiStandardTocSection): ReportSection {
  return {
    ...section,
    id: tocSection.id,
    number: tocSection.number,
    title: tocSection.title,
    shortLabel: tocSection.shortLabel,
    description: `ToC section ${tocSection.number}, page ${tocSection.pageStart} in ${API_STANDARD_PRIMARY_REPORT.sourceReportName}.`,
  };
}

function buildApiStandardMapSection(
  exportPackage: V2ProductExportPackage,
  manualSupplement: ManualReportSupplement,
  layoutMaps: ExportedLayoutMaps,
  tocSection: ApiStandardTocSection,
): ReportSection {
  const layoutMap =
    tocSection.layoutSurface === "roof"
      ? layoutMaps.roof
      : tocSection.layoutSurface === "floor"
        ? layoutMaps.floor
        : tocSection.layoutSurface === "shell"
          ? layoutMaps.shell
          : undefined;

  if (layoutMap) {
    const section = buildMapSection(exportPackage, manualSupplement, layoutMap, {
      id: tocSection.id,
      number: tocSection.number,
      title: tocSection.title,
      shortLabel: tocSection.shortLabel,
      drawing: `Section-${tocSection.number}`,
    });

    return {
      ...section,
      description: `ToC section ${tocSection.number}, page ${tocSection.pageStart} in ${API_STANDARD_PRIMARY_REPORT.sourceReportName}.`,
    };
  }

  const content = `${tocSection.number}       ${tocSection.title.toUpperCase()}

This layout section is present in the API-standard sample report and is reserved for the ${tocSection.layoutSurface ?? "tank"} layout preview.

Current LAIQ app export status: no structured ${tocSection.layoutSurface ?? "surface"} layout geometry was imported for this report section.

The report platform should not invent plate dimensions, MFL platemaps, roof layout, or floor corrosion maps. Once the app export provides this geometry, the preview should follow the LAIQ inspection app map model first; editing can be reintroduced only after parity is approved.`;

  return {
    id: tocSection.id,
    number: tocSection.number,
    title: tocSection.title,
    shortLabel: tocSection.shortLabel,
    kind: "map",
    generated: true,
    edited: false,
    approved: false,
    reviewRequired: true,
    description: `ToC section ${tocSection.number}, page ${tocSection.pageStart} in ${API_STANDARD_PRIMARY_REPORT.sourceReportName}.`,
    content,
    aiHint: "Do not fabricate geometry. Use this page as a controlled missing-data placeholder until a matching LAIQ app export surface exists.",
    templateExpectation: "API-standard layout page with controlled drawing block, legend, and editable geometry once source data exists.",
    sourceSummary:
      "Imported: no matching structured layout surface yet. Manual: final report-side source selection. Derived: pending layout workspace shell.",
    missingFields: [
      makeField({
        id: `${tocSection.id}-layout-source`,
        label: `${tocSection.title} Source`,
        input: "text",
        suggestion: "Import structured layout data from LAIQ inspection app V3 or attach approved worksheet/map source.",
        reason: "This API-standard section exists in the report ToC but the current LAIQ app export does not yet provide this surface geometry.",
        source: "Report-side/manual or future LAIQ app export input",
      }),
    ],
  };
}

function buildApiStandardPlaceholderSection(
  exportPackage: V2ProductExportPackage,
  tocSection: ApiStandardTocSection,
): ReportSection {
  const appSourceSummary = getAppSourcedSectionSummary(exportPackage, tocSection.id);
  const missingFields = appSourceSummary
    ? []
    : [
        makeField({
          id: `${tocSection.id}-content-source`,
          label: `${tocSection.title} Source Data`,
          input: "textarea",
          suggestion: "Confirm imported worksheet/calculation data or provide approved report-side content for this section.",
          reason: "This API-standard section needs section-specific values before final issue.",
          source: "Report-side manual input or future LAIQ app export field",
        }),
      ];
  const content = `${tocSection.number}       ${tocSection.title.toUpperCase()}

This section follows the API-standard sample report ToC and is generated as a controlled placeholder from the current LAIQ inspection app V3 export.

Imported baseline available now:
- Client: ${exportPackage.task.client}
- Tank: ${exportPackage.task.tankNumber}
- Inspection reference: ${exportPackage.inspectionReference}
- Imported findings: ${exportPackage.findings.length}
- Imported UT rows: ${exportPackage.utMeasurements.length}
- Imported attachments: ${exportPackage.attachments.length}
${appSourceSummary ? `- Section app source: ${appSourceSummary}` : ""}

${appSourceSummary
  ? "This section is sourced from the LAIQ inspection app V3 export and does not require a separate report-side source-data confirmation."
  : "The final section content must be completed using approved report-side inputs, calculations, worksheets, or future LAIQ app export fields that correspond to this exact ToC section."}`;

  return {
    id: tocSection.id,
    number: tocSection.number,
    title: tocSection.title,
    shortLabel: tocSection.shortLabel,
    kind: tocSection.kind,
    generated: true,
    edited: false,
    approved: false,
    reviewRequired: true,
    description: `ToC section ${tocSection.number}, page ${tocSection.pageStart} in ${API_STANDARD_PRIMARY_REPORT.sourceReportName}.`,
    content,
    aiHint: "Use the API-standard sample report for formatting, but do not invent missing worksheet values or calculations.",
    templateExpectation: "Match the sample report section order, heading style, and table/page-block conventions.",
    sourceSummary:
      appSourceSummary
        ? `Imported: ${appSourceSummary}. Manual: final wording approval only.`
        : "Imported: LAIQ inspection app V3 package baseline. Manual: worksheet values, calculations, and final report-side approval where missing.",
    missingFields,
  };
}

function getAppSourcedSectionSummary(
  exportPackage: V2ProductExportPackage,
  sectionId: string,
): string | null {
  const scopes: Record<string, { targetKey: string; itemKind: string; label: string }> = {
    "roof-plate-thickness-measurements": {
      targetKey: "external_roof",
      itemKind: "region",
      label: "roof plate UT readings",
    },
    "roof-nozzle-reinforcement-pad-thickness-measurements": {
      targetKey: "external_roof",
      itemKind: "element",
      label: "roof nozzle and reinforcement pad UT readings",
    },
    "shell-plate-thickness-measurements": {
      targetKey: "shell",
      itemKind: "region",
      label: "shell plate UT readings",
    },
    "shell-nozzle-reinforcement-pad-thickness-measurements": {
      targetKey: "shell",
      itemKind: "element",
      label: "shell nozzle and reinforcement pad UT readings",
    },
  };
  const scope = scopes[sectionId];
  if (!scope) return null;

  const rowCount = exportPackage.utMeasurements.filter(
    (measurement) => measurement.targetKey === scope.targetKey && measurement.itemKind === scope.itemKind,
  ).length;

  return rowCount > 0
    ? `${rowCount} ${scope.label} from LAIQ app export ${exportPackage.inspectionReference}`
    : null;
}

function buildSketchSections(
  exportPackage: V2ProductExportPackage,
  manualSupplement: ManualReportSupplement,
  shellLayoutMap: LayoutMapData | undefined,
): ReportSection[] {
  const specs: SketchSectionSpec[] = [
    {
      id: "findings-mpi-horizontal-weld-7",
      number: "7",
      title: "Findings / MPI Locations on Shell Internal - Horizontal Weld 7",
      shortLabel: "Sketch 1",
      drawing: "Sketch-1",
    },
    {
      id: "findings-mpi-horizontal-weld-6",
      number: "8",
      title: "Findings / MPI Locations on Shell Internal - Horizontal Weld 6",
      shortLabel: "Sketch 2",
      drawing: "Sketch-2",
    },
    {
      id: "findings-mpi-horizontal-weld-5",
      number: "9",
      title: "Findings / MPI Locations on Shell Internal - Horizontal Weld 5",
      shortLabel: "Sketch 3",
      drawing: "Sketch-3",
    },
    {
      id: "findings-mpi-horizontal-weld-4",
      number: "10",
      title: "Findings / MPI Locations on Shell Internal - Horizontal Weld 4",
      shortLabel: "Sketch 4",
      drawing: "Sketch-4",
    },
    {
      id: "findings-mpi-horizontal-weld-3",
      number: "11",
      title: "Findings / MPI Locations on Shell Internal - Horizontal Weld 3",
      shortLabel: "Sketch 5",
      drawing: "Sketch-5",
    },
    {
      id: "findings-mpi-shell-external-curb-angle-welds-horizontal-weld-6",
      number: "12",
      title: "Findings / MPI Locations on Shell External - Curb Angle Welds & Horizontal Weld 6",
      shortLabel: "Sketch 6",
      drawing: "Sketch-6",
    },
  ];

  return specs.map((spec) => buildMapSection(exportPackage, manualSupplement, shellLayoutMap, spec));
}

function buildMapSection(
  exportPackage: V2ProductExportPackage,
  manualSupplement: ManualReportSupplement,
  baseLayoutMap: LayoutMapData | undefined,
  spec: SketchSectionSpec,
): ReportSection {
  const layoutMap = baseLayoutMap
    ? {
        ...baseLayoutMap,
        id: spec.id,
        title: spec.title,
        drawingBlock: {
          ...baseLayoutMap.drawingBlock,
          drawing: spec.drawing,
        },
      }
    : undefined;
  const surfaceLabel = layoutMap?.surfaceLabel ?? "layout";
  const content = `${spec.number}       ${spec.title.toUpperCase()}

This sketch page is anchored to imported vertical tank ${surfaceLabel.toLowerCase()} metadata.

➢ Marker positions are derived from the exported layout metadata, UT-linked findings, and app element coordinates.

➢ App elements are imported directly from LAIQ app placement coordinates.

➢ Reviewer sign-off items remain editable on the report platform without mutating the underlying field export.`;

  return {
    id: spec.id,
    number: spec.number,
    title: spec.title,
    shortLabel: spec.shortLabel,
    kind: "map",
    generated: true,
    edited: true,
    approved: false,
    reviewRequired: true,
    description: `ToC section ${spec.number}, map-enabled sketch page compiled from exported ${surfaceLabel.toLowerCase()} geometry.`,
    content,
    aiHint: "Only adjust captioning or report-side overrides. Do not rewrite imported geometry facts.",
    templateExpectation: "Sketch title, printable map, legend, and drawing block tied to imported geometry.",
    sourceSummary:
      `Imported: ${surfaceLabel.toLowerCase()} layout config, elements, findings. Manual: checked-by and legend note. Derived: marker positioning from export labels.`,
    missingFields: [
      makeField({
        id: "checkedBy",
        label: "Checked By",
        input: "text",
        value: manualSupplement.checkedBy,
        suggestion: "VT",
        reason: "The drawing block still needs the report-side checker initials.",
        source: "Report-side manual input",
      }),
      makeField({
        id: "legendNote",
        label: "Legend Note",
        input: "text",
        value: manualSupplement.legendNote,
        suggestion: spec.id === "floor-plate-corrosion-plan"
          ? "Corrosion percentages are overlaid from reviewed MFL plate scans on the imported floor plate layout."
          : `Report markers are shown against the imported ${surfaceLabel.toLowerCase()} baseline geometry.`,
        reason: "One final legend note is still needed for the printable sketch page.",
        source: "Report-side manual input",
      }),
    ],
    layoutMap,
  };
}

function buildAttachmentSection(
  exportPackage: V2ProductExportPackage,
  manualSupplement: ManualReportSupplement,
): ReportSection {
  const attachmentNames = exportPackage.attachments.map((attachment) => attachment.displayName).join(", ");
  const content = `Attachment shell for the imported evidence package.

Imported attachment set:
- ${attachmentNames}

Use this page family for structured NDT forms, supporting photo pages, and final sign-off metadata that remains report-side.`;

  return {
    id: "attachment-mpi-report",
    number: "A1",
    title: "Attachment - Magnetic Particle Inspection Report",
    shortLabel: "MPI Attachment",
    kind: "attachment",
    generated: true,
    edited: false,
    approved: false,
    reviewRequired: false,
    description: "Attachment section after ToC section 12, matching the sample MPI report form family.",
    content,
    aiHint: "Keep the page form-like and evidence-driven rather than narrative.",
    templateExpectation: "Boxed attachment metadata, result form layout, and technician sign-off block.",
    sourceSummary:
      "Imported: attachment registry and finding links. Manual: certification and sign-off details. Derived: attachment page shell.",
    missingFields: [
      makeField({
        id: "certificationNumber",
        label: "Certification Number",
        input: "text",
        value: manualSupplement.certificationNumber,
        suggestion: "ASNT-TC-1A",
        reason: "The final attachment issue still needs its certification or qualification detail.",
        source: "Report-side manual input",
      }),
    ],
  };
}

function buildAttachmentPhotographsSection(exportPackage: V2ProductExportPackage): ReportSection {
  const content = `ATTACHMENT - MAGNETIC PARTICLES INSPECTION PHOTOGRAPHS

This attachment section is reserved for MPI supporting photographs after the structured MPI report forms.

Imported evidence count: ${exportPackage.attachments.length}

Final image placement and captions should follow the approved sample report attachment format.`;

  return {
    id: "attachment-mpi-photographs",
    number: "A2",
    title: "Attachment - Magnetic Particles Inspection Photographs",
    shortLabel: "MPI Photos",
    kind: "attachment",
    generated: true,
    edited: false,
    approved: false,
    reviewRequired: false,
    description: "Final sample-report attachment section for MPI photographs.",
    content,
    aiHint: "Keep this as a photo evidence attachment. Do not invent missing MPI images.",
    templateExpectation: "Attachment photo pages with formal captions and report issue header/footer treatment.",
    sourceSummary:
      "Imported: attachment registry and finding links. Manual: final MPI photograph selection and captions.",
    missingFields: [],
  };
}

function buildShellLayoutMap(
  exportPackage: V2ProductExportPackage,
  shellConfig: V2ProductExportLayoutConfig | undefined,
  manualSupplement: ManualReportSupplement,
): LayoutMapData | undefined {
  if (!shellConfig) return undefined;

  const gridRows = shellConfig.shellCourseCount ?? exportPackage.inspectionRecord.shellCourseCount ?? 8;
  const gridColumns = shellConfig.shellLaneCount ?? exportPackage.inspectionRecord.shellLaneCount ?? 4;
  const platesPerCourse = shellConfig.shellPlatesPerCourse ?? 9;
  const plateOffset = shellConfig.shellPlateOffset ?? "none";
  const offsetStartRow = shellConfig.shellOffsetStartRow ?? "even";
  const shellPlateSegments = buildAndroidShellPlateSegments(
    gridRows,
    platesPerCourse,
    plateOffset,
    offsetStartRow,
    shellConfig.shellThirdOffsetStart,
  );
  const evidenceByKey = buildShellRegionEvidenceIndex(exportPackage, gridRows, gridColumns);
  const findingMarkers = exportPackage.findings
    .filter((finding) => finding.targetKey === "shell" && !isElementLinkedFinding(finding))
    .map((finding, index) => buildShellFindingMarker(finding, exportPackage, gridRows, gridColumns, index))
    .filter((marker): marker is LayoutMarker => marker != null);
  const elementMarkers = buildTargetElementMarkers(exportPackage, "shell", {
    plates: shellPlateSegments,
    shellCourseCount: gridRows,
    shellLaneCount: gridColumns,
  });
  const markers = [...findingMarkers, ...elementMarkers];

  return {
    id: "shell-weld-7",
    title: "Findings / MPI Locations on Shell Internal - Horizontal Weld 7",
    subtitle: `Shell map: ${gridRows} courses, ${gridColumns} UT lanes, ${platesPerCourse} shell plates/course with ${humanizeKey(plateOffset)} offsets`,
    surfaceLabel: "Shell internal sketch",
    legend: [
      "Red lane headers = LAIQ app shell UT lanes L1-L4",
      "Light blue plate rectangles = shell plate segment background from app layout config",
      "Blue markers = findings/elements imported from LAIQ app placement and UT links",
    ],
    markers,
    plates: shellPlateSegments,
    evidenceByKey: {
      ...evidenceByKey,
      ...buildMarkerEvidenceIndex(markers),
    },
    gridRows,
    gridColumns,
    drawingBlock: {
      client: exportPackage.task.client,
      project: `Tank ${exportPackage.task.tankNumber} Vertical AST Shell Internal`,
      drawing: "Sketch-1",
      reference: manualSupplement.reportReference,
      referenceMode: humanizeKey(shellConfig.referenceMode ?? "tank_north"),
      updatedAtLabel: formatShortDate(exportPackage.exportedAtIso),
    },
    appMap: {
      surfaceType: "shell",
      referenceMode: humanizeKey(shellConfig.referenceMode ?? "tank_north"),
      referenceNote: shellConfig.referenceNote,
      shell: {
        courseCount: gridRows,
        platesPerCourse,
        laneCount: gridColumns,
        plateOffset,
        offsetStartRow,
        thirdOffsetStart: shellConfig.shellThirdOffsetStart,
      },
    },
    overrideCount: 0,
  };
}

function buildExportedLayoutMaps(
  exportPackage: V2ProductExportPackage,
  manualSupplement: ManualReportSupplement,
): ExportedLayoutMaps {
  const roofConfig = exportPackage.layoutConfigs.find((config) => config.targetKey === "external_roof");
  const shellConfig = exportPackage.layoutConfigs.find((config) => config.targetKey === "shell");
  const floorConfig = exportPackage.layoutConfigs.find((config) => config.targetKey === "floor");

  return {
    roof: buildRoofLayoutMap(exportPackage, roofConfig, manualSupplement),
    shell: buildShellLayoutMap(exportPackage, shellConfig, manualSupplement),
    floor: buildFloorLayoutMap(exportPackage, floorConfig, manualSupplement),
  };
}

function buildRoofLayoutMap(
  exportPackage: V2ProductExportPackage,
  roofConfig: V2ProductExportLayoutConfig | undefined,
  manualSupplement: ManualReportSupplement,
): LayoutMapData | undefined {
  if (!roofConfig) return undefined;

  const gridRows = roofConfig.roofRowCount ?? 6;
  const gridColumns = roofConfig.roofWidestRowPlateCount ?? 11;
  const customPlates = buildCustomCircularPlateCells(
    roofConfig.customCircularLayout,
    "android:RoofSurfaceMap:custom_circular_plate",
    gridRows,
    gridColumns,
  );
  const basePlates =
    customPlates.length > 0
      ? customPlates
      : buildAndroidCircularPlateCells(gridRows, gridColumns, "android:RoofSurfaceMap:circular_plate");
  const plates = basePlates.map(
    (plate) => ({
      ...plate,
      evidence: buildRegionEvidence(exportPackage, "external_roof", plate.id),
    }),
  );
  const markers = [
    ...buildTargetFindingMarkers(exportPackage, "external_roof", plates),
    ...buildTargetElementMarkers(exportPackage, "external_roof", { plates }),
  ];

  return {
    id: "roof-plate-layout",
    title: "Roof Plate Layout",
    subtitle:
      customPlates.length > 0
        ? `Roof map: V3 app custom circular plate layout, ${gridRows} rows, ${plates.length} visible plates`
        : `Roof map: circular plate template, ${gridRows} rows, ${gridColumns} widest-row plates, ${plates.length} visible plates`,
    surfaceLabel: "Roof plate layout",
    legend: [
      "Circular clipped plate layout follows LAIQ app RoofSurfaceMap",
      "Numbered cells = app roof plate numbering, including staggered reverse rows",
      "Blue markers = imported findings/elements from LAIQ app export",
    ],
    markers,
    plates,
    evidenceByKey: {
      ...buildPlateEvidenceIndex(plates),
      ...buildMarkerEvidenceIndex(markers),
    },
    gridRows,
    gridColumns,
    drawingBlock: {
      client: exportPackage.task.client,
      project: `Tank ${exportPackage.task.tankNumber} External Roof Layout`,
      drawing: "Section-9",
      reference: manualSupplement.reportReference,
      referenceMode: humanizeKey(roofConfig.referenceMode ?? "tank_north"),
      updatedAtLabel: formatShortDate(exportPackage.exportedAtIso),
    },
    appMap: {
      surfaceType: "roof",
      referenceMode: humanizeKey(roofConfig.referenceMode ?? "tank_north"),
      referenceNote: roofConfig.referenceNote,
      roof: {
        template: roofConfig.roofPattern ?? "circular_plate",
        rowCount: gridRows,
        widestRowPlateCount: gridColumns,
        hasCenterOpening: roofConfig.roofHasCenterOpening ?? false,
        hasAnnularRing: roofConfig.roofHasAnnularRing ?? false,
        annularSectionCount: roofConfig.roofAnnularSectionCount ?? 0,
        customCircularLayout: roofConfig.customCircularLayout,
      },
    },
    overrideCount: 0,
  };
}

function buildFloorLayoutMap(
  exportPackage: V2ProductExportPackage,
  floorConfig: V2ProductExportLayoutConfig | undefined,
  manualSupplement: ManualReportSupplement,
): LayoutMapData | undefined {
  if (!floorConfig) return undefined;

  const floorPlateCount = floorConfig.floorPlateCount ?? 0;
  const gridRows = floorConfig.floorPatternCountX ?? Math.max(1, Math.ceil(Math.sqrt(floorPlateCount || 36)));
  const gridColumns =
    floorConfig.floorPatternCountY ?? Math.max(1, Math.ceil((floorPlateCount || gridRows) / gridRows));
  const requiresResolvedGeometry =
    exportPackage.packageType === "v3_product_export" && exportPackage.schemaVersion >= 3;
  const customPlates = buildCustomCircularPlateCells(
    floorConfig.customCircularLayout,
    "v3-app:FloorSurfaceMap:custom_circular_plate",
    gridRows,
    gridColumns,
    "floor",
    !requiresResolvedGeometry,
  );
  const mainPlates = customPlates.length > 0
    ? customPlates.map((plate) => ({ ...plate, plateKind: "main" as const }))
    : requiresResolvedGeometry
      ? []
      : buildAndroidCircularPlateCells(gridRows, gridColumns, "v3-app:FloorSurfaceMap:circular_plate")
        .map((plate) => ({ ...plate, plateKind: "main" as const }));
  const customLayoutSettings = readCircularLayoutSettings(floorConfig.customCircularLayout);
  const resolvedAnnularPlates = buildResolvedAnnularPlateGeometry(
    floorConfig.customCircularLayout,
    "v3-app:FloorSurfaceMap:annular_ring:resolved",
  );
  const annularPlates = floorConfig.floorTemplate === "circular_plate_ar"
    ? resolvedAnnularPlates.length > 0
      ? resolvedAnnularPlates
      : requiresResolvedGeometry
        ? []
        : buildV3AppAnnularRingSections(
          floorConfig.floorAnnularSectionCount ?? 0,
          customLayoutSettings.annularRotationDeg,
          customLayoutSettings.annularWidthRatio,
          "v3-app:FloorSurfaceMap:annular_ring:legacy_fallback",
        )
    : [];
  const plates = [...mainPlates, ...annularPlates].map(
    (plate) => ({
      ...plate,
      evidence: buildRegionEvidence(exportPackage, "floor", plate.id),
    }),
  );
  const markers = [
    ...buildTargetFindingMarkers(exportPackage, "floor", plates),
    ...buildTargetElementMarkers(exportPackage, "floor", { plates }),
  ];
  const appFigure = exportPackage.layoutFigures?.find((figure) => figure.targetKey === "floor");

  return {
    id: "floor-plate-layout",
    geometrySource: "app_export",
    title: "Floor Plate Layout With Platemaps Numbering System",
    subtitle: customPlates.length > 0
      ? `V3 app floor layout: ${gridRows} rows, ${mainPlates.length} bottom plates, ${annularPlates.length} AR sections`
      : `Floor map: circular plate template, ${gridRows} rows, ${gridColumns} widest-row plates, ${plates.length} visible plates`,
    surfaceLabel: "Floor/bottom plate layout",
    legend: [
      "Plate, label, and AR polygon geometry is imported directly from the LAIQ inspection app V3 export",
      "Blue markers = imported floor findings/elements from LAIQ app export",
    ],
    markers,
    plates,
    evidenceByKey: {
      ...buildPlateEvidenceIndex(plates),
      ...buildMarkerEvidenceIndex(markers),
    },
    gridRows,
    gridColumns,
    drawingBlock: {
      client: exportPackage.task.client,
      project: `Tank ${exportPackage.task.tankNumber} Floor Plate Layout`,
      drawing: "Section-28",
      reference: manualSupplement.reportReference,
      referenceMode: humanizeKey(floorConfig.referenceMode ?? "tank_north"),
      updatedAtLabel: formatShortDate(exportPackage.exportedAtIso),
    },
    appMap: {
      surfaceType: "floor",
      referenceMode: humanizeKey(floorConfig.referenceMode ?? "tank_north"),
      referenceNote: floorConfig.referenceNote,
      floor: {
        template: floorConfig.floorTemplate ?? "circular_plate",
        rowCount: gridRows,
        widestRowPlateCount: gridColumns,
        plateCount: floorPlateCount || plates.length,
        hasAnnularRing: floorConfig.floorTemplate === "circular_plate_ar",
        annularSectionCount: floorConfig.floorAnnularSectionCount ?? 0,
        annularRotationDeg: customLayoutSettings.annularRotationDeg,
        annularWidthRatio: customLayoutSettings.annularWidthRatio,
        customCircularLayout: floorConfig.customCircularLayout,
      },
    },
    appFigure,
    overrideCount: 0,
  };
}

function readCircularLayoutSettings(customLayout: unknown): {
  annularRotationDeg: number;
  annularWidthRatio: number;
} {
  if (!customLayout || typeof customLayout !== "object" || Array.isArray(customLayout)) {
    return { annularRotationDeg: 0, annularWidthRatio: 0.12 };
  }
  const candidate = customLayout as Record<string, unknown>;
  return {
    annularRotationDeg: typeof candidate.annularRotationDeg === "number" ? candidate.annularRotationDeg : 0,
    annularWidthRatio: typeof candidate.annularWidthRatio === "number" ? candidate.annularWidthRatio : 0.12,
  };
}

function buildTargetElementMarkers(
  exportPackage: V2ProductExportPackage,
  targetKey: string,
  options: MarkerBuildOptions = {},
): LayoutMarker[] {
  return exportPackage.elements
    .filter((element) => element.targetKey === targetKey)
    .map((element) => {
      const position =
        targetKey === "external_roof" || targetKey === "floor"
          ? {
              x: clamp(element.normalizedX, 0, 1),
              y: clamp(element.normalizedY, 0, 1),
            }
          : {
              x: clamp(element.normalizedX, 0, 1),
              y: clamp(element.normalizedY, 0, 1),
            };
      const hostLocation = deriveMarkerHostLocation(targetKey, position, options);

      return {
        id: element.elementId,
        label: element.elementLabel,
        type: "element" as const,
        x: position.x,
        y: position.y,
        source: `v3-app:element:${element.elementTypeKey}`,
        hostLocation,
        evidence: buildElementEvidence(exportPackage, element, hostLocation),
      };
    });
}

function buildTargetFindingMarkers(
  exportPackage: V2ProductExportPackage,
  targetKey: string,
  plates: LayoutMapData["plates"],
): LayoutMarker[] {
  return exportPackage.findings
    .filter((finding) => finding.targetKey === targetKey && !isElementLinkedFinding(finding))
    .map((finding, index) => buildSurfaceFindingMarker(finding, exportPackage.elements, exportPackage.attachments, plates, index));
}

function isElementLinkedFinding(finding: Pick<V2ProductExportFinding, "linkedUtItemKey">): boolean {
  return getLinkedElementId(finding.linkedUtItemKey) != null;
}

function getLinkedElementId(linkedUtItemKey: string | null | undefined): string | null {
  return /:element:([^:]+)$/i.exec(linkedUtItemKey ?? "")?.[1] ?? null;
}

function getLinkedRegionId(linkedUtItemKey: string | null | undefined): string | null {
  return /:region:(.+)$/i.exec(linkedUtItemKey ?? "")?.[1] ?? null;
}

function buildSurfaceFindingMarker(
  finding: V2ProductExportFinding,
  elements: V2ProductExportElement[],
  attachments: V2ProductExportAttachment[],
  plates: LayoutMapData["plates"],
  index: number,
): LayoutMarker {
  const linkedElementId = getLinkedElementId(finding.linkedUtItemKey);
  const linkedElement = linkedElementId ? elements.find((element) => element.elementId === linkedElementId) : undefined;
  const evidence = buildFindingEvidenceBundle(finding, elements, attachments);
  if (linkedElement) {
    const position = coerceCircularMarkerPosition(linkedElement.normalizedX + 0.025, linkedElement.normalizedY + 0.025);
    const hostLocation = deriveMarkerHostLocation(finding.targetKey, position, { plates });
    return {
      id: finding.findingId,
      label: finding.itemLabel,
      type: "finding",
      x: position.x,
      y: position.y,
      source: `finding:${finding.linkedUtItemKey ?? finding.itemLabel}`,
      hostLocation,
      evidence: appendHostLocationEvidence(evidence, hostLocation),
    };
  }

  const linkedRegionId = getLinkedRegionId(finding.linkedUtItemKey);
  const linkedPlate = linkedRegionId
    ? plates.find((plate) => plate.id === linkedRegionId || plate.aliases?.includes(linkedRegionId))
    : undefined;
  if (linkedPlate) {
    const position = {
      x: linkedPlate.labelX ?? linkedPlate.x + linkedPlate.width / 2,
      y: linkedPlate.labelY ?? linkedPlate.y + linkedPlate.height / 2,
    };
    const hostLocation = deriveMarkerHostLocation(finding.targetKey, position, { plates });
    return {
      id: finding.findingId,
      label: finding.itemLabel,
      type: "finding",
      x: clamp(position.x, 0.02, 0.98),
      y: clamp(position.y, 0.02, 0.98),
      source: `finding:${finding.linkedUtItemKey ?? finding.itemLabel}`,
      hostLocation,
      evidence: appendHostLocationEvidence(evidence, hostLocation),
    };
  }

  const plateNumber = extractPlateNumber(finding.linkedUtItemKey) ?? extractPlateNumber(finding.itemLabel);
  if (plateNumber != null && plateNumber > 0) {
    const matchingPlate = plates.find((plate) => plate.id === plateNumber.toString());
    const x = matchingPlate ? matchingPlate.x + matchingPlate.width / 2 : 0.5;
    const y = matchingPlate ? matchingPlate.y + matchingPlate.height / 2 : 0.5;

    return {
      id: finding.findingId,
      label: finding.itemLabel,
      type: "finding",
      x: clamp(x, 0.08, 0.92),
      y: clamp(y, 0.12, 0.88),
      source: `finding:${finding.linkedUtItemKey ?? finding.itemLabel}`,
      evidence,
    };
  }

  const position = coerceCircularMarkerPosition(0.14 + index * 0.08, 0.22 + index * 0.06);
  return {
    id: finding.findingId,
    label: finding.itemLabel,
    type: "finding",
    x: position.x,
    y: position.y,
    source: `finding:${finding.findingId}`,
    evidence,
  };
}

function buildShellFindingMarker(
  finding: V2ProductExportFinding,
  exportPackage: V2ProductExportPackage,
  courseCount: number,
  laneCount: number,
  index: number,
): LayoutMarker {
  const elements = exportPackage.elements;
  const linkedElementId = getLinkedElementId(finding.linkedUtItemKey);
  const linkedElement = linkedElementId ? elements.find((element) => element.elementId === linkedElementId) : undefined;
  const evidence = buildFindingEvidenceBundle(finding, elements, exportPackage.attachments);

  if (linkedElement) {
    const position = {
      x: clamp(linkedElement.normalizedX + 0.025, 0.08, 0.92),
      y: clamp(linkedElement.normalizedY + 0.025, 0.12, 0.88),
    };
    const hostLocation = deriveMarkerHostLocation("shell", position, {
      shellCourseCount: courseCount,
      shellLaneCount: laneCount,
    });
    return {
      id: finding.findingId,
      label: finding.itemLabel,
      type: "finding",
      x: position.x,
      y: position.y,
      source: `finding:${finding.linkedUtItemKey ?? finding.itemLabel}`,
      hostLocation,
      evidence: appendHostLocationEvidence(evidence, hostLocation),
    };
  }

  const regionMatch = /:region:(L\d+)-C(\d+)/i.exec(finding.linkedUtItemKey ?? "");
  const regionPosition = regionMatch
    ? shellRegionMarkerPosition(regionMatch[1], Number(regionMatch[2]), laneCount, courseCount)
    : null;

  if (regionPosition) {
    return {
      id: finding.findingId,
      label: finding.itemLabel,
      type: "finding",
      x: regionPosition.x,
      y: regionPosition.y,
      source: `finding:${finding.linkedUtItemKey ?? finding.itemLabel}`,
      evidence,
    };
  }

  return {
    id: finding.findingId,
    label: finding.itemLabel,
    type: "finding",
    x: clamp(0.12 + index * 0.08, 0.08, 0.92),
    y: clamp(0.2 + index * 0.04, 0.12, 0.88),
    source: `finding:${finding.findingId}`,
    evidence,
  };
}

function buildShellRegionEvidenceIndex(
  exportPackage: V2ProductExportPackage,
  courseCount: number,
  laneCount: number,
): Record<string, LayoutEvidenceItem[]> {
  return Array.from({ length: courseCount }).reduce<Record<string, LayoutEvidenceItem[]>>((acc, _, courseIndex) => {
    const course = courseIndex + 1;
    Array.from({ length: laneCount }).forEach((__, laneIndex) => {
      const regionId = `L${laneIndex + 1}-C${course}`;
      acc[regionId] = buildRegionEvidence(exportPackage, "shell", regionId);
    });
    return acc;
  }, {});
}

function buildPlateEvidenceIndex(plates: LayoutMapData["plates"]): Record<string, LayoutEvidenceItem[]> {
  return plates.reduce<Record<string, LayoutEvidenceItem[]>>((acc, plate) => {
    acc[plate.id] = plate.evidence ?? [];
    return acc;
  }, {});
}

function buildMarkerEvidenceIndex(markers: LayoutMarker[]): Record<string, LayoutEvidenceItem[]> {
  return markers.reduce<Record<string, LayoutEvidenceItem[]>>((acc, marker) => {
    acc[marker.id] = marker.evidence ?? [];
    return acc;
  }, {});
}

function buildRegionEvidence(
  exportPackage: V2ProductExportPackage,
  targetKey: string,
  regionId: string,
): LayoutEvidenceItem[] {
  const measurements = exportPackage.utMeasurements
    .filter((measurement) => measurement.targetKey === targetKey && measurementMatchesRegion(measurement, targetKey, regionId))
    .map(buildMeasurementEvidence);
  const findings = exportPackage.findings
    .filter((finding) => finding.targetKey === targetKey && findingMatchesRegion(finding, targetKey, regionId))
    .map((finding) => buildFindingEvidence(finding, exportPackage.attachments));

  return [...measurements, ...findings];
}

function buildElementEvidence(
  exportPackage: V2ProductExportPackage,
  element: V2ProductExportElement,
  hostLocation?: MarkerHostLocation,
): LayoutEvidenceItem[] {
  const measurements = exportPackage.utMeasurements
    .filter((measurement) => measurement.targetKey === element.targetKey && measurement.elementId === element.elementId)
    .map(buildMeasurementEvidence);
  const findings = exportPackage.findings
    .filter((finding) => finding.targetKey === element.targetKey && finding.linkedUtItemKey?.endsWith(`:element:${element.elementId}`))
    .map((finding) => buildFindingEvidence(finding, exportPackage.attachments));

  return [
    {
      id: `element-${element.elementId}`,
      kind: "element",
      title: element.elementLabel,
      subtitle: humanizeKey(element.elementTypeKey),
      values: [
        `Position ${formatPercent(element.normalizedX)} / ${formatPercent(element.normalizedY)}`,
        ...(hostLocation ? hostLocationEvidenceValues(hostLocation) : []),
      ],
      source: `app element:${element.elementId}`,
    },
    ...measurements,
    ...findings,
  ];
}

function deriveMarkerHostLocation(
  targetKey: string,
  position: { x: number; y: number },
  options: MarkerBuildOptions,
): MarkerHostLocation | undefined {
  if (targetKey === "external_roof" || targetKey === "floor") {
    const plate = findHostPlate(options.plates ?? [], position);
    if (!plate) return undefined;
    return {
      surface: targetKey === "external_roof" ? "roof" : "floor",
      label: `Plate ${plate.id}`,
      plateId: plate.id,
      source: "derived_from_app_coordinates",
    };
  }

  if (targetKey === "shell") {
    const laneCount = Math.max(options.shellLaneCount ?? 4, 1);
    const courseCount = Math.max(options.shellCourseCount ?? 1, 1);
    const laneNumber = clamp(Math.floor(clamp(position.x, 0, 0.9999) * laneCount) + 1, 1, laneCount);
    const course = clamp(courseCount - Math.floor(clamp(position.y, 0, 0.9999) * courseCount), 1, courseCount);
    const regionId = `L${laneNumber}-C${course}`;
    const plate = findHostPlate(options.plates ?? [], position);
    const plateLabel = plate?.column ? `, shell plate ${plate.column}` : "";

    return {
      surface: "shell",
      label: `${shellLaneDisplayLabelForReport(laneNumber, laneCount)}-C${course}${plateLabel}`,
      regionId,
      course,
      laneId: `L${laneNumber}`,
      plateId: plate?.id,
      source: "derived_from_app_coordinates",
    };
  }

  return undefined;
}

function findHostPlate(plates: LayoutPlate[], position: { x: number; y: number }): LayoutPlate | undefined {
  const containingPlate = plates.find(
    (plate) =>
      position.x >= plate.x &&
      position.x <= plate.x + plate.width &&
      position.y >= plate.y &&
      position.y <= plate.y + plate.height,
  );
  if (containingPlate) return containingPlate;

  return plates
    .map((plate) => ({
      plate,
      distance:
        Math.abs(position.x - (plate.x + plate.width / 2)) +
        Math.abs(position.y - (plate.y + plate.height / 2)),
    }))
    .sort((a, b) => a.distance - b.distance)[0]?.plate;
}

function appendHostLocationEvidence(
  evidence: LayoutEvidenceItem[],
  hostLocation?: MarkerHostLocation,
): LayoutEvidenceItem[] {
  if (!hostLocation) return evidence;
  return [
    {
      id: `location-${hostLocation.label}`,
      kind: "element",
      title: hostLocation.label,
      subtitle: "Derived app location",
      values: hostLocationEvidenceValues(hostLocation),
      source: hostLocation.source,
    },
    ...evidence,
  ];
}

function hostLocationEvidenceValues(hostLocation: MarkerHostLocation): string[] {
  return [
    `Host location: ${hostLocation.label}`,
    hostLocation.source === "derived_from_app_coordinates"
      ? "Location source: derived from LAIQ app normalized coordinates and V3 layout geometry"
      : "Location source: exported by LAIQ inspection app",
  ];
}

function shellLaneDisplayLabelForReport(laneNumber: number, laneCount: number): string {
  if (laneCount === 4) return ["N", "E", "S", "W"][laneNumber - 1] ?? `L${laneNumber}`;
  return `L${laneNumber}`;
}

function buildFindingEvidenceBundle(
  finding: V2ProductExportFinding,
  elements: V2ProductExportElement[],
  attachments: V2ProductExportAttachment[],
): LayoutEvidenceItem[] {
  const linkedElementId = getLinkedElementId(finding.linkedUtItemKey);
  const linkedElement = linkedElementId ? elements.find((element) => element.elementId === linkedElementId) : undefined;

  return [
    buildFindingEvidence(finding, attachments),
    ...(linkedElement
      ? [
          {
            id: `element-${linkedElement.elementId}`,
            kind: "element" as const,
            title: linkedElement.elementLabel,
            subtitle: humanizeKey(linkedElement.elementTypeKey),
            values: [`Position ${formatPercent(linkedElement.normalizedX)} / ${formatPercent(linkedElement.normalizedY)}`],
            source: `app element:${linkedElement.elementId}`,
          },
        ]
      : []),
  ];
}

function buildMeasurementEvidence(measurement: V2ProductExportUtMeasurement): LayoutEvidenceItem {
  const readings = [
    measurement.value1,
    measurement.value2,
    measurement.value3,
    measurement.value4,
    measurement.value5,
  ].filter((value): value is number => value != null);
  const values = [
    readings.length > 0 ? `Readings: ${readings.map(formatThickness).join(" / ")}` : "No numeric readings exported",
    measurement.reinforcementPadReading != null ? `Reinforcement pad: ${formatThickness(measurement.reinforcementPadReading)}` : "",
    measurement.confirmed ? "Confirmed in app" : "Not confirmed",
  ].filter(Boolean);

  return {
    id: `measurement-${measurement.itemKey}`,
    kind: "measurement",
    title: measurement.itemLabel,
    subtitle: measurement.itemKind === "region" ? "UT region measurement" : "UT element measurement",
    values,
    source: `app ut:${measurement.itemKey}`,
  };
}

function buildFindingEvidence(
  finding: V2ProductExportFinding,
  attachments: V2ProductExportAttachment[] = [],
): LayoutEvidenceItem {
  const linkedAttachments = attachments
    .filter((attachment) => attachment.findingId === finding.findingId)
    .map((attachment) => ({
      attachmentId: attachment.attachmentId,
      displayName: attachment.displayName,
      relativePath: attachment.relativePath,
      mediaType: attachment.mediaType,
      fileExists: attachment.fileExists,
      kind: attachment.kind,
    }));

  return {
    id: `finding-${finding.findingId}`,
    kind: "finding",
    title: finding.itemLabel,
    subtitle: "Finding",
    note: finding.note,
    values: [
      `Attachments: ${finding.attachmentCount}`,
      finding.hasMissingAttachment ? "Missing attachment flagged" : "Attachment status clear",
    ],
    attachments: linkedAttachments,
    source: `app finding:${finding.findingId}`,
  };
}

function measurementMatchesRegion(
  measurement: V2ProductExportUtMeasurement,
  targetKey: string,
  regionId: string,
): boolean {
  if (measurement.itemKey === `${targetKey}:region:${regionId}`) return true;
  if (measurement.plateId === regionId) return true;

  if (targetKey !== "shell") return false;

  const laneNumber = extractLaneNumber(measurement.laneId) ?? extractLaneNumber(measurement.plateId);
  return laneNumber != null && measurement.course != null && `L${laneNumber}-C${measurement.course}` === regionId;
}

function findingMatchesRegion(finding: V2ProductExportFinding, targetKey: string, regionId: string): boolean {
  const linkedKey = finding.linkedUtItemKey ?? "";
  if (linkedKey === `${targetKey}:region:${regionId}`) return true;
  if (targetKey !== "shell") return false;

  const match = /:region:(L\d+)-C(\d+)/i.exec(linkedKey);
  return match ? `${match[1].toUpperCase()}-C${Number(match[2])}` === regionId : false;
}

function extractLaneNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /(?:lane-|^L)(\d+)$/i.exec(value.trim());
  return match ? Number(match[1]) : null;
}

function coerceCircularMarkerPosition(x: number, y: number): { x: number; y: number } {
  const center = 0.5;
  const controlledRadius = 0.42;
  const dx = x - center;
  const dy = y - center;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= controlledRadius || distance === 0) {
    return {
      x: clamp(x, center - controlledRadius, center + controlledRadius),
      y: clamp(y, center - controlledRadius, center + controlledRadius),
    };
  }

  const scale = controlledRadius / distance;
  return {
    x: center + dx * scale,
    y: center + dy * scale,
  };
}

function formatThickness(value: number): string {
  return `${value.toFixed(2)} mm`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function extractPlateNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /(?:plate|region)[:\s-]*(\d+)/i.exec(value) ?? /(\d+)/.exec(value);
  return match ? Number(match[1]) : null;
}

function buildFindingMarker(
  finding: V2ProductExportFinding,
  gridRows: number,
  gridColumns: number,
  index: number,
): LayoutMarker | null {
  const match = /^HW-(\d+)-(\d+)$/i.exec(finding.itemLabel.trim());
  if (!match) {
    return {
      id: finding.findingId,
      label: finding.itemLabel,
      type: "finding",
      x: clamp(0.12 + index * 0.08, 0.08, 0.92),
      y: clamp(0.2 + index * 0.04, 0.12, 0.88),
      source: `finding:${finding.findingId}`,
    };
  }

  const weldCourse = Number(match[1]);
  const plateNumber = Number(match[2]);

  return {
    id: finding.findingId,
    label: `${match[1]}-${match[2]}`,
    type: "finding",
    x: clamp((plateNumber - 0.5) / gridColumns, 0.08, 0.92),
    y: clamp((gridRows - weldCourse + 0.55) / gridRows, 0.12, 0.88),
    source: `finding:${finding.itemLabel}`,
  };
}

function buildInspectionReportNarrative(
  exportPackage: V2ProductExportPackage,
  manualSupplement: ManualReportSupplement,
): string {
  const voiceNotes = exportPackage.voiceNotes ?? [];
  const shellMeasurements = exportPackage.utMeasurements.filter((measurement) => measurement.targetKey === "shell");
  const roofMeasurements = exportPackage.utMeasurements.filter((measurement) => measurement.targetKey === "external_roof");
  const floorMeasurements = exportPackage.utMeasurements.filter((measurement) => measurement.targetKey === "floor");
  const shellFindingLabels = exportPackage.findings
    .filter((finding) => finding.targetKey === "shell")
    .map((finding) => finding.itemLabel);
  const roofFindingLabels = exportPackage.findings
    .filter((finding) => finding.targetKey === "external_roof")
    .map((finding) => finding.itemLabel);
  const floorFindingLabels = exportPackage.findings
    .filter((finding) => finding.targetKey === "floor")
    .map((finding) => finding.itemLabel);

  return [
    "INTERNAL & EXTERNAL INSPECTION",
    "",
    buildInspectionSubsection("DIKED AREA", [
      ...buildVoiceBullets(voiceNotes, "diked_area"),
      ...buildChecklistNoteBullets(exportPackage, "diked_area"),
    ]),
    "",
    buildInspectionSubsection("FOUNDATION", [
      ...buildVoiceBullets(voiceNotes, "tank_foundation"),
      ...buildChecklistNoteBullets(exportPackage, "tank_foundation"),
    ]),
    "",
    buildInspectionSubsection("SHELL", [
      ...buildVoiceBullets(voiceNotes, "shell_external"),
      `➢ Imported shell UT readings cover ${shellMeasurements.length} shell rows. ${formatMeasurementRangeSentence(shellMeasurements)}`,
      shellFindingLabels.length > 0
        ? `➢ Imported shell finding locations include ${shellFindingLabels.join(", ")}. These locations should remain traceable to layout map markers and related photo evidence.`
        : "➢ No shell finding locations were imported for this section.",
      ...buildChecklistNoteBullets(exportPackage, "shell_external"),
    ]),
    "",
    buildInspectionSubsection("SHELL APPURTENANCES", [
      ...buildVoiceBullets(voiceNotes, "shell_appurtenances"),
      `➢ Imported shell element records include ${countElementsByType(exportPackage, "shell", "nozzle")} shell nozzles and ${countElementsByType(exportPackage, "shell", "stair")} stair/access related markers.`,
      ...buildChecklistNoteBullets(exportPackage, "shell_appurtenances"),
    ]),
    "",
    buildInspectionSubsection("ACCESS STRUCTURE", [
      ...buildVoiceBullets(voiceNotes, "access_structure"),
      ...buildChecklistNoteBullets(exportPackage, "access_structure"),
    ]),
    "",
    buildInspectionSubsection("FIXED ROOF (DOME)", [
      ...buildVoiceBullets(voiceNotes, "fixed_roof_cone_dome"),
      `➢ Imported roof plate readings cover ${roofMeasurements.filter((measurement) => measurement.itemKind === "region").length} roof plate rows and ${roofMeasurements.filter((measurement) => measurement.itemKind === "element").length} roof nozzle/appurtenance rows. ${formatMeasurementRangeSentence(roofMeasurements)}`,
      roofFindingLabels.length > 0
        ? `➢ Imported roof finding locations include ${roofFindingLabels.join(", ")}.`
        : "➢ No roof findings were imported for this section.",
      ...buildChecklistNoteBullets(exportPackage, "fixed_roof_cone_dome"),
    ]),
    "",
    buildInspectionSubsection("ROOF APPURTENANCES", [
      ...buildVoiceBullets(voiceNotes, "roof_appurtenances"),
      `➢ Imported roof element records include ${countElementsByType(exportPackage, "external_roof", "nozzle")} roof nozzles, ${countElementsByType(exportPackage, "external_roof", "manhole")} manhole marker, and ${countElementsByType(exportPackage, "external_roof", "vent")} vent marker.`,
      ...buildChecklistNoteBullets(exportPackage, "roof_appurtenances"),
    ]),
    "",
    buildInspectionSubsection("ROOF INTERNAL", [
      ...buildVoiceBullets(voiceNotes, "fixed_roof_internal"),
      ...buildChecklistNoteBullets(exportPackage, "fixed_roof_internal"),
    ]),
    "",
    buildInspectionSubsection("SHELL INTERNAL", [
      ...buildVoiceBullets(voiceNotes, "shell_internal"),
      shellFindingLabels.length > 0
        ? `➢ Selected shell internal locations are linked to imported finding markers ${shellFindingLabels.join(", ")}.`
        : "➢ Selected shell internal finding markers are pending confirmation.",
      ...buildChecklistNoteBullets(exportPackage, "shell_internal"),
    ]),
    "",
    buildInspectionSubsection("FLOOR INTERNAL (CONE DOWN)", [
      ...buildVoiceBullets(voiceNotes, "floor_internal"),
      `➢ Imported floor UT readings cover ${floorMeasurements.length} floor rows. ${formatMeasurementRangeSentence(floorMeasurements)}`,
      floorFindingLabels.length > 0
        ? `➢ Imported floor finding locations include ${floorFindingLabels.join(", ")}.`
        : "➢ No floor findings were imported for this section.",
      ...buildChecklistNoteBullets(exportPackage, "floor_internal"),
    ]),
    "",
    "ENGINEERING IMPLICATION",
    "",
    `➢ ${formatSentenceValue(manualSupplement.engineeringImplication)}.`,
    "",
    "Note: Voice-transcript notes are used as narrative evidence for drafting only. Final wording, photo numbering, and API 653 acceptability remain subject to inspector/reviewer approval.",
  ].join("\n");
}

function buildInspectionSubsection(title: string, bullets: string[]): string {
  const cleanBullets = bullets.filter((line) => line.trim().length > 0);
  return [
    title,
    "",
    ...(cleanBullets.length > 0 ? cleanBullets : ["➢ Pending confirmation from inspector narrative input."]),
  ].join("\n");
}

function buildVoiceBullets(notes: V2ProductExportVoiceNote[], sectionKey: string): string[] {
  return notes
    .filter((note) => voiceNoteMatchesInspectionSubsection(note, sectionKey))
    .map((note) => note.transcriptText?.trim())
    .filter((text): text is string => Boolean(text))
    .map((text) => `➢ ${text}`);
}

function voiceNoteMatchesInspectionSubsection(note: V2ProductExportVoiceNote, sectionKey: string): boolean {
  const noteText = normalizeEvidenceKey(
    [
      note.screenKey,
      note.screenLabel,
      note.cardKey,
      note.fieldKey,
      note.targetKey,
      note.targetLabel,
      note.itemKey,
      note.itemLabel,
      note.transcriptText,
    ]
      .filter(Boolean)
      .join(" "),
  );

  switch (sectionKey) {
    case "diked_area":
      return noteText.includes("dike") || noteText.includes("diked") || noteText.includes("drain");
    case "tank_foundation":
      return noteText.includes("foundation") || noteText.includes("tar seal") || noteText.includes("floor edge");
    case "shell_external":
      return note.targetKey === "shell" && (noteText.includes("buckl") || noteText.includes("external") || noteText.includes("course"));
    case "shell_appurtenances":
      return note.targetKey === "shell" && (noteText.includes("nozzle") || noteText.includes("tell tale") || noteText.includes("pad"));
    case "access_structure":
      return noteText.includes("access") || noteText.includes("stair") || noteText.includes("drop bar") || noteText.includes("chain");
    case "fixed_roof_cone_dome":
      return (
        note.targetKey === "external_roof" &&
        (noteText.includes("fixed dome") ||
          noteText.includes("roof plate") ||
          noteText.includes("curb") ||
          noteText.includes("roof surface") ||
          noteText.includes("spot readings"))
      );
    case "roof_appurtenances":
      return (
        note.targetKey === "external_roof" &&
        (noteText.includes("nozzle") || noteText.includes("manhole") || noteText.includes("vent") || noteText.includes("reinforcement"))
      );
    case "fixed_roof_internal":
      return note.targetKey === "internal_roof" || noteText.includes("underside") || noteText.includes("rafter");
    case "shell_internal":
      return (
        note.targetKey === "shell" &&
        (noteText.includes("internal") ||
          noteText.includes("scale") ||
          noteText.includes("linear") ||
          noteText.includes("indication") ||
          noteText.includes("scaffold"))
      );
    case "floor_internal":
      return note.targetKey === "floor" || noteText.includes("tank bottom") || noteText.includes("cone down") || noteText.includes("mfl");
    default:
      return false;
  }
}

function buildChecklistNoteBullets(exportPackage: V2ProductExportPackage, sectionKey: string): string[] {
  return exportPackage.inspectionChecklistSectionNotes
    .filter((note) => note.sectionKey === sectionKey)
    .map((note) => `➢ Checklist note: ${note.note}`);
}

function countElementsByType(
  exportPackage: V2ProductExportPackage,
  targetKey: string,
  elementTypeKey: string,
): number {
  return exportPackage.elements.filter(
    (element) => element.targetKey === targetKey && element.elementTypeKey === elementTypeKey,
  ).length;
}

function formatMeasurementRangeSentence(measurements: V2ProductExportUtMeasurement[]): string {
  const values = measurements.flatMap((measurement) => [
    measurement.value1,
    measurement.value2,
    measurement.value3,
    measurement.value4,
    measurement.value5,
    measurement.reinforcementPadReading,
  ]).filter((value): value is number => value != null);

  if (values.length === 0) {
    return "Measurement range is pending confirmation.";
  }

  return `Recorded values range from ${Math.min(...values).toFixed(2)} mm to ${Math.max(...values).toFixed(2)} mm.`;
}

function buildChecklistHighlights(notes: V2ProductExportChecklistSectionNote[]): string {
  if (notes.length === 0) {
    return "No checklist section notes were exported for this package.";
  }

  return notes
    .map((note) => `${note.sectionTitle}: ${note.note}`)
    .join(" ");
}

function buildMeasurementBullets(measurements: V2ProductExportUtMeasurement[]): string[] {
  const sortedMeasurements = [...measurements]
    .filter((measurement) => measurement.measured)
    .sort((left, right) => (right.course ?? 0) - (left.course ?? 0));

  if (sortedMeasurements.length === 0) {
    return ["- No measured shell UT rows were imported for this package."];
  }

  return sortedMeasurements.map((measurement) => {
    const values = [
      measurement.value1,
      measurement.value2,
      measurement.value3,
      measurement.value4,
      measurement.value5,
    ].filter((value): value is number => value != null);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    return `- ${measurement.itemLabel}: imported UT band ${minValue.toFixed(1)} mm to ${maxValue.toFixed(
      1,
    )} mm.`;
  });
}

function buildInitialAssistantPrompt(section: ReportSection): string {
  if (section.kind === "map") {
    return "This sketch is compiled from LAIQ app export geometry. I can help with legend wording, layout notes, or approval blockers, while the map geometry remains locked to the app export for parity review.";
  }

  if (section.kind === "attachment") {
    return "This attachment page is anchored to imported evidence references. The main remaining work is final issue formatting and report-side sign-off metadata.";
  }

  if (section.kind === "structured") {
    const hasOpenInputs = section.missingFields.some((field) => !field.value.trim());
    return hasOpenInputs
      ? "This section combines imported facts with report-side inputs. Fill the missing-content panel first, then ask me to generate or refine the section."
      : "This section is already backed by the LAIQ inspection app V3 export. I can help generate, table-format, or refine the report output without asking for another source-data field.";
  }

  return "This section blends imported field facts with report-side wording. I can help tighten the prose, surface missing inputs, and keep the narrative aligned with the sample report family.";
}

function formatMetric(value: number | null): string {
  return value == null ? "Not recorded" : `${value.toFixed(3)} m`;
}

function formatSentenceValue(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim() || "Pending confirmation";
  return normalized.replace(/[.]+$/, "");
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function humanizeKey(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeApiBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

function buildApiUrl(apiBaseUrl: string, path: string): string {
  const normalizedBase = normalizeApiBaseUrl(apiBaseUrl);
  return normalizedBase ? `${normalizedBase}${path}` : path;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cloneReport(report: WorkspaceReport): WorkspaceReport {
  return JSON.parse(JSON.stringify(report)) as WorkspaceReport;
}

function applyPersistedState(
  report: WorkspaceReport,
  sectionDrafts: ApiReportJobState["sectionDrafts"],
  layoutOverrides: ApiReportJobState["layoutOverrides"],
): WorkspaceReport {
  const sectionDraftMap = new Map((sectionDrafts ?? []).map((sectionDraft) => [sectionDraft.sectionId, sectionDraft]));
  const layoutOverrideMap = new Map(
    (layoutOverrides ?? []).map((layoutOverride) => [layoutOverride.sectionId, layoutOverride.layoutMap]),
  );

  return {
    ...report,
    sections: report.sections.map((section) => {
      const sectionDraft = sectionDraftMap.get(section.id);
      const layoutOverride = layoutOverrideMap.get(section.id);
      const compatibleLayoutOverride = isCompatibleLayoutOverride(section.layoutMap, layoutOverride)
        ? layoutOverride
        : undefined;

      return {
        ...section,
        content: sectionDraft?.content ?? section.content,
        generated: sectionDraft?.generated ?? section.generated,
        edited: sectionDraft?.edited ?? section.edited,
        approved: sectionDraft?.approved ?? section.approved,
        reviewRequired: sectionDraft?.reviewRequired ?? section.reviewRequired,
        previousVersionCount: sectionDraft?.previousVersionCount ?? section.previousVersionCount ?? 0,
        layoutMap: compatibleLayoutOverride
          ? mergeLayoutOverrideWithBaseline(section.layoutMap, compatibleLayoutOverride)
          : section.layoutMap
            ? ensureLayoutMapData(section.layoutMap)
            : section.layoutMap,
      };
    }),
  };
}

function isCompatibleLayoutOverride(
  baselineLayoutMap: LayoutMapData | undefined,
  layoutOverride: LayoutMapData | undefined,
): boolean {
  if (!layoutOverride) return false;
  if (!baselineLayoutMap?.appMap) return true;
  if (!layoutOverride.appMap) return false;

  return layoutOverride.appMap.surfaceType === baselineLayoutMap.appMap.surfaceType;
}

function mergeLayoutOverrideWithBaseline(
  baselineLayoutMap: LayoutMapData | undefined,
  layoutOverride: LayoutMapData,
): LayoutMapData {
  if (!baselineLayoutMap) return ensureLayoutMapData(layoutOverride);

  const normalizedBaseline = ensureLayoutMapData(baselineLayoutMap);
  const normalizedOverride = ensureLayoutMapData(layoutOverride);
  const overrideMarkersById = new Map(normalizedOverride.markers.map((marker) => [marker.id, marker]));
  const lockAppFloorGeometry = normalizedBaseline.appMap?.surfaceType === "floor"
    && Boolean(normalizedBaseline.appFigure?.svg);
  const replaceBaselineMarkers = normalizedOverride.geometrySource === "reference_test_fixture"
    || normalizedOverride.geometrySource === "app_export_mock"
    || normalizedOverride.geometrySource === "report_side_approved_layout"
    || normalizedOverride.geometrySource === "source_drawing_import";

  return ensureLayoutMapData({
    ...normalizedBaseline,
    ...normalizedOverride,
    geometrySource: lockAppFloorGeometry ? normalizedBaseline.geometrySource : normalizedOverride.geometrySource,
    sourceDrawing: lockAppFloorGeometry ? undefined : normalizedOverride.sourceDrawing,
    appFigure: lockAppFloorGeometry ? normalizedBaseline.appFigure : normalizedOverride.appFigure ?? normalizedBaseline.appFigure,
    plates: lockAppFloorGeometry
      ? normalizedBaseline.plates
      : normalizedOverride.plates.length > 0 ? normalizedOverride.plates : normalizedBaseline.plates,
    markers: lockAppFloorGeometry
      ? normalizedBaseline.markers
      : replaceBaselineMarkers
      ? normalizedOverride.markers
      : normalizedBaseline.markers.map((baselineMarker) => {
          const overrideMarker = overrideMarkersById.get(baselineMarker.id);
          return overrideMarker
            ? {
                ...baselineMarker,
                ...overrideMarker,
                evidence: baselineMarker.evidence ?? overrideMarker.evidence,
                hostLocation: baselineMarker.hostLocation ?? overrideMarker.hostLocation,
              }
            : baselineMarker;
        }),
    drawingBlock: {
      ...normalizedBaseline.drawingBlock,
      ...normalizedOverride.drawingBlock,
    },
    appMap: lockAppFloorGeometry
      ? normalizedBaseline.appMap
      : normalizedBaseline.appMap
      ? {
          ...normalizedBaseline.appMap,
          ...(normalizedOverride.appMap ?? {}),
        }
      : normalizedOverride.appMap,
    evidenceByKey: {
      ...(normalizedBaseline.evidenceByKey ?? {}),
      ...(normalizedOverride.evidenceByKey ?? {}),
    },
  });
}

function assertValidAndroidExport(exportPackage: V2ProductExportPackage) {
  const issues = validateV2ProductExportPackage(exportPackage);
  if (issues.length === 0) return;

  throw new Error(`LAIQ app export contract validation failed: ${issues.join(" ")}`);
}
