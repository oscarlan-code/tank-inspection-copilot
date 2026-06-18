import { randomUUID } from "node:crypto";
import {
  getAiStatus,
  runStructuredCodexJob,
} from "./codex-cli.mjs";
import {
  buildFlatRetrievalContext,
  searchPrecedentPack,
} from "./precedent-kb.mjs";
import {
  API_STANDARD_MAP_SECTION_IDS,
  API_STANDARD_PRIMARY_REPORT,
  API_STANDARD_SHELL_MAP_SECTION_IDS,
  getApiStandardTocSection,
} from "./report-toc.mjs";
import { classifyReportPackage } from "./report-classification.mjs";
import { buildStandardRuleChecks } from "./standard-rules.mjs";

export const MANUAL_FIELD_LABELS = {
  coverHeroImage: "Cover hero image",
  clientRepresentative: "Client representative",
  yearBuilt: "Year built",
  engineeringImplication: "Engineering implication paragraph",
  recommendationOwner: "Recommendation owner",
  checkedBy: "Checked by",
  legendNote: "Legend note",
  certificationNumber: "Certification number",
};

const MANUAL_FIELD_GUIDANCE = {
  coverHeroImage:
    "Attach or select the approved report cover image. If the final issue image is not available, keep this pending rather than inventing one.",
  clientRepresentative:
    "Enter the client-side representative name shown on the approved report metadata or confirmed by the inspector/client.",
  yearBuilt:
    "Enter the tank construction year from the asset register, nameplate, previous API 653 report, or client confirmation.",
  engineeringImplication:
    "Provide the final client-facing implication paragraph. Keep it tied to imported findings and do not add new engineering claims without review.",
  recommendationOwner:
    "Select or type who owns the recommendation action, such as Client, Contractor, or Inspector, based on the agreed report responsibility.",
  checkedBy:
    "Enter the checker initials or reviewer name for the printable layout/drawing block.",
  legendNote:
    "Enter the final legend note for the printable layout page. Use it to explain symbols, imported markers, or repair-location conventions.",
  certificationNumber:
    "Enter the NDT certification, qualification reference, or approved report-side certification statement.",
};

const SECTION_TEMPLATES = {
  cover: {
    templateKey: "shell-internal.cover.v1",
    title: "Cover",
    kind: "structured",
    templateExpectation: "Centered report title, client/tank/report reference block, issue metadata, and one approved visual.",
    requiredManualFields: ["coverHeroImage"],
    compose: composeCoverSection,
  },
  "scope-of-inspection": {
    templateKey: "shell-internal.scope.v1",
    title: "Scope of Inspection",
    kind: "narrative",
    templateExpectation: "Numbered section heading with arrow bullets matching the sample report scope page.",
    requiredManualFields: [],
    compose: composeScopeSection,
  },
  "inspection-maintenance-regime": {
    templateKey: "shell-internal.maintenance-regime.v1",
    title: "Inspection and Maintenance Regime",
    kind: "narrative",
    templateExpectation: "Formal API 653/EEMUA maintenance responsibility wording matching the sample report family.",
    requiredManualFields: [],
    compose: composeMaintenanceRegimeSection,
  },
  "general-tank-information": {
    templateKey: "shell-internal.general-info.v1",
    title: "General Tank Information",
    kind: "structured",
    templateExpectation: "Label-value metadata layout with consistent engineering terminology.",
    requiredManualFields: ["clientRepresentative", "yearBuilt"],
    compose: composeGeneralInfoSection,
  },
  "inspection-report": {
    templateKey: "shell-internal.inspection-report.v1",
    title: "Inspection Report",
    kind: "narrative",
    templateExpectation: "Blue section heading, uppercase subheading, arrow bullets, and compact engineering prose.",
    requiredManualFields: ["engineeringImplication"],
    compose: composeInspectionReportSection,
  },
  "repair-recommendations": {
    templateKey: "shell-internal.recommendations.v1",
    title: "Repair Recommendations / API 653 Assessment",
    kind: "narrative",
    templateExpectation: "Bulleted recommendation section with clear ownership and approval trail.",
    requiredManualFields: ["recommendationOwner"],
    compose: composeRecommendationSection,
  },
  "tank-inspection-checklist": {
    templateKey: "api653-standard.tank-inspection-checklist.v1",
    title: "Tank Inspection Checklist",
    kind: "structured",
    templateExpectation: "Checklist table grouped by section with response columns 1, 2, 3, 4, IA, NE, and N/A.",
    requiredManualFields: [],
    compose: composeTankInspectionChecklistSection,
  },
  photographs: {
    templateKey: "shell-internal.photographs.v1",
    title: "Photographs",
    kind: "attachment",
    templateExpectation: "Photo section with selected evidence, compact captions, and sample-report issue formatting.",
    requiredManualFields: [],
    compose: composePhotographsSection,
  },
  "findings-mpi-horizontal-weld-7": {
    templateKey: "shell-internal.map-weld-7.v1",
    title: "Findings / MPI Locations on Shell Internal - Horizontal Weld 7",
    kind: "map",
    templateExpectation: "Sketch title, printable shell map, legend, and drawing block tied to imported geometry.",
    requiredManualFields: ["checkedBy", "legendNote"],
    compose: composeMapSection,
  },
  "findings-mpi-horizontal-weld-6": {
    templateKey: "shell-internal.map-weld-6.v1",
    title: "Findings / MPI Locations on Shell Internal - Horizontal Weld 6",
    kind: "map",
    templateExpectation: "Sketch title, printable shell map, legend, and drawing block tied to imported geometry.",
    requiredManualFields: ["checkedBy", "legendNote"],
    compose: composeMapSection,
  },
  "findings-mpi-horizontal-weld-5": {
    templateKey: "shell-internal.map-weld-5.v1",
    title: "Findings / MPI Locations on Shell Internal - Horizontal Weld 5",
    kind: "map",
    templateExpectation: "Sketch title, printable shell map, legend, and drawing block tied to imported geometry.",
    requiredManualFields: ["checkedBy", "legendNote"],
    compose: composeMapSection,
  },
  "findings-mpi-horizontal-weld-4": {
    templateKey: "shell-internal.map-weld-4.v1",
    title: "Findings / MPI Locations on Shell Internal - Horizontal Weld 4",
    kind: "map",
    templateExpectation: "Sketch title, printable shell map, legend, and drawing block tied to imported geometry.",
    requiredManualFields: ["checkedBy", "legendNote"],
    compose: composeMapSection,
  },
  "findings-mpi-horizontal-weld-3": {
    templateKey: "shell-internal.map-weld-3.v1",
    title: "Findings / MPI Locations on Shell Internal - Horizontal Weld 3",
    kind: "map",
    templateExpectation: "Sketch title, printable shell map, legend, and drawing block tied to imported geometry.",
    requiredManualFields: ["checkedBy", "legendNote"],
    compose: composeMapSection,
  },
  "findings-mpi-shell-external-curb-angle-welds-horizontal-weld-6": {
    templateKey: "shell-internal.map-external-curb-weld-6.v1",
    title: "Findings / MPI Locations on Shell External - Curb Angle Welds & Horizontal Weld 6",
    kind: "map",
    templateExpectation: "Sketch title, printable shell map, legend, and drawing block tied to imported geometry.",
    requiredManualFields: ["checkedBy", "legendNote"],
    compose: composeMapSection,
  },
  "attachment-mpi-report": {
    templateKey: "shell-internal.attachment-mpi.v1",
    title: "Attachment - Magnetic Particle Inspection Report",
    kind: "attachment",
    templateExpectation: "Boxed attachment metadata, result form layout, and technician sign-off block.",
    requiredManualFields: ["certificationNumber"],
    compose: composeAttachmentSection,
  },
  "attachment-mpi-photographs": {
    templateKey: "shell-internal.attachment-mpi-photos.v1",
    title: "Attachment - Magnetic Particles Inspection Photographs",
    kind: "attachment",
    templateExpectation: "Attachment photo pages with formal captions and report issue header/footer treatment.",
    requiredManualFields: [],
    compose: composeAttachmentPhotographsSection,
  },
};

const SECTION_GENERATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    content: { type: "string" },
    summary: { type: "string" },
    reviewRequired: { type: "boolean" },
    detectedIssues: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["content", "summary", "reviewRequired", "detectedIssues"],
};

const SECTION_CHAT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: { type: "string" },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          type: {
            type: "string",
            enum: [
              "replace_section_content",
              "apply_text_style",
              "move_marker",
              "resize_plate",
            ],
          },
          label: { type: "string" },
          reason: { type: "string" },
          contentHtml: { type: ["string", "null"] },
          fontFamily: { type: ["string", "null"] },
          fontSize: { type: ["string", "null"] },
          textAlign: { type: ["string", "null"], enum: ["left", "center", null] },
          color: { type: ["string", "null"] },
          markerId: { type: ["string", "null"] },
          deltaX: { type: ["number", "null"] },
          deltaY: { type: ["number", "null"] },
          plateId: { type: ["string", "null"] },
          widthDelta: { type: ["number", "null"] },
          heightDelta: { type: ["number", "null"] },
        },
        required: [
          "id",
          "type",
          "label",
          "reason",
          "contentHtml",
          "fontFamily",
          "fontSize",
          "textAlign",
          "color",
          "markerId",
          "deltaX",
          "deltaY",
          "plateId",
          "widthDelta",
          "heightDelta",
        ],
      },
    },
  },
  required: ["reply", "actions"],
};

const MAP_SECTION_IDS = new Set([
  ...API_STANDARD_MAP_SECTION_IDS,
  "findings-mpi-horizontal-weld-7",
  "findings-mpi-horizontal-weld-6",
  "findings-mpi-horizontal-weld-5",
  "findings-mpi-horizontal-weld-4",
  "findings-mpi-horizontal-weld-3",
  "findings-mpi-shell-external-curb-angle-welds-horizontal-weld-6",
]);

const SHELL_MAP_SECTION_IDS = new Set([
  ...API_STANDARD_SHELL_MAP_SECTION_IDS,
  "findings-mpi-horizontal-weld-7",
  "findings-mpi-horizontal-weld-6",
  "findings-mpi-horizontal-weld-5",
  "findings-mpi-horizontal-weld-4",
  "findings-mpi-horizontal-weld-3",
  "findings-mpi-shell-external-curb-angle-welds-horizontal-weld-6",
]);

