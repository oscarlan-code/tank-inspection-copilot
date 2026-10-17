import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { getReportEvidenceRouterBinding } from '../../../report-evidence-router/registry.mjs';
import { routeReportEvidence } from '../../../report-evidence-router/releases/v2/server/router.mjs';
import { buildMinimumReportPlan, buildMinimumSectionPlan, canonicalSha256 } from '../../../report-plans/minimum-report-plan.mjs';
import { buildSectionEvidenceSnapshot, validateSectionEvidenceSnapshot } from '../../../report-plans/section-evidence-snapshot.mjs';
import { executeGuardedPlannedSection } from '../../guarded-execution.mjs';
import { runSectionGoldEvaluation } from '../../evaluator-registry.mjs';
import { getSectionAgentBinding } from '../../generator-registry.mjs';
import { buildTk5452AtomicEvaluationBundle } from './atomic-evaluation-adapter.mjs';
import { buildTk5452AgentMonitoring } from './monitoring.mjs';

const execFileAsync = promisify(execFile);

export const EVALUATION_CASE_ID = 'eval-tk5452-routed-sections-v1';
export const REVIEW_CONTRACT = 'tk5452_routed_section_agent_review_v1';
export const REVIEW_MANIFEST_CONTRACT = 'tk5452_routed_section_agent_review_manifest_v1';
export const OBSERVED_EVALUATION_CASE_ID = 'eval-tk5452-routed-sections-observed-v1';
export const OBSERVED_REVIEW_CONTRACT = 'tk5452_routed_section_agent_review_v2';
export const OBSERVED_REVIEW_MANIFEST_CONTRACT = 'tk5452_routed_section_agent_review_manifest_v2';
export const ROUTER_RELEASE_ID = 'report-evidence-router_v2';
export const REPORT_PROFILE_ID = 'vertical_tank_inspection_v1';

const EXPECTED = Object.freeze({
  appExportSha256: '4632c11842a0220d06c903f089f7eaa204ba0704e3ad0444a16ffbde5df32975',
  androidReceiptSha256: 'f413e74b76b117642a5518c04db2521510f912a82f1479f7e48700d92f006230',
  inputPackageHash: '1bf15ae4d5fd4879c0c98ab449185c2debef62e85b43005b2db28a7ca86599a5',
  reviewedDecisionsSha256: 'de4d60f000580d43060fce2c0d97cb316f61e6034e4d11693b84cf537c38ac8b',
  scopeConfirmationSha256: 'd42b1898e8cf6f30e18063a944b9ddfa06f3f1f87fdb5d02efeb71d824b43785',
  sourcePdfSha256: '871d8770a5667bdbc3f0623a3a2e3ace54abcaf07acbd27017610ec24407de92',
  inspectionId: '9b575830-d1a9-4af0-9953-7c14777240d7',
  inspectionReference: 'LAIQ-5452-20260930-202354',
  decisionIds: Object.freeze(Array.from({ length: 24 }, (_, index) => `tk5452-route-${String(index + 21).padStart(3, '0')}`)),
});

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_PATHS = Object.freeze({
  appExportPath: '/Users/oscar/Code/tank-inspection-coplilot-app/apps/field-android/.local/report-mock-corpus/v1/mock-ae941a71373872c0c0b6/exports/concise-field/v3-product-export.json',
  androidReceiptPath: '/Users/oscar/Code/tank-inspection-coplilot-app/apps/field-android/.local/report-mock-corpus/v1/mock-ae941a71373872c0c0b6/exports/concise-field/android-export-receipt.json',
  reviewedDecisionsPath: path.resolve(HERE, '../../../../.local/evaluation-inputs/tk5452-routed-sections-v1/reviewed-routing-decisions.json'),
  scopeConfirmationPath: path.resolve(HERE, '../../../../.local/evaluation-inputs/tk5452-routed-sections-v1/scope-confirmation.json'),
  sourcePdfPath: '/Users/oscar/Public/irs/Sample Reports/Shell Singapore Pte Ltd (Bukom)/19SE2-1 - TK 5452/19SE2-1 Shell Bukom TK 5452 Internal & External Inspection Report.pdf',
  outputDirectory: path.resolve(HERE, '../../../../docs/reviews/data/tk5452-routed-section-agents-v1'),
  observedOutputDirectory: path.resolve(HERE, '../../../../docs/reviews/data/tk5452-routed-section-agents-observed-v1'),
});

