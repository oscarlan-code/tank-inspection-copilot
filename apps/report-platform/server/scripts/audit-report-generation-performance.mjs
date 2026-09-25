import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSectionRequiredFacts,
  deriveWeakGoldRelevanceJudgments,
  scoreGeneratedFactMetrics,
  scoreRetrievalRanking,
} from "../evaluation-metrics.mjs";

// Keep this product gate deterministic. Live LAIQ AI Engine runs can be
// evaluated separately once the baseline harness is stable.
process.env.PATH = "";

const reportPlatformRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturePath = join(reportPlatformRoot, "src", "fixtures", "v3-product-export-shell-internal.json");
const precedentIndexPath = join(reportPlatformRoot, ".data", "precedent-kb", "precedent-kb.index.json");
const outputDir = join(reportPlatformRoot, ".data", "eval-runs");
const goldSourceReportName = "22PE1-4 TK V10 Internal & External Inspection Report";

const [
  generation,
  evalModule,
  layoutMapFigure,
  reportToc,
  reportClassification,
] = await Promise.all([
  import("../generation.mjs"),
  import("../eval.mjs"),
  import("../layout-map-figure.mjs"),
  import("../report-toc.mjs"),
  import("../report-classification.mjs"),
]);

const { generateSectionDraft, getSectionTemplate } = generation;
const { evaluateGeneratedSection } = evalModule;
const { buildLayoutFigureSvg } = layoutMapFigure;
const { API_STANDARD_PRIMARY_REPORT, API_STANDARD_REPORT_TOC } = reportToc;
const { classifyReportPackage } = reportClassification;

const exportPackage = JSON.parse(readFileSync(fixturePath, "utf8"));
const precedentIndex = JSON.parse(readFileSync(precedentIndexPath, "utf8"));
const goldChunks = precedentIndex.chunks.filter((chunk) => chunk.sourceReportName === goldSourceReportName);

const reportState = {
  exportPackage,
  manualSupplement: {
    reportReference: API_STANDARD_PRIMARY_REPORT.reference,
    inspectedDate: API_STANDARD_PRIMARY_REPORT.inspectedDate,
    coverHeroImage: "",
    clientRepresentative: "",
    yearBuilt: "",
    engineeringImplication: "",
    recommendationOwner: "",
    checkedBy: "",
    legendNote: "",
    certificationNumber: "",
  },
  sectionDrafts: [],
  layoutOverrides: [],
  reportClassification: classifyReportPackage(exportPackage),
};

const startedAt = Date.now();
const sectionResults = [];

