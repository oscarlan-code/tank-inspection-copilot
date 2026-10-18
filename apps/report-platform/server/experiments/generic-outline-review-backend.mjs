// Read-only bridge from frozen evaluation artifacts to the existing comparison UI.
// No import, generation, scoring, reward, policy, or storage-upload operation runs here.
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { INSPECTOR_CASE, loadInspectorNotesReview } from './inspector-notes-review-backend.mjs';
import { ABLATION_CASES } from './section-kb-ablation.mjs';
import { loadSectionKbAblationReview } from './section-kb-ablation-review-backend.mjs';
import { OBSERVATION_CASES } from './kb-observation-comparison.mjs';
import { loadObservationKbReview } from './kb-observation-review-backend.mjs';
import { GENERAL_INFORMATION_REVIEW_SOURCES, loadGeneralInformationReview } from './general-information-review-backend.mjs';
import {
  GENERAL_INFORMATION_CANDIDATE_B_CASE,
  loadGeneralInformationCandidateBReview,
} from './general-information-candidate-b-review-backend.mjs';
import {
  TK5452_OBSERVED_SECTION_CASE,
  TK5452_ROUTED_SECTION_CASE,
  TK5452_ROUTED_SECTION_SOURCE,
  loadTk5452RoutedSectionReview,
} from './tk5452-routed-section-review-backend.mjs';

const ROOT = fileURLToPath(new URL('../../docs/reviews/data/syn025-current-only-v3/', import.meta.url));
const PAIRED_ROOT = fileURLToPath(new URL('../../docs/reviews/data/tk5452-paired-v1/', import.meta.url));
const MODULES = ['identity', 'scope', 'regime', 'findings', 'recommendations', 'methods', 'checklist', 'thickness', 'layout', 'photos', 'references', 'summary'];
const CONTRACT = 'section_planned_generation_v2';
const PAIRED_CASE = 'eval-paired-tk5452-v1';
export class GenericOutlineReviewError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.name = 'GenericOutlineReviewError';
    this.statusCode = statusCode;
    this.code = code;
  }
}
const DEFAULT_CASE = 'eval-generic-syn025-v3-tk5452';
const SOURCES = {
  [GENERAL_INFORMATION_CANDIDATE_B_CASE]: {
    revision: 'candidate-b-sandbox-smoke-v1',
    generalInformationCandidateB: true,
    label: 'Section 3 · Candidate B · sandbox contract smoke',
  },
  [TK5452_OBSERVED_SECTION_CASE]: {
    revision: 'routed-section-agents-observed-v1',
    routedSectionAgents: true,
    label: 'TK 5452 · routed evidence · all-agent monitoring',
    ...TK5452_ROUTED_SECTION_SOURCE,
  },
  [TK5452_ROUTED_SECTION_CASE]: {
    revision: 'routed-section-agents-v1',
    routedSectionAgents: true,
    label: 'TK 5452 · routed evidence · frozen section agents',
    ...TK5452_ROUTED_SECTION_SOURCE,
  },
  [INSPECTOR_CASE]: {
    revision: 'inspector-notes-v2', inspectorNotes: true, label: 'TK 5452 · inspector notes · evaluation v2',
    absolutePath: '/Users/oscar/Public/irs/Sample Reports/Shell Singapore Pte Ltd (Bukom)/19SE2-1 - TK 5452/19SE2-1 Shell Bukom TK 5452 Internal & External Inspection Report.pdf',
    sha256: '871d8770a5667bdbc3f0623a3a2e3ace54abcaf07acbd27017610ec24407de92',
  },
  [PAIRED_CASE]: {
    revision: 'paired-v1', paired: true, label: 'TK 5452 · corrected paired evaluation',
    absolutePath: '/Users/oscar/Public/irs/Sample Reports/Shell Singapore Pte Ltd (Bukom)/19SE2-1 - TK 5452/19SE2-1 Shell Bukom TK 5452 Internal & External Inspection Report.pdf',
    sha256: '871d8770a5667bdbc3f0623a3a2e3ace54abcaf07acbd27017610ec24407de92',
  },
  [DEFAULT_CASE]: {
    revision: 'live-v1', label: 'TK 5452 · previously reviewed report', map: 'comparison-12/tk5452/source-map.json',
    absolutePath: '/Users/oscar/Public/irs/Sample Reports/Shell Singapore Pte Ltd (Bukom)/19SE2-1 - TK 5452/19SE2-1 Shell Bukom TK 5452 Internal & External Inspection Report.pdf',
    sha256: '871d8770a5667bdbc3f0623a3a2e3ace54abcaf07acbd27017610ec24407de92',
  },
  'eval-generic-syn025-v3-su4': {
    revision: 'live-v1', label: 'TK SU4 · source of mock photographs', map: 'comparison-12/source-map.json',
    absolutePath: '/Users/oscar/Public/irs/mfl and floor layout /18PE1-3 TK SU4 Internal & External Inspection Report.pdf',
    sha256: 'c1cdf32521826c9b248b3331a87640b734f1d9a8d80764cb7755e1f2fb3d2b2a',
  },
};
SOURCES['eval-generic-syn025-v3-format-v2-tk5452'] = { ...SOURCES[DEFAULT_CASE], revision: 'format-v2' };
SOURCES['eval-generic-syn025-v3-format-v2-su4'] = { ...SOURCES['eval-generic-syn025-v3-su4'], revision: 'format-v2' };
for (const choice of ABLATION_CASES) SOURCES[choice.evaluationCaseId] = { ...SOURCES[INSPECTOR_CASE], inspectorNotes: false, kbAblation: true, label: choice.label };
for (const choice of OBSERVATION_CASES) SOURCES[choice.evaluationCaseId] = { ...SOURCES[INSPECTOR_CASE], inspectorNotes: false, observationKb: true, label: choice.label };
for (const choice of GENERAL_INFORMATION_REVIEW_SOURCES) SOURCES[choice.evaluationCaseId] = { generalInformation: true, absolutePath: choice.sourcePath, sha256: choice.sourceSha256 };
const REVISIONS = {
  'live-v1': { artifactDir: 'evaluation-12-live', label: 'Original 12-module evaluation' },
  'format-v2': {
    artifactDir: 'evaluation-12-format-v2', label: 'Report format revision 2',
    manifest: new URL('./generic-outline-review-format-v2-manifest.json', import.meta.url),
  },
};

