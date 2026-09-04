import { createHash } from "node:crypto";

export const EVIDENCE_ENTITY_BINDING_VERSION = 1;

export function extractStructuredAppTables({ report, sectionKey, content }) {
  const lines = String(content ?? "").replace(/\\n/g, "\n").split(/\r?\n/);
  const groups = [];
  let current = [];
  for (const line of lines) {
    if ((line.match(/\|/g) ?? []).length >= 2) current.push(line);
    else if (current.length) { groups.push(current); current = []; }
  }
  if (current.length) groups.push(current);

  const tables = [];
  for (const [tableIndex, group] of groups.entries()) {
    const matrix = group.map(parseTableRow).filter((row) => row.length >= 2 && !isSeparatorRow(row));
    if (matrix.length < 2) continue;
    const width = Math.max(...matrix.map((row) => row.length));
    const normalizedMatrix = matrix.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill("")]);
    const tableId = stableId("app-table", report.asset_lineage_key, sectionKey, tableIndex + 1, JSON.stringify(normalizedMatrix));
    const columns = normalizedMatrix[0].map((label, index) => ({ columnId: `${tableId}:column:${index + 1}`, label, stableOrder: index + 1 }));
    const rows = normalizedMatrix.slice(1).map((cells, rowIndex) => {
      const itemKey = `${sectionKey}:table:${tableIndex + 1}:row:${rowIndex + 1}`;
      const entityId = stableId("app-entity", report.asset_lineage_key, sectionKey, itemKey);
      return { entityId, itemKey, stableOrder: rowIndex + 1, cells: cells.map((value, columnIndex) => ({ columnId: columns[columnIndex].columnId, value })) };
    });
    tables.push({
      tableId,
      sectionKey,
      targetKey: inferTargetKey(sectionKey, normalizedMatrix.flat().join(" ")),
      source: "android_app_structured_field_mock",
      columns,
      rows,
      exactMatrix: normalizedMatrix,
    });
  }
  return tables;
}

export function removeStructuredTableLines(content) {
  return String(content ?? "").replace(/\\n/g, "\n").split(/\r?\n/)
    .filter((line) => (line.match(/\|/g) ?? []).length < 2)
    .join("\n");
}

export function extractStructuredAppFieldsAndLists({ report, sectionKey, content }) {
  const lines = String(content ?? "").replace(/\\n/g, "\n").split(/\r?\n/);
  const consumed = new Set();
  const labelledFields = [];
  const structuredLists = [];
  const fieldPattern = /^(Client|Customer|Job\s*(?:No\.?|Number|Reference)|Report\s*(?:No\.?|Number|Reference)|Tank\s*(?:No\.?|Number|ID)|Inspection\s*Date|Date\s*(?:Inspected|Completed|Issued))\s*:\s*(.*)$/i;
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].trim().match(fieldPattern);
    if (!match) continue;
    let value = match[2].trim();
    if (!value && lines[index + 1]?.trim() && !lines[index + 1].includes("|")) {
      value = lines[index + 1].trim();
      consumed.add(index + 1);
    }
    if (!value) continue;
    consumed.add(index);
    const label = match[1].replace(/\s+/g, " ");
    const fieldId = stableId("app-field", report.asset_lineage_key, sectionKey, label, value);
    labelledFields.push({ fieldId, sectionKey, label, value, source: "android_app_structured_field_mock", stableOrder: labelledFields.length + 1 });
  }
  let current = null;
  for (let index = 0; index < lines.length; index += 1) {
    if (consumed.has(index) || lines[index].includes("|")) continue;
    const match = lines[index].trim().match(/^(\(?[a-z0-9]+\)?[.)])\s+(.+)$/i);
    if (!match) { current = null; continue; }
    if (!current) {
      current = { listId: stableId("app-list", report.asset_lineage_key, sectionKey, index), sectionKey, title: null, source: "android_app_structured_list_mock", items: [] };
      structuredLists.push(current);
    }
    consumed.add(index);
    current.items.push({ itemKey: `${current.listId}:item:${current.items.length + 1}`, marker: match[1], text: match[2].trim(), stableOrder: current.items.length + 1 });
  }
  return { labelledFields, structuredLists, remainingContent: lines.filter((_, index) => !consumed.has(index)).join("\n") };
}

