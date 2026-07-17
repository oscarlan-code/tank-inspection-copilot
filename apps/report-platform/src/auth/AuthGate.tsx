import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  AUTH_EXPIRED_EVENT,
  developmentLogin,
  loadAuthConfig,
  loadAuthSession,
  logout,
  type AuthConfig,
  type AuthPrincipal,
} from "../lib/authClient";

type AuthContextValue = {
  principal: AuthPrincipal;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthGate.");
  }
  return context;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [principal, setPrincipal] = useState<AuthPrincipal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadAuthConfig(), loadAuthSession()])
      .then(([nextConfig, nextPrincipal]) => {
        if (cancelled) return;
        setConfig(nextConfig);
        setPrincipal(nextPrincipal);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to initialize sign-in.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    const handleExpired = () => setPrincipal(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    };
  }, []);

  const handleDevelopmentLogin = async (userId: string) => {
    setBusyUserId(userId);
    setError(null);
    try {
      setPrincipal(await developmentLogin(userId));
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in.");
    } finally {
      setBusyUserId(null);
    }
  };

  const signOut = async () => {
    await logout();
    setPrincipal(null);
  };

  if (isLoading) {
    return <AuthLoadingState />;
  }

  if (!principal) {
    return (
      <LoginScreen
        busyUserId={busyUserId}
        config={config}
        error={error}
        onDevelopmentLogin={handleDevelopmentLogin}
      />
    );
  }

  return (
    <AuthContext.Provider value={{ principal, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

function AuthLoadingState() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <img alt="LAIQ" className="auth-logo" src="/laiq-logo.png" />
        <p className="eyebrow">LAIQ Report Platform</p>
        <h1>Checking your workspace access</h1>
        <div className="auth-loading-line"><span /></div>
      </section>
    </main>
  );
}

function LoginScreen({
  busyUserId,
  config,
  error,
  onDevelopmentLogin,
}: {
  busyUserId: string | null;
  config: AuthConfig | null;
  error: string | null;
  onDevelopmentLogin: (userId: string) => Promise<void>;
}) {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand">
          <img alt="LAIQ" className="auth-logo" src="/laiq-logo.png" />
          <div>
            <p className="eyebrow">LAIQ Report Platform</p>
            <h1>Sign in to your report workspace</h1>
          </div>
        </div>
        <p className="auth-intro">
          Your account controls which tenant, workspace, inspection packages, reports, and knowledge sources you can access.
        </p>
        {error ? <p className="auth-error">{error}</p> : null}

        {config?.mode === "development" ? (
          <div className="auth-development-panel">
            <div className="auth-mode-note">
              <strong>Internal development sign-in</strong>
              <span>These controlled identities are disabled in production.</span>
            </div>
            <div className="auth-user-list">
              {config.developmentUsers.map((user) => {
                const membership = user.workspaceMemberships.find(
                  (candidate) => candidate.workspaceId === user.primaryWorkspaceId,
                ) ?? user.workspaceMemberships[0];
                const roles = [...new Set([...user.platformRoles, ...(membership?.roles ?? [])])];
                return (
                  <button
                    className="auth-user-button"
                    disabled={busyUserId != null}
                    key={user.userId}
                    onClick={() => void onDevelopmentLogin(user.userId)}
                    type="button"
                  >
                    <span>
                      <strong>{user.displayName}</strong>
                      <small>{user.tenantName} · {membership?.workspaceName ?? "No workspace"}</small>
                    </span>
                    <em>{busyUserId === user.userId ? "Signing in..." : roles.join(", ")}</em>
                  </button>
                );
              })}
            </div>
          </div>
        ) : config?.oidcLoginUrl ? (
          <a className="auth-sso-button" href={config.oidcLoginUrl}>Continue with company SSO</a>
        ) : (
          <p className="auth-error">Company SSO is not configured for this deployment.</p>
        )}
      </section>
    </main>
  );
}
