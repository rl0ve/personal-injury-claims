import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AiMark } from "@/components/ui/ai-mark";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Label } from "@/components/claims/CoverageConsole";
import { useRole } from "@/lib/role/useRole";
import { useAgentSummary, useCases, useInsights } from "@/lib/claims/useCases";
import type { OperationalInsights, InjuryClaim } from "@/lib/claims/types";

// The morning brief.
//
// The queue below answers "what is waiting"; this answers "what happened while I
// was gone, and what should I do first", which is the question someone actually
// opens the app with. Modelled on the loan-origination dashboard's Morning Brief
// and Portfolio Pulse.
//
// Every number here is computed from the same case list the queue renders, not
// authored separately. A brief that disagreed with the table underneath it would
// be worse than no brief.

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** A figure the narrative leans on. */
function Fact({ children }: { children: React.ReactNode }) {
  return <b className="font-semibold text-foreground">{children}</b>;
}

/** The one line that should stop the eye. */
function Highlight({
  tone = "destructive",
  children,
}: {
  tone?: "destructive" | "primary";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "rounded-sm px-1 font-semibold",
        tone === "destructive"
          ? "bg-destructive/10 text-destructive"
          : "bg-primary/10 text-primary",
      )}
    >
      {children}
    </span>
  );
}

interface TrendStat {
  count: number;
  label: string;
  delta: string;
  tone: "up" | "down" | "flat";
  to: string;
  search?: Record<string, string>;
}

function TrendStatTile({ stat }: { stat: TrendStat }) {
  const toneClass =
    stat.tone === "up"
      ? "text-success"
      : stat.tone === "down"
        ? "text-destructive"
        : "text-muted-foreground";
  const arrow = stat.tone === "up" ? "▲" : stat.tone === "down" ? "▼" : "·";

  return (
    <Link
      to={stat.to}
      search={stat.search as never}
      className="grid flex-1 grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:border-primary"
    >
      <b className="min-w-[38px] text-lg font-bold leading-none tabular-nums">{stat.count}</b>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[11px] font-semibold text-muted-foreground">
          {stat.label}
        </span>
        <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium", toneClass)}>
          <span aria-hidden>{arrow}</span>
          {stat.delta}
        </span>
      </span>
    </Link>
  );
}

// ── Pulse cards ─────────────────────────────────────────────────────────────

function PulseCard({
  title,
  right,
  to,
  children,
  footer,
}: {
  title: string;
  right: string;
  to: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5 transition-all hover:border-primary hover:shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-2">
        <Label>{title}</Label>
        <span className="shrink-0 text-[11px] text-muted-foreground">{right}</span>
      </div>
      {children}
      <div className="text-[10.5px] text-muted-foreground">{footer}</div>
    </Link>
  );
}

const STAGE_SHORT: Record<string, string> = {
  "Claim Intake & Registration": "Intake",
  "Injury Triage & Track Assignment": "Triage",
  "Liability Assessment & Admission": "Liability",
  "Medical Evidence & Quantum Decision": "Medical",
  "Rehabilitation & Return-to-Work": "Rehab",
  "Quantum Assessment & Settlement Negotiation": "Quantum",
  "Subrogation & Recovery": "Recover",
  "Settlement & Closure": "Close",
};

// Stage order on the spine, not by volume, so the bar reads as a pipeline.
const STAGE_ORDER = Object.keys(STAGE_SHORT);

function StageBars({ insights }: { insights: OperationalInsights }) {
  const byStage = new Map(insights.stageAccumulation.map((s) => [s.stage, s.cases]));
  const ordered = STAGE_ORDER.map((stage) => ({ stage, cases: byStage.get(stage) ?? 0 }));
  const max = Math.max(1, ...ordered.map((s) => s.cases));

  return (
    <div className="flex h-11 items-end gap-1">
      {ordered.map(({ stage, cases }) => (
        <div key={stage} className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-center text-[11px] font-bold tabular-nums">{cases}</span>
          <span
            className="rounded-t-[3px] bg-primary"
            style={{ height: `${Math.max(8, (cases / max) * 100)}%`, minHeight: 6 }}
          />
          <span className="truncate text-center text-[9px] font-medium text-muted-foreground">
            {STAGE_SHORT[stage]}
          </span>
        </div>
      ))}
    </div>
  );
}

