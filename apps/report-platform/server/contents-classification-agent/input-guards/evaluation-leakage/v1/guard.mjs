import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const POLICY = JSON.parse(await readFile(path.join(HERE, 'policy.json'), 'utf8'));
const OUTLINE_PATH = path.resolve(HERE, POLICY.outlineProfile.path);
const OUTLINE_BYTES = await readFile(OUTLINE_PATH);
const OUTLINE = JSON.parse(OUTLINE_BYTES);

export const GUARD_ID = 'evaluation-input-leakage-guard-v1';
export const SEALED_INPUT_CONTRACT = 'sealed_classification_input_v1';
export const RUNTIME_RECEIPT_CONTRACT = 'evaluation_input_leakage_receipt_v1';
export const CROSSWALK_CONTRACT = 'evaluation_lineage_crosswalk_v1';

const SHA256 = /^[a-f0-9]{64}$/;
const FORBIDDEN_KEYS = new Set(POLICY.forbiddenExportKeyNames.map((item) => item.toLowerCase()));
const NARRATIVE_KEYS = new Set(POLICY.narrativeFieldNames.map((item) => item.toLowerCase()));
const TOP_LEVEL = new Set(POLICY.nativeTopLevelAllowlist);
const clone = (value) => structuredClone(value);
const canonical = (value) => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
const sha256 = (value) => createHash('sha256').update(Buffer.isBuffer(value) ? value
  : typeof value === 'string' ? value : canonical(value)).digest('hex');
const issue = (code, pathValue, detail = null) => ({ code, path: pathValue, ...(detail ? { detail } : {}) });
const normalizeWords = (value) => String(value ?? '').toLowerCase()
  .normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);

function walk(value, visit, parts = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, [...parts, index]));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    visit(key, item, [...parts, key]);
    walk(item, visit, [...parts, key]);
  }
}

function jsonPointer(parts) {
  return `/${parts.map((item) => String(item).replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`;
}

function narrativeFields(exportPackage) {
  const fields = [];
  walk(exportPackage, (key, value, parts) => {
    if (NARRATIVE_KEYS.has(key.toLowerCase()) && typeof value === 'string' && value.trim()) {
      fields.push({ pointer: jsonPointer(parts), text: value });
    }
  });
  return fields;
}

function reportHint(text) {
  const value = String(text).replace(/\s+/g, ' ').trim();
  const directPatterns = [
    /\breport\s+section\b/i,
    /\b(?:gold|expected)\s+(?:section|block|label)\b/i,
    /\b(?:use|place|classify|route|belongs?)\b.{0,48}\b(?:report\s+)?section\b/i,
    /\b(?:original|source)\s+report\s+(?:page|section)\b/i,
    /\b(?:section|block)\s*(?:id|label)\s*[:=]/i,
  ];
  if (directPatterns.some((pattern) => pattern.test(value))) return 'explicit_report_routing_instruction';
  for (const section of OUTLINE.sections) {
    const title = section.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const id = section.sectionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(?:^|\\n)\\s*(?:section\\s*)?\\d*[.: -]*${title}\\s*(?::|—|-)`, 'i').test(text)) {
      return `report_heading:${section.sectionId}`;
    }
    if (new RegExp(`\\bsection\\s*\\d+[.: -]+${title}\\b`, 'i').test(value)) {
      return `numbered_report_heading:${section.sectionId}`;
    }
    if (new RegExp(`\\b(?:section|block|label)\\s*(?:id\\s*)?[:=]\\s*[\"']?${id}\\b`, 'i').test(value)
      || new RegExp(`\\b(?:route|classify|place)\\b.{0,48}\\b${id}\\b`, 'i').test(value)) {
      return `canonical_section_id:${section.sectionId}`;
    }
  }
  return null;
}

export function detectReportRoutingHint(text) {
  return reportHint(text);
}

