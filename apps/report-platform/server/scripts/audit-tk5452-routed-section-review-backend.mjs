#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  loadGenericOutlineHeldOutReview,
  matchesGenericOutlineReviewCase,
  resolveGenericOutlineSource,
} from '../experiments/generic-outline-review-backend.mjs';
import {
  TK5452_OBSERVED_SECTION_CASE,
  TK5452_ROUTED_SECTION_CASE,
  TK5452_ROUTED_SECTION_SOURCE,
} from '../experiments/tk5452-routed-section-review-backend.mjs';

const root = new URL('../../docs/reviews/data/tk5452-routed-section-agents-v1/', import.meta.url);
const observedRoot = new URL('../../docs/reviews/data/tk5452-routed-section-agents-observed-v1/', import.meta.url);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
const reviewBytes = await readFile(new URL('review.json', root));
const review = JSON.parse(reviewBytes);
const evaluationUi = await readFile(new URL('../../src/components/EvaluationLab.tsx', import.meta.url), 'utf8');
const monitoringUi = await readFile(new URL('../../src/components/SectionAgentMonitoring.tsx', import.meta.url), 'utf8');

assert.equal(manifest.contractVersion, 'tk5452_routed_section_agent_review_manifest_v1');
assert.equal(manifest.evaluationCaseId, TK5452_ROUTED_SECTION_CASE);
assert.equal(manifest.evaluationOnly, true);
assert.deepEqual(Object.keys(manifest.files), ['review.json']);
assert.equal(manifest.files['review.json'], digest(reviewBytes));
assert.equal(review.contractVersion, 'tk5452_routed_section_agent_review_v1');
assert.equal(review.evaluationOnly, true);
assert.equal(review.productEnabled, false);
assert.equal(review.routing.releaseId, 'report-evidence-router_v2');
assert.equal(review.routing.releaseManifestSha256, digest(await readFile(new URL('../report-evidence-router/releases/v2/manifest.json', import.meta.url))));
assert.deepEqual(review.sections.map(item => item.sectionId), ['scope-of-inspection', 'general-tank-information']);
assert.deepEqual(review.sections.map(item => item.sourcePageNumber), [4, 6]);
assert.deepEqual(review.sections.map(item => item.generationResultSummary.releaseVersion), ['scope_of_inspection_v1', 'general_tank_information_v3']);
assert(review.sections.every(item => item.evidenceSnapshotSummary.contractVersion === 'section_agent_evidence_snapshot_v1'));
assert(review.sections.every(item => item.evidenceSnapshotSummary.projectionContractVersion === 'section_evidence_projection_v2'));
assert(review.sections.every(item => item.evidenceSnapshotSummary.routingStatus === 'routing_ready'));
assert(review.sections.every(item => item.evidenceSnapshotSummary.readinessScope === 'evidence_routing_only'));
assert.equal(new Set(review.sections.map(item => item.evidenceSnapshotSummary.routingManifestSha256)).size, 1);
assert.equal(review.sections[0].generationResultSummary.manifestSha256, digest(await readFile(new URL('../section-agents/releases/scope-of-inspection/generator/v1/manifest.json', import.meta.url))));
assert.equal(review.sections[1].generationResultSummary.manifestSha256, digest(await readFile(new URL('../section-agents/releases/general-tank-information/generator/v3/manifest.json', import.meta.url))));
assert(matchesGenericOutlineReviewCase(TK5452_ROUTED_SECTION_CASE));
assert(matchesGenericOutlineReviewCase(TK5452_OBSERVED_SECTION_CASE));
assert(evaluationUi.includes('review.evaluationDisplay?.originalMode === "source_pdf"'));
assert(evaluationUi.includes('${review.sourcePdfUrl}#page=${review.sourcePageNumber ?? 1}&view=FitH'));
assert(evaluationUi.includes('["review", "Segment review"]'));
assert(monitoringUi.includes('Review one gold segment at a time'));
assert(monitoringUi.includes('1 · Original report'));
assert(monitoringUi.includes('2 · App / mock evidence'));
assert(monitoringUi.includes('3 · Generated report'));

for (let index = 0; index < review.sections.length; index += 1) {
  const saved = review.sections[index];
  const loaded = await loadGenericOutlineHeldOutReview({
    evaluationCaseId: TK5452_ROUTED_SECTION_CASE,
    sectionId: saved.sectionId,
  });
  const reviewPassed = saved.preDisplayReview.decision === 'ready_for_review'
    && saved.preDisplayReview.userVisibility === 'allowed';
  assert.equal(loaded.evaluationOnly, true);
  assert.equal(loaded.generationBackend, 'tk5452_routed_frozen_section_agents_v1');
  assert.equal(loaded.generatorContractVersion, 'frozen_section_agent_execution_v1');
  assert.equal(loaded.sections.length, 2);
  assert.equal(loaded.sectionId, saved.sectionId);
  assert.equal(loaded.sectionTitle, saved.sectionTitle);
  assert.equal(loaded.sourcePageNumber, saved.sourcePageNumber);
  assert.equal(loaded.originalSectionContent, saved.originalSectionContent);
  assert.equal(loaded.generatedContent, reviewPassed ? saved.generatedContent : '');
  assert.deepEqual(loaded.appEvidence, saved.appEvidence);
  assert.equal(loaded.metrics.outcomeCode, reviewPassed ? 'ready_for_review' : 'blocked');
  assert.equal(loaded.metrics.hardFailure, !reviewPassed);
  assert.equal(loaded.promotionGate.eligible, false);
  assert.equal(loaded.previousSectionId, review.sections[index - 1]?.sectionId ?? null);
  assert.equal(loaded.nextSectionId, review.sections[index + 1]?.sectionId ?? null);
  assert.equal(loaded.evaluationDisplay.unitLabel, 'sections');
  assert.equal(loaded.evaluationDisplay.originalMode, 'source_pdf');
  assert.equal(loaded.sourcePdfUrl, `/api/v1/admin/generic-outline-reviews/${TK5452_ROUTED_SECTION_CASE}/source`);
  assert.match(loaded.evalRunId, new RegExp(`^${TK5452_ROUTED_SECTION_CASE}:`));
  await assert.rejects(
    loadGenericOutlineHeldOutReview({
      evaluationCaseId: TK5452_ROUTED_SECTION_CASE,
      sectionId: saved.sectionId,
      evalRunId: 'wrong-run',
    }),
    error => error.statusCode === 404,
  );
}

