import { createHash } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { basename, extname, relative, sep } from "node:path";

export const KB_CORPUS_INVENTORY_SCHEMA_VERSION = 1;

const SUPPORTED_SOURCE_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".rtf",
  ".xls",
  ".xlsx",
  ".jpg",
  ".jpeg",
  ".png",
  ".tif",
  ".tiff",
  ".cdr",
  ".zip",
]);

export function buildKbCorpusInventory({
  sampleReportsDir,
  standardsCodesDir,
  now = () => new Date().toISOString(),
} = {}) {
  const roots = [
    { rootKind: "historical_reports", rootPath: sampleReportsDir },
    { rootKind: "standards", rootPath: standardsCodesDir },
  ].filter((source) => source.rootPath);
  const assets = roots.flatMap((source) =>
    listFilesRecursive(source.rootPath)
      .filter((sourcePath) => SUPPORTED_SOURCE_EXTENSIONS.has(normalizeExtension(sourcePath)))
      .map((sourcePath) => buildAssetRecord({ ...source, sourcePath })),
  );
  const duplicateCandidateGroups = groupAssets(assets, (asset) => asset.binaryDuplicateCandidateKey)
    .filter((group) => group.assets.length > 1)
    .map((group) => ({
      candidateKey: group.key,
      requiresSha256Verification: true,
      assets: group.assets.map(toAssetPointer),
    }));
  const caseAssetGroups = groupAssets(
    assets.filter((asset) => asset.caseKey),
    (asset) => asset.caseKey,
  )
    .filter((group) => group.assets.length > 1)
    .map((group) => ({
      caseKey: group.key,
      assets: group.assets.map(toAssetPointer),
    }));
  const logicalReportGroups = groupAssets(
    assets.filter((asset) => asset.logicalDocumentKey),
    (asset) => asset.logicalDocumentKey,
  )
    .filter((group) => group.assets.length > 1)
    .map((group) => ({
      logicalDocumentKey: group.key,
      assets: group.assets.map(toAssetPointer),
    }));

  return {
    schemaVersion: KB_CORPUS_INVENTORY_SCHEMA_VERSION,
    createdAtIso: now(),
    roots,
    summary: buildSummary(assets, duplicateCandidateGroups, logicalReportGroups, caseAssetGroups),
    duplicateCandidateGroups,
    logicalReportGroups,
    caseAssetGroups,
    assets,
  };
}

export function formatKbCorpusInventoryMarkdown(inventory) {
  const summary = inventory.summary;
  return [
    "# KB Corpus Inventory",
    "",
    `Generated: ${inventory.createdAtIso}`,
    "",
    "This is a read-only discovery manifest. No source is approved for generation by this inventory.",
    "",
    "## Summary",
    "",
    `- Assets inspected: ${summary.totalAssets}`,
    `- Corpus size: ${formatBytes(summary.totalBytes)}`,
    `- Final-report candidates awaiting review: ${summary.finalReportCandidateCount}`,
    `- Standards awaiting review: ${summary.standardsCandidateCount}`,
    `- Specialist/supporting evidence assets: ${summary.supportingEvidenceCount}`,
    `- Administrative assets excluded by default: ${summary.administrativeExcludedCount}`,
    `- Unknown/quarantined assets: ${summary.quarantinedCount}`,
    `- Possible binary duplicate groups: ${summary.duplicateCandidateGroupCount}`,
    `- Multi-rendition/logical report groups: ${summary.logicalReportGroupCount}`,
    `- Report-reference case bundles: ${summary.caseAssetGroupCount}`,
    "",
    renderCountTable("Report Families", summary.byReportFamily),
    "",
    renderCountTable("Ingestion Disposition", summary.byDisposition),
    "",
    renderCountTable("Source Roles", summary.bySourceRole),
    "",
    "## Safety",
    "",
    "- Every candidate remains `pending_review`.",
    "- Duplicate candidates require SHA-256 verification before import.",
    "- Dataset split and gold-holdout roles are never inferred automatically.",
    "- Administrative, raw specialist, and unknown assets are not wording precedents.",
    "- Original files remain unchanged in their source folders.",
    "",
  ].join("\n");
}

