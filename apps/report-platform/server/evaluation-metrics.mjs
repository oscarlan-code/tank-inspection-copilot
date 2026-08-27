const DEFAULT_RETRIEVAL_K = 3;

export const EVALUATION_METRIC_SCHEMA_VERSION = 2;

export function deriveWeakGoldRelevanceJudgments({
  chunks,
  goldSourceReportName,
  maximumRelevantChunks = 12,
  sectionId,
}) {
  const allChunks = Array.isArray(chunks) ? chunks : [];
  const goldChunks = allChunks.filter((chunk) => (
    chunk.sourceReportName === goldSourceReportName
      && chunk.sectionKey === sectionId
  ));
  const goldText = goldChunks.map((chunk) => chunk.excerpt).join("\n\n");
  if (!goldText.trim()) {
    return {
      available: false,
      goldChunkIds: [],
      judgments: [],
      labelConfidence: 0,
      labelSource: "gold_section_weak_supervision",
      reason: "The hidden gold report has no indexed chunk for this section.",
    };
  }

  const candidates = allChunks
    .filter((chunk) => chunk.sourceReportName !== goldSourceReportName)
    .filter((chunk) => chunk.sourceType !== "code_pdf")
    .filter((chunk) => chunk.approvalStatus === "approved_for_retrieval")
    .map((chunk) => {
      const overlap = scoreTokenF1(chunk.excerpt, goldText);
      const exactSection = chunk.sectionKey === sectionId;
      const relevanceGrade = exactSection
        ? overlap.f1 >= 0.28
          ? 3
          : overlap.f1 >= 0.12
            ? 2
            : 1
        : overlap.f1 >= 0.32
          ? 1
          : 0;
      return {
        chunk,
        exactSection,
        overlap,
        relevanceGrade,
      };
    })
    .filter((candidate) => candidate.relevanceGrade > 0)
    .sort((left, right) => (
      right.relevanceGrade - left.relevanceGrade
        || right.overlap.f1 - left.overlap.f1
        || Number(right.chunk.qualityScore ?? 0) - Number(left.chunk.qualityScore ?? 0)
        || String(left.chunk.chunkId).localeCompare(String(right.chunk.chunkId))
    ))
    .slice(0, maximumRelevantChunks);

  if (candidates.length === 0) {
    return {
      available: false,
      goldChunkIds: goldChunks.map((chunk) => chunk.chunkId),
      judgments: [],
      labelConfidence: 0,
      labelSource: "gold_section_weak_supervision",
      reason: "No non-gold precedent chunks could be labelled relevant for this section.",
    };
  }

  const judgments = candidates.map((candidate) => ({
    chunkId: candidate.chunk.chunkId,
    sourceReportName: candidate.chunk.sourceReportName,
    sectionKey: candidate.chunk.sectionKey,
    relevanceGrade: candidate.relevanceGrade,
    confidence: clamp(
      0.48
        + (candidate.exactSection ? 0.17 : 0)
        + Math.min(candidate.overlap.f1, 0.3),
    ),
    labelSource: "gold_section_weak_supervision",
    reviewStatus: "machine_proposed",
  }));

  return {
    available: true,
    goldChunkIds: goldChunks.map((chunk) => chunk.chunkId),
    judgments,
    labelConfidence: average(judgments.map((judgment) => judgment.confidence)),
    labelSource: "gold_section_weak_supervision",
    reason:
      "Non-gold precedent chunks were weakly labelled from section identity and lexical alignment to the hidden gold section. Inspector confirmation is still required for promotion-grade labels.",
  };
}

