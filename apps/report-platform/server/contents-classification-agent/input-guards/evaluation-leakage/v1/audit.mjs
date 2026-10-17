import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const readJson = async (name) => JSON.parse(await readFile(path.join(HERE, name), 'utf8'));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const [policy, manifest, schema] = await Promise.all([
  readJson('policy.json'), readJson('manifest.json'), readJson('runtime-output-schema.json')
]);
const outlinePath = path.resolve(HERE, policy.outlineProfile.path);
assert.equal(sha256(await readFile(outlinePath)), policy.outlineProfile.sha256);
const outline = JSON.parse(await readFile(outlinePath, 'utf8'));
assert.equal(outline.profileId, policy.outlineProfile.profileId);
assert.equal(outline.status, 'frozen_for_r_and_d_evaluation');
assert.equal(outline.productEnabled, false);
assert.equal(policy.productEnabled, false);
assert(policy.nativeTopLevelAllowlist.includes('voiceNotes'));
assert(policy.nativeTopLevelAllowlist.includes('utMeasurements'));
assert(!policy.nativeTopLevelAllowlist.includes('captureScenarioProvenance'));
assert(policy.nativeTaxonomyFieldsAllowed.includes('inspectionChecklistItems[].sectionKey'));
assert(policy.forbiddenExportKeyNames.includes('targetReportSectionId'));
assert.equal(policy.minimumExactSourceSequenceWords, 8);
assert.equal(policy.blockingExactSourceSequenceWords, 16);
assert(policy.blockingExactSourceSequenceWords > policy.minimumExactSourceSequenceWords);
assert.equal(schema.properties.lineageToken.pattern, '^eval_ln_[a-f0-9]{64}$');
for (const item of manifest.files) {
  assert.equal(sha256(await readFile(path.join(HERE, item.path))), item.sha256,
    `Manifest hash mismatch for ${item.path}`);
}
const bundle = manifest.files.map((item) => `${item.path}:${item.sha256}\n`).join('');
assert.equal(sha256(bundle), manifest.bundleSha256);
assert.equal(manifest.productEnabled, false);
console.log(JSON.stringify({
  passed: true,
  guardId: manifest.guardId,
  nativeTopLevelFields: policy.nativeTopLevelAllowlist.length,
  forbiddenExportKeys: policy.forbiddenExportKeyNames.length,
  productEnabled: false,
}, null, 2));
