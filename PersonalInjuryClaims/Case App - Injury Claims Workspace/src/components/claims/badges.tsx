import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ACTOR_CHIP, ACTOR_LABEL } from "@/lib/claims/casePlan";
import { SLA_TONE } from "@/lib/claims/sla";
import type { CaseStatus, Priority, SlaStatus, TaskActor } from "@/lib/claims/types";

type Tone = "info" | "warning" | "success" | "error";

function Pill({ tone, children }: { tone: Tone | null; children: ReactNode }) {
  if (!tone) return <Badge variant="outline">{children}</Badge>;
  return (
    <Badge variant="secondary" status={tone}>
      {children}
    </Badge>
  );
}

export function SlaBadge({ status }: { status: SlaStatus }) {
  return <Pill tone={SLA_TONE[status]}>{status}</Pill>;
}

const STATUS_TONE: Record<CaseStatus, Tone | null> = {
  "Action required": "warning",
  "Waiting on others": "info",
  Progressing: "success",
  Closed: null,
};

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return <Pill tone={STATUS_TONE[status]}>{status}</Pill>;
}

// P1 is a serious injury on a 24-hour case clock (SDD §1), so it reads as an
// error rather than a warning. It is the one band that changes the SLA itself.
const PRIORITY_TONE: Record<Priority, Tone | null> = {
  P1: "error",
  P2: "warning",
  P3: "info",
  P4: null,
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Pill tone={PRIORITY_TONE[priority]}>{priority}</Pill>;
}

// Actor chips reuse the case design's colour language: agent and API are the
// automated ends, human is the accountable one, process sits between.
const ACTOR_CLASS: Record<TaskActor, string> = {
  agent: "bg-insight-100 text-insight-600 dark:bg-insight-800 dark:text-white",
  process: "bg-warning/15 text-warning-foreground dark:bg-warning/25 dark:text-white",
  human: "bg-info/15 text-info dark:bg-info/25 dark:text-white",
  api: "bg-muted text-muted-foreground",
  timer: "bg-muted text-muted-foreground",
  event: "bg-success/10 text-success dark:bg-success/25 dark:text-white",
};

export function ActorChip({ actor, className }: { actor: TaskActor; className?: string }) {
  return (
    <span
      title={ACTOR_LABEL[actor]}
      className={cn(
        "inline-flex h-5 min-w-8 shrink-0 items-center justify-center rounded px-1.5 text-[10px] font-semibold tracking-wide",
        ACTOR_CLASS[actor],
        className,
      )}
    >
      {ACTOR_CHIP[actor]}
    </span>
  );
}

/** The "why it's here" cell: the reason a case is in a person's queue at all. */
export function QueueReasonPill({ reason }: { reason: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
      <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
      {reason}
    </span>
  );
}

const CONFIDENCE_LABEL: Record<string, string> = {
  low: "Confidence low",
  medium: "Confidence medium",
  "medium-high": "Confidence medium-high",
  high: "Confidence high",
};

export function ConfidenceBadge({ confidence }: { confidence: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {CONFIDENCE_LABEL[confidence] ?? confidence}
    </span>
  );
}

/**
 * Marks values the storyboard flags as illustrative rather than measured.
 *
 * Rendered as nothing while the console is shown to external audiences: the
 * tag is honest provenance internally, but beside a chart in front of an
 * investor it reads as a disclaimer on the product. Flip SHOW_ILLUSTRATIVE
 * back to true for internal walkthroughs.
 */
const SHOW_ILLUSTRATIVE = false;

export function IllustrativeTag({ className }: { className?: string }) {
  if (!SHOW_ILLUSTRATIVE) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70 ring-1 ring-inset ring-border",
        className,
      )}
    >
      Illustrative
    </span>
  );
}
