import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutMapEditor } from "../components/LayoutMapEditor";
import { RichTextSectionEditor } from "../components/RichTextSectionEditor";
import {
  type ApiEvalRun,
  type ApiAiStatus,
  buildInitialChats,
  hydrateWorkspaceFromApiState,
  loadWorkspaceBootstrap,
} from "../domain/mockReport";
import type { ReportClassification } from "../domain/reportClassification";
import type {
  AssistantAction,
  ChatMessage,
  LayoutMapData,
  LayoutSurfaceType,
  MissingField,
  ReportSection,
  SectionStatus,
  WorkspaceReport,
} from "../domain/types";
import { ensureLayoutMapData } from "../lib/layoutMapGeometry";
import {
  normalizeSectionContent,
  sanitizeSectionContent,
} from "../lib/reportContent";
import {
  approveSection as approveSectionApi,
  generateSection as generateSectionApi,
  saveLayoutOverride as saveLayoutOverrideApi,
  saveManualInputs as saveManualInputsApi,
  saveSectionDraft as saveSectionDraftApi,
  sendSectionChat as sendSectionChatApi,
} from "../lib/reportApi";

type EditorMode = "preview" | "edit";
type ImportSummaryWithClassification = WorkspaceReport["importSummary"] & {
  reportClassification: ReportClassification;
};

function deriveStatus(section: ReportSection, generatedPreviewSectionIds?: Set<string>): SectionStatus {
  const hasMissing = section.missingFields.some((field) => !field.value.trim());
  const hasGeneratedPreview = generatedPreviewSectionIds == null || generatedPreviewSectionIds.has(section.id);

  if (section.approved) return "approved";
  if (hasMissing) return "missing info";
  if (!hasGeneratedPreview) return "not started";
  if (section.reviewRequired) return "review required";
  if (section.edited) return "edited";
  if (section.generated) return "generated";
  return "not started";
}

function cloneReport(report: WorkspaceReport): WorkspaceReport {
  return JSON.parse(JSON.stringify(report)) as WorkspaceReport;
}

const LAYOUT_SURFACE_ORDER: LayoutSurfaceType[] = ["roof", "shell", "floor"];

function formatLayoutSurfaceTab(surface: LayoutSurfaceType | undefined) {
  if (surface === "roof") return "Roof";
  if (surface === "shell") return "Shell";
  if (surface === "floor") return "Floor";
  return "Layout";
}

function formatErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected backend error.";
}

function getHydrationApiBaseUrl(report: WorkspaceReport) {
  return report.apiLinks.apiBaseUrl === "same-origin /api" ? "" : report.apiLinks.apiBaseUrl;
}

function applyTextStyleAction(content: string, action: AssistantAction) {
  const normalized = normalizeSectionContent(content);
  const innerContent = normalized.replace(/^<div data-laiq-style="section"[^>]*>([\s\S]*)<\/div>$/i, "$1");
  const styleParts = [
    action.fontFamily ? `font-family: ${action.fontFamily}` : "",
    action.fontSize ? `font-size: ${action.fontSize}` : "",
    action.textAlign ? `text-align: ${action.textAlign}` : "",
    action.color ? `color: ${action.color}` : "",
  ].filter(Boolean);

  if (styleParts.length === 0) {
    return normalized;
  }

  return `<div data-laiq-style="section" style="${styleParts.join("; ")}">${innerContent}</div>`;
}

function buildDefaultRawGenerationInput(section: ReportSection): string {
  return [
    "GENERATION PROMPT / GUIDELINE",
    `Use this app-export evidence to generate the report section: ${section.title}.`,
    section.aiHint,
    "Follow the 22PE1-4 V10 API-standard report format.",
    "Do not invent missing values. If a value is missing, keep it in the missing-content panel.",
    "",
    "READABLE APP DATA PREVIEW",
    section.rawAppData ?? "No section-specific app export preview is attached yet.",
  ].join("\n");
}

function formatEvalPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function humanizeEvalCode(value: string): string {
  return value.replace(/_/g, " ");
}

function normalizeAssistantChatContent(content: string, sectionTitle: string) {
  const trimmed = content.trim();
  if (trimmed) return trimmed;

  return `I need one more detail before I can act on ${sectionTitle}. Should I refine wording, apply formatting, inspect missing inputs, or review layout-map evidence?`;
}

