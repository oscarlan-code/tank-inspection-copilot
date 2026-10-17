import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyEvidence, narrativeOutputSchema, narrativePrompt }
  from '../../../contents-classification-agent/sandbox/candidates/contents-classification-v3/runtime.mjs';
import { guardClassification }
  from '../../../contents-classification-agent/sandbox/candidates/contents-classification-v3/classification-guard.mjs';
import { buildCandidateFingerprint }
  from '../../../contents-classification-agent/sandbox/candidates/contents-classification-v3/candidate-fingerprint.mjs';
import { auditRequestPreview } from '../robustness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPORT_PLATFORM_ROOT = path.resolve(HERE, '../../../..');
const DEFAULT_OUTPUT = path.join(REPORT_PLATFORM_ROOT, '.local/contents-classification-eval/stabilization/contents-classification-v3/validation-30');
const MODEL_ID = 'gpt-5.6-sol';
const BATCH_SIZE = 10;

const canonicalize = value => Array.isArray(value) ? value.map(canonicalize)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]))
    : value;
const sha256 = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(canonicalize(value))).digest('hex');

function evidenceIdFor(item) {
  return `atom_${sha256({ dataset: 'classification-v3-validation-30', text: item.classifierInput }).slice(0, 24)}`;
}

function buildAtomization(cases) {
  const evidenceAtoms = cases.map(item => ({
    evidenceId: evidenceIdFor(item),
    kind: 'voice_narrative',
    originalValue: item.classifierInput,
    displayText: item.classifierInput,
    sourcePointer: `/voiceNotes/${evidenceIdFor(item)}/transcriptText`,
    sourceSpan: { start: 0, end: item.classifierInput.length },
    entity: {},
    relationships: { screenKey: 'findings', fieldKey: 'voice_note' },
    reportEvidence: true,
  }));
  return {
    contractVersion: 'source_linked_evidence_atoms_v1',
    atomizerId: 'evidence-atomizer-v1',
    inputPackageHash: sha256(evidenceAtoms.map(({ evidenceId, originalValue }) => ({ evidenceId, originalValue }))),
    evidenceAtoms,
  };
}

function requestPreview(atomization, fingerprint) {
  const requests = [];
  for (let index = 0; index < atomization.evidenceAtoms.length; index += BATCH_SIZE) {
    const atoms = atomization.evidenceAtoms.slice(index, index + BATCH_SIZE);
    requests.push({
      batchNumber: requests.length + 1,
      modelId: MODEL_ID,
      reasoningEffort: 'medium',
      evidenceCount: atoms.length,
      prompt: narrativePrompt(atoms),
      schema: narrativeOutputSchema(atoms.map(item => item.evidenceId)),
    });
  }
  return {
    contractVersion: 'contents_classification_request_preview_v1',
    evaluationOnly: true,
    classifierCandidateId: fingerprint.candidateId,
    candidateFingerprintSha256: fingerprint.sha256,
    goldIncluded: false,
    evaluatorCrosswalkIncluded: false,
    originalReportIncluded: false,
    requests,
  };
}

