#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SECTION_START = /^\s*4(?:[.\s:-]+)INSPECTION REPORT\b/i;
const NEXT_SECTION = /^\s*5(?:[.\s:-]+)/i;

const COMPONENT_HEADINGS = [
  { pattern: /^DIKED AREA$/i, blockId: 'diked-area' },
  { pattern: /^FOUNDATION$/i, blockId: 'foundation' },
  { pattern: /^(?:SHELL|SHELL EXTERNAL)$/i, blockId: 'shell-external' },
  { pattern: /^SHELL APPURTENANCES?$/i, blockId: 'shell-appurtenances' },
  { pattern: /^ACCESS STRUCTURES?$/i, blockId: 'access-structures' },
  { pattern: /^(?:ROOF INTERNAL|FIXED ROOF INTERNAL(?: \((?:CONE|DOME)\))?|FLOATING ROOF \(INTERNAL\))$/i, blockId: 'roof-internal' },
  { pattern: /^(?:ROOF(?: \((?:CONE|DOME)\))?|FIXED ROOF(?: EXTERNAL)? \((?:CONE|DOME)\)|ROOF EXTERNAL|EXTERNAL FLOATING ROOF|FLOATING ROOF \(EXTERNAL FLOATER\)|ROOF - EXTERNAL FLOATER)$/i, blockId: 'roof-external' },
  { pattern: /^ROOF APPURTENANCES?$/i, blockId: 'roof-appurtenances' },
  { pattern: /^SHELL INTERNAL$/i, blockId: 'shell-internal' },
  { pattern: /^(?:FLOOR INTERNAL(?: \((?:CONE DOWN|CONE UP|FLAT)\))?|FLOOR \(CONE UP\))$/i, blockId: 'floor-internal' },
];

const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function componentForHeading(text) {
  const normalized = normalize(text);
  return COMPONENT_HEADINGS.find((entry) => entry.pattern.test(normalized)) ?? null;
}

function isPageFurniture(text) {
  return /^(?:Client|Tank\s*No\.?|Job\s*No\.?|Date\s*Completed|Page)\s*:/i.test(text)
    || /^Back to Content Page$/i.test(text);
}

function classifyUnit(block, context) {
  const text = normalize(block.text);
  if (block.block_type === 'heading') {
    return {
      disposition: 'gold_structure_reference',
      reason: componentForHeading(text)
        ? 'Target component heading and order are evaluator-only gold, not a ReportPlan input.'
        : 'Target section or calculation heading is evaluator-only format gold.',
    };
  }
  if (block.block_type === 'figure') {
    return {
      disposition: 'cross_reference',
      reason: 'Figure must be linked to an authorized report-plan target or reviewed out.',
    };
  }
  if (!text || text === '•') {
    return {
      disposition: 'reviewed_out_of_scope',
      reason: 'Empty text or isolated parser marker requires reviewer confirmation.',
    };
  }
  if (isPageFurniture(text)) {
    return {
      disposition: 'boilerplate_metadata',
      reason: 'Repeated page furniture is outside the Section 4 finding content.',
    };
  }
  if (/^\s*refer\b/i.test(text)) {
    return {
      disposition: 'cross_reference',
      reason: 'Explicit source cross-reference must resolve to an included target.',
    };
  }
  if (/\brecommend(?:ed|ation|s|ing)?\b/i.test(text)) {
    return {
      disposition: 'recommendation_route',
      reason: 'Recommendation language must be routed outside the Section 4 generator input.',
    };
  }
  if (context.deterministicMode
      || /\b(?:calculated|calculation|corrosion rate|remaining service life|inspection interval)\b/i.test(text)) {
    return {
      disposition: 'deterministic_content',
      reason: 'Calculation, selected measurement summary, or calculation note needs pinned deterministic inputs.',
    };
  }
  return {
    disposition: 'required_current_fact',
    reason: 'Provisional current observation, condition, limitation, configuration, or test result.',
  };
}

export function parseInventoryArguments(argv) {
  const parsed = { source: null, output: null, caseId: null };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!['--source', '--output', '--case-id'].includes(flag)) {
      throw new Error('Unknown argument: ' + flag);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(flag + ' requires a value');
    if (flag === '--source') parsed.source = value;
    if (flag === '--output') parsed.output = value;
    if (flag === '--case-id') parsed.caseId = value;
    index += 1;
  }
  if (!parsed.source || !parsed.output) {
    throw new Error('Usage: inventory.mjs --source <canonical artifact directory> --output <draft.json> [--case-id <id>]');
  }
  return parsed;
}

