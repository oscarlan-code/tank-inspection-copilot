#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { getAiStatus, runStructuredCodexJob } from '../codex-cli.mjs';
import { generatePlannedSectionDraft, PLANNED_GENERATOR_CONTRACT } from '../planned-generation.mjs';
import { evaluateSectionPlanOutput } from '../section-plan-evaluation.mjs';
import { renderSectionDocumentHtml } from '../report-document.mjs';
import { buildInspectorEvaluationSnapshot, inspectorEvidenceForSection } from '../experiments/tk5452-inspector-evaluation.mjs';
import { ABLATION_CONTRACT, SECTION_IDS, STYLE_REQUEST, sha, encode, validateHistoricalSource, withHistoricalPatterns, assertCompleteSelectedPlans } from '../experiments/section-kb-ablation.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const root = join(project, 'docs/reviews/data/tk5452-kb-ablation-v1');
const originalRun = join(project, 'docs/reviews/data/tk5452-inspector-evaluation-v2');
const mode = process.argv[2];
assert(['--prepare', '--preview', '--live', '--replay'].includes(mode), 'Use --prepare, --preview, --live or --replay');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const save = async (name, value) => writeFile(join(root, name), encode(value));
await mkdir(join(root, 'worker'), { recursive: true });

if (mode === '--prepare') {
  // Freeze unchanged mock inputs. Never open reference/gold prose here.
  const bytes = await readFile(join(originalRun, 'generation-input.json'));
  assert.equal(sha(bytes), (await readJson(join(originalRun, 'input-manifest.json'))).sha256);
  const input = JSON.parse(bytes);
  const snapshot = buildInspectorEvaluationSnapshot(input);
  assertCompleteSelectedPlans(snapshot);
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  let target, sources;
  try {
    await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const targets = (await db.query("SELECT corpus_report_id,binary_sha256,asset_lineage_key FROM report_corpus_registry WHERE selected_relative_path ILIKE '%5452%'")).rows;
    assert.equal(targets.length, 1);
    target = { ...targets[0], evidenceAsOf: '2019-06-20' };
    // A tiny curated source selection, not a claim to evaluate corpus-wide retrieval.
    sources = (await db.query(`SELECT r.corpus_report_id,r.selected_relative_path,r.binary_sha256,r.asset_lineage_key,r.dataset_split,r.eligibility_role,r.retrieval_eligible,
      d.document_id,d.source_sha256,d.dataset_split AS document_split,d.approval_status,d.visibility_code,d.tenant_id,d.workspace_id,
      s.section_id,s.section_key,s.lane_code,s.review_status,s.include_in_retrieval,
      c.chunk_id,c.content,c.content_sha256,c.page_numbers_json,
      EXISTS(SELECT 1 FROM kb_documents other WHERE other.source_sha256=d.source_sha256 AND other.dataset_split<>'training') AS "crossSplitHash",
      EXISTS(SELECT 1 FROM report_corpus_registry other WHERE other.asset_lineage_key=r.asset_lineage_key AND other.dataset_split<>'training') AS "crossSplitLineage"
      FROM report_corpus_registry r JOIN kb_documents d ON d.source_sha256=r.binary_sha256
      JOIN kb_sections s ON s.document_id=d.document_id
      JOIN kb_chunks c ON c.document_id=d.document_id AND c.section_type=s.section_key
      WHERE d.document_id=ANY($1) AND c.chunk_id=ANY($2) ORDER BY c.chunk_id`, [
        ['canonical_kba_b59ef8f4e988bb9abea9','canonical_kba_e62ac15b858a74d3e9f0'],
        ['chunk_e9c7d59699a3444e45a1d8f0','chunk_2d81a704312da11bf63c927a','chunk_25ed3d1d346d58e6a12143e4','chunk_81209795b5c1c5ea46cefb05'],
      ])).rows;
    assert.equal(sources.length, 4);
    for (const source of sources) {
      const older = source.document_id === 'canonical_kba_b59ef8f4e988bb9abea9';
      source.issuedOn = older ? '2016-05-16' : '2017-12-21';
      source.dateEvidence = older ? 'Date Completed : 16 th May 2016' : 'Date Completed : 21 st December 2017';
      validateHistoricalSource(source, target);
    }
    await db.query('ROLLBACK');
  } finally { await db.end(); }
  const ids = key => sources.filter(source => source.section_key === key).map(source => source.chunk_id);
  const patterns = {
    '01-scope': [
      { sourceChunkIds: ids('scope-of-inspection'), pattern: 'To carry out [captured inspection activity] on [captured component], with [captured coverage] ([captured access/safety/surface limitation]).', instruction: 'Use prospective scope wording rather than describing a completed inspection. Preserve all supplied methods, coverage and limitations; do not supply missing ones.' },
      { sourceChunkIds: ids('scope-of-inspection'), pattern: 'To compile [captured deliverable], showing [captured records and locations] and including [captured review/assessment requirements].', instruction: 'Keep deliverables distinct from field inspection activities. Use only the deliverables actually stated in the inspector notes.' },
    ],
    '05-recommendations': [
      { sourceChunkIds: ids('repair-recommendations'), pattern: '[Captured component/area] where [captured condition] should be [inspector-proposed action sequence].', instruction: 'Name the affected component, condition and proposed work clearly. Keep the sequence of cleaning, preparation and recoating only when supplied. Do not broaden the affected area.' },
      { sourceChunkIds: ids('repair-recommendations'), pattern: 'It is recommended to [captured proposed action], subject to [captured qualification, if any].', instruction: 'Retain conditional/proposed status. Never add a repair, code clause, authorization, urgency, promised benefit or engineering conclusion from a historical example.' },
    ],
  };
  await writeFile(join(root, 'generation-input.json'), bytes);
  await save('historical-source-audit.json', { target, sources, selection: 'Two manually reviewed, earlier, approved training reports; section-level eligibility rechecked directly. No index publication.' });
  await save('historical-patterns.json', patterns);
  await save('frozen-input-obligations.json', { reviewType: 'Input-relative paired diagnostic; not independent gold labels', sections: snapshot.sectionPlans.filter(plan => SECTION_IDS.includes(plan.sectionId)).map(plan => ({ sectionId: plan.sectionId, obligations: plan.outputObligations })) });
  const preparation = { contractVersion: ABLATION_CONTRACT, evaluationOnly: true, sectionIds: SECTION_IDS, inputSha256: sha(bytes),
    generatorContractVersion: PLANNED_GENERATOR_CONTRACT, sourceDerivedMock: true, independentBenchmark: false,
    experiment: 'Fixed current mock / outline / model / formatter / validation; add curated historical writing patterns only.',
    totalPlannedCalls: 4, policyPromotionPerformed: false, inputGate: 'Selected sections only; other report sections remain incomplete.',
    files: {} };
  for (const name of ['generation-input.json','historical-source-audit.json','historical-patterns.json','frozen-input-obligations.json']) preparation.files[name] = sha(await readFile(join(root, name)));
  await save('manifest.json', preparation);
  console.log(encode({ prepared: true, inputSha256: sha(bytes), sections: SECTION_IDS, eligibleSourceChunks: sources.length, plannedCalls: 4 }));
  process.exit(0);
}

