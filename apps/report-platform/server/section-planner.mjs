import { createHash } from 'node:crypto';
import { canUseEvidence, CHECKLIST_COMPONENT_SLOTS, EVIDENCE_USE_ROLES, getSectionContract, matchSectionEvidenceRules, REPORT_PROFILE_ID, REPORT_SECTION_CONTRACTS, SECTION_CONTRACT_VERSION } from './section-contracts.mjs';

export const SECTION_PLANNING_VERSION = 'section_planning_v1';
export const SECTION_PLANNING_RULE_REVISION = 4;
const UNITS = new Set(['mm', 'cm', 'm', 'in', 'ft']);
function unit(value) { return ({ mm: 'mm', millimeter: 'mm', millimetre: 'mm', cm: 'cm', m: 'm', in: 'in', inch: 'in', inches: 'in', ft: 'ft', foot: 'ft', feet: 'ft' })[String(value ?? '').toLowerCase()] ?? null; }
const clone = (value) => JSON.parse(JSON.stringify(value));
function canonical(value) { return JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item); }
function hash(value) { return createHash('sha256').update(canonical(value)).digest('hex'); }
const OUTLINE_CATALOG_HASH = hash(REPORT_SECTION_CONTRACTS);
function text(value) { return typeof value === 'string' ? value.trim() : value == null ? '' : typeof value === 'object' ? String(value.text ?? value.note ?? value.transcriptText ?? '') : String(value); }
function present(value) { return value !== null && value !== undefined && String(value).trim() !== ''; }
function hasAnswerExposure(row) {
  return row?.syntheticEvidenceDerivedFromGold === true || row?.value?.syntheticEvidenceDerivedFromGold === true
    || row?.sourceRole === 'gold_derived_synthetic_capture' || row?.value?.sourceRole === 'gold_derived_synthetic_capture';
}
function location(row = {}) { return Object.fromEntries(['targetKey', 'itemKey', 'plateId', 'course', 'laneId', 'elementId', 'itemLabel'].map((key) => [key, row[key] ?? null])); }
function sourceContext(row = {}) { return Object.fromEntries(['screenKey', 'cardKey', 'fieldKey', 'targetKey', 'itemKey', 'itemLabel', 'sectionKey', 'capturedAtIso'].map((key) => [key, row[key] ?? null])); }
function entity(row, inspectionId) {
  const target = row.targetKey ?? (row.sectionKey ? `checklist:${row.sectionKey}` : null);
  if (!target) return null;
  return `${inspectionId}:${target}:${row.elementId ?? row.itemKey ?? row.plateId ?? 'component'}`;
}
function statements(value) {
  const source = String(value ?? '');
  return [...source.matchAll(/[^;\n]+?(?:[.!?](?=\s|$)|(?=;|\n|$))/g)].map((match) => {
    const leading = match[0].length - match[0].trimStart().length;
    return { text: match[0].trim(), sourceSpan: { start: match.index + leading, end: match.index + match[0].trimEnd().length } };
  }).filter((item) => item.text.length > 0);
}
function componentSlot(record) {
  const context = record.captureContext;
  const direct = CHECKLIST_COMPONENT_SLOTS[context.sectionKey] ?? CHECKLIST_COMPONENT_SLOTS[context.cardKey] ?? CHECKLIST_COMPONENT_SLOTS[context.fieldKey];
  if (direct) return direct;
  const row = record.payload;
  const target = row.targetKey ?? context.targetKey;
  const element = /nozzle|manhole|manway|vent/.test(String(row.elementTypeKey ?? ''));
  if (target === 'floor') return 'floor-internal';
  if (target === 'external_roof') return element ? 'roof-appurtenances' : 'roof-external';
  if (target === 'internal_roof') return 'roof-internal';
  if (target === 'shell') {
    if (element) return 'shell-appurtenances';
    const content = String(row.text ?? '').toLowerCase();
    const internal = /\b(?:internal shell|shell internal|inside (?:the )?shell|internal mpi)\b/.test(content);
    const external = /\b(?:external shell|shell external|outside (?:the )?shell|external mpi)\b/.test(content);
    if (internal !== external) return internal ? 'shell-internal' : 'shell-external';
  }
  return null;
}
function isAction(value) { return /\b(recommend(?:ed|ation|s)?|should (?:be )?(?:repair|replace|renew)|requires? repair|repair (?:is )?required|need(?:s)? (?:to )?(?:repair|replace))\b/i.test(value); }
function normalizedFacts(record) {
  const row = record.payload;
  return {
    kind: record.kind, sourceCollection: record.sourceRef.pointer.split('/')[1],
    fieldKey: row.fieldKey ?? record.captureContext.fieldKey, targetKey: row.targetKey ?? record.captureContext.targetKey,
    screenKey: record.captureContext.screenKey, component: componentSlot(record),
    action: isAction(row.text ?? ''), element: row.itemKind === 'element',
    measurementContext: row.targetKey === 'floor' ? 'floor' : row.targetKey === 'external_roof' ? 'roof' : 'other',
    image: String(row.mediaType ?? '').startsWith('image/') || row.kind === 'finding_photo',
    eligible: !record.quality.issues.some((entry) => ['unsupported_record', 'hidden_source'].includes(entry.reason)),
  };
}
function matchingRules(record) { return matchSectionEvidenceRules(normalizedFacts(record)); }
function issue(record, reason, candidates = [], detail = '') {
  if (!record.quality.issues.some((entry) => entry.reason === reason)) record.quality.issues.push({ reason, candidateSections: candidates, detail });
  record.quality.status = 'needs_review';
}

