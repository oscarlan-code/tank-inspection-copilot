import { ApiError } from "../store.mjs";
import {
  generateSessionToken,
  hashLoginThrottleKey,
  hashPassword,
  hashSessionToken,
  normalizeUsername,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  verifyPassword,
} from "./password-auth.mjs";

const DEVELOPMENT_SESSION_COOKIE = "laiq_report_session";
const PRODUCTION_SESSION_COOKIE = "__Host-laiq_report_session";
const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SESSION_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const LOGIN_MAXIMUM_ATTEMPTS = 5;

export async function createAuthService({ reportStore }) {
  const nodeEnvironment = process.env.NODE_ENV ?? "development";
  const production = nodeEnvironment === "production";
  const sessionCookieName = production ? PRODUCTION_SESSION_COOKIE : DEVELOPMENT_SESSION_COOKIE;
  const sessionTtlMs = positiveNumber(
    process.env.REPORT_PLATFORM_SESSION_TTL_MS,
    DEFAULT_SESSION_TTL_MS,
  );
  const dummyPasswordHash = await hashPassword("invalid-password-placeholder");

  if (String(process.env.REPORT_PLATFORM_ENABLE_DEVELOPMENT_IDENTITIES ?? "false").toLowerCase() === "true") {
    await reportStore.ensureDevelopmentUsers();
  }
  return {
    authenticate,
    createPasswordSession,
    getPublicConfig,
    revokeSession,
    sessionCookieName,
  };

  async function authenticate(request) {
    const sessionToken = readSessionToken(request, sessionCookieName);
    if (!sessionToken) {
      throw unauthenticated();
    }

    const now = new Date();
    const sessionTokenHash = hashSessionToken(sessionToken);
    const session = await reportStore.getAuthSession(sessionTokenHash, now.toISOString());
    if (!session) {
      throw unauthenticated();
    }

    const principal = await reportStore.getUserPrincipal(session.user_id);
    if (!principal) {
      await reportStore.revokeAuthSession(sessionTokenHash);
      throw unauthenticated();
    }

    const lastSeenMs = Date.parse(session.last_seen_at_iso);
    if (!Number.isFinite(lastSeenMs) || now.getTime() - lastSeenMs >= SESSION_REFRESH_INTERVAL_MS) {
      await reportStore.refreshAuthSession(
        sessionTokenHash,
        new Date(now.getTime() + sessionTtlMs).toISOString(),
        now.toISOString(),
      );
    }
    return principal;
  }

  async function createPasswordSession({
    clientType = "web",
    deviceId = null,
    password,
    request,
    username,
  }) {
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername || normalizedUsername.length > 254 || String(password ?? "").length > PASSWORD_MAX_LENGTH) {
      throw invalidCredentials();
    }

    const throttleKeys = buildThrottleKeys(normalizedUsername, request);
    const now = new Date();
    const activeThrottle = await reportStore.getLoginThrottle(throttleKeys, now.toISOString());
    if (activeThrottle) {
      throw new ApiError(
        429,
        "Too many unsuccessful sign-in attempts. Wait 15 minutes and try again.",
        "login_temporarily_locked",
      );
    }

    const credential = await reportStore.getPasswordCredential(normalizedUsername);
    const passwordValid = await verifyPassword(password, credential?.password_hash ?? dummyPasswordHash);
    if (!credential || !passwordValid) {
      await reportStore.recordLoginFailure(throttleKeys, {
        lockDurationMs: LOGIN_LOCK_MS,
        maximumAttempts: LOGIN_MAXIMUM_ATTEMPTS,
        nowIso: now.toISOString(),
        windowDurationMs: LOGIN_WINDOW_MS,
      });
      throw invalidCredentials();
    }

    const principal = await reportStore.getUserPrincipal(credential.user_id);
    if (!principal) {
      throw invalidCredentials();
    }

    await reportStore.clearLoginThrottles(throttleKeys);
    const token = generateSessionToken();
    const expiresAtIso = new Date(now.getTime() + sessionTtlMs).toISOString();
    await reportStore.createAuthSession({
      clientType: clientType === "inspection_app" ? "inspection_app" : "web",
      deviceId: clientType === "inspection_app" ? normalizeDeviceId(deviceId) : null,
      expiresAtIso,
      sessionTokenHash: hashSessionToken(token),
      userId: principal.userId,
    });
    return {
      principal,
      cookie: buildSessionCookie({
        cookieName: sessionCookieName,
        secure: production,
        token,
      }),
      expiresAtIso,
      sessionToken: token,
    };
  }

  async function revokeSession(request) {
    const token = readSessionToken(request, sessionCookieName);
    if (token) {
      await reportStore.revokeAuthSession(hashSessionToken(token));
    }
    return clearSessionCookie({ cookieName: sessionCookieName, secure: production });
  }

  function getPublicConfig() {
    return {
      mode: "password",
      passwordRequirements: {
        maximumLength: PASSWORD_MAX_LENGTH,
        minimumLength: PASSWORD_MIN_LENGTH,
      },
    };
  }
}

function readSessionToken(request, cookieName) {
  const authorization = String(request.headers.authorization ?? "");
  const bearerMatch = /^Bearer\s+([A-Za-z0-9_-]{32,})$/i.exec(authorization);
  return bearerMatch?.[1] ?? readCookie(request.headers.cookie, cookieName);
}

function normalizeDeviceId(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return normalized.slice(0, 160);
}

function buildThrottleKeys(usernameNormalized, request) {
  const remoteAddress = readRemoteAddress(request);
  return [
    hashLoginThrottleKey(`username:${usernameNormalized}`),
    hashLoginThrottleKey(`address:${remoteAddress}`),
    hashLoginThrottleKey(`combined:${usernameNormalized}:${remoteAddress}`),
  ];
}

function readRemoteAddress(request) {
  const trustProxy = String(process.env.REPORT_PLATFORM_TRUST_PROXY ?? "false").toLowerCase() === "true";
  if (trustProxy) {
    const forwarded = String(request.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  return request.socket?.remoteAddress ?? "unknown";
}

function readCookie(header, name) {
  for (const pair of String(header ?? "").split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() === name) {
      return decodeURIComponent(pair.slice(separator + 1).trim());
    }
  }
  return null;
}

function buildSessionCookie({ cookieName, secure, token }) {
  const attributes = [
    `${cookieName}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

function clearSessionCookie({ cookieName, secure }) {
  const attributes = [
    `${cookieName}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

function invalidCredentials() {
  return new ApiError(401, "Username or password is incorrect.", "invalid_credentials");
}

function unauthenticated() {
  return new ApiError(401, "Sign in is required to access the report platform.", "authentication_required");
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
