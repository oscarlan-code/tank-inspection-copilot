const SHA256 = /^[a-f0-9]{64}$/;

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export const REPORT_EVIDENCE_ROUTER_RELEASES = deepFreeze({
  'report-evidence-router_v1': {
    agentId: 'report-evidence-router',
    releaseId: 'report-evidence-router_v1',
    executionModes: ['evaluation'],
    productEnabled: false,
    lifecycle: 'archived_evaluation_only',
    rootUrl: new URL('./releases/v1/', import.meta.url).href,
    manifestSha256: '5d9a320eb41ec911a22a2858531954ccec2004cb966eb0771abe54a7b4ab234d',
  },
  'report-evidence-router_v2': {
    agentId: 'report-evidence-router',
    releaseId: 'report-evidence-router_v2',
    executionModes: ['evaluation'],
    productEnabled: false,
    lifecycle: 'archived_evaluation_only',
    rootUrl: new URL('./releases/v2/', import.meta.url).href,
    manifestSha256: '0eb2f69e35fab0849469cd85a03a3689d286b41f06b14e6a78a733f4835be658',
  },
});

export function getReportEvidenceRouterBinding({
  releaseId,
  executionMode = 'evaluation',
  allowArchived = false,
} = {}) {
  if (typeof releaseId !== 'string' || releaseId === 'latest') {
    throw new Error('An exact Report Evidence Routing Agent release is required.');
  }
  const release = REPORT_EVIDENCE_ROUTER_RELEASES[releaseId];
  if (!release || !release.executionModes.includes(executionMode) || release.productEnabled !== false
      || !SHA256.test(release.manifestSha256)) {
    throw new Error('Unsupported Report Evidence Routing Agent release or execution mode.');
  }
  if (release.lifecycle === 'archived_evaluation_only' && allowArchived !== true) {
    throw new Error('Report Evidence Routing Agent releases are archived; new workflows must use Contents Classification evaluation v1.');
  }
  return deepFreeze({
    agentId: release.agentId,
    releaseId: release.releaseId,
    manifestSha256: release.manifestSha256,
    lifecycle: release.lifecycle,
  });
}
