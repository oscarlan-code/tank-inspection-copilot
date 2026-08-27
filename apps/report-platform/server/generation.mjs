import { createHash, randomUUID } from "node:crypto";
import {
  getAiStatus,
  getTargetedEditWorkerOptions,
  runStructuredCodexJob,
} from "./codex-cli.mjs";
import {
  buildFlatRetrievalContext,
  searchPrecedentPack,
} from "./precedent-kb.mjs";
import {
  buildFlatFactRecommendationContext,
  searchFactRecommendationPairs,
} from "./fact-recommendation-kb.mjs";
import {
  API_STANDARD_MAP_SECTION_IDS,
  API_STANDARD_PRIMARY_REPORT,
  API_STANDARD_SHELL_MAP_SECTION_IDS,
  getApiStandardTocSection,
} from "./report-toc.mjs";
import { classifyReportPackage } from "./report-classification.mjs";
import { buildStandardRuleChecks } from "./standard-rules.mjs";
import {
  buildReportBlockManifest,
  findReportBlock,
  replaceReportBlockContent,
  stripHtml,
} from "./report-blocks.mjs";

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
          fontWeight: { type: ["string", "null"], enum: ["normal", "bold", null] },
          textAlign: { type: ["string", "null"], enum: ["left", "center", null] },
          color: { type: ["string", "null"] },
          styleScope: { type: ["string", "null"], enum: ["section", "table", "block", null] },
          targetBlockId: { type: ["string", "null"] },
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
          "fontWeight",
          "textAlign",
          "color",
          "styleScope",
          "targetBlockId",
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

const CONTENT_TRANSFORM_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: { type: "string" },
    operations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          op: {
            type: "string",
            enum: [
              "replace_text",
              "replace_block_content",
              "set_checklist_marker",
              "replace_section_content",
              "apply_text_style",
            ],
          },
          targetBlockId: { type: ["string", "null"] },
          reason: { type: "string" },
          findText: { type: ["string", "null"] },
          replaceWith: { type: ["string", "null"] },
          replaceAll: { type: ["boolean", "null"] },
          marker: { type: ["string", "null"] },
          markerLabel: { type: ["string", "null"] },
          contentHtml: { type: ["string", "null"] },
          fontFamily: { type: ["string", "null"] },
          fontSize: { type: ["string", "null"] },
          fontWeight: { type: ["string", "null"], enum: ["normal", "bold", null] },
          textAlign: { type: ["string", "null"], enum: ["left", "center", null] },
          color: { type: ["string", "null"] },
          styleScope: { type: ["string", "null"], enum: ["section", "table", "block", null] },
        },
        required: [
          "op",
          "targetBlockId",
          "reason",
          "findText",
          "replaceWith",
          "replaceAll",
          "marker",
          "markerLabel",
          "contentHtml",
          "fontFamily",
          "fontSize",
          "fontWeight",
          "textAlign",
          "color",
          "styleScope",
        ],
      },
    },
  },
  required: ["reply", "operations"],
};

const TARGETED_EDIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    replacementHtml: { type: "string" },
    explanation: { type: "string" },
    factsChanged: { type: "boolean" },
    instructionSatisfied: { type: "boolean" },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "replacementHtml",
    "explanation",
    "factsChanged",
    "instructionSatisfied",
    "warnings",
  ],
};

const TARGETED_EDIT_ACTIONS = new Set([
  "rephrase",
  "shorten",
  "enhance",
  "to_points",
  "to_paragraph",
  "custom",
]);

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

export async function generateSectionDraft({
  reportState,
  sectionId,
  userInstruction = "",
  policyDecision = null,
}) {
  const context = buildSectionContext({ reportState, sectionId, userInstruction, policyDecision });
  const fallback = buildDeterministicSectionDraft(context);
  const isMeasurementCompilerSection = Boolean(getMeasurementTableScope(sectionId));
  const isMapCompilerSection = MAP_SECTION_IDS.has(sectionId);
  const shouldUsePolicyDeterministicRoute =
    context.policyConfiguration.agentRoute === "deterministic_first"
    && context.template.kind === "structured";
  const shouldUseDeterministicCompiler =
    isMeasurementCompilerSection || isMapCompilerSection || shouldUsePolicyDeterministicRoute;
  const aiResult = shouldUseDeterministicCompiler ? null : await tryGenerateSectionWithCodexCli(context);
  const selected = shouldUseDeterministicCompiler
    ? {
        ...fallback,
        summary: isMeasurementCompilerSection
          ? "Generated by the deterministic measurement-table compiler from LAIQ inspection app V3 exported UT rows."
          : isMapCompilerSection
            ? "Generated by the deterministic layout-map compiler from LAIQ inspection app V3 exported geometry."
            : "Generated by the policy-selected deterministic structured-section compiler.",
        fallbackReason: isMeasurementCompilerSection
          ? "App-sourced measurement sections are compiled deterministically to prevent invented or stale pending values."
          : isMapCompilerSection
            ? "App-sourced map sections are compiled deterministically to preserve LAIQ inspection app layout geometry."
            : "The selected system RL policy routes structured sections through deterministic compilation.",
    }
    : aiResult ?? fallback;
  const predictedContent = shouldHighlightPredictedContent({
    context,
    isMapCompilerSection,
    isMeasurementCompilerSection,
  })
    ? markPredictedContent(selected.content, context)
    : selected.content;
  const content = prependProtectedCaptureBlock(predictedContent, context);
  const qa = validateGeneratedSection(sectionId, content);
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
    factRecommendationKeys: context.factRecommendationContext.map((item) => item.key),
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
    policyDecisionId: policyDecision?.decisionId ?? null,
    policyVersionId: policyDecision?.policyVersionId ?? null,
    policyArmKey: policyDecision?.armKey ?? null,
  };

  return {
    draft: {
      content,
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
      factRecommendationContext: context.factRecommendationContext,
      retrievalFirewallAudit: {
        precedent: context.precedentPack?.retrievalFirewall ?? null,
        factRecommendations: context.factRecommendationPack?.retrievalFirewall ?? null,
        selectedPrecedentSources: (context.precedentPack?.wordingPrecedents ?? []).map((item) => item.sourceReportName),
        selectedFactRecommendationSources: (context.factRecommendationPack?.pairs ?? []).map((item) => item.sourceReportName),
      },
      calculationOutputs: context.calculations,
      mapArtifacts: context.mapArtifacts,
      standardRuleChecks: context.standardRuleChecks,
      evidenceChain,
      reportClassification: context.reportClassification,
      systemRlPolicy: buildGenerationPolicyAudit(policyDecision, context.policyConfiguration),
      sourceRevision: reportState.reportJob?.sourceRevision ?? null,
      generatorContractVersion: 1,
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

  const contentTransformReply = await buildContentTransformReply({
    context,
    userPrompt,
    normalizedPrompt,
    conversationHistory: normalizedHistory,
    aiStatus,
  });
  if (contentTransformReply) {
    return {
      replyId: randomUUID(),
      sectionId,
      content: contentTransformReply.reply,
      providerCode: contentTransformReply.providerCode,
      modelId: contentTransformReply.modelId,
      usedLiveModel: contentTransformReply.usedLiveModel,
      fallbackReason: contentTransformReply.fallbackReason,
      createdAtIso,
      actions: contentTransformReply.actions,
      controlTrace: contentTransformReply.controlTrace,
      pendingConfirmation: contentTransformReply.pendingConfirmation,
    };
  }

  const checklistTableFormatReply = buildChecklistTableFormatReply(context, normalizedPrompt, normalizedHistory);
  if (checklistTableFormatReply) {
    return {
      replyId: randomUUID(),
      sectionId,
      content: checklistTableFormatReply.reply,
      providerCode: "deterministic_table_formatter",
      modelId: null,
      usedLiveModel: false,
      fallbackReason: "Checklist table column-width formatting is handled by the report-platform table formatter.",
      createdAtIso,
      actions: checklistTableFormatReply.actions,
      controlTrace: buildControlTrace({
        context,
        intent: userPrompt,
        planner: "deterministic_tool",
        risk: "low",
        operation: "checklist.tableFormatter",
        status: "applied",
        reason: "Checklist table geometry matched a controlled formatter.",
        validation: ["Checklist rows were rebuilt from app export data.", "Undo snapshot is captured before the UI applies the action."],
      }),
    };
  }

  const checklistMarkerFormatReply = buildChecklistMarkerFormatReply(context, normalizedPrompt, normalizedHistory);
  if (checklistMarkerFormatReply) {
    return {
      replyId: randomUUID(),
      sectionId,
      content: checklistMarkerFormatReply.reply,
      providerCode: "deterministic_table_formatter",
      modelId: null,
      usedLiveModel: false,
      fallbackReason: "Checklist marker formatting is handled by the report-platform table formatter.",
      createdAtIso,
      actions: checklistMarkerFormatReply.actions,
      controlTrace: buildControlTrace({
        context,
        intent: userPrompt,
        planner: "deterministic_tool",
        risk: "low",
        operation: "checklist.setMarker",
        status: "applied",
        reason: "Checklist marker change matched a controlled formatter.",
        validation: ["Only the visible response marker is changed.", "Checklist item names and selected responses stay sourced from app export."],
      }),
    };
  }

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
      controlTrace: buildControlTrace({
        context,
        intent: userPrompt,
        planner: "clarification_guard",
        risk: "blocked",
        operation: "none",
        status: "clarification",
        reason: "The request was too ambiguous to safely run a tool.",
        validation: ["No report content was changed."],
        userConfirmationRequired: true,
        undoSnapshot: false,
        alternative: "Ask for a specific wording, table, formatting, or layout-map change.",
      }),
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
      controlTrace: buildControlTrace({
        context,
        intent: userPrompt,
        planner: "deterministic_tool",
        risk: "low",
        operation: "measurement.tableFormatter",
        status: "applied",
        reason: "Measurement table request matched a deterministic app-data formatter.",
        validation: ["UT readings are compiled from app export rows.", "No measurement value is inferred by AI."],
      }),
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
      fallbackReason: "Measurement evidence questions are grounded directly against LAIQ inspection app V3 exported UT rows.",
      createdAtIso,
      actions: measurementEvidenceReply.actions,
      controlTrace: buildControlTrace({
        context,
        intent: userPrompt,
        planner: "helpdesk_guard",
        risk: "low",
        operation: "measurement.evidenceLookup",
        status: "answered",
        reason: "Measurement question was answered from exported app evidence.",
        validation: ["No report content was changed."],
        undoSnapshot: false,
      }),
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
      controlTrace: buildControlTrace({
        context,
        intent: userPrompt,
        planner: "helpdesk_guard",
        risk: "low",
        operation: "section.stateLookup",
        status: "answered",
        reason: "Section status and missing-field answer came from report-platform state.",
        validation: ["No report content was changed."],
        undoSnapshot: false,
      }),
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
      controlTrace: buildControlTrace({
        context,
        intent: userPrompt,
        planner: "fallback_guard",
        risk: (fallback.actions ?? []).length > 0 ? "medium" : "low",
        operation: (fallback.actions ?? []).length > 0 ? "fallback.actions" : "fallback.answer",
        status: (fallback.actions ?? []).length > 0 ? "applied" : "answered",
        reason: "LAIQ AI Engine worker was unavailable, so deterministic fallback handled the request.",
        validation: (fallback.actions ?? []).length > 0
          ? [`${(fallback.actions ?? []).length} fallback action${(fallback.actions ?? []).length === 1 ? "" : "s"} returned.`]
          : ["No report content was changed."],
        undoSnapshot: (fallback.actions ?? []).length > 0,
      }),
    };
  }

  try {
    const response = await runStructuredCodexJob({
      prompt: buildAssistantChatPrompt(context, userPrompt, normalizedHistory),
      schema: SECTION_CHAT_SCHEMA,
    });
    const normalizedActions = normalizeAssistantActions(response.parsed.actions, {
      context,
      markPredictionContent: true,
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
      actions: normalizedActions,
      controlTrace: buildControlTrace({
        context,
        intent: userPrompt,
        planner: normalizedActions.length > 0 ? "structured_planner" : "helpdesk_guard",
        risk: normalizedActions.length > 0 ? "medium" : "low",
        operation: normalizedActions.length > 0 ? "section.chatActions" : "section.answer",
        status: normalizedActions.length > 0 ? "applied" : "answered",
        reason: normalizedActions.length > 0
          ? "LAIQ AI Engine returned structured actions for the selected section."
          : "LAIQ AI Engine answered without changing report content.",
        validation: normalizedActions.length > 0
          ? [`${normalizedActions.length} structured action${normalizedActions.length === 1 ? "" : "s"} returned.`]
          : ["No report content was changed."],
        undoSnapshot: normalizedActions.length > 0,
      }),
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
      controlTrace: buildControlTrace({
        context,
        intent: userPrompt,
        planner: "fallback_guard",
        risk: (fallback.actions ?? []).length > 0 ? "medium" : "low",
        operation: (fallback.actions ?? []).length > 0 ? "fallback.actions" : "fallback.answer",
        status: (fallback.actions ?? []).length > 0 ? "applied" : "answered",
        reason: "LAIQ AI Engine chat request failed, so deterministic fallback handled the request.",
        validation: (fallback.actions ?? []).length > 0
          ? [`${(fallback.actions ?? []).length} fallback action${(fallback.actions ?? []).length === 1 ? "" : "s"} returned.`]
          : ["No report content was changed."],
        undoSnapshot: (fallback.actions ?? []).length > 0,
      }),
    };
  }
}

export async function generateTargetedSectionEdit({
  reportState,
  sectionId,
  request,
}) {
  const context = buildSectionContext({ reportState, sectionId, userInstruction: "" });
  const selection = normalizeTargetedEditSelection(request?.selection);
  const action = String(request?.action ?? "").trim();
  const instruction = buildTargetedEditInstruction(action, request?.instruction);
  const currentDraft = String(context.currentDraft ?? "");
  const sectionDraft = reportState.sectionDrafts?.find((draft) => draft.sectionId === sectionId);
  const currentVersion = Number(sectionDraft?.version ?? 0);
  const expectedVersion = Number(request?.expectedVersion);

  if (!TARGETED_EDIT_ACTIONS.has(action)) {
    throw targetedEditError("Choose a supported targeted editing action.", "targeted_edit_action_invalid");
  }
  if (!Number.isInteger(expectedVersion) || expectedVersion !== currentVersion) {
    throw targetedEditError(
      "This section changed before LAIQ AI could prepare the edit. Reload it and select the text again.",
      "targeted_edit_version_conflict",
    );
  }
  if (!currentDraft.trim()) {
    throw targetedEditError("Generate this section before using targeted editing.", "targeted_edit_draft_missing");
  }

  const currentDocumentHash = sha256Value(currentDraft);
  const currentDocumentTextHash = sha256Value(normalizeComparableText(stripHtml(currentDraft)));
  if (
    selection.documentHash !== currentDocumentHash
    && selection.documentTextHash !== currentDocumentTextHash
  ) {
    throw targetedEditError(
      "The highlighted text no longer matches the saved section. Select it again.",
      "targeted_edit_document_conflict",
    );
  }

  validateTargetedEditSelection(currentDraft, selection, action);
  const aiStatus = getAiStatus();
  if (!aiStatus.configured) {
    throw targetedEditError(
      "LAIQ AI Engine is unavailable. Check the configured Codex CLI worker before retrying.",
      "targeted_edit_ai_unavailable",
    );
  }

  const protectedFacts = collectTargetedEditProtectedFacts(context, selection);
  let response;
  let replacementHtml;
  let validation;
  let retryGuidance = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    response = await runStructuredCodexJob({
      prompt: buildTargetedEditPrompt({
        action,
        context,
        instruction,
        protectedFacts,
        retryGuidance,
        selection,
      }),
      schema: TARGETED_EDIT_SCHEMA,
      ...getTargetedEditWorkerOptions(),
    });
    if (response.parsed.factsChanged) {
      throw targetedEditError(
        "LAIQ AI could not preserve all protected app facts in this proposal.",
        "targeted_edit_protected_fact_changed",
      );
    }
    replacementHtml = normalizeTargetedReplacementHtml(
      response.parsed.replacementHtml,
      selection.selectionKind,
    );
    validation = validateTargetedEditReplacement({
      action,
      protectedFacts,
      replacementHtml,
      selection,
    });
    if (validation.ok && response.parsed.instructionSatisfied) break;

    const canRetry = attempt === 0 && (validation.retryable || !response.parsed.instructionSatisfied);
    if (!canRetry) {
      throw targetedEditError(
        validation.ok ? "LAIQ AI could not complete the requested transformation." : validation.message,
        validation.ok ? "targeted_edit_instruction_not_satisfied" : validation.code,
      );
    }
    retryGuidance = validation.ok
      ? "The previous attempt reported that it did not fully satisfy the requested action. Complete the action more decisively."
      : validation.message;
  }

  if (!response || !replacementHtml || !validation?.ok) {
    throw targetedEditError(
      "LAIQ AI could not prepare a sufficiently distinct targeted edit.",
      "targeted_edit_transformation_too_weak",
    );
  }

  const warnings = dedupe([
    ...response.parsed.warnings.map((warning) => String(warning ?? "").trim()).filter(Boolean),
    ...validation.warnings,
    ...(!response.parsed.instructionSatisfied
      ? ["LAIQ AI reported that the instruction may need another attempt."]
      : []),
  ]);

  return {
    proposalId: randomUUID(),
    sectionId,
    action,
    instruction,
    replacementHtml,
    replacementText: stripHtml(replacementHtml),
    explanation: String(response.parsed.explanation ?? "").trim() || "Prepared a targeted report edit.",
    warnings,
    expectedVersion: currentVersion,
    // The server has already verified this client hash against the canonical draft
    // (directly or through documentTextHash). Echo it so Apply binds to the exact
    // editor document that produced the selection.
    documentHash: selection.documentHash,
    selectionHash: selection.selectionHash,
    providerCode: response.aiStatus.provider,
    modelId: response.aiStatus.modelId,
    usedLiveModel: true,
    createdAtIso: new Date().toISOString(),
  };
}

