#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCommonCorePackCandidates, COMMON_CORE_SECTION_DEFINITIONS,
  parseCommonCorePackCliArguments } from './build-common-core-section-pack-candidates.mjs';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const specsRoot = join(appRoot, 'server/section-agents/specs/vertical-tank-v1');
const requiredFiles = ['README.md', 'agent-spec.json', 'kb-policy.json', 'harness.json'];
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

assert.deepEqual(parseCommonCorePackCliArguments(['--output', '/tmp/out']), { outputArg: '/tmp/out', sourceArg: null });
assert.deepEqual(parseCommonCorePackCliArguments(['--source', '/tmp/in', '--output', '/tmp/out']),
  { outputArg: '/tmp/out', sourceArg: '/tmp/in' });
assert.throws(() => parseCommonCorePackCliArguments(['--output', '--source', '/tmp/in']), /requires a value/);

const directories = (await readdir(specsRoot, { withFileTypes: true }))
  .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
assert.deepEqual(directories, COMMON_CORE_SECTION_DEFINITIONS.map(definition => `${String(definition.order).padStart(2, '0')}-${definition.sectionId}`));

for (const definition of COMMON_CORE_SECTION_DEFINITIONS) {
  const folder = join(specsRoot, `${String(definition.order).padStart(2, '0')}-${definition.sectionId}`);
  const files = (await readdir(folder)).sort();
  assert.deepEqual(files, [...requiredFiles].sort(), `Unexpected files for ${definition.sectionId}`);
  const [agent, kb, harness] = await Promise.all(['agent-spec.json', 'kb-policy.json', 'harness.json']
    .map(name => readFile(join(folder, name), 'utf8').then(JSON.parse)));
  assert.equal(agent.contractVersion, 'section_agent_spec_v1');
  assert.equal(agent.profileId, 'vertical_tank_inspection_v1');
  assert.deepEqual(agent.reportSection, { number: definition.order, sectionId: definition.sectionId, title: definition.title });
  assert.equal(agent.productEnabled, false);
  assert(agent.outputBlocks.length > 0 && new Set(agent.outputBlocks.map(block => block.blockId)).size === agent.outputBlocks.length);
  for (const key of ['generationMode', 'promptPolicy', 'authorizedInputs', 'approvalBlockers', 'prohibitedBehavior']) assert(has(agent, key));
  assert(!JSON.stringify(agent).includes('"latest"'));

  assert.equal(kb.contractVersion, 'section_kb_policy_candidate_v1');
  assert.equal(kb.sectionId, definition.sectionId);
  assert.equal(kb.governedSource.exactSectionKey, definition.sectionId);
  assert.equal(kb.governedSource.exactSectionKeyOnly, true);
  assert.equal(kb.governedSource.requiredDatasetSplit, 'training');
  assert.equal(kb.currentFactsFromHistoricalSources, false);
  assert(kb.runtimeExclusions.includes('target_report') && kb.runtimeExclusions.includes('same_asset_or_scenario_lineage'));
  assert(kb.runtimeExclusions.includes('validation_gold') && kb.runtimeExclusions.includes('hidden_test_gold'));
  assert(kb.forbiddenUses.includes('current_tank_fact') && kb.forbiddenUses.includes('automatic_approval'));

  assert.equal(harness.contractVersion, 'section_agent_harness_spec_v1');
  assert.equal(harness.sectionId, definition.sectionId);
  assert.equal(harness.executionMode, 'evaluation');
  assert.equal(harness.productEnabled, false);
  assert.equal(harness.datasetRules.goldAvailableDuringGeneration, false);
  assert.equal(harness.datasetRules.sameLineageRetrievalAllowed, false);
  assert.equal(harness.freezeGates.criticalIntegrityBlockers, 0);
  assert.equal(harness.freezeGates.protectedFactAccuracy, 1);
  assert.equal(harness.freezeGates.unsupportedCurrentClaims, 0);
  assert.equal(harness.freezeGates.leakageFindings, 0);
  for (const required of ['wrong_section_or_version_rejection', 'production_mode_rejection', 'unapproved_draft', 'kb_snapshot_hash_integrity', 'dependency_tamper_rejection', 'cross_agent_isolation']) {
    assert(harness.requiredTests.includes(required), `${definition.sectionId} missing ${required}`);
  }
  const implemented = {
    'scope-of-inspection': {
      releaseId: 'scope_of_inspection_v1',
      runtimeSnapshot: 'scope_of_inspection_v1_no_runtime_retrieval',
      minimumHarnessReferences: 2,
    },
    'general-tank-information': {
      releaseId: 'general_tank_information_v2',
      runtimeSnapshot: 'general_tank_information_v2_no_runtime_retrieval',
      minimumHarnessReferences: 4,
    },
  }[definition.sectionId];
  if (implemented) {
    assert.equal(agent.status, 'frozen_evaluation_candidate');
    assert.equal(kb.mode, 'frozen_no_retrieval');
    assert.equal(agent.plannedReleaseId, implemented.releaseId);
    assert.equal(kb.runtimeSnapshot, implemented.runtimeSnapshot);
    assert(agent.frozenReleaseReference);
    await readFile(resolve(folder, agent.frozenReleaseReference));
    assert(harness.existingHarnessReferences.length >= implemented.minimumHarnessReferences);
  } else {
    assert.equal(agent.status, 'planned');
    assert.equal(kb.status, 'definition_only_not_frozen');
    assert.equal(agent.frozenReleaseReference, null);
  }
}

