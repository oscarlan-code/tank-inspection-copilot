import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  API_STANDARD_PRIMARY_REPORT,
  API_STANDARD_REPORT_TOC,
  getApiStandardTocSectionForPage,
} from "./report-toc.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const appRoot = join(__dirname, "..");
const defaultDataDir = join(appRoot, ".data", "precedent-kb");
const defaultIndexPath = join(defaultDataDir, "precedent-kb.index.json");
const defaultSampleReportsDir = process.env.PRECEDENT_SAMPLE_REPORTS_DIR
  || "/Users/oscar/Public/irs/Sample Reports";
const defaultStandardsCodesDir = process.env.PRECEDENT_CODES_DIR
  || "/Users/oscar/Public/irs/Codes";

const INDEX_SCHEMA_VERSION = 1;
const MAX_EXCERPT_LENGTH = 1700;

const SECTION_PROFILES = {
  cover: {
    sectionKey: "cover",
    preferredPageStart: 2,
    preferredFamilies: ["shell-internal", "internal-external", "internal", "external"],
    queryTerms: ["cover", "inspection report", "report reference", "client", "tank"],
    formatPatterns: [
      {
        patternId: "kbfp_cover_reference_block",
        patternType: "cover_reference_block",
        instruction: "Use a centered report title with client, tank number, report reference, and inspection window grouped tightly.",
      },
    ],
  },
  "scope-of-inspection": {
    sectionKey: "scope-of-inspection",
    preferredPageStart: 4,
    preferredFamilies: ["shell-internal", "internal-external", "internal"],
    queryTerms: [
      "scope of inspection",
      "close visual inspection",
      "shell internal",
      "after blasting",
      "api 653",
      "cad drawing",
    ],
    formatPatterns: [
      {
        patternId: "kbfp_scope_arrow_bullets",
        patternType: "scope_arrow_bullets",
        instruction: "Use the numbered section heading and arrow-bullet scope statements from the sample report family.",
      },
    ],
  },
  "inspection-maintenance-regime": {
    sectionKey: "inspection-maintenance-regime",
    preferredPageStart: 5,
    preferredFamilies: ["shell-internal", "internal-external", "internal"],
    queryTerms: [
      "inspection and maintenance regime",
      "api 653 appendix c",
      "eemua 159",
      "owner operator",
      "maintenance schedule",
    ],
    formatPatterns: [
      {
        patternId: "kbfp_maintenance_formal_paragraphs",
        patternType: "maintenance_formal_paragraphs",
        instruction: "Use formal maintenance responsibility paragraphs and preserve the report-family disclaimer tone.",
      },
    ],
  },
  "general-tank-information": {
    sectionKey: "general-tank-information",
    preferredPageStart: 6,
    preferredFamilies: ["shell-internal", "internal-external", "internal", "external"],
    queryTerms: [
      "general tank information",
      "tank information",
      "year built",
      "diameter",
      "height",
      "roof type",
      "previous inspection",
    ],
    formatPatterns: [
      {
        patternId: "kbfp_general_info_two_column",
        patternType: "two_column_fact_table",
        instruction: "Use a compact two-column fact table and keep narrative commentary outside the fact block.",
      },
    ],
  },
  "inspection-report": {
    sectionKey: "inspection-report",
    preferredPageStart: 7,
    preferredFamilies: ["shell-internal", "internal-external", "internal"],
    queryTerms: [
      "inspection report",
      "shell strake",
      "internal loss",
      "defect",
      "corrosion",
      "thickness",
      "visual inspection",
      "ut",
    ],
    formatPatterns: [
      {
        patternId: "kbfp_inspection_threshold_bullets",
        patternType: "inspection_threshold_bullets",
        instruction: "Use concise finding groups and threshold-style bullets where the sample family uses strake or component acceptance thresholds.",
      },
    ],
  },
  "repair-recommendations": {
    sectionKey: "repair-recommendations",
    preferredPageStart: 12,
    preferredFamilies: ["shell-internal", "internal-external", "post-repair", "repair-consultation"],
    queryTerms: [
      "repair recommendations",
      "api 653",
      "assessment",
      "off-line",
      "on-line",
      "repair",
      "recommend",
    ],
    formatPatterns: [
      {
        patternId: "kbfp_recommendation_offline_online",
        patternType: "recommendation_heading_split",
        instruction: "Use separate OFF-LINE and ON-LINE headings with concise action bullets when the evidence supports both categories.",
      },
    ],
  },
  photographs: {
    sectionKey: "photographs",
    preferredPageStart: 13,
    preferredFamilies: ["shell-internal", "internal-external", "internal", "external"],
    queryTerms: [
      "photographs",
      "photo",
      "caption",
      "shell internal",
      "repair",
      "finding",
    ],
    formatPatterns: [
      {
        patternId: "kbfp_photo_caption_pages",
        patternType: "photo_caption_pages",
        instruction: "Use compact photo captions and sample report photo-page ordering.",
      },
    ],
  },
  "findings-mpi-horizontal-weld-7": {
    sectionKey: "layout-sketches",
    preferredPageStart: 14,
    preferredFamilies: ["shell-internal", "mpi-shell-repairs", "internal-external"],
    exactPhrases: ["horizontal weld 7"],
    queryTerms: [
      "findings",
      "mpi",
      "locations",
      "shell internal",
      "horizontal weld",
      "sketch",
      "plate",
      "legend",
      "drawing",
    ],
    formatPatterns: [
      {
        patternId: "kbfp_layout_title_block",
        patternType: "layout_title_block",
        instruction: "Keep sketch pages controlled with a clear title, legend, drawing block, compass/reference, and finding marker labels.",
      },
    ],
    layoutPatterns: [
      {
        patternId: "kblp_shell_plate_grid",
        patternType: "shell_plate_grid",
        instruction: "Preserve imported plate/course geometry and apply user edits only as report-side override patches.",
      },
    ],
  },
  "findings-mpi-horizontal-weld-6": {
    sectionKey: "layout-sketches",
    preferredPageStart: 15,
    preferredFamilies: ["shell-internal", "mpi-shell-repairs", "internal-external"],
    exactPhrases: ["horizontal weld 6"],
    queryTerms: [
      "findings",
      "mpi",
      "locations",
      "shell internal",
      "horizontal weld 6",
      "sketch",
      "plate",
      "legend",
      "drawing",
    ],
    formatPatterns: [
      {
        patternId: "kbfp_layout_title_block",
        patternType: "layout_title_block",
        instruction: "Keep sketch pages controlled with a clear title, legend, drawing block, compass/reference, and finding marker labels.",
      },
    ],
    layoutPatterns: [
      {
        patternId: "kblp_shell_plate_grid",
        patternType: "shell_plate_grid",
        instruction: "Preserve imported plate/course geometry and apply user edits only as report-side override patches.",
      },
    ],
  },
  "findings-mpi-horizontal-weld-5": {
    sectionKey: "layout-sketches",
    preferredPageStart: 16,
    preferredFamilies: ["shell-internal", "mpi-shell-repairs", "internal-external"],
    exactPhrases: ["horizontal weld 5"],
    queryTerms: [
      "findings",
      "mpi",
      "locations",
      "shell internal",
      "horizontal weld 5",
      "sketch",
      "plate",
      "legend",
      "drawing",
    ],
    formatPatterns: [
      {
        patternId: "kbfp_layout_title_block",
        patternType: "layout_title_block",
        instruction: "Keep sketch pages controlled with a clear title, legend, drawing block, compass/reference, and finding marker labels.",
      },
    ],
    layoutPatterns: [
      {
        patternId: "kblp_shell_plate_grid",
        patternType: "shell_plate_grid",
        instruction: "Preserve imported plate/course geometry and apply user edits only as report-side override patches.",
      },
    ],
  },
  "findings-mpi-horizontal-weld-4": {
    sectionKey: "layout-sketches",
    preferredPageStart: 17,
    preferredFamilies: ["shell-internal", "mpi-shell-repairs", "internal-external"],
    exactPhrases: ["horizontal weld 4"],
    queryTerms: [
      "findings",
      "mpi",
      "locations",
      "shell internal",
      "horizontal weld 4",
      "sketch",
      "plate",
      "legend",
      "drawing",
    ],
    formatPatterns: [
      {
        patternId: "kbfp_layout_title_block",
        patternType: "layout_title_block",
        instruction: "Keep sketch pages controlled with a clear title, legend, drawing block, compass/reference, and finding marker labels.",
      },
    ],
    layoutPatterns: [
      {
        patternId: "kblp_shell_plate_grid",
        patternType: "shell_plate_grid",
        instruction: "Preserve imported plate/course geometry and apply user edits only as report-side override patches.",
      },
    ],
  },
  "findings-mpi-horizontal-weld-3": {
    sectionKey: "layout-sketches",
    preferredPageStart: 18,
    preferredFamilies: ["shell-internal", "mpi-shell-repairs", "internal-external"],
    exactPhrases: ["horizontal weld 3"],
    queryTerms: [
      "findings",
      "mpi",
      "locations",
      "shell internal",
      "horizontal weld 3",
      "sketch",
      "plate",
      "legend",
      "drawing",
    ],
    formatPatterns: [
      {
        patternId: "kbfp_layout_title_block",
        patternType: "layout_title_block",
        instruction: "Keep sketch pages controlled with a clear title, legend, drawing block, compass/reference, and finding marker labels.",
      },
    ],
    layoutPatterns: [
      {
        patternId: "kblp_shell_plate_grid",
        patternType: "shell_plate_grid",
        instruction: "Preserve imported plate/course geometry and apply user edits only as report-side override patches.",
      },
    ],
  },
  "findings-mpi-shell-external-curb-angle-welds-horizontal-weld-6": {
    sectionKey: "layout-sketches",
    preferredPageStart: 19,
    preferredFamilies: ["shell-internal", "mpi-shell-repairs", "internal-external"],
    exactPhrases: ["shell external", "curb angle welds", "horizontal weld 6"],
    queryTerms: [
      "findings",
      "mpi",
      "locations",
      "shell external",
      "curb angle welds",
      "horizontal weld 6",
      "sketch",
      "plate",
      "legend",
      "drawing",
    ],
    formatPatterns: [
      {
        patternId: "kbfp_layout_title_block",
        patternType: "layout_title_block",
        instruction: "Keep sketch pages controlled with a clear title, legend, drawing block, compass/reference, and finding marker labels.",
      },
    ],
    layoutPatterns: [
      {
        patternId: "kblp_shell_plate_grid",
        patternType: "shell_plate_grid",
        instruction: "Preserve imported plate/course geometry and apply user edits only as report-side override patches.",
      },
    ],
  },
  "attachment-mpi-report": {
    sectionKey: "attachment-mpi-report",
    preferredPageStart: 20,
    preferredFamilies: ["mpi-shell-repairs", "shell-internal", "internal-external"],
    queryTerms: [
      "magnetic particle",
      "mpi",
      "attachment",
      "technician",
      "report",
      "acceptance",
      "result",
    ],
    formatPatterns: [
      {
        patternId: "kbfp_attachment_form_block",
        patternType: "attachment_form_block",
        instruction: "Treat attachment pages as form-style evidence with explicit technician, method, result, and sign-off fields.",
      },
    ],
  },
  "attachment-mpi-photographs": {
    sectionKey: "photographs",
    preferredPageStart: 34,
    preferredFamilies: ["mpi-shell-repairs", "shell-internal", "internal-external"],
    exactPhrases: ["photographs", "photo 1", "photo 2"],
    queryTerms: [
      "magnetic particles inspection photographs",
      "mpi photographs",
      "attachment",
      "photo",
      "repair weld",
      "result",
    ],
    formatPatterns: [
      {
        patternId: "kbfp_attachment_photo_pages",
        patternType: "attachment_photo_pages",
        instruction: "Use formal MPI photograph attachment pages after the structured MPI form pages.",
      },
    ],
  },
};

