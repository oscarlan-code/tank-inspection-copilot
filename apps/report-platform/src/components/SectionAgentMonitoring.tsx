import { useEffect, useState } from "react";
import type {
  AgentEvidenceTrace,
  AgentPipelineTrace,
  AgentPipelineTraceSpan,
  AgentControlPlane,
  SectionAgentEvaluationMatrix,
  SectionAgentMonitoring as SectionAgentMonitoringContract,
} from "../lib/systemRlApi";
import { AgentRunStatusSummary, AgentSpanInspector, MatrixExplanation } from "./AgentSpanInspector";

export type SectionAgentMonitoringView = "review" | "timeline" | "evidence" | "matrix" | "control";

export function SectionAgentMonitoring({
  currentSectionId,
  monitoring,
  view,
}: {
  currentSectionId?: string;
  monitoring: SectionAgentMonitoringContract;
  view: SectionAgentMonitoringView;
}) {
  if (view === "review") return <SegmentReview currentSectionId={currentSectionId} evidenceTrace={monitoring.evidenceTrace} />;
  if (view === "timeline") return <RunTimeline
    artifactCatalog={monitoring.artifactCatalog}
    currentSectionId={currentSectionId}
    evidenceTrace={monitoring.evidenceTrace}
    matrix={monitoring.evaluationMatrix}
    statusSummary={monitoring.statusSummary}
    trace={monitoring.trace}
  />;
  if (view === "evidence") return <EvidenceTrace currentSectionId={currentSectionId} evidenceTrace={monitoring.evidenceTrace} />;
  if (view === "matrix") return <EvalMatrix currentSectionId={currentSectionId} matrix={monitoring.evaluationMatrix} />;
  return <ControlPlane controlPlane={monitoring.controlPlane} currentSectionId={currentSectionId} />;
}

type AtomicLineage = NonNullable<AgentEvidenceTrace["sections"][number]["atomicLineage"]>;
type AtomicUnit = AtomicLineage["units"][number];
type AtomicLink = AtomicLineage["links"][number];
type AtomicVerdict = AtomicLink["verdict"];

type SegmentReviewRow = {
  source: AtomicUnit;
  evidence: AtomicUnit[];
  generated: AtomicUnit[];
  sourceLinks: AtomicLink[];
  generationLinks: AtomicLink[];
  sourceVerdict: AtomicVerdict;
  generationVerdict: AtomicVerdict;
  state: "preserved" | "lost_before_generation" | "changed_during_generation" | "needs_review";
};

export function SegmentReview({ currentSectionId, evidenceTrace }: { currentSectionId?: string; evidenceTrace: AgentEvidenceTrace }) {
  const sections = evidenceTrace.sections.filter(section => section.atomicLineage);
  const currentSection = sections.find(section => section.sectionId === currentSectionId) ?? sections[0];
  const lineage = currentSection?.atomicLineage;
  const rows = lineage ? buildSegmentReviewRows(lineage) : [];
  const attentionRows = rows.filter(row => row.state !== "preserved");
  const [filter, setFilter] = useState<"attention" | "all" | "preserved">(attentionRows.length ? "attention" : "all");
  useEffect(() => setFilter(attentionRows.length ? "attention" : "all"), [currentSection?.sectionId, lineage?.caseId]);
  const visibleRows = filter === "attention" ? attentionRows : filter === "preserved" ? rows.filter(row => row.state === "preserved") : rows;
  const captureFailures = rows.filter(row => row.state === "lost_before_generation").length;
  const generationFailures = rows.filter(row => row.state === "changed_during_generation").length;
  const undecided = rows.filter(row => row.state === "needs_review").length;
  const sourcePassed = rows.filter(row => row.sourceVerdict === "pass").length;
  const generationEligible = rows.filter(row => row.evidence.length > 0).length;
  const generationPassed = rows.filter(row => row.generationVerdict === "pass").length;
  const answer = attentionRows.length === 0
    ? "All gold segments are preserved"
    : `${attentionRows.length} of ${rows.length} gold segments need review`;
  const focus = captureFailures
    ? `${captureFailures} segment(s) changed or disappeared while the original report was converted into app/mock evidence.`
    : generationFailures
      ? `${generationFailures} segment(s) changed or disappeared during report generation.`
      : undecided
        ? `${undecided} segment(s) do not yet have a measured comparison.`
        : "No segment-level issue is recorded for this section.";

  return <div className="agent-monitoring-view agent-segment-review">
    <MonitoringHeader
      eyebrow="Human review"
      title="Review one gold segment at a time"
      detail="Read each row from left to right: what the historical report said, what the app export captured, and what the section agent generated."
    />
    <section className={`agent-review-answer ${attentionRows.length ? "fail" : "pass"}`}>
      <div><span>Review result</span><strong>{answer}</strong><p>{focus}</p></div>
      <div className="agent-review-stage-summary" aria-label="Segment preservation summary">
        <span><strong>{sourcePassed}</strong> / {rows.length}<small>Original → app</small></span>
        <span><strong>{generationPassed}</strong> / {generationEligible}<small>App → generated</small></span>
      </div>
    </section>
    <div className="agent-review-controls" role="group" aria-label="Filter segment review rows">
      <span>Show</span>
      <button aria-pressed={filter === "attention"} className={filter === "attention" ? "active" : ""} onClick={() => setFilter("attention")} type="button">Needs review ({attentionRows.length})</button>
      <button aria-pressed={filter === "all"} className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")} type="button">All segments ({rows.length})</button>
      <button aria-pressed={filter === "preserved"} className={filter === "preserved" ? "active" : ""} onClick={() => setFilter("preserved")} type="button">Preserved ({rows.length - attentionRows.length})</button>
    </div>
    {!lineage ? <p className="agent-review-empty">No segmented gold-pair evaluation is available for this section.</p> : null}
    {lineage && visibleRows.length === 0 ? <p className="agent-review-empty">No segments match this filter.</p> : null}
    <div className="agent-segment-list">
      {visibleRows.map((row, index) => <SegmentReviewCard key={row.source.unitId} row={row} rowNumber={rows.indexOf(row) + 1 || index + 1} />)}
    </div>
    {lineage ? <details className="agent-monitoring-disclosure agent-review-technical"><summary>Technical evaluation details</summary><div className="agent-monitoring-disclosure-body"><p>This case uses {humanizeSemantic(lineage.segmentationPolicy)} and contains {lineage.counts.passedLinks} passing and {lineage.counts.failedLinks} failing lineage links.</p><code>{lineage.caseId}</code></div></details> : null}
  </div>;
}

