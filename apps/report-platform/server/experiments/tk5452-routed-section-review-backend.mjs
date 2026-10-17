// Read-only adapter from a frozen TK5452 two-section evaluation artifact to the
// existing Evaluation Lab comparison contract. Generation and evaluation happen
// before these files are written; this module only verifies and presents them.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { buildAgentMonitoring } from '../section-agents/observability/v1/contracts.mjs';

const ROUTER_RELEASE_MANIFEST = new URL('../report-evidence-router/releases/v2/manifest.json', import.meta.url);
const REQUIRED_SECTION_IDS = Object.freeze(['scope-of-inspection', 'general-tank-information']);
const EXPECTED_GENERATOR_RELEASES = Object.freeze({
  'scope-of-inspection': 'scope_of_inspection_v1',
  'general-tank-information': 'general_tank_information_v3',
});
const GENERATOR_RELEASE_MANIFESTS = Object.freeze({
  'scope-of-inspection': new URL('../section-agents/releases/scope-of-inspection/generator/v1/manifest.json', import.meta.url),
  'general-tank-information': new URL('../section-agents/releases/general-tank-information/generator/v3/manifest.json', import.meta.url),
});
const REVIEWER_RELEASE_MANIFESTS = Object.freeze({
  'scope-of-inspection': new URL('../section-agents/releases/scope-of-inspection/reviewer/v1/manifest.json', import.meta.url),
  'general-tank-information': new URL('../section-agents/releases/general-tank-information/reviewer/v2/manifest.json', import.meta.url),
});
const EVALUATOR_RELEASE_MANIFESTS = Object.freeze({
  'scope-of-inspection': new URL('../section-agents/releases/scope-of-inspection/evaluator/v1/manifest.json', import.meta.url),
  'general-tank-information': new URL('../section-agents/releases/general-tank-information/evaluator/v2/manifest.json', import.meta.url),
});
const EXPECTED_SOURCE_PAGES = Object.freeze({
  'scope-of-inspection': 4,
  'general-tank-information': 6,
});

export const TK5452_ROUTED_SECTION_CASE = 'eval-tk5452-routed-sections-v1';
export const TK5452_OBSERVED_SECTION_CASE = 'eval-tk5452-routed-sections-observed-v1';
export const TK5452_ROUTED_SECTION_SOURCE = Object.freeze({
  absolutePath: '/Users/oscar/Public/irs/Sample Reports/Shell Singapore Pte Ltd (Bukom)/19SE2-1 - TK 5452/19SE2-1 Shell Bukom TK 5452 Internal & External Inspection Report.pdf',
  fileName: '19SE2-1 Shell Bukom TK 5452 Internal & External Inspection Report.pdf',
  sha256: '871d8770a5667bdbc3f0623a3a2e3ace54abcaf07acbd27017610ec24407de92',
});
const CASES = Object.freeze({
  [TK5452_ROUTED_SECTION_CASE]: Object.freeze({
    dataRoot: new URL('../../docs/reviews/data/tk5452-routed-section-agents-v1/', import.meta.url),
    manifestSha256: '65c03267527b02de3bd0b26ca910ee6da87459d85cec80c41b135c19ec291360',
    manifestContract: 'tk5452_routed_section_agent_review_manifest_v1',
    reviewContract: 'tk5452_routed_section_agent_review_v1',
    monitored: false,
  }),
  [TK5452_OBSERVED_SECTION_CASE]: Object.freeze({
    dataRoot: new URL('../../docs/reviews/data/tk5452-routed-section-agents-observed-v1/', import.meta.url),
    manifestSha256: '85867b22ce3eb8060fa3eb31a019f410c0924c7862df99b4d61a40826c8007d2',
    manifestContract: 'tk5452_routed_section_agent_review_manifest_v2',
    reviewContract: 'tk5452_routed_section_agent_review_v2',
    monitored: true,
  }),
});

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const hasText = value => typeof value === 'string' && value.trim().length > 0;
const check = (condition, message) => {
  if (!condition) throw Object.assign(new Error(message), { statusCode: 409 });
};
const missing = message => Object.assign(new Error(message), { statusCode: 404 });

