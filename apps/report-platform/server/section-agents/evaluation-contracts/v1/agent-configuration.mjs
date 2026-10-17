import { createHash } from 'node:crypto';

export const AGENT_CONFIGURATION_CONTRACT = 'agent_execution_configuration_v1';

const AGENT_ROLES = new Set([
  'mock_preparation_agent',
  'mock_reviewer',
  'report_evidence_router',
  'report_structure_agent',
  'section_generator',
  'pre_display_reviewer',
  'post_generation_evaluator',
  'report_integrator',
]);
const EXECUTION_MODES = new Set(['evaluation', 'product']);
const MODEL_MODES = new Set(['disabled', 'pinned']);
const PROMPT_MODES = new Set(['disabled', 'pinned']);
const SHA256 = /^[a-f0-9]{64}$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const GIT_COMMIT = /^[a-f0-9]{40}$/;

const hasText = value => typeof value === 'string' && value.trim().length > 0;
const plainObject = value => value != null && typeof value === 'object' && !Array.isArray(value);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (plainObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalSha256(value) {
  return createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function configurationPayload(configuration) {
  const { configurationSha256: _ignored, ...payload } = configuration;
  return payload;
}

function validateModel(model) {
  assert(plainObject(model) && MODEL_MODES.has(model.mode), 'Agent model mode is invalid.');
  if (model.mode === 'disabled') {
    assert(hasText(model.reason), 'A disabled model needs a reason.');
    for (const key of ['provider', 'modelId', 'modelVersion', 'settingsSha256']) {
      assert(model[key] == null, `Disabled model must not declare ${key}.`);
    }
    return;
  }
  assert(hasText(model.provider) && hasText(model.modelId) && hasText(model.modelVersion),
    'Pinned model provider, ID and version are required.');
  assert(!/latest/i.test(model.modelId) && !/latest/i.test(model.modelVersion),
    'Mutable model aliases such as latest are prohibited.');
  assert(plainObject(model.settings), 'Pinned model settings are required.');
  assert(SHA256.test(model.settingsSha256)
      && model.settingsSha256 === canonicalSha256(model.settings),
  'Model settings hash is invalid.');
}

function validatePrompt(prompt, releaseManifest) {
  assert(plainObject(prompt) && PROMPT_MODES.has(prompt.mode), 'Agent prompt mode is invalid.');
  if (prompt.mode === 'disabled') {
    assert(hasText(prompt.reason), 'A disabled prompt needs a reason.');
    for (const key of ['promptId', 'promptVersion', 'artifactPath', 'artifactSha256']) {
      assert(prompt[key] == null, `Disabled prompt must not declare ${key}.`);
    }
    return;
  }
  assert(hasText(prompt.promptId) && SEMVER.test(prompt.promptVersion),
    'Pinned prompt ID and semantic version are required.');
  assert(hasText(prompt.artifactPath) && SHA256.test(prompt.artifactSha256),
    'Pinned prompt path and SHA-256 are required.');
  assert(!prompt.artifactPath.startsWith('/') && !prompt.artifactPath.split('/').includes('..'),
    'Prompt artifact path must stay inside its release.');
  if (releaseManifest) {
    assert(releaseManifest.files?.[prompt.artifactPath] === prompt.artifactSha256,
      'Prompt artifact is not hash-pinned by the release manifest.');
  }
}

export function validateAgentExecutionConfiguration(configuration, { releaseManifest = null } = {}) {
  assert(plainObject(configuration)
      && configuration.contractVersion === AGENT_CONFIGURATION_CONTRACT,
  'Agent configuration contract is invalid.');
  assert(hasText(configuration.configurationId), 'Agent configuration ID is required.');
  assert(AGENT_ROLES.has(configuration.agentRole), 'Agent role is invalid.');
  assert(hasText(configuration.agentId) && hasText(configuration.releaseId),
    'Agent and release IDs are required.');
  assert(SHA256.test(configuration.releaseManifestSha256),
    'Release manifest SHA-256 is invalid.');
  assert(EXECUTION_MODES.has(configuration.executionMode), 'Execution mode is invalid.');
  assert(plainObject(configuration.implementation)
      && GIT_COMMIT.test(configuration.implementation.gitCommit),
  'Exact 40-character Git commit is required.');
  validateModel(configuration.model);
  validatePrompt(configuration.prompt, releaseManifest);
  assert(Array.isArray(configuration.knowledgeSnapshots),
    'Knowledge snapshots must be an array.');
  for (const snapshot of configuration.knowledgeSnapshots) {
    assert(plainObject(snapshot) && hasText(snapshot.kind) && hasText(snapshot.snapshotId)
        && hasText(snapshot.version) && SHA256.test(snapshot.sha256),
    'Every knowledge snapshot needs kind, ID, version and SHA-256.');
    assert(!/latest/i.test(snapshot.version), 'Mutable knowledge snapshot aliases are prohibited.');
  }
  assert(Array.isArray(configuration.schemaBindings) && configuration.schemaBindings.length > 0,
    'At least one schema binding is required.');
  for (const binding of configuration.schemaBindings) {
    assert(plainObject(binding) && ['input', 'output'].includes(binding.direction)
        && hasText(binding.schemaId) && hasText(binding.version) && SHA256.test(binding.sha256),
    'Schema binding is invalid.');
    assert(!/latest/i.test(binding.version), 'Mutable schema aliases are prohibited.');
  }
  if (configuration.evaluatorRubric != null) {
    const rubric = configuration.evaluatorRubric;
    assert(plainObject(rubric) && hasText(rubric.rubricId) && SEMVER.test(rubric.version)
        && SHA256.test(rubric.sha256), 'Evaluator rubric binding is invalid.');
  }
  assert(SHA256.test(configuration.configurationSha256)
      && configuration.configurationSha256 === canonicalSha256(configurationPayload(configuration)),
  'Agent configuration SHA-256 does not match its content.');
  return configuration;
}

export function freezeAgentExecutionConfiguration(input, options = {}) {
  const configuration = {
    contractVersion: AGENT_CONFIGURATION_CONTRACT,
    ...structuredClone(input),
  };
  configuration.configurationSha256 = canonicalSha256(configurationPayload(configuration));
  validateAgentExecutionConfiguration(configuration, options);
  return Object.freeze(configuration);
}

export function deterministicExecutionProfile(reason = 'deterministic_agent') {
  return {
    model: { mode: 'disabled', reason },
    prompt: { mode: 'disabled', reason },
  };
}
