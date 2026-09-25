import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const DEFAULT_UPLOAD_URL_TTL_SECONDS = 15 * 60;
const DEFAULT_READ_URL_TTL_SECONDS = 5 * 60;

export class ObjectStorageError extends Error {
  constructor(statusCode, message, code = "object_storage_error") {
    super(message);
    this.name = "ObjectStorageError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function createS3ObjectStorage({
  bucket = process.env.REPORT_PLATFORM_S3_BUCKET,
  endpoint = process.env.REPORT_PLATFORM_S3_ENDPOINT,
  forcePathStyle = parseBoolean(process.env.REPORT_PLATFORM_S3_FORCE_PATH_STYLE, true),
  region = process.env.REPORT_PLATFORM_S3_REGION ?? "auto",
  accessKeyId = process.env.REPORT_PLATFORM_S3_ACCESS_KEY_ID,
  secretAccessKey = process.env.REPORT_PLATFORM_S3_SECRET_ACCESS_KEY,
  uploadUrlTtlSeconds = positiveInteger(
    process.env.REPORT_PLATFORM_S3_UPLOAD_URL_TTL_SECONDS,
    DEFAULT_UPLOAD_URL_TTL_SECONDS,
  ),
  readUrlTtlSeconds = positiveInteger(
    process.env.REPORT_PLATFORM_S3_READ_URL_TTL_SECONDS,
    DEFAULT_READ_URL_TTL_SECONDS,
  ),
  client,
} = {}) {
  const configured = Boolean(bucket);
  const s3 = configured
    ? client ?? new S3Client({
        endpoint,
        forcePathStyle,
        region,
        credentials: accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
      })
    : null;

  return {
    assertConfigured: requireConfiguration,
    deleteObjects,
    getHealth,
    getStatus,
    getObjectBuffer,
    openObjectRead,
    ping,
    putBuffer,
    putFile,
    signRead,
    signUpload,
    verifyObject,
  };

  function requireConfiguration() {
    if (!configured || !s3 || !bucket) {
      throw new ObjectStorageError(
        503,
        "S3-compatible object storage is not configured.",
        "object_storage_not_configured",
      );
    }
  }

  function getStatus() {
    return {
      provider: "s3-compatible",
      configured,
    };
  }

  async function getHealth() {
    if (!configured) return { ...getStatus(), healthy: false };
    try {
      await ping();
      return { ...getStatus(), healthy: true };
    } catch {
      return { ...getStatus(), healthy: false };
    }
  }

  async function ping() {
    requireConfiguration();
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  }

  async function signUpload(object) {
    requireConfiguration();
    const checksumBase64 = Buffer.from(object.expectedSha256, "hex").toString("base64");
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: object.objectKey,
      ContentLength: object.expectedByteSize,
      ContentType: object.mediaType,
      ChecksumSHA256: checksumBase64,
      Metadata: {
        sha256: object.expectedSha256,
        objectid: object.objectId,
      },
    });
    return {
      method: "PUT",
      uploadUrl: await getSignedUrl(s3, command, { expiresIn: uploadUrlTtlSeconds }),
      requiredHeaders: {
        "Content-Length": String(object.expectedByteSize),
        "Content-Type": object.mediaType,
        "x-amz-checksum-sha256": checksumBase64,
        "x-amz-meta-objectid": object.objectId,
        "x-amz-meta-sha256": object.expectedSha256,
      },
    };
  }

  async function signRead(objectKey) {
    requireConfiguration();
    return getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
      { expiresIn: readUrlTtlSeconds },
    );
  }

  async function putFile({ filePath, mediaType, objectId, objectKey }) {
    requireConfiguration();
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      throw new ObjectStorageError(400, "Artifact upload source is not a file.", "artifact_source_invalid");
    }
    const sha256 = await hashFile(filePath);
    const checksumBase64 = Buffer.from(sha256, "hex").toString("base64");
    await s3.send(new PutObjectCommand({
      Body: createReadStream(filePath),
      Bucket: bucket,
      ChecksumSHA256: checksumBase64,
      ContentLength: fileStats.size,
      ContentType: mediaType,
      Key: objectKey,
      Metadata: {
        objectid: objectId,
        sha256,
      },
    }));
    return { byteSize: fileStats.size, sha256 };
  }

  async function putBuffer({ bytes, mediaType, objectId, objectKey }) {
    requireConfiguration();
    const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    const sha256 = createHash("sha256").update(body).digest("hex");
    const checksumBase64 = Buffer.from(sha256, "hex").toString("base64");
    await s3.send(new PutObjectCommand({
      Body: body,
      Bucket: bucket,
      ChecksumSHA256: checksumBase64,
      ContentLength: body.length,
      ContentType: mediaType,
      Key: objectKey,
      Metadata: {
        objectid: objectId,
        sha256,
      },
    }));
    return { byteSize: body.length, sha256 };
  }

  async function getObjectBuffer({
    expectedByteSize,
    expectedSha256,
    mediaType,
    objectKey,
    maximumBytes = 110 * 1024 * 1024,
  }) {
    requireConfiguration();
    const response = await getObjectResponse(objectKey);
    const chunks = [];
    const hash = createHash("sha256");
    let byteSize = 0;
    try {
      for await (const chunk of response.Body ?? []) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        byteSize += bytes.length;
        if (byteSize > maximumBytes) {
          throw new ObjectStorageError(413, "Stored artifact exceeds the read limit.", "artifact_read_too_large");
        }
        chunks.push(bytes);
        hash.update(bytes);
      }
    } finally {
      response.Body?.destroy?.();
    }
    const sha256 = hash.digest("hex");
    assertStoredObjectMatches({
      actualByteSize: byteSize,
      actualMediaType: response.ContentType,
      actualSha256: sha256,
      expectedByteSize,
      expectedMediaType: mediaType,
      expectedSha256,
      identity: "Stored artifact",
    });
    return Buffer.concat(chunks);
  }

  async function openObjectRead({ objectKey, range }) {
    requireConfiguration();
    const response = await getObjectResponse(objectKey, { range });
    return {
      acceptRanges: response.AcceptRanges ?? "bytes",
      body: response.Body,
      contentLength: Number(response.ContentLength ?? 0),
      contentRange: response.ContentRange ?? null,
      contentType: response.ContentType ?? "application/octet-stream",
      etag: response.ETag ?? null,
      lastModified: response.LastModified ?? null,
    };
  }

  async function verifyObject(object) {
    requireConfiguration();
    const response = await getObjectResponse(object.objectKey, {
      missingCode: "object_not_uploaded",
      missingMessage: `Attachment ${object.attachmentId} has not been uploaded.`,
      missingStatus: 409,
    });

    const hash = createHash("sha256");
    let byteSize = 0;
    try {
      for await (const chunk of response.Body ?? []) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        byteSize += bytes.length;
        hash.update(bytes);
      }
    } finally {
      response.Body?.destroy?.();
    }
    const sha256 = hash.digest("hex");
    assertStoredObjectMatches({
      actualByteSize: byteSize,
      actualMediaType: response.ContentType,
      actualSha256: sha256,
      expectedByteSize: object.expectedByteSize,
      expectedMediaType: object.mediaType,
      expectedSha256: object.expectedSha256,
      identity: `Attachment ${object.attachmentId}`,
      mismatchPrefix: "object",
    });
    return { byteSize, sha256 };
  }

  async function getObjectResponse(objectKey, {
    missingCode = "artifact_not_found",
    missingMessage = "Stored artifact was not found.",
    missingStatus = 404,
    range,
  } = {}) {
    try {
      return await s3.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey, Range: range }));
    } catch (error) {
      if (isMissingObject(error)) {
        throw new ObjectStorageError(missingStatus, missingMessage, missingCode);
      }
      throw error;
    }
  }

  async function deleteObjects(objectKeys) {
    requireConfiguration();
    const uniqueKeys = [...new Set(objectKeys.filter(Boolean))];
    for (let index = 0; index < uniqueKeys.length; index += 1000) {
      const batch = uniqueKeys.slice(index, index + 1000);
      await s3.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch.map((Key) => ({ Key })),
          Quiet: true,
        },
      }));
    }
  }
}