await assert.rejects(
  loadGenericOutlineHeldOutReview({
    evaluationCaseId: TK5452_ROUTED_SECTION_CASE,
    sectionId: 'inspection-report',
  }),
  error => error.statusCode === 404,
);

const observedManifest = JSON.parse(await readFile(new URL('manifest.json', observedRoot), 'utf8'));
const observedReview = JSON.parse(await readFile(new URL('review.json', observedRoot), 'utf8'));
const observedMonitoringBytes = await readFile(new URL('agent-monitoring.json', observedRoot));
const observedMonitoring = JSON.parse(observedMonitoringBytes);
assert.equal(observedManifest.contractVersion, 'tk5452_routed_section_agent_review_manifest_v2');
assert.equal(observedManifest.evaluationCaseId, TK5452_OBSERVED_SECTION_CASE);
assert.equal(observedReview.contractVersion, 'tk5452_routed_section_agent_review_v2');
assert.equal(observedManifest.files['agent-monitoring.json'], digest(observedMonitoringBytes));
assert.equal(observedMonitoring.contractVersion, 'section_agent_monitoring_v1');
assert.equal(observedMonitoring.trace.spans.filter(item => item.actor.kind === 'agent').length, 7);
assert.equal(observedMonitoring.controlPlane.monitoringCoverage.unmonitoredActualAgents, 0);
assert.equal(observedMonitoring.evidenceTrace.router.total, 404);
assert.equal(observedMonitoring.evidenceTrace.router.unresolved, 0);
assert.equal(observedMonitoring.evaluationMatrix.outcomes.displayDecision, 'allowed');
assert.equal(observedMonitoring.evaluationMatrix.outcomes.qualificationDecision, 'not_qualified');
assert.equal(observedMonitoring.evaluationMatrix.outcomes.promotionDecision, 'not_performed');
assert.equal(observedMonitoring.evaluationMatrix.summary.hardGateFailed, 4);
assert.equal(observedMonitoring.evaluationMatrix.summary.hardGateUnavailable, 3);
const scopeAtomic = observedMonitoring.evidenceTrace.sections
  .find(item => item.sectionId === 'scope-of-inspection')?.atomicLineage;
assert(scopeAtomic);
assert(scopeAtomic.units.filter(item => item.layer === 'source').every(item => item.contentPreview));
assert(scopeAtomic.units.filter(item => item.layer === 'evidence').every(item => item.contentPreview));
assert(scopeAtomic.units.filter(item => item.layer === 'generated')
  .every(item => /^To carry out|^To compile/.test(item.contentPreview)));
assert(observedReview.sections.every(item => item.postGenerationEvaluation.status === 'awaiting_semantic_judge'
  && item.postGenerationEvaluation.scores === null));

for (const saved of observedReview.sections) {
  const loaded = await loadGenericOutlineHeldOutReview({
    evaluationCaseId: TK5452_OBSERVED_SECTION_CASE,
    sectionId: saved.sectionId,
  });
  assert.equal(loaded.generationBackend, 'tk5452_routed_observed_section_agents_v1');
  assert.equal(loaded.sectionId, saved.sectionId);
  assert.deepEqual(loaded.agentMonitoring, observedMonitoring);
  assert.equal(loaded.promotionGate.eligible, false);
  assert(loaded.promotionGate.reasons[0].includes('qualification is not_qualified'));
}

const source = await resolveGenericOutlineSource(TK5452_ROUTED_SECTION_CASE);
assert.equal(source.absolutePath, TK5452_ROUTED_SECTION_SOURCE.absolutePath);
assert.equal(source.fileName, TK5452_ROUTED_SECTION_SOURCE.fileName);
assert.equal(source.sha256, TK5452_ROUTED_SECTION_SOURCE.sha256);
const observedSource = await resolveGenericOutlineSource(TK5452_OBSERVED_SECTION_CASE);
assert.equal(observedSource.absolutePath, TK5452_ROUTED_SECTION_SOURCE.absolutePath);

console.log(JSON.stringify({
  passed: true,
  evaluationCaseId: TK5452_ROUTED_SECTION_CASE,
  sectionCount: review.sections.length,
  appEvidenceCount: review.sections.reduce((sum, item) => sum + item.appEvidence.length, 0),
  readOnlyNavigation: true,
  legacyGeneratorInvoked: false,
  promotionPerformed: false,
  observedAllAgentMonitoring: true,
  observedQualification: observedMonitoring.evaluationMatrix.outcomes.qualificationDecision,
}, null, 2));
