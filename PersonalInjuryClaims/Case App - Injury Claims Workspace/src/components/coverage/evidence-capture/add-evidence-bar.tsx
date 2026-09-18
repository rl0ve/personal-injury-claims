import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { ScreenSelection } from "./use-screen-selection";

/**
 * ADD THIS AS EVIDENCE — the bar that appears over a selection on the coverage
 * decision screen.
 *
 * One act, not a menu of them. The cartographer document's selection toolbar
 * offers two verbs and a conversation picker, because a reader of a process map
 * might be commenting, quoting or asking. A reader of a claim who has just dragged
 * across a paragraph of the finding is doing one thing: saying "this belongs in the
 * record". So the bar is that one button, and the second step is the only thing it
 * still needs from them — what the evidence IS.
 *
 * This shares no code with that toolbar and is not meant to
 * (./use-screen-selection.ts says why at length). Same gesture, different surface,
 * different act.
 *
 * ## Two states, one object
 *
 * **Resting** — `Add evidence`, and the selection echoed under it. A floating bar
 * carrying a verb and no subject makes the reader trust their own memory of a drag
 * that is very easy to overshoot, so the subject is on screen.
 *
 * **Composing** — the same bar, in place, becomes a one-line field for the title. In place rather than a dialog: a modal over the thing you just
 * selected hides the thing you just selected, and this bar is anchored to it for a
 * reason. Enter commits, Escape backs out to resting.
 *
 * The blue wash goes when the reader clicks into the bar — the browser collapses a
 * selection on a press outside it, and nothing here fights that. The captured text
 * is already held in state by then, so nothing is lost but the highlight, which is
 * the other reason the echo line under the bar exists: while the field is open it is
 * the only thing still showing what this is about.
 *
 * ## Tokens
 *
 * The console's own — `bg-card`, `border-border`, `bg-primary`, `text-muted-
 * foreground` — and not the shell's `app-*` family, even though this file lives in
 * the shell's folder. It renders inside `.wrc`, which is the embedded app's theme
 * root, and shell token names fall through to the shell's LIGHT values in there and
 * stay: a near-white chip on a near-black card. The bridge block in app/globals.css
 * re-points a handful of them for controls that had no choice; this one has a
 * choice, so it takes it.
 */
