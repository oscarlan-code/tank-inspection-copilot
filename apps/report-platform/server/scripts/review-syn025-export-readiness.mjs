#!/usr/bin/env node
// Offline evaluation companion. Requirements never enter the native payload or generator.
import assert from 'node:assert/strict';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { GENERIC_OUTLINE_MODULES, GENERIC_OUTLINE_VERSION, GENERIC_OUTLINE_REVISION } from '../experiments/generic-outline-catalog.mjs';

const base=resolve(process.argv[2]??'apps/report-platform/docs/reviews/data/syn025-current-only-v3');
const read=async name=>JSON.parse(await readFile(join(base,name),'utf8'));
const checklist=await read('checklist-preparation.json');
const scripts=await read('source-scripts.json');
const media=await read('media-manifest.json');
const byVoice=new Map(scripts.map(s=>[s.voiceScriptId,s]));
assert.equal(checklist.sourceRevision,3);assert(checklist.evaluationOnly);
assert.equal(checklist.items.length,195);
assert.deepEqual(checklist.items.map(r=>r.itemNumber).sort((a,b)=>a-b),Array.from({length:195},(_,i)=>i+1));
for(const row of checklist.items)assert(row.ratingKey&&row.itemNote&&row.observationId&&row.origin,'Every answer requires its authored observation');
assert.equal(scripts.length,11);
for(const s of scripts)assert(s.text&&s.transcriptionMethod==='authored_script_not_asr');
const mediaChecks=[];
for(const object of media.objects) {
  const bytes=await readFile(join(base,'media',object.file));
  assert.equal(bytes.length,object.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),object.sha256);
  mediaChecks.push({file:object.file,bytes:bytes.length,sha256:object.sha256,verified:true});
}
assert.equal(mediaChecks.length,13);
const evidence={
  'identity.asset':['app:generalTankInfo.client,tankNumber,location','voice:V09'],
  'identity.configuration':['app:generalTankInfo.diameter,height,courseNumber,externalRoofType,internalRoofType','voice:V09'],
  'identity.inspection':['app:generalTankInfo.inspector,dateCompleted','voice:V09'],
  'scope.tasks':['voice:V01','app:layoutScope','checklist:scenario'],
  'scope.limits':['voice:V01','voice:V04','voice:V06','voice:V10'],
  'findings.extent':['voice:V01','voice:V04','voice:V06','checklist:itemNotes'],
  'findings.condition':['app:findingState','checklist:items[1..195]','voice:V03','voice:V05','voice:V06'],
  'findings.limits':['voice:V04','voice:V06','voice:V10','checklist:itemNotes'],
  'recommendations.actions':['voice:V03','voice:V05'],
  'recommendations.basis':['app:findingState','voice:V03','voice:V05'],
  'recommendations.priority':['voice:V03','voice:V05'],
  'recommendations.ownership':['voice:V08'],
  'methods.method':['voice:V01','voice:V02','voice:V10'],
  'methods.equipment':['voice:V02','voice:V09','voice:V10'],
  'methods.coverage':['voice:V01','voice:V02','voice:V04','voice:V06','voice:V10'],
  'methods.limits':['voice:V02','voice:V04','voice:V06','voice:V10'],
  'checklist.legend':['app:ProductInspectionChecklistCatalog and ProductChecklistRating'],
  'checklist.responses':['checklist:items[1..195]'],
  'checklist.notes':['checklist:items[1..195].itemNote','checklist:sectionComments'],
  'thickness.basis':['voice:V02','voice:V10'],
  'thickness.readings':['app:utMeasurements[U01,U02]'],
  'thickness.location':['app:utMeasurements.itemKey','app:layoutMapSetup','voice:V07','voice:V10'],
  'thickness.limits':['voice:V03','voice:V07','voice:V10'],
  'layout.figure':['app:layoutMapSetup[external_roof,shell,floor]','app:elementPlacement'],
  'layout.legend':['app:layoutMapSetup.referenceMode,referenceNote','voice:V11'],
  'layout.correspondence':['app:native item keys','companion:alias-manifest.json'],
  'photos.images':['media:P01.png','media:P02.png','app:findingState.photos'],
  'photos.captions':['app:findingState.note','platform:source-photos.json'],
  'references.references':['platform:source-photos.json'],
  'summary.scope':['voice:V01'],
  'summary.results':['voice:V08','app:findingState','checklist:itemNotes'],
  'summary.actions':['voice:V03','voice:V05','voice:V08'],
};
const selected=new Set(['identity','scope','regime','findings','recommendations','methods','checklist','thickness','layout','photos','references','summary']);
const excludedReasons={
  calculations:'No engineering calculation commissioned; no verified calculation input/result set.',
  ndt:'Spot UT is reported under thickness; no separate method-specific NDT examination commissioned.',
  survey:'No settlement or dimensional survey commissioned.',
  graphs:'No survey series or survey graph commissioned.',
  'method-guidance':'No specialist method-guidance section selected for this visual/spot-UT case.',
  'corrosion-plan':'No corrosion overlay or scanned area result supplied; findings remain located on ordinary app layouts.',
  platemaps:'No MFL examination or plate-map results commissioned.',
  assessment:'No engineering assessment or fitness-for-service conclusion commissioned.',
  'scan-profiles':'No B-scan or other trace examination commissioned.',
  dimensional:'No 3D or dimensional survey commissioned.',
  'repair-verification':'Current inspection before proposed repairs; no completed-work verification.',
  consultation:'No separate repair consultation commissioned.',
  calibration:'No tank capacity calibration commissioned.',
};
const rows=GENERIC_OUTLINE_MODULES.map(module=>({moduleId:module.id,title:module.title,selected:selected.has(module.id),reason:selected.has(module.id)?'Selected for this revision3 inspection scope.':excludedReasons[module.id]??'Not commissioned in the declared scope.',blocks:module.outline.map(block=>{
  const key=`${module.id}.${block.id}`;
  if(!selected.has(module.id))return {block:key,required:false,status:'not_applicable',reason:excludedReasons[module.id]??'Not commissioned.'};
  if(module.id==='regime')return {block:key,required:true,sourceOwner:'platform_controlled_template',status:'pending_platform_input',sources:[],gap:'Applicable approved regime template/version has not been selected.',nextAction:'Select an approved standard template. No AI drafting or rewriting.'};
  const sources=evidence[key];
  if(!sources)return {block:key,required:false,status:'optional_not_provided',reason:key==='identity.history'?'No same-asset historical KB supplied; history is optional.':'Optional block not supplied/selected; no invented content.'};
  for(const source of sources.filter(s=>s.startsWith('voice:')))assert(byVoice.has(source.slice(6)),`Missing ${source}`);
  return {block:key,required:!['when_provided','when_needed'].includes(block.requirement),sourceOwner:sources.every(s=>s.startsWith('platform:'))?'platform_input':'app_capture',status:'prepared',sources,reviewNote:key==='recommendations.ownership'?'Proposed work and unverified completion status supplied; no owner invented.':key==='references.references'?'Source report is cited for photograph provenance only, not historical evidence for SYN-025.':key==='layout.correspondence'?'Human aliases are evaluation-only; native keys establish location links.':key==='thickness.basis'?'Unit and point semantics are captured in voice; native structured UT unit field is absent.':null};
})}));
assert.equal(rows.length,25);assert.equal(rows.flatMap(r=>r.blocks).length,89);
let native=null,validation=null;
try {await stat(join(base,'native/export.json'));native=await read('native/export.json');validation=await read('native/validation.json');}catch(error){if(error.code!=='ENOENT')throw error;}
const exportChecks=[];
const check=(name,passed,detail)=>{exportChecks.push({name,passed,detail});assert(passed,`${name}: ${detail}`);};
if(native) {
  check('normal_native_export',native.packageType==='v3_product_export'&&native.schemaVersion===3&&validation.nativeExportByteIdentical,'Untouched JSON written by the real native exporter.');
  check('checklist_responses',native.inspectionChecklistItems.length===195,'195 unique answers retained.');
  for(const row of checklist.items){const saved=native.inspectionChecklistItems.find(r=>r.itemNumber===row.itemNumber);assert.equal(saved.ratingKey,row.ratingKey);assert.equal(saved.itemNote,row.itemNote);}
  check('identity_dimensions',native.inspectionRecord.diameterM===10&&native.inspectionRecord.heightM===12,'Native number-only fields correctly produce metre-valued export fields.');
  check('media_links',native.attachments.length===13&&native.voiceNotes.length===11&&native.findings.length===2,'11 audio files and2 real photos retain native links.');
  check('ut_rows',native.utMeasurements.length===2,'Floor five readings plus nozzle four and pad retained; unmeasured extra cell stays null.');
  const targets=native.layoutTargets.filter(r=>r.inLayoutScope).map(r=>r.targetKey).sort();
  check('active_layouts',JSON.stringify(targets)===JSON.stringify(['external_roof','floor','shell']),'All three in-scope geometry targets retained.');
  check('voice_status',native.voiceNotes.every(v=>v.transcriptStatus==='pending_server'&&!v.transcriptText),'Native audio awaiting downstream transcription; authored scripts are separate diagnostics.');
}
const gaps=[
 {id:'ut-unit',owner:'preprocessing_contract',affectedBlocks:['thickness.basis','thickness.readings'],captureAvailable:true,detail:'Millimetres and point order are in V02/V10 audio; native UT rows have no explicit unitCode. Reviewed transcription/normalization is required before a unit-bearing report table.'},
 {id:'inspection-date',owner:'export_contract',affectedBlocks:['identity.inspection'],captureAvailable:true,detail:'dateCompleted exists in app draft but no dedicated inspection-date field in native inspectionRecord. V09 preserves the date in audio; structured export omission remains visible.'},
 {id:'geometry-types',owner:'app_geometry_contract',affectedBlocks:['layout.figure'],captureAvailable:true,detail:'The five supported elements are mapped. Rafters, central column, davit, ladder and dip plate have descriptive checklist/voice capture but no corresponding native geometry type in this case.'},
 {id:'geometry-rendering',owner:'report_rendering',affectedBlocks:['layout.figure'],captureAvailable:true,detail:'Native geometry is available for roof/shell/floor; the native exporter supplies a finished floor SVG only. Roof/shell figure rendering is downstream work.'},
 {id:'regime-template',owner:'platform_controlled_template',affectedBlocks:['regime.basis','regime.activities','regime.limits'],captureAvailable:false,detail:'Approved standard regime template selection is pending. No AI replacement is allowed.'},
 {id:'method-records',owner:'platform_input',affectedBlocks:['methods.method','methods.equipment'],captureAvailable:false,detail:'No procedure identifier or calibration certificate supplied. Capture is explicit about this; obtain required controlled records before claiming procedure/calibration compliance.'},
];
const review={evaluationOnly:true,caseId:'synthetic-inspection-025',sourceRevision:3,catalogVersion:GENERIC_OUTLINE_VERSION,catalogRevision:GENERIC_OUTLINE_REVISION,moduleCount:25,blockCount:89,selectedModuleCount:selected.size,checklistAnswered:195,checklistUnanswered:0,preparationReviewComplete:true,preparedInputCoverage:'required app information represented in structured capture and/or explicit voice, with geometry/export limitations itemized',nativeExportCreated:Boolean(native),nativeImportVerified:false,reportInputsComplete:false,generationReady:false,asrPerformed:false,expectedLabelsUsedAsGeneratorInput:false,modelPromotionPerformed:false,rows,gaps,mediaChecks,exportChecks};
try {const imported=await read('import/summary.json');review.nativeImportVerified=imported.importSuccessful===true&&imported.sourcePackagePreserved===true;}catch(error){if(error.code!=='ENOENT')throw error;}
await writeFile(join(base,'outline-readiness-review.json'),JSON.stringify(review,null,2)+'\n');
console.log(JSON.stringify({moduleCount:25,blockCount:89,selectedModules:selected.size,checklistAnswered:195,nativeExportCreated:review.nativeExportCreated,nativeImportVerified:review.nativeImportVerified,reportInputsComplete:false,gaps:gaps.map(g=>g.id)},null,2));
