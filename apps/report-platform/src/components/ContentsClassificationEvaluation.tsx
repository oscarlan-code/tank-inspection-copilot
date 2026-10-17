import { useEffect, useMemo, useState } from "react";
import {
  loadContentsClassificationEvaluation,
  runManualContentsClassification,
  type ClassificationUse,
  type ContentsClassificationEvaluation as ClassificationState,
  type ContentsClassificationEvaluationRow,
  type ManualContentsClassificationResult,
} from "../lib/evaluationLabApi";

type ResultFilter = "all" | "attention" | ContentsClassificationEvaluationRow["result"];
type AuditFilter = "all" | NonNullable<ContentsClassificationEvaluationRow["auditCategory"]>;

export function ContentsClassificationEvaluation({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<ClassificationState | null>(null);
  const [datasetId, setDatasetId] = useState(initialDatasetId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [auditFilter, setAuditFilter] = useState<AuditFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manualText, setManualText] = useState("");
  const [manualRunning, setManualRunning] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualResult, setManualResult] = useState<ManualContentsClassificationResult | null>(null);

  async function refresh() {
    setLoading(true); setError("");
    try { setState(await loadContentsClassificationEvaluation(datasetId)); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load classification evaluation."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, [datasetId]);
  async function runManualTest() {
    setManualRunning(true); setManualError(""); setManualResult(null);
    try { setManualResult(await runManualContentsClassification(manualText)); }
    catch (runError) { setManualError(runError instanceof Error ? runError.message : "Unable to classify this note."); }
    finally { setManualRunning(false); }
  }
  function selectDataset(nextDatasetId: string) {
    setDatasetId(nextDatasetId);
    const url = new URL(window.location.href);
    if (nextDatasetId === "current") url.searchParams.delete("classificationDataset");
    else url.searchParams.set("classificationDataset", nextDatasetId);
    window.history.replaceState({}, "", url);
    setSelectedId(null); setResultFilter("all"); setTypeFilter("all"); setAuditFilter("all"); setSearch("");
  }
  const rows = state?.rows ?? [];
  const types = useMemo(() => [...new Set(rows.map((row) => row.evidenceType))].sort(), [rows]);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const resultMatch = resultFilter === "all" || (resultFilter === "attention" && row.result === "fail") || row.result === resultFilter;
      const typeMatch = typeFilter === "all" || row.evidenceType === typeFilter;
      const auditMatch = auditFilter === "all" || row.auditCategory === auditFilter;
      const text = [row.evidenceType, row.sourcePointer, row.atomizedUnit, row.feedback, row.classifierFeedback,
        row.auditCategoryLabel, row.auditRationale, row.auditRecommendedAction,
        ...row.sourceUnits.map((item) => item.originalReportText), ...row.expectedSections, ...row.predictedSections].join(" ").toLowerCase();
      return resultMatch && typeMatch && auditMatch && (!query || text.includes(query));
    });
  }, [auditFilter, resultFilter, rows, search, typeFilter]);
  const selected = selectedId ? rows.find((row) => row.rowId === selectedId) ?? null : null;

  if (loading) return <Message title="Loading Step 2 evaluation" detail="Reading sealed classification output and evaluator-only source traces." />;
  if (error) return <section className="classification-eval-stage"><div className="eval-live-feedback error">{error}</div><button className="toolbar-button" onClick={() => void refresh()} type="button">Retry</button></section>;
  if (!state?.available || !state.summary) return <Message title="No classification run available" detail={state?.message ?? "Run the classification evaluation first."} />;
  const summary = state.summary;
  const isBlindedChallenge = state.datasetId === "blinded-chatbox-100-v2";
  const reportGrounded = state.byEvaluationCategory?.find((item) => item.category === "report_grounded_deterministic_routing");
  const contractChecks = state.byEvaluationCategory?.find((item) => item.category === "contract_consistency");
  const narrative = state.byEvaluationCategory?.find((item) => item.category === "llm_narrative_classification");
  return <section className="classification-eval-stage">
    <div className="classification-eval-heading">
      <div><p className="eyebrow">Step 2 · Contents Classification Agent · evaluation only</p><h2>{isBlindedChallenge ? "Rephrased chatbox facts → report sections" : "App evidence atoms → report sections"}</h2>
        <p>{isBlindedChallenge ? `${state.report?.reportReference} · ${humanize(state.report?.variantId ?? "")}. Historical source units and gold labels were joined only after predictions were sealed.` : `${state.report?.reportReference} · Tank ${state.report?.tankNumber} · ${humanize(state.report?.variantId ?? "")}. Frozen gold labels were joined by evidence ID only after classification was sealed.`}</p>
        {state.classifier ? <small>{state.classifier.candidateId} · {state.classifier.promptVersion} · {state.classifier.modelId ?? "model not run"}</small> : null}</div>
      <div className="classification-heading-actions"><label className="classification-dataset-picker">Review dataset<select aria-label="Select classification review dataset" onChange={(event) => selectDataset(event.target.value)} value={datasetId}>{(state.datasets ?? [{ datasetId: "current", label: "Current app-export evaluation" }]).map((item) => <option key={item.datasetId} value={item.datasetId}>{item.label}</option>)}</select></label><button className="toolbar-button" onClick={onBack} type="button">Back to Step 1</button><button className="toolbar-button" onClick={() => void refresh()} type="button">Refresh</button></div>
    </div>

    {state.runMode === "preflight" ? <div className="classification-preflight-notice"><strong>Prepared preview</strong><span>The 92 voice atoms have not been sent to the LLM and are excluded from accuracy. Private voice gold remains hidden until predictions are sealed.</span></div> : null}

    <section className="classification-manual-test">
      <header><div><span>Manual test · your input</span><h3>Try an inspector voice note</h3><p>Only the text entered here is sent to GPT-5.6-sol. Each atomic voice claim receives zero or one primary route. A manual-input leakage guard replaces Android export authentication; the atomizer, classifier prompt, outline and classification guard are the same as the evaluation workflow. No report gold is supplied.</p></div><strong>{manualText.length}/4000</strong></header>
      <textarea aria-label="Manual inspector note" maxLength={4000} onChange={(event) => setManualText(event.target.value)} placeholder="Example: Roof access was through a spiral stairway attached to the northeast side of the shell." rows={4} value={manualText} />
      <div className="classification-manual-actions"><button className="toolbar-button primary" disabled={manualRunning || manualText.trim().length < 3} onClick={() => void runManualTest()} type="button">{manualRunning ? "Classifying…" : "Run guarded classification"}</button><button className="toolbar-button" disabled={manualRunning || (!manualText && !manualResult)} onClick={() => { setManualText(""); setManualResult(null); setManualError(""); }} type="button">Clear</button><span>This ad hoc test has no hidden gold, so it validates routing and guard behavior without producing an accuracy score.</span></div>
      {manualError ? <div className="eval-live-feedback error">{manualError}</div> : null}
      {manualResult ? <div className="classification-manual-result"><header><strong>{manualResult.atoms.length} atom(s) classified</strong><span>{manualResult.classifierCandidateId} · {manualResult.promptVersion} · {manualResult.modelId} · all structural guards passed</span></header>{manualResult.atoms.map((atom, index) => <article key={atom.evidenceId}><div><small>Atom {index + 1}</small><p>{atom.text}</p></div><div><small>Primary section/block use</small><UseList uses={atom.proposedUses} empty="No report section proposed" /><p>{atom.feedback}</p></div></article>)}</div> : null}
    </section>

    <div className="classification-stage-flow" aria-label="Classification evaluation workflow">
      {state.stages?.map((stage, index) => <article className={stage.status === "pass" || stage.status === "complete" ? "pass" : "attention"} key={stage.id}>
        <span>{index + 1}</span><div><small>{stage.label}</small><strong>{humanize(stage.status)}</strong><p>{stage.detail}</p></div></article>)}
    </div>

    {isBlindedChallenge && state.challengeSummary ? <div className="classification-summary challenge">
      <Stat label="Blinded text units" value={state.challengeSummary.unitCount} detail={`${state.challengeSummary.reportCount} other training reports · ${state.challengeSummary.batchCount} chatbox batches`} />
      <Stat label="Correct section" value={`${state.challengeSummary.sectionPass}/${state.challengeSummary.unitCount}`} detail={percent(state.challengeSummary.sectionAccuracy)} />
      <Stat label="Exact section + block" value={`${state.challengeSummary.exactPass}/${state.challengeSummary.unitCount}`} detail={percent(state.challengeSummary.exactAccuracy)} tone={state.challengeSummary.exactPass < state.challengeSummary.unitCount ? "attention" : ""} />
      <Stat label="Unrouted" value={state.challengeSummary.unrouted} detail="every atom received a guarded proposal" />
      <Stat label="Label leakage" value={state.challengeSummary.labelLeakageCount} detail="gold joined after prediction seal" />
    </div> : <div className="classification-summary">
      <Stat label="App evidence atoms" value={summary.atomCount} detail="all supported export types" />
      <Stat label="Report-grounded routes" value={`${reportGrounded?.passed ?? 0}/${reportGrounded?.evaluated ?? 0}`} detail="deterministic predictions checked against report gold" />
      <Stat label="Contract checks" value={`${contractChecks?.passed ?? 0}/${contractChecks?.evaluated ?? 0}`} detail="fixed app-to-outline behavior" />
      <Stat label="Voice LLM classification" value={narrative?.notRun ? "Not run" : narrative?.notMeasured ? "Gold review needed" : `${narrative?.passed ?? 0}/${narrative?.evaluated ?? 0}`} detail={`${narrative?.notRun ?? 0} waiting · ${narrative?.notMeasured ?? 0} not measured · ${narrative?.failed ?? 0} failed`} />
      <Stat label="Executed pass rate" value={percent(summary.binaryPassRate)} detail={`${summary.binaryEvaluatedCount} evaluated · ${summary.notRun} not run · ${summary.notMeasured} not measured`} />
      <Stat label="Actual failures" value={summary.failed} detail={`${summary.notMeasured} rows require canonical gold review`} tone={summary.failed || summary.notMeasured ? "attention" : ""} />
    </div>}

    {isBlindedChallenge && state.failureAudit ? <section className="classification-failure-audit" aria-label="Engineering failure audit">
      <header><div><span>Engineering triage · gold unchanged</span><h3>Why the 19 rows failed</h3><p>{state.failureAudit.mismatchRows} mismatches reduce to {state.failureAudit.uniqueIssueGroups} distinct issue patterns. This audit categorizes what to fix; it does not alter the frozen labels or the 81/100 baseline.</p></div><button className="toolbar-button" onClick={() => { setResultFilter("attention"); setAuditFilter("all"); }} type="button">Review all 19 rows</button></header>
      <div>{state.failureAudit.categories.map((item) => <button key={item.category} onClick={() => { setResultFilter("attention"); setAuditFilter(item.category); }} type="button"><strong>{item.count}</strong><span>{item.label}</span><small>{auditCategoryDetail(item.category)}</small></button>)}</div>
    </section> : null}

    <PerformanceCharts rows={rows} runMode={state.runMode ?? "preflight"} onSelectType={(type) => { setTypeFilter(type); setResultFilter("all"); }} />

    <details className="classification-type-summary"><summary>Coverage by evidence type · {state.byEvidenceType?.length ?? 0} types</summary>
      <div>{state.byEvidenceType?.map((item) => <article key={item.evidenceType}><strong>{humanize(item.evidenceType)}</strong><span>{item.total} total · {item.evaluated} evaluated</span><small>{item.passed} pass · {item.failed} fail · {item.notRun} not run · {item.notMeasured} not measured</small></article>)}</div>
    </details>

    <div className={`classification-toolbar${state.failureAudit ? " audited" : ""}`}>
      <label>Search<input aria-label="Search classification rows" onChange={(event) => setSearch(event.target.value)} placeholder="Evidence, section, source text or feedback" type="search" value={search} /></label>
      <label>Result<select aria-label="Filter classification result" onChange={(event) => setResultFilter(event.target.value as ResultFilter)} value={resultFilter}>
        <option value="all">All results</option><option value="attention">Failed only</option><option value="pass">Pass</option><option value="fail">Fail</option><option value="not_run">Not run</option><option value="not_measured">Not measured</option>
      </select></label>
      <label>Evidence type<select aria-label="Filter evidence type" onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}><option value="all">All evidence types</option>{types.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}</select></label>
      {state.failureAudit ? <label>Audit category<select aria-label="Filter failure audit category" onChange={(event) => { setAuditFilter(event.target.value as AuditFilter); if (event.target.value !== "all") setResultFilter("attention"); }} value={auditFilter}><option value="all">All audit categories</option>{state.failureAudit.categories.map((item) => <option key={item.category} value={item.category}>{item.label} ({item.count})</option>)}</select></label> : null}
      <strong>{visible.length} of {rows.length} rows</strong>
    </div>

    <div className="classification-table-wrap"><table className="classification-table" aria-label="Contents classification human review rows"><thead><tr>
      <th>#</th><th>Evidence type</th><th>{isBlindedChallenge ? "Chatbox transport" : "Original app record"}</th><th>{isBlindedChallenge ? "Rephrased input atom" : "Atomized unit"}</th><th>{isBlindedChallenge ? "Historical source unit · joined after seal" : "Gold source / provenance"}</th><th>Gold section/block label(s)</th><th>Predicted section/block label(s)</th><th>Result</th><th>{state.failureAudit ? "Audit / feedback" : "Feedback"}</th>
    </tr></thead><tbody>{visible.map((row) => <tr className={`${row.result}${selectedId === row.rowId ? " selected" : ""}`} key={row.rowId} onClick={() => setSelectedId(row.rowId)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") setSelectedId(row.rowId); }}>
      <td>{row.number}</td><td><strong>{humanize(row.evidenceType)}</strong><small>{humanize(row.atomizationMethod)}</small></td>
      <td><pre>{previewRecord(row.originalAppRecord)}</pre><small>{row.sourcePointer ?? "No app source"}</small></td>
      <td><p>{row.atomizedUnit || "No app atom"}</p>{row.sourceSpan ? <small>Characters {row.sourceSpan.start}–{row.sourceSpan.end}</small> : null}</td>
      <td>{row.result === "not_run" ? <em>Held privately until classification runs</em> : row.sourceUnits.length ? row.sourceUnits.map((unit) => <div className="classification-source" key={unit.sourceUnitId}><small>{unit.sourcePage == null ? (isBlindedChallenge ? "Historical unit" : "Page –") : `Page ${unit.sourcePage}`} · {humanize(unit.unitType)}</small><p>{unit.originalReportText}</p></div>) : <em>No traced source unit</em>}</td>
      <td>{row.result === "not_run" ? <em>Hidden until prediction is sealed</em> : <UseList uses={row.expectedUses} empty="No gold label" />}</td><td><UseList uses={row.predictedUses} empty={row.result === "not_run" ? "Classifier not run" : "Unassigned"} /></td>
      <td><Status value={row.result} review={row.humanReviewRequired} /></td><td><AuditFeedback row={row} /></td>
    </tr>)}</tbody></table></div>
    {selected ? <RowInspector isBlindedChallenge={isBlindedChallenge} row={selected} onClose={() => setSelectedId(null)} /> : null}
  </section>;
}