const SECTION_SPECS = Object.freeze([
  Object.freeze({
    sectionId: 'scope-of-inspection',
    sectionTitle: 'SCOPE OF INSPECTION',
    releaseVersion: 'scope_of_inspection_v1',
    sourcePageNumber: 4,
  }),
  Object.freeze({
    sectionId: 'general-tank-information',
    sectionTitle: 'GENERAL TANK INFORMATION',
    releaseVersion: 'general_tank_information_v3',
    sourcePageNumber: 6,
  }),
]);

const RELEASE_MANIFEST_URLS = Object.freeze({
  router: new URL('../../../report-evidence-router/releases/v2/manifest.json', import.meta.url),
  scope_of_inspection_v1: new URL('../../releases/scope-of-inspection/generator/v1/manifest.json', import.meta.url),
  general_tank_information_v3: new URL('../../releases/general-tank-information/generator/v3/manifest.json', import.meta.url),
});

const sha256 = value => createHash('sha256').update(value).digest('hex');
const isoNow = () => new Date().toISOString();

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJsonArtifact(filePath, label) {
  const absolutePath = path.resolve(filePath);
  const bytes = await readFile(absolutePath);
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
  return { absolutePath, bytes, sha256: sha256(bytes), value };
}

function validateAndroidInputs({ appExport, receipt }) {
  invariant(appExport.sha256 === EXPECTED.appExportSha256,
    `App export SHA-256 mismatch; expected the reviewed TK5452 concise-field export ${EXPECTED.appExportSha256}.`);
  invariant(receipt.sha256 === EXPECTED.androidReceiptSha256,
    `Android receipt SHA-256 mismatch; expected ${EXPECTED.androidReceiptSha256}.`);
  const pkg = appExport.value;
  const proof = receipt.value;
  invariant(proof?.packageType === 'laiq_android_app_export_receipt' && proof.schemaVersion === 1,
    'Android receipt contract must be laiq_android_app_export_receipt schema 1.');
  invariant(proof.producer === 'ProductStore.exportInspection', 'Receipt producer must be ProductStore.exportInspection.');
  invariant(proof.variant === 'concise-field', 'Receipt must identify the reviewed concise-field variant.');
  invariant(proof.exportSha256 === appExport.sha256, 'Receipt exportSha256 does not match the ProductStore export bytes.');
  invariant(proof.exportByteSize === appExport.bytes.length, 'Receipt exportByteSize does not match the ProductStore export bytes.');
  invariant(String(proof.canonicalExportRelativePath ?? '').startsWith('v3-product-exports/'),
    'Receipt does not identify a canonical ProductStore export path.');
  invariant(pkg?.packageType === 'v3_product_export' && pkg.schemaVersion === 3,
    'App evidence must be a V3 ProductStore export.');
  invariant(pkg.inspectionId === EXPECTED.inspectionId && proof.inspectionId === pkg.inspectionId,
    'Export and receipt must carry the reviewed TK5452 inspection ID.');
  invariant(pkg.inspectionReference === EXPECTED.inspectionReference && proof.inspectionReference === pkg.inspectionReference,
    'Export and receipt must carry the reviewed TK5452 inspection reference.');
  invariant(pkg.unitProfile?.thicknessUnit === 'mm', 'App output /unitProfile/thicknessUnit must be mm.');
}

function validateReviewedInputs({ reviewedDecisions, scopeConfirmation }) {
  invariant(reviewedDecisions.sha256 === EXPECTED.reviewedDecisionsSha256,
    `Reviewed routing-decision SHA-256 mismatch; expected ${EXPECTED.reviewedDecisionsSha256}.`);
  invariant(scopeConfirmation.sha256 === EXPECTED.scopeConfirmationSha256,
    `Reviewed scope-confirmation SHA-256 mismatch; expected ${EXPECTED.scopeConfirmationSha256}.`);
  const decisions = reviewedDecisions.value;
  invariant(Array.isArray(decisions) && decisions.length === EXPECTED.decisionIds.length,
    'Exactly 24 reviewed routing decisions are required.');
  invariant(decisions.every((decision, index) => decision?.decisionId === EXPECTED.decisionIds[index]),
    'Reviewed routing-decision IDs or ordering do not match TK5452 decisions 021-044.');
  invariant(decisions.every(decision => decision.actorId === 'tk5452-routing-review' && decision.createdAtIso),
    'Every routing decision must retain its authenticated review provenance.');
  const unitKeys = new Set(['unit', 'unitCode', 'sourceUnitCode', 'resolvedUnitCode', 'unitSource']);
  invariant(decisions.every(decision => !Object.keys(decision).some(key => unitKeys.has(key))),
    'Unit decisions are prohibited; thickness units must come from app output.');
  const confirmation = scopeConfirmation.value;
  invariant(confirmation?.contractVersion === 'scope_confirmation_v1' && confirmation.confirmed === true
      && confirmation.confirmedBy === 'tk5452-scope-review' && confirmation.confirmedAtIso,
    'A reviewed and explicitly confirmed scope_confirmation_v1 artifact is required.');
}

