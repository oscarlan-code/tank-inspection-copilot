import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomizeEvidence }
  from '../../../contents-classification-agent/atomizers/evidence-atomizer/v4/atomizer.mjs';
import { classifyEvidence, narrativeOutputSchema, narrativePrompt }
  from '../../../contents-classification-agent/sandbox/candidates/contents-classification-v9/runtime.mjs';
import { guardClassification }
  from '../../../contents-classification-agent/sandbox/candidates/contents-classification-v9/classification-guard.mjs';
import { buildCandidateFingerprint }
  from '../../../contents-classification-agent/sandbox/candidates/contents-classification-v9/candidate-fingerprint.mjs';
import { auditRequestPreview } from '../robustness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPORT_PLATFORM_ROOT = path.resolve(HERE, '../../../..');
const DEFAULT_OUTPUT = path.join(REPORT_PLATFORM_ROOT,
  '.local/contents-classification-eval/stabilization/contents-classification-v9/hidden-raw-notes-20');
const MODEL_ID = 'gpt-5.6-sol';
const BATCH_SIZE = 10;
const DATASET_ID = 'classification-v9-hidden-raw-notes-20';

const canonicalize = value => Array.isArray(value) ? value.map(canonicalize)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]))
    : value;
const sha256 = value => createHash('sha256')
  .update(typeof value === 'string' ? value : JSON.stringify(canonicalize(value))).digest('hex');

function buildAtomization(cases) {
  const exportPackage = {
    packageType: 'v3_product_export',
    schemaVersion: 3,
    inspectionReference: 'opaque-hidden-classification-run',
    unitProfile: { thicknessUnit: 'mm' },
    inspectionRecord: { generalTankInformation: {} },
    voiceNotes: cases.map((item, index) => ({
      voiceNoteId: `hidden-note-${String(index + 1).padStart(3, '0')}`,
      screenKey: 'findings',
      fieldKey: 'voice_note',
      transcriptText: item.voiceNote,
    })),
  };
  const sealedInput = {
    contractVersion: 'sealed_classification_input_v1',
    guardId: 'evaluation-input-leakage-guard-v1',
    inputPackageHash: sha256(exportPackage),
    lineageToken: `eval_ln_${sha256({ dataset: DATASET_ID, exportPackage })}`,
    exportPackage,
  };
  return atomizeEvidence({ sealedInput });
}

function expectedRows(cases, atomization) {
  const atoms = atomization.evidenceAtoms.filter(item => item.kind === 'voice_narrative');
  return cases.flatMap((item, noteIndex) => item.expectedAtoms.map((expected, atomIndex) => {
    const sourcePointer = `/voiceNotes/${noteIndex}/transcriptText`;
    const matches = atoms.filter(atom =>
      atom.sourcePointer === sourcePointer && atom.originalValue === expected.text);
    assert.equal(matches.length, 1,
      `Expected exactly one atom for ${item.caseId} expectedAtoms[${atomIndex}].`);
    return {
      caseId: item.caseId,
      atomIndex,
      lineageId: item.lineageId,
      sourceReport: item.sourceReport,
      sourcePage: item.sourcePage,
      evidenceId: matches[0].evidenceId,
      classifierInput: matches[0].originalValue,
      expectedUse: expected.expectedUse,
    };
  }));
}

function requestPreview(atomization, fingerprint) {
  const voiceAtoms = atomization.evidenceAtoms.filter(item => item.kind === 'voice_narrative');
  const requests = [];
  for (let index = 0; index < voiceAtoms.length; index += BATCH_SIZE) {
    const atoms = voiceAtoms.slice(index, index + BATCH_SIZE);
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
    atomizerId: atomization.atomizerId,
    goldIncluded: false,
    evaluatorCrosswalkIncluded: false,
    originalReportIncluded: false,
    requests,
  };
}

