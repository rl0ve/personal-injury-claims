import { useEffect, useState } from "react";
import { ChevronDown, Scale, UserRound } from "lucide-react";
import { AiMark } from "@/components/ui/ai-mark";
import { MoreMenu } from "@/components/coverage/dock/MoreMenu";
import { SubmitBar } from "@/components/coverage/decision/SubmitBar";
import { FiledRecord } from "@/components/coverage/decision/FiledRecord";
import { RationalePanel } from "@/components/coverage/decision/RationalePanel";
import { ChoiceboxGroup, ChoiceboxItem } from "@/components/ui/choicebox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardHead, Label, TYPE } from "@/components/coverage/primitives";
import { EvidenceList } from "@/components/coverage/EvidenceList";
import { RESOLUTIONS, resolutionFor, type EvidenceItem } from "@/lib/coverage/fixture";
import {
  changesSince,
  departuresOf,
  type Change,
  type CoverageEvent,
  type CoverageState,
  type Opening,
} from "@/lib/coverage/store";
import { useReassessment } from "@/lib/coverage/useReassessment";
import { moneyExact, timeOnly } from "@/lib/claims/format";
import type { CaseAction, DecisionEffect } from "@/lib/claims/types";
import { cn } from "@/lib/utils";

/**
 * THE DECISION, as a section of the record — after the evidence it rests on, before
 * the history that frames it.
 *
 * Built out of the app's own parts, like the cards above it: a glass `Card` with
 * `p-5` and a `CardHead`, bordered `bg-card` panels rather than tinted wells, the
 * app's `Button` and `Badge`, 14px reading size, and only one figure — the claim's
 * ceiling meter aside, the position is the largest thing on it.
 *
 * ## The strip never changes height
 *
 * A reassessment used to add a line to the body, which grew the box while somebody
 * was reading it. What moved the agent is now a timestamp in the right-hand column
 * under the confidence, in a fixed-height slot that is blank until there is something
 * to say — so the strip measures the same before and after.
 *
 * ## The resolutions are a choicebox
 *
 * The control leads, then the option's name with its "Rec" badge beside it, then
 * what the option means on its own line (../../ui/choicebox.tsx). Three of them
 * share one row. The stacked text is what lets the badge sit beside a name rather
 * than on top of it, and what stops the description truncating to "Aldergate
 * funds the…".
 */

/** Full names — the strip, Submit, the settled state. */
const FULL_NAME: Record<string, string> = {
  Approved: "Approve full coverage",
  Denied: "Deny coverage",
  PartialPlusGoodwill: "Approve partial coverage + goodwill",
};
/** Short names — the three cards, which share a row with a badge. */
const SHORT_NAME: Record<string, string> = {
  Approved: "Approve",
  Denied: "Deny",
  PartialPlusGoodwill: "Approve partial + goodwill",
};
/**
 * THE PAGE'S ONE COLOUR CODE FOR A COVERAGE DIRECTION.
 *
 * Green approves, amber splits, red denies — the same three the evidence rows and
 * the finding's causes carry on their dot. It is a dot here too now, beside the
 * position's name, rather than a 3px rule down the panel's left edge.
 *
 * Teal is not in this set: it means "the agent said this" and nothing else, which
 * is why the agent's badges are `insight` and the submit button is the only
 * `primary` thing on the card.
 */
const DIRECTION_RULE: Record<string, string> = {
  Approved: "bg-success",
  PartialPlusGoodwill: "bg-warning",
  Denied: "bg-destructive",
};
const directionRule = (o: string) => DIRECTION_RULE[o] ?? "bg-border";

const fullName = (o: string) => FULL_NAME[o] ?? resolutionFor(o).label;
const shortName = (o: string) => SHORT_NAME[o] ?? resolutionFor(o).label;