function assertProjectionBoundary(projection, sectionId) {
  invariant(projection?.contractVersion === 'section_evidence_projection_v2',
    `${sectionId} must use a v2 section evidence projection.`);
  invariant(projection.sectionId === sectionId && projection.routingStatus === 'routing_ready'
      && projection.readinessScope === 'evidence_routing_only' && projection.blockers?.length === 0,
    `${sectionId} projection is not routing-ready.`);
  invariant((projection.evidenceUses ?? []).every(use => use.sectionId === sectionId),
    `${sectionId} projection contains another section's evidence use.`);
  invariant((projection.evidenceRecords ?? []).every(record =>
    (record.uses ?? []).every(use => use.sectionId === sectionId)),
  `${sectionId} projection contains cross-section nested evidence uses.`);
}

function assertNoGold(value, sourcePdfPath, cursor = 'evidenceSnapshot') {
  if (!value || typeof value !== 'object') return;
  const forbiddenKeys = new Set([
    'gold', 'hiddenGold', 'validationGold', 'originalSection', 'originalSectionContent',
    'expectedSection', 'referenceAnswer', 'sourcePdf', 'sourcePdfPath', 'sourcePage', 'sourcePageNumber',
  ]);
  for (const [key, item] of Object.entries(value)) {
    invariant(!forbiddenKeys.has(key), `Evaluator-only gold is present at ${cursor}.${key}.`);
    if (typeof item === 'string') {
      invariant(item !== sourcePdfPath && item !== path.basename(sourcePdfPath),
        `Original report path leaked into generation at ${cursor}.${key}.`);
    } else {
      assertNoGold(item, sourcePdfPath, `${cursor}.${key}`);
    }
  }
}

function validateRoutingResult(routingResult, exportPackage, reviewedDecisions) {
  invariant(routingResult?.releaseId === ROUTER_RELEASE_ID, 'Evaluation must use report-evidence-router_v2.');
  invariant(routingResult.inputPackageHash === EXPECTED.inputPackageHash,
    `Router input package hash mismatch; expected ${EXPECTED.inputPackageHash}.`);
  invariant(routingResult.routingManifest?.inputPackageHash === EXPECTED.inputPackageHash,
    'Routing manifest does not bind the reviewed app export.');
  invariant(JSON.stringify(routingResult.routingManifest?.reviewedDecisionIds) === JSON.stringify(EXPECTED.decisionIds),
    'Routing manifest does not bind the exact 24 reviewed decisions.');
  invariant(reviewedDecisions.length === 24, 'Router did not receive exactly 24 reviewed decisions.');
  invariant(routingResult.routingReview?.counts?.needs_review === 0
      && routingResult.routingReview?.unresolved?.length === 0,
    'Routing must have zero unresolved evidence.');
  invariant(routingResult.routingReview?.selectedSectionsRoutingReady === true
      && routingResult.routingReview?.wholeJobRoutingReady === true
      && routingResult.routingReview?.readinessScope === 'evidence_routing_only',
    'Router result is not explicitly routing-ready.');
  for (const spec of SECTION_SPECS) {
    assertProjectionBoundary(routingResult.sectionEvidenceProjections?.[spec.sectionId], spec.sectionId);
  }
  const measurements = routingResult.evidenceLedger.filter(record => record.kind === 'measurement');
  invariant(measurements.length > 0 && measurements.length === exportPackage.utMeasurements?.length,
    'Every exported UT measurement must be represented in the evidence ledger.');
  invariant(measurements.every(record => record.payload?.unitCode === 'mm'
      && record.payload?.unitSource === 'unitProfile.thicknessUnit'),
    'Every routed measurement must use mm from unitProfile.thicknessUnit.');
  return measurements;
}

function assertDisplayAllowed(execution, spec) {
  const review = execution?.preDisplayReview;
  invariant(execution?.generationResult?.section?.releaseVersion === spec.releaseVersion,
    `${spec.sectionId} did not execute the frozen ${spec.releaseVersion} release.`);
  invariant(execution.generationResult?.validation?.valid === true,
    `${spec.sectionId} generation validation failed.`);
  invariant(review?.decision === 'ready_for_review' && review.userVisibility === 'allowed'
      && review.approvalStatus === 'not_approved' && review.blockers?.length === 0,
    `${spec.sectionId} pre-display reviewer did not allow display.`);
  invariant(execution.presentation?.userVisibility === 'allowed'
      && execution.presentation?.approvalStatus === 'not_approved'
      && typeof execution.presentation?.draft?.content === 'string'
      && execution.presentation.draft.content.trim(),
    `${spec.sectionId} guarded presentation is not displayable.`);
}

