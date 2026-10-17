#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getAiStatus, runStructuredCodexJob } from '../../../codex-cli.mjs';

const encode = (value) => JSON.stringify(value, null, 2) + '\n';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const variantIds = [
  'ordered_voice_summary',
  'terse_field_shorthand',
  'disordered_multi_component_capture',
  'spoken_disfluency_and_self_correction',
  'fragmented_checklist_and_note_mix',
  'terminology_aliases_with_explicit_negation_and_uncertainty',
];
const captureChannels = {
  ordered_voice_summary: 'voice_note',
  terse_field_shorthand: 'typed_note',
  disordered_multi_component_capture: 'voice_note',
  spoken_disfluency_and_self_correction: 'voice_note',
  fragmented_checklist_and_note_mix: 'checklist_answer',
  terminology_aliases_with_explicit_negation_and_uncertainty: 'voice_note',
};

function parseArguments(argv) {
  const result = { stage: null, inventory: null, bundle: null, outputDir: null, run: false };
  const flags = { '--stage': 'stage', '--inventory': 'inventory', '--bundle': 'bundle',
    '--output-dir': 'outputDir' };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--run') { result.run = true; continue; }
    const key = flags[argv[index]];
    if (!key) throw new Error('Unknown argument: ' + argv[index]);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(argv[index] + ' requires a value');
    result[key] = key === 'stage' ? value : resolve(value);
    index += 1;
  }
  if (!['truth', 'mock'].includes(result.stage) || !result.inventory || !result.bundle || !result.outputDir) {
    throw new Error('Usage: prepare-calibration-case.mjs --stage truth|mock --inventory <reviewed.json> --bundle <bundle.json> --output-dir <dir> [--run]');
  }
  return result;
}

const stringField = { type: 'string' };
const stringArray = { type: 'array', items: stringField };
const factSchema = (count) => ({
  type: 'object', additionalProperties: false, required: ['facts'], properties: {
    facts: { type: 'array', minItems: count, maxItems: count, items: {
      type: 'object', additionalProperties: false,
      required: ['sourceUnitId', 'componentBlock', 'componentEntity', 'inspectionSide', 'location',
        'polarity', 'condition', 'severityOrExtent', 'uncertainty', 'valuesAndUnits'],
      properties: {
        sourceUnitId: stringField, componentBlock: stringField, componentEntity: stringField,
        inspectionSide: stringField, location: stringField, polarity: stringField,
        condition: stringField, severityOrExtent: stringField, uncertainty: stringField,
        valuesAndUnits: stringArray,
      },
    } },
  },
});
const deterministicSchema = (count) => ({
  type: 'object', additionalProperties: false, required: ['deterministicInputs'], properties: {
    deterministicInputs: { type: 'array', minItems: count, maxItems: count, items: {
      type: 'object', additionalProperties: false,
      required: ['sourceUnitId', 'componentBlock', 'inputType', 'normalizedData',
        'summaryLabel', 'requiresDeterministicCompiler'],
      properties: {
        sourceUnitId: stringField, componentBlock: stringField, inputType: stringField,
        normalizedData: stringArray, summaryLabel: stringField,
        requiresDeterministicCompiler: { type: 'boolean' },
      },
    } },
  },
});
const mockSchema = {
  type: 'object', additionalProperties: false, required: ['variants'], properties: {
    variants: { type: 'array', minItems: 6, maxItems: 6, items: {
      type: 'object', additionalProperties: false, required: ['variantId', 'records'], properties: {
        variantId: { type: 'string', enum: variantIds },
        records: { type: 'array', minItems: 1, items: {
          type: 'object', additionalProperties: false,
          required: ['componentBlock', 'evidenceIds', 'rawText'], properties: {
            componentBlock: stringField,
            evidenceIds: { type: 'array', minItems: 1, items: stringField },
            rawText: stringField,
          },
        } },
      },
    } },
  },
};

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function sourceInput(unit) {
  return {
    sourceUnitId: unit.sourceUnitId,
    componentBlock: unit.componentBlockId ?? 'unassigned',
    sourceText: unit.sourceText,
    pageNumbers: unit.pageNumbers,
    requirements: unit.requirements,
  };
}

function assertExactIds(actual, expected, label) {
  assert.deepEqual([...new Set(actual)].sort(), [...expected].sort(), label + ' IDs do not match request');
  assert.equal(actual.length, expected.length, label + ' contains duplicate IDs');
}

async function save(path, value) {
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, encode(value), { mode: 0o600 });
}

