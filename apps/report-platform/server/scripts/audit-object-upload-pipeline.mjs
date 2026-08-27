import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { createObjectUploadService } from "../object-upload-service.mjs";
import { createS3ObjectStorage, ObjectStorageError } from "../object-storage.mjs";
import { createReportStore } from "../store.mjs";

const { Client } = pg;
const sourceDatabaseUrl = process.env.REPORT_PLATFORM_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!sourceDatabaseUrl) {
  throw new Error("DATABASE_URL or REPORT_PLATFORM_TEST_DATABASE_URL is required.");
}

const fixture = JSON.parse(readFileSync(
  new URL("../../src/fixtures/v3-product-export-shell-internal.json", import.meta.url),
  "utf8",
));
const testSchema = await createAuditSchema(sourceDatabaseUrl);
const reportStore = await createReportStore({ databaseUrl: testSchema.url });
const fakeStorage = createFakeObjectStorage();
const uploads = createObjectUploadService({ objectStorage: fakeStorage, reportStore });

try {
  const seed = await reportStore.ensureSeedReport({
    bootstrapKey: `object-upload-audit-seed-${Date.now()}`,
    exportPackage: fixture,
  });
  const actorUserId = seed.reportJob.createdByUserId;
  const evidence = Buffer.from("LAIQ object upload pipeline audit evidence\n", "utf8");
  const exportPackage = buildUploadPackage(fixture, evidence, "good");
  const manifest = buildManifest(exportPackage, evidence);

  const mflPackage = structuredClone(exportPackage);
  mflPackage.attachments[0].kind = "mfl_plate_scan";
  mflPackage.attachments[0].relativePath = "mfl/plate-1.1.pdf";
  await expectApiError(
    () => uploads.createUploadSession({
      actorUserId,
      exportPackage: mflPackage,
      idempotencyKey: "object-audit-mfl-boundary",
      manifest: [{
        ...manifest[0],
        mediaType: "application/pdf",
        relativePath: "mfl/plate-1.1.pdf",
      }],
    }),
    "mfl_report_side_only",
  );

  await expectApiError(
    () => uploads.createUploadSession({
      actorUserId,
      exportPackage,
      idempotencyKey: "object-audit-traversal",
      manifest: [{ ...manifest[0], relativePath: "../outside/photo.png" }],
    }),
    "attachment_path_invalid",
  );
  await expectApiError(
    () => uploads.createUploadSession({
      actorUserId,
      exportPackage,
      idempotencyKey: "object-audit-missing",
      manifest: [],
    }),
    "upload_manifest_incomplete",
  );

  const plan = await uploads.createUploadSession({
    actorUserId,
    exportPackage,
    idempotencyKey: "object-audit-good",
    manifest,
  });
  assert(plan.objects.length === 1, "Expected one signed upload object.");
  assert(!("objectKey" in plan.objects[0]), "Server object keys must not be returned to the app.");
  assert(plan.objects[0].uploadUrl.startsWith("https://signed-upload.invalid/"), "Expected a signed upload URL.");

  const retryPlan = await uploads.createUploadSession({
    actorUserId,
    exportPackage,
    idempotencyKey: "object-audit-good",
    manifest,
  });
  assert(retryPlan.uploadSessionId === plan.uploadSessionId, "Idempotent create returned another session.");
  await expectApiError(
    () => uploads.createUploadSession({
      actorUserId,
      exportPackage,
      idempotencyKey: "object-audit-good",
      manifest: [{ ...manifest[0], sha256: "a".repeat(64) }],
    }),
    "upload_idempotency_conflict",
  );
  await expectApiError(
    () => uploads.refreshUploadSession({
      actorUserId: "another-inspector",
      uploadSessionId: plan.uploadSessionId,
    }),
    "upload_session_not_found",
  );

  fakeStorage.put(plan.objects[0].objectId, evidence, plan.objects[0].mediaType);
  const finalized = await uploads.finalizeUploadSession({
    actorUserId,
    uploadSessionId: plan.uploadSessionId,
  });
  assert(finalized.status === "imported", "Upload did not finalize as imported.");
  assert(finalized.verifiedObjectCount === 1, "Verified object count is incorrect.");
  const finalizedAgain = await uploads.finalizeUploadSession({
    actorUserId,
    uploadSessionId: plan.uploadSessionId,
  });
  assert(
    finalizedAgain.reportJob.reportJobId === finalized.reportJob.reportJobId,
    "Idempotent finalization created another report.",
  );

  const state = await reportStore.loadReportJobState(finalized.reportJob.reportJobId);
  assert(state.reportJob.sourceRevision.revisionNumber === 1, "First app export was not revision 1.");
  assert(state.reportJob.sourceRevision.storageStatus === "stored", "Original app export was not stored durably.");
  assert(
    /^[a-f0-9]{64}$/.test(state.reportJob.sourceRevision.sourceSha256),
    "Original app export lacks source-object checksum provenance.",
  );
  const importedAttachment = state.exportPackage.attachments.find(
    (attachment) => attachment.attachmentId === manifest[0].attachmentId,
  );
  assert(importedAttachment.objectRef?.sha256 === manifest[0].sha256, "Imported attachment lacks verified provenance.");
  const readPlan = await uploads.getEvidenceReadUrl({
    attachmentId: manifest[0].attachmentId,
    reportJobId: finalized.reportJob.reportJobId,
  });
  assert(readPlan.readUrl.startsWith("https://signed-read.invalid/"), "Evidence read URL was not signed.");

  const revisionPackage = structuredClone(exportPackage);
  revisionPackage.voiceNotes[0].transcriptText += " Confirmed during revision audit.";
  const revisionPlan = await uploads.createUploadSession({
    actorUserId,
    exportPackage: revisionPackage,
    sourceExportPackage: revisionPackage,
    idempotencyKey: "object-audit-revision",
    manifest,
  });
  fakeStorage.put(revisionPlan.objects[0].objectId, evidence, revisionPlan.objects[0].mediaType);
  const revisionFinalized = await uploads.finalizeUploadSession({
    actorUserId,
    uploadSessionId: revisionPlan.uploadSessionId,
  });
  assert(
    revisionFinalized.reportJob.reportJobId !== finalized.reportJob.reportJobId,
    "Changed app evidence silently rebound the existing report job.",
  );
  const revisionState = await reportStore.loadReportJobState(revisionFinalized.reportJob.reportJobId);
  assert(revisionState.reportJob.sourceRevision.revisionNumber === 2, "Changed app evidence did not create revision 2.");
  const originalState = await reportStore.loadReportJobState(finalized.reportJob.reportJobId);
  assert(
    !originalState.exportPackage.voiceNotes[0].transcriptText.endsWith("Confirmed during revision audit."),
    "Creating revision 2 mutated revision 1 source evidence.",
  );

  const mismatchPackage = buildUploadPackage(fixture, evidence, "mismatch");
  const mismatchManifest = buildManifest(mismatchPackage, evidence);
  const mismatchPlan = await uploads.createUploadSession({
    actorUserId,
    exportPackage: mismatchPackage,
    idempotencyKey: "object-audit-mismatch",
    manifest: mismatchManifest,
  });
  fakeStorage.put(
    mismatchPlan.objects[0].objectId,
    Buffer.from("X".repeat(evidence.length), "utf8").subarray(0, evidence.length),
    mismatchPlan.objects[0].mediaType,
  );
  await expectApiError(
    () => uploads.finalizeUploadSession({
      actorUserId,
      uploadSessionId: mismatchPlan.uploadSessionId,
    }),
    "object_checksum_mismatch",
  );

  await auditS3Adapter(evidence);

  console.log("Object upload pipeline audit passed: manifest, ownership, idempotency, immutable revisions, signed S3 PUT, verification, import, and read access.");
} finally {
  await reportStore.close();
  await dropAuditSchema(testSchema);
}

