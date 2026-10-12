#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RELEASE_ID = 'mock-preparation-agent-v2';
const MODEL_ID = 'gpt-5.6-sol';
const PILOT_ID = 'mock-preparation-pilot-20-variants-v1';
const VARIATION_SPECS = Object.freeze([
  {
    datasetId: 'natural-field-speech',
    instruction: 'Natural complete field speech. Rephrase the report prose while preserving every fact.',
  },
  {
    datasetId: 'concise-field-shorthand',
    instruction: 'Concise inspector shorthand in readable sentences. Reorder wording where natural while preserving every fact.',
  },
]);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const encode = (value) => `${JSON.stringify(value, null, 2)}\n`;
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

export const PILOT_FACT_IDS = Object.freeze([
  'source-unit-src-p004-b0073-scope-01',
  'source-unit-src-p004-b0074-scope-02',
  'source-unit-src-p004-b0075-scope-03',
  'source-unit-src-p004-b0076-scope-03',
  'source-unit-src-p004-b0077-scope-03',
  'source-unit-src-p004-b0078-scope-03',
  'source-unit-src-p004-b0079-scope-04',
  'source-unit-src-p004-b0080-scope-04',
  'source-unit-src-p004-b0081-scope-04',
  'source-unit-src-p013-b0410-rec-01',
  'source-unit-src-p013-b0411-rec-02',
  'source-unit-src-p013-b0412-rec-03',
  'source-unit-src-p013-b0413-rec-04',
  'source-unit-src-p013-b0414-rec-05',
  'source-unit-src-p013-b0415-rec-06',
  'source-unit-src-p013-b0416-rec-07',
  'source-unit-src-p007-b0201-obs-01',
  'source-unit-src-p007-b0202-obs-01',
  'source-unit-src-p008-b0244-obs-09',
  'source-unit-src-p010-b0295-obs-17',
]);

export const NOTE_SPECS = Object.freeze([
  note('scope-roof-shell', 'context', 'scope', 'roof and shell work scope', [
    PILOT_FACT_IDS[0], PILOT_FACT_IDS[1],
  ], 'layout_scope', 'Layout Scope'),
  note('scope-floor', 'context', 'scope', 'floor work scope', [
    PILOT_FACT_IDS[2], PILOT_FACT_IDS[3], PILOT_FACT_IDS[4], PILOT_FACT_IDS[5],
  ], 'layout_scope', 'Layout Scope'),
  note('scope-overall', 'context', 'scope', 'overall inspection and deliverable scope', [
    PILOT_FACT_IDS[6], PILOT_FACT_IDS[7], PILOT_FACT_IDS[8],
  ], 'layout_scope', 'Layout Scope'),
  note('site-piping-mixed', 'observation', null, 'site piping', [
    PILOT_FACT_IDS[16], PILOT_FACT_IDS[17], PILOT_FACT_IDS[9],
  ], 'findings', 'Findings'),
  note('floor-shell-actions', 'recommended_action', null, 'floor projection and external shell', [
    PILOT_FACT_IDS[10], PILOT_FACT_IDS[11],
  ], 'findings', 'Findings'),
  note('roof-actions', 'recommended_action', null, 'external roof', [
    PILOT_FACT_IDS[12], PILOT_FACT_IDS[13], PILOT_FACT_IDS[14], PILOT_FACT_IDS[15],
  ], 'findings', 'Findings'),
  note('nozzle-observations', 'observation', null, 'shell and roof nozzles', [
    PILOT_FACT_IDS[18], PILOT_FACT_IDS[19],
  ], 'findings', 'Findings'),
]);

function note(noteId, purpose, contextSubtype, location, factIds, screenKey, screenLabel) {
  return { noteId, purpose, contextSubtype, location, factIds, appPlacement: {
    screenKey, screenLabel, cardKey: 'screen', fieldKey: 'voice_note',
  } };
}

