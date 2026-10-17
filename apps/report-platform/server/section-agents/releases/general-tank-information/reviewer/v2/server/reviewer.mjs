import { createHash, randomUUID } from 'node:crypto';

export const REVIEWER_ID = 'section_reviewer';
export const REVIEWER_RELEASE = 'reviewer_v2';
export const GENERATOR_RELEASE = 'general_tank_information_v3';
export const SECTION_ID = 'general-tank-information';
export const REPORT_PROFILE = 'vertical_tank_inspection_v1';

const FIELDS = Object.freeze([
  ['client','Client'],['clientRepresentative','Client Representative'],['tankNumber','Tank Number'],
  ['location','Location'],['yearBuilt','Year Built'],['fieldLeaseName','Field/Lease Name'],
  ['manufacturer','Original Manufacturer'],['heightM','Height','m'],['constructionStandard','Original Construction Std'],
  ['serviceHeight','Service Height'],['materialSpecification','Material Spec.'],['diameterM','Diameter','m'],
  ['shellConstruction','Construction (Shell)'],['productStored','Product Stored'],['drawingReference','Drawing Ref'],
  ['specificGravity','Specific Gravity'],['roofType','Roof Type'],['designTemperature','Design Temp.'],
  ['internalPressure','Internal Pres.'],['shellCourseCount','Total Shell Course'],['floorPlateCount','Total Floor Plates'],
  ['roofPlateCount','Total Roof Plates'],['floorPlateThickness','Floor Plate Thickness'],['windGirder','Wind Girder'],
  ['annularPlateCount','Total Annular Plates'],['insulated','Insulated'],['annularPlateThickness','Annular Plate Thickness'],
  ['stiffener','Stiffener'],['externalHistory','External'],['internalHistory','Internal'],['bottomHistory','Bottom'],
].map(([key,label,unit=null]) => Object.freeze({key,label,unit})));
const PRIMARY = Object.freeze({
  client:'client',clientRepresentative:'clientRepresentative',tankNumber:'tankNumber',location:'location',yearBuilt:'yearBuilt',
  fieldLeaseName:'fieldLeaseName',manufacturer:'originalManufacturer',heightM:'heightM',constructionStandard:'originalConstructionStd',
  serviceHeight:'serviceHeight',materialSpecification:'materialSpec',diameterM:'diameterM',shellConstruction:'shellConstruction',
  productStored:'productStored',drawingReference:'drawingRef',specificGravity:'specificGravity',roofType:'roofType',
  designTemperature:'designTemp',internalPressure:'internalPressure',shellCourseCount:'shellCourseCount',floorPlateCount:'floorPlateNumber',
  roofPlateCount:'roofPlateNumber',floorPlateThickness:'floorPlateThickness',windGirder:'windGirder',annularPlateCount:'annularPlateNumber',
  insulated:'insulated',annularPlateThickness:'annularPlateThickness',stiffener:'stiffener',externalHistory:'previousExternal',
  internalHistory:'previousInternal',bottomHistory:'previousBottom',
});
const CORROBORATING = Object.freeze({heightM:['height'],diameterM:['diameter'],shellCourseCount:['courseNumber']});
const AUXILIARY = new Set(['inspector','jobNo','dateCompleted','externalRoofType','internalRoofType','shellLaneCount','referenceMode','referenceNote','insulationDistance']);
const present = value => value !== null && value !== undefined && String(value).trim() !== '';
const unknown = value => /^(?:not provided|not recorded|not available|unknown(?: carbon steel)?|pending confirmation|-)$/i.test(String(value).trim());
const normalize = value => String(value ?? '').replace(/\s+/g,' ').trim();
const sha256 = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const nodeText = node => Object.hasOwn(node ?? {}, 'text') ? node.text : (node?.children ?? []).map(nodeText).join('');
function nodes(document) { const out=[]; const visit=node=>{ if (!node || Object.hasOwn(node,'text')) return; out.push(node); (node.children??[]).forEach(visit); }; (document?.blocks??[]).forEach(visit); return out; }

function indexProjectionRecords(evidence) {
  const byKey = new Map();
  for (const record of evidence.sectionProjection?.evidenceRecords ?? []) {
    const key = record.payload?.fieldKey;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(record);
  }
  return byKey;
}

function expectedField(byKey, field) {
  const primaryRecords = byKey.get(PRIMARY[field.key]) ?? [];
  const primary = primaryRecords.length === 1 ? primaryRecords[0] : null;
  const value = primary?.payload?.value;
  let display = 'Not recorded';
  if (present(value)) display = `${value}${field.unit && !unknown(value) && !/^not applicable$/i.test(String(value)) ? ` ${field.unit}` : ''}`;
  const sources = [primary, ...(CORROBORATING[field.key] ?? []).flatMap(key => byKey.get(key) ?? [])].filter(Boolean);
  return { ...field, value: present(value) ? value : null, display,
    provenance: primary ? 'app_field' : 'not_recorded', primaryRecords,
    sourceEvidenceIds: sources.map(record => record.evidenceId), sourcePointer: primary?.sourceRef?.pointer ?? null };
}

