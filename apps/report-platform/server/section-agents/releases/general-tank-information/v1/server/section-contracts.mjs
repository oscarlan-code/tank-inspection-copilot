import { API_STANDARD_REPORT_TOC } from './report-toc.mjs';

export const SECTION_CONTRACT_VERSION = 'section_contract_v2';
export const REPORT_PROFILE_ID = 'api653-vertical-ast-v1';
export const EVIDENCE_USE_ROLES = Object.freeze(['required_narrative', 'required_structured', 'supporting', 'cross_reference']);

const inspectionSlots = ['inspection-extent', 'diked-area', 'foundation', 'shell-external', 'shell-appurtenances', 'access-structures', 'roof-external', 'roof-appurtenances', 'roof-internal', 'shell-internal', 'floor-internal', 'assessment-summaries', 'inspection-implication'];
const definitions = {
  'scope-of-inspection': ['identity', 'scope', 'limitations', 'references'],
  'inspection-maintenance-regime': ['history', 'regime', 'limitations'],
  'general-tank-information': ['identity', 'configuration', 'history', 'inspection-details'],
  'inspection-report': inspectionSlots,
  'repair-recommendations': ['recommendations', 'basis', 'limitations'],
  'test-information': ['methods', 'results', 'limitations'],
  'tank-inspection-checklist': ['legend', 'checklist', 'notes'],
  'roof-plate-thickness-measurements': ['basis', 'measurements', 'layout-reference'],
  'roof-plate-layout': ['layout', 'legend', 'references'],
  'roof-nozzle-reinforcement-pad-thickness-measurements': ['basis', 'measurements', 'layout-reference'],
  'minimum-shell-thickness-calculations': ['basis', 'inputs', 'calculations', 'limitations'],
  'shell-plate-thickness-measurements': ['basis', 'measurements', 'layout-reference'],
  'shell-plate-layout': ['layout', 'legend', 'references'],
  'shell-external-additional-ndt-selected-areas': ['methods', 'areas', 'results', 'limitations'],
  'shell-external-mpi-selected-areas': ['methods', 'areas', 'layout', 'results', 'limitations'],
  'shell-internal-mpi-selected-areas': ['methods', 'areas', 'layout', 'limitations', 'references'],
  'shell-internal-mpi-findings': ['findings', 'layout', 'results', 'limitations'],
  'shell-internal-recommended-repairs': ['recommendations', 'layout', 'limitations'],
  'shell-nozzle-reinforcement-pad-thickness-measurements': ['basis', 'measurements', 'layout-reference'],
  'shell-settlement-survey-results-external': ['basis', 'stations', 'results', 'limitations'],
  'shell-settlement-survey-graphs': ['graphs', 'legend', 'interpretation'],
  'photographs': ['photographs'],
  'floor-plate-layout-platemaps-numbering-system': ['layout', 'legend', 'aliases'],
  'guidelines-interpretation-tru-flux-data-sheets': ['guidance', 'legend', 'limitations'],
  'floor-plate-corrosion-plan': ['layout', 'overlays', 'legend', 'limitations'],
  'magnetic-flux-leakage-platemaps': ['index', 'platemaps', 'limitations'],
  'appendix-a-engineering-assessment-summary': ['basis', 'calculations', 'assessment', 'limitations', 'review'],
};
for (let area = 1; area <= 5; area += 1) definitions[`shell-external-area-${area}-ut-scanning-findings`] = ['location', 'layout', 'measurements', 'findings', 'limitations', 'references'];

const structuredSlots = new Set(['identity', 'configuration', 'inspection-details', 'checklist', 'measurements', 'inputs', 'calculations', 'stations', 'areas', 'methods', 'index', 'review']);
const figureSlots = new Set(['layout', 'graphs', 'overlays', 'platemaps', 'photographs']);
const generalKinds = ['identity', 'scope', 'manual_confirmation', 'observation', 'voice_claim', 'legacy_capture'];

