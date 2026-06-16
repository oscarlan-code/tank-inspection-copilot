import { randomUUID } from "node:crypto";
import { getSectionTemplate, MANUAL_FIELD_LABELS } from "./generation.mjs";
import { searchPrecedentPack } from "./precedent-kb.mjs";
import { API_STANDARD_PRIMARY_REPORT } from "./report-toc.mjs";

const EVALUATOR_KEY = "deterministic_reference_guard.v1";

export function evaluateGeneratedSection({
  reportState,
  sectionId,
  generationRun,
  generatedContent,
  orchestration,
}) {
  const createdAtIso = new Date().toISOString();
  const template = getSectionTemplate(sectionId);
  const manualInputs = reportState.manualSupplement ?? {};
  const missingManualFields = template.requiredManualFields
    .filter((fieldKey) => !String(manualInputs[fieldKey] ?? "").trim())
    .map((fieldKey) => ({
      fieldKey,
      label: MANUAL_FIELD_LABELS[fieldKey] ?? fieldKey,
    }));
  const precedentPack = searchPrecedentPack({
    sectionId,
    reportState,
    limit: 10,
  });
  const referenceChunks = selectReferenceChunks(precedentPack);
  const referenceText = referenceChunks.map((chunk) => chunk.excerpt).join("\n\n");
  const generatedText = normalizeText(stripHtml(generatedContent));
  const allowedEvidenceText = normalizeText(
    JSON.stringify({
      exportPackage: reportState.exportPackage,
      manualInputs,
      calculations: orchestration?.calculationOutputs ?? [],
      mapArtifacts: orchestration?.mapArtifacts ?? [],
      standardRuleChecks: orchestration?.standardRuleChecks ?? [],
      userInstruction: orchestration?.userInstruction ?? "",
    }),
  );
  const blockers = generationRun.blockers ?? [];
  const warnings = generationRun.warnings ?? [];
  const referenceSimilarity = scoreReferenceSimilarity(generatedText, referenceText);
  const formatMatch = scoreFormatMatch({
    generatedText,
    referenceText,
    sectionTitle: template.title,
    sectionKind: template.kind,
  });
  const missingInputDiscipline = scoreMissingInputDiscipline({
    generatedText,
    missingManualFields,
  });
  const leakage = detectReferenceLeakage({
    generatedText,
    referenceText,
    allowedEvidenceText,
  });
  const sourceGrounding = scoreSourceGrounding({
    missingManualFields,
    blockers,
    warnings,
    leakageRiskScore: leakage.riskScore,
  });
  const leakageSafety = clamp(1 - leakage.riskScore);
  const rawScore = clamp(
    formatMatch * 0.25 +
      referenceSimilarity.score * 0.2 +
      sourceGrounding * 0.25 +
      missingInputDiscipline * 0.2 +
      leakageSafety * 0.1,
  );
  const caps = buildScoreCaps({
    missingManualFields,
    blockers,
    leakage,
  });
  const score = caps.reduce((current, cap) => Math.min(current, cap.value), rawScore);
  const outcomeCode = determineOutcome({
    score,
    missingManualFields,
    blockers,
    leakage,
  });
  const dimensions = [
    buildDimension("format_match", "Format Match", formatMatch, [
      "Checks heading, bullet/table-like structure, and similarity to sample-report conventions.",
    ]),
    buildDimension("reference_alignment", "Reference Alignment", referenceSimilarity.score, [
      `Compared against ${referenceChunks.length} approved reference chunk${referenceChunks.length === 1 ? "" : "s"} after generation.`,
    ]),
    buildDimension("source_grounding", "Source Grounding", sourceGrounding, [
      missingManualFields.length > 0
        ? "Open report-side inputs mean the output cannot be considered final."
        : "No required report-side fields are missing for this template.",
      blockers.length > 0 ? `Generation blockers: ${blockers.join(" ")}` : "",
    ]),
    buildDimension("missing_input_discipline", "Missing Input Discipline", missingInputDiscipline, [
      missingManualFields.length > 0
        ? `Missing fields: ${missingManualFields.map((field) => field.label).join(", ")}.`
        : "No required manual fields are missing.",
    ]),
    buildDimension("leakage_safety", "Leakage Safety", leakageSafety, leakage.notes),
  ];

  return {
    evalRunId: `eval_${randomUUID()}`,
    generationRunId: generationRun.runId,
    reportJobId: reportState.reportJob?.reportJobId ?? null,
    sectionId,
    evaluatorKey: EVALUATOR_KEY,
    createdAtIso,
    score,
    grade: toGrade(score),
    outcomeCode,
    summary: buildEvalSummary({
      score,
      outcomeCode,
      missingManualFields,
      blockers,
      leakage,
    }),
    dataLeakPolicy: {
      generationPromptIsolation:
        "Reference answer text used by this evaluator is read only after generation and is never inserted into the generation prompt.",
      expectedFailureRule:
        "If a section requires missing report-side user input, the eval score is capped and the result is expected to be bad until the input is supplied.",
      noLeakRule:
        "The evaluator flags possible answer leakage when generated text copies long reference phrases or uses reference-only facts not present in allowed evidence.",
    },
    missingUserInputs: {
      missingManualFields,
      expectedBadUntilResolved: missingManualFields.length > 0,
      capApplied: caps.find((cap) => cap.reason === "missing_user_input")?.value ?? null,
    },
    leakage,
    reference: {
      sourceReportName: API_STANDARD_PRIMARY_REPORT.sourceReportName,
      referenceChunkCount: referenceChunks.length,
      similarityScore: referenceSimilarity.score,
      overlapTokenCount: referenceSimilarity.overlapTokenCount,
      chunks: referenceChunks.map((chunk) => ({
        chunkId: chunk.chunkId,
        sourceReportName: chunk.sourceReportName,
        pageStart: chunk.pageStart,
        pageEnd: chunk.pageEnd,
        sectionKey: chunk.sectionKey,
        score: chunk.score,
      })),
    },
    dimensions,
    scoreCaps: caps,
    tuningHints: buildTuningHints({
      outcomeCode,
      missingManualFields,
      leakage,
      formatMatch,
      referenceSimilarity,
    }),
  };
}