export async function generateSectionDraft({ reportState, sectionId, userInstruction = "" }) {
  const context = buildSectionContext({ reportState, sectionId, userInstruction });
  const fallback = buildDeterministicSectionDraft(context);
  const isMeasurementCompilerSection = Boolean(getMeasurementTableScope(sectionId));
  const isMapCompilerSection = MAP_SECTION_IDS.has(sectionId);
  const shouldUseDeterministicCompiler = isMeasurementCompilerSection || isMapCompilerSection;
  const aiResult = shouldUseDeterministicCompiler ? null : await tryGenerateSectionWithCodexCli(context);
  const selected = shouldUseDeterministicCompiler
    ? {
        ...fallback,
        summary: isMeasurementCompilerSection
          ? "Generated by the deterministic measurement-table compiler from Android V2 Product exported UT rows."
          : "Generated by the deterministic layout-map compiler from Android V2 Product exported geometry.",
        fallbackReason: isMeasurementCompilerSection
          ? "App-sourced measurement sections are compiled deterministically to prevent invented or stale pending values."
          : "App-sourced map sections are compiled deterministically to preserve Android layout geometry.",
      }
    : aiResult ?? fallback;
  const qa = validateGeneratedSection(sectionId, selected.content);
  const warnings = dedupe([...context.warnings, ...selected.detectedIssues, ...qa.warnings]);
  const blockers = dedupe([...context.blockers, ...qa.blockers]);
  const generatedAtIso = new Date().toISOString();
  const evidenceChain = buildSectionEvidenceChain({
    context,
    warnings,
    blockers,
    generatedAtIso,
    usedLiveModel: selected.usedLiveModel,
  });
  const generationRun = {
    runId: randomUUID(),
    sectionId,
    statusCode:
      blockers.length > 0
        ? "generated_with_blockers"
        : warnings.length > 0
          ? "generated_with_warnings"
          : "generated",
    templateKey: context.template.templateKey,
    retrievalKeys: context.retrievalContext.map((item) => item.key),
    calculationKeys: context.calculations.map((item) => item.key),
    mapArtifactKeys: context.mapArtifacts.map((item) => item.key),
    warnings,
    blockers,
    generatedAtIso,
    providerCode: selected.providerCode,
    modelId: selected.modelId,
    usedLiveModel: selected.usedLiveModel,
    fallbackReason: selected.fallbackReason,
    assistantSummary: selected.summary,
    evidenceChain,
  };

  return {
    draft: {
      content: selected.content,
      generated: true,
      edited: false,
      approved: false,
      reviewRequired:
        selected.reviewRequired ||
        warnings.length > 0 ||
        blockers.length > 0 ||
        context.mapArtifacts.some((artifact) => artifact.requiresReview),
    },
    generationRun,
    orchestration: {
      sectionId,
      userInstruction,
      templateKey: context.template.templateKey,
      retrievalContext: context.retrievalContext,
      calculationOutputs: context.calculations,
      mapArtifacts: context.mapArtifacts,
      standardRuleChecks: context.standardRuleChecks,
      evidenceChain,
      reportClassification: context.reportClassification,
      warnings,
      blockers,
      aiStatus: getAiStatus(),
    },
  };
}

export async function generateSectionAssistantReply({
  reportState,
  sectionId,
  userPrompt,
  conversationHistory = [],
}) {
  const context = buildSectionContext({ reportState, sectionId, userInstruction: "" });
  const normalizedHistory = normalizeConversationHistory(conversationHistory);
  const fallback = buildDeterministicAssistantReply(context, userPrompt, normalizedHistory);
  const aiStatus = getAiStatus();
  const createdAtIso = new Date().toISOString();
  const normalizedPrompt = String(userPrompt ?? "").toLowerCase();

  if (isAmbiguousChatRequest(normalizedPrompt)) {
    return {
      replyId: randomUUID(),
      sectionId,
      content: fallback.reply,
      providerCode: "deterministic_guard",
      modelId: null,
      usedLiveModel: false,
      fallbackReason: "The user request was ambiguous, so the controller asked a follow-up before running tools.",
      createdAtIso,
      actions: [],
    };
  }

  const measurementTableReply = buildMeasurementTableReply(context, normalizedPrompt);
  if (measurementTableReply) {
    return {
      replyId: randomUUID(),
      sectionId,
      content: measurementTableReply.reply,
      providerCode: "deterministic_table_formatter",
      modelId: null,
      usedLiveModel: false,
      fallbackReason: "Measurement table formatting is handled by the report-platform table formatter.",
      createdAtIso,
      actions: measurementTableReply.actions,
    };
  }

  const measurementEvidenceReply = buildMeasurementEvidenceQuestionReply(context, normalizedPrompt);
  if (measurementEvidenceReply) {
    return {
      replyId: randomUUID(),
      sectionId,
      content: measurementEvidenceReply.reply,
      providerCode: "deterministic_measurement_evidence_guard",
      modelId: null,
      usedLiveModel: false,
      fallbackReason: "Measurement evidence questions are grounded directly against Android V2 Product exported UT rows.",
      createdAtIso,
      actions: measurementEvidenceReply.actions,
    };
  }

  if (isControlledSectionStateQuestion(normalizedPrompt)) {
    return {
      replyId: randomUUID(),
      sectionId,
      content: fallback.reply,
      providerCode: "deterministic_state_guard",
      modelId: null,
      usedLiveModel: false,
      fallbackReason: "Missing-field and approval-readiness answers are controlled by report-platform state.",
      createdAtIso,
      actions: fallback.actions,
    };
  }

  if (!aiStatus.configured) {
    return {
      replyId: randomUUID(),
      sectionId,
      content: fallback.reply,
      providerCode: "deterministic",
      modelId: null,
      usedLiveModel: false,
      fallbackReason: "LAIQ AI Engine worker is not available for the report-platform worker.",
      createdAtIso,
      actions: fallback.actions,
    };
  }

  try {
    const response = await runStructuredCodexJob({
      prompt: buildAssistantChatPrompt(context, userPrompt, normalizedHistory),
      schema: SECTION_CHAT_SCHEMA,
    });

    return {
      replyId: randomUUID(),
      sectionId,
      content: String(response.parsed.reply ?? "").trim(),
      providerCode: response.aiStatus.provider,
      modelId: response.aiStatus.modelId,
      usedLiveModel: true,
      fallbackReason: null,
      createdAtIso,
      actions: normalizeAssistantActions(response.parsed.actions),
    };
  } catch (error) {
    return {
      replyId: randomUUID(),
      sectionId,
      content: fallback.reply,
      providerCode: "deterministic",
      modelId: null,
      usedLiveModel: false,
      fallbackReason: error instanceof Error ? error.message : "LAIQ AI Engine chat request failed.",
      createdAtIso,
      actions: fallback.actions,
    };
  }
}

export { getAiStatus };

function buildSectionContext({ reportState, sectionId, userInstruction }) {
  if (!reportState?.exportPackage) {
    throw new Error("Report job state is missing the imported Android export package.");
  }

  const template = getSectionTemplate(sectionId);

  const exportPackage = reportState.exportPackage;
  const manualInputs = reportState.manualSupplement ?? {};
  const reportClassification = reportState.reportClassification ?? classifyReportPackage(exportPackage);
  const calculations = buildCalculationOutputs(sectionId, exportPackage);
  const precedentPack = searchPrecedentPack({ sectionId, reportState });
  const retrievalContext = buildFlatRetrievalContext(precedentPack);
  const mapArtifacts = buildMapArtifacts(
    sectionId,
    exportPackage,
    manualInputs,
    reportState.layoutOverrides ?? [],
  );
  const standardRuleChecks = buildStandardRuleChecks({
    sectionId,
    exportPackage,
    reportClassification,
    mapArtifacts,
  });
  const warnings = dedupe([
    ...collectWarnings(sectionId, template.requiredManualFields, manualInputs, exportPackage, mapArtifacts),
    ...standardRuleChecks
      .filter((check) => check.status === "review")
      .map((check) => `Rule review required: ${check.label}. ${check.message}`),
  ]);
  const blockers = collectBlockers(sectionId, exportPackage, mapArtifacts);
  const currentDraft =
    reportState.sectionDrafts?.find((sectionDraft) => sectionDraft.sectionId === sectionId)?.content ?? "";

  return {
    sectionId,
    template,
    exportPackage,
    reportClassification,
    manualInputs,
    calculations,
    retrievalContext,
    precedentPack,
    mapArtifacts,
    standardRuleChecks,
    warnings,
    blockers,
    currentDraft,
    userInstruction,
  };
}

function buildDeterministicSectionDraft(context) {
  return {
    content: context.template.compose(context),
    summary:
      "Generated by the deterministic report-platform fallback engine because a live LAIQ AI Engine response was not available.",
    reviewRequired: context.warnings.length > 0 || context.blockers.length > 0,
    detectedIssues: [],
    providerCode: "deterministic",
    modelId: null,
    usedLiveModel: false,
    fallbackReason: "LAIQ AI Engine worker is not available for the report-platform worker.",
  };
}

export function getSectionTemplate(sectionId) {
  return SECTION_TEMPLATES[sectionId] ?? buildStandardTocTemplate(sectionId);
}

function buildSectionEvidenceChain({
  context,
  warnings,
  blockers,
  generatedAtIso,
  usedLiveModel,
}) {
  const exportPackage = context.exportPackage;
  const fieldEvidence = {
    inspectionId: exportPackage.inspectionId,
    inspectionReference: exportPackage.inspectionReference,
    packageType: exportPackage.packageType,
    schemaVersion: exportPackage.schemaVersion,
    findingIds: exportPackage.findings.map((finding) => finding.findingId),
    measurementKeys: exportPackage.utMeasurements.map((measurement) => measurement.itemKey),
    attachmentIds: exportPackage.attachments.map((attachment) => attachment.attachmentId),
  };
  const precedentRefs = (context.precedentPack.wordingPrecedents ?? []).map((precedent) => ({
    chunkId: precedent.chunkId,
    sourceReportName: precedent.sourceReportName,
    pageStart: precedent.pageStart,
    pageEnd: precedent.pageEnd,
    use: "format_and_wording_reference",
  }));
  const standardRefs = (context.precedentPack.standardsReferences ?? []).map((reference) => ({
    chunkId: reference.chunkId,
    sourceReportName: reference.sourceReportName,
    pageStart: reference.pageStart,
    pageEnd: reference.pageEnd,
    use: "standards_guidance_only",
    usageRule: reference.usageRule,
  }));
  const confidence = blockers.length > 0
    ? 0.35
    : warnings.length > 0
      ? 0.68
      : usedLiveModel
        ? 0.82
        : 0.76;

  return {
    sectionId: context.sectionId,
    generatedAtIso,
    fieldEvidence,
    reportClassification: context.reportClassification,
    standardRuleChecks: context.standardRuleChecks,
    standardRefs,
    precedentRefs,
    calculationRefs: context.calculations.map((calculation) => ({
      key: calculation.key,
      use: "deterministic_calculation_or_summary",
    })),
    mapArtifactRefs: context.mapArtifacts.map((artifact) => ({
      key: artifact.key,
      use: "deterministic_layout_or_override_context",
      requiresReview: Boolean(artifact.requiresReview),
    })),
    confidence,
    requiresHumanReview: blockers.length > 0 || warnings.length > 0,
    approvalStatus: "not_approved",
  };
}

