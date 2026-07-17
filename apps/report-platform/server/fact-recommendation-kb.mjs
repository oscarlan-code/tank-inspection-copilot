import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rebuildPrecedentKbIndex } from "./precedent-kb.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const appRoot = join(__dirname, "..");
const defaultPrecedentIndexPath = join(appRoot, ".data", "precedent-kb", "precedent-kb.index.json");
const defaultDataDir = join(appRoot, ".data", "fact-recommendation-kb");
const defaultIndexPath = join(defaultDataDir, "fact-recommendation-kb.index.json");
const INDEX_SCHEMA_VERSION = 1;

const CURRENT_MOCK_GOLD_SOURCE_NAMES = [
  "22PE1-4 TK V10 Internal & External Inspection Report",
];

const MODE_HEADINGS = new Map([
  ["off-line", "offline"],
  ["offline", "offline"],
  ["on-line", "online"],
  ["online", "online"],
  ["others", "other"],
  ["other", "other"],
]);

const HEADER_PATTERNS = [
  /\binternational\s+refinery\b/i,
  /\bmanaging\s+inspections\b/i,
  /^\s*client\s*:/i,
  /^\s*tank\s+no\.?\s*:/i,
  /^\s*job\s+no\.?\s*:/i,
  /^\s*date\s+completed\s*:/i,
  /^\s*page\s*:/i,
  /^\s*\d+\s+repair recommendations/i,
  /^\s*repair recommendations\s*\/\s*api/i,
];

const ACTION_RULES = [
  ["weld_build_up", /\bweld(?:ed)?\s+build[- ]?up\b|\bbuild[- ]?up\b/i],
  ["patch_repair", /\bpatch(?:ed)?\s+(?:plate|repair)|\bwelded[- ]on\s+patch\b|\bpartial plate replacement\b/i],
  ["weld_fill", /\bweld\s+fills?\b|\bweld[- ]?fill/i],
  ["grind_flush", /\bgrind(?:ing)?\s+flush|\bground\s+flush|\bremoved?\s+by\s+grind/i],
  ["visual_mpi_reinspection", /\breinspect(?:ed|ion)?\b.*\b(?:visual|mpi)\b|\b(?:visual|mpi)\b.*\breinspect/i],
  ["clean_prepare_recoat", /\bclean(?:ed)?\b.*\bprepared?\b.*\brecoat|\brecoat(?:ed|ing)?\b/i],
  ["install", /\binstall(?:ed|ation)?\b/i],
  ["replace", /\breplace(?:d|ment)?\b/i],
  ["repair", /\brepair(?:ed|s|ing)?\b|\brestore(?:d)?\b/i],
  ["monitor", /\bmonitor(?:ed|ing)?\b|\breinspect(?:ed|ion)?\b.*\b(?:year|years|short[- ]term)\b/i],
  ["pressure_test", /\bpressure\s+test/i],
  ["provide_venting", /\bemergency\s+venting|\badequate\s+venting|\bvent(?:ed|ing)?\b/i],
  ["remove", /\bremove(?:d|al)?\b/i],
  ["seal", /\bseal(?:ed|ant)?\b|\bmastic\b|\bplinth\b/i],
  ["keep_clean", /\bkept\s+clean|\bkeep\s+clean|\bclear(?:ed)?\b/i],
  ["inspect_access", /\bclose\s+visual|\bprovide\s+access|\bgrit\s+blast|\binspect(?:ed|ion)?\b/i],
];