function issueText(issue) {
  if (typeof issue === 'string') return issue;
  if (!issue || typeof issue !== 'object') return String(issue);
  return [issue.reason, issue.detail].filter(Boolean).join(': ');
}

function appEvidenceFor({ projection, spec, scopeConfirmation, generationResult }) {
  const confirmedVoiceIds = new Set(spec.sectionId === 'scope-of-inspection'
    ? (scopeConfirmation.claims ?? []).flatMap(claim => claim.appEvidenceRefs ?? [])
      .filter(ref => ref.kind === 'app_voice_note').map(ref => ref.id)
    : []);
  const usedGtiEvidenceIds = new Set((generationResult.evaluationEvidence?.evidenceDisposition ?? [])
    .filter(item => ['rendered', 'corroborating'].includes(item.status))
    .map(item => item.evidenceId));
  return projection.evidenceRecords.map(record => {
    const uses = record.uses ?? [];
    const voiceNoteId = record.payload?.voiceNoteId ?? record.sourceRecord?.voiceNoteId;
    const usedInGeneration = spec.sectionId === 'scope-of-inspection'
      ? confirmedVoiceIds.has(voiceNoteId)
      : usedGtiEvidenceIds.has(record.evidenceId);
    const label = record.payload?.fieldKey ?? record.sourceRecord?.fieldKey
      ?? record.captureContext?.screenLabel ?? record.kind;
    const processedText = [...new Set([record.payload?.text, record.displayText]
      .filter(value => typeof value === 'string' && value.trim()))];
    return {
      evidenceId: record.evidenceId,
      sourceClass: record.sourceClass,
      sourcePointer: record.sourceRef?.pointer ?? '',
      label: String(label),
      text: String(record.displayText ?? record.payload?.text ?? ''),
      processedText,
      usedInGeneration,
      issues: (record.quality?.issues ?? []).map(issueText),
      context: uses.map(use => `${use.slotKey}:${use.role}`).join(', '),
    };
  });
}

async function manifestSha256(url) {
  return sha256(await readFile(fileURLToPath(url)));
}

