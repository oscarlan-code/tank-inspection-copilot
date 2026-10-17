import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  canonicalSha256,
  deterministicExecutionProfile,
  freezeAgentExecutionConfiguration,
} from '../../evaluation-contracts/v1/agent-configuration.mjs';
import {
  buildAtomicEvaluationMatrix,
  freezeAtomicEvaluationCase,
} from '../../evaluation-contracts/v1/atomic-evaluation.mjs';

const GOLD_MAP_URL = new URL('./tk5452-gold-semantic-map.json', import.meta.url);
const RELEASES = Object.freeze({
  router: new URL('../../../report-evidence-router/releases/v2/manifest.json', import.meta.url),
  'scope-of-inspection:generator': new URL('../../releases/scope-of-inspection/generator/v1/manifest.json', import.meta.url),
  'scope-of-inspection:reviewer': new URL('../../releases/scope-of-inspection/reviewer/v1/manifest.json', import.meta.url),
  'scope-of-inspection:evaluator': new URL('../../releases/scope-of-inspection/evaluator/v1/manifest.json', import.meta.url),
  'general-tank-information:generator': new URL('../../releases/general-tank-information/generator/v3/manifest.json', import.meta.url),
  'general-tank-information:reviewer': new URL('../../releases/general-tank-information/reviewer/v2/manifest.json', import.meta.url),
  'general-tank-information:evaluator': new URL('../../releases/general-tank-information/evaluator/v2/manifest.json', import.meta.url),
});

const sha = value => canonicalSha256(value);
const normalized = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9.%°-]+/g, '');

