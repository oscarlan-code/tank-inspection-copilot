export type WorkspaceMembership = {
  workspaceId: string;
  workspaceName: string;
  roles: string[];
};

export type AuthPrincipal = {
  userId: string;
  displayName: string;
  tenantId: string;
  tenantName: string;
  primaryWorkspaceId: string;
  platformRoles: string[];
  workspaceMemberships: WorkspaceMembership[];
  identityProvider?: string | null;
};

export type AuthConfig = {
  mode: "password";
  passwordRequirements: {
    maximumLength: number;
    minimumLength: number;
  };
};

export const AUTH_EXPIRED_EVENT = "laiq-report-auth-expired";
const AUTH_REQUEST_TIMEOUT_MS = 8_000;

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
  });
  if (response.status === 401) {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
  return response;
}

export async function loadAuthConfig(): Promise<AuthConfig> {
  const response = await authFetch(
    "/api/v1/auth/config",
    { credentials: "include" },
    "Unable to load authentication configuration.",
  );
  await assertOk(response, "Unable to load authentication configuration.");
  return response.json() as Promise<AuthConfig>;
}

export async function loadAuthSession(): Promise<AuthPrincipal | null> {
  const response = await authFetch(
    "/api/v1/auth/session",
    { credentials: "include" },
    "Unable to load authentication session.",
  );
  await assertOk(response, "Unable to load authentication session.");
  const payload = await response.json() as { principal: AuthPrincipal | null };
  return payload.principal;
}

export async function passwordLogin(
  username: string,
  password: string,
): Promise<AuthPrincipal> {
  const response = await authFetch(
    "/api/v1/auth/login",
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, username }),
    },
    "Unable to sign in.",
  );
  await assertOk(response, "Unable to sign in.");
  const payload = await response.json() as { principal: AuthPrincipal };
  return payload.principal;
}

export async function logout(): Promise<void> {
  const response = await authFetch(
    "/api/v1/auth/logout",
    {
      method: "POST",
      credentials: "include",
    },
    "Unable to sign out.",
  );
  await assertOk(response, "Unable to sign out.");
}

async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit,
  fallback: string,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${fallback} The report service did not respond within 8 seconds.`);
    }
    throw new Error(`${fallback} Check that the API and PostgreSQL service are available.`);
  } finally {
    window.clearTimeout(timeout);
  }
}

async function assertOk(response: Response, fallback: string) {
  if (response.ok) return;
  const body = await response.text();
  let message = body;
  try {
    const parsed = JSON.parse(body) as { error?: string };
    message = parsed.error ?? body;
  } catch {
    // Keep a non-JSON server response as diagnostic text.
  }
  throw new Error(`${message || fallback} (HTTP ${response.status})`);
}
