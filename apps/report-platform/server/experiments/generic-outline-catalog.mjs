// Offline outline design candidate. Deliberately not imported by generation,
// the current SectionPlan matcher, or production report authoring.
import { REPORT_TITLES } from './generic-report-presentation.mjs';
import { GENERIC_REPORT_FORMAT, GENERIC_SECTION_FORMATS, validateGenericFormatCoverage } from './generic-outline-formats.mjs';

export const GENERIC_OUTLINE_VERSION = 'generic_report_outline_candidate_v1';
export const GENERIC_OUTLINE_REVISION = 4;

const block = (id, title, presentation, sourceKinds, requirement = 'when_selected_and_applicable') => ({
  id, title, presentation, sourceKinds: sourceKinds.split('|'), requirement,
  missingInputBehavior: requirement === 'when_provided' ? 'omit_optional_block_without_inventing_content' : 'pending_review_when_applicable_and_required_input_is_missing',
  evidenceRolePolicy: 'Assign required_structured or required_narrative only for content obligated in this block; supporting for context; cross_reference for a link to canonical detail. Review each use independently.',
});
const module = (id, title, purpose, repeatBy, outline, generationPolicy) => ({
  id, title, reportTitle: REPORT_TITLES[id], purpose, repeatBy, outline, ...(generationPolicy ? { generationPolicy } : {}),
});

