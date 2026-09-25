import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assessPipelineReadiness } from '../pipeline-readiness.mjs';

const snapshot = {
  observedAt: '2026-09-18T00:00:00.000Z', contracts: { standardizedPair: 12 },
  kb: { crossSplitHashGroups: 0 }, registry: { crossSplitLineages: 0 },
  governedIndex: { reports: 1, sections: 2, invalidSources: 0, excludedSections: 0 },
  pairs: { currentContractRows: 1 }, inspectorRun: { inputReadiness: { status: 'supplied', sectionsWithoutInputs: 0, totalSections: 2 } },
  code: { plannedRouteEvaluationOnly: false }, outlineExposure: { sourceEntries: 166 },
  rewards: { total: 1000, currentContractEligible: 0 },
};
const assess = value => Object.fromEntries(assessPipelineReadiness(value).checks.map(check => [check.id, check.status]));
const initial = structuredClone(snapshot);
assert.equal(assess(snapshot).current_promotion_evidence, 'blocked', 'Large legacy reward counts cannot establish current evidence');
assert.equal(assess(snapshot).generation_serving_parity, 'blocked', 'Absence of one code pattern is not end-to-end parity');
assert.equal(assess(snapshot).independent_holdout, 'blocked', 'Existing split labels cannot erase design exposure');
for (const [name, change] of [
  ['source_split_integrity', value => { value.kb.crossSplitHashGroups = 1; }],
  ['registry_lineage_integrity', value => { value.registry.crossSplitLineages = 1; }],
  ['governed_source_integrity', value => { value.governedIndex.reports = 0; }],
  ['governed_section_eligibility', value => { value.governedIndex.excludedSections = 1; }],
  ['governed_section_eligibility', value => { value.governedIndex.sections = 0; }],
  ['current_native_benchmarks', value => { value.pairs.currentContractRows = 0; }],
  ['mock_input_coverage', value => { value.inspectorRun.inputReadiness.status = 'incomplete'; }],
  ['mock_input_coverage', value => { value.inspectorRun = null; }],
  ['mock_input_coverage', value => { delete value.inspectorRun.inputReadiness; }],
]) {
  const value = structuredClone(snapshot); change(value);
  assert.equal(assess(value)[name], 'blocked', name);
}
assert.deepEqual(snapshot, initial);
assert.equal(assessPipelineReadiness(snapshot).readyForPromotionReview, false);
const script = await readFile(new URL('./review-report-pipeline.mjs', import.meta.url), 'utf8');
assert(script.includes('REPEATABLE READ READ ONLY'));
assert(!script.includes('createPostgresDatabase'), 'Read-only inspection must not run migrations');
assert(!/db\.query\(['"`](?:INSERT|UPDATE|DELETE|CREATE|ALTER)\b/.test(script));
console.log('Pipeline readiness audit passed: empty stores, legacy rewards, split overlap, excluded sections, incomplete inputs and unverified serving parity cannot establish readiness; database inspection stays read-only.');