export async function loadTk5452RoutedSectionReview({ evaluationCaseId, sectionId, evalRunId } = {}) {
  const caseConfig = CASES[evaluationCaseId];
  if (!caseConfig) throw missing('TK5452 routed section-agent evaluation case was not found.');

  const manifestBytes = await readFile(new URL('manifest.json', caseConfig.dataRoot));
  check(digest(manifestBytes) === caseConfig.manifestSha256,
    'TK5452 routed section-agent root manifest changed.');
  const manifest = JSON.parse(manifestBytes);
  check(manifest.contractVersion === caseConfig.manifestContract
    && manifest.evaluationOnly === true
    && manifest.evaluationCaseId === evaluationCaseId,
  'TK5452 routed section-agent manifest identity is invalid.');
  check(manifest.files && typeof manifest.files === 'object' && !Array.isArray(manifest.files),
    'TK5452 routed section-agent manifest files are missing.');
  const expectedFiles = caseConfig.monitored
    ? ['agent-configurations.json', 'agent-monitoring.json', 'atomic-evaluations.json', 'review.json',
      'reviewed-routing-decisions.json', 'scope-confirmation.json']
    : ['review.json'];
  check(JSON.stringify(Object.keys(manifest.files).sort()) === JSON.stringify(expectedFiles)
      && Object.values(manifest.files).every(hash),
  'TK5452 routed section-agent manifest file set is invalid.');

  const reviewBytes = await readFile(new URL('review.json', caseConfig.dataRoot));
  check(digest(reviewBytes) === manifest.files['review.json'], 'TK5452 routed section-agent review artifact changed.');
  const review = JSON.parse(reviewBytes);
  validateReview(review, caseConfig, evaluationCaseId);
  await verifyReleasePins(review);
  let agentMonitoring = null;
  if (caseConfig.monitored) {
    const monitoringBytes = await readFile(new URL('agent-monitoring.json', caseConfig.dataRoot));
    check(digest(monitoringBytes) === manifest.files['agent-monitoring.json'], 'TK5452 agent-monitoring artifact changed.');
    agentMonitoring = JSON.parse(monitoringBytes);
    buildAgentMonitoring(agentMonitoring);
    check(agentMonitoring.trace.evaluationCaseId === evaluationCaseId
        && agentMonitoring.evaluationMatrix.evaluationCaseId === evaluationCaseId,
    'TK5452 agent-monitoring case identity is invalid.');
    validateMonitoringBindings(agentMonitoring, review);
    const copiedInputs = {};
    for (const fileName of ['reviewed-routing-decisions.json', 'scope-confirmation.json']) {
      const bytes = await readFile(new URL(fileName, caseConfig.dataRoot));
      check(digest(bytes) === manifest.files[fileName],
        `TK5452 observed input bundle changed: ${fileName}.`);
      copiedInputs[fileName] = bytes;
    }
    validateObservedInputLinkage({ agentMonitoring, copiedInputs, manifest, review });
  }

  const requestedSectionId = sectionId || REQUIRED_SECTION_IDS[0];
  const sectionIndex = review.sections.findIndex(item => item.sectionId === requestedSectionId);
  if (sectionIndex < 0) throw missing('TK5452 routed section-agent evaluation section was not found.');
  const section = review.sections[sectionIndex];
  const runId = `${evaluationCaseId}:${section.generationResultSummary.runId}`;
  if (evalRunId && evalRunId !== runId) throw missing('Saved TK5452 routed section-agent evaluation run was not found.');

  const reviewPassed = section.preDisplayReview.decision === 'ready_for_review'
    && section.preDisplayReview.userVisibility === 'allowed';
  const blockers = Array.isArray(section.preDisplayReview.blockers) ? section.preDisplayReview.blockers : [];
  const previous = review.sections[sectionIndex - 1] ?? null;
  const next = review.sections[sectionIndex + 1] ?? null;
  const reportName = 'TK 5452 · routed evidence · frozen section agents';

  return {
    available: true,
    evaluationOnly: true,
    evaluationCaseId,
    evalRunId: runId,
    generationBackend: caseConfig.monitored
      ? 'tk5452_routed_observed_section_agents_v1' : 'tk5452_routed_frozen_section_agents_v1',
    evaluationDisplay: {
      banner: 'Reviewing the saved TK5452 two-section routed-evidence evaluation. No production route or policy was promoted.',
      subtitle: caseConfig.monitored
        ? 'TK 5452 · all-agent trace + evaluation matrix · exact frozen releases'
        : 'TK 5452 · Scope of Inspection + General Tank Information · exact frozen releases',
      unitLabel: 'sections',
      backendLabel: 'routed evidence + frozen section-agent chain',
      evidenceMetricLabel: 'Routed evidence preservation',
      originalMode: 'source_pdf',
    },
    generatorContractVersion: 'frozen_section_agent_execution_v1',
    datasetSplit: 'evaluation_only',
    reportName,
    sectionId: section.sectionId,
    sectionTitle: section.sectionTitle,
    sourceReportName: review.source.fileName,
    sourcePdfUrl: `/api/v1/admin/generic-outline-reviews/${encodeURIComponent(evaluationCaseId)}/source`,
    sourcePageNumber: section.sourcePageNumber,
    referenceRevision: {
      contractVersion: review.contractVersion,
      pages: [section.sourcePageNumber],
      sourceSha256: review.source.sha256,
    },
    allSectionsComplete: true,
    sections: review.sections.map(item => {
      const allowed = item.preDisplayReview.decision === 'ready_for_review'
        && item.preDisplayReview.userVisibility === 'allowed';
      return {
        evaluationCaseId,
        reportName,
        sectionId: item.sectionId,
        sectionTitle: item.sectionTitle,
        completed: true,
        outcomeCode: allowed ? 'ready_for_review' : 'blocked',
        hardFailure: !allowed,
      };
    }),
    previousEvaluationCaseId: previous ? evaluationCaseId : null,
    previousSectionId: previous?.sectionId ?? null,
    nextEvaluationCaseId: next ? evaluationCaseId : null,
    nextSectionId: next?.sectionId ?? null,
    // A blocked draft remains inside the private artifact for diagnosis but never
    // crosses the pre-display boundary into the user-facing response.
    generatedContent: reviewPassed ? section.generatedContent : '',
    originalSectionContent: section.originalSectionContent,
    appEvidence: section.appEvidence,
    ...(agentMonitoring ? { agentMonitoring } : {}),
    benchmarkStatus: 'paired_source_reconstruction',
    metrics: {
      score: null,
      outcomeCode: reviewPassed ? 'ready_for_review' : 'blocked',
      requiredFactRecall: numberOrNull(section.metrics?.requiredFactRecall),
      claimPrecision: numberOrNull(section.metrics?.claimPrecision),
      protectedFactAccuracy: numberOrNull(section.metrics?.protectedFactAccuracy),
      formatMatch: numberOrNull(section.metrics?.formatMatch),
      professionalAcceptability: null,
      goldContentCoverage: null,
      outputLengthBalance: null,
      hardFailure: !reviewPassed,
      hardFailureReasons: reviewPassed ? [] : blockers,
      evaluationPoints: [],
    },
    diagnosticNotes: [
      'This saved review used the reviewed Report Evidence Routing Agent projection and exact immutable section-agent release recorded below. The display adapter did not run a generator.',
      `Generator: ${section.generationResultSummary.releaseVersion} (${section.generationResultSummary.manifestSha256}).`,
      `Pre-display review: ${section.preDisplayReview.decision}.`,
      `Routing release: ${review.routing.releaseId} (${review.routing.releaseManifestSha256}); routing manifest ${review.routing.routingManifestHash}.`,
      ...blockers.map(item => `Reviewer blocker: ${item}`),
    ],
    promotionGate: {
      eligible: false,
      reasons: agentMonitoring
        ? [`Evaluation-only run; qualification is ${agentMonitoring.evaluationMatrix.outcomes.qualificationDecision} and product promotion is disabled.`]
        : ['Evaluation-only integration trial; product routing and policy promotion are disabled.'],
      sectionCount: REQUIRED_SECTION_IDS.length,
      passedSectionCount: review.sections.filter(item => item.preDisplayReview.decision === 'ready_for_review'
        && item.preDisplayReview.userVisibility === 'allowed').length,
      thresholds: { requiredFactRecall: 1, claimPrecision: 0.9, protectedFactAccuracy: 1 },
    },
    createdAtIso: review.createdAtIso,
  };
}