function buildStandardTocTemplate(sectionId) {
  const tocSection = getApiStandardTocSection(sectionId);
  const title = tocSection?.title ?? humanizeKey(sectionId);
  const kind = tocSection?.kind ?? "narrative";
  const requiredManualFields = getStandardTocRequiredManualFields(sectionId, tocSection);

  return {
    templateKey: `api653-standard.${sectionId}.v1`,
    title,
    kind,
    templateExpectation:
      tocSection?.kind === "map"
        ? "API-standard drawing or map page with controlled source-data status. Imported Android geometry stays locked until app parity is approved."
        : "API-standard report section matching the primary sample report ToC, heading style, and table/page-block conventions.",
    requiredManualFields,
    compose: composeStandardTocSection,
  };
}

function getStandardTocRequiredManualFields(sectionId, tocSection) {
  if (!tocSection) return [];
  if (tocSection.kind === "map") return [`${sectionId}-layout-source`];
  if (getMeasurementTableScope(sectionId)) return [];

  const hasDedicatedTemplate = Object.prototype.hasOwnProperty.call(SECTION_TEMPLATES, sectionId);
  if (hasDedicatedTemplate) return [];

  return [`${sectionId}-content-source`];
}

async function tryGenerateSectionWithCodexCli(context) {
  const aiStatus = getAiStatus();
  if (context.sectionId === "tank-inspection-checklist") {
    return null;
  }

  if (!aiStatus.configured) {
    return null;
  }

  try {
    const response = await runStructuredCodexJob({
      prompt: buildSectionGenerationPrompt(context),
      schema: SECTION_GENERATION_SCHEMA,
    });
    const parsed = response.parsed;

    return {
      content: String(parsed.content ?? "").trim(),
      summary: String(parsed.summary ?? "").trim() || "Generated through the LAIQ AI Engine worker.",
      reviewRequired: Boolean(parsed.reviewRequired),
      detectedIssues: Array.isArray(parsed.detectedIssues)
        ? parsed.detectedIssues.map((item) => String(item))
        : [],
      providerCode: response.aiStatus.provider,
      modelId: response.aiStatus.modelId,
      usedLiveModel: true,
      fallbackReason: null,
    };
  } catch (error) {
    return {
      ...buildDeterministicSectionDraft(context),
      fallbackReason: error instanceof Error ? error.message : "LAIQ AI Engine section generation failed.",
      summary:
        "The live LAIQ AI Engine worker failed, so the report-platform fallback engine produced this section draft instead.",
    };
  }
}

function buildSectionGenerationPrompt(context) {
  const promptContext = {
    section: {
      id: context.sectionId,
      title: context.template.title,
      kind: context.template.kind,
      templateKey: context.template.templateKey,
      templateExpectation: context.template.templateExpectation,
    },
    currentDraft: context.currentDraft,
    userInstruction: context.userInstruction,
    warnings: context.warnings,
    blockers: context.blockers,
    manualInputs: context.manualInputs,
    calculations: context.calculations,
    mapArtifacts: context.mapArtifacts,
    standardRuleChecks: context.standardRuleChecks,
    retrievalContext: context.retrievalContext,
    precedentPack: context.precedentPack,
    reportClassification: context.reportClassification,
    importedFacts: buildImportedFactsSummary(context.exportPackage),
    inspectionWideContext: buildInspectionWideContext(context.exportPackage),
  };

  return `You are the LAIQ report writing engine for tank inspection reports.

Generate only client-facing report content for the requested section.
Use only the supplied imported facts, manual inputs, calculations, map artifacts, and precedent guidance.
Use the supplied report classification as the controlling report family, format precedent, and standards/code basis.
Use the supplied standardRuleChecks as deterministic rule guidance; do not replace them with free-form assumptions.
Never invent measurements, geometry, attachments, names, dates, or recommendations that are not grounded in the provided context.
If a required value is missing, use "Pending confirmation".
Preserve the report-family formatting expected for the section.
The primary precedent report is ${API_STANDARD_PRIMARY_REPORT.reference}: ${API_STANDARD_PRIMARY_REPORT.sourceReportName}.
The current inspection is for a vertical aboveground storage tank. Treat any retrieved "horizontal tank" wording as source-document noise unless it refers to a weld orientation.
For map pages, never alter geometry facts or pretend to move markers; describe only the imported Android layout map and any missing report-side caption/checker inputs.

Return JSON matching the provided schema with:
- content
- summary
- reviewRequired
- detectedIssues

Section generation context:
${JSON.stringify(promptContext, null, 2)}
`;
}

function buildAssistantChatPrompt(context, userPrompt, conversationHistory = []) {
  const promptContext = {
    section: {
      id: context.sectionId,
      title: context.template.title,
      kind: context.template.kind,
      templateExpectation: context.template.templateExpectation,
    },
    currentDraft: context.currentDraft,
    warnings: context.warnings,
    blockers: context.blockers,
    manualInputs: context.manualInputs,
    calculations: context.calculations,
    mapArtifacts: context.mapArtifacts,
    standardRuleChecks: context.standardRuleChecks,
    editableActions: buildEditableActionContext(context),
    requiredManualInputs: buildRequiredManualInputState(context),
    reportClassification: context.reportClassification,
    importedFacts: buildImportedFactsSummary(context.exportPackage),
    inspectionWideContext: buildInspectionWideContext(context.exportPackage),
    conversationHistory,
  };

  return `You are the LAIQ section-aware report assistant.

Answer briefly and practically.
Continue the conversation using the prior turns when they are supplied.
Stay anchored to the supplied current-section context and inspection-wide context only.
Do not invent missing facts.
If the request is unclear, impossible, outside the current section, or cannot be completed safely, ask one focused follow-up question and return no actions.
If Android layout geometry is locked, explain the lock and offer a safe alternative such as caption, evidence, or report wording refinement.
If the user asks whether a section is ready to approve, check whether report-side inputs are still missing.
The requiredManualInputs list is the authoritative missing-content panel for this section. Do not invent additional missing fields.
If requiredManualInputs has no missing items, say the section-level missing inputs are complete, while still noting if generation or approval remains.
If the user asks about layout maps, explain the override workflow and remind them that geometry stays anchored to the imported Android baseline.
If the user explicitly asks to change report text, formatting, or layout, return safe structured actions in addition to your reply.
Only use action ids that exist in the provided editableActions context.
For replace_section_content, return compact HTML that uses only h3, p, ul, li, strong, em, u, div, table, thead, tbody, tr, th, and td tags.
For apply_text_style, use whole-section styling only.
For move_marker and resize_plate, keep deltas small and controlled.

Return JSON matching the provided schema with:
- reply
- actions

Section context:
${JSON.stringify(promptContext, null, 2)}

User request:
${userPrompt}
`;
}

function buildDeterministicAssistantReply(context, prompt, conversationHistory = []) {
  const query = prompt.toLowerCase();
  const requiredManualInputs = buildRequiredManualInputState(context);
  const missingInputs = requiredManualInputs.filter((field) => field.missing);
  const missingCount = missingInputs.length;
  const missingLabels = missingInputs.map((field) => field.label);
  const actions = [];
  const priorUserRequest = [...conversationHistory]
    .reverse()
    .find((message) => message.role === "user" && message.content.toLowerCase() !== query);

  if (isAmbiguousChatRequest(query)) {
    return {
      reply: priorUserRequest
        ? `I may be missing the exact target from your last instruction. Are you asking me to refine the wording, adjust report formatting, or explain the locked Android layout map behavior for ${context.template.title}?`
        : `I need one more detail before I can safely act on ${context.template.title}: should I refine wording, apply formatting, or inspect layout-map evidence?`,
      actions,
    };
  }

  if (query.includes("shorter") || query.includes("summar")) {
    return {
      reply: `For ${context.template.title}, I would shorten the draft by keeping the main finding statements and moving supporting detail into bullets or tables. There are currently ${missingCount} missing field${missingCount === 1 ? "" : "s"} still blocking approval.`,
      actions,
    };
  }

  if (query.includes("approve") || query.includes("ready")) {
    return {
      reply: buildReadinessReply(context, missingLabels),
      actions,
    };
  }

  if (query.includes("map") || query.includes("marker") || query.includes("layout")) {
    maybePushMapAction(actions, context, query);
    const surfaceLabel = context.mapArtifacts[0]?.surfaceLabel ?? "layout";
    const measurementScope = getMeasurementTableScope(context.sectionId);
    const supportingSurfaceLabel =
      measurementScope?.targetKey === "external_roof"
        ? "roof"
        : measurementScope?.targetKey === "floor"
          ? "floor"
          : measurementScope?.targetKey === "shell"
            ? "shell"
            : null;
    return {
      reply:
        context.mapArtifacts.length > 0
          ? `This section uses the imported ${surfaceLabel} workspace. I can help rewrite the legend or propose controlled marker or plate adjustments while the Android baseline geometry remains intact.`
          : supportingSurfaceLabel
            ? `This report section is a measurement table, but it uses the imported ${supportingSurfaceLabel} layout map as supporting location evidence in the lower workspace. The map shows where items like nozzles or plates are located; the numeric table values come from Android-exported UT measurement rows.`
          : "This section does not have a layout map. The lower workspace can stay collapsed or be reused for supporting tables or form-style blocks.",
      actions,
    };
  }

  if (isMissingInputHelpdeskRequest(query)) {
    return {
      reply:
        missingCount === 0
          ? `The missing-content panel for ${context.template.title} is complete. I do not see any empty required report-side inputs for this section.`
          : buildMissingInputHelpdeskReply(context, missingInputs),
      actions,
    };
  }

  maybePushTextStyleAction(actions, query);

  if (actions.length > 0) {
    return {
      reply: `I prepared a controlled formatting action for ${context.template.title}. It updates only the report-platform draft presentation layer; the Android export evidence remains unchanged.`,
      actions,
    };
  }

  return {
    reply: `I can help, but I need a more specific instruction before changing ${context.template.title}. Should I refine the report wording, apply a formatting change, review missing inputs, or inspect the layout-map evidence?`,
    actions,
  };
}

function buildMeasurementTableReply(context, query) {
  if (!isMeasurementTableRequest(query)) {
    return null;
  }

  const measurementScope = getMeasurementTableScope(context.sectionId);
  if (!measurementScope) {
    return null;
  }

  const rows = getSectionMeasurementRows(context.exportPackage, measurementScope);

  if (rows.length === 0) {
    return {
      reply: `I could not build a measurement table for ${context.template.title} because no matching exported readings are available for this section.`,
      actions: [],
    };
  }

  const includeStats = shouldIncludeMeasurementStats(query, context.currentDraft);
  const contentHtml = buildMeasurementTableHtml({
    sectionTitle: context.template.title,
    sectionNumber: getApiStandardTocSection(context.sectionId)?.number ?? "",
    rows,
    measurementScope,
    exportPackage: context.exportPackage,
    includeStats,
  });
  const rowLabel =
    measurementScope.itemKind === "region"
      ? `${rows.length} ${measurementScope.rowLabel.toLowerCase()} rows`
      : `${rows.length} ${measurementScope.rowLabel.toLowerCase()} rows`;

  return {
    reply:
      `I prepared a real report table for ${context.template.title} using the ${rowLabel} exported from the Android V2 Product package. ` +
      (includeStats ? "Min, Max, and Average columns are calculated from each row's exported readings. " : "") +
      "I did not add synthetic rows or pending plate numbers.",
    actions: [
      {
        id: randomUUID(),
        type: "replace_section_content",
        label: "Replace with measurement table",
        reason: "User requested all section measurements in a sample-report-style table.",
        contentHtml,
        fontFamily: null,
        fontSize: null,
        textAlign: null,
        color: null,
        markerId: null,
        deltaX: null,
        deltaY: null,
        plateId: null,
        widthDelta: null,
        heightDelta: null,
      },
    ],
  };
}

