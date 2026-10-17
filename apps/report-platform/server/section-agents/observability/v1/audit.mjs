#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  buildAgentMonitoring,
  buildAgentPipelineTrace,
  buildEvaluationMatrix,
  createInspectableArtifact,
  createMatrixRow,
  createTraceSpan,
} from './contracts.mjs';

const t0 = '2026-10-01T00:00:00.000Z';
const t1 = '2026-10-01T00:00:01.000Z';
const t2 = '2026-10-01T00:00:02.000Z';
const hash = 'a'.repeat(64);
const inputArtifact = createInspectableArtifact({
  artifactId: 'audit.input',
  name: 'audit-input',
  kind: 'test_input',
  schemaVersion: 'audit_v1',
  preview: { inspectionId: 'inspection-a', value: 42 },
  sourceSha256: hash,
});
const root = createTraceSpan({
  spanId: 'run', phase: 'evaluation_run', actor: { kind: 'deterministic_control', role: 'orchestrator', id: 'audit' },
  status: 'passed', startedAtIso: t0, completedAtIso: t2,
  inputRefs: [inputArtifact],
});
const barrier = createTraceSpan({
  spanId: 'gold', parentSpanId: 'run', phase: 'gold_access_barrier',
  actor: { kind: 'deterministic_control', role: 'gold_access_guard', id: 'audit-barrier' },
  status: 'passed', startedAtIso: t0, completedAtIso: t1,
  outputRefs: [{ name: 'sealed-gold', sha256: hash }],
});
const evaluator = createTraceSpan({
  spanId: 'evaluator', parentSpanId: 'run', phase: 'post_generation_evaluation', sectionId: 'section-a',
  actor: { kind: 'agent', role: 'post_generation_evaluator', id: 'evaluator', releaseVersion: 'v1', manifestSha256: hash },
  status: 'awaiting', startedAtIso: t1, completedAtIso: t2,
  inputRefs: [{ name: 'sealed-gold', sha256: hash }],
});
const trace = buildAgentPipelineTrace({
  traceId: 'trace-audit', evaluationCaseId: 'case-audit', datasetSplit: 'evaluation_only',
  reportProfileId: 'vertical_tank_inspection_v1', executionMode: 'evaluation',
  startedAtIso: t0, completedAtIso: t2, spans: [root, barrier, evaluator],
});

const passed = createMatrixRow({
  metricId: 'gate.pass', label: 'Passing gate', phase: 'input_guard', class: 'hard_gate', status: 'pass',
  value: 1, numerator: 1, denominator: 1, criterion: { operator: 'eq', value: 1 },
});
const unavailable = createMatrixRow({
  metricId: 'gate.pending', label: 'Pending gate', phase: 'post_generation_evaluation', class: 'hard_gate',
  status: 'not_available', notes: ['Semantic judge has not run.'], sourceSpanIds: ['evaluator'],
});
const matrix = buildEvaluationMatrix({
  evaluationCaseId: 'case-audit', traceId: trace.traceId, displayDecision: 'allowed', rows: [passed, unavailable],
});
assert.equal(matrix.outcomes.runValidity, 'valid');
assert.equal(matrix.outcomes.displayDecision, 'allowed');
assert.equal(matrix.outcomes.qualificationDecision, 'incomplete');
assert.equal(matrix.outcomes.promotionDecision, 'not_performed');
assert.equal(matrix.summary.hardGatePassed, 1);
assert.equal(matrix.summary.hardGateUnavailable, 1);

