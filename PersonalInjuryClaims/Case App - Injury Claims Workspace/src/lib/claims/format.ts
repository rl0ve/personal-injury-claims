// Display formatting shared across pages.

const CURRENCY = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export function money(value: number): string {
  return CURRENCY.format(value);
}

const CURRENCY_EXACT = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Money with pence. The queue and the KPI tiles round, because a claim value is a
 * rough size there. A decision that splits £16,272.50 between two payers does
 * not: the rounded halves would not add up to the rounded total.
 */
export function moneyExact(value: number): string {
  return CURRENCY_EXACT.format(value);
}

export function percent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const DATE_ONLY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function dateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : DATE_TIME.format(d);
}

export function dateOnly(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : DATE_ONLY.format(d);
}

export function timeOnly(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
}

/** "12 min ago", "3 hr ago", "2 d ago", relative to a fixed `now` for stability. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mins = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || name.slice(0, 2).toUpperCase()
  );
}

/**
 * Decision outcome codes are PascalCase on the wire (SDD §2 taskOutcome values)
 * but need to read as prose in the UI. Falls back to spacing the camel case.
 */
const OUTCOME_LABELS: Record<string, string> = {
  PartialPlusGoodwill: "Partial settlement plus goodwill",
  ExceptionPending: "Exception pending",
  EvidenceRequested: "Evidence requested",
  BothReady: "Both tracks ready",
  ApprovedException: "Approved exception",
  ReturnToCoverage: "Returned to liability review",
  ReturnToTechnical: "Returned to medical review",
  AlternatePart: "Alternative treatment plan",
  CommercialLegal: "Litigation handoff",
  RouteReady: "Treatment route ready",
  EngineeringNeeded: "Independent medical examination needed",
  ReturnForDiagnosis: "Returned for medical assessment",
  ControlledEscalation: "Controlled escalation",
  EscalatedNoResponse: "Escalated, no response",
  InvestigationOpened: "SIU investigation opened",
  MonitoringPlan: "Monitoring plan",
  NoAction: "No action",
  DenialRecorded: "Denial recorded",
  WithdrawalRecorded: "Withdrawal recorded",
  HandoffAccepted: "Handoff accepted",
  CoverageReassessment: "Reopen for liability",
  TechnicalReassessment: "Reopen for medical",
  ClosureReassessment: "Reopen for closure",
  OutOfEnvelope: "Out of envelope",
};

export function outcomeLabel(outcome: string): string {
  return OUTCOME_LABELS[outcome] ?? outcome.replace(/([a-z])([A-Z])/g, "$1 $2");
}

/**
 * A case id short enough to sit in a queue card.
 *
 * Demo ids are already short, so `CLAIM-5170` passes through untouched. Live
 * ones are the case process name with a run number welded on, e.g.
 * `InjuryClaimsResolution-16331444`, which is three times the width of
 * the column it has to live in.
 *
 * The elision is in the middle, not the end, because the run number is the only
 * part that identifies anything: every case on the screen shares the prefix, and
 * truncating to `InjuryClaimsResol…` would leave rows that cannot be told apart.
 * Callers should keep the full id in a `title` so hovering still gives it whole.
 */
export function shortCaseId(id: string, max = 16): string {
  if (id.length <= max) return id;

  const cut = id.lastIndexOf("-");
  const tail = cut > 0 ? id.slice(cut) : "";
  // Only worth preserving if the tail leaves room for a recognisable head.
  if (tail.length && tail.length <= max - 3) {
    return `${id.slice(0, max - tail.length - 1)}…${tail}`;
  }
  return `${id.slice(0, max - 1)}…`;
}
