// Evaluation-only companion artifacts. No import, storage, network, or AI calls.
// The shared generator remains responsible for section text; this module exposes
// deterministic maps and original photographs for the offline evaluation viewer.
import { createHash } from 'node:crypto';
import { buildLayoutFigureSvg, getEffectiveLayoutMap } from '../layout-map-figure.mjs';

export const GENERIC_OUTLINE_ARTIFACT_CONTRACT_VERSION = 'generic_outline_review_artifacts_v1';
const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const DEFAULT_MODULES = ['findings', 'photos', 'layout'];
const SURFACES = [
  { targetKey: 'external_roof', surface: 'roof', title: 'External roof layout' },
  { targetKey: 'shell', surface: 'shell', title: 'Shell layout' },
  { targetKey: 'floor', surface: 'floor', title: 'Floor layout' },
];

/** fileBytesByRelativePath is a Map or plain object of attachment paths to Buffer/Uint8Array. */
export function prepareGenericOutlineReviewArtifacts({ exportPackage, fileBytesByRelativePath = {}, sourcePhotos = null, selectedModuleIds = DEFAULT_MODULES }) {
  if (exportPackage?.packageType !== 'v3_product_export' || exportPackage?.schemaVersion !== 3) {
    throw new Error('Evaluation artifacts require the actual native V3 export package.');
  }
  const sourceBefore = JSON.stringify(exportPackage);
  const checks = [];
  const warnings = [];
  const selected = new Set(selectedModuleIds);
  const photos = selected.has('photos') || selected.has('findings')
    ? (exportPackage.attachments ?? []).filter((item) => item.kind === 'finding_photo').map((attachment) => preparePhoto(attachment))
    : [];
  const excludedLayoutTargets = [];
  const layouts = selected.has('layout') ? SURFACES.flatMap((surface) => {
    if (surface.targetKey === 'external_roof' && exportPackage.inspectionRecord?.externalRoofType === 'no') {
      excludedLayoutTargets.push({ targetKey: surface.targetKey, reason: 'native_scope_excludes_roof' });
      return [];
    }
    return [prepareLayout(surface)];
  }) : [];
  if ((exportPackage.layoutConfigs ?? []).some((item) => item.targetKey === 'internal_roof')) {
    excludedLayoutTargets.push({ targetKey: 'internal_roof', reason: exportPackage.inspectionRecord?.internalRoofType === 'no' ? 'native_scope_excludes_roof' : 'shared_renderer_has_no_internal_roof_binding' });
    if (exportPackage.inspectionRecord?.internalRoofType !== 'no') {
      warnings.push({ code: 'internal_roof_renderer_gap', targetKey: 'internal_roof', message: 'Internal-roof geometry requires a separate binding; no replacement drawing was invented.' });
    }
  }
  check('source_package_unchanged', JSON.stringify(exportPackage) === sourceBefore, 'Companion preparation must not mutate the native export.');
  return {
    contractVersion: GENERIC_OUTLINE_ARTIFACT_CONTRACT_VERSION,
    evaluationOnly: true,
    presentationBoundary: 'Companion review artifacts; not output from the shared section text generator and not a final export.',
    photoSourceBoundary: sourcePhotos?.evaluationLimit ?? 'Photograph provenance is supplied by the caller; it does not establish the mock asset\'s actual history.',
    photos, layouts, excludedLayoutTargets, checks, warnings,
    byModule: {
      ...(selected.has('photos') ? { photos: photos.map((item) => item.artifactId) } : {}),
      ...(selected.has('findings') ? { findings: photos.map((item) => item.artifactId) } : {}),
      ...(selected.has('layout') ? { layout: layouts.map((item) => item.artifactId) } : {}),
    },
  };

  function check(id, passed, detail, artifactId = null) {
    checks.push({ id, passed: Boolean(passed), detail, ...(artifactId ? { artifactId } : {}) });
    return Boolean(passed);
  }

  function preparePhoto(attachment) {
    const artifactId = `photo:${attachment.attachmentId}`;
    const finding = (exportPackage.findings ?? []).find((item) => item.findingId === attachment.findingId);
    const relativePath = attachment.relativePath;
    const safePath = isSafeRelativePath(relativePath);
    const supplied = safePath ? fileBytesByRelativePath instanceof Map ? fileBytesByRelativePath.get(relativePath) : Object.hasOwn(fileBytesByRelativePath, relativePath) ? fileBytesByRelativePath[relativePath] : null : null;
    const bytes = supplied instanceof Uint8Array ? Buffer.from(supplied) : null;
    const source = (sourcePhotos?.photos ?? []).find((item) => item.file === relativePath?.split('/').at(-1));
    const digest = bytes ? sha256(bytes) : null;
    const mediaType = bytes ? imageMediaType(bytes) : null;
    const valid = [
      check('photo_path_is_relative', safePath, 'Only supplied bytes at the native attachment path can be used.', artifactId),
      check('photo_finding_link', Boolean(finding), `Native finding: ${attachment.findingId}`, artifactId),
      check('photo_real_source_provenance', source?.sourceClass === 'report_derived_photograph', 'A source-report photograph is required; no generated image fallback.', artifactId),
      check('photo_source_hash', Boolean(bytes && source?.imageSha256 && digest === source.imageSha256), 'Photograph bytes must match their recorded original-image hash.', artifactId),
      check('photo_native_size', Boolean(bytes && bytes.length > 0 && bytes.length <= MAX_PHOTO_BYTES && bytes.length === attachment.fileByteSize), 'Supplied bytes must match the native attachment size.', artifactId),
      check('photo_media_type', Boolean(mediaType && mediaType === attachment.mediaType), 'Only PNG/JPEG bytes matching the native media type are displayed.', artifactId),
    ].every(Boolean);
    if (!valid) warnings.push({ code: 'photo_artifact_blocked', artifactId, message: 'Photo omitted from preview because its bytes, provenance or native finding link did not verify.' });
    return {
      artifactId, kind: 'photo', status: valid ? 'verified' : 'blocked',
      attachmentId: attachment.attachmentId, relativePath, findingId: attachment.findingId,
      itemKey: finding?.linkedUtItemKey ?? null, itemLabel: finding?.itemLabel ?? null,
      targetKey: finding?.targetKey ?? null, caption: finding?.note ?? attachment.displayName,
      source: source ? structuredClone(source) : null,
      sha256: digest, byteLength: bytes?.length ?? 0, mediaType,
      ...(valid ? { dataUri: `data:${mediaType};base64,${bytes.toString('base64')}` } : {}),
    };
  }

  function prepareLayout({ targetKey, surface, title }) {
    const artifactId = `layout:${targetKey}`;
    const config = (exportPackage.layoutConfigs ?? []).find((item) => item.targetKey === targetKey);
    const localChecks = [];
    const layoutCheck = (id, passed, detail) => { localChecks.push(check(id, passed, detail, artifactId)); };
    layoutCheck('native_layout_config', Boolean(config), `Native configuration for ${targetKey}.`);
    if (!config) return blockedLayout('Native layout configuration is absent.');
    // Avoid all shared renderer defaults: only confirmed geometry is eligible.
    if (surface === 'shell') {
      layoutCheck('shell_configuration_complete', ['shellCourseCount', 'shellPlatesPerCourse', 'shellLaneCount'].every((key) => Number.isInteger(config[key]) && config[key] > 0)
        && ['none', 'half_plate', 'third_plate'].includes(config.shellPlateOffset)
        && ['odd', 'even'].includes(config.shellOffsetStartRow)
        && ['full', 'one_third', 'two_thirds'].includes(config.shellThirdOffsetStart), 'Course, plate, lane and offset metadata must be explicit.');
    } else {
      const resolved = config.customCircularLayout;
      layoutCheck('resolved_circular_geometry_present', [1, 2].includes(resolved?.resolvedGeometryVersion) && resolved?.resolvedMainPlateGeometry?.length > 0, 'No inferred circular plate layout is used.');
      layoutCheck('circular_configuration_complete', surface === 'roof'
        ? Number.isInteger(config.roofRowCount) && config.roofRowCount > 0 && Number.isInteger(config.roofWidestRowPlateCount) && config.roofWidestRowPlateCount > 0
        : Number.isInteger(config.floorPatternCountX) && config.floorPatternCountX > 0 && Number.isInteger(config.floorPatternCountY) && config.floorPatternCountY > 0, 'Row and widest-row values are supplied by the app.');
    }
    if (localChecks.includes(false)) return blockedLayout('The shared renderer lacks complete native geometry for this target.');
    const section = { id: `eval-${artifactId}`, title, number: 'layout', layoutSurface: surface };
    let map;
    let compiled;
    try {
      map = getEffectiveLayoutMap({ exportPackage }, section);
      compiled = buildLayoutFigureSvg({ exportPackage }, section);
    } catch (error) {
      return blockedLayout(`Shared layout renderer failed: ${error.message}`);
    }
    if (!map || !compiled?.svg) return blockedLayout('The shared layout renderer returned no figure.');
    if (surface === 'shell') {
      const actual = map.appMap?.shell;
      layoutCheck('shell_native_configuration_preserved', actual?.courseCount === config.shellCourseCount && actual?.platesPerCourse === config.shellPlatesPerCourse && actual?.laneCount === config.shellLaneCount && actual?.plateOffset === config.shellPlateOffset && actual?.offsetStartRow === config.shellOffsetStartRow && actual?.thirdOffsetStart === config.shellThirdOffsetStart, 'The shared compiler uses the exported shell grid and seam-offset settings.');
    } else {
      const geometry = config.customCircularLayout.resolvedMainPlateGeometry;
      const compiledPlates = map.plates.filter((item) => item.plateKind === 'main');
      layoutCheck('resolved_geometry_preserved', compiledPlates.length === geometry.length && geometry.every((native) => {
        const plate = compiledPlates.find((item) => item.id === native.plateId);
        return plate && close(plate.x, native.leftNorm) && close(plate.y, native.topNorm) && close(plate.width, native.rightNorm - native.leftNorm) && close(plate.height, native.bottomNorm - native.topNorm) && plate.mapLabel === native.mapLabel && close(plate.labelX, native.labelXNorm) && close(plate.labelY, native.labelYNorm);
      }), 'Plate IDs, bounds, labels and label coordinates match the native resolved geometry.');
    }
    const nativeElements = (exportPackage.elements ?? []).filter((item) => item.targetKey === targetKey);
    layoutCheck('element_markers_preserved', map.markers.filter((item) => item.type === 'element').length === nativeElements.length && nativeElements.every((element) => {
      const marker = map.markers.find((item) => item.type === 'element' && item.id === element.elementId);
      return marker?.label === element.elementLabel && close(marker.x, element.normalizedX) && close(marker.y, element.normalizedY);
    }), 'Element IDs, labels and coordinates match the native export.');
    const nativeFindings = (exportPackage.findings ?? []).filter((item) => item.targetKey === targetKey);
    const findingLinks = nativeFindings.map((finding) => ({ findingId: finding.findingId, itemKey: finding.linkedUtItemKey, itemLabel: finding.itemLabel, note: finding.note }));
    layoutCheck('finding_marker_anchors_resolved', nativeFindings.every((finding) => findingAnchorMatches(finding, map, config, nativeElements)), 'Every finding must resolve to its exact native element, circular plate, or shell lane/course; invented fallback positions are rejected.');
    let svg = compiled.svg;
    let provenance = 'shared_layout_compiler_from_native_export';
    let width = compiled.width;
    let height = compiled.height;
    if (surface === 'floor') {
      const figure = (exportPackage.layoutFigures ?? []).find((item) => item.targetKey === 'floor');
      const nativeSvg = typeof figure?.svg === 'string' ? figure.svg : '';
      const dataUri = `data:image/svg+xml;base64,${Buffer.from(nativeSvg).toString('base64')}`;
      layoutCheck('native_floor_hash', Boolean(nativeSvg && sha256(nativeSvg) === figure.sha256), 'Native floor SVG bytes must match the export hash.');
      layoutCheck('native_floor_accepted_by_shared_renderer', Boolean(nativeSvg && compiled.svg.includes(`href="${dataUri}"`)), 'Shared renderer must accept and embed the original native SVG; no private SVG sanitizer bypass.');
      svg = nativeSvg;
      width = figure?.width;
      height = figure?.height;
      provenance = 'native_floor_svg_byte_identical';
      warnings.push({ code: 'floor_finding_links_outside_native_svg', artifactId, message: 'The original native floor SVG is preserved unchanged. Findings are linked in the caption; no finding marker was added to those bytes.' });
    }
    if (localChecks.includes(false)) return blockedLayout('Native geometry or evidence anchors do not match the shared renderer.');
    if (surface !== 'floor') warnings.push({ code: 'native_screenshot_parity_not_tested', artifactId, message: 'The shared compiler preserves the checked native geometry and anchors; visual parity against an Android screenshot was not tested.' });
    return {
      artifactId, kind: 'layout', status: 'verified', targetKey, surface, title,
      provenance, width, height, svg, dataUri: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
      sha256: sha256(svg), sharedCompilerSha256: sha256(compiled.svg), sharedCompiler: 'server/layout-map-figure.mjs',
      geometry: { plateCount: map.plates.length, gridRows: map.gridRows, gridColumns: map.gridColumns, elementCount: nativeElements.length, findingCount: nativeFindings.length, sourceConfigSha256: sha256(JSON.stringify(config)) },
      findingLinks,
    };

    function blockedLayout(message) {
      warnings.push({ code: 'layout_renderer_gap', artifactId, targetKey, message });
      return { artifactId, kind: 'layout', status: 'blocked', targetKey, surface, title, message };
    }
  }
}

