#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workflowRoot = dirname(fileURLToPath(import.meta.url));
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

export function parseAuditArguments(argv) {
  const parsed = {
    knowledgeBundle: null,
    inventory: null,
    reportPlan: null,
    truthCase: null,
    mockExport: null,
  };
  const flags = {
    '--knowledge-bundle': 'knowledgeBundle',
    '--inventory': 'inventory',
    '--report-plan': 'reportPlan',
    '--truth-case': 'truthCase',
    '--mock-export': 'mockExport',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const key = flags[argv[index]];
    if (!key) throw new Error('Unknown argument: ' + argv[index]);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(argv[index] + ' requires a value');
    parsed[key] = resolve(value);
    index += 1;
  }
  const supplied = Object.values(parsed).filter(Boolean).length;
  if (supplied !== 0 && supplied !== 5) {
    throw new Error('A case audit requires --knowledge-bundle, --inventory, --report-plan, --truth-case, and --mock-export together');
  }
  return parsed;
}

export async function auditStaticContracts() {
  const [workflow, contract, knowledgeContract, capabilityContract] = await Promise.all([
    readJson(join(workflowRoot, 'workflow.json')),
    readJson(join(workflowRoot, 'mock-data-contract.json')),
    readJson(join(workflowRoot, 'knowledge-bundle-contract.json')),
    readJson(join(workflowRoot, 'app-capture-capability-contract.json')),
  ]);
  assert.equal(workflow.contractVersion, 'section_full_fidelity_evaluation_workflow_v3');
  assert.equal(workflow.sectionId, 'inspection-report');
  assert.equal(workflow.productEnabled, false);
  assert.equal(workflow.generationReady, false);
  assert.equal(workflow.knowledgeCorpus.minimumCompatibleReports, 10);
  assert.equal(workflow.knowledgeCorpus.minimumUniqueLineages, 10);
  assert.equal(workflow.knowledgeCorpus.separateFromEvaluationCases, true);
  assert.equal(workflow.cohort.reportWideAndroidMockCorpus.caseCount, 12);
  assert.equal(workflow.cohort.reportWideAndroidMockCorpus.mockPipelineSplit,
    'none_all_cases_reviewed_against_their_original_report');
  assert.equal(workflow.cohort.reportWideAndroidMockCorpus.sectionExperimentAssignment,
    'assigned_later_without_changing_frozen_mock_packages');
  assert.equal(workflow.cohort.reportWideAndroidMockCorpus.captureVariantsPerLineage, 6);
  assert.equal(workflow.cohort.reportWideAndroidMockCorpus.androidPackageType,
    'v3_product_export');
  assert.equal(workflow.cohort.reportWideAndroidMockCorpus.androidSchemaVersion, 3);
  assert.deepEqual(workflow.stages.slice(1, 4).map((stage) => stage.stageId), [
    'report-wide-source-obligation-inventory',
    'android-capture-round-trip-and-independent-review',
    'section-evidence-projection',
  ]);
  assert.equal(workflow.candidateProtocol.infrastructureChangeBehavior,
    'invalidate_prior_results_and_restart_at_candidate_a');
  assert.equal(workflow.candidateProtocol.knowledgeBundleChangeBehavior,
    'new_bundle_hash_new_release_candidate_and_restart_at_candidate_a');
  assert.deepEqual(workflow.candidateProtocol.slots, ['A', 'B', 'C', 'D', 'E', 'F']);
  for (const key of [
    'sourceUnitDispositionCoverage',
    'requiredFactToEvidenceCoverage',
    'deterministicInputCoverage',
    'protectedFactAccuracy',
    'entityLocationSideAccuracy',
    'polarityUncertaintyAccuracy',
    'reportPlanBundleConformance',
  ]) assert.equal(workflow.hardGates[key], 1);
  assert.equal(workflow.hardGates.minimumKnowledgeLineages, 10);
  assert.equal(workflow.hardGates.knowledgeEvaluationLineageOverlap, 0);
  assert.equal(workflow.hardGates.unsupportedCurrentClaims, 0);
  assert.equal(workflow.hardGates.leakageFindings, 0);

  assert.equal(knowledgeContract.contractVersion,
    'inspection_report_section_knowledge_bundle_contract_v1');
  assert.equal(knowledgeContract.sourcePopulationRules.minimumCompatibleReports, 10);
  assert.equal(knowledgeContract.sourcePopulationRules.targetEvaluationLineagesExcluded, true);
  assert.equal(knowledgeContract.sharedBundleRule.sameBundleIdAndHashForAllRoles, true);
  assert.equal(knowledgeContract.sharedBundleRule.roleSpecificProjectionRequired, true);
  assert.equal(knowledgeContract.sharedBundleRule.rawSourcePassagesIncludedAtRuntime, false);
  assert.equal(knowledgeContract.sharedBundleRule.oneReportMayDefineTheGenericOutline, false);
  assert.deepEqual(Object.keys(knowledgeContract.roleProjections), [
    'reportStructurePlanner',
    'mockPreparationAgent',
    'sectionGenerator',
    'preDisplayReviewer',
    'postGenerationEvaluator',
  ]);

  assert.equal(contract.contractVersion, 'inspection_report_mock_data_contract_v3');
  assert.equal(contract.sectionId, 'inspection-report');
  assert.equal(contract.inputSeparation.targetOriginalReport.allowedConsumers
    .includes('mock_preparation_agent'), true);
  assert.equal(contract.inputSeparation.targetOriginalReport.prohibitedConsumers
    .includes('mock_preparation_agent'), false);
  assert.equal(contract.inputSeparation.targetOriginalReport.prohibitedConsumers
    .includes('section_generation_agent'), true);
  assert.equal(contract.inputSeparation.targetOriginalReport.prohibitedConsumers
    .includes('report_structure_agent'), true);
  assert.equal(contract.preparationRules.historicalNarrativeSentenceReuseAllowed, false);
  assert.equal(contract.preparationRules.fakeFindingPhotosAllowed, false);
  assert.equal(contract.preparationRules.authorizedHistoricalFindingPhotosMayBeReusedWithProvenance, true);
  assert.equal(contract.preparationRules.recommendationsIncludedInGeneratorInput, false);
  assert.equal(contract.preparationRules.targetOriginalReportMayDriveMockFactAndEvidenceCoverage, true);
  assert.equal(contract.preparationRules.targetOriginalReportMayDefineGenericOutlineOrGeneratorPolicy,
    false);
  assert.equal(contract.preparationRules.genericKnowledgeBundleMayDriveCoverageTaxonomy, true);
  assert.equal(contract.coverage.requiredThreshold, 1);
  assert.equal(contract.coverage.partialSampleMayQualifyGeneration, false);
  assert.equal(capabilityContract.contractVersion, 'inspection_app_capture_capability_v3');
  assert.equal(capabilityContract.capabilities.multipleSectionUsesPerEvidence, true);
  assert.equal(capabilityContract.capabilities.photosLinkedToFindings, true);
  assert.equal(capabilityContract.mediaPolicy.fakeFindingPhotosAllowed, false);
  for (const forbidden of [
    'original_historical_section_text',
    'target_gold_structure_reference',
    'expected_report_wording',
    'current_recommendations',
    'validation_and_heldout_gold',
    'same_lineage_historical_retrieval',
  ]) assert(contract.generatorInput.excluded.includes(forbidden));
  return { workflow, contract, knowledgeContract };
}