const COMPONENT_RULES = [
  ["shell", /\bshell\b|\bstrake\b|\bcourse\b/i],
  ["roof", /\broof\b|\bfrangible\b|\bvent(?:ing)?\b/i],
  ["floor", /\bfloor\b|\bbottom\s+plate\b|\btank\s+bottom\b/i],
  ["nozzle", /\bnozzles?\b|\bman\s*way\b|\bmanhole\b/i],
  ["reinforcement_pad", /\breinforc(?:ing|ement)\s+pads?\b|\btell[- ]?tale\b/i],
  ["weld", /\bweld(?:ed|s|ment)?\b|\bbutt[- ]?weld/i],
  ["coating", /\bcoat(?:ing|ed|ings)?\b|\brecoat/i],
  ["access_structure", /\bstair(?:way)?\b|\bladder\b|\bwalkway\b|\bhandrail\b|\btread\b|\bplatform\b/i],
  ["foundation", /\bfoundation\b|\bplinth\b|\banchor\s+bolts?\b/i],
  ["dike_drainage", /\bdike(?:d)?\b|\bdrain(?:age)?\b|\bdebris\b/i],
  ["pipe_support", /\bpipe\s+supports?\b|\bsupports?\b/i],
  ["nameplate", /\bnameplate\b/i],
];

const CONDITION_RULES = [
  ["corrosion", /\bcorrosion\b|\bcorroded\b|\bmetal\s+loss\b/i],
  ["coating_failure", /\bcoating\s+failures?\b|\bweathered\b|\bexposed\s+steel\b/i],
  ["linear_indication", /\blinear\s+(?:cracks?|indications?)\b|\bcracks?\b/i],
  ["pitting", /\bpitting\b|\bdeep\s+pitting\b/i],
  ["buckling", /\bbuckl(?:ed|ing)\b/i],
  ["low_thickness", /\blow\s+(?:local\s+)?thickness\b|\bminimum\s+thickness\b|\bremaining\s+thickness\b/i],
  ["through_hole", /\bthrough[- ]?hole\b|\bpinhole\b|\bleak\b/i],
  ["missing_tell_tale", /\bwithout\s+tell[- ]?tale\b|\btell[- ]?tale\s+holes?\b/i],
  ["non_frangible", /\bnot\s+frangible\b|\bfrangible\b/i],
  ["poor_drainage", /\bstanding\s+water\b|\bdrainage\b|\bdebris\b/i],
  ["access_limited", /\blimited\s+access\b|\bnot\s+removed\b|\baccess\b/i],
];

const EVIDENCE_RULES = [
  ["visual", /\bvisual\b|\bobserved\b|\bfound\b/i],
  ["mpi", /\bmpi\b|\bmagnetic\s+particle\b/i],
  ["ut", /\but\b|\bultrasonic\b|\bthickness\b/i],
  ["mfl", /\bmfl\b|\bmagnetic\s+flux\b/i],
  ["api653", /\bapi\s*653\b/i],
  ["api650", /\bapi\s*650\b/i],
  ["drawing", /\bdrawing\b|\bmarked\s+on\s+site\b|\bmarked\b/i],
];

export function getFactRecommendationKbStatus({ indexPath = defaultIndexPath } = {}) {
  const index = readIndex(indexPath);
  return {
    configured: true,
    built: Boolean(index),
    schemaVersion: index?.schemaVersion ?? INDEX_SCHEMA_VERSION,
    builtAtIso: index?.builtAtIso ?? null,
    indexPath,
    pairCount: index?.pairs?.length ?? 0,
    sourceChunkCount: index?.sourceChunkCount ?? 0,
    sourceDocumentCount: index?.sourceDocumentCount ?? 0,
    errors: index?.errors ?? [],
    actionTagCounts: index ? countTag(index.pairs, "actionTags") : {},
    componentTagCounts: index ? countTag(index.pairs, "componentTags") : {},
  };
}