function exactOverlap(text, referenceTextUnits, minimumWords) {
  const words = normalizeWords(text);
  if (words.length < minimumWords) return null;
  let best = null;
  for (const unit of referenceTextUnits) {
    const sourceWords = normalizeWords(unit.text);
    let previous = new Uint16Array(sourceWords.length + 1);
    for (let candidateIndex = 1; candidateIndex <= words.length; candidateIndex += 1) {
      const current = new Uint16Array(sourceWords.length + 1);
      for (let sourceIndex = 1; sourceIndex <= sourceWords.length; sourceIndex += 1) {
        if (words[candidateIndex - 1] !== sourceWords[sourceIndex - 1]) continue;
        current[sourceIndex] = previous[sourceIndex - 1] + 1;
        const wordCount = current[sourceIndex];
        if (wordCount >= minimumWords && (!best || wordCount > best.wordCount)) {
          const phrase = words.slice(candidateIndex - wordCount, candidateIndex).join(' ');
          best = { unitId: String(unit.unitId), wordCount, phraseSha256: sha256(phrase) };
        }
      }
      previous = current;
    }
  }
  return best;
}

function opaqueValue(prefix, value, secret, length = 24) {
  return `${prefix}_${createHmac('sha256', secret).update(String(value)).digest('hex').slice(0, length)}`;
}

function extension(value) {
  const match = String(value ?? '').match(/(\.[a-z0-9]{1,8})$/i);
  return match ? match[1].toLowerCase() : '';
}

function pseudonymizeTransportMetadata(exportPackage, lineageSecret) {
  const projected = clone(exportPackage);
  const mappings = [];
  const pathTokens = new Map();
  const voiceIds = new Map();
  const runtimePath = (source) => {
    if (!source) return source;
    if (!pathTokens.has(source)) pathTokens.set(source,
      `eval-media/${opaqueValue('media', source, lineageSecret)}${extension(source)}`);
    return pathTokens.get(source);
  };
  const record = (pointer, originalValue, runtimeValue) => {
    if (originalValue === runtimeValue) return;
    mappings.push({ pointer, originalValue, runtimeValue });
  };
  for (const [index, note] of (projected.voiceNotes ?? []).entries()) {
    const originalId = note.voiceNoteId;
    if (originalId) {
      const opaqueId = opaqueValue('voice', originalId, lineageSecret);
      voiceIds.set(originalId, opaqueId);
      record(`/voiceNotes/${index}/voiceNoteId`, originalId, opaqueId);
      note.voiceNoteId = opaqueId;
    }
    if (note.relativePath) {
      const value = runtimePath(note.relativePath);
      record(`/voiceNotes/${index}/relativePath`, note.relativePath, value);
      note.relativePath = value;
    }
    if (note.displayName) {
      const value = `Voice recording ${index + 1}${extension(note.displayName)}`;
      record(`/voiceNotes/${index}/displayName`, note.displayName, value);
      note.displayName = value;
    }
  }
  let photoNumber = 0;
  let voiceNumber = 0;
  for (const [index, attachment] of (projected.attachments ?? []).entries()) {
    const isVoice = attachment.kind === 'voice_audio';
    if (attachment.relativePath) {
      const value = runtimePath(attachment.relativePath);
      record(`/attachments/${index}/relativePath`, attachment.relativePath, value);
      attachment.relativePath = value;
    }
    if (isVoice && attachment.attachmentId) {
      const value = voiceIds.get(attachment.attachmentId)
        ?? opaqueValue('attachment', attachment.attachmentId, lineageSecret);
      record(`/attachments/${index}/attachmentId`, attachment.attachmentId, value);
      attachment.attachmentId = value;
      voiceNumber += 1;
    }
    const displayName = String(attachment.displayName ?? '');
    const sourceDerived = /^Report photo\b/i.test(displayName)
      || /^(?:obs|rec|scope|method|test)-/i.test(displayName)
      || (isVoice && displayName);
    if (sourceDerived) {
      if (!isVoice) photoNumber += 1;
      const value = isVoice
        ? `Voice recording ${voiceNumber || index + 1}${extension(displayName)}`
        : `Inspection photo ${photoNumber}${extension(displayName)}`;
      record(`/attachments/${index}/displayName`, attachment.displayName, value);
      attachment.displayName = value;
    }
  }
  return { projected, mappings };
}

