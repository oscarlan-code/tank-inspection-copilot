#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAiStatus, runStructuredCodexJob } from '../../../codex-cli.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(root, '../../../..');
const outputRoot = resolve(appRoot, '.local/section-agent-evaluations/inspection-report-full-section-v2');
const bundlePath = resolve(appRoot, '.local/section-pattern-packs/vertical-tank-common-core-v1/04-inspection-report/knowledge-bundle.frozen.json');
const encode = (value) => JSON.stringify(value, null, 2) + '\n';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const readJson = (path) => readFile(path, 'utf8').then(JSON.parse);
const controls = await readJson(join(root, 'controls.json'));
const [generatorInstructions, reviewerInstructions, evaluatorInstructions, bundleRaw] = await Promise.all([
  readFile(join(root, 'candidate-a-generator.md'), 'utf8'),
  readFile(join(root, 'pre-display-reviewer.md'), 'utf8'),
  readFile(join(root, 'post-generation-evaluator.md'), 'utf8'),
  readFile(bundlePath, 'utf8'),
]);
const bundle = JSON.parse(bundleRaw);
const modes = new Set(process.argv.slice(2));

const stringField = { type: 'string' };
const stringArray = { type: 'array', items: stringField };
const numberField = { type: 'number', minimum: 0, maximum: 1 };

function compactProjection(role) {
  const projection = structuredClone(bundle.roleProjections[role]);
  if (projection.canonicalBlockCatalog) {
    projection.canonicalBlockCatalog = projection.canonicalBlockCatalog.map((item) => ({
      blockId: item.blockId,
      order: item.order,
      applicability: item.applicability,
      variability: item.variability,
      preferredDisplayHeading: item.preferredDisplayHeading,
      acceptedDisplayHeadings: item.acceptedDisplayHeadings,
      allowedFormatFamilyIds: item.allowedFormatFamilyIds,
    }));
  }
  return projection;
}

function generationSchema(plan, truth) {
  const narrativeBlocks = plan.blocks.filter((block) => block.ownership !== 'deterministic_compiler');
  const evidenceIds = truth.evidence_records.map((record) => record.evidence_id);
  return {
    type: 'object', additionalProperties: false, required: ['sectionTitle', 'blocks'], properties: {
      sectionTitle: { type: 'string', enum: [controls.sectionTitle] },
      blocks: { type: 'array', minItems: narrativeBlocks.length, maxItems: narrativeBlocks.length,
        items: { type: 'object', additionalProperties: false,
          required: ['blockId', 'heading', 'formatFamilyId', 'claims'], properties: {
            blockId: { type: 'string', enum: narrativeBlocks.map((block) => block.blockId) },
            heading: stringField,
            formatFamilyId: stringField,
            claims: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false,
              required: ['evidenceId', 'text'], properties: {
                evidenceId: { type: 'string', enum: evidenceIds }, text: stringField,
              } } },
          } },
      },
    },
  };
}

const reviewerSchema = {
  type: 'object', additionalProperties: false,
  required: ['outcome', 'requiredEvidenceRecall', 'supportedClaimPrecision',
    'protectedFactAccuracy', 'structureFormatConformance', 'findings'],
  properties: {
    outcome: { type: 'string', enum: ['blocked', 'needs_attention', 'ready_for_inspector_review'] },
    requiredEvidenceRecall: numberField,
    supportedClaimPrecision: numberField,
    protectedFactAccuracy: numberField,
    structureFormatConformance: numberField,
    findings: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['severity', 'failureClass', 'evidenceIds', 'detail'], properties: {
        severity: { type: 'string', enum: ['blocker', 'warning', 'note'] },
        failureClass: stringField, evidenceIds: stringArray, detail: stringField,
      } } },
  },
};

const evaluatorSchema = {
  type: 'object', additionalProperties: false,
  required: ['currentEvidenceFidelity', 'genericKbPatternConformance', 'targetMeaningRecovery',
    'targetFormatSimilarity', 'acceptedNonTargetVariation', 'leakageFindings', 'failures'],
  properties: {
    currentEvidenceFidelity: numberField,
    genericKbPatternConformance: numberField,
    targetMeaningRecovery: numberField,
    targetFormatSimilarity: numberField,
    acceptedNonTargetVariation: { type: 'array', items: stringField },
    leakageFindings: { type: 'array', items: stringField },
    failures: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['failureClass', 'rootCauseStage', 'sourceObligationIds', 'detail'], properties: {
        failureClass: stringField,
        rootCauseStage: { type: 'string', enum: ['source_inventory', 'truth_normalization',
          'mock_preparation', 'interpretation', 'report_planning', 'generation',
          'pre_display_review', 'deterministic_compiler', 'none'] },
        sourceObligationIds: stringArray, detail: stringField,
      } } },
  },
};

