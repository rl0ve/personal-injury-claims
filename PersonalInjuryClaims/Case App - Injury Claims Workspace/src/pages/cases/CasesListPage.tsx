import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Copy, Layers, Radio, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/PageContainer";
import { MetricTile } from "@/components/dashboard/MetricTile";
import { HomepageGreeting, HomepageSplash } from "@/components/claims/HomepageSplash";
import { NewCaseDialog } from "@/components/claims/NewCaseDialog";
import {
  CaseStatusBadge,
  IllustrativeTag,
  PriorityBadge,
  QueueReasonPill,
  SlaBadge,
} from "@/components/claims/badges";
import { liveLinksAllowed, useFlags } from "@/lib/flags";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/claims/format";
import { useAgentSummary, useCases, useInsights } from "@/lib/claims/useCases";
import { useRole } from "@/lib/role/useRole";
import { buildSdkConfig, isUiPathConfigured } from "@/services/uipath/config";
import { useUiPath } from "@/services/uipath/UiPathProvider";
import type { InjuryClaim } from "@/lib/claims/types";

// The work queue.
//
// The queue holds only the cases where a person can change the outcome, and each
// one says why it is there. That "why it's here" column is the whole point of
// the screen, so it is never truncated away on narrower viewports.

type QueueTab = "action" | "waiting" | "all";

function tabOf(claim: InjuryClaim): QueueTab {
  if (claim.status === "Action required") return "action";
  if (claim.status === "Waiting on others") return "waiting";
  return "all";
}