const evidenceTrace = {
  contractVersion: 'agent_evidence_trace_v1',
  router: { total: 1, routed: 1, excluded: 0, unresolved: 0, dispositionCoverage: 1 },
  sections: [],
};
const controlPlane = {
  contractVersion: 'agent_control_plane_snapshot_v1', executionMode: 'evaluation', productEnabled: false,
  approvalStatus: 'not_approved', promotionPerformed: false,
  bindings: [{
    spanId: 'evaluator', sectionId: 'section-a', role: 'post_generation_evaluator', id: 'evaluator',
    releaseVersion: 'v1', manifestSha256: hash, status: 'awaiting',
  }],
  controls: [
    { spanId: 'run', role: 'orchestrator', id: 'audit', status: 'passed' },
    { spanId: 'gold', role: 'gold_access_guard', id: 'audit-barrier', status: 'passed' },
  ],
  monitoringCoverage: {
    actualAgentSpans: 1,
    unmonitoredActualAgents: 0,
    supportedAgentRoles: ['post_generation_evaluator', 'section_generator'],
    notRunInThisCase: ['section_generator'],
  },
  outcomes: matrix.outcomes,
};
const monitoring = buildAgentMonitoring({ trace, evidenceTrace, evaluationMatrix: matrix, controlPlane });
assert.equal(monitoring.contractVersion, 'section_agent_monitoring_v1');
assert.equal(monitoring.statusSummary.execution.status, 'completed');
assert.equal(monitoring.statusSummary.gate.status, 'passed');
assert.equal(monitoring.statusSummary.quality.status, 'not_measured');
assert.equal(monitoring.artifactCatalog.artifacts.length, 1);
assert.equal(monitoring.artifactCatalog.artifacts[0].artifactId, 'audit.input');
assert.deepEqual(monitoring.artifactCatalog.artifacts[0].preview,
  { inspectionId: 'inspection-a', value: 42 });
assert.equal(passed.ruleEvaluations[0].observed, 1);
assert.equal(passed.ruleEvaluations[0].operator, 'eq');
assert.equal(passed.ruleEvaluations[0].expected, 1);
assert.equal(passed.ruleEvaluations[0].verdict, 'pass');
assert.equal(passed.grader.type, 'deterministic');

const legacyTrace = structuredClone(trace);
for (const span of legacyTrace.spans) {
  delete span.outcomes;
  delete span.configuration;
  delete span.runtime;
  delete span.toolCalls;
  delete span.error;
}
const legacyMatrix = structuredClone(matrix);
for (const row of legacyMatrix.rows) {
  delete row.ruleEvaluations;
  delete row.grader;
}
assert.equal(buildAgentMonitoring({
  trace: legacyTrace, evidenceTrace, evaluationMatrix: legacyMatrix,
  controlPlane: { ...controlPlane, outcomes: legacyMatrix.outcomes },
}).statusSummary.quality.status, 'not_measured', 'Existing v1 traces remain readable.');

const failedMatrix = buildEvaluationMatrix({
  evaluationCaseId: 'case-audit', traceId: trace.traceId, displayDecision: 'blocked', rows: [createMatrixRow({
    metricId: 'gate.fail', label: 'Failed gate', phase: 'input_guard', class: 'hard_gate', status: 'fail',
    value: 0, numerator: 0, denominator: 1, criterion: { operator: 'eq', value: 1 },
  })],
});
assert.equal(failedMatrix.outcomes.runValidity, 'invalid');
assert.equal(failedMatrix.outcomes.qualificationDecision, 'not_qualified');

assert.throws(() => createMatrixRow({
  metricId: 'gate.false-pass', label: 'False pass', phase: 'input_guard', class: 'hard_gate', status: 'pass',
  value: 0, numerator: 0, denominator: 1, criterion: { operator: 'eq', value: 1 },
}), /status does not match/);

assert.throws(() => createMatrixRow({
  metricId: 'gate.zero-denominator', label: 'Zero denominator', phase: 'input_guard', class: 'hard_gate', status: 'pass',
  value: 1, numerator: 0, denominator: 0, criterion: { operator: 'eq', value: 1 },
}), /denominators must be greater than zero/);

assert.throws(() => createTraceSpan({
  spanId: 'unbound-agent', phase: 'generation', actor: { kind: 'agent', role: 'generator', id: 'unsafe' },
  status: 'passed', startedAtIso: t0, completedAtIso: t1,
}), /release version and manifest/);

