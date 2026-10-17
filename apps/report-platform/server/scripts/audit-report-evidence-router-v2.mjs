import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeReportEvidence } from '../report-evidence-router/releases/v2/server/router.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const release = path.resolve(here, '../report-evidence-router/releases/v2');
const fixture = JSON.parse(await readFile(path.join(release, 'test-fixtures/android-export.json'), 'utf8'));
const before = JSON.stringify(fixture);

const first = routeReportEvidence({
  exportPackage: fixture,
  routingProposals: [{ proposalId: 'proposal-1', evidenceId: 'not-applied', sectionId: 'repair-recommendations' }],
  selectedSectionIds: ['general-tank-information', 'inspection-report', 'repair-recommendations', 'tank-inspection-checklist', 'shell-plate-thickness-measurements'],
});
assert.equal(JSON.stringify(fixture), before, 'router mutated the Android export');
assert.equal(first.contractVersion, 'report_evidence_routing_v2');
assert.equal(first.routingReview.proposalsAppliedToGeneration, false);
assert.equal(first.routingReview.pendingModelProposals.length, 1);
const audio = first.evidenceLedger.find((record) => record.kind === 'attachment');
assert.equal(audio.disposition.state, 'excluded');
assert.equal(audio.disposition.reasonCode, 'voice_media_source_only');
const measurement = first.evidenceLedger.find((record) => record.kind === 'measurement');
assert.equal(measurement.payload.unitCode, 'mm');
assert.equal(measurement.payload.unitSource, 'unitProfile.thicknessUnit');
assert(measurement.uses.some((use) => use.sectionId === 'shell-plate-thickness-measurements'));
assert(measurement.uses.some((use) => use.sectionId === 'inspection-report'));
for (const [sectionId, projection] of Object.entries(first.sectionEvidenceProjections)) {
  assert.equal(projection.contractVersion, 'section_evidence_projection_v2');
  assert.equal(projection.readinessScope, 'evidence_routing_only');
  assert.match(projection.routingStatus, /^routing_(?:ready|blocked|empty)$/);
  assert.equal(Object.hasOwn(projection, 'status'), false, 'generic projection status is ambiguous');
  assert(projection.evidenceUses.every((use) => use.sectionId === sectionId), `projection ${sectionId} contains a foreign evidence use`);
  for (const record of projection.evidenceRecords) {
    assert(record.uses.every((use) => use.sectionId === sectionId), `projection ${sectionId} leaked a nested use from another section`);
  }
}
const shellProjectionMeasurement = first.sectionEvidenceProjections['shell-plate-thickness-measurements'].evidenceRecords
  .find((record) => record.evidenceId === measurement.evidenceId);
const inspectionProjectionMeasurement = first.sectionEvidenceProjections['inspection-report'].evidenceRecords
  .find((record) => record.evidenceId === measurement.evidenceId);
assert(shellProjectionMeasurement.uses.length > 0);
assert(inspectionProjectionMeasurement.uses.length > 0);
assert(shellProjectionMeasurement.uses.every((use) => use.sectionId === 'shell-plate-thickness-measurements'));
assert(inspectionProjectionMeasurement.uses.every((use) => use.sectionId === 'inspection-report'));
assert.equal(first.routingReview.readinessScope, 'evidence_routing_only');
assert.equal(Object.hasOwn(first.routingReview, 'selectedSectionsReady'), false, 'generic readiness flag is ambiguous');
assert.equal(typeof first.routingReview.selectedSectionsRoutingReady, 'boolean');
assert.equal(typeof first.routingReview.wholeJobRoutingReady, 'boolean');
const generalProjection = first.sectionEvidenceProjections['general-tank-information'];
for (const fieldKey of ['jobNo', 'clientRepresentative', 'materialSpec', 'previousExternal']) {
  const record = generalProjection.evidenceRecords.find((candidate) => candidate.payload.fieldKey === fieldKey);
  assert(record, `nested General Tank Information field was not routed: ${fieldKey}`);
  assert.equal(record.sourceRef.pointer, `/inspectionRecord/generalTankInformation/${fieldKey}`);
}
const voiceClaims = first.evidenceLedger.filter((record) => record.kind === 'voice_claim');
assert.equal(voiceClaims.length, 2);
assert(voiceClaims.every((record) => !record.quality.issues.some((issue) => issue.reason === 'unverified_transcript')), 'canonical ready transcript was rejected');
const recommendation = voiceClaims.find((record) => /Recommended action/i.test(record.displayText));
assert(recommendation.quality.issues.some((issue) => issue.reason === 'unconfirmed_action'));
assert(!recommendation.uses.some((use) => use.sectionId === 'repair-recommendations' && use.role === 'required_narrative'), 'unreviewed model proposal entered generation');
assert.equal(recommendation.disposition.state, 'needs_review');

