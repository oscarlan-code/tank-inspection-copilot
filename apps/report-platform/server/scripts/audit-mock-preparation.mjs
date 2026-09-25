import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  buildBaseline, STANDARDIZED_PAIR_CONTRACT_VERSION, HISTORICAL_RECONSTRUCTION_TRACK,
  assertExistingRevision, preparationRevisionHash,
} from "../standardized-pair-builder.mjs";
import { buildVariation, createBaselineVariationPilot } from "../baseline-variation-pilot.mjs";

// Source-derived fixtures test preparation contracts without DB, object storage,
// app mutation or a model call. They are deliberately not field-quality data.
const truthCase = { training_case_id: "source-case", dataset_split: "training", truth_graph_sha256: "a".repeat(64) };
const observation = {
  fact_id: "shell-observation", section_key: "inspection-report", fact_type: "finding_observation",
  evidence_class: "finding", answerability_class: "voice_observable", required_fact: true,
  safety_criticality: "high", capture_destination: "findings.voiceTranscript", unit_code: null,
  source_document_id: "source-pdf", source_page_number: 7, source_block_ids_json: '["block-7"]',
  normalized_value_json: JSON.stringify({ text: "Shell north side has local coating failure. Measured width is 25 mm.", entityBindings: { entityId: "shell-north", observationId: "finding-1", resolutionStatus: "reviewed" } }),
};
const supportingTable = { ...observation, fact_id: "ut-table", section_key: "shell-plate-thickness-measurements", fact_type: "measurement_record", evidence_class: "measurement", answerability_class: "app_observable", normalized_value_json: '{"text":"Detailed UT table: 8.12 mm"}' };
const hiddenConclusion = { ...observation, fact_id: "hidden-recommendation", fact_type: "engineering_assessment", answerability_class: "engineering_judgment", required_fact: false, normalized_value_json: '{"text":"Hidden source conclusion"}' };
const targetContent = `${JSON.parse(observation.normalized_value_json).text} `.repeat(5) + "UNSEEN_TARGET_MUST_NEVER_BECOME_VOICE";
const result = buildBaseline({ truthCase, goldSectionId: "gold-source", sectionKey: "inspection-report", sectionFacts: [observation, hiddenConclusion], allFacts: [observation, supportingTable, hiddenConclusion], targetContent });
assert.deepEqual(result.deterministicInput.captures.map((fact) => fact.factId), [observation.fact_id]);
assert.equal(result.deterministicInput.captures[0].targetReportSectionId, "inspection-report");
assert.equal(result.deterministicInput.captures[0].sourceLineage.sourceDocumentId, "source-pdf");
assert.deepEqual(result.deterministicInput.captures[0].sourceLineage.sourceBlockIds, ["block-7"]);
assert.equal(result.deterministicInput.captures[0].entityBindings.entityId, "shell-north");
assert.ok(!JSON.stringify(result.deterministicInput).includes("UNSEEN_TARGET_MUST_NEVER_BECOME_VOICE"));
assert.ok(!JSON.stringify(result.deterministicInput).includes("Hidden source conclusion"));
assert.equal(result.validation.evaluationTrack, HISTORICAL_RECONSTRUCTION_TRACK);
for (const key of ["learningEligible", "promotionEligible", "independentQualityEligible"]) assert.equal(result.validation[key], false);
assert.equal(result.validation.expectedObligationReviewStatus, "review_required");
assert.deepEqual(result.validation.expectedOutputObligations, []);
assert.equal(result.validation.proposedOutputObligations.length, 1);
assert.ok(!("proposedOutputObligations" in result.deterministicInput));
assert.deepEqual(result.validation.proposedOutputObligations[0].evidenceIds, [observation.fact_id]);

const baseline = {
  baseline_pair_id: result.baselinePairId, contract_version: STANDARDIZED_PAIR_CONTRACT_VERSION,
  deterministic_input_json: result.deterministicInput, validation_json: result.validation,
  expected_recoverable_fact_ids_json: result.expectedRecoverableFactIds, normalized_facts_json: [],
  hidden_fact_ledger_json: result.hiddenLedger, protected_invariants_json: result.protectedInvariants,
  input_sha256: preparationRevisionHash(result.deterministicInput), target_sha256: "b".repeat(64),
  training_case_id: truthCase.training_case_id, section_key: "inspection-report", dataset_split: "training",
  cohort_id: "cohort", match_group_number: 1,
};
const profiles = Array.from({ length: 8 }, (_, index) => ({ profile_version_id: `profile-${index}`, profile_code: `profile-${index}`, version_number: 1, config_json: {} }));
const variation = buildVariation({ baseline, profile: profiles[0], seed: 1 });
assert.equal(variation.manifest.identity.evaluationTrack, HISTORICAL_RECONSTRUCTION_TRACK);
assert.equal(variation.manifest.baselineContract.learningEligible, false);
assert.equal(variation.manifest.learningTask.inputSourceDerivedFromAnswer, true);
assert.ok(!("goldTargetVisibleToScenario" in variation.validation));
assert.ok(!("proposedOutputObligations" in variation.manifest));
assert.deepEqual(variation.validation.proposedOutputObligations[0].evidenceIds, [observation.fact_id]);
assert.throws(() => buildVariation({ baseline: { ...baseline, contract_version: 11 }, profile: profiles[0], seed: 1 }), /immutable contract/);
assert.notEqual(variation.variationId, buildVariation({ baseline, profile: profiles[0], seed: 2 }).variationId);

assert.equal(preparationRevisionHash({ b: 2, a: 1 }), preparationRevisionHash({ a: 1, b: 2 }));
assert.equal(assertExistingRevision(null, "hash", "fixture"), false);
assert.equal(assertExistingRevision({ revision_hash: "hash" }, "hash", "fixture"), true);
assert.throws(() => assertExistingRevision({ revision_hash: "prior" }, "changed", "fixture"), /Immutable preparation artifact/);

// Exercise the real preparation coordinator: an identical retry must preserve
// materialized state and must not upload or overwrite a second scenario.
let uploaded = 0;
let inserted = 0;
const persisted = new Map();
const db = {
  prepare(sql) {
    assert.ok(!/DO UPDATE|\bUPDATE\s+report_/i.test(sql), "Preparation must not update existing artifact rows.");
    return {
      async all() { return sql.includes("report_capture_profile_versions") ? profiles : [baseline]; },
      async get(...args) { return persisted.get(args.join(":")); },
      async run(...args) {
        assert.match(sql, /INSERT INTO report_baseline_capture_variations/);
        inserted += 1;
        persisted.set([args[1], args[2], args[3]].join(":"), { revision_hash: JSON.parse(args[9]).preparationRevisionHash, status_code: "materialized" });
      },
    };
  },
};
const objectStorage = { async putBuffer({ bytes }) { uploaded += 1; return { sha256: createHash("sha256").update(bytes).digest("hex") }; } };
const pilot = createBaselineVariationPilot({ db, objectStorage });
await pilot.buildPilot({ sampleSize: 1, allProfiles: false });
await pilot.buildPilot({ sampleSize: 1, allProfiles: false });
assert.equal(uploaded, 1);
assert.equal(inserted, 1);
baseline.input_sha256 = "c".repeat(64);
await assert.rejects(() => pilot.buildPilot({ sampleSize: 1, allProfiles: false }), /Immutable preparation artifact/);
assert.equal(uploaded, 1, "Conflicting preparation must fail before object upload.");
console.log("Mock preparation audit passed: scoped source records, explicit reconstruction, evaluator-only proposals and immutable retries.");
