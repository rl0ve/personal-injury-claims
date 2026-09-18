import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Banknote,
  Check,
  ChevronDown,
  Highlighter,
  Pencil,
  Plus,
  Scale,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { INK, Label, TYPE } from "@/components/coverage/primitives";
import { CallDot, RankBars } from "@/components/coverage/LabelledSelect";
import { moneyExact, timeOnly } from "@/lib/claims/format";
import { CALL_OPTIONS, IMPORTANCE_OPTIONS, RESOLUTIONS } from "@/lib/coverage/fixture";
import { changeValueLabel, type Change } from "@/lib/coverage/store";
import type { EvidenceItem } from "@/lib/coverage/fixture";
import type { DecisionEffect } from "@/lib/claims/types";
import { cn } from "@/lib/utils";

/**
 * THE MANIFEST'S GLYPHS — two readings per row, neither of them a word.
 *
 * The rows say what they said before, character for character. What is new sits
 * beside the text: which part moved, and how it moved.
 *
 * **Not who moved it.** `changesSince` tags every line `by: "you" | "agent"`
 * (../../../lib/coverage/store.ts), and a third mark at the row's right edge drew
 * it — `AiMark` against `UserRound`, the head's own pair. It came back out: on a
 * filed record almost every line is the reviewer's, so the column was a stack of
 * the same glyph with an occasional exception in it, and it put a third thing to
 * read on a row whose job is to say what the value used to be. The attribution
 * stays in the data for whatever wants it next; the stamp above still counts it.
 */

/** One 14px muted glyph per part. The word stays; this is the scan target. */
const PART_ICON: Record<Change["part"], typeof Scale> = {
  // The Decision head's own icon, 200px up the same card.
  Resolution: Scale,
  // The one glyph this app did not already have — there is no money icon in it.
  Refund: Banknote,
  // The folder's edit glyph (../EvidenceList.tsx, ./RationalePanel.tsx).
  Rationale: Pencil,
  // The folder's evidence glyph (../EvidenceComposer.tsx).
  Evidence: Highlighter,
};

/**
 * The enums, inverted off the store's own spelling.
 *
 * A relevance move draws `RankBars` and a call move draws `CallDot` — the exact
 * components the evidence rows above this panel draw, so neither is a vocabulary
 * the reader has to learn twice. Both need the enum back out of a printed label,
 * and `changeValueLabel` is the function that printed it, so mapping the options
 * through it is an exact inverse rather than a guess at one.
 *
 * A string in neither set — a money figure, "Added", a resolution name — falls
 * through to `null` and the row draws no value glyph, which is correct: those are
 * not points on a scale.
 */
const rankOf = (v: string | null) =>
  IMPORTANCE_OPTIONS.find((o) => changeValueLabel(o.value) === v)?.value ?? null;
const callOf = (v: string | null) =>
  CALL_OPTIONS.find((o) => changeValueLabel(o.value) === v)?.value ?? null;

/** The value's own glyph, where the value is on a scale the reader knows. */
function ValueGlyph({ value }: { value: string | null }) {
  const rank = rankOf(value);
  if (rank) return <RankBars value={rank} />;
  const call = callOf(value);
  if (call) return <CallDot value={call} />;
  return null;
}

/**
 * What KIND of move it was, for the three that have no "from" to compare against.
 *
 * Keyed off `to` because that is where `changesSince` puts them: an added item, a
 * removed one and a rewritten rationale are all `from: null`, so the arrow and the
 * before-value never render and the row would otherwise open on bare text.
 */
function MoveGlyph({ change }: { change: Change }) {
  if (change.to === "Added") return <Plus className="size-3.5 shrink-0 text-success" />;
  if (change.to === "Removed") return <Trash2 className="size-3.5 shrink-0 text-destructive" />;
  if (change.to === "Rewritten") return <Pencil className="size-3.5 shrink-0 text-muted-foreground" />;
  return null;
}