function evaluate({ expected, classification }) {
  const assignments = new Map(classification.classificationAssignments
    .map(item => [item.evidenceId, item]));
  const rows = expected.map(item => {
    const assignment = assignments.get(item.evidenceId);
    const predicted = assignment?.uses?.[0] ?? null;
    return {
      ...item,
      predictedUse: predicted
        ? { sectionId: predicted.sectionId, blockId: predicted.blockId }
        : null,
      sectionPass: predicted?.sectionId === item.expectedUse.sectionId,
      exactPass: predicted?.sectionId === item.expectedUse.sectionId
        && predicted?.blockId === item.expectedUse.blockId,
      feedback: assignment?.feedback ?? '',
    };
  });
  const total = rows.length;
  const sectionPassed = rows.filter(row => row.sectionPass).length;
  const exactPassed = rows.filter(row => row.exactPass).length;
  const unroutedCount = rows.filter(row => row.predictedUse === null).length;
  const sectionAccuracy = total ? sectionPassed / total : 0;
  const exactAccuracy = total ? exactPassed / total : 0;
  const qualificationDecision = sectionAccuracy >= 0.98 && exactAccuracy >= 0.90 && unroutedCount === 0
    ? 'qualified_for_evaluation_release' : 'not_qualified_stop_without_tuning';
  return {
    contractVersion: 'contents_classification_hidden_qualification_result_v1',
    evaluationOnly: true,
    datasetId: DATASET_ID,
    evaluationRole: 'final_hidden_qualification',
    classifierCandidateId: classification.candidateId,
    atomizerId: classification.classificationManifest.atomizerId,
    modelId: MODEL_ID,
    metrics: {
      total,
      sectionPassed,
      sectionAccuracy,
      exactPassed,
      exactAccuracy,
      reportLineages: new Set(rows.map(item => item.lineageId)).size,
      unroutedCount,
    },
    qualificationGates: { minimumSectionAccuracy: 0.98, minimumExactAccuracy: 0.90, maximumUnroutedCount: 0 },
    qualificationDecision,
    rows,
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const execute = args.has('--execute');
  if (execute) {
    try {
      await readFile(path.join(DEFAULT_OUTPUT, 'evaluation.json'), 'utf8');
      throw new Error('Hidden qualification already has a saved result and cannot be rerun.');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const source = JSON.parse(await readFile(
    path.join(HERE, 'evaluator-private-hidden-notes-v9.json'), 'utf8'));
  const lineageReceipt = JSON.parse(await readFile(
    path.join(HERE, 'hidden-lineage-receipt-v9.json'), 'utf8'));
  assert.equal(source.datasetId, DATASET_ID);
  assert.equal(source.datasetSplit, 'hidden_test');
  assert.equal(source.evaluationRole, 'final_hidden_qualification');
  assert.equal(new Set(source.cases.map(item => item.lineageId)).size, 2);
  assert.deepEqual([...new Set(source.cases.map(item => item.lineageId))].sort(),
    lineageReceipt.lineages.map(item => item.assetLineageKey).sort());
  for (const item of source.cases) {
    const lineage = lineageReceipt.lineages.find(entry =>
      entry.assetLineageKey === item.lineageId);
    assert(lineage, `Missing hidden lineage receipt for ${item.caseId}.`);
    assert.equal(item.sourceSha256, lineage.sourceSha256);
    assert.equal(item.sourceReport, lineage.sourceReport);
    assert(!/scope-of-inspection|general-tank-information|inspection-report|repair-recommendations|test-information/i
      .test(item.voiceNote), `Voice note ${item.caseId} exposes a canonical section label.`);
  }

  const fingerprint = buildCandidateFingerprint();
  const atomization = buildAtomization(source.cases);
  const expected = expectedRows(source.cases, atomization);
  assert.equal(expected.length, source.expectedAtomCount);
  assert.equal(atomization.evidenceAtoms.filter(item =>
    item.kind === 'voice_narrative').length, source.expectedAtomCount);
  const preview = requestPreview(atomization, fingerprint);
  const leakage = auditRequestPreview({
    preview,
    candidateFingerprint: fingerprint,
    evaluatorPrivateIdentifiers: source.cases.flatMap(item =>
      [item.caseId, item.sourceReport, item.sourceSha256, item.sourceText]),
  });
  assert.equal(leakage.decision, 'passed', leakage.issues.join(', '));

  await mkdir(DEFAULT_OUTPUT, { recursive: true });
  await writeFile(path.join(DEFAULT_OUTPUT, 'request-preview.json'),
    `${JSON.stringify(preview, null, 2)}\n`);
  await writeFile(path.join(DEFAULT_OUTPUT, 'request-leakage-audit.json'),
    `${JSON.stringify(leakage, null, 2)}\n`);
  await writeFile(path.join(DEFAULT_OUTPUT, 'candidate-fingerprint.json'),
    `${JSON.stringify(fingerprint, null, 2)}\n`);
  await writeFile(path.join(DEFAULT_OUTPUT, 'hidden-lineage-receipt.json'),
    `${JSON.stringify(lineageReceipt, null, 2)}\n`);
  await writeFile(path.join(DEFAULT_OUTPUT, 'atomization.json'),
    `${JSON.stringify(atomization, null, 2)}\n`);

  if (!execute) {
    process.stdout.write(`${JSON.stringify({
      status: 'preview_ready',
      outputDirectory: DEFAULT_OUTPUT,
      requestCount: preview.requests.length,
      voiceNoteCount: source.cases.length,
      evidenceCount: expected.length,
      leakageDecision: leakage.decision,
    }, null, 2)}\n`);
    return;
  }

  process.env.REPORT_PLATFORM_CODEX_MODEL = MODEL_ID;
  const codex = await import('../../../codex-cli.mjs');
  const status = codex.getAiStatus();
  assert.equal(status.configured, true, status.detail);
  let batch = 0;
  const classification = await classifyEvidence({
    atomization,
    modelId: status.modelId,
    batchSize: BATCH_SIZE,
    narrativeWorker: async ({ prompt, schema }) => {
      batch += 1;
      const response = await codex.runStructuredCodexJob({
        prompt, schema, reasoningEffort: 'medium',
      });
      await writeFile(path.join(DEFAULT_OUTPUT,
        `worker-batch-${String(batch).padStart(2, '0')}.json`),
      `${JSON.stringify(response.parsed, null, 2)}\n`);
      process.stdout.write(`${JSON.stringify({
        progress: batch, totalBatches: preview.requests.length,
      })}\n`);
      return response.parsed;
    },
  });
  const guard = guardClassification({ classification });
  assert.equal(guard.decision, 'passed', JSON.stringify(guard.issues));
  const result = evaluate({ expected, classification });
  result.candidateFingerprintSha256 = fingerprint.sha256;
  result.predictionSha256 = sha256(classification.classificationAssignments);
  result.generatedAtIso = new Date().toISOString();
  await writeFile(path.join(DEFAULT_OUTPUT, 'classification.json'),
    `${JSON.stringify(classification, null, 2)}\n`);
  await writeFile(path.join(DEFAULT_OUTPUT, 'classification-guard.json'),
    `${JSON.stringify(guard, null, 2)}\n`);
  await writeFile(path.join(DEFAULT_OUTPUT, 'evaluation.json'),
    `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    status: 'complete',
    outputDirectory: DEFAULT_OUTPUT,
    metrics: result.metrics,
    candidateFingerprintSha256: fingerprint.sha256,
    predictionSha256: result.predictionSha256,
  }, null, 2)}\n`);
}

main().catch(error => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
