import { useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import type { AuthPrincipal } from "../lib/authClient";
import {
  loadEvaluationLab,
  runNextEvaluationEpisode,
  type EvaluationLabCase,
  type EvaluationLabDocument,
  type EvaluationLabState,
} from "../lib/evaluationLabApi";
import {
  loadSystemRlHeldOutReview,
  loadSystemRlStatus,
  openSystemRlHeldOutSection,
  promoteSystemRlPolicy,
  rollbackSystemRlPolicy,
  runSystemRlHeldOutTest,
  type SystemRlHeldOutReview,
  type SystemRlPolicyStatus,
  type SystemRlStatus,
} from "../lib/systemRlApi";
import { TruthCaseBuilder } from "./TruthCaseBuilder";
import { CaptureVariantBuilder } from "./CaptureVariantBuilder";
import { SectionPlanningPanel } from "./SectionPlanningPanel";
import { SectionAgentMonitoring, type SectionAgentMonitoringView } from "./SectionAgentMonitoring";
import { MockPreparationEvaluation } from "./MockPreparationEvaluation";
import { ContentsClassificationEvaluation } from "./ContentsClassificationEvaluation";

type EvaluationView = "sources" | "truth" | "mock" | "classification" | "runs" | "policy" | "outlines";

export function EvaluationLab({
  principal,
  onClose,
  onOpenAccounts,
  onOpenKnowledgeBase,
}: {
  principal: AuthPrincipal;
  onClose: () => void;
  onOpenAccounts: () => void;
  onOpenKnowledgeBase: () => void;
}) {
  const opensSavedReview = useMemo(() => new URLSearchParams(window.location.search).has("evaluationCaseId"), []);
  const [view, setView] = useState<EvaluationView>(() => new URLSearchParams(window.location.search).has("classificationEval") ? "classification" : new URLSearchParams(window.location.search).has("outlineExperiment") ? "outlines" : new URLSearchParams(window.location.search).has("evaluationCaseId") ? "policy" : "mock");
  const [outlineSelection, setOutlineSelection] = useState("");
  const [outlineReportId, setOutlineReportId] = useState("");
  const [truthStageMode, setTruthStageMode] = useState<"source" | "capture">("source");
  const [approvedTruthCaseId, setApprovedTruthCaseId] = useState("");
  const [state, setState] = useState<EvaluationLabState | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [policyStatus, setPolicyStatus] = useState<SystemRlStatus | null>(null);
  const [heldOutReview, setHeldOutReview] = useState<SystemRlHeldOutReview | null>(null);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [policyError, setPolicyError] = useState("");
  const [baselineBusy, setBaselineBusy] = useState(false);
  const [evaluationEnabled, setEvaluationEnabled] = useState(false);

  const selectedDocument = state?.documents.find(
    (document) => document.documentId === selectedDocumentId,
  ) ?? state?.documents[0] ?? null;
  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return state?.documents ?? [];
    return (state?.documents ?? []).filter((document) => (
      `${document.displayName} ${document.reportFamily} ${document.documentRole}`
        .toLowerCase()
        .includes(query)
    ));
  }, [search, state]);

  useEffect(() => {
    if (!opensSavedReview && view !== "mock" && view !== "classification") void refresh();
  }, []);

  useEffect(() => {
    if (view === "policy" || view === "mock" || view === "classification" || state || loading || error) return;
    void refresh();
  }, [error, loading, state, view]);

  useEffect(() => {
    if (view !== "policy" || policyStatus || policyBusy) return;
    void refreshPolicy();
  }, [policyBusy, policyStatus, view]);

  useEffect(() => {
    if (view === "runs") void refresh();
  }, [view]);

  useEffect(() => {
    if (view !== "runs" || !evaluationEnabled || loading || baselineBusy || error || !state) return;
    const next = state.evaluationCases.find((item) => item.nextSectionId && item.reportJobId && item.blockedEpisodeCount === 0);
    if (!next) return;
    setBaselineBusy(true);
    void runNextEvaluationEpisode(next)
      .then(() => refresh({ silent: true }))
      .catch((episodeError) => {
        setMessage("");
        setError(episodeError instanceof Error ? episodeError.message : "Automatic baseline evaluation failed.");
      })
      .finally(() => setBaselineBusy(false));
  }, [baselineBusy, error, evaluationEnabled, loading, state, view]);

  async function refresh({ silent = false }: { silent?: boolean } = {}) {
    if (!silent) setLoading(true);
    if (!silent) setError("");
    try {
      const next = await loadEvaluationLab();
      setState(next);
      setError("");
      setSelectedDocumentId((current) => (
        next.documents.some((document) => document.documentId === current)
          ? current
          : next.documents[0]?.documentId ?? ""
      ));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Evaluation Lab data.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function refreshPolicy() {
    setPolicyBusy(true);
    setPolicyError("");
    try {
      const params = new URLSearchParams(window.location.search);
      const [nextStatus, nextReview] = await Promise.all([loadSystemRlStatus(), loadSystemRlHeldOutReview(params.get("evaluationCaseId") ?? undefined, params.get("sectionId") ?? undefined, params.get("evalRunId") ?? undefined)]);
      setPolicyStatus(nextStatus);
      setHeldOutReview(nextReview);
    } catch (loadError) {
      setPolicyError(loadError instanceof Error ? loadError.message : "Unable to load policy state.");
    } finally {
      setPolicyBusy(false);
    }
  }

  async function promote(policyVersionId: string) {
    setPolicyBusy(true);
    setPolicyError("");
    try {
      await promoteSystemRlPolicy(policyVersionId, "Super-admin promotion after real evaluation review.");
      setPolicyStatus(await loadSystemRlStatus());
    } catch (actionError) {
      setPolicyError(actionError instanceof Error ? actionError.message : "Unable to promote policy.");
    } finally {
      setPolicyBusy(false);
    }
  }

  async function rollback(policyVersionId: string) {
    setPolicyBusy(true);
    setPolicyError("");
    try {
      await rollbackSystemRlPolicy(policyVersionId, "Super-admin rollback after real evaluation review.");
      setPolicyStatus(await loadSystemRlStatus());
    } catch (actionError) {
      setPolicyError(actionError instanceof Error ? actionError.message : "Unable to roll back policy.");
    } finally {
      setPolicyBusy(false);
    }
  }

  async function runHeldOut(documentId: string) {
    setPolicyBusy(true);
    setPolicyError("");
    try {
      await runSystemRlHeldOutTest(documentId);
      const [nextStatus, nextReview, nextLab] = await Promise.all([loadSystemRlStatus(), loadSystemRlHeldOutReview(), loadEvaluationLab()]);
      setPolicyStatus(nextStatus);
      setHeldOutReview(nextReview);
      setState(nextLab);
    } catch (actionError) {
      setPolicyError(actionError instanceof Error ? actionError.message : "Unable to run the new-report policy test.");
    } finally {
      setPolicyBusy(false);
    }
  }

  async function openHeldOutSection(evaluationCaseId: string, sectionId: string) {
    setPolicyBusy(true);
    setPolicyError("");
    try {
      const review = await openSystemRlHeldOutSection(evaluationCaseId, sectionId);
      setHeldOutReview(review);
      if (review.evaluationOnly) {
        const url = new URL(window.location.href);
        url.searchParams.set("evaluationCaseId", evaluationCaseId);
        url.searchParams.set("sectionId", sectionId);
        url.searchParams.delete("evalRunId");
        window.history.replaceState(null, "", url);
      }
    } catch (actionError) {
      setPolicyError(actionError instanceof Error ? actionError.message : "Unable to open the selected section.");
    } finally {
      setPolicyBusy(false);
    }
  }

  return (
    <main className="eval-lab-shell eval-live-shell">
      <header className={view === "mock" || view === "classification" ? "eval-lab-header mock-agent-header" : "eval-lab-header"}>
        <div className="brand-lockup">
          <img alt="LAIQ logo" className="brand-logo" src="/laiq-logo.png" />
          <div><p className="eyebrow">{view === "mock" || view === "classification" ? "Evaluation only" : "Super Admin"}</p><h1>{view === "mock" ? "Step 1 · Truth → Mockup" : view === "classification" ? "Step 2 · Evidence → Sections" : "Evaluation Lab"}</h1></div>
        </div>
        {view !== "mock" && view !== "classification" ? <nav className="eval-lab-nav" aria-label="Evaluation Lab stages">
          <StageButton active={view === "sources"} label="1. Approved Sources" onClick={() => setView("sources")} />
          <StageButton active={view === "truth"} label="2. Truth & Mock Data" onClick={() => setView("truth")} />
          <StageButton active={false} label="Mock agent eval · Step 1" onClick={() => setView("mock")} />
          <StageButton active={false} label="Classification eval · Step 2" onClick={() => setView("classification")} />
          <StageButton active={view === "runs"} label="3. Evaluation Runs" onClick={() => setView("runs")} />
          <StageButton active={view === "policy"} label={heldOutReview?.evaluationOnly ? "4. Review results" : "4. Policy Registry"} onClick={() => setView("policy")} />
          <StageButton active={view === "outlines"} label="Outline experiment" onClick={() => setView("outlines")} />
        </nav> : null}
        <div className="eval-lab-header-actions">
          {view !== "mock" && view !== "classification" ? <button className="topbar-nav-button" onClick={onOpenKnowledgeBase} type="button">Review KB</button> : null}
          {view !== "mock" && view !== "classification" ? <button className="topbar-nav-button" onClick={onOpenAccounts} type="button">Accounts</button> : null}
          <button className="toolbar-button" onClick={onClose} type="button">Back to reports</button>
          {view !== "mock" && view !== "classification" ? <div className="topbar-account" title={`${principal.tenantName} · ${principal.userId}`}>
            <span>{principal.displayName}</span>
          </div> : null}
        </div>
      </header>

      {view !== "mock" && view !== "classification" ? <div className="eval-live-banner">
        <strong>{heldOutReview?.evaluationOnly ? "EVALUATION ONLY" : "LIVE DATA"}</strong>
        <span>{heldOutReview?.evaluationDisplay?.banner ?? (heldOutReview?.sectionAgentEvaluation ? `General Tank Information: 10 development reports and 1 held-out test. Saved deterministic results; no production promotion.` : heldOutReview?.inputReadiness ? (heldOutReview.inputReadiness.status === "supplied" ? `All ${heldOutReview.inputReadiness.totalSections} selected ${heldOutReview.comparisonExperiment?.unitLabel ?? "sections"} have prepared inputs. Reviewing saved results; no model or policy was promoted.` : `Incomplete mock: ${heldOutReview.inputReadiness.sectionsWithInputs} of ${heldOutReview.inputReadiness.totalSections} sections have inputs; ${heldOutReview.inputReadiness.sectionsWithoutInputs} have none. Some supplied sections still have gaps. No model or policy was promoted.`) : heldOutReview?.evaluationOnly ? (heldOutReview.generationBackend?.startsWith("tk5452_") ? "Reviewing the saved TK5452 evaluation across 21 source sections. No model or production policy was promoted." : "Reviewing the saved 12-section run from the generic-outline generation backend. No model or production policy was promoted.") : "Approved KB sources, Truth Cases, Capture Variants, Evaluation Runs, and policy state are loaded from PostgreSQL.")}</span>
        <button disabled={loading} onClick={() => void refresh()} type="button">Refresh</button>
      </div> : null}
      {error ? <div className="eval-live-feedback error">{error}</div> : null}
      {message ? <div className="eval-live-feedback success">{message}</div> : null}

      {view !== "mock" && view !== "classification" && loading && !state ? <LiveEmpty title="Loading Evaluation Lab" detail="Reading approved KB and app-package state from PostgreSQL." /> : null}
      {view === "outlines" && state ? <section className="eval-panel">
        <h2>Outline and evidence experiment</h2>
        <p>Review the 32 section outlines, map each captured record to one or more content blocks, and generate an evaluation draft. Results stay in this experiment; report drafts and production policy remain unchanged.</p>
        <label>Evaluation case <select aria-label="Outline evaluation case" value={outlineSelection} onChange={event => setOutlineSelection(event.target.value)}>
          <option value="">Choose an imported evaluation case</option>
          {state.evaluationCases.filter(item => item.reportJobId).map(item => <option key={item.evaluationCaseId} value={item.reportJobId ?? ""}>{item.displayName} · {item.reportReference ?? item.evaluationCaseId}</option>)}
        </select></label>
        <button className="toolbar-button toolbar-button-primary" type="button" disabled={!outlineSelection} onClick={() => setOutlineReportId(outlineSelection)}>Review outlines and evidence</button>
        {!state.evaluationCases.some(item => item.reportJobId) ? <p>Prepare and import a Capture Variant in Truth &amp; Mock Data to make an evaluation case available.</p> : null}
      </section> : null}
      {outlineReportId ? <SectionPlanningPanel reportJobId={outlineReportId} canEdit onClose={() => setOutlineReportId("")} /> : null}
      {view === "mock" ? <MockPreparationEvaluation /> : null}
      {view === "classification" ? <ContentsClassificationEvaluation onBack={() => setView("mock")} /> : null}
      {!loading && state && view === "sources" ? (
        <ApprovedSources
          documents={filteredDocuments}
          onContinue={() => setView("truth")}
          onSearch={setSearch}
          onSelect={setSelectedDocumentId}
          search={search}
          selected={selectedDocument}
          state={state}
        />
      ) : null}
      {!loading && state && view === "truth" ? (
        truthStageMode === "source"
          ? <TruthCaseBuilder initialDocumentId={selectedDocument?.documentId ?? ""} onApproved={(truthCaseId) => { setApprovedTruthCaseId(truthCaseId); setTruthStageMode("capture"); }} />
          : <CaptureVariantBuilder initialTruthCaseId={approvedTruthCaseId} onBack={() => setTruthStageMode("source")} onContinue={() => setView("runs")} />
      ) : null}
      {!loading && state && view === "runs" ? (
        <EvaluationRuns
          busy={baselineBusy}
          cases={state.evaluationCases}
          enabled={evaluationEnabled}
          error={error}
          onOpenSetup={() => { setTruthStageMode("capture"); setView("truth"); }}
          onRetry={() => { setError(""); setEvaluationEnabled(true); void refresh({ silent: true }); }}
          onToggle={() => setEvaluationEnabled((current) => !current)}
        />
      ) : null}
      {view === "policy" ? (
        <LivePolicy
          busy={policyBusy}
          error={policyError}
          heldOutReview={heldOutReview}
          labState={state}
          onPrepareHeldOut={() => { setTruthStageMode("source"); setView("sources"); }}
          onPromote={promote}
          onRefresh={refreshPolicy}
          onRollback={rollback}
          onRunHeldOut={runHeldOut}
          onOpenSection={openHeldOutSection}
          status={policyStatus}
        />
      ) : null}
    </main>
  );
}

function StageButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button className={active ? "eval-lab-nav-button active" : "eval-lab-nav-button"} onClick={onClick} type="button">{label}</button>;
}

