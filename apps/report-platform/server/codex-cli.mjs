import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const configuredModelId = process.env.REPORT_PLATFORM_CODEX_MODEL?.trim() || null;
const codexAvailability = detectCodexAvailability();

export function getAiStatus() {
  const available = codexAvailability.available;

  return {
    mode: available ? "live_codex_cli" : "deterministic_fallback",
    provider: available ? "codex_cli" : "deterministic",
    modelId: available ? configuredModelId : null,
    configured: available,
    statusLabel: available
      ? `Codex CLI worker${configuredModelId ? ` (${configuredModelId})` : ""}`
      : "Deterministic fallback (Codex CLI unavailable)",
    detail: available
      ? "Section generation and section chat will attempt `codex exec` first and fall back only if the CLI run fails."
      : "The backend could not find a working `codex` executable on PATH, so deterministic fallback mode is active.",
    checkedAtIso: new Date().toISOString(),
  };
}

export async function runStructuredCodexJob({
  prompt,
  schema,
}) {
  const status = getAiStatus();
  if (!status.configured) {
    throw new Error("Codex CLI is not available on PATH for the report-platform worker.");
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
      env: process.env,
      stdio: ["pipe", "ignore", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 32000) {
        stderr = stderr.slice(-32000);
      }
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `Codex CLI worker failed with exit code ${code}.${stderr ? ` stderr: ${compactWhitespace(stderr)}` : ""}`,
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

  return {
    available: result.status === 0,
  };
}

function compactWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}
