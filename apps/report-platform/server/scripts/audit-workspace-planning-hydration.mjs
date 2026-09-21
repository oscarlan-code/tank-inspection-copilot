import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { buildSectionPlanningSnapshot } from '../section-planner.mjs';

// Exercise the actual frontend mapper in Node without a browser or replacement
// fixture mapper. All imported application modules stay in memory.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return { url: candidate.href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.ts')) return {
      format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText,
    };
    return nextLoad(url, context);
  },
});

const { hydrateWorkspaceFromApiState } = await import('../../src/domain/mockReport.ts');
const fixture = JSON.parse(readFileSync(new URL('../../src/fixtures/v3-product-export-shell-internal.json', import.meta.url), 'utf8'));
const common = {
  reportJob: { reportJobId: 'hydration-audit-report', reportReference: 'CURRENT-REPORT', inspectedDate: '2026-09-17', manualInputsRevision: 3 },
  exportPackage: fixture,
  manualSupplement: { engineeringImplication: 'A recorded manual confirmation.', checkedBy: 'Current reviewer' },
  sectionDrafts: [{ sectionId: 'inspection-report', content: '<h2>Saved draft</h2><p>Preserved current wording.</p>', generated: true, edited: true, approved: false, reviewRequired: true, version: 7, updatedAtIso: '2026-09-17T01:00:00Z' }],
};
const originalComplete = hydrateWorkspaceFromApiState(common);
const plannedComplete = hydrateWorkspaceFromApiState({ ...common, sectionPlanning: buildSectionPlanningSnapshot({ exportPackage: fixture }) });
assert.deepEqual(plannedComplete, originalComplete, 'Complete native V10 hydration, manual fields and layouts must remain unchanged');
assert.ok(plannedComplete.report.sections.find((section) => section.id === 'shell-plate-layout').layoutMap);

const incomplete = structuredClone(fixture);
incomplete.layoutTargets = [];
incomplete.layoutConfigs = [];
incomplete.layoutFigures = [];
const originalInput = JSON.stringify(incomplete);
assert.throws(() => hydrateWorkspaceFromApiState({ ...common, exportPackage: incomplete }), /shell layout/, 'Unplanned fixture path still applies its strict preview validation');
const sectionPlanning = buildSectionPlanningSnapshot({ exportPackage: incomplete });
const review = hydrateWorkspaceFromApiState({ ...common, exportPackage: incomplete, sectionPlanning });
assert.equal(JSON.stringify(incomplete), originalInput, 'Review hydration must not modify imported source records');
assert.equal(review.report.id, common.reportJob.reportJobId);
assert.equal(review.report.reference, 'CURRENT-REPORT');
assert.equal(review.report.inspectedDate, '2026-09-17');
assert.equal(review.report.manualInputsRevision, 3);
assert.equal(review.report.sections.length, 33, 'Cover plus all 32 backend-review sections remain navigable');
assert.ok(review.report.sections.every((section) => !section.layoutMap), 'Missing layout must not be replaced by a V10 shell grid');
assert.ok(review.baselineReport.sections.every((section) => !section.generated && section.content === ''), 'Review baseline must contain no pregenerated fixture prose');
const saved = review.report.sections.find((section) => section.id === 'inspection-report');
assert.equal(saved.content, common.sectionDrafts[0].content);
assert.equal(saved.version, 7);
assert.equal(saved.edited, true);
assert.ok(saved.rawAppData.includes('Needs review:'), 'Backend planning issues are visible from the review workspace');
assert.ok(review.report.sections.find((section) => section.id === 'cover').rawAppData.includes('A recorded manual confirmation.'));
assert.ok(review.report.importSummary.validationResults.some((result) => result.ruleCode === 'import_requires_section_review' && result.blocksExport));

const savedLayout = originalComplete.report.sections.find((section) => section.id === 'shell-plate-layout').layoutMap;
const withOverride = hydrateWorkspaceFromApiState({ ...common, exportPackage: incomplete, sectionPlanning, layoutOverrides: [{ sectionId: 'shell-plate-layout', layoutMap: savedLayout, version: 4, updatedAtIso: '2026-09-17T02:00:00Z' }] });
assert.equal(withOverride.report.sections.find((section) => section.id === 'shell-plate-layout').layoutVersion, 4, 'Existing saved report-side overrides retain their version');
assert.ok(withOverride.report.sections.find((section) => section.id === 'shell-plate-layout').layoutMap, 'Persisted actual override remains available without fabricating a replacement');
console.log('Workspace planning hydration audit passed: incomplete API imports remain reviewable, no replacement geometry or prose, saved state retained, complete native hydration unchanged.');
