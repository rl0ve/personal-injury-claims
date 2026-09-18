import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { X } from "lucide-react";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { ActionsSkeleton } from "@/components/claims/CaseSkeletons";
import { TaskFiltersPanel } from "@/components/claims/TaskFiltersPanel";
import { useResizableWidth } from "@/hooks/useResizableWidth";
import {
  activeTaskFilterCount,
  decodeTaskFilters,
  type TaskFilters,
} from "@/lib/claims/taskFilters";
import { shortCaseId } from "@/lib/claims/format";
import { isOverdue } from "@/lib/claims/taskFilters";
import { useActionsResult, useCases } from "@/lib/claims/useCases";
import { useRole } from "@/lib/role/useRole";
import { TaskQueue } from "./TaskQueue";
import { TaskDetail } from "./TaskDetail";

/** A removable active-filter chip, shown under the queue header. */
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-2.5 pr-1 text-xs font-medium shadow-sm">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}

/**
 * How long the queue shows a skeleton before it shows work.
 *
 * Deliberate, and not a fetch: on demo data the actions are in memory and would
 * otherwise appear instantly, which reads as a screenshot rather than a system
 * that went and looked. It is a floor, not an addition: a live read that takes
 * longer keeps the skeleton up rather than waiting this out first.
 */
const INTRO_SKELETON_MS = 2000;

/** True once `ms` have passed since mount. */
function useSettled(ms: number): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(true), ms);
    return () => window.clearTimeout(id);
  }, [ms]);
  return settled;
}

