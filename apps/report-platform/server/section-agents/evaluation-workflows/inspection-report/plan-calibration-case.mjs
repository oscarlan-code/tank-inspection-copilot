#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const encode = (value) => JSON.stringify(value, null, 2) + '\n';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function parseArguments(argv) {
  const result = { truthCase: null, bundle: null, output: null };
  const flags = { '--truth-case': 'truthCase', '--bundle': 'bundle', '--output': 'output' };
  for (let index = 0; index < argv.length; index += 1) {
    const key = flags[argv[index]];
    if (!key) throw new Error('Unknown argument: ' + argv[index]);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(argv[index] + ' requires a value');
    result[key] = resolve(value);
    index += 1;
  }
  if (!result.truthCase || !result.bundle || !result.output) {
    throw new Error('Usage: plan-calibration-case.mjs --truth-case <truth.json> --bundle <bundle.json> --output <report-plan.json>');
  }
  return result;
}

function evidenceText(records) {
  return records.flatMap((record) => [record.component_entity, record.condition,
    record.location, record.severity_or_extent]).join(' ').toLowerCase();
}

function selectHeading(pattern, records) {
  const text = evidenceText(records);
  const accepted = new Set(pattern.acceptedDisplayHeadings);
  const choose = (value) => accepted.has(value) ? value : null;
  if (pattern.blockId === 'roof-external') {
    if (/external floating|external floater/.test(text)) return choose('EXTERNAL FLOATING ROOF') ?? pattern.preferredDisplayHeading;
    if (/dome/.test(text)) return choose('FIXED ROOF EXTERNAL (DOME)') ?? pattern.preferredDisplayHeading;
    if (/cone/.test(text)) return choose('FIXED ROOF (CONE)') ?? pattern.preferredDisplayHeading;
  }
  if (pattern.blockId === 'roof-internal') {
    if (/internal floating/.test(text)) return choose('FLOATING ROOF (INTERNAL)') ?? pattern.preferredDisplayHeading;
    if (/cone/.test(text)) return choose('FIXED ROOF INTERNAL (CONE)') ?? pattern.preferredDisplayHeading;
  }
  if (pattern.blockId === 'floor-internal') {
    if (/cone down/.test(text)) return choose('FLOOR INTERNAL (CONE DOWN)') ?? pattern.preferredDisplayHeading;
    if (/cone up/.test(text)) return choose('FLOOR INTERNAL (CONE UP)') ?? pattern.preferredDisplayHeading;
    if (/\bflat\b/.test(text)) return choose('FLOOR INTERNAL (FLAT)') ?? pattern.preferredDisplayHeading;
  }
  return pattern.preferredDisplayHeading ?? pattern.acceptedDisplayHeadings[0];
}

export function buildTargetBlindReportPlan({ truthCase, bundle, bundleRaw }) {
  assert.equal(bundle.status, 'frozen');
  assert.equal(truthCase.knowledge_bundle_id, bundle.bundleId);
  assert.equal(truthCase.knowledge_bundle_hash, sha256(bundleRaw));
  const factsByBlock = new Map(bundle.canonicalBlockCatalog.map((pattern) => [pattern.blockId,
    truthCase.evidence_records.filter((record) => record.component_block === pattern.blockId)]));
  const deterministicByBlock = new Map(bundle.canonicalBlockCatalog.map((pattern) => [pattern.blockId,
    truthCase.deterministic_inputs.filter((input) => input.component_block === pattern.blockId)]));
  const allDeterministicIds = truthCase.deterministic_inputs.map((input) => input.deterministic_input_id);
  const applicabilityDecisions = bundle.canonicalBlockCatalog.map((pattern) => {
    const facts = factsByBlock.get(pattern.blockId);
    const deterministic = deterministicByBlock.get(pattern.blockId);
    const basisEvidenceIds = pattern.blockId === 'assessment-summaries'
      ? allDeterministicIds
      : [...facts.map((record) => record.evidence_id),
        ...deterministic.map((input) => input.deterministic_input_id)];
    const include = basisEvidenceIds.length > 0;
    return {
      blockId: pattern.blockId,
      include,
      basisEvidenceIds,
      reason: include
        ? pattern.blockId === 'assessment-summaries'
          ? 'Reviewed deterministic inputs are present and require an assessment-summary block.'
          : 'Current evidence or reviewed deterministic input is assigned to this canonical block.'
        : 'No current evidence or reviewed deterministic input supports this conditional block.',
    };
  });
  const blocks = applicabilityDecisions.filter((decision) => decision.include).map((decision) => {
    const pattern = bundle.canonicalBlockCatalog.find((item) => item.blockId === decision.blockId);
    const facts = factsByBlock.get(pattern.blockId);
    const deterministic = deterministicByBlock.get(pattern.blockId);
    return {
      order: pattern.order,
      blockId: pattern.blockId,
      displayHeading: selectHeading(pattern, facts),
      formatFamilyId: pattern.blockId === 'assessment-summaries'
        ? 'deterministic-assessment-v1'
        : pattern.allowedFormatFamilyIds.includes('component-list-v1')
          ? 'component-list-v1' : pattern.allowedFormatFamilyIds[0],
      ownership: pattern.blockId === 'assessment-summaries'
        ? 'deterministic_compiler'
        : 'evidence_bound_narrative_with_deterministic_heading',
      applicabilityEvidenceIds: decision.basisEvidenceIds,
      narrativeEvidenceIds: facts.map((record) => record.evidence_id),
      deterministicInputIds: pattern.blockId === 'assessment-summaries'
        ? allDeterministicIds : deterministic.map((input) => input.deterministic_input_id),
    };
  });
  const plan = {
    contractVersion: 'inspection_report_evaluation_report_plan_v2',
    status: 'frozen',
    evaluationOnly: true,
    profileId: 'vertical_tank_inspection_v1',
    sectionId: 'inspection-report',
    sectionTitle: '4 INSPECTION REPORT',
    caseId: truthCase.case_id,
    knowledgeBundleId: bundle.bundleId,
    knowledgeBundleSha256: sha256(bundleRaw),
    structureProjectionId: bundle.roleProjections.reportStructurePlanner.projectionId,
    targetGoldStructureUsed: false,
    planningBasis: 'reviewed_normalized_current_evidence_and_frozen_structure_projection',
    applicabilityDecisions,
    blocks,
  };
  plan.reportPlanSha256 = sha256(encode(plan));
  return plan;
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) {
  try {
    const args = parseArguments(process.argv.slice(2));
    const [truthRaw, bundleRaw] = await Promise.all([
      readFile(args.truthCase, 'utf8'), readFile(args.bundle, 'utf8'),
    ]);
    const plan = buildTargetBlindReportPlan({
      truthCase: JSON.parse(truthRaw), bundle: JSON.parse(bundleRaw), bundleRaw,
    });
    await writeFile(args.output, encode(plan), { mode: 0o600 });
    console.log(JSON.stringify({
      created: true,
      output: args.output,
      caseId: plan.caseId,
      includedBlocks: plan.blocks.map((block) => block.blockId),
      targetGoldStructureUsed: plan.targetGoldStructureUsed,
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ created: false, error: error.message }, null, 2));
    process.exitCode = 1;
  }
}