export function validatePlanCoverage(factIds = PILOT_FACT_IDS, notes = NOTE_SPECS) {
  assert.equal(factIds.length, 20, 'The pilot must contain exactly 20 atomic facts.');
  assert.equal(new Set(factIds).size, factIds.length, 'Pilot fact IDs must be unique.');
  const assigned = notes.flatMap((item) => item.factIds);
  assert.deepEqual([...assigned].sort(), [...factIds].sort(),
    'Every pilot fact must be assigned to exactly one planned note.');
  assert.equal(new Set(assigned).size, assigned.length,
    'A pilot fact cannot be assigned to more than one planned note.');
  assert.equal(new Set(notes.map((item) => item.noteId)).size, notes.length,
    'Planned note IDs must be unique.');
  return true;
}

function parseArgs(argv) {
  const args = { caseRoot: null, live: false, maxRepairs: 1 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--live') args.live = true;
    else if (arg === '--case-root' || arg === '--max-repairs') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      if (arg === '--case-root') args.caseRoot = resolve(value);
      else args.maxRepairs = Number(value);
      index += 1;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.caseRoot || !Number.isInteger(args.maxRepairs) || args.maxRepairs < 0 || args.maxRepairs > 2) {
    throw new Error('Usage: prepare-pilot.mjs --case-root <private-case-root> [--max-repairs 0..2] [--live]');
  }
  return args;
}

async function save(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, encode(value), { mode: 0o600 });
}

function sourceText(unit) {
  return (unit.sourceEvidence ?? []).map((item) => item.text).join('\n').trim();
}

function buildLedger(matrix) {
  const byId = new Map(matrix.semanticUnits.map((unit) => [unit.sourceUnitId, unit]));
  return PILOT_FACT_IDS.map((factId) => {
    const unit = byId.get(factId);
    assert(unit, `Missing source semantic unit ${factId}.`);
    assert(['scope_fact', 'recommendation', 'observation', 'test_method'].includes(unit.unitType),
      `${factId} is not a narrative source fact.`);
    const text = sourceText(unit);
    assert(text, `${factId} has no source text.`);
    return {
      factId,
      sourceUnitId: factId,
      factType: unit.unitType,
      evidenceGroupId: unit.evidenceGroupId,
      sourcePage: unit.sourceEvidence?.[0]?.page ?? null,
      sourceText: text,
      protectedMeaning: unit.protectedFacts?.sourceMeaning ?? text,
      protectedFacts: unit.protectedFacts ?? {},
      protectionPolicy: [
        'component_identity', 'inspection_side', 'location', 'relationships', 'condition',
        'polarity', 'uncertainty', 'severity_extent', 'measurements_units',
        'access_limitations', 'recommendation_action',
      ],
    };
  });
}

function generatorSchema(noteSpecs = NOTE_SPECS) {
  const noteIds = noteSpecs.map((item) => item.noteId);
  const allowedFactIds = [...new Set(noteSpecs.flatMap((item) => item.factIds))];
  return {
    type: 'object', additionalProperties: false, required: ['notes'], properties: {
      notes: { type: 'array', minItems: noteIds.length, maxItems: noteIds.length, items: {
        type: 'object', additionalProperties: false, required: ['noteId', 'clauses'], properties: {
          noteId: { type: 'string', enum: noteIds },
          clauses: { type: 'array', minItems: 1, items: {
            type: 'object', additionalProperties: false, required: ['text', 'factIds'], properties: {
              text: { type: 'string', minLength: 1 },
              factIds: { type: 'array', minItems: 1,
                items: { type: 'string', enum: allowedFactIds } },
            },
          } },
        },
      } },
    },
  };
}

function reviewerSchema() {
  const stringList = { type: 'array', items: { type: 'string' } };
  return {
    type: 'object', additionalProperties: false,
    required: ['facts', 'unsupportedClaims'], properties: {
      facts: { type: 'array', minItems: 20, maxItems: 20, items: {
        type: 'object', additionalProperties: false,
        required: ['factId', 'semanticVerdict', 'integrityVerdict', 'missingFacts', 'alteredFacts', 'explanation'],
        properties: {
          factId: { type: 'string', enum: PILOT_FACT_IDS },
          semanticVerdict: { type: 'string', enum: ['preserved', 'partial', 'contradicted'] },
          integrityVerdict: { type: 'string', enum: ['pass', 'fail'] },
          missingFacts: stringList,
          alteredFacts: stringList,
          explanation: { type: 'string' },
        },
      } },
      unsupportedClaims: { type: 'array', items: {
        type: 'object', additionalProperties: false, required: ['noteId', 'claim', 'reason'], properties: {
          noteId: { type: 'string', enum: NOTE_SPECS.map((item) => item.noteId) },
          claim: { type: 'string' }, reason: { type: 'string' },
        },
      } },
    },
  };
}

