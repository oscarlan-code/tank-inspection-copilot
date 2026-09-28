import { createHash, randomUUID } from 'node:crypto';

export const REVIEWER_ID = 'section_reviewer';
export const REVIEWER_RELEASE = 'reviewer_v1';
export const GENERATOR_RELEASE = 'general_tank_information_v2';
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
const NATIVE = new Set(['client','tankNumber','location','fieldLeaseName','heightM','diameterM','shellCourseCount']);
const present = value => value !== null && value !== undefined && String(value).trim() !== '';
const unknown = value => /^(?:not provided|not recorded|not available|unknown(?: carbon steel)?|pending confirmation|-)$/i.test(String(value).trim());
const normalize = value => String(value ?? '').replace(/\s+/g,' ').trim();
const sha256 = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const nodeText = node => Object.hasOwn(node ?? {}, 'text') ? node.text : (node?.children ?? []).map(nodeText).join('');
function nodes(document) { const out=[]; const visit=node=>{ if (!node || Object.hasOwn(node,'text')) return; out.push(node); (node.children??[]).forEach(visit); }; (document?.blocks??[]).forEach(visit); return out; }

function expectedField(evidence, field) {
  const native = evidence.exportPackage?.inspectionRecord ?? {};
  const extra = evidence.manualSupplement?.generalTankInformation?.[field.key];
  let value = NATIVE.has(field.key) && present(native[field.key]) ? native[field.key] : undefined;
  if (!present(value) && extra && present(extra.value) && extra.confirmed === true && extra.sourceRef) value = extra.value;
  let display = 'Not recorded';
  if (present(value)) display = `${value}${field.unit && !unknown(value) && !/^not applicable$/i.test(String(value)) ? ` ${field.unit}` : ''}`;
  else if (extra && extra.confirmed !== true) display = 'Awaiting confirmation';
  return { ...field, value: present(value) ? value : null, display };
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
  if (execution.sectionPlan?.historicalPatternPack !== 'general_tank_information_v2_no_runtime_retrieval'
      || execution.sectionPlan?.standardObligationPack !== 'general_tank_information_v1_not_applicable') throw new Error('General-information knowledge-pack bindings do not match the reviewed release.');
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
  const heading = allNodes.find(node => node.tag === 'h2');
  if (normalize(nodeText(heading)) !== '3 GENERAL TANK INFORMATION') blockers.push('Section title does not match the reviewed contract.');
  if (!allNodes.some(node => node.tag === 'table' && node.attrs?.['data-report-format'] === 'paired-fields')) {
    blockers.push('Paired-field report format is missing.');
  }
  const evidenceNodes = allNodes.filter(node => node.attrs?.['data-evidence-id']);
  const expected = FIELDS.map(field => expectedField(execution.evidenceSnapshot, field));
  const expectedIds = new Set(expected.map(field => `general-info:${field.key}`));
  const observedIds = evidenceNodes.map(node => node.attrs['data-evidence-id']);
  for (const field of expected) {
    const id=`general-info:${field.key}`;
    const matches=evidenceNodes.filter(node => node.attrs['data-evidence-id'] === id);
    if (matches.length !== 1) { blockers.push(`${id} must appear exactly once.`); continue; }
    const actual=normalize(nodeText(matches[0]));
    const wanted=normalize(`➢ ${field.label}: ${field.display}`);
    if (actual !== wanted) blockers.push(`${id} does not preserve its evidence value, unit or label.`);
  }
  for (const id of observedIds) if (!expectedIds.has(id)) blockers.push(`Unsupported displayed field ${id}.`);
  if (evidenceNodes.length !== expected.length) blockers.push(`Expected ${expected.length} evidence-labelled fields; received ${evidenceNodes.length}.`);
  const resultFields = new Map((generated.evaluationEvidence?.fields ?? []).map(field => [field.key,field]));
  for (const field of expected) {
    const row=resultFields.get(field.key);
    if (!row) blockers.push(`Generator trace is missing ${field.key}.`);
    else if (normalize(row.displayValue) !== normalize(field.display)) blockers.push(`Generator trace disagrees with current evidence for ${field.key}.`);
  }
  if (sha256(execution) !== before) throw new Error('Section reviewer mutated its input.');
  const decision=blockers.length ? 'blocked' : 'ready_for_review';
  return {
    contractVersion:'section_review_result_v1',reviewer:{reviewerId:REVIEWER_ID,releaseVersion:REVIEWER_RELEASE},
    section:{sectionId:SECTION_ID,generatorReleaseVersion:GENERATOR_RELEASE},decision,
    userVisibility:decision === 'ready_for_review' ? 'allowed' : 'blocked',approvalStatus:'not_approved',
    checks:{generatorValid:generated.validation?.valid===true,exactTitle:normalize(nodeText(heading))==='3 GENERAL TANK INFORMATION',
      protectedFieldCount:expected.length,observedFieldCount:evidenceNodes.length,formatValid:allNodes.some(node=>node.tag==='table'&&node.attrs?.['data-report-format']==='paired-fields'),
      evidenceGrounded:blockers.every(value=>!/(preserve|current evidence|Unsupported displayed|appear exactly)/i.test(value)),
      kbBoundaryValid:generated.validation?.checks?.currentFactsFromHistoricalSources===false&&generated.validation?.checks?.runtimeRetrievalUsed===false&&execution.sectionPlan.historicalPatternPack==='general_tank_information_v2_no_runtime_retrieval'&&execution.sectionPlan.standardObligationPack==='general_tank_information_v1_not_applicable',
      goldUsed:false,llmReviewRequired:false,liveModelUsed:false},
    blockers,warnings,claimTrace:expected.map(field=>({evidenceId:`general-info:${field.key}`,source:'current_evidence',status:blockers.some(value=>value.includes(`general-info:${field.key}`)||value.includes(field.key))?'failed':'verified'})),
    trace:{reviewRunId:randomUUID(),reviewedAtIso:new Date().toISOString(),generationRunId:generated.trace?.runId??null,
      generationResultSha256:sha256(generated),goldAccessed:false,providerCode:'deterministic',modelId:null}
  };
}