for (const section of API_STANDARD_REPORT_TOC) {
  const sectionStart = Date.now();
  try {
    const result = await generateSectionDraft({
      reportState,
      sectionId: section.id,
      userInstruction:
        "Product eval run: generate this section from current V3 app export, voice notes, approved deterministic tools, and leak-safe precedent/template guidance.",
    });
    const templateEval = evaluateGeneratedSection({
      reportState,
      sectionId: section.id,
      generationRun: result.generationRun,
      generatedContent: result.draft.content,
      orchestration: result.orchestration,
    });
    const goldText = findGoldTextForSection(section.id);
    const generatedText = normalizeText(stripHtml(result.draft.content));
    const goldSimilarity = scoreTokenF1(redactReferenceOnlyFacts(generatedText), redactReferenceOnlyFacts(goldText));
    const relevanceLabels = deriveWeakGoldRelevanceJudgments({
      chunks: precedentIndex.chunks,
      goldSourceReportName,
      maximumRelevantChunks: 12,
      sectionId: section.id,
    });
    const retrievalApplicable = isRetrievalEvaluationApplicable(section);
    const retrieval = retrievalApplicable
      ? scoreRetrievalRanking({
          goldChunkIds: relevanceLabels.goldChunkIds,
          judgments: relevanceLabels.judgments,
          k: 3,
          retrieved: result.orchestration.evidenceChain?.precedentRefs ?? [],
        })
      : {
          available: false,
          notApplicable: true,
          precisionAtK: 0,
          recallAtK: 0,
          f1AtK: 0,
          ndcgAtK: 0,
          reciprocalRank: 0,
          sameGoldRetrievedCount: 0,
        };
    const generatedFacts = scoreGeneratedFactMetrics({
      allowedEvidence: {
        exportPackage: reportState.exportPackage,
        manualInputs: reportState.manualSupplement,
        calculations: result.orchestration.calculationOutputs,
        mapArtifacts: result.orchestration.mapArtifacts,
        standardRuleChecks: result.orchestration.standardRuleChecks,
        reportClassification: result.orchestration.reportClassification,
      },
      generatedContent: result.draft.content,
      requiredFacts: buildSectionRequiredFacts({ reportState, sectionId: section.id }),
    });
    const structure = scoreStructure({ section, generatedContent: result.draft.content, generatedText });
    const evidence = scoreEvidenceCoverage({
      section,
      generatedContent: result.draft.content,
      generatedText,
      reportState,
    });
    const leakage = scoreLeakageSafety(generatedText);
    const routing = scoreRouting({
      section,
      generationRun: result.generationRun,
      generatedContent: result.draft.content,
      reportState,
    });
    const missingManualFields = getMissingManualFields(section.id);
    const rawScore = weightedAvailableScore([
      metric(structure.score, 0.15),
      metric(evidence.score, 0.15),
      metric(goldSimilarity.f1, 0.1),
      metric(routing.score, 0.1),
      metric(leakage.score, 0.15),
      metric(retrieval.precisionAtK, 0.1, retrieval.available),
      metric(retrieval.recallAtK, 0.1, retrieval.available),
      metric(generatedFacts.claimPrecision, 0.075, generatedFacts.claimPrecisionAvailable),
      metric(generatedFacts.requiredFactRecall, 0.075, generatedFacts.requiredFactRecallAvailable),
    ]);
    const score = applyCaps(rawScore, {
      missingManualFields,
      blockers: result.generationRun.blockers,
      leakage,
    });

    sectionResults.push({
      sectionId: section.id,
      number: section.number,
      title: section.title,
      kind: section.kind,
      status: statusForScore(score, result.generationRun.blockers, leakage),
      score,
      dimensions: {
        structure: structure.score,
        evidence: evidence.score,
        goldStyleSimilarity: goldSimilarity.f1,
        routing: routing.score,
        leakageSafety: leakage.score,
        retrievalPrecisionAt3: retrieval.available ? retrieval.precisionAtK : null,
        retrievalRecallAt3: retrieval.available ? retrieval.recallAtK : null,
        retrievalNdcgAt3: retrieval.available ? retrieval.ndcgAtK : null,
        claimPrecision: generatedFacts.claimPrecisionAvailable ? generatedFacts.claimPrecision : null,
        requiredFactRecall: generatedFacts.requiredFactRecallAvailable ? generatedFacts.requiredFactRecall : null,
        builtInEval: templateEval.score,
      },
      generatedLength: generatedText.length,
      elapsedMs: Date.now() - sectionStart,
      usedLiveModel: result.generationRun.usedLiveModel,
      providerCode: result.generationRun.providerCode,
      fallbackReason: result.generationRun.fallbackReason,
      warningCount: result.generationRun.warnings.length,
      blockerCount: result.generationRun.blockers.length,
      missingManualFieldCount: missingManualFields.length,
      missingManualFields,
      goldReference: {
        sourceReportName: goldSourceReportName,
        chunkCount: goldChunks.filter((chunk) => chunk.sectionKey === section.id).length,
        tokenPrecision: goldSimilarity.precision,
        tokenRecall: goldSimilarity.recall,
        overlapTokenCount: goldSimilarity.overlapCount,
      },
      retrievalEvaluation: {
        ...retrieval,
        labelSource: relevanceLabels.labelSource,
        labelReviewStatus: "machine_proposed",
        labelReason: relevanceLabels.reason,
      },
      generatedContentEvaluation: generatedFacts,
      leakage,
      structureNotes: structure.notes,
      evidenceNotes: evidence.notes,
      routingNotes: routing.notes,
      builtInEval: {
        grade: templateEval.grade,
        outcomeCode: templateEval.outcomeCode,
        summary: templateEval.summary,
      },
      generatedPreview: preview(generatedText),
    });
  } catch (error) {
    sectionResults.push({
      sectionId: section.id,
      number: section.number,
      title: section.title,
      kind: section.kind,
      status: "error",
      score: 0,
      dimensions: {
        structure: 0,
        evidence: 0,
        goldStyleSimilarity: 0,
        routing: 0,
        leakageSafety: 0,
        retrievalPrecisionAt3: null,
        retrievalRecallAt3: null,
        retrievalNdcgAt3: null,
        claimPrecision: null,
        requiredFactRecall: null,
        builtInEval: 0,
      },
      generatedLength: 0,
      elapsedMs: Date.now() - sectionStart,
      usedLiveModel: false,
      providerCode: null,
      fallbackReason: null,
      warningCount: 0,
      blockerCount: 1,
      missingManualFieldCount: getMissingManualFields(section.id).length,
      missingManualFields: getMissingManualFields(section.id),
      goldReference: {
        sourceReportName: goldSourceReportName,
        chunkCount: goldChunks.filter((chunk) => chunk.sectionKey === section.id).length,
        tokenPrecision: 0,
        tokenRecall: 0,
        overlapTokenCount: 0,
      },
      retrievalEvaluation: {
        available: false,
        precisionAtK: 0,
        recallAtK: 0,
        f1AtK: 0,
        ndcgAtK: 0,
        reciprocalRank: 0,
      },
      generatedContentEvaluation: {
        claimPrecisionAvailable: false,
        claimPrecision: 0,
        requiredFactRecallAvailable: false,
        requiredFactRecall: 0,
      },
      leakage: {
        score: 0,
        restrictedHits: [],
        copiedLongPhraseCount: 0,
      },
      structureNotes: [],
      evidenceNotes: [],
      routingNotes: [],
      error: error instanceof Error ? error.message : String(error),
      generatedPreview: "",
    });
  }
}

