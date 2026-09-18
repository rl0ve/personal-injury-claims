/**
 * A WORD-LEVEL DIFF, for the one paragraph on this screen that has two authors.
 *
 * **Words, not characters.** A character diff over prose finds the shared letters
 * inside unrelated words and produces a speckle — `th|e| |renewal` — which is
 * unreadable as a mark and worse as a highlight behind a live field. Splitting on
 * whitespace keeps the trailing space with its word, so joining the tokens
 * reproduces the input exactly and a run of inserted words highlights as one block
 * rather than as words with gaps between them.
 *
 * **Longest common subsequence, and the sizes make it free.** The rationales here
 * run 30–80 words, so the table is a few thousand cells filled once per keystroke —
 * cheaper than the render it feeds. A library would be a dependency, a bundle and
 * an API to learn for forty lines that will never need to do anything else.
 */

export interface DiffToken {
  text: string;
  kind: "same" | "ins" | "del";
}

/** Words with their trailing whitespace, so `tokens.join("")` is the original. */
function tokenize(s: string): string[] {
  return s.match(/\S+\s*/g) ?? [];
}

export function wordDiff(before: string, after: string): DiffToken[] {
  const a = tokenize(before);
  const b = tokenize(after);

  // lcs[i][j] — the length of the longest common subsequence of a[i:] and b[j:].
  // Built from the end so the walk below can go forwards, which is the order the
  // tokens have to come out in.
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i].trim() === b[j].trim()
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: DiffToken[] = [];
  /**
   * ONE TOKEN PER WORD, unmerged.
   *
   * Runs used to be merged here, which is what a display wants — one span per run
   * rather than one per word. It is the wrong shape for `attribute` below, which
   * walks two diffs in step and needs the words to line up one for one. Merging
   * is `attribute`'s own last step instead, and it is the only consumer: the
   * comparison view that wanted merged runs of its own is gone, since the marks in
   * the field answer the same question without leaving the text.
   */
  const push = (kind: DiffToken["kind"], text: string) => {
    out.push({ kind, text });
  };

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i].trim() === b[j].trim()) {
      // The version from `after`, so its spacing is the one that survives.
      push("same", b[j]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push("del", a[i]);
      i++;
    } else {
      push("ins", b[j]);
      j++;
    }
  }
  while (i < a.length) push("del", a[i++]);
  while (j < b.length) push("ins", b[j++]);

  return out;
}


/** Who last put a word where it is. `null` — nobody: it is as the case opened. */
export type Hand = "auto" | "you" | null;

export interface Mark {
  text: string;
  by: Hand;
}

/**
 * EVERY WORD OF THE CURRENT TEXT, ATTRIBUTED — against the ORIGINAL draft.
 *
 * The baseline is the opening draft and stays the opening draft, however many
 * times either hand has been over the paragraph since. That is the question the
 * marks answer: not "what moved most recently" but **what is different from what
 * the case arrived with** — and a baseline that advanced with each rewrite would
 * quietly erase the agent's earlier changes as soon as it made another.
 *
 * Two passes, and the second is what makes the first attributable:
 *
 *   1. `original → autoDraft` says which words the agent introduced, ever.
 *   2. `autoDraft → current` says which the reviewer then introduced.
 *
 * They cannot disagree about a word, which is the useful property: the reviewer's
 * insertions are measured against the agent's latest text, so a word the reviewer
 * typed over an agent-changed word leaves pass 1's stream entirely and appears in
 * pass 2's. "The later hand wins" is not a rule written anywhere here — it falls
 * out of running the diffs in this order.
 */
export function attribute(original: string, autoDraft: string, current: string): Mark[] {
  // Per word of `autoDraft`: did the agent introduce it, or is it as it opened?
  const fromAuto: boolean[] = [];
  for (const t of wordDiff(original, autoDraft)) {
    if (t.kind === "del") continue;
    fromAuto.push(t.kind === "ins");
  }

  const out: Mark[] = [];
  const push = (by: Hand, text: string) => {
    const last = out[out.length - 1];
    if (last && last.by === by) last.text += text;
    else out.push({ by, text });
  };

  let a = 0;
  for (const t of wordDiff(autoDraft, current)) {
    if (t.kind === "del") {
      // A word the reviewer removed. It is not in the field, so it is not marked —
      // the ⇄ comparison is where a removal is visible.
      a++;
      continue;
    }
    if (t.kind === "ins") {
      push("you", t.text);
      continue;
    }
    push(fromAuto[a] ? "auto" : null, t.text);
    a++;
  }
  return out;
}