/**
 * SHOW THE "RECORDED" CARD — off, by request, and off is why this is a constant
 * rather than a flag.
 *
 * The card lists the six downstream effects a filed decision sets in motion —
 * the WT-9 write, the SAP accrual, the notification, the dispatch release, the
 * quality referral, the ledger entry. It is not wanted on screen for now.
 *
 * **Not a `FeatureFlags` entry** (../../../lib/flags.ts). Those are presenter
 * switches — things worth toggling mid-rehearsal to see how a beat lands — and
 * they earn a row in the panel and a line of persisted localStorage each. This
 * is not a switch anybody wants at the podium; it is a section held back until
 * it is asked for. A constant says that, costs nothing, and greps.
 *
 * **Not commented-out JSX either.** The block still type-checks and still reads
 * `effects`, so a change to `DecisionEffect` cannot quietly rot it while it is
 * off. Turning it back on is one word here.
 */
const SHOW_RECORDED: boolean = false;

/**
 * THE FORM, FILED — the same four parts, in the same order, frozen.
 *
 * **What landed here before showed two of them.** A headline, six downstream
 * effects and the rationale; the refund was a bare number with neither the
 * authority it was checked against nor the figure the claimant was left with, and
 * the evidence under it was the LIVE list — still editable, "Add evidence" and
 * all, on a card stamped Decided. The submit bar had just declared four parts; the
 * record showed half of them and let one of those halves keep moving.
 *
 * **So it is the form again, in the order it was filled in.** Resolution, refund
 * and authority, rationale, evidence. Nothing to learn on arrival and nothing to
 * hunt for: each value sits where it was typed, which is the whole argument for
 * this shape over a differently-organised receipt. The unchosen resolutions stay
 * on screen, dimmed, because "one of three" is part of what was decided — and the
 * one the agent opened on is marked, so the record says where it started without
 * anybody reading the manifest.
 *
 * **`What changed` is last, and outside the form.** It was above it, on the
 * argument that a reader wants "did anybody depart from the machine, and who"
 * before the values — but that is an edit history in front of the decision it
 * edited, and the record already answers the same question in its stamp. The
 * values first, then how they got there.
 *
 * Attribution is still the point of the panel rather than decoration on it: on
 * this fixture a reviewer who re-weights one row moves the agent, which then
 * rewrites the resolution, the refund and the rationale, and a manifest that
 * credited all four to the person would be wrong about three.
 *
 * **Read-only, and that is a behaviour change made on purpose.** The list was
 * editable after a decision before, defended on the grounds that it had always
 * been. That held while the evidence sat in another card and was not part of what
 * the button submitted. It stopped holding when the bar started naming the
 * evidence in the payload: a record that can be edited after it is signed is not a
 * record. `Reopen` is the way back, and it is unchanged.
 */
