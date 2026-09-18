// SLA math and formatting.
//
// Thresholds follow the SDD's rule of thumb: an SLA of three days or less warns
// at 75% of its budget, a longer one at 70%. Anything past 100% is breached.
// Every clock in the app derives its state from here so a pill in the list can
// never disagree with the countdown in the console.

import type { SlaStatus } from "./types";

const THREE_DAYS_MINUTES = 3 * 24 * 60;

/** At-risk threshold as a fraction of the budget, per SDD §1. */
export function atRiskThreshold(slaMinutes: number): number {
  return slaMinutes <= THREE_DAYS_MINUTES ? 0.75 : 0.7;
}

export function slaStatusFor(elapsedMinutes: number, slaMinutes: number): SlaStatus {
  if (slaMinutes <= 0) return "Not triggered";
  if (elapsedMinutes >= slaMinutes) return "Breached";
  if (elapsedMinutes / slaMinutes >= atRiskThreshold(slaMinutes)) return "At risk";
  return "On track";
}

export function remainingMinutes(elapsedMinutes: number, slaMinutes: number): number {
  return slaMinutes - elapsedMinutes;
}

/** "3 hr 12 min", "1 d 4 hr", "45 min": the compact form used in headers. */
export function formatDuration(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  if (abs < 60) return `${abs} min`;
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  if (hours < 24) return mins ? `${hours} hr ${mins} min` : `${hours} hr`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days} d ${restHours} hr` : `${days} d`;
}

/** "3 HR 12 MIN ELAPSED", the storyboard's console header form. */
export function formatElapsed(minutes: number): string {
  return `${formatDuration(minutes).toUpperCase()} ELAPSED`;
}

/** "2 hr 48 min left" / "1 hr 5 min overdue". */
export function formatRemaining(elapsedMinutes: number, slaMinutes: number): string {
  const left = remainingMinutes(elapsedMinutes, slaMinutes);
  return left >= 0 ? `${formatDuration(left)} left` : `${formatDuration(left)} overdue`;
}

/** SLA budget as it reads in a header: "SLA 4 HR". */
export function formatSlaBudget(slaMinutes: number | null): string {
  if (slaMinutes == null) return "No clock";
  return `SLA ${formatDuration(slaMinutes).toUpperCase()}`;
}

export const SLA_TONE: Record<SlaStatus, "success" | "warning" | "error" | null> = {
  "On track": "success",
  "At risk": "warning",
  Breached: "error",
  Met: "success",
  Paused: null,
  "Not triggered": null,
};

/** Most-urgent-first ordering, used everywhere a list of SLAs is shown. */
const SLA_RANK: Record<SlaStatus, number> = {
  Breached: 0,
  "At risk": 1,
  "On track": 2,
  Paused: 3,
  "Not triggered": 4,
  Met: 5,
};

export function bySlaSeverity(a: SlaStatus, b: SlaStatus): number {
  return SLA_RANK[a] - SLA_RANK[b];
}

export function worstSla(statuses: SlaStatus[]): SlaStatus {
  if (statuses.length === 0) return "On track";
  return statuses.reduce((a, b) => (SLA_RANK[b] < SLA_RANK[a] ? b : a));
}