/** Pure backend normalization/routing. Never mutates an imported package or reads gold. */
export function buildSectionPlanningSnapshot({ exportPackage, manualInputs = {}, decisions = [], scope = {} }) {
  if (!exportPackage || typeof exportPackage !== 'object' || Array.isArray(exportPackage)) throw new TypeError('exportPackage must be an object');
  const inputPackageHash = hash(exportPackage);
  const inspectionId = scope.inspectionId ?? exportPackage.inspectionId ?? exportPackage.inspectionReference ?? 'unidentified-inspection';
  const evidenceRecords = [];
  const plans = new Map(REPORT_SECTION_CONTRACTS.map((contract) => [contract.sectionId, {
    schemaVersion: 'section_plan_v2', sectionId: contract.sectionId, title: contract.title,
    contractVersion: SECTION_PLANNING_VERSION, reportProfileId: REPORT_PROFILE_ID,
    inputPackageHash, status: 'needs_review', applicability: { state: 'unconfirmed', basisRef: 'no-confirmed-evidence' },
    evidenceUses: [], outputObligations: [], blocks: [], missingRequirements: [], unresolvedEvidence: [],
    catalog: contract,
  }]));
  function add(kind, pointer, nativeId, row, payload = row, sourceClass = 'app_field') {
    const identity = nativeId || `unidentified:${hash(row).slice(0, 20)}`;
    const evidenceId = `evidence_${hash([scope.tenantId ?? null, scope.workspaceId ?? null, inputPackageHash, kind, pointer.replace(/\/\d+(?=\/|$)/g, '/[]'), row.targetKey ?? row.sectionKey ?? null, identity]).slice(0, 28)}`;
    const record = { evidenceId, kind, sourceClass, sourceRef: { pointer, nativeRecordId: nativeId ?? null, importHash: inputPackageHash }, entityId: entity(row, inspectionId), locationRef: location(row), captureContext: sourceContext(row), payload: clone(payload), displayText: text(payload.text ?? payload), quality: { status: 'captured', issues: [] }, sourceRecord: clone(row) };
    const duplicate = evidenceRecords.find((candidate) => candidate.evidenceId === evidenceId);
    if (duplicate) {
      issue(duplicate, 'conflicting_value', [], 'Duplicate native record identity');
      record.evidenceId = `${evidenceId}_${hash(pointer).slice(0, 8)}`;
      issue(record, 'conflicting_value', [], 'Duplicate native record identity');
    }
    evidenceRecords.push(record);
    return record;
  }
  function use(record, sectionId, slotKey, role, projection, basis = 'verified_rule', basisRef = 'outline-v2', preservedUseId = null, replayLegacyDecision = false) {
    const plan = plans.get(sectionId);
    const slot = getSectionContract(sectionId)?.slots.find((candidate) => candidate.slotKey === slotKey);
    if (!plan || !slot) throw new Error(`Unknown section/slot ${sectionId}/${slotKey}`);
    if (!replayLegacyDecision && !canUseEvidence(slot, record.kind, role)) throw new Error(`Incompatible evidence ${record.kind}/${role} for ${sectionId}/${slotKey}`);
    const blockId = `${sectionId}:${slotKey}`;
    if (plan.evidenceUses.some((entry) => entry.evidenceIds.includes(record.evidenceId) && entry.blockId === blockId && entry.role === role)) return;
    plan.evidenceUses.push({ useId: preservedUseId ?? `use_${hash([record.evidenceId, sectionId, slotKey, role]).slice(0, 24)}`, evidenceIds: [record.evidenceId], entityIds: record.entityId ? [record.entityId] : [], sectionId, role, projection, blockId, slotKey, relatedSectionId: null, decision: { basis, ruleOrReviewId: basisRef }, preserve: record.kind === 'measurement' ? ['value', 'unit', 'entity', 'location', 'row_order'] : ['entity', 'location', 'condition', 'negation', 'uncertainty', 'source_reference'] });
    if (role.startsWith('required_')) plan.applicability = { state: 'applicable', basisRef: basisRef };
  }
  function observation(row, pointer, nativeId, kind = 'observation', value = row.note, extra = {}) {
    const source = String(value ?? '');
    const spans = statements(source);
    if (!spans.length) return;
    for (const span of spans) {
      const record = add(kind, pointer, `${nativeId}:${span.sourceSpan.start}`, row, { ...row, ...span, ...extra }, kind === 'voice_claim' ? 'app_voice' : 'app_field');
      record.displayText = span.text;
      if (/\|/.test(source) || span.text.length > 1800) { issue(record, 'unsupported_record', ['inspection-report'], 'Unstructured table or oversized source text requires source review'); continue; }
      const matches = matchingRules(record);
      if (isAction(span.text)) {
        issue(record, 'unconfirmed_action', ['repair-recommendations'], 'Recommendation needs explicit reviewer confirmation');
      } else if (!matches.length) {
        issue(record, record.entityId ? 'ambiguous_scope' : 'missing_entity', ['inspection-report'], 'Component or internal/external context requires review');
      }
      if (kind === 'voice_claim' && !/^transcribed(?:_|$)|^complete$|^completed$/i.test(String(row.transcriptStatus ?? ''))) issue(record, 'unverified_transcript', ['inspection-report'], 'Transcript is not marked completed/transcribed');
    }
  }

  const identityFields = ['client', 'tankNumber', 'location', 'fieldLeaseName', 'inspector', 'externalRoofType', 'internalRoofType', 'diameterM', 'heightM', 'shellCourseCount', 'shellLaneCount', 'referenceMode', 'referenceNote'];
  for (const key of identityFields) {
    const value = exportPackage.inspectionRecord?.[key];
    if (!present(value)) continue;
    const record = add('identity', `/inspectionRecord/${key}`, `inspectionRecord:${key}`, { targetKey: 'tank' }, { fieldKey: key, value, unitCode: /(?:diameter|height)M$/.test(key) ? 'm' : null, text: `${key}: ${value}` });
    if (['client', 'tankNumber', 'location'].includes(key)) {
      if (present(exportPackage.task?.[key]) && exportPackage.task[key] !== value) issue(record, 'conflicting_value', ['general-tank-information', 'scope-of-inspection'], `Task and inspectionRecord disagree for ${key}`);
    }
  }
  for (const contract of REPORT_SECTION_CONTRACTS) for (const slot of contract.slots) {
    for (const key of slot.requiredNativeFields) if (!present(exportPackage.inspectionRecord?.[key])) plans.get(contract.sectionId).missingRequirements.push({ requirementId: `identity:${key}`, reason: `Missing ${key}`, resolution: 'capture', blocksApproval: true });
  }

  const measurementRows = new Map((exportPackage.utMeasurements ?? []).map((row) => [`${row.targetKey}:${row.itemKey}`, row]));
  (exportPackage.utMeasurements ?? []).forEach((row, index) => {
    const rowUnit = unit(row.unitCode ?? row.unit);
    const profileUnit = unit(exportPackage.unitProfile?.thicknessUnit);
    const unitCode = rowUnit ?? profileUnit;
    const keys = ['value1', 'value2', 'value3', 'value4', 'value5', 'reinforcementPadReading'];
    const cells = keys.filter((key) => Object.hasOwn(row, key)).map((key) => ({ key, value: row[key], unitCode, sourcePointer: `/utMeasurements/${index}/${key}` }));
    const record = add('measurement', `/utMeasurements/${index}`, row.itemKey, row, { ...row, cells, unitCode });
    record.displayText = `${row.itemLabel ?? row.itemKey ?? 'Unidentified measurement'}: ${cells.map((cell) => `${cell.key} ${cell.value ?? 'not recorded'}${cell.unitCode ? ` ${cell.unitCode}` : ''}`).join('; ')}`;
    const section = matchingRules(record).find((entry) => entry.role === 'required_structured')?.sectionId;
    if (!section) issue(record, 'unresolved_section', ['test-information'], 'No approved detailed measurement destination for this target in the initial profile');
    if (!row.itemKey || !row.targetKey) issue(record, 'missing_entity', section ? [section] : [], 'Measurement requires native target and item identity');
    if (cells.some((cell) => present(cell.value)) && !unitCode) issue(record, 'unknown_unit', section ? [section] : [], 'Native exporter does not declare a verified measurement unit');
    if (rowUnit && profileUnit && rowUnit !== profileUnit) issue(record, 'conflicting_unit', section ? [section] : [], 'Row unit conflicts with the exported thickness unit profile');
    record.payload.unitSource = rowUnit ? 'row' : profileUnit ? 'unitProfile.thicknessUnit' : null;
    if (cells.some((cell) => present(cell.value) && (typeof cell.value === 'boolean' || !Number.isFinite(Number(cell.value)) || Number(cell.value) <= 0))) issue(record, 'unsupported_record', section ? [section] : [], 'Invalid measurement cell; blanks and zero cannot be treated as measured thickness');
    if (row.measured === true && !cells.some((cell) => present(cell.value))) issue(record, 'unsupported_record', section ? [section] : [], 'Measured row has no numeric cells');
  });
  (exportPackage.inspectionChecklistItems ?? []).forEach((row, index) => {
    const record = add('checklist_response', `/inspectionChecklistItems/${index}`, row.sectionKey && row.itemNumber ? `${row.sectionKey}:${row.itemNumber}` : null, { ...row, targetKey: `checklist:${row.sectionKey}` }, { ...row, text: `${row.itemPrompt ?? ''} ${row.ratingLabel ?? 'Unanswered'}` });
    if (!present(row.ratingKey) || !present(row.ratingLabel)) issue(record, 'missing_response', ['tank-inspection-checklist'], 'Checklist item is unanswered');
    if (present(row.itemNote)) observation(row, `/inspectionChecklistItems/${index}/itemNote`, `${row.sectionKey}:${row.itemNumber}:note`, 'observation', row.itemNote);
  });
  (exportPackage.inspectionChecklistSectionNotes ?? []).forEach((row, index) => observation({ ...row, targetKey: `checklist:${row.sectionKey}` }, `/inspectionChecklistSectionNotes/${index}/note`, `${row.sectionKey}:note`, 'observation', row.note));
  (exportPackage.findings ?? []).forEach((row, index) => {
    const linked = measurementRows.get(`${row.targetKey}:${row.linkedUtItemKey}`);
    const merged = linked ? { ...linked, ...row, itemKey: row.linkedUtItemKey } : row;
    observation(merged, `/findings/${index}/note`, row.findingId ?? `unidentified:${index}`, 'observation', row.note);
  });
  (exportPackage.voiceNotes ?? []).forEach((row, index) => {
    if (present(row.transcriptText)) {
      const firstRecord = evidenceRecords.length;
      const itemNumber = row.screenKey === 'checklist' && row.cardKey === 'checklist_item'
        ? String(row.itemKey ?? '').match(/^checklist:(\d+)$/)?.[1] : null;
      const matches = itemNumber ? (exportPackage.inspectionChecklistItems ?? []).map((item, itemIndex) => ({ item, itemIndex }))
        .filter(({ item }) => String(item.itemNumber) === itemNumber && (!item.inspectionId || item.inspectionId === inspectionId)) : [];
      const match = matches.length === 1 ? matches[0] : null;
      const target = match ? ({ diked_area: 'surroundings', tank_foundation: 'foundation', shell_external: 'shell', shell_appurtenances: 'shell', access_structure: 'shell', fixed_roof_cone_dome: 'external_roof', roof_appurtenances: 'external_roof', fixed_roof_internal: 'internal_roof', shell_internal: 'shell', floor_internal: 'floor' })[match.item.sectionKey] : null;
      const conflict = Boolean(target && ((row.targetKey && row.targetKey !== target) || (row.sectionKey && row.sectionKey !== match.item.sectionKey)));
      const resolved = target && !conflict ? { ...row, targetKey: target, sectionKey: match.item.sectionKey } : row;
      observation(resolved, `/voiceNotes/${index}/transcriptText`, row.voiceNoteId ?? `unidentified:${index}`, 'voice_claim', row.transcriptText);
      for (const record of evidenceRecords.slice(firstRecord)) {
        record.sourceRecord = clone(row);
        if (target && !conflict) record.contextResolution = { basis: 'native_checklist_item_join', sourcePointer: `/inspectionChecklistItems/${match.itemIndex}`, itemNumber: match.item.itemNumber, sectionKey: match.item.sectionKey, targetKey: target };
        if (conflict) issue(record, 'unsupported_record', ['inspection-report'], 'Voice context conflicts with its native checklist item');
        if (itemNumber && (!match || !target)) issue(record, 'unsupported_record', ['inspection-report'], 'Voice checklist item is missing, ambiguous, or has an unsupported component');
      }
    }
    else { const record = add('voice_claim', `/voiceNotes/${index}`, row.voiceNoteId, row, { ...row, text: '' }, 'app_voice'); issue(record, 'unverified_transcript', ['inspection-report'], 'Voice note has no completed transcript'); }
  });
  for (const collection of ['layoutConfigs', 'layoutFigures', 'elements']) (exportPackage[collection] ?? []).forEach((row, index) => {
    const record = add('geometry', `/${collection}/${index}`, row.elementId ?? `${row.targetKey}:${collection}`, row);
    const section = matchingRules(record)[0]?.sectionId;
    record.displayText = collection === 'elements' ? `${row.elementLabel ?? row.elementId ?? 'Unlabelled element'} · ${row.targetKey ?? 'Unknown surface'}` : getSectionContract(section)?.title ?? 'Layout awaiting surface classification';
    if (!section) issue(record, 'unresolved_section', [], 'Unsupported layout target');
  });
  (exportPackage.attachments ?? []).forEach((row, index) => {
    const record = add('attachment', `/attachments/${index}`, row.attachmentId, row, { ...row, text: row.displayName ?? '' });
    if (!matchingRules(record).length) issue(record, 'unresolved_section', [], 'Attachment needs an explicit report purpose');
    if (row.fileExists === false) issue(record, 'missing_attachment', ['photographs'], 'Export reports a missing attachment');
    if (row.findingId && !(exportPackage.findings ?? []).some((finding) => finding.findingId === row.findingId)) issue(record, 'missing_entity', ['photographs'], 'Attachment refers to an unknown finding');
  });
  for (const collection of ['taskSnapshots', 'layoutTargets']) (exportPackage[collection] ?? []).forEach((row, index) => {
    add('scope', `/${collection}/${index}`, row.taskKey ?? row.targetKey, row);
  });
  (exportPackage.captureFacts ?? []).forEach((row, index) => {
    const record = add('legacy_capture', `/captureFacts/${index}`, row.factId ?? row.captureId, row, { ...row, text: text(row.value) || text(row.text) });
    record.displayText = text(row.value) || text(row.text) || canonical(row.value);
    const hint = row.sourceSectionKey ?? row.sourceReportSectionId ?? row.targetReportSectionId;
    const candidates = getSectionContract(hint) ? [hint] : [];
    issue(record, /\|/.test(record.displayText) ? 'unsupported_record' : 'unresolved_section', candidates, hasAnswerExposure(row) ? 'Historical answer exposure requires a separate reconstruction experiment' : 'Legacy capture labels are hints only; classify source, entity and report purpose');
    if (hasAnswerExposure(row)) issue(record, 'hidden_source', [], 'Answer-derived evidence cannot enter ordinary generation');
    if (!record.entityId) issue(record, 'missing_entity', candidates, 'Legacy capture has no verified physical entity');
  });
  (exportPackage.structuredTables ?? []).forEach((row, index) => {
    const record = add('legacy_capture', `/structuredTables/${index}`, row.tableId ?? row.id, row, { ...row, text: row.title ?? 'Unverified structured table' });
    issue(record, 'unsupported_record', [], 'Generic fixture/scenario tables require a reviewed native table adapter');
  });
  for (const [key, value] of Object.entries(manualInputs ?? {})) {
    if (!present(value)) continue;
    const record = add('manual_confirmation', `/manualInputs/${key}`, `manual:${key}`, { targetKey: 'tank' }, { fieldKey: key, value: clone(value), text: `${key}: ${text(value) || canonical(value)}` }, 'manual_confirmation');
    record.sourceRef.manualInputHash = hash(manualInputs);
    if (!matchingRules(record).length) issue(record, 'unresolved_section', [], `Report-side field ${key} has no reviewed section mapping`);
  }

  for (const record of evidenceRecords) {
    record.classificationFacts = normalizedFacts(record);
    for (const match of matchSectionEvidenceRules(record.classificationFacts)) use(record, match.sectionId, match.slotKey, match.role, match.projection, 'verified_rule', match.ruleId);
  }

  const draftSnapshot = { evidenceRecords, sectionPlans: [...plans.values()] };
  for (const input of decisions) {
    const decision = validateSectionDecision(draftSnapshot, input);
    if (decision.kind === 'section_scope') {
      const plan = plans.get(decision.sectionId);
      plan.scopeReviewDecision = clone(decision);
      plan.applicability = { state: decision.applicability, basisRef: decision.decisionId ?? hash(decision) };
      plan.applicableSlotKeys = [...decision.applicableSlotKeys];
      continue;
    }
    const record = evidenceRecords.find((entry) => entry.evidenceId === decision.evidenceId);
    const previousUse = decision.useId ? [...plans.values()].flatMap((plan) => plan.evidenceUses).find((entry) => entry.useId === decision.useId) : null;
    if (decision.operation === 'remove') {
      plans.get(previousUse.sectionId).evidenceUses = plans.get(previousUse.sectionId).evidenceUses.filter((entry) => entry.useId !== previousUse.useId);
      record.reviewDecision = clone(decision);
      if (![...plans.values()].some((plan) => plan.evidenceUses.some((entry) => entry.evidenceIds.includes(record.evidenceId)))) {
        issue(record, 'unassigned', [previousUse.sectionId], 'The last destination was removed. Assign this retained evidence to an outline block before approving affected content.');
      }
      continue;
    }
    if (decision.unitCode) {
      record.payload.resolvedUnitCode = decision.unitCode;
      if (record.payload.cells) record.payload.cells = record.payload.cells.map((cell) => ({ ...cell, sourceUnitCode: Object.hasOwn(cell, 'sourceUnitCode') ? cell.sourceUnitCode : cell.unitCode, unitCode: decision.unitCode }));
      record.quality.issues = record.quality.issues.filter((entry) => !['unknown_unit', 'conflicting_unit'].includes(entry.reason));
    }
    if (decision.entityId) {
      if (!Object.hasOwn(record, 'sourceEntityId')) record.sourceEntityId = record.entityId;
      record.entityId = decision.entityId;
      record.quality.issues = record.quality.issues.filter((entry) => entry.reason !== 'missing_entity');
      for (const existingPlan of plans.values()) for (const existingUse of existingPlan.evidenceUses) if (existingUse.evidenceIds.includes(record.evidenceId)) existingUse.entityIds = [record.entityId];
    }
    record.reviewDecision = clone(decision);
    record.quality.issues = record.quality.issues.filter((entry) => !['unresolved_section', 'ambiguous_scope', 'unassigned', ...(decision.role === 'required_narrative' && decision.sectionId === 'repair-recommendations' ? ['unconfirmed_action'] : [])].includes(entry.reason));
    record.quality.status = record.quality.issues.length ? 'needs_review' : 'reviewed';
    if (decision.operation === 'update') {
      plans.get(previousUse.sectionId).evidenceUses = plans.get(previousUse.sectionId).evidenceUses.filter((entry) => entry.useId !== previousUse.useId);
    } else if (!decision.operation) {
      // Replay pre-v2 decisions exactly as originally defined. New decisions
      // always target one use; old persisted rows replaced a whole destination.
      const plan = plans.get(decision.sectionId);
      plan.evidenceUses = plan.evidenceUses.filter((entry) => !entry.evidenceIds.includes(record.evidenceId));
    }
    const reviewedUseId = previousUse?.useId ?? (decision.operation === 'add' ? `use_${hash(['review', record.evidenceId, decision.decisionId ?? decision]).slice(0, 24)}` : null);
    use(record, decision.sectionId, decision.slotKey, decision.role, decision.role === 'required_narrative' ? (decision.sectionId === 'repair-recommendations' ? 'confirmed_action' : 'observation') : record.kind === 'measurement' ? 'measurement_rows' : record.kind === 'checklist_response' ? 'checklist_rows' : 'source_reference', 'reviewer_confirmed', decision.decisionId ?? hash(decision), reviewedUseId, !decision.operation);
  }

  const unsupportedProfile = scope.reportProfileId && scope.reportProfileId !== REPORT_PROFILE_ID;
  const unresolvedEvidence = evidenceRecords.flatMap((record) => record.quality.issues.map((entry) => ({ evidenceId: record.evidenceId, reason: entry.reason, candidateSections: entry.candidateSections, detail: entry.detail, displayText: record.displayText, impact: 'blocks_affected_approval' })));
  for (const plan of plans.values()) {
    const ids = new Set(plan.evidenceUses.filter((entry) => entry.role !== 'supporting').flatMap((entry) => entry.evidenceIds));
    plan.unresolvedEvidence = unresolvedEvidence.filter((entry) => ids.has(entry.evidenceId) || entry.candidateSections.includes(plan.sectionId));
    for (const entry of plan.unresolvedEvidence) plan.missingRequirements.push({ requirementId: `resolve:${entry.evidenceId}:${entry.reason}`, reason: entry.detail || entry.reason, resolution: entry.reason === 'unknown_unit' ? 'manual_confirmation' : 'mapping_review', blocksApproval: true });
    for (const entry of plan.evidenceUses.filter((candidate) => candidate.role !== 'supporting')) {
      const record = evidenceRecords.find((candidate) => candidate.evidenceId === entry.evidenceIds[0]);
      const expected = record.kind === 'measurement' ? { cells: record.payload.cells, itemLabel: record.payload.itemLabel, measured: record.payload.measured }
        : ['geometry', 'attachment'].includes(record.kind) ? { artifact: { kind: record.kind, targetKey: record.payload.targetKey ?? null, attachmentId: record.payload.attachmentId ?? null, sourcePointer: record.sourceRef.pointer, sourceHash: record.payload.sha256 ?? hash(record.sourceRecord), renderedOutsideHtml: record.kind === 'geometry' }, label: record.displayText }
          : { text: record.displayText, ...(record.kind === 'identity' || record.kind === 'manual_confirmation' ? { value: record.payload.value, fieldKey: record.payload.fieldKey } : {}) };
      plan.outputObligations.push({ obligationId: `obligation_${hash(entry.useId).slice(0, 24)}`, requirementId: `${plan.sectionId}:${entry.slotKey}:${record.kind}`, evidenceIds: entry.evidenceIds, entityIds: entry.entityIds, targetBlockId: entry.blockId, realization: entry.role === 'cross_reference' ? 'cross_reference' : entry.role === 'required_narrative' ? 'narrative_finding' : 'structured_record', criticality: record.kind === 'measurement' ? 'critical' : 'ordinary', expected });
    }
    plan.blocks = plan.catalog.slots.map((slot) => {
      const blockId = `${plan.sectionId}:${slot.slotKey}`;
      const uses = plan.evidenceUses.filter((entry) => entry.blockId === blockId && entry.role !== 'supporting');
      return { blockId, slotKey: slot.slotKey, title: slot.title, purpose: slot.purpose, presentation: slot.presentation, type: slot.type, composition: slot.allowVoiceNarrative && uses.some((entry) => evidenceRecords.find((record) => entry.evidenceIds.includes(record.evidenceId))?.kind === 'voice_claim') ? 'voice_narrative' : 'deterministic', useIds: uses.map((entry) => entry.useId), obligationIds: plan.outputObligations.filter((entry) => entry.targetBlockId === blockId).map((entry) => entry.obligationId), dependsOnBlockIds: [] };
    }).filter((block) => block.useIds.length > 0);
    if (unsupportedProfile) plan.missingRequirements.push({ requirementId: 'unsupported-profile', reason: `Unsupported report profile ${scope.reportProfileId}`, resolution: 'manual_confirmation', blocksApproval: true });
    plan.scopeReviewRequired = !plan.scopeReviewDecision;
    if (!plan.scopeReviewDecision) {
      plan.missingRequirements.push({ requirementId: `${plan.sectionId}:applicability`, reason: 'Review the applicable content blocks before approving this section; captured records alone do not establish complete inspection scope', resolution: 'manual_confirmation', blocksApproval: true });
    } else if (plan.scopeReviewDecision.applicability === 'not_applicable') {
      if (plan.outputObligations.length) {
        plan.scopeReviewRequired = true;
        plan.missingRequirements.push({ requirementId: `${plan.sectionId}:scope-conflict`, reason: 'Required captured evidence conflicts with the previous not-applicable decision; review section scope', resolution: 'manual_confirmation', blocksApproval: true });
      }
    } else {
      const activeSlots = new Set(plan.applicableSlotKeys);
      const populatedSlots = new Set(plan.blocks.map((block) => block.slotKey));
      for (const slotKey of activeSlots) if (!populatedSlots.has(slotKey)) plan.missingRequirements.push({ requirementId: `${plan.sectionId}:${slotKey}:missing-content`, reason: `Applicable block ${slotKey.replaceAll('-', ' ')} has no required content yet`, resolution: 'capture', blocksApproval: true });
      for (const slotKey of populatedSlots) if (!activeSlots.has(slotKey)) {
        plan.scopeReviewRequired = true;
        plan.missingRequirements.push({ requirementId: `${plan.sectionId}:${slotKey}:scope-conflict`, reason: `Captured content in ${slotKey.replaceAll('-', ' ')} is outside the reviewed scope; confirm its applicability`, resolution: 'manual_confirmation', blocksApproval: true });
      }
    }
    plan.status = plan.applicability.state === 'not_applicable' && !plan.outputObligations.length && !plan.missingRequirements.some((entry) => entry.blocksApproval) ? 'not_applicable' : plan.missingRequirements.some((entry) => entry.blocksApproval) ? (plan.outputObligations.length ? 'blocked' : 'needs_review') : 'ready';
    plan.planId = `plan_${hash([inputPackageHash, hash(manualInputs), hash(decisions), plan.sectionId, SECTION_PLANNING_VERSION, SECTION_PLANNING_RULE_REVISION, OUTLINE_CATALOG_HASH]).slice(0, 28)}`;
  }
  return { contractVersion: SECTION_PLANNING_VERSION, ruleRevision: SECTION_PLANNING_RULE_REVISION, sectionContractVersion: SECTION_CONTRACT_VERSION, outlineCatalogHash: OUTLINE_CATALOG_HASH, snapshotId: `planning_${hash([inputPackageHash, manualInputs, decisions, scope, SECTION_PLANNING_VERSION, SECTION_PLANNING_RULE_REVISION, OUTLINE_CATALOG_HASH]).slice(0, 28)}`, inputPackageHash, scope: clone(scope), evidenceRecords, sectionPlans: [...plans.values()], unresolvedEvidence };
}

