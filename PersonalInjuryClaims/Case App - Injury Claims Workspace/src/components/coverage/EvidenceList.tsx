import { useState } from "react";
import { Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { Band, FoldRow, Mono, Rows, TYPE } from "@/components/coverage/primitives";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CallDot, LabelledSelect, RankBars } from "@/components/coverage/LabelledSelect";
import { EvidenceComposer, draftFrom } from "@/components/coverage/EvidenceComposer";
import { COL, COL_HINT } from "@/components/coverage/evidenceColumns";
import { CALL_OPTIONS, IMPORTANCE_OPTIONS, type EvidenceItem } from "@/lib/coverage/fixture";
import type { CoverageEvent } from "@/lib/coverage/store";
import { moneyExact } from "@/lib/claims/format";
import { cn } from "@/lib/utils";

/**
 * The items the recommendation rests on, each with two things the reviewer can
 * change — how much it matters, and what it argues for. A dot before each title
 * carries the call's colour so the column reads at a glance.
 *
 * ## Adding one is a form, not a blank row
 *
 * It used to append an item to the store and render a lone name field inside it.
 * The composer (./EvidenceComposer.tsx) replaced that and says why at length; what
 * matters here is where it goes. **Adding opens it at the foot of the list, where
 * the row will be. Editing opens it over the row being edited.** One component,
 * two mounts, so the two can never drift apart — and in both cases it is IN the
 * list rather than over it, because the thing being written is a row and a modal
 * would hide the rows it has to sit beside.
 *
 * `editing` and `adding` are one piece of state, not two booleans: the composer is
 * a single-occupancy slot, and two of them open at once is a state worth making
 * unrepresentable rather than remembering not to cause.
 *
 * ## A row is one line until you ask it for more
 *
 * Every item used to print its whole case whether anybody was reading it or not —
 * 111px a row, and three of them filled the card. Shut, a row is 48px: a chevron,
 * the call's dot, the title, and the two controls. The note, what it backs and
 * where it came from are one press away, which is where content belongs on a
 * surface whose first act is to scan a column and its second is to read one item.
 *
 * **Everything opens shut, the agent's items included.** Opening the most important
 * one was the obvious alternative and is worse: a list with one row open for a
 * reason nobody stated reads as a bug rather than as a hint.
 *
 * ## The reviewer's own rows are marked, and only those can be touched
 *
 * A chip beside the title, and Edit / Remove in the opened body. The agent's items
 * carry neither: they are the record this decision is being taken against, and a
 * list where any row could be deleted is one where "three items" stops meaning
 * anything.
 *
 * ## A standing hazard in this app, since two passes have now hit it
 *
 * It ships a PREBUILT stylesheet (../../../claims-console/claims-console.css —
 * a build artifact shared with v1) nested inside `.wrc`, and the shell's Tailwind
 * ALSO compiles these files. Both emit at the same specificity, so where they
 * collide the console's sheet wins by source order — which is why a shell-only
 * variant over a base class the console also has silently loses. It cost this file
 * a `group-hover:` reveal that was invisible at every state. What is safe: a class
 * the console sheet already contains, an arbitrary value nothing competes with, or
 * a conditional class through `cn` (it is `twMerge`, so only one survives). What is
 * not: assuming a variant applies because it type-checks. `rotate-90` is absent and
 * `rotate-180` is present, which is why the chevron flips rather than turns.
 */
/* THE TWO CONTROL COLUMNS live in ./evidenceColumns.ts, with the measurements
   that produced their widths. They moved out of this file because three things
   have to agree on those edges — the headings below, every row, and the
   composer's own line — and this file already imports the composer, so it
   cannot be the one that owns them. */
/**
 * THE COLUMN HEADINGS, as the band's own right-hand side.
 *
 * The compact trigger dropped the captions the form variant has and replaced them
 * with a hover hint, so the two columns are unlabelled until a reviewer thinks to
 * hover one. A heading says it without the hover — and once the columns are named,
 * their fixed edges read as a table rather than as ragged space.
 *
 * **`gap-2.5` HERE, not on the `Band`.** The headings only line up over the
 * controls if the space between them is the space between the cells, and that is
 * `FoldRow`'s `gap-2.5` (10px) — `Band`'s own gap is 12px, which would put the
 * Relevance heading 2px off its column. Grouping the two in one node keeps the
 * band's gap for the title/aside split and the row's gap for the columns. The
 * horizontal padding is shared: both use `px-3.5`.
 */
function ColumnHeads() {
  return (
    <span className="flex items-center gap-2.5">
      <ColumnHead width={COL.relevance} hint={COL_HINT.relevance}>
        Relevance
      </ColumnHead>
      <ColumnHead width={COL.decision} hint={COL_HINT.decision}>
        Decision
      </ColumnHead>
    </span>
  );
}

