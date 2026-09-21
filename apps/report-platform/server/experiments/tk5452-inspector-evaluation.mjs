// Evaluation-only presentation profile. Routing uses the shared native planner;
// this module cannot read the original report or evaluator answer ledger.
import { createHash } from 'node:crypto';
import { buildSectionPlanningSnapshot } from '../section-planner.mjs';
import { INSPECTION_REPORT_FORMATTER_CONTRACT } from '../planned-generation.mjs';
import { projectShellTable } from './inspector-shell-table.mjs';
export const INSPECTOR_EVAL_CASE = 'eval-tk5452-inspector-notes-v2';
const clone = value => JSON.parse(JSON.stringify(value));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const human = value => value.replace(/-/g, ' ').toUpperCase();

export function buildInspectorEvaluationSnapshot(input) {
  const raw = input.appExport;
  const projection = clone(raw);
  // The written findings duplicate these same authored voice observations. Keep
  // the raw export for review, but choose one capture channel for this run.
  projection.findings = [];
  const corrections = [];
  for (const row of projection.utMeasurements) if (/^roof-nozzle-r\d+$/.test(row.itemKey)) {
    corrections.push({ itemKey: row.itemKey, field: 'itemKind', before: row.itemKind, after: 'element', reason: 'Explicit nozzle item identity in this mock; reading values and units are unchanged.' });
    row.itemKind = 'element';
  }
  let base = buildSectionPlanningSnapshot({ exportPackage: projection });
  const decisions = base.evidenceRecords.filter(record => record.kind === 'voice_claim' && record.quality.issues.some(issue => issue.reason === 'unconfirmed_action'))
    .map(record => ({ evidenceId: record.evidenceId, sectionId: 'repair-recommendations', slotKey: 'recommendations', role: 'required_narrative', reason: 'Evaluation-only rendering of an explicit inspector-proposed recommendation; no repair authorization or production approval.', actorId: 'evaluation-preparation' }));
  base = buildSectionPlanningSnapshot({ exportPackage: projection, decisions });
  const records = clone(base.evidenceRecords);
  const plans = [];
  const transformationLedger = [
    { operation: 'select_voice_capture_channel', excludedCollection: '/findings', count: raw.findings.length, reason: 'Same authored observations also occur in the mock voice notes; raw written evidence remains reviewable.' },
    ...corrections, ...decisions.map(decision => ({ operation: 'include_proposed_recommendation_for_eval', ...decision })),
  ];
  for (const def of input.profile.sections) {
    const sourcePlan = base.sectionPlans.find(plan => plan.sectionId === def.canonicalSectionId);
    const plan = { schemaVersion: 'section_plan_v2', sectionId: def.sectionId, title: def.title,
      contractVersion: 'inspector_notes_eval_profile_v1', reportProfileId: input.profile.profileId,
      evidenceUses: [], outputObligations: [], blocks: [], missingRequirements: [], unresolvedEvidence: [],
      status: 'needs_review', applicability: { state: 'applicable', basisRef: 'evaluation_report_outline' },
      catalog: { sectionId: def.sectionId, title: def.title, reportPresentation: { contractVersion: INSPECTION_REPORT_FORMATTER_CONTRACT, profileId: input.profile.profileId, number: def.number, title: def.title }, slots: [] },
      planId: `eval_${def.sectionId}_${hash(input).slice(0, 10)}` };
    const addSlot = (key, presentation, title = key) => {
      if (plan.catalog.slots.some(slot => slot.slotKey === key)) return;
      const blockId = `${def.sectionId}:${key}`;
      plan.catalog.slots.push({ slotKey: key, title, purpose: `Present captured ${title.toLowerCase()}.`, presentation });
      plan.blocks.push({ blockId, slotKey: key, type: presentation.renderer });
    };
    function use(record, key, role, presentation, title) {
      addSlot(key, presentation, title);
      const blockId = `${def.sectionId}:${key}`;
      plan.evidenceUses.push({ useId: `eval_use_${def.sectionId}_${record.evidenceId}`, evidenceIds: [record.evidenceId], entityIds: record.entityId ? [record.entityId] : [], sectionId: def.sectionId, blockId, slotKey: key, role, projection: 'source_evidence', decision: { basis: 'shared_native_planner_or_explicit_structured_input', ruleOrReviewId: base.snapshotId } });
      plan.outputObligations.push({ obligationId: `eval_obligation_${def.sectionId}_${record.evidenceId}`, evidenceIds: [record.evidenceId], entityIds: record.entityId ? [record.entityId] : [], sectionId: def.sectionId, role, targetBlockId: blockId, required: true, expected: record.kind === 'measurement' ? { cells: record.payload.cells } : { text: record.displayText, ...(['identity','manual_confirmation'].includes(record.kind) ? { value: record.payload.value, fieldKey: record.payload.fieldKey } : {}) } });
    }
    const presentation = def.presentation;
    if (def.sectionId === '03-general-information' || def.sectionId === '06-test-information') {
      for (const [index, field] of input.structuredData.fields.entries()) {
        if ((def.sectionId === '03-general-information' ? 6 : 14) !== field.sourcePage) continue;
        const nativeValue = field.nativePointer ? raw.inspectionRecord[field.fieldKey] : undefined;
        if (field.nativePointer && nativeValue !== field.value) throw new Error(`Structured input mismatch: ${field.fieldKey}`);
        const record = { evidenceId: `eval_field_${index}`, kind: field.nativePointer ? 'identity' : 'manual_confirmation', sourceClass: field.nativePointer ? 'app_field' : 'report_side_input',
          sourceRef: { pointer: field.nativePointer ?? `/structuredData/fields/${index}`, importHash: hash(input) },
          entityId: `${raw.inspectionId}:tank`, locationRef: {}, captureContext: {},
          payload: clone(field), displayText: `${field.reportLabel}: ${field.value}${field.unitCode ? ` ${field.unitCode}` : ''}`, sourceRecord: clone(field), quality: { status: 'captured', issues: [] } };
        records.push(record); use(record, 'fields', 'required_structured', presentation, def.title);
      }
    } else if (input.standardTemplates[def.sectionId]) {
      const template = input.standardTemplates[def.sectionId];
      const record = { evidenceId: `eval_standard_${def.sectionId}`, kind: 'approved_template', sourceClass: 'standard_template_fixture', sourceRef: { pointer: `/standardTemplates/${def.sectionId}`, importHash: hash(input) }, entityId: null, payload: { text: template.text }, displayText: template.text, sourceRecord: template, quality: { status: 'captured', issues: [] } };
      records.push(record); use(record, 'standard', 'required_structured', presentation, def.title);
    } else if (def.sectionId === '12-shell-thickness' && sourcePlan?.outputObligations.length) {
      const sourceIds = new Set(sourcePlan.evidenceUses.filter(use => use.role === 'required_structured').flatMap(use => use.evidenceIds));
      const shellRecords = records.filter(record => sourceIds.has(record.evidenceId) && record.kind === 'measurement');
      for (const { course, record } of projectShellTable(shellRecords)) {
        records.push(record);
        use(record, `strake-${course}`, 'required_structured', { ...presentation, hideHeading: false }, `STRAKE ${course}`);
      }
      transformationLedger.push({ operation: 'transpose_shell_readings_and_calculate_summaries', inputEvidenceIds: shellRecords.map(record => record.evidenceId), readingCount: 40, calculations: ['minimum', 'arithmetic mean rounded to 0.01 mm', 'maximum'], reason: 'Display native course/direction rows in the source table orientation. Each output cell retains its original source pointer.' });
      plan.missingRequirements.push({ requirementId: `${def.sectionId}:calculation-inputs`, reason: 'All 40 shell readings are supplied. Original nominal thickness, previous-thickness status, minimum allowable thickness, inspection interval and life-expectancy fields have not been supplied as reviewed calculation inputs for this section.', blocksApproval: true });
    } else if (sourcePlan) {
      for (const sourceUse of sourcePlan.evidenceUses.filter(use => use.role.startsWith('required_'))) {
        const record = records.find(record => record.evidenceId === sourceUse.evidenceIds[0]);
        if (!record) continue;
        // A narrative item receives physical component context from the native
        // checklist join, not a report paragraph or a reference answer.
        if (record.contextResolution && record.kind === 'voice_claim') {
          record.payload.itemLabel = null;
        }
        const key = def.sectionId === '04-inspection-report' ? sourceUse.slotKey : 'content';
        const p = { ...presentation, hideHeading: def.sectionId !== '04-inspection-report' };
        use(record, key, sourceUse.role, p, human(sourceUse.slotKey));
      }
      plan.unresolvedEvidence = sourcePlan.unresolvedEvidence;
    }
    if (!plan.outputObligations.length) plan.missingRequirements.push({ requirementId: `${def.sectionId}:missing`, reason: def.sectionId === '13-shell-nozzle-thickness' ? 'Original page has a different asset header; source identity needs review.' : 'No matching app capture or explicit report-side input is prepared for this section.', blocksApproval: true });
    if (def.sectionId === '04-inspection-report') plan.missingRequirements.push({ requirementId: `${def.sectionId}:calculations`, reason: 'Calculation paragraphs from the reference are not captured in this mock. This run assesses the supplied observations only.', blocksApproval: true });
    plan.status = plan.missingRequirements.length || plan.unresolvedEvidence.length ? 'needs_review' : 'ready';
    plans.push(plan);
  }
  return { snapshotId: `inspector_eval_${hash(input).slice(0, 24)}`, contractVersion: 'inspector_notes_eval_profile_v1', evaluationOnly: true, inputPackageHash: hash(input), evidenceRecords: records, sectionPlans: plans, transformationLedger, basePlanningVersion: base.contractVersion, baseRuleRevision: base.ruleRevision };
}

