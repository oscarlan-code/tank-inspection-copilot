#!/usr/bin/env node
// Evaluation-only adapter for a test-emitted Room snapshot whose native export
// was blocked. This is deliberately neither a V3 exporter nor an import route.
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { buildSectionPlanningSnapshot, SECTION_PLANNING_VERSION, SECTION_PLANNING_RULE_REVISION } from '../section-planner.mjs';
import { generatePlannedSectionDraft, PLANNED_GENERATOR_CONTRACT } from '../planned-generation.mjs';
import { REPORT_PROFILE_ID } from '../section-contracts.mjs';
import { getAiStatus, runStructuredCodexJob } from '../codex-cli.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const tally = values => Object.fromEntries([...new Set(values)].sort().map(value => [value, values.filter(candidate => candidate === value).length]));
const exists = async path => { try { await access(path); return true; } catch { return false; } };
const within = (parent, child) => { const path = relative(parent, child); return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`)); };

function options(argv) {
  const parsed = { live: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--live') parsed.live = true;
    else if (arg === '--help') parsed.help = true;
    else if (['--input-dir', '--output-dir'].includes(arg) && argv[index + 1] && !argv[index + 1].startsWith('--')) parsed[arg.slice(2)] = argv[++index];
    else throw new Error(`Unknown or incomplete option: ${arg}`);
  }
  if (!parsed.help && (!parsed['input-dir'] || !parsed['output-dir'])) throw new Error('--input-dir and --output-dir are required.');
  return parsed;
}

const tableMap = {
  v3_inspection_record: 'inspectionRecord', v3_inspection_task: 'task',
  v3_layout_target: 'layoutTargets', v3_layout_config: 'layoutConfigs',
  v3_element: 'elements', v3_ut_measurement: 'utMeasurements',
  v3_checklist_item: 'inspectionChecklistItems', v3_checklist_section_note: 'inspectionChecklistSectionNotes',
  v3_finding: 'findings', v3_voice_note: 'voiceNotes', v3_attachment: 'attachments',
  v3_task_snapshot: 'taskSnapshots', v3_export_validation_result: 'validationResults',
};
// These are declared Room boolean columns, not values inferred from prose.
const booleanColumns = {
  v3_layout_target: ['inLayoutScope', 'layoutApproved', 'elementInScope', 'elementApproved', 'utInScope', 'utApproved'],
  v3_layout_config: ['roofHasCenterOpening', 'roofHasAnnularRing'],
  v3_ut_measurement: ['confirmed', 'measured'],
  v3_finding: ['hasMissingAttachment'],
  v3_voice_note: ['fileExists'], v3_attachment: ['fileExists'],
  v3_task_snapshot: ['inScope', 'isComplete', 'blocksExport'],
  v3_export_validation_result: ['passed', 'blocksExport'],
};

function diagnosticProjection(snapshot) {
  const ledger = [];
  const projection = {
    packageType: 'blocked_native_room_diagnostic_projection', schemaVersion: 1,
    inspectionId: snapshot.inspectionId,
    diagnosticMetadata: { sourcePackageType: snapshot.packageType, nativeExportReady: false, nativeImportPerformed: false },
  };
  for (const [sourceTable, destination] of Object.entries(tableMap)) {
    const rows = snapshot.tables[sourceTable];
    if (!Array.isArray(rows)) throw new Error(`Missing native table ${sourceTable}`);
    if (['inspectionRecord', 'task'].includes(destination) && rows.length !== 1) throw new Error(`${sourceTable} must contain exactly one native record.`);
    const activeLayoutTargets = new Set((snapshot.tables.v3_layout_target ?? []).filter(row => [true, 1].includes(row.inLayoutScope)).map(row => row.targetKey));
    const selected = rows.map((source, index) => ({ source, index })).filter(({ source, index }) => {
      if (sourceTable !== 'v3_layout_config' || activeLayoutTargets.has(source.targetKey)) return true;
      ledger.push({ sourcePointer: `/tables/${sourceTable}/${index}`, operation: 'exclude_inactive_default_layout_config_from_diagnostic_projection', nativeTargetKey: source.targetKey, basis: 'native v3_layout_target.inLayoutScope', sourceRowSha256: sha256(JSON.stringify(source)) });
      return false;
    });
    const converted = selected.map(({ source, index }, projectedIndex) => {
      if (source.inspectionId !== snapshot.inspectionId) throw new Error(`Cross-inspection row in ${sourceTable}/${index}`);
      const row = clone(source);
      const sourcePointer = `/tables/${sourceTable}/${index}`;
      const destinationPointer = `/${destination}${['inspectionRecord', 'task'].includes(destination) ? '' : `/${projectedIndex}`}`;
      ledger.push({ sourcePointer, destinationPointer, operation: 'copy_native_columns', sourceRowSha256: sha256(JSON.stringify(source)) });
      for (const column of booleanColumns[sourceTable] ?? []) {
        if (!Object.hasOwn(row, column) || row[column] == null) continue;
        if (![0, 1, false, true].includes(row[column])) throw new Error(`Unexpected native boolean ${sourcePointer}/${column}`);
        const before = row[column];
        row[column] = before === 1 || before === true;
        if (before !== row[column]) ledger.push({ sourcePointer: `${sourcePointer}/${column}`, destinationPointer: `${destinationPointer}/${column}`, operation: 'sqlite_boolean_to_boolean', before, after: row[column] });
      }
      if (sourceTable === 'v3_layout_config' && row.customCircularLayoutJson != null && row.customCircularLayoutJson !== '') {
        row.customCircularLayout = JSON.parse(row.customCircularLayoutJson);
        ledger.push({ sourcePointer: `${sourcePointer}/customCircularLayoutJson`, destinationPointer: `${destinationPointer}/customCircularLayout`, operation: 'parse_json_preserving_original_string' });
      }
      return row;
    });
    projection[destination] = ['inspectionRecord', 'task'].includes(destination) ? converted[0] : converted;
  }
  return { projection, ledger };
}

function authoredTranscriptProjection(baseline, scripts, aliases) {
  if (!Array.isArray(scripts) || !aliases.voices || typeof aliases.voices !== 'object') throw new Error('Expected source-scripts array and alias-manifest.voices mapping.');
  const projection = clone(baseline);
  const ledger = [];
  const seenScripts = new Set();
  const seenVoices = new Set();
  for (const script of scripts) {
    const id = script.voiceScriptId;
    if (!id || seenScripts.has(id) || typeof script.text !== 'string' || !script.text.trim()) throw new Error('Missing/duplicate script ID or empty authored text.');
    seenScripts.add(id);
    if (script.transcriptionMethod !== 'authored_script_not_asr') throw new Error(`Script ${id} must explicitly declare authored_script_not_asr.`);
    const alias = aliases.voices[id];
    const matching = projection.voiceNotes.map((row, index) => ({ row, index })).filter(({ row }) => row.voiceNoteId === alias?.voiceNoteId);
    if (matching.length !== 1 || seenVoices.has(alias.voiceNoteId)) throw new Error(`Script ${id} has no unique native voiceNoteId mapping.`);
    const { row, index } = matching[0];
    seenVoices.add(row.voiceNoteId);
    for (const key of ['screenKey', 'cardKey', 'fieldKey', 'targetKey', 'itemKey', 'itemLabel']) {
      if (Object.hasOwn(alias, key) && alias[key] !== row[key]) throw new Error(`Alias/native context mismatch for ${id}/${key}`);
    }
    ledger.push({
      voiceScriptId: id, nativeVoiceNoteId: row.voiceNoteId,
      source: `source-scripts.json#/${scripts.indexOf(script)}/text`, destinationPointer: `/voiceNotes/${index}`,
      operation: 'authored_transcript_substitution_for_diagnostic_only',
      origin: script.origin ?? null, transcriptionMethod: script.transcriptionMethod,
      before: { transcriptText: row.transcriptText, transcriptStatus: row.transcriptStatus },
      after: { transcriptText: script.text, transcriptStatus: 'transcribed_diagnostic_authored_script' },
      nativeCaptureContext: Object.fromEntries(['screenKey', 'cardKey', 'fieldKey', 'targetKey', 'itemKey', 'itemLabel'].map(key => [key, row[key] ?? null])),
    });
    row.transcriptText = script.text;
    // This accepted status is scoped to the diagnostic copy, never written to
    // Room, an export, a report job, or an ASR result.
    row.transcriptStatus = 'transcribed_diagnostic_authored_script';
  }
  projection.diagnosticMetadata.authoredTranscriptSubstitution = true;
  projection.diagnosticMetadata.asrPerformed = false;
  return { projection, ledger };
}