async function caseData(caseId) {
  const caseRoot = join(outputRoot, caseId);
  const [truth, plan, inventory, verified] = await Promise.all([
    readJson(join(caseRoot, 'truth-case.json')),
    readJson(join(caseRoot, 'report-plan.json')),
    readJson(join(caseRoot, 'source-obligation-inventory.reviewed.json')),
    readJson(join(caseRoot, 'verified-observations.json')),
  ]);
  assert.equal(truth.case_id, caseId);
  assert.equal(plan.caseId, caseId);
  assert.equal(plan.targetGoldStructureUsed, false);
  assert.equal(verified.case_id, caseId);
  assert.equal(verified.status, 'qualified');
  assert.equal(verified.targetReportTextIncluded, false);
  return { caseId, caseRoot, truth, plan, inventory, verified };
}

function generationRequest(data, run) {
  const evidence = data.verified.observations.map((record) => ({
    evidenceId: record.evidence_id,
    componentBlock: record.component_block,
    componentEntity: record.component_entity,
    inspectionSide: record.inspection_side,
    location: record.location,
    polarity: record.polarity,
    condition: record.condition,
    severityOrExtent: record.severity_or_extent,
    uncertainty: record.uncertainty,
    valuesAndUnits: record.values_and_units,
    crossReferences: (record.cross_references ?? []).filter((item) => item.asset_status === 'resolved'),
  }));
  const prompt = `${generatorInstructions}\n\nFROZEN GENERATION PROJECTION:\n${JSON.stringify(compactProjection('sectionGenerator'))}\n\nTARGET-BLIND REPORT PLAN:\n${JSON.stringify(data.plan)}\n\nREVIEWED CURRENT EVIDENCE:\n${JSON.stringify(evidence)}\n\nReturn JSON only. This is repeat ${run}; the rules and inputs are unchanged.`;
  return { requestId: `${data.caseId}-candidate-a-run-${run}`, prompt,
    schema: generationSchema(data.plan, data.truth) };
}

function compileDeterministicAssessment(data) {
  const groups = [];
  for (const componentBlock of [...new Set(data.truth.deterministic_inputs.map((item) => item.component_block))]) {
    groups.push({
      componentBlock,
      items: data.truth.deterministic_inputs.filter((item) => item.component_block === componentBlock)
        .map((item) => ({
          deterministicInputId: item.deterministic_input_id,
          summaryLabel: item.summary_label,
          inputType: item.input_type,
          normalizedData: item.normalized_data,
          compilerStatus: item.requires_deterministic_compiler
            && item.normalized_data.some((value) => /not stated/i.test(value))
            ? 'pending_missing_input' : 'compiled_without_inference',
        })),
    });
  }
  return groups;
}

function localReview(data, output) {
  const expected = new Map(data.verified.observations.map((record) => [record.evidence_id, record]));
  const planned = new Map(data.plan.blocks.map((block) => [block.blockId, block]));
  const seen = [];
  const failures = [];
  if (output.sectionTitle !== controls.sectionTitle) failures.push({ failureClass: 'wrong_title' });
  for (const block of output.blocks ?? []) {
    const planBlock = planned.get(block.blockId);
    if (!planBlock) failures.push({ failureClass: 'unplanned_block', blockId: block.blockId });
    else {
      if (block.heading !== planBlock.displayHeading) failures.push({ failureClass: 'wrong_heading', blockId: block.blockId });
      if (block.formatFamilyId !== planBlock.formatFamilyId) failures.push({ failureClass: 'wrong_format', blockId: block.blockId });
    }
    for (const claim of block.claims ?? []) {
      seen.push(claim.evidenceId);
      const record = expected.get(claim.evidenceId);
      if (!record) { failures.push({ failureClass: 'unsupported_evidence_id', evidenceId: claim.evidenceId }); continue; }
      if (record.component_block !== block.blockId) failures.push({ failureClass: 'wrong_component_block', evidenceId: claim.evidenceId });
      for (const value of record.values_and_units) {
        if (!claim.text.toLowerCase().includes(value.toLowerCase())) {
          failures.push({ failureClass: 'protected_value_missing', evidenceId: claim.evidenceId, value });
        }
      }
    }
  }
  for (const evidenceId of expected.keys()) {
    const count = seen.filter((value) => value === evidenceId).length;
    if (count === 0) failures.push({ failureClass: 'missing_evidence', evidenceId });
    if (count > 1) failures.push({ failureClass: 'duplicate_evidence', evidenceId });
  }
  const expectedNarrativeBlocks = data.plan.blocks.filter((block) => block.ownership !== 'deterministic_compiler')
    .map((block) => block.blockId);
  if (JSON.stringify(output.blocks.map((block) => block.blockId)) !== JSON.stringify(expectedNarrativeBlocks)) {
    failures.push({ failureClass: 'block_order_or_membership' });
  }
  return {
    passed: failures.length === 0,
    evidenceRecall: new Set(seen.filter((id) => expected.has(id))).size / expected.size,
    supportedIdPrecision: seen.length ? seen.filter((id) => expected.has(id)).length / seen.length : 0,
    failures,
  };
}

