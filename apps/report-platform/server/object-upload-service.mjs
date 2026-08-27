import { createHash, randomUUID } from "node:crypto";
import { ApiError, validateAndroidV3ProductExport } from "./store.mjs";

const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_OBJECTS = 250;
const DEFAULT_MAX_OBJECT_BYTES = 250 * 1024 * 1024;
const DEFAULT_MAX_EXPORT_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_VERIFY_CONCURRENCY = 4;

export function createObjectUploadService({
  objectStorage,
  reportStore,
  now = () => new Date(),
  sessionTtlMs = positiveInteger(
    process.env.REPORT_PLATFORM_UPLOAD_SESSION_TTL_MS,
    DEFAULT_SESSION_TTL_MS,
  ),
  maxObjects = positiveInteger(
    process.env.REPORT_PLATFORM_UPLOAD_MAX_OBJECTS,
    DEFAULT_MAX_OBJECTS,
  ),
  maxObjectBytes = positiveInteger(
    process.env.REPORT_PLATFORM_UPLOAD_MAX_OBJECT_BYTES,
    DEFAULT_MAX_OBJECT_BYTES,
  ),
  maxExportBytes = positiveInteger(
    process.env.REPORT_PLATFORM_UPLOAD_MAX_EXPORT_BYTES,
    DEFAULT_MAX_EXPORT_BYTES,
  ),
}) {
  if (!objectStorage || !reportStore) {
    throw new Error("Object upload service requires objectStorage and reportStore.");
  }

  return {
    createUploadSession,
    finalizeUploadSession,
    getEvidenceReadUrl,
    importPackage,
    refreshUploadSession,
  };

  async function createUploadSession({
    actorUserId,
    exportPackage,
    sourceExportPackage = exportPackage,
    idempotencyKey,
    manifest,
  }) {
    assertAppUploadAttachmentBoundary(exportPackage);
    const normalizedKey = validateIdempotencyKey(idempotencyKey);
    const normalizedObjects = validateAndNormalizeManifest(exportPackage, manifest, {
      maxExportBytes,
      maxObjectBytes,
      maxObjects,
    });
    validateExportPackage(exportPackage);
    if (normalizedObjects.length > 0) objectStorage.assertConfigured();

    const requestSha256 = sha256(stableStringify({
      exportPackage: removeVolatileExportMetadata(exportPackage),
      manifest: normalizedObjects,
    }));
    const objectRecords = normalizedObjects.map((object) => {
      const objectId = randomUUID();
      return {
        ...object,
        objectId,
        objectKey: buildObjectKey({ exportPackage, objectId }),
      };
    });
    const session = await reportStore.createObjectUploadSession({
      actorUserId,
      exportPackage,
      sourceExportPackage,
      expiresAtIso: new Date(now().getTime() + sessionTtlMs).toISOString(),
      idempotencyKey: normalizedKey,
      objects: objectRecords,
      requestSha256,
    });
    assertStoredManifestMatches(session.objects, normalizedObjects);
    return buildUploadPlan(session);
  }

  async function refreshUploadSession({ actorUserId, uploadSessionId }) {
    const session = await reportStore.getObjectUploadSession({ actorUserId, uploadSessionId });
    assertSessionUsable(session);
    return buildUploadPlan(session);
  }

  async function finalizeUploadSession({ actorUserId, uploadSessionId }) {
    let session = await reportStore.getObjectUploadSession({ actorUserId, uploadSessionId });
    if (session.statusCode === "imported" && session.finalizedReportJobId) {
      const state = await reportStore.loadReportJobState(session.finalizedReportJobId);
      if (!state) {
        throw new ApiError(409, "The finalized report import could not be loaded.", "finalized_report_missing");
      }
      return buildFinalizedResult(state, session);
    }
    assertSessionUsable(session);

    const pendingObjects = session.objects.filter((object) => object.statusCode !== "verified");
    await mapWithConcurrency(pendingObjects, MAX_VERIFY_CONCURRENCY, async (object) => {
      const verified = await objectStorage.verifyObject(object);
      await reportStore.markObjectUploadVerified({
        actorUserId,
        byteSize: verified.byteSize,
        objectId: object.objectId,
        sha256: verified.sha256,
        uploadSessionId,
      });
    });

    session = await reportStore.getObjectUploadSession({ actorUserId, uploadSessionId });
    const exportPackage = attachVerifiedObjectReferences(session.exportPackage, session);
    const state = await importPackage({
      actorUserId,
      exportPackage,
      sourceExportPackage: session.sourceExportPackage,
    });
    session = await reportStore.completeObjectUploadSession({
      actorUserId,
      reportJobId: state.reportJob.reportJobId,
      uploadSessionId,
    });
    return buildFinalizedResult(state, session);
  }

  async function importPackage({
    actorUserId,
    exportPackage,
    manualSupplementOverrides = {},
    sourceExportPackage = exportPackage,
  }) {
    assertAppUploadAttachmentBoundary(exportPackage);
    validateExportPackage(exportPackage);
    const sourcePackageRef = await persistSourcePackage({
      exportPackage,
      sourceExportPackage,
    });
    const state = await reportStore.importAndroidV2ProductExport({
      actorUserId,
      exportPackage,
      manualSupplementOverrides,
      sourcePackageRef,
    });
    const pinnedSourceKey = state.reportJob?.sourceRevision?.sourceObjectKey;
    if (sourcePackageRef && pinnedSourceKey && pinnedSourceKey !== sourcePackageRef.objectKey) {
      await objectStorage.deleteObjects([sourcePackageRef.objectKey]).catch((error) => {
        console.error("Unable to remove an unreferenced idempotent source-package object", error);
      });
    }
    return state;
  }

  async function getEvidenceReadUrl({ attachmentId, reportJobId }) {
    const object = await reportStore.getReportObjectByAttachmentId(reportJobId, attachmentId);
    if (!object) {
      throw new ApiError(404, "Uploaded report evidence was not found.", "report_evidence_not_found");
    }
    return {
      attachmentId,
      expiresInSeconds: Number(process.env.REPORT_PLATFORM_S3_READ_URL_TTL_SECONDS || 300),
      mediaType: object.mediaType,
      objectId: object.objectId,
      readUrl: await objectStorage.signRead(object.objectKey),
    };
  }

  async function buildUploadPlan(session) {
    if (session.statusCode === "imported") {
      return {
        expiresAtIso: session.expiresAtIso,
        finalizedReportJobId: session.finalizedReportJobId,
        objects: session.objects.map(publicObjectStatus),
        status: "imported",
        uploadSessionId: session.uploadSessionId,
      };
    }
    assertSessionUsable(session);
    const objects = await Promise.all(session.objects.map(async (object) => {
      if (object.statusCode === "verified") return publicObjectStatus(object);
      return {
        ...publicObjectStatus(object),
        ...await objectStorage.signUpload(object),
      };
    }));
    return {
      expiresAtIso: session.expiresAtIso,
      objects,
      status: session.statusCode,
      uploadSessionId: session.uploadSessionId,
    };
  }

  async function persistSourcePackage({ exportPackage, sourceExportPackage }) {
    if (
      objectStorage.getStatus().configured !== true
      && String(process.env.REPORT_PLATFORM_ALLOW_LEGACY_SOURCE_IMPORTS ?? "false").toLowerCase() === "true"
    ) {
      return null;
    }
    objectStorage.assertConfigured();
    const bytes = Buffer.from(stableStringify(sourceExportPackage), "utf8");
    const sourceSha256 = sha256(bytes);
    const objectKey = buildSourcePackageObjectKey(exportPackage, sourceSha256);
    const stored = await objectStorage.putBuffer({
      bytes,
      mediaType: "application/json",
      objectId: `app-export-${sourceSha256.slice(0, 24)}`,
      objectKey,
    });
    if (stored.sha256 !== sourceSha256) {
      throw new ApiError(
        409,
        "Stored app export checksum does not match the source package.",
        "source_package_checksum_mismatch",
      );
    }
    return {
      byteSize: stored.byteSize,
      mediaType: "application/json",
      objectKey,
      sha256: stored.sha256,
    };
  }

  function assertSessionUsable(session) {
    if (Date.parse(session.expiresAtIso) <= now().getTime()) {
      throw new ApiError(
        410,
        "This upload session has expired. Create a new session with a new idempotency key.",
        "upload_session_expired",
      );
    }
  }
}

