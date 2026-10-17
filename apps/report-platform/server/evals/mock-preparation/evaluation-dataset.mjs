#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const optionalJson = async (path) => {
  try { return await readJson(path); }
  catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
};

function parseArgs(argv) {
  const args = { caseRoot: null, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--case-root' || arg === '--output') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      args[arg === '--case-root' ? 'caseRoot' : 'output'] = resolve(value);
      index += 1;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.caseRoot) throw new Error('Usage: evaluation-dataset.mjs --case-root <private-case-root> [--output <file>]');
  return args;
}

function sourceText(unit, row) {
  const text = String(row?.goldText ?? '').trim()
    || (unit.sourceEvidence ?? []).map((item) => String(item.text ?? '').trim()).filter(Boolean).join('\n');
  return text || JSON.stringify(unit.protectedFacts ?? {});
}

function outputText(row) {
  const text = String(row?.mockText ?? '').trim();
  if (text) return text;
  if (Object.hasOwn(row ?? {}, 'actualValue')) {
    return typeof row.actualValue === 'string' ? row.actualValue : JSON.stringify(row.actualValue);
  }
  return '';
}

function allowedVariation(unit) {
  if (unit.evaluationMode === 'exact') return 'Wording and presentation may change only when every protected value, unit, entity, location and relationship remains exact.';
  if (unit.evaluationMode === 'visual') return 'Visual geometry may be redrawn through the app, but topology, labels, component identity and relationships must remain equivalent.';
  return 'Inspector wording may be concise, reordered, disfluent or paraphrased. Technical meaning and every protected fact must remain available.';
}

function appStyle(unit) {
  const styles = {
    checklist_rating: 'inspection_checklist_item',
    layout_figure: 'layout_map',
    observation: 'voice_note_observation',
    recommendation: 'voice_note_recommended_action',
    scope_fact: 'voice_note_context_scope',
    structured_field: 'structured_app_field',
    test_method: 'voice_note_context_method',
    ut_measurement_row: 'structured_ut_row',
  };
  return styles[unit.unitType] ?? 'app_evidence_record';
}

function gradingRoute(unit) {
  if (unit.evaluationMode === 'exact') return 'deterministic';
  if (unit.evaluationMode === 'visual') return 'human_visual';
  return 'llm_semantic';
}

function gradingStatus(unit, row) {
  if (row?.reviewed === true) return 'complete';
  if (unit.evaluationMode === 'visual') return 'awaiting_visual_review';
  if (unit.evaluationMode === 'exact') return 'awaiting_deterministic_comparison';
  return 'awaiting_llm_semantic_grading';
}

function graderRows(unit, row) {
  const linked = Array.isArray(row?.mockEvidenceRefs) && row.mockEvidenceRefs.length > 0;
  const reviewed = row?.reviewed === true;
  const meaning = reviewed
    ? row.semanticVerdict === 'preserved' ? 'pass' : 'fail'
    : 'pending';
  const integrity = reviewed
    ? row.integrityVerdict === 'pass' && Number(row.unsupportedAdditionCount ?? 0) === 0 ? 'pass' : 'fail'
    : 'pending';
  const graders = [{
    id: 'app-record-linkage',
    type: 'deterministic',
    status: linked ? 'pass' : 'fail',
    explanation: linked ? 'The source unit is linked to authentic app export evidence.' : 'No app evidence record is linked to this source unit.',
  }];
  if (unit.evaluationMode === 'exact') graders.push({
    id: 'exact-fact-alignment', type: 'deterministic', status: meaning,
    explanation: reviewed ? 'Protected structured facts were compared exactly.' : 'Exact comparison has not run.',
  });
  if (unit.evaluationMode === 'semantic') graders.push({
    id: 'semantic-meaning-alignment', type: 'llm_semantic', status: meaning,
    explanation: reviewed ? 'An independent semantic grader compared meaning after allowing inspector-style paraphrase.' : 'LLM semantic grading is pending.',
  });
  if (unit.evaluationMode === 'visual') graders.push({
    id: 'visual-layout-alignment', type: 'human_visual', status: meaning,
    explanation: reviewed ? 'The app map was compared with the original report figure.' : 'Visual comparison is pending.',
  });
  graders.push({
    id: 'truth-integrity',
    type: unit.evaluationMode === 'exact' ? 'deterministic' : unit.evaluationMode === 'visual' ? 'human_visual' : 'llm_semantic',
    status: integrity,
    explanation: reviewed ? 'Checked for missing, altered, contradictory and unsupported facts.'
      : unit.evaluationMode === 'semantic' ? 'LLM truth-integrity grading is pending.' : 'Truth-integrity review is pending.',
  });
  return graders;
}

