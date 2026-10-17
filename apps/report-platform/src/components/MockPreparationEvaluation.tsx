import { useEffect, useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  loadMockPreparationEvaluation,
  type MockPreparationCalibrationRow,
  type MockPreparationEvaluation as MockPreparationEvaluationState,
  type MockPreparationRow,
} from "../lib/evaluationLabApi";

type ResultFilter = "attention" | "all" | "pass" | "llm_graded" | "fail" | "awaiting_llm" | "pending" | "excluded";
type MockColumnId = "number" | "variation" | "source" | "original" | "generated" | "grader" | "meaning" | "integrity" | "overall" | "feedback";
type GradeStat = { id: string; label: string; total: number; passed: number; flagged: number; passRate: number };
type GradeAnalytics = {
  total: number;
  passed: number;
  flagged: number;
  passRate: number;
  modelIds: string[];
  byVariant: GradeStat[];
  byEvidenceType: GradeStat[];
  matrix: Record<string, Record<string, GradeStat>>;
};

const mockColumns: Array<{ id: MockColumnId; label: string; minWidth: number; width: number }> = [
  { id: "number", label: "#", minWidth: 48, width: 56 },
  { id: "variation", label: "Mock variation", minWidth: 120, width: 150 },
  { id: "source", label: "Evidence type", minWidth: 150, width: 180 },
  { id: "original", label: "Truth text unit (original report)", minWidth: 300, width: 400 },
  { id: "generated", label: "Generated mockup text unit", minWidth: 320, width: 440 },
  { id: "grader", label: "Evaluator", minWidth: 130, width: 160 },
  { id: "meaning", label: "Meaning", minWidth: 100, width: 120 },
  { id: "integrity", label: "Integrity", minWidth: 100, width: 120 },
  { id: "overall", label: "Overall", minWidth: 100, width: 120 },
  { id: "feedback", label: "Feedback", minWidth: 360, width: 560 },
];

function defaultColumnWidths() {
  return Object.fromEntries(mockColumns.map((column) => [column.id, column.width])) as Record<MockColumnId, number>;
}