/**
 * WHOSE POSITION THE HEAD IS SHOWING — "Agent recommended" while the card stands
 * where the agent put it, "Human override" once the reviewer has moved it.
 *
 * **It is the only place either phrase appears.** The marker used to be on the
 * recommended resolution card as well, so the same claim was made twice on one
 * screen — once about the head's position and once about an option in the list —
 * and the two drifted apart the moment a reviewer picked something else: the head
 * dropped its pill while the list went on marking a card that was no longer the
 * decision. One tag, in the head, next to the position it describes.
 *
 * **BOTH STATES CARRY A MARK, and the pair is the vocabulary.** `AiMark` is the
 * app's agent glyph (../../ui/ai-mark.tsx, on nine other surfaces); `UserRound`
 * drawn filled is what an evidence row the reviewer added already wears
 * (../EvidenceList.tsx). The filed record's manifest attributes every line with
 * the same two marks (./FiledRecord.tsx), so a reader learns them once here and
 * reads them there.
 *
 * A mark on the override too, rather than only on the recommendation: they are two
 * values of one field, and a badge that grows an icon when it changes reads as two
 * different components instead of one that moved.
 *
 * **This reverses an earlier removal, because its premise is gone.** The glyph came
 * off on the grounds that "the AI avatar 12px to its left already makes the same
 * mark" — the head used to open with a gradient AI disc. It does not any more: the
 * row is `Decision` / position · direction dot · this tag. With the avatar gone the
 * badge is the only thing on the line that says whose call it is, so the mark has
 * nothing left to duplicate.
 *
 * **The hue is on the mark and the ink is `foreground`, which is a contrast fix
 * with a number on it.** `text-insight-600` on `bg-insight-100` measures 3.86:1 on
 * the running page, under the 4.5:1 that 11px type needs — the same "status ink on
 * a tint of itself" trap ../primitives.tsx `Pill` has a long note about. The insight
 * scale has no darker step available in this scope (`text-insight-700` and up fall
 * through to `--foreground`, and `bg-insight-600` is not emitted at all), so the
 * wash keeps the hue, the LABEL takes the page's own ink — **12.81:1** — and the
 * hue lands on the GLYPH, which is held to 1.4.11's 3:1 for non-text contrast and
 * clears it at 3.86. The colour ends up where it says "agent" and off the text
 * where it was failing.
 *
 * Not the `--ai-gradient` disc the page header and the assessment rail use: that
 * treatment is sized for a 20px avatar beside a heading, and inside an 11px pill it
 * would be a third bordered object on a row that already has a dot and a chip.
 *
 * **Override drops the hue rather than swapping it.** `insight` is the agent's
 * colour everywhere in this app, so tinting the reviewer's own call with it would
 * credit the agent for it; a second hue would read as a warning about a move the
 * reviewer is entitled to make. `bg-muted` is the neutral the dock already uses for
 * the same state — it goes `bg-foreground` / "Your decision" there.
 *
 * **It no longer keeps the chip the same size, and that is fine.** "Agent
 * recommended" is six characters longer than "Human override", so the head does
 * reflow slightly on the first click. The value row is `flex-wrap` with `gap-2`, so
 * the worst case is the badge dropping to its own line under the position — it
 * pushes nothing, and `whitespace-nowrap` keeps each phrase whole.
 *
 * **No tooltip.** It carried "What the agent would decide on this evidence. You can
 * pick any resolution." — an instruction for a control the reader is looking
 * straight at, on a chip that is a marker rather than a question. What it explained
 * is now said by the tag changing when the reviewer acts.
 */
function PositionTag({ override }: { override: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        override
          ? "bg-muted text-foreground"
          : "bg-insight-100 text-foreground dark:bg-insight-800 dark:text-white",
      )}
    >
      {override ? (
        <UserRound
          className="size-3 shrink-0 text-muted-foreground"
          fill="currentColor"
          // BOTH, and the inline style is the one that is guaranteed — see the
          // long note on the same pair in ../EvidenceList.tsx. lucide writes
          // `strokeWidth` as a presentation attribute, which any stylesheet beats.
          strokeWidth={0}
          style={{ strokeWidth: 0 }}
          aria-hidden
        />
      ) : (
        <AiMark className="size-3 shrink-0 text-insight-600 dark:text-white" />
      )}
      {override ? "Human override" : "Agent recommended"}
    </span>
  );
}

