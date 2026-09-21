// Evaluation format catalogue. The shared compiler implements the selected report presentation contract; full export parity remains a separate check.
export const GENERIC_FORMAT_VERSION = 'generic_section_format_candidate_v2';

export const GENERIC_REPORT_FORMAT = {
  version: GENERIC_FORMAT_VERSION,
  status: 'evaluation_design_candidate',
  layoutOwner: 'deterministic_formatter',
  aiMayChooseFormatting: false,
  page: {
    size: 'A4', widthMm: 210, heightMm: 297, orientation: 'portrait', marginMm: 25.4,
    usableWidthMm: 159.2,
    landscape: 'Only an explicitly selected reviewed format variant; never an AI decision or silent overflow fallback.',
    sectionStart: 'Profile-controlled; keep related short text sections flowing. Dedicated drawings/forms may start a new page. No fixed source-page numbers.',
    header: 'Confirmed client, report reference, asset ID and completion date; omit unavailable optional fields.',
    footer: 'Rendered page number and approved footer text where configured.',
  },
  typography: {
    fontFamily: 'Arial', bodyPt: 10.5, bodyLineSpacing: 1.5, paragraphAfterPt: 6,
    sectionHeading: { semanticStyle: 'Heading1', sizePt: 14, bold: true, color: '0A3F73', numbered: true },
    subsectionHeading: { semanticStyle: 'Heading2', sizePt: 12, bold: true, color: '0D4F90' },
    detailHeading: { semanticStyle: 'Heading3', sizePt: 11, bold: true, color: '0A3F73' },
    captionPt: 10, tablePt: 10.5, minimumTablePt: 10, tableLineSpacing: 1,
    alignment: 'Left-align prose; preserve the approved standard-section style.',
    headingPagination: 'Keep a heading with its first paragraph, table header plus first row, or figure; avoid widows and orphans.',
  },
  tables: {
    width: 'Within the printable content width', headerFill: 'EAF2FB', borderPt: 0.5,
    headerBold: true, repeatHeaderOnContinuation: true,
    rowSplit: 'Avoid; if one row exceeds a page, use a labelled continuation preserving its identity and cell relationships.',
    alignment: { labels: 'left', numbers: 'right', responseMarkers: 'center' },
    nativeSchema: 'Preserve native row IDs, column order, grouped headers, recorded precision and unit meaning. Suggested fields are not invented mandatory columns.',
    missingValues: 'Display the recorded status; distinguish missing, not measured and not applicable. Never coerce a missing value to zero.',
    overflow: 'Wrap labels, then use reviewed semantic column groups with repeated identity columns. Otherwise require a reviewed landscape or large-format variant; do not clip, drop columns or silently shrink below the minimum.',
    caption: 'Table {sectionNumber}.{tableIndex} — descriptive title, above the table.',
  },
  figures: {
    width: 'At most the available page content width; no fixed pixel width', preserveAspectRatio: true,
    height: 'At most the available body height after reserving space for the section heading, caption and legend; move the complete group to another page when needed.',
    crop: 'No automatic cropping of drawings, plots, labels, legends or photographs.',
    caption: 'Figure {sectionNumber}.{figureIndex} — factual title and location, below the figure.',
    pagination: 'Keep figure and caption together; move to a dedicated page if necessary. Preserve legibility rather than shrinking unreadable labels.',
    numbering: 'Resolve displayed numbers after assembly; preserve native plate, station and photograph identifiers in labels.',
  },
  reviewVsExport: 'Review provenance and missing-input notices remain review metadata. Customer export contains selected approved sections without debug markers, evidence inventories or unresolved placeholders.',
  length: 'Use the space required by applicable evidence. Do not expand to a historical page count or repeat detail tables as prose. No fixed word cap may suppress required content.',
  precedence: 'Explicit approved standard-section or attachment layouts take precedence over the generic body styling; do not silently reformat those artifacts.',
  parity: 'The same ordered semantic blocks, values, figures, captions and references must feed evaluation preview and export; visual parity requires later renderer integration and render verification.',
};

