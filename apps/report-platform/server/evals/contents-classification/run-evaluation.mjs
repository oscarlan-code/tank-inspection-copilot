import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { guardEvaluationInput, __test as leakageTest } from '../../contents-classification-agent/input-guards/evaluation-leakage/v1/guard.mjs';
import { atomizeEvidence } from '../../contents-classification-agent/atomizers/evidence-atomizer/v1/atomizer.mjs';
import { classifyEvidence, narrativeOutputSchema, narrativePrompt } from '../../contents-classification-agent/sandbox/candidates/contents-classification-v2/runtime.mjs';
import { buildCandidateFingerprint } from '../../contents-classification-agent/sandbox/candidates/contents-classification-v2/candidate-fingerprint.mjs';
import { guardClassification } from '../../contents-classification-agent/sandbox/candidates/contents-classification-v2/classification-guard.mjs';
import { buildAtomGold } from './atom-gold-builder.mjs';
import { evaluateClassification } from './evaluator.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, '../../..');
const DEFAULT_OUTPUT = path.join(APP_ROOT, '.local', 'contents-classification-eval', 'current');
const MODEL_ID = 'gpt-5.6-sol';
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const save = async (file, value) => { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, `${JSON.stringify(value, null, 2)}\n`); };
const sha256 = (value) => createHash('sha256').update(Buffer.isBuffer(value) ? value : typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

function args(values) {
  const result = { live: false, variant: 'natural-field-speech' };
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === '--live') result.live = true;
    else if (values[index].startsWith('--')) result[values[index].slice(2)] = values[index + 1];
  }
  return result;
}

