#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const encode = (value) => JSON.stringify(value, null, 2) + '\n';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function parseFreezeArguments(argv) {
  const result = { candidate: null, review: null, output: null };
  const flags = { '--candidate': 'candidate', '--review': 'review', '--output': 'output' };
  for (let index = 0; index < argv.length; index += 1) {
    const key = flags[argv[index]];
    if (!key) throw new Error('Unknown argument: ' + argv[index]);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(argv[index] + ' requires a value');
    result[key] = resolve(value);
    index += 1;
  }
  if (!result.candidate || !result.review || !result.output) {
    throw new Error('Usage: freeze-knowledge-bundle.mjs --candidate <candidate.json> --review <review.json> --output <bundle.json>');
  }
  return result;
}

const projection = (bundleId, role, payload) => ({
  projectionId: `${bundleId}_${role}_v1`,
  bundleId,
  contentSha256: sha256(JSON.stringify(payload)),
  ...payload,
});

export function freezeKnowledgeBundle({ candidate, review }) {
  assert.equal(candidate.contractVersion, 'inspection_report_section_knowledge_bundle_candidate_v1');
  assert.equal(candidate.sourcePopulation.evaluationExclusionsApplied, true);
  assert(candidate.sourcePopulation.sourceCount >= 10);
  assert.equal(candidate.sourcePopulation.sourceCount, candidate.sourcePopulation.uniqueLineages);
  assert.equal(candidate.sourcePopulation.memberSetSha256, review.reviewedCandidateMemberSetSha256);
  assert.equal(candidate.sourcePopulation.rawNarrativeIncluded, false);
  assert.equal(candidate.sourcePopulation.unmappedHeadingTextIncluded, false);
  const unknownSetSha256 = sha256(JSON.stringify(candidate.unknownHeadingCandidates
    .map((entry) => entry.headingSha256).sort()));
  assert.equal(unknownSetSha256, review.reviewedUnknownHeadingSetSha256);
  assert.equal(review.releaseDecision.bundleMayBeFrozenForWorkflowCalibration, true);
  assert.equal(review.releaseDecision.qualifiesProductPromotion, false);

  const candidateBlocks = new Map(candidate.canonicalBlockCatalogCandidate
    .map((block) => [block.blockId, block]));
  assert.equal(review.canonicalBlocks.length, candidateBlocks.size);
  const canonicalBlockCatalog = review.canonicalBlocks.map((decision) => {
    const observed = candidateBlocks.get(decision.blockId);
    assert(observed, 'Review references unknown block ' + decision.blockId);
    const excluded = new Set(review.headingPolicy.explicitExclusions[decision.blockId] ?? []);
    const acceptedDisplayHeadings = observed.acceptedDisplayHeadingCandidates
      .map((entry) => entry.displayHeading).filter((heading) => !excluded.has(heading));
    assert(acceptedDisplayHeadings.includes(decision.preferredDisplayHeading),
      decision.blockId + ' preferred heading is not observed');
    const allowedFormatFamilyIds = observed.allowedFormatFamilyCandidates
      .map((entry) => entry.formatFamilyId);
    assert(acceptedDisplayHeadings.length > 0 && allowedFormatFamilyIds.length > 0);
    return {
      blockId: decision.blockId,
      order: decision.order,
      applicability: decision.applicability,
      variability: decision.variability,
      preferredDisplayHeading: decision.preferredDisplayHeading,
      acceptedDisplayHeadings,
      allowedFormatFamilyIds,
      observedReportCount: observed.observedReportCount,
      observedReportRate: observed.observedReportRate,
      sourceProvenance: observed.sourceRefs,
    };
  });
  assert.deepEqual(canonicalBlockCatalog.map((block) => block.order),
    canonicalBlockCatalog.map((_, index) => index + 1));

  const bundleId = 'inspection_report_section_knowledge_bundle_v1_calibration';
  const formatFamilies = {
    'component-list-v1': { shape: 'component_subheading_with_arrow_or_bullet_findings' },
    'component-paragraph-v1': { shape: 'component_subheading_with_short_supported_paragraphs' },
    'mixed-component-findings-v1': { shape: 'component_subheading_with_mixed_short_paragraphs_and_findings' },
    'deterministic-assessment-v1': { shape: 'reviewed_calculation_or_assessment_group_with_protected_values' },
  };
  const terminologyPatterns = {
    componentAliases: {
      'diked-area': ['diked area', 'dike area', 'bunded area'],
      'access-structures': ['access structure', 'stairway', 'ladder', 'platform'],
      'roof-external': ['roof external', 'fixed roof external', 'external floating roof'],
      'floor-internal': ['floor internal', 'tank bottom internal', 'annular area'],
    },
    preserveOriginalCaptureAlongsideNormalizedLabel: true,
    unresolvedAliasBehavior: 'clarify_before_generation',
  };
  const narrativePatterns = {
    finding: '{component} at {location} was observed with {condition}{severity_or_extent}{cross_reference}.',
    limitation: '{component_or_area} was not examined because {reason}; its condition remains unassessed.',
    measurementSummary: '{method} recorded {reviewed_summary} at {identified_locations}, in {unit}.',
    explicitConditionRequiredForSatisfactoryWording: true,
    historicalSentenceReuseAllowed: false,
  };
  const crossReferencePatterns = {
    supportedTargets: ['photo', 'figure', 'sketch', 'measurement_table', 'attachment'],
    unresolvedReferenceBehavior: 'block_or_needs_attention',
  };
  const orderConstraints = {
    orderedBlockIds: canonicalBlockCatalog.map((block) => block.blockId),
    omittedConditionalBlocksDoNotChangeRelativeOrder: true,
  };
  const variabilityModel = Object.fromEntries(canonicalBlockCatalog.map((block) => [block.blockId, {
    classification: block.variability,
    applicability: block.applicability,
  }]));
  const common = { canonicalBlockCatalog, orderConstraints, formatFamilies,
    terminologyPatterns, narrativePatterns, crossReferencePatterns, variabilityModel };
  const roleProjections = {
    reportStructurePlanner: projection(bundleId, 'structure', {
      canonicalBlockCatalog, orderConstraints, variabilityModel,
    }),
    mockPreparationAgent: projection(bundleId, 'mock_preparation', {
      canonicalBlockCoverage: canonicalBlockCatalog.map((block) => block.blockId),
      terminologyPatterns,
      formatRequiredInputCategories: ['structured_fields', 'findings', 'measurements',
        'photos', 'layout_entities', 'limitations', 'cross_references'],
      capturePatternRule: 'Use realistic app channels and varied inspector wording; never copy report prose.',
    }),
    sectionGenerator: projection(bundleId, 'generation', {
      canonicalBlockCatalog, orderConstraints, formatFamilies, terminologyPatterns,
      narrativePatterns, crossReferencePatterns,
    }),
    preDisplayReviewer: projection(bundleId, 'review', {
      canonicalBlockCatalog, orderConstraints, formatFamilies, terminologyPatterns,
      narrativePatterns, crossReferencePatterns,
      acceptedVariationRule: 'A supported bundle variant may differ from the target report.',
    }),
    postGenerationEvaluator: projection(bundleId, 'evaluation', {
      canonicalBlockCatalog, orderConstraints, formatFamilies, terminologyPatterns,
      narrativePatterns, crossReferencePatterns,
      separateScores: ['current_evidence_fidelity', 'generic_kb_pattern_conformance',
        'target_meaning_recovery', 'target_format_similarity', 'accepted_non_target_variation'],
    }),
  };
  const base = {
    contractVersion: 'inspection_report_section_knowledge_bundle_v1',
    bundleId,
    revision: 1,
    status: 'frozen',
    releaseEligible: false,
    productEnabled: false,
    profileId: 'vertical_tank_inspection_v1',
    sectionId: 'inspection-report',
    sourcePopulation: {
      members: candidate.sourcePopulation.members.map((member) => ({
        ...member,
        datasetRole: 'knowledge_reference',
      })),
      sourceCount: candidate.sourcePopulation.sourceCount,
      uniqueLineages: candidate.sourcePopulation.uniqueLineages,
      memberSetSha256: candidate.sourcePopulation.memberSetSha256,
      evaluationExclusionsApplied: true,
      excludedLineageCount: candidate.sourcePopulation.excludedLineageCount,
      excludedSourceHashCount: candidate.sourcePopulation.excludedSourceHashCount,
      rawNarrativeIncluded: false,
      unmappedHeadingTextIncluded: false,
    },
    ...common,
    roleProjections,
    review: {
      status: review.status,
      reviewedAt: review.reviewedAt,
      reviewer: review.reviewer,
      unknownHeadingSetSha256: unknownSetSha256,
      inspectorApproval: 'pending',
      qualificationUse: 'workflow_calibration_only',
    },
  };
  return { ...base, contentSha256: sha256(encode(base)) };
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) {
  try {
    const args = parseFreezeArguments(process.argv.slice(2));
    const [candidate, review] = await Promise.all([
      readFile(args.candidate, 'utf8').then(JSON.parse),
      readFile(args.review, 'utf8').then(JSON.parse),
    ]);
    const bundle = freezeKnowledgeBundle({ candidate, review });
    await mkdir(dirname(args.output), { recursive: true });
    await writeFile(args.output, encode(bundle), { mode: 0o600 });
    console.log(JSON.stringify({
      created: true,
      output: args.output,
      bundleId: bundle.bundleId,
      status: bundle.status,
      releaseEligible: bundle.releaseEligible,
      sourceCount: bundle.sourcePopulation.sourceCount,
      canonicalBlocks: bundle.canonicalBlockCatalog.length,
      inspectorApproval: bundle.review.inspectorApproval,
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ created: false, error: error.message }, null, 2));
    process.exitCode = 1;
  }
}
