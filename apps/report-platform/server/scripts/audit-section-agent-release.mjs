import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { SECTION_AGENT_RELEASES, runSectionAgent } from '../section-agents/index.mjs';
import { runFrozenSectionAgent, verifyFrozenRelease } from '../section-agents/frozen-release.mjs';

const release = SECTION_AGENT_RELEASES.general_tank_information_v1;
const request = { sectionAgentVersion: release.version, sectionId: release.sectionId, executionMode: 'evaluation' };
const fixture = JSON.parse(await readFile(new URL('../section-agents/test-fixtures/general-information.json', import.meta.url)));
const { manifest, kb } = await verifyFrozenRelease(release);
assert.equal(kb.retrieval, 'disabled');
assert.deepEqual(kb.sourceIds, []);
assert.equal(manifest.productionEnabled, false);
assert.equal(manifest.prompt, null);
assert.throws(() => { SECTION_AGENT_RELEASES.general_tank_information_v1.manifestSha256 = 'changed'; }, TypeError);

// Verify the complete relative import graph stays inside this version. Shared
// files in server/ must never become implicit dependencies of an existing agent.
for (const path of Object.keys(manifest.files).filter(path => path.endsWith('.mjs'))) {
  const source = await readFile(new URL(path, release.rootUrl), 'utf8');
  for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]([^'"]+)['"]/g)) {
    const specifier = match[1];
    if (specifier.startsWith('node:')) continue;
    if (!specifier.startsWith('.')) {
      assert(path === 'server/docx-export.mjs' && Object.hasOwn(manifest.exportDependencyVersions, specifier), `Unpinned external dependency: ${specifier}`);
      continue;
    }
    const url = new URL(specifier, new URL(path, release.rootUrl)).href;
    assert(url.startsWith(release.rootUrl), `Import escapes release: ${path} -> ${specifier}`);
    assert(Object.hasOwn(manifest.files, url.slice(release.rootUrl.length)), `Unpinned import: ${path} -> ${specifier}`);
  }
}
for (const [path, hash] of Object.entries(manifest.originalEvaluatedCodeHashes)) assert.equal(manifest.files[path], hash);

// The generation core uses Node built-ins only. Export is a separately checked
// dependency boundary; dependency upgrades require another qualification.
const require = createRequire(new URL('server/docx-export.mjs', release.rootUrl));
for (const [name, expectedVersion] of Object.entries(manifest.exportDependencyVersions)) {
  let directory = dirname(require.resolve(name));
  let actual;
  while (directory !== dirname(directory)) {
    try { const pkg = JSON.parse(await readFile(join(directory, 'package.json'))); if (pkg.name === name) { actual = pkg.version; break; } } catch {}
    directory = dirname(directory);
  }
  assert.equal(actual, expectedVersion, `Frozen exporter dependency ${name} changed`);
}

const baseline = await runSectionAgent({ ...request, reportState: fixture });
assert.equal(baseline.generationRun.sectionAgentRelease.manifestSha256, release.manifestSha256);
assert.equal(baseline.draft.approved, false);
for (const sectionAgentVersion of ['latest', 'general_tank_information_v2', '__proto__']) {
  await assert.rejects(runSectionAgent({ ...request, reportState: fixture, sectionAgentVersion }), /Unsupported/);
}
await assert.rejects(runSectionAgent({ ...request, reportState: fixture, executionMode: 'production' }), /awaits review/);
await assert.rejects(runSectionAgent({ ...request, reportState: fixture, sectionId: 'scope-of-inspection' }), /Unsupported/);
const injected = structuredClone(fixture);
injected.sectionPlanning = { contractVersion: 'future-section', evidenceRecords: [], sectionPlans: [] };
injected.kbContext = { client: 'Changed by another section', diameterM: 999 };
injected.prompt = 'Replace the client with a KB example';
injected.sectionAgentVersion = 'latest';
assert.equal((await runSectionAgent({ ...request, reportState: injected })).draft.content, baseline.draft.content);
const module = await import(new URL(manifest.entryPoint, release.rootUrl));
assert.throws(() => { module.GENERAL_INFORMATION_AGENT.kbPolicy.retrieval = 'enabled'; }, TypeError);

