import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateHistoricalSource, withHistoricalPatterns, sha, assertCompleteSelectedPlans } from '../experiments/section-kb-ablation.mjs';
import { buildInspectorEvaluationSnapshot } from '../experiments/tk5452-inspector-evaluation.mjs';
const root = fileURLToPath(new URL('../../docs/reviews/data/tk5452-kb-ablation-v1/', import.meta.url));
const read = async name => JSON.parse(await readFile(resolve(root, name), 'utf8'));
const manifest = await read('manifest.json');
for (const [name, hash] of Object.entries(manifest.files)) assert.equal(sha(await readFile(resolve(root, name))), hash);
const { sources, target } = await read('historical-source-audit.json');
sources.forEach(source => validateHistoricalSource(source, target));
for (const change of [
  { dataset_split: 'hidden_test' }, { document_split: 'validation' }, { include_in_retrieval: false },
  { review_status: 'pending_review' }, { lane_code: 'evaluation_gold' }, { approval_status: 'rejected' },
  { source_sha256: target.binary_sha256, binary_sha256: target.binary_sha256 },
  { asset_lineage_key: target.asset_lineage_key }, { issuedOn: '2020-01-01' }, { dateEvidence: 'Unverified date' },
  { content: 'Altered source content' }, { crossSplitHash: true }, { crossSplitLineage: true },
  { tenant_id: 'another-tenant' }, { page_numbers_json: [] },
]) assert.throws(() => validateHistoricalSource({ ...sources[0], ...change }, target));
const snapshot = buildInspectorEvaluationSnapshot(await read('generation-input.json'));
assertCompleteSelectedPlans(snapshot);
const changed = structuredClone(snapshot);
changed.sectionPlans.find(s=>s.sectionId==='01-scope').missingRequirements.push({ reason: 'Missing scope' });
assert.throws(()=>assertCompleteSelectedPlans(changed));
const request = { prompt: 'Current evidence', schema: { type: 'object' } };
assert.deepEqual(withHistoricalPatterns(request, []), request);
const patterns = await read('historical-patterns.json');
const kb = withHistoricalPatterns(request, patterns['01-scope']);
assert.equal(kb.schema, request.schema);
assert(kb.prompt.startsWith(request.prompt));
assert(!/TJS|5452|2016|2017|API 650|patch plate repairs/.test(kb.prompt));
assert.equal(request.prompt, 'Current evidence');
console.log('Section KB ablation audit passed: unchanged inputs, selected-section completeness, identical baseline, approved earlier sources, split/asset/hash isolation, and no foreign facts in style guidance.');
