import { canonicalSha256 } from './agent-configuration.mjs';

export const ATOMIC_EVALUATION_CASE_CONTRACT = 'atomic_report_evaluation_case_v1';
export const ATOMIC_EVALUATION_MATRIX_CONTRACT = 'atomic_report_evaluation_matrix_v1';

const DATASET_SPLITS = new Set(['development', 'validation', 'hidden_test']);
const UNIT_LAYERS = new Set(['source', 'evidence', 'generated']);
const UNIT_TYPES = new Set([
  'structured_field',
  'measurement_set',
  'observation',
  'limitation',
  'recommendation',
  'scope_item',
  'deterministic_block',
  'format_obligation',
  'cross_reference',
]);
const CRITICALITIES = new Set(['critical', 'required', 'optional']);
const SOURCE_DISPOSITIONS = new Set([
  'required_current_fact',
  'deterministic_content',
  'recommendation_route',
  'cross_reference',
  'gold_structure_reference',
  'boilerplate_metadata',
  'reviewed_out_of_scope',
]);
const LINK_STAGES = new Set(['source_to_mock', 'mock_to_generation']);
const LINK_RELATIONS = new Set([
  'preserves',
  'splits',
  'combines',
  'excluded',
  'supports',
  'partially_supports',
  'contradicts',
  'unused',
  'unsupported_output',
]);
const VERDICTS = new Set(['pass', 'fail', 'not_available', 'not_applicable']);
const GRADER_TYPES = new Set(['deterministic', 'llm', 'human']);
const SHA256 = /^[a-f0-9]{64}$/;

const hasText = value => typeof value === 'string' && value.trim().length > 0;
const plainObject = value => value != null && typeof value === 'object' && !Array.isArray(value);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateContentRef(ref, unitId) {
  assert(plainObject(ref) && hasText(ref.artifactId) && hasText(ref.jsonPointer)
      && SHA256.test(ref.artifactSha256), `${unitId}: content reference is invalid.`);
}

function validateProtectedFact(fact, unitId) {
  assert(plainObject(fact) && hasText(fact.factId) && hasText(fact.key)
      && Object.hasOwn(fact, 'value'), `${unitId}: protected fact is invalid.`);
  assert(fact.unitCode == null || hasText(fact.unitCode), `${unitId}: protected fact unit is invalid.`);
}

function validateUnit(unit, unitIds) {
  assert(plainObject(unit) && hasText(unit.unitId) && !unitIds.has(unit.unitId),
    'Evaluation unit IDs must be present and unique.');
  unitIds.add(unit.unitId);
  assert(UNIT_LAYERS.has(unit.layer), `${unit.unitId}: unit layer is invalid.`);
  assert(UNIT_TYPES.has(unit.unitType), `${unit.unitId}: use a semantic unit type, not an arbitrary text chunk.`);
  assert(hasText(unit.sectionId) && hasText(unit.outlineBlockId) && hasText(unit.semanticKey),
    `${unit.unitId}: section, outline block and semantic key are required.`);
  assert(CRITICALITIES.has(unit.criticality), `${unit.unitId}: criticality is invalid.`);
  assert(SHA256.test(unit.contentSha256), `${unit.unitId}: content SHA-256 is invalid.`);
  validateContentRef(unit.contentRef, unit.unitId);
  assert(Array.isArray(unit.protectedFacts), `${unit.unitId}: protected facts must be an array.`);
  unit.protectedFacts.forEach(fact => validateProtectedFact(fact, unit.unitId));
  if (unit.layer === 'source') {
    assert(SOURCE_DISPOSITIONS.has(unit.disposition), `${unit.unitId}: source disposition is invalid.`);
    assert(typeof unit.requiredInMock === 'boolean', `${unit.unitId}: requiredInMock is required.`);
  } else {
    assert(unit.disposition == null && unit.requiredInMock == null,
      `${unit.unitId}: source-only fields are prohibited on ${unit.layer} units.`);
  }
  if (unit.layer === 'evidence') {
    assert(typeof unit.generationEligible === 'boolean',
      `${unit.unitId}: evidence generation eligibility is required.`);
    assert(hasText(unit.captureChannel), `${unit.unitId}: evidence capture channel is required.`);
  } else {
    assert(unit.generationEligible == null && unit.captureChannel == null,
      `${unit.unitId}: evidence-only fields are prohibited on ${unit.layer} units.`);
  }
  if (unit.layer === 'generated') {
    assert(hasText(unit.claimType), `${unit.unitId}: generated claim type is required.`);
  } else {
    assert(unit.claimType == null, `${unit.unitId}: claimType is generated-unit only.`);
  }
}