function selectReferenceChunks(precedentPack) {
  const primaryChunks = (precedentPack.wordingPrecedents ?? []).filter(
    (chunk) => chunk.sourceReportName === API_STANDARD_PRIMARY_REPORT.sourceReportName,
  );

  return primaryChunks.length > 0 ? primaryChunks : precedentPack.wordingPrecedents ?? [];
}

function scoreReferenceSimilarity(generatedText, referenceText) {
  const generatedTokens = new Set(tokenize(generatedText));
  const referenceTokens = new Set(tokenize(referenceText));
  if (generatedTokens.size === 0 || referenceTokens.size === 0) {
    return { score: 0, overlapTokenCount: 0 };
  }

  const overlap = [...generatedTokens].filter((token) => referenceTokens.has(token));
  const referenceCoverage = overlap.length / referenceTokens.size;
  const generatedCoverage = overlap.length / generatedTokens.size;

  return {
    score: clamp(referenceCoverage * 0.65 + generatedCoverage * 0.35),
    overlapTokenCount: overlap.length,
  };
}

function scoreFormatMatch({ generatedText, referenceText, sectionTitle, sectionKind }) {
  let score = 0.2;
  const lower = generatedText.toLowerCase();
  const titleWords = tokenize(sectionTitle).filter((token) => token.length > 3);
  const titleHits = titleWords.filter((token) => lower.includes(token)).length;

  if (titleWords.length === 0 || titleHits / titleWords.length >= 0.5) score += 0.25;
  if (/^\s*(\d+|appendix)\b/im.test(generatedText)) score += 0.15;
  if (/[➢•-]\s+\S/.test(generatedText)) score += sectionKind === "narrative" || sectionKind === "map" ? 0.15 : 0.08;
  if (/:\s+\S/.test(generatedText)) score += sectionKind === "structured" ? 0.18 : 0.08;
  if (referenceText && scoreReferenceSimilarity(generatedText, referenceText).score > 0.28) score += 0.12;

  return clamp(score);
}

function scoreMissingInputDiscipline({ generatedText, missingManualFields }) {
  if (missingManualFields.length === 0) return 1;

  const lower = generatedText.toLowerCase();
  const pendingMarkerCount = ["pending confirmation", "pending", "to be confirmed", "not recorded"].filter((marker) =>
    lower.includes(marker),
  ).length;

  return pendingMarkerCount > 0 ? 0.55 : 0.2;
}

function scoreSourceGrounding({ missingManualFields, blockers, warnings, leakageRiskScore }) {
  let score = 0.9;
  score -= missingManualFields.length * 0.2;
  score -= blockers.length * 0.3;
  score -= Math.min(warnings.length, 3) * 0.06;
  score -= leakageRiskScore * 0.35;
  return clamp(score);
}

function detectReferenceLeakage({ generatedText, referenceText, allowedEvidenceText }) {
  const copiedPhrases = findCopiedReferencePhrases(generatedText, referenceText);
  const referenceOnlyFacts = findReferenceOnlyFacts({
    generatedText,
    referenceText,
    allowedEvidenceText,
  });
  const riskScore = clamp(copiedPhrases.length * 0.18 + referenceOnlyFacts.length * 0.12);
  const notes = [];

  if (copiedPhrases.length > 0) {
    notes.push(`${copiedPhrases.length} long reference phrase${copiedPhrases.length === 1 ? "" : "s"} appear copied.`);
  }
  if (referenceOnlyFacts.length > 0) {
    notes.push(
      `${referenceOnlyFacts.length} reference-only fact token${referenceOnlyFacts.length === 1 ? "" : "s"} appeared without matching allowed evidence.`,
    );
  }
  if (notes.length === 0) {
    notes.push("No obvious reference-answer leakage detected by deterministic checks.");
  }

  return {
    riskScore,
    statusCode: riskScore >= 0.65 ? "high" : riskScore >= 0.35 ? "medium" : "low",
    copiedPhraseCount: copiedPhrases.length,
    copiedPhrasePreviews: copiedPhrases.slice(0, 5),
    referenceOnlyFacts: referenceOnlyFacts.slice(0, 12),
    notes,
  };
}

