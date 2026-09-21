import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import DOMPurify from "dompurify";
import { authenticatedFetch } from "../lib/authClient";
import "./SectionPlanningPanel.css";

type Role = "required_narrative" | "required_structured" | "supporting" | "cross_reference";
type EvidenceRecord = {
  evidenceId: string;
  kind: string;
  sourceClass: string;
  entityId: string | null;
  displayText: string;
  captureContext?: Record<string, unknown>;
  locationRef?: Record<string, unknown>;
  sourceRef?: { pointer?: string };
  payload: { text?: string; itemLabel?: string; unitCode?: string | null; resolvedUnitCode?: string; cells?: Array<{ key: string; value: unknown; unitCode?: string | null }> };
};
type ReviewIssue = { evidenceId: string; reason: string; candidateSections: string[]; detail?: string };
type EvidenceUse = { useId?: string; sectionId?: string; evidenceIds: string[]; role: Role; slotKey?: string; decision?: { basis?: string; reason?: string } };
type OutlineSlot = {
  slotKey: string;
  title?: string;
  purpose?: string;
  type?: string;
  acceptedKinds: string[];
  allowedRoles?: Role[];
  evidenceKindsByRole?: Partial<Record<Role, string[]>>;
  evidenceRules?: Array<{ ruleId: string; description: string; role: Role }>;
  automaticAssignment?: string;
  presentation?: { renderer?: string; narrativeStyle?: string; columns?: Array<string | { key?: string; title?: string; label?: string }> };
};
type SectionPlan = {
  sectionId: string;
  title: string;
  status: string;
  applicability: { state: string };
  evidenceUses: EvidenceUse[];
  outputObligations: unknown[];
  missingRequirements: Array<{ requirementId: string; reason: string; blocksApproval: boolean }>;
  scopeReviewRequired?: boolean;
  applicableSlotKeys?: string[];
  scopeReviewDecision?: { applicability: "applicable" | "not_applicable"; applicableSlotKeys: string[]; reason: string };
  catalog: { number: string; slots: OutlineSlot[] };
};
type DestinationUse = EvidenceUse & { plan: SectionPlan };
type PlanningSnapshot = { snapshotId: string; evidenceRecords: EvidenceRecord[]; sectionPlans: SectionPlan[]; unresolvedEvidence: ReviewIssue[] };
type Props = { reportJobId: string; initialSectionId?: string; canEdit?: boolean; onClose: () => void; onChanged?: () => void | Promise<void> };
type EditMode = "add" | "update" | "remove";
type EvaluationDraft = {
  generatedContent: string;
  sectionPlanningSnapshotId: string;
  sectionId: string;
  sectionTitle: string;
  evalRun?: { summary?: string; outcomeCode?: string; sectionPlanEvaluation?: { truthGraphEvaluation?: { requiredFactCount?: number; matchedRequiredFactCount?: number; requiredFactRecall?: number }; missingRequiredObligationIds?: string[] } };
  generationRun?: { warnings?: unknown[]; blockers?: unknown[] };
};
const roleNames: Record<Role, string> = { required_narrative: "Required narrative", required_structured: "Required table, field or figure", supporting: "Supporting information", cross_reference: "Report cross-reference" };
const roleDescriptions: Record<Role, string> = { required_narrative: "Express the captured finding or statement in this block.", required_structured: "Include the source values, fields or artifact in this block.", supporting: "Use as context; do not require it to be repeated in the report.", cross_reference: "Refer to related report content or an artifact." };
const title = (value: string) => value.replace(/[_-]/g, " ").replace(/^./, (letter) => letter.toUpperCase());
const slotTitle = (slot: OutlineSlot) => slot.title || title(slot.slotKey);
const recordTitle = (record: EvidenceRecord) => record.displayText || record.payload.text || record.payload.itemLabel || title(record.kind);
const statusName = (plan: SectionPlan) => plan.applicability.state === "not_applicable" ? "Not applicable" : plan.status === "ready" ? "Ready" : plan.status === "blocked" ? "Needs review" : "Needs information";
const structuredKinds = new Set(["measurement", "checklist_response", "geometry", "attachment", "identity", "calculation_result"]);
const kindNames: Record<string, string> = { measurement: "Measurements", checklist_response: "Checklist responses", geometry: "Layout records", attachment: "Attachments", identity: "Tank details", manual_confirmation: "Reviewed report inputs", observation: "Findings and notes", voice_claim: "Voice statements", legacy_capture: "Imported capture records" };

