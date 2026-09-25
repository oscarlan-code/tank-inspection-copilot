// Offline, read-only corpus consolidation. No DB connection or generation call.
// Usage: node server/scripts/build-generic-outline-review.mjs --snapshot FILE
// Optional: --review-input FILE --output-dir DIR
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { getGenericOutlineCatalog } from '../experiments/generic-outline-catalog.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const arg = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const snapshotPath = arg('--snapshot');
if (!snapshotPath) throw new Error('--snapshot is required; use a read-only KB structural export.');
const reviewPath = arg('--review-input', resolve(root, 'docs/reviews/data/kb-outline-source-review-2026-09-17.json'));
const outputDir = arg('--output-dir', resolve(root, 'docs/reviews/data'));
const [snapshotBytes, reviewBytes] = await Promise.all([readFile(snapshotPath), readFile(reviewPath)]);
const snapshot = JSON.parse(snapshotBytes);
const review = JSON.parse(reviewBytes);
const catalog = getGenericOutlineCatalog();
const nativeDocs = new Map(snapshot.documents.map((d) => [d.document_id, d]));
const chunks = new Map(snapshot.chunks.map((c) => [c.chunk_id, c]));
assert.equal(nativeDocs.size, snapshot.documents.length, 'Duplicate KB document ID');
assert.equal(new Set(review.documents.map((d) => d.documentId)).size, review.documents.length, 'Duplicate reviewed document ID');
assert.deepEqual([...nativeDocs.keys()].sort(), review.documents.map((d) => d.documentId).sort(), 'Review must cover every KB entry exactly once');

