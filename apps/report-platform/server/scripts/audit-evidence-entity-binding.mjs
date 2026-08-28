import {
  buildAppEntityEvidence,
  buildEntityBoundEvidence,
  extractStructuredAppTables,
  scoreEntityRelationshipBindings,
  validateEntityBoundEvidence,
} from "../evidence-entity-binding.mjs";
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

console.log("Evidence entity-binding audit passed.");
console.log("- Structured field data and voice notes share stable physical-entity IDs.");
console.log("- Measurements transferred to another plate or emitted without plate identity are rejected.");
console.log("- Imported app measurements, findings/photos, and voice notes bind through targetKey + itemKey.");
console.log("- Source table columns, row order, cells, and row identities remain structured records.");
