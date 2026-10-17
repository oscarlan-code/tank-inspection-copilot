import { useState, type ReactNode } from "react";
import type {
  AgentEvidenceTrace,
  AgentGraderIdentity,
  AgentMonitoringStatusSummary,
  AgentPipelineTraceRef,
  AgentPipelineTraceSpan,
  AgentRuleEvaluation,
  SectionAgentEvaluationMatrix,
  SectionAgentEvaluationMatrixRow,
  SectionAgentMonitoring,
} from "../lib/systemRlApi";

type InspectorTab = "input" | "output" | "configuration" | "decision" | "evidence" | "runtime";
type ResultTone = "pass" | "fail" | "awaiting" | "neutral";
type ResultDisplay = { label: string; tone: ResultTone; explanation: string };

export function AgentMonitoringPrimer() {
  return <section className="agent-monitoring-primer" aria-label="How to read agent monitoring">
    <div><strong>Execution</strong><span>Did the stage finish technically?</span></div>
    <div><strong>Gate decision</strong><span>Did deterministic safety and completeness checks allow continuation?</span></div>
    <div><strong>Quality grade</strong><span>Did a separate evaluator measure correctness and report quality?</span></div>
  </section>;
}

export function AgentRunStatusSummary({ summary }: { summary: AgentMonitoringStatusSummary }) {
  const execution = outcomeDisplay(summary.execution.status, summary.execution.explanation);
  const gate = outcomeDisplay(summary.gate.status, summary.gate.explanation);
  const quality = outcomeDisplay(summary.quality.status, summary.quality.explanation);
  return <section className="agent-run-status-summary" aria-label="Overall workflow status">
    <ResultLayer explanation={`${execution.explanation} ${summary.execution.completedStages}/${summary.execution.totalStages} stages completed.`} label="Execution" status={execution.tone} value={execution.label} />
    <ResultLayer explanation={`${gate.explanation} Display: ${humanize(summary.gate.displayDecision)}.`} label="Gate decision" status={gate.tone} value={gate.label} />
    <ResultLayer explanation={`${quality.explanation} ${summary.quality.measuredMetrics} measured; ${summary.quality.unavailableMetrics} unavailable.`} label="Quality grade" status={quality.tone} value={quality.label} />
  </section>;
}