function validateInputs(exportPackage, androidReceipt, rawExportSha256, rawExportByteSize) {
  const issues = [];
  if (!exportPackage || typeof exportPackage !== 'object' || Array.isArray(exportPackage)) {
    return [issue('invalid_export_object', '/')];
  }
  if (exportPackage.packageType !== 'v3_product_export') issues.push(issue('invalid_package_type', '/packageType'));
  if (Number(exportPackage.schemaVersion) !== 3) issues.push(issue('invalid_schema_version', '/schemaVersion'));
  if (!String(exportPackage.inspectionId ?? '').trim()) issues.push(issue('missing_inspection_id', '/inspectionId'));
  if (!String(exportPackage.inspectionReference ?? '').trim()) issues.push(issue('missing_inspection_reference', '/inspectionReference'));
  for (const key of Object.keys(exportPackage)) {
    if (!TOP_LEVEL.has(key)) issues.push(issue('unknown_top_level_export_field', `/${key}`));
  }
  walk(exportPackage, (key, _value, parts) => {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) issues.push(issue('forbidden_gold_or_report_metadata', jsonPointer(parts)));
  });
  if (!androidReceipt || typeof androidReceipt !== 'object' || Array.isArray(androidReceipt)) {
    issues.push(issue('missing_android_export_receipt', '/receipt'));
    return issues;
  }
  if (androidReceipt.packageType !== POLICY.sourceReceipt.requiredPackageType
      || Number(androidReceipt.schemaVersion) < POLICY.sourceReceipt.minimumSchemaVersion) {
    issues.push(issue('invalid_android_export_receipt', '/receipt'));
  }
  if (androidReceipt.producer !== POLICY.sourceReceipt.requiredProducer) issues.push(issue('untrusted_export_producer', '/receipt/producer'));
  if (androidReceipt.inspectionId !== exportPackage.inspectionId) issues.push(issue('receipt_inspection_id_mismatch', '/receipt/inspectionId'));
  if (androidReceipt.inspectionReference !== exportPackage.inspectionReference) issues.push(issue('receipt_inspection_reference_mismatch', '/receipt/inspectionReference'));
  if (!SHA256.test(String(androidReceipt.exportSha256 ?? ''))) issues.push(issue('invalid_receipt_export_hash', '/receipt/exportSha256'));
  else if (rawExportSha256 && androidReceipt.exportSha256 !== rawExportSha256) issues.push(issue('receipt_export_hash_mismatch', '/receipt/exportSha256'));
  if (Number.isInteger(rawExportByteSize) && Number(androidReceipt.exportByteSize) !== rawExportByteSize) issues.push(issue('receipt_export_size_mismatch', '/receipt/exportByteSize'));
  if (!String(androidReceipt.caseId ?? '').trim()) issues.push(issue('missing_evaluation_case_id', '/receipt/caseId'));
  if (!String(androidReceipt.variant ?? '').trim()) issues.push(issue('missing_mock_variant', '/receipt/variant'));
  if (!SHA256.test(String(androidReceipt.goldSha256 ?? ''))) issues.push(issue('missing_gold_binding', '/receipt/goldSha256'));
  return issues;
}

