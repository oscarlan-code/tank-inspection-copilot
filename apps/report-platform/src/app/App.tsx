import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  LayoutMapEditor,
} from "../components/LayoutMapEditor";
import { AccountManagement } from "../components/AccountManagement";
import { EvaluationLab } from "../components/EvaluationLab";
import { KnowledgeBaseReview } from "../components/KnowledgeBaseReview";
import { RichTextSectionEditor } from "../components/RichTextSectionEditor";
import { useAuth } from "../auth/AuthGate";
import {
  type ApiReportJobState,
  type ApiEvalRun,
  type ApiAiStatus,
  buildInitialChats,
  hydrateWorkspaceFromApiState,
  loadWorkspaceBootstrap,
} from "../domain/mockReport";
import type {
  AssistantAction,
  ChatMessage,
  FloorCorrosionOverlay,
  LayoutMapData,
  LayoutSurfaceType,
  MissingField,
  ReportSection,
  SectionStatus,
  TargetedEditAction,
  TargetedEditExecution,
  TargetedEditProposal,
  TargetedEditRequest,
  TargetedEditSelection,
  WorkspaceReport,
} from "../domain/types";
import { ensureLayoutMapData } from "../lib/layoutMapGeometry";
import { isMflCompatibleFloorLayout } from "../fixtures/matchingMflFloorLayout";
import {
  normalizeSectionContent,
} from "../lib/reportContent";
import { createBrowserId } from "../lib/browserId";
import {
  approveSection as approveSectionApi,
  approveFloorCorrosionPlacement,
  downloadFinalReportDocx,
  generateSection as generateSectionApi,
  importFloorCorrosionMfl,
  ReportApiError,
  requestTargetedSectionEdit as requestTargetedSectionEditApi,
  restorePreviousSectionDraft as restorePreviousSectionDraftApi,
  resetReportDrafts as resetReportDraftsApi,
  saveLayoutOverride as saveLayoutOverrideApi,
  saveManualInputValues as saveManualInputValuesApi,
  saveManualInputs as saveManualInputsApi,
  saveSectionDraft as saveSectionDraftApi,
  sendSectionChat as sendSectionChatApi,
} from "../lib/reportApi";
import {
  addDraftSuggestionsToMissingFields,
  applyConfirmedDraftManualInputs,
} from "../lib/manualInputRecognition";
import {
  loadReportInbox,
  loadReportJob,
  type ReportInboxItem,
} from "../lib/reportInboxApi";

function deriveStatus(section: ReportSection, generatedPreviewSectionIds?: Set<string>): SectionStatus {
  const hasGeneratedPreview = generatedPreviewSectionIds == null || generatedPreviewSectionIds.has(section.id);

  if (section.approved) return "approved";
  if (!hasGeneratedPreview) return "not started";
  return "editing";
}

function formatSectionStatus(status: SectionStatus): string {
  return status === "not started" ? "Not started" : status === "editing" ? "Editing" : "Approved";
}

function cloneReport(report: WorkspaceReport): WorkspaceReport {
  return JSON.parse(JSON.stringify(report)) as WorkspaceReport;
}

function applyPersistedRevisions(
  report: WorkspaceReport,
  state: ApiReportJobState,
): WorkspaceReport {
  const draftVersions = new Map(
    (state.sectionDrafts ?? []).map((draft) => [draft.sectionId, draft.version]),
  );
  const layoutVersions = new Map(
    (state.layoutOverrides ?? []).map((layout) => [layout.sectionId, layout.version]),
  );

  return {
    ...report,
    manualInputsRevision: state.reportJob?.manualInputsRevision ?? report.manualInputsRevision,
    sections: report.sections.map((section) => ({
      ...section,
      version: draftVersions.get(section.id) ?? section.version,
      layoutVersion: layoutVersions.get(section.id) ?? section.layoutVersion,
    })),
  };
}

const LAYOUT_SURFACE_ORDER: LayoutSurfaceType[] = ["roof", "shell", "floor"];
const MIN_SIDE_PANEL_WIDTH = 240;
const MAX_SIDE_PANEL_WIDTH = 560;
const DEFAULT_LEFT_PANEL_WIDTH = 340;
const DEFAULT_RIGHT_PANEL_WIDTH = 340;
type WorkspaceContextPanel = "app-data" | "layout-map";
const PREFERRED_LAYOUT_SECTION_IDS: Record<LayoutSurfaceType, string> = {
  roof: "roof-plate-layout",
  shell: "shell-plate-layout",
  floor: "floor-plate-corrosion-plan",
};

function GenerationHourglass() {
  return (
    <svg
      aria-hidden="true"
      className="generation-hourglass-icon"
      viewBox="0 0 24 24"
    >
      <path className="generation-hourglass-frame" d="M6 3h12M6 21h12M7 3v3c0 3 2 4.5 5 6-3 1.5-5 3-5 6v3m10-18v3c0 3-2 4.5-5 6 3 1.5 5 3 5 6v3" />
      <path className="generation-hourglass-sand" d="M9 7h6l-3 3-3-3Zm0 11 3-3 3 3H9Z" />
    </svg>
  );
}

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
  const inlineStyleParts = [
    action.fontFamily ? `font-family: ${action.fontFamily}` : "",
    action.fontSize ? `font-size: ${action.fontSize}` : "",
    action.color ? `color: ${action.color}` : "",
  ].filter(Boolean);
  const blockStyleParts = [
    action.textAlign ? `text-align: ${action.textAlign}` : "",
  ].filter(Boolean);

  if (inlineStyleParts.length === 0 && blockStyleParts.length === 0 && !action.fontWeight) {
    return normalized;
  }

  if (action.styleScope === "table") {
    const tableCellStyleParts = [
      ...inlineStyleParts,
      action.fontWeight ? `font-weight: ${action.fontWeight}` : "",
      ...blockStyleParts,
    ].filter(Boolean);
    return applyTextStyleToTableCells(innerContent, tableCellStyleParts.join("; "));
  }

  return innerContent.replace(
    /<(p|h[1-6]|li)([^>]*)>([\s\S]*?)<\/\1>/gi,
    (match: string, tagName: string, rawAttributes: string, innerHtml: string) => {
      const nextAttributes = blockStyleParts.length > 0
        ? mergeHtmlStyleAttribute(rawAttributes, blockStyleParts.join("; "))
        : rawAttributes;
      let nextInnerHtml = innerHtml;

      if (inlineStyleParts.length > 0) {
        nextInnerHtml = `<span style="${inlineStyleParts.join("; ")}">${nextInnerHtml}</span>`;
      }

      if (action.fontWeight === "bold") {
        nextInnerHtml = `<strong>${nextInnerHtml}</strong>`;
      }

      return `<${tagName}${nextAttributes}>${nextInnerHtml}</${tagName}>`;
    },
  );
}

function applyTextStyleToTableCells(content: string, styleToAdd: string) {
  if (!styleToAdd.trim()) {
    return content;
  }

  return content.replace(
    /<table\b[\s\S]*?<\/table>/gi,
    (tableHtml) =>
      tableHtml.replace(
        /<(th|td)([^>]*)>/gi,
        (_match: string, tagName: string, rawAttributes: string) =>
          `<${tagName}${mergeHtmlStyleAttribute(rawAttributes, styleToAdd)}>`,
      ),
  );
}