export function assertAppUploadAttachmentBoundary(exportPackage) {
  const mflAttachment = (exportPackage?.attachments ?? []).find(isMflAttachment);
  if (mflAttachment) {
    throw new ApiError(
      400,
      "MFL plate-map files are uploaded from the report workspace after the app inspection package is imported.",
      "mfl_report_side_only",
    );
  }
}

function validateExportPackage(exportPackage) {
  const issues = validateAndroidV3ProductExport(exportPackage);
  if (issues.length > 0) {
    throw new ApiError(
      400,
      `LAIQ app export contract validation failed: ${issues.join(" ")}`,
      "invalid_export_package",
    );
  }
}

function validateAndNormalizeManifest(exportPackage, manifest, limits) {
  if (!Array.isArray(manifest)) {
    throw new ApiError(400, "objects[] is required.", "upload_manifest_required");
  }
  if (manifest.length > limits.maxObjects) {
    throw new ApiError(413, `An export may include at most ${limits.maxObjects} objects.`, "upload_object_limit_exceeded");
  }

  const sourceAttachments = Array.isArray(exportPackage?.attachments)
    ? exportPackage.attachments.filter((attachment) => attachment.fileExists === true)
    : [];
  const attachmentsById = new Map();
  const sourcePaths = new Set();
  for (const attachment of sourceAttachments) {
    const attachmentId = requiredText(attachment.attachmentId, "attachmentId");
    const relativePath = validateRelativePath(attachment.relativePath);
    if (attachmentsById.has(attachmentId)) {
      throw new ApiError(400, `Duplicate exported attachmentId: ${attachmentId}.`, "duplicate_attachment_id");
    }
    if (sourcePaths.has(relativePath)) {
      throw new ApiError(400, `Duplicate exported attachment path: ${relativePath}.`, "duplicate_attachment_path");
    }
    attachmentsById.set(attachmentId, { ...attachment, relativePath });
    sourcePaths.add(relativePath);
  }

  const manifestIds = new Set();
  const manifestPaths = new Set();
  let totalBytes = 0;
  const normalized = manifest.map((candidate) => {
    const attachmentId = requiredText(candidate?.attachmentId, "attachmentId");
    const source = attachmentsById.get(attachmentId);
    if (!source) {
      throw new ApiError(
        400,
        `Manifest attachment ${attachmentId} is not a fileExists=true attachment in the export package.`,
        "unexpected_upload_object",
      );
    }
    const relativePath = validateRelativePath(candidate.relativePath);
    if (relativePath !== source.relativePath) {
      throw new ApiError(400, `Manifest path does not match attachment ${attachmentId}.`, "attachment_path_mismatch");
    }
    if (manifestIds.has(attachmentId) || manifestPaths.has(relativePath)) {
      throw new ApiError(400, "Upload manifest contains duplicate attachments or paths.", "duplicate_upload_object");
    }
    manifestIds.add(attachmentId);
    manifestPaths.add(relativePath);

    const mediaType = normalizeMediaType(candidate.mediaType);
    if (!isSupportedMediaType(mediaType) || mediaType !== normalizeMediaType(source.mediaType)) {
      throw new ApiError(400, `Unsupported or mismatched media type for ${attachmentId}.`, "attachment_media_type_invalid");
    }
    const expectedByteSize = Number(candidate.byteSize);
    if (!Number.isSafeInteger(expectedByteSize) || expectedByteSize < 0) {
      throw new ApiError(400, `Invalid byte size for ${attachmentId}.`, "attachment_size_invalid");
    }
    if (expectedByteSize > limits.maxObjectBytes) {
      throw new ApiError(413, `Attachment ${attachmentId} exceeds the per-object limit.`, "upload_object_too_large");
    }
    if (source.fileByteSize != null && Number(source.fileByteSize) !== expectedByteSize) {
      throw new ApiError(400, `Manifest size does not match attachment ${attachmentId}.`, "attachment_size_mismatch");
    }
    totalBytes += expectedByteSize;
    const expectedSha256 = String(candidate.sha256 ?? "").trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
      throw new ApiError(400, `Invalid SHA-256 for ${attachmentId}.`, "attachment_sha256_invalid");
    }
    return {
      attachmentId,
      attachmentKind: requiredText(source.kind ?? "attachment", "attachment kind"),
      expectedByteSize,
      expectedSha256,
      mediaType,
      relativePath,
    };
  });

  const missingIds = [...attachmentsById.keys()].filter((attachmentId) => !manifestIds.has(attachmentId));
  if (missingIds.length > 0) {
    throw new ApiError(
      400,
      `${missingIds.length} exported attachment(s) are missing from objects[].`,
      "upload_manifest_incomplete",
    );
  }
  if (totalBytes > limits.maxExportBytes) {
    throw new ApiError(413, "The combined export evidence exceeds the upload limit.", "upload_export_too_large");
  }
  return normalized.sort((left, right) => left.attachmentId.localeCompare(right.attachmentId));
}

