import { createHash } from "node:crypto";

let input = "";
for await (const chunk of process.stdin) input += chunk;

try {
  const request = JSON.parse(input);
  process.stdout.write(`${JSON.stringify(materialize(request))}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

function materialize({ scenario, principal }) {
  requireValue(scenario?.packageType === "laiq_capture_scenario", "Unsupported Capture Scenario package.");
  requireValue(Number(scenario?.schemaVersion) === 1, "Unsupported Capture Scenario schema version.");
  requireValue(
    scenario?.appContractTarget?.packageType === "v3_product_export"
      && Number(scenario?.appContractTarget?.schemaVersion) === 3,
    "Capture Scenario does not target the Android V3 export contract.",
  );
  requireValue((scenario.expectedMissingInputs ?? []).length === 0, "Faithful scenarios cannot require manual input.");
  const captures = Array.isArray(scenario.captures) ? scenario.captures : [];
  const appRecords = scenario.appRecords && typeof scenario.appRecords === "object" ? scenario.appRecords : {};
  requireValue(captures.every((fact) => fact.disposition !== "withheld"), "Withheld facts cannot enter app capture.");

  const variantId = requiredString(scenario.identity?.variantId, "variantId");
  const tenantId = requiredString(principal?.tenantId, "principal.tenantId");
  const workspaceId = requiredString(principal?.workspaceId ?? principal?.primaryWorkspaceId, "principal.primaryWorkspaceId");
  const userId = requiredString(principal?.userId, "principal.userId");
  const exportedAtIso = new Date().toISOString();
  const inspectionId = `eval-${variantId}`;
  const inspectionReference = `EVAL-${variantId.slice(-12).toUpperCase()}`;
  const workspaceMembership = principal?.workspaceMemberships?.find((membership) => membership.workspaceId === workspaceId);
  const profile = {
    tenantId,
    tenantName: String(principal.tenantName ?? "LAIQ Evaluation"),
    workspaceId,
    workspaceName: String(principal.workspaceName ?? workspaceMembership?.workspaceName ?? "Evaluation Lab"),
    userId,
    displayName: String(principal.displayName ?? "Evaluation Lab"),
    roleLabel: String(principal.roleLabel ?? workspaceMembership?.roles?.[0] ?? principal?.platformRoles?.[0] ?? "Super Admin"),
    deviceId: "headless-app-round-trip",
  };
  const task = {
    inspectionId, inspectionReference, tenantId, workspaceId,
    createdByUserId: userId, lastEditedByUserId: userId,
    deviceId: profile.deviceId, client: "Evaluation dataset", tankNumber: variantId.slice(-8),
    location: "Synthetic evaluation", lifecycleState: "exported", currentScreenKey: "export_review",
    readinessStatusCode: "ready", readinessStatusLabel: "Ready",
    exportStatusCode: "exported", exportStatusLabel: "Exported",
    exportedAtIso, createdAtIso: exportedAtIso, updatedAtIso: exportedAtIso,
  };
  const identityFacts = buildIdentityFacts(captures);
  task.client = identityFacts.client ?? task.client;
  task.tankNumber = identityFacts.tankNumber ?? task.tankNumber;
  task.location = identityFacts.location ?? task.location;
  const captureFacts = captures.map((fact) => ({
    factId: fact.factId,
    factType: fact.factType,
    sectionKey: fact.sectionKey,
    sourcePageNumber: fact.sourcePageNumber ?? null,
    targetReportSectionId: fact.targetReportSectionId ?? null,
    value: fact.value,
    unitCode: fact.unitCode ?? null,
    captureDestination: fact.captureDestination ?? null,
    captureChannel: fact.captureChannel,
    disposition: fact.disposition,
    stableOrder: fact.stableOrder,
    transformation: fact.transformation ?? {},
  }));
  const measurements = captureFacts.filter((fact) => fact.captureChannel === "measurement").map((fact) => ({
    measurementId: fact.factId,
    inspectionId,
    targetKey: inferTarget(fact),
    itemKey: fact.captureDestination || fact.factId,
    readingValue: numericValue(fact.value),
    readingText: renderValue(fact.value),
    unitCode: fact.unitCode,
    sourceFactId: fact.factId,
  }));
  const voiceNotes = captures.filter((fact) => fact.captureChannel === "voice").map((fact) => {
    const context = fact.voiceContext ?? {};
    return {
    voiceNoteId: `voice-${fact.factId}`,
    relativePath: null,
    displayName: `${context.screenLabel ?? fact.sectionKey} voice note`,
    screenKey: context.screenKey ?? inferScreen(fact),
    screenLabel: context.screenLabel ?? fact.sectionKey,
    cardKey: context.cardKey ?? fact.captureDestination ?? fact.factType,
    fieldKey: context.fieldKey ?? "voice_note",
    targetKey: context.targetKey ?? inferTarget(fact),
    targetLabel: context.targetLabel ?? null,
    itemKey: context.itemKey ?? fact.factId,
    itemLabel: context.itemLabel ?? null,
    transcriptStatus: "synthetic_accepted",
    transcriptText: applyVoiceSurface(renderValue(fact.value), fact.transformation ?? {}, context),
    durationMs: syntheticDurationMs(applyVoiceSurface(renderValue(fact.value), fact.transformation ?? {}, context)),
    capturedAtIso: exportedAtIso,
    mediaType: null,
    fileExists: false,
    transformation: fact.transformation ?? {},
    };
  });
  return {
    packageType: "v3_product_export",
    schemaVersion: 3,
    inspectionReference,
    tenantId,
    workspaceId,
    inspectionId,
    exportedByUserId: userId,
    exportedAtIso,
    deviceId: profile.deviceId,
    workflowScreen: "export_review",
    profile,
    task,
    inspectionRecord: {
      inspectionId, tenantId, workspaceId, inspectionReference,
      createdByUserId: userId, lastEditedByUserId: userId, deviceId: profile.deviceId,
      schemaVersion: 3, client: task.client, tankNumber: task.tankNumber,
      location: task.location, reviewStatus: "round_trip_validated",
      createdAtIso: exportedAtIso, updatedAtIso: exportedAtIso,
      reportFamily: scenario.identity.reportFamily ?? null,
      tankOrientation: /horizontal/i.test(String(scenario.identity.reportFamily ?? "")) ? "horizontal" : null,
    },
    validationResults: [{
      inspectionId,
      ruleCode: "capture_scenario_contract",
      ruleLabel: "Capture Scenario contract",
      passed: true,
      blocksExport: true,
      message: "Scenario materialized by the app-owned headless V3 adapter.",
      updatedAtIso: exportedAtIso,
    }],
    taskSnapshots: [{ inspectionId, taskKey: "export_review", taskTitle: "Export Review", taskOrder: 1, inScope: true, statusCode: "complete" }],
    layoutTargets: cloneRecords(appRecords.layoutTargets),
    layoutConfigs: cloneRecords(appRecords.layoutConfigs),
    layoutFigures: cloneRecords(appRecords.layoutFigures),
    elements: cloneRecords(appRecords.elements),
    utMeasurements: [...cloneRecords(appRecords.utMeasurements), ...measurements],
    inspectionChecklistItems: cloneRecords(appRecords.inspectionChecklistItems),
    inspectionChecklistSectionNotes: cloneRecords(appRecords.inspectionChecklistSectionNotes),
    findings: [...cloneRecords(appRecords.findings), ...captureFacts.filter((fact) => fact.captureChannel === "note" || fact.factType === "finding").map((fact) => ({ findingId: fact.factId, inspectionId, targetKey: inferTarget(fact), itemKey: fact.factId, description: renderValue(fact.value), sourceFactId: fact.factId }))],
    voiceNotes,
    attachments: cloneRecords(appRecords.attachments),
    structuredTables: cloneRecords(appRecords.structuredTables),
    captureFacts,
    captureScenarioProvenance: {
      variantId,
      truthCaseId: scenario.identity.truthCaseId,
      captureProfile: scenario.identity.captureProfile,
      mockVersion: scenario.identity.deterministicSeed,
      scenarioSha256: createHash("sha256").update(JSON.stringify(scenario)).digest("hex"),
      reportFamily: scenario.identity.reportFamily ?? null,
      sourceReportName: scenario.identity.sourceReportName ?? null,
      assetLineageKey: scenario.identity.assetLineageKey ?? null,
    },
  };
}

function buildIdentityFacts(captures) {
  const output = {};
  for (const fact of captures) {
    const key = `${fact.factType ?? ""} ${fact.captureDestination ?? ""}`.toLowerCase();
    const value = renderValue(fact.value).replace(/^"|"$/g, "").trim();
    if (!value || value.length > 160) continue;
    if (!output.client && /client|owner|operator/.test(key)) output.client = value;
    if (!output.tankNumber && /tank.*(?:number|no|id)|asset.*id/.test(key)) output.tankNumber = value;
    if (!output.location && /location|site|terminal|depot/.test(key)) output.location = value;
  }
  return output;
}

function cloneRecords(value) {
  return Array.isArray(value) ? structuredClone(value) : [];
}

function inferTarget(fact) {
  const value = `${fact.sectionKey} ${fact.captureDestination ?? ""}`.toLowerCase();
  return ["external_roof", "internal_roof", "shell", "floor"].find((target) => value.includes(target.replace("_", " ")) || value.includes(target)) ?? "general";
}
function inferScreen(fact) { return fact.captureChannel === "measurement" ? "ut_measurement" : fact.sectionKey || "general_info"; }
function numericValue(value) { const candidate = typeof value === "number" ? value : Number(value?.value); return Number.isFinite(candidate) ? candidate : null; }
function renderValue(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    if (typeof value.text === "string") return value.text;
    if (typeof value.value === "string" || typeof value.value === "number") return String(value.value);
  }
  return JSON.stringify(value);
}
function applyVoiceSurface(value, transformation, context) {
  const source = String(value).trim();
  if (!source) return source;
  const style = String(transformation.noteStyle ?? "normal");
  let transcript = source;
  if (style === "detailed") transcript = `Detailed inspection note. ${source}`;
  else if (style === "detailed_voice") transcript = `Recording for ${context.itemLabel ?? "this inspection item"}. ${source} That is the complete observation for this item.`;
  else if (style === "spoken") transcript = `Okay, recording this now. ${source}`;
  else if (style === "interrupted") transcript = `Starting note— ${source} —end of note.`;
  else if (style === "technical_shorthand") transcript = `Inspection note: ${source}`;
  else if (style === "minimal") transcript = source.replace(/^Inspector (?:observation|recommendation):\s*/i, "");
  else if (style === "concise") transcript = source.replace(/^Inspector\s+/i, "");

  const key = String(transformation.surfaceVariantKey ?? "");
  const repetitionRate = bounded(transformation.repetitionRate);
  if (repetitionRate > 0 && deterministicSurfaceUnit(`${key}:repeat`) <= repetitionRate) {
    transcript = `${transcript} To confirm: ${source}`;
  }
  const noiseRate = bounded(transformation.asrNoiseRate);
  if (noiseRate > 0) {
    transcript = applyNonFactAsrNoise(transcript, noiseRate, key);
  }
  return transcript.replace(/\s+/g, " ").trim();
}
function applyNonFactAsrNoise(value, rate, key) {
  const words = String(value).split(/\s+/);
  const safeFillers = ["uh", "okay", "right"];
  const interval = Math.max(5, Math.round(1 / Math.max(rate, 0.01)));
  const output = [];
  for (let index = 0; index < words.length; index += 1) {
    if (index > 0 && index % interval === 0 && deterministicSurfaceUnit(`${key}:filler:${index}`) < rate * 2) {
      output.push(safeFillers[Math.floor(deterministicSurfaceUnit(`${key}:choice:${index}`) * safeFillers.length)]);
    }
    output.push(words[index]);
  }
  return output.join(" ").replace(/[;,](?=\s|$)/g, rate >= 0.08 ? "" : "$&");
}
function bounded(value) { const number = Number(value); return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0; }
function deterministicSurfaceUnit(value) { return Number.parseInt(createHash("sha256").update(String(value)).digest("hex").slice(0, 13), 16) / 0xfffffffffffff; }
function syntheticDurationMs(value) { return Math.max(1_000, Math.round(String(value).trim().split(/\s+/).filter(Boolean).length / 2.4 * 1_000)); }
function requiredString(value, label) { requireValue(typeof value === "string" && value.trim(), `Capture round trip requires ${label}.`); return value.trim(); }
function requireValue(condition, message) { if (!condition) throw new Error(message); }