export function AgentSpanInspector({
  artifactCatalog,
  evidenceTrace,
  matrix,
  span,
}: {
  artifactCatalog?: SectionAgentMonitoring["artifactCatalog"];
  evidenceTrace: AgentEvidenceTrace;
  matrix: SectionAgentEvaluationMatrix;
  span: AgentPipelineTraceSpan;
}) {
  const [tab, setTab] = useState<InspectorTab>("input");
  const inputRefs = span.inputRefs.map(ref => resolveArtifactRef(ref, artifactCatalog));
  const outputRefs = span.outputRefs.map(ref => resolveArtifactRef(ref, artifactCatalog));
  const linkedRows = matrix.rows.filter(row => row.sourceSpanIds.includes(span.spanId));
  const evidenceSection = span.sectionId == null
    ? null : evidenceTrace.sections.find(section => section.sectionId === span.sectionId) ?? null;
  const fallbackGate = summarizeGate(span, linkedRows);
  const fallbackQuality = summarizeQuality(linkedRows);
  const execution = span.outcomes?.execution
    ? outcomeDisplay(span.outcomes.execution.status, span.outcomes.execution.explanation)
    : { label: span.error ? "Failed" : span.completedAtIso ? "Completed" : "In progress", tone: span.error ? "fail" : span.completedAtIso ? "pass" : "awaiting", explanation: "Derived from the recorded completion and error fields." } satisfies ResultDisplay;
  const gate = span.outcomes?.gate
    ? outcomeDisplay(span.outcomes.gate.status, span.outcomes.gate.explanation)
    : { ...fallbackGate, explanation: "Derived from linked hard gates in an older monitoring bundle." };
  const quality = span.outcomes?.quality
    ? outcomeDisplay(span.outcomes.quality.status, span.outcomes.quality.explanation)
    : { ...fallbackQuality, explanation: "Derived from linked quality rows in an older monitoring bundle." };
  const tabs: Array<[InspectorTab, string]> = [
    ["input", `Input (${span.inputRefs.length})`],
    ["output", `Output (${span.outputRefs.length})`],
    ["configuration", "Configuration"],
    ["decision", `Decision (${linkedRows.length})`],
    ["evidence", `Evidence (${evidenceSection?.records.length ?? 0})`],
    ["runtime", "Runtime"],
  ];

  return <aside className="agent-span-inspector" aria-label={`${humanize(span.actor.role)} trace detail`}>
    <header className="agent-inspector-header">
      <div>
        <span className="agent-monitoring-kicker">Selected stage</span>
        <h4>{humanize(span.actor.role)}</h4>
        <p>{humanize(span.phase)}{span.sectionId ? ` · ${humanize(span.sectionId)}` : " · Shared workflow"}</p>
      </div>
      <StatusBadge status={span.status} />
    </header>
    <div className="agent-result-layers">
      <ResultLayer explanation={execution.explanation} label="Execution" status={execution.tone} value={execution.label} />
      <ResultLayer explanation={gate.explanation} label="Gate decision" status={gate.tone} value={gate.label} />
      <ResultLayer explanation={quality.explanation} label="Quality grade" status={quality.tone} value={quality.label} />
    </div>
    <p className="agent-inspector-help">Previews are sanitized audit artifacts. Private model reasoning is neither recorded nor displayed.</p>
    <nav className="agent-inspector-tabs" aria-label="Selected stage details">
      {tabs.map(([value, label]) => <button aria-pressed={tab === value} className={tab === value ? "active" : ""} key={value} onClick={() => setTab(value)} type="button">{label}</button>)}
    </nav>
    <div className="agent-inspector-body">
      {tab === "input" ? <ArtifactRefs emptyLabel="No input artifacts were recorded for this stage." label="Inputs received by this stage" refs={inputRefs} /> : null}
      {tab === "output" ? <ArtifactRefs emptyLabel="No output artifacts were recorded for this stage." label="Outputs returned by this stage" refs={outputRefs} /> : null}
      {tab === "configuration" ? <ConfigurationPanel span={span} /> : null}
      {tab === "decision" ? <DecisionPanel linkedRows={linkedRows} span={span} /> : null}
      {tab === "evidence" ? <EvidencePanel evidenceSection={evidenceSection} inputRefs={inputRefs} linkedRows={linkedRows} span={span} /> : null}
      {tab === "runtime" ? <RuntimePanel span={span} /> : null}
    </div>
  </aside>;
}

function ResultLayer({ explanation, label, status, value }: { explanation: string; label: string; status: ResultTone; value: string }) {
  return <div className={status}><span>{label}</span><strong>{value}</strong><small>{explanation}</small></div>;
}

function ArtifactRefs({ emptyLabel, label, refs }: { emptyLabel: string; label: string; refs: AgentPipelineTraceRef[] }) {
  return <section className="agent-inspector-section">
    <SectionHeading detail={`${refs.length} artifact(s)`} title={label} />
    {refs.length ? <div className="agent-artifact-list">{refs.map((ref, index) => <ArtifactCard key={`${ref.artifactId ?? ref.name}:${index}`} refValue={ref} />)}</div> : <EmptyState>{emptyLabel}</EmptyState>}
  </section>;
}

