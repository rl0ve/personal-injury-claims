import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label, Mono } from "@/components/claims/CoverageConsole";
import { useFlags } from "@/lib/flags";
import { cn } from "@/lib/utils";
import { moneyExact, outcomeLabel, shortCaseId, timeOnly } from "@/lib/claims/format";
import { REASONING_OPTIONS } from "@/lib/claims/demoData";
import { recordDecision } from "@/lib/claims/useCases";
import { useRole } from "@/lib/role/useRole";
import { completeTask } from "@/services/uipath/caseService";
import { isCaseConfigured } from "@/services/uipath/config";
import { useUiPath } from "@/services/uipath/UiPathProvider";
import { authorityFor, splitFor, type AuthorityVerdict, type CostSplit } from "@/lib/claims/costSplit";
import type { CaseAction, DecisionEffect, ReasoningVerdict, InjuryClaim } from "@/lib/claims/types";

// The deciding half of the console: the position, the money that follows from
// it, whether the signer can sign it alone, the rationale, and separately
// what they think of the agent's reasoning.
//
// That last part is the point of the screen. The outcome tells the case what to
// do; the reasoning verdict tells the agent whether to keep asking. Storyboard
// scene 20 calls it out as a beat: "agree, keep asking, stop asking".

function currency(value: number | null): string {
  return value == null ? "" : value.toLocaleString("en-GB", { minimumFractionDigits: 2 });
}

/**
 * Cost attribution under the selected position.
 *
 * Every row is recomputed when the position changes. The amounts stay put, the
 * column they land in moves. The "why" moves with them, because a line reading
 * "Attributed to the pre-existing condition" under a full-liability position would be
 * describing a decision nobody made.
 */
function SplitTable({ split }: { split: CostSplit }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
      <div className="flex border-b border-border bg-card px-3 py-2">
        <Label className="flex-1">Cost attribution</Label>
        <Label className="w-[88px] text-right">Aldergate</Label>
        <Label className="w-[88px] text-right">Claimant</Label>
      </div>

      {split.rows.map(({ line, attribution, vendor, customer }) => (
        <div
          key={line.id}
          className="flex items-baseline border-t border-border px-3 py-2 first:border-t-0"
        >
          <span className="min-w-0 flex-1 text-[11.8px]">
            {line.name}
            <span className="block text-[11px] text-muted-foreground">
              {attribution.why}
              {attribution.goodwill && (
                <span className="ml-1 rounded bg-primary/10 px-1 py-px text-[9.5px] font-semibold uppercase tracking-wider text-primary">
                  goodwill
                </span>
              )}
            </span>
          </span>
          <span
            className={cn(
              "w-[88px] text-right text-[11.8px] tabular-nums transition-colors",
              vendor == null ? "text-muted-foreground/50" : "font-medium",
            )}
          >
            {currency(vendor)}
          </span>
          <span
            className={cn(
              "w-[88px] text-right text-[11.8px] tabular-nums transition-colors",
              customer == null ? "text-muted-foreground/50" : "font-medium",
            )}
          >
            {currency(customer)}
          </span>
        </div>
      ))}

      <div className="flex items-baseline border-t border-border bg-card px-3 py-2">
        <span className="min-w-0 flex-1 text-[11.8px] font-semibold">
          Total{" "}
          <span className="font-normal text-muted-foreground tabular-nums">
            {moneyExact(split.claimTotal)}
          </span>
        </span>
        <span className="w-[88px] text-right text-[11.8px] font-semibold tabular-nums">
          {currency(split.vendorTotal)}
        </span>
        <span className="w-[88px] text-right text-[11.8px] font-semibold tabular-nums">
          {currency(split.customerTotal)}
        </span>
      </div>
    </div>
  );
}

/**
 * Whether the signer can sign this alone.
 *
 * Three states, not two. Full liability blows the limit and routes for
 * co-approval; a denial costs Aldergate nothing but is still a commitment to
 * the claimant and routes for sign-off. Only the split sits inside the limit,
 * which is the argument the recommendation is making.
 */
