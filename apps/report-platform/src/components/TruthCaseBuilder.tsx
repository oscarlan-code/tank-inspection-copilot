import { useEffect, useMemo, useState } from "react";
import { loadKbSourcePreview } from "../lib/kbReviewApi";
import {
  approveTruthCase,
  createTruthCase,
  loadTruthCase,
  loadTruthCaseBuilder,
  proposeTruthCaseFacts,
  reviewTruthFact,
  type AnswerabilityClass,
  type TruthCaseBuilderState,
  type TruthCaseDetail,
  type TruthCaseSource,
  type TruthFact,
  type TruthFactReviewInput,
  type TruthFactReviewStatus,
} from "../lib/truthCaseApi";
import { SourcePreview } from "./KnowledgeBaseReview";

type FactFilter = "all" | TruthFactReviewStatus;

const ANSWERABILITY_OPTIONS: Array<{ value: AnswerabilityClass; label: string }> = [
  { value: "app_observable", label: "App observable" },
  { value: "voice_observable", label: "Voice / note observable" },
  { value: "report_side_input", label: "Report-side input" },
  { value: "deterministic_derived", label: "Deterministically derived" },
  { value: "precedent_template", label: "Precedent template only" },
  { value: "standards_guidance", label: "Standards guidance" },
  { value: "engineering_judgment", label: "Engineering judgment" },
  { value: "gold_only_unobservable", label: "Hidden gold only" },
];

const EVIDENCE_CLASSES = [
  "structured_field",
  "measurement",
  "finding",
  "voice_or_note",
  "photo_or_attachment",
  "layout_geometry",
  "report_narrative",
  "standard_rule",
];

