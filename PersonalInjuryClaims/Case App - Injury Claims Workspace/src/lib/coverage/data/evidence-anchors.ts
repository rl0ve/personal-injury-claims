/**
 * WHERE EACH FACT LIVES ON SCREEN — the seam between a view and the assessment
 * panel, and the only one there is.
 *
 * The panel's premise is that it knows nothing about the screen underneath
 * (../_components/assessment-panel/assessment-panel.tsx says so, and means it).
 * Putting markers over that screen needs one thing the panel cannot invent: which
 * DOM node holds which fact. This registry is that, and it keeps the premise true
 * in the direction that matters:
 *
 *  - the VIEW declares its anchors, as `data-evidence-anchor` attributes on the
 *    elements that state each fact (../_views/coverage-decision-console/case-panels.tsx);
 *  - the SIGNAL data references those ids (./decision-signals.ts);
 *  - the overlay only joins the two (../_components/evidence-spotlight/).
 *
 * Neither side imports the other, and a second view would declare anchors of its
 * own and get the same overlay for free. The alternative — locating a fact by
 * searching the rendered text for it — breaks on any copy edit and was never
 * seriously on the table.
 *
 * **Ids are declared here rather than written as literals at both ends.** That is
 * the whole reason this file exists as a map plus a derived type: a signal that
 * pointed at `cause-defects` would otherwise be a marker that silently never
 * appears, which is the hardest class of bug to notice in an overlay. As a union,
 * it is a compile error.
 *
 * **Anchor the smallest element that states the fact.** A marker on a whole panel
 * says "somewhere in here"; a marker on the row that reads `Goodwill, 12 mo £0`
 * says the thing. The exception is a fact that IS a whole block — the verdict is
 * three sentences and all of them are the fact.
 *
 * On a table, the attribute goes on a `<td>` and never on the `<tr>`: absolutely
 * positioning inside a table row is quirky across browsers, and the marker is
 * positioned against its host.
 */

export const EVIDENCE_ANCHORS = {
  /** "Liability is admitted in part. The reduction is 25%." — the finding's conclusion. */
  verdict: "verdict",
  /** The policy test's `5 pass · 1 fail · 1 open` tally. */
  policyTally: "policy-tally",
  /** Cause 1 — the third party's manoeuvre, inside the policy term. */
  causeDefect: "cause-defect",
  /** Cause 2 — the contributory negligence finding. */
  causeConfig: "cause-config",
  /** The contributory negligence row of the policy test, the one that fails. */
  policyFail: "policy-fail",
  /** The outstanding-medical-evidence row, the one left open. */
  policyOpen: "policy-open",
  /** `Interim payments YTD £3,200` in the claimant card. */
  customerCredits: "customer-credits",
  /** `Goodwill, 12 mo £0` — the headroom. */
  customerGoodwill: "customer-goodwill",
  /** `Annual premium £780` — what the policy is worth a year. */
  customerValue: "customer-value",
  /** `Renewal 2 Nov 2026` — when the policy comes up. */
  customerRenewal: "customer-renewal",
  /** The prior-claims row in historical data. */
  priorHistory: "prior-history",
} as const;

/** Every declared anchor, derived so the map and the type cannot disagree. */
export type EvidenceAnchorId =
  (typeof EVIDENCE_ANCHORS)[keyof typeof EVIDENCE_ANCHORS];