function routing(snapshot, drafts) {
  const uses = snapshot.sectionPlans.flatMap(plan => plan.evidenceUses);
  const contents = drafts.map(result => result.draft.content).join('\n');
  const records = snapshot.evidenceRecords.map(record => ({
    evidenceId: record.evidenceId, kind: record.kind, sourceClass: record.sourceClass,
    sourceRef: record.sourceRef, captureContext: record.captureContext, locationRef: record.locationRef,
    classificationFacts: record.classificationFacts, text: record.displayText,
    quality: record.quality,
    destinations: uses.filter(use => use.evidenceIds.includes(record.evidenceId)).map(use => ({ sectionId: use.sectionId, slotKey: use.slotKey, role: use.role, basis: use.decision })),
    emittedInDraft: contents.includes(`data-evidence-id="${record.evidenceId}"`),
  }));
  const byId = new Map(records.map(record => [record.evidenceId, record]));
  return {
    records,
    counts: { evidenceRecords: records.length, evidenceByKind: tally(records.map(record => record.kind)), issuesByReason: tally(records.flatMap(record => record.quality.issues.map(issue => issue.reason))), routedRecords: records.filter(record => record.destinations.length).length, emittedDistinctRecords: records.filter(record => record.emittedInDraft).length },
    measurements: snapshot.evidenceRecords.filter(record => record.kind === 'measurement').map(record => ({ ...byId.get(record.evidenceId), nativeItemKind: record.sourceRecord.itemKind, nativeUnitCode: record.sourceRecord.unitCode ?? null, nativeUnit: record.sourceRecord.unit ?? null, resolvedUnitCode: record.payload.unitCode, unitSource: record.payload.unitSource, cells: record.payload.cells })),
    proposedActions: records.filter(record => record.classificationFacts.action),
    unresolvedEvidence: snapshot.unresolvedEvidence,
    sections: snapshot.sectionPlans.map(plan => ({ sectionId: plan.sectionId, title: plan.title, status: plan.status, applicability: plan.applicability, scopeReviewRequired: plan.scopeReviewRequired, evidenceUseCount: plan.evidenceUses.length, outputObligationCount: plan.outputObligations.length, missingRequirements: plan.missingRequirements, generation: drafts.find(result => result.generationRun.sectionId === plan.sectionId)?.generationRun })),
  };
}