function App() {
  const [report, setReport] = useState<WorkspaceReport | null>(null);
  const [baselineReport, setBaselineReport] = useState<WorkspaceReport | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [editorMode, setEditorMode] = useState<EditorMode>("preview");
  const [chatInput, setChatInput] = useState("");
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>({});
  const [flashMessage, setFlashMessage] = useState("Load the V10 Android V2 Product mockup export to begin.");
  const [rawGenerationInputs, setRawGenerationInputs] = useState<Record<string, string>>({});
  const [generatedPreviewSectionIds, setGeneratedPreviewSectionIds] = useState<Set<string>>(() => new Set());
  const [evalRuns, setEvalRuns] = useState<Record<string, ApiEvalRun>>({});
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [activePlateId, setActivePlateId] = useState<string | null>(null);
  const [selectedLayoutSurface, setSelectedLayoutSurface] = useState<LayoutSurfaceType>("roof");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<ApiAiStatus | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChatBusy, setIsChatBusy] = useState(false);
  const chatThreadRef = useRef<HTMLDivElement | null>(null);

  const handleLoadMockupData = async () => {
    setIsLoadingData(true);
    setLoadError(null);
    setFlashMessage("Loading and pre-processing the V10 Android V2 Product export...");

    try {
      const bootstrap = await loadWorkspaceBootstrap();
      const nextReport = cloneReport(bootstrap.report);
      setReport(nextReport);
      setBaselineReport(cloneReport(bootstrap.baselineReport));

      const defaultSection =
        nextReport.sections.find((section) => section.id === "scope-of-inspection")?.id ??
        nextReport.sections[0]?.id ??
        "";

      setSelectedSectionId(defaultSection);
      setChats(buildInitialChats(nextReport));
      setRawGenerationInputs(
        Object.fromEntries(
          nextReport.sections.map((section) => [section.id, buildDefaultRawGenerationInput(section)]),
        ),
      );
      setGeneratedPreviewSectionIds(new Set());
      setEvalRuns({});
      setFlashMessage(
        "Loaded V10 mockup export and prepared readable app-data previews. LAIQ AI Engine is idle until you click Generate or send chat.",
      );
      setActiveMarkerId(null);
      setActivePlateId(null);
      setSelectedLayoutSurface("roof");
      setAiStatus(bootstrap.aiStatus);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load the workspace.");
      setFlashMessage("Unable to load the V10 mockup export.");
    } finally {
      setIsLoadingData(false);
    }
  };

  const selectedSection = useMemo(() => {
    if (!report) return null;
    return report.sections.find((section) => section.id === selectedSectionId) ?? report.sections[0] ?? null;
  }, [report, selectedSectionId]);

  const safeLayoutMap = useMemo(
    () => (selectedSection?.layoutMap ? ensureLayoutMapData(selectedSection.layoutMap) : undefined),
    [selectedSection],
  );

  const sectionStatuses = useMemo(() => {
    if (!report) {
      return {
        "not started": 0,
        generated: 0,
        edited: 0,
        "missing info": 0,
        "review required": 0,
        approved: 0,
      } satisfies Record<SectionStatus, number>;
    }

    return report.sections.reduce<Record<SectionStatus, number>>(
      (acc, section) => {
        const status = deriveStatus(section, generatedPreviewSectionIds);
        acc[status] += 1;
        return acc;
      },
      {
        "not started": 0,
        generated: 0,
        edited: 0,
        "missing info": 0,
        "review required": 0,
        approved: 0,
      },
    );
  }, [generatedPreviewSectionIds, report]);

  const currentChat = selectedSection ? chats[selectedSection.id] ?? [] : [];
  const selectedRawGenerationInput = rawGenerationInputs[selectedSection?.id ?? ""] ?? "";
  const hasGeneratedPreview = selectedSection
    ? generatedPreviewSectionIds.has(selectedSection.id) || selectedSection.generated || selectedSection.edited
    : false;
  const selectedEvalRun = selectedSection ? evalRuns[selectedSection.id] : undefined;
  const unresolvedMissingCount = selectedSection
    ? selectedSection.missingFields.filter((field) => !field.value.trim()).length
    : 0;
  const layoutMapSections = useMemo(() => {
    const sectionsBySurface = new Map<LayoutSurfaceType, ReportSection>();

    for (const section of report?.sections ?? []) {
      const surface = section.layoutMap?.appMap?.surfaceType;
      if (surface && !sectionsBySurface.has(surface)) {
        sectionsBySurface.set(surface, section);
      }
    }

    return LAYOUT_SURFACE_ORDER.map((surface) => sectionsBySurface.get(surface)).filter(
      (section): section is ReportSection => section != null,
    );
  }, [report]);
  const activeLayoutSection = useMemo(
    () =>
      layoutMapSections.find((section) => section.layoutMap?.appMap?.surfaceType === selectedLayoutSurface) ??
      layoutMapSections[0],
    [layoutMapSections, selectedLayoutSurface],
  );
  const visibleLayoutMap = useMemo(
    () => (activeLayoutSection?.layoutMap ? ensureLayoutMapData(activeLayoutSection.layoutMap) : undefined),
    [activeLayoutSection],
  );
  const activeLayoutSurface = visibleLayoutMap?.appMap?.surfaceType;

  useEffect(() => {
    const chatThread = chatThreadRef.current;
    if (!chatThread) return;

    chatThread.scrollTo({
      top: chatThread.scrollHeight,
      behavior: "smooth",
    });
  }, [currentChat.length, selectedSectionId]);

  if (loadError) {
    return (
      <div className="workspace-app">
        <div className="flash-banner flash-banner-error">
          Report workspace failed to load. {loadError}
        </div>
        <button className="toolbar-button toolbar-button-primary" disabled={isLoadingData} onClick={handleLoadMockupData} type="button">
          {isLoadingData ? "Loading…" : "Retry Load Mockup Data"}
        </button>
      </div>
    );
  }

  if (!report || !baselineReport || !selectedSection) {
    return (
      <div className="workspace-app">
        <section className="load-data-shell">
          <div className="load-data-card panel">
            <p className="eyebrow">LAIQ Report Platform</p>
            <h1>Start From Android V2 Product Export</h1>
            <p>
              Load the latest V10 mockup export fixture, then review the pre-processed readable app-data preview before
              asking LAIQ AI Engine to generate any report section.
            </p>
            <div className="load-data-paths">
              <code>apps/field-android/.../V2ProductMockTaskSeed.kt</code>
              <code>apps/report-platform/src/fixtures/v2-product-export-shell-internal.json</code>
            </div>
            <button className="toolbar-button toolbar-button-primary" disabled={isLoadingData} onClick={handleLoadMockupData} type="button">
              {isLoadingData ? "Loading Mockup Data…" : "Load Mockup Data"}
            </button>
            <small>No LAIQ AI Engine generation runs until you click Generate or use the chat panel.</small>
          </div>
        </section>
      </div>
    );
  }

  const reportClassification = (report.importSummary as ImportSummaryWithClassification).reportClassification;
  const codeBasis = [
    ...reportClassification.primaryCodes.map((code) => code.label),
    ...reportClassification.supportingCodes.slice(0, 3).map((code) => code.label),
  ].join(" · ");

  const updateSection = (sectionId: string, updater: (section: ReportSection) => ReportSection) => {
    setReport((current) =>
      current == null
        ? current
        : {
            ...current,
            sections: current.sections.map((section) => (section.id === sectionId ? updater(section) : section)),
          },
    );
  };

  const selectReportSection = (section: ReportSection) => {
    setSelectedSectionId(section.id);
    setEditorMode("preview");
    setActiveMarkerId(null);
    setActivePlateId(null);
    if (section.layoutMap?.appMap?.surfaceType) {
      setSelectedLayoutSurface(section.layoutMap.appMap.surfaceType);
    }
  };

  const selectLayoutMapSection = (section: ReportSection) => {
    const surface = section.layoutMap?.appMap?.surfaceType;
    if (surface) {
      setSelectedLayoutSurface(surface);
    }
    setActiveMarkerId(null);
    setActivePlateId(null);
  };

  const syncSectionToBackend = async (section: ReportSection, includeLayoutOverride: boolean) => {
    await saveManualInputsApi(report, section);
    await saveSectionDraftApi(report, section);

    if (includeLayoutOverride && section.layoutMap) {
      await saveLayoutOverrideApi(report, section.id, ensureLayoutMapData(section.layoutMap));
    }
  };

  const handleContentChange = (value: string) => {
    updateSection(selectedSection.id, (section) => ({
      ...section,
      content: value,
      edited: true,
      approved: false,
    }));
  };

  const handleFieldChange = (fieldId: string, value: string) => {
    updateSection(selectedSection.id, (section) => ({
      ...section,
      edited: true,
      approved: false,
      missingFields: section.missingFields.map((field) =>
        field.id === fieldId ? { ...field, value } : field,
      ),
    }));
  };

  const handleRawGenerationInputChange = (value: string) => {
    setRawGenerationInputs((current) => ({
      ...current,
      [selectedSection.id]: value,
    }));
  };

  const handleApprove = async () => {
    if (!hasGeneratedPreview) {
      setFlashMessage("Generate this section before approving it.");
      return;
    }

    const hasMissing = selectedSection.missingFields.some((field) => !field.value.trim());
    if (hasMissing) {
      setFlashMessage("Complete the missing-content panel before approving this section.");
      return;
    }

    const nextSection: ReportSection = {
      ...selectedSection,
      approved: true,
      reviewRequired: false,
      layoutMap: safeLayoutMap,
    };

    updateSection(selectedSection.id, (section) => ({
      ...section,
      approved: true,
      reviewRequired: false,
      layoutMap: safeLayoutMap,
    }));

    try {
      await syncSectionToBackend(nextSection, Boolean(nextSection.layoutMap));
      await approveSectionApi(report, selectedSection.id);
      setFlashMessage(`${selectedSection.title} approved and persisted to the backend report job.`);
    } catch (error) {
      setFlashMessage(
        `${selectedSection.title} updated locally, but backend approval failed: ${formatErrorMessage(error)}`,
      );
    }
  };

  const handleGenerate = async () => {
    setFlashMessage(`Generating ${selectedSection.title} from imported field facts and report-side inputs...`);
    setIsGenerating(true);

    try {
      await saveManualInputsApi(report, selectedSection);
      const payload = await generateSectionApi(report, selectedSection.id, selectedRawGenerationInput);
      const hydrated = hydrateWorkspaceFromApiState(payload, getHydrationApiBaseUrl(report));
      const nextSection = hydrated.report.sections.find((section) => section.id === selectedSection.id);

      if (nextSection) {
        updateSection(selectedSection.id, () => nextSection);
      }
      setBaselineReport(cloneReport(hydrated.baselineReport));
      setGeneratedPreviewSectionIds((current) => new Set(current).add(selectedSection.id));
      if (payload.aiStatus) {
        setAiStatus(payload.aiStatus);
      }
      if (payload.evalRun) {
        setEvalRuns((current) => ({
          ...current,
          [selectedSection.id]: payload.evalRun as ApiEvalRun,
        }));
      }
      setSelectedSectionId(selectedSection.id);
      setActiveMarkerId(null);
      setActivePlateId(null);
      setChats((current) => {
        const generationRun = payload.generationRun;
        const details = generationRun
          ? [
              generationRun.providerCode
                ? `Worker: ${generationRun.providerCode}${generationRun.modelId ? ` (${generationRun.modelId})` : ""}.`
                : "Worker: unknown.",
              `Template: ${generationRun.templateKey}.`,
              generationRun.calculationKeys.length > 0
                ? `Calculations: ${generationRun.calculationKeys.join(", ")}.`
                : "Calculations: none.",
              generationRun.mapArtifactKeys.length > 0
                ? `Map artifacts: ${generationRun.mapArtifactKeys.join(", ")}.`
                : "Map artifacts: none.",
              generationRun.assistantSummary ?? "",
              payload.evalRun
                ? `Eval: ${Math.round(payload.evalRun.score * 100)}% (${payload.evalRun.outcomeCode}).`
                : "Eval: not returned.",
              generationRun.warnings.length > 0
                ? `Warnings: ${generationRun.warnings.join(" ")}`
                : "Warnings: none.",
            ].join(" ")
          : "Section generation completed.";

        return {
          ...current,
          [selectedSection.id]: [
            ...(current[selectedSection.id] ?? []),
            {
              id: `a-gen-${Date.now()}`,
              role: "assistant",
              content: `I regenerated this section through the report orchestration engine. ${details}`,
            },
          ],
        };
      });

      const generationRun = payload.generationRun;
      const warningSuffix =
        generationRun && generationRun.warnings.length > 0
          ? ` Warnings: ${generationRun.warnings.join(" ")}`
          : "";
      const blockerSuffix =
        generationRun && generationRun.blockers.length > 0
          ? ` Blockers: ${generationRun.blockers.join(" ")}`
          : "";
      const workerSuffix =
        generationRun?.providerCode != null
          ? ` Worker: ${generationRun.providerCode}${generationRun.modelId ? ` (${generationRun.modelId})` : ""}.`
          : "";
      const fallbackSuffix =
        generationRun?.fallbackReason != null ? ` Fallback reason: ${generationRun.fallbackReason}` : "";
      const evalSuffix =
        payload.evalRun != null
          ? ` Eval: ${Math.round(payload.evalRun.score * 100)}% ${payload.evalRun.outcomeCode}. ${payload.evalRun.summary}`
          : "";

      setFlashMessage(
        `Generated ${selectedSection.title} via ${generationRun?.templateKey ?? "the backend orchestration engine"}.` +
          workerSuffix +
          warningSuffix +
          blockerSuffix +
          fallbackSuffix +
          evalSuffix,
      );
    } catch (error) {
      setFlashMessage(`Unable to generate ${selectedSection.title}: ${formatErrorMessage(error)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!hasGeneratedPreview) {
      setFlashMessage("Generate this section before saving it as a report draft.");
      return;
    }

    const nextSection: ReportSection = {
      ...selectedSection,
      edited: true,
      approved: false,
      layoutMap: safeLayoutMap,
    };

    updateSection(selectedSection.id, (section) => ({
      ...section,
      edited: true,
      approved: false,
      layoutMap: safeLayoutMap,
    }));

    try {
      await syncSectionToBackend(nextSection, Boolean(nextSection.layoutMap));
      setFlashMessage(`${selectedSection.title} saved to the backend report job as a working draft.`);
    } catch (error) {
      setFlashMessage(
        `${selectedSection.title} saved locally, but backend draft persistence failed: ${formatErrorMessage(error)}`,
      );
    }
  };

  const persistLayoutMap = async (nextLayoutMap: LayoutMapData, summary: string) => {
    const normalized = ensureLayoutMapData(nextLayoutMap);
    const nextOverrideCount = (safeLayoutMap?.overrideCount ?? normalized.overrideCount ?? 0) + 1;
    const persistedLayoutMap = {
      ...normalized,
      overrideCount: nextOverrideCount,
    };

    updateSection(selectedSection.id, (section) => ({
      ...section,
      edited: true,
      approved: false,
      reviewRequired: true,
      layoutMap: persistedLayoutMap,
    }));

    try {
      await saveLayoutOverrideApi(report, selectedSection.id, persistedLayoutMap);
      setFlashMessage(`${summary} and persisted it to the backend layout override store.`);
    } catch (error) {
      setFlashMessage(`${summary} locally, but backend layout persistence failed: ${formatErrorMessage(error)}`);
    }
  };

  const selectNextMarker = () => {
    if (!safeLayoutMap) return;
    const markers = safeLayoutMap.markers;
    if (markers.length === 0) return;

    const currentIndex = markers.findIndex((marker) => marker.id === activeMarkerId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % markers.length;
    setActiveMarkerId(markers[nextIndex].id);
    setActivePlateId(null);
  };

  const resetMapOverrides = async () => {
    if (!safeLayoutMap) return;

    const original = baselineReport.sections.find((item) => item.id === selectedSection.id);
    if (!original?.layoutMap) return;

    const normalized = ensureLayoutMapData(original.layoutMap);

    updateSection(selectedSection.id, (section) => ({
      ...section,
      edited: true,
      approved: false,
      reviewRequired: false,
      layoutMap: normalized,
    }));
    setActiveMarkerId(null);
    setActivePlateId(null);

    try {
      await saveLayoutOverrideApi(report, selectedSection.id, normalized);
      setFlashMessage(`Reset draft map overrides for ${selectedSection.title} and synced the baseline to the backend.`);
    } catch (error) {
      setFlashMessage(
        `Reset map overrides locally for ${selectedSection.title}, but backend sync failed: ${formatErrorMessage(error)}`,
      );
    }
  };

  const sendChatPrompt = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: trimmed };
    const conversationHistory = [...currentChat, userMessage].map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setChats((current) => ({
      ...current,
      [selectedSection.id]: [
        ...(current[selectedSection.id] ?? []),
        userMessage,
      ],
    }));
    setChatInput("");
    setIsChatBusy(true);

    try {
      await saveManualInputsApi(report, selectedSection);
      const reply = await sendSectionChatApi(report, selectedSection.id, trimmed, conversationHistory);
      const actions = reply.actions ?? [];
      const replyContent = normalizeAssistantChatContent(reply.content, selectedSection.title);
      setChats((current) => ({
        ...current,
        [selectedSection.id]: [
          ...(current[selectedSection.id] ?? []),
          {
            id: reply.replyId,
            role: "assistant",
            content: replyContent,
            actions,
          },
        ],
      }));

      let appliedActionCount = 0;
      for (const action of actions) {
        const applied = await handleApplyAssistantAction(action);
        if (applied) {
          appliedActionCount += 1;
        }
      }

      const modeMessage = reply.usedLiveModel
        ? `LAIQ AI Engine replied for ${selectedSection.title}${reply.modelId ? ` using ${reply.modelId}` : ""}.`
        : `LAIQ AI Engine used fallback mode for ${selectedSection.title}. ${reply.fallbackReason ?? ""}`.trim();
      const actionMessage =
        actions.length > 0
          ? ` Applied ${appliedActionCount}/${actions.length} controlled tool action${actions.length === 1 ? "" : "s"}.`
          : " No controlled tool action was returned.";

      setFlashMessage(`${modeMessage}${actionMessage}`);
    } catch (error) {
      const content = `I could not complete that chat request yet: ${formatErrorMessage(error)} Please tell me whether you want wording, formatting, missing-input review, or layout-map evidence review.`;
      setChats((current) => ({
        ...current,
        [selectedSection.id]: [
          ...(current[selectedSection.id] ?? []),
          {
            id: `a-error-${Date.now()}`,
            role: "assistant",
            content,
          },
        ],
      }));
      setFlashMessage(`Unable to send AI chat prompt for ${selectedSection.title}. I added a follow-up in the chat panel.`);
    } finally {
      setIsChatBusy(false);
    }
  };

  const handleChatSend = () => {
    void sendChatPrompt(chatInput);
  };

  const handleQuickReply = (value: "Yes" | "No") => {
    void sendChatPrompt(value);
  };

  const shouldShowQuickReplies = (message: ChatMessage, index: number) =>
    !isChatBusy &&
    message.role === "assistant" &&
    index === currentChat.length - 1 &&
    message.content.includes("?");

  const handleApplyAssistantAction = async (action: AssistantAction): Promise<boolean> => {
    if (action.type === "replace_section_content" || action.type === "apply_text_style") {
      if (!hasGeneratedPreview) {
        setFlashMessage("Generate this section before LAIQ AI Engine can edit the report draft.");
        return false;
      }

      const nextContent =
        action.type === "replace_section_content"
          ? normalizeSectionContent(action.contentHtml ?? selectedSection.content)
          : applyTextStyleAction(selectedSection.content, action);

      const nextSection: ReportSection = {
        ...selectedSection,
        content: nextContent,
        edited: true,
        approved: false,
      };

      updateSection(selectedSection.id, (section) => ({
        ...section,
        content: nextContent,
        edited: true,
        approved: false,
      }));

      try {
        await saveSectionDraftApi(report, nextSection);
        setFlashMessage(`${action.label} applied through the LAIQ AI Engine controller.`);
      } catch (error) {
        setFlashMessage(`${action.label} applied locally, but draft persistence failed: ${formatErrorMessage(error)}`);
      }

      return true;
    }

    if (!safeLayoutMap) {
      setFlashMessage("This section does not expose a layout map for assistant-controlled actions.");
      return false;
    }

    if (safeLayoutMap.appMap) {
      setFlashMessage("Layout-map geometry is locked to the Android V2 Product export while app parity is under review.");
      return false;
    }

    if (action.type === "move_marker" && action.markerId) {
      const marker = safeLayoutMap.markers.find((item) => item.id === action.markerId);
      if (!marker) {
        setFlashMessage(`Assistant action skipped because marker ${action.markerId} is not available in this section.`);
        return false;
      }

      setActiveMarkerId(marker.id);
      setActivePlateId(null);
      await persistLayoutMap(
        {
          ...safeLayoutMap,
          markers: safeLayoutMap.markers.map((item) =>
            item.id === marker.id
              ? {
                  ...item,
                  x: item.x + (action.deltaX ?? 0),
                  y: item.y + (action.deltaY ?? 0),
                }
              : item,
          ),
        },
        action.label,
      );
      return true;
    }

    if (action.type === "resize_plate" && action.plateId) {
      const plate = safeLayoutMap.plates.find((item) => item.id === action.plateId);
      if (!plate) {
        setFlashMessage(`Assistant action skipped because plate ${action.plateId} is not available in this section.`);
        return false;
      }

      setActiveMarkerId(null);
      setActivePlateId(plate.id);
      await persistLayoutMap(
        {
          ...safeLayoutMap,
          plates: safeLayoutMap.plates.map((item) =>
            item.id === plate.id
              ? {
                  ...item,
                  width: item.width + (action.widthDelta ?? 0),
                  height: item.height + (action.heightDelta ?? 0),
                }
              : item,
          ),
        },
        action.label,
      );
      return true;
    }

    return false;
  };

  return (
    <div className="workspace-app">
      <header className="workspace-topbar">
        <div className="brand-lockup">
          <img alt="LAIQ logo" className="brand-logo" src="/laiq-logo.png" />
          <div>
            <p className="eyebrow">LAIQ Report Platform</p>
            <h1>{report.title}</h1>
          </div>
        </div>
        <div className="topbar-meta">
          <div>
            <span className="meta-label">Report</span>
            <strong>{report.reference}</strong>
          </div>
          <div>
            <span className="meta-label">Client</span>
            <strong>{report.client}</strong>
          </div>
          <div>
            <span className="meta-label">Tank</span>
            <strong>{report.tank}</strong>
          </div>
        </div>
      </header>

      <div className="flash-banner">{flashMessage}</div>
      <section className="import-strip">
        <div className="import-card">
          <span className="meta-label">Source</span>
          <strong>Android V2 Product Export</strong>
          <p>{report.importSummary.dataSourceMode === "api" ? "Loaded from API" : "Loaded from fixture"}</p>
        </div>
        <div className="import-card">
          <span className="meta-label">Inspection</span>
          <strong>{report.importSummary.inspectionReference}</strong>
          <p>
            {report.importSummary.workflowScreen} · {report.importSummary.validationResults.filter((item) => item.passed).length}/
            {report.importSummary.validationResults.length} validations passed
          </p>
        </div>
        <div className="import-card">
          <span className="meta-label">Classification</span>
          <strong>{reportClassification.reportFamilyLabel}</strong>
          <p>{reportClassification.primaryFormatPrecedent} · {codeBasis}</p>
        </div>
        <div className="import-card">
          <span className="meta-label">LAIQ AI Engine</span>
          <strong>Idle until user action</strong>
          <p>
            No generation runs on page load. {aiStatus?.statusLabel ?? "Worker status is available after load."}
          </p>
        </div>
      </section>

      <main className="workspace-grid">
        <aside className="panel sidebar">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Tasks</p>
              <h2>Report Sections</h2>
            </div>
            <span className="count-pill">{report.sections.length}</span>
          </div>

          <div className="status-summary">
            {Object.entries(sectionStatuses).map(([status, count]) => (
              <div className="status-chip" key={status}>
                <span className={`status-dot status-${status.replace(/\s+/g, "-")}`} />
                <span>{status}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>

          <div className="section-list">
            {report.sections.map((section) => {
              const status = deriveStatus(section, generatedPreviewSectionIds);
              const isActive = section.id === selectedSection.id;
              return (
                <button
                  className={`section-item ${isActive ? "section-item-active" : ""}`}
                  key={section.id}
                  onClick={() => selectReportSection(section)}
                  type="button"
                >
                  <div className="section-item-top">
                    <span className="section-number">{section.number}</span>
                    <span className={`status-badge status-${status.replace(/\s+/g, "-")}`}>{status}</span>
                  </div>
                  <strong>{section.title}</strong>
                  <p>{section.description}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="panel workspace-main">
          <div className="panel-header">
            <div>
              <p className="eyebrow">{selectedSection.kind} section</p>
              <h2>{selectedSection.title}</h2>
            </div>
            <div className="toolbar">
              <button className="toolbar-button" disabled={!hasGeneratedPreview} onClick={handleSaveDraft} type="button">
                Save Draft
              </button>
              <button
                className="toolbar-button toolbar-button-primary"
                disabled={!hasGeneratedPreview}
                onClick={handleApprove}
                type="button"
              >
                Approve
              </button>
            </div>
          </div>

          <div className="report-workflow-stack">
            <section className="panel-subsection raw-data-pane">
              <div className="subsection-header">
                <div>
                  <p className="eyebrow">Step 1 · App Export Evidence</p>
                  <h3>Prompt + Readable App Data Preview</h3>
                  <p className="source-note">{selectedSection.sourceSummary}</p>
                </div>
              </div>

              <div className="raw-generation-card">
                <div className="mini-card-header">
                  <strong>Editable LAIQ AI Engine input for this section</strong>
                  <span>{report.importSummary.inspectionReference}</span>
                </div>
                <textarea
                  onChange={(event) => handleRawGenerationInputChange(event.target.value)}
                  placeholder="Load mockup data to prepare readable app evidence for this section."
                  value={selectedRawGenerationInput}
                />
                <div className="raw-generation-actions">
                  <button className="toolbar-button toolbar-button-primary" disabled={isGenerating} onClick={handleGenerate} type="button">
                    {isGenerating ? "Generating…" : "Generate Section From This Data"}
                  </button>
                  <small>
                    LAIQ AI Engine receives this editable prompt/data block only when you click Generate.
                  </small>
                </div>
              </div>
            </section>

            <section className="panel-subsection text-pane">
              <div className="subsection-header">
                <div>
                  <p className="eyebrow">Step 2 · AI Draft</p>
                  <h3>Generated Report Content</h3>
                  <p>{selectedSection.templateExpectation}</p>
                </div>
                <div className="mode-toggle">
                  <button
                    className={editorMode === "preview" ? "mode-active" : ""}
                    disabled={!hasGeneratedPreview}
                    onClick={() => setEditorMode("preview")}
                    type="button"
                  >
                    Preview
                  </button>
                  <button
                    className={editorMode === "edit" ? "mode-active" : ""}
                    disabled={!hasGeneratedPreview}
                    onClick={() => setEditorMode("edit")}
                    type="button"
                  >
                    Edit
                  </button>
                </div>
              </div>

              {hasGeneratedPreview && selectedEvalRun ? (
                <div className={`eval-result-card eval-result-${selectedEvalRun.outcomeCode.replace(/_/g, "-")}`}>
                  <div className="eval-result-main">
                    <div>
                      <p className="eyebrow">Eval Guard</p>
                      <h4>{humanizeEvalCode(selectedEvalRun.outcomeCode)}</h4>
                      <p>{selectedEvalRun.summary}</p>
                    </div>
                    <strong>{formatEvalPercent(selectedEvalRun.score)}</strong>
                  </div>
                  <div className="eval-result-grid">
                    <span>
                      Grade
                      <strong>{selectedEvalRun.grade}</strong>
                    </span>
                    <span>
                      Leak risk
                      <strong>{selectedEvalRun.leakage.statusCode}</strong>
                    </span>
                    <span>
                      Missing inputs
                      <strong>{selectedEvalRun.missingUserInputs.missingManualFields.length}</strong>
                    </span>
                  </div>
                  {selectedEvalRun.tuningHints.length > 0 ? (
                    <p className="eval-tuning-hint">{selectedEvalRun.tuningHints[0]}</p>
                  ) : null}
                </div>
              ) : null}

              {!hasGeneratedPreview ? (
                <div className="draft-empty-state">
                  <h4>No generated draft yet</h4>
                  <p>
                    Review or edit the prompt and readable app-data preview above, then click Generate Section From
                    This Data. The generated report section will appear here for editing and approval.
                  </p>
                </div>
              ) : editorMode === "preview" ? (
                <div className="report-preview">
                  <div className="report-heading">
                    <span className="report-heading-number">{selectedSection.number}</span>
                    <span>{selectedSection.title}</span>
                  </div>
                  <div
                    className="report-preview-body"
                    dangerouslySetInnerHTML={{ __html: sanitizeSectionContent(selectedSection.content) }}
                  />
                </div>
              ) : (
                <RichTextSectionEditor content={selectedSection.content} onChange={handleContentChange} />
              )}
            </section>

            <section className="panel-subsection map-pane">
              <div className="subsection-header">
                <div>
                  <p className="eyebrow">Step 3 · Layout Tool</p>
                  <h3>App Layout Maps</h3>
                  <p>
                    {visibleLayoutMap
                      ? "Select Roof, Shell, or Floor, then click a plate, shell region, or marker to inspect linked app evidence."
                      : "This section does not require a layout drawing in the first UI slice."}
                  </p>
                </div>
                {visibleLayoutMap ? (
                  <span className="status-badge status-generated">
                    {formatLayoutSurfaceTab(activeLayoutSurface)}
                  </span>
                ) : null}
              </div>

              {layoutMapSections.length > 0 ? (
                <div className="layout-map-tabs" aria-label="Available imported layout maps">
                  {layoutMapSections.map((section) => {
                    const surface = section.layoutMap?.appMap?.surfaceType;
                    const isActiveMap = surface != null && surface === activeLayoutSurface;
                    return (
                      <button
                        className={`layout-map-tab ${isActiveMap ? "layout-map-tab-active" : ""}`}
                        key={section.id}
                        onClick={() => selectLayoutMapSection(section)}
                        type="button"
                      >
                        {formatLayoutSurfaceTab(surface)}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {visibleLayoutMap ? (
                <LayoutMapEditor
                  activeMarkerId={activeMarkerId}
                  activePlateId={activePlateId}
                  layoutMap={visibleLayoutMap}
                  onLayoutMapChange={persistLayoutMap}
                  onMarkerSelect={setActiveMarkerId}
                  onPlateSelect={setActivePlateId}
                />
              ) : (
                <div className="empty-map-pane">
                  <p>Lower workspace is available for maps, sketches, photos, or form-like visual blocks when a section requires them.</p>
                </div>
              )}
            </section>
          </div>
        </section>

        <aside className="rightbar" aria-label="AI command and missing content panel">
          <section className="panel ai-command-panel">
            <div className="assistant-panel-header">
              <div>
                <p className="eyebrow">AI Command</p>
                <h3>LAIQ AI Engine</h3>
                <p className="source-note">
                  Idle until you send feedback or click Generate.
                </p>
              </div>
              <span className={`ai-state-pill ${isChatBusy ? "ai-state-pill-busy" : ""}`}>
                {isChatBusy ? "Thinking" : "Idle"}
              </span>
            </div>

            <div className="assistant-section-context">
              <div>
                <span>Section</span>
                <strong>
                  {selectedSection.number} · {selectedSection.title}
                </strong>
              </div>
              <span className={`assistant-missing-pill ${unresolvedMissingCount > 0 ? "assistant-missing-pill-alert" : ""}`}>
                {unresolvedMissingCount} missing
              </span>
              {selectedSection.missingFields.length > 0 ? (
                <div className="missing-inline-list" aria-label="Missing fields for this section">
                  {selectedSection.missingFields.map((field) => (
                    <MissingFieldInlineEditor
                      field={field}
                      key={field.id}
                      onChange={(value) => handleFieldChange(field.id, value)}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            <div className="chat-thread" aria-label="Assistant conversation" ref={chatThreadRef}>
              {currentChat.map((message, index) => (
                <div className={`chat-bubble chat-${message.role}`} key={message.id}>
                  <span className="chat-role">{message.role}</span>
                  <p>{message.content}</p>
                  {shouldShowQuickReplies(message, index) ? (
                    <div className="quick-reply-row" aria-label="Quick replies">
                      <button className="quick-reply-button" onClick={() => handleQuickReply("Yes")} type="button">
                        Yes
                      </button>
                      <button className="quick-reply-button" onClick={() => handleQuickReply("No")} type="button">
                        No
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="chat-composer">
              <textarea
                aria-label="Feedback / tool command"
                id="section-chat-input"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleChatSend();
                  }
                }}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Ask LAIQ AI to refine this section..."
                value={chatInput}
              />
              <button
                className="chat-send-button"
                disabled={isChatBusy || !chatInput.trim()}
                onClick={handleChatSend}
                type="button"
              >
                {isChatBusy ? "..." : "Send"}
              </button>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

function MissingFieldInlineEditor({
  field,
  onChange,
}: {
  field: MissingField;
  onChange: (value: string) => void;
}) {
  const isMissing = !field.value.trim();

  return (
    <label className={`missing-inline-row ${isMissing ? "missing-inline-row-open" : "missing-inline-row-complete"}`}>
      <span>{field.label}</span>
      {field.input === "textarea" ? (
        <textarea onChange={(event) => onChange(event.target.value)} value={field.value} />
      ) : field.input === "select" ? (
        <select onChange={(event) => onChange(event.target.value)} value={field.value}>
          <option value="">Select…</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input onChange={(event) => onChange(event.target.value)} type="text" value={field.value} />
      )}
    </label>
  );
}

export default App;