function ApprovedSources({
  documents,
  onContinue,
  onSearch,
  onSelect,
  search,
  selected,
  state,
}: {
  documents: EvaluationLabDocument[];
  onContinue: () => void;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
  search: string;
  selected: EvaluationLabDocument | null;
  state: EvaluationLabState;
}) {
  return (
    <section className="eval-live-stage">
      <div className="eval-page-heading">
        <div><p className="eyebrow">Stage 1 · Approved Sources</p><h2>Select an approved KB document</h2><p>Only sources approved in Knowledge Base Review appear here. No filesystem inventory or fixture report is added.</p></div>
      </div>
      <div className="eval-live-summary">
        <LiveStat label="Approved sources" value={state.summary.approvedKbDocuments} />
        <LiveStat label="Training references" value={state.summary.trainingReferences} />
        <LiveStat label="Evaluation gold" value={state.summary.evaluationGoldDocuments} />
        <LiveStat label="Evidence pairs" value={state.summary.linkedEvaluationCases} />
      </div>
      {state.documents.length === 0 ? (
        <LiveEmpty title="No approved KB sources" detail="Review and approve a historical source before creating an evaluation." />
      ) : (
        <div className="eval-live-source-grid">
          <section className="eval-live-list">
            <input aria-label="Search approved KB sources" onChange={(event) => onSearch(event.target.value)} placeholder="Search approved sources" type="search" value={search} />
            <div>
              {documents.map((document) => (
                <button className={document.documentId === selected?.documentId ? "selected" : ""} key={document.documentId} onClick={() => onSelect(document.documentId)} type="button">
                  <span><strong>{document.displayName}</strong><small>{humanize(document.reportFamily)}</small></span>
                  <span><small>{document.chunkCount} chunks</small><PurposePill document={document} /></span>
                </button>
              ))}
            </div>
          </section>
          {selected ? (
            <aside className="eval-live-detail">
              <p className="eyebrow">Approved KB source</p>
              <h3>{selected.displayName}</h3>
              <dl>
                <Detail label="Purpose" value={selected.purpose === "evaluation_gold" ? "Evaluation gold" : "Training reference"} />
                <Detail label="Dataset split" value={humanize(selected.datasetSplit)} />
                <Detail label="Sections / chunks" value={`${selected.sectionCount} / ${selected.chunkCount}`} />
                <Detail label="Extraction quality" value={formatQualityScore(selected.qualityScore)} />
                <Detail label="Source object" value={selected.sourceStored ? "Stored" : "Missing"} />
                <Detail label="Evaluation state" value={formatReadiness(selected.readiness)} />
              </dl>
              <p>{selected.purpose === "training_reference"
                ? "This source may guide retrieval but cannot be used as the hidden answer in an evaluation."
                : "This source is isolated from retrieval and may be linked to matching app evidence."}</p>
              <button className="toolbar-button toolbar-button-primary" onClick={onContinue} type="button">Continue to Truth Case Builder</button>
            </aside>
          ) : null}
        </div>
      )}
    </section>
  );
}

