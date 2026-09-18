import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Label } from "@/components/claims/CoverageConsole";
import type { PolicyCheck } from "@/lib/claims/types";

// The policy, tested clause by clause.
//
// Three verdicts, not two. A check that could not be run is not a check that
// came back clean, and on this case the difference is the argument: contributory
// negligence is *open*, so nothing has been charged on account of it. Collapsing
// open into fail would charge the claimant for a missing document; collapsing
// it into pass would clear them of something nobody looked at.

const MARK: Record<PolicyCheck["verdict"], { glyph: string; tone: string; label: string }> = {
  pass: { glyph: "✓", tone: "text-success", label: "Pass" },
  fail: { glyph: "✗", tone: "text-destructive", label: "Fail" },
  open: { glyph: "∅", tone: "text-muted-foreground", label: "Open" },
};

function tally(checks: PolicyCheck[]) {
  return {
    pass: checks.filter((c) => c.verdict === "pass").length,
    fail: checks.filter((c) => c.verdict === "fail").length,
    open: checks.filter((c) => c.verdict === "open").length,
  };
}

/** "7 checks · 5 pass, 1 fail, 1 open", derived so it cannot drift. */
export function policyTestSummary(checks: PolicyCheck[]): string {
  const t = tally(checks);
  const parts = [`${t.pass} pass`];
  if (t.fail) parts.push(`${t.fail} fail`);
  if (t.open) parts.push(`${t.open} open`);
  return `${checks.length} checks · ${parts.join(", ")}`;
}

export function PolicyTally({ checks }: { checks: PolicyCheck[] }) {
  const t = tally(checks);
  const chips = [
    { n: t.pass, label: "pass", cls: "bg-success/12 text-success" },
    { n: t.fail, label: "fail", cls: "bg-destructive/12 text-destructive" },
    { n: t.open, label: "open", cls: "bg-muted text-muted-foreground" },
  ].filter((c) => c.n > 0);

  return (
    <span className="flex shrink-0 items-center gap-1">
      {chips.map((c) => (
        <span
          key={c.label}
          className={cn(
            "rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider",
            c.cls,
          )}
        >
          {c.n} {c.label}
        </span>
      ))}
    </span>
  );
}

export function PolicyCheckRows({ checks }: { checks: PolicyCheck[] }) {
  return (
    <ul className="flex flex-col">
      {checks.map((check) => {
        const mark = MARK[check.verdict];
        const failed = check.verdict === "fail";
        return (
          <li
            key={check.id}
            className={cn(
              "flex items-baseline gap-2.5 border-b border-border/60 py-2 last:border-0",
              failed && "bg-destructive/[0.035]",
            )}
          >
            <span
              aria-label={mark.label}
              className={cn("w-3 shrink-0 text-center text-xs font-semibold", mark.tone)}
            >
              {mark.glyph}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block text-[12.5px] font-medium leading-snug",
                  failed && "text-destructive",
                  check.verdict === "open" && "text-muted-foreground",
                )}
              >
                {check.name}
              </span>
              <span className="block text-[11.5px] leading-snug text-muted-foreground">
                {/* An open check leads with its verdict, because "not established"
                    is the finding, and the sentence after it is only the reason. */}
                {check.verdict === "open" ? (
                  <>
                    <b className="font-semibold text-foreground">Not established</b>
                    {check.detail.replace(/^Not established/, "")}
                  </>
                ) : (
                  check.detail
                )}
              </span>
            </span>
            <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">
              {check.source ?? "None"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The standalone card, for the Actions pane where there is no fold stack to
 * hang it off. Open by default: on this case the test is the argument, not
 * supporting material, and folding away a failing clause would bury the reason
 * the decision exists.
 */
export function PolicyTestCard({
  checks,
  agreement,
  marked,
}: {
  checks: PolicyCheck[];
  /** The policy under test, named in the heading. */
  agreement?: string;
  marked?: number;
}) {
  if (!checks.length) return null;

  return (
    <Card className="gap-0 p-4">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <Label className="shrink-0">Policy test{agreement ? `: ${agreement}` : ""}</Label>
        <span className="min-w-0 flex-1 text-xs text-muted-foreground">
          {policyTestSummary(checks)}
        </span>
        {marked ? (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-primary">
            {marked} marked
          </span>
        ) : null}
        <PolicyTally checks={checks} />
      </div>
      <div className="mt-2">
        <PolicyCheckRows checks={checks} />
      </div>
    </Card>
  );
}
