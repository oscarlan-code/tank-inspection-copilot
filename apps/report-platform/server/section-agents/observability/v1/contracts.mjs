import { createHash } from 'node:crypto';

export const TRACE_CONTRACT = 'agent_pipeline_trace_v1';
export const MATRIX_CONTRACT = 'section_agent_evaluation_matrix_v1';
export const MONITORING_CONTRACT = 'section_agent_monitoring_v1';

const SPAN_STATUSES = new Set(['passed', 'blocked', 'awaiting', 'not_applicable']);
const MATRIX_STATUSES = new Set(['pass', 'fail', 'not_available', 'not_applicable']);
const MATRIX_CLASSES = new Set(['hard_gate', 'quality', 'diagnostic']);
const ACTOR_KINDS = new Set(['agent', 'deterministic_control', 'human_control']);
const ARTIFACT_VISIBILITIES = new Set(['authorized_admin', 'internal_summary']);
const ARTIFACT_REDACTION_STATUSES = new Set(['none', 'sanitized', 'redacted', 'metadata_only']);
const EXECUTION_OUTCOMES = new Set(['completed', 'failed', 'pending', 'not_run']);
const GATE_OUTCOMES = new Set(['passed', 'blocked', 'pending', 'not_applicable']);
const QUALITY_OUTCOMES = new Set(['passed', 'failed', 'not_measured', 'not_applicable']);
const GRADER_TYPES = new Set(['deterministic', 'llm', 'human']);
const FORBIDDEN_TRACE_KEYS = new Set([
  'chainofthought', 'reasoning', 'hiddenreasoning', 'rawprompt', 'prompt',
  'rawevidence', 'originalcontent', 'generatedcontent',
]);

const canonicalize = value => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
};

export const canonicalSha256 = value => createHash('sha256')
  .update(typeof value === 'string' ? value : JSON.stringify(canonicalize(value)))
  .digest('hex');

const hasText = value => typeof value === 'string' && value.trim().length > 0;
const isHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const isoTime = value => hasText(value) && Number.isFinite(Date.parse(value));
const sameJson = (left, right) => JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
const plainObject = value => value != null && typeof value === 'object' && !Array.isArray(value);
const nonNegativeInteger = value => Number.isInteger(value) && value >= 0;
const jsonByteLength = value => Buffer.byteLength(JSON.stringify(canonicalize(value)), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoHiddenPayload(value, cursor = 'monitoring') {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    assert(!FORBIDDEN_TRACE_KEYS.has(key.toLowerCase()), `${cursor}.${key} is prohibited from agent monitoring.`);
    assertNoHiddenPayload(item, `${cursor}.${key}`);
  }
}

function assertStringArray(value, cursor, { allowEmptyStrings = false } = {}) {
  assert(Array.isArray(value) && value.every(item => allowEmptyStrings
    ? typeof item === 'string' : hasText(item)), `${cursor} is invalid.`);
}

function validateInspectableArtifact(ref, cursor) {
  assert(plainObject(ref) && hasText(ref.name) && (ref.sha256 == null || isHash(ref.sha256)),
    `${cursor}: every input/output reference needs a name and optional SHA-256.`);
  if (ref.artifactId == null) return;
  assert(hasText(ref.artifactId) && hasText(ref.kind) && hasText(ref.schemaVersion),
    `${cursor}: inspectable artifacts require an ID, kind and schema version.`);
  assert(isHash(ref.sha256), `${cursor}: inspectable artifacts require a SHA-256.`);
  assert(ref.sourceSha256 == null || isHash(ref.sourceSha256), `${cursor}: source SHA-256 is invalid.`);
  assert(nonNegativeInteger(ref.byteLength), `${cursor}: inspectable artifact byte length is invalid.`);
  assert(ARTIFACT_VISIBILITIES.has(ref.visibility), `${cursor}: inspectable artifact visibility is invalid.`);
  assert(ARTIFACT_REDACTION_STATUSES.has(ref.redactionStatus),
    `${cursor}: inspectable artifact redaction status is invalid.`);
  if (Object.hasOwn(ref, 'preview')) {
    assert(ref.byteLength === jsonByteLength(ref.preview), `${cursor}: artifact byte length does not match its preview.`);
    assert(ref.sha256 === canonicalSha256(ref.preview), `${cursor}: artifact SHA-256 does not match its preview.`);
    assertNoHiddenPayload(ref.preview, `${cursor}.preview`);
  }
}

function defaultSpanOutcomes(status) {
  return {
    execution: {
      status: status === 'awaiting' ? 'pending' : 'completed',
      explanation: status === 'awaiting' ? 'This stage is waiting for a declared dependency.' : 'The stage returned a recorded result.',
    },
    gate: {
      status: status === 'passed' ? 'passed' : status === 'blocked' ? 'blocked'
        : status === 'awaiting' ? 'pending' : 'not_applicable',
      explanation: status === 'passed' ? 'The stage gate passed.' : status === 'blocked'
        ? 'The stage gate blocked progression.' : status === 'awaiting'
          ? 'The gate has not produced a final decision.' : 'No gate applies to this stage.',
    },
    quality: {
      status: 'not_measured',
      explanation: 'Execution and gate status do not establish semantic quality.',
    },
  };
}