function overallResult(unit, row, graders) {
  if (unit.appCapability !== 'capturable') return 'not_applicable';
  if (graders.some((grader) => grader.status === 'fail')) return 'fail';
  if (unit.evaluationMode === 'semantic' && row?.grader?.type === 'llm'
    && (row.humanReviewRequired === true
      || Number(row.confidence ?? 0) < Number(row.grader?.minimumAutoPassConfidence ?? 0.9))) return 'pending';
  if (graders.some((grader) => grader.status === 'pending')) return 'pending';
  return 'pass';
}

export function buildMockPreparationDataset({ matrix, candidate = null, caseRecord = null }) {
  if (matrix?.contractVersion !== 'source_mock_semantic_matrix_v1') {
    throw new Error('semantic-pairs.json must use source_mock_semantic_matrix_v1.');
  }
  const unitById = new Map((matrix.semanticUnits ?? []).map((unit) => [unit.sourceUnitId, unit]));
  const rows = [];
  for (const variant of matrix.variants ?? []) {
    for (const output of variant.rows ?? []) {
      const unit = unitById.get(output.sourceUnitId);
      if (!unit) throw new Error(`Variant ${variant.variantId} references unknown source unit ${output.sourceUnitId}.`);
      const graders = graderRows(unit, output);
      rows.push({
        rowId: `${variant.variantId}:${unit.sourceUnitId}`,
        variantId: variant.variantId,
        input: {
          sourceUnitId: unit.sourceUnitId,
          semanticKey: unit.semanticKey,
          unitType: unit.unitType,
          appCapability: unit.appCapability,
          sourcePage: unit.sourceEvidence?.[0]?.page ?? null,
          sourceText: sourceText(unit, output),
          protectedFacts: unit.protectedFacts ?? {},
        },
        reference: {
          appStyle: appStyle(unit),
          mustPreserve: unit.protectedFacts ?? {},
          allowedVariation: allowedVariation(unit),
          forbiddenAdditions: 'Any fact, value, relationship, condition or recommendation not supported by this source unit, its declared sibling source group, or explicit app metadata.',
        },
        output: {
          text: outputText(output),
          value: Object.hasOwn(output, 'actualValue') ? output.actualValue : null,
          appEvidenceRefs: output.mockEvidenceRefs ?? [],
          appContext: output.mockContext ?? null,
        },
        grading: {
          route: gradingRoute(unit),
          status: gradingStatus(unit, output),
          graderId: output.grader?.id ?? null,
          graderVersion: output.grader?.version ?? null,
          modelId: output.grader?.modelId ?? null,
          confidence: Number.isFinite(output.confidence) ? output.confidence : null,
          humanReviewRequired: output.reviewed === true
            ? output.grader?.type === 'llm'
              && (output.humanReviewRequired === true
                || Number(output.confidence ?? 0) < Number(output.grader?.minimumAutoPassConfidence ?? 0.9)
                || output.semanticVerdict !== 'preserved'
                || output.integrityVerdict !== 'pass')
            : false,
        },
        graders,
        result: overallResult(unit, output, graders),
        feedback: {
          explanation: output.explanation ?? '',
          missingFacts: output.missingFacts ?? [],
          alteredFacts: output.alteredFacts ?? [],
          unsupportedFacts: output.unsupportedFacts ?? [],
          contradictions: output.contradictions ?? [],
        },
      });
    }
  }
  const count = (status) => rows.filter((row) => row.result === status).length;
  return {
    contractVersion: 'mock_preparation_openai_style_dataset_v1',
    evaluationOnly: true,
    agent: {
      id: 'mock-preparation-agent',
      task: 'Convert one source semantic unit into authentic app evidence while preserving inspection truth.',
    },
    dataset: {
      caseId: matrix.caseId,
      caseRevision: matrix.caseRevision,
      sourceSha256: caseRecord?.source?.sourceSha256 ?? null,
      split: caseRecord?.source?.sourceDatasetSplit ?? 'unknown',
      rowUnit: 'one source semantic unit paired with one generated app evidence output for one capture variation',
    },
    candidate: candidate ?? { status: 'unresolved' },
    summary: {
      totalRows: rows.length,
      passedRows: count('pass'),
      failedRows: count('fail'),
      pendingRows: count('pending'),
      notApplicableRows: count('not_applicable'),
    },
    rows,
  };
}

export async function buildMockPreparationDatasetFromCase(caseRoot) {
  const [matrix, candidate, caseRecord] = await Promise.all([
    readJson(join(caseRoot, 'semantic-pairs.json')),
    optionalJson(join(caseRoot, 'eval-candidate.json')),
    optionalJson(join(caseRoot, 'case.json')),
  ]);
  return buildMockPreparationDataset({ matrix, candidate, caseRecord });
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const dataset = await buildMockPreparationDatasetFromCase(args.caseRoot);
  const output = args.output ?? join(args.caseRoot, 'review', 'mock-preparation-dataset.json');
  await writeFile(output, `${JSON.stringify(dataset, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ output, ...dataset.summary }, null, 2));
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) run().catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