function ArtifactCard({ refValue }: { refValue: AgentPipelineTraceRef }) {
  const hasPreview = refValue.preview !== undefined && refValue.preview !== null;
  const readablePreview = hasPreview ? withoutIntegrityFields(refValue.preview) : null;
  const hasTechnicalIdentity = Boolean(refValue.artifactId || refValue.sha256 || refValue.sourceSha256);
  return <article className="agent-artifact-card">
    <header>
      <div><strong>{humanize(refValue.name)}</strong>{refValue.kind ? <span>{humanize(refValue.kind)}</span> : null}</div>
      {refValue.redactionStatus ? <span className="agent-artifact-badge">{humanize(refValue.redactionStatus)}</span> : null}
    </header>
    <dl>
      {refValue.schemaVersion ? <><dt>Schema</dt><dd>{refValue.schemaVersion}</dd></> : null}
      {refValue.byteLength != null ? <><dt>Size</dt><dd>{formatBytes(refValue.byteLength)}</dd></> : null}
      {refValue.visibility ? <><dt>Visibility</dt><dd>{humanize(refValue.visibility)}</dd></> : null}
      {hasTechnicalIdentity ? <><dt>Integrity</dt><dd><span className="agent-verified-label">Verified</span></dd></> : null}
    </dl>
    {hasPreview ? <>
      <div className="agent-preview-heading"><strong>Content preview</strong><span>{refValue.previewTruncated ? "Truncated by capture policy" : "Human-readable fields"}</span></div>
      <StructuredValue value={readablePreview} />
    </> : <div className="agent-preview-unavailable"><strong>Preview unavailable</strong><span>This run retained the artifact identity for verification, but did not retain readable content.</span></div>}
    {hasTechnicalIdentity || hasPreview ? <TechnicalDetails summary="Technical integrity and exact audit payload">
      <dl className="agent-technical-definition-list">
        {refValue.artifactId ? <><dt>Artifact ID</dt><dd><code>{refValue.artifactId}</code></dd></> : null}
        {refValue.sha256 ? <><dt>Artifact fingerprint</dt><dd><code>{refValue.sha256}</code></dd></> : null}
        {refValue.sourceSha256 ? <><dt>Source fingerprint</dt><dd><code>{refValue.sourceSha256}</code></dd></> : null}
      </dl>
      {hasPreview ? <div className="agent-structured-block"><strong>Exact captured payload</strong><StructuredValue value={refValue.preview} /></div> : null}
    </TechnicalDetails> : null}
  </article>;
}

function ConfigurationPanel({ span }: { span: AgentPipelineTraceSpan }) {
  const readableConfiguration = span.configuration ? withoutIntegrityFields(span.configuration) : null;
  const hasReadableConfiguration = readableConfiguration != null && typeof readableConfiguration === "object"
    && !Array.isArray(readableConfiguration) && Object.keys(readableConfiguration).length > 0;
  return <section className="agent-inspector-section">
    <SectionHeading detail="Release and retrieval boundary" title="Frozen execution configuration" />
    <dl className="agent-inspector-definition-list">
      <dt>Actor</dt><dd>{humanize(span.actor.kind)} · <code>{span.actor.id}</code></dd>
      <dt>Release</dt><dd>{span.actor.releaseVersion ?? "No agent release"}</dd>
      <dt>Release integrity</dt><dd>{span.actor.manifestSha256 ? <span className="agent-verified-label">Verified</span> : "Not recorded"}</dd>
      <dt>Model</dt><dd>{span.model ? `${humanize(span.model.providerCode)}${span.model.modelId ? ` · ${span.model.modelId}` : ""}${span.model.liveModelUsed ? " · live call" : " · no live call"}` : "No model used"}</dd>
      <dt>Retrieval</dt><dd>{span.retrieval ? humanize(span.retrieval.mode) : "No retrieval used"}</dd>
    </dl>
    {span.retrieval?.keys.length ? <ReferenceList label="Retrieval keys" values={span.retrieval.keys} /> : null}
    {hasReadableConfiguration ? <div className="agent-structured-block"><strong>Execution settings</strong><StructuredValue value={readableConfiguration} /></div> : <EmptyState>No additional human-readable settings were recorded for this stage.</EmptyState>}
    <TechnicalDetails summary="Technical integrity">
      <dl className="agent-technical-definition-list">
        <dt>Stage ID</dt><dd><code>{span.spanId}</code></dd>
        {span.actor.manifestSha256 ? <><dt>Release fingerprint</dt><dd><code>{span.actor.manifestSha256}</code></dd></> : null}
      </dl>
      {span.configuration && Object.keys(span.configuration).length ? <div className="agent-structured-block"><strong>Exact recorded configuration</strong><StructuredValue value={span.configuration} /></div> : null}
    </TechnicalDetails>
  </section>;
}

