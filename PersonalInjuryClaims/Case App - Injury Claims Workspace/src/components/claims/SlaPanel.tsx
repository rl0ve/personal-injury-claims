import { useEffect, useMemo, useState } from "react";
import { Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card } from "@/components/ui/card";
import { WidgetHeader } from "@/components/claims/WidgetHeader";
import { cn } from "@/lib/utils";
import { dateTime } from "@/lib/claims/format";
import { getCaseSlas } from "@/lib/claims/caseSlas";
import { formatDuration } from "@/lib/claims/sla";
import type { CaseAction, CaseSlaEntry, SlaStatus, InjuryClaim } from "@/lib/claims/types";

// The case's clocks, at all three levels.
//
// An injury case runs several at once: the case clock, one per entered stage,
// one per open decision. The Overview shows the case clock plus whatever
// needs attention, and the SLAs tab shows the full grouped list. Both read
// `getCaseSlas`, so the summary can never disagree with the list.

const PILL: Record<SlaStatus, string> = {
  "On track": "bg-success/10 text-success dark:bg-success/25 dark:text-white",
  "At risk": "bg-warning/15 text-warning-foreground dark:bg-warning/25 dark:text-white",
  Breached: "bg-destructive/10 text-destructive dark:bg-destructive/25 dark:text-white",
  Paused: "bg-muted text-muted-foreground",
  Met: "bg-success/10 text-success dark:bg-success/25 dark:text-white",
  "Not triggered": "bg-muted text-muted-foreground",
};

const STATUS_ORDER: SlaStatus[] = [
  "Breached",
  "At risk",
  "On track",
  "Not triggered",
  "Met",
  "Paused",
];

function rank(entry: CaseSlaEntry): number {
  return STATUS_ORDER.indexOf(entry.status);
}

function bySeverity(a: CaseSlaEntry, b: CaseSlaEntry): number {
  return rank(a) - rank(b) || a.dueAt.getTime() - b.dueAt.getTime();
}

/** "2 hr 48 min left" / "1 hr 5 min overdue", recomputed against a ticking now. */
function countdown(dueAt: Date, now: number): { label: string; overdue: boolean } {
  const diff = dueAt.getTime() - now;
  const overdue = diff < 0;
  return { label: `${formatDuration(diff / 60_000)} ${overdue ? "overdue" : "left"}`, overdue };
}

function SlaRow({
  entry,
  now,
  headline = false,
  showCondition = false,
}: {
  entry: CaseSlaEntry;
  now: number;
  headline?: boolean;
  showCondition?: boolean;
}) {
  const cd = countdown(entry.dueAt, now);
  const untriggered = entry.status === "Not triggered";
  const met = entry.status === "Met";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border p-3",
        untriggered ? "border-dashed border-border bg-muted/60" : "border-border",
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className={cn("truncate text-sm", headline && "font-medium")}>{entry.label}</span>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
              PILL[entry.status],
            )}
          >
            {entry.status}
          </span>
        </div>
        {showCondition && entry.condition && (
          <span className="text-xs text-muted-foreground">
            {untriggered ? "Triggers when " : "Triggered when "}
            {entry.condition}
          </span>
        )}
      </div>

      <div className="shrink-0 text-right">
        {untriggered ? null : met ? (
          <span className="text-xs text-muted-foreground">Met</span>
        ) : (
          <>
            <div className="text-xs text-muted-foreground tabular-nums">
              Due {dateTime(entry.dueAt.toISOString())}
            </div>
            <div
              className={cn(
                "text-xs font-medium tabular-nums",
                cd.overdue
                  ? "text-destructive"
                  : entry.status === "At risk"
                    ? "text-warning"
                    : "text-muted-foreground",
              )}
            >
              {cd.label}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function SlaPanel({
  claim,
  actions,
  variant = "full",
  onOpen,
}: {
  claim: InjuryClaim;
  actions: CaseAction[];
  /** "summary" is the Overview widget; "full" is the SLAs tab. */
  variant?: "summary" | "full";
  onOpen?: () => void;
}) {
  // Anchor the due dates once so the rows don't drift while the countdown ticks.
  const anchor = useMemo(() => Date.now(), []);
  const entries = useMemo(
    () => getCaseSlas(claim, actions, anchor),
    [claim, actions, anchor],
  );

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [statusFilter, setStatusFilter] = useState<SlaStatus | "all">("all");

  const caseSla = entries.find((e) => e.id === "case");
  const others = entries.filter((e) => e.id !== "case");
  const attention = others
    .filter((e) => e.status === "Breached" || e.status === "At risk")
    .sort(bySeverity);

  const breached = others.filter((e) => e.status === "Breached").length;
  const atRisk = others.filter((e) => e.status === "At risk").length;

  if (variant === "summary") {
    const CAP = 3;
    const shown = attention.slice(0, CAP);
    const extra = attention.length - shown.length;

    return (
      <Card className="gap-3 p-5">
        <WidgetHeader
          icon={<Timer className="size-4 text-muted-foreground" />}
          title="SLA"
          onOpen={onOpen}
        />
        {caseSla && <SlaRow entry={caseSla} now={now} headline />}

        {attention.length > 0 ? (
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-sm font-medium text-muted-foreground">Needs attention</span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {breached > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-destructive" />
                    <span className="font-medium text-foreground">{breached}</span> Breached
                  </span>
                )}
                {atRisk > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-warning" />
                    <span className="font-medium text-foreground">{atRisk}</span> At risk
                  </span>
                )}
              </div>
            </div>
            {shown.map((entry) => (
              <SlaRow key={entry.id} entry={entry} now={now} />
            ))}
            {extra > 0 && onOpen && (
              <button
                type="button"
                onClick={onOpen}
                className="w-fit text-xs font-medium text-primary hover:underline"
              >
                +{extra} more need attention
              </button>
            )}
          </div>
        ) : (
          <span className="px-1 text-xs text-muted-foreground">All SLAs on track.</span>
        )}
      </Card>
    );
  }

  // Full list. Only statuses actually present become filter segments, so the
  // control doubles as a count rollup rather than showing empty buckets.
  const present = STATUS_ORDER.filter((s) => others.some((e) => e.status === s));
  const matches = (entry: CaseSlaEntry) => statusFilter === "all" || entry.status === statusFilter;

  const group = (label: string, level: CaseSlaEntry["level"]) => {
    const items = others.filter((e) => e.level === level && matches(e)).sort(bySeverity);
    if (items.length === 0) return null;
    return (
      <div className="flex flex-col gap-2 pt-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {items.map((entry) => (
          <SlaRow key={entry.id} entry={entry} now={now} showCondition />
        ))}
      </div>
    );
  };

  const visibleCount = others.filter(matches).length;

  return (
    <Card className="gap-3 p-5">
      {caseSla && <SlaRow entry={caseSla} now={now} headline showCondition />}

      <ButtonGroup>
        {(["all", ...present] as (SlaStatus | "all")[]).map((key) => (
          <Button
            key={key}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setStatusFilter(key)}
            className={cn(
              "text-xs font-normal text-muted-foreground",
              statusFilter === key &&
                "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
            )}
          >
            {key === "all" ? "All" : key}
          </Button>
        ))}
      </ButtonGroup>

      {group("Stage", "stage")}
      {group("Actions", "action")}
      {visibleCount === 0 && (
        <span className="px-1 text-xs text-muted-foreground">No SLAs match this filter.</span>
      )}
    </Card>
  );
}