function EvaluationRuns({ busy, cases, enabled, error, onOpenSetup, onRetry, onToggle }: { busy: boolean; cases: EvaluationLabCase[]; enabled: boolean; error: string; onOpenSetup: () => void; onRetry: () => void; onToggle: () => void }) {
  const totalEpisodes = cases.reduce((sum, item) => sum + item.enabledSectionCount, 0);
  const completedEpisodes = cases.reduce((sum, item) => sum + Math.min(item.evalRunCount, item.enabledSectionCount), 0);
  const progressPercent = totalEpisodes === 0 ? "0" : ((completedEpisodes / totalEpisodes) * 100).toFixed(completedEpisodes < totalEpisodes ? 1 : 0);
  const activeCase = cases.find((item) => item.nextSectionId && item.reportJobId) ?? null;
  const groups = [...cases.reduce((index, item) => {
    const group = index.get(item.profileCode) ?? { code: item.profileCode, name: item.profileDisplayName, cases: [] as EvaluationLabCase[] };
    group.cases.push(item);
    index.set(item.profileCode, group);
    return index;
  }, new Map<string, { code: string; name: string; cases: EvaluationLabCase[] }>()).values()];
  return (
    <section className="eval-live-stage">
      <div className="eval-page-heading"><div><p className="eyebrow">Stage 3 · Evaluation Runs</p><h2>Compare generated reports with the golden standard</h2><p>{busy ? "Automatic offline evaluation is running. You can leave this page; saved episodes remain available." : "Each completed mock dataset is paired with its approved Truth Graph and evaluated automatically."}</p></div></div>
      <div className="eval-run-progress" aria-live="polite">
        <div className="eval-run-progress-heading">
          <div><strong>{completedEpisodes} of {totalEpisodes} evaluations complete</strong><span>{progressPercent}%</span></div>
          <small>{busy && activeCase ? `Running ${activeCase.displayName} · ${humanize(activeCase.nextSectionId ?? "")}` : completedEpisodes < totalEpisodes ? enabled ? "Preparing the next saved episode" : "Paused — press Start evaluation to continue" : "All baseline evaluations complete"}</small>
        </div>
        <progress aria-label="Automatic baseline evaluation progress" max={Math.max(totalEpisodes, 1)} value={completedEpisodes} />
        <div className="eval-run-policy-note">
          <strong>No setup required</strong>
          <span>Capture style supplies the test condition. Each numbered variation is a reproducible version of that style: it changes which optional facts are captured, their order, and permitted voice/noise effects while preserving required and protected facts. The golden Truth Graph is used only after generation for scoring.</span>
        </div>
        <div className="eval-run-controls">
          {completedEpisodes < totalEpisodes ? <button className="toolbar-button toolbar-button-primary" onClick={onToggle} type="button">{enabled ? "Pause evaluation" : completedEpisodes > 0 ? "Resume evaluation" : "Start evaluation"}</button> : null}
          {error ? <button className="toolbar-button" onClick={onRetry} type="button">Retry failed episode</button> : null}
        </div>
      </div>
      {cases.length === 0 ? (
        <LiveEmpty title="No test datasets ready" detail="Create and validate mock datasets first. Golden-standard pairing happens automatically."><button className="toolbar-button toolbar-button-primary" onClick={onOpenSetup} type="button">Create test datasets</button></LiveEmpty>
      ) : (
        <div className="eval-style-groups">
          {groups.map((group) => <CaptureStyleGroup group={group} key={group.code} />)}
        </div>
      )}
    </section>
  );
}