function validateExecution(execution) {
  if (!execution || execution.contractVersion !== 'section_review_execution_v1' || execution.executionMode !== 'evaluation') {
    throw new Error('Unsupported section-review execution contract or mode.');
  }
  const generated = execution.generationResult;
  if (execution.reportPlanRef?.reportProfileId !== REPORT_PROFILE
      || execution.sectionPlanRef?.sectionId !== SECTION_ID
      || generated?.contractVersion !== 'section_agent_result_v1'
      || generated?.section?.sectionId !== SECTION_ID
      || generated?.section?.releaseVersion !== GENERATOR_RELEASE
      || generated?.release?.version !== GENERATOR_RELEASE) {
    throw new Error('Review execution is not bound to the supported generator release.');
  }
  if (execution.gold !== undefined) throw new Error('Pre-display review cannot receive historical gold.');
  if (execution.evidenceSnapshot?.contractVersion !== 'section_agent_evidence_snapshot_v1'
      || execution.evidenceSnapshot?.sectionProjection?.contractVersion !== 'section_evidence_projection_v2'
      || execution.evidenceSnapshot?.sectionProjection?.routingStatus !== 'routing_ready'
      || execution.evidenceSnapshot?.sectionProjection?.readinessScope !== 'evidence_routing_only'
      || execution.evidenceSnapshot?.routerBinding?.releaseId !== 'report-evidence-router_v2') {
    throw new Error('Reviewer requires the frozen routed section evidence snapshot.');
  }
  if (execution.sectionPlan?.historicalPatternPack !== 'general_tank_information_v2_no_runtime_retrieval'
      || execution.sectionPlan?.standardObligationPack !== 'general_tank_information_v1_not_applicable') {
    throw new Error('General-information knowledge-pack bindings do not match the reviewed release.');
  }
}

