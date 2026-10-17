import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomizeEvidence } from './atomizers/evidence-atomizer/v5/atomizer.mjs';
import { guardEvaluationInput } from './input-guards/evaluation-leakage/v1/guard.mjs';
import {
  executeContentsClassificationRelease,
  guardReviewedContentsClassificationRelease,
  resolveContentsClassificationRelease,
} from './release-registry.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUTLINE = JSON.parse(await readFile(path.join(HERE, 'outline-profiles/vertical-api653-v6/outline-profile.json'), 'utf8'));
const SECTIONS = new Map(OUTLINE.sections.map((section) => [section.sectionId, new Set(section.blocks)]));
const RELEASE_ID = 'contents-classification-evaluation-v1';
const RUN_CONTRACT = 'contents_classification_evaluation_run_v1';
const REVIEW_CONTRACT = 'sealed_classification_decisions_v1';
export const SECTION_EVIDENCE_PACKAGE_CONTRACT = 'section_evidence_package_v1';
export const SECTION_EVIDENCE_PACKAGE_BUNDLE_CONTRACT = 'section_evidence_package_bundle_v1';
const FORBIDDEN_RUNTIME_KEYS = new Set([
  'gold', 'hiddenGold', 'validationGold', 'expectedSection', 'expectedBlock', 'referenceAnswer',
  'referenceTextUnits', 'evaluatorCrosswalk', 'originalReport', 'sourceReportPage',
]);

const clone = (value) => structuredClone(value);
const canonicalize = (value) => Array.isArray(value) ? value.map(canonicalize)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
    : value;
export const pathwaySha256 = (value) => createHash('sha256')
  .update(Buffer.isBuffer(value) ? value : typeof value === 'string' ? value : JSON.stringify(canonicalize(value)))
  .digest('hex');

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function requiredText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function assertNoEvaluatorOnlyData(value, at = 'runtime') {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_RUNTIME_KEYS.has(key)) throw new Error(`Evaluator-only data is prohibited at ${at}.${key}.`);
    assertNoEvaluatorOnlyData(item, `${at}.${key}`);
  }
}

function assertHashEnvelope(value, hashKey, label) {
  const expected = value?.[hashKey];
  assert.match(String(expected ?? ''), /^[a-f0-9]{64}$/, `${label} hash is invalid.`);
  const copy = clone(value);
  delete copy[hashKey];
  assert.equal(pathwaySha256(copy), expected, `${label} changed after sealing.`);
}

function validateRoute(sectionId, blockId) {
  const blocks = SECTIONS.get(sectionId);
  if (!blocks) throw new Error(`Unknown reviewed section ${sectionId}.`);
  if (!blocks.has(blockId)) throw new Error(`Block ${blockId} does not belong to ${sectionId}.`);
}

function buildReviewQueue(classification) {
  const atoms = new Map(classification.evidenceAtoms.map((atom) => [atom.evidenceId, atom]));
  return classification.classificationAssignments
    .filter((assignment) => assignment.decisionState === 'needs_review')
    .map((assignment) => {
      const atom = atoms.get(assignment.evidenceId);
      assert(atom, `Review assignment ${assignment.evidenceId} has no evidence atom.`);
      const proposedUse = assignment.uses[0] ?? null;
      return {
        reviewItemId: `review_${pathwaySha256({ evidenceId: assignment.evidenceId, inputPackageHash: classification.inputPackageHash }).slice(0, 24)}`,
        evidenceId: assignment.evidenceId,
        evidenceKind: atom.kind,
        sourcePointer: atom.sourcePointer,
        sourceSpan: atom.sourceSpan,
        displayText: atom.displayText,
        proposedSectionId: assignment.sectionDecision?.sectionId ?? null,
        proposedBlockId: assignment.blockDecision?.blockId ?? null,
        proposedRole: proposedUse?.role ?? 'supporting',
        sectionConfidence: assignment.sectionDecision?.confidence ?? 0,
        blockConfidence: assignment.blockDecision?.confidence ?? 0,
        classifierFeedback: assignment.feedback,
        status: 'pending_human_review',
      };
    });
}

function rawBytes(rawExportBytes) {
  if (Buffer.isBuffer(rawExportBytes)) return rawExportBytes;
  if (typeof rawExportBytes === 'string') return Buffer.from(rawExportBytes);
  throw new TypeError('Exact raw Android export bytes are required.');
}

export class ContentsClassificationPathwayBlockedError extends Error {
  constructor(message, { stageId, details } = {}) {
    super(message);
    this.name = 'ContentsClassificationPathwayBlockedError';
    this.stageId = stageId;
    this.details = details;
  }
}

