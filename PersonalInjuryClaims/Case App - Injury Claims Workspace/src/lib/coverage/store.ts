import { useMemo, useReducer } from "react";
import { splitFor } from "@/lib/claims/costSplit";
import type { CaseAction } from "@/lib/claims/types";
import type {
  CoverageFixture,
  EvidenceCall,
  EvidenceItem,
  Importance,
  RationaleSlots,
} from "./fixture";

/**
 * EVERYTHING THE REVIEWER CAN CHANGE ON THE DECISION PAGE, in one reducer.
 *
 * Two facts are coupled and the reducer owns the coupling: **the refund and the
 * resolution**. Pick a resolution and the refund becomes that position's vendor total;
 * type a refund and the resolution becomes whatever that amount resolves to — $0 is a
 * denial, the full claim is full coverage, anything between is a split. Two controls,
 * one number underneath.
 *
 * **Typing a refund while resting on the recommendation moves you into edit mode.**
 * Otherwise "Agree & submit" would submit the recommended denial with a $4,940 refund
 * attached, which is two answers. So the moment the refund stops matching the
 * recommendation, the bar swaps to the radios with the derived resolution selected.
 *
 * The refund is clamped to the signer's limit here rather than in the field, so
 * nothing downstream can ever see an over-limit number.
 */

export type DockMode = "rest" | "edit";

/**
 * WHAT THE AGENT CURRENTLY RECOMMENDS — state, not a constant.
 *
 * It used to be `fixture.recommendedOutcome`, read straight out of the fixture and
 * never moved. That was right while the agent said one thing for the life of the
 * screen; it stopped being right the moment the agent had to answer the reviewer's
 * evidence. The dock reads this in five places — the badge, the crossfade, the
 * "Agent recommended …" line under an override, Agree & submit, and which radio is
 * starred — and all five now follow the reassessment rather than the seed.
 */
export interface AgentPosition {
  outcome: string;
  refund: number;
  reason: string;
  /**
   * HOW SURE THE AGENT IS OF *THIS* POSITION — part of the position, not a
   * property of the case.
   *
   * It was `action.confidencePercent`, read off the fixture and printed in the
   * decision head, so the score sat at 87% while the recommendation moved from
   * Deny to a $4,940 split underneath it. A number that does not move when its
   * subject does is not a reading, and it was the one thing on the head still
   * claiming the agent had not changed its mind.
   *
   * Authored per rule below, like `refund` and `reason`. Nothing here computes a
   * confidence — the point is that each beat states how much weight it is willing
   * to put on the answer it just gave.
   *
   * `null` where the case authored no score, and it STAYS null through every
   * reassessment: the head draws no rail at all in that state, and a case that
   * opened without a number should not acquire one because the reviewer weighted a
   * row. `assess` carries the null rather than reading the rule's value.
   */
  confidence: number | null;
  /**
   * What moved it, in the reviewer's terms. `null` on the opening position, which
   * is what the strip in the dock keys off: no trigger, nothing to announce.
   */
  trigger: string | null;
}

/**
 * THE AGENT'S RATIONALE, ASSEMBLED — the only thing it moves any more.
 *
 * This replaced three `RULES`, each of which carried an `outcome`, a `refund`, a
 * `confidence` and a whole replacement paragraph. Weighting one evidence row moved
 * all four, so the screen changed the reviewer's answer for them on the strength of
 * a row they had merely re-read. **The position is the reviewer's now.** The agent
 * recommends once, at load, and then only ever rewrites — the amount follows the
 * resolution the reviewer picks, and nothing else moves it.
 *
 * **And the paragraph evolves rather than swaps.** Five slots (../coverage/fixture.ts
 * authors the words), most holding the same point at two or three lengths, and a
 * single rule choosing between them: a slot goes shorter as the slots below it fill.
 * So weighting the renewal adds its sentence AND fuses the two above it; signing the
 * decision retires both commercial clauses into five words and appends the split.
 * The paragraph peaks at 330 characters and the final one is 297 — appending the
 * same four clauses and rewriting nothing would have landed at 526.
 *
 * Two things fall out of assembling rather than accumulating, neither of them coded:
 *
 *   - **Evidence the slots do not name does nothing.** Re-weight the defect, edit a
 *     source, remove a row — the assembled string is byte-identical, `reassess`
 *     returns the state untouched, and no revision, timestamp or "Rewriting" beat
 *     fires. The agent not reacting is TRUE here, not merely invisible.
 *   - **Undo is free.** Put the renewal back to Low and its sentence leaves *and the
 *     earlier phrasings come back*, because no phrasing was ever stored. Going back
 *     to the recommendation drops the signature the same way.
 *
 * `pressure` is the whole mechanism: one small integer standing for "how much has
 * been said since the case opened", read by the two slots that contract.
 */
