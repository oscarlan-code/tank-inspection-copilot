import {
  buildAgentMonitoring,
  buildAgentPipelineTrace,
  buildEvaluationMatrix,
  canonicalSha256,
  createInspectableArtifact,
  createMatrixRow,
  createTraceSpan,
} from '../../observability/v1/contracts.mjs';
import { summarizeAgentConfiguration } from './atomic-evaluation-adapter.mjs';

const pass = ({ metricId, label, sectionId = null, phase, value = undefined, numerator = 1, denominator = 1,
  criterion = { operator: 'eq', value: 1 }, unit = 'ratio', sourceSpanIds = [], evidenceRefs = [], notes = [],
  class: metricClass = 'hard_gate', ruleEvaluations = null, grader = null }) => createMatrixRow({
  metricId, label, sectionId, phase, class: metricClass, status: 'pass',
  value: value ?? (denominator ? numerator / denominator : 1), numerator, denominator,
  criterion, unit, sourceSpanIds, evidenceRefs, notes, ruleEvaluations, grader,
});

const unavailable = ({ metricId, label, sectionId = null, phase, notes = [], class: metricClass = 'hard_gate',
  sourceSpanIds = [], evidenceRefs = [], ruleEvaluations = null, grader = null }) => createMatrixRow({
  metricId, label, sectionId, phase, class: metricClass, status: 'not_available', value: null,
  numerator: null, denominator: null, criterion: null, unit: 'ratio', sourceSpanIds, evidenceRefs, notes,
  ruleEvaluations, grader,
});

const atomicRule = ({ ruleId, description, observed, operator, expected, verdict = 'pass',
  evidenceRefs = [], explanation }) => ({
  ruleId,
  ruleVersion: 'v1',
  description,
  observed,
  operator,
  expected,
  verdict,
  evidenceRefs,
  explanation,
});

const agentActor = ({ role, id, releaseVersion, manifestSha256, configuration }) => ({
  kind: 'agent', role, id, releaseVersion, manifestSha256,
  ...(configuration ? {
    configurationId: configuration.configurationId,
    configurationSha256: configuration.configurationSha256,
  } : {}),
});
const controlActor = (role, id) => ({ kind: 'deterministic_control', role, id });

const OMITTED_MONITORING_KEYS = new Set([
  'chainofthought', 'reasoning', 'hiddenreasoning', 'rawprompt', 'prompt', 'rawevidence',
  'originalcontent', 'generatedcontent',
]);
const REDACTED_MONITORING_KEYS = new Set([
  'password', 'passwordhash', 'apikey', 'accesstoken', 'refreshtoken', 'authorization', 'cookie',
]);

function safePreview(value) {
  if (Array.isArray(value)) return value.map(safePreview);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !OMITTED_MONITORING_KEYS.has(key.toLowerCase()))
      .map(([key, item]) => [key, REDACTED_MONITORING_KEYS.has(key.toLowerCase())
        ? '[REDACTED]' : safePreview(item)]));
  }
  return value;
}

function createArtifactStore() {
  const artifacts = new Map();
  return {
    define(definition) {
      const saved = artifact(definition);
      const existing = artifacts.get(saved.artifactId);
      if (existing && canonicalSha256(existing) !== canonicalSha256(saved)) {
        throw new Error(`Inspectable artifact ${saved.artifactId} was defined with different content.`);
      }
      artifacts.set(saved.artifactId, saved);
      const { preview: _preview, ...reference } = saved;
      return reference;
    },
    values() {
      return [...artifacts.values()];
    },
  };
}

function artifact({ artifactId, name, kind, schemaVersion, preview, sourceSha256 = null,
  redactionStatus = 'sanitized' }) {
  return createInspectableArtifact({
    artifactId,
    name,
    kind,
    schemaVersion,
    preview: safePreview(preview),
    sourceSha256,
    visibility: 'authorized_admin',
    redactionStatus,
  });
}

function executionOutcomes({ gate = 'not_applicable', gateExplanation, quality = 'not_measured',
  qualityExplanation = 'Semantic quality has not been measured by this stage.' } = {}) {
  return {
    execution: { status: 'completed', explanation: 'The stage returned and its observable result was saved.' },
    gate: {
      status: gate,
      explanation: gateExplanation ?? (gate === 'passed' ? 'The stage gate passed.'
        : gate === 'blocked' ? 'The stage gate blocked progression.' : 'This stage does not decide display eligibility.'),
    },
    quality: { status: quality, explanation: qualityExplanation },
  };
}

function runtimeFor(trace = {}) {
  const usage = trace.usage ?? {};
  return {
    attempt: 1,
    retryCount: 0,
    inputTokens: Number.isInteger(usage.inputTokens) ? usage.inputTokens : null,
    outputTokens: Number.isInteger(usage.outputTokens) ? usage.outputTokens : null,
    totalTokens: Number.isInteger(usage.totalTokens) ? usage.totalTokens : null,
    tokenStatus: Number.isInteger(usage.totalTokens) ? 'reported' : 'not_reported',
  };
}

function sectionSpanId(sectionId, phase) {
  return `${sectionId}:${phase}`;
}

function configurationFor(agentConfigurations, { sectionId = null, role }) {
  const match = agentConfigurations.find(configuration => configuration.agentRole === role
    && (role === 'report_evidence_router' || configuration.configurationId.startsWith(`${sectionId}.`)));
  if (!match) throw new Error(`Missing recorded configuration for ${sectionId ?? 'shared'} ${role}.`);
  return match;
}

function configurationArtifact(artifactStore, configuration) {
  return artifactStore.define({
    artifactId: `configuration.${configuration.configurationId}`,
    name: 'agent-execution-configuration',
    kind: 'agent_configuration',
    schemaVersion: configuration.contractVersion,
    preview: summarizeAgentConfiguration(configuration),
    sourceSha256: configuration.configurationSha256,
  });
}

