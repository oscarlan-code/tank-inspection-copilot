#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  canonicalSha256,
  freezeAgentExecutionConfiguration,
  validateAgentExecutionConfiguration,
} from './agent-configuration.mjs';
import {
  buildAtomicEvaluationMatrix,
  freezeAtomicEvaluationCase,
} from './atomic-evaluation.mjs';

const sha = value => canonicalSha256(value);
const promptSha = sha('example bounded narrative prompt');
const manifest = { files: { 'prompt.md': promptSha } };

const configuration = freezeAgentExecutionConfiguration({
  configurationId: 'scope-generator-candidate-a',
  agentRole: 'section_generator',
  agentId: 'scope_of_inspection',
  releaseId: 'scope_of_inspection_candidate_a',
  releaseManifestSha256: sha('release manifest'),
  executionMode: 'evaluation',
  implementation: { gitCommit: 'a'.repeat(40) },
  model: {
    mode: 'pinned',
    provider: 'example_provider',
    modelId: 'example-model-2026-01-01',
    modelVersion: 'example-model-2026-01-01',
    settings: { temperature: 0, maxOutputTokens: 1200 },
    settingsSha256: sha({ temperature: 0, maxOutputTokens: 1200 }),
  },
  prompt: {
    mode: 'pinned',
    promptId: 'scope-generator',
    promptVersion: '1.0.0',
    artifactPath: 'prompt.md',
    artifactSha256: promptSha,
  },
  knowledgeSnapshots: [{
    kind: 'section_pattern_pack',
    snapshotId: 'scope-pattern-pack-v1',
    version: '1.0.0',
    sha256: sha('pattern pack'),
  }],
  schemaBindings: [
    { direction: 'input', schemaId: 'section-evidence-snapshot', version: '1.0.0', sha256: sha('input schema') },
    { direction: 'output', schemaId: 'report-document', version: '2.0.0', sha256: sha('output schema') },
  ],
}, { releaseManifest: manifest });

assert.equal(validateAgentExecutionConfiguration(configuration, { releaseManifest: manifest }), configuration);
assert.throws(() => validateAgentExecutionConfiguration({
  ...configuration,
  model: { ...configuration.model, modelVersion: 'latest' },
}), /latest/);
assert.throws(() => validateAgentExecutionConfiguration({
  ...configuration,
  prompt: { ...configuration.prompt, promptVersion: '1' },
}), /semantic version/);
assert.throws(() => validateAgentExecutionConfiguration({
  ...configuration,
  releaseId: 'silently_changed',
}), /configuration SHA-256/);

const contentRef = (artifactId, pointer) => ({
  artifactId,
  jsonPointer: pointer,
  artifactSha256: sha(artifactId),
});

const grader = {
  type: 'human',
  id: 'independent-source-reviewer',
  version: '1.0.0',
  configurationSha256: configuration.configurationSha256,
};