export const GENERIC_OUTLINE_MODULES = [
  module('identity', 'Asset and inspection information', 'Identify the current asset, configuration, inspection and available history.', [], [
    block('asset', 'Asset identity', 'labelled_fields', 'identity'),
    block('configuration', 'Configuration and dimensions', 'labelled_fields_with_units', 'configuration|measurement'),
    block('inspection', 'Inspection details', 'labelled_fields', 'inspection_metadata'),
    block('history', 'Available inspection and maintenance history', 'dated_entries', 'confirmed_history', 'when_provided'),
  ]),
  module('scope', 'Scope and limitations', 'State agreed tasks, examined components, exclusions and access limitations.', [], [
    block('tasks', 'Inspection tasks and extent', 'ordered_list', 'confirmed_scope'),
    block('limits', 'Access, coverage and limitations', 'concise_prose', 'scope_limitation'),
    block('basis', 'Applicable references', 'reference_list', 'approved_reference', 'when_provided'),
  ]),
  module('regime', 'Inspection and maintenance regime', 'Insert the applicable approved standard section without AI generation or rewriting.', [], [
    block('basis', 'Regime basis', 'approved_template_layout', 'approved_regime_template'),
    block('activities', 'Activities, intervals and responsibilities', 'approved_template_layout', 'approved_regime_template|confirmed_regime_fields'),
    block('limits', 'Applicability and limitations', 'approved_template_layout', 'approved_regime_template|confirmed_regime_fields'),
  ], {
    mode: 'standard_template',
    aiAllowed: false,
    templateSource: 'approved_versioned_regime_template',
    rendering: 'Insert approved wording and preserve its layout. Fill only declared placeholders from confirmed report-specific fields; ordinary generation does not rewrite the standard section.',
    reportSpecificChanges: 'Explicit manual edits or a reviewed template variant; no AI-authored intervals, responsibilities, limitations or technical requirements.',
    missingTemplateBehavior: 'pending_template_selection_no_ai_fallback',
    provenance: ['templateId', 'templateRevision', 'templateContentHash', 'confirmedFieldSources', 'manualEditHistory'],
  }),
  module('findings', 'Inspection findings', 'Report captured condition by applicable component, location and inspection phase.', ['component', 'side', 'phase'], [
    block('extent', 'Inspection extent', 'concise_prose', 'confirmed_scope|test_coverage'),
    block('condition', 'Observed condition', 'component_subheadings_and_prose', 'observation|voice_claim|checklist_observation'),
    block('overview', 'Survey overview', 'verified_summary_table', 'verified_survey_summary', 'when_provided'),
    block('assessment', 'Reviewed assessment summary', 'concise_prose_with_cross_references', 'reviewed_assessment', 'when_provided'),
    block('limits', 'Inspection limitations', 'concise_prose', 'scope_limitation'),
  ]),
  module('recommendations', 'Recommendations', 'Record confirmed actions and their basis without turning a finding into an unapproved action.', ['component', 'phase'], [
    block('actions', 'Recommended actions', 'numbered_actions_or_table', 'confirmed_recommendation'),
    block('basis', 'Finding and assessment references', 'cross_references', 'evidence_link'),
    block('priority', 'Priority or timing', 'labelled_fields', 'confirmed_recommendation', 'when_provided'),
    block('ownership', 'Responsibility and verification status', 'labelled_fields', 'confirmed_recommendation|confirmed_repair_record', 'when_provided'),
  ]),
  module('methods', 'Test information and methodology', 'Describe methods actually used, instruments, coverage and limitations.', ['method', 'phase'], [
    block('method', 'Method and procedure', 'labelled_fields_and_prose', 'test_metadata|approved_procedure'),
    block('equipment', 'Equipment and personnel', 'table', 'instrument_metadata|examiner_metadata'),
    block('coverage', 'Examination extent', 'table_or_prose', 'test_coverage'),
    block('limits', 'Method limitations', 'concise_prose', 'test_limitation|approved_guidance'),
  ]),
  module('checklist', 'Inspection checklist', 'Preserve the applicable checklist, response meanings and captured selections.', ['component', 'side', 'phase'], [
    block('legend', 'Response legend', 'legend', 'checklist_definition'),
    block('responses', 'Inspection responses', 'native_checklist_grid', 'checklist_response'),
    block('notes', 'Item notes', 'row_linked_notes', 'checklist_observation', 'when_provided'),
  ]),
  module('thickness', 'Thickness measurements', 'Render native rows, point labels and units for each measured component or subcomponent.', ['component', 'subcomponent', 'side', 'phase'], [
    block('basis', 'Measurement basis and units', 'labelled_fields', 'measurement_metadata'),
    block('readings', 'Measurements', 'native_measurement_grid', 'measurement'),
    block('location', 'Point and layout correspondence', 'cross_references', 'geometry_link'),
    block('limits', 'Unmeasured points and limitations', 'row_status_and_notes', 'measurement_status|test_limitation'),
  ]),
  module('layout', 'Component layout and locations', 'Present source geometry and preserve correspondence with measurements, findings and test areas.', ['component', 'purpose', 'phase'], [
    block('figure', 'Layout', 'figure', 'geometry|approved_drawing'),
    block('legend', 'Legend and orientation', 'legend', 'geometry_metadata'),
    block('correspondence', 'Source item correspondence', 'mapping_table', 'entity_alias', 'when_needed'),
  ]),
  module('calculations', 'Calculations', 'Present separately verified calculations; headings in historical reports do not authorize a formula or criterion.', ['calculationType', 'component', 'subcomponent', 'phase'], [
    block('basis', 'Method and applicability', 'labelled_fields', 'approved_calculation_method'),
    block('inputs', 'Inputs and units', 'protected_input_table', 'measurement|confirmed_calculation_input'),
    block('results', 'Calculated results', 'deterministic_result_table', 'verified_calculation_result'),
    block('review', 'Interpretation and review', 'concise_prose', 'reviewed_assessment'),
  ]),
  module('ndt', 'NDT examination results', 'Report an examination by method, asset/component, area and phase; repeat for any number of areas.', ['assetKind', 'component', 'side', 'method', 'areaId', 'phase'], [
    block('location', 'Test location and extent', 'labelled_fields_and_figure', 'test_coverage|geometry'),
    block('method', 'Procedure and examination details', 'labelled_fields', 'test_metadata|approved_procedure'),
    block('results', 'Indications and results', 'method_specific_table', 'test_result'),
    block('disposition', 'Reviewed disposition', 'concise_prose', 'reviewed_assessment', 'when_provided'),
    block('limits', 'Limitations', 'concise_prose', 'test_limitation'),
  ]),
  module('survey', 'Survey results', 'Support settlement, edge/floor settlement, roundness, plumbness and other commissioned geometry surveys.', ['surveyType', 'component', 'stationGroup', 'phase'], [
    block('basis', 'Survey datum and method', 'labelled_fields', 'survey_metadata'),
    block('stations', 'Station and coordinate locations', 'station_table_and_figure', 'survey_station|geometry'),
    block('readings', 'Survey readings', 'native_survey_grid', 'survey_reading'),
    block('assessment', 'Reviewed interpretation', 'concise_prose_with_cross_references', 'reviewed_assessment', 'when_provided'),
    block('limits', 'Survey limitations', 'concise_prose', 'test_limitation|scope_limitation'),
  ]),
  module('graphs', 'Survey graphs', 'Render verified plots from the current survey with units, axes and station correspondence.', ['surveyType', 'component', 'stationGroup', 'phase'], [
    block('plots', 'Graphs', 'deterministic_chart_or_verified_artifact', 'survey_reading|verified_graph'),
    block('legend', 'Axes, units and legend', 'legend', 'survey_metadata'),
    block('interpretation', 'Reviewed interpretation', 'concise_prose', 'reviewed_assessment', 'when_provided'),
  ]),
  module('photos', 'Photographs', 'Present selected photographs with factual captions and component/location links.', ['component', 'phase'], [
    block('images', 'Selected photographs', 'captioned_figure_grid', 'photo'),
    block('captions', 'Captions and finding links', 'captions', 'photo_metadata|evidence_link'),
  ]),
  module('method-guidance', 'Method interpretation guidance', 'Include approved interpretation guidance only for the selected method or equipment.', ['method', 'equipmentVariant'], [
    block('guidance', 'Interpretation guidance', 'controlled_prose', 'approved_guidance'),
    block('legend', 'Symbols and units', 'legend', 'approved_guidance'),
    block('limits', 'Applicability and limitations', 'concise_prose', 'approved_guidance'),
  ]),
  module('corrosion-plan', 'Floor corrosion plan', 'Overlay verified findings on an immutable floor layout with explicit correspondence.', ['component', 'phase'], [
    block('layout', 'Floor layout', 'figure', 'geometry'),
    block('overlay', 'Verified corrosion overlay', 'verified_overlay', 'verified_corrosion_map'),
    block('legend', 'Legend and plate correspondence', 'legend_and_mapping', 'entity_alias|scan_metadata'),
    block('limits', 'Coverage limitations', 'concise_prose', 'test_limitation'),
  ]),
  module('platemaps', 'MFL plate maps', 'Present verified maps and their source-to-app plate correspondence.', ['component', 'phase'], [
    block('index', 'Plate map index', 'table', 'plate_map_index'),
    block('maps', 'Plate maps', 'verified_figure_sequence', 'verified_plate_map'),
    block('limits', 'Coverage and interpretation limitations', 'concise_prose', 'test_limitation'),
  ]),
  module('assessment', 'Engineering assessment', 'Present an explicitly reviewed assessment backed by current facts and verified calculations.', ['assessmentType', 'component', 'phase'], [
    block('basis', 'Assessment basis and scope', 'concise_prose', 'approved_assessment_method|confirmed_scope'),
    block('results', 'Results and calculation references', 'table_and_cross_references', 'verified_calculation_result|evidence_link'),
    block('conclusion', 'Reviewed conclusion', 'concise_prose', 'reviewed_assessment'),
    block('limits', 'Assumptions and limitations', 'concise_prose', 'confirmed_assumption|scope_limitation'),
  ]),
  module('scan-profiles', 'B-scan and local scan profiles', 'Keep profile traces, locations and interpretation linked to the examined area.', ['component', 'method', 'areaId', 'phase'], [
    block('location', 'Profile locations', 'figure_and_labels', 'geometry_link|scan_metadata'),
    block('profiles', 'Scan profiles', 'verified_figure_sequence', 'verified_scan_profile'),
    block('findings', 'Profile findings', 'table_or_prose', 'test_result|reviewed_assessment'),
    block('limits', 'Profile coverage and limitations', 'concise_prose', 'test_limitation'),
  ]),
  module('dimensional', '3D and dimensional assessment results', 'Present current scan stations, deformation views, heat maps and reviewed geometry results.', ['component', 'surveyType', 'areaId', 'phase'], [
    block('stations', 'Scan station locations and coverage', 'figure_and_table', 'scan_station|test_coverage'),
    block('views', 'Geometry views and heat maps', 'verified_figure_sequence', 'verified_3d_artifact|verified_dimensional_figure'),
    block('results', 'Dimensional results', 'native_result_grid', 'survey_reading|verified_dimension_result'),
    block('interpretation', 'Reviewed interpretation', 'concise_prose', 'reviewed_assessment'),
    block('limits', 'Scan coverage and limitations', 'concise_prose', 'test_limitation|scope_limitation'),
  ]),
  module('repair-verification', 'Post-repair inspection', 'Trace each inspected repair to the original location and the verification performed.', ['component', 'repairId', 'phase'], [
    block('work', 'Repair work and locations', 'repair_register', 'confirmed_repair_record'),
    block('verification', 'Verification examinations', 'table_and_cross_references', 'test_result|evidence_link'),
    block('condition', 'Post-repair condition and outstanding items', 'concise_prose', 'observation|voice_claim|reviewed_assessment'),
    block('limits', 'Verification limitations', 'concise_prose', 'scope_limitation'),
  ]),
  module('consultation', 'Repair consultation and review', 'Keep the requested review, proposed work and professional conclusions distinct.', ['component', 'phase'], [
    block('request', 'Consultation scope', 'concise_prose', 'confirmed_scope'),
    block('proposal', 'Proposed work and available basis', 'prose_and_references', 'confirmed_repair_proposal|evidence_link'),
    block('review', 'Review comments', 'concise_prose', 'reviewed_assessment'),
  ]),
  module('calibration', 'Tank calibration table', 'Present supplied or separately verified calibration records with their units and datum.', [], [
    block('basis', 'Asset, datum and calibration basis', 'labelled_fields', 'identity|calibration_metadata'),
    block('table', 'Calibration data', 'native_calibration_grid', 'verified_calibration_record'),
    block('limits', 'Applicability and limitations', 'concise_prose', 'calibration_metadata'),
  ]),
  module('references', 'References', 'List only references and attachments actually used by the selected report.', [], [
    block('references', 'Referenced documents and editions', 'reference_list', 'approved_reference|approved_attachment'),
  ]),
  module('summary', 'Summary and conclusions', 'Summarize reviewed results with links to detail; never manufacture a new assessment.', [], [
    block('scope', 'Scope overview', 'concise_prose', 'confirmed_scope'),
    block('results', 'Principal reviewed results', 'concise_prose_with_cross_references', 'reviewed_assessment|evidence_link'),
    block('actions', 'Confirmed actions', 'concise_prose_with_cross_references', 'confirmed_recommendation', 'when_provided'),
  ]),
];