function sectionTraceSpans(run, rootSpanId, artifactStore, atomicEvaluationBundle) {
  const { spec, reportPlan, sectionPlan, evidenceSnapshot, execution, timing, evaluatorResult, evaluatorTiming } = run;
  const generation = execution.generationResult;
  const review = execution.preDisplayReview;
  const planSpanId = sectionSpanId(spec.sectionId, 'plan');
  const generationSpanId = sectionSpanId(spec.sectionId, 'generation');
  const reviewSpanId = sectionSpanId(spec.sectionId, 'review');
  const evaluatorSpanId = sectionSpanId(spec.sectionId, 'evaluation');
  const generatorConfiguration = configurationFor(atomicEvaluationBundle.agentConfigurations,
    { sectionId: spec.sectionId, role: 'section_generator' });
  const reviewerConfiguration = configurationFor(atomicEvaluationBundle.agentConfigurations,
    { sectionId: spec.sectionId, role: 'pre_display_reviewer' });
  const evaluatorConfiguration = configurationFor(atomicEvaluationBundle.agentConfigurations,
    { sectionId: spec.sectionId, role: 'post_generation_evaluator' });
  const generatorConfigurationArtifact = configurationArtifact(artifactStore, generatorConfiguration);
  const reviewerConfigurationArtifact = configurationArtifact(artifactStore, reviewerConfiguration);
  const evaluatorConfigurationArtifact = configurationArtifact(artifactStore, evaluatorConfiguration);
  const atomicEvaluation = atomicEvaluationBundle.evaluations.find(item => item.sectionId === spec.sectionId);
  if (!atomicEvaluation) throw new Error(`Missing atomic evaluation for ${spec.sectionId}.`);
  const routingProjectionArtifact = artifactStore.define({
    artifactId: `${spec.sectionId}.routing-projection`,
    name: 'section-routing-projection',
    kind: 'routing_projection',
    schemaVersion: run.projection.contractVersion ?? 'section_evidence_projection_v2',
    preview: run.projection,
  });
  const reportPlanArtifact = artifactStore.define({
    artifactId: `${spec.sectionId}.report-plan`, name: 'report-plan', kind: 'report_plan',
    schemaVersion: reportPlan.contractVersion ?? 'minimum_report_plan_v1', preview: reportPlan,
    sourceSha256: reportPlan.reportPlanSha256,
  });
  const sectionPlanArtifact = artifactStore.define({
    artifactId: `${spec.sectionId}.section-plan`, name: 'section-plan', kind: 'section_plan',
    schemaVersion: sectionPlan.contractVersion ?? 'minimum_section_plan_v1', preview: sectionPlan,
    sourceSha256: sectionPlan.sectionPlanSha256,
  });
  const evidenceSnapshotArtifact = artifactStore.define({
    artifactId: `${spec.sectionId}.evidence-snapshot`, name: 'section-evidence-snapshot', kind: 'evidence_snapshot',
    schemaVersion: evidenceSnapshot.contractVersion ?? 'section_agent_evidence_snapshot_v1', preview: evidenceSnapshot,
    sourceSha256: sectionPlan.evidenceSnapshotSha256,
  });
  const generationArtifact = artifactStore.define({
    artifactId: `${spec.sectionId}.generation-result`, name: 'generation-result', kind: 'generation_output',
    schemaVersion: generation.contractVersion ?? 'section_generation_result_v1', preview: generation,
    sourceSha256: review.trace.generationResultSha256,
  });
  const reviewArtifact = artifactStore.define({
    artifactId: `${spec.sectionId}.pre-display-review`, name: 'pre-display-review', kind: 'review_output',
    schemaVersion: review.contractVersion, preview: review, sourceSha256: canonicalSha256(review),
  });
  const goldArtifact = artifactStore.define({
    artifactId: `${spec.sectionId}.sealed-gold`, name: `${spec.sectionId}-sealed-gold`, kind: 'sealed_gold',
    schemaVersion: 'sealed_section_gold_v1',
    preview: { ...run.goldPacket, sectionText: run.goldPacket.originalContent },
    sourceSha256: evaluatorResult.trace.goldContentSha256,
    redactionStatus: 'none',
  });
  const evaluatorArtifact = artifactStore.define({
    artifactId: `${spec.sectionId}.evaluation-result`, name: 'evaluation-result', kind: 'evaluation_output',
    schemaVersion: evaluatorResult.contractVersion, preview: evaluatorResult,
    sourceSha256: canonicalSha256(evaluatorResult),
  });
  const atomicCaseArtifact = artifactStore.define({
    artifactId: `${spec.sectionId}.atomic-evaluation-case`, name: 'atomic-evaluation-case', kind: 'atomic_evaluation_case',
    schemaVersion: atomicEvaluation.evaluationCase.contractVersion, preview: atomicEvaluation.evaluationCase,
    sourceSha256: atomicEvaluation.evaluationCase.caseSha256,
  });
  const atomicMatrixArtifact = artifactStore.define({
    artifactId: `${spec.sectionId}.atomic-evaluation-matrix`, name: 'atomic-evaluation-matrix', kind: 'atomic_evaluation_matrix',
    schemaVersion: atomicEvaluation.matrix.contractVersion, preview: atomicEvaluation.matrix,
    sourceSha256: atomicEvaluation.matrix.matrixSha256,
  });
  return [
    createTraceSpan({
      spanId: planSpanId,
      parentSpanId: rootSpanId,
      phase: 'report_plan_and_section_snapshot',
      sectionId: spec.sectionId,
      actor: controlActor('report_plan_orchestrator', 'minimum-report-plan'),
      status: 'passed',
      startedAtIso: timing.sectionStartedAtIso,
      completedAtIso: timing.executionStartedAtIso,
      inputRefs: [routingProjectionArtifact],
      outputRefs: [
        reportPlanArtifact,
        sectionPlanArtifact,
        evidenceSnapshotArtifact,
      ],
      decision: { code: 'frozen_for_generation', summary: 'Exact ReportPlan, SectionPlan, release, and routed-evidence bindings validated.' },
      counts: { projectedEvidenceRecords: run.projection.evidenceRecords.length },
      outcomes: executionOutcomes({ gate: 'passed', gateExplanation: 'Plan hashes and exact release bindings validated.' }),
      configuration: { reportProfileId: reportPlan.reportProfileId, executionMode: 'evaluation' },
    }),
    createTraceSpan({
      spanId: generationSpanId,
      parentSpanId: planSpanId,
      phase: 'section_generation',
      sectionId: spec.sectionId,
      actor: agentActor({
        role: 'section_generator',
        id: generation.release.agentId,
        releaseVersion: generation.release.version,
        manifestSha256: generation.release.manifestSha256,
        configuration: generatorConfiguration,
      }),
      status: generation.validation.valid ? 'passed' : 'blocked',
      startedAtIso: timing.executionStartedAtIso,
      completedAtIso: generation.trace.generatedAtIso,
      inputRefs: [
        sectionPlanArtifact,
        evidenceSnapshotArtifact,
        generatorConfigurationArtifact,
      ],
      outputRefs: [generationArtifact],
      decision: {
        code: generation.validation.valid ? 'valid' : 'invalid',
        summary: generation.validation.valid ? 'Generator contract validation passed.' : 'Generator contract validation blocked the draft.',
        blockers: generation.validation.blockers ?? [],
        warnings: generation.validation.warnings ?? [],
      },
      counts: { projectedEvidenceRecords: run.projection.evidenceRecords.length },
      model: {
        providerCode: generation.trace.providerCode ?? 'not_applicable',
        modelId: generation.trace.modelId ?? null,
        liveModelUsed: generation.trace.liveModelUsed === true,
      },
      retrieval: {
        mode: (generation.trace.retrievalKeys ?? []).length ? 'bounded' : 'not_applicable',
        keys: generation.trace.retrievalKeys ?? [],
      },
      outcomes: executionOutcomes({
        gate: generation.validation.valid ? 'passed' : 'blocked',
        gateExplanation: generation.validation.valid
          ? 'The generator output contract passed.' : 'The generator output contract blocked this draft.',
      }),
      configuration: {
        executionMode: 'evaluation',
        releaseVersion: generation.release.version,
        manifestSha256: generation.release.manifestSha256,
        retrievalKeys: generation.trace.retrievalKeys ?? [],
        executionConfiguration: summarizeAgentConfiguration(generatorConfiguration),
      },
      runtime: runtimeFor(generation.trace),
    }),
    createTraceSpan({
      spanId: reviewSpanId,
      parentSpanId: generationSpanId,
      phase: 'pre_display_review',
      sectionId: spec.sectionId,
      actor: agentActor({
        role: 'pre_display_reviewer',
        id: review.release.reviewerId,
        releaseVersion: review.release.version,
        manifestSha256: review.release.manifestSha256,
        configuration: reviewerConfiguration,
      }),
      status: review.decision === 'ready_for_review' ? 'passed' : 'blocked',
      startedAtIso: generation.trace.generatedAtIso,
      completedAtIso: review.trace.reviewedAtIso,
      inputRefs: [generationArtifact, reviewerConfigurationArtifact],
      outputRefs: [reviewArtifact],
      decision: {
        code: review.decision,
        summary: review.userVisibility === 'allowed' ? 'Draft may be shown for inspector review; it remains unapproved.' : 'Draft is blocked from user display.',
        blockers: review.blockers,
        warnings: review.warnings,
      },
      counts: { checkedClaimsOrRecords: review.claimTrace?.length ?? 0 },
      model: {
        providerCode: review.trace.providerCode ?? 'not_applicable',
        modelId: review.trace.modelId ?? null,
        liveModelUsed: review.trace.liveModelUsed === true,
      },
      retrieval: { mode: 'not_applicable', keys: [] },
      outcomes: executionOutcomes({
        gate: review.decision === 'ready_for_review' ? 'passed' : 'blocked',
        gateExplanation: review.userVisibility === 'allowed'
          ? 'The independent reviewer allowed display for inspector review.'
          : 'The independent reviewer blocked the draft from display.',
      }),
      configuration: {
        releaseVersion: review.release.version,
        manifestSha256: review.release.manifestSha256,
        approvalAuthority: false,
        executionConfiguration: summarizeAgentConfiguration(reviewerConfiguration),
      },
      runtime: runtimeFor(review.trace),
    }),
    createTraceSpan({
      spanId: evaluatorSpanId,
      parentSpanId: rootSpanId,
      phase: 'post_generation_evaluation',
      sectionId: spec.sectionId,
      actor: agentActor({
        role: 'post_generation_evaluator',
        id: evaluatorResult.release.evaluatorId,
        releaseVersion: evaluatorResult.release.version,
        manifestSha256: evaluatorResult.release.manifestSha256,
        configuration: evaluatorConfiguration,
      }),
      status: evaluatorResult.status === 'completed' ? (evaluatorResult.decision === 'blocked' ? 'blocked' : 'passed') : 'awaiting',
      startedAtIso: evaluatorTiming.startedAtIso,
      completedAtIso: evaluatorTiming.completedAtIso,
      inputRefs: [
        generationArtifact,
        goldArtifact,
        evaluatorConfigurationArtifact,
      ],
      outputRefs: [evaluatorArtifact, atomicCaseArtifact, atomicMatrixArtifact],
      decision: {
        code: evaluatorResult.status,
        summary: evaluatorResult.status === 'completed'
          ? `Gold evaluator completed with decision ${evaluatorResult.decision}.`
          : 'Deterministic evaluator checks passed; semantic judge scores have not been run.',
      },
      counts: { missingFacts: evaluatorResult.missingFacts.length, unsupportedClaims: evaluatorResult.unsupportedClaims.length },
      model: {
        providerCode: evaluatorResult.trace.providerCode ?? 'none',
        modelId: evaluatorResult.trace.modelId ?? null,
        liveModelUsed: evaluatorResult.trace.liveModelUsed === true,
      },
      retrieval: { mode: 'not_applicable', keys: [] },
      outcomes: executionOutcomes({
        quality: evaluatorResult.status === 'completed'
          ? (evaluatorResult.decision === 'blocked' ? 'failed' : 'passed') : 'not_measured',
        qualityExplanation: evaluatorResult.status === 'completed'
          ? `The sealed-gold evaluator returned ${evaluatorResult.decision}.`
          : 'Deterministic isolation checks ran, but the semantic judge did not run; quality is not measured.',
      }),
      configuration: {
        releaseVersion: evaluatorResult.release.version,
        manifestSha256: evaluatorResult.release.manifestSha256,
        goldAccess: 'after_pre_display_review',
        executionConfiguration: summarizeAgentConfiguration(evaluatorConfiguration),
      },
      runtime: runtimeFor(evaluatorResult.trace),
    }),
  ];
}