function rationaleFor(
  evidence: EvidenceItem[],
  /** The resolution in play — the signature slot is the only thing that reads it. */
  resolution: string,
  r: RationaleSlots,
  /** The agent's own outcome. Matching it means nothing has been signed. */
  agentOutcome: string,
): string {
  const renewal = evidence.some((e) => e.id === r.renewalId && e.importance === "high");
  const record = evidence.some((e) => e.addedByReviewer && e.call === "approve");
  const signature = resolution !== agentOutcome ? (r.signature[resolution] ?? null) : null;

  // Signing counts double: it is the moment the argument stops being an argument,
  // and both clauses above it drop a tier at once.
  const pressure = (renewal ? 1 : 0) + (record ? 1 : 0) + (signature ? 2 : 0);

  const parts = [
    pressure >= 2 ? r.change.tight : r.change.full,
    pressure === 0 ? r.exclusion.opening : pressure >= 3 ? r.exclusion.tight : r.exclusion.mid,
  ];

  if (signature) {
    // Fragments, joined into one sentence — so one commercial point reads as well
    // as two, and neither needs a signed variant of the other's wording.
    const said = [renewal ? r.renewal.signed : null, record ? r.record.signed : null].filter(
      (x): x is string => x !== null,
    );
    if (said.length > 0) {
      const line = said.join(", ");
      parts.push(`${line.charAt(0).toUpperCase()}${line.slice(1)}.`);
    }
    parts.push(signature);
  } else {
    if (renewal) parts.push(record ? r.renewal.withRecord : r.renewal.alone);
    if (record) parts.push(r.record.full);
  }

  return parts.join(" ");
}

/**
 * The agent's position given the evidence and the resolution as they now stand.
 *
 * Everything except the reason is `base` — the opening position, frozen. The
 * outcome, the refund and the confidence are what the agent said at load and what
 * it will still say at submit, which is what makes the `Recommended` tag, the
 * dimmed confidence rail and `Override & submit` mean something once the reviewer
 * has moved.
 */
function assess(
  evidence: EvidenceItem[],
  resolution: string,
  base: AgentPosition,
  slots: RationaleSlots,
): AgentPosition {
  return { ...base, reason: rationaleFor(evidence, resolution, slots, base.outcome) };
}


/**
 * A SUPERSEDED RATIONALE, kept.
 *
 * The reason field has two authors and they take turns: the agent drafts, the
 * reviewer edits, a reassessment redrafts. Before this, each turn destroyed the
 * one before it — the reducer set `reason: agent.reason` on every reassessment,
 * and the comment beside it accepted losing a reviewer's edit as the price of
 * never showing a stale reason under a moved number.
 *
 * Keeping the old value costs one array and removes the trade entirely: the agent
 * still rewrites the moment the position moves, and the words it replaced are one
 * click away instead of gone. It also means the panel needs no conflict prompt —
 * there is nothing to decide when nothing is lost.
 */
export interface ReasonRevision {
  text: string;
  by: "agent" | "you";
  at: string;
}

