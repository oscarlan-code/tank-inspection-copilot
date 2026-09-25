import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSectionPlanningSnapshot } from "../section-planner.mjs";
import { attachCapturePreparationProvenance } from "../capture-round-trip.mjs";
import { prepareGovernedDiagnosticPair, runGovernedDiagnosticEpisode } from "./run-governed-rag-training-pilot.mjs";

const scenario = { identity: { truthCaseId: "historical-source" }, captures: [{ factId: "m1", captureChannel: "measurement", sectionKey: "shell-plate-thickness-measurements", value: { text: "UT 6.12 mm" }, unitCode: "mm", sourceLineage: { sourceClass: "issued_historical_report", sourceDocumentId: "source-pdf" }, entityBindings: { entityId: "shell-1" }, safetyCriticality: "high" }], withheldFacts: [{ factId: "hidden" }] };
const adapterOutput = { packageType: "v3_product_export", schemaVersion: 3, captureFacts: [{ factId: "m1", value: { text: "UT 6.12 mm" }, unitCode: "mm" }], utMeasurements: [{ measurementId: "m1", sourceFactId: "m1", readingValue: null, readingText: "UT 6.12 mm" }] };
const before = structuredClone(adapterOutput);
const artifact = attachCapturePreparationProvenance({ scenario, exportPackage: adapterOutput, adapterOutputSha256: "a".repeat(64) });
assert.deepEqual(adapterOutput, before);
assert.deepEqual(artifact.utMeasurements, before.utMeasurements);
assert.deepEqual(artifact.captureFacts, before.captureFacts, "Backend provenance must not masquerade as native adapter fields.");
assert.equal(artifact.captureScenarioProvenance.evaluationTrack, "historical_reconstruction_fixture");
assert.equal(artifact.captureScenarioProvenance.learningEligible, false);
const backend = artifact.captureScenarioProvenance.backendPreparation;
assert.equal(backend.facts[0].sourceLineage.sourceDocumentId, "source-pdf");
assert.equal(backend.facts[0].entityBindings.entityId, "shell-1");
assert.equal(backend.nativeAppParityVerified, false);
assert.equal(backend.nativeRecordsModified, false);
assert.equal(backend.nativeRepresentationIssues[0].reason, "native_measurement_cells_missing");
assert.throws(() => attachCapturePreparationProvenance({ scenario, exportPackage: { ...adapterOutput, captureFacts: [{ factId: "m1", value: { text: "UT 6.12 mm" }, unitCode: "in" }] } }), /changed value or unit/);
assert.throws(() => attachCapturePreparationProvenance({ scenario, exportPackage: { ...adapterOutput, captureFacts: [...adapterOutput.captureFacts, { factId: "hidden", value: "secret" }] } }), /outside the supplied capture/);