/**
 * THE DECISION'S HEAD — the section's name, what it stands at, and how sure the
 * agent was. Three facts, two ranks, no box.
 *
 * **The eyebrow is the heading.** `Decision` is the `h2` at 10px, which is the
 * rank the app gives a caption, and the 20px line under it is a VALUE, not a
 * title — so the section is still named for a screen reader while the largest
 * thing in the head is the thing a reader came for. `stamp` is the eyebrow's
 * suffix and the only moving part up there: "updating…" while the agent is
 * reassessing, then "updated 14:32" once it has. That used to be a fixed-height
 * slot under the confidence figure, kept blank so the panel could not grow
 * mid-read; there is no panel to grow now, and the eyebrow has the room.
 *
 * ## The score is a figure with a line under it, and both are deliberately quiet
 *
 * **Slate, not teal.** Teal on this card means the primary action and the
 * selected option — `bg-primary` is the submit button and the choicebox ring — so
 * a teal bar in the head would read as something to act on. `muted-foreground` at
 * 60% reads as a measurement, which is what it is.
 *
 * **It dims rather than disappears on a change.** A filled bar is a stronger
 * claim than a number: once the reviewer has picked something else it is not
 * describing the line beside it. Dropping to 35% says so without a caption, and
 * keeps the head the same height either way.
 *
 * **The caption is the page's own `Label`** — 12px, regular weight, sentence
 * case — rather than the 10px bold uppercase this mockup started from. That was
 * the right call for the wrong reason: ../primitives.tsx has since retired
 * uppercase captions altogether and `TYPE.label` IS the gentle form now, so the
 * quiet reading is also the consistent one. It shares a rung with the eyebrow and
 * does not compete with it, because the two sit in different columns.
 *
 * **The figure and the position share one rung** — 18/600, written out rather than
 * taken from `TYPE.page`, which is 20 and still belongs to the page `h1`. They are
 * the head's two readings and neither outranks the other.
 *
 * ## Every class in here was checked on the running page first
 *
 * Not superstition — `bg-foreground/55` and `bg-foreground/10` are BOTH dead in
 * this folder (measured: no rule emitted, background stays transparent), and the
 * second of those is what the reassessment skeleton below was using, so those
 * pulse bars have been painting nothing. They are `bg-muted-foreground/35` here,
 * which does resolve. See ../EvidenceList.tsx on why a class in this folder is
 * only real if one of the two stylesheets already contains it.
 *
 * **The emitted opacity steps are not the ones you would guess.** Measured on
 * `muted-foreground`: `/30`, `/35` and `/60` resolve; `/40` and `/50` do not. So
 * retuning either bar value is a two-minute job with a probe, not a one-character
 * edit — pick a step, then check it actually paints before believing the diff.
 */
