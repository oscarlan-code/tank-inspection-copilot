import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const registryUrl = new URL('./candidate-registry.json', import.meta.url);
const REGISTRY = JSON.parse(await readFile(registryUrl, 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export const SANDBOX_CANDIDATES = freeze(Object.fromEntries(REGISTRY.entries.map((entry) => [entry.candidateId, entry])));

export function resolveSandboxCandidate({ candidateId, sectionId, reportProfileId, executionMode }) {
  if (!candidateId || candidateId === 'latest') throw new Error('An exact sandbox candidate ID is required.');
  if (executionMode !== 'evaluation') throw new Error('Sandbox section candidates are evaluation-only.');
  const candidate = SANDBOX_CANDIDATES[candidateId];
  if (!candidate || candidate.status !== 'sandbox_candidate' || candidate.productEnabled !== false
      || !candidate.executionModes.includes(executionMode) || candidate.sectionId !== sectionId
      || candidate.reportProfileId !== reportProfileId) {
    throw new Error('Unsupported sandbox section candidate, profile, section or mode.');
  }
  return candidate;
}

export async function verifySandboxCandidate(args) {
  const candidate = resolveSandboxCandidate(args);
  const rootUrl = new URL(`${candidate.candidatePath}/`, import.meta.url);
  const manifestBytes = await readFile(new URL('candidate-manifest.json', rootUrl));
  if (sha256(manifestBytes) !== candidate.manifestSha256) throw new Error('Sandbox candidate manifest changed. Register a new candidate iteration explicitly.');
  const manifest = JSON.parse(manifestBytes);
  if (manifest.contractVersion !== 'section_agent_sandbox_candidate_v1'
      || manifest.candidateId !== candidate.candidateId
      || manifest.sectionId !== candidate.sectionId
      || manifest.reportProfileId !== candidate.reportProfileId
      || manifest.status !== 'sandbox_candidate' || manifest.productEnabled !== false
      || manifest.executionModes.length !== 1 || manifest.executionModes[0] !== 'evaluation') {
    throw new Error('Unsupported sandbox candidate manifest.');
  }
  for (const [path, expected] of Object.entries(manifest.files)) {
    if (!/^[a-zA-Z0-9_./-]+$/.test(path) || path.startsWith('/') || path.split('/').includes('..')) {
      throw new Error('Invalid sandbox candidate file path.');
    }
    if (sha256(await readFile(new URL(path, rootUrl))) !== expected) {
      throw new Error(`Sandbox candidate file changed: ${path}.`);
    }
  }
  for (const component of [manifest.generator, manifest.reviewer, manifest.evaluator]) {
    if (!component?.id || !manifest.files[component.entryPoint] || !component.entryExport) {
      throw new Error('Sandbox candidate component entry is not pinned.');
    }
  }
  if (!manifest.files[manifest.knowledgeBundle.path] || !manifest.files[manifest.standardObligationPack.path]) {
    throw new Error('Sandbox candidate knowledge controls are not pinned.');
  }
  return freeze({ candidate, manifest, rootUrl });
}

export async function getSandboxCandidateBinding(args) {
  const verified = await verifySandboxCandidate(args);
  return freeze({
    candidateId: verified.candidate.candidateId,
    candidateManifestSha256: verified.candidate.manifestSha256,
    sectionId: verified.candidate.sectionId,
    reportProfileId: verified.candidate.reportProfileId,
    generatorId: verified.manifest.generator.id,
    reviewerId: verified.manifest.reviewer.id,
    evaluatorId: verified.manifest.evaluator.id,
    knowledgeBundleId: verified.manifest.knowledgeBundle.id,
    knowledgeBundleSha256: verified.manifest.files[verified.manifest.knowledgeBundle.path],
    standardObligationPackId: verified.manifest.standardObligationPack.id,
    standardObligationPackSha256: verified.manifest.files[verified.manifest.standardObligationPack.path],
  });
}

export async function executeSandboxCandidate({ execution }) {
  const binding = execution?.sectionPlan?.candidateBinding;
  const verified = await verifySandboxCandidate({
    candidateId: binding?.candidateId,
    sectionId: execution?.sectionPlan?.sectionId,
    reportProfileId: execution?.sectionPlan?.reportProfileId,
    executionMode: execution?.executionMode,
  });
  if (binding?.candidateManifestSha256 !== verified.candidate.manifestSha256) {
    throw new Error('SectionPlan does not bind the exact sandbox candidate manifest.');
  }
  const generatorModule = await import(new URL(verified.manifest.generator.entryPoint, verified.rootUrl).href);
  const generationResult = generatorModule[verified.manifest.generator.entryExport](execution);
  const reviewerModule = await import(new URL(verified.manifest.reviewer.entryPoint, verified.rootUrl).href);
  const preDisplayReview = reviewerModule[verified.manifest.reviewer.entryExport]({
    contractVersion: 'package_bound_section_review_execution_v1',
    executionMode: 'evaluation',
    productEnabled: false,
    reportPlan: execution.reportPlan,
    sectionPlan: execution.sectionPlan,
    sectionEvidencePackage: execution.sectionEvidencePackage,
    generationResult,
  });
  return freeze({
    contractVersion: 'sandbox_section_candidate_execution_result_v1',
    candidateBinding: binding,
    generationResult,
    preDisplayReview,
    displayEligible: preDisplayReview.decision === 'ready_for_review'
      && preDisplayReview.userVisibility === 'allowed',
    productEnabled: false,
  });
}

export async function evaluateSandboxCandidate({ candidateExecution, goldPacket }) {
  if (candidateExecution?.displayEligible !== true) throw new Error('Blocked candidate output cannot enter gold evaluation.');
  const binding = candidateExecution.candidateBinding;
  const verified = await verifySandboxCandidate({
    candidateId: binding.candidateId,
    sectionId: binding.sectionId,
    reportProfileId: binding.reportProfileId,
    executionMode: 'evaluation',
  });
  const evaluatorModule = await import(new URL(verified.manifest.evaluator.entryPoint, verified.rootUrl).href);
  return evaluatorModule[verified.manifest.evaluator.entryExport]({
    contractVersion: 'package_bound_section_gold_evaluation_execution_v1',
    executionMode: 'evaluation',
    generationResult: candidateExecution.generationResult,
    preDisplayReview: candidateExecution.preDisplayReview,
    goldPacket,
  });
}

