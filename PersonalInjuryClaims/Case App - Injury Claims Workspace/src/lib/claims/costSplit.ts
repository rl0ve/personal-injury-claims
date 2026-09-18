// What a liability position costs.
//
// The claim's damages lines are fixed; the liability position decides who
// carries each one. So the split is derived, never stored: pick a different
// position and the table, the totals and the authority meter all move with it.
// That is the point of the console: you can see what a position costs before
// you sign it.

import type {
  CaseAction,
  CostAttribution,
  CostLine,
  DecisionOption,
} from "./types";

export interface SplitRow {
  line: CostLine;
  attribution: CostAttribution;
  vendor: number | null;
  customer: number | null;
}

export interface CostSplit {
  rows: SplitRow[];
  vendorTotal: number;
  customerTotal: number;
  claimTotal: number;
}

/** Falls back to leaving a line with the claimant when a position forgets it. */
const UNATTRIBUTED: CostAttribution = { to: "customer", why: "Not attributed" };

export function splitFor(action: CaseAction, option: DecisionOption | undefined): CostSplit {
  const lines = action.costLines ?? [];
  const allocation = option?.allocation ?? {};

  const rows = lines.map<SplitRow>((line) => {
    const attribution = allocation[line.id] ?? UNATTRIBUTED;
    const toVendor = attribution.to === "vendor";
    return {
      line,
      attribution,
      vendor: toVendor ? line.amount : null,
      customer: toVendor ? null : line.amount,
    };
  });

  return {
    rows,
    vendorTotal: rows.reduce((sum, r) => sum + (r.vendor ?? 0), 0),
    customerTotal: rows.reduce((sum, r) => sum + (r.customer ?? 0), 0),
    claimTotal: lines.reduce((sum, l) => sum + l.amount, 0),
  };
}

/** The split the agent is proposing, which is what the banner's recommendation shows. */
export function recommendedSplit(action: CaseAction): CostSplit {
  return splitFor(
    action,
    action.options.find((o) => o.outcome === action.recommendation.recommendedOutcome),
  );
}

export type AuthorityState = "within" | "over" | "denial";

export interface AuthorityVerdict {
  state: AuthorityState;
  /** What the signer is committing, meaning the insurer's share. */
  amount: number;
  limit: number;
  approver: string;
  /** Whether the signer can sign it alone. */
  canSignAlone: boolean;
}

/**
 * Whether this position sits inside the signer's limit.
 *
 * A liability denial is its own state, not simply "£0 and therefore fine":
 * leaving the claimant to carry their own damages is still a commitment, and it
 * routes for sign-off even though it costs Aldergate nothing. Reading the meter
 * as "under the limit" there would be exactly the wrong conclusion.
 */
export function authorityFor(
  action: CaseAction,
  option: DecisionOption | undefined,
  split: CostSplit,
): AuthorityVerdict | null {
  const authority = action.authority;
  if (!authority) return null;

  const isDenial = option?.outcome === "Denied";
  const over = split.vendorTotal > authority.limit;

  return {
    state: isDenial ? "denial" : over ? "over" : "within",
    amount: split.vendorTotal,
    limit: authority.limit,
    approver: authority.approver,
    canSignAlone: !isDenial && !over,
  };
}