const reviewed = routeReportEvidence({
  exportPackage: fixture,
  reviewedDecisions: [{
    operation: 'add', evidenceId: recommendation.evidenceId, sectionId: 'repair-recommendations', slotKey: 'recommendations',
    role: 'required_narrative', reason: 'Inspector-confirmed recommendation from the current voice note.',
    decisionId: 'route-review-1', actorId: 'reviewer-1', createdAtIso: '2026-09-30T00:00:00Z'
  }],
  selectedSectionIds: ['repair-recommendations'],
});
const reviewedRecommendation = reviewed.evidenceLedger.find((record) => record.evidenceId === recommendation.evidenceId);
assert(reviewedRecommendation.uses.some((use) => use.sectionId === 'repair-recommendations' && use.role === 'required_narrative'));
assert(!reviewedRecommendation.quality.issues.some((issue) => issue.reason === 'unconfirmed_action'));
assert.equal(reviewed.sectionEvidenceProjections['repair-recommendations'].routingStatus, 'routing_ready');

const noUnit = JSON.parse(before);
delete noUnit.unitProfile;
const blocked = routeReportEvidence({ exportPackage: noUnit, selectedSectionIds: ['shell-plate-thickness-measurements'] });
assert.equal(blocked.sectionEvidenceProjections['shell-plate-thickness-measurements'].routingStatus, 'routing_blocked');
assert.equal(blocked.routingReview.selectedSectionsRoutingReady, false);
assert(blocked.evidenceLedger.find((record) => record.kind === 'measurement').quality.issues.some((issue) => issue.reason === 'unknown_unit'));

const conflictingUnit = JSON.parse(before);
conflictingUnit.utMeasurements[0].unitCode = 'in';
const conflict = routeReportEvidence({ exportPackage: conflictingUnit, selectedSectionIds: ['shell-plate-thickness-measurements'] });
const conflictingMeasurement = conflict.evidenceLedger.find((record) => record.kind === 'measurement');
assert.equal(conflictingMeasurement.payload.unitCode, 'in', 'explicit row unit must take precedence over the package profile');
assert.equal(conflictingMeasurement.payload.unitSource, 'row');
assert(conflictingMeasurement.quality.issues.some((issue) => issue.reason === 'conflicting_unit'));
assert.equal(conflict.sectionEvidenceProjections['shell-plate-thickness-measurements'].routingStatus, 'routing_blocked');

const registry = JSON.parse(await readFile(path.resolve(release, '../../release-registry.json'), 'utf8'));
assert.equal(registry.productReleaseId, null, 'router release must remain product-disabled');
assert(registry.releases.some((entry) => entry.releaseId === 'report-evidence-router_v1' && entry.status === 'frozen_evaluation_candidate'));
assert(registry.releases.some((entry) => entry.releaseId === 'report-evidence-router_v2' && entry.supersedes === 'report-evidence-router_v1'));

const manifest = JSON.parse(await readFile(path.join(release, 'manifest.json'), 'utf8'));
assert.equal(manifest.releaseId, 'report-evidence-router_v2');
assert.equal(manifest.productEnabled, false);
for (const [relative, expected] of Object.entries(manifest.files)) {
  const actual = createHash('sha256').update(await readFile(path.join(release, relative))).digest('hex');
  assert.equal(actual, expected, `release file hash mismatch: ${relative}`);
}
for (const [relative, expected] of Object.entries(manifest.dependencies)) {
  const actual = createHash('sha256').update(await readFile(path.resolve(release, relative))).digest('hex');
  assert.equal(actual, expected, `dependency hash mismatch: ${relative}`);
}

console.log('Report Evidence Routing Agent v2 audit passed: immutable import, deterministic and multi-use routing, section-scoped nested uses, routing-only readiness, Android unit-profile precedence, reviewed voice gate, explicit audio exclusion, blockers and pinned hashes.');
