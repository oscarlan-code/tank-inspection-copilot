import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { AuthPrincipal } from "../lib/authClient";
import {
  decideKbDocument,
  loadCanonicalReportQueue,
  loadCanonicalIngestionStatus,
  loadKbReviewCase,
  loadKbReviewCases,
  loadKbSourcePreview,
  reviewKbWarning,
  reviewCanonicalReportGroup,
  saveKbDocumentClassification,
  saveKbSectionClassification,
  type KbDatasetSplit,
  type KbDocumentRole,
  type KbChunk,
  type KbLaneCode,
  type KbReviewCaseDetail,
  type KbReviewCaseList,
  type KbReviewDocument,
  type KbReviewSection,
  type CanonicalReportQueue,
  type CanonicalIngestionStatus,
} from "../lib/kbReviewApi";

const DATASET_OPTIONS: Array<{ value: KbDatasetSplit; label: string }> = [
  { value: "training", label: "Training precedent" },
  { value: "validation", label: "Validation" },
  { value: "hidden_test", label: "Hidden test" },
  { value: "unassigned", label: "Legacy: not assigned" },
];

const DOCUMENT_ROLE_OPTIONS: Array<{ value: KbDocumentRole; label: string }> = [
  { value: "historical_source", label: "Historical report" },
  { value: "alternate_rendition", label: "Alternate rendition" },
  { value: "structured_template", label: "Structured template" },
  { value: "standards_source", label: "Standard / code" },
  { value: "specialist_evidence", label: "Specialist evidence" },
  { value: "evaluation_gold", label: "Evaluation gold" },
  { value: "quarantine", label: "Quarantine" },
];

const LANE_OPTIONS: Array<{ value: KbLaneCode; label: string }> = [
  { value: "template_library", label: "Template library" },
  { value: "wording_precedent", label: "Wording precedent" },
  { value: "historical_case_memory", label: "Prior inspection memory" },
  { value: "fact_recommendation", label: "Fact-to-recommendation" },
  { value: "standards_guidance", label: "Standards guidance" },
  { value: "specialist_evidence", label: "Specialist evidence" },
  { value: "evaluation_gold", label: "Evaluation gold" },
  { value: "quarantine", label: "Quarantine" },
];

type DocumentDraft = {
  datasetSplit: KbDatasetSplit;
  documentRole: KbDocumentRole;
  reportFamily: string;
  reviewNotes: string;
};

type SectionDraft = {
  laneCode: KbLaneCode;
  includeInRetrieval: boolean;
  reviewNotes: string;
};

type ReviewChunk = {
  chunk: KbChunk;
  index: number;
  section: KbReviewSection;
};

type KbQualityIssue = KbReviewDocument["quality"]["issues"][number];

type SourceWarningFocus = {
  blockIds: string[];
  code: string;
  issueKey: string;
  message: string;
  pageNumber: number;
};

