import { useEffect, useRef, useState } from "react";
import { wordDiff } from "./wordDiff";

/**
 * THE AGENT REWRITING, SHOWN AS THE EDIT IT IS — not as a page being retyped.
 *
 * ## What this replaced
 *
 * Two staged beats, ~1.4s: `thinking` blanked the reason field and put a pulsing
 * skeleton where the recommendation was, then `writing` typed the whole paragraph
 * back in a character at a time. Both were written when a reassessment moved the
 * agent's POSITION — a number silently becoming a different number needs
 * announcing, and half a second of skeleton is how you announce it.
 *
 * The position does not move any more (../coverage/store.ts, `rationaleFor`): the
 * reviewer picks, the amount follows, and the only thing the agent touches is the
 * rationale. So the skeleton was masking a value the card already had, and
 * retyping 297 characters was how it reported that nine of them changed.
 *
 * ## What happens instead
 *
 * The paragraph is diffed against the one on screen and **only the inserted words
 * are typed in**. Everything unchanged is already there and never moves; removed
 * words are gone on the first frame. One beat, 140ms plus 2.6ms per inserted
 * character and never more than 700ms — about 480ms on the largest of the three
 * authored changes, against 1400ms before.
 *
 * **No mode.** The field is not emptied, not greyed, not made read-only, and the
 * panel's header does not swap itself for a spinner. The card looks the same
 * while the agent writes as it does at rest, which is the point: the writing is
 * the notification, and it does not need a second one wrapped around it.
 *
 * **It is display-only.** The store's value is correct throughout — a reviewer
 * who submits mid-animation submits the finished paragraph, not the prefix on
 * screen.
 *
 * **Skipped when it cannot be seen.** `prefers-reduced-motion`, a hidden tab, and
 * a tab that hides mid-flight all resolve immediately, and so does a rewrite that
 * inserts nothing at all: the animation is the whole reason for the delay, so a
 * delay nobody watches is just latency.
 */

/** Enough to register as a beat rather than a flicker, on the smallest change. */
const BASE_MS = 140;
/** Per inserted character. Fast — this is a reveal, not a performance. */
const PER_CHAR_MS = 2.6;
/** The ceiling, so an unusually large rewrite cannot become a wait. */
const MAX_MS = 700;

export function useReassessment(
  /**
   * Changes whenever the agent has something new to say — which is the assembled
   * rationale, not the position. The position is fixed for the life of the screen
   * (../coverage/store.ts, `rationaleFor`), so keying on it would have retired
   * this animation without removing it.
   */
  signature: string,
  /** The live rationale: the agent's newest draft, or the reviewer's own text. */
  reason: string,
) {
  /** What the field should draw. `null` means "the real value" — the usual case. */
  const [text, setText] = useState<string | null>(null);
  /** When the agent last rewrote, for the stamp beside the position. */
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const seen = useRef<string | null>(null);
  const frame = useRef<number | null>(null);
  /**
   * THE TEXT THE DIFF STARTS FROM — what is actually on screen, which is not
   * always the agent's previous draft.
   *
   * A rewrite can land on top of a paragraph the reviewer typed themselves, and
   * the animation has to show the edit the reader will experience: their words
   * leaving, the agent's arriving. Tracking the last SETTLED value covers both,
   * because between animations the field shows exactly this.
   */
  const settled = useRef(reason);
  const running = useRef(false);
  // Read inside the loop so a reason that changes again mid-flight resolves to
  // the newest text rather than the one captured when the effect ran.
  const latest = useRef(reason);
  latest.current = reason;

  useEffect(() => {
    // First run is the opening draft. Nothing rewrote it, so there is nothing to show.
    if (seen.current === null) {
      seen.current = signature;
      return;
    }
    if (seen.current === signature) return;
    seen.current = signature;
    setUpdatedAt(new Date().toISOString());

    const done = () => {
      running.current = false;
      settled.current = latest.current;
      setText(null);
    };

    const runs = wordDiff(settled.current, latest.current);
    const total = runs.reduce((n, r) => (r.kind === "ins" ? n + r.text.length : n), 0);

    const reduced =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (total === 0 || reduced || (typeof document !== "undefined" && document.hidden)) {
      done();
      return;
    }

    running.current = true;
    const ms = Math.min(MAX_MS, BASE_MS + total * PER_CHAR_MS);
    const started = performance.now();

    /**
     * The paragraph at `p` — every unchanged word, none of the removed ones, and
     * the first `p` of the inserted characters IN DOCUMENT ORDER.
     *
     * One budget shared across the insertions rather than a clock per run: three
     * runs each animating over the same window would finish together and read as
     * three things appearing at once. Spending a single budget left to right is
     * what makes it read as writing.
     */
    const compose = (p: number) => {
      let budget = Math.ceil(total * p);
      let out = "";
      for (const r of runs) {
        if (r.kind === "del") continue;
        if (r.kind === "same") {
          out += r.text;
          continue;
        }
        const take = Math.min(r.text.length, budget);
        out += r.text.slice(0, take);
        budget -= take;
      }
      return out;
    };

    setText(compose(0));

    const step = (now: number) => {
      // Hidden mid-flight: finish rather than animate against a tab nobody is on,
      // where rAF is throttled to a crawl anyway.
      if (document.hidden) {
        done();
        return;
      }
      const p = Math.min(1, (now - started) / ms);
      setText(compose(p));
      if (p < 1) {
        frame.current = requestAnimationFrame(step);
      } else {
        done();
      }
    };
    frame.current = requestAnimationFrame(step);

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [signature]);

  /**
   * Keep the baseline current while nothing is animating — every keystroke the
   * reviewer makes moves it, so a rewrite that lands on their text diffs against
   * what they wrote.
   *
   * **Declared after the animation effect on purpose.** Both fire in the commit
   * where the agent rewrites, and effects run in declaration order: the animation
   * reads `settled` while it still holds the old paragraph, sets `running`, and
   * this one then stands aside. Reversed, the baseline would already be the new
   * text and the diff would be empty.
   */
  useEffect(() => {
    if (!running.current) settled.current = reason;
  }, [reason]);

  // A tab hidden while a frame is pending resolves on return to the page.
  useEffect(() => {
    const onHide = () => {
      if (!document.hidden) return;
      if (frame.current) cancelAnimationFrame(frame.current);
      running.current = false;
      settled.current = latest.current;
      setText(null);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  return { text, updatedAt };
}