async function loadBlocks(file) {
  return (await readFile(file, 'utf8')).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function main() {
  const options = args(process.argv.slice(2));
  const config = options['case-root'] ? null : await readJson(path.join(APP_ROOT, '.local', 'mock-eval', 'current-case.json'));
  const caseRoot = path.resolve(options['case-root'] ?? config.caseRoot);
  const runRoot = path.join(caseRoot, 'review', 'mock-preparation-full-case-v1');
  const exportRoot = path.join(runRoot, 'android-cases', options.variant, 'exports', 'concise-field');
  const outputRoot = path.resolve(options.output ?? DEFAULT_OUTPUT);
  const [exportBytes, receipt, gold, fullReportEvaluation, semanticPairs, sourceBlocks, caseInfo, acceptedDataset, atomicFactLedger] = await Promise.all([
    readFile(path.join(exportRoot, 'v3-product-export.json')),
    readJson(path.join(exportRoot, 'android-export-receipt.json')),
    readJson(path.join(caseRoot, 'review', 'mock-preparation-gold-review.json')),
    readJson(path.join(runRoot, 'full-report-evaluation.json')),
    readJson(path.join(caseRoot, 'semantic-pairs.json')),
    loadBlocks(path.join(caseRoot, 'source-blocks.jsonl')),
    readJson(path.join(caseRoot, 'case.json')),
    readJson(path.join(runRoot, 'datasets', options.variant, 'accepted.json')),
    readJson(path.join(runRoot, 'atomic-fact-ledger.json')),
  ]);
  const exportPackage = JSON.parse(exportBytes);
  const referenceTextUnits = gold.facts.map((item) => ({ unitId: item.factId, text: item.sourceText }));
  const lineageSecret = process.env.REPORT_PLATFORM_EVALUATION_LINEAGE_SECRET;
  assert(typeof lineageSecret === 'string' && lineageSecret.length >= 32,
    'REPORT_PLATFORM_EVALUATION_LINEAGE_SECRET must contain at least 32 characters.');
  const leakage = guardEvaluationInput({ exportPackage, androidReceipt: receipt, lineageSecret,
    rawExportSha256: leakageTest.sha256(exportBytes), rawExportByteSize: exportBytes.byteLength, referenceTextUnits });
  assert.equal(leakage.decision, 'passed', `Input leakage guard blocked ${leakage.evaluatorCrosswalk.blockingIssues.length} issue(s).`);
  const atomization = atomizeEvidence({ sealedInput: leakage.sealedInput });
  const outline = await readJson(path.join(APP_ROOT, 'server', 'contents-classification-agent', 'outline-profiles', 'vertical-api653-v1', 'outline-profile.json'));
  const candidateFingerprint = buildCandidateFingerprint();
  const narrativeAtoms = atomization.evidenceAtoms.filter((item) => item.kind === 'voice_narrative');
  const batches = [];
  for (let index = 0; index < narrativeAtoms.length; index += 20) batches.push(narrativeAtoms.slice(index, index + 20));
  const preview = { evaluationOnly: true, sent: false, externalDestination: 'configured Codex/OpenAI classification worker',
    modelId: MODEL_ID, caseId: semanticPairs.caseId, variantId: options.variant,
    goldIncluded: false, evaluatorCrosswalkIncluded: false, originalReportIncluded: false,
    runtimeInputs: ['sealed Android evidence atoms', 'reviewed 25-section outline profile'],
    batchCount: batches.length, atomCount: atomization.evidenceAtoms.length, narrativeAtomCount: narrativeAtoms.length,
    outlineProfileId: outline.profileId, classifierCandidateId: 'contents-classification-v2', promptVersion: 'classification_prompt_v2',
    candidateFingerprintSha256: candidateFingerprint.sha256,
    requests: batches.map((batch, index) => ({ batchNumber: index + 1,
      prompt: narrativePrompt(batch), schema: narrativeOutputSchema(batch.map((item) => item.evidenceId)) })) };
  await Promise.all([
    save(path.join(outputRoot, 'request-preview.json'), preview),
    save(path.join(outputRoot, 'runtime', 'leakage-receipt.json'), leakage.runtimeReceipt),
    save(path.join(outputRoot, 'runtime', 'sealed-classification-input.json'), leakage.sealedInput),
    save(path.join(outputRoot, 'runtime', 'atomization.json'), atomization),
    save(path.join(outputRoot, 'evaluator-private', 'lineage-crosswalk.json'), leakage.evaluatorCrosswalk),
    save(path.join(outputRoot, 'progress.json'), { status: options.live ? 'classifying' : 'prepared', completedBatches: 0,
      totalBatches: batches.length, atomCount: atomization.evidenceAtoms.length, narrativeAtomCount: narrativeAtoms.length }),
  ]);
  let worker = null;
  let modelId = null;
  if (options.live) {
    process.env.REPORT_PLATFORM_CODEX_MODEL = MODEL_ID;
    const codex = await import('../../codex-cli.mjs');
    const status = codex.getAiStatus();
    assert(status.configured, status.detail);
    modelId = status.modelId;
    worker = async ({ batchNumber, prompt, schema }) => {
      const requestSha256 = sha256({ prompt, schema, modelId });
      const cachePath = path.join(outputRoot, 'worker', `batch-${String(batchNumber).padStart(2, '0')}.json`);
      let cached = null;
      try { cached = await readJson(cachePath); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
      if (cached?.requestSha256 === requestSha256) return cached.response;
      let response = null;
      let validationError = null;
      const expectedIds = new Set(batches[batchNumber - 1].map((item) => item.evidenceId));
      const outlineSections = new Map(outline.sections.map((section) => [section.sectionId, new Set(section.blocks)]));
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const correction = validationError
          ? `\n\nYour previous response was rejected by the structural guard: ${validationError}. Return one valid classification for every supplied evidenceId.`
          : '';
        response = await codex.runStructuredCodexJob({ prompt: `${prompt}${correction}`, schema, reasoningEffort: 'medium' });
        try {
          const returnedIds = response.parsed.classifications.map((item) => item.evidenceId);
          assert.equal(returnedIds.length, expectedIds.size, 'wrong classification count');
          assert.equal(new Set(returnedIds).size, expectedIds.size, 'duplicate evidenceId');
          assert(returnedIds.every((id) => expectedIds.has(id)), 'unknown or missing evidenceId');
          for (const item of response.parsed.classifications) {
            assert.equal(item.decisionState, 'needs_review', 'model proposal was self-approved');
            for (const use of item.uses) {
              assert(outlineSections.get(use.sectionId)?.has(use.blockId),
                `block ${use.blockId} does not belong to ${use.sectionId}`);
            }
          }
          validationError = null;
          break;
        } catch (error) {
          validationError = error.message;
        }
      }
      assert.equal(validationError, null, `Narrative batch ${batchNumber} failed structural validation: ${validationError}`);
      await save(cachePath, { requestSha256, modelId: response.aiStatus.modelId, response: response.parsed });
      await save(path.join(outputRoot, 'progress.json'), { status: 'classifying', completedBatches: batchNumber,
        totalBatches: batches.length, atomCount: atomization.evidenceAtoms.length, narrativeAtomCount: narrativeAtoms.length });
      return response.parsed;
    };
  }
  const classification = await classifyEvidence({ atomization, narrativeWorker: worker, modelId });
  const classificationGuard = guardClassification({ classification });
  assert.equal(classificationGuard.decision, 'passed', `Classification guard blocked ${classificationGuard.issues.length} issue(s).`);
  const sealedClassification = classificationGuard.sealedClassification;
  assert(sealedClassification, 'Classification output must be sealed before evaluator-private gold is opened.');
  const atomGold = buildAtomGold({ atomization: {
    contractVersion: atomization.contractVersion,
    inputPackageHash: sealedClassification.inputPackageHash,
    evidenceAtoms: sealedClassification.evidenceAtoms,
  }, rawExport: exportPackage, fullReportEvaluation, semanticPairs,
  sourceBlocks, acceptedDataset, atomicFactLedger, variantId: options.variant });
  const evaluation = evaluateClassification({ classification: sealedClassification, guardResult: classificationGuard, rawExport: exportPackage,
    atomGold, variantId: options.variant });
  const result = { ...evaluation, runId: `classification-${options.variant}-v2`, generatedAtIso: new Date().toISOString(),
    runMode: options.live ? 'live' : 'preflight',
    classifier: { candidateId: sealedClassification.candidateId, modelId,
      promptVersion: sealedClassification.classificationManifest.promptVersion,
      candidateFingerprintSha256: candidateFingerprint.sha256 },
    report: { label: caseInfo.source?.sourcePath?.split('/').at(-1) ?? semanticPairs.caseId,
      reportReference: exportPackage.inspectionRecord?.generalTankInformation?.jobNo ?? '',
      tankNumber: exportPackage.inspectionRecord?.generalTankInformation?.tankNumber ?? '',
      variantId: options.variant },
    runtime: { leakageChecks: leakage.runtimeReceipt.checks, atomizationManifest: atomization.manifest,
      classificationManifest: classification.classificationManifest, classificationGuard: {
        decision: classificationGuard.decision, issueCount: classificationGuard.issues.length,
        sectionPackageEligibleAtomCount: classificationGuard.sectionPackageEligibleAtomCount,
        humanReviewRequiredAtomCount: classificationGuard.humanReviewRequiredAtomCount,
        notRunAtomCount: classificationGuard.notRunAtomCount } } };
  await Promise.all([
    save(path.join(outputRoot, 'runtime', 'classification.json'), classification),
    save(path.join(outputRoot, 'runtime', 'classification-guard.json'), classificationGuard),
    save(path.join(outputRoot, 'evaluator-private', 'atom-gold.json'), atomGold),
    save(path.join(outputRoot, 'evaluation.json'), result),
    save(path.join(outputRoot, 'progress.json'), { status: options.live ? 'complete' : 'prepared', completedBatches: options.live ? batches.length : 0,
      totalBatches: batches.length, atomCount: atomization.evidenceAtoms.length, narrativeAtomCount: narrativeAtoms.length }),
    save(path.join(outputRoot, 'request-preview.json'), { ...preview, sent: options.live, completedAtIso: new Date().toISOString() }),
  ]);
  console.log(JSON.stringify({ prepared: true, live: options.live, outputRoot, report: result.report,
    summary: result.summary, atomKinds: result.byEvidenceType }, null, 2));
}

main().catch(async (error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});