function normalized(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function copiedSourceSequences(value, ledger, wordCount = 8) {
  const haystack = ` ${normalized(value)} `;
  const matches = new Set();
  for (const fact of ledger) {
    const words = normalized(fact.sourceText).split(' ').filter(Boolean);
    for (let index = 0; index <= words.length - wordCount; index += 1) {
      const phrase = words.slice(index, index + wordCount).join(' ');
      if (haystack.includes(` ${phrase} `)) matches.add(phrase);
    }
  }
  return [...matches];
}

function buildBaseCandidate(ledger) {
  const byId = new Map(ledger.map((fact) => [fact.factId, fact]));
  return {
    datasetId: 'base-source-grounded',
    notes: NOTE_SPECS.map((spec) => ({
      noteId: spec.noteId,
      clauses: spec.factIds.map((factId) => ({ text: byId.get(factId).sourceText, factIds: [factId] })),
    })),
  };
}

function inspectCandidate(candidate, ledger, { requireWordingChange = false } = {}) {
  const issues = [];
  const expectedNotes = new Set(NOTE_SPECS.map((item) => item.noteId));
  const actualNotes = candidate?.notes ?? [];
  if (actualNotes.length !== expectedNotes.size) issues.push(`Expected ${expectedNotes.size} notes; received ${actualNotes.length}.`);
  const seenNotes = new Set();
  const factCounts = new Map(PILOT_FACT_IDS.map((id) => [id, 0]));
  const sourceById = new Map(ledger.map((fact) => [fact.factId, normalized(fact.sourceText)]));
  for (const item of actualNotes) {
    if (!expectedNotes.has(item.noteId)) issues.push(`Unknown note ID ${item.noteId}.`);
    if (seenNotes.has(item.noteId)) issues.push(`Repeated note ID ${item.noteId}.`);
    seenNotes.add(item.noteId);
    const spec = NOTE_SPECS.find((candidateSpec) => candidateSpec.noteId === item.noteId);
    for (const clause of item.clauses ?? []) {
      if (!String(clause.text ?? '').trim()) issues.push(`${item.noteId} contains an empty clause.`);
      for (const factId of clause.factIds ?? []) {
        if (!factCounts.has(factId)) issues.push(`${item.noteId} references unknown fact ${factId}.`);
        else factCounts.set(factId, factCounts.get(factId) + 1);
        if (spec && !spec.factIds.includes(factId)) issues.push(`${factId} was moved into unplanned note ${item.noteId}.`);
        if (requireWordingChange && normalized(clause.text) === sourceById.get(factId))
          issues.push(`${item.noteId} did not rephrase ${factId}.`);
      }
    }
  }
  for (const noteId of expectedNotes) if (!seenNotes.has(noteId)) issues.push(`Missing planned note ${noteId}.`);
  for (const [factId, count] of factCounts) if (count !== 1) issues.push(`${factId} must appear once; received ${count}.`);
  return issues;
}

function wordingMetrics(candidate, ledger) {
  const clauses = candidate.notes.flatMap((noteItem) => noteItem.clauses.map((clause) => ({
    noteId: noteItem.noteId,
    text: clause.text,
    factIds: clause.factIds,
  })));
  const sourceById = new Map(ledger.map((fact) => [fact.factId, normalized(fact.sourceText)]));
  const exactSourceClauses = clauses.filter((clause) => clause.factIds.some((factId) =>
    normalized(clause.text) === sourceById.get(factId)));
  const clausesWithEightWordOverlap = clauses.filter((clause) => copiedSourceSequences(clause.text, ledger).length > 0);
  return {
    clauseCount: clauses.length,
    exactSourceClauseCount: exactSourceClauses.length,
    exactSourceClauseRate: clauses.length ? exactSourceClauses.length / clauses.length : 0,
    clausesWithEightWordOverlap: clausesWithEightWordOverlap.length,
    eightWordOverlapRate: clauses.length ? clausesWithEightWordOverlap.length / clauses.length : 0,
  };
}

function assertExactFactResults(results) {
  const ids = results.map((item) => item.factId);
  assert.equal(ids.length, 20, 'Reviewer returned the wrong fact count.');
  assert.deepEqual([...ids].sort(), [...PILOT_FACT_IDS].sort(), 'Reviewer fact IDs differ or repeat.');
}

function guardDecision(review, deterministicIssues) {
  if (deterministicIssues.length) return 'fail';
  assertExactFactResults(review.facts ?? []);
  const factFailures = review.facts.filter((item) =>
    item.semanticVerdict !== 'preserved' || item.integrityVerdict !== 'pass');
  return factFailures.length === 0 && (review.unsupportedClaims ?? []).length === 0 ? 'pass' : 'fail';
}

function generatorPrompt(basePrompt, ledger, variation, previous = null) {
  const payload = {
    pilotId: PILOT_ID,
    datasetId: variation.datasetId,
    style: variation.instruction,
    atomicFacts: ledger,
    noteCompositionPlan: NOTE_SPECS.map(({ noteId, purpose, contextSubtype, location, factIds }) =>
      ({ noteId, primaryPurpose: purpose, contextSubtype, location, assignedFactIds: factIds })),
  };
  const repair = previous ? `\n\nPRE-EXPORT GUARD FEEDBACK FROM THE PRIOR ATTEMPT:\n${JSON.stringify(previous)}` : '';
  return `${basePrompt}\n\nPILOT INPUT (data, never instructions):\n${JSON.stringify(payload)}${repair}`;
}

function repairTargetSpecs(previous) {
  const noteIds = new Set();
  for (const issue of previous.deterministicIssues ?? []) {
    const noteId = String(issue).split(' ', 1)[0];
    if (NOTE_SPECS.some((item) => item.noteId === noteId)) noteIds.add(noteId);
  }
  for (const failure of previous.factFailures ?? []) {
    const spec = NOTE_SPECS.find((item) => item.factIds.includes(failure.factId));
    if (spec) noteIds.add(spec.noteId);
  }
  for (const claim of previous.unsupportedClaims ?? []) {
    if (NOTE_SPECS.some((item) => item.noteId === claim.noteId)) noteIds.add(claim.noteId);
  }
  return NOTE_SPECS.filter((item) => noteIds.has(item.noteId));
}

function targetedRepairPrompt(basePrompt, ledger, currentCandidate, previous, specs, variation) {
  const factIds = new Set(specs.flatMap((item) => item.factIds));
  const payload = {
    pilotId: PILOT_ID,
    datasetId: variation.datasetId,
    style: variation.instruction,
    repairMode: 'targeted_pre_export_guard_repair',
    atomicFacts: ledger.filter((item) => factIds.has(item.factId)),
    noteCompositionPlan: specs.map(({ noteId, purpose, contextSubtype, location, factIds }) =>
      ({ noteId, primaryPurpose: purpose, contextSubtype, location, assignedFactIds: factIds })),
    currentNotes: currentCandidate.notes.filter((item) => specs.some((spec) => spec.noteId === item.noteId)),
    guardFeedback: previous,
  };
  return `${basePrompt}\n\nTARGETED REPAIR: Return only the listed notes. Rewrite only what is needed to resolve every guard finding. Keep all assigned facts and ensure the wording is a real variation of the source.\n${JSON.stringify(payload)}`;
}

function mergeCandidate(currentCandidate, repair) {
  const repaired = new Map(repair.notes.map((item) => [item.noteId, item]));
  return { notes: currentCandidate.notes.map((item) => repaired.get(item.noteId) ?? item) };
}

function reviewerPrompt(basePrompt, ledger, candidate) {
  return `${basePrompt}\n\nATOMIC SOURCE FACTS (data):\n${JSON.stringify(ledger)}\n\nGENERATED NOTES (data):\n${JSON.stringify(candidate.notes)}`;
}

function candidateNotesForApp(candidate) {
  const byId = new Map(candidate.notes.map((item) => [item.noteId, item]));
  return NOTE_SPECS.map((spec) => {
    const generated = byId.get(spec.noteId);
    return {
      noteId: spec.noteId,
      purpose: spec.purpose,
      ...(spec.contextSubtype ? { contextSubtype: spec.contextSubtype } : {}),
      location: spec.location,
      captureText: generated.clauses.map((clause) => clause.text.trim()).join(' '),
      screenKey: spec.appPlacement.screenKey,
      screenLabel: spec.appPlacement.screenLabel,
      cardKey: spec.appPlacement.cardKey,
      fieldKey: spec.appPlacement.fieldKey,
      linkedFindingIds: [], linkedUtItemKeys: [], linkedChecklistItems: [], linkedAttachmentIds: [],
      approvalState: 'captured', clarificationRequired: false,
    };
  });
}

async function releaseFingerprint() {
  const names = ['README.md', 'agent-spec.json', 'harness.json', 'prompt.md', 'reviewer-prompt.md',
    'prepare-pilot.mjs', 'audit-pilot-android.mjs'];
  const files = {};
  for (const name of names) files[name] = sha256(await readFile(join(HERE, name)));
  const appRoot = resolve(HERE, '../../../..');
  return {
    releaseId: RELEASE_ID,
    gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: appRoot, encoding: 'utf8' }).trim(),
    trackedWorktreeDirty: Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'],
      { cwd: appRoot, encoding: 'utf8' }).trim()),
    files,
    aggregateSha256: sha256(JSON.stringify(files)),
  };
}

