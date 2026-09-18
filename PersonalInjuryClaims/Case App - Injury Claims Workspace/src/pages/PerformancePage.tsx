import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/PageContainer";
import { MetricTile } from "@/components/dashboard/MetricTile";
import { IllustrativeTag } from "@/components/claims/badges";
import { useCases, useInsights } from "@/lib/claims/useCases";

// The establishing shot: the whole operation before any one case.
//
// The chart that matters is "cases entering the human queue". The point is that
// straight-through completion is up because FEWER cases reach a person, not
// because the queue drains faster. Both series are plotted so that reading is
// available rather than asserted.

const AXIS = {
  stroke: "var(--muted-foreground)",
  fontSize: 12,
} as const;

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover p-2.5 text-xs shadow-md">
      <div className="mb-1 font-medium text-popover-foreground">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: entry.color }} />
          <span>{entry.name}</span>
          <span className="ml-auto font-medium tabular-nums text-popover-foreground">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PerformancePage() {
  const insights = useInsights();
  const { cases } = useCases();

  const openCount = cases.filter((c) => c.status !== "Closed").length;
  const needsPerson = cases.filter((c) => c.status === "Action required").length;
  const maxStage = Math.max(...insights.stageAccumulation.map((s) => s.cases));

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold">Operational insights</h1>
          <p className="text-sm text-muted-foreground">
            Personal Injury Claims · last 30 days
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Progressing autonomously"
            value={`${insights.autonomousRate}%`}
            sub={`${openCount - needsPerson} of ${openCount} open cases`}
            tone="success"
          />
          <MetricTile
            label="Human-intervention rate"
            value={`${insights.interventionRate}%`}
            sub={`${needsPerson} cases need a person today`}
          />
          <MetricTile
            label="At SLA risk"
            value={insights.atSlaRisk}
            sub="Watchlist"
            tone="warning"
          />
          <MetricTile
            label="Bottleneck stage"
            value={insights.bottleneckLabel}
            sub="Longest dwell time"
            tone="warning"
          />
        </div>

        <Card className="gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <span className="text-base font-semibold">Cases entering the human queue</span>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <TrendingUp className="size-4 rotate-180 text-success" />
                Fewer cases enter the queue, not a faster queue
              </p>
            </div>
            <IllustrativeTag />
          </div>

          <p className="max-w-2xl text-sm text-muted-foreground">
            Straight-through completion is up because most cases never reach a person at all, not
            because they are processed quicker.
          </p>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={insights.queueEntryTrend}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} {...AXIS} />
                <YAxis tickLine={false} axisLine={false} {...AXIS} />
                <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: "var(--border)" }} />
                <Line
                  type="monotone"
                  dataKey="entered"
                  name="Entered the queue"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  name="Completed by a person"
                  stroke="var(--chart-3)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-base font-semibold">Where work accumulates, by stage</span>
            <IllustrativeTag />
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={insights.stageAccumulation}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} {...AXIS} />
                <YAxis
                  type="category"
                  dataKey="stage"
                  width={190}
                  tickLine={false}
                  axisLine={false}
                  {...AXIS}
                />
                <Tooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="cases" name="Open cases" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {insights.stageAccumulation.map((entry) => (
                    // The bottleneck bar carries the warning token; the rest stay
                    // neutral, so the chart states its own conclusion.
                    <Cell
                      key={entry.stage}
                      fill={entry.cases === maxStage ? "var(--warning)" : "var(--chart-1)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