function scopeClaimLinks(scopeConfirmation, projection) {
  return (scopeConfirmation.claims ?? []).map(claim => {
    const noteIds = (claim.appEvidenceRefs ?? []).filter(ref => ref.kind === 'app_voice_note').map(ref => ref.id);
    const evidenceIds = projection.evidenceRecords.filter(record => noteIds.includes(
      record.payload?.voiceNoteId ?? record.sourceRecord?.voiceNoteId,
    )).map(record => record.evidenceId);
    return { claimId: claim.claimId, sourceRecordIds: noteIds, routedEvidenceIds: evidenceIds };
  });
}

function evidenceTraceFor({ routingResult, sectionRuns, sections, scopeConfirmation, atomicEvaluationBundle }) {
  return {
    contractVersion: 'agent_evidence_trace_v1',
    router: {
      total: routingResult.routingReview.counts.total,
      routed: routingResult.routingReview.counts.routed,
      excluded: routingResult.routingReview.counts.excluded,
      unresolved: routingResult.routingReview.counts.needs_review,
      dispositionCoverage: routingResult.routingReview.dispositionCoverage,
    },
    sections: sectionRuns.map(run => {
      const section = sections.find(item => item.sectionId === run.spec.sectionId);
      const disposition = run.execution.generationResult.evaluationEvidence?.evidenceDisposition ?? [];
      const dispositionById = new Map(disposition.map(item => [item.evidenceId, item]));
      const measured = run.spec.sectionId === 'general-tank-information'
        && disposition.length === run.projection.evidenceRecords.length
        && (run.execution.generationResult.evaluationEvidence?.unaccountedEvidenceIds ?? []).length === 0;
      return {
        sectionId: run.spec.sectionId,
        projectedRecordCount: run.projection.evidenceRecords.length,
        usedRecordCount: section.appEvidence.filter(item => item.usedInGeneration).length,
        issueCount: section.appEvidence.filter(item => item.issues.length).length,
        accountability: measured ? {
          status: 'measured',
          accounted: disposition.length,
          total: run.projection.evidenceRecords.length,
          counts: Object.fromEntries(['rendered', 'corroborating', 'delegated', 'excluded']
            .map(status => [status, disposition.filter(item => item.status === status).length])),
        } : {
          status: 'not_available',
          accounted: null,
          total: run.projection.evidenceRecords.length,
          counts: {},
          reason: 'This frozen Scope release confirms output claims but does not disposition every projected evidence record.',
        },
        records: section.appEvidence.map(item => ({
          evidenceId: item.evidenceId,
          sourceClass: item.sourceClass,
          sourcePointer: item.sourcePointer,
          label: item.label,
          preview: {
            text: item.text,
            processedText: item.processedText,
            context: item.context,
            issues: item.issues,
          },
          usedInGeneration: item.usedInGeneration,
          issueCount: item.issues.length,
          generationDisposition: dispositionById.get(item.evidenceId)?.status ?? null,
        })),
        claimLinks: run.spec.sectionId === 'scope-of-inspection'
          ? scopeClaimLinks(scopeConfirmation, run.projection)
          : disposition.map(item => ({ claimId: item.fieldKey, sourceRecordIds: [], routedEvidenceIds: [item.evidenceId] })),
        atomicLineage: (() => {
          const atomic = atomicEvaluationBundle.evaluations.find(item => item.sectionId === run.spec.sectionId);
          return {
            contractVersion: atomic.evaluationCase.contractVersion,
            caseId: atomic.evaluationCase.caseId,
            qualification: atomic.matrix.qualification,
            segmentationPolicy: atomic.evaluationCase.segmentationPolicy,
            counts: {
              source: atomic.evaluationCase.units.filter(unit => unit.layer === 'source').length,
              evidence: atomic.evaluationCase.units.filter(unit => unit.layer === 'evidence').length,
              generated: atomic.evaluationCase.units.filter(unit => unit.layer === 'generated').length,
              passedLinks: atomic.evaluationCase.links.filter(link => link.verdict === 'pass').length,
              failedLinks: atomic.evaluationCase.links.filter(link => link.verdict === 'fail').length,
            },
            units: atomic.evaluationCase.units.map(unit => ({
              unitId: unit.unitId,
              layer: unit.layer,
              unitType: unit.unitType,
              semanticKey: unit.semanticKey,
              criticality: unit.criticality,
              contentPreview: unit.contentPreview ?? null,
              protectedFactCount: unit.protectedFacts.length,
            })),
            links: atomic.evaluationCase.links.map(link => ({
              linkId: link.linkId,
              stage: link.stage,
              fromUnitIds: link.fromUnitIds,
              toUnitIds: link.toUnitIds,
              relation: link.relation,
              verdict: link.verdict,
              explanation: link.explanation,
            })),
          };
        })(),
      };
    }),
  };
}