function CaptureStyleGroup({ group }: { group: { code: string; name: string; cases: EvaluationLabCase[] } }) {
  const completed = group.cases.reduce((sum, item) => sum + item.evalRunCount, 0);
  const total = group.cases.reduce((sum, item) => sum + item.enabledSectionCount, 0);
  const completeDatasets = group.cases.filter((item) => !item.nextSectionId).length;
  return <details className="eval-style-group" open>
    <summary>
      <div><p className="eyebrow">Capture style</p><h3>{group.name}</h3><span>{group.cases.length} mock datasets · {completeDatasets} complete</span></div>
      <div><strong>{completed} / {total}</strong><span>section evaluations</span></div>
    </summary>
    <div className="eval-dataset-grid">
      {group.cases.map((item) => <DatasetEvaluationCard item={item} key={item.evaluationCaseId} />)}
    </div>
  </details>;
}

function DatasetEvaluationCard({ item }: { item: EvaluationLabCase }) {
  const percent = item.enabledSectionCount ? Math.round((item.evalRunCount / item.enabledSectionCount) * 100) : 0;
  const status = item.blockedEpisodeCount > 0 ? "Contract blocked" : item.nextSectionId ? item.evalRunCount ? "Running" : "Ready" : item.qualityIssueCount > 0 ? "Complete with issues" : "Complete";
  return <article className="eval-dataset-card">
    <div className="eval-dataset-title"><div><strong>Variation {item.deterministicSeed}</strong><span>{item.reportReference ?? item.evaluationCaseId}</span></div><span className={`eval-dataset-status ${status.toLowerCase().replace(/\s+/g, "-")}`}>{status}</span></div>
    <progress max={Math.max(item.enabledSectionCount, 1)} value={item.evalRunCount} />
    <dl>
      <Detail label="Progress" value={`${item.evalRunCount} / ${item.enabledSectionCount} · ${percent}%`} />
      <Detail label="Recovery" value={formatPercent(item.meanRequiredFactRecall)} />
      <Detail label="Claim precision" value={formatPercent(item.meanClaimPrecision)} />
      <Detail label="Protected facts" value={formatPercent(item.meanProtectedFactAccuracy)} />
      <Detail label="RL reward" value={formatPercent(item.meanReward)} />
      <Detail label="Quality issues" value={String(item.qualityIssueCount)} />
    </dl>
    <small>{item.nextSectionId ? `Next: ${humanize(item.nextSectionId)}` : `Completed ${item.latestEvalAtIso ? formatDate(item.latestEvalAtIso) : ""}`}</small>
  </article>;
}

function LivePolicy({ busy, error, heldOutReview, labState, onPrepareHeldOut, onPromote, onRefresh, onRollback, onRunHeldOut, onOpenSection, status }: { busy: boolean; error: string; heldOutReview: SystemRlHeldOutReview | null; labState: EvaluationLabState | null; onPrepareHeldOut: () => void; onPromote: (id: string) => void; onRefresh: () => void; onRollback: (id: string) => void; onRunHeldOut: (documentId: string) => void; onOpenSection: (evaluationCaseId: string, sectionId: string) => void; status: SystemRlStatus | null }) {
  const [selectedReportId, setSelectedReportId] = useState("");
  if (heldOutReview?.evaluationOnly) return <section className="eval-live-stage">
    <div className="eval-page-heading"><div><p className="eyebrow">Report generation evaluation</p><h2>Original, generated and app evidence</h2><p>{heldOutReview.evaluationDisplay?.subtitle ?? (heldOutReview?.sectionAgentEvaluation ? "General Tank Information · 10 development reports + 1 held-out test · no AI calls" : heldOutReview?.comparisonExperiment ? `${heldOutReview.comparisonExperiment.name} · identical current inputs · saved AI responses` : heldOutReview?.generationBackend?.startsWith("tk5452_") ? "21-section paired backend · source-aligned mock capture · inspector review" : "12-section outline backend · saved generation results · inspector review")}</p></div><button className="toolbar-button" disabled={busy} onClick={onRefresh} type="button">Refresh</button></div>
    {error ? <div className="eval-live-feedback error">{error}</div> : null}
    <HeldOutReview busy={busy} onOpenSection={onOpenSection} review={heldOutReview} />
  </section>;
  const candidate = status?.policies.find((item) => item.statusCode === "training") ?? null;
  const trainingCases = labState?.evaluationCases.filter((item) => item.datasetSplit !== "hidden_test") ?? [];
  const heldOutCases = labState?.evaluationCases.filter((item) => item.datasetSplit === "hidden_test") ?? [];
  const trainingComplete = trainingCases.length > 0 && trainingCases.every((item) => !item.nextSectionId);
  const trainingGoldIds = new Set(trainingCases.map((item) => item.goldDocumentId));
  const learnedReportFamily = [...trainingCases.reduce((counts, item) => counts.set(item.reportFamily, (counts.get(item.reportFamily) ?? 0) + 1), new Map<string, number>())]
    .sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
  const hiddenReports = labState?.documents.filter((item) => item.purpose === "evaluation_gold" && item.datasetSplit === "hidden_test" && item.readiness !== "reference_only" && !trainingGoldIds.has(item.documentId)) ?? [];
  const availableReports = hiddenReports.filter((item) => !learnedReportFamily || reportFamiliesCompatible(learnedReportFamily, item.reportFamily));
  const incompatibleReportCount = hiddenReports.length - availableReports.length;
  const selectedId = availableReports.some((item) => item.documentId === selectedReportId) ? selectedReportId : availableReports[0]?.documentId ?? "";
  const bestArm = candidate?.arms.filter((arm) => arm.eligibleEpisodeCount > 0).sort((left, right) => (right.meanReward ?? -1) - (left.meanReward ?? -1))[0] ?? null;
  const automaticGatesPass = candidate ? isPromotionReady(candidate) : false;
  const heldOutGatePass = heldOutReview?.promotionGate?.eligible === true;
  const promotionReady = automaticGatesPass && heldOutGatePass;
  return (
    <section className="eval-live-stage">
      <div className="eval-page-heading"><div><p className="eyebrow">Stage 4 · Policy Registry</p><h2>Test the candidate policy with a new report</h2><p>Select a new report from the same report family. The backend creates one random mock variation, generates every matching section with the frozen policy, and evaluates it against hidden truth.</p></div><button className="toolbar-button" disabled={busy} onClick={onRefresh} type="button">Refresh</button></div>
      {error ? <div className="eval-live-feedback error">{error}</div> : null}
      {!status ? <LiveEmpty title={busy ? "Loading policy" : "Policy unavailable"} detail="No policy state has been returned by the backend." /> : (
        <>
          <div className="eval-policy-test-launch">
            <label><span>New held-out report</span><select disabled={busy || availableReports.length === 0} onChange={(event) => setSelectedReportId(event.target.value)} value={selectedId}>{availableReports.map((report) => <option key={report.documentId} value={report.documentId}>{report.displayName}</option>)}</select></label>
            <div><strong>{candidate ? `Pre-selected policy: ${candidate.displayName}` : "Candidate policy is not ready"}</strong><span>{learnedReportFamily ? `Learned report family: ${humanize(learnedReportFamily)}. ` : ""}The frozen selector chooses its best approved RAG setup. Capture variation is randomly selected and saved for reproducibility.{incompatibleReportCount > 0 ? ` ${incompatibleReportCount} incompatible hidden report(s) are excluded.` : ""}</span></div>
            {availableReports.length > 0 ? <button className="toolbar-button toolbar-button-primary" disabled={busy || !selectedId || !trainingComplete || !candidate} onClick={() => onRunHeldOut(selectedId)} type="button">{busy ? "Generating and evaluating…" : "Run automatic test"}</button> : <button className="toolbar-button toolbar-button-primary" onClick={onPrepareHeldOut} type="button">Add a new hidden-test report</button>}
          </div>
          {heldOutReview?.available && heldOutReview.allSectionsComplete ? <HeldOutReview busy={busy} onOpenSection={onOpenSection} review={heldOutReview} /> : (
            <LiveEmpty title={busy ? "Generating every section" : "Final-output review is waiting"} detail={busy ? "The backend is generating and evaluating all sections. The review will open only when the complete set is synchronized." : heldOutReview?.available ? `${heldOutReview.sections?.filter((section) => section.completed).length ?? 0} of ${heldOutReview.sections?.length ?? 0} sections are complete.` : heldOutReview?.reason ?? "Complete an evaluation to compare its original content and generated output."} />
          )}
          <div className="eval-live-policy-actions">
            <button className="toolbar-button toolbar-button-primary" disabled={busy || !candidate || !promotionReady} onClick={() => candidate && onPromote(candidate.policyVersionId)} type="button">Promote candidate</button>
            {status.policies.filter((item) => item.statusCode === "archived").map((item) => <button className="toolbar-button" disabled={busy} key={item.policyVersionId} onClick={() => onRollback(item.policyVersionId)} type="button">Restore version {item.versionNumber}</button>)}
            <span>{promotionReady ? "The new-report inspector-review readiness and automatic promotion gates pass." : automaticGatesPass ? heldOutReview?.promotionGate?.reasons.join(" ") || "A complete review-ready new-report hidden test is required." : "Candidate remains offline until automatic and new-report held-out gates pass."}</span>
          </div>
        </>
      )}
    </section>
  );
}

