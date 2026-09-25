import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const HASH_VERSION = "scrypt-v1";
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = Object.freeze({
  N: 2 ** 15,
  r: 8,
  p: 3,
  maxmem: 160 * 1024 * 1024,
});

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export function normalizeUsername(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function validateUsername(value) {
  const normalized = normalizeUsername(value);
  if (!normalized || normalized.length > 254) {
    throw new Error("Username must contain between 1 and 254 characters.");
  }
  return normalized;
}

export function validatePassword(value) {
  const password = String(value ?? "");
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw new Error(
      `Password must contain between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`,
    );
  }
  return password;
}

export async function hashPassword(value) {
  const password = validatePassword(value);
  const salt = randomBytes(16);
  const derivedKey = await deriveKey(password, salt, SCRYPT_OPTIONS);
  return [
    HASH_VERSION,
    `N=${SCRYPT_OPTIONS.N},r=${SCRYPT_OPTIONS.r},p=${SCRYPT_OPTIONS.p}`,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(value, encodedHash) {
  const parsed = parsePasswordHash(encodedHash);
  if (!parsed) return false;

  const password = String(value ?? "");
  if (password.length === 0 || password.length > PASSWORD_MAX_LENGTH) return false;
  const actual = await deriveKey(password, parsed.salt, parsed.options);
  return actual.length === parsed.expected.length && timingSafeEqual(actual, parsed.expected);
}

export function generateSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token) {
  return createHash("sha256").update(String(token ?? "")).digest("hex");
}

export function hashLoginThrottleKey(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function parsePasswordHash(value) {
  const [version, parameters, saltValue, hashValue] = String(value ?? "").split("$");
  if (version !== HASH_VERSION || !parameters || !saltValue || !hashValue) return null;

  const parameterMap = Object.fromEntries(
    parameters.split(",").map((entry) => {
      const [key, rawValue] = entry.split("=");
      return [key, Number(rawValue)];
    }),
  );
  const options = {
    N: parameterMap.N,
    r: parameterMap.r,
    p: parameterMap.p,
    maxmem: 160 * 1024 * 1024,
  };
  if (
    !Number.isInteger(options.N) ||
    !Number.isInteger(options.r) ||
    !Number.isInteger(options.p) ||
    options.N < 2 ** 14 ||
    options.r < 8 ||
    options.p < 1
  ) {
    return null;
  }

  try {
    return {
      expected: Buffer.from(hashValue, "base64url"),
      options,
      salt: Buffer.from(saltValue, "base64url"),
    };
  } catch {
    return null;
  }
}

async function deriveKey(password, salt, options) {
  return scrypt(password, salt, KEY_LENGTH, options);
}