function SegmentReviewCard({ row, rowNumber }: { row: SegmentReviewRow; rowNumber: number }) {
  const title = humanizeSemantic(row.source.semanticKey.replace(/^scope\.|^tank_information\./, ""));
  const stateLabel = row.state === "lost_before_generation" ? "Lost before generation"
    : row.state === "changed_during_generation" ? "Changed during generation"
      : row.state === "needs_review" ? "Needs human review" : "Preserved end to end";
  const explanations = [...row.sourceLinks, ...row.generationLinks]
    .filter(link => link.verdict !== "pass")
    .map(link => link.explanation);
  return <article className={`agent-segment-card ${row.state}`}>
    <header>
      <div><span className="agent-monitoring-kicker">Segment {rowNumber}</span><h4>{title}</h4></div>
      <StatusPill status={row.state === "preserved" ? "passed" : row.state === "needs_review" ? "awaiting" : "blocked"} label={stateLabel} />
    </header>
    <div className="agent-segment-flow" aria-label={`${title} comparison`}>
      <SegmentTextCell label="1 · Original report" text={row.source.contentPreview} />
      <div className="agent-segment-step"><MatrixStatus status={row.sourceVerdict} /><span>Original → app</span></div>
      <SegmentTextCell emptyLabel="Missing from app/mock data" label="2 · App / mock evidence" text={row.evidence.map(unit => unit.contentPreview).filter(Boolean).join("\n")} />
      <div className="agent-segment-step"><MatrixStatus status={row.generationVerdict} /><span>App → generated</span></div>
      <SegmentTextCell emptyLabel="No generated segment" label="3 · Generated report" text={row.generated.map(unit => unit.contentPreview).filter(Boolean).join("\n")} />
    </div>
    {explanations.length ? <div className="agent-segment-reason"><strong>Why it needs review</strong>{explanations.map((explanation, index) => <p key={`${row.source.unitId}:reason:${index}`}>{explanation}</p>)}</div> : null}
  </article>;
}

function SegmentTextCell({ emptyLabel = "No text", label, text }: { emptyLabel?: string; label: string; text: string | null }) {
  return <section className={`agent-segment-text${text ? "" : " empty"}`}><strong>{label}</strong><p>{text || emptyLabel}</p></section>;
}