assert.throws(() => createTraceSpan({
  spanId: 'unsafe', phase: 'generation',
  actor: { kind: 'agent', role: 'generator', id: 'unsafe', releaseVersion: 'v1', manifestSha256: hash },
  status: 'passed', startedAtIso: t0, completedAtIso: t1,
  decision: { code: 'unsafe', summary: 'Unsafe payload.', chainOfThought: 'must never be persisted' },
}), /prohibited/);

assert.throws(() => createInspectableArtifact({
  artifactId: 'unsafe.preview', name: 'unsafe-preview', kind: 'test_input', schemaVersion: 'audit_v1',
  preview: { RaWPrompt: 'must never be retained' },
}), /prohibited/);

const tamperedArtifact = structuredClone(inputArtifact);
tamperedArtifact.preview.value = 43;
assert.throws(() => createTraceSpan({
  spanId: 'tampered-artifact', phase: 'input_guard',
  actor: { kind: 'deterministic_control', role: 'guard', id: 'audit' },
  status: 'passed', startedAtIso: t0, completedAtIso: t1, inputRefs: [tamperedArtifact],
}), /SHA-256 does not match/);

const earlyEvaluator = createTraceSpan({
  spanId: 'evaluator', parentSpanId: 'run', phase: 'post_generation_evaluation', sectionId: 'section-a',
  actor: { kind: 'agent', role: 'post_generation_evaluator', id: 'evaluator', releaseVersion: 'v1', manifestSha256: hash },
  status: 'awaiting', startedAtIso: t0, completedAtIso: t2,
  inputRefs: [{ name: 'sealed-gold', sha256: hash }],
});
assert.throws(() => buildAgentPipelineTrace({
  traceId: 'early-eval', evaluationCaseId: 'case-audit', datasetSplit: 'evaluation_only',
  reportProfileId: 'vertical_tank_inspection_v1', executionMode: 'evaluation', startedAtIso: t0, completedAtIso: t2,
  spans: [root, barrier, earlyEvaluator],
}), /before the gold-access barrier/);

assert.throws(() => buildAgentMonitoring({
  trace,
  evidenceTrace: { ...evidenceTrace, router: { ...evidenceTrace.router, routed: 0 } },
  evaluationMatrix: matrix,
  controlPlane,
}), /do not add up/);

assert.throws(() => buildAgentMonitoring({
  trace, evidenceTrace, evaluationMatrix: matrix, controlPlane: { ...controlPlane, bindings: [] },
}), /bindings do not match/);

assert.throws(() => buildAgentMonitoring({
  trace,
  evidenceTrace,
  evaluationMatrix: matrix,
  controlPlane: {
    ...controlPlane,
    monitoringCoverage: { ...controlPlane.monitoringCoverage, actualAgentSpans: 2 },
  },
}), /exactly one monitored span/);

const missingCountsTrace = structuredClone(trace);
delete missingCountsTrace.spans[2].counts;
assert.throws(() => buildAgentMonitoring({
  trace: missingCountsTrace, evidenceTrace, evaluationMatrix: matrix, controlPlane,
}), /counts must be an object/);

const unknownSpanMatrix = structuredClone(matrix);
unknownSpanMatrix.rows[0].sourceSpanIds = ['missing-span'];
assert.throws(() => buildAgentMonitoring({
  trace, evidenceTrace, evaluationMatrix: unknownSpanMatrix, controlPlane,
}), /unknown trace span/);

console.log(JSON.stringify({
  passed: true,
  allAgentBindingsRecomputed: true,
  unavailableHardGateMakesQualificationIncomplete: true,
  falsePassRejected: true,
  zeroDenominatorRejected: true,
  failedHardGateCannotBeAveragedAway: true,
  evidenceArithmeticValidated: true,
  strictRuntimeShapeValidated: true,
  hiddenReasoningRejected: true,
  inspectableArtifactsHashValidated: true,
  legacyV1StillReadable: true,
  executionGateAndQualitySeparated: true,
  atomicRulesAndGradersExposed: true,
  earlyGoldEvaluationRejected: true,
  promotionPerformed: false,
}, null, 2));
