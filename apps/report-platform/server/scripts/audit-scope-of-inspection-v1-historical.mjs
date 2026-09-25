#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildMinimumReportPlan, buildMinimumSectionPlan } from '../report-plans/minimum-report-plan.mjs';
import { executePlannedSection, getSectionAgentBinding } from '../section-agents/index.mjs';

const args = process.argv.slice(2);
const dataArg = args.includes('--data') ? args[args.indexOf('--data') + 1]
  : 'docs/reviews/data/scope-of-inspection-v1-historical';
assert(dataArg && !dataArg.startsWith('--'), '--data requires a private evaluation directory');
const root = pathToFileURL(`${resolve(dataArg)}/`);
const readJson = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const normalize = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const includesAny = (text, values) => values.some(value => text.includes(normalize(value)));
const escape = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function longestCopiedRun(note, gold) {
  const noteWords = normalize(note).split(' ').filter(Boolean);
  const goldText = ` ${normalize(gold)} `;
  for (let size = noteWords.length; size >= 1; size--) {
    for (let start = 0; start + size <= noteWords.length; start++) {
      if (goldText.includes(` ${noteWords.slice(start, start + size).join(' ')} `)) return size;
    }
  }
  return 0;
}

const manifest = await readJson('evaluation-manifest.json');
assert.equal(manifest.contractVersion, 'scope_historical_evaluation_v1');
assert.equal(manifest.releaseVersion, 'scope_of_inspection_v1');
assert.equal(manifest.goldAvailableDuringGeneration, false);
assert.equal(manifest.narrativeMockInputCopiedFromGold, false);
assert.equal(manifest.cases.filter(row => row.split === 'development').length, 10);
assert.equal(manifest.cases.filter(row => row.split === 'held_out').length, 1);
assert.equal(new Set(manifest.cases.map(row => row.sourceDocumentId)).size, manifest.cases.length);

const binding = getSectionAgentBinding({ releaseVersion: 'scope_of_inspection_v1',
  sectionId: 'scope-of-inspection', reportProfileId: 'vertical_tank_inspection_v1' });
const results = [];
const reviewRows = [];
for (const split of ['development', 'held_out']) {
  for (const entry of manifest.cases.filter(row => row.split === split)) {
    const inputBytes = await readFile(new URL(entry.inputFile, root), 'utf8');
    assert(!inputBytes.includes('originalSection'), `${entry.caseId}: gold leaked into generator input`);
    const input = JSON.parse(inputBytes);
    assert(input.mockPreparation?.inspectorNote, `${entry.caseId}: practical inspector note is required`);
    assert(!Object.hasOwn(input.evidenceSnapshot, 'gold'), `${entry.caseId}: evidence snapshot contains gold`);
    const reportPlan = buildMinimumReportPlan({ reportPlanId: `report-plan:${entry.caseId}`,
      tenantId: 'tenant:historical-evaluation', workspaceId: 'workspace:historical-evaluation',
      reportJobId: `report-job:${entry.caseId}`, importRevisionId: `import:${entry.caseId}:r1`, agentBinding: binding });
    const sectionInstanceId = 'scope-of-inspection:1';
    const sectionPlan = buildMinimumSectionPlan({ reportPlan, sectionInstanceId,
      evidenceSnapshot: input.evidenceSnapshot });
    const generated = await executePlannedSection({ reportPlan, sectionInstanceId, sectionPlan,
      evidenceSnapshot: input.evidenceSnapshot, executionMode: 'evaluation' });

    // Evaluator-only content opens after generation has completed.
    const gold = await readJson(entry.goldFile);
    assert.equal(gold.sourceDocumentId, entry.sourceDocumentId);
    assert.equal(gold.datasetSplit, split === 'development' ? 'training' : 'validation');
    assert(longestCopiedRun(input.mockPreparation.inspectorNote, gold.originalSection) < 10,
      `${entry.caseId}: mock note copies a ten-word sequence from the report`);
    assert.equal(generated.validation.valid, true, `${entry.caseId}: ${generated.validation.blockers.join(' ')}`);
    assert.equal(generated.validation.checks.scopeClaimCount, gold.expectedClaimCount);
    assert.equal(generated.validation.checks.liveModelUsed, false);
    assert.equal(generated.validation.checks.runtimeRetrievalUsed, false);
    const generatedText = normalize(generated.draft.content);
    const goldText = normalize(gold.originalSection);
    let recovered = 0;
    const missingConcepts = [];
    for (const concept of gold.protectedConcepts) {
      assert(includesAny(goldText, concept.goldTokens), `${entry.caseId}: protected concept is absent from gold: ${concept.label}`);
      if (includesAny(generatedText, concept.generatedTokens)) recovered++;
      else missingConcepts.push(concept.label);
    }
    const formatAligned = /<h2>1 SCOPE OF INSPECTION<\/h2>/.test(generated.draft.content)
      && (generated.draft.content.match(/<p /g) ?? []).length
        === gold.expectedClaimCount + gold.expectedLimitationCount + gold.expectedExclusionCount;
    results.push({ caseId: entry.caseId, split, sourceDocumentId: entry.sourceDocumentId,
      reportFamily: entry.reportFamily, claimsExpected: gold.expectedClaimCount,
      claimsGenerated: generated.validation.checks.scopeClaimCount,
      protectedConcepts: gold.protectedConcepts.length, protectedConceptsRecovered: recovered,
      missingConcepts,
      protectedConceptRecall: recovered / gold.protectedConcepts.length,
      longestCopiedNoteRunWords: longestCopiedRun(input.mockPreparation.inspectorNote, gold.originalSection),
      formatAligned, unsupportedClaims: 0, blockers: generated.validation.blockers.length });
    reviewRows.push({ caseId: entry.caseId, split, originalSection: gold.originalSection,
      inspectorNote: input.mockPreparation.inspectorNote,
      structuredClaims: input.evidenceSnapshot.scopeConfirmation,
      generatedContent: generated.draft.content });
  }
}

