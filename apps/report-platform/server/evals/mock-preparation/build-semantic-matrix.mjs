#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const saveJson = async (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });

function parseArgs(argv) {
  const args = { caseRoot: null, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--case-root' || arg === '--output') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      args[arg === '--case-root' ? 'caseRoot' : 'output'] = resolve(value);
      index += 1;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.caseRoot) throw new Error('Usage: build-semantic-matrix.mjs --case-root <path> [--output <path>]');
  args.output ??= join(args.caseRoot, 'semantic-pairs.json');
  return args;
}

const normalize = (value) => {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalize(item)]));
  }
  if (typeof value === 'number') return Number(value.toFixed(6));
  if (typeof value === 'string') return value.trim().replace(/\s+/g, ' ');
  return value;
};
const same = (left, right) => JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));

const fieldSources = {
  client: ['src-p006-b0130'],
  clientRepresentative: ['src-p006-b0131', 'src-p006-b0132'],
  jobNo: ['src-p002-b0016'],
  tankNumber: ['src-p006-b0133', 'src-p006-b0134'],
  dateCompleted: ['src-p002-b0017'],
  inspector: ['src-p002-b0036', 'src-p002-b0037'],
  location: ['src-p006-b0135', 'src-p006-b0136'],
  fieldLeaseName: ['src-p006-b0139', 'src-p006-b0140'],
  yearBuilt: ['src-p006-b0137', 'src-p006-b0138'],
  originalManufacturer: ['src-p006-b0141'],
  originalConstructionStd: ['src-p006-b0144', 'src-p006-b0145', 'src-p006-b0146', 'src-p006-b0147'],
  materialSpec: ['src-p006-b0150', 'src-p006-b0151'],
  drawingRef: ['src-p006-b0159', 'src-p006-b0160'],
  shellConstruction: ['src-p006-b0154', 'src-p006-b0155'],
  roofType: ['src-p006-b0167', 'src-p006-b0168'],
  height: ['src-p006-b0142', 'src-p006-b0143'],
  serviceHeight: ['src-p006-b0148', 'src-p006-b0149'],
  diameter: ['src-p006-b0152', 'src-p006-b0153'],
  productStored: ['src-p006-b0156', 'src-p006-b0157', 'src-p006-b0158'],
  specificGravity: ['src-p006-b0165', 'src-p006-b0166'],
  designTemp: ['src-p006-b0169', 'src-p006-b0170'],
  internalPressure: ['src-p006-b0171', 'src-p006-b0172'],
  courseNumber: ['src-p006-b0173', 'src-p006-b0174'],
  floorPlateNumber: ['src-p006-b0175', 'src-p006-b0176'],
  roofPlateNumber: ['src-p006-b0177', 'src-p006-b0178'],
  floorPlateThickness: ['src-p006-b0179'],
  windGirder: ['src-p006-b0180', 'src-p006-b0181'],
  annularPlateNumber: ['src-p006-b0182', 'src-p006-b0183'],
  insulated: ['src-p006-b0184', 'src-p006-b0185'],
  annularPlateThickness: ['src-p006-b0161', 'src-p006-b0162', 'src-p006-b0186', 'src-p006-b0187'],
  stiffener: ['src-p006-b0163', 'src-p006-b0164'],
  previousExternal: ['src-p006-b0188', 'src-p006-b0189', 'src-p006-b0190'],
  previousInternal: ['src-p006-b0191', 'src-p006-b0192'],
  previousBottom: ['src-p006-b0193', 'src-p006-b0194'],
};

