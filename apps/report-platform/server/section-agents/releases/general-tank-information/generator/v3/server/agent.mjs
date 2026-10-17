import { createHash, randomUUID } from 'node:crypto';
import { escapeReportText as esc, parseSectionDocument, renderSectionDocumentHtml, validateSectionDocument } from './report-document.mjs';

export const AGENT_ID = 'general_tank_information';
export const AGENT_RELEASE = 'general_tank_information_v3';
export const REPORT_PROFILE = 'vertical_tank_inspection_v1';
export const SECTION_ID = 'general-tank-information';

export const FIELD_DEFINITIONS = Object.freeze([
  ['client', 'Client', true], ['clientRepresentative', 'Client Representative'], ['tankNumber', 'Tank Number', true],
  ['location', 'Location', true], ['yearBuilt', 'Year Built'], ['fieldLeaseName', 'Field/Lease Name'],
  ['manufacturer', 'Original Manufacturer'], ['heightM', 'Height', true, 'm'], ['constructionStandard', 'Original Construction Std'],
  ['serviceHeight', 'Service Height'], ['materialSpecification', 'Material Spec.'], ['diameterM', 'Diameter', true, 'm'],
  ['shellConstruction', 'Construction (Shell)'], ['productStored', 'Product Stored'], ['drawingReference', 'Drawing Ref'],
  ['specificGravity', 'Specific Gravity'], ['roofType', 'Roof Type'], ['designTemperature', 'Design Temp.'],
  ['internalPressure', 'Internal Pres.'], ['shellCourseCount', 'Total Shell Course'], ['floorPlateCount', 'Total Floor Plates'],
  ['roofPlateCount', 'Total Roof Plates'], ['floorPlateThickness', 'Floor Plate Thickness'], ['windGirder', 'Wind Girder'],
  ['annularPlateCount', 'Total Annular Plates'], ['insulated', 'Insulated'], ['annularPlateThickness', 'Annular Plate Thickness'],
  ['stiffener', 'Stiffener'], ['externalHistory', 'External'], ['internalHistory', 'Internal'], ['bottomHistory', 'Bottom'],
].map(([key, label, required = false, unit = null]) => Object.freeze({ key, label, required, unit, history: key.endsWith('History') })));

export const FIELD_SOURCE_POLICY = Object.freeze({
  client: { primary: 'client' },
  clientRepresentative: { primary: 'clientRepresentative' },
  tankNumber: { primary: 'tankNumber' },
  location: { primary: 'location' },
  yearBuilt: { primary: 'yearBuilt' },
  fieldLeaseName: { primary: 'fieldLeaseName' },
  manufacturer: { primary: 'originalManufacturer' },
  heightM: { primary: 'heightM', corroborating: ['height'] },
  constructionStandard: { primary: 'originalConstructionStd' },
  serviceHeight: { primary: 'serviceHeight' },
  materialSpecification: { primary: 'materialSpec' },
  diameterM: { primary: 'diameterM', corroborating: ['diameter'] },
  shellConstruction: { primary: 'shellConstruction' },
  productStored: { primary: 'productStored' },
  drawingReference: { primary: 'drawingRef' },
  specificGravity: { primary: 'specificGravity' },
  roofType: { primary: 'roofType' },
  designTemperature: { primary: 'designTemp' },
  internalPressure: { primary: 'internalPressure' },
  shellCourseCount: { primary: 'shellCourseCount', corroborating: ['courseNumber'] },
  floorPlateCount: { primary: 'floorPlateNumber' },
  roofPlateCount: { primary: 'roofPlateNumber' },
  floorPlateThickness: { primary: 'floorPlateThickness' },
  windGirder: { primary: 'windGirder' },
  annularPlateCount: { primary: 'annularPlateNumber' },
  insulated: { primary: 'insulated' },
  annularPlateThickness: { primary: 'annularPlateThickness' },
  stiffener: { primary: 'stiffener' },
  externalHistory: { primary: 'previousExternal' },
  internalHistory: { primary: 'previousInternal' },
  bottomHistory: { primary: 'previousBottom' },
});