function htmlReport(label, drafts, snapshot, sourceMetadata) {
  const rows = drafts.map(result => {
    const run = result.generationRun;
    return `<article id="${esc(run.sectionId)}"><p class="status">${esc(run.statusCode)} · ${esc(run.providerCode)}</p>${result.draft.content}<details><summary>Diagnostic blockers and warnings (${run.blockers.length + run.warnings.length})</summary><ul>${[...run.blockers, ...run.warnings].map(warning => `<li>${esc(warning)}</li>`).join('')}</ul></details></article>`;
  }).join('\n');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SYN-025 ${esc(label)}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:1100px;margin:2rem auto;padding:0 1.5rem;color:#172b40}h1,h2,h3{line-height:1.25}article{border-top:1px solid #ccd5df;margin-top:2rem;padding-top:1rem}.notice{background:#fff3cb;border:1px solid #bd952d;padding:1rem}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{border:1px solid #bbc7d5;padding:.5rem;text-align:left;vertical-align:top}th{background:#edf2f8}details{background:#f3f5f8;padding:.75rem;margin:1rem 0}.status{color:#5a4560;font-size:.85rem}a{color:#175c9e}@media print{details{display:block}article{break-before:page}}</style><h1>SYN-025 · ${esc(label)}</h1><div class="notice"><strong>Evaluation diagnostic only. Native export was blocked.</strong><p>This is a projection of persisted app tables, not an imported or approved report. ${label === 'Authored transcript projection' ? 'Voice text was substituted from authored scripts in this diagnostic copy; no speech recognition was performed.' : 'Native voice status and transcript values are retained exactly in this baseline.'} All sections require scope review. No independent benchmark labels or recovery score are present.</p><p>Runtime profile: ${esc(REPORT_PROFILE_ID)} (${snapshot.sectionPlans.length} sections). The proposed 25-section catalogue is not active here. No policy, database, KB index, or production configuration was changed. No source evidence appendix was added.</p><p>Input origins: ${esc(JSON.stringify(sourceMetadata))}</p></div><nav><ol>${drafts.map(result => `<li><a href="#${esc(result.generationRun.sectionId)}">${esc(snapshot.sectionPlans.find(plan => plan.sectionId === result.generationRun.sectionId)?.title)}</a></li>`).join('')}</ol></nav>${rows}</html>\n`;
}

