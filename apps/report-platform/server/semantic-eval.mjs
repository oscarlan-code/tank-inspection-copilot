import { runStructuredCodexJob } from "./codex-cli.mjs";

const SEMANTIC_EVAL_SCHEMA={
  type:"object",additionalProperties:false,
  required:["semanticSimilarity","sectionIntentCoverage","materialConceptRecall","professionalAcceptability","verdict","assessment","missingConcepts","unacceptableReasons"],
  properties:{
    semanticSimilarity:{type:"number",minimum:0,maximum:1},
    sectionIntentCoverage:{type:"number",minimum:0,maximum:1},
    materialConceptRecall:{type:"number",minimum:0,maximum:1},
    professionalAcceptability:{type:"number",minimum:0,maximum:1},
    verdict:{type:"string",enum:["acceptable","needs_review","unacceptable"]},
    assessment:{type:"string"},
    missingConcepts:{type:"array",items:{type:"string"},maxItems:12},
    unacceptableReasons:{type:"array",items:{type:"string"},maxItems:12},
  },
};

export async function evaluateSemanticSectionSimilarity({sectionId,goldContent,generatedContent}){
  try{
    const response=await runStructuredCodexJob({reasoningEffort:"low",prompt:`You are evaluating a generated tank-inspection report section after generation is complete.

The approved original section is the gold benchmark. Decide whether the generated section could replace it in a professional, export-ready inspection report. Compare meaning and reporting function, not wording. Accept faithful paraphrases, reordered statements, different sentence structure, and equivalent professional terminology. Do not require word-for-word overlap.

Score:
- semanticSimilarity: overall meaning similarity to the approved complete section.
- sectionIntentCoverage: whether the generated output performs the same report-section purpose.
- materialConceptRecall: coverage of material findings, conditions, conclusions, and actions in the approved section.
- professionalAcceptability: whether an inspector could accept the generated section as a complete replacement for the gold section, assuming formatting is checked separately.
- verdict: acceptable only when no material finding, qualification, conclusion, action, or relationship is lost or distorted; needs_review for a limited correctable omission; unacceptable for major omission, wrong section purpose, contradiction, or invented material content.

Do not reward invented facts. Exact measurements, units, identities, and unsupported claims are checked separately by deterministic evaluators.
Do not quote long source passages in the assessment or missingConcepts.

Section: ${sectionId}

APPROVED COMPLETE SECTION (evaluation only; never generation context):
${String(goldContent??"")}

GENERATED SECTION:
${String(generatedContent??"")}`,schema:SEMANTIC_EVAL_SCHEMA});
    const value=response.parsed;
    return {available:true,evaluator:"gold_benchmark_reviewer_v2",modelId:response.aiStatus.modelId,semanticSimilarity:bounded(value.semanticSimilarity),sectionIntentCoverage:bounded(value.sectionIntentCoverage),materialConceptRecall:bounded(value.materialConceptRecall),professionalAcceptability:bounded(value.professionalAcceptability),verdict:["acceptable","needs_review","unacceptable"].includes(value.verdict)?value.verdict:"unacceptable",assessment:String(value.assessment??"").slice(0,1000),missingConcepts:(value.missingConcepts??[]).map(String).slice(0,12),unacceptableReasons:(value.unacceptableReasons??[]).map(String).slice(0,12)};
  }catch(error){return {available:false,evaluator:"semantic_judge_v1",modelId:null,semanticSimilarity:null,sectionIntentCoverage:null,materialConceptRecall:null,assessment:"Semantic evaluation was unavailable; deterministic safety metrics remain authoritative.",missingConcepts:[],error:error instanceof Error?error.message:String(error)};}
}

const EVIDENCE_EVAL_SCHEMA={type:"object",additionalProperties:false,required:["evidenceCoverage","evidenceFidelity","safeAbstention","professionalUsefulness","verdict","assessment","missingEvidence","unsupportedStatements"],properties:{evidenceCoverage:{type:"number",minimum:0,maximum:1},evidenceFidelity:{type:"number",minimum:0,maximum:1},safeAbstention:{type:"number",minimum:0,maximum:1},professionalUsefulness:{type:"number",minimum:0,maximum:1},verdict:{type:"string",enum:["acceptable","needs_review","unsafe"]},assessment:{type:"string"},missingEvidence:{type:"array",items:{type:"string"},maxItems:12},unsupportedStatements:{type:"array",items:{type:"string"},maxItems:12}}};

export async function evaluateEvidenceConditionedGeneration({sectionId,allowedEvidence,generatedContent}){
  try{
    const response=await runStructuredCodexJob({reasoningEffort:"low",schema:EVIDENCE_EVAL_SCHEMA,prompt:`Evaluate a generated tank-inspection report section against ONLY the supplied current field evidence. Historical reports and hidden original-report content are not factual sources.

Score:
- evidenceCoverage: how completely the generated section expresses material information present in current evidence.
- evidenceFidelity: whether every material generated claim is supported without distortion.
- safeAbstention: whether unavailable facts remain omitted or explicitly pending rather than guessed.
- professionalUsefulness: readability and usefulness given the evidence that actually exists.
- verdict: unsafe if any material fact, measurement, identity, finding, conclusion, recommendation, or relationship is unsupported.

Do not penalize omission of information that is absent from current evidence. Do not reward similarity to any unseen original report.
Section numbering, headings, Markdown, and ordinary connective wording are presentation choices and must not cause an unsafe verdict. A company name or date must not be assigned a factual role unless its labelled evidence establishes that role.

SECTION: ${sectionId}

CURRENT FIELD EVIDENCE:
${JSON.stringify(allowedEvidence??{},null,2)}

GENERATED SECTION:
${String(generatedContent??"")}`,});
    const value=response.parsed;return {available:true,evaluator:"evidence_conditioned_reviewer_v1",modelId:response.aiStatus.modelId,evidenceCoverage:bounded(value.evidenceCoverage),evidenceFidelity:bounded(value.evidenceFidelity),safeAbstention:bounded(value.safeAbstention),professionalUsefulness:bounded(value.professionalUsefulness),verdict:["acceptable","needs_review","unsafe"].includes(value.verdict)?value.verdict:"unsafe",assessment:String(value.assessment??"").slice(0,1000),missingEvidence:(value.missingEvidence??[]).map(String).slice(0,12),unsupportedStatements:(value.unsupportedStatements??[]).map(String).slice(0,12)};
  }catch(error){return {available:false,evaluator:"evidence_conditioned_reviewer_v1",modelId:null,evidenceCoverage:null,evidenceFidelity:null,safeAbstention:null,professionalUsefulness:null,verdict:"needs_review",assessment:"Evidence-conditioned evaluation was unavailable.",missingEvidence:[],unsupportedStatements:[],error:error instanceof Error?error.message:String(error)};}
}

function bounded(value){const number=Number(value);return Number.isFinite(number)?Math.max(0,Math.min(1,number)):0;}