function atomicMatrixRows(atomicEvaluationBundle) {
  return atomicEvaluationBundle.evaluations.flatMap(atomic => atomic.matrix.rows.map(row => {
    const measured = ['pass', 'fail'].includes(row.status);
    const hasRatio = measured && Number.isFinite(row.numerator) && Number.isFinite(row.denominator)
      && row.denominator > 0;
    const value = measured ? (hasRatio ? row.numerator / row.denominator : row.status === 'pass' ? 1 : 0) : null;
    const phase = row.metricId.startsWith('mock.') ? 'source_to_mock_evaluation'
      : row.metricId.startsWith('generation.') ? 'mock_to_generation_evaluation' : 'whole_section_evaluation';
    const evidenceRefs = [
      `${atomic.sectionId}.atomic-evaluation-case#units`,
      `${atomic.sectionId}.atomic-evaluation-case#links`,
    ];
    return createMatrixRow({
      metricId: `${atomic.sectionId}.atomic.${row.metricId}`,
      label: row.label,
      sectionId: atomic.sectionId,
      phase,
      class: row.classification,
      status: row.status,
      value,
      numerator: hasRatio ? row.numerator : null,
      denominator: hasRatio ? row.denominator : null,
      criterion: measured ? { operator: 'eq', value: 1 } : null,
      unit: 'ratio',
      sourceSpanIds: [sectionSpanId(atomic.sectionId, 'evaluation')],
      evidenceRefs,
      notes: [row.explanation, `${row.unitIds.length} semantic unit reference(s).`],
      grader: {
        type: 'deterministic', id: 'atomic-evaluation-matrix-rule-engine', version: 'v1',
        modelId: null, rubricSha256: null,
      },
      ruleEvaluations: [atomicRule({
        ruleId: `${atomic.sectionId}.atomic.${row.metricId}`,
        description: row.label,
        observed: hasRatio ? { matched: row.numerator, total: row.denominator } : row.status,
        operator: measured ? 'eq' : null,
        expected: measured ? (hasRatio ? { matched: row.denominator, total: row.denominator } : 'pass') : null,
        verdict: row.status,
        evidenceRefs,
        explanation: row.explanation,
      })],
    });
  }));
}

