import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CallDot, LabelledSelect, RankBars } from "@/components/coverage/LabelledSelect";
import { COL, COL_HINT } from "@/components/coverage/evidenceColumns";
import {
  CALL_OPTIONS,
  IMPORTANCE_OPTIONS,
  type EvidenceCall,
  type EvidenceItem,
  type Importance,
} from "@/lib/coverage/fixture";
import { cn } from "@/lib/utils";

/**
 * WRITING AN EVIDENCE ITEM — the same object the rows around it draw, as a form.
 *
 * **It replaced a single input.** Adding used to append a blank row to the list
 * with one autofocused field asking for a name, which was wrong three ways over: a
 * row here has a title, a description, what it backs and where it came from, and
 * the form asked for a quarter of that; the half-built row was in the store from
 * the first keystroke, so abandoning the gesture left a nameless item behind; and
 * it arrived carrying `medium` / `approve`, which are judgements nobody had made
 * on a list that feeds the dock's recommendation.
 *
 * So: local state, committed once. Cancel leaves nothing behind, and the store
 * only ever holds items somebody finished.
 *
 * ## It is a row of the list, so it sits on the list's own grid
 *
 * The name takes the title column and **the two selects sit in the real Relevance
 * and Decision cells** (./evidenceColumns.ts), in the compact 28px trigger every
 * finished row uses, dashed while unset. A reader filling this in sees the row they
 * are making — which is also why it opens IN the list, where the row will be,
 * rather than over it.
 *
 * That is a correction, not a restatement. The form used to announce itself: a 3px
 * primary rule down its left edge, a `bg-primary/5` wash, an all-caps "New
 * evidence" caption, a 36px 16px-semibold title field, and its own pair of 36px
 * captioned selects parked at x≈110–265 while the columns they belong to were at
 * 1112 and 1282. Two devices the page had dropped everywhere else, and a form 280px
 * tall bolted onto 48px rows. It is 158px now, on `bg-muted/40`, and its controls
 * land on the column edges.
 *
 * ## Two fields are required, three are behind a button
 *
 * `Name` and `Description` carry their asterisk in the placeholder and **Add stays
 * disabled until both have text** — an asterisk that gates nothing is decoration.
 * `Origin`, `Claim line` and `Amount` are what most added items will not have, so
 * they are one press away. There is no way back out of that press: the control that
 * used to fold them away again said "Less detail", which named the mechanism rather
 * than the effect and read as noise. None of the three attaches anything — this
 * surface does not take documents.
 *
 * ## Tokens
 *
 * The console's own (`bg-card`, `border-border`, `text-muted-foreground`), and the
 * app's own `Button` for Cancel and Add, at `size="sm"` — 32px/14px, the size the
 * row's Edit and Remove use and the height of the fields beside it.
 */

/** What the composer holds while it is being filled in. */
export interface EvidenceDraft {
  name: string;
  note: string;
  source: string;
  backsLabel: string;
  backsAmount: string;
  importance: Importance | null;
  call: EvidenceCall | null;
}

/** An existing item, back into the shape the composer edits. */
export function draftFrom(item: EvidenceItem): EvidenceDraft {
  return {
    name: item.name,
    note: item.note,
    source: item.sources.join(" · "),
    backsLabel: item.backs?.label ?? "",
    backsAmount: item.backs ? String(item.backs.amount) : "",
    importance: item.importance,
    call: item.call,
  };
}

/**
 * ONE FIELD HEIGHT, and 32px is what this row can carry.
 *
 * The form had three heights — a 36px title, 34px selects and 32px buttons — which
 * is the kind of inconsistency nothing points at and everything reads as sloppy.
 * 32 is `size="sm"` on ../ui/button.tsx, so the fields, Cancel and Add are all one
 * height; it also leaves the compact 28px triggers beside them reading as the
 * chrome they are. The 36px `size="default"` was right when this form stood alone
 * and wrong now that it is a 48px row's worth of line.
 *
 * `text-sm` throughout: 14px is the row's own type, and it is what the field will
 * hold once somebody types in it.
 */
const FIELD =
  "h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring";

const EMPTY: EvidenceDraft = {
  name: "",
  note: "",
  source: "",
  backsLabel: "",
  backsAmount: "",
  importance: null,
  call: null,
};

/** The draft as the store wants it. Blank optional parts become absent, not empty. */
function toItem(d: EvidenceDraft): Omit<EvidenceItem, "id"> {
  const amount = Number(d.backsAmount.replace(/[^0-9.]/g, ""));
  return {
    name: d.name.trim(),
    note: d.note.trim(),
    // A label with no number is not a claim about money, so it is not carried.
    backs:
      d.backsLabel.trim() && Number.isFinite(amount) && amount > 0
        ? { label: d.backsLabel.trim(), amount }
        : null,
    sources: d.source
      .split("·")
      .map((x) => x.trim())
      .filter(Boolean),
    importance: d.importance,
    call: d.call,
    addedByReviewer: true,
  };
}