const manifest = await readJson(join(root, 'manifest.json'));
for (const [name, hash] of Object.entries(manifest.files)) assert.equal(sha(await readFile(join(root, name))), hash, name);
const input = await readJson(join(root, 'generation-input.json'));
const snapshot = buildInspectorEvaluationSnapshot(input);
assertCompleteSelectedPlans(snapshot);
const patterns = await readJson(join(root, 'historical-patterns.json'));
const aiStatus = getAiStatus();
if (mode === '--live') assert(aiStatus.configured, aiStatus.detail);
let liveCalls = 0;
const results = [];
for (const sectionId of SECTION_IDS) {
  const plan = snapshot.sectionPlans.find(plan => plan.sectionId === sectionId);
  let baselineRequest = null;
  for (const arm of ['without_kb', 'with_kb']) {
    let rawResponse, actualRequest;
    const worker = async baseRequest => {
      if (!baselineRequest) baselineRequest = structuredClone(baseRequest);
      assert.deepEqual(baseRequest, baselineRequest, 'Only historical guidance may differ between arms');
      actualRequest = { ...withHistoricalPatterns(baseRequest, arm === 'with_kb' ? patterns[sectionId] : []), reasoningEffort: 'low' };
      const requestHash = sha(encode(actualRequest));
      await save(`worker/${sectionId}-${arm}-request.json`, actualRequest);
      if (mode === '--preview') throw new Error('Request preview only; no AI call.');
      const responseName = `worker/${sectionId}-${arm}-${requestHash}.json`;
      try { rawResponse = await readJson(join(root, responseName)); }
      catch (error) {
        if (error.code !== 'ENOENT' || mode !== '--live') throw error;
        liveCalls++;
        console.log(JSON.stringify({ sectionId, arm, status: 'calling_worker', liveCalls }));
        rawResponse = await runStructuredCodexJob(actualRequest);
        await save(responseName, rawResponse);
      }
      assert.equal(rawResponse.aiStatus.modelId, aiStatus.modelId, 'Cache/model mismatch');
      return rawResponse;
    };
    const result = await generatePlannedSectionDraft({ reportState: { exportPackage: input.appExport, sectionPlanning: snapshot }, sectionId, userInstruction: STYLE_REQUEST, worker, aiStatus: { ...aiStatus, configured: true } });
    if (mode === '--preview') {
      assert(actualRequest);
      results.push({ sectionId, arm, requestHash: sha(encode(actualRequest)), request: actualRequest });
      continue;
    }
    assert(rawResponse?.parsed?.findings?.length, `No AI response for ${sectionId}/${arm}; stopped without claiming a comparison.`);
    const candidate = structuredClone(result.draft.reportDocument);
    const textById = new Map(rawResponse.parsed.findings.map(item => [item.evidenceId, item.text]));
    assert.equal(textById.size, plan.outputObligations.length);
    const visit = node => {
      const text = textById.get(node.attrs?.['data-evidence-id']);
      if (typeof text === 'string') node.children = [{ text }];
      else (node.children ?? []).forEach(visit);
    };
    candidate.blocks.forEach(visit);
    const candidateContent = renderSectionDocumentHtml(candidate);
    const evaluation = evaluateSectionPlanOutput({ sectionPlan: plan, evidenceRecords: snapshot.evidenceRecords, generatedContent: candidateContent });
    const row = { sectionId, arm, modelId: rawResponse.aiStatus.modelId, requestHash: sha(encode(actualRequest)),
      baseRequestHash: sha(encode(baselineRequest)), inputSha256: manifest.inputSha256,
      rawFindings: rawResponse.parsed.findings, candidateContent, retainedContent: result.draft.content,
      generationRun: result.generationRun, candidateEvaluation: evaluation,
      words: rawResponse.parsed.findings.map(f=>f.text).join(' ').trim().split(/\s+/).length };
    results.push(row);
    await save(`result-${sectionId}-${arm}.json`, row);
    console.log(JSON.stringify({ sectionId, arm, accepted: result.generationRun.usedLiveModel, words: row.words, blockers: evaluation.blockerReasons, unresolved: evaluation.missingRequiredObligationIds.length }));
  }
}
if (mode === '--preview') {
  await save('live-request-preview.json', { evaluationOnly: true, totalCalls: 4, destination: 'Configured OpenAI Codex report-generation worker', modelId: aiStatus.modelId, inputSha256: manifest.inputSha256, requests: results });
  console.log(encode({ preparedRequests: results.length, aiCalls: 0, preview: join(root, 'live-request-preview.json') }));
  process.exit(0);
}
// Reference answer access occurs only after all four worker responses are saved.
const reference = await readJson(join(originalRun, 'review.json'));
const review = { ...manifest, createdAtIso: new Date().toISOString(), liveCallsThisInvocation: liveCalls, results,
  evidence: SECTION_IDS.map(sectionId => ({ sectionId, appEvidence: inspectorEvidenceForSection(input, snapshot, sectionId), originalSectionContent: reference.sections.find(s=>s.sectionId===sectionId).originalSectionContent })),
  limitations: ['Two sections from one source-derived mock; one sample per arm, no statistical/generalization claim.', 'Tests curated historical writing guidance, not full automatic retrieval, recommendation inference or asset history.', 'Raw AI candidates remain separate from validator-accepted drafts. No guardrail relaxation or production mutation.'] };
await save('comparison.json', review);
console.log(encode({ completed: true, results: results.length, liveCallsThisInvocation: liveCalls, output: root }));