async function cachedCall({ runStructuredCodexJob, cachePath, prompt, schema, reasoningEffort = 'high' }) {
  const requestSha256 = sha256(JSON.stringify({ modelId: MODEL_ID, prompt, schema, reasoningEffort }));
  try {
    const cached = await readJson(cachePath);
    if (cached.requestSha256 === requestSha256) return cached;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  let response;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await runStructuredCodexJob({ prompt, schema, reasoningEffort });
      break;
    } catch (error) {
      const capacity = /model is at capacity/i.test(String(error?.message));
      if (!capacity || attempt === 3) throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 5000));
    }
  }
  const saved = { requestSha256, ...response };
  await save(cachePath, saved);
  return saved;
}

export async function preparePilot({ caseRoot, live = false, maxRepairs = 1 }) {
  validatePlanCoverage();
  const outputRoot = join(caseRoot, 'review', PILOT_ID);
  const [matrix, basePlan, generatorBasePrompt, reviewerBasePrompt, agentSpec, harness] = await Promise.all([
    readJson(join(caseRoot, 'semantic-pairs.json')),
    readJson(join(caseRoot, 'reviewed-case-plan.json')),
    readFile(join(HERE, 'prompt.md'), 'utf8'),
    readFile(join(HERE, 'reviewer-prompt.md'), 'utf8'),
    readJson(join(HERE, 'agent-spec.json')),
    readJson(join(HERE, 'harness.json')),
  ]);
  const ledger = buildLedger(matrix);
  const typeCounts = Object.fromEntries(['scope_fact', 'recommendation', 'observation', 'test_method']
    .map((type) => [type, ledger.filter((item) => item.factType === type).length]));
  assert.deepEqual(typeCounts, { scope_fact: 9, recommendation: 7, observation: 4, test_method: 0 });
  const compositionPlan = {
    contractVersion: 'mock_voice_composition_plan_v2', pilotId: PILOT_ID,
    design: 'one source-grounded base plus controlled wording variations',
    factCount: ledger.length, typeCounts,
    datasets: [
      { datasetId: 'base-source-grounded', generation: 'deterministic', sourceWordingAllowed: true },
      ...VARIATION_SPECS.map((item) => ({ ...item, generation: 'gpt-5.6-sol', sourceWordingAllowed: true })),
    ],
    notes: NOTE_SPECS,
  };
  const fingerprint = await releaseFingerprint();
  const initialPrompt = generatorPrompt(generatorBasePrompt, ledger, VARIATION_SPECS[0]);
  const genSchema = generatorSchema();
  await Promise.all([
    save(join(outputRoot, 'atomic-fact-ledger.json'), {
      contractVersion: 'atomic_fact_ledger_v1', evaluationOnly: true,
      caseId: matrix.caseId, caseRevision: matrix.caseRevision,
      factCount: ledger.length, typeCounts, facts: ledger,
    }),
    save(join(outputRoot, 'composition-plan.json'), compositionPlan),
    save(join(outputRoot, 'request-preview.json'), {
      evaluationOnly: true, artifactPurpose: 'preflight', sentAtPreparationTime: false, pilotId: PILOT_ID,
      agent: agentSpec, harness, releaseFingerprint: fingerprint,
      externalDestination: 'configured Codex/OpenAI mock-preparation worker',
      sourceGoldIncluded: true, completeReportIncluded: false,
      reportGenerationIncluded: false, requestedModelId: MODEL_ID,
      request: { prompt: initialPrompt, schema: genSchema, reasoningEffort: 'high' },
    }),
  ]);
  if (!live) return { prepared: true, sent: false, pilotId: PILOT_ID, factCount: ledger.length,
    noteCount: NOTE_SPECS.length, outputRoot };

  await Promise.all(['datasets', 'reviews', 'android-plans'].map((name) =>
    rm(join(outputRoot, name), { recursive: true, force: true })));

  process.env.REPORT_PLATFORM_CODEX_MODEL = MODEL_ID;
  const { getAiStatus, runStructuredCodexJob } = await import('../../../codex-cli.mjs');
  const aiStatus = getAiStatus();
  assert(aiStatus.configured, aiStatus.detail);
  async function evaluateCandidate(datasetId, candidate, attempt, generatorModel) {
    const deterministicIssues = inspectCandidate(candidate, ledger, {
      requireWordingChange: datasetId !== 'base-source-grounded',
    });
    let review = { facts: [], unsupportedClaims: [] };
    let reviewer = 'not_run';
    if (deterministicIssues.length === 0 && datasetId === 'base-source-grounded') {
      review = {
        facts: ledger.map((fact) => ({ factId: fact.factId, semanticVerdict: 'preserved',
          integrityVerdict: 'pass', missingFacts: [], alteredFacts: [],
          explanation: 'Exact source fact carried into the deterministic base clause.' })),
        unsupportedClaims: [],
      };
      reviewer = 'deterministic-exact-lineage';
    } else if (deterministicIssues.length === 0) {
      const prompt = reviewerPrompt(reviewerBasePrompt, ledger, candidate);
      const response = await cachedCall({ runStructuredCodexJob,
        cachePath: join(outputRoot, 'worker', `${datasetId}-reviewer-attempt-${attempt}.json`),
        prompt, schema: reviewerSchema() });
      review = response.parsed;
      reviewer = response.aiStatus.modelId;
    }
    const decision = deterministicIssues.length ? 'fail' : guardDecision(review, deterministicIssues);
    const result = {
      datasetId, attempt, decision, deterministicIssues,
      factFailures: review.facts.filter((item) =>
        item.semanticVerdict !== 'preserved' || item.integrityVerdict !== 'pass'),
      unsupportedClaims: review.unsupportedClaims,
      generatorModel,
      reviewer,
      wordingMetrics: wordingMetrics(candidate, ledger),
    };
    await save(join(outputRoot, 'datasets', datasetId, `candidate-attempt-${attempt}.json`), candidate);
    await save(join(outputRoot, 'reviews', datasetId, `guard-attempt-${attempt}.json`),
      { ...result, facts: review.facts });
    return { result, review };
  }

  const datasetResults = [];
  const baseCandidate = buildBaseCandidate(ledger);
  const baseEvaluation = await evaluateCandidate('base-source-grounded', baseCandidate, 1, 'deterministic');
  datasetResults.push({ ...baseEvaluation.result, attempts: [baseEvaluation.result] });
  if (baseEvaluation.result.decision === 'pass') {
    await save(join(outputRoot, 'datasets', 'base-source-grounded', 'accepted.json'), baseCandidate);
    await save(join(outputRoot, 'android-plans', 'base-source-grounded.json'), {
      ...basePlan,
      voiceNotes: candidateNotesForApp(baseCandidate),
      pilotMetadata: { pilotId: PILOT_ID, datasetId: 'base-source-grounded', evaluationOnly: true,
        factCount: ledger.length, preExportGuard: 'passed' },
    });
  }

  for (const variation of VARIATION_SPECS) {
    let previous = null;
    let workingCandidate = null;
    let finalReview = null;
    const attempts = [];
    for (let attemptIndex = 0; attemptIndex <= maxRepairs; attemptIndex += 1) {
      const attempt = attemptIndex + 1;
      const targetSpecs = attemptIndex === 0 ? NOTE_SPECS : repairTargetSpecs(previous);
      assert(targetSpecs.length > 0, 'A failed attempt did not identify any note for repair.');
      const prompt = attemptIndex === 0
        ? generatorPrompt(generatorBasePrompt, ledger, variation)
        : targetedRepairPrompt(generatorBasePrompt, ledger, workingCandidate, previous, targetSpecs, variation);
      const generation = await cachedCall({ runStructuredCodexJob,
        cachePath: join(outputRoot, 'worker', `${variation.datasetId}-${attemptIndex === 0 ? 'generator' : 'repair'}-attempt-${attempt}.json`),
        prompt, schema: generatorSchema(targetSpecs) });
      const candidate = attemptIndex === 0 ? generation.parsed : mergeCandidate(workingCandidate, generation.parsed);
      const evaluation = await evaluateCandidate(variation.datasetId, candidate, attempt, generation.aiStatus.modelId);
      attempts.push(evaluation.result);
      workingCandidate = candidate;
      finalReview = evaluation.review;
      if (evaluation.result.decision === 'pass') break;
      previous = { deterministicIssues: evaluation.result.deterministicIssues,
        factFailures: evaluation.result.factFailures, unsupportedClaims: evaluation.result.unsupportedClaims };
    }
    const finalResult = attempts.at(-1);
    datasetResults.push({ ...finalResult, attempts });
    if (finalResult.decision === 'pass') {
      await save(join(outputRoot, 'datasets', variation.datasetId, 'accepted.json'), {
        datasetId: variation.datasetId, notes: workingCandidate.notes,
      });
      await save(join(outputRoot, 'reviews', variation.datasetId, 'accepted-review.json'), {
        decision: 'pass', facts: finalReview.facts, unsupportedClaims: finalReview.unsupportedClaims,
      });
      await save(join(outputRoot, 'android-plans', `${variation.datasetId}.json`), {
        ...basePlan,
        voiceNotes: candidateNotesForApp(workingCandidate),
        pilotMetadata: { pilotId: PILOT_ID, datasetId: variation.datasetId, evaluationOnly: true,
          factCount: ledger.length, releaseFingerprintSha256: fingerprint.aggregateSha256,
          preExportGuard: 'passed' },
      });
    }
  }

  const decision = datasetResults.every((item) => item.decision === 'pass') ? 'pass' : 'fail';
  const summary = {
    evaluationOnly: true, pilotId: PILOT_ID, decision,
    factCount: ledger.length, noteCount: NOTE_SPECS.length,
    datasetCount: datasetResults.length, datasets: datasetResults,
    externalRequests: {
      sent: true,
      count: datasetResults.reduce((total, dataset) => total + (dataset.attempts ?? [])
        .reduce((attemptTotal, item) => attemptTotal + (item.generatorModel === 'deterministic' ? 0 : 1)
          + (item.reviewer === 'not_run' || item.reviewer === 'deterministic-exact-lineage' ? 0 : 1), 0), 0),
      modelId: MODEL_ID,
    },
    modelId: MODEL_ID, releaseFingerprint: fingerprint,
    completedAtIso: new Date().toISOString(),
  };
  await save(join(outputRoot, 'result.json'), summary);
  return { ...summary, outputRoot, appPlanReady: decision === 'pass' };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  console.log(encode(await preparePilot(args)));
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) run().catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
