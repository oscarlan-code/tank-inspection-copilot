import exportFixture from "../fixtures/v2-product-export-shell-internal.json";
import { buildDefaultPlates, ensureLayoutMapData } from "../lib/layoutMapGeometry";
import { validateV2ProductExportPackage } from "../lib/validateV2ProductExport";
import {
  API_STANDARD_PRIMARY_REPORT,
  API_STANDARD_REPORT_TOC,
  type ApiStandardTocSection,
} from "./reportToc";
import { classifyReportPackage } from "./reportClassification";
import type {
  AssistantAction,
  ChatMessage,
  LayoutMapData,
  LayoutMarker,
  MissingField,
  ReportSection,
  WorkspaceApiLinks,
  WorkspaceDataSourceMode,
  WorkspaceReport,
} from "./types";
import type {
  V2ProductExportChecklistSectionNote,
  V2ProductExportFinding,
  V2ProductExportLayoutConfig,
  V2ProductExportPackage,
  V2ProductExportUtMeasurement,
} from "./v2ProductExport";

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
  configured: boolean;
  statusLabel: string;
  detail: string;
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
  }>;
  layoutOverrides?: Array<{
    sectionId: string;
    layoutMap: LayoutMapData;
    updatedAtIso: string;
  }>;
  generationRun?: ApiGenerationRun;
  aiStatus?: ApiAiStatus;
};

const fixturePackage = buildApiStandardFixturePackage(exportFixture as V2ProductExportPackage);

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

function buildApiStandardFixturePackage(exportPackage: V2ProductExportPackage): V2ProductExportPackage {
  const inspectionId = "inspection-v10-api653-internal-external-20220722";
  const inspectionReference = "LAIQ-V10-20220722";
  const exportedAtIso = "2022-07-22T16:30:00Z";

  return {
    ...exportPackage,
    inspectionId,
    inspectionReference,
    exportedAtIso,
    task: {
      ...exportPackage.task,
      inspectionId,
      inspectionReference,
      client: "Pacific Energy",
      tankNumber: "V10",
      exportedAtIso,
    },
    inspectionRecord: {
      ...exportPackage.inspectionRecord,
      inspectionId,
      inspectionReference,
      client: "Pacific Energy",
      tankNumber: "V10",
      location: "Vuda Terminal, Fiji",
      fieldLeaseName: "Pacific Energy Vuda Terminal",
      inspector: "Syed A. R. Balkhi",
      diameterM: 19.52,
      heightM: 14.535,
      shellCourseCount: 8,
      externalRoofType: "fixed_dome_roof",
    },
    validationResults: withInspectionId(exportPackage.validationResults, inspectionId),
    taskSnapshots: withInspectionId(exportPackage.taskSnapshots, inspectionId),
    layoutTargets: withInspectionId(exportPackage.layoutTargets, inspectionId),
    layoutConfigs: withInspectionId(exportPackage.layoutConfigs, inspectionId),
    elements: withInspectionId(exportPackage.elements, inspectionId),
    utMeasurements: withInspectionId(exportPackage.utMeasurements, inspectionId),
    inspectionChecklistItems: withInspectionId(exportPackage.inspectionChecklistItems, inspectionId),
    inspectionChecklistSectionNotes: withInspectionId(exportPackage.inspectionChecklistSectionNotes, inspectionId),
    findings: withInspectionId(exportPackage.findings, inspectionId),
    attachments: withInspectionId(exportPackage.attachments, inspectionId),
  };
}

function withInspectionId<T extends { inspectionId: string }>(items: T[], inspectionId: string): T[] {
  return items.map((item) => ({
    ...item,
    inspectionId,
  }));
}

const makeField = (
  field: Partial<MissingField> &
    Pick<MissingField, "id" | "label" | "input" | "reason" | "source">,
): MissingField => ({
  value: "",
  ...field,
});

