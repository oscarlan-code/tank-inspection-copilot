#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ALLOWED_FAMILIES = new Set([
  'internal_external_api653',
  'internal_inspection',
  'external_inspection',
]);
const BLOCKS = [
  { blockId: 'diked-area', patterns: [/^(?:DIKED|DIKE|BUND(?:ED)?) AREA$/] },
  { blockId: 'foundation', patterns: [/^FOUNDATION(?: EXTERNAL| INTERNAL)?$/] },
  { blockId: 'shell-external', patterns: [/^(?:TANK )?SHELL(?: EXTERNAL)?$/] },
  { blockId: 'shell-appurtenances', patterns: [/^SHELL APPURTENANCES?$/] },
  { blockId: 'access-structures', patterns: [/^ACCESS STRUCTURES?$/, /^(?:STAIRWAY|LADDER|PLATFORM)S?$/] },
  { blockId: 'roof-external', patterns: [
    /^(?:FIXED |FLOATING )?ROOF EXTERNAL(?: \((?:CONE|DOME)\))?$/,
    /^EXTERNAL (?:FIXED |FLOATING )?ROOF(?: \((?:CONE|DOME)\))?$/,
    /^(?:FIXED )?ROOF \((?:CONE|DOME)\)$/,
    /^(?:FLOATING ROOF \(EXTERNAL FLOATER\)|ROOF - EXTERNAL FLOATER)$/,
  ] },
  { blockId: 'roof-appurtenances', patterns: [/^ROOF APPURTENANCES?$/] },
  { blockId: 'roof-internal', patterns: [
    /^(?:FIXED )?ROOF INTERNAL(?: \((?:CONE|DOME)\))?$/, /^ROOF UNDERSIDE/,
    /^FLOATING ROOF \(INTERNAL\)$/,
  ] },
  { blockId: 'shell-internal', patterns: [/^SHELL INTERNAL$/] },
  { blockId: 'floor-internal', patterns: [
    /^(?:FLOOR|BOTTOM) INTERNAL(?: \((?:CONE UP|CONE DOWN|FLAT|DISH SHAPED END CAP)\))?$/,
    /^FLOOR \((?:CONE UP|CONE DOWN|FLAT)\)$/,
  ] },
  { blockId: 'assessment-summaries', patterns: [
    /^(?:FLOOR|ROOF|SHELL|ANNULAR).*CORROSION RATE(?:\/REMAINING SERVICE LIFE)? CALCULATIONS?$/,
    /^CALCULATED CORROSION RATE:?$/, /^CORROSION RATE$/,
    /^REMAINING CORROSION ALLOWANCE/, /^REMAINING SERVICE LIFE/,
    /^PLANNED INSPECTION INTERVAL/, /^(?:BEFORE|AFTER) REPAIRS?(?: \([^)]*\))?$/,
    /^\(USING PROVIDED CORROSION RATE OF .+\)$/,
  ] },
];
const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const encode = (value) => JSON.stringify(value, null, 2) + '\n';
const round = (value) => Number(value.toFixed(4));
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

function canonicalizeHeading(text) {
  return normalize(text).replace(/^[➢·]+\s*/, '').replace(/:\s*$/, '').trim();
}

function mapHeading(text) {
  const value = canonicalizeHeading(text);
  return BLOCKS.find((entry) => entry.patterns.some((pattern) => pattern.test(value)))?.blockId ?? null;
}

function displayHeadingTemplate(blockId, text) {
  const value = canonicalizeHeading(text);
  if (blockId !== 'assessment-summaries') return value;
  return value
    .replace(/\b\d+(?:\.\d+)?\s*MM\s*\/\s*YEAR\b/g, '{CORROSION_RATE} MM/YEAR')
    .replace(/\b\d+(?:\.\d+)?\s*YEARS?\b/g, '{INTERVAL_YEARS} YEARS')
    .replace(/\(BASED ON [^)]*\)$/, '(BASED ON {GOVERNING_COMPONENT})')
    .replace(/^PLANNED INSPECTION INTERVAL\s*-\s*\{INTERVAL_YEARS\}\s*YEARS/, 'PLANNED INSPECTION INTERVAL - {INTERVAL_YEARS} YEARS')
    .replace(/^(BEFORE|AFTER) REPAIRS? \([^)]*\)$/, '$1 REPAIRS ({CASE_LABEL})');
}

function numberedHeading(text, number, titlePattern) {
  const value = normalize(text);
  const match = value.match(/^(\d{1,2})\s+(.+)$/);
  return match && Number(match[1]) === number && titlePattern.test(match[2]);
}

