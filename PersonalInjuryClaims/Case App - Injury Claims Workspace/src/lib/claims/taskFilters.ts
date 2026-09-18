// Queue filters for the Actions page.
//
// Encoded into the URL so a filtered queue is shareable, the same pattern the
// case list uses for its own scope. Unknown values decode to the empty set
// rather than throwing, because a stale link should show everything, not break.

import type { CaseAction, Priority } from "./types";

export interface TaskFilters {
  /** "Open" / "Completed". */
  status: string[];
  stage: string[];
  assignee: string[];
  priority: Priority[];
  /** Case ids, when the queue is not already scoped to one. */
  case: string[];
  /** Only actions past their SLA. */
  overdue: boolean;
  /** Only actions that block their stage from completing. */
  blocking: boolean;
}

export const EMPTY_TASK_FILTERS: TaskFilters = {
  status: [],
  stage: [],
  assignee: [],
  priority: [],
  case: [],
  overdue: false,
  blocking: false,
};

export function activeTaskFilterCount(filters: TaskFilters): number {
  return (
    filters.status.length +
    filters.stage.length +
    filters.assignee.length +
    filters.priority.length +
    filters.case.length +
    (filters.overdue ? 1 : 0) +
    (filters.blocking ? 1 : 0)
  );
}

export function isOverdue(action: CaseAction): boolean {
  return action.status === "Open" && action.elapsedMinutes >= action.slaMinutes;
}

export function matchesTaskFilters(action: CaseAction, filters: TaskFilters): boolean {
  if (filters.status.length && !filters.status.includes(action.status)) return false;
  if (filters.stage.length && !filters.stage.includes(action.stage)) return false;
  if (filters.assignee.length && !filters.assignee.includes(action.assignee)) return false;
  if (filters.priority.length && !filters.priority.includes(action.priority)) return false;
  if (filters.case.length && !filters.case.includes(action.caseId)) return false;
  if (filters.overdue && !isOverdue(action)) return false;
  if (filters.blocking && !action.blocking) return false;
  return true;
}

// ── URL encoding ────────────────────────────────────────────────────────────
// Compact on purpose: `st` status, `sg` stage, `as` assignee, `pr` priority,
// `ca` case, `od` overdue, `bl` blocking. Values are comma-joined and the whole
// thing is one `tf=` search param.

const LIST_KEYS = [
  ["st", "status"],
  ["sg", "stage"],
  ["as", "assignee"],
  ["pr", "priority"],
  ["ca", "case"],
] as const;

export function encodeTaskFilters(filters: TaskFilters): string | undefined {
  const parts: string[] = [];
  for (const [short, key] of LIST_KEYS) {
    const values = filters[key];
    if (values.length) parts.push(`${short}:${values.join(",")}`);
  }
  if (filters.overdue) parts.push("od:1");
  if (filters.blocking) parts.push("bl:1");
  return parts.length ? parts.join("|") : undefined;
}

export function decodeTaskFilters(encoded: string | undefined): TaskFilters {
  const filters: TaskFilters = { ...EMPTY_TASK_FILTERS, status: [], stage: [], assignee: [], priority: [], case: [] };
  if (!encoded) return filters;

  for (const part of encoded.split("|")) {
    const [short, raw] = part.split(":");
    if (!raw) continue;
    const values = raw.split(",").filter(Boolean);

    if (short === "od") filters.overdue = raw === "1";
    else if (short === "bl") filters.blocking = raw === "1";
    else {
      const match = LIST_KEYS.find(([s]) => s === short);
      if (!match) continue;
      if (match[1] === "priority") {
        filters.priority = values.filter((v): v is Priority =>
          v === "P1" || v === "P2" || v === "P3" || v === "P4",
        );
      } else {
        filters[match[1]] = values;
      }
    }
  }
  return filters;
}
