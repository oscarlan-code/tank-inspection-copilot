import { randomUUID } from "node:crypto";
import { getSectionTemplate, MANUAL_FIELD_LABELS } from "./generation.mjs";
import {
  loadPrecedentKbIndex,
  searchPrecedentPack,
} from "./precedent-kb.mjs";
import { API_STANDARD_PRIMARY_REPORT } from "./report-toc.mjs";
import { resolveEvaluationCase } from "./evaluation-cases.mjs";
import {
  buildSectionRequiredFacts,
  deriveWeakGoldRelevanceJudgments,
  EVALUATION_METRIC_SCHEMA_VERSION,
  scoreGeneratedFactMetrics,
  scoreRetrievalRanking,
} from "./evaluation-metrics.mjs";

const EVALUATOR_KEY = "deterministic_reference_guard.v2";

export function evaluateTruthGraphRecovery({ facts = [], generatedContent }) {
  const text = normalizeText(stripHtml(generatedContent)).toLowerCase();
  const observable = facts.filter((fact) => ["app_observable", "voice_observable", "deterministic_derived"].includes(fact.answerability_class));
  const required = observable.filter((fact) => Boolean(fact.required_fact));
  const protectedFacts = observable.filter((fact) => ["measurement", "layout_geometry"].includes(fact.evidence_class)
    || fact.safety_criticality === "critical");
  const protectedDefaultUnit = /all readings (?:are |in )*mm\b/.test(observable.flatMap(factValueTokens).join(" ")) ? "mm" : "";
  const requiredChecks = required.flatMap((fact) => ["measurement", "layout_geometry"].includes(fact.evidence_class)
    ? buildProtectedChecks(fact, protectedDefaultUnit)
    : [{ factId:fact.fact_id,kind:"fact",expected:factValueTokens(fact)[0]??fact.fact_id,matches:(value)=>matchesTruthFact(value,fact) }]);
  const requiredMatchedChecks = requiredChecks.filter((check) => check.matches(text));
  const protectedChecks = protectedFacts.flatMap((fact) => buildProtectedChecks(fact, protectedDefaultUnit));
  const protectedMatchedChecks = protectedChecks.filter((check) => check.matches(text));
  const verifiableClaims = extractNarrativeVerifiableClaims(text);
  const goldText = normalizeText(observable.flatMap(factValueTokens).join(" "));
  const unsupportedClaims = verifiableClaims.filter((claim) => !goldContainsEquivalentClaim(claim, goldText)
    && !matchesDeterministicDifference(claim, text, goldText));
  const claimPrecision = verifiableClaims.length === 0 ? 1 : (verifiableClaims.length - unsupportedClaims.length) / verifiableClaims.length;
  const protectedFactAccuracy = protectedChecks.length === 0 ? 1 : protectedMatchedChecks.length / protectedChecks.length;
  return {
    goldStandardType: "approved_truth_graph",
    observableFactCount: observable.length,
    requiredFactCount: requiredChecks.length,
    requiredSourceFactCount: required.length,
    matchedRequiredFactCount: requiredMatchedChecks.length,
    requiredFactRecall: requiredChecks.length === 0 ? 1 : requiredMatchedChecks.length / requiredChecks.length,
    claimPrecision,
    protectedFactCount: protectedChecks.length,
    protectedSourceFactCount: protectedFacts.length,
    protectedFactAccuracy,
    protectedFactMismatchCount: protectedChecks.length - protectedMatchedChecks.length,
    protectedFactMismatches: protectedChecks.filter((check) => !check.matches(text)).slice(0,20).map((check) => ({ factId:check.factId,kind:check.kind,expected:check.expected })),
    unsupportedClaimCount: unsupportedClaims.length,
    unsupportedClaims: unsupportedClaims.slice(0, 20),
    containsGoldContentInGenerationState: false,
  };
}

