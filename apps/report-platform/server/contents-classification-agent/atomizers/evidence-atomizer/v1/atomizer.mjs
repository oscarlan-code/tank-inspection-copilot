import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const ATOMIZER_ID = 'evidence-atomizer-v1';
export const ATOMIZATION_CONTRACT = 'source_linked_evidence_atoms_v1';

const canonical = (value) => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
const sha256 = (value) => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
const pointer = (...parts) => `/${parts.map((part) => String(part).replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`;

function voiceSegments(text) {
  const value = String(text ?? '');
  if (!value.trim()) return [];
  const raw = typeof Intl?.Segmenter === 'function'
    ? [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(value)].map((item) => ({ index: item.index, segment: item.segment }))
    : [{ index: 0, segment: value }];
  return raw.flatMap(({ index, segment }) => {
    const leading = segment.length - segment.trimStart().length;
    const trailing = segment.length - segment.trimEnd().length;
    const start = index + leading;
    const end = index + segment.length - trailing;
    return end > start ? [{ start, end, text: value.slice(start, end) }] : [];
  });
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ''));
}

function entityFrom(record = {}) {
  return compactObject({
    targetKey: record.targetKey,
    itemKey: record.itemKey ?? record.linkedUtItemKey,
    findingId: record.findingId,
    elementId: record.elementId,
    elementTypeKey: record.elementTypeKey,
    itemLabel: record.itemLabel,
    itemKind: record.itemKind,
    surfaceKey: record.surfaceKey,
    sectionKey: record.sectionKey,
  });
}

