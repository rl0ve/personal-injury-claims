/**
 * The Action App task, surfaced inside the coded console.
 *
 * The decision UI is the same component the Action Center app renders
 * (packages/decision-form). Only the host differs: there it completes through
 * CodedActionAppService, here through the Tasks API. The form knows neither.
 */
import { useCallback, useMemo, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import {
  DecisionForm,
  defaultFormData,
  type TaskHost,
  type FormData,
} from "../../../../packages/decision-form";
import { useUiPath } from "../../services/uipath/UiPathProvider";
import {
  useCase,
  useActionsForCase,
  recordDecision,
  addCaseEvidence,
} from "@/lib/claims/useCases";
import { useRole } from "@/lib/role/useRole";
import { completeTask, completeTaskById, writeCaseEvent } from "../../services/uipath/caseService";

/** Which action the console is standing in front of, keyed by route segment. */
const ACTION_TYPE_FOR_ROUTE: Record<string, string> = {
  "coverage-decision": "SubmitMedicalEvidence",
  "settlement-authorisation": "AuthoriseSettlement",
};

export default function ActionTaskPage() {
  const { caseId, taskId } = useParams({ strict: false }) as {
    caseId: string;
    taskId: string;
  };
  const { sdk, isAuthenticated } = useUiPath();
  const { claim } = useCase(caseId);
  const caseActions = useActionsForCase(caseId);
  const { profile } = useRole();
  const [dark, setDark] = useState(false);

  const actionType = ACTION_TYPE_FOR_ROUTE[taskId] ?? "SubmitMedicalEvidence";

  /*
    The route names the case in business terms — CLAIM-5182 — and every API
    below wants the Maestro instance id instead. Passing the route id meant the
    task lookup found nothing ("No open SubmitMedicalEvidence task found for
    this case") and, worse, that the event row was written with a CaseId the
    trigger's `CaseId == metadata.InstanceId` filter could never match. The
    upload would have completed and fired nothing.
  */
  const instanceId = claim?.instanceId || "";

  const host: TaskHost = useMemo(
    () => ({
      // Seeded from the case on screen, not from the form's own defaults.
      // Those defaults describe CLAIM-5182, so opening any other case's task
      // rendered Joseph Thompson's claim under that case's URL — the wrong
      // claimant, the wrong injury, the wrong money, with nothing to say so.
      load: async () => ({
        data: {
          ...defaultFormData,
          actionType,
          claimReference: claim?.id ?? "",
          claimantName: claim?.customer ?? "",
          incidentLocation: claim?.site ?? "",
          estimatedCost: claim?.claimValue ?? 0,
        } as Partial<FormData>,
        isReadOnly: false,
        isDark: false,
      }),
      save: () => {
        /* The console keeps no draft; the case is the record. */
      },
      complete: async (outcome: string, data: FormData) => {
        if (!sdk || !isAuthenticated) return { success: false };
        // Evidence submission is an event first and a task completion second:
        // the row is what the Case Manager Agent is listening for. Write it
        // before completing, so the agent never sees the task close without it.
        if (actionType === "SubmitMedicalEvidence") {
          const event = await writeCaseEvent(sdk, instanceId, {
            eventType: "DocumentUpload",
            comment: data.decisionRationale,
            documentName: data.uploadedDocumentName,
          });
          if (!event.written) {
            return {
              success: false,
              errorCode: "EVENT_WRITE_FAILED",
              errorMessage: event.reason ?? "The case event could not be recorded.",
            } as { success: boolean };
          }
        }
        /*
          The route's taskId is the Orchestrator task id whenever the screen was
          opened from a case's task list, which is every path the demo takes.
          Completing that id directly removes the guess: searching by instance
          and actionType kept failing with "No open SubmitMedicalEvidence task
          found for this case" on a case that plainly had one, because Action
          Center does not reliably carry the dispatch code the search matches on.
          The named routes (coverage-decision, settlement-authorisation) have no
          id to use, so they keep the search.
        */
        const numericTaskId = Number(taskId);
        if (Number.isInteger(numericTaskId) && numericTaskId > 0) {
          await completeTaskById(
            sdk,
            numericTaskId,
            outcome,
            data as unknown as Record<string, unknown>,
          );
        } else {
          await completeTask(
            sdk,
            instanceId,
            actionType,
            outcome,
            data as unknown as Record<string, unknown>,
          );
        }
        /*
          Everything above this line wrote to the tenant. None of it wrote to
          the case on screen, so whether Dana could still see she had submitted
          came down to an Orchestrator poll surviving a dedupe keyed on an
          actionType that Action Center usually does not send. It often did not
          survive, and the submission vanished off the case page.

          So record it locally too, the way every other decision surface in this
          app already does. The case is then the record whatever the tenant says
          next, and the two agree once the poll catches up.
        */
        const decided = caseActions.find((a) => a.status === "Open") ?? caseActions[0];
        if (decided) {
          recordDecision(decided, outcome, profile.name, data.decisionRationale ?? "");
        }
        if (claim && data.uploadedDocumentName) {
          addCaseEvidence(claim, [
            {
              id: `up-${data.uploadedDocumentName}`,
              kind: "pdf",
              title: data.uploadedDocumentName,
              verdict: "Submitted by the claims officer",
              addedAt: new Date().toISOString(),
              addedBy: profile.name,
              isNew: true,
              helpful: null,
            },
          ]);
        }
        return { success: true };
      },
    }),
    [sdk, isAuthenticated, instanceId, actionType, taskId, claim, caseActions, profile.name],
  );

  const onInitTheme = useCallback((isDark: boolean) => setDark(isDark), []);
  const onToggleTheme = useCallback(() => setDark((d) => !d), []);

  /*
    A task opened from a case is still inside that case, and the shell's left
    nav says so by keeping Cases lit. On its own that reads as a dead end: the
    page is plainly a task, and nothing on it says which case it belongs to or
    how to get back. This bar is that answer — the case, its claimant, and one
    way back — so the nav highlight stops being a contradiction.
  */
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-muted/50 px-4 py-2.5 text-sm">
        <Link
          to="/cases/$caseId"
          params={{ caseId }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          <ChevronLeft className="size-4 text-muted-foreground" />
          Back to case
        </Link>
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="font-semibold text-foreground">{caseId}</span>
          {claim?.customer && (
            <span className="truncate text-muted-foreground">{claim.customer}</span>
          )}
        </span>
        {claim?.currentStage && (
          <span className="hidden truncate text-xs text-muted-foreground sm:inline">
            {claim.currentStage}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <DecisionForm
          host={host}
          darkTheme={dark}
          onInitTheme={onInitTheme}
          onToggleTheme={onToggleTheme}
        />
      </div>
    </div>
  );
}