export function FiledRecord({
  outcome,
  refund,
  reason,
  evidence,
  at,
  limit,
  claim,
  deciderName,
  changes,
  effects,
  fullName,
  shortName,
  onReopen,
}: {
  outcome: string;
  refund: number;
  reason: string;
  /** The list AS SUBMITTED — frozen at the press, not the live one. */
  evidence: EvidenceItem[];
  at: string;
  limit: number;
  claim: number;
  deciderName: string;
  changes: Change[];
  effects: DecisionEffect[];
  /** The section's own display names, passed rather than re-derived. */
  fullName: (outcome: string) => string;
  shortName: (outcome: string) => string;
  onReopen: () => void;
}) {
  // Only the stamp still counts anything — the manifest below stopped tallying
  // itself, so the agent's half of the split has no reader left.
  const byYou = changes.filter((c) => c.by === "you").length;


  return (
    <div className="flex flex-col gap-4">
      {/* ── the stamp ── */}
      <div className="flex items-start gap-3">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-success text-success-foreground">
          <Check className="size-3" />
        </span>
        <div className="min-w-0 flex-1">
          <div className={TYPE.title}>
            {fullName(outcome)} — <span className="tabular-nums">{moneyExact(refund)}</span> refunded
          </div>
          {/* "Submitted", and the count — nothing about whose position it was.
              It read "signed on the agent's position, unchanged" or "signed after
              2 changes of your own", which named the agent, used a word no other
              string on the card uses any more, and spent eight words on a number.
              The manifest below already itemises what moved. */}
          <div className={cn(TYPE.small, INK.ink2)}>
            {deciderName} · {timeOnly(at)} ·{" "}
            {byYou === 0
              ? "submitted with no changes"
              : `submitted after ${byYou} ${byYou === 1 ? "change" : "changes"}`}
          </div>
        </div>
        <Button variant="outline" onClick={onReopen}>
          Reopen
        </Button>
      </div>

      {/* ── the form, frozen ──
          `aria-readonly` and no interactive elements at all: the dimming is a
          style, and a screen reader needs the fact. */}
      <div aria-readonly className="flex flex-col gap-3.5">
        <div>
          {/* JUST THE LABEL. The lock and "as signed" beside it were saying what
              the two unpicked cards already say by sitting at 45% opacity with no
              controls in them — and `aria-readonly` on the wrapper carries the
              fact for a screen reader, which is the half that needed stating. */}
          <div className="mb-1.5">
            <Label>Resolution</Label>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {RESOLUTIONS.map((o) => {
              const picked = o.outcome === outcome;
              return (
                <div
                  key={o.outcome}
                  className={cn(
                    "rounded-lg border px-3 py-2.5",
                    picked
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border opacity-45",
                  )}
                >
                  {/* NO "signed" CHIP. The picked card is the only one of the
                      three at full opacity, with a primary border and a ring
                      around it, in a group the wrapper marks `aria-readonly` —
                      the chip was a fourth way of saying the same thing to a
                      reader who has already been told three times. */}
                  <div className="flex items-baseline gap-1.5">
                    <span className={cn(TYPE.body, "font-semibold")}>{shortName(o.outcome)}</span>
                  </div>
                  <span className={cn(TYPE.small, "text-muted-foreground")}>{o.note}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {/* The authority context the headline drops. A refund is only readable
              against the limit it was checked against and the figure it left with
              the claimant; the old record printed the number alone. */}
          <div className="rounded-xl border border-border bg-card p-4">
            <span className={cn(TYPE.body, "mb-3 block font-semibold")}>Refund &amp; authority</span>
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <Label>Refund</Label>
                <div className={cn(TYPE.title, "tabular-nums")}>{moneyExact(refund)}</div>
              </div>
              <div>
                <Label>Paid by the claimant</Label>
                <div className={cn(TYPE.title, "tabular-nums")}>{moneyExact(claim - refund)}</div>
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${limit > 0 ? Math.min(100, (refund / limit) * 100) : 0}%` }}
              />
            </div>
            <div className={cn(TYPE.small, "mt-1 flex justify-between text-muted-foreground")}>
              <span className="tabular-nums">
                {moneyExact(refund)} of {moneyExact(limit)}
              </span>
              <span>your authority</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3">
              <span className={cn(TYPE.body, "font-semibold")}>Rationale</span>
            </div>
            <p className={cn(TYPE.body, INK.ink2, "m-0 leading-relaxed")}>{reason}</p>
          </div>
        </div>

        <FiledEvidence evidence={evidence} />

        {/* HIDDEN, NOT DELETED — see `SHOW_RECORDED` at the top of this file. */}
        {SHOW_RECORDED && (
        <div className="rounded-xl border border-border bg-card p-4">
          <span className={cn(TYPE.body, "mb-2 block font-semibold")}>Recorded</span>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {effects.map((e) => (
              <li
                key={e.title}
                className={cn(TYPE.small, "flex gap-2", e.hold ? "text-warning-foreground" : INK.ink2)}
              >
                <Check className={cn("mt-0.5 size-3 shrink-0", e.hold ? "text-warning" : "text-success")} />
                <span>
                  {e.title}
                  {e.detail ? <span className="text-muted-foreground"> — {e.detail}</span> : null}
                  {e.hold ? <span className="text-warning"> · held</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
        )}
      </div>

      {/* ── WHAT CHANGED — LAST, AND THE ONLY PLACE THE DIFF IS TOLD ──────
          It sat between the stamp and the form, which put an edit history in
          front of the decision it edited. The record reads what was decided, then
          what it rested on, then what a person did to it — so this is the third
          of those and goes third.

          It is also the ONLY one now. The evidence rows below used to carry a
          "you: Low → High" chip built from this same `changes` array, filtered to
          `part === "Evidence"` — the same fact in a second grammar, and a partial
          copy: only evidence changes earned a chip, so the row markers and this
          list could never agree on what "the changes" were.

          OUTSIDE the `aria-readonly` wrapper above, deliberately. That element is
          the form as signed; this is commentary on how it got that way, and
          marking it read-only would say it was one of the fields. */}
      <div className="overflow-hidden rounded-xl border border-border">
        {/* NO TALLY. It read "2 by you · 1 by the agent in answer" over a list of
            exactly those rows — a count of the thing directly beneath it, which a
            reader can do by looking. The empty case said "nothing — filed as the
            agent proposed it" and the paragraph below already says that in full,
            so nothing is lost there either. */}
        <div className="flex items-baseline gap-2 border-b border-border/60 px-3.5 py-2">
          <span className={cn(TYPE.body, "font-semibold")}>What changed</span>
        </div>
        {changes.length === 0 ? (
          /* THE SENTENCE IS UNCHANGED; the tick is what it gained. A paragraph on
             its own read as prose the reader has to finish to learn it says
             "nothing" — the mark says it before the words do. */
          <p className={cn(TYPE.small, INK.ink2, "m-0 flex items-start gap-2 px-3.5 py-2.5")}>
            <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
            <span>
              The resolution, the refund, the rationale and all {evidence.length} evidence items are
              as the case opened.
            </span>
          </p>
        ) : (
          changes.map((c, i) => {
            const PartIcon = PART_ICON[c.part];
            return (
              /* A GRID, NOT A FLEX ROW WITH A SPACER.
                 The part used to sit in a `w-[88px]` box inside a flex row, which
                 is a grid column done by hand — and it only held while every row
                 started with plain text. Rows carry glyphs of different widths
                 now, so the four readings are four real columns and they line up
                 down the whole list.

                 `items-center` for the same reason: `items-baseline` aligned text
                 that no longer sits alone on its line. */
              <div
                key={`${c.part}-${i}`}
                className="grid grid-cols-[14px_88px_minmax(0,1fr)] items-center gap-x-2.5 border-b border-border/50 px-3.5 py-2 transition-colors last:border-0 hover:bg-muted/40"
              >
                <PartIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className={cn(TYPE.small, "text-muted-foreground")}>{c.part}</span>
                <span className={cn(TYPE.small, "flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1")}>
                  {/* The subject leads, because on an evidence row "Low → High" is
                      meaningless until you know which row moved. */}
                  {c.subject ? <span className="font-semibold">{c.subject} ·</span> : null}
                  {c.from ? (
                    <>
                      <ValueGlyph value={c.from} />
                      <span className="text-muted-foreground line-through">{c.from}</span>
                      {/* An icon rather than the `→` character: with glyphs either
                          side of it, a text arrow sits on the wrong baseline. */}
                      <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                    </>
                  ) : null}
                  <MoveGlyph change={c} />
                  <ValueGlyph value={c.to} />
                  <span className="font-semibold">{c.to}</span>
                  {/* AFTER the figure, because it reads as a verdict on the move
                      rather than as part of the value: "$4,940.00, and that is
                      up". Only the refund sets it — the store's note says why. */}
                  {c.up === true ? (
                    <ArrowUp className="size-3.5 shrink-0 text-success" aria-label="up" />
                  ) : c.up === false ? (
                    <ArrowDown className="size-3.5 shrink-0 text-muted-foreground" aria-label="down" />
                  ) : null}
                  {c.detail ? <span className="text-muted-foreground">· {c.detail}</span> : null}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * The evidence as it was submitted — the same row grammar, without the controls.
 *
 * THE EVIDENCE, AND NOTHING ABOUT WHO MOVED IT. Rows the reviewer touched used
 * to carry a "you: Low → High" marker, built by filtering the same `changes`
 * array the What changed block below reads. Two tellings of one fact, and this
 * was the lossy one: only `part === "Evidence"` entries could produce a marker,
 * so a record whose resolution, refund and rationale all moved showed markers on
 * none of them and a reader could not tell whether the list meant "these are the
 * changes" or "these are some of them".
 *
 * ## The rows open, and losing that was the regression
 *
 * Before submitting, every evidence row is a disclosure — press it and the note,
 * what it backs and where it came from appear (../EvidenceList.tsx). Filing froze
 * the list into flat lines, so the moment a decision was signed the reasoning
 * behind each item became unreadable. That is backwards: the filed record is the
 * version somebody comes back to, and "what did this rest on" is exactly the
 * question they arrive with.
 *
 * **Read-only, still.** Opening a row shows what it said; it does not bring back
 * the selects, the edit or the remove. Freezing the list was right — a record that
 * can be changed after it is signed is not a record — but freezing it was never
 * meant to mean hiding it.
 *
 * **A row with nothing to show is not a button.** Same rule the live list keeps: a
 * control that opens nothing is worse than no control.
 *
 * The open state is React's and the chevron's rotation is an inline transform, for
 * the reason ../primitives.tsx gives at length — in this folder a value that
 * changes on an interaction cannot safely be a variant class.
 */
function FiledEvidence({ evidence }: { evidence: EvidenceItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-baseline gap-2 border-b border-border/60 px-3.5 py-2">
        <span className={cn(TYPE.body, "font-semibold")}>Evidence</span>
        {/* The count alone. "as submitted ·" in front of it was the same claim the
            whole panel makes by existing. */}
        <span className={cn(TYPE.small, "ml-auto text-muted-foreground")}>
          {evidence.length} {evidence.length === 1 ? "item" : "items"}
        </span>
      </div>
      {evidence.map((e) => (
        <FiledEvidenceRow key={e.id} item={e} />
      ))}
    </div>
  );
}

function FiledEvidenceRow({ item: e }: { item: EvidenceItem }) {
  const [open, setOpen] = useState(false);
  const approve = e.call === "approve";
  const hasBody = Boolean(e.note || e.backs || e.sources.length > 0);

  const line = (
    <>
      <ChevronDown
        aria-hidden
        style={{ transform: open ? "rotate(180deg)" : undefined }}
        className={cn(
          "size-3.5 shrink-0 text-muted-foreground transition-transform",
          !hasBody && "opacity-0",
        )}
      />
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          e.call === null ? "bg-border" : approve ? "bg-success" : "bg-destructive",
        )}
      />
      <span className={cn(TYPE.body, "min-w-0 flex-1 truncate text-left")}>
        {e.name}
      </span>
      <span className={cn(TYPE.small, "w-[64px] shrink-0 text-left font-semibold")}>
        {e.importance ? e.importance.charAt(0).toUpperCase() + e.importance.slice(1) : "—"}
      </span>
      <span
        className={cn(
          TYPE.small,
          "w-[84px] shrink-0 text-left font-semibold",
          e.call === null ? "text-muted-foreground" : approve ? "text-success" : "text-destructive",
        )}
      >
        {e.call === null ? "—" : approve ? "✓ Approve" : "✗ Deny"}
      </span>
    </>
  );

  const rowClass = "flex w-full items-center gap-2.5 px-3.5 py-2 text-left";

  return (
    <div className="border-b border-border/50 last:border-0">
      {hasBody ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn(rowClass, "cursor-pointer transition-colors hover:bg-muted/50")}
        >
          {line}
        </button>
      ) : (
        <div className={rowClass}>{line}</div>
      )}

      {/* Indented past the chevron and the dot, so the reading lines up under the
          name it belongs to rather than under the markers. */}
      {open ? (
        <div className="pr-3.5 pb-2.5 pl-[42px]">
          {e.note ? (
            <p className={cn(TYPE.small, INK.ink2, "m-0 leading-relaxed")}>{e.note}</p>
          ) : null}
          {e.backs || e.sources.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
              {e.backs ? (
                <span className={cn(TYPE.small, "text-muted-foreground")}>
                  {e.backs.label}{" "}
                  <b className="ml-0.5 font-semibold tabular-nums text-foreground">
                    {moneyExact(e.backs.amount)}
                  </b>
                </span>
              ) : null}
              {e.sources.length > 0 ? (
                <span className={cn(TYPE.meta, "text-muted-foreground")}>{e.sources.join(" · ")}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
