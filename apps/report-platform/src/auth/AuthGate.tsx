import {
  createContext,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AUTH_EXPIRED_EVENT,
  loadAuthConfig,
  loadAuthSession,
  logout,
  passwordLogin,
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
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);

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
  }, [bootstrapAttempt]);

  useEffect(() => {
    if (!error || config || isLoading) return;
    const retryWhenAvailable = () => retryBootstrap();
    const retryTimer = window.setTimeout(retryWhenAvailable, 2_000);
    window.addEventListener("online", retryWhenAvailable);
    window.addEventListener("focus", retryWhenAvailable);
    return () => {
      window.clearTimeout(retryTimer);
      window.removeEventListener("online", retryWhenAvailable);
      window.removeEventListener("focus", retryWhenAvailable);
    };
  }, [config, error, isLoading]);

  const retryBootstrap = () => {
    setError(null);
    setIsLoading(true);
    setBootstrapAttempt((attempt) => attempt + 1);
  };

  const handlePasswordLogin = async (username: string, password: string) => {
    setIsSigningIn(true);
    setError(null);
    try {
      setPrincipal(await passwordLogin(username, password));
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in.");
    } finally {
      setIsSigningIn(false);
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
    if (!config && error) {
      return <AuthUnavailableScreen error={error} onRetry={retryBootstrap} />;
    }
    return (
      <LoginScreen
        config={config}
        error={error}
        isSigningIn={isSigningIn}
        onPasswordLogin={handlePasswordLogin}
      />
    );
  }

  return (
    <AuthContext.Provider value={{ principal, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

function AuthUnavailableScreen({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand">
          <img alt="LAIQ" className="auth-logo" src="/laiq-logo.png" />
          <div>
            <p className="eyebrow">LAIQ Report Platform</p>
            <h1>Report service is unavailable</h1>
          </div>
        </div>
        <p className="auth-intro">
          Your workspace could not be checked. No report data has been changed.
        </p>
        <p className="auth-error">{error}</p>
        <button className="auth-retry-button" onClick={onRetry} type="button">
          Retry workspace access
        </button>
      </section>
    </main>
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
  config,
  error,
  isSigningIn,
  onPasswordLogin,
}: {
  config: AuthConfig | null;
  error: string | null;
  isSigningIn: boolean;
  onPasswordLogin: (username: string, password: string) => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const passwordMinimumLength = config?.passwordRequirements.minimumLength ?? 12;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!username.trim() || !password || isSigningIn) return;
    void onPasswordLogin(username, password);
  };

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

        <form className="auth-password-form" onSubmit={submit}>
          <label>
            <span>Username</span>
            <input
              autoCapitalize="none"
              autoComplete="username"
              autoFocus
              disabled={isSigningIn}
              maxLength={254}
              onChange={(event) => setUsername(event.target.value)}
              spellCheck={false}
              type="text"
              value={username}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              disabled={isSigningIn}
              maxLength={config?.passwordRequirements.maximumLength ?? 128}
              minLength={passwordMinimumLength}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          <button
            className="auth-sign-in-button"
            disabled={isSigningIn || !username.trim() || password.length < passwordMinimumLength}
            type="submit"
          >
            {isSigningIn ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