export interface CoverageState {
  evidence: EvidenceItem[];
  /**
   * The suffix the next added item gets, so ids never repeat.
   *
   * Counting the list instead — which is what `evidence.add` did — hands the same
   * id out twice as soon as anything is removed, and the id is the React key.
   */
  nextEvidenceNo: number;
  refund: number;
  /** The resolution in play. In `rest` mode this is the recommendation. */
  resolution: string;
  mode: DockMode;
  reason: string;
  /** The red dot on the Reason chip — cleared the first time the sheet opens. */
  reasonReviewed: boolean;
  /** What the agent recommends as of the evidence currently in the list. */
  agent: AgentPosition;
  /**
   * WHICH OF THE THREE THE REVIEWER SET THEMSELVES, as opposed to inherited.
   *
   * Needed because a value that has changed does not say WHO changed it, and on
   * this card that is most of the story. Weight one evidence row and the agent can
   * reassess the resolution, the refund and the rationale in one go — a record
   * reading "you changed four things" would be false about three of them.
   *
   * Set only by the events a control on the card dispatches, and never by
   * `reassess`, which is the agent answering. Evidence carries its own flags on
   * the items (`addedByReviewer`, `touchedByReviewer` in ./fixture.ts).
   */
  touched: { resolution: boolean; refund: boolean; reason: boolean };
  /**
   * Every value `reason` has held before its current one, oldest first.
   *
   * A revision is pushed at an AUTHOR BOUNDARY, not on every change: the reviewer's
   * first keystroke after a draft supersedes that draft, and a reassessment
   * supersedes whatever was there. Pushing per keystroke would make a revision list
   * out of typing.
   */
  reasonHistory: ReasonRevision[];
  /** When the current value was written, and by whom. */
  reasonAt: string | null;
}

export type CoverageEvent =
  | { type: "evidence.set"; id: string; patch: Partial<Pick<EvidenceItem, "importance" | "call">> }
  /**
   * A whole item, committed once.
   *
   * This replaced `evidence.add` (append a blank row) and `evidence.rename` (fill
   * its name in later). Those two were a composer spread across the list: an
   * abandoned add left a nameless row in the store, and there was no moment at
   * which the item was complete enough to validate. The composer builds it in its
   * own state and dispatches this when the reviewer presses Add, so the store only
   * ever holds items somebody finished.
   */
  | { type: "evidence.create"; item: Omit<EvidenceItem, "id"> }
  /** Editing one back — the composer again, over an existing row. */
  | { type: "evidence.update"; id: string; patch: Partial<Omit<EvidenceItem, "id">> }
  /** Only ever reachable on a reviewer's own row; the agent's three are the record. */
  | { type: "evidence.remove"; id: string }
  | { type: "refund.set"; value: number }
  | { type: "resolution.pick"; outcome: string }
  | { type: "mode.edit"; preselect: string | null }
  | { type: "mode.rest" }
  | { type: "reason.set"; value: string }
  | { type: "reason.reviewed" };

/**
 * Re-assemble the rationale, and carry the consequence — which is now only ever
 * the rationale.
 *
 * Every event that can change what the assembler reads funnels through this: the
 * four `evidence.*` cases, and the four that move the resolution (`resolution.pick`,
 * `refund.set`, `mode.edit`, `mode.rest`). A branch that forgot would leave the
 * sheet arguing a position the reviewer has already left.
 *
 * **It no longer touches `resolution` or `refund`.** It used to, in `mode === "rest"`,
 * on the reasoning that a reviewer resting on the recommendation had not yet taken a
 * position of their own. But re-weighting a row is reading, not deciding, and the
 * screen answering it by moving the money was the screen deciding. The amount now
 * follows one thing only: the resolution, picked or derived from a typed figure.
 *
 * **The no-op guard compares assemblies, not text.** `s.agent.reason` is the last
 * string the assembler produced; `s.reason` may be a paragraph the reviewer wrote
 * over it. Comparing against the assembly is what lets an evidence change no slot
 * names pass through without eating that edit — and what makes the beat fire exactly
 * when the agent has something new to say.
 *
 * **When it does move, it overwrites.** The superseded value goes to
 * `reasonHistory` tagged with whoever wrote it, so a reviewer's paragraph is one
 * click away in the panel's picker rather than gone, and `reasonReviewed` goes false
 * to bring the dot back on the chip.
 */
