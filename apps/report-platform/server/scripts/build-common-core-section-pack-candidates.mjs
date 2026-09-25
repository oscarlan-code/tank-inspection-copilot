#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const COMMON_CORE_SECTION_DEFINITIONS = Object.freeze([
  { order: 1, sectionId: 'scope-of-inspection', title: 'SCOPE OF INSPECTION', match: /^SCOPE OF INSPECTION\b/ },
  { order: 2, sectionId: 'inspection-maintenance-regime', title: 'INSPECTION AND MAINTENANCE REGIME', match: /^INSPECTION AND MAINTENANCE REGIME\b/ },
  { order: 3, sectionId: 'general-tank-information', title: 'GENERAL TANK INFORMATION', match: /^GENERAL TANK INFORMATION\b/ },
  { order: 4, sectionId: 'inspection-report', title: 'INSPECTION REPORT', match: /^INSPECTION REPORT$/ },
  { order: 5, sectionId: 'repair-recommendations', title: 'REPAIR RECOMMENDATIONS / API 653 ASSESSMENT', match: /^REPAIR RECOMMENDATIONS(?:\s*\/\s*API 653 ASSESSMENT)?\b/ },
  { order: 6, sectionId: 'test-information', title: 'TEST INFORMATION', match: /^TEST INFORMATION$/ },
  { order: 7, sectionId: 'tank-inspection-checklist', title: 'TANK INSPECTION CHECKLIST', match: /^TANK INSPECTION CHECKLIST\b/ },
]);
const ALLOWED_REPORT_FAMILIES = new Set(['internal_external_api653', 'internal_inspection', 'external_inspection']);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const encode = value => `${JSON.stringify(value, null, 2)}\n`;
const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim().toUpperCase();

export async function buildCommonCorePackCandidates({ sourceRoot, outputRoot }) {
  const candidates = [];
  for (const directory of await readdir(sourceRoot)) {
    const manifestPath = join(sourceRoot, directory, 'manifest.json');
    const parsedPath = join(sourceRoot, directory, 'parsed-document.json');
    let manifest, parsed;
    try {
      manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      parsed = JSON.parse(await readFile(parsedPath, 'utf8'));
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    const identity = manifest.identity ?? {};
    if (!ALLOWED_REPORT_FAMILIES.has(identity.report_family) || identity.dataset_split !== 'training') continue;
    const headings = (parsed.blocks ?? []).filter(block => block.block_type === 'heading' && block.heading_level === 1)
      .map(block => {
        const match = normalize(block.text).match(/^(\d{1,2})\s+(.+)$/);
        return match ? { block, number: Number(match[1]), text: match[2] } : null;
      }).filter(Boolean);
    const isHorizontal = /HORIZONTAL/i.test(identity.source_path ?? '')
      || headings.some(({ text }) => /HORIZONTAL TANK|END CAP/.test(text));
    if (isHorizontal) continue;
    candidates.push({ identity, headings });
  }

  const unique = [...new Map(candidates.map(candidate => [candidate.identity.source_sha256, candidate])).values()];
  const index = {
    contractVersion: 'section_pattern_pack_candidate_inventory_v1',
    status: 'candidate_inventory_only_not_release_eligible',
    profileId: 'vertical_tank_inspection_v1',
    sourcePolicy: {
      datasetSplit: 'training',
      reportFamilies: [...ALLOWED_REPORT_FAMILIES].sort(),
      horizontalReportsExcluded: true,
      exactHashDuplicatesCollapsed: true,
      reportTextIncluded: false,
      requiresGovernedApprovalBeforeFreeze: true,
      validationAndHiddenGoldExcluded: true,
    },
    eligibleTrainingDocuments: unique.length,
    packs: [],
  };

  for (const definition of COMMON_CORE_SECTION_DEFINITIONS) {
    const members = [];
    for (const candidate of unique) {
      const found = candidate.headings.find(({ text }) => definition.match.test(text));
      if (!found) continue;
      members.push({
        documentId: candidate.identity.document_id,
        caseId: candidate.identity.case_id,
        sourceSha256: candidate.identity.source_sha256,
        reportFamily: candidate.identity.report_family,
        datasetSplit: candidate.identity.dataset_split,
        headingBlockId: found.block.block_id,
        heading: found.text,
        sourcePage: found.block.source_spans?.[0]?.page_number ?? null,
        extractionConfidence: found.block.extraction_confidence ?? null,
      });
    }
    members.sort((left, right) => left.documentId.localeCompare(right.documentId));
    const memberBytes = encode(members);
    const pack = {
      contractVersion: 'section_pattern_pack_candidate_v1',
      status: 'candidate_inventory_only_not_release_eligible',
      profileId: 'vertical_tank_inspection_v1',
      sectionId: definition.sectionId,
      canonicalTitle: definition.title,
      sourceSectionKey: definition.sectionId,
      sourceCount: members.length,
      memberSetSha256: sha256(memberBytes),
      contentIncluded: false,
      runtimeRetrievalEnabled: false,
      members,
      requiredBeforeRelease: [
        'governed_source_approval_recheck',
        'vertical_orientation_taxonomy_review',
        'target_and_same_lineage_exclusion',
        'near_duplicate_exclusion',
        'section_pattern_review',
        'pack_content_hash_and_reviewer_approval',
      ],
    };
    const folder = `${String(definition.order).padStart(2, '0')}-${definition.sectionId}`;
    await mkdir(join(outputRoot, folder), { recursive: true });
    await writeFile(join(outputRoot, folder, 'pack-candidate.json'), encode(pack), { mode: 0o600 });
    index.packs.push({ order: definition.order, sectionId: definition.sectionId, sourceCount: members.length,
      memberSetSha256: pack.memberSetSha256, path: `${folder}/pack-candidate.json` });
  }
  await mkdir(outputRoot, { recursive: true });
  await writeFile(join(outputRoot, 'index.json'), encode(index), { mode: 0o600 });
  return index;
}

export function parseCommonCorePackCliArguments(args) {
  const argumentValue = name => {
    const index = args.indexOf(name);
    if (index < 0) return null;
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
    return value;
  };
  const outputArg = argumentValue('--output');
  const sourceArg = argumentValue('--source');
  if (!outputArg) throw new Error('--output DIRECTORY is required');
  return { outputArg, sourceArg };
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isCli) {
  const args = process.argv.slice(2);
  const { outputArg, sourceArg } = parseCommonCorePackCliArguments(args);
  const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const sourceRoot = resolve(sourceArg || join(appRoot, '.local/canonical-kb-ingestion'));
  const outputRoot = resolve(outputArg);
  const index = await buildCommonCorePackCandidates({ sourceRoot, outputRoot });
  console.log(JSON.stringify({ outputRoot, eligibleTrainingDocuments: index.eligibleTrainingDocuments,
    packs: index.packs.map(({ order, sectionId, sourceCount }) => ({ order, sectionId, sourceCount })),
    reportTextIncluded: false, releaseEligible: false }, null, 2));
}
