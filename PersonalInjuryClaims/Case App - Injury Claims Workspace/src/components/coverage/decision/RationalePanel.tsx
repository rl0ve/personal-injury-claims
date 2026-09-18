import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Highlighter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MENU, TYPE } from "@/components/coverage/primitives";
import { timeOnly } from "@/lib/claims/format";
import { attribute, type Mark } from "@/lib/coverage/wordDiff";
import type { ReasonRevision } from "@/lib/coverage/store";
import { cn } from "@/lib/utils";

/**
 * THE ROW CONTROL'S OWN CHROME, borrowed rather than re-invented.
 *
 * The evidence rows' `Importance` and `Decision` selects
 * (../LabelledSelect.tsx, `compact`) already settled what a small dropdown looks
 * like in this console: 28px, a real rim at rest, 12.5px type set slightly under
 * the text beside it, and a primary ring while open. The revision picker was a
 * different shape for no reason other than being written later, on a card whose
 * whole subject is the evidence those controls sit on.
 *
 * Copied as a constant rather than imported: `LabelledSelect` is a value-picker
 * with an icon slot, a caption and a tooltip, and this needs none of them. What is
 * shared is the chrome, so that is what is shared.
 */
const TRIGGER =
  "group flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-border px-2 text-left text-[12px] font-medium transition-[background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent data-[state=open]:border-ring data-[state=open]:ring-2 data-[state=open]:ring-ring h-7";

/**
 * Five lines at the field's own leading — the floor, not the size.
 *
 * 114 → 128. The floor is what sets the height of the whole pair: the Amount
 * panel beside it is shorter than this, so this is the number the row obeys, and
 * the width the money column gave up would otherwise have gone into a shorter
 * card rather than a taller field. Measured on the running card — see the
 * wrapper's note in ./DecisionSection.tsx.
 */
const MIN_H = 128;
/**
 * Fourteen lines, after which it scrolls.
 *
 * A ceiling as well as a floor, because "as tall as its content" has no upper
 * bound and the content is free text in a column that can be narrow. Measured
 * during this work: at a squeezed width the field grew to 3797px — the paragraph
 * wrapping to a hundred-odd lines and the card growing to hold every one.
 */
const MAX_H = 320;

/**
 * THE TYPOGRAPHY AND BOX BOTH LAYERS SHARE.
 *
 * One string, used twice, because the overlay only works while the mirror and the
 * textarea wrap identically — same face, same size, same leading, same padding,
 * same width. Two class lists that merely look alike is how the marks end up a few
 * pixels off the words they mark.
 */
const LAYER = "px-3 py-2.5 whitespace-pre-wrap break-words";

/**
 * THE SIZE AND LEADING, AS A STYLE — not as classes, and shared by both layers.
 *
 * `text-[13px]` in the class string loses to `text-foreground`: `tailwind-merge`
 * files both under `text`, so adding the colour silently drops the size and the
 * field renders at the browser's default 16px. Measured that happening during this
 * change. A colour added to either layer would do it again.
 *
 * It is also the one pair of values the overlay cannot afford to have drift. The
 * mirror and the textarea must wrap identically to the pixel, and two class
 * strings that merely look alike is how marks end up beside the words instead of
 * on them. One object spread into both cannot disagree with itself.
 *
 * 13px rather than the page's 14: this is the only field on the card holding a
 * paragraph, and a point buys about a line and a half of it at this measure.
 */
const LAYER_STYLE = { fontSize: 13, lineHeight: 1.62 } as const;

/**
 * A HAND'S MARK — a wavy rule under the words, not a wash behind them.
 *
 * It was a filled `bg-warning/25`, which sat in exactly the space the selection
 * highlight paints and muddied both. An underline occupies the strip below the
 * baseline, which nothing else uses: the selection can paint over the text
 * normally and the mark stays legible under it.
 *
 * **Inline, and it has to be.** The decoration paints on the MIRROR, whose text is
 * transparent — `text-decoration-color` is independent of the text colour, which
 * is the whole reason a squiggle survives on an invisible layer where a coloured
 * glyph would not. Writing it as classes would put four properties through the
 * merge and through this app's prebuilt stylesheet, where the focus ring was lost
 * the same way; and `skipInk: none` matters enough to be explicit, or a descender
 * punches a hole in the line under it.
 */