function buildUploadPackage(source, evidence, suffix) {
  const copy = structuredClone(source);
  const inspectionId = `inspection-object-upload-audit-${suffix}-${Date.now()}`;
  copy.inspectionId = inspectionId;
  copy.inspectionReference = `LAIQ-OBJECT-${suffix.toUpperCase()}-${Date.now()}`;
  copy.task.inspectionId = inspectionId;
  copy.task.inspectionReference = copy.inspectionReference;
  const attachment = {
    ...copy.attachments[0],
    attachmentId: `object-upload-${suffix}-photo`,
    inspectionId,
    relativePath: `v3-evidence/${suffix}/photo.png`,
    fileByteSize: evidence.length,
    fileExists: true,
    mediaType: "image/png",
  };
  copy.attachments = [attachment];
  return copy;
}

function buildManifest(exportPackage, evidence) {
  const attachment = exportPackage.attachments[0];
  return [{
    attachmentId: attachment.attachmentId,
    byteSize: evidence.length,
    mediaType: attachment.mediaType,
    relativePath: attachment.relativePath,
    sha256: createHash("sha256").update(evidence).digest("hex"),
  }];
}

function createFakeObjectStorage() {
  const objects = new Map();
  return {
    assertConfigured() {},
    getStatus: () => ({ configured: true, provider: "audit-fake" }),
    put(objectId, bytes, mediaType) {
      objects.set(objectId, { bytes, mediaType });
    },
    async putBuffer({ bytes, mediaType, objectId }) {
      const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
      objects.set(objectId, { bytes: body, mediaType });
      return {
        byteSize: body.length,
        sha256: createHash("sha256").update(body).digest("hex"),
      };
    },
    async signUpload(object) {
      return {
        method: "PUT",
        requiredHeaders: { "Content-Type": object.mediaType },
        uploadUrl: `https://signed-upload.invalid/${object.objectId}`,
      };
    },
    async verifyObject(object) {
      const stored = objects.get(object.objectId);
      if (!stored) {
        throw new ObjectStorageError(409, "Object was not uploaded.", "object_not_uploaded");
      }
      const sha256 = createHash("sha256").update(stored.bytes).digest("hex");
      if (stored.bytes.length !== object.expectedByteSize) {
        throw new ObjectStorageError(409, "Object size mismatch.", "object_size_mismatch");
      }
      if (sha256 !== object.expectedSha256) {
        throw new ObjectStorageError(409, "Object checksum mismatch.", "object_checksum_mismatch");
      }
      if (stored.mediaType !== object.mediaType) {
        throw new ObjectStorageError(409, "Object media type mismatch.", "object_media_type_mismatch");
      }
      return { byteSize: stored.bytes.length, sha256 };
    },
    async signRead(objectKey) {
      return `https://signed-read.invalid/${createHash("sha256").update(objectKey).digest("hex")}`;
    },
  };
}