export function MockPreparationEvaluation() {
  const [state, setState] = useState<MockPreparationEvaluationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try { setState(await loadMockPreparationEvaluation()); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load mock-preparation evaluation."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  if (loading) return <SheetMessage title="Loading Step 1 evaluation" detail="Reading the reviewed truth units and saved mockup outputs. No model is being called." />;
  if (error) return <section className="eval-live-stage"><div className="eval-live-feedback error">{error}</div><button className="toolbar-button" onClick={() => void refresh()} type="button">Retry</button></section>;
  if (!state?.available || !state.summary || !state.case || !state.decision) return <SheetMessage title="No Step 1 dataset configured" detail={state?.message ?? "Configure a reviewed truth case before opening this view."} />;

  const pilot = state.pilot;
  const completeReport = state.fullReport?.available && state.fullReport.summary ? state.fullReport : null;
  const sourceUnitCount = completeReport?.sourceUnitCount ?? pilot?.sourceUnitCount ?? state.summary.sourceSemanticUnits;
  const atomicFactCount = pilot?.factCount ?? 0;
  const comparisonCount = completeReport?.summary?.comparisonCount ?? state.summary.totalRows;
  const passedCount = completeReport?.summary?.passed ?? state.summary.passedRows;
  const failedCount = completeReport?.summary?.failed ?? state.summary.failedRows;
  const pendingReviewCount = completeReport?.summary?.pendingHumanReview ?? state.summary.pendingRows;
  const openGateCount = state.graders?.filter((item) => item.status !== "pass").length ?? 0;
  const calibration = state.calibration;

  return <section className="eval-live-stage mock-eval-stage">
    <div className="mock-sheet-heading">
      <div>
        <p className="eyebrow">Step 1 · Mock Preparation Agent · evaluation only</p>
        <h2>Original-report truth units → mockup app evidence</h2>
        <p>Confirm that each generated mockup unit preserves the reviewed meaning of its source unit before this data is reused by section-generation evaluations.</p>
      </div>
      <button className="toolbar-button" onClick={() => void refresh()} type="button">Refresh</button>
    </div>

    <div className="mock-step-flow" aria-label="Step 1 truth-to-mockup workflow">
      <article><span>1</span><div><small>Source</small><strong>Original report</strong><p>{state.case.label}</p></div></article>
      <i aria-hidden="true">→</i>
      <article><span>2</span><div><small>Reviewed truth</small><strong>{sourceUnitCount} text units</strong><p>{atomicFactCount} atomic facts</p></div></article>
      <i aria-hidden="true">→</i>
      <article><span>3</span><div><small>Mockup output</small><strong>{comparisonCount} comparisons</strong><p>{state.summary.voiceVariants} controlled datasets</p></div></article>
      <i aria-hidden="true">→</i>
      <article className={failedCount ? "attention" : "pass"}><span>4</span><div><small>Evaluation</small><strong>{passedCount}/{comparisonCount} graded pass</strong><p>{failedCount} failed · {pendingReviewCount} await review</p></div></article>
    </div>

    <TextUnitWorkbook state={state} />

    <details className="mock-sheet-gates mock-eval-secondary">
      <summary>Step 1 control gates · {state.graders?.filter((item) => item.status === "pass").length ?? 0} passed · {openGateCount} open</summary>
      <div className="mock-sheet-table-wrap"><table className="mock-sheet-table mock-sheet-gate-table"><thead><tr><th>Gate</th><th>Status</th><th>Observed</th><th>Requirement</th></tr></thead><tbody>{state.graders?.map((grader) => <tr key={grader.id}><td>{humanize(grader.id)}</td><td><Status value={humanize(grader.status)} tone={grader.status === "pass" ? "pass" : grader.status === "fail" ? "fail" : "review"} /></td><td>{grader.observed}</td><td>{grader.expected}</td></tr>)}</tbody></table></div>
    </details>

    <details className="mock-sheet-gates mock-eval-secondary">
      <summary>Evaluator calibration · {calibration?.summary.matches ?? 0}/{calibration?.summary.judgments ?? 0} expected judgments matched</summary>
      <CalibrationWorkbook state={state} />
    </details>
  </section>;
}

function TextUnitWorkbook({ state }: { state: MockPreparationEvaluationState }) {
  const pilot = state.pilot;
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [variant, setVariant] = useState("all");
  const [unitType, setUnitType] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<MockColumnId, number>>(defaultColumnWidths);
  const rows = useMemo(() => state.fullReport?.available && state.fullReport.rows?.length
    ? state.fullReport.rows
    : buildTextUnitRows(state), [state]);
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((item) => {
      const matchesResult = filter === "all"
        || (filter === "attention" && item.result !== "pass")
        || (filter === "pass" && item.result === "pass")
        || (filter === "fail" && item.result === "fail")
        || (filter === "pending" && item.result === "pending")
        || (filter === "excluded" && item.result === "not_applicable")
        || (filter === "llm_graded" && item.gradingRoute === "llm_semantic")
        || (filter === "awaiting_llm" && item.gradingStatus === "awaiting_llm_semantic_grading");
      const matchesVariant = variant === "all" || item.variantId === variant;
      const matchesType = unitType === "all" || item.unitType === unitType;
      const matchesSearch = !query || [item.sourceUnitId, item.unitType, item.variantId,
        item.originalText, item.appEvidenceText, item.explanation].join(" ").toLowerCase().includes(query);
      return matchesResult && matchesVariant && matchesType && matchesSearch;
    });
  }, [filter, rows, search, unitType, variant]);
  const pageSize = Math.max(rows.length, 1);
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = visibleRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedRow = selectedRowId ? rows.find((item) => item.rowId === selectedRowId) ?? null : null;
  const tableWidth = mockColumns.reduce((total, column) => total + columnWidths[column.id], 0);
  const gradeAnalytics = useMemo(() => buildGradeAnalytics(rows), [rows]);
  const utCoverage = useMemo(() => buildUtCoverage(rows), [rows]);
  useEffect(() => { setPage(1); }, [filter, search, unitType, variant]);
  if (!pilot?.available || !pilot.summary || !pilot.datasets || !pilot.rows) {
    return <SheetMessage title="Step 1 truth-to-mockup evaluation is not available" detail="Prepare reviewed truth units and generate the controlled mockup datasets first." />;
  }
  const datasetOrder = ["truth-review", "base-source-grounded", "natural-field-speech", "concise-field-shorthand"];
  const datasets = datasetOrder.map((id) => pilot.datasets?.find((item) => item.datasetId === id)).filter(Boolean) as NonNullable<typeof pilot.datasets>;
  return <>
    <div className="mock-pilot-explainer">
      <strong>One row is one truth-to-mockup comparison.</strong> Read the original-report truth unit on the left, then verify that the generated mockup unit on the right keeps the same meaning, values, units, component identity, condition and action.
    </div>
    <div className="mock-pilot-summary" aria-label="Step 1 dataset summary">
      <article><span>Truth text units</span><strong>{state.fullReport?.sourceUnitCount ?? pilot.sourceUnitCount ?? pilot.factCount}</strong><small>reviewed units from the original report</small></article>
      <article><span>Atomic truth facts</span><strong>{pilot.factCount}</strong><small>the grading denominator for each dataset</small></article>
      <article><span>Mockup comparisons</span><strong>{rows.length}</strong><small>{pilot.factCount} facts × {pilot.datasetCount} datasets</small></article>
      <article><span>Evaluation result</span><strong>{state.fullReport?.summary?.failed ?? pilot.summary.factFailures} failed</strong><small>{state.fullReport?.summary?.pendingHumanReview ?? 0} awaiting human review · {pilot.summary.unsupportedClaims} unsupported</small></article>
    </div>
    <div className="mock-pilot-datasets" aria-label="Qualification datasets">
      {datasets.map((dataset) => <article className={dataset.decision === "pass" && dataset.android?.decision === "pass" ? "pass" : "attention"} key={dataset.datasetId}>
        <header><div><span>{dataset.datasetId === "truth-review" ? "Before generation" : dataset.datasetId === "base-source-grounded" ? "Fidelity anchor" : "Controlled variation"}</span><h3>{humanize(dataset.datasetId)}</h3></div><EvalStatus value={dataset.decision} /></header>
        <dl>
          <div><dt>Exact source clauses</dt><dd>{formatPercent(dataset.wordingMetrics.exactSourceClauseRate * 100)}</dd></div>
          <div><dt>Fact failures</dt><dd>{dataset.factFailures}</dd></div>
          <div><dt>Unsupported</dt><dd>{dataset.unsupportedClaims}</dd></div>
          <div><dt>Android</dt><dd>{dataset.android?.decision === "pass" ? `${dataset.android.voiceNotes} notes · passed` : humanize(dataset.android?.decision)}</dd></div>
        </dl>
        <footer>{dataset.generatorModel === "deterministic" ? "Direct source mapping" : `${dataset.generatorModel} generation · ${dataset.reviewer} grader`}</footer>
      </article>)}
    </div>
    <div className="mock-pilot-table-intro"><div><h3>Truth-to-mockup review workbook</h3><p>Compare every original-report truth unit with its exported app evidence or generated mockup text and evaluator decision.</p></div><span>{rows.length} comparisons · {pilot.datasetCount} datasets</span></div>
    <div className="mock-sheet-toolbar">
      <input aria-label="Search truth-to-mockup rows" onChange={(event) => setSearch(event.target.value)} placeholder="Search truth or mockup text" type="search" value={search} />
      <label>Review view<select value={filter} onChange={(event) => setFilter(event.target.value as ResultFilter)}><option value="all">All rows ({rows.length})</option><option value="pending">Awaiting human review ({rows.filter((item) => item.result === "pending").length})</option><option value="excluded">Excluded boundaries ({rows.filter((item) => item.result === "not_applicable").length})</option><option value="llm_graded">LLM graded ({rows.filter((item) => item.gradingRoute === "llm_semantic").length})</option><option value="fail">Grader failures ({rows.filter((item) => item.result === "fail").length})</option><option value="pass">Passed ({rows.filter((item) => item.result === "pass").length})</option></select></label>
      <label>Mock variation<select value={variant} onChange={(event) => setVariant(event.target.value)}><option value="all">All variations</option>{datasets.map((item) => <option key={item.datasetId} value={item.datasetId}>{humanize(item.datasetId)}</option>)}</select></label>
      <label>Evidence type<select value={unitType} onChange={(event) => setUnitType(event.target.value)}><option value="all">All types</option>{[...new Set(rows.map((item) => item.unitType))].sort().map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
    </div>
    {unitType === "ut_measurement_row" ? <div className="mock-ut-coverage" aria-label="UT measurement coverage">
      <article><strong>{utCoverage.sourceRows}</strong><span>atomic UT records</span></article>
      <article><strong>{utCoverage.spotValues}</strong><span>spot readings in mm</span></article>
      <article><strong>{utCoverage.padValues}</strong><span>reinforcement-pad readings</span><small>{utCoverage.notApplicablePads} explicitly N/A</small></article>
      <article className={utCoverage.matchedComparisons === utCoverage.totalComparisons ? "pass" : "attention"}><strong>{utCoverage.matchedComparisons}/{utCoverage.totalComparisons}</strong><span>Android comparisons aligned</span></article>
      <p>Roof plates {utCoverage.groups.roofPlates} · roof appurtenances {utCoverage.groups.roofElements} · shell course/direction rows {utCoverage.groups.shellRows} · shell appurtenances {utCoverage.groups.shellElements}. Min/mean/max are derived from these raw readings; design thickness, historical thickness, t-min and life calculations remain report-platform inputs.</p>
    </div> : null}
    <div className="mock-sheet-grid-tools"><span><strong>Human review</strong> · one atomic truth fact and one generated mockup unit per row. Select a row to read the full comparison.</span><button onClick={() => setColumnWidths(defaultColumnWidths())} type="button">Reset column widths</button></div>
    {selectedRow ? <SelectedRowInspector item={selectedRow} number={rows.indexOf(selectedRow) + 1} onClose={() => setSelectedRowId(null)} /> : null}
    <div className="mock-sheet-table-wrap mock-sheet-review-grid-wrap">
      <table className="mock-sheet-table mock-sheet-review-grid" aria-label="Step 1 truth-to-mockup evaluation rows" style={{ minWidth: `${tableWidth}px`, width: `${tableWidth}px` }}>
        <colgroup>{mockColumns.map((column) => <col key={column.id} style={{ width: `${columnWidths[column.id]}px` }} />)}</colgroup>
        <thead><tr>{mockColumns.map((column) => <ResizableColumnHeader column={column} key={column.id} onResize={(columnId, width) => {
          const definition = mockColumns.find((item) => item.id === columnId);
          setColumnWidths((current) => ({ ...current, [columnId]: Math.max(definition?.minWidth ?? 80, Math.round(width)) }));
        }} width={columnWidths[column.id]} />)}</tr></thead>
        <tbody>{pagedRows.map((item) => <MockOutputRow item={item} key={item.rowId} number={rows.indexOf(item) + 1} onSelect={() => setSelectedRowId(item.rowId)} selected={selectedRowId === item.rowId} />)}</tbody>
      </table>
      {visibleRows.length === 0 ? <div className="mock-sheet-no-rows">No rows match the current filters.</div> : null}
    </div>
    <div className="mock-sheet-footer"><span>Showing {visibleRows.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, visibleRows.length)} of {visibleRows.length} filtered rows</span><span className="mock-sheet-pagination"><button disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">Previous</button><strong>Page {currentPage} of {pageCount}</strong><button disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} type="button">Next</button></span><span>{pilot.pilotId}</span></div>
    {gradeAnalytics.total ? <GradePerformanceDashboard analytics={gradeAnalytics} onSelect={(nextVariant, nextUnitType) => {
      setFilter("llm_graded"); setVariant(nextVariant); setUnitType(nextUnitType); setSelectedRowId(null);
    }} /> : null}
  </>;
}

