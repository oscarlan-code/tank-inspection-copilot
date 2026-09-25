import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

const outputRoot = resolve(process.argv[2] ?? "");
if (!process.argv[2]) {
  throw new Error("Object-storage backup output directory is required.");
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

await mkdir(join(outputRoot, "objects"), { recursive: true });
const records = [];
let continuationToken;
do {
  const page = await client.send(new ListObjectsV2Command({
    Bucket: bucket,
    ContinuationToken: continuationToken,
  }));
  for (const item of page.Contents ?? []) {
    const key = item.Key;
    if (!key) continue;
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const fileName = `${createHash("sha256").update(key).digest("hex")}.bin`;
    const filePath = join(outputRoot, "objects", fileName);
    const hash = createHash("sha256");
    let byteSize = 0;
    const output = createWriteStream(filePath, { flags: "wx" });
    try {
      for await (const chunk of response.Body ?? []) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        hash.update(bytes);
        byteSize += bytes.length;
        if (!output.write(bytes)) {
          await new Promise((resolveDrain) => output.once("drain", resolveDrain));
        }
      }
      output.end();
      await new Promise((resolveFinish, rejectFinish) => {
        output.once("finish", resolveFinish);
        output.once("error", rejectFinish);
      });
    } catch (error) {
      output.destroy();
      throw error;
    } finally {
      response.Body?.destroy?.();
    }
    records.push({
      byteSize,
      contentType: response.ContentType ?? "application/octet-stream",
      fileName,
      key,
      metadata: response.Metadata ?? {},
      sha256: hash.digest("hex"),
    });
  }
  continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
} while (continuationToken);

records.sort((left, right) => left.key.localeCompare(right.key));
await writeFile(
  join(outputRoot, "manifest.json"),
  `${JSON.stringify({
    bucket,
    createdAtIso: new Date().toISOString(),
    objectCount: records.length,
    objects: records,
    schemaVersion: 1,
  }, null, 2)}\n`,
  "utf8",
);
console.log(`Backed up ${records.length} object(s) from ${bucket}.`);

function requiredEnv(name) {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