const text = (style, rule) => ({ kind: 'text', style, rule });
const table = (schema, fields, rule) => ({ kind: 'table', schema, fields, rule });
const figure = (layout, rule) => ({ kind: 'figure', layout, rule });
const composite = (layout, parts, rule) => ({ kind: 'composite', layout, parts, rule });
const variant = (layout, alternatives, rule) => ({ kind: 'variant', layout, alternatives, rule, selection: 'Choose from current evidence structure or an explicitly selected format variant; never an AI layout decision.' });
const format = (layout, blocks, pagination, notes = [], heading = 'Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.') => ({
  version: GENERIC_FORMAT_VERSION, layout, blocks, pagination, notes,
  heading,
});

export const GENERIC_SECTION_FORMATS = {
  identity: format('Borderless paired label–value sheet', {
    asset: text('paired_labelled_fields', 'Use borderless paired Client, Tank Number and Location fields; no Field/Value heading or repeated identity prose.'),
    configuration: text('paired_labelled_fields', 'Continue the same paired form with captured units and semantic labels; roof presence is distinct from roof type.'),
    inspection: text('paired_labelled_fields', 'Continue the same form; dates and personnel retain their captured roles.'),
    history: table('dated_events', ['Date', 'Event / work', 'Notes'], 'Only available confirmed history, ordered by date; unknown dates remain explicit.'),
  }, 'Keep each short field group together; repeat table headers for long histories.'),
  scope: format('Scope bullets with short limitation paragraphs', {
    tasks: text('arrow_list', 'One commissioned task per item; preserve qualifiers and component/extent.'),
    limits: text('short_paragraphs', 'Group access restrictions, exclusions and coverage limitations.'),
    basis: text('reference_list', 'Readable document titles/editions; no copied standard text.'),
  }, 'Flow within the page; keep each scope item with its qualification.'),
  regime: format('Approved standard section, preserved layout', {
    basis: { kind: 'approved_template_block', rule: 'Insert the selected approved wording and layout unchanged.' },
    activities: { kind: 'approved_template_block', rule: 'Retain approved paragraphs/lists/tables; substitute only declared confirmed fields.' },
    limits: { kind: 'approved_template_block', rule: 'Preserve the applicable approved variant and explicit manual edits.' },
  }, 'Follow the selected approved template’s pagination.', ['No AI drafting, paraphrasing, polishing or layout selection. The generic table style must not override the standard section.'], 'Reuse the approved section heading once; do not prepend a duplicate or turn semantic basis/activities/limits slots into new visible headings.'),
  findings: format('Component headings with concise findings', {
    extent: text('short_paragraphs', 'State the actual examination extent once.'),
    condition: text('component_groups', 'Use bold uppercase component/side headings; concise paragraphs or arrow bullets. Keep condition, location and qualification together.'),
    overview: table('verified_summary', ['Native overview columns'], 'Use only a supplied verified survey overview; do not invent assessment columns.'),
    assessment: text('short_paragraphs_with_references', 'Reference canonical measurements and reviewed results without copying whole tables.'),
    limits: text('short_paragraphs', 'State component-specific limitations without repeating scope boilerplate.'),
  }, 'Keep a component heading with the first finding; allow long component groups to continue.'),
  recommendations: format('Numbered actions grouped by component or confirmed priority', {
    actions: text('numbered_actions', 'One captured proposed action per item, with component/location and qualifications.'),
    basis: text('inline_cross_references', 'Place the finding or assessment reference beside its action.'),
    priority: text('inline_labelled_fields', 'Show only confirmed priority/timing; avoid fabricated empty columns.'),
    ownership: text('inline_labelled_fields', 'Append confirmed responsibility or verification status to its action.'),
  }, 'Keep each action and its basis/qualification together.', ['A reviewed action-register variant may use Action / Location / Basis / Priority / Responsibility / Status; optional columns appear only when applicable.']),
  methods: format('Method metadata with coverage description', {
    method: table('native_method_form', ['Native procedure / instrument / probe / settings / examiner fields'], 'One group per method and inspection phase; retain merged headers and field relationships. Use a label–value grid only for a simple form.'),
    equipment: table('native_equipment_personnel', ['Item / role', 'Identification', 'Recorded details'], 'Preserve actual equipment and examiner fields; do not imply missing certification.'),
    coverage: variant('paragraphs_or_native_extent_table', [text('short_paragraphs', 'Simple recorded extent.'), table('native_extent', ['Native location / extent columns'], 'Several locations retain their native field relationships.')], 'Use a table for several locations; prose for a simple extent.'),
    limits: text('short_paragraphs', 'Method-specific limitations follow the coverage.'),
  }, 'Keep method title and metadata together; continue long equipment/coverage tables with headers.'),
  checklist: format('Category-grouped response grid', {
    legend: text('compact_legend', 'Preserve exact response labels and meanings for this checklist.'),
    responses: table('native_checklist', ['Item no.', 'Inspection item', 'Native response columns'], 'Retain order, selected markers and additional response categories; never force a fixed response set.'),
    notes: text('row_linked_notes', 'Notes stay beside the item or use a clearly numbered note reference.'),
  }, 'Repeat headers and category context on continuation pages; keep item, response and note associated.', ['For example, preserve an existing 1 / 2 / 3 / 4 / IA / NE / N/A grid and any additional native codes; this is not a mandatory response set for every checklist.']),
  thickness: format('Component-specific measurement grid', {
    basis: text('compact_labelled_fields', 'State component, side/phase, method and captured units.'),
    readings: table('native_measurement', ['Native item / location', 'Native reading columns with units'], 'Retain point labels, order, grouping and precision; no universal R1–R5 assumption.'),
    location: text('table_note_cross_references', 'Link point IDs to the applicable layout figure.'),
    limits: text('row_status_and_table_notes', 'Unmeasured or inaccessible points retain their recorded status.'),
  }, 'Repeat identity and unit headers; split large grids only into explicit location/point groups.', ['Observed variants include plate A–E readings, shell course × compass stations × vertical points, roof-nozzle compass points, shell-nozzle clock positions, and separate or combined reinforcement-pad tables. Preserve the current native variant; these examples are not mandatory columns.']),
  layout: format('Drawing page with legend and correspondence', {
    figure: figure('full_content_width', 'Preserve geometry, orientation and native labels; use a dedicated page when needed.'),
    legend: text('legend_below_or_beside_drawing', 'Keep orientation, symbols and title block readable.'),
    correspondence: table('identifier_mapping', ['Drawing ID', 'Current record / plate ID'], 'Include only when aliases differ; preserve both identifiers.'),
  }, 'Keep drawing, caption and legend on one page where legible; otherwise use a labelled continuation.'),
  calculations: format('Method statement, inputs, verified results and review', {
    basis: text('labelled_method_reference', 'Show the selected method/edition and applicability.'),
    inputs: table('calculation_inputs', ['Parameter', 'Value', 'Unit', 'Readable source reference'], 'Display verified input bindings; no raw internal evidence IDs.'),
    results: table('calculation_results', ['Result', 'Value', 'Unit', 'Criterion / status if supplied'], 'Render verified outputs only; formulas must come from the reviewed calculator.'),
    review: text('short_reviewed_paragraphs', 'Place interpretation immediately after the associated results.'),
  }, 'Keep small input/result groups together; continue large tables with repeated headings.'),
  ndt: format('Method-specific examination form', {
    location: composite('boxed_metadata_and_location_figure', [table('native_location_metadata', ['Native asset / component / area / side / phase fields'], 'Keep the source form relationships.'), { ...figure('location_drawing', 'Retain tested locations.'), when: 'when_supplied' }], 'Identify asset/component, area, side and phase; include a drawing when supplied.'),
    method: table('native_examination_metadata', ['Procedure / equipment / examiner field', 'Recorded value'], 'Preserve the actual form fields for the selected method.'),
    results: table('native_ndt_results', ['Native indication / location ID', 'Method-specific result columns'], 'MPI, penetrant, vacuum-box, PAUT and other methods keep their own schemas.'),
    disposition: text('reviewed_disposition', 'Use only recorded assessment; preserve genuine sign-off fields where supplied.'),
    limits: text('form_notes', 'Place method/coverage limitations with the examination record.'),
  }, 'Start each standalone examination sheet on a new page; preserve original approved attachment pages when selected.', ['Do not invent signatures, approvals or an acceptance-status column.']),
  survey: format('Datum, stations and survey-specific reading tables', {
    basis: text('compact_labelled_fields', 'Identify datum, survey type, method, direction and inspection phase.'),
    stations: composite('station_table_and_location_figure', [table('native_stations', ['Station ID', 'Native coordinate / location columns'], 'Preserve station order and datum.'), { ...figure('station_location_diagram', 'Keep native station labels.'), when: 'when_supplied' }], 'Keep coordinate axes, reference centre and station order; associate the location figure.'),
    readings: table('native_survey', ['Station / direction', 'Native reading and unit columns'], 'Roundness, plumbness, roof cross-section and settlement schemas remain distinct.'),
    assessment: text('short_reviewed_paragraphs_with_references', 'Reference reviewed calculations and matching plots.'),
    limits: text('table_notes', 'State missing stations, inaccessible areas and survey limitations.'),
  }, 'Repeat datum/unit context on continued tables; group by survey, direction or station series.'),
  graphs: format('Survey plots with legends and concise interpretation', {
    plots: figure('one_or_more_legible_plots', 'Use verified data/plots; retain axes, scales, station order, orientation and datum.'),
    legend: text('plot_legend', 'Units and series identities remain adjacent to each plot.'),
    interpretation: text('short_reviewed_paragraphs', 'Place interpretation after its matching plot.'),
  }, 'Keep each plot, legend and caption together; prefer a dedicated page over unreadable scaling.'),
  photos: format('Captioned photograph sheet', {
    images: figure('one_column_or_two_column_grid', 'Use at most two columns when details remain legible; otherwise one full-width image. Preserve aspect ratio.'),
    captions: text('caption_below_each_image', 'Use figure number, component/location and factual description; link the relevant finding.'),
  }, 'Keep each photo with its caption; break between photo groups, not through them.'),
  'method-guidance': format('Controlled method text and symbol legend', {
    guidance: { kind: 'approved_layout', layout: 'approved_guidance_layout', rule: 'Use the applicable approved method/equipment guidance and its version, preserving its paragraphs, illustrations and footnotes.' },
    legend: table('symbol_legend', ['Symbol / category', 'Meaning / unit'], 'Preserve method-specific terminology and colour meanings.'),
    limits: text('short_paragraphs', 'Include only applicable approved interpretation limitations.'),
  }, 'Keep symbol rows together; preserve an approved vendor attachment layout when selected.'),
  'corrosion-plan': format('Floor drawing with verified corrosion overlay', {
    layout: figure('drawing_base_layer', 'Use the current immutable floor layout as the base.'),
    overlay: figure('same_drawing_overlay_layer', 'Compose on the same drawing; do not print a second duplicate base figure.'),
    legend: composite('legend_and_plate_mapping', [text('legend', 'Preserve verified symbols and category meanings.'), { ...table('plate_correspondence', ['Native plate ID', 'Current plate ID'], 'Preserve identifier correspondence.'), when: 'when_identifiers_differ' }], 'Keep severity/category keys and plate correspondence readable and factual.'),
    limits: text('drawing_notes', 'Mark recorded unscanned areas and stated coverage limitations.'),
  }, 'Use a dedicated figure page when necessary; preserve orientation and correspondence across continuations.'),
  platemaps: format('Index followed by individual plate-map sheets', {
    index: table('plate_index', ['Native plate ID', 'Current plate ID when different', 'Map figure / page'], 'Resolve figure/page references after assembly.'),
    maps: figure('one_plate_map_per_sheet_by_default', 'Preserve scale bars, orientation, legend and native labels; selected approved map sheets retain their layout.'),
    limits: text('map_notes', 'Attach limitations to the affected plate or map series.'),
  }, 'Break between plate maps; a reviewed compact variant may group maps only when all labels remain legible.'),
  assessment: format('Structured engineering assessment narrative', {
    basis: text('labelled_basis_and_short_paragraphs', 'Separate assessment method, scope and applicability.'),
    results: table('assessment_summary', ['Assessment item', 'Verified result', 'Criterion if supplied', 'Detail reference'], 'Reference canonical calculations rather than repeating input tables.'),
    conclusion: text('reviewed_conclusion_paragraphs', 'Preserve qualifications and the reviewed conclusion.'),
    limits: text('labelled_assumptions_and_limitations', 'Keep assumptions distinct from measured facts.'),
  }, 'Keep each conclusion with its material qualifications and references.'),
  'scan-profiles': format('Location diagram followed by labelled profile traces', {
    location: figure('location_diagram', 'Use native area/trace IDs to connect locations and traces.'),
    profiles: figure('ordered_profile_panels', 'Retain axes, scales, units, scan direction and trace IDs.'),
    findings: variant('trace_linked_table_or_paragraphs', [table('native_trace_findings', ['Native trace / location / result columns'], 'Preserve indication relationships.'), text('trace_linked_paragraphs', 'Retain the exact trace/location link.')], 'Associate recorded indications with their exact trace/location.'),
    limits: text('profile_notes', 'Retain coverage gaps and instrument/method limitations.'),
  }, 'Keep trace and caption together; repeat area/phase identity when a trace group continues.'),
  dimensional: format('Scan-location diagram, geometry views and dimensional results', {
    stations: composite('station_table_and_location_figure', [table('native_scan_stations', ['Native station / location / coverage columns'], 'Preserve native station identity.'), figure('scan_station_diagram', 'Keep the recorded coverage and location bindings.')], 'Preserve station identity and scan coverage.'),
    views: figure('labelled_geometry_panels', 'Preserve colour scales, coordinate system, units, orientation and reference centre.'),
    results: table('native_dimensional_results', ['Location / station', 'Native geometry/deviation columns'], 'Do not combine different coordinate frames or measurement types.'),
    interpretation: text('short_reviewed_paragraphs', 'Link reviewed interpretation to the corresponding result/view.'),
    limits: text('scan_notes', 'State verified coverage and processing limitations.'),
  }, 'Break by area/view or result series; retain matching legends with each geometry panel.'),
  'repair-verification': format('Repair register with linked verification and condition', {
    work: table('repair_register', ['Repair ID', 'Component / location', 'Confirmed work', 'Phase / date if supplied'], 'Retain the original location binding and repair identity.'),
    verification: table('verification_register', ['Repair ID', 'Examination', 'Recorded result', 'Detail reference'], 'Link to the actual examination; do not infer acceptance.'),
    condition: text('repair_grouped_paragraphs', 'Separate post-repair condition and recorded outstanding items.'),
    limits: text('short_paragraphs', 'Identify limitations of verification.'),
  }, 'Repeat repair IDs on continued tables; do not merge before/after/follow-up phases.'),
  consultation: format('Three-part consultation narrative', {
    request: text('short_paragraphs', 'State the question and commissioned review scope.'),
    proposal: text('paragraphs_with_references', 'Describe the confirmed proposal and available supporting information.'),
    review: text('numbered_review_comments', 'Keep professional comments distinct from the original proposal; link confirmed actions to recommendations.'),
  }, 'Allow a short consultation to share a page with related identity/recommendations; no artificial page expansion.'),
  calibration: format('Calibration metadata and native calibration grid', {
    basis: text('compact_labelled_fields', 'Identify asset, reference datum, units and calibration basis.'),
    table: table('native_calibration', ['Native dip / ullage / volume columns'], 'Preserve grouping, ordering and recorded precision; do not interpolate or add values.'),
    limits: text('table_notes', 'Keep applicability and limitations adjacent to the data.'),
  }, 'Repeat column headings and datum/unit context on each page; optional side-by-side column groups must preserve reading order.'),
  references: format('Consistently numbered reference list', {
    references: text('numbered_reference_list', 'Show document title, identifier, edition/revision and attachment reference where provided; readable without hyperlinks.'),
  }, 'Keep each reference entry together and wrap long titles; numbering resolves with document assembly.'),
  summary: format('Concise summary with references to detail', {
    scope: text('short_opening_paragraph', 'State the commissioned scope without repeating the full scope section.'),
    results: text('short_paragraphs_or_bullets', 'Summarize reviewed results; reference detailed sections and preserve qualifications.'),
    actions: text('short_confirmed_action_list', 'Reference confirmed recommendations without duplicating their complete register.'),
  }, 'No forced one-page or word-count cap; remain concise without omitting required material.'),
};

export function validateGenericFormatCoverage(modules) {
  const errors = [];
  const ids = new Set(modules.map((m) => m.id));
  for (const id of Object.keys(GENERIC_SECTION_FORMATS)) if (!ids.has(id)) errors.push(`Unknown format module: ${id}`);
  for (const module of modules) {
    const format = GENERIC_SECTION_FORMATS[module.id];
    if (!format) { errors.push(`Missing format: ${module.id}`); continue; }
    const slots = new Set(module.outline.map((b) => b.id));
    for (const slot of slots) if (!format.blocks[slot]) errors.push(`Missing block format: ${module.id}.${slot}`);
    for (const slot of Object.keys(format.blocks)) if (!slots.has(slot)) errors.push(`Unknown block format: ${module.id}.${slot}`);
    if (module.id === 'regime' && module.generationPolicy?.aiAllowed !== false) errors.push('Regime must remain a standard section with AI disabled.');
  }
  if (errors.length) throw new Error(errors.join('\n'));
}