export function compileDeterministicAppRecords(appRecords = {}, { outputFormat = "markdown" } = {}) {
  if (outputFormat === "html") return compileDeterministicAppRecordsHtml(appRecords);
  const blocks = [];
  const fields = appRecords.labelledFields ?? [];
  if (fields.length) {
    blocks.push(["### Captured fields", "| Field | Value |", "|---|---|", ...fields.map((field) => `| ${escapeCell(field.label)} | ${escapeCell(field.value)} |`)].join("\n"));
  }
  for (const list of appRecords.structuredLists ?? []) {
    const rows = [];
    if (list.title) rows.push(`### ${list.title}`);
    rows.push(...(list.items ?? []).map((item) => `${item.marker} ${item.text}`));
    if (rows.length) blocks.push(rows.join("\n"));
  }
  for (const table of appRecords.structuredTables ?? []) {
    const matrix = table.exactMatrix ?? [];
    if (!matrix.length) continue;
    const width = Math.max(...matrix.map((row) => row.length));
    const rows = matrix.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill("")]);
    blocks.push([`### Captured table`, `| ${rows[0].map(escapeCell).join(" | ")} |`, `| ${rows[0].map(() => "---").join(" | ")} |`, ...rows.slice(1).map((row) => `| ${row.map(escapeCell).join(" | ")} |`)].join("\n"));
  }
  return blocks.join("\n\n");
}