export function scoreRetrievalRanking({
  goldChunkIds = [],
  judgments = [],
  k = DEFAULT_RETRIEVAL_K,
  retrieved = [],
}) {
  const normalizedK = Math.max(1, Number.isInteger(k) ? k : DEFAULT_RETRIEVAL_K);
  const uniqueRetrieved = dedupeRetrieved(retrieved);
  const cutoff = uniqueRetrieved.slice(0, normalizedK);
  const relevanceByChunkId = new Map(
    judgments.map((judgment) => [judgment.chunkId, Number(judgment.relevanceGrade ?? 0)]),
  );
  const relevantJudgments = judgments.filter((judgment) => Number(judgment.relevanceGrade ?? 0) > 0);
  const relevantAtK = cutoff.filter((item) => (relevanceByChunkId.get(item.chunkId) ?? 0) > 0);
  const precisionAtK = relevantAtK.length / normalizedK;
  const recallAtK = relevantJudgments.length > 0
    ? relevantAtK.length / relevantJudgments.length
    : 0;
  const f1AtK = harmonicMean(precisionAtK, recallAtK);
  const reciprocalRank = scoreReciprocalRank(uniqueRetrieved, relevanceByChunkId);
  const ndcgAtK = scoreNdcgAtK(cutoff, relevantJudgments, relevanceByChunkId, normalizedK);
  const goldIds = new Set(goldChunkIds);
  const sameGoldRetrieved = uniqueRetrieved.filter((item) => goldIds.has(item.chunkId));

  return {
    available: relevantJudgments.length > 0,
    k: normalizedK,
    retrievedCount: uniqueRetrieved.length,
    relevantLabelCount: relevantJudgments.length,
    relevantRetrievedAtK: relevantAtK.length,
    precisionAtK: clamp(precisionAtK),
    recallAtK: clamp(recallAtK),
    f1AtK: clamp(f1AtK),
    reciprocalRank: clamp(reciprocalRank),
    ndcgAtK: clamp(ndcgAtK),
    sameGoldRetrievedCount: sameGoldRetrieved.length,
    sameGoldRetrievedChunkIds: sameGoldRetrieved.map((item) => item.chunkId),
    labelConfidence: average(relevantJudgments.map((judgment) => Number(judgment.confidence ?? 0))),
    labelSource: relevantJudgments[0]?.labelSource ?? null,
  };
}

export function scoreGeneratedFactMetrics({
  allowedEvidence,
  generatedContent,
  requiredFacts = [],
}) {
  const generatedText = normalizeText(stripHtml(generatedContent));
  const generatedRows = extractTableRows(generatedContent);
  const allowedText = normalizeText(
    typeof allowedEvidence === "string" ? allowedEvidence : JSON.stringify(allowedEvidence ?? {}),
  );
  const requiredFactResults = requiredFacts.map((fact) => ({
    factKey: fact.factKey,
    matched: matchesRequiredFact(generatedText, generatedRows, fact),
    sourceClass: fact.sourceClass ?? "app_capture",
  }));
  const matchedFactCount = requiredFactResults.filter((result) => result.matched).length;
  const requiredFactRecall = requiredFactResults.length > 0
    ? matchedFactCount / requiredFactResults.length
    : 0;
  const claims = extractVerifiableClaims(generatedText);
  const supportedClaims = claims.filter((claim) => isClaimSupported(claim, allowedText));
  const unsupportedClaims = claims.filter((claim) => !isClaimSupported(claim, allowedText));
  const claimPrecision = claims.length > 0 ? supportedClaims.length / claims.length : 0;

  return {
    claimPrecisionAvailable: claims.length > 0,
    claimPrecision: clamp(claimPrecision),
    verifiableClaimCount: claims.length,
    supportedClaimCount: supportedClaims.length,
    unsupportedClaims: unsupportedClaims.slice(0, 20),
    requiredFactRecallAvailable: requiredFactResults.length > 0,
    requiredFactRecall: clamp(requiredFactRecall),
    requiredFactCount: requiredFactResults.length,
    matchedRequiredFactCount: matchedFactCount,
    missingRequiredFactKeys: requiredFactResults
      .filter((result) => !result.matched)
      .map((result) => result.factKey)
      .slice(0, 30),
    scope:
      "Claim precision covers deterministic identifiers and numeric/unit claims. Required-fact recall covers section-labelled facts from the current app capture; it is not free-form semantic recall.",
  };
}