function AuthorityMeter({ verdict }: { verdict: AuthorityVerdict }) {
  const pct = Math.min(100, (verdict.amount / verdict.limit) * 100);
  const ok = verdict.state === "within";

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        ok
          ? "border-success/35 bg-gradient-to-b from-card to-success/10"
          : "border-destructive/35 bg-gradient-to-b from-card to-destructive/10",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <Label>Your authority</Label>
        <b className="text-sm font-semibold tabular-nums">{moneyExact(verdict.amount)}</b>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width,background-color] duration-300",
            ok ? "bg-primary" : "bg-destructive",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>£0</span>
        <span>Limit {moneyExact(verdict.limit)}</span>
      </div>

      <p className={cn("mt-2 text-xs font-medium", ok ? "text-success" : "text-destructive")}>
        {verdict.state === "within" && (
          <>✓ Within your delegated authority. You can sign this alone.</>
        )}
        {verdict.state === "over" && (
          <>
            ▲ {moneyExact(verdict.amount)} exceeds your {moneyExact(verdict.limit)} limit. Routes
            to <b>{verdict.approver}</b> for co-approval.
          </>
        )}
        {verdict.state === "denial" && (
          <>
            ▲ £0 to Aldergate, but a denial is a commitment to the claimant. Routes to{" "}
            <b>{verdict.approver}</b> for sign-off.
          </>
        )}
      </p>
    </div>
  );
}

