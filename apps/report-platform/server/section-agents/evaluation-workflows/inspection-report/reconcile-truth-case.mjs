#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const encode = (value) => JSON.stringify(value, null, 2) + '\n';

function extractCrossReferences(text) {
  const references = [];
  const pattern = /\b(Photo|Figure|Sketch|Table|Appendix)\s*(?:No\.?\s*)?([A-Za-z]?\d+(?:\.\d+)?)/gi;
  for (const match of String(text ?? '').matchAll(pattern)) {
    const label = `${match[1][0].toUpperCase()}${match[1].slice(1).toLowerCase()} ${match[2]}`;
    if (!references.some((item) => item.label.toLowerCase() === label.toLowerCase())) {
      references.push({
        target_type: match[1].toLowerCase(),
        label,
        source_status: 'historical_report_reference_only',
        asset_status: 'authorized_source_extraction_required',
      });
    }
  }
  return references;
}

function parseArguments(argv) {
  const result = { inventory: null, truthCase: null, output: null };
  const flags = { '--inventory': 'inventory', '--truth-case': 'truthCase', '--output': 'output' };
  for (let index = 0; index < argv.length; index += 1) {
    const key = flags[argv[index]];
    if (!key) throw new Error('Unknown argument: ' + argv[index]);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(argv[index] + ' requires a value');
    result[key] = resolve(value);
    index += 1;
  }
  if (!result.inventory || !result.truthCase || !result.output) {
    throw new Error('Usage: reconcile-truth-case.mjs --inventory <reviewed.json> --truth-case <truth.json> --output <truth.json>');
  }
  return result;
}

export function reconcileTruthCase({ inventory, inventoryRaw, truthCase }) {
  assert.equal(inventory.review.status, 'complete');
  assert.equal(truthCase.case_id, inventory.caseId);
  const facts = new Map(inventory.sourceUnits
    .filter((unit) => unit.reviewedDisposition === 'required_current_fact')
    .map((unit) => [unit.sourceUnitId, unit]));
  const deterministic = new Map(inventory.sourceUnits
    .filter((unit) => unit.reviewedDisposition === 'deterministic_content')
    .map((unit) => [unit.sourceUnitId, unit]));

  const evidence = truthCase.evidence_records.filter((record) =>
    record.source_obligation_ids.length === 1 && facts.has(record.source_obligation_ids[0]));
  const evidenceIds = new Set(evidence.flatMap((record) => record.source_obligation_ids));
  assert.deepEqual([...evidenceIds].sort(), [...facts.keys()].sort(),
    'Reviewed current facts are not fully represented in the existing truth case');

  const deterministicInputs = truthCase.deterministic_inputs.filter((input) =>
    input.source_obligation_ids.length === 1 && deterministic.has(input.source_obligation_ids[0]));
  const coveredDeterministic = new Set(deterministicInputs.flatMap((input) => input.source_obligation_ids));
  for (const [sourceUnitId, unit] of deterministic) {
    if (coveredDeterministic.has(sourceUnitId)) continue;
    const override = unit.normalizationOverride;
    assert(override, sourceUnitId + ' moved to deterministic content without a reviewed normalization override');
    deterministicInputs.push({
      deterministic_input_id: 'pending-renumber',
      source_obligation_ids: [sourceUnitId],
      component_block: unit.componentBlockId,
      input_type: override.inputType,
      normalized_data: override.normalizedData,
      summary_label: override.summaryLabel,
      requires_deterministic_compiler: override.requiresDeterministicCompiler,
    });
  }
  assert.deepEqual([...new Set(deterministicInputs.flatMap((input) => input.source_obligation_ids))].sort(),
    [...deterministic.keys()].sort(), 'Reviewed deterministic obligations are not fully represented');

  return {
    ...truthCase,
    dataset_split: inventory.datasetSplit,
    reviewed_obligation_inventory_hash: sha256(inventoryRaw),
    evidence_records: evidence.map((record, index) => ({
      ...record,
      evidence_id: `evidence-${String(index + 1).padStart(4, '0')}`,
      component_block: facts.get(record.source_obligation_ids[0]).componentBlockId,
      cross_references: extractCrossReferences(facts.get(record.source_obligation_ids[0]).sourceText),
    })),
    deterministic_inputs: deterministicInputs.map((input, index) => ({
      ...input,
      deterministic_input_id: `deterministic-${String(index + 1).padStart(4, '0')}`,
      component_block: deterministic.get(input.source_obligation_ids[0]).componentBlockId,
    })),
    review: {
      ...truthCase.review,
      reconciliation: {
        status: 'complete',
        basis: 'reviewed_source_disposition_corrections',
        removedNonFactEvidenceCount: truthCase.evidence_records.length - evidence.length,
        addedDeterministicOverrideCount: deterministicInputs.length
          - truthCase.deterministic_inputs.filter((input) => input.source_obligation_ids
            .some((sourceUnitId) => deterministic.has(sourceUnitId))).length,
      },
    },
  };
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) {
  try {
    const args = parseArguments(process.argv.slice(2));
    const [inventoryRaw, truthRaw] = await Promise.all([
      readFile(args.inventory, 'utf8'), readFile(args.truthCase, 'utf8'),
    ]);
    const reconciled = reconcileTruthCase({
      inventory: JSON.parse(inventoryRaw), inventoryRaw, truthCase: JSON.parse(truthRaw),
    });
    await writeFile(args.output, encode(reconciled), { mode: 0o600 });
    console.log(JSON.stringify({
      created: true,
      output: args.output,
      evidenceRecords: reconciled.evidence_records.length,
      deterministicInputs: reconciled.deterministic_inputs.length,
      reconciliation: reconciled.review.reconciliation,
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ created: false, error: error.message }, null, 2));
    process.exitCode = 1;
  }
}