function extractNarrativeVerifiableClaims(text) {
  const claims=[];
  const pattern=/(?<![a-z0-9.])([+\-]?\d+(?:\.\d+)?)(?:\s*(mm\/year|mm\/yr|mm|cm|m|%|psi|mpa|bar))?\b/g;
  for(const match of text.matchAll(pattern)){
    const value=String(match[1]??"");
    const unit=String(match[2]??"").toLowerCase();
    const start=match.index??0;
    const context=text.slice(Math.max(0,start-45),Math.min(text.length,start+value.length+45));
    const signed=/^[+\-]/.test(value);
    const measurementContext=/\b(?:thickness|reading|measurement|diameter|depth|loss|corrosion rate|remaining|minimum|maximum|limit|tolerance)\b/.test(context);
    const codeReference=/\b(?:api|clause|section|item|figure|table|appendix)\s*[a-z.-]*\s*$/i.test(text.slice(Math.max(0,start-24),start));
    if(unit||signed||(measurementContext&&!codeReference))claims.push(`${value}${unit?` ${unit}`:""}`.trim());
  }
  return claims;
}

export function evaluateGoldSectionRecovery({ goldContent = "", generatedContent = "", evaluationMode = "direct_recovery", minimumContentCoverage = 0.55 }) {
  const goldText = normalizeText(stripHtml(goldContent)).toLowerCase();
  const generatedText = normalizeText(stripHtml(generatedContent)).toLowerCase();
  const goldTokens = new Set(contentTokens(goldText));
  const generatedTokens = new Set(contentTokens(generatedText));
  const matchedTokens = [...goldTokens].filter((token) => generatedTokens.has(token));
  const contentCoverage = goldTokens.size === 0 ? null : matchedTokens.length / goldTokens.size;
  const lengthRatio = goldText.length === 0 ? null : generatedText.length / goldText.length;
  const lengthBalance = lengthRatio == null || lengthRatio <= 0 ? null : Math.min(lengthRatio, 1 / lengthRatio);
  const goldTableRows = countTableRows(goldContent);
  const generatedTableRows = countTableRows(generatedContent);
  const tableStructureCoverage = goldTableRows === 0
    ? (generatedTableRows === 0 ? null : 0)
    : Math.min(generatedTableRows, goldTableRows) / goldTableRows;
  return {
    evaluationMode,
    minimumContentCoverage:Number(minimumContentCoverage),
    goldTokenCount: goldTokens.size,
    matchedGoldTokenCount: matchedTokens.length,
    contentCoverage,
    goldCharacterCount: goldText.length,
    generatedCharacterCount: generatedText.length,
    lengthRatio,
    lengthBalance,
    goldTableRowCount: goldTableRows,
    generatedTableRowCount: generatedTableRows,
    tableStructureCoverage,
  };
}

export function evaluateSectionFormatContract({ sectionId, goldContent = "", generatedContent = "" }) {
  const gold = sectionStructure(goldContent);
  const generated = sectionStructure(generatedContent);
  const expectedKind = expectedSectionKind(sectionId, gold);
  const checks = [
    formatCheck("clean_export", "Clean export markup", generated.artifactCount === 0, generated.artifactCount === 0 ? 1 : 0, generated.artifacts),
    formatCheck("section_heading", "Section heading", generated.headingCount > 0, generated.headingCount > 0 ? 1 : 0, ["A numbered section heading is required."]),
    formatCheck("body_structure", "Readable body structure", generated.blockCount > 0, generated.blockCount > 0 ? 1 : 0, ["The section contains no readable report blocks."]),
  ];
  if (expectedKind === "table") {
    checks.push(formatCheck("table_structure", "Table structure", generated.tableCount > 0, generated.tableCount > 0 ? rowBalance(gold.tableRowCount, generated.tableRowCount) : 0, ["This section requires a structured table."]));
  } else if (expectedKind === "list") {
    checks.push(formatCheck("finding_structure", "Finding/list structure", generated.listItemCount > 0, generated.listItemCount > 0 ? countBalance(gold.listItemCount, generated.listItemCount) : 0, ["This section requires grouped findings or recommendations."]));
  } else {
    checks.push(formatCheck("paragraph_structure", "Paragraph structure", generated.paragraphCount > 0, generated.paragraphCount > 0 ? countBalance(gold.paragraphCount, generated.paragraphCount) : 0, ["This section requires professional narrative paragraphs."]));
  }
  const score = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;
  return {
    contractVersion: "irs_pdf_section_v1",
    expectedKind,
    score,
    pass: score >= 0.8 && checks.every((check) => check.required !== true || check.pass),
    checks,
    goldStructure: gold,
    generatedStructure: generated,
  };
}

