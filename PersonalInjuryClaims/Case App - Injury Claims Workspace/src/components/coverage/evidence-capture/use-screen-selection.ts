import { useCallback, useEffect, useState } from "react";

/**
 * WHAT THE READER JUST DRAGGED ACROSS — the text and where it is on screen.
 *
 * The producer half of the Add-evidence bar (./add-evidence-bar.tsx). It watches
 * one element for a completed drag and reports the selection, or `null` when there
 * isn't one.
 *
 * ## Deliberately NOT the cartographer document's version
 *
 * That surface has a selection toolbar too, and this file shares no code with it
 * on purpose (components/cartographer/process-selection-toolbar.tsx,
 * lib/cartographer/quote-marks.ts). The difference is not stylistic. Its
 * `markFromSelection` builds a normalised text index over the whole document and
 * resolves the drag to an `nth` occurrence of a string, so the same passage can be
 * found again later and painted as a persistent highlight. Nothing here highlights
 * anything and nothing here persists, so all of that machinery would be weight
 * carried for a feature that does not exist — and a shared helper would be a seam
 * where one surface's needs start bending the other's.
 *
 * What this needs is the text and a rectangle. That is the whole contract.
 *
 * ## A drag across CARDS, not a paragraph
 *
 * The reader is expected to sweep whole rows, figures and cards rather than pick
 * out a sentence, and a native selection handles that without being asked to:
 * `toString()` concatenates whatever text fell inside the range, and the range's
 * bounding box covers the region rather than a line. So "select a bigger chunk"
 * needs no marquee — it is the ordinary gesture, used coarsely.
 *
 * The consequence worth knowing: the text of a multi-card drag is run-together
 * content from several elements, which is fine as a record of what was pointed at
 * and useless as a quotation. The bar treats it as the former.
 *
 * ## The one prerequisite
 *
 * The app is `select-none` at the body (app/layout.tsx — the desktop convention, so
 * dragging across the shell doesn't blue-wash a sidebar). A region that wants this
 * hook has to opt back in with `select-text`, or there will never be a selection to
 * report and the bar will never appear. That is not a bug to hunt later; it is the
 * switch that turns this on.
 */

export interface ScreenSelection {
  /** The selected text, whitespace-collapsed. Run-together across elements. */
  text: string;
  /**
   * The selection's bounding box in VIEWPORT coordinates, which is why the bar is
   * `fixed` and why any scroll drops it: these numbers stop being true the moment
   * the page moves under them, and re-deriving them on scroll would be tracking a
   * thing the reader has already looked away from.
   */
  rect: { top: number; left: number; width: number };
  /**
   * HOW THE SUBJECT WAS PRODUCED — dragged, or offered by a row's own button.
   *
   * The bar reads this to decide two things: which edge to hang off, and whether
   * to ask "Add evidence?" before showing the field. Both differ because the two
   * gestures differ in intent, not because the subject does.
   *
   * **An explicit field, after a version that sniffed the text.** The first cut
   * keyed off the ` — ` the row path puts between label and value, which is a
   * marker any DRAG could contain — the claimant rows literally read
   * "6 — all approved, none contested", so selecting one by hand would have been
   * mistaken for a button press. A producer knows how it produced something; it
   * should say so rather than leave the consumer to guess from the words.
   */
  via: "drag" | "row";
  /**
   * WHICH PART OF THE RECORD this came from, from the nearest
   * `data-evidence-source` above the selection — or `null` where the reader dragged
   * across something that has not named itself.
   *
   * The bar shows either way; what changes is whether committing produces anything,
   * and the caller decides that by looking the source up. Read here rather than in
   * the bar because the ancestry is only walkable while the range still exists: by
   * the time the reader has pressed a button and typed a line, the selection may
   * have been collapsed by the click.
   */
  source: string | null;
}

/**
 * @param root The element a selection has to fall inside to count. A drag that
 *   starts in the record and ends in the dock reports nothing, which is the honest
 *   answer — half of it is chrome.
 */