function assertStoredManifestMatches(storedObjects, normalizedObjects) {
  const stored = storedObjects.map((object) => ({
    attachmentId: object.attachmentId,
    attachmentKind: object.attachmentKind,
    expectedByteSize: object.expectedByteSize,
    expectedSha256: object.expectedSha256,
    mediaType: object.mediaType,
    relativePath: object.relativePath,
  })).sort((left, right) => left.attachmentId.localeCompare(right.attachmentId));
  if (stableStringify(stored) !== stableStringify(normalizedObjects)) {
    throw new ApiError(
      409,
      "This idempotency key is already assigned to a different upload manifest.",
      "upload_idempotency_conflict",
    );
  }
}

function attachVerifiedObjectReferences(exportPackage, session) {
  const objectsByAttachment = new Map(session.objects.map((object) => [object.attachmentId, object]));
  const attachments = (exportPackage.attachments ?? []).map((attachment) => {
    const object = objectsByAttachment.get(attachment.attachmentId);
    if (!object) return attachment;
    return {
      ...attachment,
      objectRef: {
        objectId: object.objectId,
        sha256: object.verifiedSha256,
        byteSize: object.verifiedByteSize,
        mediaType: object.mediaType,
      },
    };
  });
  return {
    ...exportPackage,
    attachments,
    objectStorageManifest: {
      manifestVersion: 1,
      provider: "s3-compatible",
      uploadSessionId: session.uploadSessionId,
      verifiedAtIso: new Date().toISOString(),
      objects: session.objects.map((object) => ({
        attachmentId: object.attachmentId,
        byteSize: object.verifiedByteSize,
        mediaType: object.mediaType,
        objectId: object.objectId,
        sha256: object.verifiedSha256,
      })),
    },
  };
}