// Pins freeze this named run. A new experiment needs its own explicit registration.
const PINS = {
  'evaluation-12-live/summary.json': 'e27fd50c9c7408df6fc4d67823af81666f76c71e2017291abcd36605195ad8b6',
  'evaluation-12-live/input-provenance.json': 'a5602ef4d92f12ab120b943a2f5333b404a6ab0c0ec158f42684c4dfa294953b',
  'evaluation-12-live/artifact-review.json': 'ea6da441f75eae62f299283adcf932b08257bb69f73f42eb8261a226eb297453',
  'comparison-12/source-map.json': 'bc4e5de798e6b522fc0aff835ba7fbe4cc5eadd97ffd436a6a1e1047b549b54d',
  'comparison-12/tk5452/source-map.json': '06cca907376aa359fef477a91d2cb8e10cb5a4a42a04f54ec00eeb74e4af7e3a',
  'evaluation-12-live/sections/checklist.json': '884c2870e25ad4d66264679f4a9f626c229a9db8a300df1ba745a391bfae9c1d',
  'evaluation-12-live/sections/findings.json': '2527f6ff6a36631ae15a2c94f227eaf677d55fcf43045f56b21918914a581e92',
  'evaluation-12-live/sections/identity.json': 'b21a1e25f7723023f62a3d6b5ddbf3aa83146b85c3defbe533049b455a13b54c',
  'evaluation-12-live/sections/layout.json': 'bdb99ec6cf924912384e090e8921534f6b89d9888dbbb8bd69a64c0690ec1e5a',
  'evaluation-12-live/sections/methods.json': '2e353e6248cefad8d7017812ae3d778816383d28b5a44904bd684ad78d2ce997',
  'evaluation-12-live/sections/photos.json': '080cba53d5a6bb3a298f11ac4fda3fe3d869d062c39b418461b3b98dd52ed820',
  'evaluation-12-live/sections/recommendations.json': 'd2fa7bf8f8c15a6c86048180540b86ca6486dec17eed50954a946d2f25a64af6',
  'evaluation-12-live/sections/references.json': 'dea8658be4f005e95cdfb851bd31aa117899b1761d245747927d67ecfc8560d5',
  'evaluation-12-live/sections/regime.json': '4cb6c8976d052a2c93928f0d270c9768a07820cd5456f560fead7fc9ed796234',
  'evaluation-12-live/sections/scope.json': '42e63c4d1c5094fd8fd3dee69f0dcc8b0e455891faa10cd58a6e817e40b81b29',
  'evaluation-12-live/sections/summary.json': '5f452874561a162feff9e323e7d8fd1fbfadffdf7bd1753c0fddf94f55a2e9e0',
  'evaluation-12-live/sections/thickness.json': '08edf83c4fb1d1b756e50dc89b0a9c04f298544862ef35e403274844bcb39b56',
  'evaluation-12-live/worker/checklist-response.json': '2b38316101f191fbc6e8deb4834f72d2c618391e579aeabb435a2ec56b22e303',
  'evaluation-12-live/worker/findings-response.json': 'fb126c3245a7311eebd2c151510a8036a52556ee28dc78ba22e4e0777061c9d3',
  'evaluation-12-live/worker/identity-response.json': 'fbdd58b74fa69a90de649cf6b2e11992cc4a460c4cc24128d6312bceb97953e5',
  'evaluation-12-live/worker/layout-response.json': '6ea51b695203746f5c669938a21f0a2f76efc117adc255aa9cbbd844ab2e0e53',
  'evaluation-12-live/worker/methods-response.json': 'b553c4c2839c707bef63c79b398eca68e485b6d7beee58c169ec8c5f68daa94a',
  'evaluation-12-live/worker/recommendations-response.json': 'dc155d10a38d8d3e0d4a0b97537b120692934b66f98d512075819057a93b7b81',
  'evaluation-12-live/worker/scope-response.json': '46f4636bb96061ccfe6332b70526a52c83462a9c6d49ec11619823e76067a27d',
  'evaluation-12-live/worker/summary-response.json': '90fe12c46ee4f54812432c44788c2a7bdb383234b1ab134fc76f15dc52ac551f',
  'evaluation-12-live/worker/thickness-response.json': 'e0699f979c92316a657759ccce98b01b744af69d134180c99385754c557d1ebf',
};

