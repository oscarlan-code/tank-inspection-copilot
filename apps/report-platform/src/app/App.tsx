import { useEffect, useMemo, useState } from "react";
import { LayoutMapEditor } from "../components/LayoutMapEditor";
import { RichTextSectionEditor } from "../components/RichTextSectionEditor";
import {
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

function deriveStatus(section: ReportSection): SectionStatus {
  const hasMissing = section.missingFields.some((field) => !field.value.trim());

  if (section.approved) return "approved";
  if (section.reviewRequired) return "review required";
  if (hasMissing) return "missing info";
  if (section.edited) return "edited";
  if (section.generated) return "generated";
  return "not started";
}

function cloneReport(report: WorkspaceReport): WorkspaceReport {
  return JSON.parse(JSON.stringify(report)) as WorkspaceReport;
}

function buildMapPatchSummary(layoutMap: LayoutMapData | undefined) {
  if (!layoutMap) return "No layout sketch attached to this section.";
  return `${layoutMap.overrideCount} override${layoutMap.overrideCount === 1 ? "" : "s"} across ${layoutMap.markers.length} markers and ${layoutMap.plates.length} editable plates.`;
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

function App() {
  const [report, setReport] = useState<WorkspaceReport | null>(null);
  const [baselineReport, setBaselineReport] = useState<WorkspaceReport | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [editorMode, setEditorMode] = useState<EditorMode>("preview");
  const [chatInput, setChatInput] = useState("");
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>({});
  const [flashMessage, setFlashMessage] = useState("Loading Android V2 Product export fixture...");
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [activePlateId, setActivePlateId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<ApiAiStatus | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChatBusy, setIsChatBusy] = useState(false);

  useEffect(() => {
    let isActive = true;

    loadWorkspaceBootstrap()
      .then((bootstrap) => {
        if (!isActive) return;

        const nextReport = cloneReport(bootstrap.report);
        setReport(nextReport);
        setBaselineReport(cloneReport(bootstrap.baselineReport));
        const defaultSection =
          nextReport.sections.find((section) => section.id === "scope-of-inspection")?.id ??
          nextReport.sections[0]?.id ??
          "";
        const defaultLayoutMap = nextReport.sections.find((section) => section.id === defaultSection)?.layoutMap;

        setSelectedSectionId(defaultSection);
        setChats(buildInitialChats(nextReport));
        setFlashMessage(bootstrap.flashMessage);
        setActiveMarkerId(defaultLayoutMap?.markers[0]?.id ?? null);
        setActivePlateId(defaultLayoutMap?.plates[0]?.id ?? null);
        setAiStatus(bootstrap.aiStatus);
      })
      .catch((error) => {
        if (!isActive) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load the workspace.");
      });

    return () => {
      isActive = false;
    };
  }, []);

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
        const status = deriveStatus(section);
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
  }, [report]);

  const currentChat = selectedSection ? chats[selectedSection.id] ?? [] : [];

  if (loadError) {
    return (
      <div className="workspace-app">
        <div className="flash-banner flash-banner-error">
          Report workspace failed to load. {loadError}
        </div>
      </div>
    );
  }

  if (!report || !baselineReport || !selectedSection) {
    return (
      <div className="workspace-app">
        <div className="flash-banner">Loading report workspace from the Android import contract...</div>
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

  const handleApprove = async () => {
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
      const payload = await generateSectionApi(report, selectedSection.id);
      const hydrated = hydrateWorkspaceFromApiState(payload, getHydrationApiBaseUrl(report));
      const nextSection = hydrated.report.sections.find((section) => section.id === selectedSection.id);

      setReport(cloneReport(hydrated.report));
      setBaselineReport(cloneReport(hydrated.baselineReport));
      if (payload.aiStatus) {
        setAiStatus(payload.aiStatus);
      }
      setSelectedSectionId(selectedSection.id);
      setActiveMarkerId(nextSection?.layoutMap?.markers[0]?.id ?? null);
      setActivePlateId(nextSection?.layoutMap?.plates[0]?.id ?? null);
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

      setFlashMessage(
        `Generated ${selectedSection.title} via ${generationRun?.templateKey ?? "the backend orchestration engine"}.` +
          workerSuffix +
          warningSuffix +
          blockerSuffix +
          fallbackSuffix,
      );
    } catch (error) {
      setFlashMessage(`Unable to generate ${selectedSection.title}: ${formatErrorMessage(error)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
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
    setActiveMarkerId(normalized.markers[0]?.id ?? null);
    setActivePlateId(normalized.plates[0]?.id ?? null);

    try {
      await saveLayoutOverrideApi(report, selectedSection.id, normalized);
      setFlashMessage(`Reset draft map overrides for ${selectedSection.title} and synced the baseline to the backend.`);
    } catch (error) {
      setFlashMessage(
        `Reset map overrides locally for ${selectedSection.title}, but backend sync failed: ${formatErrorMessage(error)}`,
      );
    }
  };

  const handleChatSend = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    setChats((current) => ({
      ...current,
      [selectedSection.id]: [
        ...(current[selectedSection.id] ?? []),
        { id: `u-${Date.now()}`, role: "user", content: trimmed },
      ],
    }));
    setChatInput("");
    setIsChatBusy(true);

    try {
      const reply = await sendSectionChatApi(report, selectedSection.id, trimmed);
      setChats((current) => ({
        ...current,
        [selectedSection.id]: [
          ...(current[selectedSection.id] ?? []),
          {
            id: reply.replyId,
            role: "assistant",
            content: reply.content,
            actions: reply.actions ?? [],
          },
        ],
      }));

      setFlashMessage(
        reply.usedLiveModel
          ? `Codex CLI assistant replied for ${selectedSection.title}${reply.modelId ? ` using ${reply.modelId}` : ""}.`
          : `Section assistant used fallback mode for ${selectedSection.title}. ${reply.fallbackReason ?? ""}`.trim(),
      );
    } catch (error) {
      setFlashMessage(`Unable to send AI chat prompt for ${selectedSection.title}: ${formatErrorMessage(error)}`);
    } finally {
      setIsChatBusy(false);
    }
  };

  const handleApplyAssistantAction = async (action: AssistantAction) => {
    if (action.type === "replace_section_content" || action.type === "apply_text_style") {
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
        setFlashMessage(`${action.label} applied through the Codex chat controller.`);
      } catch (error) {
        setFlashMessage(`${action.label} applied locally, but draft persistence failed: ${formatErrorMessage(error)}`);
      }

      return;
    }

    if (!safeLayoutMap) {
      setFlashMessage("This section does not expose a layout map for assistant-controlled actions.");
      return;
    }

    if (action.type === "move_marker" && action.markerId) {
      const marker = safeLayoutMap.markers.find((item) => item.id === action.markerId);
      if (!marker) {
        setFlashMessage(`Assistant action skipped because marker ${action.markerId} is not available in this section.`);
        return;
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
      return;
    }

    if (action.type === "resize_plate" && action.plateId) {
      const plate = safeLayoutMap.plates.find((item) => item.id === action.plateId);
      if (!plate) {
        setFlashMessage(`Assistant action skipped because plate ${action.plateId} is not available in this section.`);
        return;
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
    }
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
          <span className="meta-label">Tenant / Workspace</span>
          <strong>{report.importSummary.tenantName}</strong>
          <p>{report.importSummary.workspaceName}</p>
        </div>
        <div className="import-card">
          <span className="meta-label">Inspection Export</span>
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
          <span className="meta-label">AI Engine</span>
          <strong>{aiStatus?.statusLabel ?? "Checking worker status"}</strong>
          <p>{aiStatus?.detail ?? "Preparing report-generation worker status."}</p>
        </div>
        <div className="import-card">
          <span className="meta-label">Wired Tools</span>
          <strong>Codex CLI · TipTap · Konva</strong>
          <p>Chat can generate sections, apply formatting, and trigger controlled layout-map actions.</p>
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
              const status = deriveStatus(section);
              const isActive = section.id === selectedSection.id;
              return (
                <button
                  className={`section-item ${isActive ? "section-item-active" : ""}`}
                  key={section.id}
                  onClick={() => {
                    setSelectedSectionId(section.id);
                    setEditorMode("preview");
                    setActiveMarkerId(section.layoutMap?.markers[0]?.id ?? null);
                    setActivePlateId(section.layoutMap?.plates[0]?.id ?? null);
                  }}
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
              <button className="toolbar-button" disabled={isGenerating} onClick={handleGenerate} type="button">
                {isGenerating ? "Generating…" : "Generate"}
              </button>
              <button className="toolbar-button" onClick={handleSaveDraft} type="button">
                Save Draft
              </button>
              <button className="toolbar-button toolbar-button-primary" onClick={handleApprove} type="button">
                Approve
              </button>
            </div>
          </div>

          <div className="workspace-split">
            <section className="panel-subsection text-pane">
              <div className="subsection-header">
                <div>
                  <h3>Generated Content</h3>
                  <p>{selectedSection.templateExpectation}</p>
                  <p className="source-note">{selectedSection.sourceSummary}</p>
                </div>
                <div className="mode-toggle">
                  <button
                    className={editorMode === "preview" ? "mode-active" : ""}
                    onClick={() => setEditorMode("preview")}
                    type="button"
                  >
                    Preview
                  </button>
                  <button
                    className={editorMode === "edit" ? "mode-active" : ""}
                    onClick={() => setEditorMode("edit")}
                    type="button"
                  >
                    Edit
                  </button>
                </div>
              </div>

              {editorMode === "preview" ? (
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
                  <h3>Layout / Supporting Visuals</h3>
                  <p>
                    {safeLayoutMap
                      ? buildMapPatchSummary(safeLayoutMap)
                      : "This section does not require a layout drawing in the first UI slice."}
                  </p>
                </div>
                {safeLayoutMap ? (
                  <div className="toolbar">
                    <button className="toolbar-button" onClick={selectNextMarker} type="button">
                      Select Next Marker
                    </button>
                    <button className="toolbar-button" onClick={resetMapOverrides} type="button">
                      Reset Overrides
                    </button>
                  </div>
                ) : null}
              </div>

              {safeLayoutMap ? (
                <LayoutMapEditor
                  activeMarkerId={activeMarkerId}
                  activePlateId={activePlateId}
                  layoutMap={safeLayoutMap}
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

        <aside className="panel rightbar">
          <div className="panel-subsection chat-pane">
            <div className="subsection-header">
              <div>
                <p className="eyebrow">AI Chat</p>
                <h3>Section-Aware Assistant</h3>
                <p className="source-note">{aiStatus?.statusLabel ?? "Checking worker status..."}</p>
              </div>
            </div>

            <div className="chat-thread">
              {currentChat.map((message) => (
                <div className={`chat-bubble chat-${message.role}`} key={message.id}>
                  <span className="chat-role">{message.role}</span>
                  <p>{message.content}</p>
                  {message.actions && message.actions.length > 0 ? (
                    <div className="chat-action-list">
                      {message.actions.map((action) => (
                        <button
                          className="toolbar-button chat-action-button"
                          key={action.id}
                          onClick={() => handleApplyAssistantAction(action)}
                          type="button"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="chat-composer">
              <textarea
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Ask Codex to refine the section, change formatting, or adjust the layout map."
                value={chatInput}
              />
              <button
                className="toolbar-button toolbar-button-primary"
                disabled={isChatBusy}
                onClick={handleChatSend}
                type="button"
              >
                {isChatBusy ? "Thinking…" : "Send"}
              </button>
            </div>
          </div>

          <div className="panel-subsection missing-pane">
            <div className="subsection-header">
              <div>
                <p className="eyebrow">Detected Gaps</p>
                <h3>Missing Content Assistant</h3>
              </div>
              <span className="count-pill">
                {selectedSection.missingFields.filter((field) => !field.value.trim()).length}
              </span>
            </div>

            <div className="missing-field-list">
              {selectedSection.missingFields.map((field) => (
                <MissingFieldEditor
                  field={field}
                  key={field.id}
                  onChange={(value) => handleFieldChange(field.id, value)}
                />
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function MissingFieldEditor({
  field,
  onChange,
}: {
  field: MissingField;
  onChange: (value: string) => void;
}) {
  const isMissing = !field.value.trim();

  return (
    <div className={`missing-field-card ${isMissing ? "missing-field-card-open" : "missing-field-card-complete"}`}>
      <div className="missing-field-header">
        <div>
          <h4>{field.label}</h4>
          <p>{field.reason}</p>
        </div>
        <span className={`status-badge ${isMissing ? "status-missing-info" : "status-approved"}`}>
          {isMissing ? "required" : "captured"}
        </span>
      </div>

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

      <dl className="field-meta">
        <div>
          <dt>Source</dt>
          <dd>{field.source}</dd>
        </div>
        <div>
          <dt>Suggestion</dt>
          <dd>{field.suggestion ?? "No suggestion yet."}</dd>
        </div>
      </dl>
    </div>
  );
}

export default App;
