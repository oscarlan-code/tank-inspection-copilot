import { createHash, randomUUID } from 'node:crypto';
import { escapeReportText as esc, parseSectionDocument, renderSectionDocumentHtml, validateSectionDocument } from './report-document.mjs';

export const AGENT_ID = 'scope_of_inspection';
export const AGENT_RELEASE = 'scope_of_inspection_v1';
export const REPORT_PROFILE = 'vertical_tank_inspection_v1';
export const SECTION_ID = 'scope-of-inspection';

export const CLAIM_POLICY = Object.freeze({
  contractVersion: 'scope_confirmation_v1',
  claimKinds: Object.freeze(['inspection_activity', 'deliverable']),
  claimKeys: Object.freeze(['claimId', 'order', 'kind', 'action', 'target', 'method', 'extent', 'conditions',
    'controlledReferences', 'appEvidenceRefs', 'confirmed', 'sourceRefs']),
  sourceRefKeys: Object.freeze(['sourceType', 'sourceId']),
  appEvidenceKinds: Object.freeze(['app_task', 'app_layout_target', 'app_voice_note', 'app_checklist_item']),
});

export const AGENT_POLICY = Object.freeze({
  agentId: AGENT_ID,
  releaseVersion: AGENT_RELEASE,
  reportProfileId: REPORT_PROFILE,
  sectionId: SECTION_ID,
  title: '1 SCOPE OF INSPECTION',
  generationMode: 'deterministic_confirmed_scope_compiler',
  aiEnabled: false,
  runtimeRetrievalEnabled: false,
  productEnabled: false,
});

const sha256 = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const list = value => value === undefined ? [] : Array.isArray(value) ? value : null;
const sentence = value => `${String(value).trim().replace(/[.\s]+$/g, '')}.`;

function validateExecution(execution) {
  if (!execution || execution.contractVersion !== 'section_agent_execution_v1' || execution.executionMode !== 'evaluation') {
    throw new Error('Unsupported section-agent execution contract or mode.');
  }
  const { reportPlanRef, sectionPlan, evidenceSnapshot } = execution;
  if (reportPlanRef?.reportProfileId !== REPORT_PROFILE || sectionPlan?.sectionId !== SECTION_ID
      || sectionPlan?.sectionInstanceId !== reportPlanRef?.sectionInstanceId
      || sectionPlan?.agentBinding?.agentId !== AGENT_ID
      || sectionPlan?.agentBinding?.releaseVersion !== AGENT_RELEASE) {
    throw new Error('Execution is not bound to this agent release.');
  }
  if (sectionPlan.approvalState !== 'not_approved') throw new Error('Generation cannot receive an approved SectionPlan.');
  const pkg = evidenceSnapshot?.exportPackage;
  if (pkg?.packageType !== 'v3_product_export' || pkg?.schemaVersion !== 3
      || !text(pkg.inspectionId) || !pkg.inspectionRecord) {
    throw new Error('A current Android V3 inspection evidence snapshot is required.');
  }
}

function collectAppEvidenceIds(exportPackage) {
  const ids = new Map(CLAIM_POLICY.appEvidenceKinds.map(kind => [kind, new Set()]));
  for (const row of exportPackage.taskSnapshots ?? []) {
    for (const value of [row.taskId, row.id, row.taskKey]) if (text(value)) ids.get('app_task').add(String(value));
  }
  for (const row of exportPackage.layoutTargets ?? []) {
    for (const value of [row.layoutTargetId, row.id, row.targetId, row.targetKey]) if (text(value)) ids.get('app_layout_target').add(String(value));
  }
  for (const row of exportPackage.voiceNotes ?? []) {
    for (const value of [row.voiceNoteId, row.id]) if (text(value)) ids.get('app_voice_note').add(String(value));
  }
  for (const row of exportPackage.checklist ?? []) {
    for (const value of [row.checklistItemId, row.itemId, row.id]) if (text(value)) ids.get('app_checklist_item').add(String(value));
  }
  return ids;
}

function validateRefs(refs, label, issues, appEvidenceIds = null) {
  if (!Array.isArray(refs) || refs.length === 0) {
    issues.push(`${label} requires at least one source reference.`);
    return [];
  }
  return refs.map((ref, index) => {
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)
        || Object.keys(ref).some(key => !CLAIM_POLICY.sourceRefKeys.includes(key))
        || !text(ref.sourceType) || !text(ref.sourceId)) {
      issues.push(`${label} source reference ${index + 1} is invalid.`);
      return null;
    }
    const normalized = { sourceType: ref.sourceType.trim(), sourceId: ref.sourceId.trim() };
    if (CLAIM_POLICY.appEvidenceKinds.includes(normalized.sourceType)
        && appEvidenceIds && !appEvidenceIds.get(normalized.sourceType)?.has(normalized.sourceId)) {
      issues.push(`${label} references missing ${normalized.sourceType} ${normalized.sourceId}.`);
    }
    return normalized;
  }).filter(Boolean);
}

