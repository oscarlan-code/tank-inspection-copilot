import { readFile } from "node:fs/promises";
import {
  GOVERNED_GENERATOR_CONTRACT_VERSION,
  buildGovernedGenerationRules,
  finalizeGovernedGeneratedContent,
  getGovernedSectionRoute,
  isGovernedGenerationPolicy,
} from "../governed-generation-contract.mjs";

const generationSource = await readFile(new URL("../generation.mjs", import.meta.url), "utf8");
const pilotSource = await readFile(new URL("./run-governed-rag-training-pilot.mjs", import.meta.url), "utf8");
const failures = [];

if (!isGovernedGenerationPolicy({ policyVersionId: "rl_policy_report_generation_v18_app_owned_pending" })) {
  failures.push("V18 is not routed through the governed generation contract.");
}
for (const rule of ["ENTITY-BINDING RULE", "ATOMIC NARRATIVE RULE", "FRAGMENT RULE", "STRUCTURED APP-RECORD RULE", "PRECEDENT RULE"]) {
  if (!buildGovernedGenerationRules({ outputFormat: "html" }).includes(rule)) failures.push(`Shared contract is missing ${rule}.`);
}
if (!generationSource.includes("runGovernedNarrativeGeneration({")) failures.push("Production generation does not call the shared governed generator.");
if (!pilotSource.includes("runGovernedNarrativeGeneration({")) failures.push("Governed training does not call the shared governed generator.");
if (!generationSource.includes("generatorContractVersion: governedGeneration ? GOVERNED_GENERATOR_CONTRACT_VERSION")) failures.push("Production generation does not persist the governed contract version.");
if (pilotSource.includes("ATOMIC NARRATIVE RULE:") || pilotSource.includes("STRUCTURED APP-RECORD RULE:")) failures.push("Training contains a private copy of governed prompt rules.");
if (getGovernedSectionRoute({ sectionId: "general-tank-information" }).route !== "deterministic_structured") failures.push("Structured sections are not deterministically routed.");
if (getGovernedSectionRoute({ sectionId: "scope-of-inspection" }).route !== "hybrid_narrative") failures.push("Narrative sections are not hybrid-routed.");
if (getGovernedSectionRoute({ sectionId: "floor-plate-corrosion-plan", sectionKind: "map" }).route !== "deterministic_map") failures.push("Map sections are not deterministically routed.");
if (!generationSource.includes("formatGovernedSectionHtml({")) failures.push("Production does not use the shared deterministic formatter.");
if (!pilotSource.includes("formatGovernedSectionHtml({")) failures.push("Training does not use the shared deterministic formatter.");

const finalized = finalizeGovernedGeneratedContent({
  narrative: "Observed corrosion — Pending confirmation.",
  deterministicContent: "<p>Plate P-1: 8.2 mm</p>",
  evidenceInput: { voiceNotes: [{ transcript: "Observed corrosion" }] },
});
if (/pending confirmation/i.test(finalized) || !finalized.includes("Plate P-1: 8.2 mm")) failures.push("Shared output finalization does not enforce the governed pending/deterministic contract.");

if (failures.length) throw new Error(`Governed generator parity audit failed:\n- ${failures.join("\n- ")}`);
console.log(JSON.stringify({ passed: true, generatorContractVersion: GOVERNED_GENERATOR_CONTRACT_VERSION }, null, 2));