const caseInput = {
  caseId: 'atomic-scope-example-01',
  lineageId: 'asset:example:tank-001',
  datasetSplit: 'development',
  section: {
    profileId: 'vertical_tank_inspection_v1',
    sectionId: 'scope-of-inspection',
    title: '1 SCOPE OF INSPECTION',
  },
  segmentationPolicy: 'semantic_obligation_v1',
  agentConfigurationRefs: [{
    role: 'section_generator',
    configurationId: configuration.configurationId,
    configurationSha256: configuration.configurationSha256,
  }],
  units: [
    {
      unitId: 'src-roof-measurements',
      layer: 'source',
      unitType: 'scope_item',
      sectionId: 'scope-of-inspection',
      outlineBlockId: 'inspection-activities',
      semanticKey: 'scope.roof.thickness_measurements',
      criticality: 'required',
      disposition: 'required_current_fact',
      requiredInMock: true,
      contentRef: contentRef('sealed-source-report', '/sections/scope/units/0'),
      contentSha256: sha('source roof meaning'),
      protectedFacts: [{ factId: 'roof-readings-per-plate', key: 'minimumReadingsPerPlate', value: 5, unitCode: null }],
    },
    {
      unitId: 'src-floor-scan',
      layer: 'source',
      unitType: 'scope_item',
      sectionId: 'scope-of-inspection',
      outlineBlockId: 'inspection-activities',
      semanticKey: 'scope.floor.corrosion_scan',
      criticality: 'required',
      disposition: 'required_current_fact',
      requiredInMock: true,
      contentRef: contentRef('sealed-source-report', '/sections/scope/units/1'),
      contentSha256: sha('source floor meaning'),
      protectedFacts: [],
    },
    {
      unitId: 'ev-inspector-scope-note',
      layer: 'evidence',
      unitType: 'scope_item',
      sectionId: 'scope-of-inspection',
      outlineBlockId: 'inspection-activities',
      semanticKey: 'scope.inspector_note.activities',
      criticality: 'required',
      generationEligible: true,
      captureChannel: 'voice_note',
      contentRef: contentRef('frozen-app-export', '/voiceNotes/0'),
      contentSha256: sha('rewritten practical inspector note'),
      protectedFacts: [{ factId: 'roof-readings-per-plate', key: 'minimumReadingsPerPlate', value: 5, unitCode: null }],
    },
    {
      unitId: 'gen-roof-claim',
      layer: 'generated',
      unitType: 'scope_item',
      sectionId: 'scope-of-inspection',
      outlineBlockId: 'inspection-activities',
      semanticKey: 'generated.scope.roof.thickness_measurements',
      criticality: 'required',
      claimType: 'inspection_activity',
      contentRef: contentRef('generated-section', '/blocks/0/items/0'),
      contentSha256: sha('generated roof claim'),
      protectedFacts: [{ factId: 'roof-readings-per-plate', key: 'minimumReadingsPerPlate', value: 5, unitCode: null }],
    },
    {
      unitId: 'gen-floor-claim',
      layer: 'generated',
      unitType: 'scope_item',
      sectionId: 'scope-of-inspection',
      outlineBlockId: 'inspection-activities',
      semanticKey: 'generated.scope.floor.corrosion_scan',
      criticality: 'required',
      claimType: 'inspection_activity',
      contentRef: contentRef('generated-section', '/blocks/0/items/1'),
      contentSha256: sha('generated floor claim'),
      protectedFacts: [],
    },
  ],
  links: [
    {
      linkId: 'source-to-one-combined-note',
      stage: 'source_to_mock',
      fromUnitIds: ['src-roof-measurements', 'src-floor-scan'],
      toUnitIds: ['ev-inspector-scope-note'],
      relation: 'combines',
      verdict: 'pass',
      grader,
      explanation: 'One realistic voice note preserves both reviewed scope obligations.',
    },
    {
      linkId: 'one-note-to-two-generated-claims',
      stage: 'mock_to_generation',
      fromUnitIds: ['ev-inspector-scope-note'],
      toUnitIds: ['gen-roof-claim', 'gen-floor-claim'],
      relation: 'supports',
      verdict: 'pass',
      grader,
      explanation: 'The combined note supports two independently rendered scope claims.',
    },
  ],
  sectionAssessment: {
    format: { verdict: 'pass', grader, explanation: 'The required title and arrow-bullet format are present.' },
    coherence: { verdict: 'pass', grader, explanation: 'The complete section is ordered and non-duplicative.' },
  },
};

const evaluationCase = freezeAtomicEvaluationCase(caseInput);
const matrix = buildAtomicEvaluationMatrix(evaluationCase);
assert.equal(matrix.qualification, 'eligible_for_human_review');
assert(matrix.rows.every(row => row.status === 'pass'));
assert.equal(matrix.rows.find(row => row.metricId === 'mock.required_source_to_evidence_coverage').numerator, 2);
assert.equal(matrix.rows.find(row => row.metricId === 'generation.evidence_to_claim_coverage').numerator, 1);
assert.equal(matrix.rows.find(row => row.metricId === 'generation.supported_claim_precision').numerator, 2);

const arbitraryChunk = structuredClone(caseInput);
arbitraryChunk.units[0].unitType = 'text_chunk';
assert.throws(() => freezeAtomicEvaluationCase(arbitraryChunk), /semantic unit type/);

const missingSupport = structuredClone(caseInput);
missingSupport.links[1].toUnitIds = ['gen-roof-claim'];
const incompleteCase = freezeAtomicEvaluationCase(missingSupport);
const incompleteMatrix = buildAtomicEvaluationMatrix(incompleteCase);
assert.equal(incompleteMatrix.qualification, 'blocked');
assert.equal(incompleteMatrix.rows.find(row =>
  row.metricId === 'generation.supported_claim_precision').status, 'fail');

const unavailableSemantic = structuredClone(caseInput);
unavailableSemantic.links[1].verdict = 'not_available';
const pendingCase = freezeAtomicEvaluationCase(unavailableSemantic);
const pendingMatrix = buildAtomicEvaluationMatrix(pendingCase);
assert.equal(pendingMatrix.rows.find(row =>
  row.metricId === 'generation.semantic_recovery').status, 'not_available');

const migration = await readFile(new URL('../../../storage/migrations/052_atomic_evaluation_lineage.sql', import.meta.url), 'utf8');
for (const required of [
  'CREATE TABLE report_agent_execution_configurations',
  'CREATE TABLE report_atomic_evaluation_cases',
  'CREATE TABLE report_atomic_evaluation_units',
  'CREATE TABLE report_atomic_evaluation_links',
  'CREATE TABLE report_atomic_evaluation_run_bindings',
  'semantic_obligation_v1',
  'reject_atomic_evaluation_revision_update',
]) {
  assert(migration.includes(required), 'Atomic evaluation storage is missing ' + required);
}

console.log(JSON.stringify({
  passed: true,
  agentConfigurationContract: configuration.contractVersion,
  atomicCaseContract: evaluationCase.contractVersion,
  matrixContract: matrix.contractVersion,
  semanticUnits: evaluationCase.units.length,
  manyToManyLineage: true,
  arbitraryChunksRejected: true,
  unsupportedClaimBlocks: true,
  semanticJudgeCanRemainUnavailable: true,
}, null, 2));