const SQUIGGLE = {
  textDecorationLine: "underline",
  textDecorationStyle: "wavy",
  textDecorationThickness: 1,
  textUnderlineOffset: 3,
  textDecorationSkipInk: "none",
} as const;

/**
 * The two hands, in the two colours this console already gives them.
 *
 * **`--primary`, not `--color-primary`.** The `@theme inline` bridge names the
 * utilities' colours without the prefix inside `.wrc`, and the prefixed form is
 * simply absent — measured empty. A decoration colour that fails to parse falls
 * back to `currentColor`, which on the mirror is `transparent`, so the squiggles
 * rendered invisibly and silently. Worse, `--color-warning` DOES resolve here, to
 * a different amber than `--warning`: it is one of the shell's own tokens reaching
 * into this scope, so the prefixed name would have been wrong rather than empty.
 *
 * The amber is darkened because `--warning` is tuned as a wash and a 1px wavy line
 * of it does not hold on white.
 */
const HAND_COLOUR: Record<"auto" | "you", string> = {
  auto: "var(--primary)",
  you: "color-mix(in oklab, var(--warning) 78%, #5d3f00)",
};

/**
 * THE ONE REQUIRED FREE-TEXT FIELD, given room, memory, and a way to tell the two
 * authors apart.
 *
 * **It clipped the answer.** A fixed 114px — five lines — against rationales that
 * need six or seven. It grows to its content now, with those five as a floor.
 *
 * **It had no memory.** The agent redrafts whenever the position moves and the
 * reducer overwrote the field to do it, so a reviewer who typed a paragraph and
 * then re-weighted a row lost the paragraph silently. Superseded drafts are kept
 * (`reasonHistory`), which is also why the rewrite can stay instant: nothing is
 * lost, so nothing has to be confirmed.
 *
 * **It could not say who wrote what**, which was the whole point of the exercise
 * and the thing an earlier pass of mine left out. Two mechanisms now, because they
 * answer different questions and only one of them can be always-on:
 *
 *   - **Inline, unprompted.** Your words carry a wash the moment you type them,
 *     compared against the draft you started over. It cannot show a REMOVAL —
 *     deleted words are not there to mark, and making space for them inside a
 *     field being typed in would move the cursor around while somebody works.
 *   - **`⇄`, on demand.** Freezes the field and shows the full comparison, both
 *     directions, against whichever version the picker names.
 *
 * **The header says as little as it can, and never changes shape.** Nothing at
 * all on an untouched draft; afterwards the time it last changed, the compare
 * button, and a picker — the same three whether the agent is writing or not. No
 * authorship chips, no captions, no spinner.
 */