function reassess(s: CoverageState, ctx: Ctx): CoverageState {
  const agent = assess(s.evidence, s.resolution, ctx.base, ctx.slots);
  if (agent.reason === s.agent.reason) return s;

  const at = ctx.now();
  return {
    ...s,
    agent,
    reasonHistory: [
      ...s.reasonHistory,
      { text: s.reason, by: s.touched.reason ? "you" : "agent", at: s.reasonAt ?? at },
    ],
    reason: agent.reason,
    reasonAt: at,
    // The agent owns the new text, so the reviewer's mark comes off — what they
    // wrote is in the log, not in the field.
    touched: { ...s.touched, reason: false },
    reasonReviewed: false,
  };
}

interface Ctx {
  /** The agent's OPENING position — what it said before any evidence moved. */
  base: AgentPosition;
  limit: number;
  claim: number;
  /** Vendor total for a resolution — what the refund becomes when it is picked. */
  refundFor: (outcome: string) => number;
  /** The rationale's phrasings, authored on the fixture. See `rationaleFor`. */
  slots: RationaleSlots;
  /**
   * The clock, as a seam rather than a call to `Date` inside the reducer.
   *
   * Revisions are timestamped and the reducer is where they are made, so it needs
   * one — and a reducer that reads the wall clock directly is a reducer that cannot
   * be replayed. One injected function keeps every call site unchanged.
   */
  now: () => string;
}

/**
 * What a typed figure resolves to.
 *
 * The ceiling is `min(claim, limit)`, not the claim. Against the claim alone, the
 * two directions disagreed: PICKING Approve on this case put $5,000 in the field —
 * the $8,185 claim clamped to a $5,000 authority — while TYPING 5,000 read as a
 * partial, because 5,000 < 8,185. The same number meant two things depending on
 * which control produced it. A signer cannot approve past their own limit, so the
 * most their figure can mean is full coverage.
 */
function derivedOutcome(refund: number, ceiling: number): string {
  if (refund <= 0) return "Denied";
  if (refund >= ceiling) return "Approved";
  return "PartialPlusGoodwill";
}

