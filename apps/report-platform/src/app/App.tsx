import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
} from "../lib/reportContent";
import {
  approveSection as approveSectionApi,
  downloadFinalReportDocx,
  generateSection as generateSectionApi,
  resetReportDrafts as resetReportDraftsApi,
  saveLayoutOverride as saveLayoutOverrideApi,
  saveManualInputs as saveManualInputsApi,
  saveSectionDraft as saveSectionDraftApi,
  sendSectionChat as sendSectionChatApi,
} from "../lib/reportApi";

type ImportSummaryWithClassification = WorkspaceReport["importSummary"] & {
  reportClassification: ReportClassification;
};

function deriveStatus(section: ReportSection, generatedPreviewSectionIds?: Set<string>): SectionStatus {
  const hasGeneratedPreview = generatedPreviewSectionIds == null || generatedPreviewSectionIds.has(section.id);

  if (section.approved) return "approved";
  if (!hasGeneratedPreview) return "not started";
  return "editing";
}

function cloneReport(report: WorkspaceReport): WorkspaceReport {
  return JSON.parse(JSON.stringify(report)) as WorkspaceReport;
}

const LAYOUT_SURFACE_ORDER: LayoutSurfaceType[] = ["roof", "shell", "floor"];
const MIN_SIDE_PANEL_WIDTH = 240;
const MAX_SIDE_PANEL_WIDTH = 560;
const DEFAULT_LEFT_PANEL_WIDTH = 340;
const DEFAULT_RIGHT_PANEL_WIDTH = 340;

function formatLayoutSurfaceTab(surface: LayoutSurfaceType | undefined) {
  if (surface === "roof") return "Roof";
  if (surface === "shell") return "Shell";
  if (surface === "floor") return "Floor";
  return "Layout";
}

function formatErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected backend error.";
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

function getReportTocSections(report: WorkspaceReport | null): ReportSection[] {
  return report?.sections.filter((section) => section.id !== "cover") ?? [];
}

function formatTocTitle(section: ReportSection): string {
  return section.title.toUpperCase();
}

function formatTocNumber(section: ReportSection): string {
  const appendixMatch = /^appendix\s+(.+)$/i.exec(section.number.trim());
  return appendixMatch ? `Appx ${appendixMatch[1].toUpperCase()}` : section.number;
}

function resetReportOutputState(report: WorkspaceReport): WorkspaceReport {
  return {
    ...report,
    sections: report.sections.map((section) => ({
      ...section,
      content: "",
      generated: false,
      edited: false,
      approved: false,
      reviewRequired: false,
    })),
  };
}

