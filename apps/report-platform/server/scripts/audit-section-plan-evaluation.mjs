import assert from "node:assert/strict";
import { evaluateSectionPlanOutput, SECTION_PLAN_EVALUATION_CONTRACT } from "../section-plan-evaluation.mjs";
import { applyCaptureAwareOutcome } from "../capture-evaluation.mjs";
import { createSystemRlController, calculateSystemRlReward, SYSTEM_RL_MODES } from "../system-rl-policy.mjs";
import { GOVERNED_GENERATOR_CONTRACT_VERSION } from "../governed-generation-contract.mjs";

const observation = (id, text, entityLabel, extra = {}) => ({
  evidenceId: id, kind: "observation", entityId: entityLabel, payload: { text, entityLabel }, quality: { status: "verified" }, ...extra,
});
const shell = observation("shell", "Shell thickness 6 mm.", "Shell");
const roof = observation("roof", "Roof thickness 8 mm.", "Roof");
const plan = (records, extra = {}) => ({
  planId: "plan-test", sectionId: "inspection-report", status: "ready",
  evidenceUses: records.map((record) => ({ useId: `use-${record.evidenceId}`, evidenceIds: [record.evidenceId], role: "required_narrative" })),
  outputObligations: records.map((record) => ({ obligationId: `required-${record.evidenceId}`, evidenceIds: [record.evidenceId], entityIds: [record.entityId], expected: { text: record.payload.text }, criticality: "critical" })),
  ...extra,
});
const evaluate = (records, html, extra = {}) => evaluateSectionPlanOutput({ sectionPlan: plan(records), evidenceRecords: records, generatedContent: html, ...extra });

const exact = evaluate([shell, roof], "<p>Shell thickness 6 mm.</p><p>Roof thickness 8 mm.</p>");
assert.equal(exact.truthGraphEvaluation.requiredFactRecall, 1);
assert.equal(exact.truthGraphEvaluation.protectedFactAccuracy, 1);
assert.equal(exact.truthGraphEvaluation.claimPrecision, 1);
assert.deepEqual(exact.blockerReasons, []);

const swapped = evaluate([shell, roof], "<p>Shell thickness 8 mm. Roof thickness 6 mm.</p>");
assert.equal(swapped.truthGraphEvaluation.requiredFactRecall, 0);
assert.equal(swapped.entityMismatchCount, 2);
assert(swapped.blockerReasons.includes("incorrect_entity_binding"));

const omitted = evaluate([shell, roof], "<p>Shell thickness 6 mm.</p>");
assert.equal(omitted.truthGraphEvaluation.requiredFactRecall, 0.5);
assert.deepEqual(omitted.missingRequiredObligationIds, ["required-roof"]);
assert.equal(omitted.truthGraphEvaluation.protectedFactMismatchCount, 0);
assert.equal(omitted.truthGraphEvaluation.protectedFactAccuracy, 1);
assert.deepEqual(omitted.blockerReasons, []);
const sameValueRoof = observation("same-value-roof", "Roof thickness 6 mm.", "Roof");
const sameValueOmission = evaluate([shell, sameValueRoof], "<p>Roof thickness 6 mm.</p>");
assert.deepEqual(sameValueOmission.missingRequiredObligationIds, ["required-shell"]);
assert.equal(sameValueOmission.entityMismatchCount, 0, "Another component's own identical value must not turn an omission into corruption.");

const support = observation("sump", "Sump depth 135 mm.", "Sump");
const supportOnly = evaluateSectionPlanOutput({
  sectionPlan: plan([], { evidenceUses: [{ useId: "support", evidenceIds: [support.evidenceId], role: "supporting" }] }),
  evidenceRecords: [support], generatedContent: "<p>Inspection completed.</p>",
});
assert.equal(supportOnly.truthGraphEvaluation.requiredFactCount, 0);
assert.equal(supportOnly.truthGraphEvaluation.requiredFactRecall, null);
assert.equal(supportOnly.truthGraphEvaluation.protectedFactAccuracy, null);
assert.equal(supportOnly.truthGraphEvaluation.claimPrecision, null);
assert.equal(supportOnly.truthGraphEvaluation.protectedFactMismatchCount, 0);

const independent = evaluate([shell], "<p>Roof thickness 8 mm.</p>", {
  sectionPlan: plan([], { evidenceUses: [{ evidenceIds: ["roof"], role: "supporting" }] }),
  expectedObligations: plan([shell]).outputObligations,
});
assert.equal(independent.truthGraphEvaluation.requiredFactCount, 1, "A router losing a fact must not erase its independent obligation.");
assert.equal(independent.routingCoverage, 0);
assert.equal(independent.truthGraphEvaluation.requiredFactRecall, 0);

const condition = observation("condition", "The roof is in satisfactory condition.", "Roof");
const contradicted = evaluate([condition], "<p>The roof is not in satisfactory condition.</p>");
assert.equal(contradicted.contradictionCount, 1);
assert.equal(contradicted.truthGraphEvaluation.requiredFactRecall, 0);
assert(contradicted.blockerReasons.includes("contradicted_captured_finding"));
assert.equal(evaluate([condition], "<p>Not the roof is in satisfactory condition.</p>").contradictionCount, 1, "An unchanged substring after negation must not count as recovered.");

