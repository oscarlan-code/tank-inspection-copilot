import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import LayoutCanvas from "./LayoutCanvas";
import "./reportPlatform.css";
import {
  HttpBrainAdapter,
  type BrainActionResponse,
  type SectionLogicFeedback,
  type SectionRefinementFeedback,
} from "./brain";
import { getSectionReferenceBundle } from "./referenceBundles";
import {
  buildReportPlan,
  createCustomSection,
  createDefaultWorkspace,
  createWorkspaceFromPackage,
  parseCanonicalPackageFile,
  type ChecklistItem,
  type ReportPlanEntry,
  type ReportWorkspace,
  type SectionAiAction,
  type SectionReferenceGroup,
  type SectionMode,
} from "./workspace";

type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type RefineWorkflowState = {
  open: boolean;
  comment: string;
  understanding: string;
  warnings: string[];
  evidenceNotes: string[];
  lastReviewedComment: string;
};

const initialMessages: Message[] = [
  {
    id: "assistant-1",
    role: "assistant",
    text: "TK-465 report workspace loaded. Start with the generated section checklist, confirm what belongs in the report, then refine the included sections one by one.",
  },
];

const initialWorkspace = createDefaultWorkspace();
const initialPlanEntries = buildReportPlan(initialWorkspace);
const LEFT_PANEL_STORAGE_KEY = "report-platform-left-width";
const RIGHT_PANEL_STORAGE_KEY = "report-platform-right-width";
const BRAIN_PROGRESS_STEPS = [
  "Preparing the active section bundle",
  "Reading captured data and reviewer inputs",
  "Applying sample report and API guard rails",
  "Drafting only the active section with Codex",
] as const;
const DRAFT_MUTATION_EFFECTS = new Set(["draft", "refine", "tighten", "format", "evidence"]);

const initialRefineWorkflowState: RefineWorkflowState = {
  open: false,
  comment: "",
  understanding: "",
  warnings: [],
  evidenceNotes: [],
  lastReviewedComment: "",
};

type AppliedRefinementContext = {
  userComment: string;
  confirmedUnderstanding: string;
};

type TrainingFeedbackWorkflowState = {
  open: boolean;
  rating: "up" | "down" | null;
  comment: string;
  understanding: string;
  warnings: string[];
  evidenceNotes: string[];
  lastReviewedComment: string;
};

const initialTrainingFeedbackWorkflowState: TrainingFeedbackWorkflowState = {
  open: false,
  rating: null,
  comment: "",
  understanding: "",
  warnings: [],
  evidenceNotes: [],
  lastReviewedComment: "",
};

type LogicFeedbackWorkflowState = {
  open: boolean;
  comment: string;
  understanding: string;
  warnings: string[];
  evidenceNotes: string[];
  lastReviewedComment: string;
};

const initialLogicFeedbackWorkflowState: LogicFeedbackWorkflowState = {
  open: false,
  comment: "",
  understanding: "",
  warnings: [],
  evidenceNotes: [],
  lastReviewedComment: "",
};

function readPanelWidth(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function countUniqueNonEmpty(values: Array<string | null | undefined>): number {
  return new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)).size;
}

function describeReadingCoverage(readingsGroups: number[][], targetLabel: string): string {
  const counts = readingsGroups.map((readings) => readings.length).filter((count) => count > 0);
  if (counts.length === 0) {
    return `no structured readings per ${targetLabel}`;
  }
  const minimum = Math.min(...counts);
  const maximum = Math.max(...counts);
  if (minimum === maximum) {
    return `${minimum} reading${minimum === 1 ? "" : "s"} per ${targetLabel}`;
  }
  return `${minimum} to ${maximum} readings per ${targetLabel}`;
}