async function truthStage({ inventory, inventoryRaw, bundle, bundleRaw, outputDir, run }) {
  assert.equal(inventory.review.status, 'complete');
  assert.equal(bundle.status, 'frozen');
  const facts = inventory.sourceUnits.filter((unit) => unit.reviewedDisposition === 'required_current_fact');
  const deterministic = inventory.sourceUnits.filter((unit) => unit.reviewedDisposition === 'deterministic_content');
  const requests = [];
  for (const [kind, groups] of [
    ['facts', chunks(facts, 25)],
    ['deterministic', chunks(deterministic, 35)],
  ]) {
    for (let index = 0; index < groups.length; index += 1) {
      const group = groups[index];
      const prompt = kind === 'facts'
        ? `You are the evaluator-only Truth Case Builder for a vertical tank inspection report calibration case.\n\nConvert every supplied historical source obligation into one atomic normalized current-evidence fact. Preserve all entities, locations, internal/external side, polarity, uncertainty, values and units. Do not add facts, recommendations, report prose, style language, conclusions or historical precedent. Use \"not stated\" where a field is absent. The output is evaluator truth; it is not the mock note. The Section Knowledge Bundle terminology projection is context only.\n\nTERMINOLOGY PROJECTION:\n${JSON.stringify(bundle.roleProjections.mockPreparationAgent.terminologyPatterns)}\n\nSOURCE OBLIGATIONS:\n${JSON.stringify(group.map(sourceInput))}`
        : `You are the evaluator-only Truth Case Builder for deterministic Section 4 content.\n\nConvert every supplied deterministic obligation into compact structured inputs or an explicit compiler obligation. Preserve exact values, units, formulas, assumptions and component identity. Do not turn it into report prose and do not infer missing values. Use \"not stated\" where required.\n\nSOURCE OBLIGATIONS:\n${JSON.stringify(group.map(sourceInput))}`;
      requests.push({
        requestId: `${kind}-${String(index + 1).padStart(2, '0')}`,
        kind,
        sourceUnitIds: group.map((unit) => unit.sourceUnitId),
        prompt,
        schema: kind === 'facts' ? factSchema(group.length) : deterministicSchema(group.length),
      });
    }
  }
  const preview = {
    evaluationOnly: true,
    externalDestination: 'configured Codex/OpenAI report-generation worker',
    targetReportTextIncluded: true,
    reason: 'Evaluator-only truth normalization before mock preparation.',
    requestCount: requests.length,
    bundleId: bundle.bundleId,
    inventorySha256: sha256(inventoryRaw),
    requests,
  };
  await save(join(outputDir, 'truth-request-preview.json'), preview);
  if (!run) return { prepared: true, sent: false, requestCount: requests.length };
  const normalizedFacts = [];
  const normalizedDeterministic = [];
  for (const request of requests) {
    const responsePath = join(outputDir, 'worker', `truth-${request.requestId}.json`);
    const requestSha256 = sha256(JSON.stringify({ prompt: request.prompt, schema: request.schema }));
    let result;
    try {
      result = JSON.parse(await readFile(responsePath, 'utf8'));
      assert.equal(result.requestSha256, requestSha256, 'Cached worker response does not match request');
    } catch {
      const workerResult = await runStructuredCodexJob({ prompt: request.prompt, schema: request.schema,
        reasoningEffort: 'medium', timeoutMs: 180000 });
      result = { requestSha256, ...workerResult };
      await save(responsePath, result);
    }
    if (request.kind === 'facts') {
      assertExactIds(result.parsed.facts.map((item) => item.sourceUnitId), request.sourceUnitIds, request.requestId);
      normalizedFacts.push(...result.parsed.facts);
    } else {
      assertExactIds(result.parsed.deterministicInputs.map((item) => item.sourceUnitId),
        request.sourceUnitIds, request.requestId);
      normalizedDeterministic.push(...result.parsed.deterministicInputs);
    }
  }
  const units = new Map(inventory.sourceUnits.map((unit) => [unit.sourceUnitId, unit]));
  const evidenceRecords = normalizedFacts.map((fact, index) => {
    const unit = units.get(fact.sourceUnitId);
    return {
      evidence_id: `evidence-${String(index + 1).padStart(4, '0')}`,
      source_obligation_ids: [fact.sourceUnitId],
      component_entity: fact.componentEntity,
      component_block: fact.componentBlock,
      inspection_side: fact.inspectionSide,
      location: fact.location,
      polarity: fact.polarity,
      condition: fact.condition,
      severity_or_extent: fact.severityOrExtent,
      uncertainty: fact.uncertainty,
      values_and_units: fact.valuesAndUnits,
      capture_channel: 'reviewed_normalized_truth',
      source_span: { blockId: unit.sourceBlockId, pages: unit.pageNumbers },
      section_uses: ['inspection-report'],
    };
  });
  const deterministicInputs = normalizedDeterministic.map((item, index) => ({
    deterministic_input_id: `deterministic-${String(index + 1).padStart(4, '0')}`,
    source_obligation_ids: [item.sourceUnitId],
    component_block: item.componentBlock,
    input_type: item.inputType,
    normalized_data: item.normalizedData,
    summary_label: item.summaryLabel,
    requires_deterministic_compiler: item.requiresDeterministicCompiler,
  }));
  const truthCase = {
    contract_version: 'inspection_report_truth_case_v2',
    case_id: inventory.caseId,
    lineage_id: inventory.lineageId,
    dataset_split: inventory.datasetSplit,
    source_report_hash: inventory.source.sourceSha256,
    knowledge_bundle_id: bundle.bundleId,
    knowledge_bundle_hash: sha256(bundleRaw),
    reviewed_obligation_inventory_hash: sha256(inventoryRaw),
    evidence_records: evidenceRecords,
    deterministic_inputs: deterministicInputs,
    capture_variants: variantIds,
    review: {
      status: 'engineering_review_required',
      inspectorApproval: 'pending',
      originalNarrativeIncluded: false,
    },
  };
  await save(join(outputDir, 'truth-case.json'), truthCase);
  return { prepared: true, sent: true, requestCount: requests.length,
    evidenceRecords: evidenceRecords.length, deterministicInputs: deterministicInputs.length };
}