function validateKnowledgeBundle(bundle, inventory, bundleRaw, knowledgeContract) {
  assert.equal(bundle.contractVersion, 'inspection_report_section_knowledge_bundle_v1');
  assert.equal(bundle.status, 'frozen');
  assert.equal(bundle.profileId, 'vertical_tank_inspection_v1');
  assert.equal(bundle.sectionId, 'inspection-report');
  for (const field of knowledgeContract.requiredBundleFields) {
    assert(Object.hasOwn(bundle, field), 'Knowledge Bundle is missing ' + field);
  }
  assert(/^[a-f0-9]{64}$/.test(bundle.contentSha256), 'Knowledge Bundle contentSha256 is invalid');
  const members = bundle.sourcePopulation?.members;
  assert(Array.isArray(members) && members.length >= 10,
    'Knowledge Bundle requires at least ten compatible source reports');
  assert.equal(new Set(members.map((member) => member.lineageId)).size, members.length,
    'Knowledge Bundle source lineages must be unique');
  assert(members.every((member) => member.datasetRole === 'knowledge_reference'));
  assert(!members.some((member) => member.lineageId === inventory.lineageId),
    'Target evaluation lineage entered the Knowledge Bundle');
  assert(!members.some((member) => member.sourceSha256 === inventory.source.sourceSha256),
    'Target evaluation report entered the Knowledge Bundle');
  assert(Array.isArray(bundle.canonicalBlockCatalog) && bundle.canonicalBlockCatalog.length > 0);
  assert.equal(new Set(bundle.canonicalBlockCatalog.map((block) => block.blockId)).size,
    bundle.canonicalBlockCatalog.length);
  for (const block of bundle.canonicalBlockCatalog) {
    for (const field of ['blockId', 'order', 'applicability', 'acceptedDisplayHeadings',
      'allowedFormatFamilyIds']) {
      assert(Object.hasOwn(block, field), 'Knowledge block is missing ' + field);
    }
    assert(Array.isArray(block.acceptedDisplayHeadings) && block.acceptedDisplayHeadings.length > 0);
    assert(Array.isArray(block.allowedFormatFamilyIds) && block.allowedFormatFamilyIds.length > 0);
  }
  for (const role of ['reportStructurePlanner', 'mockPreparationAgent', 'sectionGenerator',
    'preDisplayReviewer', 'postGenerationEvaluator']) {
    const projection = bundle.roleProjections?.[role];
    assert(projection?.projectionId, 'Knowledge Bundle is missing ' + role + ' projection');
    assert.equal(projection.bundleId, bundle.bundleId);
  }
  return { bundleSha256: sha256(bundleRaw), memberCount: members.length };
}

