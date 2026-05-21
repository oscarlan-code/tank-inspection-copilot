import { useMemo, useState } from "react";
import LayoutCanvas from "./LayoutCanvas";
import "./reportPlatform.css";
import {
  createDefaultWorkspace,
  createWorkspaceFromPackage,
  parseCanonicalPackageFile,
  type ChecklistItem,
  type ReportWorkspace,
  type SectionMode,
} from "./workspace";

type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

const initialMessages: Message[] = [
  {
    id: "assistant-1",
    role: "assistant",
    text: "Report workspace loaded. Select a section on the left, refine it in the center, and use this rail to improve wording, formatting, or evidence alignment.",
  },
];

const initialWorkspace = createDefaultWorkspace();

export default function ReportPlatformShell() {
  const [workspace, setWorkspace] = useState<ReportWorkspace>(initialWorkspace);
  const [selectedSectionId, setSelectedSectionId] = useState(initialWorkspace.sections[0].id);
  const [activeMode, setActiveMode] = useState<SectionMode>("preview");
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(initialWorkspace.checklist);
  const [confirmedSections, setConfirmedSections] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [prompt, setPrompt] = useState("");
  const [uploadState, setUploadState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [uploadMessage, setUploadMessage] = useState(
    "Using the seeded demo package until you load a canonical JSON export from the Android app.",
  );

  const selectedSection = useMemo(
    () => workspace.sections.find((section) => section.id === selectedSectionId) ?? workspace.sections[0],
    [workspace.sections, selectedSectionId],
  );

  const completionCount = Object.values(confirmedSections).filter(Boolean).length;

  const layoutMarkers = selectedSection.layoutScene === "roof" ? workspace.layoutScenes.roof : workspace.layoutScenes.shell;

  const checklistCompletion = checklistItems.filter((item) => item.answer !== "").length;

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
    setMessages((current) => [
      ...current,
      {
        id: `assistant-confirm-${Date.now()}`,
        role: "assistant",
        text: `Section "${selectedSection.title}" marked ready. You can move to the next section or reopen it later for more edits.`,
      },
    ]);
  };

  const goToNextSection = () => {
    const index = workspace.sections.findIndex((section) => section.id === selectedSection.id);
    const next = workspace.sections[index + 1];
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
      setSelectedSectionId(nextWorkspace.sections[0].id);
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
        `Loaded ${file.name}. The workspace is now hydrated from the uploaded package and scoped to inspection job ${nextWorkspace.workspaceMeta.inspectionJobId}.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown upload error";
      setUploadState("error");
      setUploadMessage(message);
      appendAssistant(`Upload blocked: ${message}`);
    }
  };

  const runAiAction = (action: "refine" | "tighten" | "format" | "missing") => {
    if (action === "refine") {
      updateSectionDraft(
        `${selectedSection.draft}\n\nRefinement note: tighten the section so the conclusion clearly follows the linked evidence, while keeping the wording neutral and report-ready.`,
      );
      appendAssistant(
        `I refined the active "${selectedSection.title}" section by making the wording more report-like and more closely tied to the selected evidence.`,
      );
      return;
    }
    if (action === "tighten") {
      updateSectionDraft(selectedSection.draft.replace(/\s{2,}/g, " ").trim());
      appendAssistant(`I tightened the wording in "${selectedSection.title}" and removed extra spacing noise.`);
      return;
    }
    if (action === "format") {
      updateSectionDraft(`Summary:\n${selectedSection.draft}\n\nEvidence focus:\n- Link to measurements\n- Link to findings\n- Link to calculations`);
      appendAssistant(`I reformatted "${selectedSection.title}" into a more review-friendly structure for the current section.`);
      return;
    }
    appendAssistant(
      `For "${selectedSection.title}", the main remaining inputs are: ${selectedSection.facts.slice(0, 2).join("; ")}. Confirm this section only after those points are reviewed.`,
    );
  };

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
    appendAssistant(
      `Working on "${selectedSection.title}". I will keep the edits scoped to this section and preserve the linked evidence, checklist state, and layout context.`,
    );
  };

  return (
    <div className="rp-shell">
      <aside className="rp-explorer">
        <div className="rp-panel-head">
          <div className="rp-inline-eyebrow">Explorer</div>
          <h1>Report Platform</h1>
          <p>Canonical package, template sections, and evidence navigation.</p>
        </div>

        <div className="rp-upload-card">
          <div className="rp-card-title">Canonical Package Intake</div>
          <div className="rp-upload-copy">
            <strong className="rp-upload-title">Load Android export JSON</strong>
            <p>Use a canonical `inspection-package.json` export now. ZIP intake can come in the next platform pass.</p>
          </div>
          <label className="rp-primary-button rp-button-inline rp-upload-trigger">
            {uploadState === "loading" ? "Loading..." : "Upload Canonical JSON"}
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
          <div className={`rp-upload-state is-${uploadState}`}>{uploadMessage}</div>
        </div>

        <div className="rp-explorer-group">
          <div className="rp-group-title">Package</div>
          <ul className="rp-tree-list">
            {workspace.packageAssets.map((asset) => (
              <li key={asset}>{asset}</li>
            ))}
          </ul>
        </div>

        <div className="rp-explorer-group">
          <div className="rp-group-title">Workspace</div>
          <ul className="rp-tree-list">
            <li>Tenant: {workspace.workspaceMeta.tenantId}</li>
            <li>Client: {workspace.workspaceMeta.clientAccountId}</li>
            <li>Site: {workspace.workspaceMeta.siteId}</li>
            <li>Tank: {workspace.workspaceMeta.tankId}</li>
            <li>Job: {workspace.workspaceMeta.inspectionJobId}</li>
          </ul>
        </div>

        <div className="rp-explorer-group">
          <div className="rp-group-title">Report Template</div>
          <div className="rp-section-list">
            {workspace.sections.map((section) => {
              const selected = section.id === selectedSection.id;
              return (
                <button
                  key={section.id}
                  className={`rp-section-button ${selected ? "is-selected" : ""}`}
                  onClick={() => {
                    setSelectedSectionId(section.id);
                    setActiveMode(section.modes[0]);
                  }}
                >
                  <span className="rp-section-button-title">{section.title}</span>
                  <span className="rp-status-pill">{section.status}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rp-explorer-group">
          <div className="rp-group-title">Reference Library</div>
          <ul className="rp-tree-list">
            {workspace.standardsLibrary.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="rp-progress-card rp-progress-card-single">
          <div>
            <span className="rp-metric-label">Validation</span>
            <strong>{workspace.workspaceMeta.validation.valid ? "Pass" : "Blocked"}</strong>
            <p className="rp-inline-note">
              {workspace.workspaceMeta.validation.errors[0] ??
                workspace.workspaceMeta.validation.warnings[0] ??
                "No canonical validation issues."}
            </p>
          </div>
        </div>

        <div className="rp-progress-card">
          <div>
            <span className="rp-metric-label">Confirmed sections</span>
            <strong>{completionCount}</strong>
          </div>
          <div>
            <span className="rp-metric-label">Checklist answered</span>
            <strong>{checklistCompletion}</strong>
          </div>
        </div>
      </aside>

      <main className="rp-center">
        <header className="rp-center-header">
          <div>
            <div className="rp-inline-eyebrow">{selectedSection.group}</div>
            <h2>{selectedSection.title}</h2>
            <p>{selectedSection.summary}</p>
          </div>
          <div className="rp-header-actions">
            <span className="rp-status-pill">{selectedSection.status}</span>
            <button className="rp-ghost-button" onClick={confirmCurrentSection}>
              {confirmedSections[selectedSection.id] ? "Confirmed" : "Confirm Section"}
            </button>
            <button className="rp-primary-button rp-button-inline" onClick={goToNextSection}>
              Next Section
            </button>
          </div>
        </header>

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

        <section className="rp-center-surface">
          {activeMode === "preview" ? (
            <div className="rp-preview-grid">
              <div className="rp-work-card">
                <div className="rp-card-title">Editable Section Workspace</div>
                {workspace.workspaceMeta.validation.warnings.length > 0 ? (
                  <div className="rp-warning-box">
                    <strong>Carry-over package warnings</strong>
                    <ul>
                      {workspace.workspaceMeta.validation.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <textarea
                  className="rp-editor"
                  value={selectedSection.draft}
                  onChange={(event) => updateSectionDraft(event.target.value)}
                />
              </div>
              <div className="rp-work-card">
                <div className="rp-card-title">Section Evidence</div>
                <ul className="rp-fact-list">
                  {selectedSection.facts.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {activeMode === "checklist" ? (
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
          ) : null}

          {activeMode === "layout" ? (
            <div className="rp-work-card">
              <div className="rp-card-title">Interactive Layout Workspace</div>
              <LayoutCanvas scene={selectedSection.layoutScene ?? "shell"} markers={layoutMarkers} />
            </div>
          ) : null}
        </section>
      </main>

      <aside className="rp-ai-rail">
        <div className="rp-panel-head">
          <div className="rp-inline-eyebrow">AI Rail</div>
          <h3>{selectedSection.title}</h3>
          <p>
            The assistant is scoped to the current section and should refine only this section unless asked otherwise.
          </p>
        </div>

        <div className="rp-ai-actions">
          <button className="rp-ghost-button" onClick={() => runAiAction("refine")}>
            Refine wording
          </button>
          <button className="rp-ghost-button" onClick={() => runAiAction("tighten")}>
            Tighten content
          </button>
          <button className="rp-ghost-button" onClick={() => runAiAction("format")}>
            Reformat section
          </button>
          <button className="rp-ghost-button" onClick={() => runAiAction("missing")}>
            Show missing inputs
          </button>
        </div>

        <div className="rp-message-stack">
          {messages.map((message) => (
            <div key={message.id} className={`rp-message ${message.role === "assistant" ? "is-assistant" : "is-user"}`}>
              {message.text}
            </div>
          ))}
        </div>

        <div className="rp-composer">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={`Ask AI to improve "${selectedSection.title}"...`}
          />
          <button className="rp-primary-button rp-button-inline" onClick={sendPrompt}>
            Send
          </button>
        </div>
      </aside>
    </div>
  );
}