const API_STANDARD_SECTION_PROFILES = buildApiStandardSectionProfiles();
const EFFECTIVE_SECTION_PROFILES = {
  ...SECTION_PROFILES,
  ...API_STANDARD_SECTION_PROFILES,
  cover: {
    ...SECTION_PROFILES.cover,
    preferredPageStart: 1,
    preferredFamilies: ["internal-external", "shell-internal", "internal", "external"],
  },
};

function buildApiStandardSectionProfiles() {
  return Object.fromEntries(
    API_STANDARD_REPORT_TOC.map((section) => {
      const baseTerms = [
        section.title,
        section.shortLabel,
        "API 653",
        "internal external inspection report",
        "vertical aboveground storage tank",
      ];
      const profile = {
        sectionKey: section.id,
        preferredPageStart: section.pageStart,
        preferredFamilies: ["internal-external", "shell-internal", "internal", "external"],
        exactPhrases: [section.title],
        queryTerms: baseTerms,
        formatPatterns: [
          {
            patternId: `kbfp_api653_${section.id}`,
            patternType: `${section.kind}_api653_section_format`,
            instruction: `Follow the ${API_STANDARD_PRIMARY_REPORT.reference} section heading, ordering, and page-block style for "${section.title}".`,
          },
        ],
      };

      if (section.kind === "map") {
        profile.layoutPatterns = [
          {
            patternId: `kblp_api653_${section.id}`,
            patternType: `${section.layoutSurface ?? "tank"}_layout_page`,
            instruction:
              "Use the precedent only for drawing/page layout conventions. Source geometry must come from Android export data or approved report-side map inputs.",
          },
        ];
      }

      return [section.id, profile];
    }),
  );
}