export function AddEvidenceBar({
  selection,
  onAdd,
  onDismiss,
  align = "center",
  openComposed = false,
}: {
  selection: ScreenSelection;
  /**
   * Commit. The text that was selected, and the title the reader gave it.
   *
   * **A title, not a description**, and the split is the whole design of the flow
   * it feeds: the reader names what they noticed, and the section supplies the
   * reading underneath it
   * (../../_components/evidence-capture/evidence-templates.ts). This component does
   * not know or care what the caller does with either — on the coverage decision
   * screen the title becomes the evidence row's name and the reading becomes its
   * description, and a selection from a part of the record with no reading commits
   * nothing at all.
   */
  onAdd: (selectedText: string, title: string) => void;
  onDismiss: () => void;
  /**
   * WHICH EDGE THE BAR HANGS FROM. Defaults to `center`, so nothing about the drag
   * flow changes by adding this.
   *
   * Centring is right for a drag: the selection is a run of text and the bar
   * belongs over the middle of it. It is wrong for a button, and visibly so — press
   * something at the right edge of a row and a panel opens in the middle of the
   * card, which reads as a different control answering. `right` lines the bar's
   * right edge up with the subject's, so what opened is where you pressed.
   */
  align?: "center" | "right";
  /**
   * SKIP THE "Add evidence" STEP AND OPEN THE FIELD.
   *
   * A drag is not by itself a request to file anything — the reader may have been
   * reading, or copying — so the bar asks first and the resting button is that
   * question. A press on a row's own button has already answered it, and asking
   * again would be a second click for nothing.
   *
   * Defaults to `false`, so the drag path keeps the question.
   */
  openComposed?: boolean;
}) {
  /**
   * Both reset by REMOUNTING, not by an effect.
   *
   * A fresh drag is a fresh act: moving to another paragraph mid-compose must not
   * carry a half-typed title across and attach it to different text. The
   * obvious version of that is an effect on `selection.text` that clears both
   * fields, which is a `setState` inside an effect — a cascading render, and the
   * thing `react-hooks/set-state-in-effect` exists to stop.
   *
   * So the caller keys this component on the selection instead
   * (../../_views/claims-console-v2/app/pages/cases/DecisionConsolePage.tsx).
   * A new selection is a new component, and state that belongs to one gesture
   * cannot outlive it. React's own answer, and there is no reset code to keep
   * correct.
   */
  // Seeded, not synced — the caller remounts this component per subject (see the
  // `key` note above), so the initial value is always the right one and there is
  // no effect needed to keep it honest.
  const [composing, setComposing] = useState(openComposed);
  const [title, setTitle] = useState("");
  const input = useRef<HTMLInputElement>(null);

  // Focus follows the state change rather than autoFocus, which fires on mount and
  // would steal the caret the first time the bar appears — before the reader has
  // asked to type anything.
  useEffect(() => {
    if (composing) input.current?.focus();
  }, [composing]);

  const commit = () => {
    const named = title.trim();
    if (!named) return;
    onAdd(selection.text, named);
    onDismiss();
  };

  /**
   * Clamped so a selection at the window's edge doesn't put half the bar off
   * screen. 150px is a little over half the composing state's width, which is the
   * wider of the two — sizing the clamp to the narrow state would let the field
   * overhang the moment it opened.
   */
  const centre = selection.rect.left + selection.rect.width / 2;
  const left = Math.min(
    Math.max(centre, 150),
    (typeof window === "undefined" ? 1280 : window.innerWidth) - 150,
  );

  return (
    <div
      // The guard the region's handlers look for. Without it the bar's own controls
      // read as a click outside and it takes itself down mid-press.
      data-evidence-capture
      style={{
        top: selection.rect.top - 8,
        // Centred: the midpoint, pulled back half the bar's own width by the
        // transform. Right-anchored: the subject's right edge, pulled back the
        // bar's full width. Both are one transform and no measurement.
        left: align === "right" ? selection.rect.left + selection.rect.width : left,
      }}
      className={
        align === "right"
          ? "fixed z-50 -translate-x-full -translate-y-full"
          : "fixed z-50 -translate-x-1/2 -translate-y-full"
      }
    >
      {/* `w-fit`: a block child of a fixed, shrink-to-fit parent otherwise inherits
          whatever width the echo line below claims rather than its own content's. */}
      <div
        className={
          align === "right"
            ? "ml-auto flex w-fit items-center gap-1.5 rounded-lg border border-border bg-card p-1 shadow-lg"
            : "mx-auto flex w-fit items-center gap-1.5 rounded-lg border border-border bg-card p-1 shadow-lg"
        }
      >
        {composing ? (
          /* A FORM, and the reason is Enter.
             Handling `Enter` in the input's own `onKeyDown` looked equivalent and
             was not: a single-input form submits on Enter natively, which is the
             behaviour every browser, IME and autofill path already agrees on,
             whereas the keydown version depends on the key event arriving looking
             the way the handler expects. It did not, and the field silently did
             nothing on Enter while the button beside it worked — the worst shape a
             bug can have, because the control that failed is the one nobody thinks
             to doubt. So the platform submits it. */
          <form
            onSubmit={(e) => {
              e.preventDefault();
              commit();
            }}
            className="flex items-center gap-1.5"
          >
            <input
              ref={input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              // Escape backs out one step rather than dismissing the whole gesture
              // — the selection is still good, the reader just changed their mind
              // about the words. The hook's own Escape handler takes the bar down
              // from the resting state, which is why this stops propagation.
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setComposing(false);
                }
              }}
              placeholder="Name this evidence"
              aria-label="Name this evidence"
              className="h-7 w-[240px] rounded-md border border-border bg-background px-2 text-[12.5px] outline-none placeholder:text-muted-foreground focus-visible:border-primary"
            />
            <button
              type="submit"
              disabled={!title.trim()}
              className="flex h-7 shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 text-[12px] font-medium text-primary-foreground transition-opacity disabled:opacity-40"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setComposing(false)}
              aria-label="Cancel"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            Add evidence
          </button>
        )}
      </div>

      {/* The subject, at a whisper. Truncated rather than wrapped: a multi-card drag
          can run to hundreds of characters, and a bar that grew to hold them would
          cover the thing it is describing. */}
      <p
        className={
          align === "right"
            ? "mt-1 ml-auto max-w-[300px] truncate rounded bg-card px-1.5 py-0.5 text-right text-[10.5px] italic text-muted-foreground shadow-sm"
            : "mx-auto mt-1 max-w-[280px] truncate rounded bg-card px-1.5 py-0.5 text-center text-[10.5px] italic text-muted-foreground shadow-sm"
        }
      >
        “{selection.text}”
      </p>
    </div>
  );
}