function buildTextUnitRows(state: MockPreparationEvaluationState): MockPreparationRow[] {
  const pilot = state.pilot;
  if (!pilot?.available || !pilot.datasets || !pilot.rows) return [];
  const datasetList = pilot.datasets;
  return pilot.rows.flatMap((source) => datasetList.map((dataset) => {
    const output = source.outputs[dataset.datasetId];
    const preserved = output?.semanticVerdict === "preserved" && output?.integrityVerdict === "pass";
    const deterministic = dataset.generatorModel === "deterministic";
    return {
      rowId: `${source.factId}:${dataset.datasetId}`,
      variantId: dataset.datasetId,
      sourceUnitId: source.factId,
      semanticKey: source.factId,
      unitType: source.factType,
      appStyle: dataset.datasetId,
      sourcePage: source.sourcePage,
      originalText: source.originalText,
      protectedFacts: { sourceMeaning: source.protectedMeaning },
      allowedVariation: deterministic ? "Source wording may be retained." : "Wording may change; material meaning must remain fixed.",
      appEvidenceText: output?.text ?? "",
      appEvidenceValue: null,
      appEvidenceRefs: output?.noteId ? [output.noteId] : [],
      appContext: { voice: { screenLabel: "Android product export", itemLabel: humanize(output?.noteId) } },
      gradingRoute: deterministic ? "deterministic" as const : "llm_semantic" as const,
      gradingStatus: "complete" as const,
      graderId: dataset.reviewer,
      graderVersion: "mock-preparation-pilot-v1",
      modelId: deterministic ? null : dataset.reviewer,
      confidence: null,
      humanReviewRequired: false,
      linkageStatus: "pass",
      meaningStatus: output?.semanticVerdict ?? "not_measured",
      integrityStatus: output?.integrityVerdict ?? "not_measured",
      result: preserved ? "pass" as const : "fail" as const,
      explanation: output?.explanation ?? "No grader explanation was saved.",
      missingFacts: output?.missingFacts ?? [],
      alteredFacts: output?.alteredFacts ?? [],
      unsupportedFacts: output?.unsupportedFacts ?? [],
      contradictions: output?.contradictions ?? [],
    };
  }));
}