export function guardEvaluationInput({
  exportPackage,
  androidReceipt,
  lineageSecret,
  rawExportSha256 = null,
  rawExportByteSize = null,
  referenceTextUnits = [],
} = {}) {
  assert(typeof lineageSecret === 'string' && lineageSecret.length >= 32,
    'Evaluation lineage secret must contain at least 32 characters.');
  assert(Array.isArray(referenceTextUnits), 'referenceTextUnits must be an array.');
  for (const unit of referenceTextUnits) {
    assert(unit && typeof unit.unitId === 'string' && typeof unit.text === 'string',
      'Each reference text unit requires string unitId and text.');
  }
  const inputBefore = canonical(exportPackage);
  const actualRawHash = rawExportSha256 ?? sha256(inputBefore);
  const actualRawSize = rawExportByteSize ?? Buffer.byteLength(inputBefore);
  const issues = validateInputs(exportPackage, androidReceipt, actualRawHash, actualRawSize);
  const advisories = [];
  const narratives = narrativeFields(exportPackage);
  for (const field of narratives) {
    const hint = reportHint(field.text);
    if (hint) issues.push(issue('explicit_report_section_hint', field.pointer, hint));
    const overlap = exactOverlap(field.text, referenceTextUnits, POLICY.minimumExactSourceSequenceWords);
    if (overlap) {
      const detail = `reference=${overlap.unitId};words=${overlap.wordCount};phraseSha256=${overlap.phraseSha256}`;
      if (overlap.wordCount >= POLICY.blockingExactSourceSequenceWords) {
        issues.push(issue('verbatim_source_narrative_overlap', field.pointer, detail));
      } else {
        advisories.push(issue('source_narrative_overlap_review', field.pointer, detail));
      }
    }
  }
  assert.equal(canonical(exportPackage), inputBefore, 'Leakage guard mutated the Android export.');

  const sourceReceiptSha256 = sha256(androidReceipt);
  const sourcePackageHash = sha256(exportPackage);
  const { projected: runtimeExportPackage, mappings: metadataMappings } =
    pseudonymizeTransportMetadata(exportPackage, lineageSecret);
  const inputPackageHash = sha256(runtimeExportPackage);
  const lineageMaterial = canonical({
    caseId: androidReceipt?.caseId ?? null,
    caseRevision: androidReceipt?.caseRevision ?? null,
    variant: androidReceipt?.variant ?? null,
    goldSha256: androidReceipt?.goldSha256 ?? null,
    sourceExportSha256: actualRawHash,
    sourcePackageHash,
    inputPackageHash,
  });
  const lineageToken = `eval_ln_${createHmac('sha256', lineageSecret).update(lineageMaterial).digest('hex')}`;
  const decision = issues.length ? 'blocked' : 'passed';
  const sealedInput = decision === 'passed' ? {
    contractVersion: SEALED_INPUT_CONTRACT,
    guardId: GUARD_ID,
    lineageToken,
    inputPackageHash,
    sourceExportSha256: actualRawHash,
    sourceReceiptSha256,
    exportPackage: runtimeExportPackage,
  } : null;
  const runtimePackageHash = sealedInput ? sha256(sealedInput) : null;
  const runtimeReceipt = {
    contractVersion: RUNTIME_RECEIPT_CONTRACT,
    guardId: GUARD_ID,
    decision,
    lineageToken,
    runtimePackageHash,
    inputPackageHash,
    sourceExportSha256: actualRawHash,
    sourceReceiptSha256,
    producer: androidReceipt?.producer ?? null,
    exportPackageId: androidReceipt?.exportPackageId ?? null,
    inspectionId: exportPackage?.inspectionId ?? null,
    inspectionReference: exportPackage?.inspectionReference ?? null,
    exportedAtIso: androidReceipt?.exportedAtIso ?? exportPackage?.exportedAtIso ?? null,
    checks: {
      forbiddenMetadataCount: issues.filter((item) => item.code === 'forbidden_gold_or_report_metadata').length,
      sectionHintCount: issues.filter((item) => item.code === 'explicit_report_section_hint').length,
      verbatimLeakageCount: issues.filter((item) => item.code === 'verbatim_source_narrative_overlap').length,
      sourceOverlapAdvisoryCount: advisories.length,
      maximumSourceOverlapWords: Math.max(0, ...[...issues, ...advisories]
        .map((item) => /(?:^|;)words=(\d+)(?:;|$)/.exec(item.detail ?? '')?.[1])
        .filter(Boolean).map(Number)),
      unknownFieldCount: issues.filter((item) => item.code === 'unknown_top_level_export_field').length,
      totalBlockingIssues: issues.length,
      referenceScanPerformed: referenceTextUnits.length > 0,
      originalExportMutated: false,
      protectedNativeEvidenceMutated: false,
      metadataProjectionApplied: metadataMappings.length > 0,
      metadataPseudonymizedCount: metadataMappings.length,
    },
  };
  const evaluatorCrosswalk = {
    contractVersion: CROSSWALK_CONTRACT,
    guardId: GUARD_ID,
    visibility: 'evaluator_only',
    decision,
    lineageToken,
    runtimePackageHash,
    inputPackageHash,
    sourceExportSha256: actualRawHash,
    sourceReceiptSha256,
    sourcePackageHash,
    caseId: androidReceipt?.caseId ?? null,
    caseRevision: androidReceipt?.caseRevision ?? null,
    variant: androidReceipt?.variant ?? null,
    goldSha256: androidReceipt?.goldSha256 ?? null,
    goldApprovalManifestSha256: androidReceipt?.goldApprovalManifestSha256 ?? null,
    referenceTextUnits: referenceTextUnits.map((unit) => ({ unitId: unit.unitId, textSha256: sha256(unit.text) })),
    metadataPseudonymization: metadataMappings,
    advisories,
    blockingIssues: issues,
  };
  return { decision, sealedInput, runtimeReceipt, evaluatorCrosswalk };
}

