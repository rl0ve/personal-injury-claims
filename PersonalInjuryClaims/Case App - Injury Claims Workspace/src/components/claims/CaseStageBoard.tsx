import { useState } from "react";
import { Check, ChevronDown, Circle, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card } from "@/components/ui/card";
import { ActorChip, SlaBadge } from "@/components/claims/badges";
import { cn } from "@/lib/utils";
import { CONDITIONAL_STAGES, PRIMARY_STAGES, TERMINAL_STAGES } from "@/lib/claims/casePlan";
import { getCaseSlas } from "@/lib/claims/caseSlas";
import type {
  CaseAction,
  StageDefinition,
  StageState,
  TaskDefinition,
  InjuryClaim,
} from "@/lib/claims/types";

// The case plan as it stands on THIS case: every stage as a column, every task
// with its real state, and the open decisions attached to the stage that raised
// them. The Case plans page shows the plan in the abstract; this shows the run.

type TaskState = "completed" | "open" | "pending" | "skipped";

const COLUMN_TINT: Record<StageState, string> = {
  completed: "border-success/30",
  active: "border-info/50",
  skipped: "border-dashed border-border",
  pending: "border-border",
};

const STATE_CHIP: Record<StageState, { label: string; cls: string }> = {
  completed: { label: "Completed", cls: "bg-success/15 text-success" },
  active: { label: "Active", cls: "bg-info/15 text-info" },
  skipped: { label: "Skipped", cls: "bg-muted text-muted-foreground" },
  pending: { label: "Not started", cls: "bg-muted text-muted-foreground" },
};

/**
 * A task's state on this case.
 *
 * Maestro's per-task status is not carried on the case row, so this derives it
 * from the stage state plus the open decisions: a human task with an open action
 * against its stage is `open`, everything before it in a live stage has run, and
 * everything in a not-started stage is pending. A live case with real task
 * statuses should replace this with them.
 */
function taskStates(
  stage: StageDefinition,
  state: StageState,
  actions: CaseAction[],
): Map<string, TaskState> {
  const map = new Map<string, TaskState>();
  const openHere = new Set(
    actions
      .filter((a) => a.status === "Open" && a.stage === stage.name)
      .map((a) => a.actionType),
  );

  if (state === "completed") {
    stage.tasks.forEach((t) => map.set(t.id, "completed"));
    return map;
  }
  if (state === "skipped") {
    stage.tasks.forEach((t) => map.set(t.id, "skipped"));
    return map;
  }
  if (state === "pending") {
    stage.tasks.forEach((t) => map.set(t.id, "pending"));
    return map;
  }

  // Active: run down the task list, stopping at the first one still open.
  let reachedOpen = false;
  for (const task of stage.tasks) {
    if (reachedOpen) {
      map.set(task.id, "pending");
      continue;
    }
    if (task.actionType && openHere.has(task.actionType)) {
      map.set(task.id, "open");
      reachedOpen = true;
      continue;
    }
    map.set(task.id, "completed");
  }
  // Nothing open in a live stage means the work is under way, not finished,
  // the last task is the one in flight.
  if (!reachedOpen && stage.tasks.length > 0) {
    map.set(stage.tasks[stage.tasks.length - 1].id, "open");
  }
  return map;
}

function TaskRow({ task, state }: { task: TaskDefinition; state: TaskState }) {
  const Icon = state === "completed" ? Check : state === "open" ? CircleDot : Circle;
  return (
    <li
      className={cn(
        "flex items-start gap-2 rounded-md border p-2.5",
        state === "open" ? "border-info/40 bg-info/5" : "border-border bg-card",
        (state === "pending" || state === "skipped") && "opacity-60",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-3.5 shrink-0",
          state === "completed"
            ? "text-success"
            : state === "open"
              ? "text-info"
              : "text-muted-foreground/60",
        )}
        strokeWidth={2}
      />
      <span className="min-w-0 flex-1 text-sm leading-snug">{task.name}</span>
      <ActorChip actor={task.actor} className="mt-0.5" />
    </li>
  );
}

function StageColumn({
  stage,
  claim,
  actions,
}: {
  stage: StageDefinition;
  claim: InjuryClaim;
  actions: CaseAction[];
}) {
  const state = claim.stageStates[stage.id] ?? "pending";
  const states = taskStates(stage, state, actions);
  const chip = STATE_CHIP[state];
  const sla = getCaseSlas(claim, actions).find((s) => s.id === `stage:${stage.id}`);
  const done = [...states.values()].filter((s) => s === "completed").length;

  return (
    <Card className={cn("min-w-0 gap-3 border-2 p-4", COLUMN_TINT[state])}>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <span className="text-sm font-semibold">{stage.name}</span>
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", chip.cls)}>
            {chip.label}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {stage.owner} · {done}/{stage.tasks.length} tasks
        </span>
        {sla && sla.status !== "Not triggered" && (
          <span className="flex items-center gap-1.5">
            <SlaBadge status={sla.status} />
            <span className="text-xs text-muted-foreground">{stage.sla}</span>
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-1.5 border-t border-border pt-3">
        {stage.tasks.map((task) => (
          <TaskRow key={task.id} task={task} state={states.get(task.id) ?? "pending"} />
        ))}
      </ul>
    </Card>
  );
}

type BoardFilter = "touched" | "all";

export function CaseStageBoard({
  claim,
  actions,
}: {
  claim: InjuryClaim;
  actions: CaseAction[];
}) {
  const [filter, setFilter] = useState<BoardFilter>("touched");
  const [showLanes, setShowLanes] = useState(true);

  const touched = (stage: StageDefinition) => {
    const state = claim.stageStates[stage.id];
    return state === "completed" || state === "active";
  };

  const primary = PRIMARY_STAGES.filter((s) => filter === "all" || touched(s));
  // A terminal lane is only part of this case's story once entered.
  const lanes = [
    ...CONDITIONAL_STAGES,
    ...TERMINAL_STAGES.filter((s) => claim.stageStates[s.id]),
  ].filter((s) => filter === "all" || touched(s));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ButtonGroup>
          {(
            [
              ["touched", "Entered stages"],
              ["all", "Whole plan"],
            ] as [BoardFilter, string][]
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFilter(key)}
              className={cn(
                "text-xs font-normal text-muted-foreground",
                filter === key &&
                  "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
              )}
            >
              {label}
            </Button>
          ))}
        </ButtonGroup>
        <span className="text-xs text-muted-foreground">
          Task states are derived from the stage and its open decisions
        </span>
      </div>

      {primary.length === 0 ? (
        <Card className="p-5">
          <span className="text-sm text-muted-foreground">
            This case has not entered any primary stage yet.
          </span>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 @min-[560px]:grid-cols-2 @min-[1000px]:grid-cols-3 @min-[1320px]:grid-cols-4">
          {primary.map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              claim={claim}
              actions={actions}
            />
          ))}
        </div>
      )}

      {lanes.length > 0 && (
        <div className="rounded-xl bg-muted/40 p-4">
          <button
            type="button"
            onClick={() => setShowLanes((v) => !v)}
            aria-expanded={showLanes}
            className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown className={cn("size-4 transition-transform", !showLanes && "-rotate-90")} />
            Conditional and terminal lanes · {lanes.length}
          </button>
          {showLanes && (
            <div className="grid grid-cols-1 gap-4 @min-[560px]:grid-cols-2 @min-[1000px]:grid-cols-3 @min-[1320px]:grid-cols-4">
              {lanes.map((stage) => (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  claim={claim}
                  actions={actions}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