function validateMonitoringBindings(monitoring, review) {
  const bindings = monitoring.controlPlane.bindings;
  const router = bindings.find(item => item.role === 'report_evidence_router');
  check(router?.releaseVersion === review.routing.releaseId
      && router?.manifestSha256 === review.routing.releaseManifestSha256,
  'Agent monitoring router binding does not match the review artifact.');
  check(monitoring.evidenceTrace.router.total === review.routing.totalEvidenceCount
      && monitoring.evidenceTrace.router.routed === review.routing.routedEvidenceCount
      && monitoring.evidenceTrace.router.excluded === review.routing.excludedEvidenceCount
      && monitoring.evidenceTrace.router.unresolved === review.routing.unresolvedCount,
  'Agent monitoring routing counts do not match the review artifact.');
  for (const section of review.sections) {
    const expected = [
      ['section_generator', section.generationResultSummary.releaseVersion, section.generationResultSummary.manifestSha256],
      ['pre_display_reviewer', section.preDisplayReview.release.version, section.preDisplayReview.release.manifestSha256],
      ['post_generation_evaluator', section.postGenerationEvaluation.release.version, section.postGenerationEvaluation.release.manifestSha256],
    ];
    for (const [role, releaseVersion, manifestSha256] of expected) {
      const matchingBindings = bindings.filter(item => item.sectionId === section.sectionId && item.role === role);
      check(matchingBindings.length === 1,
        `${section.sectionId}: agent monitoring must contain exactly one ${role} binding.`);
      const [binding] = matchingBindings;
      check(binding?.releaseVersion === releaseVersion && binding?.manifestSha256 === manifestSha256,
        `${section.sectionId}: agent monitoring ${role} binding does not match the review artifact.`);
    }
    const evidence = monitoring.evidenceTrace.sections.find(item => item.sectionId === section.sectionId);
    check(evidence?.projectedRecordCount === section.appEvidence.length,
      `${section.sectionId}: agent monitoring projected-evidence count does not match the review artifact.`);
  }
  check(monitoring.evaluationMatrix.outcomes.displayDecision === (review.sections.every(section =>
    section.preDisplayReview.userVisibility === 'allowed') ? 'allowed' : 'blocked'),
  'Agent monitoring display decision does not match the pre-display reviewers.');
}

