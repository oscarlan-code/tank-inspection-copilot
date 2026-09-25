import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Adding unrelated structured measurements changes package-scoped evidence IDs.
// Replay is allowed only when every worker-visible field except those IDs is
// identical, including entity, component, wording, order, schema and instructions.
export function rebindEvaluationCache(previousRequest, currentRequest, response) {
  const split = request => {
    const offset = request.prompt.lastIndexOf('\nEvidence: ');
    assert(offset >= 0, 'No evidence boundary in saved request');
    return { header: { ...request, prompt: request.prompt.slice(0, offset) }, evidence: JSON.parse(request.prompt.slice(offset + 11)) };
  };
  const previous = split(previousRequest), current = split(currentRequest);
  assert.deepEqual(previous.header, current.header, 'Worker instructions changed; cannot reuse this response');
  const omitId = rows => rows.map(({ evidenceId, ...row }) => row);
  assert.deepEqual(omitId(previous.evidence), omitId(current.evidence), 'Worker evidence changed; cannot reuse this response');
  const ids = new Map(previous.evidence.map((row, index) => [row.evidenceId, current.evidence[index].evidenceId]));
  assert.equal(ids.size, previous.evidence.length, 'Ambiguous previous evidence IDs');
  assert.equal(new Set(ids.values()).size, current.evidence.length, 'Ambiguous current evidence IDs');
  const rebound = structuredClone(response);
  rebound.parsed.findings = response.parsed.findings.map(finding => {
    assert(ids.has(finding.evidenceId), 'Unrecognized response evidence ID');
    return { ...finding, evidenceId: ids.get(finding.evidenceId) };
  });
  rebound.cacheReplay = { mode: 'identical_worker_input_except_package_scoped_ids', previousRequestSha256: sha(previousRequest), currentRequestSha256: sha(currentRequest), originalResponseSha256: sha(response), newAiCalls: 0 };
  return rebound;
}
