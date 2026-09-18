// The case activity feed.
//
// Two sources, merged newest-first: whatever the case carries explicitly, plus a
// spine derived from its stage states so a case with no authored feed still
// reads as a history rather than an empty tab. Session events (a decision taken,
// an upload, an accepted reroute) are folded in by `useCaseActivity`.

import { ALL_STAGES, PRIMARY_STAGES } from "./casePlan";
import type { ActivityCategory, ActivityItem, CaseAction, InjuryClaim } from "./types";

export type ActivityFilterKey = "all" | "human" | "manager" | "agent" | "task";

export const ACTIVITY_FILTERS: { key: ActivityFilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "human", label: "Human" },
  { key: "manager", label: "Case manager" },
  { key: "agent", label: "Agent" },
  { key: "task", label: "Automations" },
];

/**
 * The case-manager filter reads "Rules" only when the case decides purely by
 * rule. Agent- and hybrid-driven cases keep "Case manager", because the same
 * filter spans both its deterministic and its reasoning decisions.
 */
export function activityFilterLabel(
  key: ActivityFilterKey,
  base: string,
  mode: InjuryClaim["caseManagerMode"],
): string {
  return key === "manager" && mode === "rules" ? "Rules" : base;
}

/**
 * "manager" deliberately spans `rules` and `ai`: both are the case manager
 * deciding, one by rule and one by reasoning. `agent` is reserved for a
 * task-executing agent, which is a different actor.
 */
export function matchesActivityFilter(item: ActivityItem, key: ActivityFilterKey): boolean {
  switch (key) {
    case "all":
      return true;
    case "human":
      return item.category === "human";
    case "manager":
      return item.category === "rules" || item.category === "ai";
    case "agent":
      return item.category === "agent";
    case "task":
      return item.category === "task";
  }
}

// ── Date range ──────────────────────────────────────────────────────────────

export type ActivityRangePreset = "all" | "24h" | "7d" | "30d" | "custom";

export interface ActivityRange {
  preset: ActivityRangePreset;
  from?: string; // yyyy-mm-dd
  to?: string; // yyyy-mm-dd
}

export const ACTIVITY_RANGES: { value: ActivityRangePreset; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom range" },
];

export function filterActivityByRange(
  items: ActivityItem[],
  range: ActivityRange,
  now: number = Date.now(),
): ActivityItem[] {
  if (range.preset === "all") return items;

  let from = -Infinity;
  let to = Infinity;
  if (range.preset === "custom") {
    if (range.from) from = new Date(`${range.from}T00:00:00`).getTime();
    if (range.to) to = new Date(`${range.to}T23:59:59`).getTime();
  } else {
    const hours = range.preset === "24h" ? 24 : range.preset === "7d" ? 168 : 720;
    from = now - hours * 3_600_000;
  }

  return items.filter((item) => {
    const ts = Date.parse(item.time);
    // Keep anything undateable rather than silently dropping it.
    if (Number.isNaN(ts)) return true;
    return ts >= from && ts <= to;
  });
}

// ── Derivation ──────────────────────────────────────────────────────────────

const CATEGORY_FOR_ACTOR: Record<string, ActivityCategory> = {
  agent: "agent",
  process: "task",
  api: "task",
  human: "human",
  timer: "task",
  event: "task",
};

/**
 * A stage-and-task spine derived from where the case has actually got to. Used
 * when a case carries no authored feed: the 38 background cases, and any live
 * Maestro instance before its execution history is read.
 *
 * Timestamps are interpolated across the case's open span so the feed orders
 * correctly and the date filter has something real to bite on. They are
 * approximations of stage entry, not records of it, which is why a live case
 * replaces this wholesale with its execution history.
 */
export function deriveActivity(claim: InjuryClaim): ActivityItem[] {
  const opened = Date.parse(claim.openedAt);
  const updated = Date.parse(claim.lastUpdatedAt);
  if (Number.isNaN(opened) || Number.isNaN(updated)) return [];

  const touched = [...PRIMARY_STAGES, ...claim.activeLanes.flatMap((name) => {
    const stage = ALL_STAGES.find((s) => s.name === name);
    return stage ? [stage] : [];
  })].filter((stage) => {
    const state = claim.stageStates[stage.id];
    return state === "completed" || state === "active";
  });

  if (touched.length === 0) return [];

  const span = Math.max(updated - opened, 60_000);
  const items: ActivityItem[] = [];

  touched.forEach((stage, index) => {
    const at = opened + (span * index) / touched.length;
    const state = claim.stageStates[stage.id];

    items.push({
      id: `${claim.id}-stage-${stage.id}`,
      category: "rules",
      level: "stage",
      actor: "Case manager",
      title: `Entered ${stage.name}`,
      detail: stage.owner,
      time: new Date(at).toISOString(),
      stage: stage.name,
    });

    // Only completed stages get their tasks; an active stage's tasks are still
    // in flight and would read as finished work that has not happened.
    if (state !== "completed") return;

    stage.tasks.forEach((task, taskIndex) => {
      const taskAt = at + ((span / touched.length) * (taskIndex + 1)) / (stage.tasks.length + 1);
      items.push({
        id: `${claim.id}-task-${task.id}`,
        category: CATEGORY_FOR_ACTOR[task.actor] ?? "task",
        level: "task",
        actor: task.actor === "human" ? stage.owner : "Automation",
        title: task.name,
        time: new Date(taskAt).toISOString(),
        stage: stage.name,
      });
    });
  });

  return items;
}

/** The feed for a case: authored entries where they exist, derived otherwise. */
export function activityFor(claim: InjuryClaim, actions: CaseAction[]): ActivityItem[] {
  const base = claim.activity.length > 0 ? claim.activity : deriveActivity(claim);

  // A completed decision is an activity event in its own right, and carries the
  // HITL history the feed can expand.
  const decisions: ActivityItem[] = actions
    .filter((a) => a.status === "Completed" && a.completedAt)
    .map((a) => ({
      id: `decision-${a.id}`,
      category: "human" as const,
      level: "task" as const,
      actor: a.completedBy ?? a.assignee,
      title: a.title,
      detail: a.rationale,
      time: a.completedAt!,
      stage: a.stage,
      actionId: a.id,
      hitl: [
        { kind: "assigned" as const, actor: a.assignee, time: a.dueAt },
        {
          kind: "completed" as const,
          actor: a.completedBy ?? a.assignee,
          time: a.completedAt!,
        },
      ],
    }));

  return [...base, ...decisions].sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
}
