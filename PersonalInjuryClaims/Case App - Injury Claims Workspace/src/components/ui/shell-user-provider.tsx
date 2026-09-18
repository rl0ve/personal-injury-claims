import { createContext, type FC, type PropsWithChildren, useContext } from "react";
import { useRole } from "@/lib/role/useRole";

export interface User {
  id: string;
  name: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface UserContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export const useUser = () => {
  const context = useContext(UserContext);
  if (context == null) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

export const UserContext = createContext<UserContextValue | null>(null);

// Identity is driven by the app's role switcher (no UiPath auth in this build).
export const ShellUserProvider: FC<PropsWithChildren> = ({ children }) => {
  const { profile } = useRole();
  const [first, ...rest] = profile.name.split(" ");
  const user: User = {
    id: profile.role,
    name: profile.name,
    email: profile.email,
    first_name: first ?? profile.name,
    last_name: rest.join(" "),
  };

  return (
    <UserContext.Provider value={{ user, isAuthenticated: true, isLoading: false }}>
      {children}
    </UserContext.Provider>
  );
};