export function EvidenceComposer({
  initial,
  submitLabel,
  onCommit,
  onCancel,
}: {
  /** Omitted when adding; the row's own values when editing. */
  initial?: EvidenceDraft;
  submitLabel: string;
  onCommit: (item: Omit<EvidenceItem, "id">) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<EvidenceDraft>(initial ?? EMPTY);
  // Whether the three optional fields are on screen. Open from the start where the
  // item being edited already has one — a field holding a value must not be behind
  // a button. One flag, not one per field: they are asked for together and they fit
  // on one line together.
  const [showMore, setShowMore] = useState(
    Boolean(initial?.source || initial?.backsLabel || initial?.backsAmount),
  );

  const set = <K extends keyof EvidenceDraft>(key: K, value: EvidenceDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // BOTH REQUIRED FIELDS, because both placeholders promise it. The title is what
  // the row prints and what every select on it is labelled by; the description is
  // the whole of what a reader gets when they open the row, and an item that says
  // nothing is an item nobody can weigh.
  const ready = draft.name.trim().length > 0 && draft.note.trim().length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        onCommit(toItem(draft));
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
      className="bg-muted/40"
    >
      {/* THE ROW'S OWN LINE: the name where the title goes, the selects in their
          columns. `gap-2.5` and `px-3.5` are `FoldRow`'s, so the cells land on the
          same edges as every finished row's and as the headings in the band.

          No glyph leads it. A `+` sat in the chevron gutter here, which put a
          decoration in the one place on this card where a glyph means "press me". */}
      <div className="flex items-center gap-2.5 px-3.5 py-2">
        {/* autoFocus is right here and wrong on the floating capture bar next door:
            this form is opened by a deliberate press, so the caret is what the
            press asked for. */}
        <input
          autoFocus
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Name *"
          aria-label="Evidence name (required)"
          required
          className={cn(FIELD, "min-w-0 flex-1")}
        />
        {/* `width={0}` — the trigger sizes itself from the inside out and the cell
            holds the column edge, exactly as on a finished row. The `hint`s are the
            shared ones, so hovering a heading, a row's control or this one answers
            the same question. */}
        <span className={cn("flex shrink-0 justify-end", COL.relevance)}>
          <LabelledSelect
            compact
            caption="Relevance"
            value={draft.importance}
            options={IMPORTANCE_OPTIONS}
            onChange={(importance) => set("importance", importance)}
            icon={(v) => <RankBars value={v} />}
            width={0}
            ariaLabel="Relevance"
            hint={COL_HINT.relevance}
          />
        </span>
        <span className={cn("flex shrink-0 justify-end", COL.decision)}>
          <LabelledSelect
            compact
            caption="Decision"
            value={draft.call}
            options={CALL_OPTIONS}
            onChange={(call) => set("call", call)}
            icon={(v) => <CallDot value={v} />}
            width={0}
            ariaLabel="Decision"
            hint={COL_HINT.decision}
          />
        </span>
      </div>

      {/* EVERYTHING ELSE RUNS THE FULL WIDTH, to the same right edge the last
          column ends on — 1282px on the running page, which is also where the
          rationale textarea above ends. So the description, the optional line and
          the two buttons all finish on a vertical the card already has. (Not the
          Submit button's edge: that sits 15px further out at 1297, outside this
          bordered group and against the card's own padding.) */}
      <div className="flex flex-col gap-2 px-3.5 pb-2.5">
        <textarea
          value={draft.note}
          onChange={(e) => set("note", e.target.value)}
          placeholder="Description *"
          aria-label="What this evidence shows (required)"
          required
          rows={2}
          className={cn(
            FIELD,
            // The one field that is not 32px: it holds a sentence, so it gets two
            // lines. Height comes from `rows`, hence no `h-8`.
            "h-auto resize-y py-1.5 leading-relaxed",
          )}
        />

        {showMore && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={draft.source}
              onChange={(e) => set("source", e.target.value)}
              placeholder="Origin"
              aria-label="Where this evidence came from"
              className={cn(FIELD, draft.source && "font-mono", "min-w-0 flex-1")}
            />
            <input
              value={draft.backsLabel}
              onChange={(e) => set("backsLabel", e.target.value)}
              placeholder="Claim line"
              aria-label="Which line of the claim this backs"
              className={cn(FIELD, "min-w-0 flex-1 max-w-[210px]")}
            />
            <input
              value={draft.backsAmount}
              onChange={(e) => set("backsAmount", e.target.value)}
              inputMode="decimal"
              placeholder="Amount"
              aria-label="Amount"
              className={cn(FIELD, "w-[130px] shrink-0 tabular-nums")}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {/* ONE PRESS, NO WAY BACK. The pair of dashed pills that used to open
              these fields one at a time, and the "Less detail" control that folded
              them away, are both gone: a reviewer who opened three empty inputs has
              lost nothing worth a control, and the label named the mechanism. */}
          {!showMore && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowMore(true)}
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground [&_svg]:size-3"
            >
              <Plus aria-hidden /> Add origin, claim line or amount
            </Button>
          )}
          {/* The two commit controls are RIGHT-ALIGNED, on the column edge. Every
              other pair of buttons on this page ends on that vertical. */}
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!ready}>
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
