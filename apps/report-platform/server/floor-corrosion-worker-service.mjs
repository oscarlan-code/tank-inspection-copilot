import { Worker } from "node:worker_threads";
import { FloorCorrosionError } from "./floor-corrosion-artifacts.mjs";

const workerUrl = new URL("./floor-corrosion-worker.mjs", import.meta.url);

export function createFloorCorrosionWorkerService({
  artifactRoot,
  localArtifacts,
  maxConcurrency = positiveInteger(process.env.REPORT_PLATFORM_MFL_MAX_CONCURRENCY, 1),
  maxQueueLength = positiveInteger(process.env.REPORT_PLATFORM_MFL_MAX_QUEUE_LENGTH, 8),
  queueWaitTimeoutMs = positiveInteger(process.env.REPORT_PLATFORM_MFL_QUEUE_WAIT_TIMEOUT_MS, 120_000),
  workerTimeoutMs = positiveInteger(process.env.REPORT_PLATFORM_MFL_WORKER_TIMEOUT_MS, 300_000),
}) {
  if (!artifactRoot || !localArtifacts) {
    throw new Error("Floor-corrosion worker service requires an artifact root and local artifact service.");
  }

  const queue = createBoundedQueue({ maxConcurrency, maxQueueLength, queueWaitTimeoutMs });
  return {
    deleteArtifactRun: localArtifacts.deleteArtifactRun,
    deleteReportArtifacts: localArtifacts.deleteReportArtifacts,
    getArtifactContentType: localArtifacts.getArtifactContentType,
    getWorkerStatus: queue.getStatus,
    hydrateInlineArtifacts: localArtifacts.hydrateInlineArtifacts,
    importLayoutPdf: (args) => queue.run(() => runWorker("importLayoutPdf", args, workerTimeoutMs)),
    importMflPdf: (args) => queue.run(() => runWorker("importMflPdf", args, workerTimeoutMs)),
    listRunArtifactFiles: localArtifacts.listRunArtifactFiles,
    readArtifact: localArtifacts.readArtifact,
    updatePlacement: localArtifacts.updatePlacement,
  };

  function runWorker(operation, args, timeoutMs) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(workerUrl, {
        workerData: {
          operation,
          artifactRoot,
          args,
        },
      });
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        worker.terminate().catch(() => {});
        reject(new FloorCorrosionError(
          504,
          "Floor-corrosion processing exceeded the worker time limit.",
          "floor_corrosion_worker_timeout",
        ));
      }, timeoutMs);

      worker.once("message", (message) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (message?.ok) {
          resolve(message.result);
          return;
        }
        const failure = message?.error ?? {};
        reject(new FloorCorrosionError(
          Number(failure.statusCode ?? 500),
          String(failure.message ?? "Floor-corrosion worker failed."),
          String(failure.code ?? "floor_corrosion_worker_failed"),
          failure.details,
        ));
      });
      worker.once("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(new FloorCorrosionError(500, error.message, "floor_corrosion_worker_failed"));
      });
      worker.once("exit", (code) => {
        if (settled || code === 0) return;
        settled = true;
        clearTimeout(timeout);
        reject(new FloorCorrosionError(
          500,
          `Floor-corrosion worker exited with code ${code}.`,
          "floor_corrosion_worker_failed",
        ));
      });
    });
  }
}

function createBoundedQueue({ maxConcurrency, maxQueueLength, queueWaitTimeoutMs }) {
  let activeCount = 0;
  const waiting = [];

  return {
    getStatus: () => ({ activeCount, waitingCount: waiting.length, maxConcurrency, maxQueueLength }),
    run(operation) {
      if (activeCount < maxConcurrency) return execute(operation);
      if (waiting.length >= maxQueueLength) {
        return Promise.reject(new FloorCorrosionError(
          503,
          "Floor-corrosion processing is at capacity. Retry after the current jobs finish.",
          "floor_corrosion_worker_queue_full",
        ));
      }

      return new Promise((resolve, reject) => {
        const entry = { operation, resolve, reject, timeout: null };
        entry.timeout = setTimeout(() => {
          const index = waiting.indexOf(entry);
          if (index >= 0) waiting.splice(index, 1);
          reject(new FloorCorrosionError(
            503,
            "Floor-corrosion processing did not start before the queue time limit.",
            "floor_corrosion_worker_queue_timeout",
          ));
        }, queueWaitTimeoutMs);
        waiting.push(entry);
      });
    },
  };

  async function execute(operation) {
    activeCount += 1;
    try {
      return await operation();
    } finally {
      activeCount -= 1;
      startNext();
    }
  }

  function startNext() {
    const entry = waiting.shift();
    if (!entry) return;
    clearTimeout(entry.timeout);
    execute(entry.operation).then(entry.resolve, entry.reject);
  }
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