function validateSpanOutcomes(outcomes, spanId) {
  assert(plainObject(outcomes), `${spanId}: execution/gate/quality outcomes are required.`);
  assert(plainObject(outcomes.execution) && EXECUTION_OUTCOMES.has(outcomes.execution.status)
      && hasText(outcomes.execution.explanation), `${spanId}: execution outcome is invalid.`);
  assert(plainObject(outcomes.gate) && GATE_OUTCOMES.has(outcomes.gate.status)
      && hasText(outcomes.gate.explanation), `${spanId}: gate outcome is invalid.`);
  assert(plainObject(outcomes.quality) && QUALITY_OUTCOMES.has(outcomes.quality.status)
      && hasText(outcomes.quality.explanation), `${spanId}: quality outcome is invalid.`);
}

function validateRuleEvaluation(rule, metricId) {
  assert(plainObject(rule) && hasText(rule.ruleId) && hasText(rule.ruleVersion)
      && hasText(rule.description), `${metricId}: rule evaluation identity is incomplete.`);
  assert(Object.hasOwn(rule, 'observed') && Object.hasOwn(rule, 'operator')
      && Object.hasOwn(rule, 'expected'), `${metricId}: rule must expose observed, operator and expected values.`);
  assert(MATRIX_STATUSES.has(rule.verdict), `${metricId}: rule verdict is invalid.`);
  assert(rule.operator == null || ['eq', 'gte', 'lte', 'exists', 'all', 'none'].includes(rule.operator),
    `${metricId}: rule operator is invalid.`);
  assert(Array.isArray(rule.evidenceRefs) && rule.evidenceRefs.every(hasText),
    `${metricId}: rule evidence references are invalid.`);
  assert(hasText(rule.explanation), `${metricId}: rule explanation is required.`);
}

function validateGrader(grader, metricId) {
  assert(plainObject(grader) && GRADER_TYPES.has(grader.type) && hasText(grader.id)
      && hasText(grader.version), `${metricId}: grader identity is invalid.`);
  assert(grader.modelId == null || hasText(grader.modelId), `${metricId}: grader model is invalid.`);
  assert(grader.rubricSha256 == null || isHash(grader.rubricSha256), `${metricId}: grader rubric SHA-256 is invalid.`);
}

export function createInspectableArtifact({
  artifactId,
  name,
  kind,
  schemaVersion,
  preview,
  sourceSha256 = null,
  visibility = 'authorized_admin',
  redactionStatus = 'sanitized',
}) {
  const artifact = {
    artifactId,
    name,
    kind,
    schemaVersion,
    sha256: canonicalSha256(preview),
    sourceSha256,
    byteLength: jsonByteLength(preview),
    visibility,
    redactionStatus,
    preview,
  };
  validateInspectableArtifact(artifact, `artifact:${artifactId}`);
  return artifact;
}

function validateTraceSpanShape(span) {
  assert(plainObject(span) && hasText(span.spanId) && hasText(span.phase), 'Trace span identity is incomplete.');
  assert(span.parentSpanId == null || hasText(span.parentSpanId), `${span.spanId}: parent span ID is invalid.`);
  assert(span.sectionId == null || hasText(span.sectionId), `${span.spanId}: section ID is invalid.`);
  assert(plainObject(span.actor) && ACTOR_KINDS.has(span.actor.kind)
      && hasText(span.actor.role) && hasText(span.actor.id),
  `${span.spanId}: actor kind, role and ID are required.`);
  if (span.actor.kind === 'agent') {
    assert(hasText(span.actor.releaseVersion) && isHash(span.actor.manifestSha256),
      `${span.spanId}: agent spans require an exact release version and manifest SHA-256.`);
    const hasConfigurationIdentity = span.actor.configurationId != null
      || span.actor.configurationSha256 != null;
    assert(!hasConfigurationIdentity
        || (hasText(span.actor.configurationId) && isHash(span.actor.configurationSha256)),
    `${span.spanId}: configuration ID and SHA-256 must be recorded together.`);
  }
  assert(SPAN_STATUSES.has(span.status), `${span.spanId}: unsupported span status.`);
  assert(isoTime(span.startedAtIso), `${span.spanId}: startedAtIso is invalid.`);
  assert(span.completedAtIso == null || (isoTime(span.completedAtIso)
      && Date.parse(span.completedAtIso) >= Date.parse(span.startedAtIso)),
  `${span.spanId}: completedAtIso must not precede startedAtIso.`);
  const expectedDuration = span.completedAtIso == null
    ? null : Math.max(0, Date.parse(span.completedAtIso) - Date.parse(span.startedAtIso));
  assert(span.durationMs === expectedDuration, `${span.spanId}: duration does not match its timestamps.`);
  assert(Array.isArray(span.inputRefs) && Array.isArray(span.outputRefs),
    `${span.spanId}: input and output references must be arrays.`);
  for (const ref of [...span.inputRefs, ...span.outputRefs]) {
    validateInspectableArtifact(ref, span.spanId);
  }
  if (span.outcomes != null) validateSpanOutcomes(span.outcomes, span.spanId);
  if (span.configuration != null) {
    assert(plainObject(span.configuration), `${span.spanId}: configuration must be an object.`);
  }
  if (span.runtime != null) {
    assert(plainObject(span.runtime) && nonNegativeInteger(span.runtime.attempt)
        && nonNegativeInteger(span.runtime.retryCount), `${span.spanId}: runtime metadata is invalid.`);
    for (const key of ['inputTokens', 'outputTokens', 'totalTokens']) {
      assert(span.runtime[key] == null || nonNegativeInteger(span.runtime[key]),
        `${span.spanId}: ${key} is invalid.`);
    }
  }
  if (span.toolCalls != null) assert(Array.isArray(span.toolCalls), `${span.spanId}: tool calls must be an array.`);
  if (Object.hasOwn(span, 'error')) {
    assert(span.error == null || (plainObject(span.error) && hasText(span.error.code)
        && hasText(span.error.message)), `${span.spanId}: error metadata is invalid.`);
  }
  assert(plainObject(span.counts), `${span.spanId}: counts must be an object.`);
  for (const value of Object.values(span.counts)) {
    assert(finite(value) && value >= 0, `${span.spanId}: counts must be non-negative numbers.`);
  }
  if (span.decision != null) {
    assert(plainObject(span.decision) && hasText(span.decision.code) && hasText(span.decision.summary),
      `${span.spanId}: decision needs a code and summary.`);
    if (span.decision.blockers != null) assertStringArray(span.decision.blockers, `${span.spanId}: blockers`);
    if (span.decision.warnings != null) assertStringArray(span.decision.warnings, `${span.spanId}: warnings`);
  }
  if (span.model != null) {
    assert(plainObject(span.model) && hasText(span.model.providerCode)
        && (span.model.modelId == null || hasText(span.model.modelId))
        && typeof span.model.liveModelUsed === 'boolean', `${span.spanId}: model metadata is invalid.`);
  }
  if (span.retrieval != null) {
    assert(plainObject(span.retrieval) && hasText(span.retrieval.mode), `${span.spanId}: retrieval metadata is invalid.`);
    assertStringArray(span.retrieval.keys, `${span.spanId}: retrieval keys`);
  }
}

