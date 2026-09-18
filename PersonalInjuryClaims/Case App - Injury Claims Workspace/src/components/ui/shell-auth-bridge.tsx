import type { ReactNode } from "react";
import { useMemo } from "react";
import { useUiPath } from "@/services/uipath/UiPathProvider";
import { AuthContext, type AuthContextValue } from "./shell-auth-provider";

/**
 * Hands the shell's user menu the real UiPath session.
 *
 * `shell-auth-provider` defines the contract and says plainly that nothing
 * provides it, so `useAuth()` falls back to defaults whose `logout` does
 * nothing. The user menu's Sign out item has always been there and has always
 * been inert. This is the wrapper that file's closing comment asks for.
 *
 * It deliberately does NOT gate the app behind a login screen: `ApolloShell`
 * renders a login screen only when it is given an unauthenticated context AND
 * asked to, and the queue still opens on demo data for anyone who never signs
 * in. Signing in stays an explicit action from the banner.
 */
export function ShellAuthBridge({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading, login, logout, accessToken } = useUiPath();

  const value = useMemo<AuthContextValue>(
    () => ({
      // The shell wants name/email/sub as strings; the SDK's claims give a name
      // and usually an email, and no subject we need here. Empty strings keep
      // the menu rendering rather than blanking a row on a thin token.
      user: user ? { name: user.name, email: user.email ?? "", sub: "" } : null,
      isAuthenticated,
      isLoading,
      login,
      logout,
      accessToken,
    }),
    [user, isAuthenticated, isLoading, login, logout, accessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