async function cachedWorker({ path, request }) {
  const requestSha256 = sha256(JSON.stringify({ prompt: request.prompt, schema: request.schema }));
  try {
    const cached = await readJson(path);
    assert.equal(cached.requestSha256, requestSha256, 'Cached response does not match the current request');
    return cached;
  } catch {
    const worker = await runStructuredCodexJob({ prompt: request.prompt, schema: request.schema,
      reasoningEffort: controls.reasoningEffort, timeoutMs: 240000 });
    const result = { requestSha256, ...worker };
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, encode(result), { mode: 0o600 });
    return result;
  }
}

async function prepare() {
  const previews = [];
  for (const caseId of controls.calibrationCases) {
    let data;
    try { data = await caseData(caseId); }
    catch (error) {
      const blocked = { contractVersion: 'inspection_report_candidate_a_generation_preview_v1',
        evaluationOnly: true, caseId, requestCount: 0,
        status: 'blocked_pending_qualified_interpretation', reason: error.message,
        targetReportTextIncluded: false, productPromotion: false };
      const caseRoot = join(outputRoot, caseId);
      await writeFile(join(caseRoot, 'candidate-a-generation-request-preview.json'), encode(blocked), { mode: 0o600 });
      previews.push(blocked);
      continue;
    }
    const requests = Array.from({ length: controls.generatorRepeatsPerCase }, (_, index) =>
      generationRequest(data, index + 1));
    const preview = {
      contractVersion: 'inspection_report_candidate_a_generation_preview_v1',
      evaluationOnly: true,
      caseId,
      externalDestination: 'configured Codex/OpenAI report-generation worker',
      requestCount: requests.length,
      targetReportTextIncluded: false,
      targetGoldStructureIncluded: false,
      input: 'qualified interpreted app evidence, target-blind ReportPlan and frozen generation projection',
      requests,
    };
    await writeFile(join(data.caseRoot, 'candidate-a-generation-request-preview.json'), encode(preview), { mode: 0o600 });
    previews.push({ caseId, requestCount: requests.length,
      path: join(data.caseRoot, 'candidate-a-generation-request-preview.json') });
  }
  return previews;
}

async function generate() {
  const ai = getAiStatus();
  assert.equal(ai.configured, true, ai.detail);
  assert.equal(ai.modelId, controls.model);
  const results = [];
  for (const caseId of controls.calibrationCases) {
    const data = await caseData(caseId);
    const runs = [];
    for (let run = 1; run <= controls.generatorRepeatsPerCase; run += 1) {
      const request = generationRequest(data, run);
      const response = await cachedWorker({
        path: join(data.caseRoot, 'worker', `candidate-a-generation-${run}.json`), request,
      });
      const local = localReview(data, response.parsed);
      runs.push({ run, requestSha256: response.requestSha256, modelId: response.aiStatus.modelId,
        narrative: response.parsed, deterministicAssessment: compileDeterministicAssessment(data), localReview: local });
    }
    const result = { contractVersion: 'inspection_report_candidate_a_generation_result_v1',
      evaluationOnly: true, caseId, candidate: 'A', knowledgeBundleId: bundle.bundleId,
      knowledgeBundleSha256: sha256(bundleRaw), generationProjectionId: bundle.roleProjections.sectionGenerator.projectionId,
      reportPlanSha256: data.plan.reportPlanSha256, targetGoldAvailableToGenerator: false,
      promotionPerformed: false, runs };
    await writeFile(join(data.caseRoot, 'candidate-a-generation.json'), encode(result), { mode: 0o600 });
    results.push(result);
  }
  return results;
}

function reviewerRequest(data, generation, run) {
  const prompt = `${reviewerInstructions}\n\nFROZEN REVIEW PROJECTION:\n${JSON.stringify(compactProjection('preDisplayReviewer'))}\n\nTARGET-BLIND REPORT PLAN:\n${JSON.stringify(data.plan)}\n\nCURRENT EVIDENCE:\n${JSON.stringify(data.verified.observations)}\n\nDETERMINISTIC INPUTS:\n${JSON.stringify(data.truth.deterministic_inputs)}\n\nCANDIDATE OUTPUT:\n${JSON.stringify(run)}\n\nReturn JSON only.`;
  return { requestId: `${data.caseId}-candidate-a-review-${run.run}`, prompt, schema: reviewerSchema };
}