const noteSources = {
  'scope-01': ['src-p004-b0073'],
  'scope-02': ['src-p004-b0074'],
  'scope-03': ['src-p004-b0075', 'src-p004-b0076', 'src-p004-b0077', 'src-p004-b0078'],
  'scope-04': ['src-p004-b0079', 'src-p004-b0080', 'src-p004-b0081'],
  'obs-01': ['src-p007-b0201', 'src-p007-b0202'],
  'obs-02': ['src-p007-b0203'],
  'obs-03': ['src-p007-b0207'],
  'obs-04': ['src-p007-b0208', 'src-p007-b0209', 'src-p007-b0210'],
  'obs-05': ['src-p007-b0211', 'src-p007-b0212', 'src-p007-b0213', 'src-p007-b0214', 'src-p007-b0215'],
  'obs-06': ['src-p007-b0216'],
  'obs-07': ['src-p007-b0218', 'src-p007-b0219', 'src-p007-b0220'],
  'obs-08': ['src-p007-b0221'],
  'obs-09': ['src-p008-b0244'],
  'obs-10': ['src-p008-b0245'],
  'obs-11': ['src-p008-b0246', 'src-p008-b0247'],
  'obs-12': ['src-p008-b0251'],
  'obs-13': ['src-p009-b0259', 'src-p009-b0260'],
  'obs-14': ['src-p009-b0261'],
  'obs-15': ['src-p009-b0262'],
  'obs-16': ['src-p010-b0294'],
  'obs-17': ['src-p010-b0295'],
  'obs-18': ['src-p010-b0296'],
  'obs-19': ['src-p010-b0297', 'src-p010-b0298'],
  'obs-20': ['src-p010-b0302', 'src-p010-b0303', 'src-p010-b0304'],
  'obs-21': ['src-p010-b0305'],
  'obs-22': ['src-p010-b0307', 'src-p010-b0308', 'src-p010-b0309', 'src-p010-b0310'],
  'obs-23': ['src-p011-b0323', 'src-p011-b0324', 'src-p011-b0325', 'src-p011-b0326'],
  'obs-24': ['src-p011-b0329', 'src-p011-b0330', 'src-p011-b0331'],
  'obs-25': ['src-p011-b0332', 'src-p011-b0333', 'src-p011-b0334'],
  'obs-26': ['src-p011-b0335', 'src-p011-b0336', 'src-p011-b0339', 'src-p011-b0341'],
  'obs-27': ['src-p011-b0337', 'src-p011-b0343', 'src-p011-b0345', 'src-p011-b0347'],
  'obs-28': ['src-p011-b0350'],
  'rec-01': ['src-p013-b0410'],
  'rec-02': ['src-p013-b0411'],
  'rec-03': ['src-p013-b0412'],
  'rec-04': ['src-p013-b0413'],
  'rec-05': ['src-p013-b0414'],
  'rec-06': ['src-p013-b0415'],
  'rec-07': ['src-p013-b0416'],
};

const findingByNote = {
  'obs-09': 'shell:element:shell_nozzle_s4',
  'obs-17': 'external_roof:element:roof_nozzle_r1',
  'obs-21': 'internal_roof:element:internal_roof_vent',
};

const layoutSources = {
  'src-p023-b0535': 'external_roof',
  'src-p023-b0540': 'external_roof',
  'src-p023-b0542': 'external_roof',
  'src-p027-b0616': 'shell',
  'src-p027-b0620': 'shell',
  'src-p036-b0720': 'floor',
  'src-p036-b0727': 'floor',
};

function checklistSourceId(page) {
  return ({ 15: 'src-p015-b0436', 16: 'src-p016-b0451', 17: 'src-p017-b0468', 18: 'src-p018-b0481', 19: 'src-p019-b0495', 20: 'src-p020-b0507' })[page];
}

function utSourceId(entry) {
  if (entry.target === 'external_roof' && entry.kind === 'LAYOUT_REGION') return 'src-p021-b0517';
  if (entry.target === 'external_roof' && entry.kind === 'ELEMENT') return 'src-p022-b0530';
  if (entry.target === 'shell' && entry.itemKey.endsWith('-C1')) return 'src-p025-b0599';
  if (entry.target === 'shell' && entry.itemKey.endsWith('-C2')) return 'src-p025-b0600';
  throw new Error(`No source mapping for UT entry ${entry.itemKey}`);
}