export { getAiStatus };

function buildSectionContext({ reportState, sectionId, userInstruction, policyDecision = null }) {
  if (!reportState?.exportPackage) {
    throw new Error("Report job state is missing the imported LAIQ app export package.");
  }

  let template = getSectionTemplate(sectionId);

  const exportPackage = reportState.exportPackage;
  const captureSectionFacts = (exportPackage.captureFacts ?? []).filter((fact) => fact.targetReportSectionId === sectionId);
  if (captureSectionFacts.length > 0 && exportPackage.captureScenarioProvenance) {
    template = {
      ...template,
      requiredManualFields: [],
      compose: (context) => composeCapturedEvidenceSection(context),
      templateExpectation: "Recover the report section from app-observable capture facts without requiring unrelated report-template fields.",
    };
  }
  const manualInputs = { ...(reportState.manualSupplement ?? {}) };
  if (captureSectionFacts.length > 0) {
    for (const fieldKey of template.requiredManualFields) {
      if (fieldKey === `${sectionId}-content-source` || fieldKey === `${sectionId}-layout-source`) {
        manualInputs[fieldKey] = JSON.stringify(captureSectionFacts.map((fact) => ({ factId: fact.factId, value: fact.value, unitCode: fact.unitCode })));
      }
    }
  }
  const reportClassification = reportState.reportClassification ?? classifyReportPackage(exportPackage);
  const calculations = buildCalculationOutputs(sectionId, exportPackage);
  const policyConfiguration = normalizeGenerationPolicyConfiguration(policyDecision?.configuration);
  const precedentPack = searchPrecedentPack({
    sectionId,
    reportState,
    retrievalPolicy: policyConfiguration,
    retrievalFirewallContext: reportState.retrievalFirewallContext ?? null,
  });
  const retrievalContext = buildFlatRetrievalContext(precedentPack);
  const useFactRecommendationKb = shouldUseFactRecommendationKb(sectionId, template);
  const factRecommendationPack = useFactRecommendationKb
    ? searchFactRecommendationPairs({
        sectionId,
        reportState,
        limit: policyConfiguration.factRecommendationLimit,
        retrievalFirewallContext: reportState.retrievalFirewallContext ?? null,
      })
    : buildEmptyFactRecommendationPack(sectionId);
  const factRecommendationContext = buildFlatFactRecommendationContext(factRecommendationPack);
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
  const blockers = collectBlockers(sectionId, exportPackage, mapArtifacts, captureSectionFacts);
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
    factRecommendationContext,
    factRecommendationPack,
    mapArtifacts,
    standardRuleChecks,
    warnings,
    blockers,
    currentDraft,
    userInstruction,
    policyDecision,
    policyConfiguration,
    captureSectionFacts,
  };
}

function normalizeGenerationPolicyConfiguration(value) {
  const config = value && typeof value === "object" ? value : {};
  return {
    precedentMinimumScore: Number(config.precedentMinimumScore ?? 45),
    precedentCandidateMultiplier: Number(config.precedentCandidateMultiplier ?? 4),
    precedentLimit: Number(config.precedentLimit ?? 5),
    wordingLimit: Number(config.wordingLimit ?? 3),
    standardsLimit: Number(config.standardsLimit ?? 3),
    factRecommendationLimit: Number(config.factRecommendationLimit ?? 24),
    promptVariant: String(config.promptVariant ?? "baseline_v1"),
    agentRoute: String(config.agentRoute ?? "default"),
    precedentFamilyMode: String(config.precedentFamilyMode ?? "compatible"),
  };
}

function buildGenerationPolicyAudit(policyDecision, configuration) {
  return {
    decisionId: policyDecision?.decisionId ?? null,
    policyVersionId: policyDecision?.policyVersionId ?? null,
    policyVersion: policyDecision?.policyVersion ?? null,
    policyStatus: policyDecision?.policyStatus ?? null,
    armId: policyDecision?.armId ?? null,
    armKey: policyDecision?.armKey ?? "unmanaged_default",
    armName: policyDecision?.armName ?? null,
    mode: policyDecision?.mode ?? "unmanaged_default",
    contextKey: policyDecision?.contextKey ?? null,
    context: policyDecision?.context ?? null,
    selectionScore: Number.isFinite(policyDecision?.selectionScore)
      ? policyDecision.selectionScore
      : null,
    selectionReason: policyDecision?.selectionReason ?? null,
    configuration,
    containsGoldContent: false,
  };
}

function normalizeTargetedEditSelection(value) {
  const selection = value && typeof value === "object" ? value : {};
  return {
    from: Number(selection.from),
    to: Number(selection.to),
    selectedText: String(selection.selectedText ?? "").trim(),
    selectedHtml: String(selection.selectedHtml ?? "").trim(),
    documentHash: String(selection.documentHash ?? "").trim(),
    documentTextHash: String(selection.documentTextHash ?? "").trim(),
    selectionHash: String(selection.selectionHash ?? "").trim(),
    selectionKind: selection.selectionKind === "block" ? "block" : "inline",
    contextBefore: String(selection.contextBefore ?? "").trim().slice(-500),
    contextAfter: String(selection.contextAfter ?? "").trim().slice(0, 500),
  };
}

function validateTargetedEditSelection(currentDraft, selection, action) {
  if (
    !Number.isInteger(selection.from) ||
    !Number.isInteger(selection.to) ||
    selection.from < 0 ||
    selection.to <= selection.from
  ) {
    throw targetedEditError("The highlighted range is invalid.", "targeted_edit_selection_invalid");
  }
  if (!selection.selectedText || !selection.selectedHtml) {
    throw targetedEditError("Highlight report text before requesting an edit.", "targeted_edit_selection_empty");
  }
  if (selection.selectedText.length > 8000 || selection.selectedHtml.length > 12000) {
    throw targetedEditError(
      "The highlighted content is too large. Select a smaller report passage.",
      "targeted_edit_selection_too_large",
    );
  }
  if (/<\s*(table|thead|tbody|tr|th|td)\b/i.test(selection.selectedHtml)) {
    throw targetedEditError(
      "Targeted narrative editing does not change table structure. Select narrative text or use the table controls.",
      "targeted_edit_table_not_supported",
    );
  }
  if (
    (action === "to_points" || action === "to_paragraph") &&
    selection.selectionKind !== "block"
  ) {
    throw targetedEditError(
      "Select the complete paragraph or list before changing its structure.",
      "targeted_edit_block_required",
    );
  }

  const expectedSelectionHash = sha256Value([
    selection.from,
    selection.to,
    selection.selectedText,
    selection.selectedHtml,
  ].join("\n"));
  if (selection.selectionHash !== expectedSelectionHash) {
    throw targetedEditError(
      "The highlighted content could not be verified.",
      "targeted_edit_selection_hash_invalid",
    );
  }

  const draftText = normalizeComparableText(stripHtml(currentDraft));
  const selectedText = normalizeComparableText(selection.selectedText);
  if (!selectedText || !draftText.includes(selectedText)) {
    throw targetedEditError(
      "The highlighted text is no longer present in the saved section.",
      "targeted_edit_selection_stale",
    );
  }
}

function buildTargetedEditInstruction(action, value) {
  const customInstruction = String(value ?? "").trim();
  if (action === "custom") {
    if (!customInstruction) {
      throw targetedEditError(
        "Enter an instruction for this highlighted content.",
        "targeted_edit_instruction_required",
      );
    }
    return customInstruction.slice(0, 2000);
  }

  const instructions = {
    rephrase: "Restructure the wording noticeably for clarity while preserving the meaning, technical facts, and report tone.",
    shorten: "Reduce the wording materially while preserving every technical fact and required conclusion.",
    enhance: "Strengthen clarity, technical precision, and logical flow without adding new claims.",
    to_points: "Convert the selected report block into concise, parallel bullet points.",
    to_paragraph: "Convert the selected bullet list into a concise, coherent report paragraph.",
  };
  return instructions[action] ?? customInstruction;
}

function buildTargetedEditPrompt({
  action,
  context,
  instruction,
  protectedFacts,
  retryGuidance,
  selection,
}) {
  const allowedMarkup = selection.selectionKind === "inline"
    ? "inline HTML only: strong, em, u, span, and br"
    : "block HTML using only p, ul, ol, li, h3, h4, strong, em, u, span, and br";
  const standardGuidance = context.standardRuleChecks
    .slice(0, 8)
    .map((check) => ({
      label: check.label,
      status: check.status,
      message: check.message,
    }));
  const selectedTextLength = normalizeComparableText(selection.selectedText).length;
  const actionRequirements = {
    rephrase: "REPHRASE REQUIREMENT: Rebuild the sentence structure and word order so the revision is visibly different, not a one- or two-word substitution. Preserve the same facts, meaning, conclusion, and professional report tone. Keep the result concise and near the original length.",
    shorten: `SHORTEN REQUIREMENT: Return substantially tighter wording. Target no more than ${Math.max(
      20,
      Math.floor(selectedTextLength * 0.7),
    )} plain-text characters compared with the selected ${selectedTextLength} characters. Remove repetition, filler, and boilerplate first, but keep every protected fact and required conclusion exactly.`,
    enhance: "ENHANCE REQUIREMENT: Make a visible improvement to technical clarity and logical flow. Prefer stronger technical verbs, clearer sequencing, and removal of ambiguity. Do not merely substitute a few synonyms, and do not add facts, findings, requirements, or conclusions.",
    to_points: "POINTS REQUIREMENT: Convert the complete selected block into concise, parallel points without changing its facts or meaning.",
    to_paragraph: "PARAGRAPH REQUIREMENT: Convert the complete selected list into one coherent, concise report paragraph without changing its facts or meaning.",
    custom: "CUSTOM REQUIREMENT: Follow the user's instruction precisely and make a visible change unless the instruction explicitly asks to preserve the wording.",
  };
  const actionRequirement = actionRequirements[action]
    ?? `ACTION REQUIREMENT: Complete the requested ${action} transformation rather than returning unchanged wording.`;
  const correctionRequirement = retryGuidance
    ? `\nCORRECTION REQUIRED: The prior proposal was rejected. ${retryGuidance}`
    : "";

  return `You are the LAIQ AI Engine targeted report editor.

Rewrite only the selected report content. Do not return the complete section.
The content before and after the selection is read-only context.
${actionRequirement}
${correctionRequirement}
The replacement must join grammatically and semantically with the read-only text immediately before and after it.
For a partial-sentence selection, return only a complete replacement phrase that does not create duplicated subjects, verbs, punctuation, or missing spaces at either boundary.
Use ${allowedMarkup}.
Do not use Markdown or code fences.
Do not add class, style, id, or event-handler attributes. The platform applies report styling after validation.
Do not add measurements, findings, dates, names, locations, recommendations, or code conclusions that are not present in the selection or protected facts.
Historical report precedent may guide tone and structure only; it is not a source of current inspection facts.
Preserve every protected fact exactly. Preserve app_field_data and app_voice_data provenance spans and their text exactly.
Wrap newly written narrative wording in span elements with data-laiq-provenance="llm_prediction" when this does not break the selected structure.
For inline selections, do not return p, ul, ol, li, headings, tables, or div elements.
For block selections, return complete valid report blocks.
Set factsChanged=true if you could not preserve a protected fact.

Section:
${JSON.stringify({
    id: context.sectionId,
    title: context.template.title,
    kind: context.template.kind,
    templateExpectation: context.template.templateExpectation,
    standardGuidance,
  }, null, 2)}

Requested action:
${action}

User instruction:
${instruction}

Protected facts:
${JSON.stringify(protectedFacts, null, 2)}

Read-only context before:
${selection.contextBefore}

Selected HTML:
${selection.selectedHtml}

Selected text:
${selection.selectedText}

Read-only context after:
${selection.contextAfter}

Return JSON matching the provided schema.`;
}