const summary = buildSummary(sectionResults);
const output = {
  auditKey: "report_generation_performance.v2",
  createdAtIso: new Date().toISOString(),
  elapsedMs: Date.now() - startedAt,
  fixturePath,
  precedentIndexPath,
  goldReference: {
    sourceReportName: goldSourceReportName,
    chunkCount: goldChunks.length,
    usageRule:
      "Gold chunks are used only after generation for scoring. They are not supplied to generation prompts or deterministic composers.",
  },
  scoringPolicy: {
    sectionScore:
      "Available-metric weighted score: 0.15 structure + 0.15 current evidence coverage + 0.10 lexical gold style + 0.10 routing + 0.15 leakage safety + 0.10 retrieval Precision@3 + 0.10 retrieval Recall@3 + 0.075 claim precision + 0.075 required-fact recall.",
    caps:
      "Generation blockers cap at 0.35. Restricted sample-report leaks cap at 0.38. Missing report-side fields cap at 0.72 because those sections can be structurally correct but not final.",
    interpretation:
      "Gold similarity is a style/coverage signal only. Low similarity can be expected where current V3 app facts differ from the old sample report or where report-side inputs are intentionally missing.",
  },
  summary,
  sections: sectionResults,
};

mkdirSync(outputDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const jsonPath = join(outputDir, `report-generation-performance-${stamp}.json`);
const markdownPath = join(outputDir, `report-generation-performance-${stamp}.md`);
writeFileSync(jsonPath, JSON.stringify(output, null, 2));
writeFileSync(markdownPath, buildMarkdownReport(output));

printConsoleSummary(output, jsonPath, markdownPath);

const failedSections = sectionResults.filter((section) => section.status === "fail" || section.status === "error");
process.exit(failedSections.length > 0 ? 1 : 0);

function findGoldTextForSection(sectionId) {
  return goldChunks
    .filter((chunk) => chunk.sectionKey === sectionId)
    .sort((left, right) => left.pageStart - right.pageStart)
    .map((chunk) => chunk.excerpt)
    .join("\n\n");
}

function getMissingManualFields(sectionId) {
  const template = getSectionTemplate(sectionId);
  return template.requiredManualFields
    .filter((fieldKey) => !String(reportState.manualSupplement[fieldKey] ?? "").trim())
    .map((fieldKey) => fieldKey);
}

function isRetrievalEvaluationApplicable(section) {
  if (section.kind === "map") return false;
  if (section.id === "tank-inspection-checklist") return false;
  return !/thickness-measurements/.test(section.id);
}

function scoreStructure({ section, generatedContent, generatedText }) {
  const notes = [];
  let score = 0.2;
  const lower = generatedText.toLowerCase();
  const titleTokens = tokenize(section.title).filter((token) => token.length >= 4);
  const titleHits = titleTokens.filter((token) => lower.includes(token)).length;
  if (titleTokens.length === 0 || titleHits / titleTokens.length >= 0.5) {
    score += 0.25;
    notes.push("Section title/topic is visible.");
  } else {
    notes.push("Section title/topic is weak or missing.");
  }
  if (new RegExp(`\\b${escapeRegExp(String(section.number).toLowerCase())}\\b`).test(lower) || lower.includes(section.title.toLowerCase())) {
    score += 0.1;
    notes.push("Section numbering/title convention is present.");
  }
  if (section.kind === "structured") {
    if (/<table\b/i.test(generatedContent) || /report-measurement-table/.test(generatedContent) || /\btable\b/i.test(generatedText)) {
      score += 0.25;
      notes.push("Structured/table-like layout detected.");
    } else if (/:\s+\S/.test(generatedText)) {
      score += 0.15;
      notes.push("Label-value structure detected.");
    } else {
      notes.push("Structured/table-like layout is weak.");
    }
  } else if (section.kind === "map") {
    if (/layout|map|drawing|plate/i.test(generatedText)) {
      score += 0.25;
      notes.push("Map/layout language detected.");
    } else {
      notes.push("Map/layout language is weak.");
    }
  } else if (section.kind === "attachment") {
    if (/photo|attachment|caption|evidence/i.test(generatedText)) {
      score += 0.25;
      notes.push("Attachment/photo conventions detected.");
    } else {
      notes.push("Attachment conventions are weak.");
    }
  } else if (/[➢•-]\s+\S|<li\b/i.test(generatedContent)) {
    score += 0.25;
    notes.push("Narrative bullets detected.");
  } else if (generatedText.length > 300) {
    score += 0.12;
    notes.push("Narrative prose detected but bullet structure is weak.");
  }
  if (generatedText.length >= 120) score += 0.1;
  if (generatedText.length >= 600) score += 0.1;
  return { score: clamp(score), notes };
}

function scoreEvidenceCoverage({ section, generatedContent, generatedText, reportState }) {
  const expected = expectedEvidenceForSection(section, reportState);
  const notes = [];
  const lowerContent = generatedContent.toLowerCase();
  const lowerText = generatedText.toLowerCase();
  let hitCount = 0;

  for (const item of expected.text) {
    if (lowerContent.includes(String(item).toLowerCase()) || lowerText.includes(String(item).toLowerCase())) {
      hitCount += 1;
    }
  }

  let score = expected.text.length === 0 ? 0.65 : hitCount / expected.text.length;

  if (section.kind === "map") {
    const figure = buildLayoutFigureSvg(reportState, section);
    const figureSvg = String(figure?.svg ?? "");
    const markerHits = expected.figureMarkers.filter((label) => figureSvg.includes(`>${label}<`) || figureSvg.includes(label));
    const figureScore = expected.figureMarkers.length === 0 ? 0.75 : markerHits.length / expected.figureMarkers.length;
    score = clamp(score * 0.35 + figureScore * 0.65);
    notes.push(`Layout figure marker coverage: ${markerHits.length}/${expected.figureMarkers.length}.`);
  }

  notes.push(`Text evidence coverage: ${hitCount}/${expected.text.length}.`);
  return { score: clamp(score), notes };
}

function expectedEvidenceForSection(section, reportState) {
  const pkg = reportState.exportPackage;
  const common = [
    pkg.task?.tankNumber,
    pkg.inspectionRecord?.tankNumber,
  ].filter(Boolean);
  const roofMarkers = ["MH-1", "R1", "R9", "VT-1"];
  const shellMarkers = ["ST-O", "ST-T", "S7"];
  const floorMarkers = ["SU-1", "RF-1"];

  switch (section.id) {
    case "scope-of-inspection":
      return { text: ["API 653", "internal", "external", ...common], figureMarkers: [] };
    case "inspection-maintenance-regime":
      return { text: ["API 653", "EEMUA", ...common], figureMarkers: [] };
    case "general-tank-information":
      return {
        text: [
          pkg.inspectionRecord.client,
          pkg.inspectionRecord.tankNumber,
          String(pkg.inspectionRecord.diameterM),
          String(pkg.inspectionRecord.heightM),
          String(pkg.inspectionRecord.shellCourseCount),
        ].filter(Boolean),
        figureMarkers: [],
      };
    case "inspection-report":
      return { text: ["shell", "roof", "floor", "MPI", "UT", "corrosion", ...common], figureMarkers: [] };
    case "repair-recommendations":
      return { text: ["repair", "MPI", "shell", "roof", "coating", "API 653"], figureMarkers: [] };
    case "tank-inspection-checklist":
      return {
        text: [
          "checklist",
          "IA",
          "N/A",
          String(pkg.inspectionChecklistItems?.length ?? ""),
          "Diked area condition",
          "Shell corrosion",
          "Floor condition",
        ],
        figureMarkers: [],
      };
    case "roof-plate-thickness-measurements":
      return { text: ["Plate No.", "4.40", "4.52", "3.53", "59"], figureMarkers: [] };
    case "roof-nozzle-reinforcement-pad-thickness-measurements":
      return { text: ["R6", "6 in", "6.43", "6.62", "6.72", "6.55", "6.07"], figureMarkers: [] };
    case "shell-plate-thickness-measurements":
      return { text: ["S1", "12.30", "S2", "3.45", "Strake"], figureMarkers: [] };
    case "shell-nozzle-reinforcement-pad-thickness-measurements":
      return { text: ["S6", "24 in", "13.89", "13.92", "13.24", "13.96", "13.85"], figureMarkers: [] };
    case "floor-plate-layout-platemaps-numbering-system":
    case "floor-plate-corrosion-plan":
    case "magnetic-flux-leakage-platemaps":
      return { text: ["floor", "layout"], figureMarkers: floorMarkers };
    case "roof-plate-layout":
      return { text: ["roof", "layout"], figureMarkers: roofMarkers };
    default:
      if (section.layoutSurface === "shell") return { text: ["shell", "layout"], figureMarkers: shellMarkers };
      if (section.layoutSurface === "roof") return { text: ["roof", "layout"], figureMarkers: roofMarkers };
      if (section.layoutSurface === "floor") return { text: ["floor", "layout"], figureMarkers: floorMarkers };
      return { text: common, figureMarkers: [] };
  }
}

function scoreRouting({ section, generationRun, generatedContent, reportState }) {
  const notes = [];
  let score = 0.7;
  const isMeasurement = /thickness-measurements/.test(section.id);
  const isMap = section.kind === "map";
  if (isMeasurement && generationRun.usedLiveModel === false && generatedContent.includes("report-measurement-table")) {
    score = 1;
    notes.push("Measurement section used deterministic table compiler.");
  } else if (isMap && generationRun.usedLiveModel === false) {
    const figure = buildLayoutFigureSvg(reportState, section);
    score = figure?.svg?.includes("<svg") ? 1 : 0.45;
    notes.push(score === 1 ? "Map section used deterministic layout compiler and produced SVG." : "Map routing did not produce SVG.");
  } else if (!isMeasurement && !isMap && generationRun.usedLiveModel === false) {
    score = 0.72;
    notes.push("Narrative/structured section used deterministic fallback baseline.");
  } else if (generationRun.usedLiveModel) {
    score = 0.85;
    notes.push("Section used live LAIQ AI Engine worker.");
  }
  return { score: clamp(score), notes };
}

function scoreLeakageSafety(generatedText) {
  const restricted = [
    "22PE1-4",
    "18PE1-5",
    "23PE1-3",
    "Pacific Energy",
    "Pacific Energy SWP",
    "Vuda Terminal",
    "Vuda, Fiji",
  ];
  const restrictedHits = restricted.filter((item) => generatedText.toLowerCase().includes(item.toLowerCase()));
  const goldText = goldChunks.map((chunk) => chunk.excerpt).join("\n");
  const copiedLongPhraseCount = findCopiedLongPhrases(generatedText, goldText).length;
  const penalty = restrictedHits.length * 0.35 + copiedLongPhraseCount * 0.12;
  return {
    score: clamp(1 - penalty),
    restrictedHits,
    copiedLongPhraseCount,
  };
}

function applyCaps(rawScore, { missingManualFields, blockers, leakage }) {
  let score = rawScore;
  if (missingManualFields.length > 0) score = Math.min(score, 0.72);
  if (blockers.length > 0) score = Math.min(score, 0.35);
  if (leakage.restrictedHits.length > 0 || leakage.copiedLongPhraseCount > 0) score = Math.min(score, 0.38);
  return clamp(score);
}

function buildSummary(sections) {
  const avg = average(sections.map((section) => section.score));
  const dimensions = [
    "structure",
    "evidence",
    "goldStyleSimilarity",
    "routing",
    "leakageSafety",
    "retrievalPrecisionAt3",
    "retrievalRecallAt3",
    "retrievalNdcgAt3",
    "claimPrecision",
    "requiredFactRecall",
    "builtInEval",
  ];
  return {
    sectionCount: sections.length,
    passCount: sections.filter((section) => section.status === "pass").length,
    reviewCount: sections.filter((section) => section.status === "review").length,
    failCount: sections.filter((section) => section.status === "fail" || section.status === "error").length,
    averageScore: avg,
    averageDimensions: Object.fromEntries(
      dimensions.map((dimension) => [
        dimension,
        average(sections
          .map((section) => section.dimensions[dimension])
          .filter((value) => value != null)),
      ]),
    ),
    missingManualFieldSections: sections.filter((section) => section.missingManualFieldCount > 0).length,
    leakHitSections: sections.filter(
      (section) => section.leakage.restrictedHits.length > 0 || section.leakage.copiedLongPhraseCount > 0,
    ).length,
    slowestSections: [...sections]
      .sort((left, right) => right.elapsedMs - left.elapsedMs)
      .slice(0, 5)
      .map((section) => ({
        sectionId: section.sectionId,
        elapsedMs: section.elapsedMs,
      })),
    weakestSections: [...sections]
      .sort((left, right) => left.score - right.score)
      .slice(0, 8)
      .map((section) => ({
        sectionId: section.sectionId,
        title: section.title,
        score: section.score,
        missingManualFieldCount: section.missingManualFieldCount,
      })),
  };
}

function statusForScore(score, blockers, leakage) {
  if (blockers.length > 0 || leakage.restrictedHits.length > 0 || leakage.copiedLongPhraseCount > 0) return "fail";
  if (score >= 0.75) return "pass";
  return "review";
}

function buildMarkdownReport(output) {
  const lines = [
    "# Report Generation Performance Audit",
    "",
    `Created: ${output.createdAtIso}`,
    `Fixture: ${output.fixturePath}`,
    `Gold reference: ${output.goldReference.sourceReportName}`,
    "",
    "## Summary",
    "",
    `- Sections generated: ${output.summary.sectionCount}`,
    `- Average score: ${percent(output.summary.averageScore)}`,
    `- Pass / review / fail: ${output.summary.passCount} / ${output.summary.reviewCount} / ${output.summary.failCount}`,
    `- Missing-manual-field sections: ${output.summary.missingManualFieldSections}`,
    `- Leak-hit sections: ${output.summary.leakHitSections}`,
    "",
    "## Dimension Averages",
    "",
    "| Dimension | Score |",
    "|---|---:|",
    ...Object.entries(output.summary.averageDimensions).map(([key, value]) => `| ${key} | ${percent(value)} |`),
    "",
    "## Section Results",
    "",
    "| # | Section | Status | Score | P@3 | R@3 | nDCG@3 | Claim P | Fact R | Leak safety | Missing |",
    "|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...output.sections.map((section) =>
      `| ${section.number} | ${escapeMarkdown(section.title)} | ${section.status} | ${percent(section.score)} | ${optionalPercent(section.dimensions.retrievalPrecisionAt3)} | ${optionalPercent(section.dimensions.retrievalRecallAt3)} | ${optionalPercent(section.dimensions.retrievalNdcgAt3)} | ${optionalPercent(section.dimensions.claimPrecision)} | ${optionalPercent(section.dimensions.requiredFactRecall)} | ${percent(section.dimensions.leakageSafety)} | ${section.missingManualFieldCount} |`,
    ),
    "",
    "## Weakest Sections",
    "",
    ...output.summary.weakestSections.map((section) =>
      `- ${section.sectionId}: ${percent(section.score)} (${section.missingManualFieldCount} missing manual fields)`,
    ),
    "",
    "## Notes",
    "",
    "- Gold report text is used only after generation as an evaluator reference.",
    "- Retrieval Precision@3, Recall@3, MRR, and nDCG@3 use machine-proposed qrels derived from the hidden gold section and non-gold precedent chunks. Promotion-grade use requires label review.",
    "- Claim precision covers verifiable identifiers and numeric/unit claims; required-fact recall covers section-labelled facts from the paired app capture.",
    "- Low gold-style similarity is not automatically a failure when the current V3 app export intentionally uses sanitized/different facts.",
    "- Sections with missing report-side fields are capped because they are expected to need inspector/client input before final approval.",
  ];

  return `${lines.join("\n")}\n`;
}