function buildSegmentReviewRows(lineage: AtomicLineage): SegmentReviewRow[] {
  const unitById = new Map(lineage.units.map(unit => [unit.unitId, unit]));
  const sourceUnits = lineage.units.filter(unit => unit.layer === "source");
  const generatedUnits = lineage.units.filter(unit => unit.layer === "generated");
  return sourceUnits.map(source => {
    const sourceLinks = lineage.links.filter(link => link.stage === "source_to_mock" && link.fromUnitIds.includes(source.unitId));
    const evidenceIds = [...new Set(sourceLinks.flatMap(link => link.toUnitIds))];
    const evidence = evidenceIds.map(id => unitById.get(id)).filter((unit): unit is AtomicUnit => Boolean(unit));
    const directGenerated = generatedUnits.filter(unit => semanticComparisonKey(unit.semanticKey) === semanticComparisonKey(source.semanticKey));
    const directGeneratedIds = new Set(directGenerated.map(unit => unit.unitId));
    const candidateGenerationLinks = lineage.links.filter(link => link.stage === "mock_to_generation"
      && link.fromUnitIds.some(id => evidenceIds.includes(id)));
    const generationLinks = directGenerated.length
      ? candidateGenerationLinks.filter(link => link.toUnitIds.some(id => directGeneratedIds.has(id)))
      : candidateGenerationLinks;
    const linkedGenerated = generationLinks.flatMap(link => link.toUnitIds)
      .map(id => unitById.get(id)).filter((unit): unit is AtomicUnit => Boolean(unit));
    const generated = uniqueUnits(directGenerated.length ? directGenerated : linkedGenerated);
    const sourceVerdict = summarizeVerdicts(sourceLinks.map(link => link.verdict), evidence.length > 0);
    const generationVerdict = evidence.length === 0 ? "not_available"
      : summarizeVerdicts(generationLinks.map(link => link.verdict), generated.length > 0);
    const state: SegmentReviewRow["state"] = sourceVerdict === "fail" ? "lost_before_generation"
      : generationVerdict === "fail" ? "changed_during_generation"
        : sourceVerdict === "pass" && generationVerdict === "pass" ? "preserved" : "needs_review";
    return { source, evidence, generated, sourceLinks, generationLinks, sourceVerdict, generationVerdict, state };
  }).sort((left, right) => Number(left.state === "preserved") - Number(right.state === "preserved"));
}

function summarizeVerdicts(verdicts: AtomicVerdict[], hasTarget: boolean): AtomicVerdict {
  if (verdicts.includes("fail") || (!hasTarget && verdicts.length > 0)) return "fail";
  if (verdicts.includes("not_available")) return "not_available";
  if (verdicts.includes("pass")) return "pass";
  return hasTarget ? "not_available" : "fail";
}

function semanticComparisonKey(value: string) { return value.replace(/^generated\./, "").replace(/^app\./, ""); }
function uniqueUnits(units: AtomicUnit[]) { return [...new Map(units.map(unit => [unit.unitId, unit])).values()]; }

export function RunTimeline({
  artifactCatalog,
  currentSectionId,
  evidenceTrace,
  matrix,
  statusSummary,
  trace,
}: {
  artifactCatalog?: SectionAgentMonitoringContract["artifactCatalog"];
  currentSectionId?: string;
  evidenceTrace: AgentEvidenceTrace;
  matrix: SectionAgentEvaluationMatrix;
  statusSummary?: SectionAgentMonitoringContract["statusSummary"];
  trace: AgentPipelineTrace;
}) {
  const orderedSpans = [...trace.spans].sort((left, right) => {
    const started = Date.parse(left.startedAtIso) - Date.parse(right.startedAtIso);
    if (started !== 0) return started;
    const completed = Date.parse(left.completedAtIso ?? left.startedAtIso) - Date.parse(right.completedAtIso ?? right.startedAtIso);
    return completed !== 0 ? completed : left.spanId.localeCompare(right.spanId);
  });
  const initialSpan = orderedSpans.find(span => span.sectionId === currentSectionId && span.actor.kind === "agent")
    ?? orderedSpans.find(span => span.actor.kind === "agent")
    ?? orderedSpans[0];
  const [selectedSpanId, setSelectedSpanId] = useState(initialSpan?.spanId ?? "");
  const [showAllStages, setShowAllStages] = useState(false);
  const defaultSpanId = initialSpan?.spanId ?? "";
  useEffect(() => setSelectedSpanId(defaultSpanId), [currentSectionId, defaultSpanId, trace.traceId]);
  const selectedSpan = orderedSpans.find(span => span.spanId === selectedSpanId) ?? initialSpan;
  const relevantSpans = currentSectionId
    ? orderedSpans.filter(span => span.sectionId == null || span.sectionId === currentSectionId)
    : orderedSpans;
  const visibleSpans = showAllStages ? orderedSpans : relevantSpans;
  const firstAttention = relevantSpans.find(span => span.status === "blocked")
    ?? relevantSpans.find(span => span.status === "awaiting")
    ?? relevantSpans.find(span => span.decision?.blockers?.length)
    ?? relevantSpans.find(span => span.decision?.warnings?.length);
  const runVerdict = statusSummary?.execution.status === "failed"
    ? "Workflow did not complete"
    : `${statusSummary?.execution.completedStages ?? trace.spans.length} / ${statusSummary?.execution.totalStages ?? trace.spans.length} stages completed`;
  const runTone = statusSummary?.execution.status === "failed" ? "fail" : "pass";
  return <div className="agent-monitoring-view agent-run-timeline">
    <MonitoringHeader
      eyebrow="Run timeline"
      title="Inspect what every agent received, returned and decided"
      detail={`${trace.spans.length} recorded stages · ${formatDuration(trace.durationMs)} total · ${humanize(trace.executionMode)}. Select a stage to inspect its audit record.`}
    />
    <EngineerTopView
      answer={runVerdict}
      answerDetail={`${humanize(trace.datasetSplit)} · ${humanize(trace.reportProfileId)} · completed ${formatTimestamp(trace.completedAtIso)}`}
      answerTone={runTone}
      boundary="A completed trace proves that stages ran and were recorded. It does not prove that the generated report is correct."
      focus={firstAttention
        ? `${humanize(firstAttention.actor.role)} · ${firstAttention.decision?.summary ?? humanize(firstAttention.status)}`
        : "No blocked, awaiting or warning stage is recorded for this section path."}
      question="Where did this section workflow stop, wait or warn?"
    />
    <details className="agent-technical-details agent-run-technical-details">
      <summary>Technical integrity</summary>
      <dl>
        <dt>Run ID</dt><dd><code>{trace.traceId}</code></dd>
      </dl>
    </details>
    {statusSummary ? <details className="agent-monitoring-disclosure"><summary>Run-level execution, gate and quality statuses</summary><AgentRunStatusSummary summary={statusSummary} /></details> : null}
    <ViewControls
      allLabel={`All stages (${orderedSpans.length})`}
      focusedLabel={`${currentSectionId ? humanize(currentSectionId) : "Current"} path (${relevantSpans.length})`}
      onShowAll={() => setShowAllStages(true)}
      onShowFocused={() => setShowAllStages(false)}
      showingAll={showAllStages}
    />
    <div className="agent-timeline-layout">
      <ol className="agent-timeline-list">
        {visibleSpans.map((span) => <TimelineSpan
          active={Boolean(currentSectionId && span.sectionId === currentSectionId)}
          compact={!showAllStages}
          index={orderedSpans.indexOf(span)}
          key={span.spanId}
          onSelect={() => setSelectedSpanId(span.spanId)}
          selected={span.spanId === selectedSpan?.spanId}
          span={span}
        />)}
      </ol>
      {selectedSpan ? <AgentSpanInspector artifactCatalog={artifactCatalog} evidenceTrace={evidenceTrace} key={selectedSpan.spanId} matrix={matrix} span={selectedSpan} /> : null}
    </div>
  </div>;
}

