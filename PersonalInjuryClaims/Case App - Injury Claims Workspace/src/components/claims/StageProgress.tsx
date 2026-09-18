import { Circle, CircleCheckBig, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { ActorChip } from "@/components/claims/badges";
import { CONDITIONAL_STAGES, PRIMARY_STAGES, stageById } from "@/lib/claims/casePlan";
import { formatSlaBudget } from "@/lib/claims/sla";
import type { StageDefinition, StageState, InjuryClaim } from "@/lib/claims/types";

// Case progress as a segmented meter: one segment per primary stage, with the
// conditional lanes listed underneath. An injury case is not linear: liability
// and medical evidence run as parallel tracks (BR-002) and a lane can open off any
// stage, so a stage's colour comes from what the case actually entered, never
// from its position on the line.

const STATE_LABEL: Record<StageState, string> = {
  completed: "completed",
  active: "active",
  skipped: "skipped",
  pending: "not started",
};

const CHIP: Record<StageState, { label: string; cls: string }> = {
  completed: { label: "Completed", cls: "bg-success/10 text-success" },
  active: { label: "Active", cls: "bg-info/10 text-info" },
  skipped: { label: "Skipped", cls: "bg-muted text-muted-foreground" },
  pending: { label: "Not started", cls: "bg-muted text-muted-foreground" },
};

// A diagonal hatch marks a skipped stage as an intentional bypass rather than a gap.
const HATCH: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(45deg, color-mix(in oklch, var(--muted-foreground) 45%, transparent) 0 1px, transparent 1px 4px)",
};

// Completed uses a lighter success tint and active a solid info, so the two
// separate by lightness as well as hue. The tokens are close in tone alone.
function segmentClass(state: StageState): string {
  if (state === "completed") return "bg-success/55";
  if (state === "active") return "bg-info";
  if (state === "skipped") return "ring-1 ring-inset ring-border";
  return "bg-muted-foreground/20";
}

function LegendSwatch({ state }: { state: StageState }) {
  return (
    <span
      className={cn("h-2 w-3 shrink-0 rounded-[2px]", segmentClass(state))}
      style={state === "skipped" ? HATCH : undefined}
    />
  );
}

const LEGEND_ORDER: StageState[] = ["completed", "active", "skipped", "pending"];

function Legend() {
  return (
    <div className="flex flex-col gap-1.5 p-3 text-xs text-muted-foreground">
      {LEGEND_ORDER.map((state) => (
        <span key={state} className="flex items-center gap-1.5">
          <LegendSwatch state={state} />
          {state === "pending" ? "upcoming" : STATE_LABEL[state]}
        </span>
      ))}
    </div>
  );
}

function TipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{children}</span>
    </div>
  );
}

function StageDetail({
  stage,
  state,
  claim,
}: {
  stage: StageDefinition;
  state: StageState;
  claim: InjuryClaim;
}) {
  const chip = CHIP[state];
  const humanTasks = stage.tasks.filter((t) => t.actor === "human").length;
  const isCurrent = claim.currentStage === stage.name;

  return (
    <div className="flex w-72 flex-col gap-2 p-3 text-xs">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{stage.name}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", chip.cls)}>
          {chip.label}
        </span>
      </div>
      <p className="text-muted-foreground">{stage.description}</p>
      <div className="flex flex-col gap-1 border-t border-border pt-2">
        <TipRow label="Owner">{stage.owner}</TipRow>
        <TipRow label="SLA">{stage.sla}</TipRow>
        <TipRow label="Tasks">
          {stage.tasks.length} · {humanTasks} human
        </TipRow>
        {isCurrent && <TipRow label="Clock">{formatSlaBudget(stage.slaMinutes)}</TipRow>}
      </div>
    </div>
  );
}

function stateOf(claim: InjuryClaim, stage: StageDefinition): StageState {
  return claim.stageStates[stage.id] ?? "pending";
}

