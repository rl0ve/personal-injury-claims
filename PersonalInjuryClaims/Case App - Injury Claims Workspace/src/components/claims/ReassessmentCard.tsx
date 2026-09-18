import { Sparkles } from "lucide-react";
import { AiMark } from "@/components/ui/ai-mark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfidenceBadge } from "@/components/claims/badges";
import type { AgentRecommendation } from "@/lib/claims/types";

/**
 * The case agent's mid-case reassessment, from storyboard scene 15.
 *
 * The point this card has to carry is that nobody routed anything: an event woke
 * the agent, it checked new evidence against a decision already taken, and it
 * proposes a route. The person still makes the technical call, so both an accept
 * and an override are offered and neither is preselected.
 */
export function ReassessmentCard({
  reassessment,
  onAccept,
  onOverride,
  acceptLabel,
}: {
  reassessment: AgentRecommendation & { trigger: string };
  onAccept: () => void;
  onOverride: () => void;
  acceptLabel: string;
}) {
  return (
    <Card className="gap-3 border-transparent p-0 ring-1 ring-inset ring-insight-400/40">
      <div className="flex flex-col gap-3 rounded-[inherit] bg-insight-100/30 p-5 dark:bg-insight-800/20">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid size-6 place-items-center rounded-full text-white [background-image:var(--ai-gradient)]">
            <AiMark className="size-3.5" />
          </span>
          <span className="text-sm font-semibold">Case agent reassessment</span>
          <ConfidenceBadge confidence={reassessment.confidence} />
        </div>

        <div>
          <h3 className="text-base font-semibold">{reassessment.headline}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{reassessment.detail}</p>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-3">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-insight-600 dark:text-insight-400" />
          <div className="min-w-0">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Recommended
            </span>
            <p className="text-sm">{reassessment.recommendedOutcome}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          <span className="font-medium">Evidence</span>
          {reassessment.evidenceBasis.map((basis, i) => (
            <span key={basis}>
              {basis}
              {i < reassessment.evidenceBasis.length - 1 && <span aria-hidden> ·</span>}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button onClick={onAccept}>{acceptLabel}</Button>
          <Button variant="outline" onClick={onOverride}>
            Override
          </Button>
        </div>
      </div>
    </Card>
  );
}