export function rebuildFactRecommendationKbIndex({
  indexPath = defaultIndexPath,
  precedentIndexPath = defaultPrecedentIndexPath,
} = {}) {
  const precedentIndex = loadPrecedentIndex(precedentIndexPath);
  const chunks = (precedentIndex.chunks ?? []).filter((chunk) =>
    chunk.sourceType === "sample_pdf" &&
    chunk.approvalStatus === "approved_for_retrieval" &&
    chunk.redactionStatus === "sample_corpus"
  );
  const pairs = [];
  const errors = [];

  for (const chunk of chunks) {
    try {
      pairs.push(...extractPairsFromChunk(chunk));
    } catch (error) {
      errors.push({
        chunkId: chunk.chunkId,
        sourceReportName: chunk.sourceReportName,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const dedupedPairs = dedupePairs(pairs)
    .sort((left, right) =>
      right.confidence - left.confidence ||
      left.sourceReportName.localeCompare(right.sourceReportName) ||
      left.sourcePageStart - right.sourcePageStart
    );
  const index = {
    schemaVersion: INDEX_SCHEMA_VERSION,
    builtAtIso: new Date().toISOString(),
    pairKbId: `frkb_${randomUUID()}`,
    source: {
      precedentIndexPath,
      precedentBuiltAtIso: precedentIndex.builtAtIso ?? null,
      sampleReportsDir: precedentIndex.sampleReportsDir ?? null,
    },
    sourceDocumentCount: new Set(chunks.map((chunk) => chunk.documentId)).size,
    sourceChunkCount: chunks.length,
    pairCount: dedupedPairs.length,
    actionTagCounts: countTag(dedupedPairs, "actionTags"),
    componentTagCounts: countTag(dedupedPairs, "componentTags"),
    conditionTagCounts: countTag(dedupedPairs, "conditionTags"),
    pairs: dedupedPairs,
    errors,
  };

  writeIndex(indexPath, index);
  return index;
}

export function searchFactRecommendationPairs({
  reportState,
  sectionId = "repair-recommendations",
  indexPath = defaultIndexPath,
  allowBuild = true,
  limit = 24,
} = {}) {
  const index = loadOrBuildIndex({ indexPath, allowBuild });
  const evidenceProfile = buildCurrentEvidenceProfile(reportState, sectionId);
  const blockedSourceNames = buildBlockedSourceNames(reportState);
  const accessScope = buildRetrievalAccessScope(reportState);
  const accessiblePairs = (index.pairs ?? []).filter((pair) => isKbSourceAccessible(pair, accessScope));
  const allowedPairs = accessiblePairs.filter((pair) => !isBlockedSource(pair.sourceReportName, blockedSourceNames));
  const scored = allowedPairs
    .map((pair) => ({
      pair,
      score: scorePair(pair, evidenceProfile, sectionId),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) =>
      right.score - left.score ||
      right.pair.confidence - left.pair.confidence ||
      left.pair.sourceReportName.localeCompare(right.pair.sourceReportName)
    );
  const matches = scored.slice(0, limit).map(({ pair, score }) => ({
    ...pair,
    score: Number(score.toFixed(2)),
    usageRule:
      "Historical fact-to-recommendation pair. Use as structured guidance only; current report facts must come from the LAIQ app export or confirmed report-side input.",
  }));

  return {
    sectionId,
    retrievalRunId: `frr_${randomUUID()}`,
    indexBuiltAtIso: index.builtAtIso,
    pairCount: index.pairCount ?? index.pairs?.length ?? 0,
    accessScope,
    accessDeniedPairCount: (index.pairs ?? []).length - accessiblePairs.length,
    blockedSourceNames: [...blockedSourceNames],
    excludedPairCount: (index.pairs ?? []).length - allowedPairs.length,
    evidenceProfile,
    totalMatchCount: scored.length,
    pairs: matches,
    warnings: buildWarnings(index, matches),
  };
}

export function buildFactRecommendationAudit({
  reportState,
  sectionIds = ["repair-recommendations", "inspection-report", "shell-internal-recommended-repairs"],
  indexPath = defaultIndexPath,
  allowBuild = true,
} = {}) {
  const index = loadOrBuildIndex({ indexPath, allowBuild });
  const sections = sectionIds.map((sectionId) => {
    const pack = searchFactRecommendationPairs({
      reportState,
      sectionId,
      indexPath,
      allowBuild,
      limit: 12,
    });
    return {
      sectionId,
      totalMatchCount: pack.totalMatchCount,
      excludedPairCount: pack.excludedPairCount,
      topPairs: pack.pairs.slice(0, 8).map((pair) => ({
        pairId: pair.pairId,
        sourceReportName: pair.sourceReportName,
        pageStart: pair.sourcePageStart,
        actionTags: pair.actionTags,
        componentTags: pair.componentTags,
        conditionTags: pair.conditionTags,
        recommendationPattern: pair.recommendationPattern,
        score: pair.score,
      })),
      warnings: pack.warnings,
    };
  });

  return {
    auditRunId: `fraud_${randomUUID()}`,
    createdAtIso: new Date().toISOString(),
    indexBuiltAtIso: index.builtAtIso,
    pairCount: index.pairCount ?? index.pairs?.length ?? 0,
    sourceChunkCount: index.sourceChunkCount ?? 0,
    actionTagCounts: index.actionTagCounts ?? {},
    componentTagCounts: index.componentTagCounts ?? {},
    sections,
  };
}

export function buildFlatFactRecommendationContext(pack) {
  return (pack?.pairs ?? []).map((pair) => ({
    key: pair.pairId,
    title: `${pair.actionTags.join(", ")} / ${pair.componentTags.join(", ")}`,
    whenToUse: pair.factPattern,
    recommendationPattern: pair.recommendationPattern,
    actionTags: pair.actionTags,
    componentTags: pair.componentTags,
    conditionTags: pair.conditionTags,
    evidenceTags: pair.evidenceTags,
    source: `${pair.sourceReportName} p.${pair.sourcePageStart}`,
    usageRule: pair.usageRule,
    score: pair.score,
  }));
}

function extractPairsFromChunk(chunk) {
  const blocks = extractRecommendationBlocks(chunk.excerpt);
  return blocks
    .map((block, index) => buildPairFromBlock(chunk, block, index))
    .filter(Boolean);
}

function extractRecommendationBlocks(excerpt) {
  const lines = String(excerpt ?? "")
    .replace(/\r/g, "\n")
    .replace(/[•●▪]/g, "•")
    .replace(/[➢]/g, "➢")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const blocks = [];
  let currentMode = "unspecified";
  let current = null;

  const flush = () => {
    if (current?.text) {
      blocks.push(current);
    }
    current = null;
  };

  for (const line of lines) {
    if (isHeaderLine(line)) continue;

    const mode = normalizeMode(line);
    if (mode) {
      flush();
      currentMode = mode;
      continue;
    }

    if (isBulletStart(line)) {
      flush();
      current = {
        mode: currentMode,
        text: cleanBulletText(line),
      };
      continue;
    }

    if (current) {
      current.text = `${current.text} ${line}`.trim();
    } else if (looksLikeRecommendationSentence(line)) {
      blocks.push({
        mode: currentMode,
        text: cleanBulletText(line),
      });
    }
  }

  flush();

  return blocks
    .flatMap((block) => splitCompoundRecommendation(block))
    .map((block) => ({
      ...block,
      text: normalizeRecommendationText(block.text),
    }))
    .filter((block) => isRecommendationCandidate(block.text));
}

function buildPairFromBlock(chunk, block, blockIndex) {
  const actionTags = matchTags(block.text, ACTION_RULES);
  if (actionTags.length === 0) return null;

  const componentTags = matchTags(block.text, COMPONENT_RULES);
  const conditionTags = matchTags(block.text, CONDITION_RULES);
  const evidenceTags = matchTags(block.text, EVIDENCE_RULES);
  const confidence = computeConfidence({
    chunk,
    actionTags,
    componentTags,
    conditionTags,
    evidenceTags,
    text: block.text,
  });

  if (confidence < 0.42) return null;

  const sourceKey = [
    chunk.chunkId,
    blockIndex,
    block.mode,
    block.text.slice(0, 260),
  ].join("|");

  return {
    pairId: `frp_${shortHash(sourceKey)}`,
    sourceChunkId: chunk.chunkId,
    sourceDocumentId: chunk.documentId,
    sourceReportName: chunk.sourceReportName,
    sourceReportFamily: chunk.reportFamily,
    sourceInspectionType: chunk.inspectionType,
    sourceTenantId: chunk.tenantId,
    sourceWorkspaceId: chunk.workspaceId,
    visibilityScope: chunk.visibilityScope,
    sourcePageStart: chunk.pageStart,
    sourcePageEnd: chunk.pageEnd,
    sectionKey: chunk.sectionKey,
    chunkType: chunk.chunkType,
    contextMode: block.mode,
    componentTags,
    conditionTags,
    actionTags,
    evidenceTags,
    factPattern: buildFactPattern({ componentTags, conditionTags, evidenceTags, text: block.text }),
    recommendationPattern: block.text,
    confidence: Number(confidence.toFixed(2)),
  };
}

function buildRetrievalAccessScope(reportState) {
  return {
    tenantId: reportState?.reportJob?.tenantId ?? reportState?.authorizationContext?.tenantId ?? null,
    workspaceId: reportState?.reportJob?.workspaceId ?? reportState?.authorizationContext?.workspaceId ?? null,
  };
}

function isKbSourceAccessible(source, accessScope) {
  const visibilityScope = source.visibilityScope ?? "platform_library";
  if (["platform_library", "platform_codes_library"].includes(visibilityScope)) {
    return true;
  }
  if (visibilityScope === "tenant_private") {
    return Boolean(accessScope.tenantId && source.sourceTenantId === accessScope.tenantId);
  }
  if (visibilityScope === "workspace_private") {
    return Boolean(
      accessScope.tenantId &&
      accessScope.workspaceId &&
      source.sourceTenantId === accessScope.tenantId &&
      source.sourceWorkspaceId === accessScope.workspaceId,
    );
  }
  return source.sourceTenantId === "platform";
}

function buildCurrentEvidenceProfile(reportState, sectionId) {
  const exportPackage = reportState?.exportPackage ?? {};
  const factsText = [
    sectionId,
    exportPackage.inspectionReference,
    exportPackage.task?.client,
    exportPackage.task?.tankNumber,
    ...(exportPackage.findings ?? []).map((finding) => [
      finding.findingId,
      finding.title,
      finding.locationLabel,
      finding.targetKey,
      finding.note,
    ].filter(Boolean).join(" ")),
    ...(exportPackage.voiceNotes ?? []).map((note) => [
      note.sectionKey,
      note.cardKey,
      note.targetKey,
      note.itemKey,
      note.transcriptText,
    ].filter(Boolean).join(" ")),
    ...(exportPackage.elements ?? []).map((element) => [
      element.targetKey,
      element.elementTypeKey,
      element.label,
      element.itemKey,
    ].filter(Boolean).join(" ")),
    ...(exportPackage.utMeasurements ?? []).map((measurement) => [
      measurement.targetKey,
      measurement.itemKind,
      measurement.itemLabel,
      measurement.laneId,
      measurement.course,
      measurement.plateId,
    ].filter(Boolean).join(" ")),
  ].filter(Boolean).join("\n");

  return {
    sectionId,
    componentTags: matchTags(factsText, COMPONENT_RULES),
    conditionTags: matchTags(factsText, CONDITION_RULES),
    actionTags: matchTags(factsText, ACTION_RULES),
    evidenceTags: matchTags(factsText, EVIDENCE_RULES),
    tokens: tokenize(factsText),
  };
}

function scorePair(pair, evidenceProfile, sectionId) {
  let score = 0;
  if (pair.sectionKey === sectionId) score += 45;
  if (sectionId === "repair-recommendations" && pair.sectionKey === "repair-recommendations") score += 20;
  if (sectionId.includes("repair") && pair.actionTags.includes("repair")) score += 15;
  score += overlap(pair.componentTags, evidenceProfile.componentTags) * 14;
  score += overlap(pair.conditionTags, evidenceProfile.conditionTags) * 16;
  score += overlap(pair.actionTags, evidenceProfile.actionTags) * 10;
  score += overlap(pair.evidenceTags, evidenceProfile.evidenceTags) * 6;
  score += overlap(tokenize(pair.recommendationPattern), evidenceProfile.tokens) * 1.4;
  score += pair.confidence * 10;
  if (pair.contextMode === "offline" && sectionId.includes("repair")) score += 4;
  return score;
}

function buildBlockedSourceNames(reportState) {
  const exportPackage = reportState?.exportPackage;
  const manualSupplement = reportState?.manualSupplement ?? {};
  const blocked = new Set();
  const add = (value) => {
    const normalized = normalizeSourceName(value);
    if (normalized) blocked.add(normalized);
  };

  [
    ...(Array.isArray(manualSupplement.excludedPrecedentSources) ? manualSupplement.excludedPrecedentSources : []),
    ...(Array.isArray(exportPackage?.excludedPrecedentSources) ? exportPackage.excludedPrecedentSources : []),
    ...(Array.isArray(exportPackage?.knowledgeBaseExclusions) ? exportPackage.knowledgeBaseExclusions : []),
    manualSupplement.reportReference,
    exportPackage?.inspectionReference,
  ].forEach(add);

  if (isCurrentMockTrainingPackage(exportPackage)) {
    CURRENT_MOCK_GOLD_SOURCE_NAMES.forEach(add);
  }

  return blocked;
}

function isCurrentMockTrainingPackage(exportPackage) {
  if (!exportPackage) return false;
  return [
    exportPackage.inspectionId,
    exportPackage.inspectionReference,
    exportPackage.task?.tankNumber,
    ...(exportPackage.voiceNotes ?? []).map((note) => note.relativePath),
  ]
    .filter(Boolean)
    .some((value) => /demo-api653-training|v10|laiq-d10/i.test(String(value)));
}

function buildWarnings(index, matches) {
  const warnings = [];
  if (!index.builtAtIso) warnings.push("Fact-to-recommendation KB index is not built.");
  if (matches.length === 0) warnings.push("No structured fact-to-recommendation pairs matched this section.");
  return warnings;
}

function loadOrBuildIndex({ indexPath, allowBuild }) {
  const existing = readIndex(indexPath);
  if (existing) return existing;
  if (!allowBuild) {
    return {
      schemaVersion: INDEX_SCHEMA_VERSION,
      builtAtIso: null,
      sourceChunkCount: 0,
      sourceDocumentCount: 0,
      pairCount: 0,
      pairs: [],
      errors: [],
    };
  }
  return rebuildFactRecommendationKbIndex({ indexPath });
}

function loadPrecedentIndex(precedentIndexPath) {
  if (existsSync(precedentIndexPath)) {
    return JSON.parse(readFileSync(precedentIndexPath, "utf8"));
  }
  return rebuildPrecedentKbIndex({ indexPath: precedentIndexPath });
}

function readIndex(indexPath) {
  if (!existsSync(indexPath)) return null;
  try {
    const index = JSON.parse(readFileSync(indexPath, "utf8"));
    if (index.schemaVersion !== INDEX_SCHEMA_VERSION) return null;
    return index;
  } catch {
    return null;
  }
}

function writeIndex(indexPath, index) {
  mkdirSync(dirname(indexPath), { recursive: true });
  const tempPath = `${indexPath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(index, null, 2));
  renameSync(tempPath, indexPath);
}

function splitCompoundRecommendation(block) {
  const text = String(block.text ?? "");
  const sentenceParts = text
    .split(/(?<=\.)\s+(?=[A-Z])/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (sentenceParts.length <= 1) return [block];

  return sentenceParts
    .filter((part) => looksLikeRecommendationSentence(part))
    .map((part) => ({ ...block, text: part }));
}

function isHeaderLine(line) {
  return HEADER_PATTERNS.some((pattern) => pattern.test(line));
}

function normalizeMode(line) {
  const normalized = line
    .replace(/[^a-z-]/gi, "")
    .toLowerCase();
  return MODE_HEADINGS.get(normalized) ?? null;
}

function isBulletStart(line) {
  return /^[➢•*-]\s+/.test(line) || /^\(?[a-z]\)\s+/i.test(line);
}

function cleanBulletText(line) {
  return String(line ?? "")
    .replace(/^[➢•*-]\s*/, "")
    .replace(/^\(?[a-z]\)\s+/i, "")
    .trim();
}

function normalizeRecommendationText(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

function isRecommendationCandidate(text) {
  const normalized = normalizeRecommendationText(text);
  if (normalized.length < 28) return false;
  if (normalized.length > 900) return false;
  if (!looksLikeRecommendationSentence(normalized)) return false;
  return !HEADER_PATTERNS.some((pattern) => pattern.test(normalized));
}

function looksLikeRecommendationSentence(text) {
  return ACTION_RULES.some(([, pattern]) => pattern.test(text)) ||
    /\b(should|shall|recommended?|required?|needs?|must|consider)\b/i.test(text);
}

function matchTags(text, rules) {
  return rules
    .filter(([, pattern]) => pattern.test(String(text ?? "")))
    .map(([tag]) => tag);
}

function computeConfidence({ chunk, actionTags, componentTags, conditionTags, evidenceTags, text }) {
  let score = 0.25;
  if (chunk.sectionKey === "repair-recommendations") score += 0.22;
  if (chunk.chunkType === "recommendation_group") score += 0.16;
  if (actionTags.length > 0) score += Math.min(0.22, actionTags.length * 0.06);
  if (componentTags.length > 0) score += Math.min(0.14, componentTags.length * 0.04);
  if (conditionTags.length > 0) score += Math.min(0.12, conditionTags.length * 0.04);
  if (evidenceTags.length > 0) score += Math.min(0.08, evidenceTags.length * 0.025);
  if (/\bshould\b|\brecommended\b|\bshall\b/i.test(text)) score += 0.08;
  return Math.min(0.98, score);
}

function buildFactPattern({ componentTags, conditionTags, evidenceTags, text }) {
  const parts = [];
  if (componentTags.length > 0) parts.push(`components=${componentTags.join(", ")}`);
  if (conditionTags.length > 0) parts.push(`conditions=${conditionTags.join(", ")}`);
  if (evidenceTags.length > 0) parts.push(`evidence=${evidenceTags.join(", ")}`);
  if (parts.length === 0) {
    const fallback = tokenize(text).slice(0, 10).join(" ");
    return fallback ? `historical pattern: ${fallback}` : "historical recommendation pattern";
  }
  return parts.join("; ");
}

function dedupePairs(pairs) {
  const seen = new Map();
  for (const pair of pairs) {
    const key = [
      pair.sourceReportName,
      pair.sourcePageStart,
      normalizeForDedupe(pair.recommendationPattern),
    ].join("|");
    const current = seen.get(key);
    if (!current || pair.confidence > current.confidence) {
      seen.set(key, pair);
    }
  }
  return [...seen.values()];
}

function countTag(items, field) {
  const counts = {};
  for (const item of items ?? []) {
    for (const tag of item[field] ?? []) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}

function overlap(left = [], right = []) {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item)).length;
}

function tokenize(text) {
  return [...new Set(
    String(text ?? "")
      .toLowerCase()
      .match(/[a-z][a-z0-9-]{2,}/g) ?? [],
  )];
}

function normalizeForDedupe(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeSourceName(value) {
  return String(value ?? "")
    .replace(/\.pdf$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isBlockedSource(sourceReportName, blockedSourceNames) {
  if (!blockedSourceNames?.size) return false;
  const sourceName = normalizeSourceName(sourceReportName);
  return [...blockedSourceNames].some((blockedSourceName) =>
    sourceName === blockedSourceName ||
    sourceName.includes(blockedSourceName) ||
    blockedSourceName.includes(sourceName)
  );
}

function shortHash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 18);
}
