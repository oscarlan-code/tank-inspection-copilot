#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getAiStatus, runStructuredCodexJob } from '../../../codex-cli.mjs';

const encode = (value) => JSON.stringify(value, null, 2) + '\n';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const readJson = (path) => readFile(path, 'utf8').then(JSON.parse);

function parseArguments(argv) {
  const result = { stage: null, mockExport: null, truthCase: null, bundle: null, outputDir: null, run: false };
  const flags = { '--stage': 'stage', '--mock-export': 'mockExport', '--truth-case': 'truthCase',
    '--bundle': 'bundle', '--output-dir': 'outputDir' };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--run') { result.run = true; continue; }
    const key = flags[argv[index]];
    if (!key) throw new Error('Unknown argument: ' + argv[index]);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(argv[index] + ' requires a value');
    result[key] = key === 'stage' ? value : resolve(value);
    index += 1;
  }
  if (!['interpret', 'qualify'].includes(result.stage) || !result.mockExport || !result.truthCase
      || !result.bundle || !result.outputDir) {
    throw new Error('Usage: interpret-calibration-case.mjs --stage interpret|qualify --mock-export <mock.json> --truth-case <truth.json> --bundle <bundle.json> --output-dir <dir> [--run]');
  }
  return result;
}

const stringField = { type: 'string' };
const stringArray = { type: 'array', items: stringField };
function interpretationSchema(evidenceIds) {
  return { type: 'object', additionalProperties: false, required: ['observations', 'clarifications'], properties: {
    observations: { type: 'array', minItems: evidenceIds.length, maxItems: evidenceIds.length,
      items: { type: 'object', additionalProperties: false,
        required: ['evidenceId', 'componentBlock', 'componentEntity', 'inspectionSide', 'location',
          'polarity', 'condition', 'severityOrExtent', 'uncertainty', 'valuesAndUnits', 'sourceCaptureIds'],
        properties: {
          evidenceId: { type: 'string', enum: evidenceIds }, componentBlock: stringField,
          componentEntity: stringField, inspectionSide: stringField, location: stringField,
          polarity: stringField, condition: stringField, severityOrExtent: stringField,
          uncertainty: stringField, valuesAndUnits: stringArray, sourceCaptureIds: stringArray,
        } },
    },
    clarifications: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['evidenceIds', 'question', 'material'], properties: {
        evidenceIds: stringArray, question: stringField, material: { type: 'boolean' },
      } } },
  } };
}

const qualificationSchema = {
  type: 'object', additionalProperties: false, required: ['variants'], properties: {
    variants: { type: 'array', minItems: 6, maxItems: 6, items: {
      type: 'object', additionalProperties: false,
      required: ['variantId', 'semanticEquivalent', 'entityLocationSideAccuracy',
        'polarityUncertaintyAccuracy', 'protectedValueAccuracy', 'mismatches'], properties: {
        variantId: stringField, semanticEquivalent: { type: 'boolean' },
        entityLocationSideAccuracy: { type: 'number', minimum: 0, maximum: 1 },
        polarityUncertaintyAccuracy: { type: 'number', minimum: 0, maximum: 1 },
        protectedValueAccuracy: { type: 'number', minimum: 0, maximum: 1 },
        mismatches: { type: 'array', items: { type: 'object', additionalProperties: false,
          required: ['evidenceIds', 'failureClass', 'detail'], properties: {
            evidenceIds: stringArray, failureClass: stringField, detail: stringField,
          } } },
      },
    } },
  },
};

function assertExactIds(actual, expected, label) {
  assert.deepEqual([...new Set(actual)].sort(), [...expected].sort(), label + ' IDs do not match');
  assert.equal(actual.length, expected.length, label + ' contains duplicate IDs');
}

async function save(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, encode(value), { mode: 0o600 });
}

async function cachedWorker(path, request) {
  const requestSha256 = sha256(JSON.stringify({ prompt: request.prompt, schema: request.schema }));
  try {
    const cached = await readJson(path);
    assert.equal(cached.requestSha256, requestSha256, 'Cached worker response does not match request');
    return cached;
  } catch {
    const worker = await runStructuredCodexJob({ prompt: request.prompt, schema: request.schema,
      reasoningEffort: 'medium', timeoutMs: 240000 });
    const result = { requestSha256, ...worker };
    await save(path, result);
    return result;
  }
}