// Prove the private candidate splitter accepts only unique vertical training
// documents and never copies report text into its manifests.
const temp = await mkdtemp(join(tmpdir(), 'laiq-common-core-spec-audit-'));
try {
  const sourceRoot = join(temp, 'source');
  const outputRoot = join(temp, 'output');
  const headings = COMMON_CORE_SECTION_DEFINITIONS.map((definition, index) => ({
    block_id: `block-${index + 1}`, block_type: 'heading', heading_level: 1,
    text: `${index + 1} ${definition.title}`, source_spans: [{ page_number: index + 4 }], extraction_confidence: 0.99,
  }));
  async function fixture(name, { split, sha, horizontal = false, misleadingCover = false }) {
    const folder = join(sourceRoot, name); await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'manifest.json'), JSON.stringify({ identity: {
      document_id: `document-${name}`, case_id: `case-${name}`, source_sha256: sha,
      source_path: horizontal ? `/private/${name}-horizontal.pdf` : `/private/${name}.pdf`,
      report_family: 'internal_external_api653', dataset_split: split,
    }}));
    let blocks = horizontal ? [...headings, { block_id: 'horizontal', block_type: 'heading', heading_level: 1,
      text: '8 HORIZONTAL TANK LAYOUT', source_spans: [{ page_number: 20 }], extraction_confidence: 0.99 }] : headings;
    if (misleadingCover) blocks = [{ block_id: 'cover', block_type: 'heading', heading_level: 1,
      text: 'HORIZONTAL TANK ON STREAM INSPECTION CORRUPTED COVER TEXT', source_spans: [{ page_number: 1 }], extraction_confidence: 0.4 }, ...blocks];
    await writeFile(join(folder, 'parsed-document.json'), JSON.stringify({ blocks }));
  }
  await fixture('training', { split: 'training', sha: 'a'.repeat(64) });
  await fixture('duplicate', { split: 'training', sha: 'a'.repeat(64) });
  await fixture('misleading-cover', { split: 'training', sha: 'd'.repeat(64), misleadingCover: true });
  await fixture('hidden', { split: 'hidden_test', sha: 'b'.repeat(64) });
  await fixture('horizontal', { split: 'training', sha: 'c'.repeat(64), horizontal: true });
  const index = await buildCommonCorePackCandidates({ sourceRoot, outputRoot });
  assert.equal(index.eligibleTrainingDocuments, 2);
  assert.equal(index.packs.length, 7);
  for (const item of index.packs) {
    assert.equal(item.sourceCount, 2);
    const packText = await readFile(join(outputRoot, item.path), 'utf8');
    assert(!packText.includes('/private/'));
    const pack = JSON.parse(packText);
    assert.equal(pack.runtimeRetrievalEnabled, false);
    assert.equal(pack.contentIncluded, false);
    assert(pack.members.every(member => member.datasetSplit === 'training'));
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}

console.log(JSON.stringify({ passed: true, profileId: 'vertical_tank_inspection_v1', sectionAgentFolders: 7,
  filesPerFolder: requiredFiles, frozenAgentReferencesVerified: 2, privatePackSplitterVerified: true,
  productEnabled: false }, null, 2));