function buildLocalDraftFallback(
  workspace: ReportWorkspace,
  section: ReportWorkspace["sections"][number],
  action: SectionAiAction,
  referenceBundle = getSectionReferenceBundle(section.id),
): string {
  const pkg = workspace.sourcePackage;
  const shellRows = pkg.measurements.shellUtRows ?? [];
  const roofRows = pkg.measurements.roofUtRows ?? [];
  const nozzleRows = (pkg.measurements.shellNozzleUtRows?.length ?? 0) + (pkg.measurements.roofNozzleUtRows?.length ?? 0);
  const roofMeasuredPlateCount = countUniqueNonEmpty(roofRows.map((row) => row.plateId));
  const roofReadingProfile = describeReadingCoverage(
    roofRows.map((row) => row.readingsMm),
    "roof plate",
  );
  const shellReadingProfile = describeReadingCoverage(
    shellRows.map((row) => row.readingsMm),
    "shell row",
  );
  const nozzleReadingProfile = describeReadingCoverage(
    [...(pkg.measurements.shellNozzleUtRows ?? []), ...(pkg.measurements.roofNozzleUtRows ?? [])].map((row) => row.readingsMm),
    "nozzle location",
  );
  const methodItems = [
    roofRows.length > 0 ? "roof ultrasonic thickness measurements" : "",
    shellRows.length > 0 ? "shell ultrasonic thickness measurements" : "",
    nozzleRows > 0 ? "nozzle and reinforcement-pad ultrasonic thickness measurements" : "",
    pkg.findings.length > 0 ? "general visual inspection with linked findings and photographs" : "",
  ].filter(Boolean);

  if (section.id === "scope-of-inspection") {
    return [
      roofRows.length > 0
        ? `- To carry out thickness measurements on ${roofMeasuredPlateCount} roof plate${
            roofMeasuredPlateCount === 1 ? "" : "s"
          } with ${roofReadingProfile.toLowerCase()} where access and surface conditions permit.`
        : "",
      shellRows.length > 0
        ? `- To carry out side wall inspection using the exported shell UT coverage across ${pkg.shellLinePlan.lineCount} crawler lane${
            pkg.shellLinePlan.lineCount === 1 ? "" : "s"
          }, with ${shellReadingProfile.toLowerCase()}.`
        : "",
      nozzleRows > 0
        ? `- To carry out thickness measurements on roof and shell nozzles where structured nozzle UT rows are available, using ${nozzleReadingProfile.toLowerCase()}.`
        : "",
      pkg.findings.length > 0
        ? "- To carry out a general visual inspection and record linked findings with photographic evidence."
        : "",
      "- To compile a report showing readings, locations, linked evidence, and layout references for the supported scope.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (section.id === "general-tank-information") {
    return section.facts.join("\n");
  }

  if (section.id === "inspection-report") {
    return [
      `The uploaded package supports ${shellRows.length} shell UT row${shellRows.length === 1 ? "" : "s"}, ${roofRows.length} roof UT row${
        roofRows.length === 1 ? "" : "s"
      }, and ${nozzleRows} nozzle UT row${nozzleRows === 1 ? "" : "s"}.`,
      pkg.findings.length > 0
        ? `A total of ${pkg.findings.length} linked finding${pkg.findings.length === 1 ? "" : "s"} and ${pkg.attachments.length} attachment reference${
            pkg.attachments.length === 1 ? "" : "s"
          } are available for narrative review.`
        : "No linked findings were captured in the current package.",
      `Current review state: ${pkg.reviewStatus.status.replace(/_/g, " ")}.`,
      "Floor and MFL interpretation remain deferred until the floor workflow is captured separately.",
    ].join("\n\n");
  }

  if (section.id === "test-information") {
    return [
      `Inspection type: ${pkg.inspection.inspectionType.replace(/_/g, " ")}`,
      `Started at: ${pkg.inspection.startedAt}`,
      pkg.inspection.completedAt ? `Completed at: ${pkg.inspection.completedAt}` : "",
      `Methods included: ${methodItems.join(", ") || "manual reviewer confirmation required"}.`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (section.layoutScene) {
    return `${section.title}: use the current ${section.layoutScene} layout view as the primary figure and keep the supporting text concise, location-led, and evidence-aware.`;
  }

  if (referenceBundle.sectionPromptProfile.some((item) => item.toLowerCase().includes("field per line"))) {
    return section.facts.join("\n");
  }

  if (referenceBundle.sectionPromptProfile.some((item) => item.toLowerCase().includes("bullet"))) {
    return section.facts.map((fact) => `- ${fact}`).join("\n");
  }

  return [section.summary, "", ...section.facts.slice(0, 6)].join("\n");
}

function refineLocalDraftFallback(currentDraft: string, userPrompt: string): string {
  const normalizedPrompt = userPrompt.toLowerCase();
  const lines = currentDraft
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!currentDraft.trim()) return currentDraft;

  if (normalizedPrompt.includes("bullet")) {
    return lines.map((line) => (line.startsWith("-") ? line : `- ${line.replace(/^[-•]\s*/, "")}`)).join("\n");
  }

  if (normalizedPrompt.includes("short")) {
    return lines.slice(0, Math.max(3, Math.ceil(lines.length * 0.7))).join("\n");
  }

  if (normalizedPrompt.includes("rephrase") || normalizedPrompt.includes("clear")) {
    return lines.join("\n");
  }

  return currentDraft;
}

export default function ReportPlatformShell() {
  const [workspace, setWorkspace] = useState<ReportWorkspace>(initialWorkspace);
  const [workspacePhase, setWorkspacePhase] = useState<"plan" | "edit">("plan");
  const [selectedSectionId, setSelectedSectionId] = useState(initialWorkspace.sections[0].id);
  const [activeMode, setActiveMode] = useState<SectionMode>("preview");
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(initialWorkspace.checklist);
  const [confirmedSections, setConfirmedSections] = useState<Record<string, boolean>>({});
  const [planEntries, setPlanEntries] = useState<ReportPlanEntry[]>(initialPlanEntries);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [prompt, setPrompt] = useState("");
  const [uploadState, setUploadState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [brainState, setBrainState] = useState<"idle" | "running" | "error">("idle");
  const [uploadMessage, setUploadMessage] = useState(
    "Using the seeded demo package until you load a canonical JSON export from the Android app.",
  );
  const [expandedPlanEntryId, setExpandedPlanEntryId] = useState<string | null>(null);
  const [brainProgressTick, setBrainProgressTick] = useState(0);
  const [customSectionTitle, setCustomSectionTitle] = useState("");
  const [customSectionPurpose, setCustomSectionPurpose] = useState("");
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => readPanelWidth(LEFT_PANEL_STORAGE_KEY, 286));
  const [rightPanelWidth, setRightPanelWidth] = useState(() => readPanelWidth(RIGHT_PANEL_STORAGE_KEY, 336));
  const [isCompactLayout, setIsCompactLayout] = useState(() => (typeof window === "undefined" ? false : window.innerWidth < 1040));
  const [refineWorkflow, setRefineWorkflow] = useState<RefineWorkflowState>(initialRefineWorkflowState);
  const [feedbackState, setFeedbackState] = useState<"idle" | "saving">("idle");
  const [sectionRatings, setSectionRatings] = useState<Record<string, "up" | "down">>({});
  const [appliedRefinements, setAppliedRefinements] = useState<Record<string, AppliedRefinementContext>>({});
  const [trainingFeedbackWorkflow, setTrainingFeedbackWorkflow] = useState<TrainingFeedbackWorkflowState>(
    initialTrainingFeedbackWorkflowState,
  );
  const [logicFeedbackWorkflow, setLogicFeedbackWorkflow] = useState<LogicFeedbackWorkflowState>(
    initialLogicFeedbackWorkflowState,
  );

  const includedSectionIds = useMemo(
    () => new Set(planEntries.filter((entry) => entry.included).map((entry) => entry.sectionId)),
    [planEntries],
  );
  const editingSections = useMemo(
    () => workspace.sections.filter((section) => includedSectionIds.has(section.id)),
    [workspace.sections, includedSectionIds],
  );
  const selectedSection = useMemo(() => {
    const sourceSections = workspacePhase === "edit" && editingSections.length > 0 ? editingSections : workspace.sections;
    return sourceSections.find((section) => section.id === selectedSectionId) ?? sourceSections[0] ?? workspace.sections[0];
  }, [editingSections, selectedSectionId, workspace.sections, workspacePhase]);
  const selectedPlanEntry = useMemo(
    () => planEntries.find((entry) => entry.sectionId === selectedSectionId) ?? planEntries[0],
    [planEntries, selectedSectionId],
  );
  const draftAction = useMemo(
    () =>
      selectedSection.aiPlaybook.suggestedActions.find((action) => action.effect === "draft") ?? {
        id: `generate-${selectedSection.id}`,
        label: "Generate Draft",
        effect: "draft" as const,
        instruction: "Generate a first-pass draft for the active section from the captured data and section guard rails.",
      },
    [selectedSection],
  );
  const understandRefineAction = useMemo(
    () => ({
      id: `understand-${selectedSection.id}`,
      label: "Review refine request",
      effect: "understand" as const,
      instruction:
        "Read the reviewer feedback for the active section, explain your understanding, call out any pushback or ambiguity, and wait for confirmation before changing the draft.",
    }),
    [selectedSection],
  );
  const compareAction = useMemo(
    () =>
      selectedSection.aiPlaybook.suggestedActions.find((action) => action.effect === "compare") ?? {
        id: `compare-${selectedSection.id}`,
        label: "Compare to Sample",
        effect: "compare" as const,
        instruction: "Compare the active section against the sample report structure and tone.",
      },
    [selectedSection],
  );
  const trainingFeedbackUnderstandAction = useMemo(
    () => ({
      id: `training-feedback-${selectedSection.id}`,
      label:
        trainingFeedbackWorkflow.rating === "down"
          ? "Review thumbs-down feedback"
          : "Review thumbs-up feedback",
      effect: "understand" as const,
      instruction:
        trainingFeedbackWorkflow.rating === "down"
          ? "Read the reviewer thumbs-down note for the active section, explain what is wrong or weak about the current draft, and describe what should be avoided in future runs without changing the draft."
          : "Read the reviewer thumbs-up note for the active section, explain what is strong about the current draft, and describe what should be reinforced in future runs without changing the draft.",
    }),
    [selectedSection, trainingFeedbackWorkflow.rating],
  );
  const logicFeedbackUnderstandAction = useMemo(
    () => ({
      id: `logic-feedback-${selectedSection.id}`,
      label: "Review logic improvement",
      effect: "understand" as const,
      instruction:
        "Read the reviewer logic-improvement note for the active section, restate it as a durable generation rule for future runs, call out any pushback or ambiguity, and do not change the current draft.",
    }),
    [selectedSection],
  );
  const hasSectionDraft = selectedSection.draft.trim().length > 0;
  const emptyDraftPlaceholder = `No AI draft yet for ${selectedSection.title}. Click "${draftAction.label}" to generate this section, or type manually here.`;
  const editorAiActions = useMemo<SectionAiAction[]>(
    () => [
      {
        id: `rephrase-${selectedSection.id}`,
        label: "Rephrase",
        effect: "refine",
        instruction: "Rephrase the active section to improve clarity while preserving the current meaning and guard rails.",
      },
      {
        id: `shorten-${selectedSection.id}`,
        label: "Shorten",
        effect: "tighten",
        instruction: "Shorten the active section while preserving the factual meaning and report tone.",
      },
      {
        id: `bullet-${selectedSection.id}`,
        label: "Bullet Points",
        effect: "format",
        instruction: "Restructure the active section into concise bullet points suitable for report review.",
      },
    ],
    [selectedSection],
  );

  const completionCount = Object.entries(confirmedSections).filter(
    ([sectionId, confirmed]) => confirmed && includedSectionIds.has(sectionId),
  ).length;
  const checklistCompletion = checklistItems.filter((item) => item.answer !== "").length;
  const totalSections = workspacePhase === "edit" ? editingSections.length : planEntries.filter((entry) => entry.included).length;
  const layoutMarkers = selectedSection.layoutScene === "roof" ? workspace.layoutScenes.roof : workspace.layoutScenes.shell;
  const selectedSectionReferences = useMemo<SectionReferenceGroup[]>(
    () =>
      [
        {
          title: "Key data points",
          items: selectedSection.facts,
        },
        ...selectedSection.references,
        {
          title: "Sample report format guard rails",
          items: getSectionReferenceBundle(selectedSection.id).sampleReportFormat,
        },
        {
          title: "API / inspection guard rails",
          items: getSectionReferenceBundle(selectedSection.id).apiGuardRails,
        },
      ].filter((group) => group.items.length > 0),
    [selectedSection],
  );

  const primaryWarning = workspace.workspaceMeta.validation.warnings[0];
  const includedCount = planEntries.filter((entry) => entry.included).length;
  const deferredCount = planEntries.filter((entry) => entry.recommendation === "deferred").length;
  const customCount = planEntries.filter((entry) => entry.source === "custom").length;
  const workspaceStripItems = [
    `${workspace.sourcePackage.inspection.client} · Tank ${workspace.sourcePackage.inspection.tankNumber}`,
    `${workspace.sourcePackage.inspection.site} · ${workspace.workspaceMeta.inspectionJobId}`,
    `Source ${workspace.workspaceMeta.sourceFileName}`,
  ];
  const statusSummary =
    uploadState === "loaded"
      ? "Canonical package hydrated"
      : uploadState === "loading"
        ? "Loading package"
        : uploadState === "error"
          ? "Package blocked"
          : "Seeded demo workspace";
  const visibleNavigatorEntries = workspacePhase === "plan" ? planEntries : planEntries.filter((entry) => entry.included);

  useEffect(() => {
    const sourceSections = workspacePhase === "edit" && editingSections.length > 0 ? editingSections : workspace.sections;
    if (sourceSections.length === 0) {
      return;
    }
    if (sourceSections.some((section) => section.id === selectedSectionId)) {
      return;
    }
    setSelectedSectionId(sourceSections[0].id);
    setActiveMode(sourceSections[0].modes[0]);
  }, [editingSections, selectedSectionId, workspace.sections, workspacePhase]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => setIsCompactLayout(window.innerWidth < 1040);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LEFT_PANEL_STORAGE_KEY, String(leftPanelWidth));
  }, [leftPanelWidth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RIGHT_PANEL_STORAGE_KEY, String(rightPanelWidth));
  }, [rightPanelWidth]);

  useEffect(() => {
    if (brainState !== "running") {
      setBrainProgressTick(0);
      return undefined;
    }
    setBrainProgressTick(0);
    const handle = window.setInterval(() => {
      setBrainProgressTick((current) => Math.min(current + 1, BRAIN_PROGRESS_STEPS.length - 1));
    }, 900);
    return () => window.clearInterval(handle);
  }, [brainState]);

  useEffect(() => {
    setRefineWorkflow(initialRefineWorkflowState);
    setTrainingFeedbackWorkflow(initialTrainingFeedbackWorkflowState);
    setLogicFeedbackWorkflow(initialLogicFeedbackWorkflowState);
  }, [selectedSection.id, workspacePhase]);

  const appendAssistant = (text: string) => {
    setMessages((current) => [
      ...current,
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text,
      },
    ]);
  };

  const updateSectionDraft = (nextDraft: string) => {
    setWorkspace((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === selectedSection.id
          ? {
              ...section,
              draft: nextDraft,
            }
          : section,
      ),
    }));
  };

  const confirmCurrentSection = () => {
    setConfirmedSections((current) => ({
      ...current,
      [selectedSection.id]: true,
    }));
    appendAssistant(`Section "${selectedSection.title}" marked ready. You can move to the next included section or reopen it later.`);
  };

  const goToNextSection = () => {
    const index = editingSections.findIndex((section) => section.id === selectedSection.id);
    const next = editingSections[index + 1];
    if (!next) return;
    setSelectedSectionId(next.id);
    setActiveMode(next.modes[0]);
  };

  const loadCanonicalPackage = async (file: File) => {
    setUploadState("loading");
    setUploadMessage(`Loading ${file.name}...`);
    try {
      const pkg = await parseCanonicalPackageFile(file);
      const nextWorkspace = createWorkspaceFromPackage(pkg, file.name);
      setWorkspace(nextWorkspace);
      setChecklistItems(nextWorkspace.checklist);
      setConfirmedSections({});
      setPlanEntries(buildReportPlan(nextWorkspace));
      setWorkspacePhase("plan");
      setSelectedSectionId(nextWorkspace.sections[0].id);
      setExpandedPlanEntryId(null);
      setActiveMode(nextWorkspace.sections[0].modes[0]);
      const { validation } = nextWorkspace.workspaceMeta;
      const warningCount = validation.warnings.length;
      setUploadState("loaded");
      setUploadMessage(
        warningCount > 0
          ? `${file.name} loaded with ${warningCount} validation warning${warningCount === 1 ? "" : "s"}.`
          : `${file.name} loaded and validated against the current canonical contract.`,
      );
      appendAssistant(
        `Loaded ${file.name}. The workspace is now hydrated from the uploaded package and a new section checklist has been generated.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown upload error";
      setUploadState("error");
      setUploadMessage(message);
      appendAssistant(`Upload blocked: ${message}`);
    }
  };

  const togglePlanEntry = (sectionId: string) => {
    setPlanEntries((current) =>
      current.map((entry) =>
        entry.sectionId === sectionId && !entry.locked
          ? {
              ...entry,
              included: !entry.included,
            }
          : entry,
      ),
    );
  };

  const removeCustomSection = (sectionId: string) => {
    setWorkspace((current) => ({
      ...current,
      sections: current.sections.filter((section) => section.id !== sectionId),
    }));
    setPlanEntries((current) => current.filter((entry) => entry.sectionId !== sectionId));
    setConfirmedSections((current) => {
      const next = { ...current };
      delete next[sectionId];
      return next;
    });
    appendAssistant("Removed the custom section from the report plan.");
  };

  const addCustomPlanSection = () => {
    const title = customSectionTitle.trim();
    if (!title) {
      appendAssistant("Add a short title before creating a custom section.");
      return;
    }
    const nextSequence = workspace.sections.length + 1;
    const customSection = createCustomSection(title, customSectionPurpose, nextSequence);
    const nextWorkspace = {
      ...workspace,
      sections: [...workspace.sections, customSection],
    };
    const nextPlan = buildReportPlan(nextWorkspace).map((entry) =>
      entry.sectionId === customSection.id
        ? {
            ...entry,
            included: true,
            recommendation: "optional" as const,
            reason: customSectionPurpose.trim()
              ? `Reviewer-added section for: ${customSectionPurpose.trim()}`
              : "Reviewer-added section outside the seeded sample template.",
          }
        : entry,
    );
    setWorkspace(nextWorkspace);
    setPlanEntries(nextPlan);
    setSelectedSectionId(customSection.id);
    setExpandedPlanEntryId(customSection.id);
    setCustomSectionTitle("");
    setCustomSectionPurpose("");
    appendAssistant(`Added custom section "${customSection.title}" to the report plan.`);
  };

  const startEditingIncludedSections = () => {
    const firstIncluded = workspace.sections.find((section) => includedSectionIds.has(section.id));
    if (!firstIncluded) {
      appendAssistant("At least one section must be included before editing can start.");
      return;
    }
    setWorkspacePhase("edit");
    setSelectedSectionId(firstIncluded.id);
    setActiveMode(firstIncluded.modes[0]);
    appendAssistant(
      `Report plan confirmed. Editing now starts with ${includedCount} included section${includedCount === 1 ? "" : "s"}.`,
    );
  };

  const runAiAction = async (
    action: SectionAiAction,
    userPrompt?: string,
    options?: {
      refinementFeedback?: SectionRefinementFeedback;
      skipAutomaticDraftUpdate?: boolean;
      suppressStartMessage?: boolean;
    },
  ): Promise<BrainActionResponse | null> => {
    setBrainState("running");
    if (!options?.suppressStartMessage) {
      appendAssistant(
        `Working on Section ${selectedSection.sequence} "${selectedSection.title}". I’m grounding this pass against the captured data, the confirmed section plan, and the section guard rails.`,
      );
    }
    try {
      const brain = new HttpBrainAdapter();
      const result = await brain.runSectionAction({
        workspace,
        section: selectedSection,
        sectionPlan: planEntries,
        checklist: checklistItems,
        action,
        referenceBundle: getSectionReferenceBundle(selectedSection.id),
        userPrompt,
        refinementFeedback: options?.refinementFeedback,
      });
      if (!options?.skipAutomaticDraftUpdate && DRAFT_MUTATION_EFFECTS.has(action.effect)) {
        updateSectionDraft(result.draft);
      }
      appendAssistant(result.assistantMessage);
      if (result.evidenceNotes.length > 0) {
        appendAssistant(`Grounding summary: ${result.evidenceNotes.join(" ")}`);
      }
      if (result.warnings.length > 0) {
        appendAssistant(`Warnings: ${result.warnings.join(" ")}`);
      }
      setBrainState("idle");
      return result;
    } catch (error) {
      setBrainState("error");
      const message = error instanceof Error ? error.message : "Brain execution failed.";
      appendAssistant(`Codex worker unavailable, using local fallback. ${message}`);
    }

    if (action.effect === "understand") {
      const fallbackUnderstanding = userPrompt
        ? `I understand that you want this section changed as follows: ${userPrompt}. I will keep the section inside its current guard rails and only apply the change after you confirm.`
        : `I need a clearer reviewer instruction before I can explain the requested refinement for Section ${selectedSection.sequence} "${selectedSection.title}".`;
      const fallbackResult: BrainActionResponse = {
        ok: true,
        provider: "mock",
        draft: selectedSection.draft,
        assistantMessage: fallbackUnderstanding,
        warnings: [],
        evidenceNotes: selectedSection.facts.slice(0, 3),
      };
      appendAssistant(fallbackResult.assistantMessage);
      setBrainState("idle");
      return fallbackResult;
    }

    if (action.effect === "draft") {
      const fallbackDraft = buildLocalDraftFallback(workspace, selectedSection, action);
      updateSectionDraft(fallbackDraft);
      appendAssistant(`Section ${selectedSection.sequence} "${selectedSection.title}" updated with the local fallback draft while Codex was unavailable.`);
      setBrainState("idle");
      return {
        ok: true,
        provider: "mock",
        draft: fallbackDraft,
        assistantMessage: `Section ${selectedSection.sequence} "${selectedSection.title}" updated with the local fallback draft while Codex was unavailable.`,
        warnings: ["Codex worker unavailable; local section fallback was used."],
        evidenceNotes: selectedSection.facts.slice(0, 4),
      };
    }

    if (action.effect === "refine" || action.effect === "evidence") {
      const fallbackDraft = action.effect === "refine" ? refineLocalDraftFallback(selectedSection.draft, userPrompt ?? "") : selectedSection.draft;
      updateSectionDraft(fallbackDraft);
      appendAssistant(`Section ${selectedSection.sequence} "${selectedSection.title}" updated. ${action.instruction}`);
      setBrainState("idle");
      return {
        ok: true,
        provider: "mock",
        draft: fallbackDraft,
        assistantMessage: `Section ${selectedSection.sequence} "${selectedSection.title}" updated. ${action.instruction}`,
        warnings: [],
        evidenceNotes: [],
      };
    }
    if (action.effect === "tighten") {
      const tightenedDraft = selectedSection.draft.replace(/\s{2,}/g, " ").trim();
      updateSectionDraft(tightenedDraft);
      appendAssistant(`I tightened the wording in Section ${selectedSection.sequence} "${selectedSection.title}" and removed extra spacing noise.`);
      setBrainState("idle");
      return {
        ok: true,
        provider: "mock",
        draft: tightenedDraft,
        assistantMessage: `I tightened the wording in Section ${selectedSection.sequence} "${selectedSection.title}" and removed extra spacing noise.`,
        warnings: [],
        evidenceNotes: [],
      };
    }
    if (action.effect === "format") {
      const formattedDraft = `Summary:\n${selectedSection.draft}\n\nEvidence focus:\n- Link to measurements\n- Link to findings\n- Link to calculations`;
      updateSectionDraft(formattedDraft);
      appendAssistant(`I reformatted Section ${selectedSection.sequence} "${selectedSection.title}" into a more review-friendly structure.`);
      setBrainState("idle");
      return {
        ok: true,
        provider: "mock",
        draft: formattedDraft,
        assistantMessage: `I reformatted Section ${selectedSection.sequence} "${selectedSection.title}" into a more review-friendly structure.`,
        warnings: [],
        evidenceNotes: [],
      };
    }
    if (action.effect === "compare") {
      appendAssistant(`Comparison check for Section ${selectedSection.sequence}: keep the current structure aligned to the TK-465 sample report order and section tone.`);
      setBrainState("idle");
      return {
        ok: true,
        provider: "mock",
        draft: selectedSection.draft,
        assistantMessage: `Comparison check for Section ${selectedSection.sequence}: keep the current structure aligned to the TK-465 sample report order and section tone.`,
        warnings: [],
        evidenceNotes: [],
      };
    }
    appendAssistant(`For Section ${selectedSection.sequence} "${selectedSection.title}", the main remaining inputs are: ${selectedSection.aiPlaybook.blockers.join(" ")}`);
    setBrainState("idle");
    return {
      ok: true,
      provider: "mock",
      draft: selectedSection.draft,
      assistantMessage: `For Section ${selectedSection.sequence} "${selectedSection.title}", the main remaining inputs are: ${selectedSection.aiPlaybook.blockers.join(" ")}`,
      warnings: [],
      evidenceNotes: [],
    };
  };

  const requestRefineUnderstanding = async () => {
    const comment = refineWorkflow.comment.trim();
    if (!comment) {
      appendAssistant("Add a short refine note before asking Codex to interpret it.");
      return;
    }
    const result = await runAiAction(understandRefineAction, comment, {
      skipAutomaticDraftUpdate: true,
    });
    if (!result) return;
    setRefineWorkflow((current) => ({
      ...current,
      understanding: result.assistantMessage,
      warnings: result.warnings,
      evidenceNotes: result.evidenceNotes,
      lastReviewedComment: comment,
    }));
  };

  const applyConfirmedRefinement = async () => {
    const comment = refineWorkflow.comment.trim();
    if (!comment) {
      appendAssistant("The refine note is empty. Add reviewer guidance before applying a change.");
      return;
    }
    if (!refineWorkflow.understanding.trim()) {
      appendAssistant("Ask Codex to interpret the refine note first so you can confirm the intended change.");
      return;
    }
    const confirmedPrompt = [
      `Reviewer comment: ${comment}`,
      `Confirmed understanding: ${refineWorkflow.understanding}`,
      "Apply the confirmed change to the active section only.",
    ].join("\n");
    const result = await runAiAction(
      {
        id: `apply-refine-${selectedSection.id}`,
        label: "Apply confirmed refinement",
        effect: "refine",
        instruction:
          "Apply the confirmed reviewer refinement to the active section only. Preserve factual accuracy, section guard rails, and the expected report format.",
      },
      confirmedPrompt,
      {
        refinementFeedback: {
          userComment: comment,
          confirmedUnderstanding: refineWorkflow.understanding,
        },
      },
    );
    if (!result) return;
    setAppliedRefinements((current) => ({
      ...current,
      [selectedSection.id]: {
        userComment: comment,
        confirmedUnderstanding: refineWorkflow.understanding,
      },
    }));
    setRefineWorkflow({
      ...initialRefineWorkflowState,
      open: false,
    });
    appendAssistant(
      `Confirmed refinement applied to Section ${selectedSection.sequence} "${selectedSection.title}". If the result is good, use thumbs up or thumbs down to train future section runs.`,
    );
  };

  const requestLogicFeedbackUnderstanding = async () => {
    const comment = logicFeedbackWorkflow.comment.trim();
    if (!comment) {
      appendAssistant("Add a permanent logic note before asking Codex to restate the section rule.");
      return;
    }
    const result = await runAiAction(logicFeedbackUnderstandAction, comment, {
      skipAutomaticDraftUpdate: true,
      suppressStartMessage: true,
    });
    if (!result) return;
    setLogicFeedbackWorkflow((current) => ({
      ...current,
      understanding: result.assistantMessage,
      warnings: result.warnings,
      evidenceNotes: result.evidenceNotes,
      lastReviewedComment: comment,
    }));
  };

  const saveLogicFeedback = async () => {
    const comment = logicFeedbackWorkflow.comment.trim();
    if (!comment) {
      appendAssistant("Explain the permanent section logic improvement before saving it.");
      return;
    }
    if (!logicFeedbackWorkflow.understanding.trim()) {
      appendAssistant("Ask Codex to restate the logic rule first so the permanent rule is explicit.");
      return;
    }
    setFeedbackState("saving");
    try {
      const brain = new HttpBrainAdapter();
      const feedback: SectionLogicFeedback = {
        sectionId: selectedSection.id,
        sectionTitle: selectedSection.title,
        draft: selectedSection.draft,
        userComment: comment,
        confirmedRule: logicFeedbackWorkflow.understanding.trim(),
      };
      await brain.storeSectionLogicFeedback(feedback);
      appendAssistant(
        `Permanent logic improvement saved for Section ${selectedSection.sequence} "${selectedSection.title}". It is stored separately from thumbs feedback and should be platform-admin-governed in the future multi-tenant product.`,
      );
      setLogicFeedbackWorkflow(initialLogicFeedbackWorkflowState);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown logic feedback error";
      appendAssistant(`Unable to save permanent section logic right now. ${message}`);
    } finally {
      setFeedbackState("idle");
    }
  };

  const openTrainingFeedback = (rating: "up" | "down") => {
    if (!hasSectionDraft) {
      appendAssistant("Generate or write a draft before rating the section output.");
      return;
    }
    setRefineWorkflow(initialRefineWorkflowState);
    setLogicFeedbackWorkflow(initialLogicFeedbackWorkflowState);
    setTrainingFeedbackWorkflow({
      open: true,
      rating,
      comment: "",
      understanding: "",
      warnings: [],
      evidenceNotes: [],
      lastReviewedComment: "",
    });
  };

  const requestTrainingFeedbackUnderstanding = async () => {
    const comment = trainingFeedbackWorkflow.comment.trim();
    if (!trainingFeedbackWorkflow.rating) {
      appendAssistant("Choose thumbs up or thumbs down before reviewing training feedback.");
      return;
    }
    if (!comment) {
      appendAssistant("Add a short note explaining what was good or wrong before asking Codex to interpret the feedback.");
      return;
    }
    const result = await runAiAction(trainingFeedbackUnderstandAction, comment, {
      skipAutomaticDraftUpdate: true,
    });
    if (!result) return;
    setTrainingFeedbackWorkflow((current) => ({
      ...current,
      understanding: result.assistantMessage,
      warnings: result.warnings,
      evidenceNotes: result.evidenceNotes,
      lastReviewedComment: comment,
    }));
  };

  const saveTrainingFeedback = async () => {
    if (!trainingFeedbackWorkflow.rating) {
      appendAssistant("Choose thumbs up or thumbs down before saving training feedback.");
      return;
    }
    if (!trainingFeedbackWorkflow.comment.trim()) {
      appendAssistant("Explain what was good or wrong before saving training feedback.");
      return;
    }
    if (!trainingFeedbackWorkflow.understanding.trim()) {
      appendAssistant("Ask Codex to interpret the thumbs feedback first so the saved memory is explicit.");
      return;
    }
    setFeedbackState("saving");
    try {
      const brain = new HttpBrainAdapter();
      const refinementContext = appliedRefinements[selectedSection.id];
      await brain.storeSectionFeedback({
        sectionId: selectedSection.id,
        sectionTitle: selectedSection.title,
        rating: trainingFeedbackWorkflow.rating,
        draft: selectedSection.draft,
        userComment: [
          trainingFeedbackWorkflow.comment.trim(),
          refinementContext?.userComment ? `Last applied refine note: ${refinementContext.userComment}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        confirmedUnderstanding: [
          trainingFeedbackWorkflow.understanding.trim(),
          refinementContext?.confirmedUnderstanding
            ? `Last applied refine understanding: ${refinementContext.confirmedUnderstanding}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      });
      setSectionRatings((current) => ({
        ...current,
        [selectedSection.id]: trainingFeedbackWorkflow.rating as "up" | "down",
      }));
      appendAssistant(
        trainingFeedbackWorkflow.rating === "up"
          ? `Thumbs up feedback saved for Section ${selectedSection.sequence} "${selectedSection.title}". Future drafts can now reinforce the confirmed strengths you identified.`
          : `Thumbs down feedback saved for Section ${selectedSection.sequence} "${selectedSection.title}". Future drafts can now avoid the weaknesses you identified.`,
      );
      setTrainingFeedbackWorkflow(initialTrainingFeedbackWorkflowState);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown feedback error";
      appendAssistant(`Unable to save section feedback right now. ${message}`);
    } finally {
      setFeedbackState("idle");
    }
  };

  const sendPrompt = () => {
    const value = prompt.trim();
    if (!value) return;
    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text: value,
      },
    ]);
    setPrompt("");
    void runAiAction(
      {
        id: "custom-prompt",
        label: "Custom prompt",
        effect: "refine",
        instruction: "Use the user prompt to refine the active section while respecting the current guard rails.",
      },
      value,
    );
  };

  const startResize = (side: "left" | "right") => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isCompactLayout) return;
    event.preventDefault();
    const pointerId = event.pointerId;
    const originX = event.clientX;
    const startingLeft = leftPanelWidth;
    const startingRight = rightPanelWidth;

    const onMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - originX;
      if (side === "left") {
        setLeftPanelWidth(clamp(startingLeft + delta, 240, 420));
        return;
      }
      setRightPanelWidth(clamp(startingRight - delta, 280, 480));
    };

    const onEnd = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onEnd);
      document.body.classList.remove("rp-is-resizing");
    };

    document.body.classList.add("rp-is-resizing");
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onEnd, { once: true });
    event.currentTarget.setPointerCapture(pointerId);
  };

  const shellStyle = isCompactLayout
    ? undefined
    : {
        gridTemplateColumns: `${leftPanelWidth}px 12px minmax(0, 1fr) 12px ${rightPanelWidth}px`,
      };

  return (
    <div className="rp-shell" style={shellStyle}>
      <aside className="rp-explorer">
        <div className="rp-panel-head rp-panel-head-compact">
          <div className="rp-inline-eyebrow">Report Template</div>
          <h1>{workspacePhase === "plan" ? "Report Setup" : "Section Navigator"}</h1>
          <p>
            {workspacePhase === "plan"
              ? "Confirm the section list first, then move into editing."
              : "Included sections only. Reopen the report plan whenever the structure needs to change."}
          </p>
        </div>
        <button className={`rp-section-button rp-plan-launch ${workspacePhase === "plan" ? "is-selected" : ""}`} onClick={() => setWorkspacePhase("plan")}>
          <span className="rp-section-button-head">
            <span className="rp-section-sequence">PL</span>
            <span className="rp-section-button-meta">Generated checklist</span>
          </span>
          <span className="rp-section-button-title">Report Plan</span>
          <span className="rp-section-badges">
            <span className="rp-plan-pill is-included">{includedCount} included</span>
          </span>
        </button>
        {workspacePhase === "edit" ? (
          <div className="rp-section-list">
            {visibleNavigatorEntries.map((entry) => {
              const selected = entry.sectionId === selectedPlanEntry?.sectionId;
              return (
                <button
                  key={entry.sectionId}
                  className={`rp-section-button ${selected ? "is-selected" : ""}`}
                  onClick={() => {
                    setSelectedSectionId(entry.sectionId);
                    const section = workspace.sections.find((candidate) => candidate.id === entry.sectionId);
                    if (section) {
                      setActiveMode(section.modes[0]);
                    }
                  }}
                >
                  <span className="rp-section-button-head">
                    <span className="rp-section-sequence">{String(entry.sequence).padStart(2, "0")}</span>
                    <span className="rp-section-button-meta">{entry.templateSection}</span>
                  </span>
                  <span className="rp-section-button-title">{entry.title}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </aside>
      <div className="rp-resize-handle rp-resize-handle-left" onPointerDown={startResize("left")} />

      <main className="rp-center">
        <header className="rp-center-header">
          <div className="rp-header-main">
            <div className="rp-header-copy">
              {workspacePhase === "plan" ? (
                <>
                  <div className="rp-inline-eyebrow">Generated report plan</div>
                  <h2>Section inclusion checklist before drafting</h2>
                  <p>
                    Tick the sections that should appear in this report. The list is generated from the current field package,
                    the TK-465 report structure, and the current API-oriented guard rails. After confirmation, the editor opens
                    as the next step.
                  </p>
                </>
              ) : (
                <>
                  <div className="rp-inline-eyebrow">
                    {selectedSection.templateSection} · {selectedSection.group}
                  </div>
                  <h2>{selectedSection.title}</h2>
                  <p>{selectedSection.summary}</p>
                </>
              )}
            </div>
            <div className="rp-header-actions">
              {workspacePhase === "plan" ? (
                <>
                  <span className="rp-status-pill rp-status-pill-neutral">{includedCount} sections selected</span>
                </>
              ) : (
                <>
                  <span className="rp-status-pill">{selectedSection.status}</span>
                  <span className="rp-status-pill rp-status-pill-neutral">
                    {completionCount}/{totalSections} confirmed
                  </span>
                  <span className="rp-status-pill rp-status-pill-neutral">{checklistCompletion} checklist answered</span>
                </>
              )}
              <label className="rp-ghost-button rp-upload-inline">
                {uploadState === "loading" ? "Loading..." : "Load Package"}
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void loadCanonicalPackage(file);
                    }
                    event.target.value = "";
                  }}
                />
              </label>
              {workspacePhase === "plan" ? (
                <button className="rp-primary-button rp-button-inline" onClick={startEditingIncludedSections}>
                  Confirm Plan and Continue
                </button>
              ) : (
                <>
                  <button className="rp-ghost-button" onClick={() => setWorkspacePhase("plan")}>
                    Edit Report Plan
                  </button>
                  <button className="rp-ghost-button" onClick={confirmCurrentSection}>
                    {confirmedSections[selectedSection.id] ? "Confirmed" : "Confirm Section"}
                  </button>
                  <button className="rp-primary-button rp-button-inline" onClick={goToNextSection}>
                    Next Section
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="rp-workspace-strip">
            <div className="rp-workspace-strip-main">
              {workspaceStripItems.map((item) => (
                <div key={item} className="rp-workspace-pill">
                  {item}
                </div>
              ))}
            </div>
            <div className="rp-workspace-strip-side">
              <div className={`rp-banner-pill is-${uploadState}`}>{statusSummary}</div>
              {primaryWarning ? <div className="rp-banner-pill is-warning">{primaryWarning}</div> : null}
              {brainState === "running" ? <div className="rp-banner-pill">Codex worker running</div> : null}
              {uploadState === "error" ? <div className="rp-banner-pill is-error">{uploadMessage}</div> : null}
            </div>
          </div>
        </header>

        {workspacePhase === "edit" ? (
          <div className="rp-mode-tabs">
            {selectedSection.modes.map((mode) => (
              <button
                key={mode}
                className={`rp-mode-tab ${mode === activeMode ? "is-active" : ""}`}
                onClick={() => setActiveMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        ) : null}

        {workspacePhase === "edit" ? (
          <div className="rp-section-action-bar">
            <div className="rp-section-action-copy">
              <strong>Section Actions</strong>
              <span>Codex works on this section only. Generate first, then refine or edit manually.</span>
            </div>
            <div className="rp-section-action-buttons">
              <button
                className="rp-ghost-button"
                onClick={() => {
                  setTrainingFeedbackWorkflow(initialTrainingFeedbackWorkflowState);
                  setLogicFeedbackWorkflow(initialLogicFeedbackWorkflowState);
                  setRefineWorkflow((current) => ({ ...current, open: !current.open }));
                }}
                disabled={brainState === "running" || !hasSectionDraft}
              >
                {refineWorkflow.open ? "Hide Refine" : "Refine Draft"}
              </button>
              <button
                className="rp-ghost-button"
                onClick={() => {
                  setTrainingFeedbackWorkflow(initialTrainingFeedbackWorkflowState);
                  setRefineWorkflow(initialRefineWorkflowState);
                  setLogicFeedbackWorkflow((current) => ({ ...current, open: !current.open }));
                }}
                disabled={brainState === "running" || feedbackState === "saving"}
              >
                {logicFeedbackWorkflow.open ? "Hide Logic" : "Improve Logic"}
              </button>
              <button className="rp-primary-button rp-button-inline" onClick={() => void runAiAction(draftAction)} disabled={brainState === "running"}>
                {brainState === "running" ? "Generating..." : draftAction.label}
              </button>
              <button className="rp-ghost-button" onClick={() => void runAiAction(compareAction)} disabled={brainState === "running" || !hasSectionDraft}>
                Compare to Sample
              </button>
            </div>
          </div>
        ) : null}

        <section className="rp-center-surface">
          {workspacePhase === "plan" ? (
            <div className="rp-plan-grid">
              <div className="rp-work-card">
                <div className="rp-card-title">Generated Section Checklist</div>
                <p className="rp-plan-intro">
                  Tick the sections that should appear in the report. Open <strong>Details</strong> only when you want to inspect the section basis.
                </p>
                <div className="rp-plan-list">
                  {planEntries.map((entry) => {
                    const selected = entry.sectionId === selectedPlanEntry?.sectionId;
                    return (
                      <div
                        key={entry.sectionId}
                        className={`rp-plan-item ${selected ? "is-selected" : ""}`}
                        onClick={() => setSelectedSectionId(entry.sectionId)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedSectionId(entry.sectionId);
                          }
                        }}
                      >
                        <div className="rp-plan-item-main">
                          <div className="rp-plan-item-head">
                            <label className={`rp-plan-checkbox ${entry.locked ? "is-locked" : ""}`}>
                              <input
                                type="checkbox"
                                checked={entry.included}
                                disabled={entry.locked}
                                onChange={() => togglePlanEntry(entry.sectionId)}
                                onClick={(event) => event.stopPropagation()}
                              />
                              <span className="rp-plan-checkbox-visual" />
                            </label>
                            <span className="rp-section-sequence">{String(entry.sequence).padStart(2, "0")}</span>
                            <div className="rp-plan-item-copy">
                              <strong>{entry.title}</strong>
                            </div>
                          </div>
                        </div>
                        <div className="rp-plan-item-actions">
                          <button
                            className="rp-ghost-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setExpandedPlanEntryId((current) => (current === entry.sectionId ? null : entry.sectionId));
                              setSelectedSectionId(entry.sectionId);
                            }}
                          >
                            {expandedPlanEntryId === entry.sectionId ? "Hide Details" : "Details"}
                          </button>
                          {entry.source === "custom" ? (
                            <button
                              className="rp-ghost-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                removeCustomSection(entry.sectionId);
                              }}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                        {expandedPlanEntryId === entry.sectionId ? (
                          <div className="rp-plan-item-details">
                            <p className="rp-plan-note">{entry.reason}</p>
                            <div className="rp-plan-detail-meta">
                              <span className="rp-plan-basis-pill">{entry.templateSection}</span>
                              <span className="rp-plan-basis-pill">{entry.group}</span>
                              <span className="rp-plan-basis-pill">{entry.source}</span>
                              {!entry.included ? <span className="rp-plan-basis-pill">not selected</span> : null}
                            </div>
                            <div className="rp-plan-basis">
                              {entry.basis.map((item) => (
                                <span key={item} className="rp-plan-basis-pill">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rp-plan-side">
                <div className="rp-work-card rp-reference-card">
                  <div className="rp-card-title">Planning Notes</div>
                  <div className="rp-reference-stack">
                    <div className="rp-reference-group">
                      <strong>How to use this step</strong>
                      <ul className="rp-reference-list">
                        <li>Tick the sections that should appear in the report.</li>
                        <li>Use `Details` only when you want to inspect the section basis.</li>
                        <li>After confirmation, the editor opens as the next page for section-by-section drafting.</li>
                      </ul>
                    </div>
                    {selectedPlanEntry ? (
                      <div className="rp-reference-group">
                        <strong>Current row</strong>
                        <ul className="rp-reference-list">
                          <li>{selectedPlanEntry.title}</li>
                          <li>{selectedPlanEntry.included ? "Selected" : "Not selected"}</li>
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rp-work-card">
                  <div className="rp-card-title">Add Custom Section</div>
                  <div className="rp-plan-form">
                    <input
                      type="text"
                      value={customSectionTitle}
                      onChange={(event) => setCustomSectionTitle(event.target.value)}
                      placeholder="Client note, disclaimer, or extra appendix title"
                    />
                    <textarea
                      value={customSectionPurpose}
                      onChange={(event) => setCustomSectionPurpose(event.target.value)}
                      placeholder="Why should this section exist in the report?"
                    />
                    <button className="rp-primary-button rp-button-inline" onClick={addCustomPlanSection}>
                      Add Custom Section
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {workspacePhase === "edit" && activeMode === "preview" ? (
            <div className="rp-preview-grid">
              <div className="rp-work-card">
                <div className="rp-card-title">Editable Section Workspace</div>
                <div className="rp-draft-feedback-bar">
                  <div className="rp-draft-feedback-copy">
                    <strong>Training Feedback</strong>
                    <span>Use thumbs up or thumbs down after reviewing the generated content. Codex will help capture why before the feedback is stored.</span>
                  </div>
                  <div className="rp-draft-feedback-actions">
                    <button
                      className={`rp-ghost-button ${sectionRatings[selectedSection.id] === "up" ? "is-active" : ""}`}
                      onClick={() => openTrainingFeedback("up")}
                      disabled={!hasSectionDraft || brainState === "running" || feedbackState === "saving"}
                    >
                      👍 Thumbs Up
                    </button>
                    <button
                      className={`rp-ghost-button ${sectionRatings[selectedSection.id] === "down" ? "is-active" : ""}`}
                      onClick={() => openTrainingFeedback("down")}
                      disabled={!hasSectionDraft || brainState === "running" || feedbackState === "saving"}
                    >
                      👎 Thumbs Down
                    </button>
                  </div>
                </div>
                {trainingFeedbackWorkflow.open ? (
                  <div className="rp-refine-panel rp-training-panel">
                    <div className="rp-refine-panel-head">
                      <div>
                        <div className="rp-card-title">
                          {trainingFeedbackWorkflow.rating === "down" ? "Thumbs Down Review" : "Thumbs Up Review"}
                        </div>
                        <p className="rp-refine-note">
                          Explain what was {trainingFeedbackWorkflow.rating === "down" ? "wrong or weak" : "good"} about this section. Codex will summarize the lesson before it is stored for future runs.
                        </p>
                      </div>
                      <div className="rp-refine-panel-actions">
                        <button
                          className="rp-ghost-button"
                          onClick={() => setTrainingFeedbackWorkflow(initialTrainingFeedbackWorkflowState)}
                          disabled={brainState === "running" || feedbackState === "saving"}
                        >
                          Cancel
                        </button>
                        <button
                          className="rp-primary-button rp-button-inline"
                          onClick={() => void requestTrainingFeedbackUnderstanding()}
                          disabled={brainState === "running" || feedbackState === "saving" || !trainingFeedbackWorkflow.comment.trim()}
                        >
                          {brainState === "running" ? "Reviewing..." : "Review Feedback"}
                        </button>
                      </div>
                    </div>
                    <textarea
                      className="rp-refine-textarea"
                      value={trainingFeedbackWorkflow.comment}
                      onChange={(event) =>
                        setTrainingFeedbackWorkflow((current) => ({
                          ...current,
                          comment: event.target.value,
                        }))
                      }
                      placeholder={
                        trainingFeedbackWorkflow.rating === "down"
                          ? "Example: this section sounded generic, missed the key roof UT count, and should have stayed as a factual block."
                          : "Example: this section used the right field-by-field structure and kept the sample report tone."
                      }
                    />
                    {trainingFeedbackWorkflow.understanding ? (
                      <div className="rp-refine-understanding">
                        <strong>Codex Feedback Understanding</strong>
                        <p>{trainingFeedbackWorkflow.understanding}</p>
                        {trainingFeedbackWorkflow.warnings.length > 0 ? (
                          <div className="rp-refine-meta">
                            <strong>Warnings</strong>
                            <ul className="rp-reference-list">
                              {trainingFeedbackWorkflow.warnings.map((warning) => (
                                <li key={warning}>{warning}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {trainingFeedbackWorkflow.evidenceNotes.length > 0 ? (
                          <div className="rp-refine-meta">
                            <strong>Grounding summary</strong>
                            <ul className="rp-reference-list">
                              {trainingFeedbackWorkflow.evidenceNotes.map((note) => (
                                <li key={note}>{note}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        <div className="rp-refine-confirm-row">
                          <button
                            className="rp-ghost-button"
                            onClick={() =>
                              setTrainingFeedbackWorkflow((current) => ({
                                ...current,
                                understanding: "",
                                warnings: [],
                                evidenceNotes: [],
                                lastReviewedComment: "",
                              }))
                            }
                            disabled={brainState === "running" || feedbackState === "saving"}
                          >
                            Revise Feedback
                          </button>
                          <button
                            className="rp-primary-button rp-button-inline"
                            onClick={() => void saveTrainingFeedback()}
                            disabled={
                              brainState === "running" ||
                              feedbackState === "saving" ||
                              !trainingFeedbackWorkflow.understanding.trim() ||
                              trainingFeedbackWorkflow.lastReviewedComment.trim() !== trainingFeedbackWorkflow.comment.trim()
                            }
                          >
                            {feedbackState === "saving" ? "Saving..." : "Confirm Feedback"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {logicFeedbackWorkflow.open ? (
                  <div className="rp-refine-panel rp-logic-panel">
                    <div className="rp-refine-panel-head">
                      <div>
                        <div className="rp-card-title">Permanent Section Logic</div>
                        <p className="rp-refine-note">
                          Use this when the generation logic itself should improve for future runs, not just this one draft. Codex will restate the note as a durable section rule before it is saved.
                        </p>
                      </div>
                      <div className="rp-refine-panel-actions">
                        <button
                          className="rp-ghost-button"
                          onClick={() => setLogicFeedbackWorkflow(initialLogicFeedbackWorkflowState)}
                          disabled={brainState === "running" || feedbackState === "saving"}
                        >
                          Clear
                        </button>
                        <button
                          className="rp-primary-button rp-button-inline"
                          onClick={() => void requestLogicFeedbackUnderstanding()}
                          disabled={brainState === "running" || feedbackState === "saving" || !logicFeedbackWorkflow.comment.trim()}
                        >
                          {brainState === "running" ? "Reviewing..." : "Review Logic Rule"}
                        </button>
                      </div>
                    </div>
                    <textarea
                      className="rp-refine-textarea"
                      value={logicFeedbackWorkflow.comment}
                      onChange={(event) =>
                        setLogicFeedbackWorkflow((current) => ({
                          ...current,
                          comment: event.target.value,
                        }))
                      }
                      placeholder="Example: for Section 01, include the number of measured roof plates and the readings-per-plate coverage whenever those captured metrics are available."
                    />
                    {logicFeedbackWorkflow.understanding ? (
                      <div className="rp-refine-understanding">
                        <strong>Codex Logic Restatement</strong>
                        <p>{logicFeedbackWorkflow.understanding}</p>
                        {logicFeedbackWorkflow.warnings.length > 0 ? (
                          <div className="rp-refine-meta">
                            <strong>Warnings</strong>
                            <ul className="rp-reference-list">
                              {logicFeedbackWorkflow.warnings.map((warning) => (
                                <li key={warning}>{warning}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {logicFeedbackWorkflow.evidenceNotes.length > 0 ? (
                          <div className="rp-refine-meta">
                            <strong>Grounding summary</strong>
                            <ul className="rp-reference-list">
                              {logicFeedbackWorkflow.evidenceNotes.map((note) => (
                                <li key={note}>{note}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        <div className="rp-refine-confirm-row">
                          <button
                            className="rp-ghost-button"
                            onClick={() =>
                              setLogicFeedbackWorkflow((current) => ({
                                ...current,
                                understanding: "",
                                warnings: [],
                                evidenceNotes: [],
                                lastReviewedComment: "",
                              }))
                            }
                            disabled={brainState === "running" || feedbackState === "saving"}
                          >
                            Revise Logic Note
                          </button>
                          <button
                            className="rp-primary-button rp-button-inline"
                            onClick={() => void saveLogicFeedback()}
                            disabled={
                              brainState === "running" ||
                              feedbackState === "saving" ||
                              !logicFeedbackWorkflow.understanding.trim() ||
                              logicFeedbackWorkflow.lastReviewedComment.trim() !== logicFeedbackWorkflow.comment.trim()
                            }
                          >
                            {feedbackState === "saving" ? "Saving..." : "Save Permanent Logic"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {refineWorkflow.open ? (
                  <div className="rp-refine-panel">
                    <div className="rp-refine-panel-head">
                      <div>
                        <div className="rp-card-title">Refine with Codex</div>
                        <p className="rp-refine-note">
                          Describe how this section should change. Codex will first explain its understanding and any pushback.
                        </p>
                      </div>
                      <div className="rp-refine-panel-actions">
                        <button className="rp-ghost-button" onClick={() => setRefineWorkflow(initialRefineWorkflowState)} disabled={brainState === "running"}>
                          Clear
                        </button>
                        <button
                          className="rp-primary-button rp-button-inline"
                          onClick={() => void requestRefineUnderstanding()}
                          disabled={brainState === "running" || !refineWorkflow.comment.trim()}
                        >
                          {brainState === "running" ? "Reviewing..." : "Review Refinement"}
                        </button>
                      </div>
                    </div>
                    <textarea
                      className="rp-refine-textarea"
                      value={refineWorkflow.comment}
                      onChange={(event) =>
                        setRefineWorkflow((current) => ({
                          ...current,
                          comment: event.target.value,
                        }))
                      }
                      placeholder="Example: keep the same facts, but convert this section into a concise bullet list and use the sample report tone."
                    />
                    {refineWorkflow.understanding ? (
                      <div className="rp-refine-understanding">
                        <strong>Codex Understanding</strong>
                        <p>{refineWorkflow.understanding}</p>
                        {refineWorkflow.warnings.length > 0 ? (
                          <div className="rp-refine-meta">
                            <strong>Warnings</strong>
                            <ul className="rp-reference-list">
                              {refineWorkflow.warnings.map((warning) => (
                                <li key={warning}>{warning}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {refineWorkflow.evidenceNotes.length > 0 ? (
                          <div className="rp-refine-meta">
                            <strong>Grounding summary</strong>
                            <ul className="rp-reference-list">
                              {refineWorkflow.evidenceNotes.map((note) => (
                                <li key={note}>{note}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        <div className="rp-refine-confirm-row">
                          <button
                            className="rp-ghost-button"
                            onClick={() =>
                              setRefineWorkflow((current) => ({
                                ...current,
                                understanding: "",
                                warnings: [],
                                evidenceNotes: [],
                                lastReviewedComment: "",
                              }))
                            }
                            disabled={brainState === "running"}
                          >
                            Revise Note
                          </button>
                          <button
                            className="rp-primary-button rp-button-inline"
                            onClick={() => void applyConfirmedRefinement()}
                            disabled={
                              brainState === "running" ||
                              !refineWorkflow.understanding.trim() ||
                              refineWorkflow.lastReviewedComment.trim() !== refineWorkflow.comment.trim()
                            }
                          >
                            {brainState === "running" ? "Applying..." : "Confirm and Apply"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="rp-editor-toolbar">
                  {editorAiActions.map((action) => (
                    <button key={action.id} className="rp-ghost-button" onClick={() => void runAiAction(action)} disabled={brainState === "running" || !hasSectionDraft}>
                      {action.label}
                    </button>
                  ))}
                </div>
                <p className="rp-editor-note">
                  {hasSectionDraft
                    ? "You can edit directly in the box, or use the actions above to reshape the current section draft."
                    : "No AI draft exists yet for this section. Generate first, or type your own draft manually in the box."}
                </p>
                <textarea
                  className="rp-editor"
                  value={selectedSection.draft}
                  onChange={(event) => updateSectionDraft(event.target.value)}
                  placeholder={emptyDraftPlaceholder}
                />
              </div>
              <SectionReferencesPanel groups={selectedSectionReferences} />
            </div>
          ) : null}

          {workspacePhase === "edit" && activeMode === "checklist" ? (
            <div className="rp-checklist-grid">
              <div className="rp-work-card">
                <div className="rp-card-title">Interactive Checklist</div>
                <div className="rp-checklist-list">
                  {checklistItems.map((item) => (
                    <div key={item.id} className="rp-checklist-item">
                      <div className="rp-checklist-copy">
                        <strong>{item.label}</strong>
                        <span>{item.reference}</span>
                      </div>
                      <div className="rp-checklist-controls">
                        <select
                          value={item.answer}
                          onChange={(event) =>
                            setChecklistItems((current) =>
                              current.map((entry) =>
                                entry.id === item.id
                                  ? {
                                      ...entry,
                                      answer: event.target.value as ChecklistItem["answer"],
                                    }
                                  : entry,
                              ),
                            )
                          }
                        >
                          <option value="">Select</option>
                          <option value="pass">Pass</option>
                          <option value="needs review">Needs review</option>
                          <option value="not examined">Not examined</option>
                        </select>
                        <textarea
                          value={item.note}
                          placeholder="Add a short note"
                          onChange={(event) =>
                            setChecklistItems((current) =>
                              current.map((entry) =>
                                entry.id === item.id
                                  ? {
                                      ...entry,
                                      note: event.target.value,
                                    }
                                  : entry,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <SectionReferencesPanel groups={selectedSectionReferences} />
            </div>
          ) : null}

          {workspacePhase === "edit" && activeMode === "layout" ? (
            <div className="rp-layout-stack">
              <div className="rp-work-card">
                <div className="rp-card-title">Interactive Layout Workspace</div>
                <LayoutCanvas scene={selectedSection.layoutScene ?? "shell"} markers={layoutMarkers} />
              </div>
              <SectionReferencesPanel groups={selectedSectionReferences} />
            </div>
          ) : null}
        </section>
      </main>
      <div className="rp-resize-handle rp-resize-handle-right" onPointerDown={startResize("right")} />

      <aside className="rp-ai-rail">
        <div className="rp-panel-head">
          <div className="rp-inline-eyebrow">AI Rail</div>
          {workspacePhase === "plan" ? (
            <>
              <h3>Report Planning</h3>
              <p>AI does not draft yet in this step. First confirm which sections belong in the report, then section-by-section drafting starts on the next page.</p>
            </>
          ) : (
            <>
              <h3>
                {selectedSection.templateSection} · {selectedSection.title}
              </h3>
              <p>{selectedSection.aiPlaybook.objective} Codex works on this section only.</p>
            </>
          )}
        </div>

        {workspacePhase === "plan" ? (
          <div className="rp-ai-brief">
            <div className="rp-ai-brief-block">
              <strong>Plan guard rails</strong>
              <ul className="rp-reference-list">
                <li>Keep core narrative sections unless the approved template itself changes.</li>
                <li>Leave floor or MFL sections excluded unless you intentionally want visible placeholders.</li>
                <li>Add custom sections only for real reviewer or client needs, not to hide missing data.</li>
              </ul>
            </div>
            {selectedPlanEntry ? (
              <div className="rp-ai-brief-block">
                <strong>Current focus</strong>
                <ul className="rp-reference-list">
                  <li>{selectedPlanEntry.title}</li>
                  <li>{selectedPlanEntry.reason}</li>
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className="rp-ai-brief">
              <div className="rp-ai-brief-block">
                <strong>Scope</strong>
                <ul className="rp-reference-list">
                  <li>Codex can draft or refine only the active section.</li>
                  <li>The rest of the report stays unchanged until you move to another section.</li>
                </ul>
              </div>
              <div className="rp-ai-brief-block">
                <strong>Allowed sources</strong>
                <ul className="rp-reference-list">
                  {selectedSection.aiPlaybook.allowedSources.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rp-ai-brief-block">
                <strong>Guard rails</strong>
                <ul className="rp-reference-list">
                  {selectedSection.aiPlaybook.blockers.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rp-ai-actions">
              {selectedSection.aiPlaybook.suggestedActions.map((action) => (
                <button
                  key={action.id}
                  className="rp-ghost-button"
                  onClick={() => void runAiAction(action)}
                  disabled={brainState === "running" || (action.effect !== "draft" && !hasSectionDraft)}
                >
                  {action.label}
                </button>
              ))}
            </div>

            {brainState === "running" ? (
              <div className="rp-ai-brief rp-progress-card">
                <div className="rp-ai-brief-block">
                  <strong>Working Progress</strong>
                  <div className="rp-progress-list">
                    {BRAIN_PROGRESS_STEPS.map((step, index) => (
                      <div
                        key={step}
                        className={`rp-progress-step ${
                          index < brainProgressTick ? "is-complete" : index === brainProgressTick ? "is-active" : ""
                        }`}
                      >
                        <span className="rp-progress-dot" />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}

        <div className="rp-message-stack">
          {messages.map((message) => (
            <div key={message.id} className={`rp-message ${message.role === "assistant" ? "is-assistant" : "is-user"}`}>
              {message.text}
            </div>
          ))}
        </div>

        {workspacePhase === "edit" ? (
          <div className="rp-composer">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={
                hasSectionDraft
                  ? `Ask AI to refine Section ${selectedSection.sequence} "${selectedSection.title}"...`
                  : `Generate Section ${selectedSection.sequence} first, then refine it here.`
              }
              disabled={!hasSectionDraft || brainState === "running"}
            />
            <button className="rp-primary-button rp-button-inline" onClick={sendPrompt} disabled={!hasSectionDraft || brainState === "running"}>
              {brainState === "running" ? "Running..." : "Send"}
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function SectionReferencesPanel({ groups }: { groups: SectionReferenceGroup[] }) {
  return (
    <div className="rp-work-card rp-reference-card">
      <div className="rp-card-title">Section References</div>
      <div className="rp-reference-stack">
        {groups
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <div key={group.title} className="rp-reference-group">
              <strong>{group.title}</strong>
              <ul className="rp-reference-list">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </div>
  );
}