// These are outline rules, not labels supplied by the capture app. A record may
// match several blocks; the matcher deliberately returns every justified use.
const rules = new Map();
function rule(sectionId, slotKey, name, match, role, projection, description) {
  const key = `${sectionId}:${slotKey}`;
  rules.set(key, [...(rules.get(key) ?? []), { ruleId: `outline-v2:${key}:${name}`, match, role, projection, description }]);
}
rule('general-tank-information', 'identity', 'tank-identity', { kind: 'identity', fieldKey: ['client', 'tankNumber', 'location', 'fieldLeaseName', 'inspector'] }, 'required_structured', 'identity_fields', 'Native tank and inspection identity fields.');
rule('general-tank-information', 'configuration', 'tank-configuration', { kind: 'identity', fieldKey: ['externalRoofType', 'internalRoofType', 'diameterM', 'heightM', 'shellCourseCount', 'shellLaneCount', 'referenceMode', 'referenceNote'] }, 'required_structured', 'identity_fields', 'Native tank configuration with captured dimensional units.');
rule('scope-of-inspection', 'identity', 'identity-context', { kind: 'identity', fieldKey: ['client', 'tankNumber', 'location'] }, 'supporting', 'identity_fields', 'Reuse tank identity as scope context without repeating a required metadata table.');
for (const component of inspectionSlots.filter((key) => !['inspection-extent', 'assessment-summaries', 'inspection-implication'].includes(key))) {
  rule('inspection-report', component, 'component-finding', { kind: ['observation', 'voice_claim'], component, action: false, eligible: true }, 'required_narrative', 'observation', `Captured condition assigned to ${component.replaceAll('-', ' ')} by physical component context.`);
}
rule('repair-recommendations', 'recommendations', 'proposed-action', { kind: ['observation', 'voice_claim'], action: true, eligible: true }, 'supporting', 'observation', 'An action proposal supports review; it becomes report wording only after explicit confirmation.');
rule('general-tank-information', 'inspection-details', 'general-info-voice', { kind: 'voice_claim', screenKey: 'general_info', component: null, action: false, eligible: true }, 'required_narrative', 'observation', 'Completed voice statement captured in general inspection information.');
rule('scope-of-inspection', 'scope', 'scope-voice', { kind: 'voice_claim', screenKey: ['task_home', 'layout_scope'], component: null, action: false, eligible: true }, 'required_narrative', 'observation', 'Voice statement captured in the inspection scope context.');
for (const [targetKey, element, sectionId] of [
  ['shell', false, 'shell-plate-thickness-measurements'], ['shell', true, 'shell-nozzle-reinforcement-pad-thickness-measurements'],
  ['external_roof', false, 'roof-plate-thickness-measurements'], ['external_roof', true, 'roof-nozzle-reinforcement-pad-thickness-measurements'],
]) rule(sectionId, 'measurements', 'native-ut', { kind: 'measurement', targetKey, element }, 'required_structured', 'measurement_rows', 'Native UT rows retain item identity, reading order, blank cells and explicit units.');
for (const [measurementContext, slotKey] of [['floor', 'floor-internal'], ['roof', 'roof-external'], ['other', 'assessment-summaries']]) {
  rule('inspection-report', slotKey, 'ut-support', { kind: 'measurement', measurementContext }, 'supporting', 'measurement_rows', 'Measurement context supports findings; detailed readings belong in their measurement section.');
}
rule('tank-inspection-checklist', 'checklist', 'native-checklist', { kind: 'checklist_response' }, 'required_structured', 'checklist_rows', 'Every native item retains its selected response and note.');
for (const [targetKey, sectionId] of [['shell', 'shell-plate-layout'], ['floor', 'floor-plate-layout-platemaps-numbering-system'], ['external_roof', 'roof-plate-layout']]) {
  rule(sectionId, 'layout', 'native-layout', { kind: 'geometry', targetKey, sourceCollection: ['layoutConfigs', 'layoutFigures'] }, 'required_structured', 'figure', 'Captured base geometry; specialist overlays need their own reviewed adapter.');
  rule(sectionId, 'layout', 'native-element', { kind: 'geometry', targetKey, sourceCollection: 'elements' }, 'supporting', 'figure', 'Element geometry supports the matching surface drawing.');
}
rule('photographs', 'photographs', 'native-photo', { kind: 'attachment', image: true }, 'required_structured', 'photo', 'Image attachment with its original finding link and caption context.');
rule('scope-of-inspection', 'scope', 'captured-scope', { kind: 'scope', sourceCollection: ['taskSnapshots', 'layoutTargets'] }, 'supporting', 'source_reference', 'Captured task and surface scope provide inspection context.');

export const CHECKLIST_COMPONENT_SLOTS = Object.freeze({
  diked_area: 'diked-area', tank_foundation: 'foundation', shell_external: 'shell-external',
  shell_appurtenances: 'shell-appurtenances', access_structure: 'access-structures',
  fixed_roof_cone_dome: 'roof-external', roof_appurtenances: 'roof-appurtenances',
  fixed_roof_internal: 'roof-internal', shell_internal: 'shell-internal', floor_internal: 'floor-internal',
});

