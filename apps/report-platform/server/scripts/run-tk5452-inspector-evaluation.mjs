#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAiStatus, runStructuredCodexJob } from '../codex-cli.mjs';
import { generatePlannedSectionDraft, PLANNED_GENERATOR_CONTRACT } from '../planned-generation.mjs';
import { evaluateSectionPlanOutput } from '../section-plan-evaluation.mjs';
import { renderSectionDocumentHtml } from '../report-document.mjs';
import { buildInspectorEvaluationSnapshot, inspectorEvidenceForSection, INSPECTOR_EVAL_CASE } from '../experiments/tk5452-inspector-evaluation.mjs';
import { rebindEvaluationCache } from '../experiments/rebind-evaluation-cache.mjs';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const root = join(project, 'docs/reviews/data/tk5452-inspector-evaluation-v2');
const mock = join(project, 'docs/reviews/data/tk5452-inspector-notes-v2');
const prior = join(project, 'docs/reviews/data/tk5452-paired-v1');
const mode = process.argv[2];
assert(['--prepare','--live','--replay'].includes(mode), 'Use --prepare, --live or --replay');
const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
await mkdir(root, { recursive: true });

if (mode === '--prepare') {
  const manifest = await readJson(join(mock, 'manifest.json'));
  for (const [name, expected] of Object.entries(manifest.files)) assert.equal(sha(await readFile(join(mock, name))), expected);
  const checks = await readJson(join(mock, 'preparation-checks.json'));
  assert(checks.mockPreparationPassed && checks.copiedWholeEntriesOrNineWordPhrases === 0);
  const priorReview = await readJson(join(prior, 'review.json'));
  const priorPlan = await readJson(join(prior, 'section-planning.json'));
  const canonical = ['scope-of-inspection','inspection-maintenance-regime','general-tank-information','inspection-report','repair-recommendations','test-information','tank-inspection-checklist','roof-plate-thickness-measurements','roof-nozzle-reinforcement-pad-thickness-measurements','roof-plate-layout','minimum-shell-thickness-calculations','shell-plate-thickness-measurements','shell-nozzle-reinforcement-pad-thickness-measurements','shell-plate-layout','tank-piping-spot-thickness-measurements','tank-piping-layout','b-scan-profiles','floor-plate-layout-platemaps-numbering-system','guidelines-interpretation-tru-flux-data-sheets','floor-plate-corrosion-plan','magnetic-flux-leakage-platemaps'];
  const profile = { profileId: 'tk5452_inspector_notes_eval_v2', sections: priorReview.sections.map((section, i) => {
    const old = priorPlan.sectionPlans.find(plan => plan.sectionId === section.sectionId);
    return { sectionId: section.sectionId, canonicalSectionId: canonical[i], number: section.sectionNumber, title: section.title, pages: section.pages, presentation: old.catalog.slots[0].presentation };
  }) };
  profile.sections.find(section => section.sectionId === '12-shell-thickness').presentation = {
    renderer: 'measurement_table', hideHeading: false, decimalPlaces: 2,
    measurementColumns: ['North', 'East', 'South', 'West'].map(title => ({ key: title.toLowerCase(), title })),
  };
  const standardTemplates = {};
  for (const sectionId of ['02-regime','19-truflux-guidance']) {
    const record = priorPlan.evidenceRecords.find(record => record.kind === 'approved_template' && record.evidenceId.includes(sectionId));
    standardTemplates[sectionId] = { text: record.payload.text, sha256: sha(record.payload.text), sourceClass: 'source_derived_standard_template_fixture', productionApproved: false, aiAllowed: false };
  }
  const input = { evaluationOnly: true, appExport: await readJson(join(mock, 'app-shaped-export.json')), structuredData: await readJson(join(mock, 'report-side-structured-data.json')), standardTemplates, profile };
  const snapshot = buildInspectorEvaluationSnapshot(input);
  const voice = snapshot.evidenceRecords.filter(record => record.kind === 'voice_claim');
  assert.equal(voice.filter(record => record.quality.issues.length).length, 0, 'Resolve voice metadata before generation');
  assert.equal(snapshot.baseRuleRevision, 4);
  assert(checks.shellMeasurementCoverage?.complete, 'Prepare all 40 shell readings before rebuilding this evaluation.');
  assert(snapshot.sectionPlans.find(plan => plan.sectionId === '05-recommendations').outputObligations.length === 7);
  const content = json(input);
  await writeFile(join(root, 'generation-input.json'), content);
  await writeFile(join(root, 'input-manifest.json'), json({ evaluationOnly: true, caseId: INSPECTOR_EVAL_CASE, sha256: sha(content), sourceDerived: true, originalNarrativeExcluded: true, explicitStructuredSupplement: true, deterministicStandardTemplatesOnly: true, benchmarkIndependentlyApproved: false }));
  await writeFile(join(root, 'section-planning.json'), json(snapshot));
  console.log(json({ prepared: true, voiceRecords: voice.length, sectionRequirements: snapshot.sectionPlans.map(plan => [plan.sectionId, plan.outputObligations.length]) }));
  process.exit(0);
}