export async function runContentsClassificationEvaluationPathway({
  rawExportBytes, exportPackage, androidReceipt, lineageSecret, referenceTextUnits = [],
  narrativeWorker = null, modelId = null, releaseId = RELEASE_ID,
  generatedAtIso = new Date().toISOString(),
} = {}) {
  if (releaseId !== RELEASE_ID) throw new Error(`The evaluation pathway requires exact release ${RELEASE_ID}.`);
  const bytes = rawBytes(rawExportBytes);
  const parsed = JSON.parse(bytes.toString('utf8'));
  assert.deepEqual(canonicalize(parsed), canonicalize(exportPackage), 'Parsed Android export does not match the supplied raw bytes.');
  const guarded = guardEvaluationInput({
    exportPackage, androidReceipt, lineageSecret,
    rawExportSha256: pathwaySha256(bytes), rawExportByteSize: bytes.byteLength, referenceTextUnits,
  });
  if (guarded.decision !== 'passed' || !guarded.sealedInput) {
    throw new ContentsClassificationPathwayBlockedError('Android export input guard blocked classification.', {
      stageId: 'android-export-input-guard', details: guarded.runtimeReceipt,
    });
  }
  const atomization = atomizeEvidence({ sealedInput: guarded.sealedInput });
  const execution = await executeContentsClassificationRelease({
    releaseId, executionMode: 'evaluation', atomization, narrativeWorker, modelId,
  });
  const notRun = execution.classification.classificationAssignments.filter((item) => item.decisionState === 'not_run');
  if (notRun.length) {
    throw new ContentsClassificationPathwayBlockedError('Narrative classification did not run for every voice atom.', {
      stageId: 'registered-contents-classifier',
      details: { notRunEvidenceIds: notRun.map((item) => item.evidenceId) },
    });
  }
  const reviewQueue = buildReviewQueue(execution.classification);
  const runtimeRun = {
    contractVersion: RUN_CONTRACT, executionMode: 'evaluation', releaseId,
    releaseBinding: execution.releaseBinding, inputReceipt: guarded.runtimeReceipt,
    atomization, classification: execution.classification, classificationGuard: execution.guard,
    reviewQueue, status: reviewQueue.length ? 'awaiting_human_review' : 'ready_for_section_packaging',
    humanReviewRequired: reviewQueue.length > 0, evaluationSectionAgentEligible: false,
    productGenerationEligible: false, productEnabled: false, generatedAtIso,
  };
  assertNoEvaluatorOnlyData(runtimeRun);
  runtimeRun.runSha256 = pathwaySha256(runtimeRun);
  return deepFreeze({
    runtimeRun,
    evaluatorPrivate: { visibility: 'evaluator_only', evaluatorCrosswalk: guarded.evaluatorCrosswalk },
  });
}

function reviewedRoute(item, decision) {
  if (decision.action === 'exclude') return null;
  if (decision.action === 'approve') {
    if (!item.proposedSectionId || !item.proposedBlockId) {
      throw new Error(`Review item ${item.reviewItemId} has no complete proposal to approve.`);
    }
    validateRoute(item.proposedSectionId, item.proposedBlockId);
    return { sectionId: item.proposedSectionId, blockId: item.proposedBlockId, role: item.proposedRole, method: 'human_approved_llm_proposal' };
  }
  if (decision.action === 'correct') {
    const sectionId = requiredText(decision.sectionId, `Corrected section for ${item.reviewItemId}`);
    const blockId = requiredText(decision.blockId, `Corrected block for ${item.reviewItemId}`);
    validateRoute(sectionId, blockId);
    return { sectionId, blockId, role: decision.role ?? item.proposedRole, method: 'human_corrected' };
  }
  throw new Error(`Unsupported review action for ${item.reviewItemId}.`);
}

