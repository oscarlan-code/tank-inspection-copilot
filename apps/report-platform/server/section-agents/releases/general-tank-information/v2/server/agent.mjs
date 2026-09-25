import { createHash, randomUUID } from 'node:crypto';
import { escapeReportText as esc, parseSectionDocument, renderSectionDocumentHtml, validateSectionDocument } from './report-document.mjs';

export const AGENT_ID = 'general_tank_information';
export const AGENT_RELEASE = 'general_tank_information_v2';
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

export const AGENT_POLICY = Object.freeze({
  agentId: AGENT_ID,
  releaseVersion: AGENT_RELEASE,
  reportProfileId: REPORT_PROFILE,
  sectionId: SECTION_ID,
  title: '3 GENERAL TANK INFORMATION',
  generationMode: 'deterministic_labelled_fields',
  aiEnabled: false,
  runtimeRetrievalEnabled: false,
  productEnabled: false,
});

const nativeKeys = new Set(['client', 'tankNumber', 'location', 'fieldLeaseName', 'heightM', 'diameterM', 'shellCourseCount']);
const identityKeys = ['client', 'tankNumber', 'location'];
const present = value => value !== null && value !== undefined && String(value).trim() !== '';
const scalar = value => typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
const same = (a, b) => String(a).trim() === String(b).trim();
const unknown = value => /^(?:not provided|not recorded|not available|unknown(?: carbon steel)?|pending confirmation|-)$/i.test(String(value).trim());
const sha256 = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

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
  if (!evidenceSnapshot?.exportPackage?.inspectionId || !evidenceSnapshot.exportPackage.inspectionRecord) {
    throw new Error('Current imported inspection evidence is required.');
  }
}