function validateGrader(grader, linkId) {
  assert(plainObject(grader) && GRADER_TYPES.has(grader.type)
      && hasText(grader.id) && hasText(grader.version)
      && SHA256.test(grader.configurationSha256),
  `${linkId}: grader identity and configuration are required.`);
}

function validateLink(link, unitsById, linkIds) {
  assert(plainObject(link) && hasText(link.linkId) && !linkIds.has(link.linkId),
    'Evaluation link IDs must be present and unique.');
  linkIds.add(link.linkId);
  assert(LINK_STAGES.has(link.stage) && LINK_RELATIONS.has(link.relation)
      && VERDICTS.has(link.verdict), `${link.linkId}: link stage, relation or verdict is invalid.`);
  assert(Array.isArray(link.fromUnitIds) && Array.isArray(link.toUnitIds),
    `${link.linkId}: from/to unit IDs must be arrays.`);
  assert(new Set(link.fromUnitIds).size === link.fromUnitIds.length
      && new Set(link.toUnitIds).size === link.toUnitIds.length,
  `${link.linkId}: duplicate unit references are prohibited.`);
  const from = link.fromUnitIds.map(id => unitsById.get(id));
  const to = link.toUnitIds.map(id => unitsById.get(id));
  assert(from.every(Boolean) && to.every(Boolean), `${link.linkId}: link references an unknown unit.`);

  if (link.stage === 'source_to_mock') {
    assert(from.length > 0 && from.every(unit => unit.layer === 'source')
        && to.every(unit => unit.layer === 'evidence'),
    `${link.linkId}: source-to-mock links must run from source units to evidence units.`);
    assert(link.relation === 'excluded' ? to.length === 0 : to.length > 0,
      `${link.linkId}: only reviewed exclusions may have no evidence target.`);
  } else {
    assert(from.every(unit => unit.layer === 'evidence')
        && to.every(unit => unit.layer === 'generated'),
    `${link.linkId}: mock-to-generation links must run from evidence units to generated units.`);
    if (link.relation === 'unsupported_output') {
      assert(from.length === 0 && to.length > 0,
        `${link.linkId}: unsupported output must identify generated units without evidence.`);
    } else if (link.relation === 'unused') {
      assert(from.length > 0 && to.length === 0,
        `${link.linkId}: unused evidence must identify evidence without generated units.`);
    } else {
      assert(from.length > 0 && to.length > 0,
        `${link.linkId}: support links need evidence and generated units.`);
    }
  }
  validateGrader(link.grader, link.linkId);
  assert(hasText(link.explanation), `${link.linkId}: human-readable explanation is required.`);
}

export function validateAtomicEvaluationCase(evaluationCase) {
  assert(plainObject(evaluationCase)
      && evaluationCase.contractVersion === ATOMIC_EVALUATION_CASE_CONTRACT,
  'Atomic evaluation case contract is invalid.');
  assert(hasText(evaluationCase.caseId) && hasText(evaluationCase.lineageId)
      && DATASET_SPLITS.has(evaluationCase.datasetSplit),
  'Case ID, lineage and dataset split are required.');
  assert(plainObject(evaluationCase.section)
      && hasText(evaluationCase.section.profileId)
      && hasText(evaluationCase.section.sectionId)
      && hasText(evaluationCase.section.title),
  'Section identity is incomplete.');
  assert(evaluationCase.segmentationPolicy === 'semantic_obligation_v1',
    'Only semantic-obligation segmentation is supported.');
  assert(Array.isArray(evaluationCase.agentConfigurationRefs)
      && evaluationCase.agentConfigurationRefs.length > 0,
  'Agent configuration references are required.');
  for (const ref of evaluationCase.agentConfigurationRefs) {
    assert(plainObject(ref) && hasText(ref.role) && hasText(ref.configurationId)
        && SHA256.test(ref.configurationSha256),
    'Agent configuration reference is invalid.');
  }
  assert(Array.isArray(evaluationCase.units) && evaluationCase.units.length > 0,
    'Evaluation units are required.');
  const unitIds = new Set();
  evaluationCase.units.forEach(unit => validateUnit(unit, unitIds));
  const unitsById = new Map(evaluationCase.units.map(unit => [unit.unitId, unit]));
  assert(Array.isArray(evaluationCase.links), 'Evaluation links are required.');
  const linkIds = new Set();
  evaluationCase.links.forEach(link => validateLink(link, unitsById, linkIds));
  const layers = new Set(evaluationCase.units.map(unit => unit.layer));
  assert(['source', 'evidence', 'generated'].every(layer => layers.has(layer)),
    'Source, evidence and generated unit layers are all required.');
  assert(plainObject(evaluationCase.sectionAssessment),
    'Whole-section assessment is required as a separate layer.');
  for (const key of ['format', 'coherence']) {
    const assessment = evaluationCase.sectionAssessment[key];
    assert(plainObject(assessment) && VERDICTS.has(assessment.verdict)
        && hasText(assessment.explanation), `Section ${key} assessment is invalid.`);
    validateGrader(assessment.grader, `section.${key}`);
  }
  assert(SHA256.test(evaluationCase.caseSha256), 'Case SHA-256 is invalid.');
  const { caseSha256: _ignored, ...payload } = evaluationCase;
  assert(evaluationCase.caseSha256 === canonicalSha256(payload),
    'Case SHA-256 does not match its content.');
  return evaluationCase;
}

