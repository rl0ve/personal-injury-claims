import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type MetricTone = "default" | "success" | "warning" | "destructive";

const TONE_CLASS: Record<MetricTone, string> = {
  default: "",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

export function MetricTile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: MetricTone;
}) {
  return (
    <Card className="gap-1 p-5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-3xl font-bold tracking-tight tabular-nums", TONE_CLASS[tone])}>
        {value}
      </span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </Card>
  );
}