async function resolveInputs(sourceArg) {
  const source = resolve(sourceArg);
  const sourceStat = await stat(source);
  const artifactDir = sourceStat.isDirectory() ? source : dirname(source);
  const parsedPath = sourceStat.isDirectory() ? join(source, 'parsed-document.json') : source;
  const manifestPath = join(artifactDir, 'manifest.json');
  const [parsed, manifest] = await Promise.all([
    readFile(parsedPath, 'utf8').then(JSON.parse),
    readFile(manifestPath, 'utf8').then(JSON.parse),
  ]);
  return { artifactDir, parsedPath, manifestPath, parsed, manifest };
}

export function buildSourceObligationInventory({ parsed, manifest, caseId }) {
  if (!Array.isArray(parsed?.blocks) || parsed.blocks.length === 0) {
    throw new Error('parsed-document.json contains no blocks');
  }
  const startIndex = parsed.blocks.findIndex((block) =>
    block.block_type === 'heading' && SECTION_START.test(normalize(block.text)));
  if (startIndex < 0) throw new Error('Could not locate exact Section 4 INSPECTION REPORT heading');
  const relativeEnd = parsed.blocks.slice(startIndex + 1).findIndex((block) =>
    block.block_type === 'heading' && NEXT_SECTION.test(normalize(block.text)));
  if (relativeEnd < 0) throw new Error('Could not locate the next numbered Section 5 heading');
  const endIndexExclusive = startIndex + 1 + relativeEnd;
  const sourceBlocks = parsed.blocks.slice(startIndex, endIndexExclusive);

  let activeComponent = null;
  let deterministicMode = false;
  const planBlocks = [];
  const exactHeadingSequence = [];
  const units = sourceBlocks.map((block, offset) => {
    const text = normalize(block.text);
    const component = block.block_type === 'heading' ? componentForHeading(text) : null;
    if (component) {
      activeComponent = component.blockId;
      deterministicMode = false;
      planBlocks.push({
        order: planBlocks.length + 1,
        blockId: component.blockId,
        displayHeading: text,
        sourceBlockId: block.block_id,
        sourceObligationIds: [],
        ownership: 'hybrid_deterministic_heading_and_evidence_bound_content',
        deterministicSubheadings: [],
      });
    } else if (block.block_type === 'heading' && offset > 0) {
      deterministicMode = /(?:CALCULAT|CORROSION RATE|REMAINING|INSPECTION INTERVAL|BEFORE REPAIRS)/i.test(text);
    }

    const sequence = offset + 1;
    const sourceUnitId = 'inspection-report-source-' + String(sequence).padStart(4, '0');
    const classification = classifyUnit(block, { deterministicMode });
    const pageNumbers = [...new Set((block.source_spans ?? [])
      .map((span) => span.page_number).filter((page) => Number.isInteger(page)))];

    if (block.block_type === 'heading') {
      exactHeadingSequence.push({
        order: exactHeadingSequence.length + 1,
        sourceUnitId,
        headingLevel: block.heading_level,
        displayHeading: text,
        componentBlockId: activeComponent,
      });
      if (component) {
        planBlocks.at(-1).sourceObligationIds.push(sourceUnitId);
      } else if (planBlocks.length > 0 && offset > 0) {
        planBlocks.at(-1).deterministicSubheadings.push({
          displayHeading: text,
          sourceObligationId: sourceUnitId,
          headingLevel: block.heading_level,
        });
      }
    }

    return {
      sourceUnitId,
      sourceOrder: sequence,
      sourceBlockId: block.block_id,
      sourceBlockType: block.block_type,
      sourceHeadingLevel: block.heading_level ?? null,
      pageNumbers,
      sourceText: text,
      sourceSpans: block.source_spans ?? [],
      extractionConfidence: block.extraction_confidence ?? null,
      componentBlockId: activeComponent,
      provisionalDisposition: classification.disposition,
      provisionalReason: classification.reason,
      reviewStatus: 'pending',
      reviewedDisposition: null,
      reviewerIdentity: null,
      reviewedAt: null,
      reviewReason: null,
      requirements: {
        componentEntity: classification.disposition === 'required_current_fact',
        location: classification.disposition === 'required_current_fact',
        inspectionSide: classification.disposition === 'required_current_fact',
        polarity: classification.disposition === 'required_current_fact',
        uncertainty: classification.disposition === 'required_current_fact',
        valuesAndUnits: /\d/.test(text),
      },
      mappings: {
        evidenceIds: [],
        deterministicInputIds: [],
        reportPlanBlockIds: component ? [component.blockId] : [],
        crossReferenceTargetIds: [],
        recommendationObligationIds: [],
      },
    };
  });

  const identity = manifest.identity ?? {};
  const sourceSectionPayload = sourceBlocks.map((block) => ({
    block_id: block.block_id,
    block_type: block.block_type,
    text: normalize(block.text),
    source_spans: block.source_spans ?? [],
  }));
  const provisionalCounts = Object.fromEntries([...new Set(units.map((unit) =>
    unit.provisionalDisposition))].sort().map((disposition) => [
    disposition, units.filter((unit) => unit.provisionalDisposition === disposition).length,
  ]));
  const blockTypeCounts = Object.fromEntries([...new Set(units.map((unit) =>
    unit.sourceBlockType))].sort().map((type) => [
    type, units.filter((unit) => unit.sourceBlockType === type).length,
  ]));

  return {
    contractVersion: 'inspection_report_source_obligation_inventory_v1',
    evaluationOnly: true,
    containsHistoricalGold: true,
    generatorInputAllowed: false,
    status: 'draft_pending_human_review',
    caseId: caseId ?? 'inspection-report-calibration-' + basename(identity.document_id ?? 'case'),
    lineageId: identity.dataset_group_key ?? null,
    datasetSplit: identity.dataset_split ?? null,
    source: {
      documentId: identity.document_id ?? null,
      caseId: identity.case_id ?? null,
      sourceSha256: identity.source_sha256 ?? null,
      reportFamily: identity.report_family ?? null,
      sectionStartBlockIndex: startIndex,
      sectionEndBlockIndexExclusive: endIndexExclusive,
      sectionPageNumbers: [...new Set(units.flatMap((unit) => unit.pageNumbers))].sort((a, b) => a - b),
      sectionPayloadSha256: sha256(JSON.stringify(sourceSectionPayload)),
    },
    review: {
      status: 'pending',
      totalSourceUnits: units.length,
      reviewedSourceUnits: 0,
      dispositionCoverage: 0,
      reviewerIdentity: null,
      completedAt: null,
      rule: 'Every source unit requires exactly one reviewed disposition; provisional labels do not qualify generation.',
    },
    counts: {
      sourceUnits: units.length,
      blockTypes: blockTypeCounts,
      provisionalDispositions: provisionalCounts,
      componentBlocks: planBlocks.length,
      exactHeadings: exactHeadingSequence.length,
    },
    goldStructureReference: {
      contractVersion: 'inspection_report_target_gold_structure_reference_v1',
      status: 'evaluator_only_pending_review',
      generatorInputAllowed: false,
      reportStructureAgentInputAllowed: false,
      preDisplayReviewerInputAllowed: false,
      postGenerationEvaluatorAccess: 'after_generation_only',
      profileId: 'vertical_tank_inspection_v1',
      sectionId: 'inspection-report',
      sectionTitle: normalize(sourceBlocks[0].text),
      sectionHeadingSourceObligationId: units[0].sourceUnitId,
      blocks: planBlocks,
      exactHeadingSequence,
    },
    sourceUnits: units,
  };
}

export async function createInventory({ source, output, caseId }) {
  const loaded = await resolveInputs(source);
  const inventory = buildSourceObligationInventory({
    parsed: loaded.parsed,
    manifest: loaded.manifest,
    caseId,
  });
  const outputPath = resolve(output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(inventory, null, 2) + '\n');
  return { outputPath, inventory };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const args = parseInventoryArguments(process.argv.slice(2));
    const result = await createInventory(args);
    console.log(JSON.stringify({
      created: true,
      output: result.outputPath,
      status: result.inventory.status,
      generationReady: false,
      sourceUnits: result.inventory.counts.sourceUnits,
      componentBlocks: result.inventory.counts.componentBlocks,
      exactHeadings: result.inventory.counts.exactHeadings,
      pendingHumanReview: result.inventory.review.totalSourceUnits,
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ created: false, error: error.message }, null, 2));
    process.exitCode = 1;
  }
}