export function KnowledgeBaseReview({
  onClose,
  onOpenAccounts,
  onOpenEvaluation,
  principal,
}: {
  onClose: () => void;
  onOpenAccounts: () => void;
  onOpenEvaluation: () => void;
  principal: AuthPrincipal;
}) {
  const [caseList, setCaseList] = useState<KbReviewCaseList | null>(null);
  const [detail, setDetail] = useState<KbReviewCaseDetail | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedChunkId, setSelectedChunkId] = useState("");
  const [sourcePreview, setSourcePreview] = useState<{
    fileName: string;
    mediaType: string;
    readUrl: string;
  } | null>(null);
  const [documentDraft, setDocumentDraft] = useState<DocumentDraft | null>(null);
  const [sectionDraft, setSectionDraft] = useState<SectionDraft | null>(null);
  const [chunkSearch, setChunkSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [showReviewSettings, setShowReviewSettings] = useState(false);
  const [showCanonicalQueue, setShowCanonicalQueue] = useState(false);
  const [canonicalIngestion, setCanonicalIngestion] = useState<CanonicalIngestionStatus | null>(null);
  const [canonicalCheckedAt, setCanonicalCheckedAt] = useState<number | null>(null);
  const [canonicalClock, setCanonicalClock] = useState(() => Date.now());
  const [sourceWarningFocus, setSourceWarningFocus] = useState<SourceWarningFocus | null>(null);
  const [warningReviewNote, setWarningReviewNote] = useState("");
  const [warningReviewBusy, setWarningReviewBusy] = useState(false);
  const [pendingWarningIssueKey, setPendingWarningIssueKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const chunkListRef = useRef<HTMLElement | null>(null);

  const selectedDocument = detail?.documents.find(
    (document) => document.documentId === selectedDocumentId,
  ) ?? detail?.documents[0] ?? null;
  const selectedSection = selectedDocument?.sections.find(
    (section) => section.sectionId === selectedSectionId,
  ) ?? selectedDocument?.sections[0] ?? null;

  const documentChunks = useMemo<ReviewChunk[]>(() => {
    return (selectedDocument?.sections ?? [])
      .flatMap((section) => section.chunks.map((chunk) => ({ chunk, section, index: 0 })))
      .sort((left, right) => left.chunk.stableOrder - right.chunk.stableOrder)
      .map((item, index) => ({ ...item, index: index + 1 }));
  }, [selectedDocument]);

  const filteredChunks = useMemo(() => {
    const query = chunkSearch.trim().toLowerCase();
    return documentChunks.filter(({ chunk, section }) => {
      if (sectionFilter !== "all" && section.sectionId !== sectionFilter) return false;
      if (!query) return true;
      return `${section.originalHeading} ${chunk.blockType} ${chunk.content}`.toLowerCase().includes(query);
    });
  }, [chunkSearch, documentChunks, sectionFilter]);

  const selectedChunk = documentChunks.find(({ chunk }) => chunk.chunkId === selectedChunkId)
    ?? filteredChunks[0]
    ?? documentChunks[0]
    ?? null;
  const requiredWarnings = (selectedDocument?.quality.issues ?? []).filter(
    (issue) => issue.severity !== "info",
  );
  const unresolvedWarnings = requiredWarnings.filter((issue) => !isWarningResolved(issue));
  const focusedWarning = sourceWarningFocus
    ? selectedDocument?.quality.issues.find(
      (issue) => issue.issueKey === sourceWarningFocus.issueKey,
    ) ?? null
    : null;

  useEffect(() => {
    void refreshCases();
  }, []);

  useEffect(() => {
    let active = true;
    const poll = () => loadCanonicalIngestionStatus()
      .then((next) => { if (active) { setCanonicalIngestion(next); setCanonicalCheckedAt(Date.now()); } })
      .catch(() => undefined);
    void poll();
    const timer = window.setInterval(poll, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setCanonicalClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedDocument) {
      setDocumentDraft(null);
      return;
    }
    setDocumentDraft({
      datasetSplit: selectedDocument.datasetSplit,
      documentRole: selectedDocument.documentRole,
      reportFamily: detail?.case.reportFamily ?? "unclassified",
      reviewNotes: selectedDocument.reviewNotes,
    });
  }, [detail?.case.reportFamily, selectedDocument]);

  useEffect(() => {
    if (!selectedSection) {
      setSectionDraft(null);
      return;
    }
    setSectionDraft({
      laneCode: selectedSection.laneCode,
      includeInRetrieval: selectedSection.includeInRetrieval,
      reviewNotes: selectedSection.reviewNotes,
    });
  }, [selectedSection]);

  useEffect(() => {
    setSourcePreview(null);
    if (!selectedDocument) return;
    let active = true;
    loadKbSourcePreview(selectedDocument.documentId)
      .then((preview) => {
        if (active) setSourcePreview(preview);
      })
      .catch((previewError) => {
        if (active) {
          setError(previewError instanceof Error ? previewError.message : "Unable to load source preview.");
        }
      });
    return () => {
      active = false;
    };
  }, [selectedDocument?.documentId]);

  useEffect(() => {
    if (!sourceWarningFocus || !selectedChunkId) return;
    const frame = requestAnimationFrame(() => {
      const list = chunkListRef.current;
      const target = Array.from(
        list?.querySelectorAll<HTMLButtonElement>("button[data-chunk-id]") ?? [],
      ).find((button) => button.dataset.chunkId === selectedChunkId);
      if (!list || !target) return;
      const centeredTop = target.offsetTop + target.offsetHeight / 2 - list.clientHeight / 2;
      list.scrollTo({ behavior: "smooth", top: Math.max(centeredTop, 0) });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedChunkId, sourceWarningFocus]);

  useEffect(() => {
    if (!pendingWarningIssueKey || !selectedDocument) return;
    const issue = selectedDocument.quality.issues.find(
      (candidate) => candidate.issueKey === pendingWarningIssueKey,
    );
    setPendingWarningIssueKey("");
    if (issue) locateQualityIssue(issue);
  }, [pendingWarningIssueKey, selectedDocument]);

  async function refreshCases(preferredCaseId = selectedCaseId) {
    setLoading(true);
    setError("");
    try {
      const next = await loadKbReviewCases();
      setCaseList(next);
      const caseId = preferredCaseId || next.cases[0]?.caseId || "";
      if (caseId) {
        await openCase(caseId);
      } else {
        setDetail(null);
        setSelectedCaseId("");
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load KB review cases.");
    } finally {
      setLoading(false);
    }
  }

  async function openCase(caseId: string) {
    setError("");
    const next = await loadKbReviewCase(caseId);
    applyDetail(next);
  }

  function applyDetail(next: KbReviewCaseDetail) {
    setDetail(next);
    setSelectedCaseId(next.case.caseId);
    const documentId = next.documents.some((item) => item.documentId === selectedDocumentId)
      ? selectedDocumentId
      : next.documents[0]?.documentId ?? "";
    setSelectedDocumentId(documentId);
    const document = next.documents.find((item) => item.documentId === documentId);
    const section = document?.sections.find((item) => item.sectionId === selectedSectionId)
      ?? document?.sections.find((item) => item.chunks.length > 0)
      ?? document?.sections[0];
    setSelectedSectionId(section?.sectionId ?? "");
    const chunkExists = document?.sections.some((item) => (
      item.chunks.some((chunk) => chunk.chunkId === selectedChunkId)
    ));
    setSelectedChunkId(chunkExists ? selectedChunkId : section?.chunks[0]?.chunkId ?? "");
    setSourceWarningFocus(null);
  }

  function locateQualityIssue(issue: KbQualityIssue) {
    if (!selectedDocument) return;
    const pages = relatedIssuePages(issue, selectedDocument.quality.issues);
    const pageNumber = pages[0];
    if (!pageNumber) {
      setError("This extraction warning does not include a source page. Review the listed block ID in the ingestion audit.");
      return;
    }

    const issueBlockIds = new Set(issue.blockIds);
    const exactChunk = documentChunks.find(({ chunk }) => (
      chunk.sourceBlockIds.some((blockId) => issueBlockIds.has(blockId))
    ));
    const pageChunk = documentChunks.find(({ chunk }) => chunk.pageNumbers.includes(pageNumber));
    const targetChunk = exactChunk ?? pageChunk;
    if (targetChunk) {
      setChunkSearch("");
      setSectionFilter("all");
      setSelectedChunkId(targetChunk.chunk.chunkId);
      setSelectedSectionId(targetChunk.section.sectionId);
    }
    setSourceWarningFocus({
      blockIds: issue.blockIds,
      code: issue.code,
      issueKey: issue.issueKey,
      message: issue.message,
      pageNumber,
    });
    setWarningReviewNote(issue.review?.notes ?? "");
    setShowReviewSettings(false);
    setError("");
    setMessage(`Opened Page ${pageNumber} for the selected extraction warning.`);
  }

  function navigateToNextWarning() {
    if (!selectedDocument) return;
    const navigableIssues = unresolvedWarnings.filter((issue) => (
      relatedIssuePages(issue, selectedDocument.quality.issues).length > 0
    ));
    if (navigableIssues.length === 0) {
      setShowReviewSettings(true);
      return;
    }
    const currentIndex = sourceWarningFocus
      ? navigableIssues.findIndex((issue) => (
        issue.issueKey === sourceWarningFocus.issueKey
      ))
      : -1;
    locateQualityIssue(navigableIssues[(currentIndex + 1) % navigableIssues.length]);
  }

  async function reviewCurrentWarning(
    resolution: "accepted" | "needs_correction" | "not_applicable",
  ) {
    if (!selectedDocument || !sourceWarningFocus) return;
    if (resolution === "needs_correction" && warningReviewNote.trim().length < 3) {
      setError("Add a short note describing what must be corrected.");
      return;
    }
    setWarningReviewBusy(true);
    setError("");
    try {
      const currentIssueKey = sourceWarningFocus.issueKey;
      const next = await reviewKbWarning(selectedDocument.documentId, currentIssueKey, {
        resolution,
        notes: warningReviewNote.trim(),
      });
      const updatedDocument = next.documents.find(
        (document) => document.documentId === selectedDocument.documentId,
      );
      const remaining = (updatedDocument?.quality.issues ?? []).filter(
        (issue) => issue.severity !== "info" && !isWarningResolved(issue),
      );
      const nextPending = remaining.find(
        (issue) => issue.issueKey !== currentIssueKey && !issue.review,
      ) ?? remaining.find((issue) => issue.issueKey !== currentIssueKey)
        ?? remaining[0];
      applyDetail(next);
      setWarningReviewNote("");
      if (nextPending) {
        setPendingWarningIssueKey(nextPending.issueKey);
        setMessage(
          resolution === "needs_correction"
            ? "Correction requirement saved. Opening the next unresolved warning."
            : "Warning review saved. Opening the next unresolved warning.",
        );
      } else {
        setMessage("All extraction warnings are reviewed. The source can proceed to approval.");
      }
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to save warning review.");
    } finally {
      setWarningReviewBusy(false);
    }
  }

  async function runAction(action: () => Promise<KbReviewCaseDetail>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      applyDetail(await action());
      setMessage(success);
      setCaseList(await loadKbReviewCases());
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update KB review.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDocument() {
    if (!selectedDocument || !documentDraft) return;
    await runAction(
      () => saveKbDocumentClassification(selectedDocument.documentId, documentDraft),
      "Document classification saved.",
    );
  }

  async function saveSection() {
    if (!selectedSection || !sectionDraft) return;
    await runAction(
      () => saveKbSectionClassification(selectedSection.sectionId, sectionDraft),
      "Section classification saved.",
    );
  }

  async function decide(action: "approve" | "quarantine" | "reject" | "reopen") {
    if (!selectedDocument || !documentDraft) return;
    await runAction(
      () => decideKbDocument(selectedDocument.documentId, action, documentDraft.reviewNotes),
      action === "approve"
        ? "Source approved for the indexing queue. It is not yet live in retrieval."
        : `Review decision recorded: ${action}.`,
    );
  }

  return (
    <main className="kb-review-shell">
      <header className="kb-review-header">
        <div className="brand-lockup">
          <img alt="LAIQ logo" className="brand-logo" src="/laiq-logo.png" />
          <div>
            <p className="eyebrow">Super Admin</p>
            <h1>Knowledge Base Review</h1>
          </div>
        </div>
        <div className="kb-review-header-status">
          <span>Ingestion review</span>
          <strong>{caseList?.summary.pending ?? 0} pending</strong>
        </div>
        <nav className="kb-review-header-actions" aria-label="Admin workspaces">
          <button className="topbar-nav-button" onClick={() => setShowCanonicalQueue(true)} type="button">Canonical reports{canonicalIngestion?.status === "running" ? ` · ${canonicalIngestion.progressPercent}%` : ""}</button>
          <button className="topbar-nav-button" onClick={onOpenEvaluation} type="button">Evaluation Lab</button>
          <button className="topbar-nav-button" onClick={onOpenAccounts} type="button">Accounts</button>
          <button className="toolbar-button" onClick={onClose} type="button">Back to reports</button>
          <div className="topbar-account"><span>{principal.displayName}</span></div>
        </nav>
      </header>

      {canonicalIngestion?.status === "running" ? (
        <button className="kb-live-ingestion-banner" onClick={() => setShowCanonicalQueue(true)} type="button">
          <span className="canonical-live-dot" />
          <div className="kb-live-ingestion-copy">
            <strong>Canonical report ingestion · {canonicalIngestion.completedReports} of {canonicalIngestion.totalReports} complete</strong>
            <span>{canonicalIngestion.currentFileName ? `Extracting report ${Math.min(canonicalIngestion.completedReports + 1, canonicalIngestion.totalReports)} of ${canonicalIngestion.totalReports}: ${canonicalIngestion.currentFileName}` : "Preparing next report"}</span>
            <i className="kb-current-report-activity" aria-label="Current report extraction is active" />
          </div>
          <div className="kb-live-ingestion-progress">
            <strong>{canonicalIngestion.progressPercent}%</strong>
            <progress max={Math.max(canonicalIngestion.totalReports, 1)} value={canonicalIngestion.completedReports} />
            <small>{canonicalIngestion.failedReports} failed · current report active for {formatLiveAge(canonicalIngestion.updatedAtIso, canonicalClock)} · status API checked {formatCheckedAge(canonicalCheckedAt, canonicalClock)}</small>
          </div>
        </button>
      ) : canonicalIngestion && canonicalIngestion.totalReports > 0 ? (
        <button className={`kb-live-ingestion-banner ${canonicalIngestion.status}`} onClick={() => setShowCanonicalQueue(true)} type="button">
          <div className="kb-live-ingestion-copy"><strong>Canonical ingestion · {humanize(canonicalIngestion.status)}</strong><span>{canonicalIngestion.completedReports} of {canonicalIngestion.totalReports} reports processed</span></div>
          <strong>{canonicalIngestion.progressPercent}%</strong>
        </button>
      ) : null}

      {error ? <div className="kb-review-feedback error">{error}</div> : null}
      {message ? <div className="kb-review-feedback success">{message}</div> : null}
      {showCanonicalQueue ? <CanonicalReportQueueModal onClose={() => setShowCanonicalQueue(false)} /> : null}

      <div className="kb-review-document-selector">
        <label>
          <span>Original document</span>
          <select
            disabled={loading || (caseList?.cases.length ?? 0) === 0}
            onChange={(event) => void openCase(event.target.value)}
            value={selectedCaseId}
          >
            {(caseList?.cases ?? []).map((item) => (
              <option key={item.caseId} value={item.caseId}>{item.displayName}</option>
            ))}
          </select>
        </label>
        <div className="kb-review-selected-meta">
          <span className={`kb-review-state ${detail?.case.status ?? "discovered"}`}>
            {formatStatus(detail?.case.status ?? "discovered")}
          </span>
          <span>{humanize(detail?.case.reportFamily ?? "No document selected")}</span>
          {selectedDocument ? (
            <span>
              {formatDataset(selectedDocument.datasetSplit)}
              {selectedDocument.datasetAssignment === "automatic" ? " · automatic" : ""}
            </span>
          ) : null}
          <span>{documentChunks.length} chunks</span>
        </div>
        <div className="kb-review-selector-actions">
          {unresolvedWarnings.length > 0 ? (
            <button
              className="warning-shortcut"
              onClick={navigateToNextWarning}
              title="Open the warning source page. Click again to move to the next warning."
              type="button"
            >
              {sourceWarningFocus ? "Next warning" : "Go to warning"}
              <span>{unresolvedWarnings.length}</span>
            </button>
          ) : selectedDocument?.approvalStatus === "approved" ? (
            <span className="kb-review-warnings-complete">Source approved</span>
          ) : selectedDocument ? (
            <button
              className="approval-action"
              disabled={busy}
              onClick={() => void decide("approve")}
              title={requiredWarnings.length > 0
                ? "All extraction warnings are reviewed. Approve this source for the indexing queue."
                : "Approve this source for the indexing queue."}
              type="button"
            >
              Approve source
            </button>
          ) : null}
          <button disabled={loading} onClick={() => void refreshCases()} type="button">Refresh</button>
          <button
            className="primary"
            disabled={!selectedDocument}
            onClick={() => setShowReviewSettings(true)}
            type="button"
          >
            Review settings
          </button>
        </div>
      </div>

      <div className="kb-review-simple-grid">
        {!selectedDocument ? (
          <div className="kb-review-empty large">
            <strong>{loading ? "Loading original documents..." : "No review documents available"}</strong>
            <span>Ingest a historical report to compare its original source with extracted chunks.</span>
          </div>
        ) : (
          <>
            <section className="kb-review-source-pane">
              <div className="kb-review-simple-heading">
                <div>
                  <p className="eyebrow">Original reference</p>
                  <h2>{selectedDocument.fileName}</h2>
                </div>
                <div className="kb-review-document-tabs">
                  {detail?.documents.map((document) => (
                    <button
                      className={document.documentId === selectedDocument.documentId ? "active" : ""}
                      key={document.documentId}
                      onClick={() => {
                        const firstSection = document.sections.find((section) => section.chunks.length > 0)
                          ?? document.sections[0];
                        setSelectedDocumentId(document.documentId);
                        setSelectedSectionId(firstSection?.sectionId ?? "");
                        setSelectedChunkId(firstSection?.chunks[0]?.chunkId ?? "");
                        setSourceWarningFocus(null);
                      }}
                      type="button"
                    >
                      {document.sourceMediaType.includes("pdf") ? "PDF" : "DOCX"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="kb-review-source-note">
                <span>Immutable source</span>
                <span>
                  {sourceWarningFocus
                    ? `Warning guide · Page ${sourceWarningFocus.pageNumber}`
                    : selectedChunk
                    ? selectedChunk.chunk.sourceSpans.length > 0
                      ? `Showing ${formatPages(selectedChunk.chunk.pageNumbers)} · ${selectedChunk.chunk.sourceSpans.length} source region(s)`
                      : `Showing ${formatPages(selectedChunk.chunk.pageNumbers)} · page-level provenance`
                    : "Select a chunk to locate its source page"}
                </span>
              </div>
              {sourceWarningFocus ? (
                <div className="kb-review-warning-guide" role="status">
                  <div>
                    <strong>Review warning on Page {sourceWarningFocus.pageNumber}</strong>
                    <p>{sourceWarningFocus.message}</p>
                    <span>
                      Inspect the source page beside the related chunk. If no region is highlighted,
                      the warned source block did not produce an extracted chunk.
                    </span>
                    <span>
                      Confirm when the source and extracted content agree. Choose Needs correction
                      when content is missing or wrong, or Not applicable for irrelevant source content.
                    </span>
                  </div>
                  <div className="kb-review-warning-decision">
                    <textarea
                      aria-label="Warning review note"
                      onChange={(event) => setWarningReviewNote(event.target.value)}
                      placeholder="Optional note. Required when correction is needed."
                      rows={2}
                      value={warningReviewNote}
                    />
                    <div>
                      <button
                        className="confirm"
                        disabled={warningReviewBusy}
                        onClick={() => void reviewCurrentWarning("accepted")}
                        type="button"
                      >
                        Confirm extraction
                      </button>
                      <button
                        disabled={warningReviewBusy}
                        onClick={() => void reviewCurrentWarning("not_applicable")}
                        type="button"
                      >
                        Not applicable
                      </button>
                      <button
                        className="correction"
                        disabled={warningReviewBusy}
                        onClick={() => void reviewCurrentWarning("needs_correction")}
                        type="button"
                      >
                        Needs correction
                      </button>
                      <button onClick={() => setSourceWarningFocus(null)} type="button">Close</button>
                    </div>
                    {focusedWarning?.review ? (
                      <small>
                        Current outcome: {formatWarningResolution(focusedWarning.review.resolution)} · {focusedWarning.review.actorDisplayName}
                      </small>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <SourcePreview
                focusedPage={sourceWarningFocus?.pageNumber ?? null}
                key={selectedChunk?.chunk.chunkId ?? selectedDocument.documentId}
                pageNumbers={selectedChunk?.chunk.pageNumbers ?? [1]}
                preview={sourcePreview}
                sourceSpans={sourceWarningFocus
                  ? selectedChunk?.chunk.sourceSpans.filter((span) => (
                    sourceWarningFocus.blockIds.includes(span.sourceBlockId)
                  )) ?? []
                  : selectedChunk?.chunk.sourceSpans ?? []}
              />
            </section>

            <section className="kb-review-results-pane">
              <div className="kb-review-simple-heading">
                <div>
                  <p className="eyebrow">Chunked result</p>
                  <h2>Extracted chunks</h2>
                </div>
                <strong>{filteredChunks.length} / {documentChunks.length}</strong>
              </div>
              <div className="kb-review-chunk-filters">
                <input
                  onChange={(event) => setChunkSearch(event.target.value)}
                  placeholder="Search chunks"
                  type="search"
                  value={chunkSearch}
                />
                <select onChange={(event) => setSectionFilter(event.target.value)} value={sectionFilter}>
                  <option value="all">All sections</option>
                  {selectedDocument.sections.map((section) => (
                    <option key={section.sectionId} value={section.sectionId}>
                      {section.stableOrder}. {section.originalHeading}
                    </option>
                  ))}
                </select>
              </div>
              <div className="kb-review-chunk-workspace">
                <nav aria-label="Extracted chunk list" className="kb-review-chunk-list" ref={chunkListRef}>
                  {filteredChunks.map((item) => (
                    <button
                      className={[
                        item.chunk.chunkId === selectedChunk?.chunk.chunkId ? "active" : "",
                        sourceWarningFocus && item.chunk.chunkId === selectedChunk?.chunk.chunkId
                          ? "warning-target"
                          : "",
                      ].filter(Boolean).join(" ")}
                      data-chunk-id={item.chunk.chunkId}
                      key={item.chunk.chunkId}
                      onClick={() => {
                        setSelectedChunkId(item.chunk.chunkId);
                        setSelectedSectionId(item.section.sectionId);
                        setSourceWarningFocus(null);
                      }}
                      type="button"
                    >
                      <span>Chunk {item.index}</span>
                      <strong>{item.section.originalHeading}</strong>
                      <small>{humanize(item.chunk.blockType)} · {formatPages(item.chunk.pageNumbers)}</small>
                      <p>{chunkExcerpt(item.chunk.content)}</p>
                    </button>
                  ))}
                  {filteredChunks.length === 0 ? <p className="kb-review-empty">No chunks match this filter.</p> : null}
                </nav>
                <article className="kb-review-chunk-detail">
                  {selectedChunk ? (
                    <>
                      <div className="kb-review-chunk-detail-heading">
                        <div>
                          <span>Chunk {selectedChunk.index}</span>
                          <h3>{selectedChunk.section.originalHeading}</h3>
                        </div>
                        <small>{formatPages(selectedChunk.chunk.pageNumbers)}</small>
                      </div>
                      <div className="kb-review-chunk-provenance">
                        <span>{humanize(selectedChunk.chunk.blockType)}</span>
                        <span>{selectedChunk.chunk.sourceBlockIds.length} source block(s)</span>
                      </div>
                      <pre>{selectedChunk.chunk.content}</pre>
                    </>
                  ) : (
                    <div className="kb-review-empty large"><strong>Select a chunk</strong></div>
                  )}
                </article>
              </div>
            </section>
          </>
        )}
      </div>

      {showReviewSettings && selectedDocument && documentDraft ? (
        <div className="kb-review-settings-backdrop" onClick={() => setShowReviewSettings(false)} role="presentation">
          <aside
            aria-label="Knowledge base review settings"
            aria-modal="true"
            className="kb-review-settings-drawer"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="kb-review-settings-heading">
              <div><p className="eyebrow">Secondary controls</p><h2>Review settings</h2></div>
              <button onClick={() => setShowReviewSettings(false)} type="button">Close</button>
            </div>
            <div className="kb-review-automatic-defaults">
              <strong>
                {selectedDocument.datasetAssignment === "automatic"
                  ? "No setup required"
                  : "Classification is ready"}
              </strong>
              {selectedDocument.datasetAssignment === "automatic" ? (
                <p>
                  The report family, historical-report role, dataset split, and safe section lanes
                  were assigned automatically. Change them only for an exceptional case.
                </p>
              ) : (
                <p>The saved classification is active. Overrides remain optional.</p>
              )}
              <span>
                {humanize(detail?.case.reportFamily ?? "historical report")} · {formatDataset(selectedDocument.datasetSplit)}
              </span>
            </div>
            <QualityPanel document={selectedDocument} onLocateIssue={locateQualityIssue} />
            <details className="kb-review-override-settings">
              <summary>Override automatic classification</summary>
              <div className="kb-review-form">
              <label>Report family
                <input
                  disabled={selectedDocument.approvalStatus === "approved"}
                  onChange={(event) => setDocumentDraft({ ...documentDraft, reportFamily: event.target.value })}
                  value={documentDraft.reportFamily}
                />
              </label>
              <label>Document role
                <select
                  disabled={selectedDocument.approvalStatus === "approved"}
                  onChange={(event) => setDocumentDraft({ ...documentDraft, documentRole: event.target.value as KbDocumentRole })}
                  value={documentDraft.documentRole}
                >
                  {DOCUMENT_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label>Dataset split
                <select
                  disabled={selectedDocument.approvalStatus === "approved"}
                  onChange={(event) => setDocumentDraft({ ...documentDraft, datasetSplit: event.target.value as KbDatasetSplit })}
                  value={documentDraft.datasetSplit}
                >
                  {DATASET_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label>Reviewer notes
                <textarea
                  onChange={(event) => setDocumentDraft({ ...documentDraft, reviewNotes: event.target.value })}
                  placeholder="Record duplicate, revision, extraction, privacy, or approval notes."
                  rows={4}
                  value={documentDraft.reviewNotes}
                />
              </label>
              <button
                className="toolbar-button"
                disabled={busy || selectedDocument.approvalStatus === "approved"}
                onClick={() => void saveDocument()}
                type="button"
              >
                Save classification
              </button>
              </div>
              {selectedSection && sectionDraft ? (
                <div className="kb-review-selected-section-settings">
                  <div><span>Selected chunk section</span><strong>{selectedSection.originalHeading}</strong></div>
                  <SectionReviewControls
                    busy={busy}
                    draft={sectionDraft}
                    onChange={setSectionDraft}
                    onSave={() => void saveSection()}
                    section={selectedSection}
                  />
                </div>
              ) : null}
            </details>
            <div className="kb-review-decision-actions">
              {selectedDocument.approvalStatus === "approved" ? (
                <button disabled={busy} onClick={() => void decide("reopen")} type="button">Reopen review</button>
              ) : (
                <>
                  <button
                    className="approve"
                    disabled={busy || unresolvedWarnings.length > 0}
                    onClick={() => void decide("approve")}
                    type="button"
                  >
                    {unresolvedWarnings.length > 0 ? "Resolve warnings first" : "Approve source"}
                  </button>
                  <button disabled={busy} onClick={() => void decide("quarantine")} type="button">Quarantine</button>
                  <button disabled={busy} onClick={() => void decide("reject")} type="button">Reject</button>
                </>
              )}
            </div>
            <div className="kb-review-publication-gate">
              <strong>
                {unresolvedWarnings.length > 0
                  ? `${unresolvedWarnings.length} warning outcome(s) still block approval.`
                  : "Approval does not publish this source."}
              </strong>
              <p>
                {unresolvedWarnings.length > 0
                  ? "Open each warning and confirm it, mark it not applicable, or record that correction is required."
                  : "Embedding and index publication remain a separate controlled step."}
              </p>
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}

function CanonicalReportQueueModal({ onClose }: { onClose: () => void }) {
  const [queue, setQueue] = useState<CanonicalReportQueue | null>(null);
  const [ingestion, setIngestion] = useState<CanonicalIngestionStatus | null>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [filter, setFilter] = useState("pending_review");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [error, setError] = useState("");
  const reports = useMemo(() => (queue?.reports ?? []).filter((item) => {
    if (filter !== "all" && item.status !== filter) return false;
    const query = search.trim().toLowerCase();
    return !query || `${item.reportReference} ${item.reportFamily} ${item.selectedRelativePath}`.toLowerCase().includes(query);
  }), [filter, queue, search]);
  const selected = queue?.reports.find((item) => item.groupKey === selectedKey) ?? reports[0] ?? null;
  const [draft, setDraft] = useState<null | { selectedCanonicalAssetId: string; reportFamily: string; datasetSplit: KbDatasetSplit; assetLineageKey: string; status: "pending_review" | "approved_for_ingestion" | "quarantined"; reviewNotes: string }>(null);
  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    let active = true;
    const load = () => loadCanonicalIngestionStatus().then((next) => { if (active) { setIngestion(next); setCheckedAt(Date.now()); } }).catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!selected) { setDraft(null); return; }
    setSelectedKey(selected.groupKey);
    setDraft({ selectedCanonicalAssetId: selected.selectedCanonicalAssetId, reportFamily: selected.reportFamily, datasetSplit: selected.datasetSplit, assetLineageKey: selected.assetLineageKey ?? "", status: selected.status, reviewNotes: selected.reviewNotes });
  }, [selected?.groupKey, selected?.reviewedAtIso]);
  async function refresh() { setBusy(true); setError(""); try { const [nextQueue, nextIngestion] = await Promise.all([loadCanonicalReportQueue(), loadCanonicalIngestionStatus()]); setQueue(nextQueue); setIngestion(nextIngestion); setCheckedAt(Date.now()); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load canonical reports."); } finally { setBusy(false); } }
  async function save(status: "pending_review" | "approved_for_ingestion" | "quarantined") { if (!selected || !draft) return; setBusy(true); setError(""); try { setQueue(await reviewCanonicalReportGroup(selected.groupKey, { ...draft, status })); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to save review decision."); } finally { setBusy(false); } }
  return <div className="canonical-queue-backdrop"><section aria-label="Canonical report review queue" aria-modal="true" className="canonical-queue-modal" role="dialog">
    <header><div><p className="eyebrow">Sample Reports · Canonicalization</p><h2>Canonical report review queue</h2><span>{queue ? `${queue.summary.reports} logical reports · ${queue.summary.pending} pending · ${queue.summary.approvedForIngestion} approved for ingestion` : "Loading report inventory…"}</span></div><button className="toolbar-button" onClick={onClose} type="button">Close</button></header>
    {error ? <div className="kb-review-feedback error">{error}</div> : null}
    {ingestion ? <section className="canonical-ingestion-monitor" aria-label="Canonical ingestion progress"><div className="canonical-ingestion-title"><div><p className="eyebrow">Live ingestion · one shared status</p><h3>{ingestion.status === "running" ? "Building the report corpus" : humanize(ingestion.status)}</h3></div><strong>{ingestion.completedReports} / {ingestion.totalReports} · {ingestion.progressPercent}%</strong></div><progress max={Math.max(ingestion.totalReports, 1)} value={ingestion.completedReports} /><div className="canonical-ingestion-stats"><span><strong>{ingestion.remainingReports}</strong> remaining</span><span><strong>{ingestion.chunks}</strong> chunks</span><span><strong>{ingestion.sections}</strong> sections</span><span><strong>{ingestion.failedReports}</strong> failed</span></div>{ingestion.currentFileName ? <div className="canonical-current-report"><p><span className="canonical-live-dot" /><strong>Extracting report {Math.min(ingestion.completedReports + 1, ingestion.totalReports)} of {ingestion.totalReports}</strong></p><span>{ingestion.currentFileName}</span><i className="kb-current-report-activity" aria-label="Current report extraction is active" /></div> : null}<small className="canonical-status-checked">Live response received {checkedAt ? new Date(checkedAt).toLocaleTimeString() : "—"} · automatically checks every 3 seconds</small>{ingestion.failures.length > 0 ? <details><summary>Show ingestion failures</summary>{ingestion.failures.map((failure) => <p key={`${failure.fileName}:${failure.stage}`}><strong>{failure.fileName}</strong> · {failure.stage}: {failure.error}</p>)}</details> : null}</section> : null}
    <div className="canonical-queue-tools"><input aria-label="Search canonical reports" onChange={(event) => setSearch(event.target.value)} placeholder="Search report, family, or path" value={search} /><select aria-label="Filter review status" onChange={(event) => setFilter(event.target.value)} value={filter}><option value="pending_review">Pending review</option><option value="approved_for_ingestion">Approved for ingestion</option><option value="quarantined">Quarantined</option><option value="all">All reports</option></select><button disabled={busy} onClick={() => void refresh()} type="button">Refresh</button></div>
    <div className="canonical-queue-layout"><nav>{reports.map((item) => <button className={item.groupKey === selected?.groupKey ? "active" : ""} key={item.groupKey} onClick={() => setSelectedKey(item.groupKey)} type="button"><strong>{item.reportReference ?? "No report reference"}</strong><span>{humanize(item.reportFamily)} · {item.renditionCount} rendition{item.renditionCount === 1 ? "" : "s"}</span><small>{Math.round(item.confidence * 100)}% confidence · {humanize(item.status)}</small></button>)}</nav>
      <article>{selected && draft ? <><div className="canonical-report-heading"><div><p className="eyebrow">Logical report</p><h3>{selected.reportReference ?? selected.groupKey}</h3></div><span>{selected.renditionCount} source assets</span></div>
        <label><span>Canonical rendition</span><select onChange={(event) => setDraft({ ...draft, selectedCanonicalAssetId: event.target.value })} value={draft.selectedCanonicalAssetId}>{selected.assets.map((asset) => <option key={asset.assetId} value={asset.assetId}>{asset.fileName} · score {asset.score}</option>)}</select></label><p className="canonical-selected-path">{selected.assets.find((asset) => asset.assetId === draft.selectedCanonicalAssetId)?.relativePath}</p>
        <div className="canonical-form-grid"><label><span>Report family</span><input onChange={(event) => setDraft({ ...draft, reportFamily: event.target.value })} value={draft.reportFamily} /></label><label><span>Dataset role</span><select onChange={(event) => setDraft({ ...draft, datasetSplit: event.target.value as KbDatasetSplit })} value={draft.datasetSplit}>{DATASET_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>
        <label><span>Lineage group</span><input onChange={(event) => setDraft({ ...draft, assetLineageKey: event.target.value })} placeholder="asset or campaign lineage" value={draft.assetLineageKey} /></label><label><span>Review notes</span><textarea onChange={(event) => setDraft({ ...draft, reviewNotes: event.target.value })} rows={3} value={draft.reviewNotes} /></label>
        <div className="canonical-renditions"><strong>Related renditions</strong>{selected.assets.map((asset) => <div key={asset.assetId}><span>{asset.fileName}</span><small>{asset.extension.toUpperCase()} · {formatCanonicalBytes(asset.fileSizeBytes)} · score {asset.score}</small></div>)}</div>
        <footer><button className="toolbar-button" disabled={busy} onClick={() => void save("quarantined")} type="button">Quarantine</button><button className="toolbar-button" disabled={busy} onClick={() => void save("pending_review")} type="button">Save review</button><button className="toolbar-button toolbar-button-primary" disabled={busy || draft.datasetSplit === "unassigned"} onClick={() => void save("approved_for_ingestion")} type="button">Approve for ingestion</button></footer>
      </> : <div className="kb-review-empty large"><strong>Select a logical report</strong></div>}</article></div>
  </section></div>;
}

function formatCanonicalBytes(value: number) { return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)} MB` : `${Math.round(value / 1_000)} KB`; }

function formatLiveAge(value: string | null, now: number) {
  if (!value) return "preparing";
  const seconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatCheckedAge(value: number | null, now: number) {
  if (!value) return "connecting";
  const seconds = Math.max(0, Math.floor((now - value) / 1000));
  return seconds < 2 ? "now" : `${seconds}s ago`;
}

export function SourcePreview({
  focusedPage,
  pageNumbers,
  preview,
  sourceSpans,
}: {
  focusedPage: number | null;
  pageNumbers: number[];
  preview: { fileName: string; mediaType: string; readUrl: string } | null;
  sourceSpans: KbChunk["sourceSpans"];
}) {
  if (!preview) return <div className="kb-review-source-loading">Loading immutable source...</div>;
  if (preview.mediaType === "application/pdf") {
    return (
      <PdfSourcePreview
        fileName={preview.fileName}
        focusedPage={focusedPage}
        pageNumbers={pageNumbers.length > 0 ? pageNumbers : [1]}
        readUrl={preview.readUrl}
        sourceSpans={sourceSpans}
      />
    );
  }
  if (preview.mediaType.startsWith("image/")) {
    return <img alt={`Original source: ${preview.fileName}`} src={preview.readUrl} />;
  }
  return (
    <div className="kb-review-source-download">
      <strong>{preview.fileName}</strong>
      <span>Browser preview is unavailable for this source format.</span>
      <a href={preview.readUrl} rel="noreferrer" target="_blank">Open original source</a>
    </div>
  );
}

function PdfSourcePreview({
  fileName,
  focusedPage,
  pageNumbers,
  readUrl,
  sourceSpans,
}: {
  fileName: string;
  focusedPage: number | null;
  pageNumbers: number[];
  readUrl: string;
  sourceSpans: KbChunk["sourceSpans"];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [renderedPage, setRenderedPage] = useState(0);
  const [pageNumber, setPageNumber] = useState(focusedPage ?? pageNumbers[0] ?? 1);
  const [loadingMessage, setLoadingMessage] = useState("Loading original PDF...");
  const [renderError, setRenderError] = useState("");
  const pageSpans = sourceSpans.filter((span) => span.pageNumber === pageNumber);
  const availablePages = Array.from(new Set([
    ...(focusedPage ? [focusedPage] : []),
    ...pageNumbers,
  ])).sort((left, right) => left - right);
  const pageKey = pageNumbers.join(",");

  useEffect(() => {
    setPageNumber(focusedPage ?? pageNumbers[0] ?? 1);
  }, [focusedPage, pageKey]);

  useEffect(() => {
    let active = true;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    setPdf(null);
    setRenderedPage(0);
    setRenderError("");
    setLoadingMessage("Loading original PDF...");
    import("pdfjs-dist")
      .then(({ GlobalWorkerOptions, getDocument: loadDocument }) => {
        GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        loadingTask = loadDocument({ url: readUrl, withCredentials: true });
        return loadingTask.promise;
      })
      .then((document) => {
        if (active) setPdf(document);
        else void document.destroy();
      })
      .catch((loadError) => {
        if (active) {
          setRenderError(loadError instanceof Error ? loadError.message : "Unable to load original PDF.");
        }
      });
    return () => {
      active = false;
      void loadingTask?.destroy();
    };
  }, [readUrl]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let active = true;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;
    setRenderedPage(0);
    setRenderError("");
    setLoadingMessage(`Rendering Page ${pageNumber}...`);
    pdf.getPage(Math.min(Math.max(pageNumber, 1), pdf.numPages))
      .then((page) => {
        if (!active || !canvasRef.current) return null;
        const viewport = page.getViewport({ scale: 1.6 });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("The browser could not create the PDF canvas.");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        renderTask = page.render({ canvas, canvasContext: context, viewport });
        return renderTask.promise;
      })
      .then(() => {
        if (!active) return;
        setRenderedPage(pageNumber);
        setLoadingMessage("");
        requestAnimationFrame(() => {
          const firstRegion = scrollRef.current?.querySelector<HTMLElement>(".kb-review-source-region");
          if (!firstRegion || !scrollRef.current) {
            scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
            return;
          }
          const targetTop = Math.max(firstRegion.offsetTop - scrollRef.current.clientHeight * 0.35, 0);
          scrollRef.current.scrollTo({ top: targetTop, behavior: "smooth" });
        });
      })
      .catch((pageError) => {
        if (active && pageError?.name !== "RenderingCancelledException") {
          setRenderError(pageError instanceof Error ? pageError.message : "Unable to render source page.");
        }
      });
    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [pageNumber, pdf]);

  return (
    <div className="kb-review-pdf-viewer" ref={scrollRef}>
      {availablePages.length > 1 ? (
        <nav aria-label="Chunk source pages" className="kb-review-pdf-pages">
          {availablePages.map((page) => (
            <button
              className={page === pageNumber ? "active" : ""}
              key={page}
              onClick={() => setPageNumber(page)}
              type="button"
            >
              Page {page}
            </button>
          ))}
        </nav>
      ) : null}
      {loadingMessage ? <div className="kb-review-pdf-status">{loadingMessage}</div> : null}
      {renderError ? (
        <div className="kb-review-pdf-status error">
          <span>{renderError}</span>
          <a href={`${readUrl}#page=${pageNumber}&view=FitH`} rel="noreferrer" target="_blank">
            Open original PDF
          </a>
        </div>
      ) : null}
      <div className="kb-review-pdf-page" hidden={renderedPage !== pageNumber}>
        <canvas aria-label={`Original source ${fileName}, Page ${pageNumber}`} ref={canvasRef} />
        {pageSpans.map((span, index) => {
          const [left, top, right, bottom] = span.bbox;
          return (
            <span
              aria-label={`Source region ${index + 1} for selected chunk`}
              className="kb-review-source-region"
              key={`${span.sourceBlockId}:${span.pageNumber}:${index}`}
              style={{
                height: `${Math.max((bottom - top) * 100, 0.6)}%`,
                left: `${left * 100}%`,
                top: `${top * 100}%`,
                width: `${Math.max((right - left) * 100, 0.6)}%`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function SectionReviewControls({
  busy,
  draft,
  onChange,
  onSave,
  section,
}: {
  busy: boolean;
  draft: SectionDraft;
  onChange: (value: SectionDraft) => void;
  onSave: () => void;
  section: KbReviewSection;
}) {
  const protectedLane = draft.laneCode === "evaluation_gold" || draft.laneCode === "quarantine";
  return (
    <div className="kb-review-section-controls">
      <label>Knowledge lane
        <select onChange={(event) => onChange({ ...draft, laneCode: event.target.value as KbLaneCode })} value={draft.laneCode}>
          {LANE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="kb-review-check">
        <input
          checked={draft.includeInRetrieval && !protectedLane}
          disabled={protectedLane}
          onChange={(event) => onChange({ ...draft, includeInRetrieval: event.target.checked })}
          type="checkbox"
        />
        Include after publication
      </label>
      <label>Section note
        <input onChange={(event) => onChange({ ...draft, reviewNotes: event.target.value })} value={draft.reviewNotes} />
      </label>
      <button disabled={busy} onClick={onSave} type="button">Save section</button>
      <span className={`kb-review-section-status ${section.reviewStatus}`}>{humanize(section.reviewStatus)}</span>
    </div>
  );
}

function QualityPanel({
  document,
  onLocateIssue,
}: {
  document: KbReviewDocument;
  onLocateIssue: (issue: KbQualityIssue) => void;
}) {
  return (
    <div className="kb-review-quality-panel">
      <div><span>Text coverage</span><strong>{formatPercent(document.quality.textPageCoverage)}</strong></div>
      <div><span>Provenance</span><strong>{formatPercent(document.quality.provenanceCoverage)}</strong></div>
      <div><span>Headings</span><strong>{document.quality.headingCount}</strong></div>
      <div><span>Tables</span><strong>{document.quality.tableCount}</strong></div>
      {document.quality.issues.map((issue) => {
        const pages = relatedIssuePages(issue, document.quality.issues);
        return (
          <article
            className={`kb-review-quality-issue ${issue.severity} ${issue.review?.resolution ?? "pending"}`}
            key={issue.issueKey}
          >
            <div>
              <strong>{issue.message}</strong>
              <span>{pages.length > 0 ? formatPages(pages) : "Source page unavailable"}</span>
              <span className="review-status">
                {issue.review
                  ? `${formatWarningResolution(issue.review.resolution)} · ${issue.review.actorDisplayName}`
                  : "Review required"}
              </span>
            </div>
            {pages.length > 0 ? (
              <button onClick={() => onLocateIssue(issue)} type="button">
                {isWarningResolved(issue) ? "Review again" : "Review warning"}
              </button>
            ) : null}
          </article>
        );
      })}
      {document.quality.issues.length === 0 ? <p className="passed">Extraction quality gates passed.</p> : null}
      {document.escalations.length > 0 ? <p>{document.escalations.length} AI-assisted extraction proposal(s) require review.</p> : null}
    </div>
  );
}

function relatedIssuePages(issue: KbQualityIssue, issues: KbQualityIssue[]) {
  if (issue.pageNumbers.length > 0) return [...new Set(issue.pageNumbers)].sort((left, right) => left - right);
  const blockIds = new Set(issue.blockIds);
  return [...new Set(
    issues
      .filter((candidate) => candidate.blockIds.some((blockId) => blockIds.has(blockId)))
      .flatMap((candidate) => candidate.pageNumbers),
  )].sort((left, right) => left - right);
}

function isWarningResolved(issue: KbQualityIssue) {
  return issue.review?.resolution === "accepted" || issue.review?.resolution === "not_applicable";
}

function formatWarningResolution(value: NonNullable<KbQualityIssue["review"]>["resolution"]) {
  if (value === "accepted") return "Confirmed extraction";
  if (value === "not_applicable") return "Not applicable";
  return "Needs correction";
}

function humanize(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatStatus(value: string) {
  return value === "discovered" ? "Pending" : humanize(value);
}

function formatDataset(value: KbDatasetSplit) {
  return DATASET_OPTIONS.find((option) => option.value === value)?.label ?? humanize(value);
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatPages(pages: number[]) {
  if (pages.length === 0) return "Page provenance unavailable";
  return `Page${pages.length > 1 ? "s" : ""} ${pages.join(", ")}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function chunkExcerpt(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 150 ? `${normalized.slice(0, 147)}...` : normalized;
}
