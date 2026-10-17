import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTruthPilot } from './prepare-case-truth-pilot.mjs';

test('buildTruthPilot binds case-specific source blocks without report-specific constants', () => {
  const caseRecord = { caseId: 'case-2', caseRevision: 1, source: { sourceSha256: 'abc' } };
  const sourceBlocks = [
    { sourceBlockId: 'block-a', text: 'A 3 inch vent was observed.', sourceSpans: [{ pageNumber: 4 }] },
    { sourceBlockId: 'block-b', text: 'Install a new vent.', sourceSpans: [{ pageNumber: 5 }] },
  ];
  const semanticReview = { decision: 'pass', caseId: 'case-2', sourceSha256: 'abc', requestSha256: 'request-1',
    pageDecisions: [{ pageNumber: 4, excludedSourceBlockIds: [] }, { pageNumber: 5, excludedSourceBlockIds: [] }] };
  const spec = { contractVersion: 'mock_preparation_truth_pilot_spec_v1', caseId: 'case-2', caseRevision: 1,
    facts: [
      { factId: 'fact-a', sourceBlockId: 'block-a', factType: 'observation', noteId: 'note-a',
        protectedFacts: { nominalSize: { value: 3, unit: 'in', status: 'source_explicit' } } },
      { factId: 'fact-b', sourceBlockId: 'block-b', factType: 'recommendation', noteId: 'note-a' },
    ],
    notes: [{ noteId: 'note-a', purpose: 'observation', location: 'roof vent', appPlacement: {
      screenKey: 'findings', screenLabel: 'Findings', cardKey: 'screen', fieldKey: 'voice_note' } }],
  };
  const result = buildTruthPilot({ caseRecord, sourceBlocks, semanticReview, spec });
  assert.equal(result.gold.status, 'human_review_pending');
  assert.equal(result.gold.facts.length, 2);
  assert.equal(result.gold.facts[0].sourcePage, 4);
  assert.equal(result.gold.facts[0].sourceText, 'A 3 inch vent was observed.');
  assert.equal(result.gold.notes[0].factIds.length, 2);
  assert.equal(result.matrix.semanticUnits.length, 2);
  assert.equal(result.plan.voiceNotes[0].captureText,
    'A 3 inch vent was observed. Install a new vent.');
  assert.match(result.gold.goldSha256, /^[a-f0-9]{64}$/);
});

test('buildTruthPilot rejects blocks excluded by source integrity review', () => {
  assert.throws(() => buildTruthPilot({
    caseRecord: { caseId: 'case-2', caseRevision: 1, source: { sourceSha256: 'abc' } },
    sourceBlocks: [{ sourceBlockId: 'block-a', text: 'Wrong header', sourceSpans: [{ pageNumber: 4 }] }],
    semanticReview: { decision: 'pass', caseId: 'case-2', sourceSha256: 'abc', requestSha256: 'request-1',
      pageDecisions: [{ pageNumber: 4, excludedSourceBlockIds: ['block-a'] }] },
    spec: { contractVersion: 'mock_preparation_truth_pilot_spec_v1', caseId: 'case-2', caseRevision: 1,
      facts: [{ factId: 'fact-a', sourceBlockId: 'block-a', factType: 'observation', noteId: 'note-a' }],
      notes: [{ noteId: 'note-a', purpose: 'observation', location: 'x', appPlacement: {
        screenKey: 'findings', screenLabel: 'Findings', cardKey: 'screen', fieldKey: 'voice_note' } }],
    },
  }), /excluded by source review/);
});
