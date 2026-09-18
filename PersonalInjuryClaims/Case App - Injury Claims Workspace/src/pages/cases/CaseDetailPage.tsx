import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronLeft,
  ExternalLink,
  FlaskConical,
  Inbox,
  RefreshCw,
  RotateCcw,
  Upload,
} from "lucide-react";
import { AiMark } from "@/components/ui/ai-mark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageContainer } from "@/components/PageContainer";
import { AskAiPanel } from "@/components/claims/AskAiPanel";
import { CaseDetailSkeleton } from "@/components/claims/CaseSkeletons";
import { CaseTabs } from "@/components/claims/CaseTabs";
import { ReassessmentCard } from "@/components/claims/ReassessmentCard";
import { CaseStatusBadge, PriorityBadge, SlaBadge } from "@/components/claims/badges";
import { cn } from "@/lib/utils";
import { money } from "@/lib/claims/format";
import { formatRemaining, formatSlaBudget } from "@/lib/claims/sla";
import {
  acceptReassessment,
  fireEvidenceUploadEvent,
  hasEvidenceUploadFired,
  patchCase,
  resetDemoState,
  useActionsForCase,
  useCase,
  useCaseAutoRefresh,
} from "@/lib/claims/useCases";
import { liveLinksAllowed, useFlags } from "@/lib/flags";
import { useRole } from "@/lib/role/useRole";
import { maestroInstanceUrl } from "@/services/uipath/config";

/** "1 open task" or "3 open tasks", the same words wherever the button goes. */
function taskLabel(count: number): string {
  return `${count} open ${count === 1 ? "task" : "tasks"}`;
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs font-light text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{children}</span>
    </div>
  );
}

