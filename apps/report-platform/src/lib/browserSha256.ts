import { sha256 as portableSha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

export async function sha256Text(
  value: string,
  subtle: SubtleCrypto | null | undefined = globalThis.crypto?.subtle,
) {
  const payload = new TextEncoder().encode(value);
  if (subtle) {
    const digest = await subtle.digest("SHA-256", payload);
    return bytesToHex(new Uint8Array(digest));
  }

  // Internal HTTP origins are not secure browser contexts, so Web Crypto can be unavailable.
  return bytesToHex(portableSha256(payload));
}