function sectionStructure(value) {
  const source = String(value ?? "");
  const text = normalizeText(stripHtml(source));
  const markdownLines = source.split(/\r?\n/);
  const markdownTableRows = markdownLines.filter((line) => /^\s*\|.*\|\s*$/.test(line) && !/^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(line)).length;
  const htmlTableRows = (source.match(/<tr\b/gi) ?? []).length;
  const headingCount = (source.match(/<h[1-4]\b/gi) ?? []).length + markdownLines.filter((line) => /^\s*\d+(?:\.\d+)*\s+[A-Z]/.test(line)).length;
  const listItemCount = (source.match(/<li\b/gi) ?? []).length + markdownLines.filter((line) => /^\s*(?:[•▪-]|\d+[.)])\s+/.test(line)).length;
  const paragraphCount = Math.max((source.match(/<p\b/gi) ?? []).length, text.split(/\n\s*\n/).filter((item) => item.trim().length > 30).length);
  const artifacts = [
    ...(/(?:\\n|\uFFFD|\{\s*"(?:text|sourceHeading|sourceBlockType)"\s*:)/i.test(source) ? ["Raw extraction or JSON artifacts are visible."] : []),
    ...(/\b(?:lorem ipsum|undefined|null)\b/i.test(text) ? ["Placeholder or invalid values are visible."] : []),
    ...(/\bpending confirmation\b/i.test(text) ? ["Unresolved placeholder language is visible."] : []),
  ];
  return {
    characterCount: text.length,
    headingCount,
    paragraphCount,
    listItemCount,
    tableCount: (source.match(/<table\b/gi) ?? []).length + (markdownTableRows > 0 ? 1 : 0),
    tableRowCount: Math.max(markdownTableRows, htmlTableRows),
    blockCount: paragraphCount + listItemCount + Math.max(markdownTableRows, htmlTableRows),
    artifactCount: artifacts.length,
    artifacts,
  };
}

function expectedSectionKind(sectionId, gold) {
  if (/information|checklist|measurement|calculation|test-information/.test(String(sectionId))) return "table";
  if (/inspection-report|recommendation|finding|scope/.test(String(sectionId)) || gold.listItemCount > 1) return "list";
  if (gold.tableCount > 0) return "table";
  return "narrative";
}

function formatCheck(key, label, pass, score, notes = []) {
  return { key, label, pass, score: Math.max(0, Math.min(1, Number(score) || 0)), required: ["clean_export", "section_heading", "body_structure"].includes(key), notes: pass ? [] : notes };
}

function countBalance(expected, actual) {
  if (!expected) return actual > 0 ? 1 : 0;
  return Math.min(actual / expected, expected / Math.max(actual, 1));
}

function rowBalance(expected, actual) { return countBalance(expected, actual); }

const CONTENT_STOP_WORDS = new Set("the a an and or of to in is are was were be been for from with by on at as that this it its their should may can could would report section tank inspection".split(" "));
function contentTokens(value) { return (String(value).match(/[a-z][a-z0-9-]{2,}/g) ?? []).filter((token) => !CONTENT_STOP_WORDS.has(token)); }
function countTableRows(value) {
  const markdownRows = String(value).split(/\r?\n/).filter((line) => /^\s*\|.*\|\s*$/.test(line) && !/^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(line)).length;
  const htmlRows = (String(value).match(/<tr\b/gi) ?? []).length;
  return Math.max(markdownRows, htmlRows);
}

function goldContainsEquivalentClaim(claim, goldText) {
  if (goldText.includes(claim)) return true;
  const parsed = String(claim).match(/^([+\-]?\d+(?:\.\d+)?)\s*(mm|cm|m|%|psi|mpa|bar)?$/);
  if (!parsed) return false;
  const targetNumber = canonicalNumber(parsed[1]);
  const targetUnit = String(parsed[2] ?? "").toLowerCase();
  return [...goldText.matchAll(/(?<![a-z0-9.])([+\-]?\d+(?:\.\d+)?)\s*(mm|cm|m|%|psi|mpa|bar)?\b/g)].some((match) => {
    const sourceUnit = String(match[2] ?? "").toLowerCase();
    return canonicalNumber(match[1]) === targetNumber && (!targetUnit || !sourceUnit || sourceUnit === targetUnit);
  });
}