function DecisionPanel({ linkedRows, span }: { linkedRows: SectionAgentEvaluationMatrixRow[]; span: AgentPipelineTraceSpan }) {
  return <section className="agent-inspector-section">
    <SectionHeading detail={`${linkedRows.length} linked matrix check(s)`} title="Why this stage passed or failed" />
    {span.decision ? <div className="agent-decision-summary"><strong>{humanize(span.decision.code)}</strong><p>{span.decision.summary}</p>{span.decision.blockers?.length ? <p className="blocked">Blockers: {span.decision.blockers.join(" · ")}</p> : null}{span.decision.warnings?.length ? <p className="warning">Warnings: {span.decision.warnings.join(" · ")}</p> : null}</div> : <EmptyState>No stage-level decision was recorded.</EmptyState>}
    {span.grader ? <GraderIdentity grader={span.grader} /> : null}
    {span.ruleEvaluations?.length ? <RuleEvaluationList rules={span.ruleEvaluations} /> : null}
    {linkedRows.length ? <div className="agent-linked-metrics">{linkedRows.map(row => <MatrixExplanation key={row.metricId} row={row} />)}</div> : <EmptyState>No evaluation-matrix row points to this span. Execution status alone does not establish content quality.</EmptyState>}
  </section>;
}

function EvidencePanel({
  evidenceSection,
  inputRefs,
  linkedRows,
  span,
}: {
  evidenceSection: AgentEvidenceTrace["sections"][number] | null;
  inputRefs: AgentPipelineTraceRef[];
  linkedRows: SectionAgentEvaluationMatrixRow[];
  span: AgentPipelineTraceSpan;
}) {
  const references = [...new Set([
    ...linkedRows.flatMap(row => row.evidenceRefs),
    ...(span.ruleEvaluations ?? []).flatMap(rule => rule.evidenceRefs ?? []),
  ])];
  return <section className="agent-inspector-section">
    <SectionHeading detail={evidenceSection ? humanize(evidenceSection.sectionId) : "Shared stage"} title="Evidence and provenance" />
    {references.length ? <ReferenceList label="Referenced by decisions" values={references} /> : null}
    {evidenceSection ? <>
      <p className="agent-monitoring-note">{evidenceSection.usedRecordCount} of {evidenceSection.projectedRecordCount} projected records were used. Content appears only when a sanitized preview was retained.</p>
      <div className="agent-evidence-record-list">{evidenceSection.records.map(record => {
        const preview = record.preview ?? evidenceRecordFromArtifacts(inputRefs, record.evidenceId);
        return <article key={record.evidenceId}>
          <header><strong>{record.label ?? humanize(record.sourceClass)}</strong><span className={`agent-compact-state ${record.usedInGeneration ? "pass" : "neutral"}`}>{record.generationDisposition ? humanize(record.generationDisposition) : record.usedInGeneration ? "Used" : "Not rendered"}</span></header>
          <code>{record.sourcePointer}</code>
          {preview !== undefined && preview !== null ? <StructuredValue value={preview} /> : <small>Content preview not retained in this run.</small>}
        </article>;
      })}</div>
    </> : <EmptyState>This shared stage has no section-specific evidence projection.</EmptyState>}
  </section>;
}