function getSectionPageLabel(section: ReportSection): string {
  const match = section.description.match(/\bpage\s+(\d+)/i);
  return match ? match[1] : "";
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

function rawInputStorageKey(reportId: string) {
  return `laiq-report-raw-inputs:${reportId}`;
}

function loadSavedRawGenerationInputs(reportId: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(rawInputStorageKey(reportId));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveRawGenerationInputs(reportId: string, inputs: Record<string, string>) {
  window.localStorage.setItem(rawInputStorageKey(reportId), JSON.stringify(inputs));
}

function App() {
  const [report, setReport] = useState<WorkspaceReport | null>(null);
  const [baselineReport, setBaselineReport] = useState<WorkspaceReport | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState("");
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
  const [isGenerationDialogOpen, setIsGenerationDialogOpen] = useState(false);
  const [selectedGenerationSectionIds, setSelectedGenerationSectionIds] = useState<Set<string>>(() => new Set());
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedExportSectionIds, setSelectedExportSectionIds] = useState<Set<string>>(() => new Set());
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isRawDataExpanded, setIsRawDataExpanded] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(DEFAULT_LEFT_PANEL_WIDTH);
  const [rightPanelWidth, setRightPanelWidth] = useState(DEFAULT_RIGHT_PANEL_WIDTH);
  const chatThreadRef = useRef<HTMLDivElement | null>(null);

  const handleLoadMockupData = async () => {
    setIsLoadingData(true);
    setLoadError(null);
    setFlashMessage("Loading and pre-processing the V10 Android V2 Product export...");

    try {
      const bootstrap = await loadWorkspaceBootstrap();
      const resetState = await resetReportDraftsApi(bootstrap.report);
      const resetHydration = hydrateWorkspaceFromApiState(resetState, getHydrationApiBaseUrl(bootstrap.report));
      const nextReport = resetReportOutputState(cloneReport(resetHydration.baselineReport));
      setReport(nextReport);
      setBaselineReport(cloneReport(nextReport));

      const defaultSection =
        nextReport.sections.find((section) => section.id === "scope-of-inspection")?.id ??
        nextReport.sections[0]?.id ??
        "";

      setSelectedSectionId(defaultSection);
      setChats(buildInitialChats(nextReport));
      const defaultRawInputs = Object.fromEntries(
        nextReport.sections.map((section) => [section.id, buildDefaultRawGenerationInput(section)]),
      );
      setRawGenerationInputs(
        {
          ...defaultRawInputs,
          ...loadSavedRawGenerationInputs(nextReport.id),
        },
      );
      setGeneratedPreviewSectionIds(new Set());
      setEvalRuns({});
      setGenerationProgress(null);
      setIsGenerationDialogOpen(false);
      setSelectedGenerationSectionIds(new Set());
      setIsExportDialogOpen(false);
      setSelectedExportSectionIds(new Set());
      setIsRawDataExpanded(false);
      setFlashMessage(
        "Loaded V10 mockup export as evidence only. Click Generate Sections and choose which sections to create.",
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
        editing: 0,
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
        editing: 0,
        approved: 0,
      },
    );
  }, [generatedPreviewSectionIds, report]);

  const reportTocSections = useMemo(() => getReportTocSections(report), [report]);
  const selectedGenerationCount = reportTocSections.filter((section) =>
    selectedGenerationSectionIds.has(section.id),
  ).length;
  const approvedExportSections = useMemo(
    () => reportTocSections.filter((section) => section.approved),
    [reportTocSections],
  );
  const selectedExportCount = approvedExportSections.filter((section) =>
    selectedExportSectionIds.has(section.id),
  ).length;

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
  const workspaceGridStyle = useMemo(
    () =>
      ({
        "--left-panel-width": `${leftPanelWidth}px`,
        "--right-panel-width": `${rightPanelWidth}px`,
      }) as CSSProperties,
    [leftPanelWidth, rightPanelWidth],
  );

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
            <small>No LAIQ AI Engine generation runs until you click Generate Sections or use the chat panel.</small>
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

  const beginPanelResize = (
    panel: "left" | "right",
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panel === "left" ? leftPanelWidth : rightPanelWidth;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextWidth =
        panel === "left"
          ? startWidth + delta
          : startWidth - delta;
      const maxWidth = Math.min(MAX_SIDE_PANEL_WIDTH, Math.max(MIN_SIDE_PANEL_WIDTH, window.innerWidth * 0.42));
      const clampedWidth = clampNumber(nextWidth, MIN_SIDE_PANEL_WIDTH, maxWidth);

      if (panel === "left") {
        setLeftPanelWidth(clampedWidth);
      } else {
        setRightPanelWidth(clampedWidth);
      }
    };

    const handlePointerUp = () => {
      document.body.classList.remove("is-resizing-panels");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    document.body.classList.add("is-resizing-panels");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  };

  const selectReportSection = (section: ReportSection) => {
    setSelectedSectionId(section.id);
    setIsRawDataExpanded(false);
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

  const handleSaveRawGenerationInput = () => {
    try {
      saveRawGenerationInputs(report.id, rawGenerationInputs);
      setFlashMessage(`Saved LAIQ AI Engine input for ${selectedSection.title}.`);
    } catch (error) {
      setFlashMessage(`Unable to save LAIQ AI Engine input: ${formatErrorMessage(error)}`);
    }
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

  const openExportDialog = () => {
    const approvedIds = new Set(approvedExportSections.map((section) => section.id));
    setSelectedExportSectionIds(approvedIds);
    setIsExportDialogOpen(true);
    setFlashMessage(
      approvedIds.size > 0
        ? `Select approved sections to export. ${approvedIds.size} approved section${approvedIds.size === 1 ? "" : "s"} are available.`
        : "No approved sections are available for DOCX export yet.",
    );
  };

  const openGenerationDialog = () => {
    const defaultIds = new Set(
      reportTocSections
        .filter((section) => !section.approved)
        .map((section) => section.id),
    );
    setSelectedGenerationSectionIds(defaultIds);
    setIsGenerationDialogOpen(true);
    setIsExportDialogOpen(false);
    setFlashMessage(
      defaultIds.size > 0
        ? `Select report sections to generate. ${defaultIds.size} non-approved section${defaultIds.size === 1 ? "" : "s"} selected by default.`
        : "All visible report sections are approved. Select a section only if you want to regenerate it.",
    );
  };

  const closeGenerationDialog = () => {
    setIsGenerationDialogOpen(false);
    if (!isGenerating) {
      setFlashMessage("Generation queue closed. Choose a section or reopen Generate Sections when ready.");
    }
  };

  const toggleGenerationSection = (sectionId: string) => {
    setSelectedGenerationSectionIds((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const setAllGenerationSections = (selected: boolean) => {
    setSelectedGenerationSectionIds(
      selected ? new Set(reportTocSections.map((section) => section.id)) : new Set(),
    );
  };

  const toggleExportSection = (sectionId: string) => {
    setSelectedExportSectionIds((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleExportSelectedDocx = async () => {
    const sectionIds = approvedExportSections
      .filter((section) => selectedExportSectionIds.has(section.id))
      .map((section) => section.id);

    if (sectionIds.length === 0) {
      setFlashMessage("Tick at least one approved section before exporting DOCX.");
      return;
    }

    setIsExportingDocx(true);
    setFlashMessage(`Exporting ${sectionIds.length} approved section${sectionIds.length === 1 ? "" : "s"} to DOCX...`);

    try {
      await downloadFinalReportDocx(report, sectionIds);
      setIsExportDialogOpen(false);
      setFlashMessage(`DOCX export created with ${sectionIds.length} approved selected section${sectionIds.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setFlashMessage(`Unable to export DOCX: ${formatErrorMessage(error)}`);
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleGenerateSelectedSections = async () => {
    if (!report) return;

    const sectionsToGenerate = reportTocSections.filter((section) =>
      selectedGenerationSectionIds.has(section.id),
    );
    if (sectionsToGenerate.length === 0) {
      setFlashMessage("Select at least one report section before starting generation.");
      return;
    }

    setIsGenerating(true);
    setEvalRuns((current) => {
      const next = { ...current };
      for (const section of sectionsToGenerate) {
        delete next[section.id];
      }
      return next;
    });
    setGeneratedPreviewSectionIds((current) => {
      const next = new Set(current);
      for (const section of sectionsToGenerate) {
        next.delete(section.id);
      }
      return next;
    });
    setIsGenerationDialogOpen(false);
    setIsExportDialogOpen(false);

    let workingReport = report;

    try {
      for (let index = 0; index < sectionsToGenerate.length; index += 1) {
        const sectionId = sectionsToGenerate[index].id;
        const section = workingReport.sections.find((item) => item.id === sectionId) ?? sectionsToGenerate[index];
        const label = `${index + 1}/${sectionsToGenerate.length} · ${section.title}`;

        setGenerationProgress({
          current: index,
          total: sectionsToGenerate.length,
          label: `Generating ${label}`,
        });
        setSelectedSectionId(section.id);
        setFlashMessage(`Generating section ${label}.`);

        await saveManualInputsApi(workingReport, section);
        const userInstruction = rawGenerationInputs[section.id] ?? buildDefaultRawGenerationInput(section);
        const payload = await generateSectionApi(workingReport, section.id, userInstruction);
        const hydrated = hydrateWorkspaceFromApiState(payload, getHydrationApiBaseUrl(workingReport));
        const generatedSection = hydrated.report.sections.find((item) => item.id === section.id);

        if (generatedSection) {
          workingReport = {
            ...workingReport,
            sections: workingReport.sections.map((item) =>
              item.id === generatedSection.id
                ? {
                    ...generatedSection,
                    approved: false,
                  }
                : item,
            ),
          };
          setReport(cloneReport(workingReport));
        }

        setBaselineReport(resetReportOutputState(cloneReport(hydrated.baselineReport)));
        setGeneratedPreviewSectionIds((current) => new Set(current).add(section.id));

        if (payload.aiStatus) {
          setAiStatus(payload.aiStatus);
        }
        if (payload.evalRun) {
          setEvalRuns((current) => ({
            ...current,
            [section.id]: payload.evalRun as ApiEvalRun,
          }));
        }
      }

      setGenerationProgress({
        current: sectionsToGenerate.length,
        total: sectionsToGenerate.length,
        label: "Selected report sections generated. Review each section and approve the final output.",
      });
      setFlashMessage("Generated the selected report sections one by one. Review the yellow sections and approve them when ready.");
    } catch (error) {
      setFlashMessage(`Generation stopped: ${formatErrorMessage(error)}`);
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

      const controlledModeLabels: Record<string, string> = {
        deterministic_guard: "clarification guard",
        deterministic_state_guard: "helpdesk guard",
        deterministic_table_formatter: "table formatter",
      };
      const controlledModeLabel = controlledModeLabels[reply.providerCode];
      const modeMessage = reply.usedLiveModel
        ? `LAIQ AI Engine replied for ${selectedSection.title}${reply.modelId ? ` using ${reply.modelId}` : ""}.`
        : controlledModeLabel
          ? `LAIQ AI Engine used controlled ${controlledModeLabel} mode for ${selectedSection.title}.`
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
      if (action.type === "apply_text_style" && !hasGeneratedPreview) {
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
        generated: true,
        edited: true,
        approved: false,
      };

      updateSection(selectedSection.id, (section) => ({
        ...section,
        content: nextContent,
        generated: true,
        edited: true,
        approved: false,
      }));
      setGeneratedPreviewSectionIds((current) => new Set(current).add(selectedSection.id));

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
          <button
            className="topbar-generate-button"
            disabled={isGenerating}
            onClick={openGenerationDialog}
            type="button"
          >
            {isGenerating ? "Generating" : "Generate"}
          </button>
          <button
            className="topbar-export-button"
            disabled={approvedExportSections.length === 0 || isExportingDocx}
            onClick={openExportDialog}
            type="button"
          >
            {isExportingDocx ? "Exporting" : "Final DOCX"}
          </button>
        </div>
      </header>

      <div className="flash-banner">{flashMessage}</div>
      {generationProgress ? (
        <div className="generation-progress-line" aria-label="Report generation progress">
          <div
            className="generation-progress-fill"
            style={{
              width: `${Math.round((generationProgress.current / Math.max(generationProgress.total, 1)) * 100)}%`,
            }}
          />
          <span>{generationProgress.label}</span>
        </div>
      ) : null}
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

      <main className="workspace-grid" style={workspaceGridStyle}>
        <aside className="panel sidebar">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Table of Contents</p>
              <h2>22PE1-4 Sections</h2>
            </div>
            <span className="count-pill">{reportTocSections.length}</span>
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
            {reportTocSections.map((section) => {
              const status = deriveStatus(section, generatedPreviewSectionIds);
              const isActive = section.id === selectedSection.id;
              const pageLabel = getSectionPageLabel(section);
              return (
                <button
                  className={`section-item ${isActive ? "section-item-active" : ""}`}
                  key={section.id}
                  onClick={() => selectReportSection(section)}
                  type="button"
                >
                  <div className="toc-row">
                    <span className="section-number">{formatTocNumber(section)}</span>
                    <strong>{formatTocTitle(section)}</strong>
                    <span className="toc-leader" />
                    {pageLabel ? <span className="toc-page">{pageLabel}</span> : null}
                    <span
                      aria-label={`Section status: ${status}`}
                      className={`toc-status-dot status-${status.replace(/\s+/g, "-")}`}
                      title={status}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <div
          aria-label="Resize report section list"
          className="workspace-resizer workspace-resizer-left"
          onPointerDown={(event) => beginPanelResize("left", event)}
          role="separator"
          tabIndex={0}
        />

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
                <div className="raw-data-actions">
                  <button className="toolbar-button" onClick={() => setIsRawDataExpanded((current) => !current)} type="button">
                    {isRawDataExpanded ? "Hide" : "Preview / Edit"}
                  </button>
                  <button className="toolbar-button toolbar-button-primary" onClick={handleSaveRawGenerationInput} type="button">
                    Save Input
                  </button>
                </div>
              </div>

              {isRawDataExpanded ? (
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
                    <small>
                      This section prompt/data block is used by the selected Generate Sections queue.
                    </small>
                  </div>
                </div>
              ) : (
                <div className="raw-generation-collapsed">
                  <strong>Evidence is ready for this section.</strong>
                  <p>
                    Hidden to save workspace height. Open Preview / Edit if you want to tune the prompt or readable
                    app-data block before generation.
                  </p>
                </div>
              )}
            </section>

            <section className="panel-subsection map-pane">
              <div className="subsection-header">
                <div>
                  <p className="eyebrow">Step 2 · Layout Tool</p>
                  <h3>App Layout Maps</h3>
                  <p>
                    {visibleLayoutMap
                      ? "Select Roof, Shell, or Floor, then click a plate, shell region, or marker to inspect linked app evidence."
                      : "This section does not require a layout drawing in the first UI slice."}
                  </p>
                </div>
                {visibleLayoutMap ? (
                  <span className="layout-surface-pill">
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

            <section className="panel-subsection text-pane">
              <div className="subsection-header">
                <div>
                  <p className="eyebrow">Step 3 · AI Draft</p>
                  <h3>Generated Report Content</h3>
                  <p>{selectedSection.templateExpectation}</p>
                </div>
                <div className="output-card-actions">
                  <span className={`output-approval-pill ${selectedSection.approved ? "output-approval-pill-approved" : ""}`}>
                    {selectedSection.approved ? "Approved" : "Pending approval"}
                  </span>
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
                    Choose this section from Generate Sections. After generation, the editable report output will appear
                    here for review and approval.
                  </p>
                </div>
              ) : (
                <>
                  {safeLayoutMap && selectedSection.kind === "map" ? (
                    <div className="generated-map-figure-card">
                      <div className="generated-map-figure-header">
                        <div>
                          <p className="eyebrow">DOCX Figure</p>
                          <h4>Layout map included with this approved section</h4>
                        </div>
                        <span>Exports with DOCX</span>
                      </div>
                      <LayoutMapEditor
                        activeMarkerId={activeMarkerId}
                        activePlateId={activePlateId}
                        layoutMap={safeLayoutMap}
                        onLayoutMapChange={persistLayoutMap}
                        onMarkerSelect={setActiveMarkerId}
                        onPlateSelect={setActivePlateId}
                        showEvidenceInspector={false}
                        variant="reportFigure"
                      />
                    </div>
                  ) : null}
                  <RichTextSectionEditor content={selectedSection.content} onChange={handleContentChange} />
                  <div className="content-approval-footer">
                    <div>
                      <strong>{selectedSection.approved ? "Output approved" : "Ready after review?"}</strong>
                      <span>
                        {unresolvedMissingCount > 0
                          ? `${unresolvedMissingCount} missing field${unresolvedMissingCount === 1 ? "" : "s"} must be completed before approval.`
                          : "Approve this generated section after reviewing the wording, tables, and evidence."}
                      </span>
                    </div>
                    <button
                      className="toolbar-button toolbar-button-primary approve-output-button"
                      disabled={!hasGeneratedPreview || selectedSection.approved}
                      onClick={handleApprove}
                      type="button"
                    >
                      Approve Output
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        </section>

        <div
          aria-label="Resize LAIQ AI Engine panel"
          className="workspace-resizer workspace-resizer-right"
          onPointerDown={(event) => beginPanelResize("right", event)}
          role="separator"
          tabIndex={0}
        />

        <aside className="rightbar" aria-label="AI command and missing content panel">
          <section className="panel ai-command-panel">
            <div className="assistant-panel-header">
              <div>
                <p className="eyebrow">AI Command</p>
                <h3>LAIQ AI Engine</h3>
                <p className="source-note">
                  Idle until you send feedback or click Generate Sections.
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

      {isGenerationDialogOpen ? (
        <div className="export-dialog-backdrop" role="presentation">
          <section className="export-dialog-card panel" aria-label="Select sections for report generation">
            <div className="export-dialog-header">
              <div>
                <p className="eyebrow">Report Generation Queue</p>
                <h3>Select Sections To Generate</h3>
                <p>
                  LAIQ AI Engine will generate only the sections you tick, one by one, using the saved readable app
                  data and precedent format rules.
                </p>
              </div>
              <button
                className="dialog-close-button"
                disabled={isGenerating}
                onClick={closeGenerationDialog}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="dialog-secondary-actions">
              <button className="toolbar-button" disabled={isGenerating} onClick={() => setAllGenerationSections(true)} type="button">
                Select All
              </button>
              <button className="toolbar-button" disabled={isGenerating} onClick={() => setAllGenerationSections(false)} type="button">
                Clear
              </button>
            </div>

            <div className="export-section-list generation-section-list">
              {reportTocSections.map((section) => {
                const status = deriveStatus(section, generatedPreviewSectionIds);
                return (
                  <label className="export-section-row generation-section-row" key={section.id}>
                    <input
                      checked={selectedGenerationSectionIds.has(section.id)}
                      disabled={isGenerating}
                      onChange={() => toggleGenerationSection(section.id)}
                      type="checkbox"
                    />
                    <span className="export-section-number">{formatTocNumber(section)}</span>
                    <strong>{formatTocTitle(section)}</strong>
                    <span className="toc-leader" />
                    <span className={`generation-section-status status-${status.replace(/\s+/g, "-")}`}>
                      {status}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="export-dialog-actions">
              <span>
                {selectedGenerationCount} of {reportTocSections.length} section
                {reportTocSections.length === 1 ? "" : "s"} selected
              </span>
              <button
                className="toolbar-button toolbar-button-primary"
                disabled={isGenerating || selectedGenerationCount === 0}
                onClick={handleGenerateSelectedSections}
                type="button"
              >
                {isGenerating ? "Generating..." : "Generate Selected"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isExportDialogOpen ? (
        <div className="export-dialog-backdrop" role="presentation">
          <section className="export-dialog-card panel" aria-label="Export approved sections to DOCX">
            <div className="export-dialog-header">
              <div>
                <p className="eyebrow">Final DOCX Export</p>
                <h3>Select Approved Sections</h3>
                <p>
                  Only approved sections are available here. The DOCX will include only the sections you tick.
                </p>
              </div>
              <button
                className="dialog-close-button"
                disabled={isExportingDocx}
                onClick={() => setIsExportDialogOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            {approvedExportSections.length === 0 ? (
              <div className="export-empty-state">
                <strong>No approved sections yet.</strong>
                <p>Generate a section, review it, then click Approve Output before exporting DOCX.</p>
              </div>
            ) : (
              <div className="export-section-list">
                {approvedExportSections.map((section) => (
                  <label className="export-section-row" key={section.id}>
                    <input
                      checked={selectedExportSectionIds.has(section.id)}
                      disabled={isExportingDocx}
                      onChange={() => toggleExportSection(section.id)}
                      type="checkbox"
                    />
                    <span className="export-section-number">{formatTocNumber(section)}</span>
                    <strong>{formatTocTitle(section)}</strong>
                    <span className="toc-leader" />
                    <span className="toc-page">{getSectionPageLabel(section)}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="export-dialog-actions">
              <span>
                {selectedExportCount} of {approvedExportSections.length} approved section
                {approvedExportSections.length === 1 ? "" : "s"} selected
              </span>
              <button
                className="toolbar-button toolbar-button-primary"
                disabled={isExportingDocx || selectedExportCount === 0}
                onClick={handleExportSelectedDocx}
                type="button"
              >
                {isExportingDocx ? "Exporting..." : "Export Selected DOCX"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
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
  const hasSuggestion = Boolean(field.suggestion?.trim());

  return (
    <label className={`missing-inline-row ${isMissing ? "missing-inline-row-open" : "missing-inline-row-complete"}`}>
      <span>{field.label}</span>
      <small>
        {field.source} · {field.reason}
      </small>
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
      {hasSuggestion ? (
        <button className="missing-suggestion-button" onClick={() => onChange(field.suggestion ?? "")} type="button">
          Use suggestion: {field.suggestion}
        </button>
      ) : null}
    </label>
  );
}

export default App;