export async function sealContentsClassificationReview({ runtimeRun, decisions, reviewer } = {}) {
  assert.equal(runtimeRun?.contractVersion, RUN_CONTRACT, 'A contents-classification evaluation run is required.');
  assertHashEnvelope(runtimeRun, 'runSha256', 'Classification run');
  assert.equal(runtimeRun.releaseId, RELEASE_ID, 'Classification run uses an unexpected release.');
  assert.equal(runtimeRun.productEnabled, false, 'Product execution is prohibited.');
  assert(Array.isArray(decisions), 'Review decisions must be an array.');
  const reviewerId = requiredText(reviewer?.userId, 'Reviewer user ID');
  const reviewerRole = requiredText(reviewer?.role, 'Reviewer role');
  assert.equal(reviewer?.authorizationScope, 'contents_classification_review', 'Reviewer lacks classification-review authority.');
  const reviewedAtIso = requiredText(reviewer?.reviewedAtIso ?? new Date().toISOString(), 'Review time');
  const queue = new Map(runtimeRun.reviewQueue.map((item) => [item.reviewItemId, item]));
  const decisionByItem = new Map();
  for (const decision of decisions) {
    const id = requiredText(decision?.reviewItemId, 'Review item ID');
    if (!queue.has(id)) throw new Error(`Review decision references unknown item ${id}.`);
    if (decisionByItem.has(id)) throw new Error(`Review item ${id} was decided more than once.`);
    decisionByItem.set(id, decision);
  }
  const missing = [...queue.keys()].filter((id) => !decisionByItem.has(id));
  if (missing.length) throw new Error(`Human review is incomplete for ${missing.length} item(s).`);

  const itemByEvidence = new Map(runtimeRun.reviewQueue.map((item) => [item.evidenceId, item]));
  const reviewRecords = [];
  const assignments = runtimeRun.classification.classificationAssignments.map((source) => {
    if (source.decisionState !== 'needs_review') return clone(source);
    const item = itemByEvidence.get(source.evidenceId);
    assert(item, `Missing review item for ${source.evidenceId}.`);
    const decision = decisionByItem.get(item.reviewItemId);
    const route = reviewedRoute(item, decision);
    const reviewRecord = {
      reviewItemId: item.reviewItemId,
      reviewDecisionId: `decision_${pathwaySha256({ runSha256: runtimeRun.runSha256, reviewItemId: item.reviewItemId, decision }).slice(0, 24)}`,
      evidenceId: source.evidenceId, action: decision.action,
      sectionId: route?.sectionId ?? null, blockId: route?.blockId ?? null,
      reviewerId, reviewerRole, reviewedAtIso,
      reason: requiredText(decision.reason, `Review reason for ${item.reviewItemId}`),
    };
    reviewRecords.push(reviewRecord);
    if (!route) return {
      ...clone(source), decisionState: 'excluded', uses: [],
      sectionDecision: { state: 'excluded', sectionId: null, confidence: 1 },
      blockDecision: { state: 'excluded', blockId: null, confidence: 1 }, feedback: reviewRecord.reason,
    };
    const use = { ...route, confidence: 1 };
    return {
      ...clone(source), decisionState: 'reviewed', uses: [use],
      sectionDecision: { state: 'reviewed', sectionId: route.sectionId, confidence: 1 },
      blockDecision: { state: 'reviewed', blockId: route.blockId, confidence: 1 }, feedback: reviewRecord.reason,
    };
  });
  const reviewedClassification = clone(runtimeRun.classification);
  reviewedClassification.classificationAssignments = assignments;
  reviewedClassification.unresolvedItems = [];
  reviewedClassification.classificationManifest = {
    ...reviewedClassification.classificationManifest,
    reviewedFromOutputSha256: runtimeRun.classification.classificationManifest.outputSha256,
    reviewedAssignmentCount: reviewRecords.length,
    outputSha256: pathwaySha256(assignments), reviewedAtIso,
  };
  const reviewedGuard = await guardReviewedContentsClassificationRelease({
    releaseId: runtimeRun.releaseId, executionMode: 'evaluation', classification: reviewedClassification,
  });
  const sealed = {
    contractVersion: REVIEW_CONTRACT, executionMode: 'evaluation', releaseId: runtimeRun.releaseId,
    releaseBinding: clone(runtimeRun.releaseBinding), runSha256: runtimeRun.runSha256,
    inputPackageHash: runtimeRun.atomization.inputPackageHash, reviewedClassification, reviewedGuard,
    reviewRecords, humanReviewComplete: true, evaluationSectionAgentEligible: true,
    productGenerationEligible: false, productEnabled: false, sealedAtIso: reviewedAtIso,
  };
  assertNoEvaluatorOnlyData(sealed);
  sealed.sealedDecisionsSha256 = pathwaySha256(sealed);
  return deepFreeze(sealed);
}