export function buildSectionRequiredFacts({ reportState, sectionId }) {
  const pkg = reportState?.exportPackage ?? {};
  const inspection = pkg.inspectionRecord ?? {};
  const task = pkg.task ?? {};
  const facts = [];
  const addFact = (factKey, groups, sourceClass = "app_capture", rowAliases = []) => {
    const normalizedGroups = groups
      .map((group) => (Array.isArray(group) ? group : [group]))
      .map((group) => group.filter((value) => value !== null && value !== undefined && String(value).trim()))
      .filter((group) => group.length > 0);
    if (normalizedGroups.length > 0) {
      facts.push({
        factKey,
        groups: normalizedGroups,
        sourceClass,
        rowAliases: rowAliases.filter((value) => value !== null && value !== undefined && String(value).trim()),
      });
    }
  };

  if (["cover", "general-tank-information"].includes(sectionId)) {
    addFact("client", [[inspection.client, task.client]]);
    addFact("tank_number", [[inspection.tankNumber, task.tankNumber]]);
  }
  if (sectionId === "general-tank-information") {
    addFact("location", [[inspection.location, task.location]]);
    addFact("diameter", [numericAliases(inspection.diameterM)]);
    addFact("height", [numericAliases(inspection.heightM)]);
    addFact("shell_course_count", [[inspection.shellCourseCount]]);
    addFact("external_roof_type", [[inspection.externalRoofType]]);
  }
  if (["inspection-report", "repair-recommendations", "photographs"].includes(sectionId)) {
    for (const finding of pkg.findings ?? []) {
      const areaAlias = String(finding.findingId ?? "").match(/area-(\d+)/i)?.[1];
      addFact(
        `finding:${finding.findingId ?? finding.itemLabel}`,
        [[finding.itemLabel, areaAlias ? `Area ${areaAlias}` : null]],
      );
    }
  }
  if (sectionId === "tank-inspection-checklist") {
    for (const item of pkg.inspectionChecklistItems ?? pkg.checklistItems ?? []) {
      addFact(
        `checklist:${item.sectionKey}:${item.itemNumber}`,
        [[item.ratingLabel, item.ratingKey]],
        "app_capture",
        [item.itemPrompt, item.itemNumber],
      );
    }
  }

  const measurementTarget = measurementTargetForSection(sectionId);
  if (measurementTarget) {
    const measurements = (pkg.utMeasurements ?? []).filter((measurement) => (
      measurement.targetKey === measurementTarget.targetKey
        && (!measurementTarget.itemKind || measurement.itemKind === measurementTarget.itemKind)
    ));
    for (const measurement of measurements) {
      const locationAliases = [
        measurement.itemLabel,
        measurement.plateId ? `Plate ${measurement.plateId}` : null,
        measurement.elementId,
        measurement.laneId && measurement.course
          ? `${measurement.laneId}-${measurement.course}`
          : null,
      ];
      const values = [
        measurement.value1,
        measurement.value2,
        measurement.value3,
        measurement.value4,
        measurement.value5,
        measurement.reinforcementPadReading,
      ].filter((value) => value !== null && value !== undefined);
      values.forEach((value, index) => {
        addFact(
          `measurement:${measurement.itemKey}:value${index + 1}`,
          [numericAliases(value)],
          "app_capture",
          [...locationAliases, measurement.plateId],
        );
      });
    }
  }

  return dedupeFacts(facts);
}

export function scoreTokenF1(leftText, rightText) {
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
    f1: harmonicMean(precision, recall),
    overlapCount,
  };
}

function measurementTargetForSection(sectionId) {
  if (sectionId === "roof-plate-thickness-measurements") return { targetKey: "external_roof", itemKind: "region" };
  if (sectionId === "roof-nozzle-reinforcement-pad-thickness-measurements") return { targetKey: "external_roof", itemKind: "element" };
  if (sectionId === "shell-plate-thickness-measurements") return { targetKey: "shell", itemKind: "region" };
  if (sectionId === "shell-nozzle-reinforcement-pad-thickness-measurements") return { targetKey: "shell", itemKind: "element" };
  if (sectionId === "floor-plate-thickness-measurements") return { targetKey: "floor", itemKind: "region" };
  return null;
}

