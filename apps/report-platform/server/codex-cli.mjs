import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const defaultModelId = "gpt-5.6-sol";
const minimumGpt56CodexCliVersion = "0.144.0";
const configuredModelId = process.env.REPORT_PLATFORM_CODEX_MODEL?.trim() || defaultModelId;
const codexTimeoutMs = parsePositiveInteger(process.env.REPORT_PLATFORM_CODEX_TIMEOUT_MS, 120000);
const codexMaxConcurrency = parsePositiveInteger(process.env.REPORT_PLATFORM_CODEX_MAX_CONCURRENCY, 2);
const codexMaxQueueLength = parsePositiveInteger(process.env.REPORT_PLATFORM_CODEX_MAX_QUEUE_LENGTH, 50);
const codexQueueWaitTimeoutMs = parsePositiveInteger(
  process.env.REPORT_PLATFORM_CODEX_QUEUE_WAIT_TIMEOUT_MS,
  120000,
);
const targetedEditTimeoutMs = parsePositiveInteger(
  process.env.REPORT_PLATFORM_TARGETED_EDIT_TIMEOUT_MS,
  Math.min(codexTimeoutMs, 60000),
);
const codexQueue = createBoundedQueue({
  maxConcurrency: codexMaxConcurrency,
  maxQueueLength: codexMaxQueueLength,
  waitTimeoutMs: codexQueueWaitTimeoutMs,
});
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
    workerQueue: codexQueue.getStatus(),
    checkedAtIso: new Date().toISOString(),
  };
}

export async function runStructuredCodexJob({
  prompt,
  schema,
  reasoningEffort,
  timeoutMs = codexTimeoutMs,
}) {
  const status = getAiStatus();
  if (!status.configured) {
    throw new Error(status.detail);
  }

  return codexQueue.run(async () => {
    const workingDir = await mkdtemp(join(tmpdir(), "report-platform-codex-"));
    const schemaPath = join(workingDir, "schema.json");
    const outputPath = join(workingDir, "output.json");

    await writeFile(schemaPath, JSON.stringify(schema, null, 2), "utf8");

    try {
      await runCodexExec({
        outputPath,
        prompt,
        reasoningEffort,
        schemaPath,
        timeoutMs,
        workingDir,
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
  });
}

function runCodexExec({
  outputPath,
  prompt,
  reasoningEffort,
  schemaPath,
  timeoutMs,
  workingDir,
}) {
  return new Promise((resolve, reject) => {
    const args = ["-a", "never"];
    if (configuredModelId) {
      args.push("-m", configuredModelId);
    }
    if (reasoningEffort) {
      args.push("-c", `model_reasoning_effort=${JSON.stringify(reasoningEffort)}`);
    }
    args.push("-c", "shell_environment_policy.inherit=none");
    args.push(
      "exec",
      "--sandbox",
      "read-only",
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "--skip-git-repo-check",
      "--cd",
      workingDir,
      "--output-schema",
      schemaPath,
      "-o",
      outputPath,
      "-",
    );

    const child = spawn("codex", args, {
      cwd: workingDir,
      env: buildCodexWorkerEnv(),
      stdio: ["pipe", "ignore", "pipe"],
    });

    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      const forceKill = setTimeout(() => child.kill("SIGKILL"), 2000);
      forceKill.unref();
      reject(new Error(`LAIQ AI Engine worker timed out after ${timeoutMs}ms using ${configuredModelId}.`));
    }, timeoutMs);

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

export function getTargetedEditWorkerOptions() {
  return {
    reasoningEffort: "low",
    timeoutMs: targetedEditTimeoutMs,
  };
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
  const allowedKeys = [
    "CODEX_CI",
    "CODEX_HOME",
    "HOME",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "LOGNAME",
    "PATH",
    "SHELL",
    "TERM",
    "TMPDIR",
    "USER",
  ];
  const workerEnv = {};
  for (const key of allowedKeys) {
    if (process.env[key]) workerEnv[key] = process.env[key];
  }

  if (process.env.REPORT_PLATFORM_CODEX_TEST_MODE === "1") {
    for (const key of [
      "TARGETED_EDIT_FAKE_ARGS_PATH",
      "TARGETED_EDIT_FAKE_DELAY_SECONDS",
      "TARGETED_EDIT_FAKE_RESPONSE",
    ]) {
      if (process.env[key]) workerEnv[key] = process.env[key];
    }
  }

  return workerEnv;
}

function createBoundedQueue({ maxConcurrency, maxQueueLength, waitTimeoutMs }) {
  let activeCount = 0;
  const waiting = [];

  function drain() {
    while (activeCount < maxConcurrency && waiting.length > 0) {
      const entry = waiting.shift();
      clearTimeout(entry.waitTimer);
      activeCount += 1;
      Promise.resolve()
        .then(entry.task)
        .then(entry.resolve, entry.reject)
        .finally(() => {
          activeCount -= 1;
          drain();
        });
    }
  }

  function run(task) {
    if (activeCount >= maxConcurrency && waiting.length >= maxQueueLength) {
      const error = new Error("LAIQ AI Engine is at capacity. Retry after the queued report work completes.");
      error.code = "codex_worker_queue_full";
      return Promise.reject(error);
    }

    return new Promise((resolve, reject) => {
      const entry = { task, resolve, reject, waitTimer: null };
      entry.waitTimer = setTimeout(() => {
        const index = waiting.indexOf(entry);
        if (index < 0) return;
        waiting.splice(index, 1);
        const error = new Error("LAIQ AI Engine queue wait timed out. Retry this action.");
        error.code = "codex_worker_queue_timeout";
        reject(error);
      }, waitTimeoutMs);
      entry.waitTimer.unref?.();
      waiting.push(entry);
      drain();
    });
  }

  return {
    getStatus() {
      return {
        activeCount,
        maxConcurrency,
        maxQueueLength,
        queuedCount: waiting.length,
        waitTimeoutMs,
      };
    },
    run,
  };
}