function printConsoleSummary(output, jsonPath, markdownPath) {
  console.log("Report generation performance audit complete.");
  console.log(`Sections: ${output.summary.sectionCount}`);
  console.log(`Average score: ${percent(output.summary.averageScore)}`);
  console.log(`Pass / review / fail: ${output.summary.passCount} / ${output.summary.reviewCount} / ${output.summary.failCount}`);
  console.log(`Missing-manual-field sections: ${output.summary.missingManualFieldSections}`);
  console.log(`Leak-hit sections: ${output.summary.leakHitSections}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${markdownPath}`);
  console.log("");
  console.log("Weakest sections:");
  for (const section of output.summary.weakestSections) {
    console.log(`- ${section.sectionId}: ${percent(section.score)} (${section.missingManualFieldCount} missing manual fields)`);
  }
}

function scoreTokenF1(leftText, rightText) {
  const leftTokens = tokenize(leftText);
  const rightTokens = tokenize(rightText);
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return { precision: 0, recall: 0, f1: 0, overlapCount: 0 };
  }
  const rightCounts = countTokens(rightTokens);
  let overlapCount = 0;
  for (const token of leftTokens) {
    const count = rightCounts.get(token) ?? 0;
    if (count > 0) {
      overlapCount += 1;
      rightCounts.set(token, count - 1);
    }
  }
  const precision = overlapCount / leftTokens.length;
  const recall = overlapCount / rightTokens.length;
  return {
    precision: clamp(precision),
    recall: clamp(recall),
    f1: precision + recall === 0 ? 0 : clamp((2 * precision * recall) / (precision + recall)),
    overlapCount,
  };
}