const profile = (id, title, scope, moduleOrder, variants) => ({
  id, title, scope, moduleOrder: moduleOrder.split(' '), variants,
  selectionPolicy: 'Review the current commissioned scope and native asset configuration. This is an available module order, not a list of mandatory sections. Instantiate only selected applicable modules; no automatic family selection from historical metadata.',
});

export const GENERIC_OUTLINE_PROFILES = [
  profile('vertical-inspection', 'Vertical tank inspection', 'Vertical tank, declared internal/external/in-service coverage.', 'scope regime identity findings recommendations methods checklist thickness layout calculations ndt scan-profiles survey graphs photos method-guidance corrosion-plan platemaps assessment repair-verification references', ['Internal only', 'External only', 'Internal and external', 'In-service floating roof', 'Inspection with separately scoped repair verification']),
  profile('horizontal-inspection', 'Horizontal tank inspection', 'Horizontal tank confirmed from current configuration.', 'scope references regime identity findings recommendations methods checklist calculations thickness layout ndt photos assessment', ['Internal and external', 'External/on-stream', 'Shell and end caps', 'Nozzles, reinforcement pads and sump']),
  profile('dimensional-survey', 'Tank dimensional survey', 'Explicitly commissioned geometry or settlement survey.', 'scope regime identity methods findings recommendations layout survey graphs dimensional calculations photos assessment references', ['Roundness and plumbness', 'Shell settlement', 'Floor and edge settlement', 'Shell deformation', 'Roof cross-sections']),
  profile('three-dimensional-assessment', '3D profile or floor assessment', 'Explicitly commissioned 3D scan or profile assessment.', 'summary scope methods identity dimensional survey graphs calculations assessment recommendations layout references photos', ['Shell profile assessment', 'Floor heat map and settlement', 'Containment assessment only with a reviewed method and inputs']),
  profile('floor-mfl', 'Floor MFL assessment', 'Tank floor examination and associated verified scans.', 'scope regime identity methods findings checklist thickness scan-profiles layout method-guidance corrosion-plan platemaps calculations assessment recommendations photos references', ['Field inspection', 'MFL with confirmatory UT', 'Plate maps and correspondence']),
  profile('post-repair', 'Post-repair inspection and verification', 'Recorded repair scope and identified verification phase.', 'scope regime identity repair-verification ndt thickness photos layout recommendations assessment references', ['Initial post-repair', 'Follow-up inspection', 'Combined with an inspection profile by explicit module selection']),
  profile('ndt-examination', 'Standalone NDT examination', 'Explicit asset and method; may concern a tank repair, pipeline weld, pressure vessel or test plate.', 'identity scope methods ndt scan-profiles photos layout method-guidance assessment references', ['MPI repair report', 'Penetrant examination before/after repair', 'Pipeline or weld PAUT', 'Pressure-vessel MFL', 'MFL test plate/mock-up: separate from field inspection']),
  profile('repair-consultation', 'Repair consultation', 'Professional review of a specific repair proposal.', 'identity consultation recommendations references', ['Consultation and review', 'Comments and recommendations']),
  profile('calibration', 'Tank calibration', 'Calibration deliverable; does not imply an inspection report.', 'identity scope methods calibration references', ['Calibration table with declared datum and units']),
];