// Compatibility export; the same declarations are compiled into slot rules.
export const MANUAL_INPUT_ROUTES = Object.freeze({
  reportReference: ['scope-of-inspection', 'identity'], inspectedDate: ['general-tank-information', 'inspection-details'],
  inspectionScope: ['scope-of-inspection', 'scope'], scopeOfInspection: ['scope-of-inspection', 'scope'],
  scopeLimitations: ['scope-of-inspection', 'limitations'], clientRepresentative: ['general-tank-information', 'inspection-details'],
  yearBuilt: ['general-tank-information', 'history'], service: ['general-tank-information', 'configuration'],
  engineeringImplication: ['inspection-report', 'inspection-implication'],
  inspectionHistory: ['inspection-maintenance-regime', 'history'], maintenanceRegime: ['inspection-maintenance-regime', 'regime'],
  recommendationOwner: ['repair-recommendations', 'basis'], recommendations: ['repair-recommendations', 'recommendations'],
  testInformation: ['test-information', 'methods'], certificationNumber: ['test-information', 'methods'],
  settlementSurvey: ['shell-settlement-survey-results-external', 'basis'],
});
for (const [fieldKey, [sectionId, slotKey]] of Object.entries(MANUAL_INPUT_ROUTES)) {
  rule(sectionId, slotKey, `manual-${fieldKey}`, { kind: 'manual_confirmation', fieldKey }, ['recommendations', 'inspection-implication'].includes(slotKey) ? 'required_narrative' : 'required_structured', slotKey === 'recommendations' ? 'confirmed_action' : 'identity_fields', 'Explicit report-side inspector input, kept separate from app capture.');
}
for (const section of API_STANDARD_REPORT_TOC.filter((entry) => entry.layoutSurface)) {
  rule(section.id, definitions[section.id].includes('legend') ? 'legend' : 'limitations', 'drawing-review-context', { kind: 'manual_confirmation', fieldKey: ['checkedBy', 'legendNote'] }, 'supporting', 'source_reference', 'Drawing reviewer and legend context for this surface.');
}

