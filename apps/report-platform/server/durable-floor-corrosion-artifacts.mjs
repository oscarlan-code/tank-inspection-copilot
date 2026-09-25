import { createHash, randomUUID } from "node:crypto";
import { basename } from "node:path";
import { FloorCorrosionError } from "./floor-corrosion-artifacts.mjs";

export function createDurableFloorCorrosionArtifactService({
  localArtifacts,
  objectStorage,
  reportStore,
}) {
  if (!localArtifacts || !objectStorage || !reportStore) {
    throw new Error("Durable floor-corrosion artifacts require local processing, object storage, and PostgreSQL.");
  }

  return {
    deleteArtifactRun,
    deleteReportArtifacts: localArtifacts.deleteReportArtifacts,
    getArtifactContentType: localArtifacts.getArtifactContentType,
    getWorkerStatus: localArtifacts.getWorkerStatus,
    hydrateInlineArtifacts,
    importLayoutPdf,
    importMflPdf,
    readArtifact,
    updatePlacement: localArtifacts.updatePlacement,
  };

  async function importLayoutPdf(args) {
    objectStorage.assertConfigured();
    const result = await localArtifacts.importLayoutPdf(args);
    return persistRun({
      actorUserId: args.actorUserId,
      artifactKind: "floor_layout_source",
      originalFileName: args.sourceDocumentName,
      reportJobId: args.reportJobId,
      result,
    });
  }

  async function importMflPdf(args) {
    objectStorage.assertConfigured();
    const result = await localArtifacts.importMflPdf(args);
    return persistRun({
      actorUserId: args.actorUserId,
      artifactKind: "floor_corrosion_mfl",
      originalFileName: args.sourceDocumentName,
      reportJobId: args.reportJobId,
      result,
    });
  }

  async function persistRun({
    actorUserId,
    artifactKind,
    originalFileName,
    reportJobId,
    result,
  }) {
    const artifactRunId = result.summary.artifactRunId;
    const reportScope = await reportStore.getReportScope(reportJobId);
    if (!reportScope) {
      localArtifacts.deleteArtifactRun({ reportJobId, runId: artifactRunId });
      throw new FloorCorrosionError(404, "Report job was not found.", "report_job_not_found");
    }
    const files = localArtifacts.listRunArtifactFiles({ reportJobId, runId: artifactRunId });
    const uploaded = [];
    try {
      for (const file of files) {
        const artifactObjectId = randomUUID();
        const objectKey = buildArtifactObjectKey({
          artifactObjectId,
          artifactRunId,
          reportJobId,
          tenantId: reportScope.tenantId,
          workspaceId: reportScope.workspaceId,
        });
        const stored = await objectStorage.putFile({
          filePath: file.localPath,
          mediaType: file.mediaType,
          objectId: artifactObjectId,
          objectKey,
        });
        if (stored.byteSize !== file.byteSize) {
          throw new FloorCorrosionError(
            409,
            `Artifact ${file.relativePath} changed during object upload.`,
            "floor_corrosion_artifact_changed",
          );
        }
        uploaded.push({
          artifactObjectId,
          byteSize: stored.byteSize,
          mediaType: file.mediaType,
          objectKey,
          relativePath: file.relativePath,
          sha256: stored.sha256,
        });
      }
      await reportStore.saveReportArtifactObjects({
        actorUserId,
        artifactKind,
        artifactRunId,
        artifacts: uploaded,
        originalFileName: sanitizeOriginalFileName(originalFileName),
        reportJobId,
      });
      return result;
    } catch (error) {
      if (uploaded.length > 0) {
        await objectStorage.deleteObjects(uploaded.map((artifact) => artifact.objectKey)).catch(() => {});
      }
      throw error;
    } finally {
      localArtifacts.deleteArtifactRun({ reportJobId, runId: artifactRunId });
    }
  }

  async function readArtifact({ artifactFileName, reportJobId, runId }) {
    const safeName = basename(String(artifactFileName ?? ""));
    if (!/^[a-z0-9._-]+\.(?:png|svg)$/i.test(safeName)) {
      throw new FloorCorrosionError(400, "Invalid corrosion artifact name.", "floor_corrosion_artifact_invalid");
    }
    const artifact = await reportStore.getReportArtifactObject({
      artifactFileName: safeName,
      artifactRunId: runId,
      reportJobId,
    });
    if (!artifact) {
      throw new FloorCorrosionError(404, "Corrosion artifact was not found.", "floor_corrosion_artifact_not_found");
    }
    return objectStorage.getObjectBuffer({
      expectedByteSize: artifact.byteSize,
      expectedSha256: artifact.sha256,
      mediaType: artifact.mediaType,
      objectKey: artifact.objectKey,
    });
  }

  async function hydrateInlineArtifacts(reportJobId, layoutMap) {
    const floorCorrosion = layoutMap?.floorCorrosion;
    const sourceDrawing = await hydrateSourceDrawing(reportJobId, layoutMap?.sourceDrawing);
    if (!floorCorrosion) return { ...layoutMap, sourceDrawing };
    const overlays = await Promise.all(floorCorrosion.overlays.map(async (overlay) => {
      const artifactFileName = artifactNameFromUri(overlay.artifactUri);
      const sourcePreviewFileName = artifactNameFromUri(overlay.sourcePreviewArtifactUri);
      try {
        const inlineImageDataUrl = overlay.inlineImageDataUrl ?? (artifactFileName
          ? await readArtifactDataUrl(reportJobId, floorCorrosion.artifactRunId, artifactFileName)
          : undefined);
        const sourcePreviewInlineImageDataUrl = overlay.sourcePreviewInlineImageDataUrl
          ?? (sourcePreviewFileName
            ? await readArtifactDataUrl(reportJobId, floorCorrosion.artifactRunId, sourcePreviewFileName)
            : undefined);
        return { ...overlay, inlineImageDataUrl, sourcePreviewInlineImageDataUrl };
      } catch {
        return { ...overlay, status: "blocked" };
      }
    }));
    return {
      ...layoutMap,
      sourceDrawing,
      floorCorrosion: { ...floorCorrosion, overlays },
    };
  }

  async function hydrateSourceDrawing(reportJobId, sourceDrawing) {
    if (!sourceDrawing) return sourceDrawing;
    return {
      ...sourceDrawing,
      inlineImageDataUrl: sourceDrawing.inlineImageDataUrl
        ?? await readArtifactUriDataUrl(reportJobId, sourceDrawing.artifactUri),
      ...(sourceDrawing.foregroundArtifactUri
        ? {
            foregroundInlineImageDataUrl: sourceDrawing.foregroundInlineImageDataUrl
              ?? await readArtifactUriDataUrl(reportJobId, sourceDrawing.foregroundArtifactUri),
          }
        : {}),
    };
  }

  async function readArtifactUriDataUrl(reportJobId, artifactUri) {
    const artifactFileName = artifactNameFromUri(artifactUri);
    const runId = runIdFromArtifactUri(artifactUri);
    if (!artifactFileName || !runId) return undefined;
    try {
      return await readArtifactDataUrl(reportJobId, runId, artifactFileName);
    } catch {
      return undefined;
    }
  }

  async function readArtifactDataUrl(reportJobId, runId, artifactFileName) {
    const buffer = await readArtifact({ artifactFileName, reportJobId, runId });
    return `data:${localArtifacts.getArtifactContentType(artifactFileName)};base64,${buffer.toString("base64")}`;
  }

  async function deleteArtifactRun({ reportJobId, runId }) {
    const objectKeys = await reportStore.listReportArtifactRunObjectKeys({
      artifactRunId: runId,
      reportJobId,
    });
    if (objectKeys.length > 0) await objectStorage.deleteObjects(objectKeys);
    await reportStore.deleteReportArtifactRun({ artifactRunId: runId, reportJobId });
    localArtifacts.deleteArtifactRun({ reportJobId, runId });
  }
}

function buildArtifactObjectKey({
  artifactObjectId,
  artifactRunId,
  reportJobId,
  tenantId,
  workspaceId,
}) {
  return [
    "tenants",
    shortHash(tenantId),
    "workspaces",
    shortHash(workspaceId),
    "reports",
    shortHash(reportJobId, 24),
    "floor-corrosion",
    artifactRunId,
    "objects",
    artifactObjectId,
  ].join("/");
}

function shortHash(value, length = 16) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}

function sanitizeOriginalFileName(value) {
  return basename(String(value ?? "MFL plate maps.pdf"))
    .replace(/[\r\n\0]/g, " ")
    .slice(0, 180);
}

function artifactNameFromUri(value) {
  const match = /\/floor-corrosion\/artifacts\/[a-f0-9-]+\/([^/?#]+)$/i.exec(String(value ?? ""));
  return match ? decodeURIComponent(match[1]) : null;
}

function runIdFromArtifactUri(value) {
  const match = /\/floor-corrosion\/artifacts\/([a-f0-9-]+)\/[^/?#]+$/i.exec(String(value ?? ""));
  return match?.[1] ?? null;
}
