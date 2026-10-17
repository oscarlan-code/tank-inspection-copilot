import { createHash } from 'node:crypto';

export const SECTION_EVIDENCE_SNAPSHOT_CONTRACT = 'section_agent_evidence_snapshot_v1';
const ROUTING_CONTRACT = 'report_evidence_routing_v2';
const PROJECTION_CONTRACT = 'section_evidence_projection_v2';
const ROUTING_MANIFEST_CONTRACT = 'report_evidence_routing_manifest_v2';
const ROUTING_REVIEW_CONTRACT = 'report_evidence_routing_review_v2';
const ROUTER_RELEASE_ID = 'report-evidence-router_v2';
const SHA256 = /^[a-f0-9]{64}$/;
const FORBIDDEN_KEYS = new Set(['gold', 'hiddenGold', 'validationGold', 'originalSection', 'expectedSection', 'referenceAnswer']);

const clone = value => structuredClone(value);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

export const sectionEvidenceSha256 = value => createHash('sha256')
  .update(JSON.stringify(canonicalize(value))).digest('hex');

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

function assertNoEvaluatorOnlyData(value, path = 'sectionEvidenceSnapshot') {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) throw new Error(`Evaluator-only gold is prohibited at ${path}.${key}.`);
    assertNoEvaluatorOnlyData(item, `${path}.${key}`);
  }
}

function validateRouterReleaseBinding(binding, releaseId) {
  if (!binding || binding.agentId !== 'report-evidence-router' || binding.releaseId !== releaseId
      || binding.releaseId !== ROUTER_RELEASE_ID
      || !SHA256.test(String(binding.manifestSha256 ?? ''))) {
    throw new Error('Routing result is not bound to an exact server-owned router release.');
  }
  return {
    agentId: binding.agentId,
    releaseId: binding.releaseId,
    manifestSha256: binding.manifestSha256,
  };
}

function verifyRoutingResult({ exportPackage, routingResult, sectionId, routerReleaseBinding }) {
  if (!routingResult || routingResult.contractVersion !== ROUTING_CONTRACT) {
    throw new Error('Unsupported Report Evidence Routing Agent result.');
  }
  const releaseBinding = validateRouterReleaseBinding(routerReleaseBinding, routingResult.releaseId);
  const inputPackageHash = sectionEvidenceSha256(exportPackage);
  if (routingResult.inputPackageHash !== inputPackageHash) {
    throw new Error('Router result does not match the immutable Android export.');
  }
  const { routingManifest, routingReview, evidenceLedger, sectionEvidenceProjections } = routingResult;
  if (routingManifest?.contractVersion !== ROUTING_MANIFEST_CONTRACT
      || routingReview?.contractVersion !== ROUTING_REVIEW_CONTRACT
      || !Array.isArray(evidenceLedger) || !sectionEvidenceProjections || typeof sectionEvidenceProjections !== 'object') {
    throw new Error('Routing result is incomplete.');
  }
  if (routingManifest.releaseId !== releaseBinding.releaseId
      || routingManifest.inputPackageHash !== inputPackageHash
      || !routingManifest.selectedSectionIds?.includes(sectionId)) {
    throw new Error('Routing manifest does not select this section and import.');
  }
  const outputHashes = {
    evidenceLedger: sectionEvidenceSha256(evidenceLedger),
    sectionEvidenceProjections: sectionEvidenceSha256(sectionEvidenceProjections),
    routingReview: sectionEvidenceSha256(routingReview),
  };
  if (!routingManifest.outputHashes
      || Object.entries(outputHashes).some(([key, value]) => routingManifest.outputHashes[key] !== value)
      || Object.keys(routingManifest.outputHashes).length !== Object.keys(outputHashes).length) {
    throw new Error('Routing output hashes do not match the routing manifest.');
  }
  const expectedManifestHash = sectionEvidenceSha256({
    releaseId: routingManifest.releaseId,
    inputPackageHash: routingManifest.inputPackageHash,
    selected: routingManifest.selectedSectionIds,
    reviewedDecisionIds: routingManifest.reviewedDecisionIds,
    outputHashes,
  });
  if (routingManifest.manifestHash !== expectedManifestHash) {
    throw new Error('Routing manifest self-hash is invalid.');
  }
  const projection = sectionEvidenceProjections[sectionId];
  if (!projection || projection.contractVersion !== PROJECTION_CONTRACT || projection.sectionId !== sectionId
      || projection.inputPackageHash !== inputPackageHash || projection.routingStatus !== 'routing_ready'
      || projection.readinessScope !== 'evidence_routing_only' || projection.blockers?.length
      || routingReview.readinessScope !== 'evidence_routing_only'
      || routingReview.sectionRoutingStatus?.[sectionId] !== 'routing_ready') {
    throw new Error('Section evidence projection is missing, blocked or not routing-ready.');
  }
  return { releaseBinding, inputPackageHash, projection, routingManifest };
}

