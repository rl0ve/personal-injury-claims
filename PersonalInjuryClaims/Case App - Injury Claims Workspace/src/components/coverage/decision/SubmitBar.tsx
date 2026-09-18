import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TYPE } from "@/components/coverage/primitives";
import type { Departures } from "@/lib/coverage/store";
import { cn } from "@/lib/utils";

/**
 * SIGNING OFF THE CARD — the whole card, and the button has to say so.
 *
 * **It used to say `Submit — Deny coverage · $0.00`, and stand above the
 * evidence.** Both halves of that were wrong, and the position was the worse one:
 * whatever a button says, a control that sits ABOVE a block cannot read as
 * submitting it. The evidence moved into this card so the reassessment would be
 * visible while it was being caused (../decision/DecisionSection.tsx has that
 * argument) — but the actions stayed where they had been when the list lived
 * somewhere else, so the four evidence judgements read as reference material the
 * decision was taken against rather than as part of what is being filed.
 *
 * So this is the last thing in the card, and it declares the payload in the two
 * places a reader looks: the button's own second line names all four parts, and
 * the sentence beside it says which of them the person moved.
 *
 * **ONE LABEL — `Submit` — AND NOTHING HERE NAMES THE AGENT.** Both halves of
 * that are a deliberate reversal.
 *
 * It read `Agree & submit` / `Override & submit`, chosen so a reviewer departing
 * from an 87%-confident recommendation did not press the same words as one who
 * agreed with everything. The paragraph beside it read "Departing from the agent
 * on 2 of 4 parts" or "Taking the agent's position on all four parts, unchanged".
 * Between them the strip, the card head and these two put the agent in the
 * reviewer's sentence four times on one screen, and "agree" / "override" only mean
 * anything relative to somebody — so the verb was naming it too.
 *
 * The distinction did not go, it moved: the paragraph now says **No change in
 * position** or **Change in position**, which is the same fact stated about the
 * DECISION rather than about a relationship to a machine. That also removed a trap
 * the old verb had. Re-weighting a row can make the agent move to meet the
 * reviewer — the renewal goes to high, the agent reassesses to where the reviewer
 * was already heading — and the old button asked about the resolution while the
 * old sentence counted parts, so the two could disagree about the same act. One
 * label cannot.
 *
 * **What it does NOT do is change the payload.** `onSubmit` carries the resolution
 * and the reason exactly as before, and the evidence has always travelled with
 * them in the reducer's state. Nothing new is submitted — the button has stopped
 * under-describing what already was.
 */
export function SubmitBar({
  more,
  departures,
  evidenceCount,
  disabled,
  busy,
  onSubmit,
}: {
  /** The `···` menu. A slot, so this file needs to know nothing about its actions. */
  more: ReactNode;
  departures: Departures;
  evidenceCount: number;
  disabled: boolean;
  busy: boolean;
  onSubmit: () => void;
}) {
  const departed = departures.parts > 0;

  return (
    <div className="flex items-center gap-3 border-t border-border/70 pt-3.5">
      {more}
      <p className={cn(TYPE.small, "m-0 min-w-0 flex-1 leading-relaxed text-muted-foreground")}>
        {departed ? (
          <>
            <b className="font-semibold text-foreground">Change in position</b> ·{" "}
            {departures.parts} of 4 parts: {listOf(namesOf(departures))}.
          </>
        ) : (
          <b className="font-semibold text-foreground">No change in position.</b>
        )}
      </p>
      <Button
        disabled={disabled}
        aria-busy={busy}
        onClick={onSubmit}
        // A ROW: the spinner's slot, then a two-line stack. The two lines earn the
        // unusual shape — the first is the act, the second is the payload, and
        // splitting them is what lets the payload be named without the act becoming
        // a sentence. `h-auto` and the padding override the size default;
        // `items-center` is the base's, and it is what centres the spinner against
        // the pair rather than against the first line.
        //
        // `disabled:opacity-100` WHILE BUSY, and only while busy. The base carries
        // `disabled:opacity-50`, and `disabled` is true on both paths here — the
        // rationale being empty, and the submit being in flight. Sharing one
        // treatment made those read the same, and a spinner at half strength reads
        // as broken rather than working. Dim still means "not yet"; full strength
        // plus a spinner means "going".
        className={cn(
          // THE BOX GROWS A LITTLE, ON PURPOSE. It was pinned at 48px so the
          // 15px label could not push it out; that pin is gone and the padding
          // opens instead — `py-2.5` and `px-5` against the old `py-2`/`px-4`.
          // `h-auto` is back so the height is the content's, which is what lets
          // the two-line stack set it rather than a magic number.
          "h-auto shrink-0 flex-row items-center gap-2.5 px-5 py-2.5",
          busy && "disabled:opacity-100",
        )}
      >
        {/* ── THE SPINNER, BEFORE THE TEXT AND OUTSIDE IT ────────────────────
            Three arrangements were tried and the difference between them is
            where this sits in the tree, not what it looks like.

            Inside line 1, with a slot held open when idle: the label ended up
            24px in from the padding edge while the payload line below started
            flush against it, so a left-aligned button's two lines did not share
            a left edge.

            Inside line 1, trailing: alignment fine, but a spinner after a
            43-character payload line reads as belonging to the payload.

            Here — a sibling of the stack, not a child of a line — it is beside
            BOTH lines and centred against them, and it is the arrangement that
            can widen the button. That is worth stating because the earlier note
            claimed it could not: inside line 1 it cannot, since the payload line
            governs the width at 233px and line 1 has 187px of slack to swallow
            anything added to it. Out here the spinner is not competing with that
            slack — it is added to the stack's full width, so the button grows by
            the icon and the gap, and only while it is spinning. */}
        {busy && <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />}

        <span className="flex min-w-0 flex-col items-start gap-0.5">
          <span className="text-[15px] leading-tight font-semibold">Submit</span>
          {/* The payload, named. Not a count of what changed — that is the
              sentence's job — but what goes when this is pressed, which is all
              four parts on every path. */}
          <span className="text-[10.5px] leading-tight font-normal opacity-85">
            Resolution, refund, rationale and {evidenceCount}{" "}
            {evidenceCount === 1 ? "evidence item" : "evidence items"}
          </span>
        </span>

        {/* The visible text never changes, so nothing here is announced without
            this. `aria-busy` above marks the control; this says it in words for a
            reader who cannot see a spinner. */}
        <span aria-live="polite" className="sr-only">
          {busy ? "Submitting the decision" : ""}
        </span>
      </Button>
    </div>
  );
}

/** The departing parts, in the order the card presents them. */
function namesOf(d: Departures): string[] {
  const out: string[] = [];
  if (d.resolution) out.push("resolution");
  if (d.refund) out.push("refund");
  if (d.rationale) out.push("rationale");
  if (d.evidence > 0) {
    out.push(`${d.evidence} evidence ${d.evidence === 1 ? "change" : "changes"}`);
  }
  return out;
}

/** `a`, `a and b`, `a, b and c` — an Oxford-comma-free list, which is the house style. */
function listOf(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