// Live generation opens the whitelisted prepared input only. The original
// report and comparison ledger are read below, after all generation completes.
const inputBytes = await readFile(join(root, 'generation-input.json'));
const inputManifest = await readJson(join(root, 'input-manifest.json'));
assert.equal(sha(inputBytes), inputManifest.sha256);
const input = JSON.parse(inputBytes);
assert(input.evaluationOnly && inputManifest.originalNarrativeExcluded);
const snapshot = buildInspectorEvaluationSnapshot(input);
const inputReadiness = {
  status: snapshot.sectionPlans.some(plan => plan.missingRequirements.length || !plan.outputObligations.length) ? 'incomplete' : 'supplied',
  totalSections: snapshot.sectionPlans.length,
  sectionsWithInputs: snapshot.sectionPlans.filter(plan => plan.outputObligations.length).length,
  sectionsWithoutInputs: snapshot.sectionPlans.filter(plan => !plan.outputObligations.length).length,
  sections: snapshot.sectionPlans.map(plan => ({ sectionId: plan.sectionId, title: plan.title,
    status: !plan.outputObligations.length ? 'missing' : plan.missingRequirements.length ? 'partial' : 'supplied',
    reasons: plan.missingRequirements.map(item => item.reason) })),
};
const aiStatus = getAiStatus();
if (mode === '--live') {
  assert.equal(inputReadiness.status, 'supplied', 'Mock inputs are incomplete. Resolve section input gaps before another live run. Use --replay to review existing responses without spending AI tokens.');
  assert(aiStatus.configured, aiStatus.detail);
}
await mkdir(join(root, 'worker'), { recursive: true });
let liveCalls = 0;
const results = [];
for (const definition of input.profile.sections) {
  let rawResponse = null;
  let requested = false;
  const worker = async request => {
    requested = true;
    const key = sha(JSON.stringify(request));
    const cachePath = join(root, 'worker', `${definition.sectionId}-${key}.json`);
    try { await access(cachePath); rawResponse = await readJson(cachePath); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (mode === '--replay') {
        const archive = join(root, 'revisions/before-shell-measurements/worker');
        const previousRequest = await readJson(join(archive, `${definition.sectionId}-request.json`));
        const previousResponse = await readJson(join(archive, `${definition.sectionId}-${sha(JSON.stringify(previousRequest))}.json`));
        rawResponse = rebindEvaluationCache(previousRequest, request, previousResponse);
      } else {
        liveCalls++;
        rawResponse = await runStructuredCodexJob(request);
      }
      await writeFile(cachePath, json(rawResponse));
    }
    await writeFile(join(root, 'worker', `${definition.sectionId}-request.json`), json(request));
    return rawResponse;
  };
  const result = await generatePlannedSectionDraft({ reportState: { exportPackage: input.appExport, sectionPlanning: snapshot }, sectionId: definition.sectionId,
    aiStatus: ['02-regime','19-truflux-guidance'].includes(definition.sectionId) ? { configured: false, mode: 'standard_template_fixture' } : { ...aiStatus, configured: true }, worker,
    userInstruction: 'Turn the practical inspection notes into concise professional report sentences. Keep every supplied observation, limitation, proposed recommendation, measurement and qualifier. Use third-person report wording. Do not invent missing facts or append evidence.' });
  const plan = snapshot.sectionPlans.find(plan => plan.sectionId === definition.sectionId);
  if (requested && !rawResponse) throw new Error(`No verified cached response for ${definition.sectionId}; stopped without new AI calls.`);
  const evaluation = evaluateSectionPlanOutput({ sectionPlan: plan, evidenceRecords: snapshot.evidenceRecords, generatedContent: result.draft.content });
  results.push({ definition, result, evaluation, rawResponse, requested });
  console.log(JSON.stringify({ sectionId: definition.sectionId, modelAttempted: requested, acceptedLiveWording: result.generationRun.usedLiveModel, fallbackReason: result.generationRun.fallbackReason }));
}