function buildFinalizedResult(state, session) {
  return {
    reportJob: state.reportJob,
    status: "imported",
    uploadSessionId: session.uploadSessionId,
    verifiedObjectCount: session.objects.filter((object) => object.statusCode === "verified").length,
  };
}

function publicObjectStatus(object) {
  return {
    attachmentId: object.attachmentId,
    byteSize: object.expectedByteSize,
    mediaType: object.mediaType,
    objectId: object.objectId,
    sha256: object.expectedSha256,
    status: object.statusCode,
  };
}

function buildObjectKey({ exportPackage, objectId }) {
  return [
    "tenants",
    shortHash(exportPackage.tenantId),
    "workspaces",
    shortHash(exportPackage.workspaceId),
    "inspections",
    shortHash(exportPackage.inspectionId, 24),
    "objects",
    objectId,
  ].join("/");
}

function buildSourcePackageObjectKey(exportPackage, sourceSha256) {
  return [
    "tenants",
    shortHash(exportPackage.tenantId),
    "workspaces",
    shortHash(exportPackage.workspaceId),
    "inspections",
    shortHash(exportPackage.inspectionId, 24),
    "exports",
    `${sourceSha256}.json`,
  ].join("/");
}

function validateIdempotencyKey(value) {
  const key = String(value ?? "").trim();
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(key)) {
    throw new ApiError(
      400,
      "Idempotency-Key must be 8-200 characters using letters, numbers, dot, underscore, colon, or hyphen.",
      "idempotency_key_invalid",
    );
  }
  return key;
}

function validateRelativePath(value) {
  const path = requiredText(value, "relativePath");
  if (path.startsWith("/") || path.startsWith("\\") || path.includes("\\") || path.includes("\0")) {
    throw new ApiError(400, "Attachment paths must be normalized relative paths.", "attachment_path_invalid");
  }
  const segments = path.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new ApiError(400, "Attachment paths must not contain empty, dot, or parent segments.", "attachment_path_invalid");
  }
  return path;
}

function isSupportedMediaType(mediaType) {
  return /^(image|audio|video)\/[a-z0-9.+-]+$/.test(mediaType)
    || mediaType === "application/pdf"
    || mediaType === "application/octet-stream"
    || mediaType === "text/plain"
    || mediaType === "text/csv";
}

function isMflAttachment(attachment) {
  const identity = `${attachment?.kind ?? ""}/${attachment?.relativePath ?? ""}`;
  return /(^|[_/.-])mfl([_/.-]|$)|magnetic[_ -]?flux/i.test(identity);
}

function normalizeMediaType(value) {
  return String(value ?? "").split(";", 1)[0].trim().toLowerCase();
}

function requiredText(value, fieldName) {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new ApiError(400, `${fieldName} is required.`, "upload_manifest_invalid");
  }
  return text;
}

function shortHash(value, length = 16) {
  return sha256(String(value)).slice(0, length);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function removeVolatileExportMetadata(value) {
  if (Array.isArray(value)) return value.map(removeVolatileExportMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== "boundAtIso" && key !== "exportedAtIso" && key !== "updatedAtIso")
    .map(([key, nested]) => [key, removeVolatileExportMetadata(nested)]));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function mapWithConcurrency(values, concurrency, worker) {
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(values[index]);
    }
  }));
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
