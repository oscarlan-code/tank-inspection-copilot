import { parentPort, workerData } from "node:worker_threads";
import { createFloorCorrosionArtifactService } from "./floor-corrosion-artifacts.mjs";

if (!parentPort) {
  throw new Error("Floor-corrosion worker requires a worker-thread parent port.");
}

try {
  const service = createFloorCorrosionArtifactService({
    artifactRoot: workerData.artifactRoot,
  });
  const operation = workerData.operation;
  if (operation !== "importMflPdf" && operation !== "importLayoutPdf") {
    throw new Error(`Unsupported floor-corrosion worker operation: ${operation}`);
  }
  const result = service[operation](workerData.args);
  parentPort.postMessage({ ok: true, result });
} catch (error) {
  parentPort.postMessage({
    ok: false,
    error: {
      code: error?.code ?? "floor_corrosion_worker_failed",
      details: error?.details,
      message: error instanceof Error ? error.message : "Floor-corrosion worker failed.",
      name: error?.name ?? "Error",
      statusCode: Number(error?.statusCode ?? 500),
    },
  });
}

