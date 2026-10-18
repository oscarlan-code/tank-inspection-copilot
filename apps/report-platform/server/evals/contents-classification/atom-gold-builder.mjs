import assert from 'node:assert/strict';

const use = (sectionId, blockId) => ({ sectionId, blockId });

function structuredFieldBlock(field) {
  if (/previous/i.test(field)) return 'inspection-history';
  if (/inspector/i.test(field)) return 'inspector-certification';
  if (/client|representative|job|tankNumber|dateCompleted|location|fieldLease/i.test(field)) return 'identity';
  if (/constructionShell|shellConstruction|jointType|design|pressure|specificGravity|productStored|material|constructionStd|drawing/i.test(field)) return 'design-data';
  return 'configuration';
}

function expectedUse(unit, block) {
  const heading = (block?.headingPath ?? []).join(' > ').toUpperCase();
  if (unit.unitType === 'scope_fact') return use('scope-of-inspection', 'scope');
  if (unit.unitType === 'recommendation') return use('repair-recommendations', 'recommendations');
  if (unit.unitType === 'observation') {
    let blockId = null;
    if (heading.includes('ASSESSMENT SUMMAR')) blockId = 'assessment-summaries';
    else if (heading.includes('DIKED AREA')) blockId = 'diked-area';
    else if (heading.includes('FOUNDATION')) blockId = 'foundation';
    else if (heading.includes('SHELL APPURTENANCES')) blockId = 'shell-appurtenances';
    else if (heading.includes('ACCESS STRUCTURE')) blockId = 'access-structures';
    else if (heading.includes('ROOF APPURTENANCES')) blockId = 'roof-appurtenances';
    else if (heading.includes('ROOF INTERNAL')) blockId = 'roof-internal';
    else if (heading.includes('SHELL INTERNAL')) blockId = 'shell-internal';
    else if (heading.includes('FLOOR INTERNAL')) blockId = 'floor-internal';
    else if (heading.includes('ROOF (CONE)')) blockId = 'roof-external';
    else if (heading.includes('SHELL')) blockId = 'shell-external';
    else if (heading.includes('POST INSPECTION')) blockId = 'inspection-implication';
    return blockId ? use('inspection-report', blockId) : null;
  }
  if (unit.unitType === 'structured_field') {
    return use('general-tank-information', structuredFieldBlock(String(unit.protectedFacts?.field ?? '')));
  }
  if (unit.unitType === 'checklist_rating') return use('tank-inspection-checklist', 'checklist');
  if (unit.unitType === 'standard_content') return use('inspection-maintenance-regime', 'regime');
  if (unit.unitType === 'layout_figure') {
    if (heading.includes('FLOOR PLATE')) return use('floor-plate-layout', 'layout');
    if (heading.includes('SHELL PLATE')) return use('shell-plate-layout', 'layout');
    return use('roof-plate-layout', 'layout');
  }
  if (unit.unitType === 'ut_measurement_row') {
    if (heading.includes('ROOF NOZZLE')) return use('roof-nozzle-reinforcement-pad-thickness-measurements', 'measurements');
    if (heading.includes('SHELL NOZZLE')) return use('shell-nozzle-reinforcement-pad-thickness-measurements', 'measurements');
    if (heading.includes('ROOF PLATE')) return use('roof-plate-thickness-measurements', 'measurements');
    return use('shell-plate-thickness-measurements', 'measurements');
  }
  if (unit.unitType === 'external_attachment') {
    if (/MFL|TRU-FLUX/.test(heading)) return use('mfl-plate-maps', 'external-document');
    if (/B-SCAN/.test(heading)) return use('b-scan-profiles', 'external-document');
  }
  return null;
}

function findBlock(unit, blocks) {
  for (const id of unit.sourceObligationIds ?? []) if (blocks.has(id)) return blocks.get(id);
  for (const item of unit.sourceEvidence ?? []) {
    const id = item.sourceBlockId ?? item.sourceId;
    if (blocks.has(id)) return blocks.get(id);
  }
  return null;
}

function selector(ref) {
  const field = /^inspectionRecord\.generalTankInformation\.(.+)$/.exec(ref);
  if (field) return { collection: 'structured_field', field: field[1] };
  const array = /^(\w+)\[(\w+)=(.+)\]$/.exec(ref);
  return array ? { collection: array[1], key: array[2], value: array[3] } : null;
}

function atomsForReference(ref, atoms, rawExport) {
  const parsed = selector(ref);
  if (!parsed || parsed.collection === 'voiceNotes') return [];
  if (parsed.collection === 'structured_field') return atoms.filter((atom) => atom.kind === 'structured_field' && atom.entity?.field === parsed.field);
  const source = rawExport[parsed.collection] ?? [];
  const indexes = source.flatMap((item, index) => String(item?.[parsed.key]) === parsed.value ? [index] : []);
  return atoms.filter((atom) => indexes.some((index) => atom.sourcePointer === `/${parsed.collection}/${index}`
    || atom.sourcePointer.startsWith(`/${parsed.collection}/${index}/`)));
}