function matchesDeterministicDifference(claim, generatedText, goldText) {
  const target = Number(String(claim).match(/[+\-]?\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(target)) return false;
  const claimIndex = generatedText.indexOf(String(claim).toLowerCase());
  if (claimIndex < 0) return false;
  const nearby = generatedText.slice(Math.max(0, claimIndex - 100), claimIndex + String(claim).length + 100);
  if (!/\b(?:difference|differential|exceed(?:ed|ing|s)?|above|below|margin|reduction|increase)\b/.test(nearby)) return false;
  const sourceNumbers = [...goldText.matchAll(/[+\-]?\d+(?:\.\d+)?/g)].map((match) => Number(match[0])).filter(Number.isFinite);
  for (let left = 0; left < sourceNumbers.length; left += 1) {
    for (let right = left + 1; right < sourceNumbers.length; right += 1) {
      if (Math.abs(Math.abs(sourceNumbers[left] - sourceNumbers[right]) - Math.abs(target)) < 0.000001) return true;
    }
  }
  return false;
}

function buildProtectedChecks(fact, defaultUnit = "") {
  if (!["measurement", "layout_geometry"].includes(fact.evidence_class)) {
    return [{ factId: fact.fact_id, kind: "fact", expected: factValueTokens(fact)[0] ?? fact.fact_id, matches: (text) => matchesTruthFact(text, fact) }];
  }
  const source = factValueTokens(fact).join(" ");
  const atomic = extractAtomicProtectedClaims(source, defaultUnit);
  if (atomic.length === 0) return [{ factId: fact.fact_id, kind: "fact", expected: source, matches: (text) => matchesTruthFact(text, fact) }];
  return atomic.map((claim) => ({ factId: fact.fact_id, ...claim, matches: (text) => claimMatches(text, claim) }));
}

function extractAtomicProtectedClaims(value, defaultUnit = "") {
  const text = normalizeMeasurementText(value);
  const claims = [];
  for (const match of text.matchAll(/\b(?:station|course|plate|tank(?:\s+(?:no|number))?)\s*[:#.-]?\s*[a-z]?-?\d+(?:\.\d+)?\b/gi)) {
    claims.push({ kind: "identity", expected: normalizeText(match[0]).toLowerCase() });
  }
  for (const match of text.matchAll(/(?:^|[^a-z0-9])([+\-]?\d+(?:\.\d+)?)(?:\s*(mm\/year|mm\/yr|mm|cm|mpa|psi|bar|ft|in|m|%))?/gi)) {
    const explicitUnit = String(match[2] ?? "").toLowerCase();
    const numeric = canonicalNumber(match[1]);
    if (numeric == null || (!explicitUnit && Number(numeric) >= 1900 && Number(numeric) <= 2100)) continue;
    const numericOffset=(match.index??0)+match[0].indexOf(match[1]);
    const unit = explicitUnit || (defaultUnit && isBareTableNumericCell(text,numericOffset) ? defaultUnit : "");
    claims.push({ kind: unit ? "measurement" : "numeric_identity", expected: unit ? `${numeric} ${unit}` : numeric, numeric, unit });
  }
  const seen = new Set();
  return claims.filter((claim) => {
    const key = `${claim.kind}:${claim.expected}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isBareTableNumericCell(text,index){const left=text.lastIndexOf("|",index);const right=text.indexOf("|",index);if(left<0||right<0)return false;const previousDelimiter=text.lastIndexOf("|",left-1);if(previousDelimiter<0||text.slice(previousDelimiter+1,left).trim()==="")return false;return /^[+\-]?\d+(?:\.\d+)?$/.test(text.slice(left+1,right).trim());}

function claimMatches(generatedText, claim) {
  const text = normalizeMeasurementText(generatedText);
  if (claim.kind === "identity") return text.includes(claim.expected);
  return extractGeneratedClaims(text).some((item) => item.numeric === claim.numeric && item.unit === claim.unit);
}

function extractGeneratedClaims(text) {
  const claims = [];
  for (const match of text.matchAll(/(?:^|[^a-z0-9])([+\-]?\d+(?:\.\d+)?)(?:\s*(mm\/year|mm\/yr|mm|cm|mpa|psi|bar|ft|in|m|%))?/gi)) {
    const numeric = canonicalNumber(match[1]);
    if (numeric != null) claims.push({ numeric, unit: String(match[2] ?? "").toLowerCase() });
  }
  return claims;
}

function canonicalNumber(value) {
  const number = Number(String(value).replace(/^\+/, ""));
  return Number.isFinite(number) ? String(number) : null;
}

function normalizeMeasurementText(value) {
  return normalizeText(String(value ?? "").replace(/[−–—]/g, "-")).toLowerCase();
}

function factValueTokens(fact) {
  const parsed = typeof fact.normalized_value_json === "string"
    ? safeParseFactValue(fact.normalized_value_json)
    : fact.normalized_value_json;
  const values = collectPrimitiveFactValues(parsed);
  const tokens = values.flatMap((value) => [value, fact.unit_code ? `${value} ${fact.unit_code}` : ""])
    .map((item) => normalizeText(item).replace(/^[{"']+|[}"']+$/g, "").toLowerCase())
    .filter((item) => item.length >= 2);
  return [...new Set(tokens)];
}

function matchesTruthFact(generatedText, fact) {
  const values = factValueTokens(fact);
  if (values.some((value) => generatedText.includes(value))) return true;
  const sourceWords = [...new Set(values.join(" ").match(/\b[a-z0-9][a-z0-9.-]{2,}\b/g) ?? [])];
  if (sourceWords.length === 0) return false;
  const numericWords = sourceWords.filter((word) => /\d/.test(word));
  if (numericWords.length > 0 && !numericWords.every((word) => generatedText.includes(word))) return false;
  const covered = sourceWords.filter((word) => generatedText.includes(word)).length;
  const requiredCoverage = sourceWords.length <= 8 ? 0.75 : 0.35;
  return covered / sourceWords.length >= requiredCoverage;
}

function safeParseFactValue(value) {
  try { return JSON.parse(value); } catch { return value; }
}

function collectPrimitiveFactValues(value) {
  if (value == null) return [];
  if (["string", "number", "boolean"].includes(typeof value)) return [String(value)];
  if (Array.isArray(value)) return value.flatMap(collectPrimitiveFactValues);
  if (typeof value === "object") {
    if (value.value != null) return collectPrimitiveFactValues(value.value);
    if (value.text != null) return collectPrimitiveFactValues(value.text);
    return Object.entries(value)
      .filter(([key]) => !["sourceHeading", "sourceBlockType", "label", "type"].includes(key))
      .flatMap(([, item]) => collectPrimitiveFactValues(item));
  }
  return [];
}

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
  const hasCapturedSectionEvidence = (reportState.exportPackage?.captureFacts ?? [])
    .some((fact) => fact.targetReportSectionId === sectionId);
  const missingManualFields = template.requiredManualFields
    .filter((fieldKey) => {
      if (hasCapturedSectionEvidence && reportState.exportPackage?.captureScenarioProvenance) return false;
      if (String(manualInputs[fieldKey] ?? "").trim()) return false;
      if (hasCapturedSectionEvidence && (fieldKey === `${sectionId}-content-source` || fieldKey === `${sectionId}-layout-source`)) return false;
      return true;
    })
    .map((fieldKey) => ({
      fieldKey,
      label: MANUAL_FIELD_LABELS[fieldKey] ?? fieldKey,
    }));
  const precedentPack = searchPrecedentPack({
    sectionId,
    reportState,
    limit: 10,
  });
  const evaluationCase = resolveEvaluationCase(reportState);
  const precedentIndex = loadPrecedentKbIndex();
  const goldSourceReportName = evaluationCase?.goldReference?.sourceReportName
    ?? API_STANDARD_PRIMARY_REPORT.sourceReportName;
  const goldReferenceChunks = precedentIndex.chunks.filter((chunk) => (
    chunk.sourceReportName === goldSourceReportName
      && chunk.sectionKey === sectionId
  ));
  const referenceChunks = goldReferenceChunks.length > 0
    ? goldReferenceChunks
    : selectReferenceChunks(precedentPack, goldSourceReportName);
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
  const relevanceLabels = deriveWeakGoldRelevanceJudgments({
    chunks: precedentIndex.chunks,
    goldSourceReportName,
    maximumRelevantChunks:
      evaluationCase?.retrievalLabels?.maximumRelevantChunksPerSection ?? 12,
    sectionId,
  });
  const retrievalApplicable = isRetrievalEvaluationApplicable({
    sectionId,
    sectionKind: template.kind,
    orchestration,
  });
  const retrievalMetrics = retrievalApplicable
    ? scoreRetrievalRanking({
        goldChunkIds: relevanceLabels.goldChunkIds,
        judgments: relevanceLabels.judgments,
        k: 3,
        retrieved: orchestration?.evidenceChain?.precedentRefs
          ?? (orchestration?.retrievalContext ?? []).filter((item) => item.sourceType === "precedent"),
      })
    : {
        available: false,
        notApplicable: true,
        reason: "This section uses an approved deterministic compiler; precedent retrieval does not control its output.",
        k: 3,
        precisionAtK: 0,
        recallAtK: 0,
        f1AtK: 0,
        reciprocalRank: 0,
        ndcgAtK: 0,
        sameGoldRetrievedCount: 0,
        labelConfidence: relevanceLabels.labelConfidence,
        labelSource: relevanceLabels.labelSource,
      };
  const generatedFactMetrics = scoreGeneratedFactMetrics({
    allowedEvidence: {
      exportPackage: reportState.exportPackage,
      manualInputs,
      calculations: orchestration?.calculationOutputs ?? [],
      mapArtifacts: orchestration?.mapArtifacts ?? [],
      standardRuleChecks: orchestration?.standardRuleChecks ?? [],
      reportClassification: orchestration?.reportClassification ?? reportState.reportClassification,
      userInstruction: orchestration?.userInstruction ?? "",
    },
    generatedContent,
    requiredFacts: buildSectionRequiredFacts({ reportState, sectionId }),
  });
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
  const contentLeakage = detectReferenceLeakage({
    generatedText,
    referenceText,
    allowedEvidenceText,
  });
  const leakage = mergeRetrievalLeakage(contentLeakage, retrievalMetrics);
  const sourceGrounding = scoreSourceGrounding({
    missingManualFields,
    blockers,
    warnings,
    leakageRiskScore: leakage.riskScore,
  });
  const leakageSafety = clamp(1 - leakage.riskScore);
  const rawScore = weightedAvailableScore([
    metricScore(formatMatch, 0.15),
    metricScore(referenceSimilarity.score, 0.1),
    metricScore(sourceGrounding, 0.15),
    metricScore(missingInputDiscipline, 0.1),
    metricScore(leakageSafety, 0.15),
    metricScore(retrievalMetrics.precisionAtK, 0.1, retrievalMetrics.available),
    metricScore(retrievalMetrics.recallAtK, 0.1, retrievalMetrics.available),
    metricScore(
      generatedFactMetrics.claimPrecision,
      0.075,
      generatedFactMetrics.claimPrecisionAvailable,
    ),
    metricScore(
      generatedFactMetrics.requiredFactRecall,
      0.075,
      generatedFactMetrics.requiredFactRecallAvailable,
    ),
  ]);
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
    ...(retrievalMetrics.available
      ? [
          buildDimension("retrieval_precision_at_3", "Retrieval Precision@3", retrievalMetrics.precisionAtK, [
            `${retrievalMetrics.relevantRetrievedAtK} of the first ${retrievalMetrics.k} retrieved precedent positions were labelled relevant.`,
          ]),
          buildDimension("retrieval_recall_at_3", "Retrieval Recall@3", retrievalMetrics.recallAtK, [
            `${retrievalMetrics.relevantRetrievedAtK} of ${retrievalMetrics.relevantLabelCount} labelled relevant precedent chunks were retrieved in the first ${retrievalMetrics.k} positions.`,
          ]),
          buildDimension("retrieval_ndcg_at_3", "Retrieval nDCG@3", retrievalMetrics.ndcgAtK, [
            "Measures whether the most relevant labelled chunks were ranked first.",
          ]),
        ]
      : []),
    ...(generatedFactMetrics.claimPrecisionAvailable
      ? [buildDimension("claim_precision", "Verifiable Claim Precision", generatedFactMetrics.claimPrecision, [
          `${generatedFactMetrics.supportedClaimCount} of ${generatedFactMetrics.verifiableClaimCount} deterministic identifier or numeric/unit claims were found in allowed current evidence.`,
        ])]
      : []),
    ...(generatedFactMetrics.requiredFactRecallAvailable
      ? [buildDimension("required_fact_recall", "Required Fact Recall", generatedFactMetrics.requiredFactRecall, [
          `${generatedFactMetrics.matchedRequiredFactCount} of ${generatedFactMetrics.requiredFactCount} section-labelled app facts were represented.`,
        ])]
      : []),
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
    evaluationCase: evaluationCase
      ? {
          caseId: evaluationCase.caseId,
          displayName: evaluationCase.displayName,
          goldReferenceRole: evaluationCase.goldReference.role,
          literalGoldFactComparison: evaluationCase.outputFactReference.literalGoldFactComparison,
        }
      : null,
    metricSchemaVersion: EVALUATION_METRIC_SCHEMA_VERSION,
    retrievalEvaluation: {
      ...retrievalMetrics,
      labelMode: relevanceLabels.labelSource,
      labelReviewStatus: evaluationCase?.retrievalLabels?.reviewStatus ?? "machine_proposed",
      labelReason: retrievalApplicable ? relevanceLabels.reason : retrievalMetrics.reason,
    },
    generatedContentEvaluation: generatedFactMetrics,
    missingUserInputs: {
      missingManualFields,
      expectedBadUntilResolved: missingManualFields.length > 0,
      capApplied: caps.find((cap) => cap.reason === "missing_user_input")?.value ?? null,
    },
    leakage,
    reference: {
      sourceReportName: goldSourceReportName,
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

function selectReferenceChunks(precedentPack, sourceReportName) {
  const primaryChunks = (precedentPack.wordingPrecedents ?? []).filter(
    (chunk) => chunk.sourceReportName === sourceReportName,
  );

  return primaryChunks.length > 0 ? primaryChunks : precedentPack.wordingPrecedents ?? [];
}

function mergeRetrievalLeakage(contentLeakage, retrievalMetrics) {
  if (retrievalMetrics.sameGoldRetrievedCount === 0) return contentLeakage;
  return {
    ...contentLeakage,
    riskScore: 1,
    statusCode: "high",
    sameGoldRetrievedCount: retrievalMetrics.sameGoldRetrievedCount,
    notes: [
      ...contentLeakage.notes,
      `${retrievalMetrics.sameGoldRetrievedCount} hidden gold chunk${retrievalMetrics.sameGoldRetrievedCount === 1 ? " was" : "s were"} retrieved during generation.`,
    ],
  };
}

function metricScore(score, weight, available = true) {
  return { available, score, weight };
}

function weightedAvailableScore(metrics) {
  const available = metrics.filter((metric) => metric.available);
  const weightTotal = available.reduce((sum, metric) => sum + metric.weight, 0);
  if (weightTotal === 0) return 0;
  return clamp(
    available.reduce((sum, metric) => sum + metric.score * metric.weight, 0) / weightTotal,
  );
}

function isRetrievalEvaluationApplicable({ sectionId, sectionKind, orchestration }) {
  if (sectionKind === "map") return false;
  if (sectionId === "tank-inspection-checklist") return false;
  if (/thickness-measurements/.test(sectionId)) return false;
  if (orchestration?.systemRlPolicy?.configuration?.agentRoute === "deterministic_first" && sectionKind === "structured") {
    return false;
  }
  return true;
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
  if (blockers.length > 0 || leakage.riskScore >= 0.65) return "blocked";
  if (missingManualFields.length > 0) return "needs_attention";
  if (score >= 0.75) return "ready_for_review";
  return "needs_attention";
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
  if (["pass", "ready_for_review"].includes(outcomeCode)) {
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
  if (["pass", "ready_for_review"].includes(outcomeCode)) {
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
    .replace(/\\[nrt]/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
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