export function matchesGenericOutlineReviewCase(id) {
  return typeof id === 'string' && Object.hasOwn(SOURCES, id);
}

/** Authentication/authorization stays with the existing admin API caller. */
export async function loadGenericOutlineHeldOutReview({ evaluationCaseId = DEFAULT_CASE, sectionId = 'identity', evalRunId = null } = {}) {
  const source = sourceFor(evaluationCaseId);
  if (source.generalInformationCandidateB) {
    try { return await loadGeneralInformationCandidateBReview({ evaluationCaseId, sectionId, evalRunId }); }
    catch (error) {
      if ([404, 409].includes(error.statusCode)) throw failure(error.statusCode, error.message, 'general_information_candidate_b_review_invalid');
      throw error;
    }
  }
  if (source.routedSectionAgents) {
    try { return await loadTk5452RoutedSectionReview({ evaluationCaseId, sectionId, evalRunId }); }
    catch (error) {
      if ([404, 409].includes(error.statusCode)) throw failure(error.statusCode, error.message, 'routed_section_agent_review_invalid');
      if (error.code === 'ENOENT') throw failure(503, 'The saved TK5452 routed section-agent evaluation is not available yet.', 'routed_section_agent_review_pending');
      throw error;
    }
  }
  if (source.generalInformation) {
    try { return await loadGeneralInformationReview({ evaluationCaseId, sectionId, evalRunId }); }
    catch (error) {
      if ([404, 409].includes(error.statusCode)) throw failure(error.statusCode, error.message, 'general_information_review_invalid');
      if (error.code === 'ENOENT') throw failure(503, 'The saved general information review is not available yet.', 'general_information_review_pending');
      throw error;
    }
  }
  if (source.observationKb) {
    try { return await loadObservationKbReview({ evaluationCaseId, sectionId, evalRunId }); }
    catch (error) {
      if ([404, 409].includes(error.statusCode)) throw failure(error.statusCode, error.message, 'observation_comparison_invalid');
      if (error.code === 'ENOENT') throw failure(503, 'The observation comparison has no saved results yet.', 'observation_comparison_pending');
      throw error;
    }
  }
  if (source.kbAblation) {
    try { return await loadSectionKbAblationReview({ evaluationCaseId, sectionId, evalRunId }); }
    catch (error) {
      if ([404, 409].includes(error.statusCode)) throw failure(error.statusCode, error.message, 'kb_ablation_review_invalid');
      if (error.code === 'ENOENT') throw failure(503, 'The saved KB comparison is not available yet.', 'kb_ablation_review_pending');
      throw error;
    }
  }
  if (source.inspectorNotes) {
    try { return await loadInspectorNotesReview({ evaluationCaseId, sectionId, evalRunId }); }
    catch (error) {
      if ([404, 409].includes(error.statusCode)) throw failure(error.statusCode, error.message, 'inspector_review_invalid');
      if (error.code === 'ENOENT') throw failure(503, 'The inspector-note evaluation is not available yet.', 'inspector_review_pending');
      throw error;
    }
  }
  if (source.paired) return loadTk5452PairedReview({ evaluationCaseId, sectionId, evalRunId });
  sectionId ??= 'identity';
  if (!MODULES.includes(sectionId)) throw failure(404, 'Saved evaluation section was not found.', 'generic_review_section_missing');
  const revision = REVISIONS[source.revision];
  const artifactDir = revision.artifactDir;
  const files = await loadFrozenFiles(source.revision);
  const summary = files[`${artifactDir}/summary.json`];
  const record = files[`${artifactDir}/sections/${sectionId}.json`];
  const entry = summary.sections.find(item => item.sectionId === sectionId);
  const run = record.result.generationRun;
  const reviewRunId = `${evaluationCaseId}:${run.runId}`;
  if (evalRunId && evalRunId !== reviewRunId) throw failure(404, 'Saved evaluation run was not found for this section.', 'generic_review_run_missing');
  const mapping = files[source.map];
  const original = mapping.sections.find(item => item.moduleId === sectionId);
  check(original, 'Historical section mapping is missing.');
  const primarySources = original.sourceSections ?? [];
  const sourcePages = [...new Set(primarySources.flatMap(item => item.pdfPages))];
  const sectionIndex = MODULES.indexOf(sectionId);
  const reportName = `SYN-025 mock · ${source.label}`;
  const response = files[`${artifactDir}/worker/${sectionId}-response.json`];
  const artifactSet = files[`${artifactDir}/artifact-review.json`];
  const ids = new Set(artifactSet.byModule[sectionId] ?? []);
  const diagnosticNotes = [
    'Evaluation only. The historical report and SYN-025 describe different inspections; this comparison does not establish factual recovery against a paired original.',
    ...(source.revision === 'live-v1' ? [] : revisionNotes(summary, entry, revision)),
    ...original.comparisonNotes,
    ...primarySources.flatMap(item => item.note ? [item.note] : []),
    ...(primarySources.length ? [] : ['No equivalent standalone original section exists. The original side is intentionally empty.']),
    run.usedLiveModel ? 'AI wording was accepted into this saved draft.' : entry.workerResponded ? 'AI responded, but validation retained the captured wording. The unaccepted AI response is separate from the draft.' : sectionId === 'regime' ? 'Standard maintenance text is pending; no AI generation was attempted.' : 'This section was compiled deterministically without an AI call.',
    ...run.blockers, ...run.warnings,
    ...entry.missingRequirements.map(item => item.reason ?? item.detail ?? JSON.stringify(item)),
    'Input and saved-output hashes were verified. No new generation, source import, reward update or policy promotion occurred.',
  ];
  return {
    available: true, evaluationOnly: true, generationBackend: 'generic_outline_evaluation_v1',
    evaluationCaseId, evalRunId: reviewRunId, datasetSplit: 'evaluation_only', reportName,
    sectionId, sectionTitle: entry.reportTitle ?? entry.title, sourceReportName: mapping.source.fileName,
    sourcePdfUrl: `/api/v1/admin/generic-outline-reviews/${encodeURIComponent(evaluationCaseId)}/source`,
    sourcePageNumber: sourcePages[0] ?? 1,
    referenceChoices: Object.entries(SOURCES).filter(([, value]) => value.revision === source.revision).map(([id, value]) => ({ evaluationCaseId: id, label: value.label })),
    revisionChoices: await revisionChoicesFor(source),
    allSectionsComplete: true,
    sections: summary.sections.map(item => ({ evaluationCaseId, reportName, sectionId: item.sectionId, completed: true, outcomeCode: 'needs_attention', hardFailure: false })),
    previousEvaluationCaseId: sectionIndex > 0 ? evaluationCaseId : null,
    previousSectionId: MODULES[sectionIndex - 1] ?? null,
    nextEvaluationCaseId: sectionIndex < MODULES.length - 1 ? evaluationCaseId : null,
    nextSectionId: MODULES[sectionIndex + 1] ?? null,
    // These bytes are the retained generated draft, never replaced by raw AI output.
    generatedContent: record.result.draft.content,
    originalSectionContent: primarySources.map(item => `${item.sectionNumber ? `${item.sectionNumber} ` : ''}${item.heading}\n\n${originalBody(item)}`).join('\n\n'),
    experimentContract: 'generic_outline_saved_review_v1', generatorContractVersion: CONTRACT,
    benchmarkStatus: 'diagnostic_unreviewed_obligations',
    sectionPlanEvaluation: { contractVersion: record.evaluation.contractVersion, denominatorSource: record.evaluation.denominatorSource },
    referenceRevision: { contractVersion: mapping.contractVersion, pages: sourcePages, sourceSha256: source.sha256 },
    companionArtifacts: [...artifactSet.photos, ...artifactSet.layouts].filter(item => ids.has(item.artifactId)).map(item => ({
      artifactId: item.artifactId, kind: item.kind, title: item.title,
      caption: item.kind === 'photo' ? `${item.caption} Original SU4 Photo ${item.source.sourcePhotoNumber}, page ${item.source.sourcePage}. ${item.source.syntheticLocationAlias} is a synthetic location alias; original-location correspondence is not established.` : `${item.title}. ${item.provenance === 'native_floor_svg_byte_identical' ? 'Original native SVG preserved unchanged.' : 'Deterministic figure from native export geometry.'}`,
      dataUri: item.dataUri,
    })),
    ...(response ? { rawAiResponse: { accepted: run.usedLiveModel, modelId: summary.modelTarget, findings: response.parsed.findings.map(item => ({ text: item.text })) } } : {}),
    diagnosticNotes: [...new Set(diagnosticNotes)],
    promotionGate: { eligible: false, reasons: ['Evaluation-only synthetic comparison; no promotion or learning eligibility.'], sectionCount: 12, passedSectionCount: 0, thresholds: { requiredFactRecall: 0.8, claimPrecision: 0.9, protectedFactAccuracy: 0.99 } },
    createdAtIso: run.generatedAtIso,
  };
}