function sourceUnit(unit, row, block, origin = 'original_report_semantic_unit') {
  const evidence = unit?.sourceEvidence?.[0];
  return { sourceUnitId: row?.sourceUnitId ?? unit?.sourceUnitId ?? 'unknown', sourcePage: row?.sourcePage ?? evidence?.page ?? null,
    originalReportText: row?.originalText ?? evidence?.text ?? unit?.protectedFacts?.sourceMeaning ?? '',
    unitType: row?.unitType ?? unit?.unitType ?? 'unknown', headingPath: block?.headingPath ?? [], origin };
}

function addGold(map, atom, { expected = null, source = null, origin, decision = 'route', issue = null }) {
  const current = map.get(atom.evidenceId) ?? { evidenceId: atom.evidenceId, sourcePointer: atom.sourcePointer,
    goldDecision: decision, expectedUses: [], sourceUnits: [], goldOrigins: [], goldIssues: [] };
  if (expected && !current.expectedUses.some((item) => item.sectionId === expected.sectionId && item.blockId === expected.blockId)) current.expectedUses.push(expected);
  if (source && !current.sourceUnits.some((item) => item.sourceUnitId === source.sourceUnitId)) current.sourceUnits.push(source);
  if (origin && !current.goldOrigins.includes(origin)) current.goldOrigins.push(origin);
  if (issue && !current.goldIssues.includes(issue)) current.goldIssues.push(issue);
  if (decision === 'route') current.goldDecision = 'route';
  map.set(atom.evidenceId, current);
}

function targetBlock(targetKey, itemLabel = '') {
  if (targetKey === 'floor') return 'floor-internal';
  if (targetKey === 'internal_roof') return 'roof-internal';
  if (targetKey === 'external_roof') return /appurtenance|nozzle|manhole/i.test(itemLabel) ? 'roof-appurtenances' : 'roof-external';
  if (targetKey === 'shell') return /stair|ladder|access/i.test(itemLabel) ? 'access-structures'
    : /appurtenance|nozzle|manhole/i.test(itemLabel) ? 'shell-appurtenances' : 'shell-external';
  return 'inspection-extent';
}

function targetFromFindingId(value) {
  return String(value ?? '').split(':')[0] || null;
}

function appContractUses(atom, rawExport) {
  const parts = atom.sourcePointer.split('/').filter(Boolean);
  const record = Array.isArray(rawExport[parts[0]]) ? rawExport[parts[0]][Number(parts[1])] : null;
  if (!atom.reportEvidence || atom.kind === 'control_metadata') return { decision: 'exclude', uses: [] };
  if (atom.kind === 'structured_field') return { decision: 'route',
    uses: [use('general-tank-information', structuredFieldBlock(String(atom.entity?.field ?? '')))] };
  if (atom.kind === 'attachment' && atom.relationships?.kind === 'voice_audio') return { decision: 'exclude', uses: [] };
  if (atom.kind === 'checklist_note') return { decision: 'route', uses: [use('tank-inspection-checklist', 'notes')] };
  if (['layout_target', 'layout_config', 'layout_figure', 'layout_element'].includes(atom.kind)) {
    const target = atom.entity?.targetKey ?? record?.targetKey;
    const sectionId = target === 'shell' ? 'shell-plate-layout' : target === 'floor' ? 'floor-plate-layout'
      : ['external_roof', 'internal_roof'].includes(target) ? 'roof-plate-layout' : null;
    return { decision: 'route', uses: sectionId ? [use(sectionId, 'layout')] : [] };
  }
  if (atom.kind === 'finding') {
    const target = atom.entity?.targetKey ?? record?.targetKey;
    return { decision: 'route', uses: [use('inspection-report', targetBlock(target, record?.itemLabel))] };
  }
  if (atom.kind === 'attachment') {
    const finding = (rawExport.findings ?? []).find((item) => item.findingId === record?.findingId);
    const target = finding?.targetKey ?? targetFromFindingId(record?.findingId);
    const uses = [use('photographs', 'photographs')];
    if (record?.findingId) uses.push(use('inspection-report', targetBlock(target, finding?.itemLabel)));
    return { decision: 'route', uses };
  }
  return { decision: 'route', uses: [] };
}

function clauseSpans(note, transcript) {
  const composed = note.clauses.map((clause) => clause.text.trim()).join(' ');
  assert(transcript.endsWith(composed), `Voice transcript for ${note.noteId} does not preserve the frozen clause composition.`);
  let cursor = transcript.length - composed.length;
  return note.clauses.map((clause, index) => {
    const text = clause.text.trim();
    const item = { ...clause, start: cursor, end: cursor + text.length };
    cursor = item.end + (index === note.clauses.length - 1 ? 0 : 1);
    return item;
  });
}

