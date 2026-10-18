import { createHash, randomUUID } from 'node:crypto';

export const EVALUATOR_ID = 'general-tank-information-evaluator-candidate-b';
export const GENERATOR_ID = 'general-tank-information-generator-candidate-b';
export const REVIEWER_ID = 'general-tank-information-reviewer-candidate-b';
export const SECTION_ID = 'general-tank-information';

const canonical = (value) => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
const sha256 = (value) => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

function validateExecution(execution) {
  if (!execution || execution.contractVersion !== 'package_bound_section_gold_evaluation_execution_v1'
      || execution.executionMode !== 'evaluation') throw new Error('Unsupported package-bound gold evaluation execution.');
  const generated = execution.generationResult;
  const review = execution.preDisplayReview;
  const gold = execution.goldPacket;
  if (generated?.candidate?.generatorId !== GENERATOR_ID || generated?.section?.sectionId !== SECTION_ID
      || review?.reviewer?.reviewerId !== REVIEWER_ID || review?.decision !== 'ready_for_review'
      || review?.userVisibility !== 'allowed') throw new Error('Gold evaluation requires the exact passed candidate pair.');
  if (!gold || gold.contractVersion !== 'sealed_general_information_gold_v1'
      || gold.sectionId !== SECTION_ID || !Array.isArray(gold.expectedFields)
      || !gold.sourceReportId || !gold.openedAfterGenerationAtIso) throw new Error('A sealed structured gold packet is required.');
  const copy = structuredClone(gold);
  delete copy.goldPacketSha256;
  if (sha256(copy) !== gold.goldPacketSha256) throw new Error('Gold packet hash does not match.');
  const generatedAt = Date.parse(generated.trace?.generatedAtIso ?? '');
  const openedAt = Date.parse(gold.openedAfterGenerationAtIso);
  if (!Number.isFinite(generatedAt) || !Number.isFinite(openedAt) || openedAt < generatedAt) {
    throw new Error('Gold must open after generation.');
  }
  if ((generated.trace?.retrievalKeys ?? []).includes(gold.sourceReportId)) throw new Error('Gold source appeared in generation retrieval.');
  if (review.trace?.generationResultSha256 !== sha256(generated)) {
    throw new Error('Generated output changed after pre-display review.');
  }
}

export function evaluateGeneralTankInformation(execution) {
  validateExecution(execution);
  const generated = execution.generationResult;
  const observed = new Map([
    ...(generated.evaluationEvidence?.fields ?? []),
    ...(generated.evaluationEvidence?.headerMetadata ?? []),
    ...(generated.evaluationEvidence?.supportingEvidence ?? []),
  ].map((field) => [field.key, field]));
  const rows = execution.goldPacket.expectedFields.map((expected) => {
    const actual = observed.get(expected.key);
    const pass = Boolean(actual) && normalize(actual.value) === normalize(expected.value);
    return { key: expected.key, expectedValue: expected.value, actualValue: actual?.value ?? null,
      status: pass ? 'pass' : 'fail', sourceEvidenceIds: actual?.sourceEvidenceIds ?? [] };
  });
  const protectedFieldAccuracy = rows.length ? rows.filter((row) => row.status === 'pass').length / rows.length : 0;
  const unsupportedClaims = (generated.evaluationEvidence?.fields ?? []).filter((field) => field.state === 'supplied'
    && !field.sourceEvidenceIds.length).map((field) => field.key);
  const reviewChecks = execution.preDisplayReview.checks ?? {};
  const structuralChecks = {
    exactTitle: reviewChecks.exactTitle === true,
    pairedFieldTables: reviewChecks.formatValid === true,
    bodyFieldCount: reviewChecks.observedBodyFieldCount === reviewChecks.protectedBodyFieldCount,
    evidenceDispositionCoverage: reviewChecks.dispositionCount === reviewChecks.projectedEvidenceCount,
    evidenceGrounded: reviewChecks.evidenceGrounded === true,
    knowledgeBoundary: reviewChecks.knowledgeBoundaryValid === true,
  };
  const structuralFormatAlignment = Object.values(structuralChecks).every(Boolean) ? 1 : 0;
  const wholeSectionCoherence = execution.preDisplayReview.blockers.length === 0
    && execution.preDisplayReview.decision === 'ready_for_review' ? 1 : 0;
  const decision = protectedFieldAccuracy === 1 && unsupportedClaims.length === 0
    && structuralFormatAlignment === 1 && wholeSectionCoherence === 1 ? 'pass' : 'blocked';
  return {
    contractVersion: 'package_bound_section_gold_evaluation_result_v1',
    evaluator: { evaluatorId: EVALUATOR_ID, candidateId: generated.candidate.candidateId },
    sectionId: SECTION_ID,
    status: 'completed',
    decision,
    scores: {
      protectedFieldAccuracy,
      expectedFieldRecall: rows.length ? rows.filter((row) => observed.has(row.key)).length / rows.length : 0,
      supportedClaimPrecision: unsupportedClaims.length ? 0 : 1,
      structuralFormatAlignment,
      wholeSectionCoherence,
      renderedFormatAlignment: null,
      inspectorAcceptance: null,
    },
    atomicRows: rows.map((row) => ({
      unitId: `general-tank-information.field.${row.key}`,
      unitType: 'structured_field',
      ...row,
    })),
    fieldRows: rows,
    sectionAssessment: {
      structure: {
        status: structuralFormatAlignment === 1 ? 'pass' : 'fail',
        grader: 'deterministic_pre_display_review',
        checks: structuralChecks,
        explanation: structuralFormatAlignment === 1
          ? 'The exact title, paired-field layout, body count, evidence dispositions and knowledge boundary passed.'
          : 'One or more whole-section structural checks failed.',
      },
      coherence: {
        status: wholeSectionCoherence === 1 ? 'pass' : 'fail',
        grader: 'deterministic_pre_display_review',
        explanation: wholeSectionCoherence === 1
          ? 'The structured section is internally consistent and passed the independent no-gold reviewer.'
          : 'The independent no-gold reviewer found a whole-section blocker.',
      },
      renderedComparison: {
        status: 'not_measured',
        grader: 'human',
        explanation: 'Rendered comparison with the historical source remains a separate human qualification gate.',
      },
      inspectorAcceptance: {
        status: 'not_measured',
        grader: 'inspector',
        explanation: 'Inspector acceptance remains required before release qualification.',
      },
    },
    unsupportedClaims,
    qualificationStatus: decision === 'pass' ? 'automated_gates_passed_human_gates_pending' : 'blocked',
    diagnostics: ['Atomic field checks and automated whole-section checks completed. Rendered comparison and inspector acceptance remain separate qualification gates.'],
    trace: {
      evaluationRunId: randomUUID(),
      evaluatedAtIso: new Date().toISOString(),
      generationRunId: generated.trace.generationRunId,
      goldSourceId: execution.goldPacket.sourceReportId,
      goldPacketSha256: execution.goldPacket.goldPacketSha256,
      goldOpenedAfterGeneration: true,
      liveModelUsed: false,
      providerCode: 'deterministic',
      modelId: null,
    },
  };
}

export const __test = { sha256 };