async function loadTk5452PairedReview({ evaluationCaseId, sectionId, evalRunId }) {
  const manifest = JSON.parse(await readFile(join(PAIRED_ROOT, 'manifest.json'), 'utf8'));
  check(manifest.contractVersion === 'tk5452_paired_manifest_v1' && manifest.evaluationOnly === true && manifest.caseId === PAIRED_CASE, 'Paired evaluation manifest is invalid.');
  check(Object.keys(manifest.files).sort().join(',') === ['native-export.json','review.json','section-planning.json'].sort().join(','), 'Paired evaluation manifest contains an unexpected file.');
  const loaded = {};
  for (const [name, expected] of Object.entries(manifest.files)) {
    check(/^(?:native-export|review|section-planning)\.json$/.test(name) && /^[a-f0-9]{64}$/.test(expected), 'Paired evaluation manifest path or checksum is invalid.');
    const bytes = await readFile(join(PAIRED_ROOT, name));
    check(sha(bytes) === expected, `Paired evaluation artifact changed: ${name}`);
    loaded[name] = JSON.parse(bytes);
  }
  const review = loaded['review.json'];
  check(review.contractVersion === 'tk5452_paired_review_v1' && review.caseId === PAIRED_CASE && review.evaluationOnly === true, 'Paired evaluation identity is invalid.');
  check(review.preflight?.passed === true && review.source?.sha256 === SOURCES[PAIRED_CASE].sha256, 'Paired source preflight did not pass.');
  check(review.sections.length === 21 && review.maintenanceRegimeAiCalls === 0 && review.policyPromotionPerformed === false && review.productionProfileChanged === false, 'Paired evaluation boundaries are invalid.');
  sectionId ||= review.sections[0].sectionId;
  const index = review.sections.findIndex(item => item.sectionId === sectionId);
  if (index < 0) throw failure(404, 'Paired evaluation section was not found.', 'paired_review_section_missing');
  const section = review.sections[index];
  const runId = `${evaluationCaseId}:${section.generationRun.runId}`;
  if (evalRunId && evalRunId !== runId) throw failure(404, 'Paired evaluation run was not found for this section.', 'paired_review_run_missing');
  const reportName = 'TK 5452 · corrected paired reconstruction';
  const missing = section.captureAvailability.withheldFacts.map(item => item.text);
  const notes = [
    'Retired comparison: original report sentences were copied into the mock inputs. Its recovery score is invalid for AI quality; use the inspector-note v2 run.',
    'Corrected paired evaluation: the app-style mock capture and the original report both describe job 19SE2-1, Tank 5452.',
    review.performanceScope,
    'The legacy preflight failed to detect narrative answer exposure. Its old performance claims are withdrawn.',
    section.generationRun.usedLiveModel ? 'AI wording was accepted for this section.' : 'This section retained deterministic captured wording or a controlled standard template.',
    ...missing,
    ...(section.evaluation.attentionReasons ?? []).map(reason => `Evaluation attention: ${reason}.`),
    ...(section.evaluation.blockerReasons ?? []).map(reason => `Integrity blocker: ${reason}.`),
    'Evaluation only. No model, policy or production report profile was promoted.',
  ];
  return {
    available: true, evaluationOnly: true, generationBackend: review.generationBackend,
    evaluationCaseId, evalRunId: runId, datasetSplit: 'evaluation_only', reportName,
    sectionId: section.sectionId, sectionTitle: `${section.sectionNumber} ${section.title}`,
    sourceReportName: review.source.fileName,
    sourcePdfUrl: `/api/v1/admin/generic-outline-reviews/${encodeURIComponent(evaluationCaseId)}/source`,
    sourcePageNumber: section.pages[0], referenceChoices: [], revisionChoices: [{ evaluationCaseId: INSPECTOR_CASE, label: 'Inspector notes · evaluation v2' }, { evaluationCaseId: PAIRED_CASE, label: 'Previous v1 · contaminated comparison' }], allSectionsComplete: true,
    sections: review.sections.map(item => ({ evaluationCaseId, reportName, sectionId: item.sectionId, sectionTitle: `${item.sectionNumber} ${item.title}`, completed: true, outcomeCode: item.metrics.outcomeCode, hardFailure: item.metrics.hardFailure })),
    previousEvaluationCaseId: index > 0 ? evaluationCaseId : null,
    previousSectionId: review.sections[index - 1]?.sectionId ?? null,
    nextEvaluationCaseId: index < review.sections.length - 1 ? evaluationCaseId : null,
    nextSectionId: review.sections[index + 1]?.sectionId ?? null,
    generatedContent: section.generatedContent,
    originalSectionContent: section.originalSectionContent,
    experimentContract: review.contractVersion,
    generatorContractVersion: review.generatorContractVersion,
    benchmarkStatus: 'paired_source_reconstruction',
    sectionPlanEvaluation: { contractVersion: section.evaluation.contractVersion, denominatorSource: 'frozen_section_requirements' },
    referenceRevision: { contractVersion: review.contractVersion, pages: section.pages, sourceSha256: review.source.sha256 },
    captureAvailability: section.captureAvailability,
    metrics: { ...section.metrics, score: null, requiredFactRecall: null, claimPrecision: null, protectedFactAccuracy: null, formatMatch: null, evaluationPoints: [] },
    companionArtifacts: [],
    ...(section.rawAiResponse ? { rawAiResponse: section.rawAiResponse } : {}),
    diagnosticNotes: [...new Set(notes)],
    promotionGate: { eligible: false, reasons: ['Evaluation-only source-derived reconstruction; promotion is disabled.'], sectionCount: 21, passedSectionCount: review.sections.filter(item => item.metrics.outcomeCode === 'ready_for_review').length, thresholds: { requiredFactRecall: 0.8, claimPrecision: 0.9, protectedFactAccuracy: 0.99 } },
    createdAtIso: review.createdAtIso,
  };
}

