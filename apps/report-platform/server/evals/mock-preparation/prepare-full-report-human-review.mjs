#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const RUN_ID = 'mock-preparation-full-case-v1';
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function save(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

async function artifact(caseRoot, path) {
  const bytes = await readFile(join(caseRoot, path));
  return { path, sha256: sha256(bytes), byteSize: bytes.length };
}

function stableEvidence(value) {
  if (Array.isArray(value)) return value.map(stableEvidence);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !['inspectionId', 'createdAtIso', 'updatedAtIso', 'exportedAtIso'].includes(key))
      .map(([key, item]) => [key, stableEvidence(item)]));
  }
  return value;
}

function uniquePendingRows(rows) {
  const byUnit = new Map();
  for (const row of rows.filter((item) => item.result === 'pending')) {
    const key = `${row.unitType}:${row.sourceUnitId}`;
    const existing = byUnit.get(key);
    if (!existing) {
      byUnit.set(key, {
        reviewUnitId: key,
        sourceUnitId: row.sourceUnitId,
        unitType: row.unitType,
        sourcePage: row.sourcePage,
        originalText: row.originalText,
        protectedFacts: row.protectedFacts,
        appEvidenceValue: row.appEvidenceValue,
        appEvidenceRefs: row.appEvidenceRefs,
        datasets: [row.variantId],
        reviewInstruction: row.explanation,
      });
      continue;
    }
    assert.deepEqual(row.protectedFacts, existing.protectedFacts,
      `${key} has different protected facts across datasets.`);
    assert.deepEqual(stableEvidence(row.appEvidenceValue), stableEvidence(existing.appEvidenceValue),
      `${key} has different app evidence across datasets.`);
    existing.datasets.push(row.variantId);
  }
  return [...byUnit.values()];
}

function artifactPaths(result) {
  return [
    'case.json',
    'semantic-pairs.json',
    'review/gold-review-manifest.json',
    'review/mock-preparation-gold-review.json',
    `review/${RUN_ID}/atomic-fact-ledger.json`,
    `review/${RUN_ID}/result.json`,
    `review/${RUN_ID}/android-round-trip-result.json`,
    `review/${RUN_ID}/full-report-evaluation.json`,
    ...result.datasets.flatMap(({ datasetId }) => [
      `review/${RUN_ID}/datasets/${datasetId}/accepted.json`,
      `review/${RUN_ID}/android-plans/${datasetId}.json`,
      `review/${RUN_ID}/android-cases/${datasetId}/build-receipt.json`,
      `review/${RUN_ID}/android-cases/${datasetId}/assets/manifest.json`,
      `review/${RUN_ID}/android-cases/${datasetId}/drafts/concise-field.json`,
      `review/${RUN_ID}/android-cases/${datasetId}/exports/concise-field/v3-product-export.json`,
      `review/${RUN_ID}/android-cases/${datasetId}/exports/concise-field/android-export-receipt.json`,
    ]),
  ];
}

export async function prepareFullReportHumanReview(caseRootValue) {
  const caseRoot = resolve(caseRootValue);
  const runRoot = join(caseRoot, 'review', RUN_ID);
  const [caseRecord, result, android, evaluation] = await Promise.all([
    readJson(join(caseRoot, 'case.json')),
    readJson(join(runRoot, 'result.json')),
    readJson(join(runRoot, 'android-round-trip-result.json')),
    readJson(join(runRoot, 'full-report-evaluation.json')),
  ]);
  assert.equal(result.decision, 'pass', 'Generation and pre-export review did not pass.');
  assert.equal(android.decision, 'pass', 'Android round-trip audit did not pass.');
  assert.equal(android.crossDataset?.structuredDataIdentical, true,
    'Structured evidence differs across the controlled voice datasets.');
  assert.equal(evaluation.summary.failed, 0, 'Complete-report evaluation still has failures.');
  assert(evaluation.summary.pendingHumanReview > 0, 'No pending human-review rows were found.');

  const reviewUnits = uniquePendingRows(evaluation.rows);
  const reviewedArtifacts = await Promise.all(artifactPaths(result).map((path) => artifact(caseRoot, path)));
  const request = {
    contractVersion: 'mock_preparation_full_report_human_review_request_v1',
    evaluationOnly: true,
    caseId: caseRecord.caseId,
    caseRevision: caseRecord.caseRevision,
    sourceSha256: caseRecord.source.sourceSha256,
    status: 'human_review_required',
    instructions: 'Review each unique source unit against the original report and Android evidence. Confirm roof, shell and floor layouts in the emulator. Do not edit generated evidence during review.',
    summary: {
      sourceUnits: evaluation.sourceUnitCount,
      comparisonRows: evaluation.summary.comparisonCount,
      machineFailures: evaluation.summary.failed,
      narrativeFactChecksPassed: evaluation.summary.narrative.passed,
      structuredParityChecksPassed: evaluation.summary.structured.parityPassed,
      uniqueStructuredAndVisualReviewUnits: reviewUnits.length,
      pendingComparisonRows: evaluation.summary.pendingHumanReview,
      notApplicableComparisons: evaluation.summary.notApplicable,
    },
    requiredChecks: [
      'sourceCoverage', 'structuredFields', 'layoutFidelity', 'measurements', 'checklist',
      'photos', 'voiceVariation', 'lineage', 'leakage', 'emulatorUi',
    ],
    reviewUnits,
    reviewedArtifacts,
    preparedAtIso: new Date().toISOString(),
  };
  const output = join(runRoot, 'human-review-request.json');
  await save(output, request);
  return { output, request };
}

async function run() {
  const at = process.argv.indexOf('--case-root');
  if (at < 0 || !process.argv[at + 1]) {
    throw new Error('Usage: prepare-full-report-human-review.mjs --case-root <private-case-root>');
  }
  const { output, request } = await prepareFullReportHumanReview(process.argv[at + 1]);
  console.log(JSON.stringify({ output, status: request.status, summary: request.summary }, null, 2));
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) run().catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
