import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

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
  return JSON.parse(stdout);
}