export function createTraceSpan({
  spanId,
  parentSpanId = null,
  phase,
  sectionId = null,
  actor,
  status,
  startedAtIso,
  completedAtIso = null,
  inputRefs = [],
  outputRefs = [],
  decision = null,
  counts = {},
  model = null,
  retrieval = null,
  outcomes = null,
  configuration = {},
  runtime = null,
  toolCalls = [],
  error = null,
}) {
  assert(hasText(spanId), 'Trace span ID is required.');
  assert(hasText(phase), `${spanId}: phase is required.`);
  assert(actor && ACTOR_KINDS.has(actor.kind) && hasText(actor.role) && hasText(actor.id),
    `${spanId}: actor kind, role and ID are required.`);
  if (actor.kind === 'agent') {
    assert(hasText(actor.releaseVersion) && isHash(actor.manifestSha256),
      `${spanId}: agent spans require an exact release version and manifest SHA-256.`);
    const hasConfigurationIdentity = actor.configurationId != null
      || actor.configurationSha256 != null;
    assert(!hasConfigurationIdentity
        || (hasText(actor.configurationId) && isHash(actor.configurationSha256)),
    `${spanId}: configuration ID and SHA-256 must be recorded together.`);
  }
  assert(SPAN_STATUSES.has(status), `${spanId}: unsupported span status.`);
  assert(isoTime(startedAtIso), `${spanId}: startedAtIso is invalid.`);
  if (completedAtIso != null) {
    assert(isoTime(completedAtIso) && Date.parse(completedAtIso) >= Date.parse(startedAtIso),
      `${spanId}: completedAtIso must not precede startedAtIso.`);
  }
  for (const ref of [...inputRefs, ...outputRefs]) {
    validateInspectableArtifact(ref, spanId);
  }
  for (const value of Object.values(counts)) assert(finite(value) && value >= 0, `${spanId}: counts must be non-negative numbers.`);
  const span = {
    spanId,
    parentSpanId,
    phase,
    sectionId,
    actor,
    status,
    startedAtIso,
    completedAtIso,
    durationMs: completedAtIso == null ? null : Math.max(0, Date.parse(completedAtIso) - Date.parse(startedAtIso)),
    inputRefs,
    outputRefs,
    decision,
    counts,
    model,
    retrieval,
    outcomes: outcomes ?? defaultSpanOutcomes(status),
    configuration,
    runtime: runtime ?? {
      attempt: 1,
      retryCount: 0,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      tokenStatus: 'not_reported',
    },
    toolCalls,
    error,
  };
  validateTraceSpanShape(span);
  assertNoHiddenPayload(span, `span:${spanId}`);
  return span;
}

export function buildAgentPipelineTrace({
  traceId,
  evaluationCaseId,
  datasetSplit,
  reportProfileId,
  executionMode,
  startedAtIso,
  completedAtIso,
  spans,
}) {
  const trace = {
    contractVersion: TRACE_CONTRACT,
    traceId,
    evaluationCaseId,
    datasetSplit,
    reportProfileId,
    executionMode,
    startedAtIso,
    completedAtIso,
    durationMs: Math.max(0, Date.parse(completedAtIso) - Date.parse(startedAtIso)),
    spans,
  };
  validateAgentPipelineTrace(trace);
  return trace;
}

