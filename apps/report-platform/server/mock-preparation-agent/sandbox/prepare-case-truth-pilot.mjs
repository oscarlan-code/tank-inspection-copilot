#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SPEC_CONTRACT = 'mock_preparation_truth_pilot_spec_v1';
const GOLD_CONTRACT = 'mock_preparation_gold_review_v1';
const MATRIX_CONTRACT = 'source_mock_semantic_matrix_v1';
const encode = (value) => `${JSON.stringify(value, null, 2)}\n`;
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const readJsonLines = async (path) => (await readFile(path, 'utf8')).split(/\r?\n/)
  .filter(Boolean).map((line) => JSON.parse(line));

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function pageOf(block) {
  return block.sourceSpans?.find((span) => Number.isInteger(span.pageNumber))?.pageNumber ?? null;
}

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').replace(/^\s*/, '');
}

function parseArgs(argv) {
  const args = { caseRoot: null, spec: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!['--case-root', '--spec'].includes(arg)) throw new Error(`Unknown argument: ${arg}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
    args[arg === '--case-root' ? 'caseRoot' : 'spec'] = resolve(value);
    index += 1;
  }
  if (!args.caseRoot || !args.spec) {
    throw new Error('Usage: prepare-case-truth-pilot.mjs --case-root <case> --spec <truth-pilot-spec.json>');
  }
  return args;
}

async function save(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, encode(value), { mode: 0o600 });
}

function excludedBlockIds(review) {
  return new Set((review.pageDecisions ?? []).flatMap((page) => page.excludedSourceBlockIds ?? []));
}

export function buildTruthPilot({ caseRecord, sourceBlocks, semanticReview, spec }) {
  assert.equal(spec.contractVersion, SPEC_CONTRACT, `Spec must use ${SPEC_CONTRACT}.`);
  assert.equal(spec.caseId, caseRecord.caseId, 'Spec caseId does not match case.json.');
  assert.equal(spec.caseRevision, caseRecord.caseRevision, 'Spec caseRevision does not match case.json.');
  assert.equal(semanticReview.decision, 'pass', 'Source semantic-integrity review must pass.');
  assert.equal(semanticReview.caseId, caseRecord.caseId, 'Source review caseId does not match case.json.');
  assert.equal(semanticReview.sourceSha256, caseRecord.source.sourceSha256,
    'Source review hash does not match case.json.');
  assert(Array.isArray(spec.facts) && spec.facts.length > 0, 'Pilot spec has no facts.');
  assert(Array.isArray(spec.notes) && spec.notes.length > 0, 'Pilot spec has no notes.');

  const blockById = new Map(sourceBlocks.map((block) => [block.sourceBlockId, block]));
  const excluded = excludedBlockIds(semanticReview);
  const factIds = spec.facts.map((item) => item.factId);
  assert.equal(new Set(factIds).size, factIds.length, 'Pilot fact IDs repeat.');
  const noteIds = spec.notes.map((item) => item.noteId);
  assert.equal(new Set(noteIds).size, noteIds.length, 'Pilot note IDs repeat.');

  const facts = spec.facts.map((item) => {
    const block = blockById.get(item.sourceBlockId);
    assert(block, `Unknown source block ${item.sourceBlockId}.`);
    assert(!excluded.has(item.sourceBlockId), `Source block ${item.sourceBlockId} is excluded by source review.`);
    const sourceText = normalizeText(block.text);
    assert(sourceText, `Source block ${item.sourceBlockId} has no text.`);
    assert(noteIds.includes(item.noteId), `Fact ${item.factId} references unknown note ${item.noteId}.`);
    return {
      factId: item.factId,
      sourceUnitIds: [item.factId],
      factType: item.factType,
      evidenceGroupId: item.noteId,
      noteId: item.noteId,
      sourcePage: pageOf(block),
      sourceText,
      protectedMeaning: item.protectedMeaning ?? sourceText,
      protectedFacts: { sourceMeaning: item.protectedMeaning ?? sourceText, ...(item.protectedFacts ?? {}) },
      sourceEvidence: [{ sourceId: item.sourceBlockId, sourceBlockId: item.sourceBlockId,
        page: pageOf(block), text: block.text }],
      preparation: 'reviewed_atomic_pilot_proposal',
    };
  });

  const notes = spec.notes.map((note) => ({
    noteId: note.noteId,
    purpose: note.purpose,
    ...(note.contextSubtype ? { contextSubtype: note.contextSubtype } : {}),
    location: note.location,
    appPlacement: note.appPlacement,
    factIds: facts.filter((fact) => fact.noteId === note.noteId).map((fact) => fact.factId),
  }));
  const assigned = notes.flatMap((note) => note.factIds);
  assert.deepEqual([...assigned].sort(), [...factIds].sort(), 'Every pilot fact must be assigned exactly once.');
  assert.equal(new Set(assigned).size, assigned.length, 'A pilot fact is assigned to multiple notes.');
  assert(notes.every((note) => note.factIds.length > 0 && note.factIds.length <= 20),
    'Every note must contain between 1 and 20 facts.');

  const binding = {
    caseId: caseRecord.caseId,
    caseRevision: caseRecord.caseRevision,
    sourceSemanticRequestSha256: semanticReview.requestSha256,
    sourceSemanticExcludedBlockIds: [...excluded].sort(),
    sourceMatrixStatus: 'human_review_pending',
    facts,
    notes,
  };
  const gold = {
    contractVersion: GOLD_CONTRACT,
    evaluationOnly: true,
    caseId: caseRecord.caseId,
    caseRevision: caseRecord.caseRevision,
    sourceSemanticRequestSha256: semanticReview.requestSha256,
    sourceSemanticExcludedBlockCount: excluded.size,
    status: 'human_review_pending',
    sourceMatrixStatus: 'human_review_pending',
    goldSha256: sha256Json(binding),
    summary: {
      eligibleSourceUnitCount: facts.length,
      atomicFactCount: facts.length,
      noteCount: notes.length,
      factTypeCounts: Object.fromEntries([...new Set(facts.map((fact) => fact.factType))]
        .sort().map((type) => [type, facts.filter((fact) => fact.factType === type).length])),
      issueCount: 0,
    },
    reviewInstructions: [
      'Confirm each original report unit is atomic and correctly transcribed.',
      'Confirm every measurement, unit, component, location, condition and recommendation is protected.',
      'Confirm each unit is assigned to an app note where an inspector could practically record it.',
    ],
    facts,
    notes,
    issues: [],
  };

  const semanticUnits = facts.map((fact) => ({
    sourceUnitId: fact.factId,
    semanticKey: `${fact.factType}.${fact.factId}`,
    unitType: fact.factType,
    criticality: 'required',
    appCapability: 'capturable',
    evaluationMode: 'semantic',
    evidenceGroupId: fact.noteId,
    sourceObligationIds: [fact.sourceEvidence[0].sourceId],
    sourceEvidence: fact.sourceEvidence,
    protectedFacts: fact.protectedFacts,
    sourceGroundingReview: 'human_review_pending',
  }));
  const matrix = {
    contractVersion: MATRIX_CONTRACT,
    caseId: caseRecord.caseId,
    caseRevision: caseRecord.caseRevision,
    status: 'human_review_pending',
    denominatorPolicy: 'one reviewed atomic fact is one semantic unit',
    goldNormalizationPolicy: 'source wording may be normalized only with explicit reviewed protected facts',
    reviewPolicy: { humanApprovalRequiredBeforeLiveGeneration: true },
    llmReview: { status: 'not_run' },
    summary: { semanticUnitCount: semanticUnits.length, variantCount: 0, rowCount: 0 },
    semanticUnits,
    variants: [],
    unmappedSourceObligationIds: [],
  };
  const voiceNotes = notes.map((note) => ({
    noteId: note.noteId,
    purpose: note.purpose,
    ...(note.contextSubtype ? { contextSubtype: note.contextSubtype } : {}),
    location: note.location,
    captureText: facts.filter((fact) => note.factIds.includes(fact.factId)).map((fact) => fact.sourceText).join(' '),
    screenKey: note.appPlacement.screenKey,
    screenLabel: note.appPlacement.screenLabel,
    cardKey: note.appPlacement.cardKey,
    fieldKey: note.appPlacement.fieldKey,
    linkedFindingIds: [], linkedUtItemKeys: [], linkedChecklistItems: [], linkedAttachmentIds: [],
    approvalState: 'captured', clarificationRequired: false,
  }));
  const plan = {
    packageType: 'laiq_report_mock_reviewed_plan',
    schemaVersion: 1,
    evaluationOnly: true,
    caseId: caseRecord.caseId,
    caseRevision: caseRecord.caseRevision,
    status: 'pilot_truth_pending_human_review',
    sourceSha256: caseRecord.source.sourceSha256,
    voiceNotes,
  };
  return { gold, matrix, plan };
}

export async function prepareTruthPilot({ caseRoot, specPath }) {
  const [caseRecord, sourceBlocks, semanticReview, spec] = await Promise.all([
    readJson(join(caseRoot, 'case.json')),
    readJsonLines(join(caseRoot, 'source-blocks.jsonl')),
    readJson(join(caseRoot, 'review', 'source-semantic-integrity-review.json')),
    readJson(specPath),
  ]);
  const result = buildTruthPilot({ caseRecord, sourceBlocks, semanticReview, spec });
  await Promise.all([
    save(join(caseRoot, 'review', 'mock-preparation-gold-review.json'), result.gold),
    save(join(caseRoot, 'semantic-pairs.json'), result.matrix),
    save(join(caseRoot, 'reviewed-case-plan.json'), result.plan),
  ]);
  return {
    caseId: caseRecord.caseId,
    status: result.gold.status,
    goldSha256: result.gold.goldSha256,
    factCount: result.gold.facts.length,
    noteCount: result.gold.notes.length,
    outputs: {
      gold: join(caseRoot, 'review', 'mock-preparation-gold-review.json'),
      matrix: join(caseRoot, 'semantic-pairs.json'),
      plan: join(caseRoot, 'reviewed-case-plan.json'),
    },
  };
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) {
  const args = parseArgs(process.argv.slice(2));
  prepareTruthPilot({ caseRoot: args.caseRoot, specPath: args.spec })
    .then((result) => process.stdout.write(encode(result)))
    .catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
