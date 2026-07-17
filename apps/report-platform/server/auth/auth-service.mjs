import { randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ApiError } from "../store.mjs";

const SESSION_COOKIE = "laiq_report_session";
const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export function createAuthService({ reportStore }) {
  const nodeEnvironment = process.env.NODE_ENV ?? "development";
  const mode = process.env.REPORT_PLATFORM_AUTH_MODE
    ?? (nodeEnvironment === "production" ? "oidc" : "development");
  const sessionTtlMs = positiveNumber(
    process.env.REPORT_PLATFORM_SESSION_TTL_MS,
    DEFAULT_SESSION_TTL_MS,
  );
  const oidc = readOidcConfiguration(mode);
  const sessions = new Map();

  if (nodeEnvironment === "production" && mode === "development") {
    throw new Error("REPORT_PLATFORM_AUTH_MODE=development is not allowed when NODE_ENV=production.");
  }
  if (mode === "development") {
    reportStore.ensureDevelopmentUsers();
  }

  return {
    authenticate,
    createDevelopmentSession,
    getPublicConfig,
    revokeSession,
    sessionCookieName: SESSION_COOKIE,
  };

  async function authenticate(request) {
    const sessionToken = readCookie(request.headers.cookie, SESSION_COOKIE);
    if (sessionToken) {
      const session = sessions.get(sessionToken);
      if (session && session.expiresAt > Date.now()) {
        const principal = reportStore.getUserPrincipal(session.userId);
        if (principal) {
          session.expiresAt = Date.now() + sessionTtlMs;
          return principal;
        }
      }
      sessions.delete(sessionToken);
    }

    const bearerToken = readBearerToken(request.headers.authorization);
    if (bearerToken && mode === "oidc") {
      return authenticateOidcToken(bearerToken, oidc, reportStore);
    }

    throw new ApiError(401, "Sign in is required to access the report platform.", "authentication_required");
  }

  function createDevelopmentSession(userId) {
    if (mode !== "development") {
      throw new ApiError(404, "Development sign-in is not available.", "development_login_disabled");
    }

    const principal = reportStore.getUserPrincipal(String(userId ?? ""));
    if (!principal) {
      throw new ApiError(400, "Selected development user was not found.", "development_user_not_found");
    }

    const token = randomBytes(32).toString("base64url");
    sessions.set(token, {
      userId: principal.userId,
      expiresAt: Date.now() + sessionTtlMs,
    });

    return {
      principal,
      cookie: buildSessionCookie(token, sessionTtlMs, nodeEnvironment === "production"),
    };
  }

  function revokeSession(request) {
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    if (token) {
      sessions.delete(token);
    }
    return clearSessionCookie(nodeEnvironment === "production");
  }

  function getPublicConfig() {
    return {
      mode,
      developmentUsers: mode === "development" ? reportStore.listDevelopmentUsers() : [],
      oidcLoginUrl: mode === "oidc" ? process.env.REPORT_PLATFORM_OIDC_LOGIN_URL ?? null : null,
    };
  }
}

async function authenticateOidcToken(token, oidc, reportStore) {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, oidc.jwks, {
      issuer: oidc.issuer,
      audience: oidc.audience,
    }));
  } catch {
    throw new ApiError(401, "Identity token is invalid or expired.", "invalid_identity_token");
  }
  const subject = String(payload.sub ?? "");
  if (!subject) {
    throw new ApiError(401, "Identity token did not contain a subject.", "invalid_identity_token");
  }

  const principal = reportStore.getUserPrincipalBySubject(oidc.providerCode, subject);
  if (!principal) {
    throw new ApiError(
      403,
      "Your identity is valid but has not been provisioned for the report platform.",
      "platform_account_not_provisioned",
    );
  }
  return principal;
}

function readOidcConfiguration(mode) {
  if (mode !== "oidc") {
    return null;
  }

  const issuer = process.env.REPORT_PLATFORM_OIDC_ISSUER;
  const audience = process.env.REPORT_PLATFORM_OIDC_AUDIENCE;
  const jwksUri = process.env.REPORT_PLATFORM_OIDC_JWKS_URI;
  if (!issuer || !audience || !jwksUri) {
    throw new Error(
      "OIDC mode requires REPORT_PLATFORM_OIDC_ISSUER, REPORT_PLATFORM_OIDC_AUDIENCE, and REPORT_PLATFORM_OIDC_JWKS_URI.",
    );
  }

  return {
    issuer,
    audience,
    providerCode: process.env.REPORT_PLATFORM_OIDC_PROVIDER_CODE ?? "oidc",
    jwks: createRemoteJWKSet(new URL(jwksUri)),
  };
}

function readBearerToken(header) {
  const match = /^Bearer\s+(.+)$/i.exec(String(header ?? ""));
  return match?.[1] ?? null;
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

function buildSessionCookie(token, ttlMs, secure) {
  const attributes = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(ttlMs / 1000)}`,
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

function clearSessionCookie(secure) {
  const attributes = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
