import {
  buildAppEntityEvidence,
  buildEntityBoundEvidence,
  compileDeterministicAppRecords,
  extractStructuredAppFieldsAndLists,
  removeUnsupportedPendingQualifiers,
  extractStructuredAppTables,
  scoreEntityRelationshipBindings,
  validateEntityBoundEvidence,
} from "../evidence-entity-binding.mjs";
import { clusterAppVoiceEvidence } from "../voice-evidence-clustering.mjs";
import fixture from "../../src/fixtures/v2-product-export-shell-internal.json" with { type: "json" };

const report = {
  asset_lineage_key: "tank-v10-inspection-2026",
  report_reference: "22PE3-1",
};
const input = buildEntityBoundEvidence({
  report,
  sectionKey: "floor-plate-thickness-measurements",
  transcripts: [
    "Floor plate A12 measured 6.8 mm near the north weld.",
    "Floor plate A12 has local pitting adjacent to the north weld.",
    "Floor plate A13 measured 7.2 mm near the south weld.",
  ],
});

const contract = validateEntityBoundEvidence(input);
if (!contract.valid) throw new Error(`Expected a valid entity contract: ${contract.issues.join(", ")}`);
if (input.entities.length !== 2) throw new Error(`Expected two physical entities, received ${input.entities.length}.`);
if (input.voiceNotes[0].entityId !== input.voiceNotes[1].entityId) throw new Error("Voice notes for plate A12 did not inherit the same entity ID.");
if (input.voiceNotes[0].entityId === input.voiceNotes[2].entityId) throw new Error("Different plates received the same entity ID.");

const pluralComponent = buildEntityBoundEvidence({
  report,
  sectionKey: "repair-recommendations",
  transcripts: ["Pressure test reinforcing pads for all manways and nozzles."],
});
if (pluralComponent.entities[0].entityType !== "section_observation") {
  throw new Error(`A plural component class was incorrectly converted into a physical entity: ${JSON.stringify(pluralComponent.entities[0])}`);
}
const proseAfterNozzle = buildEntityBoundEvidence({
  report,
  sectionKey: "inspection-report",
  transcripts: ["The sump and draining nozzle were inspected and found serviceable."],
});
if (proseAfterNozzle.entities[0].entityType !== "section_observation") {
  throw new Error(`A word following nozzle was incorrectly converted into an ID: ${JSON.stringify(proseAfterNozzle.entities[0])}`);
}

const valid = scoreEntityRelationshipBindings(input, "Floor Plate A12 measured 6.8 mm. Floor Plate A13 measured 7.2 mm.");
if (valid.violationCount !== 0) throw new Error(`Valid entity bindings were rejected: ${JSON.stringify(valid.violations)}`);

const transferred = scoreEntityRelationshipBindings(input, "Floor Plate A13 measured 6.8 mm.");
if (!transferred.violations.some((item) => item.reason === "measurement_linked_to_wrong_entity")) {
  throw new Error(`A transferred plate measurement was not rejected: ${JSON.stringify(transferred)}`);
}

const omitted = scoreEntityRelationshipBindings(input, "The measured thickness was 6.8 mm.");
if (!omitted.violations.some((item) => item.reason === "entity_identity_omitted_for_measurement")) {
  throw new Error(`An unbound plate measurement was not rejected: ${JSON.stringify(omitted)}`);
}