export async function loadWorkspaceBootstrap(): Promise<WorkspaceBootstrap> {
  const apiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_REPORT_API_BASE_URL) ?? defaultApiBaseUrl;

  try {
    const response = await fetch(buildApiUrl(apiBaseUrl, "/api/v1/report-jobs/bootstrap/shell-internal"));
    if (!response.ok) {
      throw new Error(`Bootstrap request failed with ${response.status}`);
    }

    const payload = (await response.json()) as ApiReportJobState;
    const { baselineReport, report } = hydrateWorkspaceFromApiState(payload, apiBaseUrl);

    return {
      baselineReport,
      report,
      flashMessage:
        "Loaded report workspace from the report-platform API using the Android V2 Product import contract.",
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
      } Loaded the local Android export fixture instead.`,
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
  const shellConfig = exportPackage.layoutConfigs.find((config) => config.targetKey === "shell");
  const shellLayoutMap = buildShellLayoutMap(exportPackage, shellConfig, manualSupplement);

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
    sections: [
      buildCoverSection(exportPackage, manualSupplement),
      ...buildApiStandardTocSections(exportPackage, manualSupplement, shellLayoutMap),
    ],
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
    importInspectionPath: buildApiUrl(apiBaseUrl, "/api/v1/imports/android-v2-product"),
    loadReportJobPath: buildApiUrl(apiBaseUrl, "/api/v1/report-jobs/:reportJobId"),
    saveSectionDraftPath: buildApiUrl(apiBaseUrl, "/api/v1/report-jobs/:reportJobId/sections/:sectionId"),
    saveManualInputsPath: buildApiUrl(apiBaseUrl, "/api/v1/report-jobs/:reportJobId/manual-inputs"),
    saveLayoutOverridePath: buildApiUrl(apiBaseUrl, "/api/v1/report-jobs/:reportJobId/layout-overrides/:sectionId"),
    generateSectionPath: buildApiUrl(apiBaseUrl, "/api/v1/report-jobs/:reportJobId/sections/:sectionId/generate"),
    sectionChatPath: buildApiUrl(apiBaseUrl, "/api/v1/report-jobs/:reportJobId/sections/:sectionId/chat"),
    approveSectionPath: buildApiUrl(apiBaseUrl, "/api/v1/report-jobs/:reportJobId/sections/:sectionId/approve"),
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

This cover page is assembled from imported Android task facts plus report-side issue formatting.`;

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
      "Imported from Android task and inspection record. Manual report reference and cover image remain report-side.",
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

function buildScopeSection(
  exportPackage: V2ProductExportPackage,
  manualSupplement: ManualReportSupplement,
): ReportSection {
  const content = `1       SCOPE OF INSPECTION

➢ To carry out a general and close visual inspection on the internal and external areas of the vertical aboveground storage tank and record conditions that may be detrimental to serviceability.

➢ To review roof, shell, floor, nozzle, settlement, NDT, and photographic evidence against the API 653 report format.

➢ To compile the report sections, worksheets, photographs, layout drawings, and engineering assessment in the same order as the approved API-standard sample report.

➢ To preserve Android field-capture data as the factual baseline while allowing final report presentation, layout maps, and recommendation wording to be reviewed and approved on the report platform.

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

This section is driven mainly by structured Android export facts, with a few remaining client-facing report fields captured on the web side.`;

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
  const checklistHighlights = buildChecklistHighlights(exportPackage.inspectionChecklistSectionNotes);
  const shellMeasurementBullets = buildMeasurementBullets(
    exportPackage.utMeasurements.filter((measurement) => measurement.targetKey === "shell"),
  );
  const findingLabels = exportPackage.findings.map((finding) => finding.itemLabel).join(", ");

  const content = `INTERNAL & EXTERNAL INSPECTION

The API-standard report workspace reviews the vertical aboveground storage tank as an internal and external inspection package. The current Android export confirms ${exportPackage.findings.length} reportable finding locations tied to the imported shell scope.

${shellMeasurementBullets.join("\n")}

Finding locations imported from the app include ${findingLabels}. These tagged positions should be carried forward into the relevant shell, NDT, repair, and photo sections without redrawing the underlying field geometry.

${checklistHighlights}

The current section is intentionally incomplete on the report side until the final client-facing engineering implication paragraph is reviewed and approved.`;

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
    aiHint: "Use formal engineering language and keep the factual statements anchored to imported evidence.",
    templateExpectation: "Blue section heading, uppercase subheading, arrow bullets, and compact engineering prose.",
    sourceSummary:
      "Imported: findings, shell UT rows, checklist notes. Manual: concluding engineering implication paragraph. Derived: merged narrative draft.",
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

This section is report-side by design: the Android export supplies the factual basis, while the final recommendation wording belongs to the cloud reporting workflow.`;

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
  const photoAttachments = exportPackage.attachments.filter((attachment) => attachment.kind === "photo");
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

function buildApiStandardTocSections(
  exportPackage: V2ProductExportPackage,
  manualSupplement: ManualReportSupplement,
  shellLayoutMap: LayoutMapData | undefined,
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
    if (tocSection.id === "photographs") {
      return alignSectionToToc(buildPhotographsSection(exportPackage), tocSection);
    }
    if (tocSection.kind === "map") {
      return buildApiStandardMapSection(exportPackage, manualSupplement, shellLayoutMap, tocSection);
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
  shellLayoutMap: LayoutMapData | undefined,
  tocSection: ApiStandardTocSection,
): ReportSection {
  if (tocSection.layoutSurface === "shell") {
    return buildMapSection(exportPackage, manualSupplement, shellLayoutMap, {
      id: tocSection.id,
      number: tocSection.number,
      title: tocSection.title,
      shortLabel: tocSection.shortLabel,
      drawing: `Section-${tocSection.number}`,
    });
  }

  const content = `${tocSection.number}       ${tocSection.title.toUpperCase()}

This layout section is present in the API-standard sample report and is reserved for the ${tocSection.layoutSurface ?? "tank"} layout editor.

Current Android export status: no structured ${tocSection.layoutSurface ?? "surface"} layout geometry was imported for this report section.

The report platform should not invent plate dimensions, MFL platemaps, roof layout, or floor corrosion maps. Once the app export provides this geometry, the same editable layout-map workflow used for shell sections can be applied here.`;

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
    aiHint: "Do not fabricate geometry. Use this page as a controlled missing-data placeholder until a matching Android export surface exists.",
    templateExpectation: "API-standard layout page with controlled drawing block, legend, and editable geometry once source data exists.",
    sourceSummary:
      "Imported: no matching structured layout surface yet. Manual: final report-side source selection. Derived: pending layout workspace shell.",
    missingFields: [
      makeField({
        id: `${tocSection.id}-layout-source`,
        label: `${tocSection.title} Source`,
        input: "text",
        suggestion: "Import structured layout data from Android V2 Product or attach approved worksheet/map source.",
        reason: "This API-standard section exists in the report ToC but the current Android export does not yet provide this surface geometry.",
        source: "Report-side/manual or future Android export input",
      }),
    ],
  };
}

function buildApiStandardPlaceholderSection(
  exportPackage: V2ProductExportPackage,
  tocSection: ApiStandardTocSection,
): ReportSection {
  const content = `${tocSection.number}       ${tocSection.title.toUpperCase()}

This section follows the API-standard sample report ToC and is generated as a controlled placeholder from the current Android V2 Product export.

Imported baseline available now:
- Client: ${exportPackage.task.client}
- Tank: ${exportPackage.task.tankNumber}
- Inspection reference: ${exportPackage.inspectionReference}
- Imported findings: ${exportPackage.findings.length}
- Imported UT rows: ${exportPackage.utMeasurements.length}
- Imported attachments: ${exportPackage.attachments.length}

The final section content must be completed using approved report-side inputs, calculations, worksheets, or future Android export fields that correspond to this exact ToC section.`;

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
      "Imported: Android V2 Product package baseline. Manual: worksheet values, calculations, and final report-side approval where missing.",
    missingFields: [
      makeField({
        id: `${tocSection.id}-content-source`,
        label: `${tocSection.title} Source Data`,
        input: "textarea",
        suggestion: "Confirm imported worksheet/calculation data or provide approved report-side content for this section.",
        reason: "This API-standard section needs section-specific values before final issue.",
        source: "Report-side manual input or future Android export field",
      }),
    ],
  };
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
  shellLayoutMap: LayoutMapData | undefined,
  spec: SketchSectionSpec,
): ReportSection {
  const layoutMap = shellLayoutMap
    ? {
        ...shellLayoutMap,
        id: spec.id,
        title: spec.title,
        drawingBlock: {
          ...shellLayoutMap.drawingBlock,
          drawing: spec.drawing,
        },
      }
    : undefined;
  const content = `${spec.number}       ${spec.title.toUpperCase()}

This sketch page is anchored to imported vertical tank shell layout metadata.

➢ Marker positions are derived from the exported shell layout metadata and finding labels.

➢ Shell elements are imported directly from Android element placement coordinates.

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
    description: `ToC section ${spec.number}, map-enabled sketch page compiled from exported shell geometry.`,
    content,
    aiHint: "Only adjust captioning or report-side overrides. Do not rewrite imported geometry facts.",
    templateExpectation: "Sketch title, printable shell map, legend, and drawing block tied to imported geometry.",
    sourceSummary:
      "Imported: shell layout config, elements, findings. Manual: checked-by and legend note. Derived: marker positioning from weld labels.",
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
        suggestion: "Repair planning locations shown against imported shell baseline geometry.",
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
  const gridColumns = shellConfig.shellPlatesPerCourse ?? exportPackage.inspectionRecord.shellLaneCount ?? 14;
  const findingMarkers = exportPackage.findings
    .filter((finding) => finding.targetKey === "shell")
    .map((finding, index) => buildFindingMarker(finding, gridRows, gridColumns, index))
    .filter((marker): marker is LayoutMarker => marker != null);
  const elementMarkers = exportPackage.elements
    .filter((element) => element.targetKey === "shell")
    .map((element) => ({
      id: element.elementId,
      label: element.elementLabel,
      type: "element" as const,
      x: clamp(element.normalizedX, 0.08, 0.92),
      y: clamp(element.normalizedY, 0.12, 0.88),
      source: `element:${element.elementTypeKey}`,
    }));

  return {
    id: "shell-weld-7",
    title: "Findings / MPI Locations on Shell Internal - Horizontal Weld 7",
    subtitle: "Imported shell geometry from Android V2 Product export plus editable report-side overrides",
    surfaceLabel: "Shell internal sketch",
    legend: [
      "Blue circles = imported finding positions derived from shell layout metadata",
      "Blue outlined labels = imported shell elements from Android placement",
      "Selected marker = current report-side override target",
    ],
    markers: [...findingMarkers, ...elementMarkers],
    plates: buildDefaultPlates(gridRows, gridColumns),
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
    overrideCount: 0,
  };
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
    return "This sketch is compiled from Android export geometry. I can help with legend wording, layout notes, or approval blockers, while the lower pane keeps direct marker adjustments under user control.";
  }

  if (section.kind === "attachment") {
    return "This attachment page is anchored to imported evidence references. The main remaining work is final issue formatting and report-side sign-off metadata.";
  }

  if (section.kind === "structured") {
    return "This section is driven mostly by imported facts. The fastest path to approval is filling the remaining report-side fields in the missing-content panel.";
  }

  return "This section blends imported field facts with report-side wording. I can help tighten the prose, surface missing inputs, and keep the narrative aligned with the sample report family.";
}

function formatMetric(value: number | null): string {
  return value == null ? "Not recorded" : `${value.toFixed(3)} m`;
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

      return {
        ...section,
        content: sectionDraft?.content ?? section.content,
        generated: sectionDraft?.generated ?? section.generated,
        edited: sectionDraft?.edited ?? section.edited,
        approved: sectionDraft?.approved ?? section.approved,
        reviewRequired: sectionDraft?.reviewRequired ?? section.reviewRequired,
        layoutMap: layoutOverride
          ? ensureLayoutMapData(layoutOverride)
          : section.layoutMap
            ? ensureLayoutMapData(section.layoutMap)
            : section.layoutMap,
      };
    }),
  };
}

function assertValidAndroidExport(exportPackage: V2ProductExportPackage) {
  const issues = validateV2ProductExportPackage(exportPackage);
  if (issues.length === 0) return;

  throw new Error(`Android export contract validation failed: ${issues.join(" ")}`);
}
