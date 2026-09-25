// Isolated evaluation adapter. No runtime profile or persisted policy imports this
// module. The shared normalizer, generator and validator remain authoritative.
import { createHash } from 'node:crypto';
import { buildSectionPlanningSnapshot } from '../section-planner.mjs';
import { GENERIC_OUTLINE_MODULES, GENERIC_OUTLINE_VERSION, GENERIC_OUTLINE_REVISION } from './generic-outline-catalog.mjs';
import { GENERIC_SECTION_FORMATS, GENERIC_FORMAT_VERSION } from './generic-outline-formats.mjs';
import { reportPresentation, slotPresentation as presentation, corroboratedIdentityFields, componentHeading, GENERIC_REPORT_PROFILE_ID, GENERIC_REPORT_PRESENTATION_VERSION } from './generic-report-presentation.mjs';

export const GENERIC_OUTLINE_EVALUATION_VERSION = 'generic_outline_evaluation_v1';
export const GENERIC_OUTLINE_EVALUATION_RULE_REVISION = 2;
export const GENERIC_EVALUATION_MODULE_IDS = ['identity', 'scope', 'regime', 'findings', 'recommendations', 'methods', 'checklist', 'thickness', 'layout', 'photos', 'references', 'summary'];
const clone = value => JSON.parse(JSON.stringify(value));
const canonical = value => JSON.stringify(value, (_, child) => child && typeof child === 'object' && !Array.isArray(child) ? Object.fromEntries(Object.entries(child).sort(([a], [b]) => a.localeCompare(b))) : child);
const hash = value => createHash('sha256').update(canonical(value)).digest('hex');
const human = value => String(value ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').replace(/^./, c => c.toUpperCase());
const routingIssues = new Set(['unresolved_section', 'ambiguous_scope', 'unconfirmed_action', 'unassigned']);
const normalizeUnit = value => ({ mm: 'mm', millimetre: 'mm', millimetres: 'mm', millimeter: 'mm', millimeters: 'mm', cm: 'cm', centimetres: 'cm', centimeters: 'cm', in: 'in', inch: 'in', inches: 'in' })[String(value).toLowerCase()] ?? null;
const safe = record => !record.quality.issues.length;

/** Semantic destinations depend on evidence text and native context, never on a
 * script filename, sentence index, expected-label file or readiness judgement. */
export function classifyGenericOutlineText(record) {
  const text = String(record.payload?.text ?? record.displayText ?? '');
  const nativeText = String(record.sourceRecord?.transcriptText ?? '');
  const summaryContext = /\b(?:highlight(?:ed)?|summari[sz]e|in summary|closeout summary)\b/i.test(nativeText);
  const targets = [];
  const add = (sectionId, slotKey, reason) => { if (!targets.some(t => t.sectionId === sectionId && t.slotKey === slotKey)) targets.push({ sectionId, slotKey, reason }); };
  const missingDocument = /\b(?:no|not|without)\b.*\b(?:procedures?|certificates?|calibration|records?|history)\b.*\b(?:supplied|available|provided)\b/i.test(text);
  const unitDeclaration = /\b(?:readings?|thickness|values?)\b.*\b(?:millimet(?:re|er)s?|mm|centimet(?:re|er)s?|cm|inches)\b/i.test(text) && /\b(?:are|is|in|recorded|entered)\b/i.test(text);
  const proposedAction = /\b(?:I|we) recommend(?:ed)?\b|\b(?:recommend(?:ed|ation|s)?|should)\b.*\b(?:repair|replace|restor|renew|inspect|examin|monitor|verify|coat)/i.test(text);
  const actionStatus = /\b(?:recommendations? (?:are|remain)|proposed work|completed repairs?|completion date|responsib(?:ility|le))\b/i.test(text);
  const accessLimit = /\b(?:inaccessible|unexamined|unassessed|not assessed|not inspect(?:ed)?|did not inspect|could not (?:examine|inspect)|not examined|remains? covered|covered by temporary|not included|not provided|not walk|did not walk)\b/i.test(text);
  const testLimit = /\b(?:not|no|only|cannot|do not)\b.*\b(?:scanned|scan|deepest pit|minimum plate thickness|remaining life|acceptance|assessment|measurements?|UT|NDT|survey|readings?)\b|\b(?:readings?|measurements?).*\b(?:only|not establish|not making|not established|not scanned)\b/i.test(text);
  const locationStatement = /\b(?:point labels?|clock positions?|oclock|o'clock|readings? are for|reinforcement pad reading|measurement card)\b/i.test(text);
  const equipment = /\bgauge\b(?!\s+hatch)|\b(?:instrument|examiner|technician|probe|calibration)\b/i.test(text);
  const method = /\b(?:used|carried out|performed|examined visually|viewed|visual inspection|ultrasonic thickness)\b/i.test(text);
  const scope = /\b(?:agreed work|inspection scope|scope (?:covers|includes)|work covers|inspection covers|commissioned|examination extent)\b/i.test(text);
  const geometry = /\b(?:layouts?|maps?|north|orientation|measurement lanes)\b/i.test(text)
    || (/\bmarked\b/i.test(text) && (/\b(?:manway|platform|vent|hatch|nozzle|ladder)\b/i.test(text) || /layout|map/i.test(record.captureContext?.screenKey ?? '')));
  const identity = /\b(?:asset is|current inspection of|client|inspection date|I am [A-Z]|diameter|height|shell courses|welded tank|fixed cone roof|floating roof|previous inspection|maintenance records)\b/i.test(text);

  if (summaryContext) {
    if (proposedAction || actionStatus) add('summary', 'actions', 'explicit_closeout_actions');
    else add('summary', 'results', 'explicit_closeout_results');
  }
  if (proposedAction) { add('recommendations', 'actions', 'captured_inspector_recommendation_proposed_not_approved'); add('summary', 'actions', 'captured_proposed_action_for_summary'); }
  if (actionStatus) add('recommendations', /completion date|timing|deadline/i.test(text) ? 'priority' : 'ownership', 'captured_recommendation_status');
  if (scope) { add('scope', 'tasks', 'explicit_commissioned_scope'); add('findings', 'extent', 'current_inspection_extent'); add('summary', 'scope', 'commissioned_scope_for_summary'); }
  if (unitDeclaration) add('thickness', 'basis', 'explicit_thickness_unit_statement');
  if (locationStatement) { add('thickness', 'location', 'native_measurement_location_description'); add('layout', 'correspondence', 'measurement_to_location_description'); }
  if (accessLimit) { add('scope', 'limits', 'explicit_access_or_scope_limitation'); add('findings', 'limits', 'condition_coverage_qualification'); }
  if (testLimit && !actionStatus) { add('methods', 'limits', 'explicit_test_limitation'); add('thickness', 'limits', 'measurement_interpretation_limitation'); }
  if (/\b(?:readings?|measurements?)\b.*\b(?:cover|marked points|spot)\b|\b(?:viewed .*from|accessible surfaces)\b/i.test(text) && !locationStatement) add('methods', 'coverage', 'captured_method_coverage');
  if (equipment && !missingDocument) add('methods', 'equipment', 'captured_equipment_or_examiner');
  if (method && !proposedAction && !missingDocument && !unitDeclaration && !summaryContext) add('methods', 'method', 'captured_method');
  if (missingDocument) {
    if (/previous inspection|maintenance records|history/i.test(text)) add('identity', 'history', 'explicit_history_unavailable_no_prior_asset_claims');
    else add('methods', 'limits', 'procedure_or_calibration_record_unavailable');
  }
  if (identity && !scope && !summaryContext && !missingDocument) {
    const slot = /diameter|height|courses|lanes|welded|roof/i.test(text) ? 'configuration' : /inspection date|I am|current inspection/i.test(text) ? 'inspection' : 'asset';
    add('identity', slot, 'captured_asset_or_inspection_metadata');
  }
  if (geometry && !identity && !scope && !proposedAction && !testLimit && !accessLimit) add('layout', /north|orientation|reference/i.test(text) ? 'legend' : 'correspondence', 'captured_layout_description');
  if (/\bchecklist records\b/i.test(text)) add('checklist', 'notes', 'checklist_inventory_description');
  if (!targets.length && /\b(?:corrosion|pitting|coating damage|crack|leak|condition|deteriorat|damage|defect|debris|erosion|sound|good condition)\b/i.test(text)) add('findings', 'condition', 'captured_condition_observation');
  return targets;
}

/** Build the 25-library candidate using shared normalized app evidence. The
 * selected modules are scope, not gold. This adapter has no approval authority. */
export function buildGenericOutlineEvaluationSnapshot({ exportPackage, selectedModuleIds = GENERIC_EVALUATION_MODULE_IDS, scope = {}, provenance = {} } = {}) {
  if (!Array.isArray(selectedModuleIds) || !selectedModuleIds.length || new Set(selectedModuleIds).size !== selectedModuleIds.length) throw new TypeError('selectedModuleIds must contain unique module IDs');
  const selected = selectedModuleIds.map(id => { const module = GENERIC_OUTLINE_MODULES.find(m => m.id === id); if (!module) throw new Error(`Unknown generic module: ${id}`); return module; });
  const baseline = buildSectionPlanningSnapshot({ exportPackage, scope });
  const inputPackageHash = baseline.inputPackageHash;
  const transformationLedger = [];
  const evidenceRecords = clone(baseline.evidenceRecords);
  const plans = new Map(selected.map(module => [module.id, {
    schemaVersion: 'section_plan_v2', sectionId: module.id, title: module.title, contractVersion: GENERIC_OUTLINE_EVALUATION_VERSION,
    reportProfileId: GENERIC_REPORT_PROFILE_ID, inputPackageHash, status: 'needs_review', evaluationOnly: true,
    applicability: { state: 'applicable', basisRef: 'explicit_evaluation_module_selection' }, scopeReviewRequired: true,
    evidenceUses: [], outputObligations: [], blocks: [], missingRequirements: [], unresolvedEvidence: [],
    generationPolicy: module.generationPolicy ?? { mode: 'shared_governed_generation', aiAllowed: true },
    catalog: { sectionId: module.id, title: module.title, outlineModuleId: module.id, reportPresentation: reportPresentation(module.id, selectedModuleIds), genericFormat: clone(GENERIC_SECTION_FORMATS[module.id]),
      slots: module.outline.map(block => ({ slotKey: block.id, outlineSlotKey: block.id, title: block.title, purpose: module.purpose, requirement: block.requirement,
        type: presentation(module.id, block.id).renderer, presentation: presentation(module.id, block.id), allowVoiceNarrative: module.id !== 'regime', genericFormat: clone(GENERIC_SECTION_FORMATS[module.id].blocks[block.id]) })) },
  }]));
  function ledger(kind, record, detail) { transformationLedger.push({ transformationVersion: GENERIC_OUTLINE_EVALUATION_VERSION, ruleRevision: GENERIC_OUTLINE_EVALUATION_RULE_REVISION, kind, evidenceId: record?.evidenceId ?? null, ...detail }); }
  function issue(record, reason, detail) { if (!record.quality.issues.some(i => i.reason === reason)) record.quality.issues.push({ reason, detail, candidateSections: [] }); }
  function addDerived(kind, sourceRef, payload, rule, sourceEvidenceIds = []) {
    const record = { evidenceId: `evidence_${hash([inputPackageHash, sourceRef, payload, rule]).slice(0, 28)}`, kind, sourceClass: 'evaluation_derived_metadata', sourceRef: { pointer: sourceRef, importHash: inputPackageHash, derivationRule: rule }, entityId: null, locationRef: {}, captureContext: {}, payload: clone(payload), displayText: String(payload.text ?? ''), quality: { status: 'captured', issues: [] }, sourceRecord: clone(payload), sourceEvidenceIds };
    evidenceRecords.push(record); ledger('derived_metadata', record, { rule, sourceEvidenceIds, sourcePointer: sourceRef }); return record;
  }
  function use(record, sectionId, slotKey, reason, role = ['voice_claim', 'observation'].includes(record.kind) ? 'required_narrative' : 'required_structured') {
    const plan = plans.get(sectionId); if (!plan) return;
    if (!plan.catalog.slots.some(s => s.slotKey === slotKey)) throw new Error(`Unknown generic slot ${sectionId}/${slotKey}`);
    const blockId = `${sectionId}:${slotKey}`;
    if (plan.evidenceUses.some(u => u.blockId === blockId && u.evidenceIds.includes(record.evidenceId) && u.role === role)) return;
    const useId = `use_${hash([record.evidenceId, sectionId, slotKey, role, GENERIC_OUTLINE_EVALUATION_VERSION]).slice(0, 24)}`;
    plan.evidenceUses.push({ useId, evidenceIds: [record.evidenceId], entityIds: record.entityId ? [record.entityId] : [], sectionId, slotKey, blockId, role,
      projection: record.kind === 'measurement' ? 'measurement_rows' : record.kind === 'checklist_response' ? 'checklist_rows' : sectionId === 'recommendations' ? 'captured_proposed_action' : 'source_evidence',
      decision: { basis: 'evaluation_candidate_rule', ruleOrReviewId: reason }, approved: false,
      preserve: ['value', 'unit', 'entity', 'location', 'negation', 'uncertainty', 'source_reference'] });
    ledger('candidate_destination', record, { sectionId, slotKey, role, reason });
  }

  // Only legacy destination decisions are replaced. Source-integrity failures
  // survive. Missing entity is reconsidered per semantic purpose below.
  for (const record of evidenceRecords) {
    record.legacyQuality = clone(record.quality);
    record.quality.issues = record.quality.issues.filter(i => !routingIssues.has(i.reason));
    if (['voice_claim', 'observation'].includes(record.kind) && record.quality.issues.some(i => i.reason === 'missing_entity')) {
      const semantic = classifyGenericOutlineText(record);
      if (semantic.length && semantic.every(t => !['findings', 'recommendations'].includes(t.sectionId) || ['extent', 'limits', 'ownership', 'priority'].includes(t.slotKey))) record.quality.issues = record.quality.issues.filter(i => i.reason !== 'missing_entity');
    }
    record.quality.status = record.quality.issues.length ? 'needs_review' : 'captured';
  }

  // Resolve only an explicit inspection-wide declaration, never a coincidental
  // mention of millimetres in a finding or a local measurement's note.
  const globalUnits = evidenceRecords.filter(r => r.kind === 'voice_claim' && safe(r) && /\b(?:all (?:the )?(?:spot UT readings|entered thickness values|thickness (?:values|readings|measurements))|(?:all|every) .*\b(?:readings|thickness values)\b)/i.test(r.displayText))
    .map(record => ({ record, unitCode: normalizeUnit(record.displayText.match(/\b(?:millimet(?:re|er)s?|mm|centimet(?:re|er)s?|cm|inches)\b/i)?.[0]) })).filter(x => x.unitCode);
  const unitCodes = [...new Set(globalUnits.map(x => x.unitCode))];
  for (const record of evidenceRecords.filter(r => r.kind === 'measurement')) {
    if (!record.payload.unitCode && unitCodes.length === 1) {
      record.payload.cells = record.payload.cells.map(cell => ({ ...cell, sourceUnitCode: cell.unitCode, unitCode: unitCodes[0] }));
      record.payload.sourceUnitCode = record.payload.unitCode; record.payload.resolvedUnitCode = unitCodes[0]; record.payload.unitCode = unitCodes[0];
      record.payload.unitSource = 'explicit_inspection_wide_voice_declaration'; record.payload.unitReviewRequired = true;
      record.quality.issues = record.quality.issues.filter(i => i.reason !== 'unknown_unit');
      ledger('candidate_unit_resolution', record, { sourceUnitCode: null, candidateUnitCode: unitCodes[0], sourceEvidenceIds: globalUnits.map(x => x.record.evidenceId), requiresReview: true, mutatesImportedExport: false });
    } else if (unitCodes.length > 1 || (record.payload.unitCode && unitCodes.length === 1 && record.payload.unitCode !== unitCodes[0])) issue(record, 'conflicting_unit', 'Captured thickness units conflict; no candidate unit was applied.');
  }

  const originalRecords = [...evidenceRecords];
  for (const record of originalRecords) {
    const pointer = record.sourceRef.pointer;
    if (record.kind === 'identity') {
      const key = record.payload.fieldKey;
      use(record, 'identity', /RoofType|diameter|height|Course|Lane/.test(key) ? 'configuration' : key === 'inspector' ? 'inspection' : /reference/.test(key) ? 'configuration' : 'asset', 'native_identity_field');
      if (/reference/.test(key)) use(record, 'layout', 'legend', 'native_orientation_field');
    } else if (record.kind === 'measurement') {
      const element = String(record.payload.itemKind).toLowerCase() === 'element' || Boolean(record.payload.elementId);
      const group = `${record.payload.targetKey ?? 'unknown'}${element ? `-${record.payload.elementTypeKey ?? 'element'}` : ''}`;
      const plan = plans.get('thickness'); const slotKey = `readings-${group}`;
      if (plan && !plan.catalog.slots.some(s => s.slotKey === slotKey)) {
        const base = plan.catalog.slots.find(s => s.slotKey === 'readings');
        plan.catalog.slots.push({ ...clone(base), slotKey, outlineSlotKey: 'readings', title: `${human(group).toUpperCase()} ${element ? '' : 'PLATE '}THICKNESS MEASUREMENTS`, presentation: presentation('thickness', 'readings') });
      }
      use(record, 'thickness', slotKey, 'native_rows_grouped_by_component_and_subcomponent');
    } else if (record.kind === 'checklist_response') {
      use(record, 'checklist', 'responses', 'native_checklist_row_including_its_note');
    } else if (record.kind === 'geometry') {
      const target = exportPackage.layoutTargets?.find(t => t.targetKey === record.payload.targetKey);
      if (target?.inLayoutScope === false) { ledger('excluded_inactive_layout', record, { reason: 'native_inLayoutScope_false' }); continue; }
      use(record, 'layout', 'figure', 'active_native_geometry');
    } else if (record.kind === 'attachment') {
      if (/^image\//.test(record.payload.mediaType ?? '') || record.payload.kind === 'finding_photo') use(record, 'photos', 'images', 'native_finding_photo');
      else ledger('attachment_retained_outside_report_content', record, { reason: 'audio_source_is_not_a_photograph' });
    } else if (record.kind === 'scope') {
      // App task completion is not proof of physical inspection coverage.
      ledger('workflow_metadata_retained_as_context', record, { reason: 'app_scope_status_not_report_narrative' });
    } else if (record.kind === 'voice_claim' || record.kind === 'observation') {
      if (/^\/inspectionChecklistItems\//.test(pointer)) { ledger('canonical_row_note_only', record, { reason: 'already_rendered_in_checklist_response_no_narrative_expansion' }); continue; }
      if (/^\/inspectionChecklistSectionNotes\//.test(pointer)) { use(record, 'checklist', 'notes', 'native_section_note_retained_with_checklist'); continue; }
      const targets = /^\/findings\//.test(pointer) && !/\brecommend|\brepair required/i.test(record.displayText)
        ? [{ sectionId: 'findings', slotKey: 'condition', reason: 'native_finding_condition' }]
        : classifyGenericOutlineText(record);
      if (!targets.length && /^\/findings\//.test(pointer)) targets.push({ sectionId: 'findings', slotKey: 'condition', reason: 'native_finding_condition' });
      if (!targets.length) { issue(record, 'candidate_unresolved_purpose', 'No candidate semantic purpose; retain for review without guessing.'); continue; }
      for (const target of targets) use(record, target.sectionId, target.slotKey, target.reason);
      if (targets.some(t => t.sectionId === 'recommendations' && t.slotKey === 'actions')) {
        record.candidateActionStatus = 'captured_inspector_proposal_not_approved';
        ledger('captured_action_status', record, { status: record.candidateActionStatus, requiresInspectorReview: true, inventsRecommendation: false });
        const finding = evidenceRecords.find(r => r.kind === 'observation' && /^\/findings\//.test(r.sourceRef.pointer) && r.entityId && r.entityId === record.entityId);
        if (finding) use(finding, 'recommendations', 'basis', 'native_action_and_finding_share_entity', 'cross_reference');
      }
    }
  }

  // Response legend is derived from actual captured code/label pairs, retaining
  // NE = None Evident and IA = Inaccessible without inventing a new meaning.
  const labels = new Map();
  for (const row of exportPackage.inspectionChecklistItems ?? []) if (row.ratingKey && row.ratingLabel) {
    const labelSet = labels.get(row.ratingKey) ?? new Set(); labelSet.add(row.ratingLabel); labels.set(row.ratingKey, labelSet);
  }
  for (const [code, meanings] of labels) {
    const record = addDerived('manual_confirmation', '/inspectionChecklistItems', { fieldKey: code, value: [...meanings].join(' / '), text: `${code}: ${[...meanings].join(' / ')}` }, 'captured_checklist_legend');
    if (meanings.size > 1) issue(record, 'conflicting_value', 'A captured response code has multiple meanings.');
    use(record, 'checklist', 'legend', 'captured_checklist_response_semantics');
  }
  for (const [alias, native] of Object.entries(provenance.locationAliases ?? {})) {
    if (!native || !native.itemKey) continue;
    const value = `${native.mapLabel ? `Map label ${native.mapLabel}` : 'Map label not provided'}${native.itemLabel ? `; native label ${native.itemLabel}` : ''}.`;
    const text = `${alias}: ${value}`;
    const record = addDerived('manual_confirmation', `/evaluationSourceProvenance/locationAliases/${alias}`, { fieldKey: alias, value, text, nativeItemKey: native.itemKey }, 'explicit_fixture_location_correspondence');
    use(record, 'layout', 'correspondence', 'provided_source_alias_correspondence');
    if ((exportPackage.utMeasurements ?? []).some(r => r.itemKey === native.itemKey)) use(record, 'thickness', 'location', 'provided_measurement_alias_correspondence');
  }
  // The source PDF is a citation for photograph provenance only. It cannot
  // supply historical inspection facts for the current synthetic asset.
  for (const photo of provenance.sourcePhotos?.photos ?? []) {
    const attachment = originalRecords.find(r => r.kind === 'attachment' && r.payload.relativePath?.split('/').at(-1) === photo.file);
    if (!attachment || !photo.sourceReport || !Number.isInteger(photo.sourcePage)) continue;
    const reportTitle = photo.sourceReport.split(/[\\/]/).at(-1);
    const text = `${reportTitle}, page ${photo.sourcePage}${photo.sourcePhotoNumber != null ? `, Photo ${photo.sourcePhotoNumber}` : ''}. Photograph source for ${photo.photoId}; no same-asset historical correspondence is established.`;
    const citation = addDerived('manual_confirmation', `/evaluationSourceProvenance/sourcePhotos/${photo.photoId}`, { fieldKey: 'Photograph source', value: text, text }, 'supplied_photo_source_citation', [attachment.evidenceId]);
    use(citation, 'references', 'references', 'factual_photo_provenance_not_same_asset_history');
    const captionText = `${photo.photoId}: ${photo.condition ?? attachment.displayText}. Evaluation location ${photo.syntheticLocationAlias ?? 'not established'}; linked native finding ${attachment.payload.findingId ?? 'not provided'}. Original source-photo location correspondence is not established.`;
    const caption = addDerived('manual_confirmation', `/evaluationSourceProvenance/sourcePhotos/${photo.photoId}/caption`, { fieldKey: 'Photograph', value: captionText, text: captionText }, 'supplied_source_photo_caption', [attachment.evidenceId]);
    use(caption, 'photos', 'captions', 'source_photo_condition_and_explicit_synthetic_location');
  }

  // Presentation labels may be derived from captured semantics, never the
  // reference report. Keep the original payload value and source record intact.
  const identityFields = new Map(originalRecords.filter(r => r.kind === 'identity' && safe(r)).map(r => [r.payload.fieldKey, r]));
  for (const record of identityFields.values()) {
    if (['externalRoofType', 'internalRoofType'].includes(record.payload.fieldKey) && /^(yes|no)$/i.test(String(record.payload.value))) record.payload.reportValue = /^yes$/i.test(record.payload.value) ? 'Yes' : 'No';
    if (record.payload.fieldKey === 'referenceMode' && record.payload.value === 'tank_north') record.payload.reportValue = 'Tank north';
  }
  const identityPlan = plans.get('identity');
  for (const entry of identityPlan?.evidenceUses ?? []) {
    const record = evidenceRecords.find(r => r.evidenceId === entry.evidenceIds[0]);
    const fields = record.kind === 'voice_claim' && safe(record) ? corroboratedIdentityFields(record.displayText, identityFields) : null;
    if (fields) {
      entry.role = 'supporting'; entry.canonicalEvidenceIds = fields.map(key => identityFields.get(key).evidenceId);
      ledger('corroborating_identity_not_repeated', record, { sectionId: 'identity', rule: 'whole_sentence_facts_equal_captured_fields', canonicalEvidenceIds: entry.canonicalEvidenceIds, originalSlotKey: entry.slotKey });
    }
    if (record.kind === 'identity' && /^reference/.test(record.payload.fieldKey) && plans.has('layout')) {
      entry.role = 'supporting';
      ledger('orientation_has_canonical_layout_use', record, { sectionId: 'identity', canonicalSectionId: 'layout' });
    }
  }
  // One required rendering per exact evidence ID inside a section. Semantic
  // labels remain available as supporting uses; multi-section reuse is retained.
  for (const plan of plans.values()) {
    const priority = plan.sectionId === 'methods' ? ['limits', 'equipment', 'coverage', 'method'] : plan.catalog.slots.map(s => s.slotKey);
    const canonical = new Map();
    for (const entry of [...plan.evidenceUses].sort((a, b) => priority.indexOf(a.slotKey) - priority.indexOf(b.slotKey))) {
      if (!['required_narrative', 'required_structured'].includes(entry.role)) continue;
      const key = entry.evidenceIds.join('|');
      if (!canonical.has(key)) { canonical.set(key, entry); continue; }
      const first = canonical.get(key); entry.role = 'supporting'; entry.canonicalUseId = first.useId;
      ledger('canonical_required_use_within_section', evidenceRecords.find(r => r.evidenceId === entry.evidenceIds[0]), { sectionId: plan.sectionId, originalSlotKey: entry.slotKey, canonicalSlotKey: first.slotKey, canonicalUseId: first.useId });
    }
  }
  // Gather paired information into one physical form without exposing the
  // asset/configuration/inspection routing slots as report subheadings.
  if (identityPlan) {
    const base = identityPlan.catalog.slots.find(s => s.slotKey === 'asset');
    const fieldSlot = { ...clone(base), slotKey: 'report-fields', coversOutlineSlotKeys: ['asset', 'configuration', 'inspection'] };
    identityPlan.catalog.slots.unshift(fieldSlot);
    for (const entry of identityPlan.evidenceUses.filter(u => fieldSlot.coversOutlineSlotKeys.includes(u.slotKey))) {
      entry.outlineSlotKey = entry.slotKey; entry.slotKey = fieldSlot.slotKey; entry.blockId = `identity:${fieldSlot.slotKey}`;
    }
  }
  // Findings and their access qualifications stay together by component.
  const findingPlan = plans.get('findings');
  if (findingPlan) {
    const base = findingPlan.catalog.slots.find(s => s.slotKey === 'condition');
    for (const entry of findingPlan.evidenceUses.filter(u => ['condition', 'limits'].includes(u.slotKey))) {
      const record = evidenceRecords.find(r => r.evidenceId === entry.evidenceIds[0]);
      const heading = componentHeading(record);
      const slotKey = `report-${heading.toLowerCase().replace(/[^a-z]+/g, '-')}`;
      record.presentation = { ...record.presentation, componentHeading: heading };
      if (!findingPlan.catalog.slots.some(s => s.slotKey === slotKey)) findingPlan.catalog.slots.push({ ...clone(base), slotKey, coversOutlineSlotKeys: ['condition', 'limits'] });
      ledger('report_component_group', record, { sectionId: 'findings', outlineSlotKey: entry.slotKey, reportSlotKey: slotKey, componentHeading: heading });
      entry.outlineSlotKey = entry.slotKey; entry.slotKey = slotKey; entry.blockId = `findings:${slotKey}`;
    }
  }
  for (const record of evidenceRecords.filter(r => r.kind === 'measurement')) {
    const aliasEntry = Object.entries(provenance.locationAliases ?? {}).find(([, native]) => native.itemKey === record.payload.itemKey);
    if (!aliasEntry) continue;
    const [alias, native] = aliasEntry;
    record.presentation = { ...record.presentation, reportItemLabel: `${alias} (${native.mapLabel && native.mapLabel !== record.payload.itemLabel ? `map ${native.mapLabel}; native ` : ''}${record.payload.itemLabel})` };
    const descriptions = evidenceRecords.filter(r => r.kind === 'voice_claim' && safe(r) && r.displayText.split(/[^A-Za-z0-9-]+/).includes(alias));
    const floorPoints = descriptions.find(r => /five point labels are UT1 through UT5, in the same order as the measurement card/i.test(r.displayText));
    const nozzlePoints = descriptions.find(r => /four readings are at twelve, three, six and nine oclock, with a separate reinforcement pad reading/i.test(r.displayText));
    const titles = floorPoints && record.payload.targetKey === 'floor' ? ['UT1', 'UT2', 'UT3', 'UT4', 'UT5'] : nozzlePoints && record.payload.elementTypeKey === 'nozzle' ? ["12 o'clock", "3 o'clock", "6 o'clock", "9 o'clock"] : null;
    const entry = plans.get('thickness')?.evidenceUses.find(u => u.evidenceIds.includes(record.evidenceId));
    if (titles && entry) {
      const slot = plans.get('thickness').catalog.slots.find(s => s.slotKey === entry.slotKey);
      record.presentation.measurementColumns = titles.map((title, i) => ({ key: `value${i + 1}`, title }));
      if (nozzlePoints) record.presentation.measurementColumns.push({ key: 'reinforcementPadReading', title: 'Reinforcement pad' });
      ledger('captured_measurement_point_labels', record, { sourceEvidenceIds: [(floorPoints ?? nozzlePoints).evidenceId], columns: record.presentation.measurementColumns, alias, nativeItemKey: native.itemKey });
    }
  }

  for (const slot of plans.get('thickness')?.catalog.slots ?? []) {
    if (slot.presentation.renderer !== 'measurement_table') continue;
    const ids = new Set(plans.get('thickness').evidenceUses.filter(u => u.slotKey === slot.slotKey).flatMap(u => u.evidenceIds));
    const rows = evidenceRecords.filter(r => r.kind === 'measurement' && ids.has(r.evidenceId));
    if (rows.length && rows.every(r => r.presentation?.measurementColumns && JSON.stringify(r.presentation.measurementColumns) === JSON.stringify(rows[0].presentation.measurementColumns))) slot.presentation.measurementColumns = clone(rows[0].presentation.measurementColumns);
  }

  // Component tables precede correspondence/limitations; dynamic native
  // variants must not be appended after every explanatory outline block.
  const thicknessPlan = plans.get('thickness');
  if (thicknessPlan) {
    const order = ['basis', 'readings', 'location', 'limits'];
    thicknessPlan.catalog.slots.sort((a, b) => order.indexOf(a.outlineSlotKey) - order.indexOf(b.outlineSlotKey));
  }

  for (const record of evidenceRecords) record.quality.status = record.quality.issues.length ? 'needs_review' : 'captured';
  const recordsById = new Map(evidenceRecords.map(r => [r.evidenceId, r]));
  const unresolvedEvidence = evidenceRecords.flatMap(record => record.quality.issues.map(entry => ({ evidenceId: record.evidenceId, ...entry, displayText: record.displayText, impact: 'evaluation_review_required' })));
  for (const plan of plans.values()) {
    const usedIds = new Set(plan.evidenceUses.flatMap(u => u.evidenceIds));
    plan.unresolvedEvidence = unresolvedEvidence.filter(e => usedIds.has(e.evidenceId));
    for (const entry of plan.unresolvedEvidence) plan.missingRequirements.push({ requirementId: `resolve:${entry.evidenceId}:${entry.reason}`, reason: entry.detail, resolution: 'review_source', blocksApproval: true });
    for (const record of evidenceRecords.filter(r => usedIds.has(r.evidenceId) && r.payload.unitReviewRequired)) plan.missingRequirements.push({
      requirementId: `confirm-unit:${record.evidenceId}`, reason: `The imported row ${record.payload.itemLabel ?? record.payload.itemKey} has no native unit. Candidate ${record.payload.unitCode} comes from an explicit inspection-wide voice declaration and still needs structured unit confirmation.`,
      resolution: 'confirm_structured_measurement_unit', blocksApproval: true, blocksEvaluationDraft: false, evidenceId: record.evidenceId,
    });
    for (const entry of plan.evidenceUses.filter(u => u.role !== 'supporting')) {
      const record = recordsById.get(entry.evidenceIds[0]);
      const expected = record.kind === 'measurement' ? { cells: record.payload.cells, itemLabel: record.payload.itemLabel, measured: record.payload.measured }
        : ['geometry', 'attachment'].includes(record.kind) ? { artifact: { kind: record.kind, targetKey: record.payload.targetKey ?? null, attachmentId: record.payload.attachmentId ?? null, sourcePointer: record.sourceRef.pointer, sourceHash: record.payload.sha256 ?? hash(record.sourceRecord), renderedOutsideHtml: true }, label: record.displayText }
          : { text: record.displayText, ...(['identity', 'manual_confirmation'].includes(record.kind) ? { value: record.payload.value, fieldKey: record.payload.fieldKey } : {}) };
      plan.outputObligations.push({ obligationId: `obligation_${hash(entry.useId).slice(0, 24)}`, requirementId: `${plan.sectionId}:${entry.slotKey}:${record.kind}`, evidenceIds: entry.evidenceIds, entityIds: entry.entityIds, targetBlockId: entry.blockId,
        realization: entry.role === 'cross_reference' ? 'cross_reference' : entry.role === 'required_narrative' ? 'narrative_finding' : 'structured_record', criticality: record.kind === 'measurement' ? 'critical' : 'ordinary', expected,
        denominatorScope: 'candidate_routed_obligations_not_independent_benchmark' });
    }
    plan.blocks = plan.catalog.slots.map(slot => {
      const blockId = `${plan.sectionId}:${slot.slotKey}`; const uses = plan.evidenceUses.filter(u => u.blockId === blockId);
      return { blockId, slotKey: slot.slotKey, outlineSlotKey: slot.outlineSlotKey, title: slot.title, purpose: slot.purpose, presentation: slot.presentation, type: slot.type,
        composition: slot.allowVoiceNarrative && uses.some(u => u.role === 'required_narrative' && u.evidenceIds.some(id => recordsById.get(id)?.kind === 'voice_claim')) ? 'voice_narrative' : 'deterministic',
        useIds: uses.map(u => u.useId), obligationIds: plan.outputObligations.filter(o => o.targetBlockId === blockId).map(o => o.obligationId), dependsOnBlockIds: [] };
    }).filter(block => block.useIds.length);
    const populated = new Set(plan.evidenceUses.map(u => u.outlineSlotKey ?? plan.catalog.slots.find(s => s.slotKey === u.slotKey)?.outlineSlotKey ?? u.slotKey));
    for (const slot of plan.catalog.slots.filter(s => s.slotKey === s.outlineSlotKey)) {
      if (!populated.has(slot.slotKey) && slot.requirement === 'when_selected_and_applicable') plan.missingRequirements.push({ requirementId: `${plan.sectionId}:${slot.slotKey}:missing-input`, reason: plan.sectionId === 'regime' ? 'Approved standard regime template has not been selected; AI is disabled.' : `No current evidence for ${slot.title}.`, resolution: plan.sectionId === 'regime' ? 'approved_template_selection' : 'capture_or_confirm_applicability', blocksApproval: true });
    }
    plan.status = plan.missingRequirements.length ? (plan.blocks.length ? 'needs_attention' : 'pending_inputs') : 'ready_for_evaluation';
    plan.planId = `plan_${hash([inputPackageHash, selectedModuleIds, plan.sectionId, GENERIC_OUTLINE_EVALUATION_VERSION, GENERIC_OUTLINE_EVALUATION_RULE_REVISION, provenance]).slice(0, 28)}`;
  }
  return { contractVersion: GENERIC_OUTLINE_EVALUATION_VERSION, ruleRevision: GENERIC_OUTLINE_EVALUATION_RULE_REVISION, sectionContractVersion: GENERIC_OUTLINE_VERSION,
    outlineRevision: GENERIC_OUTLINE_REVISION, reportProfileId: GENERIC_REPORT_PROFILE_ID, formatterContractVersion: GENERIC_REPORT_PRESENTATION_VERSION, formatVersion: GENERIC_FORMAT_VERSION, outlineCatalogHash: hash(GENERIC_OUTLINE_MODULES),
    snapshotId: `planning_${hash([inputPackageHash, selectedModuleIds, scope, provenance, GENERIC_OUTLINE_EVALUATION_VERSION, GENERIC_OUTLINE_EVALUATION_RULE_REVISION]).slice(0, 28)}`,
    inputPackageHash, scope: clone(scope), evaluationOnly: true, approved: false, selectedModuleIds: [...selectedModuleIds], evidenceRecords, sectionPlans: [...plans.values()], unresolvedEvidence, transformationLedger,
    sourceProvenance: clone(provenance), legacyDiagnostic: { contractVersion: baseline.contractVersion, ruleRevision: baseline.ruleRevision, snapshotId: baseline.snapshotId, unresolvedEvidence: baseline.unresolvedEvidence },
    evaluationLimitations: ['Candidate semantic rules are an experiment, not the production profile.', 'Authored transcripts, if supplied by the runner, do not establish ASR quality.', 'Routed output obligations measure preservation only, not independent semantic recovery.', 'No assessment, approval, historic facts, regime interval or missing measurement is inferred.'] };
}
