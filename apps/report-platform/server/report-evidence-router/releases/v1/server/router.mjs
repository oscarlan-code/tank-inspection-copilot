import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSectionPlanningSnapshot } from '../../../../section-planner.mjs';

export const ROUTING_CONTRACT_VERSION = 'report_evidence_routing_v1';
export const ROUTER_RELEASE_ID = 'report-evidence-router_v1';

const clone = (value) => JSON.parse(JSON.stringify(value));
const canonical = (value) => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
const hash = (value) => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
const issueKey = (issue) => `${issue.reason}:${issue.detail ?? ''}`;

function validateReviewedDecisions(decisions) {
  if (!Array.isArray(decisions)) throw new TypeError('reviewedDecisions must be an array');
  for (const decision of decisions) {
    if (!decision || typeof decision !== 'object' || Array.isArray(decision)) throw new TypeError('Each reviewed decision must be an object');
    if (!decision.decisionId || !decision.actorId) throw new Error('Every routing decision requires decisionId and authenticated actorId');
    if (decision.kind !== 'section_scope' && !decision.evidenceId) throw new Error('Evidence routing decisions require evidenceId');
  }
}

function acceptedIssues(record) {
  const status = String(record.sourceRecord?.transcriptStatus ?? '').toLowerCase();
  return (record.quality?.issues ?? []).filter((issue) => !(issue.reason === 'unverified_transcript' && status === 'ready'));
}

function automaticExclusion(record, exportPackage) {
  if (record.kind !== 'attachment' || record.sourceRecord?.kind !== 'voice_audio') return null;
  const note = (exportPackage.voiceNotes ?? []).find((candidate) =>
    candidate.relativePath && candidate.relativePath === record.sourceRecord.relativePath);
  return note ? {
    reasonCode: 'voice_media_source_only',
    reason: `Audio remains source provenance for voice note ${note.voiceNoteId}; its transcript is routed separately.`,
    basis: 'verified_rule',
  } : null;
}

function explicitExclusion(record, exclusions) {
  return exclusions.find((candidate) => candidate.evidenceId === record.evidenceId
    || candidate.sourcePointer === record.sourceRef.pointer) ?? null;
}

function sectionUses(snapshot) {
  const result = new Map();
  for (const plan of snapshot.sectionPlans) for (const use of plan.evidenceUses ?? []) {
    for (const evidenceId of use.evidenceIds ?? []) {
      if (!result.has(evidenceId)) result.set(evidenceId, []);
      result.get(evidenceId).push(clone(use));
    }
  }
  return result;
}

function addGeneralInformationEvidence(snapshot, exportPackage) {
  const fields = exportPackage.inspectionRecord?.generalTankInformation;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return;
  const alreadyCanonical = new Set(['client', 'tankNumber', 'location', 'fieldLeaseName', 'inspector', 'externalRoofType', 'internalRoofType']);
  const identity = new Set(['clientRepresentative', 'jobNo']);
  const inspectionDetails = new Set(['dateCompleted']);
  const plan = snapshot.sectionPlans.find((candidate) => candidate.sectionId === 'general-tank-information');
  if (!plan) throw new Error('General Tank Information section contract is missing');
  for (const [fieldKey, value] of Object.entries(fields)) {
    if (alreadyCanonical.has(fieldKey)) continue;
    const sourcePointer = `/inspectionRecord/generalTankInformation/${fieldKey}`;
    const evidenceId = `evidence_${hash([snapshot.inputPackageHash, 'general_tank_information', sourcePointer]).slice(0, 28)}`;
    const slotKey = fieldKey.startsWith('previous') ? 'history' : identity.has(fieldKey) ? 'identity' : inspectionDetails.has(fieldKey) ? 'inspection-details' : 'configuration';
    const record = {
      evidenceId,
      kind: 'identity',
      sourceClass: 'app_field',
      sourceRef: { pointer: sourcePointer, nativeRecordId: `generalTankInformation:${fieldKey}`, importHash: snapshot.inputPackageHash },
      entityId: `${exportPackage.inspectionId ?? exportPackage.inspectionRecord?.inspectionId ?? 'unidentified-inspection'}:tank:component`,
      locationRef: { targetKey: 'tank', itemKey: null, plateId: null, course: null, laneId: null, elementId: null, itemLabel: null },
      captureContext: { screenKey: 'general_tank_information', cardKey: 'general_tank_information', fieldKey, targetKey: 'tank', itemKey: null, itemLabel: null, sectionKey: null, capturedAtIso: null },
      payload: { fieldKey, value: clone(value), text: `${fieldKey}: ${value === '' ? 'Not provided' : String(value)}` },
      displayText: `${fieldKey}: ${value === '' ? 'Not provided' : String(value)}`,
      quality: { status: 'reviewed', issues: [] },
      sourceRecord: { fieldKey, value: clone(value) },
      classificationFacts: { kind: 'identity', sourceCollection: 'inspectionRecord.generalTankInformation', fieldKey, targetKey: 'tank', screenKey: 'general_tank_information', component: null, action: false, element: false, measurementContext: 'other', image: false, eligible: true },
    };
    snapshot.evidenceRecords.push(record);
    const useId = `use_${hash([evidenceId, 'general-tank-information', slotKey, 'required_structured']).slice(0, 24)}`;
    plan.evidenceUses.push({
      useId, evidenceIds: [evidenceId], entityIds: [record.entityId], sectionId: 'general-tank-information',
      role: 'required_structured', projection: 'identity_fields', blockId: `general-tank-information:${slotKey}`,
      slotKey, relatedSectionId: null, decision: { basis: 'verified_rule', ruleOrReviewId: `report-evidence-router-v1:generalTankInformation:${fieldKey}` },
      preserve: ['entity', 'location', 'value', 'unit', 'source_reference'],
    });
  }
}