export function validateAgentPipelineTrace(trace) {
  assert(trace?.contractVersion === TRACE_CONTRACT, 'Unsupported agent pipeline trace contract.');
  for (const key of ['traceId', 'evaluationCaseId', 'datasetSplit', 'reportProfileId', 'executionMode']) {
    assert(hasText(trace[key]), `Trace ${key} is required.`);
  }
  assert(isoTime(trace.startedAtIso) && isoTime(trace.completedAtIso)
      && Date.parse(trace.completedAtIso) >= Date.parse(trace.startedAtIso),
  'Trace timestamps are invalid.');
  assert(trace.durationMs === Math.max(0, Date.parse(trace.completedAtIso) - Date.parse(trace.startedAtIso)),
    'Trace duration does not match its timestamps.');
  assert(Array.isArray(trace.spans) && trace.spans.length > 0, 'Trace must contain spans.');
  const ids = new Set();
  for (const span of trace.spans) {
    assert(!ids.has(span.spanId), `Duplicate trace span ${span.spanId}.`);
    ids.add(span.spanId);
    validateTraceSpanShape(span);
  }
  for (const span of trace.spans) {
    assert(span.parentSpanId == null || ids.has(span.parentSpanId), `${span.spanId}: parent span is missing.`);
  }
  assert(trace.spans.filter(span => span.parentSpanId == null).length === 1,
    'Trace must contain exactly one root span.');
  for (const span of trace.spans) {
    const visited = new Set([span.spanId]);
    let parentSpanId = span.parentSpanId;
    while (parentSpanId != null) {
      assert(!visited.has(parentSpanId), `${span.spanId}: trace parent cycle detected.`);
      visited.add(parentSpanId);
      parentSpanId = trace.spans.find(candidate => candidate.spanId === parentSpanId).parentSpanId;
    }
  }
  const barriers = trace.spans.filter(span => span.phase === 'gold_access_barrier');
  const evaluators = trace.spans.filter(item => item.phase === 'post_generation_evaluation');
  assert(barriers.length <= 1, 'A trace cannot contain more than one gold-access barrier.');
  assert(evaluators.length === 0 || barriers.length === 1,
    'A trace with post-generation evaluation requires exactly one gold-access barrier.');
  const barrier = barriers[0];
  if (barrier) {
    assert(barrier.status === 'passed' && barrier.completedAtIso,
      'The gold-access barrier must pass and complete before evaluation.');
    for (const span of trace.spans.filter(item => ['section_generation', 'pre_display_review'].includes(item.phase))) {
      assert(span.completedAtIso && Date.parse(span.completedAtIso) <= Date.parse(barrier.startedAtIso),
        `${span.spanId}: generation/review completed after the gold-access barrier started.`);
    }
    for (const span of trace.spans.filter(item => item.phase === 'pre_display_review')) {
      assert(span.outputRefs.some(output => isHash(output.sha256)
          && barrier.inputRefs.some(input => input.sha256 === output.sha256)),
      `${span.spanId}: pre-display review output is not bound to the gold-access barrier.`);
    }
  }
  for (const span of evaluators) {
    assert(barrier?.completedAtIso && Date.parse(span.startedAtIso) >= Date.parse(barrier.completedAtIso),
      `${span.spanId}: evaluator started before the gold-access barrier completed.`);
    const sealedGold = span.inputRefs.filter(ref => ref.name.includes('sealed-gold'));
    assert(sealedGold.length === 1 && isHash(sealedGold[0].sha256),
      `${span.spanId}: evaluator requires one hashed sealed-gold input.`);
    assert(barrier.outputRefs.some(ref => ref.name === sealedGold[0].name && ref.sha256 === sealedGold[0].sha256),
      `${span.spanId}: sealed-gold input does not match the gold-access barrier output.`);
  }
  assertNoHiddenPayload(trace);
  return trace;
}

