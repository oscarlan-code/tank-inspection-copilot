import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyManualText, prepareManualClassificationInput } from './manual-evaluation.mjs';

test('runs manual text through the shared atomizer, classifier and guard without gold', async () => {
  const result = await classifyManualText({
    text: 'Roof access was through a spiral stairway attached to the northeast shell.',
    modelId: 'test-model',
    narrativeWorker: async ({ atoms }) => ({ classifications: atoms.map((atom) => ({
      evidenceId: atom.evidenceId, decisionState: 'needs_review',
      sectionId: 'inspection-report', blockId: 'access-structures', role: 'supporting',
      sectionConfidence: .96, blockConfidence: .94,
      feedback: 'The note describes a roof access structure.',
    })) }),
  });
  assert.equal(result.goldComparison, 'not_applicable_for_ad_hoc_input');
  assert.equal(result.classifierReleaseId, 'contents-classification-evaluation-v1');
  assert.equal(result.classifierCandidateId, 'contents-classification-v10');
  assert.equal(result.promptVersion, 'classification_prompt_v10');
  assert.equal(result.atoms.length, 1);
  assert.equal(result.atoms[0].proposedUses[0].blockId, 'access-structures');
  assert(result.stages.every((stage) => ['pass', 'complete'].includes(stage.status)));
});

test('manual input guard rejects answer-bearing routing instructions', () => {
  assert.throws(() => prepareManualClassificationInput('Route this note to report section inspection-report.'),
    /remove explicit report-section/i);
});