export function CaseDetailPage() {
  const { caseId } = useParams({ strict: false }) as { caseId: string };
  const { claim, isLoading, isRefreshing, refresh } = useCase(caseId);
  const actions = useActionsForCase(caseId ?? "");
  const { profile } = useRole();
  const flags = useFlags();
  // Drives the upload item's done state, so a second click reads as spent
  // rather than as a button that stopped working.
  const uploadFired = Boolean(claim && hasEvidenceUploadFired(claim));

  // An open case is still being moved by the process, so it re-reads itself
  // every ten seconds for as long as this page is on screen.
  useCaseAutoRefresh(claim);

  const [tab, setTab] = useState("overview");
  // Open the panel automatically only where there is room alongside the case
  // content; on narrower screens it stays closed until invoked.
  const [chatOpen, setChatOpen] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1620,
  );

  // Undefined while loading is not the same as absent. Landing here by URL,
  // from a refresh or a pasted link, starts with an empty store, and calling that a
  // missing case put a 404 on screen for a case that was seconds from arriving.
  if (isLoading && !claim) return <CaseDetailSkeleton />;

  if (!claim) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-3">
          <Link
            to="/cases"
            className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" /> Work queue
          </Link>
          <p className="text-sm text-muted-foreground">Case {caseId} not found.</p>
        </div>
      </PageContainer>
    );
  }

  const openActions = actions.filter((a) => a.status === "Open");
  const primaryAction = openActions[0];
  // Demo rows carry no instance id, so this is already null for them. The flag
  // check is the explicit half of the same rule: under demo data nothing links
  // out, because there is nothing on the other end.
  const instanceUrl = liveLinksAllowed(flags)
    ? maestroInstanceUrl(claim.instanceId, claim.folderKey)
    : null;
  // Inline editing on the Details tab belongs to whoever owns the case.
  const editable = profile.name === claim.owner;

  return (
    <div className="flex h-full min-h-0">
      {/*
        A container, so the tab layouts below react to this column's width
        rather than the window's. With the Ask panel open the column is 380px
        narrower while `lg:` still reads the viewport as wide, which is how a
        two-column Overview ended up 958px of content in 632px of room, cut off
        under the panel and only reachable by scrolling sideways.
      */}
      <div className="@container min-w-0 flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/cases"
              className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-4" /> Work queue
            </Link>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={isRefreshing}
                title="Refresh this case"
              >
                <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
                Refresh
              </Button>
              {/*
                The only link out to the run, and deliberately quiet: a ghost
                button beside Refresh rather than a second call to action next
                to the case's own work. It appears only when the case on screen
                is backed by a real instance, so its presence is itself the
                signal that this one is live.
              */}
              {instanceUrl && (
                <Button variant="ghost" size="sm" asChild title="Open this case run in Maestro">
                  <a
                    href={instanceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground"
                  >
                    Open in Maestro
                    <ExternalLink className="size-3.5" />
                  </a>
                </Button>
              )}
              {!chatOpen && (
                <Button variant="ai" onClick={() => setChatOpen(true)}>
                  <AiMark className="size-4" />
                  Ask AI
                </Button>
              )}
            </div>
          </div>

          {/* Hero header */}
          <Card className="gap-0 p-0">
            <div className="flex flex-wrap items-start gap-x-10 gap-y-4 p-6">
              <div className="mr-auto min-w-0">
                <h1 className="text-2xl font-bold tracking-tight">{claim.customer}</h1>
                <div className="text-xs text-muted-foreground">
                  {claim.id} · {claim.site}
                </div>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  {claim.description}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                  <span>
                    <span className="font-semibold text-foreground">Policy</span>{" "}
                    {claim.asset.model} · No. {claim.asset.serial}
                  </span>
                  <span aria-hidden>·</span>
                  <span>
                    <span className="font-semibold text-foreground">Claim value</span>{" "}
                    {money(claim.claimValue)}
                  </span>
                  <span aria-hidden>·</span>
                  <span>
                    <span className="font-semibold text-foreground">Owner</span> {claim.owner}
                  </span>
                </div>
              </div>
              <Meta label="Status">
                <CaseStatusBadge status={claim.status} />
              </Meta>
              <Meta label="Priority">
                <PriorityBadge priority={claim.priority} />
              </Meta>
              <Meta label="Stage">{claim.currentStage}</Meta>
              <Meta label={formatSlaBudget(claim.slaMinutes)}>
                <span className="flex items-center gap-2">
                  <SlaBadge status={claim.slaStatus} />
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">
                    {formatRemaining(claim.elapsedMinutes, claim.slaMinutes)}
                  </span>
                </span>
              </Meta>

              <div className="flex w-full flex-wrap items-center gap-2">
                {/*
                  One button, and only its destination is a setting.
                  It reads the same either way, since the count is what a reader
                  scans for, so the label does not shift under someone who has
                  learned where it is. `useActions` sends it to the queue;
                  without it, it opens the decision directly, which is the
                  shorter path from a case already in front of you.
                */}
                {openActions.length > 0 && (
                  <Button asChild>
                    {flags.useActions || !primaryAction ? (
                      <Link to="/actions" search={{ case: claim.id }}>
                        <Inbox className="size-4" />
                        {taskLabel(openActions.length)}
                      </Link>
                    ) : (
                      <Link
                        to="/cases/$caseId/tasks/$taskId"
                        params={{ caseId: claim.id, taskId: primaryAction.id }}
                      >
                        <Inbox className="size-4" />
                        {taskLabel(openActions.length)}
                      </Link>
                    )}
                  </Button>
                )}
                {/*
                  One link out to the run, and only when there is a run to open.
                  instanceUrl is already null for storyboard rows and whenever
                  live links are off, so this appears exactly when the case on
                  screen is backed by a real Maestro instance — no duplicate
                  links per row, per task or per stage.
                */}

                {/*
                  Manual actions: a presenter's controls, deliberately one step
                  back from the case's own buttons.
                     Everything else in this row is work: decide the action, open
                  the queue. These stand in for events the platform would deliver
                  on its own. A real deployment fires the configured webhook and
                  the event arrives, so they belong behind a menu that says as
                  much, rather than sitting at the same weight as "Decide" and
                  inviting a click mid-demo.
                */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    {/* Pushed to the end of the row: same area, last in line. */}
                    <Button variant="outline" className="ml-auto">
                      <FlaskConical className="size-4" />
                      Manual actions
                      <ChevronDown className="size-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="start" className="w-80">
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                      Fired by hand, in place of the real event
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onSelect={() => fireEvidenceUploadEvent(claim)}
                      disabled={uploadFired}
                      className="flex items-start gap-2 py-2"
                    >
                      <Upload className="mt-0.5 size-4 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">Claimant evidence upload</span>
                        <span className="block text-xs leading-snug text-muted-foreground">
                          {uploadFired
                            ? "Already arrived on this case."
                            : "New medical records land mid-case and wake the case agent."}
                        </span>
                      </span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onSelect={resetDemoState}
                      className="flex items-start gap-2 py-2"
                    >
                      <RotateCcw className="mt-0.5 size-4 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">Reset session state</span>
                        <span className="block text-xs leading-snug text-muted-foreground">
                          Clears every decision and event taken since the page loaded.
                        </span>
                      </span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </Card>

          {claim.reassessment && (
            <ReassessmentCard
              reassessment={claim.reassessment}
              acceptLabel="Route to condition-deterioration re-assessment"
              onAccept={() => acceptReassessment(claim, "Condition Deterioration & Re-assessment")}
              onOverride={() => acceptReassessment(claim, claim.currentStage)}
            />
          )}

          <CaseTabs
            claim={claim}
            actions={actions}
            tab={tab}
            onTabChange={setTab}
            variant="page"
            editable={editable}
            onSaveCase={(patch) => patchCase(claim.id, patch)}
          />
        </div>
      </div>

      {chatOpen && <AskAiPanel claim={claim} onClose={() => setChatOpen(false)} />}
    </div>
  );
}