export function RationalePanel({
  value,
  history,
  editedAt,
  edited,
  mine,
  onChange,
}: {
  /**
   * What the field shows: the partly-written paragraph while the agent's new
   * words are arriving, the real value otherwise. The panel cannot tell the
   * difference and does not need to — see ../../../lib/coverage/useReassessment.ts.
   */
  value: string;
  history: ReasonRevision[];
  editedAt: string | null;
  /** Has anything superseded the opening draft yet. */
  edited: boolean;
  /** Is the live text the reviewer's own, rather than the agent's latest draft? */
  mine: boolean;
  onChange: (value: string) => void;
}) {
  /** A superseded revision being read, or `null` for the live field. */
  const [viewing, setViewing] = useState<ReasonRevision | null>(null);
  /**
   * Are the marks on? OFF at rest, and that is the point of the control.
   *
   * The field opens as a clean paragraph — no rules, no colour, nothing under the
   * words — and the button reveals the annotation when a reader wants it. What
   * changed is worth knowing and it is not worth knowing FIRST: the rationale is
   * there to be read.
   */
  const [showMarks, setShowMarks] = useState(false);
  /** The live field's own height, held so every other view can borrow it. */
  const [boxH, setBoxH] = useState(MIN_H);

  // Newest first — a list of drafts is read backwards from the one you are on.
  const earlier = useMemo(() => [...history].reverse(), [history]);
  /**
   * THE OPENING DRAFT — the baseline the inline marks are measured against, and it
   * never moves.
   *
   * `reasonHistory` is oldest-first, so its first entry is the version the case
   * arrived with, pushed the moment anything superseded it. Empty means nothing has
   * yet, so there is nothing to mark. Deliberately NOT the previous version: the
   * marks answer "what is different from what we started with", and a baseline
   * that advanced with every rewrite would erase the agent's earlier changes as
   * soon as it made another.
   */
  const original = history[0]?.text ?? null;

  /**
   * The agent's latest text — the line between its changes and the reviewer's.
   *
   * **It needs `mine`, and guessing was wrong.** The first version of this read the
   * newest superseded entry's author: `agent` there was taken to mean the reviewer
   * had typed over it. But a reassessment supersedes the agent's OWN previous
   * draft and files it as `agent` too, so after a rewrite the test said "the
   * reviewer typed" when nobody had — and the agent's new words came out marked in
   * the reviewer's colour. Measured that happening.
   *
   * Whether the live text is the reviewer's is a fact the store already holds
   * (`touched.reason`), not something to infer from the log.
   */
  const autoDraft = mine ? (history[history.length - 1]?.text ?? value) : value;

  const shown = viewing ? viewing.text : value;

  /**
   * WHO PUT EACH WORD WHERE IT IS, computed here rather than in the field.
   *
   * The button's disabled state has to be a fact about the text — there is nothing
   * to reveal on a paragraph nobody has touched — so the attribution and the
   * control that switches it on are decided in one place. `null` on a historical
   * revision: that is a snapshot, not a state anybody is editing.
   */
  const marks = useMemo(
    () => (original !== null && !viewing ? attribute(original, autoDraft, value) : null),
    [original, viewing, autoDraft, value],
  );
  const hasMarks = marks?.some((m) => m.by !== null) ?? false;

  return (
    /* LAYOUT ONLY. 12/14 padding to match the Amount panel beside it, and
       `min-w-0 flex-1` because the pair is a flex row now rather than a
       two-column grid — the money column is a fixed 300px and this takes
       whatever is left. Nothing about the revisions, the marks or the version
       picker is touched. */
    <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-border bg-card px-3.5 py-3">
      <div className="mb-3 flex min-h-[24px] flex-wrap items-center justify-between gap-2">
        <span className={cn(TYPE.body, "font-semibold")}>
          Rationale{" "}
          <span className="text-destructive" aria-hidden>
            *
          </span>
          <span className="sr-only">(required)</span>
        </span>

        {/* THE HEADER DOES NOT REACT TO THE AGENT WRITING.
            It used to swap this whole row for `Rewriting` and a spinner for the
            ~1.4s the rewrite took, which moved three controls out and back for a
            change the field beside it was already showing. The writing is the
            notification; a caption saying the same thing is the third time the
            card says it. */}
        <span className={cn(TYPE.small, "flex items-center gap-2 text-muted-foreground")}>
          {/* The timestamp only once something has superseded the opening
              draft — it is a fact, not a control, and there is nothing true to
              say about a field nobody has touched. */}
          {edited && editedAt ? <span>Last edited {timeOnly(editedAt)}</span> : null}

          {/* BOTH CONTROLS ARE ALWAYS DRAWN, DISABLED UNTIL THEY MEAN
              SOMETHING. They used to appear only after the first edit, so the
              header grew two controls the moment you typed and the row above
              the field jumped. Present and dim, they are part of the panel's
              furniture: the reader learns where they are before needing them,
              and nothing moves when they wake up. */}
          {/* THE TOOLTIP WRAPS THE BUTTON, and `asChild` is what keeps it one
              element — a wrapper `span` here would put a box in the header's
              flex row and break its gap, which is the note
              ../LabelledSelect.tsx leaves at its own trigger.

              `delayDuration` on `Tooltip` rather than a provider, for the
              reason that file gives: `Tooltip` hardcodes a bare provider at
              zero, and a per-tooltip value beats it.

              It replaces the `title` attribute rather than joining it: two
              tooltips on one control is the native one arriving late over the
              top of the real one. */}
          <Tooltip delayDuration={600}>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={!hasMarks}
                aria-pressed={showMarks}
                aria-label={showMarks ? "Hide changes" : "Show changes"}
                onClick={() => setShowMarks((v) => !v)}
                /* NO RIM AT REST, and it is the only control in this header
                   without one. That is deliberate rather than inconsistent:
                   the picker beside it carries a value, so its border says
                   "this holds an answer"; this one carries an act, and a
                   bordered 28px square next to a bordered 28px picker read as
                   two halves of one segmented control that had come apart.
                   Ghost at rest, filled when engaged — the fill is a stronger
                   "on" than a rim was, and it needs no border to say it. Same
                   `size-7` as the picker's `h-7`, so the two still sit on one
                   line. */
                className={cn(
                  "grid size-7 place-items-center rounded-lg transition-colors",
                  "disabled:cursor-default disabled:opacity-45",
                  showMarks
                    ? "bg-primary text-primary-foreground"
                    : "cursor-pointer text-muted-foreground hover:bg-accent disabled:hover:bg-transparent",
                )}
              >
                {/* A HIGHLIGHTER, and one glyph rather than a pair. The eye it
                    replaces is the convention for hiding CONTENT, and the
                    content is never hidden here — only the annotation on it.
                    The filled state and `aria-pressed` carry on and off
                    between them, so a second glyph was a second thing to read
                    for a fact the button already stated twice. */}
                <Highlighter className="size-3.5" aria-hidden />
              </button>
            </TooltipTrigger>
            {/* `bg-app-text text-app-card` OR IT RENDERS DARK ON DARK —
                `TooltipContent` portals to `document.body`, outside the `.wrc`
                theme root, where `text-background` does not emit at all. Same
                fix as ../LabelledSelect.tsx and the recommendation tag. */}
            <TooltipContent side="top" className="bg-app-text text-app-card">
              {showMarks ? "Hide changes" : "Show changes"}
            </TooltipContent>
          </Tooltip>

          {/* THE PICKER CARRIES THE SELECTION, which is what removes the Back
              button: one control, its label is the state, and you leave a
              revision the same way you reached it. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={earlier.length === 0}>
              <button type="button" className={cn(TRIGGER, "text-foreground")}>
                {/* THE STATE, AND NOTHING ELSE.
                    It used to append "· 3 earlier" or "· only version" to
                    `Current`. Both were inventory rather than state: the count
                    is the length of the list one click away, and "only version"
                    announced the absence of a thing nobody had asked about —
                    loudest exactly when there was least to say.

                    THE TIMESTAMP IS NOT THE VALUE'S NAME, so it is not set like
                    one. `Auto · 8:26 PM` at 12/600 read as a bold clock; the
                    name keeps the weight the evidence controls use and the stamp
                    drops to 11px normal muted. That is also what stops it
                    looking bold while a version is being viewed. */}
                <span className="leading-[1.35]">
                  {viewing ? (
                    <>
                      {viewing.by === "you" ? "You" : "Auto"}
                      <span className="text-[11px] font-normal text-muted-foreground">
                        {" · "}
                        {timeOnly(viewing.at)}
                      </span>
                    </>
                  ) : (
                    "Current"
                  )}
                </span>
                <ChevronDown
                  aria-hidden
                  className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={cn(MENU.content, "min-w-44")}>
              <Version
                label="Current"
                at={editedAt}
                selected={viewing === null}
                onSelect={() => setViewing(null)}
              />
              {earlier.map((r) => (
                <Version
                  key={r.at + r.by}
                  label={r.by === "you" ? "You" : "Auto"}
                  at={r.at}
                  selected={viewing === r}
                  onSelect={() => setViewing(r)}
                />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>

      {/* ONE HEIGHT ACROSS EVERY VIEW.
          The live field measures itself to its own text, which is right — and then
          switching to the diff or to an older revision measured a DIFFERENT text
          and the card jumped, on a control the reader is only inspecting. So the
          live field reports its height while it is the thing on screen, and every
          other view is pinned to it and scrolls. Nothing under this panel moves
          when you look at a revision. */}
      <Field
        value={shown}
        marks={showMarks && hasMarks ? marks : null}
        // ONE READ-ONLY REASON LEFT. It used to be two — a superseded revision
        // being read, and the agent mid-rewrite. The second is gone: the rewrite
        // takes about half a second, writes only the words that changed, and
        // locking the field for it made the panel change shape to report a change
        // the field was already showing.
        readOnly={viewing !== null}
        height={viewing ? boxH : null}
        onHeight={viewing ? undefined : setBoxH}
        onChange={onChange}
      />

      {/* NO "READ-ONLY · PICK CURRENT TO RETURN" NOTE.
          It said three things the panel was already saying: the field is greyed and
          takes no caret, the picker above reads the version's own name rather than
          `Current`, and the way back is the control you arrived by. A caption
          narrating a state the reader can see, and instructions for a menu they just
          used. */}
    </div>
  );
}

function Version({
  label,
  at,
  selected,
  onSelect,
}: {
  label: string;
  at: string | null;
  selected: boolean;
  onSelect: () => void;
}) {
  /**
   * THE EVIDENCE MENU'S GRAMMAR, ROW FOR ROW — see `LabelledSelect`'s
   * `DropdownMenuContent` (../LabelledSelect.tsx). Four things came off to get
   * here, and each was doing a job something else already does:
   *
   * **The colour.** The label was `text-warning` for a version you wrote and
   * `text-primary` for one the agent drafted — and `label` is already the words
   * "You" or "Auto". A hue restating a word it sits inside is a third green/amber
   * system on a screen that just gave up two.
   *
   * **The selected row's `bg-primary/5` wash.** No other menu in this card tints
   * its selection. A wash plus a tick is the selection said twice.
   *
   * **A `✓` character held at `opacity-0` on every unselected row.** That
   * reserved a 12px column down the list so the labels would not shift — but the
   * evidence menu puts a real lucide `Check` at the END and lets the rows be as
   * wide as they are, and the two menus sat six pixels apart looking like
   * different components.
   *
   * **`font-medium` on the label**, which made these heavier than the evidence
   * rows now that those are uniform.
   *
   * What is kept is the timestamp, muted and trailing: it is the one thing here
   * the evidence menu has no equivalent for, and "You · 2:14 PM" is how a reader
   * tells two of their own edits apart.
   */
  return (
    /* `gap-2.5` and a LEADING SLOT, so this is the same row as an evidence menu's.
       The two menus were structurally different: those open with an 18px icon
       column before the label, this one started hard against the padding. Side by
       side they read as different components, and the selected row read as a
       different KIND of selection — which is what made the tick here look like it
       meant something else.
       The slot holds the tick. Both menus mark the selection with a `Check` in
       `text-primary`; putting it at the head of the row rather than the tail is what
       makes it land in the icon column the evidence rows already have, so the mark
       sits in the same place in both. */
    <DropdownMenuItem onSelect={onSelect} className={cn(MENU.item, "gap-2.5")}>
      {/* THE SAME ROW AS AN EVIDENCE MENU'S: `gap-2.5`, the label taking the slack,
          the timestamp as its metadata, and the selection marked by a TRAILING
          `Check` in `text-primary`.
          No leading icon column, because a version has no icon — that column holds
          the bars and the call glyph in the evidence menus, and reserving 18px of it
          here would indent every label for nothing. What has to match between the
          two menus is the MARKER, and this is the same component, the same colour
          and the same end of the row. */}
      <span className="flex-1 whitespace-nowrap">{label}</span>
      {at ? <span className="text-[11px] text-muted-foreground">{timeOnly(at)}</span> : null}
      {selected && <Check className="size-3.5 shrink-0 text-primary" />}
    </DropdownMenuItem>
  );
}


/**
 * THE FIELD — a real textarea, over a mirror that carries the marks.
 *
 * A `<textarea>` cannot hold styled spans, and `contenteditable` would drag paste
 * sanitising, undo-stack and IME handling into the one required field on this
 * page. So the textarea's own text is made transparent and an identical block is
 * rendered behind it: the caret, the selection, the undo history and the
 * accessibility tree all stay in the real form control, and only the painting
 * moves. Both layers use `LAYER` so they wrap the same way.
 *
 * The overlay only engages when there is something to mark. On an untouched draft
 * the field is a plain textarea with its own visible text, which keeps the common
 * case simple and free of transparent-text side effects.
 */
function Field({
  value,
  marks,
  readOnly,
  height,
  onHeight,
  onChange,
}: {
  value: string;
  /** Attributed runs to draw under the words, or `null` to draw a plain field. */
  marks: Mark[] | null;
  /** A superseded revision is being read — the only reason this field locks. */
  readOnly: boolean;
  /** Pinned by the panel when this is not the live field; `null` to self-measure. */
  height: number | null;
  onHeight?: (h: number) => void;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  /**
   * The box, so the measured height can live on IT rather than on the field.
   *
   * ## The bug this fixes
   *
   * The panel is a flex column in a row whose height is set by whichever column is
   * taller — and since the Amount panel beside it grows when the Breakdown opens,
   * that is often the money. The rationale's box then stretched with the panel and
   * the textarea inside it did not, because `fit()` wrote an exact pixel height
   * onto the textarea: a field sitting in the top 128px of a 190px box, with the
   * rest of the box empty. Reported, and reproduced.
   *
   * ## Why the measurement moves rather than goes
   *
   * Auto-sizing is still right — the box should never be SHORTER than its text —
   * so the measured height becomes the box's `minHeight` and the field is told to
   * fill whatever the box ends up being. Two consequences, both wanted: spare
   * height in the row goes to the field, and content taller than the spare height
   * still pushes the box out to fit.
   *
   * Only the live field grows. A superseded revision is `height`-pinned by the
   * panel so every version reads at the same size, and that branch is untouched.
   */
  const box = useRef<HTMLDivElement>(null);
  const grow = height === null;
  const mirror = useRef<HTMLDivElement>(null);
  /**
   * FOCUS AS STATE, because the variant that should have done this does not exist.
   *
   * The box is drawn by the wrapper — it has to be, since the textarea is
   * transparent and the mirror sits behind it — so the focus ring wanted
   * `focus-within:` on that wrapper. Measured on the running page, it produced a
   * **hard near-black 3px ring and no border change**, against the teal border and
   * soft 50% teal ring every other field on the card gets.
   *
   * The cause is this app's prebuilt stylesheet
   * (../../../../claims-console/claims-console.css), which carries no
   * `focus-within:*` utilities: `focus-within:ring-[3px]` is an arbitrary value so
   * Tailwind emitted it, while `focus-within:ring-ring` and
   * `focus-within:border-ring` did not — leaving a ring at v4's default colour,
   * which is `currentColor`. The measured ring was exactly the foreground token.
   *
   * So the state is tracked in React and the classes applied are plain, static
   * ones — the same three the refund field uses behind `focus-visible:`, which do
   * resolve. This is the same workaround the chevron rotation and the row hover
   * take elsewhere in this folder, and for the same reason.
   */
  const [focused, setFocused] = useState(false);

  // The overlay costs a layer and a scroll listener, so it only mounts when there
  // is something to draw — which on a read-only field is never.
  const marked = marks !== null && !readOnly;

  const fit = () => {
    const el = ref.current;
    if (!el || height !== null) return;
    // Measured with the field released, then handed to the box as a floor. The
    // field itself goes back to filling, so the box's own height — its floor or
    // whatever the flex row gives it, whichever is larger — is what shows.
    el.style.height = "auto";
    const h = Math.min(MAX_H, Math.max(MIN_H, el.scrollHeight));
    if (box.current) box.current.style.minHeight = `${h}px`;
    el.style.height = "100%";
    // Only past the ceiling does it scroll — a scrollbar on a box that already
    // fits its text is chrome for nothing. Tested against the MEASUREMENT, not
    // `scrollHeight`, which is no longer a question about the content once the
    // field has been told to fill its box.
    el.style.overflowY = h >= MAX_H ? "auto" : "hidden";
    onHeight?.(h);
  };

  useLayoutEffect(fit, [value, height]);

  // The pane is resizable and the wrap changes with it, so a width change is a
  // height change. Observing the field catches the right rail opening, which no
  // window resize would.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let last = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === last) return;
      last = el.clientWidth;
      fit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={box}
      className={cn(
        "relative rounded-lg border border-border",
        /* READ-ONLY IS A TENTH OF A FILL, NOT A FILL.
           It was solid `bg-muted` — the biggest box on the card, greyed end to
           end — and `text-muted-foreground` with it, so the state was said twice
           over a paragraph somebody is being asked to read. The header says it a
           third time: the picker stops reading `Current` and names the snapshot.

           `/40` is the wash the evidence composer's form uses (../EvidenceComposer.tsx),
           so it is a value already on this page rather than a new one. It is also
           one of the opacity steps this app's prebuilt stylesheet actually carries
           — `/5 /10 /20 /30 /40 /50` emit inside `.wrc`; a bracketed
           `bg-muted/[0.4]` would compute to transparent. */
        readOnly ? "bg-muted/40" : "bg-background",
        // `flex-1` is what lets the row's spare height reach the field. Only on
        // the live one — a pinned revision keeps the exact height it was given.
        grow && "min-h-0 flex-1",
        focused && !readOnly && "border-ring ring-[3px] ring-ring",
      )}
    >
      {/* THE MIRROR PAINTS THE HIGHLIGHT AND NOTHING ELSE.
          Its text is transparent, so all it contributes is the wash behind the
          words the reviewer added — the visible ink stays in the textarea above.
          That is the whole difference from the usual overlay trick, and it is what
          fixes the selection: an earlier pass made the TEXTAREA transparent and let
          the mirror show the words, which meant the browser's own selection
          painted a solid block over invisible text and looked nothing like every
          other field on the page. Selecting here is now exactly what it is
          anywhere else, because the thing being selected is ordinary visible text
          in an ordinary textarea. */}
      {/* THE MIRROR PAINTS THE MARKS AND NOTHING ELSE.
          Its text is transparent, so all it contributes is the rule under the
          words each hand changed — the visible ink stays in the textarea above.
          That is what keeps selecting here identical to selecting in any other
          field: the thing being selected is ordinary visible text in an ordinary
          textarea, and the mark is a line below the baseline rather than a fill
          behind the glyphs. */}
      {marked ? (
        <div
          ref={mirror}
          aria-hidden
          style={LAYER_STYLE}
          className={cn(
            LAYER,
            "pointer-events-none absolute inset-0 overflow-hidden text-transparent",
          )}
        >
          {marks.map((m, i) => (
            <span
              key={i}
              style={
                m.by ? { ...SQUIGGLE, textDecorationColor: HAND_COLOUR[m.by] } : undefined
              }
            >
              {m.text}
            </span>
          ))}
        </div>
      ) : null}

      <textarea
        ref={ref}
        required
        aria-required
        aria-label="Rationale for the resolution"
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onScroll={(e) => {
          if (mirror.current) mirror.current.scrollTop = e.currentTarget.scrollTop;
        }}
        style={
          height !== null
            ? { height, overflowY: "auto", ...LAYER_STYLE }
            : { height: "100%", minHeight: MIN_H, ...LAYER_STYLE }
        }
        className={cn(
          LAYER,
          "relative w-full resize-none bg-transparent focus-visible:outline-none",
          /* ONE INK, EVERY STATE. Dimming it was the half of the old treatment
             that made a snapshot read as a disabled control: a revision is not
             unavailable, it is a paragraph from earlier that somebody has
             deliberately opened to read. The box's wash is the state; the words
             are the content. */
          "text-foreground",
        )}
      />
    </div>
  );
}
