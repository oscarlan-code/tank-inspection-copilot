import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { prepareGenericOutlineReviewArtifacts, renderGenericOutlineReviewArtifactsHtml } from './generic-outline-review-artifacts.mjs';

const base = new URL('../../docs/reviews/data/syn025-current-only-v3/', import.meta.url);
function fixture() {
  const exportPackage = JSON.parse(readFileSync(new URL('native/export.json', base)));
  const sourcePhotos = JSON.parse(readFileSync(new URL('source-photos.json', base)));
  const fileBytesByRelativePath = new Map(exportPackage.attachments.filter((item) => item.kind === 'finding_photo').map((item) => [item.relativePath, readFileSync(new URL(`native/files/${item.relativePath}`, base))]));
  return { exportPackage, sourcePhotos, fileBytesByRelativePath };
}

test('real native export produces two original photos and three deterministic maps without modifying source', () => {
  const input = fixture();
  const before = JSON.stringify(input.exportPackage);
  const result = prepareGenericOutlineReviewArtifacts(input);
  assert.deepEqual(result.checks.filter((item) => !item.passed), []);
  assert.equal(result.photos.length, 2);
  assert.equal(result.layouts.length, 3);
  assert.ok([...result.photos, ...result.layouts].every((item) => item.status === 'verified'));
  const floor = result.layouts.find((item) => item.targetKey === 'floor');
  const nativeFloor = input.exportPackage.layoutFigures.find((item) => item.targetKey === 'floor');
  assert.equal(floor.svg, nativeFloor.svg);
  assert.equal(floor.sha256, nativeFloor.sha256);
  assert.equal(Buffer.from(floor.dataUri.split(',')[1], 'base64').toString('utf8'), nativeFloor.svg);
  assert.equal(result.layouts.find((item) => item.targetKey === 'external_roof').geometry.plateCount, 20);
  assert.equal(result.layouts.find((item) => item.targetKey === 'shell').geometry.gridRows, 6);
  assert.equal(JSON.stringify(input.exportPackage), before);
  assert.ok(result.excludedLayoutTargets.some((item) => item.targetKey === 'internal_roof' && item.reason === 'native_scope_excludes_roof'));
  for (const photo of result.photos) {
    assert.ok(input.exportPackage.findings.some((item) => item.findingId === photo.findingId && item.linkedUtItemKey === photo.itemKey));
    assert.deepEqual(Buffer.from(photo.dataUri.split(',')[1], 'base64'), input.fileBytesByRelativePath.get(photo.relativePath));
  }
});

test('tampered or missing photo bytes and missing native finding links never get image fallbacks', () => {
  const input = fixture();
  const [firstPath, firstBytes] = input.fileBytesByRelativePath.entries().next().value;
  const changed = Buffer.from(firstBytes);
  changed[changed.length - 1] ^= 1;
  input.fileBytesByRelativePath.set(firstPath, changed);
  const second = input.exportPackage.attachments.filter((item) => item.kind === 'finding_photo')[1];
  second.findingId = 'unknown-finding';
  const result = prepareGenericOutlineReviewArtifacts(input);
  assert.ok(result.photos.every((item) => item.status === 'blocked' && !item.dataUri));
  assert.ok(result.checks.some((item) => item.id === 'photo_source_hash' && !item.passed));
  assert.ok(result.checks.some((item) => item.id === 'photo_finding_link' && !item.passed));
  input.fileBytesByRelativePath.clear();
  assert.ok(prepareGenericOutlineReviewArtifacts(input).photos.every((item) => item.status === 'blocked'));
});

test('missing native geometry and unknown finding anchors do not invoke geometry fallbacks', () => {
  const input = fixture();
  delete input.exportPackage.layoutConfigs.find((item) => item.targetKey === 'external_roof').customCircularLayout;
  input.exportPackage.findings.find((item) => item.targetKey === 'shell').linkedUtItemKey = 'shell:region:unknown';
  const result = prepareGenericOutlineReviewArtifacts(input);
  assert.equal(result.layouts.find((item) => item.targetKey === 'external_roof').status, 'blocked');
  assert.equal(result.layouts.find((item) => item.targetKey === 'shell').status, 'blocked');
  assert.equal(result.layouts.find((item) => item.targetKey === 'floor').status, 'verified');
  assert.ok(result.checks.some((item) => item.id === 'finding_marker_anchors_resolved' && !item.passed));
});

test('native floor hash mismatch and missing shell configuration remain visible gaps', () => {
  const input = fixture();
  input.exportPackage.layoutFigures.find((item) => item.targetKey === 'floor').sha256 = '0'.repeat(64);
  delete input.exportPackage.layoutConfigs.find((item) => item.targetKey === 'shell').shellPlateOffset;
  const result = prepareGenericOutlineReviewArtifacts(input);
  assert.equal(result.layouts.find((item) => item.targetKey === 'shell').status, 'blocked');
  assert.equal(result.layouts.find((item) => item.targetKey === 'floor').status, 'blocked');
});

test('HTML shows only requested module artifacts and escapes source metadata', () => {
  const input = fixture();
  input.sourcePhotos.photos[0].sourceReport = '<script>alert(1)</script>';
  input.exportPackage.findings[0].note = '<img src=x onerror=alert(1)>';
  const result = prepareGenericOutlineReviewArtifacts(input);
  const html = renderGenericOutlineReviewArtifactsHtml(result, { moduleId: 'photos' });
  assert.equal((html.match(/<figure /g) ?? []).length, 2);
  assert.equal((html.match(/<img /g) ?? []).length, 2);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('data-artifact-id="layout:'));
  const attachment = input.exportPackage.attachments.find((item) => item.kind === 'finding_photo');
  attachment.relativePath = '../P01.png';
  assert.equal(prepareGenericOutlineReviewArtifacts(input).photos[0].status, 'blocked');
});