function metric({ metricId, label, classification, numerator = null, denominator = null,
  status, explanation, unitIds = [] }) {
  return { metricId, label, classification, numerator, denominator, status, explanation, unitIds };
}

function coverageStatus(numerator, denominator) {
  if (denominator === 0) return 'not_applicable';
  return numerator === denominator ? 'pass' : 'fail';
}

export function buildAtomicEvaluationMatrix(evaluationCase) {
  validateAtomicEvaluationCase(evaluationCase);
  const units = evaluationCase.units;
  const sourceUnits = units.filter(unit => unit.layer === 'source');
  const evidenceUnits = units.filter(unit => unit.layer === 'evidence');
  const generatedUnits = units.filter(unit => unit.layer === 'generated');
  const stageA = evaluationCase.links.filter(link => link.stage === 'source_to_mock');
  const stageB = evaluationCase.links.filter(link => link.stage === 'mock_to_generation');

  const dispositioned = sourceUnits.filter(unit =>
    stageA.some(link => link.fromUnitIds.includes(unit.unitId))).length;
  const requiredSource = sourceUnits.filter(unit => unit.requiredInMock);
  const coveredSource = requiredSource.filter(unit => stageA.some(link =>
    link.fromUnitIds.includes(unit.unitId)
      && link.toUnitIds.length > 0
      && link.verdict === 'pass'
      && link.relation !== 'excluded'));

  const requiredEvidence = evidenceUnits.filter(unit => unit.generationEligible);
  const usedEvidence = requiredEvidence.filter(unit => stageB.some(link =>
    link.fromUnitIds.includes(unit.unitId)
      && link.toUnitIds.length > 0
      && link.verdict === 'pass'
      && ['supports', 'partially_supports'].includes(link.relation)));

  const supportedGenerated = generatedUnits.filter(unit => stageB.some(link =>
    link.toUnitIds.includes(unit.unitId)
      && link.fromUnitIds.length > 0
      && link.verdict === 'pass'
      && ['supports', 'partially_supports'].includes(link.relation)));

  const protectedSourceFacts = requiredSource.flatMap(unit =>
    unit.protectedFacts.map(fact => ({ unit, fact })));
  let protectedMatches = 0;
  for (const { unit, fact } of protectedSourceFacts) {
    const evidenceIds = stageA.filter(link => link.fromUnitIds.includes(unit.unitId)
      && link.verdict === 'pass').flatMap(link => link.toUnitIds);
    const generatedIds = stageB.filter(link => link.fromUnitIds.some(id => evidenceIds.includes(id))
      && link.verdict === 'pass').flatMap(link => link.toUnitIds);
    const candidates = units.filter(candidate => generatedIds.includes(candidate.unitId))
      .flatMap(candidate => candidate.protectedFacts);
    if (candidates.some(candidate => candidate.factId === fact.factId
        && candidate.key === fact.key
        && candidate.unitCode === fact.unitCode
        && JSON.stringify(candidate.value) === JSON.stringify(fact.value))) {
      protectedMatches += 1;
    }
  }

  const semanticLinks = [...stageA, ...stageB].filter(link =>
    link.relation !== 'excluded' && link.relation !== 'unused');
  const semanticUnavailable = semanticLinks.some(link => link.verdict === 'not_available');
  const semanticFailed = semanticLinks.some(link => link.verdict === 'fail');
  const semanticStatus = semanticFailed ? 'fail' : semanticUnavailable ? 'not_available'
    : semanticLinks.length ? 'pass' : 'not_applicable';

  const rows = [
    metric({
      metricId: 'mock.source_unit_disposition_coverage',
      label: 'Source-unit disposition coverage',
      classification: 'hard_gate',
      numerator: dispositioned,
      denominator: sourceUnits.length,
      status: coverageStatus(dispositioned, sourceUnits.length),
      explanation: `${dispositioned}/${sourceUnits.length} source units have reviewed source-to-mock dispositions.`,
      unitIds: sourceUnits.map(unit => unit.unitId),
    }),
    metric({
      metricId: 'mock.required_source_to_evidence_coverage',
      label: 'Required source-to-evidence coverage',
      classification: 'hard_gate',
      numerator: coveredSource.length,
      denominator: requiredSource.length,
      status: coverageStatus(coveredSource.length, requiredSource.length),
      explanation: `${coveredSource.length}/${requiredSource.length} required source units map to verified app evidence.`,
      unitIds: requiredSource.map(unit => unit.unitId),
    }),
    metric({
      metricId: 'generation.evidence_to_claim_coverage',
      label: 'Generation evidence coverage',
      classification: 'quality',
      numerator: usedEvidence.length,
      denominator: requiredEvidence.length,
      status: coverageStatus(usedEvidence.length, requiredEvidence.length),
      explanation: `${usedEvidence.length}/${requiredEvidence.length} generation-eligible evidence units support generated claims.`,
      unitIds: requiredEvidence.map(unit => unit.unitId),
    }),
    metric({
      metricId: 'generation.supported_claim_precision',
      label: 'Supported generated-claim precision',
      classification: 'hard_gate',
      numerator: supportedGenerated.length,
      denominator: generatedUnits.length,
      status: coverageStatus(supportedGenerated.length, generatedUnits.length),
      explanation: `${supportedGenerated.length}/${generatedUnits.length} generated claims have verified current-evidence support.`,
      unitIds: generatedUnits.map(unit => unit.unitId),
    }),
    metric({
      metricId: 'generation.protected_fact_accuracy',
      label: 'Protected fact accuracy',
      classification: 'hard_gate',
      numerator: protectedMatches,
      denominator: protectedSourceFacts.length,
      status: coverageStatus(protectedMatches, protectedSourceFacts.length),
      explanation: `${protectedMatches}/${protectedSourceFacts.length} protected source facts are exactly preserved in generated claims.`,
      unitIds: protectedSourceFacts.map(item => item.unit.unitId),
    }),
    metric({
      metricId: 'generation.semantic_recovery',
      label: 'Semantic recovery',
      classification: 'quality',
      status: semanticStatus,
      explanation: semanticStatus === 'not_available'
        ? 'One or more semantic links await a calibrated LLM or human judge.'
        : semanticStatus === 'fail'
          ? 'At least one semantic mapping failed.'
          : 'All applicable semantic mappings passed.',
      unitIds: [...new Set(semanticLinks.flatMap(link => [...link.fromUnitIds, ...link.toUnitIds]))],
    }),
    ...['format', 'coherence'].map(key => metric({
      metricId: `section.${key}`,
      label: `Whole-section ${key}`,
      classification: 'quality',
      status: evaluationCase.sectionAssessment[key].verdict,
      explanation: evaluationCase.sectionAssessment[key].explanation,
      unitIds: generatedUnits.map(unit => unit.unitId),
    })),
  ];
  const hardGates = rows.filter(row => row.classification === 'hard_gate');
  const qualification = hardGates.some(row => row.status === 'fail') ? 'blocked'
    : hardGates.some(row => row.status === 'not_available') ? 'incomplete'
      : 'eligible_for_human_review';
  return {
    contractVersion: ATOMIC_EVALUATION_MATRIX_CONTRACT,
    caseId: evaluationCase.caseId,
    lineageId: evaluationCase.lineageId,
    sectionId: evaluationCase.section.sectionId,
    qualification,
    rows,
    matrixSha256: canonicalSha256(rows),
  };
}

export function freezeAtomicEvaluationCase(input) {
  const evaluationCase = {
    contractVersion: ATOMIC_EVALUATION_CASE_CONTRACT,
    ...structuredClone(input),
  };
  const { caseSha256: _ignored, ...payload } = evaluationCase;
  evaluationCase.caseSha256 = canonicalSha256(payload);
  validateAtomicEvaluationCase(evaluationCase);
  return Object.freeze(evaluationCase);
}
