import { createHash, randomUUID } from 'node:crypto';
import { buildSectionPlanningSnapshot } from '../section-planner.mjs';
import { escapeReportText as esc, parseSectionDocument, renderSectionDocumentHtml, validateSectionDocument } from '../report-document.mjs';

export const GENERAL_INFORMATION_AGENT_VERSION = 'general_tank_information_v1';
export const GENERAL_INFORMATION_SECTION = 'general-tank-information';
// Report-facing order; source values never define labels, headings or HTML.
export const GENERAL_INFORMATION_FIELDS = Object.freeze([
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
const nativeKeys = new Set(['client', 'tankNumber', 'location', 'fieldLeaseName', 'heightM', 'diameterM', 'shellCourseCount']);
const present = value => value !== null && value !== undefined && String(value).trim() !== '';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const unknown = value => /^(?:not provided|not recorded|unknown(?: carbon steel)?|pending confirmation|-)$/i.test(String(value).trim());
const scalar = value => typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)) || typeof value === 'boolean';
const same = (a, b) => String(a).trim() === String(b).trim();

export const GENERAL_INFORMATION_AGENT = Object.freeze({
  version: GENERAL_INFORMATION_AGENT_VERSION,
  sectionId: GENERAL_INFORMATION_SECTION,
  title: '3 GENERAL TANK INFORMATION',
  mode: 'deterministic',
  prompt: null,
  kbPolicy: { retrieval: 'disabled', currentFactsFromPrecedent: false, confirmedSameAssetHistoryOnly: true },
  releaseStatus: 'evaluation_candidate',
});

