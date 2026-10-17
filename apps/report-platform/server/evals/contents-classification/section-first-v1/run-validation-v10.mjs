import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomizeEvidence } from '../../../contents-classification-agent/atomizers/evidence-atomizer/v5/atomizer.mjs';
import { classifyEvidence, narrativeOutputSchema, narrativePrompt } from '../../../contents-classification-agent/sandbox/candidates/contents-classification-v10/runtime.mjs';
import { guardClassification } from '../../../contents-classification-agent/sandbox/candidates/contents-classification-v10/classification-guard.mjs';
import { buildCandidateFingerprint } from '../../../contents-classification-agent/sandbox/candidates/contents-classification-v10/candidate-fingerprint.mjs';
import { auditRequestPreview } from '../robustness.mjs';
import { evaluateSectionFirst } from './evaluator.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPORT_PLATFORM_ROOT = path.resolve(HERE, '../../../..');
const DEFAULT_OUTPUT = path.join(REPORT_PLATFORM_ROOT, '.local/contents-classification-eval/section-first/contents-classification-v10/validation-context-20');
const MODEL_ID = 'gpt-5.6-sol';
const BATCH_SIZE = 10;
const DATASET_ID = 'classification-v10-validation-context-20';
const CRITICAL_SECTIONS = ["general-tank-information","scope-of-inspection","repair-recommendations","roof-plate-thickness-measurements","roof-nozzle-reinforcement-pad-thickness-measurements","shell-plate-thickness-measurements","shell-nozzle-reinforcement-pad-thickness-measurements","shell-settlement","minimum-shell-thickness-calculations","corrosion-rate-and-remaining-life-assessment"];
const canonicalize = value => Array.isArray(value) ? value.map(canonicalize) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])])) : value;
const sha256 = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(canonicalize(value))).digest('hex');

function buildAtomization(cases) {
  const exportPackage = { packageType: 'v3_product_export', schemaVersion: 3, inspectionReference: 'opaque-independent-validation-run',
    unitProfile: { thicknessUnit: 'mm' }, inspectionRecord: { generalTankInformation: {} },
    voiceNotes: cases.map((item, index) => ({ voiceNoteId: `validation-note-${String(index + 1).padStart(3, '0')}`, screenKey: 'findings', fieldKey: 'voice_note', transcriptText: item.voiceNote })) };
  const sealedInput = { contractVersion: 'sealed_classification_input_v1', guardId: 'evaluation-input-leakage-guard-v1',
    inputPackageHash: sha256(exportPackage), lineageToken: `eval_ln_${sha256({ dataset: DATASET_ID, exportPackage })}`, exportPackage };
  return atomizeEvidence({ sealedInput });
}

function expectedRows(cases, atomization) {
  const atoms = atomization.evidenceAtoms.filter(item => item.kind === 'voice_narrative');
  return cases.flatMap((item, noteIndex) => item.expectedAtoms.map((expected, atomIndex) => {
    const sourcePointer = `/voiceNotes/${noteIndex}/transcriptText`;
    const matches = atoms.filter(atom => atom.sourcePointer === sourcePointer && atom.originalValue === expected.text);
    assert.equal(matches.length, 1, `Expected one atom for ${item.caseId}[${atomIndex}].`);
    return { caseId: item.caseId, atomIndex, evidenceId: matches[0].evidenceId, classifierInput: matches[0].originalValue, expectedUse: expected.expectedUse };
  }));
}

function requestPreview(atomization, fingerprint) {
  const voiceAtoms = atomization.evidenceAtoms.filter(item => item.kind === 'voice_narrative');
  const requests = [];
  for (let index = 0; index < voiceAtoms.length; index += BATCH_SIZE) {
    const atoms = voiceAtoms.slice(index, index + BATCH_SIZE);
    requests.push({ batchNumber: requests.length + 1, modelId: MODEL_ID, reasoningEffort: 'medium', evidenceCount: atoms.length,
      prompt: narrativePrompt(atoms), schema: narrativeOutputSchema(atoms.map(item => item.evidenceId)) });
  }
  return { contractVersion: 'contents_classification_request_preview_v1', evaluationOnly: true,
    classifierCandidateId: fingerprint.candidateId, candidateFingerprintSha256: fingerprint.sha256, atomizerId: atomization.atomizerId,
    goldIncluded: false, evaluatorCrosswalkIncluded: false, originalReportIncluded: false, requests };
}