async function auditS3Adapter(evidence) {
  const stored = new Map();
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const { pathname } = requestUrl;
    if (request.method === "HEAD") {
      response.writeHead(200);
      response.end();
      return;
    }
    if (request.method === "PUT") {
      const chunks = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      stored.set(pathname, {
        bytes: Buffer.concat(chunks),
        mediaType: request.headers["content-type"],
      });
      response.writeHead(200, { ETag: '"audit-etag"' });
      response.end();
      return;
    }
    if (request.method === "GET" && stored.has(pathname)) {
      const object = stored.get(pathname);
      response.writeHead(200, {
        "Content-Length": String(object.bytes.length),
        "Content-Type": object.mediaType,
        ETag: '"audit-etag"',
      });
      response.end(object.bytes);
      return;
    }
    if (request.method === "POST" && requestUrl.searchParams.has("delete")) {
      const chunks = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const xml = Buffer.concat(chunks).toString("utf8");
      const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((match) => decodeXml(match[1]));
      for (const key of keys) stored.delete(`/audit-bucket/${key}`);
      response.writeHead(200, { "Content-Type": "application/xml" });
      response.end("<DeleteResult xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\"/>");
      return;
    }
    response.writeHead(404, { "Content-Type": "application/xml" });
    response.end("<Error><Code>NoSuchKey</Code></Error>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    const storage = createS3ObjectStorage({
      accessKeyId: "audit-access-key",
      bucket: "audit-bucket",
      endpoint: `http://127.0.0.1:${address.port}`,
      forcePathStyle: true,
      region: "us-east-1",
      secretAccessKey: "audit-secret-key",
    });
    await storage.ping();
    const object = {
      attachmentId: "s3-adapter-evidence",
      expectedByteSize: evidence.length,
      expectedSha256: createHash("sha256").update(evidence).digest("hex"),
      mediaType: "image/png",
      objectId: "s3-adapter-object",
      objectKey: "tenants/audit/objects/s3-adapter-object",
    };
    const plan = await storage.signUpload(object);
    const put = await fetch(plan.uploadUrl, {
      body: evidence,
      headers: plan.requiredHeaders,
      method: plan.method,
    });
    assert(put.ok, `Signed S3 PUT failed with HTTP ${put.status}.`);
    const verified = await storage.verifyObject(object);
    assert(verified.sha256 === object.expectedSha256, "S3 adapter verification returned the wrong hash.");
    assert(verified.byteSize === evidence.length, "S3 adapter verification returned the wrong size.");
    const readUrl = await storage.signRead(object.objectKey);
    assert(/X-Amz-Signature=/i.test(readUrl), "S3 evidence read URL was not signed.");

    const sourcePackage = Buffer.from('{"packageType":"v3_product_export"}');
    const persistedBuffer = await storage.putBuffer({
      bytes: sourcePackage,
      mediaType: "application/json",
      objectId: "s3-put-buffer-source",
      objectKey: "tenants/audit/exports/source.json",
    });
    const restoredBuffer = await storage.getObjectBuffer({
      expectedByteSize: persistedBuffer.byteSize,
      expectedSha256: persistedBuffer.sha256,
      mediaType: "application/json",
      objectKey: "tenants/audit/exports/source.json",
    });
    assert(restoredBuffer.equals(sourcePackage), "S3 putBuffer/getObjectBuffer changed source-package bytes.");

    const workingDirectory = mkdtempSync(join(tmpdir(), "laiq-s3-put-file-audit-"));
    try {
      const artifactPath = join(workingDirectory, "artifact.png");
      const artifactKey = "tenants/audit/reports/audit/floor-corrosion/run/objects/artifact";
      writeFileSync(artifactPath, evidence);
      const persisted = await storage.putFile({
        filePath: artifactPath,
        mediaType: "image/png",
        objectId: "s3-put-file-artifact",
        objectKey: artifactKey,
      });
      const restored = await storage.getObjectBuffer({
        expectedByteSize: persisted.byteSize,
        expectedSha256: persisted.sha256,
        mediaType: "image/png",
        objectKey: artifactKey,
      });
      assert(restored.equals(evidence), "S3 putFile/getObjectBuffer changed artifact bytes.");
      await storage.deleteObjects([artifactKey]);
      await expectApiError(
        () => storage.getObjectBuffer({
          expectedByteSize: persisted.byteSize,
          expectedSha256: persisted.sha256,
          mediaType: "image/png",
          objectKey: artifactKey,
        }),
        "artifact_not_found",
      );
    } finally {
      rmSync(workingDirectory, { recursive: true, force: true });
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function expectApiError(action, expectedCode) {
  try {
    await action();
  } catch (error) {
    if (error?.code === expectedCode) return;
    throw error;
  }
  throw new Error(`Expected ${expectedCode}.`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createAuditSchema(sourceUrl) {
  const target = new URL(sourceUrl);
  const schemaName = `laiq_object_upload_audit_${process.pid}_${Date.now()}`;
  const client = new Client({
    connectionString: sourceUrl,
    ssl: process.env.REPORT_PLATFORM_DB_SSL === "require" ? { rejectUnauthorized: true } : false,
  });
  await client.connect();
  await client.query(`CREATE SCHEMA ${schemaName}`);
  await client.end();
  target.searchParams.set("options", `-c search_path=${schemaName},public`);
  return { schemaName, sourceUrl, url: target.toString() };
}

async function dropAuditSchema({ schemaName, sourceUrl }) {
  const client = new Client({
    connectionString: sourceUrl,
    ssl: process.env.REPORT_PLATFORM_DB_SSL === "require" ? { rejectUnauthorized: true } : false,
  });
  await client.connect();
  await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
  await client.end();
}