function reduce(ctx: Ctx) {
  return (s: CoverageState, e: CoverageEvent): CoverageState => {
    switch (e.type) {
      case "evidence.set":
        return reassess(
          {
            ...s,
            evidence: s.evidence.map((x) =>
              // `touchedByReviewer` on the way through: both of these events are
              // only ever dispatched by a control the reviewer operated — the
              // row's two selects and the composer editing a row back.
              x.id === e.id ? { ...x, ...e.patch, touchedByReviewer: true } : x,
            ),
          },
          ctx,
        );
      case "evidence.create":
        return reassess(
          {
            ...s,
            // Counter off the length rather than a uuid: this is a demo store with
            // no persistence, and a removed row's id never coming back is a
            // property worth having when the id is also the React key.
            evidence: [...s.evidence, { id: `ev-new-${s.nextEvidenceNo}`, ...e.item }],
            nextEvidenceNo: s.nextEvidenceNo + 1,
          },
          ctx,
        );
      case "evidence.update":
        return reassess(
          {
            ...s,
            evidence: s.evidence.map((x) =>
              x.id === e.id ? { ...x, ...e.patch, touchedByReviewer: true } : x,
            ),
          },
          ctx,
        );
      case "evidence.remove":
        return reassess({ ...s, evidence: s.evidence.filter((x) => x.id !== e.id) }, ctx);
      case "refund.set": {
        const refund = Math.min(Math.max(0, e.value), ctx.limit);
        const resolution = derivedOutcome(refund, Math.min(ctx.claim, ctx.limit));
        const leavesRecommendation = s.mode === "rest" && resolution !== s.agent.outcome;
        // Typing a refund sets the resolution too — the reducer's own coupling —
        // so both count as the reviewer's, which is what the record has to say.
        // And the resolution moving is what the rationale reads, so it reassesses
        // for the same reason `resolution.pick` does.
        return reassess(
          {
            ...s,
            refund,
            resolution,
            mode: leavesRecommendation ? "edit" : s.mode,
            touched: { ...s.touched, refund: true, resolution: true },
          },
          ctx,
        );
      }
      case "resolution.pick":
        // The one event that moves the money, together with the typed figure above
        // it. The amount follows the position; the position follows nobody.
        return reassess(
          {
            ...s,
            resolution: e.outcome,
            refund: Math.min(ctx.refundFor(e.outcome), ctx.limit),
            touched: { ...s.touched, resolution: true, refund: true },
          },
          ctx,
        );
      case "mode.edit":
        return reassess(
          e.preselect
            ? {
                ...s,
                mode: "edit",
                resolution: e.preselect,
                refund: Math.min(ctx.refundFor(e.preselect), ctx.limit),
              }
            : { ...s, mode: "edit", resolution: "", refund: 0 },
          ctx,
        );
      case "mode.rest":
        // Back to the agent's position — and the two it just took back stop being
        // the reviewer's. The signature clause leaves with them, which returns the
        // rationale to precisely the words it held before the override.
        return reassess(
          {
            ...s,
            mode: "rest",
            resolution: s.agent.outcome,
            refund: Math.min(s.agent.refund, ctx.limit),
            touched: { ...s.touched, resolution: false, refund: false },
          },
          ctx,
        );
      case "reason.set": {
        // The FIRST keystroke after a draft supersedes it; the rest are just
        // typing. `touched.reason` is the boundary marker, which is why this
        // reads it before setting it.
        const boundary = !s.touched.reason;
        const at = ctx.now();
        return {
          ...s,
          reason: e.value,
          reasonAt: at,
          touched: { ...s.touched, reason: true },
          reasonHistory: boundary
            ? [...s.reasonHistory, { text: s.reason, by: "agent", at: s.reasonAt ?? at }]
            : s.reasonHistory,
        };
      }
      case "reason.reviewed":
        return s.reasonReviewed ? s : { ...s, reasonReviewed: true };
    }
  };
}

/**
 * WHAT THIS SUBMISSION DEPARTS FROM, part by part.
 *
 * The card collects four things — a resolution, a refund, a rationale and an
 * evidence set — and every one of them arrives pre-filled by the agent. So the
 * question the submit bar has to answer is not "what is in the payload" (all four,
 * always) but **which of the four the person moved**.
 *
 * Derived, never stored. Each part is a comparison against `state.agent`, which is
 * the agent's position as of the evidence currently in the list — so re-weighting a
 * row that moves the agent does not count the resolution as a departure just
 * because it changed; the agent changed with it.
 *
 * The refund is compared clamped, because `state.refund` is held clamped to the
 * signer's limit and `agent.refund` is not: an agent proposing $6,000 against a
 * $5,000 authority is not a reviewer who moved the number.
 */
export interface Departures {
  resolution: boolean;
  refund: boolean;
  rationale: boolean;
  /** Rows the reviewer added or re-weighted. */
  evidence: number;
  /** How many of the four parts differ — evidence counts once, however many rows. */
  parts: number;
}

export function departuresOf(s: CoverageState, limit: number): Departures {
  const resolution = s.resolution !== s.agent.outcome;
  const refund = s.refund !== Math.min(s.agent.refund, limit);
  const rationale = s.reason.trim() !== s.agent.reason.trim();
  const evidence = s.evidence.filter((e) => e.addedByReviewer || e.touchedByReviewer).length;
  return {
    resolution,
    refund,
    rationale,
    evidence,
    parts: Number(resolution) + Number(refund) + Number(rationale) + Number(evidence > 0),
  };
}