function interpretationRequests(mockExport, truthCase, bundle) {
  const evidenceIds = truthCase.evidence_records.map((record) => record.evidence_id);
  return mockExport.variants.map((variant) => {
    const captures = variant.capture_records.map((record) => ({
      captureId: record.capture_id,
      channel: record.capture_channel,
      evidenceIds: record.structured_value.evidence_ids,
      rawText: record.raw_text,
    }));
    const prompt = `You are the evidence Interpretation Agent for a vertical tank inspection app.\n\nConvert the supplied app captures into one atomic structured observation for every opaque evidence ID. The IDs are trace keys, not facts. Read only the captured text. Preserve component identity, block, internal/external side, location, polarity, uncertainty, severity, values and units. Keep conditions as short factual labels, not finished report sentences. Do not add satisfactory conditions, recommendations, calculations, report prose or historical facts. If a material point is ambiguous, preserve the uncertainty and add a clarification.\n\nAPPROVED TERMINOLOGY PROJECTION:\n${JSON.stringify(bundle.roleProjections.mockPreparationAgent.terminologyPatterns)}\n\nAPP CAPTURES:\n${JSON.stringify(captures)}`;
    return { variantId: variant.variant_id, prompt, schema: interpretationSchema(evidenceIds), evidenceIds };
  });
}

async function interpret({ mockExport, truthCase, bundle, outputDir, run }) {
  const requests = interpretationRequests(mockExport, truthCase, bundle);
  await save(join(outputDir, 'interpretation-request-preview.json'), {
    evaluationOnly: true,
    externalDestination: 'configured Codex/OpenAI report-generation worker',
    targetReportTextIncluded: false,
    targetTruthIncluded: false,
    requestCount: requests.length,
    requests,
  });
  if (!run) return { prepared: true, sent: false, requestCount: requests.length };
  const variants = [];
  for (const request of requests) {
    const response = await cachedWorker(join(outputDir, 'worker', `interpret-${request.variantId}.json`), request);
    assertExactIds(response.parsed.observations.map((item) => item.evidenceId), request.evidenceIds,
      request.variantId);
    variants.push({ variantId: request.variantId, observations: response.parsed.observations,
      clarifications: response.parsed.clarifications, requestSha256: response.requestSha256,
      modelId: response.aiStatus.modelId });
  }
  await save(join(outputDir, 'interpretation-result.json'), {
    contractVersion: 'inspection_report_interpretation_result_v1',
    evaluationOnly: true, caseId: truthCase.case_id, targetTruthAvailableToInterpreter: false,
    terminologyProjectionId: bundle.roleProjections.mockPreparationAgent.projectionId,
    variants,
  });
  return { prepared: true, sent: true, requestCount: requests.length, variants: variants.length };
}

