import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runPreflight } from './full-test-preflight.mjs';

const save = (path, value) => writeFile(path, typeof value === 'string' ? value : `${JSON.stringify(value)}\n`);

test('full-test preflight fails closed until every required case artifact exists', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mock-full-preflight-'));
  const caseRoot = join(root, 'case-01');
  await import('node:fs/promises').then(({ mkdir }) => mkdir(caseRoot));
  const cohortPath = join(root, 'cohort.json');
  await save(cohortPath, { cohortId: 'test', reports: [{ caseId: 'case-01', sourceDatasetSplit: 'validation', sourcePath: 'report.pdf' }] });
  await save(join(caseRoot, 'case.json'), {});
  const result = await runPreflight({ corpusRoot: root, cohortPath, split: 'validation' });
  assert.equal(result.decision, 'blocked');
  assert(result.cases[0].blockers.includes('missing:semantic-pairs.json'));
  assert(result.cases[0].blockers.includes('missing:reviewed-case-plan.json'));
});

test('full-test preflight accepts a complete atomic case', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mock-full-preflight-'));
  const caseRoot = join(root, 'case-01');
  await import('node:fs/promises').then(({ mkdir }) => mkdir(caseRoot));
  const cohortPath = join(root, 'cohort.json');
  await save(cohortPath, { cohortId: 'test', reports: [{ caseId: 'case-01', sourceDatasetSplit: 'validation', sourcePath: 'report.pdf' }] });
  await save(join(caseRoot, 'case.json'), {});
  await save(join(caseRoot, 'source-receipt.json'), {});
  await save(join(caseRoot, 'source-blocks.jsonl'), '{}\n');
  await save(join(caseRoot, 'checklist-extraction.json'), {
    summary: { unresolvedCount: 0 },
    items: Array.from({ length: 195 }, (_, index) => ({ itemNumber: index + 1, status: 'extracted' }))
  });
  await save(join(caseRoot, 'semantic-pairs.json'), { status: 'human_approved', semanticUnits: [{ sourceUnitId: 'u1', unitType: 'observation', appCapability: 'capturable', evaluationMode: 'semantic' }] });
  await save(join(caseRoot, 'reviewed-case-plan.json'), { voiceNotes: [{ noteId: 'obs-01' }] });
  await save(join(caseRoot, 'freeze-manifest.json'), { status: 'frozen' });
  const result = await runPreflight({ corpusRoot: root, cohortPath, split: 'validation' });
  assert.equal(result.decision, 'ready');
  assert.equal(result.readyCaseCount, 1);
  assert.equal(result.cases[0].narrativeUnitCount, 1);
});
