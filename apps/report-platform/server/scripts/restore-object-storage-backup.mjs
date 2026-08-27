import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const backupRoot = resolve(process.argv[2] ?? "");
if (!process.argv[2]) {
  throw new Error("Object-storage backup directory is required.");
}

const manifest = JSON.parse(await readFile(join(backupRoot, "manifest.json"), "utf8"));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.objects)) {
  throw new Error("Unsupported object-storage backup manifest.");
}

const bucket = requiredEnv("REPORT_PLATFORM_S3_BUCKET");
const client = new S3Client({
  endpoint: process.env.REPORT_PLATFORM_S3_ENDPOINT,
  forcePathStyle: String(process.env.REPORT_PLATFORM_S3_FORCE_PATH_STYLE ?? "true") === "true",
  region: process.env.REPORT_PLATFORM_S3_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: requiredEnv("REPORT_PLATFORM_S3_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("REPORT_PLATFORM_S3_SECRET_ACCESS_KEY"),
  },
});

for (const object of manifest.objects) {
  if (!/^[a-f0-9]{64}\.bin$/.test(object.fileName)) {
    throw new Error(`Unsafe object backup filename: ${object.fileName}`);
  }
  await client.send(new PutObjectCommand({
    Body: createReadStream(join(backupRoot, "objects", object.fileName)),
    Bucket: bucket,
    ContentLength: object.byteSize,
    ContentType: object.contentType,
    Key: object.key,
    Metadata: object.metadata ?? {},
  }));
}

console.log(`Restored ${manifest.objects.length} object(s) to ${bucket}.`);

function requiredEnv(name) {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