/** Returns only a server-side allowlisted source; never accepts a client path. */
export async function resolveGenericOutlineSource(id = DEFAULT_CASE) {
  const source = sourceFor(id);
  const bytes = await readFile(source.absolutePath);
  check(sha(bytes) === source.sha256, 'Historical source checksum changed.');
  return { absolutePath: source.absolutePath, fileName: source.absolutePath.split('/').at(-1), sha256: source.sha256 };
}

async function loadFrozenFiles(revisionId = 'live-v1') {
  const revision = REVISIONS[revisionId];
  const artifactDir = revision.artifactDir;
  const pins = await revisionPins(revisionId);
  const files = Object.fromEntries(await Promise.all(Object.entries(pins).map(async ([name, expected]) => {
    const bytes = await readFile(join(ROOT, name));
    check(sha(bytes) === expected, `Frozen review artifact changed: ${name}`);
    return [name, JSON.parse(bytes)];
  })));
  const summary = files[`${artifactDir}/summary.json`];
  check(summary.evaluationOnly && summary.caseId === 'synthetic-inspection-025' && summary.sourceRevision === 3 && summary.generatorContract === CONTRACT, 'Saved run identity or contract mismatch.');
  check(JSON.stringify(summary.selectedModuleIds) === JSON.stringify(MODULES) && summary.sectionCount === 12 && summary.sections.length === 12, 'All twelve saved sections are required.');
  check(summary.maintenanceRegimeAiCalls === 0 && summary.policyPromotionPerformed === false && summary.productionProfileChanged === false && summary.independentlyApprovedBenchmark === false && summary.recoveryScore === null, 'Saved evaluation boundaries are invalid.');
  const provenance = files[`${artifactDir}/input-provenance.json`];
  check(provenance.evaluationOnly && provenance.rawExportUnchanged && !provenance.expectedLabelsRead && !provenance.outlineReadinessUsedAsClassifierInput, 'Input isolation is not established.');
  await Promise.all(Object.entries(provenance.inputHashes).map(async ([name, expected]) => {
    check(/^native\//.test(name) && name.split('/').every(part => part && part !== '.' && part !== '..') && !name.includes('\\'), 'Unsafe native artifact path.');
    const bytes = await readFile(join(ROOT, name));
    check(bytes.length === expected.bytes && sha(bytes) === expected.sha256, `Native input artifact changed: ${name}`);
  }));
  for (const [index, id] of MODULES.entries()) {
    const record = files[`${artifactDir}/sections/${id}.json`];
    check(summary.sections[index].sectionId === id && record.result.generationRun.sectionId === id && record.evaluation.sectionId === id, 'Section identity mismatch.');
    check(record.result.orchestration.generatorContractVersion === CONTRACT && record.result.generationRun.evidenceChain.contractVersion === CONTRACT, 'Generator contract mismatch.');
    check(JSON.stringify(record.result.generationRun) === JSON.stringify(summary.sections[index].generationRun), 'Saved generation summary differs from section record.');
    check(typeof record.result.draft.content === 'string' && record.result.draft.approved === false, 'Saved draft is missing or already approved.');
    const response = files[`${artifactDir}/worker/${id}-response.json`];
    check(Boolean(response) === Boolean(summary.sections[index].workerResponded), 'Saved worker response registration differs from section summary.');
    if (response) check(Array.isArray(response.parsed?.findings) && response.parsed.findings.every(item => typeof item.text === 'string'), 'Saved worker response is invalid.');
  }
  for (const source of Object.values(SOURCES).filter(item => item.revision === revisionId)) {
    const mapping = files[source.map];
    check(mapping.evaluationOnly && mapping.source.sha256 === source.sha256 && mapping.source.absolutePath === source.absolutePath, 'Source reference identity mismatch.');
    check(mapping.sections.length === 12 && MODULES.every(id => mapping.sections.filter(item => item.moduleId === id).length === 1), 'Source mapping must account for every module.');
  }
  const artifacts = files[`${artifactDir}/artifact-review.json`];
  check(artifacts.evaluationOnly && artifacts.photos.length === 2 && artifacts.layouts.length === 3 && artifacts.checks.every(item => item.passed), 'Companion artifact validation failed.');
  for (const item of [...artifacts.photos, ...artifacts.layouts]) {
    const match = /^data:(image\/png|image\/jpeg|image\/svg\+xml);base64,([A-Za-z0-9+/=]+)$/.exec(item.dataUri ?? '');
    check(item.status === 'verified' && match, 'Companion image is not verified.');
    const bytes = Buffer.from(match[2], 'base64');
    check(sha(bytes) === item.sha256, 'Companion image hash mismatch.');
    if (item.kind === 'photo') check(bytes.length === item.byteLength && item.source.imageSha256 === item.sha256 && item.source.sourceClass === 'report_derived_photograph', 'Photo provenance mismatch.');
    else check(bytes.toString() === item.svg && !/<(?:script|foreignObject)\b|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|javascript:)/i.test(item.svg), 'Unsafe layout image.');
  }
  return files;
}

