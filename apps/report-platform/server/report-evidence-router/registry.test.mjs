import assert from 'node:assert/strict';
import test from 'node:test';
import { getReportEvidenceRouterBinding } from './registry.mjs';

test('archived router releases fail closed for new workflows', () => {
  assert.throws(() => getReportEvidenceRouterBinding({
    releaseId: 'report-evidence-router_v2', executionMode: 'evaluation',
  }), /archived/);
});

test('saved historical evaluations can explicitly reproduce an archived release', () => {
  const binding = getReportEvidenceRouterBinding({
    releaseId: 'report-evidence-router_v2', executionMode: 'evaluation', allowArchived: true,
  });
  assert.equal(binding.releaseId, 'report-evidence-router_v2');
  assert.equal(binding.lifecycle, 'archived_evaluation_only');
});
