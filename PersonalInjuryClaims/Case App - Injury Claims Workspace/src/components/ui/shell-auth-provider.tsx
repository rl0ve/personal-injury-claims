import { createContext, useContext } from "react";

// The shell's auth contract.
//
// Trimmed from the Vertex original on purpose: this app authenticates through
// the UiPath TypeScript SDK (src/services/uipath/UiPathProvider.tsx), which owns
// the OAuth dance and the API client together, so the shell's own PKCE
// implementation and its `ShellAuthProvider` were removed rather than left as a
// second, unused auth path.
//
// Nothing provides this context, so `useAuth()` returns `noAuthDefaults` and
// `ApolloShell` renders its children directly instead of a login screen — the
// app opens straight onto the work queue on demo data. Signing in to UiPath is
// an explicit action from the queue's banner, not a gate on the whole app.
//
// To put the shell's login screen back in front of the app, provide an
// `AuthContext` value from a component that wraps `useUiPath()`.

export interface AuthContextValue {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => void;
  accessToken: string | null;
}

export interface UserInfo {
  name: string;
  email: string;
  sub: string;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const noAuthDefaults: AuthContextValue = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: async () => {},
  logout: () => {},
  accessToken: null,
};

export const useAuth = (): AuthContextValue => {
  return useContext(AuthContext) ?? noAuthDefaults;
};