function TimelineSpan({ active, compact, index, onSelect, selected, span }: { active: boolean; compact: boolean; index: number; onSelect: () => void; selected: boolean; span: AgentPipelineTraceSpan }) {
  const role = humanize(span.actor.role);
  return <li className={`agent-timeline-span status-${span.status}${active ? " current-section" : ""}${selected ? " selected" : ""}`}>
    <div className="agent-timeline-index" aria-hidden="true">{index + 1}</div>
    <article aria-label={`Inspect ${role}`} aria-pressed={selected} onClick={onSelect} onKeyDown={event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(); }
    }} role="button" tabIndex={0}>
      <header>
        <div>
          <span className="agent-monitoring-kicker">{humanize(span.phase)}{span.sectionId ? ` · ${humanize(span.sectionId)}` : " · Shared"}</span>
          <h4>{role}</h4>
          <p>{span.actor.id}{span.actor.releaseVersion ? ` · ${span.actor.releaseVersion}` : ""}</p>
        </div>
        <div className="agent-monitoring-status-stack">
          <StatusPill status={span.status} />
          <small>{span.durationMs == null ? "Open" : formatDuration(span.durationMs)}</small>
          <span className="agent-inspect-hint">{selected ? "Inspecting" : "Open details"}</span>
        </div>
      </header>
      {span.decision ? <div className="agent-decision-summary"><strong>{humanize(span.decision.code)}</strong><p>{span.decision.summary}</p>{span.decision.blockers?.length ? <p className="blocked">Blockers: {span.decision.blockers.join(" · ")}</p> : null}{span.decision.warnings?.length ? <p className="warning">Warnings: {span.decision.warnings.join(" · ")}</p> : null}</div> : null}
      {!compact && Object.keys(span.counts).length ? <div className="agent-count-list">{Object.entries(span.counts).map(([key, value]) => <span key={key}><strong>{value}</strong> {humanize(key)}</span>)}</div> : null}
      {!compact ? <div className="agent-runtime-facts">
        <span><strong>Actor</strong>{humanize(span.actor.kind)}</span>
        <span><strong>Model</strong>{span.model ? `${humanize(span.model.providerCode)}${span.model.modelId ? ` · ${span.model.modelId}` : ""}${span.model.liveModelUsed ? " · live" : ""}` : "Not used"}</span>
        <span><strong>Retrieval</strong>{span.retrieval ? humanize(span.retrieval.mode) : "Not used"}</span>
      </div> : null}
      {!compact && (span.inputRefs.length || span.outputRefs.length) ? <div className="agent-io-summary"><span>{span.inputRefs.length} input artifact(s)</span><span>{span.outputRefs.length} output artifact(s)</span></div> : null}
    </article>
  </li>;
}