/**
 * WHAT THE CASE LOOKED LIKE BEFORE ANYBODY TOUCHED IT.
 *
 * The submit bar diffs against `state.agent`, which MOVES — it is answering "is
 * the position on screen the agent's or yours, right now". The filed record has to
 * diff against something that does not move, because the question there is what
 * changed over the life of the case. Two baselines, two questions; conflating them
 * would make the record say nothing changed on exactly the cases where the agent
 * came round to the reviewer.
 */
export interface Opening {
  outcome: string;
  refund: number;
  reason: string;
  evidence: EvidenceItem[];
}

/** One line of the filed record's manifest. */
export interface Change {
  part: "Resolution" | "Refund" | "Rationale" | "Evidence";
  from: string | null;
  to: string;
  /** Who moved it. The whole reason `touched` exists. */
  by: "you" | "agent";
  /** A clause the row prints after the value, where there is one worth saying. */
  detail?: string;
  /**
   * WHICH WAY AN ORDINAL MOVE WENT, where the values were numbers.
   *
   * `from` and `to` are formatted for print by the time they leave here — the
   * refund is already `"$4,940.00"` — so the manifest that draws them cannot tell
   * a rise from a fall without parsing its own output back into a number. This is
   * set where the numbers are still numbers.
   *
   * Only the refund carries it. The two evidence enums need nothing: `label()` is
   * a pure title-case of the enum value, so the row inverts it and reads the rank
   * off the value itself.
   */
  up?: boolean;
  /** What the change is ABOUT, printed before it — the evidence item's name. */
  subject?: string;
}

/**
 * EVERYTHING THAT MOVED SINCE THE CASE OPENED, attributed.
 *
 * A part is the reviewer's if they set it with their own hands (`touched`, or the
 * item's own flags for evidence) and the agent's otherwise — because the only
 * other thing that writes these fields is `reassess`.
 *
 * Evidence yields one row per item rather than a count: which row was re-weighted
 * is the fact that explains the other three changes, and a number would hide it.
 */
export function changesSince(
  opening: Opening,
  s: CoverageState,
  limit: number,
  money: (n: number) => string,
  /**
   * Outcomes as a reader knows them. Passed rather than looked up: the display
   * names live with the section that draws them, and a store that imported them
   * would be a store that knows what the screen calls things.
   */
  name: (outcome: string) => string,
): Change[] {
  const out: Change[] = [];

  if (s.resolution !== opening.outcome) {
    out.push({
      part: "Resolution",
      from: name(opening.outcome),
      to: name(s.resolution),
      by: s.touched.resolution ? "you" : "agent",
    });
  }
  const openingRefund = Math.min(opening.refund, limit);
  if (s.refund !== openingRefund) {
    out.push({
      part: "Refund",
      from: money(openingRefund),
      to: money(s.refund),
      by: s.touched.refund ? "you" : "agent",
      up: s.refund > openingRefund,
      detail: `within the ${money(limit)} authority`,
    });
  }
  if (s.reason.trim() !== opening.reason.trim()) {
    out.push({
      part: "Rationale",
      from: null,
      to: "Rewritten",
      by: s.touched.reason ? "you" : "agent",
      detail: s.touched.reason ? "you edited the draft" : "replaced when the position moved",
    });
  }

  const was = new Map(opening.evidence.map((e) => [e.id, e]));
  for (const e of s.evidence) {
    const before = was.get(e.id);
    if (!before) {
      out.push({ part: "Evidence", from: null, to: "Added", by: "you", subject: e.name });
      continue;
    }
    if (before.importance !== e.importance) {
      out.push({
        part: "Evidence",
        from: label(before.importance),
        to: label(e.importance),
        by: "you",
        subject: e.name,
      });
    }
    if (before.call !== e.call) {
      out.push({ part: "Evidence", from: label(before.call), to: label(e.call), by: "you", subject: e.name });
    }
  }
  for (const e of opening.evidence) {
    if (!s.evidence.some((x) => x.id === e.id)) {
      out.push({ part: "Evidence", from: null, to: "Removed", by: "you", subject: e.name });
    }
  }
  return out;
}