const titles = {
  identity: 'Tank and report identification', configuration: 'Tank configuration', history: 'Inspection and service history',
  scope: 'Inspection scope', regime: 'Inspection and maintenance regime', limitations: 'Limitations', references: 'References',
  'inspection-details': 'Inspection details', 'inspection-extent': 'Extent of inspection', 'diked-area': 'Diked area', foundation: 'Tank foundation',
  'shell-external': 'Shell — external', 'shell-appurtenances': 'Shell appurtenances', 'access-structures': 'Access structures',
  'roof-external': 'Roof — external', 'roof-appurtenances': 'Roof appurtenances', 'roof-internal': 'Roof — internal',
  'shell-internal': 'Shell — internal', 'floor-internal': 'Floor — internal', 'assessment-summaries': 'Assessment summaries',
  'inspection-implication': 'Engineering implication', recommendations: 'Repair recommendations', basis: 'Basis', methods: 'Test methods',
  results: 'Results', legend: 'Legend', checklist: 'Inspection checklist', notes: 'Inspection notes', measurements: 'Thickness measurements',
  'layout-reference': 'Layout reference', layout: 'Layout drawing', inputs: 'Calculation inputs', calculations: 'Calculations',
  areas: 'Selected examination areas', location: 'Examination location', findings: 'Findings', stations: 'Survey stations and readings',
  graphs: 'Survey graphs', interpretation: 'Interpretation', photographs: 'Inspection photographs', aliases: 'Plate numbering correspondence',
  guidance: 'Data sheet interpretation guidance', overlays: 'Corrosion overlays', index: 'Platemap index', platemaps: 'MFL platemaps',
  assessment: 'Engineering assessment', review: 'Engineering review',
};
const purposes = {
  identity: 'Identify the inspected tank, client, site and report using captured or confirmed fields',
  configuration: 'Describe tank construction and dimensions with their recorded units', history: 'Record confirmed inspection, service or maintenance history',
  scope: 'State the agreed work and inspected components', regime: 'State confirmed inspection and maintenance arrangements and responsibilities',
  limitations: 'State access, method or data limitations without treating missing evidence as a satisfactory result', references: 'Identify relevant source documents and report cross-references',
  'inspection-details': 'Record inspection dates, inspector and client representative details', 'inspection-extent': 'Describe the examinations actually performed and their coverage',
  'assessment-summaries': 'Summarize reviewed assessment outcomes while retaining detailed readings in the measurement sections',
  'inspection-implication': 'State the inspector-confirmed engineering implication of the observed conditions',
  recommendations: 'State confirmed repair actions and their ownership; an observation alone does not authorize a repair',
  basis: 'Identify the confirmed examination or assessment basis and its source', methods: 'Record the performed test methods and qualification references',
  results: 'Present recorded examination outcomes with their location and limitations', legend: 'Explain the symbols, response codes or drawing conventions actually used',
  checklist: 'Present native checklist selections grouped by component, preserving every item and response', notes: 'Include relevant captured explanatory notes',
  measurements: 'Present exact captured thickness cells, item identifiers, blank readings and declared units in their original row order',
  'layout-reference': 'Link readings to the corresponding component layout without copying unrelated measurements',
  layout: 'Present verified geometry with component labels, orientation and drawing references', inputs: 'List verified calculation inputs, units and source references',
  calculations: 'Present approved deterministic calculation outputs and assumptions; do not infer calculations from prose',
  areas: 'Identify the selected examination areas and their coverage', location: 'Identify the specific examination area without transferring findings between areas',
  findings: 'Describe supported conditions, locations and uncertainty for this examination', stations: 'Present verified survey station identities, positions, readings and units',
  graphs: 'Plot verified survey readings with defined axes, units and station correspondence', interpretation: 'State the reviewed interpretation supported by the displayed results',
  photographs: 'Present source images with concise captions and verified finding or component links', aliases: 'Document verified correspondence between captured plate IDs and platemap numbering',
  guidance: 'Use reviewed method guidance to explain the data sheets without importing historical inspection findings',
  overlays: 'Place verified corrosion indications on the matching immutable floor geometry', index: 'List the available platemaps and their verified plate identities',
  platemaps: 'Present verified MFL artifacts with plate identity and orientation', assessment: 'Summarize reviewed engineering conclusions supported by the calculations and findings',
  review: 'Record the engineering reviewer, review basis and outstanding confirmations',
};
const templateKeys = {
  'scope-of-inspection': 'shell-internal.scope.v1', 'inspection-maintenance-regime': 'shell-internal.maintenance-regime.v1',
  'general-tank-information': 'shell-internal.general-info.v1', 'inspection-report': 'shell-internal.inspection-report.v1',
  'repair-recommendations': 'shell-internal.recommendations.v1', 'tank-inspection-checklist': 'api653-standard.tank-inspection-checklist.v1',
  photographs: 'shell-internal.photographs.v1',
};
function deepFreeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) deepFreeze(child); Object.freeze(value); }
  return value;
}

