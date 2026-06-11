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

const MANUAL_FIELD_LABELS = {
  coverHeroImage: "Cover hero image",
  clientRepresentative: "Client representative",
  yearBuilt: "Year built",
  engineeringImplication: "Engineering implication paragraph",
  recommendationOwner: "Recommendation owner",
  checkedBy: "Checked by",
  legendNote: "Legend note",
  certificationNumber: "Certification number",
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
  const aiResult = await tryGenerateSectionWithCodexCli(context);
  const selected = aiResult ?? fallback;
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
}) {
  const context = buildSectionContext({ reportState, sectionId, userInstruction: "" });
  const fallback = buildDeterministicAssistantReply(context, userPrompt);
  const aiStatus = getAiStatus();
  const createdAtIso = new Date().toISOString();

  if (!aiStatus.configured) {
    return {
      replyId: randomUUID(),
      sectionId,
      content: fallback.reply,
      providerCode: "deterministic",
      modelId: null,
      usedLiveModel: false,
      fallbackReason: "Codex CLI is not available for the report-platform worker.",
      createdAtIso,
      actions: fallback.actions,
    };
  }

  try {
    const response = await runStructuredCodexJob({
      prompt: buildAssistantChatPrompt(context, userPrompt),
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
      fallbackReason: error instanceof Error ? error.message : "Codex CLI chat request failed.",
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
      "Generated by the deterministic report-platform fallback engine because a live Codex CLI response was not available.",
    reviewRequired: context.warnings.length > 0 || context.blockers.length > 0,
    detectedIssues: [],
    providerCode: "deterministic",
    modelId: null,
    usedLiveModel: false,
    fallbackReason: "Codex CLI is not available for the report-platform worker.",
  };
}

function getSectionTemplate(sectionId) {
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

  return {
    templateKey: `api653-standard.${sectionId}.v1`,
    title,
    kind,
    templateExpectation:
      tocSection?.kind === "map"
        ? "API-standard drawing or map page with controlled source-data status and editable override layer where geometry exists."
        : "API-standard report section matching the primary sample report ToC, heading style, and table/page-block conventions.",
    requiredManualFields: [],
    compose: composeStandardTocSection,
  };
}

async function tryGenerateSectionWithCodexCli(context) {
  const aiStatus = getAiStatus();
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
      summary: String(parsed.summary ?? "").trim() || "Generated through the Codex CLI worker.",
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
      fallbackReason: error instanceof Error ? error.message : "Codex CLI section generation failed.",
      summary:
        "The live Codex CLI worker failed, so the report-platform fallback engine produced this section draft instead.",
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
For map pages, never alter geometry facts or pretend to move markers; describe only the report-side sketch and override layer.

Return JSON matching the provided schema with:
- content
- summary
- reviewRequired
- detectedIssues

Section generation context:
${JSON.stringify(promptContext, null, 2)}
`;
}

function buildAssistantChatPrompt(context, userPrompt) {
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
    reportClassification: context.reportClassification,
    importedFacts: buildImportedFactsSummary(context.exportPackage),
  };

  return `You are the LAIQ section-aware report assistant.

Answer briefly and practically.
Stay anchored to the supplied section context only.
Do not invent missing facts.
If the user asks whether a section is ready to approve, check whether report-side inputs are still missing.
If the user asks about layout maps, explain the override workflow and remind them that geometry stays anchored to the imported Android baseline.
If the user explicitly asks to change report text, formatting, or layout, return safe structured actions in addition to your reply.
Only use action ids that exist in the provided editableActions context.
For replace_section_content, return compact HTML that uses only h3, p, ul, li, strong, em, u, and div tags.
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

function buildDeterministicAssistantReply(context, prompt) {
  const query = prompt.toLowerCase();
  const missingCount = context.template.requiredManualFields.filter(
    (fieldKey) => !String(context.manualInputs[fieldKey] ?? "").trim(),
  ).length;
  const actions = [];

  if (query.includes("shorter") || query.includes("summar")) {
    return {
      reply: `For ${context.template.title}, I would shorten the draft by keeping the main finding statements and moving supporting detail into bullets or tables. There are currently ${missingCount} missing field${missingCount === 1 ? "" : "s"} still blocking approval.`,
      actions,
    };
  }

  if (query.includes("approve") || query.includes("ready")) {
    return {
      reply:
        missingCount === 0
          ? `${context.template.title} can move toward approval once you confirm the current wording. I do not see any missing-content blockers in the current report-side inputs.`
          : `${context.template.title} is not approval-ready yet. Complete the missing-content panel first, then re-run generation or approval.`,
      actions,
    };
  }

  if (query.includes("map") || query.includes("marker") || query.includes("layout")) {
    maybePushMapAction(actions, context, query);
    return {
      reply:
        context.mapArtifacts.length > 0
          ? "This section uses the imported shell sketch workspace. I can help rewrite the legend or propose controlled marker or plate adjustments while the Android baseline geometry remains intact."
          : "This section does not have a layout map. The lower workspace can stay collapsed or be reused for supporting tables or form-style blocks.",
      actions,
    };
  }

  if (query.includes("missing") || query.includes("field")) {
    return {
      reply:
        missingCount === 0
          ? `The current section does not have any empty required report-side inputs.`
          : `The missing-content assistant has ${missingCount} open item${missingCount === 1 ? "" : "s"} for ${context.template.title}. Start with the highest-signal field shown at the top of the right-hand panel.`,
      actions,
    };
  }

  maybePushTextStyleAction(actions, query);

  return {
    reply: `I am focused on ${context.template.title}. Based on the current draft, the next best move is to complete the section-specific missing fields and then refine the wording so it matches the expected format: ${context.template.templateExpectation.toLowerCase()}`,
    actions,
  };
}

function buildEditableActionContext(context) {
  const shellFindings = context.exportPackage.findings
    .filter((finding) => finding.targetKey === "shell")
    .map((finding) => ({
      id: finding.findingId,
      label: finding.itemLabel,
      type: "finding",
    }));
  const shellElements = context.exportPackage.elements
    .filter((element) => element.targetKey === "shell")
    .map((element) => ({
      id: element.elementId,
      label: element.elementLabel,
      type: "element",
    }));
  const mapArtifact = context.mapArtifacts[0];
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
    allowedMapMarkers: [...shellFindings, ...shellElements],
    allowedMapPlates: plateIds.slice(0, 120),
  };
}

function maybePushTextStyleAction(actions, query) {
  if (!query.includes("center") && !query.includes("font") && !query.includes("color")) {
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
    fontSize: query.includes("larger") || query.includes("bigger") ? "18px" : "16px",
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
  return {
    inspectionReference: exportPackage.inspectionReference,
    client: exportPackage.task.client,
    tankNumber: exportPackage.task.tankNumber,
    tankType: "Vertical aboveground storage tank",
    location: exportPackage.inspectionRecord.location,
    findingCount: exportPackage.findings.length,
    attachmentCount: exportPackage.attachments.length,
    measurementCount: exportPackage.utMeasurements.length,
    workflowScreen: exportPackage.workflowScreen,
    tenantName: exportPackage.profile.tenantName,
    workspaceName: exportPackage.profile.workspaceName,
    reportFamily: reportClassification.reportFamilyLabel,
    primaryCodes: reportClassification.primaryCodes.map((code) => code.label),
    supportingCodes: reportClassification.supportingCodes.map((code) => code.label),
  };
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
  const photoCount = attachments.filter((attachment) => attachment.kind === "photo").length;
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

function buildMapArtifacts(sectionId, exportPackage, manualInputs, layoutOverrides) {
  if (!SHELL_MAP_SECTION_IDS.has(sectionId)) {
    return [];
  }

  const shellConfig = exportPackage.layoutConfigs.find((config) => config.targetKey === "shell");
  if (!shellConfig) {
    return [];
  }

  const shellFindings = exportPackage.findings.filter((finding) => finding.targetKey === "shell");
  const shellElements = exportPackage.elements.filter((element) => element.targetKey === "shell");
  const layoutOverride = layoutOverrides.find((item) => item.sectionId === sectionId)?.layoutMap ?? null;

  return [
    {
      key: "shell_layout_effective",
      sectionTitle: getSectionTemplate(sectionId).title,
      gridRows: shellConfig.shellCourseCount ?? exportPackage.inspectionRecord.shellCourseCount ?? 0,
      gridColumns:
        shellConfig.shellPlatesPerCourse ?? exportPackage.inspectionRecord.shellLaneCount ?? 0,
      referenceMode: humanizeKey(
        shellConfig.referenceMode ?? exportPackage.inspectionRecord.referenceMode ?? "tank_north",
      ),
      findingLabels: shellFindings.map((finding) => finding.itemLabel),
      elementLabels: shellElements.map((element) => element.elementLabel),
      overrideCount: Number(layoutOverride?.overrideCount ?? 0),
      markerCount: Number(layoutOverride?.markers?.length ?? shellFindings.length + shellElements.length),
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

  if (SHELL_MAP_SECTION_IDS.has(sectionId) && mapArtifacts[0]?.overrideCount > 0) {
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

  if (SHELL_MAP_SECTION_IDS.has(sectionId) && mapArtifacts.length === 0) {
    blockers.push("Shell layout metadata is missing, so the weld sketch page cannot be generated safely.");
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

This section remains a structured fact page so the report issue can stay aligned with the Android handoff and the sample report family.`;
}

function composeInspectionReportSection({ calculations, manualInputs }) {
  const findingSummary = findOutput(calculations, "finding_summary");
  const utSummary = findOutput(calculations, "shell_ut_summary");
  const checklistSummary = findOutput(calculations, "checklist_summary");
  const attachmentSummary = findOutput(calculations, "attachment_summary");
  const measurementBullets =
    utSummary.bandSummaries.length > 0
      ? utSummary.bandSummaries
          .slice(0, 5)
          .map(
            (summary) =>
              `- ${summary.itemLabel}: imported UT band ${formatNumber(summary.minValueMm)} mm to ${formatNumber(summary.maxValueMm)} mm.`,
          )
          .join("\n")
      : "- No measured shell UT rows were imported for this package.";
  const checklistParagraph =
    checklistSummary.notes.length > 0
      ? checklistSummary.notes.map((note) => `${note.sectionTitle}: ${note.note}`).join(" ")
      : "No checklist section notes were exported for this inspection package.";

  return `4       INSPECTION REPORT

INTERNAL & EXTERNAL

The API-standard report workspace reviews the vertical aboveground storage tank as an internal and external inspection package. The imported Android handoff currently records ${findingSummary.findingCount} reportable shell finding locations at ${joinWords(findingSummary.labels)} with ${attachmentSummary.photoCount} supporting photo attachment${attachmentSummary.photoCount === 1 ? "" : "s"} and ${attachmentSummary.documentCount} supporting document attachment${attachmentSummary.documentCount === 1 ? "" : "s"}.

${measurementBullets}

- Overall imported shell UT range: ${formatNumber(utSummary.minValueMm)} mm to ${formatNumber(utSummary.maxValueMm)} mm across ${utSummary.rowCount} measured location${utSummary.rowCount === 1 ? "" : "s"}.

Finding notes imported from the field package must be carried through into the relevant shell, NDT, repair, and photograph sections without altering the baseline field evidence.

${checklistParagraph}

Engineering implication: ${formatSentenceValue(manualInputs.engineeringImplication)}.`;
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

This sketch page is anchored to imported vertical tank shell layout metadata. The effective shell baseline uses ${mapArtifact.gridRows} courses by ${mapArtifact.gridColumns} plates with ${mapArtifact.referenceMode} as the drawing reference.

- Imported finding markers: ${joinWords(mapArtifact.findingLabels)}
- Imported shell elements: ${joinWords(mapArtifact.elementLabels)}
- Effective marker count on the editable sketch: ${mapArtifact.markerCount}
- Report-side override count: ${mapArtifact.overrideCount}
- Checked by: ${formatPending(manualInputs.checkedBy)}
- Legend note: ${formatPending(manualInputs.legendNote)}

Geometry and layout metadata remain sourced from the field package for Tank ${exportPackage.task.tankNumber}. User edits on the report platform adjust only the override layer that controls final report presentation.`;
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

  if (tocSection?.kind === "map") {
    const mapArtifact = mapArtifacts[0];
    if (mapArtifact) {
      return `${number}       ${title.toUpperCase()}

This API-standard layout section is generated from the imported shell layout baseline. The effective shell workspace uses ${mapArtifact.gridRows} courses by ${mapArtifact.gridColumns} plates with ${mapArtifact.referenceMode} as the reference.

- Imported finding markers: ${joinWords(mapArtifact.findingLabels)}
- Imported shell elements: ${joinWords(mapArtifact.elementLabels)}
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

  if (SHELL_MAP_SECTION_IDS.has(sectionId) && !content.toLowerCase().includes("override")) {
    warnings.push("Map-page output should confirm that edits are applied through the override layer.");
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
