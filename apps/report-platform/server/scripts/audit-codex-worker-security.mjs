import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fakeCliDirectory = mkdtempSync(join(tmpdir(), "laiq-codex-security-audit-"));
const fakeCliPath = join(fakeCliDirectory, "codex");
const workerLogPath = join(fakeCliDirectory, "worker.log");

writeFileSync(
  fakeCliPath,
  `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "codex-cli 0.144.0"
  exit 0
fi
{
  printf 'cwd=%s\\n' "$PWD"
  printf 'args=%s\\n' "$*"
  env | sort
} >> "$TARGETED_EDIT_FAKE_ARGS_PATH"
output=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then
    shift
    output="$1"
  fi
  shift
done
cat >/dev/null
sleep "\${TARGETED_EDIT_FAKE_DELAY_SECONDS:-0}"
printf '%s' "$TARGETED_EDIT_FAKE_RESPONSE" > "$output"
`,
  "utf8",
);
chmodSync(fakeCliPath, 0o755);

process.env.PATH = `${fakeCliDirectory}:/usr/bin:/bin`;
process.env.REPORT_PLATFORM_CODEX_MODEL = "gpt-5.6-sol";
process.env.REPORT_PLATFORM_CODEX_MAX_CONCURRENCY = "1";
process.env.REPORT_PLATFORM_CODEX_MAX_QUEUE_LENGTH = "1";
process.env.REPORT_PLATFORM_CODEX_QUEUE_WAIT_TIMEOUT_MS = "1000";
process.env.REPORT_PLATFORM_CODEX_TEST_MODE = "1";
process.env.TARGETED_EDIT_FAKE_ARGS_PATH = workerLogPath;
process.env.TARGETED_EDIT_FAKE_DELAY_SECONDS = "0.15";
process.env.TARGETED_EDIT_FAKE_RESPONSE = JSON.stringify({ result: "safe" });
process.env.DATABASE_URL = "postgresql://must-not-reach-worker";
process.env.REPORT_PLATFORM_S3_SECRET_ACCESS_KEY = "must-not-reach-worker";

const { getAiStatus, runStructuredCodexJob } = await import("../codex-cli.mjs");
const schema = {
  type: "object",
  additionalProperties: false,
  properties: { result: { type: "string" } },
  required: ["result"],
};

const failures = [];
const first = runStructuredCodexJob({ prompt: "Return safe JSON.", schema });
const second = runStructuredCodexJob({ prompt: "Return safe JSON.", schema });
const third = runStructuredCodexJob({ prompt: "Return safe JSON.", schema });

try {
  await third;
  failures.push("A full Codex worker queue must reject excess work.");
} catch (error) {
  if (error?.code !== "codex_worker_queue_full") {
    failures.push(`Expected codex_worker_queue_full; received ${error?.code ?? "no code"}.`);
  }
}

const [firstResult, secondResult] = await Promise.all([first, second]);
if (firstResult.parsed.result !== "safe" || secondResult.parsed.result !== "safe") {
  failures.push("Queued Codex jobs did not return their structured response.");
}

const workerLog = readFileSync(workerLogPath, "utf8");
const workingDirectories = [...workerLog.matchAll(/^cwd=(.+)$/gm)].map((match) => match[1]);
if (
  workingDirectories.length !== 2 ||
  workingDirectories.some((directory) => (
    !directory.includes("report-platform-codex-") || directory.includes("tank-inspection-coplilot-app")
  ))
) {
  failures.push("Codex jobs must execute only from isolated temporary job directories.");
}
if (workerLog.includes("DATABASE_URL=") || workerLog.includes("REPORT_PLATFORM_S3_SECRET_ACCESS_KEY=")) {
  failures.push("Codex workers must not inherit database or object-storage secrets.");
}
if (!workerLog.includes("shell_environment_policy.inherit=none") || !workerLog.includes("--skip-git-repo-check")) {
  failures.push("Codex workers must disable shell environment inheritance and repository discovery.");
}

const status = getAiStatus().workerQueue;
if (status.maxConcurrency !== 1 || status.maxQueueLength !== 1 || status.activeCount !== 0 || status.queuedCount !== 0) {
  failures.push("Codex worker queue status did not return to an idle bounded state.");
}

rmSync(fakeCliDirectory, { recursive: true, force: true });

if (failures.length > 0) {
  console.error("Codex worker security audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Codex worker security audit passed.");
console.log("Checked temporary cwd isolation, secret allowlisting, shell environment isolation, and bounded FIFO capacity.");