async function mockStage({ inventory, bundle, bundleRaw, outputDir, run }) {
  const truthPath = join(outputDir, 'truth-case.json');
  const [truth, capabilityContract] = await Promise.all([
    readFile(truthPath, 'utf8').then(JSON.parse),
    readFile(new URL('app-capture-capability-contract.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  const facts = truth.evidence_records.map((record) => ({
    evidenceId: record.evidence_id,
    sourceObligationIds: record.source_obligation_ids,
    componentBlock: record.component_block,
    componentEntity: record.component_entity,
    inspectionSide: record.inspection_side,
    location: record.location,
    polarity: record.polarity,
    condition: record.condition,
    severityOrExtent: record.severity_or_extent,
    uncertainty: record.uncertainty,
    valuesAndUnits: record.values_and_units,
    crossReferences: record.cross_references ?? [],
  }));
  const sourceReportUnits = inventory.sourceUnits.map(sourceInput);
  const prompt = `You are the open-book Mock Preparation Agent for a vertical tank inspection app evaluation. You may read the complete target source material below because your job is to reconstruct the current case and check its completeness. This source access ends when the mock export is frozen; no target source text or structure may pass to a report generator.\n\nCreate exactly six capture variants from the same reviewed truth. Use the exact required variant IDs. Each variant must cover every evidence ID exactly once across its records. Use the complete source material to verify context, component identity, relationships and coverage. Use only NORMALIZED TRUTH FACTS as the current-evidence records for the variants; do not convert boilerplate, evaluator-only structure, routed recommendations or out-of-scope material into current evidence. Group compatible facts by component block. Write realistic inspector capture, not finished report prose. Vary order, shorthand, disfluency, channel style, terminology aliases, negation and uncertainty as named by each variant. Preserve every entity, side, location, polarity, uncertainty, value and unit. Preserve supplied photo or figure labels only as capture references; never invent or describe an unseen image. Do not invent facts, recommendations, conclusions or satisfactory conditions. Do not mention historical reports in app notes and do not copy source sentences.\n\nAPP CAPABILITY CONTRACT:\n${JSON.stringify(capabilityContract)}\n\nMOCK-PREPARATION KB PROJECTION:\n${JSON.stringify(bundle.roleProjections.mockPreparationAgent)}\n\nCOMPLETE REVIEWED TARGET SOURCE MATERIAL (OPEN BOOK):\n${JSON.stringify(sourceReportUnits)}\n\nNORMALIZED TRUTH FACTS:\n${JSON.stringify(facts)}`;
  const preview = {
    evaluationOnly: true,
    externalDestination: 'configured Codex/OpenAI report-generation worker',
    targetReportTextIncluded: true,
    source: 'complete reviewed target source material plus normalized truth',
    requestCount: 1,
    bundleId: bundle.bundleId,
    request: { prompt, schema: mockSchema },
  };
  await save(join(outputDir, 'mock-request-preview.json'), preview);
  if (!run) return { prepared: true, sent: false, requestCount: 1 };
  const responsePath = join(outputDir, 'worker', 'mock-preparation.json');
  const requestSha256 = sha256(JSON.stringify({ prompt, schema: mockSchema }));
  let result;
  try {
    result = JSON.parse(await readFile(responsePath, 'utf8'));
    assert.equal(result.requestSha256, requestSha256, 'Cached worker response does not match request');
  } catch {
    const workerResult = await runStructuredCodexJob({ prompt, schema: mockSchema,
      reasoningEffort: 'medium', timeoutMs: 240000 });
    result = { requestSha256, ...workerResult };
    await save(responsePath, result);
  }
  assertExactIds(result.parsed.variants.map((variant) => variant.variantId), variantIds, 'mock variants');
  const expectedEvidenceIds = facts.map((fact) => fact.evidenceId);
  for (const variant of result.parsed.variants) {
    assertExactIds(variant.records.flatMap((record) => record.evidenceIds),
      expectedEvidenceIds, variant.variantId + ' evidence coverage');
  }
  const evidenceById = new Map(truth.evidence_records.map((record) => [record.evidence_id, record]));
  const variants = result.parsed.variants.map((variant) => ({
    variant_id: variant.variantId,
    truth_case_id: truth.case_id,
    variant_family: variant.variantId,
    capture_records: variant.records.map((record, index) => ({
      capture_id: `${variant.variantId}-${String(index + 1).padStart(2, '0')}`,
      capture_channel: captureChannels[variant.variantId],
      source_obligation_ids: record.evidenceIds.flatMap((id) => evidenceById.get(id).source_obligation_ids),
      raw_text: record.rawText,
      structured_value: { evidence_ids: record.evidenceIds },
      provenance: { source: 'open_book_mock_preparation_agent', bundleId: bundle.bundleId },
    })),
  }));
  const mockExport = {
    contract_version: 'inspection_report_mock_app_export_v2',
    case_id: truth.case_id,
    lineage_id: truth.lineage_id,
    dataset_split: truth.dataset_split,
    knowledge_bundle_id: bundle.bundleId,
    knowledge_bundle_hash: sha256(bundleRaw),
    mock_preparation_projection_id: bundle.roleProjections.mockPreparationAgent.projectionId,
    app_capture_capability_contract: capabilityContract.contractVersion,
    media_references: truth.evidence_records.flatMap((record) => (record.cross_references ?? [])
      .map((reference) => ({ ...reference, evidence_id: record.evidence_id,
        source_span: record.source_span }))),
    variants,
    generator_input: {
      evidence_ids: truth.evidence_records.map((record) => record.evidence_id),
      deterministic_input_ids: truth.deterministic_inputs.map((input) => input.deterministic_input_id),
      knowledge_bundle_id: bundle.bundleId,
      generation_projection_id: bundle.roleProjections.sectionGenerator.projectionId,
      original_historical_section_text_included: false,
      target_gold_structure_included: false,
      expected_report_wording_included: false,
      current_recommendations_included: false,
      same_lineage_historical_retrieval_included: false,
    },
  };
  await save(join(outputDir, 'mock-export.json'), mockExport);
  return { prepared: true, sent: true, requestCount: 1, variants: variants.length,
    captureRecords: variants.reduce((sum, variant) => sum + variant.capture_records.length, 0) };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const [inventoryRaw, bundleRaw] = await Promise.all([
    readFile(args.inventory, 'utf8'), readFile(args.bundle, 'utf8'),
  ]);
  const inventory = JSON.parse(inventoryRaw);
  const bundle = JSON.parse(bundleRaw);
  await mkdir(args.outputDir, { recursive: true });
  const aiStatus = getAiStatus();
  if (args.run) assert.equal(aiStatus.configured, true, aiStatus.detail);
  const result = args.stage === 'truth'
    ? await truthStage({ inventory, inventoryRaw, bundle, bundleRaw, outputDir: args.outputDir, run: args.run })
    : await mockStage({ inventory, bundle, bundleRaw, outputDir: args.outputDir, run: args.run });
  console.log(JSON.stringify({ stage: args.stage, caseId: inventory.caseId,
    modelId: args.run ? aiStatus.modelId : null, ...result }, null, 2));
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) main().catch((error) => {
  console.error(JSON.stringify({ created: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