const COVER_DETECTOR = {
  sectionKey: "cover",
  chunkType: "heading_block",
  patterns: [/inspection\s+report/i, /report\s+reference/i],
};

const FRONT_MATTER_DETECTOR = {
  sectionKey: "cover",
  chunkType: "heading_block",
  patterns: [/customer:/i, /contact\s+person:/i, /prepared\s+by:/i, /reviewed\s+by:/i, /report\s+no\.:/i],
};

const SECTION_DETECTORS = [
  {
    sectionKey: "scope-of-inspection",
    chunkType: "section_intro",
    patterns: [/scope\s+of\s+inspection/i],
  },
  {
    sectionKey: "inspection-maintenance-regime",
    chunkType: "paragraph_block",
    patterns: [/inspection\s+and\s+maintenance\s+regime/i],
  },
  {
    sectionKey: "general-tank-information",
    chunkType: "fact_table",
    patterns: [/general\s+tank\s+information/i, /tank\s+information/i],
  },
  {
    sectionKey: "inspection-report",
    chunkType: "paragraph_block",
    patterns: [/inspection\s+report/i, /shell\s+strake/i, /internal\s+loss/i, /visual\s+inspection/i],
  },
  {
    sectionKey: "repair-recommendations",
    chunkType: "recommendation_group",
    patterns: [/repair\s+recommendations/i, /api\s*653\s+assessment/i, /\boff-?line\b/i, /\bon-?line\b/i],
  },
  {
    sectionKey: "photographs",
    chunkType: "photo_caption_group",
    patterns: [/photographs?/i, /photogrpahs/i, /photo\s+no/i],
  },
  {
    sectionKey: "attachment-mpi-report",
    chunkType: "attachment_form_block",
    patterns: [/magnetic\s+particle\s+test\s+report/i, /magnetic\s+particle\s+inspection\s+report/i, /magnetic\s+particle/i],
  },
  {
    sectionKey: "layout-sketches",
    chunkType: "layout_legend",
    patterns: [/findings.*mpi.*locations/i, /horizontal\s+weld/i, /layout\s+sketch/i, /\bsketch\b/i, /\blegend\b/i],
  },
  {
    sectionKey: "settlement",
    chunkType: "calculation_summary",
    patterns: [/settlement\s+survey/i, /floor\s+and\s+edge\s+settlement/i],
  },
  {
    sectionKey: "calibration",
    chunkType: "attachment_form_block",
    patterns: [/calibration\s+report/i],
  },
];

export function getPrecedentKbStatus({ indexPath = defaultIndexPath } = {}) {
  const index = readIndex(indexPath);
  if (!index) {
    return {
      configured: true,
      built: false,
      indexPath,
      sampleReportsDir: defaultSampleReportsDir,
      standardsCodesDir: defaultStandardsCodesDir,
      documentCount: 0,
      sampleReportCount: 0,
      standardsDocumentCount: 0,
      chunkCount: 0,
      pageCount: 0,
      errors: [],
    };
  }

  return {
    configured: true,
    built: true,
    schemaVersion: index.schemaVersion,
    builtAtIso: index.builtAtIso,
    indexPath,
    sampleReportsDir: index.sampleReportsDir,
    standardsCodesDir: index.standardsCodesDir ?? defaultStandardsCodesDir,
    documentCount: index.documents.length,
    sampleReportCount: index.documents.filter((document) => document.sourceType === "sample_pdf").length,
    standardsDocumentCount: index.documents.filter((document) => document.sourceType === "code_pdf").length,
    chunkCount: index.chunks.length,
    pageCount: index.pageCount,
    errors: index.errors ?? [],
  };
}