function ColumnHead({ width, hint, children }: { width: string; hint: string; children: string }) {
  return (
    // 1200ms, the same dwell the triggers use (../LabelledSelect.tsx) — long enough
    // that a pointer crossing the row on its way somewhere else does not raise it.
    // `delayDuration` goes on `Tooltip`, not a provider: the shared `Tooltip`
    // hardcodes a provider at 0 and a per-tooltip value beats it.
    <Tooltip delayDuration={1200}>
      <TooltipTrigger asChild>
        <span
          className={cn(
            TYPE.small,
            "shrink-0 cursor-help text-right font-medium text-muted-foreground",
            width,
          )}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-60 bg-app-text text-app-card">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}

export function EvidenceList({
  evidence,
  dispatch,
  addedByName,
}: {
  evidence: EvidenceItem[];
  dispatch: (e: CoverageEvent) => void;
  /**
   * WHOSE ROWS THE MARKED ONES ARE — the signed-in reviewer, passed in.
   *
   * `addedByReviewer` is a boolean, so the item itself does not know a name, and
   * every row it is true of was added in this session by the person looking at the
   * screen. Threaded from the decider name the decision is already signed with
   * rather than read from the role hook here: one source for "who is acting", and
   * this file stays a renderer. Switching persona therefore re-labels these rows,
   * which is correct — the demo's whole point is that the record says who.
   */
  addedByName: string;
}) {
  const [composer, setComposer] = useState<{ mode: "add" } | { mode: "edit"; id: string } | null>(
    null,
  );
  const close = () => setComposer(null);

  return (
    <Rows>
      {/* THE ASIDE IS THE TWO COLUMN HEADINGS — one strip, not two.
          The slot has now held three things. It briefly tallied the list ("4 items
          · 1 yours"), which is the list saying its own length twice. Then it held
          the Add trigger, which freed the foot but left the headings on a fenced
          strip of their own directly underneath: two mostly-empty lines and three
          rules before the first piece of evidence, 69px of chrome.

          The headings earn the slot because they are the only thing up here that
          has to align with something below it. The trigger does not, so it goes
          back to the foot. */}
      <Band title="Evidence" aside={<ColumnHeads />} />
      <div>
        {evidence.map((e) =>
          composer?.mode === "edit" && composer.id === e.id ? (
            <div key={e.id} className="[&+*]:border-t [&+*]:border-t-border">
              <EvidenceComposer
                initial={draftFrom(e)}
                submitLabel="Save"
                onCommit={(item) => {
                  dispatch({ type: "evidence.update", id: e.id, patch: item });
                  close();
                }}
                onCancel={close}
              />
            </div>
          ) : (
            <Row
              key={e.id}
              item={e}
              dispatch={dispatch}
              addedByName={addedByName}
              onEdit={() => setComposer({ mode: "edit", id: e.id })}
            />
          ),
        )}
      </div>

      {/* THE TRIGGER AND THE FORM ARE IN THE SAME PLACE AGAIN, which is the
          quiet win of moving the headings up: the form opens exactly where the
          button was pressed and exactly where the row it makes will live. While
          the trigger sat in the title bar the two were ~150px apart. */}
      {composer?.mode === "add" ? (
        <div className="border-t border-border">
          <EvidenceComposer
            /* "Add", not "Add evidence". The card is called Evidence, the button
               that opened this form said Add evidence, and the form is sitting in
               the list — the noun is established three times over by the time
               anybody reaches this button. */
            submitLabel="Add"
            onCommit={(item) => {
              dispatch({ type: "evidence.create", item });
              close();
            }}
            onCancel={close}
          />
        </div>
      ) : (
        <div className="border-t border-border px-2.5 py-2">
          {/* Outline, and 28px — the style chosen for it in the title bar, kept
              here so the control did not change identity when it moved. A rim at
              the foot risks reading as a fourth row, which is why it was ghost the
              first time; against the headings' 12px captions above, the rim is
              what keeps it legible as the one thing on this card you can press. */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setComposer({ mode: "add" })}
            className="h-7 gap-1.5 px-2.5 text-xs [&_svg]:size-3"
          >
            <Plus /> Add evidence
          </Button>
        </div>
      )}
    </Rows>
  );
}

function Row({
  item: e,
  dispatch,
  addedByName,
  onEdit,
}: {
  item: EvidenceItem;
  dispatch: (ev: CoverageEvent) => void;
  addedByName: string;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasBody = Boolean(e.note || e.backs || e.sources.length > 0 || e.addedByReviewer);

  return (
    <FoldRow
      // The row's own verdict, as the colour of its rule — the same three the
      // finding's causes use above it.
      tone={e.call === "approve" ? "ok" : e.call === "partial" ? "warn" : e.call === "deny" ? "bad" : null}
      title={e.name}
      open={open}
      onToggle={hasBody ? () => setOpen((o) => !o) : undefined}
      badge={
        e.addedByReviewer ? (
          /* A SILHOUETTE AND A NAME — no chip, no initials, no sentence.
             It was a `Badge` with a tinted ground, an initials avatar and the
             words "Added by": the shape this console gives a STATE, which is what
             the recommendation tag, the on-us/on-them markers and the eval
             verdicts are. This is not a state. It is a note about where one row
             came from, and dressing it as a badge gave it a verdict's weight.

             The prose went with the ground. A person glyph followed by a name
             already says somebody put this here, and only the reviewer's own rows
             carry it — so "Added by" was two words spelling out what the mark
             means rather than adding to it. `aria-label` keeps the sentence for a
             reader who cannot see the glyph.

             FILLED, not the outline. A hairline person at 12px against 10.5px
             type reads as a smudge; a solid one reads as a mark. `strokeWidth={0}`
             matters as much as the fill — lucide draws strokes, so filling alone
             leaves an outline thickening the silhouette from the inside. */
          <span
            aria-label={`Added by ${addedByName}`}
            className={cn(
              TYPE.small,
              "flex shrink-0 items-center gap-1 text-[10.5px] text-muted-foreground",
            )}
          >
            <UserRound
              className="size-3 shrink-0"
              fill="currentColor"
              // BOTH, and the inline style is the one that is guaranteed. lucide
              // writes `strokeWidth` as a presentation attribute, and any CSS rule
              // anywhere — a stylesheet this app cannot see the source of included
              // — beats a presentation attribute. An inline declaration does not
              // lose that race.
              strokeWidth={0}
              style={{ strokeWidth: 0 }}
              aria-hidden
            />
            {addedByName}
          </span>
        ) : undefined
      }
      right={
        /* `width={0}` STAYS — the trigger still sizes itself from the inside out.
           What changed is that it now sits in a fixed cell (`COL` above), so its
           own width no longer decides where the column is.

           The `hint`s name the AXIS, not its values, and they are shared with the
           column headings so a reviewer gets the same sentence whichever they
           hover. The scale is already on screen in the menu and in the bars, so
           listing it would be reading the control aloud. */
        <>
          {/* FIXED CELL, CONTROL RIGHT-ALIGNED IN IT. The cell holds the column
              edge; the trigger keeps its own width and its own styling — nothing
              about the control changed, only where it is allowed to sit. */}
          <span className={cn("flex shrink-0 justify-end", COL.relevance)}>
            <LabelledSelect
              compact
              caption="Relevance"
              value={e.importance}
              options={IMPORTANCE_OPTIONS}
              onChange={(importance) => dispatch({ type: "evidence.set", id: e.id, patch: { importance } })}
              icon={(v) => <RankBars value={v} />}
              width={0}
              ariaLabel={`Relevance — ${e.name}`}
              hint={COL_HINT.relevance}
            />
          </span>
          <span className={cn("flex shrink-0 justify-end", COL.decision)}>
            <LabelledSelect
              compact
              caption="Decision"
              value={e.call}
              options={CALL_OPTIONS}
              onChange={(call) => dispatch({ type: "evidence.set", id: e.id, patch: { call } })}
              icon={(v) => <CallDot value={v} />}
              width={0}
              ariaLabel={`Decision — ${e.name}`}
              hint={COL_HINT.decision}
            />
          </span>
        </>
      }
    >
      {e.note && <p className={cn(TYPE.body, "leading-relaxed text-muted-foreground")}>{e.note}</p>}
      {(e.backs || e.sources.length > 0) && (
        <div className="mt-2 flex flex-wrap items-baseline gap-3.5">
          {e.backs && (
            <span className={cn(TYPE.small, "text-muted-foreground")}>
              {e.backs.label}{" "}
              <b className="ml-0.5 font-semibold tabular-nums text-foreground">{moneyExact(e.backs.amount)}</b>
            </span>
          )}
          {e.sources.length > 0 && <Mono>{e.sources.join(" · ")}</Mono>}
        </div>
      )}

      {/* Edit and Remove live in the opened body. They were always about the
          item's content, and the content is what has just been opened — which
          also makes them findable, where a hover-only control on a 44px line
          never would be. */}
      {e.addedByReviewer && (
        <div className="mt-2.5 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil aria-hidden /> Edit
          </Button>
          {/* No confirm. It is one row, it belongs to the person pressing it, and
              a dialog over a list this short costs more than it protects. */}
          <Button
            variant="destructive-outline"
            size="sm"
            onClick={() => dispatch({ type: "evidence.remove", id: e.id })}
          >
            <Trash2 aria-hidden /> Remove
          </Button>
        </div>
      )}
    </FoldRow>
  );
}
