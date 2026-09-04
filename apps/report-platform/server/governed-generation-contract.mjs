import { removeUnsupportedPendingQualifiers } from "./evidence-entity-binding.mjs";
import { runStructuredCodexJob } from "./codex-cli.mjs";

export const GOVERNED_GENERATOR_CONTRACT_VERSION = "governed_hybrid_renderer_v3";

const TABLE_SECTION_PATTERN = /information|checklist|measurement|calculation|test-information/;
const LIST_SECTION_PATTERN = /inspection-report|recommendation|finding|scope/;

export function getGovernedSectionRoute({ sectionId, sectionKind = "narrative", hasVoiceEvidence = true } = {}) {
  if (sectionKind === "map" || /layout|platemap|corrosion-plan/.test(String(sectionId))) {
    return { route: "deterministic_map", format: "figure", llmRole: "none" };
  }
  if (sectionKind === "attachment" || sectionId === "photographs") {
    return { route: "deterministic_attachment", format: "attachment", llmRole: "none" };
  }
  if (sectionKind === "structured" || TABLE_SECTION_PATTERN.test(String(sectionId))) {
    return { route: "deterministic_structured", format: "table", llmRole: "none" };
  }
  if (LIST_SECTION_PATTERN.test(String(sectionId))) {
    return hasVoiceEvidence
      ? { route: "hybrid_narrative", format: "list", llmRole: "voice_narrative_only" }
      : { route: "deterministic_narrative", format: "list", llmRole: "none" };
  }
  return hasVoiceEvidence
    ? { route: "hybrid_narrative", format: "narrative", llmRole: "voice_narrative_only" }
    : { route: "deterministic_narrative", format: "narrative", llmRole: "none" };
}

const GOVERNED_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sectionContent"],
  properties: { sectionContent: { type: "string" } },
};

export function isGovernedGenerationPolicy({ policyVersionId = "", promptVariant = "" } = {}) {
  return String(policyVersionId).includes("report_generation_v18")
    || String(promptVariant).endsWith("_v2");
}

export function buildGovernedGenerationRules({ outputFormat = "markdown" } = {}) {
  const formatRule = outputFormat === "html"
    ? "Return client-facing export-ready HTML only. Keep structured app records out of the narrative because deterministic tooling inserts them separately."
    : "Return client-facing export-ready Markdown only. Keep structured app records out of the narrative because deterministic tooling inserts them separately.";

  return `${formatRule}

ENTITY-BINDING RULE: Treat every observationId as one indivisible engineering observation. Its entityId binds the physical component, location, structured field data, voice note, measurement, threshold, condition, and action. Never move a field between entityIds or observationIds. Every sentence containing an entity-specific measurement must name that entity using its supplied entityLabel. An absent threshold remains absent. Combining observations is allowed only when every original binding remains explicit and unchanged.

ATOMIC NARRATIVE RULE: Every voice note backed only by a section_observation entity must remain a separate paragraph or bullet. Do not merge it with an adjacent note, infer a shared subject, resolve ambiguous pronouns, attach a photo/reference to a finding, distribute a count across locations, or turn an isolated fragment into an applicability statement. Preserve ambiguous relationships and conditional wording exactly. If a note is incomplete, reproduce only the supplied fragment under Unassigned captured notes without assigning a status.

FRAGMENT RULE: Do not author Pending confirmation; that status may only come from explicit app evidence and is inserted by deterministic tooling. Never assign a factual status to an incomplete fragment. Two consecutive notes may be joined only when the first ends with an unfinished conjunction or relative word and the next begins with its direct lowercase grammatical continuation. A standalone person name, role, company, date, photo reference, or identifier with no explicit field relationship must remain an independent unassigned note.

STRUCTURED APP-RECORD RULE: Labelled fields, lists, measurements, checklist rows, and tables are excluded from narrative authorship and inserted by deterministic compilers. Do not recreate, summarize, transform, or guess them. Generate narrative only from supplied voice evidence and preserve its field label and entity binding.

PRECEDENT RULE: Historical precedent controls section organization, terminology, and cadence only. It never supplies facts for the current inspection.`;
}

export function finalizeGovernedGeneratedContent({
  narrative = "",
  deterministicContent = "",
  evidenceInput = {},
} = {}) {
  const safeNarrative = removeUnsupportedPendingQualifiers(String(narrative).trim(), evidenceInput).trim();
  return [safeNarrative, String(deterministicContent).trim()].filter(Boolean).join("\n\n").trim();
}