function utFacts(entry) {
  return {
    itemKey: entry.itemKey,
    target: entry.target,
    itemLabel: entry.itemLabel,
    kind: entry.kind,
    elementType: entry.elementType ?? null,
    nozzleSize: entry.nozzleSize ?? '',
    reinforcementPadReading: entry.reinforcementPadReading === '' ? '' : Number(entry.reinforcementPadReading),
    readings: entry.readings.map(Number),
    confirmed: Boolean(entry.confirmed),
  };
}

function exportedUtFacts(entry) {
  const readings = [1, 2, 3, 4, 5]
    .map((number) => entry?.[`value${number}`])
    .filter((value) => value !== undefined && value !== null);
  return entry ? {
    itemKey: entry.itemKey,
    target: entry.targetKey,
    itemLabel: entry.itemLabel,
    kind: entry.itemKind,
    elementType: entry.elementTypeKey ?? null,
    nozzleSize: entry.nozzleSize ?? '',
    reinforcementPadReading: entry.reinforcementPadReading ?? '',
    readings,
    confirmed: Boolean(entry.confirmed),
  } : null;
}

async function build(caseRoot) {
  const [inventory, checklist, plan, receipt] = await Promise.all([
    readJson(join(caseRoot, 'source-inventory.json')),
    readJson(join(caseRoot, 'checklist-extraction.json')),
    readJson(join(caseRoot, 'reviewed-case-plan.json')),
    readJson(join(caseRoot, 'build-receipt.json')),
  ]);
  const obligations = new Map(inventory.obligations.map((item) => [item.obligationId, item]));
  const variantIds = receipt.draftVariants;
  const exportsByVariant = new Map(await Promise.all(variantIds.map(async (variantId) => [
    variantId,
    await readJson(join(caseRoot, 'exports', variantId, 'v3-product-export.json')),
  ])));
  const semanticUnits = [];
  const rowsByVariant = new Map(variantIds.map((variantId) => [variantId, []]));

  function sourceDetails(sourceIds) {
    return sourceIds.map((sourceId) => {
      const source = obligations.get(sourceId);
      if (!source) throw new Error(`Unknown source obligation ${sourceId}`);
      return { sourceId, page: source.sourcePageNumber, text: source.sourceText };
    });
  }

  function addUnit(unit, makeRow = null) {
    semanticUnits.push({
      ...unit,
      sourceEvidence: sourceDetails(unit.sourceObligationIds),
    });
    if (!makeRow) return;
    for (const variantId of variantIds) rowsByVariant.get(variantId).push(makeRow(variantId, exportsByVariant.get(variantId)));
  }

  addUnit({
    sourceUnitId: 'source-unit-general-heading',
    semanticKey: 'general_tank_information.section_heading',
    unitType: 'document_structure', criticality: 'required', appCapability: 'report_platform_owned',
    evaluationMode: 'structure', sourceObligationIds: ['src-p006-b0122', 'src-p006-b0128'],
    protectedFacts: { title: 'GENERAL TANK INFORMATION' },
  });

  for (const [field, sourceIds] of Object.entries(fieldSources)) {
    const expected = plan.generalTankInfo[field];
    addUnit({
      sourceUnitId: `source-unit-general-${field}`,
      semanticKey: `general_tank_information.${field}`,
      unitType: 'structured_field', criticality: 'required', appCapability: 'capturable',
      evaluationMode: 'exact', sourceObligationIds: sourceIds,
      protectedFacts: { field, value: expected },
      sourceGroundingReview: 'pending_independent_review',
    }, (variantId, exported) => {
      const actual = exported.inspectionRecord?.generalTankInformation?.[field];
      const passed = same(actual, expected);
      return {
        sourceUnitId: `source-unit-general-${field}`,
        mockEvidenceRefs: [`inspectionRecord.generalTankInformation.${field}`],
        expectedValue: expected, actualValue: actual,
        semanticVerdict: passed ? 'preserved' : 'changed',
        integrityVerdict: passed ? 'pass' : 'fail', unsupportedAdditionCount: 0,
        reviewed: true,
        grader: { type: 'deterministic', id: 'structured-parity', version: '1.0.0' },
        reviewScope: 'prepared-gold-to-android-export parity; source grounding awaits independent review',
      };
    });
  }

  addUnit({
    sourceUnitId: 'source-unit-general-shell-nominal-thickness',
    semanticKey: 'general_tank_information.shellNominalThickness',
    unitType: 'structured_field', criticality: 'required', appCapability: 'unsupported',
    evaluationMode: 'gap', sourceObligationIds: ['src-p006-b0155'],
    protectedFacts: { courses: '1st–2nd', nominalThickness: 6.0, unit: 'mm' },
    gapReason: 'The current General Information export has shell construction but no dedicated nominal shell thickness field.',
  });

  for (const item of checklist.items) {
    const sourceId = checklistSourceId(item.sourcePageNumber);
    const sourceUnitId = `source-unit-checklist-${String(item.itemNumber).padStart(3, '0')}`;
    const expected = { itemNumber: item.itemNumber, ratingKey: item.ratingKey };
    addUnit({
      sourceUnitId,
      semanticKey: `inspection_checklist.item_${String(item.itemNumber).padStart(3, '0')}`,
      unitType: 'checklist_rating', criticality: 'required', appCapability: 'capturable',
      evaluationMode: 'exact', sourceObligationIds: [sourceId], protectedFacts: expected,
      sourceGroundingReview: 'pending_independent_review',
    }, (variantId, exported) => {
      const record = exported.inspectionChecklistItems.find((candidate) => candidate.itemNumber === item.itemNumber);
      const actual = record ? { itemNumber: record.itemNumber, ratingKey: record.ratingKey } : null;
      const passed = same(actual, expected);
      return {
        sourceUnitId,
        mockEvidenceRefs: record ? [`inspectionChecklistItems[itemNumber=${item.itemNumber}]`] : [],
        expectedValue: expected, actualValue: actual,
        semanticVerdict: passed ? 'preserved' : 'changed', integrityVerdict: passed ? 'pass' : 'fail',
        unsupportedAdditionCount: 0, reviewed: true,
        grader: { type: 'deterministic', id: 'checklist-rating-parity', version: '1.0.0' },
        reviewScope: 'extracted-gold-to-android-export parity; source colour interpretation awaits independent review',
      };
    });
  }

  for (const entry of plan.utEntries) {
    const sourceId = utSourceId(entry);
    const sourceUnitId = `source-unit-ut-${entry.itemKey.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}`;
    const expected = utFacts(entry);
    addUnit({
      sourceUnitId, semanticKey: `ut_measurement.${entry.itemKey}`,
      unitType: 'ut_measurement_row', criticality: 'critical', appCapability: 'capturable',
      evaluationMode: 'exact', sourceObligationIds: [sourceId], protectedFacts: expected,
      sourceGroundingReview: 'pending_independent_review',
    }, (variantId, exported) => {
      const record = exported.utMeasurements.find((candidate) => candidate.itemKey === entry.itemKey);
      const actual = exportedUtFacts(record);
      const passed = same(actual, expected);
      return {
        sourceUnitId,
        mockEvidenceRefs: record ? [`utMeasurements[itemKey=${entry.itemKey}]`] : [],
        expectedValue: expected, actualValue: actual,
        semanticVerdict: passed ? 'preserved' : 'changed', integrityVerdict: passed ? 'pass' : 'fail',
        unsupportedAdditionCount: 0, reviewed: true,
        grader: { type: 'deterministic', id: 'ut-row-parity', version: '1.0.0' },
        reviewScope: 'prepared-gold-to-android-export parity; table extraction awaits independent review',
      };
    });
  }

  for (const [noteId, sourceIds] of Object.entries(noteSources)) {
    sourceIds.forEach((sourceId, index) => {
      const sourceUnitId = `source-unit-${sourceId}-${noteId}`;
      const obligation = obligations.get(sourceId);
      addUnit({
        sourceUnitId,
        semanticKey: `field_narrative.${noteId}.${String(index + 1).padStart(2, '0')}`,
        evidenceGroupId: noteId,
        unitType: noteId.startsWith('scope-') ? 'scope_fact' : noteId.startsWith('rec-') ? 'recommendation' : 'observation',
        criticality: noteId.startsWith('obs-') ? 'critical' : 'required', appCapability: 'capturable',
        evaluationMode: 'semantic', sourceObligationIds: [sourceId],
        protectedFacts: { sourceMeaning: obligation.sourceText },
        variationPolicy: 'Wording, sequence, disfluency and segmentation may vary; meaning and protected facts may not.',
      }, (variantId, exported) => {
        const voiceNoteId = `${variantId}-${noteId}`;
        const record = exported.voiceNotes.find((candidate) => candidate.voiceNoteId === voiceNoteId);
        const findingKey = findingByNote[noteId];
        const finding = findingKey ? exported.findings.find((candidate) => candidate.findingId === findingKey) : null;
        const refs = [];
        if (record) refs.push(`voiceNotes[voiceNoteId=${voiceNoteId}]`);
        if (finding) refs.push(`findings[findingId=${findingKey}]`);
        return {
          sourceUnitId, mockEvidenceRefs: refs,
          goldText: obligation.sourceText,
          mockText: [record?.transcriptText, finding?.note].filter(Boolean).join('\n'),
          mockContext: {
            voice: record ? {
              screenKey: record.screenKey,
              screenLabel: record.screenLabel,
              cardKey: record.cardKey,
              fieldKey: record.fieldKey,
              itemKey: record.itemKey,
              itemLabel: record.itemLabel,
            } : null,
            finding: finding ? {
              findingId: finding.findingId,
              targetKey: finding.targetKey,
              itemLabel: finding.itemLabel,
              itemKind: finding.itemKind,
              elementTypeKey: finding.elementTypeKey,
              linkedUtItemKey: finding.linkedUtItemKey,
            } : null,
          },
          semanticVerdict: 'pending', integrityVerdict: 'pending', unsupportedAdditionCount: null,
          reviewed: false,
          grader: { type: 'human', id: 'pending-independent-semantic-review', version: '1.0.0' },
          reviewInstructions: 'Accept paraphrase and field-note style. Check entity, location, condition, polarity, uncertainty, values, units and relationships.',
        };
      });
    });
  }

  for (const [sourceId, target] of Object.entries(layoutSources)) {
    const sourceUnitId = `source-unit-layout-${sourceId}`;
    const source = obligations.get(sourceId);
    addUnit({
      sourceUnitId, semanticKey: `layout.${target}.${sourceId}`,
      unitType: 'layout_figure', criticality: 'required', appCapability: 'capturable',
      evaluationMode: 'visual', sourceObligationIds: [sourceId],
      protectedFacts: { sourcePage: source.sourcePageNumber, target },
    }, (variantId, exported) => {
      const config = exported.layoutConfigs.find((item) => item.targetKey === target);
      const targetRecord = exported.layoutTargets.find((item) => item.targetKey === target);
      const elements = exported.elements.filter((item) => item.targetKey === target);
      const refs = [];
      if (config) refs.push(`layoutConfigs[targetKey=${target}]`);
      if (targetRecord) refs.push(`layoutTargets[targetKey=${target}]`);
      if (elements.length) refs.push(`elements[targetKey=${target}]`);
      return {
        sourceUnitId, mockEvidenceRefs: refs,
        goldText: `[layout figure, source page ${source.sourcePageNumber}]`,
        mockText: JSON.stringify({ config, target: targetRecord, elements }, null, 2),
        semanticVerdict: 'pending', integrityVerdict: 'pending', unsupportedAdditionCount: null,
        reviewed: false,
        grader: { type: 'human', id: 'pending-layout-review', version: '1.0.0' },
        reviewInstructions: 'Compare topology, orientation, labels, plate/course counts and element placement against the source figure.',
      };
    });
  }

  addUnit({
    sourceUnitId: 'source-unit-test-ut-method', semanticKey: 'test_information.ultrasonic_thickness',
    evidenceGroupId: 'test-ut-method',
    unitType: 'test_method', criticality: 'required', appCapability: 'capturable',
    evaluationMode: 'semantic', sourceObligationIds: ['src-p014-b0426'],
    protectedFacts: { method: 'Ultrasonic Thickness Inspection' },
  }, (variantId, exported) => {
    const noteIds = [`${variantId}-test-01`, `${variantId}-test-02`];
    const records = exported.voiceNotes.filter((item) => noteIds.includes(item.voiceNoteId));
    return {
      sourceUnitId: 'source-unit-test-ut-method',
      mockEvidenceRefs: records.map((item) => `voiceNotes[voiceNoteId=${item.voiceNoteId}]`),
      goldText: obligations.get('src-p014-b0426').sourceText,
      mockText: records.map((item) => item.transcriptText).join('\n'),
      mockContext: {
        voice: records.map((record) => ({
          screenKey: record.screenKey,
          screenLabel: record.screenLabel,
          cardKey: record.cardKey,
          fieldKey: record.fieldKey,
          itemKey: record.itemKey,
          itemLabel: record.itemLabel,
        })),
      },
      semanticVerdict: 'pending', integrityVerdict: 'pending', unsupportedAdditionCount: null,
      reviewed: false,
      grader: { type: 'human', id: 'pending-independent-semantic-review', version: '1.0.0' },
      reviewInstructions: 'Review only the ultrasonic method portion of the two-column source table.',
    };
  });

  addUnit({
    sourceUnitId: 'source-unit-test-mfl-method', semanticKey: 'test_information.magnetic_flux_floor_scan',
    unitType: 'test_method', criticality: 'required', appCapability: 'external_attachment',
    evaluationMode: 'external-input-gap', sourceObligationIds: ['src-p014-b0426'],
    protectedFacts: { method: 'Magnetic Flux Floor Scan' },
    gapReason: 'MFL is not captured by the current Android app and must arrive as an external PDF/input in the report platform.',
  });

  const represented = new Set(semanticUnits.flatMap((unit) => unit.sourceObligationIds));
  const requiredSourceIds = inventory.obligations.filter((item) => item.requiredForMock).map((item) => item.obligationId);
  const unmappedSourceObligationIds = requiredSourceIds.filter((sourceId) => !represented.has(sourceId));
  const variants = variantIds.map((variantId) => ({ variantId, rows: rowsByVariant.get(variantId) }));
  return {
    contractVersion: 'source_mock_semantic_matrix_v1',
    caseId: inventory.caseId,
    caseRevision: inventory.caseRevision,
    status: 'review_draft',
    denominatorPolicy: 'One source meaning is one semantic unit. Voice style is a variant condition, not a different candidate.',
    reviewPolicy: {
      deterministicRows: 'Verifies prepared gold values survive Android export; does not replace independent source review.',
      semanticRows: 'Requires independent meaning and unsupported-addition review.',
      visualRows: 'Requires source-figure comparison.',
    },
    semanticUnits,
    variants,
    unmappedSourceObligationIds,
    summary: {
      semanticUnitCount: semanticUnits.length,
      deterministicUnitCount: semanticUnits.filter((unit) => unit.evaluationMode === 'exact').length,
      semanticReviewUnitCount: semanticUnits.filter((unit) => unit.evaluationMode === 'semantic').length,
      visualReviewUnitCount: semanticUnits.filter((unit) => unit.evaluationMode === 'visual').length,
      nonAppUnitCount: semanticUnits.filter((unit) => unit.appCapability !== 'capturable').length,
      variantCount: variants.length,
      pairCount: variants.reduce((sum, variant) => sum + variant.rows.length, 0),
      unmappedRequiredSourceObligationCount: unmappedSourceObligationIds.length,
    },
  };
}

const args = parseArgs(process.argv.slice(2));
const matrix = await build(args.caseRoot);
await saveJson(args.output, matrix);
console.log(JSON.stringify({ output: args.output, ...matrix.summary }, null, 2));