function RuntimePanel({ span }: { span: AgentPipelineTraceSpan }) {
  const runtime = span.runtime;
  return <section className="agent-inspector-section">
    <SectionHeading detail={span.durationMs == null ? "Still open" : formatDuration(span.durationMs)} title="Runtime and tool activity" />
    <dl className="agent-inspector-definition-list">
      <dt>Started</dt><dd>{formatTimestamp(span.startedAtIso)}</dd>
      <dt>Completed</dt><dd>{span.completedAtIso ? formatTimestamp(span.completedAtIso) : "Open"}</dd>
      <dt>Duration</dt><dd>{span.durationMs == null ? "Not available" : formatDuration(span.durationMs)}</dd>
      <dt>Tokens</dt><dd>{runtime?.totalTokens != null ? `${runtime.totalTokens} total (${runtime.inputTokens ?? "?"} input · ${runtime.outputTokens ?? "?"} output)` : "Not recorded"}</dd>
      <dt>Attempts</dt><dd>{runtime?.attempt ?? runtime?.attemptCount ?? "Not recorded"}{runtime?.retryCount != null ? ` · ${runtime.retryCount} retries` : ""}</dd>
      <dt>Token reporting</dt><dd>{runtime?.tokenStatus ? humanize(runtime.tokenStatus) : "Not recorded"}</dd>
      <dt>Cost</dt><dd>{runtime?.costUsd != null ? `$${runtime.costUsd.toFixed(6)}` : "Not recorded"}</dd>
      <dt>Provider request</dt><dd>{runtime?.providerRequestId ? "Recorded" : "Not recorded"}</dd>
    </dl>
    {runtime?.providerRequestId ? <TechnicalDetails summary="Technical request identity"><code>{runtime.providerRequestId}</code></TechnicalDetails> : null}
    {span.error ? <div className="agent-runtime-error"><strong>{span.error.code ?? "Execution error"}</strong><p>{span.error.message}</p></div> : null}
    {span.toolCalls?.length ? <div className="agent-tool-call-list"><strong>Tool calls</strong>{span.toolCalls.map((call, index) => <article key={`${call.name}:${index}`}>
      <header><strong>{humanize(call.name)}</strong><StatusBadge status={call.status} /></header>
      {call.durationMs != null ? <small>{formatDuration(call.durationMs)}</small> : null}
      {call.argumentsPreview !== undefined ? <><span>Arguments</span><StructuredValue value={call.argumentsPreview} /></> : null}
      {call.resultPreview !== undefined ? <><span>Result</span><StructuredValue value={call.resultPreview} /></> : null}
      {call.error ? <p className="blocked">{call.error}</p> : null}
    </article>)}</div> : <EmptyState>No tool calls were recorded for this stage.</EmptyState>}
  </section>;
}

export function MatrixExplanation({ row }: { row: SectionAgentEvaluationMatrixRow }) {
  return <article className="agent-matrix-explanation">
    <header><div><strong>{row.label}</strong><small>{row.metricId}</small></div><StatusBadge status={row.status} label={row.status === "not_available" ? "Not measured" : undefined} /></header>
    <div className="agent-matrix-formula">
      <span>Observed</span><strong>{formatMatrixValue(row)}</strong>
      <span>Requirement</span><strong>{row.criterion ? `${operatorSymbol(row.criterion.operator)} ${formatCriterion(row.criterion.value, row.unit)}` : "No measured criterion"}</strong>
    </div>
    {row.grader ? <GraderIdentity grader={row.grader} /> : <p className="agent-muted-line">Evaluator identity was not retained in this run.</p>}
    {row.ruleEvaluations?.length ? <RuleEvaluationList rules={row.ruleEvaluations} /> : null}
    {row.sourceSpanIds.length ? <ReferenceList label="Source spans" values={row.sourceSpanIds} /> : <p className="agent-muted-line">No source span reference recorded.</p>}
    {row.evidenceRefs.length ? <ReferenceList label="Evidence" values={row.evidenceRefs} /> : <p className="agent-muted-line">No evidence reference recorded.</p>}
    {row.notes.length ? <div className="agent-reference-list"><strong>Recorded notes</strong><ul>{row.notes.map((note, index) => <li key={index}>{note}</li>)}</ul></div> : null}
  </article>;
}