export function compileGovernedCaptureFactsHtml(captureFacts = [], { sectionId = "", sectionKind = "narrative" } = {}) {
  const facts = captureFacts.filter((fact) => !["voice", "voice_normalized", "note"].includes(String(fact.captureChannel)));
  if (!facts.length) return "";
  const rows = facts.map((fact) => {
    const value = fact?.value && typeof fact.value === "object" && "text" in fact.value
      ? fact.value.text
      : fact?.value;
    const label = fact?.value?.sourceHeading ?? fact?.sourceSectionKey ?? fact?.factType ?? "Captured field";
    const unit = fact?.unitCode ? ` ${fact.unitCode}` : "";
    return { label: escapeHtml(label), value: `${escapeHtml(displayValue(value))}${escapeHtml(unit)}` };
  });
  const route = getGovernedSectionRoute({ sectionId, sectionKind });
  if (route.format === "table") {
    return `<table data-laiq-provenance="app_field_data"><thead><tr><th>Captured field</th><th>Recorded value</th></tr></thead><tbody>${rows.map((row) => `<tr><th>${row.label}</th><td>${row.value}</td></tr>`).join("")}</tbody></table>`;
  }
  if (route.format === "list") {
    return `<ul data-laiq-provenance="app_field_data">${rows.map((row) => `<li><strong>${row.label}:</strong> ${row.value}</li>`).join("")}</ul>`;
  }
  return rows.map((row) => `<h4 data-laiq-provenance="app_field_data">${row.label}</h4><p data-laiq-provenance="app_field_data">${row.value}</p>`).join("\n");
}

export function formatGovernedSectionHtml({ sectionId, sectionTitle, sectionKind = "narrative", content = "" } = {}) {
  const route = getGovernedSectionRoute({ sectionId, sectionKind });
  let html = String(content ?? "").trim();
  html = html.replace(/^\s*#{1,4}\s+(.+)$/gm, "<h3>$1</h3>");
  if (!/<h[1-4]\b/i.test(html)) html = `<h3>${escapeHtml(sectionTitle || humanize(sectionId))}</h3>${html}`;
  if (route.format === "table" && !/<table\b/i.test(html)) {
    const body = html.replace(/<h[1-4][^>]*>[\s\S]*?<\/h[1-4]>/i, "").trim();
    html = `${html.match(/<h[1-4][^>]*>[\s\S]*?<\/h[1-4]>/i)?.[0] ?? ""}<table><tbody><tr><td>${body}</td></tr></tbody></table>`;
  }
  if (route.format === "list" && !/<(?:ul|ol)\b/i.test(html)) {
    const heading = html.match(/<h[1-4][^>]*>[\s\S]*?<\/h[1-4]>/i)?.[0] ?? "";
    const body = html.replace(heading, "").trim();
    html = `${heading}<ul>${body ? `<li>${body}</li>` : ""}</ul>`;
  }
  return html.trim();
}

function displayValue(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;").replace(/\r?\n/g, "<br>");
}

function humanize(value) {
  return String(value ?? "Section").split("-").filter(Boolean).map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
}

export async function runGovernedNarrativeGeneration({
  sectionId,
  evidenceInput,
  precedents = [],
  policyAction,
  promptVariant,
  precedentCharacterLimit = 2000,
}) {
  const limit = Math.max(800, Math.min(3000, Number(precedentCharacterLimit) || 2000));
  const precedentText = precedents.map((item, index) => {
    const content = item?.content ?? item?.text ?? item?.excerpt ?? JSON.stringify(item);
    return `PRECEDENT ${index + 1}:\n${String(content).slice(0, limit)}`;
  }).join("\n\n") || "No compatible precedent was retrieved.";
  const prompt = `You generate one export-ready tank-inspection report section from current field evidence. Never copy precedent-specific client, asset, measurement, finding, conclusion, or recommendation facts. Never invent missing facts. Preserve every current-evidence measurement, identifier, unit, relationship, field label, and qualification strength exactly. Entity IDs and observation IDs are internal provenance only and must never appear in client-facing content.

${buildGovernedGenerationRules({ outputFormat: "html" })}

POLICY-SPECIFIC ACTION: ${policyAction}

SECTION: ${sectionId}
PROMPT MODE: ${promptVariant}

CURRENT FIELD EVIDENCE (authoritative):
${JSON.stringify(evidenceInput, null, 2)}

HISTORICAL SAME-FAMILY/SAME-SECTION PRECEDENTS (format and phrasing patterns only):
${precedentText}

Return only sectionContent as clean export-ready HTML. Include one h3 heading and professional paragraphs or lists as appropriate.`;
  return runStructuredCodexJob({ reasoningEffort: "low", schema: GOVERNED_OUTPUT_SCHEMA, prompt });
}
