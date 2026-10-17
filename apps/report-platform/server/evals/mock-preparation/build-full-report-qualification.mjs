#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const RUN_ID = 'mock-preparation-full-case-v1';
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

function parseArgs(argv) {
  const at = argv.indexOf('--case-root');
  if (at < 0 || !argv[at + 1]) {
    throw new Error('Usage: build-full-report-qualification.mjs --case-root <private-case-root>');
  }
  return { caseRoot: resolve(argv[at + 1]) };
}

const normalize = (value) => {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, normalize(item)]));
  }
  if (typeof value === 'number') return Number(value.toFixed(6));
  if (typeof value === 'string') return value.trim().replace(/\s+/g, ' ');
  return value;
};
const same = (left, right) => JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));

function normalizeOptionalMeasurement(value) {
  const text = String(value ?? '').trim();
  if (!text || /^(?:n\/?a|not applicable|not available)$/i.test(text)) return null;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : text;
}

export function utRowsEquivalent(actual, expected) {
  if (!actual || !expected) return false;
  return same(
    { ...actual, reinforcementPadReading: normalizeOptionalMeasurement(actual.reinforcementPadReading) },
    { ...expected, reinforcementPadReading: normalizeOptionalMeasurement(expected.reinforcementPadReading) },
  );
}

function exportedUtFacts(entry) {
  const readings = [1, 2, 3, 4, 5]
    .map((number) => entry?.[`value${number}`])
    .filter((value) => value !== undefined && value !== null);
  return entry ? {
    itemKey: entry.itemKey,
    target: entry.targetKey,
    itemLabel: entry.itemLabel,
    kind: entry.itemKind,
    elementType: entry.elementTypeKey ?? null,
    nozzleSize: entry.nozzleSize ?? '',
    reinforcementPadReading: entry.reinforcementPadReading ?? '',
    readings,
    confirmed: Boolean(entry.confirmed),
  } : null;
}

function formatMeasurement(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : String(value ?? '').trim();
}

export function formatUtSourceText(unit) {
  const facts = unit?.protectedFacts ?? {};
  const target = facts.target === 'external_roof' ? 'External roof'
    : facts.target === 'shell' ? 'Shell' : String(facts.target ?? 'UT measurement');
  const kind = facts.kind === 'ELEMENT' ? [facts.elementType, facts.itemLabel].filter(Boolean).join(' ')
    : facts.itemLabel;
  const labels = facts.kind === 'ELEMENT'
    ? (facts.target === 'shell' ? ['12 o’clock', '3 o’clock', '6 o’clock', '9 o’clock'] : ['North', 'East', 'South', 'West'])
    : (facts.target === 'external_roof' ? ['A', 'B', 'C', 'D', 'E'] : ['1', '2', '3', '4', '5']);
  const readings = (facts.readings ?? []).map((value, index) => `${labels[index] ?? index + 1}: ${formatMeasurement(value)} mm`);
  const details = [`${target} · ${kind || facts.itemKey}`];
  if (facts.nozzleSize) details.push(`Size: ${facts.nozzleSize}`);
  if (readings.length) details.push(`Readings: ${readings.join(' · ')}`);
  if (String(facts.reinforcementPadReading ?? '').trim()) {
    const pad = String(facts.reinforcementPadReading).trim();
    details.push(`Reinforcement pad: ${/^(?:n\/?a)$/i.test(pad) ? 'N/A' : `${formatMeasurement(pad)} mm`}`);
  }
  return details.join('\n');
}

function sourceText(unit) {
  if (unit.unitType === 'ut_measurement_row') return formatUtSourceText(unit);
  const text = (unit.sourceEvidence ?? []).map((item) => String(item.text ?? '').trim()).filter(Boolean).join('\n');
  if (text) return text;
  if (unit.evaluationMode === 'visual') return `[Layout figure on original page ${unit.protectedFacts?.sourcePage ?? '?'}]`;
  return `[Original source unit ${unit.sourceUnitId}]`;
}

function sourcePage(unit) {
  return unit.sourceEvidence?.find((item) => Number.isFinite(item.page))?.page ?? null;
}

