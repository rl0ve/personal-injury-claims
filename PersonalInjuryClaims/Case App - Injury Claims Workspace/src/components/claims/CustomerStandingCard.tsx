import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { dateOnly, money } from "@/lib/claims/format";
import type { InjuryClaim } from "@/lib/claims/types";

// What the policy is worth and what it has already cost.
//
// It answers one question the liability argument cannot: whether absorbing the
// rehabilitation costs as goodwill is a gesture or a habit. The credits already
// issued and the goodwill paid in twelve months are opposite halves of that, and
// neither reads without the other, which is why they sit in one block rather
// than being scattered through the record.
//
// Two figures carry a warning tone. That is not decoration: credits already
// owed and a further credit triggered by this claim are the two numbers that
// make a denial expensive in a way the claim total does not show.

function Row({
  label,
  children,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  tone?: "warning";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "min-w-0 text-right text-[13px] font-medium tabular-nums",
          tone === "warning" && "text-warning-foreground",
        )}
      >
        {children}
      </span>
    </div>
  );
}

/** The rows on their own, for hosts that bring their own heading. */
export function CustomerStandingRows({ claim }: { claim: InjuryClaim }) {
  const s = claim.standing;
  if (!s) return null;

  return (
    <div className="flex flex-col">
      {claim.customerSegment && (
        <Row label="Account tier">{claim.customerSegment}</Row>
      )}
      <Row label="Premium / yr">{money(s.annualValue)}</Row>
      <Row label="Renewal">{dateOnly(s.renewalDate)}</Row>
      <Row label="SLA credits YTD" tone="warning">
        {money(s.slaCreditsYtd)}
      </Row>
      <Row label="This claim" tone={s.creditTriggered ? "warning" : undefined}>
        {s.creditTriggered ? "Credit triggered" : "No credit"}
      </Row>
      {/* Zero is the point of this row, not a missing value: nothing has been
          given away here, which is what makes the goodwill defensible. */}
      <Row label="Goodwill, 12 mo">{money(s.goodwill12mo)}</Row>

      <div className="mt-3 border-t border-border pt-2.5">
        <span className="text-xs text-muted-foreground">Claimant contact</span>
        <p className="mt-0.5 text-[13px] font-medium">
          {s.contactName} · {s.contactRole}
        </p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Last spoken to {dateOnly(s.lastSpokenAt)} · {s.lastSpokenVia}
        </p>
      </div>
    </div>
  );
}

export function CustomerStandingCard({ claim }: { claim: InjuryClaim }) {
  if (!claim.standing) return null;

  return (
    <Card className="gap-3 p-5">
      <div className="flex items-baseline gap-2">
        <span className="text-base font-semibold">Claimant standing</span>
        {/* Named because this is not the case's own data. A claims officer
            weighs a policy's tier and credit balance, they do not set them. */}
        <span className="ml-auto shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">
          {claim.standing.source}
        </span>
      </div>
      <CustomerStandingRows claim={claim} />
    </Card>
  );
}