/** `high` → `High`, and `null` → the em-dash the rows already use for "not set". */
/**
 * How an evidence enum is spelled in the manifest.
 *
 * EXPORTED, so the manifest can invert it. The rows draw a relevance move with
 * the same `RankBars` the evidence list uses, which needs the `Importance` back
 * out of `"Not relevant"` — and the only safe inverse is the function that
 * produced it. A second copy of this title-case in the component would be a
 * second copy that can drift.
 */
export function changeValueLabel(v: string | null): string {
  if (!v) return "—";
  return v.charAt(0).toUpperCase() + v.slice(1).replace(/-/g, " ");
}

const label = changeValueLabel;

export function useCoverageDecision(action: CaseAction, fixture: CoverageFixture) {
  const ctx = useMemo<Ctx>(() => {
    const limit = action.authority?.limit ?? Number.POSITIVE_INFINITY;
    const claim = action.claimTotal ?? action.costLines?.reduce((n, l) => n + l.amount, 0) ?? 0;
    const refundFor = (outcome: string) =>
      splitFor(action, action.options.find((o) => o.outcome === outcome)).vendorTotal;
    const base: AgentPosition = {
      outcome: fixture.recommendedOutcome,
      refund: Math.min(refundFor(fixture.recommendedOutcome), limit),
      // Assembled from the same slots every later rewrite uses, at pressure 0 —
      // written out it was a fourth copy of the sentence, free to drift from the
      // three the assembler produces.
      reason: rationaleFor(
        fixture.evidence,
        fixture.recommendedOutcome,
        fixture.rationale,
        fixture.recommendedOutcome,
      ),
      // The case's authored score is the agent's confidence in the position it
      // recommends, and that position no longer moves — so neither does this.
      confidence: action.confidencePercent ?? null,
      // Nothing moved the agent's position, and nothing will: it recommends once
      // and then only rewrites. See `rationaleFor`.
      trigger: null,
    };
    return {
      base,
      limit,
      claim,
      refundFor,
      slots: fixture.rationale,
      now: () => new Date().toISOString(),
    };
  }, [action, fixture]);

  const [state, dispatch] = useReducer(reduce(ctx), undefined, (): CoverageState => {
    // Seeded through the same assembler the reducer uses, so a fixture whose
    // evidence already fills a slot opens with the sentence that slot writes
    // rather than acquiring it on the first keystroke.
    const agent = assess(fixture.evidence, fixture.recommendedOutcome, ctx.base, ctx.slots);
    return {
      evidence: fixture.evidence,
      nextEvidenceNo: 1,
      refund: Math.min(agent.refund, ctx.limit),
      resolution: agent.outcome,
      mode: "rest",
      reason: agent.reason,
      reasonReviewed: false,
      agent,
      touched: { resolution: false, refund: false, reason: false },
      // Empty, and that is what the panel keys off: no revisions means no control
      // and no label — the opening draft is just the rationale.
      reasonHistory: [],
      // Stamped at mount even though nothing has been edited, so the opening draft
      // carries the time it was DRAFTED when it is later superseded. Left null, it
      // inherited the timestamp of whatever replaced it, and the first revision
      // claimed to have been written at the moment it stopped being current.
      reasonAt: ctx.now(),
    };
  });

  /**
   * Frozen at mount by `useMemo` on the same deps `ctx` has — the fixture and the
   * action. It is the agent's OPENING position plus the evidence as it arrived, and
   * nothing in the reducer can reach it.
   */
  const opening = useMemo<Opening>(
    () => ({
      outcome: ctx.base.outcome,
      refund: ctx.base.refund,
      reason: ctx.base.reason,
      evidence: fixture.evidence,
    }),
    [ctx.base, fixture.evidence],
  );

  return { state, dispatch, limit: ctx.limit, claim: ctx.claim, recommended: state.agent.outcome, opening };
}

export type { Importance, EvidenceCall };