function buildMeasurementEvidenceQuestionReply(context, query) {
  const measurementScope = getMeasurementTableScope(context.sectionId);
  if (!measurementScope || !isMeasurementEvidenceQuestion(query)) {
    return null;
  }

  const rows = getSectionMeasurementRows(context.exportPackage, measurementScope);
  if (rows.length === 0) {
    return {
      reply: `I checked the Android V2 Product export for ${context.template.title}, but no matching ${measurementScope.rowLabel.toLowerCase()} UT rows are available. In that case the draft must stay pending until the app export or an approved worksheet supplies the readings.`,
      actions: [],
    };
  }

  const mentionedRows = rows.filter((row) => {
    const labels = [
      row.itemLabel,
      row.itemKey,
      row.elementId,
      row.plateId,
    ].filter(Boolean).map((value) => String(value).toLowerCase());

    return labels.some((label) => query.includes(label));
  });
  const rowsToExplain = mentionedRows.length > 0 ? mentionedRows : rows.slice(0, 3);
  const rowSummary = rowsToExplain.map((row) => formatMeasurementEvidenceSentence(row, measurementScope)).join(" ");
  const currentDraftLooksStale = /pending confirmation/i.test(context.currentDraft ?? "");
  const surfaceLabel = measurementScope.targetKey === "external_roof"
    ? "roof"
    : measurementScope.targetKey === "floor"
      ? "floor"
      : "shell";
  const contentHtml = buildMeasurementTableHtml({
    sectionTitle: context.template.title,
    sectionNumber: getApiStandardTocSection(context.sectionId)?.number ?? "",
    rows,
    measurementScope,
    exportPackage: context.exportPackage,
    includeStats: false,
  });

  return {
    reply: [
      `The mock/app export does have the measurement data for ${context.template.title}.`,
      `The ${surfaceLabel} layout map is the location evidence, but the numeric values come from exported UT rows, not from the drawing geometry itself.`,
      rowSummary,
      currentDraftLooksStale
        ? "The current generated draft is stale/wrong because it says Pending confirmation even though matching Android-exported UT rows exist. I prepared a replacement table from the export."
        : "The current draft should use these exported rows directly; no extra source-data field is required for these app-sourced measurements.",
    ].join(" "),
    actions: currentDraftLooksStale
      ? [
          {
            id: randomUUID(),
            type: "replace_section_content",
            label: "Replace stale pending table with exported measurements",
            reason: "The section has Android-exported UT rows, so pending placeholders should be replaced.",
            contentHtml,
            fontFamily: null,
            fontSize: null,
            textAlign: null,
            color: null,
            markerId: null,
            deltaX: null,
            deltaY: null,
            plateId: null,
            widthDelta: null,
            heightDelta: null,
          },
        ]
      : [],
  };
}

function isMeasurementEvidenceQuestion(query) {
  const mentionsMeasurement =
    query.includes("measurement") ||
    query.includes("measurements") ||
    query.includes("reading") ||
    query.includes("readings") ||
    query.includes("ut") ||
    query.includes("thickness");
  const mentionsEvidenceMismatch =
    query.includes("pending") ||
    query.includes("layout") ||
    query.includes("map") ||
    query.includes("source") ||
    query.includes("data") ||
    /\br\d+\b/i.test(query) ||
    /\bs\d+\b/i.test(query);

  return mentionsMeasurement && mentionsEvidenceMismatch;
}

function getSectionMeasurementRows(exportPackage, measurementScope) {
  return exportPackage.utMeasurements
    .filter(
      (measurement) =>
        measurement.targetKey === measurementScope.targetKey &&
        measurement.itemKind === measurementScope.itemKind,
    )
    .sort(compareMeasurementRows);
}

function formatMeasurementEvidenceSentence(measurement, measurementScope) {
  const valueLabels = measurementScope.valueLabels;
  const values = [
    measurement.value1,
    measurement.value2,
    measurement.value3,
    measurement.value4,
    measurement.itemKind === "element" && measurement.reinforcementPadReading != null
      ? measurement.reinforcementPadReading
      : measurement.value5,
  ].slice(0, valueLabels.length);
  const valueText = values
    .map((value, index) => {
      const fallback =
        measurement.itemKind === "element" && index === valueLabels.length - 1
          ? "NA"
          : "Pending confirmation";
      return `${valueLabels[index]} ${formatThicknessCell(value, fallback)}`;
    })
    .join(", ");
  const sizeText = measurementScope.includeNozzleSize
    ? `, size ${formatOptionalText(measurement.nozzleSize, "Pending confirmation")}`
    : "";

  return `${measurement.itemLabel}${sizeText}: ${valueText}.`;
}

function isMeasurementTableRequest(query) {
  const asksForMeasurementTable =
    (query.includes("table") || query.includes("tabular")) &&
    ["measurement", "measurements", "reading", "readings", "ut", "thickness"].some((keyword) =>
      query.includes(keyword),
    );
  const asksForStatsColumns =
    (query.includes("table") || query.includes("column") || query.includes("columns")) &&
    (query.includes("min") || query.includes("minimum")) &&
    (query.includes("max") || query.includes("maximum")) &&
    (query.includes("average") || query.includes("avg") || query.includes("averages"));
  const asksToRestoreTableFormat =
    query.includes("table") &&
    (query.includes("format is gone") ||
      query.includes("format gone") ||
      query.includes("restore") ||
      query.includes("formatting"));

  return (
    asksForMeasurementTable ||
    asksForStatsColumns ||
    asksToRestoreTableFormat
  );
}

function shouldIncludeMeasurementStats(query, currentDraft = "") {
  return (
    query.includes("min") ||
    query.includes("minimum") ||
    query.includes("max") ||
    query.includes("maximum") ||
    query.includes("average") ||
    query.includes("avg") ||
    />\s*min\s*</i.test(currentDraft) ||
    />\s*max\s*</i.test(currentDraft) ||
    />\s*average\s*</i.test(currentDraft)
  );
}

function getMeasurementTableScope(sectionId) {
  const scopes = {
    "roof-plate-thickness-measurements": {
      targetKey: "external_roof",
      itemKind: "region",
      rowLabel: "Plate",
      firstColumnLabel: "Plate No.",
      valueLabels: ["A", "B", "C", "D", "E"],
      note:
        "Roof nozzle readings are held in the separate Roof Nozzle & Reinforcement Pad Thickness Measurements section.",
    },
    "roof-nozzle-reinforcement-pad-thickness-measurements": {
      targetKey: "external_roof",
      itemKind: "element",
      rowLabel: "Nozzle",
      firstColumnLabel: "Nozzle",
      includeNozzleSize: true,
      valueLabels: ["North", "East", "South", "West", "Reinforcement Pad"],
      note: "Readings follow the roof nozzle orientation exported by the Android V2 Product package.",
    },
    "shell-plate-thickness-measurements": {
      targetKey: "shell",
      itemKind: "region",
      rowLabel: "Shell location",
      firstColumnLabel: "Location",
      valueLabels: ["A", "B", "C", "D", "E"],
      note: "Shell rows are grouped by strake/course and compass lane from the Android export.",
    },
    "shell-nozzle-reinforcement-pad-thickness-measurements": {
      targetKey: "shell",
      itemKind: "element",
      rowLabel: "Nozzle",
      firstColumnLabel: "Nozzle",
      includeNozzleSize: true,
      valueLabels: ["12 o'clock", "3 o'clock", "6 o'clock", "9 o'clock", "Reinforcement Pad"],
      note: "Shell nozzle rows include reinforcement pad readings where exported.",
    },
  };

  return scopes[sectionId] ?? null;
}

function buildMeasurementTableHtml({
  sectionTitle,
  sectionNumber,
  rows,
  measurementScope,
  exportPackage,
  includeStats = false,
}) {
  const heading = `${sectionNumber ? `${sectionNumber} ` : ""}${sectionTitle}`.trim().toUpperCase();
  const headerLabels = [
    measurementScope.firstColumnLabel,
    ...(measurementScope.includeNozzleSize ? ["Nozzle Dia. / Size"] : []),
    ...measurementScope.valueLabels,
    ...(includeStats ? ["Min", "Max", "Average"] : []),
  ];
  const headerCells = headerLabels
    .map((label) => `<th>${escapeHtml(label)}</th>`)
    .join("");
  const bodyRows = rows
    .map((measurement) => {
      const rowLabel = formatMeasurementRowLabel(measurement, measurementScope);
      const values = [
        measurement.value1,
        measurement.value2,
        measurement.value3,
        measurement.value4,
        measurement.itemKind === "element" && measurement.reinforcementPadReading != null
          ? measurement.reinforcementPadReading
          : measurement.value5,
      ];
      const displayedValues = values.slice(0, measurementScope.valueLabels.length);
      const numericValues = displayedValues.filter((value) => typeof value === "number");
      const statValues =
        includeStats && numericValues.length > 0
          ? [
              Math.min(...numericValues),
              Math.max(...numericValues),
              numericValues.reduce((total, value) => total + value, 0) / numericValues.length,
            ]
          : [];
      const sizeCells = measurementScope.includeNozzleSize
        ? [`<td>${escapeHtml(formatOptionalText(measurement.nozzleSize, "Pending confirmation"))}</td>`]
        : [];
      const valueCells = displayedValues
        .map((value, index) => {
          const isReinforcementPadColumn =
            measurementScope.itemKind === "element" &&
            index === measurementScope.valueLabels.length - 1;
          return `<td>${formatThicknessCell(value, isReinforcementPadColumn ? "NA" : "Pending confirmation")}</td>`;
        })
        .join("");
      const statCells = statValues
        .map((value) => `<td>${formatThicknessCell(value)}</td>`)
        .join("");

      return `<tr><td>${escapeHtml(rowLabel)}</td>${sizeCells.join("")}${valueCells}${statCells}</tr>`;
    })
    .join("");

  return [
    `<h3>${escapeHtml(heading)}</h3>`,
    `<p>All thickness readings are shown in millimetres and are sourced from Android V2 Product export ${escapeHtml(exportPackage.inspectionReference)}.</p>`,
    `<div class="report-table-wrap"><table class="report-measurement-table"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`,
    `<p><em>${escapeHtml(measurementScope.note)}</em></p>`,
  ].join("");
}

function formatMeasurementRowLabel(measurement, measurementScope) {
  if (measurementScope.itemKind === "region" && measurement.plateId) {
    if (measurementScope.targetKey === "shell") {
      return measurement.itemLabel;
    }

    return measurement.plateId;
  }

  return measurement.itemLabel;
}