async function review() {
  const ai = getAiStatus();
  assert.equal(ai.configured, true, ai.detail);
  const results = [];
  for (const caseId of controls.calibrationCases) {
    const data = await caseData(caseId);
    const generation = await readJson(join(data.caseRoot, 'candidate-a-generation.json'));
    const runs = [];
    for (const run of generation.runs) {
      const request = reviewerRequest(data, generation, run);
      const response = await cachedWorker({
        path: join(data.caseRoot, 'worker', `candidate-a-review-${run.run}.json`), request,
      });
      runs.push({ run: run.run, localReview: run.localReview, independentReview: response.parsed,
        requestSha256: response.requestSha256, modelId: response.aiStatus.modelId });
    }
    const result = { contractVersion: 'inspection_report_candidate_a_pre_display_review_v1',
      evaluationOnly: true, caseId, targetGoldAvailableToReviewer: false,
      reviewProjectionId: bundle.roleProjections.preDisplayReviewer.projectionId,
      promotionPerformed: false, runs };
    await writeFile(join(data.caseRoot, 'candidate-a-review.json'), encode(result), { mode: 0o600 });
    results.push(result);
  }
  return results;
}

function evaluatorRequest(data, generation, reviews, run) {
  const gold = {
    sourceUnits: data.inventory.sourceUnits.map((unit) => ({
      sourceUnitId: unit.sourceUnitId,
      componentBlockId: unit.componentBlockId,
      disposition: unit.reviewedDisposition,
      sourceText: unit.sourceText,
      pageNumbers: unit.pageNumbers,
    })),
    targetStructureReference: data.inventory.goldStructureReference,
  };
  const review = reviews.runs.find((item) => item.run === run.run);
  const prompt = `${evaluatorInstructions}\n\nFROZEN EVALUATION PROJECTION:\n${JSON.stringify(compactProjection('postGenerationEvaluator'))}\n\nREVIEWED CURRENT TRUTH:\n${JSON.stringify(data.truth)}\n\nSEALED TARGET GOLD OPENED AFTER GENERATION:\n${JSON.stringify(gold)}\n\nTARGET-BLIND REPORT PLAN:\n${JSON.stringify(data.plan)}\n\nCANDIDATE OUTPUT:\n${JSON.stringify(run)}\n\nPRE-DISPLAY REVIEW:\n${JSON.stringify(review)}\n\nReturn JSON only.`;
  return { requestId: `${data.caseId}-candidate-a-evaluation-${run.run}`, prompt, schema: evaluatorSchema };
}

async function evaluate() {
  const ai = getAiStatus();
  assert.equal(ai.configured, true, ai.detail);
  const results = [];
  for (const caseId of controls.calibrationCases) {
    const data = await caseData(caseId);
    const [generation, reviews] = await Promise.all([
      readJson(join(data.caseRoot, 'candidate-a-generation.json')),
      readJson(join(data.caseRoot, 'candidate-a-review.json')),
    ]);
    const runs = [];
    for (const run of generation.runs) {
      const request = evaluatorRequest(data, generation, reviews, run);
      const response = await cachedWorker({
        path: join(data.caseRoot, 'worker', `candidate-a-evaluation-${run.run}.json`), request,
      });
      runs.push({ run: run.run, evaluation: response.parsed,
        requestSha256: response.requestSha256, modelId: response.aiStatus.modelId });
    }
    const result = { contractVersion: 'inspection_report_candidate_a_gold_evaluation_v1',
      evaluationOnly: true, caseId, goldOpenedAfterGeneration: true,
      evaluationProjectionId: bundle.roleProjections.postGenerationEvaluator.projectionId,
      promotionPerformed: false, runs };
    await writeFile(join(data.caseRoot, 'candidate-a-evaluation.json'), encode(result), { mode: 0o600 });
    results.push(result);
  }
  return results;
}

async function main() {
  assert.equal(controls.productEnabled, false);
  assert.equal(bundle.status, 'frozen');
  const prepared = await prepare();
  const summary = { mode: 'prepare', prepared, externalRequestsSent: 0, productPromotion: false };
  if (modes.has('--run-generation') || modes.has('--run-all')) {
    summary.mode = 'generation'; summary.generations = (await generate()).length;
  }
  if (modes.has('--run-review') || modes.has('--run-all')) {
    summary.mode = 'review'; summary.reviews = (await review()).length;
  }
  if (modes.has('--run-evaluation') || modes.has('--run-all')) {
    summary.mode = 'evaluation'; summary.evaluations = (await evaluate()).length;
  }
  console.log(JSON.stringify(summary, null, 2));
}

await main().catch((error) => {
  console.error(JSON.stringify({ passed: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