// Evaluator-only original reference access starts here, after generation.
const reference = await readJson(join(prior, 'review.json'));
const sections = results.map(({ definition, result, evaluation, rawResponse, requested }) => {
  const plan = snapshot.sectionPlans.find(plan => plan.sectionId === definition.sectionId);
  const truth = evaluation.truthGraphEvaluation;
  let aiCandidateContent = null;
  let candidateEvaluation = null;
  if (rawResponse?.parsed?.findings?.length) {
    // Preview the returned AI wording in the same shared document structure.
    // This is a separate review artifact, never a replacement approved draft.
    const candidate = structuredClone(result.draft.reportDocument);
    const textById = new Map(rawResponse.parsed.findings.map(item => [item.evidenceId, item.text]));
    const visit = node => {
      const text = textById.get(node.attrs?.['data-evidence-id']);
      if (typeof text === 'string') node.children = [{ text }];
      else (node.children ?? []).forEach(visit);
    };
    candidate.blocks.forEach(visit);
    aiCandidateContent = renderSectionDocumentHtml(candidate);
    candidateEvaluation = evaluateSectionPlanOutput({ sectionPlan: plan, evidenceRecords: snapshot.evidenceRecords, generatedContent: aiCandidateContent });
  }
  return { sectionId: definition.sectionId, sectionNumber: definition.number, title: definition.title, pages: definition.pages,
    originalSectionContent: reference.sections.find(section => section.sectionId === definition.sectionId).originalSectionContent,
    generatedContent: result.draft.content, aiCandidateContent, candidateEvaluation, generationRun: result.generationRun,
    rawAiResponse: requested && rawResponse ? { accepted: result.generationRun.usedLiveModel, modelId: rawResponse.aiStatus.modelId, findings: rawResponse.parsed.findings } : null,
    cachedResponseReuse: rawResponse?.cacheReplay ?? null,
    appEvidence: inspectorEvidenceForSection(input, snapshot, definition.sectionId),
    metrics: { score: null, outcomeCode: plan.missingRequirements.length || evaluation.attentionReasons.length || result.generationRun.warnings.length ? 'needs_attention' : 'ready_for_review', requiredFactRecall: truth.requiredFactRecall ?? null, claimPrecision: truth.claimPrecision ?? null, protectedFactAccuracy: truth.protectedFactAccuracy ?? null, formatMatch: null, professionalAcceptability: null, goldContentCoverage: null, outputLengthBalance: null, hardFailure: evaluation.blockerReasons.length > 0, hardFailureReasons: evaluation.blockerReasons, evaluationPoints: [] },
    captureAvailability: { capturedFactCount: plan.outputObligations.length, withheldFactCount: plan.missingRequirements.length, denominator: 'Frozen input requirements; independent semantic recovery is not yet scored.', withheldFacts: plan.missingRequirements.map(item => ({ factId: item.requirementId, text: item.reason, sectionKey: definition.sectionId, reason: 'missing_input' })), omittedCapturedFacts: evaluation.missingRequiredObligationIds.map(id => ({ factId: id, text: 'Not confirmed by conservative content checking; inspect the original, input and output.' })) },
    evaluation: { ...evaluation, denominatorSource: evaluation.denominatorSource },
  };
});
const review = { contractVersion: 'tk5452_inspector_review_v2', evaluationOnly: true, caseId: INSPECTOR_EVAL_CASE, generationBackend: 'tk5452_inspector_notes_v2',
  generatorContractVersion: PLANNED_GENERATOR_CONTRACT, source: reference.source, createdAtIso: new Date().toISOString(),
  sourceDerivedMock: true, performanceScope: 'Reconstruction from authored inspector notes. Original narrative was excluded from generation; this is not an independently captured benchmark.',
  maintenanceRegimeAiCalls: 0, policyPromotionPerformed: false, productionProfileChanged: false,
  inputReadiness, sections, summary: { sectionCount: sections.length, newLiveCallsThisInvocation: liveCalls, workerResponses: sections.filter(section => section.rawAiResponse).length, acceptedAiSections: sections.filter(section => section.generationRun.usedLiveModel).length, inputRequirements: snapshot.sectionPlans.reduce((sum, plan) => sum + plan.outputObligations.length, 0), independentRecoveryScore: null } };
await writeFile(join(root, 'section-planning.json'), json(snapshot));
await writeFile(join(root, 'review.json'), json(review));
await writeFile(join(root, 'manifest.json'), json({ contractVersion: 'tk5452_inspector_review_manifest_v2', caseId: INSPECTOR_EVAL_CASE, evaluationOnly: true, files: Object.fromEntries(await Promise.all(['generation-input.json','section-planning.json','review.json'].map(async name => [name, sha(await readFile(join(root, name)))]))) }));
console.log(json(review.summary));
