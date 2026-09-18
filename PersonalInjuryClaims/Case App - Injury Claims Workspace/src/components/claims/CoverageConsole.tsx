import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CustomerStandingRows } from "@/components/claims/CustomerStandingCard";
import { PolicyCheckRows, PolicyTally } from "@/components/claims/PolicyTest";
import { recommendedSplit } from "@/lib/claims/costSplit";
import { useFlags } from "@/lib/flags";
import { cn } from "@/lib/utils";
import { moneyExact } from "@/lib/claims/format";
import type { CaseAction, DecisionCause, DetailFold, InjuryClaim } from "@/lib/claims/types";

// The reading half of the combined-cause console: who and what, the two causes,
// and everything else folded away.
//
// The organising idea, from the design: the finding stays open because it is the
// judgement; every supporting fact is present but folded to one line, so the
// screen is a decision rather than a dossier. Transcribed from
// `docs/coverage-decision-wiith-signals.html` and storyboard scene 20.

/** Small uppercase label, used throughout the console for field names. */
export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "block text-[9px] font-medium uppercase tracking-[0.13em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Monospaced provenance stamp for dates, references and system names. */
export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-[10.5px] tracking-wide text-muted-foreground", className)}>
      {children}
    </span>
  );
}

/** The two header tiles: what is burning, and when this is due. */
function Tile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "alarm" | "clock";
}) {
  return (
    <div
      className={cn(
        "min-w-[132px] rounded-lg border px-3 py-2",
        tone === "alarm" ? "border-destructive/30 bg-destructive/5" : "border-border bg-card",
      )}
    >
      <Label className="mb-0.5">{label}</Label>
      <b
        className={cn(
          "block text-lg font-semibold leading-tight tabular-nums",
          tone === "alarm" && "text-destructive",
        )}
      >
        {value}
      </b>
      <span className="block text-xs text-muted-foreground">{note}</span>
    </div>
  );
}