function RowInspector({ row, onClose, isBlindedChallenge }: { row: ContentsClassificationEvaluationRow; onClose: () => void; isBlindedChallenge: boolean }) {
  return <aside className="classification-row-inspector" aria-label={`Selected classification row ${row.number}`}><header><div><span>Selected row {row.number}</span><strong>{humanize(row.evidenceType)} · {humanize(row.result)}</strong></div><button type="button" onClick={onClose}>Close</button></header>
    <div><section><h3>{isBlindedChallenge ? "Chatbox transport" : "Original app record"}</h3><pre>{JSON.stringify(row.originalAppRecord, null, 2) ?? "No app record"}</pre><small>{row.sourcePointer}</small></section>
      <section><h3>{isBlindedChallenge ? "Rephrased input atom" : "Atomized unit"}</h3><p>{row.atomizedUnit || "No atom was produced."}</p><small>{humanize(row.atomizationMethod)}</small></section>
      <section><h3>Gold comparison</h3>{row.result === "not_run" ? <p>Evaluator-only gold is hidden until this classifier output exists and is sealed.</p> : <><small>Gold origin: {row.goldOrigins.map(humanize).join(", ")}</small>{row.sourceUnits.map((unit) => <p key={unit.sourceUnitId}><strong>{isBlindedChallenge ? "Historical source unit" : unit.sourcePage == null ? "App contract" : `Page ${unit.sourcePage}`}</strong> {unit.originalReportText}</p>)}<UseList uses={row.expectedUses} empty={row.goldDecision === "exclude" ? "Gold disposition: Exclude" : "Missing gold label"} /></>}<UseList uses={row.predictedUses} empty={row.classifierDecision === "excluded" ? "Predicted disposition: Exclude" : row.result === "not_run" ? "Classifier not run" : "No predicted label"} /><p>{row.feedback}</p>{row.auditCategory ? <div className="classification-audit-detail"><strong>{row.auditCategoryLabel}</strong><p>{row.auditRationale}</p><small>Next action: {row.auditRecommendedAction}</small><em>Engineering triage only · frozen gold and score unchanged</em></div> : null}</section>
    </div></aside>;
}