function normalizeConfirmedTextRows(rows, label, issues, appEvidenceIds) {
  if (rows === undefined) return [];
  if (!Array.isArray(rows)) {
    issues.push(`${label} must be an array.`);
    return [];
  }
  return rows.map((row, index) => {
    const issueCount = issues.length;
    const allowed = new Set(['recordId', 'order', 'text', 'confirmed', 'sourceRefs']);
    if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(key => !allowed.has(key))) {
      issues.push(`${label} ${index + 1} contains unsupported properties.`);
      return null;
    }
    if (!text(row.recordId) || !Number.isInteger(row.order) || !text(row.text) || row.confirmed !== true) {
      issues.push(`${label} ${index + 1} is incomplete or unconfirmed.`);
    }
    const normalized = { recordId: text(row.recordId), order: row.order, text: text(row.text), confirmed: row.confirmed === true,
      sourceRefs: validateRefs(row.sourceRefs, `${label} ${index + 1}`, issues, appEvidenceIds) };
    return issues.length === issueCount ? normalized : null;
  }).filter(Boolean);
}

function compileScope(evidenceSnapshot) {
  const confirmation = evidenceSnapshot.scopeConfirmation;
  const issues = [];
  const confirmationIssueCount = issues.length;
  if (!confirmation || confirmation.contractVersion !== CLAIM_POLICY.contractVersion || confirmation.confirmed !== true
      || !text(confirmation.confirmedBy) || !text(confirmation.confirmedAtIso)) {
    issues.push('A complete and explicitly confirmed scope_confirmation_v1 record is required.');
  }
  const allowedConfirmationKeys = new Set(['contractVersion', 'confirmed', 'confirmedBy', 'confirmedAtIso',
    'sourceRefs', 'claims', 'limitations', 'exclusions']);
  if (confirmation && Object.keys(confirmation).some(key => !allowedConfirmationKeys.has(key))) {
    issues.push('Scope confirmation contains unsupported properties.');
  }
  const appEvidenceIds = collectAppEvidenceIds(evidenceSnapshot.exportPackage);
  const confirmationRefs = validateRefs(confirmation?.sourceRefs, 'Scope confirmation', issues, appEvidenceIds);
  const confirmationValid = issues.length === confirmationIssueCount;
  if (!Array.isArray(confirmation?.claims) || confirmation.claims.length === 0) {
    issues.push('At least one confirmed scope claim is required.');
  }
  const claims = (confirmation?.claims ?? []).map((claim, index) => {
    const issueCount = issues.length;
    if (!claim || typeof claim !== 'object' || Array.isArray(claim)) {
      issues.push(`Scope claim ${index + 1} is invalid.`);
      return null;
    }
    for (const key of Object.keys(claim)) {
      if (!CLAIM_POLICY.claimKeys.includes(key)) issues.push(`Scope claim ${index + 1} contains unsupported property ${key}.`);
    }
    const conditions = list(claim.conditions);
    const controlledReferences = list(claim.controlledReferences);
    const appEvidenceRefs = list(claim.appEvidenceRefs);
    if (!text(claim.claimId) || !Number.isInteger(claim.order) || !CLAIM_POLICY.claimKinds.includes(claim.kind)
        || !text(claim.action) || !text(claim.target) || claim.confirmed !== true
        || conditions === null || controlledReferences === null || appEvidenceRefs === null
        || [...(conditions ?? []), ...(controlledReferences ?? [])].some(value => !text(value))) {
      issues.push(`Scope claim ${index + 1} is incomplete, malformed or unconfirmed.`);
    }
    const refs = validateRefs(claim.sourceRefs, `Scope claim ${index + 1}`, issues, appEvidenceIds);
    const appRefs = (appEvidenceRefs ?? []).map((ref, refIndex) => {
      if (!ref || typeof ref !== 'object' || Array.isArray(ref)
          || Object.keys(ref).some(key => !['kind', 'id'].includes(key))
          || !CLAIM_POLICY.appEvidenceKinds.includes(ref.kind) || !text(ref.id)
          || !appEvidenceIds.get(ref.kind)?.has(ref.id.trim())) {
        issues.push(`Scope claim ${index + 1} app evidence reference ${refIndex + 1} cannot be resolved.`);
        return null;
      }
      return { kind: ref.kind, id: ref.id.trim() };
    }).filter(Boolean);
    const normalized = { claimId: text(claim.claimId), order: claim.order, kind: claim.kind,
      action: text(claim.action), target: text(claim.target), method: text(claim.method), extent: text(claim.extent),
      conditions: (conditions ?? []).map(value => value.trim()),
      controlledReferences: (controlledReferences ?? []).map(value => value.trim()),
      appEvidenceRefs: appRefs, confirmed: claim.confirmed === true, sourceRefs: refs };
    return confirmationValid && issues.length === issueCount ? normalized : null;
  }).filter(Boolean);
  const orders = claims.map(claim => claim.order);
  const expected = claims.map((_, index) => index + 1);
  if (new Set(claims.map(claim => claim.claimId)).size !== claims.length) issues.push('Scope claim IDs must be unique.');
  if (new Set(orders).size !== orders.length || orders.some((value, index) => value !== expected[index])) {
    issues.push('Scope claim order must be unique, sequential and match the supplied array.');
  }
  const limitations = normalizeConfirmedTextRows(confirmation?.limitations, 'Scope limitation', issues, appEvidenceIds);
  const exclusions = normalizeConfirmedTextRows(confirmation?.exclusions, 'Scope exclusion', issues, appEvidenceIds);
  for (const [label, rows] of [['Scope limitation', limitations], ['Scope exclusion', exclusions]]) {
    if (rows.some((row, index) => row.order !== index + 1)) issues.push(`${label} order must be sequential.`);
  }
  return { confirmation, confirmationRefs, claims, limitations, exclusions, issues };
}

