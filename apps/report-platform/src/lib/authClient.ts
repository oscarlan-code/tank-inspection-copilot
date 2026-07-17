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
  mode: "development" | "oidc";
  developmentUsers: AuthPrincipal[];
  oidcLoginUrl: string | null;
};

export const AUTH_EXPIRED_EVENT = "laiq-report-auth-expired";

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
  const response = await fetch("/api/v1/auth/config", { credentials: "include" });
  await assertOk(response, "Unable to load authentication configuration.");
  return response.json() as Promise<AuthConfig>;
}

export async function loadAuthSession(): Promise<AuthPrincipal | null> {
  const response = await fetch("/api/v1/auth/session", { credentials: "include" });
  await assertOk(response, "Unable to load authentication session.");
  const payload = await response.json() as { principal: AuthPrincipal | null };
  return payload.principal;
}

export async function developmentLogin(userId: string): Promise<AuthPrincipal> {
  const response = await fetch("/api/v1/auth/development-login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  await assertOk(response, "Unable to sign in with the development identity.");
  const payload = await response.json() as { principal: AuthPrincipal };
  return payload.principal;
}

export async function logout(): Promise<void> {
  const response = await fetch("/api/v1/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  await assertOk(response, "Unable to sign out.");
}

async function assertOk(response: Response, fallback: string) {
  if (response.ok) return;
  const body = await response.text();
  throw new Error(body || `${fallback} HTTP ${response.status}`);
}