export function buildSectionEvidencePackages({ sealedDecisions, reviewedSectionSelection } = {}) {
  assert.equal(sealedDecisions?.contractVersion, REVIEW_CONTRACT, 'Sealed reviewed classification decisions are required.');
  assertHashEnvelope(sealedDecisions, 'sealedDecisionsSha256', 'Sealed classification decisions');
  assert.equal(sealedDecisions.humanReviewComplete, true, 'Human review is incomplete.');
  assert.equal(sealedDecisions.productEnabled, false, 'Product generation is prohibited.');
  assert(Array.isArray(reviewedSectionSelection) && reviewedSectionSelection.length > 0, 'A reviewed section selection is required.');
  const selection = [...new Set(reviewedSectionSelection.map((item) => requiredText(item, 'Selected section ID')))];
  selection.forEach((sectionId) => {
    if (!SECTIONS.has(sectionId)) throw new Error(`Unknown selected section ${sectionId}.`);
  });
  const atoms = new Map(sealedDecisions.reviewedClassification.evidenceAtoms.map((atom) => [atom.evidenceId, atom]));
  const reviewByEvidence = new Map(sealedDecisions.reviewRecords.map((record) => [record.evidenceId, record]));
  const assignments = sealedDecisions.reviewedClassification.classificationAssignments;
  if (assignments.some((assignment) => ['needs_review', 'not_run'].includes(assignment.decisionState))) {
    throw new Error('Unreviewed classification assignments cannot enter section evidence packages.');
  }
  const packages = selection.map((sectionId) => {
    const evidenceRecords = [];
    for (const assignment of assignments) {
      const atom = atoms.get(assignment.evidenceId);
      assert(atom, `Classification assignment ${assignment.evidenceId} has no source atom.`);
      for (const use of assignment.uses.filter((item) => item.sectionId === sectionId)) {
        validateRoute(use.sectionId, use.blockId);
        const review = reviewByEvidence.get(assignment.evidenceId);
        evidenceRecords.push({
          evidenceId: assignment.evidenceId, sourcePointer: atom.sourcePointer, sourceSpan: atom.sourceSpan,
          evidenceKind: atom.kind, originalValue: clone(atom.originalValue), displayText: atom.displayText,
          unit: atom.unit, entity: clone(atom.entity), relationships: clone(atom.relationships),
          blockId: use.blockId, role: use.role, routeMethod: use.method,
          reviewDecisionId: review?.reviewDecisionId ?? null, evidenceSha256: atom.evidenceSha256,
        });
      }
    }
    if (!evidenceRecords.length) throw new Error(`Selected section ${sectionId} has no reviewed evidence.`);
    const byBlock = Object.fromEntries([...new Set(evidenceRecords.map((record) => record.blockId))].sort()
      .map((blockId) => [blockId, evidenceRecords.filter((record) => record.blockId === blockId).map((record) => record.evidenceId)]));
    const evidencePackage = {
      contractVersion: SECTION_EVIDENCE_PACKAGE_CONTRACT, executionMode: 'evaluation', sectionId,
      inputPackageHash: sealedDecisions.inputPackageHash,
      classifierReleaseBinding: clone(sealedDecisions.releaseBinding),
      sealedDecisionsSha256: sealedDecisions.sealedDecisionsSha256,
      evidenceRecords, byBlock, humanReviewComplete: true,
      status: 'ready_for_section_agent_evaluation', evaluationSectionAgentEligible: true,
      productGenerationEligible: false, productEnabled: false,
    };
    evidencePackage.packageSha256 = pathwaySha256(evidencePackage);
    return evidencePackage;
  });
  const bundle = {
    contractVersion: SECTION_EVIDENCE_PACKAGE_BUNDLE_CONTRACT, executionMode: 'evaluation',
    inputPackageHash: sealedDecisions.inputPackageHash,
    classifierReleaseBinding: clone(sealedDecisions.releaseBinding),
    sealedDecisionsSha256: sealedDecisions.sealedDecisionsSha256,
    reviewedSectionSelection: selection, packages, packageCount: packages.length,
    status: 'ready_for_section_agent_evaluation', evaluationSectionAgentEligible: true,
    productGenerationEligible: false, productEnabled: false,
  };
  assertNoEvaluatorOnlyData(bundle);
  bundle.bundleSha256 = pathwaySha256(bundle);
  return deepFreeze(bundle);
}

function validateClassifierBinding(binding) {
  const release = resolveContentsClassificationRelease({
    releaseId: binding?.releaseId,
    executionMode: 'evaluation',
  });
  for (const key of ['manifestSha256', 'qualifiedCandidateFingerprintSha256', 'releaseRuntimeFingerprintSha256']) {
    assert.equal(binding?.[key], release[key], `Section evidence package has an invalid classifier ${key}.`);
  }
}