function validateObservedInputLinkage({ agentMonitoring, copiedInputs, manifest, review }) {
  const inputGuard = agentMonitoring.trace.spans.find(span => span.spanId === 'input-guard');
  check(inputGuard?.phase === 'input_guard' && inputGuard.status === 'passed',
    'TK5452 observed input guard is missing or did not pass.');
  const refs = new Map(inputGuard.inputRefs.map(ref => [ref.name, ref]));
  check(refs.size === inputGuard.inputRefs.length
      && ['app-export', 'android-receipt', 'reviewed-routing-decisions', 'scope-confirmation']
        .every(name => refs.has(name)),
  'TK5452 observed input guard has duplicate or missing input references.');
  check((refs.get('app-export')?.sourceSha256 ?? refs.get('app-export')?.sha256) === review.routing.androidExportSha256
      && (refs.get('android-receipt')?.sourceSha256 ?? refs.get('android-receipt')?.sha256) === review.routing.androidReceiptSha256,
  'TK5452 observed Android input hashes do not match the reviewed run.');
  check((refs.get('reviewed-routing-decisions')?.sourceSha256 ?? refs.get('reviewed-routing-decisions')?.sha256)
        === manifest.files['reviewed-routing-decisions.json']
      && (refs.get('scope-confirmation')?.sourceSha256 ?? refs.get('scope-confirmation')?.sha256)
        === manifest.files['scope-confirmation.json']
      && review.routing.reviewedDecisionsSha256 === manifest.files['reviewed-routing-decisions.json'],
  'TK5452 observed copied inputs are not bound to the input guard and review artifact.');
  check(digest(copiedInputs['reviewed-routing-decisions.json'])
        === (refs.get('reviewed-routing-decisions')?.sourceSha256 ?? refs.get('reviewed-routing-decisions')?.sha256)
      && digest(copiedInputs['scope-confirmation.json'])
        === (refs.get('scope-confirmation')?.sourceSha256 ?? refs.get('scope-confirmation')?.sha256),
  'TK5452 observed copied input bytes do not match the monitored input guard.');
}

