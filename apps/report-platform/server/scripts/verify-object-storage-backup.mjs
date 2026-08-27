import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const backupRoot = resolve(process.argv[2] ?? "");
if (!process.argv[2]) {
  throw new Error("Object-storage backup directory is required.");
}

const manifest = JSON.parse(await readFile(join(backupRoot, "manifest.json"), "utf8"));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.objects)) {
  throw new Error("Unsupported object-storage backup manifest.");
}
if (manifest.objectCount !== manifest.objects.length) {
  throw new Error("Object-storage backup count does not match its manifest.");
}

for (const object of manifest.objects) {
  if (!/^[a-f0-9]{64}\.bin$/.test(object.fileName)) {
    throw new Error(`Unsafe object backup filename: ${object.fileName}`);
  }
  const filePath = join(backupRoot, "objects", object.fileName);
  const file = await stat(filePath);
  if (!file.isFile() || file.size !== object.byteSize) {
    throw new Error(`Object backup size mismatch: ${object.key}`);
  }
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  if (hash.digest("hex") !== object.sha256) {
    throw new Error(`Object backup checksum mismatch: ${object.key}`);
  }
}

console.log(`Verified ${manifest.objects.length} object-storage backup file(s).`);