export function createMatrixRow({
  metricId,
  label,
  sectionId = null,
  phase,
  class: metricClass,
  status,
  value = null,
  numerator = null,
  denominator = null,
  criterion = null,
  unit = 'ratio',
  sourceSpanIds = [],
  evidenceRefs = [],
  notes = [],
  ruleEvaluations = null,
  grader = null,
}) {
  assert(hasText(metricId) && hasText(label) && hasText(phase), 'Evaluation-matrix row identity is incomplete.');
  assert(MATRIX_CLASSES.has(metricClass), `${metricId}: unsupported metric class.`);
  assert(MATRIX_STATUSES.has(status), `${metricId}: unsupported metric status.`);
  assert(sectionId == null || hasText(sectionId), `${metricId}: section ID is invalid.`);
  assert(hasText(unit), `${metricId}: unit is required.`);
  if (status === 'pass' || status === 'fail') {
    assert(finite(value), `${metricId}: measured rows require a finite value.`);
    assert(criterion && ['eq', 'gte', 'lte'].includes(criterion.operator) && finite(criterion.value),
      `${metricId}: measured rows require a criterion.`);
    const satisfied = criterion.operator === 'eq' ? value === criterion.value
      : criterion.operator === 'gte' ? value >= criterion.value : value <= criterion.value;
    assert((status === 'pass') === satisfied,
      `${metricId}: status does not match the measured value and criterion.`);
  } else {
    assert(value == null, `${metricId}: unavailable/not-applicable rows must use a null value.`);
    assert(numerator == null && denominator == null && criterion == null,
      `${metricId}: unavailable/not-applicable rows cannot carry measured values or criteria.`);
  }
  if (numerator != null || denominator != null) {
    assert(finite(numerator) && finite(denominator) && numerator >= 0 && denominator >= 0,
      `${metricId}: numerator and denominator must be non-negative numbers.`);
    if (status === 'pass' || status === 'fail') {
      assert(denominator > 0, `${metricId}: applicable measured denominators must be greater than zero.`);
    }
    if (unit === 'ratio') {
      assert(numerator <= denominator, `${metricId}: ratio numerators cannot exceed their denominators.`);
      assert(value != null && Math.abs(value - (numerator / denominator)) < 1e-12,
        `${metricId}: ratio value does not match numerator / denominator.`);
    }
  }
  assert(Array.isArray(sourceSpanIds) && sourceSpanIds.every(hasText), `${metricId}: source span IDs are invalid.`);
  assert(Array.isArray(evidenceRefs) && evidenceRefs.every(hasText), `${metricId}: evidence references are invalid.`);
  assert(Array.isArray(notes) && notes.every(value => typeof value === 'string'), `${metricId}: notes are invalid.`);
  const resolvedRuleEvaluations = ruleEvaluations ?? [{
    ruleId: metricId,
    ruleVersion: 'v1',
    description: label,
    observed: value,
    operator: criterion?.operator ?? null,
    expected: criterion?.value ?? null,
    verdict: status,
    evidenceRefs,
    explanation: status === 'pass' || status === 'fail'
      ? `Observed ${value} ${criterion.operator} ${criterion.value}; verdict ${status}.`
      : notes.find(hasText) ?? `This rule is ${status.replaceAll('_', ' ')}.`,
  }];
  const resolvedGrader = grader ?? {
    type: 'deterministic',
    id: 'evaluation-matrix-rule-engine',
    version: 'v1',
    modelId: null,
    rubricSha256: null,
  };
  assert(Array.isArray(resolvedRuleEvaluations) && resolvedRuleEvaluations.length > 0,
    `${metricId}: at least one rule evaluation is required.`);
  for (const rule of resolvedRuleEvaluations) validateRuleEvaluation(rule, metricId);
  validateGrader(resolvedGrader, metricId);
  const verdicts = new Set(resolvedRuleEvaluations.map(rule => rule.verdict));
  if (status === 'pass') assert([...verdicts].every(verdict => verdict === 'pass'),
    `${metricId}: a passing row cannot contain a non-passing rule.`);
  if (status === 'fail') assert(verdicts.has('fail'), `${metricId}: a failing row requires a failed rule.`);
  if (status === 'not_available') assert(verdicts.has('not_available'),
    `${metricId}: an unavailable row requires an unavailable rule.`);
  if (status === 'not_applicable') assert(verdicts.has('not_applicable'),
    `${metricId}: a not-applicable row requires a not-applicable rule.`);
  return {
    metricId,
    label,
    sectionId,
    phase,
    class: metricClass,
    status,
    value,
    numerator,
    denominator,
    criterion,
    unit,
    sourceSpanIds,
    evidenceRefs,
    notes,
    ruleEvaluations: resolvedRuleEvaluations,
    grader: resolvedGrader,
  };
}

export function buildEvaluationMatrix({ evaluationCaseId, traceId, rows, displayDecision }) {
  assert(Array.isArray(rows) && rows.length > 0, 'Evaluation matrix requires rows.');
  const ids = new Set();
  for (const row of rows) {
    assert(!ids.has(row.metricId), `Duplicate evaluation metric ${row.metricId}.`);
    ids.add(row.metricId);
    createMatrixRow(row);
  }
  const hard = rows.filter(row => row.class === 'hard_gate' && row.status !== 'not_applicable');
  const failed = hard.filter(row => row.status === 'fail');
  const unavailable = hard.filter(row => row.status === 'not_available');
  const qualificationDecision = failed.length ? 'not_qualified' : unavailable.length ? 'incomplete' : 'qualified';
  const matrix = {
    contractVersion: MATRIX_CONTRACT,
    evaluationCaseId,
    traceId,
    policy: {
      hardGateRule: 'Every applicable hard gate must pass; unavailable gates make qualification incomplete.',
      scoreRule: 'Quality and diagnostic metrics never offset a failed or unavailable hard gate.',
    },
    outcomes: {
      runValidity: failed.length ? 'invalid' : 'valid',
      displayDecision,
      qualificationDecision,
      promotionDecision: 'not_performed',
    },
    summary: {
      hardGateCount: hard.length,
      hardGatePassed: hard.filter(row => row.status === 'pass').length,
      hardGateFailed: failed.length,
      hardGateUnavailable: unavailable.length,
      qualityMeasured: rows.filter(row => row.class === 'quality' && ['pass', 'fail'].includes(row.status)).length,
      qualityUnavailable: rows.filter(row => row.class === 'quality' && row.status === 'not_available').length,
    },
    rows,
  };
  validateEvaluationMatrix(matrix);
  return matrix;
}

