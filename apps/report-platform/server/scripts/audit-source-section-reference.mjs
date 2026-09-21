import assert from "node:assert/strict";
import { parseNativeSectionReference } from "../source-section-reference.mjs";

const source = [
  '4 INSPECTION REPORT\nFOUNDATION\nBuggy needs 3” of width.',
  'Shell Plate Corrosion Rate\nSHELL INTERNAL\nNo significant pitting.',
  'FLOOR INTERNAL\nBottom plates measured 6.00 mm.\n5 REPAIR RECOMMENDATIONS\nRepair text excluded.',
].join('\f');
const reference = parseNativeSectionReference(source, "inspection-report");
assert.deepEqual(reference.pageNumbers, [1, 2, 3]);
assert.match(reference.content, /3”/);
assert.match(reference.content, /SHELL INTERNAL/);
assert.match(reference.content, /6\.00 mm/);
assert.doesNotMatch(reference.content, /Repair text excluded/);
assert.throws(() => parseNativeSectionReference(source.replace('5 REPAIR', '6 REPAIR'), 'inspection-report'), /closing boundary/);
assert.throws(() => parseNativeSectionReference(source + '\f' + source, 'inspection-report'), /found 2/);
console.log('Source section reference audit passed.');
