import assert from 'node:assert/strict';
import test from 'node:test';
import { atomizeEvidence } from './atomizer.mjs';

const sealed = () => ({ contractVersion: 'sealed_classification_input_v1', guardId: 'evaluation-input-leakage-guard-v1',
  inputPackageHash: 'a'.repeat(64), lineageToken: `eval_ln_${'b'.repeat(64)}`, exportPackage: {
    unitProfile: { thicknessUnit: 'mm' }, inspectionRecord: { generalTankInformation: { client: 'Client', diameter: '10 m' } },
    utMeasurements: [{ itemKey: 'shell:1', targetKey: 'shell', itemLabel: 'Course 1', value1: 6.2 }],
    inspectionChecklistItems: [{ sectionKey: 'shell', sectionTitle: 'Shell', itemNumber: 1, itemPrompt: 'Condition', ratingLabel: 'Satisfactory' }],
    inspectionChecklistSectionNotes: [], layoutTargets: [{ targetKey: 'shell', targetLabel: 'Shell' }], layoutConfigs: [],
    layoutFigures: [], elements: [], findings: [], voiceNotes: [{ voiceNoteId: 'v1', screenKey: 'findings',
      transcriptText: 'Shell coating is damaged. Repair the coating during maintenance.' }], attachments: [],
    taskSnapshots: [{ taskKey: 'review', taskTitle: 'Review' }], validationResults: [{ message: 'Complete' }],
  } });

test('atomizes every supported evidence type and preserves exact voice spans', () => {
  const input = sealed();
  const before = JSON.stringify(input.exportPackage);
  const result = atomizeEvidence({ sealedInput: input });
  assert.equal(result.manifest.atomCount, 9);
  assert.equal(result.manifest.byKind.structured_field, 2);
  assert.equal(result.manifest.byKind.voice_narrative, 2);
  assert.equal(result.manifest.excludedControlAtomCount, 2);
  for (const atom of result.evidenceAtoms.filter((item) => item.kind === 'voice_narrative')) {
    const source = input.exportPackage.voiceNotes[0].transcriptText;
    assert.equal(source.slice(atom.sourceSpan.start, atom.sourceSpan.end), atom.originalValue);
  }
  assert.equal(JSON.stringify(input.exportPackage), before);
});

test('carries linked finding target and label into photo atoms', () => {
  const input = sealed();
  input.exportPackage.findings = [{ findingId: 'external_roof:element:manhole', targetKey: 'external_roof',
    itemLabel: 'Roof appurtenances', itemKind: 'ELEMENT', note: 'Observed.' }];
  input.exportPackage.attachments = [{ attachmentId: 'external_roof:element:manhole:photo-1',
    findingId: 'external_roof:element:manhole', kind: 'finding_photo', displayName: 'Photo 1.png' }];
  const result = atomizeEvidence({ sealedInput: input });
  const photo = result.evidenceAtoms.find((item) => item.kind === 'attachment');
  assert.equal(photo.entity.targetKey, 'external_roof');
  assert.equal(photo.entity.itemLabel, 'Roof appurtenances');
  assert.equal(photo.relationships.findingId, 'external_roof:element:manhole');
});