export const GENERIC_OUTLINE_RULES = {
  status: 'evaluation_design_candidate',
  promotionEligible: false,
  productionEnabled: false,
  currentEvaluationGeneratorEnabled: false,
  provenance: 'KB structures inform this catalogue; historical findings, measurements, boilerplate conclusions and acceptance criteria do not populate new reports.',
  sectionIdentity: 'Stable moduleId + explicit instance dimensions; display numbers and pages are assigned after document assembly. No fixed area count or universal Appendix A.',
  applicability: 'Select by reviewed current scope, asset configuration, methods and phase. Applicable missing inputs are pending; out-of-scope sections are omitted. Missing, not provided, inaccessible, not examined and not applicable are distinct.',
  instanceDimensions: ['assetId', 'assetKind', 'component', 'subcomponent', 'side', 'method', 'areaId', 'stationGroup', 'surveyType', 'calculationType', 'assessmentType', 'repairId', 'equipmentVariant', 'purpose', 'phase'],
  evidenceUse: {
    fields: ['useId', 'evidenceId', 'sectionInstanceId', 'moduleId', 'slotId', 'role', 'projection', 'ruleId', 'reviewStatus', 'sourceRevision'],
    roles: ['required_structured', 'required_narrative', 'supporting', 'cross_reference'],
    cardinality: 'One immutable source record can have several independently reviewed uses, including several slots in one section.',
    matching: 'Match native evidence kind plus asset/component/location/method/phase and destination slot. Keywords or old report headings alone cannot establish scope. Ambiguity remains unassigned for review.',
    requiredOutput: 'Only justified required uses contribute to output-recovery obligations. Supporting records are not mandatory repeated prose.',
  },
  presentation: [
    'Each profile chooses grouping and order; tables preserve native point topology and units.',
    'Detailed values have one canonical table; summaries may reference them without duplicating all rows.',
    'No raw-evidence appendix or unassigned-note dump.',
    'Specialist figures, measurement tables and selected report attachments remain legitimate report content.',
    'Historical page numbers and vendor-specific headings are not generic requirements.',
  ],
  implementationBoundary: 'This offline catalogue defines candidate structure and evidence slots. New native adapters, routing rules, rendering, PDF parity and independently reviewed quality evaluation remain separate implementation work. The existing 32-section experiment remains a compatibility preset.',
};

export function getGenericOutlineCatalog() {
  validateGenericFormatCoverage(GENERIC_OUTLINE_MODULES);
  return structuredClone({ version: GENERIC_OUTLINE_VERSION, revision: GENERIC_OUTLINE_REVISION,
    rules: GENERIC_OUTLINE_RULES, reportFormat: GENERIC_REPORT_FORMAT,
    profiles: GENERIC_OUTLINE_PROFILES,
    modules: GENERIC_OUTLINE_MODULES.map((module) => ({ ...module, format: GENERIC_SECTION_FORMATS[module.id] })),
  });
}