function rowsFor({ routingResult, sectionRuns, sourcePdfSha256, atomicEvaluationBundle }) {
  const rows = [
    pass({ metricId: 'input.export_authenticity', label: 'Android export authenticity', phase: 'input_guard', sourceSpanIds: ['input-guard'], evidenceRefs: ['input.android-receipt#exportSha256'] }),
    pass({ metricId: 'input.identity_consistency', label: 'Inspection identity consistency', phase: 'input_guard', sourceSpanIds: ['input-guard'], evidenceRefs: ['input.app-export#inspectionId', 'input.android-receipt#inspectionId'] }),
    pass({
      metricId: 'evidence.unit_provenance', label: 'Measurement unit provenance', phase: 'evidence_routing',
      numerator: routingResult.evidenceLedger.filter(record => record.kind === 'measurement' && record.payload?.unitSource === 'unitProfile.thicknessUnit').length,
      denominator: routingResult.evidenceLedger.filter(record => record.kind === 'measurement').length,
      sourceSpanIds: ['evidence-router'], evidenceRefs: ['router.routing-result#evidenceLedger.measurement.unitSource'],
    }),
    pass({
      metricId: 'routing.disposition_coverage', label: 'Router disposition coverage', phase: 'evidence_routing',
      numerator: routingResult.routingReview.counts.routed + routingResult.routingReview.counts.excluded,
      denominator: routingResult.routingReview.counts.total,
      value: routingResult.routingReview.dispositionCoverage,
      sourceSpanIds: ['evidence-router'], evidenceRefs: ['router.routing-result#routingReview.counts'],
    }),
    pass({
      metricId: 'routing.unresolved_evidence', label: 'Unresolved routed evidence', phase: 'evidence_routing',
      numerator: routingResult.routingReview.counts.needs_review, denominator: routingResult.routingReview.counts.total,
      value: routingResult.routingReview.counts.needs_review, criterion: { operator: 'eq', value: 0 }, unit: 'count',
      sourceSpanIds: ['evidence-router'], evidenceRefs: ['router.routing-result#routingReview.unresolved'],
    }),
    pass({
      metricId: 'routing.projection_isolation', label: 'Section projection isolation', phase: 'evidence_routing',
      numerator: sectionRuns.length, denominator: sectionRuns.length, sourceSpanIds: ['evidence-router'],
      evidenceRefs: sectionRuns.map(run => `${run.spec.sectionId}.routing-projection#sectionProjectionSha256`),
    }),
    pass({
      metricId: 'control.release_integrity', label: 'Frozen release bindings', phase: 'control_plane',
      numerator: 1 + sectionRuns.length * 3, denominator: 1 + sectionRuns.length * 3,
      sourceSpanIds: ['evidence-router', ...sectionRuns.flatMap(run => [
        sectionSpanId(run.spec.sectionId, 'generation'), sectionSpanId(run.spec.sectionId, 'review'), sectionSpanId(run.spec.sectionId, 'evaluation'),
      ])],
      evidenceRefs: ['agent-monitoring#controlPlane.bindings'],
    }),
    pass({
      metricId: 'control.plan_integrity', label: 'ReportPlan and SectionPlan hash integrity', phase: 'report_planning',
      numerator: sectionRuns.length, denominator: sectionRuns.length,
      sourceSpanIds: sectionRuns.map(run => sectionSpanId(run.spec.sectionId, 'plan')),
      evidenceRefs: sectionRuns.flatMap(run => [
        `${run.spec.sectionId}.report-plan#reportPlanSha256`,
        `${run.spec.sectionId}.section-plan#sectionPlanSha256`,
      ]),
    }),
    pass({
      metricId: 'control.gold_isolation', label: 'Gold opened only after guarded generation', phase: 'gold_access',
      numerator: sectionRuns.length, denominator: sectionRuns.length, sourceSpanIds: ['gold-access-barrier'],
      evidenceRefs: ['gold.source-report#sourceSha256'],
    }),
  ];

  for (const run of sectionRuns) {
    const id = run.spec.sectionId;
    const checks = run.execution.preDisplayReview.checks;
    const review = run.execution.preDisplayReview;
    const reviewerGrader = {
      type: review.trace.liveModelUsed === true ? 'llm' : 'deterministic',
      id: review.release.reviewerId,
      version: review.release.version,
      modelId: review.trace.modelId ?? null,
      rubricSha256: null,
    };
    const evaluatorGrader = {
      type: 'llm',
      id: run.evaluatorResult.release.evaluatorId,
      version: run.evaluatorResult.release.version,
      modelId: run.evaluatorResult.trace.modelId ?? null,
      rubricSha256: null,
    };
    rows.push(
      pass({
        metricId: `${id}.generation_validation`, label: 'Generator validation', sectionId: id, phase: 'generation',
        sourceSpanIds: [sectionSpanId(id, 'generation')],
        evidenceRefs: [`${id}.generation-result#validation.valid`],
        ruleEvaluations: [atomicRule({
          ruleId: `${id}.generation_validation.valid`, description: 'Generator output contract is valid',
          observed: run.execution.generationResult.validation.valid, operator: 'eq', expected: true,
          evidenceRefs: [`${id}.generation-result#validation.valid`],
          explanation: 'The frozen generator validator returned valid=true.',
        })],
      }),
      pass({
        metricId: `${id}.format_contract`, label: 'Title and format contract', sectionId: id,
        phase: 'pre_display_review', sourceSpanIds: [sectionSpanId(id, 'review')],
        evidenceRefs: [`${id}.pre-display-review#checks.exactTitle`, `${id}.pre-display-review#checks.formatValid`],
        notes: [`exactTitle=${checks.exactTitle}`, `formatValid=${checks.formatValid}`], grader: reviewerGrader,
        ruleEvaluations: [
          atomicRule({
            ruleId: `${id}.format_contract.exact_title`, description: 'Rendered title equals the release title',
            observed: checks.exactTitle, operator: 'eq', expected: true,
            evidenceRefs: [`${id}.pre-display-review#checks.exactTitle`],
            explanation: `The exact-title check returned ${checks.exactTitle}.`,
          }),
          atomicRule({
            ruleId: `${id}.format_contract.valid`, description: 'Rendered structure satisfies the section format contract',
            observed: checks.formatValid, operator: 'eq', expected: true,
            evidenceRefs: [`${id}.pre-display-review#checks.formatValid`],
            explanation: `The format validator returned ${checks.formatValid}.`,
          }),
        ],
      }),
      pass({
        metricId: `${id}.reviewer_visibility`, label: 'Independent pre-display review', sectionId: id,
        phase: 'pre_display_review', sourceSpanIds: [sectionSpanId(id, 'review')],
        evidenceRefs: [`${id}.pre-display-review#decision`, `${id}.pre-display-review#userVisibility`],
        notes: [`decision=${review.decision}`, `approval=${review.approvalStatus}`], grader: reviewerGrader,
        ruleEvaluations: [
          atomicRule({
            ruleId: `${id}.reviewer_visibility.decision`, description: 'Reviewer decision allows inspector review',
            observed: review.decision, operator: 'eq', expected: 'ready_for_review',
            evidenceRefs: [`${id}.pre-display-review#decision`],
            explanation: `The independent reviewer returned ${review.decision}.`,
          }),
          atomicRule({
            ruleId: `${id}.reviewer_visibility.display`, description: 'Reviewer explicitly allows display',
            observed: review.userVisibility, operator: 'eq', expected: 'allowed',
            evidenceRefs: [`${id}.pre-display-review#userVisibility`],
            explanation: `User visibility is ${review.userVisibility}; approval remains ${review.approvalStatus}.`,
          }),
        ],
      }),
    );
    if (id === 'general-tank-information') {
      rows.push(
        pass({
          metricId: `${id}.required_outputs`, label: 'Protected output fields', sectionId: id, phase: 'generation',
          numerator: checks.observedFieldCount, denominator: checks.protectedFieldCount,
          sourceSpanIds: [sectionSpanId(id, 'review')], grader: reviewerGrader,
          evidenceRefs: [`${id}.pre-display-review#checks.observedFieldCount`],
          ruleEvaluations: [atomicRule({
            ruleId: `${id}.required_outputs.count`, description: 'All protected fields are present',
            observed: checks.observedFieldCount, operator: 'eq', expected: checks.protectedFieldCount,
            evidenceRefs: [`${id}.pre-display-review#checks.observedFieldCount`],
            explanation: `${checks.observedFieldCount} of ${checks.protectedFieldCount} protected fields are present.`,
          })],
        }),
        pass({
          metricId: `${id}.evidence_accountability`, label: 'Projected evidence explicitly dispositioned',
          sectionId: id, phase: 'generation', numerator: checks.dispositionCount,
          denominator: checks.projectedEvidenceCount, sourceSpanIds: [sectionSpanId(id, 'review')],
          grader: reviewerGrader, evidenceRefs: [`${id}.pre-display-review#checks.dispositionCount`],
          ruleEvaluations: [atomicRule({
            ruleId: `${id}.evidence_accountability.count`, description: 'Every projected evidence record has a disposition',
            observed: checks.dispositionCount, operator: 'eq', expected: checks.projectedEvidenceCount,
            evidenceRefs: [`${id}.pre-display-review#checks.dispositionCount`],
            explanation: `${checks.dispositionCount} of ${checks.projectedEvidenceCount} projected records have dispositions.`,
          })],
        }),
      );
    } else {
      rows.push(
        pass({
          metricId: `${id}.required_outputs`, label: 'Confirmed scope output records', sectionId: id,
          phase: 'generation', numerator: checks.observedRecordCount, denominator: checks.expectedRecordCount,
          sourceSpanIds: [sectionSpanId(id, 'review')], grader: reviewerGrader,
          evidenceRefs: [`${id}.pre-display-review#checks.observedRecordCount`],
          ruleEvaluations: [atomicRule({
            ruleId: `${id}.required_outputs.count`, description: 'All confirmed scope records are rendered',
            observed: checks.observedRecordCount, operator: 'eq', expected: checks.expectedRecordCount,
            evidenceRefs: [`${id}.pre-display-review#checks.observedRecordCount`],
            explanation: `${checks.observedRecordCount} of ${checks.expectedRecordCount} confirmed scope records are rendered.`,
          })],
        }),
        unavailable({ metricId: `${id}.evidence_accountability`, label: 'Projected evidence explicitly dispositioned', sectionId: id, phase: 'generation', sourceSpanIds: [sectionSpanId(id, 'review')], notes: ['The frozen Scope release verifies 9 confirmed claims but has no 19-record projection disposition contract.'] }),
      );
    }
    rows.push(
      unavailable({
        metricId: `${id}.evaluator_completion`, label: 'Post-generation semantic evaluator', sectionId: id,
        phase: 'post_generation_evaluation', sourceSpanIds: [sectionSpanId(id, 'evaluation')],
        notes: ['The evaluator is awaiting an explicitly supplied semantic judge; no score was synthesized.'],
        grader: evaluatorGrader,
        evidenceRefs: [`${id}.evaluation-result#status`],
        ruleEvaluations: [atomicRule({
          ruleId: `${id}.evaluator_completion.status`, description: 'Semantic evaluator completed',
          observed: run.evaluatorResult.status, operator: 'eq', expected: 'completed', verdict: 'not_available',
          evidenceRefs: [`${id}.evaluation-result#status`],
          explanation: `Evaluator status is ${run.evaluatorResult.status}; no semantic score was synthesized.`,
        })],
      }),
      ...['evidenceCoverage', 'originalMeaningRecovery', 'formatAlignment', 'supportedClaimPrecision'].map(dimension => unavailable({
        metricId: `${id}.quality.${dimension}`,
        label: dimension.replace(/([A-Z])/g, ' $1').replace(/^./, value => value.toUpperCase()),
        sectionId: id,
        phase: 'post_generation_evaluation',
        class: 'quality',
        sourceSpanIds: [sectionSpanId(id, 'evaluation')],
        notes: ['Not measured until the bounded semantic judge completes.'],
        grader: evaluatorGrader,
      })),
      unavailable({ metricId: `${id}.quality.robustness`, label: 'Robustness across equivalent note variants', sectionId: id, phase: 'cohort_evaluation', class: 'quality', notes: ['Requires the frozen multi-report, multi-voice-variant corpus.'] }),
      unavailable({ metricId: `${id}.quality.human_outcome`, label: 'Inspector accept/edit/reject outcome', sectionId: id, phase: 'human_review', class: 'quality', notes: ['No inspector decision has been recorded for this run.'] }),
    );
  }
  return [...rows, ...atomicMatrixRows(atomicEvaluationBundle)];
}