function compareMeasurementRows(left, right) {
  const leftNumeric = Number(left.plateId);
  const rightNumeric = Number(right.plateId);

  if (Number.isFinite(leftNumeric) && Number.isFinite(rightNumeric) && leftNumeric !== rightNumeric) {
    return leftNumeric - rightNumeric;
  }

  if (left.course != null && right.course != null && left.course !== right.course) {
    return left.course - right.course;
  }

  return String(left.itemLabel).localeCompare(String(right.itemLabel), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function formatThicknessCell(value, fallback = "") {
  return typeof value === "number" ? value.toFixed(2) : fallback;
}

function formatOptionalText(value, fallback = "") {
  const trimmed = String(value ?? "").trim();
  return trimmed || fallback;
}

function normalizeConversationHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-10)
    .map((message) => ({
      role: message?.role === "assistant" ? "assistant" : "user",
      content: String(message?.content ?? "").trim().slice(0, 1800),
    }))
    .filter((message) => message.content.length > 0);
}

function isAmbiguousChatRequest(query) {
  const normalized = query.trim();
  if (!normalized) return true;

  return [
    "do it",
    "yes",
    "ok",
    "make it better",
    "fix it",
    "not correct",
    "wrong",
    "cannot work",
    "does not work",
    "not working",
  ].includes(normalized);
}

function isControlledSectionStateQuestion(query) {
  const normalized = query.trim();
  if (!normalized) return false;

  const asksState = [
    "approve",
    "approval",
    "complete",
    "field",
    "fields",
    "missing",
    "ready",
    "source data",
    "source",
    "what should",
    "what do i",
    "fill",
    "help",
  ].some((keyword) => normalized.includes(keyword));
  const asksCreativeEdit = [
    "format",
    "generate",
    "improve",
    "refine",
    "rewrite",
    "style",
  ].some((keyword) => hasKeyword(normalized, keyword));

  return asksState && !asksCreativeEdit;
}

function hasKeyword(value, keyword) {
  return new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i").test(value);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isMissingInputHelpdeskRequest(query) {
  return [
    "missing",
    "field",
    "fields",
    "source data",
    "source",
    "what should",
    "what do i",
    "fill",
    "help",
    "guide",
  ].some((keyword) => query.includes(keyword));
}

function buildRequiredManualInputState(context) {
  return context.template.requiredManualFields.map((fieldKey) => {
    const value = String(context.manualInputs[fieldKey] ?? "").trim();
    return {
      key: fieldKey,
      label: getManualFieldLabel(fieldKey, context),
      guidance: getManualFieldGuidance(fieldKey, context),
      value,
      missing: value.length === 0,
    };
  });
}

function getManualFieldLabel(fieldKey, context) {
  if (MANUAL_FIELD_LABELS[fieldKey]) return MANUAL_FIELD_LABELS[fieldKey];
  if (fieldKey === `${context.sectionId}-content-source`) return `${context.template.title} Source Data`;
  if (fieldKey === `${context.sectionId}-layout-source`) return `${context.template.title} Source`;
  return humanizeKey(fieldKey);
}

function getManualFieldGuidance(fieldKey, context) {
  if (MANUAL_FIELD_GUIDANCE[fieldKey]) return MANUAL_FIELD_GUIDANCE[fieldKey];

  if (fieldKey === `${context.sectionId}-content-source`) {
    return [
      "Add the approved section-specific source data that is not yet captured by the Android export.",
      "Examples: worksheet values, calculation sheet reference, test report number, settlement survey source, MFL plate-map source, or inspector/client confirmation text.",
      "If the data does not exist yet, leave the field pending and do not tune the generator to invent it.",
    ].join(" ");
  }

  if (fieldKey === `${context.sectionId}-layout-source`) {
    return [
      "Identify the approved drawing or worksheet source for this layout page.",
      "If Android V2 Product already provides the matching map, use the imported app layout as the baseline; otherwise attach or describe the approved report-side source.",
    ].join(" ");
  }

  return "Fill this report-side field from an approved source, or leave it pending until the inspector confirms it.";
}

function buildMissingInputHelpdeskReply(context, missingInputs) {
  const first = missingInputs[0];
  const lines = missingInputs.map((field, index) =>
    `${index + 1}. ${field.label}: ${field.guidance}`,
  );

  return [
    `${context.template.title} has ${missingInputs.length} missing report-side item${missingInputs.length === 1 ? "" : "s"} before approval.`,
    `Start with ${first.label}. ${first.guidance}`,
    "You can either type the confirmed value in the right panel, click the suggestion if it is suitable, or leave it pending if the source is not available.",
    `Open items: ${lines.join(" ")}`,
  ].join(" ");
}

function buildReadinessReply(context, missingLabels) {
  if (missingLabels.length > 0) {
    return `${context.template.title} is not approval-ready yet. Complete the missing-content panel first: ${missingLabels.join(", ")}.`;
  }

  if (!String(context.currentDraft ?? "").trim()) {
    return `The required missing-content fields for ${context.template.title} are complete. Generate the section draft before approval so the filled inputs are reflected in the report content.`;
  }

  return `${context.template.title} can move toward approval once you confirm the current wording. I do not see any missing-content blockers in the required report-side inputs.`;
}

function buildEditableActionContext(context) {
  const mapArtifact = context.mapArtifacts[0];
  const targetKey = mapArtifact?.targetKey ?? "shell";
  const mapFindings = context.exportPackage.findings
    .filter((finding) => finding.targetKey === targetKey)
    .map((finding) => ({
      id: finding.findingId,
      label: finding.itemLabel,
      type: "finding",
    }));
  const mapElements = context.exportPackage.elements
    .filter((element) => element.targetKey === targetKey)
    .map((element) => ({
      id: element.elementId,
      label: element.elementLabel,
      type: "element",
    }));
  const plateIds = [];

  if (mapArtifact?.gridRows && mapArtifact?.gridColumns) {
    for (let rowIndex = 1; rowIndex <= mapArtifact.gridRows; rowIndex += 1) {
      for (let columnIndex = 1; columnIndex <= mapArtifact.gridColumns; columnIndex += 1) {
        plateIds.push({
          id: `plate-${rowIndex}-${columnIndex}`,
          label: `C${mapArtifact.gridRows - rowIndex + 1}-P${columnIndex}`,
        });
      }
    }
  }

  return {
    allowedTextStyles: {
      fontFamily: [
        "Aptos, 'Segoe UI', sans-serif",
        "Arial, sans-serif",
        "Georgia, serif",
        "Consolas, monospace",
      ],
      fontSize: ["12px", "14px", "16px", "18px", "20px", "24px"],
      textAlign: ["left", "center"],
    },
    allowedMapMarkers: [...mapFindings, ...mapElements],
    allowedMapPlates: plateIds.slice(0, 120),
  };
}

function maybePushTextStyleAction(actions, query) {
  const wantsFormatting = [
    "align",
    "bigger",
    "blue",
    "center",
    "colour",
    "color",
    "font",
    "format",
    "formatting",
    "heading",
    "larger",
    "red",
    "smaller",
    "style",
  ].some((keyword) => query.includes(keyword));

  if (!wantsFormatting) {
    return;
  }

  actions.push({
    id: randomUUID(),
    type: "apply_text_style",
    label: "Apply whole-section formatting",
    reason: "Requested report formatting update from the chat panel.",
    textAlign: query.includes("center") ? "center" : "left",
    fontFamily: query.includes("georgia")
      ? "Georgia, serif"
      : query.includes("consolas")
        ? "Consolas, monospace"
        : query.includes("arial")
          ? "Arial, sans-serif"
          : "Aptos, 'Segoe UI', sans-serif",
    fontSize: query.includes("smaller") ? "14px" : query.includes("larger") || query.includes("bigger") ? "18px" : "16px",
    color: query.includes("red") ? "#ef4c57" : query.includes("blue") ? "#0d4f90" : "#163250",
  });
}

function maybePushMapAction(actions, context, query) {
  const editableContext = buildEditableActionContext(context);
  const targetMarker = editableContext.allowedMapMarkers.find((marker) =>
    query.includes(marker.label.toLowerCase()) || query.includes(marker.id.toLowerCase()),
  ) ?? editableContext.allowedMapMarkers[0];
  const targetPlate = editableContext.allowedMapPlates.find((plate) =>
    query.includes(plate.label.toLowerCase()) || query.includes(plate.id.toLowerCase()),
  ) ?? editableContext.allowedMapPlates[0];

  if (targetMarker && (query.includes("move") || query.includes("left") || query.includes("right") || query.includes("up") || query.includes("down"))) {
    actions.push({
      id: randomUUID(),
      type: "move_marker",
      label: `Move marker ${targetMarker.label}`,
      reason: "Requested map marker adjustment from the chat panel.",
      markerId: targetMarker.id,
      deltaX: query.includes("left") ? -0.03 : query.includes("right") ? 0.03 : 0,
      deltaY: query.includes("up") ? -0.03 : query.includes("down") ? 0.03 : 0,
    });
  }

  if (targetPlate && (query.includes("plate") || query.includes("wider") || query.includes("taller") || query.includes("resize"))) {
    actions.push({
      id: randomUUID(),
      type: "resize_plate",
      label: `Resize plate ${targetPlate.label}`,
      reason: "Requested plate dimension adjustment from the chat panel.",
      plateId: targetPlate.id,
      widthDelta: query.includes("wider") ? 0.02 : 0,
      heightDelta: query.includes("taller") ? 0.02 : 0,
    });
  }
}

function normalizeAssistantActions(actions) {
  if (!Array.isArray(actions)) {
    return [];
  }

  return actions.map((action) => ({
    id: String(action.id ?? randomUUID()),
    type: String(action.type ?? ""),
    label: String(action.label ?? "Apply assistant action"),
    reason: String(action.reason ?? ""),
    contentHtml: action.contentHtml == null ? undefined : String(action.contentHtml),
    fontFamily: action.fontFamily == null ? undefined : String(action.fontFamily),
    fontSize: action.fontSize == null ? undefined : String(action.fontSize),
    textAlign:
      action.textAlign === "center" || action.textAlign === "left"
        ? action.textAlign
        : undefined,
    color: action.color == null ? undefined : String(action.color),
    markerId: action.markerId == null ? undefined : String(action.markerId),
    deltaX: typeof action.deltaX === "number" ? action.deltaX : undefined,
    deltaY: typeof action.deltaY === "number" ? action.deltaY : undefined,
    plateId: action.plateId == null ? undefined : String(action.plateId),
    widthDelta: typeof action.widthDelta === "number" ? action.widthDelta : undefined,
    heightDelta: typeof action.heightDelta === "number" ? action.heightDelta : undefined,
  }));
}