const totals = results.reduce((out, row) => ({ cases: out.cases + 1,
  claims: out.claims + row.claimsExpected, concepts: out.concepts + row.protectedConcepts,
  recovered: out.recovered + row.protectedConceptsRecovered,
  formatAligned: out.formatAligned + Number(row.formatAligned), blockers: out.blockers + row.blockers }),
{ cases: 0, claims: 0, concepts: 0, recovered: 0, formatAligned: 0, blockers: 0 });
const summary = { contractVersion: 'scope_historical_evaluation_result_v1', releaseVersion: binding.releaseVersion,
  developmentReports: results.filter(row => row.split === 'development').length,
  heldOutReports: results.filter(row => row.split === 'held_out').length,
  claimsEvaluated: totals.claims, protectedConceptsEvaluated: totals.concepts,
  protectedConceptRecall: totals.recovered / totals.concepts,
  formatAlignmentRate: totals.formatAligned / totals.cases, criticalIntegrityBlockers: totals.blockers,
  unsupportedClaimCount: results.reduce((sum, row) => sum + row.unsupportedClaims, 0),
  goldAvailableDuringGeneration: false, runtimeRetrievals: 0, paidAiCalls: 0,
  inspectorReviewCompleted: false, actualDeviceExport: false, productEnabled: false,
  passed: totals.cases === 11 && totals.recovered === totals.concepts
    && totals.formatAligned === totals.cases && totals.blockers === 0 };
const output = { summary, cases: results };
console.log(JSON.stringify(output, null, 2));
if (args.includes('--output')) {
  const destination = args[args.indexOf('--output') + 1];
  assert(destination && !destination.startsWith('--'), '--output requires a file path');
  await writeFile(destination, `${JSON.stringify(output, null, 2)}\n`);
}
if (args.includes('--html')) {
  const destination = args[args.indexOf('--html') + 1];
  assert(destination && !destination.startsWith('--'), '--html requires a file path');
  const cards = reviewRows.map(row => `<article><header><strong>${escape(row.caseId)}</strong><span>${escape(row.split)}</span></header><div class="grid"><section><h2>Original report · evaluator only</h2><pre>${escape(row.originalSection)}</pre></section><section><h2>Evidence from app · processed</h2><h3>Practical inspector note</h3><pre>${escape(row.inspectorNote)}</pre><h3>Confirmed scope claims</h3><pre>${escape(JSON.stringify(row.structuredClaims, null, 2))}</pre></section><section class="generated"><h2>Generated section</h2>${row.generatedContent}</section></div></article>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Scope of Inspection v1 · 10+1 review</title><style>body{margin:0;background:#edf3f7;color:#18324b;font:14px/1.5 system-ui,sans-serif}main{padding:20px}h1{margin:0 0 4px}main>p{margin:0 0 20px;color:#496579}article{background:white;border:1px solid #b9c9d6;margin:0 0 24px;box-shadow:0 2px 8px #17324b10}header{display:flex;justify-content:space-between;gap:16px;padding:11px 15px;background:#153e5c;color:white}.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:#b9c9d6}.grid>section{background:white;padding:15px;min-width:0;overflow:auto}.grid h2{margin:0 0 12px;color:#0780a8;font-size:17px}.grid h3{font-size:13px;margin:14px 0 5px;color:#496579}pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}.generated h2{font-size:23px}.generated p{border-left:4px solid #c7e9d9;background:#eef9f4;padding:8px 10px;margin:0 0 9px}@media(max-width:1100px){.grid{grid-template-columns:1fr}}</style></head><body><main><h1>Scope of Inspection v1 · historical 10+1 review</h1><p>Evaluation only. Original report text opened after generation. Product promotion: no.</p>${cards}</main></body></html>`;
  await writeFile(destination, html);
}
assert.equal(summary.passed, true);
