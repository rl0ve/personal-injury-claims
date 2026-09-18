import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, ListChecks } from "lucide-react";
import { AiMark } from "@/components/ui/ai-mark";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { caseProgressFacts, caseProgressSummary } from "@/lib/claims/caseSummary";
import { cn } from "@/lib/utils";
import { WidgetHeader } from "@/components/claims/WidgetHeader";
import { ActivityDateFilter, ActivityFeed, ActivityFilters } from "@/components/claims/ActivityFeed";
import { CaseDetailsTab } from "@/components/claims/CaseDetailsTab";
import { CaseDocumentsTab, CaseDocumentsWidget } from "@/components/claims/CaseDocuments";
import { ExecutionTrail } from "@/components/claims/ExecutionTrail";
import { SlaPanel } from "@/components/claims/SlaPanel";
import { StageProgress } from "@/components/claims/StageProgress";
import { StagesSummary } from "@/components/claims/StagesSummary";
import { CaseStageBoard } from "@/components/claims/CaseStageBoard";
import { ConfidenceBadge } from "@/components/claims/badges";
import {
  filterActivityByRange,
  matchesActivityFilter,
  type ActivityFilterKey,
  type ActivityRange,
} from "@/lib/claims/activity";
import { initialsOf, outcomeLabel, relativeTime } from "@/lib/claims/format";
import { formatRemaining } from "@/lib/claims/sla";
import { addCaseComment, useCaseActivity } from "@/lib/claims/useCases";
import { useRole } from "@/lib/role/useRole";
import type { CaseAction, InjuryClaim } from "@/lib/claims/types";

const TAB_TRIGGER =
  "rounded-none border-0 border-b-2 border-transparent px-0 pb-2.5 font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none";

/**
 * An open decision, as a card. "Open task" goes straight to the decision, which is
 * the primary of the two because it is what the card is asking you to do.
 */
function OpenActionCard({ action }: { action: CaseAction }) {
  const remaining = formatRemaining(action.elapsedMinutes, action.slaMinutes);
  const overdue = action.elapsedMinutes >= action.slaMinutes;
  const atRisk = !overdue && action.elapsedMinutes / action.slaMinutes >= 0.75;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/15">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{action.title}</span>
          {action.blocking && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Pending
            </span>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 text-xs font-medium tabular-nums",
            overdue ? "text-destructive" : atRisk ? "text-warning" : "text-muted-foreground",
          )}
        >
          {remaining}
        </span>
      </div>

      <p className="text-sm text-muted-foreground">{action.whyThisReachedYou}</p>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Assigned to</span> {action.assignee} ·{" "}
          {action.stage}
        </span>
        {/*
          One button. There used to be two, and the pair invited the question
          of how they differed: "Open in queue" went to the task list with this
          one selected, "Open task" went to the task itself. From a card that is
          already the task, a list of tasks is a detour.
        */}
        <Button size="sm" asChild>
          <Link
            to="/cases/$caseId/tasks/$taskId"
            params={{ caseId: action.caseId, taskId: action.id }}
          >
            Open task
          </Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * A decided action. The whole card reopens the console, because the settled
 * state is where the recorded effects, the signed rationale and "Reopen task"
 * live. Without this link a submitted decision would be unreachable.
 */
function CompletedActionCard({ action }: { action: CaseAction }) {
  return (
    <Link
      to="/cases/$caseId/tasks/$taskId"
      params={{ caseId: action.caseId, taskId: action.id }}
      className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/15 hover:bg-muted/30"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="text-sm font-medium">{action.title}</span>
        {action.completedAt && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {relativeTime(action.completedAt)}
          </span>
        )}
      </div>
      <span className="text-sm">
        <span className="font-medium">{outcomeLabel(action.completedOutcome ?? "")}</span>
        <span className="text-muted-foreground"> · {action.completedBy}</span>
      </span>
      {action.rationale && (
        <p className="line-clamp-3 text-sm text-muted-foreground">{action.rationale}</p>
      )}
    </Link>
  );
}

