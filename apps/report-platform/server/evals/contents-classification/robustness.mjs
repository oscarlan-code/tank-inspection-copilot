import assert from 'node:assert/strict';

const IDENTITY_FIELDS = ['caseId', 'documentId', 'sourceSha256', 'assetLineageKey'];
const FORBIDDEN_RUNTIME_FIELDS = [
  'expectedUses', 'goldDecision', 'goldOrigins', 'goldSha256', 'sourceDatasetSplit',
  'sourcePath', 'documentId', 'assetLineageKey', 'evaluatorCrosswalk', 'referenceTextUnits',
];

function lineageIdentity(caseInfo) {
  return {
    caseId: caseInfo?.caseId ?? null,
    documentId: caseInfo?.source?.documentId ?? null,
    sourceSha256: caseInfo?.source?.sourceSha256 ?? null,
    assetLineageKey: caseInfo?.source?.assetLineageKey ?? null,
  };
}

export function assertIndependentLineage({ developmentCases = [], evaluationCase } = {}) {
  assert(developmentCases.length > 0, 'At least one development lineage is required.');
  assert(evaluationCase, 'An evaluation lineage is required.');
  const evaluation = lineageIdentity(evaluationCase);
  const conflicts = [];
  for (const developmentCase of developmentCases) {
    const development = lineageIdentity(developmentCase);
    for (const field of IDENTITY_FIELDS) {
      if (evaluation[field] && development[field] && evaluation[field] === development[field]) {
        conflicts.push({ field, value: evaluation[field] });
      }
    }
  }
  assert.equal(conflicts.length, 0,
    `Evaluation lineage overlaps development data: ${conflicts.map((item) => item.field).join(', ')}.`);
  return {
    decision: 'passed',
    developmentLineageCount: developmentCases.length,
    evaluationIdentity: evaluation,
    checkedIdentityFields: IDENTITY_FIELDS,
  };
}

export function auditRequestPreview({ preview, candidateFingerprint, evaluatorPrivateIdentifiers = [] } = {}) {
  const issues = [];
  if (preview?.goldIncluded !== false) issues.push('gold_included');
  if (preview?.evaluatorCrosswalkIncluded !== false) issues.push('evaluator_crosswalk_included');
  if (preview?.originalReportIncluded !== false) issues.push('original_report_included');
  if (preview?.classifierCandidateId !== candidateFingerprint?.candidateId) issues.push('candidate_id_mismatch');
  if (preview?.candidateFingerprintSha256 !== candidateFingerprint?.sha256) issues.push('candidate_fingerprint_mismatch');
  const payload = JSON.stringify(preview?.requests ?? []);
  for (const field of FORBIDDEN_RUNTIME_FIELDS) {
    if (payload.includes(field)) issues.push(`forbidden_runtime_field:${field}`);
  }
  for (const value of evaluatorPrivateIdentifiers.filter((item) => typeof item === 'string' && item.length >= 12)) {
    if (payload.includes(value)) issues.push(`evaluator_private_identifier:${value.slice(0, 12)}`);
  }
  return {
    contractVersion: 'contents_classification_request_leakage_audit_v1',
    decision: issues.length ? 'blocked' : 'passed',
    issueCount: issues.length,
    issues,
    requestCount: preview?.requests?.length ?? 0,
    candidateFingerprintSha256: candidateFingerprint?.sha256 ?? null,
  };
}

export function datasetRole(caseInfo) {
  return caseInfo?.source?.sourceDatasetSplit === 'validation'
    ? 'held_out_validation'
    : 'independent_robustness';
}

export const __test = { lineageIdentity, FORBIDDEN_RUNTIME_FIELDS };