export function validateSectionEvidencePackage(evidencePackage, { sectionId = null } = {}) {
  assert.equal(evidencePackage?.contractVersion, SECTION_EVIDENCE_PACKAGE_CONTRACT,
    'A reviewed section evidence package is required.');
  assertHashEnvelope(evidencePackage, 'packageSha256', 'Section evidence package');
  assert.equal(evidencePackage.executionMode, 'evaluation', 'Only the qualified evaluation pathway is available.');
  assert.equal(evidencePackage.humanReviewComplete, true, 'Section evidence package has not completed human review.');
  assert.equal(evidencePackage.status, 'ready_for_section_agent_evaluation', 'Section evidence package is not ready.');
  assert.equal(evidencePackage.evaluationSectionAgentEligible, true, 'Section evidence package is not evaluation eligible.');
  assert.equal(evidencePackage.productGenerationEligible, false, 'Product generation must remain disabled.');
  assert.equal(evidencePackage.productEnabled, false, 'Product execution must remain disabled.');
  assert.match(String(evidencePackage.inputPackageHash ?? ''), /^[a-f0-9]{64}$/, 'Input package hash is invalid.');
  assert.match(String(evidencePackage.sealedDecisionsSha256 ?? ''), /^[a-f0-9]{64}$/, 'Review seal hash is invalid.');
  validateClassifierBinding(evidencePackage.classifierReleaseBinding);
  if (sectionId !== null) assert.equal(evidencePackage.sectionId, sectionId, 'Section evidence package is for another section.');
  validateRoute(evidencePackage.sectionId, Object.keys(evidencePackage.byBlock ?? {})[0] ?? '');
  assert(Array.isArray(evidencePackage.evidenceRecords) && evidencePackage.evidenceRecords.length > 0,
    'Section evidence package has no reviewed evidence.');
  const evidenceIds = new Set();
  for (const record of evidencePackage.evidenceRecords) {
    requiredText(record.evidenceId, 'Evidence ID');
    if (evidenceIds.has(record.evidenceId)) throw new Error(`Duplicate evidence record ${record.evidenceId}.`);
    evidenceIds.add(record.evidenceId);
    validateRoute(evidencePackage.sectionId, record.blockId);
    assert.match(String(record.evidenceSha256 ?? ''), /^[a-f0-9]{64}$/, `Evidence ${record.evidenceId} hash is invalid.`);
    assert((evidencePackage.byBlock[record.blockId] ?? []).includes(record.evidenceId),
      `Evidence ${record.evidenceId} is absent from its block index.`);
  }
  for (const [blockId, ids] of Object.entries(evidencePackage.byBlock)) {
    validateRoute(evidencePackage.sectionId, blockId);
    assert(Array.isArray(ids) && ids.length > 0, `Block ${blockId} has no evidence IDs.`);
    for (const evidenceId of ids) assert(evidenceIds.has(evidenceId), `Block ${blockId} references unknown evidence ${evidenceId}.`);
  }
  assertNoEvaluatorOnlyData(evidencePackage);
  return true;
}

export function validateSectionEvidencePackageBundle(bundle) {
  assert.equal(bundle?.contractVersion, SECTION_EVIDENCE_PACKAGE_BUNDLE_CONTRACT,
    'A reviewed section evidence package bundle is required.');
  assertHashEnvelope(bundle, 'bundleSha256', 'Section evidence package bundle');
  assert.equal(bundle.executionMode, 'evaluation', 'Only the qualified evaluation pathway is available.');
  assert.equal(bundle.status, 'ready_for_section_agent_evaluation', 'Section evidence bundle is not ready.');
  assert.equal(bundle.evaluationSectionAgentEligible, true, 'Section evidence bundle is not evaluation eligible.');
  assert.equal(bundle.productGenerationEligible, false, 'Product generation must remain disabled.');
  assert.equal(bundle.productEnabled, false, 'Product execution must remain disabled.');
  validateClassifierBinding(bundle.classifierReleaseBinding);
  assert(Array.isArray(bundle.packages) && bundle.packages.length === bundle.packageCount,
    'Section evidence package count does not match the bundle.');
  assert.deepEqual(bundle.packages.map((item) => item.sectionId), bundle.reviewedSectionSelection,
    'Section evidence package selection does not match the bundle.');
  for (const evidencePackage of bundle.packages) {
    validateSectionEvidencePackage(evidencePackage, { sectionId: evidencePackage.sectionId });
    assert.equal(evidencePackage.inputPackageHash, bundle.inputPackageHash, 'Package input does not match its bundle.');
    assert.equal(evidencePackage.sealedDecisionsSha256, bundle.sealedDecisionsSha256,
      'Package review seal does not match its bundle.');
    assert.deepEqual(evidencePackage.classifierReleaseBinding, bundle.classifierReleaseBinding,
      'Package classifier binding does not match its bundle.');
  }
  assertNoEvaluatorOnlyData(bundle);
  return true;
}

export const __test = { assertNoEvaluatorOnlyData, buildReviewQueue, canonicalize, validateRoute };