function isHorizontal(identity, blocks) {
  const numberedTopLevelHeadings = blocks
    .filter((block) => block.block_type === 'heading' && block.heading_level === 1)
    .map((block) => normalize(block.text))
    .filter((text) => /^\d{1,2}\s+/.test(text));
  return /HORIZONTAL/i.test(identity.source_path ?? '')
    || numberedTopLevelHeadings.some((text) => /HORIZONTAL TANK|END CAP/.test(text));
}

function features(blocks) {
  const texts = blocks.map((block) => String(block.text ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const wordCounts = texts.map((text) => text.split(/\s+/).filter(Boolean).length);
  const count = texts.length;
  const countMatch = (pattern) => texts.filter((text) => pattern.test(text)).length;
  const typeCounts = {};
  for (const block of blocks) typeCounts[block.block_type] = (typeCounts[block.block_type] ?? 0) + 1;
  return {
    contentBlockCount: blocks.length,
    nonEmptyTextBlockCount: count,
    blockTypeCounts: typeCounts,
    averageWordsPerTextBlock: count ? round(wordCounts.reduce((sum, value) => sum + value, 0) / count) : 0,
    numericBlockRate: count ? round(countMatch(/\d/) / count) : 0,
    crossReferenceBlockRate: count ? round(countMatch(/^\s*refer\b/i) / count) : 0,
    limitationBlockRate: count ? round(countMatch(/\b(?:not able|unable|inaccessible|not inspected|not examined|restricted)\b/i) / count) : 0,
    satisfactoryBlockRate: count ? round(countMatch(/\bsatisfactory\b/i) / count) : 0,
  };
}

function formatFamily(feature) {
  const list = feature.blockTypeCounts.list_item ?? 0;
  const paragraph = feature.blockTypeCounts.paragraph ?? 0;
  if (list > paragraph * 1.5) return 'component-list-v1';
  if (paragraph > list * 1.5) return 'component-paragraph-v1';
  return 'mixed-component-findings-v1';
}

function aggregateFeatures(items) {
  const totalText = items.reduce((sum, item) => sum + item.nonEmptyTextBlockCount, 0);
  const blockTypeCounts = {};
  for (const item of items) {
    for (const [type, count] of Object.entries(item.blockTypeCounts)) {
      blockTypeCounts[type] = (blockTypeCounts[type] ?? 0) + count;
    }
  }
  const weighted = (key) => totalText ? round(items.reduce((sum, item) =>
    sum + item[key] * item.nonEmptyTextBlockCount, 0) / totalText) : 0;
  return {
    contentBlockCount: items.reduce((sum, item) => sum + item.contentBlockCount, 0),
    nonEmptyTextBlockCount: totalText,
    blockTypeCounts,
    averageWordsPerTextBlock: weighted('averageWordsPerTextBlock'),
    numericBlockRate: weighted('numericBlockRate'),
    crossReferenceBlockRate: weighted('crossReferenceBlockRate'),
    limitationBlockRate: weighted('limitationBlockRate'),
    satisfactoryBlockRate: weighted('satisfactoryBlockRate'),
  };
}

export function parseKnowledgeCandidateArguments(argv) {
  const result = { source: null, output: null, exclusions: null };
  const flags = { '--source': 'source', '--output': 'output', '--exclusions': 'exclusions' };
  for (let index = 0; index < argv.length; index += 1) {
    const key = flags[argv[index]];
    if (!key) throw new Error('Unknown argument: ' + argv[index]);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(argv[index] + ' requires a value');
    result[key] = value;
    index += 1;
  }
  if (!result.source || !result.output) {
    throw new Error('Usage: build-knowledge-bundle-candidate.mjs --source <canonical-root> --output <candidate.json> [--exclusions <json>]');
  }
  return result;
}

async function loadExclusions(path) {
  if (!path) return { lineageIds: [], sourceSha256s: [], supplied: false };
  const value = JSON.parse(await readFile(resolve(path), 'utf8'));
  const exclusions = value.knowledgeExclusions ?? value;
  return {
    lineageIds: exclusions.lineageIds ?? [],
    sourceSha256s: exclusions.sourceSha256s ?? [],
    supplied: true,
  };
}

export async function buildInspectionReportKnowledgeCandidate({ sourceRoot, exclusions }) {
  const excludeLineages = new Set(exclusions.lineageIds);
  const excludeHashes = new Set(exclusions.sourceSha256s);
  const sources = [];
  for (const directory of (await readdir(sourceRoot)).sort()) {
    let manifest, parsed;
    try {
      [manifest, parsed] = await Promise.all([
        readFile(join(sourceRoot, directory, 'manifest.json'), 'utf8').then(JSON.parse),
        readFile(join(sourceRoot, directory, 'parsed-document.json'), 'utf8').then(JSON.parse),
      ]);
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    const identity = manifest.identity ?? {};
    if (!ALLOWED_FAMILIES.has(identity.report_family) || identity.dataset_split !== 'training') continue;
    if (isHorizontal(identity, parsed.blocks ?? [])) continue;
    if (excludeLineages.has(identity.dataset_group_key) || excludeHashes.has(identity.source_sha256)) continue;
    const start = (parsed.blocks ?? []).findIndex((block) =>
      block.block_type === 'heading' && numberedHeading(block.text, 4, /^INSPECTION REPORT$/));
    if (start < 0) continue;
    const relativeEnd = parsed.blocks.slice(start + 1).findIndex((block) =>
      block.block_type === 'heading' && /^5\s+/.test(normalize(block.text)));
    if (relativeEnd < 0) continue;
    const end = start + 1 + relativeEnd;
    sources.push({ identity, sectionBlocks: parsed.blocks.slice(start, end), startBlock: parsed.blocks[start] });
  }

  const hashUnique = [...new Map(sources.map((source) => [source.identity.source_sha256, source])).values()];
  const unique = [...new Map(hashUnique.map((source) => [
    source.identity.dataset_group_key || source.identity.source_sha256,
    source,
  ])).values()];
  const occurrences = new Map(BLOCKS.map((block) => [block.blockId, []]));
  const unknownHeadings = new Map();
  const members = [];

  for (const source of unique) {
    const member = {
      documentId: source.identity.document_id,
      caseId: source.identity.case_id,
      lineageId: source.identity.dataset_group_key,
      sourceSha256: source.identity.source_sha256,
      reportFamily: source.identity.report_family,
      datasetRole: 'knowledge_reference_candidate',
      sectionHeadingBlockId: source.startBlock.block_id,
      sourcePage: source.startBlock.source_spans?.[0]?.page_number ?? null,
    };
    members.push(member);
    let active = null;
    const reportOccurrences = new Map();
    for (let index = 1; index < source.sectionBlocks.length; index += 1) {
      const block = source.sectionBlocks[index];
      if (block.block_type === 'heading') {
        const mapped = mapHeading(block.text);
        if (mapped) {
          active = mapped;
          if (!reportOccurrences.has(mapped)) {
            reportOccurrences.set(mapped, {
              headings: [],
              content: [],
              firstOrder: index,
              source: member,
            });
          }
          reportOccurrences.get(mapped).headings.push(displayHeadingTemplate(mapped, block.text));
          continue;
        }
        const heading = normalize(block.text);
        if (heading) {
          const headingSha256 = sha256(heading);
          const current = unknownHeadings.get(headingSha256) ?? {
            headingSha256,
            characterCount: heading.length,
            wordCount: heading.split(/\s+/).length,
            count: 0,
            sourceRefs: [],
          };
          current.count += 1;
          if (current.sourceRefs.length < 5) {
            current.sourceRefs.push({ documentId: member.documentId, blockId: block.block_id,
              page: block.source_spans?.[0]?.page_number ?? null });
          }
          unknownHeadings.set(headingSha256, current);
        }
      }
      if (active) reportOccurrences.get(active)?.content.push(block);
    }
    for (const [blockId, occurrence] of reportOccurrences) {
      occurrences.get(blockId).push({
        source: occurrence.source,
        headings: occurrence.headings,
        firstOrder: occurrence.firstOrder,
        features: features(occurrence.content),
      });
    }
  }

  members.sort((a, b) => a.documentId.localeCompare(b.documentId));
  const sourceCount = members.length;
  const canonicalBlockCatalog = BLOCKS.map((definition, order) => {
    const rows = occurrences.get(definition.blockId);
    const headingStats = new Map();
    const formatCounts = new Map();
    for (const row of rows) {
      for (const heading of row.headings) {
        const current = headingStats.get(heading) ?? { occurrenceCount: 0, sourceHashes: new Set() };
        current.occurrenceCount += 1;
        current.sourceHashes.add(row.source.sourceSha256);
        headingStats.set(heading, current);
      }
      const family = definition.blockId === 'assessment-summaries'
        ? 'deterministic-assessment-v1' : formatFamily(row.features);
      formatCounts.set(family, (formatCounts.get(family) ?? 0) + 1);
    }
    const observedRate = sourceCount ? rows.length / sourceCount : 0;
    const variabilityCandidate = observedRate >= 0.8 ? 'common'
      : observedRate >= 0.2 ? 'conditional' : rows.length ? 'rare' : 'not_observed';
    return {
      blockId: definition.blockId,
      canonicalOrderCandidate: order + 1,
      observedReportCount: rows.length,
      observedReportRate: round(observedRate),
      variabilityCandidate,
      applicability: 'requires_human_review_against_scope_asset_configuration_and_standard',
      acceptedDisplayHeadingCandidates: [...headingStats.entries()]
        .sort((left, right) => right[1].sourceHashes.size - left[1].sourceHashes.size
          || right[1].occurrenceCount - left[1].occurrenceCount || left[0].localeCompare(right[0]))
        .map(([displayHeading, stats]) => ({
          displayHeading,
          reportCount: stats.sourceHashes.size,
          occurrenceCount: stats.occurrenceCount,
        })),
      allowedFormatFamilyCandidates: [...formatCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .map(([formatFamilyId, reportCount]) => ({ formatFamilyId, reportCount })),
      medianFirstPositionInSection: median(rows.map((row) => row.firstOrder)),
      aggregateNarrativeFeatures: aggregateFeatures(rows.map((row) => row.features)),
      sourceRefs: rows.map((row) => ({
        documentId: row.source.documentId,
        lineageId: row.source.lineageId,
        sourceSha256: row.source.sourceSha256,
      })),
    };
  });

  const memberSetSha256 = sha256(encode(members));
  return {
    contractVersion: 'inspection_report_section_knowledge_bundle_candidate_v1',
    status: 'candidate_requires_exclusions_pattern_review_and_freeze',
    releaseEligible: false,
    profileId: 'vertical_tank_inspection_v1',
    sectionId: 'inspection-report',
    sourcePopulation: {
      sourceCount,
      uniqueLineages: new Set(members.map((member) => member.lineageId)).size,
      exactHashDuplicatesCollapsed: sources.length - hashUnique.length,
      sameLineageSourcesCollapsed: hashUnique.length - unique.length,
      reportFamilies: Object.fromEntries([...new Set(members.map((member) => member.reportFamily))]
        .sort().map((family) => [family, members.filter((member) => member.reportFamily === family).length])),
      memberSetSha256,
      members,
      evaluationExclusionsApplied: exclusions.supplied,
      excludedLineageCount: exclusions.lineageIds.length,
      excludedSourceHashCount: exclusions.sourceSha256s.length,
      rawNarrativeIncluded: false,
      headingEvidenceIncluded: true,
      unmappedHeadingTextIncluded: false,
    },
    canonicalBlockCatalogCandidate: canonicalBlockCatalog,
    unknownHeadingCandidates: [...unknownHeadings.values()]
      .sort((left, right) => right.count - left.count
        || left.headingSha256.localeCompare(right.headingSha256)),
    unknownHeadingReviewPolicy: {
      rawTextIncluded: false,
      reviewMethod: 'open_private_source_by_document_and_block_reference_then_record_a_reviewed_mapping',
      reason: 'Parser heading labels may contain narrative findings; fingerprints prevent those passages entering the candidate.',
    },
    sectionLevelFormatCandidate: {
      blockTypeDistribution: features(unique.flatMap((source) => source.sectionBlocks.slice(1))),
      patternRule: 'Treat observed frequency as evidence for common or conditional structure, never as a current fact or standard obligation.',
    },
    roleProjectionCandidates: {
      reportStructurePlanner: ['canonicalBlockCatalogCandidate', 'unknownHeadingCandidates', 'sectionLevelFormatCandidate'],
      mockPreparationAgent: ['canonical component taxonomy', 'terminology review pending', 'capture-pattern review pending'],
      sectionGenerator: ['accepted heading candidates', 'allowed format candidates', 'narrative-pattern review pending'],
      preDisplayReviewer: ['accepted variation boundaries pending human review'],
      postGenerationEvaluator: ['generic pattern rubric pending human review'],
    },
    requiredBeforeFreeze: [
      'freeze_evaluation_cohort_and_rebuild_with_lineage_and_hash_exclusions',
      'review_unmapped_headings_and_canonical_block_mapping',
      'review_common_conditional_optional_and_rare_classification',
      'review_applicability_rules_and_format_families',
      'derive_and_review_placeholder_narrative_and_terminology_patterns',
      'build_and_hash_all_five_role_projections',
      'verify_no_raw_narrative_or_current_fact_in_runtime_projections',
      'inspector_and_engineer_approval',
    ],
  };
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) {
  try {
    const args = parseKnowledgeCandidateArguments(process.argv.slice(2));
    const exclusions = await loadExclusions(args.exclusions);
    const candidate = await buildInspectionReportKnowledgeCandidate({
      sourceRoot: resolve(args.source),
      exclusions,
    });
    const output = resolve(args.output);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, encode(candidate), { mode: 0o600 });
    console.log(JSON.stringify({
      created: true,
      output,
      status: candidate.status,
      releaseEligible: candidate.releaseEligible,
      sourceCount: candidate.sourcePopulation.sourceCount,
      uniqueLineages: candidate.sourcePopulation.uniqueLineages,
      canonicalBlockCandidates: candidate.canonicalBlockCatalogCandidate.length,
      unknownHeadingCandidates: candidate.unknownHeadingCandidates.length,
      evaluationExclusionsApplied: candidate.sourcePopulation.evaluationExclusionsApplied,
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ created: false, error: error.message }, null, 2));
    process.exitCode = 1;
  }
}