function CaseRow({ claim }: { claim: InjuryClaim }) {
  return (
    <tr className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40">
      <td className="py-3 pl-4 pr-3 align-top">
        <Link
          to="/cases/$caseId"
          params={{ caseId: claim.id }}
          className="block min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span className="flex items-center gap-1.5">
            <span className="font-medium text-primary hover:underline">{claim.id}</span>
            {claim.isLive && (
              <span
                title="Running on the tenant right now"
                aria-label="Running on the tenant right now"
                className="mt-px h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
              />
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {claim.customer}
          </span>
        </Link>
      </td>
      <td className="px-3 py-3 align-top">
        <span className="block text-sm">{claim.description}</span>
        <span className="block text-xs text-muted-foreground">{claim.currentStage}</span>
      </td>
      <td className="px-3 py-3 align-top">
        <span className="block text-sm">{claim.owner}</span>
        <span className="block text-xs text-muted-foreground">{claim.ownerRole}</span>
      </td>
      <td className="px-3 py-3 align-top">
        {claim.queueReason ? (
          <QueueReasonPill reason={claim.queueReason} />
        ) : (
          <span className="text-sm text-muted-foreground">
            {claim.activeLanes[0] ?? "Progressing on its own"}
          </span>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex flex-wrap items-center gap-1.5">
          <CaseStatusBadge status={claim.status} />
          <PriorityBadge priority={claim.priority} />
        </div>
      </td>
      <td className="py-3 pl-3 pr-4 align-top text-right">
        <SlaBadge status={claim.slaStatus} />
        <span className="mt-1 block text-xs text-muted-foreground">
          {relativeTime(claim.lastUpdatedAt)}
        </span>
      </td>
    </tr>
  );
}

/** Shows the redirect URI this build sends, with one click to copy it. */
function RedirectUriHint() {
  const [copied, setCopied] = useState(false);
  // Optional on the SDK config union (the secret-auth branch has none),
  // but always present on the OAuth branch this app uses.
  const uri = buildSdkConfig().redirectUri ?? "";

  return (
    <button
      type="button"
      title="Copy. This must match the External App registration exactly"
      onClick={() => {
        void navigator.clipboard?.writeText(uri).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="flex items-center gap-1 text-[10.5px] text-muted-foreground transition-colors hover:text-foreground"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      <span className="font-mono">{uri}</span>
    </button>
  );
}

/**
 * Where the rows came from, as one icon beside Refresh.
 *
 * This used to be a banner, which is the wrong weight for it: on a live queue
 * the sentence is true, unchanging, and read once, while the state behind it is
 * worth confirming at a glance every time the page is opened. So the state is
 * always visible and the sentence is one hover away.
 *
 * Three states, and the icon alone distinguishes them: demo (a warning, because
 * nothing on screen is real), overlay (layered, the default), and live.
 */
function SourceBadge({
  isDemo,
  isOverlay,
  reason,
  authError,
}: {
  isDemo: boolean;
  isOverlay: boolean;
  reason?: string;
  authError?: string | null;
}) {
  const { label, hint, icon: Icon, tone } = isDemo
    ? {
        label: "Demo data",
        hint: reason ?? "No live Maestro case instances were read.",
        icon: TriangleAlert,
        tone: "text-warning",
      }
    : isOverlay
      ? {
          label: "Overlay",
          hint: reason ?? "Demo cases, overlaid with live stage state, ids and tasks.",
          icon: Layers,
          tone: "text-muted-foreground",
        }
      : {
          label: "Live",
          hint: "Every row is a Maestro case instance.",
          icon: Radio,
          tone: "text-success",
        };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A button rather than a bare span so it is reachable by keyboard.
            the tooltip is the only place this explanation now lives. */}
        <button
          type="button"
          aria-label={`Data source: ${label}. ${hint}`}
          className="grid size-9 shrink-0 place-items-center rounded-md border border-border transition-colors hover:bg-muted"
        >
          <Icon className={cn("size-4", tone)} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-72">
        <span className="font-medium">{label}.</span> {hint}
        {authError && <span className="mt-1 block text-destructive">{authError}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

export function CasesListPage() {
  const { cases, isDemo, isOverlay, isLoading, reason, refresh } = useCases();
  const insights = useInsights();
  const summary = useAgentSummary(cases);
  const { profile } = useRole();
  const { isAuthenticated, isLoading: authLoading, login, error: authError } = useUiPath();
  const flags = useFlags();
  const { showHomepageSplash } = flags;

  const [tab, setTab] = useState<QueueTab>("action");
  const [search, setSearch] = useState("");
  const [mineOnly, setMineOnly] = useState(false);

  const counts = useMemo(
    () => ({
      action: cases.filter((c) => tabOf(c) === "action").length,
      waiting: cases.filter((c) => tabOf(c) === "waiting").length,
      all: cases.filter((c) => c.status !== "Closed").length,
    }),
    [cases],
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return cases
      .filter((c) => c.status !== "Closed")
      .filter((c) => (tab === "all" ? true : tabOf(c) === tab))
      .filter((c) => (mineOnly ? c.owner === profile.name : true))
      .filter((c) =>
        query
          ? [c.id, c.customer, c.site, c.description, c.owner, c.currentStage]
              .join(" ")
              .toLowerCase()
              .includes(query)
          : true,
      );
  }, [cases, tab, search, mineOnly, profile.name]);

  const TABS: { key: QueueTab; label: string; count: number }[] = [
    { key: "action", label: "Action required", count: counts.action },
    { key: "waiting", label: "Waiting on others", count: counts.waiting },
    { key: "all", label: "All open", count: counts.all },
  ];

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Work queue</h1>
            <p className="text-sm text-muted-foreground">
              {profile.name} · {profile.title}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* The data-source badge is hidden: this console is shown to
                external audiences, where a "Demo data" warning beside the
                queue reads as a defect rather than as provenance. The
                component is kept so it can be restored for internal use. */}
            {false && (
              <SourceBadge
                isDemo={isDemo}
                isOverlay={isOverlay}
                reason={reason}
                authError={authError}
              />
            )}
            <Button variant="outline" onClick={refresh} disabled={isLoading}>
              <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
              Refresh
            </Button>
            {/* Starting a case starts a real Orchestrator job, which has no
                meaning while the queue is the bundled dataset. */}
            {liveLinksAllowed(flags) && <NewCaseDialog onStarted={refresh} />}
          </div>
        </div>

        {/*
          Signing in is the one thing a person can do about the queue not being
          live, so it stays a button. Everything explanatory that used to sit in
          a banner here is now on the source badge beside Refresh. The state is
          worth glancing at every time, the sentence only occasionally.
        */}
        {isUiPathConfigured() && !isAuthenticated && (
          <Card className="flex-row flex-wrap items-center gap-3 border-dashed p-3">
            <div className="min-w-0 flex-1 text-sm">
              <span className="font-medium">Not signed in.</span>{" "}
              <span className="text-muted-foreground">
                The queue is the bundled dataset until you are.
              </span>
              {authError && <span className="block text-destructive">{authError}</span>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" onClick={() => void login()} disabled={authLoading}>
                {authLoading ? "Signing in…" : "Sign in to UiPath"}
              </Button>
              {/* The one value an "Invalid redirect_uri" failure turns on.
                  Identity compares it character for character against the
                  External App registration, so it is worth being able to read
                  and copy the exact string this build sends. */}
              <RedirectUriHint />
            </div>
          </Card>
        )}

        {/* With the brief off, the greeting carries the agent's account of the
            queue. It used to sit in its own card underneath, which put the
            agent mark on screen twice in a row. */}
        {showHomepageSplash ? (
          <HomepageSplash />
        ) : (
          <HomepageGreeting headline={summary.headline} />
        )}

        {/* The personal KPI row. Hidden when the brief is on: its trend tiles and
            pulse cards already answer "how are we doing", and two rows of
            headline numbers stacked on one screen is one row too many. */}
        {!showHomepageSplash && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="Avg. liability decision time"
              value={`${insights.avgCoverageDecisionDays} days`}
            />
            <MetricTile
              label="Rehabilitation commitment adherence"
              value={`${insights.restorationAdherence}%`}
              tone={insights.restorationAdherence < 80 ? "warning" : "success"}
            />
            <MetricTile
              label="Critical cases at SLA risk"
              value={insights.criticalAtRisk}
              sub={`▲ ${insights.criticalAtRiskDelta} since last week`}
              tone="destructive"
            />
            <MetricTile
              label="Recovery candidates"
              value={insights.repeatFailureCandidates}
              sub={insights.repeatFailureNote}
              tone="warning"
            />
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ButtonGroup>
              {TABS.map((t) => (
                <Button
                  key={t.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "font-normal text-muted-foreground",
                    tab === t.key &&
                      "bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary",
                  )}
                >
                  {t.label} · {t.count}
                </Button>
              ))}
            </ButtonGroup>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMineOnly((v) => !v)}
                className={cn(
                  "font-normal text-muted-foreground",
                  mineOnly &&
                    "bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary",
                )}
              >
                Assigned to me
              </Button>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search cases, names, stages…"
                  className="h-8 w-64 pl-9 text-sm"
                />
              </div>
            </div>
          </div>

          <Card className="gap-0 overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[62rem] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="w-56 py-2.5 pl-4 pr-3 font-medium">Case</th>
                    <th className="px-3 py-2.5 font-medium">Description</th>
                    <th className="w-48 px-3 py-2.5 font-medium">Owner</th>
                    <th className="w-64 px-3 py-2.5 font-medium">Why it&rsquo;s here</th>
                    <th className="w-44 px-3 py-2.5 font-medium">Status</th>
                    <th className="w-32 py-2.5 pl-3 pr-4 text-right font-medium">SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => (
                    <CaseRow key={c.id} claim={c} />
                  ))}
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No cases match this view.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* The greeting already says how many need a person out of how many
              open. Restating it here as a caption was the same fact a third
              time on one screen. */}
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <IllustrativeTag />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