function validateReportPlan(reportPlan, contract, bundle, bundleSha256) {
  for (const field of contract.reportPlan.requiredFields) {
    assert(Object.hasOwn(reportPlan, field), 'ReportPlan is missing ' + field);
  }
  assert.equal(reportPlan.contractVersion, contract.reportPlan.contractVersion);
  assert.equal(reportPlan.status, contract.reportPlan.rules.statusMustBe);
  assert.equal(reportPlan.profileId, 'vertical_tank_inspection_v1');
  assert.equal(reportPlan.sectionId, 'inspection-report');
  assert.equal(reportPlan.sectionTitle, '4 INSPECTION REPORT');
  assert.equal(reportPlan.knowledgeBundleId, bundle.bundleId);
  assert.equal(reportPlan.knowledgeBundleSha256, bundleSha256);
  assert.equal(reportPlan.targetGoldStructureUsed, false);

  const catalog = new Map(bundle.canonicalBlockCatalog.map((block) => [block.blockId, block]));
  assert(Array.isArray(reportPlan.applicabilityDecisions));
  assert.equal(reportPlan.applicabilityDecisions.length, bundle.canonicalBlockCatalog.length,
    'Every canonical block needs one applicability decision');
  assert.equal(new Set(reportPlan.applicabilityDecisions.map((decision) => decision.blockId)).size,
    bundle.canonicalBlockCatalog.length);
  for (const item of bundle.canonicalBlockCatalog) {
    const decision = reportPlan.applicabilityDecisions.find((entry) => entry.blockId === item.blockId);
    assert(decision && typeof decision.include === 'boolean',
      'Missing applicability decision for ' + item.blockId);
    assert(Array.isArray(decision.basisEvidenceIds));
    assert(decision.reason, 'Applicability decision needs a reason for ' + item.blockId);
  }

  const includedIds = reportPlan.applicabilityDecisions
    .filter((decision) => decision.include).map((decision) => decision.blockId);
  assert.deepEqual(reportPlan.blocks.map((block) => block.blockId), includedIds,
    'ReportPlan blocks must exactly match included applicability decisions');

  let previousOrder = -Infinity;
  for (const block of reportPlan.blocks) {
    for (const field of contract.reportPlan.blockRequiredFields) {
      assert(Object.hasOwn(block, field), 'ReportPlan block ' + (block.blockId ?? '<unknown>')
        + ' is missing ' + field);
    }
    const pattern = catalog.get(block.blockId);
    assert(pattern, 'ReportPlan contains unknown block ' + block.blockId);
    assert(pattern.order >= previousOrder, 'ReportPlan violates bundle block order');
    previousOrder = pattern.order;
    assert(pattern.acceptedDisplayHeadings.includes(block.displayHeading),
      block.blockId + ' uses a heading not accepted by the Knowledge Bundle');
    assert(pattern.allowedFormatFamilyIds.includes(block.formatFamilyId),
      block.blockId + ' uses a format not accepted by the Knowledge Bundle');
    assert(Array.isArray(block.applicabilityEvidenceIds)
      && block.applicabilityEvidenceIds.length > 0,
    block.blockId + ' lacks current-evidence applicability support');
  }
}

