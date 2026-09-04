export const VOICE_EVIDENCE_CLUSTER_VERSION = "app_context_cluster_v1";

const SCREEN_ROUTES = Object.freeze({
  task_home: ["scope-of-inspection"], general_info: ["general-tank-information"],
  checklist: ["tank-inspection-checklist", "inspection-report"], findings: ["inspection-report"],
  layout_scope: ["scope-of-inspection"], layout_map_setup: [], element_setup: ["inspection-report"],
  element_placement: ["inspection-report"], ut_setup: ["test-information"], ut_measurement: [],
});

export function clusterAppVoiceEvidence(voiceNotes = []) {
  return voiceNotes.map((note) => {
    const text = normalized([note.screenKey,note.screenLabel,note.cardKey,note.fieldKey,note.targetKey,note.targetLabel,note.itemKey,note.itemLabel,note.transcriptText].filter(Boolean).join(" "));
    const candidates = new Map();
    const add = (sectionId, score, reason) => { const current=candidates.get(sectionId); if(!current||score>current.score)candidates.set(sectionId,{sectionId,score,reasons:[reason]});else if(score===current.score)current.reasons.push(reason); };
    for (const sectionId of SCREEN_ROUTES[note.screenKey] ?? []) add(sectionId,0.72,`screen:${note.screenKey}`);
    addTargetRoutes(note,add);
    if (/\b(repair|replace|renew|recommend|rectif|remed)/.test(text)) add("repair-recommendations",0.92,"transcript:repair_intent");
    if (/\b(scope|inspection extent|access limitation|limited access)/.test(text)) add("scope-of-inspection",0.88,"transcript:scope");
    if (/\b(mfl|magnetic flux|tru[ -]?flux)/.test(text)) add("guidelines-interpretation-tru-flux-data-sheets",0.82,"transcript:mfl_method");
    const ranked=[...candidates.values()].sort((a,b)=>b.score-a.score||a.sectionId.localeCompare(b.sectionId));
    return {voiceNoteId:note.voiceNoteId,sourceContext:{screenKey:note.screenKey,cardKey:note.cardKey,fieldKey:note.fieldKey,targetKey:note.targetKey,itemKey:note.itemKey,itemLabel:note.itemLabel},primarySectionId:ranked[0]?.sectionId??null,confidence:ranked[0]?.score??0,candidateSections:ranked,routingStatus:ranked[0]?.score>=0.7?"routed":"unresolved",clusterVersion:VOICE_EVIDENCE_CLUSTER_VERSION,note};
  });
}

export function voiceEvidenceForSection(voiceNotes, sectionId) { return clusterAppVoiceEvidence(voiceNotes).filter((cluster)=>cluster.primarySectionId===sectionId); }

function addTargetRoutes(note,add){const target=String(note.targetKey??"");const item=normalized(note.itemKey??"");const screen=String(note.screenKey??"");
  if(screen.includes("layout")){if(target==="floor")add("floor-plate-layout-platemaps-numbering-system",0.96,"screen_target:floor_layout");if(target==="shell")add("shell-plate-layout",0.96,"screen_target:shell_layout");if(["external_roof","internal_roof"].includes(target))add("roof-plate-layout",0.96,"screen_target:roof_layout");}
  if(screen.startsWith("ut_")){if(target==="floor")add("inspection-report",0.86,"screen_target:floor_measurement");if(target==="shell")add(item.includes("nozzle")?"shell-nozzle-reinforcement-pad-thickness-measurements":"shell-plate-thickness-measurements",0.96,"screen_target:shell_measurement");if(["external_roof","internal_roof"].includes(target))add(item.includes("nozzle")?"roof-nozzle-reinforcement-pad-thickness-measurements":"roof-plate-thickness-measurements",0.96,"screen_target:roof_measurement");}
  if(note.screenKey==="findings"&&target)add("inspection-report",0.90,`finding_target:${target}`);
}
function normalized(value){return String(value??"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