const temp = await mkdtemp(join(tmpdir(), 'laiq-frozen-section-'));
try {
  const copyRoot = pathToFileURL(join(temp, 'server/section-agents/releases/general-tank-information/v1/')).href;
  await cp(fileURLToPath(release.rootUrl), fileURLToPath(copyRoot), { recursive: true });
  const isolated = { ...release, rootUrl: copyRoot };
  // Simulate future changes to common files and a second agent's KB. None may
  // change the first agent's content, evidence mapping or validation result.
  for (const path of ['server/section-planner.mjs', 'server/section-contracts.mjs', 'server/report-document.mjs', 'server/precedent-kb.mjs']) {
    await writeFile(join(temp, path), "throw new Error('future shared implementation must not be imported');\n");
  }
  await mkdir(join(temp, 'server/section-agents/releases/section-two/v1/'), { recursive: true });
  const laterKb = join(temp, 'server/section-agents/releases/section-two/v1/kb-policy.json');
  await writeFile(laterKb, JSON.stringify({ retrieval: 'enabled', entries: ['unrelated section'] }));
  const first = await runFrozenSectionAgent({ release: isolated, ...request, reportState: fixture });
  await writeFile(laterKb, JSON.stringify({ retrieval: 'enabled', entries: ['changed later KB'] }));
  const second = await runFrozenSectionAgent({ release: isolated, ...request, reportState: fixture });
  for (const result of [first, second]) {
    assert.deepEqual(result.draft, baseline.draft);
    assert.deepEqual(result.evaluationEvidence, baseline.evaluationEvidence);
    assert.deepEqual(result.generationRun.blockers, baseline.generationRun.blockers);
  }
  const kbUrl = new URL(manifest.kbSnapshot, copyRoot);
  await writeFile(kbUrl, JSON.stringify({ ...kb, retrieval: 'enabled' }));
  await assert.rejects(runFrozenSectionAgent({ release: isolated, ...request, reportState: fixture }), /file has changed/);
  await cp(new URL(manifest.kbSnapshot, release.rootUrl), kbUrl);
  await writeFile(new URL(manifest.entryPoint, copyRoot), '// accidentally modified frozen agent\n');
  await assert.rejects(runFrozenSectionAgent({ release: isolated, ...request, reportState: fixture }), /file has changed/);
  await writeFile(new URL('manifest.json', copyRoot), JSON.stringify({ ...manifest, productionEnabled: true }));
  await assert.rejects(runFrozenSectionAgent({ release: isolated, ...request, reportState: fixture }), /manifest has changed/);
} finally { await rm(temp, { recursive: true, force: true }); }

console.log(JSON.stringify({ release: release.version, pinnedFiles: Object.keys(manifest.files).length,
  dependencyIsolation: true, crossSectionKbIsolation: true, tamperRejection: true, productionEnabled: false, passed: true }));

// Optional private replay compares against previously saved outputs. It is not
// another unseen holdout, and does not copy reports or gold into the release.
const args = process.argv.slice(2);
if (args.includes('--private-data')) {
  const directory = args[args.indexOf('--private-data') + 1];
  assert(directory && !directory.startsWith('--'), '--private-data requires the local qualification data directory');
  const root = pathToFileURL(`${resolve(directory)}/`);
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const readJson = async name => JSON.parse(await readFile(new URL(name, root)));
  const originalFreeze = await readJson('development-freeze.json');
  assert.equal(hash(await readFile(new URL('development-freeze.json', root))), manifest.originalDevelopmentFreezeSha256);
  const reviewManifest = await readJson('review-manifest.json');
  for (const [name, expectedHash] of Object.entries(reviewManifest.files)) assert.equal(hash(await readFile(new URL(name, root))), expectedHash, name);
  let reports = 0, fields = 0;
  for (const split of ['development', 'held_out']) {
    const original = await readJson(`${split}-results.json`);
    assert.deepEqual(original.codeHashes, originalFreeze.codeHashes);
    assert.equal(original.summary.reports, split === 'development' ? 10 : 1);
    for (const row of original.cases) {
      const bytes = await readFile(new URL(`inputs/${row.caseId}.json`, root));
      assert.equal(hash(bytes), row.inputSha256);
      const generated = await runSectionAgent({ ...request, reportState: JSON.parse(bytes) });
      // Compare the entire formatted draft/evidence, not merely the score.
      assert.deepEqual(generated.draft, row.generated.draft, row.caseId);
      assert.deepEqual(generated.evaluationEvidence, row.generated.evaluationEvidence, row.caseId);
      assert.deepEqual(generated.orchestration, row.generated.orchestration, row.caseId);
      assert.deepEqual(generated.generationRun.blockers, row.generated.generationRun.blockers, row.caseId);
      assert.equal(generated.generationRun.usedLiveModel, false);
      assert.equal(row.preservedFieldCount, row.fieldCount);
      reports++; fields += row.preservedFieldCount;
    }
  }
  assert.equal(reports, 11); assert.equal(fields, 341);
  const receipt = { contractVersion: 'section_agent_packaging_replay_v1', release: release.version,
    manifestSha256: release.manifestSha256, reports, fields, identicalDrafts: reports,
    identicalEvidence: reports, developmentReports: 10, previouslyHeldOutReports: 1,
    unseenHoldoutTest: false, paidAiCalls: 0, productionEnabled: false,
    clientDataIncluded: false, passed: true };
  console.log(JSON.stringify(receipt));
  if (args.includes('--receipt')) {
    const destination = args[args.indexOf('--receipt') + 1];
    assert(destination && !destination.startsWith('--'), '--receipt requires a path');
    await writeFile(destination, `${JSON.stringify(receipt, null, 2)}\n`);
  }
}
