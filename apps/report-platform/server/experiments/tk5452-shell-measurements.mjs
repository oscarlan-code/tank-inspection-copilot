// Evaluation preparation only: numeric field transcription, never report prose.
// Verified visually against TK5452, job 19SE2-1, source PDF page 25.
export const SHELL_SOURCE_SHA256 = '871d8770a5667bdbc3f0623a3a2e3ace54abcaf07acbd27017610ec24407de92';
export const SHELL_DIRECTIONS = ['North', 'East', 'South', 'West'];
export const SHELL_READING_KEYS = ['value1', 'value2', 'value3', 'value4', 'value5'];
// Point order: bottom 1, 2, 3, 4, 5. Column order: N, E, S, W.
export const SHELL_SOURCE_READINGS = [
  [[6.27,6.00,6.31,6.20],[6.30,6.09,6.29,6.25],[6.22,6.12,6.35,6.13],[6.25,6.15,6.20,6.20],[6.35,6.03,6.21,6.26]],
  [[6.27,6.24,6.22,6.23],[6.18,6.30,6.31,6.18],[6.29,6.19,6.33,6.16],[6.38,6.25,6.28,6.30],[6.34,6.20,6.30,6.32]],
];
export function prepareShellMeasurements(inspectionId) {
  return SHELL_SOURCE_READINGS.flatMap((points, index) => SHELL_DIRECTIONS.map((direction, column) => ({
    inspectionId, targetKey: 'shell', itemKey: `shell:course:${index + 1}:lane:${column + 1}`,
    itemKind: 'LAYOUT_REGION', itemLabel: `Shell strake ${index + 1} · ${direction}`,
    course: index + 1, laneId: direction, confirmed: true, measured: true, unitCode: 'mm',
    ...Object.fromEntries(SHELL_READING_KEYS.map((key, point) => [key, points[point][column]])),
    updatedAtIso: '2019-06-20T00:00:00.000Z',
  })));
}

// Completeness is independent of what the generator happened to receive.
// Count AND check every location/point; duplicating a row cannot satisfy this.
export function checkShellMeasurementCoverage(appExport) {
  const rows = (appExport.utMeasurements ?? []).filter(row => row.targetKey === 'shell' && row.itemKind !== 'element');
  const issues = [];
  for (const course of [1, 2]) for (const direction of SHELL_DIRECTIONS) {
    const matches = rows.filter(row => row.course === course && row.laneId === direction);
    if (matches.length !== 1) { issues.push(`Strake ${course}, ${direction}: expected one capture row, found ${matches.length}.`); continue; }
    const row = matches[0];
    if (row.unitCode !== 'mm' || row.measured !== true || row.confirmed !== true) issues.push(`${row.itemLabel}: verify unit and capture status.`);
    for (const key of SHELL_READING_KEYS) if (typeof row[key] !== 'number' || !Number.isFinite(row[key]) || row[key] <= 0) issues.push(`${row.itemLabel}, ${key}: missing or invalid reading.`);
  }
  if (rows.length !== 8) issues.push(`Expected eight shell location rows; found ${rows.length}.`);
  return { complete: issues.length === 0, expectedReadings: 40, capturedReadings: rows.reduce((n, row) => n + SHELL_READING_KEYS.filter(key => typeof row[key] === 'number' && row[key] > 0).length, 0), issues };
}
