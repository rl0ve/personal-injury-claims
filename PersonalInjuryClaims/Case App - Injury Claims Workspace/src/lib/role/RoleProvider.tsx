import { createContext, useCallback, useEffect, useState, type ReactNode } from "react";

// The personas the app can sign in as. Five are switchable sign-in identities,
// each accountable for a slice of the case plan; two more are named cast who
// own work on a case without being a sign-in identity themselves.
//
// The cast is settled: no second officer, no duplicated assessor. Add a
// persona only when the case plan grows an owner that none of these covers.
export type Role = "handler" | "manager" | "adjuster" | "siu" | "subrogation";

export interface RoleProfile {
  role: Role;
  name: string;
  email: string;
  title: string;
  initials: string;
  /** The stage owner label this persona maps to in the case plan and the SDD. */
  ownerGroup: string;
  /** Stages this persona is accountable for. Scopes their queue. */
  stages: string[];
  /**
   * Case detail defaults to the work-focused layout for field-facing personas
   * (SDD §3 "Case Detail, field view").
   */
  prefersFieldView?: boolean;
}

export const ROLE_PROFILES: Record<Role, RoleProfile> = {
  handler: {
    role: "handler",
    name: "Dana Ferris",
    email: "dana.ferris@aldergatepi.com",
    title: "Claims Officer",
    initials: "DF",
    ownerGroup: "Aldergate Claims Operations",
    stages: ["Claim Intake & Registration", "Injury Triage & Track Assignment", "Medical Evidence & Quantum Decision", "Complaint & Ombudsman Referral"],
  },
  manager: {
    role: "manager",
    name: "Priya Nakamura",
    email: "priya.nakamura@aldergatepi.com",
    title: "Claims Manager",
    initials: "PN",
    ownerGroup: "Aldergate Claims Operations",
    stages: ["Quantum Assessment & Settlement Negotiation", "Settlement & Closure", "Escalation & Authority Referral"],
  },
  adjuster: {
    role: "adjuster",
    name: "Marcus Ibe",
    email: "marcus.ibe@aldergatepi.com",
    title: "Injury Assessor",
    initials: "MI",
    ownerGroup: "Injury Assessment",
    stages: ["Liability Assessment & Admission", "Condition Deterioration & Re-assessment", "Rehabilitation & Return-to-Work"],
    prefersFieldView: true,
  },
  siu: {
    role: "siu",
    name: "Renata Cole",
    email: "renata.cole@aldergatepi.com",
    title: "SIU Investigator",
    initials: "RC",
    ownerGroup: "Special Investigations Unit",
    stages: ["Litigation Management"],
  },
  subrogation: {
    role: "subrogation",
    name: "Bethany Okwuosa",
    email: "bethany.okwuosa@aldergatepi.com",
    title: "Recovery Specialist",
    initials: "BO",
    ownerGroup: "Recovery & Subrogation",
    stages: ["Subrogation & Recovery"],
    prefersFieldView: true,
  },
};

/** Everyone who can own a case or appear in the trail, including non-sign-in names. */
export const CAST = [
  ...Object.values(ROLE_PROFILES).map((p) => ({ name: p.name, title: p.title })),
  { name: "Tom Beckerman", title: "Claims Administrator" },
];

const STORAGE_KEY = "injury-claims-app-role";

interface RoleContextValue {
  role: Role;
  profile: RoleProfile;
  setRole: (role: Role) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const RoleContext = createContext<RoleContextValue | null>(null);

function readInitialRole(): Role {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in ROLE_PROFILES) return stored as Role;
  } catch {
    /* ignore */
  }
  return "handler"; // Dana Ferris is the persona the demo opens on.
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(readInitialRole);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, role);
    } catch {
      /* ignore */
    }
  }, [role]);

  const setRole = useCallback((next: Role) => setRoleState(next), []);

  return (
    <RoleContext.Provider value={{ role, profile: ROLE_PROFILES[role], setRole }}>
      {children}
    </RoleContext.Provider>
  );
}