function GradePerformanceDashboard({ analytics, onSelect }: { analytics: GradeAnalytics; onSelect: (variant: string, evidenceType: string) => void }) {
  const bestVariant = analytics.byVariant[0];
  const weakestVariant = analytics.byVariant.at(-1);
  const substantiveEvidence = analytics.byEvidenceType.filter((item) => item.total >= 20);
  const bestEvidence = substantiveEvidence[0] ?? analytics.byEvidenceType[0];
  const weakestEvidence = substantiveEvidence.at(-1) ?? analytics.byEvidenceType.at(-1);
  return <section className="mock-grade-dashboard" aria-label="GPT-5.6 semantic grade performance">
    <header className="mock-grade-dashboard-heading">
      <div><p className="eyebrow">Step 1 performance</p><h3>Which mockup styles preserve truth-unit meaning?</h3><p>Completed GPT‑5.6 semantic grades only. Pass requires both meaning preservation and truth integrity.</p></div>
      <div className="mock-grade-legend"><span className="pass">Pass</span><span className="flagged">Flagged</span><strong>{formatPercent(analytics.passRate)} overall</strong></div>
    </header>
    <div className="mock-grade-insights">
      <article className="best"><span>Best variation</span><strong>{bestVariant?.label}</strong><p>{formatStat(bestVariant)}</p></article>
      <article className="weak"><span>Weakest variation</span><strong>{weakestVariant?.label}</strong><p>{formatStat(weakestVariant)}</p></article>
      <article className="best"><span>Best evidence type · n≥20</span><strong>{bestEvidence?.label}</strong><p>{formatStat(bestEvidence)}</p></article>
      <article className="weak"><span>Weakest evidence type · n≥20</span><strong>{weakestEvidence?.label}</strong><p>{formatStat(weakestEvidence)}</p></article>
    </div>
    <div className="mock-grade-chart-grid">
      <PerformanceBars title="Pass rate by mock variation" description="Each variation is evaluated against the same truth-unit set." rows={analytics.byVariant} onSelect={(id) => onSelect(id, "all")} />
      <PerformanceBars title="Pass rate by evidence type" description="Sample size varies; small groups are labelled." rows={analytics.byEvidenceType} onSelect={(id) => onSelect("all", id)} />
    </div>
    <PerformanceMatrix analytics={analytics} onSelect={onSelect} />
  </section>;
}