function AuditFeedback({ row }: { row: ContentsClassificationEvaluationRow }) {
  return <>{row.auditCategory ? <span className={`classification-audit-badge ${row.auditCategory}`}>{row.auditCategoryLabel}</span> : null}<p>{row.auditRationale ?? row.feedback}</p>{row.auditRecommendedAction ? <small>Next action: {row.auditRecommendedAction}</small> : null}<small>Gold origin: {row.goldOrigins.map(humanize).join(", ")}</small>{!row.auditCategory ? <small>{row.classifierFeedback}</small> : null}</>;
}

function UseList({ uses, empty }: { uses: ClassificationUse[]; empty: string }) {
  if (!uses.length) return <em>{empty}</em>;
  return <div className="classification-use-list">{uses.map((item, index) => <span key={`${item.sectionId}:${item.blockId}:${index}`}><strong>{humanize(item.sectionId)}</strong><small>{humanize(item.blockId)}{item.confidence != null ? ` · ${percent(item.confidence)}` : ""}</small></span>)}</div>;
}
function Status({ value, review }: { value: string; review: boolean }) { return <div className="classification-status-cell"><span className={`classification-status ${value}`}>{humanize(value)}</span>{review ? <small>LLM proposal approval required</small> : null}</div>; }
function Stat({ label, value, detail, tone = "" }: { label: string; value: string | number; detail: string; tone?: string }) { return <article className={tone}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }
function PerformanceCharts({ rows, runMode, onSelectType }: { rows: ContentsClassificationEvaluationRow[]; runMode: "preflight" | "live"; onSelectType: (type: string) => void }) {
  const categories = [
    { key: "pass", label: "Pass" }, { key: "fail", label: "Fail" }, { key: "not_run", label: "Not run" }, { key: "not_measured", label: "Not measured" },
  ] as const;
  const count = (items: ContentsClassificationEvaluationRow[], key: typeof categories[number]["key"]) => items.filter((row) => row.result === key).length;
  const total = rows.length || 1;
  const types = [...new Set(rows.map((row) => row.evidenceType))].sort().map((evidenceType) => {
    const typed = rows.filter((row) => row.evidenceType === evidenceType);
    return { evidenceType, total: typed.length, review: typed.filter((row) => row.humanReviewRequired).length,
      values: Object.fromEntries(categories.map(({ key }) => [key, count(typed, key)])) as Record<typeof categories[number]["key"], number> };
  });
  return <section className="classification-performance" aria-label="Classification performance charts">
    <header><div><span>Performance overview</span><h3>{runMode === "live" ? "Live classification results" : "Pipeline preflight results"}</h3></div>
      <p>{runMode === "live" ? "Bars compare every sealed prediction with its evaluator-only gold section/block label set." : "Deterministic outputs are evaluated. Unrun narrative atoms are shown separately and excluded from accuracy."}</p></header>
    <div className="classification-outcome-chart">
      <div className="classification-chart-label"><strong>All review rows</strong><span>{rows.length}</span></div>
      <div className="classification-stacked-bar" aria-label="Overall result distribution">{categories.map(({ key, label }) => {
        const value = count(rows, key); return value ? <i className={key} key={key} style={{ width: `${value / total * 100}%` }} title={`${label}: ${value}`} /> : null;
      })}</div>
      <div className="classification-chart-legend">{categories.map(({ key, label }) => <span key={key}><i className={key} />{label} <strong>{count(rows, key)}</strong></span>)}</div>
    </div>
    <div className="classification-type-bars">{types.map((item) => <button key={item.evidenceType} onClick={() => onSelectType(item.evidenceType)} type="button">
      <span className="classification-type-label"><strong>{humanize(item.evidenceType)}</strong><small>{item.total} rows · {item.review} require review</small></span>
      <span className="classification-stacked-bar">{categories.map(({ key, label }) => item.values[key] ? <i className={key} key={key} style={{ width: `${item.values[key] / item.total * 100}%` }} title={`${label}: ${item.values[key]}`} /> : null)}</span>
      <span className="classification-type-counts">{categories.filter(({ key }) => item.values[key]).map(({ key, label }) => <small key={key}>{label} {item.values[key]}</small>)}</span>
    </button>)}</div>
  </section>;
}
function Message({ title, detail }: { title: string; detail: string }) { return <section className="classification-message"><h2>{title}</h2><p>{detail}</p></section>; }
function initialDatasetId() {
  if (typeof window === "undefined") return "current";
  return new URLSearchParams(window.location.search).get("classificationDataset") ?? "current";
}
function auditCategoryDetail(category: string) {
  if (category === "gold_label_review") return "Review the evaluator label before tuning.";
  if (category === "outline_boundary") return "Clarify which block owns this fact.";
  if (category === "input_context_loss") return "Preserve missing component or field context.";
  return "Refine the classifier on development data.";
}
function percent(value: number) { return `${(value * 100).toFixed(1)}%`; }
function humanize(value: string) { return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function previewRecord(value: unknown) { const text = value == null ? "No app record" : typeof value === "string" ? value : JSON.stringify(value, null, 2); return text.length > 520 ? `${text.slice(0, 520)}…` : text; }