export function validateEvaluationMatrix(matrix) {
  assert(matrix?.contractVersion === MATRIX_CONTRACT, 'Unsupported evaluation matrix contract.');
  assert(hasText(matrix.evaluationCaseId) && hasText(matrix.traceId), 'Evaluation matrix identity is incomplete.');
  assert(['allowed', 'blocked'].includes(matrix.outcomes?.displayDecision), 'Display decision is invalid.');
  assert(['qualified', 'not_qualified', 'incomplete'].includes(matrix.outcomes?.qualificationDecision),
    'Qualification decision is invalid.');
  assert(matrix.outcomes?.promotionDecision === 'not_performed', 'Evaluation monitoring cannot perform promotion.');
  assert(['valid', 'invalid'].includes(matrix.outcomes?.runValidity), 'Run-validity decision is invalid.');
  assert(plainObject(matrix.policy) && hasText(matrix.policy.hardGateRule) && hasText(matrix.policy.scoreRule),
    'Evaluation matrix policy is incomplete.');
  assert(Array.isArray(matrix.rows) && matrix.rows.length > 0, 'Evaluation matrix requires rows.');
  const rebuilt = buildEvaluationMatrixInternal(matrix);
  assert(JSON.stringify(rebuilt.summary) === JSON.stringify(matrix.summary), 'Evaluation matrix summary was not recomputed correctly.');
  assert(rebuilt.qualificationDecision === matrix.outcomes.qualificationDecision,
    'Evaluation matrix qualification decision is inconsistent.');
  assert(rebuilt.runValidity === matrix.outcomes.runValidity,
    'Evaluation matrix run-validity decision is inconsistent.');
  return matrix;
}

function buildEvaluationMatrixInternal(matrix) {
  const ids = new Set();
  for (const row of matrix.rows ?? []) {
    assert(plainObject(row) && (row.sectionId == null || hasText(row.sectionId)) && hasText(row.unit),
      'Evaluation matrix row shape is invalid.');
    assert(Array.isArray(row.sourceSpanIds) && Array.isArray(row.evidenceRefs) && Array.isArray(row.notes),
      `${row.metricId ?? 'unknown metric'}: matrix reference and note arrays are required.`);
    for (const key of ['value', 'numerator', 'denominator', 'criterion']) {
      assert(Object.hasOwn(row, key), `${row.metricId ?? 'unknown metric'}: ${key} must be explicit.`);
    }
    assert(!ids.has(row.metricId), `Duplicate evaluation metric ${row.metricId}.`);
    ids.add(row.metricId);
    createMatrixRow(row);
  }
  const hard = matrix.rows.filter(row => row.class === 'hard_gate' && row.status !== 'not_applicable');
  const failed = hard.filter(row => row.status === 'fail');
  const unavailable = hard.filter(row => row.status === 'not_available');
  return {
    runValidity: failed.length ? 'invalid' : 'valid',
    qualificationDecision: failed.length ? 'not_qualified' : unavailable.length ? 'incomplete' : 'qualified',
    summary: {
      hardGateCount: hard.length,
      hardGatePassed: hard.filter(row => row.status === 'pass').length,
      hardGateFailed: failed.length,
      hardGateUnavailable: unavailable.length,
      qualityMeasured: matrix.rows.filter(row => row.class === 'quality' && ['pass', 'fail'].includes(row.status)).length,
      qualityUnavailable: matrix.rows.filter(row => row.class === 'quality' && row.status === 'not_available').length,
    },
  };
}

function artifactCatalogFor(trace, suppliedArtifacts = null) {
  const artifacts = new Map();
  const candidates = suppliedArtifacts ?? trace.spans.flatMap(span => [...span.inputRefs, ...span.outputRefs])
    .filter(ref => ref.artifactId != null && Object.hasOwn(ref, 'preview'));
  for (const artifact of candidates) {
    validateInspectableArtifact(artifact, `artifact-catalog:${artifact.artifactId}`);
    assert(Object.hasOwn(artifact, 'preview'),
      `artifact-catalog:${artifact.artifactId}: the saved artifact preview is required.`);
    const existing = artifacts.get(artifact.artifactId);
    if (existing) {
      assert(sameJson(existing, artifact), `Artifact ${artifact.artifactId} was saved with different content.`);
    } else {
      artifacts.set(artifact.artifactId, artifact);
    }
  }
  for (const span of trace.spans) {
    for (const ref of [...span.inputRefs, ...span.outputRefs].filter(item => item.artifactId != null)) {
      const saved = artifacts.get(ref.artifactId);
      assert(saved, `${span.spanId}: artifact ${ref.artifactId} is missing from the artifact catalog.`);
      const { preview: _savedPreview, ...savedDescriptor } = saved;
      const { preview: _refPreview, ...refDescriptor } = ref;
      assert(sameJson(savedDescriptor, refDescriptor),
        `${span.spanId}: artifact reference ${ref.artifactId} does not match the saved artifact.`);
    }
  }
  return {
    contractVersion: 'agent_artifact_catalog_v1',
    policy: {
      immutable: true,
      authorization: 'system_rl_manage',
      contentRule: 'Only sanitized observable inputs and outputs are retained. Hidden reasoning and raw prompts are prohibited.',
    },
    artifacts: [...artifacts.values()],
  };
}

function monitoringStatusSummary({ trace, evaluationMatrix }) {
  const qualityMeasured = evaluationMatrix.summary.qualityMeasured;
  return {
    execution: {
      status: trace.spans.some(span => (span.outcomes ?? defaultSpanOutcomes(span.status)).execution.status === 'failed')
        ? 'failed' : 'completed',
      completedStages: trace.spans.filter(span =>
        (span.outcomes ?? defaultSpanOutcomes(span.status)).execution.status === 'completed').length,
      totalStages: trace.spans.length,
      explanation: 'Execution reports whether the workflow stages returned auditable results.',
    },
    gate: {
      status: evaluationMatrix.outcomes.displayDecision === 'allowed' ? 'passed' : 'blocked',
      displayDecision: evaluationMatrix.outcomes.displayDecision,
      explanation: 'The gate controls whether a draft may be shown for inspector review; it does not approve the report.',
    },
    quality: {
      status: qualityMeasured > 0
        ? (evaluationMatrix.rows.some(row => row.class === 'quality' && row.status === 'fail') ? 'failed' : 'passed')
        : 'not_measured',
      measuredMetrics: qualityMeasured,
      unavailableMetrics: evaluationMatrix.summary.qualityUnavailable,
      qualificationDecision: evaluationMatrix.outcomes.qualificationDecision,
      explanation: qualityMeasured > 0
        ? 'Quality reflects post-generation evaluation metrics.'
        : 'No semantic quality metric was measured; execution and gate success must not be read as content quality.',
    },
  };
}

