import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const adapter = fileURLToPath(new URL("../../../field-android/tools/capture-scenario-round-trip.mjs", import.meta.url));
const transcript = "Inspector observation: corrosion at shell course three.";
const request = {
  scenario: {
    packageType: "laiq_capture_scenario",
    schemaVersion: 1,
    identity: {
      variantId: "baseline-var-voice-contract-audit",
      truthCaseId: "truth-voice-contract-audit",
      captureProfile: "voice_heavy",
      deterministicSeed: 1,
    },
    appContractTarget: { packageType: "v3_product_export", schemaVersion: 3 },
    expectedMissingInputs: [],
    appRecords: {
      structuredTables: [{
        tableId: "table-shell-course-ut",
        targetKey: "shell",
        columns: [{ columnId: "plate", label: "Plate" }, { columnId: "minimum", label: "Minimum thickness (mm)" }],
        rows: [{ entityId: "entity-shell-a12", itemKey: "shell:plate:A12", cells: [{ columnId: "plate", value: "A12" }, { columnId: "minimum", value: "6.8" }] }],
      }],
      utMeasurements: [{ inspectionId: "source-inspection", targetKey: "shell", itemKey: "shell:plate:A12", itemLabel: "Shell plate A12", value1: 6.8, measured: true, confirmed: true }],
    },
    captures: [{
      factId: "fact-voice-1",
      factType: "voice_finding_input",
      sectionKey: "inspection-report",
      value: { text: transcript },
      captureChannel: "voice",
      disposition: "included",
      transformation: {
        noteStyle: "spoken",
        asrNoiseRate: 0.12,
        repetitionRate: 0,
        surfaceVariantKey: "voice-contract-audit",
      },
      voiceContext: {
        screenKey: "findings",
        screenLabel: "Findings",
        cardKey: "inspection-report",
        fieldKey: "voice_note",
        targetKey: "shell",
        targetLabel: "shell",
        itemKey: "fact-voice-1",
        itemLabel: "Finding observation 1",
      },
    }],
  },
  principal: { tenantId: "tenant-audit", primaryWorkspaceId: "workspace-audit", userId: "user-audit" },
};

const result = spawnSync(process.execPath, [adapter], {
  input: JSON.stringify(request),
  encoding: "utf8",
});
if (result.status !== 0) throw new Error(result.stderr || "App voice round-trip adapter failed.");
const exportPackage = JSON.parse(result.stdout);
const note = exportPackage.voiceNotes?.[0];
const expected = {
  voiceNoteId: "voice-fact-voice-1",
  screenKey: "findings",
  screenLabel: "Findings",
  cardKey: "inspection-report",
  fieldKey: "voice_note",
  targetKey: "shell",
  targetLabel: "shell",
  itemKey: "fact-voice-1",
  itemLabel: "Finding observation 1",
  transcriptStatus: "synthetic_accepted",
  fileExists: false,
};
const mismatches = Object.entries(expected)
  .filter(([key, value]) => note?.[key] !== value)
  .map(([key, value]) => ({ key, expected: value, actual: note?.[key] }));
if (!Number.isFinite(note?.durationMs) || note.durationMs <= 0) mismatches.push({ key: "durationMs", expected: "positive number", actual: note?.durationMs });
if (!note?.capturedAtIso || Number.isNaN(Date.parse(note.capturedAtIso))) mismatches.push({ key: "capturedAtIso", expected: "ISO timestamp", actual: note?.capturedAtIso });
if (note?.transcriptText === transcript || !note?.transcriptText?.includes(transcript)) {
  mismatches.push({ key: "transcriptText", expected: "style-varied transcript preserving the source fact", actual: note?.transcriptText });
}
if (mismatches.length) throw new Error(`App voice capture contract audit failed: ${JSON.stringify(mismatches)}`);
if (JSON.stringify(exportPackage.structuredTables) !== JSON.stringify(request.scenario.appRecords.structuredTables)) {
  throw new Error("Android round trip changed the structured table matrix or row identity.");
}
if (JSON.stringify(exportPackage.utMeasurements?.[0]) !== JSON.stringify(request.scenario.appRecords.utMeasurements[0])) {
  throw new Error("Android round trip changed an app-owned UT measurement record.");
}
console.log(JSON.stringify({ passed: true, voiceNote: note }, null, 2));