function displayFor(kind, value, unit) {
  if (kind === 'structured_field') return String(value ?? '');
  if (kind === 'ut_measurement_row') {
    const readings = ['value1', 'value2', 'value3', 'value4', 'reinforcementPadReading']
      .filter((key) => value[key] !== undefined && value[key] !== null)
      .map((key) => `${key}: ${value[key]} ${unit}`);
    return `${value.itemLabel ?? value.itemKey ?? 'UT row'} · ${readings.join(' · ') || 'No measured values'}`;
  }
  if (kind === 'checklist_rating') return `${value.sectionTitle} · ${value.itemNumber}. ${value.itemPrompt} ${value.ratingLabel}`;
  if (kind === 'voice_narrative') return String(value);
  if (kind === 'finding') return `${value.itemLabel ?? value.findingId}: ${value.note ?? ''}`.trim();
  if (kind === 'attachment') return `${value.kind ?? 'attachment'} · ${value.displayName ?? value.attachmentId}`;
  if (kind.startsWith('layout_')) return `${value.targetLabel ?? value.targetKey ?? value.itemLabel ?? kind}`;
  if (kind === 'control_metadata') return String(value.taskTitle ?? value.message ?? value.validationKey ?? value.taskKey ?? 'Control record');
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function atomizeEvidence({ sealedInput } = {}) {
  assert.equal(sealedInput?.contractVersion, 'sealed_classification_input_v1', 'A passed sealed classification input is required.');
  assert(['evaluation-input-leakage-guard-v1', 'manual-evaluation-input-guard-v1'].includes(sealedInput?.guardId),
    'Unexpected input guard.');
  const pkg = sealedInput.exportPackage;
  assert(pkg && typeof pkg === 'object', 'Sealed input has no export package.');
  const before = canonical(pkg);
  const atoms = [];
  const accounting = [];
  const unit = pkg.unitProfile?.thicknessUnit ?? 'mm';
  const add = ({ kind, sourcePointer, originalValue, sourceSpan = null, method = 'deterministic_record', entity = {}, relationships = {}, reportEvidence = true }) => {
    const evidenceId = `atom_${sha256(`${sealedInput.inputPackageHash}:${sourcePointer}:${sourceSpan?.start ?? ''}:${sourceSpan?.end ?? ''}`).slice(0, 24)}`;
    atoms.push({ evidenceId, sourcePointer, kind, originalValue, displayText: displayFor(kind, originalValue, unit),
      unit: kind === 'ut_measurement_row' ? unit : null, sourceSpan, atomizationMethod: method,
      entity, relationships, reportEvidence, evidenceSha256: sha256(originalValue) });
  };
  const records = (name, kind, options = {}) => {
    const rows = Array.isArray(pkg[name]) ? pkg[name] : [];
    for (const [index, row] of rows.entries()) add({ kind, sourcePointer: pointer(name, index), originalValue: row,
      entity: options.entity?.(row) ?? entityFrom(row), relationships: options.relationships?.(row) ?? {}, reportEvidence: options.reportEvidence ?? true });
    accounting.push({ sourcePath: pointer(name), inputRecords: rows.length, atomCount: rows.length,
      disposition: options.reportEvidence === false ? 'explicit_control_metadata' : 'atomized' });
  };

  const general = pkg.inspectionRecord?.generalTankInformation ?? {};
  for (const [field, value] of Object.entries(general)) {
    add({ kind: 'structured_field', sourcePointer: pointer('inspectionRecord', 'generalTankInformation', field),
      originalValue: value, entity: { field } });
  }
  accounting.push({ sourcePath: '/inspectionRecord/generalTankInformation', inputRecords: Object.keys(general).length,
    atomCount: Object.keys(general).length, disposition: 'atomized' });

  records('utMeasurements', 'ut_measurement_row');
  records('inspectionChecklistItems', 'checklist_rating');
  records('inspectionChecklistSectionNotes', 'checklist_note');
  records('layoutTargets', 'layout_target');
  records('layoutConfigs', 'layout_config');
  records('layoutFigures', 'layout_figure');
  records('elements', 'layout_element');
  records('findings', 'finding', { relationships: (row) => ({ linkedUtItemKey: row.linkedUtItemKey }) });

  const voiceNotes = Array.isArray(pkg.voiceNotes) ? pkg.voiceNotes : [];
  let voiceAtomCount = 0;
  for (const [index, note] of voiceNotes.entries()) {
    const textPointer = pointer('voiceNotes', index, 'transcriptText');
    for (const span of voiceSegments(note.transcriptText)) {
      add({ kind: 'voice_narrative', sourcePointer: textPointer, originalValue: span.text,
        sourceSpan: { start: span.start, end: span.end }, method: 'exact_source_span',
        entity: entityFrom(note), relationships: { voiceNoteId: note.voiceNoteId, screenKey: note.screenKey,
          screenLabel: note.screenLabel, cardKey: note.cardKey, fieldKey: note.fieldKey } });
      voiceAtomCount += 1;
    }
  }
  accounting.push({ sourcePath: '/voiceNotes', inputRecords: voiceNotes.length, atomCount: voiceAtomCount,
    disposition: 'exact_source_span_atomized' });

  const findingsById = new Map((pkg.findings ?? []).map((item) => [item.findingId, item]));
  records('attachments', 'attachment', {
    entity: (row) => entityFrom({ ...(findingsById.get(row.findingId) ?? {}), ...row }),
    relationships: (row) => ({ findingId: row.findingId, kind: row.kind }),
  });
  records('taskSnapshots', 'control_metadata', { reportEvidence: false });
  records('validationResults', 'control_metadata', { reportEvidence: false });

  const ignored = ['packageType', 'schemaVersion', 'inspectionReference', 'tenantId', 'workspaceId', 'inspectionId',
    'exportedByUserId', 'exportedAtIso', 'deviceId', 'workflowScreen', 'unitProfile', 'profile', 'task', 'inspectionRecord']
    .filter((key) => Object.hasOwn(pkg, key));
  assert.equal(canonical(pkg), before, 'Evidence atomization mutated the sealed export.');
  assert.equal(new Set(atoms.map((item) => item.evidenceId)).size, atoms.length, 'Evidence atom IDs must be unique.');
  return {
    contractVersion: ATOMIZATION_CONTRACT, atomizerId: ATOMIZER_ID, inputPackageHash: sealedInput.inputPackageHash,
    lineageToken: sealedInput.lineageToken, evidenceAtoms: atoms,
    manifest: { atomCount: atoms.length, reportEvidenceAtomCount: atoms.filter((item) => item.reportEvidence).length,
      excludedControlAtomCount: atoms.filter((item) => !item.reportEvidence).length,
      byKind: Object.fromEntries([...new Set(atoms.map((item) => item.kind))].sort().map((kind) => [kind, atoms.filter((item) => item.kind === kind).length])),
      nativeCollectionAccounting: accounting, ignoredEnvelopeFields: ignored,
      originalExportMutated: false, generatedAtIso: new Date().toISOString() },
  };
}

export const __test = { voiceSegments, canonical };