function renderedScopeClaim(run, claimId, fallback) {
  const content = String(run.execution?.presentation?.draft?.content ?? '');
  const safeId = String(claimId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = content.match(new RegExp(`<p[^>]*data-evidence-id=["']scope-claim:${safeId}["'][^>]*>([\\s\\S]*?)<\\/p>`, 'i'));
  if (!match) return fallback;
  return match[1]
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/^\s*➢\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(url) {
  const bytes = await readFile(fileURLToPath(url));
  return {
    value: JSON.parse(bytes.toString('utf8')),
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function schemaBinding(direction, schemaId, version) {
  return { direction, schemaId, version, sha256: sha(`${schemaId}@${version}`) };
}

function knowledgeSnapshot(manifest, path, kind, releaseId) {
  const fileSha = manifest.files?.[path];
  if (!fileSha) return null;
  return { kind, snapshotId: `${releaseId}:${path}`, version: releaseId, sha256: fileSha };
}

function configSummary(configuration) {
  return {
    configurationId: configuration.configurationId,
    agentRole: configuration.agentRole,
    agentId: configuration.agentId,
    releaseId: configuration.releaseId,
    configurationSha256: configuration.configurationSha256,
  };
}

function buildConfiguration({
  configurationId,
  agentRole,
  agentId,
  releaseId,
  releaseManifestSha256,
  releaseManifest,
  gitCommit,
  prompt = null,
  knowledgeSnapshots = [],
  schemaBindings,
  evaluatorRubric = null,
}) {
  const execution = deterministicExecutionProfile('this recorded stage used deterministic release code');
  return freezeAgentExecutionConfiguration({
    configurationId,
    agentRole,
    agentId,
    releaseId,
    releaseManifestSha256,
    executionMode: 'evaluation',
    implementation: { gitCommit },
    model: execution.model,
    prompt: prompt ?? execution.prompt,
    knowledgeSnapshots: knowledgeSnapshots.filter(Boolean),
    schemaBindings,
    ...(evaluatorRubric ? { evaluatorRubric } : {}),
  }, { releaseManifest });
}

async function buildAgentConfigurations({ sectionRuns, routerReleaseBinding, routerManifestSha256, gitCommit }) {
  const manifests = Object.fromEntries(await Promise.all(Object.entries(RELEASES).map(async ([key, url]) => {
    const artifact = await readJson(url);
    return [key, artifact];
  })));
  invariant(manifests.router.sha256 === routerManifestSha256, 'Router configuration manifest hash changed.');
  const routerManifest = manifests.router.value;
  const configurations = [buildConfiguration({
    configurationId: 'tk5452.report-evidence-router.v2',
    agentRole: 'report_evidence_router',
    agentId: routerReleaseBinding.agentId,
    releaseId: routerReleaseBinding.releaseId,
    releaseManifestSha256: manifests.router.sha256,
    releaseManifest: routerManifest,
    gitCommit,
    knowledgeSnapshots: [
      knowledgeSnapshot(routerManifest, 'routing-taxonomy.json', 'routing_taxonomy', routerReleaseBinding.releaseId),
      knowledgeSnapshot(routerManifest, 'section-block-registry.json', 'section_block_registry', routerReleaseBinding.releaseId),
      knowledgeSnapshot(routerManifest, 'kb-policy.json', 'knowledge_policy', routerReleaseBinding.releaseId),
    ],
    schemaBindings: [
      schemaBinding('input', 'v3_product_export', '3.0.0'),
      { direction: 'output', schemaId: 'report_evidence_router_output', version: '2.0.0', sha256: routerManifest.files['output-schema.json'] },
    ],
  })];

  for (const run of sectionRuns) {
    const sectionId = run.spec.sectionId;
    const generatorArtifact = manifests[`${sectionId}:generator`];
    const reviewerArtifact = manifests[`${sectionId}:reviewer`];
    const evaluatorArtifact = manifests[`${sectionId}:evaluator`];
    const generatorManifest = generatorArtifact.value;
    const reviewerManifest = reviewerArtifact.value;
    const evaluatorManifest = evaluatorArtifact.value;
    invariant(generatorArtifact.sha256 === run.releaseManifestSha256,
      `${sectionId} generator configuration manifest hash changed.`);
    invariant(reviewerArtifact.sha256 === run.execution.preDisplayReview.release.manifestSha256,
      `${sectionId} reviewer configuration manifest hash changed.`);
    invariant(evaluatorArtifact.sha256 === run.evaluatorResult.release.manifestSha256,
      `${sectionId} evaluator configuration manifest hash changed.`);
    configurations.push(
      buildConfiguration({
        configurationId: `${sectionId}.generator.${run.spec.releaseVersion}`,
        agentRole: 'section_generator',
        agentId: run.execution.generationResult.release.agentId,
        releaseId: run.spec.releaseVersion,
        releaseManifestSha256: generatorArtifact.sha256,
        releaseManifest: generatorManifest,
        gitCommit,
        knowledgeSnapshots: [
          knowledgeSnapshot(generatorManifest, 'kb-policy.json', 'knowledge_policy', run.spec.releaseVersion),
          knowledgeSnapshot(generatorManifest, 'section-pattern-pack.json', 'section_pattern_pack', run.spec.releaseVersion),
          knowledgeSnapshot(generatorManifest, 'standard-obligation-pack.json', 'standard_obligation_pack', run.spec.releaseVersion),
          knowledgeSnapshot(generatorManifest, 'agent-instructions.md', 'agent_instruction', run.spec.releaseVersion),
        ],
        schemaBindings: [
          schemaBinding('input', 'section_agent_evidence_snapshot', '1.0.0'),
          schemaBinding('output', 'report_document', '2.0.0'),
        ],
      }),
      buildConfiguration({
        configurationId: `${sectionId}.reviewer.${run.execution.preDisplayReview.release.version}`,
        agentRole: 'pre_display_reviewer',
        agentId: run.execution.preDisplayReview.release.reviewerId,
        releaseId: run.execution.preDisplayReview.release.version,
        releaseManifestSha256: reviewerArtifact.sha256,
        releaseManifest: reviewerManifest,
        gitCommit,
        knowledgeSnapshots: [
          knowledgeSnapshot(reviewerManifest, 'knowledge-review-policy.json', 'review_policy', run.execution.preDisplayReview.release.version),
          knowledgeSnapshot(reviewerManifest, 'reviewer-instructions.md', 'reviewer_instruction', run.execution.preDisplayReview.release.version),
        ],
        schemaBindings: [
          schemaBinding('input', 'section_generation_result', '1.0.0'),
          schemaBinding('output', 'section_review_result', '1.0.0'),
        ],
      }),
      buildConfiguration({
        configurationId: `${sectionId}.evaluator.${run.evaluatorResult.release.version}`,
        agentRole: 'post_generation_evaluator',
        agentId: run.evaluatorResult.release.evaluatorId,
        releaseId: run.evaluatorResult.release.version,
        releaseManifestSha256: evaluatorArtifact.sha256,
        releaseManifest: evaluatorManifest,
        gitCommit,
        prompt: {
          mode: 'pinned',
          promptId: `${sectionId}-gold-evaluator`,
          promptVersion: `${Number(run.evaluatorResult.release.version.match(/\d+/)?.[0] ?? 1)}.0.0`,
          artifactPath: 'evaluator-instructions.md',
          artifactSha256: evaluatorManifest.files['evaluator-instructions.md'],
        },
        knowledgeSnapshots: [
          knowledgeSnapshot(evaluatorManifest, 'evaluator-spec.json', 'evaluator_spec', run.evaluatorResult.release.version),
        ],
        schemaBindings: [
          schemaBinding('input', 'sealed_section_gold_and_generation', '1.0.0'),
          { direction: 'output', schemaId: 'section_gold_evaluation_result', version: '1.0.0', sha256: evaluatorManifest.files['output-schema.json'] },
        ],
        evaluatorRubric: {
          rubricId: `${sectionId}-gold-rubric`,
          version: `${Number(run.evaluatorResult.release.version.match(/\d+/)?.[0] ?? 1)}.0.0`,
          sha256: evaluatorManifest.files['rubric.json'],
        },
      }),
    );
  }
  return configurations;
}

function unitRef(artifactId, jsonPointer, artifactSha256) {
  return { artifactId, jsonPointer, artifactSha256 };
}

function protectedFactsMatch(expected, observed) {
  return expected.every(fact => observed.some(candidate => candidate.factId === fact.factId
    && candidate.key === fact.key && candidate.unitCode === fact.unitCode
    && JSON.stringify(candidate.value) === JSON.stringify(fact.value)));
}

function scopeClaimFacts(claim) {
  const text = normalized([claim.action, claim.target, claim.method, claim.extent, ...(claim.conditions ?? []),
    ...(claim.controlledReferences ?? [])].join(' '));
  const facts = [];
  const add = (factId, key, value, unitCode = null) => facts.push({ factId, key, value, unitCode });
  if (claim.claimId === 'roof-ut') {
    add('roof-target', 'target', 'roof_plates');
    if (/five|5/.test(text)) add('roof-min-readings', 'minimumReadingsPerPlate', 5);
    if (text.includes('access') && text.includes('safety') && text.includes('surface')) add('roof-access-condition', 'accessSafetySurfaceCondition', true);
  } else if (claim.claimId === 'shell-ut') {
    add('shell-target', 'target', 'shell');
    if (text.includes('crawler') && text.includes('suitable')) add('shell-crawler-method', 'crawlerOrSuitableAlternative', true);
    if (['north', 'east', 'south', 'west'].every(point => text.includes(point))) add('shell-compass-points', 'compassPointCount', 4);
    if (/five|5/.test(text)) add('shell-min-readings', 'minimumReadingsPerCourse', 5);
  } else if (claim.claimId === 'floor-mfl') {
    add('mfl-target', 'target', 'floor_plates'); add('mfl-method', 'method', 'mfl_map');
    if (text.includes('ultrasoniccontinuouscorrosion')) add('mfl-ut-support', 'continuousUtSupport', true);
  } else if (claim.claimId === 'floor-edge-ut') {
    if (text.includes('100mm')) add('edge-band-width', 'bandWidth', 100, 'mm');
    if (text.includes('notaccessibletomfl')) add('edge-mfl-restricted', 'includesMflRestrictedAreas', true);
  } else if (claim.claimId === 'sump-ut') {
    add('sump-target', 'target', 'tank_bottom_sump'); add('sump-method', 'method', 'thickness_measurements');
  } else if (claim.claimId === 'floor-bscan') {
    add('bscan-target', 'target', 'selected_floor_areas'); add('bscan-method', 'method', 'ultrasonic_b_scan');
  } else if (claim.claimId === 'nozzle-piping-ut') {
    add('nozzle-target', 'target', 'internal_external_nozzles_and_piping');
    add('nozzle-location', 'pipingContext', text.includes('disconnected') ? 'disconnected_piping' : text.includes('withintank') ? 'within_tank' : 'unspecified');
    add('nozzle-method', 'method', 'ultrasonic_spot_measurements');
  } else if (claim.claimId === 'visual') {
    add('visual-method', 'generalVisualInspection', true);
    if (text.includes('detrimental') || text.includes('serviceability')) add('visual-record-condition', 'recordDetrimentalConditions', true);
  } else if (claim.claimId === 'api-assessment') {
    add('report-deliverable', 'deliverable', text.includes('fullreport') ? 'full_report' : 'final_assessment');
    if (text.includes('reading') && text.includes('location')) add('report-reading-locations', 'readingLocationsIncluded', true);
    if (text.includes('api653')) add('report-api-653', 'api653Review', true);
    if (text.includes('engineeringintegrity')) add('report-eia', 'engineeringIntegrityAssessment', true);
    if (text.includes('comments')) add('report-comments', 'commentsIncluded', true);
  }
  return facts;
}

function atomicGrader(id, configurationSha256, type = 'deterministic') {
  return { type, id, version: '1.0.0', configurationSha256 };
}

function buildScopeCase({ run, goldMap, configurationRefs, appExportSha256 }) {
  const sectionId = run.spec.sectionId;
  const claims = run.execution.generationResult.evaluationEvidence.claims;
  const claimById = new Map(claims.map(claim => [claim.claimId, claim]));
  const evidenceByNote = new Map();
  for (const record of run.projection.evidenceRecords) {
    const noteId = record.payload?.voiceNoteId ?? record.sourceRecord?.voiceNoteId;
    if (!noteId || !goldMap.units.some(unit => claimById.get(unit.claimId)?.appEvidenceRefs?.some(ref => ref.id === noteId))) continue;
    const saved = evidenceByNote.get(noteId) ?? { records: [], claims: [] };
    saved.records.push(record);
    evidenceByNote.set(noteId, saved);
  }
  for (const claim of claims) {
    for (const ref of claim.appEvidenceRefs ?? []) {
      const saved = evidenceByNote.get(ref.id);
      if (saved) saved.claims.push(claim);
    }
  }
  const sourceUnits = goldMap.units.map((unit, index) => ({
    unitId: `src:${sectionId}:${unit.claimId}`,
    layer: 'source', unitType: 'scope_item', sectionId, outlineBlockId: goldMap.outlineBlockId,
    semanticKey: unit.semanticKey, criticality: 'required', disposition: 'required_current_fact', requiredInMock: true,
    contentRef: unitRef(`${sectionId}.sealed-gold`, `/semanticUnits/${index}`, run.evaluatorResult.trace.goldContentSha256),
    contentSha256: sha(unit.text), contentPreview: unit.text, protectedFacts: unit.protectedFacts,
  }));
  const evidenceUnits = [...evidenceByNote.entries()].map(([noteId, value]) => {
    const content = value.records.map(record => record.displayText ?? record.payload?.text).filter(Boolean).join(' ');
    return {
      unitId: `ev:${sectionId}:${noteId}`, layer: 'evidence', unitType: 'scope_item', sectionId,
      outlineBlockId: goldMap.outlineBlockId, semanticKey: `scope.voice_note.${noteId}`,
      criticality: 'required', generationEligible: true, captureChannel: 'voice_note',
      contentRef: unitRef('input.app-export', value.records[0]?.sourceRef?.pointer ?? `/voiceNotes/${noteId}`, appExportSha256),
      contentSha256: sha(content), contentPreview: content,
      protectedFacts: value.claims.flatMap(scopeClaimFacts),
    };
  });
  const generatedUnits = claims.map((claim, index) => {
    const fallback = [claim.action, claim.target, claim.method, claim.extent, ...(claim.conditions ?? []),
      ...(claim.controlledReferences ?? [])].filter(Boolean).join(' ');
    const contentPreview = renderedScopeClaim(run, claim.claimId, fallback);
    return {
      unitId: `gen:${sectionId}:${claim.claimId}`, layer: 'generated', unitType: 'scope_item', sectionId,
      outlineBlockId: goldMap.outlineBlockId, semanticKey: `generated.${goldMap.units.find(unit => unit.claimId === claim.claimId).semanticKey}`,
      criticality: 'required', claimType: claim.kind,
      contentRef: unitRef(`${sectionId}.generation-result`, `/evaluationEvidence/claims/${index}`,
        run.execution.preDisplayReview.trace.generationResultSha256),
      contentSha256: sha(claim), contentPreview,
      protectedFacts: scopeClaimFacts(claim),
    };
  });
  const compareSha = sha({ policy: 'tk5452_protected_fact_comparison_v1', goldMapSha256: sha(goldMap) });
  const comparator = atomicGrader('protected-fact-lineage-rule-engine', compareSha);
  const links = [];
  for (const sourceUnit of sourceUnits) {
    const mapUnit = goldMap.units.find(unit => unit.semanticKey === sourceUnit.semanticKey);
    const claim = claimById.get(mapUnit.claimId);
    const noteId = claim.appEvidenceRefs?.find(ref => ref.kind === 'app_voice_note')?.id;
    const evidenceUnit = evidenceUnits.find(unit => unit.unitId.endsWith(`:${noteId}`));
    const stageAPass = evidenceUnit && protectedFactsMatch(sourceUnit.protectedFacts, evidenceUnit.protectedFacts);
    links.push({
      linkId: `link:source-to-mock:${sectionId}:${mapUnit.claimId}`, stage: 'source_to_mock',
      fromUnitIds: [sourceUnit.unitId], toUnitIds: evidenceUnit ? [evidenceUnit.unitId] : [],
      relation: evidenceUnit ? 'preserves' : 'excluded', verdict: stageAPass ? 'pass' : 'fail', grader: comparator,
      explanation: stageAPass
        ? `The reviewed app voice note preserves every protected fact in ${mapUnit.claimId}.`
        : `The app voice note for ${mapUnit.claimId} omits or changes one or more protected source facts.`,
    });
    const generatedUnit = generatedUnits.find(unit => unit.unitId.endsWith(`:${mapUnit.claimId}`));
    const stageBPass = Boolean(evidenceUnit && generatedUnit
      && protectedFactsMatch(evidenceUnit.protectedFacts.filter(fact => claim && scopeClaimFacts(claim).some(item => item.factId === fact.factId)), generatedUnit.protectedFacts)
      && run.execution.presentation.draft.content.includes(`scope-claim:${mapUnit.claimId}`));
    if (evidenceUnit) links.push({
      linkId: `link:mock-to-generation:${sectionId}:${mapUnit.claimId}`, stage: 'mock_to_generation',
      fromUnitIds: [evidenceUnit.unitId], toUnitIds: [generatedUnit.unitId], relation: 'supports',
      verdict: stageBPass ? 'pass' : 'fail', grader: comparator,
      explanation: stageBPass
        ? `The generated ${mapUnit.claimId} record preserves the confirmed app-evidence claim.`
        : `The generated ${mapUnit.claimId} record does not preserve its confirmed app-evidence claim.`,
    });
  }
  const reviewer = run.execution.preDisplayReview;
  const reviewerConfig = configurationRefs.find(ref => ref.role === 'pre_display_reviewer');
  const evaluatorConfig = configurationRefs.find(ref => ref.role === 'post_generation_evaluator');
  const reviewGrader = atomicGrader(reviewer.release.reviewerId, reviewerConfig.configurationSha256);
  const evaluatorGrader = atomicGrader(run.evaluatorResult.release.evaluatorId, evaluatorConfig.configurationSha256, 'llm');
  return freezeAtomicEvaluationCase({
    caseId: `atomic:${run.spec.sectionId}:tk5452`, lineageId: 'inspection:TK5452', datasetSplit: 'validation',
    section: { profileId: 'vertical_tank_inspection_v1', sectionId, title: run.spec.sectionTitle },
    segmentationPolicy: 'semantic_obligation_v1', agentConfigurationRefs: configurationRefs,
    units: [...sourceUnits, ...evidenceUnits, ...generatedUnits], links,
    sectionAssessment: {
      format: { verdict: reviewer.checks.exactTitle && reviewer.checks.formatValid ? 'pass' : 'fail', grader: reviewGrader,
        explanation: 'The pre-display reviewer checked the exact title and section format contract.' },
      coherence: { verdict: 'not_available', grader: evaluatorGrader,
        explanation: 'Whole-section semantic coherence awaits the bounded post-generation judge.' },
    },
  });
}

function sourceFact(unit) {
  return { factId: `field:${unit.key}`, key: unit.key, value: unit.value, unitCode: unit.unitCode ?? null };
}

function observedFact(sourceUnit, observedValue) {
  const expected = sourceUnit.protectedFacts[0];
  let value = observedValue;
  if (typeof expected.value === 'number') {
    const parsed = Number.parseFloat(String(observedValue));
    value = Number.isFinite(parsed) ? parsed : observedValue;
  } else if (normalized(expected.value) === normalized(observedValue)) {
    value = expected.value;
  }
  return { ...expected, value };
}

function buildGeneralInformationCase({ run, goldMap, configurationRefs, appExportSha256 }) {
  const sectionId = run.spec.sectionId;
  const fields = run.execution.generationResult.evaluationEvidence.fields;
  const sourceUnits = goldMap.units.map((unit, index) => {
    const displayed = unit.displayValue ?? unit.value;
    return {
      unitId: `src:${sectionId}:${unit.key}`, layer: 'source', unitType: 'structured_field', sectionId,
      outlineBlockId: goldMap.outlineBlockId, semanticKey: `tank_information.${unit.key}`,
      criticality: 'required', disposition: 'required_current_fact', requiredInMock: true,
      contentRef: unitRef(`${sectionId}.sealed-gold`, `/semanticUnits/${index}`, run.evaluatorResult.trace.goldContentSha256),
      contentSha256: sha({ label: unit.label, value: displayed }), contentPreview: `${unit.label}: ${displayed}`,
      protectedFacts: [sourceFact(unit)],
    };
  });
  const evidenceUnits = fields.map((field, index) => {
    const sourceUnit = sourceUnits.find(unit => unit.unitId.endsWith(`:${field.key}`));
    invariant(sourceUnit, `${field.key}: generated field is not represented in the reviewed gold semantic map.`);
    return {
      unitId: `ev:${sectionId}:${field.key}`, layer: 'evidence', unitType: 'structured_field', sectionId,
      outlineBlockId: goldMap.outlineBlockId, semanticKey: `app.tank_information.${field.key}`,
      criticality: 'required', generationEligible: true, captureChannel: field.sourceClass,
      contentRef: unitRef('input.app-export', field.sourcePointer, appExportSha256),
      contentSha256: sha({ key: field.key, value: field.sourceValue }), contentPreview: `${field.label}: ${field.displayValue}`,
      protectedFacts: [observedFact(sourceUnit, field.value)],
    };
  });
  const generatedUnits = fields.map((field, index) => {
    const sourceUnit = sourceUnits.find(unit => unit.unitId.endsWith(`:${field.key}`));
    const rendered = run.execution.presentation.draft.content.includes(`general-info:${field.key}`)
      && run.execution.presentation.draft.content.includes(String(field.displayValue));
    invariant(rendered, `${field.key}: evaluation metadata claims a field that is absent from the rendered draft.`);
    return {
      unitId: `gen:${sectionId}:${field.key}`, layer: 'generated', unitType: 'structured_field', sectionId,
      outlineBlockId: goldMap.outlineBlockId, semanticKey: `generated.tank_information.${field.key}`,
      criticality: 'required', claimType: 'field_value',
      contentRef: unitRef(`${sectionId}.generation-result`, `/evaluationEvidence/fields/${index}`,
        run.execution.preDisplayReview.trace.generationResultSha256),
      contentSha256: sha({ key: field.key, value: field.displayValue }), contentPreview: `${field.label}: ${field.displayValue}`,
      protectedFacts: [observedFact(sourceUnit, field.value)],
    };
  });
  const compareSha = sha({ policy: 'tk5452_exact_field_lineage_v1', goldMapSha256: sha(goldMap) });
  const comparator = atomicGrader('protected-field-lineage-rule-engine', compareSha);
  const links = [];
  for (const sourceUnit of sourceUnits) {
    const key = sourceUnit.semanticKey.replace('tank_information.', '');
    const evidenceUnit = evidenceUnits.find(unit => unit.unitId.endsWith(`:${key}`));
    const stageAPass = Boolean(evidenceUnit && protectedFactsMatch(sourceUnit.protectedFacts, evidenceUnit.protectedFacts));
    links.push({
      linkId: `link:source-to-mock:${sectionId}:${key}`, stage: 'source_to_mock', fromUnitIds: [sourceUnit.unitId],
      toUnitIds: evidenceUnit ? [evidenceUnit.unitId] : [], relation: evidenceUnit ? 'preserves' : 'excluded',
      verdict: stageAPass ? 'pass' : 'fail', grader: comparator,
      explanation: stageAPass ? `${key} is present in the app export with its protected value.`
        : evidenceUnit ? `${key} is present, but its app value does not exactly preserve the reviewed source fact.`
          : `${key} is present in the source report but absent from the app-export evidence projection.`,
    });
    if (evidenceUnit) {
      const generatedUnit = generatedUnits.find(unit => unit.unitId.endsWith(`:${key}`));
      const stageBPass = protectedFactsMatch(evidenceUnit.protectedFacts, generatedUnit.protectedFacts);
      links.push({
        linkId: `link:mock-to-generation:${sectionId}:${key}`, stage: 'mock_to_generation',
        fromUnitIds: [evidenceUnit.unitId], toUnitIds: [generatedUnit.unitId], relation: 'supports',
        verdict: stageBPass ? 'pass' : 'fail', grader: comparator,
        explanation: stageBPass ? `${key} is rendered from the routed app value without factual change.`
          : `${key} changed between routed app evidence and the generated field.`,
      });
    }
  }
  const reviewer = run.execution.preDisplayReview;
  const reviewerConfig = configurationRefs.find(ref => ref.role === 'pre_display_reviewer');
  const evaluatorConfig = configurationRefs.find(ref => ref.role === 'post_generation_evaluator');
  return freezeAtomicEvaluationCase({
    caseId: `atomic:${sectionId}:tk5452`, lineageId: 'inspection:TK5452', datasetSplit: 'validation',
    section: { profileId: 'vertical_tank_inspection_v1', sectionId, title: run.spec.sectionTitle },
    segmentationPolicy: 'semantic_obligation_v1', agentConfigurationRefs: configurationRefs,
    units: [...sourceUnits, ...evidenceUnits, ...generatedUnits], links,
    sectionAssessment: {
      format: { verdict: reviewer.checks.exactTitle && reviewer.checks.formatValid ? 'pass' : 'fail',
        grader: atomicGrader(reviewer.release.reviewerId, reviewerConfig.configurationSha256),
        explanation: 'The pre-display reviewer checked the exact title and paired-field format contract.' },
      coherence: { verdict: 'not_available',
        grader: atomicGrader(run.evaluatorResult.release.evaluatorId, evaluatorConfig.configurationSha256, 'llm'),
        explanation: 'Whole-section semantic coherence awaits the bounded post-generation judge.' },
    },
  });
}

export async function buildTk5452AtomicEvaluationBundle({
  sectionRuns,
  routerReleaseBinding,
  routerManifestSha256,
  appExportSha256,
  sourcePdfSha256,
  gitCommit,
}) {
  invariant(/^[a-f0-9]{40}$/.test(gitCommit), 'Atomic evaluation requires the exact Git commit.');
  const goldMapArtifact = await readJson(GOLD_MAP_URL);
  const goldMap = goldMapArtifact.value;
  invariant(goldMap.sourceReportSha256 === sourcePdfSha256, 'Gold semantic map is bound to another source report.');
  const agentConfigurations = await buildAgentConfigurations({ sectionRuns, routerReleaseBinding, routerManifestSha256, gitCommit });
  const refsFor = sectionId => agentConfigurations.filter(configuration => configuration.agentRole === 'report_evidence_router'
      || configuration.configurationId.startsWith(`${sectionId}.`)).map(configuration => ({
    role: configuration.agentRole,
    configurationId: configuration.configurationId,
    configurationSha256: configuration.configurationSha256,
  }));
  const evaluations = sectionRuns.map(run => {
    const map = goldMap.sections[run.spec.sectionId];
    invariant(map, `Gold semantic map is missing ${run.spec.sectionId}.`);
    const configurationRefs = refsFor(run.spec.sectionId);
    const evaluationCase = run.spec.sectionId === 'scope-of-inspection'
      ? buildScopeCase({ run, goldMap: map, configurationRefs, appExportSha256 })
      : buildGeneralInformationCase({ run, goldMap: map, configurationRefs, appExportSha256 });
    return { sectionId: run.spec.sectionId, evaluationCase, matrix: buildAtomicEvaluationMatrix(evaluationCase) };
  });
  return {
    contractVersion: 'tk5452_atomic_evaluation_bundle_v1',
    goldSemanticMap: { path: fileURLToPath(GOLD_MAP_URL), sha256: goldMapArtifact.sha256 },
    agentConfigurations,
    evaluations,
  };
}

export function summarizeAgentConfiguration(configuration) {
  return {
    ...configSummary(configuration),
    executionMode: configuration.executionMode,
    implementationCommit: configuration.implementation.gitCommit,
    model: configuration.model.mode === 'disabled'
      ? { mode: 'disabled', reason: configuration.model.reason }
      : { mode: 'pinned', provider: configuration.model.provider, modelId: configuration.model.modelId, modelVersion: configuration.model.modelVersion },
    promptBinding: configuration.prompt.mode === 'disabled'
      ? { mode: 'disabled', reason: configuration.prompt.reason }
      : { mode: 'pinned', promptId: configuration.prompt.promptId, promptVersion: configuration.prompt.promptVersion },
    knowledgeBindings: configuration.knowledgeSnapshots.map(item => ({ kind: item.kind, snapshotId: item.snapshotId, version: item.version })),
    schemas: configuration.schemaBindings.map(item => ({ direction: item.direction, schemaId: item.schemaId, version: item.version })),
  };
}