function buildImportedFactsSummary(exportPackage) {
  const reportClassification = classifyReportPackage(exportPackage);
  const measurementCounts = buildMeasurementCounts(exportPackage);
  const elementCounts = buildElementCounts(exportPackage);

  return {
    inspectionReference: exportPackage.inspectionReference,
    client: exportPackage.task.client,
    tankNumber: exportPackage.task.tankNumber,
    tankType: "Vertical aboveground storage tank",
    location: exportPackage.inspectionRecord.location,
    findingCount: exportPackage.findings.length,
    attachmentCount: exportPackage.attachments.length,
    measurementCount: exportPackage.utMeasurements.length,
    voiceNarrativeCount: (exportPackage.voiceNarratives ?? []).length,
    checklistItemCount: exportPackage.inspectionChecklistItems.length,
    roofPlateUtRows: measurementCounts["external_roof|region"] ?? 0,
    roofElementUtRows: measurementCounts["external_roof|element"] ?? 0,
    shellPlateUtRows: measurementCounts["shell|region"] ?? 0,
    shellElementUtRows: measurementCounts["shell|element"] ?? 0,
    floorPlateUtRows: measurementCounts["floor|region"] ?? 0,
    elementCounts,
    workflowScreen: exportPackage.workflowScreen,
    tenantName: exportPackage.profile.tenantName,
    workspaceName: exportPackage.profile.workspaceName,
    reportFamily: reportClassification.reportFamilyLabel,
    primaryCodes: reportClassification.primaryCodes.map((code) => code.label),
    supportingCodes: reportClassification.supportingCodes.map((code) => code.label),
  };
}

function buildInspectionWideContext(exportPackage) {
  return {
    identity: {
      inspectionReference: exportPackage.inspectionReference,
      client: exportPackage.task.client,
      tankNumber: exportPackage.task.tankNumber,
      location: exportPackage.inspectionRecord.location,
      fieldLeaseName: exportPackage.inspectionRecord.fieldLeaseName,
      inspector: exportPackage.inspectionRecord.inspector,
      tankType: "Vertical aboveground storage tank",
      exportedAtIso: exportPackage.exportedAtIso,
    },
    layoutConfigs: exportPackage.layoutConfigs.map((config) => ({
      targetKey: config.targetKey,
      referenceMode: config.referenceMode,
      roofRowCount: config.roofRowCount,
      roofWidestRowPlateCount: config.roofWidestRowPlateCount,
      shellCourseCount: config.shellCourseCount,
      shellPlatesPerCourse: config.shellPlatesPerCourse,
      shellLaneCount: config.shellLaneCount,
      floorPlateCount: config.floorPlateCount,
      floorPatternCountX: config.floorPatternCountX,
      floorPatternCountY: config.floorPatternCountY,
    })),
    measurementSummary: buildMeasurementSummaryByScope(exportPackage),
    elementSummary: buildElementSummaryByScope(exportPackage),
    findingNotes: exportPackage.findings.map((finding) => ({
      findingId: finding.findingId,
      targetKey: finding.targetKey,
      itemLabel: finding.itemLabel,
      linkedUtItemKey: finding.linkedUtItemKey,
      note: finding.note,
      attachmentCount: finding.attachmentCount,
      hasMissingAttachment: finding.hasMissingAttachment,
    })),
    checklistSectionNotes: exportPackage.inspectionChecklistSectionNotes.map((note) => ({
      sectionKey: note.sectionKey,
      sectionTitle: note.sectionTitle,
      note: note.note,
    })),
    voiceNarratives: (exportPackage.voiceNarratives ?? []).map((note) => ({
      sectionKey: note.sectionKey,
      sectionTitle: note.sectionTitle,
      speakerName: note.speakerName,
      capturedAtIso: note.capturedAtIso,
      transcriptText: note.transcriptText,
      linkedTargetKeys: note.linkedTargetKeys,
      linkedFindingIds: note.linkedFindingIds,
      confidence: note.confidence,
    })),
  };
}

