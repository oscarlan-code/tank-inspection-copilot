// Candidate evidence contract: explicit physical identity, immutable source spans.
// No report answer, historical recommendation or broad checklist label resolves identity.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
export const OBSERVATION_CONTEXT_CONTRACT = 'traceable_observation_v1';
export const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');

export function sourceSpan(source, quote) {
  const start = source.text.indexOf(quote);
  assert(start >= 0 && source.text.indexOf(quote, start + 1) < 0, 'Source quote must exist exactly once');
  return { sourceId: source.sourceId, sourcePointer: source.sourcePointer, sourceSha256: digest(source.text), start, end: start + quote.length, text: quote };
}

export function resolveComponent(text, glossary) {
  const hits = glossary.entries.filter(entry => entry.aliases.some(alias => new RegExp(`(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(text)));
  return hits.length === 1 ? { status: 'resolved', componentId: hits[0].componentId, label: hits[0].label } : { status: hits.length ? 'ambiguous' : 'unresolved', componentId: null, label: null };
}

export function bindObservation({ observationId, componentId, sources, claims, identity, glossary, sourcePackageHash, tags, missingInformation = [] }) {
  const spans = claims.map(({ sourceId, quote }) => sourceSpan(sources.find(s => s.sourceId === sourceId), quote));
  assert(spans.length && spans.every(span => !/\brecommend(?:ed|ation|ations)?\b|\bshould\b/i.test(span.text)), 'Recommendation input must contain observations only');
  const identitySpan = sourceSpan(sources.find(s => s.sourceId === identity.sourceId), identity.quote);
  const resolved = resolveComponent(identitySpan.text, glossary);
  assert.equal(resolved.status, 'resolved', 'Clarify unresolved or ambiguous physical identity');
  assert.equal(resolved.componentId, componentId, 'Physical component cannot be replaced by a screen/group label');
  return { contractVersion: OBSERVATION_CONTEXT_CONTRACT, observationId, componentId, componentLabel: resolved.label,
    originalWording: spans.map(s => s.text).join(' '), sourceSpans: spans, identityEvidence: identitySpan,
    sourcePackageHash, glossaryVersion: glossary.version, resolutionStatus: 'source_bound',
    reviewStatus: 'codex_checked_not_inspector_approved', tags, missingInformation,
    currentFactsOnly: true, sourceDerivedMock: true };
}

export function verifyObservation(observation, sources, glossary) {
  assert.equal(observation.contractVersion, OBSERVATION_CONTEXT_CONTRACT);
  assert.equal(observation.glossaryVersion, glossary.version);
  for (const span of [...observation.sourceSpans, observation.identityEvidence]) {
    const source = sources.find(s => s.sourceId === span.sourceId);
    assert(source && digest(source.text) === span.sourceSha256 && source.sourcePointer === span.sourcePointer);
    assert.equal(source.text.slice(span.start, span.end), span.text, 'Observation lost its source binding');
  }
  assert.equal(observation.originalWording, observation.sourceSpans.map(s => s.text).join(' '));
  const resolution = resolveComponent(observation.identityEvidence.text, glossary);
  assert.equal(resolution.componentId, observation.componentId);
  assert.equal(resolution.label, observation.componentLabel);
}