function validateReview(review, caseConfig, evaluationCaseId) {
  check(review?.contractVersion === caseConfig.reviewContract
    && review.evaluationCaseId === evaluationCaseId
    && review.evaluationOnly === true
    && review.productEnabled === false,
  'TK5452 routed section-agent review identity or boundary is invalid.');
  check(review.source?.absolutePath === TK5452_ROUTED_SECTION_SOURCE.absolutePath
    && review.source?.fileName === TK5452_ROUTED_SECTION_SOURCE.fileName
    && review.source?.sha256 === TK5452_ROUTED_SECTION_SOURCE.sha256,
  'TK5452 routed section-agent source identity changed.');
  check(review.routing?.releaseId === 'report-evidence-router_v2'
    && hash(review.routing?.releaseManifestSha256)
    && hash(review.routing?.inputPackageHash)
    && hash(review.routing?.routingManifestHash),
  'TK5452 routed section-agent routing provenance is incomplete.');
  check(Array.isArray(review.sections)
    && review.sections.length === REQUIRED_SECTION_IDS.length
    && review.sections.every((item, index) => item.sectionId === REQUIRED_SECTION_IDS[index]),
  'TK5452 routed section-agent review must contain the two expected sections in report order.');
  check(new Set(review.sections.map(item => item.evidenceSnapshotSummary?.routingManifestSha256)).size === 1,
    'TK5452 routed section-agent sections do not share one frozen routing manifest.');
  check(Number.isFinite(Date.parse(review.createdAtIso)), 'TK5452 routed section-agent creation time is invalid.');

  for (const section of review.sections) validateSection(section, caseConfig);
}

