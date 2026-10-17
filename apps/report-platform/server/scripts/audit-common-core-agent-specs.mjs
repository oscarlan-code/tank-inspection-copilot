#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCommonCorePackCandidates, COMMON_CORE_SECTION_DEFINITIONS,
  parseCommonCorePackCliArguments } from './build-common-core-section-pack-candidates.mjs';
import { buildSourceObligationInventory, parseInventoryArguments } from
  '../section-agents/evaluation-workflows/inspection-report/inventory.mjs';
import { buildInspectionReportKnowledgeCandidate, parseKnowledgeCandidateArguments } from
  '../section-agents/evaluation-workflows/inspection-report/build-knowledge-bundle-candidate.mjs';

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
  if (definition.sectionId === 'inspection-report') {
    assert.equal(agent.outputBlockPolicy.catalogSource, 'frozen_section_knowledge_bundle');
    assert.equal(agent.outputBlockPolicy.allSupportedBlocksRequiredInEveryReport, false);
    assert(!agent.outputBlocks.some((block) => ['inspection-extent', 'inspection-implication']
      .includes(block.blockId)));
    assert(agent.outputBlocks.filter((block) => block.blockId !== 'heading')
      .every((block) => block.format.startsWith('report_plan_selected_')));
    assert.equal(kb.governedSource.requiredEligibilityRole, 'knowledge_reference');
    assert.deepEqual(Object.keys(harness.evaluationTracks), ['interpretation', 'generation']);
    assert(harness.robustnessProtocol.variantFamilies.length >= 8);
    assert.equal(harness.robustnessProtocol.kbAblationRequired, true);
    assert.equal(harness.robustnessProtocol.goldTextMaySeedNarrativeVariants, false);
    assert.equal(harness.knowledgeQualification.minimumKnowledgeReferenceLineages, 10);
    assert.equal(harness.knowledgeQualification.evaluationLineageOverlapAllowed, 0);
    assert.equal(harness.knowledgeQualification.sameBundleHashForAllRoles, true);
    assert.equal(harness.knowledgeQualification.targetReportMayDefineGenericOutline, false);
    assert.equal(harness.preGenerationQualification.targetGoldStructureMayDriveReportPlan, false);
    assert.equal(harness.preGenerationQualification.reportPlanBundleBlockConformanceRequired, 1);
    assert(harness.preGenerationQualification.allowedDispositions.includes('gold_structure_reference'));
    assert.equal(harness.boundedRsiPilot.enabled, true);
    assert.equal(harness.boundedRsiPilot.maximumCandidateIterations, 6);
    assert.deepEqual(harness.boundedRsiPilot.candidateSlots, ['A', 'B', 'C', 'D', 'E', 'F']);
    assert.equal(harness.boundedRsiPilot.pilotCohort.totalLineages, 6);
    assert.equal(harness.boundedRsiPilot.pilotCohort.developmentLineages, 4);
    assert.equal(harness.boundedRsiPilot.pilotCohort.validationLineages, 1);
    assert.equal(harness.boundedRsiPilot.pilotCohort.sealedHeldOutLineages, 1);
    assert.equal(harness.boundedRsiPilot.pilotCohort.interpretationCases, 36);
    assert.equal(harness.boundedRsiPilot.pilotCohort.maximumDevelopmentGeneratorRunsPerCandidate, 8);
    assert.equal(harness.boundedRsiPilot.automaticSourceLabelChanges, false);
    assert.equal(harness.boundedRsiPilot.automaticFrozenReleaseMutation, false);
    assert.equal(harness.boundedRsiPilot.automaticPromotion, false);
    assert(harness.boundedRsiPilot.optimizerMustNotRead.includes('held_out_gold_before_final_candidate'));
    assert.equal(harness.freezeGates.entityLocationSideAccuracy, 1);
    assert.equal(harness.freezeGates.polarityUncertaintyAccuracy, 1);
    assert.equal(harness.freezeGates.criticalClarificationMisses, 0);
    assert(harness.freezeGates.crossVariantSemanticStabilityMinimum >= 0.95);
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

assert.deepEqual(parseInventoryArguments(['--source', '/tmp/source', '--output', '/tmp/inventory.json']),
  { source: '/tmp/source', output: '/tmp/inventory.json', caseId: null });
assert.throws(() => parseInventoryArguments(['--source', '/tmp/source']), /Usage:/);
assert.deepEqual(parseKnowledgeCandidateArguments([
  '--source', '/tmp/source', '--output', '/tmp/candidate.json', '--exclusions', '/tmp/exclusions.json',
]), { source: '/tmp/source', output: '/tmp/candidate.json', exclusions: '/tmp/exclusions.json' });
assert.throws(() => parseKnowledgeCandidateArguments(['--source', '/tmp/source']), /Usage:/);
const inventoryFixture = buildSourceObligationInventory({
  manifest: { identity: { document_id: 'document-fixture', case_id: 'case-fixture',
    source_sha256: 'f'.repeat(64), report_family: 'internal_external_api653',
    dataset_split: 'training', dataset_group_key: 'asset:fixture' } },
  parsed: { blocks: [
    { block_id: 's4', block_type: 'heading', heading_level: 1, text: '4 INSPECTION REPORT',
      source_spans: [{ page_number: 7 }] },
    { block_id: 'dike', block_type: 'heading', heading_level: 2, text: 'DIKED AREA',
      source_spans: [{ page_number: 7 }] },
    { block_id: 'finding', block_type: 'list_item', text: 'Drain valve closed; no visible leakage.',
      source_spans: [{ page_number: 7 }] },
    { block_id: 'figure', block_type: 'figure', text: '', source_spans: [{ page_number: 7 }] },
    { block_id: 'page', block_type: 'paragraph', text: 'Page : 7', source_spans: [{ page_number: 7 }] },
    { block_id: 's5', block_type: 'heading', heading_level: 1,
      text: '5 REPAIR RECOMMENDATIONS', source_spans: [{ page_number: 8 }] },
  ] },
  caseId: 'inventory-fixture',
});
assert.equal(inventoryFixture.sourceUnits.length, 5);
assert.equal(inventoryFixture.counts.componentBlocks, 1);
assert.equal(inventoryFixture.goldStructureReference.blocks[0].blockId, 'diked-area');
assert.equal(inventoryFixture.goldStructureReference.generatorInputAllowed, false);
assert.equal(inventoryFixture.sourceUnits.find((unit) => unit.sourceBlockId === 'dike').provisionalDisposition,
  'gold_structure_reference');
assert.equal(inventoryFixture.sourceUnits.find((unit) => unit.sourceBlockId === 'finding').provisionalDisposition,
  'required_current_fact');
assert.equal(inventoryFixture.sourceUnits.find((unit) => unit.sourceBlockId === 'figure').provisionalDisposition,
  'cross_reference');
assert.equal(inventoryFixture.sourceUnits.find((unit) => unit.sourceBlockId === 'page').provisionalDisposition,
  'boilerplate_metadata');
assert.equal(inventoryFixture.review.dispositionCoverage, 0);
assert.equal(inventoryFixture.generatorInputAllowed, false);

const evaluationWorkflowRoot = join(appRoot,
  'server/section-agents/evaluation-workflows/inspection-report');
const [inspectionEvaluationWorkflow, inspectionMockDataContract, inspectionKnowledgeContract] =
  await Promise.all([
    'workflow.json', 'mock-data-contract.json', 'knowledge-bundle-contract.json',
  ].map((name) => readFile(join(evaluationWorkflowRoot, name), 'utf8').then(JSON.parse)));
assert.equal(inspectionEvaluationWorkflow.contractVersion, 'section_full_fidelity_evaluation_workflow_v3');
assert.equal(inspectionEvaluationWorkflow.productEnabled, false);
assert.equal(inspectionEvaluationWorkflow.generationReady, false);
assert.equal(inspectionEvaluationWorkflow.knowledgeCorpus.minimumCompatibleReports, 10);
assert.equal(inspectionEvaluationWorkflow.knowledgeCorpus.separateFromEvaluationCases, true);
assert.equal(inspectionEvaluationWorkflow.cohort.reportWideAndroidMockCorpus.caseCount, 12);
assert.equal(inspectionEvaluationWorkflow.cohort.reportWideAndroidMockCorpus.captureVariantsPerLineage, 6);
assert.equal(inspectionEvaluationWorkflow.cohort.reportWideAndroidMockCorpus.androidPackageType,
  'v3_product_export');
assert.equal(inspectionEvaluationWorkflow.cohort.sameLineageAcrossKnowledgeAndEvaluationAllowed, false);
assert.equal(inspectionEvaluationWorkflow.cohort.sameLineageAcrossEvaluationSplitsAllowed, false);
assert.equal(inspectionEvaluationWorkflow.candidateProtocol.infrastructureChangeBehavior,
  'invalidate_prior_results_and_restart_at_candidate_a');
assert.equal(inspectionEvaluationWorkflow.candidateProtocol.knowledgeBundleChangeBehavior,
  'new_bundle_hash_new_release_candidate_and_restart_at_candidate_a');
for (const gate of ['sourceUnitDispositionCoverage', 'requiredFactToEvidenceCoverage',
  'deterministicInputCoverage', 'reportPlanBundleConformance']) {
  assert.equal(inspectionEvaluationWorkflow.hardGates[gate], 1);
}
assert.equal(inspectionEvaluationWorkflow.hardGates.minimumKnowledgeLineages, 10);
assert.equal(inspectionEvaluationWorkflow.hardGates.knowledgeEvaluationLineageOverlap, 0);
assert.equal(inspectionEvaluationWorkflow.hardGates.unsupportedCurrentClaims, 0);
assert.equal(inspectionEvaluationWorkflow.hardGates.leakageFindings, 0);

assert.equal(inspectionKnowledgeContract.contractVersion,
  'inspection_report_section_knowledge_bundle_contract_v1');
assert.equal(inspectionKnowledgeContract.sourcePopulationRules.minimumCompatibleReports, 10);
assert.equal(inspectionKnowledgeContract.sourcePopulationRules.targetEvaluationLineagesExcluded, true);
assert.equal(inspectionKnowledgeContract.sharedBundleRule.sameBundleIdAndHashForAllRoles, true);
assert.equal(inspectionKnowledgeContract.sharedBundleRule.roleSpecificProjectionRequired, true);
assert.equal(inspectionKnowledgeContract.sharedBundleRule.oneReportMayDefineTheGenericOutline, false);
assert.deepEqual(Object.keys(inspectionKnowledgeContract.roleProjections), [
  'reportStructurePlanner', 'mockPreparationAgent', 'sectionGenerator',
  'preDisplayReviewer', 'postGenerationEvaluator',
]);
for (const required of ['canonical_block_coverage_taxonomy', 'format_required_input_categories']) {
  assert(inspectionKnowledgeContract.roleProjections.mockPreparationAgent.mustReceive.includes(required));
}

assert.equal(inspectionMockDataContract.contractVersion, 'inspection_report_mock_data_contract_v3');
assert.equal(inspectionMockDataContract.preparationRules.historicalNarrativeSentenceReuseAllowed, false);
assert.equal(inspectionMockDataContract.preparationRules.fakeFindingPhotosAllowed, false);
assert.equal(inspectionMockDataContract.preparationRules.authorizedHistoricalFindingPhotosMayBeReusedWithProvenance, true);
assert.equal(inspectionMockDataContract.preparationRules.recommendationsIncludedInGeneratorInput, false);
assert.equal(inspectionMockDataContract.preparationRules.targetOriginalReportMayDriveMockFactAndEvidenceCoverage, true);
assert.equal(inspectionMockDataContract.preparationRules.targetOriginalReportMayDefineGenericOutlineOrGeneratorPolicy, false);
assert.equal(inspectionMockDataContract.preparationRules.genericKnowledgeBundleMayDriveCoverageTaxonomy, true);
for (const required of ['canonical_block_coverage_taxonomy', 'format_required_input_categories']) {
  assert(inspectionMockDataContract.mockPreparationAgent.knowledgeUses.includes(required));
}
assert.equal(inspectionMockDataContract.coverage.requiredThreshold, 1);
assert.equal(inspectionMockDataContract.coverage.partialSampleMayQualifyGeneration, false);
assert.equal(inspectionMockDataContract.mockExport.minimumVariants, 6);
assert.equal(inspectionMockDataContract.reportPlan.contractVersion,
  'inspection_report_evaluation_report_plan_v2');
assert.equal(inspectionMockDataContract.reportPlan.rules.statusMustBe, 'frozen');
assert.equal(inspectionMockDataContract.reportPlan.rules.targetGoldStructureUsedMustBe, false);
for (const excluded of ['original_historical_section_text', 'target_gold_structure_reference',
  'current_recommendations', 'validation_and_heldout_gold', 'same_lineage_historical_retrieval']) {
  assert(inspectionMockDataContract.generatorInput.excluded.includes(excluded));
}
const robustnessExample = JSON.parse(await readFile(join(appRoot,
  'server/section-agents/test-fixtures/inspection-report-robustness-example.json'), 'utf8'));
assert.equal(robustnessExample.contractVersion, 'inspection_report_note_variation_fixture_v1');
assert.equal(robustnessExample.evaluationOnly, true);
assert.equal(robustnessExample.qualificationEvidence, false);
assert.equal(robustnessExample.sourceBasis.originalSectionTextIncluded, false);
assert.equal(robustnessExample.variants.length, 6);
assert.equal(new Set(robustnessExample.variants.map(row => row.variantId)).size, 6);
assert.equal(new Set(robustnessExample.variants.map(row => row.note)).size, 6);
assert(robustnessExample.variants.some(row => row.expectedBehavior === 'clarify_severity_before_generation'));
assert(robustnessExample.prohibitedPreparation.includes('copy_original_report_sentence'));

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

  const knowledgeSourceRoot = join(temp, 'knowledge-source');
  const rawNarratives = [];
  for (let index = 0; index < 10; index += 1) {
    const folder = join(knowledgeSourceRoot, `knowledge-${index}`);
    const rawNarrative = `Unique inspector narrative ${index}: drain remained closed and dry.`;
    rawNarratives.push(rawNarrative);
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'manifest.json'), JSON.stringify({ identity: {
      document_id: `knowledge-document-${index}`,
      case_id: `knowledge-case-${index}`,
      dataset_group_key: `knowledge-lineage-${index}`,
      source_sha256: String(index).padStart(64, String(index)),
      source_path: `/private/knowledge-${index}.pdf`,
      report_family: 'internal_external_api653',
      dataset_split: 'training',
    }}));
    await writeFile(join(folder, 'parsed-document.json'), JSON.stringify({ blocks: [
      { block_id: `section-4-${index}`, block_type: 'heading', heading_level: 1,
        text: '4 INSPECTION REPORT', source_spans: [{ page_number: 7 }] },
      { block_id: `dike-${index}`, block_type: 'heading', heading_level: 2,
        text: 'DIKED AREA', source_spans: [{ page_number: 7 }] },
      { block_id: `finding-${index}`, block_type: 'list_item', text: rawNarrative,
        source_spans: [{ page_number: 7 }] },
      { block_id: `misparsed-heading-${index}`, block_type: 'heading', heading_level: 3,
        text: rawNarrative, source_spans: [{ page_number: 7 }] },
      { block_id: `roof-${index}`, block_type: 'heading', heading_level: 2,
        text: 'FIXED ROOF (CONE)', source_spans: [{ page_number: 8 }] },
      { block_id: `roof-finding-${index}`, block_type: 'list_item',
        text: `Unique roof narrative ${index}.`, source_spans: [{ page_number: 8 }] },
      { block_id: `section-5-${index}`, block_type: 'heading', heading_level: 1,
        text: '5 REPAIR RECOMMENDATIONS', source_spans: [{ page_number: 9 }] },
    ] }));
  }
  const knowledgeCandidate = await buildInspectionReportKnowledgeCandidate({
    sourceRoot: knowledgeSourceRoot,
    exclusions: { lineageIds: [], sourceSha256s: [], supplied: true },
  });
  assert.equal(knowledgeCandidate.releaseEligible, false);
  assert.equal(knowledgeCandidate.sourcePopulation.sourceCount, 10);
  assert.equal(knowledgeCandidate.sourcePopulation.uniqueLineages, 10);
  assert.equal(knowledgeCandidate.sourcePopulation.rawNarrativeIncluded, false);
  assert.equal(knowledgeCandidate.sourcePopulation.unmappedHeadingTextIncluded, false);
  assert.equal(knowledgeCandidate.sourcePopulation.evaluationExclusionsApplied, true);
  assert.equal(knowledgeCandidate.canonicalBlockCatalogCandidate
    .find((block) => block.blockId === 'diked-area').observedReportCount, 10);
  assert.equal(knowledgeCandidate.canonicalBlockCatalogCandidate
    .find((block) => block.blockId === 'roof-external').observedReportCount, 10);
  const serializedCandidate = JSON.stringify(knowledgeCandidate);
  assert(!serializedCandidate.includes('/private/'));
  assert(knowledgeCandidate.unknownHeadingCandidates.every((candidate) => !('heading' in candidate)));
  for (const narrative of rawNarratives) assert(!serializedCandidate.includes(narrative));
} finally {
  await rm(temp, { recursive: true, force: true });
}

console.log(JSON.stringify({ passed: true, profileId: 'vertical_tank_inspection_v1', sectionAgentFolders: 7,
  filesPerFolder: requiredFiles, frozenAgentReferencesVerified: 2, privatePackSplitterVerified: true,
  inspectionReportKnowledgeCandidateBuilderVerified: true,
  inspectionReportBoundedRsiVerified: true, inspectionReportVariationExampleVerified: true, inspectionReportFullFidelityWorkflowVerified: true, inspectionReportInventoryBuilderVerified: true,
  productEnabled: false }, null, 2));