function DecisionHead({
  position,
  direction,
  overridden,
  confidence,
  stamp,
}: {
  /** The resolution the card stands at — the pick, or the recommendation. */
  position: string;
  /** A `bg-*` class for the direction dot, from `directionRule`. */
  direction: string;
  /**
   * True once the reviewer has moved off the recommendation.
   *
   * ONE PROP FOR TWO EFFECTS, because they are two readings of one fact: the tag
   * beside the position says whose call it is, and the confidence bar dims because
   * the agent's score no longer describes the line above it. Passing them
   * separately let a future edit set one without the other and leave the head
   * claiming "Recommended" over a dimmed score.
   */
  overridden: boolean;
  confidence: number | null;
  /** The eyebrow's suffix, or null for none. */
  stamp: string | null;
}) {
  return (
    <div className="flex items-center gap-5">
      {/* THE TWO ROWS ARE A COLUMN, so the score can sit beside BOTH of them.
          `CardHead` is a full-width `justify-between` row of its own, so its
          `aside` slot could only ever hold something on the title's line — and
          the score is a reading of the whole head, not of its name. */}
      <div className="min-w-0 flex-1">
      {/* ROW ONE IS THE APP'S `CardHead`, NOT A HAND-ROLLED EYEBROW — and it is
          the primitive itself rather than a copy of its metrics, so "Decision"
          cannot drift from "Case info" above it or from the three folded sections
          below. Both get the 16/600 title and the 16px muted icon from one place.

          The confidence rides the head's `aside` slot, which is where every other
          card puts the reading that qualifies its title. */}
      <CardHead title="Decision" icon={<Scale />} />

      {/* ROW TWO IS THE VALUE. It is what the card stands at, so it is the
          largest thing in the head — 20/600 under a 16/600 title. Four pixels
          between two ranks is exactly what ../primitives.tsx's ramp note warns
          about; it holds here because they differ in ink and in position, and
          because the alternative was leaving the title at a rank no other head on
          the page uses. */}
      {/* ONE STATE, AND IT IS THE VALUE.
          This used to fork on a `thinking` phase: for 500ms the position became a
          190px pulsing bar with a `Reassessing…` badge beside it. That was written
          when a reassessment moved the agent's recommendation, and a number
          quietly becoming a different number is worth half a second of warning.
          The agent's position does not move any more — the reviewer's does, and
          this line follows the reviewer. So the skeleton was hiding a value the
          card already held, for half a second, immediately after the click that
          set it. It is a hard cut now. */}
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
        {/* 18px, NOT `TYPE.page`'s 20 — and the token itself is left alone,
            because the page `h1` above still uses it. At 20 this line and the
            confidence beside it were the two largest things on the card and
            6.5px above the control that files the decision. 18 keeps it the
            head's subject without reading as display type. */}
        <span className="min-w-0 truncate text-lg leading-tight font-semibold tracking-tight">
          {position}
        </span>
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-full transition-colors duration-200", direction)}
        />
        <PositionTag override={overridden} />
        {/* The agent's stamp sits with the position rather than with the title:
            it reports on THIS line — "the thing you are looking at was rewritten
            a moment ago" — and a card title is not a place for a clock. */}
        {stamp ? (
          <span className={cn(TYPE.small, "min-w-0 truncate text-muted-foreground")}>
            · {stamp}
          </span>
        ) : null}
        </div>
      </div>

      {/* THE SCORE, AS A RAIL WITH THE BAR UNDER IT — figure, caption, then the
          track at the rail's full width. It reads top-to-bottom like the caption
          it belongs to, and being a column beside the head rather than a row
          inside the title means it costs the head no height at all. */}
      {confidence !== null ? (
        <div className="flex w-[124px] shrink-0 flex-col items-end gap-0.5">
          {/* Paired with the position at 18 — the head's two readings share a
              rung, and splitting them would turn one of them into a caption. */}
          <span className="text-lg leading-tight font-semibold tracking-tight tabular-nums">
            {confidence}%
          </span>
          <Label>Confidence score</Label>
          {/* The track is the rail's width, so the bar is a proportion of the
              rail rather than of a scale — it says "most of the way", which is
              all a figure sitting directly above it needs to add. */}
          <span className="mt-[3px] h-[3px] w-full overflow-hidden rounded-full bg-border">
            <span
              className={cn(
                "block h-full rounded-full transition-[width,background-color] duration-200",
                overridden ? "bg-muted-foreground/35" : "bg-muted-foreground/60",
              )}
              style={{ width: `${confidence}%` }}
            />
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function DecisionSection({
  action,
  state,
  dispatch,
  limit,
  claim,
  recommended,
  opening,
  deciderName,
  onSubmit,
  onReopen,
  onMoreAction,
}: {
  action: CaseAction;
  state: CoverageState;
  dispatch: (e: CoverageEvent) => void;
  limit: number;
  claim: number;
  recommended: string;
  /** The case as it opened, for the filed record's manifest to diff against. */
  opening: Opening;
  deciderName: string;
  onSubmit: (outcome: string, reason: string) => void;
  onReopen: () => void;
  onMoreAction: (id: string) => void;
}) {
  /**
   * THE AGENT'S SCORE FOR THE POSITION IT IS CURRENTLY HOLDING, not the case's
   * authored one.
   *
   * This read `action.confidencePercent`, which is a constant — so re-weighting the
   * renewal or filing a piece of evidence moved the recommendation from Deny to a
   * $4,940 split with the head still reporting 87%. Reported, and reproduced. The
   * confidence is a property of the position now
   * (../../../lib/coverage/store.ts, `AgentPosition`), so it arrives with the
   * outcome, the refund and the reason and moves in the same beat they do.
   *
   * `state.agent`, not `state`: this is what the AGENT thinks of its own answer. A
   * reviewer who overrides is not more or less confident in the agent's reasoning
   * — which is what the head's dimmed confidence bar is for, and why it stays
   * keyed off `overridden`.
   */
  const confidence = state.agent.confidence;
  const overridden = state.resolution !== "" && state.resolution !== recommended;
  // What this submission moves away from the agent's proposal, part by part — the
  // submit bar's whole subject. Derived on every render because every one of the
  // four comparisons is against state that just changed.
  const departures = departuresOf(state, limit);
  const reasonMissing = state.reason.trim().length === 0;

  const [busy, setBusy] = useState(false);
  const [decided, setDecided] = useState<{
    outcome: string;
    refund: number;
    reason: string;
    at: string;
    evidence: EvidenceItem[];
    changes: Change[];
  } | null>(null);

  /**
   * The agent moving, staged — see ../../../lib/coverage/useReassessment.ts. It owns
   * the "Updated …" stamp too, because both answer the same question and keying two
   * effects off one signature is two places to forget.
   *
   * The signature was `outcome:refund:trigger`. None of the three move any more —
   * the agent recommends once and then only rewrites — so it keyed on a constant
   * and the beat would never have fired again. The rewrite IS the reassessment now,
   * so the assembled reason is the signature, and the store's no-op guard means a
   * change that produces the same paragraph produces no beat either.
   */
  const signature = state.agent.reason;
  /**
   * `typing` is the partially-written paragraph while the agent's new words are
   * arriving, and `null` the rest of the time — which is nearly always. The field
   * itself does not change: same box, same chrome, same editability.
   */
  const { text: typing, updatedAt: agentUpdatedAt } = useReassessment(signature, state.reason);

  const submit = () => {
    if (reasonMissing || busy) return;
    setBusy(true);
    // A beat of "Submitting…", so the press has a visible result before the section
    // changes shape under the pointer.
    setTimeout(() => {
      onSubmit(state.resolution, state.reason);
      // THE LIST AS IT STOOD, copied. The record must not move when the live
      // list does — and while the list is read-only after a decision today, the
      // record being a snapshot is what makes that a rendering choice rather than
      // the only thing keeping the two in agreement.
      setDecided({
        outcome: state.resolution,
        refund: state.refund,
        reason: state.reason,
        at: new Date().toISOString(),
        evidence: state.evidence,
        changes: changesSince(opening, state, limit, moneyExact, fullName),
      });
      setBusy(false);
    }, 500);
  };

  if (decided) {
    const opt = action.options.find((o) => o.outcome === decided.outcome);
    return (
      <Card className="flex flex-col gap-4 p-5">
        {/* NO ASIDE, for the reason the pending head has none: the panel under it
            opens on a green tick, the outcome and "Reopen". A header whispering
            "Filed" over that is the third thing on screen saying the same word. */}
        <CardHead title="Decision" icon={<Scale />} />
        <FiledRecord
          outcome={decided.outcome}
          refund={decided.refund}
          reason={decided.reason}
          evidence={decided.evidence}
          changes={decided.changes}
          at={decided.at}
          limit={limit}
          claim={claim}
          deciderName={deciderName}
          effects={effectsFor(opt?.effects ?? action.effects ?? [], decided.refund)}
          fullName={fullName}
          shortName={shortName}
          onReopen={() => {
            onReopen();
            setDecided(null);
          }}
        />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      {/* ── THE HEAD, WHICH IS NOW ALSO THE RECOMMENDATION ──────────────────
          A `CardHead` reading "Decision" used to sit above a bordered panel that
          named the position: an AI avatar, the resolution in bold, a Recommended
          badge, and the confidence. Two objects, and the panel said what the
          selected option card 16px below it already said — then, on a change, it
          grew a cross-reference ("Agent recommended <s>Deny coverage</s> at 87%")
          plus a "Your decision" badge, so the further a reviewer got from the
          agent the more the card talked about it.

          The panel is gone. Its three facts are the head now: the eyebrow says
          what the section is, the 20px line says what the decision stands at, and
          the score sits in the right rail. Two ranks, one object. */}
      <DecisionHead
        position={fullName(overridden ? state.resolution : recommended)}
        direction={directionRule(overridden ? state.resolution : recommended)}
        /* THE PILL STAYS AND CHANGES ITS WORD. It used to leave on the first
           override, on the reasoning that the marker on the Deny card below still
           said which option was recommended — but that marker has gone (see the
           resolution list), and a head that drops its only tag makes the reviewer
           read the whole card to find out whether it is holding the agent's answer
           or their own. "Recommended" → "Override" answers it in place. */
        overridden={overridden}
        confidence={confidence}
        stamp={agentUpdatedAt ? `updated ${timeOnly(agentUpdatedAt)}` : null}
      />

      {/* The seam the panel's rim used to provide. The head is two ranks of type
          with no box around it, so without this the resolutions read as a third
          rank of the same block. */}
      <div className="h-px bg-border" />

      {/* ── the three resolutions ── */}
      <div>
        <Label>Resolution</Label>
        <ChoiceboxGroup
          className="mt-2"
          name={`resolution-${action.id}`}
          value={state.resolution}
          onValueChange={(outcome) => dispatch({ type: "resolution.pick", outcome })}
          ariaLabel="Resolution"
        >
          {RESOLUTIONS.map((r) => (
            <ChoiceboxItem
              key={r.outcome}
              name={`resolution-${action.id}`}
              value={r.outcome}
              selected={state.resolution === r.outcome}
              title={shortName(r.outcome)}
              description={r.note}
              /* NO BADGE. The recommended option used to carry a "Recommended"
                 chip here, which said a second time what the head says 60px above
                 — and went on saying it about a card the reviewer had already
                 moved off, because the tag marked the AGENT'S pick while the
                 selection ring marked theirs. The head now carries the only
                 claim about whose position this is. */
            />
          ))}
        </ChoiceboxGroup>
      </div>

      {/* ── amount · rationale ──
          FLEX WITH A FIXED MONEY COLUMN, NOT A RATIO — and the ratio was the first
          three attempts. `lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]` computes to a
          SINGLE 1000px column on the running page; `lg:col-span-*`, `w-5/12` and
          `basis-5/12` are not emitted at all; and an unprefixed `col-span-2` inside
          `grid-cols-1` grows an implicit second track, which breaks the stacked
          layout. All measured. ../CaseFacts.tsx hit the same wall and its note
          explains why: an arbitrary value the prebuilt `.wrc` sheet has never seen
          is not reliably generated, so the only safe widths are the ones the app
          already uses. `flex` + `lg:flex-row` + `lg:w-[300px]` + `lg:shrink-0` are
          exactly that set — they are what that card runs on.

          The money holds four short figures and a meter; it does not need half the
          card, and 300px is what it actually needs. The rationale takes the rest,
          which is where the extra typing room comes from. */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <RefundPanel action={action} refund={state.refund} limit={limit} claim={claim} dispatch={dispatch} />

        <RationalePanel
          // Mid-rewrite the field draws the paragraph with the agent's new words
          // partly written in; otherwise the real value. Nothing else about the
          // panel changes while that happens — see
          // ../../../lib/coverage/useReassessment.ts.
          value={typing ?? state.reason}
          history={state.reasonHistory}
          editedAt={state.reasonAt}
          // A revision exists, not "a timestamp exists" — `reasonAt` is stamped at
          // mount so the opening draft can be dated correctly when it is
          // superseded, which makes it useless as a has-anything-changed test.
          edited={state.reasonHistory.length > 0}
          mine={state.touched.reason}
          onChange={(value) => dispatch({ type: "reason.set", value })}
        />
      </div>

      {/* ── THE EVIDENCE, UNDER THE DECISION IT FEEDS ────────────────────────
          It used to sit ABOVE this card, banded with the finding
          (`CaseInfo`, now gone). Two things follow from moving it here, and the
          second is the reason.

          The stated one: the decision is the first thing in this section rather
          than the fourth thing on the page.

          The one that matters more: **the reassessment is now visible while it
          is being caused.** Weighting a row or filing one makes the agent move —
          the strip's position and rule change, the refund changes, the rationale
          is rewritten, a timestamp appears. All of that is rendered ABOVE these
          rows. With the list above the card, every one of those answers landed
          below the reader's scroll position, so the loop ran off screen and the
          rows looked inert.

          `state.evidence` and `dispatch` were already props of this component —
          the reducer feeds the recommendation strip from the same list — so this
          needs no new plumbing and the composer, the row actions and the
          `addedByReviewer` chip behave exactly as they did. */}
      <EvidenceList evidence={state.evidence} dispatch={dispatch} addedByName={deciderName} />

      {/* ── signing off ──
          LAST, and that is the change. The actions used to sit between the
          rationale and the evidence, which was where they had been when the
          evidence lived in another card entirely — so the one control that files
          all four parts stood in front of the fourth. ./SubmitBar.tsx carries the
          rest of the argument, including why its label is one word now. */}
      <SubmitBar
        more={<MoreMenu onPick={onMoreAction} />}
        departures={departures}
        evidenceCount={state.evidence.length}
        disabled={reasonMissing || busy}
        busy={busy}
        onSubmit={submit}
      />
    </Card>
  );
}

/**
 * THE DOWNSTREAM EFFECTS, WITH THE ACCRUAL FOLLOWING THE REFUND THAT WAS SIGNED.
 *
 * The effects are authored per resolution (../../../lib/claims/demoData.ts), and
 * the SAP line among them carries a figure — written for the FULL split, because
 * that is what the option pays when the agent proposes it untouched. A reviewer
 * who signs a different number got a record that disagreed with itself: the
 * headline read `$2,255.00 refunded` and the line under it `$4,940.00 accrual`, on
 * the same card, about the same claim.
 *
 * So the accrual is retold from the submitted figure. Narrow on purpose — it
 * rewrites the money token of any effect whose detail mentions an accrual and
 * leaves every other effect exactly as authored, because the rest of them
 * ("restoration proceeds", "recurrence flag, WR-2025-0331") say nothing a refund
 * can contradict.
 */
function effectsFor(effects: DecisionEffect[], refund: number): DecisionEffect[] {
  return effects.map((e) =>
    e.detail && /accrual/i.test(e.detail)
      ? { ...e, detail: e.detail.replace(/\$[\d,]+(?:\.\d{2})?/, moneyExact(refund)) }
      : e,
  );
}

// ── refund & authority ─────────────────────────────────────────────────────────

/**
 * THE MONEY, in three tiers.
 *
 * The two figures first — one of them editable, the other derived from it; then the
 * authority check in its own raised box with the meter; then the claim lines behind a
 * disclosure, because the breakdown is reference rather than something to act on.
 *
 * The captions used to be uppercase labels, which put three competing headings inside
 * one panel; they are plain 12px captions now, and the panel's own name is the only
 * uppercase thing in it. The limit is stated once, in the authority box.
 */
function RefundPanel({
  action,
  refund,
  limit,
  claim,
  dispatch,
}: {
  action: CaseAction;
  refund: number;
  limit: number;
  claim: number;
  dispatch: (e: CoverageEvent) => void;
}) {
  const [text, setText] = useState(refund.toFixed(2));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(refund.toFixed(2));
  }, [refund, editing]);
  // At or over the ceiling the figure and the meter turn AMBER, not red: red is the
  // page's word for "denies cover", and a refund that needs a second approver is a
  // routing condition, which is what amber says everywhere else here (the header's
  // Action required pill, a held effect).
  const over = refund >= limit;
  const pct = Math.min(100, (refund / limit) * 100);
  const partial = action.options.find((o) => o.outcome === "PartialPlusGoodwill");

  /**
   * THE REFUND IS THE PANEL'S ONE FIGURE.
   *
   * It was one of two 16px figures in a 2-up grid, competing with the amount the
   * claimant carries. At 20px with the derived figure demoted to a row beneath it,
   * the panel has a subject: the number the reviewer is setting. 24px was the
   * first try and read as a display figure in a 300px column; 20px is the rung the
   * decision's own position line uses, which is the largest thing this card is
   * allowed to have.
   *
   * `pl-[22px]` and `left-2.5` are kept from the old field rather than retuned for
   * the larger type — both are in the sheet, and a new arbitrary padding is
   * exactly the kind of class this folder drops silently.
   *
   * **It is a binding rather than inline JSX** because it has to render in two
   * places: inside the `Collapsible` when there are cost lines, and on its own
   * when there are none. See its use site for why it sits inside that root.
   */
  const refundField = (
    <label className="mt-2.5 flex min-w-0 flex-col gap-1">
      <span className={cn(TYPE.small, "text-muted-foreground")}>Refund</span>
      <span className="relative inline-flex items-center">
        <span className={cn(TYPE.small, "pointer-events-none absolute left-2.5 text-muted-foreground")}>$</span>
        <input
          type="text"
          inputMode="decimal"
          value={text}
          onFocus={() => setEditing(true)}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseFloat(e.target.value.replace(/[^0-9.]/g, ""));
            dispatch({ type: "refund.set", value: Number.isFinite(n) ? n : 0 });
          }}
          onBlur={() => {
            setEditing(false);
            setText(refund.toFixed(2));
          }}
          /**
           * 16/600 IN A 32px BOX, DOWN FROM 20/700 IN 40.
           *
           * It was a second display figure: 20px bold, a few pixels from the claim's
           * 24px bold, two numbers competing to be the one the card is about — and
           * this is the one field on the card a person types into, which was dressed
           * as a headline. 16/600 is the card-head step rather than the display step,
           * and it is still the largest thing inside its own panel, which is the job.
           *
           * `pl-[18px]` follows the `$` down: the prefix is `TYPE.small` now, so the
           * old 22px left it floating.
           */
          className="h-8 w-full rounded-lg border border-border bg-background pr-2.5 pl-[18px] text-left text-base font-semibold tracking-tight tabular-nums focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      </span>
    </label>
  );

  return (
    /* 12/14 padding and a fixed width. The panel used to be `p-4` in a half-card
       column; both of those were spent on a group of four short figures. See the
       wrapper's note for why the width is a hard 300px rather than a ratio. */
    <div className="flex flex-col rounded-xl border border-border bg-card px-3.5 py-3 lg:w-[300px] lg:shrink-0">
      {/* ── THE HEAD CARRIES THE BREAKDOWN ─────────────────────────────────
          `Amount` on the left, the claim total and the disclosure on the right —
          the shape the Rationale head beside it already had, so the two now read
          as one pair rather than as two panels styled on different days.

          It also deletes a row. The trigger used to be a fourth line at the foot
          of the panel, under the authority meter, printing the same total this
          head now prints; folding it up here is worth about 28px and costs
          nothing, because a head with a control in it is what this card does
          everywhere else.

          The `Collapsible` has to WRAP both the head and the content — Radix
          needs its trigger and its panel under one root — which is why the head
          is inside it rather than the other way round. */}
      {action.costLines && action.costLines.length > 0 ? (
        <Collapsible>
          <div className="flex min-h-[24px] items-center gap-2">
            <span className={cn(TYPE.small, "font-semibold")}>Amount</span>
            <CollapsibleTrigger className="group ml-auto flex cursor-pointer items-center gap-1.5 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              <span className={cn(TYPE.small, "font-semibold tabular-nums")}>{moneyExact(claim)}</span>
              <span className={cn(TYPE.small, "text-muted-foreground")}>Breakdown</span>
              <ChevronDown
                aria-hidden
                className="size-3 shrink-0 text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-180"
              />
            </CollapsibleTrigger>
          </div>
          {/* THE FIELD SITS BETWEEN THE TRIGGER AND THE CONTENT, and that is the
              whole point of it being here rather than after the `Collapsible`.
              With the lines above the field, opening the breakdown pushed the
              refund input down the panel — the one control in here that must not
              move under the pointer. Radix needs its trigger and its panel under
              one root, so the root stretches to include the field and the content
              opens BELOW it. Nothing above the lines moves when they appear. */}
          {refundField}

          <CollapsibleContent>
            <div className="flex flex-col gap-1.5 pt-2.5">
              {action.costLines.map((line) => {
                const alloc = partial?.allocation?.[line.id as keyof NonNullable<typeof partial.allocation>];
                return (
                  <div
                    key={line.id}
                    title={alloc ? `${alloc.why} · ${alloc.to === "vendor" ? "to us" : "to the claimant"} under the split` : undefined}
                    className={cn(TYPE.small, "flex items-baseline justify-between gap-3")}
                  >
                    <span className="min-w-0 truncate font-medium text-muted-foreground">{line.name}</span>
                    <span className="shrink-0 font-medium tabular-nums">{moneyExact(line.amount)}</span>
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <>
          <div className="flex min-h-[24px] items-center">
            <span className={cn(TYPE.small, "font-semibold")}>Amount</span>
          </div>
          {refundField}
        </>
      )}


      {/* Derived, so a row rather than a field — and it keeps its own caption
          because "Paid by the claimant" is the half of the split that is easy to
          forget is being decided. */}
      {/* `TYPE.body` — 12 → 14. The refund came down to 16 and this is its other
          half; at 12 against a 20px figure it read as a footnote to a headline,
          which is not the relationship. Now it is one figure and its consequence. */}
      <div className={cn(TYPE.body, "mt-2.5 flex items-baseline justify-between gap-3 text-muted-foreground")}>
        Paid by the claimant
        <b className="font-semibold tabular-nums text-foreground">{moneyExact(claim - refund)}</b>
      </div>

      {/* THE AUTHORITY CHECK, ON ONE LINE.
          It was a raised box holding three stacked elements — a figure, a bar and a
          caption — that between them say one thing: how much of the signer's limit
          this commits. Inline, the bar takes the slack between the number and the
          words, and the box goes with the stacking: nothing here needed raising out
          of a panel that is already inside a card. */}
      {/* `mt-auto` — the authority check sits on the panel's floor, so the slack
          the shorter column has is a gap between the figures and the check rather
          than an empty strip under everything. */}
      {/* THE CEILING, AS ONE PHRASE.
          It read `$0.00` — of — `$5,000.00` — meter — `your limit`, with the label
          stranded on the far side of the bar from the figures it labels. A slash
          binds the two numbers into the fraction they are and `ceiling` sits with
          them, so the line reads `$0.00/$5,000.00 ceiling` in one go. The word
          matches the case card above, which already calls this the approval
          ceiling. The meter then takes the rest of the line rather than splitting
          it. */}
      <div className={cn(TYPE.small, "mt-auto flex items-center gap-2.5 pt-3 text-muted-foreground")}>
        <span className="shrink-0 tabular-nums">
          <b className={cn("font-bold", over ? "text-warning-foreground" : "text-foreground")}>
            {moneyExact(refund)}
          </b>
          /<b className="font-bold text-foreground">{moneyExact(limit)}</b> ceiling
        </span>
        <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-primary/20">
          <span
            className={cn(
              "block h-full rounded-full transition-[width,background-color] duration-200",
              over ? "bg-warning" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </span>
      </div>

    </div>
  );
}