export function buildCanonicalReportQueue(inventory, decisions = new Map()) {
  const candidates = inventory.assets.filter((asset) => asset.sourceRole === "final_report_candidate");
  const groups = groupAssets(candidates, (asset) => asset.logicalDocumentKey
    ?? (asset.reportReference ? `${asset.reportReference.toLowerCase()}:${asset.reportFamily}` : `asset:${asset.assetId}`));
  const reports = groups.map((group) => {
    const decision = decisions.get(group.key) ?? null;
    const ranked = [...group.assets].sort((left, right) => canonicalAssetScore(right) - canonicalAssetScore(left)
      || left.relativePath.length - right.relativePath.length
      || left.relativePath.localeCompare(right.relativePath));
    const proposed = ranked[0];
    const selected = group.assets.find((asset) => asset.assetId === decision?.selected_asset_id) ?? proposed;
    return {
      groupKey: group.key,
      reportReference: proposed.reportReference,
      proposedCanonicalAssetId: proposed.assetId,
      selectedCanonicalAssetId: selected.assetId,
      selectedRelativePath: selected.relativePath,
      reportFamily: decision?.report_family ?? proposed.reportFamily,
      datasetSplit: decision?.dataset_split ?? "unassigned",
      assetLineageKey: decision?.asset_lineage_key ?? proposed.assetLineageKey,
      status: decision?.status_code ?? "pending_review",
      reviewNotes: decision?.review_notes ?? "",
      reviewedAtIso: decision?.reviewed_at_iso ?? null,
      renditionCount: group.assets.length,
      confidence: canonicalConfidence(ranked),
      assets: ranked.map((asset) => ({
        assetId: asset.assetId,
        relativePath: asset.relativePath,
        fileName: asset.fileName,
        extension: asset.extension,
        fileSizeBytes: asset.fileSizeBytes,
        documentVariant: asset.documentVariant,
        score: canonicalAssetScore(asset),
      })),
    };
  }).sort((left, right) => left.status.localeCompare(right.status)
    || String(left.reportReference ?? "").localeCompare(String(right.reportReference ?? ""))
    || left.groupKey.localeCompare(right.groupKey));
  return {
    generatedAtIso: new Date().toISOString(),
    sourceRoot: inventory.roots.find((root) => root.rootKind === "historical_reports")?.rootPath ?? null,
    summary: {
      reports: reports.length,
      pending: reports.filter((item) => item.status === "pending_review").length,
      approvedForIngestion: reports.filter((item) => item.status === "approved_for_ingestion").length,
      quarantined: reports.filter((item) => item.status === "quarantined").length,
      renditionAssets: candidates.length,
    },
    reports,
  };
}