const paraphrase = evaluate([condition], "<p>The roof was found to be in satisfactory condition.</p>");
assert.equal(paraphrase.unresolvedEvaluationCount, 1);
assert.equal(paraphrase.truthGraphEvaluation.requiredFactRecall, 0, "Lexical overlap alone must not assert semantic equivalence.");

const unit = observation("clearance", "Scanner clearance 3 inches.", "Scanner");
const badUnit = evaluate([unit], "<p>Scanner clearance 3 feet.</p>");
assert.equal(badUnit.changedValueCount, 1);
assert.equal(badUnit.truthGraphEvaluation.protectedFactAccuracy, 0);
assert.equal(evaluate([unit], "<p>Scanner clearance 3”</p>").truthGraphEvaluation.requiredFactRecall, 1);

const misplaced = evaluate([shell], '<section data-section-id="repair-recommendations"><p>Shell thickness 6 mm.</p></section>');
assert.deepEqual(misplaced.misplacedObligationIds, ["required-shell"]);
assert.equal(misplaced.truthGraphEvaluation.requiredFactRecall, 0);

const row = { evidenceId: "row-1", kind: "measurement", entityId: "plate-1", quality: { status: "verified" }, payload: { itemLabel: "Plate P1", cells: [{ key: "first", value: 6, unitCode: "mm" }, { key: "second", value: 8, unitCode: "mm" }] } };
const rowPlan = plan([row]);
rowPlan.outputObligations[0].expected = { cells: row.payload.cells };
const evaluateRow = (text) => evaluateSectionPlanOutput({ sectionPlan: rowPlan, evidenceRecords: [row], generatedContent: text });
assert.equal(evaluateRow("<table><tr><th>Plate P1</th><td>6 mm</td><td>8 mm</td></tr></table>").truthGraphEvaluation.requiredFactRecall, 1);
assert.equal(evaluateRow("<table><tr><th>Plate P1</th><td>8 mm</td><td>6 mm</td></tr></table>").changedValueCount, 1, "Cell order must be preserved.");

const run = {
  evalRunId: "eval-audit", reportJobId: "report-audit", sectionId: "inspection-report",
  outcomeCode: "ready_for_review", score: 1, generatorContractVersion: GOVERNED_GENERATOR_CONTRACT_VERSION,
  sectionPlanEvaluation: exact, truthGraphEvaluation: exact.truthGraphEvaluation,
  goldSectionEvaluation: { evaluationMode: "evidence_conditioned_semantic" },
  evidenceSectionEvaluation: { available: true, evidenceCoverage: 1, verdict: "acceptable" },
  sectionFormatEvaluation: { score: 1 }, dimensions: [{ key: "source_grounding", score: 1 }, { key: "format_match", score: 1 }],
};
const classified = structuredClone(run);
classified.sectionPlanEvaluation = swapped;
classified.truthGraphEvaluation = swapped.truthGraphEvaluation;
applyCaptureAwareOutcome(classified);
assert.equal(classified.outcomeCode, "blocked");
const partial = structuredClone(run);
partial.sectionPlanEvaluation = omitted;
partial.truthGraphEvaluation = omitted.truthGraphEvaluation;
applyCaptureAwareOutcome(partial);
assert.equal(partial.outcomeCode, "needs_attention", "Omission alone must not become an alteration blocker.");

const frozenReward = calculateSystemRlReward({ evalRun: run, generationRun: { blockers: [] }, updateLearning: false });
assert.equal(frozenReward.value, null);
assert.equal(frozenReward.learningEligible, false);
assert.equal(frozenReward.metrics.promotionEvidenceEligible, false);
assert.equal(frozenReward.metrics.runPurpose, "frozen_diagnostic");
assert.equal(frozenReward.metrics.sectionPlanEvaluationContract, SECTION_PLAN_EVALUATION_CONTRACT);
assert(frozenReward.metrics.diagnosticRewardValue > 0.9);

// Exercise actual persistence orchestration against a capture-only fake DB.
// No configured database, model worker, or external runtime is used.
const writes = [];
const db = { prepare: (sql) => ({ run: async (...params) => { writes.push({ sql, params }); } }) };
const controller = createSystemRlController({ db, now: () => "2026-09-17T00:00:00.000Z" });
await controller.recordEpisode({
  decision: { decisionId: "decision-audit", policyVersionId: "candidate-audit", armId: "arm-audit", mode: SYSTEM_RL_MODES.OFFLINE, contextKey: "audit", configuration: {} },
  evalRun: run, generationRun: { runId: "generation-audit", blockers: [] }, updateLearning: false,
});
assert.equal(writes.length, 2, "Frozen diagnostics must write only their decision/result, not aggregate updates.");
assert.equal(writes[1].params[4], false, "The persisted learning_eligible flag must be false, not just the returned object.");
assert.equal(JSON.parse(writes[1].params[7]).promotionEvidenceEligible, false);
assert.equal(JSON.parse(writes[1].params[7]).runPurpose, "frozen_diagnostic");

console.log("Section-plan evaluation audit passed: independent obligations, optional omissions, units, entity swaps, polarity, conservative paraphrases, row order, placement, and frozen persistence.");