export function TruthCaseBuilder({
  initialDocumentId = "",
  onApproved,
}: {
  initialDocumentId?: string;
  onApproved?: (truthCaseId: string) => void;
}) {
  const [state, setState] = useState<TruthCaseBuilderState | null>(null);
  const [detail, setDetail] = useState<TruthCaseDetail | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState(initialDocumentId);
  const [selectedFactId, setSelectedFactId] = useState("");
  const [evidenceDate, setEvidenceDate] = useState("");
  const [filter, setFilter] = useState<FactFilter>("all");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<{
    fileName: string;
    mediaType: string;
    readUrl: string;
  } | null>(null);
  const [draft, setDraft] = useState<TruthFactReviewInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showAdvancedReview, setShowAdvancedReview] = useState(false);

  const selectedSource = state?.sources.find((source) => source.documentId === selectedDocumentId)
    ?? state?.sources[0]
    ?? null;
  const selectedFact = detail?.facts.find((fact) => fact.factId === selectedFactId)
    ?? detail?.facts[0]
    ?? null;
  const locked = detail?.truthCase.status === "case_approved";
  const visibleFacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (detail?.facts ?? []).filter((fact) => {
      const matchesStatus = filter === "all" || fact.reviewStatus === filter;
      const value = factText(fact);
      const matchesSearch = !query
        || `${fact.sectionKey} ${fact.factType} ${value}`.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [detail, filter, search]);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!selectedSource) return;
    setEvidenceDate(formatDateInput(selectedSource.evidenceAsOfCandidate));
    setPreview(null);
    void loadKbSourcePreview(selectedSource.documentId)
      .then((source) => setPreview(source))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load source preview."));
    if (selectedSource.truthCaseId) {
      void loadDetail(selectedSource.truthCaseId);
    } else {
      setDetail(null);
      setSelectedFactId("");
    }
  }, [selectedSource?.documentId]);

  useEffect(() => {
    if (!selectedFact) {
      setDraft(null);
      return;
    }
    setDraft(toDraft(selectedFact));
  }, [selectedFact?.factId, selectedFact?.updatedAtIso]);

  async function refresh(preferredDocumentId = selectedDocumentId || initialDocumentId) {
    setLoading(true);
    setError("");
    try {
      const next = await loadTruthCaseBuilder();
      setState(next);
      setSelectedDocumentId(
        next.sources.some((source) => source.documentId === preferredDocumentId)
          ? preferredDocumentId
          : next.sources[0]?.documentId ?? "",
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Truth Case Builder.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(truthCaseId: string, preferredFactId = selectedFactId) {
    setLoading(true);
    try {
      const next = await loadTruthCase(truthCaseId);
      applyDetail(next, preferredFactId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Truth Case.");
    } finally {
      setLoading(false);
    }
  }

  function applyDetail(next: TruthCaseDetail, preferredFactId = "") {
    setDetail(next);
    setSelectedFactId(
      next.facts.some((fact) => fact.factId === preferredFactId)
        ? preferredFactId
        : next.facts[0]?.factId ?? "",
    );
  }

  async function startTruthCase() {
    if (!selectedSource) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const created = await createTruthCase({
        documentId: selectedSource.documentId,
        evidenceAsOf: evidenceDate || undefined,
        benchmarkTrack: "operational_history",
      });
      const next = await proposeTruthCaseFacts(created.truthCase.truthCaseId);
      applyDetail(next);
      setShowAdvancedReview(false);
      await refresh(selectedSource.documentId);
      setMessage(`Automated Truth Case draft built with ${next.summary.total} source-linked fact proposal(s). Review only the items you want to correct, then approve the draft.`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to create Truth Case.");
    } finally {
      setBusy(false);
    }
  }

  async function proposeFacts() {
    if (!detail) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const next = await proposeTruthCaseFacts(detail.truthCase.truthCaseId);
      applyDetail(next);
      await refresh(selectedSource?.documentId);
      setMessage(`${next.summary.total} source-linked fact proposal(s) are ready for review.`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to propose truth facts.");
    } finally {
      setBusy(false);
    }
  }

  async function saveFact(reviewStatus: TruthFactReviewStatus) {
    if (!detail || !selectedFact || !draft) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const next = await reviewTruthFact(
        detail.truthCase.truthCaseId,
        selectedFact.factId,
        { ...draft, reviewStatus },
      );
      applyDetail(next, selectedFact.factId);
      setMessage(reviewStatus === "approved"
        ? "Fact and answerability label approved."
        : reviewStatus === "rejected"
          ? "Proposal rejected; it will not enter the Truth Graph."
          : "Fact review saved.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to save fact review.");
    } finally {
      setBusy(false);
    }
  }

  async function approveCase() {
    if (!detail) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const next = await approveTruthCase(detail.truthCase.truthCaseId);
      applyDetail(next, selectedFactId);
      await refresh(selectedSource?.documentId);
      setMessage("Truth Case approved. Its versioned Truth Graph is stored and locked.");
      onApproved?.(next.truthCase.truthCaseId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to approve Truth Case.");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !state) {
    return <div className="truth-case-empty"><strong>Loading Truth Case Builder</strong><span>Reading approved sources and review state from PostgreSQL.</span></div>;
  }

  return (
    <section className="truth-case-builder">
      <header className="truth-case-toolbar">
        <div>
          <p className="eyebrow">Stage 2 · Truth Case Builder</p>
          <h2>Review historical facts and answerability</h2>
          <p>The system builds the draft automatically. Review individual facts only when a correction is needed.</p>
        </div>
        <div className="truth-case-toolbar-controls">
          <label>Approved source
            <select
              onChange={(event) => setSelectedDocumentId(event.target.value)}
              value={selectedSource?.documentId ?? ""}
            >
              {(state?.sources ?? []).map((source) => (
                <option key={source.documentId} value={source.documentId}>{source.displayName}</option>
              ))}
            </select>
          </label>
          {!detail ? (
            <label>Evidence date override (optional)
              <input
                onChange={(event) => setEvidenceDate(event.target.value)}
                required
                type="date"
                value={evidenceDate}
              />
              <small className="truth-case-date-help">{evidenceDate ? "Detected from the approved source; change only if incorrect." : "The system will detect this from the approved source."}</small>
            </label>
          ) : null}
          {!detail ? (
            <button className="toolbar-button toolbar-button-primary" disabled={busy} onClick={() => void startTruthCase()} type="button">{busy ? "Building…" : "Build automated draft"}</button>
          ) : detail.summary.total === 0 && !locked ? (
            <button className="toolbar-button toolbar-button-primary" disabled={busy} onClick={() => void proposeFacts()} type="button">Extract proposals</button>
          ) : (
            <button
              className="toolbar-button toolbar-button-primary"
              disabled={busy || locked || detail.summary.total === 0}
              onClick={() => void approveCase()}
              type="button"
            >
              {locked ? "Truth Case approved" : "Approve automated draft"}
            </button>
          )}
        </div>
      </header>

      {error ? <div className="eval-live-feedback error">{error}</div> : null}
      {message ? <div className="eval-live-feedback success">{message}</div> : null}
      {state?.sources.length === 0 ? (
        <div className="truth-case-empty"><strong>No eligible approved sources</strong><span>Approve an ingested historical report in Knowledge Base Review first.</span></div>
      ) : null}

      {selectedSource ? (
        <div className="truth-case-summary-strip">
          <SummaryItem label="Split" value={humanize(selectedSource.datasetSplit)} />
          <SummaryItem label="Source chunks" value={String(selectedSource.chunkCount)} />
          <SummaryItem label="Proposed" value={String(detail?.summary.proposed ?? 0)} />
          <SummaryItem label="Approved" value={String(detail?.summary.approved ?? 0)} />
          <SummaryItem label="Rejected" value={String(detail?.summary.rejected ?? 0)} />
          <SummaryItem label="Status" value={detail ? humanize(detail.truthCase.status) : "Not started"} />
        </div>
      ) : null}

      <section className="truth-case-simple-card">
        {!detail ? (
          <><div><p className="eyebrow">Automated setup</p><h3>Build the source truth and mock-data foundation</h3><p>The system detects the report date, extracts source-linked facts, and prepares the draft automatically.</p></div><span className="truth-case-simple-state">Ready to build</span></>
        ) : locked ? (
          <><div><p className="eyebrow">Source truth locked</p><h3>Truth Case ready for mock data</h3><p>{detail.summary.approved} facts are protected. Continue to choose how much context and which capture style each mock dataset contains.</p></div><button className="toolbar-button toolbar-button-primary" onClick={() => onApproved?.(detail.truthCase.truthCaseId)} type="button">Choose mock data types</button></>
        ) : (
          <><div><p className="eyebrow">Automated draft ready</p><h3>{detail.summary.total} facts extracted from the approved source</h3><p>You do not need to inspect every item. Open the detailed review only to correct or reject something before approving the draft.</p></div><button className="toolbar-button" onClick={() => setShowAdvancedReview((current) => !current)} type="button">{showAdvancedReview ? "Hide detailed review" : "Review or correct facts"}</button></>
        )}
      </section>

      {showAdvancedReview ? <div className="truth-case-grid">
        <section className="truth-case-source-pane">
          <div className="truth-case-pane-heading"><span>Original reference</span><strong>{selectedSource?.displayName ?? "No source"}</strong></div>
          <SourcePreview
            focusedPage={selectedFact?.sourcePageNumber ?? null}
            pageNumbers={selectedFact?.sourcePageNumber ? [selectedFact.sourcePageNumber] : [1]}
            preview={preview}
            sourceSpans={factSourceSpans(selectedFact)}
          />
        </section>

        <section className="truth-case-facts-pane">
          <div className="truth-case-pane-heading"><span>Fact proposals</span><strong>{detail?.summary.total ?? 0} extracted</strong></div>
          <div className="truth-case-filters">
            <input onChange={(event) => setSearch(event.target.value)} placeholder="Search facts" type="search" value={search} />
            <select onChange={(event) => setFilter(event.target.value as FactFilter)} value={filter}>
              <option value="all">All statuses</option>
              <option value="machine_proposed">Proposed</option>
              <option value="human_reviewed">Reviewed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <nav className="truth-case-fact-list" aria-label="Truth fact proposals">
            {visibleFacts.map((fact) => (
              <button
                className={fact.factId === selectedFact?.factId ? "selected" : ""}
                key={fact.factId}
                onClick={() => setSelectedFactId(fact.factId)}
                type="button"
              >
                <span className={`truth-fact-status ${fact.reviewStatus}`}>{statusLabel(fact.reviewStatus)}</span>
                <strong>{humanize(fact.sectionKey)}</strong>
                <small>{humanize(fact.factType)} · Page {fact.sourcePageNumber ?? "?"}</small>
                <p>{excerpt(factText(fact))}</p>
              </button>
            ))}
            {detail && visibleFacts.length === 0 ? <p className="truth-case-list-empty">No proposals match this filter.</p> : null}
            {!detail ? <p className="truth-case-list-empty">Start a Truth Case to review this approved source.</p> : null}
            {detail && detail.summary.total === 0 ? <p className="truth-case-list-empty">Click Extract proposals to build source-linked review items.</p> : null}
          </nav>
        </section>

        <aside className="truth-case-review-pane">
          <div className="truth-case-pane-heading"><span>Fact review</span><strong>{selectedFact ? `Page ${selectedFact.sourcePageNumber ?? "?"}` : "Select a fact"}</strong></div>
          {selectedFact && draft ? (
            <div className="truth-case-review-form">
              <div className="truth-case-provenance">
                <strong>Immutable provenance</strong>
                <span>{selectedFact.sourceBlockIds.length} source block(s)</span>
                <span>Confidence {Math.round(selectedFact.sourceConfidence * 100)}%</span>
              </div>
              <label>Normalized fact
                <textarea
                  disabled={locked}
                  onChange={(event) => setDraft({
                    ...draft,
                    normalizedValue: updateFactText(draft.normalizedValue, event.target.value),
                  })}
                  rows={8}
                  value={draftFactText(draft.normalizedValue)}
                />
              </label>
              <div className="truth-case-form-row">
                <label>Fact type
                  <input disabled={locked} onChange={(event) => setDraft({ ...draft, factType: event.target.value })} value={draft.factType} />
                </label>
                <label>Evidence class
                  <select disabled={locked} onChange={(event) => setDraft({ ...draft, evidenceClass: event.target.value })} value={draft.evidenceClass}>
                    {EVIDENCE_CLASSES.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}
                  </select>
                </label>
              </div>
              <label>Answerability
                <select
                  disabled={locked}
                  onChange={(event) => {
                    const answerabilityClass = event.target.value as AnswerabilityClass;
                    setDraft({
                      ...draft,
                      answerabilityClass,
                      requiredFact: answerabilityClass === "gold_only_unobservable" ? false : draft.requiredFact,
                    });
                  }}
                  value={draft.answerabilityClass}
                >
                  {ANSWERABILITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="truth-case-check">
                <input
                  checked={draft.requiredFact}
                  disabled={locked || draft.answerabilityClass === "gold_only_unobservable"}
                  onChange={(event) => setDraft({ ...draft, requiredFact: event.target.checked })}
                  type="checkbox"
                />
                Required for generation evaluation
              </label>
              <label>Expected generator behavior
                <textarea disabled={locked} onChange={(event) => setDraft({ ...draft, expectedGeneratorBehavior: event.target.value })} rows={4} value={draft.expectedGeneratorBehavior} />
              </label>
              <div className="truth-case-form-row">
                <label>Capture destination
                  <input disabled={locked} onChange={(event) => setDraft({ ...draft, captureDestination: event.target.value || null })} value={draft.captureDestination ?? ""} />
                </label>
                <label>Safety
                  <select disabled={locked} onChange={(event) => setDraft({ ...draft, safetyCriticality: event.target.value as TruthFact["safetyCriticality"] })} value={draft.safetyCriticality}>
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                  </select>
                </label>
              </div>
              {!locked ? (
                <div className="truth-case-review-actions">
                  <button disabled={busy} onClick={() => void saveFact("human_reviewed")} type="button">Save review</button>
                  <button className="reject" disabled={busy} onClick={() => void saveFact("rejected")} type="button">Reject</button>
                  <button className="approve" disabled={busy} onClick={() => void saveFact("approved")} type="button">Approve fact</button>
                </div>
              ) : <div className="truth-case-locked-note">This approved Truth Graph is immutable.</div>}
            </div>
          ) : <div className="truth-case-list-empty">Select a proposal to review its source, value, and answerability.</div>}
        </aside>
      </div> : null}
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function toDraft(fact: TruthFact): TruthFactReviewInput {
  return {
    factType: fact.factType,
    sectionKey: fact.sectionKey,
    normalizedValue: fact.normalizedValue,
    unitCode: fact.unitCode,
    evidenceClass: fact.evidenceClass,
    captureDestination: fact.captureDestination,
    safetyCriticality: fact.safetyCriticality,
    answerabilityClass: fact.answerabilityClass,
    requiredFact: fact.requiredFact,
    expectedGeneratorBehavior: fact.expectedGeneratorBehavior,
    reviewStatus: fact.reviewStatus,
  };
}

function factText(fact: TruthFact) {
  return draftFactText(fact.normalizedValue);
}

function draftFactText(value: unknown) {
  if (value && typeof value === "object" && "text" in value) return String((value as { text?: unknown }).text ?? "");
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? "", null, 2);
}

function updateFactText(value: unknown, text: string) {
  if (value && typeof value === "object" && !Array.isArray(value)) return { ...value, text };
  return { text };
}

function factSourceSpans(fact: TruthFact | null) {
  if (!fact?.sourcePageNumber || !fact.sourceBbox) return [];
  return [{
    sourceBlockId: fact.sourceBlockIds[0] ?? fact.factId,
    pageNumber: fact.sourcePageNumber,
    bbox: fact.sourceBbox,
  }];
}

function formatDateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function humanize(value: string) {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusLabel(value: TruthFactReviewStatus) {
  if (value === "machine_proposed") return "Proposed";
  if (value === "human_reviewed") return "Reviewed";
  return humanize(value);
}

function excerpt(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}