function matchesRequiredFact(generatedText, generatedRows, fact) {
  const candidateTexts = fact.rowAliases?.length > 0
    ? generatedRows.filter((row) => fact.rowAliases.some((alias) => containsAlias(row, alias)))
    : [generatedText.toLowerCase()];
  return candidateTexts.some((candidateText) => (
    (fact.groups ?? []).every((group) => group.some((alias) => containsAlias(candidateText, alias)))
  ));
}

function containsAlias(text, alias) {
  const lower = String(text ?? "").toLowerCase();
  const normalizedAlias = normalizeComparable(alias);
  if (!normalizedAlias) return false;
  if (/^\d+(?:\.\d+)?$/.test(normalizedAlias)) {
    return new RegExp(`(^|[^0-9.])${escapeRegExp(normalizedAlias)}(?:0+)?([^0-9.]|$)`).test(lower);
  }
  return lower.includes(normalizedAlias);
}

function extractTableRows(value) {
  return [...String(value ?? "").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => normalizeText(stripHtml(match[1])).toLowerCase())
    .filter(Boolean);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractVerifiableClaims(value) {
  const matches = String(value ?? "").match(
    /\b(?:API\s*\d{3}|EEMUA\s*\d{3}|LAIQ-[A-Z0-9-]+|[A-Z]{1,4}-\d+[A-Z0-9/-]*|(?:Area|Strake|Plate|Course)\s+\d+[A-Za-z]?|\d+(?:\.\d+)?\s?(?:mm|cm|m|in|inch|inches|%|years?|months?|days?))\b/gi,
  ) ?? [];
  return [...new Set(matches.map((match) => normalizeComparable(match)).filter(Boolean))];
}

function isClaimSupported(claim, allowedText) {
  const normalizedAllowed = allowedText.toLowerCase();
  if (normalizedAllowed.includes(claim)) return true;
  const numeric = claim.match(/\d+(?:\.\d+)?/g) ?? [];
  return numeric.length > 0 && numeric.every((value) => normalizedAllowed.includes(value));
}

function scoreReciprocalRank(retrieved, relevanceByChunkId) {
  const firstRelevantIndex = retrieved.findIndex((item) => (
    (relevanceByChunkId.get(item.chunkId) ?? 0) > 0
  ));
  return firstRelevantIndex < 0 ? 0 : 1 / (firstRelevantIndex + 1);
}

function scoreNdcgAtK(cutoff, relevantJudgments, relevanceByChunkId, k) {
  const dcg = cutoff.reduce((sum, item, index) => {
    const relevance = relevanceByChunkId.get(item.chunkId) ?? 0;
    return sum + ((2 ** relevance) - 1) / Math.log2(index + 2);
  }, 0);
  const idealGrades = relevantJudgments
    .map((judgment) => Number(judgment.relevanceGrade ?? 0))
    .sort((left, right) => right - left)
    .slice(0, k);
  const idealDcg = idealGrades.reduce(
    (sum, relevance, index) => sum + ((2 ** relevance) - 1) / Math.log2(index + 2),
    0,
  );
  return idealDcg > 0 ? dcg / idealDcg : 0;
}

function dedupeRetrieved(retrieved) {
  const seen = new Set();
  return (retrieved ?? [])
    .map((item) => typeof item === "string" ? { chunkId: item } : item)
    .filter((item) => item?.chunkId)
    .filter((item) => {
      if (seen.has(item.chunkId)) return false;
      seen.add(item.chunkId);
      return true;
    });
}

function dedupeFacts(facts) {
  const seen = new Set();
  return facts.filter((fact) => {
    if (seen.has(fact.factKey)) return false;
    seen.add(fact.factKey);
    return true;
  });
}

function numericAliases(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return [];
  return [...new Set([
    String(number),
    number.toFixed(1),
    number.toFixed(2),
    number.toFixed(3),
  ])];
}

function normalizeComparable(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .toLowerCase()
    .match(/\b[a-z0-9][a-z0-9-]{2,}\b/g) ?? [];
}

function countTokens(tokens) {
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
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

function harmonicMean(left, right) {
  return left + right === 0 ? 0 : clamp((2 * left * right) / (left + right));
}

function average(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length > 0 ? finite.reduce((sum, value) => sum + value, 0) / finite.length : 0;
}

function clamp(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