function validateSection(section, caseConfig) {
  const summary = section.generationResultSummary;
  const preDisplay = section.preDisplayReview;
  const evidence = section.evidenceSnapshotSummary;
  check(hasText(section.sectionTitle) && section.sourcePageNumber === EXPECTED_SOURCE_PAGES[section.sectionId],
    `${section.sectionId}: section title or source page is invalid.`);
  check(typeof section.originalSectionContent === 'string' && typeof section.generatedContent === 'string',
    `${section.sectionId}: original or generated content is missing.`);
  check(summary?.releaseVersion === EXPECTED_GENERATOR_RELEASES[section.sectionId]
    && hash(summary?.manifestSha256)
    && hasText(summary?.runId)
    && Number.isFinite(Date.parse(summary?.generatedAtIso))
    && typeof summary?.validationValid === 'boolean'
    && summary?.approvalStatus === 'not_approved',
  `${section.sectionId}: frozen generator summary is invalid.`);
  check(Number.isFinite(Date.parse(section.originalOpenedAfterGenerationAtIso))
    && Date.parse(section.originalOpenedAfterGenerationAtIso) >= Date.parse(summary.generatedAtIso),
  `${section.sectionId}: original section was not demonstrably opened after generation.`);
  check(evidence?.contractVersion === 'section_agent_evidence_snapshot_v1'
    && evidence?.projectionContractVersion === 'section_evidence_projection_v2'
    && evidence?.routingStatus === 'routing_ready'
    && evidence?.readinessScope === 'evidence_routing_only'
    && hash(evidence?.sectionProjectionSha256)
    && hash(evidence?.routingManifestSha256),
  `${section.sectionId}: routed evidence snapshot summary is invalid.`);
  check(preDisplay?.contractVersion === 'section_review_result_v1'
    && preDisplay?.section?.sectionId === section.sectionId
    && preDisplay?.section?.generatorReleaseVersion === summary.releaseVersion
    && preDisplay?.trace?.generationRunId === summary.runId
    && preDisplay?.checks?.goldUsed === false
    && ['ready_for_review', 'blocked'].includes(preDisplay.decision)
    && ['allowed', 'blocked'].includes(preDisplay.userVisibility)
    && preDisplay.approvalStatus === 'not_approved'
    && Array.isArray(preDisplay.blockers),
  `${section.sectionId}: pre-display review is invalid.`);
  check((preDisplay.decision === 'ready_for_review') === (preDisplay.userVisibility === 'allowed'),
    `${section.sectionId}: pre-display decision and visibility disagree.`);
  check(preDisplay.decision !== 'ready_for_review' || summary.validationValid === true,
    `${section.sectionId}: a failed generator validation cannot be ready for review.`);
  check(Array.isArray(section.appEvidence) && section.appEvidence.length > 0,
    `${section.sectionId}: routed app evidence is missing.`);
  for (const item of section.appEvidence) {
    check(hasText(item?.evidenceId) && hasText(item?.sourceClass) && hasText(item?.sourcePointer)
      && hasText(item?.label) && typeof item?.text === 'string'
      && Array.isArray(item?.processedText) && item.processedText.every(hasText)
      && typeof item?.usedInGeneration === 'boolean'
      && Array.isArray(item?.issues) && item.issues.every(value => typeof value === 'string')
      && typeof item?.context === 'string',
    `${section.sectionId}: an app-evidence card is invalid.`);
  }
  if (caseConfig.monitored) {
    check(hash(section.planBindingSummary?.reportPlanSha256)
        && hash(section.planBindingSummary?.sectionPlanSha256)
        && hash(section.planBindingSummary?.evidenceSnapshotSha256),
    `${section.sectionId}: observed plan bindings are incomplete.`);
    const evaluation = section.postGenerationEvaluation;
    check(evaluation?.contractVersion === 'section_gold_evaluation_result_v1'
        && evaluation.sectionId === section.sectionId
        && evaluation.status === 'awaiting_semantic_judge'
        && evaluation.scores === null
        && evaluation.trace?.generationRunId === summary.runId
        && evaluation.trace?.liveModelUsed === false
        && hash(evaluation.release?.manifestSha256),
    `${section.sectionId}: post-generation evaluator state is invalid.`);
  }
}

async function verifyReleasePins(review) {
  const routerBytes = await readFile(ROUTER_RELEASE_MANIFEST);
  check(digest(routerBytes) === review.routing.releaseManifestSha256,
    'TK5452 routed section-agent router release manifest changed.');
  const routerManifest = JSON.parse(routerBytes);
  check(routerManifest.releaseId === review.routing.releaseId
    && routerManifest.productEnabled === false
    && routerManifest.executionModes?.includes('evaluation'),
  'TK5452 routed section-agent router release boundary is invalid.');

  await Promise.all(review.sections.map(async section => {
    const manifestBytes = await readFile(GENERATOR_RELEASE_MANIFESTS[section.sectionId]);
    check(digest(manifestBytes) === section.generationResultSummary.manifestSha256,
      `${section.sectionId}: frozen generator release manifest changed.`);
    const manifest = JSON.parse(manifestBytes);
    check(manifest.releaseId === section.generationResultSummary.releaseVersion
      && manifest.productionEnabled === false
      && manifest.executionModes?.includes('evaluation')
      && manifest.supportedSectionIds?.includes(section.sectionId),
    `${section.sectionId}: frozen generator release boundary is invalid.`);

    const reviewerBytes = await readFile(REVIEWER_RELEASE_MANIFESTS[section.sectionId]);
    check(digest(reviewerBytes) === section.preDisplayReview.release.manifestSha256,
      `${section.sectionId}: frozen reviewer release manifest changed.`);
    if (section.postGenerationEvaluation) {
      const evaluatorBytes = await readFile(EVALUATOR_RELEASE_MANIFESTS[section.sectionId]);
      check(digest(evaluatorBytes) === section.postGenerationEvaluation.release.manifestSha256,
        `${section.sectionId}: frozen evaluator release manifest changed.`);
    }
  }));
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}