export function ActionsPage() {
  const { actions: allActions, isLoading } = useActionsResult();
  const { cases } = useCases();
  const { profile } = useRole();
  const settled = useSettled(INTRO_SKELETON_MS);

  // Remembered, like the right-hand rail: someone who works from the decision
  // and not the list should not have to collapse it on every visit.
  const [queueCollapsed, setQueueCollapsed] = useState(
    () => localStorage.getItem("actions.queue") === "collapsed",
  );
  useEffect(() => {
    localStorage.setItem("actions.queue", queueCollapsed ? "collapsed" : "open");
  }, [queueCollapsed]);

  // Deep links:
  //   ?task=…  selects an action (from a case's "Open in queue")
  //   ?case=…  scopes the queue to one case (from "Open in Actions")
  //   ?tf=…    an encoded filter set, so a filtered queue is shareable
  const { task, case: caseId, tf } = useSearch({ strict: false }) as {
    task?: string;
    case?: string;
    tf?: string;
  };

  const casesById = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);
  const scopedCase = caseId ? casesById.get(caseId) : undefined;
  const scoped = Boolean(caseId && scopedCase);

  const actions = useMemo(
    () => (scoped ? allActions.filter((a) => a.caseId === caseId) : allActions),
    [allActions, scoped, caseId],
  );

  // Selection defaults to the deep-linked action, else the first in the queue.
  const initial = (task && actions.some((a) => a.id === task) ? task : actions[0]?.id) ?? "";
  const [selectedId, setSelectedId] = useState(initial);
  const selected =
    actions.find((a) => a.id === selectedId) ??
    actions.find((a) => a.id === task) ??
    actions[0];

  const [filters, setFilters] = useState<TaskFilters>(() => decodeTaskFilters(tf));
  // A share link that carries filters opens the panel, so the recipient can see
  // what is being filtered rather than wondering why the queue looks short.
  const [panelOpen, setPanelOpen] = useState(
    () => activeTaskFilterCount(decodeTaskFilters(tf)) > 0,
  );

  const stages = useMemo(
    () => [...new Set(allActions.map((a) => a.stage))].sort(),
    [allActions],
  );
  const assignees = useMemo(
    () => [...new Set(allActions.map((a) => a.assignee))].sort(),
    [allActions],
  );
  const caseOptions = useMemo(
    () => [...new Set(allActions.map((a) => a.caseId))].sort(),
    [allActions],
  );

  const removeFrom = (key: "status" | "stage" | "assignee" | "case", value: string) =>
    setFilters({ ...filters, [key]: filters[key].filter((v) => v !== value) });

  // Case scope and every facet selection surface as the same removable chip.
  const chips: React.ReactNode[] = [];
  if (scoped && scopedCase) {
    chips.push(
      <span
        key="scope"
        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-2.5 pr-1 text-xs font-medium shadow-sm"
      >
        <Link
          to="/cases/$caseId"
          params={{ caseId: scopedCase.id }}
          className="shrink-0 font-semibold text-primary hover:underline"
          title={scopedCase.id}
        >
          {shortCaseId(scopedCase.id)}
        </Link>
        <span className="truncate text-muted-foreground">· {scopedCase.customer}</span>
        <Link
          to="/actions"
          search={{}}
          aria-label="Clear case filter"
          className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </Link>
      </span>,
    );
  }
  filters.status.forEach((v) =>
    chips.push(<FilterChip key={`st-${v}`} label={v} onRemove={() => removeFrom("status", v)} />),
  );
  filters.priority.forEach((v) =>
    chips.push(
      <FilterChip
        key={`pr-${v}`}
        label={v}
        onRemove={() => setFilters({ ...filters, priority: filters.priority.filter((p) => p !== v) })}
      />,
    ),
  );
  filters.stage.forEach((v) =>
    chips.push(<FilterChip key={`sg-${v}`} label={v} onRemove={() => removeFrom("stage", v)} />),
  );
  filters.assignee.forEach((v) =>
    chips.push(<FilterChip key={`as-${v}`} label={v} onRemove={() => removeFrom("assignee", v)} />),
  );
  filters.case.forEach((v) =>
    chips.push(<FilterChip key={`ca-${v}`} label={v} onRemove={() => removeFrom("case", v)} />),
  );
  if (filters.overdue) {
    chips.push(
      <FilterChip
        key="overdue"
        label="Overdue"
        onRemove={() => setFilters({ ...filters, overdue: false })}
      />,
    );
  }
  if (filters.blocking) {
    chips.push(
      <FilterChip
        key="blocking"
        label="Blocking"
        onRemove={() => setFilters({ ...filters, blocking: false })}
      />,
    );
  }

  const queue = useResizableWidth(360, {
    min: 280,
    max: 560,
    side: "left",
    storageKey: "actions.queueWidth",
  });

  const openForMe = allActions.filter(
    (a) => a.status === "Open" && a.assignee === profile.name,
  ).length;
  const overdueCount = allActions.filter(isOverdue).length;

  const headerChips = (
    <div className="flex flex-col gap-2 px-5 pb-3">
      {chips.length > 0 && <div className="flex flex-wrap gap-2">{chips}</div>}
      <span className="text-xs text-muted-foreground">
        {openForMe} assigned to you
        {overdueCount > 0 && <span className="text-destructive"> · {overdueCount} overdue</span>}
      </span>
    </div>
  );

  // Both waits at once, so the floor and a slow read overlap instead of adding
  // up. Placed after every hook, because an early return above them would change the
  // hook order between renders.
  if (!settled || isLoading) return <ActionsSkeleton />;

  return (
    <div className="flex h-full">
      <TaskQueue
        actions={actions}
        casesById={casesById}
        selectedId={selected?.id ?? ""}
        onSelect={setSelectedId}
        width={queue.width}
        collapsed={queueCollapsed}
        onToggleCollapsed={() => setQueueCollapsed((c) => !c)}
        headerChips={headerChips}
        filters={filters}
        onFilters={setFilters}
        panelOpen={panelOpen}
        onToggleFilters={() => setPanelOpen((o) => !o)}
      />

      {/* Nothing to drag once the queue is a rail, and the handle would read
          as a second, broken way to bring it back. */}
      {!queueCollapsed && (
        <ResizeHandle onPointerDown={queue.onPointerDown} aria-label="Resize actions list" />
      )}

      {selected ? (
        <TaskDetail action={selected} claim={casesById.get(selected.caseId)} />
      ) : (
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">
            {scoped ? "No actions on this case." : "Nothing is waiting on a person."}
          </p>
        </div>
      )}

      {/* Filters slide in over the content, so opening them never reflows the queue. */}
      <TaskFiltersPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        filters={filters}
        onChange={setFilters}
        stages={stages}
        assignees={assignees}
        caseOptions={caseOptions}
        showCaseFacet={!scoped}
      />
    </div>
  );
}