const native = {
  packageType: "v3_product_export", schemaVersion: 3, inspectionId: "native-test", inspectionReference: "NATIVE-TEST",
  tenantId: "test-tenant", workspaceId: "test-workspace", profile: { tenantId: "test-tenant", workspaceId: "test-workspace" },
  task: { client: "Test", tankNumber: "T1", location: "Site" }, inspectionRecord: { client: "Test", tankNumber: "T1", location: "Site" },
  validationResults: [{ ruleCode: "contract", passed: true }], taskSnapshots: [{ taskKey: "findings", inScope: true }],
  voiceNotes: [], utMeasurements: [], inspectionChecklistItems: [], inspectionChecklistSectionNotes: [],
  attachments: [], elements: [], layoutConfigs: [], layoutFigures: [], layoutTargets: [],
  findings: [{ findingId: "floor-a", targetKey: "floor", itemKey: "floor:a", itemLabel: "Floor A", note: "Floor coating is damaged." }],
};
const snapshot = buildSectionPlanningSnapshot({ exportPackage: native });
const nativeExportProvenance = { objectKey: "test-source/native.json", sha256: "b".repeat(64), inputPackageHash: snapshot.inputPackageHash };
const pair = { governed_pair_id: "native-pair", section_key: "inspection-report", target_content: "HIDDEN_REFERENCE_NEVER_IN_GENERATION", mock_input_json: { nativeExportPackage: native, nativeExportProvenance }, validation_json: {} };
assert.throws(() => prepareGovernedDiagnosticPair({ ...pair, mock_input_json: { appRecords: { tables: [] } } }), /nativeExportPackage is required/);
assert.throws(() => prepareGovernedDiagnosticPair({ ...pair, mock_input_json: { nativeExportPackage: native } }), /immutable source object/);
assert.throws(() => prepareGovernedDiagnosticPair({ ...pair, mock_input_json: { ...pair.mock_input_json, nativeExportProvenance: { ...nativeExportProvenance, inputPackageHash: "c".repeat(64) } } }), /frozen imported hash/);
assert.throws(() => prepareGovernedDiagnosticPair({ ...pair, mock_input_json: { ...pair.mock_input_json, nativeExportPackage: { ...native, utMeasurements: [{ targetKey: "shell", itemKey: "shell:a", readingValue: 6.12, readingText: "6.12" }] } } }), /typed measurement cells/);
const prepared = prepareGovernedDiagnosticPair(pair);
assert.equal(prepared.expectationBasis, "production_requirements_only");
assert.ok(!JSON.stringify(prepared.reportState).includes(pair.target_content));
assert.ok(!Object.hasOwn(prepared.reportState, "expectedObligations"));
assert.equal(prepared.reportState.sectionPlanning.sectionPlans.length, 32);

// Real shared entry point, zero voice: this test cannot invoke a model.
const result = await runGovernedDiagnosticEpisode({ pair, prepared, policyDecision: { policyVersionId: "frozen-test", armKey: "grounded" } });
assert.equal(result.generatorContractVersion, "section_planned_generation_v2");
assert.equal(result.generationRun.usedLiveModel, false);
assert.match(result.generatedContent, /Floor coating is damaged/);
assert.equal(result.reward, null);
assert.equal(result.learningUpdated, false);
assert.equal(result.benchmark.independentQualityEligible, false);

const expectation = { ...prepared.sectionPlan.outputObligations[0], expected: { text: "EVALUATOR_EXPECTATION_SENTINEL" } };
const reviewedPair = { ...pair, validation_json: { expectedObligationReviewStatus: "approved", expectedOutputObligations: [expectation] } };
const reviewed = prepareGovernedDiagnosticPair(reviewedPair);
assert.equal(reviewed.expectationBasis, "reviewed_frozen_benchmark");
assert.ok(!JSON.stringify(reviewed.reportState).includes("EVALUATOR_EXPECTATION_SENTINEL"));
let called = false;
await runGovernedDiagnosticEpisode({ pair: reviewedPair, prepared: reviewed, generate: async (args) => {
  called = true;
  assert.equal(args.executionMode, 'evaluation');
  assert.ok(!JSON.stringify(args).includes("EVALUATOR_EXPECTATION_SENTINEL"));
  assert.ok(!JSON.stringify(args).includes(pair.target_content));
  return { draft: { content: result.generatedContent }, orchestration: { generatorContractVersion: "section_planned_generation_v2" }, generationRun: { blockers: ["Existing capture blocker"] } };
} }).then((output) => assert.deepEqual(output.existingGenerationBlockers, ["Existing capture blocker"]));
assert.equal(called, true);
const source = readFileSync(new URL("./run-governed-rag-training-pilot.mjs", import.meta.url), "utf8");
assert.match(source, /REPEATABLE READ READ ONLY/);
assert.doesNotMatch(source, /createPostgresDatabase|runGovernedNarrativeGeneration|compileDeterministicAppRecords|finalizeGovernedGeneratedContent/);
assert.doesNotMatch(source, /(?:INSERT INTO|UPDATE report_|UPDATE system_rl_|DELETE FROM)/i);
console.log("Governed native diagnostic audit passed: preserved backend provenance, authentic native preflight, shared generation, evaluator isolation and read-only persistence.");
