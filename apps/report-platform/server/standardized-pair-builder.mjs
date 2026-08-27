import { createHash } from "node:crypto";

export const STANDARDIZED_PAIR_CONTRACT_VERSION = 11;
export const STANDARDIZED_PAIR_TRUTH_GRAPH_VERSION = 3;

export function createStandardizedPairBuilder({ db }) {
  return { buildAll, buildBaselines, getStatus };

  async function buildBaselines() {
    const cases = await db.prepare(
      `SELECT training_case_id, gold_document_id, dataset_split, report_family,
        truth_graph_version, truth_graph_sha256, asset_lineage_key
      FROM report_training_cases WHERE status_code='case_approved' AND truth_graph_version=?`,
    ).all(STANDARDIZED_PAIR_TRUTH_GRAPH_VERSION);
    let goldSections = 0;
    let readyBaselines = 0;
    let quarantinedBaselines = 0;
    for (const truthCase of cases) {
      const facts = await loadFacts(truthCase.training_case_id);
      const chunks = await loadChunks(truthCase.gold_document_id);
      for (const sectionKey of new Set(facts.map((fact) => fact.section_key))) {
        const sectionFacts = facts.filter((fact) => fact.section_key === sectionKey);
        const sectionChunks = chunks.filter((chunk) => chunk.section_type === sectionKey);
        const targetContent = sectionChunks.map((chunk) => chunk.content).filter(Boolean).join("\n\n").trim();
        const goldSectionId = stableId("gold", truthCase.training_case_id, sectionKey, STANDARDIZED_PAIR_CONTRACT_VERSION);
        const provenance = {
          documentId: truthCase.gold_document_id,
          chunkIds: sectionChunks.map((chunk) => chunk.chunk_id),
          blockIds: unique(sectionFacts.flatMap((fact) => parseJson(fact.source_block_ids_json, []))),
          pageNumbers: unique(sectionFacts.map((fact) => fact.source_page_number).filter(Boolean)),
        };
        await upsertGoldSection({ goldSectionId, truthCase, sectionKey, targetContent, sectionFacts, provenance });
        goldSections += 1;
        const baseline = buildBaseline({ truthCase, goldSectionId, sectionKey, sectionFacts, allFacts: facts, targetContent });
        await upsertBaseline(baseline);
        if (baseline.status === "ready") readyBaselines += 1;
        else quarantinedBaselines += 1;
      }
    }
    return { truthCases: cases.length, goldSections, readyBaselines, quarantinedBaselines, contractVersion: STANDARDIZED_PAIR_CONTRACT_VERSION };
  }

  async function buildAll() {
    const cases = await db.prepare(
      `SELECT training_case_id, gold_document_id, dataset_split, report_family,
        truth_graph_version, truth_graph_sha256, asset_lineage_key
      FROM report_training_cases WHERE status_code = 'case_approved' AND truth_graph_version=?`,
    ).all(STANDARDIZED_PAIR_TRUTH_GRAPH_VERSION);
    let goldSections = 0;
    let readyPairs = 0;
    let quarantinedPairs = 0;
    for (const truthCase of cases) {
      const facts = await loadFacts(truthCase.training_case_id);
      const chunks = await loadChunks(truthCase.gold_document_id);
      const variants = await db.prepare(
        `SELECT variant_id, dataset_split, lane_code, random_seed, manifest_json,
          profile_version_id FROM report_capture_variants
        WHERE training_case_id = ? AND status_code IN ('approved', 'round_trip_ready', 'materialized')`,
      ).all(truthCase.training_case_id);
      const sections = new Set(facts.map((fact) => fact.section_key));
      for (const sectionKey of sections) {
        const sectionFacts = facts.filter((fact) => fact.section_key === sectionKey);
        const sectionChunks = chunks.filter((chunk) => chunk.section_type === sectionKey);
        const targetContent = sectionChunks.map((chunk) => chunk.content).filter(Boolean).join("\n\n").trim();
        const goldSectionId = stableId("gold", truthCase.training_case_id, sectionKey, STANDARDIZED_PAIR_CONTRACT_VERSION);
        const provenance = {
          documentId: truthCase.gold_document_id,
          chunkIds: sectionChunks.map((chunk) => chunk.chunk_id),
          blockIds: unique(sectionFacts.flatMap((fact) => parseJson(fact.source_block_ids_json, []))),
          pageNumbers: unique(sectionFacts.map((fact) => fact.source_page_number).filter(Boolean)),
        };
        await upsertGoldSection({ goldSectionId, truthCase, sectionKey, targetContent, sectionFacts, provenance });
        goldSections += 1;
        for (const variant of variants) {
          const links = await loadLinks(variant.variant_id, sectionKey);
          const result = buildPair({ truthCase, variant, goldSectionId, sectionKey, sectionFacts, links, targetContent });
          await upsertPair(result);
          if (result.status === "ready") readyPairs += 1;
          else quarantinedPairs += 1;
        }
      }
    }
    return { truthCases: cases.length, goldSections, readyPairs, quarantinedPairs, contractVersion: STANDARDIZED_PAIR_CONTRACT_VERSION };
  }

  async function getStatus() {
    const rows = await db.prepare(
      `SELECT dataset_split, status_code, COUNT(*)::int AS pair_count
      FROM report_standardized_mock_gold_pairs GROUP BY dataset_split, status_code`,
    ).all();
    const gold = await db.prepare("SELECT COUNT(*)::int AS count FROM report_standardized_gold_sections").get();
    return { contractVersion: STANDARDIZED_PAIR_CONTRACT_VERSION, goldSections: Number(gold?.count ?? 0), pairs: rows };
  }

  async function loadFacts(caseId) {
    return db.prepare(
      `SELECT f.*, a.answerability_class, a.required_fact, a.expected_generator_behavior
      FROM report_training_case_facts f
      JOIN report_training_case_answerability a ON a.training_case_id=f.training_case_id AND a.fact_id=f.fact_id
      WHERE f.training_case_id=? AND f.review_status='approved' AND a.review_status='approved'
      ORDER BY f.section_key, f.fact_id`,
    ).all(caseId);
  }

  async function loadChunks(documentId) {
    return db.prepare(
      `SELECT chunk_id, section_type, content, page_numbers_json, source_block_ids_json
      FROM kb_chunks WHERE document_id=? ORDER BY stable_order`,
    ).all(documentId);
  }

  async function loadLinks(variantId, sectionKey) {
    return db.prepare(
      `SELECT l.*, f.normalized_value_json, f.unit_code, f.evidence_class,
        f.safety_criticality, a.answerability_class, a.required_fact
      FROM report_capture_variant_fact_links l
      JOIN report_training_case_facts f ON f.fact_id=l.fact_id AND f.training_case_id=l.training_case_id
      JOIN report_training_case_answerability a ON a.fact_id=f.fact_id AND a.training_case_id=f.training_case_id
      WHERE l.variant_id=? AND f.section_key=? ORDER BY l.stable_order`,
    ).all(variantId, sectionKey);
  }

  async function upsertGoldSection({ goldSectionId, truthCase, sectionKey, targetContent, sectionFacts, provenance }) {
    const now = new Date().toISOString();
    const normalizedFacts = sectionFacts.map(normalizedGoldFact);
    await db.prepare(
      `INSERT INTO report_standardized_gold_sections (
        gold_section_id, training_case_id, source_document_id, section_key, contract_version,
        dataset_split, target_content, normalized_facts_json, provenance_json, target_sha256, created_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?)
      ON CONFLICT (training_case_id, section_key, contract_version) DO UPDATE SET
        target_content=excluded.target_content, normalized_facts_json=excluded.normalized_facts_json,
        provenance_json=excluded.provenance_json, target_sha256=excluded.target_sha256`,
    ).run(goldSectionId, truthCase.training_case_id, truthCase.gold_document_id, sectionKey,
      STANDARDIZED_PAIR_CONTRACT_VERSION, truthCase.dataset_split, targetContent,
      JSON.stringify(normalizedFacts), JSON.stringify(provenance), sha256(targetContent), now);
  }

  async function upsertPair(result) {
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO report_standardized_mock_gold_pairs (
        pair_id, gold_section_id, variant_id, training_case_id, section_key, contract_version,
        dataset_split, status_code, mock_input_json, hidden_fact_ledger_json,
        protected_invariants_json, expected_recoverable_fact_ids_json, validation_json,
        created_at_iso, updated_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?)
      ON CONFLICT (variant_id, section_key, contract_version) DO UPDATE SET
        status_code=excluded.status_code, mock_input_json=excluded.mock_input_json,
        hidden_fact_ledger_json=excluded.hidden_fact_ledger_json,
        protected_invariants_json=excluded.protected_invariants_json,
        expected_recoverable_fact_ids_json=excluded.expected_recoverable_fact_ids_json,
        validation_json=excluded.validation_json, updated_at_iso=excluded.updated_at_iso`,
    ).run(result.pairId, result.goldSectionId, result.variantId, result.trainingCaseId,
      result.sectionKey, STANDARDIZED_PAIR_CONTRACT_VERSION, result.datasetSplit, result.status,
      JSON.stringify(result.mockInput), JSON.stringify(result.hiddenLedger),
      JSON.stringify(result.protectedInvariants), JSON.stringify(result.expectedRecoverableFactIds),
      JSON.stringify(result.validation), now, now);
  }

  async function upsertBaseline(result) {
    const now = new Date().toISOString();
    const inputJson = JSON.stringify(result.deterministicInput);
    await db.prepare(
      `INSERT INTO report_baseline_gold_pairs (
        baseline_pair_id, gold_section_id, training_case_id, section_key, contract_version,
        dataset_split, status_code, deterministic_input_json, hidden_fact_ledger_json,
        protected_invariants_json, expected_recoverable_fact_ids_json, validation_json,
        input_sha256, created_at_iso, updated_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?, ?)
      ON CONFLICT (training_case_id, section_key, contract_version) DO UPDATE SET
        gold_section_id=excluded.gold_section_id, dataset_split=excluded.dataset_split,
        status_code=excluded.status_code, deterministic_input_json=excluded.deterministic_input_json,
        hidden_fact_ledger_json=excluded.hidden_fact_ledger_json,
        protected_invariants_json=excluded.protected_invariants_json,
        expected_recoverable_fact_ids_json=excluded.expected_recoverable_fact_ids_json,
        validation_json=excluded.validation_json, input_sha256=excluded.input_sha256,
        updated_at_iso=excluded.updated_at_iso`,
    ).run(result.baselinePairId, result.goldSectionId, result.trainingCaseId, result.sectionKey,
      STANDARDIZED_PAIR_CONTRACT_VERSION, result.datasetSplit, result.status, inputJson,
      JSON.stringify(result.hiddenLedger), JSON.stringify(result.protectedInvariants),
      JSON.stringify(result.expectedRecoverableFactIds), JSON.stringify(result.validation),
      sha256(inputJson), now, now);
  }
}

function buildBaseline({ truthCase, goldSectionId, sectionKey, sectionFacts, allFacts, targetContent }) {
  const observable = new Set(["app_observable", "voice_observable", "deterministic_derived"]);
  const sourceInputs = selectContextFactsForSection(sectionKey, allFacts, targetContent).filter((fact) => observable.has(fact.answerability_class));
  const voiceComplements = buildMaterialVoiceComplements(sectionKey, sectionFacts, targetContent);
  const included = uniqueFacts([...sourceInputs, ...voiceComplements]);
  const includedIds = new Set(included.map((fact) => fact.fact_id));
  const hidden = sectionFacts.filter((fact) => !includedIds.has(fact.fact_id));
  const protectedFacts = included.filter(isProtected);
  const protectedObservable = protectedFacts.filter((fact) => observable.has(fact.answerability_class));
  const protectedDefaultUnit = sectionFacts.some((fact) => /all readings (?:are |in )*mm\b/i.test(String(parseJson(fact.normalized_value_json)?.text ?? ""))) ? "mm" : null;
  const issues = [];
  if (!targetContent) issues.push("gold_target_empty");
  if (String(targetContent).trim().length < 200) issues.push("gold_target_fragmentary");
  if (sectionFacts.some((fact) => parseJson(fact.source_block_ids_json, []).length === 0)) issues.push("fact_provenance_missing");
  if (protectedObservable.some((fact) => !includedIds.has(fact.fact_id))) issues.push("protected_observable_missing");
  if (included.length === 0) issues.push("no_recoverable_baseline_facts");
  const recoverableTargetCoverage = lexicalCoverage(targetContent, included.map((fact) => factText(fact)).join("\n"));
  const minimumRecoverableCoverage = ["inspection-report", "repair-recommendations"].includes(sectionKey) ? 0.55 : 0.2;
  if (recoverableTargetCoverage < minimumRecoverableCoverage) issues.push("mock_context_insufficient_for_gold_target");
  const captures = included.map((fact, stableOrder) => {
    const captureChannel = baselineChannel(fact);
    return {
      factId: fact.fact_id,
      sectionKey:fact.section_key,
      factType: fact.fact_type,
      value: parseJson(fact.normalized_value_json),
      unitCode: fact.unit_code,
      evidenceClass: fact.evidence_class,
      captureDestination: fact.capture_destination,
      answerabilityClass: fact.answerability_class,
      requiredFact: Boolean(fact.required_fact),
      captureChannel,
      disposition: "included",
      ...(captureChannel === "voice" ? buildAppVoiceContext(fact, sectionKey, stableOrder) : {}),
      transformation: {},
      stableOrder,
    };
  });
  const expectedOutputFacts = included.filter((fact) => (sectionKey !== "inspection-report" || ["finding_observation", "voice_finding_input"].includes(fact.fact_type))
      && (sectionKey !== "repair-recommendations" || fact.fact_type === "voice_recommendation_input")
      && (sectionKey === "inspection-report" || fact.section_key === sectionKey)
      && !["measurement", "photo_or_attachment", "layout_geometry"].includes(fact.evidence_class));
  const evaluationMode = ["inspection-report", "repair-recommendations"].includes(sectionKey)
    ? "evidence_conditioned_semantic"
    : "direct_recovery";
  return {
    baselinePairId: stableId("baseline", truthCase.training_case_id, sectionKey, STANDARDIZED_PAIR_CONTRACT_VERSION),
    goldSectionId,
    trainingCaseId: truthCase.training_case_id,
    sectionKey,
    datasetSplit: truthCase.dataset_split,
    status: issues.length ? "quarantined" : "ready",
    deterministicInput: {
      packageType: "laiq_section_generation_query",
      schemaVersion: STANDARDIZED_PAIR_CONTRACT_VERSION,
      identity: { truthCaseId: truthCase.training_case_id, sectionKey, datasetSplit: truthCase.dataset_split },
      task: "Generate the complete approved report section from the available partial inspection evidence.",
      variation: null,
      syntheticEvidenceDerivedFromGold: voiceComplements.length > 0,
      captures,
    },
    hiddenLedger: hidden.map((fact) => ({ factId: fact.fact_id, reason: `answerability_${fact.answerability_class}`, requiredFact: Boolean(fact.required_fact), answerabilityClass: fact.answerability_class })),
    protectedInvariants: protectedObservable.map((fact) => ({
      factId: fact.fact_id,
      value: parseJson(fact.normalized_value_json),
      unitCode: fact.unit_code,
      evidenceClass: fact.evidence_class,
      matchingGranularity: ["measurement", "layout_geometry"].includes(fact.evidence_class) ? "atomic_claims" : "whole_fact",
      atomicClaims: ["measurement", "layout_geometry"].includes(fact.evidence_class) ? extractAtomicClaims(parseJson(fact.normalized_value_json),protectedDefaultUnit) : [],
    })),
    expectedRecoverableFactIds: expectedOutputFacts.map((fact) => fact.fact_id),
    validation: { aligned: issues.length === 0, issues, deterministic: true, variationApplied: false, taskType:"section_query_answer", answerType:"complete_approved_section", evaluationMode, minimumGoldContentCoverage:minimumRecoverableCoverage, goldFactCount: sectionFacts.length, inputFactCount:included.length, recoverableFactCount: expectedOutputFacts.length, hiddenFactCount: hidden.length, protectedFactCount: protectedObservable.length, recoverableTargetCoverage, goldTargetAvailableOnlyAfterGeneration: true },
  };
}

function buildMaterialVoiceComplements(sectionKey, sectionFacts, targetContent) {
  if (!["inspection-report", "repair-recommendations"].includes(sectionKey)) return [];
  const sourceFacts=sectionFacts.filter((fact) => ["engineering_assessment", "finding_observation"].includes(fact.fact_type));
  const prototype=sourceFacts[0]??sectionFacts[0];
  if(!prototype)return [];
  const statements=sectionKey === "repair-recommendations"
    ? recommendationVoiceStatements(targetContent)
    : splitMaterialVoiceStatements(targetContent);
  return statements.map((statement, index) => ({
      ...prototype,
      fact_id:`${prototype.fact_id}:voice:${index}:${sha256(statement).slice(0, 12)}`,
      fact_type:sectionKey === "repair-recommendations" ? "voice_recommendation_input" : "voice_finding_input",
      evidence_class:"finding",
      answerability_class:"voice_observable",
      required_fact:true,
      safety_criticality:["high", "critical"].includes(prototype.safety_criticality) ? prototype.safety_criticality : "medium",
      capture_destination:"findings.voiceTranscript",
      normalized_value_json:JSON.stringify({
        text:`Inspector ${sectionKey === "repair-recommendations" ? "recommendation" : "observation"}: ${statement}`,
        simulatedChannel:"voice",
        sourceRole:"gold_derived_synthetic_capture",
        derivedFromFactId:prototype.fact_id,
      }),
    }));
}

function recommendationVoiceStatements(targetContent) {
  const lines=String(targetContent??"").replace(/\\n/g,"\n").split(/\n+/)
    .map((line)=>line.replace(/\s+/g," ").trim()).filter(Boolean);
  const statements=[];
  let operatingStatus=null;
  for(let index=0;index<lines.length;index+=1){
    const line=lines[index];
    if(/^(?:off|on)-?line$/i.test(line)){operatingStatus=line.toUpperCase().replace(/^(OFF|ON)LINE$/, "$1-LINE");continue;}
    if(isReportFurniture(line)||/^(?:diked area|shell external|corrosion)\s*:?$/i.test(line))continue;
    if(/\b(?:should|shall|must|cannot|recommend|repair|replace|renew|clean|seal|remove|install|apply|monitor|inspect|assess|recoat|rectif|reinforce|grind|weld|test|survey|verify|maintain|return to service)\b/i.test(line)&&/:$/.test(line)){
      const action=line.replace(/:$/,".");
      let consumed=0;
      for(let cursor=index+1;cursor<lines.length&&/^o\s+/i.test(lines[cursor]);cursor+=1){
        const location=lines[cursor].replace(/^o\s+/i,"").replace(/[;,]+$/,"");
        statements.push(`${operatingStatus?`${operatingStatus}: `:""}${location} ${action}`);
        consumed+=1;
      }
      index+=consumed;
      continue;
    }
    if(isSubstantiveRecommendationLine(line))statements.push(`${operatingStatus?`${operatingStatus}: `:""}${line}`);
  }
  const seen=new Set();
  return statements.filter((item)=>{const key=item.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});
}

function isSubstantiveRecommendationLine(line){
  const value=String(line??"").trim();
  if(value.length<12||isReportFurniture(value))return false;
  if(/^(?:diked area|shell external|shell internal|roof external|roof internal|floor|annular plates?|corrosion|recommendations?)\s*:?$/i.test(value))return false;
  return !/^(?:client|owner|tank no\.?|job no\.?|date completed|page)\s*:/i.test(value);
}

function isReportFurniture(line){
  return /^(?:[\d\s.]+\s+)?(?:repair recommendations?(?:\s*\/\s*api\s*653 assessment)?|floor plate layout with repair recommendations?)$/i.test(line)
    || /^(?:client|tank no\.?|job no\.?|date completed|page)\s*:/i.test(line);
}

function splitMaterialVoiceStatements(text) {
  const normalized=String(text??"")
    .replace(/\\n/g,"\n")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;|&#160;/gi," ")
    .replace(/\r/g,"\n");
  const pieces=normalized
    .split(/\n+|(?<=[.!?;:])\s+(?=[A-Z0-9(])/)
    .map((item)=>item.replace(/^[\s•*\-–—\d.)]+/,"").replace(/\s+/g," ").trim())
    .filter((item)=>item.length>=12&&item.length<=1200&&isMaterialVoiceAssessment(item));
  const seen=new Set();
  return pieces.filter((item)=>{const key=item.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});
}

function isMaterialVoiceAssessment(text) {
  const value=String(text??"").trim();
  if(value.length<12||value.length>1200)return false;
  if(/^(?:off-?line|on-?line|repair recommendations?|api\s*653 assessment|diked area|shell|roof|floor)\s*:?[\s-]*$/i.test(value))return false;
  return /\b(?:should|shall|must|cannot|recommend|repair|patch|replace|renew|clean|seal|remove|install|apply|monitor|inspect|assess|recoat|rectif|reinforce|grind|weld|test|survey|verify|maintain|return to service)\b/i.test(value);
}

function selectContextFactsForSection(sectionKey, facts, targetContent = "") {
  const observable = facts.filter((fact) => ["app_observable", "voice_observable", "deterministic_derived"].includes(fact.answerability_class)
    && isCaptureReadyFact(fact));
  if (sectionKey === "repair-recommendations") {
    const identity = observable.filter((fact) => fact.evidence_class === "structured_field"
      && factText(fact).length <= 240
      && /\b(?:client|owner|tank|location|product|date|inspection)\s*[:#]/i.test(factText(fact)))
      .sort((left,right)=>left.fact_id.localeCompare(right.fact_id))
      .slice(0,12);
    return identity;
  }
  if (sectionKey === "inspection-report") {
    return observable.filter((fact) => !["photo_or_attachment", "layout_geometry"].includes(fact.evidence_class));
  }
  const local = observable.filter((fact) => fact.section_key === sectionKey);
  const identity = observable.filter((fact) => fact.evidence_class === "structured_field" && factText(fact).length <= 700);
  return uniqueFacts([...local, ...identity]);
}

function recommendationTriggerScore(fact, targetContent) {
  const text = factText(fact);
  const targetTokens = new Set(contentTokens(targetContent));
  const sharedTokens = contentTokens(text).filter((token) => targetTokens.has(token)).length;
  const sourceBoost = fact.section_key === "inspection-report" ? 8 : 0;
  const conditionBoost = /\b(?:not|no\b|corrosion|pitting|crack|leak|clogged|blocked|weather(?:ed|ing)|contact|missing|damaged|loose|broken|perforat(?:ed|ion)|unsatisfactory|significant)\b/i.test(text) ? 4 : 0;
  return sharedTokens + sourceBoost + conditionBoost;
}

function contentTokens(value) {
  return String(value ?? "").toLowerCase().match(/[a-z0-9]+/g)?.filter((token) => token.length > 2) ?? [];
}

function isMeaningfulRecommendationTrigger(fact) {
  const text = factText(fact).trim();
  if (text.length < 12 || text.length > 700) return false;
  if (/^(?:page\s*:|job no\.?\s*:|tank no\.?\s*:|\d+(?:\.\d+)?\s*(?:mm|years?)?|mm|日)$/i.test(text)) return false;
  return /\b(?:not|no\b|corrosion|pitting|crack|leak|deform|buckle|coating|clogged|blocked|weather(?:ed|ing)|contact|missing|damaged|loose|broken|perforat(?:ed|ion)|unsatisfactory|significant|repair|required|replace)\b/i.test(text);
}

function isCaptureReadyFact(fact) {
  const text = factText(fact).trim();
  if (!text) return false;
  if (["photo_or_attachment", "layout_geometry"].includes(fact.evidence_class)) return false;
  if (fact.evidence_class === "measurement") return true;
  if (fact.answerability_class === "voice_observable" || fact.evidence_class === "finding") return text.length <= 1200;
  if (fact.answerability_class === "deterministic_derived") return text.length <= 1200;
  if (fact.evidence_class === "structured_field") {
    const value = parseJson(fact.normalized_value_json, {});
    const tableLike = /table/i.test(String(value?.sourceBlockType ?? ""));
    const compactFieldLike = text.length <= 700 && (/\b(?:client|owner|tank|location|capacity|product|date|inspector)\s*[:#]/i.test(text) || text.length <= 240);
    return tableLike || compactFieldLike;
  }
  return false;
}

function uniqueFacts(facts) {
  const seen = new Set();
  return facts.filter((fact) => !seen.has(fact.fact_id) && seen.add(fact.fact_id));
}

function factText(fact) {
  const value = parseJson(fact.normalized_value_json, {});
  return String(value?.text ?? value?.value ?? (typeof value === "string" ? value : ""));
}

const COVERAGE_STOP_WORDS = new Set("the a an and or of to in is are was were be been for from with by on at as that this it its their should may can could would report section tank inspection".split(" "));
function lexicalCoverage(target, evidence) {
  const tokens = (value) => new Set((String(value).toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? []).filter((token) => !COVERAGE_STOP_WORDS.has(token)));
  const gold = tokens(target);
  const input = tokens(evidence);
  if (!gold.size) return 0;
  return [...gold].filter((token) => input.has(token)).length / gold.size;
}

function baselineChannel(fact) {
  if (fact.evidence_class === "measurement") return "measurement";
  if (fact.evidence_class === "photo_or_attachment") return "photo";
  if (fact.answerability_class === "voice_observable") return "voice";
  if (fact.answerability_class === "deterministic_derived") return "deterministic_derived";
  return "structured_field";
}

function buildAppVoiceContext(fact, sectionKey, stableOrder) {
  const targetKey = inferVoiceTargetKey(fact);
  const itemLabel = sectionKey === "repair-recommendations"
    ? `Recommendation ${stableOrder + 1}`
    : `Finding observation ${stableOrder + 1}`;
  return {
    voiceContext: {
      screenKey: "findings",
      screenLabel: "Findings",
      cardKey: sectionKey,
      fieldKey: "voice_note",
      targetKey,
      targetLabel: targetKey === "general" ? "General inspection" : targetKey.replaceAll("_", " "),
      itemKey: fact.fact_id,
      itemLabel,
    },
  };
}

function inferVoiceTargetKey(fact) {
  const haystack = `${fact.section_key ?? ""} ${fact.capture_destination ?? ""} ${factText(fact)}`.toLowerCase();
  if (/external[ _-]?roof/.test(haystack)) return "external_roof";
  if (/internal[ _-]?roof/.test(haystack)) return "internal_roof";
  if (/floor|bottom/.test(haystack)) return "floor";
  if (/shell/.test(haystack)) return "shell";
  return "general";
}

function extractAtomicClaims(value, defaultUnit = null) {
  const text = typeof value === "string" ? value : String(value?.text ?? JSON.stringify(value));
  const normalized = text.replace(/[−–—]/g, "-").toLowerCase();
  const claims = [];
  for (const match of normalized.matchAll(/(?:^|[^a-z0-9])([+\-]?\d+(?:\.\d+)?)(?:\s*(mm\/year|mm\/yr|mm|cm|mpa|psi|bar|ft|in|m|%))?/gi)) {
    const number = Number(String(match[1]).replace(/^\+/, ""));
    const explicitUnit=String(match[2]??"").toLowerCase()||null;
    const numericOffset=(match.index??0)+match[0].indexOf(match[1]);
    const inferredUnit=defaultUnit&&isBareTableNumericCell(normalized,numericOffset)?defaultUnit:null;
    if (Number.isFinite(number) && (explicitUnit || number < 1900 || number > 2100)) claims.push({ value: number, unitCode: explicitUnit||inferredUnit });
  }
  const seen = new Set();
  return claims.filter((claim) => {
    const key = `${claim.value}:${claim.unitCode ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function isBareTableNumericCell(text,index){const left=text.lastIndexOf("|",index);const right=text.indexOf("|",index);if(left<0||right<0)return false;return /^[+\-]?\d+(?:\.\d+)?$/.test(text.slice(left+1,right).trim());}

function buildPair({ truthCase, variant, goldSectionId, sectionKey, sectionFacts, links, targetContent }) {
  const goldIds = new Set(sectionFacts.map((fact) => fact.fact_id));
  const included = links.filter((link) => link.disposition_code !== "withheld");
  const hidden = links.filter((link) => link.disposition_code === "withheld");
  const includedIds = new Set(included.map((link) => link.fact_id));
  const protectedFacts = sectionFacts.filter(isProtected);
  const issues = [];
  if (!targetContent) issues.push("gold_target_empty");
  if (sectionFacts.some((fact) => parseJson(fact.source_block_ids_json, []).length === 0)) issues.push("fact_provenance_missing");
  if (included.some((link) => !goldIds.has(link.fact_id))) issues.push("mock_fact_not_in_gold");
  if (variant.lane_code === "faithful_capture" && protectedFacts.some((fact) => !includedIds.has(fact.fact_id))) issues.push("protected_fact_withheld");
  if (included.some((link) => !sameValue(link.normalized_value_json, sectionFacts.find((fact) => fact.fact_id === link.fact_id)?.normalized_value_json))) issues.push("mock_gold_value_mismatch");
  const expectedRecoverableFactIds = included.map((link) => link.fact_id);
  return {
    pairId: stableId("pair", variant.variant_id, sectionKey, STANDARDIZED_PAIR_CONTRACT_VERSION),
    goldSectionId,
    variantId: variant.variant_id,
    trainingCaseId: truthCase.training_case_id,
    sectionKey,
    datasetSplit: truthCase.dataset_split,
    status: issues.length ? "quarantined" : "ready",
    mockInput: {
      packageType: "laiq_standardized_section_capture",
      schemaVersion: STANDARDIZED_PAIR_CONTRACT_VERSION,
      identity: { truthCaseId: truthCase.training_case_id, variantId: variant.variant_id, sectionKey, datasetSplit: truthCase.dataset_split },
      captures: included.map((link) => ({ factId: link.fact_id, value: parseJson(link.normalized_value_json), unitCode: link.unit_code, channel: link.capture_channel, disposition: link.disposition_code, transformation: parseJson(link.transformation_json, {}) })),
    },
    hiddenLedger: hidden.map((link) => ({ factId: link.fact_id, reason: "capture_variant_withheld", requiredFact: Boolean(link.required_fact), answerabilityClass: link.answerability_class })),
    protectedInvariants: protectedFacts.map((fact) => ({ factId: fact.fact_id, value: parseJson(fact.normalized_value_json), unitCode: fact.unit_code, evidenceClass: fact.evidence_class })),
    expectedRecoverableFactIds,
    validation: { aligned: issues.length === 0, issues, goldFactCount: sectionFacts.length, mockFactCount: included.length, hiddenFactCount: hidden.length, protectedFactCount: protectedFacts.length, goldTargetAvailableOnlyAfterGeneration: true },
  };
}

function normalizedGoldFact(fact) {
  return { factId: fact.fact_id, factType: fact.fact_type, value: parseJson(fact.normalized_value_json), unitCode: fact.unit_code, evidenceClass: fact.evidence_class, answerabilityClass: fact.answerability_class, requiredFact: Boolean(fact.required_fact), protected: isProtected(fact), provenance: { documentId: fact.source_document_id, pageNumber: fact.source_page_number, blockIds: parseJson(fact.source_block_ids_json, []), bbox: parseJson(fact.source_bbox_json, null), confidence: Number(fact.source_confidence) } };
}

function isProtected(fact) { return ["measurement", "layout_geometry", "photo_or_attachment"].includes(fact.evidence_class) || fact.safety_criticality === "critical"; }
function sameValue(left, right) { return JSON.stringify(parseJson(left)) === JSON.stringify(parseJson(right)); }
function unique(values) { return [...new Set(values)]; }
function parseJson(value, fallback = null) { if (value == null) return fallback; if (typeof value !== "string") return value; try { return JSON.parse(value); } catch { return fallback; } }
function sha256(value) { return createHash("sha256").update(String(value)).digest("hex"); }
function stableId(...parts) { return `${parts[0]}_${sha256(parts.join(":" )).slice(0, 32)}`; }
