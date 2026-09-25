interface BrowserCryptoSource {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
}

export function createBrowserId(
  prefix: string,
  cryptoSource: BrowserCryptoSource | null | undefined = globalThis.crypto,
): string {
  const uuid = typeof cryptoSource?.randomUUID === "function"
    ? cryptoSource.randomUUID()
    : createPortableUuid(cryptoSource);

  return prefix ? `${prefix}-${uuid}` : uuid;
}

function createPortableUuid(cryptoSource: BrowserCryptoSource | null | undefined): string {
  const bytes = new Uint8Array(16);

  if (typeof cryptoSource?.getRandomValues === "function") {
    cryptoSource.getRandomValues(bytes);
  } else {
    // These values correlate UI events only; authentication tokens are server-generated.
    const timeSeed = Date.now();
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256) ^ ((timeSeed >>> ((index % 6) * 8)) & 0xff);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}