function PerformanceBars({ description, onSelect, rows, title }: { description: string; onSelect: (id: string) => void; rows: GradeStat[]; title: string }) {
  return <article className="mock-grade-chart">
    <header><h4>{title}</h4><p>{description}</p></header>
    <div className="mock-grade-bars">{rows.map((row) => <button aria-label={`${row.label}: ${formatPercent(row.passRate)} passed, ${row.passed} of ${row.total}. Filter review rows.`} key={row.id} onClick={() => onSelect(row.id)} type="button">
      <span className="mock-grade-bar-label"><strong>{row.label}</strong><small>{row.passed}/{row.total} passed{row.total < 20 ? " · small sample" : ""}</small></span>
      <span className="mock-grade-bar-track" role="img" aria-label={`${row.passed} passed and ${row.flagged} flagged`}><i className="pass" style={{ width: `${row.passRate}%` }} /><i className="flagged" style={{ width: `${100 - row.passRate}%` }} /></span>
      <strong className="mock-grade-bar-value">{formatPercent(row.passRate)}</strong>
    </button>)}</div>
  </article>;
}

function PerformanceMatrix({ analytics, onSelect }: { analytics: GradeAnalytics; onSelect: (variant: string, evidenceType: string) => void }) {
  return <article className="mock-grade-matrix-card">
    <header><div><h4>Evidence type × mock variation</h4><p>Select a cell to filter the workbook to those exact truth-to-mockup rows.</p></div><span>Green is stronger · red needs attention</span></header>
    <div className="mock-grade-matrix-wrap"><table className="mock-grade-matrix">
      <thead><tr><th>Evidence type</th>{analytics.byVariant.map((variant) => <th key={variant.id}>{variant.label}</th>)}</tr></thead>
      <tbody>{analytics.byEvidenceType.map((evidenceType) => <tr key={evidenceType.id}><th>{evidenceType.label}<small>n={evidenceType.total}</small></th>{analytics.byVariant.map((variant) => {
        const cell = analytics.matrix[evidenceType.id]?.[variant.id];
        return <td key={`${evidenceType.id}:${variant.id}`}>{cell?.total ? <button className={rateTone(cell.passRate, analytics.passRate)} onClick={() => onSelect(variant.id, evidenceType.id)} title={`${cell.passed} passed, ${cell.flagged} flagged`} type="button"><strong>{formatPercent(cell.passRate)}</strong><small>{cell.passed}/{cell.total}</small></button> : <span>—</span>}</td>;
      })}</tr>)}</tbody>
    </table></div>
  </article>;
}

function buildGradeAnalytics(rows: MockPreparationRow[]): GradeAnalytics {
  const graded = rows.filter((item) => item.gradingRoute === "llm_semantic" && item.gradingStatus === "complete" && item.modelId === "gpt-5.6-sol");
  const aggregate = (key: "variantId" | "unitType") => {
    const groups = new Map<string, GradeStat>();
    for (const row of graded) {
      const id = row[key];
      const current = groups.get(id) ?? { id, label: humanize(id), total: 0, passed: 0, flagged: 0, passRate: 0 };
      current.total += 1;
      if (row.result === "pass") current.passed += 1;
      else current.flagged += 1;
      groups.set(id, current);
    }
    return [...groups.values()].map((item) => ({ ...item, passRate: item.total ? item.passed / item.total * 100 : 0 }))
      .sort((left, right) => right.passRate - left.passRate || right.total - left.total || left.label.localeCompare(right.label));
  };
  const byVariant = aggregate("variantId");
  const byEvidenceType = aggregate("unitType");
  const matrix: GradeAnalytics["matrix"] = {};
  for (const evidenceType of byEvidenceType) {
    matrix[evidenceType.id] = {};
    for (const variant of byVariant) {
      const subset = graded.filter((item) => item.unitType === evidenceType.id && item.variantId === variant.id);
      const passed = subset.filter((item) => item.result === "pass").length;
      matrix[evidenceType.id][variant.id] = { id: `${evidenceType.id}:${variant.id}`, label: "", total: subset.length, passed, flagged: subset.length - passed, passRate: subset.length ? passed / subset.length * 100 : 0 };
    }
  }
  const passed = graded.filter((item) => item.result === "pass").length;
  return { total: graded.length, passed, flagged: graded.length - passed, passRate: graded.length ? passed / graded.length * 100 : 0,
    modelIds: [...new Set(graded.map((item) => item.modelId).filter((item): item is string => Boolean(item)))], byVariant, byEvidenceType, matrix };
}