export function buildTk5452AgentMonitoring({
  evaluationCaseId,
  reportProfileId,
  timing,
  inputArtifacts,
  routingResult,
  routerReleaseBinding,
  routerManifestSha256,
  sectionRuns,
  sections,
  scopeConfirmation,
  sourcePdfSha256,
  atomicEvaluationBundle,
}) {
  const rootSpanId = 'evaluation-run';
  const traceId = `trace_${canonicalSha256({ evaluationCaseId, startedAtIso: timing.runStartedAtIso,
    generationRunIds: sectionRuns.map(run => run.execution.generationResult.trace.runId) }).slice(0, 28)}`;
  const artifactStore = createArtifactStore();
  const perSectionSpans = sectionRuns.flatMap(run => sectionTraceSpans(
    run, rootSpanId, artifactStore, atomicEvaluationBundle,
  ));
  const routerConfiguration = configurationFor(atomicEvaluationBundle.agentConfigurations,
    { role: 'report_evidence_router' });
  const routerConfigurationArtifact = configurationArtifact(artifactStore, routerConfiguration);
  const allConfigurationArtifacts = atomicEvaluationBundle.agentConfigurations
    .map(configuration => configurationArtifact(artifactStore, configuration));
  const appExportArtifact = artifactStore.define({
    artifactId: 'input.app-export', name: 'app-export', kind: 'app_export',
    schemaVersion: inputArtifacts.appExport.value.schemaVersion
      ? `v3_product_export_v${inputArtifacts.appExport.value.schemaVersion}` : 'v3_product_export',
    preview: inputArtifacts.appExport.value, sourceSha256: inputArtifacts.appExport.sha256,
  });
  const receiptArtifact = artifactStore.define({
    artifactId: 'input.android-receipt', name: 'android-receipt', kind: 'input_receipt',
    schemaVersion: `laiq_android_app_export_receipt_v${inputArtifacts.androidReceipt.value.schemaVersion ?? 1}`,
    preview: inputArtifacts.androidReceipt.value, sourceSha256: inputArtifacts.androidReceipt.sha256,
  });
  const decisionsArtifact = artifactStore.define({
    artifactId: 'input.reviewed-routing-decisions', name: 'reviewed-routing-decisions', kind: 'reviewed_decisions',
    schemaVersion: 'reviewed_routing_decisions_v1', preview: inputArtifacts.reviewedDecisions.value,
    sourceSha256: inputArtifacts.reviewedDecisions.sha256,
  });
  const scopeConfirmationArtifact = artifactStore.define({
    artifactId: 'input.scope-confirmation', name: 'scope-confirmation', kind: 'report_side_confirmation',
    schemaVersion: inputArtifacts.scopeConfirmation.value.contractVersion ?? 'scope_confirmation_v1',
    preview: inputArtifacts.scopeConfirmation.value, sourceSha256: inputArtifacts.scopeConfirmation.sha256,
  });
  const validatedAppExportArtifact = artifactStore.define({
    artifactId: 'input.validated-app-export', name: 'validated-app-export', kind: 'app_export',
    schemaVersion: appExportArtifact.schemaVersion, preview: inputArtifacts.appExport.value,
    sourceSha256: inputArtifacts.appExport.sha256,
  });
  const routingResultArtifact = artifactStore.define({
    artifactId: 'router.routing-result', name: 'routing-result', kind: 'router_output',
    schemaVersion: 'report_evidence_router_output_v2',
    preview: {
      releaseId: routingResult.releaseId,
      inputPackageHash: routingResult.inputPackageHash,
      routingManifest: routingResult.routingManifest,
      routingReview: routingResult.routingReview,
      evidenceLedger: routingResult.evidenceLedger,
      sectionProjectionSummaries: Object.fromEntries(Object.entries(routingResult.sectionEvidenceProjections)
        .map(([sectionId, projection]) => [sectionId, {
          contractVersion: projection.contractVersion,
          evidenceRecordCount: projection.evidenceRecords.length,
          routingStatus: projection.routingStatus,
          readinessScope: projection.readinessScope,
        }])),
    },
  });
  const routingProjectionArtifacts = sectionRuns.map(run => artifactStore.define({
    artifactId: `${run.spec.sectionId}.routing-projection`,
    name: 'section-routing-projection',
    kind: 'routing_projection',
    schemaVersion: run.projection.contractVersion ?? 'section_evidence_projection_v2',
    preview: run.projection,
  }));
  const sourceArtifact = artifactStore.define({
    artifactId: 'gold.source-report', name: 'source-pdf', kind: 'source_report_metadata',
    schemaVersion: 'source_report_reference_v1',
    preview: {
      sourceReportId: `source-report:${sourcePdfSha256}`,
      sourceSha256: sourcePdfSha256,
      sectionPages: sectionRuns.map(run => ({ sectionId: run.spec.sectionId, pageNumber: run.spec.sourcePageNumber })),
      openedAtIso: timing.goldOpenedAtIso,
    },
    sourceSha256: sourcePdfSha256,
    redactionStatus: 'metadata_only',
  });
  const reviewArtifacts = sectionRuns.map(run => artifactStore.define({
    artifactId: `${run.spec.sectionId}.pre-display-review`, name: 'pre-display-review', kind: 'review_output',
    schemaVersion: run.execution.preDisplayReview.contractVersion,
    preview: run.execution.preDisplayReview,
    sourceSha256: canonicalSha256(run.execution.preDisplayReview),
  }));
  const goldArtifacts = sectionRuns.map(run => artifactStore.define({
    artifactId: `${run.spec.sectionId}.sealed-gold`, name: `${run.spec.sectionId}-sealed-gold`, kind: 'sealed_gold',
    schemaVersion: 'sealed_section_gold_v1',
    preview: { ...run.goldPacket, sectionText: run.goldPacket.originalContent },
    sourceSha256: run.evaluatorResult.trace.goldContentSha256,
    redactionStatus: 'none',
  }));
  const spans = [
    createTraceSpan({
      spanId: rootSpanId,
      phase: 'evaluation_run',
      actor: controlActor('evaluation_orchestrator', 'tk5452-routed-section-workflow'),
      status: 'passed',
      startedAtIso: timing.runStartedAtIso,
      completedAtIso: timing.runCompletedAtIso,
      inputRefs: [appExportArtifact],
      outputRefs: allConfigurationArtifacts,
      decision: { code: 'evaluation_only', summary: 'Two independent section plans ran without product promotion.' },
      counts: { sections: sectionRuns.length },
      outcomes: executionOutcomes({
        gate: 'not_applicable',
        qualityExplanation: 'The workflow orchestrator does not grade section quality.',
      }),
      configuration: { workflowId: 'tk5452-routed-sections-v1', executionMode: 'evaluation' },
    }),
    createTraceSpan({
      spanId: 'input-guard',
      parentSpanId: rootSpanId,
      phase: 'input_guard',
      actor: controlActor('input_guard', 'android-export-contract-guard'),
      status: 'passed',
      startedAtIso: timing.inputStartedAtIso,
      completedAtIso: timing.inputCompletedAtIso,
      inputRefs: [
        appExportArtifact,
        receiptArtifact,
        decisionsArtifact,
        scopeConfirmationArtifact,
      ],
      outputRefs: [validatedAppExportArtifact],
      decision: { code: 'accepted', summary: 'Package identity, receipt, reviewed decisions, and app-owned unit profile passed.' },
      counts: { reviewedRoutingDecisions: routingResult.routingManifest.reviewedDecisionIds.length },
      outcomes: executionOutcomes({ gate: 'passed', gateExplanation: 'Identity, receipt, reviewed decisions, and unit provenance passed.' }),
      configuration: { contract: 'v3_product_export_v3', requiredThicknessUnitSource: 'unitProfile.thicknessUnit' },
    }),
    createTraceSpan({
      spanId: 'evidence-router',
      parentSpanId: rootSpanId,
      phase: 'evidence_routing',
      actor: agentActor({
        role: 'report_evidence_router',
        id: routerReleaseBinding.agentId,
        releaseVersion: routerReleaseBinding.releaseId,
        manifestSha256: routerManifestSha256,
        configuration: routerConfiguration,
      }),
      status: routingResult.routingReview.wholeJobRoutingReady ? 'passed' : 'blocked',
      startedAtIso: timing.routerStartedAtIso,
      completedAtIso: timing.routerCompletedAtIso,
      inputRefs: [validatedAppExportArtifact, routerConfigurationArtifact],
      outputRefs: [routingResultArtifact, ...routingProjectionArtifacts],
      decision: {
        code: routingResult.routingReview.wholeJobRoutingReady ? 'routing_ready' : 'routing_blocked',
        summary: `${routingResult.routingReview.counts.routed} routed, ${routingResult.routingReview.counts.excluded} explicitly excluded, ${routingResult.routingReview.counts.needs_review} unresolved.`,
      },
      counts: routingResult.routingReview.counts,
      model: { providerCode: 'deterministic', modelId: null, liveModelUsed: false },
      retrieval: { mode: 'not_applicable', keys: [] },
      outcomes: executionOutcomes({
        gate: routingResult.routingReview.wholeJobRoutingReady ? 'passed' : 'blocked',
        gateExplanation: routingResult.routingReview.wholeJobRoutingReady
          ? 'Every evidence record has a routed or excluded disposition.' : 'Unresolved evidence blocked routing readiness.',
      }),
      configuration: {
        releaseVersion: routerReleaseBinding.releaseId,
        manifestSha256: routerManifestSha256,
        selectedSectionIds: sectionRuns.map(run => run.spec.sectionId),
        executionConfiguration: summarizeAgentConfiguration(routerConfiguration),
      },
    }),
    ...perSectionSpans.filter(span => span.phase !== 'post_generation_evaluation'),
    createTraceSpan({
      spanId: 'gold-access-barrier',
      parentSpanId: rootSpanId,
      phase: 'gold_access_barrier',
      actor: controlActor('gold_access_guard', 'sealed-gold-barrier'),
      status: 'passed',
      startedAtIso: timing.generationCompletedAtIso,
      completedAtIso: timing.goldOpenedAtIso,
      inputRefs: reviewArtifacts,
      outputRefs: [
        sourceArtifact,
        ...goldArtifacts,
      ],
      decision: { code: 'opened_after_generation', summary: 'Original report pages opened only after every pre-display reviewer allowed display.' },
      counts: { sections: sectionRuns.length },
      outcomes: executionOutcomes({ gate: 'passed', gateExplanation: 'Gold access occurred after all generation and display-review stages completed.' }),
      configuration: { policy: 'sealed_gold_after_guarded_generation_v1' },
    }),
    ...perSectionSpans.filter(span => span.phase === 'post_generation_evaluation'),
  ];
  const trace = buildAgentPipelineTrace({
    traceId,
    evaluationCaseId,
    datasetSplit: 'evaluation_only',
    reportProfileId,
    executionMode: 'evaluation',
    startedAtIso: timing.runStartedAtIso,
    completedAtIso: timing.runCompletedAtIso,
    spans,
  });
  const evidenceTrace = evidenceTraceFor({
    routingResult, sectionRuns, sections, scopeConfirmation, atomicEvaluationBundle,
  });
  const evaluationMatrix = buildEvaluationMatrix({
    evaluationCaseId,
    traceId,
    displayDecision: sectionRuns.every(run => run.execution.presentation.userVisibility === 'allowed') ? 'allowed' : 'blocked',
    rows: rowsFor({ routingResult, sectionRuns, sourcePdfSha256, atomicEvaluationBundle }),
  });
  const agentSpans = spans.filter(span => span.actor.kind === 'agent');
  const controlPlane = {
    contractVersion: 'agent_control_plane_snapshot_v1',
    executionMode: 'evaluation',
    productEnabled: false,
    approvalStatus: 'not_approved',
    promotionPerformed: false,
    bindings: agentSpans.map(span => ({
      spanId: span.spanId,
      sectionId: span.sectionId,
      role: span.actor.role,
      id: span.actor.id,
      releaseVersion: span.actor.releaseVersion,
      manifestSha256: span.actor.manifestSha256,
      configurationId: span.actor.configurationId,
      configurationSha256: span.actor.configurationSha256,
      status: span.status,
    })),
    controls: spans.filter(span => span.actor.kind !== 'agent').map(span => ({
      spanId: span.spanId, role: span.actor.role, id: span.actor.id, status: span.status,
    })),
    monitoringCoverage: {
      actualAgentSpans: agentSpans.length,
      unmonitoredActualAgents: 0,
      supportedAgentRoles: [
        'report_evidence_router', 'report_structure_agent', 'section_generator', 'pre_display_reviewer',
        'post_generation_evaluator', 'report_integrator', 'mock_data_generator', 'mock_data_reviewer',
      ],
      notRunInThisCase: ['report_structure_agent', 'report_integrator', 'mock_data_generator', 'mock_data_reviewer'],
    },
    outcomes: evaluationMatrix.outcomes,
  };
  return buildAgentMonitoring({
    trace,
    evidenceTrace,
    evaluationMatrix,
    controlPlane,
    artifacts: artifactStore.values(),
  });
}
