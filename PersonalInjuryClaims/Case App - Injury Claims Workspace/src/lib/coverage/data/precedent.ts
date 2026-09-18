import type { CoverageOptionId } from "./coverage-decision";

/**
 * WHAT OTHERS DECIDED — how claims like this one have gone before.
 *
 * The third thing the agent says. Not evidence about THIS case (that is
 * ./decision-signals.ts) and not the position itself (./coverage-decision.ts):
 * this is the base rate, and it answers a question neither of those can — "is
 * what I am about to do normal?"
 *
 * **The distribution is over the console's own three positions**, keyed by
 * `CoverageOptionId`, rather than over three strings written out here. That is the
 * whole reason the type is imported: a precedent list that could name a fourth
 * position, or spell one differently, would be a second vocabulary for the same
 * three choices — and the readout labels each row with the option's own `action`
 * text, so the words in the chat are the words on the submit button.
 *
 * **Counts, not percentages.** The percentages are the reading, and a reading is
 * derived: authoring both is how a widget ends up printing three shares that do
 * not add to a hundred. `shareOf` is the only place a percentage is worked out.
 *
 * **Authored, and honestly so.** These are invented figures for one invented
 * claim — there is no decision history behind the prototype to count. What they
 * are FOR is the shape of the claim: a clear majority landing where the agent
 * landed, with a real minority that did not, so that the readout is neither
 * decorative nor visibly unsupported.
 *
 * **This is the book's base rate, not this claimant's own history.** `This
 * claimant` on the decision page states a first claim in three years on risk,
 * which this distribution is not tied to — the two widgets answer different
 * questions ("is this normal across the book?" versus "has this claimant
 * claimed before?") and are allowed to disagree.
 */

/** One position, and how many similar cases went that way. */
export interface PrecedentShare {
  option: CoverageOptionId;
  cases: number;
}

export interface Precedent {
  /** How far back the comparison reaches. Printed as authored. */
  window: string;
  /** What made a case "similar" — the honest caveat on any base rate. */
  criteria: string;
  /**
   * The three positions and their counts, in no particular order: the readout
   * ranks them itself, so the order here carries no meaning and cannot
   * accidentally become the ranking.
   */
  shares: PrecedentShare[];
}

export const PRECEDENT: Precedent = {
  window: "Last 18 months",
  criteria: "contributory negligence, soft-tissue injury",
  shares: [
    { option: "partial", cases: 4 },
    { option: "full", cases: 2 },
    // Kept at zero rather than dropped. A row reading "Denial · 0% · 0 cases" is a
    // fact the reviewer wants — this claimant has never been denied — and an absent
    // row would only say that the position was never listed.
    { option: "deny", cases: 0 },
  ],
};

/**
 * How many similar cases there are in total.
 *
 * Derived from the counts, so the "6 similar cases" in the readout's header and
 * the three shares under it are one number read two ways — the rule
 * `CLAIM_TOTAL` follows in ./coverage-decision.ts for the same reason.
 */
export const PRECEDENT_TOTAL = PRECEDENT.shares.reduce((sum, s) => sum + s.cases, 0);

/**
 * One share as a whole-number percentage.
 *
 * Rounded, and the authored counts are chosen so the rounding still lands on a
 * hundred — 4, 2 and 0 of 6 give 67, 33 and 0. Counts that rounded to 99 or 101
 * would print a distribution that visibly fails to be one, so if these figures
 * change, check that the three still sum to 100.
 */
export function shareOf(share: PrecedentShare): number {
  return Math.round((share.cases / PRECEDENT_TOTAL) * 100);
}