export function EvidenceTrace({ currentSectionId, evidenceTrace }: { currentSectionId?: string; evidenceTrace: AgentEvidenceTrace }) {
  const [showAllSections, setShowAllSections] = useState(false);
  const sections = [...evidenceTrace.sections].sort((left, right) => Number(right.sectionId === currentSectionId) - Number(left.sectionId === currentSectionId));
  const router = evidenceTrace.router;
  const currentSection = sections.find(section => section.sectionId === currentSectionId) ?? sections[0];
  const visibleSections = showAllSections ? sections : currentSection ? [currentSection] : sections;
  const routingReady = router.unresolved === 0 && router.dispositionCoverage === 1;
  const evidenceFocus = router.unresolved
    ? `Resolve ${router.unresolved} evidence record(s) before generation.`
    : currentSection?.issueCount
      ? `Inspect ${currentSection.issueCount} issue(s) in ${humanize(currentSection.sectionId)}.`
      : currentSection?.accountability.status !== "measured"
        ? `Complete evidence accountability for ${humanize(currentSection?.sectionId ?? "this section")}.`
        : "Routing is complete. Inspect records marked not rendered only when expected content is missing.";
  return <div className="agent-monitoring-view agent-evidence-trace">
    <MonitoringHeader
      eyebrow="Evidence trace"
      title="Routing, use and disposition by section"
      detail="This view contains audit references and recorded decision summaries."
    />
    <EngineerTopView
      answer={routingReady ? "Routing ready" : "Routing needs attention"}
      answerDetail={`${router.routed} routed · ${router.excluded} explicitly excluded · ${router.unresolved} unresolved`}
      answerTone={routingReady ? "pass" : "fail"}
      boundary="Successful routing proves where evidence was sent. It does not prove that the generator used it correctly."
      focus={evidenceFocus}
      question="Did every app record receive a reviewed destination or exclusion?"
    />
    <div className="agent-monitoring-summary">
      <SummaryStat label="Evidence records" value={String(router.total)} />
      <SummaryStat label="Unresolved" value={String(router.unresolved)} tone={router.unresolved ? "fail" : "pass"} />
      <SummaryStat label="Disposition coverage" value={formatRatio(router.dispositionCoverage)} tone={router.dispositionCoverage === 1 ? "pass" : "fail"} />
    </div>
    <ViewControls
      allLabel={`All sections (${sections.length})`}
      focusedLabel={`${currentSection ? humanize(currentSection.sectionId) : "Current section"}`}
      onShowAll={() => setShowAllSections(true)}
      onShowFocused={() => setShowAllSections(false)}
      showingAll={showAllSections}
    />
    <div className="agent-evidence-sections">
      {visibleSections.map(section => <article className={section.sectionId === currentSectionId ? "current-section" : ""} key={section.sectionId}>
        <header>
          <div><span className="agent-monitoring-kicker">Section evidence</span><h4>{humanize(section.sectionId)}</h4></div>
          <StatusPill status={section.accountability.status === "measured" ? "passed" : "awaiting"} label={humanize(section.accountability.status)} />
        </header>
        <div className="agent-section-evidence-stats">
          <SummaryStat label="Projected" value={String(section.projectedRecordCount)} />
          <SummaryStat label="Used" value={String(section.usedRecordCount)} />
          <SummaryStat label="Issues" value={String(section.issueCount)} tone={section.issueCount ? "fail" : "pass"} />
          <SummaryStat label="Accounted" value={section.accountability.accounted == null ? "Not available" : `${section.accountability.accounted} / ${section.accountability.total}`} />
        </div>
        {Object.keys(section.accountability.counts).length ? <div className="agent-count-list">{Object.entries(section.accountability.counts).map(([key, value]) => <span key={key}><strong>{value}</strong> {humanize(key)}</span>)}</div> : null}
        {section.accountability.reason ? <p className="agent-monitoring-note">{section.accountability.reason}</p> : null}
        <div className="agent-monitoring-table-wrap"><table className="agent-monitoring-table">
          <thead><tr><th>Source</th><th>Pointer</th><th>Generation</th><th>Issues</th></tr></thead>
          <tbody>{section.records.map(record => <tr key={record.evidenceId}>
            <td><strong>{humanize(record.sourceClass)}</strong></td>
            <td><code>{record.sourcePointer}</code></td>
            <td><span className={`agent-compact-state ${record.usedInGeneration ? "pass" : "neutral"}`}>{record.generationDisposition ? humanize(record.generationDisposition) : record.usedInGeneration ? "Used" : "Not rendered"}</span></td>
            <td>{record.issueCount}</td>
          </tr>)}</tbody>
        </table></div>
        {section.claimLinks.length ? <details className="agent-monitoring-details"><summary>Claim-to-evidence links ({section.claimLinks.length})</summary><div className="agent-claim-links">{section.claimLinks.map((link, index) => <div key={`${link.claimId}:${link.routedEvidenceIds.join(",")}:${index}`}><strong>{humanize(link.claimId)}</strong><span>{link.routedEvidenceIds.length} routed evidence reference(s)</span><small>{link.sourceRecordIds.length} source record(s)</small><details className="agent-technical-details"><summary>Technical record IDs</summary><ul>{link.sourceRecordIds.map(recordId => <li key={recordId}><code>{recordId}</code></li>)}</ul></details></div>)}</div></details> : null}
      </article>)}
    </div>
  </div>;
}

