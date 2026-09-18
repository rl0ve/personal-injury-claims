import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { moneyExact, shortCaseId } from "@/lib/claims/format";
import type { CaseAction, InjuryClaim } from "@/lib/claims/types";

/**
 * What is being decided, stated before anything is argued.
 *
 * This replaced a "Why this reached you" card, which asked the reader to take
 * the escalation on trust. What is here instead is what the liability argument
 * rests on (whose injury, where, under a policy live until when) and the
 * sentence about why a person has it closes the block rather than standing
 * alone.
 *
 * Deliberately thin. The policy number, the identity check and the cover reference are
 * all in the case drawer a click away, and none of them changes the decision;
 * carrying them here only pushed the finding below the fold. What stays is what
 * a reader would ask for before reading the argument.
 *
 * The claim total is the exception to the no-duplication rule. The decision card
 * also shows a total, but a different one: this is the claim **as filed**, fixed,
 * while the card's totals move with the position. They cannot disagree, and
 * knowing the size of the thing before reading the argument is worth a figure.
 *
 * The mock's agent-recommendation tile is still left out, because that one would
 * genuinely restate the decision card, and would go stale the moment a position
 * changed.
 */
/**
 * The policy in the two clauses that bear on the decision.
 *
 * `coverageStatus` reads "Personal Injury Cover NRD-PIC-2024-0219 · active
 * to 2027-09-02 · excess £0.00". The reference number is filing detail; what
 * a reader needs here is that cover is live and what it costs them to use it, so
 * the policy's own identifier is dropped and the rest kept as written.
 */
function coverageTerms(coverageStatus: string): string {
  return coverageStatus
    .split("·")
    .map((part) => part.trim())
    .filter((part) => part && !/^(personal injury cover|injury cover|policy|extended service agreement|esa)\b/i.test(part))
    .join(" · ");
}

export function DecisionHeader({
  action,
  claim,
  className,
}: {
  action: CaseAction;
  claim: InjuryClaim;
  className?: string;
}) {
  const { asset } = claim;
  const claimTotal = action.claimTotal ?? claim.claimValue;
  const terms = coverageTerms(asset.coverageStatus);

  return (
    <Card className={cn("gap-1.5 p-4", className)}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span
          className="font-mono text-[11.5px] tracking-tight text-muted-foreground"
          title={claim.id}
        >
          {shortCaseId(claim.id)}
        </span>
        <h2 className="text-[15px] font-semibold leading-tight">{claim.customer}</h2>
        {claim.customerSegment && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            {claim.customerSegment}
          </span>
        )}

        {/* The size of the thing, before the argument about who pays it. */}
        {claimTotal > 0 && (
          <span className="ml-auto flex shrink-0 items-baseline gap-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
              Claim as filed
            </span>
            <b className="text-[15px] font-semibold tabular-nums">{moneyExact(claimTotal)}</b>
          </span>
        )}
      </div>

      <p className="flex flex-wrap items-center gap-x-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
        <b className="font-semibold text-foreground">{asset.model}</b>
        <span aria-hidden>·</span>
        <span>{claim.site}</span>
        {terms && (
          <>
            <span aria-hidden>·</span>
            <span>{terms}</span>
          </>
        )}
      </p>

      {action.whyThisReachedYou && (
        <p className="mt-1 text-[13px] leading-relaxed">{action.whyThisReachedYou}</p>
      )}
    </Card>
  );
}
