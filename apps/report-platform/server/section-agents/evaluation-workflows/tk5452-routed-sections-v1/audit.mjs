import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  DEFAULT_PATHS,
  EVALUATION_CASE_ID,
  OBSERVED_EVALUATION_CASE_ID,
  runTk5452RoutedSectionsEvaluation,
  runTk5452ObservedSectionsEvaluation,
} from './run.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'tk5452-routed-sections-audit-'));

try {
  const lifecycle = [];
  const result = await runTk5452RoutedSectionsEvaluation({
    outputDirectory: path.join(tempRoot, 'saved-contract'),
    originalPageReader: async ({ pageNumbers, generationBarrier }) => {
      lifecycle.push('original-pages-opened');
      assert.deepEqual(pageNumbers, [4, 6]);
      assert.equal(generationBarrier.allReviewersAllowDisplay, true);
      assert.deepEqual(generationBarrier.sectionReleaseVersions,
        ['scope_of_inspection_v1', 'general_tank_information_v3']);
      assert.ok(Date.parse(generationBarrier.completedAtIso));
      return new Map([
        [4, '1 SCOPE OF INSPECTION\nFocused audit page content.'],
        [6, '3 GENERAL TANK INFORMATION\nFocused audit page content.'],
      ]);
    },
  });

  assert.deepEqual(lifecycle, ['original-pages-opened']);
  assert.equal(result.evaluationCaseId, EVALUATION_CASE_ID);
  assert.equal(result.review.contractVersion, 'tk5452_routed_section_agent_review_v1');
  assert.equal(result.review.evaluationOnly, true);
  assert.equal(result.review.productEnabled, false);
  assert.equal(result.review.routing.releaseId, 'report-evidence-router_v2');
  assert.equal(result.review.routing.inputPackageHash,
    '1bf15ae4d5fd4879c0c98ab449185c2debef62e85b43005b2db28a7ca86599a5');
  assert.equal(result.review.routing.reviewedDecisionCount, 24);
  assert.equal(result.review.routing.unresolvedCount, 0);
  assert.equal(result.review.routing.thicknessUnit, 'mm');
  assert.equal(result.review.routing.measurementCount, 20);
  assert.equal(result.review.routing.measurementUnitSource, 'unitProfile.thicknessUnit');
  assert.deepEqual(result.review.sections.map(section => [section.sectionId,
    section.generationResultSummary.releaseVersion, section.sourcePageNumber]), [
    ['scope-of-inspection', 'scope_of_inspection_v1', 4],
    ['general-tank-information', 'general_tank_information_v3', 6],
  ]);
  for (const section of result.review.sections) {
    assert.equal(section.evidenceSnapshotSummary.contractVersion, 'section_agent_evidence_snapshot_v1');
    assert.equal(section.evidenceSnapshotSummary.projectionContractVersion, 'section_evidence_projection_v2');
    assert.equal(section.evidenceSnapshotSummary.routingStatus, 'routing_ready');
    assert.equal(section.evidenceSnapshotSummary.readinessScope, 'evidence_routing_only');
    assert.match(section.evidenceSnapshotSummary.sectionProjectionSha256, /^[a-f0-9]{64}$/);
    assert.equal(section.evidenceSnapshotSummary.routingManifestSha256,
      result.review.routing.routingManifestSha256);
    assert.equal(section.generationResultSummary.validationValid, true);
    assert.equal(section.generationResultSummary.approvalStatus, 'not_approved');
    assert.equal(section.preDisplayReview.decision, 'ready_for_review');
    assert.equal(section.preDisplayReview.userVisibility, 'allowed');
    assert.equal(section.preDisplayReview.approvalStatus, 'not_approved');
    assert.deepEqual(section.preDisplayReview.blockers, []);
    assert.ok(section.generatedContent.length > 0);
    assert.ok(section.originalSectionContent.length > 0);
    assert.ok(section.appEvidence.length > 0);
  }
  const generalInformationEvidence = result.review.sections
    .find(section => section.sectionId === 'general-tank-information').appEvidence;
  const byLabel = new Map(generalInformationEvidence.map(item => [item.label, item]));
  assert.equal(generalInformationEvidence.filter(item => item.usedInGeneration).length, 34,
    '31 rendered and 3 corroborating GTI records must show as used.');
  for (const fieldKey of ['height', 'diameter', 'courseNumber']) {
    assert.equal(byLabel.get(fieldKey)?.usedInGeneration, true,
      `Corroborating ${fieldKey} evidence must show as used in generation.`);
  }
  for (const fieldKey of ['inspector', 'jobNo', 'dateCompleted', 'externalRoofType', 'internalRoofType',
    'shellLaneCount', 'referenceMode', 'referenceNote', 'insulationDistance']) {
    assert.equal(byLabel.get(fieldKey)?.usedInGeneration, false,
      `Delegated ${fieldKey} evidence must remain excluded from section generation.`);
  }

  const reviewBytes = await readFile(result.reviewPath);
  const savedManifest = JSON.parse(await readFile(result.manifestPath, 'utf8'));
  assert.deepEqual(savedManifest, {
    contractVersion: 'tk5452_routed_section_agent_review_manifest_v1',
    evaluationOnly: true,
    evaluationCaseId: EVALUATION_CASE_ID,
    files: { 'review.json': sha256(reviewBytes) },
  });

  const observed = await runTk5452ObservedSectionsEvaluation({
    outputDirectory: path.join(tempRoot, 'observed-contract'),
    originalPageReader: async ({ pageNumbers, generationBarrier }) => {
      assert.deepEqual(pageNumbers, [4, 6]);
      assert.equal(generationBarrier.allReviewersAllowDisplay, true);
      return new Map([
        [4, '1 SCOPE OF INSPECTION\nObserved audit page content.'],
        [6, '3 GENERAL TANK INFORMATION\nObserved audit page content.'],
      ]);
    },
  });
  assert.equal(observed.evaluationCaseId, OBSERVED_EVALUATION_CASE_ID);
  assert.equal(observed.review.contractVersion, 'tk5452_routed_section_agent_review_v2');
  assert.equal(observed.monitoring.contractVersion, 'section_agent_monitoring_v1');
  assert.deepEqual(observed.monitoring.statusSummary, {
    execution: {
      status: 'completed', completedStages: 12, totalStages: 12,
      explanation: 'Execution reports whether the workflow stages returned auditable results.',
    },
    gate: {
      status: 'passed', displayDecision: 'allowed',
      explanation: 'The gate controls whether a draft may be shown for inspector review; it does not approve the report.',
    },
    quality: {
      status: 'failed', measuredMetrics: 6, unavailableMetrics: 14,
      qualificationDecision: 'not_qualified',
      explanation: 'Quality reflects post-generation evaluation metrics.',
    },
  });
  assert.equal(observed.monitoring.trace.spans.filter(span => span.actor.kind === 'agent').length, 7);
  assert(observed.monitoring.trace.spans.filter(span => span.actor.kind === 'agent')
    .every(span => span.actor.configurationId && /^[a-f0-9]{64}$/.test(span.actor.configurationSha256)),
  'Every executed agent must bind an immutable execution configuration.');
  assert(observed.monitoring.trace.spans.every(span => span.outcomes?.execution?.status === 'completed'
      && span.outcomes?.gate && span.outcomes?.quality
      && span.configuration && span.runtime && Array.isArray(span.toolCalls)
      && Object.hasOwn(span, 'error')),
  'Every new trace span must separate execution, gate and quality and expose runtime/configuration metadata.');
  assert(observed.monitoring.trace.spans.flatMap(span => [...span.inputRefs, ...span.outputRefs])
    .filter(ref => ref.artifactId).every(ref => ref.preview === undefined
      && /^[a-f0-9]{64}$/.test(ref.sha256) && Number.isInteger(ref.byteLength)),
  'Trace references must remain lightweight immutable artifact descriptors.');
  assert(observed.monitoring.artifactCatalog.artifacts.length >= 20
      && observed.monitoring.artifactCatalog.artifacts.every(item => Object.hasOwn(item, 'preview')),
  'The artifact catalog must retain each safe preview exactly once.');
  const artifactById = new Map(observed.monitoring.artifactCatalog.artifacts
    .map(item => [item.artifactId, item]));
  const producingSpanByArtifactId = new Map(observed.monitoring.trace.spans.flatMap(span =>
    span.outputRefs.map(ref => [ref.artifactId, span.spanId])));
  for (const span of observed.monitoring.trace.spans.filter(item => [
    'report_plan_and_section_snapshot', 'section_generation', 'pre_display_review',
    'post_generation_evaluation',
  ].includes(item.phase))) {
    assert(span.inputRefs.every(ref => producingSpanByArtifactId.has(ref.artifactId)),
      `${span.spanId}: a stage input has no producing span in the trace.`);
  }
  for (const span of observed.monitoring.trace.spans.filter(item => item.phase === 'section_generation')) {
    assert(!JSON.stringify(span.inputRefs.map(ref => artifactById.get(ref.artifactId)?.preview)).includes('sectionText'),
      `${span.spanId}: sealed-gold content leaked into the generator input artifact.`);
  }
  const goldBarrier = observed.monitoring.trace.spans.find(span => span.phase === 'gold_access_barrier');
  assert(goldBarrier.outputRefs.filter(ref => ref.kind === 'sealed_gold')
    .every(ref => artifactById.get(ref.artifactId)?.preview.sectionText),
    'The authorized gold barrier must retain inspectable sealed-gold text for the evaluator.');
  assert.deepEqual(observed.monitoring.controlPlane.monitoringCoverage.notRunInThisCase,
    ['report_structure_agent', 'report_integrator', 'mock_data_generator', 'mock_data_reviewer']);
  assert.equal(observed.monitoring.evidenceTrace.router.total, 404);
  assert.equal(observed.monitoring.evidenceTrace.router.routed, 363);
  assert.equal(observed.monitoring.evidenceTrace.router.excluded, 41);
  assert.equal(observed.monitoring.evidenceTrace.router.unresolved, 0);
  const scopeTrace = observed.monitoring.evidenceTrace.sections.find(item => item.sectionId === 'scope-of-inspection');
  const generalTrace = observed.monitoring.evidenceTrace.sections.find(item => item.sectionId === 'general-tank-information');
  assert.equal(scopeTrace.projectedRecordCount, 19);
  assert.equal(scopeTrace.accountability.status, 'not_available');
  assert.equal(scopeTrace.claimLinks.length, 9);
  assert.deepEqual(scopeTrace.atomicLineage.counts,
    { source: 9, evidence: 4, generated: 9, passedLinks: 15, failedLinks: 3 });
  assert(scopeTrace.atomicLineage.links.filter(link => link.verdict === 'fail')
    .every(link => link.stage === 'source_to_mock'),
  'Scope losses must be localized before generation for this fixture.');
  assert(scopeTrace.records.every(record => record.label && typeof record.preview?.text === 'string'
      && Array.isArray(record.preview.processedText)),
  'Scope evidence records must retain the same sanitized content already exposed by the comparison view.');
  assert.equal(generalTrace.projectedRecordCount, 43);
  assert.equal(generalTrace.accountability.status, 'measured');
  assert.equal(generalTrace.accountability.accounted, 43);
  assert.deepEqual(generalTrace.atomicLineage.counts,
    { source: 32, evidence: 31, generated: 31, passedLinks: 61, failedLinks: 2 });
  assert.deepEqual(generalTrace.atomicLineage.links.filter(link => link.verdict === 'fail')
    .map(link => link.linkId), [
    'link:source-to-mock:general-tank-information:shellConstruction',
    'link:source-to-mock:general-tank-information:shellPlateThickness',
  ]);
  assert(generalTrace.records.every(record => record.label && typeof record.preview?.text === 'string'
      && Array.isArray(record.preview.processedText)),
  'General Information evidence records must retain inspectable sanitized content.');
  assert.deepEqual(generalTrace.accountability.counts,
    { rendered: 31, corroborating: 3, delegated: 9, excluded: 0 });
  assert.deepEqual(observed.monitoring.evaluationMatrix.outcomes, {
    runValidity: 'invalid',
    displayDecision: 'allowed',
    qualificationDecision: 'not_qualified',
    promotionDecision: 'not_performed',
  });
  assert.equal(observed.monitoring.evaluationMatrix.summary.hardGateFailed, 4);
  assert.equal(observed.monitoring.evaluationMatrix.summary.hardGateUnavailable, 3);
  assert(observed.monitoring.evaluationMatrix.rows.every(row => row.grader
      && Array.isArray(row.ruleEvaluations) && row.ruleEvaluations.length > 0
      && row.ruleEvaluations.every(rule => Object.hasOwn(rule, 'observed')
        && Object.hasOwn(rule, 'operator') && Object.hasOwn(rule, 'expected')
        && rule.verdict && Array.isArray(rule.evidenceRefs) && rule.explanation)),
  'Every evaluation row must expose atomic rules, evidence, and its grader.');
  assert(observed.monitoring.evaluationMatrix.rows
    .filter(row => row.metricId.includes('.quality.') || row.metricId.endsWith('.evaluator_completion'))
    .filter(row => row.phase === 'post_generation_evaluation')
    .every(row => row.grader.type === 'llm'),
  'Semantic quality rows must identify the declared LLM grader even when it has not run.');
  assert(observed.review.sections.every(section =>
    section.postGenerationEvaluation.status === 'awaiting_semantic_judge'
    && section.postGenerationEvaluation.scores === null
    && section.postGenerationEvaluation.trace.liveModelUsed === false));
  const observedManifest = JSON.parse(await readFile(observed.manifestPath, 'utf8'));
  assert.equal(observedManifest.contractVersion, 'tk5452_routed_section_agent_review_manifest_v2');
  assert.deepEqual(Object.keys(observedManifest.files).sort(),
    ['agent-configurations.json', 'agent-monitoring.json', 'atomic-evaluations.json', 'review.json',
      'reviewed-routing-decisions.json', 'scope-confirmation.json']);
  for (const fileName of Object.keys(observedManifest.files)) {
    assert.equal(observedManifest.files[fileName], sha256(await readFile(path.join(path.dirname(observed.manifestPath), fileName))));
  }

  const reviewedDecisions = JSON.parse(await readFile(DEFAULT_PATHS.reviewedDecisionsPath, 'utf8'));
  const invalidDecisionsPath = path.join(tempRoot, 'old-style-44-decisions.json');
  await writeFile(invalidDecisionsPath, `${JSON.stringify([
    ...Array.from({ length: 20 }, (_, index) => ({
      decisionId: `tk5452-route-${String(index + 1).padStart(3, '0')}`,
      actorId: 'tk5452-routing-review',
      evidenceId: `legacy-unit-${index + 1}`,
      operation: 'update',
      unitCode: 'mm',
    })),
    ...reviewedDecisions,
  ], null, 2)}\n`);
  let invalidReaderCalled = false;
  await assert.rejects(
    runTk5452RoutedSectionsEvaluation({
      reviewedDecisionsPath: invalidDecisionsPath,
      outputDirectory: path.join(tempRoot, 'must-not-write'),
      originalPageReader: async () => {
        invalidReaderCalled = true;
        return new Map();
      },
    }),
    /routing-decision SHA-256 mismatch/,
  );
  assert.equal(invalidReaderCalled, false, 'Rejected decisions must never reach original-page access.');

  process.stdout.write(`${JSON.stringify({
    ok: true,
    evaluationCaseId: result.evaluationCaseId,
    sections: result.review.sections.map(section => section.sectionId),
    routing: {
      reviewedDecisionCount: result.review.routing.reviewedDecisionCount,
      unresolvedCount: result.review.routing.unresolvedCount,
      measurementCount: result.review.routing.measurementCount,
      measurementUnitSource: result.review.routing.measurementUnitSource,
    },
    goldBoundary: 'original page reader called once after both guarded reviews allowed display',
    legacyUnitDecisionSetRejected: true,
    observedAllAgentTrace: true,
    observedQualification: observed.monitoring.evaluationMatrix.outcomes.qualificationDecision,
  }, null, 2)}\n`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