function collectTargetedEditProtectedFacts(context, selection) {
  const facts = new Map();
  const selectedText = normalizeComparableText(selection.selectedText);
  const addFact = (value, source, requireProvenance = false) => {
    const normalized = String(value ?? "").trim();
    if (!normalized || normalized.length > 240) return;
    if (!selectedText.includes(normalizeComparableText(normalized))) return;
    const key = normalizeComparableText(normalized);
    const existing = facts.get(key);
    facts.set(key, {
      value: normalized,
      source,
      requireProvenance: Boolean(requireProvenance || existing?.requireProvenance),
    });
  };

  const provenancePattern =
    /<(?:span|mark)\b[^>]*data-laiq-provenance=["']app_field_data["'][^>]*>([\s\S]*?)<\/(?:span|mark)>/gi;
  let provenanceMatch;
  while ((provenanceMatch = provenancePattern.exec(selection.selectedHtml)) != null) {
    addFact(stripHtml(provenanceMatch[1]), "app_field_data", true);
  }

  const exportPackage = context.exportPackage ?? {};
  [
    exportPackage.inspectionReference,
    exportPackage.task?.client,
    exportPackage.task?.tankNumber,
    exportPackage.task?.siteName,
    exportPackage.task?.assetName,
    exportPackage.profile?.tenantName,
    exportPackage.profile?.workspaceName,
  ].forEach((value) => addFact(value, "app_export"));

  const protectedTokenPattern =
    /\b(?:API\s*\d{3}|[A-Z]{1,6}[-/]\d[\w./-]*|[A-Z]\d{1,3}|\d+(?:\.\d+)?\s*(?:mm|m|%|years?|months?|days?)?)\b/gi;
  for (const match of selection.selectedText.matchAll(protectedTokenPattern)) {
    addFact(match[0], "selected_technical_token");
  }

  return [...facts.values()].slice(0, 80);
}

function normalizeTargetedReplacementHtml(value, selectionKind) {
  const html = String(value ?? "")
    .trim()
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (!html || hasUnsafeTransformHtml(html)) {
    throw targetedEditError(
      "LAIQ AI returned an unsafe or empty replacement.",
      "targeted_edit_replacement_invalid",
    );
  }

  const allowedTags = selectionKind === "inline"
    ? new Set(["strong", "em", "u", "span", "br"])
    : new Set(["p", "ul", "ol", "li", "h3", "h4", "strong", "em", "u", "span", "br"]);
  return html.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (tag, rawTagName) => {
    const tagName = String(rawTagName).toLowerCase();
    if (!allowedTags.has(tagName)) {
      throw targetedEditError(
        "LAIQ AI returned markup that is not valid for the highlighted report content.",
        "targeted_edit_markup_invalid",
      );
    }

    if (/^<\s*\//.test(tag)) {
      return `</${tagName}>`;
    }

    const provenanceMatch = tag.match(
      /\bdata-laiq-provenance\s*=\s*["'](app_field_data|app_voice_data|precedent_template|llm_prediction)["']/i,
    );
    if (/\bdata-laiq-provenance\s*=/i.test(tag) && !provenanceMatch) {
      throw targetedEditError(
        "LAIQ AI returned an unsupported provenance value.",
        "targeted_edit_attributes_invalid",
      );
    }

    const provenanceAttribute = provenanceMatch
      ? ` data-laiq-provenance="${provenanceMatch[1].toLowerCase()}"`
      : "";
    const selfClosingSuffix = tagName === "br" ? " /" : "";
    return `<${tagName}${provenanceAttribute}${selfClosingSuffix}>`;
  });
}

function validateTargetedEditReplacement({
  action,
  protectedFacts,
  replacementHtml,
  selection,
}) {
  const replacementText = normalizeComparableText(stripHtml(replacementHtml));
  const selectedText = normalizeComparableText(selection.selectedText);
  if (!replacementText) {
    return {
      ok: false,
      code: "targeted_edit_replacement_empty",
      message: "LAIQ AI returned an empty replacement.",
      warnings: [],
    };
  }

  const missingFacts = protectedFacts.filter(
    (fact) => !replacementText.includes(normalizeComparableText(fact.value)),
  );
  if (missingFacts.length > 0) {
    return {
      ok: false,
      code: "targeted_edit_protected_fact_changed",
      message: `The proposal changed protected app facts: ${missingFacts.map((fact) => fact.value).join(", ")}.`,
      warnings: [],
    };
  }

  const missingProvenance = protectedFacts.filter(
    (fact) =>
      fact.requireProvenance &&
      !new RegExp(
        `<(?:span|mark)\\b[^>]*data-laiq-provenance=["']app_field_data["'][^>]*>[\\s\\S]*?${escapeRegex(fact.value)}[\\s\\S]*?<\\/(?:span|mark)>`,
        "i",
      ).test(replacementHtml),
  );
  if (missingProvenance.length > 0) {
    return {
      ok: false,
      code: "targeted_edit_provenance_removed",
      message: "The proposal removed protected app-data provenance.",
      warnings: [],
    };
  }

  if (action === "to_points" && !/<(?:ul|ol)\b/i.test(replacementHtml)) {
    return {
      ok: false,
      code: "targeted_edit_points_missing",
      message: "LAIQ AI did not return a valid bullet or numbered list.",
      warnings: [],
    };
  }
  if (action === "to_paragraph" && /<(?:ul|ol|li)\b/i.test(replacementHtml)) {
    return {
      ok: false,
      code: "targeted_edit_paragraph_invalid",
      message: "LAIQ AI did not return a paragraph-only replacement.",
      warnings: [],
    };
  }

  const warnings = [];
  const selectedWordCount = tokenizeComparableText(selectedText).length;
  const similarity = tokenSequenceSimilarity(selectedText, replacementText);

  if (action === "shorten" && selectedText.length >= 80) {
    const maximumLengthRatio = 0.8;
    const actualLengthRatio = replacementText.length / selectedText.length;
    if (actualLengthRatio > maximumLengthRatio) {
      return {
        ok: false,
        code: "targeted_edit_shortening_too_weak",
        message: `The shortened proposal retained ${Math.round(actualLengthRatio * 100)}% of the original length; reduce it to 80% or less while preserving protected facts.`,
        retryable: true,
        warnings: [],
      };
    }
  } else if (action === "shorten" && replacementText.length >= selectedText.length) {
    return {
      ok: false,
      code: "targeted_edit_shortening_too_weak",
      message: "The shortened proposal must be shorter than the original selection.",
      retryable: true,
      warnings: [],
    };
  }

  if (action === "rephrase" && selectedWordCount >= 10 && similarity > 0.82) {
    return {
      ok: false,
      code: "targeted_edit_rephrase_too_weak",
      message: "The rephrased proposal is too similar to the original. Rebuild the sentence structure while preserving all facts and meaning.",
      retryable: true,
      warnings: [],
    };
  }

  if (action === "enhance" && selectedWordCount >= 10 && similarity > 0.88) {
    return {
      ok: false,
      code: "targeted_edit_enhancement_too_weak",
      message: "The enhanced proposal is too similar to the original. Improve technical clarity and logical flow more visibly without adding facts.",
      retryable: true,
      warnings: [],
    };
  }

  return { ok: true, code: null, message: null, warnings };
}

function tokenizeComparableText(value) {
  return normalizeComparableText(value).match(/[a-z0-9]+(?:[./-][a-z0-9]+)*/g) ?? [];
}

function tokenSequenceSimilarity(left, right) {
  const leftTokens = tokenizeComparableText(left);
  const rightTokens = tokenizeComparableText(right);
  if (leftTokens.length === 0 && rightTokens.length === 0) return 1;
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0;

  const previous = new Uint16Array(rightTokens.length + 1);
  const current = new Uint16Array(rightTokens.length + 1);
  for (const leftToken of leftTokens) {
    current.fill(0);
    for (let index = 1; index <= rightTokens.length; index += 1) {
      current[index] = leftToken === rightTokens[index - 1]
        ? previous[index - 1] + 1
        : Math.max(previous[index], current[index - 1]);
    }
    previous.set(current);
  }

  return previous[rightTokens.length] / Math.max(leftTokens.length, rightTokens.length);
}

function targetedEditError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function sha256Value(value) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

function normalizeComparableText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function escapeRegex(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shouldUseFactRecommendationKb(sectionId, template) {
  return sectionId.includes("repair") || sectionId.includes("recommendation");
}

function buildEmptyFactRecommendationPack(sectionId) {
  return {
    sectionId,
    retrievalRunId: null,
    indexBuiltAtIso: null,
    pairCount: 0,
    blockedSourceNames: [],
    excludedPairCount: 0,
    evidenceProfile: null,
    totalMatchCount: 0,
    pairs: [],
    warnings: [],
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

function shouldHighlightPredictedContent({
  context,
  isMapCompilerSection,
  isMeasurementCompilerSection,
}) {
  if (isMeasurementCompilerSection || isMapCompilerSection) return false;
  if (context.sectionId === "tank-inspection-checklist") return false;
  return true;
}

function markPredictedContent(content, context) {
  const value = String(content ?? "").trim();
  if (!value) return value;
  if (value.includes("data-laiq-provenance=")) return value;

  if (looksLikeHtml(value)) {
    return wrapProvenanceBlock("llm_prediction", value);
  }

  return plainTextToProvenanceHtml(value, context);
}

function plainTextToProvenanceHtml(value, context) {
  const blocks = value.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);

  return blocks
    .map((block) => {
      const lines = block
        .split("\n")
        .flatMap(splitInlineEvidenceColumns)
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length === 0) return "";

      if (lines.length === 1 && isReportHeadingLine(lines[0])) {
        return `<h3>${escapeHtml(lines[0])}</h3>`;
      }

      return linesToProvenanceHtml(lines, context);
    })
    .join("");
}

function splitInlineEvidenceColumns(line) {
  const value = String(line ?? "").trim();
  const arrowCount = (value.match(/➢/g) ?? []).length;
  if (!value || arrowCount === 0 || (arrowCount === 1 && /^➢\s+/.test(value))) {
    return [value];
  }

  const body = value.replace(/^➢\s+/, "");
  return body
    .split(/\s+➢\s+/)
    .map((part) => `➢ ${part.trim()}`)
    .filter(Boolean);
}

function linesToProvenanceHtml(lines, context) {
  const fragments = [];
  let currentKind = null;
  let currentLines = [];

  const flush = () => {
    if (currentLines.length === 0) return;
    fragments.push(wrapProvenanceBlock(currentKind, renderProvenanceLines(currentLines, currentKind, context)));
    currentKind = null;
    currentLines = [];
  };

  for (const line of lines) {
    if (isReportHeadingLine(line)) {
      flush();
      fragments.push(`<h3>${escapeHtml(line)}</h3>`);
      continue;
    }

    const nextKind = classifyProvenanceLine(line, context);
    if (currentKind && nextKind !== currentKind) {
      flush();
    }
    currentKind = nextKind;
    currentLines.push(line);
  }

  flush();
  return fragments.join("");
}

function renderProvenanceLines(lines, kind, context) {
  const bulletLines = lines.filter((line) => /^[-➢]\s+/.test(line));
  if (bulletLines.length === lines.length) {
    return `<ul>${bulletLines.map((line) => `<li>${renderProvenanceLineInner(line.replace(/^[-➢]\s+/, ""), context)}</li>`).join("")}</ul>`;
  }

  return `<p>${lines.map((line) => renderProvenanceLineInner(line, context)).join("<br />")}</p>`;
}

function renderProvenanceLineInner(line, context) {
  const structured = splitStructuredFieldLine(line);
  if (!structured) {
    return escapeHtml(line);
  }

  const valueKind = classifyStructuredFieldValue(structured.label, structured.value, context);
  return [
    wrapInlineProvenance("precedent_template", `${structured.label}:`),
    " ",
    wrapInlineProvenance(valueKind, structured.value),
  ].join("");
}

function splitStructuredFieldLine(line) {
  const value = String(line ?? "").trim();
  const match = /^(.{2,72}?):\s+(.+)$/.exec(value);
  if (!match) return null;

  const label = match[1].trim();
  const fieldValue = match[2].trim();
  if (!label || !fieldValue || /[.!?]$/.test(label)) return null;
  if (label.split(/\s+/).length > 8) return null;

  return { label, value: fieldValue };
}

function classifyStructuredFieldValue(label, value, context) {
  const cleanedValue = String(value ?? "").trim();
  if (!cleanedValue || /pending confirmation|not recorded/i.test(cleanedValue)) {
    return "llm_prediction";
  }

  if (isAppFieldLabel(label) || containsAppSourceFact(cleanedValue, context)) {
    return "app_field_data";
  }

  if (isPredictionLine(cleanedValue)) {
    return "llm_prediction";
  }

  return "precedent_template";
}

function isAppFieldLabel(label) {
  return /^(client|customer|customer name|owner|operator|project|site|terminal|tank number|tank no\.?|tank id|tank|tank type|inspection type|inspection reference|location|field\s*\/\s*lease name|field|lease|date inspected|inspection date|inspector|roof type|floor type|reference mode|diameter \/ height|diameter|height|shell courses?|shell course count|shell plates?|shell plates per course|.*ut rows?|.*plate count.*|.*layout rows?.*|.*widest plate row.*|validation status|exported at|inspection window|imported .+ count|imported .+ rows|imported .+ labels|effective marker count|report-side override count)$/i.test(
    String(label ?? "").trim(),
  );
}

function wrapInlineProvenance(kind, value) {
  const normalizedKind = ["app_field_data", "app_voice_data", "precedent_template", "llm_prediction"].includes(kind)
    ? kind
    : "llm_prediction";
  const className = normalizedKind === "app_field_data"
    ? "laiq-provenance-inline laiq-provenance-inline-field"
    : normalizedKind === "app_voice_data"
      ? "laiq-provenance-inline laiq-provenance-inline-voice"
    : normalizedKind === "precedent_template"
      ? "laiq-provenance-inline laiq-provenance-inline-template"
      : "laiq-provenance-inline laiq-provenance-inline-ai";
  return `<span class="${className}" data-laiq-provenance="${normalizedKind}">${escapeHtml(value)}</span>`;
}

function wrapProvenanceBlock(kind, innerHtml) {
  const normalizedKind = ["app_field_data", "app_voice_data", "precedent_template", "llm_prediction"].includes(kind)
    ? kind
    : "llm_prediction";
  const className = normalizedKind === "app_field_data"
    ? "laiq-provenance-block laiq-provenance-field"
    : normalizedKind === "app_voice_data"
      ? "laiq-provenance-block laiq-provenance-voice"
    : normalizedKind === "precedent_template"
      ? "laiq-provenance-block laiq-provenance-template"
      : "laiq-provenance-block laiq-provenance-ai";
  return `<section class="${className}" data-laiq-provenance="${normalizedKind}">${innerHtml}</section>`;
}

function classifyProvenanceLine(line, context) {
  if (splitStructuredFieldLine(String(line ?? "").replace(/^[➢-]\s*/, ""))) return "precedent_template";
  if (isAppFieldDataLine(line, context)) return "app_field_data";
  if (isPredictionLine(line)) return "llm_prediction";
  if (isAppDerivedObservationLine(line, context)) return "app_field_data";
  return "precedent_template";
}

function isAppFieldDataLine(line, context) {
  const cleaned = String(line ?? "")
    .replace(/^[➢-]\s*/, "")
    .trim();
  if (!cleaned) return false;
  if (/pending confirmation/i.test(cleaned)) return false;

  if (containsAppSourceFact(cleaned, context)) {
    return true;
  }

  if (/^(client|customer|customer name|owner|operator|project|site|terminal|tank number|tank no\.?|tank id|tank|tank type|inspection type|inspection reference|report reference|report no\.?|location|field\s*\/\s*lease name|field|lease|date inspected|inspection date|inspector|client representative|year built|roof type|floor type|reference mode|diameter \/ height|diameter|height|shell course count|shell plates per course|roof plate ut rows|shell ut rows|floor ut rows|validation status|exported at|inspection window|imported .+ count|imported .+ rows|imported .+ labels|effective marker count|report-side override count):/i.test(cleaned)) {
    return true;
  }

  if (/^(current imported baseline|imported finding markers|imported .+ elements|linked .+ finding locations|imported shell finding count|imported shell ut row count|imported attachment count):/i.test(cleaned)) {
    return true;
  }

  if (/^(all thickness readings are shown|no matching laiq inspection app v3 ut measurement rows were found)/i.test(cleaned)) {
    return true;
  }

  return isCapturedVoiceLine(cleaned, context);
}

function containsAppSourceFact(line, context) {
  const normalizedLine = normalizeForSourceComparison(line);
  if (!normalizedLine) return false;

  return buildAppSourceFacts(context).some((fact) => {
    const normalizedFact = normalizeForSourceComparison(fact);
    if (!normalizedFact) return false;
    return normalizedFact.length <= 4
      ? new RegExp(`(^|\\s)${escapeRegExp(normalizedFact)}($|\\s)`, "i").test(normalizedLine)
      : normalizedLine.includes(normalizedFact);
  });
}

function buildAppSourceFacts(context) {
  const exportPackage = context?.exportPackage;
  const facts = new Set();
  const addFact = (value) => {
    const text = String(value ?? "").trim();
    if (!isUsefulAppSourceFact(text)) return;
    facts.add(text);
  };
  const addValues = (values) => values.forEach(addFact);

  if (exportPackage) {
    const record = exportPackage.inspectionRecord ?? {};
    const task = exportPackage.task ?? {};
    const profile = exportPackage.profile ?? {};

    addValues([
      exportPackage.inspectionId,
      exportPackage.inspectionReference,
      exportPackage.packageType,
      exportPackage.schemaVersion ? `schema ${exportPackage.schemaVersion}` : "",
      formatDateLabel(exportPackage.exportedAtIso),
      task.client,
      task.tankNumber,
      task.tankNumber ? `Tank ${task.tankNumber}` : "",
      task.location,
      record.client,
      record.tankNumber,
      record.tankNumber ? `Tank ${record.tankNumber}` : "",
      record.location,
      record.fieldLeaseName,
      record.inspector,
      record.externalRoofType,
      humanizeKey(record.externalRoofType ?? ""),
      record.floorType,
      humanizeKey(record.floorType ?? ""),
      record.referenceMode,
      humanizeKey(record.referenceMode ?? ""),
      record.diameterM,
      record.heightM,
      formatMetric(record.diameterM),
      formatMetric(record.heightM),
      profile.tenantName,
      profile.workspaceName,
      profile.displayName,
      profile.roleLabel,
    ]);

    for (const layoutConfig of exportPackage.layoutConfigs ?? []) {
      addValues([
        layoutConfig.targetKey,
        layoutConfig.referenceMode,
        humanizeKey(layoutConfig.referenceMode ?? ""),
        layoutConfig.shellCourseCount,
        layoutConfig.shellPlateCount,
        layoutConfig.roofRowCount,
        layoutConfig.floorAnnularPlateCount,
        layoutConfig.floorSketchMode,
        humanizeKey(layoutConfig.floorSketchMode ?? ""),
      ]);
    }

    for (const element of exportPackage.elements ?? []) {
      addValues([
        element.elementId,
        element.elementLabel,
        element.elementTypeKey,
        humanizeKey(element.elementTypeKey ?? ""),
        element.targetKey,
        element.plateId,
        element.courseKey,
        element.compassKey,
      ]);
    }

    for (const finding of exportPackage.findings ?? []) {
      addValues([
        finding.findingId,
        finding.itemLabel,
        finding.summary,
        finding.description,
        finding.recommendation,
        finding.linkedUtItemKey,
        finding.targetKey,
        finding.plateId,
        finding.courseKey,
        finding.compassKey,
      ]);
    }

    for (const measurement of exportPackage.utMeasurements ?? []) {
      addValues([
        measurement.itemLabel,
        measurement.itemKey,
        measurement.plateId,
        measurement.courseKey,
        measurement.compassKey,
        measurement.nozzleSize,
      ]);
    }

    for (const attachment of exportPackage.attachments ?? []) {
      addValues([attachment.attachmentId, attachment.displayName, attachment.linkedFindingId]);
    }
  }

  for (const value of Object.values(context?.manualInputs ?? {})) {
    addFact(value);
  }

  return [...facts].sort((left, right) => String(right).length - String(left).length);
}

function isUsefulAppSourceFact(value) {
  const text = String(value ?? "").trim();
  if (text.length < 3) return false;
  if (/^(pending confirmation|not recorded|null|undefined|true|false|yes|no)$/i.test(text)) return false;
  if (/^\d+$/.test(text) && text.length < 2) return false;
  if (/^(roof|shell|floor|element|region|plate|course|north|south|east|west|internal|external|api|api 653)$/i.test(text)) {
    return false;
  }
  return /[a-zA-Z0-9]/.test(text);
}

function isPredictionLine(line) {
  const cleaned = String(line ?? "")
    .replace(/^[➢-]\s*/, "")
    .trim()
    .toLowerCase();
  if (!cleaned) return false;

  return (
    /pending confirmation|not recorded|missing|do not invent|keep this section pending|subject to inspector|subject to reviewer|future laiq app export|approved report-side inputs/.test(cleaned) ||
    /\b(should|recommend|requires?|needs?|confirm|verify|monitor|install|address|repair|recoat|review|assess|evaluate|consider)\b/.test(cleaned)
  );
}

function isAppDerivedObservationLine(line, context) {
  if (context?.sectionId !== "inspection-report") return false;
  const cleaned = String(line ?? "")
    .replace(/^[➢→-]\s*/, "")
    .trim();
  if (!cleaned) return false;

  const sourceText = buildAppNarrativeSourceText(context);
  if (!sourceText) return false;

  const sourceWords = new Set(extractMeaningfulWords(sourceText));
  const lineWords = extractMeaningfulWords(cleaned);
  if (lineWords.length < 4) return false;

  const matchedCount = lineWords.filter((word) => sourceWords.has(word)).length;
  return matchedCount >= Math.max(3, Math.ceil(lineWords.length * 0.38));
}

function buildAppNarrativeSourceText(context) {
  const exportPackage = context?.exportPackage;
  if (!exportPackage) return "";

  return [
    ...(exportPackage.voiceNotes ?? []).map((note) => note.transcriptText),
    ...(exportPackage.findings ?? []).flatMap((finding) => [
      finding.itemLabel,
      finding.summary,
      finding.description,
      finding.recommendation,
      finding.notes,
    ]),
    ...(exportPackage.checklistSectionNotes ?? []).map((note) => note.noteText ?? note.text),
  ]
    .filter(Boolean)
    .join(" ");
}

function extractMeaningfulWords(value) {
  const stopWords = new Set([
    "the",
    "and",
    "with",
    "for",
    "from",
    "this",
    "that",
    "were",
    "was",
    "are",
    "is",
    "into",
    "during",
    "overall",
    "area",
    "tank",
  ]);

  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !stopWords.has(word));
}

function isCapturedVoiceLine(line, context) {
  const normalizedLine = normalizeForSourceComparison(line);
  if (!normalizedLine) return false;

  for (const note of context?.exportPackage?.voiceNotes ?? []) {
    const transcript = normalizeForSourceComparison(note.transcriptText);
    if (transcript && (normalizedLine.includes(transcript) || transcript.includes(normalizedLine))) {
      return true;
    }
  }

  return false;
}

function normalizeForSourceComparison(value) {
  return String(value ?? "")
    .replace(/[.,;:!?()[\]"']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function looksLikeHtml(value) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function isReportHeadingLine(value) {
  const cleaned = String(value ?? "")
    .replace(/^\d+\s+/, "")
    .trim();
  return cleaned.length <= 96 && cleaned === cleaned.toUpperCase();
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
    factRecommendationRefs: (context.factRecommendationPack?.pairs ?? []).slice(0, 12).map((pair) => ({
      pairId: pair.pairId,
      sourceReportName: pair.sourceReportName,
      pageStart: pair.sourcePageStart,
      actionTags: pair.actionTags,
      componentTags: pair.componentTags,
      use: "structured_historical_fact_to_recommendation_guidance",
    })),
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
        ? "API-standard drawing or map page with controlled source-data status. Imported LAIQ app geometry stays locked until app parity is approved."
        : "API-standard report section matching the approved report-family ToC, heading style, and table/page-block conventions.",
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
    factRecommendationContext: context.factRecommendationContext,
    precedentPack: context.precedentPack,
    factRecommendationPolicy: {
      retrievalRunId: context.factRecommendationPack?.retrievalRunId,
      totalMatchCount: context.factRecommendationPack?.totalMatchCount ?? 0,
      excludedPairCount: context.factRecommendationPack?.excludedPairCount ?? 0,
      blockedSourceNames: context.factRecommendationPack?.blockedSourceNames ?? [],
      rule:
        "Use structured historical fact-to-recommendation pairs as guidance only. Current findings, measurements, client/tank facts, and approval decisions must come from imported LAIQ app facts or report-side user confirmation.",
    },
    reportClassification: context.reportClassification,
    systemRlPolicy: {
      promptVariant: context.policyConfiguration.promptVariant,
      agentRoute: context.policyConfiguration.agentRoute,
      instruction: buildPolicyPromptGuidance(context.policyConfiguration),
    },
    capturedSectionEvidence: context.captureSectionFacts.map((fact) => ({
      factId: fact.factId,
      factType: fact.factType,
      sourceSectionKey:fact.sourceSectionKey??fact.sectionKey??null,
      value: captureFactDisplayValue(fact.value),
      unitCode: fact.unitCode,
      captureChannel: fact.captureChannel,
      transformation: fact.transformation,
    })),
    importedFacts: buildImportedFactsSummary(context.exportPackage),
    inspectionWideContext: buildInspectionWideContext(context.exportPackage),
  };

  const isHorizontalTank = context.reportClassification?.reportFamilyId === "horizontal-internal-external";
  const familyInstruction = isHorizontalTank
    ? "The current inspection is for a horizontal aboveground tank. Use only horizontal-tank structural concepts; do not introduce vertical shell courses, roof plates, floor plates, or settlement sections unless current evidence explicitly provides them."
    : "The current inspection is for a vertical aboveground storage tank. Treat any retrieved horizontal-tank wording as source-document noise unless it refers to a weld orientation.";
  const captureCompletenessInstruction = context.exportPackage?.captureScenarioProvenance
    ? "This is a faithful automated capture scenario: never emit Pending confirmation, Not recorded, raw JSON, escaped newlines, or reviewer placeholders. Every material statement must be supported by capturedSectionEvidence. If evidence does not support a statement, omit it rather than inventing or exposing an internal placeholder."
    : 'If a genuinely required report-side value is missing, use "Pending confirmation" and mark reviewRequired.';
  const sectionFormatInstruction = context.template.kind === "structured"
    ? "Return export-ready HTML beginning with one h3 section heading followed by a stable semantic table with explicit labels, values, units, and identities."
    : context.sectionId === "repair-recommendations" || context.sectionId === "inspection-report" || context.sectionId === "scope-of-inspection"
      ? "Return export-ready HTML beginning with one h3 section heading followed by grouped ul/li findings or recommendations. Preserve operational group labels such as OFF-LINE and ON-LINE when supported."
      : "Return export-ready HTML beginning with one h3 section heading followed by complete professional paragraphs.";
  const provenanceInstruction = [
    "Mark evidence origin inside the HTML:",
    '- data-laiq-provenance="app_field_data" for structured_field or measurement capture channels;',
    '- data-laiq-provenance="app_voice_data" for voice, voice_normalized, or note capture channels;',
    '- data-laiq-provenance="llm_prediction" for connective, summarizing, or inferred model wording;',
    '- data-laiq-provenance="precedent_template" only for non-factual structural labels learned from the report template.',
    "Use spans for mixed-source sentences and sections only when an entire block has one origin. Never label model-authored text as captured evidence.",
  ].join("\n");

  return `You are the LAIQ report writing engine for tank inspection reports.

Generate only client-facing report content for the requested section.
Use only the supplied imported facts, manual inputs, calculations, map artifacts, and precedent guidance.
Use factRecommendationContext as structured historical guidance for likely repair/maintenance wording, but never as current fact unless confirmed by imported facts or manual inputs.
Use the supplied report classification as the controlling report family, format precedent, and standards/code basis.
Use the supplied standardRuleChecks as deterministic rule guidance; do not replace them with free-form assumptions.
Follow the supplied systemRlPolicy instruction. It may change emphasis and context use, but it never overrides factual, leakage, or tenant guardrails.
Never invent measurements, geometry, attachments, names, dates, or recommendations that are not grounded in the provided context.
${captureCompletenessInstruction}
${sectionFormatInstruction}
${provenanceInstruction}
Preserve the report-family formatting expected for the section. Use only h3, h4, p, ul, ol, li, strong, em, span, table, thead, tbody, tr, th, and td; do not return markdown, JSON, or document-shell headers/footers.
The primary precedent report is ${API_STANDARD_PRIMARY_REPORT.reference}: ${API_STANDARD_PRIMARY_REPORT.sourceReportName}.
${familyInstruction}
${buildCaptureRecoveryGuidance(context)}
For map pages, never alter geometry facts or pretend to move markers; describe only the imported LAIQ app layout map and any missing report-side caption/checker inputs.

Return JSON matching the provided schema with:
- content
- summary
- reviewRequired
- detectedIssues

Section generation context:
${JSON.stringify(promptContext, null, 2)}
`;
}

function buildCaptureRecoveryGuidance(context) {
  if (context.sectionId === "inspection-report") {
    return "Organize captured finding observations by their sourceSectionKey. Cover every supported finding once, preserve its component/location and severity, and do not dump raw measurement tables into this narrative summary.";
  }
  if (context.sectionId === "repair-recommendations") {
    return context.exportPackage?.captureScenarioProvenance
      ? "Treat each voice_recommendation_input as an explicit inspector-authorized action and preserve it once. Structured fields may identify the report or asset only. Do not convert any measurement, finding observation, deterministic rule, retrieved precedent, or fact-recommendation example into an additional action. Do not strengthen optional wording such as may/could/alternatively into a mandatory instruction."
      : "Create one concise finding-to-action recommendation for each actionable captured finding. Group actions by sourceSectionKey, omit unsupported historical actions, and do not repeat raw measurement tables or copy hidden reference wording.";
  }
  return "Preserve the sourceSectionKey grouping supplied with captured evidence and cover each fact required by this section.";
}

function buildPolicyPromptGuidance(configuration) {
  if (configuration.promptVariant === "grounded_concise_v1") {
    return [
      "Prefer short, directly evidenced statements.",
      "Omit optional precedent-derived wording when current evidence is weak.",
      "Keep every recommendation explicitly connected to a supplied current finding or deterministic rule check.",
    ].join(" ");
  }
  if (configuration.promptVariant === "evidence_recovery_v1") {
    return [
      "Use all supplied inspection-wide context to organize a complete section.",
      "Clearly preserve Pending confirmation for any unconfirmed current fact.",
      "Use broader precedent only to recover expected structure and question coverage, never to supply current inspection facts.",
    ].join(" ");
  }
  return [
    "Balance concise report wording with complete coverage of supplied current evidence.",
    "Use precedent for structure and cadence only; current facts must remain traceable to app or report-side evidence.",
  ].join(" ");
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
    factRecommendationContext: context.factRecommendationContext,
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
If LAIQ app layout geometry is locked, explain the lock and offer a safe alternative such as caption, evidence, or report wording refinement.
If the user asks whether a section is ready to approve, check whether report-side inputs are still missing.
The requiredManualInputs list is the authoritative missing-content panel for this section. Do not invent additional missing fields.
If requiredManualInputs has no missing items, say the section-level missing inputs are complete, while still noting if generation or approval remains.
If the user asks about layout maps, explain the override workflow and remind them that geometry stays anchored to the imported LAIQ app baseline.
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

async function buildContentTransformReply({
  context,
  userPrompt,
  normalizedPrompt,
  conversationHistory = [],
  aiStatus,
}) {
  const pendingDecision = executePendingContentTransformConfirmation({
    context,
    normalizedPrompt,
    conversationHistory,
  });
  if (pendingDecision) {
    return pendingDecision;
  }

  if (!isPotentialContentTransformRequest(normalizedPrompt, conversationHistory)) {
    return null;
  }

  const isChecklistMarkerRequest =
    context.sectionId === "tank-inspection-checklist" &&
    isChecklistMarkerFormatRequest(normalizedPrompt, conversationHistory);
  if (
    !isChecklistMarkerRequest &&
    isHandledByExistingDeterministicFormatter(context, normalizedPrompt, conversationHistory)
  ) {
    return null;
  }

  const deterministicPlan = buildDeterministicContentTransformPlan(
    context,
    userPrompt,
    normalizedPrompt,
    conversationHistory,
  );
  if (deterministicPlan) {
    const executed = executeContentTransformPlan(context, deterministicPlan);
    if (executed) {
      return {
        ...executed,
        providerCode: "deterministic_content_transform",
        modelId: null,
        usedLiveModel: false,
        fallbackReason:
          "The request matched a controlled report-content transform tool.",
        controlTrace: buildControlTrace({
          context,
          intent: userPrompt,
          planner: "deterministic_tool",
          risk: "low",
          operation: summarizeContentTransformPlan(deterministicPlan),
          status: "applied",
          reason: "The request matched a controlled report-content transform tool.",
          validation: [
            `${executed.actions.length} controlled action${executed.actions.length === 1 ? "" : "s"} returned.`,
            "Undo snapshot is captured before the UI applies the action.",
          ],
        }),
      };
    }
  }

  if (!aiStatus.configured) {
    return null;
  }

  try {
    const response = await runStructuredCodexJob({
      prompt: buildContentTransformPlanningPrompt(context, userPrompt, conversationHistory),
      schema: CONTENT_TRANSFORM_PLAN_SCHEMA,
    });
    const validated = executeContentTransformPlan(context, response.parsed);
    if (!validated) {
      return null;
    }

    return {
      reply: buildPendingContentTransformReply(response.parsed, validated),
      actions: [],
      providerCode: "codex_content_transform",
      modelId: response.aiStatus.modelId,
      usedLiveModel: true,
      fallbackReason: null,
      pendingConfirmation: buildPendingContentTransformConfirmation(response.parsed),
      controlTrace: buildControlTrace({
        context,
        intent: userPrompt,
        planner: "structured_planner",
        risk: "medium",
        operation: summarizeContentTransformPlan(response.parsed),
        status: "needs_confirmation",
        reason: "LAIQ AI Engine planned a feasible non-hardcoded edit and is waiting for user confirmation.",
        validation: [
          `${validated.actions.length} controlled action${validated.actions.length === 1 ? "" : "s"} validated without mutating the draft.`,
          "The saved plan will be executed only if the user confirms.",
        ],
        userConfirmationRequired: true,
        undoSnapshot: true,
      }),
    };
  } catch {
    return null;
  }
}

function executePendingContentTransformConfirmation({
  context,
  normalizedPrompt,
  conversationHistory = [],
}) {
  const pendingConfirmation = findLastPendingContentTransformConfirmation(conversationHistory);
  if (!pendingConfirmation) {
    return null;
  }

  if (isNegativeChatRequest(normalizedPrompt)) {
    return {
      reply: "Cancelled the pending LAIQ AI Engine edit. No report content was changed.",
      actions: [],
      providerCode: "deterministic_control_guard",
      modelId: null,
      usedLiveModel: false,
      fallbackReason: "The user declined the pending generated-content edit.",
      controlTrace: buildControlTrace({
        context,
        intent: normalizedPrompt,
        planner: "clarification_guard",
        risk: "low",
        operation: pendingConfirmation.operation,
        status: "blocked",
        reason: "User cancelled the pending edit before any tool was run.",
        validation: ["No report content was changed."],
        undoSnapshot: false,
      }),
    };
  }

  if (!isAffirmativeChatRequest(normalizedPrompt)) {
    return null;
  }

  const plan = pendingConfirmation.args?.plan;
  const executed = executeContentTransformPlan(context, plan);
  if (!executed) {
    return {
      reply: "I could not safely apply the saved edit plan. No report content was changed.",
      actions: [],
      providerCode: "deterministic_control_guard",
      modelId: null,
      usedLiveModel: false,
      fallbackReason: "The saved edit plan did not pass current draft validation.",
      controlTrace: buildControlTrace({
        context,
        intent: normalizedPrompt,
        planner: "fallback_guard",
        risk: "blocked",
        operation: pendingConfirmation.operation,
        status: "blocked",
        reason: "The saved plan could not be validated against the current generated output.",
        validation: ["No report content was changed."],
        undoSnapshot: false,
        alternative: "Regenerate the section or ask LAIQ AI Engine for a narrower edit.",
      }),
    };
  }

  return {
    ...executed,
    providerCode: "codex_content_transform",
    modelId: null,
    usedLiveModel: false,
    fallbackReason: "Applied the previously confirmed LAIQ AI Engine edit plan.",
    controlTrace: buildControlTrace({
      context,
      intent: normalizedPrompt,
      planner: "structured_planner",
      risk: pendingConfirmation.risk ?? "medium",
      operation: pendingConfirmation.operation,
      status: "applied",
      reason: "User confirmed the saved LAIQ AI Engine edit plan.",
      validation: [
        `${executed.actions.length} controlled action${executed.actions.length === 1 ? "" : "s"} returned.`,
        "Undo snapshot is captured before the UI applies the action.",
      ],
      undoSnapshot: true,
    }),
  };
}

function buildControlTrace({
  context,
  intent,
  planner,
  risk,
  operation,
  status,
  reason,
  validation = [],
  guardrails = [],
  userConfirmationRequired = false,
  undoSnapshot = true,
  alternative = null,
}) {
  const defaultGuardrails = [
    "Preserve LAIQ inspection app facts unless the user explicitly edits report wording.",
    "Do not invent measurements, inspection values, client names, dates, or recommendations.",
    "Keep generated content aligned with approved report templates and API-standard guardrails.",
  ];

  return {
    intent: String(intent ?? "").trim().slice(0, 300),
    planner,
    risk,
    target: context?.template?.title ?? context?.sectionId ?? "Selected report section",
    operation: String(operation ?? "none"),
    status,
    guardrails: guardrails.length > 0 ? guardrails : defaultGuardrails,
    validation: validation.length > 0 ? validation : ["No unsafe operation was reported."],
    userConfirmationRequired,
    undoSnapshot,
    reason: String(reason ?? "").trim() || "Controlled LAIQ AI Engine pathway selected.",
    ...(alternative ? { alternative } : {}),
  };
}

function buildPendingContentTransformReply(plan, validated) {
  const operationSummary = summarizeContentTransformPlan(plan);
  const actionCount = Array.isArray(validated?.actions) ? validated.actions.length : 0;
  const baseReply = String(plan?.reply ?? "").trim();
  const claimsAlreadyChanged = /\b(applied|changed|updated|replaced|formatted|rebuilt|converted)\b/i.test(baseReply);
  const intro = baseReply && !claimsAlreadyChanged
    ? baseReply
    : "I found a feasible edit path for this generated section.";

  return `${intro}\n\nPlanned operation: ${operationSummary}.\nValidation: ${actionCount} controlled action${actionCount === 1 ? "" : "s"} can be produced without changing app-sourced facts.\n\nPlease click Apply to run this edit, or Cancel to leave the section unchanged.`;
}

function buildPendingContentTransformConfirmation(plan) {
  const operationSummary = summarizeContentTransformPlan(plan);
  return {
    confirmationId: randomUUID(),
    label: "Confirm generated-content edit",
    summary: `Apply planned operation: ${operationSummary}. An undo snapshot will be kept before the draft changes.`,
    risk: "medium",
    operation: operationSummary,
    args: {
      plan,
    },
  };
}

function summarizeContentTransformPlan(plan) {
  const operations = Array.isArray(plan?.operations) ? plan.operations : [];
  const labels = operations
    .map((operation) => {
      const op = String(operation?.op ?? "").trim();
      const scope = String(operation?.styleScope ?? "").trim();
      return op === "apply_text_style" && scope ? `${op}(${scope})` : op;
    })
    .filter(Boolean);
  if (labels.length === 0) {
    return "none";
  }
  return [...new Set(labels)].join(", ");
}

function findLastPendingContentTransformConfirmation(conversationHistory = []) {
  const lastAssistantMessage = [...conversationHistory]
    .reverse()
    .find((message) => message?.role === "assistant");
  const pending = normalizePendingConfirmation(lastAssistantMessage?.pendingConfirmation);
  return pending?.args?.plan && pending.operation ? pending : null;
}

function buildContentTransformPlanningPrompt(context, userPrompt, conversationHistory = []) {
  const promptContext = {
    section: {
      id: context.sectionId,
      title: context.template.title,
      kind: context.template.kind,
      templateExpectation: context.template.templateExpectation,
    },
    currentDraft: String(context.currentDraft ?? "").slice(0, 18000),
    reportBlocks: buildReportBlockManifest(context.currentDraft, { sectionId: context.sectionId }),
    toolRegistry: buildContentTransformToolRegistry(context),
    editableActions: buildEditableActionContext(context),
    requiredManualInputs: buildRequiredManualInputState(context),
    importedFacts: buildImportedFactsSummary(context.exportPackage),
    inspectionWideContext: buildInspectionWideContext(context.exportPackage),
    conversationHistory,
    toolRules: [
      "Return operations only when the requested change can be applied to the current generated section draft.",
      "Prefer exact replace_text for wording changes that name the text to change.",
      "Use replace_section_content only when rebuilding a complete safe HTML block is necessary.",
      "For table-only style requests, return apply_text_style with styleScope='table' and a table targetBlockId.",
      "For tables, preserve imported app facts and existing rows unless the user explicitly asks for a presentation-only change.",
      "Do not invent inspection values, dates, names, measurements, or recommendations.",
      "If the request is unclear, return an empty operations array and ask one follow-up in reply.",
    ],
  };

  return `You are the LAIQ report content transform planner.

Plan concrete edit operations for the selected generated report section.
You are not writing a chat-only answer: every completed edit must be represented as an operation.
Never claim that the UI changed unless an operation is returned.
Preserve LAIQ inspection app facts and report table structure unless the user explicitly asks for presentation changes.

Allowed operation types:
- replace_text: exact text replacement inside the current draft.
- replace_block_content: replace one block from reportBlocks by targetBlockId.
- set_checklist_marker: checklist selected-response marker only.
- replace_section_content: complete replacement HTML using safe report tags.
- apply_text_style: presentation styling only. Use styleScope="table" for table contents/cells, otherwise styleScope="section".

Use targetBlockId whenever the operation is scoped to a visible block.
Do not use replace_section_content if replace_text or replace_block_content can satisfy the request.

Return JSON matching the provided schema.

Context:
${JSON.stringify(promptContext, null, 2)}

User request:
${userPrompt}
`;
}

function isPotentialContentTransformRequest(query, conversationHistory = []) {
  const normalized = String(query ?? "").trim().toLowerCase();
  if (!normalized) return false;

  if (isAmbiguousChatRequest(normalized) && !lastAssistantOfferedContentTransform(conversationHistory)) {
    return false;
  }

  if (isAffirmativeChatRequest(normalized) && lastAssistantOfferedContentTransform(conversationHistory)) {
    return true;
  }

  return [
    "apply",
    "change",
    "convert",
    "edit",
    "format",
    "bold",
    "enlarge",
    "increase",
    "make",
    "marker",
    "replace",
    "rewrite",
    "style",
    "switch",
    "update",
    "use",
  ].some((keyword) => hasKeyword(normalized, keyword));
}

function lastAssistantOfferedContentTransform(conversationHistory = []) {
  const lastAssistantMessage = [...conversationHistory]
    .reverse()
    .find((message) => message.role === "assistant");
  if (!lastAssistantMessage) return false;

  if (normalizePendingConfirmation(lastAssistantMessage.pendingConfirmation)) {
    return true;
  }

  const content = String(lastAssistantMessage.content ?? "").toLowerCase();
  return (
    content.includes("replace") ||
    content.includes("apply") ||
    content.includes("applied") ||
    content.includes("edit") ||
    content.includes("updated") ||
    content.includes("change")
  );
}

function buildContentTransformToolRegistry(context) {
  const blocks = buildReportBlockManifest(context.currentDraft, { sectionId: context.sectionId });
  const tools = [
    {
      toolName: "text.replaceExact",
      operations: ["replace_text"],
      description: "Replace exact visible wording in the current generated output.",
      requiresTargetBlock: false,
      guardrail: "Preserves all non-matching content.",
    },
    {
      toolName: "block.replace",
      operations: ["replace_block_content"],
      description: "Replace one generated content block by targetBlockId.",
      requiresTargetBlock: true,
      guardrail: "Replacement must preserve protected table/map structures when targeting protected blocks.",
    },
    {
      toolName: "section.applyStyle",
      operations: ["apply_text_style"],
      description: "Apply whole-section visual styling.",
      requiresTargetBlock: false,
      guardrail: "Does not change underlying report facts.",
    },
    {
      toolName: "table.applyStyle",
      operations: ["apply_text_style"],
      description: "Apply visual styling only to generated report table cells.",
      requiresTargetBlock: true,
      guardrail: "Changes presentation only; table rows and app-sourced values are preserved.",
    },
  ];

  if (context.sectionId === "tank-inspection-checklist") {
    tools.push({
      toolName: "checklist.setMarker",
      operations: ["set_checklist_marker"],
      description: "Change the selected-response marker while rebuilding rows from app checklist data.",
      requiresTargetBlock: false,
      guardrail: "Checklist item names and selected response positions stay sourced from app export.",
    });
  }

  if (getMeasurementTableScope(context.sectionId)) {
    tools.push({
      toolName: "measurement.tableFormatter",
      operations: [],
      description: "Measurement table rebuilds, stats, and column widths are handled by the deterministic table formatter before this planner.",
      requiresTargetBlock: false,
      guardrail: "UT readings remain sourced from app export.",
    });
  }

  return {
    blockCount: blocks.length,
    tools,
  };
}

function buildDeterministicContentTransformPlan(context, userPrompt, normalizedPrompt, conversationHistory = []) {
  if (context.sectionId === "tank-inspection-checklist" && isChecklistMarkerFormatRequest(normalizedPrompt, conversationHistory)) {
    const markerPlan = buildChecklistMarkerPlan(normalizedPrompt);
    return {
      reply: `Changed the checklist selected-response marker to ${markerPlan.label}.`,
      operations: [
        {
          op: "set_checklist_marker",
          targetBlockId: findFirstReportBlockId(context, "checklist_table"),
          reason: `User requested checklist selected-response marker style: ${markerPlan.label}.`,
          findText: null,
          replaceWith: null,
          replaceAll: null,
          marker: markerPlan.marker,
          markerLabel: markerPlan.label,
          contentHtml: null,
          fontFamily: null,
          fontSize: null,
          fontWeight: null,
          textAlign: null,
          color: null,
        },
      ],
    };
  }

  const replacement = parseSimpleTextReplacement(userPrompt);
  if (replacement && String(context.currentDraft ?? "").includes(replacement.findText)) {
    return {
      reply: `Replaced "${replacement.findText}" with "${replacement.replaceWith}" in the generated section draft.`,
      operations: [
        {
          op: "replace_text",
          targetBlockId: findReportBlockIdContainingText(context, replacement.findText),
          reason: "User requested an exact text replacement in the generated report content.",
          findText: replacement.findText,
          replaceWith: replacement.replaceWith,
          replaceAll: true,
          marker: null,
          markerLabel: null,
          contentHtml: null,
          fontFamily: null,
          fontSize: null,
          fontWeight: null,
          textAlign: null,
          color: null,
        },
      ],
    };
  }

  const styleQuery = resolveConfirmedStyleQuery(context, normalizedPrompt, conversationHistory) ?? normalizedPrompt;
  const stylePlan = buildPresentationStylePlan(context, styleQuery);
  if (stylePlan) {
    const scopeLabel = stylePlan.styleScope === "table" ? "table-content" : "whole-section";
    return {
      reply: `Applied the requested ${scopeLabel} style control to the generated report draft.`,
      operations: [stylePlan],
    };
  }

  return null;
}

function executeContentTransformPlan(context, plan) {
  const operations = Array.isArray(plan?.operations) ? plan.operations : [];
  if (operations.length === 0) {
    return null;
  }

  let content = String(context.currentDraft ?? "");
  const actions = [];
  const appliedReasons = [];

  for (const operation of operations) {
    const op = String(operation?.op ?? "");
    if (op === "set_checklist_marker") {
      if (context.sectionId !== "tank-inspection-checklist") continue;
      const marker = normalizeChecklistMarker(operation.marker);
      content = buildChecklistTableHtml(context.exportPackage, {
        balancedColumns: true,
        columnWidths: extractChecklistColumnWidths(content),
        responseMarker: marker.marker,
      });
      appliedReasons.push(operation.reason || `Set checklist marker to ${marker.label}.`);
    } else if (op === "replace_text") {
      const next = applyExactTextReplacement(content, operation, context);
      if (next !== content) {
        content = next;
        appliedReasons.push(operation.reason || "Applied exact text replacement.");
      }
    } else if (op === "replace_block_content") {
      const nextBlockHtml = String(operation.contentHtml ?? "").trim();
      const targetBlockId = String(operation.targetBlockId ?? "").trim();
      if (!targetBlockId || !nextBlockHtml || hasUnsafeTransformHtml(nextBlockHtml)) {
        continue;
      }

      const targetBlock = findReportBlock(content, targetBlockId, { sectionId: context.sectionId });
      if (!targetBlock || !isReplacementAllowedForBlock(targetBlock, nextBlockHtml)) {
        continue;
      }

      const next = replaceReportBlockContent(content, targetBlockId, nextBlockHtml, {
        sectionId: context.sectionId,
      });
      if (next !== content) {
        content = next;
        appliedReasons.push(operation.reason || `Replaced ${targetBlock.label}.`);
      }
    } else if (op === "replace_section_content") {
      const next = String(operation.contentHtml ?? "").trim();
      if (next && next !== content && !hasUnsafeTransformHtml(next)) {
        content = markPredictedContent(next, context);
        appliedReasons.push(operation.reason || "Replaced generated section content.");
      }
    } else if (op === "apply_text_style") {
      actions.push(buildAssistantAction({
        type: "apply_text_style",
        label: operation.styleScope === "table" ? "Apply table formatting" : "Apply whole-section formatting",
        reason: operation.reason || "User requested report formatting.",
        fontFamily: operation.fontFamily,
        fontSize: operation.fontSize,
        fontWeight: operation.fontWeight,
        textAlign: operation.textAlign,
        color: operation.color,
        styleScope: operation.styleScope,
        targetBlockId: operation.targetBlockId,
      }));
      appliedReasons.push(operation.reason || "Applied style action.");
    }
  }

  if (content !== String(context.currentDraft ?? "")) {
    const validation = validateContentTransformResult(context, content);
    if (!validation.ok) {
      return null;
    }
    actions.unshift(buildAssistantAction({
      type: "replace_section_content",
      label: "Apply generated-content edit",
      reason: appliedReasons.join(" ") || "Applied controlled content transform.",
      contentHtml: content,
    }));
  }

  if (actions.length === 0) {
    return null;
  }

  return {
    reply:
      String(plan.reply ?? "").trim() ||
      "Applied the requested controlled edit to the generated report content.",
    actions,
  };
}

function buildAssistantAction({
  type,
  label,
  reason,
  contentHtml = null,
  fontFamily = null,
  fontSize = null,
  fontWeight = null,
  textAlign = null,
  color = null,
  styleScope = null,
  targetBlockId = null,
  markerId = null,
  deltaX = null,
  deltaY = null,
  plateId = null,
  widthDelta = null,
  heightDelta = null,
}) {
  return {
    id: randomUUID(),
    type,
    label,
    reason,
    contentHtml,
    fontFamily,
    fontSize,
    fontWeight,
    textAlign,
    color,
    styleScope,
    targetBlockId,
    markerId,
    deltaX,
    deltaY,
    plateId,
    widthDelta,
    heightDelta,
  };
}

function parseSimpleTextReplacement(query) {
  const patterns = [
    /\b(?:replace|change|switch)\s+["“](.+?)["”]\s+(?:to|with)\s+["“](.+?)["”]/i,
    /\b(?:replace|change|switch)\s+'(.+?)'\s+(?:to|with)\s+'(.+?)'/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(String(query ?? ""));
    if (match) {
      const findText = cleanReplacementText(match[1]);
      const replaceWith = cleanReplacementText(match[2]);
      if (findText && replaceWith && findText !== replaceWith) {
        return { findText, replaceWith };
      }
    }
  }

  return null;
}

function cleanReplacementText(value) {
  return String(value ?? "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function applyExactTextReplacement(content, operation, context) {
  const findText = String(operation.findText ?? "");
  const replaceWith = String(operation.replaceWith ?? "");
  if (!findText || findText === replaceWith) return content;

  const targetBlockId = String(operation.targetBlockId ?? "").trim();
  if (targetBlockId) {
    const targetBlock = findReportBlock(content, targetBlockId, { sectionId: context.sectionId });
    if (!targetBlock) return content;

    const currentBlockHtml = targetBlock.html ?? targetBlock.htmlPreview;
    const nextBlockHtml = applyExactTextReplacementToHtml(currentBlockHtml, {
      findText,
      replaceWith,
      replaceAll: operation.replaceAll,
    });
    if (nextBlockHtml === currentBlockHtml || !isReplacementAllowedForBlock(targetBlock, nextBlockHtml)) {
      return content;
    }

    return replaceReportBlockContent(content, targetBlockId, nextBlockHtml, {
      sectionId: context.sectionId,
    });
  }

  return applyExactTextReplacementToHtml(content, operation);
}

function applyExactTextReplacementToHtml(content, operation) {
  const findText = String(operation.findText ?? "");
  const replaceWith = String(operation.replaceWith ?? "");
  if (!findText || findText === replaceWith) return content;

  const replaceAll = operation.replaceAll !== false;
  if (content.includes(findText)) {
    return replaceAll ? content.split(findText).join(replaceWith) : content.replace(findText, replaceWith);
  }

  const escapedFindText = escapeHtml(findText);
  const escapedReplaceWith = escapeHtml(replaceWith);
  if (content.includes(escapedFindText)) {
    return replaceAll
      ? content.split(escapedFindText).join(escapedReplaceWith)
      : content.replace(escapedFindText, escapedReplaceWith);
  }

  return content;
}

function findFirstReportBlockId(context, blockType) {
  return buildReportBlockManifest(context.currentDraft, { sectionId: context.sectionId })
    .find((block) => block.blockType === blockType)?.blockId ?? null;
}

function findReportBlockIdContainingText(context, text) {
  const needle = String(text ?? "").trim();
  if (!needle) return null;

  const escapedNeedle = escapeHtml(needle);
  return buildReportBlockManifest(context.currentDraft, { sectionId: context.sectionId })
    .find((block) => block.htmlPreview.includes(needle) || block.htmlPreview.includes(escapedNeedle))
    ?.blockId ?? null;
}

function hasUnsafeTransformHtml(content) {
  return /<\s*(script|iframe|object|embed|link|meta)\b/i.test(content) ||
    /\son[a-z]+\s*=/i.test(content) ||
    /javascript\s*:/i.test(content);
}

function isReplacementAllowedForBlock(block, nextBlockHtml) {
  const next = String(nextBlockHtml ?? "");
  if (!next.trim() || hasUnsafeTransformHtml(next)) return false;

  if (block.blockType === "measurement_table") {
    return next.includes("report-measurement-table") || next.includes("measurement-report-table");
  }

  if (block.blockType === "checklist_table") {
    return next.includes("checklist-report-table");
  }

  if (block.blockType === "layout_figure") {
    return next.includes("layout") || next.includes("figure");
  }

  return true;
}

function normalizeChecklistMarker(marker) {
  const normalized = String(marker ?? "").trim().toLowerCase();
  if (
    normalized === "x" ||
    normalized === "×" ||
    normalized === "✕" ||
    normalized === "✖" ||
    normalized === "cross"
  ) {
    return { marker: "×", label: "cross" };
  }
  if (
    normalized === "✓" ||
    normalized === "✔" ||
    normalized === "tick" ||
    normalized === "check" ||
    normalized === "checkmark"
  ) {
    return { marker: "✓", label: "tick" };
  }
  if (
    normalized === "●" ||
    normalized === "•" ||
    normalized === "dot" ||
    normalized === "bullet" ||
    normalized === "filled dot"
  ) {
    return { marker: CHECKLIST_DEFAULT_RESPONSE_MARKER, label: "filled dot" };
  }

  return { marker: CHECKLIST_DEFAULT_RESPONSE_MARKER, label: "filled dot" };
}

function resolveConfirmedStyleQuery(context, query, conversationHistory = []) {
  if (!isAffirmativeChatRequest(query) || !lastAssistantOfferedContentTransform(conversationHistory)) {
    return null;
  }

  const messages = Array.isArray(conversationHistory) ? conversationHistory : [];
  const lastAssistantIndex = [...messages]
    .map((message, index) => ({ message, index }))
    .reverse()
    .find(({ message }) => message.role === "assistant")?.index;

  if (lastAssistantIndex == null) {
    return null;
  }

  const previousUser = messages
    .slice(0, lastAssistantIndex)
    .reverse()
    .find((message) => message.role === "user");

  const combined = [
    previousUser?.content,
    messages[lastAssistantIndex]?.content,
  ].filter(Boolean).join(" ").toLowerCase();

  return buildPresentationStylePlan(context, combined) ? combined : null;
}

function buildPresentationStylePlan(context, query) {
  if (!/\b(style|format|font|align|center|left|larger|bigger|enlarge|increase|smaller|bold|red|blue)\b/i.test(query)) {
    return null;
  }

  const styleScope = resolveRequestedStyleScope(query);
  const targetBlockId = styleScope === "table" ? findFirstTableReportBlockId(context) : null;

  return {
    op: "apply_text_style",
    targetBlockId,
    reason: styleScope === "table"
      ? "User requested table-content presentation styling."
      : "User requested whole-section presentation styling.",
    findText: null,
    replaceWith: null,
    replaceAll: null,
    marker: null,
    markerLabel: null,
    contentHtml: null,
    fontFamily: query.includes("georgia")
      ? "Georgia, serif"
      : query.includes("consolas")
        ? "Consolas, monospace"
        : query.includes("arial")
          ? "Arial, sans-serif"
          : "Aptos, 'Segoe UI', sans-serif",
    fontSize: resolveRequestedFontSize(query),
    fontWeight: query.includes("bold") ? "bold" : null,
    textAlign: query.includes("center") ? "center" : query.includes("left") ? "left" : null,
    color: query.includes("red") ? "#ef4c57" : query.includes("blue") ? "#0d4f90" : null,
    styleScope,
  };
}

function resolveRequestedStyleScope(query) {
  const normalized = String(query ?? "").toLowerCase();
  if (
    normalized.includes("table content") ||
    normalized.includes("table contents") ||
    normalized.includes("table text") ||
    normalized.includes("table font") ||
    normalized.includes("inside the table") ||
    normalized.includes("of the table") ||
    (normalized.includes("table") && !normalized.includes("whole section"))
  ) {
    return "table";
  }

  return "section";
}

function findFirstTableReportBlockId(context) {
  return (
    findFirstReportBlockId(context, "checklist_table") ||
    findFirstReportBlockId(context, "measurement_table") ||
    findFirstReportBlockId(context, "table")
  );
}

function resolveRequestedFontSize(query) {
  if (query.includes("smaller") || query.includes("reduce")) return "14px";
  if (/\b(two|2)\s+(?:font\s+)?sizes?\b/i.test(query)) return "20px";
  if (/\b(three|3)\s+(?:font\s+)?sizes?\b/i.test(query)) return "24px";
  if (query.includes("larger") || query.includes("bigger") || query.includes("enlarge") || query.includes("increase")) {
    return "18px";
  }
  return null;
}

function validateContentTransformResult(context, content) {
  const value = String(content ?? "").trim();
  if (!value) {
    return { ok: false, reason: "Transformed content is empty." };
  }

  if (getMeasurementTableScope(context.sectionId) && !value.includes("report-measurement-table")) {
    return {
      ok: false,
      reason: "Measurement transforms must preserve report measurement table structure.",
    };
  }

  if (context.sectionId === "tank-inspection-checklist" && !value.includes("checklist-report-table")) {
    return {
      ok: false,
      reason: "Checklist transforms must preserve checklist table structure.",
    };
  }

  return { ok: true, reason: null };
}

function isHandledByExistingDeterministicFormatter(context, query, conversationHistory = []) {
  if (context.sectionId === "tank-inspection-checklist") {
    if (isChecklistTableFormatRequest(query)) return true;
    if (
      isAffirmativeChatRequest(query) &&
      lastAssistantOfferedChecklistTableFormatting(conversationHistory)
    ) {
      return true;
    }
  }

  const measurementScope = getMeasurementTableScope(context.sectionId);
  if (measurementScope) {
    return (
      isMeasurementColumnFormatRequest(query, measurementScope) ||
      isMeasurementTableRequest(query) ||
      isMeasurementEvidenceQuestion(query)
    );
  }

  return false;
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
        ? `I may be missing the exact target from your last instruction. Are you asking me to refine the wording, adjust report formatting, or explain the locked LAIQ app layout map behavior for ${context.template.title}?`
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
          ? `This section uses the imported ${surfaceLabel} workspace. I can help rewrite the legend or propose controlled marker or plate adjustments while the LAIQ app baseline geometry remains intact.`
          : supportingSurfaceLabel
            ? `This report section is a measurement table, but it uses the imported ${supportingSurfaceLabel} layout map as supporting location evidence in the lower workspace. The map shows where items like nozzles or plates are located; the numeric table values come from LAIQ app exported UT measurement rows.`
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

  maybePushTextStyleAction(actions, context, query);

  if (actions.length > 0) {
    return {
      reply: `I prepared a controlled formatting action for ${context.template.title}. It updates only the report-platform draft presentation layer; the LAIQ app export evidence remains unchanged.`,
      actions,
    };
  }

  return {
    reply: `I can help, but I need a more specific instruction before changing ${context.template.title}. Should I refine the report wording, apply a formatting change, review missing inputs, or inspect the layout-map evidence?`,
    actions,
  };
}

function buildChecklistTableFormatReply(context, query, conversationHistory = []) {
  if (context.sectionId !== "tank-inspection-checklist") {
    return null;
  }

  const requestedDirectly = isChecklistTableFormatRequest(query);
  const confirmedPriorOffer =
    isAffirmativeChatRequest(query) &&
    lastAssistantOfferedChecklistTableFormatting(conversationHistory);

  if (!requestedDirectly && !confirmedPriorOffer) {
    return null;
  }

  const columnPlan = buildChecklistColumnWidthPlan(context, query);
  const contentHtml = buildChecklistTableHtml(context.exportPackage, {
    balancedColumns: true,
    columnWidths: columnPlan.widths,
    responseMarker: extractChecklistResponseMarker(context.currentDraft),
  });

  return {
    reply: [
      `Applied checklist table column widths: No. ${columnPlan.widths.number}px, Inspection Item ${columnPlan.widths.item}px, response columns ${columnPlan.widths.response}px.`,
      columnPlan.summary,
      "I rebuilt the table from the LAIQ inspection app export so the checklist item names and selected responses stay grounded in field data.",
    ].filter(Boolean).join(" "),
    actions: [
      {
        id: randomUUID(),
        type: "replace_section_content",
        label: "Apply checklist table column widths",
        reason: `User requested checklist table column sizing: ${columnPlan.summary}`,
        contentHtml,
        fontFamily: null,
        fontSize: null,
        fontWeight: null,
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

function buildChecklistMarkerFormatReply(context, query, conversationHistory = []) {
  if (
    context.sectionId !== "tank-inspection-checklist" ||
    !isChecklistMarkerFormatRequest(query, conversationHistory)
  ) {
    return null;
  }

  const markerPlan = buildChecklistMarkerPlan(query);
  const contentHtml = buildChecklistTableHtml(context.exportPackage, {
    balancedColumns: true,
    columnWidths: extractChecklistColumnWidths(context.currentDraft),
    responseMarker: markerPlan.marker,
  });

  return {
    reply: [
      `Changed the checklist selected-response marker to ${markerPlan.label}.`,
      "I rebuilt the checklist table from the LAIQ inspection app export, preserving item names, selected responses, and current column widths.",
    ].join(" "),
    actions: [
      {
        id: randomUUID(),
        type: "replace_section_content",
        label: `Use ${markerPlan.label} checklist marker`,
        reason: `User requested checklist selected-response marker style: ${markerPlan.label}.`,
        contentHtml,
        fontFamily: null,
        fontSize: null,
        fontWeight: null,
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

const CHECKLIST_DEFAULT_RESPONSE_MARKER = "●";

function buildChecklistMarkerPlan(query) {
  const normalized = String(query ?? "").toLowerCase();
  if (
    normalized.includes("cross") ||
    normalized.includes("×") ||
    normalized.includes("✕") ||
    normalized.includes("✖") ||
    /(?:^|\s|["'`])x(?:$|\s|["'`.,!?])/.test(normalized) ||
    /\bto\s+x\b/.test(normalized)
  ) {
    return { marker: "×", label: "cross" };
  }
  if (normalized.includes("tick") || normalized.includes("check") || normalized.includes("✓") || normalized.includes("✔")) {
    return { marker: "✓", label: "tick" };
  }
  if (normalized.includes("dot") || normalized.includes("bullet") || normalized.includes("●") || normalized.includes("•")) {
    return { marker: CHECKLIST_DEFAULT_RESPONSE_MARKER, label: "filled dot" };
  }

  return { marker: "✓", label: "tick" };
}

const CHECKLIST_DEFAULT_WIDTHS = {
  number: 46,
  item: 560,
  response: 42,
};

const CHECKLIST_WIDTH_LIMITS = {
  number: { min: 40, max: 70 },
  item: { min: 300, max: 760 },
  response: { min: 34, max: 76 },
};

function buildChecklistColumnWidthPlan(context, query) {
  const currentWidths = extractChecklistColumnWidths(context.currentDraft);
  const widths = {
    number: currentWidths.number ?? CHECKLIST_DEFAULT_WIDTHS.number,
    item: currentWidths.item ?? CHECKLIST_DEFAULT_WIDTHS.item,
    response: currentWidths.response ?? CHECKLIST_DEFAULT_WIDTHS.response,
  };
  const normalized = String(query ?? "").toLowerCase();
  const percent = parsePercentage(normalized);
  const pixelValue = parsePixelValue(normalized);
  const target = normalized.includes("response")
    ? "response"
    : normalized.includes("item") || normalized.includes("inspection item")
      ? "item"
      : null;
  const decrease = /reduc|decreas|narrow|small|shrink|less/.test(normalized);
  const increase = /increas|wider|larger|bigger|expand|more/.test(normalized);
  const changes = [];

  if (target && pixelValue != null) {
    widths[target] = clampInteger(pixelValue, CHECKLIST_WIDTH_LIMITS[target].min, CHECKLIST_WIDTH_LIMITS[target].max);
    changes.push(`${target === "item" ? "Inspection Item" : "response"} column set to ${widths[target]}px`);
  } else if (target && percent != null && (decrease || increase)) {
    const factor = decrease ? 1 - percent / 100 : 1 + percent / 100;
    widths[target] = clampInteger(
      Math.round(widths[target] * factor),
      CHECKLIST_WIDTH_LIMITS[target].min,
      CHECKLIST_WIDTH_LIMITS[target].max,
    );
    changes.push(
      `${target === "item" ? "Inspection Item" : "response"} column ${decrease ? "reduced" : "increased"} by ${percent}%`,
    );
  } else if (target === "item" && decrease) {
    widths.item = clampInteger(Math.round(widths.item * 0.9), CHECKLIST_WIDTH_LIMITS.item.min, CHECKLIST_WIDTH_LIMITS.item.max);
    changes.push("Inspection Item column reduced by 10%");
  } else if (target === "item" && increase) {
    widths.item = CHECKLIST_DEFAULT_WIDTHS.item;
    changes.push("Inspection Item column reset to the wider default");
  } else if (target === "response" && decrease) {
    widths.response = CHECKLIST_DEFAULT_WIDTHS.response;
    changes.push("response columns reset to the narrow default");
  }

  if (changes.length === 0) {
    widths.number = CHECKLIST_DEFAULT_WIDTHS.number;
    widths.item = CHECKLIST_DEFAULT_WIDTHS.item;
    widths.response = CHECKLIST_DEFAULT_WIDTHS.response;
    changes.push("applied default balanced checklist layout");
  }

  return {
    widths,
    summary: changes.join("; "),
  };
}

function extractChecklistColumnWidths(content) {
  const value = String(content ?? "");
  return {
    number: extractFirstColumnWidth(value, /class="checklist-number-heading"[^>]*colwidth="(\d+)"/i) ??
      extractFirstColumnWidth(value, /class="checklist-item-number"[^>]*colwidth="(\d+)"/i),
    item: extractFirstColumnWidth(value, /class="checklist-item-heading"[^>]*colwidth="(\d+)"/i) ??
      extractFirstColumnWidth(value, /class="checklist-item-prompt"[^>]*colwidth="(\d+)"/i),
    response: extractFirstColumnWidth(value, /class="checklist-response-heading"[^>]*colwidth="(\d+)"/i) ??
      extractFirstColumnWidth(value, /class="checklist-response-cell"[^>]*colwidth="(\d+)"/i),
  };
}

function extractChecklistResponseMarker(content) {
  const value = String(content ?? "");
  const markerMatch = /class="[^"]*checklist-response-cell[^"]*"[^>]*>([^<]+)<\/td>/i.exec(value);
  const marker = markerMatch?.[1]?.trim();
  return marker || CHECKLIST_DEFAULT_RESPONSE_MARKER;
}

function extractFirstColumnWidth(value, regex) {
  const match = regex.exec(value);
  if (!match) return null;
  const width = Number.parseInt(match[1], 10);
  return Number.isFinite(width) ? width : null;
}

function parsePercentage(query) {
  const match = /(\d+(?:\.\d+)?)\s*%/.exec(query);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

function parsePixelValue(query) {
  const match = /(\d{2,4})\s*px/.exec(query);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}

function clampInteger(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function isChecklistTableFormatRequest(query) {
  const mentionsChecklistOrTable =
    query.includes("checklist") ||
    query.includes("table") ||
    query.includes("column") ||
    query.includes("columns");
  const mentionsItemColumn =
    query.includes("item column") ||
    query.includes("inspection item") ||
    query.includes("item should") ||
    query.includes("item wider") ||
    query.includes("item column width");
  const mentionsResponseColumn =
    query.includes("response column") ||
    query.includes("response columns") ||
    query.includes("response narrower") ||
    query.includes("narrower");
  const mentionsWidthChange =
    query.includes("wider") ||
    query.includes("narrower") ||
    query.includes("reduced") ||
    query.includes("reduce") ||
    query.includes("decrease") ||
    query.includes("smaller") ||
    query.includes("width") ||
    query.includes("format") ||
    /\d+(?:\.\d+)?\s*%/.test(query) ||
    /\d{2,4}\s*px/.test(query);

  return mentionsChecklistOrTable && mentionsWidthChange && (mentionsItemColumn || mentionsResponseColumn);
}

function isChecklistMarkerFormatRequest(query, conversationHistory = []) {
  const mentionsMarker =
    query.includes("marker") ||
    query.includes("glyph") ||
    query.includes("symbol") ||
    query.includes("dot") ||
    query.includes("tick") ||
    query.includes("check") ||
    query.includes("cross") ||
    query.includes("●") ||
    query.includes("✓") ||
    query.includes("✔") ||
    query.includes("×") ||
    query.includes("✕") ||
    query.includes("✖") ||
    /(?:^|\s|["'`])x(?:$|\s|["'`.,!?])/.test(query);
  const mentionsChecklistResponse =
    query.includes("checklist") ||
    query.includes("response") ||
    query.includes("selected") ||
    query.includes("answer") ||
    lastAssistantOfferedChecklistMarkerFormatting(conversationHistory);
  const asksForChange =
    query.includes("change") ||
    query.includes("replace") ||
    query.includes("switch") ||
    query.includes("use") ||
    query.includes("from") ||
    query.includes("to");

  return (
    mentionsMarker &&
    asksForChange &&
    (
      mentionsChecklistResponse ||
      query.includes("it") ||
      query.includes("rest should") ||
      query.includes("remain")
    )
  );
}

function lastAssistantOfferedChecklistMarkerFormatting(conversationHistory) {
  const lastAssistantMessage = [...conversationHistory]
    .reverse()
    .find((message) => message.role === "assistant");

  if (!lastAssistantMessage) {
    return false;
  }

  const content = lastAssistantMessage.content.toLowerCase();
  return (
    content.includes("checklist") &&
    content.includes("marker")
  );
}

function isAffirmativeChatRequest(query) {
  return [
    "yes",
    "y",
    "ok",
    "okay",
    "sure",
    "please",
    "please do",
    "do it",
    "apply",
    "confirm",
  ].includes(query.trim());
}

function isNegativeChatRequest(query) {
  return [
    "no",
    "n",
    "cancel",
    "stop",
    "do not",
    "don't",
    "dont",
    "leave it",
    "skip",
  ].includes(String(query ?? "").trim());
}

function lastAssistantOfferedChecklistTableFormatting(conversationHistory) {
  const lastAssistantMessage = [...conversationHistory]
    .reverse()
    .find((message) => message.role === "assistant");

  if (!lastAssistantMessage) {
    return false;
  }

  const content = lastAssistantMessage.content.toLowerCase();
  return (
    content.includes("checklist") &&
    content.includes("table") &&
    (
      content.includes("column width") ||
      content.includes("column widths") ||
      content.includes("wider") ||
      content.includes("narrower") ||
      content.includes("response column") ||
      content.includes("inspection item")
    )
  );
}

function buildMeasurementTableReply(context, query) {
  const measurementScope = getMeasurementTableScope(context.sectionId);
  if (!measurementScope) {
    return null;
  }

  const isColumnFormatRequest = isMeasurementColumnFormatRequest(query, measurementScope);
  if (!isMeasurementTableRequest(query) && !isColumnFormatRequest) {
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
  const columnPlan = buildMeasurementColumnWidthPlan(context, measurementScope, query, includeStats);
  const contentHtml = buildMeasurementTableHtml({
    sectionTitle: context.template.title,
    sectionNumber: getApiStandardTocSection(context.sectionId)?.number ?? "",
    rows,
    measurementScope,
    exportPackage: context.exportPackage,
    includeStats,
    columnWidths: columnPlan.widths,
  });
  const rowLabel =
    measurementScope.itemKind === "region"
      ? `${rows.length} ${measurementScope.rowLabel.toLowerCase()} rows`
      : `${rows.length} ${measurementScope.rowLabel.toLowerCase()} rows`;

  return {
    reply:
      `I prepared a real report table for ${context.template.title} using the ${rowLabel} exported from the LAIQ inspection app V3 package. ` +
      (includeStats ? "Min, Max, and Average columns are calculated from each row's exported readings. " : "") +
      (columnPlan.summary ? `${columnPlan.summary} ` : "") +
      "I did not add synthetic rows or pending plate numbers.",
    actions: [
      {
        id: randomUUID(),
        type: "replace_section_content",
        label: isColumnFormatRequest ? "Apply measurement table column widths" : "Replace with measurement table",
        reason: isColumnFormatRequest
          ? `User requested measurement table column sizing: ${columnPlan.summary}`
          : "User requested all section measurements in a sample-report-style table.",
        contentHtml,
        fontFamily: null,
        fontSize: null,
        fontWeight: null,
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
      reply: `I checked the LAIQ inspection app V3 export for ${context.template.title}, but no matching ${measurementScope.rowLabel.toLowerCase()} UT rows are available. In that case the draft must stay pending until the app export or an approved worksheet supplies the readings.`,
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
        ? "The current generated draft is stale/wrong because it says Pending confirmation even though matching LAIQ app exported UT rows exist. I prepared a replacement table from the export."
        : "The current draft should use these exported rows directly; no extra source-data field is required for these app-sourced measurements.",
    ].join(" "),
    actions: currentDraftLooksStale
      ? [
          {
            id: randomUUID(),
            type: "replace_section_content",
            label: "Replace stale pending table with exported measurements",
            reason: "The section has LAIQ app exported UT rows, so pending placeholders should be replaced.",
            contentHtml,
            fontFamily: null,
            fontSize: null,
            fontWeight: null,
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

const MEASUREMENT_DEFAULT_WIDTHS = {
  first: 120,
  size: 120,
  value: 72,
  stat: 76,
};

const MEASUREMENT_WIDTH_LIMITS = {
  first: { min: 80, max: 220 },
  size: { min: 90, max: 180 },
  value: { min: 48, max: 140 },
  stat: { min: 54, max: 140 },
};

function buildMeasurementColumnWidthPlan(context, measurementScope, query, includeStats) {
  const current = extractMeasurementColumnWidths(context.currentDraft, measurementScope, includeStats);
  const valueLabels = measurementScope.valueLabels;
  const widths = {
    first: current.first ?? MEASUREMENT_DEFAULT_WIDTHS.first,
    size: current.size ?? MEASUREMENT_DEFAULT_WIDTHS.size,
    values: valueLabels.map((label) => current.values[label] ?? MEASUREMENT_DEFAULT_WIDTHS.value),
    stats: includeStats ? ["Min", "Max", "Average"].map((label) => current.stats[label] ?? MEASUREMENT_DEFAULT_WIDTHS.stat) : [],
  };
  const normalized = String(query ?? "").toLowerCase();
  const percent = parsePercentage(normalized);
  const pixelValue = parsePixelValue(normalized);
  const mentionedValueIndexes = getMentionedMeasurementValueIndexes(normalized, valueLabels);
  const wantsEqualValueColumns =
    mentionedValueIndexes.length > 1 &&
    (normalized.includes("same") ||
      normalized.includes("equal") ||
      normalized.includes("align") ||
      normalized.includes("consistent"));
  const decrease = /reduc|decreas|narrow|small|shrink|less/.test(normalized);
  const increase = /increas|wider|larger|bigger|expand|more/.test(normalized);
  const changes = [];

  if (wantsEqualValueColumns) {
    const referenceIndexes = getReferenceValueIndexes(normalized, valueLabels);
    const referenceWidths = (referenceIndexes.length > 0 ? referenceIndexes : mentionedValueIndexes)
      .map((index) => widths.values[index])
      .filter((value) => Number.isFinite(value));
    const equalWidth = clampInteger(
      Math.round(referenceWidths.reduce((total, value) => total + value, 0) / Math.max(referenceWidths.length, 1)) ||
        MEASUREMENT_DEFAULT_WIDTHS.value,
      MEASUREMENT_WIDTH_LIMITS.value.min,
      MEASUREMENT_WIDTH_LIMITS.value.max,
    );

    widths.values = widths.values.map(() => equalWidth);
    changes.push(`${valueLabels.join(", ")} columns set to equal width ${equalWidth}px`);
  } else if (mentionedValueIndexes.length > 0 && pixelValue != null) {
    const nextWidth = clampInteger(pixelValue, MEASUREMENT_WIDTH_LIMITS.value.min, MEASUREMENT_WIDTH_LIMITS.value.max);
    for (const index of mentionedValueIndexes) {
      widths.values[index] = nextWidth;
    }
    changes.push(`${mentionedValueIndexes.map((index) => valueLabels[index]).join(", ")} column width set to ${nextWidth}px`);
  } else if (mentionedValueIndexes.length > 0 && percent != null && (decrease || increase)) {
    const factor = decrease ? 1 - percent / 100 : 1 + percent / 100;
    for (const index of mentionedValueIndexes) {
      widths.values[index] = clampInteger(
        Math.round(widths.values[index] * factor),
        MEASUREMENT_WIDTH_LIMITS.value.min,
        MEASUREMENT_WIDTH_LIMITS.value.max,
      );
    }
    changes.push(
      `${mentionedValueIndexes.map((index) => valueLabels[index]).join(", ")} column width ${decrease ? "reduced" : "increased"} by ${percent}%`,
    );
  } else if (normalized.includes("value") || valueLabels.some((label) => normalized.includes(label.toLowerCase()))) {
    const equalWidth = clampInteger(
      Math.round(widths.values.reduce((total, width) => total + width, 0) / widths.values.length),
      MEASUREMENT_WIDTH_LIMITS.value.min,
      MEASUREMENT_WIDTH_LIMITS.value.max,
    );
    widths.values = widths.values.map(() => equalWidth);
    changes.push(`${valueLabels.join(", ")} columns equalized to ${equalWidth}px`);
  }

  if (changes.length === 0) {
    changes.push(`${valueLabels.join(", ")} columns use the measurement-table template width ${MEASUREMENT_DEFAULT_WIDTHS.value}px`);
  }

  return {
    widths,
    summary: changes.join("; "),
  };
}

function extractMeasurementColumnWidths(content, measurementScope, includeStats) {
  const value = String(content ?? "");
  const values = Object.fromEntries(
    measurementScope.valueLabels.map((label) => [
      label,
      extractFirstColumnWidth(value, new RegExp(`class="[^"]*${escapeRegExp(measurementColumnClass(label))}[^"]*"[^>]*colwidth="(\\d+)"`, "i")),
    ]),
  );
  const stats = Object.fromEntries(
    (includeStats ? ["Min", "Max", "Average"] : []).map((label) => [
      label,
      extractFirstColumnWidth(value, new RegExp(`class="[^"]*${escapeRegExp(measurementColumnClass(label))}[^"]*"[^>]*colwidth="(\\d+)"`, "i")),
    ]),
  );

  return {
    first: extractFirstColumnWidth(value, /class="[^"]*measurement-first-column[^"]*"[^>]*colwidth="(\d+)"/i),
    size: extractFirstColumnWidth(value, /class="[^"]*measurement-size-column[^"]*"[^>]*colwidth="(\d+)"/i),
    values,
    stats,
  };
}

function getMentionedMeasurementValueIndexes(query, valueLabels) {
  const mentioned = valueLabels
    .map((label, index) => (mentionsMeasurementLabel(query, label) ? index : null))
    .filter((index) => index != null);

  const rangeMatch = /\b([a-z])\s*[-–]\s*([a-z])\b/i.exec(query);
  if (rangeMatch) {
    const start = valueLabels.findIndex((label) => label.toLowerCase() === rangeMatch[1].toLowerCase());
    const end = valueLabels.findIndex((label) => label.toLowerCase() === rangeMatch[2].toLowerCase());
    if (start >= 0 && end >= 0) {
      const [from, to] = start <= end ? [start, end] : [end, start];
      for (let index = from; index <= to; index += 1) {
        mentioned.push(index);
      }
    }
  }

  return [...new Set(mentioned)];
}

function getReferenceValueIndexes(query, valueLabels) {
  const sameAsMatch = /same\s+as\s+([a-z])\s*[-–]\s*([a-z])/i.exec(query);
  if (!sameAsMatch) return [];

  const start = valueLabels.findIndex((label) => label.toLowerCase() === sameAsMatch[1].toLowerCase());
  const end = valueLabels.findIndex((label) => label.toLowerCase() === sameAsMatch[2].toLowerCase());
  if (start < 0 || end < 0) return [];

  const [from, to] = start <= end ? [start, end] : [end, start];
  return Array.from({ length: to - from + 1 }, (_, offset) => from + offset);
}

function mentionsMeasurementLabel(query, label) {
  const normalizedLabel = String(label ?? "").toLowerCase();
  if (!normalizedLabel) return false;

  if (/^[a-z]$/i.test(normalizedLabel)) {
    return new RegExp(`\\b${escapeRegExp(normalizedLabel)}\\b`, "i").test(query);
  }

  return query.includes(normalizedLabel);
}

function isMeasurementColumnFormatRequest(query, measurementScope) {
  const mentionsColumn = query.includes("column") || query.includes("columns") || query.includes("width");
  const mentionsValueLabel = measurementScope.valueLabels.some((label) => mentionsMeasurementLabel(query, label));
  const mentionsTableSizingIntent =
    query.includes("same") ||
    query.includes("equal") ||
    query.includes("align") ||
    query.includes("consistent") ||
    query.includes("wider") ||
    query.includes("narrower") ||
    query.includes("reduce") ||
    query.includes("decrease") ||
    query.includes("increase") ||
    /\d+(?:\.\d+)?\s*%/.test(query) ||
    /\d{2,4}\s*px/.test(query);

  return mentionsColumn && mentionsValueLabel && mentionsTableSizingIntent;
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
      note: "Readings follow the roof nozzle orientation exported by the LAIQ inspection app V3 package.",
    },
    "shell-plate-thickness-measurements": {
      targetKey: "shell",
      itemKind: "region",
      rowLabel: "Shell location",
      firstColumnLabel: "Location",
      valueLabels: ["A", "B", "C", "D", "E"],
      note: "Shell rows are grouped by strake/course and compass lane from the LAIQ app export.",
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
  columnWidths = null,
}) {
  const heading = `${sectionNumber ? `${sectionNumber} ` : ""}${sectionTitle}`.trim().toUpperCase();
  const widths = normalizeMeasurementColumnWidths(columnWidths, measurementScope, includeStats);
  const statLabels = includeStats ? ["Min", "Max", "Average"] : [];
  const headerCells = [
    `<th ${measurementCellAttributes("measurement-first-column", widths.first)}>${escapeHtml(measurementScope.firstColumnLabel)}</th>`,
    ...(measurementScope.includeNozzleSize
      ? [`<th ${measurementCellAttributes("measurement-size-column", widths.size)}>Nozzle Dia. / Size</th>`]
      : []),
    ...measurementScope.valueLabels.map(
      (label, index) =>
        `<th ${measurementCellAttributes(`measurement-value-column ${measurementColumnClass(label)}`, widths.values[index])}>${escapeHtml(label)}</th>`,
    ),
    ...statLabels.map(
      (label, index) =>
        `<th ${measurementCellAttributes(`measurement-stat-column ${measurementColumnClass(label)}`, widths.stats[index])}>${escapeHtml(label)}</th>`,
    ),
  ].join("");
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
        ? [
            `<td ${measurementCellAttributes("measurement-size-column", widths.size)}>${escapeHtml(
              formatOptionalText(measurement.nozzleSize, "Pending confirmation"),
            )}</td>`,
          ]
        : [];
      const valueCells = displayedValues
        .map((value, index) => {
          const isReinforcementPadColumn =
            measurementScope.itemKind === "element" &&
            index === measurementScope.valueLabels.length - 1;
          const label = measurementScope.valueLabels[index];
          return `<td ${measurementCellAttributes(`measurement-value-column ${measurementColumnClass(label)}`, widths.values[index])}>${formatThicknessCell(
            value,
            isReinforcementPadColumn ? "NA" : "Pending confirmation",
          )}</td>`;
        })
        .join("");
      const statCells = statValues
        .map(
          (value, index) =>
            `<td ${measurementCellAttributes(`measurement-stat-column ${measurementColumnClass(statLabels[index])}`, widths.stats[index])}>${formatThicknessCell(value)}</td>`,
        )
        .join("");

      return `<tr><td ${measurementCellAttributes("measurement-first-column", widths.first)}>${escapeHtml(rowLabel)}</td>${sizeCells.join("")}${valueCells}${statCells}</tr>`;
    })
    .join("");

  return [
    `<h3>${escapeHtml(heading)}</h3>`,
    `<p>All thickness readings are shown in millimetres and are sourced from LAIQ inspection app V3 export ${escapeHtml(exportPackage.inspectionReference)}.</p>`,
    `<div class="report-table-wrap"><table class="report-measurement-table measurement-report-table"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`,
    `<p><em>${escapeHtml(measurementScope.note)}</em></p>`,
  ].join("");
}

function measurementCellAttributes(className, width) {
  return `class="${className}" colwidth="${width}" style="width: ${width}px"`;
}

function normalizeMeasurementColumnWidths(columnWidths, measurementScope, includeStats) {
  const raw = columnWidths ?? {};
  const statLabels = includeStats ? ["Min", "Max", "Average"] : [];

  return {
    first: clampInteger(
      raw.first ?? MEASUREMENT_DEFAULT_WIDTHS.first,
      MEASUREMENT_WIDTH_LIMITS.first.min,
      MEASUREMENT_WIDTH_LIMITS.first.max,
    ),
    size: clampInteger(
      raw.size ?? MEASUREMENT_DEFAULT_WIDTHS.size,
      MEASUREMENT_WIDTH_LIMITS.size.min,
      MEASUREMENT_WIDTH_LIMITS.size.max,
    ),
    values: measurementScope.valueLabels.map((_, index) =>
      clampInteger(
        raw.values?.[index] ?? MEASUREMENT_DEFAULT_WIDTHS.value,
        MEASUREMENT_WIDTH_LIMITS.value.min,
        MEASUREMENT_WIDTH_LIMITS.value.max,
      ),
    ),
    stats: statLabels.map((_, index) =>
      clampInteger(
        raw.stats?.[index] ?? MEASUREMENT_DEFAULT_WIDTHS.stat,
        MEASUREMENT_WIDTH_LIMITS.stat.min,
        MEASUREMENT_WIDTH_LIMITS.stat.max,
      ),
    ),
  };
}

function measurementColumnClass(label) {
  return `measurement-column-${String(label ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "value"}`;
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
    .map((message) => {
      const normalized = {
        role: message?.role === "assistant" ? "assistant" : "user",
        content: String(message?.content ?? "").trim().slice(0, 1800),
      };
      const pendingConfirmation = normalizePendingConfirmation(message?.pendingConfirmation);
      const controlTrace = normalizeControlTrace(message?.controlTrace);
      return {
        ...normalized,
        ...(pendingConfirmation ? { pendingConfirmation } : {}),
        ...(controlTrace ? { controlTrace } : {}),
      };
    })
    .filter((message) => message.content.length > 0);
}

function normalizePendingConfirmation(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const operation = String(value.operation ?? "").trim();
  const confirmationId = String(value.confirmationId ?? "").trim();
  const label = String(value.label ?? "").trim();
  const summary = String(value.summary ?? "").trim();
  if (!operation || !confirmationId) {
    return null;
  }

  return {
    confirmationId,
    label: label || "Confirm action",
    summary,
    risk: ["low", "medium", "high", "blocked"].includes(value.risk) ? value.risk : "medium",
    operation,
    args: value.args && typeof value.args === "object" ? value.args : {},
  };
}

function normalizeControlTrace(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return {
    intent: String(value.intent ?? "").slice(0, 300),
    planner: String(value.planner ?? "fallback_guard"),
    risk: String(value.risk ?? "blocked"),
    target: String(value.target ?? "Selected report section"),
    operation: String(value.operation ?? "none"),
    status: String(value.status ?? "answered"),
    guardrails: Array.isArray(value.guardrails)
      ? value.guardrails.map((item) => String(item)).filter(Boolean).slice(0, 5)
      : [],
    validation: Array.isArray(value.validation)
      ? value.validation.map((item) => String(item)).filter(Boolean).slice(0, 5)
      : [],
    userConfirmationRequired: Boolean(value.userConfirmationRequired),
    undoSnapshot: Boolean(value.undoSnapshot),
    reason: String(value.reason ?? ""),
    ...(value.alternative ? { alternative: String(value.alternative) } : {}),
  };
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
      "Add the approved section-specific source data that is not yet captured by the LAIQ app export.",
      "Examples: worksheet values, calculation sheet reference, test report number, settlement survey source, MFL plate-map source, or inspector/client confirmation text.",
      "If the data does not exist yet, leave the field pending and do not tune the generator to invent it.",
    ].join(" ");
  }

  if (fieldKey === `${context.sectionId}-layout-source`) {
    return [
      "Identify the approved drawing or worksheet source for this layout page.",
      "If the LAIQ inspection app V3 export already provides the matching map, use the imported app layout as the baseline; otherwise attach or describe the approved report-side source.",
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
      styleScope: ["section", "table"],
      fontFamily: [
        "Aptos, 'Segoe UI', sans-serif",
        "Arial, sans-serif",
        "Georgia, serif",
        "Consolas, monospace",
      ],
      fontSize: ["12px", "14px", "16px", "18px", "20px", "24px"],
      fontWeight: ["normal", "bold"],
      textAlign: ["left", "center"],
    },
    allowedMapMarkers: [...mapFindings, ...mapElements],
    allowedMapPlates: plateIds.slice(0, 120),
  };
}

function maybePushTextStyleAction(actions, context, query) {
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
    "bold",
    "enlarge",
    "increase",
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
    fontSize: resolveRequestedFontSize(query) ?? "16px",
    fontWeight: query.includes("bold") ? "bold" : null,
    color: query.includes("red") ? "#ef4c57" : query.includes("blue") ? "#0d4f90" : "#163250",
    styleScope: resolveRequestedStyleScope(query),
    targetBlockId: resolveRequestedStyleScope(query) === "table" ? findFirstTableReportBlockId(context) : null,
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

function normalizeAssistantActions(actions, options = {}) {
  if (!Array.isArray(actions)) {
    return [];
  }

  return actions.map((action) => ({
    id: String(action.id ?? randomUUID()),
    type: String(action.type ?? ""),
    label: String(action.label ?? "Apply assistant action"),
    reason: String(action.reason ?? ""),
    contentHtml: action.contentHtml == null
      ? undefined
      : options.markPredictionContent
        ? markPredictedContent(String(action.contentHtml), options.context)
        : String(action.contentHtml),
    fontFamily: action.fontFamily == null ? undefined : String(action.fontFamily),
    fontSize: action.fontSize == null ? undefined : String(action.fontSize),
    fontWeight:
      action.fontWeight === "bold" || action.fontWeight === "normal"
        ? action.fontWeight
        : undefined,
    textAlign:
      action.textAlign === "center" || action.textAlign === "left"
        ? action.textAlign
        : undefined,
    color: action.color == null ? undefined : String(action.color),
    styleScope:
      action.styleScope === "table" || action.styleScope === "block" || action.styleScope === "section"
        ? action.styleScope
        : undefined,
    targetBlockId: action.targetBlockId == null ? undefined : String(action.targetBlockId),
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
    voiceNoteCount: (exportPackage.voiceNotes ?? []).length,
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
    voiceNotes: (exportPackage.voiceNotes ?? []).map((note) => ({
      voiceNoteId: note.voiceNoteId,
      screenKey: note.screenKey,
      screenLabel: note.screenLabel,
      cardKey: note.cardKey,
      fieldKey: note.fieldKey,
      targetKey: note.targetKey,
      targetLabel: note.targetLabel,
      itemKey: note.itemKey,
      itemLabel: note.itemLabel,
      transcriptStatus: note.transcriptStatus,
      capturedAtIso: note.capturedAtIso,
      transcriptText: note.transcriptText,
      durationMs: note.durationMs,
      relativePath: note.relativePath,
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

function collectBlockers(sectionId, exportPackage, mapArtifacts, captureSectionFacts = []) {
  const blockers = [];

  if (sectionId === "inspection-report" && exportPackage.findings.length === 0 && captureSectionFacts.length === 0) {
    blockers.push("The imported package has no findings, so the inspection narrative cannot be grounded to evidence.");
  }

  if (MAP_SECTION_IDS.has(sectionId) && mapArtifacts.length === 0 && captureSectionFacts.length === 0) {
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

This report issue is assembled from the LAIQ inspection app V3 field capture baseline and finalized on the report platform for client-facing presentation control.

Approved cover visual: ${formatPending(manualInputs.coverHeroImage)}.`;
}

function composeScopeSection({ exportPackage, manualInputs }) {
  return `1       SCOPE OF INSPECTION

➢ To carry out a general and close visual inspection on the internal and external areas of the vertical aboveground storage tank and record conditions that may be detrimental to serviceability.

➢ To review roof, shell, floor, nozzle, settlement, NDT, and photographic evidence against the API 653 report format.

➢ To compile the report sections, worksheets, photographs, layout drawings, and engineering assessment in the same order as the approved API-standard sample report.

➢ To preserve LAIQ inspection app field-capture data as the factual baseline while allowing final report presentation, layout maps, and recommendation wording to be reviewed and approved on the report platform.

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

This section remains a structured fact page so the report issue can stay aligned with the LAIQ app handoff and the sample report family.`;
}

function composeInspectionReportSection({ exportPackage, manualInputs }) {
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
    .filter((note) => voiceNoteMatchesInspectionSubsection(note, sectionKey))
    .map((note) => String(note.transcriptText ?? "").trim())
    .filter(Boolean)
    .map((text) => `➢ ${text}`);
}

function voiceNoteMatchesInspectionSubsection(note, sectionKey) {
  const noteText = normalizeEvidenceKey([
    note.screenKey,
    note.screenLabel,
    note.cardKey,
    note.fieldKey,
    note.targetKey,
    note.targetLabel,
    note.itemKey,
    note.itemLabel,
    note.transcriptText,
  ].filter(Boolean).join(" "));

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
      return note.targetKey === "external_roof" && (
        noteText.includes("fixed dome") ||
        noteText.includes("roof plate") ||
        noteText.includes("curb") ||
        noteText.includes("roof surface") ||
        noteText.includes("spot readings")
      );
    case "roof_appurtenances":
      return note.targetKey === "external_roof" && (
        noteText.includes("nozzle") ||
        noteText.includes("manhole") ||
        noteText.includes("vent") ||
        noteText.includes("reinforcement")
      );
    case "fixed_roof_internal":
      return note.targetKey === "internal_roof" || noteText.includes("underside") || noteText.includes("rafter");
    case "shell_internal":
      return note.targetKey === "shell" && (
        noteText.includes("internal") ||
        noteText.includes("scale") ||
        noteText.includes("linear") ||
        noteText.includes("indication") ||
        noteText.includes("scaffold")
      );
    case "floor_internal":
      return note.targetKey === "floor" || noteText.includes("tank bottom") || noteText.includes("cone down") || noteText.includes("mfl");
    default:
      return false;
  }
}

function normalizeEvidenceKey(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

This section is intentionally report-side: the LAIQ app export supplies the factual basis, while the final recommendation wording remains under controlled cloud review.`;
}

function composeTankInspectionChecklistSection({ exportPackage }) {
  return buildChecklistTableHtml(exportPackage, {
    balancedColumns: true,
  });
}

function buildChecklistTableHtml(exportPackage, options = {}) {
  const {
    balancedColumns = true,
    columnWidths = CHECKLIST_DEFAULT_WIDTHS,
    responseMarker = CHECKLIST_DEFAULT_RESPONSE_MARKER,
  } = options;
  const ratingColumns = ["1", "2", "3", "4", "IA", "NE", "N/A"];
  const widths = {
    number: clampInteger(columnWidths.number ?? CHECKLIST_DEFAULT_WIDTHS.number, CHECKLIST_WIDTH_LIMITS.number.min, CHECKLIST_WIDTH_LIMITS.number.max),
    item: clampInteger(columnWidths.item ?? CHECKLIST_DEFAULT_WIDTHS.item, CHECKLIST_WIDTH_LIMITS.item.min, CHECKLIST_WIDTH_LIMITS.item.max),
    response: clampInteger(columnWidths.response ?? CHECKLIST_DEFAULT_WIDTHS.response, CHECKLIST_WIDTH_LIMITS.response.min, CHECKLIST_WIDTH_LIMITS.response.max),
  };
  const columnWidthAttr = [widths.number, widths.item, ...ratingColumns.map(() => widths.response)].join(",");
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
              return `<td class="checklist-response-cell" colwidth="${widths.response}">${selected ? escapeHtml(responseMarker) : ""}</td>`;
            })
            .join("");

          return `<tr><td class="checklist-item-number" colwidth="${widths.number}">${escapeHtml(item.itemNumber)}</td><td class="checklist-item-prompt" colwidth="${widths.item}">${escapeHtml(
            item.itemPrompt,
          )}</td>${responseCells}</tr>`;
        })
        .join("");

      return [
        `<tr class="checklist-section-row"><th colspan="${ratingColumns.length + 2}" colwidth="${columnWidthAttr}">${escapeHtml(
          String(sectionTitle).toUpperCase(),
        )}</th></tr>`,
        `<tr><th class="checklist-number-heading" colwidth="${widths.number}">No.</th><th class="checklist-item-heading" colwidth="${widths.item}">Inspection Item</th>${ratingColumns
          .map((rating) => `<th class="checklist-response-heading" colwidth="${widths.response}">${escapeHtml(rating)}</th>`)
          .join("")}</tr>`,
        rows,
      ].join("");
    })
    .join("");

  const tableClass = [
    "report-measurement-table",
    "checklist-report-table",
    balancedColumns ? "checklist-report-table-balanced" : "",
  ].filter(Boolean).join(" ");

  return [
    "<h3>7 TANK INSPECTION CHECKLIST</h3>",
    "<p>Checklist responses are imported from the LAIQ inspection app V3 export. The response grid follows the sample report columns and should remain editable before final issue.</p>",
    `<div class="report-table-wrap"><table class="${tableClass}"><tbody>${groups}</tbody></table></div>`,
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

Geometry and layout metadata remain sourced from the field package for Tank ${exportPackage.task.tankNumber}. The report platform keeps LAIQ app map geometry locked until parity review is approved; report-side work is limited to captions, legend notes, and checker metadata.`;
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

function composeStandardTocSection({ sectionId, exportPackage, calculations, mapArtifacts, manualInputs, captureSectionFacts = [] }) {
  const tocSection = getApiStandardTocSection(sectionId);
  const title = tocSection?.title ?? humanizeKey(sectionId);
  const number = tocSection?.number ?? "";
  const attachmentSummary = findOutput(calculations, "attachment_summary");
  const findingSummary = findOutput(calculations, "finding_summary");
  const shellUtSummary = findOutput(calculations, "shell_ut_summary");
  const measurementScope = getMeasurementTableScope(sectionId);

  if (captureSectionFacts.length > 0 && !measurementScope && (tocSection?.kind !== "map" || mapArtifacts.length === 0)) {
    const factLines = captureSectionFacts.map((fact) => renderCaptureFactValue(fact.value, fact.unitCode));
    return `${number}       ${title.toUpperCase()}\n\n${factLines.join("\n\n")}`;
  }

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

No matching LAIQ inspection app V3 UT measurement rows were found for this section.

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

The final map remains editable on the report platform while preserving the LAIQ app export as the source-of-truth baseline.`;
    }

    return `${number}       ${title.toUpperCase()}

This API-standard layout section is part of the vertical AST report template, but the current LAIQ app export does not yet include structured ${tocSection.layoutSurface ?? "surface"} geometry for this page.

Do not invent plate dimensions, MFL platemaps, roof layout, floor corrosion maps, or settlement graphics. Keep this section in review until approved source data is imported or entered through a controlled report-side workflow.

Current imported context:
- Client: ${exportPackage.task.client}
- Tank: ${exportPackage.task.tankNumber}
- Imported findings: ${findingSummary.findingCount}
- Imported attachments: ${attachmentSummary.totalCount}`;
  }

  return `${number}       ${title.toUpperCase()}

This section follows the API-standard vertical AST report template.

Current imported baseline:
- Client: ${exportPackage.task.client}
- Tank: ${exportPackage.task.tankNumber}
- Inspection reference: ${exportPackage.inspectionReference}
- Imported shell finding count: ${findingSummary.findingCount}
- Imported shell UT row count: ${shellUtSummary.rowCount}
- Imported attachment count: ${attachmentSummary.totalCount}

Complete the section using approved report-side inputs, calculations, worksheets, or future LAIQ app export fields that correspond to this exact section. Any missing value should remain marked as Pending confirmation until reviewed.`;
}

function composeCapturedEvidenceSection({ sectionId, captureSectionFacts }) {
  const tocSection = getApiStandardTocSection(sectionId);
  const title = tocSection?.title ?? humanizeKey(sectionId);
  const number = tocSection?.number ?? "";
  const factLines = captureSectionFacts.map((fact) => renderCaptureFactValue(fact.value, fact.unitCode));
  return `${number}       ${title.toUpperCase()}\n\n${factLines.join("\n\n")}`;
}

function prependProtectedCaptureBlock(content, context) {
  if (!getMeasurementTableScope(context.sectionId)) return content;
  const protectedFacts=(context.captureSectionFacts??[]).filter((fact)=>fact.captureChannel==="measurement"||fact.factType==="measurement_record");
  if(protectedFacts.length===0)return content;
  const sectionText=(context.captureSectionFacts??[]).map((fact)=>captureFactDisplayValue(fact.value)).join(" ");
  const inheritedUnit=/all readings (?:are |in )*mm\b/i.test(sectionText)?"mm":null;
  const rows=protectedFacts.map((fact,index)=>`<article class="laiq-protected-capture-fact" data-fact-id="${escapeHtml(fact.factId??`measurement-${index+1}`)}"><h4>Captured measurement ${index+1}</h4>${renderProtectedCaptureValue(fact.value,fact.unitCode??inheritedUnit)}</article>`).join("");
  const block=`<section class="laiq-provenance-block laiq-provenance-field laiq-protected-capture-block" data-laiq-provenance="app_field_data" data-laiq-protected="true"><h3>Verified captured measurements</h3><p>Values below are compiled directly from the LAIQ app export and are not model-authored.</p>${rows}</section>`;
  return `${block}${String(content??"").trim()}`;
}

function renderProtectedCaptureValue(value,unitCode){const text=captureFactDisplayValue(value).trim();const lines=text.split(/\r?\n/).map((line)=>line.trim()).filter(Boolean);const tableLines=lines.filter((line)=>line.startsWith("|")&&line.endsWith("|"));if(tableLines.length>=2){const parsed=tableLines.map((line)=>line.slice(1,-1).split("|").map((cell)=>cell.trim()));const data=parsed.filter((cells)=>!cells.every((cell)=>/^:?-{3,}:?$/.test(cell)));if(data.length){const width=Math.max(...data.map((cells)=>cells.length));const header=data[0];const body=data.slice(1);const renderCell=(cell,index)=>unitCode&&index>0&&/^[+\-]?\d+(?:\.\d+)?$/.test(cell)?`${cell} ${unitCode}`:cell;return `<table class="laiq-protected-measurement-table"><thead><tr>${Array.from({length:width},(_,index)=>`<th>${escapeHtml(header[index]??"")}</th>`).join("")}</tr></thead><tbody>${body.map((cells)=>`<tr>${Array.from({length:width},(_,index)=>`<td>${escapeHtml(renderCell(cells[index]??"",index))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;}}const suffix=unitCode?` ${unitCode}`:"";return `<p>${escapeHtml(text)}${escapeHtml(suffix)}</p>`;}

function renderCaptureFactValue(value, unitCode) {
  const rendered = captureFactDisplayValue(value);
  return `${rendered}${unitCode ? ` ${unitCode}` : ""}`;
}

function captureFactDisplayValue(value) {
  if (value == null) return "";
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  if (Array.isArray(value)) return value.map(captureFactDisplayValue).filter(Boolean).join("; ");
  if (typeof value === "object") {
    if (value.text != null) return captureFactDisplayValue(value.text);
    if (value.value != null) return captureFactDisplayValue(value.value);
    return Object.entries(value)
      .filter(([key]) => !["sourceHeading", "sourceBlockType", "label", "type"].includes(key))
      .map(([, item]) => captureFactDisplayValue(item)).filter(Boolean).join("; ");
  }
  return "";
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
    warnings.push("Map-page output should confirm that geometry is sourced from the LAIQ app export.");
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