function evaluate({ cases, atomization, classification }) {
  const assignments = new Map(classification.classificationAssignments.map(item => [item.evidenceId, item]));
  const rows = cases.map(item => {
    const evidenceId = evidenceIdFor(item);
    const assignment = assignments.get(evidenceId);
    const predicted = assignment?.uses?.[0] ?? null;
    const expected = item.expectedUse;
    const sectionPass = expected === null ? predicted === null : predicted?.sectionId === expected.sectionId;
    const exactPass = expected === null ? predicted === null
      : predicted?.sectionId === expected.sectionId && predicted?.blockId === expected.blockId;
    return {
      caseId: item.caseId,
      lineageId: item.lineageId,
      sourceReport: item.sourceReport,
      sourcePage: item.sourcePage,
      evidenceId,
      classifierInput: item.classifierInput,
      expectedUse: expected,
      predictedUse: predicted ? { sectionId: predicted.sectionId, blockId: predicted.blockId } : null,
      sectionPass,
      exactPass,
      feedback: assignment?.feedback ?? '',
    };
  });
  const count = rows.length;
  const sectionPassed = rows.filter(row => row.sectionPass).length;
  const exactPassed = rows.filter(row => row.exactPass).length;
  return {
    contractVersion: 'contents_classification_validation_result_v1',
    evaluationOnly: true,
    datasetId: 'classification-v3-validation-30',
    classifierCandidateId: classification.candidateId,
    modelId: MODEL_ID,
    metrics: {
      total: count,
      sectionPassed,
      sectionAccuracy: count ? sectionPassed / count : 0,
      exactPassed,
      exactAccuracy: count ? exactPassed / count : 0,
      zeroRouteExpected: rows.filter(row => row.expectedUse === null).length,
      zeroRouteCorrect: rows.filter(row => row.expectedUse === null && row.predictedUse === null).length,
      reportLineages: new Set(cases.map(item => item.lineageId)).size,
    },
    rows,
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const execute = args.has('--execute');
  const source = JSON.parse(await readFile(path.join(HERE, 'evaluator-private-validation-cases.json'), 'utf8'));
  const lineageReceipt = JSON.parse(await readFile(path.join(HERE, 'validation-lineage-receipt.json'), 'utf8'));
  assert.equal(source.cases.length, 30);
  assert.equal(source.datasetSplit, 'validation');
  assert.equal(new Set(source.cases.map(item => item.lineageId)).size, 3);
  assert.deepEqual([...new Set(source.cases.map(item => item.lineageId))].sort(),
    lineageReceipt.lineages.map(item => item.assetLineageKey).sort());
  for (const item of source.cases) {
    const lineage = lineageReceipt.lineages.find(entry => entry.assetLineageKey === item.lineageId);
    assert(lineage, `Missing validation lineage receipt for ${item.caseId}.`);
    assert.equal(item.sourceSha256, lineage.sourceSha256);
    assert.equal(item.sourceReport, lineage.sourceReport);
    assert(!/scope-of-inspection|general-tank-information|inspection-report|repair-recommendations|test-information/i.test(item.classifierInput),
      `Classifier input ${item.caseId} exposes a canonical section label.`);
  }
  const fingerprint = buildCandidateFingerprint();
  const atomization = buildAtomization(source.cases);
  const preview = requestPreview(atomization, fingerprint);
  const leakage = auditRequestPreview({
    preview,
    candidateFingerprint: fingerprint,
    evaluatorPrivateIdentifiers: source.cases.flatMap(item => [item.caseId, item.sourceReport, item.sourceSha256, item.sourceText]),
  });
  assert.equal(leakage.decision, 'passed', leakage.issues.join(', '));
  await mkdir(DEFAULT_OUTPUT, { recursive: true });
  await writeFile(path.join(DEFAULT_OUTPUT, 'request-preview.json'), `${JSON.stringify(preview, null, 2)}\n`);
  await writeFile(path.join(DEFAULT_OUTPUT, 'request-leakage-audit.json'), `${JSON.stringify(leakage, null, 2)}\n`);
  await writeFile(path.join(DEFAULT_OUTPUT, 'candidate-fingerprint.json'), `${JSON.stringify(fingerprint, null, 2)}\n`);
  await writeFile(path.join(DEFAULT_OUTPUT, 'validation-lineage-receipt.json'), `${JSON.stringify(lineageReceipt, null, 2)}\n`);
  if (!execute) {
    process.stdout.write(`${JSON.stringify({ status: 'preview_ready', outputDirectory: DEFAULT_OUTPUT, requestCount: preview.requests.length,
      evidenceCount: atomization.evidenceAtoms.length, leakageDecision: leakage.decision }, null, 2)}\n`);
    return;
  }
  process.env.REPORT_PLATFORM_CODEX_MODEL = MODEL_ID;
  const codex = await import('../../../codex-cli.mjs');
  const status = codex.getAiStatus();
  assert.equal(status.configured, true, status.detail);
  let batch = 0;
  const classification = await classifyEvidence({ atomization, modelId: status.modelId, batchSize: BATCH_SIZE,
    narrativeWorker: async ({ prompt, schema }) => {
      batch += 1;
      const response = await codex.runStructuredCodexJob({ prompt, schema, reasoningEffort: 'medium' });
      await writeFile(path.join(DEFAULT_OUTPUT, `worker-batch-${String(batch).padStart(2, '0')}.json`),
        `${JSON.stringify(response.parsed, null, 2)}\n`);
      process.stdout.write(`${JSON.stringify({ progress: batch, totalBatches: preview.requests.length })}\n`);
      return response.parsed;
    } });
  const guard = guardClassification({ classification });
  assert.equal(guard.decision, 'passed', JSON.stringify(guard.issues));
  const result = evaluate({ cases: source.cases, atomization, classification });
  result.candidateFingerprintSha256 = fingerprint.sha256;
  result.predictionSha256 = sha256(classification.classificationAssignments);
  result.generatedAtIso = new Date().toISOString();
  await writeFile(path.join(DEFAULT_OUTPUT, 'classification.json'), `${JSON.stringify(classification, null, 2)}\n`);
  await writeFile(path.join(DEFAULT_OUTPUT, 'classification-guard.json'), `${JSON.stringify(guard, null, 2)}\n`);
  await writeFile(path.join(DEFAULT_OUTPUT, 'evaluation.json'), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: 'complete', outputDirectory: DEFAULT_OUTPUT,
    metrics: result.metrics, candidateFingerprintSha256: fingerprint.sha256, predictionSha256: result.predictionSha256 }, null, 2)}\n`);
}

main().catch(error => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});

