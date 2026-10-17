#!/usr/bin/env node
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHA256 = /^[a-f0-9]{64}$/;
const GIT_COMMIT = /^[a-f0-9]{40}$/;

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const optionalJson = async (path) => {
  try { return await readJson(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};

function parseArgs(argv) {
  const args = { caseRoot: null, json: false, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') args.json = true;
    else if (arg === '--case-root' || arg === '--output') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      args[arg === '--case-root' ? 'caseRoot' : 'output'] = resolve(value);
      index += 1;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.caseRoot) throw new Error('Usage: run.mjs --case-root <private-case-root> [--json] [--output <file>]');
  return args;
}

function row({ id, type, status, observed, expected, explanation }) {
  return { id, type, gate: 'hard', status, observed, expected, explanation };
}

function validExecutionBinding(candidate) {
  if (!candidate || typeof candidate !== 'object') return false;
  const model = candidate.model;
  const prompt = candidate.prompt;
  const validMode = (binding) => binding && ['disabled', 'pinned'].includes(binding.mode);
  const validPinned = (binding) => binding.mode === 'disabled'
    ? typeof binding.reason === 'string' && binding.reason.length > 0
    : typeof binding.version === 'string' && !/latest/i.test(binding.version)
      && SHA256.test(binding.sha256 ?? '');
  return typeof candidate.candidateId === 'string'
    && typeof candidate.agentRelease === 'string'
    && GIT_COMMIT.test(candidate.implementationGitCommit ?? '')
    && typeof candidate.changedVariable === 'string'
    && validMode(model) && validPinned(model)
    && validMode(prompt) && validPinned(prompt);
}

function independentReviewPassed(review) {
  if (!review) return false;
  if (!['pass', 'approved'].includes(review.decision)) return false;
  if (Number(review.blockingFindingCount ?? 0) > 0) return false;
  if (Array.isArray(review.blockingFindings) && review.blockingFindings.length > 0) return false;
  return true;
}

function assessSemanticMatrix({ matrix, inventory, lineage, expectedVariantIds }) {
  if (!matrix) {
    return {
      available: false,
      unitCount: 0,
      expectedPairCount: 0,
      sourceSegmentation: { status: 'not_run', observed: 'semantic-pairs.json missing' },
      sourceToMockCoverage: { status: 'not_run', observed: 'semantic-pairs.json missing' },
      meaningAlignment: { status: 'not_run', observed: 'semantic-pairs.json missing' },
      truthIntegrity: { status: 'not_run', observed: 'semantic-pairs.json missing' },
      variationRobustness: { status: 'not_run', observed: 'semantic-pairs.json missing' },
    };
  }

  const units = Array.isArray(matrix.semanticUnits) ? matrix.semanticUnits : [];
  const variants = Array.isArray(matrix.variants) ? matrix.variants : [];
  const validContract = matrix.contractVersion === 'source_mock_semantic_matrix_v1'
    && matrix.caseId === inventory.caseId;
  const unitIds = new Set(units.map((unit) => unit.sourceUnitId));
  const uniqueUnits = unitIds.size === units.length;
  const structurallyValidUnits = units.filter((unit) => typeof unit.sourceUnitId === 'string'
    && typeof unit.semanticKey === 'string'
    && typeof unit.unitType === 'string'
    && ['critical', 'required', 'optional'].includes(unit.criticality)
    && [
      'capturable',
      'confirmed_report_side_input',
      'external_attachment',
      'report_platform_owned',
      'unsupported',
    ].includes(unit.appCapability)
    && Array.isArray(unit.sourceObligationIds) && unit.sourceObligationIds.length > 0);
  const requiredRaw = (inventory.obligations ?? []).filter((item) => item.requiredForMock === true);
  const representedRaw = new Set(units.flatMap((unit) => unit.sourceObligationIds ?? []));
  const segmentedRaw = requiredRaw.filter((item) => representedRaw.has(item.obligationId));
  const capturableUnits = units.filter((unit) => unit.appCapability === 'capturable'
    && ['critical', 'required'].includes(unit.criticality));
  const lineageByObligation = new Map((lineage.entries ?? []).map((entry) => [entry.obligationId, entry]));
  const lineageMappedRaw = requiredRaw.filter((item) =>
    (lineageByObligation.get(item.obligationId)?.recordRefs ?? []).length > 0);

  const variantById = new Map(variants.map((variant) => [variant.variantId, variant]));
  const expectedPairs = [];
  for (const variantId of expectedVariantIds) {
    for (const unit of capturableUnits) expectedPairs.push({ variantId, sourceUnitId: unit.sourceUnitId });
  }
  const pairResults = expectedPairs.map(({ variantId, sourceUnitId }) => {
    const rows = variantById.get(variantId)?.rows ?? [];
    const matches = rows.filter((item) => item.sourceUnitId === sourceUnitId);
    const item = matches[0];
    return {
      variantId,
      sourceUnitId,
      unique: matches.length === 1,
      linked: matches.length === 1 && Array.isArray(item.mockEvidenceRefs) && item.mockEvidenceRefs.length > 0,
      reviewed: matches.length === 1 && item.reviewed === true && typeof item.grader?.id === 'string'
        && ['deterministic', 'human', 'llm'].includes(item.grader?.type),
      meaningPreserved: matches.length === 1 && item.semanticVerdict === 'preserved',
      integrityPassed: matches.length === 1 && item.integrityVerdict === 'pass'
        && Number(item.unsupportedAdditionCount ?? 0) === 0,
    };
  });
  const linkedPairs = pairResults.filter((item) => item.unique && item.linked);
  const reviewedPairs = pairResults.filter((item) => item.reviewed);
  const meaningPairs = reviewedPairs.filter((item) => item.meaningPreserved);
  const integrityPairs = reviewedPairs.filter((item) => item.integrityPassed);
  const meaningFailures = reviewedPairs.filter((item) => !item.meaningPreserved);
  const integrityFailures = reviewedPairs.filter((item) => !item.integrityPassed);
  const variantScores = expectedVariantIds.map((variantId) => {
    const rows = pairResults.filter((item) => item.variantId === variantId);
    const passed = rows.filter((item) => item.meaningPreserved && item.integrityPassed).length;
    return { variantId, passed, total: rows.length };
  });
  const worstVariant = variantScores.sort((left, right) =>
    (left.total ? left.passed / left.total : 0) - (right.total ? right.passed / right.total : 0))[0];
  const unmappedSourceIds = Array.isArray(matrix.unmappedSourceObligationIds)
    ? matrix.unmappedSourceObligationIds : [];
  const matrixReady = validContract && uniqueUnits && structurallyValidUnits.length === units.length
    && units.length > 0 && expectedVariantIds.length > 0 && unmappedSourceIds.length === 0;

  return {
    available: true,
    unitCount: units.length,
    expectedPairCount: expectedPairs.length,
    sourceSegmentation: {
      status: matrixReady && segmentedRaw.length === requiredRaw.length ? 'pass' : 'fail',
      observed: `${segmentedRaw.length}/${requiredRaw.length} required source obligations represented by ${units.length} semantic units`,
    },
    sourceToMockCoverage: {
      status: matrixReady && linkedPairs.length === expectedPairs.length ? 'pass' : 'fail',
      observed: `${linkedPairs.length}/${expectedPairs.length} semantic unit–variant pairs linked; legacy raw lineage ${lineageMappedRaw.length}/${requiredRaw.length} (informational only)`,
    },
    meaningAlignment: {
      status: !matrixReady || meaningFailures.length > 0
        ? 'fail'
        : reviewedPairs.length === expectedPairs.length ? 'pass' : 'not_run',
      observed: `${meaningPairs.length}/${reviewedPairs.length} reviewed pairs preserve meaning; ${expectedPairs.length - reviewedPairs.length} pending review`,
    },
    truthIntegrity: {
      status: !matrixReady || integrityFailures.length > 0
        ? 'fail'
        : reviewedPairs.length === expectedPairs.length ? 'pass' : 'not_run',
      observed: `${integrityPairs.length}/${reviewedPairs.length} reviewed pairs preserve protected truth with no unsupported addition; ${expectedPairs.length - reviewedPairs.length} pending review`,
    },
    variationRobustness: {
      status: !matrixReady || meaningFailures.length > 0 || integrityFailures.length > 0
        ? 'fail'
        : reviewedPairs.length === expectedPairs.length
          && variantScores.length === expectedVariantIds.length
          && variantScores.every((item) => item.total > 0 && item.passed === item.total)
          ? 'pass' : 'not_run',
      observed: worstVariant
        ? `worst variant ${worstVariant.variantId}: ${worstVariant.passed}/${worstVariant.total}`
        : 'no voice variants scored',
    },
  };
}

export async function evaluateMockPreparationCase(caseRoot, { planPath = join(HERE, 'eval-plan.json') } = {}) {
  const plan = await readJson(planPath);
  const [inventory, lineage, receipt, deterministicReview, candidate, semanticMatrix, independentReview, freezeManifest] = await Promise.all([
    readJson(join(caseRoot, 'source-inventory.json')),
    readJson(join(caseRoot, 'evidence-lineage.json')),
    readJson(join(caseRoot, 'build-receipt.json')),
    readJson(join(caseRoot, 'review', 'deterministic-review.json')),
    optionalJson(join(caseRoot, 'eval-candidate.json')),
    optionalJson(join(caseRoot, 'semantic-pairs.json')),
    optionalJson(join(caseRoot, 'review', 'independent-review.json')),
    optionalJson(join(caseRoot, 'freeze-manifest.json')),
  ]);

  const reviewFiles = await readdir(join(caseRoot, 'review'));
  const auditPaths = reviewFiles
    .filter((name) => /^app-export-audit-.+\.json$/.test(name))
    .sort()
    .map((name) => join(caseRoot, 'review', name));
  const audits = await Promise.all(auditPaths.map(readJson));

  const obligations = inventory.obligations ?? [];
  const disposed = obligations.filter((item) => typeof item.disposition === 'string' && item.disposition.length > 0);
  const required = obligations.filter((item) => item.requiredForMock === true);
  const expectedVariants = Number(deterministicReview.checks?.expectedExportVariantCount ?? receipt.draftVariants?.length ?? 0);
  const expectedVariantIds = Array.isArray(receipt.draftVariants) ? receipt.draftVariants : [];
  const authenticAudits = audits.filter((audit) => audit.decision === 'pass' && audit.receipt?.valid === true);
  const protectedAudits = audits.filter((audit) => {
    const info = audit.generalInfoContract ?? {};
    return audit.decision === 'pass'
      && audit.parity?.checklistAnswers === 195
      && info.draftFieldCount === info.exportedFieldCount
      && (info.absentFromInspectionRecord ?? []).length === 0
      && typeof audit.unitProfile?.thicknessUnit === 'string'
      && audit.unitProfile.thicknessUnit.length > 0;
  });
  const independentPassed = independentReviewPassed(independentReview);
  const frozen = Boolean(freezeManifest);
  const candidateAllowed = plan.candidateControl.allowedChangedVariables.includes(candidate?.changedVariable);
  const candidateValid = validExecutionBinding(candidate) && candidateAllowed;
  const candidateStatus = !candidate ? 'not_run' : candidateValid ? 'pass' : 'fail';
  const independentStatus = !independentReview
    ? 'not_run'
    : !independentPassed
      ? 'fail'
      : frozen ? 'pass' : 'not_run';
  const semantic = assessSemanticMatrix({
    matrix: semanticMatrix, inventory, lineage, expectedVariantIds,
  });

  const graders = [
    row({
      id: 'candidate-configuration', type: 'deterministic',
      status: candidateStatus,
      observed: candidate ? `${candidate.candidateId ?? 'unnamed'}; changed=${candidate.changedVariable ?? 'missing'}` : 'eval-candidate.json missing',
      expected: 'Pinned release, commit, model, prompt and one allowed changed variable',
      explanation: !candidate
        ? 'The existing build cannot be compared fairly until its exact candidate configuration is recorded.'
        : candidateValid
          ? 'The evaluated candidate pins its release, implementation, model, prompt and changed variable.'
          : 'Candidate metadata is present but is not fully pinned or does not declare one allowed variable.',
    }),
    row({
      id: 'source-segmentation', type: 'deterministic',
      status: disposed.length !== obligations.length ? 'fail' : semantic.sourceSegmentation.status,
      observed: `${disposed.length}/${obligations.length} raw obligations disposed; ${semantic.sourceSegmentation.observed}`,
      expected: '100% source disposition and every required raw obligation represented by semantic units',
      explanation: 'Parsed blocks establish source coverage; semantic units are the scoring denominator. Independent review validates their correctness later.',
    }),
    row({
      id: 'source-to-mock-coverage', type: 'deterministic',
      status: semantic.sourceToMockCoverage.status,
      observed: semantic.sourceToMockCoverage.observed,
      expected: 'Every required semantic unit linked to app evidence in every voice variant',
      explanation: 'Links are many-to-many: one note may support several units and one unit may use several app records.',
    }),
    row({
      id: 'semantic-meaning-alignment', type: 'llm_or_human',
      status: semantic.meaningAlignment.status,
      observed: semantic.meaningAlignment.observed,
      expected: '100% of critical and required pairs preserve meaning',
      explanation: 'Different wording, ordering and grouping are accepted when the inspection meaning remains unchanged.',
    }),
    row({
      id: 'truth-integrity', type: 'deterministic_and_semantic',
      status: semantic.truthIntegrity.status,
      observed: semantic.truthIntegrity.observed,
      expected: '100% protected truth accuracy and zero unsupported additions',
      explanation: 'Entity, location, condition, polarity, uncertainty, values, units and relationships are protected.',
    }),
    row({
      id: 'variation-robustness', type: 'aggregate',
      status: semantic.variationRobustness.status,
      observed: semantic.variationRobustness.observed,
      expected: 'Worst voice variant retains 100% of critical and required meaning',
      explanation: 'Voice style is a test condition. It must not alter the underlying inspection truth.',
    }),
    row({
      id: 'app-export-authenticity', type: 'deterministic',
      status: expectedVariants > 0 && audits.length === expectedVariants
        && authenticAudits.length === expectedVariants ? 'pass' : 'fail',
      observed: `${authenticAudits.length}/${expectedVariants} variants have passing Android receipts`,
      expected: `${expectedVariants}/${expectedVariants} authentic variants`,
      explanation: 'Only ProductStore exports with matching app-generated receipts count as mock evidence.',
    }),
    row({
      id: 'app-contract-preservation', type: 'deterministic',
      status: expectedVariants > 0 && audits.length === expectedVariants
        && protectedAudits.length === expectedVariants ? 'pass' : 'fail',
      observed: `${protectedAudits.length}/${expectedVariants} variants preserve checklist, General Information fields and thickness unit`,
      expected: `${expectedVariants}/${expectedVariants} variants`,
      explanation: 'This grader checks exported app structure; semantic narrative meaning is reviewed separately.',
    }),
    row({
      id: 'narrative-independence', type: 'deterministic',
      status: expectedVariants > 0 && audits.length === expectedVariants
        && audits.every((audit) => audit.narrativeLeakage?.exactMatchCount === 0) ? 'pass' : 'fail',
      observed: `${audits.reduce((sum, audit) => sum + Number(audit.narrativeLeakage?.exactMatchCount ?? 0), 0)} prohibited exact matches`,
      expected: '0 prohibited exact matches',
      explanation: 'Structured values may match; inspector narrative must not copy issued-report sentences.',
    }),
    row({
      id: 'independent-source-review', type: 'human',
      status: independentStatus,
      observed: `${independentPassed ? 'review passed' : 'review missing or incomplete'}; ${frozen ? 'bytes frozen' : 'freeze manifest missing'}`,
      expected: 'Independent source comparison passed and reviewed bytes frozen',
      explanation: 'Deterministic checks cannot prove that rewritten notes preserve the complete report meaning.',
    }),
  ];

  const hasFailure = graders.some((grader) => grader.status === 'fail');
  const hasNotRun = graders.some((grader) => grader.status === 'not_run');
  const decision = hasFailure ? 'failed' : hasNotRun ? 'incomplete' : 'qualified';
  return {
    frameworkVersion: plan.frameworkVersion,
    agent: plan.agent,
    dataset: {
      caseId: inventory.caseId,
      caseRevision: inventory.caseRevision,
      sourceSha256: inventory.sourceSha256,
      completeReportObligations: obligations.length,
      requiredAppObligations: required.length,
      semanticUnits: semantic.unitCount,
      semanticUnitVariantPairs: semantic.expectedPairCount,
      voiceVariants: expectedVariants,
    },
    candidate: candidate ?? { status: 'missing' },
    graders,
    decision,
    nextAction: decision === 'qualified'
      ? 'Freeze this case for the next agent evaluation.'
      : 'Complete the failed or unmeasured hard graders before evaluating the next agent.',
  };
}

export function formatHumanResult(result) {
  const lines = [
    `${result.agent.id} — ${result.decision.toUpperCase()}`,
    '',
    `Goal: ${result.agent.goal}`,
    `Dataset: ${result.dataset.caseId} revision ${result.dataset.caseRevision}; ${result.dataset.completeReportObligations} indexed source obligations; ${result.dataset.semanticUnits} semantic units; ${result.dataset.voiceVariants} voice variants`,
    `Candidate: ${result.candidate.candidateId ?? 'not pinned'}`,
    '',
    '| Grader | Type | Result | Observed | Why |',
    '| --- | --- | --- | --- | --- |',
    ...result.graders.map((grader) => `| ${grader.id} | ${grader.type} | ${grader.status} | ${grader.observed} | ${grader.explanation} |`),
    '',
    `Decision: ${result.decision}. ${result.nextAction}`,
  ];
  return lines.join('\n');
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = await evaluateMockPreparationCase(args.caseRoot);
    const output = args.json ? JSON.stringify(result, null, 2) : formatHumanResult(result);
    if (args.output) await writeFile(args.output, `${output}\n`, { mode: 0o600 });
    console.log(output);
    if (result.decision === 'failed') process.exitCode = 1;
  } catch (error) {
    console.error(`Mock Preparation Agent eval failed to run: ${error.message}`);
    process.exitCode = 1;
  }
}
