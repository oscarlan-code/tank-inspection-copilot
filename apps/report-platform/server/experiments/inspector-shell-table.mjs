// Eval-only deterministic display projection. Reads captured measurements only.
// Native rows stay immutable: one course/direction with five ordered readings.
const directions = ['North', 'East', 'South', 'West'];
const keys = ['value1', 'value2', 'value3', 'value4', 'value5'];
export function projectShellTable(records) {
  const result = [];
  for (const course of [...new Set(records.map(record => record.payload.course))].sort()) {
    const columns = directions.map(direction => records.filter(record => record.payload.course === course && record.payload.laneId === direction));
    if (columns.some(matches => matches.length !== 1)) throw new Error(`Shell course ${course} requires one row for each compass direction.`);
    const sources = columns.map(matches => matches[0]);
    const cell = (source, key) => {
      const found = source.payload.cells.find(entry => entry.key === key);
      if (!found || !Number.isFinite(found.value) || found.value <= 0 || found.unitCode !== 'mm') throw new Error('Shell table requires verified millimetre readings.');
      return found;
    };
    const create = (label, values, inputCells, derived = false) => ({
      evidenceId: `shell_table_${course}_${label.replace(/\W+/g, '_')}`,
      kind: 'measurement', sourceClass: derived ? 'derived_calculation' : 'app_field',
      sourceRef: sources[0].sourceRef, sourceRecord: null,
      entityId: `${sources[0].entityId}:table:${label}`, locationRef: { course }, captureContext: {},
      payload: { itemLabel: `Strake ${course} · ${label}`, unitCode: 'mm',
        inputEvidenceIds: sources.map(source => source.evidenceId), inputCells,
        ...(derived ? { calculation: label, roundingDecimalPlaces: 2 } : {}),
        cells: values.map((value, index) => ({ key: directions[index].toLowerCase(), value, unitCode: 'mm',
          ...(derived ? { sourcePointers: inputCells.filter(entry => entry.direction === directions[index]).map(entry => entry.sourcePointer) } : { sourcePointer: inputCells[index].sourcePointer }) })) },
      displayText: `Strake ${course} · ${label}: ${values.map((value, i) => `${directions[i]} ${value.toFixed(2)} mm`).join('; ')}`,
      quality: { status: 'captured', issues: [] },
    });
    for (const [point, key] of keys.entries()) {
      const cells = sources.map((source, index) => ({ ...cell(source, key), direction: directions[index] }));
      result.push({ course, record: create(point === 0 ? 'Bottom 1' : String(point + 1), cells.map(c => c.value), cells) });
    }
    const inputCells = sources.flatMap((source, index) => keys.map(key => ({ ...cell(source, key), direction: directions[index] })));
    for (const label of ['Min', 'Mean', 'Max']) {
      const values = sources.map(source => {
        const hundredths = keys.map(key => Math.round(cell(source, key).value * 100));
        return (label === 'Min' ? Math.min(...hundredths) : label === 'Max' ? Math.max(...hundredths) : Math.round(hundredths.reduce((a, b) => a + b, 0) / hundredths.length)) / 100;
      });
      result.push({ course, record: create(label, values, inputCells, true) });
    }
  }
  return result;
}
