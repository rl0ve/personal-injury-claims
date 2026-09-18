/**
 * THE EVIDENCE BEHIND THE RECOMMENDATION — the signals the assessment agent
 * read, and what each one holds up.
 *
 * Its own file, and the split from its two neighbours is deliberate:
 *
 *  - `./types.ts` is the shape of a FACT the assessment widget draws — a score, a
 *    status, a series. It says so at the top, and a signal is not one of those.
 *  - `./conversation.ts` is the record of two parties working out what the data
 *    means. A signal is neither the turn nor the reading; it is the reason a
 *    position was taken.
 *
 * Three contracts, three files — the argument those two already make for each
 * other.
 *
 * **These are extracted from the console underneath**
 * (../_views/coverage-decision-console): the finding, the policy test, the cost
 * table, the claimant card and the prior history. Every figure and date below
 * appears on that screen. They line up with the sentences of the
 * rationale the console drafts for the recommended position — the `draft` field
 * on the `partial` option in ./coverage-decision.ts — which is what makes this a
 * reading of that decision rather than a second opinion about it.
 *
 * **`importance` is how much the decision LEANS on the signal**, which is not the
 * same as how certain the signal is. A signal can be certain and still rank low,
 * where what it holds up is a boundary on the split rather than the split itself.
 *
 * **Authored and pure.** No clock, no counters, no reader state. The Signal
 * Collector is a prerendered route, so a value that differed between build and
 * hydration would be a mismatch — and what a reviewer THOUGHT of a signal is
 * runtime state that belongs next to the render, never folded into this file. An
 * authored fixture that carried a thumb would be asserting an opinion nobody
 * recorded.
 */

import { EVIDENCE_ANCHORS, type EvidenceAnchorId } from "./evidence-anchors";

/**
 * How much weight the recommendation puts on a signal.
 *
 * Three steps and no fourth. A fourth would need a rendering distinguishable from
 * its neighbours in a 237px column, and there isn't one — see the bar meter in
 * ../_components/assessment-chat/evidence-list.tsx.
 */
export type SignalImportance = "high" | "medium" | "low";

export interface DecisionSignal {
  /** Unique — the React key and the handle the feedback map is keyed by. */
  id: string;
  importance: SignalImportance;
  /**
   * The collapsed row's whole text. Kept under ~34 characters because it shares
   * one line with the bar meter and a chevron inside the panel's bubble.
   *
   * Not a truncation of `headline` — a shortened sentence reads as a bug, so this
   * is written as its own phrase and `headline` appears on expand.
   */
  short: string;
  /** The full title, shown once the row is open. */
  headline: string;
  /** The paragraph behind it. */
  description: string;
  /**
   * The line of the decision this signal holds up, in the fewest words that
   * still name the money. Sits under `short` on the collapsed row, so it is
   * short for the same reason.
   */
  backs: string;
  /** The systems it was read from — drawn as chips when the row is open. */
  sources: string[];
  /**
   * Where on screen this was read — one or more anchors the view declares
   * (./evidence-anchors.ts). Opening the Evidence section drops a numbered marker
   * on each, so the evidence can be read in place rather than only in the panel.
   *
   * More than one where the fact is genuinely stated twice: the contributory
   * negligence finding appears both as Cause 2 and as the failing row of the
   * policy test, and both are where a
   * reviewer would look for it. Never a list of everywhere the topic is mentioned
   * — a marker on each of nine tangentially related boxes is an overlay nobody
   * reads.
   *
   * The first anchor is the one a row scrolls to when it is expanded, so it should
   * be the fullest statement of the fact rather than the nearest.
   */
  anchors: EvidenceAnchorId[];
}

/**
 * The five, in the order the recommendation depends on them: why the reduction
 * applies at all, why liability is admitted in the first place, why care and
 * treatment sit outside the reduction, what the headroom on a goodwill gesture
 * is, and what the whole decision is worth getting right.
 *
 * **The last one is a frame rather than a finding**, and it is `high` deliberately.
 * The four above argue about how far the contributory negligence reduction reaches;
 * this one says what the argument costs. A claimant fourteen weeks out of work and a
 * £51,000 reduction he did not expect makes a disputed liability position a harder
 * conversation than a routine one, which is the kind of fact that changes what
 * "getting it right" means without changing a single policy clause. Ranking it
 * `medium` beside the goodwill headroom would have filed it as another
 * commercial nicety; it is the reason the others are urgent.
 *
 * **Deliberately five, not six.** A sixth signal, that the third-party vehicle's
 * fleet operator might be vicariously liable, is left off this list on purpose:
 * it is unestablished, and its whole argument is the one prior case that went
 * the other way — a claim closed with a confirmed operator fault and a successful
 * recovery. That prior case is a section of its own on the decision page
 * ("Historical data", from ./precedent.ts), so adding the signal here would have
 * put the same reasoning twice on one screen, once as evidence about THIS claim
 * and once as the base rate it is measured against.
 */