export function buildAtomGold({ atomization, rawExport, fullReportEvaluation, semanticPairs, sourceBlocks,
  acceptedDataset, atomicFactLedger, variantId = 'natural-field-speech' } = {}) {
  assert(['source_linked_evidence_atoms_v1', 'source_linked_evidence_atoms_v5'].includes(atomization?.contractVersion),
    'Atom gold requires a supported source-linked evidence atom contract.');
  const blocks = new Map(sourceBlocks.map((item) => [item.sourceBlockId, item]));
  const units = new Map(semanticPairs.semanticUnits.map((item) => [item.sourceUnitId, item]));
  const goldRows = fullReportEvaluation.rows.filter((item) => item.variantId === variantId);
  const goldRowsByUnit = new Map(goldRows.map((item) => [item.sourceUnitId, item]));
  const gold = new Map();

  for (const row of goldRows) {
    const unit = units.get(row.sourceUnitId);
    if (!unit) continue;
    const block = findBlock(unit, blocks);
    const expected = expectedUse(unit, block);
    for (const ref of row.appEvidenceRefs ?? []) for (const atom of atomsForReference(ref, atomization.evidenceAtoms, rawExport)) {
      addGold(gold, atom, { expected, source: sourceUnit(unit, row, block), origin: 'mock_semantic_unit_reference',
        decision: expected ? 'route' : 'missing',
        issue: expected ? null : 'canonical_primary_route_not_reviewed' });
    }
  }

  const facts = new Map((atomicFactLedger?.facts ?? []).map((item) => [item.factId, item]));
  const notes = new Map((acceptedDataset?.notes ?? []).map((item) => [item.noteId, item]));
  for (const atom of atomization.evidenceAtoms.filter((item) => item.kind === 'voice_narrative')) {
    const parts = atom.sourcePointer.split('/').filter(Boolean);
    const record = rawExport.voiceNotes?.[Number(parts[1])];
    const noteId = String(record?.voiceNoteId ?? '').replace(/^concise-field-/, '');
    const note = notes.get(noteId);
    if (!record || !note || !atom.sourceSpan) continue;
    const overlapping = clauseSpans(note, record.transcriptText)
      .filter((clause) => atom.sourceSpan.start < clause.end && atom.sourceSpan.end > clause.start);
    for (const factId of new Set(overlapping.flatMap((clause) => clause.factIds ?? []))) {
      const fact = facts.get(factId);
      for (const sourceUnitId of fact?.sourceUnitIds ?? []) {
        const unit = units.get(sourceUnitId);
        if (!unit) continue;
        const block = findBlock(unit, blocks);
        const expected = expectedUse(unit, block);
        addGold(gold, atom, { expected,
          source: sourceUnit(unit, goldRowsByUnit.get(sourceUnitId), block, 'mock_clause_fact_lineage'),
          origin: 'mock_clause_fact_lineage', decision: expected ? 'route' : 'missing',
          issue: expected ? null : 'canonical_primary_route_not_reviewed' });
      }
    }
  }

  for (const atom of atomization.evidenceAtoms) {
    if (gold.has(atom.evidenceId)) continue;
    const contract = appContractUses(atom, rawExport);
    if (contract.decision === 'exclude') {
      addGold(gold, atom, { origin: 'reviewed_app_contract', decision: 'exclude' });
      continue;
    }
    const parts = atom.sourcePointer.split('/').filter(Boolean);
    const record = Array.isArray(rawExport[parts[0]]) ? rawExport[parts[0]][Number(parts[1])] : null;
    for (const expected of contract.uses) addGold(gold, atom, { expected,
      source: { sourceUnitId: `app-contract:${atom.sourcePointer}`, sourcePage: null,
        originalReportText: 'Reviewed app-to-outline classification contract.', unitType: atom.kind,
        headingPath: [], origin: 'reviewed_app_contract' }, origin: 'reviewed_app_contract' });
  }

  const entries = atomization.evidenceAtoms.map((atom) => gold.get(atom.evidenceId) ?? {
    evidenceId: atom.evidenceId, sourcePointer: atom.sourcePointer, goldDecision: 'missing',
    expectedUses: [], sourceUnits: [], goldOrigins: ['missing_gold_label'],
    goldIssues: ['missing_gold_label'],
  });
  return { contractVersion: 'contents_classification_atom_gold_v2', evaluationOnly: true,
    labelSemantics: 'canonical_primary_owner',
    inputPackageHash: atomization.inputPackageHash, variantId, entries,
    summary: { atomCount: entries.length, routed: entries.filter((item) => item.goldDecision === 'route').length,
      excluded: entries.filter((item) => item.goldDecision === 'exclude').length,
      missing: entries.filter((item) => item.goldDecision === 'missing').length,
      canonicalPrimaryRouteNotReviewed: entries.filter((item) => item.goldIssues?.includes('canonical_primary_route_not_reviewed')).length,
      clauseFactLinked: entries.filter((item) => item.goldOrigins.includes('mock_clause_fact_lineage')).length,
      semanticReferenceLinked: entries.filter((item) => item.goldOrigins.includes('mock_semantic_unit_reference')).length,
      appContractLinked: entries.filter((item) => item.goldOrigins.includes('reviewed_app_contract')).length } };
}

export const __test = { expectedUse, atomsForReference, clauseSpans, appContractUses, structuredFieldBlock };