async function main() {
  const execute = new Set(process.argv.slice(2)).has('--execute');
  if (execute) { try { await readFile(path.join(DEFAULT_OUTPUT, 'evaluation.json'), 'utf8'); throw new Error('Validation result already exists for this frozen candidate.'); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  const source = JSON.parse(await readFile(path.join(HERE, 'evaluator-private-validation-context-v10.json'), 'utf8'));
  assert.equal(source.datasetId, DATASET_ID);
  assert.equal(source.datasetSplit, 'validation');
  const receipt = JSON.parse(await readFile(path.join(HERE, 'validation-lineage-receipt-v10.json'), 'utf8'));
  assert.equal(receipt.datasetSplit, 'validation');
  assert.deepEqual([...new Set(source.cases.map(item => item.lineageId))].sort(), receipt.lineages.map(item => item.assetLineageKey).sort());
  for (const item of source.cases) { const lineage = receipt.lineages.find(entry => entry.assetLineageKey === item.lineageId); assert(lineage); assert.equal(item.sourceReport, lineage.sourceReport); assert.equal(item.sourceSha256, lineage.sourceSha256); }
  const fingerprint = buildCandidateFingerprint();
  const atomization = buildAtomization(source.cases);
  const expected = expectedRows(source.cases, atomization);
  assert.equal(expected.length, source.expectedAtomCount);
  assert.equal(atomization.evidenceAtoms.filter(item => item.kind === 'voice_narrative').length, source.expectedAtomCount);
  const preview = requestPreview(atomization, fingerprint);
  const leakage = auditRequestPreview({ preview, candidateFingerprint: fingerprint,
    evaluatorPrivateIdentifiers: source.cases.flatMap(item => [item.caseId, item.sourceReport, item.sourceSha256, item.sourceText]) });
  assert.equal(leakage.decision, 'passed', leakage.issues.join(', '));
  await mkdir(DEFAULT_OUTPUT, { recursive: true });
  for (const [name, value] of [['request-preview.json', preview], ['request-leakage-audit.json', leakage], ['candidate-fingerprint.json', fingerprint], ['validation-lineage-receipt.json', receipt], ['atomization.json', atomization]])
    await writeFile(path.join(DEFAULT_OUTPUT, name), `${JSON.stringify(value, null, 2)}\n`);
  if (!execute) { console.log(JSON.stringify({ status: 'preview_ready', outputDirectory: DEFAULT_OUTPUT, requestCount: preview.requests.length, evidenceCount: expected.length, leakageDecision: leakage.decision }, null, 2)); return; }
  process.env.REPORT_PLATFORM_CODEX_MODEL = MODEL_ID;
  const codex = await import('../../../codex-cli.mjs');
  const status = codex.getAiStatus();
  assert.equal(status.configured, true, status.detail);
  let batch = 0;
  const classification = await classifyEvidence({ atomization, modelId: status.modelId, batchSize: BATCH_SIZE, narrativeWorker: async ({ prompt, schema }) => {
    batch += 1;
    const response = await codex.runStructuredCodexJob({ prompt, schema, reasoningEffort: 'medium' });
    await writeFile(path.join(DEFAULT_OUTPUT, `worker-batch-${String(batch).padStart(2, '0')}.json`), `${JSON.stringify(response.parsed, null, 2)}\n`);
    console.log(JSON.stringify({ progress: batch, totalBatches: preview.requests.length }));
    return response.parsed;
  } });
  const guard = guardClassification({ classification });
  assert.equal(guard.decision, 'passed', JSON.stringify(guard.issues));
  const byEvidence = new Map(classification.classificationAssignments.map(item => [item.evidenceId, item]));
  const scoredRows = expected.map(item => { const assignment = byEvidence.get(item.evidenceId); return { ...item,
    predictedSectionId: assignment.sectionDecision.sectionId, predictedBlockId: assignment.blockDecision.blockId, feedback: assignment.feedback }; });
  const evaluation = evaluateSectionFirst({ rows: scoredRows, criticalSectionIds: CRITICAL_SECTIONS });
  evaluation.matrixDecision = evaluation.decision;
  evaluation.decision = evaluation.matrixDecision === 'matrix_gate_passed' ? 'validation_gate_passed' : 'validation_gate_failed';
  evaluation.qualificationStatus = 'not_assessed_requires_untouched_hidden_test';
  evaluation.datasetId = DATASET_ID; evaluation.evaluationRole = source.evaluationRole; evaluation.classifierCandidateId = classification.candidateId;
  evaluation.candidateFingerprintSha256 = fingerprint.sha256; evaluation.predictionSha256 = sha256(classification.classificationAssignments);
  evaluation.rows = scoredRows; evaluation.generatedAtIso = new Date().toISOString();
  for (const [name, value] of [['classification.json', classification], ['classification-guard.json', guard], ['evaluation.json', evaluation]])
    await writeFile(path.join(DEFAULT_OUTPUT, name), `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify({ status: 'complete', outputDirectory: DEFAULT_OUTPUT, decision: evaluation.decision, metrics: evaluation.metrics, candidateFingerprintSha256: fingerprint.sha256, predictionSha256: evaluation.predictionSha256 }, null, 2));
}
main().catch(error => { console.error(error.stack ?? error.message); process.exitCode = 1; });
