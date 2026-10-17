#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const encode = (value) => JSON.stringify(value, null, 2) + '\n';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function parseReviewArguments(argv) {
  const result = { inventory: null, decisions: null, output: null };
  const flags = { '--inventory': 'inventory', '--decisions': 'decisions', '--output': 'output' };
  for (let index = 0; index < argv.length; index += 1) {
    const key = flags[argv[index]];
    if (!key) throw new Error('Unknown argument: ' + argv[index]);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(argv[index] + ' requires a value');
    result[key] = resolve(value);
    index += 1;
  }
  if (!result.inventory || !result.decisions || !result.output) {
    throw new Error('Usage: review-inventory.mjs --inventory <draft.json> --decisions <review.json> --output <reviewed.json>');
  }
  return result;
}

export function reviewInventory({ inventory, decisions, inventoryRaw }) {
  assert.equal(inventory.contractVersion, 'inspection_report_source_obligation_inventory_v1');
  assert.equal(decisions.acceptAllUnchangedProvisionalDispositions, true);
  assert.equal(decisions.qualification.productPromotionAllowed, false);
  const caseReview = decisions.cases[inventory.caseId];
  assert(caseReview, 'No review decisions for ' + inventory.caseId);
  const overrides = new Map(caseReview.overrides.map((item) => [item.sourceBlockId, item]));
  for (const blockId of overrides.keys()) {
    assert(inventory.sourceUnits.some((unit) => unit.sourceBlockId === blockId),
      'Review override references unknown block ' + blockId);
  }
  const sourceUnits = inventory.sourceUnits.map((unit) => {
    const override = overrides.get(unit.sourceBlockId);
    const reviewedDisposition = override?.reviewedDisposition ?? unit.provisionalDisposition;
    let reviewReason = override?.reason ?? null;
    if (reviewedDisposition === 'boilerplate_metadata') {
      reviewReason ??= 'Repeated page furniture or report metadata is outside Section 4 content.';
    }
    if (reviewedDisposition === 'reviewed_out_of_scope') {
      reviewReason ??= 'Empty bullet, extraction artifact or non-content unit.';
    }
    return {
      ...unit,
      componentBlockId: override?.componentBlockOverride ?? unit.componentBlockId,
      reviewedDisposition,
      reviewStatus: 'approved',
      reviewerIdentity: decisions.reviewerIdentity,
      reviewedAt: decisions.reviewedAt,
      reviewReason,
      normalizationOverride: override?.normalizationOverride ?? null,
    };
  });
  const result = {
    ...inventory,
    status: 'reviewed_for_workflow_calibration',
    sourceDatasetSplit: inventory.datasetSplit,
    datasetSplit: caseReview.datasetSplit,
    sourceUnits,
    review: {
      status: 'complete',
      totalSourceUnits: sourceUnits.length,
      reviewedSourceUnits: sourceUnits.length,
      dispositionCoverage: 1,
      reviewerIdentity: decisions.reviewerIdentity,
      completedAt: decisions.reviewedAt,
      authority: decisions.authority,
      inspectorApproval: decisions.qualification.inspectorApproval,
      qualifiesRelease: decisions.qualification.releaseQualificationAllowed,
      rule: 'Every source unit has one engineering-reviewed disposition; independent inspector approval remains pending.',
    },
    draftInventorySha256: sha256(inventoryRaw),
    generatorInputAllowed: false,
  };
  result.counts.reviewedDispositions = Object.fromEntries([...new Set(sourceUnits
    .map((unit) => unit.reviewedDisposition))].sort().map((disposition) => [
      disposition,
      sourceUnits.filter((unit) => unit.reviewedDisposition === disposition).length,
    ]));
  return result;
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) {
  try {
    const args = parseReviewArguments(process.argv.slice(2));
    const [inventoryRaw, decisions] = await Promise.all([
      readFile(args.inventory, 'utf8'),
      readFile(args.decisions, 'utf8').then(JSON.parse),
    ]);
    const reviewed = reviewInventory({ inventory: JSON.parse(inventoryRaw), decisions, inventoryRaw });
    await mkdir(dirname(args.output), { recursive: true });
    await writeFile(args.output, encode(reviewed), { mode: 0o600 });
    console.log(JSON.stringify({
      created: true,
      output: args.output,
      caseId: reviewed.caseId,
      reviewedSourceUnits: reviewed.review.reviewedSourceUnits,
      overrides: decisions.cases[reviewed.caseId].overrides.length,
      inspectorApproval: reviewed.review.inspectorApproval,
      qualifiesRelease: reviewed.review.qualifiesRelease,
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ created: false, error: error.message }, null, 2));
    process.exitCode = 1;
  }
}