function isolateProjection(projection, inputPackageHash) {
  const uses = clone(projection.evidenceUses ?? []);
  if (uses.some(use => use.sectionId !== projection.sectionId)) {
    throw new Error('Section projection contains a top-level use for another section.');
  }
  const useById = new Map();
  for (const use of uses) {
    if (!use.useId || useById.has(use.useId) || !Array.isArray(use.evidenceIds) || !use.evidenceIds.length) {
      throw new Error('Section projection contains an invalid or duplicate evidence use.');
    }
    useById.set(use.useId, use);
  }
  const recordById = new Map();
  const records = (projection.evidenceRecords ?? []).map(source => {
    const record = clone(source);
    if (!record.evidenceId || recordById.has(record.evidenceId)
        || record.sourceRef?.importHash !== inputPackageHash
        || record.disposition?.state !== 'routed'
        || record.quality?.status !== 'reviewed' || record.quality?.issues?.length) {
      throw new Error('Section projection contains duplicate, unresolved or unreviewed evidence.');
    }
    record.uses = (record.uses ?? []).filter(use => use.sectionId === projection.sectionId);
    if (!record.uses.length) throw new Error('Projected evidence has no use in its selected section.');
    for (const use of record.uses) {
      const top = useById.get(use.useId);
      if (!top || !top.evidenceIds.includes(record.evidenceId)
          || sectionEvidenceSha256(top) !== sectionEvidenceSha256(use)) {
        throw new Error('Projected record use does not match the section use ledger.');
      }
    }
    recordById.set(record.evidenceId, record);
    return record;
  });
  for (const use of uses) for (const evidenceId of use.evidenceIds) {
    if (!recordById.has(evidenceId)) throw new Error('Section use references evidence outside the projection.');
  }
  return {
    ...clone(projection),
    evidenceUses: uses,
    evidenceRecords: records,
    blockers: [],
    routingStatus: 'routing_ready',
    readinessScope: 'evidence_routing_only',
  };
}

function pointerParts(pointer) {
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) return [];
  return pointer.slice(1).split('/').map(value => value.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function getAtPointer(value, pointer) {
  let current = value;
  for (const part of pointerParts(pointer)) {
    if (current == null || !Object.hasOwn(current, part)) return undefined;
    current = current[part];
  }
  return current;
}

function setObjectPath(target, parts, value) {
  let current = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (!current[part] || typeof current[part] !== 'object' || Array.isArray(current[part])) current[part] = {};
    current = current[part];
  }
  current[parts.at(-1)] = clone(value);
}

function buildScopedCompatibilityExport(exportPackage, projection) {
  const scoped = {
    packageType: exportPackage.packageType,
    schemaVersion: exportPackage.schemaVersion,
    inspectionId: exportPackage.inspectionId,
    inspectionReference: exportPackage.inspectionReference ?? null,
    inspectionRecord: { inspectionId: exportPackage.inspectionRecord?.inspectionId ?? exportPackage.inspectionId },
  };
  const arrayIndexes = new Map();
  for (const record of projection.evidenceRecords) {
    const parts = pointerParts(record.sourceRef.pointer);
    if (!parts.length) continue;
    if (parts[0] === 'inspectionRecord' && parts.length > 1) {
      const source = getAtPointer(exportPackage, `/${parts.join('/')}`);
      if (source !== undefined) setObjectPath(scoped.inspectionRecord, parts.slice(1), source);
      continue;
    }
    if (Array.isArray(exportPackage[parts[0]]) && /^\d+$/.test(parts[1] ?? '')) {
      if (!arrayIndexes.has(parts[0])) arrayIndexes.set(parts[0], new Set());
      arrayIndexes.get(parts[0]).add(Number(parts[1]));
    }
  }
  for (const [collection, indexes] of arrayIndexes) {
    scoped[collection] = [...indexes].sort((a, b) => a - b).map(index => clone(exportPackage[collection][index]));
  }
  if (scoped.inspectionChecklistItems) scoped.checklist = clone(scoped.inspectionChecklistItems);
  return scoped;
}