export function ConsoleHeader({
  action,
  claim,
}: {
  action: CaseAction;
  claim: InjuryClaim;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border pb-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <Mono className="text-xs">{claim.id}</Mono>
        <h1 className="text-xl font-semibold tracking-tight">{action.title}</h1>
        {action.status === "Completed" ? (
          <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-success">
            Decided
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-warning-foreground">
            Action required
          </span>
        )}
        <span className="inline-flex items-center rounded-full bg-info/15 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-info">
          Stage · {action.stage}
        </span>
        <Mono>SLA {Math.round(action.slaMinutes / 60)} HR</Mono>
      </div>

      {action.status !== "Completed" && (
        <div className="flex flex-wrap items-center gap-2.5">
          {action.tiles?.map((tile) => (
            <Tile key={tile.label} {...tile} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Case identity, the issue in one paragraph, and the claim → recommendation
 * lockup. Six facts, so the whole case lands before anything is touched.
 */
export function CaseBanner({
  action,
  claim,
}: {
  action: CaseAction;
  claim: InjuryClaim;
}) {
  const { showAgentConfidence } = useFlags();
  // The lockup states what the agent is PROPOSING, so it stays on the
  // recommended split even after the signer picks a different position.
  const attribution = action.costLines?.length ? recommendedSplit(action) : undefined;

  return (
    <Card className="gap-2 p-4">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <Mono className="text-xs">{claim.id}</Mono>
        <b className="text-lg font-semibold tracking-tight">{claim.customer}</b>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          Strategic
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>
          Policy <b className="font-semibold text-foreground">{claim.asset.model}</b>
        </span>
        <Mono>{claim.asset.serial}</Mono>
        <span className="text-success">✓ identity confirmed</span>
        <span aria-hidden>·</span>
        <span>{claim.site}</span>
        <span aria-hidden>·</span>
        <span>{claim.asset.coverageStatus}</span>
      </div>

      <p className="max-w-3xl text-[13px] leading-relaxed text-foreground">
        {action.whyThisReachedYou}
      </p>

      {/* Claim as filed → what the agent proposes doing with it. */}
      <div className="mt-1 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/40 p-3">
        <span className="min-w-0">
          <Label>Claim as filed</Label>
          <b className="block text-base font-semibold tabular-nums">
            {moneyExact(action.claimTotal ?? claim.claimValue)}
          </b>
          <span className="block text-xs text-muted-foreground">{action.claimLineSummary}</span>
        </span>

        <span className="text-lg text-muted-foreground" aria-hidden>
          →
        </span>

        <span className="min-w-0 flex-1">
          <Label className="text-primary">
            Agent recommends
            {showAgentConfidence && ` · ${action.confidencePercent}% confident`}
          </Label>
          <b className="block text-base font-semibold">{action.recommendation.headline}</b>
          {attribution && (
            <span className="block text-xs text-muted-foreground tabular-nums">
              {moneyExact(attribution.vendorTotal)} Aldergate ·{" "}
              {moneyExact(attribution.customerTotal)} claimant
            </span>
          )}
        </span>
      </div>
    </Card>
  );
}

function CauseCard({ cause }: { cause: DecisionCause }) {
  const covered = cause.side === "covered";
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border p-3.5",
        covered
          ? "border-success/35 bg-gradient-to-b from-card from-55% to-success/10"
          : "border-destructive/30 bg-gradient-to-b from-card from-55% to-destructive/8",
      )}
    >
      <Label>
        {cause.label} · {covered ? "on us" : "on them"}
      </Label>
      <h4 className="text-[15px] font-semibold leading-snug">{cause.title}</h4>
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">{cause.body}</p>
      <span
        className={cn(
          "mt-0.5 text-xs font-semibold",
          covered ? "text-success" : "text-destructive",
        )}
      >
        → {cause.points}
      </span>
      <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
        <Mono className="text-[9.5px]">{cause.established}</Mono>
        <span className="ml-auto flex flex-wrap gap-1">
          {cause.sources.map((source) => (
            <span
              key={source}
              className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {source}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

/**
 * The same cause, as one line.
 *
 * Which side it lands on, what it is, and the clause that establishes it. The
 * argument itself is not gone. It is one click down, alongside the provenance
 * stamp and the sources, which is where it belongs on a pane that is also
 * carrying a decision. The side stays colour-coded and stays in the leading
 * position, because "on us / on them" is the thing being read first.
 */
function CauseRow({ cause }: { cause: DecisionCause }) {
  const [open, setOpen] = useState(false);
  const covered = cause.side === "covered";
  // A finding's first sentence is usually its setup, so the fallback trims
  // rather than truncating on a sentence boundary.
  const summary = cause.summary ?? `${cause.body.slice(0, 72).trimEnd()}…`;

  return (
    <div className="border-b border-border/60 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-2.5 py-2 text-left transition-colors hover:bg-muted/40"
      >
        <span
          aria-hidden
          className={cn(
            "mt-px grid size-4 shrink-0 place-items-center rounded text-[10px] font-bold",
            covered
              ? "bg-success/15 text-success"
              : "bg-destructive/15 text-destructive",
          )}
        >
          {covered ? "✓" : "✗"}
        </span>
        <span
          className={cn(
            "mt-0.5 w-[52px] shrink-0 text-[9px] font-semibold uppercase tracking-[0.09em]",
            covered ? "text-success" : "text-destructive",
          )}
        >
          {covered ? "On us" : "On them"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold leading-snug">{cause.title}</span>
          <span className="block text-[11.5px] leading-snug text-muted-foreground">
            {summary}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform",
            !open && "-rotate-90",
          )}
        />
      </button>

      {open && (
        <div className="pb-2.5 pl-[74px] pr-1">
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">{cause.body}</p>
          <span
            className={cn(
              "mt-1.5 block text-xs font-semibold",
              covered ? "text-success" : "text-destructive",
            )}
          >
            → {cause.points}
          </span>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Mono className="text-[9.5px]">{cause.established}</Mono>
            <span className="flex flex-wrap gap-1">
              {cause.sources.map((source) => (
                <span
                  key={source}
                  className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {source}
                </span>
              ))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The finding: the established causes and what follows from them.
 *
 * The `showOpposingCause` flag drops the excluded cause. That is not a cosmetic
 * hide: with only the covering cause the case is a clean approval and the
 * verdict no longer applies, so the heading, the stamp and the verdict all
 * change with it rather than describing two causes when one is on screen.
 */
export function FindingCauses({
  action,
  columns = 2,
}: {
  action: CaseAction;
  /** 1 forces a stacked layout, for the narrower Actions pane. */
  columns?: 1 | 2;
}) {
  const { showOpposingCause, compactFinding } = useFlags();
  if (!action.causes?.length) return null;

  const causes = showOpposingCause
    ? action.causes
    : action.causes.filter((c) => c.side !== "excluded");
  if (causes.length === 0) return null;

  const combined = causes.length > 1;

  return (
    <Card className="gap-3 p-4">
      <div className="flex items-baseline gap-2">
        <Label>
          {combined ? `The finding: ${causes.length} causes` : "The finding"}
        </Label>
        <Mono className="ml-auto text-[9.5px]">
          {combined ? "BOTH ESTABLISHED" : "ESTABLISHED"}
        </Mono>
      </div>

      {compactFinding ? (
        <div className="flex flex-col">
          {causes.map((cause) => (
            <CauseRow key={cause.label} cause={cause} />
          ))}
        </div>
      ) : (
        <div className={cn("grid gap-3", combined && columns === 2 && "lg:grid-cols-2")}>
          {causes.map((cause) => (
            <CauseCard key={cause.label} cause={cause} />
          ))}
        </div>
      )}

      {action.verdict && combined && (
        <div
          className={cn(
            "rounded-lg",
            // Beside two full cards the verdict needs its own weight to read as
            // the conclusion. Under two rows it already is the heaviest thing
            // on the card, and a slab would just add furniture.
            compactFinding ? "pt-0.5" : "border border-border bg-muted/50 p-3.5",
          )}
        >
          <b className="text-[15px] font-semibold tracking-tight">{action.verdict.headline}</b>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            {action.verdict.detail}
          </p>
        </div>
      )}
    </Card>
  );
}

function Fold({
  fold,
  claim,
}: {
  fold: DetailFold;
  /** Lets a fold render live case data instead of an authored paraphrase. */
  claim?: InjuryClaim;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-baseline gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <Label className="shrink-0">{fold.label}</Label>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {fold.summary}
        </span>
        {fold.checks?.length ? <PolicyTally checks={fold.checks} /> : null}
        {fold.marked ? (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-primary">
            {fold.marked} marked
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            !open && "-rotate-90",
          )}
        />
      </button>
      {open && fold.id === "customer-standing" && claim ? (
        <div className="px-4 pb-3">
          <CustomerStandingRows claim={claim} />
        </div>
      ) : null}
      {open && fold.checks?.length ? (
        <div className="px-4 pb-3">
          <PolicyCheckRows checks={fold.checks} />
        </div>
      ) : null}
      {open && fold.body && fold.id !== "customer-standing" && (
        <p className="px-4 pb-3 text-[12.5px] leading-relaxed text-muted-foreground">
          {fold.body}
        </p>
      )}
    </div>
  );
}

/**
 * Everything that supports the finding without being it. Present so the record
 * is complete; folded so the screen stays a decision.
 */
export function DetailFolds({
  action,
  claim,
}: {
  action: CaseAction;
  claim?: InjuryClaim;
}) {
  if (!action.folds?.length) return null;
  return (
    <Card className="gap-0 overflow-hidden p-0">
      {action.folds.map((fold) => (
        <Fold key={fold.id} fold={fold} claim={claim} />
      ))}
    </Card>
  );
}
