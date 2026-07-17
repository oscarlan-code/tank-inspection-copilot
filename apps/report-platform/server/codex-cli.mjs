import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const defaultModelId = "gpt-5.6-sol";
const minimumGpt56CodexCliVersion = "0.144.0";
const configuredModelId = process.env.REPORT_PLATFORM_CODEX_MODEL?.trim() || defaultModelId;
const codexTimeoutMs = parsePositiveInteger(process.env.REPORT_PLATFORM_CODEX_TIMEOUT_MS, 120000);
const codexAvailability = detectCodexAvailability();

export function getAiStatus() {
  const needsGpt56Support = isGpt56Model(configuredModelId);
  const versionSupported =
    !needsGpt56Support ||
    compareSemver(codexAvailability.version, minimumGpt56CodexCliVersion) >= 0;
  const available = codexAvailability.available && versionSupported;
  const versionLabel = codexAvailability.version
    ? `Codex CLI ${codexAvailability.version}`
    : codexAvailability.available
      ? "Codex CLI version unknown"
      : "Codex CLI unavailable";

  return {
    mode: available ? "live_codex_cli" : "deterministic_fallback",
    provider: available ? "codex_cli" : "deterministic",
    modelId: available ? configuredModelId : null,
    targetModelId: configuredModelId,
    configured: available,
    statusLabel: available
      ? `LAIQ AI Engine worker (${configuredModelId}, ${versionLabel}, timeout ${codexTimeoutMs}ms)`
      : buildUnavailableDetail({ needsGpt56Support, versionSupported, versionLabel }),
    detail: available
      ? "Section generation and section chat will attempt GPT-5.6 Sol through Codex CLI first and fall back only if the worker run fails or times out."
      : buildUnavailableDetail({ needsGpt56Support, versionSupported, versionLabel }),
    codexCliVersion: codexAvailability.version,
    minimumCodexCliVersion: needsGpt56Support ? minimumGpt56CodexCliVersion : null,
    timeoutMs: codexTimeoutMs,
    checkedAtIso: new Date().toISOString(),
  };
}

export async function runStructuredCodexJob({
  prompt,
  schema,
}) {
  const status = getAiStatus();
  if (!status.configured) {
    throw new Error(status.detail);
  }

  const workingDir = await mkdtemp(join(tmpdir(), "report-platform-codex-"));
  const schemaPath = join(workingDir, "schema.json");
  const outputPath = join(workingDir, "output.json");

  await writeFile(schemaPath, JSON.stringify(schema, null, 2), "utf8");

  try {
    await runCodexExec({
      outputPath,
      prompt,
      schemaPath,
    });

    const raw = await readFile(outputPath, "utf8");
    return {
      aiStatus: status,
      parsed: JSON.parse(raw),
      raw,
    };
  } finally {
    await rm(workingDir, { recursive: true, force: true });
  }
}

function runCodexExec({
  outputPath,
  prompt,
  schemaPath,
}) {
  return new Promise((resolve, reject) => {
    const args = ["-a", "never"];
    if (configuredModelId) {
      args.push("-m", configuredModelId);
    }
    args.push(
      "exec",
      "--sandbox",
      "read-only",
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "--output-schema",
      schemaPath,
      "-o",
      outputPath,
      "-",
    );

    const child = spawn("codex", args, {
      cwd: appRoot,
      env: buildCodexWorkerEnv(),
      stdio: ["pipe", "ignore", "pipe"],
    });

    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error(`LAIQ AI Engine worker timed out after ${codexTimeoutMs}ms using ${configuredModelId}.`));
    }, codexTimeoutMs);

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 32000) {
        stderr = stderr.slice(-32000);
      }
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `LAIQ AI Engine worker failed with exit code ${code}.${stderr ? ` stderr: ${compactWhitespace(stderr)}` : ""}`,
        ),
      );
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function detectCodexAvailability() {
  const result = spawnSync("codex", ["--version"], {
    encoding: "utf8",
  });

  const versionOutput = `${result.stdout ?? ""} ${result.stderr ?? ""}`.trim();
  return {
    available: result.status === 0,
    version: parseCodexVersion(versionOutput),
    rawVersion: versionOutput,
  };
}

function compactWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function buildUnavailableDetail({ needsGpt56Support, versionSupported, versionLabel }) {
  if (!codexAvailability.available) {
    return "Deterministic fallback: Codex CLI is not available on PATH for the report-platform worker.";
  }

  if (needsGpt56Support && !versionSupported) {
    return `Deterministic fallback: ${configuredModelId} needs Codex CLI ${minimumGpt56CodexCliVersion} or newer, but ${versionLabel} is installed.`;
  }

  return "Deterministic fallback: LAIQ AI Engine worker is not configured.";
}

function parseCodexVersion(value) {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(String(value ?? ""));
  return match ? match[0] : null;
}

function compareSemver(left, right) {
  if (!left || !right) return -1;

  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10));
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10));

  for (let index = 0; index < 3; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) return delta > 0 ? 1 : -1;
  }

  return 0;
}

function isGpt56Model(modelId) {
  return /^gpt-5\.6(?:$|-)/i.test(String(modelId ?? ""));
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildCodexWorkerEnv() {
  return {
    ...process.env,
    REPORT_PLATFORM_CODEX_MODEL: configuredModelId,
  };
}