function findCopiedReferencePhrases(generatedText, referenceText) {
  const generatedLower = generatedText.toLowerCase();
  return splitSentences(referenceText)
    .map((sentence) => normalizeText(sentence))
    .filter((sentence) => sentence.length >= 72)
    .filter((sentence) => generatedLower.includes(sentence.toLowerCase()))
    .slice(0, 12);
}

function findReferenceOnlyFacts({ generatedText, referenceText, allowedEvidenceText }) {
  const generatedLower = generatedText.toLowerCase();
  const allowedLower = allowedEvidenceText.toLowerCase();
  const referenceFacts = new Set(referenceText.match(/\b(?:\d+(?:\.\d+)?\s?(?:mm|m|%|years?|months?|days?)?|[A-Z]{2,}-?\d+[A-Z0-9-]*)\b/g) ?? []);

  return [...referenceFacts]
    .filter((fact) => fact.length >= 2)
    .filter((fact) => generatedLower.includes(fact.toLowerCase()))
    .filter((fact) => !allowedLower.includes(fact.toLowerCase()));
}

function buildScoreCaps({ missingManualFields, blockers, leakage }) {
  const caps = [];

  if (missingManualFields.length > 0) {
    caps.push({
      reason: "missing_user_input",
      value: 0.42,
      message: "Section still requires user/report-side inputs, so a high score would be misleading.",
    });
  }
  if (blockers.length > 0) {
    caps.push({
      reason: "generation_blocker",
      value: 0.35,
      message: "Generation has blockers, so output cannot pass eval.",
    });
  }
  if (leakage.riskScore >= 0.65) {
    caps.push({
      reason: "possible_reference_leakage",
      value: 0.38,
      message: "Possible copied reference-answer content detected.",
    });
  }

  return caps;
}

function determineOutcome({ score, missingManualFields, blockers, leakage }) {
  if (blockers.length > 0) return "fail_blocked";
  if (missingManualFields.length > 0) return "expected_bad_missing_user_input";
  if (leakage.riskScore >= 0.65) return "fail_possible_leakage";
  if (score >= 0.75) return "pass";
  if (score >= 0.5) return "needs_review";
  return "fail";
}

function buildEvalSummary({ score, outcomeCode, missingManualFields, blockers, leakage }) {
  if (missingManualFields.length > 0) {
    return `Score ${formatScore(score)}. Expected bad result: ${missingManualFields.length} required report-side input${missingManualFields.length === 1 ? " is" : "s are"} missing.`;
  }
  if (blockers.length > 0) {
    return `Score ${formatScore(score)}. Failed because generation blockers remain.`;
  }
  if (leakage.riskScore >= 0.65) {
    return `Score ${formatScore(score)}. Failed possible reference leakage guard.`;
  }
  if (outcomeCode === "pass") {
    return `Score ${formatScore(score)}. Output is aligned enough for user review.`;
  }
  return `Score ${formatScore(score)}. Output needs prompt/system tuning or additional report-side input.`;
}

function buildDimension(key, label, score, notes) {
  return {
    key,
    label,
    score,
    statusCode: score >= 0.75 ? "pass" : score >= 0.5 ? "review" : "fail",
    notes: notes.filter(Boolean),
  };
}

function buildTuningHints({
  outcomeCode,
  missingManualFields,
  leakage,
  formatMatch,
  referenceSimilarity,
}) {
  const hints = [];

  if (missingManualFields.length > 0) {
    hints.push("Do not tune the generator to guess missing report-side inputs; expose those fields to the user and rerun after completion.");
  }
  if (leakage.riskScore >= 0.35) {
    hints.push("Tighten retrieval/generation instructions so precedent text is used for style and structure, not copied answer content.");
  }
  if (formatMatch < 0.6) {
    hints.push("Tune the section template or prompt to better preserve heading, bullet, table, and page-block conventions.");
  }
  if (referenceSimilarity.score < 0.35 && missingManualFields.length === 0) {
    hints.push("Review whether the section retrieval profile is finding the right sample-report section.");
  }
  if (outcomeCode === "pass") {
    hints.push("Keep this prompt/retrieval configuration as a candidate baseline for this section.");
  }

  return hints;
}

function toGrade(score) {
  if (score >= 0.9) return "A";
  if (score >= 0.8) return "B";
  if (score >= 0.65) return "C";
  if (score >= 0.5) return "D";
  return "F";
}

function formatScore(score) {
  return `${Math.round(score * 100)}%`;
}

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function tokenize(value) {
  return normalizeText(value)
    .toLowerCase()
    .match(/\b[a-z0-9][a-z0-9-]{2,}\b/g) ?? [];
}

function splitSentences(value) {
  return String(value ?? "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function clamp(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