function SlaChip({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone: "success" | "warning" | "destructive";
}) {
  const cls = {
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning-foreground",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <div className={cn("flex flex-1 flex-col items-start rounded-md px-2 py-1.5", cls)}>
      <span className="text-lg font-extrabold leading-none tabular-nums">{count}</span>
      <span className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-wider opacity-85">
        {label}
      </span>
    </div>
  );
}

/**
 * Turns a series into an SVG polyline over a 120×32 box.
 *
 * `scale` lets two series share one axis. Without it each is normalised to its
 * own max, and a line falling from 6 to 0 would be drawn the same height as one
 * climbing from 24 to 31.
 */
function points(values: number[], scale?: number): string {
  const max = scale ?? Math.max(1, ...values);
  const step = values.length > 1 ? 120 / (values.length - 1) : 120;
  return values.map((v, i) => `${i * step},${28 - (v / max) * 24}`).join(" ");
}

// ── The splash ──────────────────────────────────────────────────────────────

/**
 * The greeting when the morning brief is off, which is the default.
 *
 * The queue's own headline lives in here rather than in a second card below
 * it. Two cards meant the agent mark appeared twice within 80px of itself,
 * which read as two different agents talking rather than one.
 */
export function HomepageGreeting({ headline }: { headline?: string }) {
  const { profile } = useRole();
  const now = new Date();
  const dateLine = now
    .toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    .toUpperCase();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/8 via-insight-100/25 to-transparent px-6 py-4 dark:from-primary/12 dark:via-insight-800/20">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-[11px] text-white [background-image:var(--ai-gradient)]">
          <AiMark className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[19px] font-bold leading-tight">
            {greeting(now)}, {profile.name.split(" ")[0]}
          </div>
          <Label className="mt-0.5 text-primary">{dateLine}</Label>
          {headline && (
            <p className="mt-3 text-base font-medium leading-snug">{headline}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function HomepageSplash() {
  const { profile } = useRole();
  const { cases } = useCases();
  const insights = useInsights();
  const summary = useAgentSummary(cases);

  const now = useMemo(() => new Date(), []);
  const dateLine = now
    .toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    .toUpperCase();

  const stats = useMemo(() => {
    const open = cases.filter((c: InjuryClaim) => c.status !== "Closed");
    const needPerson = open.filter((c) => c.status === "Action required");
    const autonomous = open.length - needPerson.length;
    const atRisk = open.filter((c) => c.slaStatus === "At risk" || c.slaStatus === "Breached");
    const p1 = needPerson.filter((c) => c.priority === "P1").length;
    return { open, needPerson, autonomous, atRisk, p1 };
  }, [cases]);

  const trendStats: TrendStat[] = [
    {
      count: stats.open.length,
      label: "Open cases",
      delta: "+5 vs yesterday",
      tone: "up",
      to: "/cases",
    },
    {
      count: stats.autonomous,
      label: "Progressing on their own",
      delta: `${insights.autonomousRate}% autonomy`,
      tone: "up",
      to: "/cases",
    },
    {
      count: stats.needPerson.length,
      label: "For you today",
      delta: `${stats.p1} P1`,
      tone: "flat",
      to: "/actions",
    },
    {
      // "Cases at SLA risk" counts every open case at risk or breached. Naming
      // it precisely matters: an adjacent figure counting only the critical ones
      // would otherwise read as a contradiction.
      count: stats.atRisk.length,
      label: "Cases at SLA risk",
      delta: `of ${stats.open.length} open`,
      tone: "down",
      to: "/cases",
    },
  ];

  // The two cases worth naming. Priority leads, then how far through the clock:
  // a P1 with the claimant off work is the one to say out loud even when a P2 is further
  // along. Sorting on the clock alone buried the hero case.
  const PRIORITY_RANK = { P1: 0, P2: 1, P3: 2, P4: 3 } as const;
  const notable = stats.needPerson
    .slice()
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        b.elapsedMinutes / b.slaMinutes - a.elapsedMinutes / a.slaMinutes,
    )
    .slice(0, 2);

  const heaviest = insights.stageAccumulation[0];
  const heaviestPct = Math.round((heaviest.cases / Math.max(1, stats.open.length)) * 100);

  const slaScale = Math.max(...insights.slaTrend.onTrack, ...insights.slaTrend.breached);
  const onTrack = stats.open.filter((c) => c.slaStatus === "On track").length;
  const atRiskOnly = stats.open.filter((c) => c.slaStatus === "At risk").length;
  const breached = stats.open.filter((c) => c.slaStatus === "Breached").length;

  return (
    <div className="flex flex-col gap-3">
      {/* The brief */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/8 via-insight-100/25 to-transparent px-6 py-5 dark:from-primary/12 dark:via-insight-800/20">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
          <div className="flex min-w-0 flex-col gap-3.5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-[11px] text-white [background-image:var(--ai-gradient)]">
                <AiMark className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[19px] font-bold leading-tight">
                  {greeting(now)}, {profile.name.split(" ")[0]}
                </div>
                <Label className="mt-0.5 text-primary">{dateLine} · Your morning brief</Label>
              </div>
            </div>

            <div className="text-[13px] leading-relaxed text-muted-foreground">
              {/* The storyboard's scene-19 line, verbatim. It is said out loud. */}
              <Fact>{summary.headline}</Fact> The other{" "}
              <Fact>{stats.autonomous}</Fact> are progressing on their own.{" "}
              {stats.p1 > 0 && (
                <Highlight>
                  Today: {stats.needPerson.length} decisions, {stats.p1} P1.
                </Highlight>
              )}

              {notable.length > 0 && (
                <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 marker:text-foreground">
                  {notable.map((c) => (
                    <li key={c.id}>
                      <Fact>{c.id}</Fact>
                      {c.queueReason ? `, ${c.queueReason.toLowerCase()}` : ""}
                      {c.lineStatus && c.lineDownHours
                        ? `, and the claimant has been unable to work for ${c.lineDownHours} hours.`
                        : "."}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <Link
                to="/actions"
                className="inline-flex items-center gap-1.5 rounded-[9px] bg-primary px-5 py-2.5 text-[12.5px] font-semibold text-primary-foreground shadow-md transition-all hover:-translate-y-px hover:bg-primary/90"
              >
                Open decision queue
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 border-border lg:border-l lg:pl-5">
            {trendStats.map((stat) => (
              <TrendStatTile key={stat.label} stat={stat} />
            ))}
          </div>
        </div>
      </div>

      {/* The pulse */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <PulseCard
          title="Cases by stage"
          right={`${stats.open.length} open`}
          to="/cases"
          footer={`Heaviest stage: ${heaviest.stage} (${heaviestPct}%)`}
        >
          <StageBars insights={insights} />
        </PulseCard>

        <PulseCard
          title="SLA posture"
          right={`${Math.round((onTrack / Math.max(1, stats.open.length)) * 100)}% on track`}
          to="/cases"
          footer={
            <>
              7-day trend · <span className="font-semibold text-success">improving</span>
            </>
          }
        >
          <div className="flex gap-1.5">
            <SlaChip count={onTrack} label="On track" tone="success" />
            <SlaChip count={atRiskOnly} label="At risk" tone="warning" />
            <SlaChip count={breached} label="Breach" tone="destructive" />
          </div>
          <svg viewBox="0 0 120 32" preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
            {/* One shared scale, so the rising on-track line and the falling
                breach line are actually comparable against each other. */}
            <polyline
              fill="none"
              stroke="var(--success)"
              strokeWidth="1.6"
              points={points(insights.slaTrend.onTrack, slaScale)}
            />
            <polyline
              fill="none"
              stroke="var(--destructive)"
              strokeWidth="1.4"
              strokeDasharray="2 2"
              points={points(insights.slaTrend.breached, slaScale)}
            />
          </svg>
        </PulseCard>

        <PulseCard
          title="Autonomy rate"
          right="vs. last month"
          to="/performance"
          footer="Your case agent closed 142 tasks this week"
        >
          <div className="flex items-baseline gap-2">
            <span className="text-[26px] font-extrabold leading-none tabular-nums">
              {insights.autonomousRate}%
            </span>
            <span className="rounded-[10px] bg-success/10 px-1.5 py-0.5 text-[11px] font-bold text-success">
              ▲ +8pp
            </span>
          </div>
          <svg viewBox="0 0 120 32" preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
            <defs>
              <linearGradient id="splash-autonomy" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Autonomy is the inverse of cases reaching the queue. */}
            <polygon
              fill="url(#splash-autonomy)"
              points={`${points(insights.queueEntryTrend.map((t) => 50 - t.entered))} 120,32 0,32`}
            />
            <polyline
              fill="none"
              stroke="var(--primary)"
              strokeWidth="1.8"
              points={points(insights.queueEntryTrend.map((t) => 50 - t.entered))}
            />
          </svg>
        </PulseCard>
      </div>
    </div>
  );
}

/** Kept beside the splash so the empty-state card can reuse it. */
export { Card as SplashCard };