async function qualify({ truthCase, bundle, outputDir, run }) {
  const interpreted = await readJson(join(outputDir, 'interpretation-result.json'));
  const prompt = `You are the post-interpretation evaluator. Compare each interpreted app-capture variant to the sealed normalized truth. Treat concise paraphrases as equivalent. Do not reward wording similarity. Check component, location, internal/external side, polarity, uncertainty, severity and every value/unit. A variant is semanticallyEquivalent only when no material fact is missing, altered or added; a correct explicit clarification may preserve equivalence for ambiguity. Return only mismatches.\n\nEVALUATION PROJECTION:\n${JSON.stringify(bundle.roleProjections.postGenerationEvaluator)}\n\nSEALED NORMALIZED TRUTH:\n${JSON.stringify(truthCase.evidence_records)}\n\nINTERPRETED VARIANTS:\n${JSON.stringify(interpreted.variants)}`;
  const request = { prompt, schema: qualificationSchema };
  await save(join(outputDir, 'interpretation-qualification-request-preview.json'), {
    evaluationOnly: true,
    externalDestination: 'configured Codex/OpenAI report-generation worker',
    targetTruthIncluded: true,
    reason: 'Post-interpretation evaluation only; generator and reviewer cannot access this request.',
    requestCount: 1,
    request,
  });
  if (!run) return { prepared: true, sent: false, requestCount: 1 };
  const response = await cachedWorker(join(outputDir, 'worker', 'interpretation-qualification.json'), request);
  assertExactIds(response.parsed.variants.map((item) => item.variantId),
    interpreted.variants.map((item) => item.variantId), 'qualified variants');
  const localChecks = interpreted.variants.map((variant) => {
    const expected = new Map(truthCase.evidence_records.map((record) => [record.evidence_id, record]));
    const protectedFailures = [];
    for (const observation of variant.observations) {
      const truth = expected.get(observation.evidenceId);
      if (observation.componentBlock !== truth.component_block) protectedFailures.push({
        evidenceId: observation.evidenceId, field: 'componentBlock' });
      const actualValues = [...observation.valuesAndUnits].map((value) => value.toLowerCase()).sort();
      const expectedValues = [...truth.values_and_units].map((value) => value.toLowerCase()).sort();
      if (JSON.stringify(actualValues) !== JSON.stringify(expectedValues)) protectedFailures.push({
        evidenceId: observation.evidenceId, field: 'valuesAndUnits' });
    }
    return { variantId: variant.variantId, protectedFailures };
  });
  const qualification = {
    contractVersion: 'inspection_report_interpretation_qualification_v1',
    evaluationOnly: true,
    caseId: truthCase.case_id,
    goldOpenedAfterInterpretation: true,
    variants: response.parsed.variants,
    localChecks,
  };
  const selectedId = 'ordered_voice_summary';
  const selected = interpreted.variants.find((item) => item.variantId === selectedId);
  const selectedQualification = qualification.variants.find((item) => item.variantId === selectedId);
  const selectedLocal = localChecks.find((item) => item.variantId === selectedId);
  const allVariantsQualified = qualification.variants.every((item) => item.semanticEquivalent)
    && localChecks.every((item) => item.protectedFailures.length === 0);
  qualification.allVariantsQualified = allVariantsQualified;
  await save(join(outputDir, 'interpretation-qualification.json'), qualification);
  if (allVariantsQualified) {
    await save(join(outputDir, 'verified-observations.json'), {
      contractVersion: 'inspection_report_verified_observations_v1',
      status: 'qualified',
      evaluationOnly: true,
      case_id: truthCase.case_id,
      selectedVariantId: selectedId,
      targetReportTextIncluded: false,
      targetTruthIncluded: false,
      observations: selected.observations.map((item) => ({
        evidence_id: item.evidenceId,
        component_block: item.componentBlock,
        component_entity: item.componentEntity,
        inspection_side: item.inspectionSide,
        location: item.location,
        polarity: item.polarity,
        condition: item.condition,
        severity_or_extent: item.severityOrExtent,
        uncertainty: item.uncertainty,
        values_and_units: item.valuesAndUnits,
        source_capture_ids: item.sourceCaptureIds,
      })),
      qualification: selectedQualification,
      localProtectedChecks: selectedLocal,
    });
  }
  return { prepared: true, sent: true, requestCount: 1, allVariantsQualified,
    verifiedSnapshotCreated: allVariantsQualified };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const [mockExport, truthCase, bundle] = await Promise.all([
    readJson(args.mockExport), readJson(args.truthCase), readJson(args.bundle),
  ]);
  assert.equal(mockExport.case_id, truthCase.case_id);
  assert.equal(mockExport.knowledge_bundle_id, bundle.bundleId);
  if (args.run) assert.equal(getAiStatus().configured, true, getAiStatus().detail);
  const result = args.stage === 'interpret'
    ? await interpret({ mockExport, truthCase, bundle, outputDir: args.outputDir, run: args.run })
    : await qualify({ truthCase, bundle, outputDir: args.outputDir, run: args.run });
  console.log(JSON.stringify({ stage: args.stage, caseId: truthCase.case_id, ...result }, null, 2));
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) main().catch((error) => {
  console.error(JSON.stringify({ created: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
