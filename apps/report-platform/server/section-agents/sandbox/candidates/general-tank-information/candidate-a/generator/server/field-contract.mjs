export const SECTION_ID = 'general-tank-information';
export const REPORT_PROFILE_ID = 'vertical_tank_inspection_v1';
export const SECTION_TITLE = '3 GENERAL TANK INFORMATION';

const field = (key, label, blockId, options = {}) => Object.freeze({
  key, label, blockId, required: false, aliases: [], group: 'main', dimension: null, ...options,
});

export const BODY_FIELDS = Object.freeze([
  field('client', 'Client', 'identity', { required: true }),
  field('clientRepresentative', 'Client Representative', 'identity'),
  field('tankNumber', 'Tank Number', 'identity', { required: true }),
  field('location', 'Location', 'identity', { required: true }),
  field('fieldLeaseName', 'Field/Lease Name', 'identity'),
  field('yearBuilt', 'Year Built', 'configuration'),
  field('originalManufacturer', 'Original Manufacturer', 'configuration', { aliases: ['manufacturer'] }),
  field('height', 'Height', 'configuration', { required: true, aliases: ['heightM'], dimension: 'length' }),
  field('originalConstructionStd', 'Original Construction Std', 'design-data', { aliases: ['originalConstructionStandard', 'constructionStandard'] }),
  field('serviceHeight', 'Service Height', 'configuration', { aliases: ['serviceHeightM'], dimension: 'length' }),
  field('materialSpec', 'Material Spec.', 'design-data', { aliases: ['materialSpecification'] }),
  field('diameter', 'Diameter', 'configuration', { required: true, aliases: ['diameterM'], dimension: 'length' }),
  field('shellConstruction', 'Construction (Shell)', 'design-data'),
  field('productStored', 'Product Stored', 'design-data'),
  field('drawingRef', 'Drawing Ref', 'design-data', { aliases: ['drawingReference'] }),
  field('specificGravity', 'Specific Gravity', 'design-data'),
  field('roofType', 'Roof Type', 'configuration'),
  field('designTemp', 'Design Temp.', 'design-data', { aliases: ['designTemperature'], dimension: 'temperature' }),
  field('internalPressure', 'Internal Pres.', 'design-data'),
  field('courseNumber', 'Total Shell Course', 'configuration', { required: true, aliases: ['shellCourseCount'], dimension: 'integer' }),
  field('floorPlateNumber', 'Total Floor Plates', 'configuration', { aliases: ['floorPlateCount'], dimension: 'integer' }),
  field('roofPlateNumber', 'Total Roof Plates', 'configuration', { aliases: ['roofPlateCount'], dimension: 'integer' }),
  field('floorPlateThickness', 'Floor Plate Thickness', 'configuration', { dimension: 'thickness' }),
  field('windGirder', 'Wind Girder', 'configuration'),
  field('annularPlateNumber', 'Total Annular Plates', 'configuration', { aliases: ['annularPlateCount'], dimension: 'integer' }),
  field('insulated', 'Insulated', 'configuration'),
  field('annularPlateThickness', 'Annular Plate Thickness', 'configuration', { dimension: 'thickness' }),
  field('stiffener', 'Stiffener', 'configuration'),
  field('previousExternal', 'External', 'inspection-history', { aliases: ['externalHistory'], group: 'history' }),
  field('previousInternal', 'Internal', 'inspection-history', { aliases: ['internalHistory'], group: 'history' }),
  field('previousBottom', 'Bottom', 'inspection-history', { aliases: ['bottomHistory'], group: 'history' }),
]);

export const HEADER_FIELDS = Object.freeze([
  field('jobNo', 'Job No.', 'identity', { disposition: 'report_header' }),
  field('dateCompleted', 'Date Completed', 'identity', { disposition: 'report_header' }),
  field('inspector', 'Inspector', 'inspector-certification', { disposition: 'report_header' }),
]);

export const SUPPORT_FIELDS = Object.freeze([
  field('externalRoofType', 'External Roof Present', 'configuration', { disposition: 'applicability_only' }),
  field('internalRoofType', 'Internal Roof Present', 'configuration', { disposition: 'applicability_only' }),
  field('insulationDistance', 'Insulation Distance', 'configuration', { disposition: 'support_only' }),
]);

export const ALL_FIELDS = Object.freeze([...BODY_FIELDS, ...HEADER_FIELDS, ...SUPPORT_FIELDS]);

const definitionBySourceKey = new Map();
for (const definition of ALL_FIELDS) {
  for (const key of [definition.key, ...definition.aliases]) {
    if (definitionBySourceKey.has(key)) throw new Error(`Duplicate field alias ${key}.`);
    definitionBySourceKey.set(key, definition);
  }
}

export function fieldDefinitionForSourceKey(sourceKey) {
  return definitionBySourceKey.get(sourceKey) ?? null;
}

export function expectedBlockIds(definition) {
  if (definition.key === 'jobNo' || definition.key === 'dateCompleted') return new Set(['identity', 'inspection-details']);
  return new Set([definition.blockId]);
}

export const FIELD_COUNTS = Object.freeze({
  body: BODY_FIELDS.length,
  header: HEADER_FIELDS.length,
  support: SUPPORT_FIELDS.length,
  total: ALL_FIELDS.length,
});