export function buildSectionEvidenceSnapshot({
  exportPackage,
  routingResult,
  sectionId,
  routerReleaseBinding,
  reviewedSectionInputs = {},
} = {}) {
  if (!exportPackage || typeof exportPackage !== 'object' || Array.isArray(exportPackage)) {
    throw new TypeError('An immutable Android export package is required.');
  }
  requiredText(sectionId, 'Section ID');
  if (!reviewedSectionInputs || typeof reviewedSectionInputs !== 'object' || Array.isArray(reviewedSectionInputs)) {
    throw new TypeError('reviewedSectionInputs must be an object.');
  }
  assertNoEvaluatorOnlyData(reviewedSectionInputs, 'reviewedSectionInputs');
  const verified = verifyRoutingResult({ exportPackage, routingResult, sectionId, routerReleaseBinding });
  const sectionProjection = isolateProjection(verified.projection, verified.inputPackageHash);
  const routingManifestSha256 = sectionEvidenceSha256(verified.routingManifest);
  const sectionProjectionSha256 = sectionEvidenceSha256(sectionProjection);
  const snapshot = {
    contractVersion: SECTION_EVIDENCE_SNAPSHOT_CONTRACT,
    sectionId,
    sourceImport: {
      packageType: requiredText(exportPackage.packageType, 'Android package type'),
      schemaVersion: exportPackage.schemaVersion,
      inspectionId: requiredText(exportPackage.inspectionId ?? exportPackage.inspectionRecord?.inspectionId, 'Inspection ID'),
      inputPackageHash: verified.inputPackageHash,
    },
    routerBinding: {
      ...verified.releaseBinding,
      routingManifestSha256,
      routingManifestHash: verified.routingManifest.manifestHash,
      sectionProjectionSha256,
      sourcePlanningSnapshotId: verified.routingManifest.sourcePlanningSnapshotId,
    },
    sectionProjection,
    exportPackage: buildScopedCompatibilityExport(exportPackage, sectionProjection),
    reviewedSectionInputs: clone(reviewedSectionInputs),
  };
  if (reviewedSectionInputs.scopeConfirmation !== undefined) {
    snapshot.scopeConfirmation = clone(reviewedSectionInputs.scopeConfirmation);
  }
  assertNoEvaluatorOnlyData(snapshot);
  validateSectionEvidenceSnapshot(snapshot, { sectionId });
  return deepFreeze(snapshot);
}

export function validateSectionEvidenceSnapshot(snapshot, { sectionId = null } = {}) {
  if (!snapshot || snapshot.contractVersion !== SECTION_EVIDENCE_SNAPSHOT_CONTRACT) {
    throw new Error('Unsupported section evidence snapshot.');
  }
  if (sectionId && snapshot.sectionId !== sectionId) throw new Error('Section evidence snapshot targets another section.');
  const source = snapshot.sourceImport;
  const binding = snapshot.routerBinding;
  if (!source || !requiredText(source.packageType, 'Source package type')
      || !Number.isInteger(source.schemaVersion) || !requiredText(source.inspectionId, 'Source inspection ID')
      || !SHA256.test(String(source.inputPackageHash ?? ''))) {
    throw new Error('Section evidence snapshot has invalid source import metadata.');
  }
  if (!binding || binding.agentId !== 'report-evidence-router'
      || !requiredText(binding.releaseId, 'Router release ID')
      || !SHA256.test(String(binding.manifestSha256 ?? ''))
      || !SHA256.test(String(binding.routingManifestSha256 ?? ''))
      || !SHA256.test(String(binding.routingManifestHash ?? ''))
      || !SHA256.test(String(binding.sectionProjectionSha256 ?? ''))) {
    throw new Error('Section evidence snapshot has an invalid router binding.');
  }
  if (snapshot.sectionProjection?.contractVersion !== PROJECTION_CONTRACT
      || snapshot.sectionProjection.sectionId !== snapshot.sectionId
      || snapshot.sectionProjection.inputPackageHash !== source.inputPackageHash
      || snapshot.sectionProjection.routingStatus !== 'routing_ready'
      || snapshot.sectionProjection.readinessScope !== 'evidence_routing_only'
      || snapshot.sectionProjection.blockers?.length) {
    throw new Error('Section evidence projection is not ready for this snapshot.');
  }
  if (sectionEvidenceSha256(snapshot.sectionProjection) !== binding.sectionProjectionSha256) {
    throw new Error('Section evidence projection changed after the snapshot was built.');
  }
  for (const use of snapshot.sectionProjection.evidenceUses ?? []) {
    if (use.sectionId !== snapshot.sectionId) throw new Error('Section evidence snapshot contains a cross-section use.');
  }
  for (const record of snapshot.sectionProjection.evidenceRecords ?? []) {
    if (record.sourceRef?.importHash !== source.inputPackageHash
        || record.disposition?.state !== 'routed' || record.quality?.status !== 'reviewed'
        || record.quality?.issues?.length || !record.uses?.length
        || record.uses.some(use => use.sectionId !== snapshot.sectionId)) {
      throw new Error('Section evidence snapshot contains unresolved or cross-section evidence.');
    }
  }
  if (snapshot.exportPackage?.packageType !== source.packageType
      || snapshot.exportPackage?.schemaVersion !== source.schemaVersion
      || snapshot.exportPackage?.inspectionId !== source.inspectionId
      || !snapshot.exportPackage?.inspectionRecord) {
    throw new Error('Scoped compatibility export does not match the source import identity.');
  }
  assertNoEvaluatorOnlyData(snapshot);
  return snapshot.routerBinding;
}