export function inspectorEvidenceForSection(input, snapshot, sectionId) {
  const plan = snapshot.sectionPlans.find(plan => plan.sectionId === sectionId);
  const groups = new Map();
  const used = plan.evidenceUses.flatMap(use => use.evidenceIds).map(id => snapshot.evidenceRecords.find(record => record.evidenceId === id));
  const originalInputs = used.flatMap(record => record.payload.inputEvidenceIds?.map(id => snapshot.evidenceRecords.find(candidate => candidate.evidenceId === id)) ?? [record]);
  for (const record of originalInputs) {
    const id = record.evidenceId;
    const key = record.sourceRef.pointer;
    let raw = record.sourceRecord;
    if (key.startsWith('/voiceNotes/')) raw = input.appExport.voiceNotes[Number(key.split('/')[2])];
    if (key.startsWith('/inspectionChecklistItems/')) raw = input.appExport.inspectionChecklistItems[Number(key.split('/')[2])];
    if (key.startsWith('/utMeasurements/')) raw = input.appExport.utMeasurements[Number(key.split('/')[2])];
    if (!groups.has(key)) groups.set(key, { evidenceId: id, sourceClass: record.sourceClass, sourcePointer: key,
      label: raw?.displayName ?? record.payload.reportLabel ?? record.payload.itemLabel ?? record.payload.itemPrompt ?? plan.title,
      text: record.kind === 'voice_claim' ? raw.transcriptText : record.kind === 'measurement' ? record.payload.cells.map(cell => `${/^value[1-5]$/.test(cell.key) ? `Reading ${cell.key.at(-1)}` : cell.key}: ${cell.value ?? 'Not recorded'} ${cell.unitCode ?? ''}`).join('; ') : record.kind === 'checklist_response' ? `${record.payload.itemNumber}. ${record.payload.itemPrompt} ${record.payload.ratingLabel}` : record.displayText,
      processedText: [], usedInGeneration: !record.quality.issues.length,
      context: record.contextResolution ? `Checklist item ${record.contextResolution.itemNumber} · ${record.contextResolution.sectionKey.replace(/_/g, ' ')}` : '',
      issues: record.quality.issues.map(issue => issue.detail ?? issue.reason) });
    if (record.kind === 'voice_claim') groups.get(key).processedText.push(record.payload.text);
  }
  return [...groups.values()];
}