function canonicalAssetScore(asset) {
  let score = asset.extension === "pdf" ? 40 : asset.extension === "docx" ? 30 : 10;
  const text = `${asset.fileName} ${asset.relativePath}`.toLowerCase();
  if (/rev(?:ision)?[ ._-]*\d+/.test(text)) score += 12;
  if (/final|report no\/|job no\//.test(text)) score += 8;
  if (/hardcopy|images only|syed review|adli review/.test(text)) score -= 18;
  return score;
}

function canonicalConfidence(ranked) {
  if (ranked.length === 1) return 1;
  const difference = canonicalAssetScore(ranked[0]) - canonicalAssetScore(ranked[1]);
  return difference >= 10 ? 0.9 : difference >= 4 ? 0.75 : 0.55;
}

function buildAssetRecord({ rootKind, rootPath, sourcePath }) {
  const stats = statSync(sourcePath);
  const relativePath = normalizeRelativePath(relative(rootPath, sourcePath));
  const fileName = basename(sourcePath);
  const extension = normalizeExtension(fileName);
  const reportReference = extractReportReference(fileName) ?? extractReportReference(relativePath);
  const classification = classifyCorpusAsset({ extension, fileName, relativePath, rootKind });
  const normalizedFileName = normalizeName(fileName.replace(/\.[^.]+$/, ""));
  const caseKey = reportReference?.toLowerCase() ?? null;
  const logicalDocumentKey = reportReference && [
    "final_report_candidate",
    "report_draft",
    "structured_template",
  ].includes(classification.sourceRole)
    ? `${reportReference.toLowerCase()}:${classification.reportFamily}`
    : null;
  const assetLineageKey = inferAssetLineageKey(relativePath, reportReference, classification.reportFamily);

  return {
    assetId: `kba_${stableHash(`${rootKind}:${relativePath}`).slice(0, 20)}`,
    rootKind,
    relativePath,
    fileName,
    extension: extension.slice(1),
    fileSizeBytes: stats.size,
    modifiedAtIso: stats.mtime.toISOString(),
    clientFolder: rootKind === "standards" ? "platform-standards" : firstPathSegment(relativePath),
    projectPath: parentPath(relativePath),
    reportReference,
    caseKey,
    logicalDocumentKey,
    assetLineageKey,
    binaryDuplicateCandidateKey: `${normalizedFileName}:${stats.size}`,
    sourceRole: classification.sourceRole,
    reportFamily: classification.reportFamily,
    documentVariant: classification.documentVariant,
    ingestionDisposition: classification.ingestionDisposition,
    approvalStatus: "pending_review",
    datasetSplit: "unassigned",
    retrievalEligible: false,
    requiresContentHash: true,
    requiresTextExtractionReview: ["pdf", "doc", "docx", "rtf"].includes(extension.slice(1)),
    requiresVisualExtraction: classification.requiresVisualExtraction,
    classificationReasons: classification.reasons,
  };
}

export function classifyCorpusAsset({ extension, fileName, relativePath, rootKind }) {
  const text = `${relativePath} ${fileName}`.toLowerCase();
  const fileNameText = fileName.toLowerCase();
  const fileReportFamily = classifyReportFamily(fileNameText);
  const reportFamily = fileReportFamily !== "unknown" ? fileReportFamily : classifyReportFamily(text);
  if (rootKind === "standards") {
    return classification("standards_guidance", classifyStandardFamily(text), "published_reference", "standards_review_required", [
      "Located in the controlled standards corpus.",
    ]);
  }
  if (isTemporaryArtifact(fileName)) {
    return classification("temporary_artifact", "temporary", "temporary", "exclude_temporary", [
      "Temporary Office/runtime artifact must never enter the KB.",
    ]);
  }
  if (isFieldsheet(text)) {
    return classification("structured_template", "fieldsheet_checklist", inferVariant(text), "candidate_review", [
      "Fieldsheet/checklist candidate for structured template extraction.",
    ]);
  }
  if (isAdministrative(text)) {
    return classification("administrative", "administrative", inferVariant(text), "exclude_administrative", [
      "Administrative/certificate/cover/timesheet material is not report-writing precedent.",
    ]);
  }
  if (isPreliminary(text)) {
    return classification("report_draft", reportFamily, "preliminary_or_draft", "quarantine_preliminary", [
      "Preliminary, draft, or working-copy wording requires explicit approval before reuse.",
    ]);
  }
  if (isSpecialistEvidence(text)) {
    return classification("specialist_evidence", reportFamily, inferVariant(text), "supporting_evidence_only", [
      "Specialist plate maps, scans, profiles, or raw data require tool-specific ingestion.",
    ], true);
  }
  if (
    reportFamily !== "unknown"
      && isNarrativeDocumentExtension(extension)
      && isReportCandidateName(fileNameText)
  ) {
    return classification("final_report_candidate", reportFamily, inferVariant(text), "candidate_review", [
      "Filename/path indicates a completed report family; human approval is still required.",
    ]);
  }
  if (isDrawingOrImage(extension, text)) {
    return classification("visual_support", reportFamily, inferVariant(text), "supporting_evidence_only", [
      "Visual/drawing asset should be linked to a report section, not embedded as wording precedent.",
    ], true);
  }
  return classification("unknown", reportFamily, inferVariant(text), "quarantine_unknown", [
    "The asset could not be safely classified from immutable metadata.",
  ]);
}

function classifyReportFamily(text) {
  if (/23pe1-[2-6].*tk\s*fu\s*(?:47|48|49|50|51)/.test(text)) return "horizontal_internal_external";
  if (/profile assessment|shell deformation|plumbness|roundness/.test(text)) return "profile_3d_scan";
  if (/floor.*3d scan|3d scan.*floor/.test(text)) return "floor_3d_scan";
  if (/settlement survey|floor & edge settlement|floor and edge settlement/.test(text)) return "settlement_survey";
  if (/post[- ]?repair|post repair/.test(text)) return "post_repair";
  if (/consultation.*repair|review on repairs/.test(text)) return "repair_consultation";
  if (/shell repairs?|\bmpi\b|magnetic particle/.test(text)) return "mpi_repair";
  if (/calibration/.test(text)) return "calibration";
  if (/mfl|magnetic flux|tru[- ]?flux|platemaps?|plate maps?|b[- ]?scan profiles?/.test(text)) return "mfl_floor_scan";
  if (/fieldsheet|field sheet|checklist/.test(text)) return "fieldsheet_checklist";
  if (/internal\s*&\s*external|internal and external|int\s*&\s*ext/.test(text)) return "internal_external_api653";
  if (/in[- ]?service inspection/.test(text)) return "in_service_inspection";
  if (/external inspection/.test(text)) return "external_inspection";
  if (/internal inspection|shell internal/.test(text)) return "internal_inspection";
  if (/tank survey|survey inspection report/.test(text)) return "tank_survey";
  if (/inspection report|assessment report|measurement report|survey report/.test(text)) return "other_inspection_report";
  return "unknown";
}

function inferAssetLineageKey(relativePath, reportReference, reportFamily) {
  const text = String(relativePath).toLowerCase();
  if (/23pe1-[2-6].*tk\s*fu\s*(?:47|48|49|50|51)/.test(text)) return "campaign:2023-pacific-energy-fu47-fu51";
  const tank = text.match(/\btk\s*[-_ ]*([a-z]{0,3}\s*\d+[a-z]?)\b/i)?.[1]?.replace(/\s+/g, "-");
  if (tank) return `asset:${reportFamily}:${tank}`;
  return reportReference ? `report:${reportReference.toLowerCase()}` : null;
}

function classifyStandardFamily(text) {
  for (const [family, pattern] of [
    ["api_653", /api\s*653/],
    ["api_650", /api(?:\s+std)?\s*650/],
    ["api_620", /api\s*620/],
    ["api_651", /api\s*651/],
    ["api_652", /api\s*652/],
    ["api_575", /api\s*575/],
    ["api_577", /api\s*577/],
    ["eemua_159", /eemua\s*159/],
    ["sti_sp001", /sti\s*sp0*1/],
    ["astm", /astm/],
    ["as_1692", /as\s*1692/],
  ]) {
    if (pattern.test(text)) return family;
  }
  return "other_standard";
}

function isAdministrative(text) {
  return /(?:^|\/)admin(?:\/|$)|completion certificate|inspection certificate|timesheet|report label|cover page|method statement|let+er of receipt|receipt of documents|cd template|quotation|purchase order|invoice/.test(text);
}

function isTemporaryArtifact(fileName) {
  return basename(fileName).startsWith("~$") || /\.tmp$/i.test(fileName);
}

function isPreliminary(text) {
  return /preliminary|\bdraft\b|working copy|syed reviewed|for review|\.tmp\b/.test(text);
}

function isFieldsheet(text) {
  return /fieldsheet|field sheet|inspection checklist/.test(text);
}

function isSpecialistEvidence(text) {
  return /(?:^|\/)mfl data(?:\/|$)|mfl platemaps?|magnetic flux.*maps?|tru[- ]?flux data|b[- ]?scan profiles?|individual platemaps?|plate scanning/.test(text);
}

function isNarrativeDocumentExtension(extension) {
  return [".pdf", ".doc", ".docx", ".rtf"].includes(extension);
}

function isReportCandidateName(fileNameText) {
  return /report|assessment|tank survey|shell repairs?|consultation.*repair/.test(fileNameText);
}

function isDrawingOrImage(extension, text) {
  return [".jpg", ".jpeg", ".png", ".tif", ".tiff", ".cdr"].includes(extension)
    || /layout|drawing|sketch|heat map|corrosion map|plate map/.test(text);
}

function inferVariant(text) {
  if (/preliminary|\bdraft\b|working copy/.test(text)) return "preliminary_or_draft";
  if (/rev(?:ision)?[ ._-]*\d+/i.test(text)) return "revision";
  if (/hardcopy/.test(text)) return "hardcopy_rendition";
  return "unspecified";
}

function classification(sourceRole, reportFamily, documentVariant, ingestionDisposition, reasons, requiresVisualExtraction = false) {
  return { sourceRole, reportFamily, documentVariant, ingestionDisposition, reasons, requiresVisualExtraction };
}

function listFilesRecursive(rootPath) {
  const files = [];
  const pending = [rootPath];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const sourcePath = `${directory}/${entry.name}`;
      if (entry.isDirectory()) pending.push(sourcePath);
      if (entry.isFile()) files.push(sourcePath);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function buildSummary(assets, duplicateCandidateGroups, logicalReportGroups, caseAssetGroups) {
  return {
    totalAssets: assets.length,
    totalBytes: assets.reduce((sum, asset) => sum + asset.fileSizeBytes, 0),
    finalReportCandidateCount: countWhere(assets, (asset) => asset.sourceRole === "final_report_candidate"),
    standardsCandidateCount: countWhere(assets, (asset) => asset.sourceRole === "standards_guidance"),
    supportingEvidenceCount: countWhere(assets, (asset) => ["specialist_evidence", "visual_support", "structured_template"].includes(asset.sourceRole)),
    administrativeExcludedCount: countWhere(assets, (asset) => asset.sourceRole === "administrative"),
    quarantinedCount: countWhere(assets, (asset) => asset.ingestionDisposition.startsWith("quarantine")),
    duplicateCandidateGroupCount: duplicateCandidateGroups.length,
    logicalReportGroupCount: logicalReportGroups.length,
    caseAssetGroupCount: caseAssetGroups.length,
    byExtension: countBy(assets, (asset) => asset.extension || "none"),
    bySourceRole: countBy(assets, (asset) => asset.sourceRole),
    byReportFamily: countBy(assets, (asset) => asset.reportFamily),
    byDisposition: countBy(assets, (asset) => asset.ingestionDisposition),
    byClientFolder: countBy(assets, (asset) => asset.clientFolder),
  };
}

function groupAssets(assets, keyFor) {
  const groups = new Map();
  for (const asset of assets) {
    const key = keyFor(asset);
    if (!key) continue;
    const current = groups.get(key) ?? [];
    current.push(asset);
    groups.set(key, current);
  }
  return [...groups.entries()].map(([key, groupedAssets]) => ({ key, assets: groupedAssets }));
}

function toAssetPointer(asset) {
  return {
    assetId: asset.assetId,
    relativePath: asset.relativePath,
    fileSizeBytes: asset.fileSizeBytes,
    sourceRole: asset.sourceRole,
    reportFamily: asset.reportFamily,
    assetLineageKey: asset.assetLineageKey,
  };
}

function countBy(values, keyFor) {
  return Object.fromEntries(
    [...values.reduce((counts, value) => {
      const key = keyFor(value);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])),
  );
}

function countWhere(values, predicate) {
  return values.reduce((count, value) => count + (predicate(value) ? 1 : 0), 0);
}

function extractReportReference(value) {
  const normalized = String(value).toUpperCase();
  const match = normalized.match(/(?:^|[^A-Z0-9])(\d{2}[A-Z]{2,5}\d*-\d+)(?:[^A-Z0-9]|$)/);
  return match?.[1] ?? null;
}

function normalizeExtension(value) {
  return extname(value).toLowerCase();
}

function normalizeName(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeRelativePath(value) {
  return String(value).split(sep).join("/");
}

function firstPathSegment(value) {
  const segments = normalizeRelativePath(value).split("/");
  return segments.length > 1 ? segments[0] : "[root]";
}

function parentPath(value) {
  const segments = normalizeRelativePath(value).split("/");
  return segments.slice(0, -1).join("/") || "[root]";
}

function stableHash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}

function renderCountTable(title, counts) {
  const rows = Object.entries(counts).map(([key, count]) => `| ${key} | ${count} |`);
  return [`## ${title}`, "", "| Value | Count |", "| --- | ---: |", ...rows].join("\n");
}
