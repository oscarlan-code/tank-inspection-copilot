import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, '../../../../..');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const COMPONENT_PATHS = [
  path.join(HERE, 'candidate-fingerprint.mjs'),
  path.join(HERE, 'runtime.mjs'),
  path.join(HERE, 'classification-guard.mjs'),
  path.join(HERE, 'classifier-prompt.md'),
  path.join(HERE, 'agent-spec.json'),
  path.join(HERE, 'harness.json'),
  path.join(HERE, 'kb-policy.json'),
  path.join(HERE, 'output-schema.json'),
  path.join(HERE, 'pipeline-contract.json'),
  path.resolve(HERE, '../../../outline-profiles/vertical-api653-v3/outline-profile.json'),
  path.resolve(HERE, '../../../outline-profiles/vertical-api653-v3/outline-manifest.json'),
  path.resolve(HERE, '../../../atomizers/evidence-atomizer/v1/atomizer.mjs'),
  path.resolve(HERE, '../../../input-guards/evaluation-leakage/v1/guard.mjs'),
  path.resolve(HERE, '../../../input-guards/evaluation-leakage/v1/policy.json'),
];

const canonical = (value) => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);

export function buildCandidateFingerprint() {
  const components = COMPONENT_PATHS.map((file) => ({
    path: path.relative(APP_ROOT, file),
    sha256: sha256(readFileSync(file)),
  }));
  return {
    contractVersion: 'contents_classification_candidate_fingerprint_v1',
    candidateId: 'contents-classification-v4',
    promptVersion: 'classification_prompt_v4',
    components,
    sha256: sha256(canonical(components)),
  };
}