function compileDeterministicAppRecordsHtml(appRecords = {}) {
  const blocks = [];
  const fields = appRecords.labelledFields ?? [];
  if (fields.length) blocks.push(`<table data-laiq-provenance="app_field_data"><thead><tr><th>Captured field</th><th>Recorded value</th></tr></thead><tbody>${fields.map((field) => `<tr><th>${escapeHtmlCell(field.label)}</th><td>${escapeHtmlCell(field.value)}</td></tr>`).join("")}</tbody></table>`);
  for (const list of appRecords.structuredLists ?? []) {
    blocks.push(`${list.title ? `<h4>${escapeHtmlCell(list.title)}</h4>` : ""}<ol>${(list.items ?? []).map((item) => `<li>${escapeHtmlCell(item.text)}</li>`).join("")}</ol>`);
  }
  for (const table of appRecords.structuredTables ?? []) {
    const matrix = table.exactMatrix ?? [];
    if (!matrix.length) continue;
    const width = Math.max(...matrix.map((row) => row.length));
    const rows = matrix.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill("")]);
    blocks.push(`<table data-laiq-provenance="app_field_data"><thead><tr>${rows[0].map((cell) => `<th>${escapeHtmlCell(cell)}</th>`).join("")}</tr></thead><tbody>${rows.slice(1).map((row) => `<tr>${row.map((cell) => `<td>${escapeHtmlCell(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
  }
  return blocks.join("\n");
}

function escapeHtmlCell(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;").replace(/\r?\n/g, "<br>");
}

export function removeUnsupportedPendingQualifiers(content, input) {
  const explicitPending = (input?.voiceNotes ?? []).some((note) => /pending confirmation/i.test(String(note.transcript ?? "")))
    || JSON.stringify(input?.appRecords ?? {}).toLowerCase().includes("pending confirmation");
  if (explicitPending) return String(content ?? "");
  return String(content ?? "").replace(/\s*(?:[-—:;]\s*)?\(?pending confirmation\)?\.?/ig, "").replace(/[ \t]+$/gm, "");
}

export function buildAppEntityEvidence(exportPackage) {
  const inspectionReference = String(exportPackage?.inspectionReference ?? exportPackage?.inspectionId ?? "inspection");
  const entities = new Map();
  const unboundVoiceNotes = [];

  function ensureEntity({ targetKey, itemKey, itemLabel = null, itemKind = null }) {
    if (!targetKey || !itemKey) return null;
    const entityId = stableId("app-entity", inspectionReference, targetKey, itemKey);
    if (!entities.has(entityId)) {
      entities.set(entityId, {
        entityId,
        inspectionReference,
        targetKey,
        itemKey,
        itemLabel,
        itemKind,
        measurements: [],
        findings: [],
        voiceNotes: [],
      });
    }
    const entity = entities.get(entityId);
    if (!entity.itemLabel && itemLabel) entity.itemLabel = itemLabel;
    if (!entity.itemKind && itemKind) entity.itemKind = itemKind;
    return entity;
  }

  for (const measurement of exportPackage?.utMeasurements ?? []) {
    const entity = ensureEntity(measurement);
    if (!entity) continue;
    entity.measurements.push({
      itemKey: measurement.itemKey,
      itemLabel: measurement.itemLabel,
      measured: Boolean(measurement.measured),
      confirmed: Boolean(measurement.confirmed),
      unitCode: "mm",
      values: [measurement.value1, measurement.value2, measurement.value3, measurement.value4, measurement.value5]
        .filter((value) => Number.isFinite(value)),
      reinforcementPadReading: Number.isFinite(measurement.reinforcementPadReading) ? measurement.reinforcementPadReading : null,
      course: measurement.course ?? null,
      plateId: measurement.plateId ?? null,
      elementId: measurement.elementId ?? null,
      laneId: measurement.laneId ?? null,
    });
  }

  for (const finding of exportPackage?.findings ?? []) {
    const entity = ensureEntity({
      targetKey: finding.targetKey,
      itemKey: finding.linkedUtItemKey,
      itemLabel: finding.itemLabel,
      itemKind: finding.itemKind,
    });
    if (!entity) continue;
    entity.findings.push({
      findingId: finding.findingId,
      note: finding.note,
      attachmentCount: finding.attachmentCount ?? 0,
      hasMissingAttachment: Boolean(finding.hasMissingAttachment),
    });
  }

  for (const note of exportPackage?.voiceNotes ?? []) {
    const entity = ensureEntity(note);
    const voiceEvidence = {
      voiceNoteId: note.voiceNoteId,
      fieldKey: note.fieldKey,
      screenKey: note.screenKey,
      transcriptStatus: note.transcriptStatus,
      transcriptText: note.transcriptText,
      capturedAtIso: note.capturedAtIso,
    };
    if (entity) entity.voiceNotes.push(voiceEvidence);
    else unboundVoiceNotes.push({ ...voiceEvidence, targetKey: note.targetKey, itemLabel: note.itemLabel });
  }

  for (const table of exportPackage?.structuredTables ?? []) {
    for (const row of table.rows ?? []) {
      if (!row.itemKey) continue;
      const entity = ensureEntity({ targetKey: table.targetKey ?? "general", itemKey: row.itemKey, itemLabel: row.itemKey, itemKind: "structured_table_row" });
      entity.structuredTableRows = entity.structuredTableRows ?? [];
      entity.structuredTableRows.push({ tableId: table.tableId, columns: table.columns, cells: row.cells });
    }
  }

  return {
    entityBindingVersion: EVIDENCE_ENTITY_BINDING_VERSION,
    identitySource: "laiq_app_target_key_plus_item_key",
    entities: [...entities.values()],
    unboundVoiceNotes,
  };
}

export function buildEntityBoundEvidence({ report, sectionKey, transcripts }) {
  const entities = new Map();
  const observations = [];
  const voiceNotes = [];

  transcripts.forEach((transcriptValue, index) => {
    const transcript = String(transcriptValue ?? "").trim();
    const inferred = inferEntityReference(transcript, sectionKey, index);
    const entityMetadata = {
      assetLineageKey: String(report.asset_lineage_key),
      reportReference: String(report.report_reference),
      sectionKey,
      entityType: inferred.entityType,
      entityKey: inferred.entityKey,
      entityLabel: inferred.entityLabel,
    };
    const entityId = stableId("entity", entityMetadata.assetLineageKey, sectionKey, inferred.entityType, inferred.entityKey);
    const observationId = stableId("observation", entityId, index + 1, transcript);
    const voiceNoteId = `voice_${index + 1}`;
    const fieldLabel = inferVoiceLabel(transcript);
    const boundClaims = extractBoundClaims(transcript);

    if (!entities.has(entityId)) {
      entities.set(entityId, {
        entityId,
        ...entityMetadata,
        aliases: inferred.aliases,
      });
    }
    observations.push({
      observationId,
      entityId,
      sectionKey,
      entityMetadata,
      fieldData: { measurements: boundClaims.measurements },
      boundClaims,
      evidenceRefs: [{ sourceType: "voice", sourceId: voiceNoteId }],
    });
    voiceNotes.push({
      voiceNoteId,
      observationId,
      entityId,
      entityMetadata,
      sectionKey,
      fieldLabel,
      fieldPath: `sections.${sectionKey}.entities.${entityId}.voiceNotes.${voiceNoteId}`,
      transcript,
      captureOrder: index + 1,
      source: "simulated_labelled_mobile_capture",
    });
  });

  return {
    entityBindingVersion: EVIDENCE_ENTITY_BINDING_VERSION,
    entities: [...entities.values()],
    observations,
    voiceNotes,
  };
}

export function validateEntityBoundEvidence(input) {
  if (Number(input?.entityBindingVersion) !== EVIDENCE_ENTITY_BINDING_VERSION) {
    return { valid: false, issues: ["entity_binding_version_missing"] };
  }
  const entities = new Map((input.entities ?? []).map((item) => [item.entityId, item]));
  const observations = new Map((input.observations ?? []).map((item) => [item.observationId, item]));
  const issues = [];
  for (const note of input.voiceNotes ?? []) {
    const observation = observations.get(note.observationId);
    if (!note.entityId || !entities.has(note.entityId)) issues.push(`voice_entity_missing:${note.voiceNoteId}`);
    if (!observation) issues.push(`voice_observation_missing:${note.voiceNoteId}`);
    else if (observation.entityId !== note.entityId) issues.push(`voice_observation_entity_mismatch:${note.voiceNoteId}`);
  }
  for (const observation of observations.values()) {
    if (!observation.entityId || !entities.has(observation.entityId)) issues.push(`observation_entity_missing:${observation.observationId}`);
    if (!(observation.evidenceRefs ?? []).length) issues.push(`observation_evidence_missing:${observation.observationId}`);
  }
  return { valid: issues.length === 0, issues };
}

export function scoreEntityRelationshipBindings(input, generatedContent) {
  if (!Array.isArray(input?.observations) || !Array.isArray(input?.entities)) {
    return { applicable: false, violationCount: 0, violations: [], rule: "entity_relationship_binding_v1" };
  }
  const entities = new Map(input.entities.map((item) => [item.entityId, item]));
  const observations = input.observations.map((item) => ({
    ...item,
    measurements: new Set((item.boundClaims?.measurements ?? []).map(canonicalClaim)),
  }));
  const entityAliases = [...entities.values()].flatMap((entity) =>
    (entity.aliases ?? []).map((alias) => ({ entityId: entity.entityId, alias: normalized(alias) })).filter((item) => item.alias.length >= 3));
  const violations = [];
  for (const sentence of generatedSentences(generatedContent)) {
    const measurements = extractMeasurements(sentence);
    if (!measurements.length) continue;
    const sentenceText = normalized(sentence);
    const mentionedEntities = new Set(entityAliases.filter((item) => sentenceText.includes(item.alias)).map((item) => item.entityId));
    for (const measurement of measurements) {
      const candidates = observations.filter((item) => item.measurements.has(measurement));
      if (!candidates.length) continue;
      const candidateEntityIds = new Set(candidates.map((item) => item.entityId));
      const requiresExplicitEntity = candidates.some((item) => entities.get(item.entityId)?.entityType !== "section_observation");
      const matched = [...mentionedEntities].some((entityId) => candidateEntityIds.has(entityId));
      const wrong = [...mentionedEntities].some((entityId) => !candidateEntityIds.has(entityId));
      if (wrong || (requiresExplicitEntity && !matched)) {
        violations.push({
          measurement,
          reason: wrong ? "measurement_linked_to_wrong_entity" : "entity_identity_omitted_for_measurement",
          expectedEntityIds: [...candidateEntityIds],
          mentionedEntityIds: [...mentionedEntities],
          sentence: sentence.slice(0, 400),
        });
      }
    }
  }
  return { applicable: true, violationCount: violations.length, violations: violations.slice(0, 20), rule: "entity_relationship_binding_v1" };
}

function inferEntityReference(text, sectionKey, index) {
  const patterns = [
    { entityType: "plate", regex: /\b((?:floor|shell|roof)\s+plate)\b\s*(?:no\.?|number|id)?\s*[:#-]?\s*([A-Z]{0,3}[- ]?\d+[A-Z]?)\b/i },
    { entityType: "plate", regex: /\bplate\b\s*(?:no\.?|number|id)?\s*[:#-]?\s*([A-Z]{1,3}[- ]?\d+[A-Z]?|\d+[A-Z]?)\b/i },
    { entityType: "shell_course", regex: /\b(shell\s+course)\b\s*(?:no\.?|number)?\s*[:#-]?\s*(\d+[A-Z]?)\b/i },
    { entityType: "nozzle", regex: /\b(nozzle)\b\s*(?:no\.?|number|id)?\s*[:#-]?\s*([A-Z]{0,3}\d+[A-Z0-9-]*|[A-Z])\b/i },
    { entityType: "station", regex: /\b(station)\b\s*(?:no\.?|number)?\s*[:#-]?\s*(\d+[A-Z]?)\b/i },
  ];
  for (const pattern of patterns) {
    const match = String(text).match(pattern.regex);
    if (!match) continue;
    const descriptor = match.length > 3 ? match[1] : pattern.entityType.replace("_", " ");
    const key = String(match.at(-1)).replace(/\s+/g, "-").toUpperCase();
    const label = `${titleCase(descriptor)} ${key}`;
    return { entityType: pattern.entityType, entityKey: key, entityLabel: label, aliases: unique([label, match[0]]) };
  }
  const entityKey = `OBS-${index + 1}`;
  return { entityType: "section_observation", entityKey, entityLabel: `${titleCase(sectionKey.replaceAll("-", " "))} observation ${index + 1}`, aliases: [] };
}

function inferVoiceLabel(value) {
  const text = String(value ?? "").trim();
  if (/^client\s*:/i.test(text)) return "Client";
  if (/^(?:job|report)\s*(?:no\.?|reference)\s*:/i.test(text)) return "Report reference";
  if (/^tank\s*no\.?\s*:/i.test(text)) return "Tank identity";
  if (/^(?:date|completed)\s*:/i.test(text)) return "Inspection date";
  if (/^item\s*:/i.test(text)) return "Inspected item";
  if (/\brecommend/i.test(text)) return "Recommendation note";
  if (/\b(?:inspect|examin|survey|scope)\b/i.test(text)) return "Inspection scope note";
  if (/\b(?:reading|measurement|thickness|diameter|mm\b|cm\b|\bin\.)/i.test(text)) return "Measurement note";
  return "Section narrative note";
}

function extractBoundClaims(value) {
  return { measurements: extractMeasurements(value) };
}

function extractMeasurements(value) {
  const matches = String(value ?? "").match(/\b[-+]?\d+(?:\.\d+)?\s*(?:mm|cm|m\b|in\.?|%|mpa|psi|years?)\b/gi) ?? [];
  return unique(matches.map(canonicalClaim));
}

function generatedSentences(value) {
  return String(value ?? "").split(/\n+|(?<=[.!?;])\s+/).map((item) => item.replace(/^[-*#\s]+/, "").trim()).filter(Boolean);
}

function parseTableRow(line) {
  return String(line).trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.replace(/\\\|/g, "|").replace(/\s+/g, " ").trim());
}

function escapeCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}


function isSeparatorRow(row) {
  return row.every((cell) => /^:?-{2,}:?$/.test(cell.replace(/\s+/g, "")));
}

function inferTargetKey(sectionKey, value) {
  const text = `${sectionKey} ${value}`.toLowerCase();
  if (/\bfloor|bottom plate/.test(text)) return "floor";
  if (/\broof/.test(text)) return "external_roof";
  if (/\bshell|strake|course/.test(text)) return "shell";
  return "general";
}

function canonicalClaim(value) {
  return normalized(value).replace(/\s+(?=(?:mm|cm|m\b|in\.?|%|mpa|psi|years?)\b)/g, "").replace(/[.,;:]+$/g, "");
}

function stableId(...values) {
  return `${values[0]}_${createHash("sha256").update(values.join(":")).digest("hex").slice(0, 24)}`;
}

function normalized(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function titleCase(value) {
  return String(value).replace(/\b\w/g, (character) => character.toUpperCase());
}

function unique(values) {
  return [...new Set(values)];
}