function buildUtCoverage(rows: MockPreparationRow[]) {
  const sourceRows = rows.filter((item) => item.unitType === "ut_measurement_row" && item.variantId === "base-source-grounded");
  const facts = sourceRows.map((item) => item.protectedFacts as Record<string, unknown>);
  const spotValues = facts.reduce((sum, item) => sum + (Array.isArray(item.readings) ? item.readings.length : 0), 0);
  const padText = facts.map((item) => String(item.reinforcementPadReading ?? "").trim()).filter(Boolean);
  const padValues = padText.filter((value) => !/^(?:n\/?a)$/i.test(value)).length;
  const notApplicablePads = padText.filter((value) => /^(?:n\/?a)$/i.test(value)).length;
  const comparisons = rows.filter((item) => item.unitType === "ut_measurement_row");
  const matchedComparisons = comparisons.filter((item) => item.linkageStatus === "pass" && item.meaningStatus === "preserved" && item.integrityStatus === "pass").length;
  const count = (target: string, kind: string) => facts.filter((item) => item.target === target && item.kind === kind).length;
  return {
    sourceRows: sourceRows.length,
    spotValues,
    padValues,
    notApplicablePads,
    totalComparisons: comparisons.length,
    matchedComparisons,
    groups: {
      roofPlates: count("external_roof", "LAYOUT_REGION"),
      roofElements: count("external_roof", "ELEMENT"),
      shellRows: count("shell", "LAYOUT_REGION"),
      shellElements: count("shell", "ELEMENT"),
    },
  };
}

function formatPercent(value: number) { return `${value.toFixed(1)}%`; }
function formatStat(item: GradeStat | undefined) { return item ? `${formatPercent(item.passRate)} · ${item.passed}/${item.total} passed` : "No graded rows"; }
function rateTone(value: number, baseline: number) {
  if (value >= Math.max(60, baseline + 10)) return "strong";
  if (value >= baseline) return "above";
  if (value >= 30) return "below";
  return "weak";
}

function ResizableColumnHeader({ column, onResize, width }: { column: (typeof mockColumns)[number]; onResize: (columnId: MockColumnId, width: number) => void; width: number }) {
  function startResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = width;
    const handleMove = (moveEvent: PointerEvent) => onResize(column.id, startWidth + moveEvent.clientX - startX);
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  return <th scope="col"><span>{column.label}</span><button aria-label={`Resize ${column.label} column`} className="mock-sheet-column-resizer" onPointerDown={startResize} tabIndex={-1} type="button" /></th>;
}

function SelectedRowInspector({ item, number, onClose }: { item: MockPreparationRow; number: number; onClose: () => void }) {
  const issues = issueLines(item);
  const appLocation = [item.appContext?.voice?.screenLabel, item.appContext?.voice?.itemLabel].filter(Boolean).join(" · ");
  return <aside className="mock-sheet-row-inspector" aria-label={`Selected evaluation row ${number}`}>
    <header>
      <div><span>Selected row {number}</span><strong>{humanize(item.unitType)} · {humanize(item.variantId)}</strong></div>
      <button aria-label="Close selected row details" onClick={onClose} type="button">Close</button>
    </header>
    <div className="mock-sheet-row-inspector-grid">
      <section><h3>Truth text unit</h3><p>{truthText(item)}</p><small>{item.sourcePage ? `Original report page ${item.sourcePage}` : item.semanticKey}</small></section>
      <section><h3>Generated mockup text unit</h3><p>{mockEvidenceText(item)}</p><small>{item.result === "not_applicable" ? exclusionOwner(item) : appLocation || item.appEvidenceRefs[0] || humanize(item.appStyle)}</small></section>
      <section className="feedback"><h3>Evaluator feedback</h3><div className="mock-sheet-inspector-status"><EvalStatus value={item.result} /><span>{graderName(item.gradingRoute)}{item.confidence == null ? "" : ` · ${confidenceLabel(item.confidence)}`}</span></div><p>{item.explanation || defaultFeedback(item)}</p>{issues.length ? <ul>{issues.map((issue, index) => <li key={`${item.rowId}:inspector:${index}`}>{issue}</li>)}</ul> : <small>No missing, changed, unsupported or contradictory facts were reported.</small>}</section>
    </div>
  </aside>;
}