/** The result contains already verified image data URIs; metadata remains escaped. */
export function renderGenericOutlineReviewArtifactsHtml(artifacts, { moduleId } = {}) {
  const selectedIds = moduleId ? new Set(artifacts.byModule[moduleId] ?? []) : null;
  const candidates = [...artifacts.photos, ...artifacts.layouts].filter((item) => !selectedIds || selectedIds.has(item.artifactId));
  return `<div class="eval-companion-artifacts">${candidates.map((item) => {
    if (item.status !== 'verified') return `<p class="artifact-gap">${escapeHtml(item.title ?? item.caption ?? item.artifactId)}: artifact pending verification.</p>`;
    const caption = item.kind === 'photo'
      ? `<strong>${escapeHtml(item.caption)}</strong><br>Finding: ${escapeHtml(item.findingId)} · Item: ${escapeHtml(item.itemKey)}<br>Original report photo ${escapeHtml(item.source.sourcePhotoNumber)}, page ${escapeHtml(item.source.sourcePage)} · ${escapeHtml(item.source.sourceReport?.split('/').at(-1))}<br>Evaluation location alias: ${escapeHtml(item.source.syntheticLocationAlias)}; original report location correspondence is not established.`
      : `<strong>${escapeHtml(item.title)}</strong><br>${escapeHtml(item.provenance === 'native_floor_svg_byte_identical' ? 'Original native floor SVG, unchanged.' : 'Shared deterministic renderer using native exported geometry.')}${item.findingLinks.map((link) => `<br>Finding ${escapeHtml(link.findingId)} · Item ${escapeHtml(link.itemKey)}: ${escapeHtml(link.note)}`).join('')}`;
    return `<figure class="eval-artifact" data-artifact-id="${escapeHtml(item.artifactId)}"><img style="display:block;max-width:100%;height:auto" src="${escapeHtml(item.dataUri)}" alt="${escapeHtml(item.caption ?? item.title)}"><figcaption>${caption}</figcaption></figure>`;
  }).join('')}</div>`;
}

