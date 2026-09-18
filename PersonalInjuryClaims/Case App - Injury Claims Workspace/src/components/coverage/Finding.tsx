import { useState } from "react";
import { Info } from "lucide-react";
import { Band, FoldRow, INK, Mono, Rows, ToneChip, TYPE } from "@/components/coverage/primitives";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CaseAction, DecisionCause } from "@/lib/claims/types";

/**
 * THE TWO ESTABLISHED CAUSES, and what follows from them.
 *
 * **A group inside the CASE card, not a card of its own.** This returns a `Rows`
 * panel and ./CaseFacts.tsx owns the card — what was established about a claim
 * reads as part of the claim, not as a box beside it.
 *
 * It was banded with the evidence in a shared `Case info` card until the decision
 * moved to the top of its own section and took the evidence with it. That card's
 * argument was that the finding and the evidence are one subject in two parts and a
 * reader crosses between them constantly, which was true; what it could not also do
 * was leave the evidence next to the decision it feeds. The rows below carry the
 * same band, the same `FoldRow` and the same three verdict colours, so the colour
 * language reads the same; it just no longer runs into the evidence list's copy.
 *
 * **The rows are `FoldRow`, the same line the evidence list is made of**, with the
 * dot before the title carrying the side the cause points to: green for the one
 * that points at cover, red for the one that points away. That is deliberately the
 * vocabulary the evidence rows use for a call — close but not identical, since red
 * there means *deny* and red here means *this argues against cover*. One colour
 * language over both lists is worth the slight stretch: a reader who has learned
 * the column once has learned it everywhere.
 *
 * **It used to use Radix `Collapsible`, and it now holds its own open state.** Not
 * because the old chevron was broken — it was not. The claim that it never turned
 * came from reading `getComputedStyle().transform`, which is the wrong property:
 * Tailwind v4 writes `rotate-*` to the standalone `rotate` property, and measured
 * there the same pattern in ./primitives.tsx `Section` reports `90deg` exactly as
 * written. The reason to hold the state here is `FoldRow`: its rows carry controls
 * that must sit outside the toggle, which is easier as plain state than as a
 * `Collapsible` per row.
 */
export function Finding({ action }: { action: CaseAction }) {
  const causes = action.causes ?? [];
  if (causes.length === 0) return null;

  return (
    <Rows>
      {/* THE ASIDE IS THE SECTION'S CONCLUSION, not a count of its rows.
          It read "both established" once, which was the rows below it dressed as
          a status — each of them already carries its own `established` stamp
          inside the fold, so the heading was arguing with its own list. What
          belongs here instead is the one thing the two rows do NOT say
          individually: that no rule resolves them together. */}
      <Band title="Findings" aside={action.verdict ? <VerdictTag verdict={action.verdict} /> : undefined} />
      {causes.map((c) => (
        <CauseRow key={c.label} cause={c} />
      ))}
    </Rows>
  );
}

/**
 * THE CONCLUSION, IN THE TITLE BAR — a chip, not a block under the rows.
 *
 * It was an inset alert at the foot of the group: a rimmed, primary-washed box
 * holding one sentence. Correct in colour and wrong in shape — a full-width box
 * directly under two cause rows has the silhouette of a third cause row, so the
 * section's judgement read as one more item in the list it was judging. Moved up
 * beside the heading it belongs to, it costs the card **80px** (the group measures
 * 145px against 225px) and it stops competing with its own rows.
 *
 * **A chip rather than plain text, and that is the whole reason it is a component.**
 * This is the one thing on that bar which is not a heading, and 12px text beside a
 * 14px semibold title just reads as a subtitle. The pill marks it as a different
 * KIND of object. It also keeps the wash and the glyph the alert established, so a
 * reader who learned that box has nothing to unlearn.
 *
 * **`/10` and `/30`, because those are the steps that exist.** `bg-primary/[0.06]`
 * is emitted nowhere — not by the shell's Tailwind, not by the prebuilt `.wrc`
 * sheet — and `border-primary/25` falls through to the plain border colour. Both
 * measured on the running page; see ./EvidenceList.tsx on why a class in this
 * folder is only real if one of the two stylesheets already contains it.
 *
 * **The headline's trailing comma is trimmed here, not in the data.**
 * `verdict.headline` is authored as "No rule covers both causes," precisely so the
 * old box could run it into `detail` as one sentence. The chip is a label, so it
 * takes the clause off — but the fixture keeps its wording, because the string is
 * still one sentence for anything else that reads it and rewriting it there would
 * fight an edit in flight.
 *
 * **The clause is not thrown away, it moves to the hover.** "as they point towards
 * opposite decisions" is the REASON no rule covers both, which is worth keeping and
 * is not worth a line of the card. Chip as the marker, sentence on hover — the same
 * split `RecommendedTag` uses on the decision below (./decision/DecisionSection.tsx).
 */
function VerdictTag({ verdict }: { verdict: NonNullable<CaseAction["verdict"]> }) {
  // "No rule covers both causes," → "No rule covers both causes"
  const label = verdict.headline.replace(/[,.;:]\s*$/, "");
  // The clause is written to follow the headline ("as they point…"), so it needs a
  // capital to stand as the sentence the tooltip makes it.
  const detail = verdict.detail
    ? verdict.detail.charAt(0).toUpperCase() + verdict.detail.slice(1)
    : null;

  const chip = (
    <ToneChip tone="brand" className={detail ? "cursor-help" : undefined}>
      <Info className="size-3.5 shrink-0 text-primary" aria-hidden />
      {label}
    </ToneChip>
  );

  if (!detail) return chip;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      {/* `bg-app-text text-app-card`, and it is a workaround for the shared
          component rather than a preference. `TooltipContent` (../ui/tooltip.tsx)
          paints `bg-foreground text-background` and PORTALS to `document.body` —
          outside the `.wrc` root — where `bg-foreground` resolves and
          `text-background` does not emit at all, so the label inherits the shell's
          near-black ink onto a near-black panel. `app-text` / `app-card` are the
          shell's own paired tokens: both resolve out there and they invert together
          in the dark theme. Same fix, same reasoning as `RecommendedTag`. */}
      <TooltipContent side="top" className="max-w-60 bg-app-text text-app-card">
        {detail}
      </TooltipContent>
    </Tooltip>
  );
}

function CauseRow({ cause }: { cause: DecisionCause }) {
  const [open, setOpen] = useState(false);
  const us = cause.side === "covered";

  return (
    <FoldRow
      tone={us ? "ok" : "bad"}
      title={cause.title}
      open={open}
      onToggle={() => setOpen((o) => !o)}
      right={
        <>
          {/* The summary sits where the evidence row's first control sits, and the
              side pill where its second does — same rhythm, read-only. */}
          <span className={cn(TYPE.small, "max-w-[38%] shrink truncate text-muted-foreground")}>
            {cause.summary}
          </span>
          {/* NO GLYPH AND NO FIXED WIDTH. The ✓/✗ said what the word and the
              colour already say three times over, and the 88px box existed to
              align two short labels that are now long enough to align on their
              own right edge — which is the edge the row aligns on anyway. */}
          <ToneChip tone={us ? "ok" : "bad"}>
            {us ? "On us" : "Claimant fault"}
          </ToneChip>
        </>
      }
    >
      <p className={cn(TYPE.body, INK.ink2, "leading-relaxed")}>{cause.body}</p>
      <div className="mt-2 flex flex-wrap gap-3">
        <Mono>{cause.established}</Mono>
        <Mono>{cause.sources.join(" · ")}</Mono>
      </div>
    </FoldRow>
  );
}