export const DECISION_SIGNALS: DecisionSignal[] = [
  {
    id: "sig-average-condition",
    importance: "high",
    short: "Contributory negligence reduces the damages",
    headline: "Contributory negligence at 25%: damages payable at 75%",
    description:
      "The third-party insurer puts Joseph Thompson's own share of the injury " +
      "at 25% because the seatbelt was not worn, and the examining clinician " +
      "ties part of the cervical injury severity to that. Neither reading " +
      "excludes the other. No rule in the case plan resolves how far the " +
      "reduction should reach, which is why the case escalated to a person at " +
      "09:41 rather than closing itself. A 75% position on general and special " +
      "damages is the only one that answers the finding as found: paying in " +
      "full ignores a contribution that is plainly made out, and denying " +
      "ignores a third-party manoeuvre that is plainly at fault.",
    backs: "A split, not all-or-nothing",
    sources: ["Case", "Injury Severity Data Gateway"],
    anchors: [EVIDENCE_ANCHORS.verdict, EVIDENCE_ANCHORS.policyTally],
  },
  {
    id: "sig-fire-covered",
    importance: "high",
    short: "Liability admitted in part, accident established",
    headline: "The accident is established and liability is admitted before the reduction",
    description:
      "The third-party vehicle pulled out of a side road into the claimant's " +
      "path, causing a cervical soft-tissue injury and a fractured left wrist. " +
      "The police report and the accident circumstances report both put the " +
      "third party at fault for the manoeuvre. Established on 09-01. The " +
      "accident falls inside a policy active to 2026-11-02, so nothing about " +
      "the term or the cover stands in the way — the whole question is how far " +
      "the contributory negligence reduction reaches.",
    backs: "General + special damages — £153,000.00 before the reduction",
    sources: ["Injury Claims Gateway", "Injury Severity Data Gateway"],
    anchors: [EVIDENCE_ANCHORS.causeDefect],
  },
  {
    id: "sig-ale-outside-average",
    importance: "high",
    short: "Care and treatment sit outside the reduction",
    headline: "The reduction reaches damages, not care and treatment costs",
    description:
      "Care and rehabilitation costs and medical and treatment costs are met " +
      "under their own policy limits, separate from the damages the " +
      "contributory negligence reduction applies to. The claimant has been off " +
      "work fourteen weeks with a graded return-to-work plan already agreed, so " +
      "these lines are paid in full rather than at the 75% ratio the general and " +
      "special damages lines carry.",
    backs: "Care + treatment — £15,900.00",
    sources: ["Injury Severity Data Gateway", "Provider Network Gateway"],
    anchors: [EVIDENCE_ANCHORS.causeConfig, EVIDENCE_ANCHORS.policyFail],
  },
  {
    id: "sig-goodwill-headroom",
    importance: "medium",
    short: "Goodwill has room and a reason",
    headline: "Goodwill has both room and a reason",
    description:
      "Standard tier, a policy worth £780 a year, no interim payments issued " +
      "before this claim, and a claimant injured for the first time in " +
      "three years on risk. Against that, £0 of goodwill has been extended to " +
      "this claimant in twelve months — so any further gesture beyond the " +
      "care and treatment lines already paid in full is a first " +
      "concession, not the latest of several.",
    backs: "No goodwill extended beyond care and treatment",
    sources: ["Injury Policy Gateway"],
    anchors: [EVIDENCE_ANCHORS.customerGoodwill, EVIDENCE_ANCHORS.customerCredits],
  },
  {
    id: "sig-shortfall-relationship",
    importance: "high",
    short: "£51,000 reduction the claimant did not expect",
    headline: "A £51,000 reduction lands on a claimant who has never claimed before",
    description:
      "Standard tier, a policy worth £780 a year, and this is the claimant's " +
      "first claim in three years on risk. Set against that, the contributory " +
      "negligence reduction alone is £51,000.00 — three times the annual " +
      "premium. What the decision turns on is therefore not only the ratio: the " +
      "updated medical records and the IME addendum are still outstanding, and a " +
      "clearly explained position delivered today costs less in a contested " +
      "complaint than a reduction that arrives as a surprise at settlement. The " +
      "fourteen weeks already lost to the injury are the part that will be " +
      "remembered either way.",
    backs: "£219,900.00 claimed, £51,000.00 reduction",
    sources: ["Injury Policy Gateway", "Injury Severity Data Gateway"],
    anchors: [EVIDENCE_ANCHORS.customerRenewal, EVIDENCE_ANCHORS.customerValue],
  },
];

/**
 * How many signals sit at each rank.
 *
 * Derived rather than written down, so adding a signal above changes the count
 * the widget prints without anybody editing a second place — the rule this app
 * follows for `CLAIM_TOTAL` in ./coverage-decision.ts, for the same reason.
 */
export function signalTally(
  signals: DecisionSignal[] = DECISION_SIGNALS,
): Record<SignalImportance, number> {
  return signals.reduce(
    (acc, s) => ({ ...acc, [s.importance]: acc[s.importance] + 1 }),
    { high: 0, medium: 0, low: 0 } as Record<SignalImportance, number>,
  );
}