function metric(score, weight, available = true) {
  return { available, score, weight };
}

function weightedAvailableScore(metrics) {
  const available = metrics.filter((item) => item.available);
  const weightTotal = available.reduce((sum, item) => sum + item.weight, 0);
  if (weightTotal === 0) return 0;
  return clamp(available.reduce((sum, item) => sum + item.score * item.weight, 0) / weightTotal);
}

function optionalPercent(value) {
  return value == null ? "N/A" : percent(value);
}

function countTokens(tokens) {
  const counts = new Map();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function findCopiedLongPhrases(generatedText, referenceText) {
  const generatedLower = generatedText.toLowerCase();
  return String(referenceText ?? "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => normalizeText(sentence))
    .filter((sentence) => sentence.length >= 120)
    .filter((sentence) => generatedLower.includes(sentence.toLowerCase()));
}

function redactReferenceOnlyFacts(value) {
  return normalizeText(value)
    .replace(/\b22PE1-4\b/gi, " ")
    .replace(/\bV10\b/gi, " ")
    .replace(/\bD10\b/gi, " ")
    .replace(/\bPacific\s+Energy(?:\s+SWP(?:\s+Ltd)?)?\b/gi, " ")
    .replace(/\bDemo\s+Energy\s+Storage\s+Ltd\b/gi, " ")
    .replace(/\bLAIQ\s+Demo\s+Client\s+Ltd\b/gi, " ")
    .replace(/\bVuda(?:\s+Terminal|,\s+Fiji)?\b/gi, " ")
    .replace(/\bDemo\s+Terminal(?:,\s+Fiji)?\b/gi, " ")
    .replace(/\bLAIQ-D10-\d+-\d+\b/gi, " ")
    .replace(/\b\d{1,2}(?:st|nd|rd|th)?\s+July\s+2022\b/gi, " ");
}

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'");
}

function tokenize(value) {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "are",
    "was",
    "were",
    "been",
    "have",
    "has",
    "had",
    "into",
    "not",
    "shall",
    "will",
    "tank",
    "report",
  ]);
  return normalizeText(value)
    .toLowerCase()
    .match(/\b[a-z0-9][a-z0-9-]{2,}\b/g)
    ?.filter((token) => !stopWords.has(token)) ?? [];
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function preview(value) {
  const normalized = normalizeText(value);
  return normalized.length > 360 ? `${normalized.slice(0, 360)}...` : normalized;
}

function average(values) {
  const safeValues = values.filter((value) => Number.isFinite(value));
  if (safeValues.length === 0) return 0;
  return clamp(safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length);
}

function percent(value) {
  return `${Math.round(clamp(value) * 100)}%`;
}

function clamp(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeMarkdown(value) {
  return String(value ?? "").replace(/\|/g, "\\|");
}
