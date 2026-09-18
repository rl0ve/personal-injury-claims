import { useState } from "react";
import {
  ArrowLeftRight,
  Bot,
  ChevronDown,
  ChevronRight,
  CircleCheckBig,
  Flag,
  Layers,
  ListChecks,
  MessageSquare,
  PencilLine,
  Scale,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { initialsOf, relativeTime } from "@/lib/claims/format";
import {
  ACTIVITY_FILTERS,
  ACTIVITY_RANGES,
  activityFilterLabel,
  type ActivityFilterKey,
  type ActivityRange,
  type ActivityRangePreset,
} from "@/lib/claims/activity";
import type {
  ActivityCategory,
  ActivityItem,
  ActivityLevel,
  HitlEvent,
  HitlEventKind,
  InjuryClaim,
} from "@/lib/claims/types";

export function ActivityFilters({
  value,
  onChange,
  mode = "hybrid",
}: {
  value: ActivityFilterKey;
  onChange: (key: ActivityFilterKey) => void;
  mode?: InjuryClaim["caseManagerMode"];
}) {
  return (
    <ButtonGroup>
      {ACTIVITY_FILTERS.map((f) => (
        <Button
          key={f.key}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(f.key)}
          className={cn(
            "text-xs font-normal text-muted-foreground",
            value === f.key && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
          )}
        >
          {activityFilterLabel(f.key, f.label, mode)}
        </Button>
      ))}
    </ButtonGroup>
  );
}

const DATE_INPUT =
  "h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

export function ActivityDateFilter({
  value,
  onChange,
}: {
  value: ActivityRange;
  onChange: (range: ActivityRange) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={value.preset}
        onValueChange={(preset) => onChange({ ...value, preset: preset as ActivityRangePreset })}
      >
        <SelectTrigger size="sm" className="w-[150px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ACTIVITY_RANGES.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value.preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            aria-label="From date"
            value={value.from ?? ""}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className={DATE_INPUT}
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            aria-label="To date"
            value={value.to ?? ""}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className={DATE_INPUT}
          />
        </div>
      )}
    </div>
  );
}

// Who executed a task-level entry. The distinction that matters on an injury
// case is HITL vs everything else, because BR-003 turns on it.
const EXECUTOR_LABEL: Record<ActivityCategory, string> = {
  human: "HITL",
  rules: "Rules",
  ai: "Agent",
  agent: "Agent",
  task: "Automation",
};

const LEVEL_TAG: Record<ActivityLevel, { label: string; cls: string }> = {
  stage: { label: "Stage", cls: "bg-primary text-primary-foreground" },
  milestone: { label: "Milestone", cls: "bg-primary/10 text-primary" },
  task: { label: "Action", cls: "bg-muted text-muted-foreground" },
  reassignment: { label: "Reassignment", cls: "bg-info/10 text-info" },
};

function LevelTag({ level }: { level?: ActivityLevel }) {
  if (!level) return null;
  const { label, cls } = LEVEL_TAG[level];
  return <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", cls)}>{label}</span>;
}

// One glyph per kind of event. Colour is deliberately not encoded here, since the
// row's tags carry that, so the marks read as one consistent set.
function markIcon(item: ActivityItem): LucideIcon {
  if (item.level === "stage") return Layers;
  if (item.level === "milestone") return Flag;
  if (item.level === "reassignment") return ArrowLeftRight;
  switch (item.category) {
    case "rules":
      return Scale;
    case "ai":
      return Sparkles;
    case "agent":
      return Bot;
    case "task":
      return ListChecks;
    default:
      return MessageSquare;
  }
}

function ActivityMark({ item }: { item: ActivityItem }) {
  // A person's own action shows their avatar; stage and milestone events keep an
  // event glyph even when a person triggered them, because the event is the
  // subject there, not the actor.
  const isPerson =
    item.category === "human" &&
    item.level !== "stage" &&
    item.level !== "milestone" &&
    item.level !== "reassignment";

  if (isPerson) {
    return (
      <Avatar className="z-10 size-7 shrink-0">
        <AvatarFallback className="text-xs">{initialsOf(item.actor)}</AvatarFallback>
      </Avatar>
    );
  }

  const Icon = markIcon(item);
  return (
    <span className="z-10 grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
      <Icon className="size-4" strokeWidth={1.5} />
    </span>
  );
}

const HITL_EVENT: Record<HitlEventKind, { icon: LucideIcon; label: string }> = {
  assigned: { icon: UserRound, label: "Assigned to" },
  reassigned: { icon: ArrowLeftRight, label: "Reassigned to" },
  draft: { icon: PencilLine, label: "Saved as draft" },
  completed: { icon: CircleCheckBig, label: "Completed" },
};

function hitlPrimary(event: HitlEvent): string {
  const { label } = HITL_EVENT[event.kind];
  return event.kind === "assigned" || event.kind === "reassigned"
    ? `${label} ${event.actor}`
    : label;
}

/** Expandable assignment → completion history for a human-in-the-loop task. */
function HitlHistory({ events }: { events: HitlEvent[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        Action history
      </button>
      {open && (
        <ol className="mt-2 flex flex-col gap-2 border-l border-border pl-3">
          {events.map((event, i) => {
            const { icon: Icon } = HITL_EVENT[event.kind];
            return (
              <li key={i} className="flex items-start gap-2 text-xs">
                <Icon className="mt-px size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <span className="font-medium text-foreground">{hitlPrimary(event)}</span>
                {event.kind === "reassigned" && event.from && (
                  <span className="text-muted-foreground">from {event.from}</span>
                )}
                <span className="ml-auto shrink-0 text-muted-foreground">
                  {relativeTime(event.time)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function ActivityFeed({
  items,
  emptyLabel = "No activity for this filter.",
}: {
  items: ActivityItem[];
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ol className="flex flex-col">
      {items.map((item, i) => {
        const isStage = item.level === "stage";
        const executor = item.level === "task" ? EXECUTOR_LABEL[item.category] : undefined;
        return (
          <li
            key={item.id}
            className={cn("relative flex gap-3 pb-7 last:pb-0", isStage && i > 0 && "mt-1 pt-5")}
          >
            {i < items.length - 1 && (
              <span className="absolute left-3.5 top-8 -ml-px h-full w-px bg-border" />
            )}
            <ActivityMark item={item} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {/* An action row carries one executor tag; every other level keeps
                    its level tag, so the two never stack on the same row. */}
                {item.level === "task" ? (
                  executor && (
                    <span className="rounded border border-border px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {executor}
                    </span>
                  )
                ) : (
                  <LevelTag level={item.level} />
                )}
                <span
                  className="ml-auto shrink-0 text-xs text-muted-foreground"
                  title={new Date(item.time).toLocaleString()}
                >
                  {relativeTime(item.time)}
                </span>
              </div>
              <div className={cn("mt-1 text-sm", isStage ? "font-semibold" : "font-medium")}>
                {item.title}
              </div>
              <p className="text-sm text-muted-foreground">
                {item.actor}
                {item.detail ? ` · ${item.detail}` : ""}
              </p>
              {item.level === "task" && item.category === "human" && item.hitl?.length ? (
                <HitlHistory events={item.hitl} />
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