function findingAnchorMatches(finding, map, config, elements) {
  const key = finding.linkedUtItemKey ?? '';
  const elementId = /:element:([^:]+)$/.exec(key)?.[1];
  if (elementId) return elements.some((item) => item.elementId === elementId);
  const region = /:region:(.+)$/.exec(key)?.[1];
  const marker = map.markers.find((item) => item.type === 'finding' && item.id === finding.findingId);
  if (!marker || !region) return false;
  if (finding.targetKey === 'shell') {
    const match = /^L(\d+)-C(\d+)$/.exec(region);
    if (!match) return false;
    const [, lane, course] = match.map(Number);
    return lane >= 1 && lane <= config.shellLaneCount && course >= 1 && course <= config.shellCourseCount && close(marker.x, (lane - 0.5) / config.shellLaneCount) && close(marker.y, 1 - (course - 0.5) / config.shellCourseCount);
  }
  const plate = map.plates.find((item) => item.id === region);
  return Boolean(plate && close(marker.x, plate.labelX) && close(marker.y, plate.labelY));
}

function isSafeRelativePath(value) {
  return typeof value === 'string' && value.length > 0 && !value.includes('\\') && !value.startsWith('/') && !value.includes(':') && value.split('/').every((part) => part && part !== '.' && part !== '..');
}
function imageMediaType(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  return null;
}
function close(a, b) { return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-8; }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