function RuleEvaluationList({ rules }: { rules: AgentRuleEvaluation[] }) {
  return <div className="agent-rule-list"><strong>Rule evaluations</strong>{rules.map((rule, index) => <article key={`${rule.ruleId}:${index}`}>
    <header><div><strong>{rule.ruleId}</strong>{rule.ruleVersion ? <small>{rule.ruleVersion}</small> : null}</div><StatusBadge status={rule.verdict} label={rule.verdict === "not_available" ? "Not measured" : undefined} /></header>
    {rule.description ? <p>{rule.description}</p> : null}
    {rule.observed !== undefined || rule.expected !== undefined ? <div className="agent-rule-comparison"><div><span>Observed</span><StructuredValue compact value={rule.observed} /></div><div><span>Requirement</span><strong>{rule.operator ? `${ruleOperatorSymbol(rule.operator)} ` : ""}</strong><StructuredValue compact value={rule.expected} /></div></div> : null}
    {rule.explanation ? <p>{rule.explanation}</p> : null}
    {rule.evidenceRefs?.length ? <small>Evidence: {rule.evidenceRefs.join(" · ")}</small> : null}
  </article>)}</div>;
}

function GraderIdentity({ grader }: { grader: AgentGraderIdentity }) {
  return <div className="agent-grader-identity"><strong>Evaluator</strong><span>{humanize(grader.type)} · {grader.id}{grader.version ? ` · ${grader.version}` : ""}{grader.modelId ? ` · ${grader.modelId}` : ""}</span>{grader.rubricSha256 ? <TechnicalDetails summary="Rubric integrity"><code>{grader.rubricSha256}</code></TechnicalDetails> : null}</div>;
}

function TechnicalDetails({ children, summary }: { children: ReactNode; summary: string }) {
  return <details className="agent-technical-details"><summary>{summary}</summary><div className="agent-technical-details-body">{children}</div></details>;
}

function SectionHeading({ detail, title }: { detail: string; title: string }) {
  return <div className="agent-inspector-section-heading"><strong>{title}</strong><span>{detail}</span></div>;
}

function ReferenceList({ label, values }: { label: string; values: string[] }) {
  return <div className="agent-reference-list"><strong>{label}</strong><ul>{values.map((value, index) => <li key={`${value}:${index}`}><code>{value}</code></li>)}</ul></div>;
}

function StructuredValue({ compact = false, value }: { compact?: boolean; value: unknown }) {
  const rendered = formatStructuredValue(value);
  return compact ? <code className="agent-inline-value">{rendered}</code> : <pre className="agent-structured-value">{rendered}</pre>;
}

function EmptyState({ children }: { children: string }) {
  return <div className="agent-empty-inspection-state">{children}</div>;
}

function StatusBadge({ label, status }: { label?: string; status: string }) {
  return <span className={`agent-status-pill ${status}`}>{label ?? humanize(status)}</span>;
}

function summarizeGate(span: AgentPipelineTraceSpan, rows: SectionAgentEvaluationMatrixRow[]): { label: string; tone: ResultTone } {
  const gates = rows.filter(row => row.class === "hard_gate" && row.status !== "not_applicable");
  if (gates.some(row => row.status === "fail")) return { label: "Blocked", tone: "fail" };
  if (gates.some(row => row.status === "not_available")) return { label: "Incomplete", tone: "awaiting" };
  if (gates.length && gates.every(row => row.status === "pass")) return { label: "Passed", tone: "pass" };
  if (span.status === "blocked") return { label: "Blocked", tone: "fail" };
  if (span.status === "awaiting") return { label: "Awaiting", tone: "awaiting" };
  if (span.status === "not_applicable") return { label: "Not applicable", tone: "neutral" };
  return { label: "No linked gate", tone: "neutral" };
}

function summarizeQuality(rows: SectionAgentEvaluationMatrixRow[]): { label: string; tone: ResultTone } {
  const quality = rows.filter(row => row.class === "quality" && row.status !== "not_applicable");
  if (!quality.length || quality.every(row => row.status === "not_available")) return { label: "Not measured", tone: "awaiting" };
  if (quality.some(row => row.status === "fail")) return { label: "Failed", tone: "fail" };
  if (quality.some(row => row.status === "not_available")) return { label: "Partly measured", tone: "awaiting" };
  return { label: "Passed", tone: "pass" };
}

