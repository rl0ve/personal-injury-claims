import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  activeTaskFilterCount,
  EMPTY_TASK_FILTERS,
  type TaskFilters,
} from "@/lib/claims/taskFilters";
import type { Priority } from "@/lib/claims/types";

// Queue facets, in a slide-out. It sits over the content rather than beside it
// so opening filters never reflows the queue you are reading.

function FacetGroup<T extends string>({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: readonly T[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{title}</span>
      <div className="flex flex-col gap-1.5">
        {options.map((option) => {
          const checked = selected.includes(option);
          return (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 text-sm transition-colors hover:bg-muted/60"
            >
              <Checkbox checked={checked} onCheckedChange={() => onToggle(option)} />
              <span className={cn(checked && "font-medium")}>{option}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-1.5 transition-colors hover:bg-muted/60">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} className="mt-0.5" />
      <span className="min-w-0">
        <span className={cn("block text-sm", checked && "font-medium")}>{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

const PRIORITIES: readonly Priority[] = ["P1", "P2", "P3", "P4"];
const STATUSES = ["Open", "Completed"] as const;

export function TaskFiltersPanel({
  open,
  onOpenChange,
  filters,
  onChange,
  stages,
  assignees,
  caseOptions,
  showCaseFacet = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  stages: string[];
  assignees: string[];
  caseOptions: string[];
  /** Hidden when the queue is already scoped to a single case. */
  showCaseFacet?: boolean;
}) {
  const count = activeTaskFilterCount(filters);

  function toggle<K extends "status" | "stage" | "assignee" | "case">(key: K, value: string) {
    const current = filters[key];
    onChange({
      ...filters,
      [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    });
  }

  function togglePriority(value: Priority) {
    onChange({
      ...filters,
      priority: filters.priority.includes(value)
        ? filters.priority.filter((v) => v !== value)
        : [...filters.priority, value],
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-sm">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            Filters
            {count > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                {count}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Attention</span>
            <ToggleRow
              label="Overdue"
              description="Past its task SLA"
              checked={filters.overdue}
              onChange={(v) => onChange({ ...filters, overdue: v })}
            />
            <ToggleRow
              label="Pending"
              description="Holds its stage from completing"
              checked={filters.blocking}
              onChange={(v) => onChange({ ...filters, blocking: v })}
            />
          </div>

          <FacetGroup
            title="Status"
            options={STATUSES}
            selected={filters.status}
            onToggle={(v) => toggle("status", v)}
          />
          <FacetGroup
            title="Priority"
            options={PRIORITIES}
            selected={filters.priority}
            onToggle={togglePriority}
          />
          <FacetGroup
            title="Stage"
            options={stages}
            selected={filters.stage}
            onToggle={(v) => toggle("stage", v)}
          />
          <FacetGroup
            title="Assignee"
            options={assignees}
            selected={filters.assignee}
            onToggle={(v) => toggle("assignee", v)}
          />
          {showCaseFacet && (
            <FacetGroup
              title="Case"
              options={caseOptions}
              selected={filters.case}
              onToggle={(v) => toggle("case", v)}
            />
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border p-4">
          <Button
            variant="outline"
            className="flex-1"
            disabled={count === 0}
            onClick={() => onChange(EMPTY_TASK_FILTERS)}
          >
            Clear all
          </Button>
          <Button className="flex-1" onClick={() => onOpenChange(false)}>
            <Check className="size-4" />
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