function projectionFor(plan, ledgerById) {
  const uses = (plan.evidenceUses ?? []).map(clone);
  const evidenceIds = [...new Set(uses.flatMap((use) => use.evidenceIds ?? []))];
  const evidenceRecords = evidenceIds.map((id) => ledgerById.get(id)).filter(Boolean).map(clone);
  const blockers = evidenceRecords.filter((record) => record.disposition.state === 'needs_review')
    .map((record) => ({ evidenceId: record.evidenceId, issues: record.quality.issues }));
  return {
    contractVersion: 'section_evidence_projection_v1',
    sectionId: plan.sectionId,
    title: plan.title,
    inputPackageHash: plan.inputPackageHash,
    sourcePlanId: plan.planId,
    evidenceUses: uses,
    evidenceRecords,
    blockers,
    status: blockers.length ? 'blocked' : uses.length ? 'ready' : 'empty',
  };
}

/**
 * Pure routing boundary. It never mutates exportPackage, never opens historical
 * reports or gold, and never treats unreviewed model proposals as decisions.
 */
export function routeReportEvidence({
  exportPackage,
  reviewedDecisions = [],
  routingProposals = [],
  explicitExclusions = [],
  selectedSectionIds = null,
  manualInputs = {},
  scope = {},
} = {}) {
  if (!exportPackage || typeof exportPackage !== 'object' || Array.isArray(exportPackage)) throw new TypeError('exportPackage must be an object');
  validateReviewedDecisions(reviewedDecisions);
  if (!Array.isArray(routingProposals)) throw new TypeError('routingProposals must be an array');
  if (!Array.isArray(explicitExclusions)) throw new TypeError('explicitExclusions must be an array');
  const inputBefore = canonical(exportPackage);
  const snapshot = buildSectionPlanningSnapshot({ exportPackage, decisions: reviewedDecisions, manualInputs, scope });
  if (canonical(exportPackage) !== inputBefore) throw new Error('Canonical evidence planner mutated the imported package');

  addGeneralInformationEvidence(snapshot, exportPackage);

  const useMap = sectionUses(snapshot);
  const evidenceLedger = snapshot.evidenceRecords.map((sourceRecord) => {
    const record = clone(sourceRecord);
    record.quality.issues = acceptedIssues(record);
    record.quality.status = record.quality.issues.length ? 'needs_review' : 'reviewed';
    record.uses = useMap.get(record.evidenceId) ?? [];
    const exclusion = automaticExclusion(record, exportPackage) ?? explicitExclusion(record, explicitExclusions);
    if (exclusion) {
      if (!exclusion.reasonCode || !exclusion.reason) throw new Error(`Explicit exclusion for ${record.evidenceId} requires reasonCode and reason`);
      record.disposition = { state: 'excluded', reason: exclusion.reason, reasonCode: exclusion.reasonCode, basis: exclusion.basis ?? 'reviewer_confirmed' };
    } else if (record.quality.issues.length) {
      record.disposition = { state: 'needs_review', reason: [...new Set(record.quality.issues.map(issueKey))].join('; '), reasonCode: 'unresolved_quality_or_classification' };
    } else if (record.uses.length) {
      record.disposition = { state: 'routed', reason: 'At least one verified or reviewer-confirmed section use exists.', reasonCode: 'has_section_use' };
    } else {
      record.disposition = { state: 'needs_review', reason: 'Retained evidence has no reviewed section/block use or explicit exclusion.', reasonCode: 'unrouted_retained_evidence' };
    }
    return record;
  });

  const ledgerById = new Map(evidenceLedger.map((record) => [record.evidenceId, record]));
  const selected = selectedSectionIds == null ? snapshot.sectionPlans.map((plan) => plan.sectionId) : selectedSectionIds;
  if (!Array.isArray(selected) || new Set(selected).size !== selected.length) throw new Error('selectedSectionIds must be null or a unique array');
  const known = new Set(snapshot.sectionPlans.map((plan) => plan.sectionId));
  for (const sectionId of selected) if (!known.has(sectionId)) throw new Error(`Unknown selected section ${sectionId}`);
  const sectionEvidenceProjections = Object.fromEntries(snapshot.sectionPlans
    .filter((plan) => selected.includes(plan.sectionId))
    .map((plan) => [plan.sectionId, projectionFor(plan, ledgerById)]));

  const counts = Object.fromEntries(['routed', 'excluded', 'needs_review'].map((state) => [state, evidenceLedger.filter((record) => record.disposition.state === state).length]));
  const unresolved = evidenceLedger.filter((record) => record.disposition.state === 'needs_review').map((record) => ({
    evidenceId: record.evidenceId,
    kind: record.kind,
    sourcePointer: record.sourceRef.pointer,
    displayText: record.displayText,
    issues: record.quality.issues,
    candidateUses: record.uses,
  }));
  const routingReview = {
    contractVersion: 'report_evidence_routing_review_v1',
    counts: { total: evidenceLedger.length, ...counts },
    dispositionCoverage: evidenceLedger.length ? (counts.routed + counts.excluded) / evidenceLedger.length : 1,
    unresolved,
    explicitExclusions: evidenceLedger.filter((record) => record.disposition.state === 'excluded').map((record) => ({ evidenceId: record.evidenceId, ...record.disposition })),
    pendingModelProposals: clone(routingProposals),
    proposalsAppliedToGeneration: false,
    sectionStatus: Object.fromEntries(Object.entries(sectionEvidenceProjections).map(([id, projection]) => [id, projection.status])),
    selectedSectionsReady: Object.values(sectionEvidenceProjections).every((projection) => projection.status === 'ready'),
  };
  const outputHashes = {
    evidenceLedger: hash(evidenceLedger),
    sectionEvidenceProjections: hash(sectionEvidenceProjections),
    routingReview: hash(routingReview),
  };
  const routingManifest = {
    contractVersion: 'report_evidence_routing_manifest_v1',
    releaseId: ROUTER_RELEASE_ID,
    inputPackageHash: snapshot.inputPackageHash,
    sourcePlanningSnapshotId: snapshot.snapshotId,
    sectionPlanningVersion: snapshot.contractVersion,
    sectionContractVersion: snapshot.sectionContractVersion,
    selectedSectionIds: clone(selected),
    reviewedDecisionIds: reviewedDecisions.map((decision) => decision.decisionId),
    outputHashes,
    manifestHash: hash({ releaseId: ROUTER_RELEASE_ID, inputPackageHash: snapshot.inputPackageHash, selected, reviewedDecisionIds: reviewedDecisions.map((decision) => decision.decisionId), outputHashes }),
  };
  return { contractVersion: ROUTING_CONTRACT_VERSION, releaseId: ROUTER_RELEASE_ID, inputPackageHash: snapshot.inputPackageHash, evidenceLedger, sectionEvidenceProjections, routingReview, routingManifest };
}