export function useScreenSelection(root: React.RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<ScreenSelection | null>(null);

  const clear = useCallback(() => {
    setSelection(null);
    // The blue wash goes too. Leaving it under a dismissed bar would say the
    // selection is still live when nothing is offering to act on it.
    window.getSelection()?.removeAllRanges();
  }, []);

  /**
   * Read the document's current selection, if it is one this hook should report.
   *
   * Exported through the returned object rather than run on an interval or a
   * `selectionchange` listener: `selectionchange` fires continuously DURING a drag,
   * so a bar driven by it appears mid-gesture, jumps with every pixel, and lands
   * under the cursor the reader is still moving. Mouseup is the moment the gesture
   * has a result.
   */
  const readSelection = useCallback(() => {
    const el = root.current;
    if (!el) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setSelection(null);
      return;
    }

    const range = sel.getRangeAt(0);
    // `commonAncestorContainer` rather than either endpoint: a drag that begins
    // outside and ends inside has its common ancestor outside, and neither half of
    // it is a thing this region can offer to file.
    if (!el.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }

    const text = sel.toString().replace(/\s+/g, " ").trim();
    const box = range.getBoundingClientRect();
    // A zero box happens on a collapsed-but-not-reported range and on a selection
    // of nothing but whitespace. Both are drags that produced no subject.
    if (!text || (box.width === 0 && box.height === 0)) {
      setSelection(null);
      return;
    }

    // `commonAncestorContainer` can be a text node, which has no `closest` — so
    // climb to an element first. A drag inside one paragraph has a text node as its
    // common ancestor, which is the ordinary case rather than the edge one.
    const from =
      range.commonAncestorContainer instanceof Element
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;

    setSelection({
      text,
      via: "drag",
      rect: { top: box.top, left: box.left, width: box.width },
      source: from?.closest("[data-evidence-source]")?.getAttribute("data-evidence-source") ?? null,
    });
  }, [root]);

  /**
   * ANY SCROLL DROPS IT, from anywhere on the page.
   *
   * The rect is in viewport coordinates, so the moment anything moves under the bar
   * those numbers stop describing where the words are and the bar is pointing at
   * whatever slid into their place. Dropping it is the honest response; re-deriving
   * the rect would be following a selection the reader has scrolled away from.
   *
   * **On the window, in the CAPTURE phase, and that is the whole point.** Scroll
   * events do not bubble, so a handler on the scrolling element only hears that one
   * element, and a handler on an ancestor hears nothing at all. This screen has a
   * scroller inside a shell that has its own, and the first version of this — an
   * `onScroll` prop on the region — did not fire in testing while the bar sat
   * happily over the wrong paragraph. Capture on the window hears every scroller in
   * the document, which is the only version of this that cannot be defeated by the
   * layout changing above it.
   */
  useEffect(() => {
    if (!selection) return;
    const onScroll = () => clear();
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [selection, clear]);

  /**
   * Escape drops it, wherever focus is.
   *
   * On the window rather than the region, because by the time the bar is up the
   * reader's focus may be inside the bar's own input — and Escape there should back
   * out of the whole gesture, not just blur a field.
   */
  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, clear]);

  /**
   * OFFER ONE DIRECTLY, without a drag having happened.
   *
   * A row's "Add evidence" button produces the same three facts a drag does — the
   * text it would have selected, the box to hang the bar off, and the source it sits
   * in — so it hands over a `ScreenSelection` and everything downstream is
   * unchanged: the bar, the reading table, the commit. That is the whole reason this
   * is a setter rather than a second piece of state in the page: one bar, one
   * subject, one way to dismiss it.
   *
   * Scroll and Escape drop an offered selection exactly as they drop a read one —
   * the effects above key off `selection`, not off how it got there — and that is
   * right for the same reason: `rect` is in viewport coordinates either way.
   */
  const offer = useCallback((next: ScreenSelection) => setSelection(next), []);

  return { selection, readSelection, offer, clear };
}

/**
 * Whether an event came from the capture UI itself.
 *
 * The bar renders inside the region it watches, so its own buttons and its input
 * would otherwise read as "the reader clicked away" — mousedown lands before a
 * button's click does, so without this the bar would take itself down before the
 * press it was reacting to ever arrived.
 *
 * **`data-evidence-capture`, and the attribute name is the decoupling.** The
 * cartographer toolbar guards on `data-selection-ui`; these two never match each
 * other, so neither widget can dismiss — or fail to dismiss — because of the
 * other's chrome. Two surfaces, two vocabularies, on purpose.
 */
export function fromCaptureUi(event: { target: EventTarget | null }): boolean {
  const target = event.target as HTMLElement | null;
  return !!target?.closest?.("[data-evidence-capture]");
}