export function EvalMatrix({ currentSectionId, matrix }: { currentSectionId?: string; matrix: SectionAgentEvaluationMatrix }) {
  const [showAllChecks, setShowAllChecks] = useState(false);
  const rows = [...matrix.rows].sort((left, right) => {
    const leftRank = left.sectionId === currentSectionId ? 0 : left.sectionId == null ? 1 : 2;
    const rightRank = right.sectionId === currentSectionId ? 0 : right.sectionId == null ? 1 : 2;
    return leftRank - rightRank;
  });
  const scopedRows = currentSectionId ? rows.filter(row => row.sectionId == null || row.sectionId === currentSectionId) : rows;
  const attentionRows = scopedRows.filter(row => row.status === "fail" || row.status === "not_available");
  const visibleRows = showAllChecks ? rows : attentionRows;
  const matrixFocus = matrix.summary.hardGateFailed
    ? `Fix ${matrix.summary.hardGateFailed} failed hard gate(s) before continuing.`
    : matrix.summary.hardGateUnavailable
      ? `Complete ${matrix.summary.hardGateUnavailable} unavailable hard gate(s).`
      : matrix.summary.qualityUnavailable
        ? `Run or review ${matrix.summary.qualityUnavailable} unavailable quality measurement(s).`
        : "All required gates and quality measurements are available.";
  return <div className="agent-monitoring-view agent-eval-matrix">
    <MonitoringHeader
      eyebrow="Evaluation matrix"
      title="Why the workflow passed, failed or remains incomplete"
      detail="Execution, continuation gates and content-quality evaluation are reported separately."
    />
    <EngineerTopView
      answer={humanize(matrix.outcomes.qualificationDecision)}
      answerDetail={`${matrix.summary.hardGatePassed} / ${matrix.summary.hardGateCount} hard gates passed · ${matrix.summary.qualityMeasured} quality checks measured`}
      answerTone={outcomeTone(matrix.outcomes.qualificationDecision)}
      boundary="Quality scores never compensate for a failed or unavailable hard gate."
      focus={matrixFocus}
      question="What prevents this exact release from qualifying?"
    />
    <div className="agent-monitoring-summary">
      <SummaryStat label="Display gate" value={humanize(matrix.outcomes.displayDecision)} tone={outcomeTone(matrix.outcomes.displayDecision)} />
      <SummaryStat label="Hard gates passed" value={`${matrix.summary.hardGatePassed} / ${matrix.summary.hardGateCount}`} tone={matrix.summary.hardGateFailed ? "fail" : matrix.summary.hardGateUnavailable ? "awaiting" : "pass"} />
      <SummaryStat label="Quality grade" value={matrix.summary.qualityMeasured ? `${matrix.summary.qualityMeasured} measured · ${matrix.summary.qualityUnavailable} unavailable` : `Not measured · ${matrix.summary.qualityUnavailable} unavailable`} tone={matrix.summary.qualityUnavailable ? "awaiting" : matrix.summary.qualityMeasured ? "pass" : "neutral"} />
    </div>
    <p className="agent-monitoring-note"><strong>Gate rule:</strong> {matrix.policy.hardGateRule} <strong>Quality rule:</strong> {matrix.policy.scoreRule}</p>
    <ViewControls
      allLabel={`All checks (${rows.length})`}
      focusedLabel={`${currentSectionId ? humanize(currentSectionId) : "Current"} attention (${attentionRows.length})`}
      onShowAll={() => setShowAllChecks(true)}
      onShowFocused={() => setShowAllChecks(false)}
      showingAll={showAllChecks}
    />
    {!visibleRows.length ? <div className="agent-empty-inspection-state">No failed or unavailable checks. Open all checks to inspect passing diagnostics.</div> : null}
    <div className="agent-monitoring-table-wrap"><table className="agent-monitoring-table agent-matrix-table">
      <thead><tr><th>Check</th><th>Scope</th><th>Class</th><th>Result</th><th>Measured</th><th>Required</th></tr></thead>
      <tbody>{visibleRows.map(row => <tr className={row.sectionId === currentSectionId ? "current-section" : ""} key={row.metricId}>
        <td><strong>{row.label}</strong><small>{humanize(row.phase)}</small><details className="agent-matrix-detail"><summary>Why this result?</summary><MatrixExplanation row={row} /></details></td>
        <td>{row.sectionId ? humanize(row.sectionId) : "Shared"}</td>
        <td>{humanize(row.class)}</td>
        <td><MatrixStatus status={row.status} /></td>
        <td>{formatMatrixValue(row.value, row.numerator, row.denominator, row.unit)}</td>
        <td>{row.criterion ? `${criterionSymbol(row.criterion.operator)} ${formatCriterion(row.criterion.value, row.unit)}` : "—"}</td>
      </tr>)}</tbody>
    </table></div>
  </div>;
}