function validateEvidenceRecord(record, requiredFields) {
  for (const field of requiredFields) {
    assert(Object.hasOwn(record, field), 'Evidence record ' + (record.evidence_id ?? '<unknown>')
      + ' is missing ' + field);
  }
  assert(Array.isArray(record.source_obligation_ids) && record.source_obligation_ids.length > 0,
    'Each evidence record must link at least one source obligation');
  assert(Array.isArray(record.section_uses) && record.section_uses.includes('inspection-report'),
    'Each Section 4 evidence record must declare inspection-report in section_uses');
  assert.equal(Object.hasOwn(record, 'original_report_sentence'), false,
    'Normalized truth must not carry original report prose into mock preparation');
}

function findNarrativeLeakage(units, mockExport) {
  const goldSentences = units
    .filter((unit) => unit.reviewedDisposition === 'required_current_fact')
    .map((unit) => ({ id: unit.sourceUnitId, text: normalize(unit.sourceText) }))
    .filter((item) => item.text.length >= 35);
  const findings = [];
  const tokens = (value) => normalize(value).replace(/[^a-z0-9.]+/g, ' ').split(' ').filter(Boolean);
  const longestCommonRun = (left, right) => {
    const a = tokens(left);
    const b = tokens(right);
    const previous = new Array(b.length + 1).fill(0);
    let longest = 0;
    for (let index = 1; index <= a.length; index += 1) {
      const current = new Array(b.length + 1).fill(0);
      for (let peer = 1; peer <= b.length; peer += 1) {
        if (a[index - 1] === b[peer - 1]) {
          current[peer] = previous[peer - 1] + 1;
          longest = Math.max(longest, current[peer]);
        }
      }
      previous.splice(0, previous.length, ...current);
    }
    return longest;
  };
  for (const variant of mockExport.variants ?? []) {
    for (const capture of variant.capture_records ?? []) {
      const note = normalize(capture.raw_text);
      if (note.length < 20) continue;
      for (const gold of goldSentences) {
        if (note === gold.text || (note.length >= 35 && gold.text.includes(note))
            || (gold.text.length >= 35 && note.includes(gold.text))
            || longestCommonRun(note, gold.text) >= 10) {
          findings.push({
            variantId: variant.variant_id,
            captureId: capture.capture_id,
            sourceObligationId: gold.id,
            longestCommonTokenRun: longestCommonRun(note, gold.text),
          });
        }
      }
    }
  }
  return findings;
}