export const AUXILIARY_EVIDENCE_POLICY = Object.freeze({
  inspector: 'Owned by report-level inspection metadata; retained in trace and not repeated in this 31-field body.',
  jobNo: 'Owned by the report header; retained in trace and not repeated in this section body.',
  dateCompleted: 'Owned by the report header; retained in trace and not repeated in this section body.',
  externalRoofType: 'Capture applicability flag; the reviewed body uses the explicit roofType field.',
  internalRoofType: 'Capture applicability flag; retained for downstream applicability and not rendered as tank construction.',
  shellLaneCount: 'Measurement-layout configuration; owned by the shell layout and measurement sections.',
  referenceMode: 'Layout orientation metadata; owned by layout sections.',
  referenceNote: 'Layout orientation note; owned by layout sections.',
  insulationDistance: 'Supplementary insulation geometry has no reviewed V3 body slot and remains trace-visible.',
});

export const AGENT_POLICY = Object.freeze({
  agentId: AGENT_ID,
  releaseVersion: AGENT_RELEASE,
  reportProfileId: REPORT_PROFILE,
  sectionId: SECTION_ID,
  title: '3 GENERAL TANK INFORMATION',
  generationMode: 'deterministic_routed_labelled_fields',
  aiEnabled: false,
  runtimeRetrievalEnabled: false,
  productEnabled: false,
});

const present = value => value !== null && value !== undefined && String(value).trim() !== '';
const scalar = value => typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
const unknown = value => /^(?:not provided|not recorded|not available|unknown(?: carbon steel)?|pending confirmation|-)$/i.test(String(value).trim());
const sha256 = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normalize = value => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

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
  if (evidenceSnapshot?.contractVersion !== 'section_agent_evidence_snapshot_v1'
      || evidenceSnapshot.sectionId !== SECTION_ID
      || evidenceSnapshot.sectionProjection?.contractVersion !== 'section_evidence_projection_v2'
      || evidenceSnapshot.sectionProjection?.sectionId !== SECTION_ID
      || evidenceSnapshot.sectionProjection?.routingStatus !== 'routing_ready'
      || evidenceSnapshot.sectionProjection?.readinessScope !== 'evidence_routing_only'
      || evidenceSnapshot.sectionProjection?.blockers?.length
      || evidenceSnapshot.routerBinding?.releaseId !== 'report-evidence-router_v2'
      || sectionPlan.evidenceBinding?.sectionProjectionSha256 !== evidenceSnapshot.routerBinding?.sectionProjectionSha256
      || sectionPlan.evidenceBinding?.inputPackageHash !== evidenceSnapshot.sourceImport?.inputPackageHash) {
    throw new Error('A frozen routed General Tank Information evidence snapshot is required.');
  }
  if (evidenceSnapshot.sourceImport.packageType !== 'v3_product_export'
      || evidenceSnapshot.sourceImport.schemaVersion !== 3 || !evidenceSnapshot.sourceImport.inspectionId) {
    throw new Error('A current Android V3 import is required.');
  }
}

function recordMap(projection, issues) {
  const byKey = new Map();
  for (const record of projection.evidenceRecords ?? []) {
    const fieldKey = record.payload?.fieldKey;
    if (record.kind !== 'identity' || record.sourceClass !== 'app_field' || !fieldKey) {
      issues.push({ fieldKey: fieldKey ?? record.evidenceId, state: 'unsupported', blocking: true,
        reasons: ['General Tank Information projection contains a non-field or non-app evidence record.'] });
      continue;
    }
    if (!byKey.has(fieldKey)) byKey.set(fieldKey, []);
    byKey.get(fieldKey).push(record);
  }
  for (const [fieldKey, records] of byKey) if (records.length !== 1) {
    issues.push({ fieldKey, state: 'conflict', blocking: true,
      reasons: ['Routed field key must resolve to exactly one atomic evidence record.'] });
  }
  return byKey;
}

function comparable(fieldKey, value) {
  if (['heightM', 'diameterM'].includes(fieldKey)) {
    const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : Number.NaN;
  }
  if (fieldKey === 'shellCourseCount') return Number(value);
  return normalize(value);
}

