import { useEffect, useState, type FormEvent } from "react";
import {
  createManagedAccount,
  deleteManagedAccount,
  loadManagedAccounts,
  loadManagedTenants,
  resetManagedAccountPassword,
  setManagedAccountStatus,
  type ManagedAccount,
  type ManagedTenant,
} from "../lib/accountAdminApi";

const ROLES = ["Inspector", "Manager", "Reviewer", "Client Viewer", "Super Admin"];

export function AccountManagement({
  currentUserId,
  onClose,
}: {
  currentUserId: string;
  onClose: () => void;
}) {
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [tenants, setTenants] = useState<ManagedTenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [roleLabel, setRoleLabel] = useState("Inspector");
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedTenant = tenants.find((tenant) => tenant.tenantId === tenantId);

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextAccounts, nextTenants] = await Promise.all([
        loadManagedAccounts(),
        loadManagedTenants(),
      ]);
      setAccounts(nextAccounts);
      setTenants(nextTenants);
      const nextTenantId = tenantId || nextTenants[0]?.tenantId || "";
      const nextTenant = nextTenants.find((tenant) => tenant.tenantId === nextTenantId);
      setTenantId(nextTenantId);
      setWorkspaceId((current) => current || nextTenant?.workspaces[0]?.workspaceId || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load account management.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const submitAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const account = await createManagedAccount({
        username,
        password,
        displayName,
        tenantId,
        workspaceId,
        roleLabel,
      });
      setAccounts((current) => [...current, account].sort((left, right) => left.displayName.localeCompare(right.displayName)));
      setUsername("");
      setDisplayName("");
      setPassword("");
      setShowCreatePassword(false);
      setMessage(`Created ${account.displayName}. They can use the same username and password in the inspection app and report platform.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create account.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (account: ManagedAccount) => {
    setError(null);
    setMessage(null);
    try {
      const updated = await setManagedAccountStatus(
        account.userId,
        account.accountStatus === "active" ? "disabled" : "active",
      );
      setAccounts((current) => current.map((candidate) => candidate.userId === updated.userId ? updated : candidate));
      setMessage(`${updated.displayName} is now ${updated.accountStatus}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update account.");
    }
  };

  const submitPasswordReset = async (event: FormEvent<HTMLFormElement>, account: ManagedAccount) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await resetManagedAccountPassword(account.userId, resetPassword);
      setResetPassword("");
      setResetTarget(null);
      setShowResetPassword(false);
      setMessage(`Password reset for ${account.displayName}. Existing sessions were signed out.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to reset password.");
    }
  };

  const submitAccountDeletion = async (event: FormEvent<HTMLFormElement>, account: ManagedAccount) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsDeleting(true);
    try {
      const result = await deleteManagedAccount(account.userId, deleteConfirmation);
      setAccounts((current) => current.filter((candidate) => candidate.userId !== account.userId));
      setDeleteTarget(null);
      setDeleteConfirmation("");
      const artifactNote = result.artifactCleanupWarnings.length > 0
        ? ` ${result.artifactCleanupWarnings.length} artifact folder(s) require operations cleanup.`
        : "";
      setMessage(
        `Permanently deleted ${account.displayName}, ${result.deletedReportJobIds.length} report job(s), and ${result.deletedImportCount} import package(s).${artifactNote}`,
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to permanently delete account data.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main className="account-management-shell">
      <header className="account-management-header">
        <div className="brand-lockup">
          <img alt="LAIQ logo" className="brand-logo" src="/laiq-logo.png" />
          <div>
            <p className="eyebrow">Super Admin</p>
            <h1>Account Management</h1>
          </div>
        </div>
        <button className="toolbar-button" onClick={onClose} type="button">Back to reports</button>
      </header>

      {error ? <p className="admin-feedback admin-feedback-error">{error}</p> : null}
      {message ? <p className="admin-feedback">{message}</p> : null}

      <div className="account-management-grid">
        <section className="admin-create-panel">
          <p className="eyebrow">New Account</p>
          <h2>Create an inspector account</h2>
          <p>The account controls both inspection-app uploads and report-platform access.</p>
          <p className="admin-password-note">Existing passwords cannot be recovered. Show/Hide only reveals the temporary password currently being entered.</p>
          <form className="admin-account-form" onSubmit={submitAccount}>
            <label>
              <span>Display name</span>
              <input autoComplete="name" onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
            </label>
            <label>
              <span>Username</span>
              <input autoCapitalize="none" autoComplete="username" onChange={(event) => setUsername(event.target.value)} required value={username} />
            </label>
            <label>
              <span>Temporary password</span>
              <div className="admin-password-field">
                <input autoComplete="new-password" minLength={12} onChange={(event) => setPassword(event.target.value)} required type={showCreatePassword ? "text" : "password"} value={password} />
                <button className="admin-password-toggle" onClick={() => setShowCreatePassword((visible) => !visible)} type="button">
                  {showCreatePassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <label>
              <span>Tenant</span>
              <select
                onChange={(event) => {
                  const nextTenantId = event.target.value;
                  const nextTenant = tenants.find((tenant) => tenant.tenantId === nextTenantId);
                  setTenantId(nextTenantId);
                  setWorkspaceId(nextTenant?.workspaces[0]?.workspaceId ?? "");
                }}
                required
                value={tenantId}
              >
                {tenants.map((tenant) => <option key={tenant.tenantId} value={tenant.tenantId}>{tenant.tenantName}</option>)}
              </select>
            </label>
            <label>
              <span>Workspace</span>
              <select onChange={(event) => setWorkspaceId(event.target.value)} required value={workspaceId}>
                {(selectedTenant?.workspaces ?? []).map((workspace) => (
                  <option key={workspace.workspaceId} value={workspace.workspaceId}>{workspace.workspaceName}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Role</span>
              <select onChange={(event) => setRoleLabel(event.target.value)} value={roleLabel}>
                {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>
            <button className="toolbar-button toolbar-button-primary" disabled={isSaving || !workspaceId} type="submit">
              {isSaving ? "Creating..." : "Create account"}
            </button>
          </form>
        </section>

        <section className="admin-account-list">
          <div className="admin-list-header">
            <div>
              <p className="eyebrow">Current Access</p>
              <h2>{accounts.length} accounts</h2>
            </div>
            <button className="toolbar-button" disabled={isLoading} onClick={() => void refresh()} type="button">Refresh</button>
          </div>
          {isLoading ? <p>Loading accounts...</p> : null}
          {!isLoading && accounts.length === 0 ? <p>No accounts have been created.</p> : null}
          <div className="admin-account-rows">
            {accounts.map((account) => (
              <article className="admin-account-row" key={account.userId}>
                <div className="admin-account-identity">
                  <strong>{account.displayName}</strong>
                  <span>{account.username ?? "No password login"}</span>
                </div>
                <div>
                  <strong>{account.roleLabel}</strong>
                  <span>{account.tenantName} · {account.workspaceName}</span>
                </div>
                <span className={`admin-status admin-status-${account.accountStatus}`}>{account.accountStatus}</span>
                <div className="admin-account-actions">
                  <button
                    className="toolbar-button"
                    disabled={!account.username}
                    onClick={() => {
                      setDeleteTarget(null);
                      setDeleteConfirmation("");
                      setResetPassword("");
                      setShowResetPassword(false);
                      setResetTarget(account.userId);
                    }}
                    title={account.username ? "Reset password" : "Assign a username before enabling password login"}
                    type="button"
                  >
                    Reset password
                  </button>
                  <button className="toolbar-button" onClick={() => void toggleStatus(account)} type="button">
                    {account.accountStatus === "active" ? "Disable" : "Activate"}
                  </button>
                  <button
                    className="toolbar-button toolbar-button-danger"
                    disabled={account.userId === currentUserId}
                    onClick={() => {
                      setResetTarget(null);
                      setResetPassword("");
                      setDeleteConfirmation("");
                      setDeleteTarget(account.userId);
                    }}
                    title={account.userId === currentUserId ? "You cannot delete your own Super Admin account" : "Permanently delete account and owned report data"}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
                {account.username && resetTarget === account.userId ? (
                  <form className="admin-reset-form" onSubmit={(event) => void submitPasswordReset(event, account)}>
                    <div className="admin-password-field">
                      <input
                        autoComplete="new-password"
                        autoFocus
                        minLength={12}
                        onChange={(event) => setResetPassword(event.target.value)}
                        placeholder="New password (12+ characters)"
                        required
                        type={showResetPassword ? "text" : "password"}
                        value={resetPassword}
                      />
                      <button className="admin-password-toggle" onClick={() => setShowResetPassword((visible) => !visible)} type="button">
                        {showResetPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                    <button className="toolbar-button toolbar-button-primary" type="submit">Save password</button>
                    <button className="toolbar-button" onClick={() => {
                      setResetTarget(null);
                      setResetPassword("");
                      setShowResetPassword(false);
                    }} type="button">Cancel</button>
                  </form>
                ) : null}
                {deleteTarget === account.userId ? (
                  <form className="admin-delete-form" onSubmit={(event) => void submitAccountDeletion(event, account)}>
                    <strong>Permanent deletion cannot be undone.</strong>
                    <span>
                      This removes the account, sessions, credentials, imports, generated reports, drafts, approvals, evals, and local report artifacts. Type <b>{account.username ?? account.userId}</b> to confirm.
                    </span>
                    <input
                      autoComplete="off"
                      autoFocus
                      onChange={(event) => setDeleteConfirmation(event.target.value)}
                      placeholder={account.username ?? account.userId}
                      required
                      value={deleteConfirmation}
                    />
                    <div className="admin-delete-actions">
                      <button
                        className="toolbar-button toolbar-button-danger"
                        disabled={isDeleting || deleteConfirmation !== (account.username ?? account.userId)}
                        type="submit"
                      >
                        {isDeleting ? "Deleting..." : "Delete account and data"}
                      </button>
                      <button className="toolbar-button" disabled={isDeleting} onClick={() => {
                        setDeleteTarget(null);
                        setDeleteConfirmation("");
                      }} type="button">Cancel</button>
                    </div>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