export function buildAgentMonitoring({
  trace,
  evidenceTrace,
  evaluationMatrix,
  controlPlane,
  artifacts = null,
  artifactCatalog: suppliedArtifactCatalog = null,
  statusSummary: suppliedStatusSummary = null,
}) {
  validateAgentPipelineTrace(trace);
  validateEvaluationMatrix(evaluationMatrix);
  assert(evaluationMatrix.traceId === trace.traceId, 'Trace and evaluation matrix IDs do not match.');
  assert(evaluationMatrix.evaluationCaseId === trace.evaluationCaseId,
    'Trace and evaluation matrix case IDs do not match.');
  assert(evidenceTrace?.contractVersion === 'agent_evidence_trace_v1', 'Evidence trace contract is invalid.');
  assert(controlPlane?.contractVersion === 'agent_control_plane_snapshot_v1', 'Control-plane contract is invalid.');
  assert(controlPlane.executionMode === 'evaluation' && controlPlane.productEnabled === false
      && controlPlane.approvalStatus === 'not_approved' && controlPlane.promotionPerformed === false,
  'Monitoring control plane crossed the evaluation-only boundary.');
  validateEvidenceTrace(evidenceTrace);
  validateControlPlane({ trace, evaluationMatrix, controlPlane });
  const spanIds = new Set(trace.spans.map(span => span.spanId));
  for (const row of evaluationMatrix.rows) {
    assert(row.sourceSpanIds.every(spanId => spanIds.has(spanId)),
      `${row.metricId}: evaluation row references an unknown trace span.`);
  }
  const artifactCatalog = artifactCatalogFor(trace,
    suppliedArtifactCatalog?.artifacts ?? artifacts);
  const statusSummary = monitoringStatusSummary({ trace, evaluationMatrix });
  if (suppliedArtifactCatalog != null) {
    assert(sameJson(suppliedArtifactCatalog, artifactCatalog),
      'Monitoring artifact catalog does not match the trace references.');
  }
  if (suppliedStatusSummary != null) {
    assert(sameJson(suppliedStatusSummary, statusSummary),
      'Monitoring execution/gate/quality summary was not recomputed correctly.');
  }
  const monitoring = {
    contractVersion: MONITORING_CONTRACT,
    trace,
    evidenceTrace,
    evaluationMatrix,
    controlPlane,
    artifactCatalog,
    statusSummary,
  };
  assertNoHiddenPayload(monitoring);
  return monitoring;
}