function outcomeDisplay(status: string, explanation: string): ResultDisplay {
  if (["completed", "passed"].includes(status)) return { label: humanize(status), tone: "pass", explanation };
  if (["failed", "blocked"].includes(status)) return { label: humanize(status), tone: "fail", explanation };
  if (["pending", "not_measured"].includes(status)) return { label: status === "not_measured" ? "Not measured" : "Pending", tone: "awaiting", explanation };
  return { label: humanize(status), tone: "neutral", explanation };
}

function formatMatrixValue(row: SectionAgentEvaluationMatrixRow) {
  if (row.unit === "ratio" && row.numerator != null && row.denominator != null) return `${row.numerator} / ${row.denominator} (${formatRatio(row.value ?? 0)})`;
  if (row.value == null) return "Not measured";
  return row.unit === "ratio" ? formatRatio(row.value) : `${row.value}${row.unit && row.unit !== "count" ? ` ${row.unit}` : ""}`;
}

function formatStructuredValue(value: unknown) {
  if (value === undefined) return "Not recorded";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (["number", "boolean", "bigint"].includes(typeof value)) return String(value);
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function withoutIntegrityFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutIntegrityFields);
  if (value == null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key, entry]) => !isTechnicalIdentityField(key, entry))
    .map(([key, entry]) => [key, withoutIntegrityFields(entry)]));
}

function isTechnicalIdentityField(key: string, value: unknown) {
  if (/(sha(?:256)?|hash|digest|checksum)/i.test(key)) return true;
  if (typeof value === "string" && /^[a-f0-9]{40,}$/i.test(value)) return true;
  const normalized = key.toLowerCase();
  const usefulIds = new Set(["sectionid", "agentid", "releaseid", "reportprofileid", "claimid", "ruleid"]);
  return (normalized.endsWith("id") || normalized.endsWith("ids")) && !usefulIds.has(normalized);
}

function resolveArtifactRef(
  ref: AgentPipelineTraceRef,
  catalog?: SectionAgentMonitoring["artifactCatalog"],
): AgentPipelineTraceRef {
  if (!ref.artifactId || !catalog) return ref;
  const stored = catalog.artifacts.find(artifact => artifact.artifactId === ref.artifactId);
  if (!stored) return ref;
  const merged = { ...stored, ...ref };
  if (ref.preview === undefined && stored.preview !== undefined) merged.preview = stored.preview;
  return merged;
}

function evidenceRecordFromArtifacts(refs: AgentPipelineTraceRef[], evidenceId: string): unknown {
  for (const ref of refs) {
    const preview = ref.preview;
    if (!preview || typeof preview !== "object" || Array.isArray(preview)) continue;
    const projection = (preview as { sectionProjection?: { evidenceRecords?: unknown[] } }).sectionProjection;
    const record = projection?.evidenceRecords?.find(candidate => candidate != null && typeof candidate === "object"
      && !Array.isArray(candidate) && (candidate as { evidenceId?: unknown }).evidenceId === evidenceId);
    if (record) return record;
  }
  return undefined;
}

function formatDuration(value: number) {
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)} s`;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRatio(value: number) { return `${Math.round(value * 100)}%`; }
function formatCriterion(value: number, unit: string) { return unit === "ratio" ? formatRatio(value) : String(value); }
function operatorSymbol(operator: "eq" | "gte" | "lte") { return operator === "eq" ? "=" : operator === "gte" ? "≥" : "≤"; }
function ruleOperatorSymbol(operator: NonNullable<AgentRuleEvaluation["operator"]>) {
  if (operator === "eq") return "=";
  if (operator === "gte") return "≥";
  if (operator === "lte") return "≤";
  return humanize(operator);
}
function humanize(value: string) { return value.replace(/[-_]/g, " ").replace(/\b\w/g, letter => letter.toUpperCase()); }