function buildMeasurementCounts(exportPackage) {
  return exportPackage.utMeasurements.reduce((counts, measurement) => {
    const key = `${measurement.targetKey}|${measurement.itemKind}`;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function buildElementCounts(exportPackage) {
  return exportPackage.elements.reduce((counts, element) => {
    const key = `${element.targetKey}|${element.elementTypeKey}`;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function buildMeasurementSummaryByScope(exportPackage) {
  const scopedRows = new Map();

  for (const measurement of exportPackage.utMeasurements) {
    const key = `${measurement.targetKey}|${measurement.itemKind}`;
    const current = scopedRows.get(key) ?? [];
    current.push(measurement);
    scopedRows.set(key, current);
  }

  return [...scopedRows.entries()].map(([scopeKey, rows]) => {
    const values = rows.flatMap((row) => getMeasurementValuesIncludingReinforcement(row));
    return {
      scopeKey,
      rowCount: rows.length,
      measuredRowCount: rows.filter((row) => row.measured).length,
      minValueMm: values.length > 0 ? Math.min(...values) : null,
      maxValueMm: values.length > 0 ? Math.max(...values) : null,
      averageValueMm: values.length > 0 ? sum(values) / values.length : null,
      sampleLabels: rows.slice(0, 12).map((row) => row.itemLabel),
    };
  });
}

function buildElementSummaryByScope(exportPackage) {
  const grouped = new Map();

  for (const element of exportPackage.elements) {
    const key = `${element.targetKey}|${element.elementTypeKey}`;
    const current = grouped.get(key) ?? [];
    current.push(element);
    grouped.set(key, current);
  }

  return [...grouped.entries()].map(([scopeKey, elements]) => ({
    scopeKey,
    count: elements.length,
    labels: elements.slice(0, 18).map((element) => element.elementLabel),
  }));
}

function buildCalculationOutputs(sectionId, exportPackage) {
  const outputs = [];

  if (
    sectionId === "inspection-report" ||
    sectionId === "repair-recommendations" ||
    sectionId === "photographs" ||
    sectionId === "attachment-mpi-photographs" ||
    getApiStandardTocSection(sectionId)
  ) {
    outputs.push(buildFindingSummary(exportPackage));
    outputs.push(buildShellUtSummary(exportPackage));
    outputs.push(buildChecklistSummary(exportPackage));
    outputs.push(buildAttachmentSummary(exportPackage));
  }

  if (MAP_SECTION_IDS.has(sectionId)) {
    outputs.push(buildFindingSummary(exportPackage));
  }

  if (sectionId === "attachment-mpi-report") {
    outputs.push(buildAttachmentSummary(exportPackage));
    outputs.push(buildFindingSummary(exportPackage));
  }

  return outputs.filter(Boolean);
}

function buildFindingSummary(exportPackage) {
  const shellFindings = exportPackage.findings.filter((finding) => finding.targetKey === "shell");
  const labels = shellFindings.map((finding) => finding.itemLabel);
  const linkedUtKeys = shellFindings
    .map((finding) => finding.linkedUtItemKey)
    .filter((value) => typeof value === "string" && value.length > 0);
  const attachmentCount = shellFindings.reduce((count, finding) => count + (finding.attachmentCount ?? 0), 0);

  return {
    key: "finding_summary",
    findingCount: shellFindings.length,
    labels,
    linkedUtKeys,
    attachmentCount,
    notes: shellFindings.map((finding) => ({
      label: finding.itemLabel,
      note: finding.note,
    })),
  };
}

function buildShellUtSummary(exportPackage) {
  const measuredRows = exportPackage.utMeasurements.filter(
    (measurement) => measurement.targetKey === "shell" && measurement.measured,
  );
  const rawValues = measuredRows.flatMap((measurement) => getMeasurementValues(measurement));
  const bandSummaries = measuredRows.map((measurement) => {
    const values = getMeasurementValues(measurement);
    const minValue = values.length > 0 ? Math.min(...values) : null;
    const maxValue = values.length > 0 ? Math.max(...values) : null;
    const averageValue = values.length > 0 ? sum(values) / values.length : null;

    return {
      itemLabel: measurement.itemLabel,
      course: measurement.course,
      plateId: measurement.plateId,
      minValueMm: minValue,
      maxValueMm: maxValue,
      averageValueMm: averageValue,
    };
  });

  return {
    key: "shell_ut_summary",
    rowCount: measuredRows.length,
    minValueMm: rawValues.length > 0 ? Math.min(...rawValues) : null,
    maxValueMm: rawValues.length > 0 ? Math.max(...rawValues) : null,
    averageValueMm: rawValues.length > 0 ? sum(rawValues) / rawValues.length : null,
    bandSummaries,
  };
}

function buildChecklistSummary(exportPackage) {
  const notes = exportPackage.inspectionChecklistSectionNotes ?? [];
  return {
    key: "checklist_summary",
    noteCount: notes.length,
    notes: notes.map((note) => ({
      sectionTitle: note.sectionTitle,
      note: note.note,
    })),
  };
}

function buildAttachmentSummary(exportPackage) {
  const attachments = exportPackage.attachments ?? [];
  const photoCount = attachments.filter((attachment) => isPhotoAttachment(attachment)).length;
  const documentCount = attachments.filter((attachment) => attachment.kind === "document").length;

  return {
    key: "attachment_summary",
    totalCount: attachments.length,
    photoCount,
    documentCount,
    names: attachments.map((attachment) => attachment.displayName),
    missingAttachmentCount: exportPackage.findings.filter((finding) => finding.hasMissingAttachment).length,
  };
}

function isPhotoAttachment(attachment) {
  return attachment.kind === "photo" || attachment.kind === "finding_photo";
}

function buildMapArtifacts(sectionId, exportPackage, manualInputs, layoutOverrides) {
  if (!MAP_SECTION_IDS.has(sectionId)) {
    return [];
  }

  const tocSection = getApiStandardTocSection(sectionId);
  const surfaceKey = tocSection?.layoutSurface ?? (SHELL_MAP_SECTION_IDS.has(sectionId) ? "shell" : null);
  const targetKey =
    surfaceKey === "roof"
      ? "external_roof"
      : surfaceKey === "floor"
        ? "floor"
        : surfaceKey === "shell"
          ? "shell"
          : null;

  if (!targetKey) {
    return [];
  }

  const layoutConfig = exportPackage.layoutConfigs.find((config) => config.targetKey === targetKey);
  if (!layoutConfig) {
    return [];
  }

  const gridRows =
    surfaceKey === "roof"
      ? layoutConfig.roofRowCount ?? 0
      : surfaceKey === "floor"
        ? layoutConfig.floorPatternCountY ?? 0
        : layoutConfig.shellCourseCount ?? exportPackage.inspectionRecord.shellCourseCount ?? 0;
  const gridColumns =
    surfaceKey === "roof"
      ? layoutConfig.roofWidestRowPlateCount ?? 0
      : surfaceKey === "floor"
        ? layoutConfig.floorPatternCountX ?? 0
        : layoutConfig.shellPlatesPerCourse ?? exportPackage.inspectionRecord.shellLaneCount ?? 0;
  const surfaceFindings = exportPackage.findings.filter((finding) => finding.targetKey === targetKey);
  const surfaceElements = exportPackage.elements.filter((element) => element.targetKey === targetKey);
  const layoutOverride = layoutOverrides.find((item) => item.sectionId === sectionId)?.layoutMap ?? null;
  const surfaceLabel = surfaceKey === "roof" ? "roof" : surfaceKey === "floor" ? "floor" : "shell";

  return [
    {
      key: `${surfaceLabel}_layout_effective`,
      sectionTitle: getSectionTemplate(sectionId).title,
      targetKey,
      surfaceKey,
      surfaceLabel,
      gridRows,
      gridColumns,
      referenceMode: humanizeKey(
        layoutConfig.referenceMode ?? exportPackage.inspectionRecord.referenceMode ?? "tank_north",
      ),
      findingLabels: surfaceFindings.map((finding) => finding.itemLabel),
      elementLabels: surfaceElements.map((element) => element.elementLabel),
      overrideCount: Number(layoutOverride?.overrideCount ?? 0),
      markerCount: Number(layoutOverride?.markers?.length ?? surfaceFindings.length + surfaceElements.length),
      checkedBy: formatPending(manualInputs.checkedBy),
      legendNote: formatPending(manualInputs.legendNote),
      requiresReview:
        Number(layoutOverride?.overrideCount ?? 0) > 0 ||
        !manualInputs.checkedBy ||
        !manualInputs.legendNote,
    },
  ];
}

function collectWarnings(sectionId, requiredManualFields, manualInputs, exportPackage, mapArtifacts) {
  const warnings = requiredManualFields
    .filter((fieldKey) => !String(manualInputs[fieldKey] ?? "").trim())
    .map((fieldKey) => `Missing report-side input: ${MANUAL_FIELD_LABELS[fieldKey] ?? fieldKey}.`);

  const attachmentSummary = buildAttachmentSummary(exportPackage);
  if (attachmentSummary.missingAttachmentCount > 0) {
    warnings.push(
      `${attachmentSummary.missingAttachmentCount} finding location still reports a missing attachment in the imported evidence set.`,
    );
  }

  if (sectionId === "inspection-report" && !String(manualInputs.engineeringImplication ?? "").trim()) {
    warnings.push("The client-facing engineering implication paragraph is still pending review-side confirmation.");
  }

  if (sectionId === "repair-recommendations" && attachmentSummary.documentCount === 0) {
    warnings.push("No supporting document attachment was imported for the recommendation evidence set.");
  }

  if (MAP_SECTION_IDS.has(sectionId) && mapArtifacts[0]?.overrideCount > 0) {
    warnings.push(
      `The current sketch includes ${mapArtifacts[0].overrideCount} user override${mapArtifacts[0].overrideCount === 1 ? "" : "s"} that must remain reviewable before issue.`,
    );
  }

  return dedupe(warnings);
}

function collectBlockers(sectionId, exportPackage, mapArtifacts) {
  const blockers = [];

  if (sectionId === "inspection-report" && exportPackage.findings.length === 0) {
    blockers.push("The imported package has no findings, so the inspection narrative cannot be grounded to evidence.");
  }

  if (MAP_SECTION_IDS.has(sectionId) && mapArtifacts.length === 0) {
    const tocSection = getApiStandardTocSection(sectionId);
    blockers.push(
      `${humanizeKey(tocSection?.layoutSurface ?? "layout")} metadata is missing, so the map page cannot be generated safely.`,
    );
  }

  if (sectionId === "attachment-mpi-report" && exportPackage.attachments.length === 0) {
    blockers.push("No attachments were imported for the attachment page.");
  }

  return blockers;
}

function composeCoverSection({ exportPackage, manualInputs }) {
  return `INTERNAL & EXTERNAL INSPECTION REPORT

${exportPackage.task.client.toUpperCase()}
Tank ${exportPackage.task.tankNumber}
Vertical Aboveground Storage Tank
Report Reference: ${manualInputs.reportReference ?? exportPackage.inspectionReference}
Inspection Reference: ${exportPackage.inspectionReference}
Inspection Window: ${manualInputs.inspectedDate ?? formatDateLabel(exportPackage.exportedAtIso)}
Location: ${exportPackage.inspectionRecord.location}

This report issue is assembled from the Android V2 Product field capture baseline and finalized on the report platform for client-facing presentation control.

Approved cover visual: ${formatPending(manualInputs.coverHeroImage)}.`;
}

function composeScopeSection({ exportPackage, manualInputs }) {
  return `1       SCOPE OF INSPECTION

➢ To carry out a general and close visual inspection on the internal and external areas of the vertical aboveground storage tank and record conditions that may be detrimental to serviceability.

➢ To review roof, shell, floor, nozzle, settlement, NDT, and photographic evidence against the API 653 report format.

➢ To compile the report sections, worksheets, photographs, layout drawings, and engineering assessment in the same order as the approved API-standard sample report.

➢ To preserve Android field-capture data as the factual baseline while allowing final report presentation, layout maps, and recommendation wording to be reviewed and approved on the report platform.

➢ To list missing report-side values for user confirmation before final issue.

Report Reference: ${manualInputs.reportReference ?? exportPackage.inspectionReference}.`;
}

function composeMaintenanceRegimeSection({ exportPackage }) {
  return `2       INSPECTION AND MAINTENANCE REGIME

See API 653 Appendix C "Check List for Tank Inspection".

Both API 653 and EEMUA 159 provide a detailed list of items for inspection. Factors related to the integrity of the tank bottom, shell and roof thickness are reviewed against inspection intervals and maintenance responsibilities.

The Client should define responsibilities for inspection activities carried out by plant operations personnel, maintenance staff, mechanical contractors and the Authorized Inspector.

This standard report-family section remains applicable to ${exportPackage.task.client}, Tank ${exportPackage.task.tankNumber}, as a vertical aboveground storage tank.`;
}

function composeGeneralInfoSection({ exportPackage, manualInputs }) {
  const record = exportPackage.inspectionRecord;
  const shellConfig = exportPackage.layoutConfigs.find((config) => config.targetKey === "shell");
  const roofConfig = exportPackage.layoutConfigs.find((config) => config.targetKey === "external_roof");
  const floorConfig = exportPackage.layoutConfigs.find((config) => config.targetKey === "floor");
  const measurementCounts = buildMeasurementCounts(exportPackage);

  return `3       GENERAL TANK INFORMATION

Client: ${record.client}
Tank Number: ${record.tankNumber}
Tank Type: Vertical aboveground storage tank
Inspection Reference: ${exportPackage.inspectionReference}
Report Reference: ${manualInputs.reportReference ?? exportPackage.inspectionReference}
Location: ${record.location}
Field / Lease Name: ${record.fieldLeaseName}
Inspector: ${record.inspector}
Client Representative: ${formatPending(manualInputs.clientRepresentative)}
Year Built: ${formatPending(manualInputs.yearBuilt)}
Roof Type: ${humanizeKey(record.externalRoofType ?? "not_recorded")}
Reference Mode: ${humanizeKey(record.referenceMode ?? "not_recorded")}
Diameter / Height: ${formatMetric(record.diameterM)} / ${formatMetric(record.heightM)}
Shell Course Count: ${record.shellCourseCount ?? "Not recorded"}
Shell Plates Per Course: ${shellConfig?.shellPlatesPerCourse ?? "Not recorded"}
Roof Plate UT Rows: ${measurementCounts["external_roof|region"] ?? 0}
Roof Nozzle/Appurtenance UT Rows: ${measurementCounts["external_roof|element"] ?? 0}
Shell Plate UT Rows: ${measurementCounts["shell|region"] ?? 0}
Shell Nozzle UT Rows: ${measurementCounts["shell|element"] ?? 0}
Floor Plate Count / UT Rows: ${floorConfig?.floorPlateCount ?? "Not recorded"} / ${measurementCounts["floor|region"] ?? 0}
Roof Layout Rows / Widest Plate Row: ${roofConfig?.roofRowCount ?? "Not recorded"} / ${roofConfig?.roofWidestRowPlateCount ?? "Not recorded"}

This section remains a structured fact page so the report issue can stay aligned with the Android handoff and the sample report family.`;
}

function composeInspectionReportSection({ exportPackage, manualInputs }) {
  const voiceNotes = exportPackage.voiceNarratives ?? [];
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
    "4       INSPECTION REPORT",
    "",
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
    `➢ ${formatSentenceValue(manualInputs.engineeringImplication)}.`,
    "",
    "Note: Voice-transcript notes are drafting evidence only. Final wording, photo numbering, repair assessment, and API 653 acceptability remain subject to inspector/reviewer approval.",
  ].join("\n");
}

function buildInspectionSubsection(title, bullets) {
  const cleanBullets = bullets.filter((line) => String(line ?? "").trim().length > 0);
  return [
    title,
    "",
    ...(cleanBullets.length > 0 ? cleanBullets : ["➢ Pending confirmation from inspector narrative input."]),
  ].join("\n");
}

function buildVoiceBullets(notes, sectionKey) {
  return notes
    .filter((note) => note.sectionKey === sectionKey)
    .map((note) => `➢ ${note.transcriptText}`);
}

function buildChecklistNoteBullets(exportPackage, sectionKey) {
  return exportPackage.inspectionChecklistSectionNotes
    .filter((note) => note.sectionKey === sectionKey)
    .map((note) => `➢ Checklist note: ${note.note}`);
}

function countElementsByType(exportPackage, targetKey, elementTypeKey) {
  return exportPackage.elements.filter(
    (element) => element.targetKey === targetKey && element.elementTypeKey === elementTypeKey,
  ).length;
}

function formatMeasurementRangeSentence(measurements) {
  const values = measurements.flatMap((measurement) => getMeasurementValuesIncludingReinforcement(measurement));

  if (values.length === 0) {
    return "Measurement range is pending confirmation.";
  }

  return `Recorded values range from ${Math.min(...values).toFixed(2)} mm to ${Math.max(...values).toFixed(2)} mm.`;
}

function composeRecommendationSection({ calculations, manualInputs }) {
  const findingSummary = findOutput(calculations, "finding_summary");
  const attachmentSummary = findOutput(calculations, "attachment_summary");
  const utSummary = findOutput(calculations, "shell_ut_summary");

  return `5       REPAIR RECOMMENDATIONS / API 653 ASSESSMENT

OFF-LINE

➢ Confirm repair scope for the imported shell finding locations at ${joinWords(findingSummary.labels)} before report issue.

➢ Use the imported evidence package of ${attachmentSummary.photoCount} photo attachment${attachmentSummary.photoCount === 1 ? "" : "s"} and ${attachmentSummary.documentCount} document attachment${attachmentSummary.documentCount === 1 ? "" : "s"} as the support set for repair planning.

➢ Hold final acceptability wording until the engineering implication paragraph and reviewer approval are complete.

ON-LINE

➢ Recommendation coordination owner: ${formatPending(manualInputs.recommendationOwner)}.

➢ Current shell UT evidence spans ${formatNumber(utSummary.minValueMm)} mm to ${formatNumber(utSummary.maxValueMm)} mm and should remain referenced directly from the imported worksheet values.

This section is intentionally report-side: the Android export supplies the factual basis, while the final recommendation wording remains under controlled cloud review.`;
}

function composeTankInspectionChecklistSection({ exportPackage }) {
  return buildChecklistTableHtml(exportPackage);
}

function buildChecklistTableHtml(exportPackage) {
  const ratingColumns = ["1", "2", "3", "4", "IA", "NE", "N/A"];
  const groupedItems = new Map();

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
              const selected =
                item.ratingKey === rating ||
                item.ratingLabel === rating ||
                mapRatingLabelToCode(item.ratingLabel) === rating;
              return `<td class="checklist-response-cell">${selected ? "●" : ""}</td>`;
            })
            .join("");

          return `<tr><td class="checklist-item-number">${escapeHtml(item.itemNumber)}</td><td>${escapeHtml(
            item.itemPrompt,
          )}</td>${responseCells}</tr>`;
        })
        .join("");

      return [
        `<tr class="checklist-section-row"><th colspan="${ratingColumns.length + 2}">${escapeHtml(
          String(sectionTitle).toUpperCase(),
        )}</th></tr>`,
        `<tr><th>No.</th><th>Inspection Item</th>${ratingColumns
          .map((rating) => `<th>${escapeHtml(rating)}</th>`)
          .join("")}</tr>`,
        rows,
      ].join("");
    })
    .join("");

  return [
    "<h3>7 TANK INSPECTION CHECKLIST</h3>",
    "<p>Checklist responses are imported from the Android V2 Product export. The response grid follows the sample report columns and should remain editable before final issue.</p>",
    `<div class="report-table-wrap"><table class="report-measurement-table checklist-report-table"><tbody>${groups}</tbody></table></div>`,
    "<p><em>Legend: 1 Good Condition; 2 Satisfactory Condition; 3 Requires Repair/Action; 4 Poor, Requires Immediate Attention; IA In-accessible; NE None Evident; N/A Not applicable.</em></p>",
  ].join("");
}