// Observed labels map to reusable templates. This is a design crosswalk, NOT
// the live evidence classifier. Distinct historical rows remain in the audit.
const groups = {
  identity: ['identity', 'history', 'asset-information'],
  scope: ['scope', 'scope-purpose'],
  regime: ['regime', 'history-regime'],
  findings: ['inspection-findings'],
  recommendations: ['recommendations', 'shell-repairs'],
  methods: ['test-information', 'method-equipment'],
  checklist: ['checklist'],
  thickness: ['roof-ut', 'roof-nozzle-ut', 'shell-ut', 'nozzle-ut', 'sump-ut', 'floor-ut', 'annular-ut', 'thickness-measurements'],
  layout: ['roof-layout', 'shell-layout', 'floor-layout', 'settlement-locations', 'component-layout'],
  calculations: ['shell-minimum-thickness', 'horizontal-minimum-thickness', 'end-cap-assessment', 'floor-corrosion-rate', 'shell-corrosion-rate', 'roof-corrosion-rate', 'annular-corrosion-rate', 'calculation-assessment'],
  ndt: ['additional-ndt', 'area-scan', 'shell-external-mpi', 'shell-internal-mpi', 'floor-mpi', 'ndt-examination'],
  survey: ['settlement-results', 'roundness', 'plumbness', 'floor-settlement', 'edge-settlement', 'survey-readings'],
  graphs: ['settlement-graphs', 'plumbness-graphs', 'survey-graphs-locations'],
  photos: ['photos', 'photographs'],
  'method-guidance': ['mfl-guidance', 'attached-procedure'],
  'corrosion-plan': ['floor-corrosion-plan'],
  platemaps: ['mfl-platemaps', 'mfl-layout-platemaps'],
  assessment: ['engineering-summary', 'secondary-containment'],
  'scan-profiles': ['bscan-profiles'],
  dimensional: ['3d-floor', 'dimensional-profile', 'scan-metadata', 'station-profile'],
  'repair-verification': ['post-repair-verification'],
  consultation: ['repair-consultation'],
  calibration: ['calibration-table'],
  references: ['codes-and-references', 'technical-references'],
  summary: ['assessment-summary'],
};
const allAliases = new Set(Object.values(groups).flat());
const count = (values) => Object.fromEntries([...new Set(values)].sort().map((v) => [v, values.filter((x) => x === v).length]));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const unique = (values) => [...new Set(values)];
const citationIssues = [];
const documents = review.documents.map((d) => {
  const native = nativeDocs.get(d.documentId);
  assert.equal(d.sourceSha256, native.source_sha256, `Source revision changed: ${d.documentId}`);
  assert.ok(catalog.profiles.some((p) => p.id === d.candidateProfileId), `Unknown profile ${d.candidateProfileId}`);
  for (const [alias, citations] of Object.entries(d.detectedModules)) {
    assert.ok(allAliases.has(alias), `Unmapped observed module: ${alias}`);
    for (const citation of citations) {
      const chunk = chunks.get(citation.chunkId);
      assert.ok(chunk, `Missing cited chunk ${citation.chunkId}`);
      assert.equal(chunk.document_id, d.documentId, `Wrong source for ${citation.chunkId}`);
      for (const page of citation.pages ?? []) assert.ok((chunk.page_numbers_json ?? []).includes(page), `Page mismatch ${citation.chunkId}:${page}`);
      if (!(citation.pages ?? []).length) citationIssues.push({ documentId: d.documentId, chunkId: citation.chunkId, issue: 'no_page_provenance' });
    }
  }
  const registry = snapshot.registry.filter((r) => r.binary_sha256 === native.source_sha256 || r.content_sha256 === native.source_sha256);
  return { ...d, datasetSplit: native.dataset_split, documentRole: native.document_role, approvalStatus: native.approval_status,
    sectionCount: snapshot.sections.filter((s) => s.document_id === d.documentId).length,
    chunkCount: snapshot.chunks.filter((c) => c.document_id === d.documentId).length,
    structureDesignExposure: true, independentStructuralHoldoutEligible: false,
    registryMatches: registry.map((r) => ({ corpusReportId: r.corpus_report_id, assetLineageKey: r.asset_lineage_key, reportReference: r.report_reference })),
  };
});
for (const schema of review.tableSchemaVariants) {
  const c = chunks.get(schema.source.chunkId);
  assert.ok(c && c.document_id === schema.source.documentId, 'Table schema citation must resolve to its source');
  for (const p of schema.source.pages) assert.ok(c.page_numbers_json.includes(p), 'Table schema page must resolve');
}
const hashes = unique(documents.map((d) => d.sourceSha256));
const duplicates = hashes.map((hash) => ({ sourceSha256: hash, documentIds: documents.filter((d) => d.sourceSha256 === hash).map((d) => d.documentId) })).filter((g) => g.documentIds.length > 1);
const splitOverlaps = duplicates.map((g) => ({ ...g, splits: unique(documents.filter((d) => g.documentIds.includes(d.documentId)).map((d) => d.datasetSplit)) })).filter((g) => g.splits.length > 1);
const supports = catalog.modules.map((m) => {
  const aliases = groups[m.id];
  const sources = documents.filter((d) => aliases.some((alias) => d.detectedModules[alias]?.length));
  const approved = sources.filter((d) => d.approvalStatus === 'approved' && !d.extractionLimited);
  const pageLocated = approved.filter((d) => aliases.some((alias) => d.detectedModules[alias]?.some((c) => c.pages?.length)));
  return { moduleId: m.id, observedLabels: aliases, detectedUniqueSourceFiles: unique(sources.map((d) => d.sourceSha256)).length,
    approvedUsableUniqueSourceFiles: unique(approved.map((d) => d.sourceSha256)).length,
    pageLocatedApprovedUniqueSourceFiles: unique(pageLocated.map((d) => d.sourceSha256)).length,
    fixtureSourceFiles: unique(sources.filter((d) => d.testFixture).map((d) => d.sourceSha256)).length,
    sourceDocumentIds: sources.map((d) => d.documentId),
    examples: pageLocated.slice(0, 3).map((d) => ({ documentId: d.documentId, sourceName: d.sourceName, ...aliases.flatMap((a) => d.detectedModules[a] ?? []).find((c) => c.pages?.length) })),
  };
});
assert.ok(supports.every((s) => s.detectedUniqueSourceFiles > 0), 'Every candidate module needs source support');
const profileSupport = catalog.profiles.map((p) => {
  const sources = documents.filter((d) => d.candidateProfileId === p.id);
  return { profileId: p.id, documentEntries: sources.length, uniqueSourceFiles: unique(sources.map((d) => d.sourceSha256)).length, extractionLimitedEntries: sources.filter((d) => d.extractionLimited).length, fixtureEntries: sources.filter((d) => d.testFixture).length, sourceDocumentIds: sources.map((d) => d.documentId) };
});
const audit = {
  version: 'all_kb_outline_audit_v1', reviewedAt: snapshot.reviewedAt,
  snapshotSha256: sha(snapshotBytes), reviewInputSha256: sha(reviewBytes), catalogueVersion: catalog.version, catalogueRevision: catalog.revision,
  formatContractVersion: catalog.reportFormat.version,
  reviewMethod: review.reviewMethod,
  status: 'evaluation_design_candidate_not_human_approved', productionChanged: false,
  totals: { documentEntries: documents.length, uniqueSourceFiles: hashes.length, duplicateEntries: documents.length - hashes.length,
    extractedSections: snapshot.sections.length, extractedChunks: snapshot.chunks.length,
    corpusRegistryRows: snapshot.registry.length, registryRowsAreNotKbDocumentCount: true,
    approvalStatus: count(documents.map((d) => d.approvalStatus)),
    datasetSplitEntries: count(documents.map((d) => d.datasetSplit)),
    extractionLimitedEntries: documents.filter((d) => d.extractionLimited).length,
    entriesWithoutAnyPageProvenance: documents.filter((d) => !snapshot.chunks.some((c) => c.document_id === d.documentId && c.page_numbers_json?.length)).length,
    testFixtureEntries: documents.filter((d) => d.testFixture).length,
  },
  sourceCountingPolicy: 'Deduplicate exact source hashes. Counts are source-file support, not independent reports: alternate formats, revisions and asset lineages remain correlated. Rejected/flattened sources stay in the inventory and are excluded from approved usable support. Test fixtures are separately identified.',
  exposurePolicy: 'All 166 inventoried entries informed structure design. Preserve original splits but do not reuse them as untouched structural holdouts. Structural access is not evidence that production retrieval consumed gold answers.',
  duplicateGroups: duplicates, duplicateGroupsAcrossSplits: splitOverlaps, citationIssues,
  modules: supports, profiles: profileSupport,
  tableSchemaVariants: review.tableSchemaVariants,
  sources: documents.map(({ detectedModules, ...d }) => ({ ...d, observedModuleLabels: Object.keys(detectedModules) })),
};
await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, 'kb-outline-audit-2026-09-17.json'), `${JSON.stringify(audit, null, 2)}\n`);
await writeFile(resolve(outputDir, 'generic-report-outline-v1.json'), `${JSON.stringify({ ...catalog, corpusReview: { auditFile: 'kb-outline-audit-2026-09-17.json', sourceReviewFile: 'kb-outline-source-review-2026-09-17.json', totals: audit.totals, supportCountsAreNotRequirements: true }, modules: catalog.modules.map((m) => ({ ...m, corpusSupport: supports.find((s) => s.moduleId === m.id) })), profiles: catalog.profiles.map((p) => ({ ...p, corpusSupport: profileSupport.find((s) => s.profileId === p.id) })) }, null, 2)}\n`);
console.log(JSON.stringify({ totals: audit.totals, modules: supports.map((s) => [s.moduleId, s.approvedUsableUniqueSourceFiles]), profiles: profileSupport.map((p) => [p.profileId, p.uniqueSourceFiles]), crossSplitDuplicateGroups: splitOverlaps.length }, null, 2));