function compileFields(evidenceSnapshot) {
  const projection = evidenceSnapshot.sectionProjection;
  const issues = [];
  const fields = [];
  const dispositions = [];
  const accounted = new Set();
  const byKey = recordMap(projection, issues);

  for (const definition of FIELD_DEFINITIONS) {
    const { key, label, required, unit } = definition;
    const policy = FIELD_SOURCE_POLICY[key];
    const records = byKey.get(policy.primary) ?? [];
    const primary = records.length === 1 ? records[0] : null;
    let value = present(primary?.payload?.value) ? primary.payload.value : null;
    let state = present(value) ? 'supplied' : 'missing';
    const reasons = [];
    if (primary) {
      accounted.add(primary.evidenceId);
      dispositions.push({ evidenceId: primary.evidenceId, fieldKey: key, status: 'rendered', reason: `Primary routed source for ${key}.` });
      if (!scalar(value)) reasons.push('Field must contain a scalar value.');
      if (unit && (!Number.isFinite(Number(value)) || Number(value) <= 0 || primary.payload?.unitCode !== unit)) {
        reasons.push(`Dimension requires a positive number with explicit ${unit} units.`);
      }
      if (key === 'shellCourseCount' && (!Number.isInteger(Number(value)) || Number(value) <= 0)) {
        reasons.push('Shell course count requires a positive integer.');
      }
    }
    for (const corroboratingKey of policy.corroborating ?? []) {
      const corroboratingRecords = byKey.get(corroboratingKey) ?? [];
      if (corroboratingRecords.length !== 1) {
        if (corroboratingRecords.length > 1) reasons.push(`Corroborating ${corroboratingKey} is duplicated.`);
        continue;
      }
      const corroborating = corroboratingRecords[0];
      accounted.add(corroborating.evidenceId);
      dispositions.push({ evidenceId: corroborating.evidenceId, fieldKey: key, status: 'corroborating', reason: `Cross-check for ${key}; not rendered twice.` });
      const expected = comparable(key, value);
      const observed = comparable(key, corroborating.payload?.value);
      if ((typeof expected === 'number' && (!Number.isFinite(expected) || !Number.isFinite(observed) || expected !== observed))
          || (typeof expected !== 'number' && expected !== observed)) {
        reasons.push(`Primary ${policy.primary} conflicts with corroborating ${corroboratingKey}.`);
      }
    }
    if (reasons.length) {
      state = 'conflict';
      value = null;
    } else if (unknown(value)) state = 'unknown';
    else if (/^not applicable$/i.test(String(value))) state = 'not_applicable';
    if (required && ['missing', 'unknown', 'not_applicable'].includes(state)) {
      reasons.push(`Required ${label.toLowerCase()} is not established.`);
    }
    if (reasons.length || state === 'missing') {
      issues.push({ fieldKey: key, state, blocking: required || reasons.length > 0,
        reasons: reasons.length ? reasons : ['Not recorded in the routed app evidence.'] });
    }
    const displayValue = value === null
      ? state === 'conflict' ? 'Conflicting inputs — review required' : 'Not recorded'
      : `${value}${unit && !unknown(value) && state !== 'not_applicable' ? ` ${unit}` : ''}`;
    const sourceRecords = [primary, ...(policy.corroborating ?? []).flatMap(sourceKey => byKey.get(sourceKey) ?? [])].filter(Boolean);
    fields.push({ ...definition, value, displayValue, state,
      sourceClass: primary?.sourceClass ?? null,
      sourcePointer: primary?.sourceRef?.pointer ?? null,
      sourceEvidenceIds: sourceRecords.map(record => record.evidenceId),
      sourceRefs: sourceRecords.map(record => record.sourceRef),
      evidenceId: `general-info:${key}`,
      sourceValue: primary?.payload?.value ?? null,
    });
  }

  for (const [fieldKey, reason] of Object.entries(AUXILIARY_EVIDENCE_POLICY)) {
    for (const record of byKey.get(fieldKey) ?? []) {
      accounted.add(record.evidenceId);
      dispositions.push({ evidenceId: record.evidenceId, fieldKey, status: 'delegated', reason });
    }
  }
  const unaccounted = (projection.evidenceRecords ?? []).filter(record => !accounted.has(record.evidenceId));
  for (const record of unaccounted) issues.push({ fieldKey: record.payload?.fieldKey ?? record.evidenceId,
    state: 'unaccounted', blocking: true, reasons: ['Routed evidence has no reviewed output or delegation rule.'] });
  return { fields, issues, dispositions, unaccounted };
}