export function rebuildPrecedentKbIndex({
  sampleReportsDir = defaultSampleReportsDir,
  standardsCodesDir = defaultStandardsCodesDir,
  indexPath = defaultIndexPath,
  onDocument,
} = {}) {
  if (!existsSync(sampleReportsDir)) {
    throw new Error(`Sample report folder was not found: ${sampleReportsDir}`);
  }
  if (!existsSync(standardsCodesDir)) {
    throw new Error(`Standards/code folder was not found: ${standardsCodesDir}`);
  }

  mkdirSync(dirname(indexPath), { recursive: true });

  const pdfSources = [
    ...listPdfSources(sampleReportsDir, "sample_pdf"),
    ...listPdfSources(standardsCodesDir, "code_pdf"),
  ];

  const documents = [];
  const chunks = [];
  const errors = [];
  let pageCount = 0;

  for (const source of pdfSources) {
    try {
      onDocument?.({
        sourcePath: source.sourcePath,
        fileName: basename(source.sourcePath),
        sourceType: source.sourceType,
        status: "started",
      });
      const document = buildDocumentRecord(source);
      const pages = extractPdfPages(source.sourcePath);
      const documentChunks = buildChunksForDocument(document, pages);

      documents.push({
        ...document,
        pageCount: pages.length,
        chunkCount: documentChunks.length,
      });
      chunks.push(...documentChunks);
      pageCount += pages.length;
      onDocument?.({
        sourcePath: source.sourcePath,
        fileName: basename(source.sourcePath),
        sourceType: source.sourceType,
        status: "completed",
        pageCount: pages.length,
        chunkCount: documentChunks.length,
      });
    } catch (error) {
      errors.push({
        sourcePath: source.sourcePath,
        sourceType: source.sourceType,
        message: error instanceof Error ? error.message : "Unknown PDF ingestion failure.",
      });
      onDocument?.({
        sourcePath: source.sourcePath,
        fileName: basename(source.sourcePath),
        sourceType: source.sourceType,
        status: "failed",
        message: error instanceof Error ? error.message : "Unknown PDF ingestion failure.",
      });
    }
  }

  const index = {
    schemaVersion: INDEX_SCHEMA_VERSION,
    builtAtIso: new Date().toISOString(),
    sampleReportsDir,
    standardsCodesDir,
    documentCount: documents.length,
    pageCount,
    chunkCount: chunks.length,
    documents,
    chunks,
    errors,
  };

  onDocument?.({
    fileName: basename(indexPath),
    sourcePath: indexPath,
    status: "writing_index",
    chunkCount: chunks.length,
    pageCount,
  });
  const tempIndexPath = `${indexPath}.tmp`;
  writeFileSync(tempIndexPath, JSON.stringify(index));
  renameSync(tempIndexPath, indexPath);
  onDocument?.({
    fileName: basename(indexPath),
    sourcePath: indexPath,
    status: "completed_index",
    chunkCount: chunks.length,
    pageCount,
  });
  return index;
}