/** What happens downstream the moment this is submitted. */
function OnSubmitFold({ effects }: { effects: DecisionEffect[] }) {
  const [open, setOpen] = useState(false);
  if (effects.length === 0) return null;

  return (
    <div className="border-t border-border pt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-baseline gap-2 py-1.5 text-left"
      >
        <Label>On submit</Label>
        <span className="text-xs text-muted-foreground">{effects.length} effects</span>
        <ChevronDown
          className={cn(
            "ml-auto size-3.5 text-muted-foreground transition-transform",
            !open && "-rotate-90",
          )}
        />
      </button>
      {open && (
        <ul className="flex flex-col gap-1 pb-1">
          {effects.map((effect) => (
            <li key={effect.title} className="flex gap-1.5 text-[11.5px] text-muted-foreground">
              <span
                className={cn(
                  "mt-1.5 size-1 shrink-0 rounded-full",
                  effect.hold ? "bg-warning" : "bg-muted-foreground/60",
                )}
              />
              <span>
                <span className={cn(effect.hold ? "text-warning-foreground" : "text-foreground")}>
                  {effect.title}
                </span>
                {effect.detail ? `: ${effect.detail}` : ""}
                {effect.hold && <span className="text-warning"> · held</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The settled state: what was authorised, what it set in motion, and the signed rationale. */
function SettledState({
  action,
  effects,
  onReopen,
}: {
  action: CaseAction;
  effects: DecisionEffect[];
  onReopen: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-success text-success-foreground">
          <Check className="size-3.5" />
        </span>
        <span className="min-w-0">
          <b className="block text-[15px] font-semibold">
            {outcomeLabel(action.completedOutcome ?? "")} authorised
          </b>
          <span className="block text-xs text-muted-foreground" title={action.caseId}>
            {shortCaseId(action.caseId)}
            {action.completedAt ? ` · ${timeOnly(action.completedAt)}` : ""}
          </span>
        </span>
      </div>

      {effects.length > 0 ? (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <Label className="mb-1.5">Recorded</Label>
          <ul className="flex flex-col gap-1.5">
            {effects.map((effect) => (
              <li key={effect.title} className="flex gap-2 text-[11.5px]">
                <Check
                  className={cn(
                    "mt-0.5 size-3 shrink-0",
                    effect.hold ? "text-warning" : "text-success",
                  )}
                />
                <span>
                  {effect.title}
                  {effect.detail ? (
                    <span className="text-muted-foreground">: {effect.detail}</span>
                  ) : null}
                  {effect.hold && <span className="text-warning"> · held</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {action.rationale && (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <Label className="mb-1.5 text-primary">Rationale, as signed</Label>
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">{action.rationale}</p>
        </div>
      )}

      {action.completedReasoning && (
        <div className="rounded-lg border border-border p-3">
          <Label className="mb-1">Reasoning</Label>
          <p className="text-[12.5px] text-foreground">
            {REASONING_OPTIONS.find((o) => o.value === action.completedReasoning)?.label}
          </p>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            {REASONING_OPTIONS.find((o) => o.value === action.completedReasoning)?.effect}
          </p>
        </div>
      )}

      <Button variant="outline" className="w-full" onClick={onReopen}>
        <RotateCcw className="size-4" />
        Reopen task
      </Button>
    </div>
  );
}

export function CoverageDecisionCard({
  action,
  claim,
  onCompleted,
  onReopen,
  position,
  onPositionChange,
}: {
  action: CaseAction;
  claim: InjuryClaim;
  onCompleted?: (outcome: string) => void;
  onReopen?: () => void;
  /**
   * The coverage position, when the host owns it.
   *
   * The assessment rail answers the position. It says something different when
   * you move to a denial than when you move to full coverage, so the two have
   * to be looking at the same value. The host holds it and hands it to both.
   * Left out, the card keeps its own, which is what the plain form wants.
   */
  position?: string;
  onPositionChange?: (outcome: string) => void;
}) {
  const { profile } = useRole();
  const { sdk, isAuthenticated } = useUiPath();
  const { showReasoningCapture } = useFlags();

  const [ownSelected, setOwnSelected] = useState(action.recommendation.recommendedOutcome);
  const controlled = position !== undefined;
  const selected = controlled ? position : ownSelected;
  const setSelected = (outcome: string) => {
    if (!controlled) setOwnSelected(outcome);
    onPositionChange?.(outcome);
  };
  const [rationale, setRationale] = useState(action.rationale ?? "");
  const [reasoning, setReasoning] = useState<ReasoningVerdict | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOwnSelected(action.recommendation.recommendedOutcome);
    setReasoning(null);
    setError(null);
  }, [action.id, action.recommendation.recommendedOutcome]);

  // Switching position swaps in that position's draft. Deny and full ship an
  // empty one on purpose: they depart from the recommendation, so the signer
  // writes the reason rather than editing the agent's.
  useEffect(() => {
    setRationale(selectedOption?.draftRationale ?? "");
    // Keyed on the position, not the draft, so the signer's own edits survive
    // a re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.id, selected]);

  const isDone = action.status === "Completed";

  // Everything downstream of the position is derived from it, so picking a
  // different one moves the table, the totals, the meter and the effects at once.
  const selectedOption = action.options.find((o) => o.outcome === selected);
  const split = useMemo(() => splitFor(action, selectedOption), [action, selectedOption]);
  const verdict = useMemo(
    () => authorityFor(action, selectedOption, split),
    [action, selectedOption, split],
  );
  const effects: DecisionEffect[] = selectedOption?.effects ?? action.effects ?? [];
  const draft = selectedOption?.draftRationale ?? action.draftRationale ?? "";
  const edited = rationale !== draft;

  async function submit() {
    setSubmitting(true);
    setError(null);

    recordDecision(action, selected, profile.name, rationale, reasoning ?? undefined);

    if (isCaseConfigured() && isAuthenticated && sdk && claim.instanceId) {
      try {
        await completeTask(sdk, claim.instanceId, action.actionType, selected, {
          rationale,
          reasoningVerdict: reasoning,
          costAttribution: split.rows,
          evidenceSignals: claim.evidence.map((e) => ({ id: e.id, helpful: e.helpful })),
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? `Recorded locally, but the Maestro task was not completed: ${err.message}`
            : "Recorded locally, but the Maestro task was not completed.",
        );
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(false);
    onCompleted?.(selected);
  }

  return (
    // `shrink-0` is load-bearing, not cosmetic. `overflow-hidden` (needed so the
    // header and footer bands clip to the rounded corners) makes this a flex item
    // with `min-height: 0` instead of `auto`, so inside a flex column that is
    // short on space it collapses to zero height and clips its own content away.
    <Card className="shrink-0 gap-0 overflow-hidden border-primary/30 p-0 shadow-lg">
      <div className="border-b border-border px-4 py-3">
        <span className="text-[16.5px] font-medium tracking-tight">The decision</span>
      </div>

      {isDone ? (
        <SettledState action={action} effects={effects} onReopen={() => onReopen?.()} />
      ) : (
        <>
          <div className="flex flex-col gap-4 p-4">
            <fieldset className="flex flex-col gap-1.5">
              {/* Full id here on purpose: a screen reader has no column to
                  overflow, and an elided identifier is worse to hear. */}
              <legend className="sr-only">Coverage decision for {action.caseId}</legend>
              <Label className="mb-0.5">Coverage position</Label>
              {action.options.map((option) => {
                const on = selected === option.outcome;
                const recommended = action.recommendation.recommendedOutcome === option.outcome;
                return (
                  <label
                    key={option.outcome}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors",
                      on ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                    )}
                  >
                    <input
                      type="radio"
                      name={`position-${action.id}`}
                      value={option.outcome}
                      checked={on}
                      onChange={() => setSelected(option.outcome)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                        on ? "border-primary bg-primary text-white" : "border-input",
                      )}
                      aria-hidden
                    >
                      {on && <Check className="size-2.5" />}
                    </span>
                    <span className="min-w-0">
                      <b className="text-[13px] font-semibold">
                        {option.label}
                        {recommended && (
                          <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-primary">
                            Recommended
                          </span>
                        )}
                      </b>
                      <em className="block text-[11.5px] not-italic text-muted-foreground">
                        {option.rationale}
                      </em>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <SplitTable split={split} />
            {verdict && <AuthorityMeter verdict={verdict} />}

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`rationale-${action.id}`}>
                <Label>
                  Rationale <span className="text-destructive">*</span>
                </Label>
              </label>
              <textarea
                id={`rationale-${action.id}`}
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                rows={7}
                className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-[12.5px] leading-relaxed shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
              />
              {selectedOption?.overrideNote && (
                <p className="rounded-md bg-warning/10 px-2.5 py-2 text-[11.5px] leading-snug text-warning-foreground">
                  {selectedOption.overrideNote}
                </p>
              )}
              <div className="flex items-center justify-between gap-2">
                <Mono className="text-[10px]">
                  {draft ? "Drafted by the agent · you own it" : "Yours to write"}
                </Mono>
                {draft && edited && (
                  <button
                    type="button"
                    onClick={() => setRationale(draft)}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    Restore draft
                  </button>
                )}
              </div>
            </div>

            {/*
              The learning signal. Asked separately from the outcome on purpose:
              agreeing with a recommendation and wanting to stop being asked are
              different statements, and only the second one changes the rules.
            */}
            <div
              className={cn(
                "flex flex-col gap-1.5 border-t border-border pt-3",
                !showReasoningCapture && "hidden",
              )}
            >
              <Label>And the reasoning</Label>
              {REASONING_OPTIONS.map((option) => {
                const on = reasoning === option.value;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors",
                      on ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                    )}
                  >
                    <input
                      type="radio"
                      name={`reasoning-${action.id}`}
                      value={option.value}
                      checked={on}
                      onChange={() => setReasoning(option.value)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                        on ? "border-primary bg-primary text-white" : "border-input",
                      )}
                      aria-hidden
                    >
                      {on && <Check className="size-2.5" />}
                    </span>
                    <span className="min-w-0">
                      <b className="text-[12.5px] font-medium">{option.label}</b>
                      {on && (
                        <em className="block text-[11px] not-italic text-muted-foreground">
                          {option.effect}
                        </em>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>

            <OnSubmitFold effects={effects} />

            {error && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-border bg-muted/40 p-3.5">
            <div className="flex flex-wrap gap-1.5">
              {["Request evidence", "Ask the claimant", "Escalate now", "Defer 24h"].map((label) => (
                <Button key={label} variant="outline" size="sm" className="text-xs">
                  {label}
                </Button>
              ))}
            </div>
            <Button
              className="w-full"
              disabled={submitting || !rationale.trim()}
              onClick={() => void submit()}
            >
              {/* The outcome's short name, not the option's full sentence:
                  "Submit Approve partial settlement + goodwill" is not a button. */}
              {submitting ? "Submitting…" : `Submit ${outcomeLabel(selected).toLowerCase()}`}
            </Button>
            <Mono className="text-center text-[9.5px]">
              RECORDED TO THE DECISION LEDGER · REVERSIBLE UNTIL DISPATCH
            </Mono>
          </div>
        </>
      )}
    </Card>
  );
}