function renderFields({ fields, planId }) {
  const fieldHtml = field => `<p data-evidence-id="${esc(field.evidenceId)}" data-source-evidence-ids="${esc(field.sourceEvidenceIds.join(','))}" data-laiq-provenance="${field.sourceEvidenceIds.length ? 'app_field' : 'not_recorded'}">➢ <strong>${esc(field.label)}:</strong> ${esc(field.displayValue)}</p>`;
  const main = fields.filter(field => !field.history);
  const rows = [`<tr><td colspan="2">${fieldHtml(main[0])}</td></tr>`];
  for (let index = 1; index < main.length; index += 2) {
    rows.push(`<tr><td>${fieldHtml(main[index])}</td><td>${main[index + 1] ? fieldHtml(main[index + 1]) : ''}</td></tr>`);
  }
  const history = fields.filter(field => field.history).map(field => `<td>${fieldHtml(field)}</td>`).join('');
  const html = `<section data-section-id="${SECTION_ID}"><h2>${AGENT_POLICY.title}</h2><table data-report-format="paired-fields"><tbody>${rows.join('')}</tbody></table><h3>Previous Inspection History</h3><table data-report-format="paired-fields"><tbody><tr>${history}</tr></tbody></table></section>`;
  const document = parseSectionDocument({ sectionId: SECTION_ID, html, planId });
  return { document, content: renderSectionDocumentHtml(document), check: validateSectionDocument(document) };
}

/** Deterministic: no model, network, filesystem, source report or KB access. */
export function executeGeneralTankInformation(execution) {
  validateExecution(execution);
  const before = sha256(execution);
  const { fields, issues, dispositions, unaccounted } = compileFields(execution.evidenceSnapshot);
  const rendered = renderFields({ fields, planId: execution.sectionPlan.sectionPlanId });
  const blockers = issues.filter(issue => issue.blocking).flatMap(issue => issue.reasons);
  blockers.push(...rendered.check.issues);
  if (sha256(execution) !== before) throw new Error('Section agent mutated its execution input.');
  const runId = randomUUID();
  return {
    contractVersion: 'section_agent_result_v1',
    reportPlanRef: execution.reportPlanRef,
    sectionPlanRef: {
      sectionPlanId: execution.sectionPlan.sectionPlanId,
      sectionPlanSha256: execution.sectionPlan.sectionPlanSha256,
      evidenceSnapshotSha256: execution.sectionPlan.evidenceSnapshotSha256,
      evidenceBinding: execution.sectionPlan.evidenceBinding,
    },
    section: { sectionInstanceId: execution.sectionPlan.sectionInstanceId, sectionId: SECTION_ID,
      title: AGENT_POLICY.title, agentId: AGENT_ID, releaseVersion: AGENT_RELEASE },
    draft: { content: rendered.content, document: rendered.document, generated: true, edited: false,
      approved: false, reviewRequired: true },
    validation: { valid: blockers.length === 0, blockers,
      warnings: [
        ...issues.filter(issue => !issue.blocking).map(issue => `${issue.fieldKey}: ${issue.reasons.join(' ')}`),
        ...dispositions.filter(item => item.status === 'delegated').map(item => `${item.fieldKey}: ${item.reason}`),
      ],
      checks: { protectedFieldCount: FIELD_DEFINITIONS.length, documentValid: rendered.check.valid,
        projectedEvidenceCount: execution.evidenceSnapshot.sectionProjection.evidenceRecords.length,
        accountedEvidenceCount: dispositions.length, unaccountedEvidenceCount: unaccounted.length,
        routedProjectionUsed: true, currentFactsFromHistoricalSources: false,
        runtimeRetrievalUsed: false, liveModelUsed: false } },
    trace: { runId, generatedAtIso: new Date().toISOString(), executionMode: execution.executionMode,
      inputSha256: before, routerReleaseId: execution.evidenceSnapshot.routerBinding.releaseId,
      sectionProjectionSha256: execution.evidenceSnapshot.routerBinding.sectionProjectionSha256,
      providerCode: 'deterministic', modelId: null, retrievalKeys: [], approvalStatus: 'not_approved' },
    evaluationEvidence: { fields, issues, evidenceDisposition: dispositions, unaccountedEvidenceIds: unaccounted.map(record => record.evidenceId) },
  };
}