export function reviewGeneralTankInformation(execution) {
  validateExecution(execution);
  const before = sha256(execution);
  const generated = execution.generationResult;
  const allNodes = nodes(generated.draft?.document);
  const blockers=[]; const warnings=[];
  if (generated.validation?.valid !== true) blockers.push('Generator validation did not pass.');
  if (generated.draft?.approved !== false || generated.draft?.reviewRequired !== true) blockers.push('Generated draft approval state is invalid.');
  if (generated.validation?.checks?.runtimeRetrievalUsed !== false) blockers.push('Runtime historical retrieval is not allowed for this section.');
  if (generated.validation?.checks?.liveModelUsed !== false) blockers.push('Live model output is not allowed in this structured section release.');
  if (generated.validation?.checks?.routedProjectionUsed !== true) blockers.push('Generator did not declare use of the routed section projection.');
  const heading = allNodes.find(node => node.tag === 'h2');
  if (normalize(nodeText(heading)) !== '3 GENERAL TANK INFORMATION') blockers.push('Section title does not match the reviewed contract.');
  if (!allNodes.some(node => node.tag === 'table' && node.attrs?.['data-report-format'] === 'paired-fields')) blockers.push('Paired-field report format is missing.');

  const byKey = indexProjectionRecords(execution.evidenceSnapshot);
  const evidenceNodes = allNodes.filter(node => node.attrs?.['data-evidence-id']);
  const expected = FIELDS.map(field => expectedField(byKey, field));
  const expectedIds = new Set(expected.map(field => `general-info:${field.key}`));
  const observedIds = evidenceNodes.map(node => node.attrs['data-evidence-id']);
  for (const field of expected) {
    const id=`general-info:${field.key}`;
    const matches=evidenceNodes.filter(node => node.attrs['data-evidence-id'] === id);
    if (matches.length !== 1) { blockers.push(`${id} must appear exactly once.`); continue; }
    const actual=normalize(nodeText(matches[0]));
    const wanted=normalize(`➢ ${field.label}: ${field.display}`);
    if (actual !== wanted) blockers.push(`${id} does not preserve its routed evidence value, unit or label.`);
    if (matches[0].attrs?.['data-laiq-provenance'] !== field.provenance) blockers.push(`${id} has the wrong provenance state.`);
    if (matches[0].attrs?.['data-source-evidence-ids'] !== field.sourceEvidenceIds.join(',')) blockers.push(`${id} has the wrong routed source evidence IDs.`);
    if (field.primaryRecords.length > 1) blockers.push(`${id} has duplicate routed primary evidence.`);
    for (const record of field.primaryRecords) {
      if (record.kind !== 'identity' || record.sourceClass !== 'app_field') blockers.push(`${id} is not backed by routed app-field identity evidence.`);
      if (field.unit && (record.payload?.unitCode !== field.unit || !Number.isFinite(Number(record.payload?.value)) || Number(record.payload.value) <= 0)) {
        blockers.push(`${id} has an invalid or missing ${field.unit} unit from the app export.`);
      }
    }
  }
  for (const id of observedIds) if (!expectedIds.has(id)) blockers.push(`Unsupported displayed field ${id}.`);
  if (evidenceNodes.length !== expected.length) blockers.push(`Expected ${expected.length} evidence-labelled fields; received ${evidenceNodes.length}.`);

  const resultFields = new Map((generated.evaluationEvidence?.fields ?? []).map(field => [field.key,field]));
  for (const field of expected) {
    const row=resultFields.get(field.key);
    if (!row) blockers.push(`Generator trace is missing ${field.key}.`);
    else {
      if (normalize(row.displayValue) !== normalize(field.display)) blockers.push(`Generator trace disagrees with routed evidence for ${field.key}.`);
      if (JSON.stringify(row.sourceEvidenceIds) !== JSON.stringify(field.sourceEvidenceIds)) blockers.push(`Generator trace has the wrong sources for ${field.key}.`);
      if (row.sourceClass && row.sourceClass !== 'app_field') blockers.push(`Generator trace relabelled ${field.key} as non-app evidence.`);
    }
  }

  const projectedRecords = execution.evidenceSnapshot.sectionProjection.evidenceRecords;
  const dispositionRows = generated.evaluationEvidence?.evidenceDisposition ?? [];
  const dispositionById = new Map();
  for (const row of dispositionRows) {
    if (!row?.evidenceId || dispositionById.has(row.evidenceId)) blockers.push('Evidence disposition IDs must be present and unique.');
    else dispositionById.set(row.evidenceId, row);
  }
  for (const record of projectedRecords) {
    const row = dispositionById.get(record.evidenceId);
    const key = record.payload?.fieldKey;
    if (!row) { blockers.push(`Routed evidence ${record.evidenceId} was silently omitted.`); continue; }
    const expectedStatus = Object.values(PRIMARY).includes(key) ? 'rendered'
      : Object.values(CORROBORATING).flat().includes(key) ? 'corroborating'
        : AUXILIARY.has(key) ? 'delegated' : null;
    if (!expectedStatus || row.status !== expectedStatus || typeof row.reason !== 'string' || !row.reason.trim()) {
      blockers.push(`Routed evidence ${record.evidenceId} has no valid reviewed disposition.`);
    }
  }
  for (const id of dispositionById.keys()) if (!projectedRecords.some(record => record.evidenceId === id)) blockers.push(`Disposition references unprojected evidence ${id}.`);
  if (dispositionRows.length !== projectedRecords.length) blockers.push('Projected evidence disposition coverage is incomplete.');
  if (generated.evaluationEvidence?.unaccountedEvidenceIds?.length) blockers.push('Generator reports unaccounted routed evidence.');
  if (generated.trace?.routerReleaseId !== execution.evidenceSnapshot.routerBinding.releaseId
      || generated.trace?.sectionProjectionSha256 !== execution.evidenceSnapshot.routerBinding.sectionProjectionSha256) {
    blockers.push('Generator trace does not match the frozen router projection.');
  }
  if (sha256(execution) !== before) throw new Error('Section reviewer mutated its input.');
  const decision=blockers.length ? 'blocked' : 'ready_for_review';
  return {
    contractVersion:'section_review_result_v1',reviewer:{reviewerId:REVIEWER_ID,releaseVersion:REVIEWER_RELEASE},
    section:{sectionId:SECTION_ID,generatorReleaseVersion:GENERATOR_RELEASE},decision,
    userVisibility:decision === 'ready_for_review' ? 'allowed' : 'blocked',approvalStatus:'not_approved',
    checks:{generatorValid:generated.validation?.valid===true,exactTitle:normalize(nodeText(heading))==='3 GENERAL TANK INFORMATION',
      protectedFieldCount:expected.length,observedFieldCount:evidenceNodes.length,projectedEvidenceCount:projectedRecords.length,
      dispositionCount:dispositionRows.length,formatValid:allNodes.some(node=>node.tag==='table'&&node.attrs?.['data-report-format']==='paired-fields'),
      evidenceGrounded:blockers.every(value=>!/(routed evidence|sources|provenance|silently omitted|preserve)/i.test(value)),
      kbBoundaryValid:generated.validation?.checks?.currentFactsFromHistoricalSources===false&&generated.validation?.checks?.runtimeRetrievalUsed===false,
      goldUsed:false,llmReviewRequired:false,liveModelUsed:false},
    blockers,warnings,claimTrace:projectedRecords.map(record=>({evidenceId:record.evidenceId,source:'routed_current_app_evidence',status:blockers.some(value=>value.includes(record.evidenceId))?'failed':'verified'})),
    trace:{reviewRunId:randomUUID(),reviewedAtIso:new Date().toISOString(),generationRunId:generated.trace?.runId??null,
      generationResultSha256:sha256(generated),sectionProjectionSha256:execution.evidenceSnapshot.routerBinding.sectionProjectionSha256,
      goldAccessed:false,providerCode:'deterministic',modelId:null}
  };
}