function mapRatingLabelToCode(value) {
  if (!value) return null;
  const normalized = String(value).toLowerCase();
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

function composePhotographsSection({ calculations }) {
  const attachmentSummary = findOutput(calculations, "attachment_summary");

  return `6       PHOTOGRAPHS

This section is reserved for selected report photographs and captions.

Imported photo evidence count: ${attachmentSummary.photoCount}

${attachmentSummary.names.length > 0 ? attachmentSummary.names.map((name, index) => `Photo ${index + 1}: ${name}`).join("\n") : "No photo attachments were imported in this package."}

Final photo ordering, caption formatting, and page layout belong to the report platform.`;
}

function composeMapSection({ exportPackage, mapArtifacts, manualInputs }) {
  const mapArtifact = mapArtifacts[0] ?? {
    gridRows: 0,
    gridColumns: 0,
    referenceMode: "Pending confirmation",
    findingLabels: [],
    elementLabels: [],
    markerCount: 0,
    overrideCount: 0,
  };

  return `${mapArtifact.sectionTitle ?? "FINDINGS / MPI LOCATIONS ON SHELL"}

This sketch page is anchored to imported vertical tank ${mapArtifact.surfaceLabel ?? "layout"} metadata. The effective baseline uses ${mapArtifact.gridRows} rows by ${mapArtifact.gridColumns} columns with ${mapArtifact.referenceMode} as the drawing reference.

- Imported finding markers: ${joinWords(mapArtifact.findingLabels)}
- Imported ${mapArtifact.surfaceLabel ?? "layout"} elements: ${joinWords(mapArtifact.elementLabels)}
- Effective imported marker count on the sketch: ${mapArtifact.markerCount}
- Report-side override count: ${mapArtifact.overrideCount}
- Checked by: ${formatPending(manualInputs.checkedBy)}
- Legend note: ${formatPending(manualInputs.legendNote)}

Geometry and layout metadata remain sourced from the field package for Tank ${exportPackage.task.tankNumber}. The report platform keeps Android map geometry locked until parity review is approved; report-side work is limited to captions, legend notes, and checker metadata.`;
}

function composeAttachmentSection({ calculations, manualInputs }) {
  const attachmentSummary = findOutput(calculations, "attachment_summary");
  const findingSummary = findOutput(calculations, "finding_summary");

  return `ATTACHMENT - MAGNETIC PARTICLE INSPECTION REPORT

Imported evidence package:
- ${attachmentSummary.names.join("\n- ")}

Linked shell finding locations: ${joinWords(findingSummary.labels)}.
Imported attachment counts: ${attachmentSummary.photoCount} photo attachment${attachmentSummary.photoCount === 1 ? "" : "s"} and ${attachmentSummary.documentCount} document attachment${attachmentSummary.documentCount === 1 ? "" : "s"}.
Certification / qualification reference: ${formatPending(manualInputs.certificationNumber)}.

Use this page family for the controlled NDT form layout, supporting photo issue pages, and final sign-off metadata that remains report-side.`;
}

function composeAttachmentPhotographsSection({ calculations }) {
  const attachmentSummary = findOutput(calculations, "attachment_summary");

  return `ATTACHMENT - MAGNETIC PARTICLES INSPECTION PHOTOGRAPHS

This attachment section is reserved for MPI supporting photographs after the structured MPI report forms.

Imported evidence count: ${attachmentSummary.totalCount}

Final image placement and captions should follow the approved sample report attachment format.`;
}

function composeStandardTocSection({ sectionId, exportPackage, calculations, mapArtifacts, manualInputs }) {
  const tocSection = getApiStandardTocSection(sectionId);
  const title = tocSection?.title ?? humanizeKey(sectionId);
  const number = tocSection?.number ?? "";
  const attachmentSummary = findOutput(calculations, "attachment_summary");
  const findingSummary = findOutput(calculations, "finding_summary");
  const shellUtSummary = findOutput(calculations, "shell_ut_summary");
  const measurementScope = getMeasurementTableScope(sectionId);

  if (measurementScope) {
    const rows = getSectionMeasurementRows(exportPackage, measurementScope);

    if (rows.length > 0) {
      return buildMeasurementTableHtml({
        sectionTitle: title,
        sectionNumber: number,
        rows,
        measurementScope,
        exportPackage,
        includeStats: false,
      });
    }

    return `${number}       ${title.toUpperCase()}

No matching Android V2 Product UT measurement rows were found for this section.

Do not invent measurement values. Keep this section pending until the app export, worksheet import, or inspector confirmation supplies the required table rows.`;
  }

  if (tocSection?.kind === "map") {
    const mapArtifact = mapArtifacts[0];
    if (mapArtifact) {
      return `${number}       ${title.toUpperCase()}

This API-standard layout section is generated from the imported ${mapArtifact.surfaceLabel ?? "layout"} baseline. The effective workspace uses ${mapArtifact.gridRows} rows by ${mapArtifact.gridColumns} columns with ${mapArtifact.referenceMode} as the reference.

- Imported finding markers: ${joinWords(mapArtifact.findingLabels)}
- Imported ${mapArtifact.surfaceLabel ?? "layout"} elements: ${joinWords(mapArtifact.elementLabels)}
- Effective marker count: ${mapArtifact.markerCount}
- Report-side override count: ${mapArtifact.overrideCount}
- Checked by: ${formatPending(manualInputs.checkedBy)}
- Legend note: ${formatPending(manualInputs.legendNote)}

The final map remains editable on the report platform while preserving the Android export as the source-of-truth baseline.`;
    }

    return `${number}       ${title.toUpperCase()}

This API-standard layout section is present in ${API_STANDARD_PRIMARY_REPORT.reference}, but the current Android export does not yet include structured ${tocSection.layoutSurface ?? "surface"} geometry for this page.

Do not invent plate dimensions, MFL platemaps, roof layout, floor corrosion maps, or settlement graphics. Keep this section in review until approved source data is imported or entered through a controlled report-side workflow.

Current imported context:
- Client: ${exportPackage.task.client}
- Tank: ${exportPackage.task.tankNumber}
- Imported findings: ${findingSummary.findingCount}
- Imported attachments: ${attachmentSummary.totalCount}`;
  }

  return `${number}       ${title.toUpperCase()}

This section follows the API-standard sample report ToC from ${API_STANDARD_PRIMARY_REPORT.reference}.

Current imported baseline:
- Client: ${exportPackage.task.client}
- Tank: ${exportPackage.task.tankNumber}
- Inspection reference: ${exportPackage.inspectionReference}
- Imported shell finding count: ${findingSummary.findingCount}
- Imported shell UT row count: ${shellUtSummary.rowCount}
- Imported attachment count: ${attachmentSummary.totalCount}

Complete the section using approved report-side inputs, calculations, worksheets, or future Android export fields that correspond to this exact section. Any missing value should remain marked as Pending confirmation until reviewed.`;
}

function validateGeneratedSection(sectionId, content) {
  const warnings = [];
  const blockers = [];

  if (!content.trim()) {
    blockers.push("Generated content was empty.");
  }

  if (content.includes("undefined") || content.includes("NaN")) {
    blockers.push("Generated content contains unresolved placeholders or invalid numeric output.");
  }

  if (sectionId === "repair-recommendations" && !content.includes("➢") && !content.includes("- ")) {
    warnings.push("Recommendation output should stay in bullet or arrow-bullet form for the sample report family.");
  }

  if (MAP_SECTION_IDS.has(sectionId) && !content.toLowerCase().includes("android")) {
    warnings.push("Map-page output should confirm that geometry is sourced from the Android export.");
  }

  return { warnings, blockers };
}

function findOutput(outputs, key) {
  const output = outputs.find((item) => item.key === key);
  if (!output) {
    throw new Error(`Missing calculation output: ${key}`);
  }
  return output;
}

function getMeasurementValues(measurement) {
  return [
    measurement.value1,
    measurement.value2,
    measurement.value3,
    measurement.value4,
    measurement.value5,
  ].filter((value) => typeof value === "number");
}

function getMeasurementValuesIncludingReinforcement(measurement) {
  return [
    measurement.value1,
    measurement.value2,
    measurement.value3,
    measurement.value4,
    measurement.value5,
    measurement.reinforcementPadReading,
  ].filter((value) => typeof value === "number");
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function dedupe(values) {
  return [...new Set(values)];
}

function formatPending(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || "Pending confirmation";
}

function formatSentenceValue(value) {
  const normalized = formatPending(value);
  return normalized.replace(/[.]+$/, "");
}

function formatNumber(value) {
  return typeof value === "number" ? value.toFixed(1) : "Not recorded";
}

function formatMetric(value) {
  return value == null ? "Not recorded" : `${value.toFixed(3)} m`;
}

function formatDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function humanizeKey(value) {
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function joinWords(values) {
  const filtered = values.filter(Boolean);
  if (filtered.length === 0) return "no imported labels";
  if (filtered.length === 1) return filtered[0];
  if (filtered.length === 2) return `${filtered[0]} and ${filtered[1]}`;
  return `${filtered.slice(0, -1).join(", ")}, and ${filtered[filtered.length - 1]}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