function display(value) {
  if (value == null) return '';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function exactActual(unit, exported) {
  if (unit.unitType === 'structured_field') {
    const field = unit.protectedFacts.field;
    const actual = exported.inspectionRecord?.generalTankInformation?.[field];
    return {
      actual,
      expected: unit.protectedFacts.value,
      refs: [`inspectionRecord.generalTankInformation.${field}`],
    };
  }
  if (unit.unitType === 'checklist_rating') {
    const record = (exported.inspectionChecklistItems ?? [])
      .find((item) => item.itemNumber === unit.protectedFacts.itemNumber);
    return {
      actual: record ? { itemNumber: record.itemNumber, ratingKey: record.ratingKey } : null,
      expected: unit.protectedFacts,
      refs: record ? [`inspectionChecklistItems[itemNumber=${record.itemNumber}]`] : [],
    };
  }
  if (unit.unitType === 'ut_measurement_row') {
    const record = (exported.utMeasurements ?? [])
      .find((item) => item.itemKey === unit.protectedFacts.itemKey);
    const actual = exportedUtFacts(record);
    return {
      actual,
      expected: unit.protectedFacts,
      equivalent: utRowsEquivalent(actual, unit.protectedFacts),
      refs: record ? [`utMeasurements[itemKey=${record.itemKey}]`] : [],
    };
  }
  throw new Error(`Unsupported exact unit type ${unit.unitType}`);
}

function baseRow(unit, datasetId) {
  return {
    rowId: `${unit.sourceUnitId}:${datasetId}`,
    variantId: datasetId,
    sourceUnitId: unit.sourceUnitId,
    semanticKey: unit.semanticKey,
    unitType: unit.unitType,
    appStyle: datasetId,
    sourcePage: sourcePage(unit),
    originalText: sourceText(unit),
    protectedFacts: unit.protectedFacts ?? {},
    allowedVariation: unit.variationPolicy ?? '',
    appEvidenceText: '',
    appEvidenceValue: null,
    appEvidenceRefs: [],
    appContext: null,
    graderId: null,
    graderVersion: null,
    modelId: null,
    confidence: null,
    humanReviewRequired: false,
    linkageStatus: 'not_applicable',
    meaningStatus: 'not_measured',
    integrityStatus: 'not_measured',
    result: 'pending',
    explanation: '',
    missingFacts: [],
    alteredFacts: [],
    unsupportedFacts: [],
    contradictions: [],
  };
}

function exactRow(unit, datasetId, exported) {
  const row = baseRow(unit, datasetId);
  const comparison = exactActual(unit, exported);
  const exactMatch = same(comparison.actual, comparison.expected);
  const passed = comparison.equivalent ?? exactMatch;
  const representationNormalized = passed && !exactMatch;
  return {
    ...row,
    appEvidenceText: display(comparison.actual),
    appEvidenceValue: comparison.actual,
    appEvidenceRefs: comparison.refs,
    gradingRoute: 'deterministic',
    gradingStatus: 'complete',
    graderId: unit.unitType === 'structured_field' ? 'structured-parity'
      : unit.unitType === 'checklist_rating' ? 'checklist-rating-parity' : 'ut-row-parity',
    graderVersion: '1.0.0',
    humanReviewRequired: passed,
    linkageStatus: comparison.refs.length ? 'pass' : 'fail',
    meaningStatus: passed ? 'preserved' : 'changed',
    integrityStatus: passed ? 'pass' : 'fail',
    result: passed ? 'pending' : 'fail',
    explanation: passed
      ? `${representationNormalized
        ? 'Android export preserves the prepared value after field-type normalization. '
        : 'Android export matches the prepared value. '}Confirm the prepared value against the original report before freezing this source unit.`
      : 'Android export differs from the prepared value.',
    missingFacts: passed ? [] : [`Expected ${display(comparison.expected)}.`],
    alteredFacts: passed ? [] : [`Exported ${display(comparison.actual)}.`],
  };
}

function visualRow(unit, datasetId, exported) {
  const row = baseRow(unit, datasetId);
  const target = unit.protectedFacts.target;
  const config = (exported.layoutConfigs ?? []).find((item) => item.targetKey === target) ?? null;
  const targetRecord = (exported.layoutTargets ?? []).find((item) => item.targetKey === target) ?? null;
  const elements = (exported.elements ?? []).filter((item) => item.targetKey === target);
  const refs = [];
  if (config) refs.push(`layoutConfigs[targetKey=${target}]`);
  if (targetRecord) refs.push(`layoutTargets[targetKey=${target}]`);
  if (elements.length) refs.push(`elements[targetKey=${target}]`);
  return {
    ...row,
    appEvidenceText: display({ config, target: targetRecord, elements }),
    appEvidenceValue: { config, target: targetRecord, elements },
    appEvidenceRefs: refs,
    gradingRoute: 'human_visual',
    gradingStatus: 'awaiting_visual_review',
    graderId: 'pending-layout-review',
    graderVersion: '1.0.0',
    humanReviewRequired: true,
    linkageStatus: refs.length ? 'pass' : 'fail',
    meaningStatus: 'pending',
    integrityStatus: 'pending',
    result: 'pending',
    explanation: 'Compare topology, orientation, labels, plate or course counts, and element placement with the original figure.',
  };
}

function nonAppRow(unit, datasetId) {
  return {
    ...baseRow(unit, datasetId),
    gradingRoute: 'deterministic',
    gradingStatus: 'complete',
    graderId: 'app-capability-boundary',
    graderVersion: '1.0.0',
    result: 'not_applicable',
    explanation: unit.gapReason ?? (unit.appCapability === 'report_platform_owned'
      ? 'This content is owned by the report platform rather than captured by the Android app.'
      : 'This source unit is outside the current Android app contract.'),
  };
}

function semanticRows({ ledger, matrix, result, datasets }) {
  const semanticBySourceUnit = new Map(matrix.semanticUnits
    .filter((unit) => unit.evaluationMode === 'semantic')
    .map((unit) => [unit.sourceUnitId, unit]));
  return datasets.flatMap(({ datasetId, accepted, plan }) => {
    const datasetResult = result.datasets.find((item) => item.datasetId === datasetId);
    const finalAttempts = datasetResult.batchResults.map((batch) => batch.attempts.at(-1));
    const grades = new Map(finalAttempts.flatMap((attempt) => attempt.facts ?? [])
      .map((fact) => [fact.factId, fact]));
    const clauseByFact = new Map();
    for (const note of accepted.notes ?? []) {
      for (const clause of note.clauses ?? []) {
        for (const factId of clause.factIds ?? []) clauseByFact.set(factId, { noteId: note.noteId, text: clause.text });
      }
    }
    const planByNote = new Map((plan.voiceNotes ?? []).map((note) => [note.noteId, note]));
    return ledger.facts.map((fact) => {
      const sourceUnit = (fact.sourceUnitIds ?? []).map((id) => semanticBySourceUnit.get(id)).find(Boolean);
      if (!sourceUnit) throw new Error(`${fact.factId} has no semantic source-unit definition.`);
      const clause = clauseByFact.get(fact.factId);
      const grade = grades.get(fact.factId);
      const route = planByNote.get(fact.noteId);
      const passed = Boolean(clause) && grade?.semanticVerdict === 'preserved'
        && grade?.integrityVerdict === 'pass';
      return {
        ...baseRow({
          ...sourceUnit,
          sourceUnitId: fact.factId,
          semanticKey: `${sourceUnit.semanticKey}.${fact.factId}`,
          sourceEvidence: fact.sourceEvidence,
          protectedFacts: fact.protectedFacts,
        }, datasetId),
        appEvidenceText: clause?.text ?? '',
        appEvidenceRefs: clause ? [`voiceNotes[voiceNoteId=concise-field-${clause.noteId}]`] : [],
        appContext: route ? { voice: { screenLabel: route.screenLabel, itemLabel: route.location } } : null,
        gradingRoute: datasetId === 'base-source-grounded' ? 'deterministic' : 'llm_semantic',
        gradingStatus: 'complete',
        graderId: grade ? (datasetId === 'base-source-grounded'
          ? 'deterministic-exact-lineage' : 'gpt-5.6-sol') : null,
        graderVersion: 'mock-preparation-agent-v1',
        modelId: datasetId === 'base-source-grounded' ? null : 'gpt-5.6-sol',
        linkageStatus: clause ? 'pass' : 'fail',
        meaningStatus: grade?.semanticVerdict ?? 'not_measured',
        integrityStatus: grade?.integrityVerdict ?? 'not_measured',
        result: passed ? 'pass' : 'fail',
        explanation: grade?.explanation ?? 'No semantic grade was saved.',
        missingFacts: grade?.missingFacts ?? [],
        alteredFacts: grade?.alteredFacts ?? [],
      };
    });
  });
}

export async function buildFullReportQualification(caseRoot) {
  const runRoot = join(caseRoot, 'review', RUN_ID);
  const [matrix, ledger, result, androidAudit] = await Promise.all([
    readJson(join(caseRoot, 'semantic-pairs.json')),
    readJson(join(runRoot, 'atomic-fact-ledger.json')),
    readJson(join(runRoot, 'result.json')),
    readJson(join(runRoot, 'android-round-trip-result.json')),
  ]);
  const datasets = await Promise.all(result.datasets.map(async ({ datasetId }) => ({
    datasetId,
    accepted: await readJson(join(runRoot, 'datasets', datasetId, 'accepted.json')),
    plan: await readJson(join(runRoot, 'android-plans', `${datasetId}.json`)),
    exported: await readJson(join(runRoot, 'android-cases', datasetId, 'exports', 'concise-field', 'v3-product-export.json')),
  })));

  const nonSemanticUnits = matrix.semanticUnits.filter((unit) => unit.evaluationMode !== 'semantic');
  const rows = semanticRows({ ledger, matrix, result, datasets });
  for (const dataset of datasets) {
    for (const unit of nonSemanticUnits) {
      if (unit.evaluationMode === 'exact') rows.push(exactRow(unit, dataset.datasetId, dataset.exported));
      else if (unit.evaluationMode === 'visual') rows.push(visualRow(unit, dataset.datasetId, dataset.exported));
      else rows.push(nonAppRow(unit, dataset.datasetId));
    }
  }
  rows.sort((left, right) => left.sourcePage - right.sourcePage
    || left.unitType.localeCompare(right.unitType)
    || left.sourceUnitId.localeCompare(right.sourceUnitId)
    || left.variantId.localeCompare(right.variantId));

  const count = (predicate) => rows.filter(predicate).length;
  const datasetSummaries = datasets.map(({ datasetId }) => {
    const subset = rows.filter((row) => row.variantId === datasetId);
    return {
      datasetId,
      comparisonCount: subset.length,
      passed: subset.filter((row) => row.result === 'pass').length,
      failed: subset.filter((row) => row.result === 'fail').length,
      pendingHumanReview: subset.filter((row) => row.result === 'pending').length,
      notApplicable: subset.filter((row) => row.result === 'not_applicable').length,
    };
  });
  const failed = count((row) => row.result === 'fail');
  const pending = count((row) => row.result === 'pending');
  const artifact = {
    contractVersion: 'mock_preparation_full_report_qualification_v1',
    evaluationOnly: true,
    runId: result.runId,
    caseId: result.caseId,
    sourceUnitCount: matrix.semanticUnits.length,
    atomicEvaluationUnitCount: nonSemanticUnits.length + ledger.facts.length,
    atomicSplitDelta: nonSemanticUnits.length + ledger.facts.length - matrix.semanticUnits.length,
    datasetCount: datasets.length,
    decision: failed ? 'fail' : pending ? 'human_review_required' : 'pass',
    summary: {
      comparisonCount: rows.length,
      passed: count((row) => row.result === 'pass'),
      failed,
      pendingHumanReview: pending,
      notApplicable: count((row) => row.result === 'not_applicable'),
      structured: {
        units: matrix.semanticUnits.filter((unit) => unit.evaluationMode === 'exact').length,
        parityPassed: count((row) => row.graderId?.endsWith('parity') && row.meaningStatus === 'preserved'),
        sourceReviewPending: count((row) => row.graderId?.endsWith('parity') && row.humanReviewRequired),
      },
      narrative: {
        atomicFacts: ledger.facts.length,
        passed: count((row) => ['llm_semantic', 'deterministic'].includes(row.gradingRoute)
          && row.graderVersion === 'mock-preparation-agent-v1' && row.result === 'pass'),
      },
      visual: {
        units: matrix.semanticUnits.filter((unit) => unit.evaluationMode === 'visual').length,
        pending: count((row) => row.gradingRoute === 'human_visual' && row.result === 'pending'),
      },
      outsideApp: {
        units: matrix.semanticUnits.filter((unit) => !['exact', 'semantic', 'visual'].includes(unit.evaluationMode)).length,
        comparisons: count((row) => row.result === 'not_applicable'),
      },
      androidRoundTrip: androidAudit.decision,
    },
    datasets: datasetSummaries,
    rows,
    generatedAtIso: new Date().toISOString(),
  };
  const output = join(runRoot, 'full-report-evaluation.json');
  await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`, { mode: 0o600 });
  return { output, artifact };
}

async function run() {
  const { caseRoot } = parseArgs(process.argv.slice(2));
  const { output, artifact } = await buildFullReportQualification(caseRoot);
  console.log(JSON.stringify({ output, decision: artifact.decision, ...artifact.summary }, null, 2));
  if (artifact.summary.failed) process.exitCode = 2;
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) run().catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