/**
 * The case tab set (Overview / Details / Actions / Stages / SLAs / Documents /
 * Activity / Trail / Comments) shared by the case detail page and the Actions
 * page's right rail.
 *
 * - `variant="page"` → wide two-column layouts.
 * - `variant="rail"` → single column, compact, and the tabs that duplicate the
 *   surrounding screen (Actions, Stages, SLAs) are dropped.
 */
export function CaseTabs({
  claim,
  actions,
  tab,
  onTabChange,
  variant = "page",
  editable = false,
  onSaveCase,
}: {
  claim: InjuryClaim;
  actions: CaseAction[];
  tab: string;
  onTabChange: (value: string) => void;
  variant?: "page" | "rail";
  editable?: boolean;
  onSaveCase?: (patch: Partial<InjuryClaim>) => void;
}) {
  const rail = variant === "rail";
  const { profile } = useRole();

  const [filter, setFilter] = useState<ActivityFilterKey>("all");
  const [range, setRange] = useState<ActivityRange>({ preset: "all" });
  const [draft, setDraft] = useState("");

  const activity = useCaseActivity(claim);
  const filtered = filter === "all" ? activity : activity.filter((a) => matchesActivityFilter(a, filter));

  const openActions = actions
    .filter((a) => a.status === "Open")
    .sort((a, b) => b.elapsedMinutes / b.slaMinutes - a.elapsedMinutes / a.slaMinutes);
  const completedActions = actions.filter((a) => a.status === "Completed");

  function addComment() {
    const text = draft.trim();
    if (!text) return;
    addCaseComment(claim, {
      author: profile.name,
      role: profile.title,
      time: new Date().toISOString(),
      text,
    });
    setDraft("");
  }

  // What Dana submitted, newest first, for the Overview line below. Without it
  // the only record of her submission sat behind the Tasks tab, which is not
  // the tab the case opens on and carries no badge once nothing is open — so
  // she submitted evidence and the case looked like she had never been there.
  const lastCompleted = [...completedActions].sort((a, b) =>
    (b.completedAt ?? "").localeCompare(a.completedAt ?? ""),
  )[0];

  const actionList =
    openActions.length === 0 ? (
      lastCompleted ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm">
            You submitted <span className="font-medium">{lastCompleted.title}</span>
            {lastCompleted.completedOutcome ? ` — ${lastCompleted.completedOutcome}` : ""}.
          </p>
          <p className="text-xs text-muted-foreground">
            {lastCompleted.completedBy ? `${lastCompleted.completedBy} · ` : ""}
            {lastCompleted.completedAt
              ? new Date(lastCompleted.completedAt).toLocaleString()
              : "just now"}
            . Nothing else on this case is waiting on a person.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nothing on this case is waiting on a person.
        </p>
      )
    ) : (
      <div className="flex flex-col gap-3">
        {openActions.map((action) => (
          <OpenActionCard key={action.id} action={action} />
        ))}
      </div>
    );

  return (
    <Tabs
      value={tab}
      onValueChange={onTabChange}
      className={rail ? "flex min-h-0 flex-1 flex-col gap-0" : "gap-6"}
    >
      <TabsList
        className={cn(
          // Nine tabs that will not wrap need ~694px. Scrolling them inside
          // their own strip keeps that off the page: without this the whole
          // case scrolled sideways to reach "Comments", taking the cards with
          // it. The rail variant already did exactly this.
          "h-auto max-w-full justify-start overflow-x-auto rounded-none border-b border-border bg-transparent",
          rail ? "gap-4 px-4 pb-0 pt-3" : "gap-6 p-0",
        )}
      >
        <TabsTrigger value="overview" className={cn(TAB_TRIGGER, rail && "text-xs")}>
          Overview
        </TabsTrigger>
        <TabsTrigger value="details" className={cn(TAB_TRIGGER, rail && "text-xs")}>
          Details
        </TabsTrigger>
        {/* Redundant inside the Actions rail, where you are already looking at the
            action, the stage board, and the queue's own SLA figures. */}
        {!rail && (
          <TabsTrigger value="actions" className={TAB_TRIGGER}>
            Tasks{openActions.length > 0 && ` · ${openActions.length}`}
          </TabsTrigger>
        )}
        {!rail && (
          <TabsTrigger value="stages" className={TAB_TRIGGER}>
            Stages
          </TabsTrigger>
        )}
        {!rail && (
          <TabsTrigger value="sla" className={TAB_TRIGGER}>
            SLAs
          </TabsTrigger>
        )}
        <TabsTrigger value="documents" className={cn(TAB_TRIGGER, rail && "text-xs")}>
          Documents{claim.evidence.length > 0 && ` · ${claim.evidence.length}`}
        </TabsTrigger>
        <TabsTrigger value="activity" className={cn(TAB_TRIGGER, rail && "text-xs")}>
          Activity
        </TabsTrigger>
        <TabsTrigger value="trail" className={cn(TAB_TRIGGER, rail && "text-xs")}>
          Trail
        </TabsTrigger>
        <TabsTrigger value="comments" className={cn(TAB_TRIGGER, rail && "text-xs")}>
          Comments{claim.comments.length > 0 && ` · ${claim.comments.length}`}
        </TabsTrigger>
      </TabsList>

      <div className={rail ? "min-h-0 flex-1 overflow-y-auto p-4" : "contents"}>
        {/* ── Overview ───────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-0 flex flex-col gap-4">
          <StageProgress claim={claim} compact={rail} />

          <div
            className={
              rail
                ? "flex flex-col gap-4"
                : "grid gap-4 @min-[820px]:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]"
            }
          >
            <div className={cn("flex flex-col gap-4", !rail && "self-start @min-[820px]:order-2")}>
              {/* The case agent's account of where this case stands. */}
              <Card className="gap-4 p-5">
                <WidgetHeader
                  icon={
                    <span className="grid size-6 place-items-center rounded-full text-white [background-image:var(--ai-gradient)]">
                      <AiMark className="size-3.5" />
                    </span>
                  }
                  title="Summary"
                >
                  <span className="text-xs font-normal text-muted-foreground">AI generated</span>
                </WidgetHeader>
                {/* Progress, not the open decision. The Action needed card
                    beside this one states what is owed and why it reached a
                    person; both used to say it, which made the pair read as one
                    thing printed twice. */}
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {caseProgressSummary(claim)}
                </p>
                <div className="flex flex-col gap-2 pt-1">
                  <span className="text-sm font-semibold">Where it stands</span>
                  <ul className="flex flex-col gap-2">
                    {caseProgressFacts(claim).map((fact) => (
                      <li key={fact.label} className="flex gap-2 text-sm">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                        <span className="text-muted-foreground">
                          <span className="font-medium text-foreground">{fact.label}:</span>{" "}
                          {fact.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>

              {!rail && (
                <CaseDocumentsWidget
                  claim={claim}
                  onOpen={() => onTabChange("documents")}
                />
              )}

              {rail && (
                <Card className="gap-3 p-4">
                  <WidgetHeader
                    icon={<Activity className="size-4 text-muted-foreground" />}
                    title="Recent activity"
                    onOpen={() => onTabChange("activity")}
                  />
                  <ActivityFeed items={filtered.slice(0, 5)} />
                </Card>
              )}
            </div>

            {/* In the rail the surrounding screen already covers actions, so the
                Overview there is just the summary and recent activity. */}
            {!rail && (
              <div className="flex flex-col gap-4 @min-[820px]:order-1">
                {/* First, because it is the only thing here that is asking for
                    something. The clocks and the stage board describe where the
                    case stands; this is what a person has to do about it. */}
                <Card className="gap-4 p-5">
                  <WidgetHeader
                    icon={<ListChecks className="size-4 text-muted-foreground" />}
                    title="Action needed"
                    onOpen={() => onTabChange("actions")}
                  >
                    {openActions[0] && (
                      <ConfidenceBadge confidence={openActions[0].recommendation.confidence} />
                    )}
                  </WidgetHeader>
                  {actionList}
                </Card>

                <SlaPanel
                  claim={claim}
                  actions={actions}
                  variant="summary"
                  onOpen={() => onTabChange("sla")}
                />

                <StagesSummary
                  claim={claim}
                  actions={actions}
                  onOpen={() => onTabChange("stages")}
                />

                <Card className="gap-4 p-5">
                  <WidgetHeader
                    icon={<Activity className="size-4 text-muted-foreground" />}
                    title="Recent activity"
                    onOpen={() => onTabChange("activity")}
                  >
                    <ActivityFilters
                      value={filter}
                      onChange={setFilter}
                      mode={claim.caseManagerMode}
                    />
                  </WidgetHeader>
                  <ActivityFeed items={filtered.slice(0, 8)} />
                </Card>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Details ────────────────────────────────────────────────────── */}
        <TabsContent value="details" className="mt-0">
          <CaseDetailsTab
            claim={claim}
            editable={editable && !rail}
            onSave={onSaveCase}
            rail={rail}
          />
        </TabsContent>

        {/* ── Actions ────────────────────────────────────────────────────── */}
        {!rail && (
          <TabsContent value="actions" className="mt-0 flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <span className="text-base font-semibold">Open ({openActions.length})</span>
              {actionList}
            </div>
            {completedActions.length > 0 && (
              <div className="flex flex-col gap-3">
                <span className="text-base font-semibold">
                  Completed ({completedActions.length})
                </span>
                <div className="flex flex-col gap-3">
                  {completedActions.map((action) => (
                    <CompletedActionCard key={action.id} action={action} />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        )}

        {/* ── Stages ─────────────────────────────────────────────────────── */}
        {!rail && (
          <TabsContent value="stages" className="mt-0">
            <CaseStageBoard claim={claim} actions={actions} />
          </TabsContent>
        )}

        {/* ── SLAs ───────────────────────────────────────────────────────── */}
        {!rail && (
          <TabsContent value="sla" className="mt-0">
            <SlaPanel claim={claim} actions={actions} variant="full" />
          </TabsContent>
        )}

        {/* ── Documents ──────────────────────────────────────────────────── */}
        <TabsContent value="documents" className="mt-0">
          <CaseDocumentsTab claim={claim} />
        </TabsContent>

        {/* ── Activity ───────────────────────────────────────────────────── */}
        <TabsContent value="activity" className="mt-0">
          <Card className="gap-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-base font-semibold">Activity</span>
              <ActivityDateFilter value={range} onChange={setRange} />
            </div>
            <ActivityFilters
              value={filter}
              onChange={setFilter}
              mode={claim.caseManagerMode}
            />
            <ActivityFeed items={filterActivityByRange(filtered, range)} />
          </Card>
        </TabsContent>

        {/* ── Execution trail ────────────────────────────────────────────── */}
        <TabsContent value="trail" className="mt-0 flex flex-col gap-3">
          {!rail && (
            <p className="max-w-3xl text-sm text-muted-foreground">
              What triggered each decision, the action the case agent selected, and who signed off.
              Activity is the business history; this is the execution record behind it.
            </p>
          )}
          <ExecutionTrail entries={claim.trail} />
        </TabsContent>

        {/* ── Comments ───────────────────────────────────────────────────── */}
        <TabsContent value="comments" className="mt-0">
          <Card className="gap-4 p-5">
            <span className="text-base font-semibold">Comments</span>
            <div className="flex flex-col gap-5">
              {claim.comments.length === 0 && (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              )}
              {claim.comments.map((comment, i) => (
                <div key={i} className="flex gap-3">
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback className="text-xs">
                      {initialsOf(comment.author)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-medium">{comment.author}</span>
                      {comment.role && (
                        <span className="text-xs text-muted-foreground">{comment.role}</span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {relativeTime(comment.time)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{comment.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t border-border pt-4">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addComment()}
                placeholder="Add a comment…"
                className="flex-1"
              />
              <Button onClick={addComment} disabled={!draft.trim()}>
                Comment
              </Button>
            </div>
          </Card>
        </TabsContent>
      </div>
    </Tabs>
  );
}
