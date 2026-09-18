import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { UiPath, UiPathError } from "@uipath/uipath-typescript/core";
import { buildSdkConfig, isUiPathConfigured } from "./config";

// Authentication and the SDK handle, in one provider.
//
// The SDK owns the OAuth dance (authorize → callback → token) so the app does
// not hand-roll PKCE. `AuthContext` in components/ui/shell-auth-provider.tsx is
// the shell's own contract; `ShellIdentityBridge` below feeds this provider's
// state into it, so the vendored shell login screen and user menu work unchanged.

export interface UiPathUser {
  name: string;
  firstName: string;
  initials: string;
  email?: string;
}

interface UiPathContextValue {
  /** Null while the tenant is unconfigured. Every consumer must handle that. */
  sdk: UiPath | null;
  /** True when a tenant is configured AND the user has a valid token. */
  isAuthenticated: boolean;
  isLoading: boolean;
  /** False when the env block is blank: the app runs on demo data, no login. */
  isConfigured: boolean;
  user: UiPathUser | null;
  accessToken: string | null;
  error: string | null;
  login: () => Promise<void>;
  logout: () => void;
}

const UiPathContext = createContext<UiPathContextValue | undefined>(undefined);

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** A real name has a space and no @/./_ separators. Otherwise it's a username. */
function looksLikeRealName(s: string): boolean {
  return /\s/.test(s.trim()) && !/[@._]/.test(s);
}

function prettifyUsername(raw: string): string {
  const local = raw.split("@")[0] ?? raw;
  const parts = local.split(/[._\-+]+/).filter(Boolean);
  return parts.length === 0 ? raw : parts.map(titleCase).join(" ");
}

function buildUser(token: string | undefined): UiPathUser | null {
  if (!token) return null;
  const claims = decodeJwt(token);
  if (!claims) return null;

  const str = (k: string) => (typeof claims[k] === "string" ? (claims[k] as string).trim() : "");
  const given = str("given_name");
  const family = str("family_name");
  const nameClaim = str("name");
  const preferred = str("preferred_username");
  const emailClaim = str("email");

  let fullName = "";
  if (given && family) fullName = `${given} ${family}`;
  else if (nameClaim && looksLikeRealName(nameClaim)) fullName = nameClaim;
  else if (given || family) fullName = given || family;
  else {
    const source = preferred || emailClaim || nameClaim;
    if (source) fullName = prettifyUsername(source);
  }
  if (!fullName) return null;

  const firstName = given || fullName.split(/\s+/)[0] || fullName;
  const initials =
    fullName
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || fullName.slice(0, 2).toUpperCase();

  return {
    name: fullName,
    firstName,
    initials,
    email: emailClaim || (preferred.includes("@") ? preferred : undefined),
  };
}

export function UiPathProvider({ children }: { children: ReactNode }) {
  const configured = isUiPathConfigured();
  const [sdk, setSdk] = useState<UiPath | null>(() => (configured ? new UiPath(buildSdkConfig()) : null));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);
  // The OAuth callback must be completed exactly once. StrictMode double-invokes
  // effects in dev, and a second completeOAuth() on a consumed code fails.
  const callbackHandled = useRef(false);

  useEffect(() => {
    if (!sdk) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (sdk.isInOAuthCallback() && !callbackHandled.current && !sdk.isAuthenticated()) {
          callbackHandled.current = true;
          await sdk.completeOAuth();
          // Strip ?code=…&state=… so a reload or back-nav can't retrigger it.
          window.history.replaceState(
            {},
            document.title,
            window.location.origin + window.location.pathname,
          );
        }
        if (!cancelled) setIsAuthenticated(sdk.isAuthenticated());
      } catch (err) {
        console.error("UiPath authentication failed:", err);
        if (!cancelled) {
          setError(err instanceof UiPathError ? err.message : "Authentication failed");
          setIsAuthenticated(false);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sdk]);

  const login = useCallback(async () => {
    if (!sdk) return;
    setIsLoading(true);
    setError(null);
    try {
      await sdk.initialize();
      setIsAuthenticated(sdk.isAuthenticated());
    } catch (err) {
      console.error("UiPath login failed:", err);
      setError(err instanceof UiPathError ? err.message : "Login failed");
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, [sdk]);

  const logout = useCallback(() => {
    if (!sdk) return;
    sdk.logout();
    setIsAuthenticated(false);
    setError(null);
    // A fresh instance. The old one holds a revoked token internally.
    setSdk(new UiPath(buildSdkConfig()));
  }, [sdk]);

  const accessToken = useMemo(
    () => (isAuthenticated && sdk ? (sdk.getToken() ?? null) : null),
    [isAuthenticated, sdk],
  );
  const user = useMemo(() => buildUser(accessToken ?? undefined), [accessToken]);

  const value = useMemo<UiPathContextValue>(
    () => ({
      sdk,
      isAuthenticated,
      isLoading,
      isConfigured: configured,
      user,
      accessToken,
      error,
      login,
      logout,
    }),
    [sdk, isAuthenticated, isLoading, configured, user, accessToken, error, login, logout],
  );

  return <UiPathContext.Provider value={value}>{children}</UiPathContext.Provider>;
}

export function useUiPath(): UiPathContextValue {
  const ctx = useContext(UiPathContext);
  if (!ctx) throw new Error("useUiPath must be used within a UiPathProvider");
  return ctx;
}