async function main() {
  const args = options(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node server/scripts/run-syn025-preprocessing-diagnostic.mjs --input-dir PATH --output-dir NEW_PATH [--live]\nReads a blocked native-room-snapshot plus source-scripts, alias-manifest and media-manifest. Default: deterministic generation. --live: additionally attempt only inspection-report with the configured default worker. No native import or benchmark scoring.');
    return;
  }
  const inputDir = await realpath(resolve(args['input-dir']));
  const outputDir = resolve(args['output-dir']);
  if (within(inputDir, outputDir)) throw new Error('Output must be outside the immutable input directory.');
  if (await exists(outputDir)) throw new Error('Output directory already exists; choose a new directory to preserve prior diagnostics.');
  const files = ['native-room-snapshot.json', 'source-scripts.json', 'alias-manifest.json', 'media-manifest.json'];
  const inputs = {};
  const inputHashes = {};
  for (const filename of files) {
    const bytes = await readFile(join(inputDir, filename));
    inputs[filename] = JSON.parse(bytes);
    inputHashes[filename] = { sha256: sha256(bytes), bytes: bytes.length };
  }
  // Provenance and native completeness diagnostics never enter classifier input.
  for (const filename of ['source-photos.json', 'artifact-manifest.json', 'validation.json']) {
    if (!(await exists(join(inputDir, filename)))) continue;
    const bytes = await readFile(join(inputDir, filename));
    inputs[filename] = JSON.parse(bytes);
    inputHashes[filename] = { sha256: sha256(bytes), bytes: bytes.length };
  }
  const raw = inputs['native-room-snapshot.json'];
  if (raw.packageType !== 'syn025_native_room_diagnostic' || raw.schemaVersion !== 1 || raw.exportReady !== false || !raw.exportFailure?.message || !raw.inspectionId || !raw.tables) throw new Error('Expected a test-emitted SYN-025 diagnostic snapshot with an actual blocked native export.');
  if (!Array.isArray(raw.tables.v3_export_package) || raw.tables.v3_export_package.length) throw new Error('Blocked native snapshot must not contain a successful export package.');
  const blockers = raw.tables.v3_export_validation_result?.filter(row => [true, 1].includes(row.blocksExport) && [false, 0].includes(row.passed));
  if (!blockers?.length) throw new Error('Native snapshot has no recorded failed export-blocking validation result.');
  const baseline = diagnosticProjection(raw);
  const authored = authoredTranscriptProjection(baseline.projection, inputs['source-scripts.json'], inputs['alias-manifest.json']);
  const manifest = inputs['media-manifest.json'];
  const sourceMetadata = {
    caseOrigin: inputs['artifact-manifest.json']?.origin ?? raw.origin ?? raw.provenance ?? raw.caseProvenance ?? null,
    mediaOrigin: manifest.origin ?? manifest.provenance ?? null,
    scriptOrigins: [...new Set(inputs['source-scripts.json'].map(script => script.origin ?? 'undeclared'))],
    mediaObjects: manifest.objects ?? [],
    sourcePhotos: inputs['source-photos.json'] ?? null,
    nativeSnapshotLimitations: raw.limitations ?? [],
  };
  const mediaChecks = [];
  for (const object of manifest.objects ?? []) {
    const file = object.file;
    if (typeof file !== 'string' || isAbsolute(file) || !within(inputDir, resolve(inputDir, file))) throw new Error('Media manifest path must stay within input directory.');
    const nativeRelativePaths = [...new Set([...baseline.projection.attachments, ...baseline.projection.voiceNotes].map(row => row.relativePath).filter(path => typeof path === 'string' && basename(path) === file))];
    const candidates = [file, ...nativeRelativePaths.map(path => `files/${path}`)];
    const presentPaths = [];
    for (const candidate of candidates) {
      if (!within(inputDir, resolve(inputDir, candidate))) throw new Error('Native media path escapes input directory.');
      if (await exists(join(inputDir, candidate))) presentPaths.push(candidate);
    }
    if (!presentPaths.length) { mediaChecks.push({ file, status: 'not_present_in_diagnostic_input', manifestSha256: object.sha256 ?? null, nativeFileExistsIsSeparate: true }); continue; }
    for (const relativePath of presentPaths) {
      const path = join(inputDir, relativePath);
      const resolvedFile = await realpath(path);
      if (!within(inputDir, resolvedFile)) throw new Error('Media symlink escapes input directory.');
      const bytes = await readFile(path);
      const actualSha256 = sha256(bytes);
      mediaChecks.push({ file, relativePath, bytes: bytes.length, actualSha256, manifestSha256: object.sha256 ?? null, status: object.sha256 ? (actualSha256 === object.sha256 ? 'hash_verified' : 'hash_mismatch') : 'manifest_hash_missing' });
      if (object.sha256 && actualSha256 !== object.sha256) throw new Error(`Media hash mismatch: ${file}`);
      if (object.bytes != null && bytes.length !== object.bytes) throw new Error(`Media byte count mismatch: ${file}`);
      inputHashes[relativePath] = { sha256: actualSha256, bytes: bytes.length };
    }
  }
  await mkdir(dirname(outputDir), { recursive: true });
  const realParent = await realpath(dirname(outputDir));
  if (within(inputDir, realParent)) throw new Error('Output parent resolves inside the immutable input directory.');
  await mkdir(outputDir);
  const writeJson = (filename, value) => writeFile(join(outputDir, filename), json(value), { flag: 'wx' });
  await writeJson('provenance.json', { inputDir, inputHashes, sourceMetadata, mediaChecks, nativeExportReady: false, exportFailure: raw.exportFailure, nativeExportBlockers: blockers, nativeValidation: inputs['validation.json'] ?? null, nativeTableRowCounts: Object.fromEntries(Object.entries(raw.tables).map(([table, rows]) => [table, rows.length])), baselineTransformationLedger: baseline.ledger, authoredTranscriptLedger: authored.ledger });
  const summary = {
    schemaVersion: 1, caseId: raw.inspectionId, evaluationOnly: true,
    nativeExportReady: false, nativeImportPerformed: false, successfulImportValidationClaimed: false,
    sourceSnapshotSha256: inputHashes['native-room-snapshot.json'].sha256,
    inputOrigins: sourceMetadata, exportFailure: raw.exportFailure, nativeExportBlockers: blockers,
    nativeChecklistState: inputs['validation.json'] ? {
      ratedChecklistItems: inputs['validation.json'].ratedChecklistItems,
      totalChecklistItems: inputs['validation.json'].totalChecklistItems,
      unansweredItemNumbers: inputs['validation.json'].unansweredItemNumbers,
      note: 'Only persisted checklist rows enter the planner; absent unanswered rows were not fabricated.',
    } : null,
    reportProfileId: REPORT_PROFILE_ID, plannerContract: SECTION_PLANNING_VERSION,
    plannerRuleRevision: SECTION_PLANNING_RULE_REVISION, generatorContract: PLANNED_GENERATOR_CONTRACT,
    generic25CatalogueActivated: false, independentlyApprovedBenchmark: false, recoveryScore: null,
    benchmarkLimitation: 'No independently approved reference labels. Planner obligations are execution diagnostics, not an independent truth set. Authored transcripts do not test ASR; source photographs may be report-derived. Inspect manifest provenance.',
    nativeParityClaimed: false, asrPerformed: false, kbRetrievalPerformed: false,
    policyPromotionPerformed: false, productionChanged: false, decisionsSupplied: 0,
    manualInputsSupplied: 0, expected25SlotLabelsUsedAsInput: false,
    variants: {}, live: { requested: args.live, attempted: false },
  };
  let authoredState;
  for (const [key, label, variant] of [['native-baseline', 'Native pending-transcript baseline', baseline], ['authored-transcripts', 'Authored transcript projection', authored]]) {
    const scope = { inspectionId: raw.inspectionId, tenantId: variant.projection.inspectionRecord.tenantId, workspaceId: variant.projection.inspectionRecord.workspaceId, reportProfileId: REPORT_PROFILE_ID };
    const frozen = JSON.stringify(variant.projection);
    const planning = buildSectionPlanningSnapshot({ exportPackage: variant.projection, manualInputs: {}, decisions: [], scope });
    const reportState = { exportPackage: variant.projection, sectionPlanning: planning };
    const drafts = [];
    for (const plan of planning.sectionPlans) drafts.push(await generatePlannedSectionDraft({ reportState, sectionId: plan.sectionId, aiStatus: { configured: false, mode: 'deterministic_diagnostic' } }));
    if (JSON.stringify(variant.projection) !== frozen) throw new Error('Shared planner/generator mutated the diagnostic input.');
    const report = routing(planning, drafts);
    await mkdir(join(outputDir, key));
    await writeJson(`${key}/diagnostic-projection.json`, variant.projection);
    await writeJson(`${key}/section-planning.json`, planning);
    await writeJson(`${key}/routing-and-issues.json`, report);
    await writeJson(`${key}/draft-report.json`, { evaluationOnly: true, nativeExportBlocked: true, transcriptionSource: key === 'authored-transcripts' ? 'authored_script_not_asr' : 'unchanged_native', drafts });
    await writeFile(join(outputDir, key, 'draft-report.html'), htmlReport(label, drafts, planning, sourceMetadata), { flag: 'wx' });
    summary.variants[key] = {
      projectionSha256: sha256(frozen), plannerInputHash: planning.inputPackageHash, planSnapshotId: planning.snapshotId,
      sectionCount: planning.sectionPlans.length, ...report.counts,
      sectionsWithRenderedEvidence: drafts.filter(result => /data-evidence-id=/.test(result.draft.content)).length,
      sectionsWithBlockers: drafts.filter(result => result.generationRun.blockers.length).length,
      proposedActions: report.proposedActions.map(record => ({ evidenceId: record.evidenceId, text: record.text, destinations: record.destinations, issues: record.quality.issues, emittedInDraft: record.emittedInDraft })),
      measurementOutcomes: report.measurements.map(record => ({ evidenceId: record.evidenceId, itemLabel: record.locationRef.itemLabel, nativeItemKind: record.nativeItemKind, resolvedUnitCode: record.resolvedUnitCode, destinations: record.destinations, issues: record.quality.issues, emittedInDraft: record.emittedInDraft })),
      files: [`${key}/diagnostic-projection.json`, `${key}/section-planning.json`, `${key}/routing-and-issues.json`, `${key}/draft-report.json`, `${key}/draft-report.html`],
    };
    if (key === 'authored-transcripts') authoredState = reportState;
  }
  if (args.live) {
    const aiStatus = getAiStatus();
    summary.live.aiStatus = aiStatus;
    if (aiStatus.configured) {
      const frozen = JSON.stringify(authoredState.exportPackage);
      // Retain the actual request and response even if the shared generator
      // rejects the wording. Otherwise a failed live evaluation cannot be
      // reviewed. This wrapper does not change the prompt or acceptance gate.
      const worker = async request => {
        await writeJson('live-worker-request.json', { sectionId: 'inspection-report', photoBytesIncluded: false, audioBytesIncluded: false, request });
        try {
          const response = await runStructuredCodexJob(request);
          await writeJson('live-worker-response.json', response);
          return response;
        } catch (error) {
          await writeJson('live-worker-error.json', { message: String(error.message) });
          throw error;
        }
      };
      const result = await generatePlannedSectionDraft({ reportState: authoredState, sectionId: 'inspection-report', aiStatus, worker });
      if (JSON.stringify(authoredState.exportPackage) !== frozen) throw new Error('Live generator mutated diagnostic input.');
      summary.live = { ...summary.live, attempted: true, sectionId: 'inspection-report', usedLiveModel: result.generationRun.usedLiveModel, fallbackReason: result.generationRun.fallbackReason, providerCode: result.generationRun.providerCode, modelId: result.generationRun.modelId };
      await writeJson('live-inspection-report.json', { transcriptionMethod: 'authored_script_not_asr', result });
      await writeFile(join(outputDir, 'live-inspection-report.html'), htmlReport('Authored transcript projection', [result], authoredState.sectionPlanning, sourceMetadata), { flag: 'wx' });
    } else summary.live.reason = 'Configured default worker is unavailable; no live attempt was made.';
  }
  for (const [file, expected] of Object.entries(inputHashes)) if (sha256(await readFile(join(inputDir, file))) !== expected.sha256) throw new Error(`Source changed during diagnostic: ${file}`);
  summary.sourceBytesUnchanged = true;
  await writeJson('summary.json', summary);
  console.log(json({ outputDir, nativeExportReady: false, sourceBytesUnchanged: true, variants: Object.fromEntries(Object.entries(summary.variants).map(([key, value]) => [key, { sectionCount: value.sectionCount, evidenceRecords: value.evidenceRecords, issuesByReason: value.issuesByReason, sectionsWithRenderedEvidence: value.sectionsWithRenderedEvidence }])), live: summary.live, independentlyApprovedBenchmark: false, recoveryScore: null }));
}

main().catch(error => { console.error(`SYN-025 diagnostic failed: ${error.message}`); process.exitCode = 1; });
