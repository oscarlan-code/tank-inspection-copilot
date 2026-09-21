// Evaluation-only report presentation. Module/slot IDs remain evidence-routing
// concepts; these titles and layouts are reusable report-facing conventions.
export const GENERIC_REPORT_PRESENTATION_VERSION = 'inspection_report_presentation_v1';
export const GENERIC_REPORT_PROFILE_ID = 'vertical_tank_inspection_evaluation_v2';
export const REPORT_TITLES = {
  identity: 'GENERAL TANK INFORMATION', scope: 'SCOPE OF INSPECTION',
  regime: 'INSPECTION AND MAINTENANCE REGIME', findings: 'INSPECTION REPORT',
  recommendations: 'REPAIR RECOMMENDATIONS', methods: 'TEST INFORMATION',
  checklist: 'TANK INSPECTION CHECKLIST', thickness: 'THICKNESS MEASUREMENTS',
  layout: 'PLATE LAYOUTS', calculations: 'CALCULATIONS', ndt: 'NON-DESTRUCTIVE EXAMINATION',
  survey: 'DIMENSIONAL SURVEY', graphs: 'SURVEY GRAPHS', photos: 'PHOTOGRAPHS',
  'method-guidance': 'INSPECTION METHOD AND INTERPRETATION', 'corrosion-plan': 'FLOOR CORROSION PLAN',
  platemaps: 'FLOOR PLATE MAPS', assessment: 'ENGINEERING ASSESSMENT',
  'scan-profiles': 'SCAN PROFILES', dimensional: 'DIMENSIONAL MEASUREMENTS',
  'repair-verification': 'REPAIR VERIFICATION', consultation: 'TECHNICAL CONSULTATION',
  calibration: 'TANK CALIBRATION TABLE', references: 'REFERENCES', summary: 'SUMMARY AND CONCLUSIONS',
};
export const REPORT_PROFILE_ORDER = ['scope', 'regime', 'identity', 'findings', 'recommendations', 'methods', 'checklist'];
export function reportPresentation(moduleId, selectedModuleIds) {
  const order = REPORT_PROFILE_ORDER.filter(id => selectedModuleIds.includes(id));
  return { contractVersion: GENERIC_REPORT_PRESENTATION_VERSION, profileId: GENERIC_REPORT_PROFILE_ID,
    title: REPORT_TITLES[moduleId], ...(order.includes(moduleId) ? { number: String(order.indexOf(moduleId) + 1) } : {}),
    numberingRule: 'Selected core report order; repeated technical modules retain component headings. Diagnostic references/summary are unnumbered.',
  };
}
export const IDENTITY_LABELS = {
  client: 'Client', tankNumber: 'Tank Number', location: 'Location', inspector: 'Inspector',
  externalRoofType: 'External Roof Present', internalRoofType: 'Internal Roof Present',
  diameterM: 'Diameter', heightM: 'Height', shellCourseCount: 'Shell Courses', shellLaneCount: 'Measurement Lanes',
  referenceMode: 'Orientation Reference', referenceNote: 'Orientation Note',
};
export function slotPresentation(moduleId, slotId) {
  const base = { hideHeading: true };
  if (moduleId === 'identity') return { ...base, renderer: 'paired_fields', fieldLabels: IDENTITY_LABELS };
  if (moduleId === 'findings' && ['condition', 'limits'].includes(slotId)) return { ...base, renderer: 'component_narrative', narrativeStyle: 'arrow_list' };
  if (moduleId === 'checklist' && slotId === 'responses') return { ...base, renderer: 'checklist_table', responseColumns: ['1', '2', '3', '4', 'IA', 'NE', 'NC', 'N/A'] };
  if (moduleId === 'checklist' && slotId === 'legend') return { ...base, renderer: 'labelled_fields' };
  if (moduleId === 'thickness' && slotId === 'readings') return { renderer: 'measurement_table', headingCase: 'uppercase' };
  if ((moduleId === 'layout' && slotId === 'figure') || (moduleId === 'photos' && slotId === 'images')) return { ...base, renderer: 'figure' };
  if (moduleId === 'methods' && ['method', 'equipment'].includes(slotId)) return { ...base, renderer: 'labelled_fields' };
  return { ...base, renderer: 'narrative', narrativeStyle: moduleId === 'recommendations' && slotId === 'actions' || moduleId === 'references' ? 'numbered_list' : ['tasks', 'actions', 'notes'].includes(slotId) ? 'arrow_list' : 'paragraph' };
}

const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const number = value => /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : words.indexOf(value.toLowerCase()) >= 0 ? words.indexOf(value.toLowerCase()) : NaN;
const norm = value => String(value ?? '').trim().toLowerCase();

/** Only whole, explicitly corroborated sentences qualify as repetitions. An
 * extra qualifier, changed number, unknown phrase or conflicting value remains
 * required narrative. Never use approximate text similarity to delete facts. */
export function corroboratedIdentityFields(text, fields) {
  let match = text.match(/^The asset is (.+?) for (.+?) at (.+?)\.$/);
  if (match && ['tankNumber', 'client', 'location'].every((key, i) => norm(fields.get(key)?.payload.value) === norm(match[i + 1]))) return ['tankNumber', 'client', 'location'];
  match = text.match(/^This is the current inspection of (.+?) at (.+?)\.$/);
  if (match && ['tankNumber', 'location'].every((key, i) => norm(fields.get(key)?.payload.value) === norm(match[i + 1]))) return ['tankNumber', 'location'];
  match = text.match(/^The tank diameter is ([\w.]+) metres and height is ([\w.]+) metres, with (\w+) shell courses and (\w+) measurement lanes\.$/);
  const dimensions = ['diameterM', 'heightM', 'shellCourseCount', 'shellLaneCount'];
  if (match && dimensions.every((key, i) => fields.has(key) && Number(fields.get(key).payload.value) === number(match[i + 1])) && ['diameterM', 'heightM'].every(key => fields.get(key).payload.unitCode === 'm')) return dimensions;
  return null;
}

export function componentHeading(record) {
  const target = record.locationRef?.targetKey ?? record.captureContext?.targetKey;
  const labels = { floor: 'FLOOR', shell: 'SHELL', external_roof: 'ROOF', internal_roof: 'INTERNAL FLOATING ROOF', foundation: 'FOUNDATION', surroundings: 'DIKED AREA' };
  return labels[target] ?? 'INSPECTION LIMITATIONS';
}