/** No source reports, gold labels, KB searches or model worker enter this function. */
export function generateGeneralTankInformation({ exportPackage, manualSupplement = {} }) {
  if (!exportPackage?.inspectionRecord || !exportPackage.inspectionId) throw new Error('An imported inspection with an identity record is required.');
  const before = digest({ exportPackage, manualSupplement });
  const snapshot = buildSectionPlanningSnapshot({ exportPackage });
  const native = exportPackage.inspectionRecord;
  const supplement = manualSupplement.generalTankInformation ?? {};
  if (!supplement || typeof supplement !== 'object' || Array.isArray(supplement)) throw new Error('General information supplement must contain named field records.');
  const issues = [];
  const fields = [];
  for (const definition of GENERAL_INFORMATION_FIELDS) {
    const { key, label, required, unit } = definition;
    const record = snapshot.evidenceRecords.find(item => item.kind === 'identity' && item.payload.fieldKey === key);
    const nativeValue = nativeKeys.has(key) ? native[key] : undefined;
    const extra = supplement[key];
    let value = null, sourceClass = null, sourcePointer = null, state = 'missing', provenance = null;
    const reasons = [];
    if (present(nativeValue)) {
      value = nativeValue; sourceClass = 'app_field'; sourcePointer = `/inspectionRecord/${key}`; state = 'supplied';
      if (!scalar(value)) reasons.push('Field must contain a scalar value.');
      if (['diameterM', 'heightM'].includes(key) && (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) reasons.push('Dimension requires a positive number in metres.');
      if (key === 'shellCourseCount' && (!Number.isInteger(value) || value <= 0)) reasons.push('Shell course count requires a positive integer.');
      if ((record?.quality.issues ?? []).some(issue => issue.reason === 'conflicting_value')) reasons.push('App task and inspection record disagree.');
      if (extra && present(extra.value) && (!same(value, extra.value) || (unit && extra.unitCode && extra.unitCode !== unit))) reasons.push('Supplement conflicts with the captured app value or unit.');
    } else if (extra && present(extra.value)) {
      sourceClass = 'report_side_input'; sourcePointer = `/manualSupplement/generalTankInformation/${key}`;
      provenance = extra.sourceRef ?? null;
      if (extra.confirmed !== true || !provenance) {
        state = 'unconfirmed'; reasons.push('Supplement requires confirmation and a source reference.');
      } else if (extra.sourceClass === 'historical_asset' && (extra.assetIdentity?.client !== native.client || extra.assetIdentity?.tankNumber !== native.tankNumber || extra.assetIdentity?.location !== native.location)) {
        state = 'conflict'; reasons.push('Historical input does not match the current client, tank and location.');
      } else if (!['report_side_input', 'historical_asset'].includes(extra.sourceClass)) {
        state = 'invalid'; reasons.push('Unrecognized supplementary source class.');
      } else {
        value = extra.value; state = 'supplied';
        if (!scalar(value)) reasons.push('Supplement must contain a scalar value.');
        if (unit && !unknown(value) && (typeof value !== 'number' || value <= 0 || extra.unitCode !== unit)) reasons.push(`Dimension requires a positive number with explicit ${unit} units.`);
        if (key === 'shellCourseCount' && !unknown(value) && (!Number.isInteger(value) || value <= 0)) reasons.push('Shell course count requires a positive integer.');
      }
    }
    if (reasons.length) {
      if (state === 'supplied') state = 'conflict';
      // Keep disputed values in evidence review, never choose one silently.
      value = null;
    } else if (unknown(value)) state = 'unknown';
    else if (/^not applicable$/i.test(String(value))) state = 'not_applicable';
    if (required && ['missing', 'unknown', 'not_applicable'].includes(state)) reasons.push(`Required ${label.toLowerCase()} is not established.`);
    if (reasons.length || state === 'missing') issues.push({ fieldKey: key, state, blocking: required || reasons.length > 0, reasons: reasons.length ? reasons : ['Not recorded; supply or confirm if applicable.'] });
    const displayValue = value === null ? (state === 'conflict' ? 'Conflicting inputs — review required' : state === 'unconfirmed' ? 'Awaiting confirmation' : state === 'invalid' ? 'Invalid input — review required' : 'Not recorded') : `${value}${unit && !unknown(value) && state !== 'not_applicable' ? ` ${unit}` : ''}`;
    fields.push({ ...definition, value, displayValue, state, sourceClass, sourcePointer, provenance,
      evidenceId: `general-info:${key}`, sourceValue: nativeValue ?? extra?.value ?? null, supplementaryValue: extra?.value ?? null });
  }
  for (const key of Object.keys(supplement)) if (!GENERAL_INFORMATION_FIELDS.some(field => field.key === key)) issues.push({ fieldKey: key, state: 'unsupported', blocking: true, reasons: ['Supplement field has no reviewed outline mapping.'] });
  // Free-form notes require structured interpretation/confirmation, not silent omission.
  const pendingNotes = (exportPackage.voiceNotes ?? []).filter(note => ['general_info', 'general_tank_information'].includes(note.screenKey));
  if (pendingNotes.length) issues.push({ fieldKey: 'voiceNotes', state: 'unconfirmed', blocking: true, reasons: ['General-information notes require field-level confirmation before this deterministic section can be approved.'] });
  const fieldHtml = field => `<p data-evidence-id="${esc(field.evidenceId)}" data-laiq-provenance="${field.sourceClass === 'app_field' ? 'app_field' : 'report_side_input'}">➢ <strong>${esc(field.label)}:</strong> ${esc(field.displayValue)}</p>`;
  const main = fields.filter(field => !field.history);
  const rows = [`<tr><td colspan="2">${fieldHtml(main[0])}</td></tr>`];
  for (let index = 1; index < main.length; index += 2) rows.push(`<tr><td>${fieldHtml(main[index])}</td><td>${main[index + 1] ? fieldHtml(main[index + 1]) : ''}</td></tr>`);
  const html = `<section data-section-id="${GENERAL_INFORMATION_SECTION}"><h2>${GENERAL_INFORMATION_AGENT.title}</h2><table data-report-format="paired-fields"><tbody>${rows.join('')}</tbody></table><h3>Previous Inspection History</h3><table data-report-format="paired-fields"><tbody><tr>${fields.filter(field => field.history).map(field => `<td>${fieldHtml(field)}</td>`).join('')}</tr></tbody></table></section>`;
  const document = parseSectionDocument({ sectionId: GENERAL_INFORMATION_SECTION, html });
  const documentCheck = validateSectionDocument(document);
  const content = renderSectionDocumentHtml(document);
  const blockers = issues.filter(issue => issue.blocking).flatMap(issue => issue.reasons);
  blockers.push(...documentCheck.issues);
  if (digest({ exportPackage, manualSupplement }) !== before) throw new Error('Section agent mutated its inputs.');
  const runId = randomUUID();
  return {
    draft: { content, document, generated: true, edited: false, approved: false, reviewRequired: true },
    generationRun: { runId, sectionId: GENERAL_INFORMATION_SECTION, statusCode: blockers.length ? 'generated_with_blockers' : issues.length ? 'generated_with_warnings' : 'generated', generatedAtIso: new Date().toISOString(),
      templateKey: GENERAL_INFORMATION_AGENT_VERSION, generatorContractVersion: GENERAL_INFORMATION_AGENT_VERSION,
      providerCode: 'deterministic', modelId: null, usedLiveModel: false, warnings: issues.filter(issue => !issue.blocking).map(issue => `${issue.fieldKey}: ${issue.reasons.join(' ')}`), blockers,
      retrievalKeys: [], factRecommendationKeys: [], calculationKeys: [], mapArtifactKeys: [],
      evidenceChain: { inputHash: before, plannerContract: snapshot.contractVersion, plannerRevision: snapshot.ruleRevision, approvalStatus: 'not_approved' } },
    orchestration: { sectionId: GENERAL_INFORMATION_SECTION, generatorContractVersion: GENERAL_INFORMATION_AGENT_VERSION, templateKey: GENERAL_INFORMATION_AGENT_VERSION,
      retrievalContext: [], factRecommendationContext: [], mapArtifacts: [], warnings: issues, blockers },
    evaluationEvidence: { fields, issues, pendingNotes, inputHash: before },
  };
}
