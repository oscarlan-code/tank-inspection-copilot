import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCandidateFingerprint } from '../../contents-classification-agent/releases/evaluation/v1/candidate-fingerprint.mjs';
import { assertIndependentLineage, auditRequestPreview, datasetRole } from './robustness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, '../../..');
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

function args(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    if (values[index].startsWith('--')) result[values[index].slice(2)] = values[index + 1];
  }
  return result;
}

const options = args(process.argv.slice(2));
assert(options['development-case-root'], '--development-case-root is required.');
assert(options['evaluation-case-root'], '--evaluation-case-root is required.');
const runRoot = path.resolve(options['run-root'] ?? path.join(APP_ROOT, '.local', 'contents-classification-eval', 'current'));
const [developmentCase, evaluationCase, preview] = await Promise.all([
  readJson(path.join(path.resolve(options['development-case-root']), 'case.json')),
  readJson(path.join(path.resolve(options['evaluation-case-root']), 'case.json')),
  readJson(path.join(runRoot, 'request-preview.json')),
]);
const fingerprint = buildCandidateFingerprint();
const lineage = assertIndependentLineage({ developmentCases: [developmentCase], evaluationCase });
const identifiers = [evaluationCase.caseId, evaluationCase.source?.documentId,
  evaluationCase.source?.sourceSha256, evaluationCase.source?.assetLineageKey,
  evaluationCase.source?.sourcePath];
const requestAudit = auditRequestPreview({ preview, candidateFingerprint: fingerprint,
  evaluatorPrivateIdentifiers: identifiers });
assert.equal(requestAudit.decision, 'passed', `Request leakage audit blocked: ${requestAudit.issues.join(', ')}.`);
const result = {
  contractVersion: 'contents_classification_robustness_preflight_v1',
  decision: 'passed',
  datasetRole: datasetRole(evaluationCase),
  promptFrozenForThisCohort: true,
  eligibleForPromptTuning: false,
  candidateFingerprint: fingerprint,
  lineage,
  requestAudit,
  limits: evaluationCase.source?.sourceDatasetSplit === 'validation' ? [] : [
    'This report is an independent lineage but belongs to the training corpus, so it is not formal held-out validation.',
  ],
};
await writeFile(path.join(runRoot, 'robustness-preflight.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));