export async function writeRoutingArtifacts(result, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  const projectionDirectory = path.join(outputDirectory, 'section-evidence-projections');
  await mkdir(projectionDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDirectory, 'evidence-ledger.json'), `${JSON.stringify(result.evidenceLedger, null, 2)}\n`),
    writeFile(path.join(outputDirectory, 'routing-review.json'), `${JSON.stringify(result.routingReview, null, 2)}\n`),
    writeFile(path.join(outputDirectory, 'routing-manifest.json'), `${JSON.stringify(result.routingManifest, null, 2)}\n`),
    ...Object.entries(result.sectionEvidenceProjections).map(([sectionId, projection]) =>
      writeFile(path.join(projectionDirectory, `${sectionId}.json`), `${JSON.stringify(projection, null, 2)}\n`)),
  ]);
}

async function cli() {
  const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, values) => {
    if (value.startsWith('--')) pairs.push([value.slice(2), values[index + 1]]);
    return pairs;
  }, []));
  if (!args.input || !args.output) throw new Error('Usage: node router.mjs --input export.json --output directory [--decisions decisions.json] [--sections id,id]');
  const exportPackage = JSON.parse(await readFile(path.resolve(args.input), 'utf8'));
  const reviewedDecisions = args.decisions ? JSON.parse(await readFile(path.resolve(args.decisions), 'utf8')) : [];
  const selectedSectionIds = args.sections ? args.sections.split(',').filter(Boolean) : null;
  const result = routeReportEvidence({ exportPackage, reviewedDecisions, selectedSectionIds });
  await writeRoutingArtifacts(result, path.resolve(args.output));
  process.stdout.write(`${JSON.stringify({ output: path.resolve(args.output), counts: result.routingReview.counts, coverage: result.routingReview.dispositionCoverage, selectedSectionsReady: result.routingReview.selectedSectionsReady }, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) cli().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