async function requestSnapshot(path: string, init: RequestInit = {}): Promise<PlanningSnapshot> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await authenticatedFetch(path, { ...init, signal: controller.signal });
    const payload = await response.json() as PlanningSnapshot & { snapshot?: PlanningSnapshot; message?: string; error?: string | { message?: string } };
    if (!response.ok) throw new Error(payload.message ?? (typeof payload.error === "string" ? payload.error : payload.error?.message) ?? `Unable to load section evidence (${response.status}).`);
    const snapshot = payload.snapshot ?? payload;
    if (!Array.isArray(snapshot.sectionPlans) || !Array.isArray(snapshot.evidenceRecords)) throw new Error("The server returned an incomplete section evidence response.");
    return snapshot;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("The request timed out. Refresh the section evidence to try again.");
    throw error;
  } finally { window.clearTimeout(timeout); }
}

export function SectionPlanningPanel({ reportJobId, initialSectionId, canEdit = false, onClose, onChanged }: Props) {
  const [snapshot, setSnapshot] = useState<PlanningSnapshot | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState(initialSectionId ?? "inspection-report");
  const [view, setView] = useState<"section" | "evidence">("section");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [evaluationDraft, setEvaluationDraft] = useState<EvaluationDraft | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [query, setQuery] = useState("");
  const [recordFilter, setRecordFilter] = useState<"all" | "review" | "unassigned" | "reused">("all");
  const [reviewId, setReviewId] = useState("");
  const [editMode, setEditMode] = useState<EditMode | null>(null);
  const [editingUseId, setEditingUseId] = useState("");
  const [destinationId, setDestinationId] = useState(initialSectionId ?? "inspection-report");
  const [slotKey, setSlotKey] = useState("");
  const [role, setRole] = useState<Role>("required_narrative");
  const [reason, setReason] = useState("");
  const [unitCode, setUnitCode] = useState("");
  const [entityId, setEntityId] = useState("");
  const [scopeApplicability, setScopeApplicability] = useState<"applicable" | "not_applicable">("applicable");
  const [scopeSlots, setScopeSlots] = useState<string[]>([]);
  const [scopeReason, setScopeReason] = useState("");
  const changed = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const reviewPane = useRef<HTMLElement>(null);
  const editForm = useRef<HTMLFormElement>(null);
  const mounted = useRef(true);
  const endpoint = `/api/v1/report-jobs/${encodeURIComponent(reportJobId)}`;
  const busy = isLoading || isSaving || isGenerating;

  useEffect(() => {
    mounted.current = true;
    dialog.current?.showModal();
    void requestSnapshot(`${endpoint}/section-plans`).then((next) => { if (mounted.current) setSnapshot(next); }).catch((failure: unknown) => { if (mounted.current) setError(failure instanceof Error ? failure.message : "Unable to load section evidence."); }).finally(() => { if (mounted.current) setIsLoading(false); });
    return () => { mounted.current = false; };
  }, [endpoint]);
  useEffect(() => { if (reviewId) reviewPane.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [reviewId]);
  useEffect(() => { if (editMode) editForm.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [editMode, editingUseId]);

  const selected = snapshot?.sectionPlans.find((plan) => plan.sectionId === selectedSectionId) ?? snapshot?.sectionPlans[0];
  const destination = snapshot?.sectionPlans.find((plan) => plan.sectionId === destinationId);
  const records = useMemo(() => new Map((snapshot?.evidenceRecords ?? []).map((entry) => [entry.evidenceId, entry])), [snapshot]);
  const record = records.get(reviewId);
  const usesByEvidence = useMemo(() => {
    const grouped = new Map<string, DestinationUse[]>();
    for (const plan of snapshot?.sectionPlans ?? []) for (const use of plan.evidenceUses) for (const id of use.evidenceIds) grouped.set(id, [...(grouped.get(id) ?? []), { ...use, plan }]);
    return grouped;
  }, [snapshot]);
  const issuesByEvidence = useMemo(() => {
    const grouped = new Map<string, ReviewIssue[]>();
    for (const issue of snapshot?.unresolvedEvidence ?? []) grouped.set(issue.evidenceId, [...(grouped.get(issue.evidenceId) ?? []), issue]);
    return grouped;
  }, [snapshot]);
  const recordUses = usesByEvidence.get(reviewId) ?? [];
  const requiredSlotKeys = [...new Set((selected?.evidenceUses ?? []).filter((use) => use.role !== "supporting").flatMap((use) => use.slotKey ? [use.slotKey] : []))];
  useEffect(() => {
    setScopeApplicability(selected?.scopeReviewDecision?.applicability ?? "applicable");
    setScopeSlots(selected?.scopeReviewDecision?.applicableSlotKeys ?? [...new Set((selected?.evidenceUses ?? []).filter((use) => use.role !== "supporting").flatMap((use) => use.slotKey ? [use.slotKey] : []))]);
    setScopeReason(selected?.scopeReviewDecision?.reason ?? "");
  }, [selected?.sectionId, snapshot?.snapshotId]);
  const visibleRecords = (snapshot?.evidenceRecords ?? []).filter((entry) => {
    const uses = usesByEvidence.get(entry.evidenceId) ?? [];
    const issues = issuesByEvidence.get(entry.evidenceId) ?? [];
    if (recordFilter === "review" && !issues.length) return false;
    if (recordFilter === "unassigned" && uses.length) return false;
    if (recordFilter === "reused" && uses.length < 2) return false;
    return [recordTitle(entry), entry.entityId, kindNames[entry.kind] ?? entry.kind, JSON.stringify(entry.captureContext), JSON.stringify(entry.locationRef), JSON.stringify(entry.payload.cells), ...uses.map((use) => `${use.plan.title} ${use.slotKey} ${roleNames[use.role]}`), ...issues.map((issue) => issue.detail ?? issue.reason)].join(" ").toLowerCase().includes(query.trim().toLowerCase());
  });
  const sectionIssues = [...issuesByEvidence.entries()].filter(([id, issues]) => selected?.evidenceUses.some((use) => use.evidenceIds.includes(id)) || issues.some((issue) => issue.candidateSections.includes(selected?.sectionId ?? "")));
  const allowedSlots = destination?.catalog.slots.filter((slot) => (!slot.allowedRoles || slot.allowedRoles.includes(role)) && (!record || (slot.evidenceKindsByRole?.[role] ? slot.evidenceKindsByRole[role]!.includes(record.kind) : role === "supporting" || role === "cross_reference" || slot.acceptedKinds.includes(record.kind)))) ?? [];
  const selectedSlot = allowedSlots.find((slot) => slot.slotKey === slotKey);
  const duplicateUse = recordUses.some((use) => use.plan.sectionId === destinationId && use.slotKey === slotKey && use.role === role && (editMode !== "update" || use.useId !== editingUseId));

  const close = () => {
    if (isSaving || isGenerating) return;
    onClose();
    if (changed.current) void onChanged?.();
  };
  const refresh = async (reclassify = false) => {
    setIsLoading(true); setError(""); setFeedback(""); setEditMode(null);
    try {
      const next = await requestSnapshot(`${endpoint}/${reclassify ? "classification-runs" : "section-plans"}`, reclassify ? { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" } : {});
      setSnapshot(next);
      if (reclassify) { changed.current = true; setFeedback("Assignments updated from the section outlines. Review missing information before generation."); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to refresh section evidence."); }
    finally { setIsLoading(false); }
  };
  const openEvidence = (evidenceId: string) => { setReviewId(evidenceId); setEditMode(null); setEditingUseId(""); setFeedback(""); };
  const startDecision = (mode: EditMode, use?: DestinationUse) => {
    if (!record) return;
    const candidate = (issuesByEvidence.get(record.evidenceId) ?? []).flatMap((issue) => issue.candidateSections).find((id) => snapshot?.sectionPlans.some((plan) => plan.sectionId === id));
    setEditMode(mode); setEditingUseId(use?.useId ?? ""); setDestinationId(use?.plan.sectionId ?? candidate ?? selected?.sectionId ?? "inspection-report");
    setSlotKey(use?.slotKey ?? ""); setRole(use?.role ?? (structuredKinds.has(record.kind) ? "required_structured" : "required_narrative"));
    setReason(""); setUnitCode(""); setEntityId(""); setError(""); setFeedback("");
  };
  const saveDecision = async (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot || !record || !canEdit || !editMode || reason.trim().length < 3 || (editMode !== "remove" && (!selectedSlot || duplicateUse)) || (editMode !== "add" && !editingUseId)) return;
    setIsSaving(true); setError(""); setFeedback("");
    try {
      const decision = { operation: editMode, evidenceId: record.evidenceId, reason: reason.trim(), ...(editMode !== "add" ? { useId: editingUseId } : {}), ...(editMode !== "remove" ? { sectionId: destinationId, slotKey, role, ...(unitCode ? { unitCode } : {}), ...(entityId.trim() ? { entityId: entityId.trim() } : {}) } : {}) };
      const next = await requestSnapshot(`${endpoint}/classification-decisions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedSnapshotId: snapshot.snapshotId, decision }) });
      setSnapshot(next); changed.current = true; setEditMode(null); setEditingUseId("");
      setFeedback(editMode === "remove" ? "This report use was removed. Other destinations are preserved." : "Report use saved. Review the affected sections before approval.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to save the report use."); }
    finally { setIsSaving(false); }
  };
  const saveScope = async (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot || !selected || !canEdit) return;
    setIsSaving(true); setError(""); setFeedback("");
    try {
      const next = await requestSnapshot(`${endpoint}/classification-decisions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedSnapshotId: snapshot.snapshotId, decision: { kind: "section_scope", sectionId: selected.sectionId, applicability: scopeApplicability, applicableSlotKeys: scopeApplicability === "not_applicable" ? [] : scopeSlots, reason: scopeReason.trim() } }) });
      setSnapshot(next); changed.current = true; setFeedback("Section scope saved. Required content is checked against the selected outline blocks.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to save section scope."); }
    finally { setIsSaving(false); }
  };
  const generateEvaluationDraft = async () => {
    if (!snapshot || !selected || !canEdit) return;
    setIsGenerating(true); setError(""); setFeedback("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 180_000);
    try {
      const response = await authenticatedFetch(`${endpoint}/outline-evaluations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sectionId: selected.sectionId, expectedSnapshotId: snapshot.snapshotId }), signal: controller.signal });
      const result = await response.json() as EvaluationDraft & { message?: string; error?: string | { message?: string } };
      if (!response.ok) throw new Error(result.message ?? (typeof result.error === "string" ? result.error : result.error?.message) ?? `Unable to generate evaluation draft (${response.status}).`);
      if (typeof result.generatedContent !== "string" || !result.sectionPlanningSnapshotId) throw new Error("The server returned an incomplete evaluation draft.");
      setEvaluationDraft({ ...result, sectionId: selected.sectionId, sectionTitle: selected.title });
      setFeedback("Evaluation draft generated. Review its required-content coverage and formatting below.");
    } catch (failure) {
      setError(failure instanceof DOMException && failure.name === "AbortError" ? "Evaluation generation timed out. Refresh before trying again." : failure instanceof Error ? failure.message : "Unable to generate evaluation draft.");
    } finally { window.clearTimeout(timeout); setIsGenerating(false); }
  };
  const renderRecordUses = (uses: EvidenceUse[]) => <div className="section-plan-records">{uses.flatMap((use, index) => use.evidenceIds.map((id) => {
    const item = records.get(id);
    if (!item) return null;
    const destinationCount = usesByEvidence.get(id)?.length ?? 0;
    return <details key={`${use.useId ?? index}-${id}`}><summary><span>{recordTitle(item)}</span><small>{roleNames[use.role]}{destinationCount > 1 ? ` · ${destinationCount} report uses` : ""}</small></summary><EvidenceDetails record={item} /><button type="button" disabled={busy} onClick={() => openEvidence(id)}>View all uses{canEdit ? " / edit" : ""}</button></details>;
  }))}</div>;

  return <dialog className="section-planning-dialog" ref={dialog} aria-labelledby="section-planning-title" onCancel={(event) => { event.preventDefault(); close(); }}>
    <header className="section-plan-header"><div><h2 id="section-planning-title">Evaluation outline and evidence</h2><p>Candidate framework · Review section outlines and evidence reuse for evaluation only.</p></div><button type="button" onClick={close} disabled={isSaving || isGenerating} aria-label="Close evaluation outline and evidence">Close</button></header>
    <div className="section-plan-controls">
      <div className="section-plan-view-switch" role="group" aria-label="Review view"><button type="button" aria-pressed={view === "section"} disabled={busy} onClick={() => setView("section")}>By section</button><button type="button" aria-pressed={view === "evidence"} disabled={busy} onClick={() => setView("evidence")}>By evidence</button></div>
      <button type="button" disabled={busy} onClick={() => void refresh()}>Refresh</button>{canEdit ? <button type="button" disabled={busy} onClick={() => void refresh(true)}>Update assignments</button> : <span>Read-only access</span>}<span>{issuesByEvidence.size} records need review</span>
    </div>
    {error ? <p className="section-plan-error" role="alert">{error}</p> : null}
    {feedback ? <p className="section-plan-feedback" role="status">{feedback}</p> : null}
    {isLoading ? <p className="section-plan-loading" role="status">Loading section evidence…</p> : null}
    {snapshot && selected ? <div className="section-plan-layout">
      {view === "section" ? <nav className="section-plan-nav" aria-label="Report section outlines">{snapshot.sectionPlans.map((plan) => <button type="button" key={plan.sectionId} disabled={busy} className={plan.sectionId === selected.sectionId ? "section-plan-selected" : ""} aria-current={plan.sectionId === selected.sectionId ? "page" : undefined} onClick={() => { setSelectedSectionId(plan.sectionId); setReviewId(""); setEditMode(null); }}><span>{plan.catalog.number}. {plan.title}</span><small className={plan.status === "ready" ? "section-plan-ready" : ""}>{statusName(plan)}</small></button>)}</nav> : null}
      <main className="section-plan-main">
        {view === "section" ? <>
          <h3>{selected.catalog.number}. {selected.title}</h3><p>{statusName(selected)} · {selected.outputObligations.length} required output {selected.outputObligations.length === 1 ? "item" : "items"}</p>
          <div className="section-plan-candidate-actions">{canEdit ? <button type="button" disabled={busy} onClick={() => void generateEvaluationDraft()}>{isGenerating ? "Generating evaluation draft…" : "Generate evaluation draft"}</button> : null}<p className="section-plan-muted">Evaluation results stay in this experiment. They do not update the report draft or promote a production policy.</p></div>
          {isGenerating ? <p className="section-plan-feedback" role="status">Generating this section from the current candidate outline and assigned evidence…</p> : null}
          {evaluationDraft && evaluationDraft.sectionId === selected.sectionId ? <EvaluationDraftPreview draft={evaluationDraft} currentSnapshotId={snapshot.snapshotId} /> : null}
          <details className="section-plan-card"><summary>Section scope · {selected.scopeReviewRequired ? "Review required" : "Reviewed"}</summary>{canEdit ? <form className="section-plan-scope-form" onSubmit={(event) => void saveScope(event)}><p>Confirm which outline blocks this inspection requires. Blocks with required captured content remain included.</p><label>Applicability<select value={scopeApplicability} disabled={busy} onChange={(event) => setScopeApplicability(event.target.value as "applicable" | "not_applicable")}><option value="applicable">Applicable to this report</option><option value="not_applicable" disabled={requiredSlotKeys.length > 0}>Not applicable to this report</option></select></label>{scopeApplicability === "applicable" ? <fieldset><legend>Applicable outline blocks</legend><div className="section-plan-scope-grid">{selected.catalog.slots.map((slot) => <label key={slot.slotKey}><input type="checkbox" checked={scopeSlots.includes(slot.slotKey)} disabled={busy || requiredSlotKeys.includes(slot.slotKey)} onChange={(event) => setScopeSlots((current) => event.target.checked ? [...current, slot.slotKey] : current.filter((key) => key !== slot.slotKey))} /><span>{slotTitle(slot)}{requiredSlotKeys.includes(slot.slotKey) ? " · captured content" : ""}</span></label>)}</div></fieldset> : <p>Explain why this section is excluded from the inspection scope. Missing records alone do not establish that it is not applicable.</p>}<label>Scope review reason<textarea required minLength={3} maxLength={2000} value={scopeReason} disabled={busy} onChange={(event) => setScopeReason(event.target.value)} placeholder="Confirm the inspection scope and why these blocks apply." /></label><button type="submit" disabled={busy || scopeReason.trim().length < 3 || (scopeApplicability === "applicable" && scopeSlots.length === 0)}>{isSaving ? "Saving…" : "Save section scope"}</button></form> : <p>{selected.scopeReviewDecision?.reason ?? "An inspector must confirm the applicable section content before approval."}</p>}</details>
          <section className="section-plan-card"><h4>Ordered section outline</h4><p className="section-plan-muted">Evidence is assigned to each block below. Supporting information is not required to be repeated in the report.</p><ol className="section-plan-outline">{selected.catalog.slots.map((slot, index) => {
            const uses = selected.evidenceUses.filter((use) => use.slotKey === slot.slotKey);
            const required = uses.filter((use) => use.role !== "supporting");
            const populated = required.length > 0;
            const applies = selected.scopeReviewDecision?.applicability === "applicable" && (selected.applicableSlotKeys ?? selected.scopeReviewDecision.applicableSlotKeys).includes(slot.slotKey);
            const reviewedOut = Boolean(selected.scopeReviewDecision && !applies);
            const blockStatus = populated ? "Populated" : applies ? "Missing required content" : reviewedOut ? "Not applicable" : uses.length ? "Supporting evidence only" : "Applicability needs review";
            const columns = slot.presentation?.columns?.map((column) => typeof column === "string" ? title(column) : column.title ?? column.label ?? title(column.key ?? "")).filter(Boolean);
            return <li key={slot.slotKey} className="section-plan-outline-block"><div className="section-plan-block-heading"><h5>{index + 1}. {slotTitle(slot)}</h5><span className={`section-plan-block-status ${populated ? "section-plan-populated" : applies ? "section-plan-missing" : ""}`}>{blockStatus}</span></div>{slot.purpose ? <p>{slot.purpose}</p> : null}<p className="section-plan-muted">Format: {title(slot.type ?? "Content block")}{columns?.length ? ` · Columns: ${columns.join(" / ")}` : ""}</p><p className="section-plan-muted">Accepts: {slot.acceptedKinds.map((kind) => kindNames[kind] ?? title(kind)).join(", ") || "Reviewed evidence"}</p>{slot.evidenceRules?.length ? <details className="section-plan-matching-rules"><summary>Evidence assignment rules ({slot.evidenceRules.length})</summary><ul>{slot.evidenceRules.map((rule) => <li key={rule.ruleId}>{rule.description}<small>{roleNames[rule.role]}</small></li>)}</ul></details> : slot.automaticAssignment === "reviewed_mapping_required" ? <p className="section-plan-muted">Assignment requires review; an automatic rule is not defined for this block yet.</p> : null}{populated && reviewedOut ? <p className="section-plan-attention">Captured content is outside the reviewed scope. Confirm this block’s applicability.</p> : null}{uses.length ? renderRecordUses(uses) : <p className="section-plan-muted">No evidence assigned to this block.</p>}</li>;
          })}</ol></section>
          {selected.missingRequirements.length ? <details className="section-plan-card"><summary>Information and review needed ({selected.missingRequirements.length})</summary><ul>{selected.missingRequirements.map((requirement) => <li key={requirement.requirementId}>{requirement.reason}</li>)}</ul></details> : null}
          {sectionIssues.length ? <section className="section-plan-card"><h4>Records needing confirmation ({sectionIssues.length})</h4><ul className="section-plan-issues">{sectionIssues.map(([id, issues]) => <li key={id}><p>{records.has(id) ? recordTitle(records.get(id)!) : "Captured record"}</p><ul>{issues.map((issue, index) => <li key={index}>{issue.detail || title(issue.reason)}</li>)}</ul><button type="button" disabled={busy} onClick={() => openEvidence(id)}>View record and all uses</button></li>)}</ul></section> : null}
        </> : <>
          <h3>Imported evidence and report uses</h3><p>One source record can populate multiple sections. Review each destination independently.</p>
          <div className="section-plan-evidence-controls"><label>Search evidence<input type="search" placeholder="Finding, component, reading or section" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label>Show<select value={recordFilter} onChange={(event) => setRecordFilter(event.target.value as typeof recordFilter)}><option value="all">All records</option><option value="review">Needs review</option><option value="unassigned">Unassigned</option><option value="reused">Multiple report uses</option></select></label></div>
          <p className="section-plan-muted" role="status">{visibleRecords.length} of {snapshot.evidenceRecords.length} records</p>
          <ul className="section-plan-evidence-list">{visibleRecords.map((entry) => {
            const uses = usesByEvidence.get(entry.evidenceId) ?? [];
            const issues = issuesByEvidence.get(entry.evidenceId) ?? [];
            return <li key={entry.evidenceId}><button type="button" disabled={busy} aria-pressed={reviewId === entry.evidenceId} onClick={() => openEvidence(entry.evidenceId)}><span className="section-plan-record-title">{recordTitle(entry)}</span><small>{kindNames[entry.kind] ?? title(entry.kind)} · {uses.length ? `${uses.length} report ${uses.length === 1 ? "use" : "uses"}` : "Unassigned"}{issues.length ? " · Needs review" : ""}</small>{uses.length ? <span className="section-plan-use-preview">{[...new Set(uses.map((use) => `${use.plan.catalog.number}. ${use.plan.title}`))].join(" · ")}</span> : null}</button></li>;
          })}</ul>{!visibleRecords.length ? <p className="section-plan-muted">No records match these filters.</p> : null}
        </>}
      </main>
      {record ? <aside className="section-plan-review" ref={reviewPane} aria-label="Selected evidence and report uses"><div className="section-plan-review-heading"><h3>Evidence details</h3><button type="button" disabled={busy} onClick={() => { setReviewId(""); setEditMode(null); }} aria-label="Close evidence details">Close</button></div><EvidenceDetails record={record} />
        {(issuesByEvidence.get(record.evidenceId) ?? []).length ? <div className="section-plan-attention"><strong>Needs review</strong><ul>{issuesByEvidence.get(record.evidenceId)?.map((issue, index) => <li key={index}>{issue.detail || title(issue.reason)}</li>)}</ul></div> : null}
        <h4>All report uses ({recordUses.length})</h4><p className="section-plan-muted">Each destination has its own content block and purpose.</p><ul className="section-plan-destinations">{recordUses.map((use, index) => <li key={use.useId ?? index}><strong>{use.plan.catalog.number}. {use.plan.title}</strong><p>{use.plan.catalog.slots.find((slot) => slot.slotKey === use.slotKey)?.title ?? title(use.slotKey ?? "Content block")}</p><p>{roleNames[use.role]}</p><small>{roleDescriptions[use.role]}</small>{canEdit ? <div className="section-plan-use-actions"><button type="button" disabled={busy || !use.useId} onClick={() => startDecision("update", use)}>Edit this use</button><button type="button" disabled={busy || !use.useId} onClick={() => startDecision("remove", use)}>Remove this use</button>{!use.useId ? <p className="section-plan-muted">Update assignments to review this earlier mapping.</p> : null}</div> : null}</li>)}</ul>{!recordUses.length ? <p className="section-plan-muted">This record has no report destinations yet.</p> : null}
        {canEdit && !editMode ? <button type="button" disabled={busy} onClick={() => startDecision("add")}>Add another report use</button> : null}
        {canEdit && editMode ? <form className="section-plan-assignment-form" ref={editForm} onSubmit={(event) => void saveDecision(event)}><h4>{editMode === "add" ? "Add report use" : editMode === "update" ? "Edit report use" : "Remove report use"}</h4>
          {editMode === "remove" ? <p>Remove this record from <strong>{destination?.title} → {destination?.catalog.slots.find((slot) => slot.slotKey === slotKey)?.title ?? title(slotKey)}</strong> ({roleNames[role]}). Its other destinations and source record will remain.</p> : <>
            <label>Report section<select value={destinationId} disabled={busy} onChange={(event) => { setDestinationId(event.target.value); setSlotKey(""); }}>{snapshot.sectionPlans.map((plan) => <option key={plan.sectionId} value={plan.sectionId}>{plan.catalog.number}. {plan.title}</option>)}</select></label>
            <label>Report use<select value={role} disabled={busy} onChange={(event) => { setRole(event.target.value as Role); setSlotKey(""); }}>{(Object.keys(roleNames) as Role[]).map((value) => <option key={value} value={value} disabled={value === "required_narrative" && structuredKinds.has(record.kind)}>{roleNames[value]}</option>)}</select></label><p className="section-plan-muted">{roleDescriptions[role]}</p>
            <label>Outline block<select required value={slotKey} disabled={busy} onChange={(event) => setSlotKey(event.target.value)}><option value="">Choose a block</option>{allowedSlots.map((slot) => <option key={slot.slotKey} value={slot.slotKey}>{slotTitle(slot)}</option>)}</select></label>{selectedSlot?.purpose ? <p className="section-plan-muted">{selectedSlot.purpose}</p> : null}{!allowedSlots.length ? <p className="section-plan-attention">This section has no outline block accepting this record and report use.</p> : null}{duplicateUse ? <p className="section-plan-attention">This destination and role already exist. Edit that use or choose another block.</p> : null}
            {record.kind === "measurement" ? <label>Confirm measurement unit, if needed<select value={unitCode} disabled={busy} onChange={(event) => setUnitCode(event.target.value)}><option value="">Keep current unit</option>{["mm", "cm", "m", "in", "ft"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label> : null}
            <label>Confirmed component identity, if needed<input value={entityId} disabled={busy} onChange={(event) => setEntityId(event.target.value)} placeholder={record.entityId ?? "Enter a stable component ID"} list="section-plan-entity-options" /></label><datalist id="section-plan-entity-options">{[...new Set(snapshot.evidenceRecords.flatMap((entry) => entry.entityId ? [entry.entityId] : []))].map((id) => <option key={id} value={id} />)}</datalist>{unitCode || entityId.trim() ? <p className="section-plan-muted">Unit and component confirmations apply to this evidence record across all its report uses.</p> : null}
          </>}
          <label>Reason for this change<textarea required minLength={3} maxLength={2000} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this record belongs here, or why this use should be removed." /></label><div className="section-plan-form-actions"><button type="submit" disabled={busy || reason.trim().length < 3 || (editMode !== "remove" && (!selectedSlot || duplicateUse))}>{isSaving ? "Saving…" : editMode === "remove" ? "Remove this use" : "Save report use"}</button><button type="button" disabled={busy} onClick={() => setEditMode(null)}>Cancel</button></div>
        </form> : null}
      </aside> : null}
    </div> : null}
  </dialog>;
}

function EvidenceDetails({ record }: { record: EvidenceRecord }) {
  const context = [record.captureContext?.screenKey, record.captureContext?.cardKey, record.locationRef?.targetKey, record.locationRef?.itemLabel].filter(Boolean).map(String);
  return <div className="section-plan-evidence"><p>{record.payload.text || recordTitle(record)}</p>{context.length ? <p className="section-plan-muted">Captured context: {context.join(" · ")}</p> : null}{record.entityId ? <p className="section-plan-muted">Component: {record.entityId}</p> : null}{record.sourceRef?.pointer ? <p className="section-plan-muted">Source: {record.sourceRef.pointer}</p> : null}{record.payload.cells ? <div className="section-plan-table-wrap"><table><thead><tr><th>Reading</th><th>Captured value</th><th>Unit</th></tr></thead><tbody>{record.payload.cells.map((cell) => <tr key={cell.key}><th>{title(cell.key)}</th><td>{cell.value == null ? "Not recorded" : String(cell.value)}</td><td>{cell.unitCode ?? record.payload.resolvedUnitCode ?? record.payload.unitCode ?? "Needs confirmation"}</td></tr>)}</tbody></table></div> : null}</div>;
}

function EvaluationDraftPreview({ draft, currentSnapshotId }: { draft: EvaluationDraft; currentSnapshotId: string }) {
  const coverage = draft.evalRun?.sectionPlanEvaluation?.truthGraphEvaluation;
  const missingCount = draft.evalRun?.sectionPlanEvaluation?.missingRequiredObligationIds?.length ?? 0;
  const stale = draft.sectionPlanningSnapshotId !== currentSnapshotId;
  const html = DOMPurify.sanitize(draft.generatedContent, {
    ALLOWED_TAGS: ["section", "div", "h2", "h3", "h4", "h5", "p", "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td", "strong", "em", "u", "span", "br", "hr", "figure", "figcaption", "img", "a"],
    ALLOWED_ATTR: ["class", "data-laiq-provenance", "colspan", "rowspan", "src", "alt", "width", "height", "href", "title"],
  });
  const describe = (item: unknown) => typeof item === "string" ? item : item && typeof item === "object" ? String((item as { message?: string; detail?: string; reason?: string }).message ?? (item as { detail?: string }).detail ?? (item as { reason?: string }).reason ?? "Generation review required") : "Generation review required";
  return <section className="section-plan-card section-plan-candidate-result" aria-label="Generated evaluation draft">
    <h4>Generated evaluation draft</h4>
    {stale ? <p className="section-plan-attention" role="status">The outline or evidence assignments have changed since this draft was generated. Generate again to evaluate the current snapshot.</p> : null}
    <p className="section-plan-muted">Candidate output · {draft.sectionTitle}</p>
    {typeof draft.evalRun?.summary === "string" ? <p>{draft.evalRun.summary}</p> : null}
    {coverage && typeof coverage.requiredFactCount === "number" && typeof coverage.matchedRequiredFactCount === "number" ? <p><strong>Required-content coverage:</strong> {coverage.matchedRequiredFactCount} of {coverage.requiredFactCount} planned requirements matched. These requirements still need independent review.</p> : null}
    {missingCount ? <p className="section-plan-attention">{missingCount} required output {missingCount === 1 ? "item was" : "items were"} not matched.</p> : null}
    {(draft.generationRun?.blockers?.length || draft.generationRun?.warnings?.length) ? <details><summary>Generation checks</summary><ul>{[...(draft.generationRun?.blockers ?? []), ...(draft.generationRun?.warnings ?? [])].map((item, index) => <li key={index}>{describe(item)}</li>)}</ul></details> : null}
    <div className="section-plan-generated-content" dangerouslySetInnerHTML={{ __html: html }} />
  </section>;
}