function compileFields(evidenceSnapshot) {
  const { exportPackage, manualSupplement = {} } = evidenceSnapshot;
  const native = exportPackage.inspectionRecord;
  const supplement = manualSupplement.generalTankInformation ?? {};
  if (!supplement || typeof supplement !== 'object' || Array.isArray(supplement)) {
    throw new Error('General information supplement must contain named field records.');
  }
  const issues = [];
  const fields = [];
  for (const definition of FIELD_DEFINITIONS) {
    const { key, label, required, unit } = definition;
    const nativeValue = nativeKeys.has(key) ? native[key] : undefined;
    const extra = supplement[key];
    let value = null;
    let sourceClass = null;
    let sourcePointer = null;
    let provenance = null;
    let state = 'missing';
    const reasons = [];

    if (present(nativeValue)) {
      value = nativeValue;
      sourceClass = 'app_field';
      sourcePointer = `/inspectionRecord/${key}`;
      state = 'supplied';
      if (!scalar(value)) reasons.push('Field must contain a scalar value.');
      if (identityKeys.includes(key) && present(exportPackage.task?.[key]) && !same(value, exportPackage.task[key])) {
        reasons.push('App task and inspection record disagree.');
      }
      if (['diameterM', 'heightM'].includes(key) && (typeof value !== 'number' || value <= 0)) {
        reasons.push('Dimension requires a positive number in metres.');
      }
      if (key === 'shellCourseCount' && (!Number.isInteger(value) || value <= 0)) {
        reasons.push('Shell course count requires a positive integer.');
      }
      if (extra && present(extra.value) && (!same(value, extra.value) || (unit && extra.unitCode && extra.unitCode !== unit))) {
        reasons.push('Supplement conflicts with the captured app value or unit.');
      }
    } else if (extra && present(extra.value)) {
      sourceClass = extra.sourceClass ?? 'report_side_input';
      sourcePointer = `/manualSupplement/generalTankInformation/${key}`;
      provenance = extra.sourceRef ?? null;
      if (extra.confirmed !== true || !provenance) {
        state = 'unconfirmed';
        reasons.push('Supplement requires confirmation and a source reference.');
      } else if (extra.sourceClass === 'historical_asset'
          && (!same(extra.assetIdentity?.client, native.client) || !same(extra.assetIdentity?.tankNumber, native.tankNumber)
            || !same(extra.assetIdentity?.location, native.location))) {
        state = 'conflict';
        reasons.push('Historical input does not match the current client, tank and location.');
      } else if (!['report_side_input', 'historical_asset'].includes(extra.sourceClass)) {
        state = 'invalid';
        reasons.push('Unrecognized supplementary source class.');
      } else {
        value = extra.value;
        state = 'supplied';
        if (!scalar(value)) reasons.push('Supplement must contain a scalar value.');
        if (unit && !unknown(value) && (typeof value !== 'number' || value <= 0 || extra.unitCode !== unit)) {
          reasons.push(`Dimension requires a positive number with explicit ${unit} units.`);
        }
        if (key === 'shellCourseCount' && !unknown(value) && (!Number.isInteger(value) || value <= 0)) {
          reasons.push('Shell course count requires a positive integer.');
        }
      }
    }

    if (reasons.length) {
      if (state === 'supplied') state = 'conflict';
      value = null;
    } else if (unknown(value)) state = 'unknown';
    else if (/^not applicable$/i.test(String(value))) state = 'not_applicable';

    if (required && ['missing', 'unknown', 'not_applicable'].includes(state)) {
      reasons.push(`Required ${label.toLowerCase()} is not established.`);
    }
    if (reasons.length || state === 'missing') {
      issues.push({ fieldKey: key, state, blocking: required || reasons.length > 0,
        reasons: reasons.length ? reasons : ['Not recorded; supply or confirm if applicable.'] });
    }
    const displayValue = value === null
      ? state === 'conflict' ? 'Conflicting inputs — review required'
        : state === 'unconfirmed' ? 'Awaiting confirmation'
          : state === 'invalid' ? 'Invalid input — review required' : 'Not recorded'
      : `${value}${unit && !unknown(value) && state !== 'not_applicable' ? ` ${unit}` : ''}`;
    fields.push({ ...definition, value, displayValue, state, sourceClass, sourcePointer, provenance,
      evidenceId: `general-info:${key}`, sourceValue: nativeValue ?? extra?.value ?? null });
  }
  for (const key of Object.keys(supplement)) {
    if (!FIELD_DEFINITIONS.some(field => field.key === key)) {
      issues.push({ fieldKey: key, state: 'unsupported', blocking: true,
        reasons: ['Supplement field has no reviewed outline mapping.'] });
    }
  }
  const pendingNotes = (exportPackage.voiceNotes ?? [])
    .filter(note => ['general_info', 'general_tank_information'].includes(note.screenKey));
  if (pendingNotes.length) {
    issues.push({ fieldKey: 'voiceNotes', state: 'unconfirmed', blocking: true,
      reasons: ['General-information notes require field-level confirmation before this deterministic section can be approved.'] });
  }
  return { fields, issues, pendingNotes };
}

function renderFields({ fields, planId }) {
  const fieldHtml = field => `<p data-evidence-id="${esc(field.evidenceId)}" data-laiq-provenance="${field.sourceClass === 'app_field' ? 'app_field' : 'report_side_input'}">➢ <strong>${esc(field.label)}:</strong> ${esc(field.displayValue)}</p>`;
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
  const { fields, issues, pendingNotes } = compileFields(execution.evidenceSnapshot);
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
    },
    section: { sectionInstanceId: execution.sectionPlan.sectionInstanceId, sectionId: SECTION_ID,
      title: AGENT_POLICY.title, agentId: AGENT_ID, releaseVersion: AGENT_RELEASE },
    draft: { content: rendered.content, document: rendered.document, generated: true, edited: false,
      approved: false, reviewRequired: true },
    validation: { valid: blockers.length === 0, blockers,
      warnings: issues.filter(issue => !issue.blocking).map(issue => `${issue.fieldKey}: ${issue.reasons.join(' ')}`),
      checks: { protectedFieldCount: FIELD_DEFINITIONS.length, documentValid: rendered.check.valid,
        currentFactsFromHistoricalSources: false, runtimeRetrievalUsed: false, liveModelUsed: false } },
    trace: { runId, generatedAtIso: new Date().toISOString(), executionMode: execution.executionMode,
      inputSha256: before, providerCode: 'deterministic', modelId: null, retrievalKeys: [], approvalStatus: 'not_approved' },
    evaluationEvidence: { fields, issues, pendingNotes },
  };
}