function MockOutputRow({ item, number, onSelect, selected }: { item: MockPreparationRow; number: number; onSelect: () => void; selected: boolean }) {
  const appLocation = [item.appContext?.voice?.screenLabel, item.appContext?.voice?.itemLabel].filter(Boolean).join(" · ");
  const issues = issueLines(item);
  const excluded = item.result === "not_applicable";
  const rowTone = item.result === "pass" ? "matched" : excluded ? "excluded" : "attention";
  return <tr aria-selected={selected} className={`${rowTone}${selected ? " selected" : ""}`} onClick={onSelect} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(); } }} tabIndex={0}>
    <td className="mock-sheet-row-number">{number}</td>
    <td><strong>{humanize(item.variantId)}</strong></td>
    <td><strong>{humanize(item.unitType)}</strong><small>{item.sourcePage ? `Original page ${item.sourcePage}` : item.semanticKey}</small></td>
    <td className="mock-sheet-long-text"><p>{truthText(item)}</p><details><summary>Protected meaning</summary><pre>{JSON.stringify(item.protectedFacts, null, 2)}</pre></details></td>
    <td className="mock-sheet-long-text"><p>{mockEvidenceText(item)}</p><small>{excluded ? exclusionOwner(item) : appLocation || item.appEvidenceRefs[0] || humanize(item.appStyle)}</small></td>
    <td><strong>{excluded ? "Boundary rule" : graderName(item.gradingRoute)}</strong><small>{excluded ? "Excluded from app capture" : item.gradingStatus === "complete" ? [item.modelId, confidenceLabel(item.confidence)].filter(Boolean).join(" · ") || "Completed" : humanize(item.gradingStatus)}</small>{item.humanReviewRequired ? <small>Human review required</small> : null}</td>
    <td><EvalStatus value={excluded ? "not_applicable" : item.meaningStatus} /></td>
    <td><EvalStatus value={excluded ? "not_applicable" : item.integrityStatus} /></td>
    <td>{excluded ? <Status value="Excluded" tone="review" /> : <EvalStatus value={item.result} />}</td>
    <td className="mock-sheet-feedback"><p>{item.explanation || defaultFeedback(item)}</p>{issues.map((issue, index) => <small key={`${item.rowId}:issue:${index}`}>{issue}</small>)}</td>
  </tr>;
}

function utFactsText(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const facts = value as Record<string, unknown>;
  const readings = Array.isArray(facts.readings) ? facts.readings : [];
  const target = facts.target === "external_roof" ? "External roof" : facts.target === "shell" ? "Shell" : humanize(String(facts.target ?? "UT measurement"));
  const kind = facts.kind === "ELEMENT" ? [facts.elementType, facts.itemLabel].filter(Boolean).map(String).join(" ") : String(facts.itemLabel ?? facts.itemKey ?? "");
  const labels = facts.kind === "ELEMENT"
    ? (facts.target === "shell" ? ["12 o’clock", "3 o’clock", "6 o’clock", "9 o’clock"] : ["North", "East", "South", "West"])
    : (facts.target === "external_roof" ? ["A", "B", "C", "D", "E"] : ["1", "2", "3", "4", "5"]);
  const lines = [`${target} · ${kind}`];
  if (facts.nozzleSize) lines.push(`Size: ${String(facts.nozzleSize)}`);
  if (readings.length) lines.push(`Readings: ${readings.map((reading, index) => `${labels[index] ?? index + 1}: ${formatUtNumber(reading)} mm`).join(" · ")}`);
  const pad = String(facts.reinforcementPadReading ?? "").trim();
  if (pad) lines.push(`Reinforcement pad: ${/^(?:n\/?a)$/i.test(pad) ? "N/A" : `${formatUtNumber(pad)} mm`}`);
  return lines.join("\n");
}

function formatUtNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : String(value ?? "");
}

function truthText(item: MockPreparationRow) {
  return item.unitType === "ut_measurement_row" ? utFactsText(item.protectedFacts) : item.originalText;
}

function mockEvidenceText(item: MockPreparationRow) {
  if (item.result === "not_applicable") {
    return item.unitType === "standard_content"
      ? "Excluded from mock data. The report platform inserts this approved standard section without AI generation."
      : "No Android evidence is expected. This specialist package is uploaded separately to the report platform.";
  }
  if (item.unitType === "ut_measurement_row") return utFactsText(item.appEvidenceValue);
  return item.appEvidenceText || displayValue(item.appEvidenceValue) || "No mockup evidence linked.";
}

function exclusionOwner(item: MockPreparationRow) {
  return item.unitType === "standard_content" ? "Report platform standard template" : "External specialist attachment";
}

function CalibrationWorkbook({ state }: { state: MockPreparationEvaluationState }) {
  const calibration = state.calibration;
  if (!calibration?.available) return <SheetMessage title="Evaluator calibration has not run" detail="Add a small human-labelled calibration set before trusting the automated semantic grader at scale." />;
  return <>
    <div className="mock-sheet-explainer"><strong>This tests the evaluator, not the mock output.</strong> Each example has a human-expected judgment. A calibration row passes when the evaluator reaches that expected judgment, including when it correctly rejects a deliberately flawed output.</div>
    <div className="mock-sheet-summary" aria-label="Evaluator calibration summary">
      <span className="pass"><strong>{calibration.summary.matches}/{calibration.summary.judgments}</strong> judgments matched</span>
      <span className={calibration.summary.mismatches ? "review" : "pass"}><strong>{calibration.summary.mismatches}</strong> mismatches</span>
      <span className="mock-sheet-decision">{calibration.summary.gatePassed ? "Calibration passed" : "Calibration needs revision"}</span>
    </div>
    <div className="mock-sheet-table-wrap">
      <table className="mock-sheet-table" aria-label="Evaluator calibration rows">
        <thead><tr><th>#</th><th>Evaluator test</th><th>Truth text unit</th><th>Mockup example</th><th>Expected judgment</th><th>Evaluator judgment</th><th>Calibration result</th><th>Feedback</th></tr></thead>
        <tbody>{calibration.rows.map((item, index) => <CalibrationRow item={item} key={`${item.variantId}:${item.sourceUnitId}`} number={index + 1} />)}</tbody>
      </table>
    </div>
    <div className="mock-sheet-footer"><span>{calibration.scaleDecision}</span><span>{calibration.modelIds?.join(", ")}</span></div>
  </>;
}

