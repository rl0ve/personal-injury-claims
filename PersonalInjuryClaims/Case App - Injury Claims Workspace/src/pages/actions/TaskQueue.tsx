import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PanelLeftClose, PanelLeftOpen, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { shortCaseId } from "@/lib/claims/format";
import { formatRemaining } from "@/lib/claims/sla";
import {
  activeTaskFilterCount,
  EMPTY_TASK_FILTERS,
  isOverdue,
  matchesTaskFilters,
  type TaskFilters,
} from "@/lib/claims/taskFilters";
import type { CaseAction, InjuryClaim } from "@/lib/claims/types";

// The action queue.
//
// Grouped by urgency rather than by case: overdue first, then blocking, then
// everything else open, then completed. A claims officer's question on
// opening this is "what will bite me", not "what belongs to which case". The
// case is on every card either way.

interface QueueSection {
  group: string;
  tone: "overdue" | "blocking" | "default" | "done";
  items: CaseAction[];
}

export function TaskQueue({
  actions,
  casesById,
  selectedId,
  onSelect,
  width,
  collapsed = false,
  onToggleCollapsed,
  headerChips,
  filters,
  onFilters,
  panelOpen,
  onToggleFilters,
}: {
  actions: CaseAction[];
  casesById: Map<string, InjuryClaim>;
  selectedId: string;
  onSelect: (id: string) => void;
  /** Current width in px, driven by the drag handle in ActionsPage. */
  width: number;
  /** Collapsed to a rail, so the decision gets the whole pane. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  headerChips?: React.ReactNode;
  filters: TaskFilters;
  onFilters: (filters: TaskFilters) => void;
  panelOpen: boolean;
  onToggleFilters: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const visible = useMemo(
    () =>
      actions.filter((action) => {
        if (!matchesTaskFilters(action, filters)) return false;
        if (q === "") return true;
        const claim = casesById.get(action.caseId);
        const haystack = [
          action.title,
          action.stage,
          action.assignee,
          action.caseId,
          claim?.customer ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      }),
    [actions, filters, q, casesById],
  );

  const sections = useMemo<QueueSection[]>(() => {
    const open = visible.filter((a) => a.status === "Open");
    const overdue = open.filter(isOverdue);
    const overdueIds = new Set(overdue.map((a) => a.id));
    const blocking = open.filter((a) => a.blocking && !overdueIds.has(a.id));
    const blockingIds = new Set(blocking.map((a) => a.id));
    const rest = open.filter((a) => !overdueIds.has(a.id) && !blockingIds.has(a.id));
    const done = visible.filter((a) => a.status === "Completed");

    // Most urgent first inside every group: closest to (or furthest past) its clock.
    const byUrgency = (a: CaseAction, b: CaseAction) =>
      b.elapsedMinutes / b.slaMinutes - a.elapsedMinutes / a.slaMinutes;

    return (
      [
        { group: "Overdue", tone: "overdue", items: [...overdue].sort(byUrgency) },
        { group: "Blocking", tone: "blocking", items: [...blocking].sort(byUrgency) },
        { group: "Open", tone: "default", items: [...rest].sort(byUrgency) },
        { group: "Completed", tone: "done", items: done },
      ] as QueueSection[]
    ).filter((s) => s.items.length > 0);
  }, [visible]);

  const openCount = visible.filter((a) => a.status === "Open").length;
  const filterCount = activeTaskFilterCount(filters);

  if (collapsed) {
    // A rail rather than nothing: the count is the reason to come back, and
    // hiding the queue entirely would leave no way to reopen it.
    return (
      <div className="flex h-full shrink-0 flex-col items-center gap-2 border-r border-border bg-muted/40 py-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={`Show the actions list (${openCount} open)`}
              className="grid size-11 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <PanelLeftOpen className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Show the actions list</TooltipContent>
        </Tooltip>
        {openCount > 0 && (
          <span className="rounded-full bg-primary/15 px-1.5 text-xs font-semibold tabular-nums text-primary">
            {openCount}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      style={{ width }}
      // The set width is the desktop target; on smaller screens the panel shrinks
      // to a fraction of the viewport rather than staying wide.
      className="flex h-full min-w-[220px] max-w-[32vw] shrink-0 flex-col bg-muted/40"
    >
      <div className="flex items-center gap-2 px-5 pb-3 pt-4">
        <h2 className="text-sm font-semibold">My actions</h2>
        <span className="text-sm text-muted-foreground">({openCount})</span>
        {onToggleCollapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleCollapsed}
                aria-label="Hide the actions list"
                className="ml-auto grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <PanelLeftClose className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Hide the actions list</TooltipContent>
          </Tooltip>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleFilters}
          aria-label={filterCount > 0 ? `Filters (${filterCount} active)` : "Filter actions"}
          className={cn(
            !onToggleCollapsed && "ml-auto",
            (panelOpen || filterCount > 0) && "border-primary text-primary",
          )}
        >
          <SlidersHorizontal className="size-4" />
          Filters
          {filterCount > 0 && (
            <span className="ml-1 rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
              {filterCount}
            </span>
          )}
        </Button>
      </div>

      <div className="px-5 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search actions, cases, people…"
            className="h-9 bg-background pl-9"
          />
        </div>
      </div>

      {headerChips}

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {sections.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {q ? `No actions match “${query}”.` : "No actions match your filters."}
            </p>
            {(filterCount > 0 || q !== "") && (
              <button
                type="button"
                onClick={() => {
                  onFilters(EMPTY_TASK_FILTERS);
                  setQuery("");
                }}
                className="text-sm text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {sections.map(({ group, tone, items }) => (
          <div key={group} className="mb-2">
            <div
              className={cn(
                "px-2 py-2 text-xs",
                tone === "overdue"
                  ? "font-semibold text-destructive"
                  : tone === "blocking"
                    ? "font-semibold text-warning"
                    : "font-medium text-muted-foreground",
              )}
            >
              {group} ({items.length})
            </div>
            <div className="flex flex-col gap-3">
              {items.map((action) => {
                const selected = action.id === selectedId;
                const done = action.status === "Completed";
                const overdue = isOverdue(action);
                const claim = casesById.get(action.caseId);
                return (
                  // A div, not a button, so the nested case link stays valid HTML;
                  // the keyboard handlers preserve button-like selection.
                  <div
                    key={action.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(action.id)}
                    onKeyDown={(e) => {
                      // Only when the card itself has focus. Otherwise Enter on
                      // the nested case link would be cancelled here.
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(action.id);
                      }
                    }}
                    className={cn(
                      "group relative flex cursor-pointer flex-col items-start gap-1 rounded-xl border bg-card p-3.5 text-left shadow-sm outline-none transition-all focus-visible:ring-1 focus-visible:ring-ring",
                      selected
                        ? "border-primary ring-1 ring-primary"
                        : "border-border hover:border-foreground/15 hover:shadow",
                      done && "opacity-60",
                    )}
                  >
                    <span
                      className={cn(
                        "w-full truncate text-sm font-semibold",
                        overdue && "text-destructive",
                      )}
                    >
                      {action.title}
                    </span>
                    <span className="max-w-full truncate text-xs text-muted-foreground">
                      {claim?.customer ?? action.stage}
                    </span>
                    <Link
                      to="/cases/$caseId"
                      params={{ caseId: action.caseId }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-fit text-xs tabular-nums text-muted-foreground transition-colors hover:text-primary"
                      title={action.caseId}
                    >
                      {shortCaseId(action.caseId)}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {done
                        ? "Completed"
                        : formatRemaining(action.elapsedMinutes, action.slaMinutes)}
                    </span>

                    {!done && (action.blocking || overdue || action.priority === "P1") && (
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {overdue && (
                          <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                            Overdue
                          </span>
                        )}
                        {action.blocking && (
                          <span className="inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                            Blocking
                          </span>
                        )}
                        {action.priority === "P1" && (
                          <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                            P1
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