function parseArgs(values) {
  const args = {};
  for (let index = 0; index < values.length; index += 1) {
    if (values[index].startsWith('--')) args[values[index].slice(2)] = values[index + 1];
  }
  return args;
}

async function cli() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.export || !args.receipt || !args.output || !args.crosswalk) {
    throw new Error('Usage: node guard.mjs --export export.json --receipt receipt.json --output runtime-dir --crosswalk evaluator-private.json [--reference-units units.json]');
  }
  const outputDirectory = path.resolve(args.output);
  const crosswalkPath = path.resolve(args.crosswalk);
  if (crosswalkPath === outputDirectory || crosswalkPath.startsWith(`${outputDirectory}${path.sep}`)) {
    throw new Error('Evaluator crosswalk must be outside the runtime output directory.');
  }
  const lineageSecret = process.env.REPORT_PLATFORM_EVALUATION_LINEAGE_SECRET;
  assert(typeof lineageSecret === 'string' && lineageSecret.length >= 32,
    'REPORT_PLATFORM_EVALUATION_LINEAGE_SECRET must contain at least 32 characters.');
  const exportBytes = await readFile(path.resolve(args.export));
  const exportPackage = JSON.parse(exportBytes);
  const androidReceipt = JSON.parse(await readFile(path.resolve(args.receipt), 'utf8'));
  const referenceTextUnits = args['reference-units']
    ? JSON.parse(await readFile(path.resolve(args['reference-units']), 'utf8')) : [];
  const result = guardEvaluationInput({
    exportPackage,
    androidReceipt,
    lineageSecret,
    rawExportSha256: sha256(exportBytes),
    rawExportByteSize: exportBytes.byteLength,
    referenceTextUnits,
  });
  await mkdir(outputDirectory, { recursive: true });
  await mkdir(path.dirname(crosswalkPath), { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDirectory, 'leakage-receipt.json'), `${JSON.stringify(result.runtimeReceipt, null, 2)}\n`),
    writeFile(crosswalkPath, `${JSON.stringify(result.evaluatorCrosswalk, null, 2)}\n`),
    result.sealedInput
      ? writeFile(path.join(outputDirectory, 'sealed-classification-input.json'), `${JSON.stringify(result.sealedInput, null, 2)}\n`)
      : Promise.resolve(),
  ]);
  process.stdout.write(`${JSON.stringify({
    decision: result.decision,
    outputDirectory,
    crosswalkPath,
    runtimePackageHash: result.runtimeReceipt.runtimePackageHash,
    checks: result.runtimeReceipt.checks,
  }, null, 2)}\n`);
  if (result.decision !== 'passed') process.exitCode = 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  cli().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}

export const __test = { canonical, sha256, narrativeFields, reportHint, exactOverlap, pseudonymizeTransportMetadata };