export async function auditCase(paths, contract, knowledgeContract) {
  const raw = await Promise.all([
    readFile(paths.knowledgeBundle, 'utf8'),
    readFile(paths.inventory, 'utf8'),
    readFile(paths.reportPlan, 'utf8'),
    readFile(paths.truthCase, 'utf8'),
    readFile(paths.mockExport, 'utf8'),
  ]);
  const [bundle, inventory, reportPlan, truthCase, mockExport] = raw.map(JSON.parse);
  const allowed = new Set(contract.sourceDispositions.map((entry) => entry.code));

  assert.equal(inventory.contractVersion, 'inspection_report_source_obligation_inventory_v1');
  assert.equal(inventory.generatorInputAllowed, false);
  assert.equal(inventory.goldStructureReference.generatorInputAllowed, false);
  assert.equal(inventory.goldStructureReference.reportStructureAgentInputAllowed, false);
  assert.equal(inventory.goldStructureReference.preDisplayReviewerInputAllowed, false);
  assert(Array.isArray(inventory.sourceUnits) && inventory.sourceUnits.length > 0);
  assert.equal(inventory.review.status, 'complete');
  assert.equal(inventory.review.totalSourceUnits, inventory.sourceUnits.length);
  assert.equal(inventory.review.reviewedSourceUnits, inventory.sourceUnits.length);
  assert.equal(inventory.review.dispositionCoverage, 1);
  for (const unit of inventory.sourceUnits) {
    assert.equal(unit.reviewStatus, 'approved', unit.sourceUnitId + ' is not approved');
    assert(allowed.has(unit.reviewedDisposition), unit.sourceUnitId + ' has an invalid disposition');
    assert(unit.reviewerIdentity && unit.reviewedAt,
      unit.sourceUnitId + ' is missing reviewer provenance');
    if (['boilerplate_metadata', 'reviewed_out_of_scope'].includes(unit.reviewedDisposition)) {
      assert(unit.reviewReason, unit.sourceUnitId + ' exclusion is missing a review reason');
    }
  }

  const bundleStatus = validateKnowledgeBundle(bundle, inventory, raw[0], knowledgeContract);
  validateReportPlan(reportPlan, contract, bundle, bundleStatus.bundleSha256);

  for (const field of contract.truthCase.requiredFields) {
    assert(Object.hasOwn(truthCase, field), 'Truth Case is missing ' + field);
  }
  assert.equal(truthCase.source_report_hash, inventory.source.sourceSha256);
  assert.equal(truthCase.knowledge_bundle_id, bundle.bundleId);
  assert.equal(truthCase.knowledge_bundle_hash, bundleStatus.bundleSha256);
  assert.equal(truthCase.reviewed_obligation_inventory_hash, sha256(raw[1]));
  assert.equal(truthCase.dataset_split, inventory.datasetSplit);
  assert.equal(truthCase.lineage_id, inventory.lineageId);
  assert(Array.isArray(truthCase.evidence_records));
  assert(Array.isArray(truthCase.deterministic_inputs));
  for (const evidence of truthCase.evidence_records) {
    validateEvidenceRecord(evidence, contract.truthCase.evidenceRecordRequiredFields);
  }

  assert.equal(mockExport.contract_version, contract.mockExport.contractVersion);
  for (const field of contract.mockExport.requiredFields) {
    assert(Object.hasOwn(mockExport, field), 'Mock export is missing ' + field);
  }
  assert.equal(mockExport.case_id, truthCase.case_id);
  assert.equal(mockExport.lineage_id, truthCase.lineage_id);
  assert.equal(mockExport.dataset_split, truthCase.dataset_split);
  assert.equal(mockExport.knowledge_bundle_id, bundle.bundleId);
  assert.equal(mockExport.knowledge_bundle_hash, bundleStatus.bundleSha256);
  assert.equal(mockExport.mock_preparation_projection_id,
    bundle.roleProjections.mockPreparationAgent.projectionId);
  assert(Array.isArray(mockExport.variants) && mockExport.variants.length === 6);
  assert.equal(new Set(mockExport.variants.map((variant) => variant.variant_id)).size, 6);
  assert(mockExport.variants.every((variant) => variant.truth_case_id === truthCase.case_id));
  assert(mockExport.variants.every((variant) => Array.isArray(variant.capture_records)
    && variant.capture_records.length > 0));
  for (const variant of mockExport.variants) {
    for (const field of contract.mockExport.variantRequiredFields) {
      assert(Object.hasOwn(variant, field), variant.variant_id + ' is missing ' + field);
    }
    for (const capture of variant.capture_records) {
      for (const field of contract.mockExport.captureRecordRequiredFields) {
        assert(Object.hasOwn(capture, field), (capture.capture_id ?? '<capture>') + ' is missing ' + field);
      }
      assert(Array.isArray(capture.source_obligation_ids) && capture.source_obligation_ids.length > 0,
        capture.capture_id + ' must link source obligations');
    }
  }
  assert.deepEqual(
    [...truthCase.capture_variants].sort(),
    mockExport.variants.map((variant) => variant.variant_id).sort(),
    'Truth Case capture_variants must name the same six mock variants',
  );

  const requiredFacts = inventory.sourceUnits.filter((unit) =>
    unit.reviewedDisposition === 'required_current_fact');
  const deterministic = inventory.sourceUnits.filter((unit) =>
    unit.reviewedDisposition === 'deterministic_content');
  const recommendationIds = new Set(inventory.sourceUnits.filter((unit) =>
    unit.reviewedDisposition === 'recommendation_route').map((unit) => unit.sourceUnitId));
  const evidenceLinks = new Set(truthCase.evidence_records.flatMap((record) =>
    record.source_obligation_ids));
  const deterministicLinks = new Set(truthCase.deterministic_inputs.flatMap((input) =>
    input.source_obligation_ids ?? []));
  const requiredCovered = requiredFacts.filter((unit) => evidenceLinks.has(unit.sourceUnitId));
  const deterministicCovered = deterministic.filter((unit) => deterministicLinks.has(unit.sourceUnitId));
  const requiredCoverage = requiredFacts.length === 0 ? 1 : requiredCovered.length / requiredFacts.length;
  const deterministicCoverage = deterministic.length === 0 ? 1
    : deterministicCovered.length / deterministic.length;
  assert.equal(requiredCoverage, 1, 'Required current-fact coverage must equal 1.0');
  assert.equal(deterministicCoverage, 1, 'Deterministic-input coverage must equal 1.0');

  const generatorEvidenceIds = new Set(mockExport.generator_input?.evidence_ids ?? []);
  const evidenceById = new Map(truthCase.evidence_records.map((record) =>
    [record.evidence_id, record]));
  for (const evidenceId of generatorEvidenceIds) {
    const evidence = evidenceById.get(evidenceId);
    assert(evidence, 'Generator input references unknown evidence ' + evidenceId);
    assert(!evidence.source_obligation_ids.some((id) => recommendationIds.has(id)),
      'Recommendation evidence entered generator input');
  }
  assert.deepEqual([...generatorEvidenceIds].sort(), [...evidenceById.keys()].sort(),
    'Generator evidence IDs must cover the complete truth case exactly');
  assert.deepEqual([...(mockExport.generator_input?.deterministic_input_ids ?? [])].sort(),
    truthCase.deterministic_inputs.map((input) => input.deterministic_input_id).sort(),
    'Generator deterministic IDs must cover the complete truth case exactly');
  const expectedEvidenceIds = [...evidenceById.keys()].sort();
  for (const variant of mockExport.variants) {
    assert.deepEqual(variant.capture_records.flatMap((capture) =>
      capture.structured_value.evidence_ids).sort(), expectedEvidenceIds,
    variant.variant_id + ' must cover every truth evidence ID exactly once');
  }
  assert((mockExport.media_references ?? []).every((reference) =>
    reference.source_status === 'historical_report_reference_only'
      && reference.asset_status === 'authorized_source_extraction_required'),
  'Mock media references must point to authorized historical source extraction; fake media is prohibited');
  assert.equal(mockExport.generator_input?.original_historical_section_text_included, false);
  assert.equal(mockExport.generator_input?.target_gold_structure_included, false);
  assert.equal(mockExport.generator_input?.expected_report_wording_included, false);
  assert.equal(mockExport.generator_input?.current_recommendations_included, false);
  assert.equal(mockExport.generator_input?.same_lineage_historical_retrieval_included, false);
  assert.equal(mockExport.generator_input?.knowledge_bundle_id, bundle.bundleId);
  assert.equal(mockExport.generator_input?.generation_projection_id,
    bundle.roleProjections.sectionGenerator.projectionId);

  const leakageFindings = findNarrativeLeakage(inventory.sourceUnits, mockExport);
  assert.deepEqual(leakageFindings, [], 'Mock narrative copied historical report wording');

  return {
    caseId: truthCase.case_id,
    knowledgeBundleId: bundle.bundleId,
    knowledgeSourceLineages: bundleStatus.memberCount,
    knowledgeEvaluationLineageOverlap: 0,
    sourceUnits: inventory.sourceUnits.length,
    requiredCurrentFacts: requiredFacts.length,
    deterministicObligations: deterministic.length,
    requiredFactToEvidenceCoverage: requiredCoverage,
    deterministicInputCoverage: deterministicCoverage,
    reportPlanBundleConformance: 1,
    captureVariants: mockExport.variants.length,
    leakageFindings: leakageFindings.length,
    generationReady: true,
  };
}

async function main() {
  const args = parseAuditArguments(process.argv.slice(2));
  const { contract, knowledgeContract } = await auditStaticContracts();
  if (!args.knowledgeBundle) {
    console.log(JSON.stringify({
      passed: true,
      contractsValid: true,
      caseAuditRequested: false,
      generationReady: false,
      reason: 'No complete case artifact set was supplied; static contracts only were audited.',
    }, null, 2));
    return;
  }
  const result = await auditCase(args, contract, knowledgeContract);
  console.log(JSON.stringify({ passed: true, contractsValid: true, caseAuditRequested: true, ...result }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error(JSON.stringify({
    passed: false,
    generationReady: false,
    error: error.message,
  }, null, 2));
  process.exitCode = 1;
}
