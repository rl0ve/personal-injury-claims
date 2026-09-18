import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfidenceBadge } from "@/components/claims/badges";
import { cn } from "@/lib/utils";
import { outcomeLabel } from "@/lib/claims/format";
import { recordDecision } from "@/lib/claims/useCases";
import { useRole } from "@/lib/role/useRole";
import { completeTask } from "@/services/uipath/caseService";
import { isCaseConfigured } from "@/services/uipath/config";
import { useUiPath } from "@/services/uipath/UiPathProvider";
import type { CaseAction, InjuryClaim } from "@/lib/claims/types";

// The decision itself: options with the reason each is or isn't supported, the
// agent's recommendation preselected, and a rationale recorded on the case.
//
// Shared by the full-screen console and the Actions page's detail pane so the
// two can never drift. Everything around it differs; this does not.

export function DecisionForm({
  action,
  claim,
  /** Extra fields written alongside the outcome (e.g. the console's free-text note). */
  extraData,
  onCompleted,
  compact = false,
}: {
  action: CaseAction;
  claim: InjuryClaim;
  extraData?: Record<string, unknown>;
  onCompleted?: (outcome: string) => void;
  /** Tighter spacing for the Actions pane, which is narrower than the console. */
  compact?: boolean;
}) {
  const { profile } = useRole();
  const { sdk, isAuthenticated } = useUiPath();

  const [selected, setSelected] = useState<string | null>(
    action.recommendation.recommendedOutcome,
  );
  const [rationale, setRationale] = useState(action.rationale ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Switching actions inside the Actions pane keeps this component mounted, so
  // the draft has to follow the selection rather than only the initial mount.
  useEffect(() => {
    setSelected(action.recommendation.recommendedOutcome);
    setRationale(action.rationale ?? "");
    setError(null);
  }, [action.id, action.recommendation.recommendedOutcome, action.rationale]);

  const isDone = action.status === "Completed";

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);

    // Record locally first so the demo advances even with no live task to
    // complete; the Maestro write is best-effort on top of that.
    recordDecision(action, selected, profile.name, rationale);

    if (isCaseConfigured() && isAuthenticated && sdk && claim.instanceId) {
      try {
        await completeTask(sdk, claim.instanceId, action.actionType, selected, {
          rationale,
          ...extraData,
          evidenceSignals: claim.evidence.map((e) => ({ id: e.id, helpful: e.helpful })),
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? `Recorded locally, but the Maestro task was not completed: ${err.message}`
            : "Recorded locally, but the Maestro task was not completed.",
        );
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(false);
    onCompleted?.(selected);
  }

  return (
    <Card className={cn("gap-4", compact ? "p-4" : "p-5")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-base font-semibold">{action.title}</span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Agent recommendation preselected</span>
          <ConfidenceBadge confidence={action.recommendation.confidence} />
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {action.options.map((option) => {
          const isSelected = selected === option.outcome;
          const isRecommended = action.recommendation.recommendedOutcome === option.outcome;
          return (
            <button
              key={option.outcome}
              type="button"
              disabled={isDone}
              onClick={() => setSelected(option.outcome)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60",
                isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                  isSelected ? "border-primary bg-primary text-white" : "border-input",
                )}
                aria-hidden
              >
                {isSelected && <Check className="size-3" />}
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{option.label}</span>
                  {isRecommended && (
                    <span className="rounded-full bg-insight-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-insight-600 dark:bg-insight-800 dark:text-white">
                      Recommended
                    </span>
                  )}
                  {!option.supported && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Not supported
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {option.rationale}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`rationale-${action.id}`} className="text-sm font-medium">
          Rationale · recorded on the case
        </label>
        <textarea
          id={`rationale-${action.id}`}
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={3}
          disabled={isDone}
          className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30"
        />
      </div>

      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {isDone ? (
        <div className="flex items-center gap-2 rounded-md bg-success/10 p-3 text-sm text-success">
          <Check className="size-4" />
          Decided: {outcomeLabel(action.completedOutcome ?? "")} by {action.completedBy}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void submit()} disabled={!selected || submitting}>
            {submitting ? "Submitting…" : "Submit decision"}
          </Button>
          <Button variant="outline" disabled={submitting}>
            Send back for evidence
          </Button>
          <span className="ml-auto text-[11px] uppercase tracking-wide text-muted-foreground">
            Writes to the decision ledger
          </span>
        </div>
      )}
    </Card>
  );
}