function slotDefinition(section, key, order) {
  const sectionId = section.id;
  const isFigure = figureSlots.has(key);
  const type = key === 'photographs' ? 'photo_group' : isFigure ? 'figure' : key === 'measurements' || key === 'stations' ? 'measurement_table' : key === 'checklist' ? 'checklist_table' : key === 'calculations' ? 'calculation_table' : structuredSlots.has(key) ? 'field_grid' : 'observation_list';
  const acceptedKinds = key === 'measurements' || key === 'stations' ? ['measurement', 'legacy_capture']
    : key === 'checklist' ? ['checklist_response']
    : isFigure ? ['geometry', 'attachment', 'manual_confirmation']
    : key === 'calculations' ? ['calculation_result', 'manual_confirmation']
    : [...generalKinds, ...(key === 'notes' ? ['checklist_response'] : []), ...(key === 'results' ? ['measurement', 'calculation_result'] : [])];
  const supportingKinds = [...new Set([...acceptedKinds, 'attachment', 'geometry', ...(sectionId === 'inspection-report' || ['basis', 'inputs', 'results', 'assessment', 'recommendations', 'interpretation'].includes(key) ? ['measurement', 'calculation_result', 'checklist_response'] : [])])];
  // Required content must have a real renderer for its native record shape.
  // Retain broad contextual reuse without turning UT rows into prose/surveys.
  const requiredKinds = key === 'stations' ? []
    : type === 'measurement_table' ? ['measurement']
      : type === 'observation_list' ? acceptedKinds.filter((kind) => !['measurement', 'calculation_result'].includes(kind)) : acceptedKinds;
  const evidenceKindsByRole = {
    required_narrative: requiredKinds.filter((kind) => ['observation', 'voice_claim', 'manual_confirmation', 'scope', 'legacy_capture'].includes(kind)),
    required_structured: requiredKinds,
    supporting: supportingKinds,
    cross_reference: supportingKinds,
  };
  const evidenceRules = rules.get(`${sectionId}:${key}`) ?? [];
  const measurementColumns = key === 'measurements' ? [
    ...Array.from({ length: 5 }, (_, index) => ({ key: `value${index + 1}`, title: `R${index + 1}` })),
    ...(sectionId.includes('nozzle-reinforcement-pad') ? [{ key: 'reinforcementPadReading', title: 'Reinforcement pad' }] : []),
  ] : null;
  const responseColumns = ['1', '2', '3', '4', 'IA', 'NE', 'N/A'];
  const columns = key === 'stations' ? ['Station', 'Position', 'Reading', 'Unit']
    : type === 'measurement_table' ? ['Location', ...measurementColumns.map((column) => column.title)]
    : type === 'checklist_table' ? ['No.', 'Inspection item', ...responseColumns]
      : type === 'field_grid' ? ['Field', 'Value'] : undefined;
  return deepFreeze({ slotKey: key, title: titles[key], purpose: `${purposes[key] ?? `Describe captured conditions for ${titles[key].toLowerCase()}, retaining component identity, negation and uncertainty`} in ${section.title}.${key === 'stations' ? ' Verified survey data is required; tank-thickness rows cannot populate this table.' : ''}`, order, type, acceptedKinds: [...new Set(Object.values(evidenceKindsByRole).flat())], evidenceKindsByRole, legacyAcceptedKinds: acceptedKinds,
    allowedRoles: EVIDENCE_USE_ROLES.filter((role) => evidenceKindsByRole[role].length),
    evidenceRules, automaticAssignment: evidenceRules.length ? 'outline_rules' : 'reviewed_mapping_required',
    ...(key === 'stations' ? { adapterStatus: 'pending_native_survey_adapter' } : {}),
    requiredNativeFields: sectionId === 'general-tank-information' && key === 'identity' ? ['client', 'tankNumber', 'location'] : [],
    presentation: { renderer: type, narrativeStyle: sectionId === 'inspection-maintenance-regime' || key === 'guidance' ? 'paragraph' : 'arrow_list', headingCase: sectionId === 'inspection-report' ? 'uppercase' : 'sentence', ...(columns ? { columns } : {}), ...(measurementColumns ? { measurementColumns } : {}), ...(type === 'checklist_table' ? { responseColumns } : {}) },
    composition: 'deterministic', allowVoiceNarrative: !isFigure && !['measurement_table', 'checklist_table', 'calculation_table'].includes(type) && sectionId !== 'guidelines-interpretation-tru-flux-data-sheets',
    missingBehavior: 'review_required', noVoiceBehavior: 'compile_native_records', rawEvidenceAppendix: false });
}

export const REPORT_SECTION_CONTRACTS = Object.freeze(API_STANDARD_REPORT_TOC.map((section) => Object.freeze({
  sectionId: section.id, number: section.number, title: section.title, profileId: REPORT_PROFILE_ID,
  contractVersion: SECTION_CONTRACT_VERSION, layoutSurface: section.layoutSurface ?? null,
  templateKey: templateKeys[section.id] ?? `api653-standard.${section.id}.v1`, templateSource: templateKeys[section.id] ? 'existing_section_template' : 'existing_report_outline',
  purpose: `Compile ${section.title.toLowerCase()} from the evidence assigned to the ordered blocks below; retain unresolved specialist data for review.`,
  slots: Object.freeze(definitions[section.id].map((key, order) => slotDefinition(section, key, order))),
  emptyApplicability: 'unconfirmed', noVoiceBehavior: 'compile_native_records', rawEvidenceAppendix: false,
})));

export function getSectionContract(sectionId) { return REPORT_SECTION_CONTRACTS.find((section) => section.sectionId === sectionId) ?? null; }

export function canUseEvidence(slot, kind, role) {
  return Boolean(slot?.allowedRoles.includes(role) && slot.evidenceKindsByRole[role]?.includes(kind));
}

/** Match normalized source facts against every outline, preserving multi-use. */
export function matchSectionEvidenceRules(facts, contracts = REPORT_SECTION_CONTRACTS) {
  return contracts.flatMap((section) => section.slots.flatMap((slot) => slot.evidenceRules
    .filter((entry) => Object.entries(entry.match).every(([key, expected]) => Array.isArray(expected) ? expected.includes(facts[key]) : facts[key] === expected))
    .map((entry) => ({ ...entry, sectionId: section.sectionId, slotKey: slot.slotKey }))));
}