function validateEvidenceTrace(evidenceTrace) {
  assert(evidenceTrace?.contractVersion === 'agent_evidence_trace_v1', 'Evidence trace contract is invalid.');
  const router = evidenceTrace.router;
  assert(plainObject(router), 'Evidence router summary is required.');
  for (const key of ['total', 'routed', 'excluded', 'unresolved']) {
    assert(nonNegativeInteger(router[key]), `Evidence router ${key} is invalid.`);
  }
  assert(router.total === router.routed + router.excluded + router.unresolved,
    'Evidence router dispositions do not add up to the total.');
  const expectedCoverage = router.total === 0 ? 1 : (router.routed + router.excluded) / router.total;
  assert(finite(router.dispositionCoverage) && Math.abs(router.dispositionCoverage - expectedCoverage) < 1e-12,
    'Evidence router disposition coverage is inconsistent.');
  assert(Array.isArray(evidenceTrace.sections), 'Evidence trace sections are required.');
  const sectionIds = new Set();
  for (const section of evidenceTrace.sections) {
    assert(plainObject(section) && hasText(section.sectionId) && !sectionIds.has(section.sectionId),
      'Evidence trace section IDs must be present and unique.');
    sectionIds.add(section.sectionId);
    assert(nonNegativeInteger(section.projectedRecordCount)
        && nonNegativeInteger(section.usedRecordCount) && nonNegativeInteger(section.issueCount),
    `${section.sectionId}: evidence summary counts are invalid.`);
    assert(Array.isArray(section.records) && section.projectedRecordCount === section.records.length,
      `${section.sectionId}: projected evidence count does not match its records.`);
    const recordIds = new Set(section.records.map(record => record.evidenceId));
    assert(recordIds.size === section.records.length && [...recordIds].every(hasText),
      `${section.sectionId}: evidence record IDs must be present and unique.`);
    assert(section.usedRecordCount === section.records.filter(record => record.usedInGeneration === true).length,
      `${section.sectionId}: used evidence count is inconsistent.`);
    assert(section.issueCount === section.records.filter(record => finite(record.issueCount) && record.issueCount > 0).length,
      `${section.sectionId}: issue count is inconsistent.`);
    for (const record of section.records) {
      const inspectableEvidence = record.preview == null || (hasText(record.label) && plainObject(record.preview)
          && typeof record.preview.text === 'string'
          && Array.isArray(record.preview.processedText) && record.preview.processedText.every(item => typeof item === 'string')
          && typeof record.preview.context === 'string'
          && Array.isArray(record.preview.issues) && record.preview.issues.every(item => typeof item === 'string'));
      assert(plainObject(record) && hasText(record.sourceClass) && typeof record.sourcePointer === 'string'
          && inspectableEvidence
          && typeof record.usedInGeneration === 'boolean' && nonNegativeInteger(record.issueCount)
          && (record.generationDisposition == null || hasText(record.generationDisposition)),
      `${section.sectionId}: an evidence trace record is invalid.`);
    }
    const accountability = section.accountability;
    assert(plainObject(accountability) && ['measured', 'not_available', 'not_applicable'].includes(accountability.status)
        && plainObject(accountability.counts),
      `${section.sectionId}: evidence accountability status is invalid.`);
    assert(accountability.total === section.records.length,
      `${section.sectionId}: accountability total does not match its records.`);
    if (accountability.status === 'measured') {
      assert(nonNegativeInteger(accountability.accounted) && accountability.accounted === accountability.total,
        `${section.sectionId}: measured evidence accountability is incomplete.`);
      assert(Object.entries(accountability.counts).every(([key, value]) => hasText(key) && nonNegativeInteger(value))
          && Object.values(accountability.counts).reduce((sum, value) => sum + value, 0) === accountability.accounted,
      `${section.sectionId}: evidence accountability counts are inconsistent.`);
    } else {
      assert(accountability.accounted == null && Object.keys(accountability.counts).length === 0,
        `${section.sectionId}: unavailable accountability must not claim counts.`);
      if (accountability.status === 'not_available') {
        assert(hasText(accountability.reason), `${section.sectionId}: unavailable accountability needs a reason.`);
      }
    }
    assert(Array.isArray(section.claimLinks), `${section.sectionId}: claim links are required.`);
    for (const link of section.claimLinks) {
      assert(plainObject(link) && hasText(link.claimId)
          && Array.isArray(link.sourceRecordIds) && link.sourceRecordIds.every(hasText)
          && Array.isArray(link.routedEvidenceIds) && link.routedEvidenceIds.every(hasText)
          && link.routedEvidenceIds.every(id => recordIds.has(id)),
      `${section.sectionId}: a claim link references evidence outside the section projection.`);
    }
  }
}

function validateControlPlane({ trace, evaluationMatrix, controlPlane }) {
  assert(controlPlane?.contractVersion === 'agent_control_plane_snapshot_v1', 'Control-plane contract is invalid.');
  assert(controlPlane.executionMode === trace.executionMode,
    'Control-plane execution mode does not match the trace.');
  assert(Array.isArray(controlPlane.bindings) && Array.isArray(controlPlane.controls),
    'Control-plane bindings and controls must be arrays.');
  assert(sameJson(controlPlane.outcomes, evaluationMatrix.outcomes),
    'Control-plane outcomes do not match the evaluation matrix.');
  const agentSpans = trace.spans.filter(span => span.actor.kind === 'agent');
  const controlSpans = trace.spans.filter(span => span.actor.kind !== 'agent');
  const expectedBindings = agentSpans.map(span => ({
    spanId: span.spanId,
    sectionId: span.sectionId,
    role: span.actor.role,
    id: span.actor.id,
    releaseVersion: span.actor.releaseVersion,
    manifestSha256: span.actor.manifestSha256,
    configurationId: span.actor.configurationId,
    configurationSha256: span.actor.configurationSha256,
    status: span.status,
  }));
  const expectedControls = controlSpans.map(span => ({
    spanId: span.spanId, role: span.actor.role, id: span.actor.id, status: span.status,
  }));
  assert(sameJson(controlPlane.bindings, expectedBindings),
    'Control-plane release bindings do not match the executed agent spans.');
  assert(sameJson(controlPlane.controls, expectedControls),
    'Control-plane controls do not match the executed control spans.');
  const coverage = controlPlane.monitoringCoverage;
  assert(coverage?.actualAgentSpans === agentSpans.length && coverage.unmonitoredActualAgents === 0,
    'All executed agents must have exactly one monitored span.');
  assertStringArray(coverage.supportedAgentRoles, 'Monitoring supported-agent roles');
  assertStringArray(coverage.notRunInThisCase, 'Monitoring not-run roles');
  const supported = new Set(coverage.supportedAgentRoles);
  const notRun = new Set(coverage.notRunInThisCase);
  const actualRoles = new Set(agentSpans.map(span => span.actor.role));
  assert(supported.size === coverage.supportedAgentRoles.length
      && notRun.size === coverage.notRunInThisCase.length
      && coverage.notRunInThisCase.every(role => supported.has(role) && !actualRoles.has(role))
      && [...actualRoles].every(role => supported.has(role)),
  'Monitoring role coverage does not match the executed agents.');
  const reviewerSpans = trace.spans.filter(span => span.phase === 'pre_display_review');
  if (reviewerSpans.length) {
    const expectedDisplay = reviewerSpans.every(span => span.status === 'passed') ? 'allowed' : 'blocked';
    assert(evaluationMatrix.outcomes.displayDecision === expectedDisplay,
      'Display decision does not match the pre-display reviewer spans.');
  }
}