function mergeHtmlStyleAttribute(rawAttributes: string, styleToAdd: string) {
  if (!styleToAdd.trim()) {
    return rawAttributes;
  }

  const styleMatch = /\sstyle=(["'])(.*?)\1/i.exec(rawAttributes);
  if (!styleMatch) {
    return `${rawAttributes} style="${styleToAdd}"`;
  }

  const quote = styleMatch[1];
  const existingStyle = styleMatch[2].trim();
  const nextStyle = [existingStyle, styleToAdd].filter(Boolean).join("; ");
  return rawAttributes.replace(styleMatch[0], ` style=${quote}${nextStyle}${quote}`);
}

function buildDefaultRawGenerationInput(section: ReportSection): string {
  return [
    "GENERATION PROMPT / GUIDELINE",
    `Use this app-export evidence to generate the report section: ${section.title}.`,
    section.aiHint,
    "Follow the API-standard vertical AST report template.",
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

function preserveReportOutputAfterLayoutHydration(
  currentReport: WorkspaceReport,
  hydratedReport: WorkspaceReport,
  changedSectionId: string,
): WorkspaceReport {
  const currentSections = new Map(currentReport.sections.map((section) => [section.id, section]));

  return {
    ...hydratedReport,
    sections: hydratedReport.sections.map((hydratedSection) => {
      const currentSection = currentSections.get(hydratedSection.id);
      if (!currentSection) return hydratedSection;

      return {
        ...hydratedSection,
        content: currentSection.content,
        generated: currentSection.generated,
        edited: currentSection.edited,
        approved: hydratedSection.id === changedSectionId ? false : currentSection.approved,
        reviewRequired: hydratedSection.id === changedSectionId ? true : currentSection.reviewRequired,
        version: hydratedSection.version ?? currentSection.version,
        previousVersionCount: currentSection.previousVersionCount,
      };
    }),
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

function rawInputStorageKey(reportId: string, userId: string) {
  return `laiq-report-raw-inputs:${userId}:${reportId}`;
}

function loadSavedRawGenerationInputs(reportId: string, userId: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(rawInputStorageKey(reportId, userId));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveRawGenerationInputs(reportId: string, userId: string, inputs: Record<string, string>) {
  window.localStorage.setItem(rawInputStorageKey(reportId, userId), JSON.stringify(inputs));
}

type TargetedChatTurn = {
  instruction: string;
  proposedText: string;
};

type TargetedChatContext = {
  proposal: TargetedEditProposal | null;
  reportId: string;
  sectionId: string;
  sectionTitle: string;
  selection: TargetedEditSelection;
  turns: TargetedChatTurn[];
};

function targetedEditActionLabel(action: TargetedEditAction) {
  const labels: Record<TargetedEditAction, string> = {
    custom: "Refine",
    enhance: "Enhance",
    rephrase: "Rephrase",
    shorten: "Shorten",
    to_paragraph: "Convert to text",
    to_points: "Convert to points",
  };
  return labels[action];
}

function summarizeSelection(value: string, limit = 180) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1).trimEnd()}…` : normalized;
}

function buildTargetedConversationInstruction(
  turns: TargetedChatTurn[],
  instruction: string,
) {
  const recentTurns = turns.slice(-3);
  if (recentTurns.length === 0) return instruction;

  return [
    "Continue this selection-scoped editing conversation.",
    ...recentTurns.flatMap((turn, index) => [
      `Previous instruction ${index + 1}: ${turn.instruction}`,
      `Previous proposal ${index + 1}: ${turn.proposedText}`,
    ]),
    `Current instruction: ${instruction}`,
    "Return one revised replacement for the original protected selection.",
  ].join("\n");
}

function App() {
  const { principal, signOut } = useAuth();
  const [report, setReport] = useState<WorkspaceReport | null>(null);
  const [baselineReport, setBaselineReport] = useState<WorkspaceReport | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>({});
  const [targetedChatContext, setTargetedChatContext] = useState<TargetedChatContext | null>(null);
  const [externalTargetedEdit, setExternalTargetedEdit] = useState<TargetedEditExecution | null>(null);
  const [flashMessage, setFlashMessage] = useState("Load the V10 LAIQ inspection app V3 mockup export to begin.");
  const [rawGenerationInputs, setRawGenerationInputs] = useState<Record<string, string>>({});
  const [sectionOutputHistory, setSectionOutputHistory] = useState<Record<string, string>>({});
  const [generatedPreviewSectionIds, setGeneratedPreviewSectionIds] = useState<Set<string>>(() => new Set());
  const [evalRuns, setEvalRuns] = useState<Record<string, ApiEvalRun>>({});
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [activePlateId, setActivePlateId] = useState<string | null>(null);
  const [selectedLayoutSurface, setSelectedLayoutSurface] = useState<LayoutSurfaceType>("roof");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<ApiAiStatus | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [reportInbox, setReportInbox] = useState<ReportInboxItem[]>([]);
  const [reportInboxError, setReportInboxError] = useState<string | null>(null);
  const [isLoadingReportInbox, setIsLoadingReportInbox] = useState(true);
  const [showAccountManagement, setShowAccountManagement] = useState(
    () => window.location.pathname.replace(/\/+$/, "") === "/admin/accounts",
  );
  const [showEvaluationLab, setShowEvaluationLab] = useState(
    () => window.location.pathname.replace(/\/+$/, "") === "/admin/evaluation",
  );
  const [showKnowledgeBaseReview, setShowKnowledgeBaseReview] = useState(
    () => window.location.pathname.replace(/\/+$/, "") === "/admin/knowledge-base",
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChatBusy, setIsChatBusy] = useState(false);
  const [isGenerationDialogOpen, setIsGenerationDialogOpen] = useState(false);
  const [selectedGenerationSectionIds, setSelectedGenerationSectionIds] = useState<Set<string>>(() => new Set());
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedExportSectionIds, setSelectedExportSectionIds] = useState<Set<string>>(() => new Set());
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isImportingMfl, setIsImportingMfl] = useState(false);
  const [isUpdatingMflPlacement, setIsUpdatingMflPlacement] = useState(false);
  const [activeContextPanel, setActiveContextPanel] = useState<WorkspaceContextPanel | null>(null);
  const [generationProgress, setGenerationProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);
  const [generatingSectionId, setGeneratingSectionId] = useState<string | null>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(DEFAULT_LEFT_PANEL_WIDTH);
  const [rightPanelWidth, setRightPanelWidth] = useState(DEFAULT_RIGHT_PANEL_WIDTH);
  const chatThreadRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const chatsRef = useRef<Record<string, ChatMessage[]>>({});
  const isSuperAdmin = principal.platformRoles.some(
    (role) => role.trim().toLowerCase() === "super admin",
  );

  const refreshReportInbox = async () => {
    setIsLoadingReportInbox(true);
    setReportInboxError(null);
    try {
      setReportInbox(await loadReportInbox());
    } catch (error) {
      setReportInboxError(formatErrorMessage(error));
    } finally {
      setIsLoadingReportInbox(false);
    }
  };

  useEffect(() => {
    void refreshReportInbox();
  }, [principal.userId]);

  useEffect(() => {
    const handleNavigation = () => {
      const path = window.location.pathname.replace(/\/+$/, "");
      setShowAccountManagement(path === "/admin/accounts");
      setShowEvaluationLab(path === "/admin/evaluation");
      setShowKnowledgeBaseReview(path === "/admin/knowledge-base");
    };
    window.addEventListener("popstate", handleNavigation);
    return () => window.removeEventListener("popstate", handleNavigation);
  }, []);

  const openAccountManagement = () => {
    window.history.pushState({}, "", "/admin/accounts");
    setShowAccountManagement(true);
    setShowEvaluationLab(false);
    setShowKnowledgeBaseReview(false);
  };

  const closeAccountManagement = () => {
    window.history.pushState({}, "", "/");
    setShowAccountManagement(false);
  };

  const openEvaluationLab = () => {
    window.history.pushState({}, "", "/admin/evaluation");
    setShowAccountManagement(false);
    setShowEvaluationLab(true);
    setShowKnowledgeBaseReview(false);
  };

  const closeEvaluationLab = () => {
    window.history.pushState({}, "", "/");
    setShowEvaluationLab(false);
  };

  const openKnowledgeBaseReview = () => {
    window.history.pushState({}, "", "/admin/knowledge-base");
    setShowAccountManagement(false);
    setShowEvaluationLab(false);
    setShowKnowledgeBaseReview(true);
  };

  const closeKnowledgeBaseReview = () => {
    window.history.pushState({}, "", "/");
    setShowKnowledgeBaseReview(false);
  };

  const updateChats = (updater: (current: Record<string, ChatMessage[]>) => Record<string, ChatMessage[]>) => {
    setChats((current) => {
      const next = updater(current);
      chatsRef.current = next;
      return next;
    });
  };

  const appendSectionChatMessage = (sectionId: string, message: ChatMessage) => {
    updateChats((current) => ({
      ...current,
      [sectionId]: [...(current[sectionId] ?? []), message],
    }));
  };

  const handleLoadMockupData = async () => {
    setIsLoadingData(true);
    setLoadError(null);
    setFlashMessage("Loading and pre-processing the V10 LAIQ inspection app V3 export...");

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
      const initialChats = buildInitialChats(nextReport);
      setChats(initialChats);
      chatsRef.current = initialChats;
      const defaultRawInputs = Object.fromEntries(
        nextReport.sections.map((section) => [section.id, buildDefaultRawGenerationInput(section)]),
      );
      setRawGenerationInputs(
        {
          ...defaultRawInputs,
          ...loadSavedRawGenerationInputs(nextReport.id, principal.userId),
        },
      );
      setGeneratedPreviewSectionIds(new Set());
      setTargetedChatContext(null);
      setExternalTargetedEdit(null);
      setSectionOutputHistory({});
      setEvalRuns({});
      setGenerationProgress(null);
      setIsGenerationDialogOpen(false);
      setSelectedGenerationSectionIds(new Set());
      setIsExportDialogOpen(false);
      setSelectedExportSectionIds(new Set());
      setActiveContextPanel(null);
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

  const handleOpenReportJob = async (reportJobId: string) => {
    setIsLoadingData(true);
    setLoadError(null);
    setFlashMessage("Opening the inspection app export and report workspace...");
    try {
      const payload = await loadReportJob(reportJobId);
      const hydration = hydrateWorkspaceFromApiState(payload);
      const nextReport = payload.sectionDrafts?.length
        ? cloneReport(hydration.report)
        : resetReportOutputState(cloneReport(hydration.baselineReport));
      setReport(nextReport);
      setBaselineReport(cloneReport(hydration.baselineReport));
      const defaultSection =
        nextReport.sections.find((section) => section.id === "scope-of-inspection")?.id ??
        nextReport.sections[0]?.id ??
        "";
      setSelectedSectionId(defaultSection);
      const initialChats = buildInitialChats(nextReport);
      setChats(initialChats);
      chatsRef.current = initialChats;
      const defaultRawInputs = Object.fromEntries(
        nextReport.sections.map((section) => [section.id, buildDefaultRawGenerationInput(section)]),
      );
      setRawGenerationInputs({
        ...defaultRawInputs,
        ...loadSavedRawGenerationInputs(nextReport.id, principal.userId),
      });
      setGeneratedPreviewSectionIds(new Set(
        nextReport.sections.filter((section) => section.generated).map((section) => section.id),
      ));
      setTargetedChatContext(null);
      setExternalTargetedEdit(null);
      setSectionOutputHistory({});
      setEvalRuns(payload.evalRun ? { [payload.evalRun.sectionId]: payload.evalRun } : {});
      setGenerationProgress(null);
      setActiveContextPanel(null);
      setActiveMarkerId(null);
      setActivePlateId(null);
      setSelectedLayoutSurface("roof");
      setAiStatus(payload.aiStatus ?? null);
      setFlashMessage("Opened the report created from the authenticated LAIQ inspection app export.");
    } catch (error) {
      setReportInboxError(formatErrorMessage(error));
      setFlashMessage("Unable to open the selected report job.");
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
  const activeTargetedChatContext = report && selectedSection
    && targetedChatContext?.reportId === report.id
    && targetedChatContext?.sectionId === selectedSection.id
    ? targetedChatContext
    : null;
  const selectedRawGenerationInput = rawGenerationInputs[selectedSection?.id ?? ""] ?? "";
  const hasGeneratedPreview = selectedSection
    ? generatedPreviewSectionIds.has(selectedSection.id) || selectedSection.generated
    : false;
  const selectedSectionStatus = selectedSection
    ? deriveStatus(selectedSection, generatedPreviewSectionIds)
    : "not started";
  const isSelectedSectionGenerating = Boolean(
    isGenerating && selectedSection && generatingSectionId === selectedSection.id,
  );
  const selectedEvalRun = selectedSection ? evalRuns[selectedSection.id] : undefined;
  const selectedPreviousOutput = selectedSection ? sectionOutputHistory[selectedSection.id] : undefined;
  const selectedCanRestorePrevious = Boolean(
    selectedPreviousOutput || (selectedSection?.previousVersionCount ?? 0) > 0,
  );
  const unresolvedMissingCount = selectedSection
    ? selectedSection.missingFields.filter((field) => !field.value.trim()).length
    : 0;
  const selectedEvalMatchesManualInputs = useMemo(() => {
    if (!selectedSection || !selectedEvalRun) return true;
    const currentMissingIds = selectedSection.missingFields
      .filter((field) => !field.value.trim())
      .map((field) => field.id)
      .sort();
    const evaluatedMissingIds = selectedEvalRun.missingUserInputs.missingManualFields
      .map((field) => field.fieldKey)
      .sort();
    return currentMissingIds.join("|") === evaluatedMissingIds.join("|");
  }, [selectedEvalRun, selectedSection]);
  const selectedMissingFields = useMemo(
    () => selectedSection
      ? addDraftSuggestionsToMissingFields(selectedSection.missingFields, selectedSection.content)
      : [],
    [selectedSection],
  );
  const layoutMapSections = useMemo(() => {
    const sections = report?.sections ?? [];
    return LAYOUT_SURFACE_ORDER.map((surface) => {
      const preferredSection = sections.find(
        (section) =>
          section.id === PREFERRED_LAYOUT_SECTION_IDS[surface]
          && section.layoutMap?.appMap?.surfaceType === surface,
      );
      return preferredSection
        ?? sections.find((section) => section.layoutMap?.appMap?.surfaceType === surface);
    }).filter((section): section is ReportSection => section != null);
  }, [report]);
  const activeLayoutSection = useMemo(
    () => layoutMapSections.find(
      (section) => section.layoutMap?.appMap?.surfaceType === selectedLayoutSurface,
    ) ?? layoutMapSections[0],
    [layoutMapSections, selectedLayoutSurface],
  );
  const visibleLayoutMap = useMemo(
    () => (activeLayoutSection?.layoutMap ? ensureLayoutMapData(activeLayoutSection.layoutMap) : undefined),
    [activeLayoutSection],
  );
  const activeLayoutSurface = visibleLayoutMap?.appMap?.surfaceType;
  const activeCorrosionOverlay = useMemo(
    () => visibleLayoutMap?.floorCorrosion?.overlays.find((overlay) => overlay.hostPlateId === activePlateId),
    [activePlateId, visibleLayoutMap],
  );

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

  useEffect(() => {
    if (!targetedChatContext) return;
    if (targetedChatContext.reportId === report?.id && targetedChatContext.sectionId === selectedSectionId) return;
    setTargetedChatContext(null);
    setExternalTargetedEdit(null);
  }, [report?.id, selectedSectionId, targetedChatContext]);

  if (showAccountManagement && isSuperAdmin) {
    return <AccountManagement currentUserId={principal.userId} onClose={closeAccountManagement} />;
  }

  if (showEvaluationLab && isSuperAdmin) {
    return (
      <EvaluationLab
        onClose={closeEvaluationLab}
        onOpenAccounts={openAccountManagement}
        onOpenKnowledgeBase={openKnowledgeBaseReview}
        principal={principal}
      />
    );
  }

  if (showKnowledgeBaseReview && isSuperAdmin) {
    return (
      <KnowledgeBaseReview
        onClose={closeKnowledgeBaseReview}
        onOpenAccounts={openAccountManagement}
        onOpenEvaluation={openEvaluationLab}
        principal={principal}
      />
    );
  }

  if (showAccountManagement) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="auth-brand">
            <img alt="LAIQ" className="auth-logo" src="/laiq-logo.png" />
            <div>
              <p className="eyebrow">LAIQ Report Platform</p>
              <h1>Super Admin access required</h1>
            </div>
          </div>
          <p className="auth-intro">This account cannot manage platform users.</p>
          <button className="auth-retry-button" onClick={closeAccountManagement} type="button">
            Back to reports
          </button>
        </section>
      </main>
    );
  }

  if (showEvaluationLab) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="auth-brand">
            <img alt="LAIQ" className="auth-logo" src="/laiq-logo.png" />
            <div>
              <p className="eyebrow">LAIQ Report Platform</p>
              <h1>Super Admin access required</h1>
            </div>
          </div>
          <p className="auth-intro">The Evaluation Lab is isolated from inspector report workspaces.</p>
          <button className="auth-retry-button" onClick={closeEvaluationLab} type="button">
            Back to reports
          </button>
        </section>
      </main>
    );
  }

  if (showKnowledgeBaseReview) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="auth-brand">
            <img alt="LAIQ" className="auth-logo" src="/laiq-logo.png" />
            <div>
              <p className="eyebrow">LAIQ Report Platform</p>
              <h1>Super Admin access required</h1>
            </div>
          </div>
          <p className="auth-intro">Knowledge-base ingestion review is isolated from inspector report workspaces.</p>
          <button className="auth-retry-button" onClick={closeKnowledgeBaseReview} type="button">
            Back to reports
          </button>
        </section>
      </main>
    );
  }

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
        <header className="report-inbox-topbar">
          <div className="brand-lockup">
            <img alt="LAIQ logo" className="brand-logo" src="/laiq-logo.png" />
            <div>
              <p className="eyebrow">LAIQ Report Platform</p>
              <h1>Your Inspection Reports</h1>
            </div>
          </div>
          <div className="report-inbox-actions">
            {isSuperAdmin ? (
              <>
                <button className="toolbar-button toolbar-button-primary" onClick={openKnowledgeBaseReview} type="button">
                  Review KB
                </button>
                <button className="toolbar-button toolbar-button-primary" onClick={openEvaluationLab} type="button">
                  Evaluation Lab
                </button>
                <button className="toolbar-button" onClick={openAccountManagement} type="button">
                  Manage accounts
                </button>
              </>
            ) : null}
            <div className="topbar-account" title={`${principal.tenantName} · ${principal.userId}`}>
              <span>{principal.displayName}</span>
              <button onClick={() => void signOut()} type="button">Sign out</button>
            </div>
          </div>
        </header>

        <main className="report-inbox-shell">
          <section className="report-inbox-heading">
            <div>
              <p className="eyebrow">Connected App Data</p>
              <h2>Reports received from the LAIQ inspection app</h2>
              <p>Sign in to the inspection app with this same account, export a task, and send it here. It will appear in this list.</p>
            </div>
            <button className="toolbar-button" disabled={isLoadingReportInbox} onClick={() => void refreshReportInbox()} type="button">
              {isLoadingReportInbox ? "Refreshing..." : "Refresh"}
            </button>
          </section>

          {reportInboxError ? <p className="admin-feedback admin-feedback-error">{reportInboxError}</p> : null}
          {isLoadingReportInbox ? <p className="report-inbox-empty">Loading connected reports...</p> : null}
          {!isLoadingReportInbox && reportInbox.filter((item) => !item.isDemo).length === 0 ? (
            <div className="report-inbox-empty">
              <strong>No app exports received yet.</strong>
              <span>Use Send to Report Platform from the inspection app, then refresh this page.</span>
            </div>
          ) : null}

          <div className="report-inbox-grid">
            {reportInbox.filter((item) => !item.isDemo).map((item) => (
              <button
                className="report-inbox-card"
                disabled={isLoadingData}
                key={item.reportJobId}
                onClick={() => void handleOpenReportJob(item.reportJobId)}
                type="button"
              >
                <span className="report-inbox-card-status">{item.statusCode}</span>
                <strong>{item.reportReference}</strong>
                <span>{item.client} · {item.tank}</span>
                <small>{item.workspaceName} · Updated {new Date(item.updatedAtIso).toLocaleString()}</small>
              </button>
            ))}
          </div>

          <section className="report-demo-panel">
            <div>
              <p className="eyebrow">Demo Workspace</p>
              <h2>V10 training package</h2>
              <p>Use the synthetic fixture only for demonstrations and report-generation testing.</p>
            </div>
            <button className="toolbar-button toolbar-button-primary" disabled={isLoadingData} onClick={handleLoadMockupData} type="button">
              {isLoadingData ? "Loading..." : "Open demo report"}
            </button>
          </section>
          <small className="report-inbox-note">No LAIQ AI Engine generation runs until you explicitly choose Generate.</small>
        </main>
      </div>
    );
  }

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

  const snapshotSectionOutput = (section: ReportSection) => {
    const normalizedContent = normalizeSectionContent(section.content);
    if (!normalizedContent || normalizedContent === "<p></p>") {
      return;
    }

    setSectionOutputHistory((current) => ({
      ...current,
      [section.id]: normalizedContent,
    }));
  };

  const setLocalRollbackOutput = (sectionId: string, content: string) => {
    const normalizedContent = normalizeSectionContent(content);
    if (!normalizedContent || normalizedContent === "<p></p>") {
      setSectionOutputHistory((current) => {
        const next = { ...current };
        delete next[sectionId];
        return next;
      });
      return;
    }

    setSectionOutputHistory((current) => ({
      ...current,
      [sectionId]: normalizedContent,
    }));
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
    setActiveContextPanel(null);
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
    const manualState = await saveManualInputsApi(report, section);
    let persistedReport = applyPersistedRevisions(report, manualState);
    let state = await saveSectionDraftApi(persistedReport, section);
    persistedReport = applyPersistedRevisions(persistedReport, state);

    if (includeLayoutOverride && section.layoutMap) {
      state = await saveLayoutOverrideApi(persistedReport, section.id, ensureLayoutMapData(section.layoutMap));
    }
    syncPersistedSectionVersion(section.id, state);
    return state;
  };

  const syncPersistedSectionVersion = (_sectionId: string, state: ApiReportJobState) => {
    setReport((current) => current ? applyPersistedRevisions(current, state) : current);
  };

  const handleContentChange = (value: string) => {
    updateSection(selectedSection.id, (section) => ({
      ...section,
      content: value,
      edited: true,
      approved: false,
    }));
  };

  const handleTargetedEditRequested = (request: {
    action: TargetedEditAction;
    instruction: string;
    selectedText: string;
  }) => {
    appendSectionChatMessage(selectedSection.id, {
      id: createBrowserId("targeted-user"),
      role: "user",
      content: request.instruction
        ? `${targetedEditActionLabel(request.action)} selected content: ${request.instruction}`
        : `${targetedEditActionLabel(request.action)} the selected content.`,
      scope: "selection",
      selectionPreview: summarizeSelection(request.selectedText),
    });
  };

  const handleContinueTargetedEditInChat = (selection: TargetedEditSelection) => {
    const context: TargetedChatContext = {
      proposal: null,
      reportId: report.id,
      sectionId: selectedSection.id,
      sectionTitle: selectedSection.title,
      selection,
      turns: [],
    };
    setTargetedChatContext(context);
    setExternalTargetedEdit(null);
    appendSectionChatMessage(selectedSection.id, {
      id: createBrowserId("targeted-handoff"),
      role: "assistant",
      content: "Selection mode is active. Ask a follow-up below; I will change only the pinned text and preserve the rest of the section.",
      scope: "selection",
      selectionPreview: summarizeSelection(selection.selectedText),
    });
    setFlashMessage(`Transferred the highlighted content to the LAIQ AI Engine for ${selectedSection.title}.`);
    window.requestAnimationFrame(() => chatInputRef.current?.focus({ preventScroll: false }));
  };

  const handleCancelTargetedChat = () => {
    if (activeTargetedChatContext) {
      appendSectionChatMessage(activeTargetedChatContext.sectionId, {
        id: createBrowserId("targeted-exit"),
        role: "assistant",
        content: "Exited selection mode without changing the selected content.",
        scope: "selection",
        selectionPreview: summarizeSelection(activeTargetedChatContext.selection.selectedText),
      });
    }
    setTargetedChatContext(null);
    setExternalTargetedEdit(null);
    setFlashMessage("Selection-scoped AI editing was cancelled. The report draft was not changed.");
  };

  const handleApplyTargetedChatProposal = () => {
    if (!activeTargetedChatContext?.proposal) return;
    setExternalTargetedEdit({
      executionId: createBrowserId("targeted-execution"),
      proposal: activeTargetedChatContext.proposal,
      selection: activeTargetedChatContext.selection,
    });
  };

  const handleExternalTargetedEditComplete = (result: { applied: boolean; executionId: string }) => {
    setExternalTargetedEdit((current) => current?.executionId === result.executionId ? null : current);
    if (result.applied || !activeTargetedChatContext) return;
    appendSectionChatMessage(activeTargetedChatContext.sectionId, {
      id: createBrowserId("targeted-failed"),
      role: "assistant",
      content: "The selection-scoped proposal was not applied. The original section remains available; refine the instruction or exit selection mode.",
      scope: "selection",
      selectionPreview: summarizeSelection(activeTargetedChatContext.selection.selectedText),
    });
  };

  const handleRequestTargetedEdit = async (
    request: Omit<TargetedEditRequest, "expectedVersion">,
  ): Promise<TargetedEditProposal> => {
    if (!hasGeneratedPreview) {
      throw new Error("Generate this section before using targeted editing.");
    }

    if (selectedSection.version != null) {
      try {
        return await requestTargetedSectionEditApi(report, selectedSection.id, {
          ...request,
          expectedVersion: selectedSection.version,
        });
      } catch (error) {
        const hasUnsavedEditorContent = error instanceof ReportApiError
          && error.code === "targeted_edit_document_conflict";
        if (!hasUnsavedEditorContent) throw error;
      }
    }

    const currentDraft: ReportSection = {
      ...selectedSection,
      content: request.selection.documentHtml,
      edited: true,
      reviewRequired: true,
    };
    const savedState = await saveSectionDraftApi(report, currentDraft);
    const savedDraft = savedState.sectionDrafts?.find(
      (draft) => draft.sectionId === selectedSection.id,
    );
    if (!savedDraft) {
      throw new Error("The saved section version could not be verified.");
    }

    updateSection(selectedSection.id, (section) => ({
      ...section,
      content: request.selection.documentHtml,
      edited: true,
      approved: savedDraft.approved,
      reviewRequired: savedDraft.reviewRequired,
      version: savedDraft.version,
      previousVersionCount: savedDraft.previousVersionCount,
    }));

    return requestTargetedSectionEditApi(report, selectedSection.id, {
      ...request,
      expectedVersion: savedDraft.version,
    });
  };

  const handleAcceptTargetedEdit = async (
    nextContent: string,
    proposal: TargetedEditProposal,
  ) => {
    if (proposal.sectionId !== selectedSection.id) {
      throw new Error("This proposal belongs to another report section.");
    }

    snapshotSectionOutput(selectedSection);
    const nextSection: ReportSection = {
      ...selectedSection,
      content: nextContent,
      generated: true,
      edited: true,
      approved: false,
      reviewRequired: true,
      version: proposal.expectedVersion,
    };
    const state = await saveSectionDraftApi(report, nextSection, {
      reasonCode: "targeted_ai_edit",
    });
    const savedDraft = state.sectionDrafts?.find(
      (draft) => draft.sectionId === selectedSection.id,
    );

    updateSection(selectedSection.id, (section) => ({
      ...section,
      content: nextContent,
      generated: true,
      edited: true,
      approved: false,
      reviewRequired: true,
      version: savedDraft?.version ?? section.version,
      previousVersionCount: savedDraft?.previousVersionCount ?? section.previousVersionCount,
    }));
    setGeneratedPreviewSectionIds((current) => new Set(current).add(selectedSection.id));
    setFlashMessage(
      `Updated only the highlighted content in ${selectedSection.title}. The previous version is available through Undo / Restore.`,
    );
    appendSectionChatMessage(selectedSection.id, {
      id: createBrowserId("targeted-applied"),
      role: "assistant",
      content: "Applied the selection-scoped proposal. Review the highlighted replacement, then choose Keep or Undo beside the edited text.",
      scope: "selection",
      selectionPreview: summarizeSelection(
        activeTargetedChatContext?.selection.selectedText ?? proposal.replacementText,
      ),
    });
  };

  const confirmDraftManualInputs = async (
    section: ReportSection,
  ): Promise<ReturnType<typeof applyConfirmedDraftManualInputs>> => {
    const recognition = applyConfirmedDraftManualInputs(report, section);
    if (recognition.confirmed.length === 0) return recognition;

    const state = await saveManualInputValuesApi(
      report,
      Object.fromEntries(recognition.confirmed.map((candidate) => [candidate.fieldId, candidate.value])),
    );
    const nextReport = applyPersistedRevisions(recognition.report, state);
    setReport(nextReport);
    return { ...recognition, report: nextReport };
  };

  const handleKeepTargetedEdit = async (content: string): Promise<boolean> => {
    try {
      const recognition = await confirmDraftManualInputs({ ...selectedSection, content });
      const confirmedLabels = recognition.confirmed
        .map((candidate) => recognition.section.missingFields.find((field) => field.id === candidate.fieldId)?.label)
        .filter((label): label is string => Boolean(label));
      setFlashMessage(
        confirmedLabels.length > 0
          ? `Kept the targeted edit and saved confirmed report details: ${confirmedLabels.join(", ")}.`
          : `Kept the targeted edit in ${selectedSection.title}.`,
      );
      appendSectionChatMessage(selectedSection.id, {
        id: createBrowserId("targeted-kept"),
        role: "assistant",
        content: "Kept the selection-scoped edit and recorded it in the section version history.",
        scope: "selection",
        selectionPreview: summarizeSelection(
          activeTargetedChatContext?.proposal?.replacementText ?? content,
        ),
      });
      setTargetedChatContext(null);
      setExternalTargetedEdit(null);
      return true;
    } catch (error) {
      setFlashMessage(`The edit was kept, but detected report details were not saved: ${formatErrorMessage(error)}`);
      return false;
    }
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
      saveRawGenerationInputs(report.id, principal.userId, rawGenerationInputs);
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

    let approvalSection = selectedSection;
    try {
      approvalSection = (await confirmDraftManualInputs(selectedSection)).section;
    } catch (error) {
      setFlashMessage(`Unable to confirm report details before approval: ${formatErrorMessage(error)}`);
      return;
    }

    const missingFields = approvalSection.missingFields.filter((field) => !field.value.trim());
    if (missingFields.length > 0) {
      setFlashMessage(
        `Complete this information before approval: ${missingFields.map((field) => field.label).join(", ")}.`,
      );
      return;
    }

    const floorCorrosion = safeLayoutMap?.floorCorrosion;
    if (selectedSection.id === "floor-plate-corrosion-plan" && !floorCorrosion) {
      setFlashMessage("Import and review the individual MFL plate maps before approving this section.");
      return;
    }
    if (floorCorrosion) {
      const errorCount = floorCorrosion.validationIssues.filter((issue) => issue.severity === "error").length;
      const reviewRequiredCount = floorCorrosion.overlays.filter((overlay) => overlay.status !== "approved").length;
      if (floorCorrosion.overlays.length === 0 || errorCount > 0 || reviewRequiredCount > 0) {
        setFlashMessage(
          `Review the floor corrosion map before approval: ${floorCorrosion.overlays.length} matched scan(s), ${errorCount} matching error(s), ${reviewRequiredCount} placement(s) awaiting approval.`,
        );
        return;
      }
    }

    const nextSection: ReportSection = {
      ...approvalSection,
      approved: false,
      reviewRequired: true,
      layoutMap: safeLayoutMap,
    };

    try {
      const syncedState = await syncSectionToBackend(nextSection, Boolean(nextSection.layoutMap));
      const expectedVersion = syncedState.sectionDrafts
        ?.find((draft) => draft.sectionId === selectedSection.id)
        ?.version;
      if (expectedVersion == null) {
        throw new Error("The saved section version could not be confirmed before approval.");
      }
      const approvedState = await approveSectionApi(report, selectedSection.id, expectedVersion);
      const approvedVersion = approvedState.sectionDrafts
        ?.find((draft) => draft.sectionId === selectedSection.id)
        ?.version;
      updateSection(selectedSection.id, (section) => ({
        ...section,
        approved: true,
        reviewRequired: false,
        missingFields: nextSection.missingFields,
        layoutMap: safeLayoutMap,
        version: approvedVersion ?? section.version,
      }));
      setFlashMessage(`${selectedSection.title} approved and persisted to the backend report job.`);
    } catch (error) {
      if (error instanceof ReportApiError && error.code === "section_version_conflict") {
        try {
          const payload = await loadReportJob(report.id);
          const hydration = hydrateWorkspaceFromApiState(payload);
          setReport(cloneReport(hydration.report));
          setBaselineReport(cloneReport(hydration.baselineReport));
          setSelectedSectionId(selectedSection.id);
          setFlashMessage(
            `${selectedSection.title} changed in another session. The latest saved version has been reloaded for review.`,
          );
          return;
        } catch (reloadError) {
          setFlashMessage(
            `Approval was blocked by a newer section version, and reload failed: ${formatErrorMessage(reloadError)}`,
          );
          return;
        }
      }
      setFlashMessage(`Unable to approve ${selectedSection.title}: ${formatErrorMessage(error)}`);
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

  const generateSections = async (sectionsToGenerate: ReportSection[]) => {
    if (!report) return;

    if (sectionsToGenerate.length === 0) {
      setFlashMessage("Select at least one report section before starting generation.");
      return;
    }

    setIsGenerating(true);
    setGeneratingSectionId(null);
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

        setGeneratingSectionId(section.id);
        setGenerationProgress({
          current: index,
          total: sectionsToGenerate.length,
          label: `Generating ${label}`,
        });
        setSelectedSectionId(section.id);
        setFlashMessage(`Generating section ${label}.`);

        const manualState = await saveManualInputsApi(workingReport, section);
        workingReport = applyPersistedRevisions(workingReport, manualState);
        const userInstruction = rawGenerationInputs[section.id] ?? buildDefaultRawGenerationInput(section);
        const payload = await generateSectionApi(workingReport, section.id, userInstruction);
        const hydrated = hydrateWorkspaceFromApiState(payload, getHydrationApiBaseUrl(workingReport));
        const generatedSection = hydrated.report.sections.find((item) => item.id === section.id);

        if (generatedSection) {
          snapshotSectionOutput(section);
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
      setGeneratingSectionId(null);
      setIsGenerating(false);
    }
  };

  const handleGenerateSelectedSections = async () => {
    const sectionsToGenerate = reportTocSections.filter((section) =>
      selectedGenerationSectionIds.has(section.id),
    );
    await generateSections(sectionsToGenerate);
  };

  const handleGenerateSectionShortcut = async (section: ReportSection) => {
    if (isGenerating) {
      setFlashMessage("Wait for the current generation queue to finish before starting another section.");
      return;
    }

    setSelectedSectionId(section.id);
    setActiveContextPanel(null);
    setSelectedGenerationSectionIds(new Set([section.id]));

    if (section.approved) {
      setIsGenerationDialogOpen(true);
      setIsExportDialogOpen(false);
      setFlashMessage(
        `${section.title} is approved. Confirm Generate Selected to replace it with a new editable version.`,
      );
      return;
    }

    await generateSections([section]);
  };

  const handleSaveDraft = async () => {
    if (!hasGeneratedPreview) {
      setFlashMessage("Generate this section before saving it as a report draft.");
      return;
    }

    const draftSection: ReportSection = {
      ...selectedSection,
      edited: true,
      approved: false,
      layoutMap: safeLayoutMap,
    };

    try {
      const recognition = await confirmDraftManualInputs(draftSection);
      const nextSection = recognition.section;
      updateSection(selectedSection.id, (section) => ({
        ...section,
        edited: true,
        approved: false,
        missingFields: nextSection.missingFields,
        layoutMap: safeLayoutMap,
      }));
      await syncSectionToBackend(nextSection, Boolean(nextSection.layoutMap));
      setFlashMessage(
        recognition.confirmed.length > 0
          ? `${selectedSection.title} saved with ${recognition.confirmed.length} confirmed detail${recognition.confirmed.length === 1 ? "" : "s"} recognized from the draft.`
          : `${selectedSection.title} saved to the backend report job as a working draft.`,
      );
    } catch (error) {
      setFlashMessage(
        `${selectedSection.title} saved locally, but backend draft persistence failed: ${formatErrorMessage(error)}`,
      );
    }
  };

  const handleRestorePreviousOutput = async () => {
    if (!selectedCanRestorePrevious) {
      setFlashMessage("No previous generated output is available for this section yet.");
      return false;
    }

    if ((selectedSection.previousVersionCount ?? 0) > 0) {
      try {
        const restoredState = await restorePreviousSectionDraftApi(report, selectedSection.id);
        const hydrated = hydrateWorkspaceFromApiState(restoredState, getHydrationApiBaseUrl(report));
        const restoredSection = hydrated.report.sections.find((section) => section.id === selectedSection.id);

        setReport(cloneReport(hydrated.report));
        setBaselineReport(resetReportOutputState(cloneReport(hydrated.baselineReport)));
        setGeneratedPreviewSectionIds((current) => new Set(current).add(selectedSection.id));
        setLocalRollbackOutput(selectedSection.id, selectedSection.content);
        setEvalRuns((current) => {
          const next = { ...current };
          delete next[selectedSection.id];
          return next;
        });
        setFlashMessage(
          `Restored the previous generated output for ${restoredSection?.title ?? selectedSection.title} from backend version history.`,
        );
        return true;
      } catch (error) {
        if (!selectedPreviousOutput) {
          setFlashMessage(`Unable to restore previous output from backend history: ${formatErrorMessage(error)}`);
          return false;
        }

        setFlashMessage(
          `Backend restore failed, so I am using the local rollback snapshot for ${selectedSection.title}: ${formatErrorMessage(error)}`,
        );
      }
    }

    if (!selectedPreviousOutput) {
      setFlashMessage("No local previous generated output is available for this section yet.");
      return false;
    }

    const nextSection: ReportSection = {
      ...selectedSection,
      content: selectedPreviousOutput,
      generated: true,
      edited: true,
      approved: false,
      reviewRequired: true,
    };

    updateSection(selectedSection.id, (section) => ({
      ...section,
      content: selectedPreviousOutput,
      generated: true,
      edited: true,
      approved: false,
      reviewRequired: true,
    }));
    setGeneratedPreviewSectionIds((current) => new Set(current).add(selectedSection.id));
    setLocalRollbackOutput(selectedSection.id, selectedSection.content);
    setEvalRuns((current) => {
      const next = { ...current };
      delete next[selectedSection.id];
      return next;
    });

    try {
      const state = await saveSectionDraftApi(report, nextSection);
      syncPersistedSectionVersion(selectedSection.id, state);
      setFlashMessage(`Restored the previous generated output for ${selectedSection.title}. Review it before approval.`);
      return true;
    } catch (error) {
      setFlashMessage(
        `Restored ${selectedSection.title} locally, but backend draft persistence failed: ${formatErrorMessage(error)}`,
      );
      return false;
    }
  };

  const handleUndoTargetedEdit = async () => {
    const restored = await handleRestorePreviousOutput();
    if (!restored) return false;
    appendSectionChatMessage(selectedSection.id, {
      id: createBrowserId("targeted-undone"),
      role: "assistant",
      content: "Undid the selection-scoped edit and restored the previous section version.",
      scope: "selection",
      selectionPreview: activeTargetedChatContext
        ? summarizeSelection(activeTargetedChatContext.selection.selectedText)
        : undefined,
    });
    setTargetedChatContext(null);
    setExternalTargetedEdit(null);
    return true;
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
      approved: false,
      reviewRequired: true,
      layoutMap: persistedLayoutMap,
    }));

    try {
      const state = await saveLayoutOverrideApi(report, selectedSection.id, persistedLayoutMap);
      syncPersistedSectionVersion(selectedSection.id, state);
      setFlashMessage(`${summary} and persisted it to the backend layout override store.`);
    } catch (error) {
      setFlashMessage(`${summary} locally, but backend layout persistence failed: ${formatErrorMessage(error)}`);
    }
  };

  const handleMflImport = async (file: File) => {
    const floorSectionId = activeLayoutSurface === "floor" ? activeLayoutSection?.id : undefined;
    if (!floorSectionId) {
      setFlashMessage("Open the Floor layout before importing MFL plate maps.");
      return;
    }
    setIsImportingMfl(true);
    setFlashMessage(`Extracting corrosion pixels from ${file.name} and matching plate IDs...`);
    try {
      const state = await importFloorCorrosionMfl(report, floorSectionId, file);
      const hydrated = hydrateWorkspaceFromApiState(state, getHydrationApiBaseUrl(report));
      setReport(cloneReport(preserveReportOutputAfterLayoutHydration(report, hydrated.report, floorSectionId)));
      setBaselineReport(resetReportOutputState(cloneReport(hydrated.baselineReport)));
      setSelectedLayoutSurface("floor");
      setActiveMarkerId(null);
      setActivePlateId(null);
      const map = hydrated.report.sections.find((section) => section.id === floorSectionId)?.layoutMap?.floorCorrosion;
      const errors = map?.validationIssues.filter((issue) => issue.severity === "error").length ?? 0;
      const reviews = map?.overlays.filter((overlay) => overlay.status === "orientation_review_required").length ?? 0;
      setFlashMessage(
        `MFL import completed: ${map?.overlays.length ?? 0} plate scans placed, ${reviews} orientation reviews, ${errors} matching errors.`,
      );
    } catch (error) {
      setFlashMessage(`Unable to build floor corrosion map: ${formatErrorMessage(error)}`);
    } finally {
      setIsImportingMfl(false);
    }
  };

  const updateFloorCorrosionPlacement = async (
    overlay: FloorCorrosionOverlay,
    changes: Partial<Pick<FloorCorrosionOverlay,
      "rotationDegrees" | "scaleX" | "scaleY" | "offsetX" | "offsetY" | "opacity"
    >>,
    summary: string,
    approved = false,
  ) => {
    const floorSectionId = activeLayoutSurface === "floor" ? activeLayoutSection?.id : undefined;
    if (!floorSectionId) {
      setFlashMessage("Open the Floor layout before refining an MFL plate placement.");
      return;
    }
    setIsUpdatingMflPlacement(true);
    try {
      const state = await approveFloorCorrosionPlacement(report, floorSectionId, {
        scanPlateId: overlay.scanPlateId,
        hostPlateId: overlay.hostPlateId,
        rotationDegrees: changes.rotationDegrees ?? overlay.rotationDegrees,
        flipX: false,
        flipY: false,
        scaleX: changes.scaleX ?? overlay.scaleX ?? 1,
        scaleY: changes.scaleY ?? overlay.scaleY ?? 1,
        offsetX: changes.offsetX ?? overlay.offsetX ?? 0,
        offsetY: changes.offsetY ?? overlay.offsetY ?? 0,
        opacity: changes.opacity ?? overlay.opacity,
        approved,
      });
      const hydrated = hydrateWorkspaceFromApiState(state, getHydrationApiBaseUrl(report));
      setReport(cloneReport(preserveReportOutputAfterLayoutHydration(report, hydrated.report, floorSectionId)));
      setBaselineReport(resetReportOutputState(cloneReport(hydrated.baselineReport)));
      setFlashMessage(
        approved
          ? `${summary} Placement is approved for plate ${overlay.scanPlateId}.`
          : `${summary} Review the result, then approve the placement for plate ${overlay.scanPlateId}.`,
      );
    } catch (error) {
      setFlashMessage(`Unable to update MFL plate placement: ${formatErrorMessage(error)}`);
    } finally {
      setIsUpdatingMflPlacement(false);
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
      const state = await saveLayoutOverrideApi(report, selectedSection.id, normalized);
      syncPersistedSectionVersion(selectedSection.id, state);
      setFlashMessage(`Reset draft map overrides for ${selectedSection.title} and synced the baseline to the backend.`);
    } catch (error) {
      setFlashMessage(
        `Reset map overrides locally for ${selectedSection.title}, but backend sync failed: ${formatErrorMessage(error)}`,
      );
    }
  };

  const sendTargetedChatPrompt = async (
    prompt: string,
    context: TargetedChatContext,
  ) => {
    const userMessage: ChatMessage = {
      id: createBrowserId("targeted-chat-user"),
      role: "user",
      content: prompt,
      scope: "selection",
      selectionPreview: summarizeSelection(context.selection.selectedText),
    };
    appendSectionChatMessage(context.sectionId, userMessage);
    setChatInput("");
    setIsChatBusy(true);

    try {
      const proposal = await handleRequestTargetedEdit({
        action: "custom",
        instruction: buildTargetedConversationInstruction(context.turns, prompt),
        selection: context.selection,
      });
      const nextTurn = {
        instruction: prompt,
        proposedText: proposal.replacementText,
      };
      setTargetedChatContext((current) => current?.sectionId === context.sectionId
        ? {
            ...current,
            proposal,
            turns: [...current.turns, nextTurn],
          }
        : current);
      appendSectionChatMessage(context.sectionId, {
        id: createBrowserId("targeted-chat-assistant"),
        role: "assistant",
        content: [
          proposal.explanation || "Prepared a selection-scoped replacement.",
          `Proposed replacement: ${proposal.replacementText}`,
          proposal.warnings.length > 0 ? `Review note: ${proposal.warnings.join(" ")}` : "",
          "Choose Apply to Selection, send another instruction to refine this proposal, or exit selection mode.",
        ].filter(Boolean).join("\n\n"),
        scope: "selection",
        selectionPreview: summarizeSelection(context.selection.selectedText),
        controlTrace: {
          intent: prompt,
          planner: "structured_planner",
          risk: proposal.warnings.length > 0 ? "medium" : "low",
          target: `${context.sectionId}:selection:${context.selection.selectionHash}`,
          operation: "selection.proposeReplacement",
          status: "needs_confirmation",
          guardrails: [
            "The proposal is bound to the selected range, section version, document hash, and protected app facts.",
          ],
          validation: [
            "No report content changes until Apply to Selection is chosen.",
          ],
          userConfirmationRequired: true,
          undoSnapshot: true,
          reason: "LAIQ AI prepared a replacement for the pinned selection only.",
        },
      });
      setFlashMessage(`Prepared a selection-scoped proposal for ${context.sectionTitle}.`);
    } catch (error) {
      appendSectionChatMessage(context.sectionId, {
        id: createBrowserId("targeted-chat-error"),
        role: "assistant",
        content: `I could not prepare that selection-scoped edit: ${formatErrorMessage(error)} The report draft was not changed.`,
        scope: "selection",
        selectionPreview: summarizeSelection(context.selection.selectedText),
      });
      setFlashMessage(`Unable to prepare the selection-scoped edit for ${context.sectionTitle}.`);
    } finally {
      setIsChatBusy(false);
    }
  };

  const sendChatPrompt = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    if (activeTargetedChatContext) {
      await sendTargetedChatPrompt(trimmed, activeTargetedChatContext);
      return;
    }
    const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: trimmed };
    const latestSectionChat = chatsRef.current[selectedSection.id] ?? currentChat;
    const conversationHistory = [...latestSectionChat, userMessage].map((message) => ({
      role: message.role,
      content: message.content,
      controlTrace: message.controlTrace,
      pendingConfirmation: message.pendingConfirmation,
    }));

    updateChats((current) => ({
      ...current,
      [selectedSection.id]: [
        ...(current[selectedSection.id] ?? []),
        userMessage,
      ],
    }));
    setChatInput("");
    setIsChatBusy(true);

    try {
      const manualState = await saveManualInputsApi(report, selectedSection);
      const reportWithManualRevision = applyPersistedRevisions(report, manualState);
      setReport(reportWithManualRevision);
      const reply = await sendSectionChatApi(reportWithManualRevision, selectedSection.id, trimmed, conversationHistory);
      const actions = reply.actions ?? [];
      const replyContent = normalizeAssistantChatContent(reply.content, selectedSection.title);
      updateChats((current) => ({
        ...current,
        [selectedSection.id]: [
          ...(current[selectedSection.id] ?? []),
          {
            id: reply.replyId,
            role: "assistant",
            content: replyContent,
            actions,
            controlTrace: reply.controlTrace,
            pendingConfirmation: reply.pendingConfirmation,
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
        deterministic_control_guard: "control guard",
        deterministic_state_guard: "helpdesk guard",
        deterministic_table_formatter: "table formatter",
        deterministic_content_transform: "content transform",
        codex_content_transform: "structured transform planner",
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
      updateChats((current) => ({
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
    !message.pendingConfirmation &&
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

      snapshotSectionOutput(selectedSection);

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
        const state = await saveSectionDraftApi(report, nextSection);
        syncPersistedSectionVersion(selectedSection.id, state);
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
      setFlashMessage("Layout-map geometry is locked to the LAIQ inspection app V3 export while app parity is under review.");
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
          <button
            className="topbar-nav-button"
            onClick={() => {
              setReport(null);
              setBaselineReport(null);
              void refreshReportInbox();
            }}
            type="button"
          >
            Reports
          </button>
            {isSuperAdmin ? (
              <>
                <button className="topbar-nav-button" onClick={openKnowledgeBaseReview} type="button">
                  Review KB
                </button>
                <button className="topbar-nav-button" onClick={openEvaluationLab} type="button">
                Evaluation
              </button>
              <button className="topbar-nav-button" onClick={openAccountManagement} type="button">
                Accounts
              </button>
            </>
          ) : null}
          <div className="topbar-account" title={`${principal.tenantName} · ${principal.userId}`}>
            <span>{principal.displayName}</span>
            <button onClick={() => void signOut()} type="button">Sign out</button>
          </div>
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
      <main className="workspace-grid" style={workspaceGridStyle}>
        <aside className="panel sidebar">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Table of Contents</p>
              <h2>API 653 Sections</h2>
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
              const isSectionGenerating = isGenerating && generatingSectionId === section.id;
              const pageLabel = getSectionPageLabel(section);
              return (
                <button
                  className={[
                    "section-item",
                    isActive ? "section-item-active" : "",
                    isSectionGenerating ? "section-item-generating" : "",
                  ].filter(Boolean).join(" ")}
                  key={section.id}
                  onClick={() => selectReportSection(section)}
                  onDoubleClick={() => void handleGenerateSectionShortcut(section)}
                  title="Click to open. Double-click to generate this section."
                  type="button"
                >
                  <div className="toc-row">
                    <span className="section-number">{formatTocNumber(section)}</span>
                    <strong>{formatTocTitle(section)}</strong>
                    <span className="toc-leader" />
                    {pageLabel ? <span className="toc-page">{pageLabel}</span> : null}
                    {isSectionGenerating ? (
                      <span
                        aria-label={`Generating ${section.title}`}
                        className="toc-generation-indicator"
                        title="LAIQ AI Engine is generating this section"
                      >
                        <GenerationHourglass />
                      </span>
                    ) : (
                      <span
                        aria-label={`Section status: ${status}`}
                        className={`toc-status-dot status-${status.replace(/\s+/g, "-")}`}
                        title={status}
                      />
                    )}
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
            <div className="workspace-context-actions">
              <button
                aria-expanded={activeContextPanel === "app-data"}
                className={`toolbar-button context-toggle-button ${activeContextPanel === "app-data" ? "context-toggle-button-active" : ""}`}
                onClick={() => setActiveContextPanel((current) => current === "app-data" ? null : "app-data")}
                type="button"
              >
                App Data
              </button>
              <button
                aria-expanded={activeContextPanel === "layout-map"}
                className={`toolbar-button context-toggle-button ${activeContextPanel === "layout-map" ? "context-toggle-button-active" : ""}`}
                disabled={layoutMapSections.length === 0}
                onClick={() => setActiveContextPanel((current) => current === "layout-map" ? null : "layout-map")}
                type="button"
              >
                Layout Map
              </button>
              <button className="toolbar-button" disabled={!hasGeneratedPreview} onClick={handleSaveDraft} type="button">
                Save Draft
              </button>
            </div>
          </div>

          <div className="report-workflow-stack">
            {activeContextPanel === "app-data" ? (
              <section className="panel-subsection workspace-context-drawer raw-data-pane">
                <div className="subsection-header">
                  <div>
                    <p className="eyebrow">Section Context</p>
                    <h3>App Data And Generation Guidance</h3>
                    <p className="source-note">{selectedSection.sourceSummary}</p>
                  </div>
                  <div className="raw-data-actions">
                    <button className="toolbar-button toolbar-button-primary" onClick={handleSaveRawGenerationInput} type="button">
                      Save Input
                    </button>
                    <button className="toolbar-button" onClick={() => setActiveContextPanel(null)} type="button">
                      Close
                    </button>
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
                    <small>
                      This section prompt/data block is used by the selected Generate Sections queue.
                    </small>
                  </div>
                </div>
              </section>
            ) : null}

            {activeContextPanel === "layout-map" ? (
            <section className="panel-subsection workspace-context-drawer map-pane">
              <div className="subsection-header">
                <div>
                  <p className="eyebrow">Visual Context</p>
                  <h3>App Layout Maps</h3>
                  <p>
                    {visibleLayoutMap
                      ? "Select Roof, Shell, or Floor, then click a plate, shell region, or marker to inspect linked app evidence."
                      : "This section does not require a layout drawing in the first UI slice."}
                  </p>
                </div>
                <div className="workspace-context-drawer-actions">
                  {visibleLayoutMap ? (
                    <span className="layout-surface-pill">
                      {formatLayoutSurfaceTab(activeLayoutSurface)}
                    </span>
                  ) : null}
                  <button className="toolbar-button" onClick={() => setActiveContextPanel(null)} type="button">
                    Close
                  </button>
                </div>
              </div>

              {activeLayoutSurface === "floor" ? (
                <div className="floor-corrosion-toolbar">
                  <label className={`floor-corrosion-import ${isImportingMfl ? "is-busy" : ""}`}>
                    <input
                      accept="application/pdf,.pdf"
                      disabled={isImportingMfl || !isMflCompatibleFloorLayout(visibleLayoutMap)}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        if (file) void handleMflImport(file);
                        event.currentTarget.value = "";
                      }}
                      type="file"
                    />
                    <span>{isImportingMfl ? "Extracting MFL maps..." : "Import MFL Plate Maps"}</span>
                  </label>
                  {visibleLayoutMap?.floorCorrosion ? (
                    <div className="floor-corrosion-status">
                      <strong>{visibleLayoutMap.floorCorrosion.overlays.length} scans placed</strong>
                      <span>
                        {visibleLayoutMap.floorCorrosion.validationIssues.filter((issue) => issue.severity === "error").length} errors
                        {" · "}
                        {visibleLayoutMap.floorCorrosion.overlays.filter((overlay) => overlay.status === "orientation_review_required").length} to review
                      </span>
                    </div>
                  ) : (
                    <p>
                      {isMflCompatibleFloorLayout(visibleLayoutMap)
                        ? "The app-owned floor layout is locked. Import the individual MFL plate-map PDF to overlay corrosion plate by plate."
                        : "The app-exported floor plate IDs do not match this MFL report family. Correct the app layout before importing scans."}
                    </p>
                  )}
                </div>
              ) : null}

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
                <>
                  <LayoutMapEditor
                    activeMarkerId={activeMarkerId}
                    activePlateId={activePlateId}
                    floorReviewControls={activeCorrosionOverlay ? (
                      <FloorCorrosionRefinementControls
                        disabled={isUpdatingMflPlacement}
                        onUpdate={(changes, summary, approved) => void updateFloorCorrosionPlacement(
                          activeCorrosionOverlay,
                          changes,
                          summary,
                          approved,
                        )}
                        overlay={activeCorrosionOverlay}
                      />
                    ) : undefined}
                    layoutMap={visibleLayoutMap}
                    onLayoutMapChange={persistLayoutMap}
                    onMarkerSelect={setActiveMarkerId}
                    onPlateSelect={setActivePlateId}
                    showFloorSourcePreview={!activeCorrosionOverlay}
                  />
                </>
              ) : (
                <div className="empty-map-pane">
                  <p>Lower workspace is available for maps, sketches, photos, or form-like visual blocks when a section requires them.</p>
                </div>
              )}
            </section>
            ) : null}

            <section
              className={`panel-subsection text-pane ${isSelectedSectionGenerating ? "text-pane-generating" : ""}`}
            >
              <div className="subsection-header">
                <div>
                  <p className="eyebrow">Step 3 · AI Draft</p>
                  <h3>Generated Report Content</h3>
                  <p>{selectedSection.templateExpectation}</p>
                  {hasGeneratedPreview ? (
                    <p className="prediction-legend">
                      <span><span className="prediction-legend-chip prediction-legend-template" />Template</span>
                      <span><span className="prediction-legend-chip prediction-legend-field" />App fact</span>
                      <span><span className="prediction-legend-chip prediction-legend-ai" />AI inferred</span>
                    </p>
                  ) : null}
                </div>
                <div className="output-card-actions">
                  {selectedCanRestorePrevious ? (
                    <button
                      className="toolbar-button restore-output-button"
                      onClick={handleRestorePreviousOutput}
                      type="button"
                    >
                      Undo / Restore
                    </button>
                  ) : null}
                  {isSelectedSectionGenerating ? (
                    <span className="output-approval-pill output-approval-pill-generating">
                      <GenerationHourglass />
                      Generating
                    </span>
                  ) : (
                    <span
                      className={`output-approval-pill output-approval-pill-${selectedSectionStatus.replace(/\s+/g, "-")}`}
                    >
                      {formatSectionStatus(selectedSectionStatus)}
                    </span>
                  )}
                </div>
              </div>

              {isSelectedSectionGenerating ? (
                <div className="section-generation-status" role="status">
                  <GenerationHourglass />
                  <div>
                    <strong>LAIQ AI Engine is generating this section</strong>
                    <span>The draft will appear here when validation and provenance checks finish.</span>
                  </div>
                </div>
              ) : null}

              {hasGeneratedPreview && selectedEvalRun && selectedEvalMatchesManualInputs ? (
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

              {hasGeneratedPreview && selectedEvalRun && !selectedEvalMatchesManualInputs ? (
                <div className="eval-result-card eval-result-refresh-required">
                  <div className="eval-result-main">
                    <div>
                      <p className="eyebrow">Eval Guard</p>
                      <h4>Refresh required</h4>
                      <p>Confirmed report details changed after this evaluation. Regenerate the section to refresh its score.</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {!hasGeneratedPreview ? (
                isSelectedSectionGenerating ? (
                  <div className="draft-empty-state draft-generation-state" aria-hidden="true">
                    <span className="draft-generation-line" />
                    <span className="draft-generation-line draft-generation-line-short" />
                    <span className="draft-generation-line" />
                  </div>
                ) : (
                  <div className="draft-empty-state">
                    <h4>No generated draft yet</h4>
                    <p>
                      Choose this section from Generate Sections. After generation, the editable report output will appear
                      here for review and approval.
                    </p>
                  </div>
                )
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
                  <RichTextSectionEditor
                    content={selectedSection.content}
                    externalTargetedEdit={externalTargetedEdit}
                    onAcceptTargetedEdit={handleAcceptTargetedEdit}
                    onChange={handleContentChange}
                    onContinueTargetedEditInChat={handleContinueTargetedEditInChat}
                    onExternalTargetedEditComplete={handleExternalTargetedEditComplete}
                    onKeepTargetedEdit={handleKeepTargetedEdit}
                    onRequestTargetedEdit={handleRequestTargetedEdit}
                    onTargetedEditRequested={handleTargetedEditRequested}
                    onUndoTargetedEdit={handleUndoTargetedEdit}
                    targetedChatActive={Boolean(activeTargetedChatContext)}
                  />
                  <div className="content-approval-footer">
                    <div>
                      <strong>{selectedSection.approved ? "Output approved" : "Ready after review?"}</strong>
                      <span>
                        {unresolvedMissingCount > 0
                          ? `${unresolvedMissingCount} missing field${unresolvedMissingCount === 1 ? "" : "s"} must be completed before approval.`
                          : "Approve this generated section after reviewing the wording, tables, and evidence."}
                      </span>
                    </div>
                    <div className="content-footer-actions">
                      {selectedCanRestorePrevious ? (
                        <button
                          className="toolbar-button approve-output-button"
                          onClick={handleRestorePreviousOutput}
                          type="button"
                        >
                          Undo / Restore
                        </button>
                      ) : null}
                      <button
                        className="toolbar-button toolbar-button-primary approve-output-button"
                        disabled={!hasGeneratedPreview || selectedSection.approved}
                        onClick={handleApprove}
                        type="button"
                      >
                        Approve Output
                      </button>
                    </div>
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

        <aside
          className="rightbar"
          aria-label="AI command and missing content panel"
        >
          <section className={`panel ai-command-panel${activeTargetedChatContext ? " ai-command-panel-targeted" : ""}`}>
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
              {selectedMissingFields.length > 0 ? (
                <div className="missing-inline-list" aria-label="Missing fields for this section">
                  {selectedMissingFields.map((field) => (
                    <MissingFieldInlineEditor
                      field={field}
                      key={field.id}
                      onChange={(value) => handleFieldChange(field.id, value)}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            {activeTargetedChatContext ? (
              <div className="targeted-chat-context-card" aria-label="Pinned selected content">
                <div className="targeted-chat-context-header">
                  <div>
                    <span>Selection mode</span>
                    <strong>Only this content can change</strong>
                  </div>
                  <button
                    disabled={isChatBusy || Boolean(externalTargetedEdit)}
                    onClick={handleCancelTargetedChat}
                    type="button"
                  >
                    Exit
                  </button>
                </div>
                <blockquote>{activeTargetedChatContext.selection.selectedText}</blockquote>
                {activeTargetedChatContext.proposal ? (
                  <div className="targeted-chat-proposal" aria-live="polite">
                    <span>Latest proposal</span>
                    <p>{activeTargetedChatContext.proposal.replacementText}</p>
                    <button
                      disabled={isChatBusy || Boolean(externalTargetedEdit)}
                      onClick={handleApplyTargetedChatProposal}
                      type="button"
                    >
                      {externalTargetedEdit ? "Applying…" : "Apply to Selection"}
                    </button>
                  </div>
                ) : (
                  <p className="targeted-chat-guidance">
                    Ask a follow-up below. The rest of the section remains protected.
                  </p>
                )}
              </div>
            ) : null}

            <div className="chat-thread" aria-label="Assistant conversation" ref={chatThreadRef}>
              {currentChat.map((message, index) => (
                <div className={`chat-bubble chat-${message.role}`} key={message.id}>
                  <div className="chat-message-heading">
                    <span className="chat-role">{message.role}</span>
                    {message.scope === "selection" ? <span className="chat-scope-pill">Selected content</span> : null}
                  </div>
                  {message.selectionPreview ? (
                    <span className="chat-selection-preview">“{message.selectionPreview}”</span>
                  ) : null}
                  <p>{message.content}</p>
                  {message.controlTrace ? (
                    <div className={`control-trace-card control-trace-${message.controlTrace.status}`}>
                      <div className="control-trace-header">
                        <strong>{message.controlTrace.status.replace(/_/g, " ")}</strong>
                        <span>{message.controlTrace.risk} risk</span>
                      </div>
                      <p>
                        <span>Planner:</span> {message.controlTrace.planner.replace(/_/g, " ")}
                      </p>
                      <p>
                        <span>Operation:</span> {message.controlTrace.operation}
                      </p>
                      <p>
                        <span>Guardrail:</span> {message.controlTrace.guardrails[0] ?? message.controlTrace.reason}
                      </p>
                    </div>
                  ) : null}
                  {message.pendingConfirmation ? (
                    <div className="control-confirmation-card">
                      <strong>{message.pendingConfirmation.label}</strong>
                      <p>{message.pendingConfirmation.summary}</p>
                      <div className="quick-reply-row" aria-label="Pending action confirmation">
                        <button className="quick-reply-button quick-reply-primary" onClick={() => handleQuickReply("Yes")} type="button">
                          Apply
                        </button>
                        <button className="quick-reply-button" onClick={() => handleQuickReply("No")} type="button">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
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
                placeholder={activeTargetedChatContext
                  ? "Ask LAIQ AI to change only the pinned selection..."
                  : "Ask LAIQ AI to refine this section..."}
                ref={chatInputRef}
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

type FloorCorrosionTransformChanges = Partial<Pick<FloorCorrosionOverlay,
  "rotationDegrees" | "scaleX" | "scaleY" | "offsetX" | "offsetY" | "opacity"
>>;

function FloorCorrosionRefinementControls({
  disabled,
  onUpdate,
  overlay,
}: {
  disabled: boolean;
  onUpdate: (changes: FloorCorrosionTransformChanges, summary: string, approved?: boolean) => void;
  overlay: FloorCorrosionOverlay;
}) {
  const scaleX = overlay.scaleX ?? 1;
  const scaleY = overlay.scaleY ?? 1;
  const offsetX = overlay.offsetX ?? 0;
  const offsetY = overlay.offsetY ?? 0;
  const adjust = (
    changes: FloorCorrosionTransformChanges,
    summary: string,
  ) => onUpdate(changes, summary, false);

  return (
    <div className="floor-corrosion-refinement-shell">
      <section
        aria-label={`Refine MFL placement for plate ${overlay.scanPlateId}`}
        className="floor-corrosion-refinement-panel"
      >
        <header>
          <div>
            <strong>Plate {overlay.scanPlateId} refinement</strong>
            <span>Adjust the corrosion overlay; the original MFL preview stays unchanged.</span>
          </div>
          <span className={overlay.status === "approved" ? "is-approved" : "is-review"}>
            {overlay.status === "approved" ? "Approved" : "Review required"}
          </span>
        </header>

        <div className="floor-corrosion-nudge-grid">
          <MflNudgeControl
            disabled={disabled}
            label="Size X"
            onDecrease={() => adjust(
              { scaleX: roundTransform(clampNumber(scaleX - 0.1, 0.5, 2.5)) },
              "Moved the corrosion overlay right edge left by 10% of the plate width.",
            )}
            onIncrease={() => adjust(
              { scaleX: roundTransform(clampNumber(scaleX + 0.1, 0.5, 2.5)) },
              "Moved the corrosion overlay right edge right by 10% of the plate width.",
            )}
            value={formatTransformPercent(scaleX)}
          />
          <MflNudgeControl
            disabled={disabled}
            label="Size Y"
            onDecrease={() => adjust(
              { scaleY: roundTransform(clampNumber(scaleY - 0.1, 0.5, 2.5)) },
              "Moved the corrosion overlay bottom edge up by 10% of the plate height.",
            )}
            onIncrease={() => adjust(
              { scaleY: roundTransform(clampNumber(scaleY + 0.1, 0.5, 2.5)) },
              "Moved the corrosion overlay bottom edge down by 10% of the plate height.",
            )}
            value={formatTransformPercent(scaleY)}
          />
          <MflNudgeControl
            decreaseLabel="Move left"
            disabled={disabled}
            increaseLabel="Move right"
            label="Offset X"
            onDecrease={() => adjust(
              { offsetX: roundTransform(clampNumber(offsetX - 0.05, -0.75, 0.75)) },
              "Moved the corrosion overlay left by 5% of the plate width.",
            )}
            onIncrease={() => adjust(
              { offsetX: roundTransform(clampNumber(offsetX + 0.05, -0.75, 0.75)) },
              "Moved the corrosion overlay right by 5% of the plate width.",
            )}
            value={formatSignedTransformPercent(offsetX)}
          />
          <MflNudgeControl
            decreaseLabel="Move up"
            disabled={disabled}
            increaseLabel="Move down"
            label="Offset Y"
            onDecrease={() => adjust(
              { offsetY: roundTransform(clampNumber(offsetY - 0.05, -0.75, 0.75)) },
              "Moved the corrosion overlay up by 5% of the plate height.",
            )}
            onIncrease={() => adjust(
              { offsetY: roundTransform(clampNumber(offsetY + 0.05, -0.75, 0.75)) },
              "Moved the corrosion overlay down by 5% of the plate height.",
            )}
            value={formatSignedTransformPercent(offsetY)}
          />
        </div>

        <div className="floor-corrosion-transform-actions">
          <button
            disabled={disabled}
            onClick={() => adjust(
              { rotationDegrees: ((overlay.rotationDegrees + 90) % 360) as 0 | 90 | 180 | 270 },
              "Rotated the corrosion overlay by 90 degrees.",
            )}
            type="button"
          >
            Rotate 90°
          </button>
          <button
            disabled={disabled}
            onClick={() => adjust(
              {
                rotationDegrees: 0,
                scaleX: 1,
                scaleY: 1,
                offsetX: 0,
                offsetY: 0,
              },
              "Reset the corrosion overlay transform.",
            )}
            type="button"
          >
            Reset
          </button>
          <button
            className="primary"
            disabled={disabled}
            onClick={() => onUpdate({}, "Approved the current corrosion-overlay placement.", true)}
            type="button"
          >
            {disabled ? "Saving..." : "Approve Placement"}
          </button>
        </div>
      </section>
    </div>
  );
}

function MflNudgeControl({
  decreaseLabel,
  disabled,
  increaseLabel,
  label,
  onDecrease,
  onIncrease,
  value,
}: {
  decreaseLabel?: string;
  disabled: boolean;
  increaseLabel?: string;
  label: string;
  onDecrease: () => void;
  onIncrease: () => void;
  value: string;
}) {
  return (
    <div className="floor-corrosion-nudge-control">
      <span>{label}</span>
      <button aria-label={decreaseLabel ?? `Decrease ${label}`} disabled={disabled} onClick={onDecrease} type="button">−</button>
      <output>{value}</output>
      <button aria-label={increaseLabel ?? `Increase ${label}`} disabled={disabled} onClick={onIncrease} type="button">+</button>
    </div>
  );
}

function roundTransform(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatTransformPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatSignedTransformPercent(value: number): string {
  const percent = Math.round(value * 100);
  return `${percent > 0 ? "+" : ""}${percent}%`;
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
      {field.detectedDraftValue && isMissing ? (
        <small className="missing-draft-detection">
          Detected in the generated draft. Confirm it to use it as a structured report detail.
        </small>
      ) : null}
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
          {field.detectedDraftValue ? "Confirm draft value" : "Use suggestion"}: {field.suggestion}
        </button>
      ) : null}
    </label>
  );
}

export default App;