async function revisionPins(revisionId) {
  if (revisionId === 'live-v1') return PINS;
  const revision = REVISIONS[revisionId];
  let manifest;
  try {
    manifest = JSON.parse(await readFile(revision.manifest, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') throw failure(409, 'Saved evaluation revision is not registered yet.', 'generic_review_revision_pending');
    throw error;
  }
  check(manifest.contractVersion === 'generic_outline_saved_review_manifest_v1' && manifest.revisionId === revisionId && manifest.artifactDir === revision.artifactDir && manifest.evaluationOnly === true, 'Saved review revision manifest does not match its registration.');
  const pins = manifest.files;
  check(pins && typeof pins === 'object' && !Array.isArray(pins), 'Saved review revision pins are missing.');
  const sourcePaths = [...new Set(Object.values(SOURCES).filter(source => source.revision === revisionId).map(source => source.map))];
  const required = ['summary.json', 'input-provenance.json', 'artifact-review.json', ...MODULES.map(id => `sections/${id}.json`)].map(name => `${revision.artifactDir}/${name}`).concat(sourcePaths);
  check(required.every(name => Object.hasOwn(pins, name)), 'Saved review revision is missing required frozen artifacts.');
  const allowed = new Set([...required, ...MODULES.map(id => `${revision.artifactDir}/worker/${id}-response.json`)]);
  check(Object.entries(pins).every(([name, hash]) => allowed.has(name) && /^[a-f0-9]{64}$/.test(hash)), 'Saved review revision contains an unexpected path or invalid checksum.');
  for (const name of sourcePaths) check(pins[name] === PINS[name], 'New review revision must preserve the frozen historical mapping.');
  return pins;
}

async function revisionChoicesFor(source) {
  const revisedRegistered = await access(REVISIONS['format-v2'].manifest).then(() => true).catch(error => {
    if (error.code === 'ENOENT') return false;
    throw error;
  });
  return Object.entries(SOURCES)
    .filter(([, value]) => value.map === source.map && (value.revision === 'live-v1' || revisedRegistered))
    .map(([evaluationCaseId, value]) => ({ evaluationCaseId, label: value.revision === 'live-v1' ? 'Original outline' : 'Revised report outline' }));
}

function revisionNotes(summary, entry, revision) {
  const profile = summary.reportProfileId ?? summary.reportProfile?.id ?? entry.reportProfileId;
  const formatter = summary.formatterContractVersion ?? entry.formatterContractVersion;
  return [
    `Saved evaluation revision: ${revision.label}.`,
    profile ? `Report presentation profile: ${profile}.` : 'Report presentation profile was not recorded in this saved run.',
    formatter ? `Deterministic formatter contract: ${formatter}.` : 'Deterministic formatter contract was not recorded in this saved run.',
  ];
}

function sourceFor(id) {
  if (!matchesGenericOutlineReviewCase(id)) throw failure(404, 'Saved evaluation case was not found.', 'generic_review_case_missing');
  return SOURCES[id];
}
function originalBody(section) {
  const text = section.extractedTextByPage.map(page => page.text).join('\n\n');
  // SU4 recommendations share page 16 with the following post-repair report.
  // The mapping keeps exact page text; presentation must respect the section end.
  if (section.sectionNumber === '5' && /REPAIR RECOMMENDATIONS/.test(section.heading)) {
    const end = text.search(/^\s*6\s+POST INSPECTION REPORT\s*$/m);
    return end < 0 ? text : text.slice(0, end).trimEnd();
  }
  return text;
}
function check(condition, message) { if (!condition) throw failure(409, message, 'generic_review_integrity_failed'); }
function failure(statusCode, message, code) { return new GenericOutlineReviewError(statusCode, message, code); }
function sha(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
