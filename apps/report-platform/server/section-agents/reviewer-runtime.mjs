import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export async function verifyFrozenSectionReviewer({ rootUrl, manifestSha256 }) {
  const bytes = await readFile(new URL('manifest.json', rootUrl));
  if (sha256(bytes) !== manifestSha256) throw new Error('Frozen section-review manifest has changed. Create a new release.');
  const manifest = JSON.parse(bytes);
  if (manifest.contractVersion !== 'section_review_agent_release_v1'
      || manifest.productionEnabled !== false
      || manifest.executionModes.length !== 1
      || manifest.executionModes[0] !== 'evaluation') {
    throw new Error('Unsupported section-review release contract.');
  }
  for (const [path, expected] of Object.entries(manifest.files)) {
    if (!/^[a-zA-Z0-9_./-]+$/.test(path) || path.startsWith('/') || path.split('/').includes('..')) {
      throw new Error('Invalid frozen section-review path.');
    }
    if (sha256(await readFile(new URL(path, rootUrl))) !== expected) {
      throw new Error(`Frozen section-review file has changed: ${path}. Create a new release.`);
    }
  }
  for (const path of [manifest.reviewerInstructions, manifest.reviewerSpec, manifest.knowledgeReviewPolicy,
    manifest.harness, manifest.entryPoint]) {
    if (!path || !manifest.files[path]) throw new Error('Section-review release controls must be hash-pinned.');
  }
  return deepFreeze({ manifest });
}