export function ControlPlane({ controlPlane, currentSectionId }: { controlPlane: AgentControlPlane; currentSectionId?: string }) {
  const [showAllBindings, setShowAllBindings] = useState(false);
  const coverage = controlPlane.monitoringCoverage;
  const relevantBindings = currentSectionId
    ? controlPlane.bindings.filter(binding => binding.sectionId == null || binding.sectionId === currentSectionId)
    : controlPlane.bindings;
  const visibleBindings = showAllBindings ? controlPlane.bindings : relevantBindings;
  const isolationPreserved = !controlPlane.productEnabled && !controlPlane.promotionPerformed;
  const controlFocus = coverage.unmonitoredActualAgents
    ? `Add monitoring for ${coverage.unmonitoredActualAgents} executed agent(s).`
    : "All executed agents are recorded. Compare release versions here when a candidate changes.";
  return <div className="agent-monitoring-view agent-control-plane">
    <MonitoringHeader
      eyebrow="Control plane"
      title="Release bindings and execution boundaries"
      detail={`${coverage.actualAgentSpans} actual agent spans · ${coverage.unmonitoredActualAgents} unmonitored`}
    />
    <EngineerTopView
      answer={isolationPreserved ? "Evaluation isolation preserved" : "Product state changed"}
      answerDetail={`${coverage.actualAgentSpans} executed agents recorded · ${controlPlane.productEnabled ? "product enabled" : "product disabled"} · ${controlPlane.promotionPerformed ? "promotion recorded" : "no promotion"}`}
      answerTone={isolationPreserved && coverage.unmonitoredActualAgents === 0 ? "pass" : "fail"}
      boundary="Verified release identity proves which code and configuration ran. It does not prove report quality."
      focus={controlFocus}
      question="Which exact agent releases ran, and did evaluation remain isolated?"
    />
    <div className="agent-monitoring-summary">
      <SummaryStat label="Qualification" value={humanize(controlPlane.outcomes.qualificationDecision)} tone={outcomeTone(controlPlane.outcomes.qualificationDecision)} />
      <SummaryStat label="Approval" value={humanize(controlPlane.approvalStatus)} />
      <SummaryStat label="Monitoring coverage" value={`${coverage.actualAgentSpans - coverage.unmonitoredActualAgents} / ${coverage.actualAgentSpans}`} tone={coverage.unmonitoredActualAgents ? "fail" : "pass"} />
    </div>
    <ViewControls
      allLabel={`All agent releases (${controlPlane.bindings.length})`}
      focusedLabel={`${currentSectionId ? humanize(currentSectionId) : "Current"} releases (${relevantBindings.length})`}
      onShowAll={() => setShowAllBindings(true)}
      onShowFocused={() => setShowAllBindings(false)}
      showingAll={showAllBindings}
    />
    <section className="agent-control-section">
      <div><span className="agent-monitoring-kicker">Immutable registry</span><h4>Agent release bindings</h4></div>
      <div className="agent-monitoring-table-wrap"><table className="agent-monitoring-table">
        <thead><tr><th>Role</th><th>Section</th><th>Release</th><th>Configuration</th><th>Integrity</th><th>Status</th></tr></thead>
        <tbody>{visibleBindings.map(binding => <tr key={binding.spanId}>
          <td><strong>{humanize(binding.role)}</strong><small>{binding.id}</small></td>
          <td>{binding.sectionId ? humanize(binding.sectionId) : "Shared"}</td>
          <td><code>{binding.releaseVersion}</code></td>
          <td>{binding.configurationId ? <><code>{binding.configurationId}</code>{binding.configurationSha256 ? <details className="agent-technical-details"><summary>Configuration fingerprint</summary><code>{binding.configurationSha256}</code></details> : null}</> : "Not recorded"}</td>
          <td><span className="agent-verified-label">Verified</span><details className="agent-technical-details"><summary>Technical ID</summary><code>{binding.manifestSha256}</code></details></td>
          <td><StatusPill status={binding.status} /></td>
        </tr>)}</tbody>
      </table></div>
    </section>
    <details className="agent-monitoring-disclosure"><summary>Supported roles and deterministic controls</summary><div className="agent-monitoring-disclosure-body">
      <section className="agent-control-section">
        <div><span className="agent-monitoring-kicker">Agent coverage</span><h4>Supported roles</h4></div>
        <div className="agent-role-grid">{coverage.supportedAgentRoles.map(role => {
          const notRun = coverage.notRunInThisCase.includes(role);
          const bound = controlPlane.bindings.some(binding => binding.role === role);
          return <div className={bound ? "active" : "not-run"} key={role}><strong>{humanize(role)}</strong><span>{bound ? "Recorded in this run" : notRun ? "Supported · not run in this case" : "No recorded span"}</span></div>;
        })}</div>
      </section>
      <section className="agent-control-section">
        <div><span className="agent-monitoring-kicker">Deterministic controls</span><h4>Orchestration and safeguards</h4></div>
        <div className="agent-control-cards">{controlPlane.controls.map(control => <article key={control.spanId}><div><strong>{humanize(control.role)}</strong><span>{control.id}</span></div><StatusPill status={control.status} /></article>)}</div>
      </section>
    </div></details>
  </div>;
}