function CalibrationRow({ item, number }: { item: MockPreparationCalibrationRow; number: number }) {
  return <tr className={item.matched ? "matched" : "attention"}>
    <td className="mock-sheet-row-number">{number}</td>
    <td><strong>{calibrationPurpose(item.caseType)}</strong><small>{humanize(item.variantId)}</small></td>
    <td className="mock-sheet-long-text"><p>{item.originalText}</p></td>
    <td className="mock-sheet-long-text"><p>{item.appEvidenceText || "No app evidence linked."}</p></td>
    <td><small>Meaning</small><EvalStatus value={item.expectedSemanticVerdict} /><small>Integrity</small><EvalStatus value={item.expectedIntegrityVerdict} /></td>
    <td><small>Meaning</small><EvalStatus value={item.actualSemanticVerdict} /><small>Integrity</small><EvalStatus value={item.actualIntegrityVerdict} /></td>
    <td><Status value={item.matched ? "Matched" : "Mismatch"} tone={item.matched ? "pass" : "fail"} /></td>
    <td className="mock-sheet-feedback"><p>{item.explanation}</p>{[...item.missingFacts.map((text) => `Missing: ${text}`), ...item.alteredFacts.map((text) => `Changed: ${text}`), ...item.unsupportedFacts.map((text) => `Unsupported: ${text}`)].map((issue, index) => <small key={`${item.sourceUnitId}:calibration:${index}`}>{issue}</small>)}</td>
  </tr>;
}

function issueLines(item: MockPreparationRow) {
  return [
    ...item.missingFacts.map((text) => `Missing: ${text}`),
    ...item.alteredFacts.map((text) => `Changed: ${text}`),
    ...item.unsupportedFacts.map((text) => `Unsupported: ${text}`),
    ...item.contradictions.map((text) => `Contradiction: ${text}`),
  ];
}

function defaultFeedback(item: MockPreparationRow) {
  if (item.gradingStatus === "awaiting_llm_semantic_grading") return "Awaiting LLM semantic grading.";
  if (item.gradingStatus === "awaiting_visual_review") return "Awaiting visual review of the source figure and app map.";
  if (item.gradingStatus === "awaiting_deterministic_comparison") return "Awaiting deterministic value, unit and entity comparison.";
  if (item.result === "pending" && item.humanReviewRequired) return "The LLM grade is complete, but confidence or detected issues require human review.";
  if (item.result === "pass") return "The applicable graders found the source unit preserved in the app evidence.";
  return "One or more applicable graders found a missing, changed or unsupported fact.";
}

function displayValue(value: unknown) {
  if (value == null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function graderName(route: MockPreparationRow["gradingRoute"]) {
  if (route === "llm_semantic") return "LLM semantic";
  if (route === "human_visual") return "Human visual";
  return "Deterministic";
}

function confidenceLabel(value: number | null) {
  return value == null ? "" : `${Math.round(value * 100)}% confidence`;
}

function EvalStatus({ value }: { value: string }) {
  const tone = value === "pass" || value === "preserved" ? "pass" : value === "fail" || value === "partial" || value === "contradicted" ? "fail" : "review";
  return <Status value={humanize(value)} tone={tone} />;
}

function Status({ tone, value }: { tone: "pass" | "review" | "fail"; value: string }) {
  return <span className={`mock-sheet-status ${tone}`}>{value}</span>;
}

function SheetMessage({ detail, title }: { detail: string; title: string }) {
  return <section className="eval-live-stage"><div className="mock-sheet-message"><h2>{title}</h2><p>{detail}</p></div></section>;
}

function humanize(value: string | null | undefined) { return String(value ?? "").replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function calibrationPurpose(value: string) {
  const labels: Record<string, string> = {
    preserved_metadata_dependent: "Can metadata provide valid missing context?",
    preserved_sibling_context: "Can one note support several related source units?",
    missing_spatial_relationship: "Does the evaluator detect a missing location relationship?",
    missing_component_attributes: "Does the evaluator detect missing component details?",
    weakened_condition: "Does the evaluator detect a less specific condition?",
    unsupported_action_addition: "Does the evaluator detect an added recommendation?",
  };
  return labels[value] ?? humanize(value);
}
