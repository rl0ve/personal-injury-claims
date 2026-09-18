import { Card } from "@/components/ui/card";
import { ActorChip } from "@/components/claims/badges";
import type { TrailEntry } from "@/lib/claims/types";

/**
 * The execution trail: what triggered a decision, the action the case agent
 * selected, and who signed off. When work runs on its own, this is the answer to
 * "why did this claim go for an independent medical examination", and it is part of the case rather than
 * a log somebody has to go and find.
 */
export function ExecutionTrail({ entries }: { entries: TrailEntry[] }) {
  if (entries.length === 0) {
    return (
      <Card className="p-5">
        <span className="text-sm text-muted-foreground">
          No execution history recorded on this case yet.
        </span>
      </Card>
    );
  }

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="w-14 py-2.5 pl-4 pr-2 font-medium">Seq</th>
              <th className="w-20 px-2 py-2.5 font-medium">Actor</th>
              <th className="px-2 py-2.5 font-medium">Step</th>
              <th className="w-56 px-2 py-2.5 font-medium">Stage</th>
              <th className="w-24 py-2.5 pl-2 pr-4 text-right font-medium">End time</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.seq} className="border-b border-border/50 last:border-0">
                <td className="py-2.5 pl-4 pr-2 tabular-nums text-muted-foreground">
                  {String(entry.seq).padStart(2, "0")}
                </td>
                <td className="px-2 py-2.5">
                  <ActorChip actor={entry.actor} />
                </td>
                <td className="px-2 py-2.5">{entry.step}</td>
                <td className="px-2 py-2.5 text-muted-foreground">{entry.stage}</td>
                <td className="py-2.5 pl-2 pr-4 text-right tabular-nums text-muted-foreground">
                  {entry.time}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
