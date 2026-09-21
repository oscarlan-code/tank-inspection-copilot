import { createHash } from "node:crypto";
import { STANDARDIZED_PAIR_CONTRACT_VERSION, reconstructionBenchmarkMetadata, preparationRevisionHash, assertExistingRevision } from "./standardized-pair-builder.mjs";

export const BASELINE_VARIATION_SCHEMA_VERSION = 12;

export function createBaselineVariationPilot({ db, objectStorage }) {
  return { buildPilot, buildValidationPilot, buildHiddenTestPilot, getStatus };

  async function buildPilot({ sampleSize = 100, seed = 1, allProfiles = true } = {}) {
    const candidates = await loadCandidates("training");
    const profiles = await loadProfiles();
    return materializeVariations({candidates:candidates.slice(0,sampleSize),profiles,seed,allProfiles});
  }

  async function buildValidationPilot({ sampleSize = 20, seed = 1 } = {}) {
    const candidates=await loadCandidates("validation");
    const profiles=await loadProfiles();
    return materializeVariations({candidates:candidates.slice(0,sampleSize),profiles,seed,allProfiles:false});
  }

  async function buildHiddenTestPilot({ sampleSize = 20, seed = 1 } = {}) {
    const candidates=await loadCandidates("hidden_test");
    const profiles=await loadProfiles();
    return materializeVariations({candidates:candidates.slice(0,sampleSize),profiles,seed,allProfiles:false});
  }

  async function loadCandidates(split) {
    return db.prepare(
      `SELECT p.*, g.normalized_facts_json, g.target_sha256,
        c.report_family, COALESCE(c.asset_lineage_key,c.gold_document_id,c.training_case_id) AS asset_lineage_key,
        m.cohort_id,m.match_group_number
      FROM report_baseline_gold_pairs p
      JOIN report_standardized_gold_sections g ON g.gold_section_id=p.gold_section_id
      JOIN report_training_cases c ON c.training_case_id=p.training_case_id
      JOIN report_baseline_pilot_cohort_members m ON m.baseline_pair_id=p.baseline_pair_id AND m.dataset_split=?
      JOIN report_baseline_pilot_cohorts cohort ON cohort.cohort_id=m.cohort_id AND cohort.status_code='active'
      WHERE p.dataset_split=? AND p.status_code='ready' AND p.contract_version=?
      ORDER BY m.match_group_number`,
    ).all(split,split,STANDARDIZED_PAIR_CONTRACT_VERSION);
  }

  async function loadProfiles() {
    const profiles=await db.prepare(
      `SELECT * FROM report_capture_profile_versions
      WHERE status_code='active' AND lane_code='faithful_capture'
      ORDER BY profile_code`,
    ).all();
    if (profiles.length !== 8) throw new Error(`Expected 8 active faithful capture profiles; found ${profiles.length}.`);
    return profiles;
  }

  async function materializeVariations({candidates,profiles,seed,allProfiles}) {
    let ready = 0;
    let quarantined = 0;
    let scenarioCount=0;
    for (const baseline of candidates) {
      const selectedProfiles=allProfiles?profiles:[profiles[(Number(baseline.match_group_number)-1)%profiles.length]];
      for (const profile of selectedProfiles) {
        const result = buildVariation({ baseline, profile, seed });
        const existing = await readVariationRevision(result);
        if (assertExistingRevision(existing, result.validation.preparationRevisionHash, result.variationId)) {
          scenarioCount += 1;
          if (result.status === "scenario_ready") ready += 1;
          else quarantined += 1;
          continue;
        }
        scenarioCount+=1;
        let objectKey = null;
        let scenarioSha256 = null;
        if (result.status === "scenario_ready") {
          objectKey = `training-harness/baseline-variations/preparation-v${BASELINE_VARIATION_SCHEMA_VERSION}/${baseline.cohort_id}/${baseline.dataset_split}/${result.variationId}/capture-scenario.json`;
          const stored = await objectStorage.putBuffer({
            bytes: Buffer.from(JSON.stringify(result.manifest)),
            mediaType: "application/json",
            objectId: result.variationId,
            objectKey,
          });
          scenarioSha256 = stored.sha256;
          ready += 1;
        } else {
          quarantined += 1;
        }
        await upsertVariation({ ...result, objectKey, scenarioSha256 });
      }
    }
    return { datasetSplit:candidates[0]?.dataset_split??null,selectedBaselines:candidates.length,profilesUsed:allProfiles?profiles.length:new Set(candidates.map((item)=>(Number(item.match_group_number)-1)%profiles.length)).size,scenarios:scenarioCount,ready,quarantined,seed,schemaVersion:BASELINE_VARIATION_SCHEMA_VERSION };
  }

  async function getStatus() {
    return db.prepare(
      `SELECT p.profile_code,p.display_name,v.status_code,COUNT(*)::int AS count
      FROM report_baseline_capture_variations v
      JOIN report_capture_profile_versions p ON p.profile_version_id=v.profile_version_id
      JOIN report_baseline_pilot_cohorts c ON c.cohort_id=v.cohort_id AND c.status_code='active'
      GROUP BY 1,2,3 ORDER BY 1,3`,
    ).all();
  }

  async function upsertVariation(result) {
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO report_baseline_capture_variations (
        variation_id,baseline_pair_id,profile_version_id,deterministic_seed,dataset_split,cohort_id,match_group_number,
        status_code,manifest_json,validation_json,included_fact_count,withheld_fact_count,
        scenario_object_key,scenario_sha256,created_at_iso,updated_at_iso
      ) VALUES (?,?,?,?,?,?,?, ?,?::jsonb,?::jsonb,?,?,?,?,?,?)
      ON CONFLICT (baseline_pair_id,profile_version_id,deterministic_seed) DO NOTHING`,
    ).run(result.variationId,result.baselinePairId,result.profileVersionId,result.seed,result.datasetSplit,result.cohortId,result.matchGroupNumber,result.status,
      JSON.stringify(result.manifest),JSON.stringify(result.validation),result.includedCount,
      result.withheldCount,result.objectKey,result.scenarioSha256,now,now);
    assertExistingRevision(await readVariationRevision(result), result.validation.preparationRevisionHash, result.variationId);
  }

  async function readVariationRevision(result) {
    return db.prepare("SELECT validation_json->>'preparationRevisionHash' AS revision_hash FROM report_baseline_capture_variations WHERE baseline_pair_id=? AND profile_version_id=? AND deterministic_seed=?")
      .get(result.baselinePairId,result.profileVersionId,result.seed);
  }
}

export function buildVariation({ baseline, profile, seed }) {
  if (Number(baseline.contract_version) !== STANDARDIZED_PAIR_CONTRACT_VERSION) {
    throw new Error("Historical baseline preparation must use the current immutable contract; create a new baseline revision first.");
  }
  const input = parseJson(baseline.deterministic_input_json, {});
  const baselineValidation = parseJson(baseline.validation_json, {});
  const expectedRecoverableFactIds = parseJson(baseline.expected_recoverable_fact_ids_json, []);
  const goldFacts = parseJson(baseline.normalized_facts_json, []);
  const goldById = new Map(goldFacts.map((fact) => [fact.factId, fact]));
  const protectedIds = new Set(parseJson(baseline.protected_invariants_json, []).map((fact) => fact.factId));
  const profileConfig = parseJson(profile.config_json, {});
  const variationId = `baseline-var-${hash(`${baseline.baseline_pair_id}:${baseline.input_sha256}:${profile.profile_version_id}:${seed}:${BASELINE_VARIATION_SCHEMA_VERSION}`).slice(0,32)}`;
  const included = [];
  const withheld = [...parseJson(baseline.hidden_fact_ledger_json, [])];
  for (const capture of input.captures ?? []) {
    const gold = goldById.get(capture.factId) ?? capture;
    const required = Boolean(capture.requiredFact ?? gold?.requiredFact);
    const protectedFact = protectedIds.has(capture.factId);
    const probability = channelProbability(capture.captureChannel, profileConfig);
    const keep = required || protectedFact || deterministicUnit(variationId,capture.factId,"keep") <= probability;
    if (!keep) {
      withheld.push({ factId: capture.factId, reason: "profile_optional_omission", requiredFact: false, answerabilityClass: capture.answerabilityClass });
      continue;
    }
    included.push({
      ...capture,
      transformation: surfaceTransformation(capture, profileConfig, variationId),
    });
  }
  const issues = [];
  const includedIds = new Set(included.map((fact) => fact.factId));
  if ([...protectedIds].some((id) => !includedIds.has(id))) issues.push("protected_fact_withheld");
  if ((input.captures ?? []).filter((fact) => fact.requiredFact).some((fact) => !includedIds.has(fact.factId))) issues.push("required_fact_withheld");
  if (included.some((fact) => protectedIds.has(fact.factId)
    && JSON.stringify(fact.value) !== JSON.stringify((goldById.get(fact.factId) ?? fact).value))) issues.push("protected_value_changed");
  const manifest = {
    packageType: "laiq_capture_scenario",
    schemaVersion: 1,
    identity: {
      variantId: variationId,
      variationId,
      baselinePairId: baseline.baseline_pair_id,
      truthCaseId: baseline.training_case_id,
      sectionKey: baseline.section_key,
      datasetSplit: baseline.dataset_split,
      cohortId: baseline.cohort_id,
      matchGroupNumber: baseline.match_group_number,
      reportFamily: baseline.report_family,
      assetLineageKey: baseline.asset_lineage_key,
      captureProfile: profile.profile_code,
      captureProfileVersion: Number(profile.version_number),
      deterministicSeed: seed,
      preparationContractVersion: BASELINE_VARIATION_SCHEMA_VERSION,
      ...reconstructionBenchmarkMetadata(),
    },
    appContractTarget: { packageType: "v3_product_export", schemaVersion: 3, owner: "LAIQ inspection app", status: "awaiting_app_round_trip" },
    baselineContract: { schemaVersion: Number(baseline.contract_version), inputSha256: baseline.input_sha256, goldTargetSha256: baseline.target_sha256, evaluationMode:baselineValidation.evaluationMode??"direct_recovery", minimumGoldContentCoverage:Number(baselineValidation.minimumGoldContentCoverage??0.55), ...reconstructionBenchmarkMetadata() },
    learningTask: {
      taskType:"historical_reconstruction",
      query:"Explicitly historical-report-derived capture records",
      answer:"Historical reconstruction reference, not an unseen field-evidence answer",
      inputSourceDerivedFromAnswer:true,
      scoring:"Reconstruction diagnostics only; excluded from independent quality, learning and promotion.",
    },
    behavior: profileConfig,
    captures: orderCaptures(included, profileConfig, variationId),
    expectedRecoverableFactIds: expectedRecoverableFactIds.filter((factId)=>includedIds.has(factId)),
    withheldFacts: withheld,
    protectedInvariants: parseJson(baseline.protected_invariants_json, []),
  };
  const validation = { valid: issues.length===0,issues,baselineOnlySource:true,syntheticEvidenceDerivedFromGold:Boolean(input.syntheticEvidenceDerivedFromGold),sourceDerivedFromHistoricalReport:true,protectedFactsPreserved:!issues.includes("protected_fact_withheld")&&!issues.includes("protected_value_changed"),requiredFactsPreserved:!issues.includes("required_fact_withheld"),...reconstructionBenchmarkMetadata(),expectedOutputObligations:[],proposedOutputObligations:(baselineValidation.proposedOutputObligations??[]).filter((obligation)=>(obligation.evidenceIds??[]).every((id)=>includedIds.has(id))) };
  validation.preparationRevisionHash = preparationRevisionHash({ manifest, validation });
  return {
    variationId,
    baselinePairId: baseline.baseline_pair_id,
    profileVersionId: profile.profile_version_id,
    cohortId: baseline.cohort_id,
    matchGroupNumber: baseline.match_group_number,
    datasetSplit: baseline.dataset_split,
    seed,
    status: issues.length ? "quarantined" : "scenario_ready",
    manifest,
    validation,
    includedCount: included.length,
    withheldCount: withheld.length,
  };
}

function channelProbability(channel,config){
  if(channel==="voice") return bounded(config.voiceCompleteness,0.7);
  if(channel==="photo") return bounded(config.photoCompleteness,0.6);
  return bounded(config.structuredCompleteness,0.8);
}
function surfaceTransformation(capture,config,variationId){
  if(capture.captureChannel!=="voice") return {};
  return {
    noteStyle:String(config.noteStyle??"normal"),
    asrNoiseRate:bounded(config.asrNoise,0),
    repetitionRate:bounded(config.repetitionRate,0),
    orderMode:String(config.orderMode??"section"),
    surfaceVariantKey:hash(`${variationId}:${capture.factId}:surface`).slice(0,16),
  };
}
function orderCaptures(captures,config,variationId){
  if(String(config.orderMode??"section")!=="deterministic_shuffle") return captures;
  return [...captures].sort((a,b)=>hash(`${variationId}:${a.factId}:order`).localeCompare(hash(`${variationId}:${b.factId}:order`)));
}
function bounded(value,fallback){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):fallback;}
function deterministicUnit(...parts){return Number.parseInt(hash(parts.join(":" )).slice(0,13),16)/0xfffffffffffff;}
function parseJson(value,fallback){if(value==null)return fallback;if(typeof value!=="string")return value;try{return JSON.parse(value);}catch{return fallback;}}
function hash(value){return createHash("sha256").update(String(value)).digest("hex");}