async function defaultOriginalPageReader({ sourcePdfPath, pageNumbers, generationBarrier }) {
  invariant(generationBarrier?.allReviewersAllowDisplay === true,
    'Original pages cannot be opened until every guarded section passes pre-display review.');
  const entries = await Promise.all(pageNumbers.map(async pageNumber => {
    let stdout;
    try {
      ({ stdout } = await execFileAsync('pdftotext', [
        '-f', String(pageNumber), '-l', String(pageNumber), '-layout', '-enc', 'UTF-8', sourcePdfPath, '-',
      ], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
    } catch (error) {
      throw new Error(`Unable to extract original PDF page ${pageNumber}: ${error.stderr || error.message}`);
    }
    const text = stdout.replace(/\f/g, '').trim();
    invariant(text, `Original PDF page ${pageNumber} did not yield reviewable text.`);
    return [pageNumber, text];
  }));
  return new Map(entries);
}

async function executeSection({ spec, exportPackage, routingResult, routerReleaseBinding,
  scopeConfirmation, sourcePdfPath, tenantId, workspaceId, evaluationCaseId, now }) {
  const sectionStartedAtIso = now();
  const projection = routingResult.sectionEvidenceProjections[spec.sectionId];
  const evidenceSnapshot = buildSectionEvidenceSnapshot({
    exportPackage,
    routingResult,
    sectionId: spec.sectionId,
    routerReleaseBinding,
    reviewedSectionInputs: spec.sectionId === 'scope-of-inspection' ? { scopeConfirmation } : {},
  });
  validateSectionEvidenceSnapshot(evidenceSnapshot, { sectionId: spec.sectionId });
  assertNoGold(evidenceSnapshot, sourcePdfPath);
  const agentBinding = getSectionAgentBinding({
    releaseVersion: spec.releaseVersion,
    sectionId: spec.sectionId,
    reportProfileId: REPORT_PROFILE_ID,
  });
  const releaseManifestSha256 = await manifestSha256(RELEASE_MANIFEST_URLS[spec.releaseVersion]);
  invariant(agentBinding.manifestSha256 === releaseManifestSha256,
    `${spec.releaseVersion} registry hash does not match its immutable manifest file.`);
  const reportPlan = buildMinimumReportPlan({
    reportPlanId: `${evaluationCaseId}:${spec.sectionId}:report-plan`,
    tenantId,
    workspaceId,
    reportJobId: `${EVALUATION_CASE_ID}:${spec.sectionId}:job`,
    importRevisionId: routingResult.inputPackageHash,
    agentBinding,
    evidenceRouterBinding: routerReleaseBinding,
  });
  invariant(reportPlan.sections?.length === 1 && reportPlan.sections[0].sectionId === spec.sectionId,
    `${spec.sectionId} must have an independent one-section ReportPlan.`);
  const sectionInstanceId = reportPlan.sections[0].sectionInstanceId;
  const sectionPlan = buildMinimumSectionPlan({ reportPlan, sectionInstanceId, evidenceSnapshot });
  const executionStartedAtIso = now();
  const execution = await executeGuardedPlannedSection({
    reportPlan,
    sectionInstanceId,
    sectionPlan,
    evidenceSnapshot,
    executionMode: 'evaluation',
  });
  assertDisplayAllowed(execution, spec);
  invariant(execution.generationResult.release?.manifestSha256 === releaseManifestSha256,
    `${spec.sectionId} execution release hash does not match the frozen manifest.`);
  const executionCompletedAtIso = now();
  return {
    spec,
    projection,
    evidenceSnapshot,
    reportPlan,
    sectionPlan,
    execution,
    releaseManifestSha256,
    routingResult,
    timing: { sectionStartedAtIso, executionStartedAtIso, executionCompletedAtIso },
  };
}

export async function runTk5452RoutedSectionsEvaluation({
  appExportPath = DEFAULT_PATHS.appExportPath,
  androidReceiptPath = DEFAULT_PATHS.androidReceiptPath,
  reviewedDecisionsPath = DEFAULT_PATHS.reviewedDecisionsPath,
  scopeConfirmationPath = DEFAULT_PATHS.scopeConfirmationPath,
  sourcePdfPath = DEFAULT_PATHS.sourcePdfPath,
  outputDirectory = null,
  originalPageReader = defaultOriginalPageReader,
  now = isoNow,
  observed = false,
} = {}) {
  const evaluationCaseId = observed ? OBSERVED_EVALUATION_CASE_ID : EVALUATION_CASE_ID;
  const reviewContract = observed ? OBSERVED_REVIEW_CONTRACT : REVIEW_CONTRACT;
  const reviewManifestContract = observed ? OBSERVED_REVIEW_MANIFEST_CONTRACT : REVIEW_MANIFEST_CONTRACT;
  const effectiveOutputDirectory = outputDirectory ?? (observed
    ? DEFAULT_PATHS.observedOutputDirectory : DEFAULT_PATHS.outputDirectory);
  const runStartedAtIso = now();
  const inputStartedAtIso = now();
  const [appExport, receipt, reviewedDecisions, scopeConfirmation] = await Promise.all([
    readJsonArtifact(appExportPath, 'ProductStore export'),
    readJsonArtifact(androidReceiptPath, 'Android export receipt'),
    readJsonArtifact(reviewedDecisionsPath, 'reviewed routing decisions'),
    readJsonArtifact(scopeConfirmationPath, 'reviewed scope confirmation'),
  ]);
  validateAndroidInputs({ appExport, receipt });
  validateReviewedInputs({ reviewedDecisions, scopeConfirmation });
  const inputCompletedAtIso = now();

  const routerStartedAtIso = now();
  const routerReleaseBinding = await getReportEvidenceRouterBinding({
    releaseId: ROUTER_RELEASE_ID,
    executionMode: 'evaluation',
    allowArchived: true,
  });
  const routerManifestSha256 = await manifestSha256(RELEASE_MANIFEST_URLS.router);
  invariant(routerReleaseBinding.releaseId === ROUTER_RELEASE_ID
      && routerReleaseBinding.manifestSha256 === routerManifestSha256,
    'Router registry binding does not match the immutable v2 release manifest.');
  const routingResult = routeReportEvidence({
    exportPackage: appExport.value,
    reviewedDecisions: reviewedDecisions.value,
    selectedSectionIds: SECTION_SPECS.map(spec => spec.sectionId),
  });
  const measurements = validateRoutingResult(routingResult, appExport.value, reviewedDecisions.value);
  const routerCompletedAtIso = now();
  const tenantId = appExport.value.tenantId ?? appExport.value.inspectionRecord?.tenantId;
  const workspaceId = appExport.value.workspaceId ?? appExport.value.inspectionRecord?.workspaceId;
  invariant(tenantId && workspaceId, 'App export must identify its tenant and workspace.');

  const sectionRuns = await Promise.all(SECTION_SPECS.map(spec => executeSection({
    spec,
    exportPackage: appExport.value,
    routingResult,
    routerReleaseBinding,
    scopeConfirmation: scopeConfirmation.value,
    sourcePdfPath: path.resolve(sourcePdfPath),
    tenantId,
    workspaceId,
    evaluationCaseId,
    now,
  })));
  for (const run of sectionRuns) assertDisplayAllowed(run.execution, run.spec);
  invariant(sectionRuns[0].reportPlan.reportPlanId !== sectionRuns[1].reportPlan.reportPlanId
      && sectionRuns[0].sectionPlan.sectionPlanId !== sectionRuns[1].sectionPlan.sectionPlanId,
    'The two sections must execute from independent ReportPlans and SectionPlans.');

  // This is the generation/gold boundary: no source-report read is permitted above it.
  const generationCompletedAtIso = now();
  const generationBarrier = Object.freeze({
    completedAtIso: generationCompletedAtIso,
    allReviewersAllowDisplay: sectionRuns.every(run => run.execution.presentation.userVisibility === 'allowed'),
    sectionReleaseVersions: sectionRuns.map(run => run.spec.releaseVersion),
  });
  invariant(generationBarrier.allReviewersAllowDisplay, 'Both guarded sections must pass review before gold access.');

  const absoluteSourcePdfPath = path.resolve(sourcePdfPath);
  const sourcePdfBytes = await readFile(absoluteSourcePdfPath);
  const sourcePdfSha256 = sha256(sourcePdfBytes);
  invariant(sourcePdfSha256 === EXPECTED.sourcePdfSha256,
    `Original report SHA-256 mismatch; expected TK5452 source ${EXPECTED.sourcePdfSha256}.`);
  const originalOpenedAfterGenerationAtIso = now();
  invariant(Date.parse(originalOpenedAfterGenerationAtIso) >= Date.parse(generationCompletedAtIso),
    'Original report access must occur after generation.');
  const originalPages = await originalPageReader({
    sourcePdfPath: absoluteSourcePdfPath,
    pageNumbers: SECTION_SPECS.map(spec => spec.sourcePageNumber),
    generationBarrier,
  });
  invariant(originalPages instanceof Map, 'Original-page reader must return a Map keyed by page number.');
  invariant(/scope\s+of\s+inspection/i.test(originalPages.get(4) ?? ''),
    'Source PDF page 4 does not contain the Scope of Inspection section.');
  invariant(/general\s+tank\s+information/i.test(originalPages.get(6) ?? ''),
    'Source PDF page 6 does not contain the General Tank Information section.');

  if (observed) {
    await Promise.all(sectionRuns.map(async run => {
      const evaluatorStartedAtIso = now();
      const originalContent = originalPages.get(run.spec.sourcePageNumber);
      const goldPacket = {
        contractVersion: 'sealed_section_gold_v1',
        sectionId: run.spec.sectionId,
        sourceReportId: `source-report:${sourcePdfSha256}`,
        originalContent,
        contentSha256: sha256(originalContent),
        openedAfterGenerationAtIso: originalOpenedAfterGenerationAtIso,
      };
      run.goldPacket = goldPacket;
      run.evaluatorResult = await runSectionGoldEvaluation({
        reportProfileId: REPORT_PROFILE_ID,
        guardedResult: run.execution,
        goldPacket,
      });
      run.evaluatorTiming = { startedAtIso: evaluatorStartedAtIso, completedAtIso: now() };
    }));
  }

  let atomicEvaluationBundle = null;
  if (observed) {
    const { stdout: gitCommitOutput } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd: HERE,
      encoding: 'utf8',
    });
    atomicEvaluationBundle = await buildTk5452AtomicEvaluationBundle({
      sectionRuns,
      routerReleaseBinding,
      routerManifestSha256,
      appExportSha256: appExport.sha256,
      sourcePdfSha256,
      gitCommit: gitCommitOutput.trim(),
    });
  }

  const routingManifestSha256 = canonicalSha256(routingResult.routingManifest);
  const sections = sectionRuns.map(run => {
    const { spec, projection, execution } = run;
    return {
      sectionId: spec.sectionId,
      sectionTitle: spec.sectionTitle,
      sourcePageNumber: spec.sourcePageNumber,
      originalSectionContent: originalPages.get(spec.sourcePageNumber),
      originalOpenedAfterGenerationAtIso,
      generatedContent: execution.presentation.draft.content,
      appEvidence: appEvidenceFor({
        projection,
        spec,
        scopeConfirmation: scopeConfirmation.value,
        generationResult: execution.generationResult,
      }),
      evidenceSnapshotSummary: {
        contractVersion: 'section_agent_evidence_snapshot_v1',
        projectionContractVersion: 'section_evidence_projection_v2',
        routingStatus: 'routing_ready',
        readinessScope: 'evidence_routing_only',
        sectionProjectionSha256: run.evidenceSnapshot.routerBinding.sectionProjectionSha256,
        routingManifestSha256: run.evidenceSnapshot.routerBinding.routingManifestSha256,
      },
      generationResultSummary: {
        releaseVersion: spec.releaseVersion,
        manifestSha256: run.releaseManifestSha256,
        runId: execution.generationResult.trace?.runId,
        generatedAtIso: execution.generationResult.trace?.generatedAtIso,
        validationValid: execution.generationResult.validation?.valid === true,
        approvalStatus: 'not_approved',
      },
      preDisplayReview: execution.preDisplayReview,
      ...(observed ? {
        planBindingSummary: {
          reportPlanSha256: run.reportPlan.reportPlanSha256,
          sectionPlanSha256: run.sectionPlan.sectionPlanSha256,
          evidenceSnapshotSha256: run.sectionPlan.evidenceSnapshotSha256,
        },
        postGenerationEvaluation: run.evaluatorResult,
      } : {}),
    };
  });
  const runCompletedAtIso = now();
  const monitoring = observed ? buildTk5452AgentMonitoring({
    evaluationCaseId,
    reportProfileId: REPORT_PROFILE_ID,
    timing: {
      runStartedAtIso,
      inputStartedAtIso,
      inputCompletedAtIso,
      routerStartedAtIso,
      routerCompletedAtIso,
      generationCompletedAtIso,
      goldOpenedAtIso: originalOpenedAfterGenerationAtIso,
      runCompletedAtIso,
    },
    inputArtifacts: {
      appExport: { sha256: appExport.sha256, value: appExport.value },
      androidReceipt: { sha256: receipt.sha256, value: receipt.value },
      reviewedDecisions: { sha256: reviewedDecisions.sha256, value: reviewedDecisions.value },
      scopeConfirmation: { sha256: scopeConfirmation.sha256, value: scopeConfirmation.value },
    },
    routingResult,
    routerReleaseBinding,
    routerManifestSha256,
    sectionRuns,
    sections,
    scopeConfirmation: scopeConfirmation.value,
    sourcePdfSha256,
    atomicEvaluationBundle,
  }) : null;
  const review = {
    contractVersion: reviewContract,
    evaluationCaseId,
    source: {
      absolutePath: absoluteSourcePdfPath,
      fileName: path.basename(absoluteSourcePdfPath),
      sha256: sourcePdfSha256,
    },
    routing: {
      releaseId: ROUTER_RELEASE_ID,
      releaseManifestSha256: routerManifestSha256,
      inputPackageHash: routingResult.inputPackageHash,
      routingManifestHash: routingResult.routingManifest.manifestHash,
      routingManifestSha256,
      androidExportSha256: appExport.sha256,
      androidReceiptSha256: receipt.sha256,
      receiptVerifiedExportSha256: receipt.value.exportSha256,
      reviewedDecisionsSha256: reviewedDecisions.sha256,
      reviewedDecisionCount: reviewedDecisions.value.length,
      totalEvidenceCount: routingResult.routingReview.counts.total,
      routedEvidenceCount: routingResult.routingReview.counts.routed,
      excludedEvidenceCount: routingResult.routingReview.counts.excluded,
      dispositionCoverage: routingResult.routingReview.dispositionCoverage,
      unresolvedCount: routingResult.routingReview.counts.needs_review,
      thicknessUnit: appExport.value.unitProfile.thicknessUnit,
      measurementCount: measurements.length,
      measurementUnitSource: 'unitProfile.thicknessUnit',
      readinessScope: 'evidence_routing_only',
      selectedSectionsRoutingReady: true,
      wholeJobRoutingReady: true,
    },
    sections,
    ...(observed ? {
      agentMonitoringArtifact: 'agent-monitoring.json',
      atomicEvaluationArtifacts: {
        agentConfigurations: 'agent-configurations.json',
        atomicEvaluations: 'atomic-evaluations.json',
      },
    } : {}),
    createdAtIso: runCompletedAtIso,
    evaluationOnly: true,
    productEnabled: false,
  };
  const outputRoot = path.resolve(effectiveOutputDirectory);
  await mkdir(outputRoot, { recursive: true });
  const reviewBytes = Buffer.from(`${JSON.stringify(review, null, 2)}\n`);
  // Monitoring payloads retain full authorized stage previews. Persist the JSON
  // compactly so the admin UI does not pay a multi-megabyte whitespace penalty.
  const monitoringBytes = observed ? Buffer.from(`${JSON.stringify(monitoring)}\n`) : null;
  const agentConfigurationsBytes = observed
    ? Buffer.from(`${JSON.stringify(atomicEvaluationBundle.agentConfigurations, null, 2)}\n`) : null;
  const atomicEvaluationsBytes = observed
    ? Buffer.from(`${JSON.stringify(atomicEvaluationBundle.evaluations, null, 2)}\n`) : null;
  const manifest = {
    contractVersion: reviewManifestContract,
    evaluationOnly: true,
    evaluationCaseId,
    files: {
      'review.json': sha256(reviewBytes),
      ...(observed ? {
        'agent-monitoring.json': sha256(monitoringBytes),
        'agent-configurations.json': sha256(agentConfigurationsBytes),
        'atomic-evaluations.json': sha256(atomicEvaluationsBytes),
        'reviewed-routing-decisions.json': reviewedDecisions.sha256,
        'scope-confirmation.json': scopeConfirmation.sha256,
      } : {}),
    },
  };
  const reviewPath = path.join(outputRoot, 'review.json');
  const manifestPath = path.join(outputRoot, 'manifest.json');
  await writeFile(reviewPath, reviewBytes);
  if (observed) {
    await Promise.all([
      writeFile(path.join(outputRoot, 'agent-monitoring.json'), monitoringBytes),
      writeFile(path.join(outputRoot, 'agent-configurations.json'), agentConfigurationsBytes),
      writeFile(path.join(outputRoot, 'atomic-evaluations.json'), atomicEvaluationsBytes),
      writeFile(path.join(outputRoot, 'reviewed-routing-decisions.json'), reviewedDecisions.bytes),
      writeFile(path.join(outputRoot, 'scope-confirmation.json'), scopeConfirmation.bytes),
    ]);
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return {
    evaluationCaseId,
    reviewPath,
    manifestPath,
    review,
    manifest,
    generationBarrier,
    monitoring,
  };
}

export function runTk5452ObservedSectionsEvaluation(options = {}) {
  return runTk5452RoutedSectionsEvaluation({ ...options, observed: true });
}

function parseCliArgs(argv) {
  const optionMap = Object.freeze({
    '--app-export': 'appExportPath',
    '--android-receipt': 'androidReceiptPath',
    '--routing-decisions': 'reviewedDecisionsPath',
    '--scope-confirmation': 'scopeConfirmationPath',
    '--source-pdf': 'sourcePdfPath',
    '--output': 'outputDirectory',
  });
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') return { help: true };
    if (arg === '--observed') {
      result.observed = true;
      continue;
    }
    const key = optionMap[arg];
    if (!key) throw new Error(`Unknown argument ${arg}.`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${arg} requires a path.`);
    result[key] = path.resolve(value);
    index += 1;
  }
  return result;
}

function usage() {
  return [
    'Usage: node run.mjs [options]',
    '  --app-export PATH',
    '  --android-receipt PATH',
    '  --routing-decisions PATH',
    '  --scope-confirmation PATH',
    '  --source-pdf PATH',
    '  --output DIRECTORY',
    '  --observed  Run the all-agent monitoring and evaluation-matrix successor case',
  ].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  let cliOptions;
  try {
    cliOptions = parseCliArgs(process.argv.slice(2));
    if (cliOptions.help) {
      process.stdout.write(`${usage()}\n`);
    } else {
      const result = await runTk5452RoutedSectionsEvaluation(cliOptions);
      process.stdout.write(`${JSON.stringify({
        evaluationCaseId: result.evaluationCaseId,
        manifestPath: result.manifestPath,
        reviewPath: result.reviewPath,
        sections: result.review.sections.map(section => ({
          sectionId: section.sectionId,
          releaseVersion: section.generationResultSummary.releaseVersion,
          displayDecision: section.preDisplayReview.decision,
          sourcePageNumber: section.sourcePageNumber,
        })),
        routing: result.review.routing,
        ...(result.monitoring ? {
          monitoring: {
            traceId: result.monitoring.trace.traceId,
            qualificationDecision: result.monitoring.evaluationMatrix.outcomes.qualificationDecision,
            hardGates: result.monitoring.evaluationMatrix.summary,
          },
        } : {}),
      }, null, 2)}\n`);
    }
  } catch (error) {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  }
}