function HeldOutReview({ busy, onOpenSection, review }: { busy: boolean; onOpenSection: (evaluationCaseId: string, sectionId: string) => void; review: SystemRlHeldOutReview }) {
  const [generationView, setGenerationView] = useState<"ai" | "retained">("ai");
  const [reviewView, setReviewView] = useState<"comparison" | SectionAgentMonitoringView>(review.agentMonitoring ? "review" : "comparison");
  useEffect(() => {
    setGenerationView("ai");
    setReviewView(review.agentMonitoring ? "review" : "comparison");
  }, [review.evaluationCaseId, review.sectionId]);
  const showsCandidate = generationView === "ai" && Boolean(review.aiCandidateContent);
  const displayedGeneration = showsCandidate ? review.aiCandidateContent ?? "" : review.generatedContent ?? "";
  const inputStatus = review.inputReadiness?.sections.find(section => section.sectionId === review.sectionId);
  const missingInput = inputStatus?.status === "missing";
  const metrics = review.metrics;
  const isPlanningRun = Boolean(review.sectionPlanEvaluation?.contractVersion) || review.generatorContractVersion?.startsWith("section_planned_generation_") === true;
  const isPlanningDiagnostic = isPlanningRun && (review.benchmarkStatus === "diagnostic_unreviewed_obligations" || review.sectionPlanEvaluation?.denominatorSource !== "independent_expected_obligations");
  const resultLabel = metrics?.hardFailure ? "Blocked · critical integrity" : metrics ? sectionOutcomeLabel(metrics.outcomeCode, false) : "Evaluated";
  const currentValue = reviewSectionValue(review.evaluationCaseId ?? "", review.sectionId ?? "");
  const heading = <div className="eval-heldout-review-heading"><div><p className="eyebrow">Human review · {review.sectionTitle ?? humanize(review.sectionId ?? "section")}</p><h3>{review.reportName}</h3><small>{review.sections?.length ?? 0} evaluated {review.evaluationDisplay?.unitLabel ?? (review.sectionAgentEvaluation ? "reports" : review.comparisonExperiment?.unitLabel ?? "sections")} · {review.evaluationDisplay?.backendLabel ?? (review.sectionAgentEvaluation ? "section agent evaluation" : review.evaluationOnly ? (review.generationBackend?.startsWith("tk5452_") ? "paired evaluation backend" : "generic-outline backend") : `latest ${humanize(review.datasetSplit ?? "training")} cohort`)}</small></div><div className="eval-review-navigation"><select aria-label="Review section" disabled={busy} onChange={(event) => { const [evaluationCaseId, sectionId] = parseReviewSectionValue(event.target.value); if (evaluationCaseId && sectionId) onOpenSection(evaluationCaseId, sectionId); }} value={currentValue}>{review.sections?.map((section) => <option key={`${section.evaluationCaseId}:${section.sectionId}`} value={reviewSectionValue(section.evaluationCaseId, section.sectionId)}>{sectionOutcomeLabel(section.outcomeCode, section.hardFailure)} · {section.reportName} · {section.sectionTitle ?? humanize(section.sectionId)}</option>)}</select><button className="toolbar-button" disabled={busy || !review.previousSectionId || !review.previousEvaluationCaseId} onClick={() => review.previousEvaluationCaseId && review.previousSectionId && onOpenSection(review.previousEvaluationCaseId, review.previousSectionId)} type="button">Previous</button><button className="toolbar-button toolbar-button-primary" disabled={busy || !review.nextSectionId || !review.nextEvaluationCaseId} onClick={() => review.nextEvaluationCaseId && review.nextSectionId && onOpenSection(review.nextEvaluationCaseId, review.nextSectionId)} type="button">{review.sectionAgentEvaluation ? "Next report" : "Next section"}</button>{review.sourcePdfUrl || review.goldDocumentId ? <button className="toolbar-button" onClick={() => window.open(`${review.sourcePdfUrl ?? `/api/v1/admin/kb-review/documents/${encodeURIComponent(review.goldDocumentId ?? "")}/source`}#page=${review.sourcePageNumber ?? 1}`, "_blank", "noopener,noreferrer")} type="button">Preview original PDF</button> : null}<span>{metrics?.score != null ? `${Math.round(metrics.score * 100)}% · ${resultLabel}` : resultLabel}</span></div></div>;
  const monitoringTabs = review.agentMonitoring ? <nav aria-label="Evaluation review views" className="agent-monitoring-tabs">
    {([
      ["review", "Segment review"],
      ["comparison", "Whole section"],
      ["timeline", "Run trace"],
      ["evidence", "Evidence routing"],
      ["matrix", "Scores"],
      ["control", "Versions"],
    ] as Array<["comparison" | SectionAgentMonitoringView, string]>).map(([value, label]) => <button aria-pressed={reviewView === value} className={reviewView === value ? "active" : ""} key={value} onClick={() => setReviewView(value)} type="button">{label}</button>)}
  </nav> : null;
  if (review.agentMonitoring && reviewView !== "comparison") return <section className="eval-heldout-review">
    {heading}
    {monitoringTabs}
    <SectionAgentMonitoring currentSectionId={review.sectionId} monitoring={review.agentMonitoring} view={reviewView} />
  </section>;
  return <section className="eval-heldout-review">
    {heading}
    {monitoringTabs}
    {review.revisionChoices?.length ? <label className="eval-reference-choice">Evaluation run <select aria-label="Evaluation run" disabled={busy} value={review.evaluationCaseId} onChange={event => { const choice = review.revisionChoices?.find(item => item.evaluationCaseId === event.target.value); const sectionId = choice?.sectionIds && !choice.sectionIds.includes(review.sectionId ?? "") ? choice.sectionIds[0] : review.sectionId ?? "identity"; onOpenSection(event.target.value, sectionId); }}>{review.revisionChoices.map(choice => <option key={choice.evaluationCaseId} value={choice.evaluationCaseId}>{choice.label}</option>)}</select></label> : null}
    {review.comparisonExperiment ? <div className="eval-generation-view" role="group" aria-label="KB comparison"><strong>Same mock inputs</strong>{review.revisionChoices?.filter(choice => review.comparisonExperiment?.caseIds ? review.comparisonExperiment.caseIds.includes(choice.evaluationCaseId) : choice.sectionIds?.length === 2).map(choice => <button key={choice.evaluationCaseId} type="button" className={`toolbar-button${review.evaluationCaseId === choice.evaluationCaseId ? " toolbar-button-primary" : ""}`} aria-pressed={review.evaluationCaseId === choice.evaluationCaseId} disabled={busy} onClick={() => onOpenSection(choice.evaluationCaseId, review.sectionId ?? "01-scope")}>{choice.label.replace(/^(Same mock|12 observations) · /, "")}</button>)}<span>{review.comparisonExperiment.wordCount} words · {review.comparisonExperiment.modelId}</span></div> : null}
    {review.referenceChoices?.length ? <label className="eval-reference-choice">Original report <select aria-label="Original report" disabled={busy} value={review.evaluationCaseId} onChange={event => onOpenSection(event.target.value, review.sectionId ?? "identity")}>{review.referenceChoices.map(choice => <option key={choice.evaluationCaseId} value={choice.evaluationCaseId}>{choice.label}</option>)}</select></label> : null}
    {review.diagnosticNotes?.length ? <div className="eval-live-feedback"><strong>Comparison context</strong><p>{review.diagnosticNotes[0]}</p>{review.diagnosticNotes.length > 1 ? <details><summary>Section notes and generation status</summary><ul>{review.diagnosticNotes.slice(1).map((note, index) => <li key={index}>{note}</li>)}</ul></details> : null}</div> : null}
    <p>{humanize(review.datasetSplit ?? "unknown")} result · {review.createdAtIso ? formatDate(review.createdAtIso) : "Unknown date"}{review.evaluationDisplay?.referenceLabel ? ` · ${review.evaluationDisplay.referenceLabel}` : review.referenceRevision ? ` · Source pages ${review.referenceRevision.pages.join(", ")}` : " · Legacy extracted reference"}</p>
    {isPlanningDiagnostic ? <div className="eval-live-feedback"><strong>Planning diagnostic — benchmark labels await review</strong><p>Coverage measures the frozen section requirements. Independent source review is still needed to establish benchmark completeness and routing accuracy.</p></div> : null}
    {review.captureAvailability ? <div className="eval-live-feedback">
      <strong>{isPlanningRun ? `${review.captureAvailability.capturedFactCount} section requirements` : `${review.captureAvailability.capturedFactCount} captured facts`} · {review.captureAvailability.withheldFactCount} withheld facts</strong>
      <p>{isPlanningRun ? "Section coverage counts required output items. Supporting records are excluded from this requirement count." : review.captureAvailability.denominator}</p>
      <details><summary>Evidence withheld from this capture</summary><ul>{review.captureAvailability.withheldFacts.map((fact) => <li key={fact.factId}>{fact.text || fact.factId}</li>)}</ul></details>
      {review.captureAvailability.omittedCapturedFacts.length ? <details><summary>{isPlanningRun ? "Section requirements omitted from the output" : "Captured evidence omitted from the output"}</summary><ul>{review.captureAvailability.omittedCapturedFacts.map((fact) => <li key={fact.factId}>{fact.text || fact.factId}</li>)}</ul></details> : null}
    </div> : null}
    {review.evidenceReview?.available ? <div className={`eval-automated-review ${review.evidenceReview.verdict}`}><strong>Semantic evidence check: {humanize(review.evidenceReview.verdict)}</strong><p>Overall draft readiness also requires captured-fact preservation, completeness, and formatting.</p><p>{review.evidenceReview.assessment}</p><ul>{[...review.evidenceReview.missingEvidence, ...review.evidenceReview.unsupportedStatements].map((reason, index) => <li key={index}>{reason}</li>)}</ul></div> : null}
    {metrics?.hardFailure ? <div className="eval-live-feedback error"><strong>This draft is blocked.</strong> Correct the critical-data or evidence-isolation problem before inspector review. {metrics.hardFailureReasons.join(" ")}</div> : null}
    <div className="eval-heldout-review-grid">
      <article><strong>{review.evaluationDisplay?.originalColumnLabel ?? (review.benchmarkStatus === "paired_source_reconstruction" ? "Original section · Paired source" : isPlanningRun ? "Original section · Historical reference" : "Original section · Gold benchmark")}</strong>{review.evaluationDisplay?.originalMode === "source_pdf" && review.sourcePdfUrl ? <iframe aria-label={`Original source PDF · page ${review.sourcePageNumber ?? 1}`} src={`${review.sourcePdfUrl}#page=${review.sourcePageNumber ?? 1}&view=FitH`} title={`Original source PDF · ${review.sectionTitle ?? humanize(review.sectionId ?? "section")}`} /> : <SectionPagePreview evaluationOnly={review.evaluationOnly}><ReviewDocument empty="No original content is mapped to this section." text={cleanOriginalSection(review.originalSectionContent ?? "")} /></SectionPagePreview>}</article>
      <article><strong>{review.evaluationDisplay?.generationColumnLabel ?? `Generation · ${missingInput ? "Missing input" : showsCandidate ? "AI output for review" : "Retained draft"}`}</strong>
        {inputStatus && inputStatus.status !== "supplied" ? <div className="eval-input-gap" role="status"><strong>{missingInput ? "Not generated — mock input is missing" : "Partial section — additional inputs needed"}</strong><ul>{inputStatus.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div> : null}
        {review.aiCandidateContent ? <div className="eval-generation-view"><label>View <select aria-label="Generation view" value={generationView} onChange={event => setGenerationView(event.target.value as "ai" | "retained")}><option value="ai">AI output</option><option value="retained">Retained draft</option></select></label><p>{review.comparisonExperiment?.reviewOnlyProposals ? (showsCandidate ? "Experimental proposals: inspector review required. Mechanical checks do not establish technical correctness." : "Supplied observations only; proposed actions are shown in AI output.") : showsCandidate && !review.rawAiResponse?.accepted ? "Not accepted by automatic validation. Review this AI response against the evidence." : showsCandidate ? "AI wording accepted for inspector review." : "The retained draft uses captured wording where AI validation did not pass."}</p></div> : null}
        {!missingInput ? <>{review.comparisonExperiment?.reviewOnlyProposals ? <p>Source-bound observation · proposed actions remain separate and require review.</p> : <ProvenanceLegend html={displayedGeneration} aiWordingCount={review.evaluationOnly ? (showsCandidate || review.rawAiResponse?.accepted ? review.rawAiResponse?.findings.length ?? 0 : 0) : undefined} />}<SectionPagePreview evaluationOnly={review.evaluationOnly}><GeneratedExportPreview html={displayedGeneration} artifacts={review.companionArtifacts} /></SectionPagePreview></> : null}</article>
      <article className="eval-app-evidence"><strong>{review.evaluationDisplay?.evidenceColumnLabel ?? "Evidence from apps"}</strong><p className="eval-evidence-intro">Supplied notes and values used for this section. Additional sources are labelled separately.</p><AppEvidenceColumn evidence={review.appEvidence} /></article>
    </div>
    {review.sectionWorkflowEvaluation ? <SectionWorkflowEvaluationPanel evaluation={review.sectionWorkflowEvaluation} /> : null}
    {review.rawAiResponse ? <details className="eval-automated-review"><summary>AI response · {review.comparisonExperiment?.reviewOnlyProposals ? "proposals awaiting inspector review" : review.rawAiResponse.accepted ? "accepted wording" : "not accepted by automatic validation"}</summary><ol>{review.rawAiResponse.findings.map((finding, index) => <li key={index}>{finding.text}</li>)}</ol></details> : null}
    {metrics && !showsCandidate ? <div className="eval-review-points">
      <ReviewPoint label={review.evaluationDisplay?.evidenceMetricLabel ?? (review.sectionAgentEvaluation ? "Structured field preservation" : isPlanningRun ? "Section requirements" : "Captured-fact recovery")} value={metrics.requiredFactRecall} />
      <ReviewPoint label="Claim precision" value={metrics.claimPrecision} />
      <ReviewPoint label="Protected facts" value={metrics.protectedFactAccuracy} />
      <ReviewPoint label="Historical content coverage (diagnostic)" value={metrics.goldContentCoverage} />
      <ReviewPoint label="Output length balance" value={metrics.outputLengthBalance} />
      <ReviewPoint label="Format" value={metrics.formatMatch} />
      <ReviewPoint label="Historical replacement score (diagnostic)" value={metrics.professionalAcceptability} />
      {metrics.evaluationPoints.map((point) => <ReviewPoint key={point.key} label={point.label} value={point.score} />)}
    </div> : null}
    {metrics?.automatedReview ? <div className={`eval-automated-review ${metrics.automatedReview.verdict}`}><strong>Historical comparison (diagnostic): {humanize(metrics.automatedReview.verdict)}</strong><p>{metrics.automatedReview.assessment}</p>{metrics.automatedReview.reasons.length ? <ul>{metrics.automatedReview.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}</div> : null}
  </section>;
}

function SectionWorkflowEvaluationPanel({ evaluation }: { evaluation: NonNullable<SystemRlHeldOutReview["sectionWorkflowEvaluation"]> }) {
  const passed = evaluation.atomicRows.filter((row) => row.status === "pass").length;
  return <section className="eval-section-workflow-eval" aria-label="Candidate B evaluation details">
    <div className="eval-live-feedback success"><strong>Automated gates: {passed}/{evaluation.atomicRows.length} atomic fields passed</strong><p>{humanizeIdentifier(evaluation.candidateId)} · guard {humanizeIdentifier(evaluation.guardDecision)} · {humanizeIdentifier(evaluation.qualificationStatus)}</p></div>
    <div className="eval-review-points">{Object.entries(evaluation.sectionAssessment).map(([key, assessment]) => <div key={key}><span>{humanizeIdentifier(key)}</span><strong>{humanizeIdentifier(assessment.status)}</strong><small>{humanizeIdentifier(assessment.grader)}</small></div>)}</div>
    <details open><summary>Atomic field comparison ({passed}/{evaluation.atomicRows.length} passed)</summary><div className="eval-workflow-table-wrap"><table><thead><tr><th>Field</th><th>Expected</th><th>Generated</th><th>Result</th></tr></thead><tbody>{evaluation.atomicRows.map((row) => <tr key={row.unitId}><td>{humanizeIdentifier(row.key)}</td><td>{String(row.expectedValue ?? "—")}</td><td>{String(row.actualValue ?? "—")}</td><td><strong>{humanizeIdentifier(row.status)}</strong></td></tr>)}</tbody></table></div></details>
  </section>;
}

function AppEvidenceColumn({ evidence }: { evidence: SystemRlHeldOutReview["appEvidence"] }) {
  if (!evidence?.length) return <p className="eval-evidence-empty">No app evidence is available for this saved section.</p>;
  const labels: Record<string, string> = { app_voice: "App voice · mock transcript", app_field: "App structured data", report_side_input: "Report-side addition · source-derived", standard_template_fixture: "Standard template · evaluation fixture", historical_case: "Historical case · precedent only" };
  return <div className="eval-evidence-list">{evidence.map(item => <section className={`eval-evidence-card ${item.sourceClass}`} key={`${item.evidenceId}:${item.sourcePointer}`}>
    <span className="eval-evidence-source">{labels[item.sourceClass] ?? humanize(item.sourceClass)}</span>
    <h4>{item.label}</h4>{item.context ? <small>{item.context}</small> : null}
    <p>{item.text}</p>
    {item.processedText.length ? <details><summary>Statements supplied to this section ({item.processedText.length})</summary><ul>{item.processedText.map((text, index) => <li key={index}>{text}</li>)}</ul></details> : null}
    {item.issues.length ? <p className="eval-evidence-issue">Needs review: {item.issues.join("; ")}</p> : null}
    {!item.usedInGeneration ? <small>Not rendered in this section.</small> : null}
    <details><summary>Source record</summary><code>{item.sourcePointer}</code></details>
  </section>)}</div>;
}

function sectionOutcomeLabel(outcomeCode: string | null, hardFailure: boolean) {
  if (hardFailure || outcomeCode === "blocked" || outcomeCode === "fail_truth_contract") return "Blocked";
  if (outcomeCode === "ready_for_review" || outcomeCode === "pass") return "Ready for review";
  if (outcomeCode === "needs_attention" || outcomeCode === "fail_truth_recovery" || outcomeCode === "fail_semantic_recovery" || outcomeCode === "fail_format_contract") return "Needs attention";
  return "Not evaluated";
}

function reviewSectionValue(evaluationCaseId: string, sectionId: string) {
  return `${encodeURIComponent(evaluationCaseId)}::${encodeURIComponent(sectionId)}`;
}

function parseReviewSectionValue(value: string): [string, string] {
  const [evaluationCaseId = "", sectionId = ""] = value.split("::", 2);
  return [decodeURIComponent(evaluationCaseId), decodeURIComponent(sectionId)];
}

function ReviewPoint({ label, value }: { label: string; value: number | null }) { return <div><span>{label}</span><strong>{formatPercent(value)}</strong></div>; }
function ProvenanceLegend({ html, aiWordingCount }: { html: string; aiWordingCount?: number }) { const counts = provenanceCounts(html); if (aiWordingCount !== undefined) counts.llm_prediction = aiWordingCount; return <div className="eval-provenance-legend" aria-label="Generated content provenance"><span className="field">Structured field data · {counts.app_field_data}</span><span className="voice">Voice or note evidence · {counts.app_voice_data}</span><span className="prediction">LLM-generated wording · {counts.llm_prediction}</span><span className="template">Template structure · {counts.precedent_template}</span>{counts.calculation ? <span>Calculated summaries · {counts.calculation}</span> : null}</div>; }
function provenanceCounts(html: string) { const counts = { app_field_data: 0, app_voice_data: 0, llm_prediction: 0, precedent_template: 0, calculation: 0 }; for (const match of html.matchAll(/data-laiq-provenance=["']([^"']+)["']/g)) { const raw = match[1]; const key = (raw === "app_field" || raw === "reviewed_app_evidence" ? "app_field_data" : raw === "voice_note" || raw.startsWith("confirmed_scope_") ? "app_voice_data" : raw) as keyof typeof counts; if (key in counts) counts[key] += 1; } counts.precedent_template += [...html.matchAll(/data-report-format=["'][^"']+["']/g)].length; return counts; }
function SectionPagePreview({ children, evaluationOnly = false }: { children: React.ReactNode; evaluationOnly?: boolean }) { return <div className="eval-pdf-page"><div className="eval-pdf-page-header"><span>LAIQ INSPECTION REPORT</span><span>SECTION PREVIEW</span></div>{children}<div className="eval-pdf-page-footer"><span>{evaluationOnly ? "Evaluation section preview" : "Export-ready section preview"}</span><span>Page</span></div></div>; }
function ReviewDocument({ empty, text }: { empty: string; text: string }) {
  if (!text) return <div className="eval-review-scroll eval-review-document"><p>{empty}</p></div>;
  const blocks: Array<{ type: "text" | "table"; lines: string[] }> = [];
  const lines = text.split("\n").map((line) => line.trim());
  for (let index = 0; index < lines.length;) {
    if (!lines[index]) { index += 1; continue; }
    const isTableLine = (line: string) => line.startsWith("|") && line.endsWith("|");
    const type = isTableLine(lines[index]) ? "table" : "text";
    const group: string[] = [];
    while (index < lines.length && lines[index] && (type === "table" ? isTableLine(lines[index]) : !isTableLine(lines[index]))) group.push(lines[index++]);
    blocks.push({ type, lines: group });
  }
  return <div className="eval-review-scroll eval-review-document">{blocks.map((block, index) => {
    if (block.type === "table") {
      const rows = block.lines.map((line) => line.slice(1, -1).split("|").map((cell) => cell.trim())).filter((row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell)));
      const [header = [], ...body] = rows;
      return <div className="eval-review-table-wrap" key={index}><table><thead><tr>{header.map((cell, cellIndex) => <th key={cellIndex}>{cell}</th>)}</tr></thead><tbody>{body.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
    }
    const blockText = block.lines.join("\n");
    const first = block.lines[0] ?? "";
    const heading = block.lines.length === 1 && (/^\d+(?:\.\d+)*\s+[A-Z]/.test(first) || (first === first.toUpperCase() && first.length < 120));
    if (heading) return <h4 key={index}>{first}</h4>;
    return <div className="eval-review-paragraph" key={index}>{blockText.split("\n").map((line, lineIndex) => {
      const bullet = /^(?:[•▪-]|\d+[.)])\s*/.test(line);
      return bullet ? <div className="eval-review-bullet" key={lineIndex}>{line.replace(/^[•▪-]\s*/, "")}</div> : <p key={lineIndex}>{line}</p>;
    })}</div>;
  })}</div>;
}
function GeneratedExportPreview({ html, artifacts }: { html: string; artifacts?: SystemRlHeldOutReview["companionArtifacts"] }) {
  if (!html.trim()) return <div className="eval-review-scroll eval-export-preview"><p>No generated output.</p></div>;
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["section", "div", "h2", "h3", "h4", "p", "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td", "strong", "em", "u", "span", "br", "hr"],
    ALLOWED_ATTR: ["class", "data-laiq-provenance", "data-report-format", "colspan", "rowspan"],
  });
  return <div className="eval-review-scroll eval-export-preview"><div dangerouslySetInnerHTML={{ __html: sanitized }} />{artifacts?.length ? <div className="eval-companion-artifacts"><p className="eval-artifact-note">Verified photo and map previews · separate from generated section text</p>{artifacts.filter(artifact => /^data:image\/(?:png|jpeg|svg\+xml);base64,/.test(artifact.dataUri)).map(artifact => <figure key={artifact.artifactId}><img src={artifact.dataUri} alt={artifact.caption ?? artifact.title ?? "Inspection artifact"} /><figcaption>{artifact.caption ?? artifact.title}</figcaption></figure>)}</div> : null}</div>;
}
function cleanOriginalSection(value: string) { return value.replace(/\\n/g, "\n").replace(/\uFFFD/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(); }

function PolicySummary({ label, policy }: { label: string; policy: SystemRlPolicyStatus | null }) {
  return <article><p className="eyebrow">{label}</p><h3>{policy ? `Version ${policy.versionNumber}` : "Unavailable"}</h3><strong>{formatPercent(policy?.aggregate.meanReward)}</strong><span>{policy?.aggregate.eligibleEpisodeCount ?? 0} eligible episode(s)</span><small>{policy?.displayName ?? "No policy record"}</small></article>;
}

function PolicyMetric({ label, metricKey, policy }: { label: string; metricKey: string; policy: SystemRlPolicyStatus }) {
  const mean = policy.evaluationMetrics.means[metricKey];
  const observations = policy.evaluationMetrics.observations[metricKey] ?? 0;
  const required = policy.promotionGate.metricThresholds[metricKey as keyof typeof policy.promotionGate.metricThresholds];
  return <div><span>{label}</span><strong>{formatPercent(mean)}</strong><span>{observations}</span><span>{required == null ? "Monitor" : formatPercent(required)}</span></div>;
}

function LiveStat({ label, value }: { label: string; value: number }) { return <article><span>{label}</span><strong>{value}</strong></article>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function PurposePill({ document }: { document: EvaluationLabDocument }) { return <small className={`eval-live-purpose ${document.purpose}`}>{document.purpose === "evaluation_gold" ? "Evaluation gold" : "Training reference"}</small>; }
function LiveEmpty({ children, detail, title }: { children?: React.ReactNode; detail: string; title: string }) { return <div className="eval-live-empty"><strong>{title}</strong><span>{detail}</span>{children}</div>; }

function isPromotionReady(policy: SystemRlPolicyStatus) {
  const metricsPass = Object.entries(policy.promotionGate.metricThresholds).every(([key, required]) => {
    const value = policy.evaluationMetrics.means[key];
    return value != null && value >= Number(required);
  });
  return policy.aggregate.eligibleEpisodeCount >= policy.promotionGate.minimumEpisodes
    && (policy.aggregate.meanReward ?? 0) >= policy.promotionGate.minimumMeanReward
    && policy.aggregate.hardFailureCount <= policy.promotionGate.maximumHardFailures
    && policy.evaluationMetrics.humanReviewedEpisodeCount >= policy.promotionGate.minimumHumanReviewedEpisodes
    && policy.arms.every((arm) => arm.eligibleEpisodeCount > 0)
    && metricsPass;
}

function formatReadiness(value: EvaluationLabDocument["readiness"]) {
  if (value === "ready") return "Ready";
  if (value === "needs_app_package") return "Needs app package";
  return "Reference only";
}
function reportFamiliesCompatible(learnedFamily: string, heldOutFamily: string) {
  const apiStandardFamilies = new Set(["profile_3d_scan", "api653_internal_external"]);
  return learnedFamily === heldOutFamily || (apiStandardFamilies.has(learnedFamily) && apiStandardFamilies.has(heldOutFamily));
}
function humanize(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter: string) => letter.toUpperCase()); }
function humanizeIdentifier(value: string) { return humanize(value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/-/g, "_")); }
function shortId(value: string) { return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-5)}` : value; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function formatPercent(value: number | null | undefined) { return value == null ? "—" : `${Math.round(value * 100)}%`; }
function formatQualityScore(value: number) { return `${Math.round(value <= 1 ? value * 100 : value)}%`; }