export function StageProgress({
  claim,
  compact = false,
}: {
  claim: InjuryClaim;
  /** Tighter padding and no per-segment labels, for a rail or a list row. */
  compact?: boolean;
}) {
  const steps = PRIMARY_STAGES.map((stage) => ({ stage, state: stateOf(claim, stage) }));
  const doneCount = steps.filter((s) => s.state === "completed").length;

  // Terminal lanes only appear once entered. They end a case rather than
  // sitting dormant on the plan, so listing them upfront would misread.
  const enteredTerminal = Object.keys(claim.stageStates)
    .map(stageById)
    .filter((s): s is StageDefinition => Boolean(s) && s!.kind === "terminal");

  const lanes = [...CONDITIONAL_STAGES, ...enteredTerminal];

  return (
    <Card className={cn("gap-3 p-5", compact && "gap-2 p-4")}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn("truncate font-semibold", compact ? "text-sm" : "text-base")}>
          Stage progress
        </span>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1.5 text-muted-foreground",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {doneCount} of {steps.length} complete
          <HoverCard openDelay={100} closeDelay={60}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                aria-label="Colour key"
                className="grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Info className="size-4" />
              </button>
            </HoverCardTrigger>
            <HoverCardContent side="bottom" align="end" sideOffset={8} className="w-auto rounded-lg p-0">
              <Legend />
            </HoverCardContent>
          </HoverCard>
        </span>
      </div>

      <div className="flex items-start gap-[3px]">
        {steps.map(({ stage, state }) => (
          <div key={stage.id} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <HoverCard openDelay={120} closeDelay={40}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  aria-label={`${stage.name}: ${STATE_LABEL[state]}`}
                  className={cn(
                    "block w-full rounded-[4px] border-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    compact ? "h-3" : "h-6",
                    segmentClass(state),
                  )}
                  style={state === "skipped" ? HATCH : undefined}
                />
              </HoverCardTrigger>
              <HoverCardContent side="bottom" align="center" sideOffset={8} className="w-auto rounded-lg p-0">
                <StageDetail stage={stage} state={state} claim={claim} />
              </HoverCardContent>
            </HoverCard>
            {!compact && (
              // "now" goes on its own line rather than inline: the labels sit
              // shoulder to shoulder under the meter, so an inline marker after
              // a truncated name reads as if it belongs to the next stage.
              <span className="flex min-w-0 flex-col text-xs">
                <span
                  title={stage.name}
                  className={cn(
                    "truncate",
                    state === "active"
                      ? "font-medium text-foreground"
                      : state === "completed"
                        ? "text-muted-foreground"
                        : "text-muted-foreground/55",
                  )}
                >
                  {stage.name}
                </span>
                {claim.currentStage === stage.name && (
                  <span className="font-medium uppercase tracking-wide text-info">now</span>
                )}
              </span>
            )}
          </div>
        ))}
      </div>

      {!compact && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <span className="text-xs font-medium text-muted-foreground">Conditional stages</span>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {lanes.map((lane) => {
              const open = claim.activeLanes.includes(lane.name);
              return (
                <li key={lane.id} className="flex items-start gap-1.5 text-xs leading-snug">
                  {open ? (
                    <CircleCheckBig className="mt-px size-3.5 shrink-0 text-info" strokeWidth={1.5} />
                  ) : (
                    <Circle className="mt-px size-3.5 shrink-0 text-muted-foreground/50" strokeWidth={1.5} />
                  )}
                  <span className={open ? "font-medium text-foreground" : "text-muted-foreground/70"}>
                    {lane.name}
                    {open && <span className="ml-1 text-info">open</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}

/** The stage plan as a task-by-task board, for the Case plans page and the plan tab. */
export function StageTaskList({ stage }: { stage: StageDefinition }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {stage.tasks.map((task) => (
        <li
          key={task.id}
          className="flex items-start gap-2 rounded-md border border-border bg-card px-2.5 py-2"
        >
          <ActorChip actor={task.actor} className="mt-0.5" />
          <span className="min-w-0 flex-1 text-sm leading-snug">{task.name}</span>
        </li>
      ))}
    </ul>
  );
}