function EngineerTopView({ answer, answerDetail, answerTone, boundary, focus, question }: {
  answer: string;
  answerDetail: string;
  answerTone: "neutral" | "pass" | "fail" | "awaiting";
  boundary: string;
  focus: string;
  question: string;
}) {
  return <section className="agent-engineer-overview">
    <header><span className="agent-monitoring-kicker">Engineer overview</span><h4>{question}</h4></header>
    <div>
      <article className={answerTone}><span>Current answer</span><strong>{answer}</strong><p>{answerDetail}</p></article>
      <article><span>Inspect first</span><strong>Next useful action</strong><p>{focus}</p></article>
      <article><span>Interpretation limit</span><strong>What this view cannot prove</strong><p>{boundary}</p></article>
    </div>
  </section>;
}

function ViewControls({ allLabel, focusedLabel, onShowAll, onShowFocused, showingAll }: {
  allLabel: string;
  focusedLabel: string;
  onShowAll: () => void;
  onShowFocused: () => void;
  showingAll: boolean;
}) {
  return <div className="agent-view-controls" role="group" aria-label="View scope">
    <span>View</span>
    <button aria-pressed={!showingAll} className={!showingAll ? "active" : ""} onClick={onShowFocused} type="button">{focusedLabel}</button>
    <button aria-pressed={showingAll} className={showingAll ? "active" : ""} onClick={onShowAll} type="button">{allLabel}</button>
  </div>;
}

function MonitoringHeader({ detail, eyebrow, title }: { detail: string; eyebrow: string; title: string }) {
  return <header className="agent-monitoring-header"><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3><p>{detail}</p></div></header>;
}

function SummaryStat({ label, tone = "neutral", value }: { label: string; tone?: "neutral" | "pass" | "fail" | "awaiting"; value: string }) {
  return <article className={`agent-summary-stat ${tone}`}><span>{label}</span><strong>{value}</strong></article>;
}

function StatusPill({ label, status }: { label?: string; status: string }) {
  return <span className={`agent-status-pill ${status}`}>{label ?? humanize(status)}</span>;
}

function MatrixStatus({ status }: { status: SectionAgentEvaluationMatrix["rows"][number]["status"] }) {
  return <span className={`agent-status-pill ${status}`}>{status === "not_available" ? "Not measured" : humanize(status)}</span>;
}

function formatDuration(value: number) {
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)} s`;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value));
}

function formatRatio(value: number) { return `${Math.round(value * 100)}%`; }

function formatMatrixValue(value: number | null, numerator: number | null, denominator: number | null, unit: string) {
  if (unit === "ratio" && numerator != null && denominator != null) return `${numerator} / ${denominator}`;
  if (value == null) return "—";
  if (unit === "ratio") return formatRatio(value);
  return String(value);
}

function formatCriterion(value: number, unit: string) { return unit === "ratio" ? formatRatio(value) : String(value); }
function criterionSymbol(operator: "eq" | "gte" | "lte") { return operator === "eq" ? "=" : operator === "gte" ? "≥" : "≤"; }
function humanize(value: string) { return value.replace(/[-_]/g, " ").replace(/\b\w/g, letter => letter.toUpperCase()); }
function humanizeSemantic(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, letter => letter.toUpperCase())
    .replace(/\bApi\b/g, "API")
    .replace(/\bMfl\b/g, "MFL")
    .replace(/\bUt\b/g, "UT")
    .replace(/\bBscan\b/g, "B-scan");
}
function outcomeTone(value: string): "neutral" | "pass" | "fail" | "awaiting" {
  if (["allowed", "valid", "qualified", "passed"].includes(value)) return "pass";
  if (["blocked", "invalid", "not_qualified", "failed"].includes(value)) return "fail";
  if (["incomplete", "awaiting", "not_available"].includes(value)) return "awaiting";
  return "neutral";
}