const appEvidence = buildAppEntityEvidence(fixture);
const voiceClusters = clusterAppVoiceEvidence(fixture.voiceNotes);
const roofUtCluster = voiceClusters.find((cluster) => cluster.voiceNoteId === "voice-v10-roof-r1-ut");
if (roofUtCluster?.primarySectionId !== "roof-nozzle-reinforcement-pad-thickness-measurements") {
  throw new Error(`Android screen/target/item metadata did not route the roof-nozzle voice note: ${JSON.stringify(roofUtCluster)}`);
}
if (voiceClusters.some((cluster) => "sectionId" in cluster.note || "sectionKey" in cluster.note)) {
  throw new Error("Voice routing must not require report-section metadata from the Android app.");
}
const roofNozzle = appEvidence.entities.find((entity) => entity.itemKey === "external_roof:element:external_roof_nozzle_r1");
if (!roofNozzle) throw new Error("The app evidence graph did not create the expected roof-nozzle entity.");
if (!roofNozzle.measurements.length || !roofNozzle.voiceNotes.some((note) => note.voiceNoteId === "voice-v10-roof-r1-ut")) {
  throw new Error("Structured UT data and the voice note did not bind to the same app entity.");
}
const roofPlate = appEvidence.entities.find((entity) => entity.itemKey === "external_roof:region:53");
if (!roofPlate?.findings.length || !roofPlate.voiceNotes.some((note) => note.voiceNoteId === "voice-v10-roof-plate-53")) {
  throw new Error("Finding/photo metadata and voice did not bind to the same plate entity.");
}

const sourceTable = "| Plate | Minimum thickness (mm) | Status |\n|---|---:|---|\n| A12 | 6.8 | Acceptable |\n| A13 | 7.2 | Acceptable |";
const extractedTables = extractStructuredAppTables({ report, sectionKey: "shell-plate-thickness-measurements", content: sourceTable });
if (extractedTables.length !== 1 || JSON.stringify(extractedTables[0].exactMatrix) !== JSON.stringify([
  ["Plate", "Minimum thickness (mm)", "Status"],
  ["A12", "6.8", "Acceptable"],
  ["A13", "7.2", "Acceptable"],
])) throw new Error(`Structured table extraction changed the source matrix: ${JSON.stringify(extractedTables)}`);

const structured = extractStructuredAppFieldsAndLists({ report, sectionKey: "inspection-report", content: "Date Completed:\n22nd July 2022\n(a) Inspect the shell.\n(b) Record findings.\nNarrative observation." });
if (structured.labelledFields[0]?.value !== "22nd July 2022" || structured.structuredLists[0]?.items.length !== 2 || structured.remainingContent.includes("22nd July")) {
  throw new Error(`Structured fields/lists were not separated from narrative: ${JSON.stringify(structured)}`);
}
const compiled = compileDeterministicAppRecords({ structuredTables: extractedTables, labelledFields: structured.labelledFields, structuredLists: structured.structuredLists });
for (const expected of ["| Date Completed | 22nd July 2022 |", "(a) Inspect the shell.", "| A12 | 6.8 | Acceptable |"]) {
  if (!compiled.includes(expected)) throw new Error(`Deterministic compiler omitted or changed ${expected}: ${compiled}`);
}
const guardedFinding = removeUnsupportedPendingQualifiers("Four perforations were detected: Pending confirmation.", { voiceNotes: [{ transcript: "Four perforations were detected:" }] });
if (/pending confirmation/i.test(guardedFinding)) throw new Error(`Confirmed finding retained an unsupported pending qualifier: ${guardedFinding}`);
const guardedFragment = removeUnsupportedPendingQualifiers("Debris may seal perforations, which: Pending confirmation.", { voiceNotes: [{ transcript: "Debris may seal perforations, which" }] });
if (/pending confirmation/i.test(guardedFragment)) throw new Error(`Model-authored pending status survived without explicit app evidence: ${guardedFragment}`);
const explicitPending = removeUnsupportedPendingQualifiers("Status: Pending confirmation.", { voiceNotes: [{ transcript: "Status: Pending confirmation" }] });
if (!/pending confirmation/i.test(explicitPending)) throw new Error(`Explicit app pending status was removed: ${explicitPending}`);

console.log("Evidence entity-binding audit passed.");
console.log("- Structured field data and voice notes share stable physical-entity IDs.");
console.log("- Measurements transferred to another plate or emitted without plate identity are rejected.");
console.log("- Imported app measurements, findings/photos, and voice notes bind through targetKey + itemKey.");
console.log("- Source table columns, row order, cells, and row identities remain structured records.");
console.log("- Labelled fields, ordered lists, and tables compile exactly without model authorship.");
console.log("- Pending status survives only when it is explicit in app evidence.");
console.log("- Android voice metadata is clustered into report sections on the backend without requiring app section IDs.");