/** Validate a reviewer decision; the API must add the authenticated actor/scope. */
export function validateSectionDecision(snapshot, decision) {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) throw new TypeError('Classification decision must be an object');
  if (decision.kind === 'section_scope') {
    const allowed = new Set(['kind', 'sectionId', 'applicability', 'applicableSlotKeys', 'reason', 'decisionId', 'actorId', 'createdAtIso']);
    for (const key of Object.keys(decision)) if (!allowed.has(key)) throw new Error(`Unsupported section-scope field ${key}`);
    const contract = getSectionContract(decision.sectionId);
    const plan = snapshot.sectionPlans?.find((entry) => entry.sectionId === decision.sectionId);
    if (!contract || !plan) throw new Error('Unknown report section');
    if (!['applicable', 'not_applicable'].includes(decision.applicability)) throw new Error('Choose an explicit section applicability');
    if (!Array.isArray(decision.applicableSlotKeys) || new Set(decision.applicableSlotKeys).size !== decision.applicableSlotKeys.length || decision.applicableSlotKeys.some((key) => !contract.slots.some((slot) => slot.slotKey === key))) throw new Error('Applicable content blocks must use unique canonical section slots');
    if (typeof decision.reason !== 'string' || decision.reason.trim().length < 3 || decision.reason.length > 2000) throw new Error('Section applicability requires a reason');
    const requiredSlots = new Set((plan.evidenceUses ?? []).filter((entry) => entry.role !== 'supporting').map((entry) => entry.slotKey));
    if (decision.applicability === 'not_applicable' && (requiredSlots.size > 0 || decision.applicableSlotKeys.length > 0)) throw new Error('A section with required captured content cannot be marked not applicable');
    if (decision.applicability === 'applicable' && (!decision.applicableSlotKeys.length || [...requiredSlots].some((key) => !decision.applicableSlotKeys.includes(key)))) throw new Error('Applicable scope must include every block containing required captured content');
    return { ...clone(decision), reason: decision.reason.trim() };
  }
  const allowed = new Set(['operation', 'useId', 'evidenceId', 'sectionId', 'slotKey', 'role', 'reason', 'unitCode', 'entityId', 'decisionId', 'actorId', 'createdAtIso']);
  for (const key of Object.keys(decision)) if (!allowed.has(key)) throw new Error(`Unsupported classification field ${key}`);
  const record = snapshot.evidenceRecords.find((entry) => entry.evidenceId === decision.evidenceId);
  if (!record) throw new Error('Classification evidence does not belong to this snapshot');
  if (decision.operation != null && !['add', 'update', 'remove'].includes(decision.operation)) throw new Error('Choose add, update or remove for this evidence destination');
  if (typeof decision.reason !== 'string' || decision.reason.trim().length < 3 || decision.reason.length > 2000) throw new Error('Classification requires a reason');
  const allUses = (snapshot.sectionPlans ?? []).flatMap((plan) => plan.evidenceUses ?? []);
  if (['update', 'remove'].includes(decision.operation)) {
    if (typeof decision.useId !== 'string' || !decision.useId) throw new Error('Updating or removing a destination requires its useId');
    const existing = allUses.find((entry) => entry.useId === decision.useId);
    if (!existing || !existing.evidenceIds.includes(record.evidenceId)) throw new Error('Evidence use does not belong to this evidence record in this snapshot');
  } else if (decision.useId != null) throw new Error('Only update or remove may target an existing useId');
  if (decision.operation === 'remove') {
    if (['sectionId', 'slotKey', 'role', 'unitCode', 'entityId'].some((key) => Object.hasOwn(decision, key))) throw new Error('Removing a destination accepts useId only; it cannot change evidence or assign another destination');
    return { ...clone(decision), reason: decision.reason.trim() };
  }
  const contract = getSectionContract(decision.sectionId);
  const slot = contract?.slots.find((entry) => entry.slotKey === decision.slotKey);
  if (!slot) throw new Error('Unknown report section or content slot');
  if (!EVIDENCE_USE_ROLES.includes(decision.role)) throw new Error('Unsupported evidence-use role');
  if (record.quality.issues.some((entry) => entry.reason === 'hidden_source')) throw new Error('Answer-derived capture cannot be admitted by a section-label decision');
  if (decision.role === 'required_narrative' && ['measurement', 'geometry', 'attachment', 'checklist_response'].includes(record.kind)) throw new Error('Native structured records cannot be relabelled as narrative; use a reviewed summary record');
  // Earlier decisions allowed any supporting/reference kind and used the
  // structured-kind list for both required roles. Preserve those persisted
  // event semantics; explicit v2 operations enforce role-specific contracts.
  if (decision.operation ? !canUseEvidence(slot, record.kind, decision.role) : decision.role.startsWith('required_') && !slot.legacyAcceptedKinds.includes(record.kind)) throw new Error('Evidence kind and role are not eligible for this content slot');
  if (decision.operation && allUses.some((entry) => entry.useId !== decision.useId && entry.evidenceIds.includes(record.evidenceId) && entry.sectionId === decision.sectionId && entry.slotKey === decision.slotKey && entry.role === decision.role)) throw new Error('This evidence already has the same destination and role');
  if (decision.unitCode != null && (record.kind !== 'measurement' || !UNITS.has(decision.unitCode))) throw new Error('Unit resolution must use a supported explicit measurement unit');
  if (decision.entityId != null && (typeof decision.entityId !== 'string' || !/^[a-zA-Z0-9_.:-]{1,240}$/.test(decision.entityId))) throw new Error('Entity resolution requires a stable identity');
  return { ...clone(decision), reason: decision.reason.trim() };
}

export const resolveSectionDecision = validateSectionDecision;

export function getSectionEvidence(snapshot, sectionId) {
  const plan = snapshot?.sectionPlans?.find((entry) => entry.sectionId === sectionId);
  if (!plan) throw new Error(`No section plan for ${sectionId}`);
  const records = new Map(snapshot.evidenceRecords.map((record) => [record.evidenceId, record]));
  const select = (role) => [...new Set(plan.evidenceUses.filter((entry) => !role || entry.role === role).flatMap((entry) => entry.evidenceIds))].map((id) => records.get(id)).filter(Boolean);
  const evidenceRecords = select();
  return { plan, evidenceRecords, requiredNarrative: select('required_narrative'), requiredStructured: select('required_structured'), supporting: select('supporting'), crossReferences: select('cross_reference'), voiceNotes: select('required_narrative').filter((record) => record.kind === 'voice_claim' && !record.quality.issues.length).map((record) => ({ ...record.sourceRecord, transcriptText: record.payload.text, evidenceId: record.evidenceId, sourceSpan: record.payload.sourceSpan })), unresolvedEvidence: plan.unresolvedEvidence };
}
