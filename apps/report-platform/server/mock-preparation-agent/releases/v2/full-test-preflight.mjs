#!/usr/bin/env node
import { readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

function parseArgs(argv) {
  const args = { corpusRoot: null, cohort: null, output: null, split: 'all' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (['--corpus-root', '--cohort', '--output', '--split'].includes(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      if (arg === '--corpus-root') args.corpusRoot = resolve(value);
      if (arg === '--cohort') args.cohort = resolve(value);
      if (arg === '--output') args.output = resolve(value);
      if (arg === '--split') args.split = value;
      index += 1;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.corpusRoot || !args.cohort || !['all', 'training', 'validation'].includes(args.split)) {
    throw new Error('Usage: full-test-preflight.mjs --corpus-root <private-corpus> --cohort <cohort.json> [--split all|training|validation] [--output result.json]');
  }
  return args;
}

async function exists(path) {
  try { await stat(path); return true; } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function cohortEntries(cohort) {
  const entries = cohort.reports ?? cohort.cases ?? cohort.entries;
  if (!Array.isArray(entries)) throw new Error('Cohort must contain reports, cases or entries.');
  return entries;
}

function narrativeCounts(matrix) {
  const allowed = new Set(['observation', 'recommendation', 'scope_fact', 'test_method']);
  const units = matrix?.semanticUnits ?? [];
  const narrative = units.filter((unit) => allowed.has(unit.unitType)
    && (unit.appCapability == null || unit.appCapability === 'capturable')
    && (unit.evaluationMode == null || unit.evaluationMode === 'semantic'));
  return {
    semanticUnitCount: units.length,
    narrativeUnitCount: narrative.length,
    narrativeByType: Object.fromEntries([...allowed].map((type) => [type,
      narrative.filter((unit) => unit.unitType === type).length])),
  };
}

export async function inspectCase(caseRoot, entry, contract) {
  const required = contract.datasetReadiness.requiredPerCase;
  const present = Object.fromEntries(await Promise.all(required.map(async (name) =>
    [name, await exists(join(caseRoot, name))])));
  const missing = required.filter((name) => !present[name]);
  let checklist = null;
  let semantics = { semanticUnitCount: 0, narrativeUnitCount: 0, narrativeByType: {} };
  let planVoiceNoteCount = 0;
  const blockers = [...missing.map((name) => `missing:${name}`)];
  if (present['checklist-extraction.json']) {
    const document = await readJson(join(caseRoot, 'checklist-extraction.json'));
    const itemCount = (document.items ?? []).length;
    const unresolvedCount = document.summary?.unresolvedCount
      ?? (document.items ?? []).filter((item) => item.status !== 'extracted').length;
    if (itemCount !== contract.datasetReadiness.checklistItemCount) blockers.push(`checklist_item_count:${itemCount}`);
    if (unresolvedCount !== contract.datasetReadiness.checklistUnresolvedCount) blockers.push(`checklist_unresolved:${unresolvedCount}`);
    checklist = { itemCount, unresolvedCount };
  }
  let semanticGoldStatus = null;
  if (present['semantic-pairs.json']) {
    const matrix = await readJson(join(caseRoot, 'semantic-pairs.json'));
    semantics = narrativeCounts(matrix);
    semanticGoldStatus = matrix.status ?? null;
    if (!contract.datasetReadiness.acceptedSemanticGoldStatuses.includes(semanticGoldStatus)) {
      blockers.push(`semantic_gold_status:${semanticGoldStatus ?? 'missing'}`);
    }
  }
  if (present['reviewed-case-plan.json']) {
    const plan = await readJson(join(caseRoot, 'reviewed-case-plan.json'));
    planVoiceNoteCount = (plan.voiceNotes ?? []).length;
    if (!planVoiceNoteCount) blockers.push('reviewed_plan_has_no_voice_notes');
  }
  if (present['semantic-pairs.json'] && !semantics.semanticUnitCount) blockers.push('semantic_matrix_empty');
  return {
    caseId: entry.caseId,
    split: entry.sourceDatasetSplit,
    sourcePath: entry.sourcePath,
    ready: blockers.length === 0,
    blockers,
    files: present,
    checklist,
    semanticGoldStatus,
    ...semantics,
    planVoiceNoteCount,
  };
}

export async function runPreflight({ corpusRoot, cohortPath, split = 'all' }) {
  const [cohort, contract] = await Promise.all([
    readJson(cohortPath),
    readJson(join(HERE, 'full-test-contract.json')),
  ]);
  const selected = cohortEntries(cohort).filter((entry) => split === 'all' || entry.sourceDatasetSplit === split);
  const cases = [];
  for (const entry of selected) cases.push(await inspectCase(join(corpusRoot, entry.caseId), entry, contract));
  const ready = cases.filter((item) => item.ready);
  return {
    contractVersion: contract.contractVersion,
    candidateFreezeRequired: true,
    cohortId: cohort.cohortId,
    requestedSplit: split,
    selectedCaseCount: cases.length,
    readyCaseCount: ready.length,
    blockedCaseCount: cases.length - ready.length,
    readyForFullTest: cases.length > 0 && ready.length === cases.length,
    decision: cases.length > 0 && ready.length === cases.length ? 'ready' : 'blocked',
    cases,
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runPreflight({ corpusRoot: args.corpusRoot, cohortPath: args.cohort, split: args.split });
  const encoded = `${JSON.stringify(result, null, 2)}\n`;
  if (args.output) await writeFile(args.output, encoded, { mode: 0o600 });
  process.stdout.write(encoded);
  if (!result.readyForFullTest) process.exitCode = 2;
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) run().catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
