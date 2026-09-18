import { useState } from "react";
import { Check, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card } from "@/components/ui/card";
import { WidgetHeader } from "@/components/claims/WidgetHeader";
import { ActorChip } from "@/components/claims/badges";
import { cn } from "@/lib/utils";
import { CONDITIONAL_STAGES, PRIMARY_STAGES, TERMINAL_STAGES } from "@/lib/claims/casePlan";
import type { CaseAction, StageDefinition, StageState, InjuryClaim } from "@/lib/claims/types";

// Where each stage stands and who owns it. SLA and open actions have their own
// widgets, so this stays focused on stage status, ownership and task progress.

const STATE_BADGE: Record<StageState, { label: string; cls: string }> = {
  completed: { label: "Completed", cls: "bg-success/15 text-success" },
  active: { label: "Active", cls: "bg-info/15 text-info" },
  skipped: { label: "Skipped", cls: "bg-muted text-muted-foreground" },
  pending: { label: "Not started", cls: "bg-muted text-muted-foreground" },
};

function StageStateBadge({ state }: { state: StageState }) {
  const { label, cls } = STATE_BADGE[state];
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", cls)}
      aria-label={state === "completed" ? "Completed" : undefined}
      title={state === "completed" ? "Completed" : undefined}
    >
      {state === "completed" ? <Check className="size-3" /> : label}
    </span>
  );
}

type StageFilter = "active" | "pending" | "all";

const FILTERS: [StageFilter, string][] = [
  ["active", "Active"],
  ["pending", "Not started"],
  ["all", "All stages"],
];

/**
 * Task progress for one stage. A completed stage has all its tasks done; an
 * active one counts the human tasks still open against it, since those are the
 * ones a person can act on.
 */
function taskProgress(
  stage: StageDefinition,
  state: StageState,
  actions: CaseAction[],
): { done: number; total: number; humanOpen: number } {
  const total = stage.tasks.length;
  const openHere = actions.filter((a) => a.stage === stage.name && a.status === "Open").length;

  if (state === "completed") return { done: total, total, humanOpen: 0 };
  if (state === "pending" || state === "skipped") return { done: 0, total, humanOpen: 0 };

  // Active: everything up to the first still-open human task is done.
  const firstOpenIndex = stage.tasks.findIndex((t) => t.actor === "human" && openHere > 0);
  const done = firstOpenIndex >= 0 ? firstOpenIndex : Math.max(0, total - 1);
  return { done, total, humanOpen: openHere };
}

export function StagesSummary({
  claim,
  actions,
  onOpen,
}: {
  claim: InjuryClaim;
  actions: CaseAction[];
  onOpen?: () => void;
}) {
  const [filter, setFilter] = useState<StageFilter>("active");

  // Terminal lanes only join the list once entered. An unentered one is not a
  // stage that has not started, it is a path the case did not take.
  const enteredTerminal = TERMINAL_STAGES.filter((s) => claim.stageStates[s.id]);
  const all = [...PRIMARY_STAGES, ...CONDITIONAL_STAGES, ...enteredTerminal];

  const stateOf = (stage: StageDefinition): StageState =>
    claim.stageStates[stage.id] ?? "pending";

  const stages = all.filter((stage) => {
    const state = stateOf(stage);
    if (filter === "all") return true;
    if (filter === "active") return state === "active";
    return state === "pending";
  });

  const emptyLabel =
    filter === "active"
      ? "No active stages on this case."
      : filter === "pending"
        ? "No not-started stages."
        : "No stages.";

  return (
    <Card className="gap-3 p-5">
      <WidgetHeader
        icon={<Layers className="size-4 text-muted-foreground" />}
        title="Stages"
        onOpen={onOpen}
      >
        <ButtonGroup>
          {FILTERS.map(([key, label]) => (
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
      </WidgetHeader>

      {stages.length === 0 ? (
        <span className="text-sm text-muted-foreground">{emptyLabel}</span>
      ) : (
        stages.map((stage) => {
          const state = stateOf(stage);
          const progress = taskProgress(stage, state, actions);
          return (
            <div
              key={stage.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {stage.name}
                  <StageStateBadge state={state} />
                  {stage.kind !== "primary" && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                      {stage.kind === "conditional" ? "Conditional" : "Terminal"}
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {progress.done}/{progress.total} tasks
                  {progress.humanOpen > 0 && (
                    <span className="text-warning">
                      {" · "}
                      {progress.humanOpen} awaiting a person
                    </span>
                  )}
                  {" · "}SLA {stage.sla}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className="text-xs font-medium text-foreground">{stage.owner}</span>
                <span className="flex items-center gap-1">
                  {stage.tasks.map((task) => (
                    <ActorChip key={task.id} actor={task.actor} />
                  ))}
                </span>
              </div>
            </div>
          );
        })
      )}
    </Card>
  );
}
