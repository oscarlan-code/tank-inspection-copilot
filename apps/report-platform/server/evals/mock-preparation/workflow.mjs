#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildMockPreparationDatasetFromCase } from './evaluation-dataset.mjs';
import { evaluateMockPreparationCase } from './run.mjs';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const optionalJson = async (path) => {
  try { return await readJson(path); }
  catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
};

function parseArgs(argv) {
  const at = argv.indexOf('--case-root');
  if (at < 0 || !argv[at + 1]) throw new Error('Usage: workflow.mjs --case-root <private-case-root>');
  return { caseRoot: resolve(argv[at + 1]) };
}

export async function runMockPreparationWorkflow(caseRoot) {
  const reviewDir = join(caseRoot, 'review');
  await mkdir(reviewDir, { recursive: true });
  const evaluation = await evaluateMockPreparationCase(caseRoot);
  await writeFile(join(reviewDir, 'mock-preparation-eval.json'), `${JSON.stringify(evaluation, null, 2)}\n`, { mode: 0o600 });
  const dataset = await buildMockPreparationDatasetFromCase(caseRoot);
  await writeFile(join(reviewDir, 'mock-preparation-dataset.json'), `${JSON.stringify(dataset, null, 2)}\n`, { mode: 0o600 });
  const calibration = await optionalJson(join(reviewDir, 'semantic-judge-pilot-v1', 'result.json'));
  const result = {
    evaluationOnly: true,
    workflow: 'source units -> candidate app evidence -> row graders -> human review -> controlled candidate comparison',
    candidate: evaluation.candidate,
    dataset: dataset.summary,
    qualificationDecision: evaluation.decision,
    evaluatorCalibration: calibration ? {
      separateFromMockReadiness: true,
      judgments: calibration.judgmentCount ?? calibration.judgments?.length ?? 0,
      matches: calibration.exactMatchCount ?? calibration.judgments?.filter((item) => item.matched).length ?? 0,
      gatePassed: calibration.gatePassed ?? null,
    } : { separateFromMockReadiness: true, status: 'not_run' },
    artifacts: {
      dataset: join(reviewDir, 'mock-preparation-dataset.json'),
      evaluation: join(reviewDir, 'mock-preparation-eval.json'),
    },
  };
  await writeFile(join(reviewDir, 'mock-preparation-workflow-result.json'), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  return result;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  console.log(JSON.stringify(await runMockPreparationWorkflow(args.caseRoot), null, 2));
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) run().catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
