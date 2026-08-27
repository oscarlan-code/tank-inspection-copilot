import { authenticatedFetch } from "./authClient";

export type ManagedWorkspace = {
  workspaceId: string;
  workspaceName: string;
};

export type ManagedTenant = {
  tenantId: string;
  tenantName: string;
  workspaces: ManagedWorkspace[];
};

export type ManagedAccount = {
  userId: string;
  username: string | null;
  displayName: string;
  tenantId: string;
  tenantName: string;
  workspaceId: string;
  workspaceName: string;
  roleLabel: string;
  accountStatus: "active" | "disabled";
  updatedAtIso: string;
};

export async function loadManagedTenants(): Promise<ManagedTenant[]> {
  const response = await authenticatedFetch("/api/v1/admin/tenants");
  await assertOk(response, "Unable to load tenants.");
  return ((await response.json()) as { tenants: ManagedTenant[] }).tenants;
}

export async function loadManagedAccounts(): Promise<ManagedAccount[]> {
  const response = await authenticatedFetch("/api/v1/admin/accounts");
  await assertOk(response, "Unable to load accounts.");
  return ((await response.json()) as { accounts: ManagedAccount[] }).accounts;
}

export async function createManagedAccount(input: {
  username: string;
  password: string;
  displayName: string;
  tenantId: string;
  workspaceId: string;
  roleLabel: string;
}): Promise<ManagedAccount> {
  const response = await authenticatedFetch("/api/v1/admin/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOk(response, "Unable to create account.");
  return ((await response.json()) as { account: ManagedAccount }).account;
}

export async function setManagedAccountStatus(
  userId: string,
  accountStatus: "active" | "disabled",
): Promise<ManagedAccount> {
  const response = await authenticatedFetch(
    `/api/v1/admin/accounts/${encodeURIComponent(userId)}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountStatus }),
    },
  );
  await assertOk(response, "Unable to update account status.");
  return ((await response.json()) as { account: ManagedAccount }).account;
}

export async function resetManagedAccountPassword(userId: string, password: string): Promise<void> {
  const response = await authenticatedFetch(
    `/api/v1/admin/accounts/${encodeURIComponent(userId)}/password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    },
  );
  await assertOk(response, "Unable to reset account password.");
}

export async function deleteManagedAccount(
  userId: string,
  confirmation: string,
): Promise<{
  deletedImportCount: number;
  deletedReportJobIds: string[];
  deletedUserId: string;
  artifactCleanupWarnings: string[];
}> {
  const response = await authenticatedFetch(
    `/api/v1/admin/accounts/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation }),
    },
  );
  await assertOk(response, "Unable to permanently delete account data.");
  return response.json();
}

async function assertOk(response: Response, fallback: string) {
  if (response.ok) return;
  const text = await response.text();
  try {
    const payload = JSON.parse(text) as { error?: string };
    throw new Error(payload.error || fallback);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(text || fallback);
    throw error;
  }
}