export function searchPrecedentPack({
  sectionId,
  reportState,
  indexPath = defaultIndexPath,
  allowBuild = true,
  limit = 5,
} = {}) {
  const index = loadOrBuildIndex({ indexPath, allowBuild });
  const profile = EFFECTIVE_SECTION_PROFILES[sectionId] ?? buildDefaultSectionProfile(sectionId);
  const queryTerms = buildQueryTerms(profile, reportState);
  const blockedSourceNames = buildBlockedPrecedentSourceNames(reportState);
  const excludedSourceChunks = index.chunks.filter((chunk) =>
    chunk.sourceType !== "code_pdf" && isBlockedPrecedentSource(chunk, blockedSourceNames),
  );
  const approvedChunks = index.chunks
    .filter((chunk) => chunk.approvalStatus === "approved_for_retrieval")
    .filter((chunk) => chunk.sourceType === "code_pdf" || !isBlockedPrecedentSource(chunk, blockedSourceNames));
  const scoredCandidates = approvedChunks
    .filter((chunk) => chunk.sourceType !== "code_pdf")
    .map((chunk) => ({
      chunk,
      score: scoreChunk(chunk, profile, queryTerms),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit * 4);
  const scoredChunks = [
    ...scoredCandidates.filter((candidate) => candidate.chunk.sectionKey === profile.sectionKey),
    ...scoredCandidates.filter((candidate) => candidate.chunk.sectionKey !== profile.sectionKey),
  ].slice(0, limit);
  const standardsCandidates = approvedChunks
    .filter((chunk) => chunk.sourceType === "code_pdf")
    .map((chunk) => ({
      chunk,
      score: scoreStandardsChunk(chunk, profile, queryTerms),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);

  const wordingPrecedents = scoredChunks.slice(0, 3).map(({ chunk, score }) => ({
    chunkId: chunk.chunkId,
    key: chunk.chunkId,
    sourceReportName: chunk.sourceReportName,
    reportFamily: chunk.reportFamily,
    sectionKey: chunk.sectionKey,
    chunkType: chunk.chunkType,
    pageStart: chunk.pageStart,
    pageEnd: chunk.pageEnd,
    excerpt: chunk.excerpt,
    score: roundScore(score),
    reason: buildSelectionReason(chunk, profile),
  }));
  const standardsReferences = standardsCandidates.map(({ chunk, score }) => ({
    chunkId: chunk.chunkId,
    key: chunk.chunkId,
    sourceReportName: chunk.sourceReportName,
    reportFamily: chunk.reportFamily,
    sectionKey: chunk.sectionKey,
    chunkType: chunk.chunkType,
    pageStart: chunk.pageStart,
    pageEnd: chunk.pageEnd,
    excerpt: chunk.excerpt.slice(0, 900),
    score: roundScore(score),
    reason: buildStandardsSelectionReason(chunk, profile),
    usageRule:
      "Use as standards/compliance guidance only. Do not copy code text verbatim into the report; summarize, cite source/page, and require reviewer approval.",
  }));

  return {
    sectionKey: sectionId,
    canonicalSectionKey: profile.sectionKey,
    reportFamily: API_STANDARD_PRIMARY_REPORT.reportFamily,
    retrievalRunId: `kbrr_${randomUUID()}`,
    retrievalMode: "local_lexical_precedent_index",
    indexBuiltAtIso: index.builtAtIso,
    sampleReportsDir: index.sampleReportsDir,
    documentsSearched: index.documents.length,
    chunksSearched: index.chunks.length,
    blockedSourceNames: [...blockedSourceNames],
    excludedSourceChunkCount: excludedSourceChunks.length,
    queryTerms,
    wordingPrecedents,
    standardsReferences,
    formatPatterns: profile.formatPatterns ?? [],
    layoutPatterns: profile.layoutPatterns ?? [],
    constraints: [
      "Do not copy old report facts into the current report.",
      "Use Android export facts and report-side inputs as authoritative current facts.",
      `Use ${API_STANDARD_PRIMARY_REPORT.reference} as the primary API-standard format precedent when available.`,
      "The current inspection is for a vertical aboveground storage tank.",
      "Do not use any retrieved horizontal tank wording unless it refers only to horizontal weld orientation.",
      "List missing current facts as open questions or Pending confirmation.",
      "Use precedent only for wording style, structure, formatting, and layout conventions.",
      "Do not retrieve from the current mock/gold report for answer generation; same-report sources are blocked before scoring.",
      "Same-customer historical reports from different report jobs may be used as historical/reference context, but old facts must not be treated as current facts unless confirmed by the current export or manual report-side input.",
    ],
    warnings: buildRetrievalWarnings(index, wordingPrecedents, excludedSourceChunks),
  };
}

export function buildPrecedentAudit({
  reportState,
  sectionIds = Object.keys(EFFECTIVE_SECTION_PROFILES),
  indexPath = defaultIndexPath,
  allowBuild = true,
} = {}) {
  const sections = sectionIds.map((sectionId) => {
    const pack = searchPrecedentPack({
      sectionId,
      reportState,
      indexPath,
      allowBuild,
      limit: 8,
    });

    return {
      sectionId,
      canonicalSectionKey: pack.canonicalSectionKey,
      topSources: pack.wordingPrecedents.map((precedent) => ({
        sourceReportName: precedent.sourceReportName,
        pageStart: precedent.pageStart,
        pageEnd: precedent.pageEnd,
        sectionKey: precedent.sectionKey,
        chunkType: precedent.chunkType,
        score: precedent.score,
        excerptPreview: precedent.excerpt.slice(0, 260),
      })),
      standardsReferences: pack.standardsReferences.map((reference) => ({
        sourceReportName: reference.sourceReportName,
        pageStart: reference.pageStart,
        pageEnd: reference.pageEnd,
        sectionKey: reference.sectionKey,
        chunkType: reference.chunkType,
        score: reference.score,
        usageRule: reference.usageRule,
        excerptPreview: reference.excerpt.slice(0, 220),
      })),
      formatPatterns: pack.formatPatterns.map((pattern) => pattern.patternType),
      layoutPatterns: pack.layoutPatterns.map((pattern) => pattern.patternType),
      warnings: pack.warnings,
      blockedSourceNames: pack.blockedSourceNames,
      excludedSourceChunkCount: pack.excludedSourceChunkCount,
    };
  });

  return {
    auditRunId: `kbaud_${randomUUID()}`,
    createdAtIso: new Date().toISOString(),
    targetReportReference: reportState?.manualSupplement?.reportReference
      ?? reportState?.exportPackage?.inspectionReference
      ?? null,
    sections,
  };
}

export function buildFlatRetrievalContext(precedentPack) {
  const wordingItems = (precedentPack.wordingPrecedents ?? []).map((precedent) => ({
    key: precedent.chunkId,
    title: `${precedent.sourceReportName} p.${precedent.pageStart}`,
    guidance: [
      "Approved historical/format precedent from a different report job.",
      "Use for report structure, wording cadence, formatting conventions, and compatible historical context only.",
      "Do not copy old report facts into the current report unless the current LAIQ app export or report-side user input confirms them.",
      "",
      precedent.excerpt,
    ].join("\n"),
    sourceReportName: precedent.sourceReportName,
    pageStart: precedent.pageStart,
    pageEnd: precedent.pageEnd,
    sectionKey: precedent.sectionKey,
    chunkType: precedent.chunkType,
    score: precedent.score,
  }));
  const formatItems = (precedentPack.formatPatterns ?? []).map((pattern) => ({
    key: pattern.patternId,
    title: pattern.patternType,
    guidance: pattern.instruction,
    chunkType: "format_pattern",
  }));
  const layoutItems = (precedentPack.layoutPatterns ?? []).map((pattern) => ({
    key: pattern.patternId,
    title: pattern.patternType,
    guidance: pattern.instruction,
    chunkType: "layout_pattern",
  }));
  const standardsItems = (precedentPack.standardsReferences ?? []).map((reference) => ({
    key: reference.chunkId,
    title: `${reference.sourceReportName} p.${reference.pageStart}`,
    guidance: `${reference.usageRule}\n\nReference excerpt for internal grounding only:\n${reference.excerpt}`,
    sourceReportName: reference.sourceReportName,
    pageStart: reference.pageStart,
    pageEnd: reference.pageEnd,
    sectionKey: reference.sectionKey,
    chunkType: "standards_reference",
    score: reference.score,
  }));

  return [...wordingItems, ...standardsItems, ...formatItems, ...layoutItems];
}

function loadOrBuildIndex({ indexPath, allowBuild }) {
  const existing = readIndex(indexPath);
  if (existing) {
    return existing;
  }

  if (!allowBuild) {
    return {
      schemaVersion: INDEX_SCHEMA_VERSION,
      builtAtIso: null,
      sampleReportsDir: defaultSampleReportsDir,
      standardsCodesDir: defaultStandardsCodesDir,
      documentCount: 0,
      pageCount: 0,
      chunkCount: 0,
      documents: [],
      chunks: [],
      errors: [],
    };
  }

  return rebuildPrecedentKbIndex({ indexPath });
}

function listPdfSources(sourceRoot, sourceType) {
  return readdirSync(sourceRoot)
    .filter((fileName) => fileName.toLowerCase().endsWith(".pdf"))
    .sort((left, right) => left.localeCompare(right))
    .map((fileName) => ({
      sourcePath: join(sourceRoot, fileName),
      sourceRoot,
      sourceType,
    }));
}

function readIndex(indexPath) {
  if (!existsSync(indexPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(indexPath, "utf8"));
    if (parsed?.schemaVersion !== INDEX_SCHEMA_VERSION || !Array.isArray(parsed.chunks)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function buildDocumentRecord({ sourcePath, sourceRoot, sourceType }) {
  const fileName = basename(sourcePath);
  const stats = statSync(sourcePath);
  const classification = sourceType === "code_pdf"
    ? classifyCodeDocument(fileName)
    : classifyReport(fileName);

  return {
    documentId: `kbd_${stableHash(fileName).slice(0, 16)}`,
    sourceReportName: fileName.replace(/\.pdf$/i, ""),
    fileName,
    sourcePath,
    sourceRelativePath: sourcePath.startsWith(sourceRoot)
      ? sourcePath.slice(sourceRoot.length + 1)
      : fileName,
    sourceType,
    tenantId: "platform",
    workspaceId: sourceType === "code_pdf" ? "platform-codes-library" : "platform-library",
    visibilityScope: sourceType === "code_pdf" ? "platform_codes_library" : "platform_library",
    approvalStatus: "approved_for_retrieval",
    redactionStatus: sourceType === "code_pdf" ? "code_reference" : "sample_corpus",
    reportFamily: classification.reportFamily,
    inspectionType: classification.inspectionType,
    tankType: classification.tankType,
    appendixTypes: classification.appendixTypes,
    fileSizeBytes: stats.size,
    modifiedAtIso: stats.mtime.toISOString(),
    qualityScore: classification.qualityScore,
  };
}

function extractPdfPages(sourcePath) {
  const rawText = execFileSync("pdftotext", ["-layout", "-enc", "UTF-8", sourcePath, "-"], {
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024,
  });

  return rawText
    .split("\f")
    .map((pageText, index) => ({
      pageNumber: index + 1,
      text: normalizeExtractedText(pageText),
    }))
    .filter((page) => page.text.length > 0);
}

function buildChunksForDocument(document, pages) {
  const chunks = [];
  let activeSectionKey = inferDefaultSectionKey(document);

  for (const page of pages) {
    const isToc = looksLikeTableOfContents(page.text);
    const tocSection = isToc ? null : getApiStandardTocSectionForPage(document, page.pageNumber);
    const detectedSections = tocSection
      ? [{
          sectionKey: tocSection.id,
          chunkType: inferApiStandardChunkType(tocSection),
          patterns: [new RegExp(escapeRegExp(tocSection.title), "i")],
        }]
      : isToc
        ? []
        : detectSectionKeys(page.text);
    if (!isToc && page.pageNumber === 1) {
      detectedSections.unshift(COVER_DETECTOR);
    }
    if (!isToc && page.pageNumber <= 2 && /customer:/i.test(page.text) && /prepared\s+by:/i.test(page.text)) {
      detectedSections.unshift(FRONT_MATTER_DETECTOR);
    }
    if (detectedSections.length > 0) {
      activeSectionKey = detectedSections[0].sectionKey;
    }

    const detector = detectedSections[0] ?? {
      sectionKey: activeSectionKey,
      chunkType: inferChunkType(activeSectionKey),
    };
    chunks.push(buildChunkRecord({
      document,
      page,
      sectionKey: detector.sectionKey,
      chunkType: isToc ? "toc" : detector.chunkType,
      excerpt: buildExcerpt(page.text, detector.patterns),
      sequence: chunks.length + 1,
      qualityPenalty: isToc ? 0.55 : 0,
    }));

  }

  return chunks;
}

function buildChunkRecord({
  document,
  page,
  sectionKey,
  chunkType,
  excerpt,
  sequence,
  qualityPenalty = 0,
}) {
  const chunkSeed = `${document.documentId}:${page.pageNumber}:${sectionKey}:${chunkType}:${sequence}`;
  const qualityScore = Math.max(0.2, document.qualityScore - qualityPenalty);

  return {
    chunkId: `kbc_${stableHash(chunkSeed).slice(0, 18)}`,
    documentId: document.documentId,
    sourceReportName: document.sourceReportName,
    sourcePath: document.sourcePath,
    sourceType: document.sourceType,
    tenantId: document.tenantId,
    workspaceId: document.workspaceId,
    visibilityScope: document.visibilityScope,
    approvalStatus: document.approvalStatus,
    redactionStatus: document.redactionStatus,
    reportFamily: document.reportFamily,
    inspectionType: document.inspectionType,
    tankType: document.tankType,
    sectionKey,
    chunkType,
    pageStart: page.pageNumber,
    pageEnd: page.pageNumber,
    excerpt,
    qualityScore: roundScore(qualityScore),
    searchText: tokenizeSearchText([
      document.sourceReportName,
      document.reportFamily,
      document.inspectionType,
      sectionKey,
      chunkType,
      excerpt,
    ].join(" ")),
  };
}

function classifyReport(fileName) {
  const lowerName = fileName.toLowerCase();

  if (lowerName.includes("fieldsheet")) {
    return buildClassification("fieldsheet-fullscope", "checklist-fieldsheet", ["checklist"], 0.88);
  }
  if (lowerName.includes("mpi") || lowerName.includes("shell repairs")) {
    return buildClassification("mpi-shell-repairs", "mpi-repair", ["mpi"], 0.9);
  }
  if (lowerName.includes("3d scan")) {
    return buildClassification("floor-3d-scan", "floor-scan", ["floor-scan"], 0.88);
  }
  if (lowerName.includes("settlement")) {
    return buildClassification("settlement-survey", "floor-edge-settlement", ["settlement"], 0.88);
  }
  if (lowerName.includes("calibration")) {
    return buildClassification("calibration", "calibration", ["calibration"], 0.86);
  }
  if (lowerName.includes("consultation") || lowerName.includes("review on repairs")) {
    return buildClassification("repair-consultation", "repair-review", ["repair-review"], 0.86);
  }
  if (lowerName.includes("post repair")) {
    return buildClassification("post-repair", "post-repair", ["repair"], 0.88);
  }
  if (lowerName.includes("shell internal")) {
    return buildClassification("shell-internal", "shell-internal", ["layout-sketches", "mpi"], 0.95);
  }
  if (lowerName.includes("internal & external") || lowerName.includes("internal and external")) {
    return buildClassification("internal-external", "internal-external", ["photos", "attachments"], 0.9);
  }
  if (lowerName.includes("in-service")) {
    return buildClassification("in-service", "in-service", ["photos"], 0.86);
  }
  if (lowerName.includes("external")) {
    return buildClassification("external", "external", ["photos"], 0.84);
  }
  if (lowerName.includes("internal")) {
    return buildClassification("internal", "internal", ["photos", "attachments"], 0.84);
  }
  if (lowerName.includes("survey")) {
    return buildClassification("survey", "survey", ["survey"], 0.82);
  }

  return buildClassification("general-report", "general", [], 0.75);
}

function classifyCodeDocument(fileName) {
  const lowerName = fileName.toLowerCase();

  if (lowerName.includes("api 653")) {
    return buildClassification("api-653-code", "tank-inspection-standard", ["api-653"], 0.96);
  }
  if (lowerName.includes("api std 650") || lowerName.includes("api 650")) {
    return buildClassification("api-650-code", "tank-design-standard", ["api-650"], 0.92);
  }
  if (lowerName.includes("api 620")) {
    return buildClassification("api-620-code", "tank-design-standard", ["api-620"], 0.88);
  }
  if (lowerName.includes("api 651")) {
    return buildClassification("api-651-code", "cathodic-protection-standard", ["api-651"], 0.88);
  }
  if (lowerName.includes("api 652")) {
    return buildClassification("api-652-code", "tank-lining-standard", ["api-652"], 0.88);
  }
  if (lowerName.includes("api 575")) {
    return buildClassification("api-575-code", "inspection-practices", ["api-575"], 0.88);
  }
  if (lowerName.includes("api 577")) {
    return buildClassification("api-577-code", "welding-inspection", ["api-577"], 0.86);
  }
  if (lowerName.includes("eemua")) {
    return buildClassification("eemua-159-code", "tank-inspection-standard", ["eemua-159"], 0.9);
  }
  if (lowerName.includes("sti sp001")) {
    return buildClassification("sti-sp001-code", "shop-fabricated-tank-standard", ["sti-sp001"], 0.86);
  }
  if (lowerName.includes("astm")) {
    return buildClassification("astm-code", "material-test-standard", ["astm"], 0.82);
  }
  if (lowerName.includes("as 1692")) {
    return buildClassification("as-1692-code", "flammable-liquid-tank-standard", ["as-1692"], 0.82);
  }

  return buildClassification("standards-code", "standards-reference", ["code-reference"], 0.78);
}

function buildClassification(reportFamily, inspectionType, appendixTypes, qualityScore) {
  return {
    reportFamily,
    inspectionType,
    tankType: "aboveground-storage-tank",
    appendixTypes,
    qualityScore,
  };
}

function looksLikeTableOfContents(text) {
  const lowerText = text.toLowerCase();
  const topWindow = lowerText.slice(0, 1400);
  if (/(^|\n)\s*table\s+of\s+contents\s*($|\n)/i.test(topWindow)) {
    return true;
  }

  const dotLeaderRows = text
    .split("\n")
    .slice(0, 55)
    .filter((line) => /^\s*(\d+|attachment)\b/i.test(line) && /\.{4,}/.test(line))
    .length;

  return dotLeaderRows >= 3;
}

function detectSectionKeys(text) {
  return SECTION_DETECTORS.filter((detector) =>
    detector.patterns.some((pattern) => pattern.test(text)),
  );
}

function inferDefaultSectionKey(document) {
  if (document.reportFamily === "fieldsheet-fullscope") return "fieldsheet";
  if (document.reportFamily === "settlement-survey") return "settlement";
  if (document.reportFamily === "calibration") return "calibration";
  if (document.reportFamily === "mpi-shell-repairs") return "attachment-mpi-report";
  return "inspection-report";
}

function inferChunkType(sectionKey) {
  const detector = SECTION_DETECTORS.find((item) => item.sectionKey === sectionKey);
  return detector?.chunkType ?? "paragraph_block";
}

function inferApiStandardChunkType(section) {
  if (section.kind === "map") return "layout_page";
  if (section.kind === "structured") return "fact_table";
  if (section.kind === "attachment") return "photo_caption_group";
  return "paragraph_block";
}

function buildExcerpt(text, patterns = []) {
  const cleanedText = normalizeExtractedText(text);
  const firstMatch = patterns
    .map((pattern) => cleanedText.search(pattern))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];
  const startIndex = Math.max(0, (firstMatch ?? 0) - 220);
  const excerpt = cleanedText.slice(startIndex, startIndex + MAX_EXCERPT_LENGTH).trim();
  return excerpt.length < cleanedText.length ? `${excerpt} ...` : excerpt;
}

function buildDefaultSectionProfile(sectionId) {
  const normalized = sectionId.replace(/[-_]/g, " ");
  return {
    sectionKey: sectionId,
    preferredFamilies: ["internal-external", "shell-internal", "internal"],
    queryTerms: [normalized],
    formatPatterns: [],
    layoutPatterns: [],
  };
}

function buildQueryTerms(profile, reportState) {
  const exportPackage = reportState?.exportPackage;
  const reportClassification = reportState?.reportClassification;
  const importedTerms = [
    exportPackage?.task?.client,
    exportPackage?.task?.tankNumber,
    exportPackage?.inspectionRecord?.location,
    exportPackage?.inspectionRecord?.externalRoofType,
    exportPackage?.inspectionRecord?.referenceMode,
    reportClassification?.reportFamilyLabel,
    reportClassification?.inspectionMode,
    reportClassification?.tankType,
    ...(reportClassification?.primaryCodes ?? []).map((code) => code.label),
    ...(reportClassification?.supportingCodes ?? []).map((code) => code.label),
  ].filter(Boolean);

  return dedupe([
    ...profile.queryTerms,
    ...importedTerms,
  ].flatMap((term) => tokenize(term)));
}

const DEFAULT_MOCK_GOLD_SOURCE_NAMES = [
  "22PE1-4 TK V10 Internal & External Inspection Report",
];

function buildBlockedPrecedentSourceNames(reportState) {
  const exportPackage = reportState?.exportPackage;
  const manualSupplement = reportState?.manualSupplement ?? {};
  const blocked = new Set();
  const addBlocked = (value) => {
    const normalized = normalizeSourceName(value);
    if (normalized) blocked.add(normalized);
  };

  [
    ...(Array.isArray(manualSupplement.excludedPrecedentSources) ? manualSupplement.excludedPrecedentSources : []),
    ...(Array.isArray(exportPackage?.excludedPrecedentSources) ? exportPackage.excludedPrecedentSources : []),
    ...(Array.isArray(exportPackage?.knowledgeBaseExclusions) ? exportPackage.knowledgeBaseExclusions : []),
    manualSupplement.reportReference,
    exportPackage?.inspectionReference,
  ].forEach(addBlocked);

  if (isV10MockTrainingPackage(exportPackage)) {
    DEFAULT_MOCK_GOLD_SOURCE_NAMES.forEach(addBlocked);
  }

  return blocked;
}

function isV10MockTrainingPackage(exportPackage) {
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

function isBlockedPrecedentSource(chunk, blockedSourceNames) {
  if (!blockedSourceNames?.size) return false;
  const sourceName = normalizeSourceName(chunk.sourceReportName);
  return [...blockedSourceNames].some((blockedSourceName) =>
    sourceName === blockedSourceName ||
    sourceName.includes(blockedSourceName) ||
    blockedSourceName.includes(sourceName),
  );
}

function normalizeSourceName(value) {
  return String(value ?? "")
    .replace(/\.pdf$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function scoreChunk(chunk, profile, queryTerms) {
  let score = 0;

  if (chunk.sectionKey === profile.sectionKey) score += 45;
  if (isCompatibleSection(chunk.sectionKey, profile.sectionKey)) score += 18;
  if (profile.preferredFamilies.includes(chunk.reportFamily)) score += 18;
  if (chunk.reportFamily === "internal-external") score += 10;
  if (chunk.sourceReportName.includes(API_STANDARD_PRIMARY_REPORT.sourceReportName)) score += 16;
  if (
    chunk.sourceReportName.includes(API_STANDARD_PRIMARY_REPORT.sourceReportName) &&
    profile.preferredPageStart != null &&
    chunk.pageStart === profile.preferredPageStart
  ) {
    score += chunk.sectionKey === profile.sectionKey ? 120 : 70;
  }
  if (chunk.chunkType === "toc") score -= 18;

  const searchText = chunk.searchText;
  const normalizedExcerpt = tokenizeSearchText(chunk.excerpt);
  for (const phrase of profile.exactPhrases ?? []) {
    const normalizedPhrase = tokenizeSearchText(phrase);
    if (normalizedPhrase && normalizedExcerpt.includes(normalizedPhrase)) {
      score += 30;
    }
  }

  for (const term of queryTerms) {
    if (term.length < 3) continue;
    if (searchText.includes(term)) score += 3;
  }

  score += chunk.qualityScore * 8;
  return Math.max(0, score);
}

function scoreStandardsChunk(chunk, profile, queryTerms) {
  let score = 0;
  const sourceName = chunk.sourceReportName.toLowerCase();
  const searchText = chunk.searchText;
  const normalizedExcerpt = tokenizeSearchText(chunk.excerpt);

  if (sourceName.includes("api 653")) score += 42;
  if (sourceName.includes("eemua 159")) score += 18;
  if (sourceName.includes("api std 650") || sourceName.includes("api 650")) score += 14;
  if (sourceName.includes("api 652") && profile.sectionKey.includes("floor")) score += 24;
  if (sourceName.includes("api 651") && profile.sectionKey.includes("settlement")) score += 8;
  if (sourceName.includes("api 577") && profile.sectionKey.includes("mpi")) score += 20;
  if (sourceName.includes("api 575") && profile.sectionKey.includes("inspection")) score += 18;

  for (const phrase of profile.exactPhrases ?? []) {
    const normalizedPhrase = tokenizeSearchText(phrase);
    if (normalizedPhrase && normalizedExcerpt.includes(normalizedPhrase)) {
      score += 20;
    }
  }

  for (const term of queryTerms) {
    if (term.length < 3) continue;
    if (searchText.includes(term)) score += 3;
  }

  score += chunk.qualityScore * 6;
  return Math.max(0, score);
}

function isCompatibleSection(chunkSectionKey, targetSectionKey) {
  if (chunkSectionKey === targetSectionKey) return true;

  const compatible = {
    "general-tank-information": ["inspection-report", "scope-of-inspection"],
    "inspection-report": ["general-tank-information", "repair-recommendations"],
    "repair-recommendations": ["inspection-report", "attachment-mpi-report"],
    "layout-sketches": ["attachment-mpi-report", "inspection-report"],
    "attachment-mpi-report": ["layout-sketches", "repair-recommendations"],
  };

  return compatible[targetSectionKey]?.includes(chunkSectionKey) ?? false;
}

function buildSelectionReason(chunk, profile) {
  if (chunk.sectionKey === profile.sectionKey) {
    return "Exact section match from the approved sample-report corpus.";
  }
  if (profile.preferredFamilies.includes(chunk.reportFamily)) {
    return "Compatible report-family precedent from the approved sample-report corpus.";
  }
  return "Lexical match from approved sample-report precedent.";
}

function buildStandardsSelectionReason(chunk) {
  if (chunk.sourceReportName.toLowerCase().includes("api 653")) {
    return "Primary API 653 code reference for tank inspection requirements.";
  }
  return "Supporting standards/code reference from the approved local Codes library.";
}

function buildRetrievalWarnings(index, wordingPrecedents, excludedSourceChunks = []) {
  const warnings = [];
  if (index.errors?.length > 0) {
    warnings.push(`${index.errors.length} sample report${index.errors.length === 1 ? "" : "s"} failed ingestion.`);
  }
  if (excludedSourceChunks.length > 0) {
    const sourceNames = dedupe(excludedSourceChunks.map((chunk) => chunk.sourceReportName)).slice(0, 4);
    warnings.push(
      `Excluded ${excludedSourceChunks.length} same-report/gold chunk${excludedSourceChunks.length === 1 ? "" : "s"} from wording retrieval: ${sourceNames.join(", ")}.`,
    );
  }
  if (wordingPrecedents.length === 0) {
    warnings.push("No approved precedent chunks matched this section.");
  }
  return warnings;
}

function normalizeExtractedText(text) {
  return String(text ?? "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function tokenizeSearchText(text) {
  return tokenize(text).join(" ");
}

function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function stableHash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function roundScore(value) {
  return Math.round(value * 100) / 100;
}

function dedupe(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
