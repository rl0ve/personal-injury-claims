import { useContext } from "react";
import { RoleContext } from "./RoleProvider";

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within a RoleProvider");
  return ctx;
}