function assertStoredObjectMatches({
  actualByteSize,
  actualMediaType,
  actualSha256,
  expectedByteSize,
  expectedMediaType,
  expectedSha256,
  identity,
  mismatchPrefix = "artifact",
}) {
  if (expectedByteSize != null && actualByteSize !== expectedByteSize) {
    throw new ObjectStorageError(409, `${identity} size does not match PostgreSQL metadata.`, `${mismatchPrefix}_size_mismatch`);
  }
  if (expectedSha256 && actualSha256 !== expectedSha256) {
    throw new ObjectStorageError(409, `${identity} checksum does not match PostgreSQL metadata.`, `${mismatchPrefix}_checksum_mismatch`);
  }
  if (expectedMediaType && normalizeMediaType(actualMediaType) !== normalizeMediaType(expectedMediaType)) {
    throw new ObjectStorageError(409, `${identity} media type does not match PostgreSQL metadata.`, `${mismatchPrefix}_media_type_mismatch`);
  }
}

async function hashFile(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function normalizeMediaType(value) {
  return String(value ?? "").split(";", 1)[0].trim().toLowerCase();
}

function isMissingObject(error) {
  return error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404;
}

function parseBoolean(value, fallback) {
  if (value == null || value === "") return fallback;
  return String(value).trim().toLowerCase() === "true";
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