function claimText(claim) {
  const fragments = [`To ${claim.action} ${claim.target}`];
  if (claim.method) fragments.push(`using ${claim.method}`);
  if (claim.extent) fragments.push(claim.extent);
  if (claim.conditions.length) fragments.push(claim.conditions.join('; '));
  if (claim.controlledReferences.length) fragments.push(`in accordance with ${claim.controlledReferences.join(' and ')}`);
  return sentence(fragments.join(', '));
}

function renderScope({ claims, limitations, exclusions, planId }) {
  const row = (evidenceId, provenance, value) => `<p data-evidence-id="${esc(evidenceId)}" data-laiq-provenance="${esc(provenance)}">➢ ${esc(value)}</p>`;
  const body = claims.map(claim => row(`scope-claim:${claim.claimId}`, 'confirmed_scope_claim', claimText(claim)));
  body.push(...limitations.map(item => row(`scope-limitation:${item.recordId}`, 'confirmed_scope_limitation', sentence(`Scope limitation: ${item.text}`))));
  body.push(...exclusions.map(item => row(`scope-exclusion:${item.recordId}`, 'confirmed_scope_exclusion', sentence(`Excluded from this inspection: ${item.text}`))));
  const html = `<section data-section-id="${SECTION_ID}" data-report-format="component-narrative"><h2>${AGENT_POLICY.title}</h2>${body.join('')}</section>`;
  const document = parseSectionDocument({ sectionId: SECTION_ID, html, planId });
  return { document, content: renderSectionDocumentHtml(document), check: validateSectionDocument(document) };
}

/** Deterministic: no model, network, filesystem, source report or KB access. */
export function executeScopeOfInspection(execution) {
  validateExecution(execution);
  const before = sha256(execution);
  const compiled = compileScope(execution.evidenceSnapshot);
  const rendered = renderScope({ ...compiled, planId: execution.sectionPlan.sectionPlanId });
  const blockers = [...compiled.issues, ...rendered.check.issues];
  if (sha256(execution) !== before) throw new Error('Section agent mutated its execution input.');
  return {
    contractVersion: 'section_agent_result_v1',
    reportPlanRef: execution.reportPlanRef,
    sectionPlanRef: { sectionPlanId: execution.sectionPlan.sectionPlanId,
      sectionPlanSha256: execution.sectionPlan.sectionPlanSha256,
      evidenceSnapshotSha256: execution.sectionPlan.evidenceSnapshotSha256 },
    section: { sectionInstanceId: execution.sectionPlan.sectionInstanceId, sectionId: SECTION_ID,
      title: AGENT_POLICY.title, agentId: AGENT_ID, releaseVersion: AGENT_RELEASE },
    draft: { content: rendered.content, document: rendered.document, generated: true, edited: false,
      approved: false, reviewRequired: true },
    validation: { valid: blockers.length === 0, blockers, warnings: [],
      checks: { confirmedScopeRequired: true, scopeClaimCount: compiled.claims.length,
        limitationCount: compiled.limitations.length, exclusionCount: compiled.exclusions.length,
        documentValid: rendered.check.valid, currentFactsFromHistoricalSources: false,
        completedTasksTreatedAsScope: false, runtimeRetrievalUsed: false, liveModelUsed: false } },
    trace: { runId: randomUUID(), generatedAtIso: new Date().toISOString(), executionMode: execution.executionMode,
      inputSha256: before, providerCode: 'deterministic', modelId: null, retrievalKeys: [], approvalStatus: 'not_approved' },
    evaluationEvidence: { confirmation: { confirmed: compiled.confirmation?.confirmed === true,
      confirmedBy: compiled.confirmation?.confirmedBy ?? null, confirmedAtIso: compiled.confirmation?.confirmedAtIso ?? null,
      sourceRefs: compiled.confirmationRefs }, claims: compiled.claims, limitations: compiled.limitations,
      exclusions: compiled.exclusions, issues: compiled.issues },
  };
}
