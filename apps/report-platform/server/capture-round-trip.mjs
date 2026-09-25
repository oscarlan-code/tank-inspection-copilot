import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { preparationRevisionHash, reconstructionBenchmarkMetadata } from "./standardized-pair-builder.mjs";

const defaultAdapter = fileURLToPath(new URL("../../field-android/tools/capture-scenario-round-trip.mjs", import.meta.url));

export async function materializeCaptureScenario({ scenario, principal }) {
  const adapterPath = process.env.REPORT_PLATFORM_CAPTURE_ROUND_TRIP_ADAPTER || defaultAdapter;
  const stdout = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [adapterPath], { stdio: ["pipe", "pipe", "pipe"] });
    const output = [];
    const errors = [];
    let byteCount = 0;
    const timeout = setTimeout(() => child.kill("SIGTERM"), 30_000);
    child.stdout.on("data", (chunk) => {
      byteCount += chunk.length;
      if (byteCount > 16 * 1024 * 1024) child.kill("SIGTERM");
      else output.push(chunk);
    });
    child.stderr.on("data", (chunk) => errors.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0 && byteCount <= 16 * 1024 * 1024) resolve(Buffer.concat(output).toString("utf8"));
      else reject(new Error(Buffer.concat(errors).toString("utf8").trim() || "App round-trip adapter failed."));
    });
    child.stdin.end(JSON.stringify({ scenario, principal }));
  });
  return attachCapturePreparationProvenance({ scenario, exportPackage: JSON.parse(stdout), adapterOutputSha256: createHash("sha256").update(stdout).digest("hex") });
}

/** Preserve backend preparation claims separately from unchanged app records. */
export function attachCapturePreparationProvenance({ scenario, exportPackage, adapterOutputSha256 }) {
  if (exportPackage?.packageType !== "v3_product_export" || Number(exportPackage.schemaVersion) !== 3) throw new Error("Capture adapter did not return a V3 app package.");
  const captures = scenario?.captures ?? [];
  const exported = new Map((exportPackage.captureFacts ?? []).map((fact) => [fact.factId, fact]));
  if (exported.size !== (exportPackage.captureFacts ?? []).length) throw new Error("Capture adapter returned duplicate fact identities.");
  const issues = [];
  for (const capture of captures) {
    const actual = exported.get(capture.factId);
    if (!actual) throw new Error(`Capture adapter omitted ${capture.factId}.`);
    if (preparationRevisionHash(actual.value) !== preparationRevisionHash(capture.value)
      || String(actual.unitCode ?? "") !== String(capture.unitCode ?? "")) throw new Error(`Capture adapter changed value or unit for ${capture.factId}.`);
    for (const key of ["sourceLineage", "entityBindings"]) {
      if (actual[key] != null && capture[key] != null && preparationRevisionHash(actual[key]) !== preparationRevisionHash(capture[key])) throw new Error(`Capture adapter changed ${key} for ${capture.factId}.`);
    }
    if (capture.captureChannel === "measurement") {
      const native = (exportPackage.utMeasurements ?? []).find((row) => row.sourceFactId === capture.factId);
      if (!native || !["value1", "value2", "value3", "value4", "value5", "reinforcementPadReading"].some((key) => Object.hasOwn(native, key))) issues.push({ factId: capture.factId, reason: "native_measurement_cells_missing" });
    }
  }
  const included = new Set(captures.map((fact) => fact.factId));
  if ([...exported.keys()].some((id) => !included.has(id))) throw new Error("Capture adapter inserted a fact outside the supplied capture.");
  if ((scenario.withheldFacts ?? []).some((fact) => exported.has(fact.factId))) throw new Error("Withheld evidence entered the app package.");
  const historical = Boolean(scenario.identity?.truthCaseId)
    || scenario.captures?.some((fact) => fact.sourceLineage?.sourceClass === "issued_historical_report" || fact.value?.sourceRole === "gold_derived_synthetic_capture");
  const benchmark = historical ? reconstructionBenchmarkMetadata() : {
    evaluationTrack: scenario.identity?.evaluationTrack ?? "unclassified",
    learningEligible: false, promotionEligible: false, independentQualityEligible: false,
  };
  return {
    ...exportPackage,
    captureScenarioProvenance: {
      ...(exportPackage.captureScenarioProvenance ?? {}),
      ...benchmark,
      backendPreparation: {
        contractVersion: "capture_preparation_provenance_v1",
        providedBy: "report_platform_capture_preparation",
        scenarioSha256: preparationRevisionHash(scenario),
        adapterOutputSha256: adapterOutputSha256 ?? preparationRevisionHash(exportPackage),
        nativeRecordsModified: false,
        nativeAppParityVerified: false,
        nativeRepresentationIssues: issues,
        facts: captures.map((fact) => ({
          factId: fact.factId,
          sourceSectionKey: fact.sourceSectionKey ?? fact.sectionKey ?? null,
          sourceLineage: fact.sourceLineage ?? null,
          entityBindings: fact.entityBindings ?? null,
          safetyCriticality: fact.safetyCriticality ?? null,
        })),
      },
    },
  };
}
